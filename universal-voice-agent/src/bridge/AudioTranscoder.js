/**
 * AudioTranscoder.js
 * ──────────────────
 * Handles real-time audio transcoding between telephony formats (8kHz μ-law)
 * and OpenAI Realtime API format (24kHz PCM16 linear).
 *
 * Pipeline:
 *   Exotel (8kHz μ-law) → decode μ-law → resample 8k→24k → OpenAI (24kHz PCM16)
 *   OpenAI (24kHz PCM16) → resample 24k→8k → encode μ-law → Exotel (8kHz μ-law)
 */

/**
 * μ-law to linear PCM16 lookup table (precomputed for performance).
 * @type {Int16Array}
 */
const ULAW_DECODE_TABLE = new Int16Array([
  -32124,-31100,-30076,-29052,-28028,-27004,-25980,-24956,
  -23932,-22908,-21884,-20860,-19836,-18812,-17788,-16764,
  -15996,-15484,-14972,-14460,-13948,-13436,-12924,-12412,
  -11900,-11388,-10876,-10364, -9852, -9340, -8828, -8316,
   -7932, -7676, -7420, -7164, -6908, -6652, -6396, -6140,
   -5884, -5628, -5372, -5116, -4860, -4604, -4348, -4092,
   -3900, -3772, -3644, -3516, -3388, -3260, -3132, -3004,
   -2876, -2748, -2620, -2492, -2364, -2236, -2108, -1980,
   -1884, -1820, -1756, -1692, -1628, -1564, -1500, -1436,
   -1372, -1308, -1244, -1180, -1116, -1052,  -988,  -924,
    -876,  -844,  -812,  -780,  -748,  -716,  -684,  -652,
    -620,  -588,  -556,  -524,  -492,  -460,  -428,  -396,
    -372,  -356,  -340,  -324,  -308,  -292,  -276,  -260,
    -244,  -228,  -212,  -196,  -180,  -164,  -148,  -132,
    -120,  -112,  -104,   -96,   -88,   -80,   -72,   -64,
     -56,   -48,   -40,   -32,   -24,   -16,    -8,     0,
   32124, 31100, 30076, 29052, 28028, 27004, 25980, 24956,
   23932, 22908, 21884, 20860, 19836, 18812, 17788, 16764,
   15996, 15484, 14972, 14460, 13948, 13436, 12924, 12412,
   11900, 11388, 10876, 10364,  9852,  9340,  8828,  8316,
    7932,  7676,  7420,  7164,  6908,  6652,  6396,  6140,
    5884,  5628,  5372,  5116,  4860,  4604,  4348,  4092,
    3900,  3772,  3644,  3516,  3388,  3260,  3132,  3004,
    2876,  2748,  2620,  2492,  2364,  2236,  2108,  1980,
    1884,  1820,  1756,  1692,  1628,  1564,  1500,  1436,
    1372,  1308,  1244,  1180,  1116,  1052,   988,   924,
     876,   844,   812,   780,   748,   716,   684,   652,
     620,   588,   556,   524,   492,   460,   428,   396,
     372,   356,   340,   324,   308,   292,   276,   260,
     244,   228,   212,   196,   180,   164,   148,   132,
     120,   112,   104,    96,    88,    80,    72,    64,
      56,    48,    40,    32,    24,    16,     8,     0
]);

export class AudioTranscoder {
  /**
   * @param {object} options
   * @param {number} [options.inputSampleRate=8000]
   * @param {number} [options.outputSampleRate=24000]
   * @param {number} [options.channels=1]
   */
  constructor(options = {}) {
    this.inputSampleRate = options.inputSampleRate || 8000;
    this.outputSampleRate = options.outputSampleRate || 24000;
    this.channels = options.channels || 1;
    this.ratio = this.outputSampleRate / this.inputSampleRate; // 3x upsampling
    this.downRatio = this.inputSampleRate / this.outputSampleRate; // 1/3 downsampling

    // Fractional sample accumulator for resampling
    this._upPhase = 0;
    this._downPhase = 0;
    this._downBuffer = [];

    console.log(
      `[AudioTranscoder] Initialized: ${this.inputSampleRate}Hz ↔ ${this.outputSampleRate}Hz (ratio: ${this.ratio})`
    );
  }

  /**
   * Decode a single μ-law byte to linear PCM16 sample.
   * @param {number} ulawByte - μ-law encoded byte (0-255)
   * @returns {number} Linear PCM16 sample (-32768 to 32767)
   */
  ulawToLinear(ulawByte) {
    // Invert all bits (μ-law is stored inverted)
    const inverted = ~ulawByte & 0xFF;
    const sign = inverted & 0x80;
    const exponent = (inverted >> 4) & 0x07;
    const mantissa = inverted & 0x0F;
    let sample = ((mantissa << 3) + 0x84) << exponent;
    sample -= 0x84;
    return sign ? -sample : sample;
  }

  /**
   * Encode a linear PCM16 sample to μ-law byte.
   * @param {number} sample - Linear PCM16 sample (-32768 to 32767)
   * @returns {number} μ-law encoded byte (0-255)
   */
  linearToUlaw(sample) {
    const BIAS = 0x84;
    const MAX = 0x7FFF;
    const CLIP = 32635;

    let sign = 0;
    if (sample < 0) {
      sign = 0x80;
      sample = -sample;
    }
    if (sample > CLIP) sample = CLIP;
    sample += BIAS;

    const exponent = 7;
    let expVal = 0;
    let mask = 0x4000;
    for (let exp = 0; exp < 7; exp++) {
      if (sample >= (mask >> 0)) {
        expVal = exp;
        break;
      }
      mask >>= 1;
    }

    // Simplified encoding using lookup approach
    const mantissa = (sample >> (expVal + 3)) & 0x0F;
    const ulawByte = ~(sign | (expVal << 4) | mantissa) & 0xFF;
    return ulawByte;
  }

  /**
   * Convert μ-law encoded Buffer (from Exotel) to 24kHz PCM16 Buffer (for OpenAI).
   * @param {Buffer} ulawBuffer - Raw μ-law audio bytes
   * @returns {Buffer} 24kHz PCM16 audio bytes (little-endian)
   */
  ulawToOpenAIPCM(ulawBuffer) {
    // Step 1: Decode μ-law → 8kHz linear PCM16
    const numSamples = ulawBuffer.length;
    const pcm8k = new Int16Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      pcm8k[i] = this.ulawToLinear(ulawBuffer[i]);
    }

    // Step 2: Resample 8kHz → 24kHz (3x upsampling with linear interpolation)
    const outputLength = Math.floor(numSamples * this.ratio);
    const pcm24k = new Int16Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcPos = i / this.ratio;
      const srcIndex = Math.floor(srcPos);
      const frac = srcPos - srcIndex;

      if (srcIndex + 1 < numSamples) {
        // Linear interpolation between adjacent samples
        pcm24k[i] = Math.round(
          pcm8k[srcIndex] * (1 - frac) + pcm8k[srcIndex + 1] * frac
        );
      } else if (srcIndex < numSamples) {
        pcm24k[i] = pcm8k[srcIndex];
      }
    }

    // Step 3: Convert Int16Array to Buffer (little-endian)
    return Buffer.from(pcm24k.buffer);
  }

  /**
   * Convert 24kHz PCM16 Buffer (from OpenAI) to μ-law Buffer (for Exotel).
   * @param {Buffer} pcm24kBuffer - 24kHz PCM16 audio bytes (little-endian)
   * @returns {Buffer} 8kHz μ-law audio bytes
   */
  openAIPCMToUlaw(pcm24kBuffer) {
    // Step 1: Convert Buffer to Int16Array
    const numSamples = Math.floor(pcm24kBuffer.length / 2);
    const pcm24k = new Int16Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      pcm24k[i] = pcm24kBuffer.readInt16LE(i * 2);
    }

    // Step 2: Resample 24kHz → 8kHz (3x downsampling with averaging)
    const outputLength = Math.floor(numSamples / this.ratio);
    const pcm8k = new Int16Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcStart = Math.floor(i * this.ratio);
      const srcEnd = Math.min(Math.floor((i + 1) * this.ratio), numSamples);
      let sum = 0;
      let count = 0;
      for (let j = srcStart; j < srcEnd; j++) {
        sum += pcm24k[j];
        count++;
      }
      pcm8k[i] = count > 0 ? Math.round(sum / count) : 0;
    }

    // Step 3: Encode linear PCM16 → μ-law
    const ulawBytes = Buffer.alloc(outputLength);
    for (let i = 0; i < outputLength; i++) {
      ulawBytes[i] = this.linearToUlaw(pcm8k[i]);
    }

    return ulawBytes;
  }

  /**
   * Reset internal state (call on new call session).
   */
  reset() {
    this._upPhase = 0;
    this._downPhase = 0;
    this._downBuffer = [];
  }
}

export default AudioTranscoder;

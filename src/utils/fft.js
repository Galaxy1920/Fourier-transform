export const FFT_SIZE = 2048;

/**
 * Applies a Hann window in-place to the given buffer
 */
export const applyHannWindow = (buffer) => {
  const windowedBuffer = new Float32Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    // Hann window function: 0.5 * (1 - cos(2*pi*n / (N-1)))
    const multiplier = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (buffer.length - 1)));
    windowedBuffer[i] = buffer[i] * multiplier;
  }
  return windowedBuffer;
};

/**
 * Radix-2 Cooley-Tukey FFT implementation
 * Input size must be 2048 for our case
 */
export const performFFT = (realInput) => {
  const n = realInput.length;
  // Make a copy
  let real = new Float32Array(n);
  real.set(realInput);
  let imag = new Float32Array(n);

  // Bit reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      let temp = real[i];
      real[i] = real[j];
      real[j] = temp;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Cooley-Tukey Decimation-in-time
  for (let size = 2; size <= n; size *= 2) {
    let halfSize = size / 2;
    let theta = (-2 * Math.PI) / size;
    let wRealStep = Math.cos(theta);
    let wImagStep = Math.sin(theta);

    for (let i = 0; i < n; i += size) {
      let wReal = 1;
      let wImag = 0;
      for (let k = 0; k < halfSize; k++) {
        let tReal = wReal * real[i + k + halfSize] - wImag * imag[i + k + halfSize];
        let tImag = wReal * imag[i + k + halfSize] + wImag * real[i + k + halfSize];

        real[i + k + halfSize] = real[i + k] - tReal;
        imag[i + k + halfSize] = imag[i + k] - tImag;
        
        real[i + k] += tReal;
        imag[i + k] += tImag;

        // Next W
        let nextWReal = wReal * wRealStep - wImag * wImagStep;
        let nextWImag = wReal * wImagStep + wImag * wRealStep;
        wReal = nextWReal;
        wImag = nextWImag;
      }
    }
  }

  // Calculate magnitude, we only need first half (Nyquist limit)
  const magnitudes = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    // Normalize and compute magnitude
    const magnitude = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / n;
    magnitudes[i] = magnitude;
  }

  return magnitudes;
};

/**
 * Converts linear magnitude array into an array suitable for logarithmic frequency visualization.
 */
export const convertToLogScale = (magnitudes, numBins = 512, sampleRate = 44100) => {
  const logMagnitudes = new Float32Array(numBins);
  const nyquist = sampleRate / 2;
  const minFreq = 20; // Start at 20Hz to avoid low frequency bunching
  const maxFreq = nyquist;
  
  const minLog = Math.log10(minFreq);
  const maxLog = Math.log10(maxFreq);
  
  for (let i = 0; i < numBins; i++) {
    const logIdx = minLog + (i / (numBins - 1)) * (maxLog - minLog);
    const hz = Math.pow(10, logIdx);
    
    // Map frequency (hz) to linear bin index
    const binRatio = hz / nyquist;
    const linearIdx = binRatio * magnitudes.length;
    
    const floorIdx = Math.floor(linearIdx);
    let ceilIdx = Math.ceil(linearIdx);
    if (ceilIdx >= magnitudes.length) ceilIdx = magnitudes.length - 1;
    
    // Linear interpolation
    const fraction = linearIdx - floorIdx;
    
    if (floorIdx >= 0 && floorIdx < magnitudes.length) {
      const val = magnitudes[floorIdx] * (1 - fraction) + magnitudes[ceilIdx] * fraction;
      
      // Convert magnitude to decibels
      const db = 20 * Math.log10(val + 1e-6);
      
      // Map approx -100dB (silence) to 0, and upper bound to 1
      const normalizedDb = Math.max(0, Math.min(1, (db + 100) / 100));
      logMagnitudes[i] = normalizedDb;
    }
  }
  
  return logMagnitudes;
};

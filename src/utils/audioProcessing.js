export const processAudioFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target.result;
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Use only the first channel (left channel)
        const rawData = audioBuffer.getChannelData(0);
        
        // Use the entire audio buffer for full spectrogram
        const sampleRate = audioBuffer.sampleRate;
        const pcmData = rawData;

        resolve({ pcmData, sampleRate });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

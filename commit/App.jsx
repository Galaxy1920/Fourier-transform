import React, { useState, useRef } from 'react';
import Uploader from './components/Uploader';
import Visualizer from './components/Visualizer';
import Controller from './components/Controller';
import { processAudioFile } from './utils/audioProcessing';
import { FFT_SIZE } from './utils/fft';
import { Activity } from 'lucide-react';

const HOP_SIZE = 1024; // 50% overlap

function App() {
  const [pcmData, setPcmData] = useState(null);
  const [sampleRate, setSampleRate] = useState(44100);
  const [step, setStep] = useState(-1);
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleFileSelected = async (file) => {
      setIsLoading(true);
      try {
        const url = URL.createObjectURL(file);
        setAudioUrl(url);

        const { pcmData: data, sampleRate: rate } = await processAudioFile(file);
        setPcmData(data);
      setSampleRate(rate);
      
      const frames = Math.floor((data.length - FFT_SIZE) / HOP_SIZE);
      setTotalFrames(frames);
      
      setStep(0);
      setCurrentFrameIdx(0);
    } catch (err) {
      console.error(err);
      alert('Error processing audio file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setPcmData(null);
    setAudioUrl(null);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setStep(-1);
    setCurrentFrameIdx(0);
    setTotalFrames(0);
  };

  return (
    <div className="app-container">
      {audioUrl && (
        <audio 
          ref={audioRef} 
          src={audioUrl} 
          onPlay={() => setIsPlaying(true)} 
          onPause={() => setIsPlaying(false)} 
          onEnded={() => setIsPlaying(false)}
        />
      )}
      <header className="header fade-in">
        <h1 className="title">
          <Activity size={40} style={{ display: 'inline', marginRight: '10px', verticalAlign: 'text-bottom' }} />
          STFT Visualizer
        </h1>
        <p className="subtitle">Learn Fourier Transform Step-by-Step with Log Scale & Hann Window</p>
      </header>

      <main>
        {step === -1 ? (
          isLoading ? (
            <div className="uploader-container">
              <h2 className="title" style={{ fontSize: '2rem' }}>Processing Audio...</h2>
            </div>
          ) : (
            <Uploader onFileSelected={handleFileSelected} />
          )
        ) : (
          <div className="visualization-area fade-in">
            <Visualizer 
              pcmData={pcmData} 
              step={step} 
              currentFrameIdx={currentFrameIdx} 
              sampleRate={sampleRate} 
              audioRef={audioRef}
            />
            <Controller 
              step={step} 
              setStep={setStep} 
              totalFrames={totalFrames}
              currentFrameIdx={currentFrameIdx}
              setCurrentFrameIdx={setCurrentFrameIdx}
              onReset={handleReset}
              isPlaying={isPlaying}
              togglePlay={() => {
                if (audioRef.current) {
                  if (isPlaying) {
                    audioRef.current.pause();
                  } else {
                    audioRef.current.play();
                  }
                }
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

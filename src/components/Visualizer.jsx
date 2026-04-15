import React, { useEffect, useRef, useState } from 'react';
import { FFT_SIZE, applyHannWindow, performFFT, convertToLogScale } from '../utils/fft';
import './Visualizer.css';

const HOP_SIZE = 1024; // 50% overlap

const Visualizer = ({ pcmData, step, currentFrameIdx, sampleRate, audioRef }) => {
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const cachedCanvasRef = useRef(null);
  const [computedSpectrogram, setComputedSpectrogram] = useState(null);
  const [isComputing, setIsComputing] = useState(false);
  const [computingProgress, setComputingProgress] = useState(0);

  // Precompute full spectrogram for step 5 in chunks to avoid UI freeze
  useEffect(() => {
    if (step === 5 && pcmData && !computedSpectrogram && !isComputing) {
      const numFrames = Math.floor((pcmData.length - FFT_SIZE) / HOP_SIZE);
      const specs = [];
      setIsComputing(true);
      setComputingProgress(0);

      const CHUNK_SIZE = 50;
      let currentIdx = 0;

      const computeChunk = () => {
        const nextEnd = Math.min(currentIdx + CHUNK_SIZE, numFrames);
        for (let i = currentIdx; i < nextEnd; i++) {
          const start = i * HOP_SIZE;
          const frame = pcmData.slice(start, start + FFT_SIZE);
          const windowed = applyHannWindow(frame);
          const mags = performFFT(windowed);
          const logMags = convertToLogScale(mags, 512, sampleRate);
          specs.push(logMags);
        }

        currentIdx = nextEnd;
        setComputingProgress(Math.floor((currentIdx / numFrames) * 100));

        if (currentIdx < numFrames) {
          setTimeout(computeChunk, 0);
        } else {
          setComputedSpectrogram(specs);
          setIsComputing(false);
        }
      };

      computeChunk();
    }
  }, [step, pcmData, computedSpectrogram, isComputing, sampleRate]);

  // Render spectrogram to cached canvas once computation is done
  useEffect(() => {
    if (computedSpectrogram && !cachedCanvasRef.current) {
      const numSlices = computedSpectrogram.length;
      const numBins = computedSpectrogram[0].length;
      
      const offscreen = document.createElement('canvas');
      offscreen.width = 800;
      offscreen.height = 400;
      const offCtx = offscreen.getContext('2d');
      
      const width = offscreen.width;
      const height = offscreen.height;
      const sliceWidth = width / numSlices;
      const sliceHeight = height / numBins;

      // Use ImageData for high performance pixel manipulation
      const imageData = offCtx.createImageData(width, height);
      const data = imageData.data;

      const hslToRgb = (h, s, l) => {
        let r, g, b;
        if (s === 0) {
          r = g = b = l; // achromatic
        } else {
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          const hue2rgb = (t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
          };
          r = hue2rgb(h + 1/3);
          g = hue2rgb(h);
          b = hue2rgb(h - 1/3);
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
      };

      for (let x = 0; x < width; x++) {
        const sliceIdx = Math.floor((x / width) * numSlices);
        const slice = computedSpectrogram[sliceIdx];
        
        for (let y = 0; y < height; y++) {
          const binIdx = Math.floor(((height - y) / height) * numBins);
          const val = slice[binIdx];
          
          const idx = (y * width + x) * 4;
          if (val > 0.05) {
            // Match Step 5: hsl(${240 - val * 240}, 100%, ${val * 50}%)
            const h = (240 - val * 240) / 360;
            const [r, g, b] = hslToRgb(h, 1, val * 0.5);
            
            data[idx] = r;
            data[idx+1] = g;
            data[idx+2] = b;
            data[idx+3] = 255;
          } else {
            data[idx] = 0;
            data[idx+1] = 0;
            data[idx+2] = 0;
            data[idx+3] = 255;
          }
        }
      }
      
      offCtx.putImageData(imageData, 0, 0);
      cachedCanvasRef.current = offscreen;
    }
  }, [computedSpectrogram]);

  // Playhead overlay effect
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !pcmData) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    let animationId;

    const renderPlayhead = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw playhead in steps where full horizontal scale is used
      if ((step === 0 || step === 1 || step === 5) && audioRef && audioRef.current && pcmData) {
        const currentTime = audioRef.current.currentTime;
        const totalTimeDisplayed = pcmData.length / sampleRate;

        if (currentTime <= totalTimeDisplayed) {
          const x = (currentTime / totalTimeDisplayed) * width;
          
          ctx.beginPath();
          ctx.strokeStyle = '#22c55e'; // green playhead
          ctx.lineWidth = 2;
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.fillStyle = '#22c55e';
          ctx.moveTo(x - 6, 0);
          ctx.lineTo(x + 6, 0);
          ctx.lineTo(x, 8);
          ctx.fill();
        }
      }

      animationId = requestAnimationFrame(renderPlayhead);
    };

    renderPlayhead();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [step, pcmData, sampleRate, audioRef]);

  // Main canvas rendering effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pcmData) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Helper to draw waveform
    const drawWaveform = (data, color, xOffset = 0, targetWidth = width) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      const stepSize = Math.max(1, Math.floor(data.length / targetWidth));
      
      for (let i = 0; i < targetWidth; i++) {
        const dataIdx = i * stepSize;
        if (dataIdx >= data.length) break;
        const val = data[dataIdx];
        const x = xOffset + i;
        const y = height / 2 - (val * height / 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    // Optimization: If in Step 5 and we have a cached spectrogram, just draw it
    if (step === 5 && cachedCanvasRef.current) {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(cachedCanvasRef.current, 0, 0);
      ctx.fillStyle = '#fff';
      ctx.font = '16px Outfit';
      ctx.fillText(`Full Spectrogram (${computedSpectrogram?.length} frames)`, 10, 20);
      return;
    } else if (step === 5) {
      // Still computing
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#fff';
      ctx.font = '16px Outfit';
      ctx.fillText(`Computing Spectrogram... ${computingProgress}%`, 10, 30);
      return;
    }

    // Standard drawing for other steps
    ctx.clearRect(0, 0, width, height);
    const frameStart = currentFrameIdx * HOP_SIZE;
    const frameEnd = frameStart + FFT_SIZE;

    if (step === 0 || step === 1) {
      // Draw full waveform
      drawWaveform(pcmData, 'rgba(161, 161, 170, 0.4)');
      
      if (step === 1 && frameEnd <= pcmData.length) {
        // Highlight current frame
        const xStart = (frameStart / pcmData.length) * width;
        const xEnd = (frameEnd / pcmData.length) * width;
        
        ctx.fillStyle = 'rgba(99, 102, 241, 0.3)';
        ctx.fillRect(xStart, 0, Math.max(xEnd - xStart, 2), height);
        
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2;
        ctx.strokeRect(xStart, 0, Math.max(xEnd - xStart, 2), height);

        ctx.fillStyle = '#fff';
        ctx.font = '14px Outfit';
        ctx.fillText('2048 Samples Frame', xStart + 5, 20);
      }
    } else if (step === 2) {
      // Show windowing
      if (frameEnd > pcmData.length) return;
      const frame = pcmData.slice(frameStart, frameEnd);
      const windowed = applyHannWindow(frame);

      // Draw original frame in background
      drawWaveform(frame, 'rgba(161, 161, 170, 0.3)');

      // Draw Hann curve overlay
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; // red for window curve
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      for (let i = 0; i < width; i++) {
        const n = Math.floor((i / width) * FFT_SIZE);
        const windowVal = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (FFT_SIZE - 1)));
        const y = height - (windowVal * height);
        if (i === 0) ctx.moveTo(i, y);
        else ctx.lineTo(i, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw windowed frame
      drawWaveform(windowed, '#22c55e');

      ctx.fillStyle = '#fff';
      ctx.font = '16px Outfit';
      ctx.fillText('Applying Hann Window Curve', 10, 20);
    } else if (step === 3 || step === 4) {
      if (frameEnd > pcmData.length) return;
      const frame = pcmData.slice(frameStart, frameEnd);
      const windowed = applyHannWindow(frame);
      const mags = performFFT(windowed);
      const logMags = convertToLogScale(mags, 512, sampleRate);

      if (step === 3) {
        // Draw logarithmic frequency spectrum
        ctx.fillStyle = '#1e202d';
        ctx.fillRect(0, 0, width, height);

        const barWidth = width / logMags.length;
        
        for (let i = 0; i < logMags.length; i++) {
          const val = logMags[i]; // 0 to 1
          const barHeight = val * height;
          
          // Color gradient based on frequency
          const hue = 240 - (i / logMags.length) * 240; // Blue to Red
          ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
          
          ctx.fillRect(i * barWidth, height - barHeight, Math.max(1, barWidth - 0.5), barHeight);
        }

        ctx.fillStyle = '#fff';
        ctx.font = '16px Outfit';
        ctx.fillText('FFT Output (Log Frequency Axis)', 10, 20);
      } else if (step === 4) {
        // Show conversion to single slice
        const centerX = width / 2;
        
        for (let i = 0; i < logMags.length; i++) {
          const val = logMags[i];
          const hue = 240 - (val * 240); // Intensity mapping
          ctx.fillStyle = val > 0.05 ? `hsl(${hue}, 100%, ${val * 50}%)` : '#000';
          
          const y = height - (i / logMags.length) * height;
          ctx.fillRect(centerX - 10, y, 20, Math.max(1, height / logMags.length));
        }

        ctx.fillStyle = '#fff';
        ctx.font = '16px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('Transform to Spectrogram Slice Y-Axis: Frequency, Color: Intensity', width / 2, 20);
        ctx.textAlign = 'left';

        // Arrows and context
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.moveTo(centerX + 30, height / 2);
        ctx.lineTo(centerX + 80, height / 2);
        ctx.stroke();
      }
    }
  }, [pcmData, step, currentFrameIdx, sampleRate, computedSpectrogram, computingProgress]);

  return (
    <div className="visualizer-container glass-panel fade-in">
      {isComputing && (
        <div className="computing-overlay">
          <div className="progress-container">
            <div className="progress-bar-fill" style={{ width: `${computingProgress}%` }}></div>
            <span className="progress-text">Analyzing Audio: {computingProgress}%</span>
          </div>
        </div>
      )}
      <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={400} 
          className="visualizer-canvas"
        />
        <canvas 
          ref={overlayCanvasRef}
          width={800}
          height={400}
          className="visualizer-canvas"
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', background: 'transparent', boxShadow: 'none' }}
        />
      </div>
    </div>
  );
};

export default Visualizer;

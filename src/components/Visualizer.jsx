import React, { useEffect, useRef, useState } from 'react';
import { FFT_SIZE, applyHannWindow, performFFT, convertToLogScale } from '../utils/fft';
import './Visualizer.css';

const HOP_SIZE = 1024; // 50% overlap

const Visualizer = ({ pcmData, step, currentFrameIdx, sampleRate, audioRef }) => {
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const [computedSpectrogram, setComputedSpectrogram] = useState(null);

  useEffect(() => {
    // Precompute full spectrogram for step 5
    if (step === 5 && pcmData && !computedSpectrogram) {
      const numFrames = Math.floor((pcmData.length - FFT_SIZE) / HOP_SIZE);
      const specs = [];
      for (let i = 0; i < numFrames; i++) {
        const start = i * HOP_SIZE;
        const frame = pcmData.slice(start, start + FFT_SIZE);
        const windowed = applyHannWindow(frame);
        const mags = performFFT(windowed);
        const logMags = convertToLogScale(mags, 512, sampleRate);
        specs.push(logMags);
      }
      setComputedSpectrogram(specs);
    }
  }, [step, pcmData, computedSpectrogram, sampleRate]);

  // ─── Playhead overlay (all steps) ────────────────────────────────────────
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !pcmData) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    let animationId;

    const renderPlayhead = () => {
      ctx.clearRect(0, 0, width, height);

      if (audioRef && audioRef.current) {
        const currentTime = audioRef.current.currentTime;
        const totalDuration = pcmData.length / sampleRate;

        if (currentTime <= totalDuration) {
          // For step 0 and step 5: full-width playhead over the full signal/spectrogram
          if (step === 0 || step === 5) {
            const x = (currentTime / totalDuration) * width;
            drawVerticalPlayhead(ctx, x, height);
          }
          // For steps 1–4: playhead on waveform shows current frame position
          else if (step >= 1 && step <= 4) {
            const x = (currentTime / totalDuration) * width;
            drawVerticalPlayhead(ctx, x, height);
          }
        }
      }

      animationId = requestAnimationFrame(renderPlayhead);
    };

    renderPlayhead();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [step, pcmData, sampleRate, audioRef]);

  function drawVerticalPlayhead(ctx, x, height) {
    ctx.beginPath();
    ctx.strokeStyle = '#22c55e';
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

  // ─── Main canvas draw ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pcmData) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const frameStart = currentFrameIdx * HOP_SIZE;
    const frameEnd = frameStart + FFT_SIZE;

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

    if (step === 0 || step === 1) {
      drawWaveform(pcmData, 'rgba(161, 161, 170, 0.4)');
      
      if (step === 1 && frameEnd <= pcmData.length) {
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
      if (frameEnd > pcmData.length) return;
      const frame = pcmData.slice(frameStart, frameEnd);
      const windowed = applyHannWindow(frame);

      // Draw background waveform context (full waveform, faded)
      drawWaveform(pcmData, 'rgba(161, 161, 170, 0.15)');

      // Current frame original
      drawWaveform(frame, 'rgba(161, 161, 170, 0.5)');

      // Hann window curve
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
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

      // Windowed result
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
        ctx.fillStyle = '#1e202d';
        ctx.fillRect(0, 0, width, height);

        const barWidth = width / logMags.length;
        
        for (let i = 0; i < logMags.length; i++) {
          const val = logMags[i];
          const barHeight = val * height;
          const hue = 240 - (i / logMags.length) * 240;
          ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
          ctx.fillRect(i * barWidth, height - barHeight, Math.max(1, barWidth - 0.5), barHeight);
        }

        ctx.fillStyle = '#fff';
        ctx.font = '16px Outfit';
        ctx.fillText('FFT Output (Log Frequency Axis)', 10, 20);
      } else if (step === 4) {
        const centerX = width / 2;
        
        for (let i = 0; i < logMags.length; i++) {
          const val = logMags[i];
          const hue = 240 - (val * 240);
          ctx.fillStyle = val > 0.05 ? `hsl(${hue}, 100%, ${val * 50}%)` : '#000';
          
          const y = height - (i / logMags.length) * height;
          ctx.fillRect(centerX - 10, y, 20, Math.max(1, height / logMags.length));
        }

        ctx.fillStyle = '#fff';
        ctx.font = '16px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('Transform to Spectrogram Slice  Y-Axis: Frequency, Color: Intensity', width / 2, 20);
        ctx.textAlign = 'left';

        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.moveTo(centerX + 30, height / 2);
        ctx.lineTo(centerX + 80, height / 2);
        ctx.stroke();
      }
    } else if (step === 5) {
      if (!computedSpectrogram) {
        ctx.fillStyle = '#fff';
        ctx.font = '16px Outfit';
        ctx.fillText('Computing Spectrogram...', 10, 30);
        return;
      }

      const numSlices = computedSpectrogram.length;
      const sliceWidth = width / numSlices;
      const numBins = computedSpectrogram[0].length;
      const sliceHeight = height / numBins;

      for (let x = 0; x < numSlices; x++) {
        const slice = computedSpectrogram[x];
        for (let y = 0; y < numBins; y++) {
          const val = slice[y];
          const hue = 240 - (val * 240);
          ctx.fillStyle = val > 0.05 ? `hsl(${hue}, 100%, ${val * 50}%)` : '#000';
          ctx.fillRect(x * sliceWidth, height - (y * sliceHeight) - sliceHeight, sliceWidth + 0.5, sliceHeight + 0.5);
        }
      }
      
      ctx.fillStyle = '#fff';
      ctx.font = '16px Outfit';
      ctx.fillText(`Full Spectrogram (${numSlices} frames)`, 10, 20);
    }
  }, [pcmData, step, currentFrameIdx, sampleRate, computedSpectrogram]);

  return (
    <div className="visualizer-container glass-panel fade-in">
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

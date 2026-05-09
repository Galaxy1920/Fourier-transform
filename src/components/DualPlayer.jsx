import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Music, Play, Pause, Square } from 'lucide-react';
import './DualPlayer.css';

const AudioUploader = ({ onFileSelected, file }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault(); 
    e.stopPropagation(); 
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const f = e.dataTransfer.files[0];
      if (f.type.startsWith('audio/')) onFileSelected(f);
      else alert('Please upload an audio file');
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const f = e.target.files[0];
      if (f.type.startsWith('audio/')) onFileSelected(f);
      else alert('Please upload an audio file');
    }
  };

  return (
    <div 
      className={`dp-drop-zone glass-panel ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current.click()}
    >
      <div className="icon-pulse" style={{ marginBottom: '15px' }}>
        {isDragging ? <UploadCloud size={48} className="icon-active" /> : <Music size={48} className="icon-idle" />}
      </div>
      <h4 style={{ margin: '0 0 5px 0', fontSize: '0.9rem', fontWeight: 600, color: '#f5f5f7' }}>
        {file ? file.name : 'Click or Drag Audio File Here'}
      </h4>
      {!file && <p style={{ fontSize: '0.75rem', color: '#a1a1aa', margin: 0 }}>Supports WAV, MP3, OGG, etc.</p>}
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="audio/*" onChange={handleChange} />
    </div>
  );
};

const VolumeFader = ({ channelNum, volume, setVolume, dbValue, peakDb }) => {
  const heightPercent = Math.max(0, Math.min(100, (peakDb + 60) / 60 * 100));
  
  let barColor = '#3b82f6'; // default blue
  if (peakDb > -5) barColor = '#ef4444'; // red
  else if (peakDb > -15) barColor = '#f59e0b'; // yellow

  return (
    <div className="volume-section">
      <div className="volume-fader-container glass-panel">
        <div className="fader-header">
          <span className="fader-value" style={{ fontSize: '1rem', marginBottom: '10px' }}>{dbValue === -60 ? '-∞' : dbValue.toFixed(1)} dB</span>
        </div>
        
        <div className="fader-body">
          <div className="slider-wrapper">
            <input 
              type="range" 
              min="0" max="1" step="0.01" 
              value={volume} 
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="vertical-slider"
            />
          </div>
          <div className="vu-meter">
            <div className="vu-meter-bar" style={{ height: `${heightPercent}%`, backgroundColor: barColor }}></div>
          </div>
          <div className="vu-scale-container">
            <div className="vu-scale">
              {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map(val => (
                <div key={val} className="vu-tick">
                  <span className="vu-tick-line"></span>
                  <span className="vu-tick-label">{val === 0 ? '0' : `-${val}`}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="channel-label">채널 {channelNum}</div>
    </div>
  );
};

const DualPlayer = () => {
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  
  const [vol1, setVol1] = useState(1.0);
  const [vol2, setVol2] = useState(1.0);

  const [isPlaying, setIsPlaying] = useState(false);

  const audio1Ref = useRef(null);
  const audio2Ref = useRef(null);

  const audioCtxRef = useRef(null);
  const analyser1Ref = useRef(null);
  const analyser2Ref = useRef(null);
  const source1Ref = useRef(null);
  const source2Ref = useRef(null);
  const gain1Ref = useRef(null);
  const gain2Ref = useRef(null);

  const [peak1, setPeak1] = useState(-60);
  const [peak2, setPeak2] = useState(-60);

  const animationRef = useRef(null);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const setupAudio = (audioEl, isChannel1) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (isChannel1 && source1Ref.current) return;
    if (!isChannel1 && source2Ref.current) return;

    try {
      const source = audioCtxRef.current.createMediaElementSource(audioEl);
      const analyser = audioCtxRef.current.createAnalyser();
      const gain = audioCtxRef.current.createGain();

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      source.connect(gain);
      gain.connect(analyser);
      analyser.connect(audioCtxRef.current.destination);

      if (isChannel1) {
        source1Ref.current = source;
        analyser1Ref.current = analyser;
        gain1Ref.current = gain;
        gain.gain.value = vol1;
      } else {
        source2Ref.current = source;
        analyser2Ref.current = analyser;
        gain2Ref.current = gain;
        gain.gain.value = vol2;
      }
    } catch (e) {
      console.warn('Audio node already connected or error:', e);
    }
  };

  useEffect(() => {
    if (gain1Ref.current) gain1Ref.current.gain.value = vol1;
  }, [vol1]);

  useEffect(() => {
    if (gain2Ref.current) gain2Ref.current.gain.value = vol2;
  }, [vol2]);

  const updateMeters = () => {
    if (!isPlaying) {
      setPeak1(-60); setPeak2(-60);
      return;
    }

    const getPeak = (analyser) => {
      if (!analyser) return -60;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(dataArray);
      let max = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = Math.abs(dataArray[i] - 128);
        if (v > max) max = v;
      }
      if (max === 0) return -60;
      const linear = max / 128;
      const db = 20 * Math.log10(linear);
      return Math.max(-60, db);
    };

    setPeak1(getPeak(analyser1Ref.current));
    setPeak2(getPeak(analyser2Ref.current));

    animationRef.current = requestAnimationFrame(updateMeters);
  };

  useEffect(() => {
    if (isPlaying) {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      animationRef.current = requestAnimationFrame(updateMeters);
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      setPeak1(-60); setPeak2(-60);
    }
  }, [isPlaying]);

  const togglePlay = () => {
    if (!file1 && !file2) {
      alert('음원 파일을 먼저 업로드해주세요.');
      return;
    }
    
    // Ensure AudioContext is running
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    
    if (isPlaying) {
      if (audio1Ref.current) audio1Ref.current.pause();
      if (audio2Ref.current) audio2Ref.current.pause();
      setIsPlaying(false);
    } else {
      let playPromises = [];
      if (file1 && audio1Ref.current) playPromises.push(audio1Ref.current.play());
      if (file2 && audio2Ref.current) playPromises.push(audio2Ref.current.play());
      
      Promise.all(playPromises).then(() => {
        setIsPlaying(true);
      }).catch(e => {
        console.error(e);
        alert('오디오 재생 중 오류가 발생했습니다.');
      });
    }
  };

  const handleStop = () => {
    if (audio1Ref.current) { audio1Ref.current.pause(); audio1Ref.current.currentTime = 0; }
    if (audio2Ref.current) { audio2Ref.current.pause(); audio2Ref.current.currentTime = 0; }
    setIsPlaying(false);
  };

  // Sync ended state
  const handleEnded = () => {
    // If both ended or only one exists and ended
    if (
      (!file1 || (audio1Ref.current && audio1Ref.current.ended)) &&
      (!file2 || (audio2Ref.current && audio2Ref.current.ended))
    ) {
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    if (file1 && audio1Ref.current) audio1Ref.current.src = URL.createObjectURL(file1);
  }, [file1]);

  useEffect(() => {
    if (file2 && audio2Ref.current) audio2Ref.current.src = URL.createObjectURL(file2);
  }, [file2]);

  const dbVal1 = vol1 === 0 ? -60 : 20 * Math.log10(vol1);
  const dbVal2 = vol2 === 0 ? -60 : 20 * Math.log10(vol2);

  return (
    <div className="dual-player-container fade-in">
      <div className="dp-layout">
        <AudioUploader onFileSelected={(f) => setFile1(f)} file={file1} />
        <VolumeFader channelNum={1} volume={vol1} setVolume={setVol1} dbValue={dbVal1} peakDb={peak1} />
        
        <div className="dp-controls">
          <button className="primary-button play-btn" onClick={togglePlay} style={{ backgroundColor: isPlaying ? '#f59e0b' : '#8b5cf6' }}>
            {isPlaying ? (
              <><Pause size={20} fill="white" /> 일시정지</>
            ) : (
              <><Play size={20} fill="white" /> 재생 (Play)</>
            )}
          </button>
          <button className="glass-button stop-btn" onClick={handleStop}>
            <Square size={20} fill="#ef4444" color="#ef4444" /> 정지
          </button>
        </div>

        <VolumeFader channelNum={2} volume={vol2} setVolume={setVol2} dbValue={dbVal2} peakDb={peak2} />
        <AudioUploader onFileSelected={(f) => setFile2(f)} file={file2} />
      </div>

      <audio 
        ref={audio1Ref} 
        onCanPlay={() => setupAudio(audio1Ref.current, true)} 
        onEnded={handleEnded}
        crossOrigin="anonymous"
      />
      <audio 
        ref={audio2Ref} 
        onCanPlay={() => setupAudio(audio2Ref.current, false)} 
        onEnded={handleEnded}
        crossOrigin="anonymous"
      />
    </div>
  );
};

export default DualPlayer;

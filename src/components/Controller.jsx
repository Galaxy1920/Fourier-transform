import React from 'react';
import { ArrowRight, ArrowLeft, RefreshCw, Play, Pause, Square } from 'lucide-react';
import './Controller.css';

const steps = [
  { id: 0, title: '1. 원본 파형 (Raw Waveform)', desc: '업로드된 오디오의 전체 시간-진폭 파형입니다.' },
  { id: 1, title: '2. 프레이밍 (Framing: 2048)', desc: 'FFT 처리를 위해 2048개의 샘플 구간(Frame)을 추출합니다.' },
  { id: 2, title: '3. 윈도우 함수 (Hann Window)', desc: '구간 양끝단의 불연속성을 부드럽게 만들기 위해 Hann Window 곡선을 곱해줍니다.' },
  { id: 3, title: '4. 푸리에 변환 (FFT: Log Scale)', desc: '시간 영역의 데이터를 주파수 영역으로 변환합니다. x축은 로그 스케일로 시각화됩니다.' },
  { id: 4, title: '5. 스펙트로그램 조각 변환', desc: '하나의 프레임에서 얻어낸 주파수 크기 성분을 단일 열 이미지(색상 강도)로 변환합니다.' },
  { id: 5, title: '6. 전체 스펙트로그램', desc: '모든 프레임에 대해 위 과정을 반복하고 오버랩하여 시간-주파수 스펙트로그램을 완성합니다.' }
];

const Controller = ({ step, setStep, totalFrames, currentFrameIdx, setCurrentFrameIdx, onReset, onStop, isPlaying, togglePlay }) => {
  const handleNext = () => {
    if (step < 5) {
      setStep(step + 1);
    } else if (step === 5) {
      // Loop or nothing
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  return (
    <div className="controller-container glass-panel fade-in">
      <div className="step-info">
        <h2 className="step-title">{steps[step].title}</h2>
        <p className="step-desc">{steps[step].desc}</p>

        {(step > 0 && step < 5) && (
          <div className="frame-controls">
            <span>Frame: {currentFrameIdx} / {totalFrames}</span>
            <input
              type="range"
              min="0"
              max={Math.max(0, totalFrames - 1)}
              value={currentFrameIdx}
              onChange={(e) => setCurrentFrameIdx(Number(e.target.value))}
              className="frame-slider"
            />
          </div>
        )}
      </div>

      <div className="controls">
        <div className="playback-group">
          <button
            className="primary-button icon-btn"
            style={{ backgroundColor: isPlaying ? '#ef4444' : '#22c55e' }}
            onClick={togglePlay}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            {isPlaying ? '일시정지' : '재생 (Play)'}
          </button>
          
          <button
            className="glass-button icon-btn stop-btn"
            onClick={onStop}
          >
            <Square size={18} fill="#ef4444" /> 정지
          </button>
        </div>

        <button
          className="glass-button icon-btn"
          onClick={handlePrev}
          disabled={step === 0}
        >
          <ArrowLeft size={18} /> 이전
        </button>

        <button
          className="primary-button icon-btn"
          onClick={handleNext}
          disabled={step === 5}
        >
          다음 <ArrowRight size={18} />
        </button>

        <button className="glass-button icon-btn outline" onClick={onReset}>
          <RefreshCw size={18} /> 초기화
        </button>
      </div>

      <div className="progress-bar">
        {steps.map((s, i) => (
          <div key={i} className={`progress-dot ${step >= i ? 'active' : ''}`} />
        ))}
      </div>
    </div>
  );
};

export default Controller;

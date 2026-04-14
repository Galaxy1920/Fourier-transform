import React, { useState, useRef } from 'react';
import { UploadCloud, Music } from 'lucide-react';
import './Uploader.css';

const Uploader = ({ onFileSelected }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/')) {
        onFileSelected(file);
      } else {
        alert('Please upload an audio file (mp3, wav, etc.)');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type.startsWith('audio/')) {
        onFileSelected(file);
      } else {
         alert('Please upload an audio file (mp3, wav, etc.)');
      }
    }
  };

  return (
    <div className="uploader-container fade-in">
      <div 
        className={`drop-zone glass-panel ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current.click()}
      >
        <div className="icon-pulse">
          {isDragging ? <UploadCloud size={64} className="icon-active" /> : <Music size={64} className="icon-idle" />}
        </div>
        <h3>{isDragging ? 'Drop it here!' : 'Click or Drag Audio File Here'}</h3>
        <p className="subtitle">Supports WAV, MP3, OGG, etc.</p>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="audio/*" 
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
};

export default Uploader;

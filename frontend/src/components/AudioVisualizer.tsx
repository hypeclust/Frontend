import React from 'react';
import { motion } from 'framer-motion';

interface AudioVisualizerProps {
  isListening: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isListening }) => {
  // Minimal visualizer - just show listening state
  if (!isListening) return null;
  
  return (
    <div className="flex items-center gap-1">
      <div className="w-1 h-3 bg-blue-500 rounded-full animate-pulse"></div>
      <div className="w-1 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
      <div className="w-1 h-4 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
      <div className="w-1 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
      <div className="w-1 h-3 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
    </div>
  );
};

export default AudioVisualizer;

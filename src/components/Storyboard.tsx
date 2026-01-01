'use client';

import React from 'react';

interface StoryboardProps {
  imageUrl: string;
  onRegenerate: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

const Storyboard: React.FC<StoryboardProps> = ({ imageUrl, onRegenerate, onConfirm, isLoading }) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `storyboard_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col items-center space-y-6 animate-fade-in">
      <div className="w-full max-w-4xl bg-black rounded-lg border-2 border-neutral-700 overflow-hidden shadow-2xl relative group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Generated Storyboard Grid"
          className="w-full h-auto object-contain"
        />
        <div className="absolute top-2 left-2 bg-black/70 px-3 py-1 rounded text-xs text-white font-mono backdrop-blur-sm">
          Gemini 3 Pro Image (Nano Banana Pro 2K)
        </div>
        {/* Download button - appears on hover */}
        <button
          onClick={handleDownload}
          className="absolute top-2 right-2 bg-black/70 hover:bg-black/90 px-3 py-1 rounded text-xs text-white font-mono backdrop-blur-sm transition-all flex items-center gap-1 opacity-0 group-hover:opacity-100"
          title="Download Storyboard"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 w-full max-w-2xl justify-center">
        <button
          onClick={onRegenerate}
          disabled={isLoading}
          className="px-6 py-3 rounded-lg border border-neutral-600 text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
        >
          {isLoading ? 'Regenerating...' : 'Regenerate Storyboard'}
        </button>

        <button
          onClick={handleDownload}
          className="px-6 py-3 rounded-lg border border-neutral-600 text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Storyboard
        </button>

        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="px-8 py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold shadow-lg shadow-green-900/20 transition-all transform hover:scale-105"
        >
          Confirm & Go to Production
        </button>
      </div>

      <p className="text-neutral-500 text-sm max-w-lg text-center">
        Note: Confirming will slice this grid into 9 individual frames used as the starting point for video generation.
      </p>
    </div>
  );
};

export default Storyboard;

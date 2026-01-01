'use client';

import React, { useState } from 'react';
import { fileToBase64 } from '@/utils/imageUtils';
import { AspectRatio } from '@/types';

interface InputFormProps {
  onSubmit: (text: string, refVideo: string | undefined, refImages: string[] | undefined) => void;
  isLoading: boolean;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  enableCuts: boolean;
  onEnableCutsChange: (enabled: boolean) => void;
}

const InputForm: React.FC<InputFormProps> = ({ onSubmit, isLoading, aspectRatio, onAspectRatioChange, enableCuts, onEnableCutsChange }) => {
  const [prompt, setPrompt] = useState('');
  const [refVideo, setRefVideo] = useState<File | null>(null);
  const [refImages, setRefImages] = useState<File[]>([]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setRefImages(Array.from(files));
    }
  };

  const removeImage = (index: number) => {
    setRefImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    let videoBase64: string | undefined;
    let imagesBase64: string[] | undefined;

    if (refVideo) {
      try {
        videoBase64 = await fileToBase64(refVideo);
      } catch {
        alert("Error processing video file");
        return;
      }
    }

    if (refImages.length > 0) {
      try {
        imagesBase64 = await Promise.all(refImages.map(file => fileToBase64(file)));
      } catch {
        alert("Error processing image files");
        return;
      }
    }

    onSubmit(prompt, videoBase64, imagesBase64);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-neutral-800 rounded-xl shadow-xl border border-neutral-700">
      <h2 className="text-2xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500">
        New Project
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Project Description / Instructions
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full h-32 bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-red-500 focus:outline-none placeholder-neutral-500"
            placeholder="Describe your video... e.g. 'A futuristic city commercial in cyberpunk style'"
            required={!refVideo}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Reference Video (Optional)
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setRefVideo(e.target.files?.[0] || null)}
              className="block w-full text-sm text-neutral-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-neutral-700 file:text-white
                hover:file:bg-neutral-600"
            />
            <p className="text-xs text-neutral-500 mt-1">Used to extract script & style.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Reference Art/Characters (Optional)
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="block w-full text-sm text-neutral-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-neutral-700 file:text-white
                hover:file:bg-neutral-600"
            />
            <p className="text-xs text-neutral-500 mt-1">Select multiple images for style/character reference.</p>
            {refImages.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {refImages.map((file, idx) => (
                  <div key={idx} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Reference ${idx + 1}`}
                      className="w-16 h-16 object-cover rounded border border-neutral-600"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Aspect Ratio Toggle */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Aspect Ratio
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onAspectRatioChange('16:9')}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all flex items-center justify-center gap-2
                ${aspectRatio === '16:9'
                  ? 'border-red-500 bg-red-900/30 text-white'
                  : 'border-neutral-600 bg-neutral-800 text-neutral-400 hover:border-neutral-500'
                }`}
            >
              <div className={`w-8 h-[18px] border-2 rounded-sm ${aspectRatio === '16:9' ? 'border-red-400' : 'border-neutral-500'}`}></div>
              <span className="font-semibold">16:9</span>
              <span className="text-xs text-neutral-500">Landscape</span>
            </button>
            <button
              type="button"
              onClick={() => onAspectRatioChange('9:16')}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all flex items-center justify-center gap-2
                ${aspectRatio === '9:16'
                  ? 'border-red-500 bg-red-900/30 text-white'
                  : 'border-neutral-600 bg-neutral-800 text-neutral-400 hover:border-neutral-500'
                }`}
            >
              <div className={`w-[18px] h-8 border-2 rounded-sm ${aspectRatio === '9:16' ? 'border-red-400' : 'border-neutral-500'}`}></div>
              <span className="font-semibold">9:16</span>
              <span className="text-xs text-neutral-500">Portrait</span>
            </button>
          </div>
          <p className="text-xs text-neutral-500 mt-1">Affects storyboard grid and video generation.</p>
        </div>

        {/* Camera Cuts Toggle */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Multi-Shot Camera Cuts
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onEnableCutsChange(true)}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all flex items-center justify-center gap-2
                ${enableCuts
                  ? 'border-red-500 bg-red-900/30 text-white'
                  : 'border-neutral-600 bg-neutral-800 text-neutral-400 hover:border-neutral-500'
                }`}
            >
              <svg className={`w-5 h-5 ${enableCuts ? 'text-red-400' : 'text-neutral-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2m0 2v2m0-2H5m2 0h2m6 10v2m0-2v-2m0 2h-2m2 0h2M5 10h14M5 14h14M5 18h14" />
              </svg>
              <span className="font-semibold">Enable Cuts</span>
              <span className="text-xs text-neutral-500">Dynamic</span>
            </button>
            <button
              type="button"
              onClick={() => onEnableCutsChange(false)}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all flex items-center justify-center gap-2
                ${!enableCuts
                  ? 'border-red-500 bg-red-900/30 text-white'
                  : 'border-neutral-600 bg-neutral-800 text-neutral-400 hover:border-neutral-500'
                }`}
            >
              <svg className={`w-5 h-5 ${!enableCuts ? 'text-red-400' : 'text-neutral-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="font-semibold">Single Shot</span>
              <span className="text-xs text-neutral-500">Smooth</span>
            </button>
          </div>
          <p className="text-xs text-neutral-500 mt-1">Enable for dynamic multi-angle videos, disable for smooth continuous animation.</p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-3 px-6 rounded-lg font-bold text-lg transition-all transform hover:scale-[1.02]
            ${isLoading
              ? 'bg-neutral-600 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 shadow-lg shadow-red-900/20'
            }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating Script & Storyboard...
            </span>
          ) : (
            'Generate Storyboard'
          )}
        </button>
      </form>
    </div>
  );
};

export default InputForm;

'use client';

import React, { useState } from 'react';
import SkeletonLoader from '../ui/SkeletonLoader';

interface StoryboardStepProps {
  // Storyboard images
  storyboardUrl: string | null;
  storyboardUrl2: string | null; // For Seedance 15-scene mode
  // State
  isGeneratingStoryboard: boolean;
  isConfirming: boolean;
  // Config
  videoModel: 'veo-3.1' | 'seedance-1.5';
  seedanceSceneCount?: number;
  // Actions
  onRegenerate: () => void;
  onConfirm: () => void;
}

export default function StoryboardStep({
  storyboardUrl,
  storyboardUrl2,
  isGeneratingStoryboard,
  isConfirming,
  videoModel,
  seedanceSceneCount = 9,
  onRegenerate,
  onConfirm,
}: StoryboardStepProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const isSeedance15 = videoModel === 'seedance-1.5' && seedanceSceneCount === 15;

  // Only show regenerating overlay on first grid if we're actually regenerating it
  // (not when generating second grid for the first time)
  const isRegeneratingFirstGrid = isGeneratingStoryboard && (!isSeedance15 || storyboardUrl2 !== null);

  // Show loading skeleton
  if (isGeneratingStoryboard && !storyboardUrl) {
    return (
      <div className="max-w-4xl mx-auto">
        <SkeletonLoader variant="storyboard" message="Generating storyboard..." />
      </div>
    );
  }

  if (!storyboardUrl) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <p className="text-neutral-400">No storyboard available. Go back to generate one.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Review Storyboard</h2>
        <p className="text-neutral-400">
          {isSeedance15
            ? 'Review both grids. These define the look of your 15 scenes.'
            : 'Review the grid. This defines the look of your 9 scenes.'}
        </p>
      </div>

      {/* Storyboard grids */}
      <div className={`${isSeedance15 ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'max-w-4xl mx-auto'}`}>
        {/* First Grid (3x3) */}
        <div className="space-y-3">
          {isSeedance15 && (
            <h3 className="text-sm font-medium text-neutral-400 text-center">Scenes 1-9</h3>
          )}
          <div
            className={`relative bg-neutral-800 rounded-xl overflow-hidden border border-neutral-700 transition-colors ${
              isRegeneratingFirstGrid ? 'cursor-wait' : 'cursor-zoom-in hover:border-neutral-600'
            }`}
            onClick={() => !isRegeneratingFirstGrid && setSelectedImage(storyboardUrl)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={storyboardUrl}
              alt="Storyboard Grid 1"
              className={`w-full h-auto transition-opacity ${isRegeneratingFirstGrid ? 'opacity-40' : ''}`}
            />
            {/* Regenerating overlay - only show when actually regenerating first grid */}
            {isRegeneratingFirstGrid && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/60">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500 mb-3"></div>
                <p className="text-white font-medium">Regenerating storyboard...</p>
                <p className="text-neutral-400 text-sm mt-1">This may take a minute</p>
              </div>
            )}
          </div>
        </div>

        {/* Second Grid (3x2) - Seedance 15 mode only */}
        {isSeedance15 && storyboardUrl2 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-neutral-400 text-center">Scenes 10-15</h3>
            <div
              className="bg-neutral-800 rounded-xl overflow-hidden border border-neutral-700 cursor-zoom-in hover:border-neutral-600 transition-colors"
              onClick={() => setSelectedImage(storyboardUrl2)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={storyboardUrl2}
                alt="Storyboard Grid 2"
                className="w-full h-auto"
              />
            </div>
          </div>
        )}

        {/* Second grid loading state */}
        {isSeedance15 && !storyboardUrl2 && isGeneratingStoryboard && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-neutral-400 text-center">Scenes 10-15</h3>
            <SkeletonLoader variant="storyboard-3x2" message="Generating..." />
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-4 pt-4">
        <button
          onClick={onRegenerate}
          disabled={isGeneratingStoryboard || isConfirming}
          className="px-6 py-2.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isGeneratingStoryboard ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Regenerating...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Regenerate
            </>
          )}
        </button>

        <button
          onClick={onConfirm}
          disabled={isGeneratingStoryboard || isConfirming || (isSeedance15 && !storyboardUrl2)}
          className="px-8 py-2.5 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold shadow-lg shadow-green-900/20 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
        >
          {isConfirming ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing...
            </>
          ) : (
            <>
              Confirm & Continue
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>

      {/* Info text */}
      <p className="text-neutral-500 text-sm text-center max-w-lg mx-auto">
        Confirming will slice the grid{isSeedance15 ? 's' : ''} into individual frames for video generation.
      </p>

      {/* Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-6xl max-h-[90vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage}
              alt="Storyboard enlarged"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <button
              className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

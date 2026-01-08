'use client';

import React, { useState } from 'react';
import SkeletonLoader from '../ui/SkeletonLoader';

interface StoryboardStepProps {
  // Storyboard images
  storyboardUrl: string | null;
  storyboardUrl2: string | null; // For Seedance 15-scene mode
  // Prompts for copy feature
  storyboardPrompt1?: string;
  storyboardPrompt2?: string;
  // State
  isRegeneratingGrid1: boolean;
  isRegeneratingGrid2: boolean;
  isConfirming: boolean;
  // Config
  videoModel: 'veo-3.1' | 'seedance-1.5';
  seedanceSceneCount?: number;
  // Actions
  onRegenerateGrid1: () => void;
  onRegenerateGrid2: () => void;
  onConfirm: () => void;
}

export default function StoryboardStep({
  storyboardUrl,
  storyboardUrl2,
  storyboardPrompt1,
  storyboardPrompt2,
  isRegeneratingGrid1,
  isRegeneratingGrid2,
  isConfirming,
  videoModel,
  seedanceSceneCount = 9,
  onRegenerateGrid1,
  onRegenerateGrid2,
  onConfirm,
}: StoryboardStepProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<1 | 2 | null>(null);
  const isSeedance15 = videoModel === 'seedance-1.5' && seedanceSceneCount === 15;
  const isAnyGenerating = isRegeneratingGrid1 || isRegeneratingGrid2;

  const handleCopyPrompt = async (prompt: string | undefined, promptNumber: 1 | 2) => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(promptNumber);
      setTimeout(() => setCopiedPrompt(null), 2000);
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    }
  };

  // Show loading skeleton
  if (isRegeneratingGrid1 && !storyboardUrl) {
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
              isRegeneratingGrid1 ? 'cursor-wait' : 'cursor-zoom-in hover:border-neutral-600'
            }`}
            onClick={() => !isRegeneratingGrid1 && setSelectedImage(storyboardUrl)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={storyboardUrl}
              alt="Storyboard Grid 1"
              className={`w-full h-auto transition-opacity ${isRegeneratingGrid1 ? 'opacity-40' : ''}`}
            />
            {/* Regenerating overlay */}
            {isRegeneratingGrid1 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/60">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500 mb-3"></div>
                <p className="text-white font-medium">Regenerating...</p>
              </div>
            )}
          </div>
          {/* Action buttons for first grid */}
          <div className="flex gap-2">
            <button
              onClick={onRegenerateGrid1}
              disabled={isAnyGenerating || isConfirming}
              className="flex-1 px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isRegeneratingGrid1 ? (
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
            {storyboardPrompt1 && (
              <button
                onClick={() => handleCopyPrompt(storyboardPrompt1, 1)}
                className="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
                title="Copy prompt to clipboard"
              >
                {copiedPrompt === 1 ? (
                  <>
                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Prompt
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Second Grid (3x2) - Seedance 15 mode only */}
        {isSeedance15 && storyboardUrl2 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-neutral-400 text-center">Scenes 10-15</h3>
            <div
              className={`relative bg-neutral-800 rounded-xl overflow-hidden border border-neutral-700 transition-colors ${
                isRegeneratingGrid2 ? 'cursor-wait' : 'cursor-zoom-in hover:border-neutral-600'
              }`}
              onClick={() => !isRegeneratingGrid2 && setSelectedImage(storyboardUrl2)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={storyboardUrl2}
                alt="Storyboard Grid 2"
                className={`w-full h-auto transition-opacity ${isRegeneratingGrid2 ? 'opacity-40' : ''}`}
              />
              {/* Regenerating overlay */}
              {isRegeneratingGrid2 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/60">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500 mb-3"></div>
                  <p className="text-white font-medium">Regenerating...</p>
                </div>
              )}
            </div>
            {/* Action buttons for second grid */}
            <div className="flex gap-2">
              <button
                onClick={onRegenerateGrid2}
                disabled={isAnyGenerating || isConfirming}
                className="flex-1 px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isRegeneratingGrid2 ? (
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
              {storyboardPrompt2 && (
                <button
                  onClick={() => handleCopyPrompt(storyboardPrompt2, 2)}
                  className="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
                  title="Copy prompt to clipboard"
                >
                  {copiedPrompt === 2 ? (
                    <>
                      <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Prompt
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Second grid loading state */}
        {isSeedance15 && !storyboardUrl2 && isRegeneratingGrid2 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-neutral-400 text-center">Scenes 10-15</h3>
            <SkeletonLoader variant="storyboard-3x2" message="Generating..." />
          </div>
        )}
      </div>

      {/* Confirm button */}
      <div className="flex items-center justify-center pt-4">
        <button
          onClick={onConfirm}
          disabled={isAnyGenerating || isConfirming || (isSeedance15 && !storyboardUrl2)}
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

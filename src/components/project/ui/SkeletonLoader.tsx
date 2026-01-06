'use client';

import React from 'react';

interface SkeletonLoaderProps {
  variant: 'script' | 'storyboard' | 'storyboard-3x2' | 'video' | 'audio';
  message?: string;
}

export default function SkeletonLoader({ variant, message }: SkeletonLoaderProps) {
  switch (variant) {
    case 'script':
      return <ScriptSkeleton message={message} />;
    case 'storyboard':
      return <StoryboardSkeleton gridSize="3x3" message={message} />;
    case 'storyboard-3x2':
      return <StoryboardSkeleton gridSize="3x2" message={message} />;
    case 'video':
      return <VideoSkeleton message={message} />;
    case 'audio':
      return <AudioSkeleton message={message} />;
    default:
      return null;
  }
}

function ScriptSkeleton({ message }: { message?: string }) {
  return (
    <div className="space-y-6 p-6 bg-neutral-800/50 rounded-xl border border-neutral-700">
      <div className="flex items-center gap-3">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-neutral-500 border-t-red-500" />
        <span className="text-neutral-300 font-medium">{message || 'Generating script...'}</span>
      </div>

      {/* Title skeleton */}
      <div className="space-y-2">
        <div className="h-6 bg-neutral-700 rounded animate-pulse w-2/3" />
        <div className="h-4 bg-neutral-700/50 rounded animate-pulse w-1/3" />
      </div>

      {/* Scene skeletons */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 bg-neutral-900/50 rounded-lg space-y-2" style={{ animationDelay: `${i * 150}ms` }}>
            <div className="flex items-center gap-2">
              <div className="h-4 w-16 bg-neutral-700 rounded animate-pulse" />
              <div className="h-4 w-24 bg-neutral-700/50 rounded animate-pulse" />
            </div>
            <div className="h-3 bg-neutral-700/30 rounded animate-pulse w-full" />
            <div className="h-3 bg-neutral-700/30 rounded animate-pulse w-4/5" />
          </div>
        ))}
      </div>

      {/* Typing indicator */}
      <div className="flex items-center gap-1 text-neutral-500">
        <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

function StoryboardSkeleton({ gridSize, message }: { gridSize: '3x3' | '3x2'; message?: string }) {
  const rows = gridSize === '3x3' ? 3 : 2;
  const cols = 3;
  const totalCells = rows * cols;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 justify-center">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-neutral-500 border-t-red-500" />
        <span className="text-neutral-300 font-medium">{message || 'Generating storyboard...'}</span>
      </div>

      <div className="bg-neutral-800 rounded-xl overflow-hidden border border-neutral-700 p-2">
        <div className={`grid grid-cols-3 gap-2`}>
          {Array.from({ length: totalCells }).map((_, i) => (
            <div
              key={i}
              className="aspect-video bg-neutral-700 rounded-lg animate-pulse relative overflow-hidden"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-neutral-600/30 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-neutral-500 text-xs font-mono">Scene {i + 1}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VideoSkeleton({ message }: { message?: string }) {
  return (
    <div className="relative aspect-video bg-neutral-800 rounded-xl overflow-hidden border border-neutral-700">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="relative">
          <svg className="w-12 h-12 animate-spin text-neutral-600" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
        <span className="text-neutral-400 text-sm">{message || 'Generating video...'}</span>
      </div>
      {/* Animated gradient border */}
      <div className="absolute inset-0 rounded-xl border-2 border-transparent bg-gradient-to-r from-red-500 via-orange-500 to-red-500 bg-clip-border animate-pulse opacity-30" />
    </div>
  );
}

function AudioSkeleton({ message }: { message?: string }) {
  return (
    <div className="p-4 bg-neutral-800 rounded-xl border border-neutral-700">
      <div className="flex items-center gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-500 border-t-red-500 flex-shrink-0" />
        <div className="flex-1">
          <div className="text-sm text-neutral-300 mb-2">{message || 'Generating audio...'}</div>
          {/* Waveform skeleton */}
          <div className="flex items-center gap-0.5 h-8">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="w-1 bg-neutral-600 rounded-full animate-pulse"
                style={{
                  height: `${20 + Math.random() * 60}%`,
                  animationDelay: `${i * 50}ms`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React from 'react';

interface ProgressRingProps {
  progress?: number; // 0-100, undefined means indeterminate
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export default function ProgressRing({
  progress,
  size = 48,
  strokeWidth = 4,
  className = '',
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const isIndeterminate = progress === undefined;

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg
        className={isIndeterminate ? 'animate-spin' : ''}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Background circle */}
        <circle
          className="text-neutral-700"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress circle */}
        <circle
          className="text-red-500 transition-all duration-300 ease-out"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={
            isIndeterminate
              ? circumference * 0.75
              : circumference - (progress / 100) * circumference
          }
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{
            transformOrigin: 'center',
            transform: 'rotate(-90deg)',
          }}
        />
      </svg>
      {/* Center content */}
      {!isIndeterminate && progress !== undefined && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-white">{Math.round(progress)}%</span>
        </div>
      )}
    </div>
  );
}

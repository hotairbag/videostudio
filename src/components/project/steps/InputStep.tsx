'use client';

import React from 'react';
import SkeletonLoader from '../ui/SkeletonLoader';
import { Script } from '@/types';

interface InputStepProps {
  // Script state
  script: Script | null;
  isGeneratingScript: boolean;
  isGeneratingStoryboard: boolean;
  // Form content - passed as children
  children: React.ReactNode;
}

export default function InputStep({
  script,
  isGeneratingScript,
  isGeneratingStoryboard,
  children,
}: InputStepProps) {
  // Show skeleton when generating script
  if (isGeneratingScript) {
    return (
      <div className="max-w-3xl mx-auto">
        <SkeletonLoader
          variant="script"
          message="Writing your script... This may take a minute"
        />
      </div>
    );
  }

  // Show storyboard skeleton after script is done
  if (isGeneratingStoryboard && script) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Script preview */}
        <div className="p-4 bg-neutral-800/50 rounded-xl border border-neutral-700">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-green-400">Script ready</span>
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">{script.title}</h3>
          <p className="text-sm text-neutral-400">{script.scenes.length} scenes • {script.style}</p>
        </div>

        <SkeletonLoader
          variant="storyboard"
          message="Generating storyboard visuals..."
        />
      </div>
    );
  }

  // Show the form (passed as children)
  return <>{children}</>;
}

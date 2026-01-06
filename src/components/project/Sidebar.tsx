'use client';

import React from 'react';
import StepIndicator, { Step } from './StepIndicator';
import { AspectRatio, VideoModel, VoiceMode } from '@/types';

interface SidebarProps {
  projectTitle: string;
  projectPrompt?: string;
  steps: Step[];
  onStepClick: (stepId: string) => void;
  settings: {
    videoModel: VideoModel;
    aspectRatio: AspectRatio;
    voiceMode: VoiceMode;
    seedanceSceneCount?: number;
  };
  onBackToProjects?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({
  projectTitle,
  projectPrompt,
  steps,
  onStepClick,
  settings,
  onBackToProjects,
  isOpen,
  onClose,
}: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col transform transition-transform duration-300 ease-in-out lg:transform-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            {onBackToProjects && (
              <button
                onClick={onBackToProjects}
                className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Projects
              </button>
            )}
            {/* Mobile close button */}
            <button
              onClick={onClose}
              className="lg:hidden p-1 text-neutral-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <h2 className="text-lg font-semibold text-white truncate" title={projectTitle}>
            {projectTitle || 'Untitled Project'}
          </h2>
          {projectPrompt && (
            <p className="text-xs text-neutral-500 mt-1 line-clamp-2" title={projectPrompt}>
              {projectPrompt}
            </p>
          )}
        </div>

        {/* Steps */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
              Progress
            </h3>
            <StepIndicator steps={steps} onStepClick={onStepClick} />
          </div>
        </div>

        {/* Settings summary */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/50">
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
            Settings
          </h3>
          <div className="flex flex-wrap gap-1.5">
            <SettingBadge
              label={settings.videoModel === 'seedance-1.5' ? 'Seedance' : 'Veo 3.1'}
              color={settings.videoModel === 'seedance-1.5' ? 'purple' : 'blue'}
            />
            <SettingBadge label={settings.aspectRatio} color="neutral" />
            <SettingBadge
              label={settings.voiceMode === 'speech_in_video' ? 'Speech' : 'TTS'}
              color="neutral"
            />
            {settings.videoModel === 'seedance-1.5' && settings.seedanceSceneCount && (
              <SettingBadge label={`${settings.seedanceSceneCount} scenes`} color="neutral" />
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function SettingBadge({ label, color }: { label: string; color: 'purple' | 'blue' | 'neutral' }) {
  const colorClasses = {
    purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    neutral: 'bg-neutral-700/50 text-neutral-300 border-neutral-600',
  };

  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded border ${colorClasses[color]}`}
    >
      {label}
    </span>
  );
}

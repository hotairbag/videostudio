'use client';

import React, { useState, useMemo } from 'react';
import Sidebar from './Sidebar';
import StepTransition from './ui/StepTransition';
import { Step } from './StepIndicator';
import { AspectRatio, VideoModel, VoiceMode, Script } from '@/types';

export type ProjectStep = 'input' | 'storyboard' | 'production';

interface ProjectLayoutProps {
  children: React.ReactNode;
  currentStep: ProjectStep;
  onStepChange: (step: ProjectStep) => void;
  projectTitle: string;
  projectPrompt?: string;
  settings: {
    videoModel: VideoModel;
    aspectRatio: AspectRatio;
    voiceMode: VoiceMode;
    seedanceSceneCount?: number;
  };
  // Step completion indicators
  hasScript: boolean;
  hasStoryboard: boolean;
  hasFrames: boolean;
  hasAllVideos: boolean;
  // Loading states
  isGeneratingScript: boolean;
  isGeneratingStoryboard: boolean;
  // Navigation
  onBackToProjects?: () => void;
}

export default function ProjectLayout({
  children,
  currentStep,
  onStepChange,
  projectTitle,
  projectPrompt,
  settings,
  hasScript,
  hasStoryboard,
  hasFrames,
  hasAllVideos,
  isGeneratingScript,
  isGeneratingStoryboard,
  onBackToProjects,
}: ProjectLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const steps: Step[] = useMemo(() => {
    const getInputStatus = (): Step['status'] => {
      if (currentStep === 'input') return 'current';
      if (hasScript) return 'completed';
      return 'pending';
    };

    const getStoryboardStatus = (): Step['status'] => {
      if (currentStep === 'storyboard') return 'current';
      if (hasFrames) return 'completed';
      if (!hasScript) return 'locked';
      return 'pending';
    };

    const getProductionStatus = (): Step['status'] => {
      if (currentStep === 'production') return 'current';
      if (hasAllVideos) return 'completed';
      if (!hasFrames) return 'locked';
      return 'pending';
    };

    return [
      {
        id: 'input',
        label: 'Script & Settings',
        description: hasScript ? 'Script ready' : 'Configure your video',
        status: getInputStatus(),
        isLoading: isGeneratingScript,
      },
      {
        id: 'storyboard',
        label: 'Storyboard',
        description: hasFrames ? 'Frames ready' : hasStoryboard ? 'Review & confirm' : 'Visual preview',
        status: getStoryboardStatus(),
        isLoading: isGeneratingStoryboard,
      },
      {
        id: 'production',
        label: 'Production',
        description: hasAllVideos ? 'Ready to export' : 'Generate videos',
        status: getProductionStatus(),
      },
    ];
  }, [currentStep, hasScript, hasStoryboard, hasFrames, hasAllVideos, isGeneratingScript, isGeneratingStoryboard]);

  const handleStepClick = (stepId: string) => {
    const step = steps.find(s => s.id === stepId);
    if (step && (step.status === 'completed' || step.status === 'current')) {
      onStepChange(stepId as ProjectStep);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white font-sans flex">
      {/* Sidebar */}
      <Sidebar
        projectTitle={projectTitle}
        projectPrompt={projectPrompt}
        steps={steps}
        onStepClick={handleStepClick}
        settings={settings}
        onBackToProjects={onBackToProjects}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-neutral-900/95 backdrop-blur border-b border-neutral-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 text-neutral-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Current step indicator */}
            <div className="flex items-center gap-2">
              {steps.map((step, i) => (
                <React.Fragment key={step.id}>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      step.status === 'current'
                        ? 'bg-red-500'
                        : step.status === 'completed'
                        ? 'bg-green-500'
                        : 'bg-neutral-600'
                    }`}
                  />
                  {i < steps.length - 1 && <div className="w-4 h-0.5 bg-neutral-700" />}
                </React.Fragment>
              ))}
            </div>

            <div className="w-10" /> {/* Spacer for centering */}
          </div>
        </header>

        {/* Desktop header */}
        <header className="hidden lg:block sticky top-0 z-30 bg-neutral-900/95 backdrop-blur border-b border-neutral-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-orange-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold">{projectTitle || 'Untitled Project'}</h1>
                <p className="text-xs text-neutral-500">
                  {settings.videoModel === 'seedance-1.5' ? 'Seedance 1.5' : 'Veo 3.1'} • {settings.aspectRatio}
                </p>
              </div>
            </div>

            {/* Step progress bar */}
            <div className="flex items-center gap-2">
              {steps.map((step, i) => (
                <React.Fragment key={step.id}>
                  <button
                    onClick={() => handleStepClick(step.id)}
                    disabled={step.status === 'locked' || step.status === 'pending'}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${
                      step.status === 'current'
                        ? 'bg-neutral-800 text-white border border-neutral-600'
                        : step.status === 'completed'
                        ? 'text-neutral-300 hover:text-white hover:bg-neutral-800/50'
                        : 'text-neutral-600 cursor-not-allowed'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                        step.status === 'current'
                          ? 'bg-gradient-to-br from-red-500 to-orange-500 text-white'
                          : step.status === 'completed'
                          ? 'bg-green-500 text-white'
                          : 'bg-neutral-700 text-neutral-500'
                      }`}
                    >
                      {step.isLoading ? (
                        <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : step.status === 'completed' ? (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="hidden xl:inline">{step.label}</span>
                  </button>
                  {i < steps.length - 1 && (
                    <div className={`w-8 h-0.5 ${step.status === 'completed' ? 'bg-green-500' : 'bg-neutral-700'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </header>

        {/* Content with transitions */}
        <main className="flex-1 overflow-y-auto">
          <StepTransition stepKey={currentStep}>
            <div className="p-4 lg:p-6 max-w-7xl mx-auto">
              {children}
            </div>
          </StepTransition>
        </main>
      </div>
    </div>
  );
}

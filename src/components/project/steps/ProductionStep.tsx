'use client';

import React from 'react';
import Production from '@/components/Production';
import { Script, AspectRatio, VideoModel, VoiceMode, SeedanceDuration } from '@/types';

interface ProductionStepProps {
  script: Script;
  frames: string[];
  generatedVideos: Record<number, string>;
  generatingVideoIds: number[];
  masterAudioUrl: string | null;
  backgroundMusicUrl: string | null;
  isGeneratingAudio: boolean;
  isGeneratingMusic: boolean;
  isGeneratingFullMovie: boolean;
  onGenerateVideo: (sceneId: number) => void;
  onGenerateFullMovie: () => void;
  onBackToStoryboard?: () => void;
  aspectRatio: AspectRatio;
  videoModel: VideoModel;
  voiceMode: VoiceMode;
  enableCuts?: boolean;
  seedanceAudio?: boolean;
  seedanceResolution?: string;
  seedanceDuration?: SeedanceDuration;
  originalPrompt?: string;
  characterRefs?: string;
}

export default function ProductionStep(props: ProductionStepProps) {
  // Pass through to existing Production component
  // The sidebar now shows project settings, so we don't need the overview section
  return <Production {...props} />;
}

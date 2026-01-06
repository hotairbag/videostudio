'use client';

import React, { useState } from 'react';
import { fileToBase64 } from '@/utils/imageUtils';
import { AspectRatio, VideoModel, SeedanceResolution, SeedanceDuration, SeedanceSceneCount, VoiceMode, ReferenceImages, ContentLanguage, SUPPORTED_LANGUAGES } from '@/types';

interface CharacterRefState {
  name: string;
  files: File[];
}

interface InputFormProps {
  onSubmit: (text: string, refVideo: string | undefined, refImages: ReferenceImages | undefined) => void;
  isLoading: boolean;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  enableCuts: boolean;
  onEnableCutsChange: (enabled: boolean) => void;
  videoModel: VideoModel;
  onVideoModelChange: (model: VideoModel) => void;
  seedanceAudio: boolean;
  onSeedanceAudioChange: (enabled: boolean) => void;
  seedanceResolution: SeedanceResolution;
  onSeedanceResolutionChange: (resolution: SeedanceResolution) => void;
  seedanceDuration: SeedanceDuration;
  onSeedanceDurationChange: (duration: SeedanceDuration) => void;
  seedanceSceneCount: SeedanceSceneCount;
  onSeedanceSceneCountChange: (count: SeedanceSceneCount) => void;
  voiceMode: VoiceMode;
  onVoiceModeChange: (mode: VoiceMode) => void;
  multiCharacter: boolean;
  onMultiCharacterChange: (enabled: boolean) => void;
  language: ContentLanguage;
  onLanguageChange: (language: ContentLanguage) => void;
  backgroundMusicEnabled: boolean;
  onBackgroundMusicEnabledChange: (enabled: boolean) => void;
}

// Cost estimates for Seedance via BytePlus (approximate, with 50% offline discount)
const SEEDANCE_COSTS = {
  basePer4s: 0.025, // Base cost per 4s at 720p without audio (offline pricing)
  audioMultiplier: 1.5, // +50% for audio generation
  resolution480p: 0.7, // 30% cheaper for 480p
  durationMultiplier: { 4: 1, 8: 2, 12: 3 } as Record<number, number>,
};

const InputForm: React.FC<InputFormProps> = ({
  onSubmit,
  isLoading,
  aspectRatio,
  onAspectRatioChange,
  enableCuts,
  onEnableCutsChange,
  videoModel,
  onVideoModelChange,
  seedanceAudio,
  onSeedanceAudioChange,
  seedanceResolution,
  onSeedanceResolutionChange,
  seedanceDuration,
  onSeedanceDurationChange,
  seedanceSceneCount,
  onSeedanceSceneCountChange,
  voiceMode,
  onVoiceModeChange,
  multiCharacter,
  onMultiCharacterChange,
  language,
  onLanguageChange,
  backgroundMusicEnabled,
  onBackgroundMusicEnabledChange,
}) => {
  const [prompt, setPrompt] = useState('');
  const [refVideo, setRefVideo] = useState<File | null>(null);
  const [styleRefs, setStyleRefs] = useState<File[]>([]);
  const [characterRefs, setCharacterRefs] = useState<CharacterRefState[]>([]);

  const handleStyleRefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setStyleRefs(prev => [...prev, ...Array.from(files)]);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const removeStyleRef = (index: number) => {
    setStyleRefs(prev => prev.filter((_, i) => i !== index));
  };

  const addCharacter = () => {
    const charLetter = String.fromCharCode(65 + characterRefs.length); // A, B, C, ...
    setCharacterRefs(prev => [...prev, { name: `Character ${charLetter}`, files: [] }]);
  };

  const removeCharacter = (index: number) => {
    setCharacterRefs(prev => prev.filter((_, i) => i !== index));
  };

  const updateCharacterName = (index: number, name: string) => {
    setCharacterRefs(prev => prev.map((char, i) =>
      i === index ? { ...char, name } : char
    ));
  };

  const handleCharacterRefChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    console.log('[Character Upload] index:', index, 'files:', files?.length);
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      console.log('[Character Upload] Adding files:', newFiles.map(f => f.name));
      setCharacterRefs(prev => {
        const updated = prev.map((char, i) =>
          i === index ? { ...char, files: [...char.files, ...newFiles] } : char
        );
        console.log('[Character Upload] Updated state:', updated.map(c => ({ name: c.name, fileCount: c.files.length })));
        return updated;
      });
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const removeCharacterImage = (charIndex: number, imageIndex: number) => {
    setCharacterRefs(prev => prev.map((char, i) =>
      i === charIndex ? { ...char, files: char.files.filter((_, j) => j !== imageIndex) } : char
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    let videoBase64: string | undefined;
    let refImages: ReferenceImages | undefined;

    if (refVideo) {
      try {
        videoBase64 = await fileToBase64(refVideo);
      } catch {
        alert("Error processing video file");
        return;
      }
    }

    // Build categorized reference images
    const hasStyleRefs = styleRefs.length > 0;
    const hasCharacterRefs = characterRefs.some(c => c.files.length > 0);

    if (hasStyleRefs || hasCharacterRefs) {
      try {
        const styleImages = await Promise.all(styleRefs.map(file => fileToBase64(file)));
        const characterImages = await Promise.all(
          characterRefs
            .filter(c => c.files.length > 0)
            .map(async (char) => ({
              name: char.name,
              images: await Promise.all(char.files.map(file => fileToBase64(file)))
            }))
        );

        refImages = {
          style: styleImages,
          characters: characterImages
        };
      } catch {
        alert("Error processing image files");
        return;
      }
    }

    onSubmit(prompt, videoBase64, refImages);
  };

  // Calculate estimated cost for Seedance (BytePlus offline pricing)
  const calculateSeedanceCost = () => {
    const clipCount = seedanceSceneCount;
    let costPerClip = SEEDANCE_COSTS.basePer4s * (SEEDANCE_COSTS.durationMultiplier[seedanceDuration] || 1);

    if (seedanceResolution === '480p') {
      costPerClip *= SEEDANCE_COSTS.resolution480p;
    }
    if (seedanceAudio) {
      costPerClip *= SEEDANCE_COSTS.audioMultiplier;
    }

    return (clipCount * costPerClip).toFixed(2);
  };

  const isSeedance = videoModel === 'seedance-1.5';

  return (
    <div className="max-w-3xl mx-auto p-6 bg-neutral-800 rounded-xl shadow-xl border border-neutral-700">
      <h2 className="text-2xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500">
        New Project
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Prompt Input */}
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

        {/* Reference Files */}
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

          {/* Style/Art References */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Style Reference (Optional)
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleStyleRefChange}
              className="block w-full text-sm text-neutral-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-neutral-700 file:text-white
                hover:file:bg-neutral-600"
            />
            <p className="text-xs text-neutral-500 mt-1">Art style, backgrounds, environments.</p>
            {styleRefs.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {styleRefs.map((file, idx) => (
                  <div key={idx} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Style ${idx + 1}`}
                      className="w-16 h-16 object-cover rounded border border-neutral-600"
                    />
                    <button
                      type="button"
                      onClick={() => removeStyleRef(idx)}
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

        {/* Character References Section */}
        <div className="border-t border-neutral-700 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-neutral-200">Character References (Optional)</h3>
            <button
              type="button"
              onClick={addCharacter}
              className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-500 text-white rounded-lg flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Character
            </button>
          </div>
          <p className="text-xs text-neutral-500 mb-4">Add reference images for each character to maintain consistency.</p>

          {characterRefs.length === 0 ? (
            <p className="text-sm text-neutral-500 italic">No character references added. Click "Add Character" to start.</p>
          ) : (
            <div className="space-y-4">
              {characterRefs.map((char, charIdx) => (
                <div key={charIdx} className="p-4 bg-neutral-800/50 rounded-lg border border-neutral-700">
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="text"
                      value={char.name}
                      onChange={(e) => updateCharacterName(charIdx, e.target.value)}
                      placeholder="Character name"
                      className="flex-1 px-3 py-1.5 bg-neutral-700 border border-neutral-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    {char.files.length > 0 && (
                      <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                        {char.files.length} image{char.files.length > 1 ? 's' : ''}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeCharacter(charIdx)}
                      className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleCharacterRefChange(charIdx, e)}
                    className="block w-full text-sm text-neutral-400
                      file:mr-4 file:py-1.5 file:px-3
                      file:rounded-full file:border-0
                      file:text-xs file:font-semibold
                      file:bg-neutral-700 file:text-white
                      hover:file:bg-neutral-600"
                  />
                  {char.files.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {char.files.map((file, imgIdx) => (
                        <div key={imgIdx} className="relative group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`${char.name} ref ${imgIdx + 1}`}
                            className="w-14 h-14 object-cover rounded border border-neutral-600"
                          />
                          <button
                            type="button"
                            onClick={() => removeCharacterImage(charIdx, imgIdx)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Video Settings Section */}
        <div className="border-t border-neutral-700 pt-6">
          <h3 className="text-lg font-semibold text-neutral-200 mb-4">Video Settings</h3>

          {/* Video Model Selection */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Video Generation Model
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onVideoModelChange('veo-3.1')}
                className={`p-4 rounded-lg border-2 transition-all text-left
                  ${videoModel === 'veo-3.1'
                    ? 'border-blue-500 bg-blue-900/30'
                    : 'border-neutral-600 bg-neutral-800 hover:border-neutral-500'
                  }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-bold text-white">Veo 3.1</span>
                  <span className="text-xs px-2 py-0.5 bg-blue-600 rounded-full">Google</span>
                </div>
                <p className="text-xs text-neutral-400">9 scenes × 8 seconds = 72s video</p>
                <p className="text-xs text-neutral-500 mt-1">Best for natural motion & live action</p>
              </button>
              <button
                type="button"
                onClick={() => onVideoModelChange('seedance-1.5')}
                className={`p-4 rounded-lg border-2 transition-all text-left
                  ${videoModel === 'seedance-1.5'
                    ? 'border-purple-500 bg-purple-900/30'
                    : 'border-neutral-600 bg-neutral-800 hover:border-neutral-500'
                  }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-bold text-white">Seedance 1.5</span>
                  <span className="text-xs px-2 py-0.5 bg-purple-600 rounded-full">ByteDance</span>
                </div>
                <p className="text-xs text-neutral-400">15 scenes × 4 seconds = 60s video</p>
                <p className="text-xs text-neutral-500 mt-1">Best for stylized & animated content</p>
              </button>
            </div>
          </div>

          {/* Seedance-specific options */}
          {isSeedance && (
            <div className="mb-5 p-4 bg-purple-900/20 border border-purple-800/50 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-purple-300">Seedance Settings</span>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Scene Count */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">Scenes</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onSeedanceSceneCountChange(9)}
                      className={`flex-1 py-2 px-3 text-sm rounded border transition-all
                        ${seedanceSceneCount === 9
                          ? 'border-purple-500 bg-purple-800/50 text-white'
                          : 'border-neutral-600 bg-neutral-800 text-neutral-400 hover:border-neutral-500'
                        }`}
                    >
                      9
                    </button>
                    <button
                      type="button"
                      onClick={() => onSeedanceSceneCountChange(15)}
                      className={`flex-1 py-2 px-3 text-sm rounded border transition-all
                        ${seedanceSceneCount === 15
                          ? 'border-purple-500 bg-purple-800/50 text-white'
                          : 'border-neutral-600 bg-neutral-800 text-neutral-400 hover:border-neutral-500'
                        }`}
                    >
                      15
                    </button>
                  </div>
                </div>

                {/* Resolution */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">Resolution</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onSeedanceResolutionChange('720p')}
                      className={`flex-1 py-2 px-3 text-sm rounded border transition-all
                        ${seedanceResolution === '720p'
                          ? 'border-purple-500 bg-purple-800/50 text-white'
                          : 'border-neutral-600 bg-neutral-800 text-neutral-400 hover:border-neutral-500'
                        }`}
                    >
                      720p
                    </button>
                    <button
                      type="button"
                      onClick={() => onSeedanceResolutionChange('480p')}
                      className={`flex-1 py-2 px-3 text-sm rounded border transition-all
                        ${seedanceResolution === '480p'
                          ? 'border-purple-500 bg-purple-800/50 text-white'
                          : 'border-neutral-600 bg-neutral-800 text-neutral-400 hover:border-neutral-500'
                        }`}
                    >
                      480p
                    </button>
                  </div>
                </div>

                {/* Clip Duration */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">Clip Duration</label>
                  <div className="flex gap-2">
                    {([4, 8, 12] as const).map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => onSeedanceDurationChange(dur)}
                        className={`flex-1 py-2 px-3 text-sm rounded border transition-all
                          ${seedanceDuration === dur
                            ? 'border-purple-500 bg-purple-800/50 text-white'
                            : 'border-neutral-600 bg-neutral-800 text-neutral-400 hover:border-neutral-500'
                          }`}
                      >
                        {dur}s
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sound Effects */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2">Sound FX</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onSeedanceAudioChange(false)}
                      className={`flex-1 py-2 px-3 text-sm rounded border transition-all
                        ${!seedanceAudio
                          ? 'border-purple-500 bg-purple-800/50 text-white'
                          : 'border-neutral-600 bg-neutral-800 text-neutral-400 hover:border-neutral-500'
                        }`}
                    >
                      Off
                    </button>
                    <button
                      type="button"
                      onClick={() => onSeedanceAudioChange(true)}
                      className={`flex-1 py-2 px-3 text-sm rounded border transition-all
                        ${seedanceAudio
                          ? 'border-purple-500 bg-purple-800/50 text-white'
                          : 'border-neutral-600 bg-neutral-800 text-neutral-400 hover:border-neutral-500'
                        }`}
                    >
                      On
                    </button>
                  </div>
                </div>
              </div>

              {/* Cost Estimate */}
              <div className="mt-4 pt-3 border-t border-purple-800/50">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-neutral-400">Estimated Cost ({seedanceSceneCount} clips)</span>
                  <span className="text-sm font-bold text-purple-300">~${calculateSeedanceCost()}</span>
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  {seedanceSceneCount} × {seedanceDuration}s = {seedanceSceneCount * seedanceDuration}s video • {seedanceResolution} • {seedanceAudio ? 'With SFX' : 'No SFX'}
                </p>
              </div>
            </div>
          )}

          {/* Aspect Ratio & Cuts in a row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Aspect Ratio Toggle */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Aspect Ratio
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onAspectRatioChange('16:9')}
                  className={`flex-1 py-3 px-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2
                    ${aspectRatio === '16:9'
                      ? 'border-red-500 bg-red-900/30 text-white'
                      : 'border-neutral-600 bg-neutral-800 text-neutral-400 hover:border-neutral-500'
                    }`}
                >
                  <div className={`w-6 h-[14px] border-2 rounded-sm ${aspectRatio === '16:9' ? 'border-red-400' : 'border-neutral-500'}`}></div>
                  <span className="font-semibold text-sm">16:9</span>
                </button>
                <button
                  type="button"
                  onClick={() => onAspectRatioChange('9:16')}
                  className={`flex-1 py-3 px-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2
                    ${aspectRatio === '9:16'
                      ? 'border-red-500 bg-red-900/30 text-white'
                      : 'border-neutral-600 bg-neutral-800 text-neutral-400 hover:border-neutral-500'
                    }`}
                >
                  <div className={`w-[14px] h-6 border-2 rounded-sm ${aspectRatio === '9:16' ? 'border-red-400' : 'border-neutral-500'}`}></div>
                  <span className="font-semibold text-sm">9:16</span>
                </button>
              </div>
            </div>

            {/* Camera Cuts Toggle */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Camera Cuts
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onEnableCutsChange(true)}
                  className={`flex-1 py-3 px-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2
                    ${enableCuts
                      ? 'border-red-500 bg-red-900/30 text-white'
                      : 'border-neutral-600 bg-neutral-800 text-neutral-400 hover:border-neutral-500'
                    }`}
                >
                  <svg className={`w-4 h-4 ${enableCuts ? 'text-red-400' : 'text-neutral-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span className="font-semibold text-sm">Multi</span>
                </button>
                <button
                  type="button"
                  onClick={() => onEnableCutsChange(false)}
                  className={`flex-1 py-3 px-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2
                    ${!enableCuts
                      ? 'border-red-500 bg-red-900/30 text-white'
                      : 'border-neutral-600 bg-neutral-800 text-neutral-400 hover:border-neutral-500'
                    }`}
                >
                  <svg className={`w-4 h-4 ${!enableCuts ? 'text-red-400' : 'text-neutral-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14V10z" />
                  </svg>
                  <span className="font-semibold text-sm">Single</span>
                </button>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {isSeedance ? '4s clips: 0-1 cuts each' : '8s clips: 2-3 cuts each'}
              </p>
            </div>
          </div>
        </div>

        {/* Voice & Audio Settings Section */}
        <div className="border-t border-neutral-700 pt-6">
          <h3 className="text-lg font-semibold text-neutral-200 mb-4">Voice, Language & Audio Settings</h3>

          {/* Language and Background Music Row */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            {/* Language Selector */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Content Language
              </label>
              <select
                value={language}
                onChange={(e) => onLanguageChange(e.target.value as ContentLanguage)}
                className="w-full py-2.5 px-3 bg-neutral-800 border border-neutral-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label} ({lang.native})
                  </option>
                ))}
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Dialogue and text will be in this language
              </p>
            </div>

            {/* Background Music Toggle */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Background Music
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onBackgroundMusicEnabledChange(true)}
                  className={`flex-1 py-2.5 px-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2
                    ${backgroundMusicEnabled
                      ? 'border-orange-500 bg-orange-900/30 text-white'
                      : 'border-neutral-600 bg-neutral-800 text-neutral-400 hover:border-neutral-500'
                    }`}
                >
                  <svg className={`w-4 h-4 ${backgroundMusicEnabled ? 'text-orange-400' : 'text-neutral-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  <span className="font-semibold text-sm">Suno AI</span>
                </button>
                <button
                  type="button"
                  onClick={() => onBackgroundMusicEnabledChange(false)}
                  className={`flex-1 py-2.5 px-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2
                    ${!backgroundMusicEnabled
                      ? 'border-orange-500 bg-orange-900/30 text-white'
                      : 'border-neutral-600 bg-neutral-800 text-neutral-400 hover:border-neutral-500'
                    }`}
                >
                  <svg className={`w-4 h-4 ${!backgroundMusicEnabled ? 'text-orange-400' : 'text-neutral-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                  <span className="font-semibold text-sm">None</span>
                </button>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {backgroundMusicEnabled ? 'AI-generated background music' : 'No background music'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Voice Mode Toggle */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Voice Mode
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onVoiceModeChange('tts')}
                  className={`flex-1 py-3 px-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-1
                    ${voiceMode === 'tts'
                      ? 'border-green-500 bg-green-900/30 text-white'
                      : 'border-neutral-600 bg-neutral-800 text-neutral-400 hover:border-neutral-500'
                    }`}
                >
                  <svg className={`w-5 h-5 ${voiceMode === 'tts' ? 'text-green-400' : 'text-neutral-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <span className="font-semibold text-sm">TTS Audio</span>
                </button>
                <button
                  type="button"
                  onClick={() => onVoiceModeChange('speech_in_video')}
                  className={`flex-1 py-3 px-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-1
                    ${voiceMode === 'speech_in_video'
                      ? 'border-green-500 bg-green-900/30 text-white'
                      : 'border-neutral-600 bg-neutral-800 text-neutral-400 hover:border-neutral-500'
                    }`}
                >
                  <svg className={`w-5 h-5 ${voiceMode === 'speech_in_video' ? 'text-green-400' : 'text-neutral-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="font-semibold text-sm">In Video</span>
                </button>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {voiceMode === 'tts' ? 'Separate TTS voiceover track' : 'Characters speak in generated video'}
              </p>
            </div>

            {/* Multi-Character Toggle */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Dialogue Mode
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onMultiCharacterChange(false)}
                  className={`flex-1 py-3 px-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-1
                    ${!multiCharacter
                      ? 'border-green-500 bg-green-900/30 text-white'
                      : 'border-neutral-600 bg-neutral-800 text-neutral-400 hover:border-neutral-500'
                    }`}
                >
                  <svg className={`w-5 h-5 ${!multiCharacter ? 'text-green-400' : 'text-neutral-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="font-semibold text-sm">Narrator</span>
                </button>
                <button
                  type="button"
                  onClick={() => onMultiCharacterChange(true)}
                  className={`flex-1 py-3 px-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-1
                    ${multiCharacter
                      ? 'border-green-500 bg-green-900/30 text-white'
                      : 'border-neutral-600 bg-neutral-800 text-neutral-400 hover:border-neutral-500'
                    }`}
                >
                  <svg className={`w-5 h-5 ${multiCharacter ? 'text-green-400' : 'text-neutral-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="font-semibold text-sm">Characters</span>
                </button>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {multiCharacter ? 'Multiple characters with unique voices' : 'Single AI-selected narrator voice'}
              </p>
            </div>
          </div>

          {/* Voice Mode Info Box */}
          <div className="mt-4 p-3 bg-green-900/20 border border-green-800/50 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-xs text-neutral-300">
                {voiceMode === 'tts' && !multiCharacter && (
                  <>AI will select the best narrator voice from 30 Gemini voices based on your content.</>
                )}
                {voiceMode === 'tts' && multiCharacter && (
                  <>AI will identify characters and assign unique voices for dialogue. Each character gets a distinct voice.</>
                )}
                {voiceMode === 'speech_in_video' && !multiCharacter && (
                  <>The narrator will speak directly in the generated video with lip-synced audio.</>
                )}
                {voiceMode === 'speech_in_video' && multiCharacter && (
                  <>Characters will speak their dialogue directly in the video with consistent voice profiles.</>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-3 px-6 rounded-lg font-bold text-lg transition-all transform hover:scale-[1.02]
            ${isLoading
              ? 'bg-neutral-600 cursor-not-allowed opacity-50'
              : isSeedance
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-900/20'
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
            <>
              Generate Storyboard
              {isSeedance && <span className="text-sm font-normal ml-2 opacity-80">({seedanceSceneCount} panels)</span>}
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default InputForm;

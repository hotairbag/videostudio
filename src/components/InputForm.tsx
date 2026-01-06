'use client';

import React, { useState, useRef, useEffect } from 'react';
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

// Cost estimates for Seedance
const SEEDANCE_COSTS = {
  basePer4s: 0.05,
  audioMultiplier: 2,
  resolution480p: 0.45,
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
  const [showSettings, setShowSettings] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setShowModelPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStyleRefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setStyleRefs(prev => [...prev, ...Array.from(files)]);
    }
    e.target.value = '';
  };

  const removeStyleRef = (index: number) => {
    setStyleRefs(prev => prev.filter((_, i) => i !== index));
  };

  const addCharacter = () => {
    const charLetter = String.fromCharCode(65 + characterRefs.length);
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
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      setCharacterRefs(prev => prev.map((char, i) =>
        i === index ? { ...char, files: [...char.files, ...newFiles] } : char
      ));
    }
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
  const totalDuration = isSeedance ? seedanceSceneCount * seedanceDuration : 72;

  const styleInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Main Prompt Input */}
        <div className="bg-neutral-800/50 rounded-2xl border border-neutral-700 overflow-hidden">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full bg-transparent px-4 pt-4 pb-2 text-white text-lg resize-none focus:outline-none placeholder-neutral-500"
            placeholder="Describe your video story..."
            rows={3}
            required={!refVideo}
          />

          {/* Attached files preview */}
          {(styleRefs.length > 0 || characterRefs.some(c => c.files.length > 0) || refVideo) && (
            <div className="px-4 pb-2 flex flex-wrap gap-2">
              {refVideo && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-900/30 border border-blue-700/50 rounded-full text-sm">
                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14V10z" />
                  </svg>
                  <span className="text-blue-300">{refVideo.name}</span>
                  <button type="button" onClick={() => setRefVideo(null)} className="text-blue-400 hover:text-blue-300">×</button>
                </div>
              )}
              {styleRefs.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-purple-900/30 border border-purple-700/50 rounded-full text-sm">
                  <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-purple-300 truncate max-w-[100px]">{file.name}</span>
                  <button type="button" onClick={() => removeStyleRef(idx)} className="text-purple-400 hover:text-purple-300">×</button>
                </div>
              ))}
            </div>
          )}

          {/* Bottom toolbar */}
          <div className="px-3 py-2 border-t border-neutral-700/50 flex items-center gap-2 flex-wrap">
            {/* Hidden file inputs */}
            <input ref={styleInputRef} type="file" accept="image/*" multiple onChange={handleStyleRefChange} className="hidden" />
            <input ref={videoInputRef} type="file" accept="video/*" onChange={(e) => setRefVideo(e.target.files?.[0] || null)} className="hidden" />

            {/* Add Style button */}
            <button
              type="button"
              onClick={() => styleInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-400 hover:text-white hover:bg-neutral-700/50 rounded-full transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Style
            </button>

            {/* Add Character button */}
            <button
              type="button"
              onClick={addCharacter}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-400 hover:text-white hover:bg-neutral-700/50 rounded-full transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Character
            </button>

            {/* Add Video button */}
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-400 hover:text-white hover:bg-neutral-700/50 rounded-full transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Video Ref
            </button>

            <div className="flex-1" />

            {/* Model selector */}
            <div ref={modelRef} className="relative">
              <button
                type="button"
                onClick={() => setShowModelPicker(!showModelPicker)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-neutral-700/50 hover:bg-neutral-700 rounded-full transition-colors"
              >
                <span className={`w-2 h-2 rounded-full ${isSeedance ? 'bg-purple-500' : 'bg-blue-500'}`} />
                <span className="text-neutral-200">{isSeedance ? 'Seedance' : 'Veo 3.1'}</span>
                <svg className="w-3 h-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showModelPicker && (
                <div className="absolute bottom-full mb-2 right-0 w-56 bg-neutral-800 border border-neutral-700 rounded-xl shadow-xl overflow-hidden z-50">
                  <button
                    type="button"
                    onClick={() => { onVideoModelChange('seedance-1.5'); setShowModelPicker(false); }}
                    className={`w-full px-4 py-3 text-left hover:bg-neutral-700/50 transition-colors ${isSeedance ? 'bg-purple-900/30' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">Seedance 1.5</span>
                      {isSeedance && <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5">Best for stylized & animated</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => { onVideoModelChange('veo-3.1'); setShowModelPicker(false); }}
                    className={`w-full px-4 py-3 text-left hover:bg-neutral-700/50 transition-colors ${!isSeedance ? 'bg-blue-900/30' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">Veo 3.1</span>
                      {!isSeedance && <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5">Best for natural & realistic</p>
                  </button>
                </div>
              )}
            </div>

            {/* Settings button */}
            <div ref={settingsRef} className="relative">
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-neutral-700/50 hover:bg-neutral-700 rounded-full transition-colors"
              >
                <span className="text-neutral-200">{seedanceResolution}</span>
                <span className="text-neutral-500">|</span>
                <span className="text-neutral-200">{aspectRatio}</span>
                <span className="text-neutral-500">|</span>
                <span className="text-neutral-200">{isSeedance ? `${seedanceDuration}s` : '8s'}</span>
                <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </button>

              {/* Settings Popover */}
              {showSettings && (
                <div className="absolute bottom-full mb-2 right-0 w-80 bg-neutral-800 border border-neutral-700 rounded-xl shadow-xl p-4 z-50">
                  <h4 className="text-sm font-semibold text-white mb-3">Settings</h4>

                  {/* Resolution */}
                  <div className="mb-4">
                    <label className="text-xs text-neutral-400 mb-2 block">Resolution</label>
                    <div className="flex gap-2">
                      {(['720p', '480p'] as const).map((res) => (
                        <button
                          key={res}
                          type="button"
                          onClick={() => onSeedanceResolutionChange(res)}
                          className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                            seedanceResolution === res
                              ? 'border-purple-500 bg-purple-900/30 text-white'
                              : 'border-neutral-600 text-neutral-400 hover:border-neutral-500'
                          }`}
                        >
                          {res}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Aspect Ratio */}
                  <div className="mb-4">
                    <label className="text-xs text-neutral-400 mb-2 block">Aspect Ratio</label>
                    <div className="flex gap-2">
                      {(['16:9', '9:16'] as const).map((ratio) => (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => onAspectRatioChange(ratio)}
                          className={`flex-1 py-2 text-sm rounded-lg border transition-all flex items-center justify-center gap-2 ${
                            aspectRatio === ratio
                              ? 'border-purple-500 bg-purple-900/30 text-white'
                              : 'border-neutral-600 text-neutral-400 hover:border-neutral-500'
                          }`}
                        >
                          <div className={`${ratio === '16:9' ? 'w-5 h-3' : 'w-3 h-5'} border-2 rounded-sm ${
                            aspectRatio === ratio ? 'border-purple-400' : 'border-neutral-500'
                          }`} />
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duration (Seedance only) */}
                  {isSeedance && (
                    <div className="mb-4">
                      <label className="text-xs text-neutral-400 mb-2 block">Clip Duration</label>
                      <div className="flex gap-2">
                        {([4, 8, 12] as const).map((dur) => (
                          <button
                            key={dur}
                            type="button"
                            onClick={() => onSeedanceDurationChange(dur)}
                            className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                              seedanceDuration === dur
                                ? 'border-purple-500 bg-purple-900/30 text-white'
                                : 'border-neutral-600 text-neutral-400 hover:border-neutral-500'
                            }`}
                          >
                            {dur}s
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Scene Count (Seedance only) */}
                  {isSeedance && (
                    <div className="mb-4">
                      <label className="text-xs text-neutral-400 mb-2 block">Scenes</label>
                      <div className="flex gap-2">
                        {([9, 15] as const).map((count) => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => onSeedanceSceneCountChange(count)}
                            className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                              seedanceSceneCount === count
                                ? 'border-purple-500 bg-purple-900/30 text-white'
                                : 'border-neutral-600 text-neutral-400 hover:border-neutral-500'
                            }`}
                          >
                            {count} scenes
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sound FX (Seedance only) */}
                  {isSeedance && (
                    <div className="mb-4">
                      <label className="text-xs text-neutral-400 mb-2 block">Sound FX</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onSeedanceAudioChange(false)}
                          className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                            !seedanceAudio
                              ? 'border-purple-500 bg-purple-900/30 text-white'
                              : 'border-neutral-600 text-neutral-400 hover:border-neutral-500'
                          }`}
                        >
                          Off
                        </button>
                        <button
                          type="button"
                          onClick={() => onSeedanceAudioChange(true)}
                          className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                            seedanceAudio
                              ? 'border-purple-500 bg-purple-900/30 text-white'
                              : 'border-neutral-600 text-neutral-400 hover:border-neutral-500'
                          }`}
                        >
                          On
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Camera Cuts */}
                  <div className="mb-4">
                    <label className="text-xs text-neutral-400 mb-2 block">Camera Cuts</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onEnableCutsChange(true)}
                        className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                          enableCuts
                            ? 'border-purple-500 bg-purple-900/30 text-white'
                            : 'border-neutral-600 text-neutral-400 hover:border-neutral-500'
                        }`}
                      >
                        Multi
                      </button>
                      <button
                        type="button"
                        onClick={() => onEnableCutsChange(false)}
                        className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                          !enableCuts
                            ? 'border-purple-500 bg-purple-900/30 text-white'
                            : 'border-neutral-600 text-neutral-400 hover:border-neutral-500'
                        }`}
                      >
                        Single
                      </button>
                    </div>
                  </div>

                  {/* Voice Mode */}
                  <div className="mb-4">
                    <label className="text-xs text-neutral-400 mb-2 block">Voice Mode</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onVoiceModeChange('speech_in_video')}
                        className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                          voiceMode === 'speech_in_video'
                            ? 'border-green-500 bg-green-900/30 text-white'
                            : 'border-neutral-600 text-neutral-400 hover:border-neutral-500'
                        }`}
                      >
                        In Video
                      </button>
                      <button
                        type="button"
                        onClick={() => onVoiceModeChange('tts')}
                        className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                          voiceMode === 'tts'
                            ? 'border-green-500 bg-green-900/30 text-white'
                            : 'border-neutral-600 text-neutral-400 hover:border-neutral-500'
                        }`}
                      >
                        TTS Audio
                      </button>
                    </div>
                  </div>

                  {/* Dialogue Mode */}
                  <div className="mb-4">
                    <label className="text-xs text-neutral-400 mb-2 block">Dialogue</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onMultiCharacterChange(false)}
                        className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                          !multiCharacter
                            ? 'border-green-500 bg-green-900/30 text-white'
                            : 'border-neutral-600 text-neutral-400 hover:border-neutral-500'
                        }`}
                      >
                        Narrator
                      </button>
                      <button
                        type="button"
                        onClick={() => onMultiCharacterChange(true)}
                        className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                          multiCharacter
                            ? 'border-green-500 bg-green-900/30 text-white'
                            : 'border-neutral-600 text-neutral-400 hover:border-neutral-500'
                        }`}
                      >
                        Characters
                      </button>
                    </div>
                  </div>

                  {/* Language */}
                  <div className="mb-4">
                    <label className="text-xs text-neutral-400 mb-2 block">Language</label>
                    <select
                      value={language}
                      onChange={(e) => onLanguageChange(e.target.value as ContentLanguage)}
                      className="w-full py-2 px-3 bg-neutral-700 border border-neutral-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.label} ({lang.native})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Background Music */}
                  <div className="mb-4">
                    <label className="text-xs text-neutral-400 mb-2 block">Background Music</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onBackgroundMusicEnabledChange(true)}
                        className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                          backgroundMusicEnabled
                            ? 'border-orange-500 bg-orange-900/30 text-white'
                            : 'border-neutral-600 text-neutral-400 hover:border-neutral-500'
                        }`}
                      >
                        Suno AI
                      </button>
                      <button
                        type="button"
                        onClick={() => onBackgroundMusicEnabledChange(false)}
                        className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                          !backgroundMusicEnabled
                            ? 'border-orange-500 bg-orange-900/30 text-white'
                            : 'border-neutral-600 text-neutral-400 hover:border-neutral-500'
                        }`}
                      >
                        None
                      </button>
                    </div>
                  </div>

                  {/* Cost estimate for Seedance */}
                  {isSeedance && (
                    <div className="pt-3 border-t border-neutral-700">
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-400">{seedanceSceneCount} × {seedanceDuration}s = {totalDuration}s</span>
                        <span className="text-purple-400 font-medium">~${calculateSeedanceCost()}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Character References (if any added) */}
        {characterRefs.length > 0 && (
          <div className="space-y-3">
            {characterRefs.map((char, charIdx) => (
              <div key={charIdx} className="bg-neutral-800/50 rounded-xl border border-neutral-700 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="text"
                    value={char.name}
                    onChange={(e) => updateCharacterName(charIdx, e.target.value)}
                    placeholder="Character name"
                    className="flex-1 px-3 py-1.5 bg-neutral-700/50 border border-neutral-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleCharacterRefChange(charIdx, e)}
                    className="hidden"
                    id={`char-input-${charIdx}`}
                  />
                  <label
                    htmlFor={`char-input-${charIdx}`}
                    className="px-3 py-1.5 text-sm bg-neutral-700 hover:bg-neutral-600 rounded-lg cursor-pointer transition-colors text-neutral-300"
                  >
                    + Add Images
                  </label>
                  <button
                    type="button"
                    onClick={() => removeCharacter(charIdx)}
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {char.files.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {char.files.map((file, imgIdx) => (
                      <div key={imgIdx} className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`${char.name} ref ${imgIdx + 1}`}
                          className="w-16 h-16 object-cover rounded-lg border border-neutral-600"
                        />
                        <button
                          type="button"
                          onClick={() => removeCharacterImage(charIdx, imgIdx)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
            isLoading
              ? 'bg-neutral-700 cursor-not-allowed opacity-50'
              : isSeedance
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-900/30'
                : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-900/30'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Generate Storyboard
              <span className="text-sm font-normal opacity-80">
                ({isSeedance ? seedanceSceneCount : 9} scenes • {totalDuration}s)
              </span>
            </span>
          )}
        </button>
      </form>
    </div>
  );
};

export default InputForm;

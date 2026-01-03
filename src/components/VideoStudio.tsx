'use client';

import React, { useState, useEffect, useRef } from 'react';
import InputForm from '@/components/InputForm';
import Storyboard from '@/components/Storyboard';
import Production from '@/components/Production';
import { generateScript, generateStoryboard, generateStoryboard2, generateVideoForScene, generateMasterAudio, setApiKey, getApiKey } from '@/services/geminiService';
import { generateBackgroundMusic } from '@/services/musicService';
import { sliceGridImage, sliceGrid3x2Image } from '@/utils/imageUtils';
import { AppState, AspectRatio, VideoModel, SeedanceResolution, VoiceMode, SeedanceSceneCount, ReferenceImages } from '@/types';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function VideoStudio() {
  const [apiKeyReady, setApiKeyReady] = useState(false);
  const [manualKey, setManualKey] = useState('');

  const [state, setState] = useState<AppState>({
    step: 'input',
    script: null,
    storyboardUrl: null,
    storyboardUrl2: null,
    frames: [],
    generatedVideos: {},
    masterAudioUrl: null,
    backgroundMusicUrl: null,
    isGeneratingScript: false,
    isGeneratingStoryboard: false,
    isConfirming: false,
    isGeneratingAudio: false,
    isGeneratingMusic: false,
    isGeneratingFullMovie: false,
    generatingVideoIds: [],
    aspectRatio: '16:9',
    enableCuts: true,
    videoModel: 'veo-3.1',
    seedanceAudio: false,
    seedanceResolution: '720p',
    voiceMode: 'tts',
    multiCharacter: false,
  });

  const [seedanceSceneCount, setSeedanceSceneCount] = useState<SeedanceSceneCount>(15);

  // Keep ref images for storyboard2 generation (Seedance mode)
  const refImagesRef = useRef<ReferenceImages | undefined>(undefined);

  // Helper to flatten ReferenceImages to array for storyboard generation
  const flattenRefImages = (refs?: ReferenceImages): string[] | undefined => {
    if (!refs) return undefined;
    const allImages: string[] = [...refs.style];
    for (const char of refs.characters) {
      allImages.push(...char.images);
    }
    return allImages.length > 0 ? allImages : undefined;
  };

  useEffect(() => {
    const checkApiKey = async () => {
      try {
        // Check if API key is already available from env
        const existingKey = getApiKey();
        if (existingKey) {
          setApiKeyReady(true);
          return;
        }

        // Check Google AI Studio bridge
        if (window.aistudio && window.aistudio.hasSelectedApiKey) {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          if (hasKey) {
            setApiKeyReady(true);
          }
        }
      } catch (e) {
        console.warn("API key check failed", e);
      }
    };
    checkApiKey();
  }, []);

  const handleSelectKey = async () => {
    try {
      if (window.aistudio && window.aistudio.openSelectKey) {
        await window.aistudio.openSelectKey();
        setApiKeyReady(true);
      }
    } catch (e) {
      console.error("AI Studio bridge failed", e);
      alert("Could not open key selector. Please enter key manually below.");
    }
  };

  const handleManualKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualKey.trim().length > 10) {
      setApiKey(manualKey.trim());
      setApiKeyReady(true);
    }
  };

  const handleAspectRatioChange = (ratio: AspectRatio) => {
    setState(prev => ({ ...prev, aspectRatio: ratio }));
  };

  const handleEnableCutsChange = (enabled: boolean) => {
    setState(prev => ({ ...prev, enableCuts: enabled }));
  };

  const handleVideoModelChange = (model: VideoModel) => {
    setState(prev => ({ ...prev, videoModel: model }));
  };

  const handleSeedanceAudioChange = (enabled: boolean) => {
    setState(prev => ({ ...prev, seedanceAudio: enabled }));
  };

  const handleSeedanceResolutionChange = (resolution: SeedanceResolution) => {
    setState(prev => ({ ...prev, seedanceResolution: resolution }));
  };

  const handleSeedanceSceneCountChange = (count: SeedanceSceneCount) => {
    setSeedanceSceneCount(count);
  };

  const handleVoiceModeChange = (mode: VoiceMode) => {
    setState(prev => ({ ...prev, voiceMode: mode }));
  };

  const handleMultiCharacterChange = (enabled: boolean) => {
    setState(prev => ({ ...prev, multiCharacter: enabled }));
  };

  const handleInitialGenerate = async (prompt: string, refVideo?: string, refImages?: ReferenceImages) => {
    // Store ref images for potential storyboard2 generation
    refImagesRef.current = refImages;

    // Flatten for functions that don't support categorized refs yet
    const flatImages = flattenRefImages(refImages);
    // Extract character names from references to hint the script generator
    const characterNames = refImages?.characters.map(c => c.name) || [];

    setState(prev => ({ ...prev, isGeneratingScript: true }));
    try {
      const script = await generateScript(
        prompt,
        refVideo,
        flatImages,
        state.enableCuts,
        state.videoModel,
        seedanceSceneCount,
        state.multiCharacter,
        state.voiceMode,
        characterNames
      );
      setState(prev => ({ ...prev, script, isGeneratingScript: false, isGeneratingStoryboard: true }));

      // Generate first storyboard (3x3 grid - 9 scenes)
      // For Seedance with 15 scenes, pass totalScenes so the model knows the story continues
      const totalScenes = state.videoModel === 'seedance-1.5' ? seedanceSceneCount : 9;
      const storyboardUrl = await generateStoryboard(script, flatImages, state.aspectRatio, totalScenes);

      if (state.videoModel === 'seedance-1.5' && seedanceSceneCount === 15) {
        // For Seedance with 15 scenes: also generate second storyboard (3x2 grid - 6 more scenes)
        // Slice first storyboard into individual panels for style reference
        const panels = await sliceGridImage(storyboardUrl, state.aspectRatio);
        const stylePanels = panels.slice(0, 3);
        const storyboardUrl2 = await generateStoryboard2(script, stylePanels, flatImages, state.aspectRatio);

        setState(prev => ({
          ...prev,
          storyboardUrl,
          storyboardUrl2,
          isGeneratingStoryboard: false,
          step: 'storyboard'
        }));
      } else {
        // For Veo or Seedance with 9 scenes: only single grid
        setState(prev => ({
          ...prev,
          storyboardUrl,
          storyboardUrl2: null,
          isGeneratingStoryboard: false,
          step: 'storyboard'
        }));
      }
    } catch (error) {
      console.error(error);
      alert("Generation failed. See console for details.");
      setState(prev => ({ ...prev, isGeneratingScript: false, isGeneratingStoryboard: false }));
    }
  };

  const handleRegenerateStoryboard = async () => {
    if (!state.script) return;
    setState(prev => ({ ...prev, isGeneratingStoryboard: true }));
    try {
      const totalScenes = state.videoModel === 'seedance-1.5' ? seedanceSceneCount : 9;
      const storyboardUrl = await generateStoryboard(state.script, flattenRefImages(refImagesRef.current), state.aspectRatio, totalScenes);

      if (state.videoModel === 'seedance-1.5' && seedanceSceneCount === 15) {
        // Regenerate second grid using new first grid as reference
        // Slice first storyboard into individual panels for style reference
        const panels = await sliceGridImage(storyboardUrl, state.aspectRatio);
        const stylePanels = panels.slice(0, 3);
        const storyboardUrl2 = await generateStoryboard2(state.script, stylePanels, flattenRefImages(refImagesRef.current), state.aspectRatio);
        setState(prev => ({ ...prev, storyboardUrl, storyboardUrl2, isGeneratingStoryboard: false }));
      } else {
        setState(prev => ({ ...prev, storyboardUrl, isGeneratingStoryboard: false }));
      }
    } catch (error) {
      console.error(error);
      setState(prev => ({ ...prev, isGeneratingStoryboard: false }));
    }
  };

  const handleConfirmStoryboard = async () => {
    if (!state.storyboardUrl) return;
    setState(prev => ({ ...prev, isConfirming: true }));
    try {
      // Slice first grid (3x3 = 9 frames)
      const frames1 = await sliceGridImage(state.storyboardUrl, state.aspectRatio);

      if (state.videoModel === 'seedance-1.5' && seedanceSceneCount === 15 && state.storyboardUrl2) {
        // Slice second grid (3x2 = 6 frames) for Seedance with 15 scenes
        const frames2 = await sliceGrid3x2Image(state.storyboardUrl2, state.aspectRatio);
        const allFrames = [...frames1, ...frames2];
        setState(prev => ({ ...prev, frames: allFrames, step: 'production', isConfirming: false }));
      } else {
        setState(prev => ({ ...prev, frames: frames1, step: 'production', isConfirming: false }));
      }
    } catch (error) {
      console.error("Failed to slice grid:", error);
      alert("Could not process storyboard grid.");
      setState(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleGenerateVideo = async (sceneId: number) => {
    if (!state.script) return;

    const sceneIndex = state.script.scenes.findIndex(s => s.id === sceneId);
    if (sceneIndex === -1) return;

    const scene = state.script.scenes[sceneIndex];
    const startFrame = state.frames[sceneIndex];

    setState(prev => ({
      ...prev,
      generatingVideoIds: [...prev.generatingVideoIds, sceneId]
    }));

    try {
      const videoUrl = await generateVideoForScene(
        scene,
        startFrame,
        state.aspectRatio,
        state.videoModel,
        state.seedanceResolution,
        state.seedanceAudio,
        state.voiceMode,
        state.script?.characters
      );
      setState(prev => ({
        ...prev,
        generatedVideos: { ...prev.generatedVideos, [sceneId]: videoUrl },
        generatingVideoIds: prev.generatingVideoIds.filter(id => id !== sceneId)
      }));
    } catch (error) {
      console.error(error);
      alert(`Failed to generate video for scene ${sceneId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setState(prev => ({
        ...prev,
        generatingVideoIds: prev.generatingVideoIds.filter(id => id !== sceneId)
      }));
    }
  };

  const handleGenerateAudio = async () => {
    if (!state.script) return;

    // Skip TTS generation if using speech_in_video mode (dialogue is in the video)
    if (state.voiceMode === 'speech_in_video') {
      console.log('[Audio] Skipping TTS - using speech_in_video mode');
      return;
    }

    setState(prev => ({ ...prev, isGeneratingAudio: true }));
    try {
      const audioDataUrl = await generateMasterAudio(state.script, state.multiCharacter);

      // Upload to R2 for persistent storage (blob URLs expire)
      let finalAudioUrl = audioDataUrl;
      if (audioDataUrl) {
        try {
          const uploadRes = await fetch('/api/upload/audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: audioDataUrl, type: 'voiceover' }),
          });
          if (uploadRes.ok) {
            const { url } = await uploadRes.json();
            finalAudioUrl = url;
          }
        } catch (uploadErr) {
          console.warn('Failed to upload audio to R2, using data URL:', uploadErr);
        }
      }

      setState(prev => ({ ...prev, masterAudioUrl: finalAudioUrl, isGeneratingAudio: false }));
    } catch (error) {
      console.error(error);
      alert("Audio generation failed");
      setState(prev => ({ ...prev, isGeneratingAudio: false }));
    }
  };

  const handleGenerateMusic = async () => {
    if (!state.script) return;
    setState(prev => ({ ...prev, isGeneratingMusic: true }));
    try {
      const musicUrl = await generateBackgroundMusic(state.script.style, state.script.title);
      setState(prev => ({ ...prev, backgroundMusicUrl: musicUrl, isGeneratingMusic: false }));
    } catch (error) {
      console.error(error);
      alert("Background music generation failed (check console).");
      setState(prev => ({ ...prev, isGeneratingMusic: false }));
    }
  };

  const handleGenerateFullMovie = async () => {
    if (!state.script) return;
    setState(prev => ({ ...prev, isGeneratingFullMovie: true }));

    try {
      // Only generate TTS if using tts mode (not speech_in_video)
      let audioPromise = Promise.resolve(state.masterAudioUrl);
      if (!state.masterAudioUrl && state.voiceMode !== 'speech_in_video') {
        setState(prev => ({ ...prev, isGeneratingAudio: true }));
        audioPromise = generateMasterAudio(state.script!, state.multiCharacter)
          .then(async (audioDataUrl) => {
            // Upload to R2 for persistent storage (blob URLs expire)
            let finalAudioUrl = audioDataUrl;
            if (audioDataUrl) {
              try {
                const uploadRes = await fetch('/api/upload/audio', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ audio: audioDataUrl, type: 'voiceover' }),
                });
                if (uploadRes.ok) {
                  const { url } = await uploadRes.json();
                  finalAudioUrl = url;
                }
              } catch (uploadErr) {
                console.warn('Failed to upload audio to R2, using data URL:', uploadErr);
              }
            }
            setState(prev => ({ ...prev, masterAudioUrl: finalAudioUrl, isGeneratingAudio: false }));
            return finalAudioUrl;
          })
          .catch(err => {
            console.error("Audio gen failed", err);
            setState(prev => ({ ...prev, isGeneratingAudio: false }));
            return null;
          });
      }

      let musicPromise = Promise.resolve(state.backgroundMusicUrl);
      if (!state.backgroundMusicUrl) {
        setState(prev => ({ ...prev, isGeneratingMusic: true }));
        // Create a theme summary from scene descriptions for better music matching
        const theme = state.script!.scenes
          .slice(0, 3)
          .map(s => s.visualDescription)
          .join(' ')
          .substring(0, 200);
        musicPromise = generateBackgroundMusic(state.script!.style, state.script!.title, theme)
          .then(url => {
            setState(prev => ({ ...prev, backgroundMusicUrl: url, isGeneratingMusic: false }));
            return url;
          })
          .catch(err => {
            console.warn("Music gen failed", err);
            setState(prev => ({ ...prev, isGeneratingMusic: false }));
            return null;
          });
      }

      const scenesToGenerate = state.script.scenes.filter(s => !state.generatedVideos[s.id]);

      if (scenesToGenerate.length > 0) {
        setState(prev => ({
          ...prev,
          generatingVideoIds: [...prev.generatingVideoIds, ...scenesToGenerate.map(s => s.id)]
        }));

        const BATCH_SIZE = 3;
        for (let i = 0; i < scenesToGenerate.length; i += BATCH_SIZE) {
          const batch = scenesToGenerate.slice(i, i + BATCH_SIZE);

          await Promise.all(batch.map(async (scene) => {
            const index = state.script!.scenes.findIndex(s => s.id === scene.id);
            const startFrame = state.frames[index];

            try {
              const videoUrl = await generateVideoForScene(
                scene,
                startFrame,
                state.aspectRatio,
                state.videoModel,
                state.seedanceResolution,
                state.seedanceAudio,
                state.voiceMode,
                state.script?.characters
              );
              setState(prev => ({
                ...prev,
                generatedVideos: { ...prev.generatedVideos, [scene.id]: videoUrl },
                generatingVideoIds: prev.generatingVideoIds.filter(id => id !== scene.id)
              }));
            } catch (err) {
              console.error(`Failed to generate video for scene ${scene.id}`, err);
              setState(prev => ({
                ...prev,
                generatingVideoIds: prev.generatingVideoIds.filter(id => id !== scene.id)
              }));
            }
          }));
        }
      }

      await Promise.all([audioPromise, musicPromise]);

    } catch (error) {
      console.error("Full movie generation error", error);
      alert("An error occurred during full movie generation.");
    } finally {
      setState(prev => ({ ...prev, isGeneratingFullMovie: false }));
    }
  };

  if (!apiKeyReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-white">
        <div className="text-center p-8 bg-neutral-800 rounded-xl shadow-2xl border border-neutral-700 max-w-md w-full">
          <h1 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500">
            GenDirector AI
          </h1>
          <p className="mb-6 text-neutral-400">
            To use Veo video generation and Gemini Pro models, please select a paid Google Cloud Project API key.
          </p>

          <button
            onClick={handleSelectKey}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-all mb-6"
          >
            Select API Key via Google
          </button>

          <div className="relative border-t border-neutral-700 pt-6">
            <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-neutral-800 px-2 text-xs text-neutral-500">OR</span>
            <form onSubmit={handleManualKeySubmit} className="space-y-3">
              <input
                type="password"
                placeholder="Enter API Key Manually"
                value={manualKey}
                onChange={(e) => setManualKey(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-600 rounded px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={manualKey.length < 10}
                className="w-full px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded text-sm font-semibold disabled:opacity-50"
              >
                Use Manual Key
              </button>
            </form>
          </div>

          <p className="mt-4 text-xs text-neutral-600">
            Visit <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">Billing Documentation</a> for more info.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white font-sans selection:bg-red-500 selection:text-white">
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.reload()}>
            <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-orange-600 rounded-lg"></div>
            <h1 className="text-xl font-bold tracking-tight">GenDirector <span className="text-neutral-500 font-normal">AI Studio</span></h1>
          </div>
          <div className="text-xs text-neutral-500 font-mono hidden sm:block">
            Gemini 3 Pro • {state.videoModel === 'seedance-1.5' ? 'Seedance 1.5' : 'Veo 3.1'} • Gemini 2.5 TTS
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {state.step === 'input' && (
          <InputForm
            onSubmit={handleInitialGenerate}
            isLoading={state.isGeneratingScript || state.isGeneratingStoryboard}
            aspectRatio={state.aspectRatio}
            onAspectRatioChange={handleAspectRatioChange}
            enableCuts={state.enableCuts}
            onEnableCutsChange={handleEnableCutsChange}
            videoModel={state.videoModel}
            onVideoModelChange={handleVideoModelChange}
            seedanceAudio={state.seedanceAudio}
            onSeedanceAudioChange={handleSeedanceAudioChange}
            seedanceResolution={state.seedanceResolution}
            onSeedanceResolutionChange={handleSeedanceResolutionChange}
            seedanceSceneCount={seedanceSceneCount}
            onSeedanceSceneCountChange={handleSeedanceSceneCountChange}
            voiceMode={state.voiceMode}
            onVoiceModeChange={handleVoiceModeChange}
            multiCharacter={state.multiCharacter}
            onMultiCharacterChange={handleMultiCharacterChange}
          />
        )}

        {state.step === 'storyboard' && state.storyboardUrl && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Cinematic Storyboard</h2>
              <p className="text-neutral-400">
                {state.videoModel === 'seedance-1.5' && seedanceSceneCount === 15
                  ? 'Review both storyboard grids. These will define the look of your 15 scenes.'
                  : `Review the generated 3x3 grid. This will define the look of your 9 scenes.`}
              </p>
            </div>

            {/* First Grid (3x3) */}
            <div>
              {state.videoModel === 'seedance-1.5' && seedanceSceneCount === 15 && (
                <h3 className="text-lg font-semibold text-neutral-300 mb-2 text-center">Scenes 1-9</h3>
              )}
              <Storyboard
                imageUrl={state.storyboardUrl}
                onRegenerate={handleRegenerateStoryboard}
                onConfirm={handleConfirmStoryboard}
                isLoading={state.isGeneratingStoryboard}
                isConfirming={state.isConfirming}
              />
            </div>

            {/* Second Grid (3x2) - Seedance 15-scene mode only */}
            {state.videoModel === 'seedance-1.5' && seedanceSceneCount === 15 && state.storyboardUrl2 && (
              <div>
                <h3 className="text-lg font-semibold text-neutral-300 mb-2 text-center">Scenes 10-15</h3>
                <div className="max-w-4xl mx-auto bg-neutral-800 rounded-xl overflow-hidden border border-neutral-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={state.storyboardUrl2}
                    alt="Storyboard Grid 2 (Scenes 10-15)"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {state.step === 'production' && state.script && (
          <Production
            script={state.script}
            frames={state.frames}
            generatedVideos={state.generatedVideos}
            generatingVideoIds={state.generatingVideoIds}
            masterAudioUrl={state.masterAudioUrl}
            backgroundMusicUrl={state.backgroundMusicUrl}
            isGeneratingAudio={state.isGeneratingAudio}
            isGeneratingMusic={state.isGeneratingMusic}
            isGeneratingFullMovie={state.isGeneratingFullMovie}
            onGenerateVideo={handleGenerateVideo}
            onGenerateFullMovie={handleGenerateFullMovie}
            aspectRatio={state.aspectRatio}
            videoModel={state.videoModel}
          />
        )}
      </main>
    </div>
  );
}

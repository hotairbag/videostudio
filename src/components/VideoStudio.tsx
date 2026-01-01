'use client';

import React, { useState, useEffect } from 'react';
import InputForm from '@/components/InputForm';
import Storyboard from '@/components/Storyboard';
import Production from '@/components/Production';
import { generateScript, generateStoryboard, generateVideoForScene, generateMasterAudio, setApiKey, getApiKey } from '@/services/geminiService';
import { generateBackgroundMusic } from '@/services/musicService';
import { sliceGridImage } from '@/utils/imageUtils';
import { AppState, AspectRatio } from '@/types';

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
    frames: [],
    generatedVideos: {},
    masterAudioUrl: null,
    backgroundMusicUrl: null,
    isGeneratingScript: false,
    isGeneratingStoryboard: false,
    isGeneratingAudio: false,
    isGeneratingMusic: false,
    isGeneratingFullMovie: false,
    generatingVideoIds: [],
    aspectRatio: '16:9',
  });

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

  const handleInitialGenerate = async (prompt: string, refVideo?: string, refImages?: string[]) => {
    setState(prev => ({ ...prev, isGeneratingScript: true }));
    try {
      const script = await generateScript(prompt, refVideo, refImages);
      setState(prev => ({ ...prev, script, isGeneratingScript: false, isGeneratingStoryboard: true }));
      const storyboardUrl = await generateStoryboard(script, refImages, state.aspectRatio);

      setState(prev => ({
        ...prev,
        storyboardUrl,
        isGeneratingStoryboard: false,
        step: 'storyboard'
      }));
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
      const storyboardUrl = await generateStoryboard(state.script, undefined, state.aspectRatio);
      setState(prev => ({ ...prev, storyboardUrl, isGeneratingStoryboard: false }));
    } catch (error) {
      console.error(error);
      setState(prev => ({ ...prev, isGeneratingStoryboard: false }));
    }
  };

  const handleConfirmStoryboard = async () => {
    if (!state.storyboardUrl) return;
    try {
      const frames = await sliceGridImage(state.storyboardUrl, state.aspectRatio);
      setState(prev => ({ ...prev, frames, step: 'production' }));
    } catch (error) {
      console.error("Failed to slice grid:", error);
      alert("Could not process storyboard grid.");
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
      const videoUrl = await generateVideoForScene(scene, startFrame, state.aspectRatio);
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
    setState(prev => ({ ...prev, isGeneratingAudio: true }));
    try {
      const audioUrl = await generateMasterAudio(state.script);
      setState(prev => ({ ...prev, masterAudioUrl: audioUrl, isGeneratingAudio: false }));
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
      let audioPromise = Promise.resolve(state.masterAudioUrl);
      if (!state.masterAudioUrl) {
        setState(prev => ({ ...prev, isGeneratingAudio: true }));
        audioPromise = generateMasterAudio(state.script!)
          .then(url => {
            setState(prev => ({ ...prev, masterAudioUrl: url, isGeneratingAudio: false }));
            return url;
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
              const videoUrl = await generateVideoForScene(scene, startFrame, state.aspectRatio);
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
            Gemini 3 Pro • Veo 3.1 • Gemini 2.5 TTS
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
          />
        )}

        {state.step === 'storyboard' && state.storyboardUrl && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Cinematic Storyboard</h2>
              <p className="text-neutral-400">Review the generated 3x3 grid. This will define the look of your 9 scenes.</p>
            </div>
            <Storyboard
              imageUrl={state.storyboardUrl}
              onRegenerate={handleRegenerateStoryboard}
              onConfirm={handleConfirmStoryboard}
              isLoading={state.isGeneratingStoryboard}
            />
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
          />
        )}
      </main>
    </div>
  );
}

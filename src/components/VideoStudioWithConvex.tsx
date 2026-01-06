'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id, Doc } from '../../convex/_generated/dataModel';
import InputForm from '@/components/InputForm';
import Storyboard from '@/components/Storyboard';
import Production from '@/components/Production';
import { generateScript, generateStoryboard, generateStoryboard2, generateMasterAudio, generateVideoForScene, setApiKey, getApiKey } from '@/services/geminiService';
import { sliceGridImage, sliceGrid3x2Image } from '@/utils/imageUtils';
import { useTaskPolling, useStartVideoTask, useStartMusicTask } from '@/hooks/useTaskPolling';
import { AspectRatio, VideoModel, SeedanceResolution, SeedanceDuration, SeedanceSceneCount, Script, VoiceMode, Character, DialogueLine, ReferenceImages, Scene, ContentLanguage } from '@/types';

/**
 * Build the full prompt for Seedance video generation
 * Following Seedance 1.5 Pro official prompt guide
 * Formula: Subject + Movement + Environment + Camera movement + Aesthetic description + Sound
 * CRITICAL: Must include language directive to prevent unwanted language in generated video
 */
function buildSeedancePrompt(
  scene: Scene,
  voiceMode: VoiceMode,
  characters?: Character[],
  language: string = 'english',
  style?: string
): string {
  const parts: string[] = [];

  // Build language directive based on selected language
  const languageUpper = language.toUpperCase();
  const languageDirective = language === 'english'
    ? '[LANGUAGE: ENGLISH ONLY - No Chinese text, signs, or dialogue]'
    : `[LANGUAGE: ${languageUpper} - All dialogue and on-screen text must be in ${languageUpper}. Visual descriptions are in English for AI understanding.]`;
  parts.push(languageDirective);

  // Art Style reference (from script.style)
  if (style) {
    parts.push(`Art Style: ${style}`);
  }

  // Main visual description (already follows Seedance format from updated script generation)
  // This includes: Subject + Movement + Environment + Camera movement
  parts.push(scene.visualDescription);

  // Audio atmosphere (SFX notes)
  if (scene.audioDescription) {
    parts.push(`Audio Atmosphere: ${scene.audioDescription}`);
  }

  // Audio instructions with language-specific dialogue instruction
  const dialogueLanguageNote = language === 'english'
    ? 'ENGLISH language only'
    : `${languageUpper} language only`;

  const audioInstruction = voiceMode === 'speech_in_video'
    ? `AUDIO: Include ambient sound effects matching the scene. Characters speak dialogue in ${dialogueLanguageNote}. ABSOLUTELY NO BACKGROUND MUSIC - music will be added in post-production.`
    : 'AUDIO: Include ambient sound effects only. NO DIALOGUE OR SPEECH. ABSOLUTELY NO BACKGROUND MUSIC - music will be added in post-production.';
  parts.push(audioInstruction);

  // Add dialogue for speech-in-video mode with Seedance emotional formatting
  if (voiceMode === 'speech_in_video') {
    if (scene.dialogue && scene.dialogue.length > 0) {
      // Build character voice profile map
      const voiceProfiles = new Map<string, string>();
      if (characters) {
        for (const char of characters) {
          voiceProfiles.set(char.name.toLowerCase(), char.voiceProfile || '');
        }
      }

      // Build dialogue lines following Seedance format:
      // "In a [emotionalState] emotional state, with a [tone] tone and a [pace] speaking pace, [Speaker] says: '[text]'"
      const dialogueLines = scene.dialogue.map(line => {
        const profile = voiceProfiles.get(line.speaker.toLowerCase());

        // Use Seedance vocal characteristics if available
        if (line.emotionalState || line.tone || line.pace) {
          const emotionalState = line.emotionalState || 'calm';
          const tone = line.tone || 'even';
          const pace = line.pace || 'normal';
          return `In a ${emotionalState} emotional state, with a ${tone} tone and a ${pace} speaking pace, ${line.speaker} says: "${line.text}"`;
        }

        // Fallback to voice profile hint
        const profileHint = profile ? ` (voice: ${profile})` : '';
        return `${line.speaker}${profileHint}: "${line.text}"`;
      }).join('\n');

      parts.push(`${languageUpper} DIALOGUE:\n${dialogueLines}`);
    } else if (scene.voiceoverText?.trim()) {
      // Fallback to voiceoverText if no dialogue
      parts.push(`VOICEOVER (speak in ${languageUpper} with a calm, clear voice): "${scene.voiceoverText}"`);
    }
  }

  return parts.join('\n\n');
}

interface VideoStudioWithConvexProps {
  projectId: Id<'projects'>;
  project: Doc<'projects'>;
}

export default function VideoStudioWithConvex({ projectId, project }: VideoStudioWithConvexProps) {
  const [apiKeyReady, setApiKeyReady] = useState(() => !!getApiKey());
  const [manualKey, setManualKey] = useState('');

  // Local UI state
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingStoryboard1, setIsGeneratingStoryboard1] = useState(false);
  const [isGeneratingStoryboard2, setIsGeneratingStoryboard2] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);
  const [isGeneratingFullMovie, setIsGeneratingFullMovie] = useState(false);
  const [generatingVideoIds, setGeneratingVideoIds] = useState<number[]>([]);

  // Convex queries
  const script = useQuery(api.scenes.getScript, { projectId });
  const scenes = useQuery(api.scenes.getScenesByProject, { projectId });
  const storyboards = useQuery(api.storyboards.getByProject, { projectId });
  const frames = useQuery(api.frames.getByProject, { projectId });
  const videos = useQuery(api.videos.getByProject, { projectId });
  const audioTracks = useQuery(api.audioTracks.getByProject, { projectId });

  // Convex mutations
  const createScript = useMutation(api.scenes.createScript);
  const createStoryboard = useMutation(api.storyboards.create);
  const updateStoryboard = useMutation(api.storyboards.update);
  const createFrames = useMutation(api.frames.createMany);
  const updateProjectStatus = useMutation(api.projects.updateStatus);
  const updateProject = useMutation(api.projects.update);
  const createAudioTrack = useMutation(api.audioTracks.create);
  const createVideo = useMutation(api.videos.create);

  // Task polling hooks - get pending tasks to track async generation status
  const { pendingTasks } = useTaskPolling(projectId);

  // Check if music is currently generating (async task pending)
  const hasPendingMusicTask = pendingTasks.some(t => t.taskType === 'music_suno');

  // Get scene IDs that have pending video tasks (for Seedance)
  const pendingVideoSceneIds = pendingTasks
    .filter(t => t.taskType === 'video_seedance' && t.sceneId)
    .map(t => {
      // Get the scene number from the scene ID
      const scene = scenes?.find(s => s._id === t.sceneId);
      return scene?.sceneNumber ?? 0;
    })
    .filter(id => id > 0);

  // Helper to upload base64 image to R2 and get URL
  const uploadImageToR2 = async (base64Image: string): Promise<string> => {
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [base64Image] }),
    });
    if (!response.ok) {
      throw new Error('Failed to upload image to R2');
    }
    const { urls } = await response.json();
    return urls[0];
  };

  // Helper to upload video blob URL to R2 and get persistent URL
  const uploadVideoToR2 = async (blobUrl: string, sceneId: number): Promise<string> => {
    // Fetch the blob from the blob URL
    const blobResponse = await fetch(blobUrl);
    const blob = await blobResponse.blob();

    // Use FormData to send binary data directly (preserves audio better than base64)
    const formData = new FormData();
    formData.append('video', blob, `scene_${sceneId}.mp4`);
    formData.append('sceneId', String(sceneId));

    // Upload to R2
    const response = await fetch('/api/upload/video', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to upload video to R2: ${error}`);
    }
    const { url } = await response.json();
    return url;
  };

  const { startSeedanceVideo } = useStartVideoTask(projectId);
  const { startMusic } = useStartMusicTask(projectId);

  // Ref images for storyboard generation
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
  const localScriptRef = useRef<Script | null>(null);

  // Derived state
  const step = project.status === 'draft' || project.status === 'scripting' ? 'input'
             : project.status === 'storyboarding' ? 'storyboard'
             : 'production';

  const storyboard1 = storyboards?.find(s => s.gridType === '3x3');
  const storyboard2 = storyboards?.find(s => s.gridType === '3x2');

  // Convert videos to the expected format
  const generatedVideos: Record<number, string> = {};
  if (videos && scenes) {
    for (const video of videos) {
      if (video.status === 'completed' && video.videoUrl) {
        const scene = scenes.find(s => s._id === video.sceneId);
        if (scene) {
          generatedVideos[scene.sceneNumber] = video.videoUrl;
        }
      }
    }
  }

  // Get audio URLs
  const masterAudioUrl = audioTracks?.find(a => a.type === 'voiceover')?.audioUrl || null;
  const backgroundMusicUrl = audioTracks?.find(a => a.type === 'music')?.audioUrl || null;

  // Build Script object from Convex data
  const fullScript: Script | null = script && scenes && scenes.length > 0 ? {
    title: script.title,
    style: script.style,
    narratorVoice: script.narratorVoice as Script['narratorVoice'],
    characters: script.characters ? JSON.parse(script.characters) as Character[] : undefined,
    scenes: scenes.map(s => ({
      id: s.sceneNumber,
      timeRange: s.timeRange,
      visualDescription: s.visualDescription,
      audioDescription: s.audioDescription,
      cameraShot: s.cameraShot,
      voiceoverText: s.voiceoverText,
      dialogue: s.dialogue ? JSON.parse(s.dialogue) as DialogueLine[] : undefined,
    })),
  } : localScriptRef.current;

  // Frame data URLs array
  const frameUrls: string[] = frames?.map(f => f.imageUrl) || [];

  const handleManualKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualKey.trim().length > 10) {
      setApiKey(manualKey.trim());
      setApiKeyReady(true);
    }
  };

  const handleInitialGenerate = async (prompt: string, refVideo?: string, refImages?: ReferenceImages) => {
    refImagesRef.current = refImages;
    setIsGeneratingScript(true);

    // Flatten for functions that don't support categorized refs yet
    const flatImages = flattenRefImages(refImages);
    // Extract character names from references to hint the script generator
    const characterNames = refImages?.characters.map(c => c.name) || [];

    try {
      // Save original prompt to project
      await updateProject({ projectId, originalPrompt: prompt });

      // Upload character reference images to R2 and save URLs
      if (refImages?.characters && refImages.characters.length > 0) {
        const characterRefsWithUrls = await Promise.all(
          refImages.characters.map(async (char) => {
            // Upload all images for this character
            const uploadRes = await fetch('/api/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ images: char.images }),
            });
            if (!uploadRes.ok) {
              console.warn(`Failed to upload images for character ${char.name}`);
              return { name: char.name, imageUrls: [] };
            }
            const { urls } = await uploadRes.json();
            return { name: char.name, imageUrls: urls };
          })
        );
        // Save character refs to project as JSON
        await updateProject({
          projectId,
          characterRefs: JSON.stringify(characterRefsWithUrls),
        });
      }

      await updateProjectStatus({ projectId, status: 'scripting' });

      const generatedScript = await generateScript(
        prompt,
        refVideo,
        flatImages,
        project.enableCuts,
        project.videoModel,
        project.seedanceSceneCount as 9 | 15,
        project.multiCharacter ?? false,
        (project.voiceMode ?? 'tts') as VoiceMode,
        characterNames,
        project.language ?? 'english'
      );

      localScriptRef.current = generatedScript;

      // Save script to Convex
      await createScript({
        projectId,
        title: generatedScript.title,
        style: generatedScript.style,
        narratorVoice: generatedScript.narratorVoice,
        characters: generatedScript.characters ? JSON.stringify(generatedScript.characters) : undefined,
        scenes: generatedScript.scenes.map((s, idx) => ({
          sceneNumber: idx + 1,
          timeRange: s.timeRange || `Scene ${idx + 1}`,
          visualDescription: s.visualDescription,
          audioDescription: s.audioDescription || '',
          cameraShot: s.cameraShot || s.cinematicElements || '',
          voiceoverText: s.voiceoverText,
          dialogue: s.dialogue ? JSON.stringify(s.dialogue) : undefined,
        })),
      });

      setIsGeneratingScript(false);
      setIsGeneratingStoryboard1(true);

      await updateProjectStatus({ projectId, status: 'storyboarding' });

      // Generate first storyboard (3x3 grid)
      // Pass totalScenes so the model knows if this is part of a longer story
      const totalScenes = project.videoModel === 'seedance-1.5' ? (project.seedanceSceneCount ?? 9) : 9;
      const storyboardBase64 = await generateStoryboard(generatedScript, flatImages, project.aspectRatio as AspectRatio, totalScenes);
      // Upload to R2 to avoid Convex 1MB limit
      const storyboardUrl = await uploadImageToR2(storyboardBase64);

      const storyboard1Id = await createStoryboard({
        projectId,
        gridType: '3x3',
        imageUrl: storyboardUrl,
      });

      setIsGeneratingStoryboard1(false);

      // Only generate second storyboard for Seedance with 15 scenes
      if (project.videoModel === 'seedance-1.5' && project.seedanceSceneCount === 15) {
        setIsGeneratingStoryboard2(true);
        // Slice first storyboard into individual panels for style reference
        const panels = await sliceGridImage(storyboardBase64, project.aspectRatio as AspectRatio);
        // Use first 3 panels as style reference (avoids passing full grid which confuses the model)
        const stylePanels = panels.slice(0, 3);

        // Generate second storyboard for Seedance
        const storyboardBase64_2 = await generateStoryboard2(
          generatedScript,
          stylePanels,
          flatImages,
          project.aspectRatio as AspectRatio
        );
        // Upload to R2 to avoid Convex 1MB limit
        const storyboardUrl2 = await uploadImageToR2(storyboardBase64_2);

        await createStoryboard({
          projectId,
          gridType: '3x2',
          imageUrl: storyboardUrl2,
        });
        setIsGeneratingStoryboard2(false);
      }
    } catch (error) {
      console.error(error);
      alert("Generation failed. See console for details.");
      setIsGeneratingScript(false);
      setIsGeneratingStoryboard1(false);
      setIsGeneratingStoryboard2(false);
      await updateProjectStatus({ projectId, status: 'draft' });
    }
  };

  const handleRegenerateStoryboard1 = async () => {
    if (!fullScript) return;
    setIsGeneratingStoryboard1(true);

    try {
      const totalScenes = project.videoModel === 'seedance-1.5' ? (project.seedanceSceneCount ?? 9) : 9;
      const storyboardBase64 = await generateStoryboard(fullScript, flattenRefImages(refImagesRef.current), project.aspectRatio as AspectRatio, totalScenes);
      const storyboardUrl = await uploadImageToR2(storyboardBase64);

      if (storyboard1) {
        await updateStoryboard({ storyboardId: storyboard1._id, imageUrl: storyboardUrl });
      }

      setIsGeneratingStoryboard1(false);
    } catch (error) {
      console.error(error);
      setIsGeneratingStoryboard1(false);
    }
  };

  const handleRegenerateStoryboard2 = async () => {
    if (!fullScript || !storyboard1?.imageUrl) return;
    setIsGeneratingStoryboard2(true);

    try {
      // Fetch the first storyboard image (add cache-busting to avoid CORS cache issues)
      const cacheBuster = `?t=${Date.now()}`;
      const response = await fetch(storyboard1.imageUrl + cacheBuster);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      // Slice into individual panels for style reference (avoids confusing the model with grid structure)
      const panels = await sliceGridImage(base64, project.aspectRatio as AspectRatio);
      const stylePanels = panels.slice(0, 3);

      const storyboardBase64_2 = await generateStoryboard2(
        fullScript,
        stylePanels,
        flattenRefImages(refImagesRef.current),
        project.aspectRatio as AspectRatio
      );
      const storyboardUrl2 = await uploadImageToR2(storyboardBase64_2);

      if (storyboard2) {
        await updateStoryboard({ storyboardId: storyboard2._id, imageUrl: storyboardUrl2 });
      }

      setIsGeneratingStoryboard2(false);
    } catch (error) {
      console.error(error);
      setIsGeneratingStoryboard2(false);
    }
  };

  const handleConfirmStoryboard = async () => {
    if (!storyboard1?.imageUrl || !scenes) return;

    setIsConfirming(true);
    try {
      // Check if frames already exist (user might be returning from production)
      const expectedFrameCount = project.videoModel === 'seedance-1.5' && project.seedanceSceneCount === 15 ? 15 : 9;
      if (frames && frames.length >= expectedFrameCount) {
        // Frames already exist, just go to production without re-processing
        await updateProjectStatus({ projectId, status: 'production' });
        setIsConfirming(false);
        return;
      }

      // Slice first grid (3x3 = 9 frames)
      const frames1 = await sliceGridImage(storyboard1.imageUrl, project.aspectRatio as AspectRatio);

      const allFrames: { sceneId: Id<'scenes'>; frameNumber: number; imageUrl: string }[] = [];

      // Map frames to scenes
      for (let i = 0; i < Math.min(frames1.length, scenes.length); i++) {
        allFrames.push({
          sceneId: scenes[i]._id,
          frameNumber: i + 1,
          imageUrl: frames1[i],
        });
      }

      // Only slice second grid for Seedance with 15 scenes
      if (project.videoModel === 'seedance-1.5' && project.seedanceSceneCount === 15 && storyboard2?.imageUrl) {
        // Slice second grid (3x2 = 6 frames)
        const frames2 = await sliceGrid3x2Image(storyboard2.imageUrl, project.aspectRatio as AspectRatio);

        for (let i = 0; i < Math.min(frames2.length, scenes.length - 9); i++) {
          if (scenes[9 + i]) {
            allFrames.push({
              sceneId: scenes[9 + i]._id,
              frameNumber: 10 + i,
              imageUrl: frames2[i],
            });
          }
        }
      }

      // Upload frames to R2 and save to Convex
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: allFrames.map(f => f.imageUrl) }),
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload frames');
      }

      const { urls } = await uploadRes.json();

      // Save frames to Convex with uploaded URLs
      await createFrames({
        projectId,
        frames: allFrames.map((f, idx) => ({
          sceneId: f.sceneId,
          frameNumber: f.frameNumber,
          imageUrl: urls[idx],
        })),
      });

      await updateProjectStatus({ projectId, status: 'production' });
    } catch (error) {
      console.error("Failed to process storyboard:", error);
      alert("Could not process storyboard grid.");
    } finally {
      setIsConfirming(false);
    }
  };

  const handleGenerateVideo = useCallback(async (sceneId: number) => {
    if (!fullScript || !scenes || !frames) return;

    const sceneIndex = fullScript.scenes.findIndex(s => s.id === sceneId);
    if (sceneIndex === -1) return;

    const convexScene = scenes[sceneIndex];
    const frame = frames[sceneIndex];
    if (!convexScene || !frame) return;

    const sceneData = fullScript.scenes[sceneIndex];
    setGeneratingVideoIds(prev => [...prev, sceneId]);

    try {
      if (project.videoModel === 'veo-3.1') {
        // Veo: Generate video directly via Gemini SDK
        const blobUrl = await generateVideoForScene(
          sceneData,
          frame.imageUrl,
          project.aspectRatio as AspectRatio,
          'veo-3.1',
          project.seedanceResolution as SeedanceResolution,
          project.seedanceAudio,
          (project.voiceMode ?? 'tts') as VoiceMode,
          fullScript.characters,
          fullScript.style,
          project.language ?? 'english'
        );

        // Upload blob to R2 for persistent storage
        const r2Url = await uploadVideoToR2(blobUrl, sceneId);

        // Save video record in Convex
        await createVideo({
          projectId,
          sceneId: convexScene._id,
          videoUrl: r2Url,
          duration: 8, // Veo generates 8-second clips
          status: 'completed',
        });
      } else {
        // Seedance: Use task-based async generation
        // Build full prompt following Seedance 1.5 Pro guide structure
        const seedancePrompt = buildSeedancePrompt(
          sceneData,
          (project.voiceMode ?? 'tts') as VoiceMode,
          fullScript.characters,
          project.language ?? 'english',
          fullScript.style
        );
        await startSeedanceVideo(
          convexScene._id,
          seedancePrompt,
          frame.imageUrl,
          project.aspectRatio as '16:9' | '9:16',
          project.seedanceResolution as '480p' | '720p',
          project.seedanceAudio,
          (project.seedanceDuration ?? 4) as 4 | 8 | 12
        );
        // Video will be tracked by the polling hook
      }
    } catch (error) {
      console.error(error);
      alert(`Failed to generate video for scene ${sceneId}`);
    } finally {
      setGeneratingVideoIds(prev => prev.filter(id => id !== sceneId));
    }
  }, [fullScript, scenes, frames, startSeedanceVideo, project, projectId, createVideo]);

  const handleGenerateAudio = async () => {
    if (!fullScript) return;

    // Skip TTS generation if using speech_in_video mode (dialogue is in the video)
    if (project.voiceMode === 'speech_in_video') {
      console.log('[Audio] Skipping TTS - using speech_in_video mode');
      return;
    }

    setIsGeneratingAudio(true);
    try {
      const audioDataUrl = await generateMasterAudio(fullScript, project.multiCharacter ?? false);

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

      await createAudioTrack({
        projectId,
        type: 'voiceover',
        audioUrl: finalAudioUrl,
      });
      setIsGeneratingAudio(false);
    } catch (error) {
      console.error(error);
      alert("Audio generation failed");
      setIsGeneratingAudio(false);
    }
  };

  const handleGenerateMusic = async () => {
    if (!fullScript) return;
    setIsGeneratingMusic(true);
    try {
      // Pass full scenes for better music context
      await startMusic(fullScript.title, fullScript.style, fullScript.scenes);
      // Music will be tracked by the polling hook
      setIsGeneratingMusic(false);
    } catch (error) {
      console.error(error);
      alert("Background music generation failed");
      setIsGeneratingMusic(false);
    }
  };

  const handleGenerateFullMovie = async () => {
    if (!fullScript || !scenes || !frames) return;
    setIsGeneratingFullMovie(true);

    try {
      // Generate audio if not exists (only for TTS mode, not speech_in_video)
      if (!masterAudioUrl && project.voiceMode !== 'speech_in_video') {
        setIsGeneratingAudio(true);
        try {
          const audioDataUrl = await generateMasterAudio(fullScript, project.multiCharacter ?? false);

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

          await createAudioTrack({
            projectId,
            type: 'voiceover',
            audioUrl: finalAudioUrl,
          });
        } catch (err) {
          console.error("Audio gen failed", err);
        }
        setIsGeneratingAudio(false);
      }

      // Generate music if enabled and not exists
      if (project.backgroundMusicEnabled !== false && !backgroundMusicUrl) {
        setIsGeneratingMusic(true);
        try {
          await startMusic(fullScript.title, fullScript.style, fullScript.scenes);
        } catch (err) {
          console.warn("Music gen failed", err);
        }
        setIsGeneratingMusic(false);
      }

      // Generate videos for scenes that don't have them
      const scenesToGenerate = fullScript.scenes.filter(s => !generatedVideos[s.id]);

      for (const scene of scenesToGenerate) {
        const sceneIndex = fullScript.scenes.findIndex(s => s.id === scene.id);
        const convexScene = scenes[sceneIndex];
        const frame = frames[sceneIndex];

        if (convexScene && frame) {
          try {
            if (project.videoModel === 'veo-3.1') {
              // Veo: Generate video directly via Gemini SDK
              const blobUrl = await generateVideoForScene(
                scene,
                frame.imageUrl,
                project.aspectRatio as AspectRatio,
                'veo-3.1',
                project.seedanceResolution as SeedanceResolution,
                project.seedanceAudio,
                (project.voiceMode ?? 'tts') as VoiceMode,
                fullScript.characters,
                fullScript.style,
                project.language ?? 'english'
              );

              // Upload blob to R2 for persistent storage
              const r2Url = await uploadVideoToR2(blobUrl, scene.id);

              // Save video record in Convex
              await createVideo({
                projectId,
                sceneId: convexScene._id,
                videoUrl: r2Url,
                duration: 8, // Veo generates 8-second clips
                status: 'completed',
              });
            } else {
              // Seedance: Use task-based async generation
              // Build full prompt following Seedance 1.5 Pro guide structure
              const seedancePrompt = buildSeedancePrompt(
                scene,
                (project.voiceMode ?? 'tts') as VoiceMode,
                fullScript.characters,
                project.language ?? 'english',
                fullScript.style
              );
              await startSeedanceVideo(
                convexScene._id,
                seedancePrompt,
                frame.imageUrl,
                project.aspectRatio as '16:9' | '9:16',
                project.seedanceResolution as '480p' | '720p',
                project.seedanceAudio,
                (project.seedanceDuration ?? 4) as 4 | 8 | 12
              );
            }
          } catch (err) {
            console.error(`Failed to generate video for scene ${scene.id}`, err);
          }
        }
      }
    } catch (error) {
      console.error("Full movie generation error", error);
      alert("An error occurred during full movie generation.");
    } finally {
      setIsGeneratingFullMovie(false);
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
            To use video generation and Gemini Pro models, please enter your Google Cloud API key.
          </p>

          <form onSubmit={handleManualKeySubmit} className="space-y-3">
            <input
              type="password"
              placeholder="Enter API Key"
              value={manualKey}
              onChange={(e) => setManualKey(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-600 rounded px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={manualKey.length < 10}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-500 rounded font-semibold disabled:opacity-50"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white font-sans selection:bg-red-500 selection:text-white">
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="text-neutral-400 hover:text-white transition-colors">
              &larr; Projects
            </a>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-orange-600 rounded-lg"></div>
              <h1 className="text-xl font-bold tracking-tight">
                {project.title || 'New Project'}
              </h1>
            </div>
          </div>
          <div className="text-xs text-neutral-500 font-mono hidden sm:block">
            {project.videoModel === 'seedance-1.5' ? 'Seedance 1.5' : 'Veo 3.1'}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {step === 'input' && (
          <InputForm
            onSubmit={handleInitialGenerate}
            isLoading={isGeneratingScript || isGeneratingStoryboard1 || isGeneratingStoryboard2}
            aspectRatio={project.aspectRatio as AspectRatio}
            onAspectRatioChange={(v) => updateProject({ projectId, aspectRatio: v })}
            enableCuts={project.enableCuts}
            onEnableCutsChange={(v) => updateProject({ projectId, enableCuts: v })}
            videoModel={project.videoModel as VideoModel}
            onVideoModelChange={(v) => updateProject({ projectId, videoModel: v })}
            seedanceAudio={project.seedanceAudio}
            onSeedanceAudioChange={(v) => updateProject({ projectId, seedanceAudio: v })}
            seedanceResolution={project.seedanceResolution as SeedanceResolution}
            onSeedanceResolutionChange={(v) => updateProject({ projectId, seedanceResolution: v })}
            seedanceDuration={(project.seedanceDuration ?? 4) as SeedanceDuration}
            onSeedanceDurationChange={(v) => updateProject({ projectId, seedanceDuration: v })}
            seedanceSceneCount={project.seedanceSceneCount as SeedanceSceneCount}
            onSeedanceSceneCountChange={(v) => updateProject({ projectId, seedanceSceneCount: v })}
            voiceMode={(project.voiceMode ?? 'tts') as VoiceMode}
            onVoiceModeChange={(v) => updateProject({ projectId, voiceMode: v })}
            multiCharacter={project.multiCharacter ?? false}
            onMultiCharacterChange={(v) => updateProject({ projectId, multiCharacter: v })}
            language={(project.language ?? 'english') as ContentLanguage}
            onLanguageChange={(v) => updateProject({ projectId, language: v })}
            backgroundMusicEnabled={project.backgroundMusicEnabled ?? true}
            onBackgroundMusicEnabledChange={(v) => updateProject({ projectId, backgroundMusicEnabled: v })}
          />
        )}

        {step === 'storyboard' && (storyboard1?.imageUrl || isGeneratingStoryboard1) && (
          <div className="space-y-6">
            {/* Project Overview - Prompt & Character Refs */}
            {project.originalPrompt && (
              <div className="bg-neutral-800/50 rounded-xl p-4 border border-neutral-700">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-neutral-400 mb-2">Original Prompt</h3>
                    <p className="text-neutral-200 text-sm whitespace-pre-wrap break-words">{project.originalPrompt}</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(project.originalPrompt);
                    }}
                    className="flex-shrink-0 p-2 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded-lg transition-colors"
                    title="Copy prompt"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
                {/* Character References */}
                {project.characterRefs && (() => {
                  try {
                    const chars = JSON.parse(project.characterRefs) as Array<{name: string; imageUrls: string[]}>;
                    if (chars.length === 0) return null;
                    return (
                      <div className="mt-4 pt-4 border-t border-neutral-700">
                        <h3 className="text-sm font-medium text-neutral-400 mb-3">Character References</h3>
                        <div className="flex flex-wrap gap-4">
                          {chars.map((char, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <div className="flex -space-x-2">
                                {char.imageUrls.slice(0, 3).map((url, imgIdx) => (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    key={imgIdx}
                                    src={url}
                                    alt={`${char.name} ref ${imgIdx + 1}`}
                                    className="w-10 h-10 rounded-full object-cover border-2 border-neutral-800"
                                  />
                                ))}
                                {char.imageUrls.length > 3 && (
                                  <div className="w-10 h-10 rounded-full bg-neutral-700 border-2 border-neutral-800 flex items-center justify-center text-xs text-neutral-400">
                                    +{char.imageUrls.length - 3}
                                  </div>
                                )}
                              </div>
                              <span className="text-sm text-neutral-300">{char.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  } catch {
                    return null;
                  }
                })()}
              </div>
            )}

            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Cinematic Storyboard</h2>
              <p className="text-neutral-400">
                {project.videoModel === 'seedance-1.5' && project.seedanceSceneCount === 15
                  ? 'Review both storyboard grids. These will define the look of your 15 scenes.'
                  : 'Review the generated 3x3 grid. This will define the look of your 9 scenes.'}
              </p>
            </div>

            {/* Single storyboard for Veo mode OR Seedance with 9 scenes */}
            {(project.videoModel !== 'seedance-1.5' || project.seedanceSceneCount === 9) && storyboard1?.imageUrl && (
              <Storyboard
                imageUrl={storyboard1.imageUrl}
                onRegenerate={handleRegenerateStoryboard1}
                onConfirm={handleConfirmStoryboard}
                isLoading={isGeneratingStoryboard1}
                isConfirming={isConfirming}
              />
            )}

            {/* Dual storyboards side-by-side for Seedance mode with 15 scenes */}
            {project.videoModel === 'seedance-1.5' && project.seedanceSceneCount === 15 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Storyboard 1 (Scenes 1-9) */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-neutral-300 text-center">Scenes 1-9 (3×3 Grid)</h3>
                  <div className="bg-neutral-800 rounded-xl overflow-hidden border border-neutral-700 relative group">
                    {isGeneratingStoryboard1 ? (
                      <div className="aspect-square flex flex-col items-center justify-center bg-neutral-900">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500 mb-4"></div>
                        <p className="text-neutral-400">Generating storyboard...</p>
                      </div>
                    ) : storyboard1?.imageUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={storyboard1.imageUrl}
                          alt="Storyboard Grid 1 (Scenes 1-9)"
                          className="w-full h-auto"
                        />
                        <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white font-mono">
                          9 scenes
                        </div>
                      </>
                    ) : null}
                  </div>
                  {storyboard1?.imageUrl && (
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={handleRegenerateStoryboard1}
                        disabled={isGeneratingStoryboard1}
                        className="px-4 py-2 rounded-lg border border-neutral-600 text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors text-sm disabled:opacity-50"
                      >
                        {isGeneratingStoryboard1 ? 'Regenerating...' : 'Regenerate'}
                      </button>
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = storyboard1.imageUrl;
                          link.download = `storyboard_1-9_${Date.now()}.png`;
                          link.click();
                        }}
                        className="px-4 py-2 rounded-lg border border-neutral-600 text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors text-sm flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </button>
                    </div>
                  )}
                </div>

                {/* Storyboard 2 (Scenes 10-15) */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-neutral-300 text-center">Scenes 10-15 (3×2 Grid)</h3>
                  <div className="bg-neutral-800 rounded-xl overflow-hidden border border-neutral-700 relative group">
                    {isGeneratingStoryboard2 ? (
                      <div className="aspect-[3/2] flex flex-col items-center justify-center bg-neutral-900">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500 mb-4"></div>
                        <p className="text-neutral-400">Generating storyboard...</p>
                      </div>
                    ) : storyboard2?.imageUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={storyboard2.imageUrl}
                          alt="Storyboard Grid 2 (Scenes 10-15)"
                          className="w-full h-auto"
                        />
                        <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white font-mono">
                          6 scenes
                        </div>
                      </>
                    ) : (
                      <div className="aspect-[3/2] flex flex-col items-center justify-center bg-neutral-900 text-neutral-500">
                        <p>Waiting for first storyboard...</p>
                      </div>
                    )}
                  </div>
                  {storyboard2?.imageUrl && (
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={handleRegenerateStoryboard2}
                        disabled={isGeneratingStoryboard2}
                        className="px-4 py-2 rounded-lg border border-neutral-600 text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors text-sm disabled:opacity-50"
                      >
                        {isGeneratingStoryboard2 ? 'Regenerating...' : 'Regenerate'}
                      </button>
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = storyboard2.imageUrl;
                          link.download = `storyboard_10-15_${Date.now()}.png`;
                          link.click();
                        }}
                        className="px-4 py-2 rounded-lg border border-neutral-600 text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors text-sm flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Confirm button - show when first storyboard is ready, and second is ready (if needed for 15 scenes) */}
            {storyboard1?.imageUrl && (project.seedanceSceneCount !== 15 || storyboard2?.imageUrl) && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleConfirmStoryboard}
                  disabled={isGeneratingStoryboard1 || isGeneratingStoryboard2 || isConfirming}
                  className="px-8 py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold shadow-lg shadow-green-900/20 transition-all transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                >
                  {isConfirming && (
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {isConfirming ? 'Processing...' : 'Confirm & Go to Production'}
                </button>
              </div>
            )}

            <p className="text-neutral-500 text-sm max-w-lg text-center mx-auto">
              {project.videoModel === 'seedance-1.5' && project.seedanceSceneCount === 15
                ? 'Note: Confirming will slice both grids into 15 individual frames used as the starting point for video generation.'
                : 'Note: Confirming will slice this grid into 9 individual frames used as the starting point for video generation.'}
            </p>
          </div>
        )}

        {step === 'production' && fullScript && (
          <Production
            script={fullScript}
            frames={frameUrls}
            generatedVideos={generatedVideos}
            generatingVideoIds={[...generatingVideoIds, ...pendingVideoSceneIds]}
            masterAudioUrl={masterAudioUrl}
            backgroundMusicUrl={backgroundMusicUrl}
            isGeneratingAudio={isGeneratingAudio}
            isGeneratingMusic={isGeneratingMusic || hasPendingMusicTask}
            isGeneratingFullMovie={isGeneratingFullMovie}
            onGenerateVideo={handleGenerateVideo}
            onGenerateFullMovie={handleGenerateFullMovie}
            onBackToStoryboard={async () => {
              await updateProjectStatus({ projectId, status: 'storyboarding' });
            }}
            aspectRatio={project.aspectRatio as AspectRatio}
            videoModel={project.videoModel as VideoModel}
            voiceMode={project.voiceMode as VoiceMode}
            enableCuts={project.enableCuts}
            seedanceAudio={project.seedanceAudio}
            seedanceResolution={project.seedanceResolution}
            seedanceDuration={(project.seedanceDuration ?? 4) as SeedanceDuration}
            originalPrompt={project.originalPrompt}
            characterRefs={project.characterRefs}
          />
        )}
      </main>
    </div>
  );
}

'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id, Doc } from '../../convex/_generated/dataModel';
import InputForm from '@/components/InputForm';
import Production from '@/components/Production';
import ProjectLayout, { ProjectStep } from '@/components/project/ProjectLayout';
import InputStep from '@/components/project/steps/InputStep';
import StoryboardStep from '@/components/project/steps/StoryboardStep';
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
  const step: ProjectStep = project.status === 'draft' || project.status === 'scripting' ? 'input'
             : project.status === 'storyboarding' ? 'storyboard'
             : 'production';

  // Step change handler for sidebar navigation
  const handleStepChange = useCallback(async (newStep: ProjectStep) => {
    if (newStep === step) return;

    const statusMap: Record<ProjectStep, string> = {
      'input': 'draft',
      'storyboard': 'storyboarding',
      'production': 'production',
    };

    await updateProjectStatus({ projectId, status: statusMap[newStep] });
  }, [step, projectId, updateProjectStatus]);

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
      console.log('[Regenerate] Generating new storyboard...', { totalScenes, aspectRatio: project.aspectRatio });

      const storyboardBase64 = await generateStoryboard(fullScript, flattenRefImages(refImagesRef.current), project.aspectRatio as AspectRatio, totalScenes);
      console.log('[Regenerate] Storyboard generated, uploading to R2...');

      const storyboardUrl = await uploadImageToR2(storyboardBase64);
      console.log('[Regenerate] Uploaded to R2:', storyboardUrl);

      if (storyboard1) {
        console.log('[Regenerate] Updating storyboard in Convex...');
        await updateStoryboard({ storyboardId: storyboard1._id, imageUrl: storyboardUrl });
        console.log('[Regenerate] Storyboard updated successfully');
      } else {
        console.warn('[Regenerate] No storyboard1 found to update');
      }

      setIsGeneratingStoryboard1(false);
    } catch (error) {
      console.error('[Regenerate] Error:', error);
      alert(`Failed to regenerate storyboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  // Compute completion states for step indicator
  const hasScript = !!fullScript;
  const hasStoryboard = !!storyboard1?.imageUrl;
  const hasFrames = !!(frames && frames.length > 0);
  const totalScenes = project.videoModel === 'seedance-1.5' ? (project.seedanceSceneCount || 15) : 9;
  const hasAllVideos = Object.keys(generatedVideos).length >= totalScenes;

  return (
    <ProjectLayout
      currentStep={step}
      onStepChange={handleStepChange}
      projectTitle={project.title || 'Untitled Project'}
      projectPrompt={project.originalPrompt}
      settings={{
        videoModel: project.videoModel as VideoModel,
        aspectRatio: project.aspectRatio as AspectRatio,
        voiceMode: (project.voiceMode ?? 'tts') as VoiceMode,
        seedanceSceneCount: project.seedanceSceneCount,
      }}
      hasScript={hasScript}
      hasStoryboard={hasStoryboard}
      hasFrames={hasFrames}
      hasAllVideos={hasAllVideos}
      isGeneratingScript={isGeneratingScript}
      isGeneratingStoryboard={isGeneratingStoryboard1 || isGeneratingStoryboard2}
      onBackToProjects={() => window.location.href = '/'}
    >
      {/* Step 1: Input */}
      {step === 'input' && (
        <InputStep
          script={fullScript}
          isGeneratingScript={isGeneratingScript}
          isGeneratingStoryboard={isGeneratingStoryboard1}
        >
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
        </InputStep>
      )}

      {/* Step 2: Storyboard */}
      {step === 'storyboard' && (
        <StoryboardStep
          storyboardUrl={storyboard1?.imageUrl || null}
          storyboardUrl2={storyboard2?.imageUrl || null}
          isGeneratingStoryboard={isGeneratingStoryboard1 || isGeneratingStoryboard2}
          isConfirming={isConfirming}
          videoModel={project.videoModel as VideoModel}
          seedanceSceneCount={project.seedanceSceneCount}
          onRegenerate={handleRegenerateStoryboard1}
          onConfirm={handleConfirmStoryboard}
        />
      )}

      {/* Step 3: Production */}
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
          onBackToStoryboard={() => handleStepChange('storyboard')}
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
    </ProjectLayout>
  );
}

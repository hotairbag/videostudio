import { Scene, AspectRatio, VideoModel, Character } from "@/types";
import { getCanvasDimensions } from "./imageUtils";

/**
 * Renders a caption overlay on the canvas for the current scene.
 * Shows speaker name (if single speaker, not narrator) above dialogue text.
 * Style matches reference: dark rounded background, speaker name smaller/lighter.
 */
function renderCaption(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  canvasWidth: number,
  canvasHeight: number
): void {
  // Get text content - prefer dialogue array, fall back to voiceoverText
  const dialogueLines = scene.dialogue || [];
  const text = dialogueLines.length > 0
    ? dialogueLines.map(d => d.text).join(' ')
    : scene.voiceoverText;

  if (!text || text.trim().length === 0) return;

  // Only show speaker name if SINGLE speaker and not narrator
  let speakerName = '';
  if (dialogueLines.length === 1 && dialogueLines[0].speaker && dialogueLines[0].speaker !== 'narrator') {
    speakerName = dialogueLines[0].speaker;
  }

  // Style constants matching reference screenshot
  const padding = 20;
  const margin = 40;
  const maxWidth = canvasWidth - (margin * 2);
  const fontSize = Math.round(canvasHeight * 0.035); // ~25px for 720p
  const nameSize = Math.round(fontSize * 0.7);
  const lineHeight = fontSize * 1.4;
  const radius = 12;

  // Setup font for text measurement
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

  // Wrap text to fit within maxWidth
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;
    if (testWidth > maxWidth - padding * 2) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  // Calculate box dimensions
  const textHeight = lines.length * lineHeight;
  const nameHeight = speakerName ? nameSize + 8 : 0;
  const boxHeight = textHeight + nameHeight + padding * 2;

  // Calculate box width based on widest line
  let maxLineWidth = 0;
  for (const line of lines) {
    const lineWidth = ctx.measureText(line).width;
    if (lineWidth > maxLineWidth) maxLineWidth = lineWidth;
  }
  // Also consider speaker name width
  if (speakerName) {
    ctx.font = `${nameSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const nameWidth = ctx.measureText(speakerName).width;
    if (nameWidth > maxLineWidth) maxLineWidth = nameWidth;
  }

  const boxWidth = Math.min(maxLineWidth + padding * 2, maxWidth);
  const boxX = (canvasWidth - boxWidth) / 2;
  const boxY = canvasHeight - boxHeight - margin;

  // Draw rounded rectangle background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxWidth, boxHeight, radius);
  ctx.fill();

  // Draw speaker name (if exists) - smaller, lighter
  let textY = boxY + padding;
  if (speakerName) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = `${nameSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(speakerName, boxX + padding, textY + nameSize);
    textY += nameSize + 8;
  }

  // Draw dialogue text - larger, white
  ctx.fillStyle = '#ffffff';
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  for (const line of lines) {
    ctx.fillText(line, boxX + padding, textY + fontSize);
    textY += lineHeight;
  }
}

// Video duration per clip based on model
// Veo generates ~8 second videos
// Seedance generates ~4 second videos
const VIDEO_DURATION_BY_MODEL: Record<VideoModel, number> = {
  'veo-3.1': 8,
  'seedance-1.5': 4,
};

export const composeAndExportVideo = async (
  scenes: Scene[],
  videoUrls: Record<number, string>,
  masterAudioUrl: string | null,
  backgroundMusicUrl: string | null,
  onProgress: (msg: string) => void,
  aspectRatio: AspectRatio = '16:9',
  videoModel: VideoModel = 'veo-3.1',
  includeMusic: boolean = true,
  customClipDuration?: number,  // Override the model-based duration
  enableCaptions: boolean = false  // Render captions on video
): Promise<Blob> => {

  // Use custom duration if provided, otherwise fall back to model-based duration
  const clipDuration = customClipDuration ?? VIDEO_DURATION_BY_MODEL[videoModel];

  onProgress("Initializing compositor...");

  const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions(aspectRatio);
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Could not create canvas context");

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  const dest = audioCtx.createMediaStreamDestination();

  const loadAudio = async (url: string) => {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await audioCtx.decodeAudioData(arrayBuffer);
  };

  onProgress("Loading audio tracks...");
  let voiceBuffer: AudioBuffer | null = null;
  if (masterAudioUrl) {
    voiceBuffer = await loadAudio(masterAudioUrl);
  }

  let musicBuffer: AudioBuffer | null = null;
  if (includeMusic && backgroundMusicUrl) {
    try {
      musicBuffer = await loadAudio(backgroundMusicUrl);
    } catch (e) {
      console.warn("Failed to load music for export", e);
    }
  }

  // Debug: Log video URL mapping
  const scenesWithVideoUrls = scenes.filter(s => videoUrls[s.id]);
  console.log(`[Export] Found ${scenesWithVideoUrls.length} scenes with video URLs:`,
    scenesWithVideoUrls.map(s => ({ id: s.id, hasUrl: !!videoUrls[s.id] })));
  console.log(`[Export] Video URL keys:`, Object.keys(videoUrls));

  onProgress(`Pre-loading ${scenesWithVideoUrls.length} video scenes...`);
  const videoElements: Record<number, HTMLVideoElement> = {};
  const videoAudioSources: Record<number, { source: MediaElementAudioSourceNode; gain: GainNode }> = {};

  const loadVideo = (id: number, url: string): Promise<HTMLVideoElement> => {
    return new Promise((resolve, reject) => {
      const vid = document.createElement('video');
      vid.crossOrigin = "anonymous";
      // Always use proxy during export to avoid CORS issues when drawing to canvas
      // The proxy handles R2, Seedance/Kie.ai, and other allowed video sources
      const proxyUrl = `/api/proxy-video?url=${encodeURIComponent(url)}`;
      vid.src = proxyUrl;
      vid.playsInline = true;
      vid.preload = "auto";
      // Note: Do NOT mute - we capture audio via MediaElementAudioSourceNode
      vid.oncanplaythrough = () => {
        console.log(`[Export] Video ${id} loaded successfully, duration: ${vid.duration}s`);
        resolve(vid);
      };
      vid.onerror = (e) => {
        console.error(`[Export] Failed to load video ${id}:`, e);
        reject(e);
      };
      vid.load();
    });
  };

  await Promise.all(scenes.map(async (scene) => {
    if (videoUrls[scene.id]) {
      let vid: HTMLVideoElement;
      try {
        vid = await loadVideo(scene.id, videoUrls[scene.id]);
        videoElements[scene.id] = vid;
      } catch (loadError) {
        console.error(`[Export] Skipping scene ${scene.id} due to load error:`, loadError);
        return; // Continue with other videos
      }

      // Create audio source from video element for SFX mixing
      try {
        const source = audioCtx.createMediaElementSource(vid);
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 0; // Start muted, we'll unmute when scene is active
        source.connect(gainNode);
        gainNode.connect(dest);
        videoAudioSources[scene.id] = { source, gain: gainNode };
      } catch (e) {
        console.warn(`Could not create audio source for scene ${scene.id}`, e);
      }
    }
  }));

  // Log final video count
  const loadedVideoCount = Object.keys(videoElements).length;
  console.log(`[Export] Successfully loaded ${loadedVideoCount} videos for export`);

  const canvasStream = canvas.captureStream(30);
  const audioTrack = dest.stream.getAudioTracks()[0];
  if (audioTrack) canvasStream.addTrack(audioTrack);

  // Use higher bitrate for better quality export
  // VP9 with opus audio, 8Mbps video bitrate for high quality
  const recorderOptions: MediaRecorderOptions = {
    mimeType: 'video/webm;codecs=vp9,opus',
    videoBitsPerSecond: 8000000, // 8 Mbps for high quality
    audioBitsPerSecond: 192000,  // 192 kbps audio
  };
  const recorder = new MediaRecorder(canvasStream, recorderOptions);

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  // Filter to only scenes that have videos
  const scenesWithVideo = scenes.filter(s => videoUrls[s.id]);

  // Total duration = max(voiceover, all videos)
  // Video duration depends on model: Veo ~8s, Seedance ~4s
  const totalVideoDuration = scenesWithVideo.length * clipDuration;
  const voiceDuration = voiceBuffer?.duration || 0;
  const totalDuration = Math.max(voiceDuration, totalVideoDuration);

  // Voice at full volume (if available)
  let voiceNode: AudioBufferSourceNode | null = null;
  if (voiceBuffer) {
    voiceNode = audioCtx.createBufferSource();
    voiceNode.buffer = voiceBuffer;
    const voiceGain = audioCtx.createGain();
    voiceGain.gain.value = 1.0;
    voiceNode.connect(voiceGain);
    voiceGain.connect(dest);
  }

  // Background music at 20% volume
  if (musicBuffer) {
    const musicNode = audioCtx.createBufferSource();
    musicNode.buffer = musicBuffer;
    musicNode.loop = true;
    const musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.2;
    musicNode.connect(musicGain);
    musicGain.connect(dest);
    musicNode.start(0);
  }

  // SFX volume level (40% to not overpower voiceover)
  const SFX_VOLUME = 0.4;

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      onProgress("Finalizing file...");
      const blob = new Blob(chunks, { type: 'video/webm' });
      audioCtx.close();
      resolve(blob);
    };

    recorder.onerror = reject;

    recorder.start();
    if (voiceNode) voiceNode.start(0);
    const startTime = performance.now();

    let animationFrameId: number;
    let lastSceneIndex: number = -1;
    // Track which scenes have already played their video (to prevent looping)
    const sceneVideoPlayed = new Set<number>();

    const renderLoop = () => {
      const now = (performance.now() - startTime) / 1000;

      if (now >= totalDuration) {
        recorder.stop();
        cancelAnimationFrame(animationFrameId);
        return;
      }

      // Calculate current scene based on video timing
      const sceneIndex = Math.min(
        Math.floor(now / clipDuration),
        scenesWithVideo.length - 1
      );
      const currentScene = scenesWithVideo[sceneIndex];

      if (!currentScene) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        animationFrameId = requestAnimationFrame(renderLoop);
        return;
      }

      // Detect scene change
      const sceneChanged = sceneIndex !== lastSceneIndex;
      if (sceneChanged) {
        lastSceneIndex = sceneIndex;
        // Reset the "played" flag for this scene so it can play
        // (in case we're re-entering a scene, though unlikely in linear playback)

        // Switch scene audio: unmute current, mute others
        for (const [idStr, audioData] of Object.entries(videoAudioSources)) {
          const id = Number(idStr);
          if (id === currentScene.id) {
            audioData.gain.gain.setValueAtTime(SFX_VOLUME, audioCtx.currentTime);
          } else {
            audioData.gain.gain.setValueAtTime(0, audioCtx.currentTime);
          }
        }

        // Pause all other videos and start the current one
        Object.entries(videoElements).forEach(([idStr, v]) => {
          const id = Number(idStr);
          if (id !== currentScene.id && !v.paused) {
            v.pause();
          }
        });
      }

      const vid = videoElements[currentScene.id];
      if (vid) {
        // Only start the video if it hasn't played for this scene yet
        if (vid.paused && !sceneVideoPlayed.has(sceneIndex)) {
          vid.currentTime = 0; // Always start from beginning when entering a new scene
          vid.play().catch((err) => {
            console.warn('Video play failed:', err);
          });
        }

        // Mark as played when video ends (don't restart it)
        if (vid.ended && !sceneVideoPlayed.has(sceneIndex)) {
          sceneVideoPlayed.add(sceneIndex);
          // Keep the last frame displayed - don't do anything, just let drawImage use the last frame
        }

        // Draw video frame to canvas (works even when paused/ended - shows last frame)
        try {
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        } catch (err) {
          console.warn('drawImage failed:', err);
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Render captions on top of video if enabled
        if (enableCaptions) {
          renderCaption(ctx, currentScene, canvas.width, canvas.height);
        }
      } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      onProgress(`Rendering: ${(now / totalDuration * 100).toFixed(0)}%`);
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();
  });
};

import { Scene, AspectRatio, VideoModel } from "@/types";
import { getCanvasDimensions } from "./imageUtils";

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
  videoModel: VideoModel = 'veo-3.1'
): Promise<Blob> => {

  const clipDuration = VIDEO_DURATION_BY_MODEL[videoModel];

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
  if (backgroundMusicUrl) {
    try {
      musicBuffer = await loadAudio(backgroundMusicUrl);
    } catch (e) {
      console.warn("Failed to load music for export", e);
    }
  }

  onProgress("Pre-loading video scenes...");
  const videoElements: Record<number, HTMLVideoElement> = {};
  const videoAudioSources: Record<number, { source: MediaElementAudioSourceNode; gain: GainNode }> = {};

  const loadVideo = (id: number, url: string): Promise<HTMLVideoElement> => {
    return new Promise((resolve, reject) => {
      const vid = document.createElement('video');
      vid.crossOrigin = "anonymous";
      // Use proxy for R2 videos to avoid CORS issues during export
      const proxyUrl = url.startsWith('https://video-studio.jarwater.com/')
        ? `/api/proxy-video?url=${encodeURIComponent(url)}`
        : url;
      vid.src = proxyUrl;
      vid.playsInline = true;
      vid.preload = "auto";
      // Note: Do NOT mute - we capture audio via MediaElementAudioSourceNode
      vid.oncanplaythrough = () => resolve(vid);
      vid.onerror = (e) => {
        console.error(`Failed to load video ${id}:`, e);
        reject(e);
      };
      vid.load();
    });
  };

  await Promise.all(scenes.map(async (scene) => {
    if (videoUrls[scene.id]) {
      const vid = await loadVideo(scene.id, videoUrls[scene.id]);
      videoElements[scene.id] = vid;

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
    let lastSceneId: number | null = null;

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

      // Switch scene audio: unmute current, mute others
      if (currentScene.id !== lastSceneId) {
        for (const [idStr, audioData] of Object.entries(videoAudioSources)) {
          const id = Number(idStr);
          if (id === currentScene.id) {
            audioData.gain.gain.setValueAtTime(SFX_VOLUME, audioCtx.currentTime);
          } else {
            audioData.gain.gain.setValueAtTime(0, audioCtx.currentTime);
          }
        }
        lastSceneId = currentScene.id;
      }

      const vid = videoElements[currentScene.id];
      if (vid) {
        if (vid.paused) {
          // Reset video to start if it ended
          if (vid.ended) {
            vid.currentTime = 0;
          }
          vid.play().catch((err) => {
            console.warn('Video play failed:', err);
          });
          // Pause other videos
          Object.values(videoElements).forEach(v => {
            if (v !== vid && !v.paused) v.pause();
          });
        }
        // Draw video frame to canvas
        try {
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        } catch (err) {
          console.warn('drawImage failed:', err);
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
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

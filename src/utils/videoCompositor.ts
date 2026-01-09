import { Scene, AspectRatio, VideoModel } from "@/types";

// Video duration per clip based on model
const VIDEO_DURATION_BY_MODEL: Record<VideoModel, number> = {
  'veo-3.1': 8,
  'seedance-1.5': 4,
};

// Singleton FFmpeg instance (typed as any to avoid importing at module level)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ffmpeg: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ffmpegLoading: Promise<any> | null = null;

/**
 * Load FFmpeg with dynamic imports to avoid SSR/edge runtime issues
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadFFmpeg = async (onProgress: (msg: string) => void): Promise<any> => {
  if (ffmpeg && ffmpeg.loaded) {
    return ffmpeg;
  }

  if (ffmpegLoading) {
    await ffmpegLoading;
    return ffmpeg!;
  }

  // Dynamic import to avoid SSR issues
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');

  ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ message }: { message: string }) => {
    console.log('[FFmpeg]', message);
  });

  ffmpeg.on('progress', ({ progress }: { progress: number }) => {
    if (progress > 0 && progress <= 1) {
      onProgress(`Encoding: ${Math.round(progress * 100)}%`);
    }
  });

  ffmpegLoading = (async () => {
    onProgress("Loading FFmpeg (first time may take a moment)...");

    // Use CDN for FFmpeg core files - UMD version for better compatibility
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

    await ffmpeg!.load({
      coreURL: `${baseURL}/ffmpeg-core.js`,
      wasmURL: `${baseURL}/ffmpeg-core.wasm`,
    });
  })();

  await ffmpegLoading;
  ffmpegLoading = null;

  return ffmpeg;
};

/**
 * Get caption text for a scene
 */
const getCaptionText = (scene: Scene): { speaker: string; text: string } | null => {
  const dialogueLines = scene.dialogue || [];
  const text = dialogueLines.length > 0
    ? dialogueLines.map(d => d.text).join(' ')
    : scene.voiceoverText;

  if (!text || text.trim().length === 0) return null;

  // Only show speaker name if SINGLE speaker and not narrator
  let speaker = '';
  if (dialogueLines.length === 1 && dialogueLines[0].speaker && dialogueLines[0].speaker !== 'narrator') {
    speaker = dialogueLines[0].speaker;
  }

  return { speaker, text: text.trim() };
};

/**
 * Escape text for FFmpeg drawtext filter
 */
const escapeDrawText = (text: string): string => {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "'\\''")
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/%/g, '\\%');
};

// Font file name for captions (loaded into FFmpeg filesystem)
const FONT_FILE = 'font.ttf';
// Roboto font from Google Fonts CDN (has CORS headers)
const FONT_URL = 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf';

/**
 * Build drawtext filter for captions
 */
const buildCaptionFilter = (
  scenes: Scene[],
  clipDuration: number,
  width: number,
  height: number
): string => {
  const filters: string[] = [];
  const fontSize = Math.round(height * 0.025);
  const nameSize = Math.round(fontSize * 0.75);
  const boxPadding = 16;
  const bottomMargin = 30;

  scenes.forEach((scene, index) => {
    const caption = getCaptionText(scene);
    if (!caption) return;

    const startTime = index * clipDuration;
    const endTime = (index + 1) * clipDuration;
    const yPosition = height - bottomMargin - fontSize * 2;

    // Draw speaker name if present (with font file)
    if (caption.speaker) {
      filters.push(
        `drawtext=fontfile=${FONT_FILE}:text='${escapeDrawText(caption.speaker)}':fontsize=${nameSize}:fontcolor=white@0.7:x=(w-tw)/2:y=${yPosition - fontSize}:enable='between(t,${startTime},${endTime})'`
      );
    }

    // Draw main caption text (with font file)
    filters.push(
      `drawtext=fontfile=${FONT_FILE}:text='${escapeDrawText(caption.text)}':fontsize=${fontSize}:fontcolor=white:x=(w-tw)/2:y=${yPosition}:enable='between(t,${startTime},${endTime})'`
    );
  });

  return filters.join(',');
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
  customClipDuration?: number,
  enableCaptions: boolean = false
): Promise<Blob> => {
  const clipDuration = customClipDuration ?? VIDEO_DURATION_BY_MODEL[videoModel];

  // Dynamic import fetchFile to avoid SSR issues
  const { fetchFile } = await import('@ffmpeg/util');

  // Load FFmpeg
  const ff = await loadFFmpeg(onProgress);

  // Filter scenes with videos
  const scenesWithVideo = scenes.filter(s => videoUrls[s.id]);
  if (scenesWithVideo.length === 0) {
    throw new Error("No videos to export");
  }

  onProgress(`Downloading ${scenesWithVideo.length} video clips...`);

  // Download all video files
  const videoFiles: { name: string; scene: Scene }[] = [];
  for (let i = 0; i < scenesWithVideo.length; i++) {
    const scene = scenesWithVideo[i];
    const url = videoUrls[scene.id];
    const proxyUrl = `/api/proxy-video?url=${encodeURIComponent(url)}`;

    onProgress(`Downloading video ${i + 1}/${scenesWithVideo.length}...`);

    try {
      const data = await fetchFile(proxyUrl);
      const fileName = `video_${i}.mp4`;
      await ff.writeFile(fileName, data);
      videoFiles.push({ name: fileName, scene });
    } catch (err) {
      console.error(`Failed to download video ${scene.id}:`, err);
      throw new Error(`Failed to download video for scene ${scene.id}`);
    }
  }

  // Download audio files
  let hasVoiceover = false;
  let hasMusic = false;

  if (masterAudioUrl) {
    onProgress("Downloading voiceover...");
    try {
      const voiceData = await fetchFile(masterAudioUrl);
      await ff.writeFile('voiceover.mp3', voiceData);
      hasVoiceover = true;
    } catch (err) {
      console.warn("Failed to download voiceover:", err);
    }
  }

  if (includeMusic && backgroundMusicUrl) {
    onProgress("Downloading background music...");
    try {
      const musicData = await fetchFile(backgroundMusicUrl);
      await ff.writeFile('music.mp3', musicData);
      hasMusic = true;
    } catch (err) {
      console.warn("Failed to download music:", err);
    }
  }

  // Download font for captions if enabled
  let hasFont = false;
  if (enableCaptions) {
    onProgress("Downloading font for captions...");
    try {
      const fontData = await fetchFile(FONT_URL);
      await ff.writeFile(FONT_FILE, fontData);
      hasFont = true;
    } catch (err) {
      console.warn("Failed to download font:", err);
    }
  }

  // Create concat file for video concatenation
  onProgress("Preparing video concatenation...");
  const concatContent = videoFiles.map(v => `file '${v.name}'`).join('\n');
  await ff.writeFile('concat.txt', concatContent);

  // Calculate dimensions
  const width = aspectRatio === '16:9' ? 1280 : 720;
  const height = aspectRatio === '16:9' ? 720 : 1280;
  const totalDuration = scenesWithVideo.length * clipDuration;

  // Build FFmpeg command
  onProgress("Encoding video...");

  // Step 1: Concatenate videos
  await ff.exec([
    '-f', 'concat',
    '-safe', '0',
    '-i', 'concat.txt',
    '-c', 'copy',
    'concatenated.mp4'
  ]);

  // Build filter complex for audio mixing and captions
  let filterComplex = '';
  let audioInputs: string[] = [];
  let inputIndex = 0;

  // Input 0: concatenated video
  const ffmpegArgs: string[] = ['-i', 'concatenated.mp4'];
  inputIndex++;

  // Input 1: voiceover (if exists)
  if (hasVoiceover) {
    ffmpegArgs.push('-i', 'voiceover.mp3');
    audioInputs.push(`[${inputIndex}:a]volume=1.0[voice]`);
    inputIndex++;
  }

  // Input 2: music (if exists)
  if (hasMusic) {
    ffmpegArgs.push('-i', 'music.mp3');
    // Loop music to match video duration
    audioInputs.push(`[${inputIndex}:a]aloop=loop=-1:size=2e+09,atrim=0:${totalDuration},volume=0.2[music]`);
    inputIndex++;
  }

  // Build audio mix filter
  let audioMix = '';
  if (hasVoiceover && hasMusic) {
    filterComplex = `${audioInputs.join(';')};[voice][music]amix=inputs=2:duration=longest[aout]`;
    audioMix = '[aout]';
  } else if (hasVoiceover) {
    filterComplex = audioInputs[0];
    audioMix = '[voice]';
  } else if (hasMusic) {
    filterComplex = audioInputs[0];
    audioMix = '[music]';
  }

  // Add caption filter if enabled and font is available
  let videoFilter = '';
  if (enableCaptions && hasFont) {
    const captionFilter = buildCaptionFilter(scenesWithVideo, clipDuration, width, height);
    if (captionFilter) {
      videoFilter = captionFilter;
    }
  }

  // Build final FFmpeg command
  const outputArgs: string[] = [];

  if (filterComplex || videoFilter) {
    let fullFilter = '';

    if (videoFilter && filterComplex) {
      // Both video and audio filters
      fullFilter = `[0:v]${videoFilter}[vout];${filterComplex}`;
      outputArgs.push('-filter_complex', fullFilter);
      outputArgs.push('-map', '[vout]');
      outputArgs.push('-map', audioMix);
    } else if (videoFilter) {
      // Only video filter (captions)
      outputArgs.push('-vf', videoFilter);
      outputArgs.push('-map', '0:v');
      outputArgs.push('-map', '0:a?'); // Copy audio from video if exists
    } else if (filterComplex) {
      // Only audio filter
      outputArgs.push('-filter_complex', filterComplex);
      outputArgs.push('-map', '0:v');
      outputArgs.push('-map', audioMix);
    }
  } else {
    // No filters, just copy
    outputArgs.push('-c', 'copy');
  }

  // Output settings
  outputArgs.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-y',
    'output.mp4'
  );

  // Execute final encoding
  await ff.exec([...ffmpegArgs, ...outputArgs]);

  // Read output file
  onProgress("Finalizing...");
  const outputData = await ff.readFile('output.mp4');

  // Clean up files
  const filesToDelete = [
    'concat.txt',
    'concatenated.mp4',
    'output.mp4',
    ...videoFiles.map(v => v.name)
  ];
  if (hasVoiceover) filesToDelete.push('voiceover.mp3');
  if (hasMusic) filesToDelete.push('music.mp3');
  if (hasFont) filesToDelete.push(FONT_FILE);

  for (const file of filesToDelete) {
    try {
      await ff.deleteFile(file);
    } catch {
      // Ignore cleanup errors
    }
  }

  // Return as Blob
  return new Blob([outputData], { type: 'video/mp4' });
};

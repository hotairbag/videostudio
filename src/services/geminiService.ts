import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Scene, Script, AspectRatio } from "@/types";

declare global {
  interface Window {
    __GOOGLE_API_KEY__?: string;
  }
}

export const setApiKey = (key: string) => {
  if (typeof window !== 'undefined') {
    window.__GOOGLE_API_KEY__ = key;
  }
};

export const getApiKey = (): string | undefined => {
  // Priority: 1. Window global (manual entry), 2. Environment variable
  if (typeof window !== 'undefined' && window.__GOOGLE_API_KEY__) {
    return window.__GOOGLE_API_KEY__;
  }
  return process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
};

const getClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key not found. Please set NEXT_PUBLIC_GOOGLE_API_KEY in .env.local or enter manually.");
  return new GoogleGenAI({ apiKey });
};

// Safety settings to disable content filters for creative content generation
const safetySettings = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
] as const;

// Enhanced error handling for API calls
const handleApiError = (error: unknown, context: string): never => {
  console.error(`[${context}] API Error:`, error);

  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    throw new Error(
      `Network error during ${context}. Possible causes:\n` +
      `• Check your internet connection\n` +
      `• Browser extensions (ad blockers) may be blocking Google APIs\n` +
      `• API rate limit exceeded - wait a moment and try again\n` +
      `• VPN/proxy interference`
    );
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (msg.includes('401') || msg.includes('unauthorized')) {
      throw new Error(`Invalid API key. Please check your NEXT_PUBLIC_GOOGLE_API_KEY.`);
    }
    if (msg.includes('403') || msg.includes('forbidden')) {
      throw new Error(`API access forbidden. Your API key may not have access to this model, or billing is not enabled.`);
    }
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('quota')) {
      throw new Error(`Rate limit exceeded. Please wait a moment and try again.`);
    }
    if (msg.includes('500') || msg.includes('internal server')) {
      throw new Error(`Google API server error. Please try again in a few moments.`);
    }
    if (msg.includes('503') || msg.includes('unavailable')) {
      throw new Error(`Google API temporarily unavailable. Please try again later.`);
    }

    throw new Error(`${context} failed: ${error.message}`);
  }

  throw new Error(`${context} failed with unknown error`);
};

export const generateScript = async (
  prompt: string,
  referenceVideoBase64?: string,
  referenceImagesBase64?: string[]
): Promise<Script> => {
  const ai = getClient();
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  if (referenceVideoBase64) {
    parts.push({
      inlineData: {
        mimeType: "video/mp4",
        data: referenceVideoBase64,
      },
    });
    parts.push({ text: "Analyze this video to extract its style, pacing, and content structure." });
  }

  if (referenceImagesBase64 && referenceImagesBase64.length > 0) {
    for (let i = 0; i < referenceImagesBase64.length; i++) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: referenceImagesBase64[i],
        },
      });
    }
    const imageCount = referenceImagesBase64.length;
    parts.push({
      text: imageCount === 1
        ? "Use this image as a key visual reference for the art style and characters."
        : `Use these ${imageCount} images as visual references for the art style, characters, and scene elements. Maintain consistency with these references throughout all scenes.`
    });
  }

  const systemInstruction = `
    You are an expert film director and scriptwriter.
    Your goal is to create a production script for a ~72 second video (9 scenes × 8 seconds each).
    The script MUST be broken down into exactly 9 key scenes, as we will be generating a 3x3 storyboard grid.

    CRITICAL TIMING REQUIREMENT:
    - Each scene is EXACTLY 8 seconds long (this is fixed by the video generation model).
    - The timeRange for each scene MUST reflect 8-second intervals:
      Scene 1: "00:00 - 00:08", Scene 2: "00:08 - 00:16", Scene 3: "00:16 - 00:24",
      Scene 4: "00:24 - 00:32", Scene 5: "00:32 - 00:40", Scene 6: "00:40 - 00:48",
      Scene 7: "00:48 - 00:56", Scene 8: "00:56 - 01:04", Scene 9: "01:04 - 01:12"
    - Design the voiceoverText for each scene to be spoken naturally within 8 seconds (about 20-25 words max per scene).

    MULTI-SHOT SCENES WITH CUTS:
    Each scene's visualDescription MUST include 2-3 camera cuts using the [cut] tag to create dynamic, professional videos.
    Start with a base shot description, then add [cut] tags for different angles.

    Camera cut formulas to use:
    - [cut] close up shot of [character/object] - shows emotion or detail
    - [cut] over the shoulder shot - in front of the [character] - [what they're looking at]
    - [cut] insert shot of [item/detail], [camera movement like "camera moving right"]
    - [cut] aerial shot of [environment], view from above
    - [cut] low angle shot - [character + action]
    - [cut] front shot: [scene description]
    - [cut] shot from behind: [scene description]
    - [cut] dutch shot of [character + action] - for dynamic/tense moments

    Example visualDescription with cuts:
    "A chef prepares ingredients in a kitchen [cut] close up shot of hands chopping vegetables [cut] insert shot of sizzling pan, camera moving left [cut] over the shoulder shot - in front of the chef - the finished dish"

    Output strictly in JSON format.
    The 'scenes' array must have exactly 9 elements.
    Each scene needs:
    - id: Sequential number starting from 1.
    - timeRange: Must follow the 8-second intervals above.
    - visualDescription: Multi-shot description with 2-3 [cut] tags for camera angle changes. Make it dynamic!
    - audioDescription: SFX and atmosphere notes.
    - cameraShot: The PRIMARY shot type (e.g. Wide Shot, Medium Shot, Close Up) - the scene will have multiple angles via [cut] tags.
    - voiceoverText: The exact spoken dialogue/narration for this specific 8-second segment (20-25 words max).
  `;

  const userPrompt = `
    Create a video production script based on the following request: "${prompt}".

    If a reference video was provided, replicate its style, tone, and structure but adapted to the user's prompt.
    If no prompt is detailed, use the reference video as the ground truth.

    Ensure the script has a cohesive narrative arc.
  `;

  parts.push({ text: userPrompt });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        safetySettings,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            style: { type: Type.STRING },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  timeRange: { type: Type.STRING },
                  visualDescription: { type: Type.STRING },
                  audioDescription: { type: Type.STRING },
                  cameraShot: { type: Type.STRING },
                  voiceoverText: { type: Type.STRING },
                },
                required: ["id", "visualDescription", "voiceoverText", "cameraShot"],
              },
            },
          },
          required: ["title", "scenes"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No script generated");
    return JSON.parse(text) as Script;
  } catch (error) {
    handleApiError(error, "Script generation");
  }
};

export const generateStoryboard = async (script: Script, refImages?: string[], aspectRatio: AspectRatio = '16:9'): Promise<string> => {
  const ai = getClient();

  // Strip [cut] tags from visualDescription for storyboard - cuts are only for Veo video generation
  // Use only the base scene description (before first [cut]) for each panel
  const sceneDescriptions = script.scenes.map((s, i) => {
    const baseDescription = s.visualDescription.split('[cut]')[0].trim();
    return `Panel ${i + 1} (${s.cameraShot}): ${baseDescription}`;
  }).join("\n");

  // For 9:16 portrait mode, each panel is also 9:16
  const layoutDesc = aspectRatio === '9:16'
    ? 'Each panel must be 9:16 portrait orientation. The grid should be portrait-oriented overall.'
    : 'Each panel must be 16:9 landscape orientation. The grid should be landscape-oriented overall.';

  const prompt = `
    Art Style: ${script.style}

    Create a professional 3x3 cinematic storyboard grid containing exactly 9 panels for the following story.

    CRITICAL LAYOUT REQUIREMENTS:
    - The 9 panels must fill the ENTIRE image edge-to-edge with NO gaps, borders, or white space between them.
    - Each panel must be exactly 1/3 of the total width and 1/3 of the total height.
    - ${layoutDesc}
    - NO margins, padding, or frames around or between panels.
    - The panels must touch each other directly - seamless grid.

    Ensure consistent characters, lighting, and style across all 9 panels.
    ${refImages && refImages.length > 0 ? 'Use the provided reference image(s) for character designs, art style, and visual consistency.' : ''}

    Scenes:
    ${sceneDescriptions}

    Structure:
    Row 1: Establishing Context (Wide/Long shots)
    Row 2: Core Action (Medium shots)
    Row 3: Details & Angles (Close-ups, High/Low angles)
  `;

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{ text: prompt }];
  if (refImages && refImages.length > 0) {
    for (const refImage of refImages) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: refImage
        }
      });
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: { parts },
      config: {
        safetySettings,
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: "2K"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated in response");
  } catch (error) {
    handleApiError(error, "Storyboard generation");
  }
};

export const generateVideoForScene = async (
  scene: Scene,
  startFrameBase64: string,
  aspectRatio: AspectRatio = '16:9'
): Promise<string> => {
  const ai = getClient();
  const cleanBase64 = startFrameBase64.split(',')[1] || startFrameBase64;

  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `
        Visuals: ${scene.visualDescription}.
        Audio Atmosphere: ${scene.audioDescription}.

        PACING INSTRUCTION: The output video will be ~8 seconds long (fixed).
        This scene is exactly 8 seconds.
        CRITICAL: Ensure the primary action described happens IMMEDIATELY and concludes efficiently. Do not pad the start with static frames.

        AUDIO INSTRUCTIONS:
        - Include ambient sound effects matching the scene atmosphere.
        - NO MUSIC.
        - NO DIALOGUE or spoken words.

        Cinematic lighting, consistent style with input image.
      `,
      image: {
        imageBytes: cleanBase64,
        mimeType: 'image/png'
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio
      },
      safetySettings
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const opError = (operation as { error?: { message?: string; code?: string } }).error;
    if (opError) {
      throw new Error(`Video generation failed: ${opError.message || opError.code}`);
    }

    // Log full response for debugging
    const generatedVideos = operation.response?.generatedVideos;
    if (!generatedVideos || generatedVideos.length === 0) {
      const response = operation.response as { raiMediaFilteredCount?: number; raiMediaFilteredReasons?: string[] };
      console.error('[Veo] No videos in response:', JSON.stringify(operation.response, null, 2));

      // Check for content filter rejection
      if (response?.raiMediaFilteredCount && response?.raiMediaFilteredReasons?.length) {
        const reason = response.raiMediaFilteredReasons[0];
        throw new Error(`Content blocked by Veo safety filter: ${reason}`);
      }
      throw new Error("Video generation completed but no videos returned. This may be due to content filtering or API limits.");
    }

    const firstVideo = generatedVideos[0];
    if (firstVideo.video?.state === 'FAILED') {
      throw new Error(`Video generation failed: ${firstVideo.video.error?.message || 'Unknown error'}`);
    }

    const videoUri = firstVideo.video?.uri;
    if (!videoUri) {
      console.error('[Veo] Video object missing URI:', JSON.stringify(firstVideo, null, 2));
      throw new Error("Video generated but URI not available. The video may still be processing or was blocked by content filters.");
    }

    const apiKey = getApiKey();
    const response = await fetch(`${videoUri}&key=${apiKey}`);
    if (!response.ok) {
      throw new Error(`Failed to download generated video: ${response.statusText}`);
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    handleApiError(error, `Video generation for scene ${scene.id}`);
  }
};

export const generateMasterAudio = async (script: Script): Promise<string> => {
  const ai = getClient();
  const fullText = script.scenes.map(s => s.voiceoverText).join(" ... ");

  if (!fullText.trim()) return "";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: fullText }] }],
      config: {
        safetySettings,
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Fenrir' },
          },
        },
      },
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!audioPart?.data) throw new Error("No audio data in response");

    // Gemini TTS returns audio with mimeType in the response
    // Common formats: audio/L16 (PCM), audio/wav, audio/mpeg
    const mimeType = audioPart.mimeType || 'audio/wav';

    // If it's raw PCM (L16), we need to convert to WAV for browser playback
    if (mimeType.includes('L16') || mimeType.includes('pcm')) {
      // Convert PCM to WAV by adding WAV header
      const pcmData = Uint8Array.from(atob(audioPart.data), c => c.charCodeAt(0));
      const wavBlob = pcmToWav(pcmData, 24000, 1); // Gemini TTS uses 24kHz mono
      return URL.createObjectURL(wavBlob);
    }

    return `data:${mimeType};base64,${audioPart.data}`;
  } catch (error) {
    handleApiError(error, "Voiceover generation");
  }
};

// Convert raw PCM data to WAV format
function pcmToWav(pcmData: Uint8Array, sampleRate: number, numChannels: number): Blob {
  const bytesPerSample = 2; // 16-bit audio
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Copy PCM data
  const audioData = new Uint8Array(buffer, headerSize);
  audioData.set(pcmData);

  return new Blob([buffer], { type: 'audio/wav' });
}

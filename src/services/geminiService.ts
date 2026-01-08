import { GoogleGenAI, Type, Modality, HarmCategory, HarmBlockThreshold, SafetySetting } from "@google/genai";
import { Scene, Script, AspectRatio, VideoModel, SeedanceResolution, VoiceMode, Character, DialogueLine, GeminiVoice, GEMINI_VOICES } from "@/types";

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
const safetySettings: SafetySetting[] = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// Timeout wrapper for API calls
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, context: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${context} timed out after ${timeoutMs / 1000} seconds. Please try again.`)), timeoutMs)
    )
  ]);
};

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
  referenceImagesBase64?: string[],
  enableCuts: boolean = true,
  videoModel: VideoModel = 'veo-3.1',
  seedanceSceneCount: 9 | 15 = 15,
  multiCharacter: boolean = false,
  voiceMode: VoiceMode = 'tts',
  characterNames: string[] = [],
  language: string = 'english'
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

  // Seedance mode: configurable scenes (9 or 15) × 4 seconds
  // Veo mode: 9 scenes × 8 seconds = 72 seconds
  const isSeedance = videoModel === 'seedance-1.5';
  const sceneCount = isSeedance ? seedanceSceneCount : 9;
  const sceneDuration = isSeedance ? 4 : 8;
  const wordsPerScene = isSeedance ? 10 : 22; // ~10 words for 4s, ~22 words for 8s

  // Build time ranges
  const timeRanges = Array.from({ length: sceneCount }, (_, i) => {
    const start = i * sceneDuration;
    const end = start + sceneDuration;
    const formatTime = (s: number) => {
      const mins = Math.floor(s / 60);
      const secs = s % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    return `"${formatTime(start)} - ${formatTime(end)}"`;
  });

  // Build system instruction conditionally based on enableCuts and videoModel
  // CRITICAL: The start frame constraint - cuts can only show what's in the base description
  const startFrameConstraint = `
    CRITICAL START FRAME CONSTRAINT:
    The BASE description (text BEFORE any [cut] tags) becomes the storyboard image/start frame.
    The video generator ONLY knows what is visible in this starting image.

    RULE: [cut] tags can ONLY show things that are PRESENT in the base description.
    - If a character's FACE is NOT visible in the base description, you CANNOT cut to that character's face
    - If showing a hand on a doorknob (no face), you CANNOT [cut] to the character's face - it would be a random stranger
    - To show a character's face in a cut, their face MUST be visible in the base description

    SAFE cuts when character face is NOT in base description:
    - Insert shots of objects/items being interacted with
    - Close-ups of hands performing actions
    - Environment/scenery shots
    - Detail shots of props in the scene

    WRONG: "A hand reaches for the doorknob [cut] close up of John's determined face" (John's face not in start frame!)
    CORRECT: "John stands at the door, his hand on the doorknob [cut] close up of John's determined face" (face visible)
    CORRECT: "A hand reaches for the doorknob [cut] insert shot of the brass doorknob turning" (no face needed)
  `;

  // Seedance 1.5 Pro specific instructions based on the official prompt guide
  const seedanceCameraVocabulary = `
    SEEDANCE CAMERA MOVEMENT VOCABULARY (use these exact terms):
    - dolly-in / dolly-out: Camera physically moves toward/away from subject
    - pan left / pan right / pan up / pan down: Camera rotates on its axis
    - track / follow: Camera follows a moving subject
    - surround / orbit: Camera circles around the subject
    - rise / fall: Camera moves vertically
    - zoom-in / zoom-out: Lens focal length changes
    - Hitchcock zoom: dolly-out + zoom-in (or reverse) for dramatic effect
    - static shot: Camera remains fixed

    SEEDANCE SHOT SIZES:
    - wide shot / full shot: Shows full environment
    - medium shot: Subject from waist up
    - close-up: Face or detail
    - extreme close-up / big close-up: Very tight on feature
    - over-the-shoulder: Camera behind one character looking at another

    SEEDANCE CAMERA ANGLES:
    - eye-level: Camera at subject's eye height
    - high angle: Camera looks down at subject
    - low angle: Camera looks up at subject
    - bird's eye view: Directly overhead
    - Dutch angle: Camera tilted for tension
  `;

  let cutsInstructions: string;
  if (isSeedance) {
    // Seedance 1.5 Pro: Follow official prompt guide structure
    cutsInstructions = enableCuts ? `
    SEEDANCE 1.5 SHOT STRUCTURE (4-SECOND CLIPS):
    Use explicit "Shot 1:", "Shot 2:" format for multi-shot scenes.
    Maximum 2 shots per 4-second scene.

    FORMAT EXAMPLE:
    "Shot 1: Medium shot. A woman in a red dress stands by the window, soft light on her face. The camera performs a slow dolly-in.
    Shot 2: Cut to close-up of her eyes, showing subtle emotion as she turns toward camera."

    ${seedanceCameraVocabulary}
    ${startFrameConstraint}
    ` : `
    SEEDANCE 1.5 SINGLE-SHOT FORMAT (4-SECOND CLIPS):
    Each scene is ONE continuous shot with smooth camera movement.
    Follow the Seedance prompt formula: Subject + Movement + Environment + Camera movement + Aesthetic description

    FORMAT EXAMPLE:
    "Medium shot. A young woman with flowing black hair walks through a sunlit garden, her white dress swaying gently.
    Soft morning light filters through cherry blossom trees. The camera performs a slow lateral track, following her movement.
    Dreamy, ethereal atmosphere with bokeh highlights."

    ${seedanceCameraVocabulary}
    `;
  } else {
    // Veo: 8 second clips, can have 2-3 cuts
    cutsInstructions = enableCuts ? `
    MULTI-SHOT SCENES WITH CUTS:
    Each scene's visualDescription MUST include 2-3 camera cuts using the [cut] tag to create dynamic, professional videos.
    Start with a base shot description, then add [cut] tags for different angles.
    ${startFrameConstraint}

    Camera cut formulas to use (ONLY use face cuts if face is in base description!):
    - [cut] close up shot of [character] - shows emotion (ONLY if their face is in base description!)
    - [cut] over the shoulder shot - in front of the [character] - [what they're looking at]
    - [cut] insert shot of [item/detail], [camera movement like "camera moving right"]
    - [cut] aerial shot of [environment], view from above
    - [cut] low angle shot - [character + action]
    - [cut] front shot: [scene description]
    - [cut] shot from behind: [scene description]

    Example (character face in base):
    "A chef stands at the counter preparing ingredients [cut] close up of the chef's focused expression [cut] insert shot of sizzling pan"

    Example (NO character face in base):
    "Hands carefully arrange flowers in a vase [cut] insert shot of colorful petals [cut] wide shot of the completed arrangement"
    ` : `
    SINGLE-SHOT SCENES:
    Each scene's visualDescription should describe a SINGLE continuous shot with smooth camera movement.
    Focus on fluid motion and animation within a single camera perspective.
    Do NOT use [cut] tags - keep each scene as one uninterrupted take.
    Describe camera movements like "camera slowly pans right", "camera dollies forward", etc.
    `;
  }

  // IMPORTANT: The FIRST sentence of visualDescription is used for storyboard panel generation.
  // It must describe ONE clear moment/action without camera instructions.
  // Camera movements, cuts, and shot types come AFTER the first sentence for video generation.
  const visualDescriptionHint = isSeedance
    ? (enableCuts
        ? '- visualDescription: FIRST SENTENCE must describe ONE clear moment/action (no camera terms). Then use "Shot 1:" and "Shot 2:" format for camera movements. The first sentence becomes the storyboard panel image.'
        : '- visualDescription: FIRST SENTENCE must describe ONE clear moment/action (no camera terms). Then add camera movement details. The first sentence becomes the storyboard panel image.')
    : (enableCuts
        ? '- visualDescription: FIRST SENTENCE must describe ONE clear moment/action (no camera terms, no shot types). Then add [cut] tags for camera angle changes. The first sentence becomes the storyboard panel image.'
        : '- visualDescription: FIRST SENTENCE must describe ONE clear moment/action (no camera terms). Then add camera movement details. The first sentence becomes the storyboard panel image.');

  // Voice mode instructions
  const allVoices = [...GEMINI_VOICES.female, ...GEMINI_VOICES.male];
  const voiceListFemale = GEMINI_VOICES.female.join(', ');
  const voiceListMale = GEMINI_VOICES.male.join(', ');

  let voiceInstructions: string;
  let voiceSchemaHint: string;

  // Character names hint from reference images
  const characterNamesHint = characterNames.length > 0
    ? `\n    - The user has provided reference images for these characters: ${characterNames.join(', ')}. Use these exact names for the characters in the story.`
    : '';

  // Seedance-specific dialogue formatting with emotional state/tone/pace
  const seedanceDialogueFormat = isSeedance && voiceMode === 'speech_in_video' ? `
    SEEDANCE DIALOGUE FORMAT (for speech_in_video mode):
    Each dialogue entry should include emotional and vocal characteristics.
    Format each line with: emotional state, tone, speaking pace, then the actual dialogue.

    EMOTIONAL STATES: calm, gentle, restrained, forceful, confident, anxious, joyful, melancholic, angry, surprised, determined
    TONE OPTIONS: even, soft, low, firm, clear, warm, cold, playful, serious, sarcastic
    PACE OPTIONS: slow, normal, fast, very slow, measured, rapid

    EXAMPLE DIALOGUE FORMAT:
    - Speaker: "Hana", emotionalState: "gentle", tone: "soft", pace: "slow", text: "I've been waiting for you."
    - Speaker: "Ren", emotionalState: "restrained", tone: "low", pace: "measured", text: "I came as fast as I could."

    This will be rendered for Seedance as:
    "In a gentle emotional state, with a soft tone and a slow speaking pace, Hana says: 'I've been waiting for you.'"
  ` : '';

  if (multiCharacter) {
    // Multi-character dialogue mode
    voiceInstructions = `
    MULTI-CHARACTER DIALOGUE MODE:
    - Identify ALL speaking characters in the story (minimum 1, maximum 5 characters).${characterNamesHint}
    - For each character, select a unique voice from the available voices.
    - Available female voices: ${voiceListFemale}
    - Available male voices: ${voiceListMale}
    - Each character needs: id (unique string), name (display name), gender (male/female/neutral), voiceName (from available voices), voiceProfile (short 5-10 word description of their voice personality for consistent synthesis, e.g., "warm and gentle father figure" or "energetic young woman").
    - For each scene's dialogue, use an array of {speaker: "CharacterName", text: "what they say", emotionalState?: string, tone?: string, pace?: string} objects.
    - If there's narration (not spoken by a character), use speaker: "narrator".
    - The voiceoverText field should be the combined dialogue text for timing reference.
    ${seedanceDialogueFormat}
    ${voiceMode === 'speech_in_video' && !isSeedance ? `
    SPEECH IN VIDEO MODE:
    - The voiceProfile will be sent to the video generation model so characters have consistent voices.
    - Keep voiceProfiles concise but distinctive.
    ` : ''}
    `;
    voiceSchemaHint = `
    - characters: Array of {id, name, gender, voiceName, voiceProfile} for each speaking character.
    - For each scene's dialogue: Array of {speaker, text} pairs representing who says what in order.`;
  } else {
    // Single narrator voice mode - AI picks based on content
    voiceInstructions = `
    NARRATOR VOICE SELECTION:
    - Select ONE narrator voice that best fits the story's tone and content.
    - Available female voices: ${voiceListFemale}
    - Available male voices: ${voiceListMale}
    - Consider the story's mood (dramatic, cheerful, mysterious, romantic, etc.) when selecting.
    - For romantic/emotional content: consider softer voices like Aoede, Kore, Leda (female) or Achird, Enceladus (male).
    - For energetic/upbeat content: consider Zephyr, Despina (female) or Puck, Orus (male).
    - For dramatic/cinematic content: consider Gacrux, Sulafat (female) or Fenrir, Rasalgethi, Schedar (male).
    - For narration/documentary style: consider Vindemiatrix, Achernar (female) or Algenib, Algieba, Charon (male).
    `;
    voiceSchemaHint = `
    - narratorVoice: The selected voice name for the narrator (must be from the available voices list).`;
  }

  const gridDescription = isSeedance
    ? (sceneCount === 15
        ? 'The first 9 scenes will be a 3x3 storyboard grid, and scenes 10-15 will be a 3x2 grid (6 panels).'
        : 'All 9 scenes will be a single 3x3 storyboard grid.')
    : 'We will be generating a 3x3 storyboard grid.';

  // Critical narrative instruction: ending/logo/conclusion ONLY on the final scene
  const narrativeEndingInstruction = `
    CRITICAL NARRATIVE STRUCTURE:
    - The story conclusion, ending, logo reveal, call-to-action, or final message MUST ONLY appear in the LAST scene (Scene ${sceneCount}).
    - Scenes 1 through ${sceneCount - 1} should build the narrative - they should NOT contain any ending elements.
    - Do NOT put logos, brand reveals, "The End", or concluding visuals in any scene except the final one.
    - Scene ${sceneCount} is the ONLY scene that should wrap up the story.
  `;

  // Build language instruction - dialogue in selected language, visual descriptions always in English
  const languageUpper = language.toUpperCase();
  const languageInstruction = language === 'english'
    ? 'LANGUAGE REQUIREMENT: All content MUST be in ENGLISH only. Any text, signs, dialogue, or written content described in scenes must be in English - never Chinese or other languages.'
    : `LANGUAGE REQUIREMENT:
    - All dialogue, voiceoverText, and spoken content MUST be in ${languageUpper}.
    - The visualDescription and audioDescription fields must remain in ENGLISH (for the AI video generator to understand).
    - Any on-screen text, signs, or written content shown in scenes should be in ${languageUpper}.
    - Character names can stay in their original form.`;

  const systemInstruction = `
    You are an expert film director and scriptwriter.
    Your goal is to create a production script for a ~${sceneCount * sceneDuration} second video (${sceneCount} scenes × ${sceneDuration} seconds each).
    The script MUST be broken down into exactly ${sceneCount} key scenes. ${gridDescription}

    ${languageInstruction}
    ${narrativeEndingInstruction}

    CRITICAL TIMING REQUIREMENT:
    - Each scene is EXACTLY ${sceneDuration} seconds long (this is fixed by the video generation model).
    - The timeRange for each scene MUST reflect ${sceneDuration}-second intervals:
      ${timeRanges.slice(0, Math.min(5, sceneCount)).map((t, i) => `Scene ${i + 1}: ${t}`).join(', ')}${sceneCount > 5 ? `, ... Scene ${sceneCount}: ${timeRanges[sceneCount - 1]}` : ''}
    - Design the voiceoverText for each scene to be spoken naturally within ${sceneDuration} seconds (about ${wordsPerScene} words max per scene).
    ${cutsInstructions}
    ${voiceInstructions}
    Output strictly in JSON format.
    The 'scenes' array must have exactly ${sceneCount} elements.
    ${voiceSchemaHint}
    Each scene needs:
    - id: Sequential number starting from 1.
    - timeRange: Must follow the ${sceneDuration}-second intervals above.
    ${visualDescriptionHint}
    - audioDescription: SFX and atmosphere notes.
    - cameraShot: The PRIMARY shot type (e.g. Wide Shot, Medium Shot, Close Up).
    - voiceoverText: The exact spoken dialogue/narration for this specific ${sceneDuration}-second segment (${wordsPerScene} words max).
    ${multiCharacter
      ? (isSeedance && voiceMode === 'speech_in_video'
          ? '- dialogue: Array of {speaker, text, emotionalState?, tone?, pace?} for who says what with vocal characteristics.'
          : '- dialogue: Array of {speaker, text} pairs for who says what in this scene.')
      : ''}
  `;

  const userPrompt = `
    Create a video production script based on the following request: "${prompt}".

    If a reference video was provided, replicate its style, tone, and structure but adapted to the user's prompt.
    If no prompt is detailed, use the reference video as the ground truth.

    Ensure the script has a cohesive narrative arc across all ${sceneCount} scenes.
  `;

  parts.push({ text: userPrompt });

  try {
    // Build scene schema based on mode
    const sceneProperties: Record<string, { type: Type }> = {
      id: { type: Type.INTEGER },
      timeRange: { type: Type.STRING },
      visualDescription: { type: Type.STRING },
      audioDescription: { type: Type.STRING },
      cameraShot: { type: Type.STRING },
      voiceoverText: { type: Type.STRING },
    };

    // Add dialogue field for multi-character mode
    if (multiCharacter) {
      // For Seedance speech_in_video mode, include emotional/tone/pace fields
      const dialogueProperties: Record<string, { type: Type }> = {
        speaker: { type: Type.STRING },
        text: { type: Type.STRING },
      };

      // Add optional Seedance vocal characteristic fields
      if (isSeedance && voiceMode === 'speech_in_video') {
        dialogueProperties.emotionalState = { type: Type.STRING };
        dialogueProperties.tone = { type: Type.STRING };
        dialogueProperties.pace = { type: Type.STRING };
      }

      (sceneProperties as Record<string, unknown>).dialogue = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: dialogueProperties,
          required: ["speaker", "text"],
        },
      };
    }

    // Build root schema properties
    const rootProperties: Record<string, unknown> = {
      title: { type: Type.STRING },
      style: { type: Type.STRING },
      scenes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: sceneProperties,
          required: multiCharacter
            ? ["id", "visualDescription", "voiceoverText", "cameraShot", "dialogue"]
            : ["id", "visualDescription", "voiceoverText", "cameraShot"],
        },
      },
    };

    // Add narratorVoice for single-voice mode, characters for multi-character
    if (multiCharacter) {
      rootProperties.characters = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            gender: { type: Type.STRING },
            voiceName: { type: Type.STRING },
            voiceProfile: { type: Type.STRING },
          },
          required: ["id", "name", "gender", "voiceName"],
        },
      };
    } else {
      rootProperties.narratorVoice = { type: Type.STRING };
    }

    const response = await withTimeout(
      ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          safetySettings,
          // Note: Removed responseSchema for faster generation - JSON structure enforced via prompt
        },
      }),
      60000, // 60 second timeout - much faster without schema validation
      "Script generation"
    );

    const rawText = response.text;
    if (!rawText) throw new Error("No script generated");

    // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    let text = rawText.trim();
    if (text.startsWith('```')) {
      // Remove opening fence (```json or ```)
      const firstNewline = text.indexOf('\n');
      if (firstNewline !== -1) {
        text = text.substring(firstNewline + 1);
      }
      // Remove closing fence
      if (text.endsWith('```')) {
        text = text.substring(0, text.length - 3).trim();
      }
    }

    console.log(`[Script generation] Response length: ${rawText.length}, cleaned: ${text.length}`);

    try {
      let parsed = JSON.parse(text);

      // Handle array responses from Gemini
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Check if array contains scene objects directly (has id, visualDescription)
        if (parsed[0].id !== undefined && parsed[0].visualDescription) {
          console.log("[Script generation] Response is array of scenes, reconstructing script object");
          // Extract narratorVoice from first scene if present
          const narratorVoice = parsed[0].narratorVoice || 'Zephyr';
          // Clean scenes - remove narratorVoice from individual scenes
          const scenes = parsed.map((scene: Record<string, unknown>) => {
            const { narratorVoice: _, ...rest } = scene;
            return rest;
          });
          parsed = {
            title: 'Generated Script',
            style: 'cinematic',
            narratorVoice,
            scenes,
          };
        } else {
          // Array contains a script object, extract first element
          console.log("[Script generation] Response was wrapped in array, extracting first element");
          parsed = parsed[0];
        }
      }

      // Validate and extract script structure (handle various response formats)
      let script: Script;
      if (parsed.scenes && Array.isArray(parsed.scenes)) {
        // Direct format: {title, scenes, ...}
        script = parsed as Script;
      } else if (parsed.script && parsed.script.scenes) {
        // Wrapped format: {script: {title, scenes, ...}}
        script = parsed.script as Script;
      } else if (parsed.response && parsed.response.scenes) {
        // Another wrapped format: {response: {title, scenes, ...}}
        script = parsed.response as Script;
      } else {
        console.error("[Script generation] Unexpected JSON structure:", JSON.stringify(parsed).substring(0, 500));
        throw new Error("Script JSON missing 'scenes' array");
      }

      // Validate scenes array
      if (!script.scenes || script.scenes.length === 0) {
        throw new Error("Script has no scenes");
      }

      console.log(`[Script generation] Successfully parsed ${script.scenes.length} scenes`);
      return script;
    } catch (parseError) {
      console.error("[Script generation] JSON parse failed. Response length:", text.length);
      console.error("[Script generation] First 500 chars:", text.substring(0, 500));
      console.error("[Script generation] Last 500 chars:", text.substring(text.length - 500));
      throw new Error(`Script generation returned invalid JSON (length: ${text.length}). The response may have been truncated. Please try again with a simpler prompt.`);
    }
  } catch (error) {
    handleApiError(error, "Script generation");
    throw error; // Unreachable - handleApiError always throws
  }
};

/**
 * Extract the first sentence from visualDescription for storyboard panel generation.
 * The AI is instructed to write the FIRST sentence as a clean, single-action description
 * without camera terms. Camera movements and cuts come after for video generation.
 */
const extractStaticDescription = (visualDescription: string): string => {
  // Just take the first sentence - the AI is instructed to make it a clean panel description
  const firstSentence = visualDescription.split(/(?<=[.!?])\s/)[0] || visualDescription;

  // Clean up and return
  return firstSentence.replace(/\s+/g, ' ').trim();
};

/**
 * Build the prompt for first storyboard (3x3 grid) - exported for copying
 */
export const buildStoryboardPrompt = (script: Script, aspectRatio: AspectRatio = '16:9', totalScenes: number = 9, hasRefImages: boolean = false): string => {
  // For 15-scene mode, first grid only shows scenes 1-9
  const scenesToShow = script.scenes.slice(0, 9);

  // Extract STATIC scene descriptions, stripping camera movements that are meant for video
  const sceneDescriptions = scenesToShow.map((s, i) => {
    const staticDescription = extractStaticDescription(s.visualDescription);
    return `Panel ${i + 1}: ${staticDescription}`;
  }).join("\n");

  // Build explicit layout instructions based on aspect ratio
  const isPortrait = aspectRatio === '9:16';
  const layoutInstructions = isPortrait
    ? `CRITICAL PANEL SHAPE - PORTRAIT MODE:
    - The overall grid image should be TALLER than it is WIDE (portrait orientation).
    - Each of the 9 panels must be VERTICAL/PORTRAIT (taller than wide), like a phone screen or TikTok video.
    - Panel dimensions: each panel is 9 units wide × 16 units tall (9:16 aspect ratio).
    - Grid dimensions: 3 columns × 3 rows = 27 units wide × 48 units tall total.
    - Think of it as 9 vertical smartphone screens arranged in a 3×3 pattern.`
    : `CRITICAL PANEL SHAPE - LANDSCAPE MODE:
    - The overall grid image should be WIDER than it is TALL (landscape orientation).
    - Each of the 9 panels must be HORIZONTAL/LANDSCAPE (wider than tall), like a movie screen.
    - Panel dimensions: each panel is 16 units wide × 9 units tall (16:9 aspect ratio).
    - Grid dimensions: 3 columns × 3 rows = 48 units wide × 27 units tall total.
    - Think of it as 9 widescreen TV frames arranged in a 3×3 pattern.`;

  // For 15-scene mode, explicitly tell the model this is NOT the ending
  const continuationNote = totalScenes > 9
    ? `
    IMPORTANT - STORY CONTINUATION:
    This is scenes 1-9 of a ${totalScenes}-scene story. The story CONTINUES after panel 9.
    Panel 9 should NOT show any ending, conclusion, logo, or resolution.
    Panel 9 should feel like a MID-STORY moment - the narrative is still building.
    Avoid compositions that suggest finality (e.g., characters walking away, sunset endings, "looking back" poses).
    `
    : '';

  return `Art Style: ${script.style}

Create a professional 3×3 cinematic storyboard grid containing exactly 9 panels for the following story.
${continuationNote}

${layoutInstructions}

GRID STRUCTURE - STRICT UNIFORM LAYOUT:
- The 9 panels must fill the ENTIRE image edge-to-edge with NO gaps, borders, or white space.
- Each panel must be EXACTLY 1/3 of the total width and EXACTLY 1/3 of the total height.
- ALL 9 PANELS MUST BE IDENTICAL IN SIZE - no exceptions.
- This is NOT a manga or comic layout - do NOT vary panel sizes for dramatic effect.
- NO margins, padding, or frames around or between panels.
- The panels must touch each other directly - seamless grid like a tic-tac-toe board.
- Top row: panels 1, 2, 3 (left to right)
- Middle row: panels 4, 5, 6 (left to right)
- Bottom row: panels 7, 8, 9 (left to right)
- Think of this as a 3×3 photo grid where every cell is exactly the same size.

Ensure consistent characters, lighting, and style across all 9 panels.
${hasRefImages ? 'Use the provided reference image(s) for character designs, art style, and visual consistency.' : ''}

Scenes:
${sceneDescriptions}`;
};

export const generateStoryboard = async (script: Script, refImages?: string[], aspectRatio: AspectRatio = '16:9', totalScenes: number = 9): Promise<string> => {
  const ai = getClient();

  const prompt = buildStoryboardPrompt(script, aspectRatio, totalScenes, refImages && refImages.length > 0);

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
    const response = await withTimeout(
      ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: { parts },
        config: {
          safetySettings,
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: "2K"
          }
        }
      }),
      120000, // 120 second timeout for storyboard generation
      "Storyboard generation"
    );

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated in response");
  } catch (error) {
    handleApiError(error, "Storyboard generation");
    throw error; // Unreachable - handleApiError always throws
  }
};

/**
 * Build the prompt for second storyboard (3x3 grid with blank bottom row) - exported for copying
 * Uses same format as first grid for consistency, but only panels 1-6 have content
 */
export const buildStoryboard2Prompt = (script: Script, aspectRatio: AspectRatio = '16:9'): string => {
  // Get scenes 10-15 (indices 9-14)
  const scenes10to15 = script.scenes.slice(9, 15);

  // Extract STATIC scene descriptions, stripping camera movements that are meant for video
  const sceneDescriptions = scenes10to15.map((s, i) => {
    const staticDescription = extractStaticDescription(s.visualDescription);
    return `Panel ${i + 1}: ${staticDescription}`;
  }).join("\n");

  // Build explicit layout instructions based on aspect ratio (same as first grid)
  const isPortrait = aspectRatio === '9:16';
  const layoutInstructions = isPortrait
    ? `CRITICAL PANEL SHAPE - PORTRAIT MODE:
    - The overall grid image should be TALLER than it is WIDE (portrait orientation).
    - Each of the 9 panels must be VERTICAL/PORTRAIT (taller than wide), like a phone screen or TikTok video.
    - Panel dimensions: each panel is 9 units wide × 16 units tall (9:16 aspect ratio).
    - Grid dimensions: 3 columns × 3 rows = 27 units wide × 48 units tall total.
    - Think of it as 9 vertical smartphone screens arranged in a 3×3 pattern.`
    : `CRITICAL PANEL SHAPE - LANDSCAPE MODE:
    - The overall grid image should be WIDER than it is TALL (landscape orientation).
    - Each of the 9 panels must be HORIZONTAL/LANDSCAPE (wider than tall), like a movie screen.
    - Panel dimensions: each panel is 16 units wide × 9 units tall (16:9 aspect ratio).
    - Grid dimensions: 3 columns × 3 rows = 48 units wide × 27 units tall total.
    - Think of it as 9 widescreen TV frames arranged in a 3×3 pattern.`;

  return `Art Style: ${script.style}

Create a professional 3×3 cinematic storyboard grid for the FINAL 6 scenes of a 15-scene story.
The attached reference images show the same characters/subjects from earlier in this story.
Use them as exact reference for character faces, hair, outfits, proportions, and overall design.
Keep all characters perfectly consistent with these references in every panel.

${layoutInstructions}

GRID STRUCTURE - STRICT UNIFORM LAYOUT:
- The 9 panels must fill the ENTIRE image edge-to-edge with NO gaps, borders, or white space.
- Each panel must be EXACTLY 1/3 of the total width and EXACTLY 1/3 of the total height.
- ALL 9 PANELS MUST BE IDENTICAL IN SIZE - no exceptions.
- This is NOT a manga or comic layout - do NOT vary panel sizes for dramatic effect.
- NO margins, padding, or frames around or between panels.
- The panels must touch each other directly - seamless grid like a tic-tac-toe board.
- Top row: panels 1, 2, 3 (left to right)
- Middle row: panels 4, 5, 6 (left to right)
- Bottom row: panels 7, 8, 9 (left to right) - LEAVE THESE BLANK (solid black)
- Think of this as a 3×3 photo grid where every cell is exactly the same size.

IMPORTANT - BLANK BOTTOM ROW:
- Panels 7, 8, and 9 (the entire bottom row) must be SOLID BLACK - no content, no imagery.
- Only panels 1-6 contain story scenes.
- This is intentional - do not put any content in the bottom row.

Ensure consistent characters, lighting, and style across all 6 story panels.

Story Scenes (Panels 1-6 only):
${sceneDescriptions}

Panel 6 is the FINAL scene of the entire story - it should feel like a satisfying conclusion.`;
};

/**
 * Generate second storyboard as 3x3 grid with blank bottom row for Seedance mode (scenes 10-15)
 * Uses same grid format as first storyboard for consistency, but only top 6 panels have content
 * Uses the first grid panels as style reference along with any user-provided reference images
 */
export const generateStoryboard2 = async (
  script: Script,
  stylePanels: string[],  // Individual panels from first storyboard as style reference
  refImages?: string[],
  aspectRatio: AspectRatio = '16:9'
): Promise<string> => {
  const ai = getClient();

  // Get scenes 10-15 (indices 9-14)
  const scenes10to15 = script.scenes.slice(9, 15);
  if (scenes10to15.length !== 6) {
    throw new Error(`Expected 6 scenes for second grid, got ${scenes10to15.length}`);
  }

  const prompt = buildStoryboard2Prompt(script, aspectRatio);

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{ text: prompt }];

  // Add individual panels as style references (not the full grid)
  for (const panel of stylePanels) {
    const cleanPanel = panel.includes(',') ? panel.split(',')[1] : panel;
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: cleanPanel
      }
    });
  }

  // Add user reference images if provided
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
    // Use same aspect ratio as first grid for consistency
    const response = await withTimeout(
      ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: { parts },
        config: {
          safetySettings,
          imageConfig: {
            aspectRatio: aspectRatio,  // Same as first grid (16:9 or 9:16)
            imageSize: "2K"
          }
        }
      }),
      180000, // 180 second timeout for second storyboard (needs more time with style reference)
      "Second storyboard generation"
    );

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated in response for second storyboard");
  } catch (error) {
    handleApiError(error, "Second storyboard generation");
    throw error;
  }
};

/**
 * Build Seedance prompt following the official Seedance 1.5 Pro prompt guide
 * Formula: Subject + Movement + Environment + Camera movement + Aesthetic description + Sound
 * Exported for copy prompt feature in Production view
 */
export const buildSeedancePrompt = (
  scene: Scene,
  style: string,
  voiceMode: VoiceMode,
  characters?: Character[],
  language: string = 'english'
): string => {
  const parts: string[] = [];
  const languageUpper = language.toUpperCase();

  // Language directive - CRITICAL for preventing unwanted languages (Seedance is ByteDance model)
  const languageDirective = language === 'english'
    ? '[LANGUAGE: ENGLISH ONLY - No Chinese text, signs, or dialogue]'
    : `[LANGUAGE: ${languageUpper} - All dialogue and on-screen text must be in ${languageUpper}. No Chinese unless ${language} is Chinese.]`;
  parts.push(languageDirective);

  // Art Style reference
  if (style) {
    parts.push(`Art Style: ${style}`);
  }

  // Main visual description (should already follow Seedance format from script generation)
  // This includes: Subject + Movement + Environment + Camera movement
  parts.push(scene.visualDescription);

  // Audio atmosphere (SFX notes)
  if (scene.audioDescription) {
    parts.push(`Audio Atmosphere: ${scene.audioDescription}`);
  }

  // Audio mode instructions with correct language
  const audioInstruction = voiceMode === 'speech_in_video'
    ? `AUDIO: Include ambient sound effects matching the scene. Characters speak dialogue in ${languageUpper} only. ABSOLUTELY NO BACKGROUND MUSIC - music will be added in post-production.`
    : 'AUDIO: Include ambient sound effects only. NO DIALOGUE OR SPEECH. ABSOLUTELY NO BACKGROUND MUSIC - music will be added in post-production.';
  parts.push(audioInstruction);

  // Add dialogue for speech-in-video mode
  if (voiceMode === 'speech_in_video') {
    const dialogueSection = buildDialoguePrompt(scene, characters, language);
    if (dialogueSection) {
      parts.push(dialogueSection);
    }
  }

  return parts.join('\n\n');
};

/**
 * Build Veo prompt for video generation
 * Exported for copy prompt feature in Production view
 */
export const buildVeoPrompt = (
  scene: Scene,
  voiceMode: VoiceMode,
  characters?: Character[],
  language: string = 'english'
): string => {
  const languageUpper = language.toUpperCase();

  // Build dialogue prompt if speech_in_video mode
  const dialoguePrompt = voiceMode === 'speech_in_video'
    ? buildDialoguePrompt(scene, characters, language)
    : '';

  // Build audio instructions
  const audioInstructions = voiceMode === 'speech_in_video'
    ? `AUDIO INSTRUCTIONS:
- Include ambient sound effects matching the scene atmosphere (wind, footsteps, environment sounds, etc.)
- ABSOLUTELY NO BACKGROUND MUSIC - we will add our own music track in post-production.
- NO musical score, NO soundtrack, NO instrumental music of any kind.
- CRITICAL: All dialogue MUST be spoken in ${languageUpper} language only. Do NOT use any other language.
- Characters should speak the provided dialogue naturally with their described voice characteristics.
- Ensure lip sync matches the spoken words.`
    : `AUDIO INSTRUCTIONS:
- Include ambient sound effects matching the scene atmosphere (wind, footsteps, environment sounds, etc.)
- ABSOLUTELY NO BACKGROUND MUSIC - we will add our own music track in post-production.
- NO musical score, NO soundtrack, NO instrumental music of any kind.
- NO DIALOGUE or spoken words - voiceover will be added separately.`;

  return `Visuals: ${scene.visualDescription}.
Audio Atmosphere: ${scene.audioDescription}.
${dialoguePrompt}

PACING INSTRUCTION: The output video will be ~8 seconds long (fixed).
This scene is exactly 8 seconds.
CRITICAL: Ensure the primary action described happens IMMEDIATELY and concludes efficiently. Do not pad the start with static frames.

${audioInstructions}

Cinematic lighting, consistent style with input image.`;
};

// Generate video using Seedance API
const generateSeedanceVideo = async (
  scene: Scene,
  startFrameBase64: string,
  aspectRatio: AspectRatio,
  resolution: SeedanceResolution,
  generateAudio: boolean,
  voiceMode: VoiceMode = 'tts',
  characters?: Character[],
  style?: string,
  language: string = 'english'
): Promise<string> => {
  // First, upload the image to R2 to get a public URL
  const uploadRes = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: [startFrameBase64] })
  });

  if (!uploadRes.ok) {
    const uploadError = await uploadRes.json();
    throw new Error(`Image upload failed: ${uploadError.error || 'Unknown error'}`);
  }

  const { urls } = await uploadRes.json();
  const imageUrl = urls[0];

  // Build prompt following Seedance 1.5 Pro guide structure
  const prompt = buildSeedancePrompt(scene, style || '', voiceMode, characters, language);

  // Call Seedance API
  const seedanceRes = await fetch('/api/video/seedance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      imageUrl,
      aspectRatio,
      resolution,
      generateAudio
    })
  });

  if (!seedanceRes.ok) {
    const seedanceError = await seedanceRes.json();
    throw new Error(`Seedance generation failed: ${seedanceError.error || 'Unknown error'}`);
  }

  const { videoUrl } = await seedanceRes.json();
  return videoUrl;
};

/**
 * Build dialogue prompt section for speech-in-video mode
 * Following Seedance 1.5 Pro guide format with emotional state, tone, and pace
 */
const buildDialoguePrompt = (scene: Scene, characters?: Character[], language: string = 'english'): string => {
  const languageUpper = language.toUpperCase();

  if (!scene.dialogue || scene.dialogue.length === 0) {
    // Fallback to voiceoverText if no dialogue
    if (scene.voiceoverText?.trim()) {
      return `VOICEOVER (speak in ${languageUpper} with a calm, clear voice): "${scene.voiceoverText}"`;
    }
    return '';
  }

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

  return `${languageUpper} DIALOGUE:
${dialogueLines}`;
};

// Generate video using Veo API
const generateVeoVideo = async (
  scene: Scene,
  startFrameInput: string,
  aspectRatio: AspectRatio,
  voiceMode: VoiceMode = 'tts',
  characters?: Character[],
  language: string = 'english'
): Promise<string> => {
  const ai = getClient();
  const languageUpper = language.toUpperCase();

  // Handle both URLs and base64 data
  let cleanBase64: string;
  let imageMimeType = 'image/png';

  if (startFrameInput.startsWith('http://') || startFrameInput.startsWith('https://')) {
    // Fetch image from URL and convert to base64
    // Use proxy for R2 URLs to avoid CORS issues
    const fetchUrl = startFrameInput.startsWith('https://video-studio.jarwater.com/')
      ? `/api/proxy-image?url=${encodeURIComponent(startFrameInput)}`
      : startFrameInput;
    console.log('[Veo] Fetching frame from URL:', startFrameInput, 'via:', fetchUrl);
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch frame image: ${response.status}`);
    }
    const blob = await response.blob();
    // Get actual mime type from blob
    imageMimeType = blob.type || 'image/png';
    console.log('[Veo] Image blob type:', imageMimeType, 'size:', blob.size);

    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    // Convert to base64
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    cleanBase64 = btoa(binary);
    console.log('[Veo] Converted URL to base64, length:', cleanBase64.length);
  } else {
    // Already base64 - strip data URL prefix if present
    if (startFrameInput.startsWith('data:')) {
      const mimeMatch = startFrameInput.match(/data:([^;]+);/);
      if (mimeMatch) imageMimeType = mimeMatch[1];
    }
    cleanBase64 = startFrameInput.split(',')[1] || startFrameInput;
  }

  // Build audio instructions based on voice mode
  let audioInstructions: string;
  let dialoguePrompt = '';

  if (voiceMode === 'speech_in_video') {
    dialoguePrompt = buildDialoguePrompt(scene, characters, language);
    audioInstructions = `
      AUDIO INSTRUCTIONS:
      - Include ambient sound effects matching the scene atmosphere (wind, footsteps, environment sounds, etc.)
      - ABSOLUTELY NO BACKGROUND MUSIC - we will add our own music track in post-production.
      - NO musical score, NO soundtrack, NO instrumental music of any kind.
      - CRITICAL: All dialogue MUST be spoken in ${languageUpper} language only. Do NOT use any other language.
      - Characters should speak the provided dialogue naturally with their described voice characteristics.
      - Ensure lip sync matches the spoken words.
    `;
  } else {
    audioInstructions = `
      AUDIO INSTRUCTIONS:
      - Include ambient sound effects matching the scene atmosphere (wind, footsteps, environment sounds, etc.)
      - ABSOLUTELY NO BACKGROUND MUSIC - we will add our own music track in post-production.
      - NO musical score, NO soundtrack, NO instrumental music of any kind.
      - NO DIALOGUE or spoken words - voiceover will be added separately.
    `;
  }

  console.log(`[Veo] Starting video generation for scene ${scene.id}, base64 length: ${cleanBase64.length}`);

  let operation;
  try {
    operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `
        Visuals: ${scene.visualDescription}.
        Audio Atmosphere: ${scene.audioDescription}.
        ${dialoguePrompt}

        PACING INSTRUCTION: The output video will be ~8 seconds long (fixed).
        This scene is exactly 8 seconds.
        CRITICAL: Ensure the primary action described happens IMMEDIATELY and concludes efficiently. Do not pad the start with static frames.

        ${audioInstructions}

        Cinematic lighting, consistent style with input image.
      `,
      image: {
        imageBytes: cleanBase64,
        mimeType: imageMimeType
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio
      }
    });
    console.log(`[Veo] Video generation started for scene ${scene.id}, operation:`, operation.name);
  } catch (apiError) {
    console.error(`[Veo] API call failed for scene ${scene.id}:`, apiError);
    throw apiError;
  }

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
};

export const generateVideoForScene = async (
  scene: Scene,
  startFrameBase64: string,
  aspectRatio: AspectRatio = '16:9',
  videoModel: VideoModel = 'veo-3.1',
  seedanceResolution: SeedanceResolution = '720p',
  seedanceAudio: boolean = false,
  voiceMode: VoiceMode = 'tts',
  characters?: Character[],
  style?: string, // Art style for Seedance prompts
  language: string = 'english' // Language for dialogue in videos
): Promise<string> => {
  try {
    if (videoModel === 'seedance-1.5') {
      return await generateSeedanceVideo(scene, startFrameBase64, aspectRatio, seedanceResolution, seedanceAudio, voiceMode, characters, style, language);
    } else {
      return await generateVeoVideo(scene, startFrameBase64, aspectRatio, voiceMode, characters, language);
    }
  } catch (error) {
    handleApiError(error, `Video generation for scene ${scene.id}`);
    throw error; // Unreachable - handleApiError always throws
  }
};

/**
 * Generate TTS audio for a single voice
 */
const generateSingleVoiceAudio = async (
  ai: ReturnType<typeof getClient>,
  text: string,
  voiceName: GeminiVoice
): Promise<Blob> => {
  const response = await withTimeout(
    ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        safetySettings,
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    }),
    60000, // 60 second timeout for TTS
    "TTS audio generation"
  );

  const audioPart = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!audioPart?.data) throw new Error("No audio data in response");

  const mimeType = audioPart.mimeType || 'audio/wav';

  // If it's raw PCM (L16), we need to convert to WAV for browser playback
  if (mimeType.includes('L16') || mimeType.includes('pcm')) {
    const pcmData = Uint8Array.from(atob(audioPart.data), c => c.charCodeAt(0));
    return pcmToWav(pcmData, 24000, 1); // Gemini TTS uses 24kHz mono
  }

  // Convert base64 to blob
  const binaryString = atob(audioPart.data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
};

/**
 * Concatenate audio blobs using Web Audio API
 */
const concatenateAudioBlobs = async (blobs: Blob[]): Promise<Blob> => {
  if (blobs.length === 0) return new Blob([], { type: 'audio/wav' });
  if (blobs.length === 1) return blobs[0];

  const audioContext = new AudioContext({ sampleRate: 24000 });
  const audioBuffers: AudioBuffer[] = [];

  // Decode all audio blobs to AudioBuffers
  for (const blob of blobs) {
    const arrayBuffer = await blob.arrayBuffer();
    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      audioBuffers.push(audioBuffer);
    } catch (e) {
      console.warn('Failed to decode audio blob, skipping:', e);
    }
  }

  if (audioBuffers.length === 0) {
    audioContext.close();
    return new Blob([], { type: 'audio/wav' });
  }

  // Calculate total length
  const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.length, 0);
  const numberOfChannels = audioBuffers[0].numberOfChannels;
  const sampleRate = audioBuffers[0].sampleRate;

  // Create combined buffer
  const combinedBuffer = audioContext.createBuffer(numberOfChannels, totalLength, sampleRate);

  // Copy data from each buffer
  let offset = 0;
  for (const buffer of audioBuffers) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = combinedBuffer.getChannelData(channel);
      const sourceData = buffer.getChannelData(channel);
      channelData.set(sourceData, offset);
    }
    offset += buffer.length;
  }

  audioContext.close();

  // Convert AudioBuffer to WAV blob
  return audioBufferToWav(combinedBuffer);
};

/**
 * Convert AudioBuffer to WAV Blob
 */
const audioBufferToWav = (buffer: AudioBuffer): Blob => {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write audio data
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
};

export const generateMasterAudio = async (
  script: Script,
  multiCharacter: boolean = false
): Promise<string> => {
  const ai = getClient();

  try {
    if (multiCharacter && script.characters && script.characters.length > 0) {
      // Multi-character mode: generate audio for each dialogue line with appropriate voice
      const characterVoiceMap = new Map<string, GeminiVoice>();

      // Build character name -> voice mapping
      for (const char of script.characters) {
        characterVoiceMap.set(char.name.toLowerCase(), char.voiceName);
      }

      // Find narrator voice (use first character's voice or default to Fenrir)
      const narratorVoice: GeminiVoice = script.narratorVoice || 'Fenrir';
      characterVoiceMap.set('narrator', narratorVoice);

      // Collect all dialogue lines in order across all scenes
      const audioBlobs: Blob[] = [];

      for (const scene of script.scenes) {
        if (scene.dialogue && scene.dialogue.length > 0) {
          // Generate audio for each dialogue line
          for (const line of scene.dialogue) {
            if (!line.text.trim()) continue;

            const speakerLower = line.speaker.toLowerCase();
            const voice = characterVoiceMap.get(speakerLower) || narratorVoice;

            console.log(`[TTS] Generating audio for ${line.speaker} with voice ${voice}`);
            const blob = await generateSingleVoiceAudio(ai, line.text, voice);
            audioBlobs.push(blob);
          }
        } else if (scene.voiceoverText?.trim()) {
          // Fallback to voiceoverText if no dialogue
          const blob = await generateSingleVoiceAudio(ai, scene.voiceoverText, narratorVoice);
          audioBlobs.push(blob);
        }
      }

      if (audioBlobs.length === 0) return "";

      // Concatenate all audio blobs
      const combinedBlob = await concatenateAudioBlobs(audioBlobs);
      return URL.createObjectURL(combinedBlob);
    } else {
      // Single narrator mode: use AI-selected voice or default
      const voiceName: GeminiVoice = script.narratorVoice || 'Fenrir';
      const fullText = script.scenes.map(s => s.voiceoverText).join(" ... ");

      if (!fullText.trim()) return "";

      console.log(`[TTS] Generating audio with narrator voice: ${voiceName}`);
      const blob = await generateSingleVoiceAudio(ai, fullText, voiceName);
      return URL.createObjectURL(blob);
    }
  } catch (error) {
    handleApiError(error, "Voiceover generation");
    throw error; // Unreachable - handleApiError always throws
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

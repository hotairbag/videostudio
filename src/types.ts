export interface Scene {
  id: number;
  timeRange?: string;
  visualDescription: string;
  audioDescription?: string;
  cameraShot?: string;
  cinematicElements?: string;
  voiceoverText: string;
  // For multi-character mode: structured dialogue with speaker tags
  dialogue?: DialogueLine[];
}

export interface Script {
  title: string;
  style: string;
  scenes: Scene[];
  // For multi-character mode
  characters?: Character[];
  // AI-selected narrator voice for single-voice mode
  narratorVoice?: GeminiVoice;
}

export interface GeneratedVideo {
  sceneId: number;
  videoUrl: string;
}

export type AspectRatio = "16:9" | "9:16";

export type VideoModel = "veo-3.1" | "seedance-1.5";

export type SeedanceResolution = "480p" | "720p";

export type SeedanceDuration = 4 | 8 | 12;

export type SeedanceSceneCount = 9 | 15;

export type VoiceMode = 'tts' | 'speech_in_video';

// Supported languages for dialogue/text content
export const SUPPORTED_LANGUAGES = [
  { code: 'english', label: 'English', native: 'English' },
  { code: 'japanese', label: 'Japanese', native: '日本語' },
  { code: 'chinese', label: 'Chinese (Mandarin)', native: '中文' },
  { code: 'korean', label: 'Korean', native: '한국어' },
  { code: 'spanish', label: 'Spanish', native: 'Español' },
  { code: 'indonesian', label: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'french', label: 'French', native: 'Français' },
  { code: 'german', label: 'German', native: 'Deutsch' },
  { code: 'portuguese', label: 'Portuguese', native: 'Português' },
  { code: 'italian', label: 'Italian', native: 'Italiano' },
  { code: 'hindi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'thai', label: 'Thai', native: 'ไทย' },
  { code: 'arabic', label: 'Arabic', native: 'العربية' },
] as const;

// Languages supported by Seedance for speech_in_video mode
// Seedance supports: English, Mandarin, Japanese, Korean, Spanish, Indonesian
export const SEEDANCE_SPEECH_LANGUAGES = ['english', 'chinese', 'japanese', 'korean', 'spanish', 'indonesian'] as const;

export type ContentLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];

// All available Gemini TTS voices
export const GEMINI_VOICES = {
  female: [
    'Achernar', 'Aoede', 'Autonoe', 'Callirrhoe', 'Despina',
    'Erinome', 'Gacrux', 'Kore', 'Laomedeia', 'Leda',
    'Pulcherrima', 'Sulafat', 'Vindemiatrix', 'Zephyr'
  ],
  male: [
    'Achird', 'Algenib', 'Algieba', 'Alnilam', 'Charon',
    'Enceladus', 'Fenrir', 'Iapetus', 'Orus', 'Puck',
    'Rasalgethi', 'Sadachbia', 'Sadaltager', 'Schedar',
    'Umbriel', 'Zubenelgenubi'
  ]
} as const;

export type GeminiVoice = typeof GEMINI_VOICES.female[number] | typeof GEMINI_VOICES.male[number];

// Character definition for multi-character dialogue
export interface Character {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  voiceName: GeminiVoice;
  voiceProfile?: string; // Short description for speech-in-video mode
}

// Dialogue line with speaker and optional Seedance vocal characteristics
export interface DialogueLine {
  speaker: string; // Character name or "narrator"
  text: string;
  // Seedance 1.5 Pro vocal characteristics (for speech_in_video mode)
  emotionalState?: string; // calm, gentle, restrained, forceful, confident, anxious, joyful, melancholic, angry, surprised, determined
  tone?: string; // even, soft, low, firm, clear, warm, cold, playful, serious, sarcastic
  pace?: string; // slow, normal, fast, very slow, measured, rapid
}

// Character reference for storyboard/video generation
export interface CharacterReference {
  name: string;
  images: string[]; // Base64 encoded images
}

// Categorized reference images
export interface ReferenceImages {
  style: string[]; // General art style/background references
  characters: CharacterReference[]; // Named character references
}

export interface AppState {
  step: 'input' | 'storyboard' | 'production';
  script: Script | null;
  storyboardUrl: string | null;
  storyboardUrl2: string | null; // Second 3x2 grid for Seedance mode (6 additional panels)
  frames: string[];
  generatedVideos: Record<number, string>;
  masterAudioUrl: string | null;
  backgroundMusicUrl: string | null;
  isGeneratingScript: boolean;
  isGeneratingStoryboard: boolean;
  isConfirming: boolean;
  isGeneratingAudio: boolean;
  isGeneratingMusic: boolean;
  isGeneratingFullMovie: boolean;
  generatingVideoIds: number[];
  aspectRatio: AspectRatio;
  enableCuts: boolean;
  // Video model settings
  videoModel: VideoModel;
  seedanceAudio: boolean; // Generate sound effects (additional cost)
  seedanceResolution: SeedanceResolution;
  seedanceDuration: SeedanceDuration; // 4, 8, or 12 seconds per clip
  // Voice/dialogue settings
  voiceMode: VoiceMode;
  multiCharacter: boolean;
  // Language for dialogue/text content
  language: ContentLanguage;
  // Background music toggle
  backgroundMusicEnabled: boolean;
}

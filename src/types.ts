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

export type SeedanceSceneCount = 9 | 15;

export type VoiceMode = 'tts' | 'speech_in_video';

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

// Dialogue line with speaker
export interface DialogueLine {
  speaker: string; // Character name or "narrator"
  text: string;
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
  // Voice/dialogue settings
  voiceMode: VoiceMode;
  multiCharacter: boolean;
}

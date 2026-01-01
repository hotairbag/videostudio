export interface Scene {
  id: number;
  timeRange: string;
  visualDescription: string;
  audioDescription: string;
  cameraShot: string;
  voiceoverText: string;
}

export interface Script {
  title: string;
  style: string;
  scenes: Scene[];
}

export interface GeneratedVideo {
  sceneId: number;
  videoUrl: string;
}

export type AspectRatio = "16:9" | "9:16";

export interface AppState {
  step: 'input' | 'storyboard' | 'production';
  script: Script | null;
  storyboardUrl: string | null;
  frames: string[];
  generatedVideos: Record<number, string>;
  masterAudioUrl: string | null;
  backgroundMusicUrl: string | null;
  isGeneratingScript: boolean;
  isGeneratingStoryboard: boolean;
  isGeneratingAudio: boolean;
  isGeneratingMusic: boolean;
  isGeneratingFullMovie: boolean;
  generatingVideoIds: number[];
  aspectRatio: AspectRatio;
  enableCuts: boolean;
}

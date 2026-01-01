# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GenDirector AI Video Studio - a Next.js application that generates ~1 minute cinematic videos using AI. It orchestrates Google Gemini models for script/storyboard generation, Veo 3.1 for video synthesis, and Suno (via Kie.ai) for background music.

## Build & Development Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Architecture

### Tech Stack
- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS v4
- **AI Services**: Google GenAI SDK (`@google/genai`)
- **Import alias**: `@/*` maps to `src/*`

### Application Flow

```
INPUT → STORYBOARD → PRODUCTION → EXPORT
```

1. **Input**: User provides prompt + optional reference video/image
2. **Script Generation**: Gemini 3 Pro creates structured 9-scene script
3. **Storyboard**: Gemini 3 Pro Image generates 3x3 grid (2K, 16:9)
4. **Grid Slicing**: Canvas API splits grid into 9 individual frames
5. **Video Generation**: Veo 3.1 creates 8-second clips per scene (batched 3 at a time)
6. **Audio**: Gemini 2.5 TTS generates voiceover; Suno creates background music
7. **Composition**: Canvas + MediaRecorder exports final WebM

### Key Files

```
src/
├── app/page.tsx                    # Entry point, renders VideoStudio
├── components/
│   ├── VideoStudio.tsx             # Main orchestrator, state management
│   ├── InputForm.tsx               # Step 1: User input & file uploads
│   ├── Storyboard.tsx              # Step 2: Review 3x3 grid
│   └── Production.tsx              # Step 3: Scene grid, playback, export
├── services/
│   ├── geminiService.ts            # Gemini API: script, storyboard, video, TTS
│   └── musicService.ts             # Kie.ai/Suno API for background music
├── utils/
│   ├── imageUtils.ts               # Grid slicing, file-to-base64
│   └── videoCompositor.ts          # Canvas rendering, WebM export
└── types.ts                        # Scene, Script, AppState interfaces
```

### AI Models Used

| Purpose | Model |
|---------|-------|
| Script Generation | `gemini-3-pro-preview` |
| Storyboard Image | `gemini-3-pro-image-preview` |
| Video Generation | `veo-3.1-fast-generate-preview` |
| Text-to-Speech | `gemini-2.5-flash-preview-tts` (Fenrir voice) |
| Background Music | Suno V5 via Kie.ai API |

### State Management

All state lives in `VideoStudio.tsx` using React useState. Key state shape:

```typescript
interface AppState {
  step: 'input' | 'storyboard' | 'production';
  script: Script | null;
  storyboardUrl: string | null;
  frames: string[];              // 9 base64 PNGs from sliced grid
  generatedVideos: Record<number, string>;  // sceneId → blob URL
  masterAudioUrl: string | null;
  backgroundMusicUrl: string | null;
  // Loading flags...
}
```

### API Key Setup

The app requires API keys for:
1. **Google Cloud** (Gemini + Veo) - `NEXT_PUBLIC_GOOGLE_API_KEY` (client-side, for GenAI SDK)
2. **Kie.ai/Suno** (music) - `MUSIC_API_KEY` (server-side only, secure)

Users can enter the Google API key via:
1. Google AI Studio's key selector (if available)
2. Manual entry in the UI

### Video Generation Details

- Videos are 8 seconds, 720p, 16:9
- **Audio in generated videos**: SFX only (ambient sounds matching scene atmosphere)
  - NO dialogue (voiceover is generated separately via Gemini TTS)
  - NO music (background music is generated separately via Suno)
- Scenes are batched 3 at a time to avoid rate limiting
- Polling interval: 5 seconds for async video generation

### Export Process

`videoCompositor.ts` handles final composition:
1. Creates 1280x720 canvas at 30 FPS
2. Loads all scene videos and audio tracks
3. Uses Web Audio API to mix:
   - Video SFX (40% volume) - ambient sounds from each scene
   - Voiceover (100% volume) - Gemini TTS narration
   - Background music (20% volume) - Suno instrumental track
4. MediaRecorder captures to WebM (VP9/Opus)
5. Scene switching synchronized to voiceover duration

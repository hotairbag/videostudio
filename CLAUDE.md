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
npm test         # Run Jest test suite (70 tests)
```

## Architecture

### Tech Stack
- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS v4
- **AI Services**: Google GenAI SDK (`@google/genai`)
- **Testing**: Jest + React Testing Library
- **Import alias**: `@/*` maps to `src/*`

### Application Flow

```
INPUT → STORYBOARD → PRODUCTION → EXPORT
```

1. **Input**: User provides prompt + optional reference images + aspect ratio + cuts toggle
2. **Script Generation**: Gemini 3 Pro creates structured 9-scene script (with multi-shot `[cut]` tags if enabled)
3. **Storyboard**: Gemini 3 Pro Image generates 3x3 grid (uses base scene descriptions, strips `[cut]` tags)
4. **Grid Slicing**: Canvas API splits grid into 9 individual frames (respects aspect ratio)
5. **Video Generation**: Veo 3.1 creates 8-second clips per scene with multi-shot cuts (batched 3 at a time)
6. **Audio**: Gemini 2.5 TTS generates voiceover; Suno creates content-aware background music
7. **Composition**: Canvas + MediaRecorder exports final WebM (8 Mbps VP9, 192 kbps Opus)

### Key Files

```
src/
├── app/page.tsx                    # Entry point, renders VideoStudio
├── components/
│   ├── VideoStudio.tsx             # Main orchestrator, state management
│   ├── InputForm.tsx               # Step 1: User input, file uploads, aspect ratio toggle
│   ├── Storyboard.tsx              # Step 2: Review 3x3 grid
│   └── Production.tsx              # Step 3: Scene grid, playback, export
├── services/
│   ├── geminiService.ts            # Gemini API: script, storyboard, video, TTS
│   └── musicService.ts             # Kie.ai/Suno API for background music
├── utils/
│   ├── imageUtils.ts               # Grid slicing, file-to-base64, aspect ratio dimensions
│   └── videoCompositor.ts          # Canvas rendering, WebM export with audio mixing
├── types.ts                        # Scene, Script, AppState, AspectRatio interfaces
└── __tests__/                      # Jest test suite (70 tests)
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
type AspectRatio = "16:9" | "9:16";

interface AppState {
  step: 'input' | 'storyboard' | 'production';
  script: Script | null;
  storyboardUrl: string | null;
  frames: string[];              // 9 base64 PNGs from sliced grid
  generatedVideos: Record<number, string>;  // sceneId → blob URL
  masterAudioUrl: string | null;
  backgroundMusicUrl: string | null;
  aspectRatio: AspectRatio;      // Affects storyboard, frames, videos, export
  enableCuts: boolean;           // Toggle for multi-shot [cut] tags in video generation
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

### Aspect Ratio Support

The app supports both 16:9 (landscape) and 9:16 (portrait) throughout the entire pipeline:

| Component | 16:9 Dimensions | 9:16 Dimensions |
|-----------|-----------------|-----------------|
| Storyboard grid | 16:9 overall | 9:16 overall |
| Individual frames | 1280x720 | 720x1280 |
| Generated videos | 720p 16:9 | 720p 9:16 |
| Export canvas | 1280x720 | 720x1280 |

### Multi-Shot Video Generation (Optional)

When **Enable Cuts** is toggled on, each scene's `visualDescription` includes `[cut]` tags for multiple camera angles within a single 8-second video:

```
A chef prepares ingredients [cut] close up shot of hands chopping [cut] insert shot of sizzling pan
```

When **Single Shot** is selected, scenes use continuous smooth camera movement without cuts - ideal for animation-style videos where precise cuts may not work well.

**Important**: The storyboard generation always strips `[cut]` tags (uses only base description), while Veo receives the full prompt.

Camera cut formulas (when enabled):
- `[cut] close up shot of [character] - he is [emotion]`
- `[cut] over the shoulder shot - in front of [character] - [what they see]`
- `[cut] insert shot of [item], [camera movement]`
- `[cut] aerial shot of [environment], view from above`
- `[cut] low angle shot - [character + action]`

### Content-Aware Music Generation

The Suno music API (`src/app/api/music/generate/route.ts`) detects content type and generates appropriate music:

| Content Type | Genre |
|--------------|-------|
| Casual/Food/BBQ | Indie Folk Pop |
| Travel/Adventure | Indie Pop with World influences |
| Sports/Fitness | Electronic Rock |
| Nature/Wildlife | Ambient |
| Epic/Cinematic | Orchestral Trailer |
| Dark/Mystery | Dark Atmospheric |

### Video Generation Details

- Videos are 8 seconds, 720p, configurable aspect ratio
- **Multi-shot cuts** (optional): 2-3 camera angle changes per scene via `[cut]` tags when enabled
- **Audio in generated videos**: SFX only (ambient sounds matching scene atmosphere)
  - NO dialogue (voiceover is generated separately via Gemini TTS)
  - NO music (background music is generated separately via Suno)
- Scenes are batched 3 at a time to avoid rate limiting
- Polling interval: 5 seconds for async video generation

### Export Process

`videoCompositor.ts` handles final composition:
1. Creates canvas at appropriate dimensions (1280x720 or 720x1280) at 30 FPS
2. Loads all scene videos and audio tracks
3. Uses Web Audio API to mix:
   - Video SFX (40% volume) - ambient sounds from each scene
   - Voiceover (100% volume) - Gemini TTS narration
   - Background music (20% volume) - Suno instrumental track
4. MediaRecorder captures to WebM (VP9 8Mbps / Opus 192kbps)
5. Scene switching synchronized to 8-second intervals

### Testing

Run the test suite:
```bash
npm test                    # Run all 70 tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # Coverage report
```

Test files are in `src/__tests__/` mirroring the source structure.

### Documentation

- `docs/veo-guide.md` - Veo prompt reference with multi-shot `[cut]` formulas
- `docs/suno-guide.md` - Suno music prompt reference with content-type mapping

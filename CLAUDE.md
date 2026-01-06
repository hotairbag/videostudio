# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GenDirector AI Video Studio - a Next.js application that generates ~1 minute cinematic videos using AI. It orchestrates Google Gemini models for script/storyboard generation, supports both Veo 3.1 (Google) and Seedance 1.5 Pro (ByteDance) for video synthesis, and Suno (via Kie.ai) for background music.

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

1. **Input**: User provides prompt + optional reference images + aspect ratio + cuts toggle + video model selection
2. **Script Generation**: Gemini 3 Pro creates structured script (9 scenes for Veo, 15 scenes for Seedance)
3. **Storyboard**: Gemini 3 Pro Image generates grids:
   - **Veo mode**: Single 3x3 grid (9 scenes)
   - **Seedance mode**: Two grids - 3x3 (scenes 1-9) + 3x2 (scenes 10-15), with second grid using first as style reference
4. **Grid Slicing**: Canvas API splits grids into individual frames (respects aspect ratio)
5. **Video Generation**:
   - **Veo 3.1**: 8-second clips per scene with optional multi-shot cuts
   - **Seedance 1.5**: 4-second clips per scene, uploaded to R2 → generated via Kie.ai API
6. **Audio**: Gemini 2.5 TTS generates voiceover; Suno creates content-aware background music
7. **Composition**: Canvas + MediaRecorder exports final WebM (8 Mbps VP9, 192 kbps Opus)

### Key Files

```
src/
├── app/
│   ├── page.tsx                    # Entry point, renders VideoStudio
│   └── api/
│       ├── music/generate/route.ts # Suno music generation API
│       ├── upload/route.ts         # Cloudflare R2 image upload (for Seedance)
│       └── video/seedance/route.ts # Seedance video generation API (via Kie.ai)
├── components/
│   ├── VideoStudio.tsx             # Main orchestrator, state management
│   ├── InputForm.tsx               # Step 1: User input, model selection, aspect ratio
│   ├── Storyboard.tsx              # Step 2: Review storyboard grid(s)
│   └── Production.tsx              # Step 3: Scene grid, playback, export
├── services/
│   ├── geminiService.ts            # Gemini API: script, storyboard, video, TTS + Seedance integration
│   └── musicService.ts             # Kie.ai/Suno API for background music
├── utils/
│   ├── imageUtils.ts               # Grid slicing (3x3, 3x2), file-to-base64, aspect ratio
│   └── videoCompositor.ts          # Canvas rendering, WebM export with audio mixing
├── types.ts                        # Scene, Script, AppState, VideoModel, AspectRatio
└── __tests__/                      # Jest test suite
```

### AI Models Used

| Purpose | Model |
|---------|-------|
| Script Generation | `gemini-3-pro-preview` |
| Storyboard Image | `gemini-3-pro-image-preview` |
| Video Generation (Veo) | `veo-3.1-fast-generate-preview` (8s clips) |
| Video Generation (Seedance) | `bytedance/seedance-1.5-pro` via Kie.ai (4s clips) |
| Text-to-Speech | `gemini-2.5-flash-preview-tts` (Fenrir voice) |
| Background Music | Suno V5 via Kie.ai API |

### State Management

All state lives in `VideoStudio.tsx` using React useState. Key state shape:

```typescript
type AspectRatio = "16:9" | "9:16";
type VideoModel = "veo-3.1" | "seedance-1.5";
type SeedanceResolution = "480p" | "720p";

interface AppState {
  step: 'input' | 'storyboard' | 'production';
  script: Script | null;
  storyboardUrl: string | null;
  storyboardUrl2: string | null;           // Second 3x2 grid for Seedance mode
  frames: string[];                        // 9 or 15 base64 PNGs from sliced grids
  generatedVideos: Record<number, string>; // sceneId → blob URL
  masterAudioUrl: string | null;
  backgroundMusicUrl: string | null;
  aspectRatio: AspectRatio;                // Affects storyboard, frames, videos, export
  enableCuts: boolean;                     // Toggle for multi-shot [cut] tags
  videoModel: VideoModel;                  // Veo vs Seedance selection
  seedanceAudio: boolean;                  // Generate SFX in Seedance clips (default: false)
  seedanceResolution: SeedanceResolution;  // 480p or 720p for Seedance
  // Loading flags...
}
```

### API Key Setup

The app requires API keys for:
1. **Google Cloud** (Gemini + Veo) - `NEXT_PUBLIC_GOOGLE_API_KEY` (client-side, for GenAI SDK)
2. **Kie.ai/Suno** (music + Seedance) - `MUSIC_API_KEY` (server-side, used for both Suno and Seedance APIs)
3. **Cloudflare R2** (image hosting for Seedance) - server-side credentials:
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_R2_ACCESS_KEY_ID`
   - `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
   - `CLOUDFLARE_R2_BUCKET` (default: `video-studio`)
   - Custom domain: `video-studio.jarwater.com`

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

#### Veo 3.1 Mode (default)
- 9 scenes × 8 seconds = 72 seconds total
- 720p, configurable aspect ratio
- **Multi-shot cuts** (optional): 2-3 camera angle changes per scene via `[cut]` tags
- **Audio**: SFX only (ambient sounds matching scene)
- Scenes batched 3 at a time; polling interval: 5 seconds

#### Seedance 1.5 Mode
- 15 scenes × 4 seconds = 60 seconds total
- Configurable resolution: 480p or 720p
- **Audio**: Optional SFX (default: off to reduce cost)
- **Dual storyboard generation**: 3x3 grid (scenes 1-9) + 3x2 grid (scenes 10-15)
- Second grid uses first grid as style reference for visual continuity
- Images uploaded to Cloudflare R2 before Seedance API call
- **Cost estimate**: ~$3.00 for 15 clips at 720p without audio, ~$6.00 with audio (flex pricing)

#### Common Settings
- NO dialogue in generated videos (voiceover via Gemini TTS)
- NO music in generated videos (background music via Suno)
- Camera cuts: 0-1 for Seedance (4s clips), 2-3 for Veo (8s clips)

### Export Process

`videoCompositor.ts` handles final composition:
1. Creates canvas at appropriate dimensions (1280x720 or 720x1280) at 30 FPS
2. Loads all scene videos and audio tracks
3. Uses Web Audio API to mix:
   - Video SFX (40% volume) - ambient sounds from each scene
   - Voiceover (100% volume) - Gemini TTS narration
   - Background music (20% volume) - Suno instrumental track
4. MediaRecorder captures to WebM (VP9 8Mbps / Opus 192kbps)
5. Scene switching synchronized to clip duration (8s for Veo, 4s for Seedance)

### Testing

Run the test suite:
```bash
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # Coverage report
```

Test files are in a top-level `tests/` folder:
```
tests/
├── components/    # React component tests
├── services/      # Service layer tests
└── utils/         # Utility function tests
```

### Testing Requirements

All new features and bug fixes MUST include tests:

#### What Needs Tests
1. **New Features**: Every new feature requires corresponding tests
2. **Bug Fixes**: Every bug fix requires a test that would have caught the bug
3. **API Changes**: Any changes to Convex mutations/queries require validator tests
4. **Component Changes**: UI changes that affect behavior need component tests

#### Test Locations
- Frontend components: `tests/components/`
- Services: `tests/services/`
- Utils: `tests/utils/`
- Convex functions: `convex/__tests__/`

#### Running Tests
```bash
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- path/to/test   # Run specific test
npm test -- --coverage     # Coverage report
```

#### Before Merging
- All tests must pass
- New code should be covered by tests
- Convex schema changes must have validator tests

### Documentation

- `docs/veo-guide.md` - Veo prompt reference with multi-shot `[cut]` formulas
- `docs/suno-guide.md` - Suno music prompt reference with content-type mapping

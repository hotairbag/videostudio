# GenDirector AI Video Studio

AI-powered video production studio that generates ~1 minute cinematic videos from text prompts. Uses Google Gemini for script/storyboard generation, Veo 3.1 for video synthesis, and Suno for background music.

## Features

- **Script Generation** - Gemini 3 Pro creates structured 9-scene scripts with multi-shot camera directions
- **Storyboard** - AI-generated 3x3 cinematic grid for visual planning
- **Video Generation** - Veo 3.1 creates 8-second clips with multiple camera cuts per scene
- **Voiceover** - Gemini 2.5 TTS with natural narration
- **Background Music** - Content-aware Suno music generation (matches scene mood)
- **Aspect Ratios** - Support for both 16:9 (landscape) and 9:16 (portrait/vertical)
- **Camera Cuts Toggle** - Enable dynamic multi-shot cuts or smooth single-shot animation
- **Export** - High-quality WebM export with mixed audio tracks

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS v4
- **AI Models**:
  - Gemini 3 Pro (script generation)
  - Gemini 3 Pro Image (storyboard)
  - Veo 3.1 Fast (video generation)
  - Gemini 2.5 Flash TTS (voiceover)
  - Suno V5 via Kie.ai (background music)

## Getting Started

### Prerequisites

- Node.js 18+
- Google Cloud API key with access to Gemini and Veo models
- Kie.ai API key for Suno music generation

### Environment Variables

Create a `.env.local` file:

```bash
NEXT_PUBLIC_GOOGLE_API_KEY=your_google_api_key
MUSIC_API_KEY=your_kieai_api_key
```

### Installation

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

1. **Input** - Enter a video description and optionally upload reference images for style/character consistency
2. **Select Aspect Ratio** - Choose 16:9 (landscape) or 9:16 (portrait)
3. **Toggle Camera Cuts** - Enable for dynamic multi-angle shots, disable for smooth continuous animation
4. **Review Storyboard** - Preview the AI-generated 3x3 visual grid
5. **Production** - Generate videos for each scene, preview, and export

## Project Structure

```
src/
├── app/
│   ├── page.tsx                 # Entry point
│   └── api/music/generate/      # Suno music API route
├── components/
│   ├── VideoStudio.tsx          # Main orchestrator
│   ├── InputForm.tsx            # User input & uploads
│   ├── Storyboard.tsx           # 3x3 grid preview
│   └── Production.tsx           # Scene grid & export
├── services/
│   ├── geminiService.ts         # Gemini/Veo API calls
│   └── musicService.ts          # Suno API calls
├── utils/
│   ├── imageUtils.ts            # Grid slicing utilities
│   └── videoCompositor.ts       # Video export composition
├── types.ts                     # TypeScript interfaces
└── __tests__/                   # Jest test suite
```

## Testing

```bash
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # Coverage report
```

## Documentation

- [Veo Prompt Guide](docs/veo-guide.md) - Multi-shot prompts, camera angles, visual styles
- [Suno Music Guide](docs/suno-guide.md) - Content-aware music generation

## Video Generation Details

Each scene generates an 8-second video with:
- **Multi-shot cuts** (optional) - 2-3 camera angle changes using `[cut]` tags when enabled
- **Single-shot mode** - Smooth continuous animation when cuts are disabled
- **Ambient SFX** - Scene-appropriate sound effects (no dialogue/music)
- **720p resolution** - Optimized for web playback

### Export Quality

- Video: VP9 codec at 8 Mbps
- Audio: Opus codec at 192 kbps
- Format: WebM container

## License

MIT

export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = 'https://api.kie.ai/api/v1';

interface MusicTaskResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

interface SceneData {
  visualDescription: string;
  voiceoverText?: string;
}

/**
 * Build a natural description of the story for Suno.
 * Just tell it what the video is about - let Suno figure out the music style.
 */
function buildMusicDescription(title: string, style: string, scenes?: SceneData[]): string {
  // Build a natural summary of the story
  let description = `Instrumental background music for a video called "${title}".`;

  if (style) {
    description += ` Style: ${style}.`;
  }

  if (scenes && scenes.length > 0) {
    // Summarize what happens in the scenes
    const sceneSummary = scenes
      .slice(0, 5) // First 5 scenes give good context
      .map(s => s.visualDescription || s.voiceoverText)
      .filter(Boolean)
      .join(' ')
      .substring(0, 500);

    if (sceneSummary) {
      description += ` The story: ${sceneSummary}`;
    }
  }

  // Add requirement for instrumental
  description += ` Create music that matches this mood and energy. No vocals, instrumental only.`;

  return description;
}

/**
 * Extract key mood/genre words from the content for the style field
 */
function extractStyleTags(title: string, style: string): string {
  // Just use the style directly + instrumental
  const tags = [style, 'Cinematic', 'Instrumental'].filter(Boolean);
  return tags.join(' and ');
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.MUSIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Music API key not configured' },
      { status: 500 }
    );
  }

  try {
    const { title, style, theme, scenes } = await request.json();

    // Build a natural description - just tell Suno what the video is about
    const prompt = buildMusicDescription(title, style, scenes);
    const sunoStyle = extractStyleTags(title, style);

    console.log('[Suno] Description:', prompt);
    console.log('[Suno] Style:', sunoStyle);

    const generateRes = await fetch(`${BASE_URL}/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'V5',
        customMode: true,
        instrumental: true,
        prompt,
        style: sunoStyle,
        title: (title || "Cinematic Track").substring(0, 80),
        callBackUrl: 'https://example.com/callback'
      })
    });

    const genJson: MusicTaskResponse = await generateRes.json();

    if (genJson.code !== 200 || !genJson.data?.taskId) {
      return NextResponse.json(
        { error: `Music generation failed to start: ${genJson.msg}` },
        { status: 400 }
      );
    }

    // Return taskId immediately - client will poll for status
    return NextResponse.json({
      taskId: genJson.data.taskId,
      status: 'pending'
    });

  } catch (error) {
    console.error('Music start error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

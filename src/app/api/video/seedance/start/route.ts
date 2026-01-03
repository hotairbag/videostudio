export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = 'https://api.kie.ai/api/v1';

interface SeedanceTaskResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.MUSIC_API_KEY; // Same kie.ai API key

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Kie.ai API key not configured' },
      { status: 500 }
    );
  }

  try {
    const {
      prompt,
      imageUrl,
      aspectRatio,
      resolution = '720p',
      generateAudio = false,
    } = await request.json();

    // Map aspect ratio to Seedance format
    const seedanceAspectRatio = aspectRatio === '9:16' ? '9:16' : '16:9';

    // Build input_urls array - Seedance accepts 0-2 images
    const inputUrls = imageUrl ? [imageUrl] : [];

    // Create generation task
    const createRes = await fetch(`${BASE_URL}/jobs/createTask`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'bytedance/seedance-1.5-pro',
        input: {
          prompt,
          input_urls: inputUrls,
          aspect_ratio: seedanceAspectRatio,
          resolution,
          duration: '4', // Fixed 4 seconds for our use case
          fixed_lens: false, // Allow camera movement
          generate_audio: generateAudio,
        }
      })
    });

    const createJson: SeedanceTaskResponse = await createRes.json();

    if (createJson.code !== 200 || !createJson.data?.taskId) {
      return NextResponse.json(
        { error: `Seedance task creation failed: ${createJson.msg}` },
        { status: 400 }
      );
    }

    // Return taskId immediately - client will poll for status
    return NextResponse.json({
      taskId: createJson.data.taskId,
      status: 'pending'
    });

  } catch (error) {
    console.error('Seedance start error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

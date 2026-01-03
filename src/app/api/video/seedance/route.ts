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

interface SeedanceStatusResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    model: string;
    state: 'waiting' | 'success' | 'fail';
    param: string;
    resultJson: string | null;
    failCode: string | null;
    failMsg: string | null;
    costTime: number | null;
    completeTime: number | null;
    createTime: number;
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

    const taskId = createJson.data.taskId;

    // Poll for completion
    // Seedance typically takes 30-120 seconds per video
    const maxAttempts = 60; // 5 minutes total (60 * 5s)
    const delayMs = 5000;
    const maxRetries = 3;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, delayMs));

      let statusRes: Response | null = null;
      for (let retry = 0; retry < maxRetries; retry++) {
        try {
          statusRes = await fetch(`${BASE_URL}/jobs/recordInfo?taskId=${taskId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          break;
        } catch (fetchError) {
          console.warn(`[Seedance] Poll attempt ${i + 1}, retry ${retry + 1}/${maxRetries} failed:`,
            fetchError instanceof Error ? fetchError.message : 'Network error');
          if (retry < maxRetries - 1) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }

      if (statusRes?.ok) {
        const statusJson: SeedanceStatusResponse = await statusRes.json();
        const taskData = statusJson.data;

        if (taskData) {
          if (taskData.state === 'success') {
            // Parse resultJson to get video URL
            if (taskData.resultJson) {
              try {
                const result = JSON.parse(taskData.resultJson);
                if (result.resultUrls && result.resultUrls.length > 0) {
                  return NextResponse.json({ videoUrl: result.resultUrls[0] });
                }
              } catch (parseError) {
                console.error('[Seedance] Failed to parse resultJson:', parseError);
              }
            }
            return NextResponse.json(
              { error: 'Video generated but URL not found in response' },
              { status: 500 }
            );
          } else if (taskData.state === 'fail') {
            return NextResponse.json(
              { error: taskData.failMsg || 'Seedance video generation failed' },
              { status: 500 }
            );
          }
          // state === 'waiting' - continue polling
        }
      }
    }

    return NextResponse.json(
      { error: 'Seedance video generation timed out' },
      { status: 504 }
    );

  } catch (error) {
    console.error('Seedance generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

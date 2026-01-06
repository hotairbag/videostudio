export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';

const BYTEPLUS_API_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks';

export async function POST(request: NextRequest) {
  const apiKey = process.env.BYTEPLUS_ARK_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'BytePlus ARK API key not configured' },
      { status: 500 }
    );
  }

  try {
    const {
      prompt,
      imageUrl,
      aspectRatio = '16:9',
      resolution = '720p',
      duration = 4,
      generateAudio = true,
    } = await request.json();

    // Build content array with text prompt and optional image
    const content: Array<{type: string; text?: string; image_url?: {url: string}; role?: string}> = [];

    // Add text prompt with parameters
    // Parameters: --rt (ratio), --dur (duration), --rs (resolution), --wm (watermark), --cf (camera fixed)
    const textWithParams = `${prompt} --rt ${aspectRatio} --dur ${duration} --rs ${resolution} --wm false --cf false`;
    content.push({
      type: 'text',
      text: textWithParams
    });

    // Add first frame image if provided
    if (imageUrl) {
      content.push({
        type: 'image_url',
        image_url: { url: imageUrl },
        role: 'first_frame'
      });
    }

    // Create generation task with offline inference (50% discount)
    const createRes = await fetch(BYTEPLUS_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'seedance-1-5-pro-251215',
        content,
        generate_audio: generateAudio,
        service_tier: 'flex', // Offline inference for 50% discount
        execution_expires_after: 172800, // 48 hours (default)
        return_last_frame: false,
      })
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      console.error('[BytePlus] Task creation failed:', createRes.status, errorText);
      return NextResponse.json(
        { error: `BytePlus task creation failed: ${createRes.status} - ${errorText}` },
        { status: createRes.status }
      );
    }

    const createJson = await createRes.json();

    if (!createJson.id) {
      console.error('[BytePlus] No task ID returned:', createJson);
      return NextResponse.json(
        { error: 'BytePlus task creation failed: no task ID returned' },
        { status: 400 }
      );
    }

    console.log(`[BytePlus] Task created: ${createJson.id}`);

    return NextResponse.json({
      taskId: createJson.id,
      status: 'pending'
    });

  } catch (error) {
    console.error('[BytePlus] Generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

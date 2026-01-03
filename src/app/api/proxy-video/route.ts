import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Only allow proxying from our R2 bucket domain
  if (!url.startsWith('https://video-studio.jarwater.com/')) {
    return NextResponse.json({ error: 'Invalid video URL' }, { status: 403 });
  }

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch video' }, { status: response.status });
    }

    const videoData = await response.arrayBuffer();
    
    return new NextResponse(videoData, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'video/mp4',
        'Content-Length': videoData.byteLength.toString(),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('Video proxy error:', error);
    return NextResponse.json({ error: 'Proxy failed' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}

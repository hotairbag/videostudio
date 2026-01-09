import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Roboto Regular TTF from Google Fonts
const FONT_URL = 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf';

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(FONT_URL);

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch font' }, { status: response.status });
    }

    const fontData = await response.arrayBuffer();

    return new NextResponse(fontData, {
      status: 200,
      headers: {
        'Content-Type': 'font/ttf',
        'Content-Length': fontData.byteLength.toString(),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('Font proxy error:', error);
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

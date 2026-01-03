export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = 'https://api.kie.ai/api/v1';
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET || 'video-studio';
const R2_CUSTOM_DOMAIN = 'video-studio.jarwater.com';

// AWS Signature V4 for R2 uploads (edge-compatible)
async function signRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: Uint8Array,
  credentials: { accessKeyId: string; secretAccessKey: string },
  region: string = 'auto'
): Promise<Record<string, string>> {
  const encoder = new TextEncoder();

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const parsedUrl = new URL(url);
  const host = parsedUrl.host;
  const canonicalUri = parsedUrl.pathname;
  const canonicalQuerystring = parsedUrl.search.slice(1);

  const payloadHash = await crypto.subtle.digest('SHA-256', body.buffer as ArrayBuffer);
  const payloadHashHex = Array.from(new Uint8Array(payloadHash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const signedHeaders: Record<string, string> = {
    ...headers,
    'host': host,
    'x-amz-content-sha256': payloadHashHex,
    'x-amz-date': amzDate,
  };

  const headerKeys = Object.keys(signedHeaders).sort();
  const canonicalHeaders = headerKeys
    .map(key => `${key.toLowerCase()}:${signedHeaders[key].trim()}`)
    .join('\n') + '\n';
  const signedHeadersStr = headerKeys.map(k => k.toLowerCase()).join(';');

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeadersStr,
    payloadHashHex,
  ].join('\n');

  const canonicalRequestHash = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(canonicalRequest)
  );
  const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const service = 's3';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    canonicalRequestHashHex,
  ].join('\n');

  async function hmacSha256(key: BufferSource, message: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  }

  const kDate = await hmacSha256(encoder.encode('AWS4' + credentials.secretAccessKey) as BufferSource, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');

  const signature = await hmacSha256(kSigning, stringToSign);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const authorization = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signatureHex}`;

  return {
    ...signedHeaders,
    'authorization': authorization,
  };
}

async function uploadMusicToR2(audioUrl: string, taskId: string): Promise<string> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Cloudflare R2 credentials not configured');
  }

  // Download audio from Suno
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) {
    throw new Error(`Failed to download music: ${audioRes.status}`);
  }

  const audioBuffer = await audioRes.arrayBuffer();
  const audioBytes = new Uint8Array(audioBuffer);

  // Determine extension from URL or default to mp3
  const urlPath = new URL(audioUrl).pathname;
  const extension = urlPath.split('.').pop() || 'mp3';
  const contentType = extension === 'mp3' ? 'audio/mpeg' : `audio/${extension}`;

  // Generate unique filename
  const timestamp = Date.now();
  const filename = `music/${timestamp}_${taskId}.${extension}`;

  // Upload to R2
  const r2Url = `https://${accountId}.r2.cloudflarestorage.com/${R2_BUCKET}/${filename}`;

  const headers: Record<string, string> = {
    'content-type': contentType,
    'content-length': audioBytes.length.toString(),
  };

  const signedHeaders = await signRequest(
    'PUT',
    r2Url,
    headers,
    audioBytes,
    { accessKeyId, secretAccessKey }
  );

  const uploadRes = await fetch(r2Url, {
    method: 'PUT',
    headers: signedHeaders,
    body: audioBytes.buffer as ArrayBuffer,
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    throw new Error(`R2 upload failed: ${uploadRes.status} - ${errorText}`);
  }

  // Return public URL
  return `https://${R2_CUSTOM_DOMAIN}/${filename}`;
}

interface SunoTrack {
  id: string;
  audioUrl: string;
  streamAudioUrl: string;
  duration: number | null;
  title: string;
}

interface MusicStatusResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    status: string;
    response?: {
      sunoData?: SunoTrack[];
    };
    errorMessage?: string;
  };
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.MUSIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Music API key not configured' },
      { status: 500 }
    );
  }

  const taskId = request.nextUrl.searchParams.get('taskId');

  if (!taskId) {
    return NextResponse.json(
      { error: 'taskId is required' },
      { status: 400 }
    );
  }

  try {
    const statusRes = await fetch(`${BASE_URL}/generate/record-info?taskId=${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!statusRes.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch task status' },
        { status: statusRes.status }
      );
    }

    const statusJson: MusicStatusResponse = await statusRes.json();
    const taskData = statusJson.data;

    if (!taskData) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const status = taskData.status;

    // Check for completion
    if (status === 'SUCCESS' || status === 'COMPLETE' || status === 'success' || status === 'complete') {
      const tracks = taskData.response?.sunoData;
      if (Array.isArray(tracks) && tracks.length > 0) {
        const sunoAudioUrl = tracks[0].audioUrl || tracks[0].streamAudioUrl;
        if (sunoAudioUrl) {
          // Proxy through R2 for CORS support
          try {
            const r2AudioUrl = await uploadMusicToR2(sunoAudioUrl, taskId);
            console.log(`[Music] Audio proxied to R2: ${r2AudioUrl}`);
            return NextResponse.json({
              status: 'completed',
              audioUrl: r2AudioUrl,
              duration: tracks[0].duration
            });
          } catch (proxyError) {
            console.error('[Music] Failed to proxy audio to R2:', proxyError);
            // Fall back to original URL if proxy fails
            return NextResponse.json({
              status: 'completed',
              audioUrl: sunoAudioUrl,
              duration: tracks[0].duration
            });
          }
        }
      }
      return NextResponse.json(
        { error: 'Music generated but URL not found in response' },
        { status: 500 }
      );
    } else if (status === 'FAILED' || status === 'failed' || status === 'ERROR') {
      return NextResponse.json({
        status: 'failed',
        error: taskData.errorMessage || 'Music generation task failed on server'
      });
    }

    // Status is still processing (TEXT_SUCCESS, PROCESSING, etc)
    return NextResponse.json({
      status: 'processing',
      taskId
    });

  } catch (error) {
    console.error('Music status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

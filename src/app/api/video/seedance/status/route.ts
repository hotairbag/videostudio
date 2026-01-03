export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = 'https://api.kie.ai/api/v1';
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET || 'video-studio';
const R2_CUSTOM_DOMAIN = 'video-studio.jarwater.com';

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

async function uploadVideoToR2(videoUrl: string, taskId: string): Promise<string> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Cloudflare R2 credentials not configured');
  }

  // Download video from Seedance
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) {
    throw new Error(`Failed to download video: ${videoRes.status}`);
  }

  const videoBuffer = await videoRes.arrayBuffer();
  const videoBytes = new Uint8Array(videoBuffer);

  // Determine extension from URL or default to mp4
  const urlPath = new URL(videoUrl).pathname;
  const extension = urlPath.split('.').pop() || 'mp4';
  const contentType = extension === 'mp4' ? 'video/mp4' : `video/${extension}`;

  // Generate unique filename
  const timestamp = Date.now();
  const filename = `videos/${timestamp}_${taskId}.${extension}`;

  // Upload to R2
  const r2Url = `https://${accountId}.r2.cloudflarestorage.com/${R2_BUCKET}/${filename}`;

  const headers: Record<string, string> = {
    'content-type': contentType,
    'content-length': videoBytes.length.toString(),
  };

  const signedHeaders = await signRequest(
    'PUT',
    r2Url,
    headers,
    videoBytes,
    { accessKeyId, secretAccessKey }
  );

  const uploadRes = await fetch(r2Url, {
    method: 'PUT',
    headers: signedHeaders,
    body: videoBytes.buffer as ArrayBuffer,
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    throw new Error(`R2 upload failed: ${uploadRes.status} - ${errorText}`);
  }

  // Return public URL
  return `https://${R2_CUSTOM_DOMAIN}/${filename}`;
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.MUSIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Kie.ai API key not configured' },
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
    const statusRes = await fetch(`${BASE_URL}/jobs/recordInfo?taskId=${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!statusRes.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch task status' },
        { status: statusRes.status }
      );
    }

    const statusJson: SeedanceStatusResponse = await statusRes.json();
    const taskData = statusJson.data;

    if (!taskData) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    if (taskData.state === 'success') {
      // Parse resultJson to get video URL
      if (taskData.resultJson) {
        try {
          const result = JSON.parse(taskData.resultJson);
          if (result.resultUrls && result.resultUrls.length > 0) {
            const seedanceVideoUrl = result.resultUrls[0];

            // Proxy through R2 for CORS support
            try {
              const r2VideoUrl = await uploadVideoToR2(seedanceVideoUrl, taskId);
              console.log(`[Seedance] Video proxied to R2: ${r2VideoUrl}`);
              return NextResponse.json({
                status: 'completed',
                videoUrl: r2VideoUrl
              });
            } catch (proxyError) {
              console.error('[Seedance] Failed to proxy video to R2:', proxyError);
              // Fall back to original URL if proxy fails
              return NextResponse.json({
                status: 'completed',
                videoUrl: seedanceVideoUrl
              });
            }
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
      return NextResponse.json({
        status: 'failed',
        error: taskData.failMsg || 'Seedance video generation failed'
      });
    }

    // state === 'waiting'
    return NextResponse.json({
      status: 'processing',
      taskId
    });

  } catch (error) {
    console.error('Seedance status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

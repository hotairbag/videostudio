export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';

const BYTEPLUS_API_BASE = 'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks';
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET || 'video-studio';
const R2_CUSTOM_DOMAIN = 'video-studio.jarwater.com';

// Edge-compatible base64 to Uint8Array conversion
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Create AWS Signature V4 for R2 (edge-compatible)
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

  // Hash the payload
  const payloadHash = await crypto.subtle.digest('SHA-256', body.buffer as ArrayBuffer);
  const payloadHashHex = Array.from(new Uint8Array(payloadHash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Prepare headers for signing
  const signedHeaders: Record<string, string> = {
    ...headers,
    'host': host,
    'x-amz-content-sha256': payloadHashHex,
    'x-amz-date': amzDate,
  };

  // Create canonical headers string
  const headerKeys = Object.keys(signedHeaders).sort();
  const canonicalHeaders = headerKeys
    .map(key => `${key.toLowerCase()}:${signedHeaders[key].trim()}`)
    .join('\n') + '\n';
  const signedHeadersStr = headerKeys.map(k => k.toLowerCase()).join(';');

  // Create canonical request
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeadersStr,
    payloadHashHex,
  ].join('\n');

  // Hash canonical request
  const canonicalRequestHash = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(canonicalRequest)
  );
  const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Create string to sign
  const service = 's3';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    canonicalRequestHashHex,
  ].join('\n');

  // Calculate signing key
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

  // Calculate signature
  const signature = await hmacSha256(kSigning, stringToSign);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Create authorization header
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

  // Fetch video from BytePlus
  const fetchStart = Date.now();
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) {
    throw new Error(`Failed to fetch video from BytePlus: ${videoRes.status}`);
  }

  const videoData = new Uint8Array(await videoRes.arrayBuffer());
  const fetchTime = Date.now() - fetchStart;
  const sizeMB = (videoData.length / 1024 / 1024).toFixed(2);
  console.log(`[BytePlus→Worker] Downloaded ${sizeMB}MB in ${fetchTime}ms (${(parseFloat(sizeMB) / (fetchTime / 1000)).toFixed(1)} MB/s)`);

  // Determine file extension from URL or content type
  const urlPath = new URL(videoUrl).pathname;
  const extension = urlPath.includes('.mp4') ? 'mp4' : 'mp4';
  const filename = `byteplus/${taskId}.${extension}`;

  const r2Url = `https://${accountId}.r2.cloudflarestorage.com/${R2_BUCKET}/${filename}`;

  const headers: Record<string, string> = {
    'content-type': 'video/mp4',
    'content-length': videoData.length.toString(),
  };

  const signedHeaders = await signRequest(
    'PUT',
    r2Url,
    headers,
    videoData,
    { accessKeyId, secretAccessKey }
  );

  const uploadStart = Date.now();
  const uploadRes = await fetch(r2Url, {
    method: 'PUT',
    headers: signedHeaders,
    body: videoData.buffer as ArrayBuffer,
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    throw new Error(`R2 upload failed: ${uploadRes.status} - ${errorText}`);
  }

  const uploadTime = Date.now() - uploadStart;
  console.log(`[Worker→R2] Uploaded ${sizeMB}MB in ${uploadTime}ms (${(parseFloat(sizeMB) / (uploadTime / 1000)).toFixed(1)} MB/s)`);
  console.log(`[Total] BytePlus→R2 transfer: ${fetchTime + uploadTime}ms for ${sizeMB}MB`);

  // Return public URL
  return `https://${R2_CUSTOM_DOMAIN}/${filename}`;
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.BYTEPLUS_ARK_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'BytePlus ARK API key not configured' },
      { status: 500 }
    );
  }

  const taskId = request.nextUrl.searchParams.get('taskId');

  if (!taskId) {
    return NextResponse.json(
      { error: 'Missing taskId parameter' },
      { status: 400 }
    );
  }

  try {
    // Query task status from BytePlus
    const statusRes = await fetch(`${BYTEPLUS_API_BASE}/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!statusRes.ok) {
      const errorText = await statusRes.text();
      console.error('[BytePlus] Status query failed:', statusRes.status, errorText);
      return NextResponse.json(
        { error: `BytePlus status query failed: ${statusRes.status}` },
        { status: statusRes.status }
      );
    }

    const taskData = await statusRes.json();
    console.log('[BytePlus] Task status:', taskData.status, 'for task:', taskId);

    // Map BytePlus status to our status format
    // BytePlus statuses: queued, running, succeeded, failed, expired
    if (taskData.status === 'succeeded') {
      // Extract video URL from response - BytePlus returns content.video_url directly
      const byteplusVideoUrl = taskData.content?.video_url;

      if (!byteplusVideoUrl) {
        console.error('[BytePlus] Video URL not found in response:', JSON.stringify(taskData, null, 2));
        return NextResponse.json(
          { error: 'Video generated but URL not found in response' },
          { status: 500 }
        );
      }

      // Upload to R2 for CORS support - BytePlus URLs don't work directly in browser
      const r2VideoUrl = await uploadVideoToR2(byteplusVideoUrl, taskId);
      console.log(`[BytePlus] Video saved to R2: ${r2VideoUrl}`);
      return NextResponse.json({
        status: 'completed',
        videoUrl: r2VideoUrl
      });
    } else if (taskData.status === 'failed') {
      return NextResponse.json({
        status: 'failed',
        error: taskData.error?.message || 'BytePlus video generation failed'
      });
    } else if (taskData.status === 'expired') {
      return NextResponse.json({
        status: 'failed',
        error: 'Task expired before completion'
      });
    } else {
      // queued or running - still processing
      return NextResponse.json({
        status: 'processing',
        byteplusStatus: taskData.status
      });
    }

  } catch (error) {
    console.error('[BytePlus] Status check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

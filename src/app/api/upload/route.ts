export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';

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

async function uploadToR2(
  filename: string,
  data: Uint8Array,
  contentType: string
): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Cloudflare R2 credentials not configured');
  }

  const url = `https://${accountId}.r2.cloudflarestorage.com/${R2_BUCKET}/${filename}`;

  const headers: Record<string, string> = {
    'content-type': contentType,
    'content-length': data.length.toString(),
  };

  const signedHeaders = await signRequest(
    'PUT',
    url,
    headers,
    data,
    { accessKeyId, secretAccessKey }
  );

  const response = await fetch(url, {
    method: 'PUT',
    headers: signedHeaders,
    body: data.buffer as ArrayBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`R2 upload failed: ${response.status} - ${errorText}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { images } = await request.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: 'No images provided' },
        { status: 400 }
      );
    }

    const uploadedUrls: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const base64Data = images[i];

      // Handle data URL format (data:image/png;base64,...)
      const base64Content = base64Data.includes(',')
        ? base64Data.split(',')[1]
        : base64Data;

      // Detect mime type from data URL or default to png
      let mimeType = 'image/png';
      let extension = 'png';
      if (base64Data.startsWith('data:')) {
        const mimeMatch = base64Data.match(/data:([^;]+);/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
          extension = mimeType.split('/')[1] || 'png';
        }
      }

      // Generate unique filename
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 10);
      const filename = `frames/${timestamp}_${randomId}_${i}.${extension}`;

      // Convert base64 to Uint8Array (edge-compatible)
      const bytes = base64ToUint8Array(base64Content);

      // Upload to R2 using signed fetch
      await uploadToR2(filename, bytes, mimeType);

      // Build public URL using custom domain
      const publicUrl = `https://${R2_CUSTOM_DOMAIN}/${filename}`;
      uploadedUrls.push(publicUrl);
    }

    return NextResponse.json({ urls: uploadedUrls });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

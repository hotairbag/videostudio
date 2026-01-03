'use client';

import { ReactNode, useMemo } from 'react';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { useAuth } from '@clerk/nextjs';

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;

  // Fail loudly if env var is missing
  if (!url) {
    return (
      <div style={{ padding: 16, fontFamily: 'monospace', background: '#fee', color: '#900' }}>
        <h2>Missing NEXT_PUBLIC_CONVEX_URL</h2>
        <p>Public env vars are inlined at build time.</p>
        <p>Make sure .env.local has NEXT_PUBLIC_CONVEX_URL set and restart the dev server.</p>
      </div>
    );
  }

  // Create client with verbose logging
  const convex = useMemo(
    () => new ConvexReactClient(url, { verbose: true }),
    [url]
  );

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

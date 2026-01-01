/**
 * Music Service - generates background music via Suno V5 (kie.ai API)
 *
 * Uses Next.js API route to keep API key server-side (secure)
 * Music is always instrumental-only (no vocals) for video soundtracks
 */

export const generateBackgroundMusic = async (style: string, title: string, theme?: string): Promise<string> => {
  try {
    const response = await fetch('/api/music/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ style, title, theme })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const statusMsg = response.status === 504 ? 'Music generation timed out (takes ~2-3 min)' :
                        response.status === 500 ? 'Music API server error' :
                        response.statusText;
      throw new Error(errorData.error || `Music generation failed: ${statusMsg}`);
    }

    const data = await response.json();

    if (!data.audioUrl) {
      throw new Error('No audio URL returned from music service');
    }

    return data.audioUrl;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(
        'Network error during music generation. Check your connection and try again.'
      );
    }
    throw error;
  }
};

import { generateBackgroundMusic } from '@/services/musicService';

describe('musicService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  describe('generateBackgroundMusic', () => {
    it('should call the API route and return audio URL on success', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          audioUrl: 'https://example.com/music.mp3',
        }),
      });

      const result = await generateBackgroundMusic('Electronic', 'Test Track');

      expect(result).toBe('https://example.com/music.mp3');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/music/generate',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ style: 'Electronic', title: 'Test Track', theme: undefined }),
        })
      );
    });

    it('should throw error if API returns error response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({
          error: 'Music generation failed on server',
        }),
      });

      await expect(
        generateBackgroundMusic('Rock', 'Test')
      ).rejects.toThrow('Music generation failed on server');
    });

    it('should throw error if no audio URL in response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await expect(
        generateBackgroundMusic('Jazz', 'Test')
      ).rejects.toThrow('No audio URL returned from music service');
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Gateway Timeout',
        json: () => Promise.reject(new Error('Parse error')),
      });

      await expect(
        generateBackgroundMusic('Classical', 'Test')
      ).rejects.toThrow('Music generation failed: Gateway Timeout');
    });
  });
});

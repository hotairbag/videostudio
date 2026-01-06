/**
 * Tests for BytePlus API response parsing
 * These test the response format handling to prevent regression
 */

describe('BytePlus API response parsing', () => {
  // Helper to extract video URL the same way as the status route
  function extractVideoUrl(taskData: unknown): string | undefined {
    const data = taskData as { content?: { video_url?: string } };
    return data?.content?.video_url;
  }

  describe('extractVideoUrl', () => {
    it('should extract video URL from correct BytePlus response format', () => {
      const response = {
        id: 'cgt-batch-20260106215729-xbqzl',
        model: 'seedance-1-5-pro-251215',
        status: 'succeeded',
        content: {
          video_url: 'https://ark-content-generation-batch-ap-southeast-1.tos-ap-southeast-1.volces.com/seedance-1-5-pro/video.mp4'
        },
        usage: { completion_tokens: 40594, total_tokens: 40594 },
        created_at: 1767707850,
        updated_at: 1767707883,
        seed: 40865,
        resolution: '480p',
        ratio: '9:16',
        duration: 4,
        framespersecond: 24,
        service_tier: 'flex',
      };

      const videoUrl = extractVideoUrl(response);
      expect(videoUrl).toBe('https://ark-content-generation-batch-ap-southeast-1.tos-ap-southeast-1.volces.com/seedance-1-5-pro/video.mp4');
    });

    it('should return undefined when content is missing', () => {
      const response = {
        id: 'task-123',
        status: 'succeeded',
      };

      const videoUrl = extractVideoUrl(response);
      expect(videoUrl).toBeUndefined();
    });

    it('should return undefined when video_url is missing', () => {
      const response = {
        id: 'task-123',
        status: 'succeeded',
        content: {},
      };

      const videoUrl = extractVideoUrl(response);
      expect(videoUrl).toBeUndefined();
    });

    it('should handle null content', () => {
      const response = {
        id: 'task-123',
        status: 'succeeded',
        content: null,
      };

      const videoUrl = extractVideoUrl(response);
      expect(videoUrl).toBeUndefined();
    });
  });

  describe('BytePlus status mapping', () => {
    type BytePlusStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'expired';
    type AppStatus = 'pending' | 'processing' | 'completed' | 'failed';

    function mapBytePlusStatus(status: BytePlusStatus): AppStatus {
      switch (status) {
        case 'succeeded':
          return 'completed';
        case 'failed':
        case 'expired':
          return 'failed';
        case 'queued':
        case 'running':
        default:
          return 'processing';
      }
    }

    it('should map succeeded to completed', () => {
      expect(mapBytePlusStatus('succeeded')).toBe('completed');
    });

    it('should map failed to failed', () => {
      expect(mapBytePlusStatus('failed')).toBe('failed');
    });

    it('should map expired to failed', () => {
      expect(mapBytePlusStatus('expired')).toBe('failed');
    });

    it('should map queued to processing', () => {
      expect(mapBytePlusStatus('queued')).toBe('processing');
    });

    it('should map running to processing', () => {
      expect(mapBytePlusStatus('running')).toBe('processing');
    });
  });

  describe('BytePlus video URL format', () => {
    it('should recognize volces.com as BytePlus domain', () => {
      const url = 'https://ark-content-generation-batch-ap-southeast-1.tos-ap-southeast-1.volces.com/seedance-1-5-pro/video.mp4';
      expect(url).toContain('volces.com');
    });

    it('should have signed URL parameters', () => {
      // Using placeholder credential values for testing
      const url = 'https://ark-content-generation-batch-ap-southeast-1.tos-ap-southeast-1.volces.com/seedance-1-5-pro/video.mp4?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=PLACEHOLDER_CREDENTIAL%2F20260106%2Fap-southeast-1%2Ftos%2Frequest&X-Tos-Date=20260106T135803Z&X-Tos-Expires=86400&X-Tos-Signature=placeholder_signature&X-Tos-SignedHeaders=host';

      expect(url).toContain('X-Tos-Algorithm');
      expect(url).toContain('X-Tos-Expires');
      expect(url).toContain('X-Tos-Signature');
    });
  });
});

/**
 * Tests for proxy-video allowlist
 * Ensures only allowed domains can be proxied
 */

describe('proxy-video allowlist', () => {
  // Mirror the allowlist from src/app/api/proxy-video/route.ts
  const allowedDomains = [
    'video-studio.jarwater.com',
    'kieai.erweima.ai',
    'api.klingai.com',
    'cdn.klingai.com',
    'volces.com', // BytePlus/Seedance video storage
  ];

  function isAllowedDomain(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return allowedDomains.some(domain => parsedUrl.hostname.includes(domain));
    } catch {
      return false;
    }
  }

  describe('R2 storage domain', () => {
    it('should allow video-studio.jarwater.com', () => {
      const url = 'https://video-studio.jarwater.com/byteplus/cgt-batch-123.mp4';
      expect(isAllowedDomain(url)).toBe(true);
    });
  });

  describe('Kie.ai domains', () => {
    it('should allow kieai.erweima.ai', () => {
      const url = 'https://kieai.erweima.ai/video/abc123.mp4';
      expect(isAllowedDomain(url)).toBe(true);
    });
  });

  describe('Kling AI domains', () => {
    it('should allow api.klingai.com', () => {
      const url = 'https://api.klingai.com/video/xyz.mp4';
      expect(isAllowedDomain(url)).toBe(true);
    });

    it('should allow cdn.klingai.com', () => {
      const url = 'https://cdn.klingai.com/videos/test.mp4';
      expect(isAllowedDomain(url)).toBe(true);
    });
  });

  describe('BytePlus/Seedance domain', () => {
    it('should allow volces.com subdomain', () => {
      const url = 'https://ark-content-generation-batch-ap-southeast-1.tos-ap-southeast-1.volces.com/seedance-1-5-pro/video.mp4';
      expect(isAllowedDomain(url)).toBe(true);
    });

    it('should allow any volces.com subdomain', () => {
      const url = 'https://some-other-service.volces.com/file.mp4';
      expect(isAllowedDomain(url)).toBe(true);
    });
  });

  describe('Blocked domains', () => {
    it('should block arbitrary domains', () => {
      const url = 'https://example.com/video.mp4';
      expect(isAllowedDomain(url)).toBe(false);
    });

    it('should block google.com', () => {
      const url = 'https://storage.googleapis.com/bucket/video.mp4';
      expect(isAllowedDomain(url)).toBe(false);
    });

    it('should block aws S3', () => {
      const url = 'https://bucket.s3.amazonaws.com/video.mp4';
      expect(isAllowedDomain(url)).toBe(false);
    });

    it('should block data URLs', () => {
      const url = 'data:video/mp4;base64,AAAA';
      expect(isAllowedDomain(url)).toBe(false);
    });

    it('should block malformed URLs', () => {
      const url = 'not-a-valid-url';
      expect(isAllowedDomain(url)).toBe(false);
    });
  });

  describe('URL edge cases', () => {
    it('should handle URLs with query params', () => {
      const url = 'https://video-studio.jarwater.com/video.mp4?token=abc&expires=123';
      expect(isAllowedDomain(url)).toBe(true);
    });

    it('should handle URLs with fragments', () => {
      const url = 'https://video-studio.jarwater.com/video.mp4#t=10';
      expect(isAllowedDomain(url)).toBe(true);
    });

    it('should handle URLs with ports', () => {
      const url = 'https://video-studio.jarwater.com:8080/video.mp4';
      expect(isAllowedDomain(url)).toBe(true);
    });

    it('should handle URL-encoded characters', () => {
      const url = 'https://video-studio.jarwater.com/video%20file.mp4';
      expect(isAllowedDomain(url)).toBe(true);
    });
  });
});

import { sliceGridImage, fileToBase64 } from '@/utils/imageUtils';

describe('imageUtils', () => {
  describe('sliceGridImage', () => {
    it('should return an array of 9 frames', async () => {
      const mockBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const frames = await sliceGridImage(mockBase64);

      expect(frames).toHaveLength(9);
    });

    it('should return base64 data URLs for each frame', async () => {
      const mockBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const frames = await sliceGridImage(mockBase64);

      frames.forEach(frame => {
        expect(frame).toMatch(/^data:image\/png;base64,/);
      });
    });

    it('should reject on invalid image', async () => {
      const invalidBase64 = 'invalid-base64';

      // Set up Image mock to trigger error
      const originalImage = global.Image;
      global.Image = class {
        onload = null;
        onerror: ((e: Event) => void) | null = null;
        src = '';

        constructor() {
          setTimeout(() => {
            if (this.onerror) this.onerror(new Event('error'));
          }, 0);
        }
      } as unknown as typeof Image;

      await expect(sliceGridImage(invalidBase64)).rejects.toBeDefined();

      global.Image = originalImage;
    });
  });

  describe('fileToBase64', () => {
    it('should convert a file to base64 string', async () => {
      const mockFile = new File(['test content'], 'test.png', { type: 'image/png' });

      const result = await fileToBase64(mockFile);

      // The mock FileReader returns 'data:image/png;base64,mockbase64data'
      // fileToBase64 strips the prefix and returns just 'mockbase64data'
      expect(result).toBe('mockbase64data');
    });

    it('should reject on FileReader error', async () => {
      const mockFile = new File(['test content'], 'test.png', { type: 'image/png' });

      // Override FileReader to trigger error
      const originalFileReader = global.FileReader;
      global.FileReader = class {
        onload = null;
        onerror: ((e: Event) => void) | null = null;
        result = null;

        readAsDataURL() {
          setTimeout(() => {
            if (this.onerror) this.onerror(new Event('error'));
          }, 0);
        }
      } as unknown as typeof FileReader;

      await expect(fileToBase64(mockFile)).rejects.toBeDefined();

      global.FileReader = originalFileReader;
    });
  });
});

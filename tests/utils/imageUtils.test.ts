import { sliceGridImage, sliceGrid3x2Image, fileToBase64, getCanvasDimensions } from '@/utils/imageUtils';

describe('imageUtils', () => {
  describe('getCanvasDimensions', () => {
    it('should return 1280x720 for 16:9 aspect ratio', () => {
      const dims = getCanvasDimensions('16:9');
      expect(dims).toEqual({ width: 1280, height: 720 });
    });

    it('should return 720x1280 for 9:16 aspect ratio', () => {
      const dims = getCanvasDimensions('9:16');
      expect(dims).toEqual({ width: 720, height: 1280 });
    });
  });

  describe('sliceGridImage', () => {
    it('should set crossOrigin attribute for CORS support', async () => {
      // Track if crossOrigin was set
      let crossOriginSet = false;
      const originalImage = global.Image;

      global.Image = class {
        onload: (() => void) | null = null;
        onerror: ((e: Event) => void) | null = null;
        _src = '';
        _crossOrigin = '';

        get crossOrigin() { return this._crossOrigin; }
        set crossOrigin(value: string) {
          this._crossOrigin = value;
          crossOriginSet = true;
        }

        get src() { return this._src; }
        set src(value: string) {
          this._src = value;
          // Trigger onload after crossOrigin should have been set
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }

        width = 300;
        height = 300;
      } as unknown as typeof Image;

      const mockBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      try {
        await sliceGridImage(mockBase64);
      } catch {
        // May fail due to canvas mock, but we only care about crossOrigin
      }

      expect(crossOriginSet).toBe(true);
      global.Image = originalImage;
    });

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

  describe('sliceGrid3x2Image', () => {
    it('should set crossOrigin attribute for CORS support', async () => {
      // Track if crossOrigin was set
      let crossOriginSet = false;
      const originalImage = global.Image;

      global.Image = class {
        onload: (() => void) | null = null;
        onerror: ((e: Event) => void) | null = null;
        _src = '';
        _crossOrigin = '';

        get crossOrigin() { return this._crossOrigin; }
        set crossOrigin(value: string) {
          this._crossOrigin = value;
          crossOriginSet = true;
        }

        get src() { return this._src; }
        set src(value: string) {
          this._src = value;
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }

        width = 300;
        height = 200;
      } as unknown as typeof Image;

      const mockBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      try {
        await sliceGrid3x2Image(mockBase64);
      } catch {
        // May fail due to canvas mock, but we only care about crossOrigin
      }

      expect(crossOriginSet).toBe(true);
      global.Image = originalImage;
    });

    it('should return an array of 6 frames for 3x2 grid', async () => {
      const mockBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const frames = await sliceGrid3x2Image(mockBase64);

      expect(frames).toHaveLength(6);
    });

    it('should return base64 data URLs for each frame', async () => {
      const mockBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const frames = await sliceGrid3x2Image(mockBase64);

      frames.forEach(frame => {
        expect(frame).toMatch(/^data:image\/png;base64,/);
      });
    });

    it('should reject on invalid image', async () => {
      const invalidBase64 = 'invalid-base64';

      const originalImage = global.Image;
      global.Image = class {
        onload = null;
        onerror: ((e: Event) => void) | null = null;
        src = '';
        crossOrigin = '';

        constructor() {
          setTimeout(() => {
            if (this.onerror) this.onerror(new Event('error'));
          }, 0);
        }
      } as unknown as typeof Image;

      await expect(sliceGrid3x2Image(invalidBase64)).rejects.toBeDefined();

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

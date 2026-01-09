import { setApiKey, getApiKey, generateScript, generateStoryboard, generateVideoForScene, generateMasterAudio } from '@/services/geminiService';
import { Scene, Script } from '@/types';

// Mock the @google/genai module
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: jest.fn(),
      generateVideos: jest.fn(),
    },
    operations: {
      getVideosOperation: jest.fn(),
    },
  })),
  Type: {
    OBJECT: 'object',
    STRING: 'string',
    ARRAY: 'array',
    INTEGER: 'integer',
  },
  Modality: {
    AUDIO: 'AUDIO',
  },
  HarmCategory: {
    HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
    HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
  },
  HarmBlockThreshold: {
    BLOCK_NONE: 'BLOCK_NONE',
  },
}));

// Mock URL.createObjectURL
const mockCreateObjectURL = jest.fn().mockReturnValue('blob:mock-url');
global.URL.createObjectURL = mockCreateObjectURL;

describe('geminiService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateObjectURL.mockClear();
    // Reset window API key
    if (typeof window !== 'undefined') {
      delete (window as Window & { __GOOGLE_API_KEY__?: string }).__GOOGLE_API_KEY__;
    }
    // Reset environment
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('setApiKey / getApiKey', () => {
    it('should set and retrieve API key from window', () => {
      setApiKey('test-api-key');
      expect(getApiKey()).toBe('test-api-key');
    });

    it('should return environment variable if window key not set', () => {
      process.env.NEXT_PUBLIC_GOOGLE_API_KEY = 'env-api-key';
      expect(getApiKey()).toBe('env-api-key');
    });

    it('should prioritize window key over environment variable', () => {
      process.env.NEXT_PUBLIC_GOOGLE_API_KEY = 'env-api-key';
      setApiKey('window-api-key');
      expect(getApiKey()).toBe('window-api-key');
    });

    it('should return undefined if no API key is set', () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
      expect(getApiKey()).toBeUndefined();
    });
  });

  describe('generateScript', () => {
    const mockScript: Script = {
      title: 'Test Video',
      style: 'Cinematic',
      scenes: [
        {
          id: 1,
          timeRange: '00:00 - 00:07',
          visualDescription: 'Opening scene',
          audioDescription: 'Ambient sounds',
          cameraShot: 'Wide',
          voiceoverText: 'Welcome',
        },
      ],
    };

    it('should throw error if API key is not set', async () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

      await expect(generateScript('Test prompt')).rejects.toThrow(
        'API Key not found'
      );
    });

    it('should call generateContent with correct parameters', async () => {
      setApiKey('test-key');

      const { GoogleGenAI } = require('@google/genai');
      const mockGenerateContent = jest.fn().mockResolvedValue({
        text: JSON.stringify(mockScript),
      });
      GoogleGenAI.mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent,
        },
      }));

      const result = await generateScript('Make a video about cats');

      // Verify generateContent was called with correct model
      expect(mockGenerateContent).toHaveBeenCalled();
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.model).toBe('gemini-3-flash-preview');
      expect(callArgs.config.responseMimeType).toBe('application/json');
      expect(result).toEqual(mockScript);
    });

    it('should include reference video in parts if provided', async () => {
      setApiKey('test-key');

      const { GoogleGenAI } = require('@google/genai');
      const mockGenerateContent = jest.fn().mockResolvedValue({
        text: JSON.stringify(mockScript),
      });
      GoogleGenAI.mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent,
        },
      }));

      await generateScript('Test prompt', 'base64videodata');

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.objectContaining({
            parts: expect.arrayContaining([
              expect.objectContaining({
                inlineData: expect.objectContaining({
                  mimeType: 'video/mp4',
                  data: 'base64videodata',
                }),
              }),
            ]),
          }),
        })
      );
    });

    it('should include reference image in parts if provided', async () => {
      setApiKey('test-key');

      const { GoogleGenAI } = require('@google/genai');
      const mockGenerateContent = jest.fn().mockResolvedValue({
        text: JSON.stringify(mockScript),
      });
      GoogleGenAI.mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent,
        },
      }));

      await generateScript('Test prompt', undefined, ['base64imagedata']);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.objectContaining({
            parts: expect.arrayContaining([
              expect.objectContaining({
                inlineData: expect.objectContaining({
                  mimeType: 'image/jpeg',
                  data: 'base64imagedata',
                }),
              }),
            ]),
          }),
        })
      );
    });

    it('should throw error if no text generated', async () => {
      setApiKey('test-key');

      const { GoogleGenAI } = require('@google/genai');
      GoogleGenAI.mockImplementation(() => ({
        models: {
          generateContent: jest.fn().mockResolvedValue({ text: null }),
        },
      }));

      await expect(generateScript('Test')).rejects.toThrow('No script generated');
    });
  });

  describe('generateStoryboard', () => {
    const mockScript: Script = {
      title: 'Test Video',
      style: 'Cinematic',
      scenes: [
        {
          id: 1,
          timeRange: '00:00 - 00:07',
          visualDescription: 'Scene description',
          audioDescription: 'Audio',
          cameraShot: 'Wide',
          voiceoverText: 'Text',
        },
      ],
    };

    it('should call generateContent with image model', async () => {
      setApiKey('test-key');

      const { GoogleGenAI } = require('@google/genai');
      const mockGenerateContent = jest.fn().mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: 'base64imagedata',
                  },
                },
              ],
            },
          },
        ],
      });
      GoogleGenAI.mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent,
        },
      }));

      const result = await generateStoryboard(mockScript);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-3-pro-image-preview',
        })
      );
      // Now returns object with imageDataUrl and seed
      expect(result).toEqual({
        imageDataUrl: 'data:image/png;base64,base64imagedata',
        seed: expect.any(Number)
      });
    });

    it('should throw error if no image generated', async () => {
      setApiKey('test-key');

      const { GoogleGenAI } = require('@google/genai');
      GoogleGenAI.mockImplementation(() => ({
        models: {
          generateContent: jest.fn().mockResolvedValue({
            candidates: [{ content: { parts: [] } }],
          }),
        },
      }));

      await expect(generateStoryboard(mockScript)).rejects.toThrow('No image generated');
    });

    it('should include continuation instructions when totalScenes > 9', async () => {
      setApiKey('test-key');

      const { GoogleGenAI } = require('@google/genai');
      const mockGenerateContent = jest.fn().mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { data: 'base64imagedata' } }],
            },
          },
        ],
      });
      GoogleGenAI.mockImplementation(() => ({
        models: { generateContent: mockGenerateContent },
      }));

      await generateStoryboard(mockScript, undefined, '16:9', 15);

      // Verify the prompt includes continuation instructions
      const callArgs = mockGenerateContent.mock.calls[0][0];
      const promptText = callArgs.contents.parts[0].text;
      expect(promptText).toContain('STORY CONTINUATION');
      expect(promptText).toContain('scenes 1-9 of a 15-scene story');
      expect(promptText).toContain('Panel 9 should NOT show any ending');
    });

    it('should NOT include continuation instructions when totalScenes is 9', async () => {
      setApiKey('test-key');

      const { GoogleGenAI } = require('@google/genai');
      const mockGenerateContent = jest.fn().mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { data: 'base64imagedata' } }],
            },
          },
        ],
      });
      GoogleGenAI.mockImplementation(() => ({
        models: { generateContent: mockGenerateContent },
      }));

      await generateStoryboard(mockScript, undefined, '16:9', 9);

      // Verify the prompt does NOT include continuation instructions
      const callArgs = mockGenerateContent.mock.calls[0][0];
      const promptText = callArgs.contents.parts[0].text;
      expect(promptText).not.toContain('STORY CONTINUATION');
    });
  });

  describe('generateStoryboard2', () => {
    const mockScript15Scenes = {
      title: 'Test Video',
      style: 'cinematic',
      scenes: Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        timeRange: `00:0${Math.floor(i * 4 / 60)}:0${(i * 4) % 60} - 00:0${Math.floor((i + 1) * 4 / 60)}:0${((i + 1) * 4) % 60}`,
        visualDescription: `Scene ${i + 1} description`,
        audioDescription: 'Audio',
        cameraShot: 'Wide',
        voiceoverText: `Text for scene ${i + 1}`,
      })),
    };

    it('should use 16:9 aspect ratio for landscape second storyboard grid', async () => {
      setApiKey('test-key');

      const { GoogleGenAI } = require('@google/genai');
      const mockGenerateContent = jest.fn().mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { data: 'base64imagedata' } }],
            },
          },
        ],
      });
      GoogleGenAI.mockImplementation(() => ({
        models: { generateContent: mockGenerateContent },
      }));

      const { generateStoryboard2 } = require('@/services/geminiService');
      const mockFirstGrid = 'data:image/png;base64,abc';

      await generateStoryboard2(mockScript15Scenes, mockFirstGrid, undefined, '16:9');

      // Verify the image config uses 16:9 aspect ratio for landscape
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.config.imageConfig.aspectRatio).toBe('16:9');
      // The prompt describes landscape proportions
      expect(callArgs.contents.parts[0].text).toContain('16:9 landscape proportions');
    });

    it('should use 4:5 aspect ratio for 9:16 portrait second storyboard grid', async () => {
      setApiKey('test-key');

      const { GoogleGenAI } = require('@google/genai');
      const mockGenerateContent = jest.fn().mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { data: 'base64imagedata' } }],
            },
          },
        ],
      });
      GoogleGenAI.mockImplementation(() => ({
        models: { generateContent: mockGenerateContent },
      }));

      const { generateStoryboard2 } = require('@/services/geminiService');
      const mockFirstGrid = 'data:image/png;base64,abc';

      await generateStoryboard2(mockScript15Scenes, mockFirstGrid, undefined, '9:16');

      // Verify the image config uses 4:5 aspect ratio for portrait
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.config.imageConfig.aspectRatio).toBe('4:5');
      // The prompt mentions portrait proportions
      expect(callArgs.contents.parts[0].text).toContain('9:16 portrait proportions');
    });

    it('should include grid layout and style instructions', async () => {
      setApiKey('test-key');

      const { GoogleGenAI } = require('@google/genai');
      const mockGenerateContent = jest.fn().mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { data: 'base64imagedata' } }],
            },
          },
        ],
      });
      GoogleGenAI.mockImplementation(() => ({
        models: { generateContent: mockGenerateContent },
      }));

      const { generateStoryboard2 } = require('@/services/geminiService');
      const mockFirstGrid = 'data:image/png;base64,abc';

      await generateStoryboard2(mockScript15Scenes, mockFirstGrid, undefined, '16:9');

      // Verify the prompt includes grid and style instructions
      const callArgs = mockGenerateContent.mock.calls[0][0];
      const promptText = callArgs.contents.parts[0].text;
      expect(promptText).toContain('3×2 grid');
      expect(promptText).toContain('FINAL 6 scenes of a 15-scene story');
    });
  });

  describe('generateVideoForScene', () => {
    const mockScene: Scene = {
      id: 1,
      timeRange: '00:00 - 00:07',
      visualDescription: 'A cat sleeping',
      audioDescription: 'Purring sounds',
      cameraShot: 'Close Up',
      voiceoverText: 'Look at this cat',
    };

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should use proxy for R2 URLs to avoid CORS', async () => {
      setApiKey('test-key');

      const { GoogleGenAI } = require('@google/genai');
      const mockGenerateVideos = jest.fn().mockResolvedValue({
        done: true,
        response: {
          generatedVideos: [
            { video: { uri: 'https://example.com/video.mp4' } },
          ],
        },
      });

      GoogleGenAI.mockImplementation(() => ({
        models: {
          generateVideos: mockGenerateVideos,
        },
        operations: {
          getVideosOperation: jest.fn(),
        },
      }));

      // Mock fetch - first call is for image proxy, second for video download
      const mockImageData = new Uint8Array([137, 80, 78, 71]); // PNG header
      const mockVideoData = new Uint8Array([0, 0, 0, 0]);
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve({
            type: 'image/png',
            arrayBuffer: () => Promise.resolve(mockImageData.buffer),
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve({
            type: 'video/mp4',
            arrayBuffer: () => Promise.resolve(mockVideoData.buffer),
          }),
        });

      const r2Url = 'https://video-studio.jarwater.com/frames/test.png';
      const resultPromise = generateVideoForScene(mockScene, r2Url);

      const result = await resultPromise;

      // Verify that fetch was called with the proxy URL for R2 images
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/proxy-image?url=${encodeURIComponent(r2Url)}`
      );
      expect(result).toBe('blob:mock-url');
    });

    it('should fetch non-R2 URLs directly without proxy', async () => {
      setApiKey('test-key');

      const { GoogleGenAI } = require('@google/genai');
      const mockGenerateVideos = jest.fn().mockResolvedValue({
        done: true,
        response: {
          generatedVideos: [
            { video: { uri: 'https://example.com/video.mp4' } },
          ],
        },
      });

      GoogleGenAI.mockImplementation(() => ({
        models: {
          generateVideos: mockGenerateVideos,
        },
        operations: {
          getVideosOperation: jest.fn(),
        },
      }));

      const mockImageData = new Uint8Array([137, 80, 78, 71]);
      const mockVideoData = new Uint8Array([0, 0, 0, 0]);
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve({
            type: 'image/png',
            arrayBuffer: () => Promise.resolve(mockImageData.buffer),
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve({
            type: 'video/mp4',
            arrayBuffer: () => Promise.resolve(mockVideoData.buffer),
          }),
        });

      const externalUrl = 'https://other-domain.com/image.png';
      const resultPromise = generateVideoForScene(mockScene, externalUrl);

      const result = await resultPromise;

      // Verify that fetch was called directly without proxy
      expect(global.fetch).toHaveBeenCalledWith(externalUrl);
      expect(result).toBe('blob:mock-url');
    });

    it('should handle base64 data URLs without fetching', async () => {
      setApiKey('test-key');

      const { GoogleGenAI } = require('@google/genai');
      const mockGenerateVideos = jest.fn().mockResolvedValue({
        done: true,
        response: {
          generatedVideos: [
            { video: { uri: 'https://example.com/video.mp4' } },
          ],
        },
      });

      GoogleGenAI.mockImplementation(() => ({
        models: {
          generateVideos: mockGenerateVideos,
        },
        operations: {
          getVideosOperation: jest.fn(),
        },
      }));

      const mockVideoData = new Uint8Array([0, 0, 0, 0]);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve({
          type: 'video/mp4',
          arrayBuffer: () => Promise.resolve(mockVideoData.buffer),
        }),
      });

      const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const resultPromise = generateVideoForScene(mockScene, base64Data);

      const result = await resultPromise;

      // Verify generateVideos was called with stripped base64 (no data URL prefix)
      expect(mockGenerateVideos).toHaveBeenCalledWith(
        expect.objectContaining({
          image: expect.objectContaining({
            imageBytes: expect.not.stringContaining('data:'),
            mimeType: 'image/png',
          }),
        })
      );
      expect(result).toBe('blob:mock-url');
    });

    it('should poll until video is ready', async () => {
      setApiKey('test-key');

      const { GoogleGenAI } = require('@google/genai');
      const mockGenerateVideos = jest.fn().mockResolvedValue({
        done: false,
        name: 'operation-123',
      });
      const mockGetVideosOperation = jest.fn()
        .mockResolvedValueOnce({ done: false })
        .mockResolvedValueOnce({
          done: true,
          response: {
            generatedVideos: [
              { video: { uri: 'https://example.com/video.mp4' } },
            ],
          },
        });

      GoogleGenAI.mockImplementation(() => ({
        models: {
          generateVideos: mockGenerateVideos,
        },
        operations: {
          getVideosOperation: mockGetVideosOperation,
        },
      }));

      // Mock fetch for video download
      const mockBlob = new Blob(['video data'], { type: 'video/mp4' });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const resultPromise = generateVideoForScene(mockScene, 'data:image/png;base64,startframe');

      // Advance timers for polling
      await jest.advanceTimersByTimeAsync(5000);
      await jest.advanceTimersByTimeAsync(5000);

      const result = await resultPromise;

      expect(mockGenerateVideos).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'veo-3.1-fast-generate-preview',
        })
      );
      expect(result).toBe('blob:mock-url');
    });

    it('should throw error if video generation fails', async () => {
      setApiKey('test-key');

      const { GoogleGenAI } = require('@google/genai');
      GoogleGenAI.mockImplementation(() => ({
        models: {
          generateVideos: jest.fn().mockResolvedValue({
            done: true,
            error: { message: 'Generation failed' },
          }),
        },
        operations: {
          getVideosOperation: jest.fn(),
        },
      }));

      await expect(
        generateVideoForScene(mockScene, 'base64frame')
      ).rejects.toThrow('Video generation failed');
    });
  });

  describe('generateMasterAudio', () => {
    const mockScript: Script = {
      title: 'Test',
      style: 'Cinematic',
      scenes: [
        {
          id: 1,
          timeRange: '00:00 - 00:05',
          visualDescription: 'Scene 1',
          audioDescription: 'Audio 1',
          cameraShot: 'Wide',
          voiceoverText: 'Hello world',
        },
        {
          id: 2,
          timeRange: '00:05 - 00:10',
          visualDescription: 'Scene 2',
          audioDescription: 'Audio 2',
          cameraShot: 'Medium',
          voiceoverText: 'Goodbye world',
        },
      ],
    };

    it('should generate audio from combined voiceover text', async () => {
      setApiKey('test-key');

      const { GoogleGenAI, Modality } = require('@google/genai');
      const mockGenerateContent = jest.fn().mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/wav',
                    data: 'base64audiodata',
                  },
                },
              ],
            },
          },
        ],
      });
      GoogleGenAI.mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent,
        },
      }));

      const result = await generateMasterAudio(mockScript);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-flash-preview-tts',
          config: expect.objectContaining({
            responseModalities: [Modality.AUDIO],
          }),
        })
      );
      // Audio is returned as a blob URL via URL.createObjectURL
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(result).toBe('blob:mock-url');
    });

    it('should return empty string if no voiceover text', async () => {
      setApiKey('test-key');

      const emptyScript: Script = {
        title: 'Test',
        style: 'Cinematic',
        scenes: [
          {
            id: 1,
            timeRange: '00:00 - 00:05',
            visualDescription: 'Scene 1',
            audioDescription: 'Audio 1',
            cameraShot: 'Wide',
            voiceoverText: '',
          },
        ],
      };

      const result = await generateMasterAudio(emptyScript);
      expect(result).toBe('');
    });

    it('should throw error if audio generation fails', async () => {
      setApiKey('test-key');

      const { GoogleGenAI } = require('@google/genai');
      GoogleGenAI.mockImplementation(() => ({
        models: {
          generateContent: jest.fn().mockResolvedValue({
            candidates: [{ content: { parts: [] } }],
          }),
        },
      }));

      await expect(generateMasterAudio(mockScript)).rejects.toThrow('No audio data in response');
    });
  });
});

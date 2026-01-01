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
}));

describe('geminiService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
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

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-3-pro-preview',
          config: expect.objectContaining({
            responseMimeType: 'application/json',
          }),
        })
      );
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
      expect(result).toBe('data:image/png;base64,base64imagedata');
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
      // Audio is returned as data URL with correct mime type from response
      expect(result).toBe('data:audio/wav;base64,base64audiodata');
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

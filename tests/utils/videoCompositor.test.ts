import { Scene } from '@/types';

// Mock FFmpeg
const mockExec = jest.fn().mockResolvedValue(undefined);
const mockWriteFile = jest.fn().mockResolvedValue(undefined);
const mockReadFile = jest.fn().mockResolvedValue(new Uint8Array([0, 0, 0]));
const mockDeleteFile = jest.fn().mockResolvedValue(undefined);
const mockOn = jest.fn();
const mockLoad = jest.fn().mockResolvedValue(undefined);

jest.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: jest.fn().mockImplementation(() => ({
    load: mockLoad,
    exec: mockExec,
    writeFile: mockWriteFile,
    readFile: mockReadFile,
    deleteFile: mockDeleteFile,
    on: mockOn,
    loaded: false,
  })),
}));

jest.mock('@ffmpeg/util', () => ({
  fetchFile: jest.fn().mockResolvedValue(new Uint8Array([0, 0, 0])),
  toBlobURL: jest.fn().mockResolvedValue('blob:mock-url'),
}));

// Import after mocking
import { composeAndExportVideo } from '@/utils/videoCompositor';

describe('videoCompositor with FFmpeg', () => {
  const mockScenes: Scene[] = [
    {
      id: 1,
      timeRange: '00:00 - 00:04',
      visualDescription: 'Scene 1',
      audioDescription: 'SFX 1',
      cameraShot: 'Wide',
      voiceoverText: 'Hello',
    },
    {
      id: 2,
      timeRange: '00:04 - 00:08',
      visualDescription: 'Scene 2',
      audioDescription: 'SFX 2',
      cameraShot: 'Medium',
      voiceoverText: 'World',
    },
  ];

  const mockVideoUrls: Record<number, string> = {
    1: 'https://example.com/video-1.mp4',
    2: 'https://example.com/video-2.mp4',
  };

  const mockMasterAudioUrl = 'https://example.com/audio.mp3';
  const mockBackgroundMusicUrl = 'https://example.com/music.mp3';

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the loaded state for each test
    const { FFmpeg } = require('@ffmpeg/ffmpeg');
    FFmpeg.mockImplementation(() => ({
      load: mockLoad,
      exec: mockExec,
      writeFile: mockWriteFile,
      readFile: mockReadFile,
      deleteFile: mockDeleteFile,
      on: mockOn,
      loaded: false,
    }));
  });

  it('should call onProgress with status messages', async () => {
    const onProgress = jest.fn();

    await composeAndExportVideo(
      mockScenes,
      mockVideoUrls,
      mockMasterAudioUrl,
      mockBackgroundMusicUrl,
      onProgress,
      '16:9',
      'seedance-1.5',
      true,
      undefined,
      false
    );

    expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('Loading FFmpeg'));
    expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('Downloading'));
  });

  it('should return a Blob with video/mp4 type', async () => {
    const onProgress = jest.fn();

    const result = await composeAndExportVideo(
      mockScenes,
      mockVideoUrls,
      mockMasterAudioUrl,
      mockBackgroundMusicUrl,
      onProgress,
      '16:9',
      'seedance-1.5'
    );

    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('video/mp4');
  });

  it('should throw error if no videos to export', async () => {
    const onProgress = jest.fn();

    await expect(
      composeAndExportVideo(
        mockScenes,
        {}, // No video URLs
        mockMasterAudioUrl,
        null,
        onProgress
      )
    ).rejects.toThrow('No videos to export');
  });

  it('should handle missing background music gracefully', async () => {
    const onProgress = jest.fn();

    const result = await composeAndExportVideo(
      mockScenes,
      mockVideoUrls,
      mockMasterAudioUrl,
      null, // No background music
      onProgress
    );

    expect(result).toBeInstanceOf(Blob);
  });

  it('should handle missing voiceover gracefully', async () => {
    const onProgress = jest.fn();

    const result = await composeAndExportVideo(
      mockScenes,
      mockVideoUrls,
      null, // No voiceover
      mockBackgroundMusicUrl,
      onProgress
    );

    expect(result).toBeInstanceOf(Blob);
  });

  it('should write video files to FFmpeg filesystem', async () => {
    const onProgress = jest.fn();

    await composeAndExportVideo(
      mockScenes,
      mockVideoUrls,
      mockMasterAudioUrl,
      null,
      onProgress
    );

    // Should write video files
    expect(mockWriteFile).toHaveBeenCalledWith('video_0.mp4', expect.any(Uint8Array));
    expect(mockWriteFile).toHaveBeenCalledWith('video_1.mp4', expect.any(Uint8Array));
    // Should write concat file
    expect(mockWriteFile).toHaveBeenCalledWith('concat.txt', expect.any(String));
  });

  it('should clean up files after export', async () => {
    const onProgress = jest.fn();

    await composeAndExportVideo(
      mockScenes,
      mockVideoUrls,
      mockMasterAudioUrl,
      null,
      onProgress
    );

    // Should delete temporary files
    expect(mockDeleteFile).toHaveBeenCalledWith('concat.txt');
    expect(mockDeleteFile).toHaveBeenCalledWith('concatenated.mp4');
    expect(mockDeleteFile).toHaveBeenCalledWith('output.mp4');
    expect(mockDeleteFile).toHaveBeenCalledWith('video_0.mp4');
    expect(mockDeleteFile).toHaveBeenCalledWith('video_1.mp4');
  });

  it('should use correct clip duration based on video model', async () => {
    const onProgress = jest.fn();

    // Test with Veo (8 second clips)
    await composeAndExportVideo(
      mockScenes,
      mockVideoUrls,
      null,
      null,
      onProgress,
      '16:9',
      'veo-3.1'
    );

    // FFmpeg exec should be called for concatenation and encoding
    expect(mockExec).toHaveBeenCalled();
  });

  it('should respect custom clip duration', async () => {
    const onProgress = jest.fn();

    await composeAndExportVideo(
      mockScenes,
      mockVideoUrls,
      null,
      null,
      onProgress,
      '16:9',
      'seedance-1.5',
      true,
      6 // Custom 6 second duration
    );

    expect(mockExec).toHaveBeenCalled();
  });
});

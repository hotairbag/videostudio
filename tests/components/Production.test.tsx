import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Production from '@/components/Production';
import { Script, Scene } from '@/types';

// Mock @google/genai to prevent ESM import issues
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(),
  Type: { OBJECT: 'object', STRING: 'string', ARRAY: 'array', INTEGER: 'integer' },
  Modality: { AUDIO: 'AUDIO' },
  HarmCategory: {
    HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
    HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
  },
  HarmBlockThreshold: { BLOCK_NONE: 'BLOCK_NONE' },
}));

// Mock the geminiService
jest.mock('@/services/geminiService', () => ({
  buildSeedancePrompt: jest.fn().mockReturnValue('mocked seedance prompt'),
  buildVeoPrompt: jest.fn().mockReturnValue('mocked veo prompt'),
}));

// Mock the videoCompositor
jest.mock('@/utils/videoCompositor', () => ({
  composeAndExportVideo: jest.fn().mockResolvedValue(new Blob(['video'], { type: 'video/mp4' })),
}));

describe('Production', () => {
  const mockScript: Script = {
    title: 'Test Video',
    style: 'Cinematic',
    scenes: [
      {
        id: 1,
        timeRange: '00:00 - 00:05',
        visualDescription: 'Scene 1 description',
        audioDescription: 'Audio 1',
        cameraShot: 'Wide',
        voiceoverText: 'Hello',
      },
      {
        id: 2,
        timeRange: '00:05 - 00:10',
        visualDescription: 'Scene 2 description',
        audioDescription: 'Audio 2',
        cameraShot: 'Medium',
        voiceoverText: 'World',
      },
    ],
  };

  const mockFrames = [
    'data:image/png;base64,frame1',
    'data:image/png;base64,frame2',
  ];

  const defaultProps = {
    script: mockScript,
    frames: mockFrames,
    generatedVideos: {},
    generatingVideoIds: [],
    masterAudioUrl: null,
    backgroundMusicUrl: null,
    isGeneratingAudio: false,
    isGeneratingMusic: false,
    isGeneratingFullMovie: false,
    onGenerateVideo: jest.fn(),
    onGenerateFullMovie: jest.fn(),
    aspectRatio: '16:9' as const,
    videoModel: 'seedance-1.5' as const,
    voiceMode: 'tts' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the project title and style', () => {
    render(<Production {...defaultProps} />);

    expect(screen.getByText('Test Video')).toBeInTheDocument();
    expect(screen.getByText('Cinematic')).toBeInTheDocument();
    expect(screen.getByText('• 2 Scenes')).toBeInTheDocument();
  });

  it('should render scene cards with start frames', () => {
    render(<Production {...defaultProps} />);

    expect(screen.getByText('Scene 1 description')).toBeInTheDocument();
    expect(screen.getByText('Scene 2 description')).toBeInTheDocument();
  });

  it('should show generate button on hover for scenes without video', () => {
    render(<Production {...defaultProps} />);

    // The generate buttons are present but only visible on hover
    const generateButtons = screen.getAllByRole('button', { name: /generate scene/i });
    expect(generateButtons).toHaveLength(2);
  });

  it('should call onGenerateVideo when generate scene button is clicked', () => {
    render(<Production {...defaultProps} />);

    const generateButtons = screen.getAllByRole('button', { name: /generate scene/i });
    fireEvent.click(generateButtons[0]);

    expect(defaultProps.onGenerateVideo).toHaveBeenCalledWith(1);
  });

  it('should show generating indicator when scene is generating', () => {
    render(<Production {...defaultProps} generatingVideoIds={[1]} />);

    // Default videoModel is seedance-1.5, so it shows "Seedance Rendering..."
    expect(screen.getByText(/seedance rendering/i)).toBeInTheDocument();
  });

  it('should show Generate Full Movie button when not all videos are ready', () => {
    render(<Production {...defaultProps} />);

    expect(screen.getByRole('button', { name: /generate full movie/i })).toBeInTheDocument();
  });

  it('should call onGenerateFullMovie when Generate Full Movie is clicked', () => {
    render(<Production {...defaultProps} />);

    const generateButton = screen.getByRole('button', { name: /generate full movie/i });
    fireEvent.click(generateButton);

    expect(defaultProps.onGenerateFullMovie).toHaveBeenCalledTimes(1);
  });

  it('should show loading state when generating full movie', () => {
    render(<Production {...defaultProps} isGeneratingFullMovie={true} />);

    expect(screen.getByText(/producing videos/i)).toBeInTheDocument();
  });

  it('should show Watch and Download buttons when all content is ready', () => {
    const propsWithAllReady = {
      ...defaultProps,
      generatedVideos: { 1: 'blob:video1', 2: 'blob:video2' },
      masterAudioUrl: 'data:audio/mp3;base64,audio',
    };

    render(<Production {...propsWithAllReady} />);

    expect(screen.getByRole('button', { name: /watch/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
  });

  it('should show Music play button when background music is generated', () => {
    render(<Production {...defaultProps} backgroundMusicUrl="https://example.com/music.mp3" />);

    expect(screen.getByRole('button', { name: /music/i })).toBeInTheDocument();
  });

  it('should show loading state when generating music', () => {
    render(<Production {...defaultProps} isGeneratingMusic={true} />);

    expect(screen.getByText(/generating music/i)).toBeInTheDocument();
  });

  it('should render video element when scene video is generated', () => {
    const propsWithVideo = {
      ...defaultProps,
      generatedVideos: { 1: 'blob:video1' },
    };

    render(<Production {...propsWithVideo} />);

    const videos = document.querySelectorAll('video');
    expect(videos.length).toBeGreaterThan(0);
  });

  it('should display scene duration from videoModel clip duration', () => {
    render(<Production {...defaultProps} />);

    // Seedance clips are 4 seconds (videoModel: 'seedance-1.5')
    expect(screen.getByText(/Scene 1 • Wide • 4s/)).toBeInTheDocument();
    expect(screen.getByText(/Scene 2 • Medium • 4s/)).toBeInTheDocument();
  });

  describe('Export functionality', () => {
    it('should trigger export when download button is clicked', async () => {
      const { composeAndExportVideo } = require('@/utils/videoCompositor');
      const propsWithAllReady = {
        ...defaultProps,
        generatedVideos: { 1: 'blob:video1', 2: 'blob:video2' },
        masterAudioUrl: 'data:audio/mp3;base64,audio',
      };

      render(<Production {...propsWithAllReady} />);

      const downloadButton = screen.getByRole('button', { name: /download/i });
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(composeAndExportVideo).toHaveBeenCalled();
      });
    });
  });
});

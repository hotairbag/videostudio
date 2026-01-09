import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VideoStudio from '@/components/VideoStudio';

// Mock all service modules
jest.mock('@/services/geminiService', () => ({
  setApiKey: jest.fn(),
  getApiKey: jest.fn(),
  generateScript: jest.fn(),
  generateStoryboard: jest.fn(),
  generateVideoForScene: jest.fn(),
  generateMasterAudio: jest.fn(),
}));

jest.mock('@/services/musicService', () => ({
  generateBackgroundMusic: jest.fn(),
}));

jest.mock('@/utils/imageUtils', () => ({
  sliceGridImage: jest.fn(),
  fileToBase64: jest.fn(),
}));

describe('VideoStudio', () => {
  const { getApiKey, setApiKey, generateScript, generateStoryboard } = require('@/services/geminiService');
  const { sliceGridImage } = require('@/utils/imageUtils');

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset API key state for each test
    getApiKey.mockReturnValue(undefined);
  });

  describe('API Key Screen', () => {
    it('should show API key input screen when no key is set', () => {
      getApiKey.mockReturnValue(undefined);
      render(<VideoStudio />);

      expect(screen.getByText('GenDirector AI')).toBeInTheDocument();
      expect(screen.getByText(/select a paid google cloud project api key/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/enter api key manually/i)).toBeInTheDocument();
    });

    it('should allow manual API key entry', async () => {
      getApiKey.mockReturnValue(undefined);
      render(<VideoStudio />);

      const input = screen.getByPlaceholderText(/enter api key manually/i);
      await userEvent.type(input, 'a-valid-api-key-12345');

      const submitButton = screen.getByRole('button', { name: /use manual key/i });
      fireEvent.click(submitButton);

      expect(setApiKey).toHaveBeenCalledWith('a-valid-api-key-12345');
    });

    it('should disable manual key button if key is too short', () => {
      getApiKey.mockReturnValue(undefined);
      render(<VideoStudio />);

      const submitButton = screen.getByRole('button', { name: /use manual key/i });
      expect(submitButton).toBeDisabled();
    });

    it('should show main app when API key is available', () => {
      getApiKey.mockReturnValue('valid-api-key');
      render(<VideoStudio />);

      expect(screen.getByText(/GenDirector/)).toBeInTheDocument();
      // Form should be visible with textarea
      expect(screen.getByPlaceholderText(/describe your video story/i)).toBeInTheDocument();
    });
  });

  describe('Input Step', () => {
    beforeEach(() => {
      getApiKey.mockReturnValue('valid-api-key');
    });

    it('should render InputForm in input step', () => {
      render(<VideoStudio />);

      // Form has textarea and submit button
      expect(screen.getByPlaceholderText(/describe your video story/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /generate storyboard/i })).toBeInTheDocument();
    });

    it('should show loading state during script generation', async () => {
      generateScript.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<VideoStudio />);

      const textarea = screen.getByPlaceholderText(/describe your video story/i);
      await userEvent.type(textarea, 'A cat video');

      const submitButton = screen.getByRole('button', { name: /generate storyboard/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/generating\.\.\./i)).toBeInTheDocument();
      });
    });
  });

  describe('Storyboard Step', () => {
    beforeEach(() => {
      getApiKey.mockReturnValue('valid-api-key');
    });

    it('should show storyboard view after script and storyboard generation', async () => {
      const mockScript = {
        title: 'Test',
        style: 'Cinematic',
        scenes: [{ id: 1, timeRange: '00:00 - 00:05', visualDescription: 'Test', audioDescription: 'Test', cameraShot: 'Wide', voiceoverText: 'Test' }],
      };

      generateScript.mockResolvedValue(mockScript);
      // generateStoryboard now returns {imageDataUrl, seed}
      generateStoryboard.mockResolvedValue({ imageDataUrl: 'data:image/png;base64,storyboard', seed: 12345 });

      render(<VideoStudio />);

      const textarea = screen.getByPlaceholderText(/describe your video story/i);
      await userEvent.type(textarea, 'A cat video');

      const submitButton = screen.getByRole('button', { name: /generate storyboard/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/cinematic storyboard/i)).toBeInTheDocument();
      });
    });

    it('should navigate to production step after confirming storyboard', async () => {
      const mockScript = {
        title: 'Test',
        style: 'Cinematic',
        scenes: [{ id: 1, timeRange: '00:00 - 00:05', visualDescription: 'Test', audioDescription: 'Test', cameraShot: 'Wide', voiceoverText: 'Test' }],
      };

      generateScript.mockResolvedValue(mockScript);
      // generateStoryboard now returns {imageDataUrl, seed}
      generateStoryboard.mockResolvedValue({ imageDataUrl: 'data:image/png;base64,storyboard', seed: 12345 });
      sliceGridImage.mockResolvedValue(['frame1', 'frame2', 'frame3', 'frame4', 'frame5', 'frame6', 'frame7', 'frame8', 'frame9']);

      render(<VideoStudio />);

      const textarea = screen.getByPlaceholderText(/describe your video story/i);
      await userEvent.type(textarea, 'A cat video');

      const submitButton = screen.getByRole('button', { name: /generate storyboard/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/cinematic storyboard/i)).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /confirm & go to production/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getAllByText('Test').length).toBeGreaterThan(0); // Title in production
      });
    });
  });

  describe('Header', () => {
    beforeEach(() => {
      getApiKey.mockReturnValue('valid-api-key');
    });

    it('should display app name and model info', () => {
      render(<VideoStudio />);

      expect(screen.getByText(/GenDirector/)).toBeInTheDocument();
      expect(screen.getByText(/Gemini 3 Pro • Veo 3.1 • Gemini 2.5 TTS/)).toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      getApiKey.mockReturnValue('valid-api-key');
      // Mock alert
      jest.spyOn(window, 'alert').mockImplementation(() => {});
    });

    afterEach(() => {
      (window.alert as jest.Mock).mockRestore();
    });

    it('should show alert on script generation failure', async () => {
      generateScript.mockRejectedValue(new Error('Generation failed'));

      render(<VideoStudio />);

      const textarea = screen.getByPlaceholderText(/describe your video story/i);
      await userEvent.type(textarea, 'A cat video');

      const submitButton = screen.getByRole('button', { name: /generate storyboard/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Generation failed. See console for details.');
      });
    });
  });
});

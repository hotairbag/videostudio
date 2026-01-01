import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InputForm from '@/components/InputForm';
import { AspectRatio } from '@/types';

// Mock the imageUtils module
jest.mock('@/utils/imageUtils', () => ({
  fileToBase64: jest.fn().mockResolvedValue('base64data'),
}));

describe('InputForm', () => {
  const mockOnSubmit = jest.fn();
  const mockOnAspectRatioChange = jest.fn();
  const defaultProps = {
    onSubmit: mockOnSubmit,
    isLoading: false,
    aspectRatio: '16:9' as AspectRatio,
    onAspectRatioChange: mockOnAspectRatioChange,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the form with all fields', () => {
    render(<InputForm {...defaultProps} />);

    expect(screen.getByText('New Project')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/describe your video/i)).toBeInTheDocument();
    expect(screen.getByText(/Reference Video/i)).toBeInTheDocument();
    expect(screen.getByText(/Reference Art\/Character/i)).toBeInTheDocument();
    expect(screen.getByText(/Aspect Ratio/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate storyboard/i })).toBeInTheDocument();
  });

  it('should submit form with text prompt only', async () => {
    render(<InputForm {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/describe your video/i);
    await userEvent.type(textarea, 'A cat playing with yarn');

    const submitButton = screen.getByRole('button', { name: /generate storyboard/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith('A cat playing with yarn', undefined, undefined);
    });
  });

  it('should show loading state when isLoading is true', () => {
    render(<InputForm {...defaultProps} isLoading={true} />);

    expect(screen.getByText(/generating script/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generating/i })).toBeDisabled();
  });

  it('should not submit when already loading', async () => {
    render(<InputForm {...defaultProps} isLoading={true} />);

    const textarea = screen.getByPlaceholderText(/describe your video/i);
    await userEvent.type(textarea, 'Test');

    const submitButton = screen.getByRole('button', { name: /generating/i });
    fireEvent.click(submitButton);

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should handle reference video file upload', async () => {
    const { fileToBase64 } = require('@/utils/imageUtils');
    render(<InputForm {...defaultProps} />);

    const videoInput = screen.getAllByRole('textbox')[0].closest('form')?.querySelector('input[type="file"][accept="video/*"]');
    const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });

    if (videoInput) {
      Object.defineProperty(videoInput, 'files', { value: [mockFile] });
      fireEvent.change(videoInput);
    }

    const textarea = screen.getByPlaceholderText(/describe your video/i);
    await userEvent.type(textarea, 'Test');

    const submitButton = screen.getByRole('button', { name: /generate storyboard/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(fileToBase64).toHaveBeenCalledWith(mockFile);
      expect(mockOnSubmit).toHaveBeenCalledWith('Test', 'base64data', undefined);
    });
  });

  it('should handle reference image file upload', async () => {
    const { fileToBase64 } = require('@/utils/imageUtils');
    render(<InputForm {...defaultProps} />);

    const imageInput = screen.getAllByRole('textbox')[0].closest('form')?.querySelector('input[type="file"][accept="image/*"]');
    const mockFile = new File(['image content'], 'test.jpg', { type: 'image/jpeg' });

    if (imageInput) {
      Object.defineProperty(imageInput, 'files', { value: [mockFile] });
      fireEvent.change(imageInput);
    }

    const textarea = screen.getByPlaceholderText(/describe your video/i);
    await userEvent.type(textarea, 'Test');

    const submitButton = screen.getByRole('button', { name: /generate storyboard/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(fileToBase64).toHaveBeenCalledWith(mockFile);
      expect(mockOnSubmit).toHaveBeenCalledWith('Test', undefined, ['base64data']);
    });
  });

  it('should update prompt state on textarea change', async () => {
    render(<InputForm {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/describe your video/i);
    await userEvent.type(textarea, 'Hello world');

    expect(textarea).toHaveValue('Hello world');
  });

  it('should toggle aspect ratio when buttons are clicked', async () => {
    render(<InputForm {...defaultProps} />);

    const portraitButton = screen.getByText('9:16').closest('button');
    if (portraitButton) {
      fireEvent.click(portraitButton);
      expect(mockOnAspectRatioChange).toHaveBeenCalledWith('9:16');
    }

    const landscapeButton = screen.getByText('16:9').closest('button');
    if (landscapeButton) {
      fireEvent.click(landscapeButton);
      expect(mockOnAspectRatioChange).toHaveBeenCalledWith('16:9');
    }
  });
});

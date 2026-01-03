import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Storyboard from '@/components/Storyboard';

describe('Storyboard', () => {
  const mockProps = {
    imageUrl: 'data:image/png;base64,testimage',
    onRegenerate: jest.fn(),
    onConfirm: jest.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the storyboard image', () => {
    render(<Storyboard {...mockProps} />);

    const image = screen.getByAltText('Generated Storyboard Grid');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', mockProps.imageUrl);
  });

  it('should render regenerate and confirm buttons', () => {
    render(<Storyboard {...mockProps} />);

    expect(screen.getByRole('button', { name: /regenerate storyboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm & go to production/i })).toBeInTheDocument();
  });

  it('should call onRegenerate when regenerate button is clicked', () => {
    render(<Storyboard {...mockProps} />);

    const regenerateButton = screen.getByRole('button', { name: /regenerate storyboard/i });
    fireEvent.click(regenerateButton);

    expect(mockProps.onRegenerate).toHaveBeenCalledTimes(1);
  });

  it('should call onConfirm when confirm button is clicked', () => {
    render(<Storyboard {...mockProps} />);

    const confirmButton = screen.getByRole('button', { name: /confirm & go to production/i });
    fireEvent.click(confirmButton);

    expect(mockProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should show loading state on regenerate button', () => {
    render(<Storyboard {...mockProps} isLoading={true} />);

    expect(screen.getByRole('button', { name: /regenerating/i })).toBeInTheDocument();
  });

  it('should disable buttons when loading', () => {
    render(<Storyboard {...mockProps} isLoading={true} />);

    expect(screen.getByRole('button', { name: /regenerating/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /confirm & go to production/i })).toBeDisabled();
  });

  it('should display model information badge', () => {
    render(<Storyboard {...mockProps} />);

    expect(screen.getByText(/Gemini 3 Pro Image/i)).toBeInTheDocument();
  });

  it('should display informational note about grid slicing', () => {
    render(<Storyboard {...mockProps} />);

    expect(screen.getByText(/confirming will slice this grid into 9 individual frames/i)).toBeInTheDocument();
  });
});

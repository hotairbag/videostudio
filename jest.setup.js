import '@testing-library/jest-dom';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock HTMLCanvasElement
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  drawImage: jest.fn(),
  fillStyle: '',
}));

HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/png;base64,mockdata');

// Mock AudioContext
class MockAudioContext {
  createBufferSource = jest.fn(() => ({
    buffer: null,
    connect: jest.fn(),
    start: jest.fn(),
    loop: false,
  }));
  createGain = jest.fn(() => ({
    gain: { value: 1, setValueAtTime: jest.fn() },
    connect: jest.fn(),
  }));
  createMediaStreamDestination = jest.fn(() => ({
    stream: { getAudioTracks: () => [{}] },
  }));
  createMediaElementSource = jest.fn(() => ({
    connect: jest.fn(),
  }));
  decodeAudioData = jest.fn().mockResolvedValue({ duration: 60 });
  close = jest.fn();
  currentTime = 0;
}

global.AudioContext = MockAudioContext;
window.AudioContext = MockAudioContext;

// Mock MediaRecorder
class MockMediaRecorder {
  ondataavailable = null;
  onstop = null;
  onerror = null;
  start = jest.fn();
  stop = jest.fn();
}

global.MediaRecorder = MockMediaRecorder;

// Mock fetch for tests
global.fetch = jest.fn();

// Mock Image
class MockImage {
  onload = null;
  onerror = null;
  src = '';
  width = 900;
  height = 900;

  constructor() {
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
}

global.Image = MockImage;

// Mock FileReader
class MockFileReader {
  onload = null;
  onerror = null;
  result = 'data:image/png;base64,mockbase64data';

  readAsDataURL() {
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
}

global.FileReader = MockFileReader;

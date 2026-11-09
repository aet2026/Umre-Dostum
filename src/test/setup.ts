import { vi, beforeEach, afterEach } from 'vitest';

// jsdom window.scrollTo desteklemiyor → sessizce no-op
if (typeof window !== 'undefined') {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------- speechSynthesis mock ----------
if (!('speechSynthesis' in window) || !window.speechSynthesis) {
  const voices: SpeechSynthesisVoice[] = [
    { lang: 'tr-TR', name: 'Turkish', default: true, localService: true, voiceURI: 'tr' } as SpeechSynthesisVoice,
    { lang: 'ar-SA', name: 'Arabic', default: false, localService: true, voiceURI: 'ar' } as SpeechSynthesisVoice,
    { lang: 'en-US', name: 'English', default: false, localService: true, voiceURI: 'en' } as SpeechSynthesisVoice,
  ];

  Object.defineProperty(window, 'speechSynthesis', {
    writable: true,
    configurable: true,
    value: {
      getVoices: () => voices,
      speak: vi.fn(),
      cancel: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });

  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    writable: true,
    configurable: true,
    value: class {
      text: string;
      lang = '';
      rate = 1;
      pitch = 1;
      voice: SpeechSynthesisVoice | null = null;
      constructor(text: string) { this.text = text; }
    },
  });
}

// ---------- geolocation mock ----------
if (!navigator.geolocation) {
  Object.defineProperty(navigator, 'geolocation', {
    writable: true,
    configurable: true,
    value: {
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn(() => 0),
      clearWatch: vi.fn(),
    },
  });
}

// ---------- vibrate mock ----------
if (!('vibrate' in navigator)) {
  Object.defineProperty(navigator, 'vibrate', {
    writable: true,
    configurable: true,
    value: vi.fn(() => true),
  });
}
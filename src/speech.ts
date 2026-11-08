let lastSpeak = 0;
let lastFull = '';
let lastSpokenText = '';
let voicesReady = false;

const MIN_GAP_MS = 6000;

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const vs = speechSynthesis.getVoices() ?? [];
  const lower = lang.toLowerCase();
  return (
    vs.find(v => v.lang?.toLowerCase() === lower) ??
    vs.find(v => v.lang?.toLowerCase().startsWith(lower.split('-')[0]!))
  );
}

export function initSpeech(): void {
  if (voicesReady) return;
  const load = () => {
    voicesReady = (speechSynthesis.getVoices() ?? []).length > 0;
  };
  load();
  speechSynthesis.addEventListener('voiceschanged', load);
}

function speakWithLang(text: string, lang: string, rate: number): void {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.pitch = 1;
    const v = pickVoice(lang);
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch {}
}

export function speak(text: string, force = false): void {
  if (!text) return;

  if (!force && text === lastSpokenText) return;

  const now = Date.now();
  if (!force && now - lastSpeak < MIN_GAP_MS) return;

  lastSpeak = now;
  lastFull = text;
  lastSpokenText = text;

  speakWithLang(text, 'tr-TR', 0.9);
  announce(text);
}

/**
 * Arapça konuşma — görevliye hitap için.
 * force=true, çünkü yardım ekranı her açıldığında tekrar okunmalı.
 */
export function speakArabic(text: string): void {
  if (!text) return;
  speakWithLang(text, 'ar-SA', 0.85);
  announce(text);
}

export function repeatLast(): void {
  if (lastFull) speak(lastFull, true);
}

export function stopSpeech(): void {
  try {
    speechSynthesis.cancel();
  } catch {}
  lastSpokenText = '';
  lastSpeak = 0;
}

function announce(msg: string): void {
  const el = document.getElementById('sr');
  if (!el) return;
  el.textContent = '';
  setTimeout(() => {
    el.textContent = msg;
  }, 30);
}
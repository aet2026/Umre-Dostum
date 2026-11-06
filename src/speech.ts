let lastSpeak = 0;
let lastFull = '';
let voicesReady = false;

const MIN_GAP_MS = 6000;

function pickTurkishVoice(): SpeechSynthesisVoice | undefined {
  const vs = speechSynthesis.getVoices() ?? [];
  return vs.find(v => v.lang?.toLowerCase().startsWith('tr'));
}

export function initSpeech(): void {
  if (voicesReady) return;
  const load = () => {
    voicesReady = (speechSynthesis.getVoices() ?? []).length > 0;
  };
  load();
  speechSynthesis.addEventListener('voiceschanged', load);
}

export function speak(text: string, force = false): void {
  if (!text) return;
  const now = Date.now();
  if (!force && now - lastSpeak < MIN_GAP_MS) return;
  lastSpeak = now;
  lastFull = text;

  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'tr-TR';
    u.rate = 0.9;
    u.pitch = 1;
    const v = pickTurkishVoice();
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch {}

  announce(text);
}

export function repeatLast(): void {
  if (lastFull) speak(lastFull, true);
}

export function stopSpeech(): void {
  try { speechSynthesis.cancel(); } catch {}
}

function announce(msg: string): void {
  const el = document.getElementById('sr');
  if (!el) return;
  el.textContent = '';
  setTimeout(() => { el.textContent = msg; }, 30);
}
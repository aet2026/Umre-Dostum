let lastSpeak = 0;
let lastFull = '';
let lastSpokenText = '';
let voicesReady = false;

// Chrome'da utterance'lar çöp toplayıcıya kaybolup konuşma yarıda kesilebiliyor
const alive = new Set<SpeechSynthesisUtterance>();

const MIN_GAP_MS = 6000;

function allVoices(): SpeechSynthesisVoice[] {
  try {
    return speechSynthesis.getVoices() ?? [];
  } catch {
    return [];
  }
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const vs = allVoices();
  const lower = lang.toLowerCase();
  const base = lower.split('-')[0]!;
  return (
    vs.find(v => v.lang?.toLowerCase().replace('_', '-') === lower) ??
    vs.find(v => v.lang?.toLowerCase().replace('_', '-').startsWith(base))
  );
}

/**
 * Cihazda verilen dil için ses var mı?
 * Ses listesi henüz yüklenmediyse (boş) true döner — bilinmiyor, engelleme.
 */
export function hasVoiceFor(lang: string): boolean {
  if (allVoices().length === 0) return true;
  return pickVoice(lang) !== undefined;
}

export function initSpeech(): void {
  if (voicesReady) return;
  const load = () => {
    voicesReady = allVoices().length > 0;
  };
  load();
  speechSynthesis.addEventListener('voiceschanged', load);
}

interface Part {
  text: string;
  lang: string;
  rate: number;
}

/** Sıradaki parçaları KUYRUĞA koyar; sıra tarayıcı tarafından yönetilir (zamanlayıcı yok). */
function speakParts(parts: Part[]): void {
  try {
    // Boştayken cancel() çağırmak Chrome'da sonraki speak()'i yutabiliyor
    if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
    for (const p of parts) {
      const u = new SpeechSynthesisUtterance(p.text);
      u.lang = p.lang;
      u.rate = p.rate;
      u.pitch = 1;
      const v = pickVoice(p.lang);
      if (v) u.voice = v;
      alive.add(u);
      const done = () => alive.delete(u);
      u.onend = done;
      u.onerror = done;
      speechSynthesis.speak(u);
    }
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

  speakParts([{ text, lang: 'tr-TR', rate: 0.9 }]);
  announce(text, 'tr');
}

/** Arapça konuşma — görevliye hitap için. Ekran okuyucuya yazılmaz (üst üste binmesin). */
export function speakArabic(text: string): void {
  if (!text) return;
  speakParts([{ text, lang: 'ar-SA', rate: 0.85 }]);
}

/**
 * Yardım ekranı: önce Arapça (görevliye), SONRA Türkçe (kullanıcıya) — aynı kuyrukta,
 * Arapça bitmeden Türkçe başlamaz ve onu kesmez.
 * @returns Cihazda Arapça ses var mı
 */
export function speakHelp(arabic: string, turkish: string): boolean {
  const parts: Part[] = [];
  if (arabic) parts.push({ text: arabic, lang: 'ar-SA', rate: 0.85 });
  if (turkish) parts.push({ text: turkish, lang: 'tr-TR', rate: 0.9 });
  if (parts.length === 0) return true;
  speakParts(parts);
  return hasVoiceFor('ar-SA');
}

export function repeatLast(): void {
  if (lastFull) speak(lastFull, true);
}

export function stopSpeech(): void {
  try {
    speechSynthesis.cancel();
  } catch {}
  alive.clear();
  lastSpokenText = '';
  lastSpeak = 0;
}

function announce(msg: string, lang: string): void {
  const el = document.getElementById('sr');
  if (!el) return;
  el.setAttribute('lang', lang);
  el.textContent = '';
  setTimeout(() => {
    el.textContent = msg;
  }, 30);
}

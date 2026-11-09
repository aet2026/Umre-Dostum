import type { SavedGate } from './types';

const KEY = 'savedGate.v1';

export function saveGate(g: SavedGate): void {
  try { localStorage.setItem(KEY, JSON.stringify(g)); } catch {}
}

export function loadGate(): SavedGate | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedGate> | null;
    if (
      !parsed ||
      typeof parsed.doorId !== 'number' ||
      typeof parsed.outsideLat !== 'number' ||
      typeof parsed.outsideLng !== 'number' ||
      !Number.isFinite(parsed.outsideLat) ||
      !Number.isFinite(parsed.outsideLng) ||
      Math.abs(parsed.outsideLat) > 90 ||
      Math.abs(parsed.outsideLng) > 180
    ) {
      return null;
    }
    return {
      doorId: parsed.doorId,
      doorName: typeof parsed.doorName === 'string' ? parsed.doorName : String(parsed.doorId),
      outsideLat: parsed.outsideLat,
      outsideLng: parsed.outsideLng,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
      trail: Array.isArray(parsed.trail) ? parsed.trail : [],
      // Eski kayıtların konumu GPS mi katalog mu bilinmez → güvenilmez say
      locationSource: parsed.locationSource === 'gps' ? 'gps' : 'catalog',
      accuracy: typeof parsed.accuracy === 'number' ? parsed.accuracy : undefined,
      numberMismatch: parsed.numberMismatch === true,
    };
  } catch {
    return null;
  }
}

export function clearGate(): void {
  try { localStorage.removeItem(KEY); } catch {}
}

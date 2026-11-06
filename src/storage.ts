import type { SavedGate } from './types';

const KEY = 'savedGate.v1';

export function saveGate(g: SavedGate): void {
  try { localStorage.setItem(KEY, JSON.stringify(g)); } catch {}
}

export function loadGate(): SavedGate | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedGate;
    if (typeof parsed.doorId !== 'number' || typeof parsed.outsideLat !== 'number') {
      return null;
    }
    parsed.trail = Array.isArray(parsed.trail) ? parsed.trail : [];
    return parsed;
  } catch {
    return null;
  }
}

export function clearGate(): void {
  try { localStorage.removeItem(KEY); } catch {}
}
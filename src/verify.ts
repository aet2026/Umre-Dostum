import { distanceM } from './trail';

export interface Fix {
  lat: number;
  lng: number;
  accuracy: number;
  t: number;
}

export interface Summary {
  lat: number;
  lng: number;
  /** Örneklerin medyan hassasiyeti (m) */
  accuracy: number;
  /** Örneklerin %90'ının medyan noktaya uzaklığı (m) — ölçümün tutarlılığı */
  spreadM: number;
  samples: number;
}

export interface Measurement extends Summary {
  doorId: number;
  measuredAt: number;
  /** Katalogdaki konumdan fark (m); katalogda yoksa undefined */
  catalogDiffM?: number;
}

const KEY = 'doorMeasurements.v1';
export const MIN_SAMPLES = 8;
export const MAX_FIX_ACCURACY_M = 30;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * Tek bir GPS okuması yerine, hassas okumaların MEDYANINI alır (aykırı değerlere dayanıklı).
 * Yeterli sayıda hassas örnek yoksa null döner.
 */
export function summarizeFixes(fixes: Fix[], maxAccuracy = MAX_FIX_ACCURACY_M): Summary | null {
  const good = fixes.filter(f => Number.isFinite(f.accuracy) && f.accuracy <= maxAccuracy);
  if (good.length < MIN_SAMPLES) return null;

  const lat = median(good.map(f => f.lat));
  const lng = median(good.map(f => f.lng));
  const dists = good.map(f => distanceM({ lat, lng }, { lat: f.lat, lng: f.lng })).sort((a, b) => a - b);
  const spreadM = dists[Math.min(dists.length - 1, Math.floor(dists.length * 0.9))]!;

  return {
    lat,
    lng,
    accuracy: median(good.map(f => f.accuracy)),
    spreadM,
    samples: good.length,
  };
}

/** Ölçümün katalogla karşılaştırılması için kısa değerlendirme */
export function assess(diffM: number | undefined, spreadM: number): 'good' | 'check' | 'bad' {
  if (spreadM > 25) return 'bad'; // ölçüm kendi içinde tutarsız → tekrar ölçülmeli
  if (diffM === undefined) return 'good';
  return diffM <= 40 ? 'good' : 'check';
}

export function loadMeasurements(): Measurement[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as Measurement[]) : [];
    return Array.isArray(arr) ? arr.filter(m => Number.isFinite(m?.lat) && Number.isFinite(m?.lng)) : [];
  } catch {
    return [];
  }
}

export function saveMeasurement(m: Measurement): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...loadMeasurements(), m]));
  } catch {}
}

export function clearMeasurements(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/** Telefondan kopyalanıp tools/merge-measurements.mjs ile birleştirilecek biçim */
export function exportMeasurements(list: Measurement[]): string {
  return JSON.stringify(
    list.map(m => ({
      doorId: m.doorId,
      lat: Number(m.lat.toFixed(7)),
      lng: Number(m.lng.toFixed(7)),
      accuracy: Math.round(m.accuracy),
      spreadM: Math.round(m.spreadM),
      samples: m.samples,
      catalogDiffM: m.catalogDiffM === undefined ? null : Math.round(m.catalogDiffM),
      measuredAt: new Date(m.measuredAt).toISOString(),
    })),
    null,
    2
  );
}

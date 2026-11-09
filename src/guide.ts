import type { SavedGate, NavUpdate } from './types';
import { findDoor, doorLabel } from './doors';
import { distanceM, bearingDeg } from './trail';

const ARRIVE_RADIUS_M = 20;
const MAX_ALLOWED_DISTANCE_M = 2000;
const MAX_ARRIVE_RADIUS_M = 40;

export interface NavResult extends NavUpdate {
  isTooFar: boolean;
  /** Konum kullanıcı ölçümü değil, doğrulanmamış katalogdan geliyorsa true */
  approximate: boolean;
  /** Pusula varsa: hedef yönü ile cihaz yönü arasındaki fark (-180..180) */
  relativeBearing?: number;
}

/**
 * Hedef HER ZAMAN kullanıcının kapının önündeyken kaydettiği konumdur.
 * (Katalog koordinatları doğrulanmadığı için hedef olarak kullanılmaz.)
 */
export function resolveTarget(saved: SavedGate): { lat: number; lng: number; name: string } {
  const door = findDoor(saved.doorId);
  return {
    lat: saved.outsideLat,
    lng: saved.outsideLng,
    name: door?.name ?? saved.doorName,
  };
}

function arriveRadius(accuracyM?: number | null): number {
  if (typeof accuracyM !== 'number' || !Number.isFinite(accuracyM)) return ARRIVE_RADIUS_M;
  return Math.min(Math.max(accuracyM, ARRIVE_RADIUS_M), MAX_ARRIVE_RADIUS_M);
}

function formatDistance(d: number): string {
  if (d < 50) return `${Math.round(d)} metre`;
  const r = Math.round(d / 10) * 10;
  if (r < 1000) return `${r} metre`;
  return `${(d / 1000).toFixed(1)} kilometre`;
}

export function computeNavigation(
  saved: SavedGate,
  current: { lat: number; lng: number },
  deviceHeading?: number | null,
  accuracyM?: number | null
): NavResult {
  const { lat: targetLat, lng: targetLng, name: doorName } = resolveTarget(saved);
  const approximate = saved.locationSource !== 'gps';

  const distance = distanceM(current, { lat: targetLat, lng: targetLng });
  const bearingDegVal = bearingDeg(current, { lat: targetLat, lng: targetLng });

  // relative bearing: hedef yönü - cihaz yönü
  const relativeBearing =
    typeof deviceHeading === 'number' && !Number.isNaN(deviceHeading)
      ? normalizeSigned(bearingDegVal - deviceHeading)
      : undefined;

  if (distance > MAX_ALLOWED_DISTANCE_M) {
    return {
      distance,
      bearingDeg: bearingDegVal,
      arrived: false,
      isTooFar: true,
      approximate,
      relativeBearing,
      instruction:
        "Mescid-i Haram'ın dışındasınız. Lütfen Harem bölgesine yaklaşıp tekrar deneyin.",
    };
  }

  if (distance < arriveRadius(accuracyM)) {
    return {
      distance,
      bearingDeg: bearingDegVal,
      arrived: true,
      isTooFar: false,
      approximate,
      relativeBearing,
      instruction:
        `Giriş kapınızın önündesiniz (${doorLabel(saved.doorId, doorName)}). Hedefe ulaştınız.` +
        (approximate ? ' Kapı numarasını tabeladan kontrol edin.' : ''),
    };
  }

  const distStr = formatDistance(distance);

  // Pusula varsa göreli yön tarifi, yoksa kuzey referanslı
  const dirInstruction =
    relativeBearing !== undefined
      ? relativeTurnInstruction(relativeBearing)
      : `${bearingToTurkish(bearingDegVal)} yönünde yürüyün`;

  return {
    distance,
    bearingDeg: bearingDegVal,
    arrived: false,
    isTooFar: false,
    approximate,
    relativeBearing,
    instruction: `${distStr} ${dirInstruction}.`,
  };
}

/**
 * Göreli yöne göre "düz yürü / sağa dön / arkanı dön" tarifi üretir.
 * -45..45 → düz yürü
 * 45..135 → sağa dön
 * 135..180 veya -180..-135 → arkanı dön
 * -135..-45 → sola dön
 */
function relativeTurnInstruction(relative: number): string {
  const abs = Math.abs(relative);

  if (abs <= 20) return 'düz yürüyün';
  if (abs <= 45) {
    return relative > 0 ? 'hafifçe sağa dönüp yürüyün' : 'hafifçe sola dönüp yürüyün';
  }
  if (abs <= 135) {
    return relative > 0 ? 'sağa dönüp yürüyün' : 'sola dönüp yürüyün';
  }
  return 'arkanıza dönüp yürüyün';
}

function normalizeSigned(deg: number): number {
  // -180..180 aralığına indir
  let d = ((deg + 180) % 360 + 360) % 360 - 180;
  if (d === -180) d = 180;
  return d;
}

function bearingToTurkish(b: number): string {
  const sectors = [
    'kuzey', 'kuzeydoğu', 'doğu', 'güneydoğu',
    'güney', 'güneybatı', 'batı', 'kuzeybatı',
  ] as const;
  return sectors[Math.round(b / 45) % 8]!;
}
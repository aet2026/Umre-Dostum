import type { SavedGate, NavUpdate } from './types';
import { findDoor } from './doors';
import { distanceM, bearingDeg } from './trail';

const ARRIVE_RADIUS_M = 20;
const MAX_ALLOWED_DISTANCE_M = 2000;

export interface NavResult extends NavUpdate {
  isTooFar: boolean;
  /** Pusula varsa: hedef yönü ile cihaz yönü arasındaki fark (-180..180) */
  relativeBearing?: number;
}

export function computeNavigation(
  saved: SavedGate,
  current: { lat: number; lng: number },
  deviceHeading?: number | null
): NavResult {
  const door = findDoor(saved.doorId);
  const targetLat = door?.outsideLat ?? saved.outsideLat;
  const targetLng = door?.outsideLng ?? saved.outsideLng;
  const doorName = door?.name ?? saved.doorName;

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
      relativeBearing,
      instruction:
        "Mescid-i Haram'ın dışındasınız. Lütfen Harem bölgesine yaklaşıp tekrar deneyin.",
    };
  }

  if (distance < ARRIVE_RADIUS_M) {
    return {
      distance,
      bearingDeg: bearingDegVal,
      arrived: true,
      isTooFar: false,
      relativeBearing,
      instruction: `${doorName} Kapısı'nın önündesiniz. Hedefe ulaştınız.`,
    };
  }

  let distStr = '';
  if (distance < 1000) {
    distStr =
      distance < 50
        ? `${Math.round(distance)} metre`
        : `${Math.round(distance / 10) * 10} metre`;
  } else {
    distStr = `${(distance / 1000).toFixed(1)} kilometre`;
  }

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
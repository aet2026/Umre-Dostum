import type { SavedGate, NavUpdate } from './types';
import { findDoor } from './doors';
import { distanceM, bearingDeg } from './trail';

const ARRIVE_RADIUS_M = 20;
const MAX_ALLOWED_DISTANCE_M = 2000;

export interface NavResult extends NavUpdate {
  isTooFar: boolean;
}

export function computeNavigation(
  saved: SavedGate,
  current: { lat: number; lng: number }
): NavResult {
  const door = findDoor(saved.doorId);
  const targetLat = door?.outsideLat ?? saved.outsideLat;
  const targetLng = door?.outsideLng ?? saved.outsideLng;
  const doorName = door?.name ?? saved.doorName;

  const distance = distanceM(current, { lat: targetLat, lng: targetLng });
  const bearingDegVal = bearingDeg(current, { lat: targetLat, lng: targetLng });

  if (distance > MAX_ALLOWED_DISTANCE_M) {
    return {
      distance,
      bearingDeg: bearingDegVal,
      arrived: false,
      isTooFar: true,
      instruction: "Mescid-i Haram'ın dışındasınız. Lütfen Harem bölgesine yaklaşıp tekrar deneyin.",
    };
  }

  if (distance < ARRIVE_RADIUS_M) {
    return {
      distance,
      bearingDeg: bearingDegVal,
      arrived: true,
      isTooFar: false,
      instruction: `${doorName} Kapısı'nın önündesiniz. Hedefe ulaştınız.`,
    };
  }

  let distStr = '';
  if (distance < 1000) {
    distStr = distance < 50
      ? `${Math.round(distance)} metre`
      : `${Math.round(distance / 10) * 10} metre`;
  } else {
    distStr = `${(distance / 1000).toFixed(1)} kilometre`;
  }

  const dir = bearingToTurkish(bearingDegVal);

  return {
    distance,
    bearingDeg: bearingDegVal,
    arrived: false,
    isTooFar: false,
    instruction: `${distStr} ${dir} yönünde yürüyün.`,
  };
}

function bearingToTurkish(b: number): string {
  const sectors = [
    'kuzey', 'kuzeydoğu', 'doğu', 'güneydoğu',
    'güney', 'güneybatı', 'batı', 'kuzeybatı',
  ] as const;
  return sectors[Math.round(b / 45) % 8]!;
}
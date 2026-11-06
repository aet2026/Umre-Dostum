import { findDoor } from './doors';
import { distanceM, bearingDeg } from './trail';
const ARRIVE_RADIUS_M = 20;
export function computeNavigation(saved, current) {
    const door = findDoor(saved.doorId);
    const targetLat = door?.outsideLat ?? saved.outsideLat;
    const targetLng = door?.outsideLng ?? saved.outsideLng;
    const doorName = door?.name ?? saved.doorName;
    const distance = distanceM(current, { lat: targetLat, lng: targetLng });
    const bearingDegVal = bearingDeg(current, { lat: targetLat, lng: targetLng });
    if (distance < ARRIVE_RADIUS_M) {
        return {
            distance,
            bearingDeg: bearingDegVal,
            arrived: true,
            instruction: `${doorName} Kapısı'nın önündesiniz. Hedefe ulaştınız.`,
        };
    }
    const distStr = distance < 50
        ? `${Math.round(distance)} metre`
        : `${Math.round(distance / 10) * 10} metre`;
    const dir = bearingToTurkish(bearingDegVal);
    return {
        distance,
        bearingDeg: bearingDegVal,
        arrived: false,
        instruction: `${distStr} ${dir} yönünde yürüyün.`,
    };
}
function bearingToTurkish(b) {
    const sectors = [
        'kuzey', 'kuzeydoğu', 'doğu', 'güneydoğu',
        'güney', 'güneybatı', 'batı', 'kuzeybatı',
    ];
    return sectors[Math.round(b / 45) % 8] ?? 'kuzey';
}

/**
 * Cihazın baktığı yönü (heading) ölçer.
 * - iOS: DeviceOrientationEvent.requestPermission() gerekir (kullanıcı jesti ile)
 * - Android: doğrudan deviceorientationabsolute çalışır
 * - Masaüstü: desteklenmez, null döner
 *
 * Heading = 0 → kuzey, 90 → doğu, 180 → güney, 270 → batı
 */

export type CompassCallback = (heading: number) => void;
export type CompassError =
  | 'unsupported'
  | 'no-heading'
  | 'uncalibrated'
  | 'calibration-needed';

export interface CompassHandle {
  stop: () => void;
  isActive: () => boolean;
}

type IOSDeviceOrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

type ExtendedDeviceOrientationEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
};

/**
 * Mekke için manyetik sapma (declination), yaklaşık **+3.5° doğu** (2025).
 * Manyetik kuzey, gerçek kuzeyin 3.5° doğusundadır. Gerçek heading = manyetik + 3.5°.
 * Uygulama yalnızca Mekke için tasarlandığından küresel WMM modeli gerekmez.
 */
export const MAGNETIC_DECLINATION_DEG = 3.5;

export function isCompassSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'DeviceOrientationEvent' in window;
}

export async function requestCompassPermission(): Promise<boolean> {
  if (!isCompassSupported()) return false;

  const DOE = window.DeviceOrientationEvent as IOSDeviceOrientationEvent;
  if (typeof DOE.requestPermission === 'function') {
    try {
      const result = await DOE.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Manyetik kuzeyi gerçek kuzeye çevirir.
 * Pozitif declination (doğu) → gerçek = manyetik + declination
 */
export function applyDeclination(
  magneticHeading: number,
  declinationDeg: number = MAGNETIC_DECLINATION_DEG
): number {
  return normalize(magneticHeading + declinationDeg);
}

/**
 * Pusulayı başlatır. Her yön değişiminde callback çağrılır.
 * Kalibrasyon uyarıları `onError` ile iletilir; çağıran katman bunları
 * kullanıcıya göstermekten sorumludur.
 */
export function startCompass(
  callback: CompassCallback,
  onError?: (reason: CompassError) => void
): CompassHandle {
  if (!isCompassSupported()) {
    onError?.('unsupported');
    return { stop: () => {}, isActive: () => false };
  }

  let active = true;

  // W3C pusula kalibrasyon olayı (bazı Android + eski iOS sürümleri)
  const onCalibration = (ev: Event) => {
    if (!active) return;
    if (typeof ev.preventDefault === 'function') ev.preventDefault();
    onError?.('calibration-needed');
  };
  window.addEventListener('compassneedscalibration', onCalibration, true);

  const handler = (e: DeviceOrientationEvent) => {
    if (!active) return;

    const ext = e as ExtendedDeviceOrientationEvent;

    // iOS: webkitCompassHeading (0-360, saat yönünde, manyetik)
    if (
      typeof ext.webkitCompassHeading === 'number' &&
      !Number.isNaN(ext.webkitCompassHeading)
    ) {
      // iOS kalibre değilse webkitCompassAccuracy = -1 döner.
      // Sessizce yanlış yön göstermektense GPS yedeğine düşür.
      if (
        typeof ext.webkitCompassAccuracy === 'number' &&
        ext.webkitCompassAccuracy === -1
      ) {
        onError?.('uncalibrated');
        return;
      }
      callback(normalize(ext.webkitCompassHeading));
      return;
    }

    // Android: yalnızca MUTLAK (kuzeye göre) yönelim güvenilir; göreli alpha yanlış yön verir
    const absolute =
      (e as DeviceOrientationEvent & { absolute?: boolean }).absolute === true;
    if (absolute && typeof e.alpha === 'number' && !Number.isNaN(e.alpha)) {
      callback(headingFromOrientation(e.alpha, e.beta ?? 0, e.gamma ?? 0));
      return;
    }

    onError?.('no-heading');
  };

  // Absolute varsa onu tercih et
  const useAbsolute = 'ondeviceorientationabsolute' in window;
  const eventName = useAbsolute ? 'deviceorientationabsolute' : 'deviceorientation';

  window.addEventListener(eventName, handler as EventListener, true);

  return {
    stop: () => {
      active = false;
      window.removeEventListener(eventName, handler as EventListener, true);
      window.removeEventListener('compassneedscalibration', onCalibration, true);
    },
    isActive: () => active,
  };
}

/**
 * alpha/beta/gamma (W3C, mutlak) → pusula yönü (0=kuzey, saat yönünde).
 *
 * W3C DeviceOrientation spec (Ek A.1) formülü tüm eğim açılarında tutarlıdır.
 * Ancak telefon tamamen yatayken (beta = gamma = 0) W3C formülü (0, 0) üretir
 * ve `atan2(0, 0)` dejenere olur. Bu durumda telefonun **üst kenarının**
 * baktığı yönü veren "flat" formülüne düşeriz. İki formül, geçiş sınırında
 * aynı sonucu verdiğinden süreklilik bozulmaz (45° eğimde bile aynı çıktı).
 */
export function headingFromOrientation(
  alpha: number,
  beta: number,
  gamma: number
): number {
  const d = Math.PI / 180;
  const a = alpha * d;
  const b = beta * d;
  const g = gamma * d;
  const cA = Math.cos(a), sA = Math.sin(a);
  const cB = Math.cos(b), sB = Math.sin(b);
  const cG = Math.cos(g), sG = Math.sin(g);

  // W3C formülü (App. A.1)
  const east = -cA * sG - sA * sB * cG;
  const north = -sA * sG + cA * sB * cG;

  // Dejenere durum: telefon tamamen yatay → üst kenar formülüne düş
  if (Math.abs(east) < 1e-6 && Math.abs(north) < 1e-6) {
    const flatEast = -sA * cB;
    const flatNorth = cA * cB;
    return normalize((Math.atan2(flatEast, flatNorth) * 180) / Math.PI);
  }

  return normalize((Math.atan2(east, north) * 180) / Math.PI);
}

function normalize(deg: number): number {
  return ((deg % 360) + 360) % 360;
}
/**
 * Cihazın baktığı yönü (heading) ölçer.
 * - iOS: DeviceOrientationEvent.requestPermission() gerekir (kullanıcı jesti ile)
 * - Android: doğrudan deviceorientationabsolute çalışır
 * - Masaüstü: desteklenmez, null döner
 *
 * Heading = 0 → kuzey, 90 → doğu, 180 → güney, 270 → batı
 */

export type CompassCallback = (heading: number) => void;

export interface CompassHandle {
  stop: () => void;
  isActive: () => boolean;
}

type IOSDeviceOrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

export function isCompassSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'DeviceOrientationEvent' in window;
}

/**
 * iOS 13+ için izin ister. Android'de doğrudan 'granted' döner.
 * Kullanıcı jesti (buton tıklaması) içinde çağrılmalı.
 */
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
  // Android ve masaüstü: izin istemez
  return true;
}

/**
 * Pusulayı başlatır. Her yön değişiminde callback çağrılır.
 * Not: callback sık çağrılır (saniyede ~10 kez) — debounce çağıranda.
 */
export function startCompass(
  callback: CompassCallback,
  onError?: (reason: string) => void
): CompassHandle {
  if (!isCompassSupported()) {
    onError?.('unsupported');
    return { stop: () => {}, isActive: () => false };
  }

  let active = true;

  const handler = (e: DeviceOrientationEvent) => {
    if (!active) return;

    // iOS: webkitCompassHeading (0-360, saat yönünde)
    const webkit = (e as DeviceOrientationEvent & { webkitCompassHeading?: number })
      .webkitCompassHeading;
    if (typeof webkit === 'number' && !Number.isNaN(webkit)) {
      callback(normalize(webkit));
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
    },
    isActive: () => active,
  };
}

/**
 * alpha/beta/gamma (W3C, mutlak) → pusula yönü (0=kuzey, saat yönünde).
 * Telefon yataya yakınsa üst kenarın, dik tutuluyorsa arka yüzün (kamera) baktığı yönü verir.
 * Böylece yalnızca "360 - alpha" kullanıldığında dik tutulan telefonda oluşan sapma önlenir.
 */
export function headingFromOrientation(alpha: number, beta: number, gamma: number): number {
  const d = Math.PI / 180;
  const a = alpha * d;
  const b = beta * d;
  const g = gamma * d;
  const cA = Math.cos(a), sA = Math.sin(a);
  const cB = Math.cos(b), sB = Math.sin(b);
  const cG = Math.cos(g), sG = Math.sin(g);

  const facingUp = Math.abs(cB * cG); // 1 = tam yatay, 0 = dik
  let east: number;
  let north: number;
  if (facingUp > 0.7) {
    // yatay: cihazın üst kenarı
    east = -sA * cB;
    north = cA * cB;
  } else {
    // dik: arka yüz
    east = -cA * sG - sA * sB * cG;
    north = -sA * sG + cA * sB * cG;
  }
  return normalize((Math.atan2(east, north) * 180) / Math.PI);
}

function normalize(deg: number): number {
  return ((deg % 360) + 360) % 360;
}
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

    // Android: alpha (0-360, saat yönünün tersi) + absolute
    if (typeof e.alpha === 'number' && !Number.isNaN(e.alpha)) {
      // alpha 0 = kuzey, ama saat yönünün tersi → 360 - alpha
      callback(normalize(360 - e.alpha));
      return;
    }

    // Beta/gamma ile hesaplanabilir ama basit tutuyoruz
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

function normalize(deg: number): number {
  return ((deg % 360) + 360) % 360;
}
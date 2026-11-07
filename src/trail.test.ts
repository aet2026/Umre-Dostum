import { describe, it, expect, vi, beforeEach } from 'vitest';
import { distanceM, bearingDeg, TrailRecorder } from './trail';

describe('distanceM', () => {
  it('aynı nokta için 0 döner', () => {
    const p = { lat: 21.4225, lng: 39.8261 };
    expect(distanceM(p, p)).toBeCloseTo(0, 1);
  });

  it('bilinen mesafeyi yaklaşık hesaplar (100m)', () => {
    const a = { lat: 21.4225, lng: 39.8261 };
    const b = { lat: 21.4234, lng: 39.8261 };
    const d = distanceM(a, b);
    expect(d).toBeGreaterThan(90);
    expect(d).toBeLessThan(110);
  });

  it('simetriktir', () => {
    const a = { lat: 21.4225, lng: 39.8261 };
    const b = { lat: 21.4234, lng: 39.8270 };
    expect(distanceM(a, b)).toBeCloseTo(distanceM(b, a), 5);
  });
});

describe('bearingDeg', () => {
  it('kuzey yönü 0 veya 360 döner', () => {
    const a = { lat: 21.4225, lng: 39.8261 };
    const b = { lat: 21.4235, lng: 39.8261 };
    const bDeg = bearingDeg(a, b);
    expect(bDeg < 5 || bDeg > 355).toBe(true);
  });

  it('doğu yönü ~90 döner', () => {
    const a = { lat: 21.4225, lng: 39.8261 };
    const b = { lat: 21.4225, lng: 39.8271 };
    const bDeg = bearingDeg(a, b);
    expect(bDeg).toBeGreaterThan(85);
    expect(bDeg).toBeLessThan(95);
  });

  it('güney yönü ~180 döner', () => {
    const a = { lat: 21.4225, lng: 39.8261 };
    const b = { lat: 21.4215, lng: 39.8261 };
    const bDeg = bearingDeg(a, b);
    expect(bDeg).toBeGreaterThan(175);
    expect(bDeg).toBeLessThan(185);
  });
});

describe('TrailRecorder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('başlangıçta boş dizi döner', () => {
    const r = new TrailRecorder();
    expect(r.getPoints()).toEqual([]);
  });

  it('start() watchPosition çağırır', () => {
    const watchSpy = vi.spyOn(navigator.geolocation, 'watchPosition').mockReturnValue(42);
    const r = new TrailRecorder();
    r.start();
    expect(watchSpy).toHaveBeenCalled();
    r.stop();
  });

  it('start() iki kez çağrılırsa ikinci kez watchPosition çağırmaz', () => {
    const watchSpy = vi.spyOn(navigator.geolocation, 'watchPosition').mockReturnValue(1);
    const r = new TrailRecorder();
    r.start();
    r.start();
    expect(watchSpy).toHaveBeenCalledTimes(1);
    r.stop();
  });

  it('stop() clearWatch çağırır ve noktaları döndürür', () => {
    const clearSpy = vi.spyOn(navigator.geolocation, 'clearWatch').mockImplementation(() => {});
    vi.spyOn(navigator.geolocation, 'watchPosition').mockReturnValue(7);
    const r = new TrailRecorder();
    r.start();
    const out = r.stop();
    expect(clearSpy).toHaveBeenCalledWith(7);
    expect(Array.isArray(out)).toBe(true);
  });

  it('start etmeden stop() crash etmez', () => {
    const r = new TrailRecorder();
    expect(() => r.stop()).not.toThrow();
  });

  it('60m üstü doğruluklu noktaları atar', () => {
    let captured: PositionCallback | null = null;
    vi.spyOn(navigator.geolocation, 'watchPosition').mockImplementation((ok) => {
      captured = ok;
      return 1;
    });
    const r = new TrailRecorder();
    r.start();
    captured!({
      coords: { latitude: 21.42, longitude: 39.82, accuracy: 100 } as GeolocationCoordinates,
      timestamp: 1,
    } as GeolocationPosition);
    expect(r.getPoints()).toHaveLength(0);
    r.stop();
  });

  it('5m altı hareketleri birleştirir', () => {
    let captured: PositionCallback | null = null;
    vi.spyOn(navigator.geolocation, 'watchPosition').mockImplementation((ok) => {
      captured = ok;
      return 1;
    });
    const r = new TrailRecorder();
    r.start();
    captured!({
      coords: { latitude: 21.42, longitude: 39.82, accuracy: 10 } as GeolocationCoordinates,
      timestamp: 1,
    } as GeolocationPosition);
    captured!({
      coords: { latitude: 21.42, longitude: 39.82, accuracy: 10 } as GeolocationCoordinates,
      timestamp: 2,
    } as GeolocationPosition);
    expect(r.getPoints()).toHaveLength(1);
    r.stop();
  });
});
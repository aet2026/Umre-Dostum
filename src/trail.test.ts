import { describe, it, expect } from 'vitest';
import { distanceM, bearingDeg } from './trail';

describe('distanceM', () => {
  it('aynı nokta için 0 döner', () => {
    const p = { lat: 21.4225, lng: 39.8261 };
    expect(distanceM(p, p)).toBeCloseTo(0, 1);
  });

  it('bilinen mesafeyi yaklaşık hesaplar', () => {
    // Kabe'den yaklaşık 100m kuzey
    const a = { lat: 21.4225, lng: 39.8261 };
    const b = { lat: 21.4234, lng: 39.8261 };
    const d = distanceM(a, b);
    expect(d).toBeGreaterThan(90);
    expect(d).toBeLessThan(110);
  });
});

describe('bearingDeg', () => {
  it('kuzey yönü 0 veya 360 döner', () => {
    const a = { lat: 21.4225, lng: 39.8261 };
    const b = { lat: 21.4235, lng: 39.8261 };
    const bDeg = bearingDeg(a, b);
    expect(bDeg < 5 || bDeg > 355).toBe(true);
  });
});
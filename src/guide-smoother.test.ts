import { describe, it, expect } from 'vitest';
import { PositionSmoother } from './guide-smoother';

describe('PositionSmoother', () => {
  it('ilk okumada ham veriyi döner', () => {
    const s = new PositionSmoother();
    expect(s.hasValue()).toBe(false);
    const r = s.update({ lat: 21.4, lng: 39.8 }, 10);
    expect(r).toEqual({ lat: 21.4, lng: 39.8 });
    expect(s.hasValue()).toBe(true);
  });

  it('aynı konum tekrar gelirse konum değişmez', () => {
    const s = new PositionSmoother();
    s.update({ lat: 21.4, lng: 39.8 }, 10);
    const r = s.update({ lat: 21.4, lng: 39.8 }, 10);
    expect(r.lat).toBeCloseTo(21.4, 5);
    expect(r.lng).toBeCloseTo(39.8, 5);
  });

  it('küçük sıçrama yumuşatılır', () => {
    const s = new PositionSmoother();
    s.update({ lat: 21.4, lng: 39.8 }, 10);
    const r = s.update({ lat: 21.4005, lng: 39.8 }, 10);
    // α = 0.6 → 21.4 + 0.6·0.0005 = 21.4003
    expect(r.lat).toBeGreaterThan(21.4);
    expect(r.lat).toBeLessThan(21.4005);
    expect(r.lat).toBeCloseTo(21.4003, 4);
  });

  it('kötü hassasiyette eski değere daha çok yaslanır', () => {
    const good = new PositionSmoother();
    good.update({ lat: 21.4, lng: 39.8 }, 10);
    const goodResult = good.update({ lat: 21.401, lng: 39.8 }, 10);

    const bad = new PositionSmoother();
    bad.update({ lat: 21.4, lng: 39.8 }, 10);
    const badResult = bad.update({ lat: 21.401, lng: 39.8 }, 150);

    expect(badResult.lat).toBeLessThan(goodResult.lat);
    expect(badResult.lat).toBeGreaterThan(21.4);
  });

  it('teleport (>500 m) algılanınca sıfırlanır', () => {
    const s = new PositionSmoother();
    s.update({ lat: 21.5, lng: 39.9 }, 10);
    // ~11 km uzaklığa sıçrama
    const r = s.update({ lat: 21.42355, lng: 39.8259 }, 5);
    expect(r.lat).toBe(21.42355);
    expect(r.lng).toBe(39.8259);
  });

  it('reset sonrası ilk okuma ham veri olur', () => {
    const s = new PositionSmoother();
    s.update({ lat: 21.4, lng: 39.8 }, 10);
    s.update({ lat: 21.401, lng: 39.8 }, 10);
    s.reset();
    expect(s.hasValue()).toBe(false);
    const r = s.update({ lat: 21.5, lng: 39.9 }, 10);
    expect(r).toEqual({ lat: 21.5, lng: 39.9 });
  });

  it('acc=NaN veya negatif → 40 m referansına düşer', () => {
    const s = new PositionSmoother();
    s.update({ lat: 21.4, lng: 39.8 }, NaN);
    const r = s.update({ lat: 21.401, lng: 39.8 }, -5);
    // α = min(0.6, max(0.15, 30/40)) = 0.6
    expect(r.lat).toBeCloseTo(21.4006, 4);
  });
});
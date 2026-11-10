import { describe, it, expect, beforeEach } from 'vitest';
import {
  summarizeFixes,
  assess,
  saveMeasurement,
  loadMeasurements,
  clearMeasurements,
  exportMeasurements,
  type Fix,
} from './verify';

function fixes(n: number, lat: number, lng: number, acc = 10, jitter = 0.00001): Fix[] {
  return Array.from({ length: n }, (_, i) => ({
    lat: lat + ((i % 3) - 1) * jitter,
    lng: lng + ((i % 5) - 2) * jitter,
    accuracy: acc,
    t: i,
  }));
}

describe('verify', () => {
  beforeEach(() => localStorage.clear());

  it('yeterli hassas örnek yoksa null', () => {
    expect(summarizeFixes(fixes(5, 21.4, 39.8))).toBeNull();
    expect(summarizeFixes(fixes(20, 21.4, 39.8, 80))).toBeNull(); // hepsi >30 m
  });

  it('medyan nokta ve yayılım hesaplanır', () => {
    const s = summarizeFixes(fixes(20, 21.4210447, 39.8258406))!;
    expect(s.samples).toBe(20);
    expect(s.lat).toBeCloseTo(21.4210447, 5);
    expect(s.lng).toBeCloseTo(39.8258406, 5);
    expect(s.spreadM).toBeLessThan(5);
    expect(s.accuracy).toBe(10);
  });

  it('aykırı (sıçrayan) okumalar medyanı bozmaz', () => {
    const list = fixes(20, 21.42, 39.82);
    list.push({ lat: 21.5, lng: 39.9, accuracy: 10, t: 99 }); // tek sıçrama
    list.push({ lat: 21.3, lng: 39.7, accuracy: 10, t: 100 });
    const s = summarizeFixes(list)!;
    expect(s.lat).toBeCloseTo(21.42, 4);
    expect(s.lng).toBeCloseTo(39.82, 4);
  });

  it('hassasiyeti kötü okumalar elenir', () => {
    const list = [...fixes(10, 21.42, 39.82), ...fixes(30, 21.5, 39.9, 200)];
    const s = summarizeFixes(list)!;
    expect(s.samples).toBe(10);
    expect(s.lat).toBeCloseTo(21.42, 4);
  });

  it('assess: tutarsız ölçüm bad, uyumlu good, uzak check', () => {
    expect(assess(10, 40)).toBe('bad');
    expect(assess(10, 5)).toBe('good');
    expect(assess(120, 5)).toBe('check');
    expect(assess(undefined, 5)).toBe('good');
  });

  it('ölçümler saklanır, yüklenir, temizlenir', () => {
    const m = { doorId: 1, lat: 21.42, lng: 39.82, accuracy: 8, spreadM: 3, samples: 12, measuredAt: 1 };
    saveMeasurement(m);
    saveMeasurement({ ...m, doorId: 79 });
    expect(loadMeasurements().map(x => x.doorId)).toEqual([1, 79]);
    clearMeasurements();
    expect(loadMeasurements()).toEqual([]);
  });

  it('export JSON okunur ve yuvarlanır', () => {
    const json = exportMeasurements([
      { doorId: 62, lat: 21.42283781234, lng: 39.82456961234, accuracy: 7.6, spreadM: 3.2, samples: 15, measuredAt: 0, catalogDiffM: 12.4 },
    ]);
    const arr = JSON.parse(json);
    expect(arr[0]).toMatchObject({ doorId: 62, lat: 21.4228378, lng: 39.8245696, accuracy: 8, spreadM: 3, catalogDiffM: 12 });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { saveGate, loadGate, clearGate } from './storage';
import type { SavedGate } from './types';

const KEY = 'savedGate.v1';

const sample: SavedGate = {
  doorId: 100,
  doorName: 'Kral Abdullah',
  outsideLat: 21.42355,
  outsideLng: 39.82590,
  savedAt: 1_700_000_000_000,
  trail: [
    { lat: 21.42355, lng: 39.82590, accuracy: 10, timestamp: 1 },
    { lat: 21.42360, lng: 39.82595, accuracy: 12, timestamp: 2 },
  ],
  locationSource: 'gps',
  accuracy: 8,
};

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('boş localStorage\'da null döner', () => {
    expect(loadGate()).toBeNull();
  });

  it('saveGate + loadGate roundtrip', () => {
    saveGate(sample);
    const loaded = loadGate();
    expect(loaded).not.toBeNull();
    expect(loaded!.doorId).toBe(sample.doorId);
    expect(loaded!.doorName).toBe(sample.doorName);
    expect(loaded!.outsideLat).toBeCloseTo(sample.outsideLat, 5);
    expect(loaded!.trail).toHaveLength(2);
  });

  it('bozuk JSON için null döner (crash etmez)', () => {
    localStorage.setItem(KEY, '{bad json');
    expect(loadGate()).toBeNull();
  });

  it('doorId sayı değilse null döner', () => {
    localStorage.setItem(KEY, JSON.stringify({ ...sample, doorId: 'x' }));
    expect(loadGate()).toBeNull();
  });

  it('outsideLat sayı değilse null döner', () => {
    localStorage.setItem(KEY, JSON.stringify({ ...sample, outsideLat: 'y' }));
    expect(loadGate()).toBeNull();
  });

  it('outsideLng sayı değilse null döner', () => {
    localStorage.setItem(KEY, JSON.stringify({ ...sample, outsideLng: 'z' }));
    expect(loadGate()).toBeNull();
  });

  it('trail yoksa boş dizi yapar', () => {
    const noTrail = { ...sample } as Partial<SavedGate>;
    delete noTrail.trail;
    localStorage.setItem(KEY, JSON.stringify(noTrail));
    const loaded = loadGate();
    expect(loaded?.trail).toEqual([]);
  });

  it('trail dizi değilse boş dizi yapar', () => {
    localStorage.setItem(KEY, JSON.stringify({ ...sample, trail: 'oops' }));
    expect(loadGate()?.trail).toEqual([]);
  });

  it('clearGate kaydı siler', () => {
    saveGate(sample);
    clearGate();
    expect(loadGate()).toBeNull();
  });

  it('localStorage.setItem hata atarsa saveGate crash etmez', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveGate(sample)).not.toThrow();
    spy.mockRestore();
  });

  it('localStorage.removeItem hata atarsa clearGate crash etmez', () => {
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('remove failed');
    });
    expect(() => clearGate()).not.toThrow();
    spy.mockRestore();
  });

  it('GPS kaynağı korunur', () => {
    saveGate(sample);
    expect(loadGate()?.locationSource).toBe('gps');
    expect(loadGate()?.accuracy).toBe(8);
  });

  it('eski kayıt (locationSource yok) güvenilmez sayılır → catalog', () => {
    const old = { ...sample } as Partial<SavedGate>;
    delete old.locationSource;
    localStorage.setItem(KEY, JSON.stringify(old));
    expect(loadGate()?.locationSource).toBe('catalog');
  });

  it('geçersiz koordinat aralığı null döner', () => {
    localStorage.setItem(KEY, JSON.stringify({ ...sample, outsideLat: 123 }));
    expect(loadGate()).toBeNull();
  });

  it('numberMismatch bayrağı korunur', () => {
    saveGate({ ...sample, numberMismatch: true });
    expect(loadGate()?.numberMismatch).toBe(true);
    saveGate(sample);
    expect(loadGate()?.numberMismatch).toBe(false);
  });
});

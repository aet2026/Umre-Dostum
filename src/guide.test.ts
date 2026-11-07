import { describe, it, expect } from 'vitest';
import { computeNavigation } from './guide';
import type { SavedGate } from './types';

const mockSaved: SavedGate = {
  doorId: 100,
  doorName: 'Kral Abdullah',
  outsideLat: 21.42355,
  outsideLng: 39.82590,
  savedAt: Date.now(),
  trail: [],
};

describe('computeNavigation', () => {
  it('hedefe çok yakınken arrived döner', () => {
    const nav = computeNavigation(mockSaved, { lat: 21.42355, lng: 39.82590 });
    expect(nav.arrived).toBe(true);
    expect(nav.distance).toBeLessThan(20);
    expect(nav.instruction).toMatch(/önündesiniz/);
  });

  it('uzaktayken arrived false döner', () => {
    const nav = computeNavigation(mockSaved, { lat: 21.42000, lng: 39.82000 });
    expect(nav.arrived).toBe(false);
    expect(nav.distance).toBeGreaterThan(100);
  });

  it('yön talimatı Türkçe yön içerir', () => {
    const nav = computeNavigation(mockSaved, { lat: 21.42000, lng: 39.82000 });
    expect(nav.instruction).toMatch(/kuzey|güney|doğu|batı/);
  });

  it('2 km dışındaysa isTooFar true döner', () => {
    const nav = computeNavigation(mockSaved, { lat: 21.50, lng: 39.90 });
    expect(nav.isTooFar).toBe(true);
    expect(nav.instruction).toMatch(/Mescid-i Haram/);
  });

  it('2 km içindeyse isTooFar false döner', () => {
    const nav = computeNavigation(mockSaved, { lat: 21.42355, lng: 39.82590 });
    expect(nav.isTooFar).toBe(false);
  });

  it('1000m üstü mesafe kilometre formatında', () => {
    // ~1.1 km kuzey
    const nav = computeNavigation(mockSaved, { lat: 21.43355, lng: 39.82590 });
    expect(nav.instruction).toMatch(/kilometre/);
  });

  it('1000m altı mesafe metre formatında', () => {
    const nav = computeNavigation(mockSaved, { lat: 21.42455, lng: 39.82590 });
    expect(nav.instruction).toMatch(/metre/);
  });

  it('50m altı mesafe tam metre olarak okunur', () => {
    // ~30m kuzey
    const nav = computeNavigation(mockSaved, { lat: 21.42382, lng: 39.82590 });
    expect(nav.instruction).toMatch(/\d+ metre/);
  });

  it('kuzeyde kullanıcı için "kuzey" yönü döner', () => {
    // kullanıcı güneyde, hedef kuzeyde → kuzey yönü
    const nav = computeNavigation(mockSaved, { lat: 21.42000, lng: 39.82590 });
    expect(nav.instruction).toMatch(/kuzey/);
  });

  it('doğudaki kullanıcı için "batı" yönü döner', () => {
    // kullanıcı doğuda (lng daha büyük), hedef batıda
    const nav = computeNavigation(mockSaved, { lat: 21.42355, lng: 39.83000 });
    expect(nav.instruction).toMatch(/batı/);
  });

  it('kapı verisi yoksa saved koordinatlarına düşer', () => {
    const orphan: SavedGate = {
      doorId: 9999,
      doorName: 'Bilinmeyen',
      outsideLat: 21.42355,
      outsideLng: 39.82590,
      savedAt: Date.now(),
      trail: [],
    };
    const nav = computeNavigation(orphan, { lat: 21.42355, lng: 39.82590 });
    expect(nav.arrived).toBe(true);
    expect(nav.instruction).toMatch(/Bilinmeyen/);
  });

  it('bearingDeg 0-360 aralığında döner', () => {
    const nav = computeNavigation(mockSaved, { lat: 21.42000, lng: 39.82000 });
    expect(nav.bearingDeg).toBeGreaterThanOrEqual(0);
    expect(nav.bearingDeg).toBeLessThan(360);
  });
});
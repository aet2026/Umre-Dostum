import { describe, it, expect } from 'vitest';
import {
  DOORS,
  findDoor,
  mainDoors,
  popularDoors,
  doorsNearBus,
  unverifiedDoors,
} from './doors';

describe('doors', () => {
  it('en az bir ana kapı var', () => {
    expect(mainDoors().length).toBeGreaterThan(0);
  });

  it('mainDoors sadece isMain=true döner', () => {
    expect(mainDoors().every(d => d.isMain)).toBe(true);
  });

  it('mainDoors tüm DOORS içinden seçer', () => {
    for (const m of mainDoors()) {
      expect(DOORS).toContain(m);
    }
  });

  it('unverifiedDoors sadece doğrulanmamışları döner', () => {
    expect(unverifiedDoors().every(d => d.verification !== 'verified')).toBe(true);
  });

  it('unverifiedDoors doğrulanmışları içermez', () => {
    const unv = unverifiedDoors();
    const verified = DOORS.filter(d => d.verification === 'verified');
    for (const v of verified) {
      expect(unv).not.toContain(v);
    }
  });

  it('findDoor var olan id için kapı döner', () => {
    const first = DOORS[0]!;
    expect(findDoor(first.id)).toBe(first);
  });

  it('findDoor olmayan id için undefined döner', () => {
    expect(findDoor(999999)).toBeUndefined();
  });

  it('her kapının geçerli koordinatı var', () => {
    for (const d of DOORS) {
      expect(d.outsideLat).toBeGreaterThan(-90);
      expect(d.outsideLat).toBeLessThan(90);
      expect(d.outsideLng).toBeGreaterThan(-180);
      expect(d.outsideLng).toBeLessThan(180);
    }
  });

  // ---- yeni fonksiyonlar ----

  it('popularDoors sadece popularity=high döner', () => {
    const p = popularDoors();
    expect(p.length).toBeGreaterThan(0);
    expect(p.every(d => d.popularity === 'high')).toBe(true);
  });

  it('en az 5 popüler kapı var', () => {
    expect(popularDoors().length).toBeGreaterThanOrEqual(5);
  });

  it('doorsNearBus boş nearBus döndürmez', () => {
    const withBus = doorsNearBus();
    expect(withBus.length).toBeGreaterThan(0);
    for (const d of withBus) {
      expect(d.nearBus).toBeTruthy();
      expect(d.nearBus).not.toBe('—');
    }
  });

  it('otobüs yakını kapılar arasında Kral Abdülaziz ve Fetih var', () => {
    const ids = doorsNearBus().map(d => d.id);
    expect(ids).toContain(1);   // Kral Abdülaziz — SAPTCO VIP / Ajyad
    expect(ids).toContain(45);  // Fetih — Şib Amir
  });

  it('tüm ana kapılar popüler', () => {
    for (const m of mainDoors()) {
      expect(m.popularity).toBe('high');
    }
  });

  it('yeni eklenen kapılar mevcut', () => {
    for (const id of [2, 37, 60, 86, 90]) {
      expect(findDoor(id)).toBeDefined();
    }
  });
});
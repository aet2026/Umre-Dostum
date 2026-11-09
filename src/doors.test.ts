import { describe, it, expect } from 'vitest';
import {
  DOORS,
  findDoor,
  mainDoors,
  popularDoors,
  unverifiedDoors,
  doorLabel,
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

  it('tüm ana kapılar popüler', () => {
    for (const m of mainDoors()) {
      expect(m.popularity).toBe('high');
    }
  });

  it('yeni eklenen kapılar mevcut', () => {
    for (const id of [13, 19, 64]) {
      expect(findDoor(id)).toBeDefined();
    }
  });

  it('resmî ana kapı numaraları katalogda: 1, 45, 62, 79, 100', () => {
    for (const id of [1, 45, 62, 79, 100]) {
      expect(findDoor(id)?.isMain).toBe(true);
    }
  });

  it('doğrulanamayan eski numaralar katalogda yok: 2, 37, 60, 86, 90', () => {
    for (const id of [2, 37, 60, 86, 90]) {
      expect(findDoor(id)).toBeUndefined();
    }
  });

  it('her kapının koordinatı Mescid-i Haram çevresinde (Kâbe\'ye 100-500 m)', () => {
    const K = { lat: 21.42249, lng: 39.82618 };
    for (const d of DOORS) {
      const dy = (d.outsideLat - K.lat) * 111320;
      const dx = (d.outsideLng - K.lng) * 111320 * Math.cos((K.lat * Math.PI) / 180);
      const dist = Math.hypot(dx, dy);
      expect(dist).toBeGreaterThan(100);
      expect(dist).toBeLessThan(500);
    }
  });

  it('bilinen kaynak koordinatları (hajjmap/OSM) birebir', () => {
    expect(findDoor(1)).toMatchObject({ outsideLat: 21.4210447, outsideLng: 39.8258406 });
    expect(findDoor(79)).toMatchObject({ outsideLat: 21.421232, outsideLng: 39.8240461 });
    expect(findDoor(62)).toMatchObject({ outsideLat: 21.4228378, outsideLng: 39.8245696 });
    expect(findDoor(45)).toMatchObject({ outsideLat: 21.4240151, outsideLng: 39.8265147 });
    expect(findDoor(100)).toMatchObject({ outsideLat: 21.4253914, outsideLng: 39.824132 });
  });

  it('doorLabel: adlı kapı ve numara-only kapı', () => {
    expect(doorLabel(62, 'Umre')).toBe("Umre Kapısı");
    expect(doorLabel(84, '')).toBe('84 numaralı kapı');
  });

  it('kapı id\'leri benzersiz', () => {
    expect(new Set(DOORS.map(d => d.id)).size).toBe(DOORS.length);
  });
});

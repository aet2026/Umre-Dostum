import { describe, it, expect } from 'vitest';
import { DOORS, findDoor, mainDoors, unverifiedDoors } from './doors';

describe('doors', () => {
  it('en az bir ana kapı var', () => {
    expect(mainDoors().length).toBeGreaterThan(0);
  });

  it('mainDoors sadece isMain=true döner', () => {
    expect(mainDoors().every(d => d.isMain)).toBe(true);
  });

  it('mainDoors tüm DOORS içinden seçer', () => {
    const mains = mainDoors();
    for (const m of mains) {
      expect(DOORS).toContain(m);
    }
  });

  it('unverifiedDoors sadece doğrulanmamışları döner', () => {
    const unv = unverifiedDoors();
    expect(unv.every(d => d.verification !== 'verified')).toBe(true);
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
});
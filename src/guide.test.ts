import { describe, it, expect } from 'vitest';
import { computeNavigation, resolveTarget, formatKm } from './guide';
import type { SavedGate } from './types';

const mockSaved: SavedGate = {
  doorId: 100,
  doorName: 'Kral Abdullah',
  outsideLat: 21.42355,
  outsideLng: 39.82590,
  savedAt: Date.now(),
  trail: [],
  locationSource: 'gps',
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
      locationSource: 'gps',
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
describe('computeNavigation — pusula', () => {
  it('cihaz yönü verilmezse kuzey referanslı tarif döner', () => {
    const nav = computeNavigation(mockSaved, { lat: 21.42000, lng: 39.82590 });
    expect(nav.relativeBearing).toBeUndefined();
    expect(nav.instruction).toMatch(/kuzey/);
  });

  it('cihaz hedefe bakıyorsa "düz yürüyün"', () => {
    // hedef kuzeyde, cihaz kuzeye bakıyor
    const nav = computeNavigation(
      mockSaved,
      { lat: 21.42000, lng: 39.82590 },
      0
    );
    expect(nav.relativeBearing).toBeDefined();
    expect(nav.instruction).toContain('düz yürüyün');
  });

  it('hedef sağda ise "sağa dönüp yürüyün"', () => {
    // hedef kuzeyde, cihaz doğuya bakıyor (90) → hedef solda (-90) → sola dön
    // hedef kuzeyde, cihaz batıya bakıyor (270) → hedef sağda (90) → sağa dön
    const nav = computeNavigation(
      mockSaved,
      { lat: 21.42000, lng: 39.82590 },
      270
    );
    expect(nav.instruction).toContain('sağa');
  });

  it('hedef solda ise "sola dönüp yürüyün"', () => {
    const nav = computeNavigation(
      mockSaved,
      { lat: 21.42000, lng: 39.82590 },
      90
    );
    expect(nav.instruction).toContain('sola');
  });

  it('hedef arkada ise "arkanıza dönüp yürüyün"', () => {
    const nav = computeNavigation(
      mockSaved,
      { lat: 21.42000, lng: 39.82590 },
      180
    );
    expect(nav.instruction).toContain('arkanıza dönüp');
  });

  it('relativeBearing -180..180 aralığında', () => {
    const nav = computeNavigation(
      mockSaved,
      { lat: 21.42000, lng: 39.82590 },
      300
    );
    expect(nav.relativeBearing).toBeGreaterThanOrEqual(-180);
    expect(nav.relativeBearing).toBeLessThanOrEqual(180);
  });
});
describe('computeNavigation — güvenlik', () => {
  it('hedef katalog değil, kaydedilen GPS konumudur', () => {
    const gps: SavedGate = { ...mockSaved, outsideLat: 21.4300, outsideLng: 39.8300 };
    const t = resolveTarget(gps);
    expect(t.lat).toBe(21.4300);
    expect(t.lng).toBe(39.8300);
    const nav = computeNavigation(gps, { lat: 21.4300, lng: 39.8300 });
    expect(nav.arrived).toBe(true);
  });

  it('yaklaşık (katalog) kayıtta approximate=true ve varışta tabela uyarısı verir', () => {
    const old: SavedGate = { ...mockSaved, locationSource: 'catalog' };
    const nav = computeNavigation(old, { lat: 21.42355, lng: 39.82590 });
    expect(nav.approximate).toBe(true);
    expect(nav.instruction).toMatch(/tabeladan/);
  });

  it('GPS kaydında approximate=false', () => {
    const nav = computeNavigation(mockSaved, { lat: 21.42000, lng: 39.82590 });
    expect(nav.approximate).toBe(false);
  });

  it('düşük hassasiyette varış yarıçapı büyür (en çok 40 m)', () => {
    // ~33 m kuzey
    const cur = { lat: 21.42385, lng: 39.82590 };
    expect(computeNavigation(mockSaved, cur).arrived).toBe(false);
    expect(computeNavigation(mockSaved, cur, null, 35).arrived).toBe(true);
  });

  it('995 m "1000 metre" değil kilometre olarak okunur', () => {
    const nav = computeNavigation(mockSaved, { lat: 21.42355 - 0.00895, lng: 39.82590 });
    expect(nav.instruction).not.toMatch(/1000 metre/);
  });
});

describe('2 km kuralı: kayıtlı ve elle yazılan kapı', () => {
  const far = { lat: 21.50, lng: 39.90 }; // ~11 km

  it('kayıtlı kapıda: kapı adı, km ve "yürümek için uygun değil" söylenir', () => {
    const nav = computeNavigation(mockSaved, far); // mockSaved = 100 Kral Abdullah
    expect(nav.isTooFar).toBe(true);
    expect(nav.instruction).toContain("Kral Abdullah Kapısı'ndan");
    expect(nav.instruction).toMatch(/\d+ km uzaktasınız/);
    expect(nav.instruction).toContain('yürümek için uygun değil');
    expect(nav.instruction).toContain('yaklaşınca tekrar deneyin');
  });

  it('kayıtlı kapıda uzaklık katalogdaki kapı konumundan ölçülür (250 km örneği)', () => {
    // Kral Abdullah kapısı ~ (21.4254, 39.8241); ~250 km güneyde
    const nav = computeNavigation(mockSaved, { lat: 21.4254 - 2.25, lng: 39.8241 });
    expect(nav.instruction).toMatch(/2[45]\d km uzaktasınız/);
    expect(Math.round(nav.distance / 1000)).toBeGreaterThan(240);
  });

  it('elle yazılan kapıda eski davranış korunur', () => {
    const custom: SavedGate = { ...mockSaved, doorId: 9999, doorName: '' };
    const nav = computeNavigation(custom, far);
    expect(nav.isTooFar).toBe(true);
    expect(nav.instruction).toBe(
      "Mescid-i Haram'ın dışındasınız. Lütfen Harem bölgesine yaklaşıp tekrar deneyin."
    );
  });

  it('kayıtlı kapıda 2 km içindeyse yönlendirme başlar', () => {
    const nav = computeNavigation(mockSaved, { lat: 21.4254 - 0.01, lng: 39.8241 });
    expect(nav.isTooFar).toBe(false);
  });

  it('formatKm: 250 km, 11 km, 2,5 km', () => {
    expect(formatKm(250_000)).toBe('250 km');
    expect(formatKm(11_400)).toBe('11 km');
    expect(formatKm(2_500)).toBe('2,5 km');
  });

  it('söylenen rakam ölçülen gerçek uzaklıktır: Ankara ~2160 km, Medine ~340 km', () => {
    const ankara = computeNavigation(mockSaved, { lat: 39.9334, lng: 32.8597 });
    const km1 = Math.round(ankara.distance / 1000);
    expect(km1).toBeGreaterThan(2100);
    expect(km1).toBeLessThan(2250);
    expect(ankara.instruction).toContain(`${km1} km uzaktasınız`);

    const medine = computeNavigation(mockSaved, { lat: 24.4672, lng: 39.6111 });
    const km2 = Math.round(medine.distance / 1000);
    expect(km2).toBeGreaterThan(300);
    expect(km2).toBeLessThan(380);
    expect(medine.instruction).toContain(`${km2} km uzaktasınız`);
  });
});

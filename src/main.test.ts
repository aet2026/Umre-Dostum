import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SavedGate } from './types';

// --- map modülünü tamamen mock'la (Leaflet jsdom'da sorun çıkarır) ---
vi.mock('./map', () => ({
  initMap: vi.fn(),
  drawTrail: vi.fn(),
  setCurrent: vi.fn(),
  setTarget: vi.fn(),
  drawLineToTarget: vi.fn(),
  fitToAll: vi.fn(),
  invalidateSize: vi.fn(),
  showAllDoorsDebug: vi.fn(),
}));

// --- speech modülünü mock'la (ses çıkmasın) ---
vi.mock('./speech', () => ({
  initSpeech: vi.fn(),
  speak: vi.fn(),
  speakArabic: vi.fn(),
  speakHelp: vi.fn(() => true),
  repeatLast: vi.fn(),
  stopSpeech: vi.fn(),
}));

const sample: SavedGate = {
  doorId: 100,
  doorName: 'Kral Abdullah',
  outsideLat: 21.42355,
  outsideLng: 39.82590,
  savedAt: 1_700_000_000_000,
  trail: [],
  locationSource: 'gps',
};

function setupDOM(): void {
  document.body.innerHTML = `
    <div id="sr"></div>
    <section id="home" class="screen"><div id="saved"></div>
      <button id="btnSave"></button>
      <button id="btnGuide"></button>
      <button id="btnHelp"></button>
    </section>
    <section id="pickDoor" class="screen hide"><div id="doorList"></div><input id="customDoor"><button id="btnCustomDoor"></button></section>
    <section id="confirm" class="screen hide"><div id="confirmText"></div>
      <button id="btnConfirmYes"></button>
      <button id="btnConfirmNo"></button>
    </section>
    <section id="saving" class="screen hide"><div id="fix"></div>
      <button id="btnSaveBack"></button><button id="btnSaveRetry" class="hide"></button>
    </section>
    <section id="guide" class="screen hide">
      <div id="warn" class="hide"></div><div id="arrowWrap" data-state="idle"><svg id="arrow"></svg><div id="arrowNote"></div></div><div id="map"></div><div id="say"></div><div id="dist"></div>
      <button id="btnRepeat"></button><button id="btnStop"></button>
      <a id="gm"></a>
    </section>
    <section id="help" class="screen hide">
      <div id="hTitleAr"></div>
      <div id="hBodyAr"></div>
      <div id="hBodyTr"></div><div id="hNote" class="hide"></div>
      <button id="btnSpeakAr"></button>
      <button id="btnHelpBack"></button>
    </section>
  `;
}

async function loadMain(): Promise<void> {
  await import('./main');
}

function mockWatch(): {
  emit: (pos: GeolocationPosition) => void;
  emitError: (err: GeolocationPositionError) => void;
  clearSpy: ReturnType<typeof vi.fn>;
} {
  let okCb: PositionCallback | null = null;
  let errCb: PositionErrorCallback | null = null;
  const clearSpy = vi.fn();
  vi.spyOn(navigator.geolocation, 'watchPosition').mockImplementation((ok, err) => {
    okCb = ok;
    errCb = err ?? null;
    return 12345;
  });
  vi.spyOn(navigator.geolocation, 'clearWatch').mockImplementation(clearSpy);
  return {
    emit: (pos) => okCb?.(pos),
    emitError: (err) => errCb?.(err),
    clearSpy,
  };
}

function mockGeoOK(lat = 21.42355, lng = 39.82590): void {
  vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementation(
    (ok: PositionCallback) => {
      ok({
        coords: {
          latitude: lat,
          longitude: lng,
          accuracy: 10,
        } as GeolocationCoordinates,
        timestamp: Date.now(),
      } as GeolocationPosition);
    }
  );
}

describe('main.ts entegrasyon', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    localStorage.clear();
    setupDOM();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('kayıt yoksa "Henüz kapı kaydedilmedi" gösterir', async () => {
    await loadMain();
    expect(document.getElementById('saved')!.textContent).toContain('Henüz kapı');
  });

  it('kayıt varsa kapı adı ve tarih gösterir', async () => {
    localStorage.setItem('savedGate.v1', JSON.stringify(sample));
    await loadMain();
    const text = document.getElementById('saved')!.textContent ?? '';
    expect(text).toContain('Kral Abdullah');
    expect(text).toContain('Kayıtlı Kapı');
  });

  it('kaydet düğmesi kapı seçimini açar', async () => {
    await loadMain();
    document.getElementById('btnSave')!.click();
    expect(document.getElementById('pickDoor')!.classList.contains('hide')).toBe(false);
    const buttons = document.querySelectorAll('#doorList button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('kapı seçilince onay ekranı açılır', async () => {
    await loadMain();
    document.getElementById('btnSave')!.click();
    const first = document.querySelector('#doorList button') as HTMLButtonElement;
    first.click();
    expect(document.getElementById('confirm')!.classList.contains('hide')).toBe(false);
    expect(document.getElementById('confirmText')!.textContent).toContain(
      'kaydetmek istiyor musunuz'
    );
  });

  it('onayla düğmesi localStorage\'a yazar', async () => {
    mockGeoOK();
    await loadMain();
    document.getElementById('btnSave')!.click();
    (document.querySelector('#doorList button') as HTMLButtonElement).click();
    document.getElementById('btnConfirmYes')!.click();
    await new Promise(r => setTimeout(r, 50));

    const raw = localStorage.getItem('savedGate.v1');
    expect(raw).toBeTruthy();
    const saved = JSON.parse(raw!) as SavedGate;
    expect(saved.doorId).toBeTypeOf('number');
    expect(saved.doorName).toBeTruthy();
  });

  it('kayıt yokken rehbere basınca ana ekranda kalır', async () => {
    await loadMain();
    document.getElementById('btnGuide')!.click();
    await new Promise(r => setTimeout(r, 10));
    expect(document.getElementById('home')!.classList.contains('hide')).toBe(false);
    expect(document.getElementById('guide')!.classList.contains('hide')).toBe(true);
  });

  it('yardım düğmesi yardım ekranını açar', async () => {
    await loadMain();
    document.getElementById('btnHelp')!.click();
    expect(document.getElementById('help')!.classList.contains('hide')).toBe(false);
  });

  it('yardım ekranı kayıtlı kapı adını Arapça ve Türkçe gösterir', async () => {
    localStorage.setItem('savedGate.v1', JSON.stringify(sample));
    await loadMain();
    document.getElementById('btnHelp')!.click();

    expect(document.getElementById('hBodyTr')!.textContent).toContain('Kral Abdullah');
    expect(document.getElementById('hBodyAr')!.textContent).toContain('باب الملك عبد الله');
    expect(document.getElementById('hTitleAr')!.textContent).toContain('أحتاج مساعدة');
  });

  it('kayıt yokken yardım genel mesaj gösterir', async () => {
    await loadMain();
    document.getElementById('btnHelp')!.click();

    expect(document.getElementById('hTitleAr')!.textContent).toContain('أحتاج مساعدة');
    expect(document.getElementById('hBodyAr')!.textContent).toContain('هل يمكنك أن تساعدني');
    expect(document.getElementById('hBodyTr')!.textContent).toContain('yardım');
  });

  it('onay ekranında vazgeç ana ekrana döner', async () => {
    await loadMain();
    document.getElementById('btnSave')!.click();
    (document.querySelector('#doorList button') as HTMLButtonElement).click();
    document.getElementById('btnConfirmNo')!.click();
    expect(document.getElementById('home')!.classList.contains('hide')).toBe(false);
  });

  // ---------------- onGuide / onGuidePos / onGuideErr / onStopGuide ----------------

  it('onGuide: kayıt varsa rehber ekranı açılır, setTarget ve Google Maps linki kurulur', async () => {
    localStorage.setItem('savedGate.v1', JSON.stringify(sample));
    mockGeoOK();
    const w = mockWatch();

    const map = await import('./map');
    await loadMain();
    document.getElementById('btnGuide')!.click();
    await new Promise(r => setTimeout(r, 50));

    expect(document.getElementById('guide')!.classList.contains('hide')).toBe(false);
    expect(map.setTarget).toHaveBeenCalled();
    const gm = document.getElementById('gm') as HTMLAnchorElement;
    expect(gm.href).toContain('google.com/maps');
    expect(gm.href).toContain('destination=');

    document.getElementById('btnStop')!.click();
    expect(w.clearSpy).toHaveBeenCalled();
  });

  it('onGuidePos: konum gelince say ve dist güncellenir', async () => {
    localStorage.setItem('savedGate.v1', JSON.stringify(sample));
    mockGeoOK();
    const w = mockWatch();

    await loadMain();
    document.getElementById('btnGuide')!.click();
    await new Promise(r => setTimeout(r, 50));

    w.emit({
      coords: {
        latitude: 21.42255,
        longitude: 39.82590,
        accuracy: 10,
      } as GeolocationCoordinates,
      timestamp: Date.now(),
    } as GeolocationPosition);

    expect(document.getElementById('say')!.textContent).toContain('metre');
    expect(document.getElementById('dist')!.textContent).toMatch(/metre|km/);
    document.getElementById('btnStop')!.click();
  });

  it('onGuidePos: 2 km dışındaysa "Mescid-i Haram" uyarısı gösterilir', async () => {
    localStorage.setItem('savedGate.v1', JSON.stringify(sample));
    mockGeoOK();
    const w = mockWatch();

    await loadMain();
    document.getElementById('btnGuide')!.click();
    await new Promise(r => setTimeout(r, 50));

    w.emit({
      coords: {
        latitude: 21.50,
        longitude: 39.90,
        accuracy: 10,
      } as GeolocationCoordinates,
      timestamp: Date.now(),
    } as GeolocationPosition);

    expect(document.getElementById('say')!.textContent).toContain('Mescid-i Haram');
    expect(document.getElementById('dist')!.textContent).toContain('km');
    document.getElementById('btnStop')!.click();
  });

  it('onGuidePos: hedefe varınca watch temizlenir ve VARDINIZ gösterilir', async () => {
    localStorage.setItem('savedGate.v1', JSON.stringify(sample));
    mockGeoOK();
    const w = mockWatch();

    await loadMain();
    document.getElementById('btnGuide')!.click();
    await new Promise(r => setTimeout(r, 50));

    w.emit({
      coords: {
        latitude: 21.42355,
        longitude: 39.82590,
        accuracy: 5,
      } as GeolocationCoordinates,
      timestamp: Date.now(),
    } as GeolocationPosition);

    expect(document.getElementById('dist')!.textContent).toContain('VARDINIZ');
    expect(w.clearSpy).toHaveBeenCalledWith(12345);
  });

  it('onGuideErr: konum izni reddedilirse mesaj gösterilir', async () => {
    localStorage.setItem('savedGate.v1', JSON.stringify(sample));
    vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementation(
      (_ok, err) => {
        err?.({
          code: 1,
          message: 'denied',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError);
      }
    );
    const w = mockWatch();

    await loadMain();
    document.getElementById('btnGuide')!.click();
    await new Promise(r => setTimeout(r, 50));

    w.emitError({
      code: 1,
      message: 'denied',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError);

    expect(document.getElementById('say')!.textContent).toContain('Konum izni');
    document.getElementById('btnStop')!.click();
  });

  it('btnStop: rehberden çıkınca ana ekrana döner ve watch temizlenir', async () => {
    localStorage.setItem('savedGate.v1', JSON.stringify(sample));
    mockGeoOK();
    const w = mockWatch();

    await loadMain();
    document.getElementById('btnGuide')!.click();
    await new Promise(r => setTimeout(r, 50));
    document.getElementById('btnStop')!.click();

    expect(document.getElementById('home')!.classList.contains('hide')).toBe(false);
    expect(w.clearSpy).toHaveBeenCalled();
  });

  it('kayıt: GPS konumu kaydedilir (katalog koordinatı değil) ve source=gps', async () => {
    mockGeoOK(21.4300, 39.8300);
    await loadMain();
    document.getElementById('btnSave')!.click();
    (document.querySelector('#doorList button') as HTMLButtonElement).click();
    document.getElementById('btnConfirmYes')!.click();
    await new Promise(r => setTimeout(r, 50));
    const saved = JSON.parse(localStorage.getItem('savedGate.v1')!) as SavedGate;
    expect(saved.outsideLat).toBe(21.4300);
    expect(saved.outsideLng).toBe(39.8300);
    expect(saved.locationSource).toBe('gps');
  });

  it('kayıt: GPS hassasiyeti kötüyse (>100 m) kayıt YAPILMAZ ve tekrar dene görünür', async () => {
    vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementation(
      (ok: PositionCallback) => {
        ok({
          coords: { latitude: 21.4, longitude: 39.8, accuracy: 500 } as GeolocationCoordinates,
          timestamp: Date.now(),
        } as GeolocationPosition);
      }
    );
    await loadMain();
    document.getElementById('btnSave')!.click();
    (document.querySelector('#doorList button') as HTMLButtonElement).click();
    document.getElementById('btnConfirmYes')!.click();
    await new Promise(r => setTimeout(r, 50));
    expect(localStorage.getItem('savedGate.v1')).toBeNull();
    expect(document.getElementById('btnSaveRetry')!.classList.contains('hide')).toBe(false);
  });

  it('kayıt: konum izni reddedilirse kayıt yapılmaz', async () => {
    vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementation(
      (_ok, err) => {
        err?.({ code: 1, message: 'denied' } as GeolocationPositionError);
      }
    );
    await loadMain();
    document.getElementById('btnSave')!.click();
    (document.querySelector('#doorList button') as HTMLButtonElement).click();
    document.getElementById('btnConfirmYes')!.click();
    await new Promise(r => setTimeout(r, 50));
    expect(localStorage.getItem('savedGate.v1')).toBeNull();
    expect(document.getElementById('fix')!.textContent).toContain('izni');
  });

  it('kayıt sürerken VAZGEÇ → sonradan kayıt yazılmaz', async () => {
    let resolveGeo: PositionCallback | null = null;
    vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementation(
      (ok: PositionCallback) => {
        resolveGeo = ok;
      }
    );
    await loadMain();
    document.getElementById('btnSave')!.click();
    (document.querySelector('#doorList button') as HTMLButtonElement).click();
    document.getElementById('btnConfirmYes')!.click();
    document.getElementById('btnSaveBack')!.click();
    resolveGeo!({
      coords: { latitude: 21.4, longitude: 39.8, accuracy: 5 } as GeolocationCoordinates,
      timestamp: Date.now(),
    } as GeolocationPosition);
    await new Promise(r => setTimeout(r, 50));
    expect(localStorage.getItem('savedGate.v1')).toBeNull();
    expect(document.getElementById('home')!.classList.contains('hide')).toBe(false);
  });

  it('rehber: hedef kayıtlı GPS konumudur (katalog değil)', async () => {
    const custom = { ...sample, outsideLat: 21.4400, outsideLng: 39.8400 };
    localStorage.setItem('savedGate.v1', JSON.stringify(custom));
    mockGeoOK();
    mockWatch();
    const map = await import('./map');
    await loadMain();
    document.getElementById('btnGuide')!.click();
    await new Promise(r => setTimeout(r, 50));
    expect(map.setTarget).toHaveBeenCalledWith(21.44, 39.84, expect.any(String));
    expect((document.getElementById('gm') as HTMLAnchorElement).href).toContain('21.44,39.84');
    document.getElementById('btnStop')!.click();
  });

  it('rehber: eski/yaklaşık kayıtta uyarı bandı görünür', async () => {
    const old = { ...sample } as Partial<SavedGate>;
    delete old.locationSource;
    localStorage.setItem('savedGate.v1', JSON.stringify(old));
    mockGeoOK();
    mockWatch();
    await loadMain();
    document.getElementById('btnGuide')!.click();
    await new Promise(r => setTimeout(r, 50));
    expect(document.getElementById('warn')!.classList.contains('hide')).toBe(false);
    document.getElementById('btnStop')!.click();
  });

  it('yardım: Arapça→Türkçe tek kuyrukta (speakHelp) çağrılır, geri dönünce konuşma durur', async () => {
    const speech = await import('./speech');
    await loadMain();
    document.getElementById('btnHelp')!.click();
    expect(speech.speakHelp).toHaveBeenCalledTimes(1);
    document.getElementById('btnHelpBack')!.click();
    expect(speech.stopSpeech).toHaveBeenCalled();
    expect(document.getElementById('home')!.classList.contains('hide')).toBe(false);
  });

  it('yardım: Arapça ses yoksa not gösterilir', async () => {
    const speech = await import('./speech');
    (speech.speakHelp as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
    await loadMain();
    document.getElementById('btnHelp')!.click();
    expect(document.getElementById('hNote')!.classList.contains('hide')).toBe(false);
  });

  it('seçici: ana kapılar listelenir, doğrulanamayan eski numaralar listelenmez', async () => {
    await loadMain();
    document.getElementById('btnSave')!.click();
    const labels = Array.from(document.querySelectorAll('#doorList button')).map(
      b => b.firstChild?.textContent
    );
    for (const id of ['1', '45', '62', '79', '100']) expect(labels).toContain(id);
    for (const id of ['2', '37', '60', '86', '90']) expect(labels).not.toContain(id);
  });

  it('elle numara girilince onay ekranı açılır ve kayıt adsız kapı olarak yapılır', async () => {
    mockGeoOK(21.4220, 39.8290);
    await loadMain();
    document.getElementById('btnSave')!.click();
    (document.getElementById('customDoor') as HTMLInputElement).value = '84';
    document.getElementById('btnCustomDoor')!.click();
    expect(document.getElementById('confirm')!.classList.contains('hide')).toBe(false);
    expect(document.getElementById('confirmText')!.textContent).toContain('84 numaralı kapı');
    document.getElementById('btnConfirmYes')!.click();
    await new Promise(r => setTimeout(r, 50));
    const saved = JSON.parse(localStorage.getItem('savedGate.v1')!) as SavedGate;
    expect(saved.doorId).toBe(84);
    expect(saved.doorName).toBe('');
    expect(saved.numberMismatch).toBe(false); // katalogda olmayan numara denetlenemez
  });

  it('geçersiz numara kabul edilmez', async () => {
    await loadMain();
    document.getElementById('btnSave')!.click();
    (document.getElementById('customDoor') as HTMLInputElement).value = '9999';
    document.getElementById('btnCustomDoor')!.click();
    expect(document.getElementById('confirm')!.classList.contains('hide')).toBe(true);
  });

  it('numara–konum uyuşmazlığı (>300 m): GPS kaydedilir ama numberMismatch=true', async () => {
    // Kapı 100 (kuzeybatı, 21.42539, 39.82413) seçilip güneyde (Gate 1 yakını) kaydediliyor
    mockGeoOK(21.42104, 39.82584);
    await loadMain();
    document.getElementById('btnSave')!.click();
    const btn = Array.from(document.querySelectorAll('#doorList button')).find(
      b => b.firstChild?.textContent === '100'
    ) as HTMLButtonElement;
    btn.click();
    document.getElementById('btnConfirmYes')!.click();
    await new Promise(r => setTimeout(r, 50));
    const saved = JSON.parse(localStorage.getItem('savedGate.v1')!) as SavedGate;
    expect(saved.outsideLat).toBe(21.42104);
    expect(saved.numberMismatch).toBe(true);
    expect(document.getElementById('saved')!.textContent).toContain('uyuşmuyor');
  });

  it('numara–konum uyumluysa (Gate 1 önünde) numberMismatch=false', async () => {
    mockGeoOK(21.42104, 39.82584);
    await loadMain();
    document.getElementById('btnSave')!.click();
    const btn = Array.from(document.querySelectorAll('#doorList button')).find(
      b => b.firstChild?.textContent === '1'
    ) as HTMLButtonElement;
    btn.click();
    document.getElementById('btnConfirmYes')!.click();
    await new Promise(r => setTimeout(r, 50));
    const saved = JSON.parse(localStorage.getItem('savedGate.v1')!) as SavedGate;
    expect(saved.numberMismatch).toBe(false);
  });

  it('ok: yürüyüş sırasında görünür ve hedef yönüne döner (pusulasız: kuzeye göre)', async () => {
    localStorage.setItem('savedGate.v1', JSON.stringify(sample));
    mockGeoOK();
    const w = mockWatch();
    await loadMain();
    document.getElementById('btnGuide')!.click();
    await new Promise(r => setTimeout(r, 50));
    // kullanıcı hedefin ~150 m batısında → hedef doğuda (~90°)
    w.emit({
      coords: { latitude: 21.42355, longitude: 39.8245, accuracy: 10 } as GeolocationCoordinates,
      timestamp: Date.now(),
    } as GeolocationPosition);
    const wrap = document.getElementById('arrowWrap')!;
    expect(wrap.getAttribute('data-state')).toBe('go');
    const deg = parseFloat(
      /rotate\((-?\d+)deg\)/.exec((document.getElementById('arrow') as unknown as HTMLElement).style.transform)![1]!
    );
    expect(deg).toBeGreaterThan(80);
    expect(deg).toBeLessThan(100);
    document.getElementById('btnStop')!.click();
    expect(wrap.getAttribute('data-state')).toBe('idle');
  });

  it('ok: çok uzaktayken gizlenir (far), varınca arrived olur', async () => {
    localStorage.setItem('savedGate.v1', JSON.stringify(sample));
    mockGeoOK();
    const w = mockWatch();
    await loadMain();
    document.getElementById('btnGuide')!.click();
    await new Promise(r => setTimeout(r, 50));
    w.emit({
      coords: { latitude: 21.5, longitude: 39.9, accuracy: 10 } as GeolocationCoordinates,
      timestamp: Date.now(),
    } as GeolocationPosition);
    expect(document.getElementById('arrowWrap')!.getAttribute('data-state')).toBe('far');
    expect(document.getElementById('say')!.textContent).toContain("Kral Abdullah Kapısı'ndan");
    expect(document.getElementById('dist')!.textContent).toMatch(/Uzaklık: \d+ km/);
    w.emit({
      coords: { latitude: sample.outsideLat, longitude: sample.outsideLng, accuracy: 5 } as GeolocationCoordinates,
      timestamp: Date.now(),
    } as GeolocationPosition);
    expect(document.getElementById('arrowWrap')!.getAttribute('data-state')).toBe('arrived');
    document.getElementById('btnStop')!.click();
  });
});

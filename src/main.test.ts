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
};

function setupDOM(): void {
  document.body.innerHTML = `
    <div id="sr"></div>
    <section id="home" class="screen"><div id="saved"></div>
      <button id="btnSave"></button>
      <button id="btnGuide"></button>
      <button id="btnHelp"></button>
    </section>
    <section id="pickDoor" class="screen hide"><div id="doorList"></div></section>
    <section id="confirm" class="screen hide"><div id="confirmText"></div>
      <button id="btnConfirmYes"></button>
      <button id="btnConfirmNo"></button>
    </section>
    <section id="saving" class="screen hide"><div id="fix"></div>
      <button id="btnSaveBack"></button>
    </section>
    <section id="guide" class="screen hide">
      <div id="map"></div><div id="say"></div><div id="dist"></div>
      <button id="btnRepeat"></button><button id="btnStop"></button>
      <a id="gm"></a>
    </section>
    <section id="help" class="screen hide">
      <div id="hTitleAr"></div>
      <div id="hBodyAr"></div>
      <div id="hBodyTr"></div>
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
    expect(document.getElementById('hBodyAr')!.textContent).toContain('الملك عبد الله');
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
});
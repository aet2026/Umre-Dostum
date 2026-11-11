import './style.css';
import type { SavedGate, NavUpdate } from './types';
import { DOORS, findDoor, mainDoors, doorLabel } from './doors';
import { loadGate, saveGate, clearGate } from './storage';
import {
  startCompass,
  requestCompassPermission,
  applyDeclination,
  type CompassHandle,
} from './compass';
import { PositionSmoother } from './guide-smoother';
import { TrailRecorder, distanceM } from './trail';
import { computeNavigation, resolveTarget, formatKm, type NavResult } from './guide';
import {
  initMap,
  drawTrail,
  setCurrent,
  setTarget,
  drawLineToTarget,
  fitToAll,
  invalidateSize,
  showAllDoorsDebug,
} from './map';
import { speak, speakArabic, speakHelp, repeatLast, stopSpeech, initSpeech } from './speech';
import { show } from './ui';
import { initVerifyUI } from './verify-ui';
import { getHelpMessages } from './help-i18n';

// ---------- State ----------
interface PendingDoor {
  id: number;
  name: string;
}
let pendingDoor: PendingDoor | null = null;
let savedGate: SavedGate | null = null;
const recorder = new TrailRecorder();
const smoother = new PositionSmoother();
let guideWatchId: number | null = null;
let hasWarnedTooFar = false;
let hasFittedMap = false;
let wakeLock: WakeLockSentinel | null = null;
let compass: CompassHandle | null = null;
let deviceHeading: number | null = null;
let lastAccuracy: number | null = null;
let lastBearing: number | null = null;
let gpsHeading: number | null = null;
let gpsHeadingAt = 0;
let lastSpeed = 0;
let calibrationWarned = false;
const recentAccuracies: number[] = [];
let gpsUnstableWarned = false;

type ArrowState = 'idle' | 'go' | 'far' | 'arrived';
let arrowState: ArrowState = 'idle';
let arrowRot = 0;
let saveToken = 0;
let guideStarting = false;

const MAX_SAVE_ACCURACY_M = 100;
/** verified kapılarda numara–konum uyuşmazlık eşiği */
const MISMATCH_DISTANCE_M = 300;
/** approximate/unverified kapılarda koordinat hatası daha büyük olabilir */
const MISMATCH_DISTANCE_APPROX_M = 400;
/** Kayıtlı (katalog) kapı için: bu mesafeden uzakta kayıt yapılmaz */
const MAX_SAVE_DISTANCE_M = 2000;

// ---------- Init ----------
initSpeech();
savedGate = loadGate();
renderSavedCard();
bind();

const params = new URLSearchParams(window.location.search);
if (params.has('verify')) initVerifyUI();
if (params.get('debug') === '1') {
  show('guide');
  initMap('map');
  setTimeout(() => {
    invalidateSize();
    showAllDoorsDebug();
  }, 100);
}

// ---------- Helpers ----------
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

// ---------- Saved card ----------
function renderSavedCard(): void {
  const el = document.getElementById('saved');
  if (!el) return;
  if (!savedGate) {
    el.textContent = 'Henüz kapı kaydedilmedi.';
    return;
  }
  const dateStr = new Date(savedGate.savedAt).toLocaleString('tr-TR');
  el.innerHTML =
    `🚪 <b>Kayıtlı Kapı</b><br>` +
    `<b>${escapeHtml(doorLabel(savedGate.doorId, savedGate.doorName))}</b><br>` +
    `<span class="muted">${escapeHtml(dateStr)}</span>` +
    (savedGate.locationSource === 'gps'
      ? ''
      : `<br><span class="warn-text">⚠️ Konum yaklaşık. Kapıyı yeniden kaydedin.</span>`) +
    (savedGate.numberMismatch
      ? `<br><span class="warn-text">⚠️ Kapı numarası bulunduğunuz yerle uyuşmuyor olabilir. Tabeladaki numarayı kontrol edip yeniden kaydedin.</span>`
      : '');
}

// ---------- Door picker ----------
function chooseDoor(door: PendingDoor): void {
  pendingDoor = door;
  const label = doorLabel(door.id, door.name);
  const ct = document.getElementById('confirmText');
  if (ct) {
    ct.innerHTML =
      `<b>${door.id} — ${escapeHtml(label)}</b><br>` +
      `Burayı giriş kapısı olarak kaydetmek istiyor musunuz?`;
  }
  show('confirm');
  speak(`${label} seçildi. Onaylıyor musunuz?`, true);
}

function renderDoorPicker(): void {
  const list = document.getElementById('doorList');
  if (!list) return;
  list.innerHTML = '';

  const main = mainDoors();
  const mainIds = new Set(main.map(d => d.id));
  const others = DOORS.filter(d => !mainIds.has(d.id));

  const addHeader = (text: string) => {
    const h = document.createElement('div');
    h.className = 'door-section-header';
    h.textContent = text;
    list.appendChild(h);
  };

  const addDoor = (d: typeof DOORS[number]) => {
    const b = document.createElement('button');
    b.className = 'btn b';
    const hint = d.hint ? `<small style="opacity:0.8">${escapeHtml(d.hint)}</small>` : '';
    b.innerHTML = `${d.id}<small>${escapeHtml(d.name)}</small>${hint}`;
    b.addEventListener('click', () => chooseDoor({ id: d.id, name: d.name }));
    list.appendChild(b);
  };

  if (main.length > 0) {
    addHeader('⭐ Ana kapılar');
    main.forEach(addDoor);
  }
  if (others.length > 0) {
    addHeader('Diğer kapılar');
    others.forEach(addDoor);
  }
}

function onCustomDoor(): void {
  const input = document.getElementById('customDoor') as HTMLInputElement | null;
  const n = Math.round(Number(input?.value));
  if (!Number.isFinite(n) || n < 1 || n > 300) {
    speak('Lütfen kapının üzerindeki numarayı yazın.', true);
    return;
  }
  const known = findDoor(n);
  chooseDoor({ id: n, name: known?.name ?? '' });
}

// ---------- Bind ----------
function bind(): void {
  document.getElementById('btnSave')?.addEventListener('click', () => {
    renderDoorPicker();
    show('pickDoor');
    speak('Hangi kapıdan girdiniz? Kapının numarasına bakın.', true);
  });

  document.getElementById('btnCustomDoor')?.addEventListener('click', onCustomDoor);
  document.getElementById('btnGuide')?.addEventListener('click', onGuide);
  document.getElementById('btnHelp')?.addEventListener('click', onHelp);
  document.getElementById('btnSpeakAr')?.addEventListener('click', () => {
    const msgs = getHelpMessages(savedGate);
    speakArabic(msgs.speakArabic);
  });

  document.getElementById('btnConfirmNo')?.addEventListener('click', () => {
    show('home');
  });

  document.getElementById('btnConfirmYes')?.addEventListener('click', onSaveConfirm);

  document.getElementById('btnSaveBack')?.addEventListener('click', () => {
    saveToken++;
    recorder.stop();
    show('home');
  });

  document.getElementById('btnStop')?.addEventListener('click', onStopGuide);
  document.getElementById('btnRepeat')?.addEventListener('click', () => repeatLast());
  document.getElementById('btnHelpBack')?.addEventListener('click', () => {
    stopSpeech();
    show('home');
  });
  document.getElementById('btnSaveRetry')?.addEventListener('click', () => {
    void onSaveConfirm();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-action="home"]').forEach(el => {
    el.addEventListener('click', () => show('home'));
  });

  const savedEl = document.getElementById('saved');
  if (savedEl) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const start = (e: Event) => {
      if (!savedGate) return;
      e.preventDefault();
      timer = setTimeout(() => {
        timer = null;
        clearGate();
        savedGate = null;
        renderSavedCard();
        speak('Kapı kaydı silindi.', true);
      }, 3000);
    };
    const cancel = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    savedEl.addEventListener('mousedown', start);
    savedEl.addEventListener('touchstart', start, { passive: false });
    savedEl.addEventListener('mouseup', cancel);
    savedEl.addEventListener('mouseleave', cancel);
    savedEl.addEventListener('touchend', cancel);
    savedEl.addEventListener('touchmove', cancel);
  }

  window.addEventListener('resize', () => invalidateSize());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && guideWatchId !== null) void keepAwake();
  });
  window.addEventListener('pagehide', () => {
    if (guideWatchId !== null || recorder.getPoints().length > 0) {
      recorder.stop();
      onStopGuide();
    }
  });
}

// ---------- Save flow ----------
async function onSaveConfirm(): Promise<void> {
  if (pendingDoor === null) return;
  const door = pendingDoor;
  const catalog = findDoor(door.id);

  const token = ++saveToken;
  const retry = document.getElementById('btnSaveRetry');
  retry?.classList.add('hide');
  show('saving');
  const fix = document.getElementById('fix');
  if (fix) fix.textContent = 'Konum ölçülüyor… (birkaç saniye)';
  speak('Konum ölçülüyor. Lütfen birkaç saniye bekleyin.', true);

  // 1–3 ardışık GPS okuması topla, medyanı al. Tek ölçüm GPS gürültüsüne açıktır;
  // ilk okuma ≤20 m ise erken çıkılır.
  const fixes: Array<{ lat: number; lng: number; accuracy: number }> = [];
  let errCode = 0;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (token !== saveToken) return;
    try {
      const p = await getCurrentPosition(8000);
      if (token !== saveToken) return;
      if (
        Number.isFinite(p.coords.accuracy) &&
        p.coords.accuracy <= MAX_SAVE_ACCURACY_M
      ) {
        fixes.push({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
        });
      }
      if (p.coords.accuracy <= 20) break;
    } catch (e) {
      if (token !== saveToken) return;
      errCode = (e as { code?: number })?.code ?? 0;
      if (errCode === 1) break;
    }
  }
  if (token !== saveToken) return;

  if (fixes.length === 0) {
    const msg =
      errCode === 1
        ? 'Konum izni verilmedi. Tarayıcı ayarlarından konum iznini açın.'
        : 'Konum hassas alınamadı. Açık alana çıkıp tekrar deneyin.';
    if (fix) fix.textContent = msg;
    retry?.classList.remove('hide');
    speak(msg, true);
    return;
  }

  const lat = fixes.length === 1 ? fixes[0]!.lat : median(fixes.map(f => f.lat));
  const lng = fixes.length === 1 ? fixes[0]!.lng : median(fixes.map(f => f.lng));
  const accuracy =
    fixes.length === 1 ? fixes[0]!.accuracy : median(fixes.map(f => f.accuracy));

  if (accuracy > MAX_SAVE_ACCURACY_M) {
    const msg = 'Konum hassas alınamadı. Açık alana çıkıp tekrar deneyin.';
    if (fix) fix.textContent = msg;
    retry?.classList.remove('hide');
    speak(msg, true);
    return;
  }

  // Kayıtlı kapı: Mescid-i Haram'dan 2 km'den uzakta kayıt yapılmaz.
  const gateDistance = catalog
    ? distanceM({ lat, lng }, { lat: catalog.outsideLat, lng: catalog.outsideLng })
    : null;
  if (catalog && gateDistance !== null && gateDistance > MAX_SAVE_DISTANCE_M) {
    const msg =
      `Bulunduğunuz konum ${catalog.name} Kapısı'ndan ${formatKm(gateDistance)} uzakta. ` +
      "Lütfen Mescid-i Haram'a yaklaşınca kaydedin.";
    if (fix) fix.textContent = msg;
    retry?.classList.remove('hide');
    speak(msg, true);
    return;
  }

  // Numara–konum uyuşmazlığı: verified kapılarda 300 m, approximate'da 400 m
  const mismatchThreshold =
    catalog?.verification === 'verified'
      ? MISMATCH_DISTANCE_M
      : MISMATCH_DISTANCE_APPROX_M;
  const mismatch = gateDistance !== null && gateDistance > mismatchThreshold;

  recorder.stop();
  recorder.start();

  savedGate = {
    doorId: door.id,
    doorName: door.name,
    outsideLat: lat,
    outsideLng: lng,
    savedAt: Date.now(),
    trail: [],
    locationSource: 'gps',
    accuracy,
    numberMismatch: mismatch,
  };
  saveGate(savedGate);
  renderSavedCard();
  if (mismatch) {
    speak(
      'Konumunuz kaydedildi, ancak seçtiğiniz kapı numarası bulunduğunuz yerle uyuşmuyor olabilir. Kapının üzerindeki numarayı kontrol edin.',
      true
    );
  } else {
    speak(`${doorLabel(door.id, door.name)} kaydedildi. İyi ziyaretler.`, true);
  }
  show('home');
}

function getCurrentPosition(timeoutMs: number): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no-geo'));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: timeoutMs,
    });
  });
}

// ---------- Guide flow ----------
async function onGuide(): Promise<void> {
  if (guideStarting) return;
  // iOS: pusula izni kullanıcı jesti içinde, İLK await'ten önce istenmeli
  const compassPermission = requestCompassPermission().catch(() => false);

  savedGate = loadGate();
  if (!savedGate) {
    speak('Önce giriş kapınızı kaydedin.', true);
    show('home');
    return;
  }
  guideStarting = true;

  try {
    const trail = recorder.stop();
    if (trail.length > 0) {
      savedGate.trail = trail;
      saveGate(savedGate);
    }

    hasWarnedTooFar = false;
    hasFittedMap = false;
    lastAccuracy = null;
    lastBearing = null;
    gpsHeading = null;
    gpsHeadingAt = 0;
    lastSpeed = 0;
    arrowState = 'idle';
    arrowRot = 0;
    smoother.reset();
    recentAccuracies.length = 0;
    gpsUnstableWarned = false;
    calibrationWarned = false;
    updateArrow();

    show('guide');
    initMap('map');
    setTimeout(() => invalidateSize(), 50);

    // Konum doğrulanmamışsa (eski kayıt) açıkça uyar
    const warn = document.getElementById('warn');
    if (warn) {
      const approx = savedGate.locationSource !== 'gps';
      warn.classList.toggle('hide', !approx);
      warn.textContent = approx
        ? '⚠️ Kayıtlı konum yaklaşık. Kapı numarasını tabeladan kontrol edin.'
        : '';
    }

    await keepAwake();

    // Pusula — kalibrasyon uyarılarını yakala
    compass?.stop();
    compass = null;
    deviceHeading = null;
    if (await compassPermission) {
      compass = startCompass(
        onHeading,
        (reason) => {
          if (
            (reason === 'uncalibrated' || reason === 'calibration-needed') &&
            !calibrationWarned
          ) {
            calibrationWarned = true;
            deviceHeading = null; // GPS yedeğine düş
            const msg =
              'Pusula kalibrasyonu gerekiyor. Telefonu havada 8 şeklinde hareket ettirin.';
            const say = document.getElementById('say');
            if (say) say.textContent = msg;
            speak(msg, true);
          }
          // 'no-heading' ve 'unsupported' sessizce yoksayılır (GPS yedeği devreye girer)
        }
      );
    }

    speak('Konumunuz alınıyor. Lütfen bekleyin.', true);

    try {
      await getCurrentPosition(8000);
    } catch {}

    const target = resolveTarget(savedGate);
    setTarget(target.lat, target.lng, doorLabel(savedGate.doorId, target.name));
    drawTrail(savedGate.trail);

    if (guideWatchId !== null) {
      navigator.geolocation.clearWatch(guideWatchId);
    }
    guideWatchId = navigator.geolocation.watchPosition(
      pos => onGuidePos(pos, target.lat, target.lng),
      err => onGuideErr(err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );

    const gm = document.getElementById('gm') as HTMLAnchorElement | null;
    if (gm) {
      gm.href = `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}&travelmode=walking`;
    }
  } finally {
    guideStarting = false;
  }
}

function onGuidePos(pos: GeolocationPosition, tLat: number, tLng: number): void {
  if (!savedGate) return;
  const raw = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  lastAccuracy = pos.coords.accuracy;

  // GPS sağlık izleme: son 4 okumanın yayılımı >50 m ise uyar
  recentAccuracies.push(pos.coords.accuracy);
  if (recentAccuracies.length > 4) recentAccuracies.shift();
  if (!gpsUnstableWarned && recentAccuracies.length >= 3) {
    const spread =
      Math.max(...recentAccuracies) - Math.min(...recentAccuracies);
    if (spread > 50) {
      gpsUnstableWarned = true;
      const warn = document.getElementById('warn');
      if (warn) {
        const approx = savedGate.locationSource !== 'gps';
        warn.classList.remove('hide');
        warn.textContent = approx
          ? '⚠️ Kayıtlı konum yaklaşık + GPS sinyali kararsız. Açık alana çıkın ve tabelayı kontrol edin.'
          : '⚠️ GPS sinyali kararsız. Açık alana çıkın.';
      }
    }
  }

  // Hız ve GPS yönü (pusula yoksa veya şaşarsa yedek)
  const hd = pos.coords.heading;
  const spd = pos.coords.speed;
  if (typeof spd === 'number' && spd >= 0) lastSpeed = spd;
  if (typeof hd === 'number' && Number.isFinite(hd) && typeof spd === 'number' && spd >= 0.8) {
    gpsHeading = hd;
    gpsHeadingAt = Date.now();
  }

  // Konumu yumuşat
  const cur = smoother.update(raw, pos.coords.accuracy);
  setCurrent(cur.lat, cur.lng);

  const nav: NavResult = computeNavigation(
    savedGate,
    cur,
    effectiveHeading()?.value ?? null,
    lastAccuracy
  );
  drawLineToTarget(
    cur,
    { lat: tLat, lng: tLng },
    nav.isTooFar ? formatKm(nav.distance) : undefined
  );

  if (!hasFittedMap) {
    fitToAll();
    hasFittedMap = true;
  }

  lastBearing = nav.bearingDeg;
  arrowState = nav.arrived ? 'arrived' : nav.isTooFar ? 'far' : 'go';
  updateArrow();
  const say = document.getElementById('say');
  const dist = document.getElementById('dist');

  if (say) say.textContent = nav.instruction;

  if (dist) {
    const weak = lastAccuracy > 100 ? ' (GPS zayıf)' : '';
    if (nav.isTooFar) {
      dist.textContent = `Uzaklık: ${formatKm(nav.distance)}`;
      dist.style.color = 'var(--r)';
    } else {
      dist.textContent =
        (nav.distance < 1000
          ? `${Math.round(nav.distance)} metre`
          : `${(nav.distance / 1000).toFixed(1)} km`) + weak;
      dist.style.color = '';
    }
  }

  if (nav.isTooFar) {
    if (!hasWarnedTooFar) {
      speak(nav.instruction, true);
      hasWarnedTooFar = true;
    }
    return;
  }
  hasWarnedTooFar = false;

  speak(nav.instruction, nav.arrived);

  if (nav.arrived && guideWatchId !== null) {
    navigator.geolocation.clearWatch(guideWatchId);
    guideWatchId = null;
    fitToAll();
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {}
    if (say) say.style.color = 'var(--g)';
    if (dist) {
      dist.textContent = '✅ VARDINIZ';
      dist.style.color = 'var(--g)';
    }
    stopCompass();
    releaseAwake();
  }
}

/**
 * Pusula heading'ini alır:
 *  1) manyetik → gerçek kuzeye çevirir (`applyDeclination`)
 *  2) adaptif üstel yumuşatma (hızlı dönüşte çabuk, yavaşta sakin)
 */
function onHeading(rawH: number): void {
  const h = applyDeclination(rawH);
  if (deviceHeading === null) {
    deviceHeading = h;
  } else {
    const d = ((h - deviceHeading + 540) % 360) - 180;
    const absD = Math.abs(d);
    const alpha = absD > 30 ? 0.6 : absD > 10 ? 0.4 : 0.25;
    deviceHeading = (deviceHeading + alpha * d + 360) % 360;
  }
  updateArrow();
}

/**
 * Etkin yön:
 *  - yalnız pusula → pusula
 *  - yalnız GPS   → GPS
 *  - ikisi de taze → hıza göre ağırlıklı füzyon (yavaşta pusula, hızlıda GPS)
 */
function effectiveHeading(): {
  value: number;
  source: 'compass' | 'gps' | 'fused';
} | null {
  const hasCompass = deviceHeading !== null;
  const gpsFresh = gpsHeading !== null && Date.now() - gpsHeadingAt < 8000;

  if (!hasCompass && !gpsFresh) return null;
  if (hasCompass && !gpsFresh) return { value: deviceHeading!, source: 'compass' };
  if (!hasCompass && gpsFresh) return { value: gpsHeading!, source: 'gps' };

  const speed = lastSpeed ?? 0;
  const wCompass = Math.max(0.2, 1 - speed / 3);
  const diff = ((gpsHeading! - deviceHeading! + 540) % 360) - 180;
  const fused = (deviceHeading! + (1 - wCompass) * diff + 360) % 360;
  return { value: fused, source: 'fused' };
}

function turnWord(rel: number): { text: string; tone: 'ok' | 'turn' | 'back' } {
  const abs = Math.abs(rel);
  if (abs <= 20) return { text: 'DÜZ İLERLEYİN', tone: 'ok' };
  if (abs <= 45) return { text: rel > 0 ? 'HAFİF SAĞA' : 'HAFİF SOLA', tone: 'turn' };
  if (abs <= 135) return { text: rel > 0 ? 'SAĞA DÖNÜN' : 'SOLA DÖNÜN', tone: 'turn' };
  return { text: 'ARKANIZA DÖNÜN', tone: 'back' };
}

function updateArrow(): void {
  const wrap = document.getElementById('arrowWrap');
  const svg = document.getElementById('arrow');
  const word = document.getElementById('arrowWord');
  const note = document.getElementById('arrowNote');
  if (!wrap || !svg) return;

  const heading = effectiveHeading();
  let state: string = arrowState;
  if (arrowState === 'go' && (heading === null || lastBearing === null)) state = 'nohead';
  wrap.setAttribute('data-state', state);

  if (state === 'go' && heading !== null && lastBearing !== null) {
    const rel = ((lastBearing - heading.value + 540) % 360) - 180;
    const delta = ((((rel - arrowRot) % 360) + 540) % 360) - 180;
    arrowRot += delta;
    svg.style.transform = `rotate(${arrowRot.toFixed(0)}deg)`;
    const w = turnWord(rel);
    wrap.setAttribute('data-tone', w.tone);
    if (word) word.textContent = w.text;
    if (note) {
      note.textContent =
        heading.source === 'gps'
          ? '📍 Ok, yürüdüğünüz yöne göre gösterir'
          : '🧭 Ok, telefonun baktığı yöne göre gösterir';
    }
    return;
  }

  svg.style.transform = '';
  if (state === 'nohead') {
    if (word) word.textContent = 'YÖN BULUNUYOR';
    if (note) note.textContent = 'Telefonu yatay tutun veya birkaç adım yürüyün';
  } else if (state === 'arrived') {
    wrap.setAttribute('data-tone', 'ok');
    if (word) word.textContent = 'VARDINIZ';
    if (note) note.textContent = '';
  } else {
    if (word) word.textContent = '';
    if (note) note.textContent = '';
  }
}

function stopCompass(): void {
  compass?.stop();
  compass = null;
  deviceHeading = null;
}

function onGuideErr(err: GeolocationPositionError): void {
  let msg = 'Konum alınamıyor.';
  if (err.code === 1) msg = 'Konum izni verilmedi. Lütfen tarayıcı ayarlarından izin verin.';
  else if (err.code === 2) msg = 'Konum sinyali yok. Açık alana çıkın.';
  else if (err.code === 3) msg = 'Konum zaman aşımı. Açık alana çıkın.';
  const say = document.getElementById('say');
  if (say) say.textContent = msg;
  speak(msg);
}

function onStopGuide(): void {
  if (guideWatchId !== null) {
    navigator.geolocation.clearWatch(guideWatchId);
    guideWatchId = null;
  }
  stopSpeech();
  stopCompass();
  releaseAwake();
  arrowState = 'idle';
  lastBearing = null;
  gpsHeading = null;
  gpsHeadingAt = 0;
  lastSpeed = 0;
  smoother.reset();
  recentAccuracies.length = 0;
  updateArrow();
  hasWarnedTooFar = false;
  hasFittedMap = false;
  show('home');
}

// ---------- Help (Arapça) ----------
function onHelp(): void {
  const msgs = getHelpMessages(savedGate);

  const titleAr = document.getElementById('hTitleAr');
  const bodyAr = document.getElementById('hBodyAr');
  const bodyTr = document.getElementById('hBodyTr');
  const note = document.getElementById('hNote');

  if (titleAr) titleAr.textContent = msgs.arabicTitle;
  if (bodyAr) bodyAr.textContent = msgs.arabicBody;
  if (bodyTr) bodyTr.textContent = msgs.turkishBody;
  const doorBig = document.getElementById('hDoor');
  if (doorBig) {
    doorBig.textContent = savedGate ? `🚪 ${savedGate.doorId}` : '';
    doorBig.classList.toggle('hide', !savedGate);
  }

  show('help');

  const hasArabicVoice = speakHelp(msgs.speakArabic, msgs.speakTurkish);
  if (note) {
    note.classList.toggle('hide', hasArabicVoice);
    note.textContent = hasArabicVoice
      ? ''
      : 'Bu cihazda Arapça ses yok. Lütfen ekrandaki yazıyı görevliye gösterin.';
  }
}

// ---------- Wake Lock ----------
async function keepAwake(): Promise<void> {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await (navigator as Navigator & { wakeLock: WakeLock }).wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    }
  } catch {}
}

function releaseAwake(): void {
  if (wakeLock) {
    try {
      wakeLock.release();
    } catch {}
    wakeLock = null;
  }
}
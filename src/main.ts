import './style.css';
import type { SavedGate, NavUpdate } from './types';
import { DOORS, findDoor, mainDoors, doorLabel } from './doors';
import { loadGate, saveGate, clearGate } from './storage';
import { startCompass, requestCompassPermission, type CompassHandle } from './compass';
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
import { getHelpMessages } from './help-i18n';

// ---------- State ----------
interface PendingDoor {
  id: number;
  name: string; // listede yoksa boş
}
let pendingDoor: PendingDoor | null = null;
let savedGate: SavedGate | null = null;
const recorder = new TrailRecorder();
let guideWatchId: number | null = null;
let hasWarnedTooFar = false;
let hasFittedMap = false;
let wakeLock: WakeLockSentinel | null = null;
let compass: CompassHandle | null = null;
let deviceHeading: number | null = null;
let lastAccuracy: number | null = null;
let lastBearing: number | null = null;
type ArrowState = 'idle' | 'go' | 'far' | 'arrived';
let arrowState: ArrowState = 'idle';
let arrowRot = 0; // birikimli açı: 359°→1° geçişinde ok geri sarmasın
let saveToken = 0;
let guideStarting = false;

const MAX_SAVE_ACCURACY_M = 100;
const MISMATCH_DISTANCE_M = 300;

// ---------- Init ----------
initSpeech();
savedGate = loadGate();
renderSavedCard();
bind();

const params = new URLSearchParams(window.location.search);
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

/** Listede olmayan kapı: kullanıcı tabeladaki numarayı yazar */
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
    saveToken++; // süren kayıt işlemini iptal et
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
    // Ekran kilitlenince wake lock düşer; rehber açıksa geri al
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
  if (fix) fix.textContent = 'Konum aranıyor…';
  speak('Kapı kaydediliyor. Lütfen birkaç saniye bekleyin.', true);

  // Doğrulanmamış katalog koordinatı ASLA kaydedilmez: yalnızca kullanıcının
  // kapının önündeyken ölçülen gerçek GPS konumu. Yoksa kayıt yapılmaz.
  let pos: GeolocationPosition | null = null;
  let errCode = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const p = await getCurrentPosition(10000);
      if (token !== saveToken) return;
      if (!pos || p.coords.accuracy < pos.coords.accuracy) pos = p;
      if (p.coords.accuracy <= 30) break;
    } catch (e) {
      if (token !== saveToken) return;
      errCode = (e as { code?: number })?.code ?? 0;
      if (errCode === 1) break; // izin reddedildi, tekrar denemenin anlamı yok
    }
  }
  if (token !== saveToken) return;

  if (!pos || pos.coords.accuracy > MAX_SAVE_ACCURACY_M) {
    const msg =
      errCode === 1
        ? 'Konum izni verilmedi. Tarayıcı ayarlarından konum iznini açın.'
        : 'Konum hassas alınamadı. Açık alana çıkıp tekrar deneyin.';
    if (fix) fix.textContent = msg;
    retry?.classList.remove('hide');
    speak(msg, true);
    return;
  }

  // Seçilen numara, ölçülen konumla uyuşuyor mu? (katalog yalnızca bu denetim için)
  const mismatch = catalog
    ? distanceM(
        { lat: pos.coords.latitude, lng: pos.coords.longitude },
        { lat: catalog.outsideLat, lng: catalog.outsideLng }
      ) > MISMATCH_DISTANCE_M
    : false;

  recorder.stop();
  recorder.start();

  savedGate = {
    doorId: door.id,
    doorName: door.name,
    outsideLat: pos.coords.latitude,
    outsideLng: pos.coords.longitude,
    savedAt: Date.now(),
    trail: [],
    locationSource: 'gps',
    accuracy: pos.coords.accuracy,
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
    arrowState = 'idle';
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

    // Pusula
    compass?.stop();
    compass = null;
    deviceHeading = null;
    if (await compassPermission) {
      compass = startCompass(
        h => {
          deviceHeading = h;
          updateArrow();
        },
        () => {
          // Pusula olmadan da çalışır
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
  const cur = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  lastAccuracy = pos.coords.accuracy;

  setCurrent(cur.lat, cur.lng);

  const nav: NavResult = computeNavigation(savedGate, cur, deviceHeading, lastAccuracy);
  drawLineToTarget(cur, { lat: tLat, lng: tLng }, nav.isTooFar ? formatKm(nav.distance) : undefined);

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

/** Büyük yön oku: pusula varsa telefona göre, yoksa kuzeye göre döner */
function updateArrow(): void {
  const wrap = document.getElementById('arrowWrap');
  const svg = document.getElementById('arrow');
  const note = document.getElementById('arrowNote');
  if (!wrap || !svg) return;
  wrap.setAttribute('data-state', arrowState);
  if (arrowState !== 'go' || lastBearing === null) {
    svg.style.transform = '';
    if (note) note.textContent = '';
    return;
  }
  let rot = deviceHeading !== null ? lastBearing - deviceHeading : lastBearing;
  const delta = ((((rot - arrowRot) % 360) + 540) % 360) - 180; // en kısa dönüş
  arrowRot += delta;
  svg.style.transform = `rotate(${arrowRot.toFixed(0)}deg)`;
  if (note) {
    note.textContent =
      deviceHeading !== null
        ? 'Ok, telefonun baktığı yöne göre gösterir'
        : 'Pusula yok: ok kuzeye göre gösterir';
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

  show('help');

  // Önce Arapça (görevliye), bittikten sonra Türkçe (kullanıcıya) — tek kuyrukta
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

import './style.css';
import type { SavedGate, NavUpdate } from './types';
import { DOORS, findDoor, popularDoors, doorsNearBus } from './doors';
import { loadGate, saveGate, clearGate } from './storage';
import { startCompass, requestCompassPermission, type CompassHandle } from './compass';
import { TrailRecorder, distanceM } from './trail';
import { computeNavigation, type NavResult } from './guide';
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
import { speak, speakArabic, repeatLast, stopSpeech, initSpeech } from './speech';
import { show } from './ui';
import { getHelpMessages } from './help-i18n';

// ---------- State ----------
let pendingDoorId: number | null = null;
let savedGate: SavedGate | null = null;
const recorder = new TrailRecorder();
let guideWatchId: number | null = null;
let hasWarnedTooFar = false;
let hasFittedMap = false;
let wakeLock: WakeLockSentinel | null = null;
let compass: CompassHandle | null = null;
let deviceHeading: number | null = null;

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
    `<b>${escapeHtml(savedGate.doorName)}</b><br>` +
    `<span class="muted">${escapeHtml(dateStr)}</span>`;
}

// ---------- Door picker ----------

function renderDoorPicker(): void {
  const list = document.getElementById('doorList');
  if (!list) return;
  list.innerHTML = '';

  // Önce popüler + otobüs yakını kapılar
  const featured = popularDoors().filter(d => d.nearBus && d.nearBus !== '—');
  const featuredIds = new Set(featured.map(d => d.id));

  // Kalan popüler kapılar
  const popularRest = popularDoors().filter(d => !featuredIds.has(d.id));

  // Diğerleri
  const others = DOORS.filter(
    d => !featuredIds.has(d.id) && !popularRest.some(p => p.id === d.id)
  );

  const addHeader = (text: string) => {
    const h = document.createElement('div');
    h.className = 'door-section-header';
    h.textContent = text;
    list.appendChild(h);
  };

  const addDoor = (d: typeof DOORS[number]) => {
    const b = document.createElement('button');
    b.className = 'btn b';
    const busInfo = d.nearBus && d.nearBus !== '—'
      ? `<small style="opacity:0.8">🚌 ${escapeHtml(d.nearBus)}</small>`
      : '';
    b.innerHTML = `${d.id}<small>${escapeHtml(d.name)}</small>${busInfo}`;
    b.addEventListener('click', () => {
      pendingDoorId = d.id;
      const ct = document.getElementById('confirmText');
      if (ct) {
        ct.innerHTML =
          `<b>${d.id} — ${escapeHtml(d.name)}</b><br>` +
          `Burayı giriş kapısı olarak kaydetmek istiyor musunuz?`;
      }
      show('confirm');
      speak(`${d.name} Kapısı seçildi. Onaylıyor musunuz?`, true);
    });
    list.appendChild(b);
  };

  if (featured.length > 0) {
    addHeader('🚌 Otobüs duraklarına yakın');
    featured.forEach(addDoor);
  }
  if (popularRest.length > 0) {
    addHeader('⭐ En çok kullanılan');
    popularRest.forEach(addDoor);
  }
  if (others.length > 0) {
    addHeader('Diğer kapılar');
    others.forEach(addDoor);
  }
}
// ---------- Bind ----------
function bind(): void {
  document.getElementById('btnSave')?.addEventListener('click', () => {
    renderDoorPicker();
    show('pickDoor');
    speak('Hangi kapıdan girdiniz? Kapının numarasına bakın.', true);
  });

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
    recorder.stop();
    show('home');
  });

  document.getElementById('btnStop')?.addEventListener('click', onStopGuide);
  document.getElementById('btnRepeat')?.addEventListener('click', () => repeatLast());
  document.getElementById('btnHelpBack')?.addEventListener('click', () => {
    stopSpeech();
    show('home');
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
  window.addEventListener('pagehide', () => {
    if (guideWatchId !== null || recorder.getPoints().length > 0) {
      recorder.stop();
      onStopGuide();
    }
  });
}

// ---------- Save flow ----------
async function onSaveConfirm(): Promise<void> {
  if (pendingDoorId === null) return;
  const door = findDoor(pendingDoorId);
  if (!door) return;

  show('saving');
  const fix = document.getElementById('fix');
  if (fix) fix.textContent = 'Konum aranıyor…';
  speak('Kapı kaydediliyor. Lütfen birkaç saniye bekleyin.', true);

  let lat = door.outsideLat;
  let lng = door.outsideLng;
  try {
    const pos = await getCurrentPosition(8000);
    const d = distanceM(
      { lat: pos.coords.latitude, lng: pos.coords.longitude },
      { lat: door.outsideLat, lng: door.outsideLng }
    );
    if (d < 200) {
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    }
  } catch {}

  recorder.stop();
  recorder.start();

  savedGate = {
    doorId: door.id,
    doorName: door.name,
    outsideLat: lat,
    outsideLng: lng,
    savedAt: Date.now(),
    trail: [],
  };
  saveGate(savedGate);
  renderSavedCard();
  speak(`${door.name} Kapısı kaydedildi. İyi ziyaretler.`, true);
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
  savedGate = loadGate();
  if (!savedGate) {
    speak('Önce giriş kapınızı kaydedin.', true);
    show('home');
    return;
  }

  const trail = recorder.stop();
  if (trail.length > 0) {
    savedGate.trail = trail;
    saveGate(savedGate);
  }

  hasWarnedTooFar = false;
  hasFittedMap = false;

  show('guide');
  initMap('map');
  setTimeout(() => invalidateSize(), 50);

  await keepAwake();

// Pusula izni ve başlatma
deviceHeading = null;
try {
  const granted = await requestCompassPermission();
  if (granted) {
    compass = startCompass(
      h => {
        deviceHeading = h;
      },
      reason => {
        if (reason === 'unsupported') {
          // Sessizce geç — pusula olmadan da çalışır
        }
      }
    );
  }
} catch {
  // Pusula başarısız → eski davranış
}

  speak('Konumunuz alınıyor. Lütfen bekleyin.', true);

  try {
    await getCurrentPosition(8000);
  } catch {}

  const target = findDoor(savedGate.doorId);
  const tLat = target?.outsideLat ?? savedGate.outsideLat;
  const tLng = target?.outsideLng ?? savedGate.outsideLng;
  setTarget(tLat, tLng, `${target?.name ?? savedGate.doorName} Kapısı`);
  drawTrail(savedGate.trail);

  if (guideWatchId !== null) {
    navigator.geolocation.clearWatch(guideWatchId);
  }
  guideWatchId = navigator.geolocation.watchPosition(
    pos => onGuidePos(pos, tLat, tLng),
    err => onGuideErr(err),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
  );

  const gm = document.getElementById('gm') as HTMLAnchorElement | null;
  if (gm) {
    gm.href = `https://www.google.com/maps/dir/?api=1&destination=${tLat},${tLng}&travelmode=walking`;
  }
}

function onGuidePos(pos: GeolocationPosition, tLat: number, tLng: number): void {
  if (!savedGate) return;
  const cur = { lat: pos.coords.latitude, lng: pos.coords.longitude };

  setCurrent(cur.lat, cur.lng);
  drawLineToTarget(cur, { lat: tLat, lng: tLng });

  if (!hasFittedMap) {
    fitToAll();
    hasFittedMap = true;
  }

 
  const nav: NavResult = computeNavigation(savedGate, cur, deviceHeading);
  const say = document.getElementById('say');
  const dist = document.getElementById('dist');

  if (say) say.textContent = nav.instruction;

  if (dist) {
    if (nav.isTooFar) {
      dist.textContent = `Uzaklık: ${Math.round(nav.distance / 1000)} km`;
      dist.style.color = 'var(--r)';
    } else {
      dist.textContent =
        nav.distance < 1000
          ? `${Math.round(nav.distance)} metre`
          : `${(nav.distance / 1000).toFixed(1)} km`;
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
    if (compass) {
  compass.stop();
  compass = null;
}
deviceHeading = null;
    releaseAwake();
 }
}
function onGuideErr(err: GeolocationPositionError): void {
  let msg = 'Konum alınamıyor.';
  if (err.code === 1) msg = 'Konum izni verilmedi. Lütfen tarayıcı ayarlarından izin verin.';
  else if (err.code === 2) msg = 'Konum sinyali yok. Açık alana çıkın.';
  else if (err.code === 3) msg = 'Konum zaman aşımı. Açık alana çıkın.';
  const say = document.getElementById('say');
  if (say) say.textContent = msg;
  speak(msg, true);
}

function onStopGuide(): void {
  if (guideWatchId !== null) {
    navigator.geolocation.clearWatch(guideWatchId);
    guideWatchId = null;
  }
  stopSpeech();
  releaseAwake();
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

  if (titleAr) titleAr.textContent = msgs.arabicTitle;
  if (bodyAr) bodyAr.textContent = msgs.arabicBody;
  if (bodyTr) bodyTr.textContent = msgs.turkishBody;

  show('help');

  // Görevliye Arapça hitap et, sonra Türkçe kullanıcıya bilgi ver
  speakArabic(msgs.speakArabic);
  setTimeout(() => {
    speak('Bu ekranı görevliye gösterin.', true);
  }, 2000);
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

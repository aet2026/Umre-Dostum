import './style.css';
import type { SavedGate, NavUpdate } from './types';
import { DOORS, findDoor } from './doors';
import { loadGate, saveGate, clearGate } from './storage';
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
import { speak, repeatLast, stopSpeech, initSpeech } from './speech';
import { show } from './ui';

// ---------- State ----------
let pendingDoorId: number | null = null;
let savedGate: SavedGate | null = null;
const recorder = new TrailRecorder();
let guideWatchId: number | null = null;

// "Harem dışındasınız" uyarısının tekrar tekrar okunmasını engeller
let hasWarnedTooFar = false;
// Harita sadece ilk konumda sığdırılsın
let hasFittedMap = false;
// Wake Lock referansı
let wakeLock: WakeLockSentinel | null = null;

// ---------- Init ----------
initSpeech();
savedGate = loadGate();
renderSavedCard();
bind();

// Debug modu: ?debug=1
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
  const mains = DOORS.filter(d => d.isMain);
  for (const d of mains) {
    const b = document.createElement('button');
    b.className = 'btn b';
    b.innerHTML = `${d.id}<small>${escapeHtml(d.name)}</small>`;
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
  document.getElementById('btnHelpBack')?.addEventListener('click', () => show('home'));

  document.querySelectorAll<HTMLButtonElement>('[data-action="home"]').forEach(el => {
    el.addEventListener('click', () => show('home'));
  });

  // Uzun basarak silme (saved card) — 3 saniye
  const savedEl = document.getElementById('saved');
  if (savedEl) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const start = (e: Event) => {
      if (!savedGate) return;
      e.preventDefault();
      timer = setTimeout(() => {
        timer = null;
        // confirm() yerine doğrudan sil + sesli bildirim
        // (yaşlı kullanıcı için ekstra onay penceresi kafa karıştırıcı)
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
    // Kullanıcı seçtiği kapıya 200m'den yakınsa gerçek GPS'i kullan
    if (d < 200) {
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    }
  } catch {
    // GPS yok — kapının referans koordinatını kullan
  }

  recorder.stop(); // eski kayıttan kalan watch varsa temizle
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

  // Önceki trail'i kaydet
  const trail = recorder.stop();
  if (trail.length > 0) {
    savedGate.trail = trail;
    saveGate(savedGate);
  }

  // Rehber başında "harem dışı" uyarısını sıfırla
  hasWarnedTooFar = false;
  hasFittedMap = false;

  show('guide');
  initMap('map');
  setTimeout(() => invalidateSize(), 50);

  // Ekranı açık tut
  await keepAwake();

  speak('Konumunuz alınıyor. Lütfen bekleyin.', true);

  // Konum iznini önceden tetikle (watchPosition bazı tarayıcılarda izin istemez)
  try {
    await getCurrentPosition(8000);
  } catch {
    // İzin reddedildiyse watchPosition zaten onGuideErr'e düşecek
  }

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

  // Sadece ilk konumda haritayı sığdır (kullanıcı sonra kaydırabilsin)
  if (!hasFittedMap) {
    fitToAll();
    hasFittedMap = true;
  }

  const nav: NavResult = computeNavigation(savedGate, cur);

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

  // --- Harem dışı uyarısı: sadece bir kez oku, harem'e dönünce sıfırla ---
  if (nav.isTooFar) {
    if (!hasWarnedTooFar) {
      speak(nav.instruction, true);
      hasWarnedTooFar = true;
    }
    return;
  }
  hasWarnedTooFar = false;

  // --- Normal yönlendirme ---
  speak(nav.instruction, nav.arrived);

  if (nav.arrived && guideWatchId !== null) {
    navigator.geolocation.clearWatch(guideWatchId);
    guideWatchId = null;
    // Varış: haritayı son kez sığdır + titreşim + yeşil ekran
    fitToAll();
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {}
    // Varış görsel geri bildirimi
    if (say) say.style.color = 'var(--g)';
    if (dist) {
      dist.textContent = '✅ VARDINIZ';
      dist.style.color = 'var(--g)';
    }
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

// ---------- Help ----------
function onHelp(): void {
  const info = document.getElementById('hinfo');
  if (info) {
    info.innerHTML = savedGate
      ? `Giriş kapısı kayıtlı:<br><b>${escapeHtml(savedGate.doorName)}</b>`
      : 'Kapı kaydı yok';
  }
  show('help');
  speak('Sakin olun. Bu ekranı bir görevliye gösterin.', true);
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
  } catch {
    // Wake Lock desteklenmiyorsa sessizce geç
  }
}

function releaseAwake(): void {
  if (wakeLock) {
    try {
      wakeLock.release();
    } catch {}
    wakeLock = null;
  }
}
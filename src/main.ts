import './style.css';
import type { SavedGate } from './types';
import { DOORS, findDoor } from './doors';
import { loadGate, saveGate, clearGate } from './storage';
import { TrailRecorder, distanceM } from './trail';
import { computeNavigation } from './guide';
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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
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

  // Uzun basarak silme (saved card)
  const savedEl = document.getElementById('saved');
  if (savedEl) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const start = (e: Event) => {
      if (!savedGate) return;
      e.preventDefault();
      timer = setTimeout(() => {
        timer = null;
        if (confirm('Kayıtlı kapıyı silmek istiyor musunuz?')) {
          clearGate();
          savedGate = null;
          renderSavedCard();
          speak('Kapı kaydı silindi.', true);
        }
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
    recorder.stop();
    onStopGuide();
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
  } catch {
    // GPS yok — kapı koordinatını kullan
  }

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

  show('guide');
  initMap('map');
  setTimeout(() => invalidateSize(), 50);

  speak('Konumunuz alınıyor. Lütfen bekleyin.', true);

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
  fitToAll();

  const nav = computeNavigation(savedGate, cur);
  const say = document.getElementById('say');
  const dist = document.getElementById('dist');
  if (say) say.textContent = nav.instruction;
  if (dist) dist.textContent = `${Math.round(nav.distance)} metre`;

  speak(nav.instruction, nav.arrived);

  if (nav.arrived && guideWatchId !== null) {
    navigator.geolocation.clearWatch(guideWatchId);
    guideWatchId = null;
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {}
  }
}

function onGuideErr(err: GeolocationPositionError): void {
  let msg = 'Konum alınamıyor.';
  if (err.code === 1) msg = 'Konum izni verilmedi. Lütfen izin verin.';
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
import { DOORS, findDoor } from './doors';
import { distanceM } from './trail';
import { show } from './ui';
import { speak } from './speech';
import {
  summarizeFixes,
  assess,
  saveMeasurement,
  loadMeasurements,
  clearMeasurements,
  exportMeasurements,
  MAX_FIX_ACCURACY_M,
  type Fix,
  type Measurement,
  type Summary,
} from './verify';

const MEASURE_SECONDS = 30;

let watchId: number | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;
let fixes: Fix[] = [];
let lastSummary: Summary | null = null;
let lastDoorId: number | null = null;

const $ = (id: string) => document.getElementById(id);

function text(id: string, value: string): void {
  const el = $(id);
  if (el) el.textContent = value;
}

function selectedDoorId(): number | null {
  const custom = Number(($('vCustom') as HTMLInputElement | null)?.value);
  if (Number.isFinite(custom) && custom >= 1 && custom <= 300) return Math.round(custom);
  const sel = $('vDoor') as HTMLSelectElement | null;
  const n = Number(sel?.value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function renderList(): void {
  const list = loadMeasurements();
  const el = $('vList');
  if (!el) return;
  el.textContent = list.length
    ? list
        .map(
          m =>
            `Kapı ${m.doorId}: ${m.lat.toFixed(6)}, ${m.lng.toFixed(6)} ` +
            `(±${Math.round(m.accuracy)} m, ${m.samples} örnek` +
            (m.catalogDiffM !== undefined ? `, katalogdan ${Math.round(m.catalogDiffM)} m` : '') +
            ')'
        )
        .join('\n')
    : 'Henüz kayıtlı ölçüm yok.';
  (el as HTMLElement).style.whiteSpace = 'pre-line';
}

function stopMeasuring(): void {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  if (timer) clearTimeout(timer);
  if (ticker) clearInterval(ticker);
  timer = null;
  ticker = null;
}

function finish(): void {
  stopMeasuring();
  const doorId = lastDoorId;
  const s = summarizeFixes(fixes);
  const startBtn = $('btnVStart');
  if (startBtn) startBtn.textContent = '▶ ÖLÇÜMÜ BAŞLAT (30 sn)';
  if (!s || doorId === null) {
    lastSummary = null;
    $('btnVSave')?.classList.add('hide');
    text(
      'vStatus',
      `Yeterli hassas ölçüm alınamadı (${fixes.length} okuma, en az 8 tanesi ≤ ${MAX_FIX_ACCURACY_M} m olmalı). ` +
        'Açık alana çıkıp tekrar deneyin.'
    );
    return;
  }
  lastSummary = s;
  const door = findDoor(doorId);
  const diff = door
    ? distanceM({ lat: s.lat, lng: s.lng }, { lat: door.outsideLat, lng: door.outsideLng })
    : undefined;
  const verdict = assess(diff, s.spreadM);
  const verdictText =
    verdict === 'bad'
      ? '❌ Ölçüm kendi içinde tutarsız (yayılım yüksek). Yerinizde durup tekrar ölçün.'
      : verdict === 'check'
      ? `⚠️ Katalogdaki konumdan ${Math.round(diff!)} m farklı. Ölçümü kaydedin; birkaç ölçümle teyit edilecek.`
      : diff === undefined
      ? '✅ Ölçüm tutarlı (katalogda karşılaştırılacak kapı yok).'
      : `✅ Katalogla uyumlu (${Math.round(diff)} m fark).`;
  text(
    'vStatus',
    `Ölçülen: ${s.lat.toFixed(7)}, ${s.lng.toFixed(7)}\n` +
      `Hassasiyet ±${Math.round(s.accuracy)} m · ${s.samples} örnek · yayılım ${Math.round(s.spreadM)} m\n` +
      verdictText
  );
  $('btnVSave')?.classList.toggle('hide', verdict === 'bad');
  try {
    navigator.vibrate?.([150, 80, 150]);
  } catch {}
  speak('Ölçüm tamamlandı.', true);
}

function startMeasuring(): void {
  const doorId = selectedDoorId();
  if (doorId === null) {
    text('vStatus', 'Önce bir kapı seçin veya numarasını yazın.');
    return;
  }
  stopMeasuring();
  fixes = [];
  lastSummary = null;
  lastDoorId = doorId;
  $('btnVSave')?.classList.add('hide');
  const startBtn = $('btnVStart');
  if (startBtn) startBtn.textContent = '⏹ ÖLÇÜMÜ BİTİR';

  const t0 = Date.now();
  text('vStatus', 'Konum aranıyor… Kapının tam önünde sabit durun.');

  watchId = navigator.geolocation.watchPosition(
    pos => {
      fixes.push({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        t: Date.now(),
      });
    },
    err => text('vStatus', `Konum hatası (${err.code}). Konum iznini ve GPS'i kontrol edin.`),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
  );

  ticker = setInterval(() => {
    const left = Math.max(0, MEASURE_SECONDS - Math.round((Date.now() - t0) / 1000));
    const good = fixes.filter(f => f.accuracy <= MAX_FIX_ACCURACY_M).length;
    text('vStatus', `Ölçülüyor… ${left} sn · ${fixes.length} okuma · ${good} hassas`);
  }, 1000);
  timer = setTimeout(finish, MEASURE_SECONDS * 1000);
}

function saveCurrent(): void {
  if (!lastSummary || lastDoorId === null) return;
  const door = findDoor(lastDoorId);
  const m: Measurement = {
    ...lastSummary,
    doorId: lastDoorId,
    measuredAt: Date.now(),
    catalogDiffM: door
      ? distanceM(
          { lat: lastSummary.lat, lng: lastSummary.lng },
          { lat: door.outsideLat, lng: door.outsideLng }
        )
      : undefined,
  };
  saveMeasurement(m);
  $('btnVSave')?.classList.add('hide');
  text('vStatus', `Kaydedildi: kapı ${m.doorId}. Başka kapıya geçebilirsiniz.`);
  renderList();
}

async function copyAll(): Promise<void> {
  const json = exportMeasurements(loadMeasurements());
  try {
    await navigator.clipboard.writeText(json);
    text('vStatus', 'Kopyalandı. Geliştiriciye gönderin (WhatsApp/e-posta).');
  } catch {
    window.prompt('Kopyalayın:', json);
  }
}

/** ?verify=1 ile açılan gizli saha doğrulama aracı */
export function initVerifyUI(): void {
  const sel = $('vDoor') as HTMLSelectElement | null;
  if (sel && sel.options.length === 0) {
    for (const d of DOORS) {
      const o = document.createElement('option');
      o.value = String(d.id);
      o.textContent = `${d.id} — ${d.name}`;
      sel.appendChild(o);
    }
  }
  const open = $('btnVerify');
  open?.classList.remove('hide');
  open?.addEventListener('click', () => {
    renderList();
    show('verify');
  });
  $('btnVStart')?.addEventListener('click', () => {
    if (watchId !== null) finish();
    else startMeasuring();
  });
  $('btnVSave')?.addEventListener('click', saveCurrent);
  $('btnVCopy')?.addEventListener('click', () => void copyAll());
  $('btnVClear')?.addEventListener('click', () => {
    if (window.confirm('Tüm kayıtlı ölçümler silinsin mi?')) {
      clearMeasurements();
      renderList();
    }
  });
  $('btnVBack')?.addEventListener('click', () => {
    stopMeasuring();
    show('home');
  });
}

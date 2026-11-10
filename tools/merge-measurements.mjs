#!/usr/bin/env node
// Kullanım: node tools/merge-measurements.mjs olcum1.json olcum2.json ...
// Uygulamadan "TÜMÜNÜ KOPYALA" ile alınan JSON dosyalarını birleştirir; her kapı için
// MEDYAN konumu hesaplar ve doors.ts'e yapıştırılacak değerleri yazdırır.
import { readFileSync } from 'node:fs';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Kullanım: node tools/merge-measurements.mjs olcum1.json [olcum2.json ...]');
  process.exit(1);
}

const median = a => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const dist = (a, b) => {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

const byDoor = new Map();
for (const f of files) {
  for (const m of JSON.parse(readFileSync(f, 'utf8'))) {
    if (m.spreadM > 25) continue; // tutarsız ölçümleri at
    if (!byDoor.has(m.doorId)) byDoor.set(m.doorId, []);
    byDoor.get(m.doorId).push(m);
  }
}

for (const [id, list] of [...byDoor].sort((a, b) => a[0] - b[0])) {
  const lat = median(list.map(m => m.lat));
  const lng = median(list.map(m => m.lng));
  const worst = Math.max(...list.map(m => dist({ lat, lng }, m)));
  const verdict =
    list.length >= 3 && worst <= 25 ? "verification: 'verified'" :
    list.length >= 2 && worst <= 40 ? "verification: 'approximate'  // daha fazla ölçüm önerilir" :
    "verification: 'unverified'  // ölçümler tutarsız veya yetersiz";
  console.log(`// Kapı ${id}: ${list.length} ölçüm, en uzak sapma ${worst.toFixed(0)} m`);
  console.log(`outsideLat: ${lat.toFixed(7)}, outsideLng: ${lng.toFixed(7)}, ${verdict}`);
}

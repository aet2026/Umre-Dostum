import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TrailPoint } from './types';

let mapInstance: L.Map | null = null;
let trailLayer: L.LayerGroup | null = null;
let currentMarker: L.CircleMarker | null = null;
let targetMarker: L.CircleMarker | null = null;
let lineToTarget: L.Polyline | null = null;

export function initMap(containerId: string): L.Map {
  if (mapInstance) return mapInstance;
  mapInstance = L.map(containerId, {
    center: [21.4225, 39.8261],
    zoom: 17,
    zoomControl: false,
    attributionControl: true,
  });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  }).addTo(mapInstance);
  trailLayer = L.layerGroup().addTo(mapInstance);
  return mapInstance;
}

export function drawTrail(trail: TrailPoint[]): void {
  if (!mapInstance || !trailLayer) return;
  trailLayer.clearLayers();
  if (trail.length < 2) return;
  const latlngs: L.LatLngExpression[] = trail.map(p => [p.lat, p.lng]);
  L.polyline(latlngs, {
    color: '#1257b5',
    weight: 4,
    opacity: 0.7,
    dashArray: '8,6',
  }).addTo(trailLayer);
  const first = trail[0];
  if (first) {
    L.circleMarker([first.lat, first.lng], {
      radius: 8, color: '#0a7a3d', fillColor: '#0a7a3d', fillOpacity: 0.9,
    }).addTo(trailLayer).bindPopup('Giriş Kapısı');
  }
}

export function setTarget(lat: number, lng: number, label: string): void {
  if (!mapInstance) return;
  if (targetMarker) mapInstance.removeLayer(targetMarker);
  targetMarker = L.circleMarker([lat, lng], {
    radius: 12, color: '#b3261e', fillColor: '#b3261e', fillOpacity: 0.9,
  }).addTo(mapInstance).bindPopup(label);
}

export function setCurrent(lat: number, lng: number): void {
  if (!mapInstance) return;
  if (currentMarker) mapInstance.removeLayer(currentMarker);
  currentMarker = L.circleMarker([lat, lng], {
    radius: 10, color: '#1257b5', fillColor: '#1257b5', fillOpacity: 0.9,
  }).addTo(mapInstance).bindPopup('Şu an buradasınız');
  currentMarker.bringToFront();
}

export function drawLineToTarget(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): void {
  if (!mapInstance) return;
  if (lineToTarget) mapInstance.removeLayer(lineToTarget);
  lineToTarget = L.polyline(
    [[from.lat, from.lng], [to.lat, to.lng]],
    { color: '#0a7a3d', weight: 4, dashArray: '10,8' }
  ).addTo(mapInstance);
}

export function fitToAll(): void {
  if (!mapInstance) return;
  const b = L.latLngBounds([]);
  if (currentMarker) b.extend(currentMarker.getLatLng());
  if (targetMarker) b.extend(targetMarker.getLatLng());
  if (b.isValid()) mapInstance.fitBounds(b.pad(0.3));
}

export function invalidateSize(): void {
  mapInstance?.invalidateSize();
}
// src/map.ts — debug modu ekle
export function showAllDoorsDebug(): void {
  if (!mapInstance) return;
  // DOORS listesini import et
  import('./doors').then(({ DOORS }) => {
    for (const door of DOORS) {
      const color = door.verification === 'verified' ? '#0a7a3d'
                  : door.verification === 'approximate' ? '#ffb300'
                  : '#b3261e';
      L.circleMarker([door.outsideLat, door.outsideLng], {
        radius: 10,
        color,
        fillColor: color,
        fillOpacity: 0.7,
      })
        .addTo(mapInstance!)
        .bindPopup(
          `<b>${door.id} — ${door.name}</b><br>` +
          `Durum: ${door.verification}<br>` +
          `Koordinat: ${door.outsideLat}, ${door.outsideLng}<br>` +
          (door.source ? `Kaynak: ${door.source}` : '')
        );
    }
  });
}
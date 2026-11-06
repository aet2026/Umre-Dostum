import type { TrailPoint } from './types';

const MIN_ACCURACY = 60;
const MIN_DISTANCE_M = 5;
const MAX_POINTS = 200;

export class TrailRecorder {
  private points: TrailPoint[] = [];
  private watchId: number | null = null;

  start(): void {
    if (!navigator.geolocation || this.watchId !== null) return;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.onPos(pos),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }

  private onPos(pos: GeolocationPosition): void {
    const p: TrailPoint = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp,
    };
    if (p.accuracy > MIN_ACCURACY) return;
    const last = this.points[this.points.length - 1];
    if (last && distanceM(last, p) < MIN_DISTANCE_M) return;
    this.points.push(p);
    if (this.points.length > MAX_POINTS) this.points.shift();
  }

  stop(): TrailPoint[] {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    return this.points.slice();
  }

  getPoints(): TrailPoint[] {
    return this.points.slice();
  }
}

export function distanceM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) *
    Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function bearingDeg(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const dLng = (to.lng - from.lng) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(to.lat * Math.PI / 180);
  const x =
    Math.cos(from.lat * Math.PI / 180) * Math.sin(to.lat * Math.PI / 180) -
    Math.sin(from.lat * Math.PI / 180) *
    Math.cos(to.lat * Math.PI / 180) *
    Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
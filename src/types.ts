export type VerificationStatus = 'verified' | 'approximate' | 'unverified';

export interface DoorInfo {
  id: number;
  name: string;
  area: 'kuzey' | 'güney' | 'doğu' | 'batı';
  outsideLat: number;
  outsideLng: number;
  isMain: boolean;
  verification: VerificationStatus;
  source?: string;
}

export interface TrailPoint {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export interface SavedGate {
  doorId: number;
  doorName: string;
  outsideLat: number;
  outsideLng: number;
  savedAt: number;
  trail: TrailPoint[];
}

export interface NavUpdate {
  distance: number;
  instruction: string;
  arrived: boolean;
  bearingDeg: number;
}
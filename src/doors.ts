// src/doors.ts
import type { DoorInfo } from './types';

export type VerificationStatus = 'verified' | 'approximate' | 'unverified';

export interface DoorInfo {
  id: number;
  name: string;
  area: 'kuzey' | 'güney' | 'doğu' | 'batı';
  outsideLat: number;
  outsideLng: number;
  isMain: boolean;
  verification: VerificationStatus;
  source?: string;  // koordinat kaynağı
}

export const DOORS: DoorInfo[] = [
  {
    id: 1,
    name: 'Kral Abdülaziz',
    area: 'batı',
    outsideLat: 21.42053,
    outsideLng: 39.82613,
    isMain: true,
    verification: 'approximate',
    source: 'OSM building centroid + manual offset',
  },
  {
    id: 79,
    name: 'Kral Fahd',
    area: 'batı',
    outsideLat: 21.42230,
    outsideLng: 39.82480,
    isMain: true,
    verification: 'approximate',
  },
  {
    id: 100,
    name: 'Kral Abdullah',
    area: 'kuzey',
    outsideLat: 21.42355,
    outsideLng: 39.82590,
    isMain: true,
    verification: 'approximate',
  },
  {
    id: 62,
    name: 'Umre',
    area: 'kuzey',
    outsideLat: 21.42355,
    outsideLng: 39.82660,
    isMain: true,
    verification: 'approximate',
  },
  {
    id: 45,
    name: 'Fetih',
    area: 'kuzey',
    outsideLat: 21.42402,   // OSM doğrulanmış [citation:6]
    outsideLng: 39.82652,
    isMain: true,
    verification: 'verified',
    source: 'OpenStreetMap node 4318154227',
  },
  {
    id: 13,
    name: 'Safa',
    area: 'doğu',
    outsideLat: 21.42220,
    outsideLng: 39.82760,
    isMain: false,
    verification: 'approximate',
  },
  {
    id: 19,
    name: 'Selam (bodrum)',
    area: 'batı',
    outsideLat: 21.42160,
    outsideLng: 39.82460,
    isMain: false,
    verification: 'approximate',
  },
];

export function findDoor(id: number): DoorInfo | undefined {
  return DOORS.find(d => d.id === id);
}

export function mainDoors(): DoorInfo[] {
  return DOORS.filter(d => d.isMain);
}

export function unverifiedDoors(): DoorInfo[] {
  return DOORS.filter(d => d.verification !== 'verified');
}
import type { DoorInfo } from './types';

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
    nearBus: 'SAPTCO VIP / Ajyad',
    popularity: 'high',
  },
  {
    id: 79,
    name: 'Kral Fahd',
    area: 'batı',
    outsideLat: 21.42230,
    outsideLng: 39.82480,
    isMain: true,
    verification: 'approximate',
    nearBus: 'Jabal Omar',
    popularity: 'high',
  },
  {
    id: 100,
    name: 'Kral Abdullah',
    area: 'kuzey',
    outsideLat: 21.42355,
    outsideLng: 39.82590,
    isMain: true,
    verification: 'approximate',
    nearBus: 'Kuzey genişleme',
    popularity: 'high',
  },
  {
    id: 62,
    name: 'Umre',
    area: 'kuzey',
    outsideLat: 21.42355,
    outsideLng: 39.82660,
    isMain: true,
    verification: 'approximate',
    nearBus: 'Jabal Kaaba / Tan\'im yolu',
    popularity: 'high',
  },
  {
    id: 45,
    name: 'Fetih',
    area: 'kuzey',
    outsideLat: 21.42402,
    outsideLng: 39.82652,
    isMain: true,
    verification: 'verified',
    source: 'OpenStreetMap node 4318154227',
    nearBus: 'Şib Amir',
    popularity: 'high',
  },
  {
    id: 2,
    name: 'Ajyad',
    area: 'batı',
    outsideLat: 21.42000,
    outsideLng: 39.82700,
    isMain: false,
    verification: 'approximate',
    nearBus: 'Ajyad Caddesi',
    popularity: 'medium',
  },
  {
    id: 13,
    name: 'Safa',
    area: 'doğu',
    outsideLat: 21.42220,
    outsideLng: 39.82760,
    isMain: false,
    verification: 'approximate',
    nearBus: 'Gazza / Safa-Merve',
    popularity: 'high',
  },
  {
    id: 19,
    name: 'Selam (bodrum)',
    area: 'batı',
    outsideLat: 21.42160,
    outsideLng: 39.82460,
    isMain: false,
    verification: 'approximate',
    nearBus: '—',
    popularity: 'medium',
  },
  {
    id: 37,
    name: 'Merve',
    area: 'doğu',
    outsideLat: 21.42280,
    outsideLng: 39.82780,
    isMain: false,
    verification: 'approximate',
    nearBus: 'Gazza / Safa-Merve',
    popularity: 'high',
  },
  {
    id: 60,
    name: 'Hudaibiya',
    area: 'batı',
    outsideLat: 21.41850,
    outsideLng: 39.82400,
    isMain: false,
    verification: 'approximate',
    nearBus: 'Hudaibiya otobüs durağı',
    popularity: 'medium',
  },
  {
    id: 86,
    name: 'Fetih (Şib Amir)',
    area: 'kuzey',
    outsideLat: 21.42450,
    outsideLng: 39.82700,
    isMain: false,
    verification: 'approximate',
    nearBus: 'Şib Amir',
    popularity: 'medium',
  },
  {
    id: 90,
    name: 'Medine',
    area: 'kuzey',
    outsideLat: 21.42500,
    outsideLng: 39.82600,
    isMain: false,
    verification: 'approximate',
    nearBus: 'Kuzey terminal',
    popularity: 'medium',
  },
];

export function findDoor(id: number): DoorInfo | undefined {
  return DOORS.find(d => d.id === id);
}

export function mainDoors(): DoorInfo[] {
  return DOORS.filter(d => d.isMain);
}

export function popularDoors(): DoorInfo[] {
  return DOORS.filter(d => d.popularity === 'high');
}

export function doorsNearBus(): DoorInfo[] {
  return DOORS.filter(d => d.nearBus && d.nearBus !== '—');
}

export function unverifiedDoors(): DoorInfo[] {
  return DOORS.filter(d => d.verification !== 'verified');
}
import type { DoorInfo } from './types';

/**
 * KAPI KATALOĞU — kapı numaraları Suudi Basın Ajansı'nın (SPA) 2025 resmî numaralarıdır;
 * koordinatlar OpenStreetMap kapı noktalarıdır (kapının kendi konumu, caminin duvarında).
 * Kaynak sayfaları: hajjmap.com (SPA + OSM'e atıf) ve maps.umrahcore.com (OSM).
 *
 * Doğrulanamayan kapılar (eski listedeki 2, 37, 60, 86, 90) BİLEREK çıkarıldı:
 * numaraları kaynaklara göre değişiyor. Bu kapılar için kullanıcı numarayı elle girer.
 *
 * Rehberlik yine de kullanıcının kapının önünde ölçtüğü GPS konumuna yapılır;
 * katalog, seçilen numaranın konumla uyuşup uyuşmadığını denetlemek için kullanılır.
 * Not: Mescid-i Haram'da numaralandırma değişebilir (Şubat 2026'da yeni tabelalar asıldı).
 */
export const DOORS: DoorInfo[] = [
  {
    id: 1,
    name: 'Kral Abdülaziz',
    area: 'güney',
    outsideLat: 21.4210447,
    outsideLng: 39.8258406,
    isMain: true,
    verification: 'verified',
    source: 'Saudi Press Agency (resmî numara) + OpenStreetMap node 4755914231; UmrahMap ile aynı konum',
    hint: "Güney yüzü, Saat Kulesi'nin karşısı",
    popularity: 'high',
  },
  {
    id: 79,
    name: 'Kral Fahd',
    area: 'batı',
    outsideLat: 21.421232,
    outsideLng: 39.8240461,
    isMain: true,
    verification: 'verified',
    source: 'SPA (resmî numara) + OpenStreetMap node 3210622327; UmrahMap ile aynı konum',
    hint: "Batı yüzü, Kral Fahd genişlemesi",
    popularity: 'high',
  },
  {
    id: 100,
    name: 'Kral Abdullah',
    area: 'kuzey',
    outsideLat: 21.4253914,
    outsideLng: 39.824132,
    isMain: true,
    verification: 'approximate',
    source: 'SPA (resmî numara) + OpenStreetMap node 5875587679 (tek kaynak)',
    hint: "Kuzey yüzü, Üçüncü Suudi genişlemesi",
    popularity: 'high',
  },
  {
    id: 62,
    name: 'Umre',
    area: 'batı',
    outsideLat: 21.4228378,
    outsideLng: 39.8245696,
    isMain: true,
    verification: 'verified',
    source: 'SPA (resmî numara 62; eski haritalarda 40) + OpenStreetMap node 4318154228; UmrahMap "Gate 40" ile aynı konum',
    hint: "Batı yüzü, Kral Fahd Kapısı'nın kuzeyi",
    popularity: 'high',
  },
  {
    id: 45,
    name: 'Fetih',
    area: 'kuzey',
    outsideLat: 21.4240151,
    outsideLng: 39.8265147,
    isMain: true,
    verification: 'verified',
    source: 'SPA (resmî numara 45; eski haritalarda 30) + OpenStreetMap node 4318154227; UmrahMap "Gate 30" ile aynı konum',
    hint: "Kuzey yüzü, iki minareli",
    popularity: 'high',
  },
  {
    id: 19,
    name: 'Selam',
    area: 'doğu',
    outsideLat: 21.4230322,
    outsideLng: 39.8275662,
    isMain: false,
    verification: 'approximate',
    source: 'SPA (resmî numara) + OpenStreetMap node 4562384977 (tek kaynak)',
    hint: "Doğu yüzü, Mesa (Sa'y) altı, tavafa açılır",
    popularity: 'high',
  },
  {
    id: 13,
    name: 'Safa',
    area: 'doğu',
    outsideLat: 21.4219351,
    outsideLng: 39.8276581,
    isMain: false,
    verification: 'approximate',
    source: 'OpenStreetMap node 6955934980 (tek kaynak)',
    hint: "Doğu yüzü, Safa ucu — Sa'y çıkış kapısı",
    popularity: 'medium',
  },
  {
    id: 64,
    name: 'Şubeyke Köprüsü',
    area: 'batı',
    outsideLat: 21.4225597,
    outsideLng: 39.8245256,
    isMain: false,
    verification: 'approximate',
    source: 'SPA (resmî numara) + OpenStreetMap node 5295574674 (tek kaynak)',
    hint: "Batı yüzü, 1. kat, Şubeyke köprüsü",
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

export function unverifiedDoors(): DoorInfo[] {
  return DOORS.filter(d => d.verification !== 'verified');
}

/** Kapının ekranda/sesle söylenen adı. Listede olmayan numaralar için ad boştur. */
export function doorLabel(id: number, name: string): string {
  return name ? `${name} Kapısı` : `${id} numaralı kapı`;
}

export type VerificationStatus = 'verified' | 'approximate' | 'unverified';
export type Popularity = 'high' | 'medium' | 'low';

export interface DoorInfo {
  id: number;
  name: string;
  area: 'kuzey' | 'güney' | 'doğu' | 'batı';
  outsideLat: number;
  outsideLng: number;
  isMain: boolean;
  verification: VerificationStatus;
  source?: string;
  /** Kısa Türkçe konum ipucu (yalnızca kaynaklarda doğrulananlar) */
  hint?: string;
  popularity?: Popularity;
}

export interface TrailPoint {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export type LocationSource = 'gps' | 'catalog';

export interface SavedGate {
  doorId: number;
  doorName: string;
  outsideLat: number;
  outsideLng: number;
  savedAt: number;
  trail: TrailPoint[];
  /** 'gps': kullanıcı kapının önündeyken ölçülen gerçek konum. 'catalog': doğrulanmamış katalog (eski kayıtlar). */
  locationSource: LocationSource;
  /** Kayıt anındaki GPS hassasiyeti (metre) */
  accuracy?: number;
  /** Seçilen kapı numarası, kayıt anındaki GPS konumuyla uyuşmuyor (>300 m) */
  numberMismatch?: boolean;
}

export interface NavUpdate {
  distance: number;
  instruction: string;
  arrived: boolean;
  bearingDeg: number;
}
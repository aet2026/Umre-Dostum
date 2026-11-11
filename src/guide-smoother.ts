import { distanceM } from './trail';

/**
 * Basit konum yumuşatıcı (exponential moving average).
 *
 * GPS okumaları; yüksek yapılaşma, tünel, kapalı alan gibi durumlarda 20–100 m
 * sıçrayabilir. Tek bir sıçrama kullanıcıyı yanlış yöne gönderebilir.
 *
 * Bu sınıf, yeni okumayı mevcut tahmine alfa ağırlığıyla ekler. Alfa, GPS
 * hassasiyeti kötüleştikçe küçülür (eski değere daha çok yaslanır):
 *   - İyi hassasiyette (≈10 m) α ≈ 0.6 → ham veriye yakın takip
 *   - Kötü hassasiyette (≥100 m) α ≈ 0.15 → ağır yumuşatma
 *
 * **Teleport koruması:** art arda gelen okumalar arasındaki mesafe 500 m'yi
 * aşarsa (GPS "sıçraması" veya ağ tabanlı konum devreye girmişse) yumuşatıcı
 * sıfırlanır; aksi halde kullanıcı hedefe "ışınlanmış" gibi görünür ve
 * navigasyon saatlerce geriden takip eder.
 */
export interface SmoothedPosition {
  lat: number;
  lng: number;
}

const TELEPORT_THRESHOLD_M = 500;

export class PositionSmoother {
  private lat: number | null = null;
  private lng: number | null = null;

  update(
    raw: SmoothedPosition,
    accuracyM: number | null | undefined
  ): SmoothedPosition {
    const acc =
      typeof accuracyM === 'number' && Number.isFinite(accuracyM) && accuracyM > 0
        ? accuracyM
        : 40;

    if (this.lat === null || this.lng === null) {
      this.lat = raw.lat;
      this.lng = raw.lng;
      return { lat: raw.lat, lng: raw.lng };
    }

    // Teleport: tek adımda > 500 m → sıfırla (gerçek yürüyüşte imkânsız)
    const jump = distanceM(
      { lat: this.lat, lng: this.lng },
      { lat: raw.lat, lng: raw.lng }
    );
    if (jump > TELEPORT_THRESHOLD_M) {
      this.lat = raw.lat;
      this.lng = raw.lng;
      return { lat: raw.lat, lng: raw.lng };
    }

    const alpha = Math.min(0.6, Math.max(0.15, 30 / acc));
    this.lat += alpha * (raw.lat - this.lat);
    this.lng += alpha * (raw.lng - this.lng);
    return { lat: this.lat, lng: this.lng };
  }

  reset(): void {
    this.lat = null;
    this.lng = null;
  }

  hasValue(): boolean {
    return this.lat !== null && this.lng !== null;
  }
}
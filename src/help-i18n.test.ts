import { describe, it, expect } from 'vitest';
import {
  getHelpMessages,
  getArabicDoorName,
  hasArabicTranslation,
} from './help-i18n';

describe('help-i18n', () => {
  it('bilinen kapı için Arapça ve Türkçe mesaj üretir', () => {
    const msgs = getHelpMessages({ doorId: 62, doorName: 'Umre' });
    expect(msgs.arabicTitle).toBe('أحتاج مساعدة');
    expect(msgs.arabicBody).toContain('باب العمرة');
    expect(msgs.arabicBody).toContain('الباب رقم 62');
    expect(msgs.arabicBody).toContain('أريد الذهاب إلى');
    expect(msgs.arabicBody).toContain('تدلّني على الطريق');
    expect(msgs.turkishBody).toContain('62 numaralı Umre Kapısı');
    expect(msgs.turkishBody).toContain('gitmek istiyorum');
    expect(msgs.speakArabic).toBe(`${msgs.arabicTitle}. ${msgs.arabicBody}`);
    expect(msgs.speakTurkish).toBe('Bu ekranı görevliye gösterin.');
  });

  it('Arapça ve Türkçe aynı kapı numarasını içerir (senkron)', () => {
    const msgs = getHelpMessages({ doorId: 79, doorName: 'Kral Fahd' });
    expect(msgs.arabicBody).toContain('79');
    expect(msgs.turkishBody).toContain('79');
  });

  it('Kral Abdullah kapısı "باب" ile başlayan doğru Arapça ad kullanır', () => {
    const msgs = getHelpMessages({ doorId: 100, doorName: 'Kral Abdullah' });
    expect(msgs.arabicBody).toContain('باب الملك عبد الله');
    expect(msgs.turkishBody).toContain('Kral Abdullah');
  });

  it('kayıt yoksa genel yardım mesajı döner', () => {
    const msgs = getHelpMessages(null);
    expect(msgs.arabicTitle).toBe('أحتاج مساعدة');
    expect(msgs.arabicBody).toBe('هل يمكنك أن تساعدني؟');
    expect(msgs.turkishBody).toContain('Yardıma ihtiyacım var');
    expect(msgs.speakArabic).toContain(msgs.arabicBody);
  });

  it('bilinmeyen kapıda Türkçe (Latin) ad Arapça cümleye girmez, numara kullanılır', () => {
    const msgs = getHelpMessages({ doorId: 9999, doorName: 'Test Kapı' });
    expect(msgs.arabicBody).not.toContain('Test Kapı');
    expect(msgs.arabicBody).toContain('الباب رقم 9999');
    expect(msgs.turkishBody).toContain('Test Kapı');
  });

  it('getArabicDoorName bilinen kapılar için Arapça ad döner', () => {
    expect(getArabicDoorName(62)).toBe('باب العمرة');
    expect(getArabicDoorName(100)).toBe('باب الملك عبد الله');
    expect(getArabicDoorName(45)).toBe('باب الفتح');
  });

  it('getArabicDoorName bilinmeyen kapı için null döner', () => {
    expect(getArabicDoorName(9999)).toBeNull();
  });

  it('hasArabicTranslation doğru cevap verir', () => {
    expect(hasArabicTranslation(62)).toBe(true);
    expect(hasArabicTranslation(100)).toBe(true);
    expect(hasArabicTranslation(9999)).toBe(false);
  });

  it('tüm kapıların Arapça çevirisi var; köprü dışındakiler "باب" ile başlar', async () => {
    const { DOORS } = await import('./doors');
    for (const door of DOORS) {
      expect(hasArabicTranslation(door.id)).toBe(true);
      if (door.id !== 64) expect(getArabicDoorName(door.id)!.startsWith('باب')).toBe(true);
    }
  });

  it('numara konumla uyuşmuyorsa yanlış kapı numarası söylenmez (genel mesaj)', () => {
    const msgs = getHelpMessages({ doorId: 62, doorName: 'Umre', numberMismatch: true });
    expect(msgs.arabicBody).toBe('هل يمكنك أن تساعدني؟');
    expect(msgs.arabicBody).not.toContain('62');
  });

  it('adsız (elle girilen) kapıda yalnızca numara kullanılır', () => {
    const msgs = getHelpMessages({ doorId: 84, doorName: '' });
    expect(msgs.arabicBody).toContain('الباب رقم 84');
    expect(msgs.turkishBody).toContain('84 numaralı kapıya');
  });

  it('Arapça metinde parantez yok (TTS düzgün okusun)', async () => {
    const { DOORS } = await import('./doors');
    for (const door of DOORS) {
      expect(getArabicDoorName(door.id)).not.toMatch(/[()]/);
    }
  });
});

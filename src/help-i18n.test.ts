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
    expect(msgs.arabicBody).toContain('هل يمكنك أن ترشدني بيدك');
    expect(msgs.turkishBody).toContain('Umre');
    expect(msgs.turkishBody).toContain('El ile bana tarif edebilir misiniz');
    expect(msgs.speakArabic).toBe(msgs.arabicBody);
  });

  it('Kral Abdullah kapısı için doğru Arapça adı kullanır', () => {
    const msgs = getHelpMessages({ doorId: 100, doorName: 'Kral Abdullah' });
    expect(msgs.arabicBody).toContain('الملك عبد الله');
    expect(msgs.turkishBody).toContain('Kral Abdullah');
  });

  it('kayıt yoksa genel yardım mesajı döner', () => {
    const msgs = getHelpMessages(null);
    expect(msgs.arabicTitle).toBe('أحتاج مساعدة');
    expect(msgs.arabicBody).toBe('هل يمكنك أن تساعدني؟');
    expect(msgs.turkishBody).toContain('Yardıma ihtiyacım var');
    expect(msgs.speakArabic).toBe(msgs.arabicBody);
  });

  it('bilinmeyen kapı id için Türkçe adı Arapça yerine kullanır', () => {
    const msgs = getHelpMessages({ doorId: 9999, doorName: 'Test Kapı' });
    expect(msgs.arabicBody).toContain('Test Kapı');
    expect(msgs.turkishBody).toContain('Test Kapı');
  });

  it('getArabicDoorName bilinen kapılar için Arapça ad döner', () => {
    expect(getArabicDoorName(62)).toBe('باب العمرة');
    expect(getArabicDoorName(100)).toBe('الملك عبد الله');
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

  it('tüm ana kapıların Arapça çevirisi var', async () => {
    const { DOORS, mainDoors } = await import('./doors');
    for (const door of mainDoors()) {
      expect(hasArabicTranslation(door.id)).toBe(true);
    }
    for (const door of DOORS) {
      expect(hasArabicTranslation(door.id)).toBe(true);
    }
  });

  it('yeni kapıların Arapça çevirisi var', () => {
    expect(getArabicDoorName(2)).toBe('باب أجياد');
    expect(getArabicDoorName(37)).toBe('باب المروة');
    expect(getArabicDoorName(60)).toBe('باب الحديبية');
    expect(getArabicDoorName(86)).toBe('باب الفتح (شعب عامر)');
    expect(getArabicDoorName(90)).toBe('باب المدينة');
  });
});
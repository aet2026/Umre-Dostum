import { findDoor } from './doors';

export interface HelpMessages {
  arabicTitle: string;
  arabicBody: string;
  turkishBody: string;
  speakArabic: string;
}

const DOOR_AR: Record<number, string> = {
  1: 'الملك عبد العزيز',
  79: 'الملك فهد',
  100: 'الملك عبد الله',
  62: 'باب العمرة',
  45: 'باب الفتح',
  2: 'باب أجياد',
  13: 'باب الصفا',
  19: 'باب السلام',
  37: 'باب المروة',
  60: 'باب الحديبية',
  86: 'باب الفتح (شعب عامر)',
  90: 'باب المدينة',
};

export function getHelpMessages(saved: {
  doorId: number;
  doorName: string;
} | null): HelpMessages {
  const arabicDoorName = saved
    ? DOOR_AR[saved.doorId] ?? saved.doorName
    : null;

  if (!arabicDoorName) {
    return {
      arabicTitle: 'أحتاج مساعدة',
      arabicBody: 'هل يمكنك أن تساعدني؟',
      turkishBody: 'Yardıma ihtiyacım var. Bana yardım edebilir misiniz?',
      speakArabic: 'هل يمكنك أن تساعدني؟',
    };
  }

  const arabicBody = `أذهب إلى ${arabicDoorName}. هل يمكنك أن ترشدني بيدك؟`;
  const turkishBody = saved
    ? `${saved.doorName} Kapısı'na gideceğim. El ile bana tarif edebilir misiniz?`
    : 'El ile bana tarif edebilir misiniz?';

  return {
    arabicTitle: 'أحتاج مساعدة',
    arabicBody,
    turkishBody,
    speakArabic: arabicBody,
  };
}

export function getArabicDoorName(doorId: number): string | null {
  return DOOR_AR[doorId] ?? null;
}

export function hasArabicTranslation(doorId: number): boolean {
  return doorId in DOOR_AR;
}

export { findDoor };
import { findDoor } from './doors';

export interface HelpMessages {
  arabicTitle: string;
  arabicBody: string;
  turkishBody: string;
  /** Hoparlörden okunacak Arapça metin (başlık + gövde) */
  speakArabic: string;
  /** Kullanıcıya Türkçe söylenecek yönerge */
  speakTurkish: string;
}

const DOOR_AR: Record<number, string> = {
  1: 'باب الملك عبد العزيز',
  79: 'باب الملك فهد',
  100: 'باب الملك عبد الله',
  62: 'باب العمرة',
  45: 'باب الفتح',
  19: 'باب السلام',
  13: 'باب الصفا',
  64: 'جسر الشبيكة',
};

const TITLE_AR = 'أحتاج مساعدة';
const SPEAK_TR = 'Bu ekranı görevliye gösterin.';

export function getHelpMessages(saved: {
  doorId: number;
  doorName: string;
  numberMismatch?: boolean;
} | null): HelpMessages {
  // Kapı numarası konumla uyuşmuyorsa yanlış numara söylemeyelim: genel mesaj
  if (!saved || saved.numberMismatch) {
    const body = 'هل يمكنك أن تساعدني؟';
    return {
      arabicTitle: TITLE_AR,
      arabicBody: body,
      turkishBody: 'Yardıma ihtiyacım var. Bana yardım edebilir misiniz?',
      speakArabic: `${TITLE_AR}. ${body}`,
      speakTurkish: SPEAK_TR,
    };
  }

  // Kapı numarası evrenseldir: ad çevirisi yanlış/eksik olsa bile görevli numarayı anlar.
  const arName = DOOR_AR[saved.doorId];
  const target = arName
    ? `${arName}، الباب رقم ${saved.doorId}`
    : `الباب رقم ${saved.doorId}`;
  const arabicBody = `أريد الذهاب إلى ${target}. هل يمكنك أن تدلّني على الطريق؟`;
  const turkishTarget = saved.doorName
    ? `${saved.doorId} numaralı ${saved.doorName} Kapısı'na`
    : `${saved.doorId} numaralı kapıya`;
  const turkishBody =
    `${turkishTarget} gitmek istiyorum. Bana yolu tarif edebilir misiniz?`;

  return {
    arabicTitle: TITLE_AR,
    arabicBody,
    turkishBody,
    speakArabic: `${TITLE_AR}. ${arabicBody}`,
    speakTurkish: SPEAK_TR,
  };
}

export function getArabicDoorName(doorId: number): string | null {
  return DOOR_AR[doorId] ?? null;
}

export function hasArabicTranslation(doorId: number): boolean {
  return doorId in DOOR_AR;
}

export { findDoor };

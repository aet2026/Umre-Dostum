import { describe, it, expect, vi, beforeEach } from 'vitest';
import { speak, repeatLast, stopSpeech, initSpeech } from './speech';

describe('speech', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    (speechSynthesis.speak as ReturnType<typeof vi.fn>).mockClear();
    (speechSynthesis.cancel as ReturnType<typeof vi.fn>).mockClear();
    stopSpeech();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  it('boş metin için konuşmaz', () => {
    speak('');
    expect(speechSynthesis.speak).not.toHaveBeenCalled();
  });

  it('ilk çağrıda konuşur', () => {
    speak('Merhaba', true);
    expect(speechSynthesis.speak).toHaveBeenCalledTimes(1);
  });

  it('6 saniye içinde farklı metinleri tekrar okumaz (force değilse)', () => {
    speak('birinci', true);
    vi.advanceTimersByTime(2000);
    speak('ikinci', false);
    expect(speechSynthesis.speak).toHaveBeenCalledTimes(1);
  });

  it('6 saniye sonra farklı metni okur', () => {
    speak('birinci', true);
    vi.advanceTimersByTime(7000);
    speak('ikinci', false);
    expect(speechSynthesis.speak).toHaveBeenCalledTimes(2);
  });

  it('aynı metni force olmadan tekrar okumaz', () => {
    speak('aynı cümle', true);
    vi.advanceTimersByTime(10000);
    speak('aynı cümle', false);
    expect(speechSynthesis.speak).toHaveBeenCalledTimes(1);
  });

  it('force=true ile aynı metni tekrar okur', () => {
    speak('aynı cümle', true);
    speak('aynı cümle', true);
    expect(speechSynthesis.speak).toHaveBeenCalledTimes(2);
  });

  it('repeatLast son metni force ile okur', () => {
    speak('tekrar et beni', true);
    repeatLast();
    expect(speechSynthesis.speak).toHaveBeenCalledTimes(2);
  });

  it('stopSpeech konuşmayı iptal eder ve son metni temizler', () => {
    speak('iptal', true);
    stopSpeech();
    expect(speechSynthesis.cancel).toHaveBeenCalled();
    speak('iptal', false);
    expect(speechSynthesis.speak).toHaveBeenCalledTimes(2);
  });

  it('stopSpeech sonrası MIN_GAP sıfırlanır', () => {
    speak('birinci', true);
    vi.advanceTimersByTime(1000);
    stopSpeech();
    speak('ikinci', false);
    expect(speechSynthesis.speak).toHaveBeenCalledTimes(2);
  });

  it('speechSynthesis.cancel hata atarsa stopSpeech crash etmez', () => {
    (speechSynthesis.cancel as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('cancel failed');
    });
    expect(() => stopSpeech()).not.toThrow();
  });

  it('speechSynthesis.speak hata atarsa speak crash etmez', () => {
    (speechSynthesis.speak as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('speak failed');
    });
    expect(() => speak('patlat', true)).not.toThrow();
  });

  it('initSpeech voiceschanged dinleyicisi ekler', () => {
    initSpeech();
    expect(speechSynthesis.addEventListener).toHaveBeenCalledWith(
      'voiceschanged',
      expect.any(Function)
    );
  });

  it('Türkçe ses varsa utterance.voice olarak seçilir', () => {
    speak('selam', true);
    const call = (speechSynthesis.speak as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(call).toBeTruthy();
    expect(call.voice?.lang).toBe('tr-TR');
  });
});
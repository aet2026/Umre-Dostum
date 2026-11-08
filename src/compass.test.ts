import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isCompassSupported,
  requestCompassPermission,
  startCompass,
} from './compass';

describe('compass', () => {
  let listeners: Record<string, EventListener[]> = {};

  beforeEach(() => {
    listeners = {};
    vi.spyOn(window, 'addEventListener').mockImplementation(
      (type: string, fn: EventListenerOrEventListenerObject) => {
        (listeners[type] ??= []).push(fn as EventListener);
      }
    );
    vi.spyOn(window, 'removeEventListener').mockImplementation(
      (type: string, fn: EventListenerOrEventListenerObject) => {
        listeners[type] = (listeners[type] ?? []).filter(f => f !== fn);
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent;
  });

  function emit(type: string, event: Partial<DeviceOrientationEvent>): void {
    for (const fn of listeners[type] ?? []) {
      fn(event as unknown as Event);
    }
  }

  it('isCompassSupported: DeviceOrientationEvent yoksa false', () => {
    expect(isCompassSupported()).toBe(false);
  });

  it('isCompassSupported: DeviceOrientationEvent varsa true', () => {
    (window as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = class {};
    expect(isCompassSupported()).toBe(true);
  });

  it('requestCompassPermission: desteklenmiyorsa false', async () => {
    expect(await requestCompassPermission()).toBe(false);
  });

  it('requestCompassPermission: Android gibi doğrudan true döner', async () => {
    (window as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = class {};
    expect(await requestCompassPermission()).toBe(true);
  });

  it('requestCompassPermission: iOS izin granted ise true', async () => {
    const cls = class {};
    (cls as unknown as { requestPermission: () => Promise<'granted'> }).requestPermission =
      () => Promise.resolve('granted');
    (window as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = cls;
    expect(await requestCompassPermission()).toBe(true);
  });

  it('requestCompassPermission: iOS izin denied ise false', async () => {
    const cls = class {};
    (cls as unknown as { requestPermission: () => Promise<'denied'> }).requestPermission =
      () => Promise.resolve('denied');
    (window as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = cls;
    expect(await requestCompassPermission()).toBe(false);
  });

  it('startCompass: desteklenmiyorsa hata callback çağırır', () => {
    const errCb = vi.fn();
    const handle = startCompass(() => {}, errCb);
    expect(errCb).toHaveBeenCalledWith('unsupported');
    handle.stop();
  });

  it('startCompass: webkitCompassHeading değerini kullanır', () => {
    (window as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = class {};
    const cb = vi.fn();
    const handle = startCompass(cb);
    emit('deviceorientation', { webkitCompassHeading: 90 } as unknown as DeviceOrientationEvent);
    expect(cb).toHaveBeenCalledWith(90);
    handle.stop();
  });

  it('startCompass: Android alpha değerini tersine çevirir', () => {
    (window as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = class {};
    const cb = vi.fn();
    const handle = startCompass(cb);
    emit('deviceorientation', { alpha: 90 } as unknown as DeviceOrientationEvent);
    expect(cb).toHaveBeenCalledWith(270);
    handle.stop();
  });

  it('startCompass: stop() dinleyiciyi kaldırır', () => {
    (window as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = class {};
    const cb = vi.fn();
    const handle = startCompass(cb);
    handle.stop();
    expect(handle.isActive()).toBe(false);
    emit('deviceorientation', { webkitCompassHeading: 90 } as unknown as DeviceOrientationEvent);
    expect(cb).not.toHaveBeenCalled();
  });

  it('startCompass: normalize 0-360 aralığı', () => {
    (window as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = class {};
    const cb = vi.fn();
    const handle = startCompass(cb);
    emit('deviceorientation', { webkitCompassHeading: 450 } as unknown as DeviceOrientationEvent);
    expect(cb).toHaveBeenCalledWith(90);
    handle.stop();
  });
});
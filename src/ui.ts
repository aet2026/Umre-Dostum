const SCREENS = ['home', 'pickDoor', 'confirm', 'saving', 'guide', 'help', 'verify'] as const;
export type ScreenId = typeof SCREENS[number];

export function show(id: ScreenId): void {
  for (const s of SCREENS) {
    const el = document.getElementById(s);
    if (!el) continue;
    const on = s === id;
    el.classList.toggle('hide', !on);
    el.setAttribute('aria-hidden', on ? 'false' : 'true');
  }
  window.scrollTo(0, 0);
}
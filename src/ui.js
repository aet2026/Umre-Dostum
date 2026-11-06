const SCREENS = ['home', 'pickDoor', 'confirm', 'saving', 'guide', 'help'];
export function show(id) {
    for (const s of SCREENS) {
        const el = document.getElementById(s);
        if (!el)
            continue;
        const on = s === id;
        el.classList.toggle('hide', !on);
        el.setAttribute('aria-hidden', on ? 'false' : 'true');
    }
    window.scrollTo(0, 0);
}

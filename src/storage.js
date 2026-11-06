const KEY = 'savedGate.v1';
export function saveGate(g) {
    try {
        localStorage.setItem(KEY, JSON.stringify(g));
    }
    catch { }
}
export function loadGate() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        if (typeof parsed.doorId !== 'number' || typeof parsed.outsideLat !== 'number') {
            return null;
        }
        parsed.trail = Array.isArray(parsed.trail) ? parsed.trail : [];
        return parsed;
    }
    catch {
        return null;
    }
}
export function clearGate() {
    try {
        localStorage.removeItem(KEY);
    }
    catch { }
}

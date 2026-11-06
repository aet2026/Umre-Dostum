import { describe, it, expect } from 'vitest';
import { computeNavigation } from './guide';
const mockSaved = {
    doorId: 100,
    doorName: 'Kral Abdullah',
    outsideLat: 21.42355,
    outsideLng: 39.82590,
    savedAt: Date.now(),
    trail: [],
};
describe('computeNavigation', () => {
    it('hedefe çok yakınken arrived döner', () => {
        const nav = computeNavigation(mockSaved, {
            lat: 21.42355,
            lng: 39.82590,
        });
        expect(nav.arrived).toBe(true);
        expect(nav.distance).toBeLessThan(20);
    });
    it('uzaktayken arrived false döner', () => {
        const nav = computeNavigation(mockSaved, {
            lat: 21.42000,
            lng: 39.82000,
        });
        expect(nav.arrived).toBe(false);
        expect(nav.distance).toBeGreaterThan(100);
    });
    it('yön talimatı Türkçe yön içerir', () => {
        const nav = computeNavigation(mockSaved, {
            lat: 21.42000,
            lng: 39.82000,
        });
        expect(nav.instruction).toMatch(/kuzey|güney|doğu|batı/);
    });
});

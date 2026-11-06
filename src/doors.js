export const DOORS = [
    {
        id: 1,
        name: 'Kral Abdülaziz',
        area: 'batı',
        outsideLat: 21.42053,
        outsideLng: 39.82613,
        isMain: true,
        verification: 'approximate',
        source: 'OSM building centroid + manual offset',
    },
    {
        id: 79,
        name: 'Kral Fahd',
        area: 'batı',
        outsideLat: 21.42230,
        outsideLng: 39.82480,
        isMain: true,
        verification: 'approximate',
    },
    {
        id: 100,
        name: 'Kral Abdullah',
        area: 'kuzey',
        outsideLat: 21.42355,
        outsideLng: 39.82590,
        isMain: true,
        verification: 'approximate',
    },
    {
        id: 62,
        name: 'Umre',
        area: 'kuzey',
        outsideLat: 21.42355,
        outsideLng: 39.82660,
        isMain: true,
        verification: 'approximate',
    },
    {
        id: 45,
        name: 'Fetih',
        area: 'kuzey',
        outsideLat: 21.42402,
        outsideLng: 39.82652,
        isMain: true,
        verification: 'verified',
        source: 'OpenStreetMap node 4318154227',
    },
    {
        id: 13,
        name: 'Safa',
        area: 'doğu',
        outsideLat: 21.42220,
        outsideLng: 39.82760,
        isMain: false,
        verification: 'approximate',
    },
    {
        id: 19,
        name: 'Selam (bodrum)',
        area: 'batı',
        outsideLat: 21.42160,
        outsideLng: 39.82460,
        isMain: false,
        verification: 'approximate',
    },
];
export function findDoor(id) {
    return DOORS.find(d => d.id === id);
}
export function mainDoors() {
    return DOORS.filter(d => d.isMain);
}
export function unverifiedDoors() {
    return DOORS.filter(d => d.verification !== 'verified');
}

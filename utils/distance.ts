// Distance calculation utilities for GPS tracking
// Haversine formula for accurate distance calculation

/**
 * Calculate distance between two coordinates in meters
 * @param lat1 Latitude of first point
 * @param lng1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lng2 Longitude of second point
 * @returns Distance in meters
 */
export function haversineMeters(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371000; // Earth's radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance);
}

/**
 * Format distance for display
 * @param meters Distance in meters
 * @returns Formatted string (e.g., "2.5 km" or "150 m")
 */
export function formatDistance(meters: number | null | undefined): string {
    if (meters == null || !isFinite(meters)) return '-';

    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }

    return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Calculate distance between user and member
 * @param userCoords User's coordinates
 * @param memberLocation Member's location
 * @returns Distance in meters or null
 */
export function calculateMemberDistance(
    userCoords: { latitude: number; longitude: number } | null,
    memberLocation: { lat: number; lng: number } | null
): number | null {
    if (!userCoords || !memberLocation) return null;

    return haversineMeters(
        userCoords.latitude,
        userCoords.longitude,
        memberLocation.lat,
        memberLocation.lng
    );
}

/**
 * Sort members by distance (closest first)
 * @param members Array of members with distance field
 * @returns Sorted array
 */
export function sortMembersByDistance<T extends { distance?: number | null }>(
    members: T[]
): T[] {
    return [...members].sort((a, b) => {
        if (a.distance == null) return 1;
        if (b.distance == null) return -1;
        return a.distance - b.distance;
    });
}

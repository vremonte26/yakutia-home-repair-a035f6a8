// Centralized geolocation helper with localStorage caching of permission choice.
// Browser shows the native permission prompt only the first time; afterwards
// the cached decision is used so we never re-trigger the prompt unnecessarily.

const PERMISSION_KEY = 'geo_permission'; // 'granted' | 'denied'
const POSITION_KEY = 'geo_last_position'; // { lat, lng, ts }
const POSITION_TTL_MS = 10 * 60 * 1000; // 10 minutes

export type GeoPermission = 'granted' | 'denied' | 'unknown';

export function getStoredPermission(): GeoPermission {
  const v = localStorage.getItem(PERMISSION_KEY);
  if (v === 'granted' || v === 'denied') return v;
  return 'unknown';
}

export function setStoredPermission(p: 'granted' | 'denied') {
  localStorage.setItem(PERMISSION_KEY, p);
}

export function resetGeoPermission() {
  localStorage.removeItem(PERMISSION_KEY);
  localStorage.removeItem(POSITION_KEY);
}

interface CachedPosition {
  lat: number;
  lng: number;
  ts: number;
}

function getCachedPosition(): CachedPosition | null {
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPosition;
    if (Date.now() - parsed.ts > POSITION_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function cachePosition(lat: number, lng: number) {
  localStorage.setItem(POSITION_KEY, JSON.stringify({ lat, lng, ts: Date.now() }));
}

export interface GeoResult {
  lat: number;
  lng: number;
}

/**
 * Get current position. If permission previously denied (cached) — reject
 * immediately without re-triggering the browser prompt. If previously granted
 * — call getCurrentPosition (browser won't re-prompt). If unknown — call it
 * which triggers the native prompt the first time.
 */
export function getCurrentPosition(opts?: { forcePrompt?: boolean }): Promise<GeoResult> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('geo_unsupported'));
      return;
    }

    const stored = getStoredPermission();
    if (stored === 'denied' && !opts?.forcePrompt) {
      reject(new Error('geo_denied'));
      return;
    }

    if (stored === 'granted' && !opts?.forcePrompt) {
      const cached = getCachedPosition();
      if (cached) {
        resolve({ lat: cached.lat, lng: cached.lng });
        return;
      }
    }

    // Standard call without aggressive options so the browser respects its
    // own cached permission decision and does not re-prompt.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStoredPermission('granted');
        cachePosition(pos.coords.latitude, pos.coords.longitude);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStoredPermission('denied');
          reject(new Error('geo_denied'));
        } else {
          reject(new Error('geo_error'));
        }
      }
    );
  });
}

export const GEO_DENIED_MESSAGE =
  'Без геолокации карта не может показать заказы рядом';

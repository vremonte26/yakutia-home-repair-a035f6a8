import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentPosition } from '@/lib/geolocation';

const CACHE_KEY = 'user_location_label';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MIN_DELTA_DEG = 0.05; // ~5km — refetch only on meaningful movement

interface CachedLabel {
  label: string | null;
  lat: number;
  lng: number;
  ts: number;
}

function readCache(): CachedLabel | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedLabel;
  } catch {
    return null;
  }
}

function writeCache(c: CachedLabel) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(c));
}

function buildLabel(region: string, area: string, locality: string): string | null {
  const isYakutia = /саха|якут/i.test(region);
  if (!isYakutia) return null;

  // City of Yakutsk
  if (/якутск/i.test(locality) && !/улус|район/i.test(area || '')) {
    return 'Мастера и заказы в Якутске';
  }

  if (area) {
    // Normalize: "Нюрбинский улус" or "Нюрбинский район" → keep ulus form
    let name = area.replace(/\s*(улус|район)\s*$/i, '').trim();
    return `Мастера и заказы в ${name} улусе`;
  }

  if (/якутск/i.test(locality)) {
    return 'Мастера и заказы в Якутске';
  }

  return null;
}

export function useUserLocation() {
  const [label, setLabel] = useState<string | null>(() => {
    const c = readCache();
    if (c && Date.now() - c.ts < CACHE_TTL_MS) return c.label;
    return null;
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const pos = await getCurrentPosition();
        const cached = readCache();
        const fresh = cached && Date.now() - cached.ts < CACHE_TTL_MS;
        const moved = !cached ||
          Math.abs(cached.lat - pos.lat) > MIN_DELTA_DEG ||
          Math.abs(cached.lng - pos.lng) > MIN_DELTA_DEG;

        if (fresh && !moved) {
          if (!cancelled) setLabel(cached!.label);
          return;
        }

        const { data, error } = await supabase.functions.invoke('reverse-geocode', {
          body: { lat: pos.lat, lng: pos.lng },
        });
        if (error) throw error;

        const newLabel = buildLabel(data?.region || '', data?.area || '', data?.locality || '');
        writeCache({ label: newLabel, lat: pos.lat, lng: pos.lng, ts: Date.now() });
        if (!cancelled) setLabel(newLabel);
      } catch {
        // Keep whatever we had (cached or null) — silent failure
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return label;
}

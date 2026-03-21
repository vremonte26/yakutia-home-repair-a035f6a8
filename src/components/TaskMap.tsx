import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

declare global {
  interface Window {
    ymaps3: any;
  }
}

interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  title?: string;
  color: 'red' | 'green';
}

interface TaskMapProps {
  mode: 'master' | 'client';
}

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Add random offset (~1-2 km) to hide exact address
function obfuscateCoords(lat: number, lng: number): [number, number] {
  const offsetLat = (Math.random() - 0.5) * 0.03;
  const offsetLng = (Math.random() - 0.5) * 0.03;
  return [lat + offsetLat, lng + offsetLng];
}

export function TaskMap({ mode }: TaskMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const { user, profile } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const init = async () => {
      try {
        // 1. Get user location
        console.log('[TaskMap] Получение геолокации...');
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
          });
        });
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        setUserLocation({ lat: userLat, lng: userLng });
        console.log(`[TaskMap] Геолокация: ${userLat}, ${userLng}`);

        // 2. Get API key
        console.log('[TaskMap] Получение ключа...');
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error('No session');

        const res = await supabase.functions.invoke('get-yandex-key', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.error) throw new Error(res.error.message || 'Failed to get key');
        const apiKey = res.data?.key;
        if (!apiKey) throw new Error('No API key returned');
        console.log('[TaskMap] Ключ получен');

        if (cancelled) return;

        // 3. Load Yandex Maps script
        if (!document.querySelector('script[src*="api-maps.yandex.ru"]')) {
          console.log('[TaskMap] Загрузка скрипта...');
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://api-maps.yandex.ru/v3/?apikey=${apiKey}&lang=ru_RU`;
            script.onload = () => {
              console.log('[TaskMap] Скрипт загружен');
              resolve();
            };
            script.onerror = () => reject(new Error('Failed to load Yandex Maps script'));
            document.head.appendChild(script);
          });
        } else {
          console.log('[TaskMap] Скрипт уже загружен');
        }

        if (cancelled) return;

        // 4. Wait for ymaps3.ready
        console.log('[TaskMap] Инициализация карты...');
        await window.ymaps3.ready;

        if (cancelled || !mapRef.current) return;

        // 5. Fetch points
        let points: MapPoint[] = [];

        if (mode === 'master') {
          // Show tasks within 50km
          const { data: tasks } = await supabase
            .from('tasks')
            .select('id, title, lat, lng')
            .eq('status', 'open')
            .not('lat', 'is', null)
            .not('lng', 'is', null);

          points = (tasks ?? [])
            .filter(t => t.lat && t.lng && getDistanceKm(userLat, userLng, t.lat, t.lng) <= 50)
            .map(t => {
              const [oLat, oLng] = obfuscateCoords(t.lat!, t.lng!);
              return { id: t.id, lat: oLat, lng: oLng, title: t.title, color: 'red' as const };
            });
        } else {
          // Show verified masters nearby
          const { data: masters } = await supabase
            .from('profiles')
            .select('id, name, lat, lng')
            .eq('role', 'master')
            .eq('is_verified', true)
            .not('lat', 'is', null)
            .not('lng', 'is', null) as any;

          points = (masters ?? [])
            .filter((m: any) => m.lat && m.lng && getDistanceKm(userLat, userLng, m.lat, m.lng) <= 50)
            .map((m: any) => ({
              id: m.id,
              lat: m.lat,
              lng: m.lng,
              title: m.name,
              color: 'green' as const,
            }));
        }

        console.log(`[TaskMap] Найдено ${points.length} точек`);

        // 6. Create map
        const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = window.ymaps3;

        const map = new YMap(mapRef.current, {
          location: { center: [userLng, userLat], zoom: 11 },
        });

        map.addChild(new YMapDefaultSchemeLayer({}));
        map.addChild(new YMapDefaultFeaturesLayer({}));

        // User location marker
        const userEl = document.createElement('div');
        userEl.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 6px rgba(59,130,246,0.5);';
        map.addChild(new YMapMarker({ coordinates: [userLng, userLat] }, userEl));

        // Task/master markers
        points.forEach(p => {
          const el = document.createElement('div');
          el.style.cssText = `width:12px;height:12px;border-radius:50%;background:${p.color === 'green' ? '#22c55e' : '#ef4444'};border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.3);cursor:pointer;`;
          el.title = p.title || '';
          map.addChild(new YMapMarker({ coordinates: [p.lng, p.lat] }, el));
        });

        mapInstanceRef.current = map;
        console.log('[TaskMap] Карта создана успешно');
        setLoading(false);
      } catch (err: any) {
        console.error('[TaskMap] Ошибка:', err.message);
        setError(err.message);
        setLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.destroy(); } catch {}
        mapInstanceRef.current = null;
      }
    };
  }, [user, mode]);

  if (error) {
    return (
      <div className="w-full rounded-xl border bg-muted/50 flex items-center justify-center text-sm text-muted-foreground" style={{ height: 400 }}>
        Не удалось загрузить карту: {error}
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-xl overflow-hidden border" style={{ height: 400 }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      )}
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

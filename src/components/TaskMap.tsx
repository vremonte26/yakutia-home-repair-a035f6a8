import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Locate } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Map, Marker } from '@2gis/mapgl/types';
import {
  getCurrentPosition,
  getStoredPermission,
  setStoredPermission,
} from '@/lib/geolocation';

const DGIS_API_KEY = 'f36bed16-b4cb-48a6-8b12-541f54023ec7';

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

function obfuscateCoords(lat: number, lng: number): [number, number] {
  const offsetLat = (Math.random() - 0.5) * 0.03;
  const offsetLng = (Math.random() - 0.5) * 0.03;
  return [lat + offsetLat, lng + offsetLng];
}

type GeoState = 'asking' | 'denied' | 'granted' | 'error';

function initialGeoState(): GeoState {
  const p = getStoredPermission();
  if (p === 'granted') return 'granted';
  if (p === 'denied') return 'denied';
  return 'asking';
}

function loadMapglScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="mapgl"]')) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://mapgl.2gis.com/api/js/v1';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load 2GIS MapGL'));
    document.head.appendChild(script);
  });
}

export function TaskMap({ mode }: TaskMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [geoState, setGeoState] = useState<GeoState>(initialGeoState);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [showUserPin, setShowUserPin] = useState(false);

  const autoTriggeredRef = useRef(false);

  const requestGeolocation = useCallback(async (forcePrompt = false) => {
    setLoading(true);
    setGeoError(null);

    try {
      const { lat, lng } = await getCurrentPosition({ forcePrompt });
      setCenter({ lat, lng });
      setShowUserPin(true);
      setGeoState('granted');
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      const msg = err?.message;
      if (msg === 'geo_denied') {
        setGeoState('denied');
      } else if (msg === 'geo_unsupported') {
        setGeoState('error');
        setGeoError('Геолокация недоступна в вашем браузере или устройстве');
      } else {
        setGeoState('error');
        setGeoError('Не удалось определить местоположение.');
      }
    }
  }, []);

  // Auto-request geolocation if previously granted
  useEffect(() => {
    if (geoState === 'granted' && !center && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      requestGeolocation();
    }
  }, [geoState, center, requestGeolocation]);

  useEffect(() => {
    if (!user || !center) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const init = async () => {
      try {
        const { lat: userLat, lng: userLng } = center;

        await loadMapglScript();
        if (cancelled || !mapRef.current) return;

        // Fetch points
        let points: MapPoint[] = [];

        if (mode === 'master') {
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
              id: m.id, lat: m.lat, lng: m.lng, title: m.name, color: 'green' as const,
            }));
        }

        if (cancelled || !mapRef.current) return;

        // Create 2GIS map
        const mapglAPI = (window as any).mapgl;
        const map = new mapglAPI.Map(mapRef.current, {
          center: [userLng, userLat],
          zoom: 13,
          key: DGIS_API_KEY,
        });

        mapInstanceRef.current = map;

        // User location marker
        if (showUserPin) {
          const userMarker = new mapglAPI.Marker(map, {
            coordinates: [userLng, userLat],
            icon: 'data:image/svg+xml,' + encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="8" fill="#3b82f6" stroke="white" stroke-width="3"/></svg>`
            ),
            size: [20, 20],
            anchor: [10, 10],
          });
          markersRef.current.push(userMarker);
        }

        // Task/master markers
        points.forEach(p => {
          const fillColor = p.color === 'green' ? '#22c55e' : '#ef4444';
          const marker = new mapglAPI.Marker(map, {
            coordinates: [p.lng, p.lat],
            icon: 'data:image/svg+xml,' + encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="6" fill="${fillColor}" stroke="white" stroke-width="2"/></svg>`
            ),
            size: [16, 16],
            anchor: [8, 8],
            label: { text: p.title || '' },
          });
          markersRef.current.push(marker);
        });

        console.log(`[TaskMap] 2GIS карта создана, ${points.length} точек`);
        setLoading(false);
      } catch (err: any) {
        console.error('[TaskMap] Ошибка:', err.message);
        setError('Не удалось загрузить карту. Проверьте интернет и обновите страницу.');
        setLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      markersRef.current.forEach(m => { try { m.destroy(); } catch {} });
      markersRef.current = [];
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.destroy(); } catch {}
        mapInstanceRef.current = null;
      }
    };
  }, [user, mode, center, showUserPin]);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      toast({ title: 'Не удалось определить ваше местоположение. Проверьте настройки геолокации в браузере.', variant: 'destructive' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const map = mapInstanceRef.current;
        const mapglAPI = (window as any).mapgl;
        if (map && mapglAPI) {
          map.setCenter([longitude, latitude]);
          map.setZoom(15);
          if (userMarkerRef.current) {
            try { userMarkerRef.current.destroy(); } catch {}
          }
          const marker = new mapglAPI.Marker(map, {
            coordinates: [longitude, latitude],
            icon: 'data:image/svg+xml,' + encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="8" fill="#3b82f6" stroke="white" stroke-width="3"/></svg>`
            ),
            size: [20, 20],
            anchor: [10, 10],
          });
          userMarkerRef.current = marker;
        }
      },
      () => {
        toast({ title: 'Не удалось определить ваше местоположение. Проверьте настройки геолокации в браузере.', variant: 'destructive' });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [toast]);

  if (geoState === 'asking') {
    return (
      <div className="w-full rounded-xl border bg-card flex flex-col items-center justify-center gap-4 p-6 text-center" style={{ height: 400 }}>
        <Navigation className="h-10 w-10 text-primary" />
        <div>
          <p className="font-semibold text-base">Приложение «Времонте» хочет получить доступ к вашему местоположению</p>
          <p className="text-sm text-muted-foreground mt-1">Чтобы показать заказы и мастеров рядом с вами</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { setStoredPermission('denied'); setGeoState('denied'); }}>Запретить</Button>
          <Button onClick={() => requestGeolocation()}>Разрешить</Button>
        </div>
      </div>
    );
  }

  if (geoState === 'denied' || geoState === 'error') {
    return (
      <div className="w-full rounded-xl border bg-card flex flex-col items-center justify-center gap-4 p-6 text-center" style={{ height: 400 }}>
        <MapPin className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground max-w-xs">
          Без геолокации карта не может показать заказы рядом. Разрешите доступ в настройках браузера или сбросьте разрешение в профиле.
        </p>
        {geoError && <p className="text-xs text-destructive">{geoError}</p>}
        <Button variant="outline" size="sm" onClick={() => requestGeolocation(true)}>
          Попробовать снова
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full rounded-xl border bg-muted/50 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground" style={{ height: 400 }}>
        <p>{error}</p>
        <Button size="sm" variant="outline" onClick={() => { setError(null); setCenter(prev => prev ? { ...prev } : prev); }}>
          Попробовать снова
        </Button>
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
      {!loading && mapInstanceRef.current && (
        <button
          onClick={handleLocateMe}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg flex items-center justify-center hover:bg-white active:bg-gray-100 transition-colors"
          style={{ width: 44, height: 44 }}
          title="Моё местоположение"
        >
          <Locate className="h-5 w-5 text-primary" />
        </button>
      )}
    </div>
  );
}

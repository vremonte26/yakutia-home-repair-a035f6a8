import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

const AREAS: { label: string; lat: number; lng: number }[] = [
  { label: 'Якутск — центр', lat: 62.0355, lng: 129.6755 },
  { label: 'Якутск — Залог', lat: 62.0150, lng: 129.6800 },
  { label: 'Якутск — ДСК', lat: 62.0560, lng: 129.7300 },
  { label: 'Якутск — Сайсары', lat: 62.0280, lng: 129.7100 },
  { label: 'Якутск — Птицефабрика', lat: 62.0750, lng: 129.6200 },
  { label: 'Якутск — Марха', lat: 62.0900, lng: 129.5500 },
  { label: 'Якутск — Жатай', lat: 62.1500, lng: 129.8200 },
  { label: 'Якутск — Гагарина', lat: 62.0400, lng: 129.7200 },
  { label: 'Якутск — Строительный', lat: 62.0480, lng: 129.6400 },
  { label: 'Нерюнгри', lat: 56.6574, lng: 124.7131 },
  { label: 'Мирный', lat: 62.5354, lng: 113.9610 },
  { label: 'Алдан', lat: 58.6077, lng: 125.3891 },
];

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

export function TaskMap({ mode }: TaskMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [geoState, setGeoState] = useState<GeoState>('asking');
  const [geoError, setGeoError] = useState<string | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [showUserPin, setShowUserPin] = useState(false);

  // Request geolocation
  const requestGeolocation = useCallback(() => {
    setLoading(true);
    setGeoError(null);
    console.log('[TaskMap] Запрос геолокации...');

    if (!navigator.geolocation) {
      console.error('[TaskMap] Геолокация недоступна в браузере');
      setGeoState('error');
      setGeoError('Геолокация недоступна в вашем браузере или устройстве');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        console.log(`[TaskMap] Геолокация получена: ${lat}, ${lng}`);
        setCenter({ lat, lng });
        setShowUserPin(true);
        setGeoState('granted');
        setLoading(false);
      },
      (err) => {
        console.error('[TaskMap] Ошибка геолокации:', err.message, 'code:', err.code);
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoState('denied');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGeoState('error');
          setGeoError('Геолокация недоступна. Проверьте, включена ли она в настройках устройства.');
        } else if (err.code === err.TIMEOUT) {
          setGeoState('error');
          setGeoError('Не удалось определить местоположение — истекло время ожидания. Попробуйте ещё раз.');
        } else {
          setGeoState('error');
          setGeoError('Не удалось определить местоположение.');
        }
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, []);

  const selectArea = useCallback((areaLabel: string) => {
    const area = AREAS.find(a => a.label === areaLabel);
    if (area) {
      console.log(`[TaskMap] Выбран район: ${area.label} (${area.lat}, ${area.lng})`);
      setCenter({ lat: area.lat, lng: area.lng });
      setShowUserPin(false);
      setGeoState('granted');
    }
  }, []);

  // Initialize map when center is set
  useEffect(() => {
    if (!user || !center) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const init = async () => {
      try {
        const { lat: userLat, lng: userLng } = center;

        // Get API key
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

        // Load Yandex Maps script with timeout and retry
        if (!window.ymaps3) {
          console.log('[TaskMap] Загрузка скрипта...');
          document.querySelectorAll('script[src*="api-maps.yandex.ru"]').forEach(s => s.remove());

          const loadScript = () => new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://api-maps.yandex.ru/v3/?apikey=${apiKey}&lang=ru_RU`;
            script.async = true;
            script.defer = true;

            const timeout = setTimeout(() => {
              script.onload = null;
              script.onerror = null;
              script.remove();
              reject(new Error('TIMEOUT'));
            }, 5000);

            script.onload = () => {
              clearTimeout(timeout);
              console.log('[TaskMap] Скрипт загружен');
              resolve();
            };
            script.onerror = () => {
              clearTimeout(timeout);
              script.remove();
              reject(new Error('SCRIPT_LOAD_FAILED'));
            };
            document.head.appendChild(script);
          });

          try {
            await loadScript();
          } catch (firstErr) {
            console.warn('[TaskMap] Первая попытка не удалась, повтор...', (firstErr as Error).message);
            if (cancelled) return;
            await loadScript();
          }
        }

        if (cancelled) return;

        console.log('[TaskMap] Инициализация карты...');
        await window.ymaps3.ready;

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

        console.log(`[TaskMap] Найдено ${points.length} точек`);

        // Create map
        const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = window.ymaps3;

        const map = new YMap(mapRef.current, {
          location: { center: [userLng, userLat], zoom: 11 },
        });

        map.addChild(new YMapDefaultSchemeLayer({}));
        map.addChild(new YMapDefaultFeaturesLayer({}));

        // User location pin (only if real geolocation)
        if (showUserPin) {
          const userEl = document.createElement('div');
          userEl.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 6px rgba(59,130,246,0.5);';
          map.addChild(new YMapMarker({ coordinates: [userLng, userLat] }, userEl));
        }

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
  }, [user, mode, center, showUserPin]);

  // Permission prompt
  if (geoState === 'asking') {
    return (
      <div className="w-full rounded-xl border bg-card flex flex-col items-center justify-center gap-4 p-6 text-center" style={{ height: 400 }}>
        <Navigation className="h-10 w-10 text-primary" />
        <div>
          <p className="font-semibold text-base">Приложение «Времонте» хочет получить доступ к вашему местоположению</p>
          <p className="text-sm text-muted-foreground mt-1">Чтобы показать заказы и мастеров рядом с вами</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setGeoState('denied')}>Запретить</Button>
          <Button onClick={requestGeolocation}>Разрешить</Button>
        </div>
      </div>
    );
  }

  // Denied / Error — manual area selection
  if (geoState === 'denied' || geoState === 'error') {
    return (
      <div className="w-full rounded-xl border bg-card flex flex-col items-center justify-center gap-4 p-6 text-center" style={{ height: 400 }}>
        <MapPin className="h-10 w-10 text-muted-foreground" />
        <div>
          {geoState === 'denied' ? (
            <p className="text-sm text-muted-foreground">Без геолокации карта не может показать заказы рядом. Вы можете выбрать район вручную</p>
          ) : (
            <p className="text-sm text-destructive">{geoError}</p>
          )}
        </div>
        <Select onValueChange={selectArea}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Выберите район" />
          </SelectTrigger>
          <SelectContent>
            {AREAS.map(a => (
              <SelectItem key={a.label} value={a.label}>{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={requestGeolocation}>
          Попробовать геолокацию снова
        </Button>
      </div>
    );
  }

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

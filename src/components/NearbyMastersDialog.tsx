import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserRating } from '@/components/UserRating';
import { CategoryBadge } from '@/components/CategoryBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getCurrentPosition, GEO_DENIED_MESSAGE } from '@/lib/geolocation';
import { useNavigate } from 'react-router-dom';
import { MapPin, Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface MasterRow {
  id: string;
  name: string;
  phone: string | null;
  photo: string | null;
  rating: number | null;
  categories: string[] | null;
  lat: number;
  lng: number;
  distance: number;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatDistance(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} м`;
  if (km < 10) return `${km.toFixed(1)} км`;
  return `${Math.round(km)} км`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NearbyMastersDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [masters, setMasters] = useState<MasterRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    setLoading(true);
    setError(null);
    setMasters(null);
    try {
      const { lat, lng } = await getCurrentPosition({ forcePrompt: true });

      const { data, error: dbError } = await supabase
        .from('profiles')
        .select('id, name, phone, photo, rating, categories, lat, lng, role, is_active')
        .eq('role', 'master')
        .eq('is_active', true)
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      if (dbError) throw dbError;

      const list: MasterRow[] = (data ?? [])
        .filter((m: any) => m.id !== user?.id && m.lat != null && m.lng != null)
        .map((m: any) => ({
          id: m.id,
          name: m.name,
          phone: m.phone,
          photo: m.photo,
          rating: m.rating,
          categories: m.categories,
          lat: m.lat,
          lng: m.lng,
          distance: haversineKm(lat, lng, m.lat, m.lng),
        }))
        .sort((a, b) => a.distance - b.distance);

      setMasters(list);
    } catch (e: any) {
      if (e?.message === 'geo_denied' || e?.message === 'geo_unsupported') {
        setError(GEO_DENIED_MESSAGE);
      } else {
        setError('Не удалось загрузить мастеров. Попробуйте ещё раз.');
        toast.error('Ошибка поиска');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    onOpenChange(v);
    if (v && !masters && !loading) {
      search();
    }
    if (!v) {
      setMasters(null);
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Мастера рядом</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button size="sm" variant="outline" onClick={search}>
              Повторить
            </Button>
          </div>
        )}

        {!loading && !error && masters && masters.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">
            Поблизости пока нет мастеров с указанными координатами.
          </p>
        )}

        {!loading && !error && masters && masters.length > 0 && (
          <div className="space-y-2">
            {masters.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/master/${m.id}`);
                }}
                className="w-full text-left rounded-lg border bg-card hover:shadow-md transition-shadow p-3 flex gap-3"
              >
                <Avatar className="h-12 w-12 shrink-0">
                  {m.photo && <AvatarImage src={m.photo} alt={m.name} />}
                  <AvatarFallback>{(m.name || '?').charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-sm leading-tight truncate">
                      {m.name || 'Мастер'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary shrink-0">
                      <MapPin className="h-3 w-3" />
                      {formatDistance(m.distance)}
                    </span>
                  </div>
                  <UserRating rating={m.rating} size="sm" showEmpty />
                  {m.categories && m.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {m.categories.slice(0, 3).map((c) => (
                        <CategoryBadge key={c} value={c} size="sm" />
                      ))}
                    </div>
                  )}
                  {m.phone && (
                    <a
                      href={`tel:${m.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                    >
                      <Phone className="h-3 w-3" />
                      {m.phone}
                    </a>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

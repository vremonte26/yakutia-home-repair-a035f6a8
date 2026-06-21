import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { MapPin, Phone, User, X, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CategoryBadge } from '@/components/CategoryBadge';

type Master = {
  id: string;
  name: string;
  phone: string;
  photo: string | null;
  categories: string[];
  about: string | null;
  rating: number | null;
  latitude: number | null;
  longitude: number | null;
  distance: number; // в километрах
  address: string;
};

type NearbyMastersListProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userLat: number | null;
  userLng: number | null;
  userAddress?: string;
};

export function NearbyMastersList({ open, onOpenChange, userLat, userLng, userAddress }: NearbyMastersListProps) {
  const { user } = useAuth();
  const [masters, setMasters] = useState<Master[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMaster, setSelectedMaster] = useState<Master | null>(null);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Радиус Земли в км
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  useEffect(() => {
    if (!open || !userLat || !userLng) return;

    const fetchMasters = async () => {
      setLoading(true);
      
      // Получаем всех мастеров с профилями
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, name, phone, photo, categories, about, rating, latitude, longitude')
        .eq('role', 'master')
        .eq('is_verified', true)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (error || !profiles) {
        setLoading(false);
        return;
      }

      // Вычисляем расстояние для каждого мастера
      const mastersWithDistance: Master[] = profiles
        .map((p: any) => {
          const distance = calculateDistance(
            userLat,
            userLng,
            p.latitude,
            p.longitude
          );
          return {
            id: p.id,
            name: p.name || 'Мастер',
            phone: p.phone || '',
            photo: p.photo || null,
            categories: p.categories || [],
            about: p.about || null,
            rating: p.rating || null,
            latitude: p.latitude,
            longitude: p.longitude,
            distance: Math.round(distance * 10) / 10,
            address: `${p.latitude?.toFixed(4)}, ${p.longitude?.toFixed(4)}`, // Примерный адрес
          };
        })
        .filter(m => m.distance <= 50) // Только в радиусе 50 км
        .sort((a, b) => a.distance - b.distance); // Сортировка по расстоянию

      setMasters(mastersWithDistance);
      setLoading(false);
    };

    fetchMasters();
  }, [open, userLat, userLng]);

  const handleMasterClick = (master: Master) => {
    setSelectedMaster(master);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Мастера рядом
            </DialogTitle>
            <DialogDescription>
              {userAddress ? `Рядом с ${userAddress}` : 'Мастера поблизости'}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : masters.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Нет мастеров поблизости</p>
              <p className="text-sm">Попробуйте расширить радиус поиска</p>
            </div>
          ) : (
            <div className="space-y-3">
              {masters.map((master) => (
                <Card
                  key={master.id}
                  className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleMasterClick(master)}
                >
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 shrink-0">
                        <AvatarImage src={master.photo || ''} />
                        <AvatarFallback>{getInitials(master.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm truncate">{master.name}</span>
                          {master.rating && (
                            <span className="text-xs text-amber-500">★ {master.rating.toFixed(1)}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {master.categories.slice(0, 3).map(cat => (
                            <CategoryBadge key={cat} value={cat} size="sm" />
                          ))}
                          {master.categories.length > 3 && (
                            <span className="text-xs text-muted-foreground">+{master.categories.length - 3}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span>~{master.distance} км от вас</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Диалог с деталями мастера */}
      <Dialog open={!!selectedMaster} onOpenChange={() => setSelectedMaster(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {selectedMaster?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedMaster && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedMaster.photo || ''} />
                  <AvatarFallback>{getInitials(selectedMaster.name)}</AvatarFallback>
                </Avatar>
                <div>
                  {selectedMaster.rating && (
                    <div className="text-sm text-amber-500">★ {selectedMaster.rating.toFixed(1)}</div>
                  )}
                  <div className="text-xs text-muted-foreground">~{selectedMaster.distance} км от вас</div>
                </div>
              </div>

              {selectedMaster.categories.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedMaster.categories.map(cat => (
                    <CategoryBadge key={cat} value={cat} size="sm" />
                  ))}
                </div>
              )}

              {selectedMaster.about && (
                <p className="text-sm text-muted-foreground">{selectedMaster.about}</p>
              )}

              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>📍 Примерный адрес: {selectedMaster.address}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>📞 {selectedMaster.phone || 'Телефон не указан'}</span>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => {
                  // Здесь можно добавить действие: позвонить или написать в чат
                  if (selectedMaster.phone) {
                    window.location.href = `tel:${selectedMaster.phone}`;
                  }
                }}
              >
                <Phone className="h-4 w-4 mr-2" />
                Позвонить мастеру
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

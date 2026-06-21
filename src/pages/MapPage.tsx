import { useState, useEffect } from 'react';
import { TaskMap } from '@/components/TaskMap';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import { NearbyMastersList } from '@/components/NearbyMastersList';

export default function MapPage() {
  const { profile, user } = useAuth();
  const mode = profile?.role === 'master' ? 'master' : 'client';
  
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [userAddress, setUserAddress] = useState<string>('');

  // Получаем геолокацию пользователя
  useEffect(() => {
    if (!user) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLat(position.coords.latitude);
          setUserLng(position.coords.longitude);
          
          // Обратный геокодинг для получения адреса
          fetch(`https://geocode-maps.yandex.ru/1.x/?apikey=ВАШ_КЛЮЧ&geocode=${position.coords.longitude},${position.coords.latitude}&format=json`)
            .then(res => res.json())
            .then(data => {
              const address = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.name || '';
              setUserAddress(address);
            })
            .catch(() => {});
        },
        (error) => {
          console.error('Ошибка геолокации:', error);
        },
        { enableHighAccuracy: true }
      );
    }
  }, [user]);

  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold">Карта заказов</h1>
          <Button 
            size="sm" 
            onClick={() => setNearbyOpen(true)}
            disabled={!userLat || !userLng}
          >
            <Users className="h-4 w-4 mr-1" />
            Мастера рядом
          </Button>
        </div>
        <TaskMap mode={mode} />
      </div>

      <NearbyMastersList
        open={nearbyOpen}
        onOpenChange={setNearbyOpen}
        userLat={userLat}
        userLng={userLng}
        userAddress={userAddress}
      />
    </AppLayout>
  );
}

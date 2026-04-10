import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORIES, WORK_AREAS } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { MapPin, Check, Loader2 } from 'lucide-react';

export default function CreateTask() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [workArea, setWorkArea] = useState('');

  const geocodeAddress = async () => {
    if (!address.trim()) return;
    setGeocoding(true);
    setGeocodeError(null);
    setCoords(null);

    console.log('[CreateTask] geocodeAddress called, address:', address.trim());

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      console.log('[CreateTask] session token present:', !!token);
      if (!token) throw new Error('No session');

      console.log('[CreateTask] invoking geocode-address edge function...');
      const res = await supabase.functions.invoke('geocode-address', {
        body: { address: address.trim() },
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log('[CreateTask] geocode-address response:', JSON.stringify(res.data));
      console.log('[CreateTask] geocode-address error:', res.error);

      if (res.error || res.data?.error) {
        const errMsg = res.data?.message;
        const fullAddr = res.data?.fullAddress;
        console.error('[CreateTask] geocode error:', res.data?.error, errMsg, 'fullAddress:', fullAddr);
        if (errMsg) {
          setGeocodeError(errMsg);
        } else {
          setGeocodeError(res.data?.error || res.error?.message || 'Ошибка геокодирования');
        }
        return;
      }

      console.log(`Координаты получены: lat=${res.data.lat}, lng=${res.data.lng}`);
      setCoords({ lat: res.data.lat, lng: res.data.lng });
    } catch (err: any) {
      console.error('[CreateTask] geocode exception:', err);
      setGeocodeError(err.message || 'Ошибка геокодирования');
    } finally {
      setGeocoding(false);
    }
  };

  const handleAddressBlur = () => {
    if (address.trim() && !coords) {
      geocodeAddress();
    }
  };

  const handleAddressChange = (val: string) => {
    setAddress(val);
    setCoords(null);
    setGeocodeError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!coords) {
      if (!address.trim()) {
        toast({ title: 'Введите адрес', variant: 'destructive' });
      } else {
        await geocodeAddress();
        if (!coords) {
          toast({ title: 'Не удалось определить координаты. Уточните адрес', variant: 'destructive' });
        }
      }
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('tasks').insert({
      client_id: user.id,
      title,
      description,
      category,
      address,
      address_full: address,
      address_area: workArea || null,
      lat: coords.lat,
      lng: coords.lng,
      work_area: workArea || null,
    } as any);
    setLoading(false);
    if (error) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Заказ создан!' });
    navigate('/');
  };

  return (
    <div className="animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-extrabold">Новый заказ</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Заголовок</label>
              <Input
                placeholder="Напр: Установить смеситель"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Категория</label>
              <Select value={category} onValueChange={setCategory} required>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Район <span className="text-destructive">*</span></label>
              <Select value={workArea} onValueChange={setWorkArea} required>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите район" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_AREAS.map(area => (
                    <SelectItem key={area} value={area}>{area}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Описание</label>
              <Textarea
                placeholder="Опишите задачу подробнее..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Адрес <span className="text-destructive">*</span></label>
              <div className="relative">
                <Input
                  placeholder="Город, улица, дом"
                  value={address}
                  onChange={e => handleAddressChange(e.target.value)}
                  onBlur={handleAddressBlur}
                  required
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {geocoding && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {coords && <Check className="h-4 w-4 text-green-500" />}
                  {!geocoding && !coords && address.trim() && (
                    <button type="button" onClick={geocodeAddress} className="text-muted-foreground hover:text-foreground">
                      <MapPin className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              {geocodeError && (
                <p className="text-xs text-destructive">{geocodeError}</p>
              )}
              {coords && (
                <p className="text-xs text-green-600 font-medium">✅ Координаты получены: lat={coords.lat}, lng={coords.lng}</p>
              )}
              {geocodeError && (
                <p className="text-xs text-destructive font-medium">❌ Ошибка геокодирования: {geocodeError}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading || !category || !workArea || geocoding}>
              {loading ? 'Создание...' : 'Создать заказ'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

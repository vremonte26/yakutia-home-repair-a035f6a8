import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORIES } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { MapPin, Check, Loader2, X, ImagePlus } from 'lucide-react';

export default function CreateTask() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('phone').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (data?.phone) setPhone(data.phone);
    });
  }, [user]);

  const geocodeAddress = async () => {
    if (!address.trim()) return;
    setGeocoding(true);
    setGeocodeError(null);
    setCoords(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('No session');

      const res = await supabase.functions.invoke('geocode-address', {
        body: { address: address.trim() },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error || res.data?.error) {
        const errMsg = res.data?.message;
        setGeocodeError(errMsg || 'Адрес не найден. Проверьте правильность написания или выберите на карте');
        return;
      }

      setCoords({ lat: res.data.lat, lng: res.data.lng });
    } catch {
      setGeocodeError('Адрес не найден. Проверьте правильность написания или выберите на карте');
    } finally {
      setGeocoding(false);
    }
  };

  const handleAddressBlur = () => {
    if (address.trim() && !coords) geocodeAddress();
  };

  const handleAddressChange = (val: string) => {
    setAddress(val);
    setCoords(null);
    setGeocodeError(null);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;
    setUploadingPhoto(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop();
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from('task-photos').upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage.from('task-photos').getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
      setPhotos(prev => [...prev, ...uploaded]);
    } catch (err: any) {
      toast({ title: 'Ошибка загрузки фото', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = (url: string) => {
    setPhotos(prev => prev.filter(p => p !== url));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!phone.trim()) {
      toast({ title: 'Укажите телефон', variant: 'destructive' });
      return;
    }

    if (!coords) {
      if (!address.trim()) {
        toast({ title: 'Введите адрес', variant: 'destructive' });
      } else {
        await geocodeAddress();
        if (!coords) {
          toast({ title: 'Адрес не найден. Проверьте правильность написания или выберите на карте', variant: 'destructive' });
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
      lat: coords.lat,
      lng: coords.lng,
      price: price.trim() ? Number(price) : null,
      phone: phone.trim(),
      photos,
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
            {/* 1. Категория */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Категория <span className="text-destructive">*</span></label>
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

            {/* 2. Заголовок */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Заголовок <span className="text-destructive">*</span></label>
              <Input
                placeholder="Напр: Заменить смеситель"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>

            {/* 3. Описание */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Описание <span className="text-destructive">*</span></label>
              <Textarea
                placeholder="Опишите подробно, что нужно сделать..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                required
              />
            </div>

            {/* 4. Цена */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Стоимость, ₽</label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Оставьте пустым — договорная"
                value={price}
                onChange={e => setPrice(e.target.value)}
                min="0"
              />
              <p className="text-xs text-muted-foreground">Если не указано — цена договорная</p>
            </div>

            {/* 5. Адрес */}
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
              {geocodeError && <p className="text-xs text-destructive font-medium">{geocodeError}</p>}
              {coords && <p className="text-xs text-green-600 font-medium">✅ Адрес найден</p>}
            </div>

            {/* Телефон */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Телефон <span className="text-destructive">*</span></label>
              <Input
                type="tel"
                placeholder="+7 ..."
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">Будет виден только выбранному мастеру</p>
            </div>

            {/* 6. Фото */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Фото <span className="text-muted-foreground text-xs">(необязательно)</span></label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="w-full"
              >
                {uploadingPhoto ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Загрузка...</>
                ) : (
                  <><ImagePlus className="h-4 w-4 mr-2" /> Добавить фото</>
                )}
              </Button>
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {photos.map(url => (
                    <div key={url} className="relative aspect-square">
                      <img src={url} alt="Фото заказа" className="w-full h-full object-cover rounded-md border" />
                      <button
                        type="button"
                        onClick={() => removePhoto(url)}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow"
                        aria-label="Удалить фото"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading || !category || geocoding || uploadingPhoto}>
              {loading ? 'Создание...' : 'Создать заказ'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

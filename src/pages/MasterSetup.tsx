import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { CATEGORIES } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, X } from 'lucide-react';

export default function MasterSetup() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<string[]>([]);
  
  const [about, setAbout] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState(profile?.name || '');
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Block verified masters from editing setup
  if (profile?.is_verified === true) {
    return (
      <div className="p-6 text-center space-y-4">
        <Card>
          <CardContent className="p-6 space-y-2">
            <CardTitle className="text-lg">Данные подтверждены</CardTitle>
            <CardDescription>
              Ваш профиль мастера подтверждён модератором. Для изменения данных обратитесь в поддержку.
            </CardDescription>
            <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Назад
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const toggleCategory = (val: string) => {
    setCategories(prev =>
      prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val]
    );
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Выберите изображение', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Максимальный размер — 2 МБ', variant: 'destructive' });
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) {
      toast({ title: 'Введите имя', variant: 'destructive' });
      return;
    }
    if (!photoFile) {
      toast({ title: 'Загрузите фото', variant: 'destructive' });
      return;
    }
    if (categories.length === 0) {
      toast({ title: 'Выберите хотя бы одну категорию', variant: 'destructive' });
      return;
    }
    setLoading(true);

    try {
      // Upload photo
      const ext = photoFile.name.split('.').pop();
      const filePath = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, photoFile, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      const photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const bypassModeration = import.meta.env.VITE_BYPASS_MODERATION === 'true';

      const { error } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          role: 'master' as const,
          categories,
          about,
          phone: phone || undefined,
          photo: photoUrl,
          is_verified: bypassModeration ? true : false,
          is_photo_moderated: bypassModeration ? true : false,
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      if (bypassModeration) {
        toast({ title: 'Вы теперь мастер!' });
        navigate('/');
      } else {
        navigate('/moderation-pending');
      }
    } catch (err: any) {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-lg animate-fade-in">
        <CardHeader>
          <button
            type="button"
            onClick={() => navigate('/role-selection')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад
          </button>
          <CardTitle className="text-xl font-extrabold">Анкета мастера</CardTitle>
          <CardDescription>Заполните анкету для прохождения модерации</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Фото <span className="text-destructive">*</span></label>
              <div className="flex items-center gap-4">
                {photoPreview ? (
                  <div className="relative group">
                    <img
                      src={photoPreview}
                      alt="Превью"
                      className="w-20 h-20 rounded-2xl object-cover"
                    />
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-2xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <Camera className="h-6 w-6" />
                    <span className="text-xs">Загрузить</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ваше имя</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ваше имя"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Телефон для связи</label>
              <Input
                placeholder="+7 (___) ___-__-__"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Категории работ</label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map(cat => (
                  <label
                    key={cat.value}
                    className="flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer hover:bg-accent transition-colors"
                  >
                    <Checkbox
                      checked={categories.includes(cat.value)}
                      onCheckedChange={() => toggleCategory(cat.value)}
                    />
                    <span className="text-sm">
                      {cat.icon} {cat.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>


            <div className="space-y-2">
              <label className="text-sm font-medium">О себе</label>
              <Textarea
                placeholder="Опыт работы, специализация, доступность..."
                value={about}
                onChange={e => setAbout(e.target.value)}
                rows={3}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Отправка...' : 'Отправить на модерацию'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

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
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Camera, X, Shield, FileText } from 'lucide-react';
import { compressImageSafe } from '@/lib/imageCompression';

export default function MasterSetup() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [categories, setCategories] = useState<string[]>([]);
  
  const [about, setAbout] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState(profile?.name || '');
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Фото паспорта
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [passportPreview, setPassportPreview] = useState<string | null>(null);
  const passportInputRef = useRef<HTMLInputElement>(null);
  
  // Селфи с паспортом
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  
  // Согласие на обработку ПДн
  const [consentGiven, setConsentGiven] = useState(false);

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
            <Button variant="outline" className="mt-4" onClick={() => {
              const from = location.state?.from || '/';
              navigate(from);
            }}>
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

  const handlePassportSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Выберите изображение', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Максимальный размер — 5 МБ', variant: 'destructive' });
      return;
    }
    setPassportFile(file);
    setPassportPreview(URL.createObjectURL(file));
  };

  const handleSelfieSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePassport = () => {
    setPassportFile(null);
    setPassportPreview(null);
    if (passportInputRef.current) passportInputRef.current.value = '';
  };

  const removeSelfie = () => {
    setSelfieFile(null);
    setSelfiePreview(null);
    if (selfieInputRef.current) selfieInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) {
      toast({ title: 'Введите имя', variant: 'destructive' });
      return;
    }
    if (!photoFile) {
      toast({ title: 'Загрузите фото профиля', variant: 'destructive' });
      return;
    }
    if (!passportFile) {
      toast({ title: 'Загрузите фото паспорта', variant: 'destructive' });
      return;
    }
    if (!selfieFile) {
      toast({ title: 'Сделайте селфи с паспортом', variant: 'destructive' });
      return;
    }
    if (categories.length === 0) {
      toast({ title: 'Выберите хотя бы одну категорию', variant: 'destructive' });
      return;
    }
    if (!consentGiven) {
      toast({ title: 'Дайте согласие на обработку персональных данных', variant: 'destructive' });
      return;
    }
    setLoading(true);

    try {
      // 1. Загружаем аватарку
      let compressionFailed = false;
      const toUpload = await compressImageSafe(photoFile, undefined, () => {
        compressionFailed = true;
      });
      if (compressionFailed) {
        toast({ title: 'Не удалось сжать фото — загружаем оригинал' });
      }
      const avatarExt = (toUpload instanceof File ? toUpload.name : photoFile.name).split('.').pop();
      const avatarPath = `${user.id}/avatar.${avatarExt}`;
      const { error: avatarError } = await supabase.storage
        .from('avatars')
        .upload(avatarPath, toUpload, { upsert: true, contentType: toUpload.type });
      if (avatarError) throw avatarError;
      const { data: avatarUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(avatarPath);
      const photoUrl = `${avatarUrlData.publicUrl}?t=${Date.now()}`;

      // 2. Загружаем фото паспорта
      const passportExt = passportFile.name.split('.').pop();
      const passportPath = `${user.id}/passport.${passportExt}`;
      const { error: passportError } = await supabase.storage
        .from('master_documents')
        .upload(passportPath, passportFile, { upsert: true, contentType: passportFile.type });
      if (passportError) throw passportError;
      const { data: passportUrlData } = supabase.storage
        .from('master_documents')
        .getPublicUrl(passportPath);
      const passportUrl = passportUrlData.publicUrl;

      // 3. Загружаем селфи с паспортом
      const selfieExt = selfieFile.name.split('.').pop();
      const selfiePath = `${user.id}/selfie.${selfieExt}`;
      const { error: selfieError } = await supabase.storage
        .from('master_documents')
        .upload(selfiePath, selfieFile, { upsert: true, contentType: selfieFile.type });
      if (selfieError) throw selfieError;
      const { data: selfieUrlData } = supabase.storage
        .from('master_documents')
        .getPublicUrl(selfiePath);
      const selfieUrl = selfieUrlData.publicUrl;

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
          passport_photo: passportUrl,
          selfie_photo: selfieUrl,
          is_verified: bypassModeration ? true : false,
          is_photo_moderated: bypassModeration ? true : false,
          consent_given: true,
          consent_date: new Date().toISOString(),
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
            onClick={() => {
              const from = location.state?.from || '/';
              navigate(from);
            }}
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
              <label className="text-sm font-medium">Фото профиля <span className="text-destructive">*</span></label>
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
              <label className="text-sm font-medium">Ваше имя <span className="text-destructive">*</span></label>
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
              <label className="text-sm font-medium">Категории работ <span className="text-destructive">*</span></label>
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

            {/* Фото паспорта */}
            <div className="space-y-2 border-t pt-4">
              <label className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Фото паспорта (разворот с фото и пропиской) <span className="text-destructive">*</span>
              </label>
              <div className="flex items-center gap-4">
                {passportPreview ? (
                  <div className="relative group">
                    <img
                      src={passportPreview}
                      alt="Паспорт"
                      className="w-20 h-20 rounded-2xl object-cover"
                    />
                    <button
                      type="button"
                      onClick={removePassport}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => passportInputRef.current?.click()}
                    className="w-20 h-20 rounded-2xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <Camera className="h-6 w-6" />
                    <span className="text-xs">Загрузить</span>
                  </button>
                )}
                <input
                  ref={passportInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePassportSelect}
                />
                <span className="text-xs text-muted-foreground">Макс. 5 МБ</span>
              </div>
            </div>

            {/* Селфи с паспортом */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Селфи с паспортом в руках <span className="text-destructive">*</span>
              </label>
              <div className="flex items-center gap-4">
                {selfiePreview ? (
                  <div className="relative group">
                    <img
                      src={selfiePreview}
                      alt="Селфи с паспортом"
                      className="w-20 h-20 rounded-2xl object-cover"
                    />
                    <button
                      type="button"
                      onClick={removeSelfie}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => selfieInputRef.current?.click()}
                    className="w-20 h-20 rounded-2xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <Camera className="h-6 w-6" />
                    <span className="text-xs">Селфи</span>
                  </button>
                )}
                <input
                  ref={selfieInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleSelfieSelect}
                />
                <span className="text-xs text-muted-foreground">Макс. 2 МБ</span>
              </div>
            </div>

            {/* Согласие на обработку ПДн */}
            <div className="space-y-2 border-t pt-4">
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={consentGiven}
                  onCheckedChange={(v) => setConsentGiven(v === true)}
                  className="mt-0.5"
                />
                <span className="text-muted-foreground leading-snug">
                  Я даю согласие на обработку моих персональных данных, включая паспортные данные и биометрические данные (фото, селфи), в соответствии с Федеральным законом № 152-ФЗ «О персональных данных» <span className="text-destructive">*</span>
                </span>
              </label>
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

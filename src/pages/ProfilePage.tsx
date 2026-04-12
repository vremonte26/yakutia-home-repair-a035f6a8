import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CategoryBadge, deduplicateCategories } from '@/components/CategoryBadge';
import { UserRating } from '@/components/UserRating';
import { LogOut, ArrowLeftRight, MapPin, Phone, Clock, X, Trash2, Pencil, Camera, Check, LocateOff } from 'lucide-react';
import ClickableAvatar from '@/components/ClickableAvatar';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function ProfilePage() {
  const { profile, signOut, refreshProfile, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showPendingNotice, setShowPendingNotice] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('reviews')
      .select('id')
      .eq('to_user', user.id)
      .then(({ data }) => setReviewCount(data?.length ?? 0));
  }, [user]);

  if (!profile) return null;

  const isMaster = profile.role === 'master';

  const isVerifiedMaster = isMaster && profile.is_verified === true;

  const startEditing = () => {
    if (isVerifiedMaster) {
      toast({ title: 'Данные подтверждены модератором. Для изменений обратитесь в поддержку', variant: 'destructive' });
      return;
    }
    setEditName(profile.name || '');
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditName('');
  };

  const saveProfile = async () => {
    if (!user) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      toast({ title: 'Имя не может быть пустым', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name: trimmed })
      .eq('id', user.id);
    setIsSaving(false);
    if (error) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
      return;
    }
    await refreshProfile();
    setIsEditing(false);
    toast({ title: 'Имя обновлено' });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (profile?.is_photo_moderated || (isMaster && profile?.is_verified === true)) {
      toast({ title: 'Данные подтверждены модератором. Для изменений обратитесь в поддержку', variant: 'destructive' });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Выберите изображение', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Максимальный размер — 2 МБ', variant: 'destructive' });
      return;
    }

    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ photo: photoUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      toast({ title: 'Фото обновлено' });
    } catch (err: any) {
      toast({ title: 'Ошибка загрузки', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const switchRole = async () => {
    if (!user) return;

    if (isMaster) {
      await supabase.from('profiles').update({ role: 'client' as const }).eq('id', user.id);
      await refreshProfile();
      toast({ title: 'Вы теперь клиент' });
      navigate('/');
    } else {
      if (profile.is_verified === null) {
        navigate('/master-setup');
      } else if (profile.is_verified === false) {
        setShowPendingNotice(true);
      } else {
        await supabase.from('profiles').update({ role: 'master' as const }).eq('id', user.id);
        await refreshProfile();
        toast({ title: 'Вы теперь мастер' });
        navigate('/');
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('No session');

      const res = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error) throw res.error;

      await supabase.auth.signOut();
      navigate('/auth');
      toast({
        title: 'Аккаунт удалён',
        description: 'Ваш аккаунт успешно удалён. Вы можете зарегистрироваться снова в любое время.',
      });
    } catch (err: any) {
      toast({ title: 'Ошибка', description: err.message || 'Не удалось удалить аккаунт', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {showPendingNotice && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-accent flex items-center justify-center">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base">Анкета на проверке</h3>
              <p className="text-muted-foreground text-sm">
                Ваша анкета на проверке. Обычно это занимает до 24 часов. Мы сообщим, когда всё будет готово.
              </p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setShowPendingNotice(false)}>
              <X className="h-4 w-4 mr-2" />
              Закрыть
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-extrabold">Профиль</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <ClickableAvatar src={profile.photo} name={profile.name} size="lg" />
              {!isVerifiedMaster && !profile.is_photo_moderated && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute inset-0 rounded-2xl bg-foreground/0 hover:bg-foreground/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Camera className="h-5 w-5 text-background" />
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="h-9"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && saveProfile()}
                  />
                  <Button size="icon" variant="ghost" onClick={saveProfile} disabled={isSaving} className="shrink-0">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={cancelEditing} className="shrink-0">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg truncate">{profile.name || 'Без имени'}</h2>
                  {!isVerifiedMaster && (
                    <button type="button" onClick={startEditing} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
              <Badge variant={isMaster ? 'default' : 'secondary'}>
                {isMaster ? '🔧 Мастер' : '👤 Клиент'}
              </Badge>
            </div>
          </div>

          {profile.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              {profile.phone}
            </div>
          )}

          <UserRating rating={profile.rating} reviewCount={reviewCount} size="md" showEmpty />


          {isMaster && profile.categories && profile.categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {deduplicateCategories(profile.categories).map(cat => (
                <CategoryBadge key={cat} value={cat} size="sm" />
              ))}
            </div>
          )}

          {isMaster && profile.about && (
            <p className="text-sm text-muted-foreground">{profile.about}</p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Button variant="outline" className="w-full" onClick={switchRole}>
          <ArrowLeftRight className="h-4 w-4 mr-2" />
          {isMaster ? 'Стать клиентом' : 'Стать мастером'}
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            localStorage.removeItem('geo_permission');
            toast({ title: 'Разрешение на геолокацию сброшено. При следующем открытии карты браузер запросит его снова.' });
          }}
        >
          <LocateOff className="h-4 w-4 mr-2" />
          Сбросить разрешение геолокации
        </Button>
        <Button variant="destructive" className="w-full" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Выйти
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4 mr-2" />
              Удалить аккаунт
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
              <AlertDialogDescription>
                Все ваши данные (профиль, заказы, отклики, чаты) будут безвозвратно удалены. Это действие нельзя отменить.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? 'Удаление...' : 'Удалить навсегда'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

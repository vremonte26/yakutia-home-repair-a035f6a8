import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CategoryBadge } from '@/components/CategoryBadge';
import { LogOut, ArrowLeftRight, Star, MapPin, Phone, Clock, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export default function ProfilePage() {
  const { profile, signOut, refreshProfile, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showPendingNotice, setShowPendingNotice] = useState(false);

  if (!profile) return null;

  const isMaster = profile.role === 'master';

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
                Ваша анкета на проверке. Обычно это занимает до 24 часов. Мы сообщим, когда всё готово.
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
            <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center text-2xl font-bold text-accent-foreground">
              {profile.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <h2 className="font-bold text-lg">{profile.name || 'Без имени'}</h2>
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

          {isMaster && profile.rating !== null && profile.rating > 0 && (
            <div className="flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 text-primary fill-primary" />
              <span className="font-semibold">{profile.rating}</span>
            </div>
          )}

          {isMaster && profile.work_area && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {profile.work_area}
            </div>
          )}

          {isMaster && profile.categories && profile.categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {profile.categories.map(cat => (
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
        <Button variant="destructive" className="w-full" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Выйти
        </Button>
      </div>
    </div>
  );
}

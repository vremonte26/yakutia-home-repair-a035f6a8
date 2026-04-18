import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserRating } from '@/components/UserRating';
import ClickableAvatar from '@/components/ClickableAvatar';
import { ReviewThread } from '@/components/ReviewThread';
import { ArrowLeft } from 'lucide-react';

export default function ClientProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: p }, { data: rs }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('reviews')
          .select('id', { count: 'exact', head: false })
          .eq('to_user', id)
          .is('parent_id', null)
          .eq('is_hidden', false),
      ]);
      setProfile(p);
      setReviewCount(rs?.length ?? 0);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Профиль не найден</p>
        <Button variant="link" onClick={() => navigate(-1)}>Назад</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      <div className="sticky top-14 z-30 -mx-4 px-4 py-2 bg-background/90 backdrop-blur-md border-b shadow-sm">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Назад
        </Button>
      </div>

      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex flex-col items-center text-center space-y-3">
            <ClickableAvatar src={profile.photo} name={profile.name} size="lg" className="!w-28 !h-28" />
            <div className="space-y-1">
              <h1 className="text-xl font-bold">{profile.name || 'Клиент'}</h1>
              <UserRating rating={profile.rating ?? null} reviewCount={reviewCount} size="md" showEmpty />
              <p className="text-xs text-muted-foreground">
                {reviewCount === 0 ? '0 отзывов' : `${reviewCount} ${reviewCount === 1 ? 'отзыв' : reviewCount < 5 ? 'отзыва' : 'отзывов'}`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">Отзывы мастеров</CardTitle>
        </CardHeader>
        <CardContent>
          <ReviewThread profileUserId={profile.id} emptyText="Нет отзывов" />
        </CardContent>
      </Card>
    </div>
  );
}

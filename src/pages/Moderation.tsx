import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EyeOff, Eye, Check, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface ComplaintRow {
  id: string;
  reason: string;
  status: string;
  created_at: string;
  from_user: string;
  to_user: string;
  review_id: string | null;
  moderator_note: string | null;
}

export default function Moderation() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [reviews, setReviews] = useState<Record<string, any>>({});
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (profile && (profile.role as string) !== 'moderator') {
      navigate('/');
    }
  }, [profile, navigate]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: cs } = await supabase
        .from('complaints')
        .select('*')
        .order('created_at', { ascending: false });
      const list = (cs ?? []) as ComplaintRow[];

      const reviewIds = Array.from(new Set(list.map(c => c.review_id).filter(Boolean) as string[]));
      const userIds = Array.from(new Set(list.flatMap(c => [c.from_user, c.to_user])));

      const [{ data: revs }, { data: profs }] = await Promise.all([
        reviewIds.length > 0
          ? supabase.from('reviews').select('*').in('id', reviewIds)
          : Promise.resolve({ data: [] as any[] }),
        userIds.length > 0
          ? supabase.from('profiles').select('id, name').in('id', userIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const rmap: Record<string, any> = {};
      (revs ?? []).forEach((r: any) => { rmap[r.id] = r; });
      const pmap: Record<string, any> = {};
      (profs ?? []).forEach((p: any) => { pmap[p.id] = p; });

      setComplaints(list);
      setReviews(rmap);
      setProfiles(pmap);
      setLoading(false);
    })();
  }, [refreshKey]);

  const hideReview = async (c: ComplaintRow) => {
    if (!c.review_id) return;
    const reason = window.prompt('Причина скрытия (для журнала):', 'Нарушение правил');
    if (!reason) return;
    await supabase.from('reviews').update({ is_hidden: true, hidden_reason: reason }).eq('id', c.review_id);
    await supabase.from('complaints').update({ status: 'resolved', moderator_note: 'Отзыв скрыт: ' + reason, resolved_at: new Date().toISOString() }).eq('id', c.id);
    toast({ title: 'Отзыв скрыт, жалоба закрыта' });
    setRefreshKey(k => k + 1);
  };

  const restoreReview = async (c: ComplaintRow) => {
    if (!c.review_id) return;
    await supabase.from('reviews').update({ is_hidden: false, hidden_reason: null }).eq('id', c.review_id);
    setRefreshKey(k => k + 1);
  };

  const dismissComplaint = async (c: ComplaintRow) => {
    await supabase.from('complaints').update({ status: 'dismissed', moderator_note: 'Нарушений не выявлено', resolved_at: new Date().toISOString() }).eq('id', c.id);
    toast({ title: 'Жалоба отклонена' });
    setRefreshKey(k => k + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const statusVariant = (s: string) => s === 'new' ? 'destructive' : s === 'resolved' ? 'default' : 'secondary';
  const statusLabel = (s: string) => s === 'new' ? 'Новая' : s === 'resolved' ? 'Решена' : 'Отклонена';

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      <h1 className="text-xl font-extrabold">Модерация жалоб</h1>

      {complaints.length === 0 ? (
        <p className="text-sm text-muted-foreground">Жалоб пока нет</p>
      ) : (
        complaints.map(c => {
          const review = c.review_id ? reviews[c.review_id] : null;
          const fromName = profiles[c.from_user]?.name || 'Пользователь';
          const toName = profiles[c.to_user]?.name || 'Пользователь';
          return (
            <Card key={c.id}>
              <CardHeader className="pb-2 flex-row items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold">
                  {fromName} → жалуется на {toName}
                </CardTitle>
                <Badge variant={statusVariant(c.status) as any}>{statusLabel(c.status)}</Badge>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ru })}
                </p>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Причина жалобы</p>
                  <p>{c.reason}</p>
                </div>
                {review && (
                  <div className="rounded-md border bg-muted/30 p-2 space-y-1">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Спорный отзыв {review.is_hidden && '(скрыт)'}</p>
                    {review.rating > 0 && <p className="text-xs">Оценка: {review.rating}★</p>}
                    {review.comment && <p>{review.comment}</p>}
                  </div>
                )}
                {c.moderator_note && (
                  <p className="text-xs text-muted-foreground italic">Решение: {c.moderator_note}</p>
                )}
                {c.status === 'new' && c.review_id && (
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="destructive" onClick={() => hideReview(c)} className="gap-1">
                      <EyeOff className="h-3.5 w-3.5" /> Скрыть отзыв
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => dismissComplaint(c)} className="gap-1">
                      <X className="h-3.5 w-3.5" /> Отклонить жалобу
                    </Button>
                  </div>
                )}
                {c.status === 'resolved' && review?.is_hidden && (
                  <Button size="sm" variant="outline" onClick={() => restoreReview(c)} className="gap-1">
                    <Eye className="h-3.5 w-3.5" /> Восстановить отзыв
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

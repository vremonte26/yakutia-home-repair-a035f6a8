import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CategoryBadge, deduplicateCategories } from '@/components/CategoryBadge';
import { UserRating } from '@/components/UserRating';
import ClickableAvatar from '@/components/ClickableAvatar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ReviewThread } from '@/components/ReviewThread';
import { ArrowLeft, Phone, CheckCircle } from 'lucide-react';

interface MasterReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  from_user: string;
  reviewer_name?: string;
}

export default function MasterProfile() {
  const { id: masterId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get('task');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [master, setMaster] = useState<any>(null);
  const [reviews, setReviews] = useState<MasterReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<any>(null);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [acceptedMasterId, setAcceptedMasterId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!masterId) return;

      const [{ data: mData }, { data: rData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', masterId).maybeSingle(),
        supabase
          .from('reviews')
          .select('id, rating, comment, created_at, from_user')
          .eq('to_user', masterId)
          .order('created_at', { ascending: false }),
      ]);

      setMaster(mData);

      const reviewerIds = [...new Set((rData ?? []).map((r: any) => r.from_user))];
      const reviewerMap: Record<string, string> = {};
      if (reviewerIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', reviewerIds);
        (profs ?? []).forEach((p: any) => { reviewerMap[p.id] = p.name; });
      }
      setReviews(((rData ?? []) as any[]).map(r => ({ ...r, reviewer_name: reviewerMap[r.from_user] || 'Клиент' })));

      if (taskId) {
        const { data: taskData } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', taskId)
          .maybeSingle();
        setTask(taskData);

        const { data: resps } = await supabase
          .from('responses')
          .select('id, master_id, status')
          .eq('task_id', taskId);

        const mineForMaster = (resps ?? []).find((r: any) => r.master_id === masterId);
        setResponseId(mineForMaster?.id ?? null);
        const accepted = (resps ?? []).find((r: any) => r.status === 'accepted');
        setAcceptedMasterId(accepted?.master_id ?? null);
      }

      setLoading(false);
    };

    fetchData();
  }, [masterId, taskId]);

  const handleSelect = async () => {
    if (!responseId || !taskId) return;
    setActionLoading(true);
    try {
      await supabase.from('responses').update({ status: 'accepted' }).eq('id', responseId);
      await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', taskId);
      toast({ title: 'Мастер выбран!' });
      navigate(`/task/${taskId}`);
    } catch (e: any) {
      toast({ title: 'Ошибка', description: e.message, variant: 'destructive' });
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!master) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Мастер не найден</p>
        <Button variant="link" onClick={() => navigate(-1)}>Назад</Button>
      </div>
    );
  }

  const isOwner = task && user?.id === task.client_id;
  const isAcceptedHere = acceptedMasterId === masterId;
  const someoneElseAccepted = !!acceptedMasterId && !isAcceptedHere;
  const canSelect = isOwner && responseId && !acceptedMasterId && task?.status === 'open';

  const categories = deduplicateCategories(master.categories ?? []);

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Назад
      </Button>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col items-center text-center space-y-3">
            <ClickableAvatar src={master.photo} name={master.name} size="lg" className="!w-28 !h-28" />
            <div className="space-y-1">
              <h1 className="text-xl font-bold">{master.name}</h1>
              <UserRating
                rating={master.rating ?? null}
                reviewCount={reviews.length}
                size="md"
                showEmpty
              />
              <p className="text-xs text-muted-foreground">
                {reviews.length === 0 ? '0 отзывов' : `${reviews.length} ${reviews.length === 1 ? 'отзыв' : reviews.length < 5 ? 'отзыва' : 'отзывов'}`}
              </p>
            </div>
          </div>

          {categories.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Категории работ</p>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => (
                  <CategoryBadge key={cat} value={cat} size="sm" />
                ))}
              </div>
            </div>
          )}

          {master.about && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">О себе</p>
              <p className="text-sm whitespace-pre-wrap">{master.about}</p>
            </div>
          )}

          {master.phone && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Телефон</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-mono">{master.phone}</span>
                <Button asChild size="sm" className="gap-1.5">
                  <a href={`tel:${master.phone}`}>
                    <Phone className="h-4 w-4" /> Позвонить
                  </a>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">Отзывы клиентов</CardTitle>
        </CardHeader>
        <CardContent>
          <ReviewThread profileUserId={masterId!} emptyText="У этого мастера пока нет отзывов" />
        </CardContent>
      </Card>

      {isOwner && (
        <>
          {isAcceptedHere && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 flex items-center gap-2 text-sm font-semibold text-primary">
              <CheckCircle className="h-4 w-4" /> Это ваш мастер
            </div>
          )}
          {someoneElseAccepted && (
            <p className="text-sm text-muted-foreground text-center">
              По этому заказу уже выбран другой мастер
            </p>
          )}
          {canSelect && (
            <Button
              className="w-full gap-1.5"
              size="lg"
              onClick={() => setConfirmOpen(true)}
              disabled={actionLoading}
            >
              <CheckCircle className="h-4 w-4" /> Выбрать
            </Button>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        actionLabel="выбрать этого мастера"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          setConfirmOpen(false);
          await handleSelect();
        }}
      />
    </div>
  );
}

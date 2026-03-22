import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CategoryBadge } from '@/components/CategoryBadge';
import { UserRating } from '@/components/UserRating';
import { ReviewForm } from '@/components/ReviewForm';
import { TASK_STATUS_LABELS, type TaskStatus } from '@/lib/constants';
import { MapPin, Clock, ArrowLeft, CheckCircle, XCircle, Check, MessageCircle, Star } from 'lucide-react';
import ClickableAvatar from '@/components/ClickableAvatar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ResponseWithMaster {
  id: string;
  master_id: string;
  status: string;
  created_at: string;
  message: string | null;
  profiles: {
    name: string;
    photo: string | null;
    rating: number | null;
    categories: string[] | null;
    about: string | null;
  } | null;
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [task, setTask] = useState<any>(null);
  const [responses, setResponses] = useState<ResponseWithMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reviewCounts, setReviewCounts] = useState<Record<string, number>>({});
  const [myReviews, setMyReviews] = useState<Set<string>>(new Set());
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ id: string; name: string } | null>(null);

  const isOwner = task?.client_id === user?.id;
  const isMaster = profile?.role === 'master';

  const fetchData = async () => {
    if (!id || !user) return;

    const { data: taskData } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    setTask(taskData);

    if (taskData) {
      const { data: responsesData } = await supabase
        .from('responses')
        .select('*, profiles:master_id(name, photo, rating, categories, about)')
        .eq('task_id', id)
        .order('created_at', { ascending: true });

      setResponses((responsesData as any) ?? []);

      // Fetch review counts for each master
      const masterIds = (responsesData ?? []).map((r: any) => r.master_id);
      if (masterIds.length > 0) {
        const { data: counts } = await supabase
          .from('reviews')
          .select('to_user')
          .in('to_user', masterIds);
        const countMap: Record<string, number> = {};
        (counts ?? []).forEach((c: any) => {
          countMap[c.to_user] = (countMap[c.to_user] || 0) + 1;
        });
        setReviewCounts(countMap);
      }

      // Fetch my existing reviews for this task
      const { data: existingReviews } = await supabase
        .from('reviews')
        .select('to_user')
        .eq('from_user', user.id)
        .eq('task_id', id);
      setMyReviews(new Set((existingReviews ?? []).map((r: any) => r.to_user)));
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [id, user]);

  const acceptMaster = async (responseId: string) => {
    setActionLoading(responseId);
    try {
      await supabase.from('responses').update({ status: 'accepted' }).eq('id', responseId);
      await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', id);
      toast({ title: 'Мастер выбран!' });
      await fetchData();
    } catch (e: any) {
      toast({ title: 'Ошибка', description: e.message, variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const cancelMaster = async (responseId: string) => {
    setActionLoading(responseId);
    try {
      await supabase.from('responses').update({ status: 'rejected' }).eq('id', responseId);
      await supabase.from('tasks').update({ status: 'open' }).eq('id', id);
      toast({ title: 'Мастер отменён. Выберите другого из резерва.' });
      await fetchData();
    } catch (e: any) {
      toast({ title: 'Ошибка', description: e.message, variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const completeTask = async () => {
    setActionLoading('complete');
    try {
      await supabase.from('tasks').update({ status: 'completed' }).eq('id', id);
      toast({ title: 'Заказ завершён!' });
      await fetchData();
      // Show review dialog for client after completing
      const accepted = responses.find(r => r.status === 'accepted');
      if (accepted?.profiles && !myReviews.has(accepted.master_id)) {
        setReviewTarget({ id: accepted.master_id, name: accepted.profiles.name });
        setReviewDialogOpen(true);
      }
    } catch (e: any) {
      toast({ title: 'Ошибка', description: e.message, variant: 'destructive' });
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Заказ не найден</p>
        <Button variant="link" onClick={() => navigate(-1)}>Назад</Button>
      </div>
    );
  }

  const acceptedResponse = responses.find(r => r.status === 'accepted');
  const pendingResponses = responses.filter(r => r.status === 'pending');
  const isCompleted = task.status === 'completed';

  // Determine who the current user can review
  const canReviewMaster = isOwner && isCompleted && acceptedResponse && !myReviews.has(acceptedResponse.master_id);
  const canReviewClient = isMaster && isCompleted && task.client_id && !myReviews.has(task.client_id);

  return (
    <div className="space-y-4 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Назад
      </Button>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg font-bold">{task.title}</CardTitle>
            <Badge variant={task.status === 'open' ? 'default' : task.status === 'in_progress' ? 'secondary' : 'outline'} className="shrink-0">
              {TASK_STATUS_LABELS[task.status as TaskStatus]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <CategoryBadge value={task.category} size="sm" />
          {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {task.address && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {task.address}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(task.created_at), { addSuffix: true, locale: ru })}
            </span>
          </div>

          {/* Chat button */}
          {(task.status === 'in_progress' || task.status === 'completed') && acceptedResponse && (isOwner || (isMaster && acceptedResponse.master_id === user?.id)) && (
            <Button
              variant="outline"
              className="w-full gap-1"
              onClick={() => navigate(`/chat/${task.id}`)}
            >
              <MessageCircle className="h-4 w-4" /> Перейти в чат
            </Button>
          )}

          {/* Complete button for client */}
          {isOwner && task.status === 'in_progress' && acceptedResponse && (
            <Button
              className="w-full gap-1"
              onClick={completeTask}
              disabled={actionLoading === 'complete'}
            >
              <Check className="h-4 w-4" /> Завершить заказ
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Responses section for task owner */}
      {isOwner && (
        <div className="space-y-3">
          <h2 className="text-base font-bold">
            Отклики ({responses.filter(r => r.status !== 'rejected').length}/5)
          </h2>

          {acceptedResponse && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">Выбранный мастер</p>
              <MasterCard
                response={acceptedResponse}
                reviewCount={reviewCounts[acceptedResponse.master_id] || 0}
                isAccepted
                onCancel={!isCompleted ? () => cancelMaster(acceptedResponse.id) : undefined}
                loading={actionLoading === acceptedResponse.id}
              />
            </div>
          )}

          {pendingResponses.length > 0 && (
            <div className="space-y-2">
              {acceptedResponse && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">В резерве</p>
              )}
              {pendingResponses.map(r => (
                <MasterCard
                  key={r.id}
                  response={r}
                  reviewCount={reviewCounts[r.master_id] || 0}
                  canAccept={!acceptedResponse && task.status === 'open'}
                  onAccept={() => acceptMaster(r.id)}
                  loading={actionLoading === r.id}
                />
              ))}
            </div>
          )}

          {responses.filter(r => r.status !== 'rejected').length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Пока нет откликов</p>
          )}
        </div>
      )}

      {/* Review dialog - shown for both client reviewing master and master reviewing client */}
      {canReviewMaster && acceptedResponse?.profiles && !reviewDialogOpen && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setReviewTarget({ id: acceptedResponse.master_id, name: acceptedResponse.profiles!.name });
            setReviewDialogOpen(true);
          }}
        >
          <Star className="h-4 w-4 mr-2" /> Оставить отзыв мастеру
        </Button>
      )}

      {canReviewClient && !reviewDialogOpen && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setReviewTarget({ id: task.client_id, name: 'клиента' });
            setReviewDialogOpen(true);
          }}
        >
          <Star className="h-4 w-4 mr-2" /> Оставить отзыв клиенту
        </Button>
      )}

      {reviewTarget && (
        <ReviewForm
          fromUserId={user!.id}
          toUserId={reviewTarget.id}
          taskId={task.id}
          toUserName={reviewTarget.name}
          open={reviewDialogOpen}
          onClose={() => { setReviewDialogOpen(false); setReviewTarget(null); }}
          onReviewSubmitted={fetchData}
        />
      )}
    </div>
  );
}

function MasterCard({
  response,
  reviewCount,
  isAccepted,
  canAccept,
  onAccept,
  onCancel,
  loading,
}: {
  response: ResponseWithMaster;
  reviewCount: number;
  isAccepted?: boolean;
  canAccept?: boolean;
  onAccept?: () => void;
  onCancel?: () => void;
  loading?: boolean;
}) {
  const master = response.profiles;
  if (!master) return null;

  return (
    <Card className={isAccepted ? 'border-primary/50 bg-primary/5' : ''}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-3">
          <ClickableAvatar src={master.photo} name={master.name} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{master.name}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <UserRating rating={master.rating} reviewCount={reviewCount} size="sm" />
              <span>
                {formatDistanceToNow(new Date(response.created_at), { addSuffix: true, locale: ru })}
              </span>
            </div>
          </div>
          {isAccepted && (
            <Badge variant="default" className="shrink-0 text-xs">Выбран</Badge>
          )}
        </div>

        {master.about && (
          <p className="text-xs text-muted-foreground line-clamp-2">{master.about}</p>
        )}

        <div className="flex gap-2">
          {canAccept && onAccept && (
            <Button size="sm" className="flex-1 gap-1" onClick={onAccept} disabled={loading}>
              <CheckCircle className="h-3.5 w-3.5" /> Выбрать
            </Button>
          )}
          {isAccepted && onCancel && (
            <Button size="sm" variant="destructive" className="flex-1 gap-1" onClick={onCancel} disabled={loading}>
              <XCircle className="h-3.5 w-3.5" /> Отменить мастера
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CategoryBadge } from '@/components/CategoryBadge';
import { TASK_STATUS_LABELS, type TaskStatus } from '@/lib/constants';
import { MapPin, Clock, Star, ArrowLeft, User, CheckCircle, XCircle } from 'lucide-react';
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

  const isClient = profile?.role === 'client';
  const isOwner = task?.client_id === user?.id;

  const fetchData = async () => {
    if (!id) return;

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
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const acceptMaster = async (responseId: string, masterId: string) => {
    setActionLoading(responseId);
    try {
      // Accept this response
      await supabase
        .from('responses')
        .update({ status: 'accepted' })
        .eq('id', responseId);

      // Set task to in_progress
      await supabase
        .from('tasks')
        .update({ status: 'in_progress' })
        .eq('id', id);

      toast({ title: 'Мастер выбран!' });
      await fetchData();
    } catch (e: any) {
      toast({ title: 'Ошибка', description: e.message, variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const rejectMaster = async (responseId: string) => {
    setActionLoading(responseId);
    try {
      await supabase
        .from('responses')
        .update({ status: 'rejected' })
        .eq('id', responseId);

      // If this was the accepted master, revert task to open
      const response = responses.find(r => r.id === responseId);
      if (response?.status === 'accepted') {
        // Check if there are other pending responses
        const pendingCount = responses.filter(r => r.id !== responseId && r.status === 'pending').length;
        await supabase
          .from('tasks')
          .update({ status: pendingCount > 0 ? 'open' : 'open' })
          .eq('id', id);
      }

      toast({ title: 'Мастер отклонён' });
      await fetchData();
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
  const rejectedResponses = responses.filter(r => r.status === 'rejected');

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
        </CardContent>
      </Card>

      {/* Responses section - only for task owner */}
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
                isAccepted
                onReject={() => rejectMaster(acceptedResponse.id)}
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
                  canAccept={!acceptedResponse && task.status === 'open'}
                  onAccept={() => acceptMaster(r.id, r.master_id)}
                  onReject={() => rejectMaster(r.id)}
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
    </div>
  );
}

function MasterCard({
  response,
  isAccepted,
  canAccept,
  onAccept,
  onReject,
  loading,
}: {
  response: ResponseWithMaster;
  isAccepted?: boolean;
  canAccept?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  loading?: boolean;
}) {
  const master = response.profiles;
  if (!master) return null;

  return (
    <Card className={isAccepted ? 'border-primary/50 bg-primary/5' : ''}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
            {master.photo ? (
              <img src={master.photo} className="w-10 h-10 rounded-full object-cover" alt="" />
            ) : (
              <User className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{master.name}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {master.rating?.toFixed(1) ?? '—'}
              </span>
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
          {isAccepted && onReject && (
            <Button size="sm" variant="destructive" className="flex-1 gap-1" onClick={onReject} disabled={loading}>
              <XCircle className="h-3.5 w-3.5" /> Отказать
            </Button>
          )}
          {!isAccepted && !canAccept && onReject && (
            <Button size="sm" variant="outline" className="gap-1" onClick={onReject} disabled={loading}>
              <XCircle className="h-3.5 w-3.5" /> Отклонить
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, Reply, Flag, EyeOff, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export interface ReviewRow {
  id: string;
  from_user: string;
  to_user: string;
  task_id: string | null;
  rating: number | null;
  comment: string | null;
  parent_id: string | null;
  is_hidden: boolean;
  hidden_reason: string | null;
  created_at: string;
}

interface AuthorMap {
  [id: string]: { name: string; photo: string | null };
}

interface ReviewThreadProps {
  /** Profile owner id (the user reviews are about) */
  profileUserId: string;
  /** Triggers a refetch externally */
  refreshKey?: number;
  emptyText?: string;
  /** If true, collapse root reviews after `initialCount` and show "Show more" button */
  collapsible?: boolean;
  /** How many root reviews to show initially when collapsible (default 3) */
  initialCount?: number;
  /** Called once when the user expands the collapsed list (used to reset unread badge) */
  onExpand?: () => void;
  /** Filter root reviews by exact rating value */
  ratingFilter?: number;
}

export function ReviewThread({
  profileUserId,
  refreshKey = 0,
  emptyText = 'Нет отзывов',
  collapsible = false,
  initialCount = 3,
  onExpand,
  ratingFilter,
}: ReviewThreadProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const isModerator = (profile?.role as string) === 'moderator';

  const [allReviews, setAllReviews] = useState<ReviewRow[]>([]);
  const [authors, setAuthors] = useState<AuthorMap>({});
  const [loading, setLoading] = useState(true);
  const [internalKey, setInternalKey] = useState(0);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [rootsExpanded, setRootsExpanded] = useState(false);

  const handleExpandRoots = () => {
    setRootsExpanded(true);
    onExpand?.();
  };

  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [complaintFor, setComplaintFor] = useState<string | null>(null);
  const [complaintReason, setComplaintReason] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: rData } = await supabase
        .from('reviews')
        .select('id, from_user, to_user, task_id, rating, comment, parent_id, is_hidden, hidden_reason, created_at')
        .or(`to_user.eq.${profileUserId},and(parent_id.not.is.null,from_user.eq.${profileUserId})`)
        .order('created_at', { ascending: true });

      // Fetch root reviews + their full threads. We need all replies whose root.to_user = profileUserId.
      const { data: roots } = await supabase
        .from('reviews')
        .select('id')
        .eq('to_user', profileUserId)
        .is('parent_id', null);

      const rootIds = (roots ?? []).map((r: any) => r.id);
      let replies: ReviewRow[] = [];
      if (rootIds.length > 0) {
        const { data: repData } = await supabase
          .from('reviews')
          .select('id, from_user, to_user, task_id, rating, comment, parent_id, is_hidden, hidden_reason, created_at')
          .in('parent_id', rootIds)
          .order('created_at', { ascending: true });
        replies = (repData ?? []) as ReviewRow[];
      }

      const rootRows = ((rData ?? []) as ReviewRow[]).filter(r => r.parent_id === null && r.to_user === profileUserId);
      const all = [...rootRows, ...replies];

      const authorIds = Array.from(new Set(all.map(r => r.from_user)));
      let map: AuthorMap = {};
      if (authorIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, name, photo')
          .in('id', authorIds);
        (profs ?? []).forEach((p: any) => { map[p.id] = { name: p.name || 'Пользователь', photo: p.photo }; });
      }

      if (!cancelled) {
        setAllReviews(all);
        setAuthors(map);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profileUserId, refreshKey, internalKey]);

  const refresh = () => setInternalKey(k => k + 1);

  const toggleThread = (rootId: string) => {
    setExpandedThreads(prev => {
      const n = new Set(prev);
      if (n.has(rootId)) n.delete(rootId); else n.add(rootId);
      return n;
    });
  };

  const submitReply = async () => {
    if (!user || !replyTo || !replyText.trim()) return;
    const root = allReviews.find(r => r.id === replyTo);
    if (!root) return;
    setSubmitting(true);
    const { error } = await supabase.from('reviews').insert({
      from_user: user.id,
      to_user: root.from_user, // the reply is addressed to whoever wrote the parent
      task_id: root.task_id,
      parent_id: root.id,
      rating: null,
      comment: replyText.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
      return;
    }
    setReplyTo(null);
    setReplyText('');
    setExpandedThreads(prev => new Set(prev).add(root.id));
    refresh();
    toast({ title: 'Ответ опубликован' });
  };

  const submitComplaint = async () => {
    if (!user || !complaintFor || !complaintReason.trim()) return;
    const r = allReviews.find(x => x.id === complaintFor);
    if (!r) return;
    const { error } = await supabase.from('complaints').insert({
      from_user: user.id,
      to_user: r.from_user,
      task_id: r.task_id,
      review_id: r.id,
      reason: complaintReason.trim(),
    });
    if (error) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
      return;
    }
    setComplaintFor(null);
    setComplaintReason('');
    toast({ title: 'Жалоба отправлена модератору' });
  };

  const toggleHide = async (r: ReviewRow) => {
    const reason = r.is_hidden ? null : (window.prompt('Причина скрытия (видна только модераторам):', '') || 'Нарушение правил');
    if (!r.is_hidden && !reason) return;
    const { error } = await supabase
      .from('reviews')
      .update({ is_hidden: !r.is_hidden, hidden_reason: r.is_hidden ? null : reason })
      .eq('id', r.id);
    if (error) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
      return;
    }
    refresh();
    toast({ title: r.is_hidden ? 'Отзыв восстановлен' : 'Отзыв скрыт' });
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Загрузка...</p>;
  }

  const roots = allReviews.filter(r =>
    r.parent_id === null &&
    (ratingFilter === undefined || r.rating === ratingFilter)
  );
  if (roots.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  const repliesOf = (rootId: string) =>
    allReviews
      .filter(r => r.parent_id === rootId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const renderItem = (r: ReviewRow, isReply = false) => {
    const author = authors[r.from_user];
    const canReply = !!user && !r.is_hidden;
    const canComplain = !!user && user.id !== r.from_user && !r.is_hidden;
    return (
      <div
        key={r.id}
        className={`rounded-md border p-3 space-y-1.5 ${
          r.is_hidden ? 'bg-muted/40 border-dashed opacity-70' : 'bg-card/50'
        } ${isReply ? 'ml-4 border-l-2 border-l-primary/30' : ''}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold truncate">{author?.name || 'Пользователь'}</span>
            {!isReply && r.rating !== null && r.rating > 0 && (
              <div className="flex items-center gap-0.5 shrink-0">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3.5 w-3.5 ${i < (r.rating ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
                  />
                ))}
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ru })}
          </span>
        </div>

        {r.is_hidden ? (
          <p className="text-sm italic text-muted-foreground">
            Отзыв скрыт модератором{r.hidden_reason && isModerator ? ` — ${r.hidden_reason}` : ''}
          </p>
        ) : (
          r.comment && <p className="text-sm whitespace-pre-wrap">{r.comment}</p>
        )}

        <div className="flex items-center gap-3 pt-1 text-xs">
          {canReply && (
            <button
              type="button"
              onClick={() => { setReplyTo(isReply ? r.parent_id : r.id); setReplyText(''); }}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <Reply className="h-3 w-3" /> Ответить
            </button>
          )}
          {canComplain && (
            <button
              type="button"
              onClick={() => { setComplaintFor(r.id); setComplaintReason(''); }}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive"
            >
              <Flag className="h-3 w-3" /> Пожаловаться
            </button>
          )}
          {isModerator && (
            <button
              type="button"
              onClick={() => toggleHide(r)}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground ml-auto"
            >
              {r.is_hidden ? <><Eye className="h-3 w-3" /> Восстановить</> : <><EyeOff className="h-3 w-3" /> Скрыть</>}
            </button>
          )}
        </div>
      </div>
    );
  };

  const sortedRoots = [...roots].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const showAllRoots = !collapsible || rootsExpanded;
  const visibleRoots = showAllRoots ? sortedRoots : sortedRoots.slice(0, initialCount);
  const hiddenRootsCount = sortedRoots.length - visibleRoots.length;

  return (
    <>
      <div className="space-y-3">
        {visibleRoots.map(root => {
            const replies = repliesOf(root.id);
            const expanded = expandedThreads.has(root.id);
            const visibleReplies = expanded ? replies : replies.slice(0, 1);
            const hiddenCount = replies.length - visibleReplies.length;

            return (
              <div key={root.id} className="space-y-2">
                {renderItem(root)}
                {visibleReplies.map(rep => renderItem(rep, true))}

                {replies.length > 1 && (
                  <button
                    type="button"
                    onClick={() => toggleThread(root.id)}
                    className="ml-4 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {expanded ? (
                      <><ChevronUp className="h-3 w-3" /> Свернуть переписку</>
                    ) : (
                      <><ChevronDown className="h-3 w-3" /> Показать переписку (+{hiddenCount})</>
                    )}
                  </button>
                )}

                {replyTo === root.id && (
                  <div className="ml-4 space-y-2">
                    <Textarea
                      placeholder="Ваш ответ..."
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      rows={2}
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => { setReplyTo(null); setReplyText(''); }}>
                        Отмена
                      </Button>
                      <Button size="sm" onClick={submitReply} disabled={submitting || !replyText.trim()}>
                        {submitting ? 'Отправка...' : 'Ответить'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

        {hiddenRootsCount > 0 && (
          <button
            type="button"
            onClick={handleExpandRoots}
            className="w-full inline-flex items-center justify-center gap-1 text-sm text-primary hover:underline py-2"
          >
            <ChevronDown className="h-4 w-4" /> Показать ещё (+{hiddenRootsCount})
          </button>
        )}
      </div>

      <Dialog open={!!complaintFor} onOpenChange={(v) => { if (!v) setComplaintFor(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Пожаловаться на отзыв</DialogTitle>
            <DialogDescription>
              Опишите причину. Модератор рассмотрит жалобу. Отзыв остаётся видимым до решения.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Причина (например: оскорбления, ложная информация)"
            value={complaintReason}
            onChange={e => setComplaintReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setComplaintFor(null)}>Отмена</Button>
            <Button onClick={submitComplaint} disabled={!complaintReason.trim()}>Отправить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

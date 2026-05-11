import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRole } from '@/hooks/useAdminRole';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { logAdminAction } from '@/lib/adminLog';
import { Shield, CheckCircle2, XCircle, EyeOff, FileText, MessageCircle, Ban, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type PendingMaster = {
  id: string;
  name: string;
  photo: string | null;
  categories: string[] | null;
  work_area: string | null;
  about: string | null;
  created_at: string;
};

type Complaint = {
  id: string;
  reason: string;
  status: string;
  created_at: string;
  from_user: string;
  to_user: string;
  task_id: string | null;
  review_id: string | null;
  moderator_note: string | null;
  from_profile?: { name: string } | null;
  to_profile?: { name: string } | null;
  review?: { id: string; comment: string | null; rating: number | null; to_user: string } | null;
};

type AdminLog = {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  actor?: { name: string } | null;
};

export default function AdminPanel() {
  const { user } = useAuth();
  const { hasAccess, loading: roleLoading } = useAdminRole();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [masters, setMasters] = useState<PendingMaster[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [complaintFilter, setComplaintFilter] = useState<'new' | 'in_progress' | 'resolved' | 'all'>('new');

  const loadMasters = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, photo, categories, work_area, about, created_at')
      .eq('role', 'master')
      .or('is_verified.is.null,is_verified.eq.false')
      .order('created_at', { ascending: false });
    setMasters((data ?? []) as PendingMaster[]);
  };

  const loadComplaints = async () => {
    let q = supabase
      .from('complaints')
      .select('id, reason, status, created_at, from_user, to_user, task_id, review_id, moderator_note')
      .order('created_at', { ascending: false });
    if (complaintFilter !== 'all') {
      const statusList =
        complaintFilter === 'resolved'
          ? ['resolved', 'accepted', 'dismissed']
          : [complaintFilter];
      q = q.in('status', statusList);
    }
    const { data } = await q;
    const rows = (data ?? []) as Complaint[];
    const userIds = Array.from(new Set(rows.flatMap(r => [r.from_user, r.to_user]).filter(Boolean)));
    const reviewIds = rows.map(r => r.review_id).filter(Boolean) as string[];
    const [profilesRes, reviewsRes] = await Promise.all([
      userIds.length
        ? supabase.from('profiles').select('id, name').in('id', userIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      reviewIds.length
        ? supabase.from('reviews').select('id, comment, rating, to_user').in('id', reviewIds)
        : Promise.resolve({ data: [] as { id: string; comment: string | null; rating: number | null; to_user: string }[] }),
    ]);
    const pMap = new Map((profilesRes.data ?? []).map(p => [p.id, p]));
    const rMap = new Map((reviewsRes.data ?? []).map(r => [r.id, r]));
    setComplaints(
      rows.map(r => ({
        ...r,
        from_profile: pMap.get(r.from_user) ?? null,
        to_profile: pMap.get(r.to_user) ?? null,
        review: r.review_id ? rMap.get(r.review_id) ?? null : null,
      })),
    );
  };

  const loadLogs = async () => {
    const { data } = await (supabase.from as any)('admin_logs')
      .select('id, actor_id, action, target_type, target_id, details, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    const rows = (data ?? []) as AdminLog[];
    const actorIds = Array.from(new Set(rows.map(r => r.actor_id)));
    const { data: profiles } = actorIds.length
      ? await supabase.from('profiles').select('id, name').in('id', actorIds)
      : { data: [] as { id: string; name: string }[] };
    const map = new Map((profiles ?? []).map(p => [p.id, p]));
    setLogs(rows.map(r => ({ ...r, actor: map.get(r.actor_id) ?? null })));
  };

  useEffect(() => {
    if (hasAccess) {
      loadMasters();
      loadComplaints();
      loadLogs();
    }
  }, [hasAccess]);

  useEffect(() => {
    if (hasAccess) loadComplaints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complaintFilter]);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!hasAccess) return <Navigate to="/" replace />;

  const approveMaster = async (m: PendingMaster) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_verified: true, rejection_reason: null })
      .eq('id', m.id);
    if (error) return toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    await (supabase.from as any)('notifications').insert({
      user_id: m.id,
      type: 'verification',
      title: 'Анкета подтверждена',
      body: 'Поздравляем! Ваша анкета мастера прошла модерацию.',
      link: '/profile',
    });
    await logAdminAction({
      actorId: user!.id,
      action: 'approve_master',
      targetType: 'profile',
      targetId: m.id,
      details: { name: m.name },
    });
    toast({ title: 'Мастер подтверждён' });
    loadMasters();
    loadLogs();
  };

  const rejectMaster = async (m: PendingMaster) => {
    const reason = rejectReason.trim();
    if (!reason) return toast({ title: 'Укажите причину', variant: 'destructive' });
    const { error } = await supabase
      .from('profiles')
      .update({ is_verified: false, rejection_reason: reason })
      .eq('id', m.id);
    if (error) return toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    await (supabase.from as any)('notifications').insert({
      user_id: m.id,
      type: 'verification',
      title: 'Анкета отклонена',
      body: `Причина: ${reason}. Отредактируйте профиль и подайте заявку повторно.`,
      link: '/profile',
    });
    await logAdminAction({
      actorId: user!.id,
      action: 'reject_master',
      targetType: 'profile',
      targetId: m.id,
      details: { name: m.name, reason },
    });
    toast({ title: 'Анкета отклонена' });
    setRejectReason('');
    loadMasters();
    loadLogs();
  };

  const dismissComplaint = async (c: Complaint) => {
    const { error } = await supabase
      .from('complaints')
      .update({ status: 'dismissed', moderator_note: 'Без последствий', resolved_at: new Date().toISOString(), resolved_by: user!.id })
      .eq('id', c.id);
    if (error) return toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    await logAdminAction({
      actorId: user!.id,
      action: 'dismiss_complaint',
      targetType: 'complaint',
      targetId: c.id,
      details: { reason: c.reason },
    });
    toast({ title: 'Жалоба отклонена' });
    loadComplaints();
    loadLogs();
  };

  const acceptComplaint = async (c: Complaint, sanction: 'block' | 'warn') => {
    // Optionally hide a related review
    if (c.review_id) {
      await supabase
        .from('reviews')
        .update({ is_hidden: true, hidden_reason: c.reason })
        .eq('id', c.review_id);
    }

    if (sanction === 'block') {
      const blockedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error: pErr } = await supabase
        .from('profiles')
        .update({ is_active: false, blocked_until: blockedUntil })
        .eq('id', c.to_user);
      if (pErr) return toast({ title: 'Ошибка блокировки', description: pErr.message, variant: 'destructive' });
      await (supabase.from as any)('notifications').insert({
        user_id: c.to_user,
        type: 'moderation',
        title: 'Аккаунт временно заблокирован',
        body: `На вас поступила жалоба. Доступ ограничен до ${new Date(blockedUntil).toLocaleDateString('ru-RU')}. Причина: ${c.reason}`,
      });
    } else {
      await (supabase.from as any)('notifications').insert({
        user_id: c.to_user,
        type: 'moderation',
        title: 'Предупреждение от модератора',
        body: `На вас поступила жалоба: ${c.reason}. Повторное нарушение приведёт к блокировке.`,
      });
    }

    const note = sanction === 'block' ? 'Заблокирован на 7 дней' : 'Вынесено предупреждение';
    const { error } = await supabase
      .from('complaints')
      .update({ status: 'accepted', moderator_note: note, resolved_at: new Date().toISOString(), resolved_by: user!.id })
      .eq('id', c.id);
    if (error) return toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });

    await logAdminAction({
      actorId: user!.id,
      action: sanction === 'block' ? 'block_user_7d' : 'warn_user',
      targetType: 'profile',
      targetId: c.to_user,
      details: { complaint_id: c.id, reason: c.reason },
    });
    toast({ title: sanction === 'block' ? 'Пользователь заблокирован на 7 дней' : 'Предупреждение вынесено' });
    loadComplaints();
    loadLogs();
  };

  const takeComplaint = async (c: Complaint) => {
    const { error } = await supabase
      .from('complaints')
      .update({ status: 'in_progress' })
      .eq('id', c.id);
    if (error) return toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    await logAdminAction({
      actorId: user!.id,
      action: 'take_complaint',
      targetType: 'complaint',
      targetId: c.id,
      details: {},
    });
    loadComplaints();
    loadLogs();
  };

  const contactUser = (c: Complaint) => {
    if (!c.task_id) {
      toast({ title: 'Чат недоступен — жалоба без заказа', variant: 'destructive' });
      return;
    }
    navigate(`/chat/${c.task_id}`);
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Админ-панель</h1>
      </div>

      <Tabs defaultValue="masters" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="masters" className="py-2.5 text-xs sm:text-sm">
            Мастера
          </TabsTrigger>
          <TabsTrigger value="complaints" className="py-2.5 text-xs sm:text-sm">
            Жалобы
          </TabsTrigger>
          <TabsTrigger value="logs" className="py-2.5 text-xs sm:text-sm">
            Логи
          </TabsTrigger>
        </TabsList>

        {/* Masters */}
        <TabsContent value="masters" className="space-y-3 mt-4">
          {masters.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Нет анкет на модерации</p>
          )}
          {masters.map(m => (
            <Card key={m.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={m.photo ?? undefined} />
                    <AvatarFallback>{m.name?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{m.name || 'Без имени'}</div>
                    <div className="text-xs text-muted-foreground">
                      Регистрация: {new Date(m.created_at).toLocaleDateString('ru-RU')}
                    </div>
                    {m.work_area && (
                      <div className="text-sm text-muted-foreground mt-1">📍 {m.work_area}</div>
                    )}
                  </div>
                </div>
                {m.categories && m.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {m.categories.map(c => (
                      <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                    ))}
                  </div>
                )}
                {m.about && <p className="text-sm">{m.about}</p>}
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button onClick={() => approveMaster(m)} className="flex-1">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Подтвердить
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="flex-1">
                        <XCircle className="h-4 w-4 mr-2" />
                        Отклонить
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Отклонить анкету</AlertDialogTitle>
                        <AlertDialogDescription>
                          Укажите причину — она будет отправлена мастеру в уведомлении.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <Textarea
                        placeholder="Например: фото нечёткое, отсутствует описание услуг…"
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        rows={3}
                      />
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setRejectReason('')}>Отмена</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => rejectMaster(m)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Отклонить
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Complaints */}
        <TabsContent value="complaints" className="space-y-3 mt-4">
          <div className="flex flex-wrap gap-2">
            {([
              { v: 'new', label: 'Новые' },
              { v: 'in_progress', label: 'В работе' },
              { v: 'resolved', label: 'Решённые' },
              { v: 'all', label: 'Все' },
            ] as const).map(f => (
              <Button
                key={f.v}
                size="sm"
                variant={complaintFilter === f.v ? 'default' : 'outline'}
                onClick={() => setComplaintFilter(f.v)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          {complaints.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Жалоб не найдено</p>
          )}
          {complaints.map(c => (
            <Card key={c.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleString('ru-RU')}
                  </div>
                  <Badge variant={c.status === 'new' ? 'destructive' : c.status === 'in_progress' ? 'secondary' : 'outline'}>
                    {c.status === 'new' ? 'Новая' : c.status === 'in_progress' ? 'В работе' : c.status === 'accepted' ? 'Принята' : c.status === 'dismissed' ? 'Отклонена' : 'Решена'}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    От: {c.from_profile?.name ?? '—'} → На: {c.to_profile?.name ?? '—'}
                  </div>
                  <div className="text-sm mt-1"><span className="font-medium">Причина: </span>{c.reason}</div>
                </div>
                {c.review && (
                  <div className="bg-muted/50 rounded-md p-3 text-sm">
                    <div className="text-xs text-muted-foreground mb-1">
                      Отзыв {c.review.rating ? `(${c.review.rating}★)` : ''}
                    </div>
                    {c.review.comment ?? <em className="text-muted-foreground">без комментария</em>}
                  </div>
                )}
                {c.moderator_note && (
                  <p className="text-xs text-muted-foreground italic">Решение: {c.moderator_note}</p>
                )}
                {(c.status === 'new' || c.status === 'in_progress') && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {c.status === 'new' && (
                        <Button size="sm" variant="secondary" onClick={() => takeComplaint(c)} className="gap-1">
                          Взять в работу
                        </Button>
                      )}
                      {c.task_id && (
                        <Button size="sm" variant="outline" onClick={() => contactUser(c)} className="gap-1">
                          <MessageCircle className="h-4 w-4" /> Связаться
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => dismissComplaint(c)} className="gap-1">
                        <XCircle className="h-4 w-4" /> Отклонить
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1 border-t">
                      <Button size="sm" variant="outline" onClick={() => acceptComplaint(c, 'warn')} className="gap-1">
                        <AlertTriangle className="h-4 w-4" /> Принять — предупреждение
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => acceptComplaint(c, 'block')} className="gap-1">
                        <Ban className="h-4 w-4" /> Принять — блок 7 дней
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Logs */}
        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {logs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 flex items-center justify-center gap-2">
                  <FileText className="h-4 w-4" /> Логов пока нет
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Дата</TableHead>
                      <TableHead>Кто</TableHead>
                      <TableHead>Действие</TableHead>
                      <TableHead>Объект</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(l.created_at).toLocaleString('ru-RU')}
                        </TableCell>
                        <TableCell className="text-xs">{l.actor?.name ?? l.actor_id.slice(0, 8)}</TableCell>
                        <TableCell className="text-xs font-mono">{l.action}</TableCell>
                        <TableCell className="text-xs">
                          <div>{l.target_type}</div>
                          {l.details && Object.keys(l.details).length > 0 && (
                            <div className="text-muted-foreground truncate max-w-[200px]">
                              {JSON.stringify(l.details)}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

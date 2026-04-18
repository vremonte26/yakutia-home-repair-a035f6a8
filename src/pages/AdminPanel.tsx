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
import { Shield, CheckCircle2, XCircle, EyeOff, FileText } from 'lucide-react';

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
  review_id: string | null;
  from_profile?: { name: string } | null;
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

  const [masters, setMasters] = useState<PendingMaster[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [rejectReason, setRejectReason] = useState('');

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
    const { data } = await supabase
      .from('complaints')
      .select('id, reason, status, created_at, from_user, review_id')
      .eq('status', 'new')
      .order('created_at', { ascending: false });
    const rows = (data ?? []) as Complaint[];
    // Hydrate related data
    const userIds = Array.from(new Set(rows.map(r => r.from_user)));
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
      .update({ status: 'dismissed', resolved_at: new Date().toISOString(), resolved_by: user!.id })
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

  const acceptComplaint = async (c: Complaint) => {
    if (c.review_id) {
      const { error: rErr } = await supabase
        .from('reviews')
        .update({ is_hidden: true, hidden_reason: c.reason })
        .eq('id', c.review_id);
      if (rErr) return toast({ title: 'Ошибка', description: rErr.message, variant: 'destructive' });
    }
    const { error } = await supabase
      .from('complaints')
      .update({ status: 'accepted', resolved_at: new Date().toISOString(), resolved_by: user!.id })
      .eq('id', c.id);
    if (error) return toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    await logAdminAction({
      actorId: user!.id,
      action: 'accept_complaint',
      targetType: 'complaint',
      targetId: c.id,
      details: { review_id: c.review_id, reason: c.reason },
    });
    toast({ title: 'Жалоба принята, отзыв скрыт' });
    loadComplaints();
    loadLogs();
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
          {complaints.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Нет новых жалоб</p>
          )}
          {complaints.map(c => (
            <Card key={c.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleString('ru-RU')}
                  </div>
                  <Badge variant="outline">Новая</Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">От: {c.from_profile?.name ?? '—'}</div>
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
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={() => dismissComplaint(c)} className="flex-1">
                    Отклонить жалобу
                  </Button>
                  <Button onClick={() => acceptComplaint(c)} className="flex-1">
                    <EyeOff className="h-4 w-4 mr-2" />
                    Принять (скрыть отзыв)
                  </Button>
                </div>
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

import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Send, Check, X, History, MessageCircle, Lock } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

type Party = 'client' | 'master';
type ContractStatus = 'draft' | 'pending_approval' | 'approved' | 'signed' | 'cancelled';

interface Contract {
  id: string;
  task_id: string;
  client_id: string;
  master_id: string;
  subject: string;
  price: number | null;
  deadline: string | null;
  address: string;
  status: ContractStatus;
  current_version: number;
  last_initiator: Party | null;
  last_sent_at: string | null;
  client_approved_version: number | null;
  master_approved_version: number | null;
}

interface Version {
  id: string;
  version_number: number;
  subject: string;
  price: number | null;
  deadline: string | null;
  address: string;
  initiator: Party;
  initiator_user_id: string;
  created_at: string;
}

interface FormData {
  subject: string;
  price: string;
  deadline: string;
  address: string;
}

const FIELD_LABELS: Record<keyof FormData, string> = {
  subject: 'Предмет договора',
  price: 'Цена (₽)',
  deadline: 'Срок выполнения',
  address: 'Адрес',
};

function toForm(c: Pick<Contract, 'subject' | 'price' | 'deadline' | 'address'>): FormData {
  return {
    subject: c.subject ?? '',
    price: c.price != null ? String(c.price) : '',
    deadline: c.deadline ?? '',
    address: c.address ?? '',
  };
}

export default function ContractPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<any>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [form, setForm] = useState<FormData>({ subject: '', price: '', deadline: '', address: '' });
  const [submitting, setSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [confirm, setConfirm] = useState<{ label: string; action: () => Promise<void> } | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const myParty: Party | null = useMemo(() => {
    if (!contract || !user) return null;
    if (user.id === contract.client_id) return 'client';
    if (user.id === contract.master_id) return 'master';
    return null;
  }, [contract, user]);

  const latestVersion = versions[0] ?? null;
  const previousVersion = versions[1] ?? null;

  // Сравнение текущего черновика с последней отправленной версией
  const draftDiff = useMemo(() => {
    if (!contract || !latestVersion) return null;
    const fromForm: FormData = {
      subject: form.subject,
      price: form.price,
      deadline: form.deadline,
      address: form.address,
    };
    const fromVer = toForm(latestVersion);
    const diff: Partial<Record<keyof FormData, boolean>> = {};
    (Object.keys(fromForm) as (keyof FormData)[]).forEach((k) => {
      if ((fromForm[k] ?? '') !== (fromVer[k] ?? '')) diff[k] = true;
    });
    return diff;
  }, [form, latestVersion, contract]);

  // Согласовывает ли текущий пользователь чужую версию
  const isReviewing =
    !!contract &&
    contract.status === 'pending_approval' &&
    !!myParty &&
    contract.last_initiator !== null &&
    contract.last_initiator !== myParty;

  // Уже подтвердил ли я текущую версию
  const myApprovedVersion =
    myParty === 'client' ? contract?.client_approved_version : contract?.master_approved_version;
  const otherApprovedVersion =
    myParty === 'client' ? contract?.master_approved_version : contract?.client_approved_version;

  const fetchAll = async () => {
    if (!taskId || !user) return;
    const { data: t } = await supabase.from('tasks').select('*').eq('id', taskId).single();
    setTask(t);

    const { data: existing } = await supabase
      .from('contracts')
      .select('*')
      .eq('task_id', taskId)
      .maybeSingle();

    let contractRow = existing as Contract | null;

    if (!contractRow && t) {
      // найти выбранного мастера
      const { data: accepted } = await supabase
        .from('responses')
        .select('master_id')
        .eq('task_id', taskId)
        .eq('status', 'accepted')
        .maybeSingle();

      if (!accepted) {
        toast({ title: 'Сначала выберите мастера', variant: 'destructive' });
        navigate(`/task/${taskId}`);
        return;
      }

      const { data: created, error } = await supabase
        .from('contracts')
        .insert({
          task_id: taskId,
          client_id: t.client_id,
          master_id: accepted.master_id,
          subject: t.title || '',
          price: t.price ?? null,
          address: t.address_full || t.address || '',
        })
        .select('*')
        .single();

      if (error) {
        toast({ title: 'Не удалось создать договор', description: error.message, variant: 'destructive' });
        setLoading(false);
        return;
      }
      contractRow = created as Contract;
    }

    setContract(contractRow);
    if (contractRow) setForm(toForm(contractRow));

    if (contractRow) {
      const { data: vers } = await supabase
        .from('contract_versions')
        .select('*')
        .eq('contract_id', contractRow.id)
        .order('version_number', { ascending: false });
      setVersions((vers ?? []) as Version[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, user?.id]);

  // realtime
  useEffect(() => {
    if (!contract) return;
    const ch = supabase
      .channel(`contract-${contract.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts', filter: `id=eq.${contract.id}` }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contract_versions', filter: `contract_id=eq.${contract.id}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract?.id]);

  const saveDraft = async (silent = false) => {
    if (!contract) return;
    setSubmitting(true);
    const { error } = await supabase
      .from('contracts')
      .update({
        subject: form.subject,
        price: form.price === '' ? null : Number(form.price),
        deadline: form.deadline || null,
        address: form.address,
      })
      .eq('id', contract.id);
    setSubmitting(false);
    if (error) {
      toast({ title: 'Ошибка сохранения', description: error.message, variant: 'destructive' });
      return false;
    }
    if (!silent) toast({ title: 'Черновик сохранён' });
    await fetchAll();
    return true;
  };

  const sendForApproval = async () => {
    if (!contract || !myParty || !user) return;
    setSubmitting(true);
    const ok = await saveDraft(true);
    if (!ok) { setSubmitting(false); return; }

    const newVersion = (contract.current_version ?? 0) + 1;

    const { error: vErr } = await supabase.from('contract_versions').insert({
      contract_id: contract.id,
      version_number: newVersion,
      subject: form.subject,
      price: form.price === '' ? null : Number(form.price),
      deadline: form.deadline || null,
      address: form.address,
      initiator: myParty,
      initiator_user_id: user.id,
    });
    if (vErr) {
      toast({ title: 'Не удалось создать версию', description: vErr.message, variant: 'destructive' });
      setSubmitting(false);
      return;
    }

    // Инициатор автоматически подтверждает свою версию
    const updates: Partial<Contract> & Record<string, any> = {
      status: 'pending_approval',
      current_version: newVersion,
      last_initiator: myParty,
      last_sent_at: new Date().toISOString(),
    };
    if (myParty === 'client') updates.client_approved_version = newVersion;
    else updates.master_approved_version = newVersion;

    const { error: cErr } = await supabase.from('contracts').update(updates).eq('id', contract.id);
    if (cErr) {
      toast({ title: 'Ошибка', description: cErr.message, variant: 'destructive' });
    } else {
      toast({ title: 'Договор отправлен на согласование' });
    }
    setSubmitting(false);
    fetchAll();
  };

  const approveCurrent = async () => {
    if (!contract || !myParty) return;
    setSubmitting(true);
    const updates: Record<string, any> = {};
    const v = contract.current_version;
    if (myParty === 'client') updates.client_approved_version = v;
    else updates.master_approved_version = v;

    // Если обе стороны подтвердили — статус approved
    const otherVer = myParty === 'client' ? contract.master_approved_version : contract.client_approved_version;
    if (otherVer === v) updates.status = 'approved';

    const { error } = await supabase.from('contracts').update(updates).eq('id', contract.id);
    setSubmitting(false);
    if (error) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: updates.status === 'approved' ? 'Договор согласован обеими сторонами' : 'Версия подтверждена' });
    fetchAll();
  };

  const rejectCurrent = async () => {
    if (!contract || !user || !myParty) return;
    if (!rejectReason.trim()) {
      toast({ title: 'Укажите причину', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const otherId = myParty === 'client' ? contract.master_id : contract.client_id;
    await supabase.from('messages').insert({
      task_id: contract.task_id,
      from_user: user.id,
      to_user: otherId,
      text: `❌ Отклонены изменения договора v${contract.current_version}.\nПричина: ${rejectReason.trim()}`,
    });
    await supabase.from('contracts').update({ status: 'draft' }).eq('id', contract.id);
    setRejectReason('');
    setRejectOpen(false);
    setSubmitting(false);
    toast({ title: 'Изменения отклонены' });
    fetchAll();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!contract || !myParty) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Договор недоступен</p>
        <Button variant="link" onClick={() => navigate(-1)}>Назад</Button>
      </div>
    );
  }

  const statusBadge: Record<ContractStatus, { label: string; variant: any }> = {
    draft: { label: 'Черновик', variant: 'outline' },
    pending_approval: { label: 'На согласовании', variant: 'secondary' },
    approved: { label: 'Согласован', variant: 'default' },
    signed: { label: 'Подписан', variant: 'default' },
    cancelled: { label: 'Отменён', variant: 'destructive' },
  };

  // Поля только для чтения, если согласован/подписан
  const fieldsLocked = contract.status === 'approved' || contract.status === 'signed';

  // Подсветка изменений по сравнению с предыдущей версией (для согласующего)
  const reviewDiff: Partial<Record<keyof FormData, { from: string; to: string }>> = {};
  if (isReviewing && latestVersion && previousVersion) {
    const cur = toForm(latestVersion);
    const prev = toForm(previousVersion);
    (Object.keys(cur) as (keyof FormData)[]).forEach((k) => {
      if ((cur[k] ?? '') !== (prev[k] ?? '')) reviewDiff[k] = { from: prev[k] || '—', to: cur[k] || '—' };
    });
  }

  const openChat = () => navigate(`/chat/${contract.task_id}`);

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <div className="sticky top-14 z-30 -mx-4 px-4 py-2 bg-background/90 backdrop-blur-md border-b shadow-sm flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/task/${taskId}`)} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> К заказу
        </Button>
        <Badge variant={statusBadge[contract.status].variant}>{statusBadge[contract.status].label}</Badge>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold">Договор</CardTitle>
          {task && <p className="text-sm text-muted-foreground">По заказу: {task.title}</p>}
          <p className="text-xs text-muted-foreground">
            Версия {contract.current_version || '—'}
            {contract.last_initiator && contract.status === 'pending_approval' && (
              <> · отправил{contract.last_initiator === 'client' ? ' клиент' : ' мастер'}</>
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {isReviewing && Object.keys(reviewDiff).length > 0 && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              Инициатор изменил данные. Подсвечены изменённые поля.
            </div>
          )}
          {isReviewing && Object.keys(reviewDiff).length === 0 && (
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Данные не менялись со времени последней отправки.
            </div>
          )}
          {fieldsLocked && (
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground flex items-center gap-2">
              <Lock className="h-4 w-4" /> Договор согласован. Изменения возможны только через создание новой версии.
            </div>
          )}

          {(['subject', 'price', 'deadline', 'address'] as (keyof FormData)[]).map((field) => {
            const isChangedDraft = !!draftDiff?.[field];
            const isChangedReview = !!reviewDiff[field];
            const reviewInfo = reviewDiff[field];
            return (
              <div key={field} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor={field} className="flex items-center gap-2">
                    {FIELD_LABELS[field]}
                    {isChangedReview && (
                      <Badge variant="secondary" className="text-[10px] bg-amber-200 text-amber-900 hover:bg-amber-200">изменено</Badge>
                    )}
                    {isChangedDraft && !isReviewing && (
                      <Badge variant="outline" className="text-[10px]">не сохранено</Badge>
                    )}
                  </Label>
                  {isChangedReview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 gap-1"
                      onClick={openChat}
                      title="Обсудить в чате"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {reviewInfo && (
                  <p className="text-xs text-muted-foreground">
                    Было: <span className="line-through">{reviewInfo.from}</span> → <span className="font-medium text-foreground">{reviewInfo.to}</span>
                  </p>
                )}

                {field === 'subject' && (
                  <Textarea
                    id={field}
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    disabled={fieldsLocked}
                    className={isChangedReview ? 'border-amber-400 bg-amber-50' : ''}
                    rows={2}
                  />
                )}
                {field === 'price' && (
                  <Input
                    id={field}
                    type="number"
                    inputMode="decimal"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    disabled={fieldsLocked}
                    className={isChangedReview ? 'border-amber-400 bg-amber-50' : ''}
                  />
                )}
                {field === 'deadline' && (
                  <Input
                    id={field}
                    type="date"
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                    disabled={fieldsLocked}
                    className={isChangedReview ? 'border-amber-400 bg-amber-50' : ''}
                  />
                )}
                {field === 'address' && (
                  <Input
                    id={field}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    disabled={fieldsLocked}
                    className={isChangedReview ? 'border-amber-400 bg-amber-50' : ''}
                  />
                )}
              </div>
            );
          })}

          {/* Информация о подтверждениях */}
          {contract.current_version > 0 && (
            <div className="rounded-md border p-3 text-xs space-y-1">
              <p>
                Клиент: {contract.client_approved_version === contract.current_version
                  ? <span className="text-green-700 font-medium">подтвердил v{contract.current_version}</span>
                  : <span className="text-muted-foreground">не подтвердил v{contract.current_version}</span>}
              </p>
              <p>
                Мастер: {contract.master_approved_version === contract.current_version
                  ? <span className="text-green-700 font-medium">подтвердил v{contract.current_version}</span>
                  : <span className="text-muted-foreground">не подтвердил v{contract.current_version}</span>}
              </p>
            </div>
          )}

          {/* Действия */}
          <div className="flex flex-col gap-2 pt-2">
            {!fieldsLocked && !isReviewing && (
              <>
                <Button
                  variant="outline"
                  onClick={() => saveDraft()}
                  disabled={submitting}
                >
                  Сохранить черновик
                </Button>
                <Button
                  onClick={() => setConfirm({ label: 'отправить договор на согласование', action: sendForApproval })}
                  disabled={submitting}
                  className="gap-1"
                >
                  <Send className="h-4 w-4" /> Отправить на согласование
                </Button>
              </>
            )}

            {isReviewing && myApprovedVersion !== contract.current_version && (
              <>
                <Button
                  onClick={() => setConfirm({ label: 'подтвердить изменения', action: approveCurrent })}
                  disabled={submitting}
                  className="gap-1"
                >
                  <Check className="h-4 w-4" /> Подтвердить
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setRejectOpen(true)}
                  disabled={submitting}
                  className="gap-1"
                >
                  <X className="h-4 w-4" /> Отклонить
                </Button>
              </>
            )}

            {isReviewing && myApprovedVersion === contract.current_version && otherApprovedVersion !== contract.current_version && (
              <p className="text-sm text-muted-foreground text-center">Вы подтвердили. Ожидаем вторую сторону.</p>
            )}

            <Button variant="ghost" className="gap-1" onClick={() => setShowHistory((v) => !v)}>
              <History className="h-4 w-4" /> {showHistory ? 'Скрыть историю' : `История версий (${versions.length})`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {showHistory && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">История версий</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {versions.length === 0 && <p className="text-sm text-muted-foreground">Версий пока нет</p>}
            {versions.map((v, idx) => {
              const prev = versions[idx + 1];
              const changed: string[] = [];
              if (prev) {
                if ((v.subject || '') !== (prev.subject || '')) changed.push(`Предмет: «${prev.subject || '—'}» → «${v.subject || '—'}»`);
                if ((v.price ?? null) !== (prev.price ?? null)) changed.push(`Цена: ${prev.price ?? '—'} → ${v.price ?? '—'}`);
                if ((v.deadline || '') !== (prev.deadline || '')) changed.push(`Срок: ${prev.deadline || '—'} → ${v.deadline || '—'}`);
                if ((v.address || '') !== (prev.address || '')) changed.push(`Адрес: «${prev.address || '—'}» → «${v.address || '—'}»`);
              }
              return (
                <div key={v.id} className="rounded-md border p-3 space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">v{v.version_number}</span>
                    <span className="text-xs text-muted-foreground">
                      {v.initiator === 'client' ? 'клиент' : 'мастер'} · {new Date(v.created_at).toLocaleString('ru-RU')}
                    </span>
                  </div>
                  {prev ? (
                    changed.length > 0 ? (
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {changed.map((c, i) => <li key={i}>• {c}</li>)}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">Без изменений по сравнению с предыдущей версией</p>
                    )
                  ) : (
                    <p className="text-xs text-muted-foreground">Первая версия</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={!!confirm}
        actionLabel={confirm?.label ?? ''}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const a = confirm?.action;
          setConfirm(null);
          if (a) await a();
        }}
      />

      {rejectOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => setRejectOpen(false)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-base">Причина отклонения</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Опишите, что именно не устраивает..."
                rows={4}
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setRejectOpen(false)}>Отмена</Button>
                <Button className="flex-1" onClick={rejectCurrent} disabled={submitting}>Отправить</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

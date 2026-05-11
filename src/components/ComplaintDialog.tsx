import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export const COMPLAINT_REASONS = [
  { value: 'insult', label: 'Оскорбление или грубость' },
  { value: 'fraud', label: 'Мошенничество' },
  { value: 'missed_deadline', label: 'Срыв сроков' },
  { value: 'other', label: 'Другое' },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  taskId: string;
  toUser: string;
  toUserName?: string;
}

export function ComplaintDialog({ open, onOpenChange, taskId, toUser, toUserName }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reason, setReason] = useState<string>('insult');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!user) return;
    const label = COMPLAINT_REASONS.find(r => r.value === reason)?.label ?? reason;
    const fullReason = details.trim()
      ? `${label}: ${details.trim().slice(0, 500)}`
      : label;

    setSubmitting(true);
    const { error } = await supabase.from('complaints').insert({
      from_user: user.id,
      to_user: toUser,
      task_id: taskId,
      reason: fullReason,
      status: 'new',
    });
    setSubmitting(false);

    if (error) {
      toast({ title: 'Не удалось отправить жалобу', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Жалоба отправлена модератору' });
    setReason('insult');
    setDetails('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Пожаловаться{toUserName ? ` на ${toUserName}` : ''}</DialogTitle>
          <DialogDescription>
            Жалоба будет рассмотрена модератором. Пользователь не уведомляется.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={reason} onValueChange={setReason} className="space-y-1">
          {COMPLAINT_REASONS.map(r => (
            <div key={r.value} className="flex items-center space-x-2">
              <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
              <Label htmlFor={`reason-${r.value}`} className="cursor-pointer text-sm">
                {r.label}
              </Label>
            </div>
          ))}
        </RadioGroup>

        <Textarea
          placeholder="Подробности (необязательно, до 500 символов)"
          value={details}
          maxLength={500}
          onChange={e => setDetails(e.target.value)}
          rows={4}
        />

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={submitting || !reason}>
            {submitting ? 'Отправка…' : 'Отправить'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}

export function RoleSwitchDialog({ open, onOpenChange, onDone }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    const { error: e1 } = await supabase.rpc('upsert_client_data', {
      _name: name.trim() || 'Клиент',
      _photo: null,
      _phone: null,
    });
    if (e1) {
      toast({ title: 'Не удалось создать профиль клиента', description: e1.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    const { error: e2 } = await supabase.rpc('switch_active_role', { _new_role: 'client' });
    setLoading(false);
    if (e2) {
      toast({ title: 'Не удалось переключиться', description: e2.message, variant: 'destructive' });
      return;
    }
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Профиль клиента</DialogTitle>
          <DialogDescription>
            У вас пока нет профиля клиента. Введите имя — и мы создадим его.
          </DialogDescription>
        </DialogHeader>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ваше имя" autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Отмена</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Создание…' : 'Создать и переключить'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
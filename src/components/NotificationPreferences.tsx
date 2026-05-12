import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Bell } from 'lucide-react';
import { promptPushPermission } from '@/lib/onesignal';

type Prefs = {
  push_enabled: boolean;
  new_order: boolean;
  new_response: boolean;
  master_selected: boolean;
  task_completed: boolean;
};

const DEFAULTS: Prefs = {
  push_enabled: true,
  new_order: true,
  new_response: true,
  master_selected: true,
  task_completed: true,
};

export function NotificationPreferences() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const isMaster = profile?.role === 'master';

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('notification_prefs')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const np = (data as any)?.notification_prefs;
        if (np) setPrefs({ ...DEFAULTS, ...np });
        setLoading(false);
      });
  }, [user]);

  const update = async (key: keyof Prefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    if (key === 'push_enabled' && value) {
      promptPushPermission();
    }
    const { error } = await supabase
      .from('profiles')
      .update({ notification_prefs: next } as any)
      .eq('id', user!.id);
    if (error) {
      toast({ title: 'Не удалось сохранить настройки', variant: 'destructive' });
      setPrefs(prefs);
    }
  };

  if (loading) return null;

  const items: Array<{ key: keyof Prefs; label: string; show: boolean }> = [
    { key: 'new_order', label: 'Новый заказ', show: isMaster },
    { key: 'new_response', label: 'Новый отклик', show: !isMaster },
    { key: 'master_selected', label: 'Выбор мастера', show: isMaster },
    { key: 'task_completed', label: 'Завершение заказа', show: true },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Уведомления
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium">Push-уведомления</span>
          <Switch
            checked={prefs.push_enabled}
            onCheckedChange={v => update('push_enabled', v)}
          />
        </label>
        <div className="border-t pt-3 space-y-3 opacity-100">
          {items.filter(i => i.show).map(i => (
            <label key={i.key} className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">{i.label}</span>
              <Switch
                checked={prefs[i.key]}
                onCheckedChange={v => update(i.key, v)}
                disabled={!prefs.push_enabled}
              />
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
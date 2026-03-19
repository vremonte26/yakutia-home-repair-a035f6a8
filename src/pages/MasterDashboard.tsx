import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { TaskCard } from '@/components/TaskCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CATEGORIES } from '@/lib/constants';

export default function MasterDashboard() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (filter) {
      query = query.eq('category', filter);
    }

    query.then(({ data }) => {
      setTasks(data ?? []);
      setLoading(false);
    });
  }, [filter]);

  const respond = async (taskId: string) => {
    if (!user) return;
    const { error } = await supabase.from('responses').insert({
      task_id: taskId,
      master_id: user.id,
    });
    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Вы уже откликнулись на этот заказ', variant: 'destructive' });
      } else {
        toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
      }
      return;
    }
    toast({ title: 'Отклик отправлен!' });
  };

  if (!profile?.is_verified) {
    return (
      <div className="text-center py-20 space-y-3 animate-fade-in">
        <div className="text-4xl">⏳</div>
        <h2 className="text-xl font-bold">Анкета на модерации</h2>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Ваша анкета отправлена на проверку. После одобрения вы сможете видеть и откликаться на заказы.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-xl font-extrabold">Доступные заказы</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Badge
          variant={filter === null ? 'default' : 'outline'}
          className="cursor-pointer shrink-0"
          onClick={() => setFilter(null)}
        >
          Все
        </Badge>
        {CATEGORIES.map(cat => (
          <Badge
            key={cat.value}
            variant={filter === cat.value ? 'default' : 'outline'}
            className="cursor-pointer shrink-0"
            onClick={() => setFilter(cat.value)}
          >
            {cat.icon} {cat.label}
          </Badge>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">Нет доступных заказов</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task}>
              <Button
                size="sm"
                className="mt-2 w-full"
                onClick={e => {
                  e.stopPropagation();
                  respond(task.id);
                }}
              >
                Откликнуться
              </Button>
            </TaskCard>
          ))}
        </div>
      )}
    </div>
  );
}

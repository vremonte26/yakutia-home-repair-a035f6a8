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
  const [respondedTaskIds, setRespondedTaskIds] = useState<Set<string>>(new Set());
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!user) return;

      let query = supabase
        .from('tasks')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (filter) {
        query = query.eq('category', filter);
      }

      const { data: tasksData } = await query;
      setTasks(tasksData ?? []);

      // Get my existing responses
      const { data: myResponses } = await supabase
        .from('responses')
        .select('task_id')
        .eq('master_id', user.id);

      setRespondedTaskIds(new Set((myResponses ?? []).map(r => r.task_id)));

      // Get response counts for each task
      if (tasksData && tasksData.length > 0) {
        const taskIds = tasksData.map(t => t.id);
        const { data: allResponses } = await supabase
          .from('responses')
          .select('task_id')
          .in('task_id', taskIds)
          .neq('status', 'rejected');

        const counts: Record<string, number> = {};
        (allResponses ?? []).forEach(r => {
          counts[r.task_id] = (counts[r.task_id] || 0) + 1;
        });
        setResponseCounts(counts);
      }

      setLoading(false);
    };

    fetchTasks();
  }, [filter, user]);

  const respond = async (taskId: string) => {
    if (!user) return;

    const task = tasks.find(t => t.id === taskId);
    if (task?.client_id === user.id) {
      toast({ title: 'Нельзя откликнуться на свою собственную заявку', variant: 'destructive' });
      return;
    }

    if ((responseCounts[taskId] || 0) >= 5) {
      toast({ title: 'Максимум откликов на этот заказ', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('responses').insert({
      task_id: taskId,
      master_id: user.id,
    });
    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Вы уже откликнулись на этот заказ', variant: 'destructive' });
      } else if (error.message?.includes('Cannot respond to your own task')) {
        toast({ title: 'Нельзя откликнуться на свою собственную заявку', variant: 'destructive' });
      } else if (error.message?.includes('Maximum 5')) {
        toast({ title: 'Максимум 5 откликов на заказ', variant: 'destructive' });
      } else {
        toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
      }
      return;
    }
    setRespondedTaskIds(prev => new Set(prev).add(taskId));
    setResponseCounts(prev => ({ ...prev, [taskId]: (prev[taskId] || 0) + 1 }));
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
          {tasks.map(task => {
            const alreadyResponded = respondedTaskIds.has(task.id);
            const count = responseCounts[task.id] || 0;
            const isFull = count >= 5;
            const isOwnTask = task.client_id === user?.id;

            return (
              <TaskCard key={task.id} task={task}>
                <div className="flex items-center justify-between mt-2 gap-2">
                  <span className="text-xs text-muted-foreground">{count}/5 откликов</span>
                  {isOwnTask ? (
                    <span className="text-xs text-muted-foreground italic">Ваша заявка</span>
                  ) : (
                    <Button
                      size="sm"
                      disabled={alreadyResponded || isFull}
                      onClick={e => {
                        e.stopPropagation();
                        respond(task.id);
                      }}
                    >
                      {alreadyResponded ? '✓ Вы откликнулись' : isFull ? 'Набрано' : 'Откликнуться'}
                    </Button>
                  )}
                </div>
              </TaskCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

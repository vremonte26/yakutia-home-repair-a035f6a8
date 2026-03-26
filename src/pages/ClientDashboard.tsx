import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { TaskCard } from '@/components/TaskCard';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function ClientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<any[]>([]);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      setTasks(tasksData ?? []);

      if (tasksData && tasksData.length > 0) {
        const taskIds = tasksData.map(t => t.id);
        const { data: responses } = await supabase
          .from('responses')
          .select('task_id')
          .in('task_id', taskIds)
          .neq('status', 'rejected');

        const counts: Record<string, number> = {};
        (responses ?? []).forEach(r => {
          counts[r.task_id] = (counts[r.task_id] || 0) + 1;
        });
        setResponseCounts(counts);
      }

      setLoading(false);
    };
    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Мои заказы</h1>
        <Button asChild size="sm">
          <Link to="/create-task">
            <PlusCircle className="h-4 w-4 mr-1" />
            Создать
          </Link>
        </Button>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-muted-foreground">У вас пока нет заказов</p>
          <Button asChild>
            <Link to="/create-task">Создать первый заказ</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => {
            const count = responseCounts[task.id] || 0;
            return (
              <TaskCard
                key={task.id}
                task={task}
                showFullAddress
                onClick={() => navigate(`/task/${task.id}`)}
              >
                {count > 0 && (
                  <p className="text-xs text-primary font-medium mt-1">
                    {count} {count === 1 ? 'отклик' : count < 5 ? 'отклика' : 'откликов'} — нажмите, чтобы посмотреть
                  </p>
                )}
              </TaskCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

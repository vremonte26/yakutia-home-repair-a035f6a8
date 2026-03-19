import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { TaskCard } from '@/components/TaskCard';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ClientDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('tasks')
      .select('*')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTasks(data ?? []);
        setLoading(false);
      });
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
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={() => {}} />
          ))}
        </div>
      )}
    </div>
  );
}

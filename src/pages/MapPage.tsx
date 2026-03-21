import { TaskMap } from '@/components/TaskMap';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';

export default function MapPage() {
  const { profile } = useAuth();
  const mode = profile?.role === 'master' ? 'master' : 'client';

  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-xl font-extrabold">Карта заказов</h1>
        <TaskMap mode={mode} />
      </div>
    </AppLayout>
  );
}

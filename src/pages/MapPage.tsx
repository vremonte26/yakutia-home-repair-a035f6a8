import { TaskMap } from '@/components/TaskMap';
import { AppLayout } from '@/components/AppLayout';

export default function MapPage() {
  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-xl font-extrabold">Карта заказов</h1>
        <TaskMap mode="master" />
      </div>
    </AppLayout>
  );
}

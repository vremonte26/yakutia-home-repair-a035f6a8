import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CategoryBadge } from './CategoryBadge';
import { TASK_STATUS_LABELS, type TaskStatus } from '@/lib/constants';
import { MapPin, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    description: string | null;
    category: string;
    address: string | null;
    status: TaskStatus;
    created_at: string;
  };
  onClick?: () => void;
  children?: React.ReactNode;
}

const statusVariant: Record<TaskStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  open: 'default',
  in_progress: 'secondary',
  completed: 'outline',
  cancelled: 'destructive',
};

export function TaskCard({ task, onClick, children }: TaskCardProps) {
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow animate-fade-in"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold leading-tight">{task.title}</CardTitle>
          <Badge variant={statusVariant[task.status]} className="shrink-0 text-xs">
            {TASK_STATUS_LABELS[task.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <CategoryBadge value={task.category} size="sm" />
        {task.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {task.address && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {task.address}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(task.created_at), { addSuffix: true, locale: ru })}
          </span>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

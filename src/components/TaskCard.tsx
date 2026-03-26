import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CategoryBadge } from './CategoryBadge';
import { UserRating } from './UserRating';
import { TASK_STATUS_LABELS, type TaskStatus } from '@/lib/constants';
import { MapPin, Clock, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ClientInfo {
  name: string;
  rating: number | null;
  reviewCount: number;
}

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    description: string | null;
    category: string;
    address: string | null;
    address_area?: string | null;
    address_full?: string | null;
    status: TaskStatus;
    created_at: string;
  };
  clientInfo?: ClientInfo;
  showFullAddress?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

const statusVariant: Record<TaskStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  open: 'default',
  in_progress: 'secondary',
  completed: 'outline',
  cancelled: 'destructive',
};

export function TaskCard({ task, clientInfo, showFullAddress, onClick, children }: TaskCardProps) {
  const displayAddress = showFullAddress
    ? (task.address_full || task.address)
    : (task.address_area || task.address);
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
          {displayAddress && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {displayAddress}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(task.created_at), { addSuffix: true, locale: ru })}
          </span>
        </div>
        {clientInfo && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span>{clientInfo.name || 'Клиент'}</span>
            <UserRating rating={clientInfo.rating} reviewCount={clientInfo.reviewCount} size="sm" showEmpty />
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

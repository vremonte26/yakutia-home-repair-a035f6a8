import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Bell, CheckCheck } from 'lucide-react';

export default function NotificationsPage() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications();
  const navigate = useNavigate();

  const handleClick = async (n: { id: string; link: string | null; is_read: boolean }) => {
    if (!n.is_read) await markAsRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Уведомления</h1>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            <CheckCheck className="h-4 w-4 mr-1" />
            Прочитать всё
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <Bell className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Уведомлений пока нет</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <Card
              key={n.id}
              onClick={() => handleClick(n)}
              className={`p-3 cursor-pointer hover:bg-accent/40 transition-colors ${
                !n.is_read ? 'border-primary/40 bg-primary/5' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`text-sm flex-1 ${!n.is_read ? 'font-bold' : 'font-medium'}`}>
                  {n.title}
                </p>
                {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
              </div>
              <p className={`text-xs mt-1 line-clamp-2 ${!n.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                {n.body}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ru })}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
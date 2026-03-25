import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleClick = async (notif: { id: string; link: string | null; is_read: boolean }) => {
    if (!notif.is_read) await markAsRead(notif.id);
    setOpen(false);
    if (notif.link) navigate(notif.link);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm">Уведомления</p>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-auto py-1" onClick={markAllAsRead}>
              Прочитать все
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Нет уведомлений</p>
          ) : (
            notifications.map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-4 py-3 border-b last:border-0 hover:bg-accent/50 transition-colors ${
                  !n.is_read ? 'bg-accent/30' : ''
                }`}
              >
                <p className={`text-sm ${!n.is_read ? 'font-semibold' : 'font-normal'}`}>{n.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ru })}
                </p>
              </button>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

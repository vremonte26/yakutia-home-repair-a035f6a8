import { ReactNode, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, PlusCircle, User, Wrench, ClipboardList, Map, MessageCircle } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, user, refreshProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [switching, setSwitching] = useState(false);

  const isMaster = profile?.role === 'master';

  const toggleRole = async () => {
    if (!user || !profile || switching) return;
    const newRole = isMaster ? 'client' : 'master';
    setSwitching(true);
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', user.id);
    if (error) {
      toast({ title: 'Не удалось переключить роль', description: error.message, variant: 'destructive' });
      setSwitching(false);
      return;
    }
    await refreshProfile();
    setSwitching(false);
    navigate('/');
  };

  const navItems = isMaster
    ? [
        { to: '/', icon: ClipboardList, label: 'Лента' },
        { to: '/map', icon: Map, label: 'Карта' },
        { to: '/chats', icon: MessageCircle, label: 'Чаты' },
        { to: '/my-responses', icon: Wrench, label: 'Отклики' },
        { to: '/profile', icon: User, label: 'Профиль' },
      ]
    : [
        { to: '/', icon: Home, label: 'Лента' },
        { to: '/map', icon: Map, label: 'Карта' },
        { to: '/chats', icon: MessageCircle, label: 'Чаты' },
        { to: '/create-task', icon: PlusCircle, label: 'Создать' },
        { to: '/profile', icon: User, label: 'Профиль' },
      ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-secondary text-secondary-foreground border-b border-secondary shadow-sm px-4 py-3">
        <div className="container flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-secondary-foreground">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Wrench className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-extrabold text-lg">Времонте</span>
          </Link>
          <div className="flex items-center gap-2">
            {profile && <NotificationBell />}
            {profile && (
              <button
                type="button"
                onClick={toggleRole}
                disabled={switching}
                title="Переключить роль"
                className="text-xs px-2 py-1 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {isMaster ? '🔧 Мастер' : '👤 Клиент'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 container py-4 pb-20">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-lg border-t">
        <div className="container flex justify-around py-2">
          {navItems.map(item => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Link, useLocation } from 'react-router-dom';
import { Home, PlusCircle, User, Wrench, ClipboardList, Map } from 'lucide-react';

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const location = useLocation();

  const isMaster = profile?.role === 'master';

  const navItems = isMaster
    ? [
        { to: '/', icon: ClipboardList, label: 'Заказы' },
        { to: '/my-responses', icon: Wrench, label: 'Мои отклики' },
        { to: '/profile', icon: User, label: 'Профиль' },
      ]
    : [
        { to: '/', icon: Home, label: 'Главная' },
        { to: '/create-task', icon: PlusCircle, label: 'Создать' },
        { to: '/profile', icon: User, label: 'Профиль' },
      ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b px-4 py-3">
        <div className="container flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Wrench className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-extrabold text-lg">Времонте</span>
          </Link>
          {profile && (
            <span className="text-xs px-2 py-1 rounded-full bg-accent text-accent-foreground font-medium">
              {isMaster ? '🔧 Мастер' : '👤 Клиент'}
            </span>
          )}
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

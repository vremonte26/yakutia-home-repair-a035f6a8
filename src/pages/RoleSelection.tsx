import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User, Wrench, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export default function RoleSelection() {
  const { user, refreshProfile, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showNameInput, setShowNameInput] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const selectClient = async () => {
    setShowNameInput(true);
  };

  const confirmClient = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ role: 'client' as const, name: name.trim() || 'Клиент' })
      .eq('id', user.id);
    setLoading(false);
    if (error) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
      return;
    }
    await refreshProfile();
    navigate('/');
  };

  const selectMaster = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ role: 'master' as const })
      .eq('id', user.id);
    if (error) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
      return;
    }
    await refreshProfile();
    navigate('/master-setup');
  };

  if (showNameInput) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md space-y-6 animate-fade-in">
          <button
            type="button"
            onClick={() => setShowNameInput(false)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад
          </button>

          <div className="text-center space-y-2">
            <h1 className="text-2xl font-extrabold tracking-tight">Как вас зовут?</h1>
            <p className="text-muted-foreground text-sm">Можно пропустить</p>
          </div>

          <Input
            placeholder="Ваше имя"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />

          <Button className="w-full" onClick={confirmClient} disabled={loading}>
            {loading ? 'Загрузка...' : 'Продолжить'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-lg space-y-6 animate-fade-in">
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Выйти
        </button>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Кто вы?</h1>
          <p className="text-muted-foreground">Выберите вашу роль для начала работы</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card
            className="group cursor-pointer hover:border-primary hover:shadow-lg transition-all"
            onClick={selectClient}
          >
            <CardContent className="p-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-accent flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <User className="h-8 w-8" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Я клиент</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Ищу мастера для ремонта
                </p>
              </div>
              <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                Выбрать
              </Button>
            </CardContent>
          </Card>

          <Card
            className="group cursor-pointer hover:border-primary hover:shadow-lg transition-all"
            onClick={selectMaster}
          >
            <CardContent className="p-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-accent flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Wrench className="h-8 w-8" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Я мастер</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Выполняю ремонтные работы
                </p>
              </div>
              <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                Выбрать
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

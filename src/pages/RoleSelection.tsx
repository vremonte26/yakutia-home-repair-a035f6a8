import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Wrench } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export default function RoleSelection() {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const selectRole = async (role: 'client' | 'master') => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', user.id);
    if (error) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
      return;
    }
    await refreshProfile();
    if (role === 'master') {
      navigate('/master-setup');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-lg space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Кто вы?</h1>
          <p className="text-muted-foreground">Выберите вашу роль для начала работы</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card
            className="group cursor-pointer hover:border-primary hover:shadow-lg transition-all"
            onClick={() => selectRole('client')}
          >
            <CardContent className="p-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-accent flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <User className="h-8 w-8" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Клиент</h2>
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
            onClick={() => selectRole('master')}
          >
            <CardContent className="p-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-accent flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Wrench className="h-8 w-8" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Мастер</h2>
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

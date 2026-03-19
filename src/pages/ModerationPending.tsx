import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ModerationPending() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md animate-fade-in">
        <CardContent className="p-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-accent flex items-center justify-center">
            <Clock className="h-8 w-8 text-primary" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-xl font-extrabold tracking-tight">Анкета на проверке</h1>
            <p className="text-muted-foreground text-sm">
              Ваша анкета отправлена на проверку. Обычно это занимает до 24 часов.
            </p>
            <p className="text-muted-foreground text-sm">
              Мы сообщим, когда всё будет готово.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Пока использовать как клиент
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={signOut}>
              Выйти
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

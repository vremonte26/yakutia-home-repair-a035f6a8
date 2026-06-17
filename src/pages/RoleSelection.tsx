import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Wrench, User, Hammer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function RoleSelection() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRoleSelect = async (role: 'client' | 'master') => {
    if (!name.trim()) {
      setError('Введите ваше имя');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Сохраняем имя и роль через updateProfile (он работает с localStorage)
      await updateProfile({ 
        name: name.trim(),
        role: role 
      });

      if (role === 'master') {
        navigate('/master-setup');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError('Ошибка: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
            <Wrench className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Выберите роль</CardTitle>
          <CardDescription>
            Кто вы в приложении МастерБул?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Ваше имя</label>
            <Input
              placeholder="Введите ваше имя"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => handleRoleSelect('client')}
              disabled={loading || !name.trim()}
              className="h-20 flex-col gap-1"
              variant="outline"
            >
              <User className="h-6 w-6" />
              <span>Клиент</span>
            </Button>
            <Button
              onClick={() => handleRoleSelect('master')}
              disabled={loading || !name.trim()}
              className="h-20 flex-col gap-1"
              variant="outline"
            >
              <Hammer className="h-6 w-6" />
              <span>Мастер</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

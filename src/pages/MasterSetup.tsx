import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORIES, WORK_AREAS } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function MasterSetup() {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<string[]>([]);
  const [workArea, setWorkArea] = useState('');
  const [about, setAbout] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleCategory = (val: string) => {
    setCategories(prev =>
      prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (categories.length === 0) {
      toast({ title: 'Выберите хотя бы одну категорию', variant: 'destructive' });
      return;
    }
    if (!workArea) {
      toast({ title: 'Выберите район работы', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        role: 'master' as const,
        name: name.trim() || undefined,
        categories,
        work_area: workArea,
        about,
        phone: phone || undefined,
        is_verified: false,
      })
      .eq('id', user.id);
    setLoading(false);
    if (error) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
      return;
    }
    await refreshProfile();
    navigate('/moderation-pending');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-lg animate-fade-in">
        <CardHeader>
          <button
            type="button"
            onClick={() => navigate('/role-selection')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад
          </button>
          <CardTitle className="text-xl font-extrabold">Анкета мастера</CardTitle>
          <CardDescription>Заполните анкету для прохождения модерации</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ваше имя</label>
              <Input
                placeholder="Иван Иванов"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Телефон для связи</label>
              <Input
                placeholder="+7 (___) ___-__-__"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Категории работ</label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map(cat => (
                  <label
                    key={cat.value}
                    className="flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer hover:bg-accent transition-colors"
                  >
                    <Checkbox
                      checked={categories.includes(cat.value)}
                      onCheckedChange={() => toggleCategory(cat.value)}
                    />
                    <span className="text-sm">
                      {cat.icon} {cat.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Район работы</label>
              <Select value={workArea} onValueChange={setWorkArea}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите район" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_AREAS.map(area => (
                    <SelectItem key={area} value={area}>{area}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">О себе</label>
              <Textarea
                placeholder="Опыт работы, специализация, доступность..."
                value={about}
                onChange={e => setAbout(e.target.value)}
                rows={3}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Отправка...' : 'Отправить на модерацию'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

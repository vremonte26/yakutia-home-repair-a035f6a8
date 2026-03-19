import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CategoryBadge } from '@/components/CategoryBadge';
import { Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает',
  accepted: 'Принят',
  rejected: 'Отклонён',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  pending: 'secondary',
  accepted: 'default',
  rejected: 'destructive',
};

export default function MyResponses() {
  const { user } = useAuth();
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('responses')
      .select('*, tasks(*)')
      .eq('master_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setResponses(data ?? []);
        setLoading(false);
      });
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-xl font-extrabold">Мои отклики</h1>

      {responses.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">Вы пока не откликались на заказы</p>
        </div>
      ) : (
        <div className="space-y-3">
          {responses.map(r => (
            <Card key={r.id} className="animate-fade-in">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold">{r.tasks?.title}</CardTitle>
                  <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {r.tasks?.category && <CategoryBadge value={r.tasks.category} size="sm" />}
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ru })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

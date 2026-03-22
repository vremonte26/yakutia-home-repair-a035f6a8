import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CategoryBadge } from '@/components/CategoryBadge';
import { Clock, X, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const navigate = useNavigate();
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

  const fetchResponses = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('responses')
      .select('*, tasks(*)')
      .eq('master_id', user.id)
      .order('created_at', { ascending: false });
    setResponses(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchResponses();
  }, [user]);

  const withdrawResponse = async (responseId: string) => {
    setWithdrawing(responseId);
    const { error } = await supabase
      .from('responses')
      .delete()
      .eq('id', responseId);

    if (error) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Отклик отозван' });
      await fetchResponses();
    }
    setWithdrawing(null);
  };

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

                {r.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 mt-1"
                    disabled={withdrawing === r.id}
                    onClick={() => withdrawResponse(r.id)}
                  >
                    <X className="h-3.5 w-3.5" /> Отозвать отклик
                  </Button>
                )}

                {r.status === 'accepted' && (
                  <p className="text-xs text-muted-foreground italic">
                    Вы выбраны исполнителем. Свяжитесь с клиентом через чат.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReviewThread } from '@/components/ReviewThread';
import { ArrowLeft, Star } from 'lucide-react';

type Filter = 'all' | 5 | 4 | 3 | 2 | 1;

export default function MyReviews() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  // Mark all as seen on mount
  useEffect(() => {
    if (!user) return;
    const lastSeenKey = `reviews:lastSeen:${user.id}`;
    localStorage.setItem(lastSeenKey, new Date().toISOString());
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-extrabold">Отзывы обо мне</h1>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Фильтр по оценке
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              Все
            </Button>
            {[5, 4, 3, 2, 1].map(n => (
              <Button
                key={n}
                size="sm"
                variant={filter === n ? 'default' : 'outline'}
                onClick={() => setFilter(n as Filter)}
                className="gap-1"
              >
                {n}
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <ReviewThread
            key={`${filter}-${refreshKey}`}
            profileUserId={user.id}
            ratingFilter={filter === 'all' ? undefined : filter}
            emptyText="Нет отзывов с такой оценкой"
          />
        </CardContent>
      </Card>
    </div>
  );
}

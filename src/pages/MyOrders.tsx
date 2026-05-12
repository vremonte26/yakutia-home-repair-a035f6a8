import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CategoryBadge } from '@/components/CategoryBadge';
import { TASK_STATUS_LABELS, type TaskStatus } from '@/lib/constants';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search, Loader2 } from 'lucide-react';

const PAGE_SIZE = 10;

type StatusFilter = 'all' | 'active' | 'completed' | 'cancelled';

const STATUS_BADGE: Record<TaskStatus, string> = {
  open: 'bg-blue-100 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function MyOrders() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(0);
  const [tasks, setTasks] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [status]);

  const fetchPage = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from('tasks')
      .select('*', { count: 'exact' })
      .eq('client_id', user.id);

    if (status === 'active') {
      query = query.in('status', ['open', 'in_progress']);
    } else if (status === 'completed') {
      query = query.eq('status', 'completed');
    } else if (status === 'cancelled') {
      query = query.eq('status', 'cancelled');
    }

    if (debouncedSearch) {
      const escaped = debouncedSearch.replace(/[%,()]/g, '\\$&');
      query = query.or(
        `title.ilike.%${escaped}%,description.ilike.%${escaped}%,category.ilike.%${escaped}%`
      );
    }

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!error) {
      setTasks(data ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [user, status, debouncedSearch, page]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  if (profile && profile.role !== 'client') {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Раздел доступен только клиентам
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-xl font-extrabold">История заказов</h1>

      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по заголовку, описанию, категории"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все</SelectItem>
            <SelectItem value="active">Активные</SelectItem>
            <SelectItem value="completed">Завершённые</SelectItem>
            <SelectItem value="cancelled">Отменённые</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          {debouncedSearch || status !== 'all' ? 'Ничего не найдено' : 'У вас пока нет заказов'}
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => (
            <Card
              key={task.id}
              className="p-3 cursor-pointer hover:bg-accent/40 transition-colors"
              onClick={() => navigate(`/task/${task.id}`)}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-semibold text-sm line-clamp-2 flex-1">{task.title}</h3>
                <Badge variant="outline" className={`shrink-0 text-xs ${STATUS_BADGE[task.status as TaskStatus] ?? ''}`}>
                  {TASK_STATUS_LABELS[task.status as TaskStatus] ?? task.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CategoryBadge value={task.category} size="sm" />
                  <span>{new Date(task.created_at).toLocaleDateString('ru-RU')}</span>
                </div>
                {task.price != null && (
                  <span className="text-sm font-bold">{Number(task.price).toLocaleString('ru-RU')} ₽</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Назад
          </Button>
          <span className="text-xs text-muted-foreground">
            Стр. {page + 1} из {totalPages} · всего {total}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => (p + 1 < totalPages ? p + 1 : p))}
            disabled={page + 1 >= totalPages || loading}
          >
            Вперёд <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
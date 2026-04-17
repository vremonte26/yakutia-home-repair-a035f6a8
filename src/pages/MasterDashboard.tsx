import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { TaskCard } from '@/components/TaskCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CATEGORIES } from '@/lib/constants';
import { LocateFixed } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


export default function MasterDashboard() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<any[]>([]);
  const [respondedTaskIds, setRespondedTaskIds] = useState<Set<string>>(new Set());
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [clientProfiles, setClientProfiles] = useState<Record<string, { name: string; rating: number | null }>>({});
  const [clientReviewCounts, setClientReviewCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoActive, setGeoActive] = useState(false);
  const [geoUnavailable, setGeoUnavailable] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!user) return;

      // By default, use geolocation to load nearby tasks
      let useGeo = true;
      let userLat = 0;
      let userLng = 0;

      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
        );
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;
      } catch {
        useGeo = false;
        setGeoUnavailable(true);
      }

      let query = supabase
        .from('tasks')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (filter) {
        query = query.eq('category', filter);
      }

      const { data: tasksData } = await query;
      
      let filteredTasks = tasksData ?? [];
      if (useGeo) {
        filteredTasks = filteredTasks.filter(t =>
          t.lat != null && t.lng != null && haversineKm(userLat, userLng, t.lat!, t.lng!) <= 50
        );
      }
      setTasks(filteredTasks);

      // Get my existing responses
      const { data: myResponses } = await supabase
        .from('responses')
        .select('task_id')
        .eq('master_id', user.id);

      setRespondedTaskIds(new Set((myResponses ?? []).map(r => r.task_id)));

      // Get response counts for each task
      if (tasksData && tasksData.length > 0) {
        const taskIds = tasksData.map(t => t.id);
        const { data: allResponses } = await supabase
          .from('responses')
          .select('task_id')
          .in('task_id', taskIds)
          .neq('status', 'rejected');

        const counts: Record<string, number> = {};
        (allResponses ?? []).forEach(r => {
          counts[r.task_id] = (counts[r.task_id] || 0) + 1;
        });
        setResponseCounts(counts);

        // Fetch client profiles
        const clientIds = [...new Set(tasksData.map((t: any) => t.client_id))];
        if (clientIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, rating')
            .in('id', clientIds);

          const profileMap: Record<string, { name: string; rating: number | null }> = {};
          (profiles ?? []).forEach((p: any) => {
            profileMap[p.id] = { name: p.name, rating: p.rating };
          });
          setClientProfiles(profileMap);

          // Fetch review counts for clients
          const { data: reviewData } = await supabase
            .from('reviews')
            .select('to_user')
            .in('to_user', clientIds);

          const rcounts: Record<string, number> = {};
          (reviewData ?? []).forEach((r: any) => {
            rcounts[r.to_user] = (rcounts[r.to_user] || 0) + 1;
          });
          setClientReviewCounts(rcounts);
        }
      }

      setLoading(false);
    };

    fetchTasks();
  }, [filter, user, refreshKey]);

  const respond = async (taskId: string) => {
    if (!user) return;

    const task = tasks.find(t => t.id === taskId);
    if (task?.client_id === user.id) {
      toast({ title: 'Нельзя откликнуться на свою собственную заявку', variant: 'destructive' });
      return;
    }

    if ((responseCounts[taskId] || 0) >= 5) {
      toast({ title: 'Максимум откликов на этот заказ', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('responses').insert({
      task_id: taskId,
      master_id: user.id,
    });
    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Вы уже откликнулись на этот заказ', variant: 'destructive' });
      } else if (error.message?.includes('Cannot respond to your own task')) {
        toast({ title: 'Нельзя откликнуться на свою собственную заявку', variant: 'destructive' });
      } else if (error.message?.includes('Maximum 5')) {
        toast({ title: 'Максимум 5 откликов на заказ', variant: 'destructive' });
      } else {
        toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
      }
      return;
    }
    setRespondedTaskIds(prev => new Set(prev).add(taskId));
    setResponseCounts(prev => ({ ...prev, [taskId]: (prev[taskId] || 0) + 1 }));
    toast({ title: 'Отклик отправлен!' });
  };

  const handleGeoRefresh = useCallback(async () => {
    if (!navigator.geolocation) {
      toast({ title: 'Геолокация не поддерживается вашим браузером', variant: 'destructive' });
      return;
    }
    setGeoLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      );
      const { latitude, longitude } = pos.coords;
      console.log('[GeoRefresh] Координаты мастера:', { latitude, longitude });

      let query = supabase
        .from('tasks')
        .select('*')
        .eq('status', 'open')
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .order('created_at', { ascending: false });

      if (filter) query = query.eq('category', filter);

      const { data, error } = await query;
      if (error) {
        console.error('[GeoRefresh] Ошибка запроса:', error);
        throw error;
      }

      console.log('[GeoRefresh] Всего заказов с координатами:', data?.length ?? 0);
      if (data && data.length > 0) {
        data.forEach(t => {
          const dist = haversineKm(latitude, longitude, t.lat!, t.lng!);
          console.log(`[GeoRefresh] Заказ "${t.title}" (${t.id}): lat=${t.lat}, lng=${t.lng}, расстояние=${dist.toFixed(1)} км`);
        });
      }

      const nearby = (data ?? []).filter(t =>
        haversineKm(latitude, longitude, t.lat!, t.lng!) <= 50
      );
      console.log('[GeoRefresh] Заказов в радиусе 50 км:', nearby.length);

      setTasks(nearby);
      setGeoActive(true);

      if (nearby.length === 0) {
        toast({ title: 'Рядом пока нет заказов' });
      } else {
        toast({ title: `Найдено ${nearby.length} заказов рядом` });
      }

      // refresh auxiliary data for nearby tasks
      if (nearby.length > 0) {
        const taskIds = nearby.map(t => t.id);
        const [{ data: myResp }, { data: allResp }] = await Promise.all([
          supabase.from('responses').select('task_id').eq('master_id', user!.id),
          supabase.from('responses').select('task_id').in('task_id', taskIds).neq('status', 'rejected'),
        ]);
        setRespondedTaskIds(new Set((myResp ?? []).map(r => r.task_id)));
        const counts: Record<string, number> = {};
        (allResp ?? []).forEach(r => { counts[r.task_id] = (counts[r.task_id] || 0) + 1; });
        setResponseCounts(counts);

        const clientIds = [...new Set(nearby.map(t => t.client_id))];
        const [{ data: profs }, { data: revs }] = await Promise.all([
          supabase.from('profiles').select('id, name, rating').in('id', clientIds),
          supabase.from('reviews').select('to_user').in('to_user', clientIds),
        ]);
        const pm: Record<string, { name: string; rating: number | null }> = {};
        (profs ?? []).forEach((p: any) => { pm[p.id] = { name: p.name, rating: p.rating }; });
        setClientProfiles(pm);
        const rc: Record<string, number> = {};
        (revs ?? []).forEach((r: any) => { rc[r.to_user] = (rc[r.to_user] || 0) + 1; });
        setClientReviewCounts(rc);
      }
    } catch (err: any) {
      if (err?.code === 1) {
        toast({ title: 'Не удалось определить местоположение', description: 'Разрешите доступ к геолокации в настройках браузера', variant: 'destructive' });
      } else if (err?.code === 2 || err?.code === 3) {
        toast({ title: 'Не удалось определить местоположение', description: 'Проверьте подключение к интернету и настройки геолокации', variant: 'destructive' });
      } else {
        toast({ title: 'Ошибка при загрузке заказов', description: err?.message || 'Попробуйте позже', variant: 'destructive' });
      }
    } finally {
      setGeoLoading(false);
    }
  }, [filter, user, toast]);

  const handleResetGeo = () => {
    setGeoActive(false);
    setRefreshKey(k => k + 1);
  };

  if (!profile?.is_verified) {
    return (
      <div className="text-center py-20 space-y-3 animate-fade-in">
        <div className="text-4xl">⏳</div>
        <h2 className="text-xl font-bold">Анкета на модерации</h2>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Ваша анкета отправлена на проверку. После одобрения вы сможете видеть и откликаться на заказы.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Доступные заказы</h1>
        <div className="flex items-center gap-2">
          {geoActive && (
            <Button variant="ghost" size="sm" onClick={handleResetGeo} className="text-xs text-muted-foreground">
              Сбросить
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleGeoRefresh}
            disabled={geoLoading}
            className="shrink-0 gap-1.5"
          >
            {geoLoading ? (
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            ) : (
              <LocateFixed className="h-4 w-4" />
            )}
            <span className="text-xs">Обновить ленту</span>
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Badge
          variant={filter === null ? 'default' : 'outline'}
          className="cursor-pointer shrink-0"
          onClick={() => setFilter(null)}
        >
          Все
        </Badge>
        {CATEGORIES.map(cat => (
          <Badge
            key={cat.value}
            variant={filter === cat.value ? 'default' : 'outline'}
            className="cursor-pointer shrink-0"
            onClick={() => setFilter(cat.value)}
          >
            {cat.icon} {cat.label}
          </Badge>
        ))}
      </div>

      {geoUnavailable && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Для поиска заказов включите геолокацию в настройках браузера
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">{geoUnavailable ? 'Включите геолокацию для отображения заказов' : 'Нет доступных заказов'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => {
            const alreadyResponded = respondedTaskIds.has(task.id);
            const count = responseCounts[task.id] || 0;
            const isFull = count >= 5;
            const isOwnTask = task.client_id === user?.id;

            return (
              <TaskCard key={task.id} task={task} clientInfo={
                clientProfiles[task.client_id]
                  ? { ...clientProfiles[task.client_id], reviewCount: clientReviewCounts[task.client_id] || 0 }
                  : undefined
              }>
                <div className="flex items-center justify-between mt-2 gap-2">
                  <span className="text-xs text-muted-foreground">{count}/5 откликов</span>
                  {isOwnTask ? (
                    <span className="text-xs text-muted-foreground italic">Ваша заявка</span>
                  ) : (
                    <Button
                      size="sm"
                      disabled={alreadyResponded || isFull}
                      onClick={e => {
                        e.stopPropagation();
                        respond(task.id);
                      }}
                    >
                      {alreadyResponded ? '✓ Вы откликнулись' : isFull ? 'Набрано' : 'Откликнуться'}
                    </Button>
                  )}
                </div>
              </TaskCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

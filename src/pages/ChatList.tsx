import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { User, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ChatPreview {
  taskId: string;
  taskTitle: string;
  otherUserId: string;
  otherUserName: string;
  otherUserPhoto: string | null;
  lastMessage: string | null;
  lastMessageAt: string;
  unread: boolean;
}

export default function ChatList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChats = async () => {
    if (!user) return;

    // Get tasks where user is involved and status is in_progress or completed
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, client_id, status, created_at')
      .in('status', ['in_progress', 'completed']);

    if (!tasks || tasks.length === 0) {
      setChats([]);
      setLoading(false);
      return;
    }

    // Get accepted responses to find master for each task
    const taskIds = tasks.map(t => t.id);
    const { data: acceptedResponses } = await supabase
      .from('responses')
      .select('task_id, master_id')
      .in('task_id', taskIds)
      .eq('status', 'accepted');

    if (!acceptedResponses) {
      setChats([]);
      setLoading(false);
      return;
    }

    // Filter tasks where user is client or accepted master
    const relevantTasks = tasks.filter(t => {
      if (t.client_id === user.id) return true;
      return acceptedResponses.some(r => r.task_id === t.id && r.master_id === user.id);
    });

    if (relevantTasks.length === 0) {
      setChats([]);
      setLoading(false);
      return;
    }

    // Get other user ids
    const otherUserIds = new Set<string>();
    const taskUserMap: Record<string, string> = {};
    for (const t of relevantTasks) {
      const resp = acceptedResponses.find(r => r.task_id === t.id);
      if (!resp) continue;
      const otherId = t.client_id === user.id ? resp.master_id : t.client_id;
      otherUserIds.add(otherId);
      taskUserMap[t.id] = otherId;
    }

    // Fetch profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, photo')
      .in('id', Array.from(otherUserIds));

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

    // Get last message for each task
    const chatPreviews: ChatPreview[] = [];
    for (const t of relevantTasks) {
      const otherId = taskUserMap[t.id];
      if (!otherId) continue;

      const { data: lastMsg } = await supabase
        .from('messages')
        .select('text, image_url, created_at')
        .eq('task_id', t.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const profile = profileMap.get(otherId);
      const msg = lastMsg?.[0];

      // Only show chats that have messages or are in_progress
      chatPreviews.push({
        taskId: t.id,
        taskTitle: t.title,
        otherUserId: otherId,
        otherUserName: profile?.name ?? 'Пользователь',
        otherUserPhoto: profile?.photo ?? null,
        lastMessage: msg?.text ?? (msg?.image_url ? '📷 Фото' : null),
        lastMessageAt: msg?.created_at ?? t.created_at ?? new Date().toISOString(),
        unread: false,
      });
    }

    chatPreviews.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    setChats(chatPreviews);
    setLoading(false);
  };

  useEffect(() => {
    fetchChats();
  }, [user]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('chat-list-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchChats();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="text-center py-20 space-y-2">
        <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50" />
        <p className="text-muted-foreground">Нет активных чатов</p>
        <p className="text-xs text-muted-foreground">Чат появится после выбора мастера</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 animate-fade-in">
      <h1 className="text-lg font-bold mb-3">Чаты</h1>
      {chats.map(chat => (
        <Card
          key={chat.taskId}
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate(`/chat/${chat.taskId}`)}
        >
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
              {chat.otherUserPhoto ? (
                <img src={chat.otherUserPhoto} className="w-10 h-10 rounded-full object-cover" alt="" />
              ) : (
                <User className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm truncate">{chat.otherUserName}</p>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(chat.lastMessageAt), { addSuffix: true, locale: ru })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{chat.taskTitle}</p>
              {chat.lastMessage && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{chat.lastMessage}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

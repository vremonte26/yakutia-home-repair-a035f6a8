import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Send, User, RefreshCw, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  from_user: string;
  to_user: string;
  text: string | null;
  image_url: string | null;
  created_at: string;
}

type ChatState = 'loading' | 'active' | 'reserve' | 'readonly' | 'no_access';

export default function ChatRoom() {
  const { taskId } = useParams<{ taskId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<{ id: string; name: string; photo: string | null } | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [chatState, setChatState] = useState<ChatState>('loading');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchMessages = useCallback(async () => {
    if (!taskId) return;
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
    setMessages((msgs as Message[]) ?? []);
  }, [taskId]);

  useEffect(() => {
    if (!taskId || !user) return;

    const init = async () => {
      const { data: task } = await supabase
        .from('tasks')
        .select('id, title, client_id, status')
        .eq('id', taskId)
        .single();

      if (!task) {
        console.warn('[Chat] ❌ Task not found:', taskId);
        navigate('/chats');
        return;
      }

      setTaskTitle(task.title);
      console.log('[Chat] === ЗАГРУЗКА ЧАТА ===');
      console.log('[Chat] ID заказа:', taskId);
      console.log('[Chat] Статус заказа:', task.status);
      console.log('[Chat] ID пользователя:', user.id);
      console.log('[Chat] ID клиента:', task.client_id);

      // Check for accepted response (selected master)
      const { data: acceptedResp } = await supabase
        .from('responses')
        .select('master_id')
        .eq('task_id', taskId)
        .eq('status', 'accepted')
        .limit(1)
        .single();

      const masterId = acceptedResp?.master_id ?? null;
      console.log('[Chat] ID выбранного мастера:', masterId);

      const isClient = user.id === task.client_id;

      // If no master selected yet
      if (!acceptedResp) {
        // Check if this user has a pending response (master in reserve)
        if (!isClient) {
          const { data: pendingResp } = await supabase
            .from('responses')
            .select('id')
            .eq('task_id', taskId)
            .eq('master_id', user.id)
            .eq('status', 'pending')
            .limit(1)
            .single();

          if (pendingResp) {
            console.log('[Chat] Мастер в резерве (отклик pending)');
            setChatState('reserve');
          } else {
            console.log('[Chat] Нет доступа к чату');
            setChatState('no_access');
          }
        } else {
          console.log('[Chat] Клиент — мастер ещё не выбран');
          setChatState('reserve');
        }
        return;
      }

      const isMaster = user.id === masterId;
      const isParticipant = isClient || isMaster;

      if (!isParticipant) {
        console.log('[Chat] Нет доступа: не участник');
        navigate('/chats');
        return;
      }

      const isActive = task.status === 'in_progress';
      console.log('[Chat] Участник:', isParticipant, '| Активен:', isActive);

      if (isActive) {
        setChatState('active');
      } else {
        setChatState('readonly');
      }

      const otherId = isClient ? masterId! : task.client_id;
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, photo')
        .eq('id', otherId)
        .single();

      setOtherUser(profile);
      await fetchMessages();
    };

    init();
  }, [taskId, user, fetchMessages, navigate]);

  // Realtime messages
  useEffect(() => {
    if (!taskId || !user) return;
    const channel = supabase
      .channel(`chat-${taskId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `task_id=eq.${taskId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [taskId, user]);

  // Listen for response acceptance (master gets notified)
  useEffect(() => {
    if (!taskId || !user) return;
    const channel = supabase
      .channel(`response-status-${taskId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'responses', filter: `task_id=eq.${taskId}` },
        (payload) => {
          const updated = payload.new as { master_id: string; status: string };
          if (updated.status === 'accepted' && updated.master_id === user.id) {
            toast({
              title: '🎉 Вас выбрали исполнителем!',
              description: `Заказ «${taskTitle || 'Новый заказ'}». Перейдите в чат для уточнения деталей.`,
            });
            // Reload chat to activate
            window.location.reload();
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [taskId, user, taskTitle, toast]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Auto-focus
  useEffect(() => {
    if (chatState === 'active') {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [chatState]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMessages();
    setRefreshing(false);
  };

  const sendMessage = async (text?: string) => {
    if (!user || !otherUser || !taskId) return;
    if (!text?.trim()) return;

    setSending(true);
    const { error } = await supabase.from('messages').insert({
      task_id: taskId,
      from_user: user.id,
      to_user: otherUser.id,
      text: text.trim(),
      image_url: null,
    });

    if (error) {
      toast({ title: 'Ошибка отправки', variant: 'destructive' });
    } else {
      setNewMessage('');
      inputRef.current?.focus();
    }
    setSending(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(newMessage);
  };

  if (chatState === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (chatState === 'no_access') {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center gap-4">
        <p className="text-muted-foreground">У вас нет доступа к этому чату</p>
        <Button variant="outline" onClick={() => navigate('/chats')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> К чатам
        </Button>
      </div>
    );
  }

  if (chatState === 'reserve') {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
          <Clock className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Вы в резерве</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Когда клиент выберет вас исполнителем, здесь появится чат для обсуждения деталей заказа.
        </p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Назад
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -my-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-2 py-3 border-b bg-background shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/chats')} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
          {otherUser?.photo ? (
            <img src={otherUser.photo} className="w-8 h-8 rounded-full object-cover" alt="" />
          ) : (
            <User className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{otherUser?.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{taskTitle}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing} className="shrink-0">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-10">Начните диалог</p>
        )}
        {messages.map(msg => {
          const isMine = msg.from_user === user?.id;
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
              {!isMine && (
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                  {otherUser?.photo ? (
                    <img src={otherUser.photo} className="w-7 h-7 rounded-full object-cover" alt="" />
                  ) : (
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                  isMine
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-accent text-accent-foreground rounded-bl-md'
                }`}
              >
                <p className={`text-[10px] font-medium mb-0.5 ${isMine ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  {isMine ? 'Вы' : otherUser?.name ?? 'Собеседник'}
                </p>
                {msg.image_url && (
                  <img
                    src={msg.image_url}
                    alt=""
                    className="rounded-lg max-w-full mb-1 cursor-pointer"
                    onClick={() => window.open(msg.image_url!, '_blank')}
                  />
                )}
                {msg.text && <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>}
                <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {format(new Date(msg.created_at), 'HH:mm', { locale: ru })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input or readonly banner */}
      {chatState === 'active' ? (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-2 border-t bg-background shrink-0">
          <input
            ref={inputRef}
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="Сообщение..."
            autoFocus
            enterKeyHint="send"
            className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <Button type="submit" size="icon" disabled={sending || !newMessage.trim()} className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      ) : (
        <div className="px-3 py-3 border-t bg-muted/50 text-center shrink-0">
          <p className="text-xs text-muted-foreground">
            {chatState === 'readonly' ? 'Заказ завершён. Чат доступен только для чтения.' : 'Чат недоступен'}
          </p>
        </div>
      )}
    </div>
  );
}

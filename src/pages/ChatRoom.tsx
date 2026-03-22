import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ArrowLeft, Send, User, RefreshCw, Clock, Paperclip, Loader2, X } from 'lucide-react';
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
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<{ id: string; name: string; photo: string | null } | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [chatState, setChatState] = useState<ChatState>('loading');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolveSignedUrls = useCallback(async (msgs: Message[]) => {
    const imageMsgs = msgs.filter(m => m.image_url && !m.image_url.startsWith('http'));
    if (imageMsgs.length === 0) {
      // Some old messages may already have full URLs
      return;
    }
    const paths = imageMsgs.map(m => m.image_url!);
    const { data } = await supabase.storage
      .from('chat-images')
      .createSignedUrls(paths, 3600); // 1 hour
    if (data) {
      const urlMap: Record<string, string> = {};
      data.forEach(item => {
        if (item.signedUrl) {
          urlMap[item.path ?? ''] = item.signedUrl;
        }
      });
      setSignedUrls(prev => ({ ...prev, ...urlMap }));
    }
  }, []);

  const getImageUrl = useCallback((imageUrl: string | null) => {
    if (!imageUrl) return null;
    // Already a full URL (legacy or signed)
    if (imageUrl.startsWith('http')) return imageUrl;
    // Look up signed URL
    return signedUrls[imageUrl] || null;
  }, [signedUrls]);

  const fetchMessages = useCallback(async () => {
    if (!taskId) return;
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
    const result = (msgs as Message[]) ?? [];
    setMessages(result);
    await resolveSignedUrls(result);
  }, [taskId, resolveSignedUrls]);

  useEffect(() => {
    if (!taskId || !user) return;

    const init = async () => {
      const { data: task } = await supabase
        .from('tasks')
        .select('id, title, client_id, status')
        .eq('id', taskId)
        .single();

      if (!task) {
        navigate('/chats');
        return;
      }

      setTaskTitle(task.title);

      const { data: acceptedResp } = await supabase
        .from('responses')
        .select('master_id')
        .eq('task_id', taskId)
        .eq('status', 'accepted')
        .limit(1)
        .single();

      const masterId = acceptedResp?.master_id ?? null;
      const isClient = user.id === task.client_id;

      if (!acceptedResp) {
        if (!isClient) {
          const { data: pendingResp } = await supabase
            .from('responses')
            .select('id')
            .eq('task_id', taskId)
            .eq('master_id', user.id)
            .eq('status', 'pending')
            .limit(1)
            .single();

          setChatState(pendingResp ? 'reserve' : 'no_access');
        } else {
          setChatState('reserve');
        }
        return;
      }

      const isMaster = user.id === masterId;
      const isParticipant = isClient || isMaster;

      if (!isParticipant) {
        navigate('/chats');
        return;
      }

      setChatState(task.status === 'in_progress' ? 'active' : 'readonly');

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

  useEffect(() => {
    if (!taskId || !user) return;
    const channel = supabase
      .channel(`chat-${taskId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `task_id=eq.${taskId}` },
        async (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // Resolve signed URL for new image message
          if (newMsg.image_url && !newMsg.image_url.startsWith('http')) {
            await resolveSignedUrls([newMsg]);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [taskId, user, resolveSignedUrls]);

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
            window.location.reload();
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [taskId, user, taskTitle, toast]);

  // Auto-refresh signed URLs every 50 minutes
  useEffect(() => {
    if (messages.length === 0) return;
    const interval = setInterval(() => {
      resolveSignedUrls(messages);
    }, 50 * 60 * 1000);
    return () => clearInterval(interval);
  }, [messages, resolveSignedUrls]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

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

  const sendMessage = async (text?: string, imageUrl?: string) => {
    if (!user || !otherUser || !taskId) return;
    if (!text?.trim() && !imageUrl) return;

    setSending(true);
    const { error } = await supabase.from('messages').insert({
      task_id: taskId,
      from_user: user.id,
      to_user: otherUser.id,
      text: text?.trim() || null,
      image_url: imageUrl || null,
    });

    if (error) {
      toast({ title: 'Ошибка отправки', variant: 'destructive' });
    } else {
      setNewMessage('');
      inputRef.current?.focus();
    }
    setSending(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !taskId) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Можно отправлять только изображения', variant: 'destructive' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Максимальный размер фото — 5 МБ', variant: 'destructive' });
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const rand = Math.random().toString(36).substring(2, 8);
    const filePath = `${taskId}/${user.id}_${Date.now()}_${rand}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-images')
      .upload(filePath, file);

    if (uploadError) {
      toast({ title: 'Ошибка загрузки фото', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    // Store the file path (not a public URL) — signed URLs are generated on display
    await sendMessage(null, filePath);
    // Pre-resolve the signed URL for immediate display
    await resolveSignedUrls([{ image_url: filePath } as Message]);
    setUploading(false);

    if (fileInputRef.current) fileInputRef.current.value = '';
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
          const resolvedImageUrl = getImageUrl(msg.image_url);
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
                {msg.image_url && resolvedImageUrl && (
                  <img
                    src={resolvedImageUrl}
                    alt="Фото"
                    className="rounded-lg max-w-full max-h-52 object-cover mb-1 cursor-pointer"
                    onClick={() => setFullscreenImage(resolvedImageUrl)}
                  />
                )}
                {msg.image_url && !resolvedImageUrl && (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs">Загрузка фото...</span>
                  </div>
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
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Paperclip className="h-5 w-5" />
            )}
          </Button>
          <input
            ref={inputRef}
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="Сообщение..."
            autoFocus
            enterKeyHint="send"
            disabled={uploading}
            className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <Button type="submit" size="icon" disabled={sending || uploading || !newMessage.trim()} className="shrink-0">
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

      {/* Fullscreen image dialog */}
      <Dialog open={!!fullscreenImage} onOpenChange={() => setFullscreenImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-0 bg-black/90 flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 text-white hover:bg-white/20 z-10"
            onClick={() => setFullscreenImage(null)}
          >
            <X className="h-5 w-5" />
          </Button>
          {fullscreenImage && (
            <img
              src={fullscreenImage}
              alt="Фото"
              className="max-w-full max-h-[90vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, ImagePlus, User } from 'lucide-react';
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

export default function ChatRoom() {
  const { taskId } = useParams<{ taskId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<{ id: string; name: string; photo: string | null } | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!taskId || !user) return;

    const init = async () => {
      // Get task
      const { data: task } = await supabase
        .from('tasks')
        .select('id, title, client_id, status')
        .eq('id', taskId)
        .single();

      if (!task || !['in_progress', 'completed'].includes(task.status)) {
        navigate('/chats');
        return;
      }

      setTaskTitle(task.title);

      // Get accepted master
      const { data: resp } = await supabase
        .from('responses')
        .select('master_id')
        .eq('task_id', taskId)
        .eq('status', 'accepted')
        .limit(1)
        .single();

      if (!resp) {
        navigate('/chats');
        return;
      }

      const otherId = task.client_id === user.id ? resp.master_id : task.client_id;

      // Verify user is part of this chat
      if (user.id !== task.client_id && user.id !== resp.master_id) {
        navigate('/chats');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, photo')
        .eq('id', otherId)
        .single();

      setOtherUser(profile);

      // Fetch messages
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      setMessages((msgs as Message[]) ?? []);
      setLoading(false);
    };

    init();
  }, [taskId, user]);

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

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

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
    }
    setSending(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(newMessage);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const ext = file.name.split('.').pop();
    const path = `${taskId}/${user.id}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-images')
      .upload(path, file);

    if (uploadError) {
      toast({ title: 'Ошибка загрузки фото', variant: 'destructive' });
      return;
    }

    const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(path);
    await sendMessage(undefined, urlData.publicUrl);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
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
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{otherUser?.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{taskTitle}</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-10">Начните диалог</p>
        )}
        {messages.map(msg => {
          const isMine = msg.from_user === user?.id;
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                  isMine
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-accent text-accent-foreground rounded-bl-md'
                }`}
              >
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

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-2 border-t bg-background shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0"
        >
          <ImagePlus className="h-5 w-5" />
        </Button>
        <Input
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Сообщение..."
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={sending || !newMessage.trim()} className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

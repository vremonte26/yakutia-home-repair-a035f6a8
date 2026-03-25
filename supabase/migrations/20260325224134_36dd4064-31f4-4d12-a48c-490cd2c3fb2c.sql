
-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read own notifications
CREATE POLICY "Users can read own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- System can insert notifications (via triggers with SECURITY DEFINER)
CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger function: notify on new response
CREATE OR REPLACE FUNCTION public.notify_on_new_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_task RECORD;
  v_master_name text;
  v_response_count int;
BEGIN
  SELECT id, title, client_id INTO v_task FROM public.tasks WHERE id = NEW.task_id;
  SELECT name INTO v_master_name FROM public.profiles WHERE id = NEW.master_id;

  -- Notify client about new response
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    v_task.client_id,
    'response',
    'Новый отклик',
    'Мастер ' || COALESCE(v_master_name, '') || ' откликнулся на заявку «' || v_task.title || '»',
    '/task/' || v_task.id
  );

  -- Check if 5 responses reached
  SELECT COUNT(*) INTO v_response_count
  FROM public.responses
  WHERE task_id = NEW.task_id AND status != 'rejected';

  IF v_response_count >= 5 THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      v_task.client_id,
      'reminder',
      'Набрано 5 откликов',
      'На заявку «' || v_task.title || '» набрано 5 откликов. Пора выбрать мастера!',
      '/task/' || v_task.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_response
AFTER INSERT ON public.responses
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_response();

-- Trigger function: notify master when selected
CREATE OR REPLACE FUNCTION public.notify_on_master_selected()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_task RECORD;
BEGIN
  IF OLD.status != 'accepted' AND NEW.status = 'accepted' THEN
    SELECT id, title INTO v_task FROM public.tasks WHERE id = NEW.task_id;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      NEW.master_id,
      'selected',
      'Вас выбрали исполнителем!',
      'Вас выбрали исполнителем по заказу «' || v_task.title || '». Перейдите в чат для уточнения деталей.',
      '/chat/' || v_task.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_master_selected
AFTER UPDATE ON public.responses
FOR EACH ROW EXECUTE FUNCTION public.notify_on_master_selected();

-- Trigger function: notify on new chat message
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sender_name text;
  v_task_title text;
BEGIN
  SELECT name INTO v_sender_name FROM public.profiles WHERE id = NEW.from_user;
  SELECT title INTO v_task_title FROM public.tasks WHERE id = NEW.task_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    NEW.to_user,
    'message',
    'Новое сообщение',
    COALESCE(v_sender_name, 'Собеседник') || ': ' || COALESCE(LEFT(NEW.text, 100), '📷 Фото'),
    '/chat/' || NEW.task_id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_message();

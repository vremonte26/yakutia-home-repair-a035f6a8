
-- 1. Add notification preferences to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT jsonb_build_object(
    'push_enabled', true,
    'new_order', true,
    'new_response', true,
    'master_selected', true,
    'task_completed', true
  );

-- Helper: check pref (default true if missing)
CREATE OR REPLACE FUNCTION public.notif_pref_enabled(_user_id uuid, _key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (notification_prefs ->> _key)::boolean FROM public.profiles WHERE id = _user_id),
    true
  );
$$;

-- 2. Notify matching masters on new task
CREATE OR REPLACE FUNCTION public.notify_masters_on_new_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT
    p.id,
    'new_order',
    'Новый заказ в вашей категории',
    NEW.title,
    '/task/' || NEW.id
  FROM public.profiles p
  WHERE p.role = 'master'
    AND p.is_active = true
    AND p.is_verified = true
    AND p.id <> NEW.client_id
    AND NEW.category = ANY(p.categories)
    AND COALESCE((p.notification_prefs ->> 'new_order')::boolean, true) = true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_masters_on_new_task ON public.tasks;
CREATE TRIGGER trg_notify_masters_on_new_task
AFTER INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_masters_on_new_task();

-- 3. Notify both sides on task completion
CREATE OR REPLACE FUNCTION public.notify_on_task_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master uuid;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    -- Notify client
    IF public.notif_pref_enabled(NEW.client_id, 'task_completed') THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (
        NEW.client_id,
        'task_completed',
        'Заказ завершён',
        'Заказ «' || NEW.title || '» отмечен как завершённый.',
        '/task/' || NEW.id
      );
    END IF;

    -- Find selected master (accepted response)
    SELECT master_id INTO v_master
    FROM public.responses
    WHERE task_id = NEW.id AND status = 'accepted'
    LIMIT 1;

    IF v_master IS NOT NULL AND public.notif_pref_enabled(v_master, 'task_completed') THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (
        v_master,
        'task_completed',
        'Заказ завершён',
        'Заказ «' || NEW.title || '» отмечен как завершённый.',
        '/task/' || NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_task_completed ON public.tasks;
CREATE TRIGGER trg_notify_on_task_completed
AFTER UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_task_completed();

-- 4. Notify moderators on new complaint
CREATE OR REPLACE FUNCTION public.notify_moderators_on_complaint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT
    ur.user_id,
    'complaint',
    'Новая жалоба',
    'Поступила жалоба: ' || COALESCE(NEW.reason, ''),
    CASE WHEN NEW.task_id IS NOT NULL THEN '/task/' || NEW.task_id ELSE '/admin' END
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'moderator');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_moderators_on_complaint ON public.complaints;
CREATE TRIGGER trg_notify_moderators_on_complaint
AFTER INSERT ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.notify_moderators_on_complaint();

-- 5. Update existing triggers to respect preferences
CREATE OR REPLACE FUNCTION public.notify_on_master_selected()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
BEGIN
  IF OLD.status != 'accepted' AND NEW.status = 'accepted' THEN
    SELECT id, title INTO v_task FROM public.tasks WHERE id = NEW.task_id;

    IF public.notif_pref_enabled(NEW.master_id, 'master_selected') THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (
        NEW.master_id,
        'selected',
        'Вас выбрали исполнителем!',
        'Вас выбрали исполнителем по заказу «' || v_task.title || '». Перейдите в чат для уточнения деталей.',
        '/chat/' || v_task.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_new_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
  v_master_name text;
  v_response_count int;
BEGIN
  SELECT id, title, client_id INTO v_task FROM public.tasks WHERE id = NEW.task_id;
  SELECT name INTO v_master_name FROM public.profiles WHERE id = NEW.master_id;

  IF public.notif_pref_enabled(v_task.client_id, 'new_response') THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      v_task.client_id,
      'response',
      'Новый отклик',
      'Мастер ' || COALESCE(v_master_name, '') || ' откликнулся на заявку «' || v_task.title || '»',
      '/task/' || v_task.id
    );
  END IF;

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

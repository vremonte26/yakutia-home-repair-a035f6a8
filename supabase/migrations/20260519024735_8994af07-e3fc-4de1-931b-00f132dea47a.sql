
-- 1. Columns (active_role instead of current_role — reserved word)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS master_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS active_role app_role,
  ADD COLUMN IF NOT EXISTS master_pending_changes jsonb;

-- 2. Backfill
UPDATE public.profiles
SET
  active_role = COALESCE(active_role, role),
  client_data = CASE
    WHEN client_data = '{}'::jsonb THEN
      jsonb_strip_nulls(jsonb_build_object(
        'name', NULLIF(name, ''),
        'photo', photo,
        'phone', phone
      ))
    ELSE client_data
  END,
  master_data = CASE
    WHEN master_data = '{}'::jsonb AND role = 'master' THEN
      jsonb_strip_nulls(jsonb_build_object(
        'name', NULLIF(name, ''),
        'photo', photo,
        'phone', phone,
        'categories', to_jsonb(COALESCE(categories, ARRAY[]::text[])),
        'about', about,
        'work_area', work_area,
        'is_verified', is_verified,
        'rejection_reason', rejection_reason
      ))
    ELSE master_data
  END;

-- 3. Bidirectional sync trigger
CREATE OR REPLACE FUNCTION public.sync_role_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active jsonb;
  v_role app_role;
BEGIN
  IF NEW.active_role IS NULL THEN
    NEW.active_role := NEW.role;
  END IF;
  v_role := NEW.active_role;

  IF TG_OP = 'INSERT' OR
     NEW.active_role IS DISTINCT FROM OLD.active_role OR
     (v_role = 'client' AND NEW.client_data IS DISTINCT FROM OLD.client_data) OR
     (v_role = 'master' AND NEW.master_data IS DISTINCT FROM OLD.master_data)
  THEN
    v_active := CASE WHEN v_role = 'master' THEN NEW.master_data ELSE NEW.client_data END;
    IF v_active IS NOT NULL AND v_active <> '{}'::jsonb THEN
      NEW.name := COALESCE(v_active->>'name', NEW.name, '');
      NEW.photo := v_active->>'photo';
      NEW.phone := COALESCE(v_active->>'phone', NEW.phone);
      IF v_role = 'master' THEN
        NEW.categories := COALESCE(
          ARRAY(SELECT jsonb_array_elements_text(v_active->'categories')),
          NEW.categories
        );
        NEW.about := v_active->>'about';
        NEW.work_area := v_active->>'work_area';
        IF v_active ? 'is_verified' THEN
          NEW.is_verified := (v_active->>'is_verified')::boolean;
        END IF;
        IF v_active ? 'rejection_reason' THEN
          NEW.rejection_reason := v_active->>'rejection_reason';
        END IF;
      END IF;
    END IF;
    NEW.role := v_role;
  ELSIF TG_OP = 'UPDATE' THEN
    IF v_role = 'client' THEN
      IF NEW.name IS DISTINCT FROM OLD.name OR NEW.photo IS DISTINCT FROM OLD.photo OR NEW.phone IS DISTINCT FROM OLD.phone THEN
        NEW.client_data := COALESCE(NEW.client_data, '{}'::jsonb)
          || jsonb_strip_nulls(jsonb_build_object('name', NEW.name, 'photo', NEW.photo, 'phone', NEW.phone));
      END IF;
    ELSE
      IF NEW.name IS DISTINCT FROM OLD.name
         OR NEW.photo IS DISTINCT FROM OLD.photo
         OR NEW.phone IS DISTINCT FROM OLD.phone
         OR NEW.categories IS DISTINCT FROM OLD.categories
         OR NEW.about IS DISTINCT FROM OLD.about
         OR NEW.work_area IS DISTINCT FROM OLD.work_area
         OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
         OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
      THEN
        NEW.master_data := COALESCE(NEW.master_data, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
          'name', NEW.name,
          'photo', NEW.photo,
          'phone', NEW.phone,
          'categories', to_jsonb(COALESCE(NEW.categories, ARRAY[]::text[])),
          'about', NEW.about,
          'work_area', NEW.work_area,
          'is_verified', NEW.is_verified,
          'rejection_reason', NEW.rejection_reason
        ));
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_role_data ON public.profiles;
CREATE TRIGGER trg_sync_role_data
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_role_data();

-- 4. RPC functions
CREATE OR REPLACE FUNCTION public.upsert_client_data(_name text, _photo text, _phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.profiles
  SET client_data = jsonb_strip_nulls(jsonb_build_object(
        'name', NULLIF(_name, ''),
        'photo', _photo,
        'phone', _phone
      ))
  WHERE id = auth.uid();
END;$$;

CREATE OR REPLACE FUNCTION public.create_master_profile(_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT master_data INTO v_current FROM public.profiles WHERE id = auth.uid();
  IF v_current IS NOT NULL AND v_current <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Master profile already exists';
  END IF;
  UPDATE public.profiles
  SET master_data = _data || jsonb_build_object('is_verified', false)
  WHERE id = auth.uid();
END;$$;

CREATE OR REPLACE FUNCTION public.request_master_changes(_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.profiles
  SET master_pending_changes = _data
  WHERE id = auth.uid();
END;$$;

CREATE OR REPLACE FUNCTION public.switch_active_role(_new_role app_role)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_target jsonb; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT CASE WHEN _new_role = 'master' THEN master_data ELSE client_data END
    INTO v_target FROM public.profiles WHERE id = v_uid;
  IF v_target IS NULL OR v_target = '{}'::jsonb THEN
    RETURN jsonb_build_object('ok', false, 'needs_setup', true, 'role', _new_role);
  END IF;
  UPDATE public.profiles SET active_role = _new_role, role = _new_role WHERE id = v_uid;
  RETURN jsonb_build_object('ok', true, 'role', _new_role);
END;$$;

CREATE OR REPLACE FUNCTION public.approve_master_changes(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pending jsonb;
BEGIN
  IF NOT public.is_admin_or_moderator(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT master_pending_changes INTO v_pending FROM public.profiles WHERE id = _user_id;
  IF v_pending IS NULL THEN RETURN; END IF;
  UPDATE public.profiles
  SET master_data = COALESCE(master_data, '{}'::jsonb) || v_pending,
      master_pending_changes = NULL
  WHERE id = _user_id;
END;$$;

CREATE OR REPLACE FUNCTION public.reject_master_changes(_user_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_or_moderator(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.profiles SET master_pending_changes = NULL WHERE id = _user_id;
END;$$;

-- 5. Historical snapshot columns
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS client_name_snapshot text,
  ADD COLUMN IF NOT EXISTS client_photo_snapshot text;

ALTER TABLE public.responses
  ADD COLUMN IF NOT EXISTS master_name_snapshot text,
  ADD COLUMN IF NOT EXISTS master_photo_snapshot text;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS from_name_snapshot text,
  ADD COLUMN IF NOT EXISTS from_photo_snapshot text;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS from_name_snapshot text,
  ADD COLUMN IF NOT EXISTS from_photo_snapshot text;

CREATE OR REPLACE FUNCTION public.snapshot_author(_uid uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('name', name, 'photo', photo)
  FROM public.profiles WHERE id = _uid;
$$;

CREATE OR REPLACE FUNCTION public.snapshot_task_client()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s jsonb;
BEGIN
  IF NEW.client_name_snapshot IS NULL THEN
    s := public.snapshot_author(NEW.client_id);
    NEW.client_name_snapshot := s->>'name';
    NEW.client_photo_snapshot := s->>'photo';
  END IF;
  RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION public.snapshot_response_master()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s jsonb;
BEGIN
  IF NEW.master_name_snapshot IS NULL THEN
    s := public.snapshot_author(NEW.master_id);
    NEW.master_name_snapshot := s->>'name';
    NEW.master_photo_snapshot := s->>'photo';
  END IF;
  RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION public.snapshot_review_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s jsonb;
BEGIN
  IF NEW.from_name_snapshot IS NULL THEN
    s := public.snapshot_author(NEW.from_user);
    NEW.from_name_snapshot := s->>'name';
    NEW.from_photo_snapshot := s->>'photo';
  END IF;
  RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION public.snapshot_message_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s jsonb;
BEGIN
  IF NEW.from_name_snapshot IS NULL THEN
    s := public.snapshot_author(NEW.from_user);
    NEW.from_name_snapshot := s->>'name';
    NEW.from_photo_snapshot := s->>'photo';
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_snapshot_task_client ON public.tasks;
CREATE TRIGGER trg_snapshot_task_client BEFORE INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.snapshot_task_client();

DROP TRIGGER IF EXISTS trg_snapshot_response_master ON public.responses;
CREATE TRIGGER trg_snapshot_response_master BEFORE INSERT ON public.responses
FOR EACH ROW EXECUTE FUNCTION public.snapshot_response_master();

DROP TRIGGER IF EXISTS trg_snapshot_review_author ON public.reviews;
CREATE TRIGGER trg_snapshot_review_author BEFORE INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.snapshot_review_author();

DROP TRIGGER IF EXISTS trg_snapshot_message_author ON public.messages;
CREATE TRIGGER trg_snapshot_message_author BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.snapshot_message_author();

UPDATE public.tasks t SET
  client_name_snapshot = p.name,
  client_photo_snapshot = p.photo
FROM public.profiles p
WHERE p.id = t.client_id AND t.client_name_snapshot IS NULL;

UPDATE public.responses r SET
  master_name_snapshot = p.name,
  master_photo_snapshot = p.photo
FROM public.profiles p
WHERE p.id = r.master_id AND r.master_name_snapshot IS NULL;

UPDATE public.reviews r SET
  from_name_snapshot = p.name,
  from_photo_snapshot = p.photo
FROM public.profiles p
WHERE p.id = r.from_user AND r.from_name_snapshot IS NULL;

UPDATE public.messages m SET
  from_name_snapshot = p.name,
  from_photo_snapshot = p.photo
FROM public.profiles p
WHERE p.id = m.from_user AND m.from_name_snapshot IS NULL;

-- ============================================
-- 1. ENUMS
-- ============================================
CREATE TYPE public.contract_status AS ENUM (
  'draft',
  'pending_approval',
  'approved',
  'signed',
  'cancelled'
);

CREATE TYPE public.contract_party AS ENUM ('client', 'master');

-- ============================================
-- 2. CONTRACTS (текущее состояние)
-- ============================================
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL UNIQUE,
  client_id uuid NOT NULL,
  master_id uuid NOT NULL,

  -- общие поля договора
  subject text NOT NULL DEFAULT '',
  price numeric,
  deadline date,
  address text NOT NULL DEFAULT '',

  status public.contract_status NOT NULL DEFAULT 'draft',
  current_version int NOT NULL DEFAULT 0,

  -- кто последний отправил на согласование
  last_initiator public.contract_party,
  last_sent_at timestamptz,

  -- подтверждения сторон по текущей версии
  client_approved_version int,
  master_approved_version int,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contracts_task ON public.contracts(task_id);
CREATE INDEX idx_contracts_client ON public.contracts(client_id);
CREATE INDEX idx_contracts_master ON public.contracts(master_id);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contract participants can view"
  ON public.contracts FOR SELECT
  USING (auth.uid() = client_id OR auth.uid() = master_id);

CREATE POLICY "Contract participants can insert"
  ON public.contracts FOR INSERT
  WITH CHECK (auth.uid() = client_id OR auth.uid() = master_id);

CREATE POLICY "Contract participants can update"
  ON public.contracts FOR UPDATE
  USING (auth.uid() = client_id OR auth.uid() = master_id);

CREATE TRIGGER trg_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 3. CONTRACT VERSIONS (история слепков)
-- ============================================
CREATE TABLE public.contract_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  version_number int NOT NULL,

  -- слепок данных на момент отправки
  subject text NOT NULL DEFAULT '',
  price numeric,
  deadline date,
  address text NOT NULL DEFAULT '',

  initiator public.contract_party NOT NULL,
  initiator_user_id uuid NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (contract_id, version_number)
);

CREATE INDEX idx_versions_contract ON public.contract_versions(contract_id, version_number DESC);

ALTER TABLE public.contract_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Version participants can view"
  ON public.contract_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = contract_versions.contract_id
        AND (auth.uid() = c.client_id OR auth.uid() = c.master_id)
    )
  );

CREATE POLICY "Version participants can insert"
  ON public.contract_versions FOR INSERT
  WITH CHECK (
    auth.uid() = initiator_user_id
    AND EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = contract_versions.contract_id
        AND (auth.uid() = c.client_id OR auth.uid() = c.master_id)
    )
  );

-- ============================================
-- 4. MASTER PRIVATE DATA
-- ============================================
CREATE TABLE public.master_private_data (
  master_id uuid PRIMARY KEY,
  passport_series text,
  passport_number text,
  passport_issued_by text,
  passport_issued_date date,
  inn text,
  registration_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.master_private_data ENABLE ROW LEVEL SECURITY;

-- Только сам мастер может читать/писать. Админы — через has_role.
CREATE POLICY "Master can view own private data"
  ON public.master_private_data FOR SELECT
  USING (auth.uid() = master_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Master can insert own private data"
  ON public.master_private_data FOR INSERT
  WITH CHECK (auth.uid() = master_id);

CREATE POLICY "Master can update own private data"
  ON public.master_private_data FOR UPDATE
  USING (auth.uid() = master_id);

CREATE TRIGGER trg_master_private_updated_at
  BEFORE UPDATE ON public.master_private_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 5. AUTO CHAT MESSAGE ON CONTRACT FIELD CHANGE
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_contract_field_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changes text[] := ARRAY[]::text[];
  v_actor uuid := auth.uid();
  v_other uuid;
  v_summary text;
BEGIN
  -- определяем получателя
  IF v_actor = NEW.client_id THEN
    v_other := NEW.master_id;
  ELSIF v_actor = NEW.master_id THEN
    v_other := NEW.client_id;
  ELSE
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.subject,'') IS DISTINCT FROM COALESCE(NEW.subject,'') THEN
      v_changes := array_append(v_changes,
        'Предмет договора: «' || COALESCE(OLD.subject,'—') || '» → «' || COALESCE(NEW.subject,'—') || '»');
    END IF;
    IF COALESCE(OLD.price, -1) IS DISTINCT FROM COALESCE(NEW.price, -1) THEN
      v_changes := array_append(v_changes,
        'Цена: ' || COALESCE(OLD.price::text,'—') || ' → ' || COALESCE(NEW.price::text,'—') || ' ₽');
    END IF;
    IF COALESCE(OLD.deadline::text,'') IS DISTINCT FROM COALESCE(NEW.deadline::text,'') THEN
      v_changes := array_append(v_changes,
        'Срок: ' || COALESCE(OLD.deadline::text,'—') || ' → ' || COALESCE(NEW.deadline::text,'—'));
    END IF;
    IF COALESCE(OLD.address,'') IS DISTINCT FROM COALESCE(NEW.address,'') THEN
      v_changes := array_append(v_changes,
        'Адрес: «' || COALESCE(OLD.address,'—') || '» → «' || COALESCE(NEW.address,'—') || '»');
    END IF;
  END IF;

  IF array_length(v_changes, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  v_summary := '📝 Договор обновлён:' || E'\n• ' || array_to_string(v_changes, E'\n• ');

  INSERT INTO public.messages (task_id, from_user, to_user, text)
  VALUES (NEW.task_id, v_actor, v_other, v_summary);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contract_field_change
  AFTER UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.notify_contract_field_change();

-- 1. New enum for admin/moderator roles (separate from app_role which has client/master/moderator)
CREATE TYPE public.admin_role AS ENUM ('admin', 'moderator');

-- 2. user_roles table (security best practice: roles in separate table)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.admin_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function to check roles (prevents recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.admin_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: is the user any kind of admin (admin OR moderator)
CREATE OR REPLACE FUNCTION public.is_admin_or_moderator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'moderator')
  )
$$;

-- 4. RLS policies for user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Migrate existing moderators from profiles.role to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'moderator'::public.admin_role
FROM public.profiles
WHERE role = 'moderator'
ON CONFLICT DO NOTHING;

-- Reset their profile role to 'client' so the app can function normally
UPDATE public.profiles SET role = 'client' WHERE role = 'moderator';

-- 6. Update old is_moderator() to use new table — keeps existing RLS policies working
CREATE OR REPLACE FUNCTION public.is_moderator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'moderator')
  )
$$;

-- 7. admin_logs table
CREATE TABLE public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_logs_created_at ON public.admin_logs (created_at DESC);
CREATE INDEX idx_admin_logs_actor ON public.admin_logs (actor_id);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and moderators can view logs"
ON public.admin_logs FOR SELECT
TO authenticated
USING (public.is_admin_or_moderator(auth.uid()));

CREATE POLICY "Admins and moderators can insert logs"
ON public.admin_logs FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_moderator(auth.uid()) AND auth.uid() = actor_id);

-- 8. rejection_reason column on profiles for rejected master applications
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 9. Allow admins/moderators to update profiles (verify/reject masters)
CREATE POLICY "Moderators can update profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_admin_or_moderator(auth.uid()));

-- 10. Allow moderators to insert notifications (to notify rejected masters)
CREATE POLICY "Moderators can create notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_moderator(auth.uid()));
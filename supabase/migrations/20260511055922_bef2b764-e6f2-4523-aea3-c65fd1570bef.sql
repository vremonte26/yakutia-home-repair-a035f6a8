ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lng double precision;
CREATE INDEX IF NOT EXISTS idx_profiles_role_active_geo ON public.profiles (role, is_active) WHERE lat IS NOT NULL AND lng IS NOT NULL;
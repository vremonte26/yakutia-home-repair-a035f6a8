
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS address_area text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS address_full text;

-- Migrate existing data: copy address to both fields
UPDATE public.tasks SET address_full = address, address_area = work_area WHERE address_full IS NULL;

ALTER TABLE public.profiles ALTER COLUMN is_verified DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN is_verified SET DEFAULT NULL;
UPDATE public.profiles SET is_verified = NULL WHERE is_verified = false AND (categories IS NULL OR array_length(categories, 1) IS NULL);

-- Unique constraint: one review per user pair per task
ALTER TABLE public.reviews ADD CONSTRAINT reviews_unique_per_task UNIQUE (from_user, to_user, task_id);

-- Function to recalculate average rating for a user
CREATE OR REPLACE FUNCTION public.update_user_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET rating = (
    SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0)
    FROM public.reviews
    WHERE to_user = NEW.to_user
  )
  WHERE id = NEW.to_user;
  RETURN NEW;
END;
$$;

-- Trigger to auto-update rating after review insert
CREATE TRIGGER update_rating_after_review
AFTER INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_user_rating();

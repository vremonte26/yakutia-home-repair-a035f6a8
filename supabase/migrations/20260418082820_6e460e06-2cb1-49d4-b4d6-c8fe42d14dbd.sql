-- Reviews: parent thread, hidden flag, optional rating
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.reviews(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_reason text,
  ALTER COLUMN rating DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_parent ON public.reviews(parent_id);
CREATE INDEX IF NOT EXISTS idx_reviews_to_user ON public.reviews(to_user);

-- Complaints: link to a review, status, moderator note
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS review_id uuid REFERENCES public.reviews(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS moderator_note text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid;

CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);

-- Helper: is moderator?
CREATE OR REPLACE FUNCTION public.is_moderator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role = 'moderator'
  )
$$;

-- Reviews RLS: drop old broad SELECT, add visibility rules
DROP POLICY IF EXISTS "Reviews viewable by everyone" ON public.reviews;

CREATE POLICY "Visible reviews are public"
ON public.reviews FOR SELECT
USING (
  is_hidden = false
  OR auth.uid() = from_user
  OR auth.uid() = to_user
  OR public.is_moderator(auth.uid())
);

-- Moderators can update reviews (hide/unhide)
CREATE POLICY "Moderators can update reviews"
ON public.reviews FOR UPDATE
USING (public.is_moderator(auth.uid()));

-- Complaints: moderators can view & update all
CREATE POLICY "Moderators can view all complaints"
ON public.complaints FOR SELECT
USING (public.is_moderator(auth.uid()));

CREATE POLICY "Moderators can update complaints"
ON public.complaints FOR UPDATE
USING (public.is_moderator(auth.uid()));

-- Updated rating: only visible reviews with a real rating
CREATE OR REPLACE FUNCTION public.update_user_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target uuid;
BEGIN
  v_target := COALESCE(NEW.to_user, OLD.to_user);
  UPDATE public.profiles
  SET rating = (
    SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0)
    FROM public.reviews
    WHERE to_user = v_target
      AND is_hidden = false
      AND rating IS NOT NULL
      AND rating > 0
      AND parent_id IS NULL
  )
  WHERE id = v_target;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Re-trigger on hide changes too
DROP TRIGGER IF EXISTS trg_reviews_rating ON public.reviews;
CREATE TRIGGER trg_reviews_rating
AFTER INSERT OR UPDATE OF is_hidden, rating OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.update_user_rating();

-- Drop unique constraint that prevented multiple replies (if exists)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.reviews'::regclass AND contype = 'u'
  LOOP
    EXECUTE 'ALTER TABLE public.reviews DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

-- One root review per (from_user, to_user, task_id) — replies (parent_id NOT NULL) are unrestricted
CREATE UNIQUE INDEX IF NOT EXISTS uniq_root_review
ON public.reviews (from_user, to_user, task_id)
WHERE parent_id IS NULL;
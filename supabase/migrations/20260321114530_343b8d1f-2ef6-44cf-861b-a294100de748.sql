
CREATE OR REPLACE FUNCTION public.sync_photo_moderated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_verified = true AND (OLD.is_verified IS DISTINCT FROM true) THEN
    NEW.is_photo_moderated := true;
  END IF;
  IF NEW.is_verified IS NULL THEN
    NEW.is_photo_moderated := false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_photo_moderated_on_verify
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_photo_moderated();

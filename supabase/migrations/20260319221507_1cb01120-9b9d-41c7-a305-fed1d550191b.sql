
-- Function to check max 5 responses per task before insert
CREATE OR REPLACE FUNCTION public.check_max_responses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.responses WHERE task_id = NEW.task_id AND status != 'rejected') >= 5 THEN
    RAISE EXCEPTION 'Maximum 5 responses per task allowed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_max_responses
  BEFORE INSERT ON public.responses
  FOR EACH ROW
  EXECUTE FUNCTION public.check_max_responses();

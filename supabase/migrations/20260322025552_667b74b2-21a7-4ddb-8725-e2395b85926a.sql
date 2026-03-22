
CREATE OR REPLACE FUNCTION public.check_self_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.tasks WHERE id = NEW.task_id AND client_id = NEW.master_id
  ) THEN
    RAISE EXCEPTION 'Cannot respond to your own task';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_self_response
  BEFORE INSERT ON public.responses
  FOR EACH ROW
  EXECUTE FUNCTION public.check_self_response();

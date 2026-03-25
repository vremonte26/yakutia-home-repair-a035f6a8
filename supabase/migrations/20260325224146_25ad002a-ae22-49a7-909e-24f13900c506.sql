
-- Fix: restrict insert policy so only triggers (SECURITY DEFINER) can insert
DROP POLICY "System can insert notifications" ON public.notifications;

-- No direct insert policy needed - triggers use SECURITY DEFINER and bypass RLS

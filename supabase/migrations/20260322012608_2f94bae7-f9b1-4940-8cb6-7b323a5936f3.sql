
-- Messages table
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  from_user uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Only sender and receiver can see messages
CREATE POLICY "Users can view own messages"
  ON public.messages FOR SELECT
  USING (auth.uid() = from_user OR auth.uid() = to_user);

-- Users can insert messages where they are the sender
CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = from_user);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Chat images bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-images', 'chat-images', true);

-- Storage policies for chat-images
CREATE POLICY "Authenticated users can upload chat images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-images');

CREATE POLICY "Anyone can view chat images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-images');

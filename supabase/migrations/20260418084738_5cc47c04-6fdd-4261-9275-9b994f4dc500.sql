-- Add new fields to tasks table
ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS price numeric,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS photos text[] DEFAULT '{}'::text[];

-- Create storage bucket for task photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-photos', 'task-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for task-photos bucket
CREATE POLICY "Task photos publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-photos');

CREATE POLICY "Authenticated users can upload task photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'task-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own task photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'task-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
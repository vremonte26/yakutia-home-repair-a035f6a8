
-- Make chat-images bucket private
UPDATE storage.buckets SET public = false WHERE id = 'chat-images';

-- Drop old public select policy
DROP POLICY IF EXISTS "Anyone can view chat images" ON storage.objects;

-- Only chat participants can view chat images
-- File path format: {taskId}/{userId}_{timestamp}.{ext}
CREATE POLICY "Chat participants can view chat images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-images'
  AND (
    -- Extract taskId from the file path (first segment)
    EXISTS (
      SELECT 1 FROM public.tasks t
      LEFT JOIN public.responses r ON r.task_id = t.id AND r.status = 'accepted'
      WHERE t.id = (storage.foldername(name))[1]::uuid
        AND (t.client_id = auth.uid() OR r.master_id = auth.uid())
    )
  )
);

-- Only chat participants can upload images to their task folder
DROP POLICY IF EXISTS "Authenticated users can upload chat images" ON storage.objects;
CREATE POLICY "Chat participants can upload chat images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-images'
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    LEFT JOIN public.responses r ON r.task_id = t.id AND r.status = 'accepted'
    WHERE t.id = (storage.foldername(name))[1]::uuid
      AND (t.client_id = auth.uid() OR r.master_id = auth.uid())
  )
);


-- Allow masters to delete their own PENDING responses (withdraw)
CREATE POLICY "Masters can delete own pending responses"
ON public.responses
FOR DELETE
TO public
USING (auth.uid() = master_id AND status = 'pending');

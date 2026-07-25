
-- Admin-only writes for all three buckets
CREATE POLICY "admin insert radio buckets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('radio-tracks','radio-covers','blog-covers')
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "admin update radio buckets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('radio-tracks','radio-covers','blog-covers')
  AND public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  bucket_id IN ('radio-tracks','radio-covers','blog-covers')
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "admin delete radio buckets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('radio-tracks','radio-covers','blog-covers')
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Admin can read for management UIs (signed URLs work for public without a SELECT policy)
CREATE POLICY "admin read radio buckets"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('radio-tracks','radio-covers','blog-covers')
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

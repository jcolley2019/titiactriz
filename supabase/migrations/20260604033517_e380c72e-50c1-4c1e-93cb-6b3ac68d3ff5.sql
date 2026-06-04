DROP POLICY IF EXISTS "Authenticated can upload gallery objects" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update gallery objects" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete gallery objects" ON storage.objects;

CREATE POLICY "Admins can upload gallery objects"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gallery'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can update gallery objects"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'gallery'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'gallery'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can delete gallery objects"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'gallery'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
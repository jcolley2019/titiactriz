CREATE POLICY "Public can read gallery objects"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'gallery');

CREATE POLICY "Authenticated can upload gallery objects"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'gallery');

CREATE POLICY "Authenticated can update gallery objects"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'gallery') WITH CHECK (bucket_id = 'gallery');

CREATE POLICY "Authenticated can delete gallery objects"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'gallery');

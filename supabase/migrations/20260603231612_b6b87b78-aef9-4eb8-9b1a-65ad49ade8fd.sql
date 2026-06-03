DROP POLICY IF EXISTS "Public can view published photos" ON public.gallery_photos;

CREATE POLICY "Anon can view published photos"
  ON public.gallery_photos FOR SELECT
  TO anon
  USING (is_published = true);

CREATE POLICY "Authenticated can view all photos"
  ON public.gallery_photos FOR SELECT
  TO authenticated
  USING (true);

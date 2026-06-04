ALTER TABLE public.gallery_photos
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS content_hash text;

CREATE INDEX IF NOT EXISTS gallery_photos_content_hash_idx
  ON public.gallery_photos (content_hash);

CREATE INDEX IF NOT EXISTS gallery_photos_is_archived_idx
  ON public.gallery_photos (is_archived);
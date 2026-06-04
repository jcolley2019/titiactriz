-- 1. Roles system (per Lovable security guidelines)
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Security-definer function avoids recursive RLS lookups
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Seed existing authenticated users as admins so the gallery admin keeps working
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Replace gallery_photos USING (true) policies with admin-scoped policies
DROP POLICY IF EXISTS "Authenticated can insert photos" ON public.gallery_photos;
DROP POLICY IF EXISTS "Authenticated can update photos" ON public.gallery_photos;
DROP POLICY IF EXISTS "Authenticated can delete photos" ON public.gallery_photos;
DROP POLICY IF EXISTS "Authenticated can view all photos" ON public.gallery_photos;

CREATE POLICY "Admins can view all photos"
  ON public.gallery_photos
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert photos"
  ON public.gallery_photos
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update photos"
  ON public.gallery_photos
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete photos"
  ON public.gallery_photos
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Lock down contact_submissions. It is written by an edge function using
-- the service-role key (bypasses RLS), so no anon/authenticated access is needed.
REVOKE ALL ON public.contact_submissions FROM anon;
REVOKE ALL ON public.contact_submissions FROM authenticated;
GRANT ALL ON public.contact_submissions TO service_role;

-- Explicit deny policies so intent is obvious to scanners and future reviewers
CREATE POLICY "Deny all client reads"
  ON public.contact_submissions
  FOR SELECT
  TO anon, authenticated
  USING (false);

CREATE POLICY "Deny all client writes"
  ON public.contact_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

-- 4. Public gallery bucket: drop the anon SELECT policy that enables listing.
-- Files are still served publicly via CDN (bucket is marked public), but the
-- storage.objects table can no longer be listed/enumerated by anon clients.
DROP POLICY IF EXISTS "Public can read gallery objects" ON storage.objects;

CREATE POLICY "Authenticated can read gallery objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'gallery');

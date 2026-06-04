GRANT SELECT ON public.gallery_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gallery_photos TO authenticated;
GRANT ALL ON public.gallery_photos TO service_role;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

DROP POLICY IF EXISTS "Anon can view published photos" ON public.gallery_photos;
DROP POLICY IF EXISTS "Anyone can view published active photos" ON public.gallery_photos;

CREATE POLICY "Anyone can view published active photos"
ON public.gallery_photos
FOR SELECT
TO anon, authenticated
USING (is_published = true AND is_archived = false);

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;
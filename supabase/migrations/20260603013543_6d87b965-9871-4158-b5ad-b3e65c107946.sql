DROP POLICY IF EXISTS "Anyone can submit a contact form" ON public.contact_submissions;
REVOKE INSERT ON public.contact_submissions FROM anon, authenticated;
-- service_role retains ALL via prior GRANT and bypasses RLS by design.
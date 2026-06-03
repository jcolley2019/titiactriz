CREATE TABLE public.contact_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('general', 'titans')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT,
  phone TEXT,
  tiktok_handle TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.contact_submissions TO anon, authenticated;
GRANT ALL ON public.contact_submissions TO service_role;

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- No SELECT/UPDATE/DELETE policies for anon or authenticated.
-- Only service_role (used by edge functions / backend dashboard) can read.
CREATE POLICY "Anyone can submit a contact form"
  ON public.contact_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX idx_contact_submissions_created_at ON public.contact_submissions (created_at DESC);
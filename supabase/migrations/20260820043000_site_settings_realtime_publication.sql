-- BANNER.TOGGLE.1 — make the events board's realtime subscription actually fire.
--
-- Every public reader of `events_board` (the banner above all) subscribes to
-- postgres_changes on public.site_settings, and has since EVENTS.1 — but the
-- `supabase_realtime` publication on the live project contained NO tables
-- (verified 2026-08-19 via pg_publication_tables), so the channel joined
-- cleanly and then never heard a single change. The owner's banner switch
-- looked dead on any page already open: only a full reload, or the visitor's
-- own X, removed the banner.
--
-- Adding the table to the publication is what lets "off means off, immediately"
-- reach pages that are already open. Guarded so re-running is harmless.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'site_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings;
  END IF;
END $$;

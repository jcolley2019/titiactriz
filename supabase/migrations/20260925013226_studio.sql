-- BLOG.2 step 0 — Titi's Content Studio.
--
-- studio_generations keeps every Studio run: what went in (a brain dump or a
-- YouTube transcript), which formats/platforms/language were asked for, and
-- what came out (outputs jsonb holds the markdown per format/platform, e.g.
-- {"blog": "...", "social": {"tiktok": "...", "instagram": "..."}}).
-- blog_post_id links a run to the draft its Publish created.
-- Admin-only: unlike blog_posts there is no anon grant and no public policy.

CREATE TABLE public.studio_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  input_kind text NOT NULL CHECK (input_kind IN ('brain_dump', 'youtube')),
  input_text text NOT NULL,
  source_url text,
  language text NOT NULL CHECK (language IN ('es', 'en')),
  formats text[] NOT NULL,
  platforms text[] NOT NULL,
  outputs jsonb NOT NULL,
  usage jsonb,
  blog_post_id uuid REFERENCES public.blog_posts(id) ON DELETE SET NULL
);

CREATE INDEX studio_generations_created_at_idx
  ON public.studio_generations (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_generations TO authenticated;
GRANT ALL ON public.studio_generations TO service_role;

ALTER TABLE public.studio_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view generations"
  ON public.studio_generations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert generations"
  ON public.studio_generations FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update generations"
  ON public.studio_generations FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete generations"
  ON public.studio_generations FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Titi's voice: site_settings key studio.voice (no table). Seeded ONLY from
-- copy the site already ships (ES locale; live site_settings holds no
-- hero/about/reel overrides as of 2026-09-24, so the repo copy is the shipped
-- copy). Sources:
--   name          about.p1 ("Cristyna Polentino—conocida ... como Titi (TitiActriz)")
--   roles         hero.rolesLine ("ACTRIZ · STREAMER · EMPRESARIA")
--   audience      about.p1 ("mi comunidad"), hero.intro ("Su historia, su comunidad
--                 y sus proyectos"), studio.work.items.titiactriz ("bilingüe")
--   tone          about.p2 ("autenticidad, disciplina y una búsqueda incansable de
--                 la excelencia"), hero.description / reel chapter 1
--   topics        hero.intro (Medellín),
--                 cinematic.acting.eyebrow ("Pantalla y Escenario"), reel chapter 2
--                 (TikTok, comunidad), cinematic.gwSeq ("Distribuidora oficial"),
--                 cinematic.titilinks.headline (Titans off: TITANS_ENABLED=false;
--                 dance dropped from her roles by the roles law)
--   avoid         the site's laws (publisher, no health claims, no invented bio)
--   samplePhrases verbatim: hero.description, about.p3, about.p1 (last sentence),
--                 cinematic.gwSeq body, hero.guidedBy + guidedByText
-- ON CONFLICT DO NOTHING: once Titi edits her voice, re-running never resets it.
INSERT INTO public.site_settings (key, value) VALUES ('studio.voice', $voice$
{
  "name": "Cristyna Polentino — Titi (TitiActriz)",
  "roles": "Actriz · Streamer · Empresaria",
  "audience": "Su comunidad: quienes la siguen como Titi (TitiActriz). Sitio bilingüe, español primero.",
  "tone": "Cercano y en primera persona. Autenticidad, disciplina y una búsqueda incansable de la excelencia. Movimiento y emoción: cada rol es un viaje, cada actuación una conexión.",
  "topics": [
    "Actuación en pantalla y escenario",
    "Streaming en vivo y su comunidad",
    "Contar historias para crear conexión",
    "Green World: distribuidora oficial, bienestar natural",
    "TitiLinks: un link, todo tú",
    "Vida y proyectos en Medellín"
  ],
  "avoid": [
    "Cualquier mención de su libro",
    "Afirmaciones de salud: Green World se describe solo como bienestar y nutrición, nunca como tratamiento, cura o prevención de enfermedades",
    "Biografía inventada: premios, créditos, fechas o cifras que el sitio no publica"
  ],
  "samplePhrases": [
    "Dando vida a historias a través del movimiento y la emoción. Cada rol es un viaje, cada actuación una conexión.",
    "Creo en el poder de contar historias para crear conexión e inspirar cambios.",
    "Mi viaje comenzó en el escenario, donde descubrí que el movimiento y la emoción son lenguajes que todos entienden.",
    "Bienestar natural, directo de la fuente. Te muestro cómo pedirlo paso a paso.",
    "Guiada por el deseo de despertar curiosidad, creatividad y conexión."
  ]
}
$voice$::jsonb)
  ON CONFLICT (key) DO NOTHING;

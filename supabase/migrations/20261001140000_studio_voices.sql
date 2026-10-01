-- STUDIO.VOICES.1 — two named voices (Personal / Green World) and a category on
-- every article.
--
-- ALREADY APPLIED to the live project (nsmstwkjbjicpdclgecq) by hand on
-- 2026-10-01, before this file existed. This file documents it so the repo
-- matches the database; every statement is guarded, so running it against the
-- live project (or a rebuilt one) is a no-op where the change is already there.
-- It writes nothing that the live rows already hold: the two voice rows insert
-- only when absent.

-- blog_posts.category: which of her two kinds of article this is. Existing
-- posts are 'personal'.
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'personal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'blog_posts_category_check'
      AND conrelid = 'public.blog_posts'::regclass
  ) THEN
    ALTER TABLE public.blog_posts
      ADD CONSTRAINT blog_posts_category_check
      CHECK (category IN ('personal', 'greenworld'));
  END IF;
END
$$;

-- The public /blog filter and the admin tabs read by category, newest first.
CREATE INDEX IF NOT EXISTS blog_posts_category_idx
  ON public.blog_posts (category, status, published_at DESC);

-- studio_generations.voice: the voice a Studio press was written in, so a
-- reopened generation publishes into the right category.
ALTER TABLE public.studio_generations
  ADD COLUMN IF NOT EXISTS voice text NOT NULL DEFAULT 'personal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'studio_generations_voice_check'
      AND conrelid = 'public.studio_generations'::regclass
  ) THEN
    ALTER TABLE public.studio_generations
      ADD CONSTRAINT studio_generations_voice_check
      CHECK (voice IN ('personal', 'greenworld'));
  END IF;
END
$$;

-- The voices, as site_settings documents (generate-content reads
-- studio.voice.<voice>, then falls back to studio.voice, then to its built-in
-- defaults; `studio.voice` itself stays for old clients and is no longer
-- written by the Studio's Voz drawer).
--
-- studio.voice.personal starts as a copy of studio.voice.
INSERT INTO public.site_settings (key, value)
SELECT 'studio.voice.personal', value
FROM public.site_settings
WHERE key = 'studio.voice'
ON CONFLICT (key) DO NOTHING;

-- studio.voice.greenworld, as seeded: wellness-and-nutrition only. Its avoid-list
-- carries the no-health-claims law in the voice's own words; generate-content
-- also appends that law to every Green World prompt, so the law never depends
-- on text an admin can edit.
INSERT INTO public.site_settings (key, value)
VALUES (
  'studio.voice.greenworld',
  $voice$
  {
    "name": "Cristyna Polentino — Titi (TitiActriz)",
    "roles": "Actriz · Streamer · Empresaria",
    "audience": "Personas curiosas por el bienestar natural y quienes ya conocen Green World: clientes, futuros distribuidores y su comunidad en Colombia y Latinoamérica. Español primero.",
    "tone": "Cercano, claro y en primera persona. Cuenta su experiencia como distribuidora oficial, explica paso a paso y sin exagerar. Entusiasmo real, nunca promesas.",
    "topics": [
      "Green World: productos de bienestar y nutrición natural, cómo pedirlos paso a paso",
      "Su experiencia como distribuidora oficial y emprendedora",
      "Rutinas de bienestar y hábitos cotidianos",
      "Preguntas frecuentes de sus clientes",
      "Cómo unirse como distribuidor"
    ],
    "avoid": [
      "Afirmaciones de salud: Green World se describe solo como bienestar y nutrición, nunca como tratamiento, cura, prevención o alivio de enfermedades ni síntomas",
      "Comparar con medicamentos o recomendar dejar un tratamiento médico",
      "Cifras de ingresos o promesas de ganancias",
      "Cualquier mención de su libro",
      "Biografía inventada: premios, créditos, fechas o cifras que el sitio no publica"
    ],
    "samplePhrases": [
      "Bienestar natural, directo de la fuente. Te muestro cómo pedirlo paso a paso.",
      "Esto es lo que yo uso y por qué; tú decides qué te sirve.",
      "Si tienes dudas, escríbeme y lo vemos juntas."
    ]
  }
  $voice$::jsonb
)
ON CONFLICT (key) DO NOTHING;

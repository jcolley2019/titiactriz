/**
 * STUDIO.VOICES.1 — Titi's two voices, which are also the blog's two
 * categories: a Studio press written in a voice publishes a draft in the
 * category of the same name.
 *
 * Mirrors VOICES in supabase/functions/generate-content/validate.ts and the
 * CHECK constraints on blog_posts.category and studio_generations.voice.
 */

export const VOICES = ["personal", "greenworld"] as const;
export type VoiceName = (typeof VOICES)[number];

export const DEFAULT_VOICE: VoiceName = "personal";

/** Anything unreadable is the default voice, never a crash. */
export const asVoice = (v: unknown): VoiceName => (v === "greenworld" ? "greenworld" : DEFAULT_VOICE);

/** site_settings key of a voice's document (the Voz drawer edits it; generate-content reads it). */
export const voiceSettingKey = (voice: VoiceName): string => `studio.voice.${voice}`;

/** localStorage key of the Studio's Voz pick, remembered per device. */
export const VOICE_PICK_KEY = "studio.voice.pick";

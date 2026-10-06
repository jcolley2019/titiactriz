import { z } from "zod";

/**
 * The contact form's rules, shared by the three homes' forms — CinematicContact,
 * the classic (Index.tsx) and HomeEditorial, which each kept their own copy.
 *
 * SITE.THEME.2a — every message is a locale key under contact.form.errors that
 * the form translates as it renders the error, so the copy is Spanish first and
 * a language switch re-words an error already on screen. This is zod 4, which
 * needs @hookform/resolvers 5: version 3 rethrew zod 4's errors, so from
 * 2026-07-19 until 2a no form ever showed one.
 */
export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "contact.form.errors.nameMin" })
    .max(100, { message: "contact.form.errors.nameMax" }),
  email: z
    .string()
    .trim()
    .email({ message: "contact.form.errors.email" })
    .max(255, { message: "contact.form.errors.emailMax" }),
  message: z
    .string()
    .trim()
    .min(10, { message: "contact.form.errors.messageMin" })
    .max(1000, { message: "contact.form.errors.messageMax" }),
});

export type ContactFormData = z.infer<typeof contactSchema>;

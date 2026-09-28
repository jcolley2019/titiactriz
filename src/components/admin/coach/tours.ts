/**
 * ADMIN.COACH.1 — the coaching tours, as data.
 *
 * A step names a target id; a target is any element carrying
 * `data-coach="<id>"` (several elements with one id are spotlit as one rect).
 * Steps whose target is not on the page when the step comes up are skipped,
 * so a tour can describe controls that only exist in some states (Publicar
 * como borrador after a generation, a Blog row when a post exists).
 *
 * Copy lives in the locales under admin.coach.<tour>.<step>.{title,body}.
 * Adding a tour = one entry here + its locale strings; the engine never
 * changes. The order here is the order of the Guía's Consejos list.
 *
 * No imports on purpose: the e2e helpers read TOUR_IDS from this file.
 */

export type CoachStep = { target: string; emoji: string; titleKey: string; bodyKey: string };

export type CoachTour = {
  /** The admin section it runs on; defaults to the tour id. */
  section?: string;
  /** Its name in Consejos; defaults to the section's tab label. */
  nameKey?: string;
  /** What "Ver de nuevo" hands the section through goTo (the Blog opens a blank entry). */
  replay?: unknown;
  steps: CoachStep[];
};

const step = (tour: string, key: string, emoji: string): CoachStep => ({
  target: `${tour}.${key}`,
  emoji,
  titleKey: `admin.coach.${tour}.${key}.title`,
  bodyKey: `admin.coach.${tour}.${key}.body`,
});

export const TOURS: Record<string, CoachTour> = {
  // The list: fires the first time the Blog tab opens on it.
  blog: {
    steps: [step("blog", "new", "✍️"), step("blog", "edit", "📂")],
  },
  // The editor: fires the first time an entry is open (Nueva entrada, Editar,
  // or the Studio's Publicar como borrador landing here).
  blogEditor: {
    section: "blog",
    nameKey: "admin.coach.ui.blogEditor",
    replay: { newPost: true },
    steps: [
      step("blogEditor", "fields", "🖋️"),
      step("blogEditor", "cover", "🖼️"),
      step("blogEditor", "translation", "🌎"),
      step("blogEditor", "status", "🚦"),
      step("blogEditor", "save", "💾"),
      step("blogEditor", "viewDelete", "👀"),
    ],
  },
  studio: {
    steps: [
      step("studio", "brainDump", "💡"),
      step("studio", "format", "🧩"),
      step("studio", "platforms", "📱"),
      step("studio", "language", "🌎"),
      step("studio", "webSearch", "🔎"),
      step("studio", "generate", "✨"),
      step("studio", "output", "📝"),
      step("studio", "publish", "📤"),
      step("studio", "history", "🗂️"),
      step("studio", "voice", "🗣️"),
    ],
  },
};

export const TOUR_IDS = Object.keys(TOURS);

export const tourSection = (id: string) => TOURS[id]?.section ?? id;

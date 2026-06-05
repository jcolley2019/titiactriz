import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Localized = { es: string; en: string };

export type ButtonIcon =
  | "auto"
  | "website"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "facebook"
  | "x"
  | "none";

export type EventButton = {
  label: Localized;
  url: string;
  icon?: ButtonIcon;
};

type BaseItem = {
  id: string;
  size: "full" | "half";
  title: Localized;
};

/**
 * Flexible event block. All items render through this shape. Unknown keys
 * from older saved rows (e.g. legacy `type`, `details`) are ignored by the
 * defensive parser.
 */
export type EventCardItem = BaseItem & {
  badge: Localized;
  description: Localized;
  note: Localized;
  buttons: EventButton[];
  imageUrl?: string;
  imagePosition?: "above" | "below";
  bulletsOn?: boolean;
  bullets?: Localized[];
  videoUrl?: string;
};

export type EventItem = EventCardItem;

export type EventsBoard = {
  pageVisible: boolean;
  items: EventItem[];
};


export const EVENTS_BOARD_KEY = "events_board";

export const EVENTS_BOARD_DEFAULT: EventsBoard = {
  pageVisible: true,
  items: [
    {
      id: "smartfilms-2026",
      size: "full",
      title: {

        es: "SmartFilms Colombia 2026",
        en: "SmartFilms Colombia 2026",
      },
      badge: { es: "EN COMPETENCIA", en: "NOW COMPETING" },
      description: {
        es: "Compito en la 12a edición de SmartFilms, el festival de cine hecho con celular más grande del mundo. La temática de este año: retrofuturismo, donde el pasado y el futuro se encuentran.",
        en: "I'm competing in the 12th edition of SmartFilms, the world's largest festival of films made on a phone. This year's theme: retro-futurism, where past meets future.",
      },
      note: {
        es: "Los ganadores se eligen con un 10% de votación del público: tu apoyo cuenta.",
        en: "Winners are chosen with 10% public voting — your support counts.",
      },
      imageUrl: "",
      imagePosition: "above",
      bulletsOn: false,
      bullets: [],
      videoUrl: "",
      buttons: [
        {
          label: { es: "Sobre SmartFilms", en: "About SmartFilms" },
          url: "https://www.instagram.com/smartfilmsco/",
          icon: "auto",
        },
      ],
    },
  ],
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

const coerceLocalized = (v: unknown): Localized => {
  if (!isObj(v)) return { es: "", en: "" };
  return {
    es: typeof v.es === "string" ? v.es : "",
    en: typeof v.en === "string" ? v.en : "",
  };
};

const VALID_ICONS: ButtonIcon[] = [
  "auto",
  "website",
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "x",
  "none",
];

const coerceIcon = (v: unknown): ButtonIcon => {
  if (typeof v === "string" && (VALID_ICONS as string[]).includes(v)) {
    return v as ButtonIcon;
  }
  return "auto";
};

const coerceButton = (v: unknown): EventButton | null => {
  if (!isObj(v)) return null;
  const url = typeof v.url === "string" ? v.url : "";
  return {
    label: coerceLocalized(v.label),
    url,
    icon: coerceIcon(v.icon),
  };
};

const coerceSize = (v: unknown): "full" | "half" =>
  v === "half" ? "half" : "full";

const coercePosition = (v: unknown): "above" | "below" =>
  v === "below" ? "below" : "above";

// Every item is normalized into the flexible event shape.
const coerceItem = (v: unknown): EventItem | null => {
  if (!isObj(v)) return null;
  const id = typeof v.id === "string" && v.id ? v.id : null;
  if (!id) return null;
  const bullets = Array.isArray(v.bullets)
    ? v.bullets.map(coerceLocalized)
    : [];
  const buttons = Array.isArray(v.buttons)
    ? (v.buttons.map(coerceButton).filter(Boolean) as EventButton[])
    : [];
  const item: EventCardItem = {
    id,
    size: coerceSize(v.size),
    title: coerceLocalized(v.title),
    badge: coerceLocalized(v.badge),
    description: coerceLocalized(v.description),
    note: coerceLocalized(v.note),
    imageUrl: typeof v.imageUrl === "string" ? v.imageUrl : "",
    imagePosition: coercePosition(v.imagePosition),
    bulletsOn: v.bulletsOn === true,
    bullets,
    videoUrl: typeof v.videoUrl === "string" ? v.videoUrl : "",
    buttons,
  };
  return item;
};

export const parseBoard = (value: unknown): EventsBoard => {
  if (!isObj(value)) return EVENTS_BOARD_DEFAULT;
  const pageVisible =
    typeof value.pageVisible === "boolean" ? value.pageVisible : true;
  const rawItems = Array.isArray(value.items) ? value.items : null;
  if (!rawItems) return EVENTS_BOARD_DEFAULT;
  const items = (rawItems
    .map(coerceItem)
    .filter(Boolean) as EventItem[]).slice(0, 4);
  return { pageVisible, items };
};

export const fetchEventsBoard = async (): Promise<EventsBoard> => {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", EVENTS_BOARD_KEY)
    .maybeSingle();
  return parseBoard(data?.value);
};

export const setEventsBoard = async (next: EventsBoard): Promise<void> => {
  const { error } = await supabase.from("site_settings").upsert([
    {
      key: EVENTS_BOARD_KEY,
      value: next as unknown as never,
      updated_at: new Date().toISOString(),
    },
  ]);
  if (error) throw error;
};

export const useEventsBoard = (): { board: EventsBoard; loading: boolean } => {
  const [board, setBoard] = useState<EventsBoard>(EVENTS_BOARD_DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchEventsBoard()
      .then((b) => {
        if (!cancelled) setBoard(b);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const channel = supabase
      .channel("site_settings_events_board")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "site_settings",
          filter: `key=eq.${EVENTS_BOARD_KEY}`,
        },
        (payload) => {
          const next = (payload.new as { value?: unknown } | null)?.value;
          if (next !== undefined) setBoard(parseBoard(next));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { board, loading };
};

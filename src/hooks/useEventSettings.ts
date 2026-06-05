import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type EventSettings = {
  visible: boolean;
  filmTitle: string;
  category: string;
  watchUrl: string;
  voteUrl: string;
  festivalUrl: string;
};

export const EVENT_SETTINGS_KEY = "events_smartfilms";

export const EVENT_SETTINGS_DEFAULT: EventSettings = {
  visible: true,
  filmTitle: "",
  category: "",
  watchUrl: "",
  voteUrl: "",
  festivalUrl: "https://www.instagram.com/smartfilmsco/",
};

const asString = (v: unknown, fallback: string): string =>
  typeof v === "string" ? v : fallback;

const asBool = (v: unknown, fallback: boolean): boolean =>
  typeof v === "boolean" ? v : fallback;

const parseSettings = (v: unknown): EventSettings => {
  if (!v || typeof v !== "object") return EVENT_SETTINGS_DEFAULT;
  const o = v as Record<string, unknown>;
  return {
    visible: asBool(o.visible, EVENT_SETTINGS_DEFAULT.visible),
    filmTitle: asString(o.filmTitle, EVENT_SETTINGS_DEFAULT.filmTitle),
    category: asString(o.category, EVENT_SETTINGS_DEFAULT.category),
    watchUrl: asString(o.watchUrl, EVENT_SETTINGS_DEFAULT.watchUrl),
    voteUrl: asString(o.voteUrl, EVENT_SETTINGS_DEFAULT.voteUrl),
    festivalUrl: asString(o.festivalUrl, EVENT_SETTINGS_DEFAULT.festivalUrl),
  };
};

export const fetchEventSettings = async (): Promise<EventSettings> => {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", EVENT_SETTINGS_KEY)
    .maybeSingle();
  return parseSettings(data?.value);
};

export const setEventSettings = async (next: EventSettings): Promise<void> => {
  const { error } = await supabase
    .from("site_settings")
    .upsert([
      {
        key: EVENT_SETTINGS_KEY,
        value: next as unknown as never,
        updated_at: new Date().toISOString(),
      },
    ]);
  if (error) throw error;
};

export const useEventSettings = (): { settings: EventSettings; loading: boolean } => {
  const [settings, setSettings] = useState<EventSettings>(EVENT_SETTINGS_DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchEventSettings()
      .then((s) => {
        if (!cancelled) setSettings(s);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const channel = supabase
      .channel("site_settings_events_smartfilms")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_settings", filter: `key=eq.${EVENT_SETTINGS_KEY}` },
        (payload) => {
          const next = (payload.new as { value?: unknown } | null)?.value;
          if (next !== undefined) setSettings(parseSettings(next));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { settings, loading };
};

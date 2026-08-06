import type { EventItem } from "@/hooks/useEventsBoard";
import EventCard from "./EventCard";

type Props = {
  items: EventItem[];
  lang?: "es" | "en";
  /**
   * EVENTS.NAV.1 — passed straight through to the card: on a portrait tablet
   * the poster is allowed the vertical room the screen actually has. Opt-in,
   * so the cinematic act's rooms keep the geometry they were judged at.
   */
  fillPortrait?: boolean;
};

const EventsGrid = ({ items, lang, fillPortrait }: Props) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-5xl mx-auto">
      {items.map((item) => (
        <div
          key={item.id}
          className={item.size === "full" ? "md:col-span-2" : "md:col-span-1"}
        >
          <EventCard item={item} lang={lang} fillPortrait={fillPortrait} />
        </div>
      ))}
    </div>
  );
};

export default EventsGrid;

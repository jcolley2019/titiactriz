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
  /**
   * EVENTS.VIDEO.1 — the admin's own preview. Passed straight to the card so a
   * medium that could not be rendered names itself where the owner can fix it.
   * The public grid never sets it.
   */
  admin?: boolean;
};

const EventsGrid = ({ items, lang, fillPortrait, admin }: Props) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-5xl mx-auto">
      {items.map((item) => (
        <div
          key={item.id}
          className={item.size === "full" ? "md:col-span-2" : "md:col-span-1"}
        >
          <EventCard item={item} lang={lang} fillPortrait={fillPortrait} admin={admin} />
        </div>
      ))}
    </div>
  );
};

export default EventsGrid;

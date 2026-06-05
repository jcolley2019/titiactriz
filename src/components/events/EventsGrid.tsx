import type { EventItem } from "@/hooks/useEventsBoard";
import EventCard from "./EventCard";

type Props = { items: EventItem[] };

const EventsGrid = ({ items }: Props) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-5xl mx-auto">
      {items.map((item) => (
        <div
          key={item.id}
          className={item.size === "full" ? "md:col-span-2" : "md:col-span-1"}
        >
          <EventCard item={item} />
        </div>
      ))}
    </div>
  );
};

export default EventsGrid;

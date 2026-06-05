import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  fetchEventsBoard,
  setEventsBoard,
  EVENTS_BOARD_DEFAULT,
  type EventsBoard,
  type EventItem,
  type EventCardItem,
  type VideoItem,
  type LinkItem,
} from "@/hooks/useEventsBoard";
import EventsGrid from "@/components/events/EventsGrid";

const PREVIEW_BG = "#0e0c09";

const emptyLocalized = () => ({ es: "", en: "" });

const makeEvent = (): EventCardItem => ({
  id: crypto.randomUUID(),
  size: "half",
  type: "event",
  title: emptyLocalized(),
  badge: emptyLocalized(),
  description: emptyLocalized(),
  details: [],
  note: emptyLocalized(),
  buttons: [],
});

const makeVideo = (): VideoItem => ({
  id: crypto.randomUUID(),
  size: "half",
  type: "video",
  title: emptyLocalized(),
  videoUrl: "",
});

const makeLink = (): LinkItem => ({
  id: crypto.randomUUID(),
  size: "half",
  type: "link",
  title: emptyLocalized(),
  url: "",
  buttonLabel: emptyLocalized(),
  imageUrl: "",
});

type SortableCardProps = {
  item: EventItem;
  onChange: (patch: Partial<EventItem>) => void;
  onDelete: () => void;
};

const SortableCard = ({ item, onChange, onDelete }: SortableCardProps) => {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };

  const typeLabel =
    item.type === "event"
      ? t("admin.eventsBoard.typeEvent")
      : item.type === "video"
        ? t("admin.eventsBoard.typeVideo")
        : t("admin.eventsBoard.typeLink");

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="bg-card border border-border rounded-lg p-4"
    >
      <div className="flex items-center gap-3 mb-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
          aria-label="drag"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <span className="text-xs uppercase tracking-wider text-accent">
          {typeLabel}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => onChange({ size: "full" })}
              className={`px-3 py-1 text-xs ${
                item.size === "full"
                  ? "bg-accent text-accent-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-accent/10"
              }`}
            >
              {t("admin.eventsBoard.sizeFull")}
            </button>
            <button
              type="button"
              onClick={() => onChange({ size: "half" })}
              className={`px-3 py-1 text-xs ${
                item.size === "half"
                  ? "bg-accent text-accent-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-accent/10"
              }`}
            >
              {t("admin.eventsBoard.sizeHalf")}
            </button>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="text-destructive hover:text-destructive px-2"
            aria-label={t("admin.eventsBoard.deleteCard")}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            {t("admin.eventsBoard.titleEs")}
          </Label>
          <Input
            value={item.title.es}
            onChange={(e) =>
              onChange({ title: { ...item.title, es: e.target.value } })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            {t("admin.eventsBoard.titleEn")}
          </Label>
          <Input
            value={item.title.en}
            onChange={(e) =>
              onChange({ title: { ...item.title, en: e.target.value } })
            }
          />
        </div>
      </div>
    </li>
  );
};

const EventsBoardManager = () => {
  const { t } = useTranslation();
  const [board, setBoard] = useState<EventsBoard>(EVENTS_BOARD_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    let cancelled = false;
    fetchEventsBoard()
      .then((b) => {
        if (!cancelled) setBoard(b);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateItem = (id: string, patch: Partial<EventItem>) => {
    setBoard((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.id === id ? ({ ...it, ...patch } as EventItem) : it,
      ),
    }));
  };

  const deleteItem = (id: string) => {
    setBoard((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.id !== id),
    }));
  };

  const addItem = (kind: "event" | "video" | "link") => {
    if (board.items.length >= 4) return;
    const next =
      kind === "event" ? makeEvent() : kind === "video" ? makeVideo() : makeLink();
    setBoard((prev) => ({ ...prev, items: [...prev.items, next] }));
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setBoard((prev) => {
      const oldIndex = prev.items.findIndex((i) => i.id === active.id);
      const newIndex = prev.items.findIndex((i) => i.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return { ...prev, items: arrayMove(prev.items, oldIndex, newIndex) };
    });
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await setEventsBoard(board);
      toast({ title: t("admin.eventsBoard.saved") });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast({
        title: t("admin.eventsBoard.saveError"),
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const atMax = board.items.length >= 4;

  return (
    <section className="bg-card border border-border rounded-lg mb-10 overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="font-serif text-base text-foreground leading-tight">
          {t("admin.eventsBoard.sectionTitle")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t("admin.eventsBoard.sectionSubtitle")}
        </p>
      </div>

      <div className="px-6 py-4 space-y-6">
        <div className="flex items-start gap-3">
          <Switch
            checked={board.pageVisible}
            onCheckedChange={(v) =>
              setBoard((prev) => ({ ...prev, pageVisible: v }))
            }
            disabled={loading}
          />
          <div>
            <Label className="text-foreground text-sm">
              {t("admin.eventsBoard.pageVisibleLabel")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("admin.eventsBoard.pageVisibleHelp")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addItem("event")}
            disabled={atMax}
          >
            {t("admin.eventsBoard.addEvent")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addItem("video")}
            disabled={atMax}
          >
            {t("admin.eventsBoard.addVideo")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addItem("link")}
            disabled={atMax}
          >
            {t("admin.eventsBoard.addLink")}
          </Button>
          {atMax && (
            <span className="text-xs text-muted-foreground ml-1">
              {t("admin.eventsBoard.maxReached")}
            </span>
          )}
        </div>

        {board.items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            {t("admin.eventsBoard.emptyState")}
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={board.items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-3">
                {board.items.map((item) => (
                  <SortableCard
                    key={item.id}
                    item={item}
                    onChange={(patch) => updateItem(item.id, patch)}
                    onDelete={() => deleteItem(item.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <div>
          <h3 className="font-serif text-sm text-foreground mb-2">
            {t("admin.eventsBoard.previewLabel")}
          </h3>
          <div
            className="rounded-lg p-6 border border-border"
            style={{ background: PREVIEW_BG }}
          >
            {board.items.length === 0 ? (
              <p className="text-sm text-white/50 italic text-center py-8">
                {t("admin.eventsBoard.emptyState")}
              </p>
            ) : (
              <EventsGrid items={board.items} />
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={onSave}
            disabled={saving || loading}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                {t("admin.eventsBoard.saving")}
              </>
            ) : (
              t("admin.eventsBoard.save")
            )}
          </Button>
        </div>
      </div>
    </section>
  );
};

export default EventsBoardManager;

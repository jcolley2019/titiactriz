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
import { GripVertical, Loader2, Trash2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  type Localized,
  type EventButton,
} from "@/hooks/useEventsBoard";
import EventsGrid from "@/components/events/EventsGrid";

const PREVIEW_BG = "#0e0c09";

type Lang = "es" | "en";

const emptyLocalized = (): Localized => ({ es: "", en: "" });

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

const setLocalized = (
  current: Localized,
  lang: Lang,
  value: string,
): Localized => ({ ...current, [lang]: value });

type SortableCardProps = {
  item: EventItem;
  editLang: Lang;
  onChange: (patch: Partial<EventItem>) => void;
  onDelete: () => void;
};

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Label className="text-xs text-muted-foreground">{children}</Label>
);

const EventFields = ({
  item,
  editLang,
  onChange,
}: {
  item: EventCardItem;
  editLang: Lang;
  onChange: (patch: Partial<EventCardItem>) => void;
}) => {
  const { t } = useTranslation();

  const setDetail = (idx: number, value: string) => {
    const next = item.details.map((d, i) =>
      i === idx ? setLocalized(d, editLang, value) : d,
    );
    onChange({ details: next });
  };
  const addDetail = () => {
    if (item.details.length >= 5) return;
    onChange({ details: [...item.details, emptyLocalized()] });
  };
  const removeDetail = (idx: number) => {
    onChange({ details: item.details.filter((_, i) => i !== idx) });
  };

  const setButton = (idx: number, patch: Partial<EventButton>) => {
    const next = item.buttons.map((b, i) => (i === idx ? { ...b, ...patch } : b));
    onChange({ buttons: next });
  };
  const setButtonLabel = (idx: number, value: string) => {
    setButton(idx, {
      label: setLocalized(item.buttons[idx].label, editLang, value),
    });
  };
  const addButton = () => {
    if (item.buttons.length >= 3) return;
    onChange({
      buttons: [...item.buttons, { label: emptyLocalized(), url: "" }],
    });
  };
  const removeButton = (idx: number) => {
    onChange({ buttons: item.buttons.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <FieldLabel>{t("admin.eventsBoard.titleLabel")}</FieldLabel>
        <Input
          value={item.title[editLang]}
          onChange={(e) =>
            onChange({ title: setLocalized(item.title, editLang, e.target.value) })
          }
        />
      </div>
      <div className="space-y-1">
        <FieldLabel>{t("admin.eventsBoard.badgeLabel")}</FieldLabel>
        <Input
          value={item.badge[editLang]}
          onChange={(e) =>
            onChange({ badge: setLocalized(item.badge, editLang, e.target.value) })
          }
        />
      </div>
      <div className="space-y-1">
        <FieldLabel>{t("admin.eventsBoard.descriptionLabel")}</FieldLabel>
        <Textarea
          rows={3}
          value={item.description[editLang]}
          onChange={(e) =>
            onChange({
              description: setLocalized(item.description, editLang, e.target.value),
            })
          }
        />
      </div>

      <div className="space-y-2">
        <FieldLabel>{t("admin.eventsBoard.detailsLabel")}</FieldLabel>
        {item.details.map((d, idx) => (
          <div key={idx} className="flex gap-2">
            <Input
              value={d[editLang]}
              onChange={(e) => setDetail(idx, e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => removeDetail(idx)}
              className="px-2 text-destructive hover:text-destructive"
              aria-label={t("admin.eventsBoard.removeDetail")}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addDetail}
          disabled={item.details.length >= 5}
        >
          <Plus className="w-3 h-3 mr-1" />
          {t("admin.eventsBoard.addDetail")}
        </Button>
      </div>

      <div className="space-y-1">
        <FieldLabel>{t("admin.eventsBoard.noteLabel")}</FieldLabel>
        <Textarea
          rows={2}
          value={item.note[editLang]}
          onChange={(e) =>
            onChange({ note: setLocalized(item.note, editLang, e.target.value) })
          }
        />
      </div>

      <div className="space-y-2">
        <FieldLabel>{t("admin.eventsBoard.buttonsLabel")}</FieldLabel>
        {item.buttons.map((b, idx) => (
          <div
            key={idx}
            className="grid gap-2 md:grid-cols-[1fr_1fr_auto] items-start border border-border rounded-md p-2"
          >
            <div className="space-y-1">
              <Label className="text-[0.65rem] text-muted-foreground uppercase">
                {t("admin.eventsBoard.buttonTextLabel")}
              </Label>
              <Input
                value={b.label[editLang]}
                onChange={(e) => setButtonLabel(idx, e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[0.65rem] text-muted-foreground uppercase">
                {t("admin.eventsBoard.buttonUrlLabel")}
              </Label>
              <Input
                value={b.url}
                onChange={(e) => setButton(idx, { url: e.target.value })}
                placeholder="https://"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => removeButton(idx)}
              className="px-2 text-destructive hover:text-destructive md:mt-5"
              aria-label={t("admin.eventsBoard.removeButton")}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addButton}
          disabled={item.buttons.length >= 3}
        >
          <Plus className="w-3 h-3 mr-1" />
          {t("admin.eventsBoard.addButton")}
        </Button>
      </div>
    </div>
  );
};

const VideoFields = ({
  item,
  editLang,
  onChange,
}: {
  item: VideoItem;
  editLang: Lang;
  onChange: (patch: Partial<VideoItem>) => void;
}) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <FieldLabel>{t("admin.eventsBoard.titleLabel")}</FieldLabel>
        <Input
          value={item.title[editLang]}
          onChange={(e) =>
            onChange({ title: setLocalized(item.title, editLang, e.target.value) })
          }
        />
      </div>
      <div className="space-y-1">
        <FieldLabel>{t("admin.eventsBoard.videoUrlLabel")}</FieldLabel>
        <Input
          value={item.videoUrl}
          onChange={(e) => onChange({ videoUrl: e.target.value })}
          placeholder="https://youtube.com/..."
        />
      </div>
    </div>
  );
};

const LinkFields = ({
  item,
  editLang,
  onChange,
}: {
  item: LinkItem;
  editLang: Lang;
  onChange: (patch: Partial<LinkItem>) => void;
}) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <FieldLabel>{t("admin.eventsBoard.titleLabel")}</FieldLabel>
        <Input
          value={item.title[editLang]}
          onChange={(e) =>
            onChange({ title: setLocalized(item.title, editLang, e.target.value) })
          }
        />
      </div>
      <div className="space-y-1">
        <FieldLabel>{t("admin.eventsBoard.linkUrlLabel")}</FieldLabel>
        <Input
          value={item.url}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="https://"
        />
      </div>
      <div className="space-y-1">
        <FieldLabel>{t("admin.eventsBoard.buttonTextLabel")}</FieldLabel>
        <Input
          value={item.buttonLabel[editLang]}
          onChange={(e) =>
            onChange({
              buttonLabel: setLocalized(item.buttonLabel, editLang, e.target.value),
            })
          }
        />
      </div>
      <div className="space-y-1">
        <FieldLabel>{t("admin.eventsBoard.thumbnailLabel")}</FieldLabel>
        <Input
          value={item.imageUrl}
          onChange={(e) => onChange({ imageUrl: e.target.value })}
          placeholder="https://"
        />
      </div>
    </div>
  );
};

const SortableCard = ({ item, editLang, onChange, onDelete }: SortableCardProps) => {
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

      {item.type === "event" && (
        <EventFields
          item={item}
          editLang={editLang}
          onChange={(p) => onChange(p as Partial<EventItem>)}
        />
      )}
      {item.type === "video" && (
        <VideoFields
          item={item}
          editLang={editLang}
          onChange={(p) => onChange(p as Partial<EventItem>)}
        />
      )}
      {item.type === "link" && (
        <LinkFields
          item={item}
          editLang={editLang}
          onChange={(p) => onChange(p as Partial<EventItem>)}
        />
      )}
    </li>
  );
};

const EventsBoardManager = () => {
  const { t } = useTranslation();
  const [board, setBoard] = useState<EventsBoard>(EVENTS_BOARD_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editLang, setEditLang] = useState<Lang>("es");

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

        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground">
            {t("admin.eventsBoard.editLangLabel")}
          </Label>
          <div className="flex rounded-md border border-border overflow-hidden">
            {(["es", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setEditLang(l)}
                className={`px-3 py-1 text-xs uppercase ${
                  editLang === l
                    ? "bg-accent text-accent-foreground"
                    : "bg-transparent text-muted-foreground hover:bg-accent/10"
                }`}
              >
                {l}
              </button>
            ))}
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
                    editLang={editLang}
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
              <EventsGrid items={board.items} lang={editLang} />
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

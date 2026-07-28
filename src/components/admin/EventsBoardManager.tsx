import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import imageCompression from "browser-image-compression";
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
import { GripVertical, Loader2, Trash2, Plus, X, Upload, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchEventsBoard,
  setEventsBoard,
  EVENTS_BOARD_DEFAULT,
  type EventsBoard,
  type PageBanner,
  type EventItem,
  type EventCardItem,
  type Localized,
  type EventButton,
} from "@/hooks/useEventsBoard";
import EventsGrid from "@/components/events/EventsGrid";
import { TITANS_ENABLED } from "@/lib/ventures";

const PREVIEW_BG = "#0e0c09";
const BUCKET = "gallery";

type Lang = "es" | "en";

const emptyLocalized = (): Localized => ({ es: "", en: "" });

const makeEvent = (): EventCardItem => ({
  id: crypto.randomUUID(),
  size: "half",
  title: emptyLocalized(),
  badge: emptyLocalized(),
  description: emptyLocalized(),
  note: emptyLocalized(),
  imageUrl: "",
  imagePosition: "above",
  bulletsOn: false,
  bullets: [],
  videoUrl: "",
  buttons: [],
});


const setLocalized = (
  current: Localized,
  lang: Lang,
  value: string,
): Localized => ({ ...current, [lang]: value });

const uploadEventImage = async (file: File): Promise<string> => {
  let blob: Blob = file;
  try {
    blob = await imageCompression(file, {
      maxWidthOrHeight: 2400,
      fileType: "image/webp",
      initialQuality: 0.85,
      maxSizeMB: 1.0,
      useWebWorker: true,
      preserveExif: false,
    });
  } catch {
    // fall back to original file
  }
  const path = `events/${crypto.randomUUID()}.webp`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: false, contentType: "image/webp" });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl;
};

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Label className="text-xs text-muted-foreground">{children}</Label>
);

const BannerEditor = ({
  name,
  banner,
  editLang,
  loading,
  colorOptions,
  onChange,
}: {
  name: string;
  banner: PageBanner;
  editLang: Lang;
  loading: boolean;
  colorOptions: { label: string; value: string }[];
  onChange: (patch: Partial<PageBanner>) => void;
}) => (
  <div className="space-y-3 border border-border rounded-lg p-4">
    <div className="flex items-center gap-3">
      <Switch
        checked={!!banner.enabled}
        onCheckedChange={(v) => onChange({ enabled: v })}
        disabled={loading}
      />
      <Label className="text-foreground text-sm font-medium">{name}</Label>
    </div>

    <div className="space-y-1">
      <FieldLabel>Label (pill text, e.g. EVENTS / SALE!)</FieldLabel>
      <Input
        maxLength={40}
        value={banner.label?.[editLang] ?? ""}
        onChange={(e) =>
          onChange({ label: setLocalized(banner.label ?? { es: "", en: "" }, editLang, e.target.value) })
        }
        disabled={loading}
        placeholder="EVENTS"
      />
    </div>

    <div className="space-y-1">
      <FieldLabel>Banner text</FieldLabel>
      <Input
        maxLength={160}
        value={banner.text?.[editLang] ?? ""}
        onChange={(e) =>
          onChange({ text: setLocalized(banner.text ?? { es: "", en: "" }, editLang, e.target.value) })
        }
        disabled={loading}
      />
    </div>

    <div className="space-y-1">
      <FieldLabel>Link (optional — where it clicks to; blank = Events page)</FieldLabel>
      <Input
        value={banner.link ?? ""}
        onChange={(e) => onChange({ link: e.target.value })}
        disabled={loading}
        placeholder="https://...  or  /green-world"
      />
    </div>

    <div className="space-y-1">
      <FieldLabel>Show on pages</FieldLabel>
      <div className="flex flex-wrap gap-4">
        {/* TITANS.OFF.1 — the Titans toggle is hidden while the venture is
            down. The stored `pages.titans` value is left untouched, so an
            owner's old choice is still there when the flag flips back. */}
        {(
          [
            ["home", "Home"],
            ["greenWorld", "Green World"],
            ...(TITANS_ENABLED ? [["titans", "Titans"] as const] : []),
          ] as const
        ).map(
          ([key, lbl]) => (
            <label key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch
                checked={!!banner.pages?.[key]}
                onCheckedChange={(v) =>
                  onChange({
                    pages: {
                      ...(banner.pages ?? { home: false, greenWorld: false, titans: false }),
                      [key]: v,
                    },
                  })
                }
                disabled={loading}
              />
              {lbl}
            </label>
          ),
        )}
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-6">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Switch
          checked={!!banner.bold}
          onCheckedChange={(v) => onChange({ bold: v })}
          disabled={loading}
        />
        Bold text
      </label>
      <div className="flex items-center gap-2">
        <FieldLabel>Text color</FieldLabel>
        <select
          value={banner.textColor ?? ""}
          onChange={(e) => onChange({ textColor: e.target.value })}
          disabled={loading}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {colorOptions.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
    </div>
  </div>
);

const ImageUploader = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setBusy(true);
    try {
      const url = await uploadEventImage(file);
      onChange(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast({
        title: t("admin.eventsBoard.saveError"),
        description: msg,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (value) {
    return (
      <div className="flex items-center gap-3">
        <img
          src={value}
          alt=""
          className="w-24 h-24 object-cover rounded-md border border-border"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange("")}
        >
          <X className="w-3 h-3 mr-1" />
          {t("admin.eventsBoard.removeImage")}
        </Button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-md p-6 cursor-pointer transition-colors ${
        dragOver
          ? "border-accent bg-accent/5"
          : "border-border hover:border-accent/50"
      }`}
    >
      {busy ? (
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      ) : (
        <Upload className="w-5 h-5 text-muted-foreground" />
      )}
      <span className="text-xs text-muted-foreground text-center">
        {t("admin.eventsBoard.dropImage")}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
};

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

  const bullets = item.bullets ?? [];
  const setBullet = (idx: number, value: string) => {
    const next = bullets.map((b, i) =>
      i === idx ? setLocalized(b, editLang, value) : b,
    );
    onChange({ bullets: next });
  };
  const addBullet = () => onChange({ bullets: [...bullets, emptyLocalized()] });
  const removeBullet = (idx: number) =>
    onChange({ bullets: bullets.filter((_, i) => i !== idx) });

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
      buttons: [
        ...item.buttons,
        { label: emptyLocalized(), url: "", icon: "auto" },
      ],
    });
  };
  const addSocialIcon = addButton;

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

      <div className="space-y-2">
        <FieldLabel>{t("admin.eventsBoard.imageLabel")}</FieldLabel>
        <ImageUploader
          value={item.imageUrl ?? ""}
          onChange={(url) => onChange({ imageUrl: url })}
        />
        <div className="flex rounded-md border border-border overflow-hidden w-fit">
          {(["above", "below"] as const).map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => onChange({ imagePosition: pos })}
              className={`px-3 py-1 text-xs ${
                (item.imagePosition ?? "above") === pos
                  ? "bg-accent text-accent-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-accent/10"
              }`}
            >
              {t(
                pos === "above"
                  ? "admin.eventsBoard.imageAbove"
                  : "admin.eventsBoard.imageBelow",
              )}
            </button>
          ))}
        </div>
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
        <div className="flex items-center gap-3">
          <Switch
            checked={!!item.bulletsOn}
            onCheckedChange={(v) => onChange({ bulletsOn: v })}
          />
          <Label className="text-xs text-muted-foreground">
            {t("admin.eventsBoard.bulletsToggleLabel")}
          </Label>
        </div>
        {item.bulletsOn && (
          <div className="space-y-2">
            <FieldLabel>{t("admin.eventsBoard.bulletsSectionLabel")}</FieldLabel>
            <div className="grid gap-2 md:grid-cols-2">
              {bullets.map((b, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={b[editLang]}
                    onChange={(e) => setBullet(idx, e.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeBullet(idx)}
                    className="px-2 text-destructive hover:text-destructive"
                    aria-label={t("admin.eventsBoard.removeBullet")}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addBullet}
            >
              <Plus className="w-3 h-3 mr-1" />
              {t("admin.eventsBoard.addBullet")}
            </Button>
          </div>
        )}
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
            className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto] items-start border border-border rounded-md p-2"
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
            <div className="space-y-1">
              <Label className="text-[0.65rem] text-muted-foreground uppercase">
                {t("admin.eventsBoard.iconLabel")}
              </Label>
              <select
                value={b.icon ?? "auto"}
                onChange={(e) =>
                  setButton(idx, { icon: e.target.value as EventButton["icon"] })
                }
                className="h-10 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="auto">{t("admin.eventsBoard.iconAuto")}</option>
                <option value="website">{t("admin.eventsBoard.iconWebsite")}</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="facebook">Facebook</option>
                <option value="x">X</option>
                <option value="none">{t("admin.eventsBoard.iconNone")}</option>
              </select>
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

        {item.videoUrl && (
          <div className="space-y-1">
            <FieldLabel>{t("admin.eventsBoard.videoUrlLabel")}</FieldLabel>
            <div className="flex gap-2">
              <Input
                value={item.videoUrl}
                onChange={(e) => onChange({ videoUrl: e.target.value })}
                placeholder="https://youtube.com/..."
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onChange({ videoUrl: "" })}
              >
                <X className="w-3 h-3 mr-1" />
                {t("admin.eventsBoard.removeVideo")}
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
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
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addSocialIcon}
            disabled={item.buttons.length >= 3}
          >
            <Plus className="w-3 h-3 mr-1" />
            {t("admin.eventsBoard.addSocialIcon")}
          </Button>
          {!item.videoUrl && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onChange({ videoUrl: " " })}
            >
              <Plus className="w-3 h-3 mr-1" />
              {t("admin.eventsBoard.addVideo")}
            </Button>
          )}
        </div>
      </div>

    </div>
  );
};

type SortableCardProps = {
  item: EventItem;
  editLang: Lang;
  onChange: (patch: Partial<EventItem>) => void;
  onDelete: () => void;
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

  // All items are normalized to event shape by the parser.
  const eventItem = item as EventCardItem;

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
          {t("admin.eventsBoard.typeEvent")}
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

      <EventFields
        item={eventItem}
        editLang={editLang}
        onChange={(p) => onChange(p as Partial<EventItem>)}
      />
    </li>
  );
};

const EventsBoardManager = () => {
  const { t } = useTranslation();
  const [board, setBoard] = useState<EventsBoard>(EVENTS_BOARD_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editLang, setEditLang] = useState<Lang>("es");
  const [open, setOpen] = useState(false);

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

  const addItem = () => {
    if (board.items.length >= 4) return;
    setBoard((prev) => ({ ...prev, items: [...prev.items, makeEvent()] }));
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
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-6 py-3 text-left hover:bg-accent/5 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <div>
            <h2 className="font-serif text-base text-foreground leading-tight">
              {t("admin.eventsBoard.sectionTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("admin.eventsBoard.sectionSubtitle")}
            </p>
          </div>
        </div>
      </button>

      {open && (
      <div className="px-6 py-4 space-y-6 border-t border-border">

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

        <div className="space-y-3">
          <BannerEditor
            name="Main banner"
            banner={board.mainBanner}
            editLang={editLang}
            loading={loading}
            colorOptions={[
              { label: "Gold", value: "#C9A55C" },
              { label: "Light gold", value: "#F0D78C" },
              { label: "White", value: "#FFFFFF" },
              { label: "Black", value: "#0a0a0a" },
              { label: "Green", value: "#0B6E4F" },
              { label: "Red", value: "#AD1F1F" },
            ]}
            onChange={(patch) =>
              setBoard((prev) => ({ ...prev, mainBanner: { ...prev.mainBanner, ...patch } }))
            }
          />
          <BannerEditor
            name="Green World banner"
            banner={board.greenWorldBanner}
            editLang={editLang}
            loading={loading}
            colorOptions={[
              { label: "White", value: "#FFFFFF" },
              { label: "Light gold", value: "#FFE08A" },
              { label: "Gold", value: "#C9A55C" },
              { label: "Black", value: "#0a0a0a" },
            ]}
            onChange={(patch) =>
              setBoard((prev) => ({ ...prev, greenWorldBanner: { ...prev.greenWorldBanner, ...patch } }))
            }
          />
          {/* TITANS.OFF.1 — editor hidden, stored banner preserved. */}
          {TITANS_ENABLED && (
            <BannerEditor
              name="Titans banner"
              banner={board.titansBanner}
              editLang={editLang}
              loading={loading}
              colorOptions={[
                { label: "White", value: "#FFFFFF" },
                { label: "Red", value: "#AD1F1F" },
                { label: "Gold", value: "#C9A55C" },
                { label: "Black", value: "#0a0a0a" },
              ]}
              onChange={(patch) =>
                setBoard((prev) => ({ ...prev, titansBanner: { ...prev.titansBanner, ...patch } }))
              }
            />
          )}
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
            onClick={addItem}
            disabled={atMax}
          >
            <Plus className="w-3 h-3 mr-1" />
            {t("admin.eventsBoard.addEvent")}
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
      )}
    </section>
  );
};

export default EventsBoardManager;

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { GripVertical, Loader2, Trash2, Plus, X, Upload, Check, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  localizedText,
  setLocalizedText,
  EVENTS_BOARD_DEFAULT,
  type EventsBoard,
  type PageBanner,
  type EventItem,
  type EventCardItem,
  type Localized,
  type EventButton,
} from "@/hooks/useEventsBoard";
import { syncBoardTranslations } from "@/lib/translate-copy";
import EventFramingEditor from "@/components/admin/events/EventFramingEditor";
import EventsGrid from "@/components/events/EventsGrid";
import { TITANS_ENABLED } from "@/lib/ventures";
import {
  EVENT_VIDEO_ACCEPT_ATTR,
  EVENT_VIDEO_MAX_MB,
  parseSocialVideo,
  uploadEventVideo,
  validateEventVideo,
  type EventVideoRejectReason,
} from "@/lib/event-video";

const PREVIEW_BG = "#0e0c09";
const BUCKET = "gallery";

const emptyLocalized = (): Localized => ({ es: "", en: "" });

/* ══════════════════════ ADMIN.QOL.1 — the save-button trap ══════════════════════
 *
 * Hit twice in real use: a toggle at the top of this editor (a card's Full/Half,
 * a visibility switch) changed nothing but local state, the Save that would have
 * written it sat far below the fold, and the owner navigated away or went to
 * test — losing the change, or trusting a stale page.
 *
 * The split, and why it is not "save everything on change":
 *
 *   TOGGLES AND SELECTORS write immediately. They are single, deliberate,
 *   reversible acts, and there is nothing to batch.
 *   TEXT keeps an explicit Save. One write per keystroke would be absurd, and a
 *   save here is expensive: onSave runs syncBoardTranslations first, a network
 *   round trip PER FIELD.
 *
 * What makes that safe is the pair of references below. One Save writes the
 * WHOLE board (a single site_settings row, not per-field rows), so an instant
 * toggle that wrote the working state would drag half-typed text into the
 * database with it — and run the translator over it. So an instant write is
 * always `lastCommitted + this one patch`: the text already saved, plus the
 * toggle just flipped. Pending text stays pending, which is what the sticky bar
 * is for.
 *
 * Precedent: LinksManager already does exactly this per row (write → revert the
 * touched keys on failure → flash saved). Same shape, one document instead of
 * many rows.
 */

/** How long a saved/failed flash sits next to its control. */
const FLASH_MS = 1800;

type FlashState = "saved" | "failed" | undefined;
type FlashMap = Record<string, FlashState>;

/**
 * The indicator at the control. Deliberately not a toast: the owner's eye is on
 * the switch they just flipped, and the answer has to arrive there — a toast in
 * the corner is exactly what they already miss.
 */
const SaveFlash = ({ state, qa }: { state: FlashState; qa: string }) => {
  if (!state) return null;
  const failed = state === "failed";
  return (
    <span
      data-qa={`flash-${qa}`}
      data-state={state}
      role="status"
      className={`inline-flex items-center gap-1 text-[0.7rem] ${
        failed ? "text-destructive" : "text-accent"
      }`}
    >
      {failed ? (
        <AlertTriangle className="w-3 h-3" aria-hidden />
      ) : (
        <Check className="w-3 h-3" aria-hidden />
      )}
      {failed ? "not saved" : "saved"}
    </span>
  );
};

/** A patch applied to one item, as a whole-board transform. */
const withItemPatch =
  (id: string, patch: Partial<EventItem>) =>
  (b: EventsBoard): EventsBoard => ({
    ...b,
    items: b.items.map((it) => (it.id === id ? ({ ...it, ...patch } as EventItem) : it)),
  });

/** The same, for one of the three banners. */
const withBannerPatch =
  (key: "mainBanner" | "greenWorldBanner" | "titansBanner", patch: Partial<PageBanner>) =>
  (b: EventsBoard): EventsBoard => ({ ...b, [key]: { ...b[key], ...patch } });

const makeEvent = (): EventCardItem => ({
  id: crypto.randomUUID(),
  size: "half",
  title: emptyLocalized(),
  badge: emptyLocalized(),
  description: emptyLocalized(),
  note: emptyLocalized(),
  imageUrl: "",
  imagePosition: "above",
  imageAspect: "auto",
  bulletsOn: false,
  bullets: [],
  videoUrl: "",
  videoFileUrl: "",
  buttons: [],
});


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

/**
 * EVENTS.I18N.1 — the banner trap, restated.
 *
 * EVENTS.1 guarded the Spanish slot specifically: Spanish is the site's primary
 * language, and a banner enabled with empty ES text scrolled a BLANK marquee at
 * most of the audience while looking perfectly correct to whoever filled in the
 * English field. That failure needed an ES-shaped guard because ES and EN were
 * two fields and either could be left empty.
 *
 * They are one field now, and saving fills both slots — so the guard's purpose is
 * served by asking the same question of the one field: is there any text at all?
 * A banner with text can enable, whichever language the owner typed it in.
 *
 * The trap still closes on BOTH doors, and the second is still not redundant: the
 * toggle refuses to turn on, and the save refuses to write. The text can be
 * deleted AFTER a banner was legitimately enabled, and only the save is standing
 * there when it happens.
 */
const bannerTextMissing = (b: PageBanner) => !localizedText(b.text ?? emptyLocalized()).trim();
const bannerBlocked = (b: PageBanner) => !!b.enabled && bannerTextMissing(b);

const BannerEditor = ({
  name,
  qa,
  banner,
  loading,
  colorOptions,
  showErrors,
  onChange,
  onInstant,
  flash,
}: {
  name: string;
  qa: string;
  banner: PageBanner;
  loading: boolean;
  colorOptions: { label: string; value: string }[];
  /** Forced on by a refused save, so the offending banner names itself. */
  showErrors: boolean;
  onChange: (patch: Partial<PageBanner>) => void;
  /** ADMIN.QOL.1 — a toggle or selector that writes on the spot. */
  onInstant: (patch: Partial<PageBanner>, key: string) => void;
  flash: FlashMap;
}) => {
  const { t } = useTranslation();
  const [attempted, setAttempted] = useState(false);
  const textMissing = bannerTextMissing(banner);
  // Shown after a refused toggle, after a refused save, or whenever an already
  // enabled banner has had its text emptied out from under it.
  const invalid = textMissing && (attempted || showErrors || !!banner.enabled);

  return (
  <div className="space-y-3 border border-border rounded-lg p-4" data-qa="banner-editor" data-banner={qa}>
    <div className="flex items-center gap-3">
      <Switch
        checked={!!banner.enabled}
        onCheckedChange={(v) => {
          if (v && textMissing) {
            setAttempted(true);
            return; // refused — the banner stays off, and nothing is written
          }
          setAttempted(false);
          // ADMIN.QOL.1 — instant, but only PAST the guard: a refused toggle
          // must not reach the database any more than it reaches the screen.
          onInstant({ enabled: v }, `banner-${qa}-enabled`);
        }}
        disabled={loading}
        data-qa="banner-enabled"
      />
      <Label className="text-foreground text-sm font-medium">{name}</Label>
      <SaveFlash state={flash[`banner-${qa}-enabled`]} qa={`banner-${qa}-enabled`} />
    </div>

    {invalid && (
      <p
        data-qa="banner-text-required"
        role="alert"
        className="text-xs text-destructive"
      >
        {t("admin.eventsBoard.bannerTextRequired")}
      </p>
    )}

    <div className="space-y-1">
      <FieldLabel>Label (pill text, e.g. EVENTS / SALE!)</FieldLabel>
      <Input
        maxLength={40}
        value={localizedText(banner.label ?? emptyLocalized())}
        onChange={(e) =>
          onChange({ label: setLocalizedText(banner.label ?? emptyLocalized(), e.target.value) })
        }
        disabled={loading}
        placeholder="EVENTS"
      />
    </div>

    <div className="space-y-1">
      <FieldLabel>Banner text</FieldLabel>
      <Input
        data-qa="banner-text"
        maxLength={160}
        value={localizedText(banner.text ?? emptyLocalized())}
        onChange={(e) =>
          onChange({ text: setLocalizedText(banner.text ?? emptyLocalized(), e.target.value) })
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
                  onInstant(
                    {
                      pages: {
                        ...(banner.pages ?? { home: false, greenWorld: false, titans: false }),
                        [key]: v,
                      },
                    },
                    `banner-${qa}-page-${key}`,
                  )
                }
                disabled={loading}
              />
              {lbl}
              <SaveFlash
                state={flash[`banner-${qa}-page-${key}`]}
                qa={`banner-${qa}-page-${key}`}
              />
            </label>
          ),
        )}
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-6">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Switch
          checked={!!banner.bold}
          onCheckedChange={(v) => onInstant({ bold: v }, `banner-${qa}-bold`)}
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
};

/**
 * EVENTS.MEDIA.EDITOR.1b — ONE combined drop/click zone for the card's media.
 *
 * The separate image zone and video zone are unified: the zone accepts an image
 * (image/*) OR a video (mp4/webm, the 60 MB cap and its per-reason refusals
 * preserved verbatim), routes the file by its type, and shows what the card
 * currently holds — the image (the poster) and/or the uploaded video — each
 * with its own remove control. Mutual exclusion with the social link is
 * preserved: while a link owns the card's video, a dropped video FILE is
 * refused out loud, while images (the poster) still upload.
 *
 * EVENTS.VIDEO.1's refusal law stands: a file that will not work is refused
 * HERE, before the upload, and the refusal names the actual problem — the
 * wrong kind of file and a file that is simply too big are different mistakes
 * with different fixes, and "no se pudo guardar" is neither of them.
 */
const MediaUploader = ({
  imageUrl,
  videoFileUrl,
  socialSet,
  onChange,
}: {
  imageUrl: string;
  videoFileUrl: string;
  /** A social link already owns this card's video medium. */
  socialSet: boolean;
  onChange: (patch: Partial<EventCardItem>) => void;
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"image" | "video" | null>(null);
  const [rejected, setRejected] = useState<EventVideoRejectReason | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = async (files: ArrayLike<File> | null) => {
    const file = files?.[0];
    if (!file) return;
    setRejected(null);

    if ((file.type || "").startsWith("image/")) {
      setBusy("image");
      try {
        onChange({ imageUrl: await uploadEventImage(file) });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        toast({ title: t("admin.eventsBoard.saveError"), description: msg, variant: "destructive" });
      } finally {
        setBusy(null);
      }
      return;
    }

    // Not an image → the video path. Mutual exclusion first (the standing note
    // below the zone says why), then EVENTS.VIDEO.1's own gate (type, then
    // size) with its exact refusal messages.
    if (socialSet) return;
    const check = validateEventVideo(file);
    if (!check.ok) {
      setRejected(check.reason);
      return;
    }
    setBusy("video");
    try {
      onChange({ videoFileUrl: await uploadEventVideo(file) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast({
        title: t("admin.eventsBoard.videoUploadFailed"),
        description: msg,
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      {imageUrl && (
        <div className="flex items-center gap-3">
          <img
            src={imageUrl}
            alt=""
            data-qa="event-image-preview"
            className="w-24 h-24 object-cover rounded-md border border-border"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-qa="event-image-remove"
            onClick={() => onChange({ imageUrl: "", imageFraming: undefined })}
          >
            <X className="w-3 h-3 mr-1" />
            {t("admin.eventsBoard.removeImage")}
          </Button>
        </div>
      )}

      {videoFileUrl && (
        <div className="flex items-center gap-3">
          <video
            src={videoFileUrl}
            data-qa="event-video-preview"
            muted
            loop
            playsInline
            autoPlay
            className="w-24 h-24 object-cover rounded-md border border-border"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-qa="event-video-remove"
            onClick={() => onChange({ videoFileUrl: "", videoFraming: undefined })}
          >
            <X className="w-3 h-3 mr-1" />
            {t("admin.eventsBoard.removeVideoFile")}
          </Button>
        </div>
      )}

      <button
        type="button"
        data-qa="event-video-upload"
        disabled={busy !== null}
        onClick={() => inputRef.current?.click()}
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
        className={`flex w-full flex-col items-center justify-center gap-2 border-2 border-dashed rounded-md p-6 transition-colors ${
          dragOver ? "border-accent bg-accent/5" : "border-border hover:border-accent/50 cursor-pointer"
        }`}
      >
        {busy !== null ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="w-5 h-5 text-muted-foreground" />
        )}
        <span className="text-xs text-muted-foreground text-center">
          {busy === "video"
            ? t("admin.eventsBoard.uploadingVideo")
            : t("admin.eventsBoard.dropMedia")}
        </span>
        <span className="text-[0.65rem] text-muted-foreground/70">
          {t("admin.eventsBoard.videoLimitHint", { mb: EVENT_VIDEO_MAX_MB })}
        </span>
      </button>

      {rejected && (
        <p data-qa="event-video-reject" role="alert" className="text-xs text-destructive">
          {t(`admin.eventsBoard.videoReject.${rejected}`, { mb: EVENT_VIDEO_MAX_MB })}
        </p>
      )}
      {socialSet && !videoFileUrl && (
        <p className="text-[0.7rem] text-muted-foreground">
          {t("admin.eventsBoard.uploadBlockedBySocial")}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={`image/*,${EVENT_VIDEO_ACCEPT_ATTR}`}
        className="hidden"
        data-qa="event-video-input"
        onChange={(e) => {
          // VIDEO.1.FIX-B — a FileList is a LIVE view of the input, not a copy:
          // the reset below empties the very list we were just handed, so the
          // file comes out into a detached array FIRST. Without this the handler
          // received an empty list and returned at its `!file` guard — every
          // upload died in silence, and the size refusal was unreachable code.
          // EVENTS.MEDIA.EDITOR.1b — the IMAGE path now runs through this same
          // input, so it gets the same detached-copy + reset fix: re-picking
          // the same file after a refusal fires a real change event again.
          const files = Array.from(e.target.files ?? []);
          e.target.value = ""; // let the same file be re-picked after a refusal
          handleFiles(files);
        }}
      />
    </div>
  );
};

const PLATFORM_NAMES: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
};

/**
 * EVENTS.VIDEO.1 — the social half. The feedback is live and specific: a link
 * the site can embed says WHICH platform it read, so the owner knows it landed;
 * a link it cannot read says so HERE, where it can still be fixed, rather than
 * on a public card that would just quietly show the image instead.
 */
const SocialUrlField = ({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (url: string) => void;
}) => {
  const { t } = useTranslation();
  const trimmed = (value || "").trim();
  const parsed = trimmed ? parseSocialVideo(trimmed) : null;

  return (
    <div className="space-y-1">
      <FieldLabel>{t("admin.eventsBoard.socialUrlLabel")}</FieldLabel>
      <Input
        data-qa="event-social-url"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://www.tiktok.com/@usuario/video/123..."
      />
      {trimmed && parsed && (
        <p data-qa="event-social-ok" className="text-xs text-muted-foreground">
          {t("admin.eventsBoard.socialUrlOk", { platform: PLATFORM_NAMES[parsed.platform] })}
        </p>
      )}
      {trimmed && !parsed && (
        <p data-qa="event-social-bad" role="alert" className="text-xs text-destructive">
          {t("admin.eventsBoard.socialUrlBad")}
        </p>
      )}
    </div>
  );
};

const EventFields = ({
  onInstant,
  flash,
  item,
  onChange,
}: {
  item: EventCardItem;
  onChange: (patch: Partial<EventCardItem>) => void;
  /** ADMIN.QOL.1 — toggles and selectors write on the spot. */
  onInstant: (patch: Partial<EventItem>, key: string) => void;
  flash: FlashMap;
}) => {
  const { t } = useTranslation();

  // EVENTS.MEDIA.EDITOR.1b — the framing dialog edits the card's CURRENT
  // medium: the uploaded video when there is one, else the still image. A
  // social card offers no framing (the platform's player frames itself).
  const [framingOpen, setFramingOpen] = useState(false);
  const hasUpload = !!(item.videoFileUrl ?? "").trim();
  const hasImage = !!(item.imageUrl ?? "").trim();
  const framingMode: "image" | "video" = hasUpload ? "video" : "image";

  const bullets = item.bullets ?? [];
  const setBullet = (idx: number, value: string) => {
    const next = bullets.map((b, i) =>
      i === idx ? setLocalizedText(b, value) : b,
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
    setButton(idx, { label: setLocalizedText(item.buttons[idx].label, value) });
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
          data-qa="event-title"
          value={localizedText(item.title)}
          onChange={(e) => onChange({ title: setLocalizedText(item.title, e.target.value) })}
        />
      </div>
      <div className="space-y-1">
        <FieldLabel>{t("admin.eventsBoard.badgeLabel")}</FieldLabel>
        <Input
          value={localizedText(item.badge)}
          onChange={(e) => onChange({ badge: setLocalizedText(item.badge, e.target.value) })}
        />
      </div>

      {/* EVENTS.VIDEO.1 — the media section. One card, one medium: the image is
          always the poster and always the fallback, and the video (uploaded OR
          linked, never both) is what plays on top of it. The two video fields
          disable each other rather than quietly ranking themselves, so what the
          owner sees in this panel is what the card will render. */}
      <div className="space-y-3 border border-border rounded-md p-3" data-qa="event-media">
        <div>
          <Label className="text-xs font-medium text-foreground">
            {t("admin.eventsBoard.mediaLabel")}
          </Label>
          <p className="text-[0.7rem] text-muted-foreground">
            {t("admin.eventsBoard.mediaHelp")}
          </p>
        </div>

        <MediaUploader
          imageUrl={item.imageUrl ?? ""}
          videoFileUrl={item.videoFileUrl ?? ""}
          socialSet={!!(item.videoUrl ?? "").trim()}
          onChange={onChange}
        />

        {(hasUpload || hasImage) && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-qa="event-edit-framing"
            onClick={() => setFramingOpen(true)}
          >
            {t("admin.eventsBoard.editFraming")}
          </Button>
        )}
        <EventFramingEditor
          open={framingOpen}
          mode={framingMode}
          src={framingMode === "video" ? (item.videoFileUrl ?? "") : (item.imageUrl ?? "")}
          poster={item.imageUrl ?? ""}
          isFull={item.size === "full"}
          text={{
            badge: (item.badge?.es || item.badge?.en || "").trim(),
            title: (item.title?.es || item.title?.en || "").trim(),
            description: (item.description?.es || item.description?.en || "").trim(),
            note: (item.note?.es || item.note?.en || "").trim(),
            buttons: (item.buttons ?? [])
              .map((b) => (b.label?.es || b.label?.en || "").trim())
              .filter((s, i) => s.length > 0 || !!(item.buttons?.[i]?.url ?? "").trim()),
          }}
          initialImage={item.imageFraming}
          initialVideo={item.videoFraming}
          onSave={(patch) => {
            onChange(patch);
            setFramingOpen(false);
          }}
          onCancel={() => setFramingOpen(false)}
        />

        <div className="flex rounded-md border border-border overflow-hidden w-fit">
          {(["above", "below"] as const).map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => onInstant({ imagePosition: pos }, `pos-${item.id}`)}
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
          <SaveFlash state={flash[`pos-${item.id}`]} qa={`pos-${item.id}`} />
        </div>
        <div className="space-y-1">
          <FieldLabel>
            {t("admin.eventsBoard.imageAspectLabel")}
            <SaveFlash state={flash[`aspect-${item.id}`]} qa={`aspect-${item.id}`} />
          </FieldLabel>
          <div className="flex rounded-md border border-border overflow-hidden w-fit">
            {(["auto", "landscape", "portrait"] as const).map((aspect) => (
              <button
                key={aspect}
                type="button"
                data-qa={`event-aspect-${aspect}`}
                onClick={() => onInstant({ imageAspect: aspect }, `aspect-${item.id}`)}
                className={`px-3 py-1 text-xs ${
                  (item.imageAspect ?? "auto") === aspect
                    ? "bg-accent text-accent-foreground"
                    : "bg-transparent text-muted-foreground hover:bg-accent/10"
                }`}
              >
                {t(
                  aspect === "auto"
                    ? "admin.eventsBoard.imageAspectAuto"
                    : aspect === "landscape"
                      ? "admin.eventsBoard.imageAspectLandscape"
                      : "admin.eventsBoard.imageAspectPortrait",
                )}
              </button>
            ))}
          </div>
        </div>

        {/* EVENTS.MEDIA.EDITOR.1b — the social link keeps its own field below
            the combined zone. Mutual exclusion unchanged: an uploaded video
            disables the link, a link blocks video files in the zone above. */}
        <div className="space-y-2 border-t border-border pt-3">
          <SocialUrlField
            value={item.videoUrl ?? ""}
            disabled={!!(item.videoFileUrl ?? "").trim()}
            onChange={(url) => onChange({ videoUrl: url })}
          />
          {!!(item.videoFileUrl ?? "").trim() && (
            <p className="text-[0.7rem] text-muted-foreground">
              {t("admin.eventsBoard.socialBlockedByUpload")}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <FieldLabel>{t("admin.eventsBoard.descriptionLabel")}</FieldLabel>
        <Textarea
          rows={3}
          value={localizedText(item.description)}
          onChange={(e) =>
            onChange({ description: setLocalizedText(item.description, e.target.value) })
          }
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Switch
            checked={!!item.bulletsOn}
            onCheckedChange={(v) => onInstant({ bulletsOn: v }, `bullets-${item.id}`)}
          />
          <Label className="text-xs text-muted-foreground">
            {t("admin.eventsBoard.bulletsToggleLabel")}
          </Label>
          <SaveFlash state={flash[`bullets-${item.id}`]} qa={`bullets-${item.id}`} />
        </div>
        {item.bulletsOn && (
          <div className="space-y-2">
            <FieldLabel>{t("admin.eventsBoard.bulletsSectionLabel")}</FieldLabel>
            <div className="grid gap-2 md:grid-cols-2">
              {bullets.map((b, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={localizedText(b)}
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
          value={localizedText(item.note)}
          onChange={(e) => onChange({ note: setLocalizedText(item.note, e.target.value) })}
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
                value={localizedText(b.label)}
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
                /*
                  ADMIN.QOL.1 — this one selector deliberately KEEPS its Save.
                  Every instant control above is a scalar on the board or the
                  card, so writing it carries nothing else. An icon lives inside
                  the `buttons` ARRAY, next to the label and URL the owner may be
                  midway through typing — writing the array to commit the icon
                  would smuggle that unsaved text into the database, which is the
                  one thing this whole mechanism exists to prevent.
                */
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

        {/* EVENTS.VIDEO.1 — the video link moved OUT of the buttons block and
            into the media section above, where the image it posters lives. The
            old "Add video" button (which seeded the field with a space to make
            itself appear) went with it: the field is simply always there. */}

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
        </div>
      </div>

    </div>
  );
};

type SortableCardProps = {
  item: EventItem;
  onChange: (patch: Partial<EventItem>) => void;
  onDelete: () => void;
  /** ADMIN.QOL.1 — toggles and selectors write on the spot. */
  onInstant: (patch: Partial<EventItem>, key: string) => void;
  flash: FlashMap;
};

const SortableCard = ({ item, onChange, onDelete, onInstant, flash }: SortableCardProps) => {
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
      <div className="flex items-center gap-3 mb-3" data-qa="event-card-head">
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
              onClick={() => onInstant({ size: "full" }, `size-${item.id}`)}
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
              onClick={() => onInstant({ size: "half" }, `size-${item.id}`)}
              className={`px-3 py-1 text-xs ${
                item.size === "half"
                  ? "bg-accent text-accent-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-accent/10"
              }`}
            >
              {t("admin.eventsBoard.sizeHalf")}
            </button>
          </div>
          <SaveFlash state={flash[`size-${item.id}`]} qa={`size-${item.id}`} />
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
        onChange={(p) => onChange(p as Partial<EventItem>)}
        onInstant={onInstant}
        flash={flash}
      />
    </li>
  );
};

const EventsBoardManager = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [board, setBoard] = useState<EventsBoard>(EVENTS_BOARD_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bannerErrors, setBannerErrors] = useState(false);
  /** Set when a save wrote the typed text into both slots because translation failed. */
  const [translationFailed, setTranslationFailed] = useState(false);

  /**
   * ADMIN.QOL.1 — the two references the whole mechanism rests on.
   *
   * `committed` is the board as the DATABASE has it. `boardRef` is the working
   * state, read synchronously by handlers that must not close over a stale
   * render. An instant write is committed + one patch; the difference between
   * the two is, by construction, exactly the work still waiting on Save.
   */
  const committed = useRef<EventsBoard>(EVENTS_BOARD_DEFAULT);
  const boardRef = useRef<EventsBoard>(board);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  /**
   * The committed board again, in state. The ref is what writes read (always
   * current, never a stale closure); this is what RENDER reads, because a ref
   * mutation cannot re-run the dirty comparison that decides whether the sticky
   * bar is on screen. The two are set together, always.
   */
  const [committedBoard, setCommittedBoard] = useState<EventsBoard>(EVENTS_BOARD_DEFAULT);
  const commit = (next: EventsBoard) => {
    committed.current = next;
    setCommittedBoard(next);
  };

  const [flash, setFlash] = useState<FlashMap>({});
  const flashTimers = useRef<Map<string, number>>(new Map());
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);

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
        if (cancelled) return;
        commit(b);
        setBoard(b);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timers = flashTimers.current;
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
    };
  }, []);

  const showFlash = (key: string, state: Exclude<FlashState, undefined>) => {
    setFlash((prev) => ({ ...prev, [key]: state }));
    const prevTimer = flashTimers.current.get(key);
    if (prevTimer) window.clearTimeout(prevTimer);
    flashTimers.current.set(
      key,
      window.setTimeout(() => {
        setFlash((prev) => ({ ...prev, [key]: undefined }));
        flashTimers.current.delete(key);
      }, FLASH_MS),
    );
  };

  /**
   * Write one toggle, now.
   *
   * `mut` is the same transform applied twice: to the working board (so the
   * control moves the instant it is clicked) and to the committed board (so the
   * write carries saved text, never pending text). On failure the control is put
   * back exactly where it was — `revert` is the same transform inverted by the
   * caller, which knows the prior value — and the flash says "not saved" beside
   * it rather than in a corner.
   */
  const instant = async (
    key: string,
    mut: (b: EventsBoard) => EventsBoard,
    revert: (b: EventsBoard) => EventsBoard,
  ) => {
    setBoard((prev) => mut(prev));
    const next = mut(committed.current);
    try {
      await setEventsBoard(next);
      commit(next);
      showFlash(key, "saved");
    } catch (e) {
      setBoard((prev) => revert(prev));
      showFlash(key, "failed");
      toast({
        title: t("admin.eventsBoard.saveError"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    }
  };

  /**
   * A card the database has never seen cannot be patched into the committed
   * board — the write would match no row and flash a "saved" that saved nothing.
   * Those changes stay local and travel with the Save bar, like the card itself.
   */
  const itemIsCommitted = (id: string) => committed.current.items.some((i) => i.id === id);

  const instantItem = (id: string, patch: Partial<EventItem>, key: string) => {
    const before = boardRef.current.items.find((i) => i.id === id);
    if (!before || !itemIsCommitted(id)) {
      updateItem(id, patch);
      return;
    }
    const inverse = Object.fromEntries(
      Object.keys(patch).map((k) => [k, (before as Record<string, unknown>)[k]]),
    ) as Partial<EventItem>;
    void instant(key, withItemPatch(id, patch), withItemPatch(id, inverse));
  };

  const instantBanner = (
    slot: "mainBanner" | "greenWorldBanner" | "titansBanner",
    patch: Partial<PageBanner>,
    key: string,
  ) => {
    const before = boardRef.current[slot];
    const inverse = Object.fromEntries(
      Object.keys(patch).map((k) => [k, (before as Record<string, unknown>)[k]]),
    ) as Partial<PageBanner>;
    void instant(key, withBannerPatch(slot, patch), withBannerPatch(slot, inverse));
  };

  const instantBoardField = (patch: Partial<EventsBoard>, key: string) => {
    const before = boardRef.current;
    const inverse = Object.fromEntries(
      Object.keys(patch).map((k) => [k, (before as Record<string, unknown>)[k]]),
    ) as Partial<EventsBoard>;
    void instant(
      key,
      (b) => ({ ...b, ...patch }),
      (b) => ({ ...b, ...inverse }),
    );
  };

  /**
   * Unsaved TEXT — plus the structural edits that keep their Save (add, delete,
   * reorder). Toggles never show up here: they are committed the moment they
   * move, so whatever still differs between the two boards is precisely the work
   * the Save bar owes.
   */
  const dirty = !loading && JSON.stringify(board) !== JSON.stringify(committedBoard);

  const discard = () => setBoard(committedBoard);

  /**
   * Leaving with unsaved text.
   *
   * `beforeunload` covers reload, tab close, and a typed URL. It cannot cover an
   * in-app route change: this app mounts a plain BrowserRouter, not a data
   * router, so React Router's blocker does not exist here. A capture-phase click
   * guard on same-origin links is what is left, and it is enough — it runs
   * before the router sees the event, so the navigation is genuinely stopped and
   * can be resumed from the dialog once the owner has answered.
   */
  /**
   * ADMIN.QOL.1 — what actually makes the sticky bar stick.
   *
   * `body { overflow-x: hidden }` (index.css, sitewide) makes the body a scroll
   * container, and a scroll container between a sticky element and the viewport
   * cancels the stickiness: the bar computed `position: sticky` and still sat
   * 1879px down a 720px screen. Measured on the live page — `hidden` does not
   * stick, `clip` pins the bar to bottom = 720 exactly. `clip` clips the same
   * pixels without creating the container.
   *
   * The proper home for this is index.css, which belongs to another brick's
   * surface right now, so it is applied HERE, only while there is unsaved text,
   * and the previous value is put back. The two are visually identical, so the
   * flip is invisible.
   *
   * NOTE FOR THE FOLLOW-UP: this same `overflow-x: hidden` silently killed the
   * /events scroll-snap. Two features, one latent defect — it wants fixing at
   * the source.
   */
  useEffect(() => {
    if (!dirty) return;
    const body = document.body;
    const previous = body.style.overflowX;
    body.style.overflowX = "clip";
    return () => {
      body.style.overflowX = previous;
    };
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      const link = el?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute("href") ?? "";
      if (!href || href.startsWith("#") || link.target === "_blank") return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTarget(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty]);

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
    // EVENTS.I18N.1 — the save-side half of the banner trap.
    //
    // TITANS.OFF.1 keeps the Titans editor off screen, so its stored banner is
    // NOT guarded here: an old row left enabled with empty text would otherwise
    // block every save from a field the owner cannot see to fix. Only banners
    // with a visible editor can refuse a save.
    const guarded: PageBanner[] = [
      board.mainBanner,
      board.greenWorldBanner,
      ...(TITANS_ENABLED ? [board.titansBanner] : []),
    ];
    if (guarded.some(bannerBlocked)) {
      setBannerErrors(true);
      toast({
        title: t("admin.eventsBoard.bannerTextRequired"),
        variant: "destructive",
      });
      return;
    }
    setBannerErrors(false);

    setSaving(true);
    try {
      // Whatever the owner typed is the source. Detect its language and fill the
      // other slot. A field that could not be translated keeps the typed text in
      // BOTH slots — never a stale mismatch, and never a blocked save.
      const { board: translated, failed } = await syncBoardTranslations(board);
      setBoard(translated);
      setTranslationFailed(failed > 0);

      await setEventsBoard(translated);
      commit(translated);

      if (failed > 0) {
        toast({
          title: t("admin.eventsBoard.translationFailed"),
          description: t("admin.eventsBoard.translationFailedHelp"),
          variant: "destructive",
        });
      } else {
        toast({ title: t("admin.eventsBoard.saved") });
      }
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
    <section
      /*
        ADMIN.QOL.1 — `overflow-clip`, not `overflow-hidden`.
        `hidden` makes this section a scroll container, and a scroll container
        between a sticky element and the viewport kills the stickiness outright:
        the Save bar computed `position: sticky` and still sat 2678px down the
        page. `clip` clips the rounded corners exactly the same way without
        establishing that container, so the bar can pin to the viewport.
      */
      className="bg-card border border-border rounded-lg mb-10 overflow-clip"
    >
      <div className="w-full flex items-center justify-between gap-3 px-6 py-3 text-left">
        <div>
          <h2 className="font-serif text-base text-foreground leading-tight">
            {t("admin.eventsBoard.sectionTitle")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("admin.eventsBoard.sectionSubtitle")}
          </p>
        </div>
      </div>

      <div className="px-6 py-4 space-y-6 border-t border-border">

        <div className="flex items-start gap-3">
          <Switch
            checked={board.pageVisible}
            onCheckedChange={(v) => instantBoardField({ pageVisible: v }, "pageVisible")}
            disabled={loading}
            data-qa="page-visible"
          />
          <div>
            <Label className="text-foreground text-sm">
              {t("admin.eventsBoard.pageVisibleLabel")}
              <SaveFlash state={flash.pageVisible} qa="pageVisible" />
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("admin.eventsBoard.pageVisibleHelp")}
            </p>
          </div>
        </div>

        {/* EVENTS.2b — ONE switch for the home surface, whatever the layout.
            The owner manages events, never layouts: cinematic shows the act,
            classic will show the Featured-strip card (EVENTS.3), and there are
            deliberately NO per-layout controls here. */}
        <div className="flex items-start gap-3">
          <Switch
            checked={board.homeVisible}
            onCheckedChange={(v) => instantBoardField({ homeVisible: v }, "homeVisible")}
            disabled={loading}
            data-qa="home-visible"
          />
          <div>
            <Label className="text-foreground text-sm">
              {t("admin.eventsBoard.homeVisibleLabel")}
              <SaveFlash state={flash.homeVisible} qa="homeVisible" />
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("admin.eventsBoard.homeVisibleHelp")}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <BannerEditor
            name="Main banner"
            qa="main"
            banner={board.mainBanner}
            loading={loading}
            showErrors={bannerErrors}
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
            onInstant={(patch, key) => instantBanner("mainBanner", patch, key)}
            flash={flash}
          />
          <BannerEditor
            name="Green World banner"
            qa="greenWorld"
            banner={board.greenWorldBanner}
            loading={loading}
            showErrors={bannerErrors}
            colorOptions={[
              { label: "White", value: "#FFFFFF" },
              { label: "Light gold", value: "#FFE08A" },
              { label: "Gold", value: "#C9A55C" },
              { label: "Black", value: "#0a0a0a" },
            ]}
            onChange={(patch) =>
              setBoard((prev) => ({ ...prev, greenWorldBanner: { ...prev.greenWorldBanner, ...patch } }))
            }
            onInstant={(patch, key) => instantBanner("greenWorldBanner", patch, key)}
            flash={flash}
          />
          {/* TITANS.OFF.1 — editor hidden, stored banner preserved. */}
          {TITANS_ENABLED && (
            <BannerEditor
              name="Titans banner"
              qa="titans"
              banner={board.titansBanner}
              loading={loading}
              showErrors={bannerErrors}
              colorOptions={[
                { label: "White", value: "#FFFFFF" },
                { label: "Red", value: "#AD1F1F" },
                { label: "Gold", value: "#C9A55C" },
                { label: "Black", value: "#0a0a0a" },
              ]}
              onChange={(patch) =>
                setBoard((prev) => ({ ...prev, titansBanner: { ...prev.titansBanner, ...patch } }))
              }
              onInstant={(patch, key) => instantBanner("titansBanner", patch, key)}
              flash={flash}
            />
          )}
        </div>


        {/* EVENTS.I18N.1 — one field per thing. Type in whichever language you
            think in; the other side is written for you on save. */}
        <p className="text-xs text-muted-foreground">
          {t("admin.eventsBoard.autoTranslateHelp")}
        </p>

        {translationFailed && (
          <p
            data-qa="translation-failed"
            role="alert"
            className="text-xs text-destructive"
          >
            {t("admin.eventsBoard.translationFailedHelp")}
          </p>
        )}

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
                    onChange={(patch) => updateItem(item.id, patch)}
                    onDelete={() => deleteItem(item.id)}
                    onInstant={(patch, key) => instantItem(item.id, patch, key)}
                    flash={flash}
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
              // EVENTS.VIDEO.1 — the admin preview is an ADMIN surface: a link
              // the site cannot embed says so here, in the same frame where the
              // owner can paste a better one.
              <EventsGrid items={board.items} admin />
            )}
          </div>
        </div>

        {/*
          ADMIN.QOL.1 — ONE Save button, which becomes the sticky bar.
          Rendering a second Save in a fixed bar would put two controls with the
          same accessible name in the DOM and break every strict-mode locator
          that asks for it by name (the FIX.CI.1b lesson). Instead the existing
          row goes `sticky bottom-0` while there is unsaved text: the section is
          taller than the screen, so the row pins itself to the bottom of the
          viewport and is on screen from the top of the editor — which is where
          the trap used to be sprung.
        */}
        <div
          data-qa="events-save-bar"
          data-dirty={dirty ? "true" : "false"}
          className={`flex items-center justify-end gap-3 ${
            dirty
              ? "sticky bottom-0 z-40 -mx-6 px-6 py-3 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
              : ""
          }`}
        >
          {dirty && (
            <span
              data-qa="events-unsaved"
              className="mr-auto inline-flex items-center gap-2 text-xs text-destructive"
            >
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
              {t("admin.eventsBoard.unsaved")}
            </span>
          )}
          {dirty && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              data-qa="events-discard"
              onClick={discard}
              disabled={saving}
            >
              {t("admin.eventsBoard.discard")}
            </Button>
          )}
          <Button
            type="button"
            onClick={onSave}
            disabled={saving || loading}
            data-qa="events-save"
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

      {/*
        ADMIN.QOL.1 — the last door. `beforeunload` (above) covers reload and
        tab close; this covers an in-app link, which the capture-phase guard
        stopped before the router could act on it. Answering resumes exactly the
        navigation that was interrupted.
      */}
      <AlertDialog
        open={!!leaveTarget}
        onOpenChange={(open) => {
          if (!open) setLeaveTarget(null);
        }}
      >
        <AlertDialogContent data-qa="events-leave-prompt">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.eventsBoard.leaveTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.eventsBoard.leaveBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-qa="events-leave-stay">
              {t("admin.eventsBoard.leaveStay")}
            </AlertDialogCancel>
            <AlertDialogAction
              data-qa="events-leave-discard"
              onClick={() => {
                const to = leaveTarget;
                setLeaveTarget(null);
                setBoard(committedBoard);
                if (to) navigate(to);
              }}
            >
              {t("admin.eventsBoard.leaveDiscard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

export default EventsBoardManager;

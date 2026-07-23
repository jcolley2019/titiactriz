import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Upload, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { ACCEPT_ATTR, isAcceptedFile, uploadGalleryPhoto } from "@/lib/gallery-upload";
import type { CinematicPhoto } from "@/components/cinematic/useCinematicData";

/**
 * ADMIN.MEDIA.1 (ITEM 3) — image picker for a media slot. A grid of the
 * published gallery plus an "Upload new" tile that reuses the shared gallery
 * upload pipeline and auto-selects the freshly-uploaded photo.
 */
type Props = {
  open: boolean;
  slotLabel: string;
  photos: CinematicPhoto[];
  currentPhotoId?: string | null;
  onSelect: (photo: CinematicPhoto) => void;
  onUploaded: (photo: CinematicPhoto) => void;
  onClose: () => void;
};

const ImagePicker = ({
  open,
  slotLabel,
  photos,
  currentPhotoId,
  onSelect,
  onUploaded,
  onClose,
}: Props) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file || !isAcceptedFile(file)) return;
    setUploading(true);
    try {
      const photo = await uploadGalleryPhoto(file);
      onUploaded(photo); // auto-select the new photo
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("admin.media.picker.uploadFailed");
      toast({ title: t("admin.media.picker.uploadFailed"), description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !uploading) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("admin.media.picker.title")}</DialogTitle>
          <DialogDescription>
            {slotLabel} · {t("admin.media.picker.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <div
          data-qa="media-picker-grid"
          className="grid max-h-[60vh] grid-cols-3 gap-3 overflow-y-auto pr-1 sm:grid-cols-4"
        >
          {/* Upload new tile */}
          <button
            type="button"
            data-qa="media-picker-upload"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            // ADMIN.MOBILE.1: explicit aspect-ratio (not the Tailwind utility) so
            // the tile holds 4:5 in the scroll grid on mobile Safari, where the
            // utility on a grid child collapses to a horizontal strip.
            style={{ aspectRatio: "4 / 5" }}
            className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-2 text-center text-muted-foreground transition-colors hover:border-accent/60 hover:text-foreground disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
            <span className="text-[11px] leading-tight">
              {uploading ? t("admin.media.picker.uploading") : t("admin.media.picker.uploadNew")}
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={handleFile}
          />

          {photos.map((photo) => {
            const selected = currentPhotoId === photo.id;
            return (
              <button
                key={photo.id}
                type="button"
                data-qa="media-picker-photo"
                onClick={() => onSelect(photo)}
                disabled={uploading}
                aria-pressed={selected}
                aria-label={photo.alt_text ?? t("admin.media.picker.title")}
                // ADMIN.MOBILE.1: an explicit aspect-ratio box + an absolutely
                // filled image keeps the tile a true 4:5 in the scroll grid. On
                // mobile Safari the Tailwind aspect utility on a grid child
                // collapses to a horizontal strip once the image drives height;
                // an absolute image removes it from the tile's content sizing so
                // the ratio alone governs, uniform at every viewport >=320px.
                style={{ aspectRatio: "4 / 5" }}
                className={`relative overflow-hidden rounded-md border transition-all ${
                  selected ? "border-accent ring-2 ring-accent" : "border-border hover:border-accent/60"
                } disabled:opacity-60`}
              >
                <img
                  src={photo.image_url}
                  alt={photo.alt_text ?? ""}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {selected && (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {photos.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("admin.media.picker.empty")}</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImagePicker;

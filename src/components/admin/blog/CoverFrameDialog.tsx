import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import CoverPlate from "@/components/blog/CoverPlate";
import type { BlogCover } from "@/hooks/useBlogPosts";
import type { CoverFraming } from "@/lib/cover-framing";

/**
 * BLOG.COVERFRAME.1 — where one post's cover photograph sits in its crop.
 *
 * The preview IS the public plate: the 3:2 CoverPlate, fed the live focal point,
 * so what the owner sees here is what /blog, the post page and the home act
 * paint (preview = publish by construction, EventFramingEditor's law). A click
 * or a drag on it puts the focal point under the pointer — its position over the
 * plate's box, clamped to the box — and the ring marks it.
 *
 * Restablecer clears the point (the plate falls back to the default crop) and
 * Aplicar hands the result to the editor; nothing is written until the post's
 * own Guardar. Cancel, Escape and the corner X leave the editor field as it was.
 */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const CoverFrameDialog = ({
  open,
  cover,
  framing,
  onApply,
  onCancel,
}: {
  open: boolean;
  cover: BlogCover;
  framing: CoverFraming | null;
  onApply: (framing: CoverFraming | null) => void;
  onCancel: () => void;
}) => {
  const { t } = useTranslation();
  const [live, setLive] = useState<CoverFraming | null>(framing);
  const dragging = useRef(false);

  // Every opening starts from the editor's value, never from a cancelled try.
  useEffect(() => {
    if (open) setLive(framing);
  }, [open, framing]);

  const place = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    if (!box.width || !box.height) return;
    setLive({
      focal: {
        x: clamp01((e.clientX - box.left) / box.width),
        y: clamp01((e.clientY - box.top) / box.height),
      },
    });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    place(e);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging.current) place(e);
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent
        data-qa="blog-cover-frame-dialog"
        className="max-h-[92dvh] w-[calc(100vw-2rem)] max-w-xl overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{t("admin.blog.coverFrameTitle")}</DialogTitle>
          <DialogDescription>{t("admin.blog.coverFrameHelp")}</DialogDescription>
        </DialogHeader>

        <div
          data-qa="blog-cover-frame-preview"
          data-focal={live ? `${live.focal.x.toFixed(3)} ${live.focal.y.toFixed(3)}` : "default"}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDragStart={(e) => e.preventDefault()}
          className="relative touch-none select-none cursor-crosshair [&_img]:pointer-events-none"
        >
          <CoverPlate cover={cover} qa="blog-cover-frame-plate" eager framing={live ?? undefined} />
          {live && (
            <span
              aria-hidden
              data-qa="blog-cover-frame-marker"
              className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[hsl(var(--gold-light))] shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
              style={{ left: `${live.focal.x * 100}%`, top: `${live.focal.y * 100}%` }}
            />
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => setLive(null)}
            disabled={!live}
            data-qa="blog-cover-frame-reset"
            className="text-muted-foreground hover:text-foreground"
          >
            {t("admin.blog.coverFrameReset")}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} data-qa="blog-cover-frame-cancel">
              {t("admin.blog.cancel")}
            </Button>
            <Button
              onClick={() => onApply(live)}
              data-qa="blog-cover-frame-apply"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {t("admin.blog.coverFrameApply")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CoverFrameDialog;

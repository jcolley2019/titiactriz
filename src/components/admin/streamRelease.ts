import type { TFunction } from "i18next";
import { toast } from "@/hooks/use-toast";
import { deleteFromStream, streamUid } from "@/lib/stream";

/**
 * MEDIA.VIDEO.2 — let go of a Stream video the site no longer references
 * (removed, replaced, or uploaded and then abandoned). deleteFromStream already
 * retries Stream's post-create 429 once after 10 s; a delete that still fails
 * is said out loud, naming the video, so nothing lingers in the account
 * unnoticed. Callers clear the reference FIRST, so the site never points at a
 * video that is gone.
 */
export const releaseStreamVideo = async (ref: string, t: TFunction): Promise<boolean> => {
  try {
    await deleteFromStream(ref);
    return true;
  } catch {
    toastStreamOrphan(ref, t);
    return false;
  }
};

/** The toast for a Stream video that could not be deleted. */
export const toastStreamOrphan = (ref: string, t: TFunction) =>
  toast({
    title: t("admin.stream.deleteFailed"),
    description: t("admin.stream.deleteFailedDesc", { id: streamUid(ref) }),
    variant: "destructive",
  });

import { memo, useState } from "react";
import { ChevronDown, ChevronUp, Eye } from "lucide-react";
import Gallery from "@/components/Gallery";

type PreviewPhoto = {
  id: string;
  image_url: string;
  alt_text: string | null;
};

type Props = {
  photos: PreviewPhoto[];
  isDragging?: boolean;
};

const LivePreviewDock = ({ photos, isDragging = false }: Props) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.4)]">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Eye className="w-3.5 h-3.5 text-accent" />
            Live preview
            <span className="text-muted-foreground/60 normal-case tracking-normal">
              · {photos.length} photo{photos.length === 1 ? "" : "s"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label={collapsed ? "Expand preview" : "Collapse preview"}
          >
            {collapsed ? "Expand" : "Collapse"}
            {collapsed ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        {!collapsed && (
          <div className="pb-3">
            {photos.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No published photos to preview.
              </p>
            ) : (
              <Gallery photos={photos} pauseAutoScroll={isDragging} compact />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LivePreviewDock;

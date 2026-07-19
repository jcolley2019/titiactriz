import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  poster: string;
  reduced: boolean;
  className?: string;
  /** Seconds of opacity overlap at the loop seam (default 0.5s). */
  crossfade?: number;
  "data-qa"?: string;
};

/**
 * Seamless-looping background video (TA.7). Two stacked <video> elements play
 * the SAME clip; as the front one nears its end we start the back one from 0 and
 * cross-fade opacity over the final `crossfade` seconds, so the restart seam is
 * never visible.
 *
 * Playback is lazy and visibility-driven: the source is only attached (and
 * playback started) once an IntersectionObserver reports the element is near the
 * viewport, and both videos pause when it scrolls fully out of view. Under
 * reduced motion no video is ever attached — the poster renders as a static
 * cover image and nothing autoplays.
 */
const CrossfadeLoopVideo = ({
  src,
  poster,
  reduced,
  className = "",
  crossfade = 0.5,
  "data-qa": dataQa,
}: Props) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const aRef = useRef<HTMLVideoElement>(null);
  const bRef = useRef<HTMLVideoElement>(null);

  // Which element is currently the visible (front) one. Mirrored in a ref so the
  // timeupdate handler reads the latest value without re-binding.
  const [front, setFront] = useState<"a" | "b">("a");
  const frontRef = useRef<"a" | "b">("a");
  const armedRef = useRef(true); // guards against re-triggering mid-crossfade

  const [attached, setAttached] = useState(false); // lazy src attach
  const [visible, setVisible] = useState(false);

  // Attach + play/pause driven by proximity to the viewport.
  useEffect(() => {
    if (reduced) return;
    const root = rootRef.current;
    if (!root) return;

    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e.isIntersecting) {
          setAttached(true);
          setVisible(true);
        } else {
          setVisible(false);
        }
      },
      { rootMargin: "200px 0px", threshold: 0 },
    );
    io.observe(root);
    return () => io.disconnect();
  }, [reduced]);

  // Start the front clip once its source is attached and the section is in view;
  // pause both when it leaves.
  useEffect(() => {
    if (reduced) return;
    if (visible && attached) {
      const el = frontRef.current === "a" ? aRef.current : bRef.current;
      el?.play().catch(() => {});
    } else if (!visible) {
      aRef.current?.pause();
      bRef.current?.pause();
    }
  }, [visible, attached, reduced]);

  // When the front clip nears its end, roll the other one in under a crossfade.
  const handleTimeUpdate = (which: "a" | "b") => {
    if (which !== frontRef.current || !armedRef.current) return;
    const el = which === "a" ? aRef.current : bRef.current;
    if (!el || !el.duration || Number.isNaN(el.duration)) return;
    if (el.currentTime < el.duration - crossfade) return;

    armedRef.current = false;
    const other = which === "a" ? "b" : "a";
    const otherEl = other === "a" ? aRef.current : bRef.current;
    if (otherEl) {
      otherEl.currentTime = 0;
      otherEl.play().catch(() => {});
    }
    frontRef.current = other;
    setFront(other); // drives the CSS opacity crossfade

    // After the fade completes, reset the outgoing clip for its next turn.
    window.setTimeout(() => {
      el.pause();
      el.currentTime = 0;
      armedRef.current = true;
    }, crossfade * 1000 + 80);
  };

  if (reduced) {
    return (
      <img
        src={poster}
        alt=""
        aria-hidden
        data-qa={dataQa}
        className={`absolute inset-0 h-full w-full object-cover ${className}`}
      />
    );
  }

  const common =
    "pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity";
  const fadeStyle = (isFront: boolean) => ({
    opacity: isFront ? 1 : 0,
    transitionDuration: `${crossfade}s`,
    transitionTimingFunction: "linear" as const,
  });

  return (
    <div ref={rootRef} className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <video
        ref={aRef}
        data-qa={dataQa}
        muted
        playsInline
        preload="none"
        poster={poster}
        src={attached ? src : undefined}
        onTimeUpdate={() => handleTimeUpdate("a")}
        className={common}
        style={fadeStyle(front === "a")}
      />
      <video
        ref={bRef}
        muted
        playsInline
        preload="none"
        poster={poster}
        src={attached ? src : undefined}
        onTimeUpdate={() => handleTimeUpdate("b")}
        className={common}
        style={fadeStyle(front === "b")}
      />
    </div>
  );
};

export default CrossfadeLoopVideo;

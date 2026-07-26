import type { ComponentType } from "react";
import type { BakeoffSlide } from "./shared";

/**
 * CINE.FLOW.4A — the wide bake-off contract and registry.
 *
 * Wide variants differ from the phone variants in kind, not just in size: a
 * phone variant shows ONE slide and replays an entrance; a wide variant owns
 * the whole three-slide act and is SCRUBBED — the harness hands it a linear
 * 0..1 progress and the variant maps it onto the shipped reel timeline
 * (crossfade / beam-open / power3.out / dead-stop). That is why the props
 * carry `slides` (plural) and `progress` instead of `slide` and `playKey`.
 *
 * `frameW`/`frameH` are the frame's true CSS pixel dimensions. Variants size
 * everything from these numbers, never from CSS vw/vh units: the frame is a
 * div inside the harness page, so a real vw/vh would measure the browser
 * viewport and the composition would change with the window, not the frame.
 *
 * The registry starts empty and each variant commit registers itself, so the
 * harness never has to change to learn a new composition.
 */
export type WideVariantProps = {
  slides: BakeoffSlide[];
  /** Linear scrub position across the whole act, 0..1. */
  progress: number;
  reduced: boolean;
  /** True CSS pixel size of the frame the variant fills. */
  frameW: number;
  frameH: number;
};

export type WideVariantMeta = {
  id: string;
  name: string;
  thesis: string;
};

export type WideVariantEntry = {
  meta: WideVariantMeta;
  component: ComponentType<WideVariantProps>;
};

export const WIDE_VARIANTS: WideVariantEntry[] = [];

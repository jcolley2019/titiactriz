import { expect, test, type Page } from "@playwright/test";
import { forceLanguage, injectAdminSession, routeSupabase, type Write } from "./_admin";
import { shot } from "./_helpers";

/**
 * ADMIN.RESET.1c — PAN UNCLAMPED: BOTH AXES DERIVE FROM THE ZOOMED SIZE.
 *
 * The defect: at zoom > 1 on a reel framing tab the hand cursor appeared and
 * VERTICAL drag worked, but HORIZONTAL drag did nothing despite obvious room.
 *
 * The cause was not a threshold or an event bug — it was the wrong frame. The
 * drag math resolved its geometry against the DEVICE aspect at the editor's
 * notional `imageFit` ("fit" for reels), while the wide reel canvas actually
 * paints the photo into the W2 plate (aspect 0.563) in FILL. On the Desktop tab
 * that made widthPct = (0.8 / 1.60) * 100 * 1.16 = 58 — under 100, so the
 * allowable X range computed as ZERO — while heightPct = 116 left Y alive. The
 * plate's real geometry at that zoom is 165% x 116%: 65% of horizontal slack the
 * editor refused to let anyone reach. The captured pre-fix evidence
 * (_qa/pan-horizontal-before.png) reads `1.16;50;50;fill;164.8,116.0,...` — the
 * painted rectangle already declaring 64.8% of X overflow that would not pan.
 *
 * The law now: overflow on each axis is the ZOOMED RENDERED SIZE against the box
 * the media paints into, so pan is free in any direction — including diagonal —
 * wherever slack exists, and clamped only so the frame stays covered.
 *
 * The phone tab had the MIRROR of this bug (the fit inversion froze Y there), so
 * it is asserted too. The About panel and the hero were always framed against
 * their true box and are covered by their own suites.
 */

const PHONE_TAB = "iphone-17-pro";
const WIDE_TABS = ["ipad-air", "desktop"] as const;
const ALL_TABS = [PHONE_TAB, ...WIDE_TABS] as const;

const SURFACE = '[data-qa="media-editor-surface"]';
const CANVAS_IMG = '[data-qa="media-editor-surface"] [data-qa="media-preview-img"]';

/** A flat source of a chosen pixel size, so aspect-dependent slack is deliberate. */
function sizedPhoto(id: string, color: string, w: number, h: number) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='100%' height='100%' fill='${color}'/></svg>`;
  return { id, image_url: `data:image/svg+xml,${encodeURIComponent(svg)}`, alt_text: id };
}

/**
 * A GRIDDED source — a 4x5 lattice of lettered cells with a white bar down its
 * rightmost column. A flat colour makes a pan invisible in a screenshot, so the
 * evidence pair (_qa/pan-horizontal-{before,after}.png) would be two identical
 * images proving nothing. With this source, panning right walks the lattice and
 * brings the white bar into frame, so the fix is legible and not merely asserted.
 */
function griddedPhoto(id: string, w: number, h: number) {
  const cols = 4;
  const rows = 5;
  const cw = w / cols;
  const ch = h / rows;
  const hues = [8, 45, 96, 150, 190, 215, 260, 300, 330, 20];
  let cells = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const hue = hues[(r * cols + c) % hues.length];
      const light = 28 + ((r * cols + c) % 5) * 9;
      cells +=
        `<rect x='${c * cw}' y='${r * ch}' width='${cw}' height='${ch}' fill='hsl(${hue},55%,${light}%)'/>` +
        `<text x='${c * cw + cw / 2}' y='${r * ch + ch / 2}' fill='white' font-family='monospace'` +
        ` font-size='${Math.round(cw * 0.42)}' text-anchor='middle' dominant-baseline='central'>` +
        `${String.fromCharCode(65 + c)}${r + 1}</text>`;
    }
  }
  // The landmark: a white bar hugging the RIGHT edge. Centred framing hides it;
  // a successful horizontal pan reveals it.
  const bar = `<rect x='${w - cw * 0.28}' y='0' width='${cw * 0.28}' height='${h}' fill='#ffffff'/>`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${cells}${bar}</svg>`;
  return { id, image_url: `data:image/svg+xml,${encodeURIComponent(svg)}`, alt_text: id };
}

/**
 * 400x500 (aspect 0.8) — a portrait taller than the plate (0.563) and than every
 * device frame, so in FILL it overflows horizontally at every zoom and
 * vertically once zoomed past 1. That is exactly Joey's case.
 */
const PHOTOS = [
  sizedPhoto("p1", "crimson", 400, 500),
  griddedPhoto("port", 400, 500),
  sizedPhoto("p3", "goldenrod", 400, 500),
];

const MEDIA = {
  hero: { photo_id: "p1", focal: { x: 0.5, y: 0.08 }, zoom: 1 },
  reel: [
    {
      photo_id: "port",
      phone: { focal: { x: 0.5, y: 0.5 }, zoom: 1 },
      wide: { focal: { x: 0.5, y: 0.5 }, zoom: 1 },
    },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
    { photo_id: null, focal: { x: 0.5, y: 0.5 }, zoom: 1 },
  ],
};

/** Joey's repro zoom — small, with visible slack, not a contrived extreme. */
const REPRO_ZOOM = 1.16;

type Resolved = { scale: number; posX: number; posY: number; widthPct: number; heightPct: number };

async function settle(page: Page, ms = 600) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function framingReady(page: Page) {
  await expect
    .poll(async () => (await page.locator(CANVAS_IMG).first().getAttribute("data-hero-framing")) ?? "absent", {
      timeout: 20_000,
    })
    .not.toContain("pending");
}

/** Parse the canvas photo's reported framing: "scale;posX;posY;fit;w,h,l,t". */
async function resolved(page: Page): Promise<Resolved> {
  const attr = (await page.locator(CANVAS_IMG).first().getAttribute("data-hero-framing")) ?? "";
  const [scale, posX, posY, , box] = attr.split(";");
  const [widthPct, heightPct] = (box ?? "").split(",");
  return {
    scale: parseFloat(scale),
    posX: parseFloat(posX),
    posY: parseFloat(posY),
    widthPct: parseFloat(widthPct),
    heightPct: parseFloat(heightPct),
  };
}

async function openReelEditor(page: Page, writes?: Write[]) {
  await injectAdminSession(page);
  await forceLanguage(page, "en");
  await routeSupabase(page, { media: MEDIA, photos: PHOTOS, writes });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await settle(page, 700);
  await page.locator('[data-qa="admin-nav-media"]').click();
  await page.locator('[data-qa="media-slot"][data-slot="reel-0"] [data-qa="media-slot-edit"]').click();
  await expect(page.locator(SURFACE)).toBeVisible();
  await framingReady(page);
}

async function pickTab(page: Page, tab: string) {
  await page.locator(`[data-qa="media-device-${tab}"]`).click();
  await page.waitForTimeout(300);
  await framingReady(page);
}

async function setZoom(page: Page, v: number) {
  await page.locator('[data-qa="media-editor-zoom"]').evaluate((el, value) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, v);
  await page.waitForTimeout(250);
}

/** Drag with the MOUSE (pointer events; the touch path is asserted separately). */
async function drag(page: Page, dx: number, dy: number) {
  const b = (await page.locator(SURFACE).boundingBox())!;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx / 2, cy + dy / 2, { steps: 8 });
  await page.mouse.move(cx + dx, cy + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

/** Drag with synthetic TOUCH pointer events on the same surface. */
async function touchDrag(page: Page, dx: number, dy: number) {
  await page.locator(SURFACE).evaluate(
    (el, d) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const fire = (type: string, x: number, y: number) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: "touch",
            isPrimary: true,
            clientX: x,
            clientY: y,
          }),
        );
      fire("pointerdown", cx, cy);
      fire("pointermove", cx + d.dx / 2, cy + d.dy / 2);
      fire("pointermove", cx + d.dx, cy + d.dy);
      fire("pointerup", cx + d.dx, cy + d.dy);
    },
    { dx, dy },
  );
  await page.waitForTimeout(300);
}

/* =============== 1. HORIZONTAL PAN LIVES, ON EVERY TAB =============== */

test.describe("ADMIN.RESET.1c — both axes pan wherever slack exists", () => {
  test("at zoom 1.16 horizontal drag moves focal X on every reel tab", async ({ page }) => {
    test.setTimeout(180_000);
    await openReelEditor(page);

    for (const tab of ALL_TABS) {
      await pickTab(page, tab);
      // iPad and Desktop share the WIDE record, so recentre before measuring —
      // otherwise the second wide tab starts from the first one's pan. Reset is
      // exactly that tool now (ADMIN.RESET.1a): it recentres this tab in place.
      await page.locator('[data-qa="media-editor-reset"]').click();
      await page.waitForTimeout(250);
      await setZoom(page, REPRO_ZOOM);
      await framingReady(page);

      const before = await resolved(page);
      expect(before.posX, `${tab}: starts centred`).toBeCloseTo(50, 1);
      // The painted rectangle must genuinely overflow horizontally, or this tab
      // is not testing what it claims to (guards against a vacuous pass).
      expect(
        before.widthPct,
        `${tab}: the canvas really has horizontal slack (${before.widthPct}% wide)`,
      ).toBeGreaterThan(100.5);

      // Short enough to land mid-range on every tab, so this asserts real
      // proportional panning rather than a slam into the clamp.
      await drag(page, -30, 0); // pure horizontal
      const after = await resolved(page);

      expect(after.posX, `${tab}: horizontal drag moves focal X`).not.toBeCloseTo(before.posX, 1);
      expect(after.posX, `${tab}: and lands mid-range, not on the clamp`).toBeLessThan(99);
      expect(after.posY, `${tab}: a pure horizontal drag leaves Y alone`).toBeCloseTo(
        before.posY,
        1,
      );
      // Dragging the photo LEFT reveals its right side → focal X increases.
      expect(after.posX, `${tab}: dragging left pans toward the right edge`).toBeGreaterThan(
        before.posX,
      );

      // The Desktop tab is Joey's exact repro surface — photograph it as the
      // direct counterpart of _qa/pan-horizontal-before.png.
      if (tab === "desktop") {
        // eslint-disable-next-line no-console
        console.log(
          `[PAN AFTER] desktop @${REPRO_ZOOM}x painted ${after.widthPct}%x${after.heightPct}% of the plate\n` +
            `  after horizontal drag -30px: posX ${before.posX} -> ${after.posX} (was frozen at 50 before the fix)\n` +
            `  posY held at ${after.posY}`,
        );
        await page.screenshot({ path: shot("pan-horizontal-after.png") });
      }
    }
  });

  test("diagonal drag moves BOTH axes; each axis clamps at its edges", async ({ page }) => {
    test.setTimeout(180_000);
    await openReelEditor(page);
    await pickTab(page, "desktop");
    await setZoom(page, 1.6); // slack on both axes
    await framingReady(page);

    const start = await resolved(page);
    expect(start.widthPct, "desktop: horizontal slack exists").toBeGreaterThan(100.5);
    expect(start.heightPct, "desktop: vertical slack exists").toBeGreaterThan(100.5);

    // A single diagonal gesture must move both, not one then the other.
    await drag(page, -50, -40);
    const diag = await resolved(page);
    expect(diag.posX, "diagonal moves X").toBeGreaterThan(start.posX);
    expect(diag.posY, "diagonal moves Y").toBeGreaterThan(start.posY);

    // Clamps: a huge drag pins to 100 on both axes, never past it.
    await drag(page, -4000, -4000);
    const maxed = await resolved(page);
    expect(maxed.posX, "X clamps at the far edge").toBeCloseTo(100, 1);
    expect(maxed.posY, "Y clamps at the far edge").toBeCloseTo(100, 1);

    // And the opposite edge is 0, not negative.
    await drag(page, 4000, 4000);
    const zeroed = await resolved(page);
    expect(zeroed.posX, "X clamps at the near edge").toBeCloseTo(0, 1);
    expect(zeroed.posY, "Y clamps at the near edge").toBeCloseTo(0, 1);

    await page.screenshot({ path: shot("pan-diagonal-clamped.png") });
  });

  test("an axis with NO slack does not move, while the other still pans", async ({ page }) => {
    test.setTimeout(120_000);
    await openReelEditor(page);
    await pickTab(page, "desktop");
    await setZoom(page, 1); // cover exactly: the pinned axis has zero overflow
    await framingReady(page);

    const before = await resolved(page);
    // In fill mode the pinned axis is EXACTLY 100% — a real zero, not a rounding
    // artifact. For a 0.8 portrait in the 0.563 plate that axis is the vertical.
    expect(before.heightPct, "at zoom 1 the vertical axis is exactly covered").toBeCloseTo(100, 1);
    expect(before.widthPct, "…while the horizontal axis still has slack").toBeGreaterThan(100.5);

    await drag(page, 0, -140); // pure vertical, on the no-slack axis
    const afterY = await resolved(page);
    expect(afterY.posY, "a no-slack axis does not move at all").toBeCloseTo(before.posY, 1);

    await drag(page, -70, 0); // the axis that DOES have slack
    const afterX = await resolved(page);
    expect(afterX.posX, "the axis with slack still pans").not.toBeCloseTo(before.posX, 1);
  });

  test("touch drag pans on the same terms as the mouse", async ({ page }) => {
    test.setTimeout(120_000);
    await openReelEditor(page);
    await pickTab(page, "desktop");
    await setZoom(page, REPRO_ZOOM);
    await framingReady(page);

    const before = await resolved(page);
    await touchDrag(page, -90, 0);
    const after = await resolved(page);
    expect(after.posX, "a touch horizontal drag moves focal X too").toBeGreaterThan(before.posX);
  });
});

/* ======= 2. IT PERSISTS, AND THE CLASSES STAY INDEPENDENT ======= */

test.describe("ADMIN.RESET.1c — horizontal pan survives save + reload", () => {
  test("wide horizontal pan persists; the phone class is untouched", async ({ page }) => {
    test.setTimeout(180_000);
    const writes: Write[] = [];
    await openReelEditor(page, writes);

    // Pan the WIDE class horizontally only.
    await pickTab(page, "desktop");
    await setZoom(page, REPRO_ZOOM);
    await framingReady(page);
    const wideBefore = await resolved(page);
    await drag(page, -90, 0);
    const wideAfter = await resolved(page);
    expect(wideAfter.posX, "the wide class panned horizontally").toBeGreaterThan(wideBefore.posX);

    // The phone class must not have moved.
    await pickTab(page, PHONE_TAB);
    const phone = await resolved(page);
    expect(phone.posX, "the phone class kept its focal X").toBeCloseTo(50, 1);
    expect(phone.scale, "the phone class kept its zoom").toBeCloseTo(1, 2);

    await page.locator('[data-qa="media-editor-save"]').click();
    await expect(page.locator(SURFACE)).toHaveCount(0);
    await expect
      .poll(
        () =>
          writes.filter(
            (w) =>
              w.method === "POST" &&
              /site_settings/.test(w.url) &&
              (w.body ?? "").includes("cinematic_media"),
          ).length,
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0);

    // The payload carries the panned X — this is the "persists" half of the law.
    const upsert = writes
      .filter((w) => w.method === "POST" && /site_settings/.test(w.url))
      .map((w) => w.body ?? "")
      .filter((b) => b.includes("cinematic_media"))
      .pop()!;
    const rows = JSON.parse(upsert);
    const saved = (Array.isArray(rows) ? rows[0] : rows).value as {
      reel: {
        phone: { focal: { x: number; y: number }; zoom: number };
        wide: { focal: { x: number; y: number }; zoom: number };
      }[];
    };
    const slot0 = saved.reel[0];
    expect(slot0.wide.focal.x, "the saved wide focal.x is the panned value").toBeCloseTo(
      wideAfter.posX / 100,
      2,
    );
    expect(slot0.phone.focal.x, "the saved phone focal.x is still centred").toBeCloseTo(0.5, 5);

    // RELOAD on the saved value: the Desktop tab reopens on the panned X.
    await injectAdminSession(page);
    await routeSupabase(page, { media: (saved as unknown) as Record<string, unknown>, photos: PHOTOS });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await settle(page, 700);
    await page.locator('[data-qa="admin-nav-media"]').click();
    await page
      .locator('[data-qa="media-slot"][data-slot="reel-0"] [data-qa="media-slot-edit"]')
      .click();
    await expect(page.locator(SURFACE)).toBeVisible();
    await pickTab(page, "desktop");
    const reopened = await resolved(page);
    expect(reopened.posX, "the panned focal X round-tripped through save + reload").toBeCloseTo(
      wideAfter.posX,
      0,
    );
  });
});

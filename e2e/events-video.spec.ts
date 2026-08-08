import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { forceLanguage, injectAdminSession, routeSupabase, type Write } from "./_admin";
import { resolveHeroGeometry } from "../src/lib/hero-framing";

/**
 * EVENTS.VIDEO.1 — an event card's medium.
 *
 * A card used to be an image with, at most, a video block bolted underneath it.
 * Joey's ruling makes the medium singular and gives it two new sources: a file
 * we host (his birthday announcement mp4) and a video that lives on TikTok,
 * Instagram or YouTube. The laws this spec holds:
 *
 *  1. THE IMAGE CARD DID NOT MOVE — a row with only an image renders the exact
 *     box it rendered before this brick: full wrapper width, the 420px band,
 *     one <img> and no video machinery anywhere near it. The live birthday card
 *     is an image-only row, and it may not change until Joey changes it.
 *  2. AN UPLOADED VIDEO PLAYS ITSELF — muted, looping, inline, autoplaying,
 *     with the card image as its POSTER (not as a second picture beside it).
 *  3. NOTHING THIRD-PARTY BEFORE CONSENT — a social card paints the poster and
 *     a play control. Not one byte is requested from tiktok/instagram/youtube
 *     until the visitor clicks; the click mounts the PLATFORM'S OWN player at
 *     the platform's own embed URL.
 *  4. THE EMBED CANNOT MOVE THE CARD — the poster stays mounted as the box's
 *     sizer, so a stage that was pinned around this card is measuring a frame
 *     the play button will not resize (the EVENTS.2 decode-wait law).
 *  5. A LINK WE CANNOT READ IS THE STILL IMAGE — publicly, silently. No broken
 *     frame, no invented player, and NO diagnostic aimed at a visitor.
 *  6. …AND IT IS REPORTED IN ADMIN — the same row, in the admin's own preview,
 *     says what is wrong where someone can fix it. That is the whole of "admin
 *     only": law 5 proves the public silence, this proves the admin's voice.
 *  7. REDUCED MOTION HOLDS THE POSTER FRAME — no autoplay, and the video gains
 *     controls so it stays reachable by someone who asked for less movement,
 *     not less content.
 *  8. ONE CARD GRAMMAR, BOTH ROOMS — /events and the cinematic act mount the
 *     same EventCard, so each medium renders identically in both.
 *  9. THE FILE THE OWNER PICKS IS THE FILE THAT UPLOADS (VIDEO.1.FIX-B).
 * 10. THE UPLOADED-VIDEO WELL FOLLOWS THE SCREEN (EVENTS.MEDIA.EDITOR.1c —
 *     superseding FIX-C's file-shaped well): one file must work in every
 *     aspect ratio, so the well is the screen's design box (9:16 at the
 *     ratified caps on portrait screens, the 420px band on landscape ones)
 *     and the clip is framed into it by the per-view records. Still images
 *     keep PORTRAIT.1's own-ratio law untouched.
 *
 * Everything is offline: the image fixtures are SVG data URIs with declared
 * intrinsic sizes, the video fixture is served by a route, and the three
 * platforms are routed so no test ever leaves the machine.
 */

const PAGE = "/events";
const ACT = "/cinematic?events=A";

const IMG = '[data-qa="event-card-image"]';
const VIDEO = '[data-qa="event-card-video"]';
const SOCIAL = '[data-qa="event-card-social"]';
const POSTER = '[data-qa="event-card-poster"]';
const PLAY = '[data-qa="event-card-play"]';
const EMBED = '[data-qa="event-card-embed"]';
const WARNING = '[data-qa="event-media-warning"]';

/** An image with a known intrinsic size, served from nowhere. */
const svgImage = (w: number, h: number, fill: string) => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" ` +
    `viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${fill}"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
};

const LANDSCAPE_SRC = svgImage(1600, 900, "#1c2f3a");
/** The historic well, from EVENTS.PORTRAIT.1: max-w-3xl wide, clamped at 420. */
const LEGACY_WRAPPER_W = 768;
const LEGACY_MAX_H = 420;

/** Same-origin, routed below — a real <video> with no real network. */
const CLIP = "/fixtures/event-clip.mp4";

const TIKTOK_URL = "https://www.tiktok.com/@titipolentino/video/7412345678901234567";
const TIKTOK_ID = "7412345678901234567";
const YT_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const IG_URL = "https://www.instagram.com/reel/CzAbCdEfGhI/";
/** A real link that is not a video post — the "unrecognised" case. */
const BAD_URL = "https://example.com/my-birthday-party";

/** Every host a social embed could ever touch. */
const PLATFORM_HOSTS = /tiktok\.com|instagram\.com|youtube\.com|youtu\.be/;

type Card = Record<string, unknown>;

const card = (overrides: Card): Card => ({
  id: "e1",
  size: "full",
  title: { es: "Cumpleaños de Titi", en: "Titi's Birthday" },
  badge: { es: "", en: "" },
  description: { es: "", en: "" },
  note: { es: "", en: "" },
  imagePosition: "above",
  buttons: [],
  ...overrides,
});

const boardWith = (overrides: Card) => ({
  pageVisible: true,
  homeVisible: true,
  items: [card(overrides)],
});

/**
 * Serve the video fixture and neutralise the three platforms. Both routes exist
 * so a test can never depend on the open internet — and, for the platforms,
 * so that "a request was made" is still OBSERVABLE (law 3 counts requests; it
 * does not need them to succeed).
 */
async function routeMedia(page: Page) {
  await page.route(`**${CLIP}`, (route) =>
    route.fulfill({ status: 200, contentType: "video/mp4", body: "" }),
  );
  await page.route(PLATFORM_HOSTS, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html><body></body></html>" }),
  );
}

/** Requests to the three platforms, in order, as the page makes them. */
function trackPlatformRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (req) => {
    if (PLATFORM_HOSTS.test(req.url())) seen.push(req.url());
  });
  return seen;
}

async function open(
  page: Page,
  path: string,
  overrides: Card,
  opts: { width?: number; height?: number; reduced?: boolean } = {},
) {
  await page.setViewportSize({ width: opts.width ?? 1440, height: opts.height ?? 900 });
  if (opts.reduced) await page.emulateMedia({ reducedMotion: "reduce" });
  await forceLanguage(page, "es");
  await routeMedia(page);
  await routeSupabase(page, { eventsBoard: boardWith(overrides) });
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(600);
}

/* ───────────────────── law 1 — the image card did not move ───────────────────── */

test("an image-only row renders exactly the box it rendered before", async ({ page }) => {
  test.setTimeout(60_000);
  await open(page, PAGE, { imageUrl: LANDSCAPE_SRC });

  await expect(page.locator(IMG), "the still image is the card's medium").toHaveCount(1);
  await page.waitForFunction(
    (sel) => {
      const img = document.querySelector<HTMLImageElement>(sel);
      return !!img && img.complete && img.naturalWidth > 0;
    },
    IMG,
    { timeout: 10_000 },
  );

  // No video machinery is anywhere near a card that has no video.
  await expect(page.locator(VIDEO), "no <video>").toHaveCount(0);
  await expect(page.locator(SOCIAL), "no social well").toHaveCount(0);
  await expect(page.locator(PLAY), "no play control").toHaveCount(0);
  await expect(page.locator(EMBED), "no embed").toHaveCount(0);

  // The EVENTS.PORTRAIT.1 geometry, unchanged to the pixel.
  const box = (await page.locator(IMG).boundingBox())!;
  expect(Math.abs(box.width - LEGACY_WRAPPER_W), "full wrapper width, as before").toBeLessThanOrEqual(2);
  expect(Math.abs(box.height - LEGACY_MAX_H), "clamped to 420px, as before").toBeLessThanOrEqual(2);
});

/* ───────────────────── law 2 — an uploaded video plays itself ───────────────────── */

test("an uploaded video renders muted, looping and inline, with the image as its poster", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await open(page, PAGE, { imageUrl: LANDSCAPE_SRC, videoFileUrl: CLIP });

  const video = page.locator(VIDEO);
  await expect(video, "the video is the card's medium").toHaveCount(1);

  // ONE medium: the image is the poster, not a second picture on the card.
  await expect(page.locator(IMG), "the image does not also render as a picture").toHaveCount(0);
  expect(await video.getAttribute("poster"), "the card image posters the video").toBe(LANDSCAPE_SRC);

  const state = await video.evaluate((el: HTMLVideoElement) => ({
    muted: el.muted,
    loop: el.loop,
    playsInline: el.playsInline,
    autoplay: el.hasAttribute("autoplay"),
    controls: el.hasAttribute("controls"),
  }));
  expect(state, "STEP 2's four words, as rendered attributes").toEqual({
    muted: true,
    loop: true,
    playsInline: true,
    autoplay: true,
    controls: false,
  });

  // Playback itself is deliberately not asserted: the harness has no decodable
  // clip (and no codec guarantee), so the falsifiable thing is the CONFIGURATION
  // — which is the whole of what this component controls.
  await expect(video).toHaveAttribute("data-reduced", "false");
});

/* ─────────────── laws 3 + 4 — consent first, and the box never moves ─────────────── */

test("a social card is a poster and a play control until it is clicked", async ({ page }) => {
  test.setTimeout(60_000);
  const requests = trackPlatformRequests(page);
  await open(page, PAGE, { imageUrl: LANDSCAPE_SRC, videoUrl: TIKTOK_URL });

  const well = page.locator(SOCIAL);
  await expect(well, "the social well is the card's medium").toHaveCount(1);
  await expect(well).toHaveAttribute("data-platform", "tiktok");
  await expect(page.locator(POSTER), "the poster is what the visitor sees").toBeVisible();
  await expect(page.locator(PLAY), "…with a way to ask for the video").toBeVisible();

  // Law 3 — the page is complete and NOTHING has been asked of TikTok.
  await expect(page.locator(EMBED), "no embed before the click").toHaveCount(0);
  expect(requests, "no third-party request before consent").toEqual([]);

  // Law 4 — measure the well, then mount the player, then measure again.
  const before = (await well.boundingBox())!;
  await page.locator(PLAY).click();

  const embed = page.locator(EMBED);
  await expect(embed, "the click mounts the player").toHaveCount(1);
  expect(await embed.getAttribute("src"), "the platform's OWN embed endpoint").toBe(
    `https://www.tiktok.com/embed/v2/${TIKTOK_ID}`,
  );
  await expect(page.locator(PLAY), "the play control gives way to the player").toHaveCount(0);
  expect(requests.length, "the platform is reached only after the click").toBeGreaterThan(0);

  await page.waitForTimeout(400);
  const after = (await well.boundingBox())!;
  expect(Math.abs(after.width - before.width), "the well's width is unchanged").toBeLessThanOrEqual(1);
  expect(Math.abs(after.height - before.height), "the well's height is unchanged").toBeLessThanOrEqual(1);
});

test("YouTube and Instagram links resolve to their own official embeds", async ({ page }) => {
  test.setTimeout(60_000);

  await open(page, PAGE, { imageUrl: LANDSCAPE_SRC, videoUrl: YT_URL });
  await expect(page.locator(SOCIAL)).toHaveAttribute("data-platform", "youtube");
  await page.locator(PLAY).click();
  expect(await page.locator(EMBED).getAttribute("src")).toContain(
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
  );

  await open(page, PAGE, { imageUrl: LANDSCAPE_SRC, videoUrl: IG_URL });
  await expect(page.locator(SOCIAL)).toHaveAttribute("data-platform", "instagram");
  await page.locator(PLAY).click();
  // A reel embeds as a reel — the post's KIND survives the round trip.
  expect(await page.locator(EMBED).getAttribute("src")).toBe(
    "https://www.instagram.com/reel/CzAbCdEfGhI/embed",
  );
});

/* ──────────────── law 5 — an unreadable link is the still image ──────────────── */

test("a link the site cannot read falls back to the image, and says nothing to the visitor", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const requests = trackPlatformRequests(page);
  await open(page, PAGE, { imageUrl: LANDSCAPE_SRC, videoUrl: BAD_URL });

  await expect(page.locator(IMG), "the still image stands in").toHaveCount(1);
  await expect(page.locator(SOCIAL), "no well was invented for it").toHaveCount(0);
  await expect(page.locator(PLAY), "no play control that could not play").toHaveCount(0);
  await expect(page.locator(EMBED), "no embed").toHaveCount(0);
  await expect(page.locator(WARNING), "the visitor is not shown our diagnostics").toHaveCount(0);
  expect(requests, "an unreadable link reaches no platform").toEqual([]);

  // The fallback is the REAL image well, at the ratified geometry.
  const box = (await page.locator(IMG).boundingBox())!;
  expect(Math.abs(box.width - LEGACY_WRAPPER_W)).toBeLessThanOrEqual(2);
});

/* ─────────────────── law 6 — …and it IS reported, in admin ─────────────────── */

test("the same unreadable link is called out in the admin's own preview", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await injectAdminSession(page);
  await forceLanguage(page, "es");
  await routeMedia(page);
  await routeSupabase(page, {
    eventsBoard: boardWith({ imageUrl: LANDSCAPE_SRC, videoUrl: BAD_URL }),
  });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  await page.locator('[data-qa="admin-nav-events"]').click();
  await page.locator('[data-qa="events-board-toggle"]').click();
  await expect(page.locator('[data-qa="event-media"]'), "the media section").toBeVisible();

  // The field says so where it is typed…
  await expect(page.locator('[data-qa="event-social-bad"]')).toBeVisible();
  // …and the preview card says so where it is seen.
  await expect(page.locator(WARNING).first()).toBeVisible();
});

test("a readable link is confirmed in the editor, by platform name", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await injectAdminSession(page);
  await forceLanguage(page, "en");
  await routeMedia(page);
  await routeSupabase(page, {
    eventsBoard: boardWith({ imageUrl: LANDSCAPE_SRC, videoUrl: TIKTOK_URL }),
  });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  await page.locator('[data-qa="admin-nav-events"]').click();
  await page.locator('[data-qa="events-board-toggle"]').click();

  await expect(page.locator('[data-qa="event-social-ok"]')).toContainText("TikTok");
  await expect(page.locator('[data-qa="event-social-bad"]')).toHaveCount(0);
  await expect(page.locator(WARNING), "a link that works warns about nothing").toHaveCount(0);
});

/* ─────────────────── law 7 — reduced motion holds the frame ─────────────────── */

test("under reduced motion the video does not autoplay, and gains controls", async ({ page }) => {
  test.setTimeout(60_000);
  await open(page, PAGE, { imageUrl: LANDSCAPE_SRC, videoFileUrl: CLIP }, { reduced: true });

  const video = page.locator(VIDEO);
  await expect(video).toHaveCount(1);
  await expect(video).toHaveAttribute("data-reduced", "true");

  const state = await video.evaluate((el: HTMLVideoElement) => ({
    autoplay: el.hasAttribute("autoplay"),
    controls: el.hasAttribute("controls"),
    paused: el.paused,
    poster: el.getAttribute("poster"),
  }));
  expect(state.autoplay, "nothing moves on its own").toBe(false);
  expect(state.controls, "…but the video is still reachable").toBe(true);
  expect(state.paused, "the frame is held").toBe(true);
  expect(state.poster, "and the frame being held is the card image").toBe(LANDSCAPE_SRC);
});

test("under reduced motion a social card still offers the poster and its play control", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const requests = trackPlatformRequests(page);
  await open(page, PAGE, { imageUrl: LANDSCAPE_SRC, videoUrl: TIKTOK_URL }, { reduced: true });

  // Click-to-play is ALREADY the reduced-motion behaviour: nothing autoplays,
  // because nothing plays at all until the visitor says so.
  await expect(page.locator(POSTER)).toBeVisible();
  await expect(page.locator(PLAY)).toBeVisible();
  await expect(page.locator(EMBED)).toHaveCount(0);
  expect(requests).toEqual([]);
});

/* ──────────────── law 8 — one card grammar, both rooms ──────────────── */

test.describe("both rooms render the same media grammar", () => {
  const CASES: { name: string; overrides: Card; expect: string }[] = [
    { name: "image", overrides: { imageUrl: LANDSCAPE_SRC }, expect: IMG },
    { name: "uploaded video", overrides: { imageUrl: LANDSCAPE_SRC, videoFileUrl: CLIP }, expect: VIDEO },
    { name: "social video", overrides: { imageUrl: LANDSCAPE_SRC, videoUrl: TIKTOK_URL }, expect: SOCIAL },
  ];

  for (const c of CASES) {
    test(`${c.name} renders in the /events grid and in the cinematic act`, async ({ page }) => {
      test.setTimeout(90_000);

      await open(page, PAGE, c.overrides);
      await expect(page.locator(c.expect), `${c.name} on /events`).toHaveCount(1);

      // The act is DEV-previewed lit (?events=A) with the same mocked board, so
      // the card is the same component standing in the other room.
      await open(page, ACT, c.overrides);
      const act = page.locator('[data-qa="cinematic-events"]');
      await expect(act.locator('[data-qa="events-cards"]'), "the act is lit").toHaveCount(1);
      await expect(act.locator(c.expect), `${c.name} in the cinematic act`).toHaveCount(1);
    });
  }

  test("an autoplaying video does not stop the act from pinning", async ({ page }) => {
    test.setTimeout(90_000);
    await open(page, ACT, { imageUrl: LANDSCAPE_SRC, videoFileUrl: CLIP });

    // EVENTS.2's decode-wait law, extended to video: the pin is created only
    // once the medium has settled. A video whose source never decodes must
    // still SETTLE (via `error`), or the act would silently never pin — which
    // is the failure this assertion exists to catch.
    await expect(page.locator('[data-qa="events-stage"]')).toHaveCount(1);
    const pinned = await page.evaluate(() => {
      const stage = document.querySelector('[data-qa="events-stage"]');
      return !!stage && !!stage.closest(".pin-spacer");
    });
    expect(pinned, "the stage is inside a pin-spacer").toBe(true);
  });
});

/* ─────────── law 9 — the file the owner PICKS is the file that uploads ─────────── */

/**
 * VIDEO.1.FIX-B. Every law above starts from a card that already HAS its video;
 * nothing tested the act of choosing one, and that is exactly where the medium
 * was dying. A FileList is a live view of the input, not a copy, so the "let the
 * same file be re-picked after a refusal" reset emptied the very list the
 * handler had just been handed: every upload returned at the `!file` guard in
 * silence, and the 60 MB refusal was unreachable code — a message that could
 * never have been observed from outside the component.
 *
 * So these two drive the REAL input the way a person does (a real File, a real
 * DataTransfer, a native `change` event — the reproduction that found the bug)
 * and hold the two things the handler owes: a good file goes to storage, and a
 * file that is too big is refused OUT LOUD and goes nowhere.
 *
 * Nothing leaves this machine. `routeSupabase` intercepts every `/storage/v1/`
 * request, so the POST asserted below is fulfilled by the harness; the
 * production bucket is never reached, and the writes array is the proof of what
 * was attempted.
 */

const STORAGE = /\/storage\/v1\//;
const UPLOAD_BTN = '[data-qa="event-video-upload"]';
const PREVIEW = '[data-qa="event-video-preview"]';
const REJECT = '[data-qa="event-video-reject"]';

/** The admin's events editor, open on one image-only card. */
async function openEditor(page: Page, writes: Write[]) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await injectAdminSession(page);
  await forceLanguage(page, "en");
  await routeMedia(page);
  await routeSupabase(page, { eventsBoard: boardWith({ imageUrl: LANDSCAPE_SRC }), writes });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  await page.locator('[data-qa="admin-nav-events"]').click();
  await page.locator('[data-qa="events-board-toggle"]').click();
  await expect(page.locator('[data-qa="event-media"]'), "the media section").toBeVisible();
}

/**
 * Pick a file the way the browser does — NOT setInputFiles. The defect lived in
 * the handler's own reading of `e.target.files`, so only a genuine live FileList
 * on the genuine input can prove it is gone.
 */
async function pickVideo(page: Page, o: { name: string; type: string; bytes: number }) {
  await page.evaluate((f) => {
    const input = document.querySelector<HTMLInputElement>('[data-qa="event-video-input"]');
    if (!input) throw new Error("event video input not found");
    const file = new File([new Uint8Array(f.bytes)], f.name, { type: f.type });
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, o);
}

test("picking a valid video uploads it, and the field shows what was uploaded", async ({ page }) => {
  test.setTimeout(90_000);
  const writes: Write[] = [];
  await openEditor(page, writes);

  // Hold the upload open so "busy" is a fact and not a flicker. Registered
  // after routeSupabase, so this handler wins the match; GETs (the preview
  // fetching its own public URL) fall back to the harness's storage route.
  await page.route("**/storage/v1/object/**", async (route) => {
    const req = route.request();
    if (req.method() !== "POST" && req.method() !== "PUT") return route.fallback();
    writes.push({ method: req.method(), url: req.url(), body: null });
    await new Promise((r) => setTimeout(r, 1200));
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ Key: "gallery/events/mock.mp4" }),
    });
  });

  await pickVideo(page, { name: "announcement.mp4", type: "video/mp4", bytes: 1024 });

  await expect(page.locator(UPLOAD_BTN), "the uploader says it is working").toBeDisabled();
  await expect(page.locator(REJECT), "a valid file is refused nothing").toHaveCount(0);

  const preview = page.locator(PREVIEW);
  await expect(preview, "the uploaded video takes the picker's place").toBeVisible({
    timeout: 20_000,
  });
  expect(await preview.getAttribute("src"), "…at its own public URL, under events/").toMatch(
    /\/storage\/v1\/object\/public\/gallery\/events\/[\w-]+\.mp4$/,
  );

  const posts = writes.filter((w) => STORAGE.test(w.url));
  expect(posts.length, "exactly one storage write, and the harness caught it").toBe(1);
  expect(posts[0].method, "…a POST, intercepted — never the live bucket").toBe("POST");
});

test("a video over the 60 MB cap is refused out loud, and reaches no bucket", async ({ page }) => {
  test.setTimeout(90_000);
  const writes: Write[] = [];
  await openEditor(page, writes);

  await pickVideo(page, { name: "too-big.mp4", type: "video/mp4", bytes: 61 * 1024 * 1024 });

  const reject = page.locator(REJECT);
  await expect(reject, "the refusal is said where the file was picked").toBeVisible();
  await expect(reject, "…and it names the cap, not a generic failure").toContainText("60 MB");
  await expect(page.locator(PREVIEW), "nothing was accepted").toHaveCount(0);

  // Give a wrongly-permitted upload every chance to show up before we deny it.
  await page.waitForTimeout(1500);
  expect(writes.filter((w) => STORAGE.test(w.url)), "a refused file uploads nothing").toEqual([]);
});

/* ─────────────── law 10 — the video well IS the image well ─────────────── */

/**
 * VIDEO.1.FIX-C. Every geometry assertion above this line is about the IMAGE
 * branch; the uploaded-video branch was covered for its ATTRIBUTES (muted, loop,
 * poster) and never once for its BOX. That gap is why "the video renders small
 * in a dark box" had to be diagnosed by hand instead of being caught here.
 *
 * The law is stated as an equality rather than as numbers, because numbers would
 * only re-encode PORTRAIT.1's caps in a second place and drift from them. The
 * test renders the SAME card twice — once with an image of ratio R, once with a
 * video of ratio R — and demands the two rendered boxes be the same box. That is
 * exactly "the geometry the image branch would produce for the same aspect
 * ratio", and it stays true if Joey ever moves the caps.
 *
 * It runs at 390 and at 1280 because the two viewports take DIFFERENT branches
 * of the portrait cap (56vh on the phone, min(560px,70vh) above md), so a fix
 * that satisfied one could still be wrong in the other room.
 *
 * The fixtures are real decodable clips (`e2e/fixtures/*.webm`, one flat frame
 * each, ~7 KB) and not the empty-bodied route the laws above use: `videoWidth`
 * is the whole subject here, and an undecodable file reports 0x0 forever.
 */

const clip = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url));

/** 9:16 — the TikTok poster shape, as a video and as an image. */
const PORTRAIT_CLIP = "/fixtures/portrait-1080x1920.webm";
const PORTRAIT_BYTES = clip("portrait-1080x1920.webm");
const PORTRAIT_IMG_SRC = svgImage(1080, 1920, "#3a2f1c");
/** 16:9 — the shape the well was originally built for. */
const LANDSCAPE_CLIP = "/fixtures/landscape-1600x900.webm";
const LANDSCAPE_BYTES = clip("landscape-1600x900.webm");

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "1280", width: 1280, height: 800 },
];

/** The historic landscape band, from EVENTS.PORTRAIT.1. */
const BAND_H = 420;

type Box = { width: number; height: number };

/**
 * Mount one card at one viewport and return the rendered box of its medium,
 * plus the box of the WELL (the wrapper) it sits in — the wrapper is the thing
 * "same well width" is about, and it is shared by both branches.
 */
async function mediaBox(
  page: Page,
  overrides: Card,
  vp: { width: number; height: number },
): Promise<{ media: Box; well: Box; aspect: string | null }> {
  await page.setViewportSize(vp);
  await forceLanguage(page, "es");
  await page.route(`**${PORTRAIT_CLIP}`, (route) =>
    route.fulfill({ status: 200, contentType: "video/webm", body: PORTRAIT_BYTES }),
  );
  await page.route(`**${LANDSCAPE_CLIP}`, (route) =>
    route.fulfill({ status: 200, contentType: "video/webm", body: LANDSCAPE_BYTES }),
  );
  await routeSupabase(page, { eventsBoard: boardWith(overrides) });
  await page.goto(PAGE, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

  // Both branches settle on their INTRINSIC size, which is what "auto" probes;
  // measuring before that is measuring the fallback, not the law.
  await page.waitForFunction(
    () => {
      const v = document.querySelector<HTMLVideoElement>('[data-qa="event-card-video"]');
      if (v) return v.readyState >= 1 && v.videoWidth > 0;
      const i = document.querySelector<HTMLImageElement>('[data-qa="event-card-image"]');
      return !!i && i.complete && i.naturalWidth > 0;
    },
    undefined,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(250);

  const el = page.locator(`${VIDEO}, ${IMG}`);
  await expect(el, "the card has exactly one medium").toHaveCount(1);
  const media = (await el.boundingBox())!;
  const well = (await el.locator("xpath=..").boundingBox())!;
  return { media, well, aspect: await el.getAttribute("data-aspect") };
}

/**
 * LAW 10, as re-ratified by EVENTS.MEDIA.EDITOR.1c: THE UPLOADED-VIDEO WELL
 * FOLLOWS THE SCREEN, NOT THE FILE. One file has to work in every aspect
 * ratio (the hero's own law), so a portrait screen shows the tall 9:16 well
 * at the ratified NAV.1 caps and a landscape screen shows the historic
 * full-width 420px band — whatever shape the clip is, with the clip framed
 * into that box by the per-view records. Still images are untouched:
 * PORTRAIT.1's own-ratio law holds for them (the framed-image tests below and
 * events-portrait.spec.ts pin it).
 */
for (const vp of VIEWPORTS) {
  test(`the uploaded-video well is the screen's box, whatever the clip's shape (@${vp.name})`, async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const portrait = await mediaBox(page, { videoFileUrl: PORTRAIT_CLIP }, vp);
    const landscape = await mediaBox(page, { videoFileUrl: LANDSCAPE_CLIP }, vp);

    // The file has NO say: a 9:16 clip and a 16:9 clip render the same box.
    expect(
      Math.abs(portrait.media.width - landscape.media.width),
      `portrait clip ${portrait.media.width.toFixed(1)}x${portrait.media.height.toFixed(1)} vs ` +
        `landscape clip ${landscape.media.width.toFixed(1)}x${landscape.media.height.toFixed(1)}`,
    ).toBeLessThanOrEqual(2);
    expect(Math.abs(portrait.media.height - landscape.media.height)).toBeLessThanOrEqual(2);

    if (vp.width < vp.height) {
      // Portrait screen: the tall 9:16 well at the dialed-in 56vh phone cap.
      expect(portrait.aspect, "the well reports the screen").toBe("portrait");
      expect(
        Math.abs(portrait.media.width / portrait.media.height - 9 / 16),
        "the well is the 9:16 design box",
      ).toBeLessThan(0.02);
      expect(
        Math.abs(portrait.media.height - 0.56 * vp.height),
        "the well fills the ratified phone room",
      ).toBeLessThanOrEqual(3);
      expect(portrait.media.height, "taller than the band").toBeGreaterThan(BAND_H);
    } else {
      // Landscape screen: the historic full-width band, exactly as before.
      expect(portrait.aspect, "the well reports the screen").toBe("landscape");
      expect(Math.abs(portrait.media.width - LEGACY_WRAPPER_W)).toBeLessThanOrEqual(2);
      expect(Math.abs(portrait.media.height - BAND_H)).toBeLessThanOrEqual(2);
    }
  });
}

/* ─────── EVENTS.MEDIA.EDITOR.1b — framing through the hero resolver ─────── */

/**
 * The card's media can now carry framing in the hero system's stored shapes
 * (image: {phone,wide} at the reel's 768px line; video: {landscape,portrait}
 * by viewport orientation), painted by resolveHeroMediaStyle. These tests
 * assert the RENDERED rectangle against the resolver's own math — the same
 * function the app calls — so a render that ignored, halved or misrouted the
 * stored record cannot pass. Law 10 above is the no-framing regression guard
 * and is deliberately untouched: an absent record must keep producing the
 * legacy element-box render it pins.
 */

const FRAMED_IMAGE = {
  phone: { focal: { x: 0.3, y: 0.2 }, zoom: 1.6 },
  wide: { focal: { x: 0.7, y: 0.4 }, zoom: 1.4 },
};
const FRAMED_VIDEO = {
  portrait: { focal: { x: 0.3, y: 0.2 }, zoom: 1.6, fit: "fill" },
  landscape: { focal: { x: 0.7, y: 0.4 }, zoom: 1.4, fit: "fill" },
};

type Rect = { x: number; y: number; width: number; height: number };

/** Mount one card and return full rects of the medium and its well box. */
async function framedRects(
  page: Page,
  overrides: Card,
  vp: { width: number; height: number },
): Promise<{ media: Rect; well: Rect }> {
  await page.setViewportSize(vp);
  await forceLanguage(page, "es");
  await page.route(`**${PORTRAIT_CLIP}`, (route) =>
    route.fulfill({ status: 200, contentType: "video/webm", body: PORTRAIT_BYTES }),
  );
  await routeSupabase(page, { eventsBoard: boardWith(overrides) });
  await page.goto(PAGE, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForFunction(
    () => {
      const v = document.querySelector<HTMLVideoElement>('[data-qa="event-card-video"]');
      if (v) return v.readyState >= 1 && v.videoWidth > 0;
      const i = document.querySelector<HTMLImageElement>('[data-qa="event-card-image"]');
      return !!i && i.complete && i.naturalWidth > 0;
    },
    undefined,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(300);
  const el = page.locator(`${VIDEO}, ${IMG}`);
  await expect(el, "the card has exactly one medium").toHaveCount(1);
  const media = (await el.boundingBox())!;
  const well = (await el.locator("xpath=..").boundingBox())!;
  return { media, well };
}

/** The record's expected rectangle inside the measured well — resolver math. */
const expectResolverRect = (
  got: { media: Rect; well: Rect },
  natAspect: number,
  rec: { focal: { x: number; y: number }; zoom: number },
) => {
  const geo = resolveHeroGeometry(natAspect, got.well.width / got.well.height, {
    scale: rec.zoom,
    posX: rec.focal.x * 100,
    posY: rec.focal.y * 100,
    fit: "fill",
  })!;
  expect(geo, "the resolver has a rectangle for a decoded medium").not.toBeNull();
  const tol = 2;
  expect(
    Math.abs(got.media.width - (got.well.width * geo.widthPct) / 100),
    `width ${got.media.width.toFixed(1)} vs resolver ${((got.well.width * geo.widthPct) / 100).toFixed(1)}`,
  ).toBeLessThanOrEqual(tol);
  expect(
    Math.abs(got.media.height - (got.well.height * geo.heightPct) / 100),
    "height follows the resolver",
  ).toBeLessThanOrEqual(tol);
  expect(
    Math.abs(got.media.x - got.well.x - (got.well.width * geo.leftPct) / 100),
    "the pan (left offset) follows the resolver",
  ).toBeLessThanOrEqual(tol);
  expect(
    Math.abs(got.media.y - got.well.y - (got.well.height * geo.topPct) / 100),
    "the pan (top offset) follows the resolver",
  ).toBeLessThanOrEqual(tol);
};

for (const vp of VIEWPORTS) {
  test(`a framed still image renders the resolver's crop (@${vp.name})`, async ({ page }) => {
    test.setTimeout(90_000);
    const got = await framedRects(
      page,
      { imageUrl: PORTRAIT_IMG_SRC, imageFraming: FRAMED_IMAGE },
      vp,
    );
    // The stored shape routes by device class at the reel's 768px line.
    const rec = vp.width < 768 ? FRAMED_IMAGE.phone : FRAMED_IMAGE.wide;
    expectResolverRect(got, 1080 / 1920, rec);
    // Falsifiability: a render that ignored the record would paint 100%.
    expect(got.media.width / got.well.width).toBeGreaterThan(1.2);
  });

  test(`a framed uploaded video renders the resolver's crop (@${vp.name})`, async ({ page }) => {
    test.setTimeout(90_000);
    const got = await framedRects(
      page,
      { videoFileUrl: PORTRAIT_CLIP, videoFraming: FRAMED_VIDEO },
      vp,
    );
    // The stored shape routes by VIEWPORT orientation (the hero video's law):
    // 390x844 is a portrait viewport, 1280x800 a landscape one.
    const rec = vp.width < vp.height ? FRAMED_VIDEO.portrait : FRAMED_VIDEO.landscape;
    expectResolverRect(got, 1080 / 1920, rec);
    expect(got.media.width / got.well.width).toBeGreaterThan(1.2);
  });
}

/* ── the admin: one combined zone, and framing that survives the round trip ── */

/** The admin's events editor, open on one card with the given fields. */
async function openMediaEditor(page: Page, writes: Write[], overrides: Card) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await injectAdminSession(page);
  await forceLanguage(page, "en");
  await routeMedia(page);
  await routeSupabase(page, { eventsBoard: boardWith(overrides), writes });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.locator('[data-qa="admin-nav-events"]').click();
  await page.locator('[data-qa="events-board-toggle"]').click();
  await expect(page.locator('[data-qa="event-media"]'), "the media section").toBeVisible();
}

/** Drive the REAL combined input the way a person does (the pickVideo law). */
async function pickMedia(page: Page, o: { name: string; type: string; bytes: number }) {
  await page.evaluate((f) => {
    const input = document.querySelector<HTMLInputElement>('[data-qa="event-video-input"]');
    if (!input) throw new Error("combined media input not found");
    const file = new File([new Uint8Array(f.bytes)], f.name, { type: f.type });
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, o);
}

/** Set a React-controlled range input through its native value setter. */
async function setRange(page: Page, selector: string, value: string) {
  await page.evaluate(
    ({ sel, v }) => {
      const el = document.querySelector<HTMLInputElement>(sel);
      if (!el) throw new Error(`range not found: ${sel}`);
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    { sel: selector, v: value },
  );
}

test("the one combined zone accepts an image AND a video, through the same input", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const writes: Write[] = [];
  await openMediaEditor(page, writes, {});

  // There is ONE zone: the legacy separate image drop zone is gone.
  await expect(page.locator('[data-qa="event-video-upload"]')).toHaveCount(1);
  await expect(page.locator('[data-qa="event-video-input"]')).toHaveCount(1);

  // An image file routes to the image slot (compression falls back offline;
  // the upload itself is intercepted by the harness, never a live bucket).
  await pickMedia(page, { name: "poster.png", type: "image/png", bytes: 2048 });
  const imgPreview = page.locator('[data-qa="event-image-preview"]');
  await expect(imgPreview, "the image lands as the card image").toBeVisible({ timeout: 20_000 });
  expect(await imgPreview.getAttribute("src")).toMatch(
    /\/storage\/v1\/object\/public\/gallery\/events\/[\w-]+\.webp$/,
  );

  // A video file, through the SAME input, routes to the uploaded-video slot.
  await pickMedia(page, { name: "clip.mp4", type: "video/mp4", bytes: 1024 });
  const vidPreview = page.locator('[data-qa="event-video-preview"]');
  await expect(vidPreview, "the video lands as the uploaded video").toBeVisible({
    timeout: 20_000,
  });
  expect(await vidPreview.getAttribute("src")).toMatch(
    /\/storage\/v1\/object\/public\/gallery\/events\/[\w-]+\.mp4$/,
  );

  expect(
    writes.filter((w) => STORAGE.test(w.url)).length,
    "both media reached storage — and only through the harness",
  ).toBe(2);
});

test("framing set in the editor is written to the row on save", async ({ page }) => {
  test.setTimeout(90_000);
  const writes: Write[] = [];
  await openMediaEditor(page, writes, { imageUrl: LANDSCAPE_SRC });

  await page.locator('[data-qa="event-edit-framing"]').click();
  await expect(page.locator('[data-qa="event-framing-editor"]')).toBeVisible();

  // The default tab is the iPhone — the PHONE class record.
  const save = page.locator('[data-qa="event-framing-save"]');
  await expect(save, "save arms once the medium has decoded").toBeEnabled({ timeout: 15_000 });
  await setRange(page, '[data-qa="event-framing-zoom"]', "1.5");
  await expect(page.locator('[data-qa="event-framing-zoom-value"]')).toHaveText("1.50×");
  await save.click();
  await expect(page.locator('[data-qa="event-framing-editor"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Save changes" }).click();
  await expect
    .poll(
      () =>
        writes.some(
          (w) =>
            /\/rest\/v1\//.test(w.url) &&
            !!w.body &&
            w.body.includes('"imageFraming"') &&
            w.body.includes('"zoom":1.5'),
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
});

test("stored framing reopens in the editor exactly as saved", async ({ page }) => {
  test.setTimeout(90_000);
  await openMediaEditor(page, [], {
    imageUrl: LANDSCAPE_SRC,
    imageFraming: {
      phone: { focal: { x: 0.5, y: 0.5 }, zoom: 1.5 },
      wide: { focal: { x: 0.5, y: 0.5 }, zoom: 1 },
    },
  });

  await page.locator('[data-qa="event-edit-framing"]').click();
  await expect(page.locator('[data-qa="event-framing-editor"]')).toBeVisible();

  // iPhone tab (phone class) shows the saved zoom; the Desktop tab (wide
  // class) shows its own untouched record — two records, not one.
  await expect(page.locator('[data-qa="event-framing-zoom-value"]')).toHaveText("1.50×");
  await page.locator('[data-qa="event-framing-device-desktop"]').click();
  await expect(page.locator('[data-qa="event-framing-zoom-value"]')).toHaveText("1.00×");
});


/* ── EVENTS.MEDIA.EDITOR.1c — the hero editor's grammar, the CARD composition ── */

/**
 * Joey's ruling, both halves. The gold frame is the SCREEN (the hero editor's
 * device-aspect canvas); what fills it is the EVENT CARD as that screen shows
 * it — shell, badge, title, copy — with the medium painted into the CARD'S
 * media well and drag/zoom operating on that well's real overflow (the hero
 * editor's previewFrame law). The uploaded-video well is the SCREEN's design
 * box — 9:16 at the ratified caps on portrait screens, the 420 band on
 * landscape ones — so ONE file of any shape is framed per view; a still image
 * keeps PORTRAIT.1's own-ratio well. These laws pin both halves with the
 * resolver's own math.
 */

const EDITOR_TABS = [
  { id: "iphone-17-pro", w: 402, h: 874 },
  { id: "ipad-air", w: 820, h: 1180 },
  { id: "desktop", w: 1440, h: 900 },
] as const;

const EDITOR_MEDIA = '[data-qa="event-framing-media"]';

type EditorRects = { surface: Rect; well: Rect; media: Rect };

/** The canvas surface, the card's well inside it, and the media element. */
async function editorRects(page: Page): Promise<EditorRects> {
  const surface = (await page.locator('[data-qa="event-framing-surface"]').boundingBox())!;
  const media = (await page.locator(EDITOR_MEDIA).boundingBox())!;
  const well = (await page.locator(EDITOR_MEDIA).locator("xpath=..").boundingBox())!;
  return { surface, well, media };
}

/** Open the admin framing editor on one card (the hero-grammar dialog). */
async function openFramingEditor(page: Page, overrides: Card) {
  await page.route(`**${PORTRAIT_CLIP}`, (route) =>
    route.fulfill({ status: 200, contentType: "video/webm", body: PORTRAIT_BYTES }),
  );
  await openMediaEditor(page, [], overrides);
  await page.locator('[data-qa="event-edit-framing"]').click();
  await expect(page.locator('[data-qa="event-framing-editor"]')).toBeVisible();
  await expect(
    page.locator('[data-qa="event-framing-save"]'),
    "save arms once the medium has decoded",
  ).toBeEnabled({ timeout: 15_000 });
}

/** The screen is the frame; the media follows the resolver INSIDE the well. */
const expectCardCanvas = (
  got: EditorRects,
  device: { id: string; w: number; h: number },
  wellAspect: number,
  rec: { focal: { x: number; y: number }; zoom: number; fit?: string },
) => {
  const deviceAspect = device.w / device.h;
  expect(
    Math.abs(got.surface.width / got.surface.height - deviceAspect),
    `${device.id}: the canvas IS the screen (${(got.surface.width / got.surface.height).toFixed(3)} vs ${deviceAspect.toFixed(3)})`,
  ).toBeLessThanOrEqual(0.01);

  expect(
    Math.abs(got.well.width / got.well.height - wellAspect),
    `${device.id}: the card's well holds its design shape ` +
      `(${(got.well.width / got.well.height).toFixed(3)} vs ${wellAspect.toFixed(3)})`,
  ).toBeLessThanOrEqual(0.02);

  const geo = resolveHeroGeometry(1080 / 1920, got.well.width / got.well.height, {
    scale: rec.zoom,
    posX: rec.focal.x * 100,
    posY: rec.focal.y * 100,
    fit: rec.fit === "fit" ? "fit" : "fill",
  })!;
  expect(geo, "the resolver has a rectangle for the decoded medium").not.toBeNull();
  const tol = 2;
  expect(
    Math.abs(got.media.width - (got.well.width * geo.widthPct) / 100),
    `${device.id}: width ${got.media.width.toFixed(1)} vs resolver ${((got.well.width * geo.widthPct) / 100).toFixed(1)}`,
  ).toBeLessThanOrEqual(tol);
  expect(
    Math.abs(got.media.height - (got.well.height * geo.heightPct) / 100),
    `${device.id}: height follows the resolver`,
  ).toBeLessThanOrEqual(tol);
  expect(
    Math.abs(got.media.x - got.well.x - (got.well.width * geo.leftPct) / 100),
    `${device.id}: the pan (left offset) follows the resolver`,
  ).toBeLessThanOrEqual(tol);
  expect(
    Math.abs(got.media.y - got.well.y - (got.well.height * geo.topPct) / 100),
    `${device.id}: the pan (top offset) follows the resolver`,
  ).toBeLessThanOrEqual(tol);
};

test("the editor frames the video into the CARD's well, per screen", async ({ page }) => {
  test.setTimeout(150_000);
  await openFramingEditor(page, {
    imageUrl: PORTRAIT_IMG_SRC,
    videoFileUrl: PORTRAIT_CLIP,
    videoFraming: FRAMED_VIDEO,
  });

  // The hero options are present: three device-thumbnail tabs, Fill/Fit, the
  // orientation caption.
  await expect(page.locator('[data-qa="event-framing-devices"] button')).toHaveCount(3);
  await expect(page.locator('[data-qa="event-framing-fit-fill"]')).toBeVisible();
  await expect(page.locator('[data-qa="event-framing-fit-fit"]')).toBeVisible();
  await expect(page.locator('[data-qa="event-framing-source-label"]')).toBeVisible();
  // The composition IS the card: its title is on the canvas.
  await expect(
    page.locator('[data-qa="event-framing-surface"]').getByText("Cumpleaños de Titi"),
  ).toBeVisible();

  for (const d of EDITOR_TABS) {
    await page.locator(`[data-qa="event-framing-device-${d.id}"]`).click();
    // The video well is the SCREEN's design box: 9:16 on portrait screens,
    // the 768x420 band on the landscape desktop.
    const wellAspect = d.w / d.h < 1 ? 9 / 16 : 768 / 420;
    const rec = d.w / d.h < 1 ? FRAMED_VIDEO.portrait : FRAMED_VIDEO.landscape;
    await expect
      .poll(async () => {
        const got = await editorRects(page);
        return got.media.width / got.well.width;
      }, { timeout: 15_000 })
      .toBeGreaterThan(1.2); // falsifiability: an ignored record paints <= 100%
    expectCardCanvas(await editorRects(page), d, wellAspect, rec);
  }

  // A portrait clip vs the desktop BAND raises the hero's hint; the phone
  // tab's 9:16 well matches the clip, so the hint stands down there.
  await expect(page.locator('[data-qa="event-framing-hint"]')).toBeVisible();
  await page.locator('[data-qa="event-framing-device-iphone-17-pro"]').click();
  await expect(page.locator('[data-qa="event-framing-hint"]')).toHaveCount(0);
});

test("the editor frames a still image into the CARD's own-ratio well, per screen", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await openFramingEditor(page, { imageUrl: PORTRAIT_IMG_SRC, imageFraming: FRAMED_IMAGE });

  await expect(page.locator('[data-qa="event-framing-devices"] button')).toHaveCount(3);
  // The image well is fill-only, like the hero photo: no Fill/Fit pair.
  await expect(page.locator('[data-qa="event-framing-fit"]')).toHaveCount(0);

  for (const d of EDITOR_TABS) {
    await page.locator(`[data-qa="event-framing-device-${d.id}"]`).click();
    // PORTRAIT.1 unchanged: the image well is the IMAGE's own ratio.
    const rec = d.w < 768 ? FRAMED_IMAGE.phone : FRAMED_IMAGE.wide;
    await expect
      .poll(async () => {
        const got = await editorRects(page);
        return got.media.width / got.well.width;
      }, { timeout: 15_000 })
      .toBeGreaterThan(1.0);
    expectCardCanvas(await editorRects(page), d, 1080 / 1920, rec);
  }
});

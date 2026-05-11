/**
 * Bakes a polished 1080×1920 (9:16) share card from a walk.
 *
 * Two automatic variants:
 *   - photo  → walk had at least one captured photo. Photo is the canvas;
 *              stats sit in a translucent bottom card. No writing.
 *   - map    → no photo, but a route snapshot exists. Cream card with the
 *              snapshot up top and a generous stat block below. No writing.
 *
 * We never bake reflection_note or intention text — those are private to
 * the journal and could be sensitive when shared.
 */
export interface ShareCardStats {
  miles: string;        // e.g. "2.31"
  minutes: number;      // total minutes
  steps?: number | null;
  date: string;         // pre-formatted "Tue, May 8"
  moodBefore?: string | null;
  moodAfter?: string | null;
  walkType?: string | null;
  weather?: { tempF?: number; label?: string } | null;
}

const FOREST = "#1f3a2c";
const CREAM = "#f5efe4";
const CLAY = "#c46a4a";

const W = 1080;
const H = 1920;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = (e) => rej(e);
    img.src = url;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  return { canvas, ctx };
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob((b) => res(b), "image/png", 0.92));
}

/** Draw the brand mark + URL pinned to the bottom of the canvas. */
function drawBrandFooter(ctx: CanvasRenderingContext2D, dark: boolean) {
  ctx.save();
  ctx.fillStyle = dark ? "rgba(255,255,255,0.78)" : "rgba(31,58,44,0.6)";
  ctx.font = "500 26px ui-sans-serif, system-ui, -apple-system";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("walk it through  ·  mhwalk.club", W / 2, H - 60);
  ctx.restore();
}

/** Pill helper. Returns the rendered width so callers can lay out a row. */
function drawPill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { fill: string; color: string; font: string; padX?: number; height?: number },
): number {
  const padX = opts.padX ?? 28;
  const h = opts.height ?? 56;
  ctx.font = opts.font;
  const w = ctx.measureText(text).width + padX * 2;
  ctx.fillStyle = opts.fill;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = opts.color;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, x + padX, y + h / 2 + 1);
  ctx.textBaseline = "alphabetic";
  return w;
}

// ────────────────────────────────────────────────────────────────────
// MAP VARIANT
// ────────────────────────────────────────────────────────────────────
async function bakeMapCard(snapshotUrl: string, stats: ShareCardStats): Promise<Blob | null> {
  const made = makeCanvas();
  if (!made) return null;
  const { canvas, ctx } = made;
  const img = await loadImage(snapshotUrl);

  // Cream background
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);

  // Map region — top 58% of the canvas (W × ~1110)
  const mapH = Math.round(H * 0.58); // 1113
  // Cover-fit the (square) snapshot into a wider-than-tall band
  const scale = Math.max(W / img.width, mapH / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (W - dw) / 2, (mapH - dh) / 2, dw, dh);

  // Eyebrow pill (top-left)
  drawPill(ctx, "MENTAL HEALTH WALK CLUB", 48, 48, {
    fill: "rgba(31,58,44,0.92)",
    color: CREAM,
    font: "600 24px ui-sans-serif, system-ui, -apple-system",
    padX: 26,
    height: 56,
  });

  // Date pill (top-right)
  ctx.font = "500 24px ui-sans-serif, system-ui, -apple-system";
  const dateW = ctx.measureText(stats.date).width + 52;
  drawPill(ctx, stats.date, W - 48 - dateW, 48, {
    fill: "rgba(255,255,255,0.95)",
    color: FOREST,
    font: "500 24px ui-sans-serif, system-ui, -apple-system",
    padX: 26,
    height: 56,
  });

  // Weather chip (bottom-left of map band, just above the fade)
  if (stats.weather?.tempF != null) {
    const wx = `${Math.round(stats.weather.tempF)}°${stats.weather.label ? "  ·  " + stats.weather.label : ""}`;
    drawPill(ctx, wx, 48, mapH - 96, {
      fill: "rgba(255,255,255,0.94)",
      color: FOREST,
      font: "500 26px ui-sans-serif, system-ui, -apple-system",
      padX: 24,
      height: 56,
    });
  }

  // Soft fade from map → cream
  const fade = ctx.createLinearGradient(0, mapH - 100, 0, mapH + 60);
  fade.addColorStop(0, "rgba(245,239,228,0)");
  fade.addColorStop(1, CREAM);
  ctx.fillStyle = fade;
  ctx.fillRect(0, mapH - 100, W, 160);

  // ── Bottom region (mapH .. H) — laid out with explicit baselines ──
  const bottomTop = mapH + 40;
  const bottomBot = H - 60; // brand footer line
  const bottomMid = (bottomTop + bottomBot) / 2;

  // Big serif distance — sits a bit above the optical center
  ctx.fillStyle = FOREST;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = "500 200px ui-serif, Georgia, 'Times New Roman', serif";
  ctx.fillText(`${stats.miles} mi`, W / 2, bottomMid + 20);

  // Sub-stats row
  ctx.font = "500 38px ui-sans-serif, system-ui, -apple-system";
  ctx.fillStyle = "rgba(31,58,44,0.7)";
  const sub = stats.steps != null
    ? `${stats.minutes} min  ·  ${stats.steps.toLocaleString()} steps`
    : `${stats.minutes} min`;
  ctx.fillText(sub, W / 2, bottomMid + 90);

  // Mood arc (controlled vocab only, no free text)
  const mb = stats.moodBefore?.toLowerCase().trim();
  const ma = stats.moodAfter?.toLowerCase().trim();
  if (mb || ma) {
    const arrow = "→";
    const before = mb ?? "—";
    const after = ma ?? "—";
    ctx.font = "500 30px ui-sans-serif, system-ui, -apple-system";
    const wB = ctx.measureText(before).width + 56;
    const wA = ctx.measureText(after).width + 56;
    const wArrow = ctx.measureText(arrow).width + 40;
    const total = wB + wArrow + wA;
    const y = bottomMid + 170;
    let x = (W - total) / 2;
    drawPill(ctx, before, x, y, {
      fill: "rgba(31,58,44,0.08)", color: FOREST,
      font: "500 30px ui-sans-serif, system-ui, -apple-system",
      padX: 28, height: 56,
    });
    x += wB;
    ctx.fillStyle = "rgba(31,58,44,0.45)";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(arrow, x + wArrow / 2, y + 30);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    x += wArrow;
    drawPill(ctx, after, x, y, {
      fill: "rgba(196,106,74,0.16)", color: CLAY,
      font: "500 30px ui-sans-serif, system-ui, -apple-system",
      padX: 28, height: 56,
    });
  }

  drawBrandFooter(ctx, false);
  return toBlob(canvas);
}

// ────────────────────────────────────────────────────────────────────
// PHOTO VARIANT
// ────────────────────────────────────────────────────────────────────
async function bakePhotoCard(photoUrl: string, stats: ShareCardStats): Promise<Blob | null> {
  const made = makeCanvas();
  if (!made) return null;
  const { canvas, ctx } = made;
  const img = await loadImage(photoUrl);

  // Forest backstop in case the photo is narrower than the canvas
  ctx.fillStyle = FOREST;
  ctx.fillRect(0, 0, W, H);

  // Cover-fit the photo into the full 1080×1920 canvas
  const scale = Math.max(W / img.width, H / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);

  // Top fade (so eyebrow + date are legible on busy photos)
  const topFade = ctx.createLinearGradient(0, 0, 0, 240);
  topFade.addColorStop(0, "rgba(0,0,0,0.45)");
  topFade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = topFade;
  ctx.fillRect(0, 0, W, 240);

  // Bottom scrim where the stat card sits
  const cardTop = Math.round(H * 0.62);
  const bottomFade = ctx.createLinearGradient(0, cardTop - 140, 0, H);
  bottomFade.addColorStop(0, "rgba(0,0,0,0)");
  bottomFade.addColorStop(0.6, "rgba(0,0,0,0.55)");
  bottomFade.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = bottomFade;
  ctx.fillRect(0, cardTop - 140, W, H - (cardTop - 140));

  // Eyebrow + date
  drawPill(ctx, "MENTAL HEALTH WALK CLUB", 48, 48, {
    fill: "rgba(255,255,255,0.16)",
    color: CREAM,
    font: "600 24px ui-sans-serif, system-ui, -apple-system",
    padX: 26,
    height: 56,
  });
  ctx.font = "500 24px ui-sans-serif, system-ui, -apple-system";
  const dateW = ctx.measureText(stats.date).width + 52;
  drawPill(ctx, stats.date, W - 48 - dateW, 48, {
    fill: "rgba(255,255,255,0.92)",
    color: FOREST,
    font: "500 24px ui-sans-serif, system-ui, -apple-system",
    padX: 26,
    height: 56,
  });

  // Weather chip — top-left under the eyebrow
  if (stats.weather?.tempF != null) {
    const wx = `${Math.round(stats.weather.tempF)}°${stats.weather.label ? "  ·  " + stats.weather.label : ""}`;
    drawPill(ctx, wx, 48, 124, {
      fill: "rgba(255,255,255,0.18)",
      color: CREAM,
      font: "500 26px ui-sans-serif, system-ui, -apple-system",
      padX: 24,
      height: 52,
    });
  }

  // Stat block — anchored from the bottom up so footer never collides
  const footerY = H - 60;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Sub-stats row sits ~140 above footer
  ctx.font = "500 38px ui-sans-serif, system-ui, -apple-system";
  ctx.fillStyle = "rgba(245,239,228,0.85)";
  const sub = stats.steps != null
    ? `${stats.minutes} min  ·  ${stats.steps.toLocaleString()} steps`
    : `${stats.minutes} min`;
  ctx.fillText(sub, W / 2, footerY - 110);

  // Big distance sits ~80 above sub
  ctx.font = "500 200px ui-serif, Georgia, 'Times New Roman', serif";
  ctx.fillStyle = CREAM;
  ctx.fillText(`${stats.miles} mi`, W / 2, footerY - 180);

  drawBrandFooter(ctx, true);
  return toBlob(canvas);
}

// ────────────────────────────────────────────────────────────────────
// PUBLIC ENTRY
// ────────────────────────────────────────────────────────────────────
export async function bakeShareCard(
  snapshotUrl: string | null,
  stats: ShareCardStats,
  photoUrl?: string | null,
): Promise<Blob | null> {
  try {
    if (photoUrl) return await bakePhotoCard(photoUrl, stats);
    if (snapshotUrl) return await bakeMapCard(snapshotUrl, stats);
  } catch {
    // fall through
  }
  return null;
}

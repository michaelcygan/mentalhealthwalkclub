/**
 * Bakes a polished share card from a route snapshot PNG.
 * - Loads the snapshot
 * - Draws gradient overlay + brand mark + headline stats + intention/mood
 * - Returns a new PNG Blob ready for Web Share API or download
 *
 * Pure canvas — no map dependency, so safe to call wherever.
 */
export interface ShareCardStats {
  miles: string;        // e.g. "2.31"
  minutes: number;      // total minutes
  steps?: number | null;
  date: string;         // pre-formatted "Tue, May 8"
  intention?: string | null;
  moodBefore?: string | null;
  moodAfter?: string | null;
  walkType?: string | null;
}

const FOREST = "#1f3a2c";
const CREAM = "#f5efe4";
const CLAY = "#c46a4a";

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

export async function bakeShareCard(snapshotUrl: string, stats: ShareCardStats): Promise<Blob | null> {
  const img = await loadImage(snapshotUrl);
  const W = 1080, H = 1350; // 4:5 — Instagram-friendly
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);

  // Map snapshot — square, top
  const mapH = W; // 1080 sq map
  ctx.drawImage(img, 0, 0, W, mapH);

  // Soft fade from map into card body
  const fade = ctx.createLinearGradient(0, mapH - 80, 0, mapH + 60);
  fade.addColorStop(0, "rgba(245,239,228,0)");
  fade.addColorStop(1, CREAM);
  ctx.fillStyle = fade;
  ctx.fillRect(0, mapH - 80, W, 140);

  // Eyebrow row at top of map
  ctx.fillStyle = "rgba(31,58,44,0.9)";
  roundRect(ctx, 40, 40, 320, 60, 30);
  ctx.fill();
  ctx.fillStyle = CREAM;
  ctx.font = "600 24px ui-sans-serif, system-ui";
  ctx.textBaseline = "middle";
  ctx.fillText("MENTAL HEALTH WALK CLUB", 64, 70);

  // Date pill, top-right
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  const datePillW = ctx.measureText(stats.date).width + 56;
  roundRect(ctx, W - 40 - datePillW, 40, datePillW, 60, 30);
  ctx.fill();
  ctx.fillStyle = FOREST;
  ctx.font = "500 24px ui-sans-serif, system-ui";
  ctx.fillText(stats.date, W - 40 - datePillW + 28, 70);

  // Headline stats — big serif numbers
  const baseY = mapH + 80;
  ctx.fillStyle = FOREST;
  ctx.textBaseline = "alphabetic";
  ctx.font = "500 140px ui-serif, Georgia, serif";
  const headline = `${stats.miles} mi`;
  const headW = ctx.measureText(headline).width;
  ctx.fillText(headline, (W - headW) / 2, baseY + 20);

  // Sub-stats row
  ctx.font = "500 36px ui-sans-serif, system-ui";
  ctx.fillStyle = "rgba(31,58,44,0.7)";
  const sub = stats.steps != null
    ? `${stats.minutes} min  ·  ${stats.steps.toLocaleString()} steps`
    : `${stats.minutes} min`;
  const subW = ctx.measureText(sub).width;
  ctx.fillText(sub, (W - subW) / 2, baseY + 76);

  // Mood arc
  if (stats.moodBefore || stats.moodAfter) {
    const y = baseY + 150;
    ctx.font = "500 30px ui-sans-serif, system-ui";
    const mb = (stats.moodBefore ?? "—").toLowerCase();
    const ma = (stats.moodAfter ?? "—").toLowerCase();
    const arrow = "  →  ";
    const full = `${mb}${arrow}${ma}`;
    const fullW = ctx.measureText(full).width;
    const x0 = (W - fullW) / 2;
    // before pill
    const mbW = ctx.measureText(mb).width + 36;
    ctx.fillStyle = "rgba(31,58,44,0.08)";
    roundRect(ctx, x0 - 18, y - 30, mbW, 50, 25); ctx.fill();
    ctx.fillStyle = FOREST;
    ctx.fillText(mb, x0, y + 5);
    // arrow
    ctx.fillStyle = "rgba(31,58,44,0.45)";
    ctx.fillText(arrow, x0 + ctx.measureText(mb).width, y + 5);
    // after pill
    const maX = x0 + ctx.measureText(`${mb}${arrow}`).width;
    const maW = ctx.measureText(ma).width + 36;
    ctx.fillStyle = CLAY + "26";
    roundRect(ctx, maX - 18, y - 30, maW, 50, 25); ctx.fill();
    ctx.fillStyle = CLAY;
    ctx.fillText(ma, maX, y + 5);
  }

  // Intention quote
  if (stats.intention) {
    ctx.fillStyle = "rgba(31,58,44,0.78)";
    ctx.font = "italic 500 36px ui-serif, Georgia, serif";
    const text = `"${stats.intention}"`;
    wrapText(ctx, text, W / 2, baseY + 230, W - 160, 46, "center");
  }

  // Footer brand
  ctx.fillStyle = "rgba(31,58,44,0.55)";
  ctx.font = "500 22px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.fillText("walk it through  ·  mhwalk.club", W / 2, H - 44);
  ctx.textAlign = "start";

  return new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/png", 0.92));
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, align: "left" | "center" = "left") {
  const words = text.split(/\s+/);
  let line = "";
  const lines: string[] = [];
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  const prev = ctx.textAlign;
  if (align === "center") ctx.textAlign = "center";
  lines.slice(0, 3).forEach((ln, i) => ctx.fillText(ln, x, y + i * lineHeight));
  ctx.textAlign = prev;
}

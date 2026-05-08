import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Share2, Copy, Check, Download } from "lucide-react";
import { share, haptics } from "@/lib/device";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hostName: string;
  hostAvatarUrl?: string | null;
  shareCode: string;
  /** ISO start time — when present, card renders as scheduled invite. */
  startsAt?: string | null;
}

/** Renders a 1080×1920 IG-Story-ready share card to canvas + native share sheet. */
export function FriendWalkShareCard({ open, onOpenChange, hostName, hostAvatarUrl, shareCode, startsAt }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const url = typeof window !== "undefined" ? `${window.location.origin}/w/${shareCode}` : `/w/${shareCode}`;
  const whenLabel = startsAt
    ? new Date(startsAt).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  useEffect(() => {
    if (!open) return;
    void renderCard(canvasRef.current, { hostName, hostAvatarUrl, url, code: shareCode, whenLabel })
      .then((dataUrl) => setPreviewUrl(dataUrl));
  }, [open, hostName, hostAvatarUrl, url, shareCode, whenLabel]);


  const onShare = async () => {
    haptics.tap();
    const ok = await share({
      title: `${hostName} is on a walk`,
      text: `i'm out walking — come walk with me 🌿`,
      url,
    });
    if (ok) toast("link shared");
  };

  const onCopy = async () => {
    haptics.tap();
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); toast("link copied"); } catch { /* noop */ }
  };

  const onDownload = () => {
    if (!previewUrl) return;
    haptics.soft();
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `walk-with-${hostName.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="md:max-w-md md:mx-auto">
        <DrawerHeader className="text-center">
          <DrawerTitle className="font-serif text-xl">Invite your people</DrawerTitle>
          <DrawerDescription>Drop this link anywhere — anyone with it can join.</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-2">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="mx-auto h-72 w-auto rounded-2xl shadow-elevated" />
          ) : (
            <div className="mx-auto flex h-72 w-40 items-center justify-center rounded-2xl bg-muted text-xs text-muted-foreground">rendering…</div>
          )}
          <canvas ref={canvasRef} width={1080} height={1920} className="hidden" />
        </div>

        <div className="px-4 pb-2 pt-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
            <span className="flex-1 truncate font-mono text-xs text-muted-foreground">{url.replace(/^https?:\/\//, "")}</span>
            <button onClick={onCopy} className="rounded-lg p-1.5 hover:bg-muted" aria-label="Copy link">
              {copied ? <Check className="h-4 w-4 text-forest" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-4 pb-6 pt-2">
          <Button variant="outline" onClick={onDownload} className="h-12 rounded-2xl">
            <Download className="mr-2 h-4 w-4" /> Save image
          </Button>
          <Button onClick={onShare} className="h-12 rounded-2xl bg-forest text-primary-foreground hover:opacity-90">
            <Share2 className="mr-2 h-4 w-4" /> Share
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

async function renderCard(
  canvas: HTMLCanvasElement | null,
  opts: { hostName: string; hostAvatarUrl?: string | null; url: string; code: string }
): Promise<string> {
  if (!canvas) return "";
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const W = canvas.width, H = canvas.height;

  // Soft forest gradient
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#1f3a2e");
  g.addColorStop(0.55, "#2c5340");
  g.addColorStop(1, "#0f1f18");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Subtle grain dots
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  for (let i = 0; i < 220; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Glow blob
  const blob = ctx.createRadialGradient(W / 2, H * 0.32, 40, W / 2, H * 0.32, 700);
  blob.addColorStop(0, "rgba(214,196,160,0.55)");
  blob.addColorStop(1, "rgba(214,196,160,0)");
  ctx.fillStyle = blob;
  ctx.fillRect(0, 0, W, H);

  // Avatar circle
  const cx = W / 2, cy = H * 0.30, r = 180;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = "#d6c4a0";
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  if (opts.hostAvatarUrl) {
    try {
      const img = await loadImage(opts.hostAvatarUrl);
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    } catch { /* fallback to initial */ }
  }
  if (!opts.hostAvatarUrl) {
    ctx.fillStyle = "#1f3a2e";
    ctx.font = "bold 200px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((opts.hostName[0] || "•").toUpperCase(), cx, cy + 8);
  }
  ctx.restore();
  // Avatar ring
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.stroke();

  // Pulse hint
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "500 38px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("LIVE  ·  walking now", cx, cy + r + 80);

  // Name
  ctx.fillStyle = "#f7f1e3";
  ctx.font = "italic 96px Georgia, 'Times New Roman', serif";
  wrapText(ctx, opts.hostName, cx, H * 0.55, W - 200, 110);

  // Sub
  ctx.fillStyle = "rgba(247,241,227,0.78)";
  ctx.font = "44px -apple-system, system-ui, sans-serif";
  ctx.fillText("come walk with me", cx, H * 0.65);

  // URL pill
  const pillW = 760, pillH = 130, px = (W - pillW) / 2, py = H * 0.78;
  roundRect(ctx, px, py, pillW, pillH, 65);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fill();
  ctx.fillStyle = "#1f3a2e";
  ctx.font = "600 50px -apple-system, system-ui, sans-serif";
  ctx.fillText(opts.url.replace(/^https?:\/\//, ""), W / 2, py + pillH / 2 + 18);

  // Footer
  ctx.fillStyle = "rgba(247,241,227,0.55)";
  ctx.font = "32px -apple-system, system-ui, sans-serif";
  ctx.fillText("tap the link to walk + talk", W / 2, H - 90);

  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
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

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
}

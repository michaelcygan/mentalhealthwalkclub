import { useState } from "react";
import { MessageSquare, Link2, Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { haptics } from "@/lib/device";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InviteCardProps = {
  kind?: "club" | "walk";
  url?: string;
  title?: string;
  description?: string;
  shareText?: string;
  className?: string;
};

export function InviteCard({
  kind = "club",
  url,
  title,
  description,
  shareText,
  className,
}: InviteCardProps) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const inviteUrl = url ?? (typeof window !== "undefined"
    ? `${window.location.origin}/welcome${user?.user_metadata?.username ? `?ref=${user.user_metadata.username}` : ""}`
    : "/welcome");
  const heading = title ?? (kind === "walk" ? "Bring someone along" : "Invite someone");
  const body = description ?? (kind === "walk"
    ? "Send the plan directly. They can view the details and RSVP from the link."
    : "Send a text or link. They can join even if nobody nearby is using the app yet.");
  const message = shareText ?? (kind === "walk"
    ? `Want to walk with me? ${inviteUrl}`
    : `Want to join me on Mental Health Walk Club? ${inviteUrl}`);

  const handleSms = () => {
    haptics.tap();
    window.open(`sms:&body=${encodeURIComponent(message)}`, "_blank");
  };

  const handleCopy = async () => {
    haptics.tap();
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Link copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link.");
    }
  };

  const handleShare = async () => {
    haptics.tap();
    try {
      if (navigator.share) {
        await navigator.share({
          title: kind === "walk" ? heading : "Mental Health Walk Club",
          text: message.replace(inviteUrl, "").trim(),
          url: inviteUrl,
        });
      } else {
        await handleCopy();
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <section className={cn("rounded-3xl border border-border bg-gradient-to-br from-forest/5 to-cream/30 p-5", className)}>
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-forest">
        {kind === "walk" ? "Share this walk" : "Start with someone you know"}
      </p>
      <h3 className="mt-1 font-serif text-xl">{heading}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button
          onClick={handleSms}
          className="h-11 rounded-2xl bg-forest px-2 text-xs text-primary-foreground hover:opacity-90"
        >
          <MessageSquare className="h-4 w-4" />
          Text
        </Button>
        <Button
          variant="outline"
          onClick={handleShare}
          className="h-11 rounded-2xl bg-card px-2 text-xs"
        >
          <Share2 className="h-4 w-4" />
          Share
        </Button>
        <Button
          variant="outline"
          onClick={handleCopy}
          className="h-11 rounded-2xl bg-card px-2 text-xs"
        >
          {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </section>
  );
}

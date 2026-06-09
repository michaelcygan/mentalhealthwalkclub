import { useState } from "react";
import { MessageSquare, Link2, Share2, Copy } from "lucide-react";
import { toast } from "sonner";
import { haptics } from "@/lib/device";
import { useAuth } from "@/lib/auth-context";

export function InviteCard() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const inviteUrl = typeof window !== "undefined"
    ? `${window.location.origin}/welcome${user?.user_metadata?.username ? `?ref=${user.user_metadata.username}` : ""}`
    : "/welcome";

  const handleSms = () => {
    haptics.tap();
    const body = encodeURIComponent("Walking with someone can make it easier to show up. Want to join me? " + inviteUrl);
    window.open(`sms:&body=${body}`, "_blank");
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
          title: "Mental Health Walk Club",
          text: "Walking with someone can make it easier to show up.",
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
    <div className="rounded-3xl border border-border bg-gradient-to-br from-forest/5 to-cream/30 p-5">
      <h3 className="font-serif text-lg">Walk together</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Walking with someone can make it easier to show up. Invite someone you trust.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={handleSms}
          className="inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <MessageSquare className="h-4 w-4" />
          Send invite
        </button>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm hover:bg-accent/40"
        >
          {copied ? <Copy className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm hover:bg-accent/40"
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
      </div>
    </div>
  );
}

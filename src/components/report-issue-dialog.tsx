import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { submitErrorReport } from "@/lib/error-reports.functions";
import { getConsoleTail } from "@/lib/console-capture";

interface Props {
  trigger?: React.ReactNode;
  className?: string;
}

export function ReportIssueDialog({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [diag, setDiag] = useState(true);
  const [busy, setBusy] = useState(false);
  const submit = useServerFn(submitErrorReport);

  async function onSend() {
    const m = message.trim();
    if (m.length < 3) { toast.error("Please add a brief description."); return; }
    setBusy(true);
    try {
      await submit({
        data: {
          message: m.slice(0, 2000),
          include_diagnostics: diag,
          url: typeof window !== "undefined" ? window.location.href : undefined,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : undefined,
          app_version: import.meta.env.MODE,
          console_tail: getConsoleTail(),
        },
      });
      toast.success("Thanks — we got it.");
      setMessage("");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <LifeBuoy className="h-3.5 w-3.5" /> Report a problem
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Report a problem</DialogTitle>
          <DialogDescription>
            Tell us what went wrong — a screen, an action, anything. We read every one.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What happened? What did you expect?"
            rows={5}
            maxLength={2000}
            className="resize-none"
          />
          <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background p-3">
            <div className="min-w-0">
              <Label htmlFor="diag" className="text-sm font-medium">Include diagnostics</Label>
              <p className="text-[11px] text-muted-foreground">Current URL, your browser, app version, and recent in-app errors. No personal data.</p>
            </div>
            <Switch id="diag" checked={diag} onCheckedChange={setDiag} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={onSend} disabled={busy} className="rounded-full bg-forest text-primary-foreground hover:opacity-90">
              {busy ? "Sending…" : "Send report"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

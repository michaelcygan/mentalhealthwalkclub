import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportFromPod } from "@/server/facilitator.functions";
import { toast } from "sonner";

interface Walker {
  userId: string;
  name: string;
}

interface Props {
  sessionId: string;
  visitId: string;
  roomId: string;
  walkers: Walker[];
  onClose: () => void;
  onReported: () => void;
}

const REASONS = [
  "Harmful or hateful language",
  "Harassment / unwanted contact",
  "Sharing distressing content unsafely",
  "Disrupting the walk",
  "Crisis — someone needs help",
  "Other",
];

export function ReportDialog({ sessionId, visitId, roomId, walkers, onClose, onReported }: Props) {
  const reportFn = useServerFn(reportFromPod);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (selected.size === 0) return toast.error("Select at least one walker");
    setSubmitting(true);
    try {
      await reportFn({
        data: {
          sessionId,
          visitId,
          roomId,
          reportedUserIds: Array.from(selected),
          reason,
          details: details.trim() || null,
        },
      });
      toast.success("Walk closed and reported. Thank you.");
      onReported();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-elevated">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-clay">
            <AlertTriangle className="h-4 w-4" />
            <h2 className="font-serif text-lg">Close & report</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          This ends the walk for everyone. Use when conversation isn't safe.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Who's involved
            </div>
            <div className="flex flex-wrap gap-1.5">
              {walkers.map((w) => (
                <button
                  key={w.userId}
                  onClick={() => toggle(w.userId)}
                  className={`rounded-full px-3 py-1.5 text-xs transition ${
                    selected.has(w.userId)
                      ? "bg-clay text-primary-foreground"
                      : "border border-border text-foreground hover:border-clay/40"
                  }`}
                >
                  {w.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Reason
            </div>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
            >
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Notes (optional)
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
              placeholder="What happened, in your words…"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-full">
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={submitting}
            className="flex-1 rounded-full bg-clay text-primary-foreground hover:opacity-90"
          >
            {submitting ? "Closing…" : "Close walk & report"}
          </Button>
        </div>
      </div>
    </div>
  );
}

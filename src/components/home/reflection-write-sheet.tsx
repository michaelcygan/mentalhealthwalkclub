import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createJournalEntry } from "@/lib/journal-entries.functions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt?: { id?: string; text?: string } | null;
  source?: "home_reflection" | "journal_freeform";
  onSaved?: () => void;
}

export function ReflectionWriteSheet({ open, onOpenChange, prompt, source = "home_reflection", onSaved }: Props) {
  const create = useServerFn(createJournalEntry);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setBody("");
      // Focus after the sheet animation
      const t = window.setTimeout(() => ref.current?.focus(), 120);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  async function save() {
    const value = body.trim();
    if (!value || saving) return;
    setSaving(true);
    try {
      await create({
        data: {
          body: value,
          prompt_id: prompt?.id ?? null,
          prompt_text: prompt?.text ?? null,
          source,
        },
      });
      toast.success("Saved to your journal");
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void save();
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[90vh] rounded-t-3xl border-border bg-card p-0 sm:h-[80vh] sm:max-w-xl sm:rounded-3xl"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="px-5 pt-5 text-left">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{today}</div>
            <SheetTitle className="mt-1 font-serif text-xl italic leading-snug text-foreground">
              {prompt?.text ?? "Write a reflection"}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-hidden px-5 py-4">
            <Textarea
              ref={ref}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Start where you are…"
              className="h-full w-full resize-none border-0 bg-transparent p-0 font-serif text-base leading-relaxed focus-visible:ring-0"
              maxLength={20000}
            />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
            <span className="text-[11px] tabular-nums text-muted-foreground">{body.length.toLocaleString()} chars</span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={save}
                disabled={!body.trim() || saving}
                className="rounded-full bg-forest text-primary-foreground hover:opacity-90"
              >
                {saving ? "Saving…" : "Save to journal"}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

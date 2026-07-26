import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Shuffle, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createJournalEntry } from "@/lib/journal-entries.functions";
import { PROMPTS, type ReflectionPrompt } from "@/lib/reflection-prompts";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt?: { id?: string; text?: string } | null;
  source?: "home_reflection" | "journal_freeform";
  onSaved?: () => void;
  /** Allow user to skip/shuffle prompt inside the sheet. */
  allowPromptControls?: boolean;
}

function draftKey(promptId: string | undefined | null) {
  const day = new Date().toISOString().slice(0, 10);
  return `mhwc.journal.draft.${day}.${promptId ?? "freeform"}`;
}

export function ReflectionWriteSheet({
  open,
  onOpenChange,
  prompt,
  source = "home_reflection",
  onSaved,
  allowPromptControls = true,
}: Props) {
  const create = useServerFn(createJournalEntry);
  const { isPlus, loading: membershipLoading } = useMembership();
  const { openPlusCheckout } = useAuthPrompt();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [activePrompt, setActivePrompt] = useState<{ id?: string; text?: string } | null>(prompt ?? null);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Pool of universal prompts (skip the current one when shuffling)
  const pool = useMemo(() => PROMPTS.filter((p): p is ReflectionPrompt => p.family === "universal"), []);

  // Hydrate draft when the sheet opens
  useEffect(() => {
    if (!open) return;
    setActivePrompt(prompt ?? null);
    const k = draftKey(prompt?.id);
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(k) : null;
    setBody(stored ?? "");
    const t = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 120);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-save draft (keyed by date + prompt)
  useEffect(() => {
    if (!open) return;
    const k = draftKey(activePrompt?.id);
    if (body.trim().length === 0) {
      window.localStorage.removeItem(k);
      return;
    }
    const id = window.setTimeout(() => window.localStorage.setItem(k, body), 250);
    return () => window.clearTimeout(id);
  }, [body, open, activePrompt?.id]);

  // Auto-grow textarea
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.6)}px`;
  }, [body, open]);

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  async function save() {
    const value = body.trim();
    if (!value || saving) return;
    if (!isPlus) {
      onOpenChange(false);
      openPlusCheckout();
      return;
    }
    setSaving(true);
    try {
      await create({
        data: {
          body: value,
          prompt_id: activePrompt?.id ?? null,
          prompt_text: activePrompt?.text ?? null,
          source,
        },
      });
      // Clear all drafts for today on save (we wrote something)
      try {
        window.localStorage.removeItem(draftKey(activePrompt?.id));
      } catch { /* ignore */ }
      toast.success("Saved to your journal");
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't save";
      if (msg.includes("plus_required")) {
        onOpenChange(false);
        openPlusCheckout();
        return;
      }
      toast.error(msg);
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

  function shufflePrompt() {
    if (pool.length === 0) return;
    let next: ReflectionPrompt;
    do {
      next = pool[Math.floor(Math.random() * pool.length)];
    } while (next.id === activePrompt?.id && pool.length > 1);
    setActivePrompt({ id: next.id, text: next.text });
  }

  function skipPrompt() {
    setActivePrompt(null);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92vh] rounded-t-3xl border-border bg-card p-0 sm:h-[85vh] sm:max-w-xl sm:rounded-3xl"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="px-5 pt-5 text-left">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{today}</div>
              {allowPromptControls && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={shufflePrompt}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] text-foreground/80 hover:bg-muted/70"
                  >
                    <Shuffle className="h-3 w-3" />
                    {activePrompt ? "Change" : "Pick prompt"}
                  </button>
                  {activePrompt && (
                    <button
                      type="button"
                      onClick={skipPrompt}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] text-foreground/80 hover:bg-muted/70"
                    >
                      <X className="h-3 w-3" />
                      Skip
                    </button>
                  )}
                </div>
              )}
            </div>
            <SheetTitle className="mt-2 font-serif text-xl italic leading-snug text-foreground">
              {activePrompt?.text ?? "An open page."}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <Textarea
              ref={ref}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Start where you are…"
              className="min-h-[40vh] w-full resize-none border-0 bg-transparent p-0 font-serif text-base leading-[1.7] focus-visible:ring-0"
              maxLength={20000}
            />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {body.length.toLocaleString()} chars
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                type="button"
                onClick={save}
                disabled={!body.trim() || saving || membershipLoading}
                className="rounded-full bg-forest text-primary-foreground hover:opacity-90"
              >
                {!isPlus && !membershipLoading ? (
                  <>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Save with Plus
                  </>
                ) : saving ? "Saving…" : "Save to journal"}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

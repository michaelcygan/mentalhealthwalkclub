import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createContentRequest } from "@/lib/content-suggestions.functions";

export function SuggestContentDialog({
  open, onOpenChange, prefill,
}: { open: boolean; onOpenChange: (b: boolean) => void; prefill?: string }) {
  const [title, setTitle] = useState(prefill ?? "");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [kind, setKind] = useState<"podcast" | "ambient" | "guided" | "blog" | "other">("other");
  const [busy, setBusy] = useState(false);
  const submit = useServerFn(createContentRequest);

  const onSubmit = async () => {
    if (!title.trim()) { toast.error("Add a title"); return; }
    setBusy(true);
    try {
      await submit({ data: { title: title.trim(), url: url.trim() || undefined, notes: notes.trim() || undefined, kind } });
      toast.success("Thanks — sent to the editors");
      setTitle(""); setUrl(""); setNotes(""); setKind("other");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-serif">Suggest content</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="sc-title">Title</Label>
            <Input id="sc-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
          </div>
          <div>
            <Label htmlFor="sc-url">Link (optional)</Label>
            <Input id="sc-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" maxLength={500} />
          </div>
          <div>
            <Label htmlFor="sc-kind">Type</Label>
            <select
              id="sc-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="podcast">Podcast</option>
              <option value="ambient">Ambient mix</option>
              <option value="guided">Guided walk</option>
              <option value="blog">Article / blog</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <Label htmlFor="sc-notes">Notes (optional)</Label>
            <Input id="sc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={busy} className="rounded-full">{busy ? "Sending…" : "Send"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

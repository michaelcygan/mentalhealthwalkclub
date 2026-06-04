import { useEffect, useState } from "react";
import {
  getEventAudience,
  setEventAudience,
  listMyCircles,
  addAllowlistCircle,
  removeAllowlistCircle,
  addBlocklistUser,
  removeBlocklistUser,
} from "@/lib/social.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Eye, X, UserPlus } from "lucide-react";

type Mode = "public" | "friends" | "circles_allowlist" | "friends_except_blocklist";

const MODES: Array<{ id: Mode; label: string; sub: string }> = [
  { id: "public", label: "Public", sub: "Anyone with the link can see it." },
  { id: "friends", label: "Friends only", sub: "Visible to your accepted friends." },
  { id: "circles_allowlist", label: "Specific circles", sub: "Only members of the circles you pick." },
  { id: "friends_except_blocklist", label: "Friends except…", sub: "Friends, minus people you block." },
];

export default function AudiencePicker({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("public");
  const [allowCircles, setAllowCircles] = useState<Array<{ id: string; name: string }>>([]);
  const [blockUsers, setBlockUsers] = useState<Array<{ id: string; display_name: string | null; username: string | null }>>([]);
  const [myCircles, setMyCircles] = useState<Array<{ id: string; name: string }>>([]);
  const [blockInput, setBlockInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const a = await getEventAudience({ data: { eventId } });
        if (cancel) return;
        setMode(a.mode);
        setAllowCircles(a.allowCircles);
        setBlockUsers(a.blockUsers);
        const c = await listMyCircles();
        if (cancel) return;
        setMyCircles([...c.owned, ...c.member].map(({ id, name }) => ({ id, name })));
      } catch (e) {
        // Not host — silently no-op
        if (!cancel) setError(e instanceof Error ? e.message : "x");
      }
    })();
    return () => { cancel = true; };
  }, [eventId]);

  if (error) return null; // not the host

  const pickMode = async (next: Mode) => {
    if (busy) return;
    setBusy(true);
    const prev = mode;
    setMode(next);
    try {
      await setEventAudience({ data: { eventId, mode: next } });
    } catch (e) {
      setMode(prev);
      toast.error(e instanceof Error ? e.message : "Could not update.");
    } finally {
      setBusy(false);
    }
  };

  const toggleCircle = async (cid: string) => {
    const has = allowCircles.some((c) => c.id === cid);
    try {
      if (has) {
        await removeAllowlistCircle({ data: { eventId, circleId: cid } });
        setAllowCircles((s) => s.filter((c) => c.id !== cid));
      } else {
        await addAllowlistCircle({ data: { eventId, circleId: cid } });
        const c = myCircles.find((m) => m.id === cid);
        if (c) setAllowCircles((s) => [...s, c]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update.");
    }
  };

  const addBlock = async () => {
    const u = blockInput.trim();
    if (!u) return;
    try {
      const r = await addBlocklistUser({ data: { eventId, username: u } });
      setBlockUsers((s) => (s.some((x) => x.id === r.id) ? s : [...s, r]));
      setBlockInput("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add.");
    }
  };

  const removeBlock = async (uid: string) => {
    try {
      await removeBlocklistUser({ data: { eventId, userId: uid } });
      setBlockUsers((s) => s.filter((u) => u.id !== uid));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove.");
    }
  };

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card p-4 shadow-soft">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-forest" />
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Who can see this walk</span>
        </div>
        <span className="text-xs font-medium text-foreground">
          {MODES.find((m) => m.id === mode)?.label} <span className="text-muted-foreground">{open ? "▾" : "▸"}</span>
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            {MODES.map((m) => (
              <label
                key={m.id}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 text-sm transition ${
                  mode === m.id ? "border-forest bg-forest/5" : "border-border hover:bg-accent/30"
                }`}
              >
                <input type="radio" name="audience" checked={mode === m.id} onChange={() => pickMode(m.id)} className="mt-1" />
                <div className="min-w-0">
                  <div className="font-medium">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.sub}</div>
                </div>
              </label>
            ))}
          </div>

          {mode === "circles_allowlist" && (
            <div className="rounded-2xl border border-border bg-background/60 p-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Pick circles</div>
              {myCircles.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">No circles yet. Create one from Profile → Circles & friends.</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {myCircles.map((c) => {
                    const active = allowCircles.some((a) => a.id === c.id);
                    return (
                      <li key={c.id}>
                        <button
                          onClick={() => toggleCircle(c.id)}
                          className={`rounded-full border px-3 py-1 text-xs transition ${
                            active ? "border-forest bg-forest text-primary-foreground" : "border-border bg-card hover:bg-accent/40"
                          }`}
                        >
                          {active ? "✓ " : ""}{c.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {mode === "friends_except_blocklist" && (
            <div className="rounded-2xl border border-border bg-background/60 p-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Blocked from this walk</div>
              <div className="mt-2 flex gap-2">
                <Input value={blockInput} onChange={(e) => setBlockInput(e.target.value)} placeholder="@username" onKeyDown={(e) => { if (e.key === "Enter") addBlock(); }} />
                <Button onClick={addBlock} className="rounded-full bg-forest text-primary-foreground"><UserPlus className="h-4 w-4" /></Button>
              </div>
              {blockUsers.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {blockUsers.map((u) => (
                    <li key={u.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-1.5 text-xs">
                      <span>{u.display_name || u.username || "Walker"}{u.username ? <span className="ml-1 text-muted-foreground">@{u.username}</span> : null}</span>
                      <button onClick={() => removeBlock(u.id)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

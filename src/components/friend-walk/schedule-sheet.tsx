import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarClock } from "lucide-react";
import { scheduleFriendWalk } from "@/lib/friend-walk.functions";
import { haptics } from "@/lib/device";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called once a scheduled walk is created — parent opens the share card. */
  onScheduled: (info: { code: string; roomId: string; startsAt: string }) => void;
}

const DURATIONS = [30, 45, 60, 90];

function defaultStart(): string {
  // Next round 30-min slot, +1h ahead, formatted for datetime-local
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 0, 0, 0);
  if (d.getMinutes() === 0) d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function FriendWalkScheduleSheet({ open, onOpenChange, onScheduled }: Props) {
  const schedule = useServerFn(scheduleFriendWalk);
  const [startsLocal, setStartsLocal] = useState(defaultStart);
  const [duration, setDuration] = useState(45);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    haptics.tap();
    setBusy(true);
    try {
      const startsAt = new Date(startsLocal).toISOString();
      const r = await schedule({ data: { startsAt, durationMinutes: duration, title: title || undefined } });
      onScheduled({ code: r.code, roomId: r.roomId, startsAt: r.startsAt });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "couldn't schedule");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="md:max-w-md md:mx-auto">
        <DrawerHeader className="text-center">
          <DrawerTitle className="font-serif text-xl">Schedule a Friend Walk</DrawerTitle>
          <DrawerDescription>Pick a time — share the link now, walk together later.</DrawerDescription>
        </DrawerHeader>

        <div className="space-y-4 px-4 pb-6">
          <div className="space-y-1.5">
            <Label htmlFor="fw-title" className="text-xs">Title <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="fw-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sunday morning amble" maxLength={80} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fw-when" className="text-xs">When</Label>
            <Input
              id="fw-when"
              type="datetime-local"
              value={startsLocal}
              onChange={(e) => setStartsLocal(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Length</Label>
            <div className="grid grid-cols-4 gap-2">
              {DURATIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { haptics.tap(); setDuration(m); }}
                  className={`rounded-xl border px-2 py-2.5 text-sm transition ${duration === m ? "border-forest bg-forest/10 text-forest font-medium" : "border-border text-muted-foreground hover:border-forest/40"}`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>

          <Button onClick={submit} disabled={busy} className="h-12 w-full rounded-2xl bg-forest text-primary-foreground hover:opacity-90">
            <CalendarClock className="mr-2 h-4 w-4" />
            {busy ? "scheduling…" : "Schedule & get link"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">Your friends can RSVP from the link. They'll be able to join when it's time.</p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

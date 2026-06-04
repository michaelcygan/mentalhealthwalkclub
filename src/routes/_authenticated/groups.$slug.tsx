import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Globe, Lock, MapPin, Users, Trash2, LogOut, Plus, Calendar, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getGroupBySlug, joinGroup, leaveGroup, deleteGroup } from "@/lib/groups.functions";
import {
  listStandingWalks,
  createStandingWalk,
  deleteStandingWalk,
  listGroupUpcomingWalks,
  materializeGroupWalks,
} from "@/lib/standing-walks.functions";

export const Route = createFileRoute("/_authenticated/groups/$slug")({
  component: GroupDetailPage,
  head: ({ params }) => ({
    meta: [{ title: `Group · ${params.slug} — Mental Health Walk Club` }],
  }),
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type GroupState = Awaited<ReturnType<typeof getGroupBySlug>>;
type Standing = Awaited<ReturnType<typeof listStandingWalks>>["rows"][number];
type Upcoming = Awaited<ReturnType<typeof listGroupUpcomingWalks>>["rows"][number];

function fmt12(t: string) {
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

function GroupDetailPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<GroupState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [standings, setStandings] = useState<Standing[]>([]);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
  const [addingStanding, setAddingStanding] = useState(false);

  const refresh = async () => {
    try {
      const r = await getGroupBySlug({ data: { slug } });
      setState(r);
      const [s, u] = await Promise.all([
        listStandingWalks({ data: { group_id: r.group.id } }).catch(() => ({ rows: [] })),
        listGroupUpcomingWalks({ data: { group_id: r.group.id } }).catch(() => ({ rows: [] })),
      ]);
      setStandings(s.rows);
      setUpcoming(u.rows);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Not found");
    }
  };
  useEffect(() => { refresh(); }, [slug]);

  if (err) return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-10 text-center">
      <p className="font-serif text-2xl">Group not found</p>
      <p className="mt-1 text-sm text-muted-foreground">{err}</p>
      <Link to="/groups" className="mt-4 inline-block text-sm text-forest underline">Back to groups</Link>
    </div>
  );
  if (!state) return <div className="mx-auto max-w-2xl p-6"><div className="h-32 animate-pulse rounded-3xl bg-card" /></div>;

  const { group, member_count, my_status, is_owner } = state;
  const isMember = my_status === "active";
  const canSeeStandings = isMember || is_owner;

  const onJoin = async () => { setBusy(true); try { await joinGroup({ data: { id: group.id } }); toast.success("Joined."); await refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not join."); } finally { setBusy(false); } };
  const onLeave = async () => { setBusy(true); try { await leaveGroup({ data: { id: group.id } }); toast.success("Left."); await refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not leave."); } finally { setBusy(false); } };
  const onDelete = async () => { if (!confirm("Delete this group?")) return; try { await deleteGroup({ data: { id: group.id } }); toast.success("Deleted."); navigate({ to: "/groups" }); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete."); } };
  const onRematerialize = async () => { try { const r = await materializeGroupWalks({ data: { group_id: group.id } }); toast.success(`${r.inserted} new walk${r.inserted === 1 ? "" : "s"} added.`); await refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed."); } };
  const onDeleteStanding = async (id: string) => { try { await deleteStandingWalk({ data: { id } }); toast.success("Removed."); await refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed."); } };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <Link to="/groups" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Groups
      </Link>

      <header className="mt-3 rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {group.visibility === "public" ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          {group.visibility}{group.scope === "global" && " · global"}
          <span className="ml-auto">{group.age_band_min}</span>
        </div>
        <h1 className="mt-1 font-serif text-3xl">{group.name}</h1>
        {group.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{group.description}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {member_count} member{member_count === 1 ? "" : "s"}</span>
          {group.neighborhood && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {group.neighborhood}</span>}
        </div>
        {!isMember && !is_owner && group.lat != null && (
          <p className="mt-2 text-[11px] text-muted-foreground">Exact meetup pin appears after you join.</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {!is_owner && !isMember && group.visibility === "public" && <Button onClick={onJoin} disabled={busy} className="rounded-full bg-forest text-primary-foreground">Join</Button>}
          {!is_owner && isMember && <Button onClick={onLeave} disabled={busy} variant="outline" className="rounded-full"><LogOut className="mr-1 h-4 w-4" /> Leave</Button>}
          {is_owner && <Button onClick={onDelete} variant="outline" className="rounded-full border-destructive/40 text-destructive"><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>}
        </div>
      </header>

      {/* Standing walks */}
      {canSeeStandings && (
        <section className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg">Standing walks</h2>
            {is_owner && (
              <div className="flex gap-1">
                {standings.length > 0 && (
                  <Button onClick={onRematerialize} variant="ghost" size="sm" className="rounded-full text-xs"><RefreshCw className="mr-1 h-3 w-3" /> Refresh</Button>
                )}
                {standings.length < 2 && (
                  <Button onClick={() => setAddingStanding(true)} size="sm" className="rounded-full bg-forest text-primary-foreground text-xs"><Plus className="mr-1 h-3 w-3" /> Add</Button>
                )}
              </div>
            )}
          </div>

          {standings.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No recurring walks yet. {is_owner ? "Add one to seed the calendar." : ""}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {standings.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-2xl border border-border bg-background/60 p-3 text-sm">
                  <div>
                    <div className="font-medium">{DAYS[s.day_of_week]}s · {fmt12(s.start_local_time.slice(0, 5))}</div>
                    <div className="text-xs text-muted-foreground">{s.meetup_label || "Meetup spot TBD"} · {s.duration_minutes}m · {s.timezone}</div>
                  </div>
                  {is_owner && (
                    <button onClick={() => onDeleteStanding(s.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Upcoming materialized */}
      {canSeeStandings && upcoming.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Upcoming walks</h2>
          <ul className="space-y-2">
            {upcoming.map((e) => {
              const d = new Date(e.starts_at);
              const dayLabel = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
              const timeLabel = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
              return (
                <li key={e.id}>
                  <Link to="/w/$code" params={{ code: e.slug }} className="block rounded-2xl border border-border bg-card p-3 shadow-soft transition hover:bg-accent/30">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Calendar className="h-3.5 w-3.5 text-forest" />
                          {dayLabel} · <Clock className="h-3 w-3" /> {timeLabel}
                        </div>
                        {e.meeting_point && <div className="mt-0.5 text-xs text-muted-foreground">{e.meeting_point}</div>}
                      </div>
                      <span className="text-[11px] text-muted-foreground">{e.attendee_count} going</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {is_owner && (
        <Sheet open={addingStanding} onOpenChange={setAddingStanding}>
          <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-3xl">
            <SheetHeader><SheetTitle className="font-serif">New standing walk</SheetTitle></SheetHeader>
            <NewStandingForm groupId={group.id} onDone={async () => { setAddingStanding(false); await refresh(); }} />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

function NewStandingForm({ groupId, onDone }: { groupId: string; onDone: () => void }) {
  const tzGuess = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } })();
  const [day, setDay] = useState(0);
  const [time, setTime] = useState("09:00");
  const [label, setLabel] = useState("");
  const [duration, setDuration] = useState(60);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await createStandingWalk({
        data: {
          group_id: groupId,
          day_of_week: day,
          start_local_time: time,
          timezone: tzGuess,
          meetup_label: label || null,
          duration_minutes: duration,
        },
      });
      toast.success("Standing walk added. Next 4 dates scheduled.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed.");
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-3 space-y-3">
      <div>
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Day of week</div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {DAYS.map((d, i) => (
            <button key={d} onClick={() => setDay(i)} className={`rounded-full border py-1.5 text-xs transition ${day === i ? "border-forest bg-forest text-primary-foreground" : "border-border bg-card"}`}>{d}</button>
          ))}
        </div>
      </div>
      <label className="block">
        <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Start time ({tzGuess})</div>
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </label>
      <label className="block">
        <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Meetup spot</div>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Prospect Park, West entrance" maxLength={160} />
      </label>
      <label className="block">
        <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Duration (minutes)</div>
        <Input type="number" min={10} max={480} value={duration} onChange={(e) => setDuration(parseInt(e.target.value || "60", 10))} />
      </label>
      <Button onClick={save} disabled={busy} className="w-full rounded-full bg-forest text-primary-foreground">{busy ? "Adding…" : "Add standing walk"}</Button>
      <p className="text-center text-[11px] text-muted-foreground">We'll seed the next 4 occurrences as walk pages.</p>
    </div>
  );
}

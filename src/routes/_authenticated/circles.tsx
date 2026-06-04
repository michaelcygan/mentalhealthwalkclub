import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  listMyCircles,
  createCircle,
  deleteCircle,
  listCircleMembers,
  addCircleMember,
  removeCircleMember,
  listFriends,
  sendFriendRequest,
  respondFriendRequest,
  removeFriendship,
} from "@/lib/social.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Plus, Users, UserPlus, X, ArrowLeft, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/circles")({
  component: CirclesPage,
  head: () => ({
    meta: [
      { title: "Circles & Friends — Mental Health Walk Club" },
      { name: "description", content: "Pick who sees each walk. Build small, real circles." },
    ],
  }),
});

type Circle = { id: string; name: string; slug: string; description: string | null; color: string | null; created_at: string; member_count: number };
type Friend = { id: string; status: string; requested_by: string; i_requested: boolean; other: { id: string; display_name: string | null; username: string | null; avatar_url: string | null } };

function CirclesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"circles" | "friends">("circles");
  const [owned, setOwned] = useState<Circle[]>([]);
  const [member, setMember] = useState<Circle[]>([]);
  const [friends, setFriends] = useState<{ accepted: Friend[]; incoming: Friend[]; outgoing: Friend[] }>({ accepted: [], incoming: [], outgoing: [] });
  const [openCircle, setOpenCircle] = useState<Circle | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [friendUsername, setFriendUsername] = useState("");
  const [loading, setLoading] = useState(true);

  const refreshCircles = async () => {
    const r = await listMyCircles();
    setOwned(r.owned);
    setMember(r.member);
  };
  const refreshFriends = async () => {
    const r = await listFriends();
    setFriends(r);
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([refreshCircles(), refreshFriends()]).finally(() => setLoading(false));
  }, [user]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createCircle({ data: { name: newName.trim(), description: newDesc.trim() || null } });
      toast.success("Circle created.");
      setNewName(""); setNewDesc(""); setCreating(false);
      await refreshCircles();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create circle.");
    }
  };

  const handleDelete = async (c: Circle) => {
    if (!confirm(`Delete "${c.name}"? Members will lose access; walks scoped to it become invisible to them.`)) return;
    try {
      await deleteCircle({ data: { id: c.id } });
      toast.success("Circle deleted.");
      setOpenCircle(null);
      await refreshCircles();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.");
    }
  };

  const handleAddFriend = async () => {
    const u = friendUsername.trim();
    if (!u) return;
    try {
      await sendFriendRequest({ data: { username: u } });
      toast.success("Friend request sent.");
      setFriendUsername("");
      await refreshFriends();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send request.");
    }
  };

  const respondFriend = async (id: string, action: "accept" | "decline") => {
    try {
      await respondFriendRequest({ data: { id, action } });
      toast.success(action === "accept" ? "You're now friends." : "Declined.");
      await refreshFriends();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not respond.");
    }
  };

  const removeFriend = async (id: string) => {
    if (!confirm("Remove this friend?")) return;
    try {
      await removeFriendship({ data: { id } });
      toast.success("Removed.");
      await refreshFriends();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove.");
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 pb-24 pt-6">
      <button
        onClick={() => navigate({ to: "/profile" })}
        className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Profile
      </button>

      <header className="mt-3">
        <h1 className="font-serif text-3xl">Circles & friends</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Small groups for walks you'd rather not post publicly. Friendships make "friends-only" walks possible.
        </p>
      </header>

      <div className="mt-5 inline-flex rounded-full border border-border bg-card p-1 text-sm">
        <button
          onClick={() => setTab("circles")}
          className={`rounded-full px-4 py-1.5 transition ${tab === "circles" ? "bg-forest text-primary-foreground" : "text-muted-foreground"}`}
        >
          Circles
        </button>
        <button
          onClick={() => setTab("friends")}
          className={`rounded-full px-4 py-1.5 transition ${tab === "friends" ? "bg-forest text-primary-foreground" : "text-muted-foreground"}`}
        >
          Friends
        </button>
      </div>

      {loading ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">…</p>
      ) : tab === "circles" ? (
        <section className="mt-6 space-y-4">
          {!creating ? (
            <Button onClick={() => setCreating(true)} className="w-full rounded-full bg-forest text-primary-foreground">
              <Plus className="mr-1 h-4 w-4" /> New circle
            </Button>
          ) : (
            <div className="space-y-3 rounded-3xl border border-border bg-card p-4">
              <div>
                <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Name</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Brooklyn buddies" autoFocus className="mt-1" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Description (optional)</label>
                <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="quiet weekend walkers" className="mt-1" />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreate} className="flex-1 rounded-full bg-forest text-primary-foreground">Create</Button>
                <Button variant="outline" onClick={() => { setCreating(false); setNewName(""); setNewDesc(""); }} className="rounded-full">Cancel</Button>
              </div>
            </div>
          )}

          <CircleList title="Yours" circles={owned} onOpen={setOpenCircle} owned />
          {member.length > 0 && <CircleList title="You belong to" circles={member} onOpen={setOpenCircle} />}
          {owned.length === 0 && member.length === 0 && !creating && (
            <p className="rounded-3xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
              No circles yet. They stay tiny on purpose — start one for your closest walking people.
            </p>
          )}
        </section>
      ) : (
        <section className="mt-6 space-y-5">
          <div className="rounded-3xl border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Add a friend by username</div>
            <div className="mt-2 flex gap-2">
              <Input value={friendUsername} onChange={(e) => setFriendUsername(e.target.value)} placeholder="@walker_abc123" onKeyDown={(e) => { if (e.key === "Enter") handleAddFriend(); }} />
              <Button onClick={handleAddFriend} className="rounded-full bg-forest text-primary-foreground">
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {friends.incoming.length > 0 && (
            <FriendList
              title={`Pending — wants to walk with you (${friends.incoming.length})`}
              items={friends.incoming}
              renderAction={(f) => (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => respondFriend(f.id, "accept")} className="rounded-full bg-forest text-primary-foreground">Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => respondFriend(f.id, "decline")} className="rounded-full">Decline</Button>
                </div>
              )}
            />
          )}

          <FriendList
            title={`Friends (${friends.accepted.length})`}
            items={friends.accepted}
            empty="No friends yet. Once a friend accepts, you can share walks with friends-only."
            renderAction={(f) => (
              <button onClick={() => removeFriend(f.id)} className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            )}
          />

          {friends.outgoing.length > 0 && (
            <FriendList
              title={`You sent (${friends.outgoing.length})`}
              items={friends.outgoing}
              renderAction={(f) => (
                <button onClick={() => removeFriend(f.id)} className="text-xs text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
              )}
            />
          )}
        </section>
      )}

      <CircleSheet
        circle={openCircle}
        onClose={() => setOpenCircle(null)}
        onDelete={handleDelete}
        onChanged={refreshCircles}
        ownedByMe={openCircle ? owned.some((c) => c.id === openCircle.id) : false}
      />
    </main>
  );
}

function CircleList({ title, circles, onOpen, owned }: { title: string; circles: Circle[]; onOpen: (c: Circle) => void; owned?: boolean }) {
  if (circles.length === 0) return null;
  return (
    <div>
      <div className="px-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{title}</div>
      <ul className="mt-2 space-y-2">
        {circles.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => onOpen(c)}
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left transition hover:bg-accent/40"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-forest" />
                  <span className="truncate font-serif text-lg">{c.name}</span>
                </div>
                {c.description ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.description}</p> : null}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{c.member_count} {c.member_count === 1 ? "member" : "members"}{owned ? " · yours" : ""}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FriendList({ title, items, empty, renderAction }: { title: string; items: Friend[]; empty?: string; renderAction: (f: Friend) => React.ReactNode }) {
  return (
    <div>
      <div className="px-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{title}</div>
      {items.length === 0 ? (
        empty ? <p className="mt-2 rounded-2xl border border-dashed border-border bg-card/40 p-4 text-center text-sm text-muted-foreground">{empty}</p> : null
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((f) => (
            <li key={f.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-sm font-serif text-forest">
                  {(f.other.display_name || f.other.username || "?").slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{f.other.display_name || f.other.username || "Walker"}</div>
                  {f.other.username && <div className="truncate text-[11px] text-muted-foreground">@{f.other.username}</div>}
                </div>
              </div>
              {renderAction(f)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CircleSheet({ circle, onClose, onDelete, onChanged, ownedByMe }: {
  circle: Circle | null; onClose: () => void; onDelete: (c: Circle) => void; onChanged: () => void; ownedByMe: boolean;
}) {
  const [members, setMembers] = useState<Array<{ id: string; user_id: string; role: string; profile: { display_name: string | null; username: string | null } | null }>>([]);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!circle) return;
    listCircleMembers({ data: { id: circle.id } }).then((r) => setMembers(r.members as never));
  }, [circle?.id]);

  if (!circle) return null;

  const add = async () => {
    if (!username.trim()) return;
    setBusy(true);
    try {
      await addCircleMember({ data: { circleId: circle.id, username: username.trim() } });
      const r = await listCircleMembers({ data: { id: circle.id } });
      setMembers(r.members as never);
      setUsername("");
      onChanged();
      toast.success("Added.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (userId: string) => {
    try {
      await removeCircleMember({ data: { circleId: circle.id, userId } });
      const r = await listCircleMembers({ data: { id: circle.id } });
      setMembers(r.members as never);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove.");
    }
  };

  return (
    <Sheet open={!!circle} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">{circle.name}</SheetTitle>
        </SheetHeader>
        <div className="space-y-5 pb-8 pt-4">
          {circle.description && <p className="text-sm text-muted-foreground">{circle.description}</p>}

          {ownedByMe && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Add by username</div>
              <div className="mt-2 flex gap-2">
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@walker_abc123" onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
                <Button onClick={add} disabled={busy} className="rounded-full bg-forest text-primary-foreground">
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-sm font-serif text-forest">
                    {(m.profile?.display_name || m.profile?.username || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <div className="text-sm font-medium">{m.profile?.display_name || m.profile?.username || "Walker"}</div>
                    <div className="text-[11px] text-muted-foreground">{m.role}{m.profile?.username ? ` · @${m.profile.username}` : ""}</div>
                  </div>
                </div>
                {ownedByMe && m.role !== "owner" && (
                  <button onClick={() => remove(m.user_id)} className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {ownedByMe && (
            <Button variant="destructive" onClick={() => onDelete(circle)} className="w-full rounded-full">
              <Trash2 className="mr-2 h-4 w-4" /> Delete circle
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// dead-import suppressor
void Link;

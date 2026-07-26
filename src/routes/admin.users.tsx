import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Users as UsersIcon, ShieldCheck, Search, CalendarClock } from "lucide-react";
import {
  adminSearchUsers,
  adminSetUserAdmin,
  adminCorrectUserDob,
  type AdminUserRow,
  type EligibilityStatus,
} from "@/lib/users-admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({ component: AdminUsers });

type Filter = "all" | "pending" | "blocked" | "adult";

const filterLabels: Record<Filter, string> = {
  all: "All",
  pending: "Pending age",
  adult: "Adult active",
  blocked: "Blocked",
};

const eligibilityPill: Record<EligibilityStatus, { label: string; cls: string }> = {
  adult_active:     { label: "Adult",      cls: "bg-forest/10 text-forest" },
  pending_age:      { label: "Pending",    cls: "bg-amber-100 text-amber-800" },
  underage_blocked: { label: "Underage",   cls: "bg-rose-100 text-rose-800" },
  age_review:       { label: "Age review", cls: "bg-amber-100 text-amber-800" },
  safety_suspended: { label: "Suspended",  cls: "bg-rose-100 text-rose-800" },
};

function AdminUsers() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [dobUser, setDobUser] = useState<AdminUserRow | null>(null);
  const search = useServerFn(adminSearchUsers);
  const setAdmin = useServerFn(adminSetUserAdmin);
  const correctDob = useServerFn(adminCorrectUserDob);

  const load = useCallback(() => {
    setRows(null);
    search({ data: { q, filter } }).then(setRows).catch(() => setRows([]));
  }, [search, q, filter]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  async function toggleAdmin(u: AdminUserRow) {
    const next = !u.is_admin;
    if (!confirm(`${next ? "Grant" : "Revoke"} admin for ${u.display_name ?? u.email ?? u.id}?`)) return;
    try { await setAdmin({ data: { user_id: u.id, make_admin: next } }); toast.success("Updated"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't update"); }
  }

  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 font-serif text-lg"><UsersIcon className="h-4 w-4" /> Users</h2>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, username, or city"
          className="w-full rounded-full border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-forest"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(filterLabels) as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs ${filter === f ? "border-forest bg-forest/10 text-forest" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>
      {!rows && <p className="text-sm text-muted-foreground">Loading…</p>}
      {rows && rows.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No users match.</p>}
      <ul className="space-y-2">
        {(rows ?? []).map((u) => {
          const pill = eligibilityPill[u.eligibility_status] ?? eligibilityPill.pending_age;
          return (
            <li key={u.id} className="rounded-2xl border border-border bg-card p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {u.display_name ?? u.username ?? "Walker"}
                    {u.is_admin && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-forest/10 px-1.5 py-0.5 text-[10px] text-forest"><ShieldCheck className="h-3 w-3" /> admin</span>}
                    <span className={`ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] ${pill.cls}`}>{pill.label}</span>
                    {u.age_band && <span className="ml-1 inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{u.age_band}</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{u.email ?? "—"} · @{u.username ?? "—"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {[u.city, u.country].filter(Boolean).join(", ") || "No location"} · hosted {u.walks_hosted} · attended {u.walks_attended}
                    {u.created_at ? ` · joined ${new Date(u.created_at).toLocaleDateString()}` : ""}
                    {u.age_attested_at ? ` · DOB confirmed ${new Date(u.age_attested_at).toLocaleDateString()}` : " · DOB not confirmed"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button onClick={() => toggleAdmin(u)} className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-accent">{u.is_admin ? "Revoke admin" : "Make admin"}</button>
                  <button onClick={() => setDobUser(u)} className="inline-flex items-center justify-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-accent"><CalendarClock className="h-3 w-3" /> Correct DOB</button>
                  <button onClick={() => { navigator.clipboard.writeText(u.id); toast.success("User ID copied"); }} className="rounded-full px-3 py-1 text-[10px] text-muted-foreground hover:text-foreground">Copy ID</button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {dobUser && (
        <DobDialog
          user={dobUser}
          onClose={() => setDobUser(null)}
          onSubmit={async (dob, reason) => {
            try {
              await correctDob({ data: { user_id: dobUser.id, dob, reason } });
              toast.success("Date of birth corrected");
              setDobUser(null);
              load();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Couldn't update DOB");
            }
          }}
        />
      )}
    </div>
  );
}

function DobDialog({
  user, onClose, onSubmit,
}: { user: AdminUserRow; onClose: () => void; onSubmit: (dob: string, reason: string) => Promise<void> }) {
  const [dob, setDob] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-background p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif text-lg">Correct date of birth</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Overrides {user.display_name ?? user.username ?? user.email ?? "this user"}'s confirmed DOB and re-evaluates eligibility. Logged in the safety audit.
        </p>
        <label className="mt-4 block text-xs font-medium text-muted-foreground">Date of birth</label>
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" />
        <label className="mt-3 block text-xs font-medium text-muted-foreground">Reason (audit log)</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" placeholder="e.g. ID document confirmed via support ticket #123" />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border px-3 py-1 text-xs">Cancel</button>
          <button
            disabled={!dob || reason.trim().length < 3 || busy}
            onClick={async () => { setBusy(true); try { await onSubmit(dob, reason.trim()); } finally { setBusy(false); } }}
            className="rounded-full bg-forest px-3 py-1 text-xs text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save correction"}
          </button>
        </div>
      </div>
    </div>
  );
}

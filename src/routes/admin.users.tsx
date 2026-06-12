import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Users as UsersIcon, ShieldCheck, Search } from "lucide-react";
import { adminSearchUsers, adminSetUserAdmin, type AdminUserRow } from "@/lib/users-admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({ component: AdminUsers });

function AdminUsers() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const search = useServerFn(adminSearchUsers);
  const setAdmin = useServerFn(adminSetUserAdmin);

  const load = useCallback(() => {
    setRows(null);
    search({ data: { q } }).then(setRows).catch(() => setRows([]));
  }, [search, q]);
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
      {!rows && <p className="text-sm text-muted-foreground">Loading…</p>}
      {rows && rows.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No users match.</p>}
      <ul className="space-y-2">
        {(rows ?? []).map((u) => (
          <li key={u.id} className="rounded-2xl border border-border bg-card p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {u.display_name ?? u.username ?? "Walker"}
                  {u.is_admin && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-forest/10 px-1.5 py-0.5 text-[10px] text-forest"><ShieldCheck className="h-3 w-3" /> admin</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{u.email ?? "—"} · @{u.username ?? "—"}</p>
                <p className="text-[11px] text-muted-foreground">
                  {[u.city, u.country].filter(Boolean).join(", ") || "No location"} · hosted {u.walks_hosted} · attended {u.walks_attended}
                  {u.created_at ? ` · joined ${new Date(u.created_at).toLocaleDateString()}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button onClick={() => toggleAdmin(u)} className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-accent">{u.is_admin ? "Revoke admin" : "Make admin"}</button>
                <button onClick={() => { navigator.clipboard.writeText(u.id); toast.success("User ID copied"); }} className="rounded-full px-3 py-1 text-[10px] text-muted-foreground hover:text-foreground">Copy ID</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

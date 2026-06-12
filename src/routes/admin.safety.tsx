import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Shield, CheckCircle2, XCircle } from "lucide-react";
import { adminListSafetyReports, adminUpdateSafetyReport } from "@/lib/safety-admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/safety")({ component: AdminSafety });

type Row = Record<string, unknown> & { id: string; status: string; created_at: string; reporter_name: string | null; reported_name: string | null };

function AdminSafety() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [status, setStatus] = useState<"open" | "resolved" | "dismissed" | "all">("open");
  const list = useServerFn(adminListSafetyReports);
  const update = useServerFn(adminUpdateSafetyReport);

  const load = useCallback(() => {
    setRows(null);
    list({ data: { status } }).then((r) => setRows(r as Row[])).catch(() => setRows([]));
  }, [list, status]);
  useEffect(load, [load]);

  async function setRowStatus(id: string, next: "resolved" | "dismissed") {
    try { await update({ data: { id, status: next } }); toast.success(`Marked ${next}`); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't update"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-serif text-lg"><Shield className="h-4 w-4" /> Safety reports</h2>
        <div className="flex gap-1 rounded-full border border-border bg-card p-1">
          {(["open", "resolved", "dismissed", "all"] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-2.5 py-1 text-[11px] capitalize ${status === s ? "bg-forest text-primary-foreground" : "text-muted-foreground"}`}>{s}</button>
          ))}
        </div>
      </div>

      {!rows && <p className="text-sm text-muted-foreground">Loading…</p>}
      {rows && rows.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Nothing here. 🌿</p>}
      <ul className="space-y-2">
        {(rows ?? []).map((r) => {
          const reason = (r.reason as string) ?? (r.category as string) ?? "—";
          const details = (r.details as string) ?? (r.description as string) ?? "";
          return (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                  <p className="mt-0.5">
                    <span className="font-medium">{r.reporter_name ?? "Unknown"}</span> reported{" "}
                    <span className="font-medium">{r.reported_name ?? "—"}</span>
                  </p>
                  <p className="mt-1 text-xs"><span className="rounded-full bg-accent px-2 py-0.5">{reason}</span></p>
                  {details && <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{details}</p>}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase ${r.status === "open" ? "bg-amber-100 text-amber-800" : r.status === "resolved" ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>{r.status}</span>
              </div>
              {r.status === "open" && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setRowStatus(r.id, "resolved")} className="inline-flex items-center gap-1 rounded-full bg-forest px-3 py-1 text-xs text-primary-foreground hover:opacity-90"><CheckCircle2 className="h-3 w-3" /> Resolve</button>
                  <button onClick={() => setRowStatus(r.id, "dismissed")} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-accent"><XCircle className="h-3 w-3" /> Dismiss</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

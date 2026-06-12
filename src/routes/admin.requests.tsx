import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Inbox, Bug, MessageSquarePlus } from "lucide-react";
import { adminListContentRequests, adminUpdateContentRequest } from "@/lib/content-suggestions.functions";
import { adminListErrorReports, adminUpdateErrorReport } from "@/lib/error-reports.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/requests")({ component: AdminRequests });

function AdminRequests() {
  const [tab, setTab] = useState<"content" | "bugs">("content");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-serif text-lg"><Inbox className="h-4 w-4" /> Inbox</h2>
        <div className="flex gap-1 rounded-full border border-border bg-card p-1">
          <button onClick={() => setTab("content")} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] ${tab === "content" ? "bg-forest text-primary-foreground" : "text-muted-foreground"}`}>
            <MessageSquarePlus className="h-3 w-3" /> Content
          </button>
          <button onClick={() => setTab("bugs")} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] ${tab === "bugs" ? "bg-forest text-primary-foreground" : "text-muted-foreground"}`}>
            <Bug className="h-3 w-3" /> Bug reports
          </button>
        </div>
      </div>
      {tab === "content" ? <ContentList /> : <BugsList />}
    </div>
  );
}

type CR = { id: string; title: string; url: string | null; kind: string; notes: string | null; status: string; created_at: string };
function ContentList() {
  const [rows, setRows] = useState<CR[] | null>(null);
  const [status, setStatus] = useState<"open" | "in_review" | "approved" | "declined" | "all">("open");
  const list = useServerFn(adminListContentRequests);
  const update = useServerFn(adminUpdateContentRequest);
  const load = useCallback(() => { setRows(null); list({ data: { status } }).then((r) => setRows(r as CR[])).catch(() => setRows([])); }, [list, status]);
  useEffect(load, [load]);

  async function setStatusOf(id: string, s: "in_review" | "approved" | "declined") {
    try { await update({ data: { id, status: s } }); toast.success("Updated"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't update"); }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(["open", "in_review", "approved", "declined", "all"] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-2.5 py-1 text-[11px] ${status === s ? "bg-forest text-primary-foreground" : "bg-card text-muted-foreground border border-border"}`}>{s.replace("_", " ")}</button>
        ))}
      </div>
      {!rows && <p className="text-sm text-muted-foreground">Loading…</p>}
      {rows && rows.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No requests.</p>}
      <ul className="space-y-2">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="rounded-2xl border border-border bg-card p-4 text-sm">
            <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()} · <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px]">{r.kind}</span></p>
            <p className="mt-1 font-medium">{r.title}</p>
            {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-forest underline">{r.url}</a>}
            {r.notes && <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p>}
            <div className="mt-2 flex gap-2">
              <button onClick={() => setStatusOf(r.id, "in_review")} className="rounded-full border border-border bg-background px-3 py-1 text-xs">In review</button>
              <button onClick={() => setStatusOf(r.id, "approved")} className="rounded-full bg-forest px-3 py-1 text-xs text-primary-foreground">Approve</button>
              <button onClick={() => setStatusOf(r.id, "declined")} className="rounded-full border border-border bg-background px-3 py-1 text-xs">Decline</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

type ER = { id: string; user_id: string | null; message: string; url: string | null; user_agent: string | null; app_version: string | null; console_tail: Array<{ level: string; message: string; at: string }> | null; status: string; created_at: string };
function BugsList() {
  const [rows, setRows] = useState<ER[] | null>(null);
  const [status, setStatus] = useState<"open" | "triaged" | "closed" | "all">("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useServerFn(adminListErrorReports);
  const update = useServerFn(adminUpdateErrorReport);
  const load = useCallback(() => { setRows(null); list({ data: { status } }).then((r) => setRows(r as ER[])).catch(() => setRows([])); }, [list, status]);
  useEffect(load, [load]);

  async function setStatusOf(id: string, s: "triaged" | "closed") {
    try { await update({ data: { id, status: s } }); toast.success("Updated"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't update"); }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(["open", "triaged", "closed", "all"] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-2.5 py-1 text-[11px] capitalize ${status === s ? "bg-forest text-primary-foreground" : "bg-card text-muted-foreground border border-border"}`}>{s}</button>
        ))}
      </div>
      {!rows && <p className="text-sm text-muted-foreground">Loading…</p>}
      {rows && rows.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No bug reports.</p>}
      <ul className="space-y-2">
        {(rows ?? []).map((r) => {
          const expanded = openId === r.id;
          return (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-4 text-sm">
              <button className="w-full text-left" onClick={() => setOpenId(expanded ? null : r.id)}>
                <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()} · {r.user_id ? "user" : "guest"}</p>
                <p className="mt-1 whitespace-pre-wrap">{r.message}</p>
              </button>
              {expanded && (
                <div className="mt-2 space-y-1.5 rounded-xl bg-background p-3 text-xs">
                  {r.url && <p><b>URL:</b> {r.url}</p>}
                  {r.app_version && <p><b>Version:</b> {r.app_version}</p>}
                  {r.user_agent && <p className="break-all"><b>UA:</b> {r.user_agent}</p>}
                  {r.console_tail && r.console_tail.length > 0 && (
                    <details>
                      <summary className="cursor-pointer">Console tail ({r.console_tail.length})</summary>
                      <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-[10px]">{r.console_tail.map((e) => `[${e.level}] ${e.message}`).join("\n")}</pre>
                    </details>
                  )}
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <button onClick={() => setStatusOf(r.id, "triaged")} className="rounded-full border border-border bg-background px-3 py-1 text-xs">Triaged</button>
                <button onClick={() => setStatusOf(r.id, "closed")} className="rounded-full bg-forest px-3 py-1 text-xs text-primary-foreground">Close</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

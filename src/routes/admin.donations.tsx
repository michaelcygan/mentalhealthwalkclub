import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  adminCreateBatch,
  adminDissolveBatch,
  adminListBatches,
  adminListUnbatchedAllocations,
  adminMarkBatchTransferred,
  adminSetBatchPublished,
} from "@/lib/admin-donations.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/admin/donations")({
  component: AdminDonations,
});

function fmtCents(c: number | null | undefined) {
  const v = Number(c ?? 0) / 100;
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Alloc = {
  id: string;
  paid_at: string;
  source: string;
  donation_allocation_cents: number;
  status: string;
  dedication_type: string | null;
  honoree_name: string | null;
  public_donor_name: string | null;
  display_publicly: boolean | null;
};

type Batch = {
  id: string;
  environment: string;
  organization_name: string;
  organization_url: string | null;
  period_start: string;
  period_end: string;
  amount_cents: number;
  status: string;
  published: boolean;
  transferred_at: string | null;
  receipt_storage_path: string | null;
  notes: string | null;
  created_at: string;
};

function AdminDonations() {
  const env = getStripeEnvironment();
  const [allocs, setAllocs] = useState<Alloc[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [orgName, setOrgName] = useState("988 Suicide & Crisis Lifeline");
  const [orgUrl, setOrgUrl] = useState("https://988lifeline.org/");
  const [notes, setNotes] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        adminListUnbatchedAllocations({ data: { environment: env } }),
        adminListBatches({ data: { environment: env } }),
      ]);
      setAllocs(a.rows as Alloc[]);
      setTotal(a.total_cents);
      setBatches(b as Batch[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [env]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedTotal = useMemo(
    () =>
      allocs
        .filter((a) => selected.has(a.id))
        .reduce((s, a) => s + Number(a.donation_allocation_cents ?? 0), 0),
    [allocs, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === allocs.length) setSelected(new Set());
    else setSelected(new Set(allocs.map((a) => a.id)));
  }

  async function createBatch() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await adminCreateBatch({
        data: {
          environment: env,
          allocationIds: Array.from(selected),
          organizationName: orgName,
          organizationUrl: orgUrl || null,
          notes: notes || null,
        },
      });
      toast.success("Batch created");
      setSelected(new Set());
      setNotes("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function markTransferred(b: Batch) {
    const when = window.prompt(
      "Transfer date (ISO, e.g. 2026-01-15T00:00:00Z):",
      new Date().toISOString(),
    );
    if (!when) return;
    const receipt = window.prompt("Receipt URL or storage path (optional):", b.receipt_storage_path ?? "");
    setBusy(true);
    try {
      await adminMarkBatchTransferred({
        data: {
          batchId: b.id,
          transferredAt: new Date(when).toISOString(),
          receiptStoragePath: receipt || null,
          notes: b.notes,
        },
      });
      toast.success("Marked transferred");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(b: Batch) {
    setBusy(true);
    try {
      await adminSetBatchPublished({ data: { batchId: b.id, published: !b.published } });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function dissolve(b: Batch) {
    if (!window.confirm("Dissolve this batch and unlink allocations?")) return;
    setBusy(true);
    try {
      await adminDissolveBatch({ data: { batchId: b.id } });
      toast.success("Batch dissolved");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h2 className="font-serif text-xl">Donation ledger — {env}</h2>
        <p className="text-xs text-muted-foreground">
          Group designated 988 allocations into transfer batches, mark them transferred with a receipt,
          then publish to <span className="font-medium">/transparency</span>.
        </p>
      </header>

      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Awaiting transfer</h3>
            <p className="text-xs text-muted-foreground">
              {allocs.length} allocation{allocs.length === 1 ? "" : "s"} — {fmtCents(total)} designated,{" "}
              {fmtCents(selectedTotal)} selected
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={toggleAll} disabled={loading || allocs.length === 0}>
            {selected.size === allocs.length && allocs.length > 0 ? "Clear" : "Select all"}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        ) : allocs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing awaiting transfer.</p>
        ) : (
          <ul className="divide-y divide-border">
            {allocs.map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-2.5 text-sm">
                <Checkbox
                  checked={selected.has(a.id)}
                  onCheckedChange={() => toggle(a.id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{fmtCents(a.donation_allocation_cents)}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(a.paid_at).toLocaleDateString()} · {a.source}
                    </span>
                  </div>
                  {(a.dedication_type && a.dedication_type !== "none") || a.honoree_name ? (
                    <p className="text-[11px] text-muted-foreground">
                      {a.dedication_type ?? "dedication"}
                      {a.honoree_name ? ` · ${a.honoree_name}` : ""}
                      {a.display_publicly ? " · public" : " · private"}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {selected.size > 0 && (
          <div className="mt-4 space-y-3 rounded-2xl border border-dashed border-border p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Organization name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
              <Input
                placeholder="Organization URL"
                value={orgUrl}
                onChange={(e) => setOrgUrl(e.target.value)}
              />
            </div>
            <Textarea
              placeholder="Internal notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Creating batch of {fmtCents(selectedTotal)}
              </span>
              <Button size="sm" onClick={createBatch} disabled={busy}>
                {busy ? "Working…" : "Create batch"}
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">Batches</h3>
        {batches.length === 0 ? (
          <p className="text-xs text-muted-foreground">No batches yet.</p>
        ) : (
          <ul className="space-y-2">
            {batches.map((b) => (
              <li key={b.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {fmtCents(b.amount_cents)} · {b.organization_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {b.period_start} → {b.period_end} · status {b.status}
                      {b.transferred_at ? ` · transferred ${new Date(b.transferred_at).toLocaleDateString()}` : ""}
                      {b.published ? " · published" : " · draft"}
                    </p>
                    {b.receipt_storage_path && (
                      <a
                        href={b.receipt_storage_path}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-[11px] text-forest hover:underline"
                      >
                        Receipt <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {b.notes && <p className="mt-1 text-xs text-muted-foreground">{b.notes}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    {b.status !== "transferred" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => markTransferred(b)} disabled={busy}>
                          Mark transferred
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => dissolve(b)} disabled={busy}>
                          Dissolve
                        </Button>
                      </>
                    )}
                    {b.status === "transferred" && (
                      <Button size="sm" variant="outline" onClick={() => togglePublish(b)} disabled={busy}>
                        {b.published ? "Unpublish" : "Publish"}
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

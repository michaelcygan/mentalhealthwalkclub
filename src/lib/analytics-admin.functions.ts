import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Not authorized");
}

const RangeEnum = z.enum(["7d", "30d", "90d", "all"]);
type Range = z.infer<typeof RangeEnum>;

function rangeStart(range: Range): Date | null {
  const now = Date.now();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : null;
  return days === null ? null : new Date(now - days * 86400_000);
}

interface DayPoint { day: string; count: number }
interface TopRow { label: string; count: number }

export interface AnalyticsOverview {
  range: Range;
  generatedAt: string;
  growth: {
    totalUsers: number;
    newUsers: number;
    dau: number;
    wau: number;
    mau: number;
    signupsByDay: DayPoint[];
    week1Retention: number; // %
    week4Retention: number; // %
  };
  geography: {
    topCities: TopRow[];
    topRegions: TopRow[];
    topCountries: TopRow[];
    topWalkCities: TopRow[];
  };
  walks: {
    sessionsStarted: number;
    sessionsCompleted: number;
    eventsCreated: number;
    rsvpsGoing: number;
    avgAttendees: number;
    distinctHosts: number;
    topHosts: TopRow[];
  };
  engagement: {
    highFives: number;
    friendshipsAccepted: number;
    journalEntries: number;
    notificationsByKind: TopRow[];
  };
  listen: {
    topTerms: Array<{ q: string; count: number; zero: number }>;
    zeroResultTerms: Array<{ q: string; zero: number }>;
    actions: Record<string, number>;
  };
  monetization: {
    activePlus: number;
    plusMonthly: number;
    plusYearly: number;
    trialing: number;
    legacySupporters: number;
    mrrCentsEstimate: number;
  };
}

function bucketByDay(rows: Array<{ created_at: string | null } | { started_at: string | null }>, key: "created_at" | "started_at"): DayPoint[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const ts = (r as Record<string, string | null>)[key];
    if (!ts) continue;
    const day = ts.slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + 1);
  }
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, count]) => ({ day, count }));
}

function tally<T>(rows: T[], pick: (r: T) => string | null | undefined, limit = 10): TopRow[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const v = pick(r);
    if (!v) continue;
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([label, count]) => ({ label, count }));
}

export const adminAnalyticsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ range: RangeEnum.default("30d") }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<AnalyticsOverview> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const start = rangeStart(data.range);
    const startIso = start ? start.toISOString() : "1970-01-01T00:00:00Z";
    const now = Date.now();
    const since24 = new Date(now - 24 * 3600_000).toISOString();
    const since7 = new Date(now - 7 * 86400_000).toISOString();
    const since30 = new Date(now - 30 * 86400_000).toISOString();

    // --- Growth ---
    const [{ count: totalUsers }, { count: newUsers }, signupRows, dauRow, wauRow, mauRow] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", startIso),
      supabaseAdmin.from("profiles").select("created_at").gte("created_at", startIso).limit(20000),
      supabaseAdmin.from("walk_sessions").select("user_id").gte("started_at", since24).limit(20000),
      supabaseAdmin.from("walk_sessions").select("user_id").gte("started_at", since7).limit(50000),
      supabaseAdmin.from("walk_sessions").select("user_id").gte("started_at", since30).limit(100000),
    ]);

    const dau = new Set((dauRow.data ?? []).map((r) => r.user_id as string)).size;
    const wau = new Set((wauRow.data ?? []).map((r) => r.user_id as string)).size;
    const mau = new Set((mauRow.data ?? []).map((r) => r.user_id as string)).size;
    const signupsByDay = bucketByDay((signupRows.data ?? []) as Array<{ created_at: string }>, "created_at");

    // Retention: cohorts of users created 7–14d ago and 28–35d ago who returned in the following 7d window.
    const cohortWindow = async (daysAgoStart: number, daysAgoEnd: number) => {
      const a = new Date(now - daysAgoEnd * 86400_000).toISOString();
      const b = new Date(now - daysAgoStart * 86400_000).toISOString();
      const { data: cohort } = await supabaseAdmin.from("profiles").select("id,created_at").gte("created_at", a).lt("created_at", b).limit(5000);
      const ids = (cohort ?? []).map((r) => r.id as string);
      if (ids.length === 0) return 0;
      const { data: returns } = await supabaseAdmin
        .from("walk_sessions")
        .select("user_id,started_at")
        .in("user_id", ids)
        .gte("started_at", a)
        .limit(20000);
      const returnedSet = new Set<string>();
      for (const r of returns ?? []) {
        const ts = new Date(r.started_at as string).getTime();
        const created = (cohort ?? []).find((c) => c.id === r.user_id)?.created_at as string | undefined;
        if (!created) continue;
        const createdMs = new Date(created).getTime();
        const diffDays = (ts - createdMs) / 86400_000;
        if (diffDays >= 1) returnedSet.add(r.user_id as string);
      }
      return Math.round((returnedSet.size / ids.length) * 100);
    };
    const [week1Retention, week4Retention] = await Promise.all([cohortWindow(7, 14), cohortWindow(28, 35)]);

    // --- Geography ---
    const [{ data: profileLocs }, { data: eventLocs }] = await Promise.all([
      supabaseAdmin.from("profiles").select("city,region,country").limit(20000),
      supabaseAdmin.from("events").select("city").gte("created_at", startIso).limit(20000),
    ]);
    const topCities = tally(profileLocs ?? [], (r) => (r.city as string | null) ?? null);
    const topRegions = tally(profileLocs ?? [], (r) => (r.region as string | null) ?? null);
    const topCountries = tally(profileLocs ?? [], (r) => (r.country as string | null) ?? null);
    const topWalkCities = tally(eventLocs ?? [], (r) => (r.city as string | null) ?? null);

    // --- Walks ---
    const [
      { count: sessionsStarted },
      { count: sessionsCompleted },
      { count: eventsCreated },
      rsvpRows,
      eventsRows,
      hostRows,
    ] = await Promise.all([
      supabaseAdmin.from("walk_sessions").select("id", { count: "exact", head: true }).gte("started_at", startIso),
      supabaseAdmin.from("walk_sessions").select("id", { count: "exact", head: true }).gte("started_at", startIso).eq("status", "completed"),
      supabaseAdmin.from("events").select("id", { count: "exact", head: true }).gte("created_at", startIso),
      supabaseAdmin.from("event_rsvps").select("id", { count: "exact", head: true }).gte("created_at", startIso).eq("status", "going"),
      supabaseAdmin.from("events").select("attendee_count,host_user_id").gte("created_at", startIso).limit(20000),
      supabaseAdmin.from("events").select("host_user_id").gte("created_at", startIso).limit(20000),
    ]);
    const evs = (eventsRows.data ?? []) as Array<{ attendee_count: number | null; host_user_id: string | null }>;
    const avgAttendees = evs.length ? Math.round((evs.reduce((s, e) => s + (e.attendee_count ?? 0), 0) / evs.length) * 10) / 10 : 0;
    const distinctHosts = new Set((hostRows.data ?? []).map((r) => r.host_user_id as string).filter(Boolean)).size;

    const hostTallyRows = tally(evs, (e) => e.host_user_id ?? null, 10);
    const hostIds = hostTallyRows.map((r) => r.label);
    let topHosts: TopRow[] = [];
    if (hostIds.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id,display_name,username").in("id", hostIds);
      const nameMap = new Map((profs ?? []).map((p) => [p.id as string, (p.display_name as string) || (p.username as string) || "Walker"]));
      topHosts = hostTallyRows.map((r) => ({ label: nameMap.get(r.label) ?? "Walker", count: r.count }));
    }

    // --- Engagement ---
    const [{ count: highFives }, { count: friendshipsAccepted }, { count: journalEntries }, { data: notifKinds }] = await Promise.all([
      supabaseAdmin.from("high_fives").select("id", { count: "exact", head: true }).gte("created_at", startIso),
      supabaseAdmin.from("friendships").select("id", { count: "exact", head: true }).gte("created_at", startIso).eq("status", "accepted"),
      supabaseAdmin.from("journal_entries").select("id", { count: "exact", head: true }).gte("created_at", startIso),
      supabaseAdmin.from("notifications").select("kind").gte("created_at", startIso).limit(50000),
    ]);
    const notificationsByKind = tally(notifKinds ?? [], (r) => (r.kind as string) ?? null, 20);

    // --- Listen ---
    const [{ data: terms }, { data: events }] = await Promise.all([
      supabaseAdmin.from("listen_search_log").select("q,result_count,created_at").gte("created_at", startIso).limit(5000),
      supabaseAdmin.from("listen_events").select("action,user_id").gte("created_at", since7).limit(20000),
    ]);
    const tMap = new Map<string, { count: number; zero: number }>();
    for (const r of terms ?? []) {
      const k = (r.q as string).trim().toLowerCase();
      if (!k) continue;
      const e = tMap.get(k) ?? { count: 0, zero: 0 };
      e.count += 1;
      if ((r.result_count ?? 0) === 0) e.zero += 1;
      tMap.set(k, e);
    }
    const topTerms = [...tMap.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 12).map(([q, v]) => ({ q, count: v.count, zero: v.zero }));
    const zeroResultTerms = [...tMap.entries()].filter(([, v]) => v.zero > 0).sort((a, b) => b[1].zero - a[1].zero).slice(0, 12).map(([q, v]) => ({ q, zero: v.zero }));
    const actions: Record<string, number> = {};
    for (const r of events ?? []) {
      const a = r.action as string;
      actions[a] = (actions[a] ?? 0) + 1;
    }

    // --- Monetization ---
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("subscription_kind,status,price_id,monthly_amount_cents,current_period_end")
      .limit(20000);
    let activePlus = 0, plusMonthly = 0, plusYearly = 0, trialing = 0, legacySupporters = 0, mrrCentsEstimate = 0;
    for (const s of (subs ?? []) as Array<{ subscription_kind: string | null; status: string | null; price_id: string | null; monthly_amount_cents: number | null; current_period_end: string | null }>) {
      const stillValid = !s.current_period_end || new Date(s.current_period_end).getTime() > now;
      const active = (s.status === "active" || s.status === "trialing" || s.status === "past_due") && stillValid;
      if (!active) continue;
      if (s.subscription_kind === "plus") {
        activePlus += 1;
        if (s.status === "trialing") trialing += 1;
        if (s.price_id === "plus_yearly") { plusYearly += 1; mrrCentsEstimate += Math.round(8000 / 12) * 1; } // ~$80/yr rough
        else if (s.price_id === "plus_monthly") { plusMonthly += 1; mrrCentsEstimate += 800; }
      } else if (s.subscription_kind === "supporter") {
        legacySupporters += 1;
        mrrCentsEstimate += s.monthly_amount_cents ?? 0;
      }
    }

    return {
      range: data.range,
      generatedAt: new Date().toISOString(),
      growth: {
        totalUsers: totalUsers ?? 0,
        newUsers: newUsers ?? 0,
        dau, wau, mau,
        signupsByDay,
        week1Retention,
        week4Retention,
      },
      geography: { topCities, topRegions, topCountries, topWalkCities },
      walks: {
        sessionsStarted: sessionsStarted ?? 0,
        sessionsCompleted: sessionsCompleted ?? 0,
        eventsCreated: eventsCreated ?? 0,
        rsvpsGoing: rsvpRows.count ?? 0,
        avgAttendees,
        distinctHosts,
        topHosts,
      },
      engagement: {
        highFives: highFives ?? 0,
        friendshipsAccepted: friendshipsAccepted ?? 0,
        journalEntries: journalEntries ?? 0,
        notificationsByKind,
      },
      listen: { topTerms, zeroResultTerms, actions },
      monetization: { activePlus, plusMonthly, plusYearly, trialing, legacySupporters, mrrCentsEstimate },
    };
  });

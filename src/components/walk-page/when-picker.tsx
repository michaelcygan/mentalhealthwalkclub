import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarIcon,
  ChevronDown,
  Clock,
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudSnow,
  CloudFog,
  Wind,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useWalkWeather, type WalkLocation } from "@/hooks/use-walk-weather";
import {
  findPeriodForLocalHour,
  nearbyHourWindow,
  dateWithinPeriods,
  formatHour12,
  type ConditionCode,
  type WalkWeatherPeriod,
} from "@/lib/walk-weather-match";

function tileClass(active: boolean) {
  return cn(
    "inline-flex w-full min-w-0 items-center justify-center gap-1.5 rounded-full border px-2.5 py-2.5 text-sm font-medium transition",
    active
      ? "border-forest bg-forest text-primary-foreground"
      : "border-border bg-card text-foreground hover:bg-accent/40"
  );
}

function DateTile({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className={tileClass(active)}>
      {children}
    </button>
  );
}

function formatChip(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** value/onChange in local ISO format `YYYY-MM-DDTHH:mm` (same as input[type=datetime-local]) */
export function WhenPicker({
  value,
  onChange,
  location,
}: {
  value: string;
  onChange: (v: string) => void;
  location?: WalkLocation;
}) {
  const date = useMemo(() => (value ? new Date(value) : new Date()), [value]);
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const today = startOfDay(new Date());
  const todayDate = useMemo(() => today, [today.getTime()]);
  const tomorrowDate = useMemo(() => addDays(today, 1), [today.getTime()]);

  const [calOpen, setCalOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [timeTouched, setTimeTouched] = useState(false);
  const [pulse, setPulse] = useState(false);
  const isMobile = useIsMobile();

  const weather = useWalkWeather(location ?? null);
  const periods: WalkWeatherPeriod[] =
    weather.data?.status === "ok" ? weather.data.periods : [];
  const committedPeriod = useMemo(
    () => (periods.length ? findPeriodForLocalHour(periods, date, date.getHours()) : null),
    [periods, date]
  );

  // load persisted "time touched" flag
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem("mhwc.walk.time.touched") === "1") {
      setTimeTouched(true);
    }
  }, []);

  function setDatePart(d: Date) {
    const next = new Date(date);
    next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    if (next.getTime() < Date.now()) {
      const n = nextHalfHour(new Date());
      next.setHours(n.getHours(), n.getMinutes(), 0, 0);
    }
    onChange(toLocalIso(next));
    if (!timeTouched) {
      setPulse(true);
      window.setTimeout(() => setPulse(false), 2000);
    }
  }
  function setTimePart(h: number, m: number) {
    const next = new Date(date);
    next.setHours(h, m, 0, 0);
    onChange(toLocalIso(next));
    markTimeTouched();
  }
  function markTimeTouched() {
    if (timeTouched) return;
    setTimeTouched(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("mhwc.walk.time.touched", "1");
    }
  }

  const isToday = sameDay(date, todayDate);
  const isTomorrow = sameDay(date, tomorrowDate);
  const isCustom = !isToday && !isTomorrow;

  const calendar = (
    <Calendar
      mode="single"
      selected={date}
      onSelect={(d) => {
        if (d) {
          setDatePart(d);
          setCalOpen(false);
          if (!sameDay(d, todayDate) && !sameDay(d, tomorrowDate)) {
            window.setTimeout(() => {
              markTimeTouched();
              setTimeOpen(true);
            }, 180);
          }
        }
      }}
      disabled={(d) => d < startOfDay(new Date())}
      initialFocus
      className="pointer-events-auto p-3"
    />
  );

  const summaryLine = summariseCollapsed(committedPeriod, date, tz);

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-[1fr_1fr_1.5fr] gap-2">
        <DateTile active={isToday} onClick={() => setDatePart(todayDate)}>
          Today
        </DateTile>
        <DateTile active={isTomorrow} onClick={() => setDatePart(tomorrowDate)}>
          Tomorrow
        </DateTile>
        {isMobile ? (
          <DateTile active={isCustom} onClick={() => setCalOpen(true)}>
            <CalendarIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{isCustom ? formatChip(date) : "Pick a date"}</span>
          </DateTile>
        ) : (
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={tileClass(isCustom)}
                aria-label="Pick a date"
              >
                <CalendarIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{isCustom ? formatChip(date) : "Pick a date"}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end" sideOffset={6}>
              {calendar}
            </PopoverContent>
          </Popover>
        )}
      </div>

      {isMobile && (
        <Sheet open={calOpen} onOpenChange={setCalOpen}>
          <SheetContent side="bottom" className="rounded-t-3xl pb-8">
            <SheetHeader>
              <SheetTitle className="font-serif text-2xl">Pick a date</SheetTitle>
            </SheetHeader>
            <div className="mt-2 flex justify-center">{calendar}</div>
          </SheetContent>
        </Sheet>
      )}

      <button
        type="button"
        onClick={() => {
          markTimeTouched();
          setTimeOpen(true);
        }}
        className={cn(
          "relative flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 text-left transition hover:bg-accent/30",
          pulse && "wp-pulse-ring"
        )}
      >
        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 text-forest" aria-hidden="true" />
          <div>
            <div className="text-sm font-semibold text-foreground">{formatDate(date)}</div>
            <div className="text-xs text-muted-foreground">{summaryLine}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!timeTouched && (
            <span className="hidden rounded-full bg-forest/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-forest sm:inline">
              Tap to set
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-forest",
              !timeTouched && "wp-chevron-nudge"
            )}
            aria-hidden="true"
          />
        </div>
      </button>

      <TimeWheelSheet
        open={timeOpen}
        onOpenChange={(v) => {
          setTimeOpen(v);
          if (v) markTimeTouched();
        }}
        hour={date.getHours()}
        minute={date.getMinutes()}
        date={date}
        periods={periods}
        weatherStatus={weather.data?.status ?? (weather.isLoading ? "loading" : "idle")}
        weatherLoading={weather.isLoading}
        hasLocation={!!location}
        onCommit={(h, m) => {
          setTimePart(h, m);
          setTimeOpen(false);
        }}
      />
    </div>
  );
}

/* ---------- collapsed summary ---------- */

function summariseCollapsed(period: WalkWeatherPeriod | null, date: Date, tz: string): string {
  const timeStr = formatTime(date);
  if (!period) return `${timeStr} · ${tz}`;
  const pop = period.precipitationChance;
  if (pop != null && pop >= 25) {
    return `${timeStr} · ${period.temperature}° · ${pop}% rain`;
  }
  return `${timeStr} · ${period.temperature}° · ${period.shortForecast}`;
}

/* ---------- time wheel ---------- */

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const MERIDIEM = ["AM", "PM"] as const;

function TimeWheelSheet({
  open,
  onOpenChange,
  hour,
  minute,
  date,
  periods,
  weatherStatus,
  weatherLoading,
  hasLocation,
  onCommit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hour: number;
  minute: number;
  date: Date;
  periods: WalkWeatherPeriod[];
  weatherStatus: "ok" | "unsupported" | "unavailable" | "loading" | "idle";
  weatherLoading: boolean;
  hasLocation: boolean;
  onCommit: (h: number, m: number) => void;
}) {
  const snappedMin = Math.round(minute / 5) * 5 % 60;
  const isPm = hour >= 12;
  const hour12 = ((hour + 11) % 12) + 1;

  const [h, setH] = useState(hour12);
  const [m, setM] = useState(snappedMin);
  const [mer, setMer] = useState<"AM" | "PM">(isPm ? "PM" : "AM");

  useEffect(() => {
    if (open) {
      setH(hour12);
      setM(snappedMin);
      setMer(isPm ? "PM" : "AM");
    }
  }, [open, hour12, snappedMin, isPm]);

  const draftHour24 = ((h % 12) + (mer === "PM" ? 12 : 0));

  function commit() {
    onCommit(draftHour24, m);
  }

  const showWeatherArea = hasLocation && weatherStatus !== "unsupported" && weatherStatus !== "unavailable";
  const window = useMemo(
    () => (periods.length ? nearbyHourWindow(periods, date, draftHour24) : { tiles: [], selectedIndex: -1 }),
    [periods, date, draftHour24]
  );
  const outsideRange = periods.length > 0 && !dateWithinPeriods(periods, date);

  function pickTile(p: WalkWeatherPeriod) {
    // Extract wall-clock hour from the tile's startTime.
    const match = /T(\d{2}):/.exec(p.startTime);
    if (!match) return;
    const h24 = parseInt(match[1], 10);
    const newMer: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
    const newH12 = ((h24 + 11) % 12) + 1;
    setH(newH12);
    setMer(newMer);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-6">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">Set time</SheetTitle>
        </SheetHeader>

        {showWeatherArea && (
          <div className="mt-3 min-h-[76px]">
            {weatherLoading && periods.length === 0 ? (
              <WeatherStripSkeleton />
            ) : outsideRange ? (
              <p className="px-1 text-xs text-muted-foreground">
                Forecast will appear closer to the walk.
              </p>
            ) : window.tiles.length > 0 ? (
              <div
                className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1"
                style={{ scrollbarWidth: "none" }}
              >
                {window.tiles.map((p, i) => (
                  <WeatherTile
                    key={p.startTime}
                    period={p}
                    active={i === window.selectedIndex}
                    onClick={() => pickTile(p)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}

        <div className="relative mt-4 flex items-center justify-center gap-2">
          <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-10 h-10 -translate-y-1/2 rounded-xl border-y border-border bg-accent/20" />
          <Wheel ariaLabel="hour" values={HOURS_12} value={h} onChange={setH} format={(v) => String(v)} />
          <div className="z-20 pb-px text-2xl font-light text-muted-foreground">:</div>
          <Wheel ariaLabel="minute" values={MINUTES} value={m} onChange={setM} format={(v) => v.toString().padStart(2, "0")} />
          <Wheel ariaLabel="meridiem" values={MERIDIEM as unknown as string[]} value={mer} onChange={(v) => setMer(v as "AM" | "PM")} format={(v) => String(v)} />
        </div>
        <SheetFooter className="mt-4">
          <Button onClick={commit} className="w-full rounded-full bg-forest text-primary-foreground hover:opacity-90">
            Set {String(h)}:{m.toString().padStart(2, "0")} {mer}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ---------- weather strip ---------- */

function WeatherStripSkeleton() {
  return (
    <div className="flex gap-2 px-1" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-[68px] w-[64px] shrink-0 animate-pulse rounded-2xl border border-border bg-card/60"
        />
      ))}
    </div>
  );
}

function WeatherTile({
  period,
  active,
  onClick,
}: {
  period: WalkWeatherPeriod;
  active: boolean;
  onClick: () => void;
}) {
  const w = /T(\d{2}):/.exec(period.startTime);
  const h24 = w ? parseInt(w[1], 10) : 0;
  const hourLabel = formatHour12(h24);
  const pop = period.precipitationChance;
  const showPop = pop != null && pop >= 25;

  const label = buildTileLabel(period, hourLabel);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "flex h-[68px] w-[64px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border text-center transition",
        active
          ? "border-forest bg-forest/10 text-foreground"
          : "border-border bg-card text-foreground hover:bg-accent/40"
      )}
    >
      <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {hourLabel}
      </span>
      <WeatherIcon code={period.conditionCode} isDaytime={period.isDaytime} />
      <span className="text-xs font-semibold tabular-nums">
        {period.temperature}°
      </span>
      {showPop ? (
        <span className="text-[10px] tabular-nums text-muted-foreground">{pop}%</span>
      ) : null}
    </button>
  );
}

function buildTileLabel(p: WalkWeatherPeriod, hourLabel: string): string {
  const unit = p.temperatureUnit === "F" ? "Fahrenheit" : "Celsius";
  const parts = [`Select ${hourLabel}`, `${p.temperature} degrees ${unit}`];
  if (p.shortForecast) parts.push(p.shortForecast.toLowerCase());
  if (p.precipitationChance != null && p.precipitationChance >= 25) {
    parts.push(`${p.precipitationChance} percent chance of precipitation`);
  }
  return parts.join(", ") + ".";
}

function WeatherIcon({ code, isDaytime }: { code: ConditionCode; isDaytime: boolean }) {
  const cls = "h-4 w-4 text-foreground/80";
  const props = { className: cls, "aria-hidden": true } as const;
  switch (code) {
    case "clear":
      return isDaytime ? <Sun {...props} /> : <Moon {...props} />;
    case "partly-cloudy":
      return isDaytime ? <CloudSun {...props} /> : <CloudMoon {...props} />;
    case "cloudy":
      return <Cloud {...props} />;
    case "rain":
      return <CloudRain {...props} />;
    case "storm":
      return <CloudLightning {...props} />;
    case "snow":
      return <CloudSnow {...props} />;
    case "fog":
      return <CloudFog {...props} />;
    case "wind":
      return <Wind {...props} />;
    default:
      return <Cloud {...props} />;
  }
}

const ITEM_H = 40;

function Wheel<T extends string | number>({
  values,
  value,
  onChange,
  format,
  ariaLabel,
}: {
  values: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format: (v: T) => string;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = values.indexOf(value);
    if (idx < 0) return;
    el.scrollTo({ top: idx * ITEM_H, behavior: "auto" });
  }, [value, values]);

  function onScroll() {
    if (settling.current) clearTimeout(settling.current);
    settling.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const idx = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(values.length - 1, idx));
      const next = values[clamped];
      if (next !== value) onChange(next);
      el.scrollTo({ top: clamped * ITEM_H, behavior: "smooth" });
    }, 90);
  }

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      aria-label={ariaLabel}
      role="listbox"
      className="relative h-[200px] w-16 snap-y snap-mandatory overflow-y-scroll scrollbar-none"
      style={{ scrollbarWidth: "none" }}
    >
      <div style={{ height: ITEM_H * 2 }} />
      {values.map((v) => (
        <div
          key={String(v)}
          className={cn(
            "flex h-10 snap-center items-center justify-center text-lg tabular-nums transition",
            v === value ? "font-semibold text-foreground" : "text-muted-foreground"
          )}
          style={{ height: ITEM_H }}
        >
          {format(v)}
        </div>
      ))}
      <div style={{ height: ITEM_H * 2 }} />
    </div>
  );
}

/* ---------- date utils ---------- */

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function diffDays(a: Date, b: Date) {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function nextHalfHour(d: Date) {
  const x = new Date(d);
  x.setSeconds(0, 0);
  const m = x.getMinutes();
  if (m < 30) x.setMinutes(30);
  else {
    x.setHours(x.getHours() + 1);
    x.setMinutes(0);
  }
  return x;
}
function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function toLocalIso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function formatDate(d: Date) {
  const today = startOfDay(new Date());
  const days = diffDays(d, today);
  if (days === 0) return `Today, ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  if (days === 1) return `Tomorrow, ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

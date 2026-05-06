import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Footprints } from "lucide-react";
import { LocationAutosuggest, type LocationValue } from "@/components/location-autosuggest";

export const Route = createFileRoute("/welcome")({
  component: Welcome,
  head: () => ({ meta: [{ title: "Welcome — Walk Club" }] }),
});

const THEMES = ["anxiety", "burnout", "grief", "loneliness", "new in town", "quiet", "sunday reset", "general wellness"];
const MODES: ReadonlyArray<readonly [string, string]> = [
  ["solo", "Solo"],
  ["guided_solo", "Guided Solo"],
  ["audio", "Group Walk (audio)"],
  ["irl_event", "In-person event"],
];
const COMFORT = [
  ["listener", "Listener", "I'd rather just listen on group walks."],
  ["sometimes_speak", "Sometimes speak", "I'll chime in when it feels right."],
  ["talker", "Talker", "I'm comfortable talking on a walk."],
] as const;

function Welcome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [themes, setThemes] = useState<string[]>([]);
  const [modes, setModes] = useState<string[]>(["solo"]);
  const [comfort, setComfort] = useState<string>("listener");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) navigate({ to: "/auth" });
  }, [user, navigate]);

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const finish = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await supabase.from("profiles").update({
        city: location?.city || null,
        region: location?.region || null,
        country: location?.country || null,
        location_label: location?.location_label || null,
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
      }).eq("id", user.id);
      await supabase.from("user_preferences").update({
        preferred_themes: themes,
        preferred_walk_modes: modes,
        audio_comfort_level: comfort,
      }).eq("user_id", user.id);
      navigate({ to: "/" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen gradient-warm">
      <div className="mx-auto max-w-lg px-6 py-12">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-forest">
            <Footprints className="h-5 w-5 text-primary-foreground" />
          </div>
          <p className="font-serif text-sm italic text-muted-foreground">Step {step + 1} of 4</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-7 shadow-elevated">
          {step === 0 && (
            <>
              <h2 className="font-serif text-3xl">Where are you walking from?</h2>
              <p className="mt-2 text-sm text-muted-foreground">We'll surface IRL walks and chapters near you. Skip if you'd rather not say.</p>
              <div className="mt-5"><LocationAutosuggest value={location} onChange={setLocation} /></div>
            </>
          )}
          {step === 1 && (
            <>
              <h2 className="font-serif text-3xl">What's been on your shoulders?</h2>
              <p className="mt-2 text-sm text-muted-foreground">Pick anything that fits today. They're quiet tags — they just help us match you to walks. Always changeable.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {THEMES.map((t) => (
                  <button key={t} type="button" onClick={() => toggle(themes, t, setThemes)} className={`rounded-full border px-4 py-2 text-sm transition ${themes.includes(t) ? "border-forest bg-forest text-primary-foreground" : "border-border bg-card hover:border-forest/40"}`}>{t}</button>
                ))}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="font-serif text-3xl">How do you like to walk?</h2>
              <p className="mt-2 text-sm text-muted-foreground">All of these are fine. You'll never be pushed.</p>
              <div className="mt-5 grid gap-2">
                {MODES.map(([v, label]) => (
                  <button key={v} type="button" onClick={() => toggle(modes, v, setModes)} className={`rounded-2xl border p-4 text-left transition ${modes.includes(v) ? "border-forest bg-accent" : "border-border bg-card hover:border-forest/40"}`}>
                    <div className="font-medium">{label}</div>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h2 className="font-serif text-3xl">Group walks</h2>
              <p className="mt-2 text-sm text-muted-foreground">If you ever join one (only while you're walking), how comfortable are you on voice?</p>
              <div className="mt-5 grid gap-2">
                {COMFORT.map(([v, label, sub]) => (
                  <button key={v} type="button" onClick={() => setComfort(v)} className={`rounded-2xl border p-4 text-left transition ${comfort === v ? "border-forest bg-accent" : "border-border bg-card hover:border-forest/40"}`}>
                    <div className="font-medium">{label}</div>
                    <div className="text-sm text-muted-foreground">{sub}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="mt-7 flex justify-between gap-3">
            {step > 0 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="rounded-full">Back</Button>
            ) : <span />}
            {step < 3 ? (
              <Button onClick={() => setStep(step + 1)} className="rounded-full bg-forest text-primary-foreground hover:opacity-90">Continue</Button>
            ) : (
              <Button disabled={busy} onClick={finish} className="rounded-full bg-forest text-primary-foreground hover:opacity-90">{busy ? "One moment…" : "Begin walking"}</Button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center font-serif text-xs italic text-muted-foreground">Come as you are. Walk at your pace.</p>
      </div>
    </div>
  );
}

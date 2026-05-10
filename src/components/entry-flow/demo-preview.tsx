import { Link } from "@tanstack/react-router";
import { Footprints, Headphones, MapPin, Sparkles, HeartHandshake, Lock, BookHeart, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuthPrompt } from "@/lib/auth-prompt";
import heroImg from "@/assets/walk-hero.jpg";

/**
 * Read-only preview rendered in demo mode.
 * Tapping any high-intent action triggers the auth sheet via requireAuth().
 * Tabs (Groups / Events / Journal) remain navigable so the visitor can browse.
 */
export function DemoPreview() {
  const { requireAuth, openAuth } = useAuthPrompt();

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl shadow-elevated">
        <img src={heroImg} alt="A quiet path" className="h-56 w-full object-cover md:h-72" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest/85 via-forest/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-primary-foreground md:p-8">
          <p className="font-serif text-xs italic opacity-90">Previewing as Jordan</p>
          <h1 className="mt-1 max-w-xl font-serif text-3xl leading-tight md:text-4xl">Take the walk. Let it count.</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => requireAuth(() => {})} className="rounded-full bg-cream text-foreground hover:bg-cream/90">
              <Footprints className="mr-2 h-4 w-4" /> Start a walk
            </Button>
            <Button onClick={() => openAuth("signup")} variant="outline" className="rounded-full border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
              Create account
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <ValueCard icon={Footprints} title="Walk solo" body="A small walk is still a walk. Track time, distance, and how you arrive home." />
        <ValueCard icon={Headphones} title="Walk & Talks" body="Live, gentle Walk & Talks — only available once you're actually moving." />
        <ValueCard icon={MapPin} title="Local Walks" body="Real people, real sidewalks. Meet your neighborhood at a Sunday Reset." />
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Browse around</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <BrowseTile to="/groups" icon={Users} label="Groups" />
          <BrowseTile to="/events" icon={Calendar} label="Events" />
          <BrowseTile to="/journal" icon={BookHeart} label="Journal" />
        </div>
      </div>

      <Card className="rounded-3xl border-border bg-card p-7 shadow-soft md:p-9">
        <div className="grid gap-6 md:grid-cols-[1.2fr,1fr] md:items-center">
          <div>
            <h2 className="font-serif text-2xl text-balance md:text-3xl">A different kind of social app</h2>
            <p className="mt-3 text-muted-foreground text-pretty">
              No feeds. No chat. No doomscroll. Groups are quiet affinity tags that surface walks that fit you.
              The socializing happens in person, or on your feet with audio.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => openAuth("signup")} className="rounded-full bg-forest text-primary-foreground hover:opacity-90">
                Make it yours
              </Button>
              <Button onClick={() => openAuth("signin")} variant="ghost" className="rounded-full">
                I have an account
              </Button>
            </div>
          </div>
          <ul className="space-y-3 text-sm">
            <Bullet icon={HeartHandshake}>Peer support, not therapy.</Bullet>
            <Bullet icon={Lock}>Walks, moods, and reflections stay private to you.</Bullet>
            <Bullet icon={Sparkles}>Gentle badges for showing up — never streak shame.</Bullet>
          </ul>
        </div>
      </Card>

      <p className="pt-2 text-center font-serif text-sm italic text-muted-foreground">
        You don't have to walk through it alone.
      </p>
    </div>
  );
}

function ValueCard({ icon: Icon, title, body }: { icon: typeof Footprints; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent">
        <Icon className="h-5 w-5 text-forest" />
      </div>
      <h3 className="mt-3 font-serif text-lg">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground text-pretty">{body}</p>
    </div>
  );
}

function Bullet({ icon: Icon, children }: { icon: typeof Footprints; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
      <span className="text-foreground/85">{children}</span>
    </li>
  );
}

function BrowseTile({ to, icon: Icon, label }: { to: string; icon: typeof Footprints; label: string }) {
  return (
    <Link to={to as never} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:-translate-y-px hover:border-forest/40">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-accent">
        <Icon className="h-5 w-5 text-forest" />
      </div>
      <span className="font-medium">{label}</span>
    </Link>
  );
}

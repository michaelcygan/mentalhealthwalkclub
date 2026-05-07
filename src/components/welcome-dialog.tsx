import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Footprints, Headphones, MapPin, Lock, HeartHandshake } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignUp: () => void;
  onSignIn: () => void;
}

export function WelcomeDialog({ open, onOpenChange, onSignUp, onSignIn }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl border-border bg-card p-0 sm:max-w-lg">
        <div className="gradient-warm rounded-t-3xl px-7 py-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-forest shadow-soft">
              <Footprints className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-serif text-2xl leading-tight text-foreground">Mental Health Walk Club</h2>
              <p className="text-xs text-muted-foreground">You don't have to walk through it alone.</p>
            </div>
          </div>
          <p className="mt-5 font-serif text-lg italic leading-relaxed text-foreground/85">
            Take the walk. Let it count.
          </p>
        </div>

        <div className="space-y-5 px-7 pb-7 pt-6">
          <Item
            icon={HeartHandshake}
            title="Peer support, on your feet"
            body="A warm community of people who walk through the hard stuff. Not therapy — just movement, air, and the company of people who get it. If you're in crisis, call or text 988."
          />
          <Item
            icon={Headphones}
            title="Walks that fit your day"
            body="Walk solo. Slip into a guided Walk & Talk. Step into a live Walk & Talk — only after you're actually moving. Or meet real people on a real sidewalk at a Local Walk."
          />
          <Item
            icon={MapPin}
            title="Groups are quiet, not loud"
            body="No feeds. No chat. Groups are gentle affinity tags (Anxiety, Burnout, Sunday Reset, your city) that help us surface walks that fit you. The socializing happens in person or on an Walk & Talk."
          />
          <Item
            icon={Lock}
            title="Your walk is yours"
            body="Routes, moods, and reflections stay private to you. Always."
          />

          <div className="grid gap-2 pt-2">
            <Button onClick={onSignUp} className="h-12 rounded-full bg-forest text-primary-foreground hover:opacity-90">
              Create your account
            </Button>
            <Button variant="ghost" onClick={onSignIn} className="rounded-full">
              I already have one
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Item({ icon: Icon, title, body }: { icon: typeof Footprints; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent">
        <Icon className="h-4 w-4 text-forest" />
      </div>
      <div>
        <h3 className="font-medium text-foreground">{title}</h3>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

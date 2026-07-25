import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { CalendarDays, MapPin, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import {
  followUser,
  getFollowState,
  getPublicProfileByUsername,
  unfollowUser,
} from "@/lib/follows.functions";
import { WalkCard, type WalkCardData } from "@/components/discover/walk-card";

const SITE = "https://mentalhealthwalkclub.com";

export const Route = createFileRoute("/u/$username")({
  loader: async ({ params }) => {
    const data = await getPublicProfileByUsername({ data: { username: params.username } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Profile not found — Mental Health Walk Club" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const p = loaderData.profile;
    const name = p.display_name ?? `@${p.username ?? params.username}`;
    const url = `${SITE}/u/${p.username ?? params.username}`;
    const desc = p.bio
      ? p.bio.slice(0, 155)
      : `${name} is on Mental Health Walk Club. See their walks and follow to join in.`;
    const meta: Array<Record<string, string>> = [
      { title: `${name} (@${p.username ?? params.username}) — Mental Health Walk Club` },
      { name: "description", content: desc },
      { property: "og:title", content: `${name} on Mental Health Walk Club` },
      { property: "og:description", content: desc },
      { property: "og:type", content: "profile" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: `${name} on Mental Health Walk Club` },
      { name: "twitter:description", content: desc },
    ];
    if (p.avatar_url && /^https?:\/\//.test(p.avatar_url)) {
      meta.push({ property: "og:image", content: p.avatar_url });
      meta.push({ name: "twitter:image", content: p.avatar_url });
    }
    return { meta, links: [{ rel: "canonical", href: url }] };
  },
  notFoundComponent: NotFoundView,
  errorComponent: ({ reset }) => (
    <div className="mx-auto max-w-2xl px-4 py-10 text-center text-sm text-muted-foreground">
      Something went wrong loading this profile.
      <div className="mt-4">
        <Button onClick={() => reset()} variant="secondary" size="sm">Try again</Button>
      </div>
    </div>
  ),
  component: PublicProfilePage,
});

function NotFoundView() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="font-serif text-2xl">Profile not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        No walker here by that name. Try a different username.
      </p>
      <Link to="/" className="mt-6 inline-block text-sm text-forest underline">Back home</Link>
    </div>
  );
}

function PublicProfilePage() {
  const data = Route.useLoaderData();
  const { user } = useAuth();
  const { openAuth } = useAuthPrompt();
  const router = useRouter();
  const p = data.profile;
  const isSelf = user?.id === p.id;

  const initials = (p.display_name ?? p.username ?? "??").slice(0, 2).toUpperCase();

  const state = useQuery({
    queryKey: ["follow-state", p.id, user?.id],
    enabled: !!user && !isSelf && !!p.id,
    staleTime: 30_000,
    queryFn: () => getFollowState({ data: { userId: p.id! } }),
  });

  const [optimistic, setOptimistic] = useState<null | boolean>(null);
  const iFollow = optimistic ?? state.data?.iFollow ?? false;
  const mutual = state.data?.mutual ?? false;

  const followMut = useMutation({
    mutationFn: async () => followUser({ data: { userId: p.id! } }),
    onMutate: () => setOptimistic(true),
    onError: () => { setOptimistic(null); toast.error("Couldn't follow — try again."); },
    onSuccess: async (res) => {
      setOptimistic(null);
      await state.refetch();
      await router.invalidate();
      if (res.mutual) toast.success("Mutual — you two walk together now.");
    },
  });
  const unfollowMut = useMutation({
    mutationFn: async () => unfollowUser({ data: { userId: p.id! } }),
    onMutate: () => setOptimistic(false),
    onError: () => { setOptimistic(null); toast.error("Couldn't unfollow — try again."); },
    onSuccess: async () => {
      setOptimistic(null);
      await state.refetch();
      await router.invalidate();
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <section className="flex items-start gap-4">
        <Avatar className="h-20 w-20 border border-border">
          <AvatarImage src={p.avatar_url ?? undefined} alt={p.display_name ?? p.username ?? "walker"} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-2xl leading-tight">
            {p.display_name ?? `@${p.username}`}
          </h1>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>@{p.username}</span>
            {mutual && (
              <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[10px] font-medium text-forest">
                Walk buddy
              </span>
            )}
          </div>
          {p.location_label && (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {p.location_label}
            </div>
          )}
          {p.bio && <p className="mt-3 text-sm leading-relaxed text-foreground/90">{p.bio}</p>}

          <div className="mt-4">
            {isSelf ? (
              <Button asChild size="sm" variant="secondary" className="rounded-full">
                <Link to="/profile">Edit profile</Link>
              </Button>
            ) : user ? (
              iFollow ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="group rounded-full"
                  disabled={unfollowMut.isPending}
                  onClick={() => unfollowMut.mutate()}
                >
                  <span className="group-hover:hidden">Following</span>
                  <span className="hidden group-hover:inline">Unfollow</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="rounded-full"
                  disabled={followMut.isPending}
                  onClick={() => followMut.mutate()}
                >
                  Follow
                </Button>
              )
            ) : (
              <Button size="sm" className="rounded-full" onClick={() => openAuth("signup")}>
                Follow
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-3 gap-2 text-center">
        <Stat label="Followers" value={data.counts.followers} />
        <Stat label="Following" value={data.counts.following} />
        <Stat label="Mutuals" value={data.counts.mutuals} />
      </section>

      <section className="mt-6 grid grid-cols-3 gap-2 text-center">
        <Stat label="Hosted" value={p.walks_hosted ?? 0} />
        <Stat label="Attended" value={p.walks_attended ?? 0} />
        <Stat label="Streak" value={p.current_streak_weeks ?? 0} suffix="w" />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 font-serif text-lg">
          <Sparkles className="h-4 w-4 text-forest" /> Upcoming walks
        </h2>
        {data.upcomingWalks.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-border bg-card/60 p-5 text-center text-sm text-muted-foreground">
            <CalendarDays className="mx-auto mb-2 h-5 w-5 text-forest" />
            Nothing on the schedule yet.
          </Card>
        ) : (
          <div className="grid gap-3">
            {(data.upcomingWalks as WalkCardData[]).map((w) => (
              <WalkCard key={w.id} walk={w} variant="list" hideRsvp={!user} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-2xl bg-card p-3 shadow-soft">
      <div className="font-serif text-xl leading-none">
        {value}{suffix ? <span className="ml-0.5 text-sm text-muted-foreground">{suffix}</span> : null}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

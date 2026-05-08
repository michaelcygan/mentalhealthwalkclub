import { LiveNowStrip } from "@/components/live-now-strip";
import { UpcomingFriendWalks } from "@/components/friend-walk/upcoming-friend-walks";

/**
 * Composes the user's own upcoming Friend Walks above the public Live Now
 * strip into a single visual block — fewer headings, calmer rhythm.
 * Both children gracefully render nothing when empty.
 */
export function NowAndNext() {
  return (
    <div className="space-y-4">
      <UpcomingFriendWalks />
      <LiveNowStrip />
    </div>
  );
}

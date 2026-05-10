/**
 * Local walk module — placeholder slot for future RSVP roster + ETA UI.
 * For now renders the same Solo-style intention card so Local walks still
 * have first-class content in the shell instead of a blank gap.
 */
import { SoloModule } from "./solo-module";

interface Props {
  intention: string | null;
  savedPrompts: string[];
}

export function LocalModule({ intention, savedPrompts }: Props) {
  return <SoloModule intention={intention} savedPrompts={savedPrompts} />;
}

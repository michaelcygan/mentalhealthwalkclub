import { useEffect, useRef, useState } from "react";
import { MeshAudioTransport } from "./mesh-transport";
import type { AudioParticipant, AudioStatus, AudioTransport } from "./types";

export function useAudioRoom(roomId: string | null, userId: string | null, ready: boolean) {
  const [participants, setParticipants] = useState<AudioParticipant[]>([]);
  const [status, setStatus] = useState<AudioStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [muted, setMuted] = useState(false);
  const transportRef = useRef<AudioTransport | null>(null);

  useEffect(() => {
    if (!ready || !roomId || !userId) return;
    const transport = new MeshAudioTransport();
    transportRef.current = transport;
    transport.onParticipantsChange(setParticipants);
    transport.onStatusChange(setStatus);
    transport.onError(setError);
    transport.join(roomId, userId).catch((e) => setError(e as Error));
    return () => {
      transport.leave().catch(() => {});
      transportRef.current = null;
    };
  }, [ready, roomId, userId]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    transportRef.current?.setMuted(next);
  };

  const leave = async () => {
    await transportRef.current?.leave();
  };

  return { participants, status, error, muted, toggleMute, leave };
}

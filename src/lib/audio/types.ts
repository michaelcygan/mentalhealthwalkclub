export interface AudioParticipant {
  userId: string;
  muted: boolean;
  speaking: boolean;
}

export type AudioStatus = "idle" | "requesting-mic" | "connecting" | "connected" | "error";

export interface AudioTransport {
  join(roomId: string, userId: string): Promise<void>;
  leave(): Promise<void>;
  setMuted(muted: boolean): void;
  onParticipantsChange(cb: (p: AudioParticipant[]) => void): void;
  onStatusChange(cb: (s: AudioStatus) => void): void;
  onError(cb: (err: Error) => void): void;
}

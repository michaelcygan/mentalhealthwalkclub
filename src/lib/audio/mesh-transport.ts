import { supabase } from "@/integrations/supabase/client";
import type { AudioTransport, AudioParticipant, AudioStatus } from "./types";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

interface PeerState {
  pc: RTCPeerConnection;
  audioEl: HTMLAudioElement;
  analyser?: AnalyserNode;
  speaking: boolean;
  muted: boolean;
}

type SignalPayload =
  | { kind: "hello"; from: string }
  | { kind: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; from: string; to: string; candidate: RTCIceCandidateInit }
  | { kind: "mute"; from: string; muted: boolean }
  | { kind: "bye"; from: string };

export class MeshAudioTransport implements AudioTransport {
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private localStream: MediaStream | null = null;
  private peers = new Map<string, PeerState>();
  private selfId = "";
  private roomId = "";
  private muted = false;
  private audioContext: AudioContext | null = null;
  private rafId: number | null = null;
  private participantsCb: (p: AudioParticipant[]) => void = () => {};
  private statusCb: (s: AudioStatus) => void = () => {};
  private errorCb: (e: Error) => void = () => {};

  onParticipantsChange(cb: (p: AudioParticipant[]) => void) { this.participantsCb = cb; }
  onStatusChange(cb: (s: AudioStatus) => void) { this.statusCb = cb; }
  onError(cb: (e: Error) => void) { this.errorCb = cb; }

  async join(roomId: string, userId: string) {
    this.roomId = roomId;
    this.selfId = userId;
    try {
      this.statusCb("requesting-mic");
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.statusCb("connecting");

      this.channel = supabase.channel(`audio-room:${roomId}`, { config: { broadcast: { self: false } } });
      this.channel.on("broadcast", { event: "signal" }, ({ payload }) => this.handleSignal(payload as SignalPayload));
      await new Promise<void>((resolve, reject) => {
        this.channel!.subscribe((status) => {
          if (status === "SUBSCRIBED") resolve();
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error("Realtime channel failed"));
        });
      });

      // Announce presence — existing peers will respond with offers
      this.broadcast({ kind: "hello", from: this.selfId });
      this.startSpeakingDetection();
      this.statusCb("connected");
      this.emitParticipants();
    } catch (e) {
      this.statusCb("error");
      this.errorCb(e as Error);
      throw e;
    }
  }

  async leave() {
    this.broadcast({ kind: "bye", from: this.selfId });
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.peers.forEach((p) => {
      p.pc.close();
      p.audioEl.remove();
    });
    this.peers.clear();
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    if (this.audioContext) { await this.audioContext.close().catch(() => {}); this.audioContext = null; }
    if (this.channel) { await supabase.removeChannel(this.channel); this.channel = null; }
    this.statusCb("idle");
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    this.broadcast({ kind: "mute", from: this.selfId, muted });
    this.emitParticipants();
  }

  private broadcast(payload: SignalPayload) {
    this.channel?.send({ type: "broadcast", event: "signal", payload });
  }

  private async handleSignal(payload: SignalPayload) {
    if (payload.from === this.selfId) return;
    if ("to" in payload && payload.to !== this.selfId) return;

    switch (payload.kind) {
      case "hello": {
        // Deterministic offerer: lexicographically smaller id offers
        if (this.selfId < payload.from) {
          await this.createOffer(payload.from);
        }
        break;
      }
      case "offer": {
        const peer = this.ensurePeer(payload.from);
        await peer.pc.setRemoteDescription(payload.sdp);
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        this.broadcast({ kind: "answer", from: this.selfId, to: payload.from, sdp: answer });
        break;
      }
      case "answer": {
        const peer = this.peers.get(payload.from);
        if (peer) await peer.pc.setRemoteDescription(payload.sdp);
        break;
      }
      case "ice": {
        const peer = this.peers.get(payload.from);
        if (peer) await peer.pc.addIceCandidate(payload.candidate).catch(() => {});
        break;
      }
      case "mute": {
        const peer = this.peers.get(payload.from);
        if (peer) { peer.muted = payload.muted; this.emitParticipants(); }
        break;
      }
      case "bye": {
        const peer = this.peers.get(payload.from);
        if (peer) { peer.pc.close(); peer.audioEl.remove(); this.peers.delete(payload.from); this.emitParticipants(); }
        break;
      }
    }
  }

  private async createOffer(remoteId: string) {
    const peer = this.ensurePeer(remoteId);
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    this.broadcast({ kind: "offer", from: this.selfId, to: remoteId, sdp: offer });
  }

  private ensurePeer(remoteId: string): PeerState {
    const existing = this.peers.get(remoteId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.localStream?.getTracks().forEach((track) => pc.addTrack(track, this.localStream!));

    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    audioEl.style.display = "none";
    document.body.appendChild(audioEl);

    const state: PeerState = { pc, audioEl, speaking: false, muted: false };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) this.broadcast({ kind: "ice", from: this.selfId, to: remoteId, candidate: ev.candidate.toJSON() });
    };
    pc.ontrack = (ev) => {
      const stream = ev.streams[0];
      audioEl.srcObject = stream;
      this.attachAnalyser(state, stream);
      this.emitParticipants();
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        pc.close();
        audioEl.remove();
        this.peers.delete(remoteId);
        this.emitParticipants();
      }
    };

    this.peers.set(remoteId, state);
    this.emitParticipants();
    return state;
  }

  private attachAnalyser(state: PeerState, stream: MediaStream) {
    try {
      if (!this.audioContext) this.audioContext = new AudioContext();
      const src = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      state.analyser = analyser;
    } catch {/* ignore */}
  }

  private startSpeakingDetection() {
    const buf = new Uint8Array(256);
    const tick = () => {
      let changed = false;
      this.peers.forEach((p) => {
        if (!p.analyser) return;
        p.analyser.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i];
        const avg = sum / buf.length;
        const speaking = avg > 18 && !p.muted;
        if (speaking !== p.speaking) { p.speaking = speaking; changed = true; }
      });
      if (changed) this.emitParticipants();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private emitParticipants() {
    const list: AudioParticipant[] = [
      { userId: this.selfId, muted: this.muted, speaking: false },
      ...Array.from(this.peers.entries()).map(([id, p]) => ({ userId: id, muted: p.muted, speaking: p.speaking })),
    ];
    this.participantsCb(list);
  }
}

// Generative ambient pad — Web Audio, no assets, no network.
// Soft, slow-moving drone for "waiting alone" moments in a Walk & Talk room.

const KEY_PRESETS: Record<string, number[]> = {
  // root, fifth, octave (Hz)
  morning:    [146.83, 220.00, 293.66],   // D minor open — bright but calm
  midday:     [164.81, 246.94, 329.63],   // E
  afternoon:  [130.81, 196.00, 261.63],   // C
  evening:    [123.47, 185.00, 246.94],   // B
  night:      [110.00, 164.81, 220.00],   // A — low, settling
  default:    [110.00, 164.81, 220.00],
};

export type PadKey = keyof typeof KEY_PRESETS;

export class AmbientPad {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private oscs: OscillatorNode[] = [];
  private lfo: OscillatorNode | null = null;
  private targetGain = 0;

  async start(volume = 0.18, key: PadKey | string = "default") {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    lp.Q.value = 0.7;
    lp.connect(this.master);

    const freqs = KEY_PRESETS[key as PadKey] ?? KEY_PRESETS.default;
    for (const f of freqs) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 8;
      const g = ctx.createGain();
      g.gain.value = 0.33;
      o.connect(g).connect(lp);
      o.start();
      this.oscs.push(o);
    }

    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 250;
    this.lfo.connect(lfoGain).connect(lp.frequency);
    this.lfo.start();

    this.targetGain = volume;
    this.master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 4);
  }

  duck(volume = 0.04) {
    if (!this.ctx || !this.master) return;
    this.targetGain = volume;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 1.2);
  }

  swell(volume = 0.18) {
    if (!this.ctx || !this.master) return;
    this.targetGain = volume;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 2);
  }

  async stop() {
    if (!this.ctx || !this.master) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.2);
    const ctx = this.ctx;
    await new Promise((r) => setTimeout(r, 1300));
    this.oscs.forEach((o) => { try { o.stop(); } catch { /* noop */ } });
    try { this.lfo?.stop(); } catch { /* noop */ }
    this.oscs = [];
    this.lfo = null;
    this.master = null;
    this.ctx = null;
    await ctx.close().catch(() => {});
  }
}

export function timeOfDayKey(d = new Date()): PadKey {
  const h = d.getHours();
  if (h < 9) return "morning";
  if (h < 14) return "midday";
  if (h < 17) return "afternoon";
  if (h < 20) return "evening";
  return "night";
}

// Soft chime when a walker joins or you join a room.
export function playJoinChime(ctxIn?: AudioContext) {
  const ctx = ctxIn ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
  notes.forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.08, now + 0.02 + i * 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.4 + i * 0.08);
    o.connect(g).connect(ctx.destination);
    o.start(now + i * 0.08);
    o.stop(now + 1.6 + i * 0.08);
  });
  if (!ctxIn) setTimeout(() => ctx.close().catch(() => {}), 2200);
}

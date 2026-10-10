/** Tiny synthesized sound kit: no audio files needed. */
export class SoundKit {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  muted = false;

  start(): void {
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(ctx.destination);

      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 500;
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc = ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc2 = ctx.createOscillator();
      this.engineOsc2.type = 'square';
      this.engineOsc.connect(this.filter);
      this.engineOsc2.connect(this.filter);
      this.filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.engineOsc2.start();
      void ctx.resume().catch(() => {});
    } catch {
      this.ctx = null;
    }
  }

  /** @param speed01 0..1 */
  engine(speed01: number, on: boolean): void {
    if (!this.ctx || !this.engineOsc || !this.engineOsc2 || !this.engineGain || !this.filter)
      return;
    const t = this.ctx.currentTime;
    const f = 55 + speed01 * 70;
    this.engineOsc.frequency.setTargetAtTime(f, t, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.1);
    this.filter.frequency.setTargetAtTime(350 + speed01 * 900, t, 0.1);
    this.engineGain.gain.setTargetAtTime(on && !this.muted ? 0.07 : 0, t, 0.08);
  }

  chime(combo: number): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    const base = 660 * Math.pow(2, Math.min(combo - 1, 5) / 12);
    [base, base * 1.5].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t + i * 0.08);
      g.gain.linearRampToValueAtTime(0.25, t + i * 0.08 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.35);
      osc.connect(g).connect(this.master!);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.4);
    });
  }

  crash(): void {
    if (!this.ctx || !this.master || this.muted) return;
    const ctx = this.ctx;
    const len = ctx.sampleRate * 1.2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = 0.8;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }

  suspend(): void {
    void this.ctx?.suspend().catch(() => {});
  }

  resume(): void {
    void this.ctx?.resume().catch(() => {});
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  dispose(): void {
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}

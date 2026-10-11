/** Synthesized arcade sounds; no downloads or external audio assets. */
export class EscapeAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private siren: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private skid: AudioBufferSourceNode | null = null;
  private skidGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private paused = false;
  muted = false;
  private unlock = () => {
    if (!this.paused) this.resume();
  };

  start(): void {
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = (this.ctx = new Ctx());
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.45;
      this.master.connect(ctx.destination);
      this.engine = ctx.createOscillator();
      this.engine.type = 'sawtooth';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 650;
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engine.connect(filter).connect(this.engineGain).connect(this.master);
      this.engine.start();
      this.siren = ctx.createOscillator();
      this.siren.type = 'sine';
      this.sirenGain = ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.siren.connect(this.sirenGain).connect(this.master);
      this.siren.start();
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const samples = this.noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      this.skid = ctx.createBufferSource();
      this.skid.buffer = this.noise;
      this.skid.loop = true;
      const skidFilter = ctx.createBiquadFilter();
      skidFilter.type = 'bandpass';
      skidFilter.frequency.value = 1700;
      this.skidGain = ctx.createGain();
      this.skidGain.gain.value = 0;
      this.skid.connect(skidFilter).connect(this.skidGain).connect(this.master);
      this.skid.start();
      window.addEventListener('pointerdown', this.unlock);
      window.addEventListener('keydown', this.unlock);
      this.resume();
    } catch {
      this.dispose();
    }
  }

  update(speed: number, drifting: boolean, threat: number, active: boolean): void {
    if (
      !this.ctx ||
      !this.engine ||
      !this.engineGain ||
      !this.siren ||
      !this.sirenGain ||
      !this.skidGain
    )
      return;
    const t = this.ctx.currentTime;
    this.engine.frequency.setTargetAtTime(48 + speed * 2.8, t, 0.08);
    this.engineGain.gain.setTargetAtTime(active ? 0.055 : 0, t, 0.06);
    this.skidGain.gain.setTargetAtTime(active && drifting ? 0.12 : 0, t, 0.04);
    this.siren.frequency.setTargetAtTime(620 + Math.sin(t * 7) * 170, t, 0.03);
    this.sirenGain.gain.setTargetAtTime(active ? threat * 0.075 : 0, t, 0.08);
  }

  tone(from: number, to: number, duration: number, volume = 0.14, delay = 0): void {
    if (!this.ctx || !this.master || this.muted || this.paused || this.ctx.state !== 'running')
      return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(this.master);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(t);
    osc.stop(t + duration);
  }

  impact(destroyed = false): void {
    if (
      !this.ctx ||
      !this.master ||
      !this.noise ||
      this.muted ||
      this.paused ||
      this.ctx.state !== 'running'
    )
      return;
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = destroyed ? 1200 : 550;
    const gain = ctx.createGain();
    const duration = destroyed ? 0.32 : 0.16;
    gain.gain.setValueAtTime(destroyed ? 0.28 : 0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    source.start();
    source.stop(ctx.currentTime + duration);
  }

  shot(): void {
    this.tone(900, 180, 0.09, 0.08);
  }
  boost(): void {
    this.tone(180, 880, 0.35);
  }
  pickup(): void {
    this.tone(660, 660, 0.12);
    this.tone(990, 990, 0.22, 0.14, 0.09);
  }
  finish(escaped: boolean): void {
    (escaped ? [523, 659, 784, 1047] : [330, 262, 196]).forEach((f, i) =>
      this.tone(f, escaped ? f : f * 0.8, 0.25, 0.18, i * 0.13),
    );
  }
  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.ctx && this.master)
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.45, this.ctx.currentTime, 0.02);
    return this.muted;
  }
  suspend(): void {
    this.paused = true;
    void this.ctx?.suspend().catch(() => {});
  }
  resume(): void {
    this.paused = false;
    void this.ctx?.resume().catch(() => {});
  }
  dispose(): void {
    window.removeEventListener('pointerdown', this.unlock);
    window.removeEventListener('keydown', this.unlock);
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}

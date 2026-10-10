/**
 * 1€ filter (Casiez et al., 2012): an adaptive low-pass filter. It smooths heavily when the signal
 * is slow (no jitter while holding still) and lightly when it moves fast (little lag on quick turns).
 */
function alpha(cutoffHz: number, dtSec: number): number {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtSec);
}

export interface OneEuroOptions {
  minCutoff: number;
  beta: number;
  dCutoff: number;
}

export class OneEuroFilter {
  private x: number | null = null;
  private dx = 0;
  private lastT = 0;

  constructor(private readonly opts: OneEuroOptions = { minCutoff: 1.2, beta: 0.04, dCutoff: 1 }) {}

  /** @param tMs timestamp in milliseconds */
  filter(value: number, tMs: number): number {
    if (this.x === null) {
      this.x = value;
      this.lastT = tMs;
      return value;
    }
    const dt = Math.max((tMs - this.lastT) / 1000, 1e-3);
    this.lastT = tMs;
    const rawDx = (value - this.x) / dt;
    this.dx += alpha(this.opts.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.opts.minCutoff + this.opts.beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }

  reset(): void {
    this.x = null;
    this.dx = 0;
  }
}

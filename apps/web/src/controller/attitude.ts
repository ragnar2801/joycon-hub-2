/**
 * Artificial horizon: mirrors the calibrated tilt so the player can see what the plane will do.
 */
export class AttitudeIndicator {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private w = 0;
  private h = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  private fit(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (w !== this.w || h !== this.h || dpr !== this.dpr) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.w = w;
      this.h = h;
      this.dpr = dpr;
    }
  }

  /**
   * @param rollDeg calibrated bank, positive = right
   * @param pitchDeg calibrated pitch, positive = nose up
   * @param rollN normalised roll -1..1 (for the stick dot)
   * @param pitchN normalised pitch -1..1
   */
  draw(rollDeg: number, pitchDeg: number, rollN: number, pitchN: number, active: boolean): void {
    this.fit();
    const { ctx, w, h } = this;
    if (!w || !h) return;
    const r = Math.min(w, h) / 2 - 4 * this.dpr;
    const cx = w / 2;
    const cy = h / 2;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.translate(cx, cy);
    ctx.rotate((-rollDeg * Math.PI) / 180);
    const shift = (pitchDeg / 45) * r;
    ctx.fillStyle = active ? '#3fa9ff' : '#3a4a66';
    ctx.fillRect(-2 * r, -3 * r + shift, 4 * r, 3 * r);
    ctx.fillStyle = active ? '#a8693a' : '#4a3f3a';
    ctx.fillRect(-2 * r, shift, 4 * r, 3 * r);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(-2 * r, shift);
    ctx.lineTo(2 * r, shift);
    ctx.stroke();
    ctx.lineWidth = 1.5 * this.dpr;
    ctx.globalAlpha = 0.7;
    for (const deg of [-20, -10, 10, 20]) {
      const y = shift - (deg / 45) * r;
      const half = (Math.abs(deg) === 10 ? 0.18 : 0.3) * r;
      ctx.beginPath();
      ctx.moveTo(-half, y);
      ctx.lineTo(half, y);
      ctx.stroke();
    }
    ctx.restore();

    // Fixed plane symbol.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 5 * this.dpr;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, 0);
    ctx.lineTo(-r * 0.18, 0);
    ctx.lineTo(-r * 0.08, r * 0.1);
    ctx.moveTo(r * 0.55, 0);
    ctx.lineTo(r * 0.18, 0);
    ctx.lineTo(r * 0.08, r * 0.1);
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(0, 0, 5 * this.dpr, 0, Math.PI * 2);
    ctx.fill();

    // Stick position dot.
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath();
    ctx.arc(rollN * r * 0.75, -pitchN * r * 0.75, 7 * this.dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 3 * this.dpr;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

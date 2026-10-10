const CSS = `
.st-hud { position: absolute; inset: 0; pointer-events: none; font-family: inherit; color: #fff;
  text-shadow: 0 2px 8px rgba(0,0,0,.45); user-select: none; }
.st-top { position: absolute; top: 18px; left: 24px; right: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
.st-label { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; opacity: .8; }
.st-score { font-size: 40px; font-weight: 800; line-height: 1; }
.st-combo { font-size: 16px; font-weight: 700; color: #ffd23f; min-height: 20px; }
.st-time { font-size: 48px; font-weight: 800; text-align: center; line-height: 1; font-variant-numeric: tabular-nums; }
.st-time.low { color: #ff5a5a; animation: st-pulse .5s ease-in-out infinite alternate; }
.st-stats { text-align: right; font-variant-numeric: tabular-nums; font-size: 15px; line-height: 1.5; }
.st-stats b { font-size: 22px; }
.st-boost { position: absolute; left: 50%; bottom: 26px; width: min(320px, 50vw); height: 12px; transform: translateX(-50%);
  border-radius: 99px; background: rgba(0,0,0,.35); overflow: hidden; border: 1px solid rgba(255,255,255,.35); }
.st-boost-fill { height: 100%; width: 100%; background: linear-gradient(90deg,#29c7ff,#7c5cff); transform-origin: left; }
.st-boost.on .st-boost-fill { background: linear-gradient(90deg,#ffd23f,#ff7b25); }
.st-boost-label { position: absolute; left: 50%; bottom: 44px; transform: translateX(-50%); font-size: 11px; letter-spacing: .2em; opacity: .8; }
.st-marker { position: absolute; left: 0; top: 0; width: 34px; height: 34px; margin: -17px 0 0 -17px; display: none; }
.st-marker svg { width: 100%; height: 100%; filter: drop-shadow(0 2px 4px rgba(0,0,0,.5)); }
.st-marker span { position: absolute; top: 36px; left: 50%; transform: translateX(-50%); font-size: 12px; font-weight: 700; white-space: nowrap; }
.st-center { position: absolute; left: 50%; top: 40%; transform: translate(-50%,-50%); text-align: center; }
.st-big { font-size: clamp(48px, 10vw, 120px); font-weight: 900; line-height: 1; }
.st-sub { font-size: clamp(16px, 2vw, 24px); font-weight: 600; margin-top: 12px; opacity: .95; }
.st-toast { position: absolute; left: 50%; top: 58%; transform: translateX(-50%); font-size: 30px; font-weight: 800; color: #ffd23f; opacity: 0; }
.st-toast.show { animation: st-toast .9s ease-out forwards; }
.st-vignette { position: absolute; inset: 0; box-shadow: inset 0 0 0 0 rgba(255,60,60,0); transition: box-shadow .25s; }
.st-vignette.warn { box-shadow: inset 0 0 120px 20px rgba(255,60,60,.55); }
@keyframes st-pulse { from { transform: scale(1); } to { transform: scale(1.08); } }
@keyframes st-toast { 0% { opacity: 0; transform: translate(-50%, 10px) scale(.8); } 20% { opacity: 1; transform: translate(-50%, 0) scale(1.1); }
  100% { opacity: 0; transform: translate(-50%, -40px) scale(1); } }
`;

const ARROW = `<svg viewBox="0 0 34 34"><path d="M17 3 L31 31 L17 24 L3 31 Z" fill="#ffd23f" stroke="#1b1b2f" stroke-width="2" stroke-linejoin="round"/></svg>`;
const RING = `<svg viewBox="0 0 34 34"><circle cx="17" cy="17" r="13" fill="none" stroke="#ffd23f" stroke-width="3" stroke-dasharray="6 4"/></svg>`;

export class Hud {
  readonly el: HTMLDivElement;
  private style: HTMLStyleElement;
  private score: HTMLElement;
  private combo: HTMLElement;
  private time: HTMLElement;
  private speed: HTMLElement;
  private alt: HTMLElement;
  private boost: HTMLElement;
  private boostFill: HTMLElement;
  private marker: HTMLElement;
  private markerLabel: HTMLElement;
  private center: HTMLElement;
  private toast: HTMLElement;
  private vignette: HTMLElement;
  private markerMode: 'arrow' | 'ring' | null = null;

  constructor(parent: HTMLElement) {
    this.style = document.createElement('style');
    this.style.textContent = CSS;
    document.head.appendChild(this.style);
    this.el = document.createElement('div');
    this.el.className = 'st-hud';
    this.el.innerHTML = `
      <div class="st-vignette"></div>
      <div class="st-top">
        <div><div class="st-label">Score</div><div class="st-score" data-testid="st-score">0</div><div class="st-combo"></div></div>
        <div><div class="st-label" style="text-align:center">Time</div><div class="st-time">60</div></div>
        <div class="st-stats"><div><span class="st-label">Speed</span> <b class="st-speed">0</b> <span class="st-label">km/h</span></div><div><span class="st-label">Alt</span> <b class="st-alt">0</b> <span class="st-label">m</span></div></div>
      </div>
      <div class="st-marker"><div class="st-marker-icon"></div><span></span></div>
      <div class="st-center"></div>
      <div class="st-toast"></div>
      <div class="st-boost-label">BOOST</div>
      <div class="st-boost"><div class="st-boost-fill"></div></div>`;
    parent.appendChild(this.el);
    const q = <T extends HTMLElement>(s: string) => this.el.querySelector(s) as T;
    this.score = q('.st-score');
    this.combo = q('.st-combo');
    this.time = q('.st-time');
    this.speed = q('.st-speed');
    this.alt = q('.st-alt');
    this.boost = q('.st-boost');
    this.boostFill = q('.st-boost-fill');
    this.marker = q('.st-marker');
    this.markerLabel = q('.st-marker span');
    this.center = q('.st-center');
    this.toast = q('.st-toast');
    this.vignette = q('.st-vignette');
  }

  stats(o: {
    score: number;
    combo: number;
    time: number;
    speed: number;
    alt: number;
    boost: number;
    boosting: boolean;
    danger: boolean;
  }): void {
    this.score.textContent = String(o.score);
    this.combo.textContent = o.combo > 1 ? `x${o.combo} combo` : '';
    const t = Math.max(0, Math.ceil(o.time));
    if (this.time.textContent !== String(t)) this.time.textContent = String(t);
    this.time.classList.toggle('low', o.time <= 10);
    this.speed.textContent = String(Math.round(o.speed * 3.6));
    this.alt.textContent = String(Math.max(0, Math.round(o.alt)));
    this.boostFill.style.transform = `scaleX(${o.boost.toFixed(3)})`;
    this.boost.classList.toggle('on', o.boosting);
    this.vignette.classList.toggle('warn', o.danger);
  }

  /** Position the next-ring marker. `x`/`y` in px; `angle` radians for edge arrows, null when on screen. */
  setMarker(visible: boolean, x = 0, y = 0, angle: number | null = null, distance = 0): void {
    if (!visible) {
      this.marker.style.display = 'none';
      return;
    }
    const mode = angle === null ? 'ring' : 'arrow';
    if (mode !== this.markerMode) {
      (this.marker.firstElementChild as HTMLElement).innerHTML = mode === 'ring' ? RING : ARROW;
      this.markerMode = mode;
    }
    this.marker.style.display = 'block';
    this.marker.style.transform = `translate(${x}px, ${y}px)`;
    (this.marker.firstElementChild as HTMLElement).style.transform =
      angle === null ? '' : `rotate(${angle}rad)`;
    this.markerLabel.textContent = `${Math.round(distance)} m`;
  }

  message(big: string, sub = ''): void {
    this.center.innerHTML =
      big || sub ? `<div class="st-big">${big}</div><div class="st-sub">${sub}</div>` : '';
  }

  pop(text: string): void {
    this.toast.textContent = text;
    this.toast.classList.remove('show');
    void this.toast.offsetWidth;
    this.toast.classList.add('show');
  }

  dispose(): void {
    this.el.remove();
    this.style.remove();
  }
}

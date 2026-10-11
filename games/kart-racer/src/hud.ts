import { EscapeRoute } from './track.ts';

export function timeLabel(ms: number): string {
  const centiseconds = Math.floor(ms / 10);
  return `${Math.floor(centiseconds / 6000)}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`;
}

export class RaceHud {
  readonly root = document.createElement('div');
  private values: Record<string, HTMLElement> = {};
  private message: HTMLElement;
  private dot: SVGCircleElement;
  private endZ: number;
  private enemyDots: SVGCircleElement[];

  constructor(
    container: HTMLElement,
    track: EscapeRoute,
    debug: boolean,
    restart: () => void,
    pause: () => void,
    fire: (held: boolean) => void,
  ) {
    this.root.className = 'kr-hud';
    this.endZ = track.points.at(-1)!.z;
    const map = (x: number, z: number) =>
      `${(x * 0.45 + 85).toFixed(1)},${(124 - (z / this.endZ) * 112).toFixed(1)}`;
    const safe = track.frame(track.escapeDistance).center;
    const path = track.points
      .filter((_, i) => i % 4 === 0)
      .map((p) => map(p.x, p.z))
      .join(' ');
    this.root.innerHTML = `
      <header class="kr-top">
        <div class="kr-brand"><span class="kr-flag">↗</span><div>Sunny Escape<small>KEEP MOVING. GET TO SAFETY.</small></div></div>
        <div class="kr-stats" aria-label="Escape statistics">
          <div><span>TO SAFE ZONE</span><strong data-value="distance">—</strong></div>
          <div><span>TIME LEFT</span><strong data-value="time">1:40.00</strong></div>
          <div><span>FASTEST ESCAPE</span><strong data-value="best">—</strong></div>
        </div>
        <button class="kr-pause" aria-label="Pause escape" title="Pause escape (Esc)">Ⅱ</button>
      </header>
      <div class="kr-progress" role="progressbar" aria-label="Escape progress" aria-valuemin="0" aria-valuemax="100"><i data-value="progress"></i></div>
      <div class="kr-notice" data-value="notice" role="status" aria-live="polite"></div>
      <div class="kr-combat"><span>KART HEALTH <strong data-value="health">100%</strong></span>
        <div class="kr-health-track" role="progressbar" aria-label="Kart health" aria-valuemin="0" aria-valuemax="100"><i data-value="healthbar"></i></div>
        <small data-value="destroyed">0 blocks · 0 cars blasted</small>
        <small class="kr-pursuit" data-value="pursuit">Road is clear</small>
      </div>
      <button class="kr-fire" aria-label="Fire blaster" disabled><strong>✦ FIRE</strong><span>HOLD TO BLAST</span><i data-value="weapon"></i></button>
      <div class="kr-message" hidden role="status" aria-live="polite"><div>
        <span data-value="eyebrow">READY TO ROLL?</span><h1 data-value="heading">3</h1>
        <p data-value="detail">Hold your phone like a steering wheel.</p>
        <button class="kr-restart" hidden>Try again ↗</button>
      </div></div>
      <div class="kr-bottom">
        <div class="kr-speed"><span>SPEED</span><div><strong data-value="speed">0</strong><span>km/h</span></div>
          <div class="kr-speed-track"><i data-value="speedbar"></i></div><small data-value="handling">Auto acceleration</small>
        </div>
        <div class="kr-guide"><span class="kr-wheel" data-value="wheel">◉</span><div><strong>Tilt to steer</strong>
          <small>${debug ? 'A / D steer · F fire · S brake · Space recover' : 'Hold Fire to blast · Brake for corners'}</small></div></div>
        <div class="kr-map"><span>ESCAPE ROUTE</span><svg viewBox="0 0 170 136" role="img" aria-label="Escape route, safe zone, and your position">
          <polyline points="${path}" fill="none" stroke="#d9e8dc" stroke-width="13" stroke-linejoin="round" />
          <polyline points="${path}" fill="none" stroke="#8ca9a1" stroke-width="5" stroke-linejoin="round" />
          <circle cx="${safe.x * 0.45 + 85}" cy="${124 - (safe.z / this.endZ) * 112}" r="6" fill="#519977" stroke="white" stroke-width="2" />
          <circle class="kr-map-dot" r="5" fill="#ef7b64" stroke="white" stroke-width="2" />
          ${Array.from({ length: 5 }, () => '<circle class="kr-map-enemy" r="3" fill="#8c78af" stroke="white" stroke-width="1" visibility="hidden" />').join('')}
        </svg></div>
      </div>`;
    this.root.querySelectorAll<HTMLElement>('[data-value]').forEach((el) => {
      this.values[el.dataset.value!] = el;
    });
    this.message = this.root.querySelector('.kr-message')!;
    this.dot = this.root.querySelector('.kr-map-dot')!;
    this.enemyDots = [...this.root.querySelectorAll<SVGCircleElement>('.kr-map-enemy')];
    this.root.querySelector<HTMLButtonElement>('.kr-restart')!.onclick = restart;
    this.root.querySelector<HTMLButtonElement>('.kr-pause')!.onclick = pause;
    const fireButton = this.root.querySelector<HTMLButtonElement>('.kr-fire')!;
    fireButton.onpointerdown = (event) => {
      event.preventDefault();
      fireButton.setPointerCapture(event.pointerId);
      fire(true);
    };
    fireButton.onpointerup =
      fireButton.onpointercancel =
      fireButton.onlostpointercapture =
        () => fire(false);
    container.appendChild(this.root);
  }

  update(data: {
    distance: number;
    progress: number;
    timeLeft: number;
    best: number;
    speed: number;
    steering: number;
    x: number;
    z: number;
    handling: string;
    notice: string;
    health: number;
    destroyed: number;
    enemiesDestroyed: number;
    enemies: { x: number; z: number; behind: boolean }[];
    weapon: number;
    active: boolean;
  }): void {
    this.values.distance!.textContent =
      data.distance >= 1000
        ? `${(data.distance / 1000).toFixed(1)} km`
        : `${Math.ceil(data.distance)} m`;
    this.values.time!.textContent = timeLabel(data.timeLeft * 1000);
    this.values.time!.classList.toggle('urgent', data.timeLeft < 20);
    this.values.progress!.style.width = `${data.progress * 100}%`;
    this.root
      .querySelector('.kr-progress')!
      .setAttribute('aria-valuenow', String(Math.round(data.progress * 100)));
    this.values.best!.textContent = data.best > 0 ? timeLabel(data.best) : '—';
    this.values.speed!.textContent = String(Math.round(data.speed * 3.6));
    this.values.speedbar!.style.width = `${Math.min(data.speed / 27, 1) * 100}%`;
    this.values.wheel!.style.transform = `rotate(${data.steering * 65}deg)`;
    this.values.handling!.textContent = data.handling;
    this.values.health!.textContent = `${data.health}%`;
    this.values.healthbar!.style.width = `${data.health}%`;
    this.values.healthbar!.classList.toggle('urgent', data.health <= 30);
    this.root.querySelector('.kr-health-track')!.setAttribute('aria-valuenow', String(data.health));
    this.values.destroyed!.textContent = `${data.destroyed} blocks · ${data.enemiesDestroyed} cars blasted`;
    this.values.pursuit!.textContent = data.enemies.some((enemy) => enemy.behind)
      ? 'Pursuer behind you!'
      : data.enemies.length
        ? `${data.enemies.length} enemy ${data.enemies.length === 1 ? 'car' : 'cars'} ahead`
        : 'Road is clear';
    this.values.pursuit!.classList.toggle('urgent', data.enemies.length > 0);
    this.enemyDots.forEach((dot, i) => {
      const enemy = data.enemies[i];
      dot.setAttribute('visibility', enemy ? 'visible' : 'hidden');
      if (!enemy) return;
      dot.setAttribute('cx', String(enemy.x * 0.45 + 85));
      dot.setAttribute('cy', String(124 - (enemy.z / this.endZ) * 112));
    });
    this.values.weapon!.style.transform = `scaleX(${data.weapon})`;
    this.root.querySelector<HTMLButtonElement>('.kr-fire')!.disabled = !data.active;
    if (this.values.notice!.textContent !== data.notice)
      this.values.notice!.textContent = data.notice;
    this.values.notice!.classList.toggle('visible', !!data.notice);
    this.dot.setAttribute('cx', String(data.x * 0.45 + 85));
    this.dot.setAttribute('cy', String(124 - (data.z / this.endZ) * 112));
  }

  show(heading: string, detail = '', eyebrow = '', finished = false): void {
    this.message.hidden = !heading;
    this.message.classList.toggle('finished', finished);
    if (this.values.heading!.textContent !== heading) this.values.heading!.textContent = heading;
    this.values.detail!.textContent = detail;
    this.values.eyebrow!.textContent = eyebrow;
    this.root.querySelector<HTMLButtonElement>('.kr-restart')!.hidden = !finished;
  }

  dispose(): void {
    this.root.remove();
  }
}

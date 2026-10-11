import type { GameContext, MiniGame } from '@joyconhub/game-sdk';
import { LENGTH, START, TRACK, ovalPath, roadDistance, trackPoint } from './track.ts';

const LAPS = 3;
const BEST_KEY = 'joyconhub:tilt-racer:best-time';
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const timeLabel = (seconds: number) => {
  const hundredths = Math.floor(seconds * 100);
  return `${Math.floor(hundredths / 6000)}:${String(Math.floor(hundredths / 100) % 60).padStart(2, '0')}.${String(hundredths % 100).padStart(2, '0')}`;
};

function readBest(): number {
  try {
    const value = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export class TiltRacerGame implements MiniGame {
  private ctx!: GameContext;
  private root: HTMLDivElement | null = null;
  private canvas = document.createElement('canvas');
  private background = document.createElement('canvas');
  private pen: CanvasRenderingContext2D | null = null;
  private observer: ResizeObserver | null = null;
  private stats: HTMLElement[] = [];
  private message: HTMLElement | null = null;
  private help: HTMLElement | null = null;
  private width = 1;
  private height = 1;
  private car = { ...trackPoint(START), speed: 0, steering: 0 };
  private phase: 'countdown' | 'racing' | 'finished' = 'countdown';
  private countdown = 3;
  private paused = false;
  private elapsed = 0;
  private lapStart = 0;
  private lastLap = 0;
  private checkpoint = 1;
  private best = readBest();
  private recoverHeld = false;
  private offRoad = false;
  private nextBroadcast = 0;
  private notice = '';
  private noticeTime = 0;

  mount(container: HTMLElement, ctx: GameContext): void {
    this.ctx = ctx;
    this.root = document.createElement('div');
    this.root.className = 'tilt-racer';
    this.root.innerHTML = `
      <div class="tr-hud">
        <div class="tr-brand">Tilt Racer<small>Sunny circuit · Time trial</small></div>
        <div class="tr-stats" role="status" aria-label="Race statistics">
          <div class="tr-stat"><span>LAP</span><strong>1 / 3</strong></div>
          <div class="tr-stat"><span>TIME</span><strong>0:00.00</strong></div>
          <div class="tr-stat"><span>BEST</span><strong>—</strong></div>
          <div class="tr-stat"><span>KM/H</span><strong>0</strong></div>
        </div>
      </div>
      <div class="tr-message" role="status" aria-live="polite"><div><h1></h1><p></p><p></p></div></div>
      <div class="tr-help"></div>`;
    this.canvas.setAttribute(
      'aria-label',
      'Top-down oval racetrack with a coral car. Drive clockwise for three laps.',
    );
    this.root.prepend(this.canvas);
    container.appendChild(this.root);
    this.pen = this.canvas.getContext('2d');
    this.stats = [...this.root.querySelectorAll<HTMLElement>('.tr-stat strong')];
    this.message = this.root.querySelector('.tr-message');
    this.help = this.root.querySelector('.tr-help');
    if (!this.pen) {
      this.showMessage('Canvas unavailable', 'Try another browser to play Tilt Racer.');
      return;
    }
    this.drawScenery();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.root);
    this.resize();
    this.restart();
  }

  restart(): void {
    this.car = { ...trackPoint(START), speed: 0, steering: 0 };
    this.phase = 'countdown';
    this.countdown = 3;
    this.elapsed = this.lapStart = this.lastLap = 0;
    this.checkpoint = 1;
    this.nextBroadcast = 0;
    this.recoverHeld = this.offRoad = this.paused = false;
    this.notice = '';
    this.noticeTime = 0;
    this.showMessage(
      '3',
      'Hold your phone like a steering wheel.',
      'Three laps · Follow the arrows',
    );
    this.updateHud();
    this.render();
  }

  update(dt: number): void {
    if (!this.pen || this.paused) return;
    dt = clamp(dt, 0, 0.05);
    this.noticeTime = Math.max(0, this.noticeTime - dt);
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.phase = 'racing';
        this.showMessage('');
        this.notice = 'Go! Follow the track clockwise.';
        this.noticeTime = 2;
        this.ctx.emit({ kind: 'start', vibrate: [60] });
      } else {
        this.showMessage(
          String(Math.ceil(this.countdown)),
          'Hold your phone like a steering wheel.',
          'Three laps · Follow the arrows',
        );
      }
    } else if (this.phase === 'racing') {
      this.drive(dt);
    }
    this.updateHud();
    this.render();
  }

  pause(): void {
    this.paused = true;
  }
  resume(): void {
    this.paused = false;
  }

  unmount(): void {
    this.observer?.disconnect();
    this.root?.remove();
    this.root = this.message = this.help = null;
    this.stats = [];
    this.pen = null;
    this.canvas.width = this.background.width = 1;
    this.canvas.height = this.background.height = 1;
  }

  private drive(dt: number): void {
    const input = this.ctx.input();
    const recover = !!input.buttons.recover || (this.ctx.debug && !!input.buttons.boost);
    if (recover && !this.recoverHeld) this.recover();
    this.recoverHeld = recover;
    const car = this.car;
    const previous = { x: car.x, y: car.y };
    const wasOffRoad = roadDistance(car.x, car.y) > TRACK.roadHalf - 7;
    car.steering += (clamp(input.roll, -1, 1) - car.steering) * (1 - Math.exp(-8 * dt));
    const targetSpeed =
      (input.connected ? clamp(input.throttle, 0, 1) : 0) * (wasOffRoad ? 28 : 155);
    const acceleration = targetSpeed > car.speed ? 65 : wasOffRoad ? 140 : 100;
    car.speed += clamp(targetSpeed - car.speed, -acceleration * dt, acceleration * dt);
    car.heading += car.steering * 2.3 * (car.speed / (car.speed + 35)) * dt;
    car.heading %= Math.PI * 2;
    car.x += Math.cos(car.heading) * car.speed * dt;
    car.y += Math.sin(car.heading) * car.speed * dt;
    const boundedX = clamp(car.x, 30, TRACK.width - 30);
    const boundedY = clamp(car.y, 145, TRACK.height - 30);
    if (boundedX !== car.x || boundedY !== car.y) car.speed = 0;
    car.x = boundedX;
    car.y = boundedY;
    this.offRoad = roadDistance(car.x, car.y) > TRACK.roadHalf - 7;
    if (this.offRoad && !wasOffRoad) this.ctx.emit({ kind: 'hit', vibrate: [25] });
    this.elapsed += dt;

    // Ordered directional gates prevent reverse laps and finish-line oscillation.
    const gate = trackPoint(START + (this.checkpoint * LENGTH) / 4);
    const tx = Math.cos(gate.heading);
    const ty = Math.sin(gate.heading);
    const before = (previous.x - gate.x) * tx + (previous.y - gate.y) * ty;
    const after = (car.x - gate.x) * tx + (car.y - gate.y) * ty;
    if (before <= 0 && after > 0 && !wasOffRoad && !this.offRoad) {
      const fraction = -before / (after - before);
      const crossX = previous.x + (car.x - previous.x) * fraction;
      const crossY = previous.y + (car.y - previous.y) * fraction;
      const sideways = Math.abs((crossX - gate.x) * -ty + (crossY - gate.y) * tx);
      if (sideways <= TRACK.roadHalf - 7) {
        const crossingTime = this.elapsed - dt * (1 - fraction);
        if (this.checkpoint % 4 === 0) this.completeLap(crossingTime);
        this.checkpoint++;
      }
    }
    if (this.phase === 'racing' && this.elapsed >= this.nextBroadcast) {
      this.nextBroadcast = this.elapsed + 1;
      this.ctx.emit({ kind: 'score', score: Math.round(this.elapsed * 1000) });
    }
  }

  private recover(): void {
    this.car = {
      ...trackPoint(START + ((this.checkpoint - 1) * LENGTH) / 4 + 12),
      speed: 0,
      steering: 0,
    };
    this.elapsed += 3;
    this.notice = 'Back on track · +3 seconds';
    this.noticeTime = 3;
    this.ctx.emit({ kind: 'hit', message: this.notice, vibrate: [40] });
  }

  private completeLap(crossingTime: number): void {
    const lap = this.checkpoint / 4;
    this.lastLap = crossingTime - this.lapStart;
    this.lapStart = crossingTime;
    if (lap < LAPS) {
      this.notice = `Lap ${lap} complete · ${timeLabel(this.lastLap)}`;
      this.noticeTime = 3;
      this.ctx.emit({
        kind: 'score',
        score: Math.round(this.elapsed * 1000),
        message: this.notice,
        vibrate: [40, 40, 40],
      });
      return;
    }
    this.elapsed = crossingTime;
    this.phase = 'finished';
    this.car.speed = 0;
    const record = !this.best || this.elapsed < this.best;
    if (record) {
      this.best = this.elapsed;
      try {
        localStorage.setItem(BEST_KEY, String(this.best));
      } catch {
        /* Storage unavailable. */
      }
    }
    this.showMessage(
      record ? 'New best!' : 'Finish!',
      `Three laps in ${timeLabel(this.elapsed)} · Best ${timeLabel(this.best)}`,
      'Tap Play again on your phone, or press Enter.',
    );
    this.ctx.emit({
      kind: 'gameover',
      score: Math.round(this.elapsed * 1000),
      best: Math.round(this.best * 1000),
      message: `Finished in ${timeLabel(this.elapsed)}`,
      vibrate: [100, 60, 100],
    });
  }

  private showMessage(title: string, subtitle = '', hint = ''): void {
    if (!this.message) return;
    this.message.hidden = !title;
    const heading = this.message.querySelector('h1')!;
    // Avoid repeated live-region announcements of the same countdown number.
    if (heading.textContent !== title) heading.textContent = title;
    const paragraphs = this.message.querySelectorAll('p');
    if (paragraphs[0]!.textContent !== subtitle) paragraphs[0]!.textContent = subtitle;
    if (paragraphs[1]!.textContent !== hint) paragraphs[1]!.textContent = hint;
  }

  private updateHud(): void {
    const values = [
      `${Math.min(LAPS, Math.floor((this.checkpoint - 1) / 4) + 1)} / ${LAPS}`,
      timeLabel(this.elapsed),
      this.best ? timeLabel(this.best) : '—',
      String(Math.round(this.car.speed * 0.65)),
    ];
    this.stats.forEach((element, i) => {
      element.textContent = values[i]!;
    });
    if (this.help)
      this.help.textContent =
        this.noticeTime > 0
          ? this.notice
          : this.offRoad
            ? 'Grass slows you down · Steer onto the road or tap Back on track (+3s)'
            : this.ctx.debug
              ? '← → / A D steer · Q E throttle · Space recovers (+3s) · Esc pauses'
              : 'Tilt to steer · Throttle to change speed · Stay on the road';
  }

  private resize(): void {
    if (!this.root) return;
    this.width = this.root.clientWidth;
    this.height = this.root.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(this.width * ratio));
    this.canvas.height = Math.max(1, Math.round(this.height * ratio));
    this.render();
  }

  private drawScenery(): void {
    this.background.width = TRACK.width * 2;
    this.background.height = TRACK.height * 2;
    const g = this.background.getContext('2d')!;
    g.scale(2, 2);
    g.fillStyle = '#d9eac6';
    g.fillRect(0, 0, TRACK.width, TRACK.height);
    g.fillStyle = '#e8f5fc';
    g.fillRect(0, 0, TRACK.width, 115);
    g.fillStyle = '#cee2b8';
    g.beginPath();
    g.moveTo(0, 140);
    for (let x = 0; x <= 1000; x += 20) g.lineTo(x, 116 + Math.sin(x / 90) * 12);
    g.lineTo(1000, 150);
    g.closePath();
    g.fill();
    g.fillStyle = '#ffffffb0';
    for (const x of [100, 810, 930]) {
      g.beginPath();
      g.ellipse(x, 82, 40, 9, 0, 0, Math.PI * 2);
      g.fill();
    }
    // White/salmon curbs, pale asphalt, and a quiet dashed centre line.
    const circuit = ovalPath(TRACK.radius);
    g.strokeStyle = '#b7d09c';
    g.lineWidth = 104;
    g.stroke(circuit);
    g.strokeStyle = '#fffdf4';
    g.lineWidth = 96;
    g.stroke(circuit);
    g.strokeStyle = '#eda398';
    g.setLineDash([12, 12]);
    g.stroke(circuit);
    g.setLineDash([]);
    g.strokeStyle = '#bacacb';
    g.lineWidth = TRACK.roadHalf * 2;
    g.stroke(circuit);
    g.strokeStyle = '#edf4ee';
    g.lineWidth = 2;
    g.setLineDash([15, 19]);
    g.stroke(circuit);
    g.setLineDash([]);
    // Start/finish checker stripe.
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < 2; col++) {
        g.fillStyle = (row + col) % 2 ? '#fffef7' : '#52686a';
        g.fillRect(TRACK.cx + col * 7, TRACK.cy - TRACK.radius - TRACK.roadHalf + row * 7, 7, 7);
      }
    }
    g.fillStyle = '#6c9290';
    g.font = 'bold 10px system-ui';
    g.textAlign = 'center';
    g.fillText('START / FINISH', 505, 151);
    for (let i = 0; i < 8; i++) {
      const p = trackPoint(START + (LENGTH * (i + 0.35)) / 8);
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.heading);
      g.strokeStyle = '#eff6f0';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-7, -6);
      g.lineTo(1, 0);
      g.lineTo(-7, 6);
      g.stroke();
      g.restore();
    }
    g.fillStyle = '#89aa75';
    g.font = 'bold 26px "Trebuchet MS", sans-serif';
    g.fillText('SUNNY CIRCUIT', 500, 350);
    g.font = '13px system-ui';
    g.fillText('A little tilt goes a long way.', 500, 376);
    g.fillStyle = '#fffdf2';
    g.beginPath();
    g.roundRect(450, 396, 100, 30, 15);
    g.fill();
    g.fillStyle = '#799266';
    g.font = 'bold 10px system-ui';
    g.fillText('3 LAPS  ·  1 CAR', 500, 415);
    for (const [x, y, size] of [
      [66, 220, 20],
      [72, 460, 25],
      [925, 250, 23],
      [920, 500, 18],
      [320, 345, 20],
      [688, 392, 22],
      [256, 595, 15],
      [770, 590, 19],
    ]) {
      this.tree(g, x!, y!, size!);
    }
    for (let i = 0; i < 35; i++) {
      const x = 40 + ((i * 137) % 920);
      const y = 145 + ((i * 83) % 450);
      if (roadDistance(x, y) < 60 || (x > 290 && x < 720 && y > 300 && y < 430)) continue;
      g.fillStyle = i % 2 ? '#fffbea' : '#e7c484';
      g.beginPath();
      g.arc(x, y, 2, 0, Math.PI * 2);
      g.fill();
    }
  }

  private tree(g: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    g.fillStyle = '#92b58240';
    g.beginPath();
    g.ellipse(x + 6, y + 7, size, size * 0.75, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#90bc83';
    g.beginPath();
    g.arc(x, y, size, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#a8ce91';
    g.beginPath();
    g.arc(x - size * 0.25, y - size * 0.25, size * 0.66, 0, Math.PI * 2);
    g.fill();
  }

  private render(): void {
    const g = this.pen;
    if (!g || this.width <= 0 || this.height <= 0) return;
    g.setTransform(this.canvas.width / this.width, 0, 0, this.canvas.height / this.height, 0, 0);
    g.fillStyle = '#d9eac6';
    g.fillRect(0, 0, this.width, this.height);
    const scale = Math.min(this.width / TRACK.width, this.height / TRACK.height);
    g.save();
    g.translate((this.width - TRACK.width * scale) / 2, (this.height - TRACK.height * scale) / 2);
    g.scale(scale, scale);
    g.drawImage(this.background, 0, 0, TRACK.width, TRACK.height);
    // A subtle marker on the next gate makes the intended route clear.
    if (this.phase !== 'finished') {
      const target = trackPoint(START + (this.checkpoint * LENGTH) / 4);
      g.save();
      g.translate(target.x, target.y);
      g.rotate(target.heading);
      g.strokeStyle = '#fffbe1';
      g.lineWidth = 3;
      for (const side of [-1, 1]) {
        g.beginPath();
        g.moveTo(-9, side * 33);
        g.lineTo(3, side * 33);
        g.lineTo(3, side * 25);
        g.stroke();
      }
      g.restore();
    }
    const car = this.car;
    g.translate(car.x, car.y);
    g.rotate(car.heading);
    g.fillStyle = '#36554b25';
    g.beginPath();
    g.roundRect(-15, -7, 35, 22, 7);
    g.fill();
    g.fillStyle = '#425b60';
    for (const x of [-10, 8]) for (const y of [-12, 8]) g.fillRect(x, y, 8, 5);
    g.fillStyle = '#e87e6f';
    g.beginPath();
    g.roundRect(-18, -10, 36, 20, 6);
    g.fill();
    g.fillStyle = '#f6a193';
    g.beginPath();
    g.roundRect(-13, -7, 24, 14, 4);
    g.fill();
    g.fillStyle = '#e9f4ef';
    g.beginPath();
    g.roundRect(-6, -7, 13, 14, 3);
    g.fill();
    g.fillStyle = '#91b9c0';
    g.fillRect(3, -6, 4, 12);
    g.fillStyle = '#fff6c9';
    g.fillRect(15, -7, 3, 4);
    g.fillRect(15, 3, 3, 4);
    g.restore();
  }
}

import * as THREE from 'three';
import type { GameContext, MiniGame } from '@joyconhub/game-sdk';
import { EscapeRoute } from './track.ts';
import { cancelDrift, createKart, driveKart, grantBoost, smooth } from './driving.ts';
import { buildKart, buildScenery, disposeScene } from './scene.ts';
import { RaceHud, timeLabel } from './hud.ts';
import { Battlefield } from './combat.ts';
import { Pursuit } from './enemies.ts';
import { EscapeAudio } from './audio.ts';
import { KartEffects } from './effects.ts';
import { RoadPickups } from './pickups.ts';

const BEST_KEY = 'joyconhub:kart-racer:best-escape-time';
const TIME_LIMIT = 100;
const CHECKPOINT_SPACING = 120;
const SKY = 0xd4edf0;

function loadBest(): number {
  try {
    const v = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

export class KartRacerGame implements MiniGame {
  private ctx!: GameContext;
  private root: HTMLDivElement | null = null;
  private view: HTMLElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private observer: ResizeObserver | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 1, 0.1, 750);
  private track = new EscapeRoute();
  private combat = new Battlefield(this.track);
  private pursuit = new Pursuit(this.track, this.combat.blocks);
  private pickups = new RoadPickups(this.track);
  private effects = new KartEffects();
  private sound = new EscapeAudio();
  private shieldTime = 0;
  private onKey = (event: KeyboardEvent) => {
    if (event.code === 'KeyM' && !event.repeat) this.toggleMute();
  };
  private sun = new THREE.DirectionalLight(0xfff4dc, 2.2);
  private model = buildKart();
  private kart = createKart(this.track);
  private lookTarget = new THREE.Vector3();
  private desiredCamera = new THREE.Vector3();
  private hud: RaceHud | null = null;
  private phase: 'countdown' | 'racing' | 'finished' = 'countdown';
  private countdown = 3;
  private paused = false;
  private elapsed = 0;
  private checkpoint = 1;
  private best = loadBest();
  private notice = '';
  private noticeTime = 0;
  private hitCooldown = 0;
  private recoverHeld = false;
  private nextBroadcast = 0;
  private health = 100;
  private damageCooldown = 0;
  private destroyed = 0;
  private enemiesDestroyed = 0;
  private fireHeld = false;

  mount(container: HTMLElement, ctx: GameContext): void {
    this.ctx = ctx;
    this.root = document.createElement('div');
    this.root.className = 'kart-racer';
    container.appendChild(this.root);
    this.view = container.closest('.game-view');
    this.view?.classList.add('kr-view');
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      this.root.innerHTML =
        '<div class="kr-error"><h2>Let’s get you on the road</h2><p>Sunny Escape needs WebGL. Try Chrome, Edge, Firefox, or Safari with hardware acceleration enabled.</p></div>';
      return;
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute(
      'aria-label',
      '3D escape route. Steer the coral kart down the winding road to the safe zone.',
    );
    this.root.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 170, 530);
    this.scene.add(new THREE.HemisphereLight(0xfffaf1, 0x95ad86, 2.5));
    const sun = this.sun;
    sun.position.set(60, 100, 70);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -45,
      right: 45,
      top: 45,
      bottom: -45,
      near: 1,
      far: 450,
    });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.05;
    this.scene.add(
      sun,
      sun.target,
      buildScenery(this.track),
      this.model.root,
      this.combat.group,
      this.pursuit.group,
      this.pickups.group,
      this.effects.group,
    );
    this.hud = new RaceHud(
      this.root,
      this.track,
      ctx.debug,
      () => (ctx.restart ? ctx.restart() : this.restart()),
      () => ctx.pause?.(),
      (held) => {
        this.fireHeld = held;
      },
      () => this.toggleMute(),
    );
    this.sound.start();
    window.addEventListener('keydown', this.onKey);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.root);
    this.resize();
    this.restart();
  }

  restart(): void {
    this.kart = createKart(this.track);
    this.phase = 'countdown';
    this.countdown = 3;
    this.elapsed = this.nextBroadcast = this.hitCooldown = 0;
    this.checkpoint = 1;
    this.paused = this.recoverHeld = false;
    this.fireHeld = false;
    this.health = 100;
    this.shieldTime = 0;
    this.damageCooldown = this.destroyed = this.enemiesDestroyed = 0;
    this.combat.reset();
    this.pursuit.reset();
    this.pickups.reset();
    this.effects.reset();
    this.sound.update(0, false, 0, false);
    this.notice = '';
    this.noticeTime = 0;
    this.syncModel(0);
    this.placeCamera(1, true);
    this.hud?.show(
      '3',
      'Turn + Brake to drift. Release Brake for boost. Collect + repairs, blue shields and gold boost pads.',
      'MAKE YOUR ESCAPE',
    );
    this.updateHud();
    this.renderer?.render(this.scene, this.camera);
  }

  update(dt: number): void {
    if (!this.renderer || this.paused) return;
    dt = THREE.MathUtils.clamp(dt, 0, 0.05);
    this.noticeTime = Math.max(0, this.noticeTime - dt);
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    if (this.phase === 'countdown') {
      const previousCount = Math.ceil(this.countdown);
      this.countdown -= dt;
      if (Math.ceil(this.countdown) !== previousCount)
        this.sound.tone(this.countdown <= 0 ? 880 : 440, this.countdown <= 0 ? 880 : 440, 0.16);
      if (this.countdown <= 0) {
        this.phase = 'racing';
        this.hud?.show('');
        this.notify('Go! Tilt to steer. The kart accelerates for you.', 3);
        this.ctx.emit({ kind: 'start', vibrate: [60] });
      } else
        this.hud?.show(
          String(Math.ceil(this.countdown)),
          'Turn + Brake to drift. Release Brake for boost. Collect + repairs, blue shields and gold boost pads.',
          'MAKE YOUR ESCAPE',
        );
    } else if (this.phase === 'racing') {
      const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
      for (let i = 0; i < steps && this.phase === 'racing'; i++) this.drive(dt / steps);
    }
    this.syncModel(dt);
    const active = this.phase === 'racing';
    this.pickups.animate(dt);
    this.effects.update(dt, this.kart, this.shieldTime, active);
    const nearestEnemy = this.pursuit.cars.reduce(
      (nearest, car) =>
        car.active
          ? Math.min(
              nearest,
              Math.hypot(car.root.position.x - this.kart.x, car.root.position.z - this.kart.z),
            )
          : nearest,
      80,
    );
    this.sound.update(
      this.kart.speed,
      this.kart.drifting,
      Math.max(0, 1 - nearestEnemy / 80),
      active,
    );
    this.placeCamera(dt);
    this.updateHud();
    this.renderer.render(this.scene, this.camera);
  }

  pause(): void {
    this.paused = true;
    this.fireHeld = false;
    this.sound.suspend();
  }
  resume(): void {
    this.paused = false;
    this.sound.resume();
  }

  unmount(): void {
    window.removeEventListener('keydown', this.onKey);
    this.sound.dispose();
    this.observer?.disconnect();
    this.hud?.dispose();
    disposeScene(this.scene);
    // The kart is allocated before mounting; also release it if WebGL creation failed.
    if (!this.model.root.parent) disposeScene(this.model.root);
    if (!this.combat.group.parent) disposeScene(this.combat.group);
    if (!this.pursuit.group.parent) disposeScene(this.pursuit.group);
    if (!this.pickups.group.parent) disposeScene(this.pickups.group);
    if (!this.effects.group.parent) disposeScene(this.effects.group);
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.root?.remove();
    this.view?.classList.remove('kr-view');
    this.renderer = this.root = this.hud = this.observer = this.view = null;
  }

  private drive(dt: number): void {
    const input = this.ctx.input();
    const recover = !!input.buttons.recover;
    if (recover && !this.recoverHeld) {
      this.kart = createKart(
        this.track,
        Math.max(20, (this.checkpoint - 1) * CHECKPOINT_SPACING + 2),
      );
      this.elapsed += 3;
      this.combat.clearShots();
      this.pursuit.regroup();
      this.shieldTime = 0;
      this.effects.reset();
      this.fireHeld = false;
      this.notify('Back on track · +3 seconds', 3);
      this.ctx.emit({ kind: 'hit', message: this.notice, vibrate: [45] });
      this.syncModel(0);
      this.placeCamera(1, true);
    }
    this.recoverHeld = recover;
    const previousX = this.kart.x;
    const previousZ = this.kart.z;
    const wasOffRoad = this.kart.offRoad;
    const previousCharge = this.kart.driftCharge;
    this.shieldTime = Math.max(0, this.shieldTime - dt);
    const hit = driveKart(this.kart, input, this.track, dt);
    if (previousCharge < 0.4 && this.kart.driftCharge >= 0.4)
      this.ctx.emit({
        kind: 'score',
        message: 'Drift charged · release Brake for boost!',
        vibrate: [15, 20, 15],
      });
    if (previousCharge < 0.85 && this.kart.driftCharge >= 0.85)
      this.ctx.emit({
        kind: 'score',
        message: 'Super boost ready · release Brake!',
        vibrate: [25, 20, 25],
      });
    if (this.kart.driftBoost) {
      this.sound.boost();
      this.notify('Drift boost! Keep moving.', 1.4);
      this.ctx.emit({ kind: 'score', message: 'Drift boost!', vibrate: [30, 20, 50] });
    }
    for (const kind of this.pickups.collect(
      previousX,
      previousZ,
      this.kart.x,
      this.kart.z,
      this.health,
    )) {
      let message: string;
      if (kind === 'repair') {
        const restored = Math.min(30, 100 - this.health);
        this.health += restored;
        message = `Repair kit · +${restored}% health`;
      } else if (kind === 'shield') {
        this.shieldTime = 6;
        message = 'Shield active · 6 seconds';
      } else {
        grantBoost(this.kart, 1.5);
        this.sound.boost();
        message = 'Boost pad!';
      }
      this.sound.pickup();
      this.notify(message, 2);
      this.ctx.emit({ kind: 'score', message, vibrate: [25, 20, 25] });
    }
    this.damageCooldown = Math.max(0, this.damageCooldown - dt);
    const enemies = this.pursuit.update(dt, this.kart);
    if (enemies.spawned) {
      this.notify('Enemy cars closing in · hold Fire or slip past', 2);
      this.ctx.emit({ kind: 'hit', message: 'Enemy cars closing in', vibrate: [25, 40, 25] });
    }
    const blasts = this.combat.update(
      dt,
      this.kart,
      input.connected && (!!input.buttons.fire || this.fireHeld),
      this.pursuit.cars,
    );
    if (this.combat.fired) this.sound.shot();
    for (const blast of blasts) {
      this.sound.impact(blast.destroyed);
      if (!blast.destroyed) continue;
      const enemy = blast.target.kind === 'enemy';
      if (enemy) this.enemiesDestroyed++;
      else this.destroyed++;
      const message = enemy ? 'Enemy car blasted!' : 'Blockage blasted! Keep moving.';
      this.notify(message, 1.2);
      this.ctx.emit({ kind: 'score', message, vibrate: enemy ? [35, 30, 35] : [20] });
    }
    const block = this.combat.blockCollision(this.kart);
    if (block) this.damage(22, 'Blockage hit · steer around it or hold Fire');
    else if (enemies.contact?.active) this.damage(18, 'Enemy ram · blast them or steer away');
    else if (hit) this.damage(5, 'Barrier bump! Ease into the turn.');
    if (this.phase === 'finished') return;
    this.elapsed += dt;
    if (this.elapsed >= TIME_LIMIT) {
      this.elapsed = TIME_LIMIT;
      this.finish(false);
      return;
    }
    if (hit) {
      this.hitCooldown = 0.65;
    } else if (this.kart.offRoad && !wasOffRoad && this.hitCooldown === 0) {
      this.notify('On the shoulder · steer back onto the road', 2);
      this.ctx.emit({ kind: 'hit', vibrate: [20] });
    }
    // Forward checkpoints keep recovery fair and prevent skipping sections of the escape route.
    const gateDistance = Math.min(this.checkpoint * CHECKPOINT_SPACING, this.track.escapeDistance);
    const gate = this.track.frame(gateDistance);
    const before =
      (previousX - gate.center.x) * gate.tangent.x + (previousZ - gate.center.z) * gate.tangent.z;
    const after =
      (this.kart.x - gate.center.x) * gate.tangent.x +
      (this.kart.z - gate.center.z) * gate.tangent.z;
    if (before <= 0 && after > 0) {
      const fraction = -before / (after - before);
      const x = previousX + (this.kart.x - previousX) * fraction;
      const z = previousZ + (this.kart.z - previousZ) * fraction;
      const side = (x - gate.center.x) * gate.right.x + (z - gate.center.z) * gate.right.z;
      if (Math.abs(side) <= 11.8) {
        this.checkpoint++;
        if (gateDistance >= this.track.escapeDistance) {
          this.elapsed -= dt * (1 - fraction);
          this.finish(true);
        }
      }
    }
    if (this.phase === 'racing' && this.elapsed >= this.nextBroadcast) {
      this.nextBroadcast = this.elapsed + 0.5;
      this.ctx.emit({ kind: 'score', score: Math.round(this.elapsed * 1000) });
    }
  }

  private finish(
    escaped: boolean,
    reason = 'The safe zone closed before you arrived. Try again and keep moving.',
  ): void {
    this.phase = 'finished';
    this.kart.speed = 0;
    cancelDrift(this.kart);
    this.kart.boostTime = 0;
    this.shieldTime = 0;
    this.sound.update(0, false, 0, false);
    this.sound.finish(escaped);
    this.fireHeld = false;
    this.combat.clearShots();
    const score = Math.round(this.elapsed * 1000);
    const record = escaped && (this.best === 0 || score < this.best);
    if (record) {
      this.best = score;
      try {
        localStorage.setItem(BEST_KEY, String(score));
      } catch {
        /* Escaping works without storage. */
      }
    }
    this.noticeTime = 0;
    this.hud?.show(
      escaped ? 'Escaped!' : this.health === 0 ? 'Kart wrecked' : 'Time’s up',
      escaped
        ? `Safe zone reached in ${timeLabel(score)}. ${record ? 'Your fastest escape!' : 'You made it.'}`
        : reason,
      escaped ? 'YOU MADE IT TO SAFETY' : 'ESCAPE FAILED',
      true,
    );
    this.ctx.emit({
      kind: 'gameover',
      score,
      best: this.best,
      message: escaped
        ? 'Safe zone reached'
        : this.health === 0
          ? 'Escape failed — kart wrecked'
          : 'Escape failed — time ran out',
      vibrate: [100, 70, 100],
    });
  }

  private damage(amount: number, message: string): void {
    cancelDrift(this.kart);
    this.kart.boostTime = 0;
    if (this.damageCooldown > 0) return;
    this.effects.impact(this.kart);
    this.sound.impact();
    if (this.shieldTime > 0) {
      this.damageCooldown = 0.4;
      this.notify('Shield absorbed the hit!', 1.2);
      this.ctx.emit({ kind: 'hit', message: 'Shield absorbed the hit!', vibrate: [25] });
      return;
    }
    this.health = Math.max(0, this.health - amount);
    this.damageCooldown = 1.1;
    this.notify(message, 2);
    this.ctx.emit({ kind: 'hit', message, vibrate: [90] });
    if (this.health === 0)
      this.finish(
        false,
        'Your kart took too much damage. Blast enemy cars and blockages, or steer around them.',
      );
  }

  private notify(message: string, duration: number): void {
    this.notice = message;
    this.noticeTime = duration;
  }

  private toggleMute(): void {
    this.hud?.setMuted(this.sound.toggleMute());
  }

  private syncModel(dt: number): void {
    const k = this.kart;
    this.model.root.position.set(k.x, 0.035, k.z);
    this.model.root.visible =
      this.phase !== 'racing' ||
      this.damageCooldown < 0.6 ||
      Math.floor(this.damageCooldown * 15) % 2 === 0;
    this.sun.position.set(k.x + 60, 100, k.z + 70);
    this.sun.target.position.set(k.x, 0, k.z);
    this.model.root.rotation.set(
      k.braking ? -0.035 : 0,
      k.heading - (k.drifting ? k.steering * 0.18 : 0),
      k.steering * Math.min(k.speed / 27, 1) * 0.065,
      'YXZ',
    );
    this.model.frontWheels.forEach((wheel) => {
      wheel.rotation.y = -k.steering * 0.42;
    });
    this.model.wheels.forEach((wheel) => {
      wheel.rotation.x += (k.speed / 0.43) * dt;
    });
  }

  private placeCamera(dt: number, snap = false): void {
    const k = this.kart;
    this.desiredCamera.set(k.x - Math.sin(k.heading) * 12, 6.6, k.z - Math.cos(k.heading) * 12);
    const ahead = new THREE.Vector3(
      k.x + Math.sin(k.heading) * 7,
      1.25,
      k.z + Math.cos(k.heading) * 7,
    );
    if (snap) {
      this.camera.position.copy(this.desiredCamera);
      this.lookTarget.copy(ahead);
    } else {
      this.camera.position.lerp(this.desiredCamera, smooth(6, dt));
      this.lookTarget.lerp(ahead, smooth(9, dt));
    }
    this.camera.lookAt(this.lookTarget);
    const fov = 58 + (k.speed / 27) * 6;
    this.camera.fov += (fov - this.camera.fov) * (snap ? 1 : smooth(3, dt));
    this.camera.updateProjectionMatrix();
  }

  private updateHud(): void {
    const k = this.kart;
    const road = this.track.nearest(k.x, k.z);
    const wrongWay = Math.cos(k.heading - road.frame.heading) < -0.3;
    this.hud?.update({
      distance: Math.max(0, this.track.escapeDistance - road.distance),
      progress: Math.min(road.distance / this.track.escapeDistance, 1),
      timeLeft: Math.max(0, TIME_LIMIT - this.elapsed),
      best: this.best,
      speed: k.speed,
      steering: k.steering,
      x: k.x,
      z: k.z,
      health: this.health,
      destroyed: this.destroyed,
      enemiesDestroyed: this.enemiesDestroyed,
      enemies: this.pursuit.cars
        .filter((car) => car.active)
        .map((car) => ({
          x: car.root.position.x,
          z: car.root.position.z,
          behind: car.distance < road.distance,
        })),
      weapon: this.combat.ready,
      shieldTime: this.shieldTime,
      driftCharge: k.driftCharge,
      drifting: k.drifting,
      boostTime: k.boostTime,
      active: this.phase === 'racing' && !this.paused,
      handling:
        this.phase === 'finished'
          ? 'Run complete'
          : wrongWay
            ? 'Wrong way · turn around or recover'
            : k.drifting
              ? k.driftCharge >= 0.4
                ? 'Release Brake for boost!'
                : 'Drifting · keep turning to charge'
              : k.boostTime > 0 && !k.braking
                ? 'Boosting!'
                : k.braking
                  ? 'Braking'
                  : k.offRoad
                    ? 'Shoulder slows you down'
                    : 'Auto acceleration',
      notice: this.noticeTime > 0 ? this.notice : '',
    });
  }

  private resize(): void {
    if (!this.renderer || !this.root) return;
    const width = Math.max(1, this.root.clientWidth);
    const height = Math.max(1, this.root.clientHeight);
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }
}

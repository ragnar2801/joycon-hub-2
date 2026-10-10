import * as THREE from 'three';
import type { ControllerInput, GameContext, MiniGame } from '@joyconhub/game-sdk';
import { SoundKit } from './audio.ts';
import { RingCourse, type CourseRing } from './course.ts';
import { Clouds, Explosion } from './effects.ts';
import { TUNING, createFlightState, stepFlight, type FlightState } from './flight.ts';
import { Hud } from './hud.ts';
import { approach, clamp, forwardVector, mulberry32 } from './math.ts';
import { buildPlane } from './plane.ts';
import { TerrainField } from './terrain.ts';
import { World } from './world.ts';

type Phase = 'countdown' | 'flying' | 'crashed' | 'over';

const COUNTDOWN_SEC = 3;
const START_TIME = 60;
const RING_TIME_BONUS = 3;
const MAX_COMBO = 5;
const SKY = 0x8fd3ff;
const BEST_KEY = 'joyconhub:sky-tilt:best';

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(v: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(v));
  } catch {
    /* storage unavailable */
  }
}

interface Fading {
  mesh: THREE.Mesh;
  t: number;
}

export class SkyTiltGame implements MiniGame {
  private ctx!: GameContext;
  private container!: HTMLElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(65, 1, 0.5, 4000);
  private sun = new THREE.DirectionalLight(0xffffff, 1.7);
  private seed = Math.floor(Math.random() * 1e9);
  private field = new TerrainField(this.seed);
  private world = new World(this.field);
  private plane = buildPlane();
  private explosion = new Explosion();
  private clouds = new Clouds();
  private sound = new SoundKit();
  private hud: Hud | null = null;
  private course = new RingCourse(
    (x, z) => this.field.clearanceAt(x, z),
    mulberry32(this.seed ^ 0x5bd1e995),
  );
  private ringGeo = new THREE.TorusGeometry(15, 1.6, 10, 40);
  private ringMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x6688ff,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.75,
  });
  private targetMat = new THREE.MeshStandardMaterial({
    color: 0xffd23f,
    emissive: 0xffa000,
    emissiveIntensity: 0.8,
  });
  private ringMeshes = new Map<number, THREE.Mesh>();
  private fading: Fading[] = [];
  private flight: FlightState = createFlightState();
  private phase: Phase = 'countdown';
  private phaseTime = 0;
  private timeLeft = START_TIME;
  private score = 0;
  private combo = 0;
  private best = loadBest();
  private crashPoint = new THREE.Vector3();
  private resizeObserver: ResizeObserver | null = null;
  private tmp = new THREE.Vector3();
  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'm' || e.key === 'M') this.sound.toggleMute();
  };

  mount(container: HTMLElement, ctx: GameContext): void {
    this.ctx = ctx;
    this.container = container;
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.style.overflow = 'hidden';

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      container.innerHTML = `<div style="display:grid;place-items:center;height:100%;color:#fff;font-size:20px;text-align:center;padding:24px">
        WebGL is not available in this browser, so Sky Tilt can't run here.<br>Try an up-to-date Chrome, Edge, Firefox or Safari.</div>`;
      return;
    }
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.domElement.style.display = 'block';
    container.appendChild(r.domElement);

    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 500, 1900);
    this.scene.add(new THREE.HemisphereLight(0xe6f6ff, 0x4a6b3a, 1.15));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -40;
    sc.right = sc.top = 40;
    sc.near = 1;
    sc.far = 600;
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(this.world.group, this.plane.root, this.explosion.group, this.clouds.group);
    this.plane.root.rotation.order = 'YXZ';

    this.hud = new Hud(container);
    this.sound.start();
    window.addEventListener('keydown', this.onKey);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.restart();
  }

  restart(): void {
    this.flight = createFlightState(0, 120, 0, 0);
    this.world.prime(0, 0);
    this.course.reset({ x: 0, y: 120, z: 0 }, 0);
    for (const mesh of this.ringMeshes.values()) this.scene.remove(mesh);
    this.ringMeshes.clear();
    for (const f of this.fading) this.removeFading(f);
    this.fading = [];
    this.explosion.clear();
    this.plane.root.visible = true;
    this.score = 0;
    this.combo = 0;
    this.timeLeft = START_TIME;
    this.setPhase('countdown');
    this.placeCamera(1);
  }

  update(dt: number): void {
    if (!this.renderer || !this.hud) return;
    this.phaseTime += dt;
    const input = this.ctx.input();
    const f = this.flight;

    switch (this.phase) {
      case 'countdown': {
        stepFlight(
          f,
          { roll: 0, pitch: 0, yawRate: 0, throttle: input.throttle, boost: false },
          dt,
        );
        const n = Math.ceil(COUNTDOWN_SEC - this.phaseTime);
        this.hud.message(String(n), 'Hold your phone steady…');
        if (this.phaseTime >= COUNTDOWN_SEC) {
          this.setPhase('flying');
          this.ctx.emit({ kind: 'start', vibrate: [60] });
        }
        break;
      }
      case 'flying':
        this.fly(input, dt);
        break;
      case 'crashed':
        if (this.phaseTime > 2.2) this.gameOver('You crashed');
        break;
      case 'over':
        break;
    }

    this.explosion.update(dt);
    this.world.update(f.x, f.z);
    this.clouds.update(this.plane.root.position);
    this.syncRings(dt);
    this.updatePlaneMesh(dt);
    this.placeCamera(dt);
    this.updateHud();
    this.sound.engine(
      (f.speed - TUNING.minSpeed) / (TUNING.maxSpeed * TUNING.boostMultiplier - TUNING.minSpeed),
      this.phase === 'flying' || this.phase === 'countdown',
    );
    this.renderer.render(this.scene, this.camera);
  }

  pause(): void {
    this.sound.suspend();
  }

  resume(): void {
    this.sound.resume();
  }

  unmount(): void {
    window.removeEventListener('keydown', this.onKey);
    this.resizeObserver?.disconnect();
    this.sound.dispose();
    this.hud?.dispose();
    this.world.dispose();
    this.plane.dispose();
    this.explosion.dispose();
    this.clouds.dispose();
    this.ringGeo.dispose();
    this.ringMat.dispose();
    this.targetMat.dispose();
    for (const f of this.fading) (f.mesh.material as THREE.Material).dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.renderer = null;
  }

  // -------------------------------------------------------------------------------------------

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseTime = 0;
    if (p === 'flying') {
      this.hud?.message('');
      this.hud?.pop('GO!');
    }
  }

  private fly(input: ControllerInput, dt: number): void {
    const f = this.flight;
    const prev = { x: f.x, y: f.y, z: f.z };
    stepFlight(
      f,
      {
        roll: input.roll,
        pitch: input.pitch,
        yawRate: input.yawRate,
        throttle: input.throttle,
        boost: !!input.buttons.boost,
      },
      dt,
    );

    const res = this.course.update(prev, f);
    for (const ring of res.passed) this.onRingPassed(ring);
    if (res.missed.length) this.combo = 0;
    for (const ring of res.missed) this.fadeRing(ring, 0xff4d4d);
    if (res.rebuilt) this.hud?.pop('New course ahead');

    if (f.y < this.field.groundAt(f.x, f.z) + 1.5) {
      this.crash();
      return;
    }
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.gameOver("Time's up");
    }
  }

  private onRingPassed(ring: CourseRing): void {
    this.combo = Math.min(this.combo + 1, MAX_COMBO);
    const points = 100 * this.combo;
    this.score += points;
    this.timeLeft = Math.min(this.timeLeft + RING_TIME_BONUS, 99);
    this.hud?.pop(`+${points}`);
    this.sound.chime(this.combo);
    this.fadeRing(ring, 0x4dff88);
    this.ctx.emit({ kind: 'score', score: this.score, message: `+${points}`, vibrate: [30] });
  }

  private crash(): void {
    const f = this.flight;
    this.crashPoint.set(f.x, Math.max(f.y, this.field.groundAt(f.x, f.z)), f.z);
    const fwd = forwardVector(f.yaw, f.pitch);
    this.explosion.trigger(
      this.crashPoint,
      this.tmp.set(fwd.x, fwd.y, fwd.z).multiplyScalar(f.speed),
    );
    this.plane.root.visible = false;
    this.sound.crash();
    this.combo = 0;
    this.setPhase('crashed');
    this.hud?.message('CRASH!');
    this.ctx.emit({ kind: 'crash', score: this.score, vibrate: [250, 80, 350] });
  }

  private gameOver(reason: string): void {
    if (this.score > this.best) {
      this.best = this.score;
      saveBest(this.best);
    }
    this.setPhase('over');
    this.hud?.message(
      'GAME OVER',
      `${reason} · Score ${this.score} · Best ${this.best}<br>Tap “Play again” on your phone`,
    );
    this.ctx.emit({
      kind: 'gameover',
      score: this.score,
      best: this.best,
      message: reason,
      vibrate: [120, 60, 120],
    });
  }

  private fadeRing(ring: CourseRing, color: number): void {
    const mesh = this.ringMeshes.get(ring.id);
    if (!mesh) return;
    this.ringMeshes.delete(ring.id);
    mesh.material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    this.fading.push({ mesh, t: 0 });
  }

  private removeFading(f: Fading): void {
    this.scene.remove(f.mesh);
    (f.mesh.material as THREE.Material).dispose();
  }

  private syncRings(dt: number): void {
    const target = this.course.target;
    const live = new Set<number>();
    for (const ring of this.course.rings) {
      live.add(ring.id);
      let mesh = this.ringMeshes.get(ring.id);
      if (!mesh) {
        mesh = new THREE.Mesh(this.ringGeo, this.ringMat);
        mesh.position.set(ring.pos.x, ring.pos.y, ring.pos.z);
        mesh.lookAt(
          this.tmp.set(
            ring.pos.x + ring.normal.x,
            ring.pos.y + ring.normal.y,
            ring.pos.z + ring.normal.z,
          ),
        );
        this.scene.add(mesh);
        this.ringMeshes.set(ring.id, mesh);
      }
      const isTarget = ring === target;
      mesh.material = isTarget ? this.targetMat : this.ringMat;
      mesh.scale.setScalar(isTarget ? 1 + Math.sin(performance.now() / 180) * 0.04 : 1);
    }
    for (const [id, mesh] of this.ringMeshes) {
      if (!live.has(id)) {
        this.scene.remove(mesh);
        this.ringMeshes.delete(id);
      }
    }
    this.fading = this.fading.filter((f) => {
      f.t += dt;
      f.mesh.scale.setScalar(1 + f.t * 1.5);
      (f.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - f.t * 1.6);
      if (f.t > 0.6) {
        this.removeFading(f);
        return false;
      }
      return true;
    });
  }

  private updatePlaneMesh(dt: number): void {
    const f = this.flight;
    const root = this.plane.root;
    root.position.set(f.x, f.y, f.z);
    root.rotation.set(f.pitch, f.yaw, -f.roll);
    this.plane.propeller.rotation.z += f.speed * dt * 0.6;
    this.sun.position.set(f.x + 120, f.y + 250, f.z + 80);
    this.sun.target.position.set(f.x, f.y, f.z);
  }

  private placeCamera(dt: number): void {
    const f = this.flight;
    const cam = this.camera;
    if (this.phase === 'crashed' || this.phase === 'over') {
      // Slow orbit around the wreck.
      const a = this.phaseTime * 0.25 + f.yaw;
      const desired = this.tmp.set(
        this.crashPoint.x + Math.sin(a) * 60,
        this.crashPoint.y + 30,
        this.crashPoint.z + Math.cos(a) * 60,
      );
      cam.position.lerp(desired, approach(1.5, dt));
      cam.lookAt(this.crashPoint);
      return;
    }
    const back = forwardVector(f.yaw, f.pitch * 0.4);
    const desired = this.tmp.set(f.x - back.x * 28, f.y - back.y * 28 + 8, f.z - back.z * 28);
    cam.position.lerp(desired, approach(5, dt));
    const ground = this.field.groundAt(cam.position.x, cam.position.z) + 3;
    if (cam.position.y < ground) cam.position.y = ground;
    const ahead = forwardVector(f.yaw, f.pitch);
    cam.lookAt(f.x + ahead.x * 30, f.y + ahead.y * 30 + 3, f.z + ahead.z * 30);

    const fov = 65 + (f.boosting ? 10 : 0) + clamp((f.speed - 70) / 10, 0, 6);
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * approach(4, dt);
      cam.updateProjectionMatrix();
    }
  }

  private updateHud(): void {
    const hud = this.hud!;
    const f = this.flight;
    const ground = this.field.groundAt(f.x, f.z);
    hud.stats({
      score: this.score,
      combo: this.combo,
      time: this.timeLeft,
      speed: f.speed,
      alt: f.y - ground,
      boost: f.boost,
      boosting: f.boosting,
      danger: this.phase === 'flying' && f.y - ground < 25 && f.pitch < 0.05,
    });

    const target = this.course.target;
    if (!target || this.phase !== 'flying') {
      hud.setMarker(false);
      return;
    }
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const v = this.tmp.set(target.pos.x, target.pos.y, target.pos.z).project(this.camera);
    const behind = v.z > 1;
    let sx = ((v.x + 1) / 2) * w;
    let sy = ((1 - v.y) / 2) * h;
    const distance = Math.hypot(target.pos.x - f.x, target.pos.y - f.y, target.pos.z - f.z);
    const margin = 50;
    if (!behind && sx > margin && sx < w - margin && sy > margin && sy < h - margin) {
      hud.setMarker(true, sx, sy, null, distance);
      return;
    }
    let dx = sx - w / 2;
    let dy = sy - h / 2;
    if (behind) {
      dx = -dx;
      dy = -dy;
    }
    const scale = Math.min(
      (w / 2 - margin) / Math.abs(dx || 1e-6),
      (h / 2 - margin) / Math.abs(dy || 1e-6),
    );
    sx = w / 2 + dx * scale;
    sy = h / 2 + dy * scale;
    hud.setMarker(true, sx, sy, Math.atan2(dy, dx) + Math.PI / 2, distance);
  }

  private resize(): void {
    if (!this.renderer) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}

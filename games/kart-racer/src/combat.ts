import * as THREE from 'three';
import type { KartState } from './driving.ts';
import { EscapeRoute } from './track.ts';

export interface CombatTarget {
  root: THREE.Group;
  kind: 'block' | 'enemy';
  radius: number;
  health: number;
  maxHealth: number;
  active: boolean;
}

interface Shot {
  mesh: THREE.Mesh;
  vx: number;
  vz: number;
  life: number;
}

interface Burst {
  root: THREE.Group;
  age: number;
}

export interface BlastHit {
  target: CombatTarget;
  destroyed: boolean;
}

const SHOT_INTERVAL = 0.24;

/** A fixed-size projectile/effect pool, shared by destructible blocks and enemy cars. */
export class Battlefield {
  readonly group = new THREE.Group();
  readonly blocks: CombatTarget[] = [];
  private shots: Shot[] = [];
  private bursts: Burst[] = [];
  private cooldown = 0;

  constructor(track: EscapeRoute) {
    const crateGeo = new THREE.BoxGeometry(2.7, 2.1, 2.4);
    const stripeGeo = new THREE.BoxGeometry(2.78, 0.24, 2.48);
    const crateMat = new THREE.MeshStandardMaterial({ color: 0xe8ab61, roughness: 0.9 });
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0xef896f, roughness: 0.9 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xfff4d6 });
    for (let row = 0; 130 + row * 85 < track.escapeDistance - 50; row++) {
      // Every row leaves at least one lane open, so firing is useful without being compulsory.
      const lanes =
        row % 4 === 0 ? [0] : row % 4 === 1 ? [-5, 5] : row % 4 === 2 ? [-5, 0] : [0, 5];
      const frame = track.frame(130 + row * 85);
      for (const lane of lanes) {
        const armored = row % 3 === 2;
        const root = new THREE.Group();
        root.position.copy(frame.center).addScaledVector(frame.right, lane);
        root.rotation.y = frame.heading;
        const body = new THREE.Mesh(crateGeo, armored ? barrierMat : crateMat);
        body.position.y = 1.1;
        body.castShadow = body.receiveShadow = true;
        root.add(body);
        for (const y of armored ? [0.65, 1.6] : [1.1]) {
          const stripe = new THREE.Mesh(stripeGeo, stripeMat);
          stripe.position.y = y;
          root.add(stripe);
        }
        const maxHealth = armored ? 2 : 1;
        this.blocks.push({
          root,
          radius: 1.75,
          health: maxHealth,
          maxHealth,
          active: true,
          kind: 'block',
        });
        this.group.add(root);
      }
    }
    const shotGeo = new THREE.SphereGeometry(0.27, 8, 6);
    const shotMat = new THREE.MeshBasicMaterial({ color: 0xffd465 });
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(shotGeo, shotMat);
      mesh.scale.set(0.8, 0.8, 2.2);
      mesh.visible = false;
      this.shots.push({ mesh, vx: 0, vz: 0, life: 0 });
      this.group.add(mesh);
    }
    const shardGeo = new THREE.IcosahedronGeometry(0.27, 0);
    const shardMat = new THREE.MeshBasicMaterial({ color: 0xffcc6a });
    const ringGeo = new THREE.TorusGeometry(1, 0.06, 4, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xfff1ac });
    for (let i = 0; i < 12; i++) {
      const root = new THREE.Group();
      for (let n = 0; n < 7; n++) root.add(new THREE.Mesh(shardGeo, shardMat));
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      root.add(ring);
      root.visible = false;
      this.bursts.push({ root, age: 1 });
      this.group.add(root);
    }
  }

  get ready(): number {
    return 1 - this.cooldown / SHOT_INTERVAL;
  }

  reset(): void {
    this.clearShots();
    for (const target of this.blocks) {
      target.active = target.root.visible = true;
      target.health = target.maxHealth;
      target.root.scale.setScalar(1);
    }
    for (const burst of this.bursts) {
      burst.age = 1;
      burst.root.visible = false;
    }
  }

  clearShots(): void {
    this.cooldown = 0;
    for (const shot of this.shots) {
      shot.life = 0;
      shot.mesh.visible = false;
    }
  }

  update(dt: number, kart: KartState, firing: boolean, enemies: CombatTarget[] = []): BlastHit[] {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (firing && this.cooldown === 0) this.fire(kart);
    const hits: BlastHit[] = [];
    const targets = [...this.blocks, ...enemies];
    for (const shot of this.shots) {
      if (shot.life <= 0) continue;
      const x = shot.mesh.position.x;
      const z = shot.mesh.position.z;
      const dx = shot.vx * dt;
      const dz = shot.vz * dt;
      let first: CombatTarget | null = null;
      let firstT = Infinity;
      // Sweep the entire segment: fast shots cannot tunnel through narrow targets.
      for (const target of targets) {
        if (!target.active) continue;
        const tx = target.root.position.x - x;
        const tz = target.root.position.z - z;
        const t = THREE.MathUtils.clamp((tx * dx + tz * dz) / (dx * dx + dz * dz || 1), 0, 1);
        if ((tx - dx * t) ** 2 + (tz - dz * t) ** 2 > (target.radius + 0.27) ** 2) continue;
        if (t < firstT) {
          first = target;
          firstT = t;
        }
      }
      if (first) {
        first.health--;
        const destroyed = first.health <= 0;
        if (destroyed) first.active = first.root.visible = false;
        this.burst(first.root.position, destroyed);
        hits.push({ target: first, destroyed });
        shot.life = 0;
      } else {
        shot.mesh.position.x += dx;
        shot.mesh.position.z += dz;
        shot.life -= dt;
      }
      shot.mesh.visible = shot.life > 0;
    }
    for (const burst of this.bursts) {
      if (burst.age >= 0.55) continue;
      burst.age += dt;
      burst.root.visible = burst.age < 0.55;
      burst.root.children.forEach((shard, i) => {
        const a = (i * Math.PI * 2) / 7;
        if (i < 7) {
          const spread = burst.age * 9;
          shard.position.set(
            Math.cos(a) * spread,
            0.5 + Math.sin((burst.age / 0.55) * Math.PI) * 2,
            Math.sin(a) * spread,
          );
          shard.rotation.set(burst.age * 5, a, burst.age * 3);
          shard.scale.setScalar(Math.max(0, 1 - burst.age / 0.55));
        } else shard.scale.setScalar(1 + burst.age * 7);
      });
    }
    return hits;
  }

  blockCollision(kart: KartState): CombatTarget | null {
    for (const block of this.blocks) {
      if (!block.active) continue;
      let dx = kart.x - block.root.position.x;
      let dz = kart.z - block.root.position.z;
      const length = Math.hypot(dx, dz);
      const radius = block.radius + 1.05;
      if (length >= radius) continue;
      if (length < 0.001) {
        dx = -Math.sin(kart.heading);
        dz = -Math.cos(kart.heading);
      } else {
        dx /= length;
        dz /= length;
      }
      kart.x = block.root.position.x + dx * radius;
      kart.z = block.root.position.z + dz * radius;
      kart.speed = Math.min(kart.speed * 0.4, 8);
      return block;
    }
    return null;
  }

  private fire(kart: KartState): void {
    const shot = this.shots.find((s) => s.life <= 0);
    if (!shot) return;
    const fx = Math.sin(kart.heading);
    const fz = Math.cos(kart.heading);
    shot.mesh.position.set(kart.x + fx * 2, 1.1, kart.z + fz * 2);
    shot.mesh.rotation.y = kart.heading;
    shot.vx = fx * 100;
    shot.vz = fz * 100;
    shot.life = 1.05;
    shot.mesh.visible = true;
    this.cooldown = SHOT_INTERVAL;
  }

  private burst(position: THREE.Vector3, destroyed: boolean): void {
    const burst = this.bursts.find((b) => b.age >= 0.55) ?? this.bursts[0]!;
    burst.age = 0;
    burst.root.position.copy(position);
    burst.root.scale.setScalar(destroyed ? 1 : 0.5);
    burst.root.visible = true;
  }
}

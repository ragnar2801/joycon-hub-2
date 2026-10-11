import * as THREE from 'three';
import type { CombatTarget } from './combat.ts';
import type { KartState } from './driving.ts';
import { smooth } from './driving.ts';
import { buildKart } from './scene.ts';
import { EscapeRoute } from './track.ts';

export interface EnemyCar extends CombatTarget {
  model: ReturnType<typeof buildKart>;
  mode: 'blocker' | 'chaser';
  distance: number;
  side: number;
  speed: number;
  age: number;
  laneChoice: number;
  contactCooldown: number;
  beacon: THREE.Mesh;
}

/** Blockers cut in ahead; faster pursuers overtake on a side, then cut in. */
export class Pursuit {
  readonly group = new THREE.Group();
  readonly cars: EnemyCar[] = [];
  private spawnClock = 0;
  private wave = 0;

  constructor(
    private readonly track: EscapeRoute,
    private readonly blocks: CombatTarget[],
  ) {
    const beaconGeo = new THREE.SphereGeometry(0.22, 8, 6);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xffcf73,
      emissive: 0xf0a340,
      emissiveIntensity: 0.55,
    });
    for (let i = 0; i < 5; i++) {
      const model = buildKart(i % 2 ? 0xa28cbe : 0x709caf);
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(0, 2.3, -0.4);
      model.root.add(beacon);
      model.root.visible = false;
      this.cars.push({
        root: model.root,
        model,
        beacon,
        kind: 'enemy',
        radius: 1.5,
        health: 2,
        maxHealth: 2,
        active: false,
        mode: 'blocker',
        distance: 0,
        side: 0,
        speed: 0,
        age: 0,
        laneChoice: i % 2 ? -1 : 1,
        contactCooldown: 0,
      });
      this.group.add(model.root);
    }
  }

  reset(): void {
    this.spawnClock = this.wave = 0;
    for (const car of this.cars) {
      car.active = car.root.visible = false;
      car.health = car.maxHealth;
      car.contactCooldown = car.age = 0;
    }
  }

  regroup(): void {
    for (const car of this.cars) car.active = car.root.visible = false;
    this.spawnClock = 3;
  }

  update(dt: number, kart: KartState): { spawned: boolean; contact: EnemyCar | null } {
    const player = this.track.nearest(kart.x, kart.z);
    this.spawnClock = Math.max(0, this.spawnClock - dt);
    let spawned = false;
    if (
      player.distance > 200 &&
      player.distance < this.track.escapeDistance - 110 &&
      this.spawnClock === 0
    ) {
      const car = this.cars.find((c) => !c.active);
      if (car) {
        this.spawn(car, player.distance, player.side);
        this.spawnClock = player.distance > 1100 ? 5 : 7;
        spawned = true;
      }
    }
    let contact: EnemyCar | null = null;
    for (const car of this.cars) {
      if (!car.active) continue;
      car.age += dt;
      car.contactCooldown = Math.max(0, car.contactCooldown - dt);
      const gap = car.distance - player.distance;
      if (car.mode === 'chaser' && gap > 7) car.mode = 'blocker';
      const targetSpeed = car.mode === 'chaser' ? 32 : gap > 35 ? 18 : gap < -8 ? 29 : 20;
      car.speed += (targetSpeed - car.speed) * smooth(2, dt);
      let targetSide = car.mode === 'chaser' ? player.side + car.laneChoice * 4.3 : player.side;
      // Telegraph lane changes instead of snapping onto the player.
      if (car.age < 1.2) targetSide = car.side;
      targetSide = this.avoidBlocks(car, THREE.MathUtils.clamp(targetSide, -6.5, 6.5));
      const previousSide = car.side;
      car.side += THREE.MathUtils.clamp(targetSide - car.side, -2.4 * dt, 2.4 * dt);
      car.distance += car.speed * dt;
      if (
        car.distance < player.distance - 95 ||
        car.distance > this.track.escapeDistance + 25 ||
        car.distance > player.distance + 180
      ) {
        car.active = car.root.visible = false;
        continue;
      }
      const frame = this.track.frame(car.distance);
      car.root.position.copy(frame.center).addScaledVector(frame.right, car.side);
      car.root.position.y = 0.035;
      const lateralSpeed = dt > 0 ? (car.side - previousSide) / dt : 0;
      const lean = THREE.MathUtils.clamp(lateralSpeed, -2.4, 2.4) * 0.025;
      car.root.rotation.set(0, frame.heading, -lean, 'YXZ');
      car.model.frontWheels.forEach((wheel) => {
        wheel.rotation.y = lean * 3;
      });
      car.model.wheels.forEach((wheel) => {
        wheel.rotation.x += (car.speed * dt) / 0.43;
      });
      car.beacon.scale.setScalar(0.85 + Math.sin(car.age * 8) * 0.15);
      const dx = kart.x - car.root.position.x;
      const dz = kart.z - car.root.position.z;
      if (Math.hypot(dx, dz) < 2.6 && car.contactCooldown === 0) {
        car.contactCooldown = 1.3;
        const side = Math.sign(player.side - car.side) || -car.laneChoice;
        kart.x += frame.right.x * side * 1.2;
        kart.z += frame.right.z * side * 1.2;
        kart.speed *= 0.65;
        car.side = THREE.MathUtils.clamp(car.side - side * 1.5, -7, 7);
        contact = car;
      }
    }
    return { spawned, contact };
  }

  private spawn(car: EnemyCar, distance: number, side: number): void {
    car.mode = this.wave++ % 3 === 1 ? 'chaser' : 'blocker';
    car.model.bodyMaterial.color.setHex(car.mode === 'chaser' ? 0xa28cbe : 0x709caf);
    car.distance = car.mode === 'chaser' ? distance - 28 : distance + 48;
    car.side =
      car.mode === 'chaser'
        ? THREE.MathUtils.clamp(side + car.laneChoice * 4.3, -6.5, 6.5)
        : car.laneChoice * 5;
    car.speed = car.mode === 'chaser' ? 30 : 18;
    car.health = car.maxHealth;
    car.age = car.contactCooldown = 0;
    car.active = car.root.visible = true;
    const frame = this.track.frame(car.distance);
    car.root.position.copy(frame.center).addScaledVector(frame.right, car.side);
    car.root.position.y = 0.035;
    car.root.rotation.set(0, frame.heading, 0);
  }

  private avoidBlocks(car: EnemyCar, preferred: number): number {
    const frame = this.track.frame(car.distance);
    const ahead = this.blocks.filter((block) => {
      if (!block.active) return false;
      const dx = block.root.position.x - frame.center.x;
      const dz = block.root.position.z - frame.center.z;
      const forward = dx * frame.tangent.x + dz * frame.tangent.z;
      return forward > -2 && forward < 22;
    });
    if (!ahead.length) return preferred;
    const lanes = [preferred, -5, 0, 5].sort(
      (a, b) => Math.abs(a - preferred) - Math.abs(b - preferred),
    );
    return (
      lanes.find((lane) =>
        ahead.every((block) => {
          const side =
            (block.root.position.x - frame.center.x) * frame.right.x +
            (block.root.position.z - frame.center.z) * frame.right.z;
          return Math.abs(lane - side) > 3.2;
        }),
      ) ?? preferred
    );
  }
}

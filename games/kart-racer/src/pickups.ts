import * as THREE from 'three';
import { EscapeRoute } from './track.ts';

export type PickupKind = 'repair' | 'shield' | 'boost';
interface Pickup {
  root: THREE.Group;
  icon: THREE.Object3D;
  kind: PickupKind;
  active: boolean;
}

/** Pickups sit between blockage rows and are collected once per run. */
export class RoadPickups {
  readonly group = new THREE.Group();
  private items: Pickup[] = [];
  private age = 0;

  constructor(track: EscapeRoute) {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const ring = new THREE.TorusGeometry(1.05, 0.12, 6, 20);
    const colors = { repair: 0x6ab892, shield: 0x72bde5, boost: 0xffc957 };
    const kinds: PickupKind[] = ['boost', 'repair', 'shield'];
    for (let i = 0; 85 + i * 170 < track.escapeDistance - 60; i++) {
      const kind = kinds[i % 3]!;
      const mat = new THREE.MeshStandardMaterial({
        color: colors[kind],
        emissive: colors[kind],
        emissiveIntensity: 0.35,
        roughness: 0.4,
      });
      const root = new THREE.Group();
      const frame = track.frame(85 + i * 170);
      root.position.copy(frame.center).addScaledVector(frame.right, i % 2 ? -5 : 5);
      root.rotation.y = frame.heading;
      const icon = new THREE.Group();
      if (kind === 'boost') {
        // Two flat chevrons read as an acceleration pad from the chase camera.
        for (const z of [-0.65, 0.65])
          for (const side of [-1, 1]) {
            const stripe = new THREE.Mesh(box, mat);
            stripe.scale.set(0.35, 0.08, 1.3);
            stripe.position.set(side * 0.45, 0.06, z);
            stripe.rotation.y = side * -0.65;
            icon.add(stripe);
          }
        const base = new THREE.Mesh(
          new THREE.BoxGeometry(3, 0.04, 3.5),
          new THREE.MeshStandardMaterial({ color: 0x576e73 }),
        );
        base.position.y = 0.025;
        root.add(base);
      } else {
        const halo = new THREE.Mesh(ring, mat);
        icon.add(halo);
        if (kind === 'repair') {
          for (const size of [
            [1.2, 0.35, 0.3],
            [0.35, 1.2, 0.3],
          ]) {
            const arm = new THREE.Mesh(box, mat);
            arm.scale.set(size[0]!, size[1]!, size[2]!);
            icon.add(arm);
          }
        } else {
          const shield = new THREE.Mesh(new THREE.OctahedronGeometry(0.65), mat);
          shield.scale.set(0.8, 1.2, 0.5);
          icon.add(shield);
        }
        icon.position.y = 1.6;
      }
      root.add(icon);
      this.group.add(root);
      this.items.push({ root, icon, kind, active: true });
    }
  }

  reset(): void {
    this.age = 0;
    for (const item of this.items) item.active = item.root.visible = true;
  }

  animate(dt: number): void {
    this.age += dt;
    for (const item of this.items) {
      if (!item.active || item.kind === 'boost') continue;
      item.icon.position.y = 1.6 + Math.sin(this.age * 3 + item.root.position.z) * 0.2;
      item.icon.rotation.y = this.age * 1.8;
    }
  }

  collect(x0: number, z0: number, x1: number, z1: number, health: number): PickupKind[] {
    const collected: PickupKind[] = [];
    const dx = x1 - x0;
    const dz = z1 - z0;
    for (const item of this.items) {
      if (!item.active || (item.kind === 'repair' && health >= 100)) continue;
      const x = item.root.position.x - x0;
      const z = item.root.position.z - z0;
      const t = THREE.MathUtils.clamp((x * dx + z * dz) / (dx * dx + dz * dz || 1), 0, 1);
      if ((x - dx * t) ** 2 + (z - dz * t) ** 2 > 2.3 ** 2) continue;
      item.active = item.root.visible = false;
      collected.push(item.kind);
    }
    return collected;
  }
}

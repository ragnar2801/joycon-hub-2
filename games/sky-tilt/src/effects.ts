import * as THREE from 'three';

/** Debris burst for crashes. */
export class Explosion {
  readonly group = new THREE.Group();
  private parts: { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3 }[] = [];
  private geo = new THREE.BoxGeometry(1, 1, 1);
  private mats = [0xff7b25, 0xffd23f, 0x3a3a3a, 0xe8433a].map(
    (color) => new THREE.MeshBasicMaterial({ color, transparent: true }),
  );
  private age = 0;
  active = false;

  trigger(at: THREE.Vector3, velocity: THREE.Vector3): void {
    this.clear();
    this.active = true;
    this.age = 0;
    for (let i = 0; i < 60; i++) {
      const mesh = new THREE.Mesh(this.geo, this.mats[i % this.mats.length]!);
      mesh.position.copy(at);
      const s = 0.6 + Math.random() * 2.2;
      mesh.scale.setScalar(s);
      const dir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() * 0.9,
        Math.random() - 0.5,
      ).normalize();
      const vel = dir.multiplyScalar(15 + Math.random() * 45).addScaledVector(velocity, 0.25);
      const spin = new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(8);
      this.parts.push({ mesh, vel, spin });
      this.group.add(mesh);
    }
  }

  update(dt: number): void {
    if (!this.active) return;
    this.age += dt;
    const fade = Math.max(0, 1 - this.age / 2.5);
    for (const m of this.mats) m.opacity = fade;
    for (const p of this.parts) {
      p.vel.y -= 30 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.spin.x * dt;
      p.mesh.rotation.y += p.spin.y * dt;
    }
    if (this.age > 2.5) this.clear();
  }

  clear(): void {
    for (const p of this.parts) this.group.remove(p.mesh);
    this.parts = [];
    this.active = false;
  }

  dispose(): void {
    this.clear();
    this.geo.dispose();
    this.mats.forEach((m) => m.dispose());
  }
}

/** Puffy low-poly clouds that wrap around the player. */
export class Clouds {
  readonly group = new THREE.Group();
  private geo = new THREE.IcosahedronGeometry(1, 0);
  private mat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    flatShading: true,
    transparent: true,
    opacity: 0.92,
  });
  private clouds: THREE.Group[] = [];
  private readonly range = 1600;

  constructor(count = 28) {
    for (let i = 0; i < count; i++) {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(Math.random() * 4);
      for (let p = 0; p < puffs; p++) {
        const puff = new THREE.Mesh(this.geo, this.mat);
        puff.position.set(p * 14 - puffs * 7, Math.random() * 6, (Math.random() - 0.5) * 14);
        puff.scale.setScalar(10 + Math.random() * 10);
        cloud.add(puff);
      }
      cloud.position.set(
        (Math.random() - 0.5) * this.range * 2,
        260 + Math.random() * 140,
        (Math.random() - 0.5) * this.range * 2,
      );
      this.clouds.push(cloud);
      this.group.add(cloud);
    }
  }

  update(center: THREE.Vector3): void {
    const r = this.range;
    for (const c of this.clouds) {
      if (c.position.x - center.x > r) c.position.x -= 2 * r;
      if (c.position.x - center.x < -r) c.position.x += 2 * r;
      if (c.position.z - center.z > r) c.position.z -= 2 * r;
      if (c.position.z - center.z < -r) c.position.z += 2 * r;
    }
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}

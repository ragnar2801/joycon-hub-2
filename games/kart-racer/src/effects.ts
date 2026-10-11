import * as THREE from 'three';
import type { KartState } from './driving.ts';

/** Fixed pools keep drifting and collision effects bounded during long runs. */
export class KartEffects {
  readonly group = new THREE.Group();
  private smoke: { mesh: THREE.Mesh; age: number }[] = [];
  private marks: { mesh: THREE.Mesh; age: number }[] = [];
  private sparks: { mesh: THREE.Mesh; velocity: THREE.Vector3; age: number }[] = [];
  private shield: THREE.Mesh;
  private jets: THREE.Mesh[] = [];
  private clock = 0;

  constructor() {
    const puff = new THREE.SphereGeometry(0.45, 6, 4);
    const mark = new THREE.PlaneGeometry(0.32, 0.8);
    for (let i = 0; i < 28; i++) {
      const mesh = new THREE.Mesh(
        puff,
        new THREE.MeshBasicMaterial({
          color: 0xf2f0dc,
          transparent: true,
          depthWrite: false,
          opacity: 0,
        }),
      );
      mesh.visible = false;
      this.smoke.push({ mesh, age: 1 });
      this.group.add(mesh);
    }
    for (let i = 0; i < 96; i++) {
      const mesh = new THREE.Mesh(
        mark,
        new THREE.MeshBasicMaterial({
          color: 0x34454a,
          transparent: true,
          depthWrite: false,
          opacity: 0,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.marks.push({ mesh, age: 6 });
      this.group.add(mesh);
    }
    const sparkGeo = new THREE.OctahedronGeometry(0.12);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffcc60 });
    for (let i = 0; i < 14; i++) {
      const mesh = new THREE.Mesh(sparkGeo, sparkMat);
      mesh.visible = false;
      this.sparks.push({ mesh, velocity: new THREE.Vector3(), age: 1 });
      this.group.add(mesh);
    }
    this.shield = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0x72c7ee,
        transparent: true,
        opacity: 0.16,
        wireframe: true,
        depthWrite: false,
      }),
    );
    this.shield.scale.set(1, 0.65, 1.1);
    this.shield.visible = false;
    this.group.add(this.shield);
    const flame = new THREE.ConeGeometry(0.24, 1.6, 8);
    flame.rotateX(-Math.PI / 2);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffc957 });
    for (const x of [-0.65, 0.65]) {
      const jet = new THREE.Mesh(flame, flameMat);
      jet.userData.side = x;
      jet.visible = false;
      this.jets.push(jet);
      this.group.add(jet);
    }
  }

  reset(): void {
    this.clock = 0;
    for (const puff of this.smoke) {
      puff.age = 1;
      puff.mesh.visible = false;
    }
    for (const mark of this.marks) {
      mark.age = 6;
      mark.mesh.visible = false;
    }
    for (const spark of this.sparks) {
      spark.age = 1;
      spark.mesh.visible = false;
    }
    this.shield.visible = false;
    this.jets.forEach((jet) => {
      jet.visible = false;
    });
  }

  impact(kart: KartState): void {
    for (const [i, spark] of this.sparks.entries()) {
      spark.age = 0;
      spark.mesh.position.set(kart.x, 0.8, kart.z);
      const angle = (i * Math.PI * 2) / this.sparks.length;
      spark.velocity.set(Math.cos(angle) * 6, 2 + (i % 3), Math.sin(angle) * 6);
      spark.mesh.visible = true;
    }
  }

  update(dt: number, kart: KartState, shieldTime: number, active: boolean): void {
    this.clock += dt;
    for (const puff of this.smoke) {
      puff.age += dt;
      puff.mesh.visible = puff.age < 0.75;
      if (!puff.mesh.visible) continue;
      puff.mesh.position.y += dt * 0.8;
      puff.mesh.scale.setScalar(0.4 + puff.age * 2);
      (puff.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - puff.age / 0.75) * 0.45;
    }
    for (const mark of this.marks) {
      mark.age += dt;
      mark.mesh.visible = mark.age < 5;
      (mark.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - mark.age / 5) * 0.4;
    }
    for (const spark of this.sparks) {
      spark.age += dt;
      spark.mesh.visible = spark.age < 0.45;
      if (!spark.mesh.visible) continue;
      spark.velocity.y -= dt * 12;
      spark.mesh.position.addScaledVector(spark.velocity, dt);
    }
    if (active && kart.drifting && this.clock >= 0.055) {
      this.clock = 0;
      for (const side of [-0.95, 0.95]) {
        const x = kart.x + Math.cos(kart.heading) * side - Math.sin(kart.heading);
        const z = kart.z - Math.sin(kart.heading) * side - Math.cos(kart.heading);
        const puff = this.smoke.find((p) => p.age >= 0.75);
        if (puff) {
          puff.age = 0;
          puff.mesh.position.set(x, 0.3, z);
        }
        const mark = this.marks.reduce((a, b) => (a.age > b.age ? a : b));
        mark.age = 0;
        mark.mesh.position.set(x, 0.035, z);
        mark.mesh.rotation.set(-Math.PI / 2, 0, -kart.heading);
      }
    }
    this.shield.visible =
      active && shieldTime > 0 && (shieldTime > 1.5 || Math.sin(shieldTime * 18) > 0);
    this.shield.position.set(kart.x, 1, kart.z);
    this.shield.rotation.y = this.clock;
    for (const jet of this.jets) {
      jet.visible = active && kart.boostTime > 0 && !kart.braking && !kart.offRoad;
      jet.position.set(
        kart.x + Math.cos(kart.heading) * jet.userData.side - Math.sin(kart.heading) * 2,
        0.65,
        kart.z - Math.sin(kart.heading) * jet.userData.side - Math.cos(kart.heading) * 2,
      );
      jet.rotation.y = kart.heading;
      jet.scale.z = 0.8 + Math.sin(this.clock * 50) * 0.2;
    }
  }
}

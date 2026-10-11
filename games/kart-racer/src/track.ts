import * as THREE from 'three';

export const ROAD_HALF = 9;
export const WALL_OFFSET = 13;
const SAMPLES = 720;

export interface TrackFrame {
  center: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  heading: number;
}

/** One-way route shared by scenery, collisions, escape checkpoints, and the map. */
export class EscapeRoute {
  readonly curve = new THREE.CatmullRomCurve3(
    [
      [0, 0],
      [0, 100],
      [50, 260],
      [-55, 430],
      [-70, 630],
      [45, 850],
      [70, 1040],
      [-40, 1240],
      [0, 1450],
      [30, 1660],
      [30, 1840],
    ].map(([x, z]) => new THREE.Vector3(x!, 0, z!)),
    false,
    'centripetal',
  );
  readonly length = this.curve.getLength();
  readonly escapeDistance = this.length - 65;
  readonly points = this.curve.getSpacedPoints(SAMPLES);

  frame(distance: number): TrackFrame {
    const p = (THREE.MathUtils.clamp(distance, 0, this.length) / this.length) * SAMPLES;
    const i = Math.min(Math.floor(p), SAMPLES - 1);
    const start = this.points[i]!;
    const end = this.points[i + 1]!;
    const center = start.clone().lerp(end, p - i);
    const tangent = end.clone().sub(start).normalize();
    return {
      center,
      tangent,
      right: new THREE.Vector3(tangent.z, 0, -tangent.x),
      heading: Math.atan2(tangent.x, tangent.z),
    };
  }

  nearest(x: number, z: number): { distance: number; side: number; frame: TrackFrame } {
    let best = Infinity;
    let distance = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const a = this.points[i]!;
      const b = this.points[i + 1]!;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const t = THREE.MathUtils.clamp(
        ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz),
        0,
        1,
      );
      const d = (x - a.x - dx * t) ** 2 + (z - a.z - dz * t) ** 2;
      if (d < best) {
        best = d;
        distance = ((i + t) / SAMPLES) * this.length;
      }
    }
    const frame = this.frame(distance);
    return {
      distance,
      side: (x - frame.center.x) * frame.right.x + (z - frame.center.z) * frame.right.z,
      frame,
    };
  }

  ribbon(inner: number, outer: number, height: number): THREE.BufferGeometry {
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const f = this.frame((i / SAMPLES) * this.length);
      for (const offset of [inner, outer]) {
        positions.push(f.center.x + f.right.x * offset, height, f.center.z + f.right.z * offset);
      }
      if (i < SAMPLES) {
        const n = i * 2;
        indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
}

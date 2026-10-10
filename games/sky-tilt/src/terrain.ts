import { createNoise2D } from 'simplex-noise';
import { lerp, mulberry32 } from './math.ts';

export const WATER_LEVEL = 0;

/** Procedural height field: rolling hills, ridged mountains, lakes, and a flat-ish spawn area. */
export class TerrainField {
  private readonly n: (x: number, y: number) => number;

  constructor(readonly seed: number) {
    this.n = createNoise2D(mulberry32(seed));
  }

  height(x: number, z: number): number {
    const n = this.n;
    const hills =
      0.55 * n(x * 0.0012, z * 0.0012) +
      0.3 * n(x * 0.003 + 100, z * 0.003) +
      0.15 * n(x * 0.008, z * 0.008 + 50);
    const ridge = 1 - Math.abs(n(x * 0.0007 + 300, z * 0.0007 - 200));
    let h = hills * 60 + Math.pow(ridge, 3) * 190 - 8;
    // Keep a low valley around the spawn point and along the starting heading (-Z), so a new
    // round never begins by flying straight into a mountain.
    const along = Math.max(-1600, Math.min(300, z));
    const d = Math.hypot(x, z - along);
    if (d < 550) h = lerp(Math.min(h, 25), h, Math.max(0, (d - 200) / 350));
    return h;
  }

  /** Height the plane collides with (water counts as ground). */
  groundAt(x: number, z: number): number {
    return Math.max(this.height(x, z), WATER_LEVEL);
  }

  /** Highest ground in a small neighbourhood; used to keep rings clear of hillsides. */
  clearanceAt(x: number, z: number, r = 30): number {
    let m = this.groundAt(x, z);
    for (const [dx, dz] of [
      [r, 0],
      [-r, 0],
      [0, r],
      [0, -r],
    ] as const) {
      m = Math.max(m, this.groundAt(x + dx, z + dz));
    }
    return m;
  }
}

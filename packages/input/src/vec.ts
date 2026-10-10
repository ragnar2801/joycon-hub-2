export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const DEG = Math.PI / 180;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Wrap an angle in degrees into (-180, 180]. */
export function wrapDeg(a: number): number {
  let r = ((((a + 180) % 360) + 360) % 360) - 180;
  if (r === -180) r = 180;
  return r;
}

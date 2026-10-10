import { clamp } from './vec.ts';

export interface AxisShape {
  /** degrees around neutral that count as zero */
  deadZone: number;
  /** degrees (beyond the dead zone start) that give full deflection */
  maxAngle: number;
  /** response exponent: 1 = linear, >1 = finer control near the centre */
  curve: number;
}

/** Degrees → -1..1 with dead zone, response curve and clamping. */
export function shapeAxis(deg: number, shape: AxisShape): number {
  const mag = Math.abs(deg) - shape.deadZone;
  if (mag <= 0) return 0;
  const range = Math.max(shape.maxAngle - shape.deadZone, 1e-6);
  const n = clamp(mag / range, 0, 1);
  return Math.sign(deg) * Math.pow(n, shape.curve);
}

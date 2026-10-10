/**
 * Arcade flight model. The phone's tilt sets a *target attitude* (bank and pitch) that the plane
 * eases towards, so a phone held at its calibrated neutral pose always means "fly level".
 * Banking turns the plane (bank-to-turn); the gyro twist adds a little rudder.
 */
import { DEG, approach, clamp, forwardVector, lerp } from './math.ts';

export interface FlightState {
  x: number;
  y: number;
  z: number;
  /** heading in radians, 0 = -Z, positive = turning left */
  yaw: number;
  /** radians, positive = nose up */
  pitch: number;
  /** radians, positive = banked right */
  roll: number;
  speed: number;
  /** boost energy 0..1 */
  boost: number;
  boosting: boolean;
}

export interface FlightControls {
  roll: number;
  pitch: number;
  yawRate: number;
  throttle: number;
  boost: boolean;
}

export const TUNING = {
  maxBankDeg: 65,
  bankResponse: 3.5,
  maxPitchDeg: 40,
  pitchResponse: 2.2,
  /** rad/s of heading change at 90° bank */
  turnRate: 1.3,
  rudderRate: 0.5,
  minSpeed: 45,
  maxSpeed: 105,
  boostMultiplier: 1.6,
  speedResponse: 1.2,
  /** extra speed when diving / lost when climbing */
  diveBonus: 30,
  boostDrainPerSec: 0.4,
  boostRechargePerSec: 0.1,
  minBoostToStart: 0.15,
  ceiling: 520,
};
export type Tuning = typeof TUNING;

export function createFlightState(x = 0, y = 150, z = 0, yaw = 0): FlightState {
  return {
    x,
    y,
    z,
    yaw,
    pitch: 0,
    roll: 0,
    speed: lerp(TUNING.minSpeed, TUNING.maxSpeed, 0.6),
    boost: 1,
    boosting: false,
  };
}

export function stepFlight(
  s: FlightState,
  c: FlightControls,
  dt: number,
  t: Tuning = TUNING,
): void {
  const targetRoll = clamp(c.roll, -1, 1) * t.maxBankDeg * DEG;
  s.roll += (targetRoll - s.roll) * approach(t.bankResponse, dt);

  const targetPitch = clamp(c.pitch, -1, 1) * t.maxPitchDeg * DEG;
  s.pitch += (targetPitch - s.pitch) * approach(t.pitchResponse, dt);

  s.yaw -= Math.sin(s.roll) * t.turnRate * dt;
  s.yaw -= clamp(c.yawRate, -1, 1) * t.rudderRate * dt;

  const canBoost = s.boost > (s.boosting ? 0 : t.minBoostToStart);
  s.boosting = c.boost && canBoost;
  if (s.boosting) s.boost = Math.max(0, s.boost - t.boostDrainPerSec * dt);
  else s.boost = Math.min(1, s.boost + t.boostRechargePerSec * dt);

  const base = lerp(t.minSpeed, t.maxSpeed, clamp(c.throttle, 0, 1));
  const target = base * (s.boosting ? t.boostMultiplier : 1) - Math.sin(s.pitch) * t.diveBonus;
  s.speed += (target - s.speed) * approach(t.speedResponse, dt);

  const f = forwardVector(s.yaw, s.pitch);
  s.x += f.x * s.speed * dt;
  s.y += f.y * s.speed * dt;
  s.z += f.z * s.speed * dt;
  if (s.y > t.ceiling) s.y = t.ceiling;
}

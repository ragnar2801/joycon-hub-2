import * as THREE from 'three';
import type { ControllerInput } from '@joyconhub/game-sdk';
import { EscapeRoute, ROAD_HALF, WALL_OFFSET } from './track.ts';

export interface KartState {
  x: number;
  z: number;
  heading: number;
  speed: number;
  steering: number;
  offRoad: boolean;
  braking: boolean;
  drifting: boolean;
  driftCharge: number;
  driftDirection: number;
  boostTime: number;
  driftBoost: boolean;
}

export function createKart(track: EscapeRoute, distance = 20): KartState {
  const f = track.frame(distance);
  return {
    x: f.center.x,
    z: f.center.z,
    heading: f.heading,
    speed: 0,
    steering: 0,
    offRoad: false,
    braking: false,
    drifting: false,
    driftCharge: 0,
    driftDirection: 0,
    boostTime: 0,
    driftBoost: false,
  };
}

export const smooth = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

export function cancelDrift(kart: KartState): void {
  kart.drifting = false;
  kart.driftCharge = 0;
  kart.driftDirection = 0;
}

export function grantBoost(kart: KartState, duration: number): void {
  kart.boostTime = Math.max(kart.boostTime, duration);
}

/** A forward-only arcade kart: tilt turns the wheels; releasing tilt straightens them. */
export function driveKart(
  kart: KartState,
  input: ControllerInput,
  track: EscapeRoute,
  dt: number,
): boolean {
  kart.steering += (THREE.MathUtils.clamp(input.roll, -1, 1) - kart.steering) * smooth(9, dt);
  kart.braking = !!input.buttons.brake;
  const road = track.nearest(kart.x, kart.z);
  kart.offRoad = Math.abs(road.side) > ROAD_HALF - 0.7;
  kart.driftBoost = false;
  kart.boostTime = Math.max(0, kart.boostTime - dt);
  const canDrift =
    input.connected &&
    !kart.offRoad &&
    kart.speed > 14 &&
    Math.cos(kart.heading - road.frame.heading) > 0.4;
  if (kart.drifting && !kart.braking) {
    if (canDrift && kart.driftCharge >= 0.4) {
      grantBoost(kart, kart.driftCharge >= 0.85 ? 1.8 : 1.1);
      kart.driftBoost = true;
    }
    cancelDrift(kart);
  } else if (
    !canDrift ||
    (kart.drifting &&
      (Math.abs(kart.steering) < 0.15 || Math.sign(kart.steering) !== kart.driftDirection))
  ) {
    cancelDrift(kart);
  }
  if (canDrift && kart.braking && Math.abs(kart.steering) > 0.25) {
    kart.drifting = true;
    kart.driftDirection = Math.sign(kart.steering);
    kart.driftCharge = Math.min(1, kart.driftCharge + dt / 1.6);
  }
  const target = !input.connected
    ? 0
    : kart.braking && !kart.drifting
      ? 8
      : kart.offRoad
        ? 13
        : kart.drifting
          ? 22
          : kart.boostTime > 0
            ? 39
            : 27;
  const acceleration =
    target > kart.speed ? (kart.boostTime > 0 ? 24 : 9) : kart.braking && !kart.drifting ? 24 : 16;
  kart.speed += THREE.MathUtils.clamp(target - kart.speed, -acceleration * dt, acceleration * dt);
  // Forward is +Z, so the chase camera sees positive yaw as a left turn.
  // Controller roll is positive for right: subtract it to turn right on screen.
  kart.heading -=
    kart.steering * (kart.drifting ? 1.9 : 1.55) * (kart.speed / (kart.speed + 9)) * dt;
  kart.heading = Math.atan2(Math.sin(kart.heading), Math.cos(kart.heading));
  kart.x += Math.sin(kart.heading) * kart.speed * dt;
  kart.z += Math.cos(kart.heading) * kart.speed * dt;
  if (kart.drifting) {
    // The rear slides toward the outside of the turn while the nose turns inward.
    kart.x += Math.cos(kart.heading) * kart.steering * 3.5 * dt;
    kart.z -= Math.sin(kart.heading) * kart.steering * 3.5 * dt;
  }
  const next = track.nearest(kart.x, kart.z);
  const longitudinal =
    (kart.x - next.frame.center.x) * next.frame.tangent.x +
    (kart.z - next.frame.center.z) * next.frame.tangent.z;
  if (next.distance < 0.1 && longitudinal < -1) {
    kart.x = next.frame.center.x + next.frame.right.x * next.side;
    kart.z = next.frame.center.z + next.frame.right.z * next.side;
    kart.heading = next.frame.heading;
    kart.speed *= 0.5;
    cancelDrift(kart);
    kart.boostTime = 0;
    return true;
  }
  kart.offRoad = Math.abs(next.side) > ROAD_HALF - 0.7;
  if (kart.offRoad) {
    cancelDrift(kart);
    kart.boostTime = 0;
  }
  const limit = WALL_OFFSET - 1.2;
  if (Math.abs(next.side) <= limit) return false;
  const side = Math.sign(next.side);
  kart.x = next.frame.center.x + next.frame.right.x * side * limit;
  kart.z = next.frame.center.z + next.frame.right.z * side * limit;
  // Redirect along the wall with a slight inward bounce, preventing repeated wall sticking.
  const direction = Math.cos(kart.heading - next.frame.heading) >= 0 ? 0 : Math.PI;
  kart.heading = next.frame.heading + direction - side * 0.25 * (direction ? -1 : 1);
  kart.speed *= 0.58;
  cancelDrift(kart);
  kart.boostTime = 0;
  return true;
}

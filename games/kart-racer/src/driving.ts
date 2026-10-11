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
  };
}

export const smooth = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

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
  const target = !input.connected ? 0 : kart.braking ? 8 : kart.offRoad ? 13 : 27;
  const acceleration = target > kart.speed ? 9 : kart.braking ? 24 : 16;
  kart.speed += THREE.MathUtils.clamp(target - kart.speed, -acceleration * dt, acceleration * dt);
  kart.heading += kart.steering * 1.55 * (kart.speed / (kart.speed + 9)) * dt;
  kart.heading = Math.atan2(Math.sin(kart.heading), Math.cos(kart.heading));
  kart.x += Math.sin(kart.heading) * kart.speed * dt;
  kart.z += Math.cos(kart.heading) * kart.speed * dt;
  const next = track.nearest(kart.x, kart.z);
  const longitudinal =
    (kart.x - next.frame.center.x) * next.frame.tangent.x +
    (kart.z - next.frame.center.z) * next.frame.tangent.z;
  if (next.distance < 0.1 && longitudinal < -1) {
    kart.x = next.frame.center.x + next.frame.right.x * next.side;
    kart.z = next.frame.center.z + next.frame.right.z * next.side;
    kart.heading = next.frame.heading;
    kart.speed *= 0.5;
    return true;
  }
  kart.offRoad = Math.abs(next.side) > ROAD_HALF - 0.7;
  const limit = WALL_OFFSET - 1.2;
  if (Math.abs(next.side) <= limit) return false;
  const side = Math.sign(next.side);
  kart.x = next.frame.center.x + next.frame.right.x * side * limit;
  kart.z = next.frame.center.z + next.frame.right.z * side * limit;
  // Redirect along the wall with a slight inward bounce, preventing repeated wall sticking.
  const direction = Math.cos(kart.heading - next.frame.heading) >= 0 ? 0 : Math.PI;
  kart.heading = next.frame.heading + direction - side * 0.25 * (direction ? -1 : 1);
  kart.speed *= 0.58;
  return true;
}

/**
 * Turns DeviceOrientationEvent angles into "how is the phone tilted relative to gravity",
 * expressed in the frame of the *screen as the player sees it* (so landscape just works).
 *
 * Device frame (W3C): x → right edge of the phone in portrait, y → top edge, z → out of the screen.
 * The event's Z-X'-Y'' Euler angles (alpha, beta, gamma) give R = Rz(α)·Rx(β)·Ry(γ), mapping device
 * to earth coordinates. The world "up" vector seen from the device is the third row of R, which does
 * not depend on alpha, so the compass (magnetometer) never affects steering.
 */
import { DEG, type Vec3, clamp } from './vec.ts';

/** World-up unit vector expressed in device coordinates. */
export function upVectorFromOrientation(betaDeg: number, gammaDeg: number): Vec3 {
  const b = betaDeg * DEG;
  const g = gammaDeg * DEG;
  return {
    x: -Math.cos(b) * Math.sin(g),
    y: Math.sin(b),
    z: Math.cos(b) * Math.cos(g),
  };
}

/**
 * Rotate a device-frame vector into the screen frame for the given `screen.orientation.angle`
 * (0, 90, 180, 270 / -90). For angle 90 the phone is rotated counter-clockwise, so the screen's
 * right is the device's -y and the screen's up is the device's +x.
 */
export function deviceToScreen(v: Vec3, screenAngleDeg: number): Vec3 {
  const t = screenAngleDeg * DEG;
  const c = Math.round(Math.cos(t) * 1e9) / 1e9;
  const s = Math.round(Math.sin(t) * 1e9) / 1e9;
  return {
    x: v.x * c - v.y * s,
    y: v.x * s + v.y * c,
    z: v.z,
  };
}

export interface Tilt {
  /** Degrees the screen's right edge is lowered below horizontal (positive = bank right). */
  roll: number;
  /** Degrees the screen leans back from vertical: 0 = upright facing you, 90 = flat face-up. */
  recline: number;
}

/**
 * Tilt angles from the up vector in screen coordinates. Both are exact for rotations about the
 * world-horizontal axes, i.e. the way a plane banks and pitches, whatever pose the phone is held in.
 */
export function tiltFromScreenUp(up: Vec3): Tilt {
  return {
    roll: -Math.asin(clamp(up.x, -1, 1)) / DEG,
    recline: Math.atan2(up.z, up.y) / DEG,
  };
}

export function tiltFromOrientation(
  betaDeg: number,
  gammaDeg: number,
  screenAngleDeg: number,
): Tilt {
  return tiltFromScreenUp(
    deviceToScreen(upVectorFromOrientation(betaDeg, gammaDeg), screenAngleDeg),
  );
}

/**
 * Gyro yaw rate (deg/s, positive = turning right as seen from above), from DeviceMotionEvent.rotationRate.
 * rotationRate.alpha is about device z, beta about x, gamma about y; projecting the angular velocity
 * onto world-up isolates "twist around the vertical axis" independent of how the phone is held.
 */
export function yawRateFromGyro(
  rate: { alpha: number; beta: number; gamma: number },
  upDevice: Vec3,
): number {
  const ccw = rate.beta * upDevice.x + rate.gamma * upDevice.y + rate.alpha * upDevice.z;
  return -ccw;
}

/** Current screen rotation angle in degrees, normalised to 0/90/180/270. */
export function currentScreenAngle(): number {
  let a = 0;
  if (
    typeof screen !== 'undefined' &&
    screen.orientation &&
    typeof screen.orientation.angle === 'number'
  ) {
    a = screen.orientation.angle;
  } else if (typeof window !== 'undefined') {
    const legacy = (window as unknown as { orientation?: number }).orientation;
    if (typeof legacy === 'number') a = legacy;
  }
  return ((a % 360) + 360) % 360;
}

import { OneEuroFilter } from './oneEuro.ts';
import {
  tiltFromScreenUp,
  deviceToScreen,
  upVectorFromOrientation,
  yawRateFromGyro,
} from './orientation.ts';
import { shapeAxis } from './shaping.ts';
import { type Vec3, wrapDeg } from './vec.ts';

export interface TiltSettings {
  /** tilt in degrees for full roll */
  rollRange: number;
  /** tilt in degrees for full pitch */
  pitchRange: number;
  /** yaw rate in deg/s for full rudder */
  yawRange: number;
  deadZone: number;
  curve: number;
  invertPitch: boolean;
  invertRoll: boolean;
}

export const DEFAULT_TILT_SETTINGS: TiltSettings = {
  rollRange: 35,
  pitchRange: 30,
  yawRange: 180,
  deadZone: 3,
  curve: 1.4,
  invertPitch: false,
  invertRoll: false,
};

export interface OrientationSample {
  beta: number;
  gamma: number;
  /** screen.orientation.angle */
  screenAngle: number;
  /** ms */
  t: number;
}

export interface ProcessedInput {
  roll: number;
  pitch: number;
  yaw: number;
  /** filtered, calibrated angles in degrees (for UI / debugging) */
  rollDeg: number;
  pitchDeg: number;
}

/**
 * Raw sensor → remap to screen frame → subtract calibration → 1€ filter → dead zone → curve → -1..1.
 */
export class TiltProcessor {
  settings: TiltSettings;
  private up: Vec3 | null = null;
  private screenAngle = 0;
  private lastT = 0;
  private neutral: { roll: number; recline: number } | null = null;
  /** Set when calibration detects the platform reports the screen angle the other way round. */
  private flip = false;
  private rollFilter = new OneEuroFilter();
  private pitchFilter = new OneEuroFilter();
  private yawFilter = new OneEuroFilter({ minCutoff: 2, beta: 0.01, dCutoff: 1 });
  private yawDegPerSec = 0;
  private out: ProcessedInput = { roll: 0, pitch: 0, yaw: 0, rollDeg: 0, pitchDeg: 0 };

  constructor(settings: Partial<TiltSettings> = {}) {
    this.settings = { ...DEFAULT_TILT_SETTINGS, ...settings };
  }

  get hasSample(): boolean {
    return this.up !== null;
  }

  get calibrated(): boolean {
    return this.neutral !== null;
  }

  pushOrientation(sample: OrientationSample): void {
    this.up = upVectorFromOrientation(sample.beta, sample.gamma);
    this.screenAngle = sample.screenAngle;
    this.lastT = sample.t;
    this.recompute();
  }

  pushRotationRate(rate: { alpha: number; beta: number; gamma: number }, t: number): void {
    if (!this.up) return;
    this.yawDegPerSec = this.yawFilter.filter(yawRateFromGyro(rate, this.up), t);
  }

  /** Store the current pose as neutral. Returns false if no sensor data has arrived yet. */
  calibrate(): boolean {
    if (!this.up) return false;
    const screenUp = deviceToScreen(this.up, this.screenAngle);
    // A player holding a phone in front of them always has the screen's top edge above its bottom
    // edge. If the reported screen angle is the "other" landscape, up.y comes out negative.
    this.flip = screenUp.y < -0.2;
    this.neutral = this.rawTilt();
    this.rollFilter.reset();
    this.pitchFilter.reset();
    this.recompute();
    return true;
  }

  resetCalibration(): void {
    this.neutral = null;
  }

  get output(): ProcessedInput {
    return this.out;
  }

  private rawTilt() {
    const angle = this.screenAngle + (this.flip ? 180 : 0);
    return tiltFromScreenUp(deviceToScreen(this.up!, angle));
  }

  private recompute(): void {
    if (!this.up) return;
    const s = this.settings;
    const raw = this.rawTilt();
    const n = this.neutral ?? { roll: 0, recline: raw.recline };
    const rollDeg = this.rollFilter.filter(wrapDeg(raw.roll - n.roll), this.lastT);
    // Leaning the top edge away from you (more face-up) is "stick forward" = nose down.
    const pitchDeg = this.pitchFilter.filter(-wrapDeg(raw.recline - n.recline), this.lastT);
    const shape = { deadZone: s.deadZone, curve: s.curve };
    let roll = shapeAxis(rollDeg, { ...shape, maxAngle: s.rollRange });
    let pitch = shapeAxis(pitchDeg, { ...shape, maxAngle: s.pitchRange });
    const yaw = shapeAxis(this.yawDegPerSec, { deadZone: 10, curve: 1, maxAngle: s.yawRange });
    if (s.invertRoll) roll = -roll;
    if (s.invertPitch) pitch = -pitch;
    this.out = { roll, pitch, yaw, rollDeg, pitchDeg };
  }
}

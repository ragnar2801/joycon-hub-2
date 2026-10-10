import { describe, expect, it } from 'vitest';
import {
  DEG,
  OneEuroFilter,
  TiltProcessor,
  type Vec3,
  deviceToScreen,
  shapeAxis,
  tiltFromOrientation,
  upVectorFromOrientation,
  wrapDeg,
  yawRateFromGyro,
} from '../src/index.ts';

/** Inverse of upVectorFromOrientation for poses with |beta| < 90. */
function anglesFromUp(up: Vec3): { beta: number; gamma: number } {
  return { beta: Math.asin(up.y) / DEG, gamma: Math.atan2(-up.x, up.z) / DEG };
}

/** Build a device pose from a screen-frame up vector for a given screen angle. */
function poseFor(screenUp: Vec3, screenAngle: number) {
  return anglesFromUp(deviceToScreen(screenUp, -screenAngle));
}

/** Screen-frame up vector for a phone reclined by `recline` deg and banked right by `roll` deg. */
function screenUp(recline: number, roll: number): Vec3 {
  const r = roll * DEG;
  const p = recline * DEG;
  return { x: -Math.sin(r), y: Math.cos(r) * Math.cos(p), z: Math.cos(r) * Math.sin(p) };
}

describe('orientation math', () => {
  it('up vector for basic poses', () => {
    const flat = upVectorFromOrientation(0, 0);
    expect(flat.z).toBeCloseTo(1);
    const upright = upVectorFromOrientation(90, 0);
    expect(upright.y).toBeCloseTo(1);
  });

  it('portrait: flat is 90° recline, upright is 0°', () => {
    expect(tiltFromOrientation(0, 0, 0).recline).toBeCloseTo(90);
    expect(tiltFromOrientation(90, 0, 0).recline).toBeCloseTo(0);
    expect(tiltFromOrientation(90, 0, 0).roll).toBeCloseTo(0);
  });

  it('landscape (90): upright phone has device +x pointing up', () => {
    // device x up => beta 0, gamma -90
    const t = tiltFromOrientation(0, -90, 90);
    expect(t.roll).toBeCloseTo(0);
    expect(t.recline).toBeCloseTo(0);
  });

  for (const angle of [0, 90, 180, 270]) {
    for (const recline of [0, 30, 60]) {
      for (const roll of [-25, 0, 20]) {
        it(`round-trips roll=${roll} recline=${recline} at screen angle ${angle}`, () => {
          const { beta, gamma } = poseFor(screenUp(recline, roll), angle);
          const t = tiltFromOrientation(beta, gamma, angle);
          expect(t.roll).toBeCloseTo(roll, 6);
          expect(t.recline).toBeCloseTo(recline, 6);
        });
      }
    }
  }

  it('wraps degrees', () => {
    expect(wrapDeg(190)).toBeCloseTo(-170);
    expect(wrapDeg(-190)).toBeCloseTo(170);
    expect(wrapDeg(180)).toBe(180);
    expect(wrapDeg(-180)).toBe(180);
    expect(wrapDeg(10)).toBe(10);
  });

  it('gyro yaw: CCW twist of a flat phone is a left turn', () => {
    const up = upVectorFromOrientation(0, 0);
    expect(yawRateFromGyro({ alpha: 90, beta: 0, gamma: 0 }, up)).toBeCloseTo(-90);
    expect(yawRateFromGyro({ alpha: 0, beta: 90, gamma: 0 }, up)).toBeCloseTo(0);
  });
});

describe('shapeAxis', () => {
  const shape = { deadZone: 3, maxAngle: 33, curve: 1 };
  it('applies dead zone', () => {
    expect(shapeAxis(2, shape)).toBe(0);
    expect(shapeAxis(-2.9, shape)).toBe(0);
  });
  it('is linear between dead zone and max with curve 1', () => {
    expect(shapeAxis(18, shape)).toBeCloseTo(0.5);
    expect(shapeAxis(-18, shape)).toBeCloseTo(-0.5);
  });
  it('clamps', () => {
    expect(shapeAxis(90, shape)).toBe(1);
    expect(shapeAxis(-90, shape)).toBe(-1);
  });
  it('curve > 1 gives finer centre control', () => {
    expect(shapeAxis(18, { ...shape, curve: 2 })).toBeCloseTo(0.25);
  });
});

describe('OneEuroFilter', () => {
  it('converges on a constant signal', () => {
    const f = new OneEuroFilter();
    let v = 0;
    f.filter(0, 0);
    for (let i = 1; i < 200; i++) v = f.filter(10, i * 16);
    expect(v).toBeCloseTo(10, 1);
  });
  it('reduces jitter while holding still', () => {
    const f = new OneEuroFilter();
    let maxDev = 0;
    for (let i = 0; i < 300; i++) {
      const noisy = (i % 2 ? 1 : -1) * 0.5;
      const out = f.filter(noisy, i * 16);
      if (i > 50) maxDev = Math.max(maxDev, Math.abs(out));
    }
    expect(maxDev).toBeLessThan(0.2);
  });
});

describe('TiltProcessor', () => {
  function feed(
    p: TiltProcessor,
    angle: number,
    recline: number,
    roll: number,
    t0: number,
    n = 120,
  ) {
    const { beta, gamma } = poseFor(screenUp(recline, roll), angle);
    for (let i = 0; i < n; i++)
      p.pushOrientation({ beta, gamma, screenAngle: angle, t: t0 + i * 16 });
    return t0 + n * 16;
  }

  it('is centred right after calibration', () => {
    const p = new TiltProcessor();
    const t = feed(p, 90, 40, 5, 0);
    expect(p.calibrate()).toBe(true);
    feed(p, 90, 40, 5, t);
    expect(p.output.roll).toBe(0);
    expect(p.output.pitch).toBe(0);
  });

  it('banking right gives positive roll, leaning top edge away gives nose down', () => {
    const p = new TiltProcessor({ curve: 1 });
    let t = feed(p, 270, 40, 0, 0);
    p.calibrate();
    t = feed(p, 270, 40, 20, t);
    expect(p.output.roll).toBeGreaterThan(0.4);
    expect(p.output.rollDeg).toBeCloseTo(20, 0);
    feed(p, 270, 55, 0, t);
    expect(p.output.pitch).toBeLessThan(-0.3);
    expect(p.output.pitchDeg).toBeCloseTo(-15, 0);
  });

  it('auto-corrects a screen angle reported the other way round', () => {
    const p = new TiltProcessor();
    // Physically held at 270 but the browser claims 90.
    const real = 270;
    const claimed = 90;
    const at = (recline: number, roll: number) => poseFor(screenUp(recline, roll), real);
    let t = 0;
    const push = (recline: number, roll: number) => {
      const { beta, gamma } = at(recline, roll);
      for (let i = 0; i < 120; i++)
        p.pushOrientation({ beta, gamma, screenAngle: claimed, t: (t += 16) });
    };
    push(30, 0);
    p.calibrate();
    push(30, 20);
    expect(p.output.roll).toBeGreaterThan(0.4);
  });

  it('respects invert settings', () => {
    const p = new TiltProcessor({ invertPitch: true, invertRoll: true });
    let t = feed(p, 0, 45, 0, 0);
    p.calibrate();
    t = feed(p, 0, 45, 20, t);
    expect(p.output.roll).toBeLessThan(0);
    feed(p, 0, 60, 0, t);
    expect(p.output.pitch).toBeGreaterThan(0);
  });

  it('cannot calibrate before any sample', () => {
    expect(new TiltProcessor().calibrate()).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { RingCourse, crossRing } from '../src/course.ts';
import { TUNING, createFlightState, stepFlight } from '../src/flight.ts';
import { DEG, mulberry32 } from '../src/math.ts';
import { TerrainField } from '../src/terrain.ts';

const neutral = { roll: 0, pitch: 0, yawRate: 0, throttle: 0.6, boost: false };

function run(steps: number, controls = neutral, s = createFlightState()) {
  for (let i = 0; i < steps; i++) stepFlight(s, controls, 1 / 60);
  return s;
}

describe('flight model', () => {
  it('flies straight and level with neutral input', () => {
    const s = run(300);
    expect(s.x).toBeCloseTo(0, 6);
    expect(s.y).toBeCloseTo(150, 3);
    expect(s.z).toBeLessThan(-200); // yaw 0 faces -Z
  });

  it('banking right turns right (clockwise seen from above)', () => {
    const s = run(120, { ...neutral, roll: 1 });
    expect(s.roll).toBeGreaterThan(50 * DEG);
    expect(s.yaw).toBeLessThan(0);
    expect(s.x).toBeGreaterThan(0);
  });

  it('pitch input climbs, and attitude returns to level when released', () => {
    const s = run(120, { ...neutral, pitch: 1 });
    expect(s.y).toBeGreaterThan(160);
    expect(s.pitch).toBeGreaterThan(30 * DEG);
    run(300, neutral, s);
    expect(Math.abs(s.pitch)).toBeLessThan(1 * DEG);
  });

  it('never exceeds max bank or pitch', () => {
    const s = run(600, { ...neutral, roll: 1, pitch: -1 });
    expect(s.roll).toBeLessThanOrEqual(TUNING.maxBankDeg * DEG + 1e-9);
    expect(s.pitch).toBeGreaterThanOrEqual(-TUNING.maxPitchDeg * DEG - 1e-9);
  });

  it('boost drains, speeds up, then recharges', () => {
    const s = createFlightState();
    const before = s.speed;
    run(60, { ...neutral, boost: true }, s);
    expect(s.boosting).toBe(true);
    expect(s.speed).toBeGreaterThan(before);
    expect(s.boost).toBeLessThan(1);
    // Holding boost forever: the meter runs dry and only sputters back above the restart threshold.
    run(300, { ...neutral, boost: true }, s);
    expect(s.boost).toBeLessThanOrEqual(TUNING.minBoostToStart + 0.01);
    const empty = s.boost;
    run(60, neutral, s);
    expect(s.boost).toBeGreaterThan(empty);
  });

  it('respects the ceiling', () => {
    const s = run(2000, { ...neutral, pitch: 1 });
    expect(s.y).toBeLessThanOrEqual(TUNING.ceiling);
  });
});

describe('ring crossing', () => {
  const ring = { pos: { x: 0, y: 100, z: -100 }, normal: { x: 0, y: 0, z: -1 }, radius: 15 };
  it('detects flying through', () => {
    expect(crossRing({ x: 0, y: 100, z: -95 }, { x: 0, y: 100, z: -105 }, ring)).toBe('through');
    expect(crossRing({ x: 10, y: 105, z: -95 }, { x: 10, y: 105, z: -105 }, ring)).toBe('through');
  });
  it('detects near misses and ignores far crossings', () => {
    expect(crossRing({ x: 30, y: 100, z: -95 }, { x: 30, y: 100, z: -105 }, ring)).toBe('outside');
    expect(crossRing({ x: 500, y: 100, z: -95 }, { x: 500, y: 100, z: -105 }, ring)).toBe('none');
  });
  it('ignores segments that do not cross the plane', () => {
    expect(crossRing({ x: 0, y: 100, z: -50 }, { x: 0, y: 100, z: -60 }, ring)).toBe('none');
  });
});

describe('terrain', () => {
  it('keeps the start corridor low for any seed', () => {
    for (const seed of [1, 2, 3, 42, 999]) {
      const f = new TerrainField(seed);
      for (let z = 200; z >= -1500; z -= 50) expect(f.height(0, z)).toBeLessThanOrEqual(25);
    }
  });
});

describe('ring course', () => {
  const field = new TerrainField(1234);
  const ground = (x: number, z: number) => field.clearanceAt(x, z);

  it('keeps rings above the ground and ahead of the player', () => {
    const c = new RingCourse(ground, mulberry32(1));
    c.reset({ x: 0, y: 120, z: 0 }, 0);
    expect(c.rings).toHaveLength(c.opts.ahead);
    expect(c.rings[0]!.pos.z).toBeCloseTo(-300);
    for (const r of c.rings)
      expect(r.pos.y).toBeGreaterThanOrEqual(ground(r.pos.x, r.pos.z) + c.opts.minClearance - 1e-9);
  });

  it('flying through the target ring passes it and spawns a new one', () => {
    const c = new RingCourse(ground, mulberry32(2));
    c.reset({ x: 0, y: 120, z: 0 }, 0);
    const t = c.target!;
    const before = { x: t.pos.x - t.normal.x * 2, y: t.pos.y, z: t.pos.z - t.normal.z * 2 };
    const after = { x: t.pos.x + t.normal.x * 2, y: t.pos.y, z: t.pos.z + t.normal.z * 2 };
    const res = c.update(before, after);
    expect(res.passed.map((r) => r.id)).toEqual([t.id]);
    expect(c.rings).toHaveLength(c.opts.ahead);
    expect(c.target!.id).not.toBe(t.id);
  });

  it('skipping a ring counts it as missed', () => {
    const c = new RingCourse(ground, mulberry32(3));
    c.reset({ x: 0, y: 120, z: 0 }, 0);
    const [first, second] = c.rings;
    const s = second!;
    const res = c.update(
      { x: s.pos.x - s.normal.x * 2, y: s.pos.y, z: s.pos.z - s.normal.z * 2 },
      { x: s.pos.x + s.normal.x * 2, y: s.pos.y, z: s.pos.z + s.normal.z * 2 },
    );
    expect(res.passed.map((r) => r.id)).toEqual([s.id]);
    expect(res.missed.map((r) => r.id)).toEqual([first!.id]);
  });

  it('rebuilds the course when the player wanders off', () => {
    const c = new RingCourse(ground, mulberry32(4));
    c.reset({ x: 0, y: 120, z: 0 }, 0);
    const res = c.update({ x: 5000, y: 200, z: 5000 }, { x: 5000, y: 200, z: 4990 });
    expect(res.rebuilt).toBe(true);
    expect(Math.hypot(c.target!.pos.x - 5000, c.target!.pos.z - 4990)).toBeLessThan(400);
  });
});

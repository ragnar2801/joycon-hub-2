/**
 * The ring course: a winding path of rings ahead of the player. Pure logic, no rendering.
 */
import { type V3, clamp, dist } from './math.ts';

export interface CourseRing {
  id: number;
  pos: V3;
  /** unit direction of travel through the ring */
  normal: V3;
  radius: number;
  state: 'pending' | 'passed' | 'missed';
}

export type Crossing = 'none' | 'through' | 'outside';

/** Did the segment prev→cur cross the ring's plane, and if so inside the ring or near it? */
export function crossRing(
  prev: V3,
  cur: V3,
  ring: Pick<CourseRing, 'pos' | 'normal' | 'radius'>,
): Crossing {
  const n = ring.normal;
  const dPrev =
    (prev.x - ring.pos.x) * n.x + (prev.y - ring.pos.y) * n.y + (prev.z - ring.pos.z) * n.z;
  const dCur = (cur.x - ring.pos.x) * n.x + (cur.y - ring.pos.y) * n.y + (cur.z - ring.pos.z) * n.z;
  if (dPrev === dCur || Math.sign(dPrev) === Math.sign(dCur)) return 'none';
  const f = dPrev / (dPrev - dCur);
  const hit = {
    x: prev.x + (cur.x - prev.x) * f,
    y: prev.y + (cur.y - prev.y) * f,
    z: prev.z + (cur.z - prev.z) * f,
  };
  const lateral = dist(hit, ring.pos);
  if (lateral <= ring.radius) return 'through';
  if (lateral <= ring.radius * 4) return 'outside';
  return 'none';
}

export interface CourseOptions {
  ahead: number;
  radius: number;
  minGap: number;
  maxGap: number;
  /** max heading change between rings, radians */
  maxTurn: number;
  minClearance: number;
  maxAltitude: number;
  /** distance from the next ring at which the course is rebuilt around the player */
  lostDistance: number;
}

export const COURSE_DEFAULTS: CourseOptions = {
  ahead: 6,
  radius: 15,
  minGap: 260,
  maxGap: 380,
  maxTurn: 0.6,
  minClearance: 35,
  maxAltitude: 420,
  lostDistance: 1800,
};

export interface CourseUpdate {
  passed: CourseRing[];
  missed: CourseRing[];
  rebuilt: boolean;
}

export class RingCourse {
  rings: CourseRing[] = [];
  private nextId = 1;
  private heading = 0;

  constructor(
    private readonly groundAt: (x: number, z: number) => number,
    private readonly rng: () => number,
    readonly opts: CourseOptions = COURSE_DEFAULTS,
  ) {}

  /** The ring the player should fly through next. */
  get target(): CourseRing | undefined {
    return this.rings.find((r) => r.state === 'pending');
  }

  reset(from: V3, heading: number): void {
    this.rings = [];
    this.heading = heading;
    let last = { ...from };
    for (let i = 0; i < this.opts.ahead; i++) {
      const ring = this.makeRing(last, i === 0 ? 0 : undefined, i === 0 ? 300 : undefined);
      this.rings.push(ring);
      last = ring.pos;
    }
  }

  update(prev: V3, cur: V3): CourseUpdate {
    const result: CourseUpdate = { passed: [], missed: [], rebuilt: false };
    const pending = this.rings.filter((r) => r.state === 'pending');
    for (let i = 0; i < pending.length; i++) {
      const ring = pending[i]!;
      const c = crossRing(prev, cur, ring);
      if (c === 'none') continue;
      if (c === 'through') {
        // Skipped rings before this one count as missed.
        for (let j = 0; j < i; j++) {
          pending[j]!.state = 'missed';
          result.missed.push(pending[j]!);
        }
        ring.state = 'passed';
        result.passed.push(ring);
      } else if (i === 0) {
        ring.state = 'missed';
        result.missed.push(ring);
      }
      break;
    }

    // Drop resolved rings and top the course back up.
    this.rings = this.rings.filter((r) => r.state === 'pending');
    while (this.rings.length < this.opts.ahead) {
      const last = this.rings[this.rings.length - 1]?.pos ?? cur;
      this.rings.push(this.makeRing(last));
    }

    const target = this.target;
    if (target && dist(target.pos, cur) > this.opts.lostDistance) {
      result.missed.push(...this.rings.map((r) => ({ ...r, state: 'missed' as const })));
      const travel = Math.atan2(-(cur.x - prev.x), -(cur.z - prev.z));
      this.reset(cur, Number.isFinite(travel) ? travel : this.heading);
      result.rebuilt = true;
    }
    return result;
  }

  private makeRing(from: V3, turn?: number, gap?: number): CourseRing {
    const o = this.opts;
    this.heading += turn ?? (this.rng() - 0.5) * 2 * o.maxTurn;
    const d = gap ?? o.minGap + this.rng() * (o.maxGap - o.minGap);
    const normal = { x: -Math.sin(this.heading), y: 0, z: -Math.cos(this.heading) };
    const x = from.x + normal.x * d;
    const z = from.z + normal.z * d;
    const ground = this.groundAt(x, z);
    const wanted = ground + o.minClearance + 10 + this.rng() * 90;
    const y = clamp(
      clamp(wanted, from.y - 70, from.y + 70),
      ground + o.minClearance,
      o.maxAltitude,
    );
    return { id: this.nextId++, pos: { x, y, z }, normal, radius: o.radius, state: 'pending' };
  }
}

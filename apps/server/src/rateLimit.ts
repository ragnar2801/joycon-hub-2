/** Fixed-window counter: allows `limit` hits per `windowMs` per key. */
export class RateLimiter {
  private hits = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns how many hits this key has made in the current window, including this one. */
  hit(key: string): number {
    const t = this.now();
    let e = this.hits.get(key);
    if (!e || t - e.start >= this.windowMs) {
      e = { start: t, count: 0 };
      this.hits.set(key, e);
    }
    e.count++;
    if (this.hits.size > 10_000) this.prune(t);
    return e.count;
  }

  allow(key: string): boolean {
    return this.hit(key) <= this.limit;
  }

  private prune(t: number): void {
    for (const [k, e] of this.hits) if (t - e.start >= this.windowMs) this.hits.delete(k);
  }
}

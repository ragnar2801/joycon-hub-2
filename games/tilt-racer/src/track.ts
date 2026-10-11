export const TRACK = {
  width: 1000,
  height: 640,
  cx: 500,
  cy: 360,
  straight: 210,
  radius: 150,
  roadHalf: 42,
};

export const LENGTH = TRACK.straight * 4 + 2 * Math.PI * TRACK.radius;
export const START = TRACK.straight;

/** Clockwise distance along a stadium-shaped circuit, starting at its top-left tangent. */
export function trackPoint(distance: number): { x: number; y: number; heading: number } {
  const { cx, cy, straight: a, radius: r } = TRACK;
  let d = ((distance % LENGTH) + LENGTH) % LENGTH;
  if (d < 2 * a) return { x: cx - a + d, y: cy - r, heading: 0 };
  d -= 2 * a;
  if (d < Math.PI * r) {
    const angle = d / r - Math.PI / 2;
    return {
      x: cx + a + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      heading: angle + Math.PI / 2,
    };
  }
  d -= Math.PI * r;
  if (d < 2 * a) return { x: cx + a - d, y: cy + r, heading: Math.PI };
  d -= 2 * a;
  const angle = d / r + Math.PI / 2;
  return {
    x: cx - a + Math.cos(angle) * r,
    y: cy + Math.sin(angle) * r,
    heading: angle + Math.PI / 2,
  };
}

/** Distance from the road centre; also works inside the infield. */
export function roadDistance(x: number, y: number): number {
  const nearX = Math.max(TRACK.cx - TRACK.straight, Math.min(TRACK.cx + TRACK.straight, x));
  return Math.abs(Math.hypot(x - nearX, y - TRACK.cy) - TRACK.radius);
}

export function ovalPath(radius: number): Path2D {
  const { cx, cy, straight: a } = TRACK;
  const path = new Path2D();
  path.moveTo(cx - a, cy - radius);
  path.lineTo(cx + a, cy - radius);
  path.arc(cx + a, cy, radius, -Math.PI / 2, Math.PI / 2);
  path.lineTo(cx - a, cy + radius);
  path.arc(cx - a, cy, radius, Math.PI / 2, Math.PI * 1.5);
  path.closePath();
  return path;
}

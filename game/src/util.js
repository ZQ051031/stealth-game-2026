// Nightshade — shared math and grid helpers (written fresh for this entry).
export const TILE = 32;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const lerp = (a, b, t) => a + (b - a) * t;

// Smallest signed angle from a to b, in (-PI, PI].
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

// Turn `from` toward `to` by at most `maxStep` radians.
export function turnToward(from, to, maxStep) {
  const d = angleDiff(from, to);
  if (Math.abs(d) <= maxStep) return to;
  return from + Math.sign(d) * maxStep;
}

// --- tile grid ------------------------------------------------------------
// A level grid is an array of equal-length strings. Legend:
//   '#' wall   '=' fountain (solid)   '.' stone floor   ',' gravel (loud)
//   '~' shadow (dark, hides you)     'B' bush (hides you when inside)
export function tileAt(grid, tx, ty) {
  if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) return '#';
  return grid[ty][tx];
}

export function isSolid(grid, tx, ty) {
  const c = tileAt(grid, tx, ty);
  return c === '#' || c === '=';
}

export function isWalkable(grid, tx, ty) {
  return !isSolid(grid, tx, ty);
}

// Is the point (px, py) in pixel space inside a solid tile?
export function pointSolid(grid, px, py) {
  return isSolid(grid, Math.floor(px / TILE), Math.floor(py / TILE));
}

// Line of sight between two pixel points: sample the segment; blocked if any
// sample lands inside a solid tile.
export function hasLOS(grid, x1, y1, x2, y2) {
  const d = dist(x1, y1, x2, y2);
  const steps = Math.max(1, Math.ceil(d / 4));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (pointSolid(grid, lerp(x1, x2, t), lerp(y1, y2, t))) return false;
  }
  return true;
}

// Cast a ray from (x, y) along `angle` until it hits a solid tile or `max` px.
// Returns the distance travelled.
export function raycast(grid, x, y, angle, max) {
  const step = 4;
  const dx = Math.cos(angle) * step;
  const dy = Math.sin(angle) * step;
  let cx = x;
  let cy = y;
  let travelled = 0;
  while (travelled < max) {
    cx += dx;
    cy += dy;
    travelled += step;
    if (pointSolid(grid, cx, cy)) return travelled;
  }
  return max;
}

// Build a vision-cone polygon (array of [x, y]) for a viewer at (x, y)
// facing `dir`, with `range` px and `halfAngle` radians, clipped by walls.
export function conePolygon(grid, x, y, dir, range, halfAngle, rays = 26) {
  const pts = [[x, y]];
  for (let i = 0; i <= rays; i += 1) {
    const a = dir - halfAngle + (2 * halfAngle * i) / rays;
    const r = raycast(grid, x, y, a, range);
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  return pts;
}

// Tile type under a pixel point, for movement noise / hiding checks.
export function tileUnder(grid, px, py) {
  return tileAt(grid, Math.floor(px / TILE), Math.floor(py / TILE));
}

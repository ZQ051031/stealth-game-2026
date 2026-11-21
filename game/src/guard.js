// Nightshade — guard AI (written fresh for this entry).
// States: patrol -> suspicious -> alert (chase) -> search -> patrol,
// plus investigate (called by a noise). Suspicion 0..100 fills while the
// player is seen inside the vision cone and drains while hidden.
import { TILE, angleDiff, clamp, dist, hasLOS, raycast, turnToward } from './util.js';

const VIEW_RANGE = 6.2 * TILE;
const VIEW_HALF = 0.62; // ~71-degree cone
const BUSH_HIDE_RANGE = 1.6 * TILE; // a guard this close still spots you in a bush
const CATCH_RANGE = 0.7 * TILE;

export class Guard {
  constructor(level, def, spawn) {
    this.level = level;
    this.x = (spawn.x + 0.5) * TILE;
    this.y = (spawn.y + 0.5) * TILE;
    this.waypoints = def.waypoints.map(([wx, wy]) => ({ x: (wx + 0.5) * TILE, y: (wy + 0.5) * TILE }));
    this.wp = 0;
    this.pause = def.pause ?? 1;
    this.pauseTimer = 0;
    this.speed = (def.speed ?? 1.6) * TILE;
    this.dir = this.waypoints.length > 1
      ? Math.atan2(this.waypoints[1].y - this.y, this.waypoints[1].x - this.x)
      : 0;
    this.state = 'patrol';
    this.suspicion = 0;
    this.maxSuspicion = 0;
    this.lastSeen = null;
    this.lostTimer = 0;
    this.searchTimer = 0;
    this.investigateTarget = null;
    this.lookTimer = 0;
    this.lookDir = this.dir;
    this.stepTimer = 0;
  }

  // How well the guard can see the player right now, 0..1.
  visibility(player) {
    const d = dist(this.x, this.y, player.x, player.y);
    if (d > VIEW_RANGE) return 0;
    const ang = Math.atan2(player.y - this.y, player.x - this.x);
    if (Math.abs(angleDiff(this.dir, ang)) > VIEW_HALF) return 0;
    if (!hasLOS(this.level.grid, this.x, this.y, player.x, player.y)) return 0;
    // Bushes hide you unless the guard is right next to you.
    if (player.inBush && d > BUSH_HIDE_RANGE) return 0;
    let v = 1 - (d / VIEW_RANGE) * 0.55; // closer = easier to spot
    if (player.inShadow) v *= 0.3; // shadows are a real refuge
    if (player.sneaking) v *= 0.65;
    if (!player.sneaking && player.moving) v *= 1.35;
    return clamp(v, 0, 1);
  }

  hearNoise(x, y) {
    if (this.state === 'alert') return;
    this.investigateTarget = { x, y };
    this.state = 'investigate';
    this.searchTimer = 0;
  }

  // Move toward (tx, ty) at `speed` px/s with wall sliding. Returns true if arrived.
  moveToward(tx, ty, speed, dt) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) return true;
    const step = Math.min(d, speed * dt);
    const nx = this.x + (dx / d) * step;
    const ny = this.y + (dy / d) * step;
    this.tryMove(nx, this.y);
    this.tryMove(this.x, ny);
    this.dir = Math.atan2(dy, dx);
    return d <= step + 2;
  }

  tryMove(nx, ny) {
    const r = 0.3 * TILE;
    const { grid } = this.level;
    const solid = (px, py) => {
      const tx = Math.floor(px / TILE);
      const ty = Math.floor(py / TILE);
      if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) return true;
      const c = grid[ty][tx];
      return c === '#' || c === '=';
    };
    if (!solid(nx - r, this.y - r) && !solid(nx + r, this.y - r) && !solid(nx - r, this.y + r) && !solid(nx + r, this.y + r)) {
      this.x = nx;
    }
    if (!solid(this.x - r, ny - r) && !solid(this.x + r, ny - r) && !solid(this.x - r, ny + r) && !solid(this.x + r, ny + r)) {
      this.y = ny;
    }
  }

  update(dt, world) {
    const player = world.player;
    const vis = this.visibility(player);

    if (vis > 0) {
      // Seen! Suspicion climbs in proportion to how clearly the guard can
      // see you — point-blank in the open is ~1s to full alert, but a
      // distant glimpse in shadow while sneaking buys you seconds to
      // break line of sight.
      const rate = vis * 85;
      this.suspicion = clamp(this.suspicion + rate * dt, 0, 100);
      this.lastSeen = { x: player.x, y: player.y };
      this.lostTimer = 0;
      if (this.suspicion >= 100 && this.state !== 'alert') {
        this.state = 'alert';
        world.onSpotted(this);
      } else if (this.suspicion >= 40 && this.state === 'patrol') {
        this.state = 'suspicious';
        world.onSuspicious(this);
      }
    } else {
      this.suspicion = clamp(this.suspicion - 20 * dt, 0, 100);
      if (this.state === 'alert') {
        this.lostTimer += dt;
        if (this.lostTimer > 2.2) {
          this.state = 'search';
          this.searchTimer = 0;
        }
      } else if (this.state === 'suspicious' && this.suspicion < 25) {
        this.state = 'patrol';
      }
    }
    this.maxSuspicion = Math.max(this.maxSuspicion, this.suspicion);

    switch (this.state) {
      case 'patrol': {
        if (this.pauseTimer > 0) {
          this.pauseTimer -= dt;
          this.lookTimer += dt;
          // Glance around while paused at a waypoint.
          this.dir = this.lookDir + Math.sin(this.lookTimer * 1.6) * 0.7;
          break;
        }
        const target = this.waypoints[this.wp];
        if (this.moveToward(target.x, target.y, this.speed, dt)) {
          this.wp = (this.wp + 1) % this.waypoints.length;
          this.pauseTimer = this.pause;
          this.lookTimer = 0;
          this.lookDir = this.dir;
        }
        break;
      }
      case 'suspicious': {
        // Freeze and stare at where the player was glimpsed.
        if (this.lastSeen) {
          const want = Math.atan2(this.lastSeen.y - this.y, this.lastSeen.x - this.x);
          this.dir = turnToward(this.dir, want, 3.2 * dt);
        }
        break;
      }
      case 'alert': {
        // Chase the player's live position; catch them up close.
        this.moveToward(player.x, player.y, this.speed * 1.5, dt);
        if (dist(this.x, this.y, player.x, player.y) < CATCH_RANGE) {
          world.onCaught(this);
        }
        break;
      }
      case 'search': {
        this.searchTimer += dt;
        if (this.lastSeen && dist(this.x, this.y, this.lastSeen.x, this.lastSeen.y) > 4) {
          this.moveToward(this.lastSeen.x, this.lastSeen.y, this.speed * 1.25, dt);
        } else if (this.searchTimer < 3) {
          this.lookTimer += dt;
          this.dir += Math.sin(this.lookTimer * 2.2) * 1.9 * dt;
        } else {
          this.state = 'patrol';
          this.suspicion = 0;
        }
        break;
      }
      case 'investigate': {
        const t = this.investigateTarget;
        if (t && dist(this.x, this.y, t.x, t.y) > 4) {
          this.moveToward(t.x, t.y, this.speed * 1.3, dt);
        } else {
          this.searchTimer += dt;
          this.lookTimer += dt;
          this.dir += Math.sin(this.lookTimer * 2.0) * 1.9 * dt;
          if (this.searchTimer > 2.4) {
            this.state = 'patrol';
            this.investigateTarget = null;
            this.suspicion = Math.max(0, this.suspicion - 20);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  // Cone polygon for rendering, clipped by walls.
  cone() {
    const range = VIEW_RANGE;
    const pts = [[this.x, this.y]];
    const rays = 24;
    for (let i = 0; i <= rays; i += 1) {
      const a = this.dir - VIEW_HALF + (2 * VIEW_HALF * i) / rays;
      const r = raycast(this.level.grid, this.x, this.y, a, range);
      pts.push([this.x + Math.cos(a) * r, this.y + Math.sin(a) * r]);
    }
    return pts;
  }

  get alertLevel() {
    if (this.state === 'alert') return 2;
    if (this.state === 'suspicious' || this.suspicion >= 40) return 1;
    return 0;
  }
}

// A wall lamp that sweeps a beam. If its beam finds you it calls the nearest
// guard to come and look.
export class Lamp {
  constructor(level, def) {
    this.level = level;
    this.x = (def.x + 0.5) * TILE;
    this.y = (def.y + 0.5) * TILE;
    this.base = def.base;
    this.sweep = def.sweep;
    this.speed = def.speed;
    this.range = def.range * TILE;
    this.t = Math.random() * 10;
    this.cooldown = 0;
  }

  get dir() {
    return this.base + Math.sin(this.t * this.speed) * this.sweep;
  }

  beamPolygon() {
    const half = 0.16;
    const pts = [[this.x, this.y]];
    const rays = 10;
    for (let i = 0; i <= rays; i += 1) {
      const a = this.dir - half + (2 * half * i) / rays;
      const r = raycast(this.level.grid, this.x, this.y, a, this.range);
      pts.push([this.x + Math.cos(a) * r, this.y + Math.sin(a) * r]);
    }
    return pts;
  }

  update(dt, world) {
    this.t += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.cooldown > 0) return;
    const p = world.player;
    const d = dist(this.x, this.y, p.x, p.y);
    if (d > this.range) return;
    const ang = Math.atan2(p.y - this.y, p.x - this.x);
    if (Math.abs(angleDiff(this.dir, ang)) > 0.16) return;
    if (!hasLOS(this.level.grid, this.x, this.y, p.x, p.y)) return;
    if (p.inBush && d > BUSH_HIDE_RANGE) return;
    // Spotted by the lamp: the nearest guard comes to look.
    this.cooldown = 3;
    let best = null;
    let bestD = Infinity;
    for (const g of world.guards) {
      const gd = dist(g.x, g.y, p.x, p.y);
      if (gd < bestD) { bestD = gd; best = g; }
    }
    if (best) {
      best.lastSeen = { x: p.x, y: p.y };
      best.suspicion = Math.max(best.suspicion, 55);
      if (best.state === 'patrol') best.state = 'suspicious';
      world.onLampSpot(this);
    }
  }
}

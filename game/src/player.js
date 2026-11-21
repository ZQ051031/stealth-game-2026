// Nightshade — the player: Wren, a night courier (written fresh for this entry).
import { TILE, clamp } from './util.js';

const WALK_SPEED = 3.3 * TILE;
const SNEAK_SPEED = 1.9 * TILE;
const RADIUS = 0.3 * TILE;

export class Player {
  constructor(level, spawn) {
    this.level = level;
    this.x = (spawn.x + 0.5) * TILE;
    this.y = (spawn.y + 0.5) * TILE;
    this.dir = -Math.PI / 2; // facing up
    this.sneaking = false;
    this.moving = false;
    this.pebbles = 0;
    this.inShadow = false;
    this.inBush = false;
    this.onGravel = false;
    this.stepTimer = 0;
    this.noiseTimer = 0;
  }

  update(dt, input, world) {
    let dx = 0;
    let dy = 0;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    this.sneaking = !!input.sneak;
    this.moving = dx !== 0 || dy !== 0;
    if (this.moving) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
      this.dir = Math.atan2(dy, dx);
      const speed = this.sneaking ? SNEAK_SPEED : WALK_SPEED;
      const step = speed * dt;
      this.tryMove(this.x + dx * step, this.y);
      this.tryMove(this.x, this.y + dy * step);
      // Footsteps: gravel is loud when you run across it.
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = this.sneaking ? 0.55 : 0.34;
        world.onStep(this);
        if (this.onGravel && !this.sneaking) {
          this.noiseTimer -= dt;
          if (this.noiseTimer <= 0) {
            this.noiseTimer = 0.5;
            world.onNoise(this.x, this.y, 4.2 * TILE);
          }
        }
      }
    }
    // Tile effects underfoot.
    const tx = Math.floor(this.x / TILE);
    const ty = Math.floor(this.y / TILE);
    const c = this.level.grid[ty]?.[tx] ?? '#';
    this.inShadow = c === '~';
    this.inBush = c === 'B';
    this.onGravel = c === ',';
  }

  tryMove(nx, ny) {
    const { grid } = this.level;
    const solid = (px, py) => {
      const tx = Math.floor(px / TILE);
      const ty = Math.floor(py / TILE);
      if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) return true;
      const cc = grid[ty][tx];
      return cc === '#' || cc === '=';
    };
    if (!solid(nx - RADIUS, this.y - RADIUS) && !solid(nx + RADIUS, this.y - RADIUS)
      && !solid(nx - RADIUS, this.y + RADIUS) && !solid(nx + RADIUS, this.y + RADIUS)) {
      this.x = clamp(nx, RADIUS, grid[0].length * TILE - RADIUS);
    }
    if (!solid(this.x - RADIUS, ny - RADIUS) && !solid(this.x + RADIUS, ny - RADIUS)
      && !solid(this.x - RADIUS, ny + RADIUS) && !solid(this.x + RADIUS, ny + RADIUS)) {
      this.y = clamp(ny, RADIUS, grid.length * TILE - RADIUS);
    }
  }
}

// A thrown pebble: flies to a target, then rings out a noise.
export class Pebble {
  constructor(x, y, tx, ty) {
    this.sx = x;
    this.sy = y;
    this.x = x;
    this.y = y;
    this.tx = tx;
    this.ty = ty;
    this.t = 0;
    this.dur = 0.38;
    this.done = false;
  }

  update(dt, world) {
    this.t += dt;
    const k = Math.min(1, this.t / this.dur);
    if (k >= 1 && !this.done) {
      this.done = true;
      this.x = this.tx;
      this.y = this.ty;
      world.onNoise(this.tx, this.ty, 6 * TILE);
      world.onPebbleLand(this.tx, this.ty);
      return;
    }
    this.x = this.sx + (this.tx - this.sx) * k;
    this.y = this.sy + (this.ty - this.sy) * k;
  }
}

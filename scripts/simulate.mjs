// Nightshade — headless winnability simulation (Node 22, stdlib only).
// Drives the real Guard/Player/Lamp classes with a cautious bot: it only
// steps onto tiles that are out of every guard's vision cone and every
// lamp beam right now, retreats to the nearest shadow or bush when seen,
// runs when chased, and tosses a pebble to distract a guard that starts
// noticing it. Proves each level can be won with the shipped tuning.
//   node scripts/simulate.mjs [level-number]
import { LEVELS, parseLevel } from '../game/src/levels.js';
import { Guard, Lamp } from '../game/src/guard.js';
import { Player, Pebble } from '../game/src/player.js';
import { TILE, angleDiff, hasLOS, isWalkable } from '../game/src/util.js';

const onlyLevel = Number(process.argv[2] ?? 0);

function bfsPath(grid, sx, sy, tx, ty) {
  const key = (x, y) => `${x},${y}`;
  const prev = new Map([[key(sx, sy), null]]);
  const q = [[sx, sy]];
  while (q.length > 0) {
    const [x, y] = q.shift();
    if (x === tx && y === ty) {
      const path = [];
      let cur = key(x, y);
      while (cur) {
        const [cx, cy] = cur.split(',').map(Number);
        path.unshift([cx, cy]);
        cur = prev.get(cur);
      }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || ny >= grid.length || nx >= grid[0].length) continue;
      if (!isWalkable(grid, nx, ny)) continue;
      if (prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), key(x, y));
      q.push([nx, ny]);
    }
  }
  return null;
}

function nearestHiding(grid, fx, fy, isSafe) {
  // Nearest shadow/bush tile reachable from (fx, fy). Prefer one no guard
  // or lamp can see right now; fall back to the nearest hiding tile.
  const key = (x, y) => `${x},${y}`;
  const seen = new Set([key(fx, fy)]);
  const q = [[fx, fy]];
  let fallback = null;
  while (q.length > 0) {
    const [x, y] = q.shift();
    const c = grid[y][x];
    if ((c === '~' || c === 'B') && !(x === fx && y === fy)) {
      if (!fallback) fallback = [x, y];
      if (!isSafe || !isSafe(x, y)) return [x, y];
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || ny >= grid.length || nx >= grid[0].length) continue;
      if (!isWalkable(grid, nx, ny)) continue;
      if (seen.has(key(nx, ny))) continue;
      seen.add(key(nx, ny));
      q.push([nx, ny]);
    }
  }
  return fallback;
}

// Find a retreat spot that breaks line of sight: the nearest tile no guard
// can see through walls to, preferring shadows and bushes. A shadow in the
// open does not break line of sight — a guard staring at it keeps seeing
// you — so cover matters more than darkness.
function findRetreat(grid, fx, fy, guards, isSafe) {
  const key = (x, y) => `${x},${y}`;
  const seen = new Set([key(fx, fy)]);
  const q = [[fx, fy]];
  let bestSafeHide = null; // hiding tile, currently unwatched
  let bestHide = null; // any hiding tile
  while (q.length > 0) {
    const [x, y] = q.shift();
    const c = grid[y][x];
    const isHide = c === '~' || c === 'B';
    const noLOS = guards.every((g) => !hasLOS(grid, g.x, g.y, (x + 0.5) * TILE, (y + 0.5) * TILE));
    const safe = !isSafe || !isSafe(x, y);
    if (!(x === fx && y === fy)) {
      if (isHide && noLOS) return [x, y];
      if (isHide && safe && !bestSafeHide) bestSafeHide = [x, y];
      if (isHide && !bestHide) bestHide = [x, y];
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || ny >= grid.length || nx >= grid[0].length) continue;
      if (!isWalkable(grid, nx, ny)) continue;
      if (seen.has(key(nx, ny))) continue;
      seen.add(key(nx, ny));
      q.push([nx, ny]);
    }
  }
  return bestSafeHide ?? bestHide;
}

function simulate(def) {
  const level = parseLevel(def);
  const player = new Player(level, level.player);
  player.pebbles = def.pebbles;
  const guards = level.guards.map((g, k) => new Guard(level, g, level.spawns[k]));
  const lamps = level.lamps.map((l) => new Lamp(level, l));
  // Deterministic lamp phase so repeated runs are comparable.
  for (const lamp of lamps) lamp.t = 0;
  const pebbles = [];
  const world = {
    player,
    guards,
    onStep() {},
    onNoise(x, y) {
      for (const g of guards) {
        if (Math.hypot(g.x - x, g.y - y) < 8 * TILE) g.hearNoise(x, y);
      }
    },
    onPebbleLand() {},
    onSuspicious() {},
    onSpotted() {},
    onLampSpot() {},
    onCaught() { world.caught = true; },
    caught: false,
  };

  const tileOf = (px, py) => [Math.floor(px / TILE), Math.floor(py / TILE)];
  const tileChar = (tx, ty) => level.grid[ty]?.[tx] ?? '#';

  // Would a sneaking player standing on (tx, ty) be seen right now?
  function dangerAt(tx, ty) {
    const x = (tx + 0.5) * TILE;
    const y = (ty + 0.5) * TILE;
    const fake = {
      x, y,
      inBush: tileChar(tx, ty) === 'B',
      inShadow: tileChar(tx, ty) === '~',
      sneaking: true,
      moving: true,
    };
    for (const g of guards) {
      if (g.visibility(fake) > 0.05) return true;
    }
    for (const lamp of lamps) {
      const d = Math.hypot(lamp.x - x, lamp.y - y);
      if (d > lamp.range) continue;
      if (Math.abs(angleDiff(lamp.dir, Math.atan2(y - lamp.y, x - lamp.x))) > 0.16) continue;
      if (!hasLOS(level.grid, lamp.x, lamp.y, x, y)) continue;
      if (fake.inBush && d > 1.6 * TILE) continue;
      return true;
    }
    return false;
  }

  const dt = 1 / 30;
  let t = 0;
  let letters = 0;
  let maxSuspicion = 0;
  let waits = 0;
  let pebblesThrown = 0;
  let path = null;
  let pathI = 0;
  let mode = 'go'; // 'go' | 'hide'
  let threwAt = -1;
  let waitTimer = 0;

  function planTo(tx, ty) {
    const [px, py] = tileOf(player.x, player.y);
    const p = bfsPath(level.grid, px, py, tx, ty);
    if (!p) return false;
    path = p;
    pathI = 0;
    return true;
  }

  function nextTarget() {
    const [px, py] = tileOf(player.x, player.y);
    if (letters < level.letters.length) {
      let best = null;
      let bestLen = Infinity;
      for (const L of level.letters.filter((l) => !l.taken)) {
        const p = bfsPath(level.grid, px, py, L.x, L.y);
        if (p && p.length < bestLen) { bestLen = p.length; best = [L.x, L.y]; }
      }
      return best;
    }
    return [level.exit.x, level.exit.y];
  }

  while (t < 240) {
    t += dt;
    for (const g of guards) maxSuspicion = Math.max(maxSuspicion, g.suspicion);
    if (world.caught) return { won: false, reason: 'caught', t, letters, maxSuspicion, waits, pebblesThrown };
    if (letters === level.letters.length) {
      const d = Math.hypot(player.x - (level.exit.x + 0.5) * TILE, player.y - (level.exit.y + 0.5) * TILE);
      if (d < 0.9 * TILE) return { won: true, reason: 'escaped', t, letters, maxSuspicion, waits, pebblesThrown };
    }
    for (const L of level.letters) {
      if (!L.taken && Math.hypot(player.x - (L.x + 0.5) * TILE, player.y - (L.y + 0.5) * TILE) < 0.8 * TILE) {
        L.taken = true;
        letters += 1;
      }
    }

    const hottest = Math.max(0, ...guards.map((g) => g.suspicion));
    const anyAlert = guards.some((g) => g.state === 'alert');
    const [px, py] = tileOf(player.x, player.y);

    // Distraction: a guard is starting to notice us — toss a pebble away
    // from the nearest guard so it goes to investigate instead.
    if (hottest > 35 && threwAt < 0 && player.pebbles > 0) {
      let nearest = null;
      let nearestD = Infinity;
      for (const g of guards) {
        const d = Math.hypot(g.x - player.x, g.y - player.y);
        if (d < nearestD) { nearestD = d; nearest = g; }
      }
      if (nearest) {
        const away = Math.atan2(player.y - nearest.y, player.x - nearest.x);
        player.pebbles -= 1;
        pebblesThrown += 1;
        pebbles.push(new Pebble(player.x, player.y, player.x + Math.cos(away) * 4 * TILE, player.y + Math.sin(away) * 4 * TILE));
        threwAt = Math.round(t * 10);
      }
    }
    if (hottest < 10) threwAt = -1;

    // Seen or about to be seen: retreat to the nearest hiding tile no
    // guard or lamp can see right now.
    if (mode === 'go' && (hottest > 45 || anyAlert)) {
      const hide = findRetreat(level.grid, px, py, guards, (x, y) => !dangerAt(x, y));
      if (hide && planTo(hide[0], hide[1])) {
        mode = 'hide';
        waits += 1;
      }
    }

    if (mode === 'hide') {
      // At the hiding tile and calm again: wait for a safe window, then go.
      const hidden = tileChar(px, py) === '~' || tileChar(px, py) === 'B';
      const arrived = !path || pathI >= path.length;
      // The hiding spot is compromised — a guard can see it now. Move to
      // a different hiding tile instead of sitting there getting spotted.
      if (arrived && hidden && dangerAt(px, py) && hottest > 5) {
        const other = findRetreat(level.grid, px, py, guards, (x, y) => !dangerAt(x, y));
        if (other && planTo(other[0], other[1])) {
          waits += 1;
          waitTimer = 0;
        }
      }
      if (arrived && hidden && hottest < 15 && !anyAlert) {
        waitTimer += dt;
        const dest = nextTarget();
        if (dest && waitTimer > 0.4) {
          const [dx, dy] = dest;
          const probe = bfsPath(level.grid, px, py, dx, dy);
          const firstSteps = (probe ?? []).slice(0, 4);
          const safe = firstSteps.length > 0 && firstSteps.every(([sx, sy]) => !dangerAt(sx, sy));
          if (safe && planTo(dx, dy)) {
            mode = 'go';
            waitTimer = 0;
          }
        }
      }
    } else if (!path || pathI >= path.length) {
      const dest = nextTarget();
      if (!dest || !planTo(dest[0], dest[1])) {
        return { won: false, reason: 'no path', t, letters, maxSuspicion, waits, pebblesThrown };
      }
    }

    // Move along the current path. A careful player RUNS when the way ahead
    // is unwatched (stone is silent underfoot — only gravel betrays a
    // runner) and sneaks only when a cone or beam covers the next tiles.
    // Running covers ground before a patrol turns around.
    const retreating = mode === 'hide' && path && pathI < path.length;
    const aheadTiles = path && pathI < path.length ? path.slice(pathI, pathI + 3) : [];
    const wayWatched = aheadTiles.some(([sx, sy]) => dangerAt(sx, sy));
    // Run when chased, when retreating, or when completely unseen and the
    // way ahead is clear. Never run while a guard can see you — running in
    // the open inside a cone fills suspicion far faster than sneaking.
    const run = anyAlert || hottest > 70 || retreating || (!wayWatched && hottest === 0);
    const input = { up: false, down: false, left: false, right: false, sneak: !run };
    if (path && pathI < path.length) {
      // In 'go' mode with the way ahead watched: hold still if safe where
      // you stand (the patrol will move on), retreat only if you are
      // visible. In 'hide' mode the bot is retreating to cover — it must
      // keep moving, never freeze on a watched tile.
      if (mode === 'go' && wayWatched && !anyAlert && hottest < 45) {
        if (dangerAt(px, py)) {
          const hide = findRetreat(level.grid, px, py, guards, (x, y) => !dangerAt(x, y));
          if (hide && (hide[0] !== px || hide[1] !== py) && planTo(hide[0], hide[1])) {
            mode = 'hide';
            waits += 1;
          }
        }
        // Else: hold still this tick and let the patrol move on.
      } else {
        const [tx, ty] = path[pathI];
        const cx = (tx + 0.5) * TILE;
        const cy = (ty + 0.5) * TILE;
        if (Math.hypot(player.x - cx, player.y - cy) < 6) {
          pathI += 1;
        } else {
          if (player.y - cy > 4) input.up = true;
          if (cy - player.y > 4) input.down = true;
          if (player.x - cx > 4) input.left = true;
          if (cx - player.x > 4) input.right = true;
        }
      }
    }
    player.update(dt, input, world);
    for (const p of pebbles) p.update(dt, world);
    for (let i = pebbles.length - 1; i >= 0; i -= 1) {
      if (pebbles[i].done) pebbles.splice(i, 1);
    }
    for (const g of guards) g.update(dt, world);
    for (const lamp of lamps) lamp.update(dt, world);
    if (world.caught) return { won: false, reason: 'caught', t, letters, maxSuspicion, waits, pebblesThrown };
  }
  return { won: false, reason: 'timeout', t, letters, maxSuspicion, waits, pebblesThrown };
}

let allWon = true;
LEVELS.forEach((def, i) => {
  if (onlyLevel && onlyLevel !== i + 1) return;
  const r = simulate(def);
  console.log(
    `level ${i + 1} (${def.name}): ${r.won ? 'WON' : `NOT WON (${r.reason})`} in ${r.t.toFixed(1)}s, `
    + `letters ${r.letters}, max suspicion ${r.maxSuspicion.toFixed(0)}, waits ${r.waits}, pebbles ${r.pebblesThrown}`,
  );
  if (!r.won) allWon = false;
});
if (!allWon) process.exit(1);
console.log('all simulated levels winnable');

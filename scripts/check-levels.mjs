// Nightshade — level validator (Node 22, stdlib only).
// Proves every map is rectangular, every letter and the exit are reachable
// from the player start, every guard waypoint is walkable, every lamp sits
// on a non-solid tile, and guard spawns match guard definitions.
//   node scripts/check-levels.mjs
import { LEVELS, parseLevel } from '../game/src/levels.js';
import { isWalkable } from '../game/src/util.js';

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`FAIL: ${msg}`);
};

function bfs(grid, sx, sy) {
  const seen = new Set([`${sx},${sy}`]);
  const q = [[sx, sy]];
  while (q.length > 0) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || ny >= grid.length || nx >= grid[0].length) continue;
      if (!isWalkable(grid, nx, ny)) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      seen.add(key);
      q.push([nx, ny]);
    }
  }
  return seen;
}

LEVELS.forEach((def, i) => {
  const label = `level ${i + 1} (${def.name})`;
  if (def.map.length !== 16) fail(`${label}: ${def.map.length} rows, expected 16`);
  def.map.forEach((row, y) => {
    if (row.length !== 24) fail(`${label} row ${y}: length ${row.length}, expected 24 — ${JSON.stringify(row)}`);
  });
  const flat = def.map.join('');
  const count = (c) => [...flat].filter((ch) => ch === c).length;
  if (count('P') !== 1) fail(`${label}: ${count('P')} player starts, expected 1`);
  if (count('E') !== 1) fail(`${label}: ${count('E')} exits, expected 1`);
  if (count('L') < 1) fail(`${label}: no letters`);
  if (count('G') !== def.guards.length) {
    fail(`${label}: ${count('G')} guard spawns but ${def.guards.length} guard definitions`);
  }
  const lv = parseLevel(def);
  const reach = bfs(lv.grid, lv.player.x, lv.player.y);
  for (const L of lv.letters) {
    if (!reach.has(`${L.x},${L.y}`)) fail(`${label}: letter at (${L.x},${L.y}) unreachable`);
  }
  if (!reach.has(`${lv.exit.x},${lv.exit.y}`)) fail(`${label}: exit unreachable`);
  def.guards.forEach((g, k) => {
    g.waypoints.forEach(([wx, wy]) => {
      if (!isWalkable(lv.grid, wx, wy)) fail(`${label} guard ${k}: waypoint (${wx},${wy}) is not walkable`);
    });
  });
  def.lamps.forEach((lamp, k) => {
    const c = lv.grid[lamp.y]?.[lamp.x];
    if (c === '#' || c === '=') fail(`${label} lamp ${k}: sits on solid tile '${c}' at (${lamp.x},${lamp.y})`);
  });
  console.log(`level ${i + 1} (${def.name}): ${lv.letters.length} letters, ${def.guards.length} guards, ${def.lamps.length} lamps, reachable=${reach.size} tiles`);
});

if (failures > 0) {
  console.error(`${failures} problem(s) found`);
  process.exit(1);
}
console.log('all levels valid');

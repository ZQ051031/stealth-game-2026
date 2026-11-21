// Nightshade — level definitions (written fresh for this entry).
// Legend: '#' wall  '=' fountain  '.' stone  ',' gravel (loud underfoot)
//         '~' shadow  'B' bush  'P' player start  'L' letter  'E' exit
//         'G' guard spawn (patrol waypoints live in the guard list below).
//
// Every map is 24 wide x 16 tall. A validator (scripts/check-levels.mjs)
// proves each letter and the exit are reachable from the player start.

export const LEVELS = [
  {
    name: 'The Garden Wall',
    intro: 'Slip past the warden, gather the two letters, and leave by the east gate. Shadows hide you. Bushes hide you completely — unless a warden walks right up to you.',
    pebbles: 3,
    guards: [
      { waypoints: [[7, 8], [16, 8]], pause: 1.2, speed: 1.5 },
    ],
    lamps: [],
    map: [
      '########################',
      '#P....~~......B.......L#',
      '#.....~~...............#',
      '#..B..~~..####......#..#',
      '#.....~~..####......#..#',
      '#...................#.E#',
      '#..####........B....#..#',
      '#..####................#',
      '#.......G......~~......#',
      '#..............~~......#',
      '#..B.....~~....####...L#',
      '#........~~....####....#',
      '#........~~............#',
      '#....B....~~.....B.....#',
      '#......................#',
      '########################',
    ],
  },
  {
    name: 'The Courtyard',
    intro: 'Two wardens cross the courtyard and the fountain blocks the middle. Gravel near the gate is loud — sneak across it, or toss a pebble to pull a warden away.',
    pebbles: 3,
    guards: [
      { waypoints: [[11, 5], [18, 5], [18, 10], [11, 10]], pause: 0.9, speed: 1.6 },
      { waypoints: [[4, 11], [10, 11]], pause: 1.4, speed: 1.5 },
    ],
    lamps: [],
    map: [
      '########################',
      '#P.....~~......=====...#',
      '#......~~......=====..L#',
      '#..B...~~..B...=====...#',
      '#......~~..............#',
      '#..####......G.........#',
      '#..####................#',
      '#.......~~......##.....#',
      '#.......~~......##..E..#',
      '#..B....~~..B....##....#',
      '#......................#',
      '#....G......~~....L....#',
      '#...........~~.........#',
      '#..B....~~..~~...B....L#',
      '#.....,,,,,,~~.........#',
      '########################',
    ],
  },
  {
    name: 'The Library',
    intro: 'Three wardens and a sweeping watch-lamp guard the shelves. The lamp calls the nearest warden when its beam finds you — time your crossing between sweeps.',
    pebbles: 4,
    guards: [
      { waypoints: [[10, 4], [16, 4]], pause: 1.0, speed: 1.7 },
      { waypoints: [[4, 10], [11, 10]], pause: 1.2, speed: 1.6 },
      { waypoints: [[17, 10], [21, 10]], pause: 1.0, speed: 1.7 },
    ],
    lamps: [
      { x: 15, y: 1, base: Math.PI / 2, sweep: 1.1, speed: 0.55, range: 7 },
    ],
    map: [
      '########################',
      '#P....~~...####...L....#',
      '#.....~~...####........#',
      '#..B..~~...####...##...#',
      '#.....~~.........##..E.#',
      '#..####....G.....##....#',
      '#..####......B...B.....#',
      '#.......~~.....####....#',
      '#.......~~.....####..L.#',
      '#..B....~~..B..####....#',
      '#......................#',
      '#....G.....~~.....G....#',
      '#..........~~..........#',
      '#..B...~~..~~....B....L#',
      '#..........~~..........#',
      '########################',
    ],
  },
  {
    name: 'The Gallery',
    intro: 'Portraits watch from the walls and two lamps sweep the hall. Four letters, three wardens, no room for a mistake — but every patrol has a gap.',
    pebbles: 4,
    guards: [
      { waypoints: [[10, 4], [16, 4]], pause: 0.9, speed: 1.8 },
      { waypoints: [[4, 10], [11, 10]], pause: 1.1, speed: 1.7 },
      { waypoints: [[17, 10], [21, 10]], pause: 0.9, speed: 1.8 },
    ],
    lamps: [
      { x: 6, y: 1, base: Math.PI / 2, sweep: 1.0, speed: 0.6, range: 7 },
      { x: 18, y: 14, base: -Math.PI / 2, sweep: 1.0, speed: 0.5, range: 7 },
    ],
    map: [
      '########################',
      '#P....~~......####....L#',
      '#.....~~......####.....#',
      '#..B..~~..B...####..#..#',
      '#.....~~......##....#.E#',
      '#..####....G....##..#..#',
      '#..####..........B.....#',
      '#.......~~....####.....#',
      '#.......~~....####...L.#',
      '#..B....~~..B..####....#',
      '#..........~~..........#',
      '#....G.....~~....G....L#',
      '#..........~~..........#',
      '#..B...~~..~~....B....L#',
      '#.....,,,,,,~~.........#',
      '########################',
    ],
  },
  {
    name: 'The Vault',
    intro: 'The last door. Four wardens, two lamps, and the last letters behind the tightest patrols you have faced. Take your time — the night is long.',
    pebbles: 5,
    guards: [
      { waypoints: [[10, 4], [16, 4]], pause: 0.8, speed: 1.9 },
      { waypoints: [[4, 10], [11, 10]], pause: 1.0, speed: 1.8 },
      { waypoints: [[17, 10], [21, 10]], pause: 0.8, speed: 1.9 },
      { waypoints: [[4, 13], [10, 13]], pause: 1.2, speed: 1.7 },
    ],
    lamps: [
      { x: 15, y: 1, base: Math.PI / 2, sweep: 1.2, speed: 0.65, range: 8 },
      { x: 12, y: 14, base: -Math.PI / 2, sweep: 1.2, speed: 0.55, range: 8 },
    ],
    map: [
      '########################',
      '#P....~~...####...L...E#',
      '#.....~~...####........#',
      '#..B..~~...####...##...#',
      '#.....~~.........##....#',
      '#..####....G.....##....#',
      '#..####......B...##B.L.#',
      '#.......~~....####.....#',
      '#.......~~....####.....#',
      '#..B....~~..B..####....#',
      '#..........~~..........#',
      '#....G.....~~.....G...L#',
      '#..........~~..........#',
      '#..BG..~~..~~.....B...L#',
      '#......................#',
      '########################',
    ],
  },
];

// Parse a level definition into a playable grid: strip the markers out of
// the map (they become floor) and return spawn points and pickups.
export function parseLevel(def) {
  const grid = def.map.map((row) => row.split(''));
  let player = null;
  const letters = [];
  let exit = null;
  const spawns = [];
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      const c = grid[y][x];
      if (c === 'P') { player = { x, y }; grid[y][x] = '.'; }
      else if (c === 'L') { letters.push({ x, y, taken: false }); grid[y][x] = '.'; }
      else if (c === 'E') { exit = { x, y }; grid[y][x] = '.'; }
      else if (c === 'G') { spawns.push({ x, y }); grid[y][x] = '.'; }
    }
  }
  return {
    ...def,
    grid: grid.map((row) => row.join('')),
    player,
    letters,
    exit,
    spawns,
    width: grid[0].length,
    height: grid.length,
  };
}

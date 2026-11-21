// Nightshade — screenshot staging (written fresh for this entry).
// Each shot in shots.json loads the game with ?shot=<name>. The stage sets
// up a fixed, lively scene, renders one frame, then sets window.__shotReady.
import { TILE } from './util.js';

export function stageShot(world, name) {
  const { level, player, guards } = world;
  const tile = (x, y) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });

  if (name === 'cover') {
    // Level 1: Wren behind a hedge while the warden's lantern cone sweeps past.
    player.x = tile(3, 10).x;
    player.y = tile(3, 10).y;
    player.dir = Math.PI / 2;
    const g = guards[0];
    g.x = tile(10, 8).x;
    g.y = tile(10, 8).y;
    g.dir = Math.PI;
    g.suspicion = 55;
    g.state = 'suspicious';
    return 'The Garden Wall — stay out of the light.';
  }
  if (name === 'garden') {
    // Level 2: Wren crouched in a bush by the fountain, two wardens crossing.
    world.loadLevel(1);
    const p = world.player;
    p.x = tile(3, 2).x;
    p.y = tile(3, 2).y;
    p.dir = 0;
    const [g1, g2] = world.guards;
    g1.x = tile(14, 5).x; g1.y = tile(14, 5).y; g1.dir = Math.PI;
    g2.x = tile(7, 11).x; g2.y = tile(7, 11).y; g2.dir = 0;
    return 'The Courtyard — bushes hide you completely.';
  }
  if (name === 'caught') {
    // A warden, alerted, closes in on Wren — red cone, exclamation mark.
    const g = guards[0];
    g.x = tile(9, 8).x;
    g.y = tile(9, 8).y;
    g.dir = Math.atan2(player.y - g.y, player.x - g.x);
    g.suspicion = 100;
    g.state = 'alert';
    player.x = tile(11, 8).x;
    player.y = tile(11, 8).y;
    return 'Spotted — break line of sight and run.';
  }
  if (name === 'escape') {
    // Wren at the east gate with every letter gathered: the level is won.
    level.letters.forEach((L) => { L.taken = true; });
    world.lettersGot = level.letters.length;
    player.x = tile(level.exit.x, level.exit.y).x;
    player.y = tile(level.exit.x, level.exit.y).y;
    player.dir = 0;
    world.state = 'levelComplete';
    world.stars = 3;
    world.levelTime = 74.3;
    return 'Escaped unseen — three stars.';
  }
  return '';
}

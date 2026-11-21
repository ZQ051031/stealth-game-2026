// Nightshade — game loop, states, input and HUD wiring (written fresh).
import { TILE, dist } from './util.js';
import { LEVELS, parseLevel } from './levels.js';
import { Guard, Lamp } from './guard.js';
import { Player, Pebble } from './player.js';
import { drawWorld, drawOverlay } from './render.js';
import { stageShot } from './shots.js';
import { sfx, isMuted, setMuted } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hud = {
  level: document.getElementById('hud-level'),
  letters: document.getElementById('hud-letters'),
  pebbles: document.getElementById('hud-pebbles'),
  eye: document.getElementById('hud-eye'),
  time: document.getElementById('hud-time'),
  toast: document.getElementById('toast'),
  mute: document.getElementById('btn-mute'),
  pause: document.getElementById('btn-pause'),
};
const screens = {
  title: document.getElementById('screen-title'),
  intro: document.getElementById('screen-intro'),
  over: document.getElementById('screen-over'),
};

const input = { up: false, down: false, left: false, right: false, sneak: false };

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem('nightshade-progress') ?? '{}');
  } catch {
    return {};
  }
}
function saveProgress(p) {
  try {
    localStorage.setItem('nightshade-progress', JSON.stringify(p));
  } catch {
    // progress is a nicety, not a requirement
  }
}

class World {
  constructor() {
    this.progress = loadProgress();
    this.levelIndex = 0;
    this.state = 'title'; // title | intro | play | paused | caught | levelComplete | gameComplete
    this.time = 0;
    this.levelTime = 0;
    this.lettersGot = 0;
    this.stars = 0;
    this.toastTimer = 0;
    this.pebbles = [];
    this.rings = [];
    this.shotCaption = '';
    this.loadLevel(0);
  }

  loadLevel(i) {
    this.levelIndex = i;
    this.level = parseLevel(LEVELS[i]);
    canvas.width = this.level.width * TILE;
    canvas.height = this.level.height * TILE;
    this.player = new Player(this.level, this.level.player);
    this.player.pebbles = this.level.pebbles;
    this.guards = this.level.guards.map((g, k) => new Guard(this.level, g, this.level.spawns[k] ?? { x: 2, y: 2 }));
    this.lamps = this.level.lamps.map((l) => new Lamp(this.level, l));
    this.pebbles = [];
    this.rings = [];
    this.lettersGot = 0;
    this.levelTime = 0;
    this.stars = 0;
  }

  // --- world event hooks called by guards / player / lamps ----------------
  onStep(player) {
    sfx.step(player.sneaking);
  }
  onNoise(x, y, radius) {
    this.rings.push({ x, y, r: radius, t: 0, life: 0.9 });
    for (const g of this.guards) {
      if (dist(g.x, g.y, x, y) < radius + 2 * TILE) g.hearNoise(x, y);
    }
  }
  onPebbleLand(x, y) {
    sfx.pebbleLand();
    this.rings.push({ x, y, r: 6 * TILE, t: 0, life: 0.9 });
  }
  onSuspicious() {
    sfx.suspicious();
    this.toast('A warden thinks it saw something…');
  }
  onSpotted() {
    sfx.alert();
    this.toast('Spotted! Break line of sight!');
  }
  onLampSpot() {
    this.toast('A watch-lamp found you — a warden is coming!');
  }
  onCaught() {
    if (this.state !== 'play') return;
    this.state = 'caught';
    sfx.caught();
  }

  toast(msg) {
    hud.toast.textContent = msg;
    hud.toast.classList.add('show');
    this.toastTimer = 2.6;
  }

  throwPebble(wx, wy) {
    if (this.state !== 'play') return;
    if (this.player.pebbles <= 0) {
      this.toast('No pebbles left.');
      return;
    }
    const dx = wx - this.player.x;
    const dy = wy - this.player.y;
    const d = Math.hypot(dx, dy);
    const range = 7 * TILE;
    const k = Math.min(1, range / Math.max(1, d));
    this.player.pebbles -= 1;
    this.pebbles.push(new Pebble(this.player.x, this.player.y, this.player.x + dx * k, this.player.y + dy * k));
    sfx.pebbleThrow();
  }

  update(dt) {
    this.time += dt;
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) hud.toast.classList.remove('show');
    }
    for (const ring of this.rings) ring.t += dt;
    this.rings = this.rings.filter((r) => r.t < r.life);
    if (this.state !== 'play') return;
    this.levelTime += dt;
    this.player.update(dt, input, this);
    for (const p of this.pebbles) p.update(dt, this);
    this.pebbles = this.pebbles.filter((p) => !p.done);
    for (const g of this.guards) g.update(dt, this);
    for (const lamp of this.lamps) lamp.update(dt, this);
    // Pick up letters.
    for (const L of this.level.letters) {
      if (!L.taken && dist(this.player.x, this.player.y, (L.x + 0.5) * TILE, (L.y + 0.5) * TILE) < 0.8 * TILE) {
        L.taken = true;
        this.lettersGot += 1;
        sfx.pickup();
        this.toast(`Letter ${this.lettersGot} of ${this.level.letters.length}`);
      }
    }
    // Reach the exit with every letter.
    const ex = this.level.exit;
    if (this.lettersGot === this.level.letters.length
      && dist(this.player.x, this.player.y, (ex.x + 0.5) * TILE, (ex.y + 0.5) * TILE) < 0.9 * TILE) {
      this.completeLevel();
    }
  }

  completeLevel() {
    const maxSuspicion = Math.max(0, ...this.guards.map((g) => g.maxSuspicion));
    this.stars = 1 + (this.lettersGot === this.level.letters.length ? 1 : 0) + (maxSuspicion < 40 ? 1 : 0);
    const key = String(this.levelIndex);
    if ((this.progress[key] ?? 0) < this.stars) {
      this.progress[key] = this.stars;
      saveProgress(this.progress);
    }
    this.state = this.levelIndex === LEVELS.length - 1 ? 'gameComplete' : 'levelComplete';
    if (this.state === 'gameComplete') sfx.win();
    else sfx.exitOpen();
  }

  render() {
    drawWorld(ctx, this);
    const W = canvas.width;
    const H = canvas.height;
    if (this.state === 'caught') {
      drawOverlay(ctx, W, H, [
        ['Caught!', 44, '#ff6b5e'],
        ['The warden found you. Press R to try again.', 17],
      ]);
    } else if (this.state === 'levelComplete') {
      drawOverlay(ctx, W, H, [
        [`${this.level.name} — escaped!`, 32, '#7cf2ab'],
        [`${'★'.repeat(this.stars)}${'☆'.repeat(3 - this.stars)}    ${this.levelTime.toFixed(1)}s`, 26, '#ffd166'],
        ['Press Enter for the next level', 16],
      ]);
    } else if (this.state === 'gameComplete') {
      drawOverlay(ctx, W, H, [
        ['Nightshade — every letter recovered.', 30, '#7cf2ab'],
        ['You slipped through the whole estate unseen.', 17],
        ['Press Enter to play again', 16],
      ]);
    } else if (this.state === 'paused') {
      drawOverlay(ctx, W, H, [
        ['Paused', 40],
        ['P / Esc to resume — R restarts the level', 16],
      ]);
    }
  }

  updateHud() {
    const maxSuspicion = Math.max(0, ...this.guards.map((g) => g.suspicion));
    hud.level.textContent = `${this.levelIndex + 1}. ${this.level.name}`;
    hud.letters.textContent = `✉ ${this.lettersGot}/${this.level.letters.length}`;
    hud.pebbles.textContent = `● ${this.player.pebbles}`;
    hud.time.textContent = `${Math.floor(this.levelTime / 60)}:${String(Math.floor(this.levelTime % 60)).padStart(2, '0')}`;
    const eye = hud.eye;
    if (maxSuspicion >= 100) { eye.textContent = '👁 ALERT'; eye.className = 'eye alert'; }
    else if (maxSuspicion >= 40) { eye.textContent = '👁 ?'; eye.className = 'eye wary'; }
    else if (maxSuspicion > 2) { eye.textContent = '👁 …'; eye.className = 'eye wary'; }
    else { eye.textContent = '👁 unseen'; eye.className = 'eye calm'; }
  }
}

const world = new World();

// --- screens ---------------------------------------------------------------
function show(el) {
  for (const s of Object.values(screens)) s.classList.add('hidden');
  if (el) el.classList.remove('hidden');
}

function buildLevelButtons() {
  const box = document.getElementById('level-list');
  box.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const b = document.createElement('button');
    const stars = world.progress[String(i)] ?? 0;
    const unlocked = i === 0 || (world.progress[String(i - 1)] ?? 0) > 0;
    b.textContent = `${i + 1}. ${lv.name}  ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`;
    b.disabled = !unlocked;
    b.addEventListener('click', () => {
      sfx.click();
      startLevel(i);
    });
    box.appendChild(b);
  });
}

function startLevel(i) {
  world.loadLevel(i);
  world.state = 'intro';
  document.getElementById('intro-title').textContent = world.level.name;
  document.getElementById('intro-text').textContent = world.level.intro;
  show(screens.intro);
}

function startPlaying() {
  world.state = 'play';
  show(null);
}

document.getElementById('btn-begin').addEventListener('click', () => {
  sfx.click();
  startLevel(0);
});
document.getElementById('btn-intro-go').addEventListener('click', () => {
  sfx.click();
  startPlaying();
});
document.getElementById('btn-retry').addEventListener('click', () => {
  sfx.click();
  startLevel(world.levelIndex);
});
document.getElementById('btn-again').addEventListener('click', () => {
  sfx.click();
  buildLevelButtons();
  show(screens.title);
});
document.getElementById('btn-title').addEventListener('click', () => {
  sfx.click();
  buildLevelButtons();
  world.state = 'title';
  show(screens.title);
});

hud.mute.textContent = isMuted() ? '🔇' : '🔊';
hud.mute.addEventListener('click', () => {
  setMuted(!isMuted());
  hud.mute.textContent = isMuted() ? '🔇' : '🔊';
});
hud.pause.addEventListener('click', () => {
  if (world.state === 'play') { world.state = 'paused'; }
  else if (world.state === 'paused') { world.state = 'play'; }
});

// --- keyboard / mouse --------------------------------------------------------
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sneak', ShiftRight: 'sneak',
};

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  const k = KEYMAP[e.code];
  if (k) input[k] = true;
  if (e.code === 'KeyM') {
    setMuted(!isMuted());
    hud.mute.textContent = isMuted() ? '🔇' : '🔊';
  }
  if (e.code === 'KeyR' && (world.state === 'play' || world.state === 'caught' || world.state === 'paused')) {
    startLevel(world.levelIndex);
  }
  if ((e.code === 'KeyP' || e.code === 'Escape')) {
    if (world.state === 'play') world.state = 'paused';
    else if (world.state === 'paused') world.state = 'play';
  }
  if (e.code === 'Enter') {
    if (world.state === 'levelComplete') startLevel(world.levelIndex + 1);
    else if (world.state === 'gameComplete') { buildLevelButtons(); world.state = 'title'; show(screens.title); }
    else if (world.state === 'intro') startPlaying();
  }
});
window.addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) input[k] = false;
});

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  world.throwPebble((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
});

// --- screenshot mode ---------------------------------------------------------
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  // Stage a fixed scene, render it once, and tell the shooter we're ready.
  world.state = 'play';
  world.shotCaption = stageShot(world, shot);
  show(null);
  world.render();
  world.updateHud();
  requestAnimationFrame(() => {
    world.render();
    window.__shotReady = true;
  });
} else {
  buildLevelButtons();
  show(screens.title);
}

// --- main loop ---------------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!shot) {
    world.update(dt);
    world.render();
    world.updateHud();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

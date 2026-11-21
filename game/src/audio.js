// Nightshade — tiny WebAudio synth, all sounds generated in code.
// No audio files, no network. Created lazily on the first user gesture.
let ctx = null;
let muted = false;

try {
  muted = localStorage.getItem('nightshade-muted') === '1';
} catch {
  muted = false;
}

export function isMuted() {
  return muted;
}

export function setMuted(m) {
  muted = !!m;
  try {
    localStorage.setItem('nightshade-muted', muted ? '1' : '0');
  } catch {
    // storage unavailable; mute still applies for this session
  }
}

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// A short oscillator blip: freq slides from f0 to f1 over `dur` seconds.
function blip(f0, f1, dur, type = 'sine', gain = 0.12, delay = 0) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noiseBurst(dur, gain = 0.08, delay = 0) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(g).connect(c.destination);
  src.start(t0);
}

export const sfx = {
  step(sneak) {
    noiseBurst(0.05, sneak ? 0.015 : 0.045);
  },
  pebbleThrow() {
    blip(700, 300, 0.12, 'triangle', 0.07);
  },
  pebbleLand() {
    noiseBurst(0.09, 0.1);
    blip(220, 140, 0.08, 'square', 0.05);
  },
  pickup() {
    blip(880, 880, 0.09, 'sine', 0.1);
    blip(1320, 1320, 0.12, 'sine', 0.09, 0.08);
  },
  suspicious() {
    blip(520, 660, 0.16, 'triangle', 0.09);
  },
  alert() {
    blip(392, 392, 0.14, 'square', 0.09);
    blip(311, 311, 0.18, 'square', 0.09, 0.13);
  },
  caught() {
    blip(330, 110, 0.5, 'sawtooth', 0.12);
    noiseBurst(0.3, 0.08, 0.05);
  },
  exitOpen() {
    blip(523, 523, 0.1, 'sine', 0.09);
    blip(659, 659, 0.1, 'sine', 0.09, 0.09);
    blip(784, 784, 0.16, 'sine', 0.09, 0.18);
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => blip(f, f, 0.18, 'sine', 0.1, i * 0.12));
  },
  click() {
    blip(600, 500, 0.05, 'triangle', 0.05);
  },
};

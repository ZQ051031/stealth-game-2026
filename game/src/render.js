// Nightshade — canvas rendering, all art drawn in code (written fresh).
import { TILE } from './util.js';

// Deterministic speckles per tile so floors don't look flat.
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

export function drawWorld(ctx, world) {
  const { level, player, guards, lamps } = world;
  const { grid } = level;
  const W = grid[0].length * TILE;
  const H = grid.length * TILE;

  // Night backdrop.
  ctx.fillStyle = '#0a0d18';
  ctx.fillRect(0, 0, W, H);

  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      const c = grid[y][x];
      const px = x * TILE;
      const py = y * TILE;
      const v = hash2(x, y);
      if (c === '#') {
        ctx.fillStyle = '#232a3d';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#313a55';
        ctx.fillRect(px, py, TILE, 5);
        ctx.fillStyle = '#1a2033';
        ctx.fillRect(px, py + TILE - 4, TILE, 4);
      } else if (c === '=') {
        ctx.fillStyle = '#16324a';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#1e4a6b';
        ctx.beginPath();
        ctx.arc(px + 10 + v * 12, py + 10 + v * 12, 3 + v * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2a6a94';
        ctx.beginPath();
        ctx.arc(px + 8 + v * 16, py + 18 - v * 6, 2 + v * 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Stone floor with a faint checker + speckle.
        const odd = (x + y) % 2 === 0;
        ctx.fillStyle = odd ? '#2b2f42' : '#282c3e';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(px + v * 20, py + v * 20, 3, 3);
        if (c === ',') {
          ctx.fillStyle = '#4a4234';
          for (let i = 0; i < 5; i += 1) {
            ctx.fillRect(px + hash2(x * 5 + i, y) * 28, py + hash2(x, y * 5 + i) * 28, 2, 2);
          }
        } else if (c === '~') {
          ctx.fillStyle = 'rgba(6,8,20,0.55)';
          ctx.fillRect(px, py, TILE, TILE);
        } else if (c === 'B') {
          ctx.fillStyle = '#1d3a24';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = '#2c5a35';
          ctx.beginPath();
          ctx.arc(px + 9, py + 11, 7, 0, Math.PI * 2);
          ctx.arc(px + 21, py + 9, 8, 0, Math.PI * 2);
          ctx.arc(px + 15, py + 21, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#3a7a48';
          ctx.beginPath();
          ctx.arc(px + 12, py + 13, 3, 0, Math.PI * 2);
          ctx.arc(px + 22, py + 18, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // Exit gate: a lit doorway with a soft green glow.
  const ex = level.exit;
  const exx = (ex.x + 0.5) * TILE;
  const exy = (ex.y + 0.5) * TILE;
  const pulse = 0.6 + 0.4 * Math.sin(world.time * 2.4);
  ctx.save();
  ctx.globalAlpha = 0.25 + 0.2 * pulse;
  ctx.fillStyle = '#37d67a';
  ctx.beginPath();
  ctx.arc(exx, exy, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#0f2a1a';
  ctx.fillRect(exx - 11, exy - 13, 22, 26);
  ctx.strokeStyle = '#37d67a';
  ctx.lineWidth = 2;
  ctx.strokeRect(exx - 11, exy - 13, 22, 26);
  ctx.fillStyle = '#7cf2ab';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT', exx, exy + 1);

  // Letters: glowing envelopes.
  for (const L of level.letters) {
    if (L.taken) continue;
    const lx = (L.x + 0.5) * TILE;
    const ly = (L.y + 0.5) * TILE + Math.sin(world.time * 3 + L.x) * 2;
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.2 * pulse;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(lx, ly, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#f4e3c0';
    ctx.fillRect(lx - 8, ly - 6, 16, 12);
    ctx.strokeStyle = '#b98a2f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lx - 8, ly - 6);
    ctx.lineTo(lx, ly + 1);
    ctx.lineTo(lx + 8, ly - 6);
    ctx.stroke();
    ctx.fillStyle = '#8a5a1d';
    ctx.beginPath();
    ctx.arc(lx, ly + 1, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lamp beams (under the guards' cones, above the floor).
  for (const lamp of lamps) {
    const poly = lamp.beamPolygon();
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i += 1) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#3a3f55';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Guard vision cones, then the guards themselves.
  for (const g of guards) {
    const poly = g.cone();
    const alert = g.alertLevel;
    ctx.save();
    ctx.globalAlpha = alert === 2 ? 0.34 : alert === 1 ? 0.26 : 0.17;
    ctx.fillStyle = alert === 2 ? '#ff5a4e' : alert === 1 ? '#ffb347' : '#ffe9a8';
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i += 1) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  for (const g of guards) {
    // Body: a warden in a dark-blue coat with a brass lantern.
    ctx.fillStyle = '#2e3d66';
    ctx.beginPath();
    ctx.arc(g.x, g.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a6ea8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(g.x + Math.cos(g.dir) * 13, g.y + Math.sin(g.dir) * 13, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#dfe6ff';
    ctx.beginPath();
    ctx.arc(g.x - Math.cos(g.dir) * 3, g.y - Math.sin(g.dir) * 3, 3, 0, Math.PI * 2);
    ctx.fill();
    // Alert marker.
    if (g.alertLevel === 2) {
      ctx.fillStyle = '#ff5a4e';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', g.x, g.y - 20);
    } else if (g.alertLevel === 1) {
      ctx.fillStyle = '#ffb347';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', g.x, g.y - 20);
    }
    // Suspicion arc under the guard.
    if (g.suspicion > 2) {
      ctx.strokeStyle = g.suspicion >= 100 ? '#ff5a4e' : '#ffb347';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 16, -Math.PI / 2, -Math.PI / 2 + (g.suspicion / 100) * Math.PI * 2);
      ctx.stroke();
    }
  }

  // Pebbles in flight and fading noise rings.
  for (const p of world.pebbles) {
    ctx.fillStyle = '#c9c9c9';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const ring of world.rings) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.5 * (1 - ring.t / ring.life));
    ctx.strokeStyle = '#9fd8ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r * (0.3 + 0.7 * (ring.t / ring.life)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // The player: Wren in a dark-green cloak, half-hidden when inside a bush.
  const px = player.x;
  const py = player.y;
  ctx.save();
  if (player.inBush) ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#1f4d2e';
  ctx.beginPath();
  ctx.arc(px, py, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#57b26a';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#0d2415';
  ctx.beginPath();
  ctx.arc(px + Math.cos(player.dir) * 5, py + Math.sin(player.dir) * 5, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8f5e9';
  ctx.beginPath();
  ctx.arc(px + Math.cos(player.dir) * 7, py + Math.sin(player.dir) * 7, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Night vignette: the dark is the point.
  const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
  grad.addColorStop(0, 'rgba(4,6,16,0)');
  grad.addColorStop(1, 'rgba(4,6,16,0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

// Big centred overlay text (title screen, caught, level complete).
export function drawOverlay(ctx, W, H, lines, accent = '#e8ecff') {
  ctx.save();
  ctx.fillStyle = 'rgba(5,7,18,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let y = H / 2 - (lines.length - 1) * 26;
  for (const [text, size, color] of lines) {
    ctx.font = `bold ${size}px sans-serif`;
    ctx.fillStyle = color ?? accent;
    ctx.fillText(text, W / 2, y);
    y += size + 16;
  }
  ctx.restore();
}

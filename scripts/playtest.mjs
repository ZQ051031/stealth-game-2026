// Nightshade — headless playtest (Node 22, standard library only).
// Loads the game in headless Chrome over the DevTools protocol, once per
// shot scene and once on the plain title screen, and reports any console
// error or uncaught exception. Also drives a scripted playthrough of level
// 1 (click Begin, walk right) to prove the loop runs without errors.
//   node scripts/playtest.mjs [/path/to/chrome]
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = fileURLToPath(new URL('..', import.meta.url));
const chrome = process.argv[2] ?? process.env.CHROME ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`;
const page = pathToFileURL(join(here, 'game', 'index.html')).href;
const port = 9334;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const proc = spawn(
  chrome,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    '--window-size=1280,720',
    '--hide-scrollbars',
    '--allow-file-access-from-files',
    `--user-data-dir=${join(here, '.chrome-playtest')}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const errors = [];
let target;
for (let i = 0; i < 50 && !target; i += 1) {
  await sleep(200);
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    target = list.find((t) => t.type === 'page');
  } catch {
    // Chrome is still starting.
  }
}
if (!target) {
  proc.kill();
  throw new Error('chrome did not start');
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(String(m.data));
  if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(`exception: ${msg.params.exceptionDetails?.exception?.description ?? JSON.stringify(msg.params.exceptionDetails)}`);
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    errors.push(`console.error: ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
  }
  if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg.result ?? msg.error);
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    id += 1;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

async function evalJs(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r?.result?.value;
}

// 1. Every shot scene must become ready.
const shots = JSON.parse((await import('node:fs')).readFileSync(join(here, 'shots.json'), 'utf8'));
for (const shot of shots) {
  await send('Page.navigate', { url: page + shot.query });
  let ready = false;
  for (let i = 0; i < 100 && !ready; i += 1) {
    await sleep(100);
    ready = await evalJs('window.__shotReady === true');
  }
  console.log(ready ? `shot ready: ${shot.name}` : `SHOT NOT READY: ${shot.name}`);
  if (!ready) errors.push(`shot not ready: ${shot.name}`);
}

// 2. Title screen loads, Begin starts level 1, movement runs clean.
await send('Page.navigate', { url: page });
await sleep(800);
console.log('title visible:', await evalJs(`!document.getElementById('screen-title').classList.contains('hidden')`));
await evalJs(`document.getElementById('btn-begin').click()`);
await sleep(300);
await evalJs(`document.getElementById('btn-intro-go').click()`);
await sleep(300);
console.log('state after begin:', await evalJs(`document.getElementById('screen-intro').classList.contains('hidden')`));
// Hold D (walk right) for 2 seconds via synthetic key events.
await evalJs(`
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
  'keys-down';
`);
await sleep(2000);
await evalJs(`
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
  'keys-up';
`);
const hudTime = await evalJs(`document.getElementById('hud-time').textContent`);
console.log('HUD clock after walking right:', hudTime);
console.log('canvas painted (non-blank):', await evalJs(`
  (() => {
    const c = document.getElementById('game');
    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 401) sum += d[i] + d[i + 1] + d[i + 2];
    return sum > 0;
  })()
`));

ws.close();
proc.kill();

if (errors.length > 0) {
  console.error(`\n${errors.length} error(s):`);
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}
console.log('\nplaytest clean: no console errors, no exceptions');

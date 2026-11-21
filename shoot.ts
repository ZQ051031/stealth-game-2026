// Nightshade — screenshot runner (Node 22, standard library only).
// Renders the scenes listed in shots.json with headless Chrome over the
// DevTools protocol and writes real JPEG renders into screenshots/:
//   node shoot.ts [/path/to/chrome]
// Each scene is game/index.html?shot=<name>; the game stages the scene and
// sets window.__shotReady when the frame is ready to capture.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const chrome = process.argv[2] ?? process.env.CHROME ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`;
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
const page = pathToFileURL(join(here, 'game', 'index.html')).href;
const port = 9333;

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
    `--user-data-dir=${join(here, '.chrome-shots')}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

let target;
for (let i = 0; i < 50 && !target; i += 1) {
  await sleep(200);
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    target = list.find((t) => t.type === 'page');
  } catch {
    // Chrome is still starting; keep waiting.
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
  if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg.result ?? msg.error);
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    id += 1;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
mkdirSync(join(here, 'screenshots'), { recursive: true });
for (const shot of shots) {
  await send('Page.navigate', { url: page + shot.query });
  let ready = false;
  for (let i = 0; i < 100 && !ready; i += 1) {
    await sleep(100);
    const r = await send('Runtime.evaluate', { expression: 'window.__shotReady === true', returnByValue: true });
    ready = r?.result?.value === true;
  }
  if (!ready) {
    ws.close();
    proc.kill();
    throw new Error(`${shot.name}: the scene never became ready`);
  }
  const jpeg = shot.name.endsWith('.jpg');
  const shot2 = await send('Page.captureScreenshot', jpeg ? { format: 'jpeg', quality: 88 } : { format: 'png' });
  writeFileSync(join(here, 'screenshots', shot.name), Buffer.from(shot2.data, 'base64'));
  console.log('wrote', shot.name);
}
ws.close();
proc.kill();

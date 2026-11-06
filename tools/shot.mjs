// 用已经在跑的 Edge CDP 端口截图：node tools/shot.mjs <url> <out.png> [宽] [高] [--mobile] [--full]
const [, , url, out, w = '1280', h = '900', ...flags] = process.argv;
const PORT = process.env.CDP_PORT || 9333;
const width = Number(w);
const height = Number(h);
const mobile = flags.includes('--mobile');
const full = flags.includes('--full');
const waitMs = Number(process.env.SHOT_WAIT || 1800);

async function json(path, init) {
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`, init);
  return r.json();
}

const target = await json(`/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
});

function send(method, params = {}) {
  const mid = ++id;
  ws.send(JSON.stringify({ id: mid, method, params }));
  return new Promise((res, rej) => {
    pending.set(mid, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)));
    setTimeout(() => rej(new Error(`timeout ${method}`)), 20000);
  });
}

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width,
  height,
  deviceScaleFactor: 2,
  mobile,
});
await send('Page.navigate', { url });
await new Promise((r) => setTimeout(r, waitMs));

let clip;
if (full) {
  const { cssContentSize } = await send('Page.getLayoutMetrics');
  clip = { x: 0, y: 0, width, height: Math.min(cssContentSize.height, 4000), scale: 1 };
}

const shot = await send('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: Boolean(full),
  ...(clip ? { clip } : {}),
});

const { writeFile } = await import('node:fs/promises');
await writeFile(out, Buffer.from(shot.data, 'base64'));
console.log('saved', out);
ws.close();
// 关闭 target 时 DevTools 可能已经回 "Target is closing"，不算失败
try {
  await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`).then((r) => r.text());
} catch {}
process.exit(0);

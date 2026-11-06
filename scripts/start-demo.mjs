// 一键启动：PocketBase → 建表/导数据 → 网页服务器 → 打开浏览器
// 用法：node scripts/start-demo.mjs [--no-open] [--check]
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const PB_EXE = join(ROOT, 'server/pocketbase/pocketbase.exe');
const WEB_PORT = Number(process.env.PORT || 8088);
const PB_PORT = Number(process.env.PB_PORT || 8090);
const noOpen = process.argv.includes('--no-open');
const checkOnly = process.argv.includes('--check');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function up(url) {
  try {
    const ctl = AbortSignal.timeout(1200);
    const r = await fetch(url, { signal: ctl });
    return r.ok || r.status === 404;
  } catch {
    return false;
  }
}

async function waitFor(url, seconds) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    if (await up(url)) return true;
    await sleep(400);
  }
  return false;
}

// 挑一个手机能连的地址：优先 Wi-Fi/以太网 + 私有网段，跳过 Radmin/虚拟机那种 26.x、169.254.x
function candidates() {
  const out = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      const a = net.address;
      if (a.startsWith('169.254.')) continue;
      let score = 0;
      if (/wi-?fi|wlan|ethernet|以太网|无线/i.test(name)) score += 2;
      if (a.startsWith('192.168.')) score += 4;
      else if (a.startsWith('10.')) score += 3;
      else if (/^172\.(1[6-9]|2\d|3[01])\./.test(a)) score += 3;
      else score -= 2;
      out.push({ name, address: a, score });
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

function lanIp() {
  return candidates()[0]?.address ?? '127.0.0.1';
}

const children = [];
function start(cmd, args, label) {
  const child = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', windowsHide: false });
  children.push({ child, label });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) console.log(`\n[demo] ${label} 退出了（code ${code}）`);
  });
  return child;
}

function stopAll() {
  for (const { child } of children) {
    if (!child.killed) child.kill();
  }
}
process.on('SIGINT', () => {
  console.log('\n[demo] 收工，关掉后台进程');
  stopAll();
  process.exit(0);
});
process.on('exit', stopAll);

console.log('[demo] 检查 PocketBase…');
let pbRunning = await up(`http://127.0.0.1:${PB_PORT}/api/health`);

if (!pbRunning) {
  if (!existsSync(PB_EXE)) {
    console.error('[demo] 找不到 server/pocketbase/pocketbase.exe，先跑：node tools/fetch-pocketbase.mjs');
    process.exit(1);
  }
  console.log('[demo] 启动 PocketBase（' + PB_PORT + '）…');
  start(PB_EXE, ['serve', '--http=127.0.0.1:' + PB_PORT, '--dir=' + join(ROOT, 'server/pocketbase/pb_data')], 'PocketBase');
  pbRunning = await waitFor(`http://127.0.0.1:${PB_PORT}/api/health`, 30);
}

if (!pbRunning) {
  console.error('[demo] PocketBase 没起来。单独跑 pnpm pb 看报错。');
  process.exit(1);
}

// 数据库空的话自动导一次演示数据
const count = await fetch(
  `http://127.0.0.1:${PB_PORT}/api/collections/tasks/records?perPage=1`,
).then((r) => (r.ok ? r.json() : { totalItems: -1 }));

if (count.totalItems === 0) {
  console.log('[demo] 数据库是空的，导入演示数据…');
  await new Promise((resolve, reject) => {
    const seed = start(process.execPath, [join(ROOT, 'seed/seed.mjs')], 'seed');
    seed.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('seed failed'))));
  });
}

console.log('[demo] 检查网页服务器…');
let webRunning = await up(`http://127.0.0.1:${WEB_PORT}/`);

if (!webRunning) {
  if (!existsSync(join(ROOT, 'web/dist/index.html'))) {
    console.log('[demo] 还没有构建产物，先构建…');
    await new Promise((resolve, reject) => {
      const build = start('pnpm', ['build'], 'build');
      build.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('build failed'))));
    });
  }
  console.log('[demo] 启动网页服务器（' + WEB_PORT + '）…');
  start(process.execPath, [join(ROOT, 'server/index.mjs')], 'web');
  webRunning = await waitFor(`http://127.0.0.1:${WEB_PORT}/`, 20);
}

if (!webRunning) {
  console.error('[demo] 网页服务器没起来。单独跑 pnpm start 看报错。');
  process.exit(1);
}

const ip = lanIp();
const others = candidates()
  .filter((c) => c.address !== ip && c.score > 0)
  .map((c) => `     还有 ${c.name}: ${c.address}`)
  .join('\n');
console.log(`
────────────────────────────────────────────
 本机打开：   http://127.0.0.1:${WEB_PORT}
 手机打开：   http://${ip}:${WEB_PORT}   （同一 Wi-Fi）
 扫码测试：   http://127.0.0.1:${WEB_PORT}/t/a7K2m9
 二维码里的地址必须和「手机打开」一致；不一致就重新生成：
   python scripts/gen_cards.py --base-url http://${ip}:${WEB_PORT}
${others ? others + '\n' : ''}────────────────────────────────────────────
 关掉这个窗口 = 全部停止（Ctrl+C）
`);

if (checkOnly) {
  stopAll();
  process.exit(0);
}

if (!noOpen) {
  const { exec } = await import('node:child_process');
  exec(`start "" http://127.0.0.1:${WEB_PORT}`, { shell: 'cmd.exe' });
}

// 常驻：把子进程的输出留在窗口里
await new Promise(() => {});

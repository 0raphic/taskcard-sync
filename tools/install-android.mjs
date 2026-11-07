// 安装 Android SDK（命令行工具 + platform-tools + platform + build-tools）
// 用法：node tools/install-android.mjs
// 默认装到 D:\Application\Android\Sdk，可用 ANDROID_SDK_ROOT 覆盖
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const SDK = process.env.ANDROID_SDK_ROOT || 'D:/Application/AI/Android/Sdk';
const CACHE = join(import.meta.dirname, '..', '.cache');
const ZIP = join(CACHE, 'cmdline-tools.zip');
const URL =
  'https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip';
const TOOLS = join(SDK, 'cmdline-tools');
const LATEST = join(TOOLS, 'latest');
const SDKMGR = join(LATEST, 'bin', 'sdkmanager.bat');

function log(...a) {
  console.log('[android]', ...a);
}

function run(cmd, args, { input = '' } = {}) {
  return new Promise((resolve, reject) => {
    // Node 24 在 Windows 上不允许直接 spawn .bat，得走 cmd.exe /c
    const isBat = /\.bat$/i.test(cmd);
    const file = isBat ? 'cmd.exe' : cmd;
    const argv = isBat ? ['/c', cmd, ...args] : args;
    const p = spawn(file, argv, { stdio: ['pipe', 'pipe', 'pipe'], shell: false, windowsHide: true });
    let out = '';
    p.stdout.on('data', (d) => {
      out += d;
      process.stdout.write(d);
    });
    p.stderr.on('data', (d) => {
      out += d;
      process.stderr.write(d);
    });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} exit ${code}`))));
    if (input) {
      p.stdin.write(input);
      p.stdin.end();
    } else {
      p.stdin.end();
    }
  });
}

async function download(url, dest) {
  const t = Date.now();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length') || 0);
  let got = 0;
  const stream = Readable.fromWeb(res.body);
  stream.on('data', (c) => {
    got += c.length;
    if (total && got % (20 * 1024 * 1024) < c.length) {
      log(`下载 ${(got / 1e6).toFixed(0)}/${(total / 1e6).toFixed(0)} MB`);
    }
  });
  await pipeline(stream, createWriteStream(dest));
  log(`下载完成 ${(got / 1e6).toFixed(1)}MB 用时 ${((Date.now() - t) / 1000).toFixed(1)}s`);
}

mkdirSync(CACHE, { recursive: true });
mkdirSync(SDK, { recursive: true });

if (!existsSync(SDKMGR)) {
  if (!existsSync(ZIP) || statSync(ZIP).size < 100 * 1024 * 1024) {
    log('下载 Android 命令行工具…');
    await download(URL, ZIP);
  }
  log('解压…');
  const tmp = join(SDK, 'cmdline-tools-tmp');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  await run('powershell', [
    '-NoProfile',
    '-Command',
    `Expand-Archive -LiteralPath '${ZIP}' -DestinationPath '${tmp}' -Force`,
  ]);
  mkdirSync(TOOLS, { recursive: true });
  rmSync(LATEST, { recursive: true, force: true });
  renameSync(join(tmp, 'cmdline-tools'), LATEST);
  rmSync(tmp, { recursive: true, force: true });
  log('命令行工具装好：', LATEST);
}

log('接受许可…');
await run(SDKMGR, [`--sdk_root=${SDK}`, '--licenses'], { input: 'y\n'.repeat(60) });

log('安装 platform-tools / platforms;android-35 / build-tools;35.0.0 …');
await run(SDKMGR, [
  `--sdk_root=${SDK}`,
  'platform-tools',
  'platforms;android-35',
  'build-tools;35.0.0',
]);

log('完成。SDK 路径：', SDK);

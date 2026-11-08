// 打包一份可交付的源码压缩包（不含依赖、数据库、构建缓存），放到 dist/
// 用法：node scripts/package.mjs
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const STAGE = join(DIST, '.stage');

const INCLUDE = [
  'README.md',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.gitignore',
  'start-demo.cmd',
  'docs',
  'seed',
  'scripts',
  'server/index.mjs',
  'cards',
  'web/index.html',
  'web/package.json',
  'web/tsconfig.json',
  'web/vite.config.ts',
  'web/public',
  'web/src',
  'android/settings.gradle.kts',
  'android/build.gradle.kts',
  'android/gradle.properties',
  'android/app/build.gradle.kts',
  'android/app/src',
  'tools/build-apk.mjs',
  'tools/install-android.mjs',
  'tools/fetch-pocketbase.mjs',
  'tools/shot.mjs',
  'dist/taskcard-1.1.0-release.apk',
  'dist/taskcard.apk',
];

const SKIP_DIRS = new Set(['node_modules', '.git', '.shots', '.edge-profile', '.cache', '.pnpm-store', 'pb_data', 'build', '.gradle']);

function copyFiltered(src, dest) {
  if (!existsSync(src)) return;
  if (statSync(src).isDirectory()) {
    mkdirSync(dest, { recursive: true });
    for (const name of readdirSync(src)) {
      if (SKIP_DIRS.has(name)) continue;
      copyFiltered(join(src, name), join(dest, name));
    }
    return;
  }
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest);
}

if (existsSync(STAGE)) rmSync(STAGE, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });
mkdirSync(DIST, { recursive: true });

for (const rel of INCLUDE) copyFiltered(join(ROOT, rel), join(STAGE, rel));

const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
let commit = '';
try {
  commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
} catch {
  commit = 'no-git';
}
writeFileSync(
  join(STAGE, 'VERSION.txt'),
  `任务卡片 · Task Card\n打包时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n提交：${commit}\n运行：双击 start-demo.cmd（需要 Node 20+ 与 pnpm）\n`,
  'utf8',
);

const out = join(DIST, `taskcard-${stamp}-${commit}.zip`);
if (existsSync(out)) rmSync(out, { force: true });
execFileSync(
  'powershell',
  ['-NoProfile', '-Command', `Compress-Archive -Path '${STAGE}\\*' -DestinationPath '${out}' -Force`],
  { stdio: 'inherit' },
);
rmSync(STAGE, { recursive: true, force: true });
const mb = (statSync(out).size / 1024 / 1024).toFixed(1);
console.log(`[package] ${out}  (${mb} MB)`);

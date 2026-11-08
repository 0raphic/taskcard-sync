// 起 PocketBase（数据目录固定在本仓库内，换机器带走即可）
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const DIR = join(ROOT, 'server', 'pocketbase');
const EXE = join(DIR, process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase');
const DATA = process.env.PB_DATA || join(DIR, 'pb_data');
const HTTP = process.env.PB_HTTP || '127.0.0.1:8090';

if (!existsSync(EXE)) {
  console.error(`找不到 ${EXE}`);
  console.error('先跑：node tools/fetch-pocketbase.mjs');
  process.exit(1);
}

console.log(`[pb] http://${HTTP}  data=${DATA}`);
const child = spawn(EXE, ['serve', `--http=${HTTP}`, `--dir=${DATA}`], {
  stdio: 'inherit',
  cwd: DIR,
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => child.kill(sig));
}
child.on('exit', (code) => process.exit(code ?? 0));

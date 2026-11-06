// 下载 PocketBase Windows 版并解压到 server/pocketbase/
// 用法: node tools/fetch-pocketbase.mjs
import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const VERSION = process.env.PB_VERSION || '0.40.6';
const ASSET = `pocketbase_${VERSION}_windows_amd64.zip`;
const RELEASE_URL = `https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/${ASSET}`;
const DEST = join(import.meta.dirname, '..', 'server', 'pocketbase') + '/';
const ZIP = `${DEST}${ASSET}`;

const exists = await stat(`${DEST}pocketbase.exe`).then(() => true).catch(() => false);
if (exists) {
  console.log('pocketbase.exe already present, skip download');
  process.exit(0);
}

await mkdir(DEST, { recursive: true });
console.log('downloading', RELEASE_URL);
const res = await fetch(RELEASE_URL, { redirect: 'follow' });
if (!res.ok) {
  console.error('download failed:', res.status, res.statusText);
  process.exit(1);
}
await pipeline(res.body, createWriteStream(ZIP));
console.log('downloaded', ZIP);

// Windows 自带 bsdtar 支持 zip
try {
  execFileSync(process.env.ComSpec || 'cmd.exe', ['/c', `tar -xf "${ZIP}" -C "${DEST}"`], { stdio: 'inherit' });
} catch (e) {
  console.error('unzip failed:', e.message);
  process.exit(1);
}
console.log('extracted to', DEST);

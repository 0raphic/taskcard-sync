// 建表 + 导入卡片数据：node seed/seed.mjs
// 幂等：已存在的 collection / 记录会更新而不是报错
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import 'dotenv/config';

const ROOT = join(import.meta.dirname, '..');
const PB = process.env.PB_URL || 'http://127.0.0.1:8090';
const EMAIL = process.env.PB_ADMIN_EMAIL || 'admin@taskcard.local';
const PASS = process.env.PB_ADMIN_PASSWORD || 'taskcard12345';
const EXE = join(ROOT, 'server', 'pocketbase', process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase');

function log(...a) {
  console.log('[seed]', ...a);
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${PB}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* 非 JSON */
  }
  return { status: res.status, ok: res.ok, json, text };
}

// 1. 超级管理员
if (existsSync(EXE)) {
  try {
    execFileSync(EXE, ['superuser', 'upsert', EMAIL, PASS, `--dir=${join(ROOT, 'server', 'pocketbase', 'pb_data')}`], {
      stdio: 'pipe',
    });
    log('superuser upsert ok');
  } catch (e) {
    log('superuser upsert failed:', String(e.message).split('\n')[0]);
  }
}

// 2. 登录拿 token
const auth = await api('/api/collections/_superusers/auth-with-password', {
  method: 'POST',
  body: { identity: EMAIL, password: PASS },
});
if (!auth.ok) {
  console.error('登录失败，PocketBase 起了吗？', auth.status, auth.text.slice(0, 200));
  process.exit(1);
}
const token = auth.json.token;
log('admin ok');

const RULES = { listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '' };

/** 保留服务端的系统字段和未提及的字段，只覆盖我们声明过的 */
function mergeFields(existing = [], desired = []) {
  const byName = new Map(existing.map((f) => [f.name, f]));
  const out = desired.map((d) => ({ ...(byName.get(d.name) ?? {}), ...d }));
  for (const f of existing) {
    if (!desired.some((d) => d.name === f.name)) out.push(f);
  }
  return out;
}

async function ensureCollection(name, fields, extra = {}) {
  const get = await api(`/api/collections/${name}`, { token });
  if (get.ok) {
    const merged = mergeFields(get.json.fields, fields);
    const patch = await api(`/api/collections/${get.json.id}`, {
      method: 'PATCH',
      token,
      body: { fields: merged, ...RULES, ...extra },
    });
    if (!patch.ok) {
      console.error(`更新 ${name} 失败`, patch.status, patch.text.slice(0, 400));
      process.exit(1);
    }
    log(`collection ${name} 已更新`);
    return patch.json;
  }
  const created = await api('/api/collections', {
    method: 'POST',
    token,
    body: { name, type: 'base', fields, ...RULES, ...extra },
  });
  if (!created.ok) {
    console.error(`创建 ${name} 失败`, created.status, created.text.slice(0, 600));
    process.exit(1);
  }
  log(`collection ${name} 已创建`);
  return created.json;
}

// 3. 三张表
const tasksCol = await ensureCollection('tasks', [
  { name: 'title', type: 'text', required: true, max: 200 },
  { name: 'kind', type: 'select', values: ['short', 'long'], maxSelect: 1, required: true },
  { name: 'status', type: 'select', values: ['todo', 'doing', 'done', 'paused'], maxSelect: 1 },
  { name: 'due', type: 'text', max: 20 },
  { name: 'estimate_min', type: 'number', min: 0, max: 100000 },
  { name: 'description', type: 'text', max: 4000 },
  { name: 'materials', type: 'text', max: 1000 },
  { name: 'notes', type: 'text', max: 1000 },
  { name: 'goal', type: 'text', max: 1000 },
  { name: 'start', type: 'text', max: 20 },
  { name: 'milestones', type: 'json', maxSize: 20000 },
  { name: 'progress', type: 'number', min: 0, max: 100 },
  { name: 'draft', type: 'bool' },
  { name: 'client_updated_at', type: 'text', max: 40 },
  { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
]);

const linksCol = await ensureCollection('short_links', [
  { name: 'code', type: 'text', required: true, max: 12 },
  { name: 'task', type: 'relation', collectionId: tasksCol.id, maxSelect: 1, required: true },
  { name: 'active', type: 'bool' },
  { name: 'scans', type: 'number', min: 0 },
]);

await ensureCollection('progress_logs', [
  { name: 'task', type: 'relation', collectionId: tasksCol.id, maxSelect: 1, required: true },
  { name: 'note', type: 'text', required: true, max: 500 },
  { name: 'at', type: 'text', max: 40 },
  { name: 'delta', type: 'number' },
]);

// 3.5 服务端配置（DeepSeek Key 等）：规则锁死，只有服务端用管理员 token 读写
await ensureCollection(
  'app_settings',
  [
    { name: 'deepseek_api_key', type: 'text', max: 300 },
    { name: 'deepseek_model', type: 'text', max: 80 },
    { name: 'deepseek_vision_model', type: 'text', max: 80 },
  ],
  { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null },
);

// 4. 自引用：短期卡关联长期卡
const fresh = await api(`/api/collections/${tasksCol.id}`, { token });
await api(`/api/collections/${tasksCol.id}`, {
  method: 'PATCH',
  token,
  body: {
    fields: mergeFields(fresh.json.fields, [
      { name: 'parent', type: 'relation', collectionId: tasksCol.id, maxSelect: 1 },
    ]),
  },
});

// 5. 导入卡片
const seed = JSON.parse(readFileSync(join(ROOT, 'cards', 'tasks.json'), 'utf8'));

for (const t of seed.tasks) {
  const body = {
    title: t.title,
    kind: t.kind,
    status: t.status || 'todo',
    due: t.due ?? '',
    estimate_min: t.estimate_min ?? 0,
    description: t.description ?? '',
    materials: t.materials ?? t.resources ?? '',
    notes: t.notes ?? '',
    goal: t.goal ?? '',
    start: t.start ?? '',
    milestones: t.milestones ?? [],
    progress: t.progress ?? 0,
    client_updated_at: new Date().toISOString(),
  };
  const exists = await api(`/api/collections/tasks/records/${t.id}`, { token });
  const res = exists.ok
    ? await api(`/api/collections/tasks/records/${t.id}`, { method: 'PATCH', token, body })
    : await api('/api/collections/tasks/records', { method: 'POST', token, body: { id: t.id, ...body } });
  if (!res.ok) {
    console.error('导入失败', t.id, res.status, res.text.slice(0, 300));
    process.exit(1);
  }
}

log(`tasks: ${seed.tasks.length} 张`);

for (const t of seed.tasks) {
  if (!t.code) continue;
  const q = await api(`/api/collections/short_links/records?filter=${encodeURIComponent(`code="${t.code}"`)}`, { token });
  const hit = q.json?.items?.[0];
  const body = { code: t.code, task: t.id, active: true, scans: hit?.scans ?? 0 };
  const res = hit
    ? await api(`/api/collections/short_links/records/${hit.id}`, { method: 'PATCH', token, body })
    : await api('/api/collections/short_links/records', { method: 'POST', token, body });
  if (!res.ok) console.error('短链失败', t.code, res.status, res.text.slice(0, 200));
}

log(`short_links: ${seed.tasks.filter((t) => t.code).length} 条`);

// 6. 给两张长期卡各留一条进展，详情页不至于空
const logs = await api('/api/collections/progress_logs/records?perPage=1', { token });
if (!logs.json?.items?.length) {
  const longTasks = seed.tasks.filter((t) => t.kind === 'long');
  for (const t of longTasks) {
    await api('/api/collections/progress_logs/records', {
      method: 'POST',
      token,
      body: { task: t.id, note: '立项：先把字段和流程定下来', at: new Date().toISOString(), delta: 0 },
    });
  }
  log(`progress_logs: ${longTasks.length} 条`);
}

log('完成 ✓');

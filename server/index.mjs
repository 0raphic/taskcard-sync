import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';

const ROOT = path.resolve(import.meta.dirname, '..');
// 先读 .env.local（本机私有），再用 .env 兜底；已存在的环境变量优先（真实 env > 文件）
dotenv.config({ path: [path.join(ROOT, '.env.local'), path.join(ROOT, '.env')], quiet: true });

const DIST = path.join(ROOT, 'web', 'dist');
const PORT = Number(process.env.PORT || 8088);
const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const DS_BASE = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
const DS_KEY = process.env.DEEPSEEK_API_KEY || '';
const DS_MODEL = process.env.DEEPSEEK_MODEL || '';
const DS_VISION_MODEL = process.env.DEEPSEEK_VISION_MODEL || '';
const DEFAULT_MODEL = 'deepseek-flash';

// DeepSeek 配置来源：进程环境变量 > PocketBase app_settings 表（服务端用管理员 token 读）
// 这样用户在网页/脚本里设置一次，重启也不丢，不需要改 .env.local
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || 'admin@taskcard.local';
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || 'taskcard12345';
let adminCache = { token: '', at: 0 };
let llmCache = { at: 0, key: '', model: DEFAULT_MODEL, vision: '' };

async function adminToken() {
  if (adminCache.token && Date.now() - adminCache.at < 10 * 60_000) return adminCache.token;
  const r = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: PB_ADMIN_EMAIL, password: PB_ADMIN_PASSWORD }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.token) throw new Error('PB 管理员登录失败');
  adminCache = { token: j.token, at: Date.now() };
  return j.token;
}

async function llmConfig({ fresh = false } = {}) {
  if (!fresh && llmCache.at && Date.now() - llmCache.at < 5000) return llmCache;
  let key = '';
  let model = '';
  let vision = '';
  try {
    const token = await adminToken();
    const r = await fetch(`${PB_URL}/api/collections/app_settings/records?perPage=1`, {
      headers: { authorization: token },
    });
    const j = await r.json().catch(() => ({}));
    const it = j.items?.[0] || {};
    key = it.deepseek_api_key || '';
    model = it.deepseek_model || '';
    vision = it.deepseek_vision_model || '';
  } catch {
    /* 读不到就按未配置处理 */
  }
  // 数据库里的设置优先（网页里改），没有再用进程环境变量，最后用默认
  if (!key) key = DS_KEY;
  if (!model) model = DS_MODEL || DEFAULT_MODEL;
  if (!vision) vision = DS_VISION_MODEL;
  llmCache = { at: Date.now(), key, model, vision };
  return llmCache;
}

const app = express();

// PocketBase 同源代理：/api 是 REST，/_ 是实时 SSE；前端只认一个地址
const isPbPath = (pathname) => pathname.startsWith('/api') || pathname.startsWith('/_');
const pbProxy = createProxyMiddleware({
  target: PB_URL,
  changeOrigin: false,
  ws: true,
  pathFilter: isPbPath,
  on: {
    error: (err, _req, res) => {
      if (res && 'writeHead' in res && !res.headersSent) {
        res.writeHead(502, { 'content-type': 'application/json' });
      }
      if (res && 'end' in res) {
        if (!res.writableEnded) res.end(JSON.stringify({ error: `PocketBase 不可达：${err.message}` }));
      }
    },
  },
});
// 注意：必须在 express.json 之前挂代理——SDK 用 POST /api/realtime 送订阅，
// 被 body parser 吃掉后实时订阅就永远收不到事件
app.use(pbProxy);
app.use(express.json({ limit: '20mb' }));

const SCHEMA_HINT = `{
  "title": "任务标题，去掉「截止/用时/材料」等标签词",
  "kind": "short 或 long",
  "due": "截止日期，尽量保留 MM-DD 写法；没有就空字符串",
  "estimate_min": 预计分钟数（整数），没有就 0,
  "description": "描述/做法，没有就空字符串",
  "materials": "材料，没有就空字符串",
  "notes": "备注，没有就空字符串",
  "goal": "只有长期任务才有：目标一句话"
}`;

const SYSTEM = `你是一个把纸面任务卡转成结构化数据的助手。用户会给你一段手写/口述的任务描述（中文）。
只输出一个 JSON 对象，不要 Markdown 代码块，不要解释。字段与类型：
${SCHEMA_HINT}
判断依据：出现「目标/里程碑/进度/长期」或时间跨度超过两周 → long，否则 short。
日期只保留 MM-DD（例如 11-07）；「明天」「这周五」这类相对时间按今天 ${new Date().toISOString().slice(0, 10)} 推算。
不要编造原文没有的信息。`;


// 没有 API Key 时的兜底：用规则把「名称 / 截止 / 用时 / 材料 / 备注」拆出来。
// 现场断网或没填 key 也能演示「文字进 → 卡片出」。
function localParse(text) {
  const lines = text
    .split(/\r?\n|；|;/)
    .map((l) => l.trim())
    .filter(Boolean);
  const pick = (keys) => {
    for (const line of lines) {
      for (const k of keys) {
        const m = line.match(new RegExp(`^[·•\\-\\s]*${k}\\s*[:：]?\\s*(.+)$`));
        if (m && m[1].trim()) return m[1].trim();
      }
    }
    return '';
  };
  const pad = (n) => String(n).padStart(2, '0');
  const normDate = (v) => {
    if (!v) return '';
    const iso = v.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (iso) return `${pad(iso[2])}-${pad(iso[3])}`;
    const md = v.match(/(\d{1,2})\s*[-/.月]\s*(\d{1,2})/);
    if (md) return `${pad(md[1])}-${pad(md[2])}`;
    const today = new Date();
    if (/今天/.test(v)) return `${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    if (/明天/.test(v)) {
      const d = new Date(today.getTime() + 86400000);
      return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    return '';
  };
  const minutes = (v) => {
    const m = v && v.match(/(\d+)\s*(分钟|分|min)/i);
    if (m) return `${m[1]} 分`;
    const h = v && v.match(/(\d+(?:\.5)?)\s*(小时|时|h)/i);
    if (h) return `${Math.round(parseFloat(h[1]) * 60)} 分`;
    return '';
  };

  const dueRaw = pick(['截止', '到期', 'deadline', 'due']);
  const estRaw = pick(['用时', '耗时', '预计', 'estimate']);
  const materials = pick(['材料', '物料', '准备']);
  const notes = pick(['备注', '注意', '提醒', 'note']);
  const goal = pick(['目标', 'goal']);
  const longByGoal = Boolean(goal) || /长期|里程碑/.test(text);
  const usedKeys = /^(截止|到期|用时|耗时|预计|材料|物料|备注|注意|提醒|状态|目标|里程碑|进度)\s*[:：]?/;
  const titleLine = lines.find((l) => !usedKeys.test(l) && !/^(例|示例)[:：]/.test(l));
  const title = (titleLine || lines[0] || '未命名任务').replace(/^(任务|名称)[:：]\s*/, '');

  return {
    kind: longByGoal ? 'long' : 'short',
    title: title.slice(0, 60),
    due: normDate(dueRaw),
    estimate: minutes(estRaw) || minutes(text),
    description: '',
    materials,
    notes,
    status: 'todo',
    goal: goal || '',
  };
}

async function callDeepSeek(messages, { key, model } = {}) {
  if (!key) {
    const err = new Error('服务端没有配置 DeepSeek Key（网页「设置」里填一次，或 .env.local）');
    err.status = 503;
    throw err;
  }
  const res = await fetch(`${DS_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      messages,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 800,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error?.message || `DeepSeek HTTP ${res.status}`);
    err.status = 502;
    throw err;
  }
  const content = body?.choices?.[0]?.message?.content ?? '';
  const cleaned = String(content)
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const err = new Error(`模型返回的不是 JSON：${String(content).slice(0, 120)}`);
    err.status = 502;
    throw err;
  }
}

app.post('/ds-api/structure', async (req, res) => {
  const text = String(req.body?.text ?? '').trim();
  if (!text) return res.status(400).json({ ok: false, error: '没有文字可解析' });
  const cfg = await llmConfig();
  if (!cfg.key) {
    return res.json({ ok: true, task: localParse(text), fallback: true });
  }
  try {
    const task = await callDeepSeek(
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: text },
      ],
      cfg,
    );
    res.json({ ok: true, task });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

app.post('/ds-api/ocr', async (req, res) => {
  const image = String(req.body?.image ?? '');
  if (!image.startsWith('data:image/')) {
    return res.status(400).json({ ok: false, error: '需要 data:image/... 的图片' });
  }
  const cfg = await llmConfig();
  if (!cfg.vision || !cfg.key) {
    return res.status(501).json({
      ok: false,
      error: '照片识别还没接上：在网页「设置」里填 DeepSeek Key 和看图模型（deepseek-flash）即可。',
    });
  }
  try {
    const task = await callDeepSeek(
      [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'text', text: '这是任务卡的照片，请读出内容并结构化。' },
            { type: 'image_url', image_url: { url: image } },
          ],
        },
      ],
      { key: cfg.key, model: cfg.vision },
    );
    res.json({ ok: true, task, text: task.description || '' });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

app.get('/ds-api/health', async (_req, res) => {
  let pb = 'down';
  try {
    const r = await fetch(`${PB_URL}/api/health`);
    pb = r.ok ? 'up' : `http ${r.status}`;
  } catch {
    pb = 'down';
  }
  const cfg = await llmConfig();
  res.json({
    ok: true,
    pb,
    deepseek: cfg.key ? 'configured' : 'missing-key',
    model: cfg.key ? cfg.model : null,
    vision: cfg.vision || null,
    dist: existsSync(DIST),
  });
});

// 设置：Key 存 PocketBase（app_settings，规则锁死），只有服务端能读写；网页只看到「已配置」
app.get('/ds-api/settings', async (_req, res) => {
  const cfg = await llmConfig({ fresh: true });
  const hint = cfg.key ? `${cfg.key.slice(0, 5)}…${cfg.key.slice(-4)}` : '';
  res.json({ ok: true, configured: Boolean(cfg.key), key_hint: hint, model: cfg.model, vision: cfg.vision });
});

app.post('/ds-api/settings', async (req, res) => {
  const body = req.body || {};
  const patch = {};
  if (typeof body.api_key === 'string') {
    const v = body.api_key.trim();
    if (v && !v.startsWith('sk-')) return res.status(400).json({ ok: false, error: 'Key 一般以 sk- 开头，检查一下' });
    patch.deepseek_api_key = v;
  }
  if (typeof body.model === 'string' && body.model.trim()) patch.deepseek_model = body.model.trim();
  if (typeof body.vision === 'string') patch.deepseek_vision_model = body.vision.trim();
  if (!Object.keys(patch).length) return res.status(400).json({ ok: false, error: '没有要保存的内容' });
  try {
    const token = await adminToken();
    const list = await fetch(`${PB_URL}/api/collections/app_settings/records?perPage=1`, {
      headers: { authorization: token },
    }).then((r) => r.json());
    const existing = list.items?.[0];
    const url = existing
      ? `${PB_URL}/api/collections/app_settings/records/${existing.id}`
      : `${PB_URL}/api/collections/app_settings/records`;
    const r = await fetch(url, {
      method: existing ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json', authorization: token },
      body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error(`保存失败 HTTP ${r.status}`);
    llmCache = { at: 0, key: '', model: DEFAULT_MODEL, vision: '' };
    const cfg = await llmConfig({ fresh: true });
    res.json({ ok: true, configured: Boolean(cfg.key), model: cfg.model, vision: cfg.vision });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── 局域网地址：印卡片时二维码要指向手机能打开的地址 ───────────────
function lanIp() {
  const nets = os.networkInterfaces();
  const cands = [];
  for (const [name, list] of Object.entries(nets)) {
    for (const n of list || []) {
      if (n.family !== 'IPv4' || n.internal) continue;
      if (n.address.startsWith('169.254.')) continue;
      let score = 0;
      if (/wi-?fi|wlan|ethernet|以太网|无线/i.test(name)) score += 2;
      if (n.address.startsWith('192.168.')) score += 4;
      else if (n.address.startsWith('10.')) score += 3;
      else if (/^172\.(1[6-9]|2\d|3[01])\./.test(n.address)) score += 3;
      else score -= 2;
      cands.push({ address: n.address, score });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  return cands[0]?.address || '127.0.0.1';
}

const PYTHON = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';

async function pbReq(pathname, { method = 'GET', body } = {}) {
  const token = await adminToken();
  const r = await fetch(`${PB_URL}${pathname}`, {
    method,
    headers: { authorization: token, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // 非 JSON 响应，保留 text 给调用方判断
  }
  return { ok: r.ok, status: r.status, json, text };
}

/** 6 位短码（字符集和前端一致），撞了就重抽 */
async function uniqueCode() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    let out = '';
    for (const b of randomBytes(6)) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
    const r = await pbReq(
      `/api/collections/short_links/records?perPage=1&filter=${encodeURIComponent(`code="${out}"`)}`,
    );
    if (r.ok && !r.json?.items?.length) return out;
  }
  throw new Error('短码生成失败，再试一次');
}

app.get('/ds-api/net', (_req, res) => {
  const ip = lanIp();
  res.json({ ok: true, ip, port: PORT, lan: ip !== '127.0.0.1', url: `http://${ip}:${PORT}` });
});

// 删除任务：PB 关系不级联，这里显式清掉短链和进展记录，否则落地页会 500
app.delete('/ds-api/tasks/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const one = await pbReq(`/api/collections/tasks/records/${id}`);
    if (!one.ok) return res.status(404).json({ ok: false, error: '这张卡已经不在了' });

    let links = 0;
    let logs = 0;
    const lq = await pbReq(
      `/api/collections/short_links/records?perPage=200&filter=${encodeURIComponent(`task="${id}"`)}`,
    );
    for (const row of lq.json?.items || []) {
      const r = await pbReq(`/api/collections/short_links/records/${row.id}`, { method: 'DELETE' });
      if (r.ok) links += 1;
    }
    const gq = await pbReq(
      `/api/collections/progress_logs/records?perPage=200&filter=${encodeURIComponent(`task="${id}"`)}`,
    );
    for (const row of gq.json?.items || []) {
      const r = await pbReq(`/api/collections/progress_logs/records/${row.id}`, { method: 'DELETE' });
      if (r.ok) logs += 1;
    }
    const del = await pbReq(`/api/collections/tasks/records/${id}`, { method: 'DELETE' });
    if (!del.ok) return res.status(500).json({ ok: false, error: `删除失败 HTTP ${del.status}` });
    res.json({ ok: true, deleted: { links, logs } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 勾选任务 → 生成 1/8 A4 卡片 PDF（复用 scripts/gen_cards.py 的排版）
app.post('/ds-api/cards.pdf', async (req, res) => {
  const body = req.body || {};
  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.filter((v) => typeof v === 'string' && v.trim()))]
    : [];
  if (!ids.length) return res.status(400).json({ ok: false, error: '先选至少一张卡' });
  if (ids.length > 200) return res.status(400).json({ ok: false, error: '一次最多 200 张，分批打' });

  const baseUrl = String(body.base_url || `http://${lanIp()}:${PORT}`).replace(/\/+$/, '');
  if (!/^https?:\/\/[^/\s]+$/.test(baseUrl)) {
    return res.status(400).json({ ok: false, error: '地址要像 http://192.168.0.108:8088' });
  }

  const tmp = mkdtempSync(path.join(os.tmpdir(), 'taskcard-cards-'));
  try {
    // 1) 按传入顺序取任务
    const filter = ids.map((id) => `id="${id}"`).join('||');
    const q = await pbReq(
      `/api/collections/tasks/records?perPage=200&filter=${encodeURIComponent(filter)}`,
    );
    const found = new Map((q.json?.items || []).map((t) => [t.id, t]));
    const tasks = ids.map((id) => found.get(id)).filter(Boolean);
    if (!tasks.length) return res.status(404).json({ ok: false, error: '这些卡都不在了' });

    // 2) 短码：没有的就补一个，保证纸上二维码能扫
    const lf = tasks.map((t) => `task="${t.id}"`).join('||');
    const lq = await pbReq(
      `/api/collections/short_links/records?perPage=200&filter=${encodeURIComponent(lf)}`,
    );
    const codes = new Map((lq.json?.items || []).map((l) => [l.task, l.code]));
    for (const t of tasks) {
      if (codes.has(t.id)) continue;
      const code = await uniqueCode();
      const r = await pbReq('/api/collections/short_links/records', {
        method: 'POST',
        body: { code, task: t.id, active: true, scans: 0 },
      });
      if (r.ok) codes.set(t.id, code);
    }

    const payload = {
      base_url: baseUrl,
      tasks: tasks.map((t) => ({
        id: t.id,
        code: codes.get(t.id),
        kind: t.kind,
        title: t.title,
        due: t.due || '',
        estimate_min: t.estimate_min ?? 0,
        description: t.description || '',
        materials: t.materials || '',
        notes: t.notes || '',
        start: t.start || '',
        goal: t.goal || '',
        milestones: Array.isArray(t.milestones) ? t.milestones : [],
        resources: t.materials || '',
        progress: t.progress ?? 0,
      })),
    };

    // 3) 交给 Python 排版
    const outPdf = path.join(tmp, 'cards.pdf');
    const args = [
      path.join(ROOT, 'scripts', 'gen_cards.py'),
      '--input',
      '-',
      '--output',
      outPdf,
      '--base-url',
      baseUrl,
      '--codes-out',
      '',
    ];
    if (body.double_sided) args.push('--double-sided');

    const result = await new Promise((resolve) => {
      const child = spawn(PYTHON, args, { cwd: ROOT, windowsHide: true });
      let err = '';
      child.stdout.on('data', () => {});
      child.stderr.on('data', (d) => {
        err += String(d);
        if (err.length > 4000) err = err.slice(-4000);
      });
      child.on('error', (e) => resolve({ ok: false, code: e.code, err: e.message }));
      child.on('close', (code) => resolve({ ok: code === 0, code, err }));
      child.stdin.end(JSON.stringify(payload));
    });

    if (!result.ok) {
      if (result.code === 'ENOENT') {
        return res.status(501).json({
          ok: false,
          error: '这台机器没找到 python；装 Python 后跑 pip install reportlab qrcode',
        });
      }
      const tail = String(result.err || '')
        .trim()
        .split('\n')
        .slice(-3)
        .join(' ');
      return res.status(502).json({ ok: false, error: `生成失败：${tail}` });
    }

    const pdf = readFileSync(outPdf);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-disposition', `inline; filename="taskcard-${stamp}.pdf"`);
    res.setHeader('x-card-count', String(payload.tasks.length));
    res.send(pdf);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  } finally {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      // 临时目录清不掉不影响返回
    }
  }
});

if (existsSync(DIST)) {
  app.use(express.static(DIST, { index: false, maxAge: '1h' }));
  app.use(async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (isPbPath(req.path) || req.path.startsWith('/ds-api')) return next();
    try {
      const html = await readFile(path.join(DIST, 'index.html'));
      res.type('html').send(html);
    } catch {
      next();
    }
  });
}

const server = createServer(app);

// WebSocket / SSE 的 upgrade 也要转给 PocketBase，实时订阅靠它
server.on('upgrade', pbProxy.upgrade);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[web] http://127.0.0.1:${PORT}  (PocketBase -> ${PB_URL})`);
  console.log(
    `[web] dist=${existsSync(DIST) ? 'ok' : '未构建（先 pnpm build）'}  deepseek=${
      DS_KEY ? 'ok' : '未配置 key'
    }`,
  );
});

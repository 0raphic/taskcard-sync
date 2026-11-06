import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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
const DS_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-flash';
const DS_VISION_MODEL = process.env.DEEPSEEK_VISION_MODEL || '';

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

async function callDeepSeek(messages, model = DS_MODEL) {
  if (!DS_KEY) {
    const err = new Error('服务端没有配置 DEEPSEEK_API_KEY（见 .env.local.example）');
    err.status = 503;
    throw err;
  }
  const res = await fetch(`${DS_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${DS_KEY}`,
    },
    body: JSON.stringify({
      model,
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
  if (!DS_KEY) {
    return res.json({ ok: true, task: localParse(text), fallback: true });
  }
  try {
    const task = await callDeepSeek([
      { role: 'system', content: SYSTEM },
      { role: 'user', content: text },
    ]);
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
  if (!DS_VISION_MODEL) {
    return res.status(501).json({
      ok: false,
      error:
        '照片识别还没接上：在 .env.local 里配 DEEPSEEK_VISION_MODEL（能读图的模型）即可；现在请先把纸卡上的字敲进上面的输入框。',
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
      DS_VISION_MODEL,
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
  res.json({
    ok: true,
    pb,
    deepseek: DS_KEY ? 'configured' : 'missing-key',
    vision: DS_VISION_MODEL || null,
    dist: existsSync(DIST),
  });
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

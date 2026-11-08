// 一次性设置 DeepSeek Key / 模型：node scripts/set-key.mjs sk-xxx
// 也可以只改模型：node scripts/set-key.mjs --model deepseek-flash --vision deepseek-flash
const BASE = process.env.APP_URL || 'http://127.0.0.1:8088';
const args = process.argv.slice(2);

const body = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--model') body.model = args[++i];
  else if (a === '--vision') body.vision = args[++i];
  else if (a === '--key') body.api_key = args[++i];
  else if (a.startsWith('sk-')) body.api_key = a;
}

if (!Object.keys(body).length) {
  console.log('用法：node scripts/set-key.mjs sk-xxxx   或   --model deepseek-flash --vision deepseek-flash');
  process.exit(1);
}

const res = await fetch(`${BASE}/ds-api/settings`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
const json = await res.json().catch(() => ({}));
if (!res.ok || !json.ok) {
  console.error('设置失败：', json.error || res.status);
  process.exit(1);
}
console.log(`[set-key] 已保存：configured=${json.configured} model=${json.model} vision=${json.vision || '(空)'}`);

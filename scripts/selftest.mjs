#!/usr/bin/env node
/**
 * 第一次全链路自测：只跑接口，不依赖浏览器。
 *   node scripts/selftest.mjs [--base http://127.0.0.1:8088]
 * 退出码 0 = 全过；1 = 有失败项。
 */
const BASE = (() => {
  const i = process.argv.indexOf('--base');
  return i > 0 ? process.argv[i + 1] : 'http://127.0.0.1:8088';
})();

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

async function req(path, { method = 'GET', token, body, headers = {} } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { res, text, json };
}

const startedAt = new Date(Date.now() - 60_000).toISOString().replace('T', ' ').slice(0, 19);

// 1. 健康检查
{
  const { res, json } = await req('/ds-api/health');
  check('health 200', res.status === 200 && json?.ok === true, JSON.stringify(json));
  check('health 里 pb=up', json?.pb === 'up');
  check('密钥已配置', json?.deepseek === 'configured', 'model=' + json?.model);
}

// 2. 未登录必须 401
{
  const { res, json } = await req('/ds-api/settings');
  check('未登录访问 settings → 401', res.status === 401 && json?.need_login === true);
}

// 3. 登录
const login = await req('/api/collections/users/auth-with-password', {
  method: 'POST',
  body: { identity: 'owner@taskcard.local', password: 'taskcard12345' },
});
const token = login.json?.token;
check('演示账号可登录', login.res.status === 200 && !!token, login.json?.message || '');

// 4. 登录后接口
{
  const { res, json } = await req('/ds-api/settings', { token });
  check('settings 200', res.status === 200 && json?.ok === true);
  check('settings 不回传完整 Key', typeof json?.key_hint === 'string' && json.key_hint.includes('…'));
}
{
  const { res, json } = await req('/ds-api/net', { token });
  check('net 返回局域网地址', res.status === 200 && /^http:\/\//.test(json?.url || ''), json?.url);
}

// 5. 建卡 → 短码 → 删除级联
let createdId = null;
{
  const { res, json } = await req('/api/collections/tasks/records', {
    method: 'POST',
    token,
    body: { title: '自测临时卡', kind: 'short', status: 'todo', due: '11-30' },
  });
  createdId = json?.id;
  check('新建任务', res.status === 200 && !!createdId, createdId);
}
{
  const { res, json } = await req('/api/collections/short_links/records', {
    method: 'POST',
    token,
    body: { code: 'TT' + Math.random().toString(36).slice(2, 6).toUpperCase(), task: createdId, active: true, scans: 0 },
  });
  check('给新卡建短码', res.status === 200 && !!json?.code, json?.code);
}

// 6. 空白卡 PDF（会真的建占位卡，稍后按时间戳清理）
{
  const { res, text } = await req('/ds-api/cards.blank', {
    method: 'POST',
    token,
    body: { count: 1, kind: 'short', base_url: 'http://192.168.0.108:8088', double_sided: true },
  });
  check('空白卡 PDF（双面）', res.status === 200 && text.startsWith('%PDF'), text.length + ' bytes');
  check('PDF 带张数头', res.headers.get('x-card-count') === '1', res.headers.get('x-card-count') || '');
}

// 7. 参数校验
{
  const { res, json } = await req('/ds-api/cards.pdf', { method: 'POST', token, body: { ids: [] } });
  check('空选择 → 400', res.status === 400, json?.error);
}
{
  const { res } = await req('/ds-api/cards.pdf', {
    method: 'POST',
    token,
    body: { ids: [createdId], base_url: 'ftp://x' },
  });
  check('非法地址 → 400', res.status === 400);
}

// 8. 删除级联
{
  const { res, json } = await req('/ds-api/tasks/' + createdId, { method: 'DELETE', token });
  check('删除任务级联', res.status === 200 && json?.ok === true, JSON.stringify(json?.deleted));
}
{
  const { res } = await req('/ds-api/tasks/' + createdId, { method: 'DELETE', token });
  check('重复删除 → 404', res.status === 404);
}

// 9. 作废 / 恢复
{
  const list = await req('/api/collections/short_links/records?perPage=1&filter=' + encodeURIComponent('active=true'), { token });
  const link = list.json?.items?.[0];
  if (link) {
    const rev = await req('/ds-api/cards.revoke', { method: 'POST', token, body: { code: link.code } });
    check('作废单张', rev.res.status === 200, link.code);
    const back = await req('/ds-api/cards.restore', { method: 'POST', token, body: { codes: [link.code] } });
    check('恢复单张', back.res.status === 200);
    const again = await req('/api/collections/short_links/records/' + link.id);
    check('恢复后 active=true', again.json?.active === true);
  } else {
    check('作废/恢复（没有可用卡，跳过）', true, 'skip');
  }
}

// 10. 口令默认关闭
{
  const { res, json } = await req('/ds-api/passcode');
  check('写口令已停用', res.status === 200 && json?.enabled === false, JSON.stringify(json));
}

// 11. 清理本次测试新建的占位卡（只看 1 分钟内、标题是空白卡的）
{
  const filter = encodeURIComponent(`title~'空白卡'&&created>='${startedAt}'`);
  const { json } = await req('/api/collections/tasks/records?perPage=200&fields=id,title&filter=' + filter, { token });
  const fresh = json?.items || [];
  for (const t of fresh) await req('/ds-api/tasks/' + t.id, { method: 'DELETE', token });
  check('清理测试占位卡', fresh.length <= 3, '删除 ' + fresh.length + ' 张');
}

const failed = results.filter((r) => !r.ok);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' 通过');
if (failed.length) {
  console.log('失败项：');
  for (const f of failed) console.log(' - ' + f.name + (f.detail ? '  (' + f.detail + ')' : ''));
  process.exit(1);
}

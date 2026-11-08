const PORT = 9333;
const BASE = 'http://127.0.0.1:8088';
const fs = await import('node:fs');
const path = process.cwd() + '\\.shots\\hand_card_2x.png';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

// 先把上次跑剩下的页签关掉：每个页签都挂着 SSE，攒多了会把连接占满
{
  const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
  for (const t of list) {
    if (t.type === 'page') await fetch('http://127.0.0.1:' + PORT + '/json/close/' + t.id).then((r) => r.text());
  }
}

async function open(url, { w = 1280, h = 900, mobile = false } = {}) {
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0;
  const p = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && p.has(m.id)) {
      p.get(m.id)(m);
      p.delete(m.id);
    }
  });
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  const send = (method, params = {}) => {
    const mid = ++id;
    ws.send(JSON.stringify({ id: mid, method, params }));
    return new Promise((res) => {
      p.set(mid, (m) => res(m.result));
      setTimeout(() => res({}), 15000);
    });
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
  await send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 3600));
  return {
    send,
    close: () => {
      ws.close();
      fetch('http://127.0.0.1:' + PORT + '/json/close/' + t.id).then((r) => r.text()).catch(() => {});
    },
  };
}

// 1. 看板
{
  const page = await open(BASE + '/');
  const txt = (await page.send('Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true })).result.value || '';
  check('看板标题', txt.includes('这一周，卡都在哪一格？'));
  check('三列都在', ['待办', '进行中', '已完成'].every((x) => txt.includes(x)));
  check('新文案生效', txt.includes('三列对应三个阶段'), '');
  check('今天提示', /今天要做完的|张今天到期/.test(txt));
  page.close();
}

// 2. 主题切换（不切 color-scheme）
{
  const page = await open(BASE + '/');
  const before = (await page.send('Runtime.evaluate', {
    expression: `JSON.stringify({t:document.documentElement.dataset.theme,cs:getComputedStyle(document.documentElement).colorScheme})`,
    returnByValue: true,
  })).result.value;
  await page.send('Runtime.evaluate', { expression: `document.querySelector('button[aria-label^="主题"]').click()` });
  await new Promise((r) => setTimeout(r, 500));
  const after = (await page.send('Runtime.evaluate', {
    expression: `JSON.stringify({t:document.documentElement.dataset.theme,cs:getComputedStyle(document.documentElement).colorScheme})`,
    returnByValue: true,
  })).result.value;
  check('主题会切换', before !== after, before + ' → ' + after);
  check('color-scheme 不变', JSON.parse(before).cs === JSON.parse(after).cs);
  page.close();
}

// 3. 扫码落地页 → 上传卡面 → 核对面板字段
{
  const page = await open(BASE + '/t/a7K2m9', { w: 390, h: 844, mobile: true });
  const doc = await page.send('DOM.getDocument', { depth: -1 });
  const q = await page.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type=file]' });
  check('落地页有拍照入口', !!q.nodeId);
  await page.send('DOM.setFileInputFiles', { nodeId: q.nodeId, files: [path] });
  let labels = '';
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const t = (await page.send('Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true })).result.value || '';
    if (t.includes('核对一下')) { labels = t; break; }
    labels = t;
  }
  check('识别后出现核对面板', labels.includes('核对一下'), '');
  check('面板含优先级', labels.includes('优先级'));
  check('面板含完成标准', labels.includes('完成标准'));
  const panel = labels.slice(labels.indexOf('核对'));
  check('面板不再含用时', !panel.includes('用时'));
  check('面板有写回按钮', labels.includes('写回这张卡'));
  await page.close();
}

// 4. 卡片页 / 统计页
{
  const page = await open(BASE + '/cards');
  const txt = (await page.send('Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true })).result.value || '';
  check('卡片页四态', ['未使用', '使用中', '已完成', '已作废'].every((x) => txt.includes(x)));
  check('卡片页说明文案', txt.includes('短码是纸卡的身份'));
  page.close();
}
{
  const page = await open(BASE + '/stats');
  const txt = (await page.send('Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true })).result.value || '';
  check('统计四个指标', ['本周收卡', '本周新建', '连续完成', '现在逾期'].every((x) => txt.includes(x)));
  page.close();
}

const failed = results.filter((r) => !r.ok);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' 通过');
if (failed.length) process.exit(1);

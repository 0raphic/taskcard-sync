# 任务卡片 · Task Card

一叠能打印的纸卡 + 一个网页。纸卡上印二维码，手机扫码改状态，电脑上的看板一秒内跟着变。

- 后端：PocketBase（SQLite + 实时订阅，单文件、免部署）
- 前端：React 19 + Vite + Tailwind 4，自己写的极简路由（没有第三方 router）
- 纸卡：Python + reportlab 生成 A4 2×4 = 8 张 1/8 A4 卡片，虚线裁剪线 + 二维码
- 录入：DeepSeek 把一段文字拆成结构化字段；没配 Key 时用内置规则解析兜底

## 现在已经能跑通什么

- 看板：逾期 / 今天 / 接下来 / 长期目标 分组，短卡看截止与用时，长卡看进度条
- 扫码落地页 `/t/<短码>`：一张纸卡的样子 + 三个按钮（做完了 / 正在进行 / 先搁置），点完盖「完成」红章
- 实时同步：A 窗口点「做完了」→ B 窗口看板 1 秒内出现「已完成」分组，不刷新
- 录入：粘一段文字 → 拆出标题/截止/用时/材料/备注 → 存库并自动生成 6 位短码
- 打印：`cards/cards.pdf` 一页 8 张，二维码实测解码为 `http://192.168.0.108:8088/t/<短码>`
  （IP 变了要重新生成，见下）

## 30 秒跑起来

```bash
pnpm install                       # 装依赖（store 指到仓库内，见 .npmrc）
node tools/fetch-pocketbase.mjs    # 首次：下载 PocketBase 到 server/pocketbase/
```

三个终端（**顺序别换**：先起 PocketBase，再 seed，最后起网页）：

```bash
pnpm pb      # 1) PocketBase  → http://127.0.0.1:8090
pnpm seed    # 2) 建表 + 导入 cards/tasks.json（幂等，可重跑）
pnpm dev     # 3) 网页（开发模式）→ http://localhost:5173
```

首次建管理员（seed 里会尝试，但在某些沙箱/无权限环境会失败，失败就手动跑一次）：

```bash
./server/pocketbase/pocketbase.exe superuser upsert admin@taskcard.local taskcard12345 \
  --dir=./server/pocketbase/pb_data
```

单端口跑（**演示用这个**，手机扫码就指它）：

```bash
pnpm build && pnpm start     # → http://127.0.0.1:8088（同时监听局域网）
```

## 打印纸卡

```bash
python scripts/gen_cards.py --input cards/tasks.json --output cards/cards.pdf \
  --base-url http://192.168.0.108:8088 --codes-out cards/codes.json
```

- `--base-url` 决定二维码里的地址：**现场要写笔记本的局域网/热点 IP**，不要写 127.0.0.1
  （本机现在是 WLAN `192.168.0.108`，换网络后先 `ipconfig` 看一眼）
- `--double-sided --flip long|short` 可出双面（正面卡片、背面复盘）
- 输出 `cards/codes.json`：短码 → 任务 ID，和数据库 `short_links` 对应
- 打出来先量二维码：不小于 15×15mm；用手机**自带相机**扫，不要用网页里调摄像头

## 目录

```
web/                前端（页面 / 组件 / 数据订阅）
server/index.mjs    生产服务器：托管 dist + 代理 PocketBase + /ds-api 结构化接口
server/pocketbase/  PocketBase 可执行文件、pb_data、pb_migrations（数据与迁移不入库）
seed/seed.mjs       建表 + 导入卡片数据（幂等）
scripts/gen_cards.py  A4 卡片 PDF 生成
cards/              tasks.json（卡片内容）、cards.pdf、codes.json
docs/demo-script.md 三分钟讲稿 + 现场保险清单
tools/              下载 / 启动 PocketBase、CDP 截图（shot.mjs）
```

## 配置（.env.local）

从 `.env.local.example` 复制。所有项都可缺省：

- `DEEPSEEK_API_KEY`：录入页「解析成任务」走模型；不填则走本地规则（标题、截止、用时、材料、备注都认）
- `DEEPSEEK_VISION_MODEL`：能读图的模型名；不填时「上传照片识别」会明确提示未接
- `PB_ADMIN_EMAIL/PASSWORD`：seed 建表用的本地管理员，仅本机
- `PORT`：网页端口，默认 8088

## 现场要点

1. 笔记本开热点，手机连热点；`--base-url` 用热点网段 IP，然后重新生成 PDF
2. Windows 防火墙放行 8088（专用网络），并用**另一台**手机/电脑实测一次
3. 两个窗口并排：左看板、右落地页——这就是「多端同步」的全部证据
4. 断网也能演：录入有本地解析兜底，实时同步全程局域网

## 排障

- **`?sort=created` 返回 400 / 看板空白**：集合缺 `created`/`updated` autodate 字段。
  重跑 `pnpm seed` 即可（seed 会 `mergeFields` 补齐）。
- **启动报 `failed to apply migration ... relation collection doesn't exist`**：
  `pb_migrations/` 里同一秒生成的迁移顺序被字典序打乱。按依赖重命名时间戳前缀
  （`created_tasks` < `created_short_links` < `created_progress_logs` < `updated_tasks`），
  或删掉 `pb_data/` 与 `pb_migrations/` 后重新 `pnpm pb` + `pnpm seed` 从零建。
- **实时订阅不生效（改完状态页面不动）**：`express.json()` 必须挂在 PocketBase 代理**之后**，
  否则 SDK 的 `POST /api/realtime` 订阅请求体被吃掉。`server/index.mjs` 已按此顺序写好。
- **端口被占**：`netstat -ano | findstr :8090`（或 8088）找到 PID 后结束进程。

## 已知边界

- 冲突用 last-write-wins（`client_updated_at` 记录最后修改时间），不做字段级合并
- 照片 OCR 依赖视觉模型；本机没装 tesseract，走的是模型读图
- 没有登录：局域网演示用，别放到公网
- 移动端就是同一套网页；Flutter 客户端只是下一步，不是现在

# 任务卡片 · Task Card

一叠能打印的纸卡 + 一个网页。纸卡上印二维码，手机扫码改状态，电脑上的看板一秒内跟着变。

- 后端：PocketBase（SQLite + 实时订阅，单文件、免部署）
- 前端：React 19 + Vite + Tailwind 4，自己写的极简路由（没有第三方 router）
- 纸卡：Python + reportlab 生成 A4 2×4 = 8 张 1/8 A4 卡片，虚线裁剪线 + 二维码
- 录入：DeepSeek 把一段文字拆成结构化字段；没配 Key 时用内置规则解析兜底

## 现在已经能跑通什么

- 看板：逾期 / 今天 / 接下来 / 长期目标 分组，短卡看截止与用时，长卡看进度条
- 扫码落地页 `/t/<短码>`：一张纸卡的样子 + 三个按钮（做完了 / 正在进行 / 先搁置），点完盖「完成」红章
- 长期卡落地页：现场改进度（−10% / ＋10%）、写一句进展记到详情里
- 实时同步：A 窗口点「做完了」→ B 窗口看板 1 秒内出现「已完成」分组，不刷新
- 录入：粘一段文字 → 拆出标题/截止/用时/材料/备注 → 存库并自动生成 6 位短码
- 拍照录入：手机点「拍照识别」直接调系统相机（局域网 http 也能用），上传前自动缩到长边 1600；
  https 下还会多一个「页内拍照」
- 网页里直接拼页打印：`/print` 选卡 → 生成 PDF → 浏览器里直接看/打印（双面可选），
  二维码里的地址在页面上可改；从「全部任务」可以「把这几张排成 A4」
- 删除：任务详情页底部 → 连短链和进展记录一起删；已打印的纸卡再扫会显示「这张卡已经不在系统里了」
- 空白表：`/print` 切到「空白表」，选卡型和张数（8/16/24）→ 生成 PDF → 打印一张张空白卡；
  每张空白卡都有独立二维码和短码，库里先建一条占位的 `draft` 记录（不进看板）
- 拍空白卡回填：`/capture` 拍一张写完的卡 → **先解二维码**认出是哪张卡 → 再让模型读卡面上的手写内容 →
  字段填进可编辑草稿 → 保存就写回那条占位记录（`draft` 变 false，看板出现）
- 打印：`cards/cards.pdf` 一页 8 张，二维码实测解码为 `http://192.168.0.108:8088/t/<短码>`
  （IP 变了要重新生成，见下）；`cards/cards-double.pdf` 是双面版
- 空白表 PDF：`.shots/blank.pdf` 是样例（4 张），二维码同样能解出 `http://<IP>:8088/t/<短码>`
- PWA：带 manifest 和图标，手机浏览器「添加到主屏幕」后像个 App（没有 Service Worker，离线打不开）

## 最省事：双击启动

```
start-demo.cmd
```

它会依次检查/启动 PocketBase、数据库空了就自动导入演示数据、启动网页服务器，然后打开浏览器，
并在窗口里打印「本机地址 / 手机地址 / 扫码测试链接」。关掉窗口即全部停止（也可以 `pnpm demo`）。

## 30 秒跑起来（手动版）

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

两种方式，二选一：

1. **网页里点**：`/print` → 勾卡 → 选地址 → 生成 PDF（最省事，不用开终端）
2. **命令行**（适合批量/换版式）：

```bash
python scripts/gen_cards.py --input cards/tasks.json --output cards/cards.pdf \
  --base-url http://192.168.0.108:8088 --codes-out cards/codes.json
```

- `--base-url` 决定二维码里的地址：**现场要写笔记本的局域网/热点 IP**，不要写 127.0.0.1
  （本机现在是 WLAN `192.168.0.108`，换网络后先 `ipconfig` 看一眼）
- 双面（正面卡片 + 背面复盘，翻页按长边镜像，实测 8 张全部对齐）：

  ```bash
  python scripts/gen_cards.py --input cards/tasks.json --output cards/cards-double.pdf \
    --double-sided --flip long --base-url http://192.168.0.108:8088
  ```

- 输出 `cards/codes.json`：短码 → 任务 ID，和数据库 `short_links` 对应
- 网页 `/print` 走的是同一个脚本：服务端把选中的卡拼成 JSON 从 stdin 喂进去，临时文件用完即删
  （这台机器要有 Python + `reportlab` + `qrcode`；没有会返回 501 并提示装包）
- 打出来先量二维码：不小于 15×15mm；用手机**自带相机**扫，不要用网页里调摄像头
- 空白表同样在 `/print` 里生成，走的也是 `gen_cards.py`：标题留空、行线保留，二维码照样是这张卡的身份证

## 目录

```
start-demo.cmd      一键启动（双击）
web/                前端（页面 / 组件 / 数据订阅 / PWA manifest 与图标）
server/index.mjs    生产服务器：托管 dist + 代理 PocketBase + /ds-api 结构化接口
server/pocketbase/  PocketBase 可执行文件、pb_data、pb_migrations（数据与迁移不入库）
seed/seed.mjs       建表 + 导入卡片数据（幂等）
scripts/gen_cards.py  A4 卡片 PDF 生成
scripts/start-demo.mjs  一键启动的实现（检查端口 / 起服务 / 打印地址）
scripts/set-key.mjs     命令行写 DeepSeek Key（也可以直接在网页「设置」里填）
cards/              tasks.json（卡片内容）、cards.pdf、cards-double.pdf、codes.json
android/            手机 App（WebView 外壳，里面就是同一个网页）
dist/taskcard.apk   已经打包好的手机安装包
docs/demo-script.md 三分钟讲稿 + 现场保险清单
tools/              下载 / 启动 PocketBase、CDP 截图、Android SDK 与 APK 打包脚本
```

## 手机 App（可选，但演示最稳）

`dist/taskcard.apk` 直接传到手机安装（第一次要允许「安装未知来源应用」）。
装好后第一次打开会问服务器地址，填电脑窗口里「手机打开」那一行，例如
`http://192.168.0.108:8088`。右下角「⋯」可以「刷新」「换服务器地址」「用浏览器打开」。

它就是个浏览器外壳：页面、数据、实时同步和电脑上完全一样，只是可以像 App 一样放在桌面。

重新打包（改了网页不用重打，改了 App 外壳才要）：

```bash
node tools/install-android.mjs   # 第一次：装 Android SDK 到 D:\Android\Sdk
node tools/build-apk.mjs         # 输出 dist/taskcard.apk
```

## 配置（Key 存在数据库里）

打开网页右上角「设置」，填 DeepSeek Key，保存即可，**不用重启**。

- Key 存在本机 PocketBase 的 `app_settings` 表，规则锁死，只有服务端用管理员身份读；
  网页上只显示 `sk-13…2684` 这种前后几位。
- `deepseek-flash`：文字解析 + 看图（照片识别）都能用；`deepseek-v4-pro` 只能文字。
- 命令行等价写法：`node scripts/set-key.mjs sk-xxxx`
- `.env.local` 里的同名项仍然可用，但**优先级低于网页设置**；不配 Key 时「解析成任务」走本地规则
  （标题、截止、用时、材料、备注都认），照片识别会提示未接。
- `PB_ADMIN_EMAIL/PASSWORD`：seed 建表用的本地管理员，仅本机
- `PORT`：网页端口，默认 8088

## 本机验收记录（最后一次跑）

| 项目 | 结果 |
|---|---|
| 扫码 → 改状态 → 看板实时 | 通过（1.6s 内出现「已完成」，无刷新） |
| 长期卡落地页 −10/＋10 | 通过（45 → 55，数据库与页面一致） |
| 落地页「记一笔」 | 通过（progress_logs +1，详情页可见） |
| 文字录入 → 存库 → 短码 | 通过（跳 `/tasks/<id>`，详情显示短码） |
| 8 个二维码解码 | 通过（OpenCV 解码全部 8 个为 `http://192.168.0.108:8088/t/<短码>`） |
| 双面 PDF | 通过（2 页：正面 8 张 + 背面 8 张复盘，长边镜像对齐） |
| 手机尺寸（390px）看板 / 全部任务 | 通过（分组、筛选、搜索无溢出） |
| 一键启动冷启动 | 通过（换掉两个服务后双击脚本，自动起 PB + 网页并打印地址） |
| 照片 OCR（配 Key 后） | 通过（一张卡片照片 1.6s 读出标题/截止/用时/材料/备注，存入后生成短码） |
| 手机 App（模拟器 Android 15） | 通过（装 `dist/taskcard.apk`，填 LAN 地址后加载看板，标题不被状态栏遮挡，⋯ 菜单可刷新/换地址） |
| 网页拼页 PDF（`/print`） | 通过（9 张 → 1 页 8 张 + 第 2 页 1 张，二维码解码全部指向所选地址；双面 → 页数翻倍，第 2 页起是复盘背面） |
| 删除级联 | 通过（详情页确认删除 → 任务 404、短链 0、进展 0，页面跳回 `/tasks`；纸卡落地页显示「已经不在系统里了」） |
| 拍照录入（模拟器塞图） | 通过（`input[type=file]` 选图 → 压到 1600px JPEG → 1.7s 出草稿 → 保存生成短码） |
| 接口错误码 | 通过（空 ids 400、`ftp://` 400、超 200 张 400、无 Python 501、脚本失败 502） |
| 空白表 PDF（`/print` → 空白表） | 通过（4 张 → 1 页，标题留空、行线保留、二维码+短码正常，`x-card-count: 4`） |
| 拍空白卡回填（先扫码再识读） | 通过（`.shots/hand_card_2x.png` → 认出 `Z7HAB4`/「空白卡 01」→ 读出标题/截止 11-08/用时 30/材料 → 保存写回，`draft` 变 false） |
| 拍错/没码的图 | 通过（整张卡没进画面 → 422「照片里没找到二维码」；模型空回复会自动重试一次） |

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
- 删除是硬删除，没有回收站；纸卡上的短码会一起失效
- 页内拍照（getUserMedia）只在 https / localhost 下出现；局域网 http 用「拍照识别」调系统相机
- 没有登录：局域网演示用，别放到公网
- 移动端就是同一套网页；Flutter 客户端只是下一步，不是现在
- PWA 目前只有 manifest + 图标（能「添加到主屏幕」），没有 Service Worker，断网打不开页面

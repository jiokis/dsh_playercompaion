# 验收记录

日期：2026-11-01（Asia/Shanghai）
项目：D:/path/to/dsh-lore-companion
DSH：0.2.1-rc.2 桌面版
Node：v25.9.0
Python：3.12.3
uv：0.12.3（%USERPROFILE%/.local/bin/uv.exe）
显示器：2560x1440，150% 缩放（引擎已声明 per-monitor DPI aware）

## 低延迟对话跟随 v0.19.0

- watch 默认间隔从 8 秒改为 1 秒；启动按钮也发 1 秒。
- 增加 `fast` 参数：`settle_ms=0`、`max_settle_ms=0`，watch 跳过稳定等待和每帧区域检测。
- watch 使用三套自适应裁切：底部条、下半区、全宽中下；空帧后切换，覆盖原神新旧对话框。
- Node 测试验证 fast 参数与区域轮换。

## 已通过

### Node 测试

命令：node --test

结果：71 / 71 通过。

覆盖：config（volatile + watch）、text/dedupe、store/query、narrate、wiki mock、tool-contract（7 个工具）、overlay manager、overlay bridge 截图/阅读命令、journal 事件/人物/关系聚合与命令契约、client bundle 注册、client 渲染树、Akasha MCP 解析/调用、WebSource 映射、lore_query 四源 fan-out、lore_vision 本地图片/frameId/实时参数/semantic OCR、帧归档保存/列表/读取/prune、capture frameId、lore_watch 启动/计数/停止/禁用/重复启动、watch remote 契约、readonly、agents-doc、query 默认 all。

### Python 测试

命令：<engine venv>/Scripts/python.exe -m pytest engine/tests -q

结果：33 / 33 通过。

覆盖：windows 纯函数、region 合成图、OCR 合成中文图与说话人拆分、真实对话框说话人/头衔/正文/选项拆分、UI 噪声拒绝（血量/等级/操作提示）、protocol ping/非法请求/无窗口错误、vision 合成图构图/UI/map/semantic、analyze_image 协议、菜单/属性截图拒绝、低置信度短文本过滤。

### 旅途视图 v0.19.0

- DSH 会话顶部新增 `conversation.view`「旅途」：人物卡片、同场关系条、事件梗概、详细对话搜索。
- `lib/journal.js` 纯本地聚合；`lib/journal-remote.js` 通过 Typert 暴露 snapshot；不调用模型、不上传。
- 事件按 6 分钟间隔分段，梗概取事件最早两句原文；人物关系按同场事件计数。
- 单元测试覆盖事件/人物/关系和命令契约；真实 DSH 视图渲染待重启确认。

### 悬浮窗 v0.7.0

- 面板可拖动，拖动期间暂停 300ms 位置重排，不再闪回原位。
- 右上角 `—` 收起为 52px 圆球，点圆球展开；位置/折叠状态写入 `layout.json`。
- 新排版 560x300：说话人 badge、正文、状态胶囊、底部 `截图 / 分析 / 阅读 / 查找`。
- `阅读` 使用更宽区域与 1600px OCR；`截图` 保存 PNG；`分析` 走本地 vision；`查找` 用当前台词查四路。
- `overlay-bridge.test.mjs` 覆盖截图与阅读命令；WPF 脚本经 PowerShell 5.1 parser 检查。
- 预览图见 `docs/preview-overlay.png`。

### 引擎自举与预热

- uv venv 使用 Python 3.12.3。
- 依赖：numpy 2.5.4、opencv-python 4.14.0.94、onnxruntime 1.31.1、rapidocr-onnxruntime 1.4.4、dxcam 0.3.0、mss 10.2.0。
- RapidOCR warmup：约 530–1020ms。
- 缓存：%LOCALAPPDATA%/dsh-lore-companion/engine/0.1.0-36e4283c。

### 抓屏与 OCR

- DXcam 成功抓取 2560x1440 主屏，output 0。
- 合成中文图（派蒙 + 正文）：OCR 结果完全正确，置信度 0.9974；说话人拆分为「派蒙」。
- 真实窗口（Windows 设置，2560x1368）：DXcam 抓屏 + 160 行 OCR 成功；中文文本正确（通过 UTF-8 JSON 复核，不是控制台乱码）。
- 文字簇检测：合成图返回 region method=cluster，框住文字；空图回退 fallback。
- 遮挡检测：Windows 设置窗口被其它窗口覆盖 2.56%，未达 0.2 阈值，允许抓屏。
- 原神无边框实测：YuanShen.exe，2560x1440，foreground，occlusion 0，DXcam 抓屏成功。早期误抓的书页（召回 / UID:125578810）和桌面/多窗口都被 UI 噪声、行数/文本长度、全宽/过高区域、前台要求拦下；之后真实对话框复测通过。

### 原神真实对话（通过）

- 场景：凯瑟琳，冒险家协会总部。
- 第一抓：speaker=凯瑟琳，speakerTitle=冒险家协会接待员，正文正确，persisted=true。
- 第二抓：duplicate=true，只写 seen，persisted=true。
- lore_query「凯瑟琳」：1 hit，带 context。
- lore_narrate：1 行 / 1 场景 / brief / prompt 含不剧透约束。
- JSONL 证据：data-realtest/logs/genshin/2026-11.jsonl（一条 dialogue + 一条 seen）。
- 右侧选项页：speakerTitle=冒险家协会接待员，choices=[关于至冬, 再见。]；正文不混入选项/UID。

### 插件层

- apply 注册七个工具：lore_status、lore_capture、lore_query、lore_narrate、lore_overlay、lore_vision、lore_watch。
- lore_status 端到端：engine=ready（cache）、OCR ready、games 两个均为 null（游戏未运行）、dataDir 正确。
- lore_capture 错误路径：无游戏窗口时返回 EngineError，消息里带可见窗口列表。
- lore_query：默认 game=all；日志检索命中带 context；默认 all 的回归测试通过。
- lore_narrate：返回 3 行 / 1 场景 / brief / prompt；prompt 包含不剧透约束。
- 安装到 lore-dev profile 后，从安装目录 import + apply 成功，依赖解析正常。

### 后台记录 v0.7.0

- `lib/watcher.js`：显式 start/stop/status；启动先抓一次，再按 2..300 秒轮询；不自动启动。
- 单元测试：fake capture 覆盖 captured/duplicate/skipped/empty/error、停止后不再 tick、禁用 start 拒绝、重复 start 拒绝、interval 下限 2 秒；60/60 通过。
- 复用 capture 管线，因此前台/遮挡/黑帧/去重/日志/悬浮窗/帧归档与 `lore_capture` 一致；不上传、不调用模型。
- `lore_status` 返回 `watch`；`lore_watch status` 返回 ticks/captured/duplicates/skipped/empty/errors/lastError。
- 真实游戏长跑（连续记录、切图、暂停恢复）尚未验收。

### 真机测试与修复 v0.7.0

- 2026-11-03 原神真实窗口（YuanShen.exe，2560×1440）已启动；`selftest` 识别窗口和 OCR ready。
- DSH 前台时 `lore_capture` 正确拒绝 OCCLUDED（遮挡 69.45%）；切到游戏后 `lore_watch`（旧 v0.5.0）3 秒轮询抓到 5 条，日志含派蒙「零食不算啦，嘿嘿嘿……」等真实台词。
- 暴露的问题：首条 `网网网`（score 0.5229）被当对话；`快走快走` 与正文同一排却被当说话人；属性/菜单截图（`Lv.90`、`22988/22988`、`Enter`）也会被当成对话。
- 修复：短文本低于 0.70 过滤；UID/属性/菜单噪声过滤；说话人必须位于正文上方；`dialogue_like` 要求有意义文本；新增 Python 回归测试。修复后需重启 DSH 重新抓取验收。
- 同时修复 `lore_status` 的 `previewError:null`、`lore_overlay` 的 `pid:null/scriptPath/lastError`、`lore_watch` 的 undefined window 参数。

### DSH 设置页与悬浮窗

- client bundle：`client.js` 通过假 ModuleLoader 注册 `plugins.bundle.config`（key=dsh-lore-companion）、locale `loreCompanion` 和 `configForms.get('lore-companion')`；测试通过。
- 主界面启动按钮：`client.js` 通过 `conversation.session.header.actions` slot 注册胶囊按钮，经 `remote.loreWatch` 调 `lib/watch-remote.js` 的 `execute`；按钮在启动后变绿并显示「停止记录」。remote 返回值已解包 `{ok,value}`。契约测试通过；桌面实际渲染待刷新/重启确认。
- Config 已改为 `.volatile()`；`resolveConfig` 能解包 volatile，设置页可编辑 row config。
- 悬浮窗：重做后的 WPF 预览在 2560x1440 屏幕上以 480x220 显示在右上（日志：showing at 1199,28 size 480x220；source initialized），截图见 docs/preview-overlay.png；带左侧蓝轨、图标、绿色状态胶囊、金色说话人 badge、选项 chip。
- 悬浮窗 manager：spawn 返回 pid、status running、hide/dispose 成功；缺脚本时返回可读错误。
- 悬浮窗状态：显示凯瑟琳 / 冒险家协会接待员 / 正文 / 选项 / session+时间；置顶、鼠标穿透、不抢焦点。
- 设置页 UI 重做：hero + 状态 chip、分组卡片、自定义 switch、粘性保存条；client-render 测试用假 React hook runtime 渲染出 hero/知识源/视觉分析（含语义 OCR 开关）/帧归档/后台记录/开关/保存条，静态预览见 docs/preview-settings.png（fake React + 实际 CSS，非桌面实际渲染）。
- 插件 icon：icon.png 128x128，已写入 locale meta（data URL）和 package manifest；桌面列表显示待安装后确认。
- 待桌面安装后确认：插件列表中的「旅途记录仪」标题/描述/icon、设置页的实际渲染。

### 多源检索

- Akasha MCP 实测：POST initialize + tools/call akasha_search（world=gi, keyword=凯瑟琳, maxResults=3）返回 3 个 pathHash，正文 snippet 解析正确；MCP 服务为 Story MCP 1.27.1。
- `lore_query` 四源 fan-out：本地日志 + BWIKI + Akasha + WebSource 的单元测试通过；显式 `sources` 覆盖 scope。
- WebSource 通过 DSH `ctx.web.search()` 映射 title/url/snippet/publishedAt；provider 由部署的 `deepseek-search-api` 选择。桌面 provider 的实际调用待安装后确认。
- 远程失败只产生 warning，不阻塞本地/BWIKI 结果。

### 帧归档 v0.3.0

- `lib/frames.js`：保存 `<dataDir>/frames/<game>/<date>/<frameId>.png + .json`，metadata 含 source/mode/analysis/metrics；maxFrames/retentionDays 清理；默认关闭。
- 单元测试：12 帧保存后按 maxFrames=10 保留 10 帧；list/read/bytes/非法 id/禁用 no-op 通过。
- 真实 e2e：`lore_vision` 本地图 → frameId `f_20261102-205153-dccae0` → 用 frameId 复分析（mode=ui），source=frame，panelCount=1；帧 PNG 1.44MB。
- `lore_status` 返回最近 frames；`lore_vision` 支持 frameId；capture 在 saveOnCapture 开启时返回 frameId。

### 视觉分析 v1.3 alpha

- `engine/lore_engine/vision.py`：构图（主体、三分法、重心、平衡、对称、对比度、色板）、UI 面板、地图 POI 候选、semantic（OCR 文字块 + 场景分类 + POI 邻近标签 + 构图/可读性建议）；纯本地 OpenCV，无模型/网络。
- 真实截图 `scripts/realtest-crop.png` 端到端：Node `lore_vision` → engine `analyze_image` → analysis + 标注附件，输出 9+ findings、panelCount=1、palette、mapLikelihood=0.25、scene=dialogue、textBlocks=3；标注图 docs/preview-vision.png。
- 实时模式复用 capture 的前台/遮挡/窗口检查，额外走 `vision` engine 方法；本地图片模式不依赖游戏窗口。
- 已知边界：地图是低置信度几何启发式，不是游戏坐标；语义分类是 OCR 关键词 + 几何，不是模型理解；对话裁切图上的构图主体框可能偏大；VLM 仍在路线图。

### BWIKI

- 原神「派蒙」：search + parse 成功，缓存 3 页，返回标题/URL/摘要/snippet。
- 星铁「三月七」：search + parse 成功，缓存 3 页；redirects=1 跟随重定向。
- 限流 2s、UA/referer、超时/重试、原子缓存均已启用。
- 去导航清洗已生效：首条 snippet 从「阅 编 刷 历」变为正文介绍。

### 烟测脚本

- scripts/smoke.ps1：warmup + selftest 成功（Windows PowerShell 5.1）。
- scripts/bootstrap-smoke.mjs：缓存命中。
- scripts/status-smoke.mjs、scripts/apply-smoke.mjs、scripts/installed-smoke.mjs：通过。

### 路线图

- 图像元素分析 v1.3 alpha 已实现并出现在工具列表：本地 composition/ui/map 启发式、实时/本地图片、可选标注图。
- v0.3.0 帧归档已实现（默认关闭）：PNG+JSON、frameId、retention；剩余：语义地图、VLM、更强构图建议；见 ROADMAP.md。
- v0.7.0 增加主界面「开始记录」胶囊与真机 OCR 噪声过滤。

## 待人工完成

### DSH 安装与 UI

- [ ] 桌面版插件 UI 安装 `D:/path/to/dsh-lore-companion`、启用并完全重启；确认插件列表显示「旅途记录仪」标题/描述/自定义 icon。
- [ ] 真实游戏运行 `lore_watch start` 连续记录 2–3 分钟，再 stop/status，确认重复/遮挡/切图行为与日志一致。
- [ ] 完全重启 DSH 后确认会话标题栏右侧出现「开始记录」胶囊；点击开始/停止，悬浮窗和日志同步。
- [ ] 打开 bundle 设置页，确认 hero/分组卡片/switch/知识源/视觉分析/帧归档字段的实际渲染；保存后重启生效。
- [ ] 安装后 `lore_status` 的 `sources.web.available=true`，`lore_query` 实际走通 DeepSeek Search；Akasha 实际返回 pathHash。
- [ ] 新会话确认 `lore_vision` 工具出现；用游戏窗口跑一次实时 composition/ui/map，检查标注图与遮挡检查。

### 真实游戏对话验收

原神真实对话已通过；星铁未运行，40 张历史截图（原神 20 / 星铁 20）只命中水印/UI 文本。剩余项目：

- [x] 原神无边框窗口、真实对话框：lore_capture 写入 JSONL，说话人/头衔/正文正确。
- [ ] 星铁无边框窗口、真实对话框：同上。
- [x] 同一句重复捕获只写 seen；lore_query 能按 speaker 命中。
- [x] 浏览器/桌面遮挡游戏时拒绝抓屏（实测 DSH 窗口覆盖 69% 时返回 OCCLUDED）。
- [ ] 10 分钟实录无重复刷屏；lore_query 用特征台词找回上下文。
- [x] lore_narrate brief 能支撑一段不剧透/不编造的陪玩解说（prompt 含硬约束）。
- [ ] 10 张真实对话截图 CER >= 90%。

验收步骤：

1. 游戏切「无边框窗口」，站在有说话人 + 正文的对话前。
2. 调 lore_status preview=true，检查裁剪图和 OCR 文本；必要时用 lore_capture 的 region 覆盖。
3. 连续 lore_capture 5–10 句，推进对话再记。
4. 遮挡测试；10 分钟实录；lore_query / lore_narrate。
5. 把结果补进 README 的验收一节，再宣称真实游戏可用。

## 备注

- 截图巡检暴露一个已知边界：无人对话时，文字簇检测可能把右下角水印当作文本；dialogueLike 宽度/位置检查会把它压成 skipped，不会写日志。原神真实对话框已确认；星铁仍待确认。
- 抓屏在独占全屏下不保证；HDR/覆盖层也可能影响。
- 本记录包含原神真实对话验收；星铁、10 分钟实录和 CER 门槛仍待补。

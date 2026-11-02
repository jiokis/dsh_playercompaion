# 路线图

这份路线图说明 v1 之后的方向，尤其是图像元素分析。未实现的能力不会出现在工具列表或 README 的“已支持”里。

## 当前 v1

- 抓屏 + 本地 RapidOCR + 对话区域拆分（说话人 / 头衔 / 正文 / 选项）。
- 本地 JSONL 剧情日志、去重、检索、解说素材。
- 多源检索：本地日志、BWIKI、虚空终端 Akasha MCP、DSH Web Search（DeepSeek 搜索）。
- DSH 设置页、WPF 游戏内悬浮窗。

## v1.2 多源与 UI

- lore_query 默认 all，可显式传 sources：log / wiki / akasha / web。
- Akasha 走 MCP akasha_search，结果保留 pathHash，可用 akasha_read 取原文。
- Web Search 走 DSH 的 ctx.web.search()，由部署配置的 DeepSeek Search/Fetch API 提供。
- 设置页与悬浮窗统一使用 DSH 的暗色表面、细边框、蓝色强调、金色说话人、胶囊状态与选项 chip。

## v1.5 后台记录（v0.5.0 已落地）

- lore_watch 显式 start/stop/status；启动先抓一次，再按 2..300 秒轮询；不自动启动。
- 复用 capture 管线：前台/遮挡/黑帧检查、OCR、去重、本地日志、悬浮窗、可选帧归档；不调用模型、不上传。
- 设置页控制 watch.enabled 与默认间隔；lore_status 返回 watch 状态。
- 真实游戏长跑（连续记录、切图、暂停恢复）仍需人工验收。

## v1.3 视觉元素分析（alpha 已落地）

用户提出“构图、地图设计”等图像元素分析。方向是从只读截图里提取**视觉结构**，不自动操作游戏。

### 已实现（v1.3 alpha）

- 新增 lore_vision 工具：composition / ui / map / all。
- 实时模式抓当前游戏窗口一次；imagePath 模式分析本地 PNG/JPG/WebP（≤20MB）。
- 构图：主体框、三分法、视觉重心、平衡、对称、对比度、K-means 主色板。
- UI：粗粒度面板检测，按顶部/底部/右侧标注。
- 地图：POI 候选、线段数量、mapLikelihood；明确低置信度，不是游戏坐标。
- includeImage 返回标注图附件；分析完全本地，不调用模型/不上传。
- 真实截图端到端已跑通；标注预览 docs/preview-vision.png。
- v0.3.0 帧归档：可选本地 PNG + JSON、frameId、maxFrames/retentionDays、lore_status 列表；默认关闭。
- v0.4.0 本地语义：mode=semantic 用 OCR 文字块 + 几何做场景分类（对话/地图/菜单/场景）、POI 邻近标签和构图/可读性建议。

### 后续增强

### 数据层（v0.3.0 已实现基础版）

- 帧归档由 config.frames 控制（enabled/saveOnCapture/saveVision/maxFrames/retentionDays），默认关闭。
- 帧目录：<dataDir>/frames/<game>/<YYYY-MM-DD>/<frameId>.png + .json；metadata 含 source/mode/analysis/metrics。
- 已有 windowImage 来源；OCR 框、UI 面板、按钮/选项、地图标记、路径候选的几何持久化仍是后续。
- 帧是本地文件，默认不上传；远程 VLM 必须显式 opt-in。

### 分析层：lore_vision 的后续增强

当前参数：mode、game、window、region、imagePath、frameId、maxFindings、includeImage。后续计划：

- frame：frameId 已支持；最新帧选择/帧浏览器仍是后续。
- 语义地图：地图类型、POI 聚类命名、区域边界、路径/比例尺；仍不做自动寻路。

当前输出（已实现）：

- composition：三分法/视觉重心、前景/背景层次、色块与对比、留白、引导线、主体框；返回归一化坐标与可解释的评分，不做“好看/不好看”的空泛判断。
- map：地图类型（提瓦特/星球/副本）、POI 聚类、区域边界、路径/道路候选、比例尺估计；**不输出自动寻路，不注入按键**。
- ui：面板层级、对话/选项布局、按钮密度、遮挡比例、字体可读性；用于校准抓屏区域和悬浮窗避让。
- all：组合报告，帧图作为 ctx.attachments 附件返回。

### v1.4 语义与 VLM

- 本地语义已落地（v0.4.0）：OCR 文字块 + 关键词 + 几何，不是模型。
- 下一步用可选 VLM 做“解释与命名”，不替代事实来源。
- 构图建议、地图区域命名、UI 可读性建议；必须标注哪些是模型推断。

### 模型与隐私

- 优先本地 OpenCV/几何启发式 + OCR 框；VLM 只做“解释与命名”，不做唯一事实来源。
- 可选 VLM 走 dsh-opencode-go / minimax-m3.1-flash；发送前显示/记录将要上传的帧，默认关闭。
- 不读游戏内存、不注入输入、不绕过反作弊；只分析用户主动截取的画面。

### 验收

- 10 张真实对话/地图截图，构图主体框与人工标注 IoU 达标；地图 POI 召回率与误报率记录。
- 帧与报告可复现；远程分析默认关闭，开启时有明确提示。
- 文档与设置页同步；未实现的模式不注册工具。

## 非目标

- 自动跑图、自动战斗、自动寻路、键鼠宏。
- 读取游戏内存、修改游戏文件、绕过反作弊。
- 把截图/日志默认上传到任何网络。

# 实时陪玩：调研与路线

> 目标不是让模型直接看屏幕，而是让插件先稳定地看见、记住、理解当前处境，再把受控上下文交给陪玩模型。

## 1. 调研结论

### 1.1 悬浮窗必须有固定视觉锚点

成熟 HUD 的折叠规则：收起方向要固定，面板从屏幕边缘向内收；展开时沿同一方向长回去。否则用户需要重新寻找控件，点击目标在空间上跳变。

- RustContracts HUD: Collapse Direction sets which corner the panel keeps fixed as it expands and collapses, so the HUD grows away from the screen edge rather than off-screen. https://www.rustcontracts.com/configuration/hud/#anchors
- Fitts's Law: 屏幕角落/边缘是低成本目标，收起后不应把可点击区域移到对角。https://bugs.kde.org/show_bug.cgi?id=443202#c1
- Floating Panel 常见失败模式：拖动/折叠后跑出屏幕、展开位置跳变。https://www.uixhero.com/resources/ui-components/floating-panel

v0.16 的做法：面板固定在右上角；收起时球出现在面板右上角；展开时窗口从球的右上角向左、向下生长；任何时候用 Clamp-Window 限制在工作区。

### 1.2 OCR：稳定性、时序和置信度优先

游戏 OCR 的误差通常不是单帧随机噪声，而是字幕过渡帧、重复半截句、小字号省略号、专有名词同音误识、UI 混入。成熟工具普遍采用图像稳定性/一致性阈值、多帧选择、后处理，而不是只换更大模型。

- LunarTranslator 的 OCR 自动化参数区分图像稳定性阈值和图像一致性阈值，用于适配不同游戏的文字刷新方式。https://github.com/hillya51/lunatranslator/blob/582ce9a3c293e353b0e9e4fa07e65813f1eded04/docs/zh/ocrparam.md
- flowocr 把视频文字按位置拆成文字轨（对白/字幕/UI/水印），带起止时间；时序轨道比逐帧散点更有价值。https://pypi.org/project/flowocr/
- 后 OCR 清理阈值：平均质量分低于 0.80、LLM 修正改动超过 10%、词典命中低于 80%、空页超过 5% 就应告警，而不是盲目让 LLM 重写。https://github.com/scdenney/open-science-skills/blob/main/plugin/skills/post-ocr-cleanup/SKILL.md

v0.16 的做法：保留低置信度省略号/单字回应；置信度低于 0.62 时对裁切区域做一次 1.5x 放大重识别，取更高分/更完整结果；UI 噪声继续在 OCR 和日志两层过滤；OCR 结果进入结构化记忆。

### 1.3 记忆：要存可查询的状态，不只存聊天记录

长期陪伴的难点不是上下文长度，而是可检索的状态：现在在哪个场景、谁在场、关系如何、哪些线索没解决、哪些话已经说过。

- NPC Graph + Graph-RAG：把角色、关系、事件写成图，模型先读图快照，再决定是否写入。https://github.com/ackness/covel/blob/e948bf1f4b9ed299d342549355d31fe23efeac1b/docs/architecture/npc-graph.md
- BRING：WorldMemory 分区持久化，强调 crash-safe、持久、可复用。https://github.com/Eva-E1/BRING
- 结论：扁平日志加派生结构，比一上来做向量库更稳。先有确定性的场景、人物、关系、线索，再考虑 embedding/LLM 摘要。

v0.16 新增 StoryMemory：scenes、characters、relationships、threads、recent，持久化到 dataDir/journal/memory.json；lore_story 增加 memory 与 context 动作。

## 2. 实时陪玩分层

Observe：截屏 / OCR / 置信度 / UI 遮罩

Remember：StoryMemory，场景、人物、关系、线索、最近对白

Understand：确定性上下文构建；可选的本地模型纠错

Companion：意图 → 剧透策略 → 建议 / 解说 / 语音

Safety：只读、不注入输入、默认不上传

### Phase 1（已落地，v0.16）

- 悬浮窗顶部右上锚点稳定
- 低置信度 OCR 放大重试
- StoryMemory + context API
- AI 清理稿优先作为记忆的最近对白

### Phase 2（下一步）

- 多帧共识：同一句在 2–3 帧内投票，低置信度才启用，避免拖慢 1s 轮询
- 场景切换检测：地点/人物/背景色变化 + 文本间隔
- 结构化纠错：只改说话人和专有名词，正文保留原样
- 记忆增量更新：watch 每 N 秒合并一次，而不是每次请求全量重建
- lore_story context 增加 spoiler、maxChars、focus 参数

### Phase 3（实时陪玩）

- 事件驱动的当前处境推送：新场景/新人物/战斗结束/选择支
- 受控建议：提示、考据、路线、配队，不替玩家操作
- 剧透等级：none / light / full
- 语音输入/输出作为独立可选层，不进入只读核心

### Phase 4（长期）

- 跨场次记忆与人物档案
- 关系图编辑/纠错
- 多游戏命名空间
- 可观测指标：OCR 置信度、重复率、场景切换准确率、上下文命中率

## 3. 边界

- 仍然只读：不注入输入、不读游戏内存、不改游戏文件、不抢焦点。
- 本地默认：截图、OCR、记忆文件不离开本机；陪玩模型调用必须是用户显式开启的独立层。
- 记忆不是事实：OCR 结果、AI 整理稿、玩家纠正要分层标注；不确定就标存疑。
- 记忆可删除：memory.json 是派生文件，删除后可从日志重建。

## 4. 参考

- HUD anchors: https://www.rustcontracts.com/configuration/hud/#anchors
- Fitts's Law corner issue: https://bugs.kde.org/show_bug.cgi?id=443202#c1
- Floating panel UX: https://www.uixhero.com/resources/ui-components/floating-panel
- LunarTranslator OCR timing: https://github.com/hillya51/lunatranslator/blob/582ce9a3c293e353b0e9e4fa07e65813f1eded04/docs/zh/ocrparam.md
- flowocr: https://pypi.org/project/flowocr/
- Post-OCR cleanup thresholds: https://github.com/scdenney/open-science-skills/blob/main/plugin/skills/post-ocr-cleanup/SKILL.md
- NPC Graph + Graph-RAG: https://github.com/ackness/covel/blob/e948bf1f4b9ed299d342549355d31fe23efeac1b/docs/architecture/npc-graph.md
- BRING world memory: https://github.com/Eva-E1/BRING
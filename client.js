/**
 * dsh-lore-companion - browser half.
 *
 * A DSH-style configuration page inside the sidebar Plugins page. It edits the
 * volatile row config (namespace "lore-companion") through configForms. Saving
 * persists the row config; the engine/runtime is built at startup, so the page
 * says restart DSH to apply. Hand-written ModuleLoader bundle, no build step.
 */
window.__ModuleLoader__.load({
  id: "dsh-lore-companion",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    var react = require("react");
    var h = react.createElement;

    var CSS = [
      ".lc-root{max-width:840px;display:flex;flex-direction:column;gap:14px;font-size:13px;line-height:1.65;color:var(--dsw-alias-label-primary,#e8ecf4);font-family:var(--dsw-font-family,'Microsoft YaHei UI',system-ui,sans-serif)}",
      ".lc-hero{position:relative;overflow:hidden;display:flex;gap:14px;align-items:flex-start;padding:18px 18px 16px;border-radius:14px;border:1px solid var(--dsw-alias-border-l2,#2a3140);background:linear-gradient(135deg,rgba(75,108,255,.16),rgba(75,108,255,0) 46%),var(--dsw-alias-bg-layer-2,#171a20)}",
      ".lc-hero::after{content:'';position:absolute;right:-40px;top:-70px;width:210px;height:210px;border-radius:50%;background:radial-gradient(circle,rgba(75,108,255,.20),rgba(75,108,255,0) 68%);pointer-events:none}",
      ".lc-mark{position:relative;z-index:1;width:42px;height:42px;flex:none;border-radius:12px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.16);background:linear-gradient(145deg,#4b6cff,#243b98);box-shadow:0 8px 20px rgba(38,62,158,.35),inset 0 1px 0 rgba(255,255,255,.18)}",
      ".lc-hero-body{position:relative;z-index:1;min-width:0;flex:1}",
      ".lc-eyebrow{font-size:9.5px;font-weight:650;letter-spacing:.16em;color:#7180a0;text-transform:uppercase}",
      ".lc-title{font-size:18px;font-weight:650;letter-spacing:.01em;margin-top:2px}",
      ".lc-sub{font-size:12px;color:var(--dsw-alias-label-secondary,#9aa4b2);margin-top:3px}",
      ".lc-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}",
      ".lc-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--dsw-alias-border-l2,#2a3140);border-radius:999px;background:rgba(255,255,255,.035);color:#9fb0cc;font-size:10.5px;line-height:1;padding:5px 8px;white-space:nowrap}",
      ".lc-chip-dot{width:5px;height:5px;border-radius:50%;background:#6f8dff;box-shadow:0 0 7px rgba(111,141,255,.7)}",
      ".lc-card{position:relative;border:1px solid var(--dsw-alias-border-l2,#2a3140);border-radius:12px;background:var(--dsw-alias-bg-layer-2,#171a20);padding:14px 16px 15px}",
      ".lc-card-head{display:flex;align-items:flex-start;gap:8px;margin-bottom:11px}",
      ".lc-card-dot{width:6px;height:6px;border-radius:50%;background:#6f8dff;box-shadow:0 0 8px rgba(111,141,255,.55);margin-top:6px;flex:none}",
      ".lc-card-title{font-size:12.5px;font-weight:650;letter-spacing:.01em;color:var(--dsw-alias-label-primary,#e8ecf4)}",
      ".lc-card-desc{font-size:11px;color:var(--dsw-alias-label-tertiary,#71809a);margin-top:1px}",
      ".lc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px 16px}",
      ".lc-field{display:flex;flex-direction:column;gap:5px;min-width:0}",
      ".lc-field-wide{grid-column:1 / -1}",
      ".lc-label{font-size:11.5px;font-weight:550;color:var(--dsw-alias-label-primary,#e8ecf4)}",
      ".lc-input{width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#2a3140);border-radius:7px;background:var(--dsw-alias-bg-layer-3,#101218);color:inherit;font:inherit;font-size:12.5px;padding:7px 10px;min-height:34px;transition:border-color .12s,box-shadow .12s;font-variant-numeric:tabular-nums}",
      ".lc-input:hover:not(:disabled){border-color:#3a465e}",
      ".lc-input:focus{outline:none;border-color:#5b7cff;box-shadow:0 0 0 3px rgba(75,108,255,.16)}",
      ".lc-input:disabled{opacity:.55;cursor:default}",
      ".lc-checkrow{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:34px;padding:0 1px}",
      ".lc-checkrow .lc-label{font-weight:500;color:var(--dsw-alias-label-secondary,#b7c1d4)}",
      ".lc-switch{position:relative;width:36px;height:20px;flex:none;border-radius:999px;border:1px solid #354056;background:#1b202b;padding:0;cursor:pointer;transition:background .15s,border-color .15s;box-shadow:inset 0 1px 2px rgba(0,0,0,.35)}",
      ".lc-switch[data-on='true']{background:#4b6cff;border-color:#6f8dff;box-shadow:0 0 12px rgba(75,108,255,.28),inset 0 1px 1px rgba(255,255,255,.18)}",
      ".lc-switch:disabled{opacity:.5;cursor:default}",
      ".lc-knob{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.4);transition:transform .15s}",
      ".lc-switch[data-on='true'] .lc-knob{transform:translateX(16px)}",
      ".lc-actions{position:sticky;bottom:0;z-index:2;display:flex;flex-wrap:wrap;gap:9px;align-items:center;padding:11px 2px 9px;margin-top:2px;background:linear-gradient(180deg,rgba(15,17,22,0),rgba(15,17,22,.96) 30%);backdrop-filter:blur(6px)}",
      ".lc-btn{border:1px solid var(--dsw-alias-border-l2,#2a3140);background:var(--dsw-alias-bg-layer-3,#111318);color:inherit;border-radius:8px;padding:7px 15px;font:inherit;font-size:12.5px;cursor:pointer;transition:border-color .12s,background .12s}",
      ".lc-btn:hover:not(:disabled){border-color:#4b6cff;background:#151a24}",
      ".lc-btn:disabled{opacity:.5;cursor:default}",
      ".lc-primary{border-color:#5b7cff;background:linear-gradient(180deg,#5b7cff,#3e5ce0);color:#fff;box-shadow:0 6px 16px rgba(62,92,224,.22)}",
      ".lc-primary:hover:not(:disabled){background:linear-gradient(180deg,#6b8aff,#4c6bf0);border-color:#7b94ff}",
      ".lc-note{font-size:11px;color:var(--dsw-alias-label-tertiary,#71809a);padding:0 2px}",
      ".lc-banner{display:flex;gap:8px;align-items:flex-start;border:1px solid rgba(75,108,255,.22);border-radius:9px;background:rgba(75,108,255,.07);padding:8px 10px;font-size:11px;color:#a9b8d6}",
      ".lc-ok{font-size:11.5px;color:var(--dsw-alias-state-success-primary,#4ed89a)}",
      ".lc-error{font-size:11.5px;color:var(--dsw-alias-state-error-primary,#f05b6a)}",
      ".lc-unavailable{font-size:13px;color:var(--dsw-alias-label-tertiary,#71809a);padding:8px 0}",
      ".lc-watch{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,#2a3140);background:rgba(255,255,255,.035);color:var(--dsw-alias-label-secondary,#aab6ca);font:inherit;font-size:11.5px;line-height:1;cursor:pointer;white-space:nowrap;transition:border-color .15s,background .15s,color .15s}",
      ".lc-watch:hover:not(:disabled){border-color:#5b7cff;background:rgba(75,108,255,.12);color:var(--dsw-alias-label-primary,#e8ecf4)}",
      ".lc-watch:disabled{opacity:.55;cursor:default}",
      ".lc-watch-on{border-color:rgba(78,216,154,.4);background:rgba(78,216,154,.09);color:#8fe3b0}",
      ".lc-watch-on:hover:not(:disabled){border-color:rgba(78,216,154,.65);background:rgba(78,216,154,.14);color:#b8f0cc}",
      ".lc-watch-dot{width:6px;height:6px;border-radius:50%;background:#6f8dff;box-shadow:0 0 7px rgba(111,141,255,.65);flex:none}",
      ".lc-watch-on .lc-watch-dot{background:#4ed89a;box-shadow:0 0 7px rgba(78,216,154,.7)}",
      ".lc-watch-count{color:var(--dsw-alias-label-tertiary,#71809a);font-size:10px;font-variant-numeric:tabular-nums;margin-left:1px}",
      "@media (max-width:640px){.lc-grid{grid-template-columns:1fr}.lc-hero{padding:14px}}"
    ].join("");

    var tagId = "dsh-lore-companion-css";
    if (!document.getElementById(tagId)) {
      var tag = document.createElement("style");
      tag.id = tagId;
      tag.dataset.plugin = "dsh-lore-companion";
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    var NS = "loreCompanion";
    var zh = {
      title: "旅途记录仪",
      subtitle: "只读 · 原神 / 星铁 · 抓屏 OCR · 本地日志 · 游戏内悬浮窗",
      tools: "工具：lore_status / lore_capture / lore_query / lore_narrate / lore_overlay / lore_vision / lore_watch",
      intro: "保存后请重启 DSH 生效；本页只改配置，不写日志、不抓屏。",
      save: "保存",
      reset: "恢复默认",
      saved: "已保存；重启 DSH 生效。",
      notApplied: "Host 拒绝了这次写入，请刷新后重试。",
      notReady: "配置还没有就绪。",
      readOnly: "当前配置不可写。",
      error: "保存失败",
      advanced: "高级选项",
      data: "数据",
      capture: "抓屏与 OCR",
      regions: "对话区域（归一化 0..1）",
      dedupe: "去重",
      wiki: "Wiki",
      narrate: "解说",
      overlay: "游戏内悬浮窗",
      watchStart: "开始记录",
      watchStop: "停止记录",
      watchBusy: "处理中",
      watchUnavailable: "记录不可用",
      watchHintStart: "开始后台记录；切到游戏即可",
      watchHintStop: "后台记录运行中；点击停止",
      hintData: "默认放在 %LOCALAPPDATA%/dsh-lore-companion/data。",
      hintOverlay: "悬浮窗置顶、鼠标穿透、不抢焦点；只在原神/星铁前台显示。"
    };
    var en = {
      title: "Lore Companion",
      subtitle: "Read-only Genshin / Star Rail capture, OCR, local log and in-game overlay",
      tools: "Tools: lore_status / lore_capture / lore_query / lore_narrate / lore_overlay / lore_vision / lore_watch",
      intro: "Saving persists the row config. Restart DSH to apply; this page never captures or writes logs.",
      save: "Save",
      reset: "Reset",
      saved: "Saved; restart DSH to apply.",
      notApplied: "The host refused this write; refresh and retry.",
      notReady: "Configuration is not ready.",
      readOnly: "This configuration is read-only.",
      watchStart: "Start recording",
      watchStop: "Stop recording",
      watchBusy: "Working",
      watchUnavailable: "Recording unavailable",
      watchHintStart: "Start background recording, then switch to the game",
      watchHintStop: "Background recording is running; click to stop",
      error: "Save failed",
      advanced: "Advanced",
      data: "Data",
      capture: "Capture and OCR",
      regions: "Dialogue regions (0..1)",
      dedupe: "Dedup",
      wiki: "Wiki",
      narrate: "Narration",
      overlay: "In-game overlay",
      hintData: "Default: %LOCALAPPDATA%/dsh-lore-companion/data.",
      hintOverlay: "Always-on-top, click-through, never steals focus; shown only while Genshin/HSR is foreground."
    };

    var FIELDS = [
      { path: ["dataDir"], label: "数据目录（留空用默认）", labelEn: "Data directory (blank = default)", type: "text", group: "data", wide: true },
      { path: ["capture", "settleMs"], label: "稳定等待 ms", labelEn: "Settle ms", type: "number", group: "capture", step: 50 },
      { path: ["capture", "maxSettleMs"], label: "最长等待 ms", labelEn: "Max settle ms", type: "number", group: "capture", step: 50 },
      { path: ["capture", "minScore"], label: "OCR 最低置信度", labelEn: "Min OCR score", type: "number", group: "capture", step: 0.01 },
      { path: ["capture", "occlusionThreshold"], label: "遮挡阈值", labelEn: "Occlusion threshold", type: "number", group: "capture", step: 0.01 },
      { path: ["capture", "backend"], label: "抓屏后端", labelEn: "Capture backend", type: "select", group: "capture", options: [["auto", "auto"], ["dxcam", "DXcam"], ["mss", "mss"]] },
      { path: ["capture", "outputIndex"], label: "DXcam 输出序号（可空）", labelEn: "DXcam output index (optional)", type: "number", group: "capture" },
      { path: ["regions", "genshin", "x"], label: "原神 x", labelEn: "Genshin x", type: "number", group: "regions", step: 0.01 },
      { path: ["regions", "genshin", "y"], label: "原神 y", labelEn: "Genshin y", type: "number", group: "regions", step: 0.01 },
      { path: ["regions", "genshin", "w"], label: "原神 w", labelEn: "Genshin w", type: "number", group: "regions", step: 0.01 },
      { path: ["regions", "genshin", "h"], label: "原神 h", labelEn: "Genshin h", type: "number", group: "regions", step: 0.01 },
      { path: ["regions", "hsr", "x"], label: "星铁 x", labelEn: "HSR x", type: "number", group: "regions", step: 0.01 },
      { path: ["regions", "hsr", "y"], label: "星铁 y", labelEn: "HSR y", type: "number", group: "regions", step: 0.01 },
      { path: ["regions", "hsr", "w"], label: "星铁 w", labelEn: "HSR w", type: "number", group: "regions", step: 0.01 },
      { path: ["regions", "hsr", "h"], label: "星铁 h", labelEn: "HSR h", type: "number", group: "regions", step: 0.01 },
      { path: ["dedupe", "windowMinutes"], label: "去重时间窗 分钟", labelEn: "Dedup window min", type: "number", group: "dedupe", step: 1 },
      { path: ["dedupe", "similarity"], label: "相似度阈值", labelEn: "Similarity", type: "number", group: "dedupe", step: 0.01 },
      { path: ["dedupe", "compareLast"], label: "比较最近条数", labelEn: "Compare last", type: "number", group: "dedupe", step: 1 },
      { path: ["wiki", "enabled"], label: "启用 BWIKI 检索", labelEn: "Enable BWIKI lookup", type: "checkbox", group: "wiki" },
      { path: ["wiki", "requestIntervalMs"], label: "请求间隔 ms", labelEn: "Request interval ms", type: "number", group: "wiki", step: 100 },
      { path: ["wiki", "cacheTtlDays"], label: "缓存天数", labelEn: "Cache TTL days", type: "number", group: "wiki", step: 1 },
      { path: ["wiki", "maxPages"], label: "最大缓存页数", labelEn: "Max cached pages", type: "number", group: "wiki", step: 10 },
      { path: ["sources", "akasha", "enabled"], label: "启用虚空终端 MCP", labelEn: "Enable Akasha MCP", type: "checkbox", group: "sources" },
      { path: ["sources", "akasha", "url"], label: "MCP 地址", labelEn: "MCP URL", type: "text", group: "sources", wide: true },
      { path: ["sources", "akasha", "timeoutMs"], label: "Akasha 超时 ms", labelEn: "Akasha timeout ms", type: "number", group: "sources", step: 500 },
      { path: ["sources", "akasha", "maxResults"], label: "Akasha 条数", labelEn: "Akasha results", type: "number", group: "sources", step: 1 },
      { path: ["sources", "web", "enabled"], label: "启用 DeepSeek Web Search", labelEn: "Enable DeepSeek web search", type: "checkbox", group: "sources" },
      { path: ["sources", "web", "maxResults"], label: "Web 条数", labelEn: "Web results", type: "number", group: "sources", step: 1 },
      { path: ["vision", "enabled"], label: "启用本地视觉分析", labelEn: "Enable local vision", type: "checkbox", group: "vision" },
      { path: ["vision", "maxFindings"], label: "每节最多发现数", labelEn: "Max findings per section", type: "number", group: "vision", step: 1 },
      { path: ["vision", "includeText"], label: "语义分析读取 OCR 文本", labelEn: "Use OCR text for semantic analysis", type: "checkbox", group: "vision" },
      { path: ["frames", "enabled"], label: "启用帧归档", labelEn: "Enable frame archive", type: "checkbox", group: "frames" },
      { path: ["frames", "saveOnCapture"], label: "抓取时保存窗口帧", labelEn: "Save window frame on capture", type: "checkbox", group: "frames" },
      { path: ["frames", "saveVision"], label: "视觉分析时保存帧", labelEn: "Save frame on vision", type: "checkbox", group: "frames" },
      { path: ["frames", "maxFrames"], label: "最多保留帧数", labelEn: "Max frames", type: "number", group: "frames", step: 10 },
      { path: ["frames", "retentionDays"], label: "保留天数", labelEn: "Retention days", type: "number", group: "frames", step: 1 },
      { path: ["watch", "enabled"], label: "启用后台记录", labelEn: "Enable background watch", type: "checkbox", group: "watch" },
      { path: ["watch", "intervalSec"], label: "轮询间隔秒", labelEn: "Watch interval sec", type: "number", group: "watch", step: 1 },
      { path: ["narrate", "defaultLast"], label: "默认取最近句数", labelEn: "Default last lines", type: "number", group: "narrate", step: 1 },
      { path: ["narrate", "maxChars"], label: "解说建议字数", labelEn: "Narration chars", type: "number", group: "narrate", step: 50 },
      { path: ["narrate", "defaultStyle"], label: "默认解说风格", labelEn: "Default style", type: "select", group: "narrate", options: [["陪玩解说", "陪玩解说"], ["剧情复盘", "剧情复盘"], ["冷知识吐槽", "冷知识吐槽"]] },
      { path: ["overlay", "enabled"], label: "启用游戏内悬浮窗", labelEn: "Enable in-game overlay", type: "checkbox", group: "overlay" },
      { path: ["overlay", "autoShow"], label: "抓取后自动显示", labelEn: "Show after capture", type: "checkbox", group: "overlay" },
      { path: ["overlay", "position"], label: "位置", labelEn: "Position", type: "select", group: "overlay", options: [["top-right", "右上"], ["top-left", "左上"], ["bottom-center", "底部居中"]] },
      { path: ["overlay", "width"], label: "宽度 px", labelEn: "Width px", type: "number", group: "overlay", step: 10 },
      { path: ["overlay", "height"], label: "高度 px", labelEn: "Height px", type: "number", group: "overlay", step: 10 },
      { path: ["overlay", "margin"], label: "边距 px", labelEn: "Margin px", type: "number", group: "overlay", step: 2 },
      { path: ["overlay", "opacity"], label: "不透明度", labelEn: "Opacity", type: "number", group: "overlay", step: 0.01 },
      { path: ["overlay", "autoHideOnGameLost"], label: "离开游戏自动隐藏", labelEn: "Auto-hide when game lost", type: "checkbox", group: "overlay" }
    ];
    FIELDS.forEach(function (field) { field.key = field.path.join("."); });

    var GROUPS = [
      { id: "data", zh: "数据", en: "Data", descZh: "数据目录与本地缓存", descEn: "Data directory and local cache" },
      { id: "capture", zh: "抓屏与 OCR", en: "Capture and OCR", descZh: "DXcam / mss · RapidOCR", descEn: "DXcam / mss · RapidOCR" },
      { id: "regions", zh: "对话区域", en: "Dialogue regions", descZh: "归一化 0..1；只裁对话区", descEn: "Normalized 0..1; crop the dialogue area only" },
      { id: "dedupe", zh: "去重", en: "Dedup", descZh: "重复句只追加 seen，不重复记录", descEn: "Duplicate lines append seen only" },
      { id: "wiki", zh: "BWIKI", en: "BWIKI", descZh: "MediaWiki 搜索 + 本地缓存", descEn: "MediaWiki search with local cache" },
      { id: "sources", zh: "知识源", en: "Knowledge sources", descZh: "虚空终端 MCP · DeepSeek Web Search", descEn: "Akasha MCP · DeepSeek web search" },
      { id: "vision", zh: "视觉分析", en: "Vision analysis", descZh: "本地构图 / UI / 地图启发式", descEn: "Local composition / UI / map heuristics" },
      { id: "frames", zh: "帧归档", en: "Frame archive", descZh: "本地 PNG + JSON；默认关闭", descEn: "Local PNG + JSON; off by default" },
      { id: "watch", zh: "后台记录", en: "Background watch", descZh: "显式 start/stop；本地抓取，不自动启动", descEn: "Explicit start/stop; local capture, never auto-start" },
      { id: "narrate", zh: "解说", en: "Narration", descZh: "只出材料，不调用 LLM", descEn: "Material only; no LLM call" },
      { id: "overlay", zh: "游戏内悬浮窗", en: "In-game overlay", descZh: "置顶、穿透、不抢焦点", descEn: "Topmost, click-through, no focus" }
    ];

    function getPath(obj, path) {
      var current = obj;
      for (var index = 0; index < path.length; index += 1) {
        if (current === null || current === undefined || typeof current !== "object") return undefined;
        current = current[path[index]];
      }
      return current;
    }

    function useLocale(locale) {
      var pair = react.useState(0);
      var refresh = pair[1];
      react.useEffect(function () {
        if (!locale || typeof locale.subscribe !== "function") return undefined;
        return locale.subscribe(function () { refresh(function (value) { return value + 1; }); });
      }, [locale]);
    }

    function messageText(t, message) {
      if (!message) return "";
      return t(message.key) + (message.detail ? ": " + message.detail : "");
    }

    function Toggle(props) {
      return h("button", {
        type: "button",
        role: "switch",
        "aria-checked": props.checked ? "true" : "false",
        "data-on": props.checked ? "true" : "false",
        className: "lc-switch",
        disabled: props.disabled,
        onClick: function () { props.onChange(!props.checked); }
      }, h("span", { className: "lc-knob" }));
    }

    function LoreSection(props) {
      useLocale(props.locale);
      var t = props.t;
      var scope = props.scope;
      var pair = react.useState(function () { return scope.getSnapshot(); });
      var snapshot = pair[0];
      var setSnapshot = pair[1];
      var draftPair = react.useState({});
      var draft = draftPair[0];
      var setDraft = draftPair[1];
      var busyPair = react.useState(false);
      var busy = busyPair[0];
      var setBusy = busyPair[1];
      var noticePair = react.useState(null);
      var notice = noticePair[0];
      var setNotice = noticePair[1];
      var errorPair = react.useState(null);
      var error = errorPair[0];
      var setError = errorPair[1];
      var ready = snapshot.status === "ready" && snapshot.value !== undefined;

      react.useEffect(function () {
        var alive = true;
        var sync = function () { if (alive) setSnapshot(scope.getSnapshot()); };
        var unsubscribe = typeof scope.subscribe === "function" ? scope.subscribe(sync) : null;
        return function () { alive = false; if (unsubscribe) unsubscribe(); };
      }, [scope]);

      react.useEffect(function () {
        if (ready) setDraft({});
      }, [ready]);

      function valueOf(field) {
        if (Object.prototype.hasOwnProperty.call(draft, field.key)) return draft[field.key];
        var value = getPath(snapshot.value, field.path);
        return value === undefined || value === null ? "" : value;
      }

      function setField(field, value) {
        var next = Object.assign({}, draft);
        next[field.key] = value;
        setDraft(next);
        setNotice(null);
        setError(null);
      }

      function commit(ops) {
        if (!ops.length) {
          setNotice({ key: "saved" });
          return;
        }
        setBusy(true);
        Promise.resolve().then(function () {
          return scope.mutate(ops, snapshot.revision);
        }).then(function (ok) {
          var next = scope.getSnapshot();
          setSnapshot(next);
          setBusy(false);
          if (!ok) {
            setError({ key: "notApplied" });
            return;
          }
          setNotice({ key: "saved" });
          setDraft({});
        }).catch(function (cause) {
          setBusy(false);
          setError({ key: "error", detail: String(cause && cause.message ? cause.message : cause) });
        });
      }

      function onSave() {
        if (busy || !snapshot.writable) return;
        var ops = [];
        FIELDS.forEach(function (field) {
          if (!Object.prototype.hasOwnProperty.call(draft, field.key)) return;
          var value = draft[field.key];
          if (value === "" || value === null || value === undefined) {
            ops.push({ op: "unset", path: field.path });
          } else {
            ops.push({ op: "set", path: field.path, value: field.type === "number" ? Number(value) : value });
          }
        });
        commit(ops);
      }

      function onReset() {
        if (busy || !snapshot.writable) return;
        commit(FIELDS.map(function (field) { return { op: "unset", path: field.path }; }));
      }

      var isEn = Boolean(props.locale && props.locale.current === "en");
      var chips = isEn
        ? ["Read-only", "7 tools", "Local OCR", "Akasha MCP", "DeepSeek search"]
        : ["只读", "7 个工具", "本地 OCR", "虚空终端 MCP", "DeepSeek 搜索"];
      var mark = h("div", { className: "lc-mark" },
        h("svg", { viewBox: "0 0 24 24", width: "22", height: "22", "aria-hidden": "true" },
          h("path", { d: "M6 3.5h12v17l-6-4.2-6 4.2z", fill: "none", stroke: "#fff", strokeWidth: "1.8", strokeLinejoin: "round" }),
          h("circle", { cx: "12", cy: "9", r: "2.2", fill: "#E8C47A" })
        )
      );
      var hero = h("div", { className: "lc-hero" },
        mark,
        h("div", { className: "lc-hero-body" },
          h("div", { className: "lc-eyebrow" }, "DSH · LORE COMPANION"),
          h("div", { className: "lc-title" }, t("title")),
          h("div", { className: "lc-sub" }, t("subtitle")),
          h("div", { className: "lc-chips" }, chips.map(function (chip) {
            return h("span", { className: "lc-chip", key: chip }, h("span", { className: "lc-chip-dot" }), chip);
          }))
        )
      );

      if (!ready) {
        return h("div", { className: "lc-root" }, hero, h("div", { className: "lc-unavailable" }, t("notReady")));
      }

      var nodes = [hero];
      nodes.push(h("div", { className: "lc-banner" }, t("intro")));
      if (!snapshot.writable) nodes.push(h("div", { className: "lc-note" }, t("readOnly")));

      GROUPS.forEach(function (group) {
        var fields = FIELDS.filter(function (field) { return field.group === group.id; });
        if (!fields.length) return;
        var groupLabel = isEn ? group.en : group.zh;
        var groupDesc = isEn ? group.descEn : group.descZh;
        nodes.push(h("section", { className: "lc-card", key: "group-" + group.id },
          h("div", { className: "lc-card-head" },
            h("span", { className: "lc-card-dot" }),
            h("div", null,
              h("div", { className: "lc-card-title" }, groupLabel),
              groupDesc ? h("div", { className: "lc-card-desc" }, groupDesc) : null
            )
          ),
          h("div", { className: "lc-grid" }, fields.map(function (field) {
            var label = isEn ? (field.labelEn || field.label) : field.label;
            var value = valueOf(field);
            if (field.type === "checkbox") {
              return h("div", { className: "lc-field", key: field.key },
                h("div", { className: "lc-checkrow" },
                  h("div", { className: "lc-label" }, label),
                  h(Toggle, {
                    checked: value === true,
                    disabled: !snapshot.writable || busy,
                    onChange: function (next) { setField(field, next); }
                  })
                )
              );
            }
            var input;
            if (field.type === "select") {
              input = h("select", { className: "lc-input", value: String(value === "" ? field.options[0][0] : value), disabled: !snapshot.writable || busy, onChange: function (event) { setField(field, event.target.value); } },
                field.options.map(function (option) { return h("option", { value: option[0], key: option[0] }, option[1]); })
              );
            } else {
              input = h("input", {
                className: "lc-input",
                type: field.type === "number" ? "number" : "text",
                step: field.step ? String(field.step) : undefined,
                value: value === "" ? "" : String(value),
                disabled: !snapshot.writable || busy,
                onChange: function (event) { setField(field, event.target.value); }
              });
            }
            return h("div", { className: "lc-field" + (field.wide ? " lc-field-wide" : ""), key: field.key },
              h("div", { className: "lc-label" }, label),
              input
            );
          }))
        ));
      });

      nodes.push(h("div", { className: "lc-actions" },
        h("button", { className: "lc-btn lc-primary", type: "button", disabled: busy || !snapshot.writable, onClick: onSave }, t("save")),
        h("button", { className: "lc-btn", type: "button", disabled: busy || !snapshot.writable, onClick: onReset }, t("reset")),
        notice ? h("span", { className: "lc-ok" }, messageText(t, notice)) : null,
        error ? h("span", { className: "lc-error" }, messageText(t, error)) : null
      ));
      nodes.push(h("div", { className: "lc-note" }, t("hintOverlay")));
      return h("div", { className: "lc-root" }, nodes);
    }

    var watchCommandCodec = {
      mode: "strict",
      typeSymbol: "dsh-lore-companion#WatchCommand",
      schema: { parse: function (value) { return value; } },
      create: function () { return { parse: function (value) { return value; } }; }
    };
    var watchStatusCodec = {
      mode: "strict",
      typeSymbol: "dsh-lore-companion#WatchStatus",
      schema: { parse: function (value) { return value; } },
      create: function () { return { parse: function (value) { return value; } }; }
    };
    var watchRemote = {
      package: "dsh-lore-companion",
      descriptors: [{
        id: "dsh-lore-companion#loreWatch/execute",
        service: "loreWatch",
        namespace: "loreWatch",
        method: "execute",
        invocation: { kind: "direct" },
        parameters: [{ name: "command", wire: "command", source: "json", codec: watchCommandCodec }],
        result: watchStatusCodec
      }]
    };

    function WatchButton(props) {
      var execute = props.execute;
      var t = props.t;
      var stateHook = react.useState({ status: null, busy: false, error: null });
      var state = stateHook[0];
      var setState = stateHook[1];
      react.useEffect(function () {
        var alive = true;
        var refresh = function () {
          execute({ action: "status" }).then(function (status) {
            if (!alive) return;
            setState(function (previous) { return Object.assign({}, previous, { status: status, error: null }); });
          }).catch(function (error) {
            if (!alive) return;
            setState(function (previous) { return Object.assign({}, previous, { error: String(error && error.message || error) }); });
          });
        };
        refresh();
        var timer = setInterval(refresh, 2000);
        return function () { alive = false; clearInterval(timer); };
      }, [execute]);
      var running = Boolean(state.status && state.status.running);
      var busy = state.busy;
      var label = busy ? t("watchBusy") : running ? t("watchStop") : t("watchStart");
      var title = state.error || (running ? t("watchHintStop") : t("watchHintStart"));
      var toggle = function () {
        if (busy) return;
        setState(function (previous) { return Object.assign({}, previous, { busy: true, error: null }); });
        var action = running ? "stop" : "start";
        var command = action === "start" ? { action: action, game: "auto", intervalSec: 8 } : { action: action };
        execute(command).then(function (status) {
          setState(function (previous) { return Object.assign({}, previous, { status: status, busy: false, error: null }); });
        }).catch(function (error) {
          setState(function (previous) { return Object.assign({}, previous, { busy: false, error: String(error && error.message || error) }); });
        });
      };
      var children = [
        h("span", { className: "lc-watch-dot", key: "dot" }),
        h("span", { key: "label" }, label)
      ];
      if (running && state.status && state.status.ticks) {
        children.push(h("span", { className: "lc-watch-count", key: "count" }, String(state.status.ticks)));
      }
      return h("button", {
        className: "lc-watch" + (running ? " lc-watch-on" : ""),
        type: "button",
        "aria-label": label,
        "aria-pressed": running,
        title: title,
        disabled: busy,
        onClick: toggle
      }, children);
    }

    var inject = ["slots", "locale", "configForms", "remote"];

    function apply(ctx) {
      var t = ctx.locale.bind(NS);
      ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }); }, "dsh-lore-companion: dictionaries");
      var scope = ctx.configForms.get("lore-companion");
      ctx.slots.inject("plugins.bundle.config", function () {
        return ctx.slots.register({
          name: "plugins.bundle.config",
          key: "dsh-lore-companion",
          locale: NS
        }, function (props) {
          return h(LoreSection, Object.assign({}, props, { scope: scope, t: t, locale: ctx.locale }));
        });
      });
      if (ctx.remote && typeof ctx.remote.$mount === "function") {
        var mounted = ctx.remote.$mount(watchRemote);
        ctx.effect(function () { return Promise.resolve(mounted); }, "dsh-lore-companion: mount watch remote");
        ctx.inject(["remote.loreWatch"], function (ready) {
          ctx.slots.inject("conversation.input.right", function () {
            return ctx.slots.register({
              name: "conversation.input.right",
              id: "lore-watch-button",
              order: 10,
              inject: function () {
                return { execute: ready.remote.loreWatch.execute, t: t };
              }
            }, WatchButton);
          });
        });
      }
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});

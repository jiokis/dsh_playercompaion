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
    var reactDom = null;
    try { reactDom = require("react-dom"); } catch (error) { /* portal is optional */ }

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
      ".lc-watch-slot{display:inline-flex;align-items:center;margin-left:4px}",
      ".lc-journal{display:flex;flex-direction:column;gap:14px;padding:18px 22px 28px;max-width:1120px;margin:0 auto;color:var(--dsw-alias-label-primary,#e8ecf4);font-size:13px;line-height:1.6}",
      ".lc-j-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}",
      ".lc-j-title{font-size:20px;font-weight:650;letter-spacing:-.02em}",
      ".lc-j-sub{font-size:11px;color:var(--dsw-alias-label-tertiary,#71809a);margin-top:2px}",
      ".lc-j-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}",
      ".lc-j-select,.lc-j-input{height:30px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#2a3140);background:var(--dsw-alias-bg-layer-2,#171a20);color:var(--dsw-alias-label-primary,#e8ecf4);padding:0 9px;font:inherit;font-size:12px;outline:none}",
      ".lc-j-input{min-width:190px}",
      ".lc-j-btn{height:30px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#2a3140);background:rgba(255,255,255,.035);color:#aab6ca;padding:0 11px;font:inherit;font-size:11.5px;cursor:pointer}",
      ".lc-j-btn:hover{border-color:#5b7cff;color:#e8ecf4}",
      ".lc-j-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}",
      ".lc-j-stat{border:1px solid var(--dsw-alias-border-l2,#2a3140);border-radius:11px;background:var(--dsw-alias-bg-layer-2,#171a20);padding:11px 13px}",
      ".lc-j-stat b{display:block;font-size:21px;line-height:1.2;font-weight:650;color:#dce6ff}",
      ".lc-j-stat span{font-size:10.5px;color:#71809a}",
      ".lc-j-tabs{display:flex;gap:18px;border-bottom:1px solid var(--dsw-alias-border-l2,#2a3140)}",
      ".lc-j-tab{background:none;border:none;border-bottom:2px solid transparent;color:#8a94a6;padding:0 0 8px;font:inherit;font-size:12px;cursor:pointer}",
      ".lc-j-tab.active{color:#cfe0ff;border-bottom-color:#6f8dff}",
      ".lc-j-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:12px}",
      ".lc-j-card{border:1px solid var(--dsw-alias-border-l2,#2a3140);border-radius:12px;background:var(--dsw-alias-bg-layer-2,#171a20);padding:13px 14px}",
      ".lc-j-card h3{margin:0 0 9px;font-size:12px;font-weight:600;color:#cbd6e8}",
      ".lc-j-chars{display:flex;flex-wrap:wrap;gap:7px}",
      ".lc-j-char{display:flex;align-items:center;gap:6px;border:1px solid #2a3140;border-radius:999px;background:rgba(255,255,255,.025);padding:4px 9px;color:#c8d4e6;font-size:11.5px;cursor:pointer}",
      ".lc-j-char:hover{border-color:#5b7cff;color:#fff}",
      ".lc-j-char b{font-weight:600}.lc-j-char em{color:#71809a;font-style:normal;font-size:10px}",
      ".lc-j-rel{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.045)}",
      ".lc-j-rel:last-child{border-bottom:none}.lc-j-rel-name{flex:none;max-width:44%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c8d4e6}",
      ".lc-j-rel-bar{flex:1;height:5px;border-radius:3px;background:#222a36;overflow:hidden}",
      ".lc-j-rel-bar i{display:block;height:100%;background:linear-gradient(90deg,#4b6cff,#8fe3b0);border-radius:3px}",
      ".lc-j-rel em{font-style:normal;font-size:10px;color:#71809a;min-width:28px;text-align:right}",
      ".lc-j-events{display:flex;flex-direction:column;gap:8px}",
      ".lc-j-event{border:1px solid #2a3140;border-radius:10px;padding:9px 11px;background:rgba(255,255,255,.018);cursor:pointer}",
      ".lc-j-event:hover{border-color:#4b6cff;background:rgba(75,108,255,.055)}",
      ".lc-j-event-top{display:flex;justify-content:space-between;gap:10px;align-items:baseline}",
      ".lc-j-event-title{font-size:12px;color:#e2e9f5;font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".lc-j-event-time{font-size:9.5px;color:#647086;flex:none}",
      ".lc-j-event-sum{font-size:11px;color:#8d99ad;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
      ".lc-j-speakers{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}.lc-j-speaker{font-size:9.5px;color:#9fb6e8;background:rgba(75,108,255,.1);border-radius:999px;padding:1px 6px}",
      ".lc-j-lines{display:flex;flex-direction:column;gap:0}",
      ".lc-j-group{border-left:1px solid #2b3444;padding-left:14px;margin-left:3px;padding-bottom:10px}",
      ".lc-j-group-head{display:flex;align-items:center;gap:8px;padding:8px 0 5px;color:#9db7ff;font-size:11px}",
      ".lc-j-group-head b{font-weight:600;color:#cfe0ff}.lc-j-group-head time{color:#657286;font-size:9.5px}",
      ".lc-j-line{display:flex;gap:9px;padding:6px 8px;border-radius:7px}",
      ".lc-j-line:hover{background:rgba(255,255,255,.025)}",
      ".lc-j-line-speaker{flex:none;width:72px;text-align:right;font-size:11.5px;color:#e8c47a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".lc-j-line-main{min-width:0;flex:1}.lc-j-line-text{font-size:13px;color:#e1e8f3;white-space:pre-wrap;overflow-wrap:anywhere}",
      ".lc-j-line-meta{font-size:9px;color:#5f6a7b;margin-top:2px}",
      ".lc-j-choice{display:inline-block;margin:5px 5px 0 0;font-size:10.5px;color:#a9b8d6;border:1px solid #2c3647;border-radius:6px;padding:2px 7px}",
      ".lc-j-empty{color:#71809a;text-align:center;padding:40px 10px;font-size:12px}",
      ".lc-j-error{color:#f09aa6;font-size:12px}",
      ".lc-j-graph{width:100%;height:auto;min-height:250px;border:1px solid #242c39;border-radius:10px;background:radial-gradient(circle at 50% 42%,rgba(75,108,255,.12),rgba(10,13,19,.2) 62%);margin:2px 0 8px}",
      ".lc-j-node{cursor:pointer}.lc-j-node circle{transition:filter .15s,stroke .15s;stroke:#0d1119;stroke-width:2}.lc-j-node:hover circle{filter:brightness(1.2);stroke:#fff}.lc-j-node text{fill:#aebbd0;font-size:11px;font-family:inherit;pointer-events:none}",
      ".lc-j-timeline{position:relative;display:flex;flex-direction:column;gap:2px;margin-top:2px}",
      ".lc-j-tl-item{display:flex;gap:10px;align-items:stretch}.lc-j-tl-rail{position:relative;width:14px;flex:none}.lc-j-tl-rail:before{content:\"\";position:absolute;left:6px;top:0;bottom:0;width:1px;background:#2b3444}.lc-j-tl-dot{position:absolute;left:2px;top:15px;width:9px;height:9px;border-radius:50%;background:#4b6cff;box-shadow:0 0 0 4px rgba(75,108,255,.12)}.lc-j-tl-item:last-child .lc-j-tl-rail:before{bottom:auto;height:22px}",
      ".lc-j-tl-item .lc-j-event{flex:1;margin:4px 0}.lc-j-tl-item:last-child .lc-j-tl-dot{background:#8fe3b0;box-shadow:0 0 0 4px rgba(78,216,154,.1)}",
      ".lc-j-avatar{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:7px;font-size:11px;font-weight:650;color:#10151d;flex:none}",
      ".lc-j-line-speaker{width:96px;display:flex;align-items:center;justify-content:flex-end;gap:6px;padding-top:1px}.lc-j-line-name{max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px;color:#e8c47a}",
      ".lc-j-line-meta{display:flex;align-items:center;gap:9px}.lc-j-copy{margin-left:auto;opacity:0;border:1px solid #2b3444;background:transparent;color:#7f8b9f;border-radius:5px;padding:1px 5px;font:inherit;font-size:9.5px;cursor:pointer;transition:opacity .15s}.lc-j-line:hover .lc-j-copy{opacity:1}.lc-j-copy:hover{color:#dce6ff;border-color:#5b7cff}",
      ".lc-j-mark{background:rgba(232,196,122,.28);color:#ffe4a8;border-radius:3px;padding:0 1px}",
      ".lc-j-shot-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}",
      ".lc-j-shot{border:1px solid #2a3444;border-radius:11px;background:#151c27;overflow:hidden;position:relative;min-width:0}",
      ".lc-j-shot-img{display:block;width:100%;aspect-ratio:16/9;border:none;background:#0e131c;padding:0;cursor:zoom-in;overflow:hidden}",
      ".lc-j-shot-img img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .2s}.lc-j-shot-img:hover img{transform:scale(1.035)}",
      ".lc-j-shot-placeholder{display:flex;height:100%;align-items:center;justify-content:center;color:#5f6d82;font-size:11px}",
      ".lc-j-shot-meta{padding:8px 9px 9px;display:flex;flex-direction:column;gap:3px}.lc-j-shot-meta b{font-size:11.5px;color:#dce6f7;font-weight:600}.lc-j-shot-meta span{font-size:9.5px;color:#6f7c90}.lc-j-shot-meta p{margin:0;font-size:11px;color:#98a6ba;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".lc-j-shot-del{position:absolute;top:6px;right:6px;opacity:0;border:1px solid rgba(240,90,106,.45);border-radius:6px;background:rgba(25,12,16,.86);color:#f09aa6;font:inherit;font-size:9.5px;padding:2px 6px;cursor:pointer}.lc-j-shot:hover .lc-j-shot-del{opacity:1}",
      ".lc-j-modal{position:fixed;inset:0;z-index:1400;background:rgba(5,8,13,.82);backdrop-filter:blur(4px);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px;cursor:zoom-out;gap:12px}",
      ".lc-j-modal img{max-width:min(92vw,1400px);max-height:78vh;object-fit:contain;border-radius:10px;box-shadow:0 24px 80px rgba(0,0,0,.6)}",
      ".lc-j-modal-bar{max-width:min(92vw,1400px);display:flex;align-items:center;gap:10px;color:#dce6f7;font-size:11px;cursor:default}.lc-j-modal-bar span{color:#8b99ad;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:50vw}.lc-j-modal-bar .lc-j-btn{margin-left:4px}",
      ".lc-j-curated{max-width:900px;margin:0 auto;padding:8px 4px 30px}",
      ".lc-j-curated-eyebrow{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#6f8dff;margin-bottom:6px}",
      ".lc-j-curated-title{font-size:24px;line-height:1.35;margin:0 0 4px;color:#eef3ff;font-weight:650;letter-spacing:-.02em}",
      ".lc-j-curated-sub{font-size:12px;color:#8a99b0;margin-bottom:10px}",
      ".lc-j-curated-summary{border-left:2px solid #4b6cff;background:rgba(75,108,255,.07);border-radius:0 8px 8px 0;padding:10px 14px;color:#b9c7dc;font-size:12.5px;line-height:1.7;margin:10px 0 14px}",
      ".lc-j-curated-chars{margin-bottom:16px}",
      ".lc-j-curated-scene{border-top:1px solid #242e3d;padding:18px 0 4px}",
      ".lc-j-curated-scene-head{display:flex;align-items:baseline;gap:10px;margin-bottom:4px}.lc-j-curated-index{font-size:10px;color:#4b6cff;font-variant-numeric:tabular-nums}.lc-j-curated-scene h3{font-size:15px;margin:0;color:#dce6f7;font-weight:600}",
      ".lc-j-curated-scene-sum{font-size:11.5px;color:#7f8ca1;margin:2px 0 8px 24px}",
      ".lc-j-curated-line{display:grid;grid-template-columns:120px minmax(0,1fr);gap:12px;padding:6px 0;align-items:start}",
      ".lc-j-curated-speaker{display:flex;align-items:center;justify-content:flex-end;gap:6px;text-align:right}.lc-j-curated-speaker b{font-size:11px;color:#b7c4d8;font-weight:600;max-width:74px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".lc-j-curated-text{font-size:13.5px;line-height:1.8;color:#e2e9f5;white-space:pre-wrap}",
      ".lc-j-curated-title-tag{grid-column:2;font-size:9.5px;color:#6f7c90}",
      "@media (max-width:760px){.lc-j-curated-line{grid-template-columns:86px minmax(0,1fr);gap:8px}.lc-j-curated-speaker b{max-width:52px}.lc-j-curated-title{font-size:20px}}",
      ".lc-j-synopsis{max-width:900px;margin:0 auto;padding:8px 4px 30px}",
      ".lc-j-synopsis-overview{border-left:2px solid #e8c47a;background:rgba(232,196,122,.06);border-radius:0 8px 8px 0;padding:12px 15px;color:#c6d2e4;font-size:13px;line-height:1.8;margin:10px 0 18px}",
      ".lc-j-arc{border-top:1px solid #242e3d;padding:16px 0 4px}",
      ".lc-j-arc-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.lc-j-arc-head h3{font-size:15px;margin:0;color:#e2eaf7;font-weight:600}.lc-j-arc-range{font-size:9.5px;color:#66758b;margin-left:auto}",
      ".lc-j-arc-summary{font-size:12px;line-height:1.75;color:#9dabc0;margin:6px 0 4px 24px}",
      ".lc-j-arc-beats{margin:4px 0 6px 38px;padding:0;color:#c9d5e6;font-size:12px;line-height:1.7}.lc-j-arc-beats li{margin:2px 0}",
      ".lc-j-arc-chars{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 2px 24px}",
      ".lc-j-unresolved{margin-top:18px;border:1px solid #3a2f20;background:#1c1710;border-radius:9px;padding:10px 14px;color:#bfae8c;font-size:11.5px;line-height:1.7}.lc-j-unresolved b{color:#e8c47a}.lc-j-unresolved ul{margin:5px 0 0 18px;padding:0}",
      "@media (max-width:760px){.lc-j-shot-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}",
      "@media (max-width:760px){.lc-j-stats{grid-template-columns:repeat(2,1fr)}.lc-j-grid{grid-template-columns:1fr}.lc-j-line-speaker{width:64px}.lc-j-line-name{max-width:40px}}",
      `
      .lc-journal{gap:18px;padding:20px 24px 38px;max-width:1180px;background:radial-gradient(ellipse at 18% -8%,rgba(86,116,255,.10),transparent 42%),radial-gradient(ellipse at 96% 4%,rgba(232,196,122,.055),transparent 34%)}
      .lc-j-hero{position:relative;overflow:hidden;border:1px solid rgba(94,122,180,.24);border-radius:18px;background:linear-gradient(135deg,rgba(38,52,88,.78),rgba(15,20,30,.92) 55%,rgba(40,34,26,.72));box-shadow:0 18px 50px rgba(0,0,0,.24),inset 0 1px rgba(255,255,255,.05);padding:20px 22px 14px}
      .lc-j-hero:before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(139,165,255,.7),rgba(232,196,122,.55),transparent)}
      .lc-j-hero-glow{position:absolute;width:280px;height:280px;right:-90px;top:-150px;border-radius:50%;background:radial-gradient(circle,rgba(111,141,255,.20),transparent 68%);pointer-events:none}
      .lc-j-hero-top{position:relative;display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap}
      .lc-j-ident{display:flex;align-items:center;gap:12px;min-width:240px}
      .lc-j-seal{width:46px;height:46px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:14px;background:linear-gradient(145deg,#7896ff,#3b56c8 60%,#9a7a45);color:#0b1019;font-size:22px;font-weight:750;box-shadow:0 8px 22px rgba(69,96,220,.28),inset 0 1px rgba(255,255,255,.35)}
      .lc-j-kicker{font-size:9px;letter-spacing:.16em;color:#8194bd;text-transform:uppercase;margin-bottom:3px}
      .lc-j-title{font-size:25px;line-height:1.15;font-weight:680;letter-spacing:-.035em;color:#f4f7ff}
      .lc-j-sub{font-size:10.5px;color:#8390a6;margin-top:3px;letter-spacing:.01em}
      .lc-j-hero-meta{position:relative;display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.055)}
      .lc-j-pill{display:inline-flex;align-items:center;height:22px;padding:0 8px;border:1px solid rgba(131,151,190,.20);border-radius:999px;background:rgba(255,255,255,.035);color:#a8b6cb;font-size:9.5px;white-space:nowrap;letter-spacing:.01em}
      .lc-j-pill-gold{border-color:rgba(232,196,122,.32);background:rgba(232,196,122,.08);color:#e8c47a}
      .lc-j-pill-dim{color:#6f7c91;border-color:rgba(120,137,163,.14)}
      .lc-j-pill-live{color:#8fe3b0;border-color:rgba(78,216,154,.22);background:rgba(78,216,154,.055)}
      .lc-j-pill-live:before{content:"";width:4px;height:4px;border-radius:50%;background:#8fe3b0;margin-right:5px;box-shadow:0 0 8px rgba(143,227,176,.7)}
      .lc-j-tools{gap:7px;align-items:center;justify-content:flex-end}
      .lc-j-select,.lc-j-input{height:32px;border-radius:9px;border:1px solid rgba(119,139,173,.24);background:rgba(9,13,21,.48);color:#cbd7ea;padding:0 9px;font-size:11px;transition:border-color .15s,background .15s}
      .lc-j-select:hover,.lc-j-input:hover{border-color:rgba(111,141,255,.5);background:rgba(18,25,38,.7)}
      .lc-j-select:focus,.lc-j-input:focus{border-color:#6f8dff;box-shadow:0 0 0 3px rgba(111,141,255,.12)}
      .lc-j-btn{height:32px;border-radius:9px;border:1px solid rgba(119,139,173,.22);background:rgba(255,255,255,.035);color:#b8c5d9;padding:0 11px;font-size:11px;transition:border-color .15s,background .15s,color .15s}
      .lc-j-btn:hover{border-color:rgba(111,141,255,.6);background:rgba(111,141,255,.10);color:#f0f4ff}
      .lc-j-btn-quiet{color:#7e8ca2;background:transparent;border-color:transparent}
      .lc-j-btn-quiet:hover{border-color:rgba(119,139,173,.25);background:rgba(255,255,255,.04)}
      .lc-j-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
      .lc-j-stat{position:relative;overflow:hidden;border:1px solid rgba(119,139,173,.18);border-radius:13px;background:linear-gradient(145deg,rgba(27,36,53,.75),rgba(15,20,29,.8));padding:12px 14px;box-shadow:inset 0 1px rgba(255,255,255,.035)}
      .lc-j-stat:after{content:"";position:absolute;left:12px;bottom:0;width:30px;height:1px;background:linear-gradient(90deg,#6f8dff,transparent)}
      .lc-j-stat i{position:absolute;right:9px;top:7px;font-style:normal;font-size:17px;color:rgba(139,165,255,.16);line-height:1}
      .lc-j-stat b{display:block;font-size:23px;color:#e8eeff;letter-spacing:-.03em}
      .lc-j-stat span{display:block;font-size:10px;color:#7f8ea4;letter-spacing:.04em}
      .lc-j-stat-gold:after{background:linear-gradient(90deg,#e8c47a,transparent)}.lc-j-stat-gold i{color:rgba(232,196,122,.18)}.lc-j-stat-gold b{color:#f3dfb2}
      .lc-j-stat-mint:after{background:linear-gradient(90deg,#8fe3b0,transparent)}.lc-j-stat-mint i{color:rgba(143,227,176,.16)}.lc-j-stat-mint b{color:#c7f4db}
      .lc-j-stat-dim i{color:rgba(160,174,196,.12)}
      .lc-j-tabs{position:sticky;top:0;z-index:30;display:flex;gap:4px;padding:5px;border:1px solid rgba(119,139,173,.16);border-radius:12px;background:rgba(12,17,26,.84);backdrop-filter:blur(14px);box-shadow:0 8px 22px rgba(0,0,0,.18)}
      .lc-j-tab{display:inline-flex;align-items:center;gap:6px;border:none;border-radius:8px;padding:7px 11px;color:#76859b;font-size:11px;transition:background .15s,color .15s,box-shadow .15s;white-space:nowrap}
      .lc-j-tab:hover{color:#cbd7ea;background:rgba(255,255,255,.045)}
      .lc-j-tab.active{color:#eaf0ff;background:linear-gradient(135deg,rgba(91,124,255,.30),rgba(71,91,150,.22));box-shadow:inset 0 0 0 1px rgba(126,153,255,.32),0 4px 14px rgba(45,68,160,.18)}
      .lc-j-tab-icon{font-size:12px;color:#7f9cff;opacity:.9}
      .lc-j-tab.active .lc-j-tab-icon{color:#dce6ff}
      .lc-j-tab-count{min-width:15px;height:15px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:rgba(255,255,255,.09);color:#aebbd0;font-size:8.5px;padding:0 4px}
      .lc-j-reading{max-width:920px}
      .lc-j-syn-hero{position:relative;overflow:hidden;border:1px solid rgba(119,139,173,.20);border-radius:17px;background:linear-gradient(150deg,rgba(34,44,68,.72),rgba(16,21,31,.86));padding:20px 22px 18px;box-shadow:0 14px 36px rgba(0,0,0,.16)}
      .lc-j-syn-hero:before{content:"";position:absolute;left:0;top:0;width:3px;height:100%;background:linear-gradient(180deg,#e8c47a,#6f8dff,transparent)}
      .lc-j-syn-kicker{font-size:9px;letter-spacing:.17em;color:#8fa4c8;margin-bottom:6px}
      .lc-j-syn-title{font-size:28px;line-height:1.25;letter-spacing:-.035em;color:#f4f7ff;margin:0 0 9px;font-weight:680}
      .lc-j-syn-meta{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
      .lc-j-syn-overview{color:#c3cfe1;font-size:13px;line-height:1.85;padding:12px 14px;border-left:2px solid rgba(232,196,122,.75);background:linear-gradient(90deg,rgba(232,196,122,.06),transparent);border-radius:0 9px 9px 0}
      .lc-j-toc{margin-top:15px;padding-top:12px;border-top:1px solid rgba(255,255,255,.06);display:flex;flex-wrap:wrap;gap:5px}
      .lc-j-toc-label{width:100%;font-size:9px;letter-spacing:.12em;color:#718097;margin-bottom:1px}
      .lc-j-toc-item{display:inline-flex;align-items:center;gap:5px;border:1px solid rgba(119,139,173,.16);border-radius:7px;background:rgba(255,255,255,.02);color:#94a5bd;padding:4px 7px;font:inherit;font-size:9.5px;cursor:pointer;max-width:100%}
      .lc-j-toc-item:hover{border-color:rgba(111,141,255,.45);color:#dbe5f7;background:rgba(111,141,255,.07)}
      .lc-j-toc-item span{font-size:8px;color:#6f8dff;font-variant-numeric:tabular-nums}.lc-j-toc-item b{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .lc-j-arc-list{position:relative;margin-top:20px}
      .lc-j-arc-list:before{content:"";position:absolute;left:25px;top:8px;bottom:18px;width:1px;background:linear-gradient(180deg,rgba(111,141,255,.45),rgba(111,141,255,.10))}
      .lc-j-arc{position:relative;display:grid;grid-template-columns:52px minmax(0,1fr);gap:14px;padding:0 0 18px;border-top:none;animation:lc-rise .45s ease both}
      .lc-j-arc-node{position:relative;z-index:1;width:35px;height:35px;margin:2px 0 0 9px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:1px solid rgba(111,141,255,.35);background:#121a2a;color:#a9bcff;font-size:9.5px;font-variant-numeric:tabular-nums;box-shadow:0 0 0 5px rgba(111,141,255,.055)}
      .lc-j-arc-body{border:1px solid rgba(119,139,173,.16);border-radius:13px;background:linear-gradient(145deg,rgba(25,33,48,.66),rgba(15,20,29,.74));padding:13px 15px 12px;transition:border-color .18s,background .18s,transform .18s}
      .lc-j-arc-body:hover{border-color:rgba(111,141,255,.35);background:linear-gradient(145deg,rgba(31,41,61,.76),rgba(16,22,33,.82));transform:translateY(-1px)}
      .lc-j-arc-head{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}
      .lc-j-arc-eyebrow{font-size:8px;letter-spacing:.13em;color:#6684d8}
      .lc-j-arc-head h3{font-size:15.5px;margin:0;color:#e4ebf8;font-weight:620;letter-spacing:-.01em}
      .lc-j-arc-range{font-size:9px;color:#69788e;margin-left:auto;font-variant-numeric:tabular-nums}
      .lc-j-arc-summary{font-size:12.5px;line-height:1.8;color:#a4b2c6;margin:7px 0 3px}
      .lc-j-arc-beats{margin:5px 0 3px;padding:0;list-style:none;color:#c4d0e1;font-size:11.5px;line-height:1.7}
      .lc-j-arc-beats li{position:relative;padding-left:12px}.lc-j-arc-beats li:before{content:"";position:absolute;left:1px;top:.72em;width:4px;height:4px;border-radius:50%;background:#6f8dff;opacity:.65}
      .lc-j-arc-chars{display:flex;flex-wrap:wrap;gap:4px;margin:7px 0 0}
      .lc-j-unresolved{margin:2px 0 0 66px;border:1px solid rgba(184,146,79,.24);background:linear-gradient(145deg,rgba(60,45,24,.44),rgba(25,21,15,.55));border-radius:12px;padding:11px 14px;color:#bfae8c;font-size:11px;line-height:1.75;box-shadow:inset 0 1px rgba(255,255,255,.025)}
      .lc-j-unresolved b{color:#e8c47a;font-size:10px;letter-spacing:.08em}.lc-j-unresolved ul{margin:5px 0 0 16px;padding:0}
      .lc-j-empty{border:1px dashed rgba(119,139,173,.2);border-radius:13px;background:rgba(255,255,255,.018);color:#71809a;text-align:center;padding:36px 12px;font-size:11.5px}
      .lc-j-event{transition:border-color .18s,background .18s,transform .18s}.lc-j-j-event:hover{transform:translateY(-1px)}
      .lc-j-shot{border-color:rgba(119,139,173,.18);border-radius:13px;background:linear-gradient(145deg,rgba(24,32,46,.78),rgba(14,19,28,.86));box-shadow:0 8px 22px rgba(0,0,0,.12)}
      .lc-j-shot-img{border-radius:12px 12px 0 0;background:#0b1018}.lc-j-shot:hover .lc-j-shot-del{opacity:1}
      .lc-j-shot:after{content:"";position:absolute;inset:0 0 auto;height:48%;background:linear-gradient(180deg,transparent,rgba(8,11,17,.30));pointer-events:none}
      .lc-j-modal{background:rgba(4,7,12,.9);backdrop-filter:blur(10px)}
      .lc-j-modal img{animation:lc-zoom .22s ease both;box-shadow:0 30px 100px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.08)}
      .lc-j-card{border-color:rgba(119,139,173,.18);background:linear-gradient(145deg,rgba(25,33,48,.7),rgba(15,20,29,.8));box-shadow:inset 0 1px rgba(255,255,255,.035)}
      .lc-j-journal .lc-j-btn:focus-visible,.lc-journal .lc-j-tab:focus-visible,.lc-journal .lc-j-toc-item:focus-visible{outline:2px solid #8fa9ff;outline-offset:2px}
      @keyframes lc-rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
      @keyframes lc-zoom{from{opacity:0;transform:scale(.985)}to{opacity:1;transform:none}}
      @media (max-width:820px){.lc-j-hero{padding:16px 16px 12px}.lc-j-title{font-size:22px}.lc-j-tools{justify-content:flex-start}.lc-j-syn-title{font-size:23px}.lc-j-arc{grid-template-columns:42px minmax(0,1fr);gap:9px}.lc-j-arc-node{width:29px;height:29px;margin-left:6px;font-size:8.5px}.lc-j-arc-list:before{left:20px}.lc-j-unresolved{margin-left:51px}.lc-j-tabs{overflow-x:auto}}
      @media (max-width:640px){.lc-journal{padding:14px 13px 28px}.lc-j-ident{gap:9px}.lc-j-seal{width:38px;height:38px;border-radius:11px;font-size:18px}.lc-j-title{font-size:20px}.lc-j-sub{font-size:9.5px}.lc-j-syn-hero{padding:16px 14px}.lc-j-syn-title{font-size:20px}.lc-j-syn-overview{font-size:12px;padding:10px 11px}.lc-j-arc{grid-template-columns:1fr}.lc-j-arc-node{display:none}.lc-j-arc-list:before{display:none}.lc-j-unresolved{margin-left:0}.lc-j-arc-range{margin-left:0;width:100%}}
      @media (prefers-reduced-motion:reduce){.lc-j-arc{animation:none}.lc-j-modal img{animation:none}.lc-j-arc-body:hover{transform:none}}
      `,
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
    var journalCodec = {
      mode: "strict",
      typeSymbol: "dsh-lore-companion#JournalSnapshot",
      schema: { parse: function (value) { return value; } },
      create: function () { return { parse: function (value) { return value; } }; }
    };
    var journalRemote = {
      package: "dsh-lore-companion",
      descriptors: [{
        id: "dsh-lore-companion#loreJournal/execute",
        service: "loreJournal",
        namespace: "loreJournal",
        method: "execute",
        invocation: { kind: "direct" },
        parameters: [{ name: "command", wire: "command", source: "json", codec: watchCommandCodec }],
        result: journalCodec
      }]
    };

    function fmtClock(value) {
      try {
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
      } catch (error) { return ""; }
    }

    function fmtDay(value) {
      try {
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
      } catch (error) { return ""; }
    }

    function speakerColor(name) {
      var hash = 0;
      var text = String(name || "旁白");
      for (var index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) % 360;
      return "hsl(" + hash + ", 58%, 62%)";
    }

    function highlightText(text, needle) {
      var source = String(text || "");
      if (!needle) return source;
      var lower = source.toLowerCase();
      var target = String(needle).toLowerCase();
      if (!target) return source;
      var parts = [];
      var cursor = 0;
      var found = lower.indexOf(target);
      while (found >= 0) {
        if (found > cursor) parts.push(source.slice(cursor, found));
        parts.push(h("mark", { className: "lc-j-mark", key: "m" + parts.length }, source.slice(found, found + target.length)));
        cursor = found + target.length;
        found = lower.indexOf(target, cursor);
      }
      if (cursor < source.length) parts.push(source.slice(cursor));
      return parts;
    }

    function downloadText(filename, text, mime) {
      try {
        var blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      } catch (error) { /* export is best effort */ }
    }

    function journalMarkdown(snapshot, gameLabel) {
      var label = gameLabel[snapshot.game] || snapshot.game;
      var lines = ["# 旅途记录 · " + label, "", "场次：" + (snapshot.session || "全部") + " · 导出 " + new Date().toLocaleString("zh-CN"), "", "## 人物", ""];
      snapshot.characters.forEach(function (person) {
        lines.push("- " + person.name + (person.title ? "（" + person.title + "）" : "") + "：" + person.lines + " 行");
      });
      lines.push("", "## 人物关系", "");
      snapshot.relationships.forEach(function (item) { lines.push("- " + item.a + " × " + item.b + "：" + item.events + " 场"); });
      lines.push("", "## 事件", "");
      snapshot.events.forEach(function (event) {
        lines.push("### " + event.title, "", fmtDay(event.startTs) + " " + fmtClock(event.startTs) + " · " + event.speakers.join("、"), "", event.summary || "", "");
        event.entries.forEach(function (line) { lines.push("- " + (line.speaker || "旁白") + "：" + line.text); });
        lines.push("");
      });
      return lines.join("\n");
    }

    function JournalView(props) {
      var execute = props.execute;
      var invoke = function (command) {
        return Promise.resolve(execute(command)).then(function (result) {
          if (result && typeof result === "object" && result.ok === false) {
            throw new Error(result.error && (result.error.message || result.error.code) || "journal remote failed");
          }
          return result && typeof result === "object" && Object.prototype.hasOwnProperty.call(result, "value") ? result.value : result;
        });
      };
      var gameHook = react.useState("genshin");
      var game = gameHook[0];
      var setGame = gameHook[1];
      var snapHook = react.useState(null);
      var snapshot = snapHook[0];
      var setSnapshot = snapHook[1];
      var stateHook = react.useState({ loading: true, error: null });
      var viewState = stateHook[0];
      var setViewState = stateHook[1];
      var tabHook = react.useState("overview");
      var tab = tabHook[0];
      var setTab = tabHook[1];
      var queryHook = react.useState("");
      var query = queryHook[0];
      var setQuery = queryHook[1];
      var eventHook = react.useState("");
      var activeEvent = eventHook[0];
      var setActiveEvent = eventHook[1];
      var shotHook = react.useState(null);
      var openShotData = shotHook[0];
      var setOpenShotData = shotHook[1];
      var limitHook = react.useState(300);
      var limit = limitHook[0];
      var setLimit = limitHook[1];

      var load = function (nextGame, nextSession, nextLimit) {
        var wanted = Number(nextLimit) || limit || 300;
        setViewState({ loading: true, error: null });
        invoke({ action: "journal", game: nextGame, session: nextSession || "", limit: wanted }).then(function (result) {
          setSnapshot(result);
          setViewState({ loading: false, error: null });
          setTab(function (previous) { return previous === "overview" && result.synopsis ? "synopsis" : previous === "overview" && result.curated ? "curated" : previous; });
        }).catch(function (error) {
          setViewState({ loading: false, error: String(error && error.message || error) });
        });
      };

      var openShot = function (id) {
        invoke({ action: "screenshot", id: id }).then(function (result) {
          setOpenShotData(result);
        }).catch(function (error) {
          setViewState(function (previous) { return Object.assign({}, previous, { error: String(error && error.message || error) }); });
        });
      };
      var deleteShot = function (id) {
        if (typeof window !== "undefined" && !window.confirm("删除这张截图？")) return;
        invoke({ action: "delete-screenshot", id: id }).then(function () {
          setOpenShotData(null);
          load(game, snapshot ? snapshot.session : "", limit);
        }).catch(function (error) {
          setViewState(function (previous) { return Object.assign({}, previous, { error: String(error && error.message || error) }); });
        });
      };

      react.useEffect(function () {
        load("genshin", "", 300);
      }, []);

      var gameLabel = { genshin: "原神", hsr: "星穹铁道" };
      var gameSelect = h("select", {
        className: "lc-j-select",
        value: game,
        onChange: function (event) {
          var value = event.target.value;
          setGame(value);
          setActiveEvent("");
          setQuery("");
          load(value, "", limit);
        }
      }, ["genshin", "hsr"].map(function (id) {
        return h("option", { value: id, key: id }, gameLabel[id]);
      }));

      var sessionSelect = h("select", {
        className: "lc-j-select",
        value: snapshot ? snapshot.session : "",
        onChange: function (event) { load(game, event.target.value, limit); }
      }, ((snapshot && snapshot.sessions) || []).map(function (item) {
        return h("option", { value: item.session, key: item.session }, item.session + " · " + item.entries + " 句");
      }));

      var limitSelect = h("select", {
        className: "lc-j-select",
        value: String(limit),
        title: "显示的最近对话行数",
        onChange: function (event) { var value = Number(event.target.value) || 300; setLimit(value); setTab(snapshot && snapshot.synopsis ? "synopsis" : snapshot && snapshot.curated ? "curated" : "overview"); load(game, snapshot ? snapshot.session : "", value); }
      }, [300, 600, 1200].map(function (value) { return h("option", { value: String(value), key: value }, "最近 " + value + " 行"); }));
      var resetJournal = function () {
        setQuery("");
        setActiveEvent("");
        setOpenShotData(null);
        setLimit(300);
        setTab(snapshot && snapshot.synopsis ? "synopsis" : snapshot && snapshot.curated ? "curated" : "overview");
        load(game, "", 300);
        try { window.scrollTo(0, 0); } catch (error) { /* ignore */ }
      };
      var heroSession = snapshot ? (snapshot.session || "latest") : "读取中";
      var heroFirst = snapshot && snapshot.entries && snapshot.entries.length ? snapshot.entries[0].ts : null;
      var heroLast = snapshot && snapshot.entries && snapshot.entries.length ? snapshot.entries[snapshot.entries.length - 1].ts : null;
      var header = h("div", { className: "lc-j-hero" },
        h("div", { className: "lc-j-hero-glow" }),
        h("div", { className: "lc-j-hero-top" },
          h("div", { className: "lc-j-ident" },
            h("div", { className: "lc-j-seal" }, "旅"),
            h("div", null,
              h("div", { className: "lc-j-kicker" }, "LORE COMPANION / LOCAL OCR"),
              h("div", { className: "lc-j-title" }, "旅途记录"),
              h("div", { className: "lc-j-sub" }, "只读存档 · 事件自动分段 · 本地识别")
            )
          ),
          h("div", { className: "lc-j-tools" }, gameSelect, sessionSelect, limitSelect,
            h("button", { className: "lc-j-btn", type: "button", onClick: function () { load(game, snapshot ? snapshot.session : "", limit); } }, "刷新"),
            h("button", { className: "lc-j-btn lc-j-btn-quiet", type: "button", onClick: resetJournal }, "重置"),
            snapshot ? h("button", { className: "lc-j-btn lc-j-btn-quiet", type: "button", title: "导出 Markdown", onClick: function () { downloadText("旅途记录-" + (snapshot.session || snapshot.game) + ".md", journalMarkdown(snapshot, gameLabel), "text/markdown;charset=utf-8"); } }, "MD") : null,
            snapshot ? h("button", { className: "lc-j-btn lc-j-btn-quiet", type: "button", title: "导出 JSON", onClick: function () { downloadText("旅途记录-" + (snapshot.session || snapshot.game) + ".json", JSON.stringify(snapshot, null, 2), "application/json;charset=utf-8"); } }, "JSON") : null
          )
        ),
        h("div", { className: "lc-j-hero-meta" },
          h("span", { className: "lc-j-pill lc-j-pill-gold" }, gameLabel[game] || "原神"),
          h("span", { className: "lc-j-pill" }, heroSession),
          snapshot ? h("span", { className: "lc-j-pill" }, (snapshot.entries || []).length + " 行") : null,
          heroFirst ? h("span", { className: "lc-j-pill lc-j-pill-dim" }, fmtDay(heroFirst) + " " + fmtClock(heroFirst) + " → " + fmtClock(heroLast)) : null,
          h("span", { className: "lc-j-pill lc-j-pill-live" }, "本地 · 只读")
        )
      );

      if (viewState.loading && !snapshot) {
        return h("div", { className: "lc-journal" }, header, h("div", { className: "lc-j-empty" }, "正在读取本地记录…"));
      }
      if (viewState.error) {
        return h("div", { className: "lc-journal" }, header, h("div", { className: "lc-j-error" }, "读取失败：" + viewState.error));
      }

      var stats = snapshot.stats || { lines: 0, characters: 0, events: 0, sessions: 0 };
      var statsRow = h("div", { className: "lc-j-stats" },
        h("div", { className: "lc-j-stat lc-j-stat-blue" }, h("i", null, "◈"), h("b", null, String(stats.lines)), h("span", null, "对话行")),
        h("div", { className: "lc-j-stat lc-j-stat-gold" }, h("i", null, "◎"), h("b", null, String(stats.characters)), h("span", null, "出场人物")),
        h("div", { className: "lc-j-stat lc-j-stat-mint" }, h("i", null, "◇"), h("b", null, String(stats.events)), h("span", null, "事件段")),
        h("div", { className: "lc-j-stat lc-j-stat-dim" }, h("i", null, "▤"), h("b", null, String(stats.sessions)), h("span", null, "记录场次"))
      );

      var shotCount = (snapshot.screenshots || []).length;
      var tabButton = function (key, label, icon, count) {
        return h("button", {
          className: "lc-j-tab" + (tab === key ? " active" : ""),
          type: "button",
          role: "tab",
          "aria-selected": tab === key ? "true" : "false",
          onClick: function () { setTab(key); }
        },
          h("span", { className: "lc-j-tab-icon", "aria-hidden": "true" }, icon),
          h("span", null, label),
          count ? h("span", { className: "lc-j-tab-count" }, String(count)) : null
        );
      };
      var tabs = h("div", { className: "lc-j-tabs", role: "tablist", "aria-label": "旅途视图" },
        snapshot.synopsis ? tabButton("synopsis", "剧情梗概", "◇") : null,
        snapshot.curated ? tabButton("curated", "整理稿", "✦") : null,
        tabButton("overview", "人物与事件", "◎"),
        tabButton("dialogue", "详细对话", "≡"),
        tabButton("screenshots", "截图", "▧", shotCount || null)
      );

      if (!snapshot.entries.length) {
        return h("div", { className: "lc-journal" }, header, statsRow, tabs,
          h("div", { className: "lc-j-empty" }, "这个场次还没有对话记录。点主界面的「开始记录」，切到原神对话后再回来刷新。")
        );
      }

      var charCards = h("div", { className: "lc-j-chars" }, snapshot.characters.map(function (person) {
        return h("button", {
          className: "lc-j-char",
          type: "button",
          key: person.name,
          title: person.title || person.name,
          onClick: function () { setQuery(person.name); setActiveEvent(""); setTab("dialogue"); }
        }, h("b", null, person.name), h("em", null, String(person.lines)));
      }));

      var maxRel = snapshot.relationships.reduce(function (max, item) { return Math.max(max, item.events); }, 1);
      var relations = snapshot.relationships.length
        ? h("div", null, snapshot.relationships.slice(0, 10).map(function (item) {
            return h("div", { className: "lc-j-rel", key: item.a + item.b },
              h("span", { className: "lc-j-rel-name" }, item.a + " × " + item.b),
              h("span", { className: "lc-j-rel-bar" }, h("i", { style: { width: Math.max(5, Math.round(item.events / maxRel * 100)) + "%" } })),
              h("em", null, item.events + " 场")
            );
          }))
        : h("div", { className: "lc-j-empty" }, "还没有多角色同场事件。");

      var graphPeople = snapshot.characters.slice(0, 10);
      var graphNodes = graphPeople.map(function (person, index) {
        var total = Math.max(1, graphPeople.length);
        var angle = -Math.PI / 2 + (index * Math.PI * 2 / total);
        var radius = 104;
        return {
          person: person,
          x: 310 + Math.cos(angle) * radius,
          y: 152 + Math.sin(angle) * radius,
          r: 15 + Math.min(10, Math.sqrt(person.lines || 1) * 2)
        };
      });
      var nodeByName = {};
      graphNodes.forEach(function (node) { nodeByName[node.person.name] = node; });
      var graphEdges = snapshot.relationships.filter(function (item) {
        return nodeByName[item.a] && nodeByName[item.b];
      });
      var graph = graphPeople.length ? h("svg", {
        className: "lc-j-graph",
        viewBox: "0 0 620 304",
        role: "img",
        "aria-label": "人物关系图谱"
      },
        graphEdges.map(function (item) {
          var left = nodeByName[item.a];
          var right = nodeByName[item.b];
          return h("line", {
            key: "edge-" + item.a + item.b,
            x1: left.x, y1: left.y, x2: right.x, y2: right.y,
            stroke: "#6f8dff",
            strokeWidth: 1 + Math.min(4, item.events * 0.8),
            opacity: Math.max(0.16, Math.min(0.62, 0.12 + item.events * 0.12))
          });
        }),
        graphNodes.map(function (node) {
          var name = node.person.name;
          return h("g", {
            className: "lc-j-node",
            key: "node-" + name,
            onClick: function () { setQuery(name); setActiveEvent(""); setTab("dialogue"); }
          },
            h("title", null, name + " · " + node.person.lines + " 行"),
            h("circle", { cx: node.x, cy: node.y, r: node.r, fill: speakerColor(name) }),
            h("text", { x: node.x, y: node.y + node.r + 15, textAnchor: "middle" }, name.length > 6 ? name.slice(0, 6) + "…" : name)
          );
        })
      ) : h("div", { className: "lc-j-empty" }, "还没有足够的人物数据。");

      var eventCards = h("div", { className: "lc-j-timeline" }, snapshot.events.map(function (event) {
        return h("div", { className: "lc-j-tl-item", key: event.id },
          h("div", { className: "lc-j-tl-rail" }, h("span", { className: "lc-j-tl-dot" })),
          h("div", {
            className: "lc-j-event",
            onClick: function () { setActiveEvent(event.id); setQuery(""); setTab("dialogue"); }
          },
            h("div", { className: "lc-j-event-top" },
              h("div", { className: "lc-j-event-title" }, event.title),
              h("div", { className: "lc-j-event-time" }, fmtDay(event.startTs) + " " + fmtClock(event.startTs))
            ),
            h("div", { className: "lc-j-event-sum" }, event.summary || "（无正文）"),
            h("div", { className: "lc-j-speakers" }, event.speakers.map(function (name) {
              return h("span", { className: "lc-j-speaker", key: name }, name);
            }))
          )
        );
      }));

      var overview = h("div", null,
        h("div", { className: "lc-j-grid" },
          h("section", { className: "lc-j-card" }, h("h3", null, "出场人物"), charCards),
          h("section", { className: "lc-j-card lc-j-graph-card" }, h("h3", null, "人物关系图谱"), graph, relations)
        ),
        h("section", { className: "lc-j-card", style: { marginTop: "12px" } },
          h("h3", null, "事件时间线"),
          eventCards
        )
      );

      var needle = query.trim().toLowerCase();
      var visibleEvents = snapshot.events.map(function (event) {
        var lines = event.entries.filter(function (line) {
          if (activeEvent && event.id !== activeEvent) return false;
          if (!needle) return true;
          return (line.text + " " + line.speaker + " " + line.speakerTitle).toLowerCase().indexOf(needle) >= 0;
        });
        return { event: event, lines: lines };
      }).filter(function (group) { return group.lines.length > 0; });

      var dialogue = h("div", null,
        h("div", { className: "lc-j-tools", style: { marginBottom: "10px" } },
          h("input", {
            className: "lc-j-input",
            value: query,
            placeholder: "搜索台词 / 角色 / 头衔",
            onChange: function (event) { setQuery(event.target.value); }
          }),
          activeEvent ? h("button", { className: "lc-j-btn", type: "button", onClick: function () { setActiveEvent(""); } }, "取消事件筛选") : null,
          query ? h("button", { className: "lc-j-btn", type: "button", onClick: function () { setQuery(""); } }, "清空搜索") : null,
          h("span", { className: "lc-j-sub" }, "共 " + visibleEvents.reduce(function (sum, group) { return sum + group.lines.length; }, 0) + " 行")
        ),
        visibleEvents.length ? h("div", { className: "lc-j-lines" }, visibleEvents.map(function (group) {
          return h("div", { className: "lc-j-group", key: group.event.id },
            h("div", { className: "lc-j-group-head" },
              h("b", null, group.event.title),
              h("time", null, fmtDay(group.event.startTs) + " " + fmtClock(group.event.startTs) + " · " + group.lines.length + " 行")
            ),
            group.lines.map(function (line) {
              var color = speakerColor(line.speaker);
              return h("div", { className: "lc-j-line", key: line.id },
                h("div", { className: "lc-j-line-speaker" },
                  h("span", { className: "lc-j-avatar", style: { background: color } }, (line.speaker || "旁").slice(0, 1)),
                  h("span", { className: "lc-j-line-name" }, line.speaker || "旁白")
                ),
                h("div", { className: "lc-j-line-main" },
                  h("div", { className: "lc-j-line-text" }, highlightText(line.text, needle)),
                  h("div", { className: "lc-j-line-meta" },
                    (line.speakerTitle ? line.speakerTitle + " · " : "") + fmtClock(line.ts),
                    h("button", {
                      className: "lc-j-copy",
                      type: "button",
                      title: "复制这句",
                      onClick: function () { try { navigator.clipboard.writeText((line.speaker ? line.speaker + "：" : "") + line.text); } catch (error) { /* clipboard is best effort */ } }
                    }, "复制")
                  ),
                  line.choices && line.choices.length
                    ? h("div", null, line.choices.map(function (choice, index) { return h("span", { className: "lc-j-choice", key: index }, choice); }))
                    : null
                )
              );
            })
          );
        })) : h("div", { className: "lc-j-empty" }, "没有匹配的台词。")
      );

      var shots = snapshot.screenshots || [];
      var screenshotCards = shots.length ? h("div", { className: "lc-j-shot-grid" }, shots.map(function (shot) {
        return h("div", { className: "lc-j-shot", key: shot.id },
          h("button", { className: "lc-j-shot-img", type: "button", onClick: function () { openShot(shot.id); } },
            shot.thumb
              ? h("img", { src: shot.thumb, alt: shot.speaker || "游戏截图", loading: "lazy" })
              : h("span", { className: "lc-j-shot-placeholder" }, "无缩略图")
          ),
          h("div", { className: "lc-j-shot-meta" },
            h("b", null, shot.speaker || "截图"),
            h("span", null, fmtDay(shot.ts) + " " + fmtClock(shot.ts)),
            h("p", null, shot.text || "（无识别文字）")
          ),
          h("button", {
            className: "lc-j-shot-del",
            type: "button",
            title: "删除截图",
            onClick: function (event) { event.stopPropagation(); deleteShot(shot.id); }
          }, "删除")
        );
      })) : h("div", { className: "lc-j-empty" }, "还没有截图。在悬浮窗点「截图」会保存到这里。");
      var jumpToArc = function (id) {
        try {
          var node = document.getElementById(id);
          if (node && typeof node.scrollIntoView === "function") node.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (error) { /* scrolling is best effort */ }
      };
      var synopsis = snapshot.synopsis || null;
      var synopsisArcs = synopsis && Array.isArray(synopsis.arcs) ? synopsis.arcs : [];
      var synopsisView = synopsis ? h("div", { className: "lc-j-synopsis lc-j-reading" },
        h("section", { className: "lc-j-syn-hero" },
          h("div", { className: "lc-j-syn-kicker" }, "MAIN STORY / 全片梗概"),
          h("h2", { className: "lc-j-syn-title" }, synopsis.title || "录制剧情梗概"),
          h("div", { className: "lc-j-syn-meta" },
            h("span", { className: "lc-j-pill lc-j-pill-gold" }, synopsis.period || "本次录制"),
            h("span", { className: "lc-j-pill" }, synopsisArcs.length + " 个阶段"),
            synopsis.source && synopsis.source.cleanedLines ? h("span", { className: "lc-j-pill" }, synopsis.source.cleanedLines + " 行清理文本") : null,
            h("span", { className: "lc-j-pill lc-j-pill-dim" }, "minimax 整理")
          ),
          synopsis.overview ? h("div", { className: "lc-j-syn-overview" }, synopsis.overview) : null,
          synopsisArcs.length ? h("div", { className: "lc-j-toc", "aria-label": "章节导航" },
            h("div", { className: "lc-j-toc-label" }, "章节"),
            synopsisArcs.map(function (arc, index) {
              var target = "lc-arc-" + String(arc.id || index);
              return h("button", {
                className: "lc-j-toc-item",
                type: "button",
                key: target,
                onClick: function () { jumpToArc(target); }
              }, h("span", null, String(index + 1).padStart(2, "0")), h("b", null, arc.title || "剧情段落"));
            })
            ) : null
        ),
        h("div", { className: "lc-j-arc-list" },
          synopsisArcs.map(function (arc, index) {
            var target = "lc-arc-" + String(arc.id || index);
            return h("section", { className: "lc-j-arc", id: target, key: target },
              h("div", { className: "lc-j-arc-node", "aria-hidden": "true" }, String(index + 1).padStart(2, "0")),
              h("div", { className: "lc-j-arc-body" },
                h("div", { className: "lc-j-arc-head" },
                  h("div", { className: "lc-j-arc-eyebrow" }, "SCENE " + String(index + 1).padStart(2, "0")),
                  h("h3", null, arc.title || "剧情段落"),
                  arc.range ? h("span", { className: "lc-j-arc-range" }, arc.range) : null
                ),
                arc.summary ? h("p", { className: "lc-j-arc-summary" }, arc.summary) : null,
                Array.isArray(arc.keyBeats) && arc.keyBeats.length
                  ? h("ul", { className: "lc-j-arc-beats" }, arc.keyBeats.map(function (beat, beatIndex) { return h("li", { key: beatIndex }, beat); }))
                  : null,
                Array.isArray(arc.characters) && arc.characters.length
                  ? h("div", { className: "lc-j-arc-chars" }, arc.characters.map(function (name, charIndex) { return h("span", { className: "lc-j-choice", key: charIndex }, name); }))
                  : null
              )
            );
          })
        ),
        Array.isArray(synopsis.unresolved) && synopsis.unresolved.length
          ? h("div", { className: "lc-j-unresolved" }, h("b", null, "未解决 / 存疑"), h("ul", null, synopsis.unresolved.map(function (item, index) { return h("li", { key: index }, item); })))
          : null
      ) : h("div", { className: "lc-j-empty" }, "还没有剧情梗概。生成 data/journal/synopsis.json 后会出现在这里。");

      var curated = snapshot.curated || null;
      var curatedView = curated ? h("div", { className: "lc-j-curated" },
        h("div", { className: "lc-j-curated-eyebrow" }, "AI 整理稿 · " + ((curated.source && curated.source.range) || "本场记录")),
        h("h2", { className: "lc-j-curated-title" }, curated.title || "旅途整理稿"),
        curated.subtitle ? h("div", { className: "lc-j-curated-sub" }, curated.subtitle) : null,
        curated.summary ? h("div", { className: "lc-j-curated-summary" }, curated.summary) : null,
        Array.isArray(curated.characters) && curated.characters.length
          ? h("div", { className: "lc-j-chars lc-j-curated-chars" }, curated.characters.map(function (person, index) {
              return h("span", { className: "lc-j-char", key: (person.name || "") + index }, h("b", null, person.name || "未知"), person.role ? h("em", null, person.role) : null);
            }))
          : null,
        (curated.scenes || []).map(function (scene, index) {
          return h("section", { className: "lc-j-curated-scene", key: scene.id || index },
            h("div", { className: "lc-j-curated-scene-head" },
              h("span", { className: "lc-j-curated-index" }, String(index + 1).padStart(2, "0")),
              h("h3", null, scene.title || "未命名场景")
            ),
            scene.summary ? h("p", { className: "lc-j-curated-scene-sum" }, scene.summary) : null,
            (scene.lines || []).map(function (line, lineIndex) {
              return h("div", { className: "lc-j-curated-line", key: lineIndex },
                h("div", { className: "lc-j-curated-speaker" },
                  line.speaker ? h("span", { className: "lc-j-avatar", style: { background: speakerColor(line.speaker) } }, line.speaker.slice(0, 1)) : h("span", { className: "lc-j-avatar", style: { background: "#334155" } }, "旁"),
                  h("b", null, line.speaker || "旁白")
                ),
                h("div", { className: "lc-j-curated-text" }, line.text || ""),
                line.title ? h("div", { className: "lc-j-curated-title-tag" }, line.title) : null
              );
            })
          );
        })
      ) : h("div", { className: "lc-j-empty" }, "还没有 AI 整理稿。生成 data/journal/curated.json 后会出现在这里。");

      var screenshotView = h("div", null,
        h("div", { className: "lc-j-tools" },
          h("span", { className: "lc-j-sub" }, shots.length + " 张本地截图 · 点击查看原图"),
          h("button", { className: "lc-j-btn", type: "button", onClick: function () { load(game, snapshot ? snapshot.session : "", limit); } }, "刷新截图")
        ),
        screenshotCards
      );
      var shotModal = openShotData ? h("div", { className: "lc-j-modal", onClick: function () { setOpenShotData(null); } },
        h("img", { src: openShotData.dataUrl, alt: (openShotData.meta && openShotData.meta.speaker) || "截图原图" }),
        h("div", { className: "lc-j-modal-bar", onClick: function (event) { event.stopPropagation(); } },
          h("b", null, (openShotData.meta && openShotData.meta.speaker) || openShotData.id),
          h("span", null, (openShotData.meta && openShotData.meta.text) || ""),
          h("button", { className: "lc-j-btn", type: "button", onClick: function () { setOpenShotData(null); } }, "关闭"),
          h("button", { className: "lc-j-btn", type: "button", onClick: function () { deleteShot(openShotData.id); } }, "删除")
        )
      ) : null;

      return h("div", { className: "lc-journal" }, header, statsRow, tabs, tab === "synopsis" ? synopsisView : tab === "curated" ? curatedView : tab === "overview" ? overview : tab === "dialogue" ? dialogue : screenshotView, shotModal);
    }

    function WatchButton(props) {
      var execute = props.execute;
      var t = props.t;
      var invoke = function (command) {
        return Promise.resolve(execute(command)).then(function (result) {
          if (result && typeof result === "object" && result.ok === false) {
            throw new Error(result.error && (result.error.message || result.error.code) || "watch remote failed");
          }
          return result && typeof result === "object" && Object.prototype.hasOwnProperty.call(result, "value") ? result.value : result;
        });
      };
      var stateHook = react.useState({ status: null, busy: false, error: null });
      var state = stateHook[0];
      var setState = stateHook[1];
      var hostHook = react.useState(null);
      var portalHost = hostHook[0];
      var setPortalHost = hostHook[1];
      react.useEffect(function () {
        var alive = true;
        var refresh = function () {
          invoke({ action: "status" }).then(function (status) {
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
      react.useEffect(function () {
        if (!reactDom || typeof document === "undefined") return;
        var host = null;
        var attempts = 0;
        var attach = function () {
          if (host && host.isConnected) return true;
          var tabs = document.querySelector("[data-conversation-tabs]");
          if (!tabs) return false;
          host = document.createElement("span");
          host.className = "lc-watch-slot";
          tabs.appendChild(host);
          setPortalHost(host);
          return true;
        };
        if (attach()) {
          return function () { if (host) host.remove(); setPortalHost(null); };
        }
        var timer = setInterval(function () {
          if (attach() || ++attempts >= 24) clearInterval(timer);
        }, 250);
        return function () { clearInterval(timer); if (host) host.remove(); setPortalHost(null); };
      }, []);
      var running = Boolean(state.status && state.status.running);
      var busy = state.busy;
      var label = busy ? t("watchBusy") : running ? t("watchStop") : t("watchStart");
      var title = state.error || (running ? t("watchHintStop") : t("watchHintStart"));
      var toggle = function () {
        if (busy) return;
        setState(function (previous) { return Object.assign({}, previous, { busy: true, error: null }); });
        var action = running ? "stop" : "start";
        var command = action === "start" ? { action: action, game: "auto", intervalSec: 1 } : { action: action };
        invoke(command).then(function (status) {
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
      var button = h("button", {
        className: "lc-watch" + (running ? " lc-watch-on" : ""),
        type: "button",
        "aria-label": label,
        "aria-pressed": running,
        title: title,
        disabled: busy,
        onClick: toggle
      }, children);
      return portalHost && reactDom ? reactDom.createPortal(button, portalHost) : button;
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
        var journalExecuteRef = null;
        var journalExecute = function (command) {
          if (journalExecuteRef) return journalExecuteRef.execute(command);
          return new Promise(function (resolve, reject) {
            var attempts = 0;
            var timer = setInterval(function () {
              if (journalExecuteRef) {
                clearInterval(timer);
                journalExecuteRef.execute(command).then(resolve, reject);
              } else if (++attempts >= 40) {
                clearInterval(timer);
                reject(new Error("记录服务尚未连接：后台仍是旧版，完全退出 DSH 后重开"));
              }
            }, 200);
          });
        };
        var mounted = ctx.remote.$mount(watchRemote);
        ctx.effect(function () { return Promise.resolve(mounted); }, "dsh-lore-companion: mount watch remote");
        ctx.inject(["remote.loreWatch"], function (ready) {
          journalExecuteRef = ready.remote.loreWatch;
          ctx.slots.inject("conversation.session.header.actions", function () {
            return ctx.slots.register({
              name: "conversation.session.header.actions",
              id: "lore-watch-button",
              order: 100,
              inject: function () {
                return { execute: ready.remote.loreWatch.execute, t: t };
              }
            }, WatchButton);
          });
        });
        ctx.slots.inject("conversation.view", function () {
          return ctx.slots.register({
            name: "conversation.view",
            id: "lore-journal",
            order: 20,
            label: function () { return "旅途"; },
            inject: function () {
              return { execute: journalExecute };
            }
          }, JournalView);
        });
      }
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});

#!/usr/bin/env node
// Renders the C64 game feasibility matrix from its JSON source of truth into a
// self-contained, interactive HTML page. The JSON is the single thing a human (or
// the update_capability skill) edits; this script owns all rendering and every
// derived count, so the summary and the prioritization inversion can never drift
// from the rows.
//
//   node scripts/gen-capability-matrix.mjs            # regenerate the HTML
//   node scripts/gen-capability-matrix.mjs --check    # validate only, write nothing
//
// It fails loudly on a bad verdict glyph, an unknown blocker code, or an out-of-set
// difficulty before writing anything.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'docs', 'game-feasibility-matrix.json');
const OUT = join(HERE, '..', 'docs', 'game-feasibility-matrix.html');

const CHECK_ONLY = process.argv.includes('--check') || process.argv.includes('--dry-run');

/** Strip a trailing parenthetical qualifier, e.g. `SAMPLE(minor)` -> `SAMPLE`. */
const baseCode = (code) => code.replace(/\(.*\)$/, '').trim();

/** Split a Path-to-100% string into comparable tokens (`OPT + FUT-011` -> [OPT, FUT-011]). */
const pathTokens = (path) => (path || '').split(/[\s,;()+/]+/).filter(Boolean);

/** True when `code` gates a game — it appears in the game's blockers or its path. */
function gatedBy(game, code) {
  if (game.blockers.some((b) => baseCode(b) === code)) return true;
  return pathTokens(game.pathTo100).includes(code);
}

function validate(data) {
  const errors = [];
  const verdictKeys = new Set(data.scales.verdict.map((v) => v.key));
  const confKeys = new Set(data.scales.confidence.map((c) => c.key));
  const diffSet = new Set(data.scales.diff);
  const codeSet = new Set(data.legend.blockerCodes.map((c) => c.code));

  if (!Array.isArray(data.games) || data.games.length === 0) {
    errors.push('games: must be a non-empty array');
    return errors;
  }

  const seenTitles = new Set();
  data.games.forEach((g, i) => {
    const at = `games[${i}] (#${g.n ?? '?'} ${g.title ?? '?'})`;
    if (typeof g.n !== 'number') errors.push(`${at}: n must be a number`);
    if (!g.title) errors.push(`${at}: title is required`);
    if (!g.category) errors.push(`${at}: category is required`);
    if (!g.archetype) errors.push(`${at}: archetype is required`);
    if (!verdictKeys.has(g.rd18)) errors.push(`${at}: rd18 "${g.rd18}" not in ${[...verdictKeys].join('|')}`);
    if (!verdictKeys.has(g.phaseB)) errors.push(`${at}: phaseB "${g.phaseB}" not in ${[...verdictKeys].join('|')}`);
    if (!confKeys.has(g.conf)) errors.push(`${at}: conf "${g.conf}" not in ${[...confKeys].join('|')}`);
    if (!diffSet.has(g.diff)) errors.push(`${at}: diff "${g.diff}" not in ${[...diffSet].join('|')}`);
    if (!Array.isArray(g.blockers)) {
      errors.push(`${at}: blockers must be an array`);
    } else {
      for (const b of g.blockers) {
        if (!codeSet.has(baseCode(b))) errors.push(`${at}: blocker "${b}" is not a known code`);
      }
    }
    if (seenTitles.has(g.title)) errors.push(`${at}: duplicate title`);
    seenTitles.add(g.title);
    if (g.n !== i + 1) errors.push(`${at}: n should be ${i + 1} (rows are 1-indexed and contiguous)`);
  });

  return errors;
}

function derive(data) {
  const verdictKeys = data.scales.verdict.map((v) => v.key);
  const tally = (col) => {
    const counts = Object.fromEntries(verdictKeys.map((k) => [k, 0]));
    for (const g of data.games) counts[g[col]]++;
    return counts;
  };
  const categories = [...new Set(data.games.map((g) => g.category))];
  const inversion = data.inversion.rows.map((r) => ({
    ...r,
    count: data.games.filter((g) => gatedBy(g, r.code)).length,
  }));
  return {
    total: data.games.length,
    summary: { rd18: tally('rd18'), phaseB: tally('phaseB') },
    categories,
    inversion,
  };
}

function buildHtml(payload) {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${payload.meta.title}</title>
<style>${CSS}</style>
</head>
<body>
<div id="app" aria-busy="true">Loading the matrix…</div>
<script id="matrix-data" type="application/json">${json}</script>
<script>${CLIENT_JS}</script>
</body>
</html>
`;
}

const CSS = `
*{box-sizing:border-box}
:root{
  color-scheme:light;
  --surface:#fcfcfb;--plane:#f9f9f7;--ink:#0b0b0b;--ink2:#52514e;--muted:#898781;
  --grid:#e1e0d9;--axis:#c3c2b7;--border:rgba(11,11,11,.10);--accent:#2a78d6;
  --good:#0ca30c;--warning:#fab219;--critical:#d03b3b;
  --good-bg:rgba(12,163,12,.12);--warning-bg:rgba(250,178,25,.18);--critical-bg:rgba(208,59,59,.12);
  --chip:rgba(11,11,11,.05);--chip-on:#2a78d6;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  color-scheme:dark;
  --surface:#1a1a19;--plane:#0d0d0d;--ink:#fff;--ink2:#c3c2b7;--muted:#898781;
  --grid:#2c2c2a;--axis:#383835;--border:rgba(255,255,255,.12);--accent:#3987e5;
  --good-bg:rgba(12,163,12,.20);--warning-bg:rgba(250,178,25,.16);--critical-bg:rgba(208,59,59,.22);
  --chip:rgba(255,255,255,.07);--chip-on:#3987e5;
}}
:root[data-theme="dark"]{
  color-scheme:dark;
  --surface:#1a1a19;--plane:#0d0d0d;--ink:#fff;--ink2:#c3c2b7;--muted:#898781;
  --grid:#2c2c2a;--axis:#383835;--border:rgba(255,255,255,.12);--accent:#3987e5;
  --good-bg:rgba(12,163,12,.20);--warning-bg:rgba(250,178,25,.16);--critical-bg:rgba(208,59,59,.22);
  --chip:rgba(255,255,255,.07);--chip-on:#3987e5;
}
html,body{margin:0}
body{background:var(--plane);color:var(--ink);
  font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;
  padding:24px;max-width:1180px;margin:0 auto;-webkit-text-size-adjust:100%}
a{color:var(--accent)}
h1{font-size:1.5rem;margin:0 0 2px}
h2{font-size:1.05rem;margin:28px 0 10px;letter-spacing:.01em}
p{margin:.5em 0}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.86em;
  background:var(--chip);padding:.05em .35em;border-radius:4px}
.sub{color:var(--ink2);font-size:.9rem;margin:0 0 4px}
.purpose{color:var(--ink2);max-width:76ch}
.topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
.themebtn{flex:none;border:1px solid var(--border);background:var(--surface);color:var(--ink);
  border-radius:8px;padding:7px 11px;cursor:pointer;font-size:.85rem}
.themebtn:hover{border-color:var(--accent)}

/* summary bars */
.bars{background:var(--surface);border:1px solid var(--border);border-radius:12px;
  padding:16px 18px;display:grid;gap:14px}
.bar-row{display:grid;grid-template-columns:78px 1fr;gap:12px;align-items:center}
.bar-lab{font-weight:600;font-size:.9rem}
.bar{display:flex;height:26px;gap:2px;border-radius:6px;overflow:hidden}
.seg{display:flex;align-items:center;justify-content:center;color:#fff;font-size:.78rem;
  font-weight:650;min-width:2px;font-variant-numeric:tabular-nums;transition:opacity .12s}
.seg.good{background:var(--good)}.seg.warning{background:var(--warning);color:#3a2a00}
.seg.critical{background:var(--critical)}
.seg.dim{opacity:.25}
.legend-row{display:flex;gap:16px;flex-wrap:wrap;font-size:.85rem;color:var(--ink2);margin-top:2px}
.dot{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.dot.good{background:var(--good)}.dot.warning{background:var(--warning)}.dot.critical{background:var(--critical)}

/* controls */
.controls{display:flex;gap:10px 14px;flex-wrap:wrap;align-items:center;margin:18px 0 10px}
.controls input[type=search],.controls select{
  border:1px solid var(--border);background:var(--surface);color:var(--ink);
  border-radius:8px;padding:8px 10px;font:inherit;font-size:.88rem}
.controls input[type=search]{min-width:210px}
.seg-ctrl{display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden}
.seg-ctrl button{border:0;background:var(--surface);color:var(--ink2);padding:8px 12px;
  cursor:pointer;font:inherit;font-size:.84rem}
.seg-ctrl button.on{background:var(--accent);color:#fff}
.chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.chip{border:1px solid var(--border);background:var(--chip);color:var(--ink);
  border-radius:999px;padding:4px 11px;cursor:pointer;font-size:.8rem;font-weight:600;
  white-space:nowrap}
.chip:hover{border-color:var(--accent)}
.chip.on{background:var(--chip-on);color:#fff;border-color:transparent}
.chip.v.on.good{background:var(--good)}.chip.v.on.warning{background:var(--warning);color:#3a2a00}
.chip.v.on.critical{background:var(--critical)}
.reset{background:none;border:0;color:var(--accent);cursor:pointer;font:inherit;font-size:.84rem}
.count{color:var(--ink2);font-size:.85rem;margin-left:auto;font-variant-numeric:tabular-nums}
.filtlabel{color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;
  margin-right:2px}

/* table */
.tablewrap{overflow-x:auto;border:1px solid var(--border);border-radius:12px;background:var(--surface)}
table{border-collapse:collapse;width:100%;font-size:.86rem}
thead th{position:sticky;top:0;background:var(--surface);z-index:1;text-align:left;
  border-bottom:2px solid var(--axis);white-space:nowrap;padding:0}
thead th button{width:100%;text-align:left;background:none;border:0;color:var(--ink2);
  font:inherit;font-weight:650;padding:11px 12px;cursor:pointer;white-space:nowrap}
thead th button:hover{color:var(--ink)}
thead th .arw{color:var(--accent);font-size:.72rem}
th.c,td.c{text-align:center}
tbody td{border-bottom:1px solid var(--grid);padding:9px 12px;vertical-align:top}
tbody tr:hover td{background:var(--chip)}
td.num{font-variant-numeric:tabular-nums;color:var(--muted);text-align:right;padding-right:14px}
.gtitle{font-weight:650}
.gmeta{color:var(--muted);font-weight:400;font-size:.82rem}
.arch{color:var(--ink2)}
.verd{white-space:nowrap;font-weight:650;border-radius:6px;padding:3px 8px;display:inline-block}
.verd.good{background:var(--good-bg)}.verd.warning{background:var(--warning-bg)}
.verd.critical{background:var(--critical-bg)}
.bchip{display:inline-block;border:1px solid var(--border);border-radius:6px;background:var(--chip);
  padding:2px 7px;margin:1px 2px 1px 0;font-size:.76rem;font-weight:600;cursor:pointer;
  font-family:ui-monospace,Menlo,monospace}
.bchip:hover{border-color:var(--accent)}
.bchip.on{background:var(--chip-on);color:#fff;border-color:transparent}
.path{color:var(--ink2)}
.dash{color:var(--muted)}
.diff{font-weight:650;font-variant-numeric:tabular-nums}
.conf{white-space:nowrap;color:var(--ink2);font-size:.82rem}
.cdot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:1px}
.cdot.known{background:var(--good)}.cdot.inferred{background:var(--warning)}.cdot.low{background:var(--critical)}
.empty{padding:26px;text-align:center;color:var(--muted)}

/* collapsibles + reference tables */
details{border:1px solid var(--border);border-radius:10px;background:var(--surface);
  padding:2px 16px;margin:10px 0}
details[open]{padding-bottom:14px}
summary{cursor:pointer;font-weight:650;padding:12px 0;color:var(--ink)}
summary:hover{color:var(--accent)}
.ref{border-collapse:collapse;width:100%;font-size:.85rem;margin-top:4px}
.ref th,.ref td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--grid);vertical-align:top}
.ref th{color:var(--ink2);font-weight:650}
ul.notes{margin:.3em 0;padding-left:1.15em}
ul.notes li{margin:.35em 0}
.foot{color:var(--muted);font-size:.82rem;margin:26px 0 8px;font-style:italic}
@media (max-width:640px){body{padding:14px}.count{margin-left:0;width:100%}}
`;

const CLIENT_JS = `
"use strict";
const DATA = JSON.parse(document.getElementById("matrix-data").textContent);
const G = DATA.games;
const D = DATA.derived;
const VMAP = Object.fromEntries(DATA.scales.verdict.map(v => [v.key, v]));
const CMAP = Object.fromEntries(DATA.scales.confidence.map(c => [c.key, c]));
const VORDER = Object.fromEntries(DATA.scales.verdict.map((v,i) => [v.key, i]));
const CORDER = Object.fromEntries(DATA.scales.confidence.map((c,i) => [c.key, i]));
const DORDER = Object.fromEntries(DATA.scales.diff.map((d,i) => [d, i]));

const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
function md(s){
  return esc(s)
    .replace(/\`([^\`]+)\`/g, (_,c)=>"<code>"+c+"</code>")
    .replace(/\\*\\*([^*]+)\\*\\*/g, "<strong>$1</strong>")
    .replace(/\\*([^*\\n]+)\\*/g, "<em>$1</em>")
    .replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" rel="noopener">$1</a>');
}
const baseCode = c => c.replace(/\\(.*\\)$/,"").trim();
const pathTokens = p => (p||"").split(/[\\s,;()+/]+/).filter(Boolean);
const gatedBy = (g,code) => g.blockers.some(b => baseCode(b)===code) || pathTokens(g.pathTo100).includes(code);

// ---- UI state ----
const state = { q:"", cat:"all", scoreBy:"rd18", verdicts:new Set(), blockers:new Set(),
               sort:{key:"n", dir:1} };

function passes(g){
  if(state.cat!=="all" && g.category!==state.cat) return false;
  if(state.verdicts.size && !state.verdicts.has(g[state.scoreBy])) return false;
  if(state.blockers.size && ![...state.blockers].some(c => gatedBy(g,c))) return false;
  if(state.q){
    const hay = (g.title+" "+(g.publisher||"")+" "+g.category+" "+g.archetype+" "+
                 g.pathTo100+" "+g.blockers.join(" ")).toLowerCase();
    if(!hay.includes(state.q)) return false;
  }
  return true;
}
function cmp(a,b){
  const k = state.sort.key; let x,y;
  if(k==="rd18"||k==="phaseB"){x=VORDER[a[k]];y=VORDER[b[k]];}
  else if(k==="conf"){x=CORDER[a.conf];y=CORDER[b.conf];}
  else if(k==="diff"){x=DORDER[a.diff];y=DORDER[b.diff];}
  else if(k==="n"){x=a.n;y=b.n;}
  else if(k==="blockers"){x=a.blockers.length;y=b.blockers.length;}
  else {x=String(a[k]).toLowerCase();y=String(b[k]).toLowerCase();}
  if(x<y) return -1*state.sort.dir; if(x>y) return 1*state.sort.dir;
  return a.n-b.n;
}

// ---- renderers ----
function verdictCell(key){
  const v = VMAP[key];
  return '<span class="verd '+v.status+'" title="'+esc(v.desc)+'">'+v.glyph+" "+esc(v.label)+"</span>";
}
function blockerCell(g){
  if(!g.blockers.length) return '<span class="dash">—</span>';
  return g.blockers.map(b => {
    const code = baseCode(b);
    const on = state.blockers.has(code) ? " on" : "";
    return '<span class="bchip'+on+'" data-code="'+esc(code)+'">'+esc(b)+"</span>";
  }).join("");
}
function renderTable(){
  const rows = G.filter(passes).sort(cmp);
  const body = document.getElementById("tbody");
  if(!rows.length){
    body.innerHTML = '<tr><td class="empty" colspan="10">No games match these filters.</td></tr>';
  } else {
    body.innerHTML = rows.map(rowHtml).join("");
  }
  document.getElementById("count").textContent = "Showing "+rows.length+" of "+D.total;
  // header arrows
  document.querySelectorAll("th button[data-key]").forEach(b=>{
    const a = b.querySelector(".arw"); if(!a) return;
    a.textContent = b.dataset.key===state.sort.key ? (state.sort.dir>0?"▲":"▼") : "";
  });
  // blocker chip active sync (row chips + filter chips)
  document.querySelectorAll(".bchip").forEach(ch=>{
    ch.classList.toggle("on", state.blockers.has(ch.dataset.code));
  });
}
function rowHtml(g){
  const pub = g.publisher ? ", "+g.publisher : "";
  const path = g.pathTo100 ? '<span class="path">'+md(g.pathTo100)+"</span>" : '<span class="dash">—</span>';
  const c = CMAP[g.conf];
  return "<tr>"+
    '<td class="num">'+g.n+"</td>"+
    "<td><span class=gtitle>"+esc(g.title)+'</span> <span class=gmeta>('+g.year+esc(pub)+")</span></td>"+
    "<td>"+esc(g.category)+"</td>"+
    '<td class="arch">'+esc(g.archetype)+"</td>"+
    '<td class="c">'+verdictCell(g.rd18)+"</td>"+
    '<td class="c">'+verdictCell(g.phaseB)+"</td>"+
    "<td>"+blockerCell(g)+"</td>"+
    "<td>"+path+"</td>"+
    '<td class="c diff">'+g.diff+"</td>"+
    '<td class="conf"><span class="cdot '+g.conf+'"></span>'+esc(c.label)+"</td>"+
    "</tr>";
}

function bars(){
  const mk = (label,col)=>{
    const counts = D.summary[col]; const total = D.total;
    const segs = DATA.scales.verdict.map(v=>{
      const n = counts[v.key]; const pct = (n/total*100).toFixed(1);
      const dim = state.verdicts.size && !state.verdicts.has(v.key) ? " dim":"";
      return '<span class="seg '+v.status+dim+'" style="flex:'+n+'" '+
             'title="'+esc(v.label)+': '+n+' ('+pct+'%)">'+(n>=4?n:"")+"</span>";
    }).join("");
    return '<div class="bar-row"><div class="bar-lab">'+label+'</div><div class="bar">'+segs+"</div></div>";
  };
  const leg = DATA.scales.verdict.map(v =>
    '<span><span class="dot '+v.status+'"></span>'+v.glyph+" "+esc(v.label)+"</span>").join("");
  return '<div class="bars">'+mk("@RD18","rd18")+mk("@PhaseB","phaseB")+
         '<div class="legend-row">'+leg+"</div></div>";
}

function controls(){
  const cats = ['<option value="all">All categories</option>']
    .concat(D.categories.map(c=>'<option value="'+esc(c)+'">'+esc(c)+"</option>")).join("");
  const vchips = DATA.scales.verdict.map(v =>
    '<button class="chip v '+v.status+'" data-verdict="'+v.key+'">'+v.glyph+" "+esc(v.label)+"</button>").join("");
  const bchips = DATA.legend.blockerCodes.map(c =>
    '<button class="chip b" data-bfilter="'+esc(c.code)+'">'+esc(c.code)+"</button>").join("");
  return '<div class="controls">'+
      '<input type="search" id="q" placeholder="Search game, archetype…" aria-label="Search">'+
      '<select id="cat" aria-label="Category filter">'+cats+"</select>"+
      '<span class="filtlabel">score by</span>'+
      '<span class="seg-ctrl"><button data-score="rd18" class="on">@RD18</button>'+
        '<button data-score="phaseB">@PhaseB</button></span>'+
      '<span class="count" id="count"></span>'+
    "</div>"+
    '<div class="controls"><span class="filtlabel">verdict</span><span class="chips">'+vchips+"</span></div>"+
    '<div class="controls"><span class="filtlabel">blocker</span><span class="chips">'+bchips+
      '</span><button class="reset" id="reset">Reset filters</button></div>';
}

function refTables(){
  const base = DATA.baseline.rows.map(r =>
    "<tr><td>"+md(r.capability)+"</td><td>"+md(r.state)+"</td><td>"+md(r.source)+"</td></tr>").join("");
  const codes = DATA.legend.blockerCodes.map(c =>
    "<tr><td><code>"+esc(c.code)+"</code></td><td>"+md(c.meaning)+"</td><td>"+md(c.fixedBy)+"</td></tr>").join("");
  const arch = DATA.legend.archetypeTerms.map(a =>
    "<tr><td><code>"+esc(a.term)+"</code></td><td>"+md(a.def)+"</td></tr>").join("");
  const inv = D.inversion.map(r =>
    "<tr><td><code>"+esc(r.code)+"</code> <span class=gmeta>"+esc(r.label)+"</span></td>"+
    '<td class="c diff">'+r.count+"</td><td>"+md(r.impact)+"</td></tr>").join("");
  const howto = DATA.howToRead.map(x=>"<li>"+md(x)+"</li>").join("");
  const prov = DATA.provenance.map(x=>"<li>"+md(x)+"</li>").join("");

  return '<h2>Reference</h2>'+
    "<details open><summary>Capability baseline — what these verdicts assume ("+esc(DATA.baseline.asOf)+")</summary>"+
      "<p>"+md(DATA.baseline.intro)+"</p>"+
      '<table class="ref"><thead><tr><th>Capability</th><th>State</th><th>Source</th></tr></thead><tbody>'+base+"</tbody></table>"+
      "<p>"+md(DATA.baseline.audioNote)+"</p></details>"+
    "<details><summary>Prioritization — what each capability unlocks</summary>"+
      "<p>"+md(DATA.inversion.intro)+"</p>"+
      '<table class="ref"><thead><tr><th>Capability</th><th class="c">Titles</th><th>Impact</th></tr></thead><tbody>'+inv+"</tbody></table>"+
      "<p>"+md(DATA.inversion.bottomLine)+"</p></details>"+
    "<details><summary>Legend — blocker codes &amp; archetype terms</summary>"+
      '<table class="ref"><thead><tr><th>Code</th><th>Meaning</th><th>Fixed by</th></tr></thead><tbody>'+codes+"</tbody></table>"+
      '<table class="ref"><thead><tr><th>Term</th><th>Meaning</th></tr></thead><tbody>'+arch+"</tbody></table></details>"+
    "<details><summary>How to read this</summary><ul class=notes>"+howto+"</ul></details>"+
    "<details><summary>Provenance &amp; confidence caveats</summary><ul class=notes>"+prov+"</ul></details>";
}

function head(){
  const cols = [["n","#",true],["title","Game"],["category","Cat"],["archetype","Archetype"],
    ["rd18","@RD18",true],["phaseB","@PhaseB",true],["blockers","Blockers",true],
    ["pathTo100","Path to 100%"],["diff","Diff",true],["conf","Conf",true]];
  return "<thead><tr>"+cols.map(([k,l,c])=>
    '<th class="'+(c?"c":"")+'"><button data-key="'+k+'">'+esc(l)+' <span class="arw"></span></button></th>').join("")+"</tr></thead>";
}

function render(){
  const app = document.getElementById("app");
  const purpose = DATA.intro.purpose.map(p=>"<p class=purpose>"+md(p)+"</p>").join("");
  app.innerHTML =
    '<div class="topbar"><div>'+
      "<h1>"+esc(DATA.meta.title)+"</h1>"+
      '<p class="sub">Last updated '+esc(DATA.meta.lastUpdated)+
        " · refresh with <code>"+esc(DATA.meta.refreshWith)+"</code></p></div>"+
      '<button class="themebtn" id="theme">◐ Theme</button></div>'+
    purpose+
    '<h2>At a glance</h2>'+bars()+
    "<h2>The matrix</h2>"+controls()+
    '<div class="tablewrap"><table>'+head()+'<tbody id="tbody"></tbody></table></div>'+
    refTables()+
    '<p class="foot">'+md(DATA.footer)+"</p>";
  app.removeAttribute("aria-busy");
  wire();
  renderTable();
}

function wire(){
  document.getElementById("q").addEventListener("input", e=>{ state.q=e.target.value.trim().toLowerCase(); renderTable(); });
  document.getElementById("cat").addEventListener("change", e=>{ state.cat=e.target.value; renderTable(); });
  document.getElementById("reset").addEventListener("click", ()=>{
    state.q=""; state.cat="all"; state.verdicts.clear(); state.blockers.clear();
    document.getElementById("q").value=""; document.getElementById("cat").value="all";
    syncChips(); renderBarsAndTable();
  });
  document.querySelectorAll("[data-score]").forEach(b=> b.addEventListener("click", ()=>{
    state.scoreBy=b.dataset.score;
    document.querySelectorAll("[data-score]").forEach(x=>x.classList.toggle("on", x===b));
    renderBarsAndTable();
  }));
  document.querySelectorAll("[data-verdict]").forEach(b=> b.addEventListener("click", ()=>{
    toggle(state.verdicts, b.dataset.verdict); syncChips(); renderBarsAndTable();
  }));
  document.querySelectorAll("[data-bfilter]").forEach(b=> b.addEventListener("click", ()=>{
    toggle(state.blockers, b.dataset.bfilter); syncChips(); renderTable();
  }));
  document.querySelectorAll("th button[data-key]").forEach(b=> b.addEventListener("click", ()=>{
    const k=b.dataset.key;
    if(state.sort.key===k) state.sort.dir*=-1; else state.sort={key:k,dir:1};
    renderTable();
  }));
  document.getElementById("tbody").addEventListener("click", e=>{
    const ch = e.target.closest(".bchip"); if(!ch) return;
    toggle(state.blockers, ch.dataset.code); syncChips(); renderTable();
  });
  document.getElementById("theme").addEventListener("click", toggleTheme);
}
function toggle(set,v){ set.has(v)?set.delete(v):set.add(v); }
function syncChips(){
  document.querySelectorAll("[data-verdict]").forEach(b=> b.classList.toggle("on", state.verdicts.has(b.dataset.verdict)));
  document.querySelectorAll("[data-bfilter]").forEach(b=> b.classList.toggle("on", state.blockers.has(b.dataset.bfilter)));
}
function renderBarsAndTable(){
  document.querySelector(".bars").outerHTML = bars();
  renderTable();
}
function toggleTheme(){
  const root=document.documentElement;
  const dark = root.getAttribute("data-theme")==="dark" ||
    (!root.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
  root.setAttribute("data-theme", dark ? "light" : "dark");
}
render();
`;

// ---- run ----
const raw = readFileSync(SRC, 'utf8');
let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error(`✗ ${SRC} is not valid JSON: ${e.message}`);
  process.exit(1);
}

const errors = validate(data);
if (errors.length) {
  console.error(`✗ ${errors.length} validation error(s) — nothing written:`);
  for (const e of errors) console.error('  · ' + e);
  process.exit(1);
}

const derived = derive(data);
const payload = { ...data, derived };

const s = derived.summary;
const line = (label, c) =>
  `  ${label.padEnd(9)} ${String(c.clean).padStart(3)} clean   ${String(c.caveated).padStart(3)} caveated   ${String(c.blocked).padStart(3)} blocked`;
console.log(`✓ ${derived.total} games validated.`);
console.log(line('@RD18', s.rd18));
console.log(line('@PhaseB', s.phaseB));
console.log('  inversion (titles gated): ' + derived.inversion.map((r) => `${r.code}=${r.count}`).join('  '));

if (CHECK_ONLY) {
  console.log('— --check: no file written.');
  process.exit(0);
}

writeFileSync(OUT, buildHtml(payload), 'utf8');
console.log(`→ wrote ${OUT}`);

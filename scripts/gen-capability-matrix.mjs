#!/usr/bin/env node
// Renders the C64 game feasibility matrix from its JSON source of truth into a
// self-contained, interactive HTML page.
//
// The model is capability-based: each game lists the capabilities it `needs`, each
// capability sits in a `tier` (available / planned / unplanned), and a game's
// Buildable verdict falls out of the two — Now (needs nothing missing), Soon (only
// planned capabilities missing), Blocked (an unplanned capability missing). The JSON
// is the only thing a human edits; this script owns all rendering and every derived
// number (verdicts, summary tallies, per-capability unlock counts) so nothing drifts.
//
//   node scripts/gen-capability-matrix.mjs            # regenerate the HTML
//   node scripts/gen-capability-matrix.mjs --check    # validate only, write nothing
//
// It fails loudly on an unknown capability id, a bad tier/verdict/diff/conf value, or
// a non-contiguous row number before writing anything.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'docs', 'game-feasibility-matrix.json');
const OUT = join(HERE, '..', 'docs', 'game-feasibility-matrix.html');
const CHECK_ONLY = process.argv.includes('--check') || process.argv.includes('--dry-run');

/** A row's verdict is a pure function of its needs and each capability's tier. */
function verdictOf(row, capById) {
  if (row.needs.length === 0) return 'now';
  return row.needs.some((c) => capById[c].tier === 'unplanned') ? 'blocked' : 'soon';
}

/**
 * Validates one array of scored rows — `games` and `software` share a shape, so they
 * share these checks. Row numbers are 1-indexed and contiguous *within* their own array.
 */
function validateRows(rows, label, sets, errors) {
  const seenTitles = new Set();
  rows.forEach((r, i) => {
    const at = `${label}[${i}] (#${r.n ?? '?'} ${r.title ?? '?'})`;
    if (typeof r.n !== 'number') errors.push(`${at}: n must be a number`);
    if (!r.title) errors.push(`${at}: title is required`);
    if (!r.category) errors.push(`${at}: category is required`);
    if (!r.archetype) errors.push(`${at}: archetype is required`);
    if (!sets.conf.has(r.conf)) errors.push(`${at}: conf "${r.conf}" not in ${[...sets.conf].join('|')}`);
    if (!sets.diff.has(r.diff)) errors.push(`${at}: diff "${r.diff}" not in ${[...sets.diff].join('|')}`);
    if (!Array.isArray(r.needs)) {
      errors.push(`${at}: needs must be an array`);
    } else {
      for (const c of r.needs) {
        if (!sets.cap.has(c)) errors.push(`${at}: needs "${c}" is not a known capability id`);
      }
    }
    if (seenTitles.has(r.title)) errors.push(`${at}: duplicate title`);
    seenTitles.add(r.title);
    if (r.n !== i + 1) errors.push(`${at}: n should be ${i + 1} (rows are 1-indexed and contiguous)`);
  });
}

function validate(data) {
  const errors = [];
  const tierIds = new Set(data.tiers.map((t) => t.id));
  const sets = {
    cap: new Set(data.capabilities.map((c) => c.id)),
    conf: new Set(data.scales.confidence.map((c) => c.key)),
    diff: new Set(data.scales.diff),
  };

  for (const c of data.capabilities) {
    if (!tierIds.has(c.tier)) errors.push(`capability "${c.id}": tier "${c.tier}" not in ${[...tierIds].join('|')}`);
  }
  if (!Array.isArray(data.games) || data.games.length === 0) {
    errors.push('games: must be a non-empty array');
    return errors;
  }
  validateRows(data.games, 'games', sets, errors);

  // The software section is optional; when present it is validated exactly like games.
  if (data.software !== undefined) {
    if (!Array.isArray(data.software)) errors.push('software: must be an array when present');
    else validateRows(data.software, 'software', sets, errors);
  }

  return errors;
}

function derive(data) {
  const capById = Object.fromEntries(data.capabilities.map((c) => [c.id, c]));
  const verdictIds = data.verdicts.map((v) => v.id);
  const tally = (rows) => {
    const out = Object.fromEntries(verdictIds.map((k) => [k, 0]));
    for (const r of rows) out[verdictOf(r, capById)]++;
    return out;
  };
  // Tallies and unlock counts stay games-only: the headline numbers are about the
  // 100-title list, and the software rows are scored alongside it, not folded into it.
  const unlock = Object.fromEntries(
    data.capabilities.map((c) => [c.id, data.games.filter((g) => g.needs.includes(c.id)).length]),
  );
  const categories = [...new Set(data.games.map((g) => g.category))];
  // The software list gets its own unlock counts. Without them the page would claim
  // disk file I/O matters while the only visible number next to it is the games' 2.
  const software = data.software?.length
    ? {
        total: data.software.length,
        summary: tally(data.software),
        unlock: Object.fromEntries(
          data.capabilities.map((c) => [c.id, data.software.filter((s) => s.needs.includes(c.id)).length]),
        ),
      }
    : null;
  return { total: data.games.length, summary: tally(data.games), unlock, categories, software };
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
.purpose{color:var(--ink2);max-width:78ch}
.topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
.themebtn{flex:none;border:1px solid var(--border);background:var(--surface);color:var(--ink);
  border-radius:8px;padding:7px 11px;cursor:pointer;font-size:.85rem}
.themebtn:hover{border-color:var(--accent)}

/* summary bars */
.bars{background:var(--surface);border:1px solid var(--border);border-radius:12px;
  padding:16px 18px;display:grid;gap:14px}
.bar-row{display:grid;grid-template-columns:64px 1fr;gap:12px;align-items:center}
.bar-lab{font-weight:600;font-size:.9rem}
.bar{display:flex;height:26px;gap:2px;border-radius:6px;overflow:hidden}
.seg{display:flex;align-items:center;justify-content:center;color:#fff;font-size:.78rem;
  font-weight:650;min-width:2px;font-variant-numeric:tabular-nums}
.seg.good{background:var(--good)}.seg.warning{background:var(--warning);color:#3a2a00}
.seg.critical{background:var(--critical)}
.legend-row{display:flex;gap:16px;flex-wrap:wrap;font-size:.85rem;color:var(--ink2)}
.legend-row b{font-weight:650;color:var(--ink)}
.dot{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.dot.good{background:var(--good)}.dot.warning{background:var(--warning)}.dot.critical{background:var(--critical)}

/* capability status board */
.board{display:grid;gap:10px;background:var(--surface);border:1px solid var(--border);
  border-radius:12px;padding:16px 18px}
.tiergroup{display:grid;grid-template-columns:150px 1fr;gap:12px;align-items:start}
.tiername{font-weight:650;font-size:.85rem;white-space:nowrap}
.tiername small{display:block;color:var(--muted);font-weight:400;font-size:.78rem}
.capchips{display:flex;gap:7px;flex-wrap:wrap}
.capchip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);
  background:var(--chip);border-radius:999px;padding:4px 6px 4px 11px;font-size:.82rem;
  font-weight:600;cursor:pointer;color:var(--ink)}
.capchip:hover{border-color:var(--accent)}
.capchip.on{background:var(--chip-on);color:#fff;border-color:transparent}
.capchip .n{font-variant-numeric:tabular-nums;font-size:.72rem;background:rgba(0,0,0,.12);
  border-radius:999px;padding:1px 7px;min-width:20px;text-align:center}
.capchip.on .n{background:rgba(255,255,255,.25)}
.capchip.t-available{cursor:default;opacity:.85}
.capchip.t-available:hover{border-color:var(--border)}
.tdot{width:9px;height:9px;border-radius:50%;flex:none}
.tdot.good{background:var(--good)}.tdot.warning{background:var(--warning)}.tdot.critical{background:var(--critical)}

/* controls */
.controls{display:flex;gap:10px 14px;flex-wrap:wrap;align-items:center;margin:16px 0 10px}
.controls input[type=search],.controls select{
  border:1px solid var(--border);background:var(--surface);color:var(--ink);
  border-radius:8px;padding:8px 10px;font:inherit;font-size:.88rem}
.controls input[type=search]{min-width:220px}
.chip{border:1px solid var(--border);background:var(--chip);color:var(--ink);
  border-radius:999px;padding:5px 12px;cursor:pointer;font-size:.82rem;font-weight:600;white-space:nowrap}
.chip:hover{border-color:var(--accent)}
.chip.v.on.good{background:var(--good);color:#fff;border-color:transparent}
.chip.v.on.warning{background:var(--warning);color:#3a2a00;border-color:transparent}
.chip.v.on.critical{background:var(--critical);color:#fff;border-color:transparent}
.reset{background:none;border:0;color:var(--accent);cursor:pointer;font:inherit;font-size:.84rem}
.count{color:var(--ink2);font-size:.85rem;margin-left:auto;font-variant-numeric:tabular-nums}
.filtlabel{color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em}

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
.verd{white-space:nowrap;font-weight:650;border-radius:6px;padding:3px 9px;display:inline-block}
.verd.good{background:var(--good-bg)}.verd.warning{background:var(--warning-bg)}
.verd.critical{background:var(--critical-bg)}
.needchip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--border);
  border-radius:6px;background:var(--chip);padding:2px 8px;margin:1px 3px 1px 0;font-size:.78rem;
  font-weight:600;cursor:pointer}
.needchip:hover{border-color:var(--accent)}
.needchip.on{background:var(--chip-on);color:#fff;border-color:transparent}
.needchip .tdot{width:7px;height:7px}
.dash{color:var(--muted)}
.diff{font-weight:650;font-variant-numeric:tabular-nums}
.conf{white-space:nowrap;color:var(--ink2);font-size:.82rem}
.cdot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:1px}
.cdot.known{background:var(--good)}.cdot.inferred{background:var(--warning)}.cdot.low{background:var(--critical)}
.empty{padding:26px;text-align:center;color:var(--muted)}
.needchip.static,.capchip.static{cursor:default}
.needchip.static:hover,.capchip.static:hover{border-color:var(--border)}

/* non-game software table */
.softnote td{border-bottom:1px solid var(--grid);padding:0 12px 11px;color:var(--ink2);font-size:.83rem;
  line-height:1.5;max-width:70ch}
tbody tr.softhead td{border-bottom:0;padding-bottom:5px}
.softsum{color:var(--ink2);font-size:.86rem;margin:0 0 10px}

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
ul.notes li{margin:.4em 0}
.foot{color:var(--muted);font-size:.82rem;margin:26px 0 8px;font-style:italic}
@media (max-width:640px){body{padding:14px}.count{margin-left:0;width:100%}
  .tiergroup{grid-template-columns:1fr}}
`;

const CLIENT_JS = `
"use strict";
const DATA = JSON.parse(document.getElementById("matrix-data").textContent);
const G = DATA.games;
const D = DATA.derived;
const CAP = Object.fromEntries(DATA.capabilities.map(c => [c.id, c]));
const TIER = Object.fromEntries(DATA.tiers.map(t => [t.id, t]));
const VMAP = Object.fromEntries(DATA.verdicts.map(v => [v.id, v]));
const CMAP = Object.fromEntries(DATA.scales.confidence.map(c => [c.key, c]));
const VORDER = Object.fromEntries(DATA.verdicts.map((v,i) => [v.id, i]));
const CORDER = Object.fromEntries(DATA.scales.confidence.map((c,i) => [c.key, i]));
const DORDER = Object.fromEntries(DATA.scales.diff.map((d,i) => [d, i]));
const TORDER = Object.fromEntries(DATA.tiers.map((t,i) => [t.id, i]));

const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
function md(s){
  return esc(s)
    .replace(/\`([^\`]+)\`/g, (_,c)=>"<code>"+c+"</code>")
    .replace(/\\*\\*([^*]+)\\*\\*/g, "<strong>$1</strong>")
    .replace(/\\*([^*\\n]+)\\*/g, "<em>$1</em>")
    .replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" rel="noopener">$1</a>');
}
// a game's verdict is derived from its needs + capability tiers
function verdictOf(g){
  if(!g.needs.length) return "now";
  return g.needs.some(c => CAP[c].tier==="unplanned") ? "blocked" : "soon";
}
// needs sorted most-blocking first (unplanned before planned)
function sortedNeeds(g){
  return [...g.needs].sort((a,b)=> TORDER[CAP[b].tier]-TORDER[CAP[a].tier]);
}
const statusOfTier = id => TIER[id].status;

const state = { q:"", cat:"all", verdicts:new Set(), caps:new Set(), sort:{key:"n", dir:1} };

function passes(g){
  if(state.cat!=="all" && g.category!==state.cat) return false;
  if(state.verdicts.size && !state.verdicts.has(verdictOf(g))) return false;
  if(state.caps.size && ![...state.caps].some(c => g.needs.includes(c))) return false;
  if(state.q){
    const hay = (g.title+" "+(g.publisher||"")+" "+g.category+" "+g.archetype+" "+
                 g.needs.map(c=>CAP[c].name).join(" ")).toLowerCase();
    if(!hay.includes(state.q)) return false;
  }
  return true;
}
function cmp(a,b){
  const k=state.sort.key; let x,y;
  if(k==="verdict"){x=VORDER[verdictOf(a)];y=VORDER[verdictOf(b)];}
  else if(k==="conf"){x=CORDER[a.conf];y=CORDER[b.conf];}
  else if(k==="diff"){x=DORDER[a.diff];y=DORDER[b.diff];}
  else if(k==="n"){x=a.n;y=b.n;}
  else if(k==="needs"){x=a.needs.length;y=b.needs.length;}
  else {x=String(a[k]).toLowerCase();y=String(b[k]).toLowerCase();}
  if(x<y) return -state.sort.dir; if(x>y) return state.sort.dir; return a.n-b.n;
}

function verdictCell(g){
  const v=VMAP[verdictOf(g)];
  return '<span class="verd '+v.status+'" title="'+esc(v.desc)+'">'+v.glyph+" "+esc(v.label)+"</span>";
}
function needsCell(g){
  if(!g.needs.length) return '<span class="dash">—</span>';
  return sortedNeeds(g).map(id=>{
    const c=CAP[id], on=state.caps.has(id)?" on":"";
    return '<span class="needchip'+on+'" data-cap="'+id+'" title="'+esc(TIER[c.tier].label)+'">'+
           '<span class="tdot '+statusOfTier(c.tier)+'"></span>'+esc(c.name)+"</span>";
  }).join("");
}
function rowHtml(g){
  const pub=g.publisher?", "+g.publisher:"";
  const c=CMAP[g.conf];
  return "<tr>"+
    '<td class="num">'+g.n+"</td>"+
    "<td><span class=gtitle>"+esc(g.title)+'</span> <span class=gmeta>('+g.year+esc(pub)+")</span></td>"+
    "<td>"+esc(g.category)+"</td>"+
    '<td class="arch">'+esc(g.archetype)+"</td>"+
    '<td class="c">'+verdictCell(g)+"</td>"+
    "<td>"+needsCell(g)+"</td>"+
    '<td class="c diff">'+g.diff+"</td>"+
    '<td class="conf"><span class="cdot '+g.conf+'"></span>'+esc(c.label)+"</td>"+
    "</tr>";
}
function renderTable(){
  const rows=G.filter(passes).sort(cmp);
  const body=document.getElementById("tbody");
  body.innerHTML = rows.length
    ? rows.map(rowHtml).join("")
    : '<tr><td class="empty" colspan="8">No games match these filters.</td></tr>';
  document.getElementById("count").textContent="Showing "+rows.length+" of "+D.total;
  document.querySelectorAll("th button[data-key]").forEach(b=>{
    const a=b.querySelector(".arw"); if(a) a.textContent = b.dataset.key===state.sort.key ? (state.sort.dir>0?"▲":"▼") : "";
  });
  syncCapChips();
}

function bars(){
  const mk=(label,id)=>{
    const n=D.summary[id]||0, total=D.total;
    const seg='<span class="seg '+VMAP[id].status+'" style="flex:'+n+'" title="'+
      esc(VMAP[id].label)+': '+n+'">'+(n>=4?n:"")+"</span>";
    return {n,seg};
  };
  const segs=DATA.verdicts.map(v=>mk(v.label,v.id).seg).join("");
  const leg=DATA.verdicts.map(v=>'<span><span class="dot '+v.status+'"></span><b>'+v.glyph+" "+
    esc(v.label)+"</b> — "+esc(v.desc)+"</span>").join("");
  return '<div class="bars"><div class="bar-row"><div class="bar-lab">Buildable</div>'+
    '<div class="bar">'+segs+'</div></div><div class="legend-row">'+leg+"</div></div>";
}

function board(){
  const groups=DATA.tiers.map(t=>{
    const caps=DATA.capabilities.filter(c=>c.tier===t.id);
    const chips=caps.map(c=>{
      const cnt=D.unlock[c.id]||0, on=state.caps.has(c.id)?" on":"";
      return '<span class="capchip t-'+t.id+on+'" data-cap="'+c.id+'" title="'+esc(c.blurb)+'">'+
        '<span class="tdot '+t.status+'"></span>'+esc(c.name)+
        '<span class="n">'+cnt+"</span></span>";
    }).join("");
    return '<div class="tiergroup"><div class="tiername">'+t.glyph+" "+esc(t.label)+
      "<small>"+(t.id==="available"?"games blocked on it":"games waiting")+"</small></div>"+
      '<div class="capchips">'+chips+"</div></div>";
  }).join("");
  return '<div class="board">'+groups+"</div>";
}

function controls(){
  const cats=['<option value="all">All categories</option>']
    .concat(D.categories.map(c=>'<option value="'+esc(c)+'">'+esc(c)+"</option>")).join("");
  const vchips=DATA.verdicts.map(v=>
    '<button class="chip v '+v.status+'" data-verdict="'+v.id+'">'+v.glyph+" "+esc(v.label)+"</button>").join("");
  return '<div class="controls">'+
    '<input type="search" id="q" placeholder="Search game, archetype…" aria-label="Search">'+
    '<select id="cat" aria-label="Category filter">'+cats+"</select>"+
    '<span class="filtlabel">buildable</span>'+vchips+
    '<button class="reset" id="reset">Reset</button>'+
    '<span class="count" id="count"></span></div>';
}

function refTables(){
  const capRows=DATA.capabilities.map(c=>
    "<tr><td><strong>"+esc(c.name)+'</strong></td><td><span class="tdot '+TIER[c.tier].status+
    '" style="display:inline-block;margin-right:6px"></span>'+esc(TIER[c.tier].label)+
    '</td><td class="c diff">'+(D.unlock[c.id]||0)+"</td><td>"+md(c.blurb)+"</td></tr>").join("");
  const inv=DATA.inversion.rows.map(r=>{
    const c=CAP[r.id];
    return "<tr><td><strong>"+esc(c.name)+'</strong></td><td class="c diff">'+(D.unlock[r.id]||0)+
      "</td><td>"+md(r.impact)+"</td></tr>";
  }).join("");
  const howto=DATA.howToRead.map(x=>"<li>"+md(x)+"</li>").join("");
  const notes=DATA.notes.map(x=>"<li>"+md(x)+"</li>").join("");
  const prov=DATA.provenance.map(x=>"<li>"+md(x)+"</li>").join("");

  return '<h2>Reference</h2>'+
    "<details open><summary>Prioritization — what shipping each capability unlocks</summary>"+
      "<p>"+md(DATA.inversion.intro)+"</p>"+
      '<table class="ref"><thead><tr><th>Capability</th><th class="c">Titles</th><th>Impact</th></tr></thead><tbody>'+inv+"</tbody></table>"+
      "<p>"+md(DATA.inversion.bottomLine)+"</p></details>"+
    "<details><summary>Capability details</summary>"+
      '<table class="ref"><thead><tr><th>Capability</th><th>Status</th><th class="c">Waiting</th><th>What it is</th></tr></thead><tbody>'+capRows+"</tbody></table></details>"+
    "<details><summary>How to read this</summary><ul class=notes>"+howto+"</ul>"+
      "<ul class=notes>"+notes+"</ul></details>"+
    "<details><summary>Provenance &amp; confidence caveats</summary><ul class=notes>"+prov+"</ul></details>";
}

// The software table is static — no filters, and its Needs chips are inert so a click
// there can never silently re-filter the game table above it.
function needsCellStatic(r){
  if(!r.needs.length) return '<span class="dash">—</span>';
  return sortedNeeds(r).map(id=>{
    const c=CAP[id];
    return '<span class="needchip static" title="'+esc(TIER[c.tier].label)+'">'+
           '<span class="tdot '+statusOfTier(c.tier)+'"></span>'+esc(c.name)+"</span>";
  }).join("");
}
function softwareSection(){
  if(!DATA.software || !DATA.software.length) return "";
  const intro=(DATA.softwareIntro?DATA.softwareIntro.blurb:[]).map(p=>"<p class=purpose>"+md(p)+"</p>").join("");
  const sum=DATA.verdicts.map(v=>{
    const n=D.software.summary[v.id]||0;
    return n ? '<span class="verd '+v.status+'">'+v.glyph+" "+n+" "+esc(v.label)+"</span>" : "";
  }).filter(Boolean).join(" ");
  const head="<thead><tr><th class=c>#</th><th>Software</th><th>Kind</th><th>Archetype</th>"+
    '<th class=c>Buildable?</th><th>Needs</th><th class=c>Diff</th><th>Conf</th></tr></thead>';
  const rows=DATA.software.map(s=>{
    const meta=s.year ? " ("+s.year+(s.publisher?", "+esc(s.publisher):"")+")" : "";
    const c=CMAP[s.conf];
    const main='<tr class="softhead"><td class="num">'+s.n+"</td>"+
      "<td><span class=gtitle>"+esc(s.title)+'</span> <span class=gmeta>'+meta+"</span></td>"+
      "<td>"+esc(s.category)+"</td>"+
      '<td class="arch">'+esc(s.archetype)+"</td>"+
      '<td class="c">'+verdictCell(s)+"</td>"+
      "<td>"+needsCellStatic(s)+"</td>"+
      '<td class="c diff">'+s.diff+"</td>"+
      '<td class="conf"><span class="cdot '+s.conf+'"></span>'+esc(c.label)+"</td></tr>";
    const note=s.note ? '<tr class="softnote"><td></td><td colspan="7">'+md(s.note)+"</td></tr>" : "";
    return main+note;
  }).join("");
  // Ranked by how many of these entries wait on each capability — a different order
  // from the game board above, which is the finding this section exists to show.
  const ranked=DATA.capabilities
    .map(c=>({c,n:D.software.unlock[c.id]||0}))
    .filter(x=>x.n>0)
    .sort((a,b)=>b.n-a.n);
  const strip=ranked.map(({c,n})=>
    '<span class="capchip static t-'+c.tier+'" title="'+esc(TIER[c.tier].label)+'">'+
    '<span class="tdot '+statusOfTier(c.tier)+'"></span>'+esc(c.name)+
    '<span class="n">'+n+"</span></span>").join("");
  const title=(DATA.softwareIntro&&DATA.softwareIntro.title)||"Non-game software";
  return "<h2>"+esc(title)+"</h2>"+intro+
    '<div class="board"><div class="tiergroup"><div class="tiername">Waiting on'+
      "<small>of these "+D.software.total+" entries</small></div>"+
      '<div class="capchips">'+strip+"</div></div></div>"+
    '<p class="softsum">'+sum+"</p>"+
    '<div class="tablewrap"><table>'+head+"<tbody>"+rows+"</tbody></table></div>";
}

function render(){
  const app=document.getElementById("app");
  const purpose=DATA.intro.purpose.map(p=>"<p class=purpose>"+md(p)+"</p>").join("");
  app.innerHTML=
    '<div class="topbar"><div><h1>'+esc(DATA.meta.title)+"</h1>"+
      '<p class="sub">Last updated '+esc(DATA.meta.lastUpdated)+
      " · refresh with <code>"+esc(DATA.meta.refreshWith)+"</code></p></div>"+
      '<button class="themebtn" id="theme">◐ Theme</button></div>'+
    purpose+
    '<h2>At a glance</h2>'+bars()+
    '<h2>Capability status <span class="gmeta">— the lever: ship one, everything waiting on it moves</span></h2>'+board()+
    '<h2>The matrix</h2>'+controls()+
    '<div class="tablewrap"><table>'+refHead()+'<tbody id="tbody"></tbody></table></div>'+
    softwareSection()+
    refTables()+
    '<p class="foot">'+md(DATA.footer)+"</p>";
  app.removeAttribute("aria-busy");
  wire();
  renderTable();
}
function refHead(){
  const cols=[["n","#",1],["title","Game"],["category","Cat"],["archetype","Archetype"],
    ["verdict","Buildable?",1],["needs","Needs",1],["diff","Diff",1],["conf","Conf",1]];
  return "<thead><tr>"+cols.map(([k,l,c])=>
    '<th class="'+(c?"c":"")+'"><button data-key="'+k+'">'+esc(l)+' <span class="arw"></span></button></th>').join("")+"</tr></thead>";
}

function wire(){
  document.getElementById("q").addEventListener("input", e=>{state.q=e.target.value.trim().toLowerCase();renderTable();});
  document.getElementById("cat").addEventListener("change", e=>{state.cat=e.target.value;renderTable();});
  document.getElementById("reset").addEventListener("click", ()=>{
    state.q="";state.cat="all";state.verdicts.clear();state.caps.clear();
    document.getElementById("q").value="";document.getElementById("cat").value="all";
    syncVerdictChips();refreshBarsBoard();renderTable();
  });
  document.querySelectorAll("[data-verdict]").forEach(b=>b.addEventListener("click", ()=>{
    toggle(state.verdicts,b.dataset.verdict);syncVerdictChips();renderTable();
  }));
  document.querySelectorAll("th button[data-key]").forEach(b=>b.addEventListener("click", ()=>{
    const k=b.dataset.key;
    if(state.sort.key===k) state.sort.dir*=-1; else state.sort={key:k,dir:1};
    renderTable();
  }));
  // capability toggles come from the board and from Needs chips in rows
  document.addEventListener("click", e=>{
    const el=e.target.closest("[data-cap]"); if(!el) return;
    if(el.classList.contains("t-available")) return; // available caps have nothing waiting
    toggle(state.caps, el.dataset.cap); syncCapChips(); renderTable();
  });
  document.getElementById("theme").addEventListener("click", toggleTheme);
}
function toggle(set,v){ set.has(v)?set.delete(v):set.add(v); }
function syncVerdictChips(){
  document.querySelectorAll("[data-verdict]").forEach(b=>b.classList.toggle("on", state.verdicts.has(b.dataset.verdict)));
}
function syncCapChips(){
  document.querySelectorAll("[data-cap]").forEach(el=>el.classList.toggle("on", state.caps.has(el.dataset.cap)));
}
function refreshBarsBoard(){
  document.querySelector(".bars").outerHTML=bars();
  document.querySelector(".board").outerHTML=board();
}
function toggleTheme(){
  const root=document.documentElement;
  const dark=root.getAttribute("data-theme")==="dark" ||
    (!root.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
  root.setAttribute("data-theme", dark?"light":"dark");
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
console.log(`✓ ${derived.total} games validated.`);
console.log(`  Buildable:  ${s.now} Now   ${s.soon} Soon   ${s.blocked} Blocked`);
if (derived.software) {
  const w = derived.software.summary;
  console.log(`✓ ${derived.software.total} non-game software entries validated (excluded from the tallies above).`);
  console.log(`  Buildable:  ${w.now} Now   ${w.soon} Soon   ${w.blocked} Blocked`);
}
console.log('  unlock (titles waiting per capability): ' +
  data.capabilities.map((c) => `${c.id}=${derived.unlock[c.id]}`).join('  '));

if (CHECK_ONLY) {
  console.log('— --check: no file written.');
  process.exit(0);
}

writeFileSync(OUT, buildHtml(payload), 'utf8');
console.log(`→ wrote ${OUT}`);

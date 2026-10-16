// Saudade Manager — Guild RWPH Tracker
// Polls 7 Saudade guilds every 1s in parallel
// Tracks per-player: season wave (score), hourly RWPH + gain, jumps, past seasons (max 30)
const fs = require('fs');
const { execSync } = require('child_process');

const GUILDS = [
  { id: 'SD', api: 'Saudade' },
  { id: 'SD2', api: 'Saudade 2' },
  { id: 'SD3', api: 'Saudade 3' },
  { id: 'SD4', api: 'Saudade 4' },
  { id: 'SD5', api: 'Saudade 5' },
  { id: 'SD6', api: 'Saudade 6' },
  { id: 'SD7', api: 'Saudade 7' },
];

const RUN_MS = (Number(process.env.RUN_MINUTES) || 345) * 60 * 1000;
const HANDOFF_AT = Number(process.env.HANDOFF_AT) || 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const COMMIT_EVERY_MS = 1 * 60 * 1000;
const MAX_HOURS = 24;
const MAX_PAST = 30;
const JUMP_MIN = 10;
const STATE = 'data/state.json';

const newJumps = () => ({ total: 0, j10: 0, j20: 0, j30: 0, hours: {} });
const tierOf = (d) => (d >= 30 ? 30 : d >= 20 ? 20 : 10);

let state = {
  season: { start: null, end: null },
  players: {},
  updated: 0,
};

const load = () => {
  try {
    state = { ...state, ...JSON.parse(fs.readFileSync(STATE, 'utf8')) };
  } catch {}
  state.season ??= { start: null, end: null };
  state.players ??= {};
};

load();

const kst = (ms) => new Date(ms + 9 * 3600e3).toISOString();
const hourKey = (ms) => kst(ms).slice(0, 13);

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Saudade Manager</title>
<style>
:root{
  --bg:#0b0f14;--card:#12181f;--line:#243040;--text:#e8eef6;--sub:#8b9bb0;
  --acc:#5b9fd4;--hot:#f0a060;--ok:#3ecf8e;--danger:#e05c5c;
  --sd:#5b9fd4;--sd2:#7c6cf0;--sd3:#e07a5f;--sd4:#3ecf8e;--sd5:#f0c050;--sd6:#e05ca8;--sd7:#6ecfcf
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:radial-gradient(900px 500px at 5% -5%,#1a2a40 0,transparent 55%),var(--bg);color:var(--text);font:14px/1.5 -apple-system,"Segoe UI",Roboto,"Noto Sans",sans-serif;font-variant-numeric:tabular-nums}
.wrap{max-width:1100px;margin:0 auto;padding:20px 14px 56px;padding-left:max(14px,env(safe-area-inset-left));padding-right:max(14px,env(safe-area-inset-right));padding-bottom:max(56px,env(safe-area-inset-bottom))}
header{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 14px;margin-bottom:6px}
h1{margin:0;font-size:24px;letter-spacing:.4px}
h1 span{color:var(--acc);font-weight:600}
.sub{color:var(--sub);font-size:13px;margin:0 0 16px;word-break:keep-all}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.card .l{color:var(--sub);font-size:11px;text-transform:uppercase;letter-spacing:.4px}
.card .v{font-size:20px;font-weight:700;margin-top:2px}
.filters{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;align-items:center}
.filters input,.filters select{background:#0d131a;border:1px solid var(--line);color:var(--text);border-radius:8px;padding:8px 10px;font-size:13px;outline:none}
.filters input:focus,.filters select:focus{border-color:var(--acc)}
.filters input[type=text]{flex:1;min-width:120px}
.filters input[type=number]{width:90px}
.filters label{color:var(--sub);font-size:12px;display:flex;align-items:center;gap:4px}
.guild-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.gtab{padding:6px 12px;border-radius:20px;border:1px solid var(--line);background:#0d131a;color:var(--sub);cursor:pointer;font-size:12px;font-weight:600;transition:.15s}
.gtab:hover{border-color:var(--acc);color:var(--text)}
.gtab.on{background:var(--acc);border-color:var(--acc);color:#041018}
.gtab[data-g=SD].on{background:var(--sd)}.gtab[data-g=SD2].on{background:var(--sd2)}.gtab[data-g=SD3].on{background:var(--sd3)}
.gtab[data-g=SD4].on{background:var(--sd4)}.gtab[data-g=SD5].on{background:var(--sd5)}.gtab[data-g=SD6].on{background:var(--sd6)}.gtab[data-g=SD7].on{background:var(--sd7)}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{width:100%;border-collapse:collapse;min-width:640px}
th,td{padding:9px 10px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}
th{color:var(--sub);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.3px;position:sticky;top:0;background:var(--card);z-index:1}
td.n,th.n{text-align:right}
tr:hover td{background:#16202c}
tr.detail td{background:#0e141c;color:var(--sub);font-size:12px;white-space:normal}
.badge{display:inline-block;padding:1px 7px;border-radius:6px;font-size:10px;font-weight:700;margin-left:6px;vertical-align:middle}
.badge.g-SD{background:var(--sd);color:#041018}.badge.g-SD2{background:var(--sd2);color:#fff}
.badge.g-SD3{background:var(--sd3);color:#1a0a00}.badge.g-SD4{background:var(--sd4);color:#041810}
.badge.g-SD5{background:var(--sd5);color:#1a1200}.badge.g-SD6{background:var(--sd6);color:#1a0410}
.badge.g-SD7{background:var(--sd7);color:#041818}
.jbtn{display:inline-block;cursor:pointer;color:var(--hot);font-weight:700;border-radius:6px;padding:2px 8px;border:1px solid #5b3a1e;background:#2a1c10;font-size:12px}
.jbtn:hover{border-color:var(--hot)}
.jnone{color:var(--sub)}
.name{font-weight:600;cursor:pointer}
.name:hover{color:var(--acc)}
.panel{display:none;margin:12px 0;padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--card)}
.panel.open{display:block}
.panel h3{margin:0 0 8px;font-size:15px}
.tiers{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
.tier{flex:1;min-width:90px;text-align:center;border:1px solid var(--line);border-radius:10px;padding:8px;background:#0d131a}
.tier b{display:block;font-size:18px;color:var(--hot)}
.tier span{color:var(--sub);font-size:11px}
.hour-table{width:100%;min-width:0;margin-top:8px}
.hour-table th,.hour-table td{padding:6px 8px;font-size:12px}
.empty{color:var(--sub);text-align:center;padding:28px;font-size:14px}
.foot{color:var(--sub);font-size:11px;margin-top:20px;text-align:center}
.sort{cursor:pointer;user-select:none}
.sort:after{content:'';opacity:.4;margin-left:3px}
.sort.asc:after{content:'▲';opacity:1}
.sort.desc:after{content:'▼';opacity:1}
@media(max-width:700px){
  body{font-size:13px}
  h1{font-size:20px}
  .stats{grid-template-columns:1fr 1fr;gap:8px}
  .card .v{font-size:17px}
  .filters{gap:6px}
  .filters input[type=number]{width:72px}
  th,td{padding:8px 6px}
  table{min-width:560px}
  .gtab{padding:5px 10px;font-size:11px}
}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Saudade <span>Manager</span></h1>
  </header>
  <div class="sub" id="sub"></div>
  <div class="stats" id="stats"></div>
  <div class="guild-tabs" id="guildTabs"></div>
  <div class="filters">
    <input type="text" id="q" placeholder="Search name…">
    <label>Min wave <input type="number" id="minWave" min="0" placeholder="0"></label>
    <label>Min jumps <input type="number" id="minJump" min="0" placeholder="0"></label>
    <select id="sort">
      <option value="score-desc">Wave ↓</option>
      <option value="score-asc">Wave ↑</option>
      <option value="jumps-desc">Jumps ↓</option>
      <option value="jumps-asc">Jumps ↑</option>
      <option value="rwph-desc">24h RWPH ↓</option>
      <option value="gain-desc">24h Gain ↓</option>
      <option value="name-asc">Name A–Z</option>
    </select>
  </div>
  <div class="card scroll">
    <table>
      <thead>
        <tr>
          <th class="sort" data-s="name">Player</th>
          <th>Guild</th>
          <th class="n sort" data-s="score">Season Wave</th>
          <th class="n sort" data-s="rwph">24h RWPH</th>
          <th class="n sort" data-s="gain">24h Gain</th>
          <th class="n sort" data-s="jumps">Season Jumps</th>
        </tr>
      </thead>
      <tbody id="rows"></tbody>
    </table>
    <div class="empty" id="empty" style="display:none">No players match filters</div>
  </div>
  <div class="panel" id="detailPanel">
    <h3 id="detailTitle"></h3>
    <div class="tiers" id="detailTiers"></div>
    <div class="scroll"><table class="hour-table">
      <thead><tr><th>Hour (KST)</th><th class="n">RWPH</th><th class="n">Gain</th><th class="n">Jumps</th></tr></thead>
      <tbody id="detailHours"></tbody>
    </table></div>
    <div id="detailPastWrap" style="display:none;margin-top:14px">
      <h3 style="font-size:13px;margin-bottom:6px">Past Seasons (last 30)</h3>
      <div class="scroll"><table class="hour-table">
        <thead><tr><th>Season (KST)</th><th class="n">Final Wave</th><th class="n">Jumps</th></tr></thead>
        <tbody id="detailPast"></tbody>
      </table></div>
    </div>
    <div style="margin-top:10px;text-align:right"><button id="closeDetail" style="background:#1a2430;border:1px solid var(--line);color:var(--text);padding:6px 14px;border-radius:8px;cursor:pointer">Close</button></div>
  </div>
  <div class="foot">Saudade Manager · Made by ReynRule</div>
</div>
<script>
var D = /*DATA*/null;
var $ = function(id){return document.getElementById(id)};
var nf = function(n){return Number(n||0).toLocaleString('en-US')};
var kst = function(ms){return new Date(ms+9*3600e3).toISOString()};
var fmt = function(ms){return kst(ms).replace('T',' ').slice(0,16)};
var labelH = function(k){var hh=Number(k.slice(11,13));return k.slice(5,10)+' '+k.slice(11,13)+':00–'+String((hh+1)%24).padStart(2,'0')+':00'};
var GUILD_IDS = ['SD','SD2','SD3','SD4','SD5','SD6','SD7'];
var activeGuild = 'ALL';
var selected = null;
var lastUpdated = (D && D.updated) || 0;

function playerList(){
  return Object.keys(D.players||{}).map(function(name){
    var p = D.players[name];
    var keys = Object.keys(p.hours||{}).sort().slice(-24);
    var rwph = keys.reduce(function(s,k){return s+(p.hours[k].count||0)},0);
    var gain = keys.reduce(function(s,k){return s+(p.hours[k].gain||0)},0);
    return {
      name: name,
      guild: p.guild||'?',
      score: p.lastScore||0,
      rwph: rwph,
      gain: gain,
      jumps: (p.jumps&&p.jumps.total)||0,
      j10: (p.jumps&&p.jumps.j10)||0,
      j20: (p.jumps&&p.jumps.j20)||0,
      j30: (p.jumps&&p.jumps.j30)||0,
      hours: p.hours||{},
      jumpHours: (p.jumps&&p.jumps.hours)||{},
      past: p.past||[]
    };
  });
}

function renderStats(list){
  var total = list.length;
  var jumps = list.reduce(function(s,p){return s+p.jumps},0);
  var waves = list.reduce(function(s,p){return s+p.score},0);
  var byG = {};
  GUILD_IDS.forEach(function(g){byG[g]=0});
  list.forEach(function(p){if(byG[p.guild]!=null)byG[p.guild]++});
  var ss = D.season&&D.season.start ? new Date(D.season.start+'Z').getTime() : null;
  var se = D.season&&D.season.end ? new Date(D.season.end+'Z').getTime() : null;
  $('sub').textContent = (ss ? 'Season '+fmt(ss)+' ~ '+fmt(se)+' (KST)' : 'No season data')
    + (D.updated ? '  ·  Updated '+kst(D.updated).replace('T',' ').slice(5,19)+' KST' : '');
  $('stats').innerHTML = [
    ['Players', nf(total)],
    ['Total Waves', nf(waves)],
    ['Season Jumps', nf(jumps)],
    ['Guilds', GUILD_IDS.filter(function(g){return byG[g]>0}).length+'/7']
  ].map(function(c){return '<div class="card"><div class="l">'+c[0]+'</div><div class="v">'+c[1]+'</div></div>'}).join('');
}

function renderTabs(){
  var html = '<div class="gtab'+(activeGuild==='ALL'?' on':'')+'" data-g="ALL">All</div>';
  GUILD_IDS.forEach(function(g){
    html += '<div class="gtab'+(activeGuild===g?' on':'')+'" data-g="'+g+'">'+g+'</div>';
  });
  $('guildTabs').innerHTML = html;
  Array.from($('guildTabs').children).forEach(function(el){
    el.onclick = function(){activeGuild=el.getAttribute('data-g');render();};
  });
}

function filtered(){
  var q = ($('q').value||'').trim().toLowerCase();
  var minW = Number($('minWave').value)||0;
  var minJ = Number($('minJump').value)||0;
  var sort = ($('sort').value||'score-desc').split('-');
  var key = sort[0], dir = sort[1]==='asc'?1:-1;
  var list = playerList().filter(function(p){
    if(activeGuild!=='ALL' && p.guild!==activeGuild) return false;
    if(q && p.name.toLowerCase().indexOf(q)<0) return false;
    if(p.score < minW) return false;
    if(p.jumps < minJ) return false;
    return true;
  });
  list.sort(function(a,b){
    var av=a[key], bv=b[key];
    if(typeof av==='string') return dir*(av.localeCompare(bv));
    return dir*((av||0)-(bv||0));
  });
  return list;
}

function openDetail(p){
  selected = p.name;
  $('detailPanel').classList.add('open');
  $('detailTitle').textContent = p.name + ' · ' + p.guild;
  $('detailTiers').innerHTML = [
    ['10 Jump (10–12)', p.j10],
    ['20 Jump (20–22)', p.j20],
    ['30 Jump (30–32)', p.j30],
    ['Total', p.jumps]
  ].map(function(t){return '<div class="tier"><b>'+nf(t[1])+'</b><span>'+t[0]+'</span></div>'}).join('');
  var keys = Object.keys(p.hours).sort().reverse().slice(0,24);
  $('detailHours').innerHTML = keys.length ? keys.map(function(k){
    var h=p.hours[k]||{count:0,gain:0};
    var jh=p.jumpHours[k]||{j10:0,j20:0,j30:0};
    var jt=(jh.j10||0)+(jh.j20||0)+(jh.j30||0);
    return '<tr><td>'+labelH(k)+'</td><td class="n">'+nf(h.count)+'</td><td class="n">+'+nf(h.gain)+'</td><td class="n">'+(jt?jt:'-')+'</td></tr>';
  }).join('') : '<tr><td colspan="4" class="jnone">No hourly data yet</td></tr>';
  var past = (p.past||[]).slice().reverse();
  if(past.length){
    $('detailPastWrap').style.display='';
    $('detailPast').innerHTML = past.map(function(s){
      var a=s.start?fmt(new Date(s.start+'Z').getTime()):'?';
      var b=s.end?fmt(new Date(s.end+'Z').getTime()):'?';
      return '<tr><td>'+a+' ~ '+b+'</td><td class="n">'+nf(s.wave||0)+'</td><td class="n">'+nf(s.total||0)+'</td></tr>';
    }).join('');
  } else {
    $('detailPastWrap').style.display='none';
  }
}

function render(){
  renderTabs();
  var list = filtered();
  renderStats(playerList());
  var tb = $('rows');
  tb.innerHTML = '';
  if(!list.length){
    $('empty').style.display='';
  } else {
    $('empty').style.display='none';
    list.forEach(function(p){
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><span class="name">'+p.name+'</span></td>'
        +'<td><span class="badge g-'+p.guild+'">'+p.guild+'</span></td>'
        +'<td class="n">'+nf(p.score)+'</td>'
        +'<td class="n">'+nf(p.rwph)+'</td>'
        +'<td class="n">+'+nf(p.gain)+'</td>'
        +'<td class="n">'+(p.jumps?'<span class="jbtn">'+nf(p.jumps)+'</span>':'<span class="jnone">-</span>')+'</td>';
      tr.querySelector('.name').onclick = function(){openDetail(p)};
      var jb = tr.querySelector('.jbtn');
      if(jb) jb.onclick = function(e){e.stopPropagation();openDetail(p)};
      tb.appendChild(tr);
    });
  }
  if(selected && D.players && D.players[selected]){
    var pl = playerList().filter(function(x){return x.name===selected})[0];
    if(pl) openDetail(pl);
  } else if(selected && !(D.players && D.players[selected])){
    selected = null;
    $('detailPanel').classList.remove('open');
  }
}

function refreshData(){
  fetch('data/state.json?t='+Date.now(), {cache:'no-store'})
    .then(function(r){if(!r.ok) throw new Error(r.status); return r.json();})
    .then(function(json){
      if(!json || !json.players) return;
      if((json.updated||0) <= lastUpdated) return;
      lastUpdated = json.updated||0;
      D = json;
      render();
    })
    .catch(function(){});
}

$('q').oninput = render;
$('minWave').oninput = render;
$('minJump').oninput = render;
$('sort').onchange = render;
$('closeDetail').onclick = function(){$('detailPanel').classList.remove('open');selected=null};
Array.from(document.querySelectorAll('th.sort')).forEach(function(th){
  th.onclick = function(){
    var s = th.getAttribute('data-s');
    var cur = $('sort').value;
    if(cur===s+'-desc') $('sort').value=s+'-asc';
    else $('sort').value=s+'-desc';
    render();
  };
});
render();
setInterval(refreshData, 30000);
</script>
</body>
</html>
`;

function render() {
  const data = JSON.stringify({
    season: state.season,
    updated: Date.now(),
    players: state.players,
  }).replace(/</g, '\\u003c');
  fs.writeFileSync('index.html', HTML_TEMPLATE.replace('/*DATA*/null', () => data));
}

function pruneHours(hours) {
  const keys = Object.keys(hours || {}).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_HOURS))) {
    delete hours[k];
  }
}

function save() {
  state.updated = Date.now();
  for (const name of Object.keys(state.players)) {
    const p = state.players[name];
    pruneHours(p.hours);
    if (p.jumps && p.jumps.hours) pruneHours(p.jumps.hours);
  }
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
  render();
}

function commit() {
  save();
  try {
    execSync('git add index.html data/state.json');
    if (!execSync('git status --porcelain').toString().trim()) return;
    execSync('git commit -m "chore: update saudade manager [skip ci]"');
    try {
      execSync('git pull --rebase --autostash', { stdio: 'ignore' });
    } catch {}
    execSync('git push', { stdio: 'ignore' });
    console.log('committed', new Date().toISOString());
  } catch (e) {
    console.error('commit failed', e.message);
  }
}

async function fetchGuild(g) {
  const url = `https://raongames.com/growcastle/restapi/season/now/guilds/${encodeURIComponent(g.api)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${g.id}`);
  return res.json();
}

async function tick() {
  try {
    const results = await Promise.all(
      GUILDS.map(async (g) => {
        try {
          const json = await fetchGuild(g);
          return { g, json };
        } catch (e) {
          console.error('fetch fail', g.id, e.message);
          return { g, json: null };
        }
      })
    );

    const seen = new Set();
    let seasonDate = null;

    for (const { g, json } of results) {
      if (!json?.result?.list) continue;
      const sd = json.result.date;
      if (sd?.start && sd?.end) seasonDate = sd;

      for (const m of json.result.list) {
        const name = m.name;
        if (!name) continue;
        seen.add(name);
        const score = Number(m.score) || 0;
        let p = state.players[name];
        if (!p) {
          p = state.players[name] = {
            guild: g.id,
            lastScore: null,
            hours: {},
            jumps: newJumps(),
            past: [],
          };
        }
        p.guild = g.id;

        const k = hourKey(Date.now());
        if (p.lastScore != null && score > p.lastScore) {
          const diff = score - p.lastScore;
          const h = (p.hours[k] ??= { count: 0, gain: 0 });
          h.count += 1;
          h.gain += diff;
          if (diff >= JUMP_MIN) {
            const t = tierOf(diff);
            const jh = (p.jumps.hours[k] ??= { j10: 0, j20: 0, j30: 0 });
            jh['j' + t] += 1;
            p.jumps['j' + t] += 1;
            p.jumps.total += 1;
            console.log(`JUMP ${name} +${diff} (${t})`, new Date().toISOString());
          }
        }
        p.hours[k] ??= { count: 0, gain: 0 };
        p.lastScore = score;
      }
    }

    // Season change: archive jumps + final wave, reset
    if (
      seasonDate?.start &&
      seasonDate?.end &&
      (state.season.start !== seasonDate.start || state.season.end !== seasonDate.end)
    ) {
      if (state.season.start) {
        console.log('season changed', state.season, '->', seasonDate);
        for (const name of Object.keys(state.players)) {
          const p = state.players[name];
          p.past = p.past || [];
          p.past.push({
            start: state.season.start,
            end: state.season.end,
            total: (p.jumps && p.jumps.total) || 0,
            wave: p.lastScore || 0,
          });
          p.past = p.past.slice(-MAX_PAST);
          p.jumps = newJumps();
          p.hours = {};
          p.lastScore = null;
        }
      }
      state.season = { start: seasonDate.start, end: seasonDate.end };
    }

    // Remove players no longer in any guild
    for (const name of Object.keys(state.players)) {
      if (!seen.has(name)) {
        console.log('remove player', name);
        delete state.players[name];
      }
    }
  } catch (e) {
    console.error('tick error', e.message);
  }
}

function dispatchNext(at) {
  try {
    execSync(
      `gh workflow run rwph.yml --ref ${process.env.GITHUB_REF_NAME || 'main'} -f handoff_at=${at}`,
      { stdio: 'inherit' }
    );
    console.log('next run dispatched, handoff at', new Date(at).toISOString());
  } catch (e) {
    console.error('dispatch failed (cron backup will recover)', e.message);
  }
}

(async () => {
  if (!HANDOFF_AT && Date.now() - (state.updated || 0) < 10 * 60 * 1000) {
    console.log('Another job is already running — exiting.');
    return;
  }

  let start = Date.now();
  if (HANDOFF_AT) {
    start = HANDOFF_AT;
    await sleep(Math.max(0, HANDOFF_AT - Date.now()));
    for (let i = 0; i < 40; i++) {
      try {
        execSync('git pull --rebase --autostash', { stdio: 'ignore' });
        load();
      } catch {}
      if ((state.updated || 0) >= HANDOFF_AT - 2000) break;
      await sleep(1000);
    }
  }

  const end = start + RUN_MS;
  let lastCommit = Date.now();
  let next = Date.now();
  let dispatched = false;

  // Initial tick + save so index.html exists immediately
  await tick();
  save();

  while (Date.now() < end) {
    await tick();
    if (!dispatched && process.env.GITHUB_ACTIONS && Date.now() >= end - 120000) {
      dispatched = true;
      dispatchNext(end);
    }
    if (Date.now() - lastCommit >= COMMIT_EVERY_MS) {
      commit();
      lastCommit = Date.now();
    }
    next += 1000;
    await sleep(Math.max(0, next - Date.now()));
  }
  commit();
})();

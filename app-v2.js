(()=>{
'use strict';
const categories=window.REVIEW_INSIGHTS||[];
const state={category:0,month:'全部时间',shop:'全部店铺',theme:0};
const cache={},loads=new Map();
const manifest=window.REVIEW_MANIFEST;
const fmt=n=>Number(n||0).toLocaleString('zh-CN');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const current=()=>categories[state.category];
const data=()=>cache[current().name]||{shops:[],segments:{}};
const segment=(month=state.month,shop=state.shop)=>data().segments[`${month}|${shop}`]||data().segments[`${month}|全部店铺`]||data().segments['全部时间|全部店铺'];
const terms=(items,fallback='当前范围未形成集中信号')=>items?.length?items.map(x=>x[0]).join('、'):fallback;
const icon={people:'🧑‍🤝‍🧑',scenes:'🏠',purposes:'🎯'};
const funIcon={购买任务:'🛒',认可表达:'✨',场景与人群:'🧭'};
const ring=(value,label,tone='blue')=>`<div class="mini-ring ${tone}" style="--pct:${Math.max(0,Math.min(100,Number(value)||0))}"><div><b>${value}%</b><small>${label}</small></div></div>`;
async function load(c){
  if(cache[c.name])return;
  if(loads.has(c.name))return loads.get(c.name);
  const file=manifest?.categories?.[c.name];
  if(!file)throw new Error(`缺少${c.name}数据映射`);
  const task=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=`data/${file}`;s.onload=()=>{const p=window.REVIEW_CATEGORY_DATA?.[c.name];s.remove();if(!p)return reject(new Error(`${c.name}数据无效`));cache[c.name]=p;delete window.REVIEW_CATEGORY_DATA[c.name];resolve()};s.onerror=()=>{s.remove();reject(new Error(`${c.name}数据加载失败`))};document.head.appendChild(s)}).finally(()=>loads.delete(c.name));
  loads.set(c.name,task);return task;
}
function sidebar(){
  const d=data(),months=['全部时间',...(manifest?.months||[]).slice().reverse()];
  const shops=['全部店铺',...d.shops.filter(x=>d.segments[`${state.month}|${x}`])];
  if(!shops.includes(state.shop))state.shop='全部店铺';
  document.getElementById('sidebarFilters').innerHTML=`<div class="side-filter"><label for="timeSelect">时间</label><select id="timeSelect">${months.map(x=>`<option ${x===state.month?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="side-filter"><label for="shopSelect">子品牌 / 店铺</label><select id="shopSelect">${shops.map(x=>`<option ${x===state.shop?'selected':''}>${esc(x)}</option>`).join('')}</select></div>`;
  document.getElementById('categoryList').innerHTML=categories.map((c,i)=>`<button class="cat-button" data-i="${i}" aria-current="${i===state.category}"><span>${esc(c.name)}</span><small>${fmt(c.unique)}</small></button>`).join('');
  document.getElementById('timeSelect').onchange=e=>{state.month=e.target.value;state.shop='全部店铺';state.theme=0;render()};
  document.getElementById('shopSelect').onchange=e=>{state.shop=e.target.value;state.theme=0;render()};
  document.querySelectorAll('.cat-button').forEach(b=>b.onclick=async()=>{state.category=+b.dataset.i;state.month='全部时间';state.shop='全部店铺';state.theme=0;loading();try{await load(current());render()}catch(e){failure(e.message)}});
}
function tags(title,copy,tone){const parts=copy.split('；').map(x=>x.trim()).filter(Boolean),tagSource=parts.shift()||'',note=parts.join('；');return `<div class="tag-group ${tone}"><b><i>${funIcon[title]}</i>${title}</b><div>${tagSource.split(/[，、]/).filter(Boolean).slice(0,7).map(x=>`<span>${esc(x.trim())}</span>`).join('')}</div>${note?`<p class="tag-insight"><i>💡</i>${esc(note)}</p>`:''}</div>`}
function purposePie(items){if(!items?.length)return '<div class="empty-evidence">当前筛选未形成明确购买目的</div>';const colors=['#3478f6','#8b5cf6','#18a77b','#f5a623','#ef5b5b','#25a4c4'],total=items.reduce((a,x)=>a+x[1],0)||1;let cursor=0;const stops=items.map((x,i)=>{const start=cursor,end=cursor+x[1]/total*100;cursor=end;return `${colors[i%colors.length]} ${start}% ${end}%`}).join(',');return `<div class="purpose-pie-wrap"><div class="purpose-pie" style="background:conic-gradient(${stops})"><div><b>${fmt(total)}</b><small>目的命中次数</small></div></div><div class="purpose-legend">${items.map((x,i)=>`<div><i style="background:${colors[i%colors.length]}"></i><span>${esc(x[0])}</span><b>${x[2]}%</b><small>${fmt(x[1])}条</small></div>`).join('')}</div></div><p class="pie-note">扇区表示各购买目的在全部目的命中中的构成；右侧百分比仍为评论提及率。</p>`}
function themePanel(c,s){
  const list=c.themes.map((t,i)=>{const d=s.themes?.[t[0]]||{};return `<button class="theme-tab" data-i="${i}" aria-current="${i===state.theme}"><span class="theme-number">${i+1}</span><span class="theme-copy"><b>${esc(t[0])}</b><i><u style="width:${Math.min(100,d.rate||0)*2}%"></u></i></span><span>${d.rate||0}%<small>${fmt(d.count)}条</small></span></button>`}).join('');
  const name=c.themes[state.theme]?.[0],d=s.themes?.[name];
  const quotes=d?.quotes?.length?d.quotes.map(q=>`<blockquote><p>“${esc(q.text)}”</p><footer>${esc(q.shop)} · ${esc(q.month)}</footer></blockquote>`).join(''):'<div class="empty-evidence">当前筛选暂无足够代表评论</div>';
  const summary=d?.summary||'当前筛选范围无明确主题信号。',split=summary.indexOf('属于'),intro=split>=0?summary.slice(0,split):summary,focus=split>=0?summary.slice(split):'';
  return `<section class="card theme-wide"><div class="section-head"><div><h2>类目主题画像</h2><p>选择左侧主题，右侧查看结论与原评证据</p></div><span>去重文本口径</span></div><div class="theme-split"><div class="theme-menu">${list}</div><div class="theme-detail"><div class="theme-detail-title"><h3>${esc(name)}</h3><b>${d?.rate||0}%</b></div><p class="theme-explain"><span>${esc(intro)}</span>${focus?`<strong>${esc(focus)}</strong>`:''}</p><div class="evidence-label">代表评论</div><div class="theme-quotes">${quotes}</div></div></div></section>`
}
function keywordCloud(s){const max=Math.max(1,...(s.keywords||[]).map(x=>x[1]));return `<div class="bubble-cloud">${(s.keywords||[]).map((x,i)=>{const size=72+Math.round(x[1]/max*62);return `<span style="--size:${size}px;--h:${(i*47+205)%360}"><b>${esc(x[0])}</b><small>${x[2]}%</small></span>`}).join('')}</div>`}
function problems(s,all){
  const currentProblems=s.problems||[],base=new Map((all?.problems||[]).map(x=>[x.title,x.rate]));
  if(!currentProblems.length)return '<div class="empty-evidence">当前范围没有足够的问题证据</div>';
  return currentProblems.slice(0,4).map((p,i)=>{const delta=state.month==='全部时间'?null:Math.round((p.rate-(base.get(p.title)||0))*10)/10;const qs=p.quotes?.map(q=>`<blockquote>“${esc(q.text)}”<footer>${esc(q.shop)} · ${esc(q.month)}</footer></blockquote>`).join('')||'';return `<article class="problem-item"><div class="problem-rank">${['⚠️','🎯','🔍','🧩'][i]}</div><div class="problem-main"><div class="problem-title"><h3>${esc(p.title)}</h3><span>${fmt(p.count)}条 · ${p.rate}%${delta===null?'':` · 较全期${delta>=0?'+':''}${delta}pct`}</span></div><div class="impact-track"><i style="width:${Math.min(100,p.rate*5)}%"></i></div><div class="problem-logic"><p><b>🔍 为何发生</b>${esc(p.cause)}</p><p><b>⚡ 业务影响</b>${esc(p.impact)}</p></div>${qs}</div></article>`}).join('')
}
function brandAnalysis(c,s){
  const rows=data().shops.map(shop=>{const x=data().segments[`${state.month}|${shop}`];return x?{shop,...x}:null}).filter(Boolean);
  const rain=rows.filter(x=>x.shop.includes('雨虹')),others=rows.filter(x=>!x.shop.includes('雨虹')&&x.n>=30),weighted=(key,list)=>list.length?list.reduce((a,x)=>a+x[key]*x.n,0)/list.reduce((a,x)=>a+x.n,0):null;
  if(!rain.length)return `<section class="card brand-deep"><div class="section-head"><div><h2>品牌之间对比分析</h2><p>主分析雨虹品牌与同类其他品牌；仅使用同月、去重评论文本</p></div><span class="no-rain">当前类目无雨虹样本</span></div><p class="empty-evidence">源数据中该类目没有包含“雨虹”的店铺，避免跨类目或无样本推断。</p></section>`;
  const r=rain.reduce((a,x)=>a.n>x.n?a:x),op=weighted('positiveRate',others),or=weighted('riskRate',others),os=weighted('score',others);
  const advantage=r.positiveRate>op?`正向表达率高于其他品牌加权均值 ${(r.positiveRate-op).toFixed(1)} 个百分点`:`正向表达率低于其他品牌加权均值 ${(op-r.positiveRate).toFixed(1)} 个百分点`;
  const risk=r.riskRate<or?`风险提及率低 ${(or-r.riskRate).toFixed(1)} 个百分点`:`风险提及率高 ${(r.riskRate-or).toFixed(1)} 个百分点`;
  return `<section class="card brand-deep"><div class="section-head"><div><h2>🏆 雨虹 vs 其他品牌</h2><p>${esc(r.shop)} 对比 ${others.length} 家达到30条门槛的店铺</p></div><span class="rain-badge">★ 雨虹重点</span></div><div class="brand-race"><div><b>雨虹</b><span><i style="width:${r.score/5*100}%"></i></span><strong>${r.score.toFixed(1)}</strong></div><div><b>其他品牌</b><span><i style="width:${os/5*100}%"></i></span><strong>${os?.toFixed(1)||'—'}</strong></div></div><div class="brand-metrics"><div class="rain-card">${ring(r.positiveRate,'正向表达','green')}<span>${fmt(r.n)}条雨虹评论</span></div><div>${ring(r.riskRate,'风险信号','red')}<span>同口径文本信号</span></div><div><b>🚀 优势判断</b><p>${esc(advantage)}；认可集中在${esc(terms(r.positiveTerms))}。</p></div><div class="risk"><b>🛠️ 短板判断</b><p>${esc(risk)}；高频风险为${esc((r.problems||[]).slice(0,2).map(x=>x.title).join('、')||terms(r.negativeTerms))}。</p></div></div></section>`
}
function render(){
  sidebar();const c=current(),s=segment(),all=segment('全部时间','全部店铺');if(!s)return failure('当前筛选无可用评论');const small=s.n<30;
  const score=small?'—':`${s.score} / 5`,positive=small?'—':`${s.positiveRate}%`,risk=small?'—':`${s.riskRate}%`;
  document.getElementById('categoryDetail').innerHTML=`
  <section class="card score-strip"><div class="score-name"><span>当前类目</span><h1><i>📊</i>${esc(c.name)}</h1></div><div class="score-gauge"><span class="gauge" style="--score:${small?0:s.score/5*100}"><i></i></span><strong>${score}</strong><span>${state.shop==='全部店铺'?'类目综合':'店铺'}文本体验分</span></div><div class="metric-picto"><i>💬</i><strong>${fmt(s.n)}</strong><span>去重评论</span></div><div>${small?'<strong>—</strong>':ring(s.positiveRate,'正向表达','green')}</div><div>${small?'<strong>—</strong>':ring(s.riskRate,'风险信号','red')}</div><div class="metric-picto warning"><i>⚠️</i><strong>${risk}</strong><span>非星级差评率</span></div></section>
  ${small?'<div class="sample-warning">样本少于30条，仅展示内容证据，不计算体验分或参与品牌比较。</div>':''}
  <section class="tag-overview">${tags('购买任务',c.job,'blue')}${tags('认可表达',c.positive,'green')}${tags('场景与人群',c.scenes,'orange')}</section>
  ${themePanel(c,s)}
  <section class="triple-row"><div class="signal-card purpose-visual"><h3><i>🎯</i>购买目的提及率</h3>${purposePie(s.purposes)}</div><div class="signal-card mini-brand"><h3><i>🏁</i>品牌评分对比</h3>${data().shops.map(shop=>{const x=data().segments[`${state.month}|${shop}`];return x&&x.n>=30?{shop,...x}:null}).filter(Boolean).sort((a,b)=>b.score-a.score||b.n-a.n).map(x=>`<div class="brand-line ${x.shop.includes('雨虹')?'is-rain':''}" title="${esc(x.shop)}"><span>${x.shop.includes('雨虹')?'★ ':''}${esc(x.shop)}</span><i><u style="width:${x.score/5*100}%"></u></i><b>${x.score.toFixed(1)}</b></div>`).join('')||'<em>可比样本不足</em>'}</div><div class="signal-card persona-card"><h3><i>🗺️</i>人群 × 场景</h3><div class="persona-halves"><section><b>🧑‍🤝‍🧑 使用人群</b><div class="compact-tags">${(s.people||[]).map((x,i)=>`<span><i>${['👷','🧑‍🎨','👨‍👩‍👧','🧑‍🔧'][i%4]}</i>${esc(x[0])}<small>${x[2]}%</small></span>`).join('')||'<em>暂无明确人群</em>'}</div></section><section><b>🏠 使用场景</b><div class="compact-tags">${(s.scenes||[]).map((x,i)=>`<span><i>${['🚿','🍳','🛠️','🏡'][i%4]}</i>${esc(x[0])}<small>${x[2]}%</small></span>`).join('')||'<em>暂无明确场景</em>'}</div></section></div></div></section>
  <section class="analysis-row"><div class="card keyword-panel"><div class="section-head"><div><h2>🫧 关键词影响力</h2><p>气泡大小代表提及量，不代表满意度</p></div></div>${keywordCloud(s)}</div><div class="card co-panel"><div class="section-head"><div><h2>🔗 问题共现</h2><p>同一条评论同时命中两个主题</p></div></div>${s.co?.length?s.co.map(x=>`<div class="co-link"><div class="co-nodes"><i></i><u></u><i></i></div><b>${esc(x[0])}</b><span>${fmt(x[1])}条 · ${x[2]}%</span><p>两个体验环节常在同一次经历中出现，建议联合排查。</p></div>`).join(''):'<div class="empty-evidence">未形成稳定共现组合</div>'}</div><div class="card evolution-panel"><div class="section-head"><div><h2>📈 内容演化</h2><p>${state.month==='全部时间'?'全期问题结构':'当前月份相对全期变化'}</p></div></div>${(s.problems||[]).slice(0,4).map(p=>{const b=(all.problems||[]).find(x=>x.title===p.title)?.rate||0,d=p.rate-b;return `<div class="trend-line"><b>${esc(p.title)}</b><span class="trend-arrow ${d>0?'up':'down'}">${state.month==='全部时间'?`${p.rate}%`: `${d>=0?'↗':'↘'} ${Math.abs(d).toFixed(1)} pct`}</span><div class="trend-track"><i style="width:${Math.min(100,p.rate*5)}%"></i></div><p>${esc(p.impact)}</p></div>`}).join('')}</div></section>
  <section class="card pain-deep"><div class="section-head"><div><h2>🚨 核心痛点｜用户为什么不满</h2><p>问题簇 → 可能机制 → 业务影响 → 原评证据</p></div><span>${fmt(s.n)}条去重评论为分母</span></div>${problems(s,all)}</section>
  ${brandAnalysis(c,s)}`;
  document.querySelectorAll('.theme-tab').forEach(b=>b.onclick=()=>{state.theme=+b.dataset.i;render()});
}
function loading(){sidebar();document.getElementById('categoryDetail').innerHTML='<section class="card load-state"><div class="loader"></div><h2>正在加载评论分析数据</h2></section>'}
function failure(message){document.getElementById('categoryDetail').innerHTML=`<section class="card load-state error-state" role="alert"><div class="error-icon">!</div><h2>评论分析数据加载失败</h2><p>${esc(message)}。页面不会把加载失败显示为零值。</p><button class="retry-button" onclick="location.reload()">重新加载</button></section>`}
async function start(){try{if(window.__VOC_MANIFEST_ERROR__||!manifest?.categories)throw new Error('数据清单加载失败');loading();await load(current());render()}catch(e){failure(e.message)}document.getElementById('themeBtn').onclick=()=>{const dark=document.documentElement.dataset.theme==='dark';document.documentElement.dataset.theme=dark?'light':'dark';document.getElementById('themeBtn').textContent=dark?'深色模式':'浅色模式'}}
start();
})();

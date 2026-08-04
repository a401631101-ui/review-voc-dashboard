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
const icon={people:'人',scenes:'景',purposes:'购'};
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
function tags(title,copy,tone){return `<div class="tag-group ${tone}"><b>${title}</b><div>${copy.split(/[；，、]/).filter(Boolean).slice(0,7).map(x=>`<span>${esc(x.trim())}</span>`).join('')}</div></div>`}
function signalTags(title,key,items){return `<div class="signal-card"><h3><i>${icon[key]}</i>${title}</h3><div class="tag-cloud">${items?.length?items.map(x=>`<span><b>${esc(x[0])}</b><small>${fmt(x[1])}条 · ${x[2]}%</small></span>`).join(''):'<em>当前筛选未形成明确提及</em>'}</div></div>`}
function themePanel(c,s){
  const list=c.themes.map((t,i)=>{const d=s.themes?.[t[0]]||{};return `<button class="theme-tab" data-i="${i}" aria-current="${i===state.theme}"><b>${esc(t[0])}</b><span>${d.rate||0}% · ${fmt(d.count)}条</span></button>`}).join('');
  const name=c.themes[state.theme]?.[0],d=s.themes?.[name];
  const quotes=d?.quotes?.length?d.quotes.map(q=>`<blockquote><p>“${esc(q.text)}”</p><footer>${esc(q.shop)} · ${esc(q.month)}</footer></blockquote>`).join(''):'<div class="empty-evidence">当前筛选暂无足够代表评论</div>';
  return `<section class="card theme-wide"><div class="section-head"><div><h2>类目主题画像</h2><p>选择左侧主题，右侧查看结论与原评证据</p></div><span>去重文本口径</span></div><div class="theme-split"><div class="theme-menu">${list}</div><div class="theme-detail"><div class="theme-detail-title"><h3>${esc(name)}</h3><b>${d?.rate||0}%</b></div><p class="theme-explain">${esc(d?.summary||'当前筛选范围无明确主题信号。')}</p><div class="evidence-label">代表评论</div><div class="theme-quotes">${quotes}</div></div></div></section>`
}
function keywordCloud(s){const max=Math.max(1,...(s.keywords||[]).map(x=>x[1]));return `<div class="bubble-cloud">${(s.keywords||[]).map((x,i)=>{const size=72+Math.round(x[1]/max*62);return `<span style="--size:${size}px;--h:${(i*47+205)%360}"><b>${esc(x[0])}</b><small>${x[2]}%</small></span>`}).join('')}</div>`}
function problems(s,all){
  const currentProblems=s.problems||[],base=new Map((all?.problems||[]).map(x=>[x.title,x.rate]));
  if(!currentProblems.length)return '<div class="empty-evidence">当前范围没有足够的问题证据</div>';
  return currentProblems.slice(0,4).map((p,i)=>{const delta=state.month==='全部时间'?null:Math.round((p.rate-(base.get(p.title)||0))*10)/10;const qs=p.quotes?.map(q=>`<blockquote>“${esc(q.text)}”<footer>${esc(q.shop)} · ${esc(q.month)}</footer></blockquote>`).join('')||'';return `<article class="problem-item"><div class="problem-rank">${i+1}</div><div class="problem-main"><div class="problem-title"><h3>${esc(p.title)}</h3><span>${fmt(p.count)}条 · ${p.rate}%${delta===null?'':` · 较全期${delta>=0?'+':''}${delta}pct`}</span></div><div class="problem-logic"><p><b>为何发生</b>${esc(p.cause)}</p><p><b>业务影响</b>${esc(p.impact)}</p></div>${qs}</div></article>`}).join('')
}
function brandAnalysis(c,s){
  const rows=data().shops.map(shop=>{const x=data().segments[`${state.month}|${shop}`];return x?{shop,...x}:null}).filter(Boolean);
  const rain=rows.filter(x=>x.shop.includes('雨虹')),others=rows.filter(x=>!x.shop.includes('雨虹')&&x.n>=30),weighted=(key,list)=>list.length?list.reduce((a,x)=>a+x[key]*x.n,0)/list.reduce((a,x)=>a+x.n,0):null;
  if(!rain.length)return `<section class="card brand-deep"><div class="section-head"><div><h2>品牌之间对比分析</h2><p>主分析雨虹品牌与同类其他品牌；仅使用同月、去重评论文本</p></div><span class="no-rain">当前类目无雨虹样本</span></div><p class="empty-evidence">源数据中该类目没有包含“雨虹”的店铺，避免跨类目或无样本推断。</p></section>`;
  const r=rain.reduce((a,x)=>a.n>x.n?a:x),op=weighted('positiveRate',others),or=weighted('riskRate',others),os=weighted('score',others);
  const advantage=r.positiveRate>op?`正向表达率高于其他品牌加权均值 ${(r.positiveRate-op).toFixed(1)} 个百分点`:`正向表达率低于其他品牌加权均值 ${(op-r.positiveRate).toFixed(1)} 个百分点`;
  const risk=r.riskRate<or?`风险提及率低 ${(or-r.riskRate).toFixed(1)} 个百分点`:`风险提及率高 ${(r.riskRate-or).toFixed(1)} 个百分点`;
  return `<section class="card brand-deep"><div class="section-head"><div><h2>雨虹 vs 其他品牌</h2><p>${esc(r.shop)} 对比 ${others.length} 家达到30条门槛的店铺</p></div><span class="rain-badge">雨虹重点</span></div><div class="brand-metrics"><div class="rain-card"><b>雨虹</b><strong>${r.score.toFixed(1)}</strong><span>文本体验分 · ${fmt(r.n)}条</span></div><div><b>其他品牌加权均值</b><strong>${os?.toFixed(1)||'—'}</strong><span>${others.reduce((a,x)=>a+x.n,0).toLocaleString()}条</span></div><div><b>优势判断</b><p>${esc(advantage)}；认可集中在${esc(terms(r.positiveTerms))}。</p></div><div class="risk"><b>短板判断</b><p>${esc(risk)}；高频风险为${esc((r.problems||[]).slice(0,2).map(x=>x.title).join('、')||terms(r.negativeTerms))}。</p></div></div></section>`
}
function render(){
  sidebar();const c=current(),s=segment(),all=segment('全部时间','全部店铺');if(!s)return failure('当前筛选无可用评论');const small=s.n<30;
  const score=small?'—':`${s.score} / 5`,positive=small?'—':`${s.positiveRate}%`,risk=small?'—':`${s.riskRate}%`;
  document.getElementById('categoryDetail').innerHTML=`
  <section class="card score-strip"><div class="score-name"><span>当前类目</span><h1>${esc(c.name)}</h1></div><div><strong>${score}</strong><span>${state.shop==='全部店铺'?'类目综合':'店铺'}文本体验分</span></div><div><strong>${fmt(s.n)}</strong><span>去重评论</span></div><div><strong>${positive}</strong><span>正向表达率</span></div><div><strong>${risk}</strong><span>风险内容信号</span></div><div><strong>${risk}</strong><span>非星级差评率</span></div></section>
  ${small?'<div class="sample-warning">样本少于30条，仅展示内容证据，不计算体验分或参与品牌比较。</div>':''}
  <section class="tag-overview">${tags('购买任务',c.job,'blue')}${tags('认可表达',c.positive,'green')}${tags('场景与人群',c.scenes,'orange')}</section>
  ${themePanel(c,s)}
  <section class="triple-row">${signalTags('购买目的提及率','purposes',s.purposes)}<div class="signal-card mini-brand"><h3><i>品</i>品牌评分对比</h3>${data().shops.map(shop=>{const x=data().segments[`${state.month}|${shop}`];if(!x||x.n<30)return'';return `<div class="brand-line ${shop.includes('雨虹')?'is-rain':''}"><span>${esc(shop)}</span><b>${x.score.toFixed(1)}</b></div>`}).join('')||'<em>可比样本不足</em>'}</div><div class="signal-card"><h3><i>人</i>人群 · 场景 · 目的</h3><div class="compact-tags">${[...(s.people||[]),...(s.scenes||[]),...(s.purposes||[])].slice(0,10).map(x=>`<span>${esc(x[0])}<small>${x[2]}%</small></span>`).join('')}</div></div></section>
  <section class="analysis-row"><div class="card keyword-panel"><div class="section-head"><div><h2>关键词影响力</h2><p>气泡大小代表提及量，不代表满意度</p></div></div>${keywordCloud(s)}</div><div class="card co-panel"><div class="section-head"><div><h2>问题共现</h2><p>同一条评论同时命中两个主题</p></div></div>${s.co?.length?s.co.map(x=>`<div class="co-link"><b>${esc(x[0])}</b><span>${fmt(x[1])}条 · ${x[2]}%</span><p>说明两个体验环节常被用户在同一段经历中同时评价，应联合排查而不是归因给单一环节。</p></div>`).join(''):'<div class="empty-evidence">未形成稳定共现组合</div>'}</div><div class="card evolution-panel"><div class="section-head"><div><h2>内容演化</h2><p>${state.month==='全部时间'?'全期问题结构':'当前月份相对全期变化'}</p></div></div>${(s.problems||[]).slice(0,4).map(p=>{const b=(all.problems||[]).find(x=>x.title===p.title)?.rate||0,d=p.rate-b;return `<div class="trend-line"><b>${esc(p.title)}</b><span>${state.month==='全部时间'?`${p.rate}%`: `${d>=0?'↑':'↓'} ${Math.abs(d).toFixed(1)} pct`}</span><p>${esc(p.impact)}</p></div>`}).join('')}</div></section>
  <section class="card pain-deep"><div class="section-head"><div><h2>核心痛点｜用户为什么不满</h2><p>从模糊词频升级为问题簇、可能机制、业务影响和可追溯原评</p></div><span>${fmt(s.n)}条去重评论为分母</span></div>${problems(s,all)}</section>
  ${brandAnalysis(c,s)}`;
  document.querySelectorAll('.theme-tab').forEach(b=>b.onclick=()=>{state.theme=+b.dataset.i;render()});
}
function loading(){sidebar();document.getElementById('categoryDetail').innerHTML='<section class="card load-state"><div class="loader"></div><h2>正在加载评论分析数据</h2></section>'}
function failure(message){document.getElementById('categoryDetail').innerHTML=`<section class="card load-state error-state" role="alert"><div class="error-icon">!</div><h2>评论分析数据加载失败</h2><p>${esc(message)}。页面不会把加载失败显示为零值。</p><button class="retry-button" onclick="location.reload()">重新加载</button></section>`}
async function start(){try{if(window.__VOC_MANIFEST_ERROR__||!manifest?.categories)throw new Error('数据清单加载失败');loading();await load(current());render()}catch(e){failure(e.message)}document.getElementById('themeBtn').onclick=()=>{const dark=document.documentElement.dataset.theme==='dark';document.documentElement.dataset.theme=dark?'light':'dark';document.getElementById('themeBtn').textContent=dark?'深色模式':'浅色模式'}}
start();
})();

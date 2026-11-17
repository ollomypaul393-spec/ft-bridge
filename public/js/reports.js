'use strict';
/* ================= REPORTS (admin full / worker limited) + GENERATION LOG + SPOT CHECKS ================= */

/* ---------- report definitions ---------- */
const REPORTS={
  full:{label:'Business report (full)',admin:true},
  daily:{label:'Daily summary'},
  payments:{label:'Money received by method'},
  orders:{label:'Orders list'},
  staffperf:{label:'Staff performance',admin:true},
  mine:{label:'My performance',worker:true}
};
const W_PERIODS=[['today','Today'],['yesterday','Yesterday'],['week','This week']];
const A_PERIODS=[['today','Today'],['yesterday','Yesterday'],['week','This week'],['month','This month'],['lastmonth','Last month'],['year','This year'],['custom','Custom range']];
let rpt={type:null,gen:null,bid:'all'};
const allLog=()=>state.reportlog.flatMap(d=>(d.entries||[]).map(e=>({...e,_doc:d.id}))).sort((a,b)=>b.at-a.at);
function reportOkB(bid){const brs=S().branches;return o=>!bid||bid==='all'||o.branchId===bid||(!o.branchId&&bid===brs[0].id)}
function daysIn(from,to){const d=[];let x=from,g=0;while(x<=to&&g<370){d.push(x);x=addDays(x,1);g++}return d}
function rpPayments(from,to,okB){const out=[];for(const o of state.orders){if(!okB(o))continue;for(const p of o.payments||[]){const d=dayOf(p.at);if(d>=from&&d<=to)out.push({...p,ticket:o.ticket,name:o.customerName})}}
  for(const j of state.homejobs){if(!okB(j))continue;for(const p of j.payments||[]){const d=dayOf(p.at);if(d>=from&&d<=to)out.push({...p,ticket:'Home',name:j.name})}}return out}

function reportBody(g){
  const {type,from,to}=g;const okB=reportOkB(g.bid);const inR=d=>d>=from&&d<=to;
  if(type==='full')return fullReportBody(from,to);
  const ords=state.orders.filter(o=>o.status!=='cancelled'&&okB(o)&&inR(dayOf(o.createdAt)));
  const coll=state.orders.filter(o=>o.status==='collected'&&okB(o)&&inR(dayOf((o.statusAt||{}).collected)));
  const pays=rpPayments(from,to,okB);const byM={};pays.forEach(p=>byM[p.method||'Other']=(byM[p.method||'Other']||0)+(+p.amount||0));
  if(type==='daily'){
    const days=daysIn(from,to);const shop=state.orders.filter(o=>inShop(o)&&okB(o));
    return `<div class="kpis"><div class="kpi"><div class="l">Orders received</div><div class="v">${ords.length}</div><div class="s">${sum(ords,o=>calc(o).pieces)} pieces · ${money(sum(ords,o=>calc(o).total))}</div></div><div class="kpi"><div class="l">Orders collected</div><div class="v">${coll.length}</div><div class="s">${sum(coll,o=>calc(o).pieces)} pieces</div></div><div class="kpi good"><div class="l">Money received</div><div class="v">${money(sum(pays,p=>p.amount))}</div></div><div class="kpi"><div class="l">In shop now</div><div class="v">${shop.length}</div><div class="s">${shop.filter(isOverdue).length} late</div></div></div>
    <div class="grid g2" style="align-items:start"><div class="card scroll"><h3>Day by day</h3><table class="tbl"><tr><th>Date</th><th class="num">Orders in</th><th class="num">Pieces</th><th class="num">Collected</th><th class="num">Money in</th></tr>${days.map(d=>{const oi=ords.filter(o=>dayOf(o.createdAt)===d);return `<tr><td>${fmtD(d)}</td><td class="num">${oi.length}</td><td class="num">${sum(oi,o=>calc(o).pieces)}</td><td class="num">${coll.filter(o=>dayOf(o.statusAt.collected)===d).length}</td><td class="num">${num(sum(pays.filter(p=>dayOf(p.at)===d),p=>p.amount))}</td></tr>`}).join('')}</table></div>
    <div class="card"><h3>Money by method</h3>${bars(byM)}</div></div>`;
  }
  if(type==='payments'){
    const byS={};pays.forEach(p=>{const k=p.rider?'Rider '+p.rider:(p.by||'Not recorded');byS[k]=(byS[k]||0)+(+p.amount||0)});
    return `<div class="kpis"><div class="kpi good"><div class="l">Total received</div><div class="v">${money(sum(pays,p=>p.amount))}</div><div class="s">${pays.length} payments</div></div>${Object.entries(byM).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>`<div class="kpi"><div class="l">${esc(k)}</div><div class="v">${money(v)}</div></div>`).join('')}</div>
    <div class="grid g2" style="align-items:start"><div class="card"><h3>By method</h3>${bars(byM)}</div><div class="card"><h3>Taken by</h3>${bars(byS,'var(--ink)')}</div></div>
    <div class="card scroll"><h3>All payments</h3><table class="tbl"><tr><th>Time</th><th>Ticket</th><th>Customer</th><th>Method</th><th>By</th><th class="num">Amount</th></tr>${pays.sort((a,b)=>b.at-a.at).map(p=>`<tr><td>${fmtDT(p.at)}</td><td class="mono">${esc(p.ticket)}</td><td>${esc(p.name)}</td><td>${esc(p.method)}</td><td>${esc(p.rider?'Rider '+p.rider:p.by||'')}</td><td class="num">${num(p.amount)}</td></tr>`).join('')||'<tr><td colspan="6" class="muted">No payments</td></tr>'}</table></div>`;
  }
  if(type==='orders'){
    const l=[...ords].sort((a,b)=>b.createdAt-a.createdAt);
    return `<div class="card scroll" style="padding:6px"><table class="tbl"><tr><th>Ticket</th><th>Date</th><th>Customer</th><th class="num">Pieces</th><th class="num">Total</th><th class="num">Paid</th><th>Status</th><th>Served by</th></tr>${l.map(o=>{const c=calc(o);return `<tr><td class="mono"><a href="#" data-act="openOrderX" data-id="${esc(o.id)}">${esc(o.ticket)}</a></td><td>${fmtD(o.createdAt)}</td><td>${esc(o.customerName)}</td><td class="num">${c.pieces}</td><td class="num">${num(c.total)}</td><td class="num">${o.accountId?'account':num(c.paid)}</td><td>${pill(o.status)}</td><td>${esc(o.staffName||'')}</td></tr>`}).join('')||'<tr><td colspan="8" class="muted">No orders in this period</td></tr>'}
     ${l.length?`<tr class="sum"><td>Total</td><td></td><td>${l.length} orders</td><td class="num">${sum(l,o=>calc(o).pieces)}</td><td class="num">${num(sum(l,o=>calc(o).total))}</td><td class="num">${num(sum(l.filter(o=>!o.accountId),o=>calc(o).paid))}</td><td></td><td></td></tr>`:''}</table></div>`;
  }
  if(type==='staffperf'||type==='mine'){
    const list=type==='mine'?[meStaff()].filter(Boolean):state.staff.filter(x=>x.active!==false);
    const rows=list.map(x=>{const mo=ords.filter(o=>o.staffId===x.id);const got=pays.filter(p=>p.by===x.name||p.rider===x.name);const days=daysIn(from,to).filter(d=>(attFor(d)[x.id]||{}).in).length;return {x,n:mo.length,pc:sum(mo,o=>calc(o).pieces),val:sum(mo,o=>calc(o).total),cash:sum(got,p=>p.amount),days}});
    if(type==='mine'){const r=rows[0];if(!r)return '<div class="empty">Sign in as a worker to see your performance.</div>';
      return `<div class="kpis"><div class="kpi"><div class="l">Orders I took</div><div class="v">${r.n}</div><div class="s">${r.pc} pieces</div></div><div class="kpi"><div class="l">Value of my orders</div><div class="v">${money(r.val)}</div></div><div class="kpi good"><div class="l">Money I collected</div><div class="v">${money(r.cash)}</div></div><div class="kpi"><div class="l">Days worked</div><div class="v">${r.days}</div></div></div>
      <div class="card scroll"><h3>My attendance</h3><table class="tbl"><tr><th>Date</th><th>In</th><th>Out</th></tr>${daysIn(from,to).map(d=>{const m=attFor(d)[r.x.id]||{};return `<tr><td>${fmtD(d)}</td><td>${m.in?fmtT(m.in):'—'}</td><td>${m.out?fmtT(m.out):m.in?'in':'—'}</td></tr>`}).join('')}</table></div>`}
    return `<div class="card scroll" style="padding:6px"><table class="tbl"><tr><th>Staff</th><th class="num">Days worked</th><th class="num">Orders taken</th><th class="num">Pieces</th><th class="num">Order value</th><th class="num">Money collected</th></tr>${rows.sort((a,b)=>b.val-a.val).map(r=>`<tr><td><b>${esc(r.x.name)}</b><div class="small muted">${esc(r.x.role||'')}</div></td><td class="num">${r.days}</td><td class="num">${r.n}</td><td class="num">${r.pc}</td><td class="num">${num(r.val)}</td><td class="num">${num(r.cash)}</td></tr>`).join('')||'<tr><td colspan="6" class="muted">No staff</td></tr>'}</table></div>`;
  }
  return '';
}
VIEWS.reports=()=>{
  const adm=inAdmin();const types=Object.entries(REPORTS).filter(([k,r])=>adm?!r.worker:!r.admin);
  if(!rpt.type||!types.some(t=>t[0]===rpt.type))rpt.type=types[0][0];
  const P=adm?A_PERIODS:W_PERIODS;if(!P.some(x=>x[0]===rState.p))rState.p='today';
  const [from,to]=periodRange();const brs=S().branches;const bid=adm?rpt.bid:bId();
  const g=rpt.gen&&rpt.gen.type===rpt.type&&rpt.gen.from===from&&rpt.gen.to===to&&rpt.gen.bid===bid?rpt.gen:null;
  return `<div class="card rpbar"><div class="toolbar" style="margin:0">
    <select data-f="rp-type">${opts(types.map(([k,r])=>[k,r.label]),rpt.type)}</select>
    <select data-f="r-period">${opts(P,rState.p)}</select>
    ${adm&&rState.p==='custom'?`<input type="date" data-f="r-from" value="${esc(rState.from)}"><span class="muted">to</span><input type="date" data-f="r-to" value="${esc(rState.to)}">`:`<span class="muted small">${fmtD(from)}${from!==to?' – '+fmtD(to):''}</span>`}
    ${adm&&brs.length>1&&rpt.type!=='full'?`<select data-f="rp-b"><option value="all">All branches</option>${brs.map(b=>`<option value="${esc(b.id)}" ${b.id===rpt.bid?'selected':''}>${esc(b.name)}</option>`).join('')}</select>`:(!adm?`<span class="small muted">· ${esc(curBranch().name)}</span>`:'')}
    <span class="grow"></span><button class="btn primary" data-act="rpGen">${ic('reports')} Generate report</button></div>
    <p class="small muted" style="margin:10px 0 0">${adm?'Every report generated — by you or a worker — is recorded in the <a href="#reportlog">Report log</a>.':'You can generate reports for your branch for up to the last 7 days. Each report you generate is recorded with your name and the time.'}</p></div>
  ${g?`<div class="rphead"><div><b>${esc(REPORTS[g.type].label)}</b> · ${fmtD(g.from)}${g.from!==g.to?' – '+fmtD(g.to):''}${g.type!=='full'?' · '+esc(g.bid==='all'?'All branches':(branchById(g.bid)||curBranch()).name):''}</div><div class="small muted">Generated by ${esc(myName())} at ${fmtDT(g.at)} · logged</div><button class="btn sm" data-act="rpCsv">Copy as CSV</button></div>${reportBody(g)}`:
   `<div class="card empty">${ic('reports')}<div style="margin-top:8px">Choose a report and period, then press <b>Generate report</b>.</div></div>`}`;
};
ONCHANGE.add('rp-type');ONCHANGE.add('rp-b');
IN['rp-type']=e=>{rpt.type=e.value;render()};
IN['rp-b']=e=>{rpt.bid=e.value;render()};
async function logReport(entry){
  const key=idKey();const doc=state.reportlog.find(d=>d.id===key)||{id:key,entries:[]};
  const e={id:uid(),at:Date.now(),by:myName(),role:roleLabel(),portal:inAdmin()?'admin':previewing?'preview':'worker',branchId:bId(),branchName:curBranch().name,...entry};
  try{await put('reportlog',{...doc,id:key,entries:[...(doc.entries||[]),e].slice(-300),updatedAt:Date.now()})}catch(x){}
}
ACT.rpGen=async a=>{
  const adm=inAdmin();const [from,to]=periodRange();
  if(!adm&&daysBetween(from,todayStr())>7){toast('Workers can only see the last 7 days');return}
  const bid=adm?rpt.bid:bId();const t=rpt.type;a.disabled=true;
  rpt.gen={type:t,from,to,bid,at:Date.now()};
  await logReport({report:t,label:REPORTS[t].label,from,to,scope:t==='full'?'All branches':(bid==='all'?'All branches':(branchById(bid)||curBranch()).name),action:'generated'});
  render();toast('Report generated');
};
ACT.rpCsv=async()=>{
  const g=rpt.gen;if(!g)return;const okB=reportOkB(g.bid);const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  const os=state.orders.filter(o=>o.status!=='cancelled'&&okB(o)&&dayOf(o.createdAt)>=g.from&&dayOf(o.createdAt)<=g.to).sort((a,b)=>a.createdAt-b.createdAt);
  const rows=[['Ticket','Date','Customer','Phone','Pieces','Total','Paid','Balance','Status','Served by']];
  os.forEach(o=>{const c=calc(o);rows.push([o.ticket,dayOf(o.createdAt),o.customerName,o.phone,c.pieces,c.total,c.paid,o.accountId?'On account':c.bal,stLabel(o.status),o.staffName||''])});
  await logReport({report:g.type,label:REPORTS[g.type].label+' (CSV export)',from:g.from,to:g.to,scope:g.bid==='all'?'All branches':(branchById(g.bid)||curBranch()).name,action:'exported'});
  copyText(rows.map(r=>r.map(q).join(',')).join('\n'),`${rows.length-1} orders copied`);
};

/* ---------- Report log (admin) ---------- */
let rlWho='all';
const rlSeen=()=>lsGet('dc-rl-seen',0);
const newReports=()=>allLog().filter(e=>e.at>rlSeen()&&e.portal!=='admin').length;
VIEWS.reportlog=()=>{
  if(!inAdmin())return adminOnly();
  const all=allLog();const seen=rlSeen();const T=todayStr();
  const people=[...new Set(all.map(e=>e.by))];const l=all.filter(e=>rlWho==='all'||e.by===rlWho);
  return `<div class="kpis"><div class="kpi"><div class="l">Reports today</div><div class="v">${all.filter(e=>dayOf(e.at)===T).length}</div></div><div class="kpi"><div class="l">By workers today</div><div class="v">${all.filter(e=>dayOf(e.at)===T&&e.portal!=='admin').length}</div></div><div class="kpi"><div class="l">CSV exports (7 days)</div><div class="v">${all.filter(e=>e.action==='exported'&&Date.now()-e.at<7*864e5).length}</div></div></div>
  <div class="toolbar"><select data-f="rl-who"><option value="all">Everyone</option>${people.map(p=>`<option ${p===rlWho?'selected':''}>${esc(p)}</option>`).join('')}</select><span class="grow"></span><span class="small muted">Who generated which report, and when.</span></div>
  <div class="list">${l.length?`<div class="li head" style="grid-template-columns:150px 1.3fr 1.6fr 1.2fr .9fr"><div>When</div><div>Who</div><div>Report</div><div class="hide-m">Period · scope</div><div class="hide-m">Portal</div></div>`+l.slice(0,400).map(e=>`<div class="li static m2 ${e.at>seen&&e.portal!=='admin'?'newrow':''}" style="grid-template-columns:150px 1.3fr 1.6fr 1.2fr .9fr"><div class="small">${fmtDT(e.at)}</div><div><div class="nm">${esc(e.by)}</div><div class="ph">${esc(e.role||'')} · ${esc(e.branchName||'')}</div></div><div><b>${esc(e.label||e.report)}</b>${e.action==='exported'?' <span class="tag exp">EXPORT</span>':''}</div><div class="hide-m small">${fmtD(e.from)}${e.from!==e.to?' – '+fmtD(e.to):''}<div class="ph">${esc(e.scope||'')}</div></div><div class="hide-m">${pill(e.portal==='admin'?'active':e.portal==='preview'?'draft':'sent').replace(/>[^<]*</,`>${e.portal==='admin'?'Admin':e.portal==='preview'?'Preview':'Worker'}<`)}</div></div>`).join(''):'<div class="empty">No reports generated yet.</div>'}</div>`;
};
AFTER.reportlog=()=>{lsSet('dc-rl-seen',Date.now());setTimeout(renderChrome,0)};
ONCHANGE.add('rl-who');IN['rl-who']=e=>{rlWho=e.value;render()};

/* ---------- Spot checks ---------- */
const SPOT_TYPES={cash:'Cash drawer count',stock:'Stock count',rail:'Rail check (packed orders)'};
const spotSeen=()=>lsGet('dc-spot-seen',0);
const failedSpots=()=>state.spotchecks.filter(x=>x.status==='failed');
const newFailedSpots=()=>failedSpots().filter(x=>(x.doneAt||0)>spotSeen());
const myPendingSpot=()=>!inAdmin()&&state.spotchecks.filter(x=>x.status==='pending'&&(!x.branchId||x.branchId===bId())).sort((a,b)=>a.requestedAt-b.requestedAt)[0];
function pickRandom(arr,n){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,n)}
function spotItems(type,bid){
  const okB=reportOkB(bid);
  if(type==='stock'){const l=pickRandom(state.supplies,3);return l.length?l.map(x=>({id:x.id,name:x.name,unit:x.unit||''})):null}
  if(type==='rail'){let l=state.orders.filter(o=>inShop(o)&&o.packed&&okB(o));if(!l.length)l=state.orders.filter(o=>inShop(o)&&okB(o));const p=pickRandom(l,3);return p.length?p.map(o=>({id:o.id,ticket:o.ticket,name:o.customerName,rack:o.rack||''})):null}
  return [];
}
async function createSpot(type,bid,auto){
  const items=spotItems(type,bid);if(items===null){if(!auto)toast(type==='stock'?'Add stock items first':'No orders in the shop to check');return null}
  const b=branchById(bid)||curBranch();
  const rec={id:auto?`auto_${todayStr()}_${b.id}`:uid(),type,branchId:b.id,branchName:b.name,items,status:'pending',requestedBy:auto?'Random check':myName(),auto:!!auto,requestedAt:Date.now()};
  await put('spotchecks',rec);return rec;
}
/* random daily check — created from a worker's device at a random time between 10:00 and 16:00 */
const autoTried=new Set();
function maybeAutoSpot(){
  if(inAdmin()||previewing||!meStaff()||!S().spotAuto||!state.ready)return;
  const T=todayStr(),b=curBranch(),id=`auto_${T}_${b.id}`;if(autoTried.has(id)||state.spotchecks.some(x=>x.id===id))return;
  let h=0;for(const c of id)h=(h*31+c.charCodeAt(0))>>>0;const at=10*60+(h%(6*60));const now=new Date();if(now.getHours()*60+now.getMinutes()<at)return;
  autoTried.add(id);const types=['cash','stock','rail'];let t=types[(h>>3)%3];if(t==='stock'&&!state.supplies.length)t='cash';
  createSpot(t,b.id,true).catch(()=>{});
}
function spotBanner(){
  const sp=myPendingSpot();if(!sp)return '';
  return `<div class="banner spotb"><span>🔍 <b>Spot check:</b> ${esc(SPOT_TYPES[sp.type])} — ${sp.auto?'random check':'requested by '+esc(sp.requestedBy)} at ${fmtT(sp.requestedAt)}. Please do it now.</span><button class="btn sm dark" data-act="spotDo" data-id="${esc(sp.id)}">Do it now</button></div>`;
}
MODALS.spot=id=>{
  const sp=state.spotchecks.find(x=>x.id===id);if(!sp||sp.status!=='pending')return null;
  let body='';
  if(sp.type==='cash')body=`<p>Count <b>all the cash in the drawer</b> right now, including coins, and enter the total.</p><label class="f">Cash counted (${esc(S().currency)})<input type="number" min="0" id="spCash" autofocus></label>`;
  if(sp.type==='stock')body=`<p>Go to the store and count these items. Enter what you actually find.</p>${sp.items.map((it,i)=>`<label class="f">${esc(it.name)} (${esc(it.unit||'units')})<input type="number" min="0" data-sp="${i}" class="spIn"></label>`).join('')}`;
  if(sp.type==='rail')body=`<p>Find these orders on the rail and confirm each one is there.</p>${sp.items.map((it,i)=>`<div class="spot-rail"><div><span class="mono"><b>${esc(it.ticket)}</b></span> · ${esc(it.name)}${it.rack?` · rack <b>${esc(it.rack)}</b>`:''}</div><select data-sp="${i}" class="spIn"><option value="">Choose…</option><option value="found">✓ Found</option><option value="missing">✕ Not found</option></select></div>`).join('')}`;
  return `<div class="hd"><div><h2>🔍 ${esc(SPOT_TYPES[sp.type])}</h2><div class="small muted">${esc(sp.branchName||'')} · ${sp.auto?'Random check':'Requested by '+esc(sp.requestedBy)} at ${fmtT(sp.requestedAt)}</div></div>${closeX}</div>${body}
  <label class="f">Note (optional)<input type="text" id="spNote"></label><button class="btn primary lg" data-act="spotSubmit">Submit spot check</button>`;
};
Object.assign(ACT,{
  spotDo:a=>openModal('spot',a.dataset.id),
  spotSubmit:async a=>{
    const sp=state.spotchecks.find(x=>x.id===modal.id);if(!sp)return;let results,pass=true;const tol=+S().spotTolerance||0;
    if(sp.type==='cash'){const v=$('#spCash').value;if(v===''){toast('Enter the cash counted');return}const c=dayCash(sp.branchId||bId(),todayStr());const diff=+v-c.expected;pass=Math.abs(diff)<=tol;results={counted:+v,expected:c.expected,diff}}
    if(sp.type==='stock'){const ins=$$('.spIn');if(ins.some(i=>i.value==='')){toast('Enter a count for every item');return}results={items:sp.items.map((it,i)=>{const x=state.supplies.find(s=>s.id===it.id);const exp=x?+x.qty||0:0;const cnt=+ins[i].value;return {...it,expected:exp,counted:cnt,diff:cnt-exp}})};pass=results.items.every(r=>r.diff===0)}
    if(sp.type==='rail'){const ins=$$('.spIn');if(ins.some(i=>!i.value)){toast('Mark every order found or not found');return}results={items:sp.items.map((it,i)=>({...it,found:ins[i].value==='found'}))};pass=results.items.every(r=>r.found)}
    a.disabled=true;
    try{await put('spotchecks',{...sp,status:pass?'passed':'failed',results,note:$('#spNote').value.trim(),doneBy:myName(),doneById:me||'',doneAt:Date.now()});closeModal();if(!pass&&typeof kickPayAlerts==='function')kickPayAlerts();toast('Thank you — spot check sent to the manager')}catch(e){a.disabled=false}
  }
});

/* admin page */
let spF='all',spReq={type:'cash',bid:null};
VIEWS.spotchecks=()=>{
  if(!inAdmin())return adminOnly();
  const s=S();const brs=s.branches;if(!spReq.bid)spReq.bid=brs[0].id;
  const f={all:()=>true,pending:x=>x.status==='pending',failed:x=>x.status==='failed',passed:x=>x.status==='passed'};
  const l=state.spotchecks.filter(f[spF]).sort((a,b)=>(b.doneAt||b.requestedAt)-(a.doneAt||a.requestedAt));const seen=spotSeen();
  const res=x=>{if(x.status==='pending')return '<span class="muted">waiting…</span>';const r=x.results||{};
    if(x.type==='cash')return `counted ${money(r.counted)} · expected ${money(r.expected)} · <b class="${r.diff?'low':'yes'}">${r.diff===0?'exact':(r.diff>0?'over ':'short ')+money(Math.abs(r.diff))}</b>`;
    if(x.type==='stock')return (r.items||[]).map(i=>`${esc(i.name)}: <b class="${i.diff?'low':'yes'}">${num(i.counted)}/${num(i.expected)}</b>`).join(' · ');
    return (r.items||[]).map(i=>`<span class="mono">${esc(i.ticket)}</span> <b class="${i.found?'yes':'low'}">${i.found?'✓':'✕ missing'}</b>`).join(' · ')};
  return `<div class="grid g2" style="align-items:start"><div class="card"><h3>Request a spot check now</h3>
   <div class="grid g2" style="gap:10px"><label class="f">Type<select data-f="sq" data-k="type">${opts(Object.entries(SPOT_TYPES),spReq.type)}</select></label><label class="f">Branch<select data-f="sq" data-k="bid">${brs.map(b=>`<option value="${esc(b.id)}" ${b.id===spReq.bid?'selected':''}>${esc(b.name)}</option>`).join('')}</select></label></div>
   <p class="small muted">The worker on duty gets a red banner asking them to do it straight away. They never see the expected numbers — only you do.</p>
   <button class="btn primary" data-act="spotReq">🔍 Send spot check</button></div>
   <div class="card"><h3>Random daily checks</h3>
   <label class="check"><input type="checkbox" data-f="spset" data-k="spotAuto" ${s.spotAuto?'checked':''}>Ask for one random spot check per branch every day</label>
   <p class="small muted" style="margin:-6px 0 12px 26px">At a random time between 10:00 and 16:00, rotating between cash, stock and rail checks.</p>
   <label class="f">Allowed cash difference (${esc(s.currency)})<input type="number" min="0" data-f="spset" data-k="spotTolerance" value="${+s.spotTolerance||0}"></label>
   <p class="small muted">A cash count within this amount still passes. Stock and rail checks must match exactly.</p></div></div>
  <div class="tabs">${[['all','All'],['failed','Failed'],['pending','Waiting'],['passed','Passed']].map(([k,lb])=>`<button class="tab ${spF===k?'on':''}" data-act="spTab" data-s="${k}">${lb}<span class="n">${state.spotchecks.filter(f[k]).length}</span></button>`).join('')}</div>
  <div class="list">${l.length?l.map(x=>`<div class="li static m2 ${x.status==='failed'&&(x.doneAt||0)>seen?'newrow':''}" style="grid-template-columns:140px 1.2fr 2.4fr auto"><div class="small">${fmtDT(x.doneAt||x.requestedAt)}</div><div><div class="nm">${esc(SPOT_TYPES[x.type])}</div><div class="ph">${esc(x.branchName||'')} · ${x.auto?'random':'by '+esc(x.requestedBy)}${x.doneBy?' · done by <b>'+esc(x.doneBy)+'</b>':''}</div></div><div class="small hide-m">${res(x)}${x.note?`<div class="ph">“${esc(x.note)}”</div>`:''}</div><div class="row-actions" style="justify-content:flex-end">${pill(x.status==='passed'?'paid':x.status==='failed'?'overdue':'draft').replace(/>[^<]*</,`>${x.status==='passed'?'Passed':x.status==='failed'?'Failed':'Waiting'}<`)}${x.status==='failed'&&x.type==='stock'?`<button class="btn sm" data-act="spotFix" data-id="${esc(x.id)}">Set stock to counts</button>`:''}${x.status==='pending'?`<button class="btn sm danger" data-act="spotCancel" data-id="${esc(x.id)}">Cancel</button>`:''}</div></div>`).join(''):'<div class="empty">No spot checks yet.</div>'}</div>`;
};
AFTER.spotchecks=()=>{lsSet('dc-spot-seen',Date.now());setTimeout(renderChrome,0)};
IN.sq=e=>{spReq[e.dataset.k]=e.value};
ONCHANGE.add('spset');
IN.spset=async e=>{const k=e.dataset.k;const v=e.type==='checkbox'?e.checked:Math.max(0,+e.value||0);try{await putSettings({...S(),[k]:v});toast('Saved')}catch(x){}};
Object.assign(ACT,{
  spTab:a=>{spF=a.dataset.s;render()},
  spotReq:async a=>{a.disabled=true;try{const r=await createSpot(spReq.type,spReq.bid,false);if(r)toast('Spot check sent to '+r.branchName)}catch(e){}a.disabled=false},
  spotCancel:async a=>{if(!arm(a,'Cancel?'))return;try{await del('spotchecks',a.dataset.id)}catch(e){}},
  spotFix:async a=>{const x=state.spotchecks.find(s=>s.id===a.dataset.id);if(!x)return;a.disabled=true;
    try{for(const it of (x.results||{}).items||[]){const s=state.supplies.find(v=>v.id===it.id);if(s&&it.diff)await put('supplies',{...s,qty:it.counted,log:[...(s.log||[]),{at:Date.now(),delta:it.counted-(+s.qty||0),note:'Spot check correction',by:myName()}].slice(-50)})}toast('Stock updated to counted amounts')}catch(e){a.disabled=false}}
});

/* live alerts for the admin while the app is open */
let knownSpot=null;
function spotAlerts(){
  if(!state.ready)return;const done=state.spotchecks.filter(x=>x.status!=='pending');const ids=new Set(done.map(x=>x.id));
  if(knownSpot&&inAdmin()){for(const x of done)if(!knownSpot.has(x.id)){toast(x.status==='failed'?`⚠ Spot check FAILED — ${SPOT_TYPES[x.type]} at ${x.branchName} (${x.doneBy})`:`✓ Spot check passed — ${SPOT_TYPES[x.type]} at ${x.branchName}`)}}
  knownSpot=ids;
}

'use strict';
/* ================= OVERVIEW + FINANCE ================= */

/* ---------- Dashboard ---------- */
VIEWS.dashboard=()=>{
  const T=todayStr(),all=orders().filter(o=>o.status!=='cancelled');
  const todays=all.filter(o=>dayOf(o.createdAt)===T);
  const cashToday=sum(allPayments().filter(p=>dayOf(p.at)===T),p=>p.amount);
  const ready=all.filter(isReady),overdue=all.filter(isOverdue),shop=all.filter(inShop);
  const owed=sum(all.filter(owes),o=>calc(o).bal);
  const invOut=sum(state.invoices.filter(v=>v.status!=='void'),v=>Math.max(0,invCalc(v).bal));
  const due=all.filter(o=>isActive(o)&&o.dueDate<=T).sort((a,b)=>a.dueDate<b.dueDate?-1:1);
  const waiting=[...ready].sort((a,b)=>((a.statusAt||{}).ready||0)-((b.statusAt||{}).ready||0));
  const counts=Object.fromEntries(STATUSES.map(s=>[s.k,all.filter(o=>o.status===s.k).length]));
  const colors={received:'var(--blue-soft)',processing:'var(--violet-soft)',ready:'var(--accent-soft)',collected:'#ecebe7'};
  const low=lowStock(),dvT=state.deliveries.filter(d=>dvOpen(d)&&d.date<=T),marks=attFor(T),st=activeStaff(),inNow=st.filter(x=>marks[x.id]&&marks[x.id].in&&!marks[x.id].out).length,old=debtors().filter(d=>daysBetween(dayOf(d.oldest),T)>30),iss=openIssues(),invOd=state.invoices.filter(v=>invStatus(v)==='overdue'),unb=state.accounts.filter(a=>unbilled(a.id).length);
  const nfs=typeof newFailedSpots==='function'?newFailedSpots():[];const pend=state.spotchecks.filter(x=>x.status==='pending').length;const nrep=typeof newReports==='function'?newReports():0;
  const al=(cond,cls,href,icon,txt)=>cond?`<a class="nalert ${cls}" href="#${href}">${ic(icon)}<span>${txt}</span></a>`:'';
  const ast=typeof alertStats==='function'?alertStats():{failed:0};
  const alerts=[al(ast.failed,'bad','whatsapp','wa',`<b>${ast.failed}</b> payment alert${ast.failed>1?'s':''} could not be sent`),al(nfs.length,'bad','spotchecks','spot',`<b>${nfs.length}</b> spot check${nfs.length>1?'s':''} FAILED`),al(pend,'','spotchecks','spot',`<b>${pend}</b> spot check${pend>1?'s':''} waiting`),al(nrep,'','reportlog','reportlog',`<b>${nrep}</b> new report${nrep>1?'s':''} by workers`),al(iss.length,'bad','issues','issues',`<b>${iss.length}</b> open issue${iss.length>1?'s':''}`),al(invOd.length,'bad','invoices','invoice',`<b>${invOd.length}</b> overdue invoice${invOd.length>1?'s':''}`),al(dvT.length,'','delivery','delivery',`<b>${dvT.length}</b> pickup/delivery due`),al(low.length,'bad','inventory','inventory',`<b>${low.length}</b> supplies running low`),al(old.length,'bad','debtors','debtors',`<b>${old.length}</b> owing 30+ days`),al(unb.length,'','invoices','corporate',`<b>${unb.length}</b> account${unb.length>1?'s':''} ready to invoice`),al(st.length,'','staff','staff',`<b>${inNow}/${st.length}</b> staff clocked in`)].join('');
  return `${heroHtml('Welcome back! Here is your operational command center.')}${alerts?`<div class="alerts">${alerts}</div>`:''}${!state.settings?`<div class="banner info">Welcome! Set your <a href="#prices">prices</a>, add your <a href="#staff">staff</a> and fill in <a href="#settings">shop settings</a> — sample prices are in place until you do.</div>`:''}
  <div class="kpis">
   <a class="kpi" href="#orders"><div class="l">Orders today</div><div class="v">${todays.length}</div><div class="s">${money(sum(todays,o=>calc(o).total))} value</div></a>
   <a class="kpi" href="#payments"><div class="l">Cash in today</div><div class="v">${money(cashToday)}</div><div class="s">all methods, incl. invoices</div></a>
   ${stagesOn()?`<a class="kpi" href="#orders" data-act="filt" data-s="ready"><div class="l">Ready for pickup</div><div class="v">${ready.length}</div><div class="s">${money(sum(ready.filter(owes),o=>calc(o).bal))} to collect</div></a>`:`<a class="kpi" href="#production"><div class="l">In shop</div><div class="v">${shop.length}</div><div class="s">${sum(shop,o=>calc(o).pieces)} pieces</div></a>`}
   <a class="kpi ${overdue.length?'alert':''}" href="#orders" data-act="filt" data-s="overdue"><div class="l">Overdue</div><div class="v">${overdue.length}</div><div class="s">past ready-by date</div></a>
   <a class="kpi" href="#debtors"><div class="l">Walk-in balances</div><div class="v">${money(owed)}</div><div class="s">${all.filter(owes).length} orders</div></a>
   <a class="kpi" href="#invoices"><div class="l">Corporate receivable</div><div class="v">${money(invOut)}</div><div class="s">open invoices</div></a>
  </div>
  ${stagesOn()?`<div class="card"><h3>Workflow</h3><div class="pipe">${STATUSES.map(s=>`<a href="#${s.k==='collected'?'orders':'production'}" ${s.k==='collected'?'data-act="filt" data-s="collected"':''} style="background:${colors[s.k]}"><b>${counts[s.k]}</b><span>${s.label}</span></a>`).join('')}</div></div>`:
   `<div class="card"><h3>Work in the shop</h3><div class="pipe"><a href="#production" style="background:var(--danger-soft)"><b>${overdue.length}</b><span>Late</span></a><a href="#production" style="background:var(--warn-soft)"><b>${shop.filter(o=>o.dueDate===T).length}</b><span>Due today</span></a><a href="#production" style="background:var(--blue-soft)"><b>${shop.filter(o=>o.dueDate>T).length}</b><span>Due later</span></a><a href="#orders" data-act="filt" data-s="collected" style="background:#ecebe7"><b>${all.filter(o=>o.status==='collected'&&dayOf((o.statusAt||{}).collected)===T).length}</b><span>Collected today</span></a></div></div>`}
  <div class="grid g2">
   <div><h3 class="h3" style="margin-top:4px">${stagesOn()?'Due today &amp; overdue':'Should be ready today &amp; late'}</h3><div class="list">${due.length?due.slice(0,10).map(orderRow).join(''):'<div class="empty">Nothing due. 🎉</div>'}</div></div>
   <div><h3 class="h3" style="margin-top:4px">${stagesOn()?'Ready &amp; waiting for pickup':'Uncollected the longest'}</h3><div class="list">${(stagesOn()?waiting:shop.filter(o=>o.dueDate&&o.dueDate<T).sort((a,b)=>a.dueDate<b.dueDate?-1:1)).length?(stagesOn()?waiting:shop.filter(o=>o.dueDate&&o.dueDate<T).sort((a,b)=>a.dueDate<b.dueDate?-1:1)).slice(0,10).map(o=>{const d=stagesOn()?dayOf((o.statusAt||{}).ready):o.dueDate;const days=d?daysBetween(d,T):0;return orderRow(o).replace('</div><div class="ph">',`${days>=7?`<span class="tag late">${days}d WAITING</span>`:''}</div><div class="ph">`)}).join(''):'<div class="empty">No orders waiting.</div>'}</div></div>
  </div>
  <h3 class="h3">Recent orders</h3>
  <div class="list">${all.length?orderHead+all.slice(0,8).map(orderRow).join(''):'<div class="empty">No orders yet. <a href="#new-order">Take the first order →</a></div>'}</div>`;
};

/* ---------- Reports ---------- */
let rState={p:'month',from:todayStr().slice(0,8)+'01',to:todayStr()};
function periodRange(){
  const t=new Date(),T=todayStr(),p=rState.p;
  if(p==='today')return [T,T];
  if(p==='yesterday'){const y=addDays(T,-1);return [y,y]}
  if(p==='week'){const d=new Date();d.setDate(d.getDate()-((d.getDay()+6)%7));return [dstr(d),T]}
  if(p==='month')return [T.slice(0,8)+'01',T];
  if(p==='lastmonth')return [dstr(new Date(t.getFullYear(),t.getMonth()-1,1)),dstr(new Date(t.getFullYear(),t.getMonth(),0))];
  if(p==='year')return [T.slice(0,5)+'01-01',T];
  return [rState.from||T,rState.to||T];
}
function fullReportBody(from,to){const inR=d=>d>=from&&d<=to;
  const ords=state.orders.filter(o=>o.status!=='cancelled'&&inR(dayOf(o.createdAt)));
  const value=sum(ords,o=>calc(o).total),pieces=sum(ords,o=>calc(o).pieces);
  const byMethod={},byDay={};let cash=0;
  for(const p of allPayments()){const d=dayOf(p.at);if(inR(d)){cash+=p.amount;byMethod[p.method]=(byMethod[p.method]||0)+p.amount;byDay[d]=(byDay[d]||0)+p.amount}}
  const exps=state.expenses.filter(e=>inR(e.date));const expTot=sum(exps,e=>e.amount);
  const byCat={};for(const e of exps)byCat[e.category]=(byCat[e.category]||0)+(+e.amount||0);
  const byStaff={},byGarment={},bySvc={},byType={'Walk-in':0,'Corporate':0};
  for(const o of ords){if(o.staffName)byStaff[o.staffName]=(byStaff[o.staffName]||0)+1;byType[o.accountId?'Corporate':'Walk-in']+=calc(o).total;
    for(const i of o.items||[]){if(i.service==='fee')continue;byGarment[i.garment]=(byGarment[i.garment]||0)+(+i.qty||0);bySvc[svc(i.service)]=(bySvc[svc(i.service)]||0)+(+i.qty||0)*(+i.price||0)}}
  const disc={'Promo codes':sum(ords,o=>o.promoDisc),'Loyalty points':sum(ords,o=>o.loyaltyDisc),'Account discounts':sum(ords,o=>o.acctDisc),'Manual discounts':sum(ords,o=>o.discount)};
  const newCust=state.customers.filter(c=>inR(dayOf(c.createdAt))).length;
  const days=[];let d=from,guard=0;while(d<=to&&guard<370){days.push(d);d=addDays(d,1);guard++}
  const maxDay=Math.max(1,...days.map(x=>byDay[x]||0));
  const cols=days.length>1&&days.length<=93?`<div class="card"><h3>Money received per day</h3><div class="cols">${days.map(x=>`<div class="c" title="${fmtD(x)}: ${money(byDay[x]||0)}" style="height:${(byDay[x]||0)/maxDay*100}%"></div>`).join('')}</div><div class="cols-x"><span>${fmtD(from)}</span><span>${fmtD(to)}</span></div></div>`:'';
  const net=cash-expTot;
  return `<div class="kpis">
   <div class="kpi"><div class="l">Orders taken</div><div class="v">${ords.length}</div><div class="s">${pieces} pieces · ${money(value)}</div></div>
   <div class="kpi"><div class="l">Money received</div><div class="v">${money(cash)}</div><div class="s">counter + invoices</div></div>
   <div class="kpi"><div class="l">Expenses</div><div class="v">${money(expTot)}</div><div class="s">${exps.length} entries</div></div>
   <div class="kpi ${net<0?'alert':'good'}"><div class="l">Net cash</div><div class="v">${money(net)}</div><div class="s">received − expenses</div></div>
   <div class="kpi"><div class="l">New customers</div><div class="v">${newCust}</div></div>
  </div>
  ${cols}
  <div class="grid g2">
   <div class="card"><h3>Money by payment method</h3>${bars(byMethod)}</div>
   <div class="card"><h3>Sales by service</h3>${bars(bySvc,'var(--violet)')}</div>
   <div class="card"><h3>Walk-in vs corporate sales</h3>${bars(byType,'var(--blue)')}</div>
   <div class="card"><h3>Discounts given</h3>${bars(disc,'var(--warn)')}</div>
   <div class="card"><h3>Garments received <span class="sub">pieces</span></h3>${bars(byGarment,'var(--blue)')}</div>
   <div class="card"><h3>Expenses by category</h3>${bars(byCat,'var(--danger)')}</div>
   ${Object.keys(byStaff).length?`<div class="card"><h3>Orders taken by staff</h3>${bars(byStaff,'var(--ink)')}</div>`:''}
  </div>`;
};
ONCHANGE.add('r-from');ONCHANGE.add('r-to');
Object.assign(IN,{'r-period':e=>{rState.p=e.value;render()},'r-from':e=>{if(e.value){rState.from=e.value;render()}},'r-to':e=>{if(e.value){rState.to=e.value;render()}}});
ACT.copyCsv=()=>{
  const [from,to]=periodRange();const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  const rows=[['Ticket','Date','Customer','Phone','Account','Status','Express','Pieces','Items','Discounts','Total','Paid','Balance','Due date','Served by']];
  for(const o of orders().filter(o=>{const d=dayOf(o.createdAt);return d>=from&&d<=to})){const c=calc(o);rows.push([o.ticket,dayOf(o.createdAt),o.customerName,o.phone,o.accountName||'',stLabel(o.status),o.express?'Yes':'No',c.pieces,(o.items||[]).map(i=>`${i.qty}x ${i.garment} (${svc(i.service)})`).join('; '),c.disc,c.total,c.paid,o.accountId?'On account':c.bal,o.dueDate,o.staffName||''])}
  copyText(rows.map(r=>r.map(q).join(',')).join('\n'),`${rows.length-1} orders copied — paste into a spreadsheet`);
};

/* ---------- Payments & cash-up ---------- */
let pyDate=todayStr();
VIEWS.payments=()=>{
  if(!inAdmin())return adminOnly();
  const pays=allPayments().filter(p=>dayOf(p.at)===pyDate).sort((a,b)=>b.at-a.at);
  const byM={};for(const p of pays)byM[p.method]=(byM[p.method]||0)+p.amount;
  const tot=sum(pays,p=>p.amount);
  const cashExp=sum(state.expenses.filter(e=>e.date===pyDate&&(e.method||'Cash')==='Cash'),e=>e.amount);
  const cashIn=byM['Cash']||0;window._expCash=cashIn-cashExp;
  return `<div class="toolbar"><button class="btn" data-act="pyShift" data-n="-1">‹</button><input type="date" data-f="py-date" value="${esc(pyDate)}"><button class="btn" data-act="pyShift" data-n="1">›</button>${pyDate!==todayStr()?'<button class="btn" data-act="pyShift" data-n="0">Today</button>':''}</div>
  <div class="grid g2" style="align-items:start">
   <div class="card"><h3>Cash-up · ${fmtD(pyDate)}</h3>
    <table class="cash">${Object.keys(byM).length?Object.entries(byM).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><td>${esc(k)}</td><td class="right">${money(v)}</td></tr>`).join(''):'<tr><td class="muted">No payments</td><td></td></tr>'}
     <tr><td><b>Total received</b></td><td class="right"><b>${money(tot)}</b></td></tr></table>
    <table class="cash" style="margin-top:14px"><tr><td>Cash received</td><td class="right">${money(cashIn)}</td></tr><tr><td>Cash expenses paid</td><td class="right">− ${money(cashExp)}</td></tr><tr><td><b>Expected cash in drawer</b></td><td class="right"><b>${money(cashIn-cashExp)}</b></td></tr></table>
    <label class="f" style="margin-top:14px">Cash counted in drawer<input type="number" min="0" data-f="py-count" placeholder="Count the cash and enter it"></label><div id="pyDiff" class="small"></div>
    <p class="small muted">Mobile-money, card and bank totals should match your M-Pesa / bank statements for the day.</p></div>
   <div><div class="list">${pays.length?pays.map(p=>`<div class="li m2" style="grid-template-columns:70px 100px 1fr auto" data-act="${p.kind==='invoice'?'invOpen':'openOrder'}" data-id="${esc(p.id)}"><div class="small muted hide-m">${fmtT(p.at)}</div><div class="mono small hide-m">${esc(p.ref)}</div><div><div class="nm">${esc(p.name)}${p.kind==='invoice'?'<span class="tag corp">INVOICE</span>':''}</div><div class="ph">${esc(p.method)}</div></div><div class="r"><b>${money(p.amount)}</b></div></div>`).join(''):'<div class="empty">No payments on this day.</div>'}</div></div>
  </div>`;
};
ONCHANGE.add('py-date');
Object.assign(IN,{
  'py-date':e=>{if(e.value){pyDate=e.value;render()}},
  'py-count':e=>{const el=$('#pyDiff');if(e.value===''){el.innerHTML='';return}const d=+e.value-(window._expCash||0);el.innerHTML=d===0?'<span class="diff-ok">✓ Drawer balances</span>':`<span class="diff-bad">${d>0?'Over':'Short'} by ${money(Math.abs(d))}</span>`}
});
ACT.pyShift=a=>{const n=+a.dataset.n;pyDate=n===0?todayStr():addDays(pyDate,n);render()};

/* ---------- Debtors ---------- */
VIEWS.debtors=()=>{
  if(!inAdmin())return adminOnly();
  const l=debtors(),T=todayStr(),tot=sum(l,d=>d.owed),old=l.filter(d=>daysBetween(dayOf(d.oldest),T)>30);
  const invOut=sum(state.invoices.filter(v=>v.status!=='void'),v=>Math.max(0,invCalc(v).bal));
  return `<div class="kpis"><div class="kpi alert"><div class="l">Walk-in customers owe</div><div class="v">${money(tot)}</div></div><div class="kpi"><div class="l">Customers owing</div><div class="v">${l.length}</div></div><div class="kpi ${old.length?'alert':''}"><div class="l">Owing 30+ days</div><div class="v">${old.length}</div><div class="s">${money(sum(old,d=>d.owed))}</div></div><a class="kpi" href="#invoices"><div class="l">Corporate invoices due</div><div class="v">${money(invOut)}</div><div class="s">see Invoices →</div></a></div>
  <div class="list">${l.length?`<div class="li head" style="grid-template-columns:1.5fr 1fr .7fr .9fr auto"><div>Customer</div><div class="hide-m">Tickets</div><div class="hide-m">Oldest</div><div class="r">Owes</div><div></div></div>`+l.map(d=>{const age=daysBetween(dayOf(d.oldest),T);return `<div class="li m2" style="grid-template-columns:1.5fr 1fr .7fr .9fr auto" data-act="openCust" data-id="${esc(d.customerId||'')}"><div><div class="nm">${esc(d.name)}</div><div class="ph">${esc(d.phone)}</div></div><div class="hide-m mono small">${d.tickets.map(esc).join(', ')}</div><div class="hide-m small ${age>30?'low':''}">${age} days</div><div class="r"><b class="low">${money(d.owed)}</b></div><div><a class="btn sm wa" data-act="noop" target="_blank" rel="noopener" href="${esc(waLink(d.phone,`Hello ${d.name}, a friendly reminder from ${S().shopName}: you have a balance of ${money(d.owed)} for ticket${d.tickets.length>1?'s':''} ${d.tickets.join(', ')}. Thank you!`))}">Remind</a></div></div>`}).join(''):'<div class="empty">No walk-in customer owes you money. 🎉</div>'}</div>`;
};

/* ---------- Expenses ---------- */
let eMonth=todayStr().slice(0,7);
VIEWS.expenses=()=>{
  if(!inAdmin())return adminOnly();
  const l=state.expenses.filter(e=>String(e.date||'').startsWith(eMonth)).sort((a,b)=>a.date<b.date?1:-1);
  const byCat={};for(const e of l)byCat[e.category]=(byCat[e.category]||0)+(+e.amount||0);
  return `<div class="toolbar"><input type="month" data-f="e-month" value="${esc(eMonth)}"><span class="muted">Total: <b style="color:var(--ink)">${money(sum(l,e=>e.amount))}</b></span><span class="grow"></span><button class="btn primary" data-act="newExp">+ Add expense</button></div>
  <div class="grid g2" style="align-items:start"><div class="list">${l.length?l.map(e=>{const sp=e.supplierId&&findSupplier(e.supplierId);return `<div class="li static m2" style="grid-template-columns:80px 1fr auto auto"><div class="small muted hide-m">${fmtD(e.date)}</div><div><div class="nm">${esc(e.category)}</div><div class="ph">${esc(e.note||'')}${sp?' · '+esc(sp.name):''}${e.method?' · '+esc(e.method):''}</div></div><div class="r"><b>${money(e.amount)}</b></div><div><button class="btn sm danger" data-act="delExp" data-id="${esc(e.id)}">Delete</button></div></div>`}).join(''):'<div class="empty">No expenses recorded for this month.</div>'}</div>
  <div class="card"><h3>By category</h3>${bars(byCat,'var(--warn)')}</div></div>`;
};
ONCHANGE.add('e-month');
IN['e-month']=e=>{if(e.value){eMonth=e.value;render()}};
MODALS.newExp=()=>{const s=S();return `<div class="hd"><h2>Add expense</h2>${closeX}</div>
  <div class="grid g2" style="gap:10px"><label class="f">Date<input type="date" id="eDate" value="${todayStr()}"></label><label class="f">Amount (${esc(s.currency)})<input type="number" min="0" id="eAmt" autofocus></label></div>
  <div class="grid g2" style="gap:10px"><label class="f">Category<select id="eCat">${opts(EXP_CATS)}</select></label><label class="f">Paid with<select id="eMethod">${opts(s.methods)}</select></label></div>
  <div class="grid g2" style="gap:10px"><label class="f">Supplier (optional)<select id="eSupplier"><option value="">—</option>${state.suppliers.map(v=>`<option value="${esc(v.id)}">${esc(v.name)}</option>`).join('')}</select></label><label class="f">Note<input type="text" id="eNote" placeholder="e.g. LUKU token"></label></div>
  <button class="btn primary" data-act="saveExp">Save expense</button>`};
Object.assign(ACT,{
  newExp:()=>openModal('newExp'),
  saveExp:async a=>{const amt=Math.max(0,+$('#eAmt').value||0);if(!amt){toast('Enter an amount');return}a.disabled=true;
    try{await put('expenses',{id:uid(),date:$('#eDate').value||todayStr(),amount:amt,category:$('#eCat').value,method:$('#eMethod').value,supplierId:$('#eSupplier').value,note:$('#eNote').value.trim(),createdAt:Date.now()});closeModal();toast('Expense saved')}catch(e){a.disabled=false}},
  delExp:async a=>{if(!arm(a,'Sure?'))return;try{await del('expenses',a.dataset.id);toast('Expense deleted')}catch(e){}}
});

/* ---------- Profit & loss ---------- */
let pnlYear=new Date().getFullYear();
VIEWS.pnl=()=>{
  if(!inAdmin())return adminOnly();
  const now=todayStr().slice(0,7);const months=[];for(let m=1;m<=12;m++){const k=`${pnlYear}-${pad(m)}`;if(k<=now)months.push(k)}
  const inc={'Counter sales received':{},'Invoice payments received':{}},sales={};const cats={};
  for(const p of allPayments()){const m=dayOf(p.at).slice(0,7);const row=p.kind==='invoice'?'Invoice payments received':'Counter sales received';inc[row][m]=(inc[row][m]||0)+p.amount}
  for(const o of state.orders){if(o.status==='cancelled')continue;const m=dayOf(o.createdAt).slice(0,7);sales[m]=(sales[m]||0)+calc(o).total}
  for(const e of state.expenses){const m=String(e.date).slice(0,7);(cats[e.category]||(cats[e.category]={}))[m]=(cats[e.category][m]||0)+(+e.amount||0)}
  const tot=r=>sum(months,m=>r[m]);const cell=v=>`<td class="num">${v?num(v):'<span class="no">–</span>'}</td>`;
  const incT={},expT={};months.forEach(m=>{incT[m]=sum(Object.values(inc),r=>r[m]);expT[m]=sum(Object.values(cats),r=>r[m])});
  const catRows=Object.entries(cats).filter(([,r])=>tot(r)).sort((a,b)=>tot(b[1])-tot(a[1]));
  const netAll=tot(incT)-tot(expT);
  return `<div class="toolbar"><button class="btn" data-act="pnlYear" data-n="-1">‹ ${pnlYear-1}</button><b style="font-size:17px">${pnlYear}</b>${pnlYear<new Date().getFullYear()?`<button class="btn" data-act="pnlYear" data-n="1">${pnlYear+1} ›</button>`:''}<span class="grow"></span><span class="small muted">Cash basis: money actually received and paid out each month.</span></div>
  <div class="kpis"><div class="kpi"><div class="l">Income ${pnlYear}</div><div class="v">${money(tot(incT))}</div></div><div class="kpi"><div class="l">Expenses ${pnlYear}</div><div class="v">${money(tot(expT))}</div></div><div class="kpi ${netAll<0?'alert':'good'}"><div class="l">Net profit</div><div class="v">${money(netAll)}</div><div class="s">${tot(incT)?Math.round(netAll/tot(incT)*100)+'% margin':''}</div></div><div class="kpi"><div class="l">Work billed ${pnlYear}</div><div class="v">${money(tot(sales))}</div><div class="s">order value, incl. unpaid</div></div></div>
  <div class="card scroll" style="padding:6px"><table class="tbl"><tr><th>${esc(S().currency)}</th>${months.map(m=>`<th class="num">${monthLabel(m).split(' ')[0]}</th>`).join('')}<th class="num">Total</th></tr>
   <tr class="sec"><td colspan="${months.length+2}">Income</td></tr>
   ${Object.entries(inc).map(([k,r])=>`<tr><td>${k}</td>${months.map(m=>cell(r[m])).join('')}<td class="num"><b>${num(tot(r))}</b></td></tr>`).join('')}
   <tr class="sum"><td>Total income</td>${months.map(m=>cell(incT[m])).join('')}<td class="num">${num(tot(incT))}</td></tr>
   <tr class="sec"><td colspan="${months.length+2}">Expenses</td></tr>
   ${catRows.map(([k,r])=>`<tr><td>${esc(k)}</td>${months.map(m=>cell(r[m])).join('')}<td class="num"><b>${num(tot(r))}</b></td></tr>`).join('')||`<tr><td class="muted">No expenses</td>${months.map(()=>'<td></td>').join('')}<td></td></tr>`}
   <tr class="sum"><td>Total expenses</td>${months.map(m=>cell(expT[m])).join('')}<td class="num">${num(tot(expT))}</td></tr>
   <tr class="sum"><td>Net profit</td>${months.map(m=>{const v=(incT[m]||0)-(expT[m]||0);return `<td class="num" style="color:${v<0?'var(--danger)':'#178a58'}">${num(v)}</td>`}).join('')}<td class="num" style="color:${netAll<0?'var(--danger)':'#178a58'}">${num(netAll)}</td></tr>
  </table></div>`;
};
ACT.pnlYear=a=>{pnlYear+=+a.dataset.n;render()};

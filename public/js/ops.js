'use strict';
/* ================= OPERATIONS — pages from the worker-portal video ================= */
const myKey=()=>inAdmin()?'admin':(me||'guest');
const myName=()=>inAdmin()?'Admin':((meStaff()||{}).name||'Staff');
const bId=()=>curBranch().id;
const inBranch=x=>inAdmin()||!x.branchId||x.branchId===bId();
function lsGet(k,d){try{const v=JSON.parse(localStorage.getItem(k));return v??d}catch(e){return d}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
async function updPayment(kind,id,i,patch){const coll=kind==='h'?'homejobs':'orders';const doc=state[coll].find(x=>x.id===id);if(!doc)return;const pays=[...(doc.payments||[])];pays[i]={...pays[i],...patch};await put(coll,{...doc,payments:pays})}

/* ---------- Messages ---------- */
FORM_ROUTES.add('messages');
const unreadMsgs=()=>{const seen=lsGet('dc-seen-'+myKey(),0);return state.messages.filter(m=>m.at>seen&&m.byKey!==myKey()).length};
function chatHtml(){
  const l=[...state.messages].sort((a,b)=>a.at-b.at).slice(-150);
  if(!l.length)return '<div class="empty">No messages yet. Say hello to the team 👋</div>';
  let last='';
  return l.map(m=>{const d=dayOf(m.at);const sep=d!==last?`<div class="chatday">${d===todayStr()?'Today':fmtD(d)}</div>`:'';last=d;const mine=m.byKey===myKey();
    return sep+`<div class="msg ${mine?'me':''}"><span class="av">${avatarHtml(m.byKey,m.by)}</span><div class="bub"><div class="mh"><b>${esc(m.by)}</b><span>${esc(m.role||'')}${m.branchName?' · '+esc(m.branchName):''} · ${fmtT(m.at)}</span></div><div class="mt">${esc(m.text)}</div></div></div>`}).join('');
}
function renderChat(){const el=$('#chat');if(!el)return;const atBottom=el.scrollHeight-el.scrollTop-el.clientHeight<80;el.innerHTML=chatHtml();if(atBottom||!el.dataset.init){el.scrollTop=el.scrollHeight;el.dataset.init='1'}lsSet('dc-seen-'+myKey(),Date.now())}
VIEWS.messages=()=>`<div id="formRoot" class="card chatwrap"><div id="chat" class="chat"></div><div class="chatin"><textarea id="msgIn" placeholder="Write a message to the whole team…  (Enter to send)" rows="2"></textarea><button class="btn primary" data-act="sendMsg">Send</button></div></div>`;
AFTER.messages=renderChat;REFRESH.messages=()=>{renderChat();renderChrome()};
ACT.sendMsg=async a=>{const t=$('#msgIn').value.trim();if(!t)return;a.disabled=true;const ms=meStaff();
  try{await put('messages',{id:uid(),text:t.slice(0,1000),by:myName(),byKey:myKey(),role:roleLabel(),branchId:bId(),branchName:curBranch().name,at:Date.now()});$('#msgIn').value='';renderChat()}catch(e){}a.disabled=false;$('#msgIn').focus()};

/* ---------- IN / OUT tracking ---------- */
let ioDate=todayStr();
VIEWS.inout=()=>{
  const D=ioDate;const os=state.orders.filter(o=>o.status!=='cancelled'&&inBranch(o));
  const inn=os.filter(o=>dayOf(o.createdAt)===D),out=os.filter(o=>o.status==='collected'&&dayOf((o.statusAt||{}).collected)===D),shop=os.filter(inShop);
  const ev=[...inn.map(o=>({t:o.createdAt,k:'in',o})),...out.map(o=>({t:o.statusAt.collected,k:'out',o}))].sort((a,b)=>b.t-a.t);
  const marks=attFor(D);const st=state.staff.filter(x=>x.active!==false&&(inAdmin()||!x.branchId||x.branchId===bId()));
  return `<div class="toolbar"><button class="btn" data-act="ioShift" data-n="-1">‹</button><input type="date" data-f="io-date" value="${D}"><button class="btn" data-act="ioShift" data-n="1">›</button><span class="grow"></span><span class="small muted">${esc(curBranch().name)}</span></div>
  <div class="kpis"><div class="kpi good"><div class="l">⬇ Garments IN</div><div class="v">${sum(inn,o=>calc(o).pieces)}</div><div class="s">${inn.length} orders received</div></div><div class="kpi"><div class="l">⬆ Garments OUT</div><div class="v">${sum(out,o=>calc(o).pieces)}</div><div class="s">${out.length} orders collected</div></div><div class="kpi"><div class="l">In shop right now</div><div class="v">${sum(shop,o=>calc(o).pieces)}</div><div class="s">${shop.length} orders</div></div><div class="kpi"><div class="l">Staff in today</div><div class="v">${st.filter(x=>marks[x.id]&&marks[x.id].in).length}/${st.length}</div></div></div>
  <div class="grid g2" style="align-items:start"><div><h3 class="h3" style="margin-top:0">Garment movements</h3><div class="list">${ev.length?ev.map(e=>`<div class="li m2" style="grid-template-columns:60px 70px 1fr auto" data-act="openOrder" data-id="${esc(e.o.id)}"><div class="small muted">${fmtT(e.t)}</div><div><span class="pill ${e.k==='in'?'st-paid':'st-sent'}">${e.k==='in'?'⬇ IN':'⬆ OUT'}</span></div><div><div class="nm">${esc(e.o.customerName)}</div><div class="ph"><span class="mono">${esc(e.o.ticket)}</span> · ${calc(e.o).pieces} pc${e.k==='in'&&e.o.staffName?' · by '+esc(e.o.staffName):''}</div></div><div></div></div>`).join(''):'<div class="empty">No movements on this day.</div>'}</div></div>
  <div><h3 class="h3" style="margin-top:0">Staff in / out</h3><div class="card scroll" style="padding:6px">${st.length?`<table class="tbl"><tr><th>Staff</th><th>In</th><th>Out</th><th class="num">Hours</th></tr>${st.map(x=>{const m=marks[x.id]||{};const h=m.in?((m.out||(D===todayStr()?Date.now():m.in))-m.in)/36e5:0;return `<tr><td><b>${esc(x.name)}</b><div class="small muted">${esc(x.role||'')}</div></td><td>${m.in?fmtT(m.in):'<span class="no">—</span>'}</td><td>${m.out?fmtT(m.out):m.in?'<span class="yes">still in</span>':'<span class="no">—</span>'}</td><td class="num">${h?h.toFixed(1):'–'}</td></tr>`}).join('')}</table>`:'<div class="empty">No staff yet.</div>'}</div></div></div>`;
};
ONCHANGE.add('io-date');IN['io-date']=e=>{if(e.value){ioDate=e.value;render()}};
ACT.ioShift=a=>{ioDate=addDays(ioDate,+a.dataset.n);render()};

/* ---------- Dispatch ---------- */
VIEWS.dispatch=()=>{
  const l=state.deliveries.filter(d=>d.type==='delivery'&&dvOpen(d)&&inBranch(d)).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
  const toGo=l.filter(d=>d.status!=='out'),out=l.filter(d=>d.status==='out');const riders=activeStaff();
  const card=(d,go)=>{const o=d.orderId&&findOrder(d.orderId);const bal=o&&!o.accountId?Math.max(0,calc(o).bal):0;
    return `<div class="kcard static"><div class="t"><span class="mono"><b>${esc(d.ticket||'—')}</b></span><span class="small ${d.date<todayStr()?'low':'muted'}">${fmtD(d.date)} ${esc(d.time||'')}</span></div>
     <div style="font-weight:600;margin-top:4px">${esc(d.name)}</div><div class="meta">${esc(d.address||'No address')}${d.phone?' · '+esc(d.phone):''}${o?`<br>${calc(o).pieces} pc${o.rack?' · rack <b>'+esc(o.rack)+'</b>':''}`:''}${bal?` · <span class="low">collect ${money(bal)}</span>`:''}</div>
     ${go?`<div class="inline"><select data-f="dp-rider" data-id="${esc(d.id)}"><option value="">Choose rider…</option>${opts(riders.map(x=>x.name),d.driver)}</select><button class="btn sm primary" data-act="dpOut" data-id="${esc(d.id)}">Send out →</button></div>`:
     `<div class="small muted" style="margin-bottom:8px">🛵 ${esc(d.driver||'—')} · out since ${d.outAt?fmtT(d.outAt):'—'}</div><div class="row-actions"><button class="btn sm primary" data-act="dpDone" data-id="${esc(d.id)}">✓ Delivered</button><button class="btn sm" data-act="dpBack" data-id="${esc(d.id)}">Back to shop</button>${d.phone?`<a class="btn sm wa" data-act="noop" target="_blank" rel="noopener" href="${esc(waLink(d.phone,`Hello ${d.name}, your clothes from ${S().shopName} are on the way with ${d.driver||'our rider'}.${bal?` Amount to pay: ${money(bal)}.`:''}`))}">Notify</a>`:''}</div>`}</div>`};
  return `<div class="toolbar"><span class="muted small grow">Deliveries going out to customers. Pick a rider, send it out, then confirm when delivered — cash the rider collects goes to <a href="#ridercash">Rider cash</a>.</span><button class="btn primary" data-act="dvNewDel">+ Schedule delivery</button></div>
  <div class="board" style="grid-template-columns:1fr 1fr"><div class="col"><div class="colh"><span>To dispatch</span><span class="n">${toGo.length}</span></div>${toGo.map(d=>card(d,true)).join('')||'<div class="empty small">Nothing waiting</div>'}</div>
  <div class="col"><div class="colh"><span>Out for delivery</span><span class="n">${out.length}</span></div>${out.map(d=>card(d,false)).join('')||'<div class="empty small">No riders out</div>'}</div></div>`;
};
ONCHANGE.add('dp-rider');
IN['dp-rider']=async e=>{const d=state.deliveries.find(x=>x.id===e.dataset.id);if(d)try{await put('deliveries',{...d,driver:e.value})}catch(x){}};
MODALS.deliver=id=>{const d=state.deliveries.find(x=>x.id===id);if(!d)return null;const o=d.orderId&&findOrder(d.orderId);const bal=o&&!o.accountId?Math.max(0,calc(o).bal):0;
  return `<div class="hd"><h2>Delivered to ${esc(d.name)}</h2>${closeX}</div>${o?`<p class="muted" style="margin-top:-6px">Ticket <span class="mono">${esc(o.ticket)}</span> · ${o.accountId?'billed to account':`balance ${money(bal)}`}</p>`:''}
  ${bal?`<div class="grid g2" style="gap:10px"><label class="f">Amount collected<input type="number" min="0" id="dlAmt" value="${bal}"></label><label class="f">How they paid<select id="dlMethod">${opts(S().methods)}</select></label></div><p class="small muted">Cash stays with the rider until it is handed in on <b>Rider cash</b>.</p>`:''}
  <button class="btn primary lg" data-act="dpConfirm">Confirm delivered</button>`};
Object.assign(ACT,{
  dvNewDel:()=>openModal('delivery',null,{type:'delivery',date:todayStr()}),
  dpOut:async a=>{const d=state.deliveries.find(x=>x.id===a.dataset.id);if(!d)return;if(!d.driver){toast('Choose a rider first');return}a.disabled=true;try{await put('deliveries',{...d,status:'out',outAt:Date.now()});toast('Out for delivery')}catch(e){a.disabled=false}},
  dpBack:async a=>{const d=state.deliveries.find(x=>x.id===a.dataset.id);try{await put('deliveries',{...d,status:'scheduled',outAt:null});toast('Back in shop')}catch(e){}},
  dpDone:a=>openModal('deliver',a.dataset.id),
  dpConfirm:async a=>{const d=state.deliveries.find(x=>x.id===modal.id);const o=d.orderId&&findOrder(d.orderId);a.disabled=true;
    try{if(o){const amt=$('#dlAmt')?Math.max(0,+$('#dlAmt').value||0):0;const m=$('#dlMethod')?$('#dlMethod').value:'';const pays=[...(o.payments||[])];
        if(amt>0)pays.push({amount:amt,method:m,at:Date.now(),by:d.driver||'',rider:m==='Cash'?(d.driver||'Rider'):'',handed:m!=='Cash'});
        if(o.status!=='collected')await put('orders',{...o,payments:pays,status:'collected',statusAt:{...(o.statusAt||{}),collected:Date.now()}});else if(amt>0)await put('orders',{...o,payments:pays})}
      await put('deliveries',{...d,status:'done',doneAt:Date.now()});closeModal();toast('Delivered ✓')}catch(e){a.disabled=false}}
});

/* ---------- Overdue dispensing ---------- */
let odF=1;
VIEWS.overdue=()=>{
  const T=todayStr();const all=state.orders.filter(o=>inShop(o)&&inBranch(o)&&o.dueDate&&o.dueDate<T).map(o=>({o,d:daysBetween(o.dueDate,T)}));
  const l=all.filter(x=>x.d>=odF).sort((a,b)=>b.d-a.d);
  return `<div class="toolbar"><span class="muted small grow">Clothes that were ready but haven't been collected. Send reminders so the rails stay clear.</span></div>
  <div class="tabs">${[[1,'All overdue'],[7,'7+ days'],[30,'30+ days'],[60,'60+ days']].map(([k,l2])=>`<button class="tab ${odF===k?'on':''}" data-act="odTab" data-n="${k}">${l2}<span class="n">${all.filter(x=>x.d>=k).length}</span></button>`).join('')}</div>
  <div class="list">${l.length?l.map(({o,d})=>{const c=calc(o);return `<div class="li m2" style="grid-template-columns:96px 1.3fr .8fr .9fr auto" data-act="openOrder" data-id="${esc(o.id)}"><div class="mono hide-m">${esc(o.ticket)}</div><div><div class="nm">${esc(o.customerName)}</div><div class="ph">${esc(o.phone)} · ${c.pieces} pc${o.rack?' · rack '+esc(o.rack):''}</div></div><div class="hide-m"><span class="${d>=30?'low':''}"><b>${d}</b> day${d===1?'':'s'} late</span><div class="ph">ready ${fmtD(o.dueDate)}</div></div><div class="hide-m small">${!o.accountId&&c.bal>0?`<span class="low">owes ${money(c.bal)}</span>`:'paid'}${o.reminders?`<div class="ph">reminded ${o.reminders}× · ${fmtD(o.remindedAt)}</div>`:''}</div>
    <div>${waButton('remind',o,'Send reminder',`Hello ${o.customerName}, your clothes at ${S().shopName} (ticket ${o.ticket}) have been ready since ${fmtD(o.dueDate)}. Please collect them at your earliest convenience.${!o.accountId&&c.bal>0?` Balance: ${money(c.bal)}.`:''} Thank you!`)}</div></div>`}).join(''):'<div class="empty">No overdue orders. 🎉</div>'}</div>`;
};
ACT.odTab=a=>{odF=+a.dataset.n;render()};
ACT.odRemind=async a=>{const o=findOrder(a.dataset.id);if(o)try{await put('orders',{...o,reminders:(o.reminders||0)+1,remindedAt:Date.now()})}catch(e){}};

/* ---------- Home services ---------- */
const HOME_SVCS=['Carpet cleaning','Sofa / upholstery cleaning','Mattress cleaning','Curtain cleaning (on-site)','House / office cleaning','Car interior cleaning','Other'];
let hmF='upcoming';
const hmCalc=j=>{const paid=sum(j.payments||[],p=>p.amount);return {paid,bal:(+j.price||0)-paid}};
VIEWS.home=()=>{
  const T=todayStr();const f={today:j=>j.date===T&&j.status!=='cancelled',upcoming:j=>['booked','progress'].includes(j.status)&&j.date>=T,late:j=>['booked','progress'].includes(j.status)&&j.date<T,done:j=>j.status==='done',all:()=>true};
  const base=state.homejobs.filter(inBranch);const l=base.filter(f[hmF]).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));if(hmF==='done'||hmF==='all')l.reverse();
  return `<div class="toolbar"><span class="muted small grow">Cleaning jobs done at the customer's home or office — carpets, sofas, mattresses, curtains.</span><button class="btn primary" data-act="hmNew">+ Book a home service</button></div>
  <div class="tabs">${[['today','Today'],['upcoming','Upcoming'],['late','Missed'],['done','Done'],['all','All']].map(([k,lb])=>`<button class="tab ${hmF===k?'on':''}" data-act="hmTab" data-s="${k}">${lb}<span class="n">${base.filter(f[k]).length}</span></button>`).join('')}</div>
  <div class="list">${l.length?l.map(j=>{const c=hmCalc(j);return `<div class="li m2" style="grid-template-columns:90px 1.5fr 1fr .9fr auto" data-act="hmOpen" data-id="${esc(j.id)}"><div class="hide-m"><b>${fmtD(j.date)}</b><div class="ph">${esc(j.time||'')}</div></div><div><div class="nm">${esc(j.name)}</div><div class="ph">${esc(j.service)} · ${esc(j.address||'')}</div></div><div class="hide-m small">${esc(j.staff||'Not assigned')}</div><div class="hide-m small">${money(j.price)}${c.bal>0?`<div class="low">owes ${num(c.bal)}</div>`:'<div class="yes">paid</div>'}</div><div class="r">${pill(j.status)}</div></div>`}).join(''):'<div class="empty">No home services here.</div>'}</div>`;
};
MODALS.home=id=>{
  const j=id?state.homejobs.find(x=>x.id===id):{status:'booked',date:todayStr(),service:HOME_SVCS[0]};if(id&&!j)return null;const c=hmCalc(j),s=S();
  return `<div class="hd"><h2>${id?esc(j.service):'Book a home service'}</h2>${closeX}</div>
  <div class="grid g2" style="gap:10px"><label class="f">Customer<input type="text" id="hmName" value="${esc(j.name||'')}" ${id?'':'autofocus'}></label><label class="f">Phone<input type="tel" id="hmPhone" value="${esc(j.phone||'')}"></label></div>
  <label class="f">Address / directions<input type="text" id="hmAddr" value="${esc(j.address||'')}"></label>
  <div class="grid g3" style="gap:10px"><label class="f">Service<select id="hmSvc">${opts(HOME_SVCS,j.service)}</select></label><label class="f">Date<input type="date" id="hmDate" value="${esc(j.date||'')}"></label><label class="f">Time<input type="time" id="hmTime" value="${esc(j.time||'')}"></label></div>
  <div class="grid g3" style="gap:10px"><label class="f">Team / staff<select id="hmStaff"><option value="">—</option>${opts(activeStaff().map(x=>x.name),j.staff)}</select></label><label class="f">Price (${esc(s.currency)})<input type="number" min="0" id="hmPrice" value="${+j.price||''}"></label><label class="f">Status<select id="hmStatus">${opts([['booked','Booked'],['progress','In progress'],['done','Done'],['cancelled','Cancelled']],j.status)}</select></label></div>
  <label class="f">Notes (size of carpet, number of seats…)<textarea id="hmNotes">${esc(j.notes||'')}</textarea></label>
  ${id?`<section><h4>Payments</h4>${(j.payments||[]).map(p=>`<div class="spread small" style="padding:3px 0"><span>${fmtDT(p.at)} · ${esc(p.method)}</span><b>${money(p.amount)}</b></div>`).join('')||'<p class="small muted">None yet.</p>'}
   ${c.bal>0?`<div class="inline"><input type="number" min="0" id="hmPay" value="${c.bal}"><select id="hmPayM">${opts(s.methods)}</select><button class="btn" data-act="hmPayAdd">Record payment</button></div>`:''}</section>`:''}
  <div class="spread" style="margin-top:14px"><button class="btn primary" data-act="hmSave">Save</button>${id&&inAdmin()?'<button class="btn sm danger" data-act="hmDel">Delete</button>':''}</div>`;
};
Object.assign(ACT,{
  hmTab:a=>{hmF=a.dataset.s;render()},hmNew:()=>openModal('home'),hmOpen:a=>openModal('home',a.dataset.id),
  hmSave:async a=>{const id=modal.id;const name=$('#hmName').value.trim();if(!name){toast('Enter the customer name');return}
    const base=id?state.homejobs.find(x=>x.id===id):{id:uid(),createdAt:Date.now(),payments:[],branchId:bId(),bookedBy:myName()};a.disabled=true;
    try{await put('homejobs',{...base,name,phone:$('#hmPhone').value.trim(),address:$('#hmAddr').value.trim(),service:$('#hmSvc').value,date:$('#hmDate').value||todayStr(),time:$('#hmTime').value,staff:$('#hmStaff').value,price:Math.max(0,+$('#hmPrice').value||0),status:$('#hmStatus').value,notes:$('#hmNotes').value.trim()});closeModal();toast('Saved')}catch(e){a.disabled=false}},
  hmPayAdd:async a=>{const j=state.homejobs.find(x=>x.id===modal.id);const amt=Math.max(0,+$('#hmPay').value||0);if(!amt)return;a.disabled=true;try{await put('homejobs',{...j,payments:[...(j.payments||[]),{amount:amt,method:$('#hmPayM').value,at:Date.now(),by:myName()}]});toast('Payment recorded');renderModal()}catch(e){a.disabled=false}},
  hmDel:async a=>{if(!arm(a,'Delete?'))return;try{await del('homejobs',modal.id);closeModal()}catch(e){}}
});

/* ---------- Tracking ---------- */
let trQ='',trSel=null;
function trackTimeline(o){
  const ev=[];const sa=o.statusAt||{};
  ev.push({t:o.createdAt,i:'⬇',l:'Received',d:`${o.staffName?'by '+esc(o.staffName):''}${o.branchId?' · '+esc((branchById(o.branchId)||{}).name||''):''}`});
  if(sa.processing)ev.push({t:sa.processing,i:'🧺',l:'Cleaning started'});
  if(sa.ready)ev.push({t:sa.ready,i:'✨',l:'Marked ready'});
  if(o.packedAt)ev.push({t:o.packedAt,i:'📦',l:'Packed',d:`${o.rack?'rack '+esc(o.rack):''}${o.packedBy?' · by '+esc(o.packedBy):''}`});
  for(const d of state.deliveries.filter(x=>x.orderId===o.id)){ev.push({t:d.createdAt,i:'🗓',l:`${d.type==='pickup'?'Pickup':'Delivery'} scheduled`,d:fmtD(d.date)});if(d.outAt)ev.push({t:d.outAt,i:'🛵',l:'Out for delivery',d:esc(d.driver||'')});if(d.doneAt)ev.push({t:d.doneAt,i:'✓',l:'Delivered'})}
  for(const p of o.payments||[])ev.push({t:p.at,i:'💵',l:`Paid ${money(p.amount)}`,d:esc(p.method)+(p.rider?' · rider '+esc(p.rider):'')});
  if(o.remindedAt)ev.push({t:o.remindedAt,i:'💬',l:'Reminder sent'});
  if(sa.collected&&o.status==='collected')ev.push({t:sa.collected,i:'⬆',l:'Collected'});
  if(sa.cancelled&&o.status==='cancelled')ev.push({t:sa.cancelled,i:'✕',l:'Cancelled'});
  for(const x of state.issues.filter(i=>i.orderId===o.id))ev.push({t:x.createdAt,i:'⚑',l:'Issue: '+esc(x.type)});
  for(const x of state.refunds.filter(i=>i.orderId===o.id))ev.push({t:x.createdAt,i:'↩',l:`Refund ${stLabel(x.status).toLowerCase()}`,d:money(x.amount)});
  ev.sort((a,b)=>a.t-b.t);const c=calc(o);
  return `<div class="card"><div class="spread"><div><div class="mono" style="font-size:20px"><b>${esc(o.ticket)}</b></div><div class="nm">${esc(o.customerName)} · ${esc(o.phone)}</div></div><div style="text-align:right">${pill(o.status)}<div class="small muted" style="margin-top:4px">${c.pieces} pc · ${money(c.total)}${!o.accountId&&c.bal>0?` · <span class="low">owes ${num(c.bal)}</span>`:''}</div>${o.rack&&inShop(o)?`<div class="rackbig">Rack ${esc(o.rack)}</div>`:''}</div></div>
   <div class="tl">${ev.map(e=>`<div class="tle"><span class="tli">${e.i}</span><div><b>${e.l}</b>${e.d?` <span class="muted small">· ${e.d}</span>`:''}<div class="small muted">${fmtDT(e.t)}</div></div></div>`).join('')}</div>
   <div class="row-actions" style="margin-top:10px"><button class="btn" data-act="openOrder" data-id="${esc(o.id)}">Open order</button></div></div>`;
}
function renderTrack(){
  const el=$('#trRes');if(!el)return;const q=trQ.trim().toLowerCase(),qp=normPhone(q);
  if(q.length<2){el.innerHTML='<div class="empty">Type a ticket number (e.g. 1117-280), phone number or name.</div>';return}
  const m=orders().filter(o=>String(o.ticket).toLowerCase().includes(q)||(qp.length>=4&&normPhone(o.phone).includes(qp))||String(o.customerName).toLowerCase().includes(q)).slice(0,30);
  const exact=m.find(o=>String(o.ticket).toLowerCase()===q);const sel=exact||(m.length===1?m[0]:m.find(o=>o.id===trSel));
  el.innerHTML=(sel?trackTimeline(sel):'')+(m.length&&!(m.length===1&&sel)?`<div class="list">${m.map(o=>`<div class="li m2" style="grid-template-columns:96px 1fr auto auto" data-act="trPick" data-id="${esc(o.id)}"><div class="mono">${esc(o.ticket)}</div><div><div class="nm">${esc(o.customerName)}</div><div class="ph">${fmtD(o.createdAt)} · ${calc(o).pieces} pc</div></div><div class="hide-m small">${o.rack&&inShop(o)?'Rack '+esc(o.rack):''}</div><div class="r">${pill(o.status)}</div></div>`).join('')}</div>`:'')+(!m.length?'<div class="empty">Nothing found.</div>':'');
}
VIEWS.tracking=()=>`<div class="toolbar"><input type="search" data-f="tr-q" class="bigsearch" placeholder="🔍  Ticket number, phone or name…" value="${esc(trQ)}" autofocus></div><div id="trRes"></div>`;
AFTER.tracking=()=>{renderTrack();const i=$('[data-f="tr-q"]');if(i&&!modal){i.focus();i.setSelectionRange(i.value.length,i.value.length)}};
FORM_ROUTES.add('tracking');REFRESH.tracking=renderTrack;
IN['tr-q']=e=>{trQ=e.value;trSel=null;renderTrack()};
ACT.trPick=a=>{trSel=a.dataset.id;renderTrack()};

/* ---------- Packager ---------- */
let pkF='todo';const pkRack={};
VIEWS.packager=()=>{
  const sh=state.orders.filter(o=>inShop(o)&&inBranch(o));const todo=sh.filter(o=>!o.packed).sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate))),done=sh.filter(o=>o.packed).sort((a,b)=>String(a.rack||'').localeCompare(String(b.rack||''),undefined,{numeric:true}));
  const items=o=>(o.items||[]).filter(i=>i.service!=='fee').map(i=>`${i.qty}× ${esc(i.garment)}${i.note?' ('+esc(i.note)+')':''}`).join(', ');
  const body=pkF==='todo'?(todo.length?todo.map(o=>`<div class="li static m2" style="grid-template-columns:96px 1.6fr .8fr 150px auto"><div class="mono hide-m"><a href="#" data-act="openOrderX" data-id="${esc(o.id)}">${esc(o.ticket)}</a></div><div><div class="nm">${esc(o.customerName)}${o.express?'<span class="tag exp">EXPRESS</span>':''}</div><div class="ph"><span class="show-m mono">${esc(o.ticket)} · </span>${items(o)}</div></div><div class="hide-m small ${isOverdue(o)?'low':''}">due ${fmtD(o.dueDate)}</div><div><input type="text" data-f="pk-rack" data-id="${esc(o.id)}" value="${esc(pkRack[o.id]??o.rack??'')}" placeholder="Rack / slot e.g. A3" style="width:100%"></div><div><button class="btn sm primary" data-act="pkDone" data-id="${esc(o.id)}">📦 Packed</button></div></div>`).join(''):'<div class="empty">Everything is packed. 🎉</div>')
   :(done.length?done.map(o=>`<div class="li static m2" style="grid-template-columns:80px 96px 1.4fr auto"><div class="rack">${esc(o.rack||'—')}</div><div class="mono hide-m">${esc(o.ticket)}</div><div><div class="nm">${esc(o.customerName)}</div><div class="ph">${calc(o).pieces} pc · packed ${fmtDT(o.packedAt)}${o.packedBy?' by '+esc(o.packedBy):''}</div></div><div class="row-actions">${waButton('ready',o,(o.wa&&o.wa.ready&&o.wa.ready.status==='sent')?'✓ Told — resend':'Tell customer',`Hello ${o.customerName}, your clothes at ${S().shopName} (ticket ${o.ticket}) are cleaned, packed and ready for pickup. Thank you!`)}<button class="btn sm" data-act="pkUndo" data-id="${esc(o.id)}">Unpack</button></div></div>`).join(''):'<div class="empty">Nothing on the rail.</div>');
  return `<div class="toolbar"><span class="muted small grow">Bag, tag and hang finished clothes. Writing the rack slot makes them easy to find at pickup.</span></div>
  <div class="tabs"><button class="tab ${pkF==='todo'?'on':''}" data-act="pkTab" data-s="todo">To pack<span class="n">${todo.length}</span></button><button class="tab ${pkF==='done'?'on':''}" data-act="pkTab" data-s="done">On the rail<span class="n">${done.length}</span></button></div>
  <div class="list">${body}</div>`;
};
IN['pk-rack']=e=>{pkRack[e.dataset.id]=e.value.trim().toUpperCase()};
Object.assign(ACT,{
  pkTab:a=>{pkF=a.dataset.s;render()},
  pkDone:async a=>{const o=findOrder(a.dataset.id);if(!o)return;const rack=(pkRack[o.id]??o.rack??'').toUpperCase();a.disabled=true;
    try{await put('orders',{...o,packed:true,packedAt:Date.now(),packedBy:myName(),rack});delete pkRack[o.id];toast(`Packed${rack?' — rack '+rack:''}`)}catch(e){a.disabled=false}},
  pkUndo:async a=>{const o=findOrder(a.dataset.id);try{await put('orders',{...o,packed:false})}catch(e){}}
});

/* ---------- Lipa (mobile-money) payments ---------- */
let lpDate=todayStr();
function lipaRows(D){const r=[];for(const o of state.orders){if(!inBranch(o))continue;(o.payments||[]).forEach((p,i)=>{if(p.method!=='Cash'&&dayOf(p.at)===D)r.push({k:'o',id:o.id,i,p,ref:o.ticket,name:o.customerName})})}
  for(const j of state.homejobs){if(!inBranch(j))continue;(j.payments||[]).forEach((p,i)=>{if(p.method!=='Cash'&&dayOf(p.at)===D)r.push({k:'h',id:j.id,i,p,ref:'Home',name:j.name})})}return r.sort((a,b)=>b.p.at-a.p.at)}
VIEWS.lipa=()=>{
  const r=lipaRows(lpDate);const byM={};r.forEach(x=>{const m=x.p.method;byM[m]=byM[m]||{t:0,v:0};byM[m].t+=+x.p.amount||0;if(x.p.verified)byM[m].v+=+x.p.amount||0});
  const pend=r.filter(x=>!x.p.verified);
  return `<div class="toolbar"><button class="btn" data-act="lpShift" data-n="-1">‹</button><input type="date" data-f="lp-date" value="${lpDate}"><button class="btn" data-act="lpShift" data-n="1">›</button><span class="grow"></span><span class="small muted">Match each payment with the SMS / statement, enter the transaction code and tick it.</span></div>
  <div class="kpis">${Object.entries(byM).map(([m,v])=>`<div class="kpi"><div class="l">${esc(m)}</div><div class="v">${money(v.t)}</div><div class="s">${v.v>=v.t?'<span class="yes">all verified</span>':`${money(v.t-v.v)} not verified`}</div></div>`).join('')||'<div class="kpi"><div class="l">Mobile money & card</div><div class="v">0</div></div>'}<div class="kpi ${pend.length?'alert':'good'}"><div class="l">Waiting to verify</div><div class="v">${pend.length}</div></div></div>
  <div class="list">${r.length?r.map(x=>`<div class="li static m2 ${x.p.verified?'':''}" style="grid-template-columns:64px 96px 1.2fr 1fr 1fr 150px auto"><div class="small muted hide-m">${fmtT(x.p.at)}</div><div class="mono small hide-m">${esc(x.ref)}</div><div><div class="nm">${esc(x.name)}</div><div class="ph">${esc(x.p.by||'')}</div></div><div class="hide-m">${esc(x.p.method)}</div><div class="r"><b>${money(x.p.amount)}</b></div><div class="hide-m"><input type="text" data-f="lp-ref" data-k="${x.k}" data-id="${esc(x.id)}" data-i="${x.i}" value="${esc(x.p.ref||'')}" placeholder="Transaction code" style="width:100%;text-transform:uppercase"></div><div><button class="btn sm ${x.p.verified?'':'primary'}" data-act="lpOk" data-k="${x.k}" data-id="${esc(x.id)}" data-i="${x.i}">${x.p.verified?'✓ Verified':'Verify'}</button></div></div>`).join(''):'<div class="empty">No mobile-money or card payments on this day.</div>'}</div>`;
};
ONCHANGE.add('lp-date');ONCHANGE.add('lp-ref');
IN['lp-date']=e=>{if(e.value){lpDate=e.value;render()}};
IN['lp-ref']=async e=>{try{await updPayment(e.dataset.k,e.dataset.id,+e.dataset.i,{ref:e.value.trim().toUpperCase()});toast('Code saved')}catch(x){}};
ACT.lpShift=a=>{lpDate=addDays(lpDate,+a.dataset.n);render()};
ACT.lpOk=async a=>{const doc=state[a.dataset.k==='h'?'homejobs':'orders'].find(x=>x.id===a.dataset.id);const p=(doc.payments||[])[+a.dataset.i];if(!p)return;try{await updPayment(a.dataset.k,a.dataset.id,+a.dataset.i,{verified:!p.verified,verifiedBy:myName(),verifiedAt:Date.now()})}catch(e){}};

/* ---------- Refunds ---------- */
let rfF='requested';
VIEWS.refunds=()=>{
  const base=state.refunds.filter(inBranch);const f=k=>k==='all'?()=>true:x=>x.status===k;
  const l=base.filter(f(rfF)).sort((a,b)=>b.createdAt-a.createdAt);
  return `<div class="toolbar"><span class="muted small grow">${inAdmin()?'Approve or reject refund requests from the counter, then mark them paid.':'Request a refund for a customer — the manager approves it.'}</span><button class="btn primary" data-act="rfNew">+ Request refund</button></div>
  <div class="tabs">${[['requested','Waiting approval'],['approved','Approved'],['paid','Paid'],['rejected','Rejected'],['all','All']].map(([k,lb])=>`<button class="tab ${rfF===k?'on':''}" data-act="rfTab" data-s="${k}">${lb}<span class="n">${base.filter(f(k)).length}</span></button>`).join('')}</div>
  <div class="list">${l.length?l.map(x=>`<div class="li m2" style="grid-template-columns:90px 96px 1.3fr 1.3fr .9fr auto" data-act="rfOpen" data-id="${esc(x.id)}"><div class="small muted hide-m">${fmtD(x.createdAt)}</div><div class="mono small hide-m">${esc(x.ticket||'—')}</div><div><div class="nm">${esc(x.customerName||'')}</div><div class="ph">by ${esc(x.requestedBy||'')}</div></div><div class="hide-m small">${esc(x.reason||'')}</div><div class="r"><b>${money(x.amount)}</b></div><div class="r">${pill(x.status)}</div></div>`).join(''):'<div class="empty">No refunds here.</div>'}</div>`;
};
MODALS.refund=id=>{
  const x=id?state.refunds.find(r=>r.id===id):modal.pre;if(id&&!x)return null;const s=S();const o=x.orderId&&findOrder(x.orderId);
  if(!id)return `<div class="hd"><h2>Request a refund</h2>${closeX}</div>
   <label class="f">Ticket number<input type="text" data-f="rf-ticket" value="${esc(x.ticket||'')}" placeholder="e.g. 1117-280" autofocus></label><div id="rfOrd" class="small" style="margin:-6px 0 12px">${o?`✓ ${esc(o.customerName)} · paid ${money(calc(o).paid)}`:''}</div>
   <div class="grid g2" style="gap:10px"><label class="f">Amount (${esc(s.currency)})<input type="number" min="0" id="rfAmt"></label><label class="f">Give back by<select id="rfMethod">${opts(s.methods)}</select></label></div>
   <label class="f">Reason<textarea id="rfReason" placeholder="e.g. Garment damaged, service not done"></textarea></label>
   <button class="btn primary" data-act="rfSave">Send request</button>`;
  return `<div class="hd"><div><h2>Refund ${money(x.amount)}</h2><div style="margin-top:6px">${pill(x.status)}</div></div>${closeX}</div>
   <dl class="kv"><dt>Customer</dt><dd>${esc(x.customerName||'')}${x.phone?' · '+esc(x.phone):''}</dd><dt>Ticket</dt><dd>${o?`<a href="#" data-act="openOrderX" data-id="${esc(o.id)}" class="mono">${esc(x.ticket)}</a>`:esc(x.ticket||'—')}</dd><dt>Give back by</dt><dd>${esc(x.method)}</dd><dt>Reason</dt><dd>${esc(x.reason||'')}</dd><dt>Requested</dt><dd>${fmtDT(x.createdAt)} by ${esc(x.requestedBy||'')}</dd>${x.decidedAt?`<dt>${x.status==='rejected'?'Rejected':'Approved'}</dt><dd>${fmtDT(x.decidedAt)} by ${esc(x.decidedBy||'')}</dd>`:''}${x.paidAt?`<dt>Paid</dt><dd>${fmtDT(x.paidAt)}</dd>`:''}</dl>
   ${inAdmin()?`<section class="row-actions">${x.status==='requested'?'<button class="btn primary" data-act="rfSet" data-s="approved">Approve</button><button class="btn danger" data-act="rfSet" data-s="rejected">Reject</button>':''}${x.status==='approved'?'<button class="btn primary" data-act="rfPaid">Mark paid (records an expense)</button>':''}</section>`:x.status==='approved'?'<p class="small muted" style="margin-top:12px">Approved — give the money back to the customer, then the manager marks it paid.</p>':''}`;
};
IN['rf-ticket']=e=>{const t=e.value.trim();const o=state.orders.find(x=>x.ticket===t);modal.pre.ticket=t;modal.pre.orderId=o?o.id:'';const el=$('#rfOrd');if(el)el.innerHTML=o?`✓ ${esc(o.customerName)} · paid ${money(calc(o).paid)}`:t.length>=6?'<span class="muted">No order with that ticket — you can still send the request.</span>':''};
Object.assign(ACT,{
  rfTab:a=>{rfF=a.dataset.s;render()},rfNew:()=>openModal('refund',null,{}),rfOpen:a=>openModal('refund',a.dataset.id),
  rfSave:async a=>{const p=modal.pre;const amt=Math.max(0,+$('#rfAmt').value||0);if(!amt){toast('Enter the amount');return}const o=p.orderId&&findOrder(p.orderId);a.disabled=true;
    try{await put('refunds',{id:uid(),orderId:p.orderId||'',ticket:p.ticket||'',customerName:o?o.customerName:'',phone:o?o.phone:'',amount:amt,method:$('#rfMethod').value,reason:$('#rfReason').value.trim(),status:'requested',requestedBy:myName(),branchId:bId(),createdAt:Date.now()});closeModal();toast('Refund requested')}catch(e){a.disabled=false}},
  rfSet:async a=>{const x=state.refunds.find(r=>r.id===modal.id);try{await put('refunds',{...x,status:a.dataset.s,decidedAt:Date.now(),decidedBy:myName()});toast(stLabel(a.dataset.s))}catch(e){}},
  rfPaid:async a=>{const x=state.refunds.find(r=>r.id===modal.id);a.disabled=true;try{const eid=uid();await put('expenses',{id:eid,date:todayStr(),amount:x.amount,category:'Claims & refunds',method:x.method,note:`Refund ${x.ticket||''} – ${x.customerName||''}`,createdAt:Date.now()});await put('refunds',{...x,status:'paid',paidAt:Date.now(),expenseId:eid});toast('Refund paid')}catch(e){a.disabled=false}}
});

/* ---------- Rider cash ---------- */
function riderPending(){const m={};for(const o of state.orders){if(!inBranch(o))continue;(o.payments||[]).forEach((p,i)=>{if(p.rider&&!p.handed){(m[p.rider]=m[p.rider]||[]).push({o,i,p})}})}return m}
VIEWS.ridercash=()=>{
  const pend=riderPending();const hist=[];for(const o of state.orders){if(!inBranch(o))continue;(o.payments||[]).forEach(p=>{if(p.rider&&p.handed&&p.handedAt&&Date.now()-p.handedAt<7*864e5)hist.push({o,p})})}hist.sort((a,b)=>b.p.handedAt-a.p.handedAt);
  return `<p class="small muted" style="margin-top:-6px">Cash riders collect on deliveries. When a rider hands it in, confirm it here so it counts in today's drawer.</p>
  <div class="grid g2" style="align-items:start">${Object.keys(pend).length?Object.entries(pend).map(([r,l])=>`<div class="card"><div class="spread"><h3 style="margin:0">🛵 ${esc(r)}</h3><b class="low" style="font-size:18px">${money(sum(l,x=>x.p.amount))}</b></div>
    ${l.map(x=>`<div class="spread small" style="padding:5px 0;border-bottom:1px solid #f0ede6"><span><span class="mono">${esc(x.o.ticket)}</span> · ${esc(x.o.customerName)} · ${fmtDT(x.p.at)}</span><b>${money(x.p.amount)}</b></div>`).join('')}
    <button class="btn primary" style="margin-top:12px;width:100%" data-act="rcIn" data-r="${esc(r)}">Received ${money(sum(l,x=>x.p.amount))} from ${esc(r.split(' ')[0])}</button></div>`).join(''):'<div class="card"><div class="empty">No rider is holding cash right now. 👍</div></div>'}</div>
  <h3 class="h3">Handed in — last 7 days</h3><div class="list">${hist.length?hist.map(x=>`<div class="li static m2" style="grid-template-columns:1fr 96px 1.2fr auto"><div><b>${esc(x.p.rider)}</b><div class="ph">to ${esc(x.p.handedTo||'')} · ${fmtDT(x.p.handedAt)}</div></div><div class="mono small hide-m">${esc(x.o.ticket)}</div><div class="hide-m small">${esc(x.o.customerName)}</div><div class="r"><b>${money(x.p.amount)}</b></div></div>`).join(''):'<div class="empty">Nothing yet.</div>'}</div>`;
};
ACT.rcIn=async a=>{const r=a.dataset.r;const l=riderPending()[r]||[];a.disabled=true;const byOrder={};l.forEach(x=>{(byOrder[x.o.id]=byOrder[x.o.id]||[]).push(x.i)});
  try{for(const [oid,is] of Object.entries(byOrder)){const o=findOrder(oid);const pays=[...o.payments];is.forEach(i=>pays[i]={...pays[i],handed:true,handedAt:Date.now(),handedTo:myName()});await put('orders',{...o,payments:pays})}toast('Cash received from '+r)}catch(e){a.disabled=false}};

/* ---------- Cash drawer + Close day ---------- */
const drawerOf=bid=>state.drawers.find(d=>d.id===bid);
let drawerSnooze=false;
function drawerBanner(){
  if(inAdmin()||!meStaff())return '';const d=drawerOf(bId());
  if(d&&d.holderKey===myKey())return `<div class="banner info">💰 You have the cash drawer since ${fmtT(d.since)}. <a href="#closeday">Close day</a> when your shift ends.</div>`;
  if(drawerSnooze)return '';
  if(d&&d.holder)return `<div class="banner drawerb"><span>⚠ <b>${esc(d.holder)}</b> still has the drawer, open since ${fmtT(d.since)}. Anything you record now counts against their shift.</span><span class="row-actions"><button class="btn sm primary" data-act="takeDrawer">⇄ Take the drawer</button><button class="btn sm" data-act="snoozeDrawer">Not now</button></span></div>`;
  return `<div class="banner drawerb"><span>💰 Nobody has the cash drawer yet today.</span><span class="row-actions"><button class="btn sm primary" data-act="takeDrawer">Take the drawer</button><button class="btn sm" data-act="snoozeDrawer">Not now</button></span></div>`;
}
function dayCash(bid,D){
  const ok=x=>!x.branchId||x.branchId===bid;const byM={};let counter=0,rider=0,home=0;
  for(const o of state.orders){if(!ok(o))continue;for(const p of o.payments||[]){if(dayOf(p.at)===D){byM[p.method]=(byM[p.method]||0)+(+p.amount||0);if(p.method==='Cash'&&!p.rider)counter+=+p.amount||0}if(p.rider&&p.handed&&dayOf(p.handedAt)===D)rider+=+p.amount||0}}
  for(const j of state.homejobs){if(!ok(j))continue;for(const p of j.payments||[])if(dayOf(p.at)===D){byM[p.method]=(byM[p.method]||0)+(+p.amount||0);if(p.method==='Cash')home+=+p.amount||0}}
  const refunds=sum(state.refunds.filter(r=>ok(r)&&r.status==='paid'&&r.method==='Cash'&&dayOf(r.paidAt)===D),r=>r.amount);
  const safe=sum(state.safedrops.filter(s=>ok(s)&&s.type==='in'&&dayOf(s.at)===D),s=>s.amount);
  return {byM,counter,rider,home,refunds,safe,expected:counter+rider+home-refunds-safe};
}
VIEWS.closeday=()=>{
  const T=todayStr(),b=curBranch(),c=dayCash(b.id,T);window._cdExp=c.expected;const d=drawerOf(b.id);
  const past=state.closings.filter(x=>inAdmin()||x.branchId===b.id).sort((a,b2)=>b2.at-a.at).slice(0,12);
  return `${drawerBanner()}<div class="grid g2" style="align-items:start"><div class="card"><h3>Close day · ${esc(b.name)} · ${fmtD(T)}</h3>
   <p class="small muted" style="margin-top:-6px">${d&&d.holder?`Drawer held by <b>${esc(d.holder)}</b> since ${fmtT(d.since)}`:'No one holds the drawer'}</p>
   <table class="cash"><tr><td>Cash taken at the counter</td><td class="right">${money(c.counter)}</td></tr><tr><td>Cash handed in by riders</td><td class="right">${money(c.rider)}</td></tr><tr><td>Cash from home services</td><td class="right">${money(c.home)}</td></tr><tr><td>Cash refunds paid out</td><td class="right">− ${money(c.refunds)}</td></tr><tr><td>Cash dropped into the safe</td><td class="right">− ${money(c.safe)}</td></tr><tr><td><b>Expected in the drawer</b></td><td class="right"><b>${money(c.expected)}</b></td></tr></table>
   <label class="f" style="margin-top:14px">Cash counted<input type="number" min="0" data-f="cd-count" id="cdCount" placeholder="Count the drawer"></label><div id="cdDiff" class="small" style="margin:-6px 0 10px"></div>
   <label class="f">Notes<input type="text" id="cdNotes" placeholder="e.g. 2,000 short — change given wrongly"></label>
   <button class="btn primary lg" data-act="cdClose">🌙 Close day &amp; hand back drawer</button></div>
   <div><div class="card"><h3>Today by payment method</h3>${Object.keys(c.byM).length?`<table class="cash">${Object.entries(c.byM).map(([k,v])=>`<tr><td>${esc(k)}</td><td class="right">${money(v)}</td></tr>`).join('')}</table>`:'<p class="small muted">No payments yet today.</p>'}<p class="small muted">Check mobile-money totals on <a href="#lipa">Lipa payments</a>.</p></div>
   <h3 class="h3" style="margin-top:0">Past closings</h3><div class="list">${past.length?past.map(x=>`<div class="li static m2" style="grid-template-columns:1fr auto"><div><b>${fmtD(x.date)}</b> · ${esc(x.branchName||'')}<div class="ph">by ${esc(x.by)} · expected ${money(x.expected)} · counted ${money(x.counted)}${x.notes?' · '+esc(x.notes):''}</div></div><div class="${x.diff===0?'diff-ok':'diff-bad'}">${x.diff===0?'✓ Balanced':(x.diff>0?'+':'−')+num(Math.abs(x.diff))}</div></div>`).join(''):'<div class="empty">No closings yet.</div>'}</div></div></div>`;
};
IN['cd-count']=e=>{const el=$('#cdDiff');if(e.value===''){el.innerHTML='';return}const d=+e.value-(window._cdExp||0);el.innerHTML=d===0?'<span class="diff-ok">✓ Drawer balances</span>':`<span class="diff-bad">${d>0?'Over':'Short'} by ${money(Math.abs(d))}</span>`};
Object.assign(ACT,{
  takeDrawer:async a=>{a.disabled=true;try{await put('drawers',{id:bId(),holder:myName(),holderKey:myKey(),since:Date.now()});toast('You have the drawer')}catch(e){a.disabled=false}},
  snoozeDrawer:()=>{drawerSnooze=true;render()},
  cdClose:async a=>{const v=$('#cdCount').value;if(v===''){toast('Count the cash and enter it first');return}const b=curBranch(),T=todayStr(),c=dayCash(b.id,T),counted=+v;a.disabled=true;
    try{await put('closings',{id:uid(),date:T,branchId:b.id,branchName:b.name,by:myName(),expected:c.expected,counted,diff:counted-c.expected,byMethod:c.byM,notes:$('#cdNotes').value.trim(),at:Date.now()});await put('drawers',{id:b.id,holder:'',holderKey:'',since:0});toast('Day closed ✓')}catch(e){a.disabled=false}}
});

/* ---------- Branch safe ---------- */
let sfB=null;
VIEWS.safe=()=>{
  const brs=S().branches;const bid=inAdmin()?(sfB||bId()):bId();const b=branchById(bid)||curBranch();
  const l=state.safedrops.filter(x=>(x.branchId||brs[0].id)===bid).sort((a,c)=>c.at-a.at);const bal=sum(l,x=>x.type==='in'?x.amount:-x.amount);
  return `<div class="toolbar">${inAdmin()&&brs.length>1?`<select data-f="sf-b">${brs.map(x=>`<option value="${esc(x.id)}" ${x.id===bid?'selected':''}>${esc(x.name)}</option>`).join('')}</select>`:`<b>${esc(b.name)}</b>`}<span class="grow"></span><button class="btn primary" data-act="safeOpen" data-t="in">⬇ Drop cash into safe</button>${inAdmin()?'<button class="btn" data-act="safeOpen" data-t="out">⬆ Take out (banking)</button>':''}</div>
  <div class="kpis"><div class="kpi"><div class="l">In the safe now</div><div class="v">${money(bal)}</div></div><div class="kpi"><div class="l">Dropped today</div><div class="v">${money(sum(l.filter(x=>x.type==='in'&&dayOf(x.at)===todayStr()),x=>x.amount))}</div></div><div class="kpi"><div class="l">Last banking</div><div class="v" style="font-size:17px">${(l.find(x=>x.type==='out')||{}).at?fmtD(l.find(x=>x.type==='out').at):'—'}</div></div></div>
  <div class="list">${l.length?l.map(x=>`<div class="li static m2" style="grid-template-columns:120px 1fr auto"><div class="small muted hide-m">${fmtDT(x.at)}</div><div><div class="nm">${x.type==='in'?'⬇ Dropped in':'⬆ Taken out'}</div><div class="ph">${esc(x.by)}${x.note?' · '+esc(x.note):''}</div></div><div class="r"><b class="${x.type==='in'?'yes':'low'}">${x.type==='in'?'+':'−'}${money(x.amount)}</b></div></div>`).join(''):'<div class="empty">No safe movements yet.</div>'}</div>`;
};
ONCHANGE.add('sf-b');IN['sf-b']=e=>{sfB=e.value;render()};
MODALS.safe=()=>{const t=modal.pre.t;return `<div class="hd"><h2>${t==='in'?'Drop cash into the safe':'Take cash out of the safe'}</h2>${closeX}</div>
  <label class="f">Amount (${esc(S().currency)})<input type="number" min="0" id="sfAmt" autofocus></label><label class="f">Note<input type="text" id="sfNote" placeholder="${t==='in'?'e.g. Midday drop':'e.g. Banked at CRDB, slip 0021'}"></label>
  <button class="btn primary" data-act="safeSave">${t==='in'?'Record drop':'Record withdrawal'}</button>`};
Object.assign(ACT,{
  safeOpen:a=>openModal('safe',null,{t:a.dataset.t}),
  safeSave:async a=>{const amt=Math.max(0,+$('#sfAmt').value||0);if(!amt){toast('Enter an amount');return}a.disabled=true;
    try{await put('safedrops',{id:uid(),type:modal.pre.t,amount:amt,note:$('#sfNote').value.trim(),by:myName(),branchId:inAdmin()?(sfB||bId()):bId(),at:Date.now()});closeModal();toast('Saved')}catch(e){a.disabled=false}}
});

/* ---------- Notifications ---------- */
function notifs(){
  const T=todayStr(),out=[];const add=(c,cls,icon,href,txt)=>{if(c)out.push({cls,icon,href,txt})};
  const shop=state.orders.filter(o=>inShop(o)&&inBranch(o));
  const late=shop.filter(o=>o.dueDate&&o.dueDate<T).length,dueT=shop.filter(o=>o.dueDate===T).length;
  add(late,'bad','overdue','overdue',`<b>${late}</b> order${late>1?'s are':' is'} past the ready-by date`);
  add(dueT,'','production','production',`<b>${dueT}</b> order${dueT>1?'s':''} should be ready today`);
  const unp=shop.filter(o=>!o.packed&&o.dueDate<=T).length;add(unp,'','packager','packager',`<b>${unp}</b> due order${unp>1?'s':''} not packed yet`);
  const disp=state.deliveries.filter(d=>d.type==='delivery'&&dvOpen(d)&&d.status!=='out'&&d.date<=T&&inBranch(d)).length;add(disp,'','dispatch','dispatch',`<b>${disp}</b> deliver${disp>1?'ies':'y'} waiting to go out`);
  const pick=state.deliveries.filter(d=>d.type==='pickup'&&dvOpen(d)&&d.date<=T&&inBranch(d)).length;add(pick,'','delivery','delivery',`<b>${pick}</b> pickup${pick>1?'s':''} from customers today`);
  const hm=state.homejobs.filter(j=>j.date===T&&['booked','progress'].includes(j.status)&&inBranch(j)).length;add(hm,'','home','home',`<b>${hm}</b> home service${hm>1?'s':''} today`);
  const um=unreadMsgs();add(um,'','messages','messages',`<b>${um}</b> new message${um>1?'s':''}`);
  const rc=Object.values(riderPending()).flat();add(rc.length,'bad','ridercash','ridercash',`Riders are holding <b>${money(sum(rc,x=>x.p.amount))}</b> cash`);
  const iss=openIssues().length;add(iss,'bad','issues','issues',`<b>${iss}</b> open issue${iss>1?'s':''} / complaint${iss>1?'s':''}`);
  if(typeof myPendingSpot==='function'&&myPendingSpot())add(1,'bad','spot','my-day','A <b>spot check</b> is waiting for you — do it now');
  if(inAdmin()&&typeof newFailedSpots==='function'){const nf=newFailedSpots().length;add(nf,'bad','spot','spotchecks',`<b>${nf}</b> spot check${nf>1?'s':''} failed`);const nr=newReports();add(nr,'','reportlog','reportlog',`<b>${nr}</b> report${nr>1?'s':''} generated by workers`)}
  if(inAdmin()){const rq=state.refunds.filter(r=>r.status==='requested').length;add(rq,'bad','refunds','refunds',`<b>${rq}</b> refund request${rq>1?'s':''} waiting for you`);
    const od=state.invoices.filter(v=>invStatus(v)==='overdue').length;add(od,'bad','invoice','invoices',`<b>${od}</b> overdue corporate invoice${od>1?'s':''}`);
  }
  else{const mine=state.refunds.filter(r=>r.requestedBy===myName()&&r.decidedAt&&Date.now()-r.decidedAt<3*864e5);mine.forEach(r=>add(1,r.status==='rejected'?'bad':'','refunds','refunds',`Your refund for ${esc(r.ticket||r.customerName)} was <b>${esc(stLabel(r.status).toLowerCase())}</b>`))}
  const lo=lowStock().length;add(lo,'bad','inventory','inventory',`<b>${lo}</b> supplies running low`);
  const lp=lipaRows(T).filter(x=>!x.p.verified).length;add(lp,'','lipa','lipa',`<b>${lp}</b> mobile-money payment${lp>1?'s':''} to verify`);
  if(!inAdmin()){const d=drawerOf(bId());add(!d||!d.holder,'','closeday','closeday','Nobody has the cash drawer');}
  return out;
}
VIEWS.notifications=()=>{const l=notifs();return `<p class="small muted" style="margin-top:-6px">Everything that needs attention right now${inAdmin()?'':' at '+esc(curBranch().name)}. Tap to go there.</p><div class="ntf">${l.length?l.map(n=>`<a class="nalert ${n.cls}" href="#${n.href}">${ic(n.icon)}<span>${n.txt}</span><span class="grow"></span>›</a>`).join(''):'<div class="card empty">All clear. 🎉</div>'}</div>`};

/* ---------- My profile ---------- */
VIEWS.profile=()=>{
  const ms=meStaff();if(!ms&&!inAdmin())return '<div class="empty">Sign in to see your profile.</div>';
  const nm=inAdmin()?'Administrator':ms.name,mo=todayStr().slice(0,7);
  const days=ms?state.attendance.filter(a=>String(a.date||a.id).startsWith(mo)&&a.marks&&a.marks[ms.id]).length:0;
  const myO=ms?state.orders.filter(o=>o.staffId===ms.id&&o.status!=='cancelled'&&dayOf(o.createdAt).startsWith(mo)):[];
  const last7=[...Array(7)].map((_,i)=>addDays(todayStr(),-i));
  return `<div class="grid g2" style="align-items:start"><div class="card profcard"><button class="profav" data-act="pickPhoto" title="Change photo">${avatarHtml(myKey(),nm)}<span class="cam">${ic('camera')}</span></button>
   <h2 style="margin:12px 0 2px">${esc(nm)}</h2><div class="muted">${esc(roleLabel())} · ${esc(curBranch().name)} <span class="btype ${curBranch().type==='HQ'?'hq':''}">${curBranch().type==='HQ'?'HQ':'BRANCH'}</span></div>
   ${ms?`<dl class="kv" style="margin:16px auto 0;max-width:300px;text-align:left"><dt>Phone</dt><dd>${esc(ms.phone||'—')}</dd><dt>Started</dt><dd>${fmtD(ms.startDate)}</dd></dl>`:''}
   <div class="row-actions" style="justify-content:center;margin-top:16px"><button class="btn" data-act="pickPhoto">${ic('camera')} Change photo</button></div></div>
   ${ms?`<div><div class="kpis"><div class="kpi"><div class="l">Days worked (${monthLabel(mo)})</div><div class="v">${days}</div></div><div class="kpi"><div class="l">Orders I took</div><div class="v">${myO.length}</div><div class="s">${money(sum(myO,o=>calc(o).total))}</div></div></div>
   <div class="card"><h3>My last 7 days</h3><table class="tbl">${last7.map(d=>{const m=attFor(d)[ms.id]||{};return `<tr><td>${fmtD(d)}</td><td>${m.in?fmtT(m.in):'<span class="no">—</span>'}</td><td>${m.out?fmtT(m.out):m.in?'<span class="yes">in</span>':'<span class="no">—</span>'}</td></tr>`}).join('')}</table></div></div>`:''}</div>`;
};

/* ---------- Branches (admin) ---------- */
let brDraft=null;
FORM_ROUTES.add('branches');RESET.push(r=>{if(r!=='branches')brDraft=null});
VIEWS.branches=()=>{
  if(!inAdmin())return adminOnly();
  if(!brDraft)brDraft=JSON.parse(JSON.stringify(S().branches));const cur=curBranch();const T=todayStr();
  return `<div id="formRoot"><div class="grid g2" style="align-items:start"><div class="card"><h3>This device</h3><p class="small muted" style="margin-top:-6px">Choose which branch this phone / tablet / computer is at. Workers who sign in here work for this branch, and the clock panel shows it.</p>
   <label class="f">This device is at<select data-f="dev-branch">${S().branches.map(b=>`<option value="${esc(b.id)}" ${b.id===cur.id?'selected':''}>${esc(b.name)} (${b.type==='HQ'?'HQ':'Branch'})</option>`).join('')}</select></label></div>
   <div class="card"><h3>Today by branch</h3><table class="tbl"><tr><th>Branch</th><th class="num">Orders today</th><th class="num">In shop</th><th class="num">Staff</th></tr>${S().branches.map((b,i)=>{const ok=o=>o.branchId===b.id||(!o.branchId&&i===0);return `<tr><td><b>${esc(b.name)}</b> <span class="btype ${b.type==='HQ'?'hq':''}">${b.type==='HQ'?'HQ':'BRANCH'}</span></td><td class="num">${state.orders.filter(o=>ok(o)&&dayOf(o.createdAt)===T).length}</td><td class="num">${state.orders.filter(o=>ok(o)&&inShop(o)).length}</td><td class="num">${state.staff.filter(s=>s.active!==false&&(s.branchId===b.id||(!s.branchId&&i===0))).length}</td></tr>`}).join('')}</table></div></div>
  <div class="card scroll"><div class="spread"><h3>Branches</h3><button class="btn sm" data-act="brAdd">+ Add branch</button></div><table class="items"><thead><tr><th>Name</th><th>Type</th><th>City / town</th><th>Phone</th><th></th></tr></thead><tbody>
   ${brDraft.map((b,i)=>`<tr><td><input type="text" data-f="br" data-i="${i}" data-k="name" value="${esc(b.name)}"></td><td><select data-f="br" data-i="${i}" data-k="type">${opts([['HQ','HQ (head office)'],['Branch','Branch']],b.type)}</select></td><td><input type="text" data-f="br" data-i="${i}" data-k="city" value="${esc(b.city||'')}"></td><td><input type="tel" data-f="br" data-i="${i}" data-k="phone" value="${esc(b.phone||'')}"></td><td class="x">${brDraft.length>1?`<button class="xbtn" data-act="brRm" data-i="${i}">×</button>`:''}</td></tr>`).join('')}</tbody></table>
   <button class="btn primary" data-act="brSave">Save branches</button></div></div>`;
};
IN.br=e=>{brDraft[+e.dataset.i][e.dataset.k]=e.value};
ONCHANGE.add('dev-branch');IN['dev-branch']=e=>{lsSet('dc-branch',e.value);render();toast('This device is now at '+curBranch().name)};
Object.assign(ACT,{
  brAdd:()=>{brDraft.push({id:'b'+uid(),name:'',type:'Branch',city:'',phone:''});$('#formRoot').remove();render()},
  brRm:a=>{brDraft.splice(+a.dataset.i,1);$('#formRoot').remove();render()},
  brSave:async a=>{const l=brDraft.filter(b=>b.name.trim()).map(b=>({...b,name:b.name.trim()}));if(!l.length){toast('Keep at least one branch');return}a.disabled=true;try{await putSettings({...S(),branches:l});brDraft=null;toast('Branches saved');render()}catch(e){a.disabled=false}}
});

/* ---------- avatar shortcut menu + photo ---------- */
function avMenuHtml(){
  const ms=meStaff(),T=todayStr(),m=ms?attFor(T)[ms.id]||{}:{};const um=unreadMsgs(),nt=notifs().length;
  const it=(href,icon,label,extra)=>`<a href="${href}" class="avi" ${href==='#'?'':''}${extra||''}>${ic(icon)}<span>${label}</span></a>`;
  return `<div class="avhead"><span class="av">${avatarHtml(myKey(),inAdmin()?'Admin':myName())}</span><div><b>${esc(inAdmin()?'Administrator':myName())}</b><small>${esc(roleLabel())} · ${esc(curBranch().name)}</small></div></div>
   <button class="avi" data-act="pickPhoto">${ic('camera')}<span>Change profile photo</span></button>
   ${it('#'+home(),inAdmin()?'dashboard':'myday',inAdmin()?'Dashboard':'My day')}
   ${it('#new-order','plus','New order')}
   ${it('#tracking','tracking','Track a ticket')}
   ${it('#messages','messages',`Messages${um?` <span class="cnt red">${um}</span>`:''}`)}
   ${it('#notifications','bell',`Notifications${nt?` <span class="cnt">${nt}</span>`:''}`)}
   ${ms?`<button class="avi" data-act="clock" data-id="${esc(ms.id)}" ${m.in&&m.out?'disabled':''}>${ic('inout')}<span>${!m.in?'Clock in':!m.out?'Clock out':'Clocked out'}</span></button>`:''}
   ${inAdmin()?it('#settings','settings','Shop settings')+it('#branches','branches','Branches'):it('#closeday','closeday','Close day')+it('#profile','profile','My profile')}
   ${inAdmin()&&window.ftSignOut?`<button class="avi" data-act="ftSignOut">${ic('access')}<span>Sign out of this device</span></button>`:''}
   `;
}
function hideAvMenu(){const p=$('#avPop');if(p){p.classList.add('hidden');p.innerHTML=''}}
ACT.avMenu=(a,e)=>{e.stopPropagation&&e.stopPropagation();const p=$('#avPop');if(!p.classList.contains('hidden')&&p._from===a){hideAvMenu();return}
  p.innerHTML=avMenuHtml();p.classList.remove('hidden');p._from=a;const r=a.getBoundingClientRect();const w=Math.min(290,window.innerWidth-16);
  let left=Math.min(window.innerWidth-w-8,Math.max(8,r.left));p.style.width=w+'px';p.style.left=left+'px';p.style.top=(r.bottom+8)+'px';
  const h=p.offsetHeight;if(r.bottom+8+h>window.innerHeight&&r.top-8-h>0)p.style.top=(r.top-8-h)+'px'};
ACT.pickPhoto=()=>{hideAvMenu();$('#photoIn').click()};
async function fileToAvatar(f){const url=URL.createObjectURL(f);try{const img=new Image();await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=url});const s=160,c=document.createElement('canvas');c.width=c.height=s;const x=c.getContext('2d');const m=Math.min(img.width,img.height);x.drawImage(img,(img.width-m)/2,(img.height-m)/2,m,m,0,0,s,s);return c.toDataURL('image/jpeg',.82)}finally{URL.revokeObjectURL(url)}}
async function savePhoto(f){if(!f)return;if(!/^image\//.test(f.type)){toast('Choose a photo');return}try{const photo=await fileToAvatar(f);await put('profiles',{id:myKey(),photo,name:inAdmin()?'Admin':myName(),updatedAt:Date.now()});toast('Profile photo updated');render()}catch(e){toast("Couldn't use that photo")}}

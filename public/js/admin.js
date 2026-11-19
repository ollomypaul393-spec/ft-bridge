'use strict';
/* ================= STAFF & ADMIN + PORTALS ================= */

/* ---------- PIN keypad actions ---------- */
Object.assign(ACT,{
  pk:a=>{const k=a.dataset.k;const e=$('#lockErr');if(e)e.textContent='';if(k==='del')lockPin=lockPin.slice(0,-1);else if(lockPin.length<8)lockPin+=k;lockDots();if(k!=='del')lockCheck(false)},
  lockGo:()=>lockTry(),
  lockNow:()=>lockNow(),
  viewWorker:()=>{const st=activeStaff();if(!st.length){toast('Add a worker under Staff & attendance first');location.hash='#staff';return}previewing=true;portal='staff';me=st[0].id;closeModal();location.hash='#my-day';render();toast('Previewing the worker portal')},
  backAdmin:()=>backToAdmin(),
  setupAdmin:(a,e)=>{e.preventDefault();if(S().adminPinHash||!viewerAdmin)return;portal='admin';me=null;saveSession();location.hash='#access';render()}
});
async function pinTaken(h,exceptStaffId){if(S().adminPinHash===h)return true;return state.staff.some(x=>x.id!==exceptStaffId&&x.active!==false&&x.pinHash===h)}

/* ---------- My day (staff portal home) ---------- */
VIEWS['my-day']=()=>{
  const T=todayStr(),ms=meStaff(),m=ms?attFor(T)[ms.id]||{}:{};
  const mine=state.orders.filter(o=>ms&&o.staffId===ms.id&&inBranch(o)&&dayOf(o.createdAt)===T&&o.status!=='cancelled');
  const due=state.orders.filter(o=>isActive(o)&&inBranch(o)&&o.dueDate<=T).sort((a,b)=>a.dueDate<b.dueDate?-1:1);
  const ready=state.orders.filter(isReady);
  const dv=state.deliveries.filter(d=>dvOpen(d)&&d.date<=T&&(!ms||!d.driver||d.driver===ms.name));
  const cashMine=ms?sum(state.orders.flatMap(o=>(o.payments||[]).filter(p=>dayOf(p.at)===T&&(o.staffId===ms.id&&p.at===o.createdAt||p.by===ms.name))),p=>p.amount):0;
  const greet=new Date().getHours()<12?'Good morning':new Date().getHours()<17?'Good afternoon':'Good evening';
  const clockBtn=ms?(!m.in?`<button class="btn primary lg" data-act="clock" data-id="${esc(ms.id)}">Clock in</button>`:!m.out?`<button class="btn lg hero-btn" data-act="clock" data-id="${esc(ms.id)}">Clock out</button>`:'<span class="hchip">✓ Done for today</span>'):'';
  return `${heroHtml(`${greet}${ms?', '+esc(ms.name.split(' ')[0]):''}! ${ms?(m.in?`Clocked in at ${fmtT(m.in)}${m.out?` · out at ${fmtT(m.out)}`:''}.`:'You have not clocked in yet today.'):'Have a great shift.'}`,clockBtn?`<div style="margin-top:16px">${clockBtn}</div>`:'')}${typeof drawerBanner==='function'?drawerBanner():''}
  <div class="kpis">
   <a class="kpi" href="#orders"><div class="l">${ms?'My orders today':'Orders today'}</div><div class="v">${ms?mine.length:state.orders.filter(o=>dayOf(o.createdAt)===T).length}</div>${ms?`<div class="s">${money(cashMine)} collected by me</div>`:''}</a>
   <a class="kpi ${due.some(isOverdue)?'alert':''}" href="#production"><div class="l">Due today / late</div><div class="v">${due.length}</div></a>
   <a class="kpi" href="#production"><div class="l">${stagesOn()?'Ready for pickup':'In shop'}</div><div class="v">${stagesOn()?ready.length:state.orders.filter(inShop).length}</div></a>
   <a class="kpi" href="#delivery"><div class="l">Pickups &amp; deliveries</div><div class="v">${dv.length}</div><div class="s">${ms?'for me / unassigned':'due today'}</div></a>
  </div>
  <div class="row-actions" style="margin-bottom:18px"><a class="btn primary lg" href="#new-order">+ New order</a><a class="btn lg" href="#production">${PAGE_LABEL.production}</a><a class="btn lg" href="#issues">Log an issue</a></div>
  <div class="grid g2"><div><h3 class="h3" style="margin-top:0">Due today &amp; late</h3><div class="list">${due.length?due.slice(0,12).map(orderRow).join(''):'<div class="empty">Nothing due. 🎉</div>'}</div></div>
  <div><h3 class="h3" style="margin-top:0">${ms?'My orders today':'Ready for pickup'}</h3><div class="list">${(ms?mine:ready).length?(ms?mine:ready).slice(0,12).map(orderRow).join(''):'<div class="empty">Nothing yet.</div>'}</div></div></div>`;
};

/* ---------- Staff & attendance ---------- */
VIEWS.staff=()=>{
  if(!inAdmin())return adminOnly();
  const T=todayStr(),marks=attFor(T),act=activeStaff(),gone=state.staff.filter(x=>x.active===false),mo=T.slice(0,7);
  const days=id=>state.attendance.filter(a=>String(a.date||a.id).startsWith(mo)&&a.marks&&a.marks[id]).length;
  const served=id=>state.orders.filter(o=>o.staffId===id&&o.status!=='cancelled'&&dayOf(o.createdAt).startsWith(mo)).length;
  const row=x=>{const m=marks[x.id]||{};const st=m.in?(m.out?`<span class="muted">${fmtT(m.in)} – ${fmtT(m.out)}</span>`:`<span class="diff-ok">In since ${fmtT(m.in)}</span>`):'<span class="muted">Not in yet</span>';
    const btn=!m.in?`<button class="btn sm primary" data-act="clock" data-id="${esc(x.id)}">Clock in</button>`:!m.out?`<button class="btn sm" data-act="clock" data-id="${esc(x.id)}">Clock out</button>`:'';const d=days(x.id);
    return `<div class="li m2" style="grid-template-columns:1.4fr 1.1fr .8fr .7fr auto" data-act="staffEdit" data-id="${esc(x.id)}"><div><div class="nm">${esc(x.name)}${x.admin?' <span class="tag adm">ADMIN</span>':''}${x.pinHash||x.admin?'':' <span class="tag late">NO PIN</span>'}</div><div class="ph">${esc(x.role||'')}${x.phone?' · '+esc(x.phone):''}</div></div><div class="small">${st}</div><div class="hide-m small">${d} day${d===1?'':'s'} this month</div><div class="hide-m small">${served(x.id)} orders</div><div class="row-actions" style="justify-content:flex-end">${btn}</div></div>`};
  const inNow=act.filter(x=>marks[x.id]&&marks[x.id].in&&!marks[x.id].out).length;
  return `<div class="toolbar"><span class="muted grow">Today: <b style="color:var(--ink)">${inNow} of ${act.length}</b> clocked in. Staff can also clock themselves in from the staff portal.</span><button class="btn primary" data-act="staffEdit">+ Add staff</button></div>
  <div class="list">${act.length?act.map(row).join(''):'<div class="empty">No staff added yet. Add your team to use the staff portal, track attendance and see who took each order.</div>'}</div>
  ${gone.length?`<h3 class="h3 muted">Former staff</h3><div class="list">${gone.map(x=>`<div class="li m2" style="grid-template-columns:1fr auto" data-act="staffEdit" data-id="${esc(x.id)}"><div><div class="nm">${esc(x.name)}</div><div class="ph">${esc(x.role||'')}</div></div><div></div></div>`).join('')}</div>`:''}`;
};
MODALS.staff=id=>{
  const x=id?findStaff(id):{active:true,startDate:todayStr()};if(id&&!x)return null;
  return `<div class="hd"><h2>${id?esc(x.name):'Add staff member'}</h2>${closeX}</div>
  <div class="grid g2" style="gap:10px"><label class="f">Name<input type="text" id="sfName" value="${esc(x.name||'')}" ${id?'':'autofocus'}></label><label class="f">Role<input type="text" id="sfRole" list="roles" value="${esc(x.role||'')}" placeholder="Choose or type"></label></div>
  <datalist id="roles">${ROLES.map(r=>`<option value="${r}">`).join('')}</datalist>
  <div class="grid g3" style="gap:10px"><label class="f">Phone<input type="tel" id="sfPhone" value="${esc(x.phone||'')}"></label><label class="f">Monthly salary (${esc(S().currency)})<input type="number" min="0" id="sfSalary" value="${salaryOf(x.id)||''}"></label><label class="f">Start date<input type="date" id="sfStart" value="${esc(x.startDate||'')}"></label></div>
  <label class="f">Google email (Gmail) they sign in with — needed once to open the app on their phone<input type="email" id="sfEmail" value="${esc(x.email||'')}" placeholder="name@gmail.com" autocomplete="off"></label>
  <div class="grid g2" style="gap:10px"><label class="f">${x.pinHash?'Change sign-in PIN (leave blank to keep)':'Sign-in PIN (required)'}<input type="password" inputmode="numeric" id="sfPin" maxlength="8" autocomplete="new-password" placeholder="4 or 6 digits"></label><p class="small muted" style="align-self:center;margin:0">The first time, they sign in with the Google email above and type this PIN — after that their phone opens to their PIN screen. Every PIN must be different.</p></div>
  ${S().branches.length>1?`<label class="f">Branch<select id="sfBranch">${S().branches.map(b=>`<option value="${esc(b.id)}" ${b.id===(x.branchId||S().branches[0].id)?'selected':''}>${esc(b.name)}</option>`).join('')}</select></label>`:''}
  <label class="check"><input type="checkbox" id="sfActive" ${x.active!==false?'checked':''}>Currently working here</label>
  <label class="check"><input type="checkbox" id="sfAdmin" ${x.admin?'checked':''}><span><b>Admin</b> — full access to everything, opens straight into the admin side without a PIN <span class="muted">(needs their Google email above)</span></span></label>
  <div class="row-actions"><button class="btn primary" data-act="staffSave">Save</button>${id?`<button class="btn" data-act="salaryOpen" data-id="${esc(id)}">Pay salary</button>`:''}</div>
  ${id?`<section><h4>Payments to ${esc(x.name.split(' ')[0])}</h4>${state.expenses.filter(e=>e.staffId===id).sort((a,b)=>a.date<b.date?1:-1).slice(0,12).map(e=>`<div class="spread small" style="padding:3px 0"><span>${fmtD(e.date)} · ${esc(e.note||'')}</span><b>${money(e.amount)}</b></div>`).join('')||'<div class="small muted">None recorded yet.</div>'}</section>`:''}`;
};
MODALS.salary=id=>{
  const x=findStaff(id);if(!x)return null;const s=S();const mo=modal.pre.month||todayStr().slice(0,7);
  const paid=sum(state.expenses.filter(e=>e.staffId===id&&(e.payMonth||String(e.date).slice(0,7))===mo),e=>e.amount);const due=Math.max(0,salaryOf(id)-paid);
  return `<div class="hd"><h2>Pay ${esc(x.name)}</h2>${closeX}</div>
  <p class="small muted" style="margin-top:-6px">Salary ${money(salaryOf(id))} · already paid for ${monthLabel(mo)}: ${money(paid)}</p>
  <div class="grid g3" style="gap:10px"><label class="f">Amount (${esc(s.currency)})<input type="number" min="0" id="slAmt" value="${due||''}" autofocus></label><label class="f">For month<input type="month" id="slMonth" value="${mo}"></label><label class="f">Date paid<input type="date" id="slDate" value="${todayStr()}"></label></div>
  <div class="grid g2" style="gap:10px"><label class="f">Type<select id="slType">${opts(['Salary','Advance','Bonus','Overtime','Allowance'])}</select></label><label class="f">Paid with<select id="slMethod">${opts(s.methods)}</select></label></div>
  <p class="small muted">Saved as a "Salaries & wages" expense.</p><button class="btn primary" data-act="salarySave">Record payment</button>`;
};
Object.assign(ACT,{
  staffEdit:a=>openModal('staff',a.dataset.id||null),
  staffSave:async a=>{const id=modal.id;const name=$('#sfName').value.trim();if(!name){toast('Enter a name');return}
    const em=$('#sfEmail').value.trim();if(em&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){toast('Check the Google email');return}
    if($('#sfAdmin')&&$('#sfAdmin').checked&&!em){toast('An admin needs their Google email');return}
    const pin=$('#sfPin').value.trim();if(pin&&!/^(\d{4}|\d{6})$/.test(pin)){toast('PIN must be 4 or 6 digits');return}
    const clearing=$('#sfPinClear')&&$('#sfPinClear').checked;if(!pin&&$('#sfActive').checked&&!($('#sfAdmin')&&$('#sfAdmin').checked)&&(!id||!findStaff(id).pinHash||clearing)){toast('Give them a sign-in PIN (4–8 digits)');return}
    if(pin&&await pinTaken(await sha(pin),id)){toast('That PIN is already used — choose another');return}
    const base=id?findStaff(id):{id:uid(),createdAt:Date.now()};const rec={...base,name,role:$('#sfRole').value.trim(),phone:$('#sfPhone').value.trim(),email:$('#sfEmail').value.trim().toLowerCase(),admin:!!($('#sfAdmin')&&$('#sfAdmin').checked),startDate:$('#sfStart').value,active:$('#sfActive').checked,branchId:$('#sfBranch')?$('#sfBranch').value:(base.branchId||'')};
    if(pin){rec.pinHash=await sha(pin);rec.pinLen=pin.length}if($('#sfPinClear')&&$('#sfPinClear').checked)rec.pinHash='';
    const sal=Math.max(0,+$('#sfSalary').value||0);a.disabled=true;
    try{await put('staff',rec);if(sal!==salaryOf(rec.id))await put('staffpay',{id:rec.id,salary:sal});closeModal();toast('Saved')}catch(e){a.disabled=false}},
  clock:async a=>{const id=a.dataset.id,T=todayStr();const marks={...attFor(T)};const m={...(marks[id]||{})};if(!m.in)m.in=Date.now();else if(!m.out)m.out=Date.now();else return;marks[id]=m;
    a.disabled=true;try{await put('attendance',{id:T,date:T,marks});toast(m.out?'Clocked out':'Clocked in')}catch(e){a.disabled=false}},
  salaryOpen:a=>openModal('salary',a.dataset.id,{month:a.dataset.m}),
  salarySave:async a=>{const x=findStaff(modal.id);const amt=Math.max(0,+$('#slAmt').value||0);if(!amt){toast('Enter an amount');return}const mo=$('#slMonth').value||todayStr().slice(0,7);
    a.disabled=true;try{await put('expenses',{id:uid(),date:$('#slDate').value||todayStr(),amount:amt,category:'Salaries & wages',method:$('#slMethod').value,note:`${x.name} – ${$('#slType').value} ${monthLabel(mo)}`,staffId:x.id,payMonth:mo,payType:$('#slType').value,createdAt:Date.now()});closeModal();toast('Payment recorded')}catch(e){a.disabled=false}}
});

/* ---------- Payroll ---------- */
let prMonth=todayStr().slice(0,7);
VIEWS.payroll=()=>{
  if(!inAdmin())return adminOnly();
  const st=state.staff.filter(x=>x.active!==false||state.expenses.some(e=>e.staffId===x.id&&e.payMonth===prMonth)).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  const daysIn=id=>state.attendance.filter(a=>String(a.date||a.id).startsWith(prMonth)&&a.marks&&a.marks[id]).length;
  const rows=st.map(x=>{const pays=state.expenses.filter(e=>e.staffId===x.id&&(e.payMonth||String(e.date).slice(0,7))===prMonth);const paid=sum(pays,e=>e.amount);const sal=salaryOf(x.id);return {x,sal,paid,bal:sal-paid,adv:sum(pays.filter(e=>e.payType==='Advance'),e=>e.amount),d:daysIn(x.id)}});
  const T={sal:sum(rows,r=>r.sal),paid:sum(rows,r=>r.paid),bal:sum(rows,r=>Math.max(0,r.bal))};
  return `<div class="toolbar"><input type="month" data-f="pr-month" value="${esc(prMonth)}"><span class="grow"></span><span class="small muted">Salaries are only visible in the admin portal.</span></div>
  <div class="kpis"><div class="kpi"><div class="l">Payroll ${monthLabel(prMonth)}</div><div class="v">${money(T.sal)}</div></div><div class="kpi good"><div class="l">Paid</div><div class="v">${money(T.paid)}</div></div><div class="kpi ${T.bal?'alert':''}"><div class="l">Still to pay</div><div class="v">${money(T.bal)}</div></div></div>
  <div class="card scroll" style="padding:6px">${rows.length?`<table class="tbl"><tr><th>Staff</th><th class="num">Days worked</th><th class="num">Salary</th><th class="num">Advances</th><th class="num">Paid</th><th class="num">Balance</th><th></th></tr>
   ${rows.map(r=>`<tr><td><b>${esc(r.x.name)}</b><div class="small muted">${esc(r.x.role||'')}</div></td><td class="num">${r.d}</td><td class="num">${num(r.sal)}</td><td class="num">${r.adv?num(r.adv):'–'}</td><td class="num">${num(r.paid)}</td><td class="num ${r.bal>0?'low':'yes'}">${r.bal>0?num(r.bal):'✓ Paid'}</td><td class="num"><button class="btn sm ${r.bal>0?'primary':''}" data-act="salaryOpen" data-id="${esc(r.x.id)}" data-m="${prMonth}">Pay</button></td></tr>`).join('')}
   <tr class="sum"><td>Total</td><td></td><td class="num">${num(T.sal)}</td><td></td><td class="num">${num(T.paid)}</td><td class="num">${num(T.bal)}</td><td></td></tr></table>`:'<div class="empty">Add staff and their salaries under Staff & attendance.</div>'}</div>`;
};
ONCHANGE.add('pr-month');
IN['pr-month']=e=>{if(e.value){prMonth=e.value;render()}};

/* ---------- Access & portals ---------- */
VIEWS.access=()=>{
  if(!inAdmin())return adminOnly();
  const s=S();const P=(a,b)=>`<td class="num ${a?'yes':'no'}">${a?'✓':'—'}</td><td class="num ${b?'yes':'no'}">${b?'✓':'—'}</td>`;
  return `<div class="grid g2" style="align-items:start">
   <div class="card"><h3>Admin access</h3><p class="small muted" style="margin-top:-6px">Admin needs no PIN: your Claude account (owner) and anyone you share the app with as <b>Editor</b> open straight into the admin portal. Workers you share with as <b>Contributor</b> can never open admin.</p>
    <p class="small muted">To see the app the way workers do, tap <b>Worker portal</b> at the top, next to your photo.</p>
    <h3 style="margin-top:22px">Worker PINs</h3><p class="small muted" style="margin-top:-6px">Each worker signs in with their own PIN, so orders, payments and attendance are recorded under the right name. Set or change PINs on <a href="#staff">Staff &amp; attendance</a>.</p>
    ${activeStaff().map(x=>`<div class="spread small" style="padding:3px 0"><span>${esc(x.name)}</span>${x.pinHash?'<span class="yes">✓ PIN set</span>':'<span class="low">no PIN — cannot sign in</span>'}</div>`).join('')||'<p class="small muted">No staff yet.</p>'}
    <h3 style="margin-top:22px">Linked worker accounts</h3><p class="small muted" style="margin-top:-6px">Each worker signs in once with their own account (e.g. Google) and enters their PIN — this links the account to them. Unlink if a phone is lost or a worker leaves.</p>
    ${state.links.length?state.links.map(l=>{const st=findStaff(l.staffId);return `<div class="spread small" style="padding:5px 0;border-bottom:1px solid #f0ede6"><span><b>${esc(st?st.name:'Removed staff')}</b> · <span class="muted">${esc(profCache['n:'+l.id]||(l.id.startsWith('dev_')?'this browser':'signed-in account'))} · since ${fmtD(l.linkedAt)}</span></span><button class="btn sm danger" data-act="unlink" data-id="${esc(l.id)}">Unlink</button></div>`}).join(''):'<p class="small muted">No worker has linked an account yet.</p>'}

   </div>
   <div class="card"><h3>Who sees what</h3><div class="scroll"><table class="tbl"><tr><th>Area</th><th class="num">Admin</th><th class="num">Staff</th></tr>
    <tr><td>Take orders, payments, receipts</td>${P(1,1)}</tr><tr><td>Production board, pickups &amp; deliveries</td>${P(1,1)}</tr><tr><td>Log issues &amp; complaints</td>${P(1,1)}</tr><tr><td>Customer lookup</td>${P(1,1)}</tr><tr><td>Use stock</td>${P(1,1)}</tr><tr><td>View prices</td>${P(1,1)}</tr>
    <tr><td>Change prices, restock, suppliers</td>${P(1,0)}</tr><tr><td>Loyalty, promotions, campaigns</td>${P(1,0)}</tr><tr><td>Corporate accounts &amp; invoices</td>${P(1,0)}</tr><tr><td>Cash-up, debtors, expenses, P&amp;L, reports</td>${P(1,0)}</tr><tr><td>Staff, payroll, settings</td>${P(1,0)}</tr></table></div>
    <h3 style="margin-top:20px">Sharing the app</h3>
    <p class="small" style="margin-top:-4px">Share this page from claude.ai. The level you give each person decides what they can do:</p>
    <ul class="small" style="padding-left:18px;margin:0"><li><b>Owner / Editor</b> — opens straight into admin (no PIN) and can preview the worker portal.</li><li><b>Contributor</b> — share with each worker this way. Worker portal only, even if they learn the admin PIN. Expenses, invoices and salaries stay hidden from them.</li><li><b>Viewer</b> — can look but not change anything.</li></ul>
    <p class="small muted">Each worker uses their own Claude account and their own PIN. Admin is decided by the sharing level, so no admin PIN is needed.</p></div>
  </div>`;
};
Object.assign(ACT,{
  setAdminPin:async a=>{const p1=$('#apPin').value.trim(),p2=$('#apPin2').value.trim();if(!/^(\d{4}|\d{6})$/.test(p1)){toast('PIN must be 4 or 6 digits');return}if(p1!==p2){toast('PINs do not match');return}
    if(state.staff.some(x=>x.active!==false&&x.pinHash)&&await (async()=>{const h=await sha(p1);return state.staff.some(x=>x.pinHash===h)})()){toast('A staff member already uses that PIN — choose another');return}
    a.disabled=true;try{await putSettings({...S(),adminPinHash:await sha(p1),adminPinLen:p1.length});toast('Admin PIN set');render()}catch(e){a.disabled=false}},
  unlink:async a=>{if(!arm(a,'Unlink?'))return;try{await del('links',a.dataset.id);toast('Account unlinked')}catch(e){}},
  clearAdminPin:async a=>{if(!arm(a,'Remove PIN?'))return;try{await putSettings({...S(),adminPinHash:''});toast('Admin PIN removed');render()}catch(e){}}
});

/* ---------- Shop settings ---------- */
let sDraft=null;
FORM_ROUTES.add('settings');
RESET.push(r=>{if(r!=='settings')sDraft=null});
VIEWS.settings=()=>{
  if(!inAdmin())return adminOnly();
  if(!sDraft){const s=S();sDraft={};['shopName','phone','email','address','tin','vrn','currency','countryCode','expressPct','turnaround','expressTurnaround','vatPct','invoicePrefix','defaultTerms','bankDetails','invoiceNotes','receiptFooter','methods','trackStages'].forEach(k=>sDraft[k]=Array.isArray(s[k])?[...s[k]]:s[k])}
  const s=sDraft;const f=(k,l,t='text',extra='')=>`<label class="f">${l}<input type="${t}" data-f="s" data-k="${k}" value="${esc(s[k])}" ${extra}></label>`;
  return `<div id="formRoot"><div class="grid g2" style="align-items:start">
   <div class="card"><h3>Shop details</h3>${f('shopName','Shop name')}<div class="grid g2" style="gap:10px">${f('phone','Phone','tel')}${f('email','Email','email')}</div>${f('address','Address / location')}
    <div class="grid g2" style="gap:10px">${f('tin','TIN')}${f('vrn','VRN (if VAT registered)')}</div>
    <label class="f">Receipt footer<textarea data-f="s" data-k="receiptFooter">${esc(s.receiptFooter)}</textarea></label></div>
   <div><div class="card"><h3>Money &amp; timing</h3>
    <div class="grid g2" style="gap:10px">${f('currency','Currency label')}${f('countryCode','Phone country code','text','placeholder="255"')}</div>
    <label class="f">Payment methods <span style="font-weight:400">(comma separated)</span><input type="text" data-f="s" data-k="methods" value="${esc(s.methods.join(', '))}"></label>
    <div class="grid g3" style="gap:10px">${f('turnaround','Normal days','number','min="0"')}${f('expressTurnaround','Express days','number','min="0"')}${f('expressPct','Express +%','number','min="0"')}</div>
    <label class="check" style="margin-top:4px"><input type="checkbox" data-f="s" data-k="trackStages" ${s.trackStages?'checked':''}>Track production stages (Received → In process → Ready → Collected)</label>
    <p class="small muted" style="margin:-6px 0 0 26px">Off: orders are simply <b>In shop</b> until you tap <b>Collected</b>.</p></div>
   <div class="card"><h3>Invoices</h3>
    <div class="grid g3" style="gap:10px">${f('invoicePrefix','Number prefix')}${f('defaultTerms','Default terms (days)','number','min="0"')}${f('vatPct','VAT %','number','min="0"')}</div>
    <label class="f">Bank / mobile-money details for payment<textarea data-f="s" data-k="bankDetails" placeholder="CRDB Bank, A/C 0150xxxxxxx, Safi Dry Cleaners · Lipa namba 123456">${esc(s.bankDetails)}</textarea></label>
    <label class="f">Invoice note<textarea data-f="s" data-k="invoiceNotes">${esc(s.invoiceNotes)}</textarea></label></div></div>
  </div>
  <div class="row-actions"><button class="btn primary lg" data-act="saveSettings">Save settings</button><button class="btn" data-act="resetSettings">Discard changes</button></div></div>`;
};
IN['pv-who']=e=>{me=e.value;render()};
ONCHANGE.add('pv-who');
IN.s=e=>{if(e.type==='checkbox'){sDraft[e.dataset.k]=e.checked;return}let v=e.value;const k=e.dataset.k;if(e.type==='number')v=Math.max(0,+v||0);if(k==='methods')v=v.split(',').map(x=>x.trim()).filter(Boolean);sDraft[k]=v};
Object.assign(ACT,{
  resetSettings:()=>{sDraft=null;render();toast('Changes discarded')},
  saveSettings:async a=>{if(!String(sDraft.shopName||'').trim()){toast('Enter a shop name');return}const s={...S(),...sDraft};if(!s.methods.length)s.methods=['Cash'];
    a.disabled=true;try{await putSettings(s);sDraft=null;toast('Settings saved');render()}catch(e){a.disabled=false}}
});

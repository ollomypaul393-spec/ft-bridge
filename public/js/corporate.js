'use strict';
/* ================= CORPORATE INVOICING ================= */

/* ---------- Accounts ---------- */
VIEWS.accounts=()=>{
  if(!inAdmin())return adminOnly();
  const l=[...state.accounts].sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  const ub=sum(state.orders.filter(o=>o.accountId&&!o.invoiceId&&o.status!=='cancelled'),o=>calc(o).total);
  const out=sum(state.invoices.filter(v=>v.status!=='void'),v=>Math.max(0,invCalc(v).bal));
  return `<div class="kpis"><div class="kpi"><div class="l">Corporate accounts</div><div class="v">${l.filter(a=>a.active!==false).length}</div></div><div class="kpi"><div class="l">Not yet invoiced</div><div class="v">${money(ub)}</div><div class="s">orders waiting to be billed</div></div><div class="kpi ${out?'alert':''}"><div class="l">Invoices outstanding</div><div class="v">${money(out)}</div></div></div>
  <div class="toolbar"><span class="muted small grow">Hotels, offices, salons, schools — customers who drop off regularly and pay by invoice. Choose the account on <b>New order → Bill to</b>.</span><button class="btn primary" data-act="acctNew">+ Add account</button></div>
  <div class="list">${l.length?`<div class="li head" style="grid-template-columns:1.5fr .8fr 1fr 1fr auto"><div>Account</div><div class="hide-m">Terms</div><div class="hide-m">Unbilled</div><div class="hide-m">Outstanding</div><div></div></div>`+l.map(a=>{const u=unbilled(a.id);const o=sum(state.invoices.filter(v=>v.accountId===a.id&&v.status!=='void'),v=>Math.max(0,invCalc(v).bal));const od=state.invoices.some(v=>v.accountId===a.id&&invStatus(v)==='overdue');
    return `<div class="li m2" style="grid-template-columns:1.5fr .8fr 1fr 1fr auto" data-act="acctOpen" data-id="${esc(a.id)}"><div><div class="nm">${esc(a.name)}${a.active===false?' <span class="pill st-inactive">Inactive</span>':''}</div><div class="ph">${esc(a.contact||'')}${a.phone?' · '+esc(a.phone):''}${+a.discountPct?' · '+num(a.discountPct)+'% discount':''}</div></div><div class="hide-m small">${+a.terms||S().defaultTerms} days</div><div class="hide-m">${u.length?`${u.length} order${u.length>1?'s':''} · ${money(sum(u,o=>calc(o).total))}`:'<span class="muted">—</span>'}</div><div class="hide-m ${od?'low':''}">${o?money(o):'<span class="muted">—</span>'}</div><div>${u.length?`<button class="btn sm primary" data-act="invNew" data-id="${esc(a.id)}">Invoice</button>`:''}</div></div>`}).join(''):'<div class="empty">No corporate accounts yet.</div>'}</div>`;
};
MODALS.account=id=>{
  const a=id?findAccount(id):{active:true,terms:S().defaultTerms};if(id&&!a)return null;
  const u=id?unbilled(id):[];const invs=id?state.invoices.filter(v=>v.accountId===id).sort((x,y)=>x.date<y.date?1:-1):[];
  return `<div class="hd"><h2>${id?esc(a.name):'Add corporate account'}</h2>${closeX}</div>
  <div class="grid g2" style="gap:10px"><label class="f">Company name<input type="text" id="acName" value="${esc(a.name||'')}" ${id?'':'autofocus'}></label><label class="f">Contact person<input type="text" id="acContact" value="${esc(a.contact||'')}"></label></div>
  <div class="grid g3" style="gap:10px"><label class="f">Phone<input type="tel" id="acPhone" value="${esc(a.phone||'')}"></label><label class="f">Email<input type="email" id="acEmail" value="${esc(a.email||'')}"></label><label class="f">TIN<input type="text" id="acTin" value="${esc(a.tin||'')}"></label></div>
  <label class="f">Billing address<input type="text" id="acAddr" value="${esc(a.address||'')}"></label>
  <div class="grid g3" style="gap:10px"><label class="f">Payment terms (days)<input type="number" min="0" id="acTerms" value="${+a.terms||0}"></label><label class="f">Account discount %<input type="number" min="0" max="100" id="acDisc" value="${+a.discountPct||0}"></label><label class="check" style="align-self:end"><input type="checkbox" id="acActive" ${a.active!==false?'checked':''}>Active</label></div>
  <label class="f">Notes<textarea id="acNotes" placeholder="PO number required, delivery days…">${esc(a.notes||'')}</textarea></label>
  <div class="row-actions"><button class="btn primary" data-act="acctSave">Save account</button>${u.length?`<button class="btn" data-act="invNew" data-id="${esc(id)}">Create invoice (${u.length} orders)</button>`:''}</div>
  ${id?`<section><h4>Unbilled orders</h4>${u.length?`<div class="list">${u.map(orderRow).join('')}</div>`:'<p class="small muted">None.</p>'}</section>
  <section><h4>Invoices</h4>${invs.length?invs.map(v=>`<div class="spread" style="padding:5px 0"><a href="#" data-act="invOpen" data-id="${esc(v.id)}" class="mono">${esc(v.number)}</a><span class="small muted">${fmtD(v.date)}</span><b>${money(v.total)}</b>${pill(invStatus(v))}</div>`).join(''):'<p class="small muted">None yet.</p>'}</section>`:''}`;
};
Object.assign(ACT,{
  acctNew:()=>openModal('account'),
  acctOpen:(a,e)=>{if(e)e.preventDefault();openModal('account',a.dataset.id)},
  acctSave:async a=>{const id=modal.id;const name=$('#acName').value.trim();if(!name){toast('Enter the company name');return}
    const base=id?findAccount(id):{id:uid(),createdAt:Date.now()};a.disabled=true;
    try{await put('accounts',{...base,name,contact:$('#acContact').value.trim(),phone:$('#acPhone').value.trim(),email:$('#acEmail').value.trim(),tin:$('#acTin').value.trim(),address:$('#acAddr').value.trim(),terms:Math.max(0,+$('#acTerms').value||0),discountPct:Math.min(100,Math.max(0,+$('#acDisc').value||0)),active:$('#acActive').checked,notes:$('#acNotes').value.trim()});toast('Account saved');if(!id)openModal('account',base.id);else a.disabled=false}catch(e){a.disabled=false}}
});

/* ---------- Invoices ---------- */
let invF='outstanding';
VIEWS.invoices=()=>{
  if(!inAdmin())return adminOnly();
  const st=v=>invStatus(v);
  const f={outstanding:v=>['draft','sent','overdue'].includes(st(v)),overdue:v=>st(v)==='overdue',paid:v=>st(v)==='paid',void:v=>st(v)==='void',all:()=>true};
  const tabs=[['unbilled','Ready to invoice'],['outstanding','Outstanding'],['overdue','Overdue'],['paid','Paid'],['void','Void'],['all','All']];
  const accU=state.accounts.map(a=>({a,u:unbilled(a.id)})).filter(x=>x.u.length);
  const out=state.invoices.filter(f.outstanding),od=state.invoices.filter(f.overdue);
  const T=todayStr(),ym=T.slice(0,7);const paidM=sum(state.invoices.flatMap(v=>v.status==='void'?[]:(v.payments||[])).filter(p=>dayOf(p.at).startsWith(ym)),p=>p.amount);
  let body;
  if(invF==='unbilled')body=accU.length?`<div class="li head" style="grid-template-columns:1.5fr 1fr 1fr 1fr auto"><div>Account</div><div class="hide-m">Orders</div><div class="hide-m">Oldest</div><div>Value</div><div></div></div>`+accU.map(({a,u})=>`<div class="li m2" style="grid-template-columns:1.5fr 1fr 1fr 1fr auto" data-act="acctOpen" data-id="${esc(a.id)}"><div class="nm">${esc(a.name)}</div><div class="hide-m">${u.length} · ${sum(u,o=>calc(o).pieces)} pc</div><div class="hide-m small">${fmtD(Math.min(...u.map(o=>o.createdAt)))}</div><div><b>${money(sum(u,o=>calc(o).total))}</b></div><div><button class="btn sm primary" data-act="invNew" data-id="${esc(a.id)}">Create invoice</button></div></div>`).join(''):'<div class="empty">Nothing waiting to be invoiced.</div>';
  else{const l=state.invoices.filter(f[invF]).sort((a,b)=>a.date<b.date?1:-1);
    body=l.length?`<div class="li head" style="grid-template-columns:1.1fr 1.5fr .9fr .9fr 1fr 1fr auto"><div>Number</div><div>Account</div><div class="hide-m">Date</div><div class="hide-m">Due</div><div class="hide-m r">Total</div><div class="r">Balance</div><div></div></div>`+l.map(v=>{const c=invCalc(v);return `<div class="li m2" style="grid-template-columns:1.1fr 1.5fr .9fr .9fr 1fr 1fr auto" data-act="invOpen" data-id="${esc(v.id)}"><div class="mono hide-m">${esc(v.number)}</div><div><div class="nm">${esc(v.accountName)}</div><div class="ph"><span class="mono">${esc(v.number)}</span> · ${(v.lines||[]).length} orders</div></div><div class="hide-m small">${fmtD(v.date)}</div><div class="hide-m small">${fmtD(v.dueDate)}</div><div class="hide-m r">${money(c.total)}</div><div class="r"><b>${money(Math.max(0,c.bal))}</b></div><div class="r">${pill(invStatus(v))}</div></div>`}).join(''):'<div class="empty">No invoices here.</div>'}
  return `<div class="kpis"><div class="kpi"><div class="l">Outstanding</div><div class="v">${money(sum(out,v=>invCalc(v).bal))}</div><div class="s">${out.length} invoices</div></div><div class="kpi ${od.length?'alert':''}"><div class="l">Overdue</div><div class="v">${money(sum(od,v=>invCalc(v).bal))}</div><div class="s">${od.length} invoices</div></div><div class="kpi"><div class="l">Ready to invoice</div><div class="v">${money(sum(accU.flatMap(x=>x.u),o=>calc(o).total))}</div><div class="s">${accU.length} accounts</div></div><div class="kpi good"><div class="l">Received this month</div><div class="v">${money(paidM)}</div></div></div>
  <div class="toolbar"><div class="tabs" style="margin:0">${tabs.map(([k,lb])=>`<button class="tab ${invF===k?'on':''}" data-act="invTab" data-s="${k}">${lb}<span class="n">${k==='unbilled'?accU.length:state.invoices.filter(f[k]).length}</span></button>`).join('')}</div><span class="grow"></span><button class="btn primary" data-act="invNew">+ New invoice</button></div>
  <div class="list">${body}</div>`;
};
MODALS.newInvoice=()=>{
  const p=modal.pre,s=S();const accts=state.accounts.filter(a=>unbilled(a.id).length||a.id===p.accountId);
  if(!p.accountId&&accts.length)p.accountId=accts[0].id;
  const a=findAccount(p.accountId);const all=a?unbilled(a.id).sort((x,y)=>x.createdAt-y.createdAt):[];
  if(!p.from&&all.length)p.from=dayOf(all[0].createdAt);if(!p.to)p.to=todayStr();if(!p.excl)p.excl=[];
  const inR=all.filter(o=>{const d=dayOf(o.createdAt);return d>=p.from&&d<=p.to});
  const chosen=inR.filter(o=>!p.excl.includes(o.id));const sub=sum(chosen,o=>calc(o).total);const vat=Math.round(sub*(+s.vatPct||0)/100);
  return `<div class="hd"><h2>New invoice</h2>${closeX}</div>
  ${accts.length?`<div class="grid g3" style="gap:10px"><label class="f">Account<select data-f="ni" data-k="accountId">${accts.map(x=>`<option value="${esc(x.id)}" ${x.id===p.accountId?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label><label class="f">Orders from<input type="date" data-f="ni" data-k="from" value="${esc(p.from||'')}"></label><label class="f">to<input type="date" data-f="ni" data-k="to" value="${esc(p.to)}"></label></div>
  ${inR.length?`<table class="tbl"><tr><th></th><th>Ticket</th><th>Date</th><th>Items</th><th class="num">Amount</th></tr>${inR.map(o=>{const c=calc(o);return `<tr><td><input type="checkbox" data-f="ni-x" data-id="${esc(o.id)}" ${p.excl.includes(o.id)?'':'checked'}></td><td class="mono">${esc(o.ticket)}</td><td>${fmtD(o.createdAt)}</td><td class="small">${c.pieces} pc${o.customerName&&o.customerName!==a.name?' · '+esc(o.customerName):''}</td><td class="num">${money(c.total)}</td></tr>`}).join('')}</table>
  <div class="tot" style="max-width:320px;margin:14px 0 14px auto"><span class="muted">Subtotal</span><span>${money(sub)}</span>${+s.vatPct?`<span class="muted">VAT ${num(s.vatPct)}%</span><span>${money(vat)}</span>`:''}<span class="big">Total</span><span class="big">${money(sub+vat)}</span></div>
  <div class="grid g2" style="gap:10px"><label class="f">Invoice date<input type="date" id="niDate" value="${todayStr()}"></label><label class="f">PO / reference (optional)<input type="text" id="niRef"></label></div>
  <button class="btn primary" data-act="invCreate" ${chosen.length?'':'disabled'}>Create invoice for ${chosen.length} order${chosen.length===1?'':'s'}</button>`:'<p class="muted">No unbilled orders for this account in that period.</p>'}`:'<p class="muted">No corporate orders are waiting to be invoiced. Choose a corporate account under <b>Bill to</b> when taking an order.</p>'}`;
};
IN.ni=e=>{modal.pre[e.dataset.k]=e.value;if(e.dataset.k==='accountId'){modal.pre.from='';modal.pre.excl=[]}renderModal()};
IN['ni-x']=e=>{const ex=modal.pre.excl;const i=ex.indexOf(e.dataset.id);if(e.checked&&i>=0)ex.splice(i,1);if(!e.checked&&i<0)ex.push(e.dataset.id);renderModal()};
ONCHANGE.add('ni');
function invText(v){
  const s=S(),c=invCalc(v),a=findAccount(v.accountId)||{};
  const L=[`*${s.shopName}* — TAX INVOICE ${v.number}`,s.tin?`TIN ${s.tin}${s.vrn?' · VRN '+s.vrn:''}`:'',`Date: ${fmtD(v.date)}   Due: ${fmtD(v.dueDate)}`,`Bill to: ${v.accountName}${a.tin?' (TIN '+a.tin+')':''}`,v.ref?`Ref: ${v.ref}`:'','',...(v.lines||[]).map(l=>`${fmtD(l.date)}  #${l.ticket}  ${l.pieces} pc  ${money(l.amount)}`),'',`Subtotal: ${money(c.sub)}`,c.vat?`VAT ${v.vatPct}%: ${money(c.vat)}`:'',`TOTAL: ${money(c.total)}`,c.paid?`Paid: ${money(c.paid)}`:'',`BALANCE DUE: ${money(Math.max(0,c.bal))}`,'',s.bankDetails?'Pay to: '+s.bankDetails:'',s.invoiceNotes||''];
  return L.filter((x,i)=>x!==''||L[i-1]!=='').join('\n').trim();
}
MODALS.invoice=id=>{
  const v=findInvoice(id);if(!v)return null;const s=S(),c=invCalc(v),a=findAccount(v.accountId)||{},st=invStatus(v);
  return `<div class="hd"><div><h2>Invoice <span class="mono">${esc(v.number)}</span></h2><div style="margin-top:6px">${pill(st)}</div></div>${closeX}</div>
  <div class="invdoc"><div class="ih"><div><h1>${esc(s.shopName)}</h1><div class="small muted">${esc(s.address)}${s.phone?'<br>Tel '+esc(s.phone):''}${s.email?' · '+esc(s.email):''}${s.tin?'<br>TIN '+esc(s.tin):''}${s.vrn?' · VRN '+esc(s.vrn):''}</div></div>
   <div style="text-align:right"><div class="crumb">${+v.vatPct?'Tax invoice':'Invoice'}</div><div class="mono" style="font-size:17px"><b>${esc(v.number)}</b></div><div class="small">Date ${fmtD(v.date)}<br>Due ${fmtD(v.dueDate)}${v.ref?'<br>Ref '+esc(v.ref):''}</div></div></div>
   <div style="margin-top:14px"><div class="small muted">Bill to</div><b>${esc(v.accountName)}</b><div class="small">${esc(a.contact||'')}${a.address?'<br>'+esc(a.address):''}${a.tin?'<br>TIN '+esc(a.tin):''}</div></div>
   <table><tr><th>Date</th><th>Ticket</th><th>Description</th><th class="tr">Amount</th></tr>${(v.lines||[]).map(l=>`<tr><td>${fmtD(l.date)}</td><td class="mono"><a href="#" data-act="openOrderX" data-id="${esc(l.orderId)}">${esc(l.ticket)}</a></td><td class="small">${esc(l.desc||l.pieces+' pieces')}</td><td class="tr">${money(l.amount)}</td></tr>`).join('')}</table>
   <div class="tot totals"><span class="muted">Subtotal</span><span>${money(c.sub)}</span>${c.vat?`<span class="muted">VAT ${num(v.vatPct)}%</span><span>${money(c.vat)}</span>`:''}<span class="big">Total</span><span class="big">${money(c.total)}</span>${c.paid?`<span class="muted">Paid</span><span>−${money(c.paid)}</span>`:''}<span><b>Balance due</b></span><span><b style="color:${c.bal>0?'var(--danger)':'#22a06b'}">${money(Math.max(0,c.bal))}</b></span></div>
   ${s.bankDetails||s.invoiceNotes?`<p class="small muted" style="margin-bottom:0">${s.bankDetails?'<b>Pay to:</b> '+esc(s.bankDetails)+'<br>':''}${esc(s.invoiceNotes||'')}</p>`:''}</div>
  ${(v.payments||[]).length?`<section><h4>Payments received</h4>${v.payments.map(p=>`<div class="spread small" style="padding:3px 0"><span>${fmtDT(p.at)} · ${esc(p.method)}${p.ref?' · '+esc(p.ref):''}</span><b>${money(p.amount)}</b></div>`).join('')}</section>`:''}
  ${st!=='void'&&c.bal>0?`<section><h4>Record payment</h4><div class="inline"><input type="number" min="0" id="ipAmt" value="${c.bal}"><select id="ipMethod">${opts(s.methods,'Bank')}</select><input type="text" id="ipRef" placeholder="Reference"><button class="btn primary" data-act="invPay">Record</button></div></section>`:''}
  <section class="spread"><div class="row-actions"><button class="btn" data-act="invCopy">Copy invoice text</button>${a.phone?`<a class="btn wa" target="_blank" rel="noopener" href="${esc(waLink(a.phone,invText(v)))}">Send on WhatsApp</a>`:''}${st==='draft'?'<button class="btn dark" data-act="invSent">Mark as sent</button>':''}</div>
   ${st!=='void'&&!c.paid?'<button class="btn sm danger" data-act="invVoid">Void invoice</button>':''}</section>`;
};
Object.assign(ACT,{
  invTab:a=>{invF=a.dataset.s;render()},
  invNew:(a,e)=>{if(e)e.stopPropagation();openModal('newInvoice',null,{accountId:a.dataset.id||''})},
  invOpen:(a,e)=>{if(e)e.preventDefault();openModal('invoice',a.dataset.id)},
  openOrderX:(a,e)=>{e.preventDefault();openModal('order',a.dataset.id)},
  invCreate:async a=>{
    const p=modal.pre,s=S(),acct=findAccount(p.accountId);if(!acct)return;
    const os=unbilled(acct.id).filter(o=>{const d=dayOf(o.createdAt);return d>=p.from&&d<=p.to&&!p.excl.includes(o.id)});if(!os.length)return;
    const date=$('#niDate').value||todayStr();
    const lines=os.sort((x,y)=>x.createdAt-y.createdAt).map(o=>{const c=calc(o);return {orderId:o.id,ticket:o.ticket,date:dayOf(o.createdAt),pieces:c.pieces,desc:(o.items||[]).filter(i=>i.service!=='fee').map(i=>`${i.qty}× ${i.garment}`).join(', ')+((o.items||[]).some(i=>i.service==='fee')?' + fees':''),amount:c.total}});
    const subtotal=sum(lines,l=>l.amount),vatPct=+s.vatPct||0,vat=Math.round(subtotal*vatPct/100);
    const inv={id:uid(),number:nextInvNo(),accountId:acct.id,accountName:acct.name,date,dueDate:addDays(date,+acct.terms||+s.defaultTerms||0),ref:$('#niRef').value.trim(),lines,subtotal,vatPct,vat,total:subtotal+vat,payments:[],status:'draft',createdAt:Date.now()};
    a.disabled=true;
    try{await put('invoices',inv);for(const o of os)await put('orders',{...o,invoiceId:inv.id,invoiceNo:inv.number});toast('Invoice '+inv.number+' created');openModal('invoice',inv.id)}catch(e){a.disabled=false}},
  invPay:async a=>{const v=findInvoice(modal.id);const amt=Math.max(0,+$('#ipAmt').value||0);if(!amt){toast('Enter an amount');return}a.disabled=true;
    try{await put('invoices',{...v,status:v.status==='draft'?'sent':v.status,payments:[...(v.payments||[]),{amount:amt,method:$('#ipMethod').value,ref:$('#ipRef').value.trim(),at:Date.now()}]});toast('Payment recorded');renderModal()}catch(e){a.disabled=false}},
  invSent:async()=>{const v=findInvoice(modal.id);try{await put('invoices',{...v,status:'sent',sentAt:Date.now()});toast('Marked as sent')}catch(e){}},
  invCopy:()=>copyText(invText(findInvoice(modal.id)),'Invoice copied'),
  invVoid:async a=>{if(!arm(a,'Void this invoice?'))return;const v=findInvoice(modal.id);
    try{await put('invoices',{...v,status:'void'});for(const l of v.lines||[]){const o=findOrder(l.orderId);if(o&&o.invoiceId===v.id)await put('orders',{...o,invoiceId:'',invoiceNo:''})}toast('Invoice voided — orders are unbilled again')}catch(e){}}
});

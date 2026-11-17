'use strict';
/* ================= ORDERS & FULFILMENT ================= */

/* ---------- New order ---------- */
let draft=null,lastStaff='';
FORM_ROUTES.add('new-order');
const priceItem=id=>S().priceList.find(p=>p.id===id);
const firstSvc=p=>(SVC().find(s=>(+p.prices[s.k]||0)>0)||SVC()[0]).k;
function newDraft(c){const s=S();return {staffId:inAdmin()?lastStaff:(meStaff()?me:''),customerId:c?c.id:null,name:c?c.name:'',phone:c?c.phone:'',accountId:'',items:[],express:false,discount:0,dueDate:addDays(todayStr(),s.turnaround),deposit:'',method:s.methods[0],notes:'',promoCode:'',usePoints:false}}
function composeDraft(){
  const s=S(),d=draft;
  const o={...d,expressPct:d.express?+s.expressPct:0,discount:+d.discount||0,acctDisc:0,promoDisc:0,loyaltyDisc:0,pointsUsed:0,promoCode:''};
  const c0=calc(o),gross=c0.sub+c0.exp;
  const acct=d.accountId?findAccount(d.accountId):null;
  if(acct&&+acct.discountPct>0)o.acctDisc=Math.round(gross*acct.discountPct/100);
  let promoMsg='';
  if(!acct&&d.promoCode){const r=checkPromo(d.promoCode,Math.max(0,gross-o.acctDisc-o.discount));if(r.ok){o.promoDisc=r.disc;o.promoCode=r.p.code}else promoMsg=r.msg}
  if(!acct&&d.usePoints&&d.customerId&&s.loyalty.enabled){const pts=custPoints(d.customerId);const room=Math.max(0,gross-o.acctDisc-o.promoDisc-o.discount);const pv=Math.max(1,+s.loyalty.pointValue||1);const val=Math.min(pts*pv,room);o.pointsUsed=Math.ceil(val/pv);o.loyaltyDisc=Math.round(val)}
  if(acct){o.discount=0}
  return {o,c:calc(o),promoMsg,acct};
}
VIEWS['new-order']=()=>{
  if(!draft)draft=newDraft();
  const s=S(),accts=state.accounts.filter(a=>a.active!==false),acct=draft.accountId?findAccount(draft.accountId):null,ms=meStaff();
  const cats=[...new Set(s.priceList.map(p=>p.cat||'Garments'))].sort((a,b)=>(PRICE_CATS.indexOf(a)+99)%99-(PRICE_CATS.indexOf(b)+99)%99);
  const minP=p=>Math.min(...SVC().map(x=>+p.prices[x.k]||0).filter(v=>v>0).concat([1e12]));
  return `<div id="formRoot"><div class="grid g2">
   <div class="card"><h3>Customer</h3>
    ${accts.length?`<label class="f">Bill to<select data-f="d-acct"><option value="">Walk-in customer — pays at the counter</option>${accts.map(a=>`<option value="${esc(a.id)}" ${a.id===draft.accountId?'selected':''}>Corporate: ${esc(a.name)}</option>`).join('')}</select></label>`:''}
    <label class="f">Phone<input type="tel" data-f="d-phone" id="dPhone" value="${esc(draft.phone)}" placeholder="e.g. 0712 345 678" autocomplete="off"></label>
    <label class="f">${acct?'Contact / dropped off by':'Name'}<input type="text" data-f="d-name" id="dName" value="${esc(draft.name)}" placeholder="Customer name" autocomplete="off"></label>
    <div id="custSugg"></div>
   </div>
   <div class="card"><h3>Pickup</h3>
    <label class="check"><input type="checkbox" data-f="d-express" ${draft.express?'checked':''}>Express service (+${num(s.expressPct)}%)</label>
    <label class="f">Ready by<input type="date" id="dDue" data-f="d-due" value="${esc(draft.dueDate)}"></label>
    ${inAdmin()?(activeStaff().length?`<label class="f">Served by<select data-f="d-staff"><option value="">—</option>${activeStaff().map(x=>`<option value="${esc(x.id)}" ${x.id===draft.staffId?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>`:''):`<p class="small muted" style="margin:0 0 12px">Served by <b style="color:var(--ink)">${esc(ms?ms.name:'—')}</b></p>`}
    <label class="f">Order notes<textarea data-f="d-notes" placeholder="Stains, missing buttons, special instructions…">${esc(draft.notes)}</textarea></label>
   </div>
  </div>
  <div class="card"><h3>Garments <span class="sub">tap to add — tap again for more</span></h3>
   ${cats.map(c=>`<div class="chipcat">${esc(c)}</div><div class="chips">${s.priceList.filter(p=>(p.cat||'Garments')===c).map(p=>{const m=minP(p);return `<button class="chip" data-act="addItem" data-pid="${esc(p.id)}">${esc(p.name)}<small>${m<1e12?'from '+num(m):'set price'}</small></button>`}).join('')}</div>`).join('')}
   <div class="chips"><button class="chip" data-act="addCustom">+ Other item<small>custom price</small></button></div>
   <div id="itemsBox"></div>
  </div>
  <div class="card"><div class="grid g2">
   <div><h3>Payment</h3>
    ${acct?`<div class="banner info" style="margin:0">Billed to <b>${esc(acct.name)}</b>${+acct.discountPct?` with their ${num(acct.discountPct)}% account discount`:''}. This order goes on their next invoice — no payment at the counter.</div>`:`
    <div class="grid g2" style="gap:10px"><label class="f">Discount (${esc(s.currency)})<input type="number" min="0" data-f="d-discount" value="${draft.discount||''}" placeholder="0"></label>
    <label class="f">Promo code<input type="text" data-f="d-promo" value="${esc(draft.promoCode)}" placeholder="e.g. KARIBU10" style="text-transform:uppercase" autocomplete="off"></label></div>
    <div id="loyBox"></div>
    <div class="grid g2" style="gap:10px"><label class="f">Paid now<input type="number" min="0" id="dDeposit" data-f="d-deposit" value="${esc(draft.deposit)}" placeholder="0"></label>
    <label class="f">Method<select data-f="d-method">${opts(s.methods,draft.method)}</select></label></div>
    <button class="btn sm" data-act="payFull">Paid in full</button>`}
   </div>
   <div><h3>Summary</h3><div id="totalsBox"></div>
    <div class="row-actions" style="margin-top:16px"><button class="btn primary lg" data-act="saveOrder" id="saveOrderBtn">Save order &amp; show ticket</button><button class="btn" data-act="clearDraft">Clear</button></div>
   </div></div></div></div>`;
};
AFTER['new-order']=()=>{renderItems();renderTotals();renderSugg()};
REFRESH['new-order']=()=>renderSugg();
function renderItems(){
  const s=S(),box=$('#itemsBox');if(!box)return;
  if(!draft.items.length){box.innerHTML='<div class="empty" style="padding:16px">No garments added yet.</div>';return}
  box.innerHTML=`<table class="items"><thead><tr><th>Garment</th><th>Service</th><th>Qty</th><th>Unit price</th><th>Colour / notes</th><th></th></tr></thead><tbody>${draft.items.map((it,i)=>{
    const p=it.pid!=='custom'?priceItem(it.pid):null;
    const g=p?`<select data-f="i-garment" data-i="${i}">${s.priceList.map(x=>`<option value="${esc(x.id)}" ${x.id===it.pid?'selected':''}>${esc(x.name)}</option>`).join('')}</select>`:`<input type="text" data-f="i-gname" data-i="${i}" value="${esc(it.garment)}" placeholder="Item name">`;
    const sv=`<select data-f="i-service" data-i="${i}">${SVC().filter(x=>!p||(+p.prices[x.k]||0)>0||x.k===it.service).map(x=>`<option value="${x.k}" ${x.k===it.service?'selected':''}>${x.label}</option>`).join('')}</select>`;
    return `<tr><td>${g}</td><td>${sv}</td><td><input class="q" type="number" min="1" data-f="i-qty" data-i="${i}" value="${it.qty}"></td><td><input class="p" type="number" min="0" data-f="i-price" data-i="${i}" value="${it.price}"></td><td><input type="text" data-f="i-note" data-i="${i}" value="${esc(it.note)}" placeholder="e.g. navy, coffee stain"></td><td class="x"><button class="xbtn" data-act="rmItem" data-i="${i}" title="Remove">×</button></td></tr>`}).join('')}</tbody></table>`;
}
function renderTotals(){
  const b=$('#totalsBox');if(!b)return;const {o,c,promoMsg,acct}=composeDraft(),dep=+draft.deposit||0,s=S();
  b.innerHTML=`<div class="tot"><span class="muted">${c.pieces} piece${c.pieces===1?'':'s'} — subtotal</span><span>${money(c.sub)}</span>
   ${c.exp?`<span class="muted">Express +${num(s.expressPct)}%</span><span>${money(c.exp)}</span>`:''}
   ${o.acctDisc?`<span class="muted">Account discount</span><span>−${money(o.acctDisc)}</span>`:''}
   ${o.discount?`<span class="muted">Discount</span><span>−${money(o.discount)}</span>`:''}
   ${o.promoDisc?`<span class="muted">Promo ${esc(o.promoCode)}</span><span>−${money(o.promoDisc)}</span>`:''}
   ${promoMsg?`<span class="err-note" style="grid-column:1/-1">${esc(promoMsg)}</span>`:''}
   ${o.loyaltyDisc?`<span class="muted">Loyalty (${o.pointsUsed} pts)</span><span>−${money(o.loyaltyDisc)}</span>`:''}
   <span class="big">Total</span><span class="big">${money(c.total)}</span>
   ${acct?`<span class="muted">Billing</span><span>On account</span>`:`<span class="muted">Paid now</span><span>${money(dep)}</span><span class="muted">Balance on pickup</span><span><b>${money(Math.max(0,c.total-dep))}</b></span>`}</div>`;
}
function renderLoy(){
  const box=$('#loyBox');if(!box)return;const L=S().loyalty;
  if(!L.enabled||!draft.customerId){box.innerHTML='';return}
  const pts=custPoints(draft.customerId);
  box.innerHTML=pts>=(+L.minRedeem||0)&&pts>0?`<label class="check"><input type="checkbox" data-f="d-points" ${draft.usePoints?'checked':''}>Redeem ${num(pts)} loyalty points (worth up to ${money(pts*L.pointValue)})</label>`:`<p class="small muted" style="margin:-4px 0 12px">${num(pts)} loyalty points${pts<+L.minRedeem?` · redeemable from ${num(L.minRedeem)}`:''}</p>`;
}
function renderSugg(){
  const box=$('#custSugg');if(!box||!draft)return;
  if(draft.customerId){const st=custStats()[draft.customerId];box.innerHTML=`<div class="ok-note">✓ Returning customer · ${st?st.orders:0} previous order${st&&st.orders===1?'':'s'}${st&&st.bal>0?` · <span style="color:var(--danger)">owes ${money(st.bal)}</span>`:''}</div>`;renderLoy();return}
  const qp=normPhone(draft.phone),qn=draft.name.trim().toLowerCase();
  if(qp.length<3&&qn.length<2){box.innerHTML='';renderLoy();return}
  const m=state.customers.filter(c=>(qp.length>=3&&normPhone(c.phone).includes(qp))||(qn.length>=2&&String(c.name||'').toLowerCase().includes(qn))).slice(0,5);
  box.innerHTML=m.length?`<div class="sugg">${m.map(c=>`<button data-act="pickCust" data-id="${esc(c.id)}"><b>${esc(c.name)}</b> · ${esc(c.phone)}</button>`).join('')}</div>`:(qp.length>=6?'<div class="small muted" style="margin:-4px 0 10px">New customer — will be saved with this order.</div>':'');
  renderLoy();
}
Object.assign(IN,{
  'd-phone':e=>{draft.phone=e.value;draft.customerId=null;draft.usePoints=false;renderSugg();renderTotals()},
  'd-name':e=>{draft.name=e.value;if(!draft.customerId)renderSugg()},
  'd-due':e=>draft.dueDate=e.value,
  'd-notes':e=>draft.notes=e.value,
  'd-staff':e=>draft.staffId=e.value,
  'd-acct':e=>{draft.accountId=e.value;const a=findAccount(e.value);if(a){draft.name=a.contact||a.name;draft.phone=a.phone||draft.phone;draft.customerId=null;draft.usePoints=false;draft.promoCode='';draft.deposit=''}render()},
  'd-discount':e=>{draft.discount=Math.max(0,+e.value||0);renderTotals()},
  'd-promo':e=>{draft.promoCode=e.value.trim().toUpperCase();renderTotals()},
  'd-points':e=>{draft.usePoints=e.checked;renderTotals()},
  'd-deposit':e=>{draft.deposit=e.value;renderTotals()},
  'd-method':e=>draft.method=e.value,
  'd-express':e=>{const s=S();draft.express=e.checked;draft.dueDate=addDays(todayStr(),draft.express?s.expressTurnaround:s.turnaround);$('#dDue').value=draft.dueDate;renderTotals()},
  'i-qty':e=>{draft.items[+e.dataset.i].qty=Math.max(0,+e.value||0);renderTotals()},
  'i-price':e=>{draft.items[+e.dataset.i].price=Math.max(0,+e.value||0);renderTotals()},
  'i-note':e=>draft.items[+e.dataset.i].note=e.value,
  'i-gname':e=>draft.items[+e.dataset.i].garment=e.value,
  'i-garment':e=>{const it=draft.items[+e.dataset.i],p=priceItem(e.value);if(!p)return;it.pid=p.id;it.garment=p.name;if(!((+p.prices[it.service]||0)>0))it.service=firstSvc(p);it.price=+p.prices[it.service]||0;renderItems();renderTotals()},
  'i-service':e=>{const it=draft.items[+e.dataset.i];it.service=e.value;const p=it.pid!=='custom'&&priceItem(it.pid);if(p)it.price=+p.prices[it.service]||0;renderItems();renderTotals()}
});
Object.assign(ACT,{
  addItem:a=>{const p=priceItem(a.dataset.pid);if(!p)return;const sv=firstSvc(p);const last=draft.items[draft.items.length-1];
    if(last&&last.pid===p.id&&last.service===sv&&!last.note)last.qty++;else draft.items.push({pid:p.id,garment:p.name,service:sv,qty:1,price:+p.prices[sv]||0,note:''});renderItems();renderTotals()},
  addCustom:()=>{draft.items.push({pid:'custom',garment:'',service:'dry',qty:1,price:0,note:''});renderItems();renderTotals();const ins=$$('[data-f="i-gname"]');if(ins.length)ins[ins.length-1].focus()},
  rmItem:a=>{draft.items.splice(+a.dataset.i,1);renderItems();renderTotals()},
  pickCust:a=>{const c=findCust(a.dataset.id);if(!c)return;draft.customerId=c.id;draft.name=c.name;draft.phone=c.phone;$('#dName').value=c.name;$('#dPhone').value=c.phone;renderSugg();renderTotals()},
  payFull:()=>{const {c}=composeDraft();draft.deposit=String(c.total);$('#dDeposit').value=c.total;renderTotals()},
  clearDraft:a=>{if(!arm(a,'Clear everything?'))return;draft=null;render()},
  saveOrder:async a=>{
    const name=draft.name.trim(),phone=draft.phone.trim();
    if(!name||!phone){toast('Enter the customer’s name and phone');return}
    if(!draft.items.some(i=>(+i.qty||0)>0)){toast('Add at least one garment');return}
    const {o:cd,promoMsg,acct}=composeDraft();
    if(promoMsg&&draft.promoCode){toast('Fix or clear the promo code first');return}
    a.disabled=true;
    try{
      const s=S();let cust=draft.customerId&&findCust(draft.customerId);
      if(!cust){const np=normPhone(phone);cust=np.length>=6&&state.customers.find(c=>normPhone(c.phone)===np)}
      if(!cust){cust={id:uid(),name,phone,address:'',notes:'',accountId:acct?acct.id:'',createdAt:Date.now()};await put('customers',cust)}
      const now=Date.now(),dep=acct?0:Math.max(0,+draft.deposit||0);
      const staffId=inAdmin()?(draft.staffId||''):(meStaff()?me:'');
      const items=draft.items.filter(i=>(+i.qty||0)>0).map(i=>({...i,garment:(i.garment||'').trim()||'Item'}));
      const o={id:uid(),ticket:newTicket(),customerId:cust.id,customerName:name,phone,items,express:draft.express,expressPct:cd.expressPct,
        discount:cd.discount,acctDisc:cd.acctDisc,promoCode:cd.promoCode||'',promoDisc:cd.promoDisc,loyaltyDisc:cd.loyaltyDisc,pointsUsed:cd.pointsUsed,
        accountId:acct?acct.id:'',accountName:acct?acct.name:'',invoiceId:'',
        dueDate:draft.dueDate||addDays(todayStr(),s.turnaround),notes:draft.notes.trim(),status:'received',
        staffId,staffName:(findStaff(staffId)||{}).name||'',statusAt:{received:now},
        payments:dep>0?[{amount:dep,method:draft.method||s.methods[0],at:now,by:myName()}]:[],branchId:bId(),createdAt:now};
      await put('orders',o);lastStaff=draft.staffId||'';
      if(waOn())setTimeout(()=>waSend('receipt',o),300);
      draft=null;toast('Order saved');ordF={s:'active',q:''};pendingModal=['receipt',o.id];location.hash='#orders';
    }catch(e){console.error(e);a.disabled=false}
  }
});
RESET.push(r=>{if(r==='new-order'&&draft&&!inAdmin()&&!draft.staffId&&meStaff())draft.staffId=me});

/* ---------- Orders list ---------- */
let ordF={s:'active',q:''};
function ordFiltered(){
  const q=ordF.q.trim().toLowerCase(),qp=normPhone(q);
  return orders().filter(o=>{
    const s=ordF.s;
    if(!inBranch(o))return false;
    if(s==='active'&&!isActive(o))return false;
    if(s==='overdue'&&!isOverdue(o))return false;
    if(s==='owing'&&!owes(o))return false;
    if(s==='corporate'&&!o.accountId)return false;
    if(s==='ready'&&!isReady(o))return false;
    if(['collected','cancelled'].includes(s)&&o.status!==s)return false;
    if(q){const hay=(o.ticket+' '+o.customerName+' '+o.phone+' '+(o.accountName||'')).toLowerCase();if(!hay.includes(q)&&!(qp.length>=4&&normPhone(o.phone).includes(qp)))return false}
    return true;
  });
}
function renderOrderList(){const l=ordFiltered(),el=$('#ordList');if(!el)return;el.innerHTML=l.length?orderHead+l.slice(0,300).map(orderRow).join(''):'<div class="empty">No orders match.</div>'}
VIEWS.orders=()=>{
  const all=state.orders;const n=f=>all.filter(f).length;
  const tabs=[['active',stagesOn()?'Active':'In shop',n(isActive)],...(stagesOn()?[['ready','Ready',n(isReady)]]:[]),['overdue','Overdue',n(isOverdue)],['owing','Owing',n(owes)],['corporate','Corporate',n(o=>!!o.accountId)],['collected','Collected',n(o=>o.status==='collected')],['cancelled','Cancelled',n(o=>o.status==='cancelled')],['all','All',all.length]];
  return `<div class="toolbar"><input type="search" data-f="o-q" placeholder="Search ticket, name, phone or company…" value="${esc(ordF.q)}"><a class="btn primary" href="#new-order">+ New order</a></div>
  <div class="tabs">${tabs.map(([k,l,c])=>`<button class="tab ${ordF.s===k?'on':''}" data-act="ordTab" data-s="${k}">${l}<span class="n">${c}</span></button>`).join('')}</div>
  <div class="list" id="ordList"></div>`;
};
AFTER.orders=renderOrderList;
IN['o-q']=e=>{ordF.q=e.value;renderOrderList()};
ACT.ordTab=a=>{ordF.s=a.dataset.s;render()};
ACT.filt=a=>{ordF.s=a.dataset.s;ordF.q=''};

/* ---------- Order detail ---------- */
MODALS.order=id=>{
  const o=findOrder(id);if(!o)return null;const c=calc(o),s=S();
  const inv=o.invoiceId?findInvoice(o.invoiceId):null;const iss=state.issues.filter(x=>x.orderId===o.id);
  const dl=(l,v)=>`<span class="muted">${l}</span><span>−${money(v)}</span>`;
  return `<div class="hd"><div><h2>Ticket <span class="mono">${esc(o.ticket)}</span></h2><div style="margin-top:6px">${pill(o.status)}${o.accountId?'<span class="tag corp">CORPORATE</span>':''}${o.express?'<span class="tag exp">EXPRESS</span>':''}${isOverdue(o)?'<span class="tag late">OVERDUE</span>':''}</div></div>${closeX}</div>
  <dl class="kv"><dt>Customer</dt><dd><a href="#" data-act="openCust" data-id="${esc(o.customerId)}">${esc(o.customerName)}</a> · ${esc(o.phone)}</dd>
   ${o.accountName?`<dt>Account</dt><dd>${inAdmin()?`<a href="#" data-act="acctOpen" data-id="${esc(o.accountId)}">${esc(o.accountName)}</a>`:esc(o.accountName)}</dd>`:''}
   <dt>Received</dt><dd>${fmtDT(o.createdAt)}${o.staffName?' · by '+esc(o.staffName):''}${o.branchId&&S().branches.length>1?' · '+esc((branchById(o.branchId)||{}).name||''):''}</dd>${o.packed&&inShop(o)?`<dt>Packed</dt><dd>${o.rack?'<b>Rack '+esc(o.rack)+'</b> · ':''}${fmtDT(o.packedAt)}${o.packedBy?' by '+esc(o.packedBy):''}</dd>`:''}<dt>Ready by</dt><dd>${fmtD(o.dueDate)}</dd>
   ${(o.statusAt||{}).collected&&o.status==='collected'?`<dt>Collected</dt><dd>${fmtDT(o.statusAt.collected)}</dd>`:''}
   ${state.deliveries.filter(d=>d.orderId===o.id).map(d=>`<dt>${d.type==='pickup'?'Pickup':'Delivery'}</dt><dd><a href="#" data-act="dvOpen" data-id="${esc(d.id)}">${fmtD(d.date)} ${esc(d.time||'')}</a> · ${d.status==='done'?'done':'scheduled'}</dd>`).join('')}</dl>
  <section><h4>Items</h4><table class="items"><tbody>${(o.items||[]).map(i=>`<tr><td>${i.service==='fee'?`<b>${esc(i.garment)}</b>`:`${i.qty} × <b>${esc(i.garment)}</b> <span class="muted">· ${svc(i.service)}</span>`}${i.note?`<div class="small muted">${esc(i.note)}</div>`:''}</td><td class="right">${money(i.qty*i.price)}</td></tr>`).join('')}</tbody></table>
   <div class="tot" style="margin-top:10px">${c.exp?`<span class="muted">Express +${num(o.expressPct)}%</span><span>${money(c.exp)}</span>`:''}${+o.acctDisc?dl('Account discount',o.acctDisc):''}${+o.discount?dl('Discount',o.discount):''}${+o.promoDisc?dl('Promo '+esc(o.promoCode),o.promoDisc):''}${+o.loyaltyDisc?dl(`Loyalty (${o.pointsUsed} pts)`,o.loyaltyDisc):''}
   <span><b>Total</b></span><span><b>${money(c.total)}</b></span>${o.accountId?'':`<span class="muted">Paid</span><span>${money(c.paid)}</span><span><b>Balance</b></span><span><b style="color:${c.bal>0?'var(--danger)':'#22a06b'}">${money(Math.max(0,c.bal))}</b></span>`}</div></section>
  ${o.status!=='cancelled'?`<section><h4>Status</h4>${stagesOn()?`<div class="steps">${STATUSES.map(x=>`<button class="${o.status===x.k?'on':''}" data-act="setStatus" data-s="${x.k}">${x.label}</button>`).join('')}</div>`:
     o.status==='collected'?`<div class="spread"><span>✓ Collected ${fmtDT((o.statusAt||{}).collected)}</span><button class="btn sm" data-act="setStatus" data-s="received">Undo — still in shop</button></div>`:
     `<div class="spread"><span>In shop since ${fmtD(o.createdAt)} · ready by <b>${fmtD(o.dueDate)}</b></span><button class="btn primary lg" data-act="setStatus" data-s="collected">✓ Mark collected</button></div>`}<div id="confirmBox"></div>
   ${(stagesOn()?o.status==='ready':inShop(o))?`<div style="margin-top:10px">${waButton('ready',o,'Send “ready for pickup” on WhatsApp',`Hello ${o.customerName}, your items at ${s.shopName} (ticket ${o.ticket}) are ready for pickup.${!o.accountId&&c.bal>0?` Balance due: ${money(c.bal)}.`:''} Thank you!`)}</div>`:''}</section>`:''}
  ${waOn()?`<section><h4>WhatsApp messages · <a href="#" data-act="waPreview" data-id="${esc(o.id)}" style="text-transform:none;letter-spacing:0">👁 Preview</a></h4>${['receipt','ready','remind'].map(k=>`<div class="spread small" style="padding:4px 0"><span>${WA_KIND_LABEL[k]}</span><span class="row-actions">${waStatusHtml(o,k)}${k==='receipt'?`<button class="btn sm" data-act="waSendBtn" data-k="receipt" data-id="${esc(o.id)}">${((o.wa||{}).receipt||{}).status==='sent'?'Resend':'Send'}</button>`:''}</span></div>`).join('')}</section>`:''}
  ${o.accountId?`<section><h4>Billing</h4><p style="margin:0">Charged to <b>${esc(o.accountName)}</b>'s account · ${inv?(inAdmin()?`<a href="#" data-act="invOpen" data-id="${esc(inv.id)}">Invoice ${esc(inv.number)}</a>`:'Invoice '+esc(inv.number))+' '+pill(invStatus(inv)):'not invoiced yet'}</p></section>`:
  `<section><h4>Payments</h4>${(o.payments||[]).length?`<div class="small" style="margin-bottom:10px">${o.payments.map(p=>`<div class="spread" style="padding:4px 0"><span>${fmtDT(p.at)} · ${esc(p.method)}</span><b>${money(p.amount)}</b></div>`).join('')}</div>`:'<div class="small muted" style="margin-bottom:10px">No payments yet.</div>'}
   ${c.bal>0&&o.status!=='cancelled'?`<div class="inline"><input type="number" min="0" id="payAmt" value="${Math.max(0,c.bal)}"><select id="payMethod">${opts(s.methods)}</select><button class="btn primary" data-act="addPay">Record payment</button></div>`:''}</section>`}
  ${iss.length?`<section><h4>Issues</h4>${iss.map(x=>`<div class="spread small" style="padding:3px 0"><a href="#" data-act="issueOpen" data-id="${esc(x.id)}">${esc(x.type)}</a>${pill(x.status)}</div>`).join('')}</section>`:''}
  <section><h4>Notes</h4><textarea id="ordNotes" style="width:100%">${esc(o.notes||'')}</textarea><div style="margin-top:8px"><button class="btn sm" data-act="saveNotes">Save notes</button></div></section>
  <section class="spread"><div class="row-actions"><button class="btn primary" data-act="receipt">Ticket / receipt</button>${o.status!=='cancelled'&&o.status!=='collected'?'<button class="btn" data-act="dvForOrder">Schedule delivery</button>':''}<button class="btn" data-act="issueForOrder">Report issue</button></div>
   <div class="row-actions">${o.status!=='cancelled'?`<button class="btn danger sm" data-act="cancelOrder">Cancel order</button>`:`<button class="btn sm" data-act="setStatus" data-s="received">Restore</button>`}${inAdmin()?'<button class="btn danger sm" data-act="delOrder">Delete</button>':''}</div></section>`;
};
MODALS.receipt=id=>{
  const o=findOrder(id);if(!o)return null;const txt=receiptText(o);
  return `<div class="hd"><h2>Ticket <span class="mono">${esc(o.ticket)}</span></h2>${closeX}</div>
  <pre class="receipt" id="rcpt">${esc(txt)}</pre>
  ${waOn()?`<div class="wabox"><span>${ic('wa')} WhatsApp receipt to ${esc(o.phone)} · <a href="#" data-act="waPreview" data-id="${esc(o.id)}" data-k="receipt">👁 Preview</a></span>${waStatusHtml(o,'receipt')}</div>`:''}
  <div class="row-actions" style="margin-top:14px;justify-content:center"><button class="btn primary" data-act="copyReceipt">Copy receipt</button>
  ${waOn()?`<button class="btn wa" data-act="waSendBtn" data-k="receipt" data-id="${esc(o.id)}" ${waBusy.has(o.id+'receipt')?'disabled':''}>${((o.wa||{}).receipt||{}).status==='sent'?'Send again':'Send receipt now'}</button><a class="btn" target="_blank" rel="noopener" href="${esc(waLink(o.phone,txt))}">Open in WhatsApp</a>`:`<a class="btn wa" target="_blank" rel="noopener" href="${esc(waLink(o.phone,txt))}">Send on WhatsApp</a>`}
  <button class="btn" data-act="openOrder" data-id="${esc(o.id)}">Order details</button></div>
  <p class="small muted" style="text-align:center;margin-top:12px">Tip: write <b class="mono">${esc(o.ticket)}</b> on a tag for each garment.</p>`;
};
Object.assign(ACT,{
  openOrder:a=>openModal('order',a.dataset.id),
  receipt:()=>openModal('receipt',modal.id),
  copyReceipt:()=>copyText($('#rcpt').textContent,'Receipt copied'),
  setStatus:async a=>{
    const o=findOrder(modal.id);if(!o)return;const s=a.dataset.s;const c=calc(o);
    if(s==='collected'&&!o.accountId&&c.bal>0&&o.status!=='collected'){
      $('#confirmBox').innerHTML=`<div class="confirm">This order still has <b>${money(c.bal)}</b> unpaid.<div class="inline" style="margin-top:10px"><select id="colMethod">${opts(S().methods)}</select><button class="btn primary sm" data-act="payCollect">Record ${money(c.bal)} &amp; collect</button><button class="btn sm" data-act="collectAnyway">Collect on credit</button></div></div>`;return}
    if(s===o.status)return;try{await setStatus(o,s)}catch(e){}
  },
  payCollect:async()=>{const o=findOrder(modal.id);const c=calc(o);try{await setStatus(o,'collected',{payments:[...(o.payments||[]),{amount:c.bal,method:$('#colMethod').value,at:Date.now()}]})}catch(e){}},
  collectAnyway:async()=>{try{await setStatus(findOrder(modal.id),'collected')}catch(e){}},
  addPay:async a=>{const o=findOrder(modal.id);const amt=Math.max(0,+$('#payAmt').value||0);if(!amt){toast('Enter an amount');return}a.disabled=true;
    try{await put('orders',{...o,payments:[...(o.payments||[]),{amount:amt,method:$('#payMethod').value,at:Date.now(),by:(meStaff()||{}).name||''}]});toast('Payment recorded');renderModal()}catch(e){a.disabled=false}},
  saveNotes:async()=>{const o=findOrder(modal.id);try{await put('orders',{...o,notes:$('#ordNotes').value.trim()});toast('Notes saved')}catch(e){}},
  cancelOrder:async a=>{if(!arm(a,'Cancel this order?'))return;try{await setStatus(findOrder(modal.id),'cancelled')}catch(e){}},
  delOrder:async a=>{if(!arm(a,'Delete permanently?'))return;try{await del('orders',modal.id);closeModal();toast('Order deleted')}catch(e){}}
});

/* ---------- Production board ---------- */
function kcard(o,next,btn){
  const c=calc(o);const its=(o.items||[]).filter(i=>i.service!=='fee');
  const s=its.slice(0,3).map(i=>`${i.qty}× ${esc(i.garment)}`).join(', ')+(its.length>3?` +${its.length-3} more`:'');
  return `<div class="kcard" data-act="openOrder" data-id="${esc(o.id)}"><div class="t"><span class="mono"><b>${esc(o.ticket)}</b></span><span>${o.accountId?'<span class="tag corp">CORP</span>':''}${o.express?'<span class="tag exp">EXPRESS</span>':''}${isOverdue(o)?'<span class="tag late">LATE</span>':''}</span></div>
   <div style="font-weight:600;margin-top:4px">${esc(o.customerName)}</div>
   <div class="meta">${c.pieces} pc · ${s}${o.packed&&inShop(o)?`<br><b style="color:var(--accent-dk)">📦 Packed${o.rack?' · rack '+esc(o.rack):''}</b>`:''}<br>Due ${fmtD(o.dueDate)}${o.staffName?' · '+esc(o.staffName):''}${!o.accountId&&c.bal>0?` · <span style="color:var(--danger)">owes ${num(c.bal)}</span>`:''}</div>
   <button class="btn sm ${next==='collected'?'':'primary'}" style="width:100%" data-act="${next==='collected'?'openOrder':'advance'}" data-id="${esc(o.id)}" data-s="${next}">${btn}</button></div>`;
}
VIEWS.production=()=>{
  if(!stagesOn()){
    const T=todayStr(),TM=addDays(T,1);const act=state.orders.filter(o=>inShop(o)&&inBranch(o));
    const sortF=(a,b)=>((b.express?1:0)-(a.express?1:0))||String(a.dueDate).localeCompare(String(b.dueDate));
    const cols=[['Late',o=>o.dueDate<T],['Due today',o=>o.dueDate===T],['Due tomorrow',o=>o.dueDate===TM],['Later',o=>!o.dueDate||o.dueDate>TM]];
    return `<p class="small muted" style="margin-top:-6px">Everything still in the shop, by ready-by date. When the customer picks up, tap <b>Collected</b> — that's the only step.</p>
    <div class="board b4">${cols.map(([l,f])=>{const l2=act.filter(f).sort(sortF);
      return `<div class="col" ${l==='Late'&&l2.length?'style="background:#f6dcd8"':''}><div class="colh"><span>${l} <span class="muted small" style="font-weight:500">${sum(l2,o=>calc(o).pieces)} pc</span></span><span class="n">${l2.length}</span></div>${l2.map(o=>kcard(o,'collected','✓ Collected…')).join('')||'<div class="empty small" style="padding:18px">Nothing here</div>'}</div>`}).join('')}</div>`;
  }
  const cols=[['received','Received','processing','Start cleaning →'],['processing','In process','ready','Mark ready →'],['ready','Ready for pickup','collected','Hand over…']];
  const act=state.orders.filter(o=>['received','processing','ready'].includes(o.status));
  const sortF=(a,b)=>((b.express?1:0)-(a.express?1:0))||String(a.dueDate).localeCompare(String(b.dueDate));
  return `<p class="small muted" style="margin-top:-6px">Express and earliest-due orders are at the top. Move each order on with its button.</p>
  <div class="board">${cols.map(([k,l,nx,btn])=>{const l2=act.filter(o=>o.status===k).sort(sortF);
    return `<div class="col"><div class="colh"><span>${l} <span class="muted small" style="font-weight:500">${sum(l2,o=>calc(o).pieces)} pc</span></span><span class="n">${l2.length}</span></div>${l2.map(o=>kcard(o,nx,btn)).join('')||'<div class="empty small" style="padding:18px">Nothing here</div>'}</div>`}).join('')}</div>`;
};
ACT.advance=async a=>{const o=findOrder(a.dataset.id);if(!o)return;a.disabled=true;try{await setStatus(o,a.dataset.s)}catch(e){a.disabled=false}};

/* ---------- Pickup & delivery ---------- */
let dvF='upcoming';
VIEWS.delivery=()=>{
  const T=todayStr(),ms=meStaff();
  const f={mine:d=>dvOpen(d)&&ms&&d.driver===ms.name,today:d=>dvOpen(d)&&d.date===T,upcoming:d=>dvOpen(d)&&d.date>=T,late:d=>dvOpen(d)&&d.date<T,done:d=>d.status==='done',all:()=>true};
  const tabs=[...(ms?[['mine','Mine']]:[]),['today','Today'],['upcoming','Upcoming'],['late','Missed'],['done','Done'],['all','All']];
  if(dvF==='mine'&&!ms)dvF='upcoming';
  let l=state.deliveries.filter(f[dvF]).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
  if(dvF==='done'||dvF==='all')l.reverse();
  return `<div class="toolbar"><span class="muted small grow">Pickups from customers' homes and offices, and deliveries of finished orders.</span><button class="btn primary" data-act="dvNew">+ Schedule pickup / delivery</button></div>
  <div class="tabs">${tabs.map(([k,lb])=>`<button class="tab ${dvF===k?'on':''}" data-act="dvTab" data-s="${k}">${lb}<span class="n">${state.deliveries.filter(f[k]).length}</span></button>`).join('')}</div>
  <div class="list">${l.length?l.map(d=>`<div class="li m2" style="grid-template-columns:90px 1.6fr .8fr auto" data-act="dvOpen" data-id="${esc(d.id)}">
    <div class="hide-m"><b>${fmtD(d.date)}</b>${d.date<T&&dvOpen(d)?'<span class="tag late">MISSED</span>':''}<div class="ph">${esc(d.time||'Any time')}</div></div>
    <div><div class="nm">${esc(d.name)} <span class="pill ${d.type==='pickup'?'st-received':'st-ready'}">${d.type==='pickup'?'Pick up':'Deliver'}</span></div><div class="ph"><span class="show-m">${fmtD(d.date)} ${esc(d.time||'')} · </span>${esc(d.address||'No address')}${d.ticket?' · Ticket '+esc(d.ticket):''}</div></div>
    <div class="hide-m small">${d.driver?esc(d.driver):'<span class="muted">No driver</span>'}</div>
    <div class="row-actions" style="justify-content:flex-end">${d.phone?`<a class="btn sm wa" data-act="noop" target="_blank" rel="noopener" href="${esc(waLink(d.phone,`Hello ${d.name}, this is ${S().shopName}. We're coming to ${d.type==='pickup'?'collect':'deliver'} your clothes on ${fmtD(d.date)}${d.time?' at '+d.time:''}.`))}">WhatsApp</a>`:''}${dvOpen(d)?`<button class="btn sm primary" data-act="dvDone" data-id="${esc(d.id)}">Done</button>`:'<span class="pill st-collected">Done</span>'}</div>
  </div>`).join(''):'<div class="empty">Nothing scheduled here.</div>'}</div>`;
};
MODALS.delivery=id=>{
  const d=id?state.deliveries.find(x=>x.id===id):modal.pre;if(id&&!d)return null;
  return `<div class="hd"><div><h2>${id?'Pickup / delivery':'Schedule pickup / delivery'}</h2>${d.ticket?`<div class="small muted">For ticket <span class="mono">${esc(d.ticket)}</span></div>`:''}</div>${closeX}</div>
  <div class="grid g3" style="gap:10px"><label class="f">Type<select id="dvType">${opts([['pickup','Pick up from customer'],['delivery','Deliver to customer']],d.type)}</select></label><label class="f">Date<input type="date" id="dvDate" value="${esc(d.date||todayStr())}"></label><label class="f">Time<input type="time" id="dvTime" value="${esc(d.time||'')}"></label></div>
  <div class="grid g2" style="gap:10px"><label class="f">Customer name<input type="text" id="dvName" value="${esc(d.name||'')}"></label><label class="f">Phone<input type="tel" id="dvPhone" value="${esc(d.phone||'')}"></label></div>
  <label class="f">Address / directions<input type="text" id="dvAddr" value="${esc(d.address||'')}" placeholder="e.g. Mikocheni B, near Shoppers Plaza"></label>
  <div class="grid g2" style="gap:10px"><label class="f">Driver / rider<select id="dvDriver"><option value="">—</option>${opts(activeStaff().map(x=>x.name),d.driver||(id?'':(meStaff()||{}).name))}</select></label>
  ${!id&&d.orderId?`<label class="f">Fee to add to ticket (${esc(S().currency)})<input type="number" min="0" id="dvFee" placeholder="0"></label>`:'<div></div>'}</div>
  <label class="f">Notes<input type="text" id="dvNotes" value="${esc(d.notes||'')}"></label>
  <div class="spread"><div class="row-actions"><button class="btn primary" data-act="dvSave">Save</button>${id?`<button class="btn" data-act="dvDone" data-id="${esc(id)}">${dvOpen(d)?'Mark done':'Reopen'}</button>`:''}${id&&d.orderId?`<button class="btn" data-act="openOrder" data-id="${esc(d.orderId)}">Open order</button>`:''}</div>${id?`<button class="btn sm danger" data-act="dvDel">Delete</button>`:''}</div>`;
};
Object.assign(ACT,{
  dvTab:a=>{dvF=a.dataset.s;render()},
  dvNew:()=>openModal('delivery',null,{type:'pickup',date:todayStr()}),
  dvOpen:(a,e)=>{e.preventDefault();openModal('delivery',a.dataset.id)},
  dvForOrder:()=>{const o=findOrder(modal.id);if(!o)return;const c=findCust(o.customerId);const ac=o.accountId&&findAccount(o.accountId);openModal('delivery',null,{type:'delivery',date:o.dueDate>=todayStr()?o.dueDate:todayStr(),name:o.customerName,phone:o.phone,address:(c&&c.address)||(ac&&ac.address)||'',orderId:o.id,ticket:o.ticket,customerId:o.customerId})},
  dvSave:async a=>{
    const id=modal.id,pre=modal.pre||{};const base=id?state.deliveries.find(x=>x.id===id):{id:uid(),status:'scheduled',branchId:bId(),createdAt:Date.now(),orderId:pre.orderId||'',ticket:pre.ticket||'',customerId:pre.customerId||''};
    const rec={...base,type:$('#dvType').value,date:$('#dvDate').value||todayStr(),time:$('#dvTime').value,name:$('#dvName').value.trim(),phone:$('#dvPhone').value.trim(),address:$('#dvAddr').value.trim(),driver:$('#dvDriver').value,notes:$('#dvNotes').value.trim()};
    if(!rec.name){toast('Enter the customer name');return}
    const fee=!id&&$('#dvFee')?Math.max(0,+$('#dvFee').value||0):0;a.disabled=true;
    try{await put('deliveries',rec);
      if(fee&&rec.orderId){const o=findOrder(rec.orderId);if(o)await put('orders',{...o,items:[...(o.items||[]),{pid:'fee',garment:rec.type==='pickup'?'Pickup fee':'Delivery fee',service:'fee',qty:1,price:fee,note:''}]})}
      const c=rec.customerId&&findCust(rec.customerId);if(c&&!c.address&&rec.address)await put('customers',{...c,address:rec.address});
      closeModal();toast('Saved')}catch(e){a.disabled=false}},
  dvDone:async a=>{const d=state.deliveries.find(x=>x.id===a.dataset.id);if(!d)return;const op=dvOpen(d);try{await put('deliveries',{...d,status:op?'done':'scheduled',doneAt:op?Date.now():null});toast(op?'Marked done':'Reopened');if(modal&&modal.kind==='delivery')closeModal()}catch(e){}},
  dvDel:async a=>{if(!arm(a,'Delete?'))return;try{await del('deliveries',modal.id);closeModal();toast('Deleted')}catch(e){}}
});

/* ---------- Issues & claims ---------- */
let isF='open';
VIEWS.issues=()=>{
  const f={open:i=>i.status==='open',progress:i=>i.status==='progress',resolved:i=>i.status==='resolved',all:()=>true};
  const tabs=[['open','Open'],['progress','In progress'],['resolved','Resolved'],['all','All']];
  const l=state.issues.filter(f[isF]).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const comp=sum(state.issues.filter(i=>i.status==='resolved'),i=>i.compensation);
  return `<div class="toolbar"><span class="muted small grow">Log complaints, damage and lost-item claims so nothing is forgotten.${inAdmin()&&comp?` Compensation paid so far: <b>${money(comp)}</b>.`:''}</span><button class="btn primary" data-act="issueNew">+ Log an issue</button></div>
  <div class="tabs">${tabs.map(([k,lb])=>`<button class="tab ${isF===k?'on':''}" data-act="isTab" data-s="${k}">${lb}<span class="n">${state.issues.filter(f[k]).length}</span></button>`).join('')}</div>
  <div class="list">${l.length?l.map(i=>`<div class="li m2" style="grid-template-columns:90px 1fr 1.4fr auto" data-act="issueOpen" data-id="${esc(i.id)}">
    <div class="hide-m small muted">${fmtD(i.createdAt)}</div>
    <div><div class="nm">${esc(i.customerName||'—')}</div><div class="ph">${i.ticket?'Ticket '+esc(i.ticket):'No ticket'}${i.staffName?' · '+esc(i.staffName):''}</div></div>
    <div class="hide-m"><b>${esc(i.type)}</b><div class="ph">${esc(String(i.description||'').slice(0,90))}</div></div>
    <div class="r">${pill(i.status)}</div></div>`).join(''):'<div class="empty">No issues here. 👍</div>'}</div>`;
};
MODALS.issue=id=>{
  const x=id?state.issues.find(i=>i.id===id):modal.pre;if(id&&!x)return null;const s=S();
  return `<div class="hd"><div><h2>${id?esc(x.type):'Log an issue'}</h2>${x.ticket?`<div class="small muted">Ticket <a href="#" data-act="openOrder" data-id="${esc(x.orderId)}" class="mono">${esc(x.ticket)}</a></div>`:''}</div>${closeX}</div>
  <div class="grid g2" style="gap:10px"><label class="f">Customer<input type="text" id="isName" value="${esc(x.customerName||'')}"></label><label class="f">Phone<input type="tel" id="isPhone" value="${esc(x.phone||'')}"></label></div>
  <div class="grid g2" style="gap:10px"><label class="f">Type<select id="isType">${opts(ISSUE_TYPES,x.type)}</select></label><label class="f">Status<select id="isStatus">${opts([['open','Open'],['progress','In progress'],['resolved','Resolved']],x.status||'open')}</select></label></div>
  <label class="f">What happened<textarea id="isDesc" placeholder="Which garment, what the customer said…">${esc(x.description||'')}</textarea></label>
  <label class="f">Resolution / action taken<textarea id="isRes">${esc(x.resolution||'')}</textarea></label>
  ${inAdmin()?`<div class="grid g2" style="gap:10px"><label class="f">Compensation / refund (${esc(s.currency)})<input type="number" min="0" id="isComp" value="${+x.compensation||''}"></label>
   ${x.compExpenseId?'<p class="small muted" style="align-self:center">Already recorded as an expense.</p>':`<label class="check" style="align-self:center"><input type="checkbox" id="isExp" checked>Record compensation as an expense when resolved</label>`}</div>`:''}
  <div class="spread"><button class="btn primary" data-act="issueSave">Save</button>${id&&inAdmin()?'<button class="btn sm danger" data-act="issueDel">Delete</button>':''}</div>`;
};
Object.assign(ACT,{
  isTab:a=>{isF=a.dataset.s;render()},
  issueNew:()=>openModal('issue',null,{status:'open',type:ISSUE_TYPES[0]}),
  issueOpen:(a,e)=>{e.preventDefault();openModal('issue',a.dataset.id)},
  issueForOrder:()=>{const o=findOrder(modal.id);if(!o)return;openModal('issue',null,{status:'open',type:ISSUE_TYPES[0],orderId:o.id,ticket:o.ticket,customerId:o.customerId,customerName:o.customerName,phone:o.phone})},
  issueSave:async a=>{
    const id=modal.id,pre=modal.pre||{};const ms=meStaff();
    const base=id?state.issues.find(i=>i.id===id):{id:uid(),branchId:bId(),createdAt:Date.now(),orderId:pre.orderId||'',ticket:pre.ticket||'',customerId:pre.customerId||'',staffName:ms?ms.name:''};
    const rec={...base,customerName:$('#isName').value.trim(),phone:$('#isPhone').value.trim(),type:$('#isType').value,status:$('#isStatus').value,description:$('#isDesc').value.trim(),resolution:$('#isRes').value.trim()};
    if($('#isComp'))rec.compensation=Math.max(0,+$('#isComp').value||0);
    if(rec.status==='resolved'&&!base.resolvedAt)rec.resolvedAt=Date.now();
    a.disabled=true;
    try{
      if(inAdmin()&&rec.status==='resolved'&&rec.compensation>0&&!rec.compExpenseId&&$('#isExp')&&$('#isExp').checked){const eid=uid();await put('expenses',{id:eid,date:todayStr(),amount:rec.compensation,category:'Claims & refunds',method:'Cash',note:`${rec.type} – ${rec.customerName}${rec.ticket?' ('+rec.ticket+')':''}`,createdAt:Date.now()});rec.compExpenseId=eid}
      await put('issues',rec);closeModal();toast('Issue saved')}catch(e){a.disabled=false}},
  issueDel:async a=>{if(!arm(a,'Delete?'))return;try{await del('issues',modal.id);closeModal();toast('Deleted')}catch(e){}}
});

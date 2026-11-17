'use strict';
/* ================= CUSTOMERS & MARKETING ================= */

/* ---------- Customers ---------- */
let custQ='';
function renderCustList(){
  const el=$('#custList');if(!el)return;
  const st=custStats(),q=custQ.trim().toLowerCase(),qp=normPhone(q),L=S().loyalty;
  const l=state.customers.filter(c=>!q||String(c.name||'').toLowerCase().includes(q)||(qp.length>=3&&normPhone(c.phone).includes(qp))).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  el.innerHTML=l.length?`<div class="li head" style="grid-template-columns:1.5fr 1fr .6fr 1fr .7fr 1fr"><div>Name</div><div class="hide-m">Last visit</div><div class="hide-m">Orders</div><div class="r hide-m">Total spent</div><div class="r hide-m">${L.enabled?'Points':''}</div><div class="r">Owes</div></div>`+l.map(c=>{const s=st[c.id]||{orders:0,spent:0,bal:0,last:0};
    return `<div class="li m2" style="grid-template-columns:1.5fr 1fr .6fr 1fr .7fr 1fr" data-act="openCust" data-id="${esc(c.id)}"><div><div class="nm">${esc(c.name)}${c.accountId?'<span class="tag corp">CORP</span>':''}</div><div class="ph">${esc(c.phone)}</div></div><div class="hide-m small">${s.last?fmtD(s.last):'—'}</div><div class="hide-m">${s.orders}</div><div class="r hide-m">${money(s.spent)}</div><div class="r hide-m">${L.enabled?num(custPoints(c.id)):''}</div><div class="r">${s.bal>0?`<span class="bal">${money(s.bal)}</span>`:'<span class="muted">—</span>'}</div></div>`}).join(''):'<div class="empty">No customers yet — they are added automatically when you take an order.</div>';
}
VIEWS.customers=()=>`<div class="toolbar"><input type="search" data-f="c-q" placeholder="Search name or phone…" value="${esc(custQ)}"><button class="btn" data-act="newCust">+ Add customer</button></div>
  <p class="small muted" style="margin:-4px 0 12px">${state.customers.length} customers</p><div class="list" id="custList"></div>`;
AFTER.customers=renderCustList;
IN['c-q']=e=>{custQ=e.value;renderCustList()};
MODALS.customer=id=>{
  const c=findCust(id);if(!c)return null;const st=custStats()[id]||{orders:0,paid:0,spent:0,bal:0};const L=S().loyalty;
  const os=orders().filter(o=>o.customerId===id);const iss=state.issues.filter(i=>i.customerId===id);
  return `<div class="hd"><div><h2>${esc(c.name)}</h2><div class="small muted">Customer since ${fmtD(c.createdAt)}${c.birthday?' · Birthday '+fmtD(c.birthday).replace(/,? \d{4}$/,''):''}</div></div>${closeX}</div>
  <div class="kpis"><div class="kpi"><div class="l">Orders</div><div class="v">${st.orders}</div></div><div class="kpi"><div class="l">Total spent</div><div class="v" style="font-size:18px">${money(st.spent)}</div></div>${L.enabled?`<div class="kpi"><div class="l">Loyalty points</div><div class="v" style="font-size:18px">${num(custPoints(id))}</div></div>`:''}<div class="kpi ${st.bal>0?'alert':''}"><div class="l">Owes</div><div class="v" style="font-size:18px">${money(st.bal)}</div></div></div>
  <div class="grid g2" style="gap:10px"><label class="f">Name<input type="text" id="cName" value="${esc(c.name)}"></label><label class="f">Phone<input type="tel" id="cPhone" value="${esc(c.phone)}"></label></div>
  <div class="grid g2" style="gap:10px"><label class="f">Address<input type="text" id="cAddr" value="${esc(c.address||'')}"></label><label class="f">Birthday (for offers)<input type="date" id="cBday" value="${esc(c.birthday||'')}"></label></div>
  <label class="f">Notes / preferences<textarea id="cNotes" placeholder="e.g. light starch, prefers hangers">${esc(c.notes||'')}</textarea></label>
  <label class="check"><input type="checkbox" id="cOptout" ${c.optOut?'checked':''}>Does not want marketing messages</label>
  <div class="row-actions"><button class="btn" data-act="saveCust" data-id="${esc(id)}">Save details</button><button class="btn primary" data-act="orderFor" data-id="${esc(id)}">+ New order</button>
  <a class="btn wa" target="_blank" rel="noopener" href="${esc(waLink(c.phone,`Hello ${c.name}, `))}">WhatsApp</a></div>
  ${iss.length?`<section><h4>Issues</h4>${iss.map(x=>`<div class="spread small" style="padding:3px 0"><a href="#" data-act="issueOpen" data-id="${esc(x.id)}">${fmtD(x.createdAt)} · ${esc(x.type)}</a>${pill(x.status)}</div>`).join('')}</section>`:''}
  <section><h4>Order history</h4><div class="list">${os.length?os.map(orderRow).join(''):'<div class="empty">No orders yet.</div>'}</div></section>`;
};
MODALS.newCust=()=>`<div class="hd"><h2>Add customer</h2>${closeX}</div>
  <div class="grid g2" style="gap:10px"><label class="f">Name<input type="text" id="cName" autofocus></label><label class="f">Phone<input type="tel" id="cPhone"></label></div>
  <div class="grid g2" style="gap:10px"><label class="f">Address<input type="text" id="cAddr"></label><label class="f">Birthday<input type="date" id="cBday"></label></div>
  <label class="f">Notes<textarea id="cNotes"></textarea></label><label class="check"><input type="checkbox" id="cOptout">Does not want marketing messages</label>
  <button class="btn primary" data-act="saveCust">Save customer</button>`;
Object.assign(ACT,{
  openCust:(a,e)=>{if(e)e.preventDefault();if(a.dataset.id&&findCust(a.dataset.id))openModal('customer',a.dataset.id)},
  newCust:()=>openModal('newCust'),
  saveCust:async a=>{const name=$('#cName').value.trim(),phone=$('#cPhone').value.trim();if(!name||!phone){toast('Name and phone are required');return}
    const id=a.dataset.id;const base=id?findCust(id):{id:uid(),createdAt:Date.now()};
    if(!id){const np=normPhone(phone);const ex=state.customers.find(c=>normPhone(c.phone)===np);if(ex){toast('A customer with this phone already exists');openModal('customer',ex.id);return}}
    try{await put('customers',{...base,name,phone,address:$('#cAddr').value.trim(),birthday:$('#cBday').value,notes:$('#cNotes').value.trim(),optOut:$('#cOptout').checked});toast('Customer saved');if(!id)openModal('customer',base.id)}catch(e){}},
  orderFor:a=>{const c=findCust(a.dataset.id);draft=newDraft(c);closeModal();if(location.hash==='#new-order')render();else location.hash='#new-order'}
});

/* ---------- Loyalty ---------- */
let loyDraft=null;
FORM_ROUTES.add('loyalty');
RESET.push(r=>{if(r!=='loyalty')loyDraft=null});
VIEWS.loyalty=()=>{
  if(!inAdmin())return adminOnly();
  if(!loyDraft)loyDraft={...S().loyalty};const L=loyDraft,s=S();
  const ranked=state.customers.map(c=>({c,p:custPoints(c.id)})).filter(x=>x.p>0).sort((a,b)=>b.p-a.p);
  const outstanding=sum(ranked,x=>x.p)*(+S().loyalty.pointValue||0);
  const redeemed=sum(state.orders.filter(o=>o.status!=='cancelled'),o=>o.loyaltyDisc);
  return `<div id="formRoot"><div class="kpis"><div class="kpi"><div class="l">Members with points</div><div class="v">${ranked.length}</div></div><div class="kpi"><div class="l">Points value outstanding</div><div class="v">${money(outstanding)}</div><div class="s">what customers could redeem</div></div><div class="kpi"><div class="l">Redeemed so far</div><div class="v">${money(redeemed)}</div></div></div>
  <div class="grid g2" style="align-items:start">
   <div class="card"><h3>How the programme works</h3>
    <label class="check"><input type="checkbox" data-f="loy" data-k="enabled" ${L.enabled?'checked':''}>Loyalty programme switched on</label>
    <div class="grid g3" style="gap:10px"><label class="f">Spend per point (${esc(s.currency)})<input type="number" min="1" data-f="loy" data-k="spendPerPoint" value="${+L.spendPerPoint||1000}"></label>
    <label class="f">Value of 1 point (${esc(s.currency)})<input type="number" min="1" data-f="loy" data-k="pointValue" value="${+L.pointValue||1}"></label>
    <label class="f">Redeem from (points)<input type="number" min="0" data-f="loy" data-k="minRedeem" value="${+L.minRedeem||0}"></label></div>
    <p class="small muted" id="loyExplain"></p>
    <button class="btn primary" data-act="saveLoy">Save programme</button></div>
   <div class="card"><h3>Top members</h3>${ranked.length?`<table class="tbl"><tr><th>Customer</th><th class="num">Points</th><th class="num">Worth</th></tr>${ranked.slice(0,15).map(x=>`<tr><td><a href="#" data-act="openCust" data-id="${esc(x.c.id)}">${esc(x.c.name)}</a></td><td class="num">${num(x.p)}</td><td class="num">${money(x.p*(+S().loyalty.pointValue||0))}</td></tr>`).join('')}</table>`:'<p class="muted small">Customers earn points automatically as they pay. Nobody has points yet.</p>'}</div>
  </div></div>`;
};
function loyExplain(){const el=$('#loyExplain');if(!el)return;const L=loyDraft,s=S();const pct=(+L.pointValue||0)/(+L.spendPerPoint||1)*100;el.innerHTML=`A customer earns 1 point for every ${money(L.spendPerPoint)} they pay. 1 point is worth ${money(L.pointValue)} off a future order — that's a <b>${pct.toFixed(1)}%</b> reward. Points can be used once they have ${num(L.minRedeem)}. Corporate account orders don't earn points.`}
AFTER.loyalty=loyExplain;
IN.loy=e=>{const k=e.dataset.k;loyDraft[k]=e.type==='checkbox'?e.checked:Math.max(0,+e.value||0);loyExplain()};
ACT.saveLoy=async a=>{a.disabled=true;try{await putSettings({...S(),loyalty:{...loyDraft,spendPerPoint:Math.max(1,+loyDraft.spendPerPoint||1),pointValue:Math.max(1,+loyDraft.pointValue||1)}});toast('Loyalty programme saved');loyDraft=null;render()}catch(e){a.disabled=false}};

/* ---------- Promotions ---------- */
VIEWS.promotions=()=>{
  if(!inAdmin())return adminOnly();
  const T=todayStr();const l=[...state.promos].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const live=p=>p.active!==false&&(!p.expires||p.expires>=T)&&(!p.starts||p.starts<=T)&&!(+p.maxUses&&promoUses(p.code)>=+p.maxUses);
  const given=sum(state.orders.filter(o=>o.status!=='cancelled'),o=>o.promoDisc);
  return `<div class="toolbar"><span class="muted small grow">Discount codes staff can type in on a new order. ${given?`Total discount given: <b>${money(given)}</b>.`:''}</span><button class="btn primary" data-act="promoNew">+ New promo code</button></div>
  <div class="list">${l.length?`<div class="li head" style="grid-template-columns:1fr 1.3fr .8fr .8fr .8fr auto"><div>Code</div><div>Offer</div><div class="hide-m">Valid</div><div class="hide-m">Used</div><div class="hide-m">Discount given</div><div></div></div>`+l.map(p=>{const used=promoUses(p.code);const given=sum(state.orders.filter(o=>o.promoCode===p.code&&o.status!=='cancelled'),o=>o.promoDisc);
    return `<div class="li m2" style="grid-template-columns:1fr 1.3fr .8fr .8fr .8fr auto" data-act="promoEdit" data-id="${esc(p.id)}"><div class="mono"><b>${esc(p.code)}</b></div><div><div class="nm">${p.type==='amt'?money(p.value)+' off':num(p.value)+'% off'}</div><div class="ph">${esc(p.description||'')}${+p.minSpend?' · min '+money(p.minSpend):''}</div></div><div class="hide-m small">${p.starts?fmtD(p.starts):'Now'} – ${p.expires?fmtD(p.expires):'no end'}</div><div class="hide-m small">${used}${+p.maxUses?' / '+p.maxUses:''}</div><div class="hide-m small">${money(given)}</div><div class="r">${pill(live(p)?'active':'inactive')}</div></div>`}).join(''):'<div class="empty">No promo codes yet. Try a welcome offer like <b>KARIBU10</b> for 10% off a first order.</div>'}</div>`;
};
MODALS.promo=id=>{
  const p=id?state.promos.find(x=>x.id===id):{type:'pct',active:true};if(id&&!p)return null;
  return `<div class="hd"><h2>${id?'Promo '+esc(p.code):'New promo code'}</h2>${closeX}</div>
  <div class="grid g2" style="gap:10px"><label class="f">Code<input type="text" id="prCode" value="${esc(p.code||'')}" placeholder="KARIBU10" style="text-transform:uppercase" ${id?'':'autofocus'}></label><label class="f">Description<input type="text" id="prDesc" value="${esc(p.description||'')}" placeholder="Welcome offer"></label></div>
  <div class="grid g3" style="gap:10px"><label class="f">Type<select id="prType">${opts([['pct','% off'],['amt','Fixed amount off']],p.type)}</select></label><label class="f">Value<input type="number" min="0" id="prVal" value="${+p.value||''}"></label><label class="f">Minimum order<input type="number" min="0" id="prMin" value="${+p.minSpend||''}" placeholder="none"></label></div>
  <div class="grid g3" style="gap:10px"><label class="f">Starts<input type="date" id="prStart" value="${esc(p.starts||'')}"></label><label class="f">Ends<input type="date" id="prEnd" value="${esc(p.expires||'')}"></label><label class="f">Max uses<input type="number" min="0" id="prMax" value="${+p.maxUses||''}" placeholder="unlimited"></label></div>
  <label class="check"><input type="checkbox" id="prActive" ${p.active!==false?'checked':''}>Active</label>
  <div class="spread"><button class="btn primary" data-act="promoSave">Save</button>${id?'<button class="btn sm danger" data-act="promoDel">Delete</button>':''}</div>`;
};
Object.assign(ACT,{
  promoNew:()=>openModal('promo'),
  promoEdit:a=>openModal('promo',a.dataset.id),
  promoSave:async a=>{const id=modal.id;const code=$('#prCode').value.trim().toUpperCase().replace(/\s+/g,'');const val=Math.max(0,+$('#prVal').value||0);
    if(!code||!val){toast('Enter a code and a value');return}
    if(state.promos.some(p=>p.code===code&&p.id!==id)){toast('That code already exists');return}
    const base=id?state.promos.find(x=>x.id===id):{id:uid(),createdAt:Date.now()};a.disabled=true;
    try{await put('promos',{...base,code,description:$('#prDesc').value.trim(),type:$('#prType').value,value:val,minSpend:Math.max(0,+$('#prMin').value||0),starts:$('#prStart').value,expires:$('#prEnd').value,maxUses:Math.max(0,+$('#prMax').value||0),active:$('#prActive').checked});closeModal();toast('Promo saved')}catch(e){a.disabled=false}},
  promoDel:async a=>{if(!arm(a,'Delete?'))return;try{await del('promos',modal.id);closeModal();toast('Deleted')}catch(e){}}
});

/* ---------- Campaigns ---------- */
FORM_ROUTES.add('campaigns');
let camp={seg:'inactive',days:45,top:20,tpl:'',sent:new Set()};
const SEGS=[['inactive','Haven’t visited recently'],['top','Top customers by spend'],['points','Have points to redeem'],['ready','Clothes ready, not collected'],['owing','Owe money'],['birthday','Birthday this month'],['new','New this month'],['all','All customers']];
const TPL={
  inactive:'Hello {name}! We miss you at {shop}. Bring your clothes in this week and enjoy fresh, crisp cleaning. See you soon!',
  top:'Hello {name}, thank you for being one of our best customers at {shop}! We truly appreciate you.',
  points:'Hello {name}, you have {points} loyalty points at {shop} — worth {points_value} off your next order. Come and use them!',
  ready:'Hello {name}, your clothes at {shop} are ready and waiting for you. We are open today!',
  owing:'Hello {name}, a friendly reminder from {shop}: your balance is {balance}. Thank you!',
  birthday:'Happy birthday {name}! 🎉 From all of us at {shop}, enjoy a special treat on your next visit this month.',
  new:'Hello {name}, welcome to {shop}! Thank you for choosing us — we look forward to seeing you again.',
  all:'Hello {name}, greetings from {shop}! '
};
function campList(){
  const st=custStats(),T=todayStr(),L=S().loyalty,mo=T.slice(5,7),ym=T.slice(0,7);
  let l=state.customers.filter(c=>!c.optOut&&c.phone).map(c=>{const s=st[c.id]||{orders:0,spent:0,bal:0,last:0};return {c,s,pts:custPoints(c.id),days:s.last?daysBetween(dayOf(s.last),T):null}});
  const g=camp.seg;
  if(g==='inactive')l=l.filter(x=>x.days!==null&&x.days>=camp.days).sort((a,b)=>b.days-a.days);
  else if(g==='top')l=l.filter(x=>x.s.spent>0).sort((a,b)=>b.s.spent-a.s.spent).slice(0,camp.top);
  else if(g==='points')l=l.filter(x=>L.enabled&&x.pts>0&&x.pts>=(+L.minRedeem||0)).sort((a,b)=>b.pts-a.pts);
  else if(g==='ready'){const ids=new Set(state.orders.filter(isReady).map(o=>o.customerId));l=l.filter(x=>ids.has(x.c.id))}
  else if(g==='owing')l=l.filter(x=>x.s.bal>0).sort((a,b)=>b.s.bal-a.s.bal);
  else if(g==='birthday')l=l.filter(x=>x.c.birthday&&x.c.birthday.slice(5,7)===mo);
  else if(g==='new')l=l.filter(x=>dayOf(x.c.createdAt).startsWith(ym));
  return l;
}
function campMsg(x){const s=S();return (camp.tpl||TPL[camp.seg]).replace(/\{name\}/g,String(x.c.name).split(' ')[0]).replace(/\{shop\}/g,s.shopName).replace(/\{points_value\}/g,money(x.pts*(+s.loyalty.pointValue||0))).replace(/\{points\}/g,num(x.pts)).replace(/\{balance\}/g,money(x.s.bal)).replace(/\{days\}/g,x.days??'')}
function renderCampList(){
  const el=$('#campList');if(!el)return;const l=campList();
  $('#campCount').textContent=`${l.length} customer${l.length===1?'':'s'} · ${[...camp.sent].filter(id=>l.some(x=>x.c.id===id)).length} messaged`;
  el.innerHTML=l.length?l.map(x=>`<div class="li static m2 ${camp.sent.has(x.c.id)?'done':''}" style="grid-template-columns:1.3fr 1fr auto"><div><div class="nm">${esc(x.c.name)}</div><div class="ph">${esc(x.c.phone)}</div></div><div class="hide-m small muted">${camp.seg==='top'?money(x.s.spent)+' spent':camp.seg==='points'?num(x.pts)+' points':camp.seg==='owing'?'owes '+money(x.s.bal):x.days!==null?'last visit '+x.days+' days ago':'no visits yet'}</div><div><a class="btn sm wa" data-act="campWa" data-id="${esc(x.c.id)}" target="_blank" rel="noopener" href="${esc(waLink(x.c.phone,campMsg(x)))}">${camp.sent.has(x.c.id)?'✓ Sent':'WhatsApp'}</a></div></div>`).join(''):'<div class="empty">No customers in this group right now.</div>';
}
VIEWS.campaigns=()=>{
  if(!inAdmin())return adminOnly();
  return `<div id="formRoot"><div class="grid g2" style="align-items:start">
   <div class="card"><h3>1. Choose who to reach</h3>
    <label class="f">Customer group<select data-f="camp-seg">${opts(SEGS,camp.seg)}</select></label>
    ${camp.seg==='inactive'?`<label class="f">Not visited for at least (days)<input type="number" min="1" data-f="camp-days" value="${camp.days}"></label>`:''}
    ${camp.seg==='top'?`<label class="f">How many top customers<input type="number" min="1" data-f="camp-top" value="${camp.top}"></label>`:''}
    <h3 style="margin-top:6px">2. Write the message</h3>
    <textarea data-f="camp-tpl" style="width:100%;min-height:110px">${esc(camp.tpl||TPL[camp.seg])}</textarea>
    <p class="small muted">Placeholders: {name} {shop} {points} {points_value} {balance} {days}. Customers who opted out are skipped.</p>
    <div class="row-actions"><button class="btn" data-act="campCopyPhones">Copy phone numbers</button><button class="btn" data-act="campCopyMsg">Copy message</button></div>
    <p class="small muted" style="margin-bottom:0">For large groups, paste the numbers into a WhatsApp Business broadcast list or your bulk-SMS provider.</p></div>
   <div><div class="spread" style="margin-bottom:10px"><h3 class="h3" style="margin:0">3. Send one by one</h3><span class="small muted" id="campCount"></span></div><div class="list" id="campList"></div></div>
  </div></div>`;
};
AFTER.campaigns=renderCampList;
ONCHANGE.add('camp-seg');
Object.assign(IN,{
  'camp-seg':e=>{camp.seg=e.value;camp.tpl='';$('#formRoot').remove();render()},
  'camp-days':e=>{camp.days=Math.max(1,+e.value||1);renderCampList()},
  'camp-top':e=>{camp.top=Math.max(1,+e.value||1);renderCampList()},
  'camp-tpl':e=>{camp.tpl=e.value;renderCampList()}
});
Object.assign(ACT,{
  campWa:a=>{camp.sent.add(a.dataset.id);setTimeout(renderCampList,50)},
  campCopyPhones:()=>{const l=campList();copyText(l.map(x=>x.c.phone).join('\n'),`${l.length} numbers copied`)},
  campCopyMsg:()=>copyText(camp.tpl||TPL[camp.seg],'Message copied')
});

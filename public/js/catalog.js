'use strict';
/* ================= CATALOG & INVENTORY ================= */

/* ---------- Services & prices ---------- */
let pDraft=null,svDraft=null;
FORM_ROUTES.add('prices');
RESET.push(r=>{if(r!=='prices'){pDraft=null;svDraft=null}});
const SVC_IDEAS=['Steam press','Stain removal','Starch & press','Dyeing','Alterations & repairs','Shoe cleaning','Bag cleaning','Leather & suede','Hand wash (delicate)','Duvet wash','Express iron'];
VIEWS.prices=()=>{
  const s=S();
  if(!inAdmin()){
    const cats=[...new Set(s.priceList.map(p=>p.cat||'Garments'))];
    return `<div class="card scroll"><table class="tbl"><tr><th>Garment</th>${SVC().map(x=>`<th class="num">${x.label}</th>`).join('')}</tr>${cats.map(c=>`<tr class="sec"><td colspan="4">${esc(c)}</td></tr>`+s.priceList.filter(p=>(p.cat||'Garments')===c).map(p=>`<tr><td>${esc(p.name)}</td>${SVC().map(x=>`<td class="num">${+p.prices[x.k]?num(p.prices[x.k]):'<span class="no">—</span>'}</td>`).join('')}</tr>`).join('')).join('')}</table></div><p class="small muted">Express service adds ${num(s.expressPct)}%. Only an admin can change prices.</p>`;
  }
  if(!pDraft)pDraft=JSON.parse(JSON.stringify(s.priceList)).map(p=>({...p,cat:p.cat||'Garments'}));
  if(!svDraft)svDraft=JSON.parse(JSON.stringify(SVC()));const SV=svDraft;
  return `<div id="formRoot"><div class="card"><div class="spread"><h3 style="margin:0">Services you offer</h3><button class="btn sm primary" data-act="svAdd">+ Add service</button></div>
   <p class="small muted">Each service gets its own price column below. Rename them to match your shop.</p>
   <div class="svlist">${SV.map((x,i)=>`<div class="svrow"><input type="text" data-f="sv" data-i="${i}" value="${esc(x.label)}" placeholder="Service name">${SV.length>1?`<button class="xbtn" data-act="svRm" data-i="${i}" title="Remove service">×</button>`:''}</div>`).join('')}</div>
   <div class="chips" style="margin:12px 0 0"><span class="small muted" style="align-self:center">Quick add:</span>${SVC_IDEAS.filter(n=>!SV.some(x=>x.label.toLowerCase()===n.toLowerCase())).map(n=>`<button class="chip" data-act="svAdd" data-n="${esc(n)}">+ ${esc(n)}</button>`).join('')}</div></div>
  <div class="toolbar"><h3 style="margin:0 12px 0 0">Price list</h3><span class="muted small grow">Set 0 when a garment doesn't get that service. Prices fill in automatically on new orders and can still be changed per order.</span><button class="btn" data-act="copyPrices">Copy for customers</button><button class="btn" data-act="addPrice">+ Add item</button></div>
  <div class="card scroll"><table class="items pl"><thead><tr><th>Category</th><th>Garment / item</th>${SV.map(x=>`<th>${esc(x.label)} (${esc(s.currency)})</th>`).join('')}<th></th></tr></thead><tbody id="plBody">
   ${pDraft.map((p,i)=>`<tr><td><select data-f="sp" data-i="${i}" data-k="cat">${opts(PRICE_CATS,p.cat)}</select></td><td><input type="text" data-f="sp" data-i="${i}" data-k="name" value="${esc(p.name)}" placeholder="Name"></td>${SV.map(x=>`<td><input type="number" min="0" data-f="sp" data-i="${i}" data-k="${x.k}" value="${+p.prices[x.k]||0}"></td>`).join('')}<td class="x"><button class="xbtn" data-act="rmPrice" data-i="${i}">×</button></td></tr>`).join('')}
  </tbody></table></div>
  <div class="row-actions"><button class="btn primary lg" data-act="savePrices">Save services &amp; prices</button><button class="btn" data-act="resetPrices">Discard changes</button></div></div>`;
};
IN.sv=e=>{svDraft[+e.dataset.i].label=e.value};
IN.sp=e=>{const r=pDraft[+e.dataset.i],k=e.dataset.k;if(k==='name'||k==='cat')r[k]=e.value;else r.prices[k]=Math.max(0,+e.value||0)};
Object.assign(ACT,{
  svAdd:a=>{const n=a.dataset.n||'';svDraft.push({k:'s'+uid(),label:n});$('#formRoot').remove();render();if(!n){const ins=$$('[data-f="sv"]');if(ins.length)ins[ins.length-1].focus()}},
  svRm:a=>{if(!arm(a,'Remove?'))return;svDraft.splice(+a.dataset.i,1);$('#formRoot').remove();render()},
  addPrice:()=>{pDraft.push({id:'p'+uid(),cat:'Garments',name:'',prices:{}});$('#formRoot').remove();render();const ins=$$('[data-f="sp"][data-k="name"]');if(ins.length)ins[ins.length-1].focus()},
  rmPrice:a=>{pDraft.splice(+a.dataset.i,1);render()},
  resetPrices:()=>{pDraft=null;svDraft=null;render();toast('Changes discarded')},
  savePrices:async a=>{const pl=pDraft.filter(p=>p.name.trim()).map(p=>({...p,name:p.name.trim()}));if(!pl.length){toast('Add at least one item');return}
    const sv=svDraft.filter(x=>x.label.trim()).map(x=>({k:x.k,label:x.label.trim()}));if(!sv.length){toast('Keep at least one service');return}
    a.disabled=true;try{await putSettings({...S(),priceList:pl,services:sv});pDraft=null;svDraft=null;toast('Services & prices saved');render()}catch(e){a.disabled=false}},
  copyPrices:()=>{const s=S();const cats=[...new Set(s.priceList.map(p=>p.cat||'Garments'))];
    const t=[`*${s.shopName} — Price list (${s.currency})*`,...cats.flatMap(c=>['',`_${c}_`,...s.priceList.filter(p=>(p.cat||'Garments')===c).map(p=>`• ${p.name}: `+SVC().filter(x=>+p.prices[x.k]>0).map(x=>`${x.label} ${num(p.prices[x.k])}`).join(' · '))]),'',`Express service: +${num(s.expressPct)}%`].join('\n');
    copyText(t,'Price list copied — paste it into WhatsApp')}
});

/* ---------- Inventory ---------- */
const INV_CATS=['Solvents & chemicals','Detergents & soaps','Stain removers','Finishing (starch, softener)','Packaging & hangers','Tags & stationery','Spare parts & machines','Cleaning equipment','Other'];
const INV_PRESETS=[['Perchloroethylene (perc)','litres','Solvents & chemicals'],['Hydrocarbon solvent','litres','Solvents & chemicals'],['Liquid detergent','litres','Detergents & soaps'],['Washing powder','kg','Detergents & soaps'],['Bar soap','pcs','Detergents & soaps'],['Bleach','litres','Detergents & soaps'],['Stain remover (protein)','bottles','Stain removers'],['Stain remover (oil/grease)','bottles','Stain removers'],['Spray starch','cans','Finishing (starch, softener)'],['Fabric softener','litres','Finishing (starch, softener)'],['Wire hangers','pcs','Packaging & hangers'],['Plastic garment covers','pcs','Packaging & hangers'],['Shirt boxes / folders','pcs','Packaging & hangers'],['Carrier bags','pcs','Packaging & hangers'],['Tag pins / tickets','packs','Tags & stationery'],['Receipt paper rolls','rolls','Tags & stationery'],['Marker pens','pcs','Tags & stationery'],['Iron sole plates','pcs','Spare parts & machines'],['Boiler water treatment','litres','Spare parts & machines'],['Lint filters','pcs','Spare parts & machines']];
let invQ='',invCat='all';
function renderInv(){
  const el=$('#invList');if(!el)return;const adm=inAdmin();const q=invQ.trim().toLowerCase();
  const l=state.supplies.filter(x=>(invCat==='all'||(invCat==='low'?(+x.qty||0)<=(+x.reorder||0):(x.cat||'Other')===invCat))&&(!q||String(x.name).toLowerCase().includes(q))).sort((a,b)=>String(a.cat||'Other').localeCompare(String(b.cat||'Other'))||String(a.name).localeCompare(String(b.name)));
  let last='';
  el.innerHTML=l.length?l.map(x=>{const lo=(+x.qty||0)<=(+x.reorder||0);const sp=x.supplierId&&findSupplier(x.supplierId);const head=(x.cat||'Other')!==last?`<div class="li head" style="grid-template-columns:1fr">${esc(last=(x.cat||'Other'))}</div>`:'';
    return head+`<div class="li static m2" style="grid-template-columns:1.6fr .9fr .9fr auto"><div><div class="nm">${esc(x.name)}</div><div class="ph">${adm&&x.cost?money(x.cost)+' / '+esc(x.unit||'unit'):''}${sp?(adm&&x.cost?' · ':'')+esc(sp.name):''}</div></div>
    <div class="${lo?'low':''}"><b>${num(x.qty)}</b> ${esc(x.unit||'')}${lo?' · LOW':''}</div><div class="hide-m small muted">Reorder at ${num(x.reorder)}</div>
    <div class="row-actions" style="justify-content:flex-end"><button class="btn sm" data-act="stockOpen" data-id="${esc(x.id)}" data-m="use">− Use</button>${adm?`<button class="btn sm primary" data-act="stockOpen" data-id="${esc(x.id)}" data-m="restock">+ Restock</button><button class="btn sm" data-act="supEdit" data-id="${esc(x.id)}">Edit</button>`:''}</div></div>`}).join(''):`<div class="empty">${state.supplies.length?'Nothing matches.':'No supplies yet.'+(adm?' Tap <b>+ Add item</b> or pick from the quick list.':'')}</div>`;
}
VIEWS.inventory=()=>{
  const adm=inAdmin();const low=lowStock();const val=sum(state.supplies,x=>(+x.qty||0)*(+x.cost||0));
  const cats=[...new Set(state.supplies.map(x=>x.cat||'Other'))];
  return `<div class="kpis"><div class="kpi"><div class="l">Items tracked</div><div class="v">${state.supplies.length}</div></div><div class="kpi ${low.length?'alert':''}"><div class="l">Running low</div><div class="v">${low.length}</div></div>${adm?`<div class="kpi"><div class="l">Stock value</div><div class="v">${money(val)}</div></div>`:''}</div>
  ${adm?`<div class="card"><div class="spread"><h3 style="margin:0">Add stock items</h3><div class="row-actions"><button class="btn primary" data-act="supNew">+ Add item</button><button class="btn" data-act="supBulk">+ Add several at once</button></div></div>
   <div class="chips" style="margin:12px 0 0"><span class="small muted" style="align-self:center">Quick add:</span>${INV_PRESETS.filter(p=>!state.supplies.some(x=>x.name.toLowerCase()===p[0].toLowerCase())).slice(0,14).map(p=>`<button class="chip" data-act="supPreset" data-n="${esc(p[0])}" data-u="${esc(p[1])}" data-c="${esc(p[2])}">+ ${esc(p[0])}<small>${esc(p[1])}</small></button>`).join('')}</div></div>`:''}
  <div class="toolbar"><input type="search" data-f="inv-q" placeholder="Search stock…" value="${esc(invQ)}"></div>
  <div class="tabs"><button class="tab ${invCat==='all'?'on':''}" data-act="invCatTab" data-s="all">All<span class="n">${state.supplies.length}</span></button><button class="tab ${invCat==='low'?'on':''}" data-act="invCatTab" data-s="low">Low stock<span class="n">${low.length}</span></button>${cats.map(c=>`<button class="tab ${invCat===c?'on':''}" data-act="invCatTab" data-s="${esc(c)}">${esc(c)}<span class="n">${state.supplies.filter(x=>(x.cat||'Other')===c).length}</span></button>`).join('')}</div>
  <div class="list" id="invList"></div>`;
};
AFTER.inventory=renderInv;
IN['inv-q']=e=>{invQ=e.value;renderInv()};
ACT.invCatTab=a=>{invCat=a.dataset.s;render()};
MODALS.supply=id=>{
  const x=id?state.supplies.find(v=>v.id===id):(modal.pre||{});if(id&&!x)return null;
  return `<div class="hd"><h2>${id?esc(x.name):'Add stock item'}</h2>${closeX}</div>
  <div class="grid g2" style="gap:10px"><label class="f">Item name<input type="text" id="suName" value="${esc(x.name||'')}" placeholder="e.g. Perchloroethylene" ${id?'':'autofocus'}></label><label class="f">Category<select id="suCat">${opts(INV_CATS,x.cat||'Other')}</select></label></div>
  <div class="grid g3" style="gap:10px"><label class="f">Unit<input type="text" id="suUnit" value="${esc(x.unit||'')}" placeholder="litres, pcs, kg…" list="units"></label>${id?'':`<label class="f">Quantity in stock now<input type="number" min="0" id="suQty" value="${+x.qty||0}"></label>`}<label class="f">Warn me at or below<input type="number" min="0" id="suReorder" value="${+x.reorder||0}"></label></div>
  <datalist id="units">${['litres','kg','pcs','packs','bottles','cans','rolls','boxes','cartons','metres'].map(u=>`<option value="${u}">`).join('')}</datalist>
  <div class="grid g2" style="gap:10px"><label class="f">Cost per unit (${esc(S().currency)})<input type="number" min="0" id="suCost" value="${+x.cost||0}"></label><label class="f">Usual supplier<select id="suSupplier"><option value="">—</option>${state.suppliers.map(s=>`<option value="${esc(s.id)}" ${s.id===x.supplierId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label></div>
  <div class="spread"><button class="btn primary" data-act="supSave">${id?'Save':'Add to inventory'}</button>${id?'<button class="btn sm danger" data-act="supDel">Delete</button>':''}</div>
  ${id&&(x.log||[]).length?`<section><h4>Recent movements</h4>${[...x.log].reverse().slice(0,12).map(g=>`<div class="spread small" style="padding:3px 0"><span>${fmtDT(g.at)}${g.by?' · '+esc(g.by):''}${g.note?' · '+esc(g.note):''}</span><b style="color:${g.delta<0?'var(--danger)':'#22a06b'}">${g.delta>0?'+':''}${num(g.delta)} ${esc(x.unit||'')}</b></div>`).join('')}</section>`:''}`;
};
MODALS.supBulk=()=>`<div class="hd"><h2>Add several items</h2>${closeX}</div>
  <p class="small muted" style="margin-top:-6px">One item per line: <b>name, quantity, unit, warn-at</b>. Only the name is required.</p>
  <textarea id="bulkIn" style="width:100%;height:200px;font-family:'DM Mono',monospace;font-size:13px" placeholder="Perchloroethylene, 40, litres, 10&#10;Wire hangers, 500, pcs, 100&#10;Spray starch, 12, cans, 3" autofocus></textarea>
  <label class="f" style="margin-top:10px">Category for these items<select id="bulkCat">${opts(INV_CATS,'Other')}</select></label>
  <button class="btn primary" data-act="supBulkSave">Add items</button>`;
MODALS.stock=id=>{
  const x=state.supplies.find(v=>v.id===id);if(!x)return null;const r=modal.pre.mode==='restock';const s=S();
  return `<div class="hd"><div><h2>${r?'Restock':'Use'} ${esc(x.name)}</h2><div class="small muted">In stock: ${num(x.qty)} ${esc(x.unit||'')}</div></div>${closeX}</div>
  <div class="grid g2" style="gap:10px"><label class="f">Quantity (${esc(x.unit||'units')})<input type="number" min="0" id="stQty" autofocus></label>
  ${r?`<label class="f">Total cost (${esc(s.currency)})<input type="number" min="0" id="stCost" placeholder="${x.cost?'≈ '+num(x.cost)+' per unit':''}"></label>`:'<div></div>'}</div>
  ${r?`<label class="f">Supplier<select id="stSupplier"><option value="">—</option>${state.suppliers.map(v=>`<option value="${esc(v.id)}" ${v.id===x.supplierId?'selected':''}>${esc(v.name)}</option>`).join('')}</select></label>`:''}
  <label class="f">Note<input type="text" id="stNote" placeholder="${r?'Invoice / receipt no.':'e.g. Machine 2 refill'}"></label>
  ${r?`<label class="check"><input type="checkbox" id="stExp" checked>Also record the cost as an expense</label><div class="grid g2" style="gap:10px"><label class="f">Category<select id="stCat">${opts(EXP_CATS,'Detergents & chemicals')}</select></label><label class="f">Paid with<select id="stMethod">${opts(s.methods)}</select></label></div>`:''}
  <button class="btn primary" data-act="stockSave">${r?'Add to stock':'Deduct from stock'}</button>`;
};
Object.assign(ACT,{
  supNew:()=>openModal('supply',null,{}),
  supPreset:a=>openModal('supply',null,{name:a.dataset.n,unit:a.dataset.u,cat:a.dataset.c}),
  supBulk:()=>openModal('supBulk'),
  supBulkSave:async a=>{const lines=$('#bulkIn').value.split('\n').map(l=>l.trim()).filter(Boolean);if(!lines.length){toast('Type at least one item');return}const cat=$('#bulkCat').value;a.disabled=true;let n=0;
    try{for(const l of lines){const [name,qty,unit,re]=l.split(',').map(x=>(x||'').trim());if(!name)continue;await put('supplies',{id:uid(),name,qty:Math.max(0,+qty||0),unit:unit||'',reorder:Math.max(0,+re||0),cost:0,cat,log:[],createdAt:Date.now()});n++}closeModal();toast(`${n} item${n===1?'':'s'} added`)}catch(e){a.disabled=false}},
  supEdit:a=>openModal('supply',a.dataset.id),
  supSave:async a=>{const id=modal.id;const name=$('#suName').value.trim();if(!name){toast('Enter a name');return}
    const base=id?state.supplies.find(x=>x.id===id):{id:uid(),qty:Math.max(0,+$('#suQty').value||0),log:[],createdAt:Date.now()};
    a.disabled=true;try{await put('supplies',{...base,name,cat:$('#suCat').value,unit:$('#suUnit').value.trim(),reorder:Math.max(0,+$('#suReorder').value||0),cost:Math.max(0,+$('#suCost').value||0),supplierId:$('#suSupplier').value});closeModal();toast(id?'Saved':name+' added to inventory')}catch(e){a.disabled=false}},
  supDel:async a=>{if(!arm(a,'Delete?'))return;try{await del('supplies',modal.id);closeModal();toast('Deleted')}catch(e){}},
  stockOpen:a=>openModal('stock',a.dataset.id,{mode:a.dataset.m}),
  stockSave:async a=>{
    const x=state.supplies.find(v=>v.id===modal.id);const n=Math.max(0,+$('#stQty').value||0);if(!n){toast('Enter a quantity');return}
    const r=modal.pre.mode==='restock',note=$('#stNote').value.trim(),cost=r?Math.max(0,+$('#stCost').value||0):0,supId=r?$('#stSupplier').value:'';
    const upd={...x,qty:Math.max(0,(+x.qty||0)+(r?n:-n)),log:[...(x.log||[]),{at:Date.now(),delta:r?n:-n,note,by:(meStaff()||{}).name||''}].slice(-50)};
    if(r&&cost>0)upd.cost=Math.round(cost/n);if(supId)upd.supplierId=supId;
    a.disabled=true;
    try{await put('supplies',upd);
      if(r&&cost>0&&$('#stExp').checked)await put('expenses',{id:uid(),date:todayStr(),amount:cost,category:$('#stCat').value,method:$('#stMethod').value,supplierId:supId,note:`Restock ${n} ${x.unit||''} ${x.name}${note?' – '+note:''}`.replace(/\s+/g,' '),createdAt:Date.now()});
      closeModal();toast(r?'Stock added':'Stock updated')}catch(e){a.disabled=false}}
});

/* ---------- Suppliers ---------- */
VIEWS.suppliers=()=>{
  if(!inAdmin())return adminOnly();
  const l=[...state.suppliers].sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  const yr=todayStr().slice(0,4);
  return `<div class="toolbar"><span class="muted small grow">Who you buy chemicals, detergents, hangers and packaging from. Restocks and their costs link here automatically.</span><button class="btn primary" data-act="splNew">+ Add supplier</button></div>
  <div class="list">${l.length?`<div class="li head" style="grid-template-columns:1.4fr 1.4fr 1fr 1fr auto"><div>Supplier</div><div class="hide-m">Supplies</div><div class="hide-m">Bought this year</div><div class="hide-m">Last purchase</div><div></div></div>`+l.map(v=>{const ex=state.expenses.filter(e=>e.supplierId===v.id);const items=state.supplies.filter(x=>x.supplierId===v.id);const low=items.filter(x=>(+x.qty||0)<=(+x.reorder||0));const last=ex.map(e=>e.date).sort().pop();
    const msg=`Hello ${v.contact||v.name}, this is ${S().shopName}. We would like to order:\n`+(low.length?low:items).map(x=>`- ${x.name}: ___ ${x.unit||''}`).join('\n');
    return `<div class="li m2" style="grid-template-columns:1.4fr 1.4fr 1fr 1fr auto" data-act="splEdit" data-id="${esc(v.id)}"><div><div class="nm">${esc(v.name)}</div><div class="ph">${esc(v.contact||'')}${v.phone?' · '+esc(v.phone):''}</div></div><div class="hide-m small">${items.length?items.map(x=>`<span class="${(+x.qty||0)<=(+x.reorder||0)?'low':''}">${esc(x.name)}</span>`).join(', '):esc(v.items||'—')}</div><div class="hide-m">${money(sum(ex.filter(e=>String(e.date).startsWith(yr)),e=>e.amount))}</div><div class="hide-m small">${last?fmtD(last):'—'}</div><div>${v.phone?`<a class="btn sm wa" data-act="noop" target="_blank" rel="noopener" href="${esc(waLink(v.phone,msg))}">${low.length?'Reorder low stock':'Order'}</a>`:''}</div></div>`}).join(''):'<div class="empty">No suppliers yet.</div>'}</div>`;
};
MODALS.supplier=id=>{
  const v=id?findSupplier(id):{};if(id&&!v)return null;
  const ex=id?state.expenses.filter(e=>e.supplierId===id).sort((a,b)=>a.date<b.date?1:-1):[];
  return `<div class="hd"><h2>${id?esc(v.name):'Add supplier'}</h2>${closeX}</div>
  <div class="grid g2" style="gap:10px"><label class="f">Company name<input type="text" id="spName" value="${esc(v.name||'')}" ${id?'':'autofocus'}></label><label class="f">Contact person<input type="text" id="spContact" value="${esc(v.contact||'')}"></label></div>
  <div class="grid g2" style="gap:10px"><label class="f">Phone<input type="tel" id="spPhone" value="${esc(v.phone||'')}"></label><label class="f">Email<input type="email" id="spEmail" value="${esc(v.email||'')}"></label></div>
  <label class="f">What they supply<input type="text" id="spItems" value="${esc(v.items||'')}" placeholder="Solvent, detergent, hangers…"></label>
  <label class="f">Notes (account no., terms, location)<textarea id="spNotes">${esc(v.notes||'')}</textarea></label>
  <div class="spread"><button class="btn primary" data-act="splSave">Save</button>${id?'<button class="btn sm danger" data-act="splDel">Delete</button>':''}</div>
  ${ex.length?`<section><h4>Purchases</h4>${ex.slice(0,15).map(e=>`<div class="spread small" style="padding:3px 0"><span>${fmtD(e.date)} · ${esc(e.note||e.category)}</span><b>${money(e.amount)}</b></div>`).join('')}</section>`:''}`;
};
Object.assign(ACT,{
  splNew:()=>openModal('supplier'),
  splEdit:a=>openModal('supplier',a.dataset.id),
  splSave:async a=>{const id=modal.id;const name=$('#spName').value.trim();if(!name){toast('Enter a name');return}
    const base=id?findSupplier(id):{id:uid(),createdAt:Date.now()};a.disabled=true;
    try{await put('suppliers',{...base,name,contact:$('#spContact').value.trim(),phone:$('#spPhone').value.trim(),email:$('#spEmail').value.trim(),items:$('#spItems').value.trim(),notes:$('#spNotes').value.trim()});closeModal();toast('Supplier saved')}catch(e){a.disabled=false}},
  splDel:async a=>{if(!arm(a,'Delete?'))return;try{await del('suppliers',modal.id);closeModal();toast('Deleted')}catch(e){}}
});

'use strict';
/* ================= WhatsApp (Meta Cloud API) + push alerts + email, via the FT Bridge connector (Render) ================= */
const WA_SERVER='FT Bridge';
const WA_TPL={
  receipt:{name:'order_receipt',n:9,img:true,
    en:'Hello {{1}}, thank you for choosing {{2}}. We have received your order {{3}}: {{4}}. Total {{5}}, paid {{6}}, balance {{7}}. Ready by {{8}}. Show the QR code above or your ticket number when you collect. Track your order: {{9}}',
    sw:'Habari {{1}}, asante kwa kuchagua {{2}}. Tumepokea oda yako {{3}}: {{4}}. Jumla {{5}}, umelipa {{6}}, salio {{7}}. Itakuwa tayari {{8}}. Onyesha QR code iliyo juu au namba ya tiketi unapokuja kuchukua. Fuatilia oda yako: {{9}}'},
  ready:{name:'order_ready',n:4,
    en:'Hello {{1}}, your clothes at {{2}} (ticket {{3}}) are ready for pickup. Balance to pay: {{4}}. Thank you!',
    sw:'Habari {{1}}, nguo zako {{2}} (tiketi {{3}}) ziko tayari kuchukuliwa. Salio la kulipa: {{4}}. Asante!'},
  remind:{name:'pickup_reminder',n:5,
    en:'Hello {{1}}, a reminder from {{2}}: your clothes (ticket {{3}}) have been ready since {{4}}. Please collect them soon. Balance: {{5}}. Thank you.',
    sw:'Habari {{1}}, ukumbusho kutoka {{2}}: nguo zako (tiketi {{3}}) zimekuwa tayari tangu {{4}}. Tafadhali zichukue mapema. Salio: {{5}}. Asante.'}
};
const waFooter=()=>{const f=S().waFooter;return f!==undefined&&f!==null?f:`Questions? Call or WhatsApp ${S().phone||'the shop'}`};
function waFill(kind,params,lang){const t=WA_TPL[kind];return (t[lang]||t.en).replace(/\{\{(\d+)\}\}/g,(m,n)=>params[+n-1]??m)}
function sampleOrder(){const T=todayStr();return {id:'sample',ticket:'FT0427',pub:'sample',customerName:'Asha Mwinyi',phone:'0712345678',items:[{garment:'Shirt / Blouse',service:'dry',qty:2,price:3000},{garment:'Suit (2-piece)',service:'dry',qty:1,price:12000}],payments:[{amount:10000,method:'Cash',at:Date.now()}],dueDate:addDays(T,3),createdAt:Date.now()}}
function waPhone(kind,o,lang){
  const s=S();const params=waParams(kind,o);const txt=waFill(kind,params,lang);const foot=waFooter();const t=new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  return `<div class="phone"><div class="phtop"><span class="phback">‹</span><span class="phav">${window.FT_CO&&FT_CO.logo?`<img src="${esc(FT_CO.logo)}" alt="">`:esc(coShort())}</span><div class="phname"><b>${esc(s.shopName)} <span class="vtick" title="Business account">✔</span></b><small>Business account</small></div></div>
   <div class="phchat"><div class="phday">TODAY</div><div class="phnote">🔒 This business uses a secure service from Meta to manage this chat.</div>
    <div class="phbub">${WA_TPL[kind].img&&S().waQr!==false&&o.pub&&siteUrl()?`<img class="phimg" src="/qr/${esc(o.pub)}.svg" alt="QR code">`:''}<div class="phtxt">${esc(txt)}</div>${foot?`<div class="phfoot">${esc(foot)}</div>`:''}<div class="phtime">${t}</div></div></div>
   <div class="phin"><span>Message</span></div></div>`;
}
WA_TPL.payment={name:'payment_alert',n:7,owner:true,
  en:'New payment at {{1}}: {{2}} by {{3}} for ticket {{4}} ({{5}}), taken by {{6}} at {{7}}. Check the app for details.',
  sw:'Malipo mapya {{1}}: {{2}} kwa {{3}} kwa tiketi {{4}} ({{5}}), yamepokelewa na {{6}} saa {{7}}. Angalia programu kwa maelezo zaidi.'};
const WA_KIND_LABEL={receipt:'Receipt',ready:'Ready message',remind:'Reminder',payment:'Payment alert'};
const waOn=()=>!!S().waAuto;
const waLang=()=>S().waLang||'en';
const waTplName=k=>(S()['waTpl_'+k]||WA_TPL[k].name).trim();
let mcpNs;
async function getMcp(){if(mcpNs!==undefined)return mcpNs;try{mcpNs=window.claude&&typeof window.claude.use==='function'?await window.claude.use('mcp'):null}catch(e){mcpNs=null}return mcpNs}
function intlPhone(p){let d=String(p||'').replace(/\D/g,'');const cc=String(S().countryCode||'').replace(/\D/g,'');if(d.startsWith('0'))d=cc+d.slice(1);else if(cc&&d.length<=9)d=cc+d;return d}
function waItems(o){const its=(o.items||[]).filter(i=>i.service!=='fee');let t=its.map(i=>`${i.qty} ${i.garment}${SVC().length>1?' ('+svc(i.service)+')':''}`).join(', ');if(t.length>300)t=t.slice(0,297)+'...';return t||'items'}
function waParams(kind,o){
  const s=S(),c=calc(o),first=String(o.customerName||'Customer').split(' ')[0],bal=o.accountId?'on account':money(Math.max(0,c.bal));
  if(kind==='receipt')return [first,s.shopName,o.ticket,waItems(o),money(c.total),o.accountId?'on account':money(c.paid),bal,fmtD(o.dueDate),trackLink(o)||'ask the shop'];
  if(kind==='ready')return [first,s.shopName,o.ticket,bal];
  return [first,s.shopName,o.ticket,fmtD(o.dueDate),bal];
}
function waErr(e){
  const c=e&&e.code;
  if(c==='server_not_connected')return `This account hasn't added the “${WA_SERVER}” connector yet (Claude → Settings → Connectors).`;
  if(c==='needs_reauth')return `Reconnect “${WA_SERVER}” in Claude → Settings → Connectors.`;
  if(c==='not_in_manifest'||c==='approval_required'||c==='consent_required')return 'WhatsApp sending was not allowed for this app. Tap Resend and choose Allow.';
  if(c==='selection_required')return `Choose which “${WA_SERVER}” connector to use when Claude asks.`;
  if(c==='blocked_by_policy')return 'Your organisation blocks this connector.';
  if(c==='tool_error'){const r=e.result||{};const sc=r.structuredContent||{};let m=sc.error;if(!m){try{m=JSON.parse(e.message).error}catch(x){m=e.message}}return 'Meta: '+(m||'message rejected')}
  if(c==='server_unavailable'||c==='upstream_error')return 'Could not reach the shop server. Check the internet, then tap Resend.';
  if(c==='not_granted'||c==='capability_disabled'||c==='capability_removed')return 'Automatic WhatsApp only works in the app opened from Claude.';
  return (e&&e.message)||'Sending failed';
}
async function waStamp(oid,kind,rec){const o=findOrder(oid);if(!o)return;try{await put('orders',{...o,wa:{...(o.wa||{}),[kind]:rec}})}catch(e){}}
async function waSend(kind,o,opts={}){
  if(kind==='receipt')o=await ensurePub(o);
  const m=await getMcp();const to=intlPhone(o.phone);
  if(!m){const msg='Cannot reach the shop server.';await waStamp(o.id,kind,{status:'failed',at:Date.now(),error:msg});if(!opts.quiet)toast(msg);return {ok:false,msg}}
  if(to.length<10){const msg='Phone number looks wrong — fix it and resend.';await waStamp(o.id,kind,{status:'failed',at:Date.now(),error:msg});toast(msg);return {ok:false,msg}}
  waBusy.add(o.id+kind);if(modal)renderModal();
  try{
    const args={to,template:waTplName(kind),language:waLang(),params:waParams(kind,o)};
    if(WA_TPL[kind].img&&S().waQr!==false&&qrImg(o))args.header_image=qrImg(o);
    const r=await m.callTool(WA_SERVER,'send_template',args);
    const p=r&&r.payload||{};waBusy.delete(o.id+kind);
    if(p&&p.ok===false){throw {code:'tool_error',message:JSON.stringify(p),result:{structuredContent:p}}}
    await waStamp(o.id,kind,{status:'sent',at:Date.now(),id:p.id||'',by:myName()});toast(`✓ ${WA_KIND_LABEL[kind]} sent on WhatsApp`);return {ok:true};
  }catch(e){waBusy.delete(o.id+kind);const msg=waErr(e);await waStamp(o.id,kind,{status:'failed',at:Date.now(),error:msg,code:e&&e.code||''});toast('WhatsApp not sent — '+msg);return {ok:false,msg}}
}
const waBusy=new Set();
function waStatusHtml(o,kind){
  const r=(o.wa||{})[kind];
  if(waBusy.has(o.id+kind))return `<span class="wast busy">⏳ Sending…</span>`;
  if(!r)return '<span class="wast">Not sent</span>';
  if(r.status==='sent')return `<span class="wast ok">✓ Sent ${fmtDT(r.at)}</span>`;
  return `<span class="wast bad" title="${esc(r.error||'')}">✕ Not sent — ${esc(r.error||'error')}</span>`;
}
/* buttons used around the app: automatic when on, otherwise open WhatsApp */
function waButton(kind,o,label,fallbackText){
  if(waOn())return `<button class="btn sm wa" data-act="waSendBtn" data-k="${kind}" data-id="${esc(o.id)}">${label}</button>`;
  return `<a class="btn sm wa" data-act="${kind==='remind'?'odRemind':'noop'}" data-id="${esc(o.id)}" target="_blank" rel="noopener" href="${esc(waLink(o.phone,fallbackText))}">${label}</a>`;
}
ACT.waSendBtn=async(a,e)=>{if(e&&e.stopPropagation)e.stopPropagation();const o=findOrder(a.dataset.id);if(!o)return;a.disabled=true;a.textContent='Sending…';
  const r=await waSend(a.dataset.k,o);if(a.dataset.k==='remind'&&r.ok){const o2=findOrder(o.id);try{await put('orders',{...o2,reminders:(o2.reminders||0)+1,remindedAt:Date.now()})}catch(x){}}
  if(a.isConnected){a.disabled=false;a.textContent=r.ok?'✓ Sent':'Retry'}};

MODALS.waPreview=id=>{const o=id==='sample'?sampleOrder():findOrder(id);if(!o)return null;const k=modal.pre.kind||'receipt';
  return `<div class="hd"><div><h2>What ${esc(String(o.customerName).split(' ')[0])} sees on WhatsApp</h2><div class="small muted">${esc(WA_KIND_LABEL[k])} · to ${esc(o.phone)}</div></div>${closeX}</div>
  <div class="tabs" style="justify-content:center">${['receipt','ready','remind'].map(x=>`<button class="tab ${x===k?'on':''}" data-act="waPvKind" data-k="${x}">${WA_KIND_LABEL[x]}</button>`).join('')}</div>${waPhone(k,o,waLang())}
  ${id!=='sample'&&waOn()?`<div style="text-align:center;margin-top:14px"><button class="btn wa" data-act="waSendBtn" data-k="${k}" data-id="${esc(o.id)}">Send this ${esc(WA_KIND_LABEL[k].toLowerCase())} now</button></div>`:''}`};
ACT.waPvKind=a=>{modal.pre.kind=a.dataset.k;renderModal()};
ACT.waPreview=(a,e)=>{if(e)e.preventDefault();openModal('waPreview',a.dataset.id,{kind:a.dataset.k||'receipt'})};

/* ---------- WhatsApp setup page (admin) ---------- */
let pvKind='receipt';
FORM_ROUTES.add('whatsapp');
let waDraft=null,waTest=null;
RESET.push(r=>{if(r!=='whatsapp')waDraft=null});
VIEWS.whatsapp=()=>{
  if(!inAdmin())return adminOnly();
  const s=S();if(!waDraft)waDraft={waQr:s.waQr!==false,alertsLink:s.alertsLink||((window.FT_ME&&window.FT_ME.alertsLink)||''),payAlerts:!!s.payAlerts,ownerPhones:s.ownerPhones||'',payWa:!!s.payWa,dailyEmail:!!s.dailyEmail,reportEmail:s.reportEmail||'',waFooter:waFooter(),waAuto:!!s.waAuto,waLang:s.waLang||'en',waTpl_receipt:waTplName('receipt'),waTpl_ready:waTplName('ready'),waTpl_remind:waTplName('remind')};const d=waDraft;
  const sent=state.orders.filter(o=>o.wa&&o.wa.receipt&&o.wa.receipt.status==='sent'&&dayOf(o.wa.receipt.at)===todayStr()).length;
  const failed=state.orders.filter(o=>o.wa&&Object.values(o.wa).some(r=>r&&r.status==='failed')&&Date.now()-(o.createdAt||0)<3*864e5);
  const lastO=orders().find(o=>o.status!=='cancelled');
  const step=(n,t,b)=>`<div class="wstep"><span class="wn">${n}</span><div><b>${t}</b><div class="small">${b}</div></div></div>`;
  return `<div id="formRoot"><div class="grid g2" style="align-items:start">
  <div><div class="card"><div class="spread"><h3 style="margin:0">Automatic WhatsApp</h3>${pill(d.waAuto?'active':'inactive')}</div>
   <p class="small muted">Messages go from your shop's WhatsApp Business number through Meta. Meta charges per message.</p>
   <label class="check"><input type="checkbox" data-f="wa" data-k="waAuto" ${d.waAuto?'checked':''}>Send the receipt automatically when an order is saved</label>
   <label class="check"><input type="checkbox" data-f="wa" data-k="waQr" ${d.waQr!==false?'checked':''}><span>Put the order's <b>QR code</b> picture on top of the receipt <span class="muted">(the order_receipt template needs an Image header)</span></span></label>
   <p class="small muted" style="margin:-6px 0 12px 26px">When on, the “ready” and “reminder” buttons also send directly instead of opening WhatsApp.</p>
   <div class="grid g2" style="gap:10px"><label class="f">Message language<select data-f="wa" data-k="waLang">${opts([['en','English (en)'],['sw','Kiswahili (sw)']],d.waLang)}</select></label><label class="f">Receipt template name<input type="text" data-f="wa" data-k="waTpl_receipt" value="${esc(d.waTpl_receipt)}"></label></div>
   <div class="grid g2" style="gap:10px"><label class="f">“Ready” template name<input type="text" data-f="wa" data-k="waTpl_ready" value="${esc(d.waTpl_ready)}"></label><label class="f">Reminder template name<input type="text" data-f="wa" data-k="waTpl_remind" value="${esc(d.waTpl_remind)}"></label></div>
   <button class="btn primary" data-act="waSave">Save</button></div>
   <div class="card"><h3>Test it</h3>
    <div class="row-actions"><button class="btn" data-act="waCheck">Check connection</button><span class="small" id="waCheckOut">${waTest?waTest:''}</span></div>
    <div class="inline" style="margin-top:12px"><input type="tel" id="waTestTo" placeholder="Your phone e.g. 0712 345 678"><button class="btn primary" data-act="waTestSend">Send a test receipt</button></div>
    <p class="small muted">Today: <b>${sent}</b> receipts sent automatically.${failed.length?` <span class="low">${failed.length} recent order${failed.length>1?'s have':' has'} a failed message</span> — open the order to resend.`:''}</p></div>
  </div>
  <div class="card"><h3>One-time setup</h3>
   ${step(1,'Meta Business + WhatsApp number','On <b>business.facebook.com</b> create a Business account, then in <b>developers.facebook.com</b> create an app with the <b>WhatsApp</b> product. Add your shop phone number (one not used in the normal WhatsApp app) and verify it. Add a payment method for message charges.')}
   ${step(2,'Create the message templates','In WhatsApp Manager → Message templates, create these as category <b>Utility</b> (3 go to customers; the payment one only if you also want payment alerts on WhatsApp), in the language you chose. Use exactly these names and texts (copy buttons below). Approval usually takes minutes to a day.')}
   ${step(3,'Get your keys','Create a <b>System User</b> with a permanent token that has <i>whatsapp_business_messaging</i>. Note the <b>Phone number ID</b> from WhatsApp → API Setup.')}
   ${step(4,'Add the keys to your server','On <b>Render</b> → your <b>fast-technology</b> service → <b>Environment</b>, set <b>WA_TOKEN</b> and <b>WA_PHONE_ID</b>, then Save. The server restarts by itself in a minute.')}
   ${step(5,'Switch on','Tick “Send the receipt automatically”, Save, and press <b>Send a test receipt</b>.')}
  </div></div>
  <div class="grid g2" style="align-items:start;margin-top:4px">
   <div class="card"><div class="spread"><h3 style="margin:0">What the customer sees</h3><div class="tabs" style="margin:0">${['receipt','ready','remind'].map(x=>`<button class="tab ${x===pvKind?'on':''}" data-act="waPvTab" data-k="${x}">${WA_KIND_LABEL[x]}</button>`).join('')}</div></div>
    <p class="small muted">${lastO?`Using your latest order (${esc(lastO.ticket)}, ${esc(lastO.customerName)}).`:'Using a sample order.'} Language: ${d.waLang==='sw'?'Kiswahili':'English'}.</p>
    ${waPhone(pvKind,lastO||sampleOrder(),d.waLang)}
    <label class="f" style="margin-top:14px">Footer under every message (add the same text as the template footer in Meta)<input type="text" data-f="wa" data-k="waFooter" value="${esc(d.waFooter)}" maxlength="60"></label></div>
   <div class="card"><h3>How to use it every day</h3>
    ${step('1','Take the order as usual','When the worker presses <b>Save order</b>, the receipt goes to the customer by itself. The ticket screen shows <span class="wast ok">✓ Sent</span>.')}
    ${step('2','If you see ✕ Not sent','Read the reason under the ticket — usually a wrong phone number. Fix the number on the order and press <b>Send again</b>. Nothing is ever sent twice by itself.')}
    ${step('3','When clothes are ready','On <b>Packager</b> press <b>Tell customer</b> (or “Send ready for pickup” inside the order). The ready message goes straight away.')}
    ${step('4','Clothes not collected','Open <b>Overdue dispensing</b> and press <b>Send reminder</b>. The order remembers how many reminders were sent.')}
    ${step('5','Check what was sent','Every order has a <b>WhatsApp messages</b> section with the time each message went out. <b>👁 Preview</b> shows exactly what the customer saw.')}
    ${step('6','Customer replies','Replies arrive on the WhatsApp Business number, not in this app. Put your normal shop number in the footer above so customers know where to call. Meta “coexistence” lets the same number also stay in the WhatsApp Business app — ask a Meta partner if you want that.')}
   </div></div>
  <div class="card ownercard"><div class="spread"><h3 style="margin:0">🔔 Owner alerts &amp; daily report</h3>${pill(d.payAlerts?'active':'inactive')}</div>
   <div class="grid g2" style="margin-top:12px"><div>
    <label class="check"><input type="checkbox" data-f="wa" data-k="payAlerts" ${d.payAlerts?'checked':''}><span>Notify me for <b>every payment</b> (all branches) and every <b>failed spot check</b></span></label>
    <p class="small muted" style="margin:-6px 0 10px 26px">Real notifications on your phone and computer, like a bank app — they arrive even when this app and the browser are closed. Free.</p>
    <label class="f">FT Alerts link (from Render: https://ft-bridge.onrender.com/alerts/&lt;ALERTS_KEY&gt;)<input type="url" data-f="wa" data-k="alertsLink" value="${esc(d.alertsLink||'')}" placeholder="https://ft-bridge.onrender.com/alerts/…"></label>
    ${d.alertsLink?`<div class="alertslink"><img alt="QR code" src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&data=${encodeURIComponent(d.alertsLink)}" width="110" height="110" onerror="this.remove()"><div class="small">Open this link on <b>each phone and computer</b> that should get alerts and tap <b>Enable notifications</b>, then press <b>Check my devices</b> here so the app saves them. On iPhone: Share → <b>Add to Home Screen</b> first, then open FT Alerts from the home screen.<div class="row-actions" style="margin-top:8px"><button class="btn sm" data-act="alCopy">Copy link</button><a class="btn sm" href="${esc(d.alertsLink)}" target="_blank" rel="noopener">Open here</a></div></div></div>`:''}
    <div class="row-actions" style="margin-top:10px"><button class="btn sm" data-act="alDevices">Check my devices</button><button class="btn sm" data-act="alTest">Send a test alert</button></div>
    <div class="small" id="alOut" style="margin-top:8px">${alOut||devListHtml()}</div>
    ${(()=>{const st=alertStats();return `<p class="small">Today: <b class="yes">${st.sent} sent</b>${st.waiting?` · ${st.waiting} sending`:''}${st.failed?` · <b class="low">${st.failed} could not be sent</b> — check the FT Bridge connector on the devices taking payments`:''}</p>`})()}
    <label class="check"><input type="checkbox" data-f="wa" data-k="payWa" ${d.payWa?'checked':''}><span>Also send payment alerts on WhatsApp <span class="muted">(Meta charges per message)</span></span></label>
    ${d.payWa?`<label class="f">Owner WhatsApp number(s) — separate with commas<input type="text" data-f="wa" data-k="ownerPhones" value="${esc(d.ownerPhones||'')}" placeholder="0712 345 678, 0754 000 111"></label>`:''}
    <p class="small muted">Sent by whichever device records the payment. If it can't, any other open device with the connector retries every minute, so alerts aren't lost.</p></div>
   <div><label class="check"><input type="checkbox" data-f="wa" data-k="dailyEmail" ${d.dailyEmail?'checked':''}><span>Email me the full daily report at <b>21:20</b></span></label>
    <label class="f">Send the report to — separate several emails with commas<input type="text" inputmode="email" autocomplete="off" data-f="wa" data-k="reportEmail" value="${esc(d.reportEmail||'')}" placeholder="owner@gmail.com, manager@gmail.com"></label>
    <p class="small muted" style="margin:-6px 0 8px">Leave empty to send it to every admin Gmail. Each person gets their own copy.</p>
    <p class="small muted">Sent by email only (Brevo, free up to 300 a day) — no WhatsApp cost. Your server sends it every evening, even when nobody has the app open.</p>
    <button class="btn sm" data-act="dailyNow">Send today's report now</button></div></div>
   <button class="btn primary" data-act="waSave">Save</button></div>
  <h3 class="h3">Templates to submit to Meta (${d.waLang==='sw'?'Kiswahili':'English'})</h3>
  <div class="grid g3">${Object.entries(WA_TPL).map(([k,t])=>`<div class="card"><div class="spread"><b class="mono">${esc(waDraft['waTpl_'+k]||t.name)}</b><span class="small muted">Utility · ${d.waLang}${t.owner?' · <b>to you</b>':''}</span></div>${t.img&&d.waQr!==false?`<div class="small" style="margin:6px 0"><b>Header:</b> Image — upload <a href="/qr/sample.png" download="qr-sample.png" target="_blank">this sample QR picture</a> when Meta asks for a sample</div>`:''}<p class="small" style="background:#faf9f5;border:1px solid var(--line);border-radius:10px;padding:10px;white-space:pre-wrap">${esc(t[d.waLang]||t.en)}</p>${d.waFooter?`<div class="small muted" style="margin:-6px 0 8px">Footer: <i>${esc(d.waFooter)}</i></div>`:''}<div class="small muted" style="margin-bottom:8px">Sample values for Meta: ${esc(sampleParams(k).map((v,i)=>`{{${i+1}}} ${v}`).join(' · '))}</div><button class="btn sm" data-act="waCopyTpl" data-k="${k}">Copy text</button></div>`).join('')}</div></div>`;
};
function sampleParams(k){const s=S();if(k==='payment')return [s.shopName,'TSh 15,000','M-Pesa','FT0427','Asha Mwinyi','Rebecca John','17:24'];if(k==='daily')return [s.shopName,'17 Nov','24','61','18','TSh 412,000','Cash 250,000 · M-Pesa 162,000','TSh 35,000','closed, balanced'];if(k==='receipt')return ['Asha',s.shopName,'FT0427','2 Shirt (Dry clean), 1 Suit','TSh 18,000','TSh 10,000','TSh 8,000','20 Nov',(siteUrl()||'https://ft-bridge.onrender.com')+'/o/k3J9xQ2mP7aWr5Tz'];if(k==='ready')return ['Asha',s.shopName,'FT0427','TSh 8,000'];return ['Asha',s.shopName,'FT0427','20 Nov','TSh 8,000']}
IN.wa=e=>{waDraft[e.dataset.k]=e.type==='checkbox'?e.checked:e.value.trim();if(['waFooter','waLang','payWa','alertsLink','waQr'].includes(e.dataset.k)){$('#formRoot').remove();render()}};
ONCHANGE.add('wa');
ACT.waPvTab=a=>{pvKind=a.dataset.k;$('#formRoot').remove();render()};
Object.assign(ACT,{
  waSave:async a=>{{const bad=String(waDraft.reportEmail||'').split(/[,;\s]+/).filter(Boolean).filter(x=>!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));if(bad.length){toast('Check this email: '+bad[0]);return}}if(waDraft.payWa&&!String(waDraft.ownerPhones||'').trim()){toast('Enter the owner WhatsApp number for WhatsApp payment alerts');return}if(waDraft.alertsLink&&!/^(https:\/\/|http:\/\/localhost).+\/alerts\/.{16,}$/.test(waDraft.alertsLink)){toast('The FT Alerts link should look like https://ft-bridge.onrender.com/alerts/…');return}a.disabled=true;const extra=waDraft.payAlerts&&!S().payAlerts?{payAlertSince:Date.now()}:{};try{await putSettings({...S(),...waDraft,...extra});waDraft=null;toast('Settings saved');render()}catch(e){a.disabled=false}},
  waCopyTpl:a=>{const t=WA_TPL[a.dataset.k];copyText(t[(waDraft||{}).waLang||'en']||t.en,'Template text copied')},
  waCheck:async a=>{const out=$('#waCheckOut');const m=await getMcp();if(!m){waTest='<span class="low">Cannot reach the server.</span>';out.innerHTML=waTest;return}
    a.disabled=true;out.textContent='Checking…';
    try{const r=await m.callTool(WA_SERVER,'check_setup',{});const p=r.payload||{};if(p.ok===false)throw {code:'tool_error',result:{structuredContent:p},message:JSON.stringify(p)};const wa=p.whatsapp||p;waTest=`<span class="yes">✓ FT Bridge connected</span> · WhatsApp ${wa&&wa.ok!==false&&(wa.phone||p.phone)?'✓ '+esc(wa.phone||p.phone):'<span class="low">not set</span>'} · Email ${p.email&&p.email.ok?'✓':'<span class="low">not set</span>'} · Push ${p.push&&p.push.ok?'✓ '+p.push.devices+' device(s)':'<span class="low">not set</span>'}`}
    catch(e){waTest=`<span class="low">${esc(waErr(e))}</span>`}out.innerHTML=waTest;a.disabled=false},
  waTestSend:async a=>{const to=intlPhone($('#waTestTo').value);if(to.length<10){toast('Enter your phone number');return}const m=await getMcp();if(!m){toast('Cannot reach the server — check your internet');return}
    a.disabled=true;const s=S();
    try{const lang=(waDraft&&waDraft.waLang)||waLang();const tpl=(waDraft&&waDraft.waTpl_receipt)||waTplName('receipt');const r=await m.callTool(WA_SERVER,'send_template',{to,template:tpl,language:lang,params:sampleParams('receipt')});const p=r.payload||{};if(p.ok===false)throw {code:'tool_error',result:{structuredContent:p},message:JSON.stringify(p)};toast('✓ Test receipt sent — check your WhatsApp')}
    catch(e){toast('Not sent — '+waErr(e))}a.disabled=false}
});


/* ---------- Owner alerts: push notification (FT Alerts) for every payment + failed spot checks ---------- */
const ownerPhones=()=>String(S().ownerPhones||'').split(/[,;\n]+/).map(x=>intlPhone(x.trim())).filter(p=>p.length>=10);
let alOut='';
function devListHtml(){const l=S().pushDevices||[];return l.length?`${l.length} device${l.length>1?'s':''} on: ${l.map(d=>esc(d.label||'Device')).join(', ')}`:'<span class="muted">No devices yet — open the FT Alerts link on your phone / computer.</span>'}
function payParams(coll,doc,p){
  const s=S();const b=(branchById(doc.branchId)||S().branches[0]||{}).name||s.shopName;
  const ref=coll==='invoices'?doc.number:coll==='homejobs'?'Home service':doc.ticket;
  const who=coll==='invoices'?doc.accountName:(doc.customerName||doc.name||'Customer');
  const by=p.rider?('rider '+p.rider):(p.by||'staff');
  return [b,money(p.amount),p.method||'Cash',ref||'-',who,by,new Date(p.at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})];
}
function payPush(params){const [b,amt,meth,ref,who,by,t]=params;return {title:`💵 ${amt} · ${meth}`,body:`${ref} · ${who}\n${b} · taken by ${by} · ${t}`}}
/* send to every FT Alerts device; keeps the app's backup copy of the device list in sync */
async function ownerNotify(m,msg){
  const s=S();const r=await m.callTool(WA_SERVER,'notify_owner',{...msg,subscriptions:s.pushDevices||[]});const pl=(r&&r.payload)||{};
  if(pl.ok===false)throw {code:'tool_error',message:pl.error||JSON.stringify(pl),result:{structuredContent:pl}};
  if(Array.isArray(pl.list))await keepDevices(pl.list,pl.removed||[]);
  return pl;
}
/* the bridge (free Render plan) forgets devices when it restarts, so the admin's app keeps the master copy in settings */
async function keepDevices(list,removed=[]){
  if(!inAdmin())return;const old=S().pushDevices||[];
  const clean=d=>({endpoint:d.endpoint,keys:d.keys,label:d.label||'Device',at:d.at||Date.now()});
  const merged=[...list.map(clean),...old.filter(o=>!list.some(n=>n.endpoint===o.endpoint))].filter(d=>d.endpoint&&!removed.includes(d.endpoint));
  const key=l=>l.map(d=>d.endpoint+'|'+d.label).sort().join(',');
  if(key(merged)!==key(old)){try{await putSettings({...S(),pushDevices:merged})}catch(e){}}
}
let devSyncAt=0;
async function autoSyncDevices(){if(!inAdmin()||!state.ready||!S().payAlerts||!S().alertsLink||Date.now()-devSyncAt<10*60000)return;devSyncAt=Date.now();
  const m=await getMcp();if(!m)return;try{const r=await m.callTool(WA_SERVER,'list_devices',{});const pl=(r&&r.payload)||{};if(Array.isArray(pl.devices))await keepDevices(pl.devices)}catch(e){}}
setInterval(autoSyncDevices,60000);setTimeout(autoSyncDevices,8000);
async function syncDevices(m){const r=await m.callTool(WA_SERVER,'list_devices',{});const pl=(r&&r.payload)||{};const list=pl.devices||[];await keepDevices(list);return S().pushDevices||list}
function alertQueue(){
  const s=S();if(!s.payAlerts&&!s.payWa)return [];const since=+s.payAlertSince||0,now=Date.now(),out=[];
  const due=a=>!(a&&a.st==='sent')&&!(a&&a.st==='failed'&&((a.tries||0)>=6||now-a.at<120000));
  for(const coll of ['orders','homejobs','invoices'])for(const doc of state[coll]||[])(doc.payments||[]).forEach((p,i)=>{
    if(!p||!p.at||p.at<since||now-p.at>2*864e5)return;if(due(p.alert))out.push({coll,id:doc.id,i});});
  if(s.payAlerts)for(const x of state.spotchecks||[])if(x.status==='failed'&&(x.doneAt||0)>=since&&now-(x.doneAt||0)<2*864e5&&due(x.alert))out.push({coll:'spotchecks',id:x.id,spot:true});
  return out;
}
const alertStats=()=>{const T=todayStr();let sent=0,failed=0,waiting=0;for(const coll of ['orders','homejobs','invoices'])for(const d of state[coll]||[])for(const p of d.payments||[]){if(!p||dayOf(p.at)!==T||(p.at<(+S().payAlertSince||0)))continue;const a=p.alert;if(a&&a.st==='sent')sent++;else if(a&&a.st==='failed'&&(a.tries||0)>=6)failed++;else if(S().payAlerts||S().payWa)waiting++}return {sent,failed,waiting}};
let alertRunning=false,alertTimer=null;
async function runPayAlerts(){
  if(alertRunning||!state.ready)return;const q=alertQueue();if(!q.length)return;const s=S();
  const m=await getMcp();if(!m)return;alertRunning=true;
  try{for(const x of q.slice(0,6)){
    if(mode==='cloud'&&db){try{const r=await db.collection(x.coll).doc(x.id).acquire({holder:idKey(),ttlMs:20000});if(!r||!r.acquired)continue}catch(e){}}
    const doc=state[x.coll].find(d=>d.id===x.id);if(!doc)continue;
    let ok=true,err='';
    if(x.spot){if(doc.alert&&doc.alert.st==='sent')continue;
      try{await ownerNotify(m,{title:`⚠ Spot check FAILED · ${doc.branchName||''}`,body:`${SPOT_TYPES[doc.type]||'Spot check'} — done by ${doc.doneBy||'staff'}${doc.note?'\n“'+doc.note+'”':''}`,tag:'spot-'+doc.id,urgent:true})}catch(e){ok=false;err=waErr(e)}
      const prev=doc.alert||{};try{await put('spotchecks',{...doc,alert:ok?{st:'sent',at:Date.now()}:{st:'failed',at:Date.now(),tries:(prev.tries||0)+1,error:err}})}catch(e){}
      continue}
    const p=(doc.payments||[])[x.i];if(!p||(p.alert&&p.alert.st==='sent'))continue;
    const params=payParams(x.coll,doc,p);
    if(s.payAlerts){try{await ownerNotify(m,payPush(params))}catch(e){ok=false;err=waErr(e)}}
    if(s.payWa&&!(p.alert&&p.alert.wa))for(const to of ownerPhones()){try{const r=await m.callTool(WA_SERVER,'send_template',{to,template:waTplName('payment'),language:waLang(),params});const pl=(r&&r.payload)||{};if(pl.ok===false)throw {code:'tool_error',message:JSON.stringify(pl),result:{structuredContent:pl}}}catch(e){if(!s.payAlerts){ok=false;err=waErr(e)}}}
    const d2=state[x.coll].find(d=>d.id===x.id);if(!d2)continue;const pays=[...(d2.payments||[])];const prev=(pays[x.i]||{}).alert||{};
    pays[x.i]={...pays[x.i],alert:ok?{st:'sent',at:Date.now(),wa:!!s.payWa}:{st:'failed',at:Date.now(),tries:(prev.tries||0)+1,error:err}};
    try{await put(x.coll,{...d2,payments:pays})}catch(e){}
  }}finally{alertRunning=false}
}
function kickPayAlerts(){clearTimeout(alertTimer);alertTimer=setTimeout(runPayAlerts,1200)}
setInterval(runPayAlerts,60000);
Object.assign(ACT,{
  dailyNow:async a=>{const m=await getMcp();if(!m)return;a.disabled=true;
    try{const r=await m.callTool(WA_SERVER,'send_daily_report',{});const p=r.payload||{};toast(p.ok?`✓ Report emailed to ${p.to}${p.failed&&p.failed.length?` · not sent to ${p.failed.length}: ${p.failed[0]}`:''}`:'Not sent — '+(p.error||'unknown error'))}catch(e){toast('Not sent — '+waErr(e))}a.disabled=false},
  alCopy:()=>copyText((waDraft&&waDraft.alertsLink)||S().alertsLink||'','FT Alerts link copied'),
  alDevices:async a=>{const m=await getMcp();if(!m){toast('Cannot reach the server — check your internet');return}a.disabled=true;const o=$('#alOut');o.textContent='Checking…';
    try{const l=await syncDevices(m);alOut=l.length?`<span class="yes">✓ ${l.length} device${l.length>1?'s':''} will get alerts:</span> ${l.map(d=>esc(d.label)).join(', ')}`:'<span class="low">No devices yet.</span> Open the FT Alerts link on your phone and tap Enable notifications.'}
    catch(e){alOut=`<span class="low">${esc(waErr(e))}</span>`}o.innerHTML=alOut;a.disabled=false},
  alTest:async a=>{const m=await getMcp();if(!m){toast('Cannot reach the server — check your internet');return}a.disabled=true;
    try{const r=await ownerNotify(m,payPush([S().branches[0]?.name||S().shopName,money(15000),'M-Pesa','TEST-001','Test customer',myName(),new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})]));toast(`✓ Test alert sent to ${r.sent} device${r.sent>1?'s':''}`)}
    catch(e){toast('Not sent — '+waErr(e))}a.disabled=false}
});

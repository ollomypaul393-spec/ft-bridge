'use strict';
/* =====================================================================================
   Receipt picture — the same look as the customer's receipt page (/o/…), drawn on the
   phone that saves the order, then sent to the server so WhatsApp can show it.
   ===================================================================================== */
function rcLoadImg(src){return new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=src})}
function rcRound(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
function rcFit(g,text,max){text=String(text??'');if(g.measureText(text).width<=max)return text;while(text.length>1&&g.measureText(text+'…').width>max)text=text.slice(0,-1);return text+'…'}
function rcStatus(o){
  const today=todayStr(),s=S();
  if(o.status==='collected')return ['Collected — thank you!','#eef0f3','#333'];
  if(o.status==='cancelled')return ['This order was cancelled','#fdeaea','#a12'];
  if(o.status==='ready'&&s.trackStages)return ['Ready for pickup 🎉','#e6f6ea','#1c6b33'];
  if(o.dueDate&&o.dueDate<=today)return ['Should be ready — you can come to pick it up','#e6f6ea','#1c6b33'];
  return [`In the shop · Ready by ${fmtD(o.dueDate)}`,'#fff6dc','#7a5b00'];
}
async function receiptPicture(o,{type='image/jpeg',quality=0.86}={}){
  const s=S(),c=calc(o),co=window.FT_CO||{short:coShort(),theme:{}},css=getComputedStyle(document.documentElement);
  const v=(k,d)=>(css.getPropertyValue(k)||'').trim()||d;
  const NAV=v('--nav','#0e0e0e'),ACC=v('--accent','#c9a227'),GOLD=v('--gold','#d4af37'),ACCLT=v('--accent-lt','#e6c65c'),ACCDK=v('--accent-dk2','#b8921f');
  try{await document.fonts.ready}catch(e){}
  const F=(w,px)=>`${w} ${px}px "DM Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const items=(o.items||[]).filter(i=>i.service!=='fee'),fees=(o.items||[]).filter(i=>i.service==='fee');
  const W=720,PAD=40,CW=W-PAD*2,rowH=46;
  const hasQr=!!(o.pub&&siteUrl()),hasFoot=!!(s.address||s.phone);
  const H=180+70+36+24+52+20+(items.length+fees.length)*rowH+14+120+18+(hasQr?24+232+12:0)+(hasFoot?38:0)+44+30;
  const SC=1.5,cv=document.createElement('canvas');cv.width=W*SC;cv.height=H*SC;const g=cv.getContext('2d');g.scale(SC,SC);
  g.fillStyle='#f6f4ee';g.fillRect(0,0,W,H);
  // header band
  g.fillStyle=NAV;g.fillRect(0,0,W,210);
  const shop=s.shopName||co.name||'';const m=/^(.*?)\s+(Laundry.*|Dry Cleaners?)$/i.exec(shop);
  let ly=34;
  if(co.logo){try{const im=await rcLoadImg(co.logo);g.fillStyle='#fff';rcRound(g,W/2-38,ly,76,76,18);g.fill();g.drawImage(im,W/2-34,ly+4,68,68)}catch(e){}}
  else{const gr=g.createLinearGradient(W/2-38,ly,W/2+38,ly+76);gr.addColorStop(0,ACCLT);gr.addColorStop(1,ACCDK);g.fillStyle=gr;rcRound(g,W/2-38,ly,76,76,18);g.fill();g.fillStyle=v('--accent-ink','#111');g.font=F(800,30);g.textAlign='center';g.textBaseline='middle';g.fillText(co.short||'FT',W/2,ly+40)}
  g.textAlign='center';g.textBaseline='alphabetic';
  if(m){g.font=F(700,24);const a=m[1]+' ',b=m[2];const wa=g.measureText(a).width;g.font=F(400,24);const wb=g.measureText(b).width;let x=W/2-(wa+wb)/2;g.textAlign='left';g.font=F(700,24);g.fillStyle=GOLD;g.fillText(a,x,ly+112);g.font=F(400,24);g.fillStyle='#fff';g.fillText(b,x+wa,ly+112);g.textAlign='center'}
  else{g.font=F(700,24);g.fillStyle=GOLD;g.fillText(shop,W/2,ly+112)}
  if(co.tagline){g.font=F('italic 400',16);g.fillStyle='rgba(255,255,255,.8)';g.fillText(co.tagline,W/2,ly+140)}
  // card
  const cy=180;g.save();g.shadowColor='rgba(0,0,0,.08)';g.shadowBlur=24;g.shadowOffsetY=6;g.fillStyle='#fff';rcRound(g,PAD-10,cy,CW+20,H-cy-30,22);g.fill();g.restore();
  g.save();rcRound(g,PAD-10,cy,CW+20,H-cy-30,22);g.clip();g.fillStyle=ACC;g.fillRect(PAD-10,cy,CW+20,6);g.restore();
  let y=cy+70;g.fillStyle='#111';g.font=F(800,46);g.fillText(o.ticket||'',W/2,y);
  y+=36;g.fillStyle='#666';g.font=F(400,20);g.fillText(`Hello ${String(o.customerName||'Customer').split(' ')[0]} 👋`,W/2,y);
  const [st,bg,fg]=rcStatus(o);y+=24;g.fillStyle=bg;rcRound(g,PAD+10,y,CW-20,52,14);g.fill();g.fillStyle=fg;g.font=F(700,19);g.fillText(rcFit(g,st,CW-50),W/2,y+33);
  y+=52+20;g.textAlign='left';
  const L=PAD+16,R=W-PAD-16;
  const line=(yy)=>{g.strokeStyle='#f0ece0';g.lineWidth=1;g.beginPath();g.moveTo(L,yy);g.lineTo(R,yy);g.stroke()};
  for(const i of [...items,...fees]){
    y+=rowH;const name=i.service==='fee'?i.garment:`${i.qty} × ${i.garment}`;const sv=i.service==='fee'?'':` · ${svc(i.service)}`;
    g.font=F(500,19);g.fillStyle='#222';const n=rcFit(g,name,CW*0.55);g.fillText(n,L,y-16);const nw=g.measureText(n).width;
    g.font=F(400,17);g.fillStyle='#999';g.fillText(rcFit(g,sv,CW*0.72-nw),L+nw,y-16);
    g.textAlign='right';g.font=F(500,19);g.fillStyle='#222';g.fillText(money(i.qty*i.price),R,y-16);g.textAlign='left';line(y);
  }
  y+=14;
  const tot=(label,val,big)=>{y+=40;g.font=F(big?800:400,big?23:19);g.fillStyle='#111';g.fillText(label,L,y);g.textAlign='right';g.fillText(val,R,y);g.textAlign='left'};
  tot('Total',money(c.total));tot('Paid',o.accountId?'On account':money(c.paid));tot('Balance',o.accountId?'On account':money(Math.max(0,c.bal)),true);
  y+=18;line(y);
  g.textAlign='center';
  if(o.pub&&siteUrl()){
    try{const q=await rcLoadImg(`/qr/${o.pub}.svg`);y+=24;g.drawImage(q,W/2-110,y,220,220);y+=232}catch(e){y+=10}
    g.fillStyle='#888';g.font=F(400,17);g.fillText(`Show this code or ticket ${o.ticket} when you collect.`,W/2,y+12);y+=12;
  }
  const foot=[s.address,s.phone?'Tel: '+s.phone:''].filter(Boolean).join('  ·  ');
  if(foot){g.fillStyle='#999';g.font=F(400,16);g.fillText(rcFit(g,foot,CW-20),W/2,y+38)}
  return cv.toDataURL(type,quality);
}
/* make the picture, store it on the server, return the public link WhatsApp can fetch */
async function uploadReceiptPicture(o){
  if(!window.FT_STANDALONE||!window.ftApi||!o||!o.pub)throw new Error('not available');
  const image=await receiptPicture(o);
  const r=await window.ftApi('/api/receipt-image',{method:'POST',body:JSON.stringify({pub:o.pub,image})});
  return r.url;
}
Object.assign(ACT,{
  rcPicture:async a=>{const o=findOrder(a.dataset.id);if(!o)return;a.disabled=true;
    try{const o2=await ensurePub(o);const url=await receiptPicture(o2);const l=document.createElement('a');l.href=url;l.download=`Receipt ${o2.ticket}.jpg`;document.body.appendChild(l);l.click();l.remove();toast('Receipt picture saved')}
    catch(e){toast('Could not make the picture')}a.disabled=false}
});

/** The "FT Alerts" installable web app (PWA) that receives the owner's push notifications. */

export const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6c65c"/><stop offset="1" stop-color="#b8921f"/></linearGradient></defs><rect width="192" height="192" rx="40" fill="#0e0e0e"/><rect x="24" y="24" width="144" height="144" rx="32" fill="url(#g)"/><text x="96" y="122" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="72" text-anchor="middle" fill="#0e0e0e">FT</text></svg>`;

export function manifest(base) {
  return JSON.stringify({
    name: 'FT Alerts — Fast Technology',
    short_name: 'FT Alerts',
    start_url: `${base}/`,
    scope: `${base}/`,
    display: 'standalone',
    background_color: '#0e0e0e',
    theme_color: '#0e0e0e',
    icons: [{ src: `${base}/icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
  });
}

export function serviceWorker(base, appUrl) {
  return `self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{}}catch(x){d={title:'FT Alerts',body:e.data?e.data.text():''}}
  e.waitUntil(self.registration.showNotification(d.title||'FT Alerts',{body:d.body||'',icon:'${base}/icon.svg',badge:'${base}/icon.svg',tag:d.tag||undefined,renotify:!!d.tag,requireInteraction:!!d.urgent,vibrate:[120,60,120],data:{url:d.url||${JSON.stringify(appUrl || '')}||'${base}/'}}));
  e.waitUntil(self.clients.matchAll({type:'window'}).then(cs=>cs.forEach(c=>c.postMessage({type:'alert'}))));
});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=(e.notification.data&&e.notification.data.url)||'${base}/';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{for(const c of cs){if(c.url.startsWith(url)&&'focus' in c)return c.focus()}return self.clients.openWindow(url)}));
});`;
}

export function page(base, vapidPublicKey, appUrl) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FT Alerts</title><link rel="manifest" href="${base}/manifest.webmanifest"><link rel="icon" href="${base}/icon.svg"><link rel="apple-touch-icon" href="${base}/icon.svg">
<meta name="theme-color" content="#0e0e0e"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black">
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0e0e0e;color:#eee;min-height:100vh}
.wrap{max-width:520px;margin:0 auto;padding:24px 18px 40px}
.logo{width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,#e6c65c,#b8921f);color:#111;font-weight:800;font-size:26px;display:grid;place-items:center;margin:8px 0 12px}
h1{margin:0;font-size:22px}h1 b{color:#d4af37}p{color:#bbb;line-height:1.45}
.card{background:#181818;border:1px solid #2c2c2c;border-radius:16px;padding:16px;margin:16px 0}
.btn{display:block;width:100%;border:0;border-radius:12px;padding:14px;font-size:16px;font-weight:700;cursor:pointer;background:linear-gradient(135deg,#e6c65c,#c9a227);color:#111}
.btn.ghost{background:#222;color:#eee;border:1px solid #333;margin-top:10px}
input{width:100%;padding:12px;border-radius:10px;border:1px solid #333;background:#111;color:#fff;font-size:15px;margin:8px 0 12px}
.ok{color:#3ddc84;font-weight:700}.bad{color:#ff8a80;font-weight:700}.muted{color:#888;font-size:13px}
.al{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #262626}.al b{display:block}.al small{color:#888}
.ios{background:#2a2414;border:1px solid #6b5520;color:#f1dfa4;border-radius:12px;padding:12px;font-size:14px}
</style></head><body><div class="wrap">
<div class="logo">FT</div><h1><b>Fast Technology</b> Alerts</h1>
<p>Get a notification on this device for every payment recorded in the shop, and for failed spot checks — even when everything is closed.</p>
<div id="ios" class="ios" hidden>On iPhone / iPad: tap <b>Share</b> → <b>Add to Home Screen</b>, then open <b>FT Alerts</b> from your home screen and come back to this step.</div>
<div class="card" id="setup">
  <div id="state" class="muted">Checking…</div>
  <label class="muted" for="label">Name this device</label><input id="label" placeholder="e.g. Owner's phone, Office computer">
  <button class="btn" id="enable">🔔 Enable notifications</button>
  <button class="btn ghost" id="test" hidden>Send a test notification</button>
</div>
${appUrl ? `<p class="muted">Tapping a notification opens the shop app.</p>` : ''}
<div class="card"><b>Recent alerts</b><div id="feed" class="muted" style="margin-top:8px">—</div></div>
</div>
<script>
const BASE=${JSON.stringify(base)},VAPID=${JSON.stringify(vapidPublicKey)};
const $=s=>document.querySelector(s);
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent),standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
if(isIOS&&!standalone)$('#ios').hidden=false;
$('#label').value=localStorage.getItem('ft-label')||(isIOS?'iPhone':/android/i.test(navigator.userAgent)?'Android phone':'Computer');
function u8(b){const p='='.repeat((4-b.length%4)%4);const s=atob((b+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...s].map(c=>c.charCodeAt(0)))}
async function reg(){return navigator.serviceWorker.register(BASE+'/sw.js',{scope:BASE+'/'})}
async function refresh(){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)){$('#state').innerHTML='<span class="bad">This browser cannot receive notifications.</span>'+(isIOS?' Add it to your Home Screen first (see above).':' Use Chrome, Edge, Firefox or Safari.');$('#enable').disabled=true;return}
  const r=await reg();const sub=await r.pushManager.getSubscription();
  if(sub&&Notification.permission==='granted'){$('#state').innerHTML='<span class="ok">✓ Notifications are ON for this device.</span>';$('#enable').textContent='Update device name';$('#test').hidden=false}
  else if(Notification.permission==='denied'){$('#state').innerHTML='<span class="bad">Notifications are blocked.</span> Allow them for this site in the browser / phone settings, then reload.'}
  else $('#state').textContent='Notifications are off on this device.';
}
$('#enable').onclick=async()=>{try{const p=await Notification.requestPermission();if(p!=='granted'){refresh();return}
  const r=await reg();await navigator.serviceWorker.ready;let sub=await r.pushManager.getSubscription();if(!sub)sub=await r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:u8(VAPID)});
  const label=$('#label').value.trim()||'Device';localStorage.setItem('ft-label',label);
  const res=await fetch(BASE+'/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({subscription:sub.toJSON(),label})});
  if(!res.ok)throw new Error(await res.text());refresh();loadFeed();}catch(e){$('#state').innerHTML='<span class="bad">Could not turn on notifications: '+e.message+'</span>'}};
$('#test').onclick=async()=>{await fetch(BASE+'/test',{method:'POST'});};
async function loadFeed(){try{const r=await fetch(BASE+'/feed');const l=await r.json();$('#feed').innerHTML=l.length?l.map(a=>'<div class="al"><div><b>'+esc(a.title)+'</b>'+esc(a.body||'')+'<br><small>'+new Date(a.at).toLocaleString()+'</small></div></div>').join(''):'No alerts yet.'}catch(e){}}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
navigator.serviceWorker&&navigator.serviceWorker.addEventListener('message',loadFeed);
refresh();loadFeed();setInterval(loadFeed,60000);
</script></body></html>`;
}

'use strict';
/* ================= constants ================= */
const DEF_SERVICES=[{k:'dry',label:'Dry clean'},{k:'wash',label:'Wash & iron'},{k:'iron',label:'Iron only'}];
const SVC=()=>{const l=(state.settings||{}).services;return l&&l.length?l:DEF_SERVICES};
const STATUSES=[{k:'received',label:'Received'},{k:'processing',label:'In process'},{k:'ready',label:'Ready'},{k:'collected',label:'Collected'}];
const EXP_CATS=['Rent','Electricity','Water','Detergents & chemicals','Salaries & wages','Transport & delivery','Repairs & maintenance','Packaging & hangers','Marketing','Claims & refunds','Taxes & licences','Other'];
const ISSUE_TYPES=['Damaged garment','Lost item','Stain not removed','Late delivery','Wrong item returned','Shrinkage / colour run','Service complaint','Other'];
const PRICE_CATS=['Garments','Traditional wear','Household','Wedding & special','Other'];
const ROLES=['Manager','Front desk / Cashier','Cleaner / Washer','Presser / Ironer','Driver / Rider','Other'];
const DEF={
  shopName:'Fast Technology Dry Cleaner',phone:'',email:'',address:'',tin:'',vrn:'',currency:'TSh',countryCode:'255',
  expressPct:50,turnaround:3,expressTurnaround:1,
  trackStages:false,
  vatPct:0,invoicePrefix:'INV',defaultTerms:30,bankDetails:'',invoiceNotes:'Please quote the invoice number when paying. Thank you for your business.',
  methods:['Cash','M-Pesa','Mixx by Yas','Airtel Money','HaloPesa','Card','Bank'],
  receiptFooter:'Please keep this ticket. Items not collected within 60 days may be disposed of. Thank you!',
  loyalty:{enabled:true,spendPerPoint:1000,pointValue:20,minRedeem:100},
  adminPinHash:'',
  branches:[{id:'hq',name:'Fast Technology HQ',type:'HQ',city:'Dar es Salaam',phone:''}],
  priceList:[
    {id:'p1',cat:'Garments',name:'Shirt / Blouse',prices:{dry:3000,wash:2000,iron:1000}},
    {id:'p2',cat:'Garments',name:'Trousers',prices:{dry:4000,wash:2500,iron:1000}},
    {id:'p3',cat:'Garments',name:'Suit (2-piece)',prices:{dry:12000,wash:0,iron:4000}},
    {id:'p4',cat:'Garments',name:'Suit jacket / Blazer',prices:{dry:7000,wash:0,iron:2500}},
    {id:'p5',cat:'Garments',name:'Dress',prices:{dry:8000,wash:5000,iron:2000}},
    {id:'p6',cat:'Garments',name:'Skirt',prices:{dry:4000,wash:2500,iron:1000}},
    {id:'p7',cat:'Garments',name:'Coat / Jacket',prices:{dry:10000,wash:6000,iron:3000}},
    {id:'p13',cat:'Garments',name:'Tie',prices:{dry:2000,wash:0,iron:500}},
    {id:'p8',cat:'Traditional wear',name:'Kitenge / Kanga',prices:{dry:3000,wash:2000,iron:1000}},
    {id:'p9',cat:'Traditional wear',name:'Kanzu',prices:{dry:5000,wash:3500,iron:1500}},
    {id:'p10',cat:'Household',name:'Bedsheet',prices:{dry:4000,wash:3000,iron:1500}},
    {id:'p11',cat:'Household',name:'Blanket / Duvet',prices:{dry:15000,wash:12000,iron:0}},
    {id:'p12',cat:'Household',name:'Curtain (per panel)',prices:{dry:6000,wash:5000,iron:2000}},
    {id:'p14',cat:'Wedding & special',name:'Wedding gown',prices:{dry:40000,wash:0,iron:0}}
  ]
};
const ICON={
 dashboard:'<path d="M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z"/>',
 orders:'<path d="M9 3h6l1 2h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3zm-1 8h8v-2H8zm0 4h8v-2H8zm0 4h5v-2H8z"/>',
 plus:'<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/>',
 customers:'<path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-3.3 0-7 1.7-7 4v3h14v-3c0-2.3-3.7-4-7-4zm8-2a3 3 0 1 0 0-6v6zm1 2.2c1.8.7 4 2 4 3.8v3h-4v-3c0-1.5-.7-2.8-1.8-3.8z"/>',
 expenses:'<path d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2H3zm0 4h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm12 4v2h3v-2z"/>',
 reports:'<path d="M4 20V10h3v10zm6.5 0V4h3v16zM17 20v-7h3v7z"/>',
 settings:'<path d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.4-2.5 1a7 7 0 0 0-1.7-1L15 3.3h-4l-.4 2.7a7 7 0 0 0-1.7 1l-2.5-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.4 2.5-1a7 7 0 0 0 1.7 1l.4 2.7h4l.4-2.7a7 7 0 0 0 1.7-1l2.5 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/>',
 delivery:'<path d="M2 6h12v10H2zm12 3h4.5l3.5 3.5V16h-8zM6.5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>',
 production:'<path d="M3 4h5v16H3zm6.5 0h5v10h-5zM16 4h5v13h-5z"/>',
 inventory:'<path d="M12 2 3 6.5v11L12 22l9-4.5v-11zm0 2.2 6.3 3.1L12 10.5 5.7 7.3zM5 9l6 3v7.6l-6-3zm8 10.6V12l6-3v7.6z"/>',
 staff:'<path d="M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm7 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm-5 11h10c0-2-2.2-3.5-5-3.5S7 16 7 18z"/>',
 payments:'<path d="M2 6h20v12H2zm10 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM5 8v2a2 2 0 0 0 2-2zm12 0a2 2 0 0 0 2 2V8zM5 14v2h2a2 2 0 0 0-2-2zm14 0a2 2 0 0 0-2 2h2z"/>',
 debtors:'<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 5h2v7h-2zm0 9h2v2h-2z"/>',
 prices:'<path d="M3 3h8l10 10-8 8L3 11zm4 2.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>',
 corporate:'<path d="M4 21V3h10v5h6v13h-6v-4h-4v4zm3-15v2h2V6zm4 0v2h2V6zM7 10v2h2v-2zm4 0v2h2v-2zm6 2v2h2v-2zM7 14v2h2v-2zm4 0v2h2v-2zm6 2v2h2v-2z"/>',
 invoice:'<path d="M6 2h9l5 5v15H6zm8 1.5V8h4.5zM9 11v2h8v-2zm0 4v2h8v-2zm0-8v2h4V7z"/>',
 issues:'<path d="M5 21V3h11l-1.5 4L16 11H7v10z"/>',
 loyalty:'<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>',
 promotions:'<path d="M7 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm10 12a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM18.6 3.4l2 2L5.4 20.6l-2-2z"/>',
 campaigns:'<path d="M3 9h4l8-5v16l-8-5H3zm14 0a3 3 0 0 1 0 6zM6 15h3l1 5H7z"/>',
 suppliers:'<path d="M2 21V10l6 3v-3l6 3V4h4l2 4v13z"/>',
 pnl:'<path d="M3 18l6-6 4 4 6-6 2 2V6h-6l2 2-4 4-4-4-8 8zM3 20h18v2H3z"/>',
 payroll:'<path d="M4 5h14a2 2 0 0 1 2 2v1h-6a4 4 0 0 0 0 8h6v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm10 5h8v4h-8a2 2 0 0 1 0-4z"/>',
 access:'<path d="M7 10V7a5 5 0 0 1 10 0v3h2v11H5V10zm2 0h6V7a3 3 0 0 0-6 0z"/>',
 myday:'<path d="M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm-1-6h2v4h-2zm0 18h2v4h-2zM1 11h4v2H1zm18 0h4v2h-4zM4.2 5.6l1.4-1.4 2.8 2.8L7 8.4zm11.4 11.4 1.4-1.4 2.8 2.8-1.4 1.4zM4.2 18.4l2.8-2.8 1.4 1.4-2.8 2.8zM15.6 7l2.8-2.8 1.4 1.4L17 8.4z"/>',
 menu:'<path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/>',
 messages:'<path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 5v2h10V8zm0 4v2h7v-2z"/>',
 inout:'<path d="M7 7h11l-3-3 1.4-1.4L22 8l-5.6 5.4L15 12l3-3H7zm10 10H6l3 3-1.4 1.4L2 16l5.6-5.4L9 12l-3 3h11z"/>',
 dispatch:'<path d="M2 21l21-9L2 3v7l15 2-15 2z"/>',
 overdue:'<path d="M6 2h12v6l-4 4 4 4v6H6v-6l4-4-4-4zm2 2v3.2l4 4 4-4V4z"/>',
 home:'<path d="M4 10a2 2 0 0 1 2 2v3h12v-3a2 2 0 1 1 4 0v7h-2v-2H4v2H2v-7a2 2 0 0 1 2-2zm2-5h12a2 2 0 0 1 2 2v1.3A4 4 0 0 0 16 12v1H8v-1a4 4 0 0 0-4-3.7V7a2 2 0 0 1 2-2z"/>',
 tracking:'<path d="M10 2a8 8 0 0 1 6.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/>',
 packager:'<path d="M3 7l9-5 9 5v10l-9 5-9-5zm7.5 9.5l5-5-1.4-1.4-3.6 3.6-1.6-1.6-1.4 1.4z"/>',
 lipa:'<path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 3v12h10V5zm5 13.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM11 6h2v1h2v2h-4v1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1h-2v-1H9v-2h4v-1h-3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h1z"/>',
 refunds:'<path d="M12 5V1L6 7l6 6V9a6 6 0 1 1-6 6H4a8 8 0 1 0 8-10z"/>',
 ridercash:'<path d="M5 18.5a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-2a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm14 2a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-2a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM9 9h4l2-3h3l1 2h-3l-1 2 3 4h-2.5l-2-3H10l-2 3H6l3-5z"/>',
 closeday:'<path d="M14 2a9 9 0 1 0 8 13.2A8 8 0 0 1 14 2z"/>',
 safe:'<path d="M3 3h18v16h-2v2h-3v-2H8v2H5v-2H3zm9 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/>',
 bell:'<path d="M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22zm7-6v-5a7 7 0 0 0-5.5-6.8V3a1.5 1.5 0 0 0-3 0v1.2A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"/>',
 branches:'<path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7zm0 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/>',
 profile:'<path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm0 14a8 8 0 0 0 6-2.7c-1-1.8-3.3-3-6-3s-5 1.2-6 3A8 8 0 0 0 12 20z"/>',
 camera:'<path d="M9 3h6l1.5 2H20a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3.5zm3 5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/>',
 g_people:'<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9v-1c0-3 3-5 7-5s7 2 7 5v1zm14.5-9.5a2.5 2.5 0 1 0-1-4.8 5.9 5.9 0 0 1 0 4.6c.3.1.6.2 1 .2zM4.5 11.5a2.5 2.5 0 1 1 1-4.8 5.9 5.9 0 0 0 0 4.6c-.3.1-.6.2-1 .2z"/>',
 g_gear:'<path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm8.7 2.5-2-.3a7 7 0 0 0-.7-1.6l1.2-1.6-1.9-1.9-1.6 1.2a7 7 0 0 0-1.6-.7l-.3-2h-2.7l-.3 2a7 7 0 0 0-1.6.7L7.6 5.1 5.7 7l1.2 1.6a7 7 0 0 0-.7 1.6l-2 .3v2.7l2 .3c.2.6.4 1.1.7 1.6l-1.2 1.6 1.9 1.9 1.6-1.2c.5.3 1 .5 1.6.7l.3 2h2.7l.3-2c.6-.2 1.1-.4 1.6-.7l1.6 1.2 1.9-1.9-1.2-1.6c.3-.5.5-1 .7-1.6l2-.3z"/>',
 wa:'<path d="M12 2a10 10 0 0 0-8.7 14.9L2 22l5.2-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.1 14.9l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 0 1 12 4zm-3.2 4c-.2 0-.5.1-.7.3-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.8 4.4 3.8 2.2.9 2.6.7 3.1.6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3l-1.7-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.3-.1-1.1-.4-2-1.3-.8-.7-1.3-1.5-1.4-1.8-.2-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5v-.5l-.8-1.9c-.2-.4-.4-.4-.5-.4z"/>',
 reportlog:'<path d="M6 2h9l5 5v15H6zm8 1.5V8h4.5zM8 12v2h3v-2zm0 4v2h3v-2zm5-4v2h5v-2zm0 4v2h5v-2z"/>',
 spot:'<path d="M10 2a8 8 0 0 1 6.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1 1 10 2zm-1 11.4 4.9-4.9-1.4-1.4L9 10.6 7.5 9.1 6.1 10.5z"/>',
 g_home:'<path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z"/>',
 g_hanger:'<path d="M12 3a3 3 0 0 0-3 3h2a1 1 0 1 1 1 1h-1v2.4L2.6 15.6A1.5 1.5 0 0 0 3.5 18h17a1.5 1.5 0 0 0 .9-2.4L13 9.4V8.8A3 3 0 0 0 12 3zm0 8.3L18.5 16h-13z"/>',
 g_heart:'<path d="M12 21l-1.5-1.3C5 15 2 12.2 2 8.6 2 5.6 4.4 3.3 7.3 3.3c1.7 0 3.4.8 4.7 2.1 1.3-1.3 3-2.1 4.7-2.1 2.9 0 5.3 2.3 5.3 5.3 0 3.6-3 6.4-8.5 11.1z"/>',
 g_book:'<path d="M4 4a2 2 0 0 1 2-2h14v17H6a1 1 0 0 0 0 2h14v1H6a3 3 0 0 1-3-3zm4 2v2h8V6z"/>',
 g_case:'<path d="M9 3h6a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v4H2V8a2 2 0 0 1 2-2h3V5a2 2 0 0 1 2-2zm0 3h6V5H9zM2 14h8v2h4v-2h8v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/>',
 g_bank:'<path d="M12 2l10 5v2H2V7zM4 11h3v7H4zm6.5 0h3v7h-3zM17 11h3v7h-3zM2 20h20v2H2z"/>',
 g_shield:'<path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5zm-1 13.5l6-6-1.4-1.4-4.6 4.6-2.1-2.1L7.5 12z"/>'
};
const EO=new Set(['spot','wa','tracking','safe','profile','branches','lipa','camera','ridercash','g_gear']);
const ic=k=>`<svg viewBox="0 0 24 24" fill="currentColor" fill-rule="${EO.has(k)?'evenodd':'nonzero'}" aria-hidden="true">${ICON[k]||''}</svg>`;
const CHEV='<svg class="chev" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>';

/* ================= helpers ================= */
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const pad=n=>String(n).padStart(2,'0');
const dstr=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const todayStr=()=>dstr(new Date());
const addDays=(s,n)=>{const d=new Date(s+'T00:00:00');d.setDate(d.getDate()+(+n||0));return dstr(d)};
const dayOf=ms=>ms?dstr(new Date(ms)):'';
const fmtD=s=>{if(!s)return '—';const d=typeof s==='number'?new Date(s):new Date(s+'T00:00:00');if(isNaN(d))return '—';return d.toLocaleDateString(undefined,{day:'numeric',month:'short',year:d.getFullYear()!==new Date().getFullYear()?'numeric':undefined})};
const fmtDT=ms=>ms?new Date(ms).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
const fmtT=ms=>new Date(ms).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
const monthLabel=m=>new Date(m+'-01T00:00:00').toLocaleDateString(undefined,{month:'short',year:'numeric'});
const num=n=>Math.round(+n||0).toLocaleString();
const money=n=>`${S().currency} ${num(n)}`;
const normPhone=p=>String(p||'').replace(/\D/g,'').slice(-9);
const daysBetween=(a,b)=>Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/864e5);
const sum=(a,f)=>a.reduce((x,y)=>x+(+f(y)||0),0);
const initials=n=>String(n||'?').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('')||'?';
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),2600)}
function svc(k){if(k==='fee')return 'Service fee';return (SVC().find(s=>s.k===k)||{label:k}).label}
const STL={booked:'Booked',out:'Out for delivery',requested:'Requested',approved:'Approved',rejected:'Rejected',received:'Received',processing:'In process',ready:'Ready',collected:'Collected',cancelled:'Cancelled',draft:'Draft',sent:'Sent',paid:'Paid',overdue:'Overdue',void:'Void',open:'Open',progress:'In progress',resolved:'Resolved',active:'Active',inactive:'Inactive'};
const stLabel=k=>STL[k]||k;
const pill=s=>{if(!stagesOn()&&['received','processing','ready'].includes(s))return '<span class="pill st-received">In shop</span>';return `<span class="pill st-${esc(s)}">${esc(stLabel(s))}</span>`};
function opts(list,cur){return list.map(x=>{const v=typeof x==='string'?x:x[0],l=typeof x==='string'?x:x[1];return `<option value="${esc(v)}" ${String(v)===String(cur)?'selected':''}>${esc(l)}</option>`}).join('')}
function bars(obj,color){const e=Object.entries(obj).filter(x=>x[1]).sort((a,b)=>b[1]-a[1]);const max=Math.max(1,...e.map(x=>x[1]));return e.length?`<div class="bars">${e.map(([k,v])=>`<div class="b"><span>${esc(k)}</span><div class="track"><div class="fill" style="width:${v/max*100}%;${color?'background:'+color:''}"></div></div><span class="amt">${num(v)}</span></div>`).join('')}</div>`:'<div class="muted small">No data for this period.</div>'}
async function copyText(t,msg){try{await navigator.clipboard.writeText(t);toast(msg||'Copied');return true}catch(e){window._copy=t;openModal('copy');return false}}

/* ================= registries ================= */
const VIEWS={},AFTER={},MODALS={},ACT={},IN={},ONCHANGE=new Set(),FORM_ROUTES=new Set(),RESET=[],REFRESH={};
const LIVE_MODALS=new Set(['order','customer','invoice','account','receipt']);

/* ================= state & storage ================= */
const COLLS=['reportlog','spotchecks','links','customers','orders','expenses','supplies','deliveries','staff','staffpay','attendance','promos','accounts','invoices','issues','suppliers','profiles','messages','homejobs','refunds','closings','safedrops','drawers'];
const ADMIN_READ=new Set(['expenses','staffpay','invoices']);
const state={settings:null,ready:false};COLLS.forEach(c=>state[c]=[]);
let db=null,mode='loading',canWrite=true,loadNote='',viewerAdmin=true,portal='admin',me=null,viewerId=null,userNs=null,meAvatar='';const profCache={};
const LS='drycleaning-manager-v1';
function S(){const s=state.settings||{};return {...DEF,...s,branches:(s.branches&&s.branches.length)?s.branches:DEF.branches,loyalty:{...DEF.loyalty,...(s.loyalty||{})},priceList:(s.priceList&&s.priceList.length)?s.priceList:DEF.priceList,methods:(s.methods&&s.methods.length)?s.methods:DEF.methods}}
function lsSave(){try{const o={settings:state.settings};COLLS.forEach(c=>o[c]=state[c]);localStorage.setItem(LS,JSON.stringify(o))}catch(e){}}
function goLocal(){
  mode='local';let d={};try{d=JSON.parse(localStorage.getItem(LS))||{}}catch(e){}
  COLLS.forEach(c=>state[c]=d[c]||[]);state.settings=d.settings||null;state.ready=true;render();
}
const QUERIES={orders:c=>c.orderBy('createdAt','desc').limit(1000),customers:c=>c.orderBy('name').limit(1000),expenses:c=>c.orderBy('date','desc').limit(1000),supplies:c=>c.orderBy('name').limit(500),deliveries:c=>c.orderBy('date','desc').limit(500),staff:c=>c.orderBy('name').limit(200),staffpay:c=>c.limit(200),attendance:c=>c.orderBy('date','desc').limit(62),promos:c=>c.limit(300),accounts:c=>c.orderBy('name').limit(500),invoices:c=>c.orderBy('date','desc').limit(1000),issues:c=>c.orderBy('createdAt','desc').limit(500),suppliers:c=>c.orderBy('name').limit(300),profiles:c=>c.limit(300),messages:c=>c.orderBy('at','desc').limit(200),homejobs:c=>c.orderBy('date','desc').limit(500),refunds:c=>c.orderBy('createdAt','desc').limit(500),closings:c=>c.orderBy('date','desc').limit(400),safedrops:c=>c.orderBy('at','desc').limit(500),drawers:c=>c.limit(50),links:c=>c.limit(500),reportlog:c=>c.limit(200),spotchecks:c=>c.orderBy('requestedAt','desc').limit(300)};
async function connect(){
  if(!window.claude||typeof window.claude.use!=='function')return goLocal();
  let d=null;try{d=await window.claude.use('db')}catch(e){}
  if(!d)return goLocal();
  db=d;mode='cloud';
  try{const u=await window.claude.use('user');userNs=u;if(u){if(typeof u.id==='function')viewerId=await u.id();if(typeof u.me==='function'){const mm=await u.me();if(mm&&mm.avatarUrl&&!String(mm.avatarUrl).startsWith('data:'))meAvatar=mm.avatarUrl}if(typeof u.canEdit==='function'){const a=await u.canEdit();if(a===false)viewerAdmin=false}if(typeof u.can==='function'){const w=await u.can('data.write');if(w===false)canWrite=false}}}catch(e){}
  if(!viewerAdmin&&portal==='admin'){portal='locked';saveSession()}
  const need=COLLS.length+1,seen=new Set();let confirmed=false;
  const timer=setTimeout(()=>{if(!confirmed){loadNote='Still connecting to the cloud — what you see may not be up to date yet.';state.ready=true;render()}},10000);
  const mark=(k,meta)=>{seen.add(k);if(seen.size>=need){state.ready=true;if(!meta.fromCache&&!confirmed){confirmed=true;clearTimeout(timer);loadNote=''}}if(state.ready)onData()};
  const err=k=>e=>{if(ADMIN_READ.has(k)&&!viewerAdmin){mark(k,{fromCache:false});return}clearTimeout(timer);state.ready=true;loadNote=e&&e.code==='revoked'?'Your access to the shop has been removed. Ask the owner.':'Live sync stopped. Reload the page to reconnect.';render()};
  const docs=s=>s.docs.map(x=>({...x.data(),id:x.id}));
  for(const c of COLLS){try{QUERIES[c](db.collection(c)).onSnapshot(s=>{state[c]=docs(s);if(c==='links')resolveLinkAvatars();mark(c,s.metadata)},err(c))}catch(e){mark(c,{fromCache:false})}}
  db.doc('settings/shop').onSnapshot(s=>{state.settings=s.exists?s.data():null;mark('settings',s.metadata)},err('settings'));
}
function writeErr(e){
  if(e&&e.code==='invalid_argument'){toast("Couldn't save — your access level doesn't allow this.")}
  else if(e&&e.code==='quota_exceeded')toast('Storage is full: '+(e.message||''));
  else toast('Save failed — check your connection and try again.');
}
async function put(coll,obj){
  if(!canWrite){toast('You have view-only access.');throw new Error('readonly')}
  const {id,...body}=obj;const clean=JSON.parse(JSON.stringify(body));
  if(mode==='cloud'){try{await db.collection(coll).doc(id).set(clean)}catch(e){writeErr(e);throw e}}
  else{const a=state[coll];const i=a.findIndex(x=>x.id===id);const rec={...clean,id};if(i>=0)a[i]=rec;else a.unshift(rec);lsSave();onData()}
}
async function del(coll,id){
  if(!canWrite){toast('You have view-only access.');throw new Error('readonly')}
  if(mode==='cloud'){try{await db.collection(coll).doc(id).delete()}catch(e){writeErr(e);throw e}}
  else{state[coll]=state[coll].filter(x=>x.id!==id);lsSave();onData()}
}
async function putSettings(s){
  if(!canWrite){toast('You have view-only access.');throw new Error('readonly')}
  const clean=JSON.parse(JSON.stringify(s));
  if(mode==='cloud'){try{await db.doc('settings/shop').set(clean)}catch(e){writeErr(e);throw e}}
  else{state.settings=clean;lsSave();onData()}
}

/* ================= portals ================= */
function loadSession(){portal='auto';me=null}
function saveSession(){}
const inAdmin=()=>portal==='admin'&&viewerAdmin;
const branchById=id=>S().branches.find(b=>b.id===id);
function curBranch(){const bs=S().branches;let id=null;try{id=JSON.parse(localStorage.getItem('dc-branch'))}catch(e){}return bs.find(b=>b.id===id)||bs[0]}
function avatarHtml(key,name){const p=state.profiles.find(x=>x.id===key);if(p&&typeof p.photo==='string'&&p.photo.startsWith('data:image/'))return `<img src="${esc(p.photo)}" alt="">`;
  let url='';if(key==='admin'&&viewerAdmin&&!myLink())url=meAvatar;else{const l=state.links.find(x=>x.staffId===key);if(l&&l.id===viewerId&&meAvatar)url=meAvatar;else if(l&&profCache[l.id])url=profCache[l.id]}
  return url?`<img src="${esc(url)}" alt="" onerror="this.remove()">`:esc(initials(name))}
async function resolveLinkAvatars(){if(!userNs||typeof userNs.profiles!=='function')return;const ids=state.links.map(l=>l.id).filter(Boolean);if(!ids.length)return;try{const ps=await userNs.profiles(ids);let ch=false;for(const id of ids){const p=ps[id];const u=p&&p.avatarUrl&&!String(p.avatarUrl).startsWith('data:')?p.avatarUrl:'';if(profCache[id]!==u){profCache[id]=u;ch=true}if(p&&p.name)profCache['n:'+id]=p.name}if(ch&&state.ready)onData()}catch(e){}}
function roleLabel(){if(inAdmin())return 'Administrator';const r=(meStaff()||{}).role||'Staff';return /front|cash|recep/i.test(r)?'Receptionist':r}
function hubName(){if(inAdmin())return 'Admin Hub';const r=String((meStaff()||{}).role||'').toLowerCase();if(/recep|front|cash/.test(r))return 'Reception Hub';if(/driver|rider/.test(r))return 'Rider Hub';if(/clean|wash|press|iron/.test(r))return 'Workshop Hub';if(/manag/.test(r))return 'Manager Hub';return 'Staff Hub'}
const meStaff=()=>{const s=me?findStaff(me):null;return s&&s.active!==false?s:null};
async function sha(s){try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('dc1:'+s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch(e){let h=7;for(const c of 'dc1:'+s)h=(h*31+c.charCodeAt(0))|0;return 'x'+h}}

/* ================= domain ================= */
function calc(o){
  const items=o.items||[];
  const sub=sum(items,i=>(+i.qty||0)*(+i.price||0));
  const exp=o.express?Math.round(sub*(+o.expressPct||0)/100):0;
  const disc=(+o.discount||0)+(+o.acctDisc||0)+(+o.promoDisc||0)+(+o.loyaltyDisc||0);
  const total=Math.max(0,sub+exp-disc);
  const paid=sum(o.payments||[],p=>p.amount);
  return {sub,exp,disc,total,paid,bal:total-paid,pieces:sum(items,i=>i.service==='fee'?0:i.qty)};
}
const stagesOn=()=>!!S().trackStages;
/* 'In shop' = not yet collected. With stages off, ready orders also count as in shop. */
const inShop=o=>o.status==='received'||o.status==='processing'||o.status==='ready';
const isActive=o=>stagesOn()?(o.status==='received'||o.status==='processing'):inShop(o);
const isReady=o=>stagesOn()?o.status==='ready':(inShop(o)&&!!o.dueDate&&o.dueDate<=todayStr());
const isOverdue=o=>isActive(o)&&o.dueDate&&o.dueDate<todayStr();
const owes=o=>o.status!=='cancelled'&&!o.accountId&&calc(o).bal>0;
const orders=()=>[...state.orders].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
const findOrder=id=>state.orders.find(o=>o.id===id);
const findCust=id=>state.customers.find(c=>c.id===id);
const findStaff=id=>state.staff.find(s=>s.id===id);
const findAccount=id=>state.accounts.find(a=>a.id===id);
const findSupplier=id=>state.suppliers.find(a=>a.id===id);
const findInvoice=id=>state.invoices.find(a=>a.id===id);
const salaryOf=id=>+((state.staffpay.find(x=>x.id===id)||{}).salary)||0;
const activeStaff=()=>state.staff.filter(s=>s.active!==false).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
const lowStock=()=>state.supplies.filter(x=>(+x.qty||0)<=(+x.reorder||0));
const attFor=d=>((state.attendance.find(a=>a.id===d)||{}).marks)||{};
const dvOpen=d=>d.status!=='done'&&d.status!=='cancelled';
const openIssues=()=>state.issues.filter(i=>i.status!=='resolved');
/* Ticket numbers: FT0001, FT0002 … handed out by the server, so they never repeat (after FT9999 comes FT10000). */
async function newTicket(){
  if(window.ftNextTicket)return await window.ftNextTicket();
  let n=0;for(const o of state.orders){const m=/^FT(\d+)$/.exec(o.ticket||'');if(m)n=Math.max(n,+m[1])}
  return 'FT'+String(n+1).padStart(4,'0');
}
/* random key in the order's QR link (long, so nobody can guess other customers' orders) */
function pubToken(){const a='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';const b=new Uint8Array(16);crypto.getRandomValues(b);return [...b].map(x=>a[x%a.length]).join('')}
const siteUrl=()=>window.FT_STANDALONE?location.origin:'';
const trackLink=o=>o&&o.pub&&siteUrl()?`${siteUrl()}/o/${o.pub}`:'';
const qrImg=o=>o&&o.pub&&siteUrl()?`${siteUrl()}/qr/${o.pub}.png`:'';
async function ensurePub(o){if(!o||o.pub||!window.FT_STANDALONE)return o;const n={...o,pub:pubToken()};try{await put('orders',n);return n}catch(e){return o}}
const findByPub=p=>state.orders.find(o=>o.pub===p);
function custStats(){
  const m={};for(const o of state.orders){if(!o.customerId||o.status==='cancelled')continue;const c=calc(o);const s=m[o.customerId]||(m[o.customerId]={orders:0,paid:0,spent:0,bal:0,last:0});s.orders++;s.paid+=c.paid;s.spent+=c.total;if(!o.accountId)s.bal+=Math.max(0,c.bal);s.last=Math.max(s.last,o.createdAt||0)}
  return m;
}
function custPoints(cid){
  const L=S().loyalty;if(!L.enabled||!cid)return 0;let paid=0,used=0;
  for(const o of state.orders){if(o.customerId!==cid||o.status==='cancelled')continue;used+=+o.pointsUsed||0;if(!o.accountId)paid+=calc(o).paid}
  return Math.max(0,Math.floor(paid/Math.max(1,+L.spendPerPoint||1000))-used);
}
function debtors(){const m={};for(const o of state.orders){if(!owes(o))continue;const c=calc(o);const k=o.customerId||normPhone(o.phone);const d=m[k]||(m[k]={customerId:o.customerId,name:o.customerName,phone:o.phone,owed:0,tickets:[],oldest:o.createdAt||Date.now()});d.owed+=c.bal;d.tickets.push(o.ticket);d.oldest=Math.min(d.oldest,o.createdAt||Date.now())}return Object.values(m).sort((a,b)=>b.owed-a.owed)}
const promoUses=code=>state.orders.filter(o=>o.promoCode===code&&o.status!=='cancelled').length;
function checkPromo(code,amount){
  code=String(code||'').trim().toUpperCase();if(!code)return {ok:false,msg:''};
  const p=state.promos.find(x=>String(x.code).toUpperCase()===code);const T=todayStr();
  if(!p)return {ok:false,msg:'Promo code not found'};
  if(p.active===false)return {ok:false,msg:'This code is switched off'};
  if(p.starts&&p.starts>T)return {ok:false,msg:'This code starts on '+fmtD(p.starts)};
  if(p.expires&&p.expires<T)return {ok:false,msg:'This code expired on '+fmtD(p.expires)};
  if(+p.maxUses&&promoUses(p.code)>=+p.maxUses)return {ok:false,msg:'This code has been fully used'};
  if(+p.minSpend&&amount<+p.minSpend)return {ok:false,msg:'Needs a minimum order of '+money(p.minSpend)};
  const disc=p.type==='amt'?Math.min(+p.value||0,amount):Math.round(amount*(+p.value||0)/100);
  return {ok:true,p,disc};
}
function allPayments(){
  const out=[];
  for(const o of state.orders)for(const p of o.payments||[])out.push({amount:+p.amount||0,method:p.method||'Other',at:p.at,kind:'order',id:o.id,ref:o.ticket,name:o.customerName});
  for(const j of state.homejobs)for(const p of j.payments||[])out.push({amount:+p.amount||0,method:p.method||'Other',at:p.at,kind:'home',id:j.id,ref:'Home',name:j.name});
  for(const v of state.invoices){if(v.status==='void')continue;for(const p of v.payments||[])out.push({amount:+p.amount||0,method:p.method||'Other',at:p.at,kind:'invoice',id:v.id,ref:v.number,name:v.accountName})}
  return out;
}
function invCalc(v){const paid=sum(v.payments||[],p=>p.amount);return {sub:+v.subtotal||0,vat:+v.vat||0,total:+v.total||0,paid,bal:(+v.total||0)-paid}}
function invStatus(v){if(v.status==='void')return 'void';const c=invCalc(v);if(c.bal<=0)return 'paid';if(v.dueDate&&v.dueDate<todayStr())return 'overdue';return v.status==='sent'?'sent':'draft'}
const unbilled=aid=>state.orders.filter(o=>o.accountId===aid&&!o.invoiceId&&o.status!=='cancelled');
function nextInvNo(){const p=(S().invoicePrefix||'INV').trim()||'INV',y=new Date().getFullYear(),pre=`${p}-${y}-`;let n=0;for(const v of state.invoices)if(String(v.number||'').startsWith(pre))n=Math.max(n,parseInt(String(v.number).slice(pre.length))||0);return pre+String(n+1).padStart(4,'0')}
function waLink(phone,text){
  let d=String(phone||'').replace(/\D/g,'');const cc=String(S().countryCode||'').replace(/\D/g,'');
  if(d.startsWith('0'))d=cc+d.slice(1);else if(cc&&d.length<=9)d=cc+d;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}
function lr(l,r,w=34){l=String(l);r=String(r);const sp=w-l.length-r.length;return sp>=1?l+' '.repeat(sp)+r:l+'\n'+' '.repeat(Math.max(0,w-r.length))+r}
function center(s,w=34){s=String(s);return ' '.repeat(Math.max(0,Math.floor((w-s.length)/2)))+s}
function wrap(t,w){const words=String(t).split(/\s+/);const lines=[];let cur='';for(const x of words){if((cur+' '+x).trim().length>w){if(cur)lines.push(cur);cur=x}else cur=(cur+' '+x).trim()}if(cur)lines.push(cur);return lines}
function receiptText(o){
  const s=S(),c=calc(o),L='-'.repeat(34);const out=[];
  out.push(center(s.shopName.toUpperCase()));if(s.address)out.push(...wrap(s.address,34).map(x=>center(x)));if(s.phone)out.push(center('Tel: '+s.phone));
  out.push(L,lr('Ticket:',o.ticket),lr('Received:',fmtDT(o.createdAt)),lr('Ready by:',fmtD(o.dueDate)+(o.express?' EXPRESS':'')),lr('Customer:',o.customerName||''),lr('Phone:',o.phone||''));
  if(o.accountName)out.push(lr('Account:',o.accountName));
  out.push(L);
  for(const i of o.items||[]){out.push(i.service==='fee'?i.garment:`${i.qty} x ${i.garment} - ${svc(i.service)}`);if(i.note)out.push('   ('+i.note+')');out.push(lr('',num(i.qty*i.price)))}
  out.push(L,lr('Subtotal',num(c.sub)));if(c.exp)out.push(lr(`Express +${o.expressPct}%`,num(c.exp)));
  if(+o.acctDisc)out.push(lr('Account discount','-'+num(o.acctDisc)));if(+o.discount)out.push(lr('Discount','-'+num(o.discount)));
  if(+o.promoDisc)out.push(lr('Promo '+o.promoCode,'-'+num(o.promoDisc)));if(+o.loyaltyDisc)out.push(lr(`Points (${o.pointsUsed})`,'-'+num(o.loyaltyDisc)));
  out.push(lr('TOTAL ('+s.currency+')',num(c.total)));
  if(o.accountId)out.push('Billed to account on invoice');else out.push(lr('Paid',num(c.paid)),lr('BALANCE',num(Math.max(0,c.bal))));
  out.push(L,`Pieces: ${c.pieces}`);if(o.staffName)out.push('Served by: '+o.staffName);
  if(o.notes)out.push(...wrap('Notes: '+o.notes,34));
  if(s.receiptFooter)out.push('',...wrap(s.receiptFooter,34));
  if(trackLink(o))out.push('','Track your order:',trackLink(o));
  return out.join('\n');
}

/* ================= navigation ================= */
const PAGE_LABEL={reportlog:'Report log',spotchecks:'Spot checks',whatsapp:'WhatsApp & alerts',messages:'Messages',inout:'IN / OUT tracking',notifications:'Notifications',dispatch:'Dispatch',overdue:'Overdue dispensing',home:'Home services',packager:'Packager',tracking:'Tracking',lipa:'Lipa payments',refunds:'Refunds',ridercash:'Rider cash',closeday:'Close day',safe:'Branch safe',profile:'My profile',branches:'Branches',
'my-day':'Reception',dashboard:'Dashboard',reports:'Reports','new-order':'New order',orders:'Orders',production:'Production board',delivery:'Pickup & delivery',issues:'Issues & claims',customers:'Customers',loyalty:'Loyalty programme',promotions:'Promotions',campaigns:'Campaigns',prices:'Services & prices',inventory:'Inventory',suppliers:'Suppliers',accounts:'Corporate accounts',invoices:'Invoices',payments:'Payments & cash-up',debtors:'Debtors',expenses:'Expenses',pnl:'Profit & loss',staff:'Staff & attendance',payroll:'Payroll',access:'Access & portals',settings:'Shop settings'};
const PAGE_ICON={reportlog:'reportlog',spotchecks:'spot',whatsapp:'wa',messages:'messages',inout:'inout',notifications:'bell',dispatch:'dispatch',overdue:'overdue',home:'home',packager:'packager',tracking:'tracking',lipa:'lipa',refunds:'refunds',ridercash:'ridercash',closeday:'closeday',safe:'safe',profile:'profile',branches:'branches','my-day':'myday',dashboard:'dashboard',reports:'reports','new-order':'plus',orders:'orders',production:'production',delivery:'delivery',issues:'issues',customers:'customers',loyalty:'loyalty',promotions:'promotions',campaigns:'campaigns',prices:'prices',inventory:'inventory',suppliers:'suppliers',accounts:'corporate',invoices:'invoice',payments:'payments',debtors:'debtors',expenses:'expenses',pnl:'pnl',staff:'staff',payroll:'payroll',access:'access',settings:'settings'};
const ADMIN_GROUPS=[
 {k:'overview',label:'Overview',icon:'g_home',items:['dashboard','my-day','messages','inout','notifications','reports','reportlog','spotchecks']},
 {k:'orders',label:'Orders & fulfilment',icon:'g_hanger',items:['new-order','orders','production','dispatch','overdue','delivery','home','packager','tracking','issues']},
 {k:'customers',label:'Customers & marketing',icon:'g_heart',items:['customers','loyalty','promotions','campaigns']},
 {k:'catalog',label:'Catalog & inventory',icon:'g_book',items:['prices','inventory','suppliers']},
 {k:'corporate',label:'Corporate invoicing',icon:'g_case',items:['accounts','invoices']},
 {k:'finance',label:'Finance',icon:'g_bank',items:['payments','lipa','refunds','ridercash','closeday','safe','debtors','expenses','pnl']},
 {k:'admin',label:'Staff & admin',icon:'g_shield',items:['staff','payroll','branches','whatsapp','access','settings','profile']}
];
const STAFF_GROUPS=[
 {k:'overview',label:'Overview',icon:'g_home',items:['my-day','messages','inout','notifications','reports']},
 {k:'orders',label:'Orders & fulfilment',icon:'g_hanger',items:['new-order','orders','production','dispatch','overdue','delivery','home','packager','tracking','issues']},
 {k:'customers',label:'Customers & finance',icon:'g_people',items:['customers','lipa','refunds','ridercash','closeday','safe']},
 {k:'catalog',label:'Catalog & inventory',icon:'g_book',items:['inventory','prices']},
 {k:'settings',label:'Settings & profile',icon:'g_gear',items:['profile']}
];
const groups=()=>inAdmin()?ADMIN_GROUPS:STAFF_GROUPS;
const pagesNow=()=>groups().flatMap(g=>g.items);
const groupOf=r=>groups().find(g=>g.items.includes(r));
const home=()=>inAdmin()?'dashboard':'my-day';
function route(){const h=location.hash.slice(1);return pagesNow().includes(h)&&VIEWS[h]?h:home()}
let collapsed=new Set();try{collapsed=new Set(JSON.parse(localStorage.getItem('dc-collapsed')||'[]'))}catch(e){}
function saveCollapsed(){try{localStorage.setItem('dc-collapsed',JSON.stringify([...collapsed]))}catch(e){}}
function navCount(k){
  const T=todayStr();let n=0,red=false;
  if(k==='orders'){n=state.orders.filter(isOverdue).length;red=true}
  else if(k==='production')n=state.orders.filter(isActive).length;
  else if(k==='delivery')n=state.deliveries.filter(d=>dvOpen(d)&&d.date<=T).length;
  else if(k==='issues'){n=openIssues().length;red=true}
  else if(k==='inventory'){n=lowStock().length;red=true}
  else if(k==='debtors')n=debtors().length;
  else if(k==='invoices'){n=state.invoices.filter(v=>invStatus(v)==='overdue').length;red=true}
  else if(k==='accounts')n=state.accounts.filter(a=>unbilled(a.id).length).length;
  else if(k==='messages'&&typeof unreadMsgs==='function'){n=unreadMsgs();red=true}
  else if(k==='overdue'){n=state.orders.filter(o=>inShop(o)&&(typeof inBranch!=='function'||inBranch(o))&&o.dueDate&&o.dueDate<T).length;red=true}
  else if(k==='dispatch')n=state.deliveries.filter(d=>d.type==='delivery'&&dvOpen(d)&&d.status!=='out'&&d.date<=T).length;
  else if(k==='refunds'){n=state.refunds.filter(r=>r.status==='requested').length;red=inAdmin()}
  else if(k==='ridercash'&&typeof riderPending==='function')n=Object.keys(riderPending()).length;
  else if(k==='notifications'&&typeof notifs==='function')n=notifs().length;
  else if(k==='reportlog'&&typeof newReports==='function'&&inAdmin())n=newReports();
  else if(k==='spotchecks'&&typeof newFailedSpots==='function'){n=newFailedSpots().length;red=true}
  else if(k==='packager')n=state.orders.filter(o=>inShop(o)&&!o.packed&&o.dueDate&&o.dueDate<=T).length;
  return {n,red};
}
const cntHtml=({n,red})=>n?`<span class="cnt ${red?'red':''}">${n}</span>`:'';
function brandName(){const n=S().shopName;return /^fast technology/i.test(n)?`<b>Fast Technology</b><br>${esc(n.replace(/^fast technology\s*/i,''))}`:esc(n)}
function renderChrome(){
  PAGE_LABEL.production=stagesOn()?'Production board':'Work list';
  const r=route(),g=groupOf(r),ms=meStaff();
  const grpHtml=groups().map(G=>{
    const open=!collapsed.has(G.k);let gn=0,gr=false;G.items.forEach(k=>{const c=navCount(k);gn+=c.n;gr=gr||(c.red&&c.n>0)});
    return `<div class="grp ${open?'open':''} ${G===g?'cur':''}"><button class="grph" data-act="toggleGrp" data-g="${G.k}" aria-expanded="${open}">${ic(G.icon)}<span class="lbl">${G.label}</span>${!open&&gn?`<span class="gc">${cntHtml({n:gn,red:gr})}</span>`:''}${CHEV}</button>
      <div class="grpb">${G.items.map(k=>`<a href="#${k}" class="${k===r?'on':''} ${k==='new-order'?'cta':''}">${ic(PAGE_ICON[k])}<span class="pl">${PAGE_LABEL[k]}</span>${cntHtml(navCount(k))}</a>`).join('')}</div></div>`}).join('');
  $('#nav').innerHTML=`<div class="brand"><div class="logo">FT</div><div class="bn">${brandName()}<small>${inAdmin()?'Admin portal':'Worker portal'}</small></div></div>
    <div class="navtools"><a href="#" data-act="collapseAll">Collapse all</a><a href="#" data-act="expandAll">Expand all</a></div>
    ${grpHtml}
    <div class="spacer"></div>${opCard()}<div class="sync">${mode==='cloud'?'● Synced across devices':mode==='local'?'● Saved on this device':'Connecting…'}</div>`;
  const mb=inAdmin()?[['dashboard','Home','dashboard'],['orders','Orders','orders'],['new-order','New','plus'],['production',stagesOn()?'Board':'Work list','production']]:[['my-day','My day','myday'],['orders','Orders','orders'],['new-order','New','plus'],['production',stagesOn()?'Board':'Work list','production']];
  $('#mbar').innerHTML=mb.map(([k,l,i])=>`<a href="#${k}" class="${k===r?'on':''} ${k==='new-order'?'cta':''}">${ic(i)}<span>${l}</span></a>`).join('')+`<a href="#" data-act="openDrawer">${ic('menu')}<span>Menu</span></a>`;
  $('#crumb').textContent=g?g.label:'';
  $('#title').innerHTML=`<span class="ticon">${ic(PAGE_ICON[r])}</span>${esc(PAGE_LABEL[r]||'')}`;
  $('#subnav').innerHTML=g&&g.items.length>1?g.items.map(k=>`<a href="#${k}" class="tab ${k===r?'on':''}">${ic(PAGE_ICON[k])}${PAGE_LABEL[k]}</a>`).join(''):'';
  $('#portalBadge').innerHTML=(inAdmin()?`<button class="pswitch" data-act="viewWorker">${ic('staff')}<span>Worker portal</span></button>`:previewing?`<button class="pswitch back" data-act="backAdmin">←<span>Back to admin</span></button>`:'')+(inAdmin()?'<span class="badge admin">Admin</span>':`<span class="badge staff">${ms?esc(ms.name):'Worker'}</span>`)+`<button class="avbtn" data-act="avMenu" title="Profile & shortcuts">${avatarHtml(myKey(),inAdmin()?'Admin':myName())}</button>`;
  $('#sync').innerHTML=mode==='cloud'?'<span class="dot ok"></span>Synced':mode==='local'?'<span class="dot local"></span>This device only':'<span class="dot"></span>Connecting…';
  let b='';
  if(previewing){const ms=meStaff();b+=`<div class="previewbar"><span>👁 You are viewing the <b>worker portal</b> as <select data-f="pv-who">${activeStaff().map(x=>`<option value="${esc(x.id)}" ${x.id===me?'selected':''}>${esc(x.name)}</option>`).join('')}</select> — this is exactly what they see.</span></div>`}
  if(!inAdmin()&&typeof spotBanner==='function')b+=spotBanner();
  if(loadNote)b+=`<div class="banner">${esc(loadNote)}</div>`;
  if(!canWrite)b+=`<div class="banner">You have view-only access. Ask the owner to share this page with you as a Contributor to record orders.</div>`;
  if(mode==='local')b+=`<div class="banner info">Data is being saved in this browser only. Open the app from its Claude link while signed in to sync between devices.</div>`;
  $('#banners').innerHTML=b;

}
let lastRoute=null;
function render(){
  if(typeof hideAvMenu==='function')hideAvMenu();
  const r=route();
  if(r!==lastRoute){RESET.forEach(f=>f(r));lastRoute=r;const g=groupOf(r);if(g&&collapsed.has(g.k)){collapsed.delete(g.k);saveCollapsed()}document.body.classList.remove('drawer')}
  const v=$('#view');
  if(!state.ready){renderChrome();v.innerHTML='<div class="empty">Loading shop data…</div>';return}
  if(portal==='auto'||(isLocked()&&viewerAdmin&&!myLink())){portal=viewerAdmin&&!myLink()?'admin':'locked'}
  if(portal==='admin'&&!viewerAdmin)portal='locked';
  if(portal==='staff'&&!meStaff())portal='locked';
  document.body.classList.toggle('locked',isLocked());
  if(isLocked()){v.innerHTML=lockHtml();return}
  if(r!==route()){render();return}
  renderChrome();
  v.innerHTML=VIEWS[r]();
  if(AFTER[r])AFTER[r]();
}
function onData(){
  if(typeof spotAlerts==='function')spotAlerts();
  if(typeof maybeAutoSpot==='function')maybeAutoSpot();
  if(typeof kickPayAlerts==='function')kickPayAlerts();
  if(state.ready&&isLocked()&&$('.lock')){const st=$('.lsetup');if(st&&S().adminPinHash)st.remove();return}
  const r=route();
  if(FORM_ROUTES.has(r)&&state.ready&&$('#formRoot')){renderChrome();if(REFRESH[r])REFRESH[r]()}
  else render();
  if(modal&&LIVE_MODALS.has(modal.kind)){const a=document.activeElement;if(!(a&&$('#modal').contains(a)&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)))renderModal()}
}
/* ---------- live clock ---------- */
const lcTime=()=>new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
const lcDate=()=>new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
function tickClocks(){const t=lcTime(),d=lcDate();$$('.lc-time').forEach(e=>{if(e.textContent!==t)e.textContent=t});$$('.lc-date').forEach(e=>{if(e.textContent!==d)e.textContent=d})}
function clockBox(){return `<div class="hero-clock"><div class="lc-date">${lcDate()}</div><div class="lc-time">${lcTime()}</div><div class="lc-live"><i></i>Live</div></div>`}
function heroHtml(sub,extra){
  const T=todayStr();const dueT=state.orders.filter(o=>o.status!=='cancelled'&&o.dueDate===T);const got=dueT.filter(o=>o.status==='collected').length;
  const rate=dueT.length?Math.round(got/dueT.length*100):0;const b=curBranch();const nm=inAdmin()?'Administrator':myName();
  return `<div class="hero"><div class="hero-l"><div class="hero-top"><button class="hero-av" data-act="avMenu" title="Profile & shortcuts">${avatarHtml(myKey(),nm)}<span class="cam">${ic('camera')}</span></button>
   <div><h2>${hubName()}</h2><div class="hero-loc">${ic('branches')}<b>${esc(b.name)}</b><span class="btype ${b.type==='HQ'?'hq':''}">${b.type==='HQ'?'HQ':'BRANCH'}</span>${b.city?`<span class="hdot">•</span>${esc(String(b.city).toUpperCase())}`:''}</div></div></div>
   <p>${sub}</p>
   <div class="hero-chips"><span class="hchip">${ic('profile')}${esc(roleLabel())}${inAdmin()?'':' · '+esc(nm)}</span><span class="hchip"><i class="${mode==='cloud'?'on':mode==='local'?'warn':''}"></i>${mode==='cloud'?'System online':mode==='local'?'This device only':'Connecting'}</span><span class="hchip">${ic('reports')}${rate}% completion rate</span></div>${extra||''}</div>${clockBox()}</div>`;
}
/* ---------- PIN lock (operator sign-in) ---------- */
let lockPin='',lockFails=0,lockUntil=0,lockBusy=false,lastAct=Date.now(),previewing=false;
const IDLE_MIN=10;
function isLocked(){return portal!=='admin'&&portal!=='staff'}
function idKey(){if(viewerId)return viewerId;let k=null;try{k=localStorage.getItem('dc-device')}catch(e){}if(!k){k='dev_'+uid();try{localStorage.setItem('dc-device',k)}catch(e){}}return k}
const myLink=()=>state.links.find(l=>l.id===idKey());
function lockCtx(){
  const link=myLink();const s=S();
  if(link){const st=findStaff(link.staffId);return {mode:'staff',st:st&&st.active!==false?st:null,gone:!st||st.active===false}}
  if(viewerAdmin&&mode==='cloud')return {mode:'admin'};
  return {mode:'first'};
}
function lockCands(c){
  const s=S(),out=[];
  if(c.mode==='staff'){if(c.st&&c.st.pinHash)out.push({kind:'staff',st:c.st,h:c.st.pinHash,len:+c.st.pinLen||0});if(viewerAdmin&&s.adminPinHash&&mode!=='cloud')out.push({kind:'admin',h:s.adminPinHash,len:+s.adminPinLen||0})}
  else if(c.mode==='admin'){if(s.adminPinHash)out.push({kind:'admin',h:s.adminPinHash,len:+s.adminPinLen||0})}
  else{state.staff.forEach(x=>{if(x.active!==false&&x.pinHash)out.push({kind:'staff',st:x,h:x.pinHash,len:+x.pinLen||0,link:true})});if(viewerAdmin&&s.adminPinHash)out.push({kind:'admin',h:s.adminPinHash,len:+s.adminPinLen||0})}
  return out;
}
function opCard(){
  const ms=meStaff();const nm=inAdmin()?'Administrator':ms?ms.name:'';const sub=inAdmin()?'Admin portal':ms?(ms.role||'Staff'):'';
  return `<div class="opcard"><div class="opwho"><span class="av">${avatarHtml(inAdmin()?'admin':me,inAdmin()?'Admin':nm)}</span><div><b>${esc(nm)}</b><small>${esc(sub)}${previewing?' · preview':''}</small></div></div></div>`;
}
function lockLen(){const c=lockCtx();const cs=lockCands(c);if(cs.length===1&&cs[0].len)return cs[0].len;const ls=[...new Set(cs.map(x=>x.len))];return ls.length===1&&ls[0]?ls[0]:0}
function lockHtml(){
  const c=lockCtx(),L=lockLen();const n=L||Math.max(4,lockPin.length);const cs=lockCands(c);
  let who,sub;
  if(c.mode==='staff'){who=c.st?`<div class="lockav">${avatarHtml(c.st.id,c.st.name)}</div><h1>${esc(c.st.name)}</h1>`:`<div class="logo big">FT</div><h1>${brandName()}</h1>`;sub=c.gone?'Your staff profile is no longer active. Ask your manager.':'Enter your PIN'}
  else if(c.mode==='admin'){who=`<div class="lockav">${avatarHtml('admin','Admin')}</div><h1>Administrator</h1>`;sub=S().adminPinHash?'Enter the admin PIN':'No admin PIN set yet'}
  else{who=`<div class="logo big">FT</div><h1>${brandName()}</h1>`;sub=cs.length?'Welcome! Enter the PIN your manager gave you.<br><span style="font-size:12.5px">You only do this once on this account.</span>':'No staff PINs have been set up yet. Ask your manager.'}
  const showGo=!L&&cs.length>0;
  return `<div class="lock"><div class="lockbox">
   <div class="lockclock"><div class="lc-time">${lcTime()}</div><div class="lc-date">${lcDate()}</div></div>
   ${who}<p class="lsub">${sub}</p>
   ${cs.length?`<div class="dots">${Array.from({length:n},(_,i)=>`<i class="${i<lockPin.length?'f':''}"></i>`).join('')}</div>
   <div id="lockErr"></div>
   <div class="pad">${[1,2,3,4,5,6,7,8,9].map(k=>`<button data-act="pk" data-k="${k}">${k}</button>`).join('')}<span></span><button data-act="pk" data-k="0">0</button><button class="padx" data-act="pk" data-k="del" aria-label="Delete">⌫</button></div>
   ${showGo?'<button class="btn lockgo" data-act="lockGo">Enter</button>':''}`:''}
  </div></div>`;
}
function lockDots(){const d=$('.dots');if(!d)return;const n=lockLen()||Math.max(4,lockPin.length);d.innerHTML=Array.from({length:n},(_,i)=>`<i class="${i<lockPin.length?'f':''}"></i>`).join('')}
async function lockCheck(force){
  if(lockBusy)return;const err=$('#lockErr');
  if(Date.now()<lockUntil){if(err)err.textContent=`Too many tries — wait ${Math.ceil((lockUntil-Date.now())/1000)}s`;lockPin='';lockDots();return}
  const typed=lockPin;if(typed.length<4){if(force&&err)err.textContent='PIN has at least 4 digits';return}
  const c=lockCtx(),cs=lockCands(c);if(!cs.length)return;
  lockBusy=true;const h=await sha(typed);lockBusy=false;
  if(lockPin!==typed)return lockCheck(force);
  const hit=cs.find(x=>x.h===h);
  if(hit){lockFails=0;lockPin='';lastAct=Date.now();
    if(hit.kind==='admin'){if(!viewerAdmin){wrongPin('Your account cannot open admin');return}portal='admin';me=null;location.hash='#dashboard';render();toast('Welcome back');return}
    portal='staff';me=hit.st.id;
    if(hit.link){try{await put('links',{id:idKey(),staffId:hit.st.id,linkedAt:Date.now()})}catch(e){}}
    location.hash='#my-day';render();toast('Welcome, '+hit.st.name.split(' ')[0]);return}
  const known=cs.every(x=>x.len);const maxL=known?Math.max(...cs.map(x=>x.len)):8;
  if(force||typed.length>=maxL)wrongPin(c.mode==='first'?'That PIN doesn’t match any staff member':'Wrong PIN');
}
function wrongPin(msg){
  lockPin='';lockFails++;if(lockFails>=5){lockUntil=Date.now()+30000;lockFails=0}
  const err=$('#lockErr');if(err)err.textContent=Date.now()<lockUntil?'Too many tries — wait 30 seconds':msg;
  lockDots();const p=$('.dots');if(p){p.classList.remove('shake');void p.offsetWidth;p.classList.add('shake')}
  if(navigator.vibrate)try{navigator.vibrate(120)}catch(e){}
}
async function lockTry(){return lockCheck(true)}
function backToAdmin(){previewing=false;portal='admin';me=null;closeModal();document.body.classList.remove('drawer');location.hash='#dashboard';render();toast('Back in admin')}
function lockNow(){if(previewing||(viewerAdmin&&!myLink())){backToAdmin();return}portal='locked';me=null;lockPin='';closeModal();document.body.classList.remove('drawer');location.hash='';render()}
setInterval(()=>{if(portal==='staff'&&!previewing&&state.ready&&Date.now()-lastAct>IDLE_MIN*60000){lockNow()}},30000);
['pointerdown','keydown','touchstart','wheel'].forEach(ev=>document.addEventListener(ev,()=>{lastAct=Date.now()},{passive:true}));

/* ================= modal ================= */
let modal=null;
function openModal(kind,id,pre){modal={kind,id:id||null,pre:pre||{}};renderModal();$('#modal').classList.remove('hidden');setTimeout(()=>{const f=$('#modalBody [autofocus]');if(f)f.focus()},30)}
function closeModal(){modal=null;$('#modal').classList.add('hidden');$('#modalBody').innerHTML=''}
function renderModal(){if(!modal)return;const fn=MODALS[modal.kind];const h=fn?fn(modal.id):null;if(h===null){closeModal();return}$('#modalBody').innerHTML=h;$('#modalBody').className='sheet'+(modal.kind==='invoice'||modal.kind==='newInvoice'?' wide':'')}
const closeX='<button class="xbtn" data-act="closeModal" style="font-size:26px" aria-label="Close">×</button>';
MODALS.copy=()=>`<div class="hd"><h2>Copy text</h2>${closeX}</div><p class="small muted">Select all the text below and copy it.</p><textarea style="width:100%;height:280px;font-family:'DM Mono',monospace;font-size:12px">${esc(window._copy||'')}</textarea>`;

/* ================= shared fragments ================= */
function orderRow(o){
  const c=calc(o);
  return `<div class="li" data-act="openOrder" data-id="${esc(o.id)}">
   <div class="mono">${esc(o.ticket)}</div>
   <div><div class="nm">${esc(o.customerName)}${o.accountId?'<span class="tag corp">CORPORATE</span>':''}${o.express?'<span class="tag exp">EXPRESS</span>':''}${isOverdue(o)?'<span class="tag late">OVERDUE</span>':''}</div><div class="ph">${esc(o.phone)}</div></div>
   <div class="hide-m">${c.pieces} pc</div>
   <div class="hide-m">${fmtD(o.dueDate)}</div>
   <div class="r hide-m"><div>${money(c.total)}</div>${o.status==='cancelled'?'':o.accountId?`<div class="ph">${o.invoiceId?'Invoiced':'On account'}</div>`:c.bal>0?`<div class="bal">Owes ${num(c.bal)}</div>`:`<div class="paid">Paid</div>`}</div>
   <div class="r">${pill(o.status)}</div></div>`;
}
const orderHead=`<div class="li head"><div>Ticket</div><div>Customer</div><div class="hide-m">Items</div><div class="hide-m">Due</div><div class="r hide-m">Amount</div><div class="r">Status</div></div>`;
function arm(btn,label='Tap again to confirm'){if(btn.dataset.armed)return true;btn.dataset.armed='1';btn._orig=btn.innerHTML;btn.textContent=label;btn.classList.add('armed');setTimeout(()=>{if(btn.isConnected){delete btn.dataset.armed;btn.innerHTML=btn._orig;btn.classList.remove('armed')}},3500);return false}
async function setStatus(o,s,extra){const n={...o,...extra,status:s,statusAt:{...(o.statusAt||{}),[s]:Date.now()}};await put('orders',n);toast(s==='received'&&!stagesOn()?'Back in shop':`Marked ${stLabel(s).toLowerCase()}`)}
const adminOnly=()=>`<div class="empty">This page is only available in the admin portal.</div>`;

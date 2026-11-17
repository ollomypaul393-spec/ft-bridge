'use strict';
/* ================= wiring ================= */
let pendingModal=null;
Object.assign(ACT,{
  noop:()=>{},
  closeModal:()=>closeModal(),
  toggleGrp:a=>{const g=a.dataset.g;if(collapsed.has(g))collapsed.delete(g);else collapsed.add(g);saveCollapsed();renderChrome()},
  collapseAll:(a,e)=>{e.preventDefault();groups().forEach(g=>collapsed.add(g.k));saveCollapsed();renderChrome()},
  expandAll:(a,e)=>{e.preventDefault();collapsed.clear();saveCollapsed();renderChrome()},
  openDrawer:(a,e)=>{e.preventDefault();document.body.classList.add('drawer')},
  closeDrawer:()=>document.body.classList.remove('drawer')
});
window.addEventListener('hashchange',()=>{closeModal();render();window.scrollTo(0,0);if(pendingModal){const [k,id]=pendingModal;pendingModal=null;openModal(k,id)}});
document.addEventListener('input',e=>{const f=e.target.dataset&&e.target.dataset.f;if(f&&IN[f]&&!ONCHANGE.has(f))IN[f](e.target)});
document.addEventListener('change',e=>{if(e.target.id==='photoIn'){const f=e.target.files&&e.target.files[0];e.target.value='';savePhoto(f);return}});
document.addEventListener('change',e=>{const f=e.target.dataset&&e.target.dataset.f;if(f&&IN[f]&&ONCHANGE.has(f))IN[f](e.target)});
document.addEventListener('click',e=>{
  const pop=$('#avPop');if(pop&&!pop.classList.contains('hidden')&&!e.target.closest('#avPop')&&!e.target.closest('[data-act=avMenu]'))hideAvMenu();
  if(e.target.closest('#avPop a[href]'))setTimeout(hideAvMenu,0);
  if(e.target.id==='modal'){closeModal();return}
  const a=e.target.closest('[data-act]');if(!a)return;
  const fn=ACT[a.dataset.act];if(!fn)return;
  if(a.tagName==='BUTTON')e.preventDefault();
  if(a.closest('#nav')&&a.tagName==='A'&&a.getAttribute('href')&&a.getAttribute('href')!=='#')document.body.classList.remove('drawer');
  Promise.resolve(fn(a,e)).catch(err=>console.error(err));
});
document.addEventListener('click',e=>{const a=e.target.closest('#nav a[href^="#"]');if(a&&a.getAttribute('href')!=='#')document.body.classList.remove('drawer')});
document.addEventListener('keydown',e=>{
  if(isLocked()&&$('.lock')&&!modal){if(/^\d$/.test(e.key)){ACT.pk({dataset:{k:e.key}});e.preventDefault();return}if(e.key==='Backspace'){ACT.pk({dataset:{k:'del'}});e.preventDefault();return}if(e.key==='Enter'){lockTry();e.preventDefault();return}}
  if(e.key==='Enter'&&!e.shiftKey&&e.target.id==='msgIn'){e.preventDefault();ACT.sendMsg($('[data-act=sendMsg]'));return}
  if(e.key==='Escape'){if(modal)closeModal();hideAvMenu();document.body.classList.remove('drawer')}
  if(e.key==='Enter'&&modal&&modal.kind==='pin'&&e.target.id==='pinIn'){e.preventDefault();ACT.pinOk($('[data-act=pinOk]'))}
});
setInterval(tickClocks,1000);
loadSession();
render();
connect();

/* Tasneef v10098 - Monthly Times Single Render Fix
   Scope: ONLY monthly times page. Does not touch tickets, services, finance, inventory, users, permissions.
*/
(function(){
  'use strict';
  if(window.__tasneefMonthlySingleRenderV10098) return;
  window.__tasneefMonthlySingleRenderV10098 = true;

  function isMonthlyText(el){
    var t=(el && (el.innerText||el.textContent)||'').replace(/\s+/g,' ').trim();
    return /الأوقات الشهرية|الاوقات الشهرية|تقرير الأوقات الشهرية|تقرير الاوقات الشهرية/i.test(t);
  }

  function mainMonthlySection(){ return document.getElementById('monthly'); }

  function normalizeMonthlyPage(){
    var main = mainMonthlySection();
    if(!main) return;

    // Keep exactly one official monthly section.
    document.querySelectorAll('section[id="monthly"], .page#monthly').forEach(function(sec,idx){
      if(sec!==main) sec.remove();
    });

    // Inside the official monthly section, keep the card that owns the official controls/table.
    var officialCard = (document.getElementById('monthlyBody')||{}).closest ? document.getElementById('monthlyBody').closest('.card') : null;
    if(!officialCard) officialCard = main.querySelector('.card');

    Array.from(main.children).forEach(function(child){
      if(child!==officialCard && isMonthlyText(child)) child.remove();
    });

    // If old monthly modules injected extra monthly cards inside the section, remove them.
    Array.from(main.querySelectorAll('.card')).forEach(function(card){
      if(card!==officialCard && isMonthlyText(card)) card.remove();
    });

    // Remove duplicate monthly summary/table containers if any script appended them.
    ['monthlySummary','monthlyBody','monthlyMonth','monthlySupervisor'].forEach(function(id){
      var nodes = Array.from(document.querySelectorAll('#'+id));
      nodes.forEach(function(n,i){ if(i>0 && n.closest('#monthly')) n.remove(); });
    });

    // Remove monthly duplicate blocks outside the monthly page only if they are clearly injected duplicates.
    Array.from(document.body.querySelectorAll('.card, section, div')).forEach(function(el){
      if(el===main || main.contains(el)) return;
      if(el.id==='monthly') return;
      var hasMonthlyId = el.querySelector && (el.querySelector('#monthlyBody') || el.querySelector('#monthlySummary') || el.querySelector('#monthlyMonth'));
      if(hasMonthlyId || (el.classList && el.classList.contains('monthly-duplicate-v10098'))){
        if(isMonthlyText(el)) el.remove();
      }
    });
  }

  function clearMonthlyBeforeRender(){
    var body = document.getElementById('monthlyBody');
    var summary = document.getElementById('monthlySummary');
    if(body) body.innerHTML='';
    if(summary) summary.innerHTML='';
  }

  function wrapRenderMonthly(){
    var original = window.renderMonthly;
    if(typeof original !== 'function' || original.__v10098Wrapped) return;
    var running = false;
    function fixedRenderMonthly(){
      if(running) return;
      running = true;
      try{
        normalizeMonthlyPage();
        clearMonthlyBeforeRender();
        return original.apply(this, arguments);
      } finally {
        setTimeout(function(){ normalizeMonthlyPage(); running=false; }, 40);
      }
    }
    fixedRenderMonthly.__v10098Wrapped = true;
    fixedRenderMonthly.__original = original;
    window.renderMonthly = fixedRenderMonthly;
  }

  function wrapShowPage(){
    var original = window.showPage;
    if(typeof original !== 'function' || original.__monthlyV10098Wrapped) return;
    function fixedShowPage(page, btn){
      var res = original.apply(this, arguments);
      if(page === 'monthly'){
        setTimeout(function(){
          normalizeMonthlyPage();
          wrapRenderMonthly();
          if(typeof window.renderMonthly === 'function') window.renderMonthly();
        }, 80);
      }
      return res;
    }
    fixedShowPage.__monthlyV10098Wrapped = true;
    window.showPage = fixedShowPage;
  }

  function init(){
    wrapRenderMonthly();
    wrapShowPage();
    normalizeMonthlyPage();
    setTimeout(function(){ wrapRenderMonthly(); wrapShowPage(); normalizeMonthlyPage(); }, 500);
    setTimeout(function(){ wrapRenderMonthly(); wrapShowPage(); normalizeMonthlyPage(); }, 1500);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

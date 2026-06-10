(function(){
  'use strict';
  if(window.__tasneefAdminShowPageRescueV10047) return;
  window.__tasneefAdminShowPageRescueV10047 = true;

  const S = v => String(v ?? '').trim();
  const $ = id => document.getElementById(id);

  function pageFromButton(btn){
    if(!btn) return '';
    const dp = S(btn.dataset && btn.dataset.page);
    if(dp) return dp;
    const oc = S(btn.getAttribute('onclick'));
    const m = oc.match(/showPage\(['"]([^'"]+)['"]/);
    return m ? m[1] : '';
  }

  function runPageHooks(id){
    try{ if(id==='contracts' && typeof window.showContractsSubTab === 'function') window.showContractsSubTab('services'); }catch(_){ }
    try{ if(id==='attendance' && typeof window.renderAttendanceMonthly === 'function') setTimeout(()=>window.renderAttendanceMonthly(),40); }catch(_){ }
    try{ if(id==='clientReports' && typeof window.renderPremiumReports === 'function') setTimeout(()=>window.renderPremiumReports(),40); }catch(_){ }
    try{ if(id==='financeDashboard'){
      const target = $(id);
      if(target) target.classList.add('finance-pro');
      if(typeof window.financeProLoadV15 === 'function' && target && !target.querySelector('.fin-shell,#finTabsV15,#finBodyV15')) window.financeProLoadV15(false);
      if(typeof window.financeProRenderAll === 'function') setTimeout(()=>window.financeProRenderAll(),40);
    }}catch(_){ }
    try{ if(id==='inventoryAudit' && window.tasneefInventoryAuditV10046 && typeof window.tasneefInventoryAuditV10046.load === 'function') setTimeout(()=>window.tasneefInventoryAuditV10046.load(),40); }catch(_){ }
  }

  function openPageHard(id, btn){
    id = S(id);
    const target = $(id);
    if(!id || !target) return false;
    document.querySelectorAll('.page').forEach(p=>{
      p.classList.add('hidden');
      p.style.display = '';
      p.style.visibility = '';
      p.style.opacity = '';
    });
    target.classList.remove('hidden');
    target.style.display = '';
    target.style.visibility = '';
    target.style.opacity = '';
    document.querySelectorAll('.side .nav').forEach(n=>n.classList.remove('active'));
    const activeBtn = btn || [...document.querySelectorAll('.side .nav')].find(b=>pageFromButton(b)===id);
    if(activeBtn) activeBtn.classList.add('active');
    runPageHooks(id);
    return true;
  }

  window.tasneefOpenPageHardV10047 = openPageHard;
  window.showPage = function(id, btn){
    const ok = openPageHard(id, btn);
    if(!ok){
      try{ if(typeof msg === 'function') msg('القسم غير موجود: '+id, 'err'); }catch(_){ }
    }
    return ok;
  };
  try{ showPage = window.showPage; }catch(_){ }

  // Capture sidebar clicks before any older permission wrapper blocks them.
  document.addEventListener('click', function(e){
    const btn = e.target && e.target.closest ? e.target.closest('.side .nav') : null;
    if(!btn || btn.classList.contains('danger')) return;
    const page = pageFromButton(btn);
    if(!page) return;
    const target = $(page);
    if(!target) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    openPageHard(page, btn);
  }, true);

  // Re-assert after all old scripts finish wrapping showPage.
  function boot(){
    window.showPage = function(id, btn){ return openPageHard(id, btn); };
    try{ showPage = window.showPage; }catch(_){ }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=>setTimeout(boot, 80));
  else setTimeout(boot, 80);
  window.addEventListener('load', ()=>{ setTimeout(boot, 250); setTimeout(boot, 1200); });
})();

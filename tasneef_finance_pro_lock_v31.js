(function(){
  if(window.__tasneefFinanceProLockV31) return;
  window.__tasneefFinanceProLockV31 = true;

  const S = (v)=>String(v ?? '').trim();
  const financeRoles = new Set(['admin','general_manager','financial_manager','warehouse_manager','operations_manager']);
  const oldTabMap = {
    overview:'summary', summary:'summary', dashboard:'summary',
    inventory:'products', catalog:'products', items:'products', products:'products',
    add:'add', invoice:'add', invoices:'add',
    movements:'movement', movement:'movement', requests:'movement',
    suppliers:'suppliers',
    costCenters:'cost', cost:'cost', expenses:'cost',
    reports:'reports'
  };

  function currentRole(){
    try{
      const user = JSON.parse(localStorage.getItem('tasneef_user') || localStorage.getItem('tasneef_session') || '{}') || {};
      return S(user.role);
    }catch(e){ return ''; }
  }
  function shouldLockFinance(){
    const role = currentRole();
    return !role || financeRoles.has(role);
  }
  function page(){
    return document.getElementById('financeDashboard');
  }
  function financeVisible(){
    const el = page();
    return !!el && !el.classList.contains('hidden') && el.offsetParent !== null;
  }
  function hasProShell(){
    const el = page();
    return !!el && !!el.querySelector('.fin-shell,#finTabsV15,#finBodyV15');
  }
  function removeLegacyBits(){
    const el = page();
    if(!el) return;
    if(hasProShell()){
      el.querySelectorAll('.finance-tabs,.finance-tab-page,#financeTabOverview,#financeTabInventory,#financeTabMovements,#financeTabReports,#financeTabCostCenters,#financeTabSuppliers,#financeTabCatalog,#financeTabExpenses').forEach(node=>{
        if(!node.closest('.fin-shell')) node.remove();
      });
    }
    const blocked = [
      'الأصناف','الموردين','تقليل التكلفة','تعديل التكلفة',
      'ط§ظ„ط£طµظ†ط§ظپ','ط§ظ„ظ…ظˆط±ط¯ظٹظ†','طھظ‚ظ„ظٹظ„ ط§ظ„طھظƒظ„ظپط©','طھط¹ط¯ظٹظ„ ط§ظ„طھظƒظ„ظپط©',
      'ط·آ§ط¸â€‍ط·آ£ط·آµط¸â€ ط·آ§ط¸ظ¾','ط·آ§ط¸â€‍ط¸â€¦ط¸ث†ط·آ±ط·آ¯ط¸ظ¹ط¸â€ ','ط·ع¾ط¸â€ڑط¸â€‍ط¸ظ¹ط¸â€‍ ط·آ§ط¸â€‍ط·ع¾ط¸ئ’ط¸â€‍ط¸ظ¾ط·آ©'
    ];
    document.querySelectorAll('button,a').forEach(btn=>{
      if(btn.closest('.fin-shell')) return;
      const text = S(btn.textContent).replace(/\s+/g,' ');
      if(blocked.some(word=>text === word || text.includes(word))) btn.style.display = 'none';
    });
  }
  function renderPro(forceLoad){
    if(!shouldLockFinance()) return;
    if(typeof window.financeProLoadV15 === 'function'){
      window.financeProLoadV15(!!forceLoad);
    }else if(typeof window.financeProRenderCurrentV15 === 'function'){
      window.financeProRenderCurrentV15();
    }
    setTimeout(removeLegacyBits, 30);
    setTimeout(removeLegacyBits, 180);
  }
  function showFinance(btn){
    if(!shouldLockFinance()) return false;
    const el = page();
    if(!el) return false;
    document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));
    el.classList.remove('hidden');
    el.classList.add('finance-pro');
    document.querySelectorAll('.nav').forEach(n=>n.classList.remove('active'));
    if(btn && btn.classList) btn.classList.add('active');
    setTimeout(()=>renderPro(false), 0);
    setTimeout(()=>renderPro(false), 220);
    return true;
  }
  function mapTab(tab){
    return oldTabMap[S(tab)] || 'summary';
  }
  function installFunctionLocks(){
    if(!shouldLockFinance()) return;

    const oldShow = window.showPage;
    if(typeof oldShow === 'function' && !oldShow.__financeProLockV31){
      const wrapped = function(id, btn){
        if(id === 'financeDashboard') return showFinance(btn);
        return oldShow.apply(this, arguments);
      };
      wrapped.__financeProLockV31 = true;
      wrapped.__financeProOriginal = oldShow;
      window.showPage = wrapped;
    }

    window.financeRenderAll = function(){
      if(financeVisible() || page()){
        renderPro(false);
      }
    };
    window.financeShowTab = function(tab){
      const id = mapTab(tab);
      if(typeof window.financeProTabV15 === 'function') return window.financeProTabV15(id);
      renderPro(false);
    };
    [
      'financeHydrateForms','financeRenderKpis','financeRenderRecent','financeRenderExpenses',
      'inventoryRenderItems','inventoryRenderMovements','inventoryRenderRequests','financeRenderReports',
      'ensureTabs','ensureFinanceTabsVisibleV178'
    ].forEach(name=>{
      window[name] = function(){
        if(financeVisible()) removeLegacyBits();
      };
    });
  }
  function guardVisibleFinance(){
    if(!shouldLockFinance()) return;
    installFunctionLocks();
    if(financeVisible()){
      if(!hasProShell()) renderPro(false);
      else removeLegacyBits();
    }
  }
  function boot(){
    installFunctionLocks();
    removeLegacyBits();
    [250, 700, 1300, 2300, 3600].forEach(ms=>setTimeout(guardVisibleFinance, ms));
  }

  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('load', boot);
  setTimeout(boot, 1200);
  setTimeout(boot, 2600);

  let busy = false;
  new MutationObserver(()=>{
    if(busy) return;
    busy = true;
    setTimeout(()=>{
      busy = false;
      guardVisibleFinance();
    }, 90);
  }).observe(document.documentElement, {childList:true, subtree:true});

  setInterval(guardVisibleFinance, 1400);
})();

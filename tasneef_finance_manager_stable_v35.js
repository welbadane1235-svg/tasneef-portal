(function(){
  if(window.__tasneefFinanceManagerStableV35) return;
  window.__tasneefFinanceManagerStableV35 = true;

  const S = (v)=>String(v ?? '').trim();
  const ADMIN_LIKE_PERMS = [
    'can_dashboard','can_time_logs','can_manage_users','can_projects','can_contracts',
    'can_manage_workers','can_attendance','can_monthly','can_tickets','can_client_reports',
    'can_client_ratings','can_alerts','can_assistant','can_export','can_expenses_inventory',
    'can_inventory_requests','can_manage_inventory','can_edit_inventory_requests',
    'can_delete_inventory_requests','can_journey','can_reports','can_edit_time_logs'
  ];
  const FINANCE_TABS = [
    'overview','summary','products','add','movement','cost','reports','expenses','inventory',
    'catalog','movements','requests','costCenters','suppliers'
  ];
  const TAB_ACTIONS = ['view','add','edit','delete','print'];
  function financeAdminPerms(base){
    const out=Object.assign({}, base || {});
    ADMIN_LIKE_PERMS.forEach(k=>out[k]=true);
    FINANCE_TABS.forEach(tab=>TAB_ACTIONS.forEach(action=>out[`tab_${tab}_${action}`]=true));
    return out;
  }
  function parsePerms(value){
    if(typeof value === 'string'){
      try{ return JSON.parse(value || '{}') || {}; }catch(e){ return {}; }
    }
    return value || {};
  }
  function user(){
    try{ return JSON.parse(localStorage.getItem('tasneef_user') || localStorage.getItem('tasneef_session') || '{}') || {}; }
    catch(e){ return {}; }
  }
  function isFinanceManager(){
    return S(user().role) === 'financial_manager';
  }
  function elevateFinanceSession(){
    const u=user();
    if(S(u.role) !== 'financial_manager') return;
    const next=Object.assign({}, u, { permissions: financeAdminPerms(parsePerms(u.permissions)) });
    try{ localStorage.setItem('tasneef_user', JSON.stringify(next)); }catch(e){}
    try{ localStorage.setItem('tasneef_session', JSON.stringify(next)); }catch(e){}
    try{
      if(window.data && Array.isArray(window.data.users)){
        window.data.users = window.data.users.map(row=>String(row.id)===String(next.id) ? Object.assign({}, row, {permissions:next.permissions}) : row);
      }
    }catch(e){}
  }
  function page(){
    return document.getElementById('financeDashboard');
  }
  function visible(){
    const p=page();
    return !!p && !p.classList.contains('hidden');
  }
  function hasPro(){
    const p=page();
    return !!p && !!p.querySelector('.fin-shell,#finTabsV15,#finBodyV15');
  }
  function style(){
    if(document.getElementById('financeManagerStableStyleV35')) return;
    const st=document.createElement('style');
    st.id='financeManagerStableStyleV35';
    st.textContent=`
      body.finance-manager-stable-v35 #financeDashboard.finance-pro:not(.hidden){display:block!important;visibility:visible!important;opacity:1!important}
      body.finance-manager-stable-v35 #financeDashboard .fin-shell{display:grid!important;visibility:visible!important;opacity:1!important}
      body.finance-manager-stable-v35 #financeDashboard .finance-tabs,
      body.finance-manager-stable-v35 #financeDashboard .finance-tab-page,
      body.finance-manager-stable-v35 #financeDashboard [id^="financeTab"]{display:none!important}
      body.finance-manager-stable-v35 #finTabsV15 button{display:inline-flex!important;visibility:visible!important;opacity:1!important}
      body.finance-manager-stable-v35 .fin-money-hidden-v29{display:revert!important;visibility:visible!important}
      body.finance-manager-stable-v35 #financeDashboard .fin-actions,
      body.finance-manager-stable-v35 #financeDashboard .fin-actions button,
      body.finance-manager-stable-v35 #financeDashboard button{visibility:visible!important;opacity:1!important}
    `;
    document.head.appendChild(st);
  }
  function removeWarehouseClasses(){
    document.body.classList.remove(
      'finance-warehouse-role-v29',
      'finance-warehouse-role-v28',
      'warehouse-manager-view-v151',
      'warehouse-manager-view-v162',
      'warehouse-manager-view-v163',
      'warehouse-manager-view-v164',
      'warehouse-manager-view-v178',
      'warehouse-manager-view-v179',
      'warehouse-manager-view-v180'
    );
  }
  function clean(){
    if(!isFinanceManager()) return;
    elevateFinanceSession();
    style();
    document.body.classList.add('finance-manager-stable-v35');
    removeWarehouseClasses();
    document.querySelectorAll('.fin-money-hidden-v29').forEach(el=>el.classList.remove('fin-money-hidden-v29'));
    const p=page();
    if(!p) return;
    p.classList.add('finance-pro');
    p.querySelectorAll('.finance-tabs,.finance-tab-page,#financeTabOverview,#financeTabInventory,#financeTabMovements,#financeTabReports,#financeTabCostCenters,#financeTabSuppliers,#financeTabCatalog,#financeTabExpenses').forEach(el=>{
      if(!el.closest('.fin-shell')) el.remove();
    });
    document.querySelectorAll('#finTabsV15 button').forEach(btn=>{
      btn.style.display='';
      btn.hidden=false;
      btn.classList.remove('v205-hidden-perm');
    });
  }
  function renderIfNeeded(){
    if(!isFinanceManager()) return;
    clean();
    if(!hasPro() && typeof window.financeProLoadV15 === 'function'){
      window.financeProLoadV15(false);
      setTimeout(clean,120);
    }
  }
  function showFinance(btn){
    if(!isFinanceManager()) return false;
    let p=page();
    if(!p && typeof window.financeProLoadV15 === 'function') window.financeProLoadV15(false);
    p=page();
    if(!p) return false;
    document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden'));
    p.classList.remove('hidden');
    p.classList.add('finance-pro');
    p.style.display='block';
    p.style.visibility='visible';
    p.style.opacity='1';
    document.querySelectorAll('.nav').forEach(n=>n.classList.remove('active'));
    if(btn && btn.classList) btn.classList.add('active');
    renderIfNeeded();
    return true;
  }
  function patchShowPage(){
    if(!isFinanceManager()) return;
    const old=window.showPage;
    if(typeof old === 'function' && old.__financeManagerStableV35) return;
    window.showPage=function(id,btn){
      if(id==='financeDashboard') return showFinance(btn);
      return typeof old === 'function' ? old.apply(this, arguments) : undefined;
    };
    window.showPage.__financeManagerStableV35=true;
    try{ showPage=window.showPage; }catch(e){}
  }
  function patchClicks(){
    if(window.__financeManagerStableClicksV35) return;
    window.__financeManagerStableClicksV35=true;
    document.addEventListener('click', function(ev){
      if(!isFinanceManager()) return;
      const btn=ev.target && ev.target.closest ? ev.target.closest('#finTabsV15 button[data-fin-tab-v15]') : null;
      if(!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      if(typeof window.financeProTabV15 === 'function') window.financeProTabV15(btn.getAttribute('data-fin-tab-v15') || 'summary');
      setTimeout(clean,80);
    }, true);
  }
  function patchPermissionHelpers(){
    if(!isFinanceManager()) return;
    if(!window.__financeManagerPermHelpersV35){
      window.__financeManagerPermHelpersV35=true;
      const wrapPerms=function(name){
        const old=window[name];
        window[name]=function(currentUser){
          const u=currentUser || user();
          if(S(u.role)==='financial_manager') return financeAdminPerms(parsePerms(u.permissions));
          return typeof old === 'function' ? old.apply(this, arguments) : parsePerms(u.permissions);
        };
      };
      wrapPerms('getUserPermissionsV72');
      wrapPerms('getUserPermissionsV113');
      const oldCan=window.tasneefCanV201;
      window.tasneefCanV201=function(key){
        if(isFinanceManager() && (S(key).startsWith('tab_') || ADMIN_LIKE_PERMS.includes(S(key)))) return true;
        return typeof oldCan === 'function' ? oldCan.apply(this, arguments) : true;
      };
    }
  }
  function boot(){
    if(!isFinanceManager()) return;
    elevateFinanceSession();
    style();
    patchShowPage();
    patchClicks();
    patchPermissionHelpers();
    clean();
    setTimeout(renderIfNeeded,300);
    setTimeout(renderIfNeeded,1200);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('load',()=>setTimeout(boot,200));
  setInterval(()=>{
    if(isFinanceManager() && visible()) renderIfNeeded();
  },1800);
  let busy=false;
  new MutationObserver(()=>{
    if(busy || !isFinanceManager() || !visible()) return;
    busy=true;
    setTimeout(()=>{ busy=false; clean(); if(!hasPro()) renderIfNeeded(); },90);
  }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden']});
})();

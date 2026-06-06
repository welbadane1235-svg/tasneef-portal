(function(){
  'use strict';
  if(window.__tasneefWarehouseManagerStableV44) return;
  window.__tasneefWarehouseManagerStableV44 = true;

  const S = v => String(v ?? '').trim();
  const WAREHOUSE_PERMS = [
    'can_dashboard','can_expenses_inventory','can_manage_inventory','can_inventory_requests',
    'can_edit_inventory_requests','can_delete_inventory_requests',
    'tab_financeDashboard_view','tab_financeDashboard_add','tab_financeDashboard_edit','tab_financeDashboard_delete','tab_financeDashboard_print',
    'tab_products_view','tab_products_add','tab_products_edit','tab_products_delete','tab_products_print',
    'tab_movement_view','tab_movement_add','tab_movement_edit','tab_movement_delete','tab_movement_print'
  ];

  function user(){
    try{ return JSON.parse(localStorage.getItem('tasneef_user') || '{}') || {}; }
    catch(_){ return {}; }
  }
  function parsePerms(value){
    if(!value) return {};
    if(typeof value === 'object') return value || {};
    try{ return JSON.parse(value) || {}; }catch(_){ return {}; }
  }
  function isWarehouse(){
    return S(user().role) === 'warehouse_manager';
  }
  function page(){
    return document.getElementById('financeDashboard');
  }
  function visible(){
    const p = page();
    return !!p && !p.classList.contains('hidden');
  }
  function hasPro(){
    const p = page();
    return !!p && !!p.querySelector('#finTabsV15') && !!p.querySelector('#finBodyV15');
  }
  function elevateSession(){
    const u = user();
    if(S(u.role) !== 'warehouse_manager') return;
    const perms = parsePerms(u.permissions);
    WAREHOUSE_PERMS.forEach(k => perms[k] = true);
    const next = Object.assign({}, u, { permissions: perms });
    try{ localStorage.setItem('tasneef_user', JSON.stringify(next)); }catch(_){}
    try{ localStorage.setItem('tasneef_session', JSON.stringify(next)); }catch(_){}
    try{
      if(window.data && Array.isArray(window.data.users)){
        window.data.users = window.data.users.map(row => S(row.id) === S(next.id) ? Object.assign({}, row, {permissions: perms}) : row);
      }
    }catch(_){}
  }
  function style(){
    if(document.getElementById('warehouseManagerStableStyleV44')) return;
    const st = document.createElement('style');
    st.id = 'warehouseManagerStableStyleV44';
    st.textContent = `
      body.warehouse-manager-stable-v44 #financeDashboard:not(.hidden){display:block!important;visibility:visible!important;opacity:1!important}
      body.warehouse-manager-stable-v44 #financeDashboard .fin-shell{display:grid!important;visibility:visible!important;opacity:1!important}
      body.warehouse-manager-stable-v44 #financeDashboard > .finance-tabs,
      body.warehouse-manager-stable-v44 #financeDashboard > .finance-tab-page,
      body.warehouse-manager-stable-v44 #financeDashboard > [id^="financeTab"]{display:none!important}
      body.warehouse-manager-stable-v44 #finTabsV15{display:grid!important;grid-template-columns:repeat(2,minmax(160px,1fr))!important;gap:8px!important}
      body.warehouse-manager-stable-v44 #finTabsV15 button{display:none!important;visibility:hidden!important}
      body.warehouse-manager-stable-v44 #finTabsV15 button[data-fin-tab-v15="products"],
      body.warehouse-manager-stable-v44 #finTabsV15 button[data-fin-tab-v15="movement"]{display:inline-flex!important;visibility:visible!important;opacity:1!important;justify-content:center}
      body.warehouse-manager-stable-v44 #finBodyV15{display:block!important;visibility:visible!important;opacity:1!important;min-height:260px}
      body.warehouse-manager-stable-v44 #financeDashboard .fin-card,
      body.warehouse-manager-stable-v44 #financeDashboard .fin-table{visibility:visible!important;opacity:1!important}
      body.warehouse-manager-stable-v44 #financeDashboard .fin-product-card .fin-meta div:nth-child(5),
      body.warehouse-manager-stable-v44 #financeDashboard .fin-product-card .fin-meta div:nth-child(6),
      body.warehouse-manager-stable-v44 #financeDashboard .fin-product-card .fin-meta div:nth-child(7){display:none!important}
      body.warehouse-manager-stable-v44 .fin-money-hidden-v44{display:none!important}
      body.warehouse-manager-stable-v44 #financeDashboard .fin-hero p::after{content:"";display:block}
    `;
    document.head.appendChild(st);
  }
  function removeConflictClasses(){
    document.body.classList.remove(
      'finance-manager-stable-v35',
      'warehouse-manager-stable-v37',
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
  function activeTab(){
    return S(document.querySelector('#finTabsV15 button.active')?.getAttribute('data-fin-tab-v15'));
  }
  function wantedTab(){
    const saved = S(sessionStorage.getItem('tasneef_warehouse_fin_tab_v44'));
    return ['products','movement'].includes(saved) ? saved : 'products';
  }
  function removeLegacyFinance(){
    const p = page();
    if(!p) return;
    p.querySelectorAll(':scope > .finance-tabs,:scope > .finance-tab-page,:scope > [id^="financeTab"]').forEach(el => {
      if(!el.closest('.fin-shell')) el.remove();
    });
  }
  function hideMoneyText(root){
    root = root || document;
    const words = /(سعر|ضريبة|قبل الضريبة|بعد الضريبة|قيمة|تكلفة|ربح|ر\.س|price|cost|vat|tax|gross|net)/i;
    root.querySelectorAll('#financeDashboard .fin-kpi,#financeDashboard .fin-soft,#financeDashboard .fin-table th,#financeDashboard .fin-table td,.modal-backdrop .fin-card,.modal-backdrop th,.modal-backdrop td').forEach(el => {
      if(words.test(S(el.textContent))) el.classList.add('fin-money-hidden-v44');
    });
  }
  function normalizeTabs(){
    document.querySelectorAll('#finTabsV15 button[data-fin-tab-v15]').forEach(btn => {
      const id = S(btn.getAttribute('data-fin-tab-v15'));
      const ok = id === 'products' || id === 'movement';
      btn.hidden = false;
      btn.style.display = ok ? '' : 'none';
      btn.style.visibility = ok ? 'visible' : 'hidden';
      btn.classList.remove('v205-hidden-perm');
    });
    const current = activeTab();
    if(current && !['products','movement'].includes(current) && typeof window.financeProTabV15 === 'function'){
      window.financeProTabV15(wantedTab());
    }
  }
  function clean(){
    if(!isWarehouse()) return;
    elevateSession();
    style();
    removeConflictClasses();
    document.body.classList.add('warehouse-manager-stable-v44');
    const p = page();
    if(!p) return;
    p.classList.add('finance-pro');
    p.style.display = p.classList.contains('hidden') ? '' : 'block';
    removeLegacyFinance();
    normalizeTabs();
    hideMoneyText(document);
  }
  function ensurePro(tab){
    if(!isWarehouse()) return;
    elevateSession();
    style();
    if(typeof window.financeProLoadV15 === 'function' && !hasPro()){
      window.financeProLoadV15(false);
    }
    setTimeout(() => {
      clean();
      const target = tab || wantedTab();
      if(typeof window.financeProTabV15 === 'function' && visible() && (!activeTab() || activeTab() !== target)){
        window.financeProTabV15(target);
        setTimeout(clean, 80);
      }
    }, 100);
  }
  function patchFinanceProTab(){
    const old = window.financeProTabV15;
    if(typeof old !== 'function' || old.__warehouseStableV44) return;
    const wrapped = async function(tab){
      if(isWarehouse()){
        const target = ['products','movement'].includes(S(tab)) ? S(tab) : 'products';
        sessionStorage.setItem('tasneef_warehouse_fin_tab_v44', target);
        const result = await old.call(this, target);
        setTimeout(() => {
          clean();
          const body = document.getElementById('finBodyV15');
          if(target === 'movement' && body && (!S(body.textContent) || /جاري|تعذر|المصروفات|الموردين|مركز تكلفة/.test(S(body.textContent)))){
            try{ old.call(this, 'movement'); }catch(_){}
            setTimeout(clean, 80);
          }
        }, 60);
        return result;
      }
      return old.apply(this, arguments);
    };
    wrapped.__warehouseStableV44 = true;
    window.financeProTabV15 = wrapped;
  }
  function showFinance(btn){
    if(!isWarehouse()) return false;
    let p = page();
    if(!p && typeof window.financeProLoadV15 === 'function') window.financeProLoadV15(false);
    p = page();
    if(!p) return false;
    document.querySelectorAll('.page').forEach(x => x.classList.add('hidden'));
    p.classList.remove('hidden');
    p.classList.add('finance-pro');
    p.style.display = 'block';
    p.style.visibility = 'visible';
    p.style.opacity = '1';
    document.querySelectorAll('.nav').forEach(n => n.classList.remove('active'));
    if(btn && btn.classList) btn.classList.add('active');
    ensurePro(wantedTab());
    return true;
  }
  function patchShowPage(){
    const old = window.showPage;
    if(typeof old !== 'function' || old.__warehouseStableV44) return;
    const wrapped = function(id, btn){
      if(isWarehouse() && id === 'financeDashboard') return showFinance(btn);
      return old.apply(this, arguments);
    };
    wrapped.__warehouseStableV44 = true;
    window.showPage = wrapped;
    try{ showPage = wrapped; }catch(_){}
  }
  function patchTabs(){
    if(window.__warehouseStableTabsV44) return;
    window.__warehouseStableTabsV44 = true;
    document.addEventListener('click', function(ev){
      if(!isWarehouse()) return;
      const btn = ev.target && ev.target.closest ? ev.target.closest('#finTabsV15 button[data-fin-tab-v15]') : null;
      if(!btn) return;
      const id = S(btn.getAttribute('data-fin-tab-v15'));
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      if(!['products','movement'].includes(id)) return;
      sessionStorage.setItem('tasneef_warehouse_fin_tab_v44', id);
      if(typeof window.financeProTabV15 === 'function') window.financeProTabV15(id);
      setTimeout(clean, 70);
    }, true);
  }
  function patchPermissions(){
    if(window.__warehouseStablePermsV44) return;
    window.__warehouseStablePermsV44 = true;
    const oldCan201 = window.tasneefCanV201;
    const oldCan40 = window.tasneefCanV40;
    const allow = key => {
      const k = S(key);
      return k === 'can_expenses_inventory' || k === 'can_manage_inventory' || k === 'can_inventory_requests' ||
        k.startsWith('tab_products_') || k.startsWith('tab_movement_') || k.startsWith('tab_financeDashboard_');
    };
    window.tasneefCanV201 = function(key){
      if(isWarehouse() && allow(key)) return true;
      return typeof oldCan201 === 'function' ? oldCan201.apply(this, arguments) : true;
    };
    window.tasneefCanV40 = function(key){
      if(isWarehouse() && allow(key)) return true;
      return typeof oldCan40 === 'function' ? oldCan40.apply(this, arguments) : true;
    };
  }
  function boot(){
    if(!isWarehouse()) return;
    elevateSession();
    style();
    patchShowPage();
    patchFinanceProTab();
    patchTabs();
    patchPermissions();
    clean();
    setTimeout(() => ensurePro(), 250);
    setTimeout(() => ensurePro(), 900);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('load', () => setTimeout(boot, 250));
  setInterval(() => { if(isWarehouse() && visible()) ensurePro(); }, 1200);
  let busy = false;
  try{
    new MutationObserver(() => {
      if(busy || !isWarehouse() || !visible()) return;
      busy = true;
      setTimeout(() => { busy = false; clean(); if(!hasPro()) ensurePro(); }, 70);
    }).observe(document.documentElement, {childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden']});
  }catch(_){}
})();

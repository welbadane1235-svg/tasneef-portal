(function(){
  if(window.__tasneefWarehouseManagerStableV37) return;
  window.__tasneefWarehouseManagerStableV37 = true;

  const S = (v)=>String(v ?? '').trim();
  const WAREHOUSE_PERMS = [
    'can_dashboard','can_expenses_inventory','can_inventory_requests','can_manage_inventory',
    'can_edit_inventory_requests','can_delete_inventory_requests'
  ];
  const WAREHOUSE_TABS = ['products','movement','inventory','catalog','movements','requests'];
  const TAB_ACTIONS = ['view','add','edit','delete','print'];

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
  function isWarehouse(){
    return S(user().role) === 'warehouse_manager';
  }
  function warehousePerms(base){
    const out=Object.assign({}, base || {});
    WAREHOUSE_PERMS.forEach(k=>out[k]=true);
    WAREHOUSE_TABS.forEach(tab=>TAB_ACTIONS.forEach(action=>out[`tab_${tab}_${action}`]=true));
    return out;
  }
  function elevateWarehouseSession(){
    const u=user();
    if(S(u.role) !== 'warehouse_manager') return;
    const next=Object.assign({}, u, {permissions:warehousePerms(parsePerms(u.permissions))});
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
    if(document.getElementById('warehouseManagerStableStyleV37')) return;
    const st=document.createElement('style');
    st.id='warehouseManagerStableStyleV37';
    st.textContent=`
      body.warehouse-manager-stable-v37 #financeDashboard.finance-pro:not(.hidden){display:block!important;visibility:visible!important;opacity:1!important}
      body.warehouse-manager-stable-v37 #financeDashboard .fin-shell{display:grid!important;visibility:visible!important;opacity:1!important}
      body.warehouse-manager-stable-v37 #financeDashboard .finance-tabs,
      body.warehouse-manager-stable-v37 #financeDashboard .finance-tab-page,
      body.warehouse-manager-stable-v37 #financeDashboard [id^="financeTab"]{display:none!important}
      body.warehouse-manager-stable-v37 #finTabsV15 button{display:none!important}
      body.warehouse-manager-stable-v37 #finTabsV15 button[data-fin-tab-v15="products"],
      body.warehouse-manager-stable-v37 #finTabsV15 button[data-fin-tab-v15="movement"]{display:inline-flex!important;visibility:visible!important;opacity:1!important}
      body.warehouse-manager-stable-v37 #financeDashboard .fin-product-card .fin-meta div:nth-child(n+5){display:none!important}
      body.warehouse-manager-stable-v37 .fin-money-hidden-v37,
      body.warehouse-manager-stable-v37 .fin-money-hidden-v29{display:none!important}
      body.warehouse-manager-stable-v37 .modal-backdrop .fin-table table tr > :last-child{display:none!important}
      body.warehouse-manager-stable-v37 .modal-backdrop .fin-page-v15:first-of-type .fin-table table tr > :last-child{display:table-cell!important}
    `;
    document.head.appendChild(st);
  }
  function removeFinanceManagerClasses(){
    document.body.classList.remove('finance-manager-stable-v35');
  }
  function removeOldWarehouseClasses(){
    document.body.classList.remove(
      'warehouse-manager-view-v151',
      'warehouse-manager-view-v162',
      'warehouse-manager-view-v163',
      'warehouse-manager-view-v164',
      'warehouse-manager-view-v178',
      'warehouse-manager-view-v179',
      'warehouse-manager-view-v180'
    );
  }
  function tabId(btn){
    return S(btn && (btn.getAttribute('data-fin-tab-v15') || ((S(btn.getAttribute('onclick')).match(/financeProTabV15\(['"]([^'"]+)/)||[])[1])));
  }
  function markMoney(root){
    root = root || document;
    const moneyWords=/(سعر|ضريبة|قبل الضريبة|بعد الضريبة|قيمة|تكلفة|ربح|ر\.س|ط³ط¹ط±|ط¶ط±ظٹط¨ط©|ظ‚ط¨ظ„ ط§ظ„ط¶ط±ظٹط¨ط©|ط¨ط¹ط¯ ط§ظ„ط¶ط±ظٹط¨ط©|ظ‚ظٹظ…ط©|طھظƒظ„ظپط©|ط±ط¨ط­|ط±\.ط³|ط·آ±\.ط·آ³)/;
    root.querySelectorAll('#financeDashboard .fin-meta div,#financeDashboard .fin-kpi,#financeDashboard .fin-soft,.modal-backdrop .fin-table th,.modal-backdrop .fin-table td,.modal-backdrop .fin-card').forEach(el=>{
      if(moneyWords.test(S(el.textContent))) el.classList.add('fin-money-hidden-v37');
    });
  }
  function clean(){
    if(!isWarehouse()) return;
    elevateWarehouseSession();
    style();
    document.body.classList.add('warehouse-manager-stable-v37','finance-warehouse-role-v29');
    removeFinanceManagerClasses();
    removeOldWarehouseClasses();
    const p=page();
    if(!p) return;
    p.classList.add('finance-pro');
    p.querySelectorAll('.finance-tabs,.finance-tab-page,#financeTabOverview,#financeTabInventory,#financeTabMovements,#financeTabReports,#financeTabCostCenters,#financeTabSuppliers,#financeTabCatalog,#financeTabExpenses').forEach(el=>{
      if(!el.closest('.fin-shell')) el.remove();
    });
    document.querySelectorAll('#finTabsV15 button').forEach(btn=>{
      const id=tabId(btn);
      const allowed=id==='products' || id==='movement';
      btn.hidden=false;
      btn.style.display=allowed ? '' : 'none';
      btn.classList.remove('v205-hidden-perm');
    });
    const active=tabId(document.querySelector('#finTabsV15 button.active'));
    if(active && active!=='products' && active!=='movement' && typeof window.financeProTabV15==='function'){
      window.financeProTabV15('products');
    }
    markMoney(document);
  }
  function renderIfNeeded(){
    if(!isWarehouse()) return;
    clean();
    if(!hasPro() && typeof window.financeProLoadV15 === 'function'){
      window.financeProLoadV15(false);
      setTimeout(clean,120);
    }
  }
  function showFinance(btn){
    if(!isWarehouse()) return false;
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
    if(!isWarehouse()) return;
    const old=window.showPage;
    if(typeof old === 'function' && old.__warehouseManagerStableV37) return;
    window.showPage=function(id,btn){
      if(id==='financeDashboard') return showFinance(btn);
      return typeof old === 'function' ? old.apply(this, arguments) : undefined;
    };
    window.showPage.__warehouseManagerStableV37=true;
    try{ showPage=window.showPage; }catch(e){}
  }
  function patchClicks(){
    if(window.__warehouseManagerStableClicksV37) return;
    window.__warehouseManagerStableClicksV37=true;
    document.addEventListener('click', function(ev){
      if(!isWarehouse()) return;
      const btn=ev.target && ev.target.closest ? ev.target.closest('#finTabsV15 button[data-fin-tab-v15]') : null;
      if(!btn) return;
      const id=btn.getAttribute('data-fin-tab-v15') || 'products';
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      if(id!=='products' && id!=='movement') return;
      if(typeof window.financeProTabV15 === 'function') window.financeProTabV15(id);
      setTimeout(clean,80);
    }, true);
  }
  function patchPermissionHelpers(){
    if(!isWarehouse() || window.__warehousePermHelpersV37) return;
    window.__warehousePermHelpersV37=true;
    const wrapPerms=function(name){
      const old=window[name];
      window[name]=function(currentUser){
        const u=currentUser || user();
        if(S(u.role)==='warehouse_manager') return warehousePerms(parsePerms(u.permissions));
        return typeof old === 'function' ? old.apply(this, arguments) : parsePerms(u.permissions);
      };
    };
    wrapPerms('getUserPermissionsV72');
    wrapPerms('getUserPermissionsV113');
    const oldCan=window.tasneefCanV201;
    window.tasneefCanV201=function(key){
      if(isWarehouse() && (S(key).startsWith('tab_') || WAREHOUSE_PERMS.includes(S(key)))) return true;
      return typeof oldCan === 'function' ? oldCan.apply(this, arguments) : true;
    };
  }
  function boot(){
    if(!isWarehouse()) return;
    elevateWarehouseSession();
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
  window.addEventListener('load',()=>setTimeout(boot,240));
  setInterval(()=>{ if(isWarehouse() && visible()) renderIfNeeded(); },1800);
  let busy=false;
  new MutationObserver(()=>{
    if(busy || !isWarehouse() || !visible()) return;
    busy=true;
    setTimeout(()=>{ busy=false; clean(); if(!hasPro()) renderIfNeeded(); },90);
  }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden']});
})();

(function(){
  'use strict';
  if(window.__tasneefSidebarPermissionsLockV44) return;
  window.__tasneefSidebarPermissionsLockV44 = true;

  const S = v => String(v ?? '').trim();
  const A = v => Array.isArray(v) ? v : [];
  const $ = id => document.getElementById(id);
  const NAV = [
    ['dashboard','can_dashboard','لوحة التحكم'],
    ['daily','can_time_logs','التسجيلات اليومية'],
    ['users','can_manage_users','إدارة المستخدمين'],
    ['projects','can_projects','المشاريع'],
    ['contracts','can_contracts','العقود والخدمات'],
    ['workers','can_manage_workers','العمال'],
    ['attendance','can_attendance','الحضور والغياب'],
    ['monthly','can_monthly','الأوقات الشهرية'],
    ['tickets','can_tickets','التكتات'],
    ['orders','can_orders','الأوردرات'],
    ['clientReports','can_client_reports','تقارير العملاء'],
    ['clientRatings','can_client_ratings','تقييمات العملاء'],
    ['alerts','can_alerts','التنبيهات'],
    ['assistant','can_assistant','مساعد تصنيف'],
    ['financeDashboard','can_expenses_inventory','المالية والمخزون'],
    ['export','can_export','التصدير والاستيراد']
  ];
  const EXTRA_KEYS = ['can_manage_inventory','can_inventory_requests','can_edit_inventory_requests','can_delete_inventory_requests','can_journey','can_reports','can_edit_time_logs'];
  const CORE_KEYS = NAV.map(x=>x[1]).concat(EXTRA_KEYS);

  function roleOf(role){
    const r=S(role);
    const map={
      general_manager:'admin', system_admin:'admin',
      'مدير عام':'admin','مدير النظام':'admin',
      'مدير مالي':'financial_manager','مدير تشغيلي':'operations_manager',
      'مدير مخازن':'warehouse_manager','مدير مخزون':'warehouse_manager',
      'مشرف':'supervisor','فني':'technician'
    };
    return map[r] || r || 'supervisor';
  }
  function parsePerms(v){
    if(!v) return {};
    if(typeof v === 'object') return v || {};
    try{ return JSON.parse(v) || {}; }catch(_){ return {}; }
  }
  function hasExplicit(p){
    return Object.keys(p || {}).some(k => CORE_KEYS.includes(k) || /^tab_/.test(k));
  }
  function defaults(role){
    const r=roleOf(role), p={};
    const set=keys=>keys.forEach(k=>p[k]=true);
    if(r==='admin'){
      CORE_KEYS.forEach(k=>p[k]=true);
      return p;
    }
    if(r==='financial_manager') set(['can_dashboard','can_orders','can_client_reports','can_client_ratings','can_alerts','can_export','can_expenses_inventory']);
    else if(r==='operations_manager') set(['can_dashboard','can_time_logs','can_projects','can_contracts','can_manage_workers','can_attendance','can_monthly','can_tickets','can_orders','can_client_reports','can_client_ratings','can_alerts','can_assistant','can_export']);
    else if(r==='warehouse_manager') set(['can_dashboard','can_expenses_inventory','can_manage_inventory','can_inventory_requests']);
    else if(r==='technician') set(['can_dashboard','can_tickets','can_inventory_requests']);
    else set(['can_dashboard','can_time_logs','can_attendance','can_tickets','can_inventory_requests']);
    return p;
  }
  function sessionUser(){
    try{ return JSON.parse(localStorage.getItem('tasneef_user') || '{}') || {}; }catch(_){ return {}; }
  }
  function dataUsers(){
    return A(window.data && window.data.users);
  }
  function currentUser(){
    const s=sessionUser();
    const fresh=dataUsers().find(u => (s.id && S(u.id)===S(s.id)) || (s.username && S(u.username).toLowerCase()===S(s.username).toLowerCase()));
    const merged=Object.assign({}, s, fresh || {});
    if(!merged.permissions && fresh && fresh.permissions) merged.permissions=fresh.permissions;
    if(!merged.permissions && s.permissions) merged.permissions=s.permissions;
    return merged;
  }
  function exactPerms(user){
    const u=user || currentUser();
    const p=parsePerms(u.permissions);
    return hasExplicit(p) ? p : defaults(u.role);
  }
  function isAdmin(user){
    const u=user || currentUser();
    return roleOf(u.role)==='admin' || S(u.username).toLowerCase()==='admin';
  }
  function canPage(page, user){
    if(isAdmin(user)) return true;
    const row=NAV.find(([id])=>id===page);
    if(!row) return true;
    return exactPerms(user)[row[1]] === true;
  }
  function firstAllowed(){
    const u=currentUser();
    const item=NAV.find(([id])=>canPage(id,u));
    return item ? item[0] : 'dashboard';
  }
  function showMessage(text){
    try{ if(typeof msg==='function') msg(text,'err'); else console.warn(text); }catch(_){}
  }
  function pageFromButton(btn){
    const m=S(btn && btn.getAttribute('onclick')).match(/showPage\(['"]([^'"]+)['"]/);
    return m ? m[1] : S(btn && btn.dataset && btn.dataset.page);
  }
  function ensureStyle(){
    if($('sidebarLockStyleV44')) return;
    const st=document.createElement('style');
    st.id='sidebarLockStyleV44';
    st.textContent='.side[data-permission-lock-v44="1"] .nav[data-denied-v44="1"]{display:none!important}.side[data-permission-lock-v44="1"] .nav{display:block!important}.side[data-permission-lock-v44="1"] .nav.danger{display:block!important}';
    document.head.appendChild(st);
  }
  function brandHtml(side){
    const brand=side.querySelector('.brand');
    return brand ? brand.outerHTML : '<div class="brand"><span>ت</span><div><b>شركة تصنيف</b><small>إدارة المرافق</small></div></div>';
  }
  function rebuildSidebar(){
    const side=document.querySelector('.side');
    if(!side) return;
    ensureStyle();
    const u=currentUser();
    const currentActive=document.querySelector('.page:not(.hidden)');
    const activeId=currentActive && currentActive.id ? currentActive.id : firstAllowed();
    const allowed=NAV.filter(([id,core])=>canPage(id,u));
    const sig=allowed.map(([id])=>id).join('|')+'::'+activeId;
    if(side.dataset.permissionLockV44==='1' && side.dataset.navSigV44===sig){
      enforceExistingButtons();
      return;
    }
    side.dataset.permissionLockV44='1';
    side.dataset.navSigV44=sig;
    const buttons=allowed.map(([id,core,label])=>{
      const active=id===activeId ? ' active' : '';
      return `<button class="nav${active}" data-page="${id}" onclick="showPage('${id}',this)">${label}</button>`;
    }).join('');
    side.innerHTML = brandHtml(side) + buttons + '<button class="nav danger" onclick="logout()">تسجيل خروج</button>';
    guardCurrentPage();
  }
  function enforceExistingButtons(){
    document.querySelectorAll('.side .nav[onclick*="showPage"], .side .nav[data-page]').forEach(btn=>{
      const page=pageFromButton(btn);
      if(page && !canPage(page)){
        btn.dataset.deniedV44='1';
        btn.style.display='none';
      }else if(page){
        btn.dataset.deniedV44='0';
        btn.style.display='';
      }
    });
  }
  function guardCurrentPage(){
    const active=document.querySelector('.page:not(.hidden)');
    if(active && active.id && !canPage(active.id)){
      const next=firstAllowed();
      const btn=[...document.querySelectorAll('.side .nav')].find(b=>pageFromButton(b)===next);
      if(typeof originalShowPage === 'function') originalShowPage(next, btn);
      else if(typeof window.__sidebarOldShowPageV44 === 'function') window.__sidebarOldShowPageV44(next, btn);
    }
    enforceExistingButtons();
  }

  let originalShowPage = null;
  function wrapShowPage(){
    const current=window.showPage;
    if(typeof current !== 'function') return;
    if(current.__sidebarLockV44) return;
    originalShowPage=current.__sidebarOriginalV44 || current;
    const wrapped=function(id, btn){
      if(!canPage(id)){
        showMessage('لا تملك صلاحية فتح هذا القسم');
        rebuildSidebar();
        return;
      }
      const r=originalShowPage.apply(this, arguments);
      setTimeout(()=>{ rebuildSidebar(); enforceExistingButtons(); },40);
      return r;
    };
    wrapped.__sidebarLockV44=true;
    wrapped.__sidebarOriginalV44=originalShowPage;
    window.__sidebarOldShowPageV44=originalShowPage;
    window.showPage=wrapped;
    try{ showPage=wrapped; }catch(_){}
  }
  function refreshSessionFromData(){
    const s=sessionUser();
    const fresh=dataUsers().find(u => (s.id && S(u.id)===S(s.id)) || (s.username && S(u.username).toLowerCase()===S(s.username).toLowerCase()));
    if(fresh && fresh.permissions){
      localStorage.setItem('tasneef_user', JSON.stringify(Object.assign({}, s, fresh, {permissions:fresh.permissions})));
    }
  }
  function boot(){
    refreshSessionFromData();
    wrapShowPage();
    rebuildSidebar();
    guardCurrentPage();
  }
  function observe(){
    const side=document.querySelector('.side');
    if(!side || side.__sidebarObserverV44) return;
    side.__sidebarObserverV44=true;
    const mo=new MutationObserver(()=>setTimeout(boot,20));
    mo.observe(side,{childList:true,subtree:true});
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{ boot(); observe(); },250));
  window.addEventListener('load',()=>{ setTimeout(()=>{ boot(); observe(); },800); setTimeout(boot,1800); });
  setInterval(boot,1200);
})();

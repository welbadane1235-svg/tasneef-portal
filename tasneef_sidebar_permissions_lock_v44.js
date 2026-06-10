(function(){
  'use strict';
  // V10046 ROOT FIX: sidebar is rebuilt from this NAV list. Inventory audit must be inside this source list.
  window.__tasneefSidebarPermissionsLockV44 = true;
  window.__tasneefSidebarFastLockV47 = true;

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
    ['inventoryAudit','can_inventory_audit','الجرد'],
    ['export','can_export','التصدير والاستيراد']
  ];
  const EXTRA_KEYS = ['can_manage_inventory','can_inventory_requests','can_edit_inventory_requests','can_delete_inventory_requests','can_journey','can_reports','can_edit_time_logs'];
  const CORE_KEYS = NAV.map(x=>x[1]).concat(EXTRA_KEYS);
  const PAGE_ALIASES = {
    clientReports:['can_client_reports','can_reports','tab_clientReports_view'],
    clientRatings:['can_client_ratings','can_reports','tab_clientRatings_view'],
    financeDashboard:['can_expenses_inventory','can_manage_inventory','can_inventory_requests','tab_financeDashboard_view','tab_summary_view','tab_products_view','tab_movement_view','tab_reports_view'],
    inventoryAudit:['can_inventory_audit','can_expenses_inventory','can_manage_inventory','tab_inventoryAudit_view'],
    daily:['can_time_logs','tab_daily_view'], users:['can_manage_users','tab_users_view'], projects:['can_projects','tab_projects_view'],
    contracts:['can_contracts','tab_contracts_view'], workers:['can_manage_workers','tab_workers_view'], attendance:['can_attendance','tab_attendance_view'],
    monthly:['can_monthly','tab_monthly_view'], tickets:['can_tickets','tab_tickets_view'], orders:['can_orders','tab_orders_view'],
    dashboard:['can_dashboard','tab_dashboard_view'], alerts:['can_alerts','tab_alerts_view'], assistant:['can_assistant','tab_assistant_view'], export:['can_export','tab_export_view']
  };

  function roleOf(role){ const r=S(role); const map={general_manager:'admin',system_admin:'admin','مدير عام':'admin','مدير النظام':'admin','مدير مالي':'financial_manager','مدير تشغيلي':'operations_manager','مدير مخازن':'warehouse_manager','مدير مخزون':'warehouse_manager','مشرف':'supervisor','فني':'technician'}; return map[r] || r || 'supervisor'; }
  function parsePerms(v){ if(!v) return {}; if(typeof v==='object') return v||{}; try{return JSON.parse(v)||{};}catch(_){return{};} }
  function hasExplicit(p){ return Object.keys(p||{}).some(k=>CORE_KEYS.includes(k)||/^tab_/.test(k)); }
  function defaults(role){
    const r=roleOf(role), p={}; const set=keys=>keys.forEach(k=>p[k]=true);
    if(r==='admin'){ CORE_KEYS.forEach(k=>p[k]=true); return p; }
    if(r==='financial_manager') set(['can_dashboard','can_orders','can_client_reports','can_client_ratings','can_alerts','can_export','can_expenses_inventory','can_inventory_audit']);
    else if(r==='operations_manager') set(['can_dashboard','can_time_logs','can_projects','can_contracts','can_manage_workers','can_attendance','can_monthly','can_tickets','can_orders','can_client_reports','can_client_ratings','can_alerts','can_assistant','can_export']);
    else if(r==='warehouse_manager') set(['can_dashboard','can_expenses_inventory','can_manage_inventory','can_inventory_requests','can_inventory_audit']);
    else if(r==='technician') set(['can_dashboard','can_tickets','can_inventory_requests']);
    else set(['can_dashboard','can_time_logs','can_attendance','can_tickets','can_inventory_requests']);
    return p;
  }
  function sessionUser(){ try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};} }
  function dataUsers(){ return A(window.data && window.data.users); }
  function currentUser(){ const s=sessionUser(); const fresh=dataUsers().find(u=>(s.id&&S(u.id)===S(s.id))||(s.username&&S(u.username).toLowerCase()===S(s.username).toLowerCase())); return Object.assign({},s,fresh||{}, {permissions:(fresh&&fresh.permissions)||s.permissions}); }
  function exactPerms(user){ const u=user||currentUser(); const p=parsePerms(u.permissions); return hasExplicit(p)?p:defaults(u.role); }
  function isAdmin(user){ const u=user||currentUser(); return roleOf(u.role)==='admin' || S(u.username).toLowerCase()==='admin'; }
  function canPage(page,user){ if(isAdmin(user)) return true; const row=NAV.find(([id])=>id===page); if(!row) return true; const p=exactPerms(user); return (PAGE_ALIASES[page]||[row[1]]).some(k=>p[k]===true); }
  function firstAllowed(){ const u=currentUser(); const item=NAV.find(([id])=>canPage(id,u)); return item?item[0]:'dashboard'; }
  function pageFromButton(btn){ const m=S(btn&&btn.getAttribute('onclick')).match(/showPage\(['"]([^'"]+)['"]/); return m?m[1]:S(btn&&btn.dataset&&btn.dataset.page); }
  function brandHtml(side){ const brand=side.querySelector('.brand'); return brand?brand.outerHTML:'<div class="brand"><span>ت</span><div><b>شركة تصنيف</b><small>إدارة المرافق</small></div></div>'; }
  function ensureStyle(){ if($('sidebarLockStyleV10046')) return; const st=document.createElement('style'); st.id='sidebarLockStyleV10046'; st.textContent='.side[data-permission-lock-v44="1"] .nav{display:block!important}.side[data-permission-lock-v44="1"] .nav[data-denied-v44="1"]{display:none!important}.side[data-permission-lock-v44="1"] .nav.danger{display:block!important}'; document.head.appendChild(st); }
  function directOpenPage(id,btn){
    const target=$(id); if(!target) return false;
    document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));
    target.classList.remove('hidden'); target.style.display=''; target.style.visibility=''; target.style.opacity='';
    document.querySelectorAll('.side .nav').forEach(n=>n.classList.remove('active'));
    const activeBtn=btn||[...document.querySelectorAll('.side .nav')].find(b=>pageFromButton(b)===id);
    activeBtn?.classList?.add('active');
    try{ if(id==='financeDashboard' && typeof window.financeProRenderAll==='function') window.financeProRenderAll(); }catch(_){}
    try{ if(id==='inventoryAudit' && window.tasneefInventoryAuditV10046?.load) setTimeout(()=>window.tasneefInventoryAuditV10046.load(),30); }catch(_){}
    setTimeout(rebuildSidebar,30); return true;
  }
  function rebuildSidebar(){
    const side=document.querySelector('.side'); if(!side) return; ensureStyle();
    const u=currentUser(); const active=document.querySelector('.page:not(.hidden)'); const activeId=active?.id||firstAllowed();
    const allowed=NAV.filter(([id])=>canPage(id,u));
    const buttons=allowed.map(([id,,label])=>`<button class="nav${id===activeId?' active':''}" data-page="${id}" onclick="showPage('${id}',this)">${label}</button>`).join('');
    side.dataset.permissionLockV44='1';
    side.innerHTML=brandHtml(side)+buttons+'<button class="nav danger" onclick="logout()">تسجيل خروج</button>';
    guardCurrentPage();
  }
  function guardCurrentPage(){ const active=document.querySelector('.page:not(.hidden)'); if(active&&active.id&&!canPage(active.id)){ const next=firstAllowed(); directOpenPage(next,[...document.querySelectorAll('.side .nav')].find(b=>pageFromButton(b)===next)); } }
  function wrapShowPage(){ const old=window.showPage; if(typeof old==='function' && old.__sidebarLockV10046) return; const original=(old&&old.__sidebarOriginalV44)||old; const wrapped=function(id,btn){ if(!canPage(id)){ try{ if(typeof msg==='function') msg('لا تملك صلاحية فتح هذا القسم','err'); }catch(_){} rebuildSidebar(); return; } if(id==='financeDashboard'){ let r; try{ r=original?.apply(this,arguments); }catch(_){} setTimeout(()=>{ if($(id)?.classList.contains('hidden')) directOpenPage(id,btn); rebuildSidebar(); },40); return r; } return directOpenPage(id,btn); }; wrapped.__sidebarLockV10046=true; wrapped.__sidebarOriginalV44=original; window.showPage=wrapped; try{ showPage=wrapped; }catch(_){} }
  function observe(){ const side=document.querySelector('.side'); if(!side||side.__sidebarObserverV10046) return; side.__sidebarObserverV10046=true; let t=null; new MutationObserver(()=>{ clearTimeout(t); t=setTimeout(()=>{wrapShowPage(); rebuildSidebar();},120); }).observe(side,{childList:true}); }
  function boot(){ wrapShowPage(); rebuildSidebar(); observe(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,80)); else setTimeout(boot,30);
  window.addEventListener('load',()=>{ setTimeout(boot,300); setTimeout(boot,1200); });
})();

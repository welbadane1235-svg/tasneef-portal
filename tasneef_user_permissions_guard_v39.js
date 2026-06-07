(function(){
  if(window.__tasneefUserPermissionsGuardV39) return;
  window.__tasneefUserPermissionsGuardV39 = true;

  const STORAGE_KEY = 'tasneef_manual_permissions_v39';
  const S = v => String(v ?? '').trim();
  const A = v => Array.isArray(v) ? v : [];

  const CORE_KEYS = [
    'can_dashboard','can_time_logs','can_projects','can_contracts','can_manage_workers',
    'can_attendance','can_monthly','can_tickets','can_orders','can_client_reports',
    'can_client_ratings','can_alerts','can_assistant','can_export','can_manage_users',
    'can_expenses_inventory','can_manage_inventory','can_inventory_requests',
    'can_edit_inventory_requests','can_delete_inventory_requests','can_journey',
    'can_reports','can_edit_time_logs'
  ];

  const PAGE_RULES = {
    dashboard: ['can_dashboard','tab_dashboard_view'],
    daily: ['can_time_logs','tab_daily_view'],
    users: ['can_manage_users','tab_users_view'],
    projects: ['can_projects','tab_projects_view'],
    contracts: ['can_contracts','tab_contracts_view'],
    workers: ['can_manage_workers','tab_workers_view'],
    attendance: ['can_attendance','tab_attendance_view'],
    monthly: ['can_monthly','tab_monthly_view'],
    tickets: ['can_tickets','tab_tickets_view'],
    orders: ['can_orders','tab_orders_view'],
    clientReports: ['can_client_reports','tab_clientReports_view','can_reports'],
    clientRatings: ['can_client_ratings','tab_clientRatings_view','can_reports'],
    alerts: ['can_alerts','tab_alerts_view'],
    assistant: ['can_assistant','tab_assistant_view'],
    export: ['can_export','tab_export_view'],
    financeDashboard: ['can_expenses_inventory','can_manage_inventory','tab_finance_summary_view']
  };

  const ROLE_DEFAULTS = {
    admin: Object.fromEntries(CORE_KEYS.map(k => [k, true])),
    financial_manager: {
      can_dashboard:true, can_orders:true, can_client_reports:true, can_client_ratings:true,
      can_alerts:true, can_export:true, can_reports:true, can_expenses_inventory:true,
      can_manage_inventory:true, can_inventory_requests:true,
      can_edit_inventory_requests:true, can_delete_inventory_requests:true
    },
    operations_manager: {
      can_dashboard:true, can_time_logs:true, can_projects:true, can_contracts:true,
      can_manage_workers:true, can_attendance:true, can_monthly:true, can_tickets:true,
      can_orders:true, can_client_reports:true, can_client_ratings:true, can_alerts:true,
      can_assistant:true, can_export:true, can_inventory_requests:true, can_journey:true,
      can_reports:true, can_edit_time_logs:true
    },
    warehouse_manager: {
      can_dashboard:true, can_expenses_inventory:true, can_manage_inventory:true,
      can_inventory_requests:true, can_edit_inventory_requests:true, can_delete_inventory_requests:true
    },
    supervisor: {
      can_dashboard:true, can_time_logs:true, can_attendance:true, can_tickets:true,
      can_inventory_requests:true, can_journey:true
    },
    technician: {
      can_dashboard:true, can_tickets:true, can_inventory_requests:true
    }
  };

  function normalizeRole(role){
    const r = S(role);
    const map = {
      general_manager:'admin',
      system_admin:'admin',
      'مدير عام':'admin',
      'مدير النظام':'admin',
      'مدير مالي':'financial_manager',
      'مدير تشغيلي':'operations_manager',
      'مدير مخازن':'warehouse_manager',
      'مدير مخزون':'warehouse_manager',
      'مشرف':'supervisor',
      'فني':'technician'
    };
    return map[r] || r || 'supervisor';
  }

  function parseJson(value){
    if(!value) return {};
    if(typeof value === 'object') return value || {};
    try{ return JSON.parse(value) || {}; }catch(_){ return {}; }
  }

  function readSession(){
    try{ return JSON.parse(localStorage.getItem('tasneef_user') || localStorage.getItem('tasneef_session') || '{}') || {}; }
    catch(_){ return {}; }
  }

  function users(){
    return A(window.data && window.data.users);
  }

  function matchCurrentUser(){
    const cur = readSession();
    const found = users().find(u =>
      (cur.id && S(u.id) === S(cur.id)) ||
      (cur.username && S(u.username).toLowerCase() === S(cur.username).toLowerCase())
    );
    return Object.assign({}, cur, found || {});
  }

  function backupKeyFor(user){
    const parts = [];
    if(user && user.id) parts.push('id:' + S(user.id));
    if(user && user.username) parts.push('user:' + S(user.username).toLowerCase());
    return parts;
  }

  function readBackup(user){
    const store = parseJson(localStorage.getItem(STORAGE_KEY));
    for(const key of backupKeyFor(user)){
      if(store[key]) return parseJson(store[key]);
    }
    return {};
  }

  function writeBackup(user, perms){
    const store = parseJson(localStorage.getItem(STORAGE_KEY));
    backupKeyFor(user).forEach(key => { store[key] = perms || {}; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function collectFormPerms(){
    const box = document.getElementById('userPermissionsBoxV72');
    const out = {};
    if(!box) return out;
    box.querySelectorAll('input[data-perm]').forEach(input => {
      out[input.dataset.perm] = !!input.checked;
    });
    return out;
  }

  function hasManualPerms(perms){
    return Object.keys(perms || {}).some(k =>
      CORE_KEYS.includes(k) || /^tab_[A-Za-z0-9]+_(view|add|edit|delete|print)$/.test(k)
    );
  }

  function permissionsFor(user){
    const fromBackup = readBackup(user);
    if(hasManualPerms(fromBackup)) return { perms: fromBackup, manual: true };
    const direct = parseJson(user && user.permissions);
    if(hasManualPerms(direct)) return { perms: direct, manual: true };
    return { perms: Object.assign({}, ROLE_DEFAULTS[normalizeRole(user && user.role)] || ROLE_DEFAULTS.supervisor), manual: false };
  }

  function allowedPage(page, user){
    const role = normalizeRole(user && user.role);
    if(role === 'admin') return true;
    const { perms } = permissionsFor(user);
    const keys = PAGE_RULES[page] || [];
    return keys.some(k => perms[k] === true);
  }

  function navPage(btn){
    const raw = S(btn && btn.getAttribute('onclick'));
    const m = raw.match(/showPage\(['"]([^'"]+)['"]/);
    return m && m[1] ? m[1] : '';
  }

  function firstAllowedNav(){
    const user = matchCurrentUser();
    return [...document.querySelectorAll('.side .nav[onclick*="showPage"]')]
      .find(btn => btn.style.display !== 'none' && allowedPage(navPage(btn), user));
  }

  function applySidebar(){
    const user = matchCurrentUser();
    const role = normalizeRole(user.role);
    document.querySelectorAll('.side .nav[onclick*="showPage"]').forEach(btn => {
      const page = navPage(btn);
      if(!page) return;
      btn.style.display = (role === 'admin' || allowedPage(page, user)) ? '' : 'none';
    });

    const active = document.querySelector('.page:not(.hidden)');
    if(active && active.id && role !== 'admin' && !allowedPage(active.id, user)){
      const next = firstAllowedNav();
      if(next && typeof window.showPage === 'function') window.showPage(navPage(next), next);
    }
  }

  function setFormChecksExact(perms){
    const box = document.getElementById('userPermissionsBoxV72');
    if(!box) return;
    box.querySelectorAll('input[data-perm]').forEach(input => {
      input.checked = perms[input.dataset.perm] === true;
    });
  }

  function formUserIdentity(){
    return {
      id: S(document.getElementById('userId')?.value),
      username: S(document.getElementById('userUsername')?.value),
      role: S(document.getElementById('userRole')?.value)
    };
  }

  function installSaveBackup(){
    if(window.__tasneefUserPermissionsSaveBackupV39) return;
    const oldSave = window.saveUser;
    if(typeof oldSave !== 'function') return;
    window.__tasneefUserPermissionsSaveBackupV39 = true;
    window.saveUser = async function(){
      const identity = formUserIdentity();
      const perms = collectFormPerms();
      if(hasManualPerms(perms)) writeBackup(identity, perms);
      const result = await oldSave.apply(this, arguments);
      const updated = formUserIdentity();
      if(hasManualPerms(perms)) writeBackup(Object.assign({}, identity, updated), perms);
      setTimeout(applySidebar, 150);
      return result;
    };
  }

  function installEditExact(){
    if(window.__tasneefUserPermissionsEditExactV39) return;
    const oldEdit = window.editUser;
    if(typeof oldEdit !== 'function') return;
    window.__tasneefUserPermissionsEditExactV39 = true;
    window.editUser = async function(id){
      const result = await oldEdit.apply(this, arguments);
      setTimeout(() => {
        const u = users().find(row => S(row.id) === S(id)) || formUserIdentity();
        const { perms, manual } = permissionsFor(u);
        if(manual) setFormChecksExact(perms);
      }, 120);
      return result;
    };
  }

  function installShowGuard(){
    if(window.__tasneefUserPermissionsShowGuardV39) return;
    const oldShow = window.showPage;
    if(typeof oldShow !== 'function') return;
    window.__tasneefUserPermissionsShowGuardV39 = true;
    window.showPage = function(id, btn){
      const user = matchCurrentUser();
      if(normalizeRole(user.role) !== 'admin' && !allowedPage(id, user)){
        applySidebar();
        const next = firstAllowedNav();
        if(next && navPage(next) !== id) return oldShow.call(this, navPage(next), next);
        return;
      }
      const result = oldShow.apply(this, arguments);
      setTimeout(applySidebar, 80);
      return result;
    };
  }

  function install(){
    installSaveBackup();
    installEditExact();
    installShowGuard();
    applySidebar();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(install, 350));
  else setTimeout(install, 100);
  window.addEventListener('load', () => {
    setTimeout(install, 700);
    setTimeout(install, 1800);
  });
  setInterval(applySidebar, 1200);
  try{
    new MutationObserver(() => setTimeout(applySidebar, 40))
      .observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['style','class'] });
  }catch(_){}
})();

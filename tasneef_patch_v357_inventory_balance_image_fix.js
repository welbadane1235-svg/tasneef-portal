(function(){
  'use strict';

  if (window.__tasneefPermissionsFixV7) return;
  window.__tasneefPermissionsFixV7 = true;

  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const A = v => Array.isArray(v) ? v : [];
  const toast = (text, type) => {
    try {
      if (typeof window.msg === 'function') window.msg(text, type);
      else alert(text);
    } catch (_) {
      alert(text);
    }
  };

  const CORE_KEYS = [
    'can_dashboard',
    'can_time_logs',
    'can_manage_users',
    'can_projects',
    'can_contracts',
    'can_manage_workers',
    'can_attendance',
    'can_monthly',
    'can_tickets',
    'can_client_reports',
    'can_client_ratings',
    'can_alerts',
    'can_assistant',
    'can_export',
    'can_expenses_inventory',
    'can_inventory_requests',
    'can_manage_inventory',
    'can_edit_inventory_requests',
    'can_delete_inventory_requests',
    'can_journey',
    'can_reports',
    'can_edit_time_logs'
  ];

  const TAB_TO_CORE = {
    overview: 'can_dashboard',
    expenses: 'can_expenses_inventory',
    inventory: 'can_manage_inventory',
    catalog: 'can_manage_inventory',
    movements: 'can_manage_inventory',
    requests: 'can_inventory_requests',
    reports: 'can_client_reports',
    costCenters: 'can_expenses_inventory',
    suppliers: 'can_manage_inventory',
    users: 'can_manage_users',
    workers: 'can_manage_workers',
    tickets: 'can_tickets',
    attendance: 'can_attendance',
    time_logs: 'can_time_logs',
    monthly: 'can_monthly'
  };

  function parsePerms(value){
    if (!value) return {};
    if (typeof value === 'string') {
      try { return JSON.parse(value || '{}') || {}; } catch (_) { return {}; }
    }
    return value || {};
  }

  function allCore(value){
    return Object.fromEntries(CORE_KEYS.map(key => [key, !!value]));
  }

  function roleDefaults(role){
    const r = normalizeRole(role, 'supervisor');
    if (r === 'admin' || r === 'general_manager') return allCore(true);
    if (r === 'financial_manager') {
      return {
        can_dashboard: true,
        can_client_reports: true,
        can_client_ratings: true,
        can_expenses_inventory: true,
        can_inventory_requests: true,
        can_export: true,
        can_reports: true
      };
    }
    if (r === 'operations_manager') {
      return {
        can_dashboard: true,
        can_time_logs: true,
        can_projects: true,
        can_contracts: true,
        can_manage_workers: true,
        can_attendance: true,
        can_monthly: true,
        can_tickets: true,
        can_client_reports: true,
        can_client_ratings: true,
        can_expenses_inventory: true,
        can_inventory_requests: true,
        can_alerts: true,
        can_assistant: true,
        can_export: true,
        can_journey: true,
        can_reports: true,
        can_edit_time_logs: true
      };
    }
    if (r === 'warehouse_manager') {
      return {
        can_dashboard: true,
        can_expenses_inventory: true,
        can_inventory_requests: true,
        can_manage_inventory: true,
        can_edit_inventory_requests: true,
        can_delete_inventory_requests: true
      };
    }
    if (r === 'technician') return { can_dashboard: true, can_tickets: true, can_inventory_requests: true };
    return {
      can_dashboard: true,
      can_time_logs: true,
      can_attendance: true,
      can_tickets: true,
      can_inventory_requests: true,
      can_journey: true
    };
  }

  function normalizeRole(value, fallback){
    const x = S(value || fallback);
    const map = {
      admin: 'admin',
      system_admin: 'admin',
      general_manager: 'general_manager',
      financial_manager: 'financial_manager',
      operations_manager: 'operations_manager',
      warehouse_manager: 'warehouse_manager',
      supervisor: 'supervisor',
      technician: 'technician',
      'مدير عام': 'admin',
      'مدير النظام': 'admin',
      'مدير مالي': 'financial_manager',
      'مدير تشغيلي': 'operations_manager',
      'مدير مخازن': 'warehouse_manager',
      'مشرف': 'supervisor',
      'فني': 'technician'
    };
    return map[x] || x || 'supervisor';
  }

  function safeDbRole(role){
    const r = normalizeRole(role, 'supervisor');
    if (['admin', 'supervisor', 'technician'].includes(r)) return r;
    return /manager|admin|مدير/i.test(r) ? 'admin' : 'supervisor';
  }

  function hasExplicitPerms(user){
    return Object.keys(parsePerms(user && user.permissions)).some(key => /^can_|^tab_/.test(key));
  }

  function effectivePerms(user){
    const u = user || {};
    const explicit = parsePerms(u.permissions);
    const base = Object.assign({}, roleDefaults(u.role), explicit);
    if (base.can_reports === true) {
      base.can_client_reports = true;
      base.can_client_ratings = true;
    }
    if (base.can_journey === true) base.can_dashboard = true;
    if (base.can_edit_time_logs === true) base.can_time_logs = true;
    return base;
  }

  function tabFallback(key, base){
    const match = key.match(/^tab_(.+)_(view|add|edit|delete|print)$/);
    if (!match) return undefined;
    const tab = match[1];
    const action = match[2];
    if (tab === 'requests' && action === 'edit') return !!base.can_edit_inventory_requests;
    if (tab === 'requests' && action === 'delete') return !!base.can_delete_inventory_requests;
    if (tab === 'time_logs' && (action === 'edit' || action === 'delete')) return !!base.can_edit_time_logs;
    return !!base[TAB_TO_CORE[tab]];
  }

  function checkboxInputs(){
    const box = $('userPermissionsBoxV72');
    const scoped = box ? A([...box.querySelectorAll('input[data-perm]')]) : [];
    return scoped.length ? scoped : A([...document.querySelectorAll('input[data-perm]')]);
  }

  function setChecksFromUser(user){
    const inputs = checkboxInputs();
    if (!inputs.length || !user) return;
    const explicit = parsePerms(user.permissions);
    const base = effectivePerms(user);
    const useRoleDefaults = !hasExplicitPerms(user);

    inputs.forEach(input => {
      const key = input.dataset && input.dataset.perm;
      if (!key) return;
      if (Object.prototype.hasOwnProperty.call(explicit, key)) {
        input.checked = !!explicit[key];
        return;
      }
      const tabValue = tabFallback(key, base);
      if (tabValue !== undefined) {
        input.checked = tabValue;
        return;
      }
      input.checked = useRoleDefaults ? !!base[key] : !!base[key];
    });
  }

  function localUsers(){
    return A(window.data && (window.data.users || window.data.appUsers));
  }

  function localUserById(id){
    return localUsers().find(user => S(user.id) === S(id)) || null;
  }

  async function fetchUserById(id){
    const local = localUserById(id);
    if (local && local.permissions !== undefined) return local;
    if (!id || !window.sb) return local;
    try {
      const res = await window.sb.from('app_users').select('*').eq('id', id).maybeSingle();
      if (res && !res.error && res.data) return res.data;
    } catch (_) {}
    return local;
  }

  async function hydrateEditingPermissions(id){
    const userId = S(id || $('userId')?.value);
    if (!userId) return;
    const user = await fetchUserById(userId);
    if (user) setChecksFromUser(user);
  }

  function collectShownPerms(existing){
    const merged = Object.assign({}, existing || {});
    const inputs = checkboxInputs();
    inputs.forEach(input => {
      const key = input.dataset && input.dataset.perm;
      if (key) merged[key] = !!input.checked;
    });
    return merged;
  }

  function updateStoredSession(updated){
    try {
      const raw = localStorage.getItem('tasneef_user');
      const current = raw ? JSON.parse(raw) : null;
      if (current && (S(current.id) === S(updated.id) || S(current.username) === S(updated.username))) {
        localStorage.setItem('tasneef_user', JSON.stringify(Object.assign({}, current, updated)));
      }
    } catch (_) {}
    try {
      const raw = localStorage.getItem('tasneef_session');
      const current = raw ? JSON.parse(raw) : null;
      if (current && (S(current.id) === S(updated.id) || S(current.username) === S(updated.username))) {
        localStorage.setItem('tasneef_session', JSON.stringify(Object.assign({}, current, updated)));
      }
    } catch (_) {}
  }

  function updateLocalUser(updated){
    const rows = localUsers();
    const idx = rows.findIndex(user => S(user.id) === S(updated.id));
    if (idx >= 0) rows[idx] = Object.assign({}, rows[idx], updated);
  }

  async function writeUser(row, id){
    if (!window.sb) throw new Error('Supabase غير متصل');
    return id
      ? await window.sb.from('app_users').update(row).eq('id', id).select('*').maybeSingle()
      : await window.sb.from('app_users').insert(row).select('*').maybeSingle();
  }

  const previousEditUser = window.editUser;
  if (typeof previousEditUser === 'function') {
    window.editUser = function(id){
      const result = previousEditUser.apply(this, arguments);
      setTimeout(() => hydrateEditingPermissions(id), 80);
      setTimeout(() => hydrateEditingPermissions(id), 250);
      return result;
    };
  }

  const previousClearUserForm = window.clearUserForm;
  if (typeof previousClearUserForm === 'function') {
    window.clearUserForm = function(){
      const result = previousClearUserForm.apply(this, arguments);
      setTimeout(() => setChecksFromUser({ role: $('userRole')?.value || 'supervisor', permissions: {} }), 80);
      return result;
    };
  }

  window.saveUser = async function(){
    const id = S($('userId')?.value);
    const oldUser = id ? await fetchUserById(id) : null;
    const role = normalizeRole($('userRole')?.value, oldUser && oldUser.role);
    const existingPerms = parsePerms(oldUser && oldUser.permissions);
    const permissions = collectShownPerms(existingPerms);
    const row = {
      full_name: S($('userFullName')?.value),
      username: S($('userUsername')?.value),
      password: S($('userPassword')?.value) || S(oldUser && oldUser.password) || '123456',
      role,
      is_active: S($('userActive')?.value || 'true') === 'true',
      permissions
    };

    if (!row.full_name || !row.username) return toast('الاسم واسم المستخدم مطلوبان', 'err');

    let res = await writeUser(row, id);
    if (res.error && /role_check|constraint/i.test(String(res.error.message || ''))) {
      res = await writeUser(Object.assign({}, row, { role: safeDbRole(role) }), id);
    }
    if (res.error) {
      return toast('لم يتم حفظ التعديل: ' + (res.error.message || String(res.error)), 'err');
    }

    const saved = res.data || Object.assign({ id: id || undefined }, row);
    updateLocalUser(saved);
    updateStoredSession(saved);

    toast('تم حفظ صلاحيات المستخدم المحدد فقط');
    try { if (typeof window.refreshAll === 'function') await window.refreshAll(); } catch (_) {}
    try { if (typeof window.clearUserForm === 'function') window.clearUserForm(); } catch (_) {}
  };

  document.addEventListener('click', event => {
    const target = event.target && event.target.closest && event.target.closest('button[onclick^="editUser"]');
    if (!target) return;
    const call = target.getAttribute('onclick') || '';
    const match = call.match(/editUser\(([^)]+)\)/);
    if (match) setTimeout(() => hydrateEditingPermissions(match[1].replace(/['"]/g, '')), 180);
  }, true);

  console.log('Tasneef permissions fix v7 loaded');
})();

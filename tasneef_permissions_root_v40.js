(function(){
  'use strict';
  if(window.__tasneefPermissionsRootV40) return;
  window.__tasneefPermissionsRootV40 = true;

  const S = v => String(v ?? '').trim();
  const A = v => Array.isArray(v) ? v : [];
  const $ = id => document.getElementById(id);
  const toast = (text,type) => {
    try{ if(typeof window.msg === 'function') window.msg(text,type); else alert(text); }
    catch(_){ alert(text); }
  };

  const CORE = [
    ['can_dashboard','لوحة التحكم','عام'],
    ['can_time_logs','التسجيلات اليومية','تشغيل'],
    ['can_manage_users','إدارة المستخدمين','إدارة'],
    ['can_projects','المشاريع','تشغيل'],
    ['can_contracts','العقود والخدمات','تشغيل'],
    ['can_manage_workers','العمال','تشغيل'],
    ['can_attendance','الحضور والغياب','تشغيل'],
    ['can_monthly','الأوقات الشهرية','تشغيل'],
    ['can_tickets','التكتات','تشغيل'],
    ['can_orders','الأوردرات','تشغيل'],
    ['can_client_reports','تقارير العملاء','تقارير'],
    ['can_client_ratings','تقييمات العملاء','تقارير'],
    ['can_alerts','التنبيهات','عام'],
    ['can_assistant','مساعد تصنيف','عام'],
    ['can_export','التصدير والاستيراد','عام'],
    ['can_expenses_inventory','المالية والمخزون','مالية ومخزون'],
    ['can_manage_inventory','إدارة المخزون','مالية ومخزون'],
    ['can_inventory_requests','طلبات الصرف','مالية ومخزون'],
    ['can_edit_inventory_requests','تعديل طلبات الصرف','مالية ومخزون'],
    ['can_delete_inventory_requests','حذف طلبات الصرف','مالية ومخزون'],
    ['can_journey','رحلة التشغيل اليومية','تشغيل'],
    ['can_reports','الملخص والتقارير','تقارير'],
    ['can_edit_time_logs','تعديل السجلات اليومية','تشغيل']
  ];
  const CORE_KEYS = CORE.map(x => x[0]);
  const ACTIONS = [['view','مشاهدة'],['add','إضافة'],['edit','تعديل'],['delete','حذف'],['print','طباعة/تصدير']];
  const TABS = [
    ['dashboard','لوحة التحكم','can_dashboard'],
    ['daily','التسجيلات اليومية','can_time_logs'],
    ['users','إدارة المستخدمين','can_manage_users'],
    ['projects','المشاريع','can_projects'],
    ['contracts','العقود والخدمات','can_contracts'],
    ['workers','العمال','can_manage_workers'],
    ['attendance','الحضور والغياب','can_attendance'],
    ['monthly','الأوقات الشهرية','can_monthly'],
    ['tickets','التكتات','can_tickets'],
    ['orders','الأوردرات','can_orders'],
    ['clientReports','تقارير العملاء','can_client_reports'],
    ['clientRatings','تقييمات العملاء','can_client_ratings'],
    ['alerts','التنبيهات','can_alerts'],
    ['assistant','مساعد تصنيف','can_assistant'],
    ['export','التصدير والاستيراد','can_export'],
    ['financeDashboard','المالية والمخزون','can_expenses_inventory'],
    ['finance_summary','المالية: الملخص','can_expenses_inventory'],
    ['finance_products','المالية: المنتجات','can_manage_inventory'],
    ['finance_suppliers','المالية: الموردين','can_manage_inventory'],
    ['finance_add','المالية: إضافة للمخزون','can_manage_inventory'],
    ['finance_movement','المالية: حركة المخزون','can_manage_inventory'],
    ['finance_cost','المالية: مركز التكلفة','can_expenses_inventory'],
    ['finance_reports','المالية: التقارير','can_expenses_inventory']
  ];
  const PAGE_CORE = Object.fromEntries(TABS.filter(t => !t[0].startsWith('finance_')).map(([page,,core]) => [page, core]));
  const FINANCE_TAB_CORE = {
    summary:'can_expenses_inventory',
    products:'can_manage_inventory',
    suppliers:'can_manage_inventory',
    add:'can_manage_inventory',
    movement:'can_manage_inventory',
    cost:'can_expenses_inventory',
    reports:'can_expenses_inventory',
    overview:'can_expenses_inventory',
    catalog:'can_manage_inventory',
    inventory:'can_manage_inventory',
    movements:'can_manage_inventory',
    requests:'can_inventory_requests',
    costCenters:'can_expenses_inventory',
    items:'can_manage_inventory'
  };

  const ROLE_LABELS = [
    ['admin','مدير النظام'],
    ['financial_manager','مدير مالي'],
    ['operations_manager','مدير تشغيلي'],
    ['warehouse_manager','مدير مخزون'],
    ['supervisor','مشرف'],
    ['technician','فني']
  ];

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
  function parsePerms(value){
    if(!value) return {};
    if(typeof value === 'object') return value || {};
    try{ return JSON.parse(value) || {}; }catch(_){ return {}; }
  }
  function hasSavedPerms(perms){
    return Object.keys(perms || {}).some(k => CORE_KEYS.includes(k) || /^tab_/.test(k));
  }
  function roleDefaults(role){
    const r = normalizeRole(role);
    const out = {};
    const set = keys => keys.forEach(k => out[k] = true);
    if(r === 'admin'){ CORE_KEYS.forEach(k => out[k] = true); TABS.forEach(([tab]) => ACTIONS.forEach(([a]) => out[`tab_${tab}_${a}`] = true)); return out; }
    if(r === 'financial_manager') set(['can_dashboard','can_orders','can_client_reports','can_client_ratings','can_alerts','can_export','can_reports','can_expenses_inventory','can_manage_inventory','can_inventory_requests','can_edit_inventory_requests','can_delete_inventory_requests']);
    else if(r === 'operations_manager') set(['can_dashboard','can_time_logs','can_projects','can_contracts','can_manage_workers','can_attendance','can_monthly','can_tickets','can_orders','can_client_reports','can_client_ratings','can_alerts','can_assistant','can_export','can_inventory_requests','can_journey','can_reports','can_edit_time_logs']);
    else if(r === 'warehouse_manager') set(['can_dashboard','can_expenses_inventory','can_manage_inventory','can_inventory_requests','can_edit_inventory_requests','can_delete_inventory_requests']);
    else if(r === 'technician') set(['can_dashboard','can_tickets','can_inventory_requests']);
    else set(['can_dashboard','can_time_logs','can_attendance','can_tickets','can_inventory_requests','can_journey']);
    TABS.forEach(([tab,,core]) => { if(out[core]) ACTIONS.forEach(([a]) => out[`tab_${tab}_${a}`] = true); });
    return out;
  }
  function exactPerms(user){
    const direct = parsePerms(user && user.permissions);
    if(hasSavedPerms(direct)) return direct;
    return roleDefaults(user && user.role);
  }
  function currentSession(){
    try{ return JSON.parse(localStorage.getItem('tasneef_user') || '{}') || {}; }catch(_){ return {}; }
  }
  function localUsers(){
    return A(window.data && window.data.users);
  }
  function currentUser(){
    const s = currentSession();
    const fresh = localUsers().find(u =>
      (s.id && S(u.id) === S(s.id)) ||
      (s.username && S(u.username).toLowerCase() === S(s.username).toLowerCase())
    );
    return Object.assign({}, s, fresh || {});
  }
  function isSystemAdmin(user){
    const u = user || currentUser();
    return normalizeRole(u.role) === 'admin' || S(u.username).toLowerCase() === 'admin';
  }
  function can(key, user){
    const u = user || currentUser();
    if(isSystemAdmin(u)) return true;
    return exactPerms(u)[key] === true;
  }
  window.tasneefCanV201 = can;
  window.tasneefCanV40 = can;

  function canPage(page, user){
    if(isSystemAdmin(user)) return true;
    const core = PAGE_CORE[page];
    if(!core) return true;
    const perms = exactPerms(user || currentUser());
    return perms[core] === true || perms[`tab_${page}_view`] === true;
  }
  function pageFromNav(btn){
    const raw = S(btn && btn.getAttribute('onclick'));
    const m = raw.match(/showPage\(['"]([^'"]+)['"]/);
    return m ? m[1] : '';
  }
  function firstAllowedNav(){
    const u = currentUser();
    return [...document.querySelectorAll('.side .nav[onclick*="showPage"]')]
      .find(btn => btn.style.display !== 'none' && canPage(pageFromNav(btn), u));
  }
  function applySideNav(){
    const u = currentUser();
    document.querySelectorAll('.side .nav[onclick*="showPage"]').forEach(btn => {
      const page = pageFromNav(btn);
      if(!page) return;
      btn.style.display = canPage(page, u) ? '' : 'none';
    });
    const visible = document.querySelector('.page:not(.hidden)');
    if(visible && visible.id && !canPage(visible.id, u)){
      const next = firstAllowedNav();
      if(next && typeof window.showPage === 'function') window.showPage(pageFromNav(next), next);
    }
  }

  function financeTabKey(btn){
    const raw = S(btn && btn.getAttribute('onclick'));
    let m = raw.match(/financeShowTab\(['"]([^'"]+)['"]/);
    if(m) return m[1];
    m = raw.match(/showTabPage\(['"]([^'"]+)['"]/);
    if(m) return m[1];
    const text = S(btn && btn.textContent).replace(/\s+/g,' ');
    if(/ملخص/.test(text)) return 'summary';
    if(/منتجات|الأصناف|اصناف/.test(text)) return 'products';
    if(/الموردين/.test(text)) return 'suppliers';
    if(/إضافة|اضافة/.test(text)) return 'add';
    if(/حركة|صرف/.test(text)) return 'movement';
    if(/تكلفة/.test(text)) return 'cost';
    if(/تقارير/.test(text)) return 'reports';
    return '';
  }
  function canFinanceTab(key){
    if(!key) return true;
    const core = FINANCE_TAB_CORE[key] || FINANCE_TAB_CORE[key.replace('finance_','')];
    if(!core) return true;
    const p = exactPerms(currentUser());
    return p[core] === true || p[`tab_finance_${key}_view`] === true || p[`tab_${key}_view`] === true;
  }
  function applyFinanceTabs(){
    document.querySelectorAll('#financeDashboard .finance-tabs button, #financeDashboard .finance-tab').forEach(btn => {
      const key = financeTabKey(btn);
      if(!key) return;
      btn.style.display = canFinanceTab(key) ? '' : 'none';
    });
  }
  function applyAllPermissions(){
    applySideNav();
    applyFinanceTabs();
  }

  function ensureBox(){
    const box = $('userPermissionsBoxV72');
    if(!box || box.dataset.rootV40) return;
    box.dataset.rootV40 = '1';
    const groups = [...new Set(CORE.map(x => x[2]))];
    const coreHtml = groups.map(group => `<section class="perm-root-group-v40"><h4>${group}</h4>${
      CORE.filter(x => x[2] === group).map(([key,label]) => `<label><span>${label}</span><input type="checkbox" data-perm="${key}" id="perm_${key}"></label>`).join('')
    }</section>`).join('');
    const matrix = TABS.map(([tab,label]) => `<tr><td>${label}</td>${ACTIONS.map(([a]) => `<td><input type="checkbox" data-perm="tab_${tab}_${a}" id="perm_tab_${tab}_${a}"></td>`).join('')}</tr>`).join('');
    box.innerHTML = `
      <label>الصلاحيات</label>
      <div class="perm-root-actions-v40">
        <button type="button" class="light" id="permRoleV40">صلاحيات الدور</button>
        <button type="button" class="light" id="permAllV40">تحديد الكل</button>
        <button type="button" class="light" id="permNoneV40">إلغاء الكل</button>
      </div>
      <div class="perm-root-groups-v40">${coreHtml}</div>
      <h3>صلاحيات الأقسام والأزرار</h3>
      <div class="perm-root-table-wrap-v40"><table class="perm-root-table-v40"><thead><tr><th>القسم</th>${ACTIONS.map(([,l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${matrix}</tbody></table></div>
      <div class="footer-note">المربعات المحددة فقط هي التي تظهر وتعمل للمستخدم. غير المحدد ممنوع حتى لو كان الدور مديرًا ماليًا أو تشغيليًا.</div>
    `;
    $('permRoleV40')?.addEventListener('click', () => setFormPerms(roleDefaults($('userRole')?.value)));
    $('permAllV40')?.addEventListener('click', () => box.querySelectorAll('input[data-perm]').forEach(i => i.checked = true));
    $('permNoneV40')?.addEventListener('click', () => box.querySelectorAll('input[data-perm]').forEach(i => i.checked = false));
  }
  function ensureStyle(){
    if($('permRootStyleV40')) return;
    const st = document.createElement('style');
    st.id = 'permRootStyleV40';
    st.textContent = `
      #userPermissionsBoxV72{max-height:none!important;overflow:visible!important}
      .perm-root-actions-v40{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
      .perm-root-groups-v40{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}
      .perm-root-group-v40{border:1px solid #dbeae5;border-radius:14px;background:#fbfffd;padding:10px}
      .perm-root-group-v40 h4{margin:0 0 8px;color:#064534}
      .perm-root-group-v40 label{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #edf4f1;padding:6px 0;margin:0;color:#064534}
      .perm-root-group-v40 label:last-child{border-bottom:0}
      .perm-root-table-wrap-v40{max-height:360px;overflow:auto;border:1px solid #dbeae5;border-radius:14px;background:#fff;margin-top:8px}
      .perm-root-table-v40{width:100%;border-collapse:collapse;font-size:12px}
      .perm-root-table-v40 th{position:sticky;top:0;background:#064534;color:white;padding:8px;z-index:1}
      .perm-root-table-v40 td{border:1px solid #e4f0ec;padding:7px;text-align:center}
      .perm-root-table-v40 td:first-child{text-align:right;background:#f7fbfa;font-weight:800;color:#064534}
    `;
    document.head.appendChild(st);
  }
  function ensureRoleOptions(){
    const sel = $('userRole');
    if(!sel) return;
    const old = S(sel.value);
    sel.innerHTML = ROLE_LABELS.map(([v,l]) => `<option value="${v}">${l}</option>`).join('');
    sel.value = ROLE_LABELS.some(([v]) => v === old) ? old : 'supervisor';
    if(!sel.dataset.rootV40){
      sel.dataset.rootV40 = '1';
      sel.addEventListener('change', () => { if(!$('userId')?.value) setFormPerms(roleDefaults(sel.value)); });
    }
  }
  function formInputs(){
    const box = $('userPermissionsBoxV72');
    return box ? [...box.querySelectorAll('input[data-perm]')] : [];
  }
  function setFormPerms(perms){
    const p = perms || {};
    formInputs().forEach(input => input.checked = p[input.dataset.perm] === true);
  }
  function collectFormPerms(){
    const out = {};
    formInputs().forEach(input => out[input.dataset.perm] = !!input.checked);
    return out;
  }
  function editUserFromLocal(id){
    return localUsers().find(u => S(u.id) === S(id)) || null;
  }
  async function fetchUser(id){
    const local = editUserFromLocal(id);
    if(local && local.permissions !== undefined) return local;
    if(!id || !window.sb) return local;
    try{
      const res = await window.sb.from('app_users').select('*').eq('id', id).maybeSingle();
      if(res && !res.error && res.data) return res.data;
    }catch(_){}
    return local;
  }
  function updateLocal(user){
    const rows = localUsers();
    const i = rows.findIndex(u => S(u.id) === S(user.id));
    if(i >= 0) rows[i] = Object.assign({}, rows[i], user);
  }
  function updateSessionIfCurrent(user){
    const cur = currentSession();
    if((cur.id && S(cur.id) === S(user.id)) || (cur.username && S(cur.username).toLowerCase() === S(user.username).toLowerCase())){
      localStorage.setItem('tasneef_user', JSON.stringify(Object.assign({}, cur, user)));
    }
  }
  window.clearUserForm = function(){
    ['userId','userFullName','userUsername','userPassword'].forEach(id => { if($(id)) $(id).value = ''; });
    ensureRoleOptions();
    if($('userRole')) $('userRole').value = 'supervisor';
    if($('userActive')) $('userActive').value = 'true';
    if($('userFormTitle')) $('userFormTitle').textContent = 'إضافة مستخدم';
    setFormPerms(roleDefaults('supervisor'));
  };
  window.editUser = async function(id){
    ensureStyle(); ensureBox(); ensureRoleOptions();
    const u = await fetchUser(id);
    if(!u) return;
    if($('userId')) $('userId').value = u.id || '';
    if($('userFullName')) $('userFullName').value = u.full_name || '';
    if($('userUsername')) $('userUsername').value = u.username || '';
    if($('userPassword')) $('userPassword').value = u.password || '';
    if($('userRole')) $('userRole').value = normalizeRole(u.role);
    if($('userActive')) $('userActive').value = String(u.is_active !== false);
    if($('userFormTitle')) $('userFormTitle').textContent = 'تعديل مستخدم';
    setFormPerms(exactPerms(u));
    $('userFullName')?.scrollIntoView({behavior:'smooth',block:'start'});
  };
  window.saveUser = async function(){
    ensureStyle(); ensureBox(); ensureRoleOptions();
    const id = S($('userId')?.value);
    const old = id ? await fetchUser(id) : null;
    const row = {
      full_name:S($('userFullName')?.value),
      username:S($('userUsername')?.value),
      password:S($('userPassword')?.value) || S(old?.password) || '123456',
      role:normalizeRole($('userRole')?.value || old?.role),
      is_active:S($('userActive')?.value || 'true') === 'true',
      permissions:collectFormPerms()
    };
    if(!row.full_name || !row.username) return toast('الاسم واسم المستخدم مطلوبان','err');
    if(!window.sb) return toast('قاعدة البيانات غير متصلة','err');
    const res = id
      ? await window.sb.from('app_users').update(row).eq('id', id).select('*').maybeSingle()
      : await window.sb.from('app_users').insert(row).select('*').maybeSingle();
    if(res.error) return toast('لم يتم حفظ الصلاحيات: ' + (res.error.message || String(res.error)),'err');
    const saved = res.data || Object.assign({id:id || Date.now()}, row);
    updateLocal(saved);
    updateSessionIfCurrent(saved);
    toast('تم حفظ الصلاحيات وتطبيقها على المستخدم المحدد فقط');
    try{ if(typeof window.refreshAll === 'function') await window.refreshAll(); }catch(_){}
    window.clearUserForm();
    applyAllPermissions();
  };
  window.renderUsers = function(){
    const body = $('usersBody');
    if(!body) return;
    const table = body.closest('table');
    const head = table && table.querySelector('thead');
    if(head) head.innerHTML = '<tr><th>الاسم</th><th>المستخدم</th><th>الدور</th><th>الحالة</th><th>الصلاحيات</th><th>إجراء</th></tr>';
    const roleLabel = role => ROLE_LABELS.find(([v]) => v === normalizeRole(role))?.[1] || role || '-';
    body.innerHTML = localUsers().map(u => {
      const p = exactPerms(u);
      const text = CORE.filter(([k]) => p[k]).map(([,label]) => label).slice(0,8).join('، ') || '-';
      return `<tr><td>${S(u.full_name)}</td><td>${S(u.username)}</td><td><span class="badge">${roleLabel(u.role)}</span></td><td><span class="badge ${u.is_active!==false?'green':'red'}">${u.is_active!==false?'نشط':'موقوف'}</span></td><td style="white-space:normal;min-width:260px">${text}</td><td class="row-actions"><button onclick="editUser(${Number(u.id)||0})">تعديل</button><button class="danger" onclick="deleteRow('app_users',${Number(u.id)||0})">حذف</button></td></tr>`;
    }).join('') || '<tr><td colspan="6">لا يوجد مستخدمون</td></tr>';
  };

  function installShowGuard(){
    const old = window.showPage;
    if(typeof old !== 'function' || old.__rootV40) return;
    const guarded = function(id, btn){
      if(!canPage(id, currentUser())){
        toast('لا تملك صلاحية فتح هذا القسم','err');
        applyAllPermissions();
        const next = firstAllowedNav();
        if(next && pageFromNav(next) !== id) return old.call(this, pageFromNav(next), next);
        return;
      }
      const r = old.apply(this, arguments);
      setTimeout(applyAllPermissions, 40);
      return r;
    };
    guarded.__rootV40 = true;
    window.showPage = guarded;
    try{ showPage = guarded; }catch(_){}
  }
  function install(){
    ensureStyle();
    ensureBox();
    ensureRoleOptions();
    installShowGuard();
    if($('userPermissionsBoxV72') && !$('userId')?.value) setFormPerms(roleDefaults($('userRole')?.value || 'supervisor'));
    try{ window.renderUsers(); }catch(_){}
    applyAllPermissions();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(install, 200));
  else setTimeout(install, 50);
  window.addEventListener('load', () => { setTimeout(install, 500); setTimeout(applyAllPermissions, 1400); });
  const loop = () => { applyAllPermissions(); setTimeout(loop, 900); };
  setTimeout(loop, 900);
  try{ new MutationObserver(() => setTimeout(applyAllPermissions, 30)).observe(document.body, {childList:true,subtree:true,attributes:true,attributeFilter:['class','style']}); }catch(_){}
})();

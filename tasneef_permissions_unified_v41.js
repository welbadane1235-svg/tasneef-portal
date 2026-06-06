(function(){
  'use strict';
  if(window.__tasneefPermissionsUnifiedV41) return;
  window.__tasneefPermissionsUnifiedV41 = true;

  const S = v => String(v ?? '').trim();
  const A = v => Array.isArray(v) ? v : [];
  const $ = id => document.getElementById(id);
  const say = (text,type) => { try{ if(typeof msg === 'function') msg(text,type); else alert(text); }catch(_){ alert(text); } };

  const SECTIONS = [
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
  const EXTRA = [
    ['can_manage_inventory','إدارة المخزون'],
    ['can_inventory_requests','طلبات الصرف'],
    ['can_edit_inventory_requests','تعديل طلبات الصرف'],
    ['can_delete_inventory_requests','حذف طلبات الصرف'],
    ['can_journey','رحلة التشغيل اليومية'],
    ['can_reports','الملخص والتقارير'],
    ['can_edit_time_logs','تعديل السجلات اليومية']
  ];
  const ACTIONS = [['view','مشاهدة'],['add','إضافة'],['edit','تعديل'],['delete','حذف'],['print','طباعة/تصدير']];
  const CORE_KEYS = SECTIONS.map(x => x[1]).concat(EXTRA.map(x => x[0]));

  function normalizeRole(role){
    const r = S(role);
    const map = {
      general_manager:'admin', system_admin:'admin',
      'مدير عام':'admin', 'مدير النظام':'admin',
      'مدير مالي':'financial_manager', 'مدير تشغيلي':'operations_manager',
      'مدير مخازن':'warehouse_manager', 'مدير مخزون':'warehouse_manager',
      'مشرف':'supervisor', 'فني':'technician'
    };
    return map[r] || r || 'supervisor';
  }
  function parse(value){
    if(!value) return {};
    if(typeof value === 'object') return value || {};
    try{ return JSON.parse(value) || {}; }catch(_){ return {}; }
  }
  function hasExplicit(perms){
    return Object.keys(perms || {}).some(k => CORE_KEYS.includes(k) || /^tab_/.test(k));
  }
  function defaults(role){
    const r = normalizeRole(role);
    const p = {};
    const set = keys => keys.forEach(k => p[k] = true);
    if(r === 'admin'){
      CORE_KEYS.forEach(k => p[k] = true);
      SECTIONS.forEach(([page]) => ACTIONS.forEach(([a]) => p[`tab_${page}_${a}`] = true));
      return p;
    }
    if(r === 'financial_manager') set(['can_dashboard','can_orders','can_client_reports','can_client_ratings','can_alerts','can_export','can_expenses_inventory','can_manage_inventory','can_inventory_requests','can_reports']);
    else if(r === 'operations_manager') set(['can_dashboard','can_time_logs','can_projects','can_contracts','can_manage_workers','can_attendance','can_monthly','can_tickets','can_orders','can_client_reports','can_client_ratings','can_alerts','can_assistant','can_export','can_journey','can_reports','can_edit_time_logs']);
    else if(r === 'warehouse_manager') set(['can_dashboard','can_expenses_inventory','can_manage_inventory','can_inventory_requests','can_edit_inventory_requests','can_delete_inventory_requests']);
    else if(r === 'technician') set(['can_dashboard','can_tickets','can_inventory_requests']);
    else set(['can_dashboard','can_time_logs','can_attendance','can_tickets','can_inventory_requests','can_journey']);
    SECTIONS.forEach(([page, core]) => { if(p[core]) ACTIONS.forEach(([a]) => p[`tab_${page}_${a}`] = true); });
    return p;
  }
  function exactPerms(user){
    const p = parse(user && user.permissions);
    return hasExplicit(p) ? p : defaults(user && user.role);
  }
  function sessionUser(){
    try{ return JSON.parse(localStorage.getItem('tasneef_user') || '{}') || {}; }catch(_){ return {}; }
  }
  function users(){ return A(window.data && window.data.users); }
  function currentUser(){
    const s = sessionUser();
    const fresh = users().find(u => (s.id && S(u.id) === S(s.id)) || (s.username && S(u.username).toLowerCase() === S(s.username).toLowerCase()));
    return Object.assign({}, s, fresh || {});
  }
  function isAdmin(user){
    const u = user || currentUser();
    return normalizeRole(u.role) === 'admin' || S(u.username).toLowerCase() === 'admin';
  }
  function canCore(core, user){
    if(isAdmin(user)) return true;
    return exactPerms(user || currentUser())[core] === true;
  }
  window.tasneefCanV40 = (key,user) => isAdmin(user || currentUser()) || exactPerms(user || currentUser())[key] === true;
  window.tasneefCanV201 = window.tasneefCanV40;

  function style(){
    if($('permUnifiedStyleV41')) return;
    const st = document.createElement('style');
    st.id = 'permUnifiedStyleV41';
    st.textContent = `
      #userPermissionsBoxV72{max-height:none!important;overflow:visible!important}
      .perm-u-actions{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
      .perm-u-note{background:#f8fcfa;border:1px dashed #c9ded7;border-radius:12px;padding:9px;color:#285047;margin-top:10px}
      .perm-u-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}
      .perm-u-card{background:#fff;border:1px solid #d9e9e3;border-radius:14px;padding:10px}
      .perm-u-top{display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #eef4f1;padding-bottom:8px;margin-bottom:8px;color:#064534;font-weight:900}
      .perm-u-actions-row{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
      .perm-u-actions-row label{margin:0;border:1px solid #e5efeb;border-radius:10px;padding:7px 4px;text-align:center;color:#064534;font-size:11px;background:#fbfffd}
      .perm-u-extra{margin-top:12px;border:1px solid #d9e9e3;border-radius:14px;padding:10px;background:#fbfffd}
      .perm-u-extra h4{margin:0 0 8px;color:#064534}
      .perm-u-extra .items{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:6px}
      .perm-u-extra label{display:flex;align-items:center;justify-content:space-between;margin:0;border:1px solid #e6f0ec;border-radius:10px;padding:8px;color:#064534;background:#fff}
    `;
    document.head.appendChild(st);
  }
  function ensureRoleOptions(){
    const sel = $('userRole');
    if(!sel) return;
    const old = S(sel.value);
    const roles = [['admin','مدير النظام'],['financial_manager','مدير مالي'],['operations_manager','مدير تشغيلي'],['warehouse_manager','مدير مخزون'],['supervisor','مشرف'],['technician','فني']];
    sel.innerHTML = roles.map(([v,l]) => `<option value="${v}">${l}</option>`).join('');
    sel.value = roles.some(([v]) => v === old) ? old : 'supervisor';
    if(!sel.dataset.unifiedV41){
      sel.dataset.unifiedV41 = '1';
      sel.addEventListener('change', () => { if(!$('userId')?.value) setChecks(defaults(sel.value)); });
    }
  }
  function rebuildBox(){
    const box = $('userPermissionsBoxV72');
    if(!box) return;
    style();
    box.innerHTML = `
      <label>الصلاحيات</label>
      <div class="perm-u-actions">
        <button type="button" class="light" id="permRoleU41">صلاحيات الدور</button>
        <button type="button" class="light" id="permAllU41">تحديد الكل</button>
        <button type="button" class="light" id="permNoneU41">إلغاء الكل</button>
      </div>
      <div class="perm-u-grid">
        ${SECTIONS.map(([page, core, label]) => `
          <section class="perm-u-card">
            <label class="perm-u-top"><span>${label}</span><input type="checkbox" data-perm="${core}" data-section-core="${core}"></label>
            <div class="perm-u-actions-row">
              ${ACTIONS.map(([a,l]) => `<label>${l}<br><input type="checkbox" data-perm="tab_${page}_${a}"></label>`).join('')}
            </div>
          </section>`).join('')}
      </div>
      <div class="perm-u-extra">
        <h4>صلاحيات إضافية</h4>
        <div class="items">${EXTRA.map(([k,l]) => `<label><span>${l}</span><input type="checkbox" data-perm="${k}"></label>`).join('')}</div>
      </div>
      <div class="perm-u-note">هذه نفس أقسام القائمة الجانبية. إذا لم تحدد القسم فلن يظهر في القائمة ولن يفتح للمستخدم.</div>
    `;
    $('permRoleU41')?.addEventListener('click', () => setChecks(defaults($('userRole')?.value)));
    $('permAllU41')?.addEventListener('click', () => inputs().forEach(i => i.checked = true));
    $('permNoneU41')?.addEventListener('click', () => inputs().forEach(i => i.checked = false));
    box.querySelectorAll('input[data-section-core]').forEach(coreInput => {
      coreInput.addEventListener('change', () => {
        const card = coreInput.closest('.perm-u-card');
        card?.querySelectorAll('.perm-u-actions-row input[data-perm]').forEach(i => i.checked = coreInput.checked);
      });
    });
  }
  function inputs(){
    return $('userPermissionsBoxV72') ? [...$('userPermissionsBoxV72').querySelectorAll('input[data-perm]')] : [];
  }
  function setChecks(perms){
    const p = perms || {};
    inputs().forEach(i => i.checked = p[i.dataset.perm] === true);
  }
  function collect(){
    const p = {};
    inputs().forEach(i => p[i.dataset.perm] = !!i.checked);
    return p;
  }
  async function fetchUser(id){
    const local = users().find(u => S(u.id) === S(id));
    if(local && local.permissions !== undefined) return local;
    if(!window.sb || !id) return local;
    try{ const r = await sb.from('app_users').select('*').eq('id',id).maybeSingle(); if(!r.error && r.data) return r.data; }catch(_){}
    return local;
  }
  function updateLocal(u){
    const rows = users();
    const i = rows.findIndex(x => S(x.id) === S(u.id));
    if(i >= 0) rows[i] = Object.assign({}, rows[i], u);
  }
  function updateSession(u){
    const cur = sessionUser();
    if((cur.id && S(cur.id) === S(u.id)) || (cur.username && S(cur.username).toLowerCase() === S(u.username).toLowerCase())){
      localStorage.setItem('tasneef_user', JSON.stringify(Object.assign({}, cur, u)));
    }
  }
  window.clearUserForm = function(){
    ['userId','userFullName','userUsername','userPassword'].forEach(id => { if($(id)) $(id).value = ''; });
    ensureRoleOptions();
    if($('userRole')) $('userRole').value = 'supervisor';
    if($('userActive')) $('userActive').value = 'true';
    if($('userFormTitle')) $('userFormTitle').textContent = 'إضافة مستخدم';
    rebuildBox();
    setChecks(defaults('supervisor'));
  };
  window.editUser = async function(id){
    ensureRoleOptions();
    rebuildBox();
    const u = await fetchUser(id);
    if(!u) return;
    if($('userId')) $('userId').value = u.id || '';
    if($('userFullName')) $('userFullName').value = u.full_name || '';
    if($('userUsername')) $('userUsername').value = u.username || '';
    if($('userPassword')) $('userPassword').value = u.password || '';
    if($('userRole')) $('userRole').value = normalizeRole(u.role);
    if($('userActive')) $('userActive').value = String(u.is_active !== false);
    if($('userFormTitle')) $('userFormTitle').textContent = 'تعديل مستخدم';
    setChecks(exactPerms(u));
    $('userFullName')?.scrollIntoView({behavior:'smooth',block:'start'});
  };
  window.saveUser = async function(){
    ensureRoleOptions();
    rebuildBox();
    const id = S($('userId')?.value);
    const old = id ? await fetchUser(id) : null;
    const row = {
      full_name:S($('userFullName')?.value),
      username:S($('userUsername')?.value),
      password:S($('userPassword')?.value) || S(old?.password) || '123456',
      role:normalizeRole($('userRole')?.value || old?.role),
      is_active:S($('userActive')?.value || 'true') === 'true',
      permissions:collect()
    };
    if(!row.full_name || !row.username) return say('الاسم واسم المستخدم مطلوبان','err');
    const r = id ? await sb.from('app_users').update(row).eq('id',id).select('*').maybeSingle() : await sb.from('app_users').insert(row).select('*').maybeSingle();
    if(r.error) return say('لم يتم حفظ الصلاحيات: ' + (r.error.message || String(r.error)),'err');
    const saved = r.data || Object.assign({id:id || Date.now()}, row);
    updateLocal(saved); updateSession(saved);
    say('تم حفظ الصلاحيات');
    try{ if(typeof refreshAll === 'function') await refreshAll(); }catch(_){}
    window.clearUserForm();
    applyPermissions();
  };
  window.renderUsers = function(){
    const b = $('usersBody');
    if(!b) return;
    const head = b.closest('table')?.querySelector('thead');
    if(head) head.innerHTML = '<tr><th>الاسم</th><th>المستخدم</th><th>الدور</th><th>الحالة</th><th>الأقسام المسموحة</th><th>إجراء</th></tr>';
    b.innerHTML = users().map(u => {
      const p = exactPerms(u);
      const allowed = SECTIONS.filter(([,core]) => p[core]).map(([, , label]) => label).join('، ') || '-';
      return `<tr><td>${S(u.full_name)}</td><td>${S(u.username)}</td><td><span class="badge">${S(u.role)}</span></td><td><span class="badge ${u.is_active!==false?'green':'red'}">${u.is_active!==false?'نشط':'موقوف'}</span></td><td style="white-space:normal;min-width:260px">${allowed}</td><td class="row-actions"><button onclick="editUser(${Number(u.id)||0})">تعديل</button><button class="danger" onclick="deleteRow('app_users',${Number(u.id)||0})">حذف</button></td></tr>`;
    }).join('') || '<tr><td colspan="6">لا يوجد مستخدمون</td></tr>';
  };
  function pageFromButton(btn){
    const m = S(btn?.getAttribute('onclick')).match(/showPage\(['"]([^'"]+)['"]/);
    return m ? m[1] : '';
  }
  function canPage(page){
    const sec = SECTIONS.find(([p]) => p === page);
    return !sec || canCore(sec[1]);
  }
  function applyPermissions(){
    document.querySelectorAll('.side .nav[onclick*="showPage"]').forEach(btn => {
      const page = pageFromButton(btn);
      if(page) btn.style.display = canPage(page) ? '' : 'none';
    });
    const active = document.querySelector('.page:not(.hidden)');
    if(active && active.id && !canPage(active.id)){
      const next = [...document.querySelectorAll('.side .nav[onclick*="showPage"]')].find(btn => btn.style.display !== 'none');
      if(next && typeof showPage === 'function') showPage(pageFromButton(next), next);
    }
  }
  function guardShowPage(){
    const old = window.showPage;
    if(typeof old !== 'function' || old.__unifiedV41) return;
    const wrapped = function(id, btn){
      if(!canPage(id)){ say('لا تملك صلاحية فتح هذا القسم','err'); applyPermissions(); return; }
      const r = old.apply(this, arguments);
      setTimeout(applyPermissions, 60);
      return r;
    };
    wrapped.__unifiedV41 = true;
    window.showPage = wrapped;
    try{ showPage = wrapped; }catch(_){}
  }
  function boot(){
    style(); ensureRoleOptions(); rebuildBox(); guardShowPage();
    if(!$('userId')?.value) setChecks(defaults($('userRole')?.value || 'supervisor'));
    try{ window.renderUsers(); }catch(_){}
    applyPermissions();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 250));
  else setTimeout(boot, 80);
  window.addEventListener('load', () => { setTimeout(boot, 800); setTimeout(applyPermissions, 1600); });
  setInterval(applyPermissions, 1000);
})();

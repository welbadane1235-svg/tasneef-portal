(function(){
  if(window.__tasneefUsersPermissionsStableV38) return;
  window.__tasneefUsersPermissionsStableV38 = true;

  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const A = v => Array.isArray(v) ? v : [];
  const esc = v => S(v).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const toast = (text,type)=>{ try{ if(typeof window.msg==='function') window.msg(text,type); else alert(text); }catch(e){ alert(text); } };

  const ROLES = [
    ['admin','مدير النظام'],
    ['financial_manager','مدير مالي'],
    ['operations_manager','مدير تشغيلي'],
    ['warehouse_manager','مدير مخزون'],
    ['supervisor','مشرف'],
    ['technician','فني']
  ];

  const CORE = [
    ['can_dashboard','لوحة التحكم','عام'],
    ['can_time_logs','التسجيلات اليومية','تشغيل'],
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
    ['can_manage_users','إدارة المستخدمين','إدارة'],
    ['can_expenses_inventory','المالية والمخزون','مالية ومخزون'],
    ['can_manage_inventory','إدارة المخزون','مالية ومخزون'],
    ['can_inventory_requests','طلبات الصرف','مالية ومخزون'],
    ['can_edit_inventory_requests','تعديل طلبات الصرف','مالية ومخزون'],
    ['can_delete_inventory_requests','حذف طلبات الصرف','مالية ومخزون'],
    ['can_journey','رحلة التشغيل اليومية','تشغيل'],
    ['can_reports','الملخص والتقارير','تقارير'],
    ['can_edit_time_logs','تعديل السجلات اليومية','تشغيل']
  ];

  const TABS = [
    ['dashboard','لوحة التحكم','can_dashboard'],
    ['daily','السجلات اليومية','can_time_logs'],
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
    ['finance_summary','المالية: الملخص','can_expenses_inventory'],
    ['finance_products','المالية: المنتجات','can_manage_inventory'],
    ['finance_suppliers','المالية: الموردين','can_manage_inventory'],
    ['finance_add','المالية: إضافة للمخزون','can_manage_inventory'],
    ['finance_movement','المالية: حركة المخزون','can_manage_inventory'],
    ['finance_cost','المالية: مركز التكلفة','can_expenses_inventory'],
    ['finance_reports','المالية: التقارير','can_expenses_inventory']
  ];
  const ACTIONS = [
    ['view','مشاهدة'],
    ['add','إضافة'],
    ['edit','تعديل'],
    ['delete','حذف'],
    ['print','طباعة/تصدير']
  ];

  function normalizeRole(role){
    const r=S(role);
    const map={
      system_admin:'admin',
      general_manager:'admin',
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
    if(typeof value === 'string'){ try{ return JSON.parse(value || '{}') || {}; }catch(e){ return {}; } }
    return value || {};
  }
  function allCore(value){
    const out={};
    CORE.forEach(([k])=>out[k]=!!value);
    return out;
  }
  function withTabs(perms, tabIds, actions){
    const out=Object.assign({}, perms || {});
    const tabSet=new Set(tabIds || []);
    const actionSet=new Set(actions || ACTIONS.map(a=>a[0]));
    TABS.forEach(([tab,,core])=>{
      if(tabSet.has('*') || tabSet.has(tab) || out[core]===true){
        actionSet.forEach(action=>out[`tab_${tab}_${action}`]=true);
      }
    });
    return out;
  }
  function roleDefaults(role){
    const r=normalizeRole(role);
    if(r==='admin') return withTabs(allCore(true), ['*'], ACTIONS.map(a=>a[0]));
    if(r==='financial_manager'){
      return withTabs({
        can_dashboard:true, can_orders:true, can_client_reports:true, can_client_ratings:true,
        can_alerts:true, can_export:true, can_reports:true,
        can_expenses_inventory:true, can_inventory_requests:true, can_manage_inventory:true,
        can_edit_inventory_requests:true, can_delete_inventory_requests:true
      }, ['dashboard','orders','clientReports','clientRatings','alerts','export','finance_summary','finance_products','finance_suppliers','finance_add','finance_movement','finance_cost','finance_reports'], ACTIONS.map(a=>a[0]));
    }
    if(r==='operations_manager'){
      return withTabs({
        can_dashboard:true, can_time_logs:true, can_projects:true, can_contracts:true,
        can_manage_workers:true, can_attendance:true, can_monthly:true, can_tickets:true,
        can_orders:true, can_client_reports:true, can_client_ratings:true, can_alerts:true,
        can_assistant:true, can_export:true, can_inventory_requests:true, can_journey:true,
        can_reports:true, can_edit_time_logs:true
      }, ['dashboard','daily','projects','contracts','workers','attendance','monthly','tickets','orders','clientReports','clientRatings','alerts','assistant','export'], ACTIONS.map(a=>a[0]));
    }
    if(r==='warehouse_manager'){
      return withTabs({
        can_dashboard:true, can_expenses_inventory:true, can_inventory_requests:true,
        can_manage_inventory:true, can_edit_inventory_requests:true, can_delete_inventory_requests:true
      }, ['dashboard','finance_products','finance_movement'], ACTIONS.map(a=>a[0]));
    }
    if(r==='technician'){
      return withTabs({
        can_dashboard:true, can_tickets:true, can_inventory_requests:true
      }, ['dashboard','tickets'], ['view','add','edit']);
    }
    return withTabs({
      can_dashboard:true, can_time_logs:true, can_attendance:true, can_tickets:true,
      can_inventory_requests:true, can_journey:true
    }, ['dashboard','daily','attendance','tickets'], ['view','add','edit','print']);
  }
  function effectivePerms(user){
    const base=roleDefaults(user && user.role);
    const explicit=parsePerms(user && user.permissions);
    const out=Object.assign({}, base, explicit);
    if(out.can_reports){ out.can_client_reports=true; out.can_client_ratings=true; }
    if(out.can_journey) out.can_dashboard=true;
    if(out.can_edit_time_logs) out.can_time_logs=true;
    return out;
  }
  function localUsers(){
    return A(window.data && window.data.users);
  }
  function userById(id){
    return localUsers().find(u=>S(u.id)===S(id)) || null;
  }
  async function fetchUser(id){
    const local=userById(id);
    if(local && local.permissions !== undefined) return local;
    if(!id || !window.sb) return local;
    try{
      const res=await window.sb.from('app_users').select('*').eq('id', id).maybeSingle();
      if(res && !res.error && res.data) return res.data;
    }catch(e){}
    return local;
  }
  function ensureStyle(){
    if($('usersPermStableStyleV38')) return;
    const st=document.createElement('style');
    st.id='usersPermStableStyleV38';
    st.textContent=`
      #userPermissionsBoxV72{max-height:none!important;overflow:visible!important}
      .user-perm-toolbar-v38{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
      .user-perm-groups-v38{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-bottom:12px}
      .user-perm-group-v38{border:1px solid #d7e8e1;border-radius:14px;padding:10px;background:#fbfffd}
      .user-perm-group-v38 h4{margin:0 0 8px;color:#064534}
      .user-perm-item-v38{display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid #edf4f1;padding:6px 0;color:#064534}
      .user-perm-item-v38:last-child{border-bottom:0}
      .user-perm-table-wrap-v38{overflow:auto;border:1px solid #d7e8e1;border-radius:14px;background:#fff;max-height:360px}
      .user-perm-table-v38{width:100%;border-collapse:collapse;font-size:12px}
      .user-perm-table-v38 th{position:sticky;top:0;background:#07563d;color:#fff;padding:8px;white-space:nowrap;z-index:1}
      .user-perm-table-v38 td{border:1px solid #e2eee9;padding:7px;text-align:center}
      .user-perm-table-v38 td:first-child{text-align:right;background:#f7fbfa;color:#164638;font-weight:700;white-space:nowrap}
      .user-perm-note-v38{padding:9px;border:1px dashed #cfe3dd;border-radius:12px;background:#f8fcfa;margin-top:8px;color:#36594e}
    `;
    document.head.appendChild(st);
  }
  function permissionBoxHtml(){
    const groups=[...new Set(CORE.map(x=>x[2]))];
    const coreHtml=groups.map(group=>{
      const items=CORE.filter(x=>x[2]===group).map(([key,label])=>`<label class="user-perm-item-v38"><span>${esc(label)}</span><input type="checkbox" id="perm_${key}" data-perm="${key}"></label>`).join('');
      return `<section class="user-perm-group-v38"><h4>${esc(group)}</h4>${items}</section>`;
    }).join('');
    const matrixRows=TABS.map(([tab,label])=>`<tr><td>${esc(label)}</td>${ACTIONS.map(([action])=>`<td><input type="checkbox" id="perm_tab_${tab}_${action}" data-perm="tab_${tab}_${action}"></td>`).join('')}</tr>`).join('');
    return `<label>الصلاحيات</label>
      <div class="user-perm-toolbar-v38">
        <button type="button" class="light" id="permRoleDefaultsV38">صلاحيات الدور</button>
        <button type="button" class="light" id="permSelectAllV38">تحديد الكل</button>
        <button type="button" class="light" id="permClearAllV38">إلغاء الكل</button>
      </div>
      <div class="user-perm-groups-v38">${coreHtml}</div>
      <h3>صلاحيات التبويبات والأزرار</h3>
      <div class="user-perm-table-wrap-v38"><table class="user-perm-table-v38"><thead><tr><th>التبويب</th>${ACTIONS.map(([,label])=>`<th>${esc(label)}</th>`).join('')}</tr></thead><tbody>${matrixRows}</tbody></table></div>
      <div class="user-perm-note-v38">الصلاحيات هنا تتحكم بما يظهر في القائمة الجانبية وبالأزرار داخل كل قسم. عند التعديل يتم حفظ المستخدم المحدد فقط.</div>`;
  }
  function boxInputs(){
    const box=$('userPermissionsBoxV72');
    return box ? A([...box.querySelectorAll('input[data-perm]')]) : [];
  }
  function ensureBox(){
    ensureStyle();
    const active=$('userActive');
    if(!active) return;
    let box=$('userPermissionsBoxV72');
    if(!box){
      box=document.createElement('div');
      box.id='userPermissionsBoxV72';
      box.className='perm-box-v72';
      active.parentElement.insertBefore(box, active.nextSibling);
    }
    if(!box.dataset.stableV38){
      box.dataset.stableV38='1';
      box.innerHTML=permissionBoxHtml();
      $('permRoleDefaultsV38')?.addEventListener('click',()=>setChecks(roleDefaults($('userRole')?.value)));
      $('permSelectAllV38')?.addEventListener('click',()=>boxInputs().forEach(i=>i.checked=true));
      $('permClearAllV38')?.addEventListener('click',()=>boxInputs().forEach(i=>i.checked=false));
    }
    ensureRoleOptions();
  }
  function ensureRoleOptions(){
    const sel=$('userRole');
    if(!sel) return;
    const current=S(sel.value);
    sel.innerHTML=ROLES.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
    sel.value=ROLES.some(([v])=>v===current) ? current : 'supervisor';
    if(!sel.dataset.stablePermV38){
      sel.dataset.stablePermV38='1';
      sel.addEventListener('change',()=>{
        if(!$('userId')?.value) setChecks(roleDefaults(sel.value));
      });
    }
  }
  function setChecks(perms){
    const p=perms || {};
    boxInputs().forEach(input=>{ input.checked=!!p[input.dataset.perm]; });
  }
  function collectPerms(){
    const out={};
    boxInputs().forEach(input=>{ out[input.dataset.perm]=!!input.checked; });
    return out;
  }
  function updateLocal(saved){
    const rows=localUsers();
    const idx=rows.findIndex(u=>S(u.id)===S(saved.id));
    if(idx>=0) rows[idx]=Object.assign({}, rows[idx], saved);
  }
  function updateSession(saved){
    ['tasneef_user','tasneef_session'].forEach(key=>{
      try{
        const cur=JSON.parse(localStorage.getItem(key)||'null');
        if(cur && (S(cur.id)===S(saved.id) || S(cur.username)===S(saved.username))){
          localStorage.setItem(key, JSON.stringify(Object.assign({}, cur, saved)));
        }
      }catch(e){}
    });
  }
  async function writeUser(row,id){
    if(!window.sb) throw new Error('قاعدة البيانات غير متصلة');
    return id
      ? await window.sb.from('app_users').update(row).eq('id', id).select('*').maybeSingle()
      : await window.sb.from('app_users').insert(row).select('*').maybeSingle();
  }
  function safeDbRole(role){
    const r=normalizeRole(role);
    return ['admin','supervisor','technician','financial_manager','operations_manager','warehouse_manager'].includes(r) ? r : 'supervisor';
  }
  window.clearUserForm = function(){
    ['userId','userFullName','userUsername','userPassword'].forEach(id=>{ if($(id)) $(id).value=''; });
    if($('userRole')) $('userRole').value='supervisor';
    if($('userActive')) $('userActive').value='true';
    if($('userFormTitle')) $('userFormTitle').textContent='إضافة مستخدم';
    ensureBox();
    setChecks(roleDefaults('supervisor'));
  };
  window.editUser = async function(id){
    ensureBox();
    const u=await fetchUser(id);
    if(!u) return;
    if($('userId')) $('userId').value=u.id || '';
    if($('userFullName')) $('userFullName').value=u.full_name || '';
    if($('userUsername')) $('userUsername').value=u.username || '';
    if($('userPassword')) $('userPassword').value=u.password || '';
    if($('userRole')) $('userRole').value=normalizeRole(u.role);
    if($('userActive')) $('userActive').value=String(u.is_active !== false);
    if($('userFormTitle')) $('userFormTitle').textContent='تعديل مستخدم';
    setChecks(effectivePerms(u));
    $('userFullName')?.scrollIntoView({behavior:'smooth',block:'start'});
  };
  window.saveUser = async function(){
    ensureBox();
    const id=S($('userId')?.value);
    const old=id ? await fetchUser(id) : null;
    const role=normalizeRole($('userRole')?.value || old?.role);
    const row={
      full_name:S($('userFullName')?.value),
      username:S($('userUsername')?.value),
      password:S($('userPassword')?.value) || S(old?.password) || '123456',
      role,
      is_active:S($('userActive')?.value || 'true') === 'true',
      permissions:collectPerms()
    };
    if(!row.full_name || !row.username) return toast('الاسم واسم المستخدم مطلوبان','err');
    let res=await writeUser(row,id);
    if(res.error && /role_check|constraint/i.test(String(res.error.message||''))){
      res=await writeUser(Object.assign({}, row, {role:safeDbRole(role)}), id);
    }
    if(res.error && /permissions|column/i.test(String(res.error.message||''))){
      const safe=Object.assign({}, row); delete safe.permissions;
      res=await writeUser(safe,id);
    }
    if(res.error) return toast('لم يتم حفظ المستخدم: '+(res.error.message||String(res.error)),'err');
    const saved=res.data || Object.assign({id:id||Date.now()}, row);
    updateLocal(saved);
    updateSession(saved);
    toast('تم حفظ المستخدم والصلاحيات');
    try{ if(typeof window.refreshAll==='function') await window.refreshAll(); }catch(e){}
    window.clearUserForm();
  };
  window.renderUsers = function(){
    const b=$('usersBody');
    if(!b) return;
    const head=b.closest('table')?.querySelector('thead');
    if(head) head.innerHTML='<tr><th>الاسم</th><th>المستخدم</th><th>الدور</th><th>الحالة</th><th>الصلاحيات</th><th>إجراء</th></tr>';
    const roleLabel=role=>ROLES.find(([v])=>v===normalizeRole(role))?.[1] || role || '-';
    b.innerHTML=localUsers().map(u=>{
      const p=effectivePerms(u);
      const enabled=CORE.filter(([k])=>p[k]).map(([,label])=>label).slice(0,7).join('، ');
      return `<tr><td>${esc(u.full_name)}</td><td>${esc(u.username)}</td><td><span class="badge">${esc(roleLabel(u.role))}</span></td><td><span class="badge ${u.is_active!==false?'green':'red'}">${u.is_active!==false?'نشط':'موقوف'}</span></td><td style="white-space:normal;min-width:260px">${esc(enabled || '-')}</td><td class="row-actions"><button onclick="editUser(${Number(u.id)||0})">تعديل</button><button class="danger" onclick="deleteRow('app_users',${Number(u.id)||0})">حذف</button></td></tr>`;
    }).join('') || '<tr><td colspan="6">لا يوجد مستخدمون</td></tr>';
  };
  function permissionAllowed(user,key){
    const p=effectivePerms(user);
    if(normalizeRole(user?.role)==='admin') return true;
    return p[key]===true;
  }
  function applySidebarPermissions(){
    const u=(()=>{ try{ return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{}; }catch(e){ return {}; } })();
    if(normalizeRole(u.role)==='admin') return;
    const map={
      dashboard:'can_dashboard', daily:'can_time_logs', users:'can_manage_users', projects:'can_projects',
      contracts:'can_contracts', workers:'can_manage_workers', attendance:'can_attendance', monthly:'can_monthly',
      tickets:'can_tickets', orders:'can_orders', clientReports:'can_client_reports', clientRatings:'can_client_ratings',
      alerts:'can_alerts', assistant:'can_assistant', export:'can_export', financeDashboard:'can_expenses_inventory'
    };
    document.querySelectorAll('.nav[onclick*="showPage"]').forEach(btn=>{
      const m=S(btn.getAttribute('onclick')).match(/showPage\(['"]([^'"]+)/);
      const page=m && m[1];
      const key=map[page];
      if(key) btn.style.display=permissionAllowed(u,key) ? '' : 'none';
    });
  }
  function install(){
    ensureBox();
    if(!$('userId')?.value) setChecks(roleDefaults($('userRole')?.value || 'supervisor'));
    try{ window.renderUsers(); }catch(e){}
    applySidebarPermissions();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(install,250));
  else setTimeout(install,50);
  window.addEventListener('load',()=>setTimeout(install,700));
  setTimeout(install,1400);
})();

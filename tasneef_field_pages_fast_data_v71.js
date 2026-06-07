(function(){
  'use strict';
  if(window.__tasneefFieldPagesFastDataV71) return;
  window.__tasneefFieldPagesFastDataV71 = true;

  const SUPABASE_URL = 'https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const A = value => Array.isArray(value) ? value : [];
  const S = value => String(value ?? '').trim();
  const $ = id => document.getElementById(id);
  const esc = value => S(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function today(){ return new Date().toISOString().slice(0,10); }
  function monthStart(){ return today().slice(0,8) + '01'; }
  function currentUser(){
    try{ if(typeof window.session === 'function') return window.session() || {}; }catch(_){}
    try{ return JSON.parse(localStorage.getItem('tasneef_user') || '{}') || {}; }catch(_){ return {}; }
  }
  function ds(){
    window.data = window.data || {};
    return window.data;
  }
  function say(text, type){
    try{ if(typeof window.msg === 'function'){ window.msg(text, type || 'ok'); return; } }catch(_){}
    const el = $('globalMsg');
    if(!el) return;
    el.className = 'msg ' + (type === 'err' ? 'err' : '');
    el.textContent = text;
    el.classList.remove('hidden');
  }
  function setOptions(id, rows, label, allLabel){
    const el = $(id);
    if(!el) return;
    const old = el.value;
    el.innerHTML = (allLabel ? `<option value="">${esc(allLabel)}</option>` : '') +
      A(rows).map(r => `<option value="${esc(r.id)}">${esc(r[label] || r.name || r.full_name || r.username || r.id)}</option>`).join('');
    if(old && [...el.options].some(o => S(o.value) === S(old))) el.value = old;
  }
  function withTimeout(promise, ms){
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('انتهت مهلة تحميل البيانات')), ms);
      promise.then(
        value => { clearTimeout(timer); resolve(value); },
        error => { clearTimeout(timer); reject(error); }
      );
    });
  }
  async function rest(table, opts){
    const params = new URLSearchParams();
    params.set('select', (opts && opts.select) || '*');
    if(opts && opts.order) params.set('order', opts.order);
    if(opts && opts.limit) params.set('limit', String(opts.limit));
    (opts && opts.filters || []).forEach(f => params.set(f[0], f[1]));
    const res = await withTimeout(fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + params.toString(), {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        Accept: 'application/json'
      }
    }), 12000);
    if(!res.ok) throw new Error(table + ': ' + res.status);
    return await res.json();
  }
  async function safeRest(table, opts){
    try{ return A(await rest(table, opts)); }catch(e){ console.warn('fast data failed:', table, e); return []; }
  }
  function projectName(id){
    return A(ds().projects).find(p => S(p.id) === S(id))?.name || '-';
  }
  function workerSupId(w){
    return S(w.app_supervisor_id || w.supervisor_id || w.assigned_supervisor_id || w.manager_id || '');
  }
  function workerProjectId(w){
    return S(w.project_id || w.assigned_project_id || w.current_project_id || '');
  }
  function renderWorkerList(){
    const box = $('supervisorAttendanceList');
    if(!box) return;
    box.innerHTML = A(ds().workers).map(w => `
      <div class="quick-item">
        <b>${esc(w.name || w.full_name || '-')}</b>
        <select data-worker="${esc(w.id)}">
          <option value="present">حاضر</option>
          <option value="absent">غائب</option>
        </select>
      </div>
    `).join('') || '<div class="quick-item">لا يوجد عمال مرتبطين بك</div>';
  }
  function renderSupervisorFallback(){
    const d = ds();
    const u = currentUser();
    if($('supTitle')) $('supTitle').textContent = 'لوحة المشرف - ' + (u.full_name || u.username || '');
    setOptions('logProject', d.projects, 'name', 'اختر المشروع');
    setOptions('attendanceProject', d.projects, 'name', 'اختر المشروع');
    setOptions('ticketProject', d.projects, 'name', 'اختر المشروع');
    setOptions('supTicketFilterProject', d.projects, 'name', 'كل المشاريع');
    setOptions('supClientReportProject', d.projects, 'name', 'اختر المشروع');
    if($('logDate') && !$('logDate').value) $('logDate').value = today();
    if($('attendanceDate') && !$('attendanceDate').value) $('attendanceDate').value = today();
    renderWorkerList();
    try{ if(typeof window.renderTimeLogs === 'function') window.renderTimeLogs(); }catch(_){}
    try{ if(typeof window.renderTickets === 'function') window.renderTickets(); }catch(_){}
    try{ if(typeof window.renderSupervisorDailySummary === 'function') window.renderSupervisorDailySummary(); }catch(_){}
  }
  async function loadSupervisorFast(){
    const u = currentUser();
    if(!u || !u.id) return false;
    const sid = S(u.id);
    say('جاري تحميل بيانات المشرف...');
    const [users, projectsAll, workersAll, assignments, logs, tickets, attendance] = await Promise.all([
      safeRest('app_users', {select:'id,full_name,username,role,is_active', order:'id.asc'}),
      safeRest('projects', {order:'id.asc'}),
      safeRest('workers', {order:'id.asc', limit:1500}),
      safeRest('worker_project_assignments', {order:'id.asc', limit:2000}),
      safeRest('time_logs', {order:'id.desc', limit:400, filters:[['supervisor_id','eq.' + sid], ['log_date','gte.' + monthStart()]]}),
      safeRest('tickets', {order:'id.desc', limit:500}),
      safeRest('attendance', {order:'attendance_date.desc', limit:1500, filters:[['attendance_date','gte.' + monthStart()]]})
    ]);
    const projects = projectsAll.filter(p => S(p.supervisor_id) === sid);
    const projectIds = new Set(projects.map(p => S(p.id)));
    const assignedWorkerIds = new Set(assignments.filter(a => a.is_active !== false && projectIds.has(S(a.project_id))).map(a => S(a.worker_id)));
    const workers = workersAll.filter(w => workerSupId(w) === sid || projectIds.has(workerProjectId(w)) || assignedWorkerIds.has(S(w.id)));
    const workerIds = new Set(workers.map(w => S(w.id)));
    const d = ds();
    d.users = users;
    d.supervisors = users.filter(x => x.role === 'supervisor' && x.is_active !== false);
    d.technicians = users.filter(x => x.role === 'technician' && x.is_active !== false);
    d.projects = projects;
    d.workerAssignments = assignments;
    d.workers = workers;
    d.logs = logs.filter(l => S(l.supervisor_id) === sid && S(l.visit_type) !== 'technician_attendance');
    d.tickets = tickets.filter(t => S(t.supervisor_id) === sid || S(t.created_by) === sid || projectIds.has(S(t.project_id)));
    d.attendance = attendance.filter(a => S(a.supervisor_id) === sid || workerIds.has(S(a.worker_id)) || projectIds.has(S(a.project_id)));
    renderSupervisorFallback();
    say('تم تحميل بيانات المشرف');
    return true;
  }
  function renderTechFallback(){
    const d = ds();
    const u = currentUser();
    if($('techTitle')) $('techTitle').textContent = 'لوحة الفني - ' + (u.full_name || u.username || '');
    setOptions('techNewTicketProject', d.projects, 'name', 'اختر المشروع');
    try{ if(typeof window.renderTechnicianTickets === 'function'){ window.renderTechnicianTickets(); return; } }catch(_){}
    const tickets = A(d.tickets);
    const open = tickets.filter(t => S(t.status || 'open') !== 'closed' && !t.claimed_by);
    const mine = tickets.filter(t => S(t.claimed_by) === S(u.id) && S(t.status || 'open') !== 'closed');
    const done = tickets.filter(t => S(t.closed_by) === S(u.id));
    if($('techOpenCount')) $('techOpenCount').textContent = open.length;
    if($('techMineCount')) $('techMineCount').textContent = mine.length;
    if($('techDoneCount')) $('techDoneCount').textContent = done.length;
    const row = t => `<tr><td>${esc(t.ticket_number || ('T-' + String(t.id || '').padStart(4,'0')))}</td><td>${esc(projectName(t.project_id))}</td><td>${esc(t.title)}</td><td>${esc(t.description)}</td><td>${esc(t.priority)}</td><td>${esc(t.status)}</td><td>-</td><td>${esc(t.claimed_by_name)}</td><td>${esc(t.closed_by_name)}</td><td>${esc(t.closure_note)}</td><td>-</td><td>-</td></tr>`;
    if($('techOpenTicketsBody')) $('techOpenTicketsBody').innerHTML = open.map(row).join('') || '<tr><td colspan="12">لا توجد تكتات مفتوحة</td></tr>';
    if($('techMyTicketsBody')) $('techMyTicketsBody').innerHTML = mine.map(row).join('') || '<tr><td colspan="12">لا توجد تكتات قيد المعالجة</td></tr>';
    if($('techDoneTicketsBody')) $('techDoneTicketsBody').innerHTML = done.map(row).join('') || '<tr><td colspan="12">لا توجد تكتات مغلقة</td></tr>';
  }
  async function loadTechnicianFast(){
    const u = currentUser();
    if(!u || !u.id) return false;
    say('جاري تحميل بيانات الفني...');
    const [users, projects, tickets] = await Promise.all([
      safeRest('app_users', {select:'id,full_name,username,role,is_active', order:'id.asc'}),
      safeRest('projects', {order:'name.asc', limit:1200}),
      safeRest('tickets', {order:'id.desc', limit:700})
    ]);
    const d = ds();
    d.users = users;
    d.supervisors = users.filter(x => x.role === 'supervisor' && x.is_active !== false);
    d.technicians = users.filter(x => x.role === 'technician' && x.is_active !== false);
    d.projects = projects;
    d.tickets = tickets;
    renderTechFallback();
    say('تم تحميل بيانات الفني');
    return true;
  }

  const oldSupervisorInit = window.initSupervisor;
  window.initSupervisor = async function(){
    try{
      const ok = await loadSupervisorFast();
      if(ok) return;
    }catch(error){
      say(error.message || 'تعذر تحميل بيانات المشرف', 'err');
    }
    if(typeof oldSupervisorInit === 'function') return oldSupervisorInit();
  };

  const oldTechnicianInit = window.initTechnician;
  window.initTechnician = async function(){
    try{
      const ok = await loadTechnicianFast();
      if(ok && !window.__tasneefTechFastRefreshV71){
        window.__tasneefTechFastRefreshV71 = setInterval(() => loadTechnicianFast().catch(() => {}), 30000);
      }
      if(ok) return;
    }catch(error){
      say(error.message || 'تعذر تحميل بيانات الفني', 'err');
    }
    if(typeof oldTechnicianInit === 'function') return oldTechnicianInit();
  };

  window.tasneefReloadFieldDataV71 = function(){
    if($('supTitle')) return loadSupervisorFast();
    if($('techTitle')) return loadTechnicianFast();
    return Promise.resolve(false);
  };
})();

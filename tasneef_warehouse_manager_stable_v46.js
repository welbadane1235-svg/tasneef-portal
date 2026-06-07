(function(){
  'use strict';
  if(window.__tasneefWorkerDistributionUnifiedV51) return;
  window.__tasneefWorkerDistributionUnifiedV51 = true;

  const $ = id => document.getElementById(id);
  const A = v => Array.isArray(v) ? v : [];
  const S = v => String(v ?? '').trim();
  const N = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  const E = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const D = () => (window.data = window.data || {});
  const active = x => x && x.is_active !== false && !['inactive','deleted','محذوف','موقوف'].includes(S(x.status || 'active').toLowerCase());
  const same = (a,b) => S(a) === S(b);

  function message(text, type){ try{ if(typeof window.msg === 'function') window.msg(text, type); else alert(text); }catch(_){ alert(text); } }
  function projectRow(id){ return A(D().projects).find(p => same(p.id, id)) || {}; }
  function workerRow(id){ return A(D().workers).find(w => same(w.id, id)) || {}; }
  function projectNameSafe(id){ try{ if(typeof window.projectName === 'function') return window.projectName(id) || '-'; }catch(_){} const p = projectRow(id); return S(p.name || p.project_name || '-'); }
  function supervisorNameSafe(id){ try{ if(typeof window.supervisorName === 'function') return window.supervisorName(id) || '-'; }catch(_){} const u = A(D().users).find(x => same(x.id, id)) || A(D().supervisors).find(x => same(x.id, id)) || {}; return S(u.full_name || u.name || u.username || '-'); }
  function assignments(){ return A(D().workerAssignments).filter(a => a && a.is_active !== false); }
  function assignmentsForWorker(workerId){ return assignments().filter(a => same(a.worker_id, workerId)); }
  function assignmentsForProject(projectId){ return assignments().filter(a => same(a.project_id, projectId)); }
  function workerProjectIds(worker){
    const ids = [];
    assignmentsForWorker(worker?.id).forEach(a => { if(S(a.project_id)) ids.push(S(a.project_id)); });
    ['project_id','assigned_project_id','current_project_id'].forEach(k => { if(worker && S(worker[k])) ids.push(S(worker[k])); });
    return [...new Set(ids.filter(Boolean))];
  }
  function workerSupervisorIds(worker){
    const ids = [];
    ['app_supervisor_id','supervisor_id','assigned_supervisor_id','manager_id'].forEach(k => { if(worker && S(worker[k])) ids.push(S(worker[k])); });
    workerProjectIds(worker).forEach(pid => { const sid = projectRow(pid).supervisor_id; if(S(sid)) ids.push(S(sid)); });
    return [...new Set(ids.filter(Boolean))];
  }
  function firstProjectForWorker(worker, selectedSupervisor){
    const ids = workerProjectIds(worker);
    if(selectedSupervisor){
      const bySup = ids.find(pid => same(projectRow(pid).supervisor_id, selectedSupervisor));
      if(bySup) return bySup;
    }
    return ids[0] || '';
  }
  function firstSupervisorForWorker(worker, selectedProject){
    if(selectedProject){ const sid = projectRow(selectedProject).supervisor_id; if(S(sid)) return S(sid); }
    return workerSupervisorIds(worker)[0] || '';
  }
  function workerMatchesSupervisor(worker, supervisorId){ return !supervisorId || workerSupervisorIds(worker).some(id => same(id, supervisorId)); }
  function workerMatchesProject(worker, projectId){ return !projectId || workerProjectIds(worker).some(id => same(id, projectId)); }
  function workerLabelProjects(worker){ const names = workerProjectIds(worker).map(projectNameSafe).filter(x => x && x !== '-'); return [...new Set(names)].join('، ') || '-'; }
  function workerLabelSupervisors(worker){ const names = workerSupervisorIds(worker).map(supervisorNameSafe).filter(x => x && x !== '-'); return [...new Set(names)].join('، ') || '-'; }

  window.tasneefLoadWorkerAssignmentsV51 = async function(){
    if(!window.sb) return;
    try{
      const res = await window.sb.from('worker_project_assignments').select('*').eq('is_active', true).order('id');
      if(!res.error) D().workerAssignments = A(res.data);
    }catch(_){}
  };

  const oldRefresh = window.refreshAll;
  if(typeof oldRefresh === 'function'){
    window.refreshAll = async function(){
      const result = await oldRefresh.apply(this, arguments);
      await window.tasneefLoadWorkerAssignmentsV51();
      try{ window.renderProjects && window.renderProjects(); }catch(_){}
      try{ window.renderWorkers && window.renderWorkers(); }catch(_){}
      try{ window.renderAttendance && window.renderAttendance(); }catch(_){}
      try{ window.renderAttendanceMonthly && window.renderAttendanceMonthly(); }catch(_){}
      try{ window.renderMonthly && window.renderMonthly(); }catch(_){}
      return result;
    };
    try{ refreshAll = window.refreshAll; }catch(_){}
  }

  window.workerProjectId = function(worker){ return firstProjectForWorker(worker, ''); };
  window.workerSupId = function(worker){ return firstSupervisorForWorker(worker, firstProjectForWorker(worker, '')); };
  try{ workerProjectId = window.workerProjectId; }catch(_){}
  try{ workerSupId = window.workerSupId; }catch(_){}

  window.renderProjectManager = function(){
    const body = $('projectWorkersBody'); if(!body) return;
    const pid = S($('manageProjectId')?.value);
    if(!pid){ body.innerHTML = '<tr><td colspan="5">اختر مشروع من زر إدارة المشروع</td></tr>'; return; }
    const rows = A(D().workers).filter(w => active(w) && workerMatchesProject(w, pid));
    body.innerHTML = rows.map(w => `<tr><td>${E(w.name || w.full_name || '-')}</td><td>${E(workerLabelSupervisors(w))}</td><td><span class="badge ${(w.worker_type || 'primary') === 'support' ? 'amber' : 'green'}">${(w.worker_type || 'primary') === 'support' ? 'بديل / مساند' : 'أساسي'}</span></td><td><span class="badge ${w.status === 'inactive' ? 'red' : 'green'}">${w.status === 'inactive' ? 'موقوف' : 'نشط'}</span></td><td class="row-actions"><button class="danger" onclick="removeWorkerFromProject(${Number(w.id)||0})">إزالة من هذا المشروع</button></td></tr>`).join('') || '<tr><td colspan="5">لا يوجد عمال مرتبطون بهذا المشروع</td></tr>';
  };

  window.addExistingWorkerToProject = async function(){
    const pid = N($('manageProjectId')?.value), wid = N($('manageWorkerSelect')?.value), type = $('manageWorkerType')?.value || 'primary';
    if(!pid || !wid) return message('اختر المشروع والعامل', 'err');
    const sid = N(projectRow(pid).supervisor_id) || null;
    let assignOk = false;
    try{ const res = await window.sb.from('worker_project_assignments').upsert({worker_id:wid, project_id:pid, worker_type:type, is_active:true}, {onConflict:'worker_id,project_id'}); assignOk = !res.error; }catch(_){}
    const upd = await window.sb.from('workers').update({project_id:pid, supervisor_id:sid, app_supervisor_id:sid, worker_type:type}).eq('id', wid);
    if(upd.error && !assignOk) return message(upd.error.message, 'err');
    message('تم ربط العامل بالمشروع وتحديث التوزيع');
    await window.refreshAll();
    window.openProjectManager && window.openProjectManager(pid);
  };

  window.saveProjectManagerSupervisor = async function(){
    const pid = N($('manageProjectId')?.value), sid = N($('projectManageSupervisor')?.value) || null;
    if(!pid) return message('اختر المشروع أولاً', 'err');
    const pRes = await window.sb.from('projects').update({supervisor_id:sid}).eq('id', pid);
    if(pRes.error) return message(pRes.error.message, 'err');
    const workerIds = assignmentsForProject(pid).map(a => a.worker_id);
    if(workerIds.length) await window.sb.from('workers').update({supervisor_id:sid, app_supervisor_id:sid}).in('id', workerIds);
    await window.sb.from('workers').update({supervisor_id:sid, app_supervisor_id:sid}).eq('project_id', pid);
    message('تم ربط المشرف بالمشروع وتحديث عمال المشروع');
    await window.refreshAll();
    window.openProjectManager && window.openProjectManager(pid);
  };

  window.removeWorkerFromProject = async function(workerId){
    if(!confirm('إزالة العامل من هذا المشروع؟')) return;
    const pid = N($('manageProjectId')?.value), wid = N(workerId);
    if(!pid || !wid) return;
    try{ await window.sb.from('worker_project_assignments').update({is_active:false}).eq('worker_id', wid).eq('project_id', pid); }catch(_){}
    await window.sb.from('workers').update({project_id:null}).eq('id', wid).eq('project_id', pid);
    message('تمت إزالة العامل من هذا المشروع');
    await window.refreshAll();
    window.openProjectManager && window.openProjectManager(pid);
  };

  window.renderWorkers = function(){
    const body = $('workersBody'); if(!body) return;
    const sid = S($('workerFilterSupervisor')?.value), pid = S($('workerFilterProject')?.value), st = S($('workerFilterStatus')?.value), tp = S($('workerFilterType')?.value), q = S($('workerSearch')?.value).toLowerCase();
    let rows = A(D().workers).filter(active);
    if(sid) rows = rows.filter(w => workerMatchesSupervisor(w, sid));
    if(pid) rows = rows.filter(w => workerMatchesProject(w, pid));
    if(st) rows = rows.filter(w => S(w.status || 'active') === st);
    if(tp) rows = rows.filter(w => S(w.worker_type || 'primary') === tp);
    if(q) rows = rows.filter(w => [w.name,w.phone,workerLabelSupervisors(w),workerLabelProjects(w),w.notes].join(' ').toLowerCase().includes(q));
    body.innerHTML = rows.map(w => `<tr><td>${E(w.name || '-')}</td><td>${E(workerLabelSupervisors(w))}</td><td>${E(workerLabelProjects(w))}</td><td><span class="badge ${(w.worker_type || 'primary') === 'support' ? 'amber' : 'green'}">${(w.worker_type || 'primary') === 'support' ? 'بديل / مساند' : 'أساسي'}</span></td><td>${E(w.phone || '')}</td><td>${Number(w.salary || 0)}</td><td><span class="badge ${w.status === 'inactive' ? 'red' : 'green'}">${w.status === 'inactive' ? 'موقوف' : 'نشط'}</span></td><td>${E(w.notes || '-')}</td><td class="row-actions"><button onclick="editWorker(${Number(w.id)||0})">تعديل</button><button class="light" onclick="toggleWorkerStatus(${Number(w.id)||0})">${w.status === 'inactive' ? 'تفعيل' : 'إيقاف'}</button><button class="danger" onclick="deleteRow('workers',${Number(w.id)||0})">حذف</button></td></tr>`).join('') || '<tr><td colspan="9">لا توجد بيانات</td></tr>';
  };

  window.renderAttendanceWorkersQuick = function(){
    const div = $('attendanceQuick'); if(!div) return;
    const sid = S($('attendanceSupervisor')?.value), pid = S($('attendanceProject')?.value);
    if(!sid && !pid){ div.innerHTML = ''; return; }
    const rows = A(D().workers).filter(w => active(w) && workerMatchesSupervisor(w, sid) && workerMatchesProject(w, pid));
    div.innerHTML = rows.map(w => `<div class="quick-item"><b>${E(w.name || '-')}</b><small>${E(workerLabelProjects(w))}</small><div><button onclick="quickAttendance(${Number(w.id)||0},'present')">حاضر</button> <button class="danger" onclick="quickAttendance(${Number(w.id)||0},'absent')">غائب</button></div></div>`).join('') || '<div class="quick-item">لا يوجد عمال حسب التوزيع المختار</div>';
  };

  window.saveAttendance = async function(){
    const id = $('attendanceId')?.value, workerId = N($('attendanceWorker')?.value), worker = workerRow(workerId);
    const pid = N($('attendanceProject')?.value) || N(firstProjectForWorker(worker, $('attendanceSupervisor')?.value));
    const sid = N($('attendanceSupervisor')?.value) || N(firstSupervisorForWorker(worker, pid));
    const row = {attendance_date:$('attendanceDate')?.value || new Date().toISOString().slice(0,10), worker_id:workerId, supervisor_id:sid || null, project_id:pid || null, status:$('attendanceStatus')?.value || 'present', notes:$('attendanceNotes')?.value || '', created_by:(typeof session === 'function' ? session()?.id : null) || null};
    if(!row.worker_id) return message('اختر العامل', 'err');
    const res = id ? await window.sb.from('attendance').update(row).eq('id', id) : await window.sb.from('attendance').upsert(row, {onConflict:'attendance_date,worker_id'});
    if(res.error) return message(res.error.message, 'err');
    message('تم حفظ الحضور حسب توزيع العامل');
    try{ clearAttendanceForm(); }catch(_){}
    await window.refreshAll();
  };

  window.renderAttendance = function(){
    const body = $('attendanceBody'); if(!body) return;
    const date = S($('attendanceFilterDate')?.value), sid = S($('attendanceFilterSupervisor')?.value), q = S($('attendanceSearch')?.value).toLowerCase();
    let rows = A(D().attendance);
    if(date) rows = rows.filter(a => S(a.attendance_date) === date);
    rows = rows.filter(a => {
      const w = workerRow(a.worker_id), effPid = S(a.project_id || firstProjectForWorker(w, a.supervisor_id || sid)), effSid = S(a.supervisor_id || firstSupervisorForWorker(w, effPid));
      if(sid && !same(effSid, sid) && !workerMatchesSupervisor(w, sid)) return false;
      if(q && ![w.name,w.full_name,supervisorNameSafe(effSid),projectNameSafe(effPid),a.notes].join(' ').toLowerCase().includes(q)) return false;
      a.__effPidV51 = effPid; a.__effSidV51 = effSid; return true;
    });
    body.innerHTML = rows.map(a => {
      const w = workerRow(a.worker_id), st = S(a.status).toLowerCase(), isPresent = ['present','حاضر','حضور'].includes(st);
      return `<tr><td>${E(a.attendance_date || '-')}</td><td>${E(w.name || w.full_name || a.worker_name || '-')}</td><td>${E(supervisorNameSafe(a.__effSidV51))}</td><td>${E(projectNameSafe(a.__effPidV51))}</td><td><span class="badge ${isPresent ? 'green' : 'red'}">${isPresent ? 'حاضر' : 'غائب'}</span></td><td>${E(a.notes || '')}</td><td class="row-actions"><button onclick="editAttendance(${Number(a.id)||0})">تعديل</button><button class="danger" onclick="deleteRow('attendance',${Number(a.id)||0})">حذف</button></td></tr>`;
    }).join('') || '<tr><td colspan="7">لا توجد بيانات</td></tr>';
    window.renderAttendanceWorkersQuick();
  };

  function monthNow(){ return new Date().toISOString().slice(0,7); }
  function daysInMonth(month){ const y = Number(month.slice(0,4)), m = Number(month.slice(5,7)); return new Date(y, m, 0).getDate(); }
  function recDate(row){ return S(row.attendance_date || row.date || row.created_at).slice(0,10); }
  function recMonth(row){ return recDate(row).slice(0,7); }
  function statusClass(value){
    const st = S(value).toLowerCase();
    if(['present','حاضر','حضور'].includes(st)) return 'present';
    if(['absent','غائب','غياب'].includes(st)) return 'absent';
    return '';
  }
  function installAttendanceSupervisorOptions(){
    const sel = $('attendanceMatrixSupervisor');
    if(!sel) return '';
    const keep = sel.value;
    const rows = A(D().supervisors).length ? A(D().supervisors) : A(D().users).filter(u => S(u.role) === 'supervisor');
    sel.innerHTML = '<option value="">كل المشرفين والفنيين</option>' + rows.map(s => `<option value="${E(s.id)}">${E(s.full_name || s.name || s.username || s.id)}</option>`).join('');
    sel.value = keep;
    return sel.value;
  }
  window.renderAttendanceMonthly = function(){
    const body = $('attendanceMatrixBody'), head = $('attendanceMatrixHead');
    if(!body || !head) return;
    const monthEl = $('attendanceMatrixMonth');
    if(monthEl && !monthEl.value) monthEl.value = monthNow();
    const month = monthEl?.value || monthNow();
    const selected = installAttendanceSupervisorOptions();
    const type = S($('attendanceMatrixTypeV13')?.value);
    const q = S($('attendanceMatrixSearch')?.value).toLowerCase();
    const dayCount = daysInMonth(month);
    const latest = new Map();
    A(D().attendance).filter(a => recMonth(a) === month).forEach(a => {
      const key = S(a.worker_id || a.user_id || a.technician_id) + '|' + recDate(a);
      const old = latest.get(key);
      if(!old || S(a.updated_at || a.created_at || a.id) > S(old.updated_at || old.created_at || old.id)) latest.set(key, a);
    });
    const rows = [];
    A(D().workers).filter(active).forEach(w => {
      const pid = firstProjectForWorker(w, selected);
      const sid = firstSupervisorForWorker(w, pid);
      rows.push({id:S(w.id), kind:'worker', label:'عامل', name:S(w.name || w.full_name || '-'), supervisor_id:sid, project_id:pid});
    });
    A(D().users).filter(u => ['technician','فني'].includes(S(u.role))).forEach(u => {
      rows.push({id:S(u.id), kind:'technician', label:'فني', name:S(u.full_name || u.name || u.username || '-'), supervisor_id:S(u.supervisor_id || u.manager_id || ''), project_id:''});
    });
    const filtered = rows.filter(r => {
      const w = workerRow(r.id);
      if(type === 'worker' && r.kind !== 'worker') return false;
      if(type === 'technician' && r.kind !== 'technician') return false;
      if(selected && r.kind === 'worker' && !workerMatchesSupervisor(w, selected)) return false;
      if(selected && r.kind !== 'worker' && !same(r.supervisor_id, selected)) return false;
      if(q && ![r.name,r.label,supervisorNameSafe(r.supervisor_id),projectNameSafe(r.project_id)].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
    head.innerHTML = '<tr><th>الاسم</th><th>النوع</th><th>المشرف / الفني</th><th>المشروع</th><th>الفترة</th>' + Array.from({length:dayCount}, (_,i)=>`<th>${String(i+1).padStart(2,'0')}</th>`).join('') + '</tr>';
    let totalPresent = 0, totalAbsent = 0;
    body.innerHTML = filtered.map(r => {
      const cells = [];
      for(let day = 1; day <= dayCount; day++){
        const date = month + '-' + String(day).padStart(2,'0');
        const rec = latest.get(r.id + '|' + date);
        const st = statusClass(rec?.status);
        if(st === 'present'){ totalPresent++; cells.push('<td><span class="att-cell att-present">ح</span></td>'); }
        else if(st === 'absent'){ totalAbsent++; cells.push('<td><span class="att-cell att-absent">غ</span></td>'); }
        else cells.push('<td><span class="att-cell att-empty">-</span></td>');
      }
      return `<tr><td><b>${E(r.name)}</b></td><td>${E(r.label)}</td><td>${E(supervisorNameSafe(r.supervisor_id))}</td><td>${E(projectNameSafe(r.project_id))}</td><td>-</td>${cells.join('')}</tr>`;
    }).join('') || `<tr><td colspan="${5+dayCount}">لا توجد سجلات حسب الفلتر المختار</td></tr>`;
    const sum = $('attendanceMatrixSummary');
    if(sum){
      const pct = (totalPresent + totalAbsent) ? (totalPresent / (totalPresent + totalAbsent) * 100) : 0;
      sum.innerHTML = `<div class="kpi"><small>عدد الصفوف</small><b>${filtered.length}</b></div><div class="kpi"><small>إجمالي الحضور</small><b>${totalPresent}</b></div><div class="kpi"><small>إجمالي الغياب</small><b>${totalAbsent}</b></div><div class="kpi"><small>نسبة الحضور</small><b>${pct.toFixed(1)}%</b></div>`;
    }
  };
  try{ renderAttendanceMonthly = window.renderAttendanceMonthly; }catch(_){}

  window.renderSupervisorAttendanceList = function(){
    const list = $('supervisorAttendanceList'); if(!list) return;
    const user = (typeof session === 'function' ? session() : {}) || {}, sid = S(user.id), selectedProject = S($('attendanceProject')?.value), q = S($('attendanceWorkerSearchV343')?.value).toLowerCase();
    const projects = A(D().projects).filter(p => same(p.supervisor_id, sid));
    const projectIds = new Set(projects.map(p => S(p.id)));
    const workers = A(D().workers).filter(w => active(w) && (workerMatchesSupervisor(w, sid) || workerProjectIds(w).some(pid => projectIds.has(S(pid)))) && workerMatchesProject(w, selectedProject) && (!q || S(w.name || w.full_name).toLowerCase().includes(q)));
    if($('attendanceProject')){
      const keep = $('attendanceProject').value;
      $('attendanceProject').innerHTML = '<option value="">كل مشاريع المشرف</option>' + projects.map(p => `<option value="${E(p.id)}">${E(p.name || p.project_name || p.id)}</option>`).join('');
      $('attendanceProject').value = keep;
    }
    list.innerHTML = workers.map(w => { const pid = selectedProject || firstProjectForWorker(w, sid); return `<div class="att-v343-card" data-worker-card-v343="1"><b>${E(w.name || w.full_name || '-')}</b><small>المشروع: ${E(projectNameSafe(pid))}</small><select class="att-status-v343" data-worker="${E(w.id)}" data-project="${E(pid)}"><option value="present">حاضر</option><option value="absent">غائب</option></select><input class="att-v343-note" data-note-worker="${E(w.id)}" placeholder="ملاحظة اختيارية"></div>`; }).join('') || '<div class="quick-item">لا يوجد عمال مرتبطون بتوزيع هذا المشرف</div>';
  };

  window.saveSupervisorAttendance = async function(){
    const user = (typeof session === 'function' ? session() : {}) || {}, date = $('attendanceDate')?.value || new Date().toISOString().slice(0,10);
    const cards = [...document.querySelectorAll('#supervisorAttendanceList .att-v343-card')];
    if(!cards.length) return message('لا توجد أسماء للحفظ', 'err');
    const rows = cards.map(card => {
      const sel = card.querySelector('select[data-worker]'), wid = N(sel?.dataset.worker) || sel?.dataset.worker, worker = workerRow(wid), pid = N(sel?.dataset.project) || N(firstProjectForWorker(worker, user.id));
      return {attendance_date:date, worker_id:wid, supervisor_id:N(user.id)||user.id, project_id:pid || null, status:sel?.value || 'present', notes:S(card.querySelector('.att-v343-note')?.value), created_by:N(user.id)||user.id};
    });
    const res = await window.sb.from('attendance').upsert(rows, {onConflict:'attendance_date,worker_id'});
    if(res.error) return message(res.error.message, 'err');
    message('تم حفظ التحضير حسب توزيع العمال');
    try{ await window.tasneefLoadWorkerAssignmentsV51(); }catch(_){}
    window.renderSupervisorAttendanceList();
  };

  function monthlyWorkerNames(projectId){
    const names = new Set();
    A(D().workers).filter(active).forEach(w => { if(workerMatchesProject(w, projectId)) names.add(S(w.name || w.full_name)); });
    return [...names].filter(Boolean).join('، ') || '-';
  }
  window.uniqueWorkersForProjectTextV60 = monthlyWorkerNames;
  window.uniqueWorkersForProjectTextV56 = monthlyWorkerNames;
  try{ uniqueWorkersForProjectTextV60 = monthlyWorkerNames; }catch(_){}
  try{ uniqueWorkersForProjectTextV56 = monthlyWorkerNames; }catch(_){}
  try{ renderProjectManager = window.renderProjectManager; }catch(_){}
  try{ addExistingWorkerToProject = window.addExistingWorkerToProject; }catch(_){}
  try{ saveProjectManagerSupervisor = window.saveProjectManagerSupervisor; }catch(_){}
  try{ removeWorkerFromProject = window.removeWorkerFromProject; }catch(_){}
  try{ renderWorkers = window.renderWorkers; }catch(_){}
  try{ renderAttendanceWorkersQuick = window.renderAttendanceWorkersQuick; }catch(_){}
  try{ saveAttendance = window.saveAttendance; }catch(_){}
  try{ renderAttendance = window.renderAttendance; }catch(_){}
  try{ renderSupervisorAttendanceList = window.renderSupervisorAttendanceList; }catch(_){}
  try{ saveSupervisorAttendance = window.saveSupervisorAttendance; }catch(_){}

  async function boot(){
    await window.tasneefLoadWorkerAssignmentsV51();
    try{ window.renderProjectManager(); }catch(_){}
    try{ window.renderWorkers(); }catch(_){}
    try{ window.renderAttendance(); }catch(_){}
    try{ window.renderAttendanceMonthly && window.renderAttendanceMonthly(); }catch(_){}
    try{ window.renderSupervisorAttendanceList(); }catch(_){}
    try{ window.renderMonthly && window.renderMonthly(); }catch(_){}
  }
  document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 1400));
  window.addEventListener('load', () => setTimeout(boot, 1800));
  document.addEventListener('click', e => { if(e.target && (S(e.target.textContent).includes('إدارة المشروع') || S(e.target.textContent).includes('توزيع'))) setTimeout(boot, 400); }, true);
})();

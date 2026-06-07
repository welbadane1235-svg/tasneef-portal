(function(){
  'use strict';

  if (window.__tasneefSupervisorFastFixV9) return;
  window.__tasneefSupervisorFastFixV9 = true;

  const $ = id => document.getElementById(id);
  const A = value => Array.isArray(value) ? value : [];
  const S = value => String(value ?? '').trim();
  const N = value => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const today = () => new Date().toISOString().slice(0, 10);
  const monthStart = () => today().slice(0, 8) + '01';
  const say = (text, type) => {
    try {
      if (typeof window.msg === 'function') window.msg(text, type);
      else alert(text);
    } catch (_) {
      alert(text);
    }
  };

  function ds(){
    window.data = window.data || {};
    return window.data;
  }

  function currentUser(){
    try {
      if (typeof window.session === 'function') return window.session() || {};
    } catch (_) {}
    try {
      return JSON.parse(localStorage.getItem('tasneef_user') || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  function workerSupervisorId(worker){
    return S(
      worker.app_supervisor_id ||
      worker.supervisor_id ||
      worker.assigned_supervisor_id ||
      worker.manager_id ||
      ''
    );
  }

  function workerProjectId(worker){
    return S(worker.project_id || worker.assigned_project_id || worker.current_project_id || '');
  }

  function fillOptions(id, rows, label, allLabel){
    const el = $(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML = (allLabel ? `<option value="">${allLabel}</option>` : '') +
      A(rows).map(row => `<option value="${String(row.id).replace(/"/g, '&quot;')}">${String(row[label] || row.name || row.full_name || row.username || row.id).replace(/[<>&"]/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[m]))}</option>`).join('');
    if (current && [...el.options].some(o => S(o.value) === S(current))) el.value = current;
  }

  async function safeQuery(builder){
    try {
      const res = await builder;
      if (res && res.error) console.warn(res.error.message || res.error);
      return A(res && res.data);
    } catch (error) {
      console.warn(error);
      return [];
    }
  }

  async function loadSupervisorData(){
    const u = currentUser();
    if (!u || !u.id || !window.sb) return false;
    const sid = S(u.id);
    const d = ds();

    const [projects, workers, users, logs, tickets, attendance] = await Promise.all([
      safeQuery(window.sb.from('projects').select('*').eq('supervisor_id', u.id).order('id')),
      safeQuery(window.sb.from('workers').select('*').limit(1200)),
      safeQuery(window.sb.from('app_users').select('id,full_name,username,role,is_active').order('id')),
      safeQuery(window.sb.from('time_logs').select('*').eq('supervisor_id', u.id).gte('log_date', monthStart()).order('id', { ascending: false }).limit(250)),
      safeQuery(window.sb.from('tickets').select('*').order('id', { ascending: false }).limit(350)),
      safeQuery(window.sb.from('attendance').select('*').gte('attendance_date', monthStart()).order('attendance_date', { ascending: false }).limit(1200))
    ]);

    const projectIds = new Set(projects.map(p => S(p.id)));
    const filteredWorkers = workers.filter(w => workerSupervisorId(w) === sid || projectIds.has(workerProjectId(w)));
    const workerIds = new Set(filteredWorkers.map(w => S(w.id)));

    d.users = users;
    d.supervisors = users.filter(x => x.role === 'supervisor' && x.is_active !== false);
    d.projects = projects;
    d.workers = filteredWorkers;
    d.logs = logs.filter(l => S(l.supervisor_id) === sid);
    d.tickets = tickets.filter(t =>
      S(t.supervisor_id) === sid ||
      S(t.created_by) === sid ||
      projectIds.has(S(t.project_id))
    );
    d.attendance = attendance.filter(a =>
      S(a.supervisor_id) === sid ||
      workerIds.has(S(a.worker_id)) ||
      projectIds.has(S(a.project_id))
    );
    return true;
  }

  function renderSupervisorParts(){
    const u = currentUser();
    if ($('supTitle')) $('supTitle').textContent = 'لوحة المشرف - ' + (u.full_name || u.username || '');
    fillOptions('logProject', ds().projects, 'name', 'اختر المشروع');
    fillOptions('attendanceProject', ds().projects, 'name', 'كل مشاريع المشرف');
    fillOptions('ticketProject', ds().projects, 'name', 'اختر المشروع');
    fillOptions('supTicketFilterProject', ds().projects, 'name', 'كل المشاريع');
    if ($('logDate') && !$('logDate').value) $('logDate').value = today();
    if ($('attendanceDate') && !$('attendanceDate').value) $('attendanceDate').value = today();
    try { window.renderSupervisorAttendanceList && window.renderSupervisorAttendanceList(); } catch (e) { console.warn(e); }
    try { window.renderTimeLogs && window.renderTimeLogs(); } catch (e) { console.warn(e); }
    try { window.renderTickets && window.renderTickets(); } catch (e) { console.warn(e); }
    try { window.renderSupervisorDailySummary && window.renderSupervisorDailySummary(); } catch (_) {}
  }

  window.tasneefReloadSupervisorFastV9 = async function(){
    const ok = await loadSupervisorData();
    if (ok) renderSupervisorParts();
    return ok;
  };

  window.initSupervisor = async function(){
    const u = currentUser();
    if (!u || !u.id) {
      try {
        if (typeof window.requireRole === 'function') window.requireRole('supervisor');
      } catch (_) {}
      return;
    }
    await window.tasneefReloadSupervisorFastV9();
  };

  window.saveSupervisorAttendance = async function(){
    const u = currentUser();
    const date = $('attendanceDate')?.value || today();
    const selectedProject = S($('attendanceProject')?.value);
    const selects = A([...document.querySelectorAll('#supervisorAttendanceList select[data-worker], #supervisorAttendanceList select.att-status-v343')]);
    if (!selects.length) return say('لا يوجد عمال للحفظ', 'err');
    const rows = selects.map(select => {
      const wid = S(select.dataset.worker || select.dataset.workerId);
      const worker = A(ds().workers).find(w => S(w.id) === wid) || {};
      const projectId = selectedProject || workerProjectId(worker) || null;
      const noteEl = document.querySelector(`[data-note-worker="${wid}"], input.att-note-v343[data-worker="${wid}"]`);
      return {
        attendance_date: date,
        worker_id: N(wid) || wid,
        supervisor_id: N(u.id) || u.id,
        project_id: projectId ? (N(projectId) || projectId) : null,
        status: select.value || 'present',
        notes: noteEl ? S(noteEl.value) : '',
        created_by: N(u.id) || u.id
      };
    });

    try {
      const workerIds = rows.map(r => r.worker_id);
      const found = await window.sb.from('attendance').select('id,worker_id').eq('attendance_date', date).in('worker_id', workerIds);
      if (found.error) throw found.error;
      const byWorker = new Map(A(found.data).map(r => [S(r.worker_id), r.id]));
      const inserts = [];
      for (const row of rows) {
        const id = byWorker.get(S(row.worker_id));
        if (id) {
          const res = await window.sb.from('attendance').update(row).eq('id', id);
          if (res.error) throw res.error;
        } else {
          inserts.push(row);
        }
      }
      if (inserts.length) {
        const res = await window.sb.from('attendance').insert(inserts);
        if (res.error) throw res.error;
      }
      say('تم حفظ التحضير');
      await loadSupervisorData();
      renderSupervisorParts();
    } catch (error) {
      say(error.message || String(error), 'err');
    }
  };

  try { window.initSupervisor = window.initSupervisor; } catch (_) {}
  console.log('Tasneef supervisor fast fix v9 loaded');
})();

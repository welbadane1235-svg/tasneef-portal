(function(){
  'use strict';

  if (window.__tasneefAttendanceTechniciansV13) return;
  window.__tasneefAttendanceTechniciansV13 = true;

  const $ = id => document.getElementById(id);
  const A = v => Array.isArray(v) ? v : [];
  const S = v => String(v ?? '').trim();
  const sid = v => S(v);
  const esc = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const monthNow = () => new Date().toISOString().slice(0, 7);
  const loadedMonths = new Set();

  function ds(){ return window.data || {}; }
  function users(){ return A(ds().users || ds().appUsers); }
  function workers(){ return A(ds().workers); }
  function attendance(){ return A(ds().attendance); }
  function projects(){ return A(ds().projects); }
  function setDataKey(key, rows){
    window.data = window.data || {};
    const current = A(window.data[key]);
    const map = new Map(current.map(r => [sid(r.id), r]));
    A(rows).forEach(r => { if (r && r.id !== undefined && r.id !== null) map.set(sid(r.id), r); });
    window.data[key] = [...map.values()];
  }

  function roleOf(user){ return S(user.role).toLowerCase(); }
  function isTechnician(user){ return ['technician','فني'].includes(roleOf(user)); }
  function isSupervisor(user){ return ['supervisor','مشرف'].includes(roleOf(user)); }
  function fullName(row){ return S(row.name || row.full_name || row.username || row.email || row.id || '-'); }
  function projectName(id){
    return projects().find(p => sid(p.id) === sid(id))?.name || '-';
  }
  function supervisorName(id){
    const u = users().find(x => sid(x.id) === sid(id));
    return fullName(u) || '-';
  }
  function workerSupervisorId(w){
    return sid(w.supervisor_id || w.app_supervisor_id || w.assigned_supervisor_id || '');
  }
  function workerProjectId(w){
    return sid(w.project_id || w.assigned_project_id || w.current_project_id || '');
  }
  function recDate(r){ return S(r.attendance_date || r.date || r.created_at).slice(0, 10); }
  function recMonth(r){ return recDate(r).slice(0, 7); }
  function recWorkerId(r){ return sid(r.worker_id || r.user_id || r.technician_id || ''); }
  function recSupervisorId(r){ return sid(r.supervisor_id || r.created_by || ''); }
  function recProjectId(r){ return sid(r.project_id || ''); }
  function daysInMonth(month){
    const y = Number(month.slice(0,4));
    const m = Number(month.slice(5,7));
    return new Date(y, m, 0).getDate();
  }
  function monthEnd(month){
    const days = daysInMonth(month);
    return month + '-' + String(days).padStart(2, '0');
  }
  async function ensureMonthData(month){
    if (!window.sb || loadedMonths.has(month)) return;
    const hasRecords = attendance().some(r => recMonth(r) === month);
    if (hasRecords && workers().length && users().length) {
      loadedMonths.add(month);
      return;
    }
    try {
      const [att, wrk, usr, prj] = await Promise.all([
        window.sb.from('attendance').select('*').gte('attendance_date', month + '-01').lte('attendance_date', monthEnd(month)).limit(5000),
        window.sb.from('workers').select('*').limit(3000),
        window.sb.from('app_users').select('*').limit(1000),
        window.sb.from('projects').select('*').limit(1000)
      ]);
      if (!att.error) setDataKey('attendance', att.data || []);
      if (!wrk.error) setDataKey('workers', wrk.data || []);
      if (!usr.error) setDataKey('users', usr.data || []);
      if (!prj.error) setDataKey('projects', prj.data || []);
      loadedMonths.add(month);
    } catch (error) {
      console.warn('attendance month load failed', error);
    }
  }
  function statusOf(r){
    const st = S(r && r.status).toLowerCase();
    if (['absent','غياب','غائب'].includes(st)) return 'absent';
    if (['present','حضور','حاضر'].includes(st)) return 'present';
    return st || '';
  }

  function ensureFilters(){
    const month = $('attendanceMatrixMonth');
    if (month && !month.value) month.value = monthNow();

    const sup = $('attendanceMatrixSupervisor');
    if (sup && !sup.dataset.v13Label) {
      const label = sup.closest('div')?.querySelector('label');
      if (label) label.textContent = 'المشرف / الفني';
      sup.dataset.v13Label = '1';
    }

    if (sup) {
      const old = sup.value;
      const people = [
        ...users().filter(isSupervisor).map(u => ({ id: 'sup:' + u.id, name: fullName(u), type: 'مشرف' })),
        ...users().filter(isTechnician).map(u => ({ id: 'tech:' + u.id, name: fullName(u), type: 'فني' }))
      ];
      sup.innerHTML = '<option value="">كل المشرفين والفنيين</option>' + people.map(p => `<option value="${esc(p.id)}">${esc(p.type)} - ${esc(p.name)}</option>`).join('');
      if ([...sup.options].some(o => o.value === old)) sup.value = old;
    }

    let type = $('attendanceMatrixTypeV13');
    if (!type && month) {
      const wrap = document.createElement('div');
      wrap.innerHTML = '<label>نوع السجل</label><select id="attendanceMatrixTypeV13" onchange="renderAttendanceMonthly()"><option value="">الكل</option><option value="worker">العمال</option><option value="technician">الفنيين</option></select>';
      month.closest('div')?.after(wrap);
      type = $('attendanceMatrixTypeV13');
    }

    const search = $('attendanceMatrixSearch');
    if (search) search.placeholder = 'بحث باسم العامل أو الفني';
  }

  function entityRows(month){
    const monthRecords = attendance().filter(r => recMonth(r) === month);
    const rows = [];
    const seen = new Set();

    workers().forEach(w => {
      const id = 'worker:' + sid(w.id);
      seen.add(id);
      rows.push({
        key: id,
        type: 'worker',
        label: 'عامل',
        id: sid(w.id),
        name: fullName(w),
        supervisor_id: workerSupervisorId(w),
        supervisor_name: supervisorName(workerSupervisorId(w)),
        project_id: workerProjectId(w),
        project_name: projectName(workerProjectId(w))
      });
    });

    users().filter(isTechnician).forEach(u => {
      const id = 'tech:' + sid(u.id);
      seen.add(id);
      rows.push({
        key: id,
        type: 'technician',
        label: 'فني',
        id: sid(u.id),
        name: fullName(u),
        supervisor_id: sid(u.supervisor_id || u.manager_id || ''),
        supervisor_name: supervisorName(u.supervisor_id || u.manager_id),
        project_id: '',
        project_name: '-'
      });
    });

    monthRecords.forEach(r => {
      const wid = recWorkerId(r);
      if (!wid) return;
      const asTech = users().find(u => sid(u.id) === wid && isTechnician(u));
      const key = (asTech ? 'tech:' : 'worker:') + wid;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({
        key,
        type: asTech ? 'technician' : 'worker',
        label: asTech ? 'فني' : 'عامل',
        id: wid,
        name: asTech ? fullName(asTech) : (fullName(workers().find(w => sid(w.id) === wid)) || S(r.worker_name || r.employee_name || r.name || r.technician_name || wid)),
        supervisor_id: recSupervisorId(r),
        supervisor_name: supervisorName(recSupervisorId(r)),
        project_id: recProjectId(r),
        project_name: projectName(recProjectId(r))
      });
    });

    return rows;
  }

  function latestRecords(month){
    const map = new Map();
    attendance().filter(r => recMonth(r) === month).forEach(r => {
      const wid = recWorkerId(r);
      if (!wid) return;
      const key = wid + '|' + recDate(r);
      const old = map.get(key);
      if (!old || S(r.updated_at || r.created_at || r.id) > S(old.updated_at || old.created_at || old.id)) map.set(key, r);
    });
    return map;
  }

  function passFilters(row, selected, type, q){
    if (type && row.type !== type) return false;
    if (selected) {
      const [kind, id] = selected.split(':');
      if (kind === 'tech' && !(row.type === 'technician' && sid(row.id) === sid(id))) return false;
      if (kind === 'sup' && sid(row.supervisor_id) !== sid(id)) return false;
    }
    if (q && ![row.name, row.supervisor_name, row.project_name, row.label].join(' ').toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }

  window.renderAttendanceMonthly = async function(){
    const body = $('attendanceMatrixBody');
    const head = $('attendanceMatrixHead');
    if (!body || !head) return;
    ensureFilters();

    const month = $('attendanceMatrixMonth')?.value || monthNow();
    if (!loadedMonths.has(month) && window.sb) {
      body.innerHTML = '<tr><td>جاري تحميل سجلات الشهر...</td></tr>';
      await ensureMonthData(month);
      ensureFilters();
    }
    const selected = $('attendanceMatrixSupervisor')?.value || '';
    const type = $('attendanceMatrixTypeV13')?.value || '';
    const q = S($('attendanceMatrixSearch')?.value);
    const days = daysInMonth(month);
    const recs = latestRecords(month);
    let rows = entityRows(month).filter(row => passFilters(row, selected, type, q));

    rows.sort((a,b) => a.type.localeCompare(b.type, 'ar') || a.name.localeCompare(b.name, 'ar'));
    head.innerHTML = '<tr><th>الاسم</th><th>النوع</th><th>المشرف / الفني</th><th>المشروع</th><th>الفترة</th>' +
      Array.from({length: days}, (_, i) => `<th>${String(i+1).padStart(2,'0')}</th>`).join('') + '</tr>';

    let totalPresent = 0, totalAbsent = 0;
    body.innerHTML = rows.map(row => {
      let p = 0, a = 0;
      const cells = Array.from({length: days}, (_, i) => {
        const day = String(i + 1).padStart(2, '0');
        const date = month + '-' + day;
        const rec = recs.get(row.id + '|' + date);
        const st = statusOf(rec);
        if (st === 'present') { p++; totalPresent++; return '<td><span class="att-cell present">ح</span></td>'; }
        if (st === 'absent') { a++; totalAbsent++; return '<td><span class="att-cell absent">غ</span></td>'; }
        return '<td><span class="att-cell">-</span></td>';
      }).join('');
      return `<tr><td><b>${esc(row.name || '-')}</b></td><td>${esc(row.label)}</td><td>${esc(row.supervisor_name || '-')}</td><td>${esc(row.project_name || '-')}</td><td>-</td>${cells}</tr>`;
    }).join('') || `<tr><td colspan="${5 + days}">لا توجد سجلات حسب الفلتر المختار</td></tr>`;

    const sum = $('attendanceMatrixSummary');
    if (sum) {
      const pct = (totalPresent + totalAbsent) ? (totalPresent / (totalPresent + totalAbsent) * 100) : 0;
      sum.innerHTML = `<div class="kpi"><small>عدد الصفوف</small><b>${rows.length}</b></div><div class="kpi"><small>إجمالي الحضور</small><b>${totalPresent}</b></div><div class="kpi"><small>إجمالي الغياب</small><b>${totalAbsent}</b></div><div class="kpi"><small>نسبة الحضور</small><b>${pct.toFixed(1)}%</b></div>`;
    }
  };

  const oldShowPage = window.showPage;
  window.showPage = function(id, btn){
    const result = oldShowPage ? oldShowPage.apply(this, arguments) : undefined;
    if (id === 'attendance') setTimeout(() => window.renderAttendanceMonthly(), 80);
    return result;
  };

  document.addEventListener('change', e => {
    if (e.target && ['attendanceMatrixMonth','attendanceMatrixSupervisor','attendanceMatrixTypeV13'].includes(e.target.id)) setTimeout(() => window.renderAttendanceMonthly(), 20);
  });
  document.addEventListener('input', e => {
    if (e.target && e.target.id === 'attendanceMatrixSearch') setTimeout(() => window.renderAttendanceMonthly(), 20);
  });
  document.addEventListener('DOMContentLoaded', () => setTimeout(() => { if ($('attendanceMatrixBody')) window.renderAttendanceMonthly(); }, 1200));

  console.log('Tasneef attendance technicians v13 loaded');
})();

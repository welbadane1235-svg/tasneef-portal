(function(){
  'use strict';
  if(window.__tasneefAttendanceStatusFixV16) return;
  window.__tasneefAttendanceStatusFixV16 = true;

  const $ = id => document.getElementById(id);
  const A = v => Array.isArray(v) ? v : [];
  const S = v => String(v ?? '').trim();
  const N = v => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const today = () => new Date().toISOString().slice(0, 10);
  const monthNow = () => today().slice(0, 7);
  const say = (text, type) => {
    try { if(typeof window.msg === 'function') window.msg(text, type); else alert(text); }
    catch(_) { alert(text); }
  };

  function ds(){
    window.data = window.data || {};
    return window.data;
  }
  function currentUser(){
    try { if(typeof window.session === 'function') return window.session() || {}; } catch(_) {}
    try { return JSON.parse(localStorage.getItem('tasneef_user') || '{}') || {}; } catch(_) { return {}; }
  }
  function dbStatus(status){
    const st = S(status).toLowerCase();
    if(['absent','غائب','غياب'].includes(st)) return 'غائب';
    return 'حاضر';
  }
  function uiStatus(status){
    const st = S(status).toLowerCase();
    if(['absent','غائب','غياب'].includes(st)) return 'absent';
    if(['present','حاضر','حضور'].includes(st)) return 'present';
    return st || '';
  }
  function esc(v){
    return S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function workerProjectId(w){
    return S(w.project_id || w.assigned_project_id || w.current_project_id || '');
  }
  function workerSupervisorId(w){
    return S(w.app_supervisor_id || w.supervisor_id || w.assigned_supervisor_id || w.manager_id || '');
  }
  function projectName(id){
    return A(ds().projects).find(p => S(p.id) === S(id))?.name || A(ds().projects).find(p => S(p.id) === S(id))?.project_name || '-';
  }
  function workerName(id, rec){
    const w = A(ds().workers).find(x => S(x.id) === S(id));
    const u = A(ds().users).find(x => S(x.id) === S(id));
    return S(w?.name || u?.full_name || u?.name || u?.username || rec?.worker_name || rec?.technician_name || id || '-');
  }
  function supervisorName(id){
    const u = A(ds().users).find(x => S(x.id) === S(id)) || A(ds().supervisors).find(x => S(x.id) === S(id));
    return S(u?.full_name || u?.name || u?.username || '-');
  }
  function daysInMonth(month){
    const y = Number(month.slice(0,4));
    const m = Number(month.slice(5,7));
    return new Date(y, m, 0).getDate();
  }
  function monthEnd(month){
    return month + '-' + String(daysInMonth(month)).padStart(2, '0');
  }
  function recordDate(r){ return S(r.attendance_date || r.date || r.created_at).slice(0, 10); }
  function recordMonth(r){ return recordDate(r).slice(0, 7); }

  async function reloadAttendanceMonth(month){
    if(!window.sb) return;
    const [att, wrk, usr, prj] = await Promise.all([
      window.sb.from('attendance').select('*').gte('attendance_date', month + '-01').lte('attendance_date', monthEnd(month)).order('attendance_date', {ascending:false}).limit(5000),
      window.sb.from('workers').select('*').limit(3000),
      window.sb.from('app_users').select('*').limit(1500),
      window.sb.from('projects').select('*').limit(1500)
    ]);
    if(!att.error) ds().attendance = A(att.data);
    if(!wrk.error) ds().workers = A(wrk.data);
    if(!usr.error) {
      ds().users = A(usr.data);
      ds().supervisors = A(usr.data).filter(u => ['supervisor','مشرف','manager','مدير عام','operational_manager','مدير تشغيلي'].includes(S(u.role)));
    }
    if(!prj.error) ds().projects = A(prj.data);
  }

  function selectedWorkerRowsForSupervisor(){
    const u = currentUser();
    const selectedProject = S($('attendanceProject')?.value);
    const cards = A([...document.querySelectorAll('#supervisorAttendanceList [data-worker-card-v343]')]);
    if(cards.length) {
      return cards.map(card => {
        const select = card.querySelector('select.att-status-v343, select[data-worker]');
        if(!select) return null;
        const wid = S(select.dataset.worker || select.dataset.workerId);
        const worker = A(ds().workers).find(w => S(w.id) === wid) || {};
        const pid = S(select.dataset.project || selectedProject || workerProjectId(worker));
        const note = S(card.querySelector('.att-v343-note, input[data-note-worker]')?.value);
        return {wid, pid, status: select.value, note};
      }).filter(Boolean);
    }
    return A([...document.querySelectorAll('#supervisorAttendanceList select[data-worker], #supervisorAttendanceList select.att-status-v343')]).map(select => {
      const wid = S(select.dataset.worker || select.dataset.workerId);
      const worker = A(ds().workers).find(w => S(w.id) === wid) || {};
      const note = S(document.querySelector(`[data-note-worker="${wid}"], input.att-note-v343[data-worker="${wid}"], input.att-v343-note[data-worker="${wid}"]`)?.value);
      return {wid, pid: S(select.dataset.project || selectedProject || workerProjectId(worker)), status: select.value, note};
    });
  }

  async function upsertAttendanceRows(rows, date){
    if(!window.sb) throw new Error('الاتصال بقاعدة البيانات غير جاهز');
    if(!rows.length) throw new Error('لا يوجد سجلات للحفظ');
    const ids = rows.map(r => r.worker_id);
    const found = await window.sb.from('attendance').select('id,worker_id').eq('attendance_date', date).in('worker_id', ids);
    if(found.error) throw found.error;
    const byWorker = new Map(A(found.data).map(r => [S(r.worker_id), r.id]));
    const inserts = [];
    for(const row of rows){
      const id = byWorker.get(S(row.worker_id));
      const res = id ? await window.sb.from('attendance').update(row).eq('id', id) : null;
      if(id && res.error) throw res.error;
      if(!id) inserts.push(row);
    }
    if(inserts.length){
      const res = await window.sb.from('attendance').insert(inserts);
      if(res.error) throw res.error;
    }
  }

  window.saveSupervisorAttendance = async function(){
    try{
      const u = currentUser();
      const date = $('attendanceDate')?.value || today();
      const shift = S($('attendanceShiftType')?.value);
      const rows = selectedWorkerRowsForSupervisor().map(r => ({
        attendance_date: date,
        worker_id: N(r.wid) || r.wid,
        supervisor_id: N(u.id) || u.id,
        project_id: r.pid ? (N(r.pid) || r.pid) : null,
        status: dbStatus(r.status),
        notes: `${shift ? 'الفترة: ' + shift : ''}${r.note ? (shift ? ' | ' : '') + r.note : ''}`,
        created_by: N(u.id) || u.id
      }));
      await upsertAttendanceRows(rows, date);
      say('تم حفظ التحضير بنجاح');
      await reloadAttendanceMonth(date.slice(0,7));
      try { window.renderSupervisorAttendanceList && window.renderSupervisorAttendanceList(); } catch(_) {}
      try { window.renderAttendanceMonthly && window.renderAttendanceMonthly(); } catch(_) {}
    }catch(e){
      say(e.message || String(e), 'err');
    }
  };

  function techId(){
    const u = currentUser();
    return S(u.id || u.user_id || u.username || '');
  }
  function techName(){
    const u = currentUser();
    return S(u.full_name || u.name || u.username || 'الفني');
  }
  function localTechStore(){
    try { return JSON.parse(localStorage.getItem('tasneef_technician_attendance_v310') || '{}') || {}; }
    catch(_) { return {}; }
  }
  function setLocalTechRow(row){
    try {
      const store = localTechStore();
      const id = techId();
      store[id] = store[id] || {};
      store[id][row.date] = row;
      localStorage.setItem('tasneef_technician_attendance_v310', JSON.stringify(store));
    } catch(_) {}
  }
  async function saveTechnicianAttendance(status){
    try{
      const u = currentUser();
      const date = today();
      const note = S($('techAttendanceNote')?.value || $('techNote')?.value);
      const old = (localTechStore()[techId()] || {})[date] || {};
      const rowLocal = {
        ...old,
        date,
        tech_id: techId(),
        tech_name: techName(),
        status: status === 'absent' ? 'absent' : 'present',
        check_in: status === 'absent' ? '' : (old.check_in || new Date().toTimeString().slice(0,5)),
        check_out: status === 'checkout' ? new Date().toTimeString().slice(0,5) : (old.check_out || ''),
        note
      };
      setLocalTechRow(rowLocal);
      if(window.sb){
        const dbRow = {
          attendance_date: date,
          worker_id: N(u.id) || u.id,
          supervisor_id: N(u.supervisor_id || u.manager_id) || null,
          project_id: null,
          status: dbStatus(status === 'absent' ? 'absent' : 'present'),
          notes: `فني: ${techName()}${rowLocal.check_in ? ' | دخول: ' + rowLocal.check_in : ''}${rowLocal.check_out ? ' | خروج: ' + rowLocal.check_out : ''}${note ? ' | ' + note : ''}`,
          created_by: N(u.id) || u.id
        };
        await upsertAttendanceRows([dbRow], date);
      }
      say(status === 'checkout' ? 'تم حفظ خروج الفني' : 'تم حفظ حضور/غياب الفني');
      try { window.renderTechAttendance && window.renderTechAttendance(); } catch(_) {}
    }catch(e){
      say(e.message || String(e), 'err');
    }
  }
  window.techAttendanceCheckIn = function(){ saveTechnicianAttendance('present'); };
  window.techAttendanceCheckOut = function(){ saveTechnicianAttendance('checkout'); };
  window.techAttendanceAbsent = function(){ saveTechnicianAttendance('absent'); };

  window.renderAttendanceMonthly = async function(){
    const body = $('attendanceMatrixBody');
    const head = $('attendanceMatrixHead');
    if(!body || !head) return;
    const monthEl = $('attendanceMatrixMonth');
    if(monthEl && !monthEl.value) monthEl.value = monthNow();
    const month = monthEl?.value || monthNow();
    body.innerHTML = '<tr><td>جاري تحميل سجلات الشهر...</td></tr>';
    try { await reloadAttendanceMonth(month); }
    catch(e) { console.warn('attendance v16 load failed', e); }

    const selected = S($('attendanceMatrixSupervisor')?.value);
    const q = S($('attendanceMatrixSearch')?.value).toLowerCase();
    const type = S($('attendanceMatrixTypeV13')?.value);
    const days = daysInMonth(month);
    const records = A(ds().attendance).filter(r => recordMonth(r) === month);
    const latest = new Map();
    records.forEach(r => {
      const wid = S(r.worker_id || r.user_id || r.technician_id);
      if(!wid) return;
      const key = wid + '|' + recordDate(r);
      const old = latest.get(key);
      if(!old || S(r.updated_at || r.created_at || r.id) > S(old.updated_at || old.created_at || old.id)) latest.set(key, r);
    });

    const rows = [];
    const seen = new Set();
    A(ds().workers).forEach(w => {
      const key = S(w.id);
      seen.add(key);
      rows.push({id:key, kind:'worker', label:'عامل', name:S(w.name || w.full_name || w.username || key), supervisor_id:workerSupervisorId(w), project_id:workerProjectId(w)});
    });
    A(ds().users).filter(u => ['technician','فني'].includes(S(u.role))).forEach(u => {
      const key = S(u.id);
      seen.add(key);
      rows.push({id:key, kind:'technician', label:'فني', name:S(u.full_name || u.name || u.username || key), supervisor_id:S(u.supervisor_id || u.manager_id), project_id:''});
    });
    records.forEach(r => {
      const id = S(r.worker_id || r.user_id || r.technician_id);
      if(!id || seen.has(id)) return;
      seen.add(id);
      rows.push({id, kind:'record', label:'سجل', name:workerName(id,r), supervisor_id:S(r.supervisor_id || r.created_by), project_id:S(r.project_id || '')});
    });

    const filtered = rows.filter(r => {
      if(type === 'worker' && r.kind === 'technician') return false;
      if(type === 'technician' && r.kind !== 'technician') return false;
      if(selected){
        if(selected.startsWith('tech:') && !(r.kind === 'technician' && S(r.id) === selected.replace('tech:',''))) return false;
        if(selected.startsWith('sup:') && S(r.supervisor_id) !== selected.replace('sup:','')) return false;
        if(!selected.includes(':') && S(r.supervisor_id) !== selected) return false;
      }
      if(q && ![r.name, supervisorName(r.supervisor_id), projectName(r.project_id), r.label].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });

    head.innerHTML = '<tr><th>الاسم</th><th>النوع</th><th>المشرف / الفني</th><th>المشروع</th><th>الفترة</th>' +
      Array.from({length:days}, (_,i)=>`<th>${String(i+1).padStart(2,'0')}</th>`).join('') + '</tr>';
    let totalP = 0, totalA = 0;
    body.innerHTML = filtered.map(r => {
      const cells = [];
      for(let d=1; d<=days; d++){
        const date = month + '-' + String(d).padStart(2,'0');
        const rec = latest.get(r.id + '|' + date);
        const st = uiStatus(rec?.status);
        if(st === 'present'){ totalP++; cells.push('<td><span class="att-cell att-present">ح</span></td>'); }
        else if(st === 'absent'){ totalA++; cells.push('<td><span class="att-cell att-absent">غ</span></td>'); }
        else cells.push('<td><span class="att-cell att-empty">-</span></td>');
      }
      return `<tr><td><b>${esc(r.name || '-')}</b></td><td>${esc(r.label)}</td><td>${esc(supervisorName(r.supervisor_id))}</td><td>${esc(projectName(r.project_id))}</td><td>-</td>${cells.join('')}</tr>`;
    }).join('') || `<tr><td colspan="${5+days}">لا توجد سجلات حضور حسب الفلتر المختار</td></tr>`;

    const sum = $('attendanceMatrixSummary');
    if(sum){
      const pct = (totalP + totalA) ? (totalP / (totalP + totalA) * 100) : 0;
      sum.innerHTML = `<div class="kpi"><small>عدد الصفوف</small><b>${filtered.length}</b></div><div class="kpi"><small>إجمالي الحضور</small><b>${totalP}</b></div><div class="kpi"><small>إجمالي الغياب</small><b>${totalA}</b></div><div class="kpi"><small>نسبة الحضور</small><b>${pct.toFixed(1)}%</b></div>`;
    }
  };
  try { renderAttendanceMonthly = window.renderAttendanceMonthly; } catch(_) {}

  document.addEventListener('change', e => {
    if(e.target && ['attendanceMatrixMonth','attendanceMatrixSupervisor','attendanceMatrixTypeV13'].includes(e.target.id)){
      setTimeout(() => window.renderAttendanceMonthly && window.renderAttendanceMonthly(), 30);
    }
  });
  document.addEventListener('input', e => {
    if(e.target && e.target.id === 'attendanceMatrixSearch'){
      setTimeout(() => window.renderAttendanceMonthly && window.renderAttendanceMonthly(), 30);
    }
  });
  document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
    try { if($('attendanceMatrixBody')) window.renderAttendanceMonthly(); } catch(e) { console.warn(e); }
  }, 1200));

  console.log('Tasneef attendance status fix v16 loaded');
})();

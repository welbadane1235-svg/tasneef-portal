(function(){
  'use strict';
  if(window.__tasneefAttendanceBulkReportV49) return;
  window.__tasneefAttendanceBulkReportV49 = true;

  const $ = id => document.getElementById(id);
  const A = v => Array.isArray(v) ? v : [];
  const S = v => String(v ?? '').trim();
  const esc = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const ds = () => (window.data = window.data || {});
  const today = () => new Date().toISOString().slice(0, 10);
  const monthNow = () => today().slice(0, 7);
  const targetDays = [1, 2, 3, 4, 6];

  function say(text, type){
    try{ if(typeof window.msg === 'function') window.msg(text, type); else alert(text); }
    catch(_){ alert(text); }
  }
  function currentUser(){
    try{ if(typeof window.session === 'function') return window.session() || {}; }catch(_){}
    try{ return JSON.parse(localStorage.getItem('tasneef_user') || '{}') || {}; }catch(_){ return {}; }
  }
  function monthEnd(month){
    const y = Number(month.slice(0,4));
    const m = Number(month.slice(5,7));
    return month + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0');
  }
  function recDate(r){ return S(r.attendance_date || r.date || r.created_at).slice(0,10); }
  function recMonth(r){ return recDate(r).slice(0,7); }
  function statusKey(v){
    const s = S(v).toLowerCase();
    if(['present','حاضر','حضور'].includes(s)) return 'present';
    if(['absent','غائب','غياب'].includes(s)) return 'absent';
    return '';
  }
  function isFriday(date){ return new Date(date + 'T00:00:00').getDay() === 5; }
  function isActive(row){
    const status = S(row.status || row.is_active || 'active').toLowerCase();
    return row.is_active !== false && !['inactive','disabled','محذوف','موقوف'].includes(status);
  }
  function roleOf(row){ return S(row.role || row.user_role).toLowerCase(); }
  function personName(row){ return S(row.full_name || row.name || row.worker_name || row.username || row.id || '-'); }
  function workerSupervisorId(row){ return S(row.app_supervisor_id || row.supervisor_id || row.assigned_supervisor_id || row.manager_id || ''); }
  function workerProjectId(row){ return S(row.project_id || row.assigned_project_id || row.current_project_id || ''); }
  function projectName(id){
    const p = A(ds().projects).find(x => S(x.id) === S(id));
    return S(p?.name || p?.project_name || '-');
  }
  function supervisorName(id){
    if(!S(id) || S(id) === 'none') return 'بدون مشرف';
    const u = A(ds().users).find(x => S(x.id) === S(id)) || A(ds().supervisors).find(x => S(x.id) === S(id));
    return personName(u || {name:id});
  }
  function workers(){
    return A(ds().workers).filter(isActive);
  }
  function technicians(){
    return A(ds().users).filter(u => isActive(u) && ['technician','فني'].includes(roleOf(u)));
  }
  async function reloadMonth(month){
    if(!window.sb) return;
    const [att, wrk, usr, prj] = await Promise.all([
      window.sb.from('attendance').select('*').gte('attendance_date', month + '-01').lte('attendance_date', monthEnd(month)).limit(10000),
      window.sb.from('workers').select('*').limit(5000),
      window.sb.from('app_users').select('*').limit(3000),
      window.sb.from('projects').select('*').limit(3000)
    ]);
    if(!att.error) ds().attendance = A(att.data);
    if(!wrk.error) ds().workers = A(wrk.data);
    if(!usr.error){
      ds().users = A(usr.data);
      ds().supervisors = A(usr.data).filter(u => ['supervisor','مشرف','operations_manager','operational_manager','admin','general_manager','مدير عام','مدير تشغيل'].includes(roleOf(u)));
    }
    if(!prj.error) ds().projects = A(prj.data);
  }
  function targetPeople(){
    const rows = [];
    workers().forEach(w => rows.push({
      id:S(w.id),
      worker_id:w.id,
      name:personName(w),
      kind:'worker',
      label:'عامل',
      supervisor_id:workerSupervisorId(w),
      project_id:workerProjectId(w)
    }));
    technicians().forEach(u => rows.push({
      id:S(u.id),
      worker_id:u.id,
      name:personName(u),
      kind:'technician',
      label:'فني',
      supervisor_id:S(u.supervisor_id || u.manager_id || ''),
      project_id:S(u.project_id || '')
    }));
    return rows.filter(p => p.id);
  }
  async function upsertAttendanceRows(rows){
    if(!window.sb) throw new Error('الاتصال بقاعدة البيانات غير جاهز');
    if(!rows.length) return;
    const unique = new Map();
    rows.forEach(row => unique.set(S(row.attendance_date) + '|' + S(row.worker_id), row));
    const cleanRows = [...unique.values()];
    for(let i = 0; i < cleanRows.length; i += 400){
      const chunk = cleanRows.slice(i, i + 400);
      const res = await window.sb.from('attendance').upsert(chunk, { onConflict:'attendance_date,worker_id' });
      if(res.error) throw res.error;
    }
  }

  window.tasneefMarkDaysPresentV49 = async function(){
    try{
      const month = $('attendanceMatrixMonth')?.value || monthNow();
      await reloadMonth(month);
      const user = currentUser();
      const rows = [];
      targetPeople().forEach(person => {
        targetDays.forEach(day => {
          rows.push({
            attendance_date: month + '-' + String(day).padStart(2, '0'),
            worker_id: person.worker_id,
            supervisor_id: person.supervisor_id || null,
            project_id: person.project_id || null,
            status: 'حاضر',
            notes: 'اعتماد حضور جماعي للأيام 1-2-3-4-6',
            created_by: user.id || null
          });
        });
      });
      await upsertAttendanceRows(rows);
      await reloadMonth(month);
      try{ window.renderAttendanceMonthly && await window.renderAttendanceMonthly(); }catch(_){}
      setTimeout(installButtons, 150);
      say('تم اعتماد حضور الجميع للأيام 1 و 2 و 3 و 4 و 6');
    }catch(e){
      say(e.message || String(e), 'err');
    }
  };

  function latestRecords(month){
    const map = new Map();
    A(ds().attendance).filter(row => recMonth(row) === month).forEach(row => {
      const wid = S(row.worker_id || row.user_id || row.technician_id);
      const key = wid + '|' + recDate(row);
      const old = map.get(key);
      if(!old || S(row.updated_at || row.created_at || row.id) > S(old.updated_at || old.created_at || old.id)) map.set(key, row);
    });
    return map;
  }
  function personStats(person, records, month){
    let present = 0;
    let absent = 0;
    const fridayAbsences = [];
    const absentDates = [];
    const lastDay = Number(monthEnd(month).slice(-2));
    for(let day = 1; day <= lastDay; day++){
      const date = month + '-' + String(day).padStart(2, '0');
      const rec = records.get(S(person.id) + '|' + date);
      const status = statusKey(rec?.status);
      if(status === 'present') present++;
      if(status === 'absent'){
        absent++;
        absentDates.push(date);
        if(isFriday(date)) fridayAbsences.push(date);
      }
    }
    return {present, absent, absentDates, fridayAbsences};
  }
  function groupedWorkers(){
    const groups = new Map();
    workers().forEach(worker => {
      const sup = workerSupervisorId(worker) || 'none';
      if(!groups.has(sup)) groups.set(sup, []);
      groups.get(sup).push({
        id:S(worker.id),
        name:personName(worker),
        label:'عامل',
        project:projectName(workerProjectId(worker))
      });
    });
    return [...groups.entries()].map(([sup, people]) => ({sup, title:supervisorName(sup), people}));
  }
  function absentText(stats){
    if(!stats.absentDates.length) return '-';
    return stats.absentDates.map(date => isFriday(date) ? `${date} (جمعة)` : date).join('، ');
  }
  function printHtml(month, records){
    const groupsHtml = groupedWorkers().map(group => {
      const rows = group.people.map(person => {
        const st = personStats(person, records, month);
        return `<tr><td>${esc(person.name)}</td><td>${esc(person.label)}</td><td>${esc(person.project)}</td><td>${st.present}</td><td>${st.absent}</td><td>${esc(absentText(st))}</td></tr>`;
      }).join('') || '<tr><td colspan="6">لا يوجد عمال لهذا المشرف</td></tr>';
      return `<section><h2>المشرف: ${esc(group.title)}</h2><table><thead><tr><th>الاسم</th><th>النوع</th><th>المشروع</th><th>حضور</th><th>غياب</th><th>تفصيل الغياب</th></tr></thead><tbody>${rows}</tbody></table></section>`;
    }).join('');
    const techRows = technicians().map(tech => {
      const st = personStats({id:S(tech.id)}, records, month);
      return `<tr><td>${esc(personName(tech))}</td><td>فني</td><td>-</td><td>${st.present}</td><td>${st.absent}</td><td>${esc(absentText(st))}</td></tr>`;
    }).join('') || '<tr><td colspan="6">لا يوجد فنيين</td></tr>';
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الحضور والغياب</title><style>
      body{font-family:Tahoma,Arial,sans-serif;margin:18px;color:#073f32;background:#fff}h1{margin:0 0 12px;font-size:24px}h2{background:#074b3b;color:#fff;border-radius:10px;padding:10px 12px;margin:18px 0 8px;font-size:18px}table{width:100%;border-collapse:collapse;margin-bottom:12px}th,td{border:1px solid #dce8e3;padding:8px;text-align:right;font-size:13px}th{background:#eef7f4}.meta{border:1px solid #dce8e3;border-radius:12px;padding:12px;margin-bottom:12px}.hint{color:#687b74;margin-top:8px}@media print{body{margin:8mm}section{break-inside:avoid}h2{break-after:avoid}}
    </style></head><body><h1>تقرير الحضور والغياب الشهري</h1><div class="meta">الشهر: <b>${esc(month)}</b><div class="hint">أي غياب في يوم الجمعة يظهر بجانب التاريخ بكلمة (جمعة).</div></div>${groupsHtml}<section><h2>الفنيين</h2><table><thead><tr><th>الاسم</th><th>النوع</th><th>المشروع</th><th>حضور</th><th>غياب</th><th>تفصيل الغياب</th></tr></thead><tbody>${techRows}</tbody></table></section><script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`;
  }
  window.tasneefPrintAttendanceReportV49 = async function(){
    try{
      const month = $('attendanceMatrixMonth')?.value || monthNow();
      await reloadMonth(month);
      const html = printHtml(month, latestRecords(month));
      const win = window.open('', '_blank');
      if(!win) return say('اسمح بفتح النوافذ حتى يظهر التقرير', 'err');
      win.document.write(html);
      win.document.close();
    }catch(e){
      say(e.message || String(e), 'err');
    }
  };

  function installButtons(){
    const summary = $('attendanceMatrixSummary');
    if(!summary || $('attendanceBulkActionsV49')) return;
    const box = document.createElement('div');
    box.id = 'attendanceBulkActionsV49';
    box.className = 'actions';
    box.style.margin = '10px 0';
    box.innerHTML = '<button type="button" onclick="tasneefMarkDaysPresentV49()">اعتماد حضور أيام 1-2-3-4-6</button><button type="button" class="light" onclick="tasneefPrintAttendanceReportV49()">طباعة تقرير المشرفين والفنيين</button>';
    summary.insertAdjacentElement('afterend', box);
  }
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(installButtons, 800);
    setTimeout(installButtons, 1800);
  });
  document.addEventListener('click', () => setTimeout(installButtons, 120), true);
  window.addEventListener('load', () => setTimeout(installButtons, 800));
})();

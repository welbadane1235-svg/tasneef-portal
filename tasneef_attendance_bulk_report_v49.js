(function(){
  'use strict';
  if(window.__tasneefAttendanceReportBulkV48) return;
  window.__tasneefAttendanceReportBulkV48 = true;

  const $ = id => document.getElementById(id);
  const A = v => Array.isArray(v) ? v : [];
  const S = v => String(v ?? '').trim();
  const esc = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const today = () => new Date().toISOString().slice(0, 10);
  const ds = () => (window.data = window.data || {});
  const monthNow = () => today().slice(0, 7);
  const isFriday = date => new Date(date + 'T00:00:00').getDay() === 5;
  const daysTarget = [1, 2, 3, 4, 6];

  function say(text, type){
    try{ if(typeof window.msg === 'function') window.msg(text, type); else alert(text); }
    catch(_){ alert(text); }
  }
  function currentUser(){
    try{ if(typeof window.session === 'function') return window.session() || {}; }catch(_){}
    try{ return JSON.parse(localStorage.getItem('tasneef_user') || '{}') || {}; }catch(_){ return {}; }
  }
  function monthEnd(month){
    const y=Number(month.slice(0,4)), m=Number(month.slice(5,7));
    return month + '-' + String(new Date(y, m, 0).getDate()).padStart(2,'0');
  }
  function recDate(r){ return S(r.attendance_date || r.date || r.created_at).slice(0,10); }
  function recMonth(r){ return recDate(r).slice(0,7); }
  function statusOf(v){
    const s=S(v).toLowerCase();
    if(['present','حاضر','حضور'].includes(s)) return 'present';
    if(['absent','غائب','غياب'].includes(s)) return 'absent';
    return '';
  }
  function workerSupId(w){ return S(w.app_supervisor_id || w.supervisor_id || w.assigned_supervisor_id || w.manager_id || ''); }
  function workerProjectId(w){ return S(w.project_id || w.assigned_project_id || w.current_project_id || ''); }
  function userName(u){ return S(u.full_name || u.name || u.username || u.id || '-'); }
  function supervisorName(id){
    const u=A(ds().users).find(x=>S(x.id)===S(id)) || A(ds().supervisors).find(x=>S(x.id)===S(id));
    return userName(u || {full_name:'بدون مشرف'});
  }
  function projectName(id){
    const p=A(ds().projects).find(x=>S(x.id)===S(id));
    return S(p?.name || p?.project_name || '-');
  }
  function workers(){
    return A(ds().workers).filter(w => S(w.status || 'active') !== 'inactive');
  }
  function technicians(){
    return A(ds().users).filter(u => ['technician','فني'].includes(S(u.role)) && S(u.is_active ?? u.status ?? 'true') !== 'false' && S(u.status || 'active') !== 'inactive');
  }
  async function reloadMonth(month){
    if(!window.sb) return;
    const [att, wrk, usr, prj] = await Promise.all([
      window.sb.from('attendance').select('*').gte('attendance_date', month + '-01').lte('attendance_date', monthEnd(month)).limit(8000),
      window.sb.from('workers').select('*').limit(4000),
      window.sb.from('app_users').select('*').limit(2000),
      window.sb.from('projects').select('*').limit(2000)
    ]);
    if(!att.error) ds().attendance = A(att.data);
    if(!wrk.error) ds().workers = A(wrk.data);
    if(!usr.error){
      ds().users = A(usr.data);
      ds().supervisors = A(usr.data).filter(u => ['supervisor','مشرف','operations_manager','operational_manager','مدير تشغيلي','admin','مدير عام'].includes(S(u.role)));
    }
    if(!prj.error) ds().projects = A(prj.data);
  }
  function targetPeople(){
    const rows = [];
    workers().forEach(w => rows.push({
      id:S(w.id),
      worker_id:w.id,
      name:S(w.name || w.full_name || '-'),
      kind:'worker',
      label:'عامل',
      supervisor_id:workerSupId(w),
      project_id:workerProjectId(w)
    }));
    technicians().forEach(u => rows.push({
      id:S(u.id),
      worker_id:u.id,
      name:userName(u),
      kind:'technician',
      label:'فني',
      supervisor_id:S(u.supervisor_id || u.manager_id || ''),
      project_id:''
    }));
    return rows.filter(p => p.id);
  }
  async function upsertRows(rows){
    if(!window.sb) throw new Error('الاتصال بقاعدة البيانات غير جاهز');
    if(!rows.length) return;
    const byDate = {};
    rows.forEach(r => {
      byDate[r.attendance_date] = byDate[r.attendance_date] || [];
      byDate[r.attendance_date].push(r);
    });
    for(const date of Object.keys(byDate)){
      const group = byDate[date];
      const ids = group.map(r => r.worker_id);
      const found = await window.sb.from('attendance').select('id,worker_id').eq('attendance_date', date).in('worker_id', ids);
      if(found.error) throw found.error;
      const map = new Map(A(found.data).map(r => [S(r.worker_id), r.id]));
      const inserts = [];
      for(const row of group){
        const id = map.get(S(row.worker_id));
        if(id){
          const res = await window.sb.from('attendance').update(row).eq('id', id);
          if(res.error) throw res.error;
        }else{
          inserts.push(row);
        }
      }
      if(inserts.length){
        const res = await window.sb.from('attendance').insert(inserts);
        if(res.error) throw res.error;
      }
    }
  }

  window.tasneefMarkDaysPresentV48 = async function(){
    try{
      const month = $('attendanceMatrixMonth')?.value || monthNow();
      await reloadMonth(month);
      const u = currentUser();
      const people = targetPeople();
      const rows = [];
      people.forEach(p => {
        daysTarget.forEach(d => {
          const date = month + '-' + String(d).padStart(2,'0');
          rows.push({
            attendance_date: date,
            worker_id: p.worker_id,
            supervisor_id: p.supervisor_id || null,
            project_id: p.project_id || null,
            status: 'حاضر',
            notes: 'اعتماد حضور جماعي للأيام 1-2-3-4-6',
            created_by: u.id || null
          });
        });
      });
      await upsertRows(rows);
      await reloadMonth(month);
      try{ window.renderAttendanceMonthly && await window.renderAttendanceMonthly(); }catch(_){}
      say('تم اعتماد حضور الجميع للأيام 1 و 2 و 3 و 4 و 6');
    }catch(e){
      say(e.message || String(e), 'err');
    }
  };

  function latestRecords(month){
    const map = new Map();
    A(ds().attendance).filter(r => recMonth(r) === month).forEach(r => {
      const wid = S(r.worker_id || r.user_id || r.technician_id);
      const key = wid + '|' + recDate(r);
      const old = map.get(key);
      if(!old || S(r.updated_at || r.created_at || r.id) > S(old.updated_at || old.created_at || old.id)) map.set(key, r);
    });
    return map;
  }
  function personStats(person, map, month){
    let present = 0, absent = 0;
    const absentFridays = [];
    for(let d=1; d<=Number(monthEnd(month).slice(-2)); d++){
      const date = month + '-' + String(d).padStart(2,'0');
      const rec = map.get(S(person.id) + '|' + date);
      const st = statusOf(rec?.status);
      if(st === 'present') present++;
      if(st === 'absent'){
        absent++;
        if(isFriday(date)) absentFridays.push(date);
      }
    }
    return {present, absent, absentFridays};
  }
  function groupBySupervisor(month, map){
    const groups = new Map();
    workers().forEach(w => {
      const sup = workerSupId(w) || 'none';
      if(!groups.has(sup)) groups.set(sup, []);
      groups.get(sup).push({
        id:S(w.id),
        name:S(w.name || w.full_name || '-'),
        label:'عامل',
        project:projectName(workerProjectId(w))
      });
    });
    return [...groups.entries()].map(([sup, people]) => ({sup, title:supervisorName(sup), people}));
  }
  window.tasneefPrintAttendanceSupervisorReportV48 = async function(){
    try{
      const month = $('attendanceMatrixMonth')?.value || monthNow();
      await reloadMonth(month);
      const map = latestRecords(month);
      const groups = groupBySupervisor(month, map);
      const groupHtml = groups.map(g => {
        const rows = g.people.map(p => {
          const st = personStats(p, map, month);
          return `<tr><td>${esc(p.name)}</td><td>${esc(p.label)}</td><td>${esc(p.project)}</td><td>${st.present}</td><td>${st.absent}</td><td>${st.absentFridays.length ? esc(st.absentFridays.join('، ')) + ' - يوم جمعة' : '-'}</td></tr>`;
        }).join('') || '<tr><td colspan="6">لا يوجد عمال</td></tr>';
        return `<section><h2>المشرف: ${esc(g.title)}</h2><table><thead><tr><th>الاسم</th><th>النوع</th><th>المشروع</th><th>حضور</th><th>غياب</th><th>غياب يوم الجمعة</th></tr></thead><tbody>${rows}</tbody></table></section>`;
      }).join('');
      const techRows = technicians().map(t => {
        const st = personStats({id:S(t.id)}, map, month);
        return `<tr><td>${esc(userName(t))}</td><td>فني</td><td>-</td><td>${st.present}</td><td>${st.absent}</td><td>${st.absentFridays.length ? esc(st.absentFridays.join('، ')) + ' - يوم جمعة' : '-'}</td></tr>`;
      }).join('') || '<tr><td colspan="6">لا يوجد فنيين</td></tr>';
      const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الحضور والغياب</title><style>
        body{font-family:Tahoma,Arial,sans-serif;margin:18px;color:#0a4033}h1{margin:0 0 12px}h2{background:#0a4033;color:#fff;border-radius:12px;padding:10px;margin:18px 0 8px}table{width:100%;border-collapse:collapse;margin-bottom:12px}th,td{border:1px solid #dce6e2;padding:8px;text-align:right}th{background:#eef6f3}.meta{border:1px solid #dce6e2;border-radius:14px;padding:12px;margin-bottom:12px}.footer{margin-top:18px;color:#60706a}@media print{body{margin:8mm}h2{break-after:avoid}section{break-inside:avoid}}
      </style></head><body><h1>تقرير الحضور والغياب الشهري</h1><div class="meta">الشهر: <b>${esc(month)}</b><br>ملاحظة: إذا كان الغياب في يوم جمعة يظهر في عمود مستقل.</div>${groupHtml}<section><h2>الفنيين</h2><table><thead><tr><th>الاسم</th><th>النوع</th><th>المشروع</th><th>حضور</th><th>غياب</th><th>غياب يوم الجمعة</th></tr></thead><tbody>${techRows}</tbody></table></section><div class="footer">شركة تصنيف لإدارة المرافق</div><script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`;
      const w = window.open('', '_blank');
      if(w){ w.document.write(html); w.document.close(); }
    }catch(e){
      say(e.message || String(e), 'err');
    }
  };

  function installButtons(){
    const summary = $('attendanceMatrixSummary');
    if(!summary || $('attendanceBulkActionsV48')) return;
    const box = document.createElement('div');
    box.id = 'attendanceBulkActionsV48';
    box.className = 'actions';
    box.innerHTML = '<button onclick="tasneefMarkDaysPresentV48()">اعتماد حضور أيام 1-2-3-4-6</button><button class="light" onclick="tasneefPrintAttendanceSupervisorReportV48()">طباعة تقرير المشرفين والفنيين</button>';
    summary.insertAdjacentElement('afterend', box);
  }
  document.addEventListener('DOMContentLoaded', () => setTimeout(installButtons, 900));
  document.addEventListener('click', () => setTimeout(installButtons, 100), true);
  window.addEventListener('load', () => setTimeout(installButtons, 1000));
})();

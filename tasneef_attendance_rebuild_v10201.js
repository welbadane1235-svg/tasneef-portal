/* ===== V10201 ROOT REBUILD: Attendance section rebuilt from zero, data preserved ===== */
(function(){
  'use strict';
  if(window.__tasneefAttendanceRebuildV10201) return; window.__tasneefAttendanceRebuildV10201=true;
  const VERSION='10201';
  const S=v=>String(v??'').trim(); const id=v=>S(v); const N=v=>{const n=Number(v||0);return Number.isFinite(n)?n:0};
  const $=x=>document.getElementById(x);
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>S(v).replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/\s+/g,' ').toLowerCase();
  const D=()=>{try{return window.data||data||{}}catch(_){return {}}};
  const today=()=>{try{return window.today()}catch(_){return new Date().toISOString().slice(0,10)}};
  const monthNow=()=>today().slice(0,7);
  const message=(t,kind)=>{try{ if(typeof window.msg==='function') window.msg(t,kind==='err'?'err':undefined); }catch(_){} const m=$('attRbMsg'); if(m){m.textContent=t; m.className='att-rb-msg '+(kind||'ok')}};
  const st={loaded:false,users:[],projects:[],workers:[],attendance:[]};
  function userName(u){return S(u?.full_name||u?.name||u?.username||'-')}
  function projectName(p){return S(p?.name||p?.project_name||p?.title||'-')}
  function workerName(w){return S(w?.name||w?.full_name||w?.worker_name||'-')}
  function supIdOfProject(p){return id(p?.supervisor_id||p?.current_supervisor_id||p?.manager_id||'')}
  function workerProjectId(w){return id(w?.project_id||w?.assigned_project_id||w?.current_project_id||w?.main_project_id||'')}
  function workerSupId(w){return id(w?.supervisor_id||w?.current_supervisor_id||w?.manager_id||'')}
  function isActive(x){ if(!x) return false; if(x.deleted_at||x.is_deleted===true||x.deleted===true||x.archived===true) return false; if(x.is_active===false||x.active===false) return false; const s=norm(x.status||'active'); return !['inactive','deleted','archived','stopped','محذوف','موقوف','متوقف'].includes(s); }
  function supervisors(){return st.users.filter(u=>isActive(u)&&(S(u.role||'').includes('supervisor')||S(u.role||'')==='مشرف'||u.is_supervisor===true)).sort((a,b)=>userName(a).localeCompare(userName(b),'ar'))}
  function supervisorName(sid){const u=st.users.find(u=>id(u.id)===id(sid)); return userName(u)||'-'}
  function projectById(pid){return st.projects.find(p=>id(p.id)===id(pid))}
  function workerById(wid){return st.workers.find(w=>id(w.id)===id(wid))}
  function currentWorkerSupervisorId(w){return workerSupId(w)||supIdOfProject(projectById(workerProjectId(w)))||''}
  function currentWorkerProjectId(w){return workerProjectId(w)}
  function currentWorkers(){return st.workers.filter(isActive).sort((a,b)=>workerName(a).localeCompare(workerName(b),'ar'))}
  async function safe(q){try{const r=await q; if(r.error){console.warn('attendance v10201',r.error.message);return []} return r.data||[]}catch(e){console.warn('attendance v10201',e);return []}}
  async function loadFresh(){
    // V10201: لا نعتمد على loadAll حتى لا يتعطل القسم إذا علقت سكربتات قديمة.
    const d=D();
    st.users = Array.isArray(d.users) && d.users.length ? d.users : (Array.isArray(d.supervisors)?d.supervisors:[]);
    st.projects = Array.isArray(d.projects) ? d.projects : [];
    st.workers = Array.isArray(d.workers) ? d.workers : [];
    st.attendance = Array.isArray(d.attendance) ? d.attendance : [];
    if(window.sb){
      const [users,projects,workers,att] = await Promise.all([
        safe(sb.from('app_users').select('*').limit(2000)),
        safe(sb.from('projects').select('*').limit(3000)),
        safe(sb.from('workers').select('*').limit(5000)),
        safe(sb.from('attendance').select('*').limit(10000))
      ]);
      if(users.length) st.users=users;
      if(projects.length) st.projects=projects;
      if(workers.length) st.workers=workers;
      if(att.length) st.attendance=att;
    }
    st.loaded=true;
    return st;
  }
  function installAdmin(){
    const sec=$('attendance'); if(!sec) return false;
    if(sec.dataset.attRb10201 && sec.querySelector('.att-rb-root')) return true;
    sec.dataset.attRb10201='1';
    sec.innerHTML=`<div class="att-rb-root">
      <div class="att-rb-head"><div><h2>الحضور والغياب</h2><p>قسم مبني من الصفر. المصدر الرسمي: العمال والمشاريع الحالية، والسجلات القديمة محفوظة للعرض فقط.</p></div><span>V${VERSION}</span></div>
      <div class="att-rb-controls">
        <div><label>التاريخ</label><input type="date" id="attRbDate"></div>
        <div><label>الشهر</label><input type="month" id="attRbMonth"></div>
        <div><label>المشرف</label><select id="attRbSupervisor"><option value="">كل المشرفين</option></select></div>
        <div><label>بحث</label><input id="attRbSearch" placeholder="اسم العامل أو المشروع"></div>
        <button type="button" id="attRbRefresh" onclick="window.renderAttendanceRootV10201&&window.renderAttendanceRootV10201(true)">تحديث مباشر</button>
        <button type="button" id="attRbSave" onclick="window.saveAttendanceRootV10201&&window.saveAttendanceRootV10201()">حفظ التحضير</button>
        <button type="button" id="attRbPrint" onclick="window.printAttendanceRootV10201&&window.printAttendanceRootV10201()">طباعة</button>
        <button type="button" id="attRbCsv" onclick="window.exportAttendanceRootV10201&&window.exportAttendanceRootV10201()">تصدير CSV</button>
      </div>
      <div id="attRbMsg" class="att-rb-msg">جاهز</div>
      <div id="attRbSummary" class="att-rb-summary"></div>
      <div class="att-rb-card"><h3>تحضير اليوم من العمال الحاليين</h3><div id="attRbWorkers" class="att-rb-workers"></div></div>
      <div class="att-rb-card"><h3>سجل اليوم</h3><div class="table-wrap"><table><thead><tr><th>العامل</th><th>المشرف الحالي</th><th>المشروع الحالي</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody id="attRbTodayBody"></tbody></table></div></div>
      <div class="att-rb-card"><h3>كشف الشهر</h3><div class="table-wrap att-rb-matrix-wrap"><table class="att-rb-matrix"><thead id="attRbMatrixHead"></thead><tbody id="attRbMatrixBody"></tbody></table></div></div>
    </div>`;
    const css=document.createElement('style'); css.id='attRbCss10201'; css.textContent=`#attendance{background:#f4faf7}.att-rb-root{display:flex;flex-direction:column;gap:14px}.att-rb-head{background:linear-gradient(135deg,#084f40,#126a58);color:#fff;border-radius:22px;padding:22px;display:flex;justify-content:space-between;align-items:center}.att-rb-head h2{margin:0;font-size:28px}.att-rb-head p{margin:6px 0 0;color:#e8f6f1}.att-rb-head span{background:#fff;color:#084f40;border-radius:999px;padding:8px 14px;font-weight:900}.att-rb-controls{display:grid;grid-template-columns:repeat(4,1fr) repeat(4,auto);gap:10px;background:#fff;border:1px solid #dcebe6;border-radius:18px;padding:14px;align-items:end}.att-rb-controls label{display:block;font-weight:900;color:#073f34;margin-bottom:5px}.att-rb-controls input,.att-rb-controls select{width:100%;padding:10px;border:1px solid #cfe0da;border-radius:12px}.att-rb-controls button{border:0;border-radius:12px;background:#074f40;color:#fff;font-weight:900;padding:12px 16px;cursor:pointer}.att-rb-msg{background:#eef7f3;border:1px solid #d5e9e1;color:#074f40;border-radius:14px;padding:10px;font-weight:800}.att-rb-msg.err{background:#ffe8e8;color:#9d2020}.att-rb-summary{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.att-rb-kpi,.att-rb-card{background:#fff;border:1px solid #dcebe6;border-radius:16px;padding:14px}.att-rb-kpi{text-align:center}.att-rb-kpi small{display:block;color:#5d716b}.att-rb-kpi b{font-size:26px;color:#074f40}.att-rb-workers{display:grid;grid-template-columns:repeat(4,minmax(230px,1fr));gap:10px}.att-rb-worker{border:1px solid #dcebe6;border-radius:14px;padding:10px;background:#fbfffd}.att-rb-worker b{display:block;color:#073f34}.att-rb-worker small{display:block;color:#657872;margin:5px 0}.att-rb-worker select,.att-rb-worker input{width:100%;padding:8px;border:1px solid #dcebe6;border-radius:10px;margin-top:6px}.att-rb-card h3{margin:0 0 12px;color:#063d33}.att-rb-card table{width:100%;border-collapse:collapse}.att-rb-card th{background:#074f40;color:#fff}.att-rb-card td,.att-rb-card th{border:1px solid #dfeae6;padding:8px;text-align:center}.att-present{background:#e8f4ee;color:#137a4b;font-weight:900}.att-absent{background:#fde8e8;color:#9d2222;font-weight:900}.att-empty{color:#8b9994}.att-rb-matrix-wrap{max-height:70vh}@media(max-width:1200px){.att-rb-controls,.att-rb-summary,.att-rb-workers{grid-template-columns:1fr 1fr}}@media(max-width:760px){.att-rb-controls,.att-rb-summary,.att-rb-workers{grid-template-columns:1fr}}@media print{body *{visibility:hidden!important}#attendance,#attendance *{visibility:visible!important}#attendance{position:absolute!important;inset:0;background:#fff!important}.att-rb-controls,.att-rb-msg{display:none!important}.side,.hero,.nav{display:none!important}}`;
    document.head.appendChild(css);
    $('attRbDate').value=today(); $('attRbMonth').value=monthNow();
    ['attRbDate','attRbMonth','attRbSupervisor','attRbSearch'].forEach(x=>$(x)?.addEventListener('input',()=>renderAdmin(false)));
    $('attRbRefresh')?.addEventListener('click',()=>renderAdmin(true)); $('attRbSave')?.addEventListener('click',saveAdmin); $('attRbPrint')?.addEventListener('click',printAdmin); $('attRbCsv')?.addEventListener('click',exportCsv);
    return true;
  }
  function fillAdminFilters(){const cur=$('attRbSupervisor')?.value||''; const sel=$('attRbSupervisor'); if(sel){sel.innerHTML='<option value="">كل المشرفين</option>'+supervisors().map(s=>`<option value="${esc(s.id)}">${esc(userName(s))}</option>`).join(''); sel.value=cur;}}
  function filteredWorkers(){const sid=$('attRbSupervisor')?.value||''; const q=norm($('attRbSearch')?.value||''); let rows=currentWorkers(); if(sid) rows=rows.filter(w=>id(currentWorkerSupervisorId(w))===id(sid)); if(q) rows=rows.filter(w=>norm(workerName(w)+' '+projectName(projectById(currentWorkerProjectId(w)))+' '+supervisorName(currentWorkerSupervisorId(w))).includes(q)); return rows;}
  function dayRecords(date){const m=new Map(); (st.attendance||[]).filter(a=>S(a.attendance_date||a.date)===date).forEach(a=>m.set(id(a.worker_id),a)); return m;}
  async function renderAdmin(force){installAdmin(); if(force||!st.loaded) await loadFresh(); fillAdminFilters(); const date=$('attRbDate')?.value||today(), month=$('attRbMonth')?.value||monthNow(); const workers=filteredWorkers(); const recs=dayRecords(date); const present=[...recs.values()].filter(a=>a.status==='present').length, absent=[...recs.values()].filter(a=>a.status==='absent').length; const sum=$('attRbSummary'); if(sum) sum.innerHTML=`<div class="att-rb-kpi"><small>العمال الحاليون</small><b>${workers.length}</b></div><div class="att-rb-kpi"><small>حضور اليوم</small><b>${present}</b></div><div class="att-rb-kpi"><small>غياب اليوم</small><b>${absent}</b></div><div class="att-rb-kpi"><small>سجلات محفوظة</small><b>${st.attendance.length}</b></div><div class="att-rb-kpi"><small>الشهر</small><b>${esc(month)}</b></div>`;
    const box=$('attRbWorkers'); if(box) box.innerHTML=workers.map(w=>{const r=recs.get(id(w.id)); const pid=currentWorkerProjectId(w), sid=currentWorkerSupervisorId(w); return `<div class="att-rb-worker" data-wid="${esc(w.id)}"><b>${esc(workerName(w))}</b><small>${esc(supervisorName(sid))} - ${esc(projectName(projectById(pid)))}</small><select class="attStatus"><option value="present" ${(!r||r.status==='present')?'selected':''}>حاضر</option><option value="absent" ${r&&r.status==='absent'?'selected':''}>غائب</option></select><input class="attNotes" placeholder="ملاحظات" value="${esc(r?.notes||'')}"></div>`}).join('')||'<div class="att-rb-worker">لا يوجد عمال حسب الفلتر</div>';
    const body=$('attRbTodayBody'); if(body) body.innerHTML=workers.map(w=>{const r=recs.get(id(w.id)); const sid=currentWorkerSupervisorId(w), pid=currentWorkerProjectId(w); const status=r?.status||''; return `<tr><td>${esc(workerName(w))}</td><td>${esc(supervisorName(sid))}</td><td>${esc(projectName(projectById(pid)))}</td><td class="${status==='present'?'att-present':status==='absent'?'att-absent':'att-empty'}">${status==='present'?'حاضر':status==='absent'?'غائب':'غير مسجل'}</td><td>${esc(r?.notes||'')}</td></tr>`}).join('')||'<tr><td colspan="5">لا توجد بيانات</td></tr>';
    renderMatrix(workers,month); message('تم بناء الحضور والغياب من العمال الحاليين مع حفظ السجلات القديمة.'); return workers; }
  function daysOfMonth(m){const [y,mo]=m.split('-').map(Number); const last=new Date(y,mo,0).getDate(); return Array.from({length:last},(_,i)=>String(i+1).padStart(2,'0'));}
  function renderMatrix(workers,m){const days=daysOfMonth(m); const h=$('attRbMatrixHead'), b=$('attRbMatrixBody'); if(h) h.innerHTML='<tr><th>العامل</th>'+days.map(d=>`<th>${d}</th>`).join('')+'<th>حضور</th><th>غياب</th></tr>'; if(b) b.innerHTML=workers.map(w=>{let p=0,a=0; const cells=days.map(d=>{const ds=m+'-'+d; const r=(st.attendance||[]).find(x=>id(x.worker_id)===id(w.id)&&S(x.attendance_date||x.date)===ds); if(r?.status==='present'){p++;return '<td class="att-present">ح</td>'} if(r?.status==='absent'){a++;return '<td class="att-absent">غ</td>'} return '<td class="att-empty">-</td>';}).join(''); return `<tr><td><b>${esc(workerName(w))}</b></td>${cells}<td>${p}</td><td>${a}</td></tr>`}).join('')||'<tr><td>لا توجد بيانات</td></tr>';}
  async function upsertAttendance(row){ if(!window.sb) throw new Error('لا يوجد اتصال Supabase'); const existing=await sb.from('attendance').select('id').eq('attendance_date',row.attendance_date).eq('worker_id',row.worker_id).maybeSingle(); if(existing.error && existing.error.code!=='PGRST116') throw existing.error; if(existing.data?.id){const r=await sb.from('attendance').update(row).eq('id',existing.data.id); if(r.error) throw r.error;} else {const r=await sb.from('attendance').insert(row); if(r.error) throw r.error;} }
  async function saveAdmin(){try{const date=$('attRbDate')?.value||today(); const rows=[...document.querySelectorAll('#attRbWorkers .att-rb-worker[data-wid]')]; if(!rows.length) return message('لا يوجد عمال للحفظ','err'); for(const el of rows){const w=workerById(el.dataset.wid); if(!w) continue; await upsertAttendance({attendance_date:date,worker_id:Number(w.id),supervisor_id:N(currentWorkerSupervisorId(w))||null,project_id:N(currentWorkerProjectId(w))||null,status:el.querySelector('.attStatus')?.value||'present',notes:el.querySelector('.attNotes')?.value||'',created_by:(window.session&&session()?.id)||null});} message('تم حفظ التحضير بنجاح'); await renderAdmin(true);}catch(e){message(e.message||String(e),'err')}}
  function printAdmin(){window.print()}
  async function exportCsv(){await renderAdmin(false); const rows=[...document.querySelectorAll('#attRbMatrixBody tr')].map(tr=>[...tr.children].map(td=>'"'+td.textContent.trim().replace(/"/g,'""')+'"').join(',')); const heads=[...document.querySelectorAll('#attRbMatrixHead th')].map(th=>'"'+th.textContent.trim()+'"').join(','); const blob=new Blob(['\ufeff'+[heads,...rows].join('\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='attendance_rebuild_'+($('attRbMonth')?.value||monthNow())+'.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  async function renderSupervisor(){
    const sec=$('supAttendance'); if(!sec) return false; const u=(window.session&&session())||{}; await loadFresh(); const date=$('attendanceDate')?.value||today(); const workers=currentWorkers().filter(w=>id(currentWorkerSupervisorId(w))===id(u.id)); const recs=dayRecords(date); const div=$('supervisorAttendanceList'); if(div) div.innerHTML=workers.map(w=>{const r=recs.get(id(w.id));return `<div class="quick-item" data-wid="${esc(w.id)}"><b>${esc(workerName(w))}</b><select><option value="present" ${(!r||r.status==='present')?'selected':''}>حاضر</option><option value="absent" ${r&&r.status==='absent'?'selected':''}>غائب</option></select></div>`}).join('')||'<div class="quick-item">لا يوجد عمال مرتبطين بك حاليًا</div>'; return true;
  }
  async function saveSupervisor(){try{const u=(window.session&&session())||{}; const date=$('attendanceDate')?.value||today(); const rows=[...document.querySelectorAll('#supervisorAttendanceList .quick-item[data-wid]')]; for(const el of rows){const w=workerById(el.dataset.wid); await upsertAttendance({attendance_date:date,worker_id:Number(w.id),supervisor_id:Number(u.id)||N(currentWorkerSupervisorId(w))||null,project_id:N(currentWorkerProjectId(w))||null,status:el.querySelector('select')?.value||'present',created_by:u.id||null});} message('تم حفظ التحضير'); await renderSupervisor();}catch(e){message(e.message||String(e),'err')}}
  window.renderAttendanceRootV10201=renderAdmin; window.saveAttendanceRootV10201=saveAdmin; window.printAttendanceRootV10201=printAdmin; window.exportAttendanceRootV10201=exportCsv;
  window.renderAttendanceRootV10201=renderAdmin; window.saveAttendanceRootV10201=saveAdmin; window.printAttendanceRootV10201=printAdmin; window.exportAttendanceRootV10201=exportCsv;
  window.renderAttendance=()=>renderAdmin(false); window.renderAttendanceMonthly=()=>renderAdmin(false); window.exportAttendanceMatrixCSV=exportCsv;
  window.saveSupervisorAttendance=saveSupervisor;
  const oldShow=window.showPage; window.showPage=function(id,btn){const r=oldShow?oldShow.apply(this,arguments):undefined; if(id==='attendance') setTimeout(()=>renderAdmin(true).catch(e=>message((e&&e.message)||String(e),'err')),150); return r};
  const oldSup=window.showSupervisorWindow; window.showSupervisorWindow=function(id,btn){const r=oldSup?oldSup.apply(this,arguments):undefined; if(id==='supAttendance') setTimeout(()=>renderSupervisor(),150); return r};
  function boot(){ if($('attendance')){installAdmin(); setTimeout(()=>renderAdmin(true).catch(e=>message((e&&e.message)||String(e),'err')),900);} if($('supAttendance')) setTimeout(()=>renderSupervisor(),900); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',()=>{ setTimeout(boot,1200); setTimeout(()=>renderAdmin(true).catch(e=>message((e&&e.message)||String(e),'err')),2500); setTimeout(()=>renderAdmin(true).catch(e=>message((e&&e.message)||String(e),'err')),5000); });
  console.log('Tasneef V10201 attendance rebuilt from zero loaded');
})();

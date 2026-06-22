/* ===== TASNEEF V10209 - ATTENDANCE ONE NAME STABLE =====
   هدف النسخة:
   - إيقاف تضارب سكربتات الحضور القديمة.
   - نسخة المشرف: العمال لا يظهرون ثم يختفون.
   - الإدارة والمشرف: كل اسم عامل يظهر مرة واحدة فقط بدون #ID.
   - الحفظ باسم واحد ثابت داخليًا ويعتمد على حذف سجلات نفس الاسم لنفس اليوم ثم إدخال سجل واحد.
   - كشف الشهر والطباعة والتصدير من نفس مصدر الشاشة.
*/
(function(){
  'use strict';
  if(window.__tasneefAttendanceOneNameStableV10209) return;
  window.__tasneefAttendanceOneNameStableV10209 = true;
  const BUILD='V10209';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const N=v=>Number(v)||0;
  const esc=s=>S(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>S(s).toLowerCase().replace(/[إأآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
  const monthNow=()=>today().slice(0,7);
  const daysOfMonth=m=>{const y=N(m.slice(0,4)),mo=N(m.slice(5,7));const last=new Date(y,mo,0).getDate()||31;return Array.from({length:last},(_,i)=>String(i+1).padStart(2,'0'));};
  const monthRange=m=>{const y=N(m.slice(0,4)),mo=N(m.slice(5,7));const from=`${y}-${String(mo).padStart(2,'0')}-01`;const t=new Date(y,mo,1);const to=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');return {from,to};};
  const isBadStatus=s=>['deleted','inactive','stopped','محذوف','موقوف'].includes(norm(s||''));
  const currentUser=()=>{try{return JSON.parse(localStorage.getItem('tasneef_user')||'null')||{};}catch(_){return {};}};
  function msg2(t,kind){try{ if(typeof window.msg==='function') window.msg(t,kind==='err'?'err':'ok'); }catch(_){} const el=$('attStableMsg')||$('globalMsg'); if(el){el.textContent=t; el.classList.remove('hidden'); el.className=(el.className||'')+' '+(kind==='err'?'err':'');}}
  async function q(table,cols='*'){
    const r=await window.sb.from(table).select(cols);
    if(r.error) throw r.error;
    return r.data||[];
  }
  async function loadBase(month){
    if(!window.sb) throw new Error('لا يوجد اتصال Supabase');
    const r=monthRange(month||monthNow());
    const [users,projects,workers,attendance]=await Promise.all([
      q('app_users','*'), q('projects','*'), q('workers','*'),
      window.sb.from('attendance').select('*').gte('attendance_date',r.from).lt('attendance_date',r.to).then(x=>{if(x.error) throw x.error; return x.data||[];})
    ]);
    return {users,projects,workers,attendance};
  }
  function userName(users,id){const u=(users||[]).find(x=>S(x.id)===S(id))||{};return S(u.full_name||u.name||u.username||id||'-')||'-';}
  function projectName(projects,id){const p=(projects||[]).find(x=>S(x.id)===S(id))||{};return S(p.name||p.project_name||p.title||id||'-')||'-';}
  function projectSupervisor(projects,pid){return (projects||[]).find(p=>S(p.id)===S(pid))?.supervisor_id||'';}
  function workerProjectIds(w){return [w.project_id,w.current_project_id,w.assigned_project_id,w.projectId].filter(Boolean).map(S);}
  function baseWorkerName(w){return S(w.name||w.full_name||w.worker_name||w.worker_identity||'');}
  function workerSupId(w,projects){return w.supervisor_id||w.app_supervisor_id||projectSupervisor(projects,w.project_id)||'';}
  function uniqueByName(workers,projects){
    const map=new Map();
    (workers||[]).filter(w=>w&&baseWorkerName(w)&&!isBadStatus(w.status||w.state)).sort((a,b)=>{
      const s=userName([],workerSupId(a,projects)).localeCompare(userName([],workerSupId(b,projects)),'ar');
      if(s) return s; return N(a.id)-N(b.id);
    }).forEach(w=>{
      const name=baseWorkerName(w), key=norm(name); if(!key) return;
      if(!map.has(key)){
        const c=Object.assign({},w,{__name:name,__ids:[S(w.id)],__workers:[w]});
        map.set(key,c);
      }else{
        const c=map.get(key); if(!c.__ids.includes(S(w.id))) c.__ids.push(S(w.id)); c.__workers.push(w);
        // إذا العامل الحالي له مشروع والمختار لا، احتفظ بالمشروع الأفضل لكن لا تغير الاسم.
        if(!c.project_id && w.project_id){ c.project_id=w.project_id; c.supervisor_id=w.supervisor_id||c.supervisor_id; }
      }
    });
    return [...map.values()];
  }
  function recordKeyByName(a){return norm(a.worker_identity||a.worker_name||'');}
  function dateOf(a){return S(a.attendance_date||a.date).slice(0,10);}
  function recMapByName(att){
    const m=new Map();
    (att||[]).forEach(a=>{
      const k=recordKeyByName(a); const d=dateOf(a); if(!k||!d) return;
      const old=m.get(k+'|'+d);
      if(!old || a.status==='absent' || (old.status!=='absent' && a.status==='present')) m.set(k+'|'+d,a);
    });
    return m;
  }
  function grouped(workers,users,projects){
    const g=new Map();
    workers.forEach(w=>{
      const sid=workerSupId(w,projects)||''; const name=userName(users,sid);
      if(!g.has(S(sid))) g.set(S(sid),{sid,name,workers:[]});
      g.get(S(sid)).workers.push(w);
    });
    return [...g.values()].sort((a,b)=>a.name.localeCompare(b.name,'ar')).map(x=>{x.workers.sort((a,b)=>baseWorkerName(a).localeCompare(baseWorkerName(b),'ar'));return x;});
  }
  function ensureCss(){
    if($('attStableCss')) return;
    const css=document.createElement('style'); css.id='attStableCss'; css.textContent=`
      .att-stable-card{background:#fff;border:1px solid #dce9e3;border-radius:18px;padding:16px;margin:12px 0;box-shadow:0 8px 22px rgba(0,0,0,.04)}
      .att-stable-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.att-stable-head h2{margin:0;color:#064c3b}
      .att-stable-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:12px 0}.att-stable-actions{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
      .att-stable-actions button,.att-stable-btn{background:#07513f;color:#fff;border:0;border-radius:12px;padding:10px 14px;font-weight:900;cursor:pointer}.att-stable-actions .light{background:#eef6f3;color:#07513f;border:1px solid #d5e7df}
      .att-stable-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:10px 0}.att-stable-kpis div{background:#f8fcfa;border:1px solid #dce9e3;border-radius:14px;padding:12px;text-align:center}.att-stable-kpis b{display:block;font-size:26px;color:#07513f}.att-stable-msg{background:#edf8f3;border:1px solid #cde5da;border-radius:12px;padding:10px;margin:8px 0;color:#064c3b;font-weight:800}
      .att-stable-workers{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}.att-stable-worker{border:1px solid #dce9e3;border-radius:14px;padding:10px;background:#fbfefc}.att-stable-worker b{display:block;color:#063d33;margin-bottom:4px}.att-stable-worker small{display:block;color:#60706a;margin-bottom:8px}.att-stable-worker select,.att-stable-worker input{width:100%;margin-top:6px}
      .att-stable-supervisor{grid-column:1/-1;background:#eaf5f1!important;color:#063d33;font-weight:900;border-color:#cde5da}.att-stable-table-wrap{max-height:72vh;overflow:auto;border:1px solid #dce9e3;border-radius:14px}.att-stable-table{width:100%;border-collapse:collapse}.att-stable-table th{background:#07513f;color:#fff;position:sticky;top:0;z-index:2}.att-stable-table th,.att-stable-table td{border:1px solid #dce9e3;padding:7px;text-align:center;white-space:nowrap}.att-stable-table th:first-child,.att-stable-table td:first-child{position:sticky;right:0;background:#fff;z-index:1;text-align:right;font-weight:900}.att-stable-table th:first-child{background:#07513f;color:#fff;z-index:3}.att-p{background:#e8f4ee;color:#08784d;font-weight:900}.att-a{background:#fdeaea;color:#a22;font-weight:900}.att-e{color:#8a9993}
      @media print{.att-stable-controls,.att-stable-actions,.att-stable-workers,.att-stable-msg{display:none!important}.att-stable-card{box-shadow:none;border:0}.att-stable-table-wrap{max-height:none;overflow:visible}}
    `; document.head.appendChild(css);
  }
  function adminInstall(){
    const sec=$('attendance'); if(!sec) return;
    ensureCss();
    sec.innerHTML=`<div class="att-stable-card"><div class="att-stable-head"><h2>الحضور والغياب</h2><b>${BUILD}</b></div><div id="attStableMsg" class="att-stable-msg">جاهز - كل اسم يظهر مرة واحدة فقط.</div>
      <div class="att-stable-controls"><label>التاريخ<input type="date" id="attStableDate"></label><label>الشهر<input type="month" id="attStableMonth"></label><label>المشرف<select id="attStableSupervisor"><option value="">كل المشرفين</option></select></label><label>بحث<input id="attStableSearch" placeholder="اسم العامل"></label></div>
      <div class="att-stable-actions"><button id="attStableRefresh">تحديث مباشر</button><button id="attStablePresent" class="light">اعتماد الكل حاضر</button><button id="attStableAbsent" class="light">اعتماد الكل غائب</button><button id="attStableSave">حفظ التحضير</button><button id="attStablePrint" class="light">طباعة</button><button id="attStableCsv" class="light">تصدير CSV</button></div>
      <div id="attStableKpis" class="att-stable-kpis"></div><h3>تحضير اليوم</h3><div id="attStableWorkers" class="att-stable-workers"></div><h3>كشف الشهر</h3><div class="att-stable-table-wrap"><table class="att-stable-table"><thead id="attStableHead"></thead><tbody id="attStableBody"></tbody></table></div></div>`;
    if(!$('attStableDate').value) $('attStableDate').value=today(); if(!$('attStableMonth').value) $('attStableMonth').value=monthNow();
    $('attStableRefresh').onclick=()=>adminRender(true); $('attStableSave').onclick=adminSave; $('attStablePrint').onclick=()=>window.print(); $('attStableCsv').onclick=adminCsv;
    $('attStablePresent').onclick=()=>document.querySelectorAll('#attStableWorkers select').forEach(s=>s.value='present');
    $('attStableAbsent').onclick=()=>document.querySelectorAll('#attStableWorkers select').forEach(s=>s.value='absent');
    ['attStableDate','attStableMonth','attStableSupervisor','attStableSearch'].forEach(id=>$(id).addEventListener(id==='attStableSearch'?'input':'change',()=>adminRender(false)));
  }
  let adminState={};
  async function adminRender(force){
    adminInstall(); const month=($('attStableMonth')?.value||monthNow()).slice(0,7), date=$('attStableDate')?.value||today();
    const d=await loadBase(month); adminState=d;
    const all=uniqueByName(d.workers,d.projects); fillSupFilter(all,d.users,d.projects);
    const sid=S($('attStableSupervisor')?.value||''), q=norm($('attStableSearch')?.value||'');
    let workers=all.filter(w=>(!sid||S(workerSupId(w,d.projects))===sid) && (!q||norm(baseWorkerName(w)).includes(q)));
    const rec=recMapByName(d.attendance); renderKpis(workers,rec,date); renderWorkerCards(workers,d,rec,date,'attStableWorkers'); renderMatrix(workers,d,rec,month);
    msg2('جاهز - تم تحميل الحضور بدون تكرار أسماء.');
  }
  function fillSupFilter(workers,users,projects){const el=$('attStableSupervisor'); if(!el) return; const cur=el.value; const ids=[...new Set(workers.map(w=>S(workerSupId(w,projects))).filter(Boolean))]; el.innerHTML='<option value="">كل المشرفين</option>'+ids.map(id=>`<option value="${esc(id)}">${esc(userName(users,id))}</option>`).join(''); el.value=ids.includes(cur)?cur:'';}
  function renderKpis(workers,rec,date){let p=0,a=0; workers.forEach(w=>{const r=rec.get(norm(baseWorkerName(w))+'|'+date); if(r?.status==='present')p++; if(r?.status==='absent')a++;}); const k=$('attStableKpis'); if(k) k.innerHTML=`<div><small>العمال</small><b>${workers.length}</b></div><div><small>حضور اليوم</small><b>${p}</b></div><div><small>غياب اليوم</small><b>${a}</b></div><div><small>النسخة</small><b>${BUILD}</b></div>`;}
  function renderWorkerCards(workers,d,rec,date,idBox){const box=$(idBox); if(!box)return; const groups=grouped(workers,d.users,d.projects); box.innerHTML=groups.map(g=>`<div class="att-stable-worker att-stable-supervisor">المشرف: ${esc(g.name)} <small>عدد العمال: ${g.workers.length}</small></div>`+g.workers.map(w=>{const r=rec.get(norm(baseWorkerName(w))+'|'+date); return `<div class="att-stable-worker" data-name="${esc(baseWorkerName(w))}" data-wid="${esc(w.id||'')}"><b>${esc(baseWorkerName(w))}</b><small>${esc(projectName(d.projects,w.project_id))}</small><select><option value="present" ${(!r||r.status==='present')?'selected':''}>حاضر</option><option value="absent" ${r?.status==='absent'?'selected':''}>غائب</option></select><input placeholder="ملاحظات" value="${esc(r?.notes||'')}"></div>`;}).join('')).join('')||'<div class="att-stable-worker">لا يوجد عمال</div>';}
  function renderMatrix(workers,d,rec,month){const head=$('attStableHead'),body=$('attStableBody'); if(!head||!body)return; const days=daysOfMonth(month); head.innerHTML='<tr><th>العامل</th>'+days.map(x=>`<th>${x}</th>`).join('')+'<th>حضور</th><th>غياب</th></tr>'; const groups=grouped(workers,d.users,d.projects); body.innerHTML=groups.map(g=>`<tr><td colspan="${days.length+3}" class="att-stable-supervisor">المشرف: ${esc(g.name)} - عدد العمال: ${g.workers.length}</td></tr>`+g.workers.map(w=>{let p=0,a=0; const k=norm(baseWorkerName(w)); const cells=days.map(day=>{const r=rec.get(k+'|'+month+'-'+day); if(r?.status==='present'){p++;return '<td class="att-p">ح</td>';} if(r?.status==='absent'){a++;return '<td class="att-a">غ</td>';} return '<td class="att-e">-</td>';}).join(''); return `<tr><td>${esc(baseWorkerName(w))}</td>${cells}<td>${p}</td><td>${a}</td></tr>`;}).join('')).join('');}
  async function saveOne(row){
    // حذف أي سجل لنفس الاسم في نفس اليوم ثم إدخال سجل واحد فقط.
    await window.sb.from('attendance').delete().eq('attendance_date',row.attendance_date).eq('worker_identity',row.worker_identity);
    const r=await window.sb.from('attendance').insert(row); if(r.error) throw r.error;
  }
  async function adminSave(){const date=$('attStableDate')?.value||today(); const cards=[...document.querySelectorAll('#attStableWorkers .att-stable-worker[data-name]')]; if(!cards.length)return msg2('لا يوجد عمال للحفظ','err'); let ok=0; for(const c of cards){const name=c.dataset.name; const wid=N(c.dataset.wid)||null; const worker=(adminState.workers||[]).find(w=>S(w.id)===S(wid))||{}; await saveOne({attendance_date:date,worker_id:wid,worker_identity:name,supervisor_id:workerSupId(worker,adminState.projects)||null,project_id:worker.project_id||null,status:c.querySelector('select')?.value||'present',notes:c.querySelector('input')?.value||'',created_at:new Date().toISOString()}); ok++;} msg2('تم حفظ تحضير '+ok+' اسم بدون تكرار'); await adminRender(true);}
  async function adminCsv(){await adminRender(false); const month=($('attStableMonth')?.value||monthNow()).slice(0,7); const days=daysOfMonth(month); const rows=[['المشرف','العامل',...days,'حضور','غياب']]; document.querySelectorAll('#attStableBody tr').forEach(tr=>{const cells=[...tr.children].map(td=>td.textContent.trim()); if(cells.length>1) rows.push(cells);}); const csv=rows.map(r=>r.map(x=>'"'+S(x).replace(/"/g,'""')+'"').join(',')).join('\n'); const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='attendance_unique_names_'+month+'.csv'; a.click();}

  // Supervisor
  async function supervisorRender(){
    const list=$('supervisorAttendanceList'); if(!list) return; ensureCss(); const u=currentUser(); const month=($('attendanceDate')?.value||today()).slice(0,7); const date=$('attendanceDate')?.value||today(); if($('attendanceDate')&&!$('attendanceDate').value)$('attendanceDate').value=today();
    list.innerHTML='<div class="att-stable-msg">جار تحميل العمال...</div>';
    try{
      const d=await loadBase(month); const supProjects=(d.projects||[]).filter(p=>S(p.supervisor_id)===S(u.id)&&!isBadStatus(p.status||p.state)); const supIds=new Set(supProjects.map(p=>S(p.id)));
      const all=(d.workers||[]).filter(w=>!isBadStatus(w.status||w.state) && (S(w.supervisor_id)===S(u.id) || workerProjectIds(w).some(pid=>supIds.has(S(pid)))));
      const workers=uniqueByName(all,d.projects); const rec=recMapByName(d.attendance);
      list.innerHTML='<div class="att-stable-workers" id="supStableWorkers"></div><div class="att-stable-actions"><button id="supStablePresent" class="light">اعتماد الكل حاضر</button><button id="supStableAbsent" class="light">اعتماد الكل غائب</button><button id="supStableRefresh" class="light">تحديث الأسماء</button></div><div id="attStableMsg" class="att-stable-msg">جاهز - الأسماء بدون تكرار.</div>';
      renderWorkerCards(workers,d,rec,date,'supStableWorkers');
      $('supStablePresent').onclick=()=>document.querySelectorAll('#supStableWorkers select').forEach(s=>s.value='present');
      $('supStableAbsent').onclick=()=>document.querySelectorAll('#supStableWorkers select').forEach(s=>s.value='absent');
      $('supStableRefresh').onclick=supervisorRender;
    }catch(e){list.innerHTML='<div class="att-stable-msg">تعذر تحميل العمال: '+esc(e.message||e)+'</div>';}
  }
  async function supervisorSave(){const u=currentUser(); const date=$('attendanceDate')?.value||today(); const cards=[...document.querySelectorAll('#supStableWorkers .att-stable-worker[data-name]')]; if(!cards.length)return msg2('لا يوجد عمال للحفظ','err'); let ok=0; for(const c of cards){const name=c.dataset.name; const wid=N(c.dataset.wid)||null; await saveOne({attendance_date:date,worker_id:wid,worker_identity:name,supervisor_id:N(u.id)||null,project_id:null,status:c.querySelector('select')?.value||'present',notes:c.querySelector('input')?.value||'',created_by:N(u.id)||null,created_at:new Date().toISOString()}); ok++;} msg2('تم حفظ تحضير '+ok+' اسم بدون تكرار'); await supervisorRender();}
  window.renderSupervisorAttendanceList=supervisorRender;
  window.saveSupervisorAttendance=supervisorSave;
  try{renderSupervisorAttendanceList=supervisorRender; saveSupervisorAttendance=supervisorSave;}catch(_){}

  const oldShowPage=window.showPage; window.showPage=function(page,btn){const r=oldShowPage?oldShowPage.apply(this,arguments):undefined; if(page==='attendance') setTimeout(()=>adminRender(true).catch(e=>msg2(e.message||e,'err')),100); return r;};
  const oldSupWin=window.showSupervisorWindow; window.showSupervisorWindow=function(id,btn){const r=oldSupWin?oldSupWin.apply(this,arguments):undefined; if(id==='supAttendance') setTimeout(()=>supervisorRender(),100); return r;};
  const oldInitSup=window.initSupervisor; window.initSupervisor=async function(){if(oldInitSup) await oldInitSup.apply(this,arguments); setTimeout(()=>{if($('supAttendance')?.classList.contains('active')) supervisorRender();},300);};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{ if($('attendance')&&!$('attendance').classList.contains('hidden')) adminRender(true).catch(console.warn); if($('supervisorAttendanceList')) supervisorRender(); },800));
  window.renderAttendance=()=>adminRender(false);
  window.renderAttendanceMonthly=()=>adminRender(false);
  window.exportAttendanceMatrixCSV=adminCsv;
  console.log('Tasneef attendance stable loaded '+BUILD);
})();

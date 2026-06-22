
(function(){
  'use strict';
  const BUILD='V10215';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const N=v=>Number(v)||0;
  const esc=s=>S(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>S(s).toLowerCase().replace(/[إأآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
  const statusCode=v=>{const x=norm(v); if(['absent','غائب','غياب','غ','a'].includes(x))return 'absent'; if(['present','حاضر','حضور','ح','p'].includes(x))return 'present'; return x||'';};
  const dateKey=v=>{let x=S(v); if(!x)return ''; if(/^\d{4}-\d{2}-\d{2}/.test(x))return x.slice(0,10); const m=x.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/); if(m)return `${m[3]}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`; return x.slice(0,10);};
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
  const monthNow=()=>today().slice(0,7);
  const daysOfMonth=m=>{const y=N(m.slice(0,4)),mo=N(m.slice(5,7));return Array.from({length:new Date(y,mo,0).getDate()||31},(_,i)=>String(i+1).padStart(2,'0'));};
  const monthRange=m=>{const y=N(m.slice(0,4)),mo=N(m.slice(5,7));const from=`${y}-${String(mo).padStart(2,'0')}-01`;const t=new Date(y,mo,1);const to=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');return{from,to};};
  const isBadStatus=s=>['deleted','inactive','stopped','محذوف','موقوف'].includes(norm(s||''));
  const curUser=()=>{try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return {};}};
  function toast(t,bad){try{if(typeof window.msg==='function') window.msg(t,bad?'err':'ok');}catch(_){} const e=$('attRootMsg')||$('attSupMsg')||$('globalMsg'); if(e){e.textContent=t;e.style.display='block';e.style.color=bad?'#9d2222':'#07513f';}}
  async function selectAll(table,cols='*'){const r=await window.sb.from(table).select(cols); if(r.error) throw r.error; return r.data||[];}
  async function loadBase(month){if(!window.sb) throw new Error('Supabase غير جاهز'); const r=monthRange(month||monthNow()); const [users,projects,workers,attendance]=await Promise.all([
    selectAll('app_users','*'),selectAll('projects','*'),selectAll('workers','*'),window.sb.from('attendance').select('*').gte('attendance_date',r.from).lt('attendance_date',r.to).then(x=>{if(x.error)throw x.error;return x.data||[];})
  ]); return{users,projects,workers,attendance};}
  function uName(users,id){const u=(users||[]).find(x=>S(x.id)===S(id))||{};return S(u.full_name||u.name||u.username||id||'-')||'-';}
  function pName(projects,id){const p=(projects||[]).find(x=>S(x.id)===S(id))||{};return S(p.name||p.project_name||p.title||id||'-')||'-';}
  function pSup(projects,pid){return (projects||[]).find(p=>S(p.id)===S(pid))?.supervisor_id||'';}
  function wName(w){return S(w.name||w.full_name||w.worker_name||w.worker_identity||'');}
  function wProjectIds(w){return [w.project_id,w.current_project_id,w.assigned_project_id,w.projectId].filter(Boolean).map(S);}
  function wSup(w,projects){return w.supervisor_id||w.app_supervisor_id||pSup(projects,w.project_id)||'';}
  function oneNameWorkers(workers,projects){
    const map=new Map();
    (workers||[]).filter(w=>!isBadStatus(w.status||w.state)).forEach(w=>{
      const name=wName(w), key=norm(name); if(!key)return;
      if(!map.has(key)){const c=Object.assign({},w,{__name:name,__ids:[],__workers:[]}); map.set(key,c);}
      const c=map.get(key); if(w.id && !c.__ids.includes(S(w.id))) c.__ids.push(S(w.id)); c.__workers.push(w);
      // الأفضلية: العامل المرتبط بمشروع ومشرف
      if((!c.project_id&&w.project_id)||(!c.supervisor_id&&wSup(w,projects))) Object.assign(c,w,{__name:name,__ids:c.__ids,__workers:c.__workers});
    });
    return [...map.values()].sort((a,b)=>wName(a).localeCompare(wName(b),'ar'));
  }
  function recMap(att, workers){const m=new Map(); const idName=new Map(); (workers||[]).forEach(w=>{if(w.id) idName.set(S(w.id), wName(w));}); (att||[]).forEach(a=>{const d=dateKey(a.attendance_date||a.date||a.created_at); const st=statusCode(a.status||a.state||a.attendance_status); let names=[]; if(a.worker_identity||a.worker_name) names.push(a.worker_identity||a.worker_name); if(a.worker_id&&idName.get(S(a.worker_id))) names.push(idName.get(S(a.worker_id))); names=[...new Set(names.map(x=>S(x)).filter(Boolean))]; if(!names.length||!d)return; names.forEach(n=>{const k=norm(n)+'|'+d; const old=m.get(k); if(!old || st==='absent' || (statusCode(old.status)!=='absent'&&st==='present')) m.set(k,Object.assign({},a,{status:st,attendance_date:d,worker_identity:n}));});});return m;}
  function grouped(workers,users,projects){const g=new Map();workers.forEach(w=>{const sid=S(wSup(w,projects)||'');const nm=uName(users,sid);if(!g.has(sid))g.set(sid,{id:sid,name:nm,workers:[]});g.get(sid).workers.push(w);});return [...g.values()].sort((a,b)=>a.name.localeCompare(b.name,'ar'));}
  function css(){if($('attV10215Css'))return;const st=document.createElement('style');st.id='attV10215Css';st.textContent=`.att-card{background:#fff;border:1px solid #dce6e2;border-radius:22px;padding:18px;margin:14px 0}.att-head{display:flex;justify-content:space-between;align-items:center}.att-head h2{color:#07513f;margin:0}.att-msg{background:#eef8f4;border:1px solid #d3e9df;border-radius:12px;padding:10px;margin:10px 0;color:#07513f;font-weight:800}.att-controls{display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:10px;margin:12px 0}.att-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.att-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.att-kpis div{border:1px solid #dce6e2;border-radius:14px;padding:12px;text-align:center}.att-kpis b{display:block;font-size:26px;color:#07513f}.att-workers{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}.att-worker{border:1px solid #dce9e3;border-radius:14px;background:#fbfefc;padding:10px}.att-worker b{display:block;color:#063d33}.att-worker small{display:block;color:#60706a;margin:4px 0}.att-worker select,.att-worker input{width:100%;margin-top:6px}.att-super{grid-column:1/-1;background:#e9f5f1!important;color:#063d33;font-weight:900}.att-table-wrap{max-height:72vh;overflow:auto;border:1px solid #dce9e3;border-radius:14px}.att-table{width:100%;border-collapse:collapse}.att-table th{background:#07513f;color:#fff;position:sticky;top:0}.att-table th,.att-table td{border:1px solid #dce9e3;padding:7px;text-align:center;white-space:nowrap}.att-table th:first-child,.att-table td:first-child{position:sticky;right:0;background:#fff;text-align:right;font-weight:900}.att-table th:first-child{background:#07513f;color:#fff}.att-p{background:#e8f4ee;color:#08784d;font-weight:900}.att-a{background:#fdeaea;color:#a22;font-weight:900}.att-e{color:#8a9993}@media print{.att-controls,.att-actions,.att-workers,.att-msg,.side,.hero{display:none!important}.att-card{border:0;box-shadow:none}.att-table-wrap{max-height:none;overflow:visible}}`;document.head.appendChild(st);}
  let adminState={}; let adminRendering=false;
  function installAdmin(){const sec=$('attendance'); if(!sec)return; css(); if($('attRootV10215'))return; sec.innerHTML=`<div class="att-card" id="attRootV10215"><div class="att-head"><h2>الحضور والغياب</h2><b>${BUILD}</b></div><div id="attRootMsg" class="att-msg">جاهز - مصدر واحد للحضور، بدون تكرار أسماء.</div><div class="att-controls"><label>التاريخ<input type="date" id="attDate"></label><label>الشهر<input type="month" id="attMonth"></label><label>المشرف<select id="attSup"><option value="">كل المشرفين</option></select></label><label>بحث<input id="attSearch" placeholder="اسم العامل"></label></div><div class="att-actions"><button id="attRefresh">تحديث مباشر</button><button id="attAllP" class="light">اعتماد الكل حاضر</button><button id="attAllA" class="light">اعتماد الكل غائب</button><button id="attSave">حفظ التحضير</button><button id="attPrint" class="light">طباعة</button><button id="attCsv" class="light">تصدير CSV</button></div><div id="attKpis" class="att-kpis"></div><h3>تحضير اليوم</h3><div id="attWorkers" class="att-workers"></div><h3>سجل اليوم</h3><div class="att-table-wrap" style="max-height:340px"><table class="att-table"><thead><tr><th>التاريخ</th><th>العامل</th><th>المشرف</th><th>الحالة</th><th>الوقت</th><th>ملاحظات</th></tr></thead><tbody id="attTodayBody"></tbody></table></div><h3>كشف الشهر</h3><div class="att-table-wrap"><table class="att-table"><thead id="attHead"></thead><tbody id="attBody"></tbody></table></div></div>`; $('attDate').value=$('attDate').value||today(); $('attMonth').value=$('attMonth').value||monthNow(); $('attRefresh').onclick=()=>renderAdmin(true); $('attSave').onclick=saveAdmin; $('attPrint').onclick=()=>window.print(); $('attCsv').onclick=csvAdmin; $('attAllP').onclick=()=>document.querySelectorAll('#attWorkers select').forEach(s=>s.value='present'); $('attAllA').onclick=()=>document.querySelectorAll('#attWorkers select').forEach(s=>s.value='absent'); ['attDate','attMonth','attSup','attSearch'].forEach(id=>$(id).addEventListener(id==='attSearch'?'input':'change',()=>renderAdmin(false)));}
  async function renderAdmin(force){if(adminRendering)return; adminRendering=true; try{installAdmin(); if(!$('attRootV10215'))return; const month=($('attMonth').value||monthNow()).slice(0,7),date=$('attDate').value||today(); const d=await loadBase(month); adminState=d; const all=oneNameWorkers(d.workers,d.projects); fillSup(all,d.users,d.projects,'attSup'); const sid=S($('attSup').value), q=norm($('attSearch').value); const workers=all.filter(w=>(!sid||S(wSup(w,d.projects))===sid)&&(!q||norm(wName(w)).includes(q))); const rec=recMap(d.attendance,d.workers); renderKpis(workers,rec,date,'attKpis'); renderCards(workers,d,rec,date,'attWorkers'); renderTodayLog(d,date,'attTodayBody'); renderTable(workers,d,rec,month,'attHead','attBody'); toast('جاهز - تم تحميل الحضور بدون تكرار أسماء.');}catch(e){toast(e.message||e,true);}finally{adminRendering=false;}}
  function fillSup(workers,users,projects,id){const el=$(id); if(!el)return; const cur=el.value; const ids=[...new Set(workers.map(w=>S(wSup(w,projects))).filter(Boolean))]; el.innerHTML='<option value="">كل المشرفين</option>'+ids.map(x=>`<option value="${esc(x)}">${esc(uName(users,x))}</option>`).join(''); el.value=ids.includes(cur)?cur:'';}
  function renderKpis(workers,rec,date,id){let p=0,a=0;workers.forEach(w=>{const r=rec.get(norm(wName(w))+'|'+date); if(statusCode(r?.status)==='present')p++; if(statusCode(r?.status)==='absent')a++;}); const k=$(id); if(k)k.innerHTML=`<div><small>العمال</small><b>${workers.length}</b></div><div><small>حضور اليوم</small><b>${p}</b></div><div><small>غياب اليوم</small><b>${a}</b></div><div><small>النسخة</small><b>${BUILD}</b></div>`;}
  function renderCards(workers,d,rec,date,boxid){const box=$(boxid); if(!box)return; const gs=grouped(workers,d.users,d.projects); box.innerHTML=gs.map(g=>`<div class="att-worker att-super">المشرف: ${esc(g.name)} <small>عدد العمال: ${g.workers.length}</small></div>`+g.workers.map(w=>{const r=rec.get(norm(wName(w))+'|'+date);return `<div class="att-worker" data-name="${esc(wName(w))}" data-ids="${esc((w.__ids||[w.id]).join(','))}"><b>${esc(wName(w))}</b><small>${esc(pName(d.projects,w.project_id))}</small><select><option value="present" ${(!r||statusCode(r.status)==='present')?'selected':''}>حاضر</option><option value="absent" ${statusCode(r?.status)==='absent'?'selected':''}>غائب</option></select><input placeholder="ملاحظات" value="${esc(r?.notes||'')}"></div>`}).join('')).join('')||'<div class="att-worker">لا يوجد عمال</div>';}
  function renderTodayLog(d,date,id){
    const body=$(id); if(!body)return;
    const rows=(d.attendance||[]).filter(a=>dateKey(a.attendance_date||a.date||a.created_at)===date)
      .sort((a,b)=>S(b.created_at||'').localeCompare(S(a.created_at||'')));
    if(!rows.length){body.innerHTML='<tr><td colspan="6" class="att-e">لا توجد سجلات لهذا اليوم</td></tr>';return;}
    body.innerHTML=rows.map(a=>{
      const st=statusCode(a.status||a.state||a.attendance_status);
      const cls=st==='absent'?'att-a':'att-p';
      const label=st==='absent'?'غائب':'حاضر';
      const tm=S(a.check_time||a.time||a.created_at||'').replace('T',' ').slice(0,16);
      return `<tr><td>${esc(dateKey(a.attendance_date||a.date||a.created_at))}</td><td>${esc(a.worker_identity||a.worker_name||'')}</td><td>${esc(uName(d.users,a.supervisor_id))}</td><td class="${cls}">${label}</td><td>${esc(tm)}</td><td>${esc(a.notes||'')}</td></tr>`;
    }).join('');
  }
  function renderTable(workers,d,rec,month,headid,bodyid){const head=$(headid),body=$(bodyid); if(!head||!body)return; const days=daysOfMonth(month); head.innerHTML='<tr><th>العامل</th>'+days.map(x=>`<th>${x}</th>`).join('')+'<th>حضور</th><th>غياب</th></tr>'; body.innerHTML=grouped(workers,d.users,d.projects).map(g=>`<tr><td colspan="${days.length+3}" class="att-super">المشرف: ${esc(g.name)} - عدد العمال: ${g.workers.length}</td></tr>`+g.workers.map(w=>{let p=0,a=0,k=norm(wName(w)); const cells=days.map(day=>{const r=rec.get(k+'|'+month+'-'+day); if(statusCode(r?.status)==='present'){p++;return '<td class="att-p">ح</td>'} if(statusCode(r?.status)==='absent'){a++;return '<td class="att-a">غ</td>'} return '<td class="att-e">-</td>'}).join(''); return `<tr><td>${esc(wName(w))}</td>${cells}<td>${p}</td><td>${a}</td></tr>`}).join('')).join('');}
  async function saveBatchByName(date, items){
    if(!items.length) return {saved:0};
    const payload = items.map(x=>({
      worker_identity: S(x.name),
      status: statusCode(x.status)==='absent' ? 'absent' : 'present',
      notes: S(x.notes||''),
      supervisor_id: x.supervisor_id || null,
      project_id: x.project_id || null
    })).filter(x=>x.worker_identity);
    const r = await window.sb.rpc('tasneef_save_attendance_by_name_v10215', {p_date: date, p_records: payload});
    if(r.error) throw r.error;
    return r.data || {saved: payload.length};
  }

  async function saveName(date,name,ids,status,notes,worker,projects,createdBy){
    // fallback فردي لو احتجنا. الأصل الآن الحفظ الجماعي عبر RPC.
    return saveBatchByName(date,[{name,status,notes,supervisor_id:(worker&&wSup(worker,projects))||createdBy||null,project_id:(worker&&worker.project_id)||null}]);
  }


  async function refreshAdminMonthOnly(){try{if(!adminState||!adminState.workers)return; const month=($('attMonth')?.value||monthNow()).slice(0,7); const r=monthRange(month); const q=await window.sb.from('attendance').select('*').gte('attendance_date',r.from).lt('attendance_date',r.to); if(q.error) throw q.error; adminState.attendance=q.data||[]; const all=oneNameWorkers(adminState.workers,adminState.projects); const sid=S($('attSup')?.value), search=norm($('attSearch')?.value); const workers=all.filter(w=>(!sid||S(wSup(w,adminState.projects))===sid)&&(!search||norm(wName(w)).includes(search))); const rec=recMap(adminState.attendance,adminState.workers); renderKpis(workers,rec,$('attDate')?.value||today(),'attKpis'); renderCards(workers,adminState,rec,$('attDate')?.value||today(),'attWorkers'); renderTodayLog(adminState,$('attDate')?.value||today(),'attTodayBody'); renderTable(workers,adminState,rec,month,'attHead','attBody');}catch(e){console.warn('refreshAdminMonthOnly failed',e);}}

  async function saveAdmin(){try{
    const date=$('attDate')?.value||today();
    const month=($('attMonth')?.value||date.slice(0,7)||monthNow()).slice(0,7);

    // الحل الجذري: لا نعتمد على آخر مجموعة كروت فقط.
    // نبني قائمة الحفظ من نفس مصدر العرض الكامل داخل adminState، ثم نقرأ الحالة/الملاحظات من الكرت إن وجد.
    if(!adminState || !adminState.workers){
      adminState = await loadBase(month);
    }
    const all=oneNameWorkers(adminState.workers||[],adminState.projects||[]);
    const sid=S($('attSup')?.value), search=norm($('attSearch')?.value);
    const workers=all.filter(w=>(!sid||S(wSup(w,adminState.projects||[]))===sid)&&(!search||norm(wName(w)).includes(search)));
    if(!workers.length)return toast('لا يوجد عمال للحفظ',true);

    const cardByName=new Map([...document.querySelectorAll('#attWorkers .att-worker[data-name]')].map(c=>[norm(c.dataset.name),c]));
    const rec=recMap(adminState.attendance||[],adminState.workers||[]);
    const items=workers.map(w=>{
      const name=wName(w);
      const c=cardByName.get(norm(name));
      const r=rec.get(norm(name)+'|'+date);
      return {
        name,
        status: c?.querySelector('select')?.value || statusCode(r?.status) || 'present',
        notes: c?.querySelector('input')?.value || r?.notes || '',
        supervisor_id: wSup(w,adminState.projects||[]) || null,
        project_id: w.project_id || null
      };
    }).filter(x=>S(x.name));

    console.log('attendance payload count', items.length, items);
    const result=await saveBatchByName(date,items);
    const saved=N(result.saved)||0;
    toast('تم حفظ '+saved+' سجل فعليًا');
    await renderAdmin(true);
  }catch(e){toast('فشل الحفظ: '+(e.message||e),true);}}

  async function csvAdmin(){await renderAdmin(false); const rows=[]; document.querySelectorAll('#attBody tr').forEach(tr=>rows.push([...tr.children].map(td=>td.textContent.trim()))); const csv=rows.map(r=>r.map(x=>'"'+S(x).replace(/"/g,'""')+'"').join(',')).join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})); a.download='attendance_'+(($('attMonth')?.value)||monthNow())+'.csv'; a.click();}
  async function renderSupervisor(){const list=$('supervisorAttendanceList'); if(!list)return; css(); const u=curUser(), date=$('attendanceDate')?.value||today(); if($('attendanceDate')&&!$('attendanceDate').value)$('attendanceDate').value=today(); list.innerHTML='<div class="att-msg">جار تحميل العمال...</div>'; try{const d=await loadBase(date.slice(0,7)); const sp=(d.projects||[]).filter(p=>S(p.supervisor_id)===S(u.id)&&!isBadStatus(p.status||p.state)); const pids=new Set(sp.map(p=>S(p.id))); const all=(d.workers||[]).filter(w=>!isBadStatus(w.status||w.state)&&(S(w.supervisor_id)===S(u.id)||wProjectIds(w).some(x=>pids.has(S(x))))); const workers=oneNameWorkers(all,d.projects), rec=recMap(d.attendance); list.innerHTML='<div class="att-workers" id="supWorkers"></div><div class="att-actions"><button id="supAllP" class="light">اعتماد الكل حاضر</button><button id="supAllA" class="light">اعتماد الكل غائب</button><button id="supRefresh" class="light">تحديث الأسماء</button></div><div id="attSupMsg" class="att-msg">جاهز - بدون تكرار أسماء.</div>'; renderCards(workers,d,rec,date,'supWorkers'); $('supAllP').onclick=()=>document.querySelectorAll('#supWorkers select').forEach(s=>s.value='present'); $('supAllA').onclick=()=>document.querySelectorAll('#supWorkers select').forEach(s=>s.value='absent'); $('supRefresh').onclick=renderSupervisor; window.__supAttState={d,workers};}catch(e){list.innerHTML='<div class="att-msg">تعذر التحميل: '+esc(e.message||e)+'</div>';}}
  async function saveSupervisor(){try{
    const u=curUser(), date=$('attendanceDate')?.value||today();
    const month=date.slice(0,7)||monthNow();
    let st=window.__supAttState||{};
    if(!st.d){
      const d=await loadBase(month);
      const sp=(d.projects||[]).filter(p=>S(p.supervisor_id)===S(u.id)&&!isBadStatus(p.status||p.state));
      const pids=new Set(sp.map(p=>S(p.id)));
      const all=(d.workers||[]).filter(w=>!isBadStatus(w.status||w.state)&&(S(w.supervisor_id)===S(u.id)||wProjectIds(w).some(x=>pids.has(S(x)))));
      st={d,workers:oneNameWorkers(all,d.projects)};
    }
    const workers=st.workers||[];
    if(!workers.length)return toast('لا يوجد عمال للحفظ',true);
    const cardByName=new Map([...document.querySelectorAll('#supWorkers .att-worker[data-name]')].map(c=>[norm(c.dataset.name),c]));
    const rec=recMap(st.d?.attendance||[],st.d?.workers||[]);
    const items=workers.map(w=>{
      const name=wName(w);
      const c=cardByName.get(norm(name));
      const r=rec.get(norm(name)+'|'+date);
      return {
        name,
        status:c?.querySelector('select')?.value || statusCode(r?.status) || 'present',
        notes:c?.querySelector('input')?.value || r?.notes || '',
        supervisor_id:wSup(w,st.d?.projects||[])||N(u.id)||null,
        project_id:w.project_id||null
      };
    }).filter(x=>S(x.name));
    console.log('supervisor attendance payload count', items.length, items);
    const result=await saveBatchByName(date,items);
    toast('تم حفظ '+(N(result.saved)||items.length)+' سجل فعليًا');
    await renderSupervisor();
  }catch(e){toast('فشل الحفظ: '+(e.message||e),true);}}

  function bindGlobals(){window.renderAttendance=()=>renderAdmin(false); window.renderAttendanceMonthly=()=>renderAdmin(false); window.renderAttendanceWorkersQuick=()=>{}; window.saveAttendance=saveAdmin; window.quickAttendance=()=>{}; window.exportAttendanceMatrixCSV=csvAdmin; window.renderSupervisorAttendanceList=renderSupervisor; window.saveSupervisorAttendance=saveSupervisor; try{renderAttendance=window.renderAttendance;renderAttendanceMonthly=window.renderAttendanceMonthly;saveAttendance=saveAdmin;renderSupervisorAttendanceList=renderSupervisor;saveSupervisorAttendance=saveSupervisor;}catch(_){} }
  bindGlobals(); [300,900,1700,2800,4200].forEach(t=>setTimeout(bindGlobals,t));
  const oldShow=window.showPage; window.showPage=function(page,btn){const r=oldShow?oldShow.apply(this,arguments):undefined; if(page==='attendance') [50,500,1600,3000].forEach(t=>setTimeout(()=>renderAdmin(true),t)); return r;};
  const oldSup=window.showSupervisorWindow; window.showSupervisorWindow=function(id,btn){const r=oldSup?oldSup.apply(this,arguments):undefined; if(id==='supAttendance') [50,500,1600].forEach(t=>setTimeout(renderSupervisor,t)); return r;};
  const oldInit=window.initSupervisor; window.initSupervisor=async function(){if(oldInit) await oldInit.apply(this,arguments); setTimeout(renderSupervisor,600);};
  document.addEventListener('DOMContentLoaded',()=>{bindGlobals(); setTimeout(()=>{if($('attendance')&&!$('attendance').classList.contains('hidden'))renderAdmin(true); if($('supervisorAttendanceList'))renderSupervisor();},1200); setTimeout(()=>{if($('attendance')&&!$('attRootV10215')&&!$('attendance').classList.contains('hidden'))renderAdmin(true);},3500);});
  try{new MutationObserver(()=>{if($('attendance')&&!$('attendance').classList.contains('hidden')&&!$('attRootV10215')) setTimeout(()=>renderAdmin(true),50);}).observe(document.body,{childList:true,subtree:true});}catch(_){}
  console.log('Tasneef attendance v10215 RPC save loaded '+BUILD);
})();

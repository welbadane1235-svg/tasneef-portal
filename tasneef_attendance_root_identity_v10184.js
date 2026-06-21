/* ===== Tasneef v10184 - ROOT attendance identity fix =====
   الهدف: العامل له هوية واحدة في الحضور والغياب مبنية على الاسم الموحّد،
   ولا يظهر مكررًا بسبب اختلاف المشروع أو وجود أكثر من worker_id لنفس الاسم.
*/
(function(){
  if(window.__TASNEEF_ATTENDANCE_ROOT_IDENTITY_V10184__) return;
  window.__TASNEEF_ATTENDANCE_ROOT_IDENTITY_V10184__ = true;
  const BUILD='v10184-root-attendance-identity';
  const $ = id => document.getElementById(id);
  const arr = v => Array.isArray(v) ? v : [];
  const str = v => String(v ?? '').trim();
  const esc = v => str(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ds = () => window.data || {};
  const today = () => { try { return window.today(); } catch(e){ return new Date().toISOString().slice(0,10); } };
  const uid = () => { try { return window.session()?.id || null; } catch(e){ return null; } };
  const ok = (t, bad=false) => { try { (window.msg||window.message||alert)(t, bad?'err':'ok'); } catch(e){ alert(t); } };
  const idkey = v => str(v);
  function normName(v){
    return str(v)
      .replace(/[\u064B-\u065F\u0670]/g,'')
      .replace(/[إأآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
      .replace(/ـ/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  }
  function workerNameById(id){
    const w = arr(ds().workers).find(x=>idkey(x.id)===idkey(id));
    return str(w?.name || w?.full_name || w?.worker_name || '');
  }
  function workerRow(id){ return arr(ds().workers).find(x=>idkey(x.id)===idkey(id)) || {}; }
  function supervisorNameById(id){
    try { return window.supervisorName(id); } catch(e){}
    return arr(ds().supervisors).concat(arr(ds().users)).find(x=>idkey(x.id)===idkey(id))?.full_name || '-';
  }
  function projectNameById(id){
    try { return window.projectName(id); } catch(e){}
    return arr(ds().projects).find(x=>idkey(x.id)===idkey(id))?.name || '-';
  }
  function recDate(a){ return str(a.attendance_date || a.date || a.work_date || str(a.created_at).slice(0,10)); }
  function recWorkerName(a){ return workerNameById(a.worker_id) || a.worker_name || a.name || ''; }
  function recKey(a){ return normName(recWorkerName(a)) || ('id:'+idkey(a.worker_id)); }
  function statusRank(s){ s=str(s); if(s==='absent'||s==='غائب') return 3; if(s==='leave'||s==='إجازة'||s==='اجازه') return 2; if(s==='transfer'||s==='نقل') return 1; if(s==='present'||s==='حاضر') return 0; return 0; }
  function bestRecord(records){
    const rs=arr(records).slice();
    rs.sort((a,b)=>{
      const r=statusRank(b.status)-statusRank(a.status); if(r) return r;
      return str(b.updated_at||b.created_at||b.id).localeCompare(str(a.updated_at||a.created_at||a.id));
    });
    return rs[0] || {};
  }
  function uniqueText(list){
    const seen=new Set(), out=[];
    arr(list).forEach(v=>{ v=str(v); if(!v||v==='-'||seen.has(v)) return; seen.add(v); out.push(v); });
    return out.join('، ') || '-';
  }
  function workerSupervisorIds(w){
    const vals=[w.supervisor_id,w.assigned_supervisor_id,w.app_supervisor_id,w.current_supervisor_id,w.supervisor];
    return vals.map(idkey).filter(Boolean);
  }
  function workerProjectIds(w){
    const vals=[w.project_id,w.assigned_project_id,w.current_project_id,w.project];
    ['project_ids','projects','assigned_projects'].forEach(k=>{
      const v=w[k];
      if(Array.isArray(v)) vals.push(...v); else if(typeof v==='string') vals.push(...v.split(/[،,|]/));
    });
    return vals.map(idkey).filter(Boolean);
  }
  function canonicalWorkers(filter={}){
    const map=new Map();
    const sid=idkey(filter.supervisor_id||'');
    const pid=idkey(filter.project_id||'');
    arr(ds().workers).forEach(w=>{
      const name=str(w.name||w.full_name||w.worker_name); const key=normName(name); if(!key) return;
      const sids=workerSupervisorIds(w), pids=workerProjectIds(w);
      if(sid && !sids.includes(sid) && idkey(w.supervisor_id)!==sid) return;
      if(pid && !pids.includes(pid) && idkey(w.project_id)!==pid) return;
      if(!map.has(key)) map.set(key,{key,name,ids:[],rows:[],supervisor_ids:new Set(),project_ids:new Set()});
      const g=map.get(key); g.ids.push(w.id); g.rows.push(w); sids.forEach(x=>g.supervisor_ids.add(x)); pids.forEach(x=>g.project_ids.add(x));
      if(Number(w.id) && (!Number(g.id) || Number(w.id)<Number(g.id))) g.id=w.id;
    });
    return [...map.values()].sort((a,b)=>str(a.name).localeCompare(str(b.name),'ar'));
  }
  function filteredAttendanceRecords(opts={}){
    let rows=arr(ds().attendance).slice();
    const date=str(opts.date||''); const month=str(opts.month||''); const sid=idkey(opts.supervisor_id||''); const q=normName(opts.search||'');
    if(date) rows=rows.filter(a=>recDate(a)===date);
    if(month) rows=rows.filter(a=>recDate(a).slice(0,7)===month);
    if(sid) rows=rows.filter(a=>{
      const w=workerRow(a.worker_id); const s=idkey(a.supervisor_id||w.supervisor_id||w.assigned_supervisor_id||'');
      return s===sid;
    });
    if(q) rows=rows.filter(a=>normName([recWorkerName(a), supervisorNameById(a.supervisor_id), projectNameById(a.project_id), a.notes, a.status].join(' ')).includes(q));
    return rows;
  }
  function groupAttendance(rows){
    const map=new Map();
    arr(rows).forEach(a=>{
      const key=recDate(a)+'|'+recKey(a);
      if(!map.has(key)) map.set(key,{date:recDate(a),key:recKey(a),name:recWorkerName(a),records:[]});
      map.get(key).records.push(a);
    });
    return [...map.values()].sort((a,b)=>(b.date+a.name).localeCompare(a.date+b.name,'ar'));
  }
  function badge(status){
    const s=str(status);
    if(s==='absent'||s==='غائب') return '<span class="badge red">غائب</span>';
    if(s==='leave'||s==='إجازة'||s==='اجازه') return '<span class="badge amber">إجازة</span>';
    if(s==='transfer'||s==='نقل') return '<span class="badge">نقل</span>';
    return '<span class="badge green">حاضر</span>';
  }
  function shortStatus(status){
    const s=str(status);
    if(s==='absent'||s==='غائب') return {t:'غ',c:'red',rank:3};
    if(s==='leave'||s==='إجازة'||s==='اجازه') return {t:'ج',c:'amber',rank:2};
    if(s==='transfer'||s==='نقل') return {t:'ن',c:'',rank:1};
    if(s==='present'||s==='حاضر') return {t:'ح',c:'green',rank:0};
    return {t:'-',c:'',rank:-1};
  }
  window.tasneefAttendanceIdentityKeyV10184 = normName;

  async function findCanonicalAttendance(date, workerId){
    const name=workerNameById(workerId); const key=normName(name);
    const ids=arr(ds().workers).filter(w=>normName(w.name||w.full_name||w.worker_name)===key).map(w=>w.id).filter(Boolean);
    let local=arr(ds().attendance).filter(a=>recDate(a)===date && ids.map(idkey).includes(idkey(a.worker_id)));
    if(local.length) return local;
    try{
      const r=await sb.from('attendance').select('*').eq('attendance_date',date).in('worker_id',ids.length?ids:[workerId]);
      return r.data || [];
    }catch(e){ return local; }
  }
  async function saveOneAttendanceRoot(row){
    const existing=await findCanonicalAttendance(row.attendance_date,row.worker_id);
    const keep=bestRecord(existing);
    if(keep && keep.id){
      const res=await sb.from('attendance').update(row).eq('id',keep.id);
      if(res.error) throw res.error;
      return {updated:true,id:keep.id};
    }
    const res=await sb.from('attendance').insert([row]).select().single();
    if(res.error) throw res.error;
    return {inserted:true,id:res.data?.id};
  }

  window.saveAttendance = async function(){
    const workerId=Number($('attendanceWorker')?.value)||0;
    if(!workerId) return ok('اختر العامل',true);
    const w=workerRow(workerId);
    const row={
      attendance_date:$('attendanceDate')?.value || today(),
      worker_id:workerId,
      supervisor_id:Number($('attendanceSupervisor')?.value || w.supervisor_id || w.assigned_supervisor_id) || null,
      project_id:null,
      status:$('attendanceStatus')?.value || 'present',
      notes:$('attendanceNotes')?.value || '',
      created_by:uid()
    };
    try{
      const id=$('attendanceId')?.value||'';
      if(id){ const res=await sb.from('attendance').update(row).eq('id',id); if(res.error) throw res.error; }
      else await saveOneAttendanceRoot(row);
      ok('تم حفظ الحضور باسم العامل مرة واحدة');
      try{ window.clearAttendanceForm&&window.clearAttendanceForm(); }catch(e){}
      try{ await window.refreshAll(); }catch(e){ try{ await window.loadAll(); }catch(_){} }
      renderAllRoot();
    }catch(e){ console.error(e); ok(e.message||String(e),true); }
  };

  window.quickAttendance = async function(workerId,status){
    if($('attendanceWorker')) $('attendanceWorker').value=workerId;
    if($('attendanceStatus')) $('attendanceStatus').value=status;
    const w=workerRow(workerId);
    if($('attendanceSupervisor')) $('attendanceSupervisor').value=w.supervisor_id||w.assigned_supervisor_id||$('attendanceSupervisor').value||'';
    if($('attendanceProject')) $('attendanceProject').value='';
    return window.saveAttendance();
  };

  window.renderAttendanceWorkersQuick = function(){
    const div=$('attendanceQuick'); if(!div) return;
    const sid=$('attendanceSupervisor')?.value||'';
    if(!sid){ div.innerHTML=''; return; }
    const rows=canonicalWorkers({supervisor_id:sid});
    div.innerHTML=rows.map(g=>`<div class="quick-item"><b>${esc(g.name)}</b><small>مشاريع: ${esc(uniqueText([...g.project_ids].map(projectNameById)))}</small><div><button onclick="quickAttendance(${Number(g.id)},'present')">حاضر</button> <button class="danger" onclick="quickAttendance(${Number(g.id)},'absent')">غائب</button></div></div>`).join('') || '<div class="quick-item">لا توجد أسماء عمال لهذا المشرف</div>';
  };

  window.renderAttendance = function(){
    const b=$('attendanceBody'); if(!b) return;
    const rows=filteredAttendanceRecords({date:$('attendanceFilterDate')?.value||'', supervisor_id:$('attendanceFilterSupervisor')?.value||'', search:$('attendanceSearch')?.value||''});
    const groups=groupAttendance(rows);
    b.innerHTML=groups.map(g=>{
      const r=bestRecord(g.records); const ids=g.records.map(x=>x.id).filter(Boolean).join(',');
      const sups=uniqueText(g.records.map(x=>x.supervisor_id||workerRow(x.worker_id).supervisor_id).map(supervisorNameById));
      const projs=uniqueText(g.records.map(x=>x.project_id).map(projectNameById));
      const notes=uniqueText(g.records.map(x=>x.notes));
      const duplicateNote=g.records.length>1?`<small style="display:block;color:#777">مجمّع من ${g.records.length} سجلات محفوظة</small>`:'';
      return `<tr data-att-root-ids="${esc(ids)}"><td>${esc(g.date)}</td><td><b>${esc(g.name)}</b>${duplicateNote}</td><td>${esc(sups)}</td><td>${esc(projs)}</td><td>${badge(r.status)}</td><td>${esc(notes)}</td><td class="row-actions"><button onclick="editAttendance(${Number(r.id)})">تعديل</button><button class="danger" onclick="deleteAttendanceRootGroup('${esc(ids)}')">حذف</button></td></tr>`;
    }).join('') || '<tr><td colspan="7">لا توجد بيانات</td></tr>';
    try{ window.renderAttendanceWorkersQuick(); }catch(e){}
  };
  window.deleteAttendanceRootGroup = async function(idsText){
    const ids=str(idsText).split(',').map(x=>Number(x)).filter(Boolean);
    if(!ids.length) return;
    if(!confirm('حذف سجل هذا العامل لهذا اليوم؟')) return;
    const res=await sb.from('attendance').delete().in('id',ids);
    if(res.error) return ok(res.error.message,true);
    ok('تم حذف السجل'); try{ await window.refreshAll(); }catch(e){} renderAllRoot();
  };

  window.renderSupervisorAttendanceList = function(){
    const list=$('supervisorAttendanceList'); if(!list) return;
    const u=window.session?window.session():{};
    const selected=$('attendanceProject')?.value||''; const date=$('attendanceDate')?.value||today();
    const filter={supervisor_id:u?.id}; if(selected) filter.project_id=selected;
    const workers=canonicalWorkers(filter);
    const todays=filteredAttendanceRecords({date, supervisor_id:u?.id});
    const byKey=new Map(); todays.forEach(a=>{ const k=recKey(a); if(!byKey.has(k)) byKey.set(k,[]); byKey.get(k).push(a); });
    list.innerHTML=workers.map(g=>{
      const recs=byKey.get(g.key)||[]; const r=bestRecord(recs); const st=r.status||'present';
      const projects=uniqueText([...g.project_ids].map(projectNameById).concat(recs.map(x=>projectNameById(x.project_id))));
      return `<div class="quick-item att-root-card" data-worker="${Number(g.id)}" data-worker-name="${esc(g.name)}"><b>${esc(g.name)}</b><small>المشاريع: ${esc(projects)}</small>${recs.length>1?`<small style="color:#777">مجمّع من ${recs.length} سجلات محفوظة</small>`:''}<select data-worker="${Number(g.id)}"><option value="present" ${st==='present'?'selected':''}>حاضر</option><option value="absent" ${st==='absent'?'selected':''}>غائب</option><option value="leave" ${st==='leave'?'selected':''}>إجازة</option><option value="transfer" ${st==='transfer'?'selected':''}>نقل</option></select><input class="att-note-root" placeholder="ملاحظة اختيارية" value="${esc(r.notes||'')}"></div>`;
    }).join('') || '<div class="quick-item">لا توجد أسماء عمال مرتبطة بهذا المشرف/المشروع</div>';
  };

  window.saveSupervisorAttendance = async function(){
    const u=window.session?window.session():{}; if(!u?.id) return ok('سجّل الدخول أولاً',true);
    const date=$('attendanceDate')?.value||today(); const selected=$('attendanceProject')?.value||'';
    const cards=[...document.querySelectorAll('#supervisorAttendanceList .att-root-card')];
    let okCount=0, fail=0, last='';
    for(const c of cards){
      const wid=Number(c.dataset.worker)||0; if(!wid) continue;
      const status=c.querySelector('select')?.value||'present';
      const note=c.querySelector('.att-note-root')?.value||'';
      const row={attendance_date:date, worker_id:wid, supervisor_id:Number(u.id)||u.id, project_id:selected?Number(selected)||selected:null, status, notes:note, created_by:Number(u.id)||u.id};
      try{ await saveOneAttendanceRoot(row); okCount++; }catch(e){ fail++; last=e.message||String(e); console.error(e,row); }
    }
    ok(fail?`تم حفظ ${okCount} وفشل ${fail}: ${last}`:`تم حفظ تحضير ${okCount} عامل بدون تكرار`, !!fail);
    try{ await window.loadAll(); }catch(e){ try{ await window.refreshAll(); }catch(_){} }
    renderAllRoot();
  };

  window.renderAttendanceMonthly = function(){
    const head=$('attendanceMatrixHead'), body=$('attendanceMatrixBody'); if(!head||!body) return;
    const month=$('attendanceMatrixMonth')?.value || today().slice(0,7);
    const sid=$('attendanceMatrixSupervisor')?.value || '';
    const q=$('attendanceMatrixSearch')?.value || '';
    const [y,m]=month.split('-').map(Number); const days=new Date(y,m,0).getDate();
    const rows=filteredAttendanceRecords({month, supervisor_id:sid, search:q});
    const byWorker=new Map();
    rows.forEach(a=>{ const k=recKey(a); if(!byWorker.has(k)) byWorker.set(k,{key:k,name:recWorkerName(a),records:[]}); byWorker.get(k).records.push(a); });
    const groups=[...byWorker.values()].sort((a,b)=>str(a.name).localeCompare(str(b.name),'ar'));
    head.innerHTML='<tr><th>الاسم</th><th>النوع</th><th>المشرف / الفني</th><th>المشروع</th><th>الفترة</th>'+Array.from({length:days},(_,i)=>`<th>${String(i+1).padStart(2,'0')}</th>`).join('')+'<th>حضور</th><th>غياب</th><th>النسبة</th></tr>';
    let totalP=0,totalA=0;
    body.innerHTML=groups.map(g=>{
      const byDate=new Map(); g.records.forEach(r=>{ const d=recDate(r); if(!byDate.has(d)) byDate.set(d,[]); byDate.get(d).push(r); });
      let p=0,a=0; const cells=[];
      for(let i=1;i<=days;i++){
        const ds=month+'-'+String(i).padStart(2,'0'); const recs=byDate.get(ds)||[]; const inf=shortStatus(bestRecord(recs).status);
        if(inf.t==='ح') p++; if(inf.t==='غ') a++;
        cells.push(`<td><span class="badge ${esc(inf.c)}">${esc(inf.t)}</span></td>`);
      }
      totalP+=p; totalA+=a;
      const sups=uniqueText(g.records.map(r=>r.supervisor_id||workerRow(r.worker_id).supervisor_id).map(supervisorNameById));
      const projs=uniqueText(g.records.map(r=>r.project_id).map(projectNameById));
      const pct=(p+a)?(p/(p+a)*100):0;
      return `<tr><td><b>${esc(g.name)}</b>${g.records.length>days?'<small style="display:block;color:#777">سجلات متعددة مجمّعة</small>':''}</td><td>عامل</td><td>${esc(sups)}</td><td>${esc(projs)}</td><td>-</td>${cells.join('')}<td>${p}</td><td>${a}</td><td>${pct.toFixed(1)}%</td></tr>`;
    }).join('') || `<tr><td colspan="${days+8}">لا توجد بيانات</td></tr>`;
    const sum=$('attendanceMatrixSummary'); if(sum){ const pct=(totalP+totalA)?totalP/(totalP+totalA)*100:0; sum.innerHTML=`<div class="kpi"><small>عدد العمال بدون تكرار</small><b>${groups.length}</b></div><div class="kpi"><small>إجمالي الحضور</small><b>${totalP}</b></div><div class="kpi"><small>إجمالي الغياب</small><b>${totalA}</b></div><div class="kpi"><small>نسبة الحضور</small><b>${pct.toFixed(1)}%</b></div>`; }
  };

  window.exportAttendanceMatrixCSV = function(){
    try{ window.renderAttendanceMonthly(); }catch(e){}
    const rows=[];
    rows.push([...document.querySelectorAll('#attendanceMatrixHead th')].map(th=>'"'+th.textContent.trim().replace(/"/g,'""')+'"').join(','));
    document.querySelectorAll('#attendanceMatrixBody tr').forEach(tr=>rows.push([...tr.children].map(td=>'"'+td.textContent.trim().replace(/"/g,'""')+'"').join(',')));
    const month=$('attendanceMatrixMonth')?.value||today().slice(0,7);
    try{ if(window.download) window.download(`attendance-${month}-names-once.csv`,rows.join('\n')); else { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8'})); a.download=`attendance-${month}-names-once.csv`; a.click(); } }catch(e){ console.error(e); }
  };
  window.printAttendanceMonthlyV343 = function(){ try{ window.renderAttendanceMonthly(); }catch(e){} setTimeout(()=>window.print(),100); };

  function renderAllRoot(){
    try{ window.renderAttendanceWorkersQuick(); }catch(e){}
    try{ window.renderSupervisorAttendanceList(); }catch(e){}
    try{ window.renderAttendance(); }catch(e){}
    try{ window.renderAttendanceMonthly(); }catch(e){}
  }
  window.tasneefAttendanceRootRefreshV10184 = renderAllRoot;
  document.addEventListener('change', e=>{ if(e.target && ['attendanceDate','attendanceProject','attendanceSupervisor','attendanceFilterDate','attendanceFilterSupervisor','attendanceMatrixMonth','attendanceMatrixSupervisor','attendanceMatrixProject'].includes(e.target.id)) setTimeout(renderAllRoot,80); });
  document.addEventListener('input', e=>{ if(e.target && ['attendanceSearch','attendanceMatrixSearch'].includes(e.target.id)) setTimeout(renderAllRoot,80); });
  document.addEventListener('DOMContentLoaded',()=>setTimeout(renderAllRoot,1800));
  setTimeout(renderAllRoot,2600);
  console.log('Tasneef attendance root identity loaded', BUILD);
})();

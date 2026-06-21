/* Tasneef v10183 - FORCE attendance names once, keep records in DB */
(function(){
  'use strict';
  const BUILD='v10183_ATTENDANCE_NAMES_ONCE_FORCE';
  if(window.__tasneefAttendanceNamesOnceForceV10183) return;
  window.__tasneefAttendanceNamesOnceForceV10183=true;

  const $id=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const E=s=>S(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const N=v=>{ const n=Number(v); return Number.isFinite(n)?n:null; };
  const ds=()=>window.data||{attendance:[],workers:[],projects:[],users:[],supervisors:[]};
  function todayStr(){ try{return (typeof today==='function'?today():new Date().toISOString().slice(0,10));}catch(_){return new Date().toISOString().slice(0,10);} }
  function norm(v){ return S(v).toLowerCase().replace(/[إأآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim(); }
  function idKey(v){ return S(v); }
  function workerRow(id){ return A(ds().workers).find(w=>idKey(w.id)===idKey(id))||{}; }
  function projectRow(id){ return A(ds().projects).find(p=>idKey(p.id)===idKey(id))||{}; }
  function userRow(id){ return A(ds().users).find(u=>idKey(u.id)===idKey(id))||A(ds().supervisors).find(u=>idKey(u.id)===idKey(id))||{}; }
  function workerName(id,rec){ const w=workerRow(id||rec?.worker_id); return S(w.name||w.full_name||rec?.worker_name||rec?.name||rec?.worker||''); }
  function workerKey(id,rec){ const name=workerName(id,rec); return norm(name)||('id:'+idKey(id||rec?.worker_id||'')); }
  function projectIdOf(rec){ const w=workerRow(rec?.worker_id); return rec?.project_id||rec?.assigned_project_id||w.project_id||w.assigned_project_id||w.current_project_id||''; }
  function supervisorIdOf(rec){ const w=workerRow(rec?.worker_id); const p=projectRow(projectIdOf(rec)); return rec?.supervisor_id||rec?.app_supervisor_id||w.supervisor_id||w.app_supervisor_id||w.assigned_supervisor_id||p.supervisor_id||''; }
  function pName(id){ const p=projectRow(id); try{return (typeof projectName==='function'?projectName(id):'')||S(p.name||p.project_name||p.title||id||'-');}catch(_){return S(p.name||p.project_name||p.title||id||'-')||'-';} }
  function sName(id){ const u=userRow(id); try{return (typeof supervisorName==='function'?supervisorName(id):'')||S(u.full_name||u.name||u.username||id||'-');}catch(_){return S(u.full_name||u.name||u.username||id||'-')||'-';} }
  function recDate(r){ return S(r?.attendance_date||r?.date||r?.work_date||r?.created_at).slice(0,10); }
  function recMonth(r){ return recDate(r).slice(0,7); }
  function daysInMonth(m){ const y=Number(S(m).slice(0,4)), mo=Number(S(m).slice(5,7)); return new Date(y,mo,0).getDate()||31; }
  function dateOf(m,d){ return S(m)+'-'+String(d).padStart(2,'0'); }
  function uniqueText(vals){ const out=[],seen=new Set(); A(vals).forEach(v=>{ v=S(v); const k=norm(v); if(v&&k&&!seen.has(k)){seen.add(k);out.push(v);} }); return out.join('، ')||'-'; }
  function extractShift(note){ const m=S(note).match(/الفترة\s*:\s*([^|\n]+)/); return m?S(m[1]):''; }
  function cleanNote(note){ return S(note).replace(/الفترة\s*:\s*[^|\n]+\s*\|?\s*/,'').trim(); }
  function statusInfo(st){ const x=norm(st||''); if(['present','حاضر','حضور','1','true'].includes(x))return{label:'حاضر',short:'ح',cls:'green',cell:'att-present',rank:3}; if(['absent','غايب','غائب','غياب','0','false'].includes(x))return{label:'غائب',short:'غ',cls:'red',cell:'att-absent',rank:2}; if(['leave','vacation','اجازه','اجازة','إجازة'].map(norm).includes(x))return{label:'إجازة',short:'ج',cls:'amber',cell:'att-leave',rank:1}; if(['transfer','transferred','نقل','منقول'].includes(x))return{label:'نقل',short:'ن',cls:'',cell:'att-transfer',rank:1}; return{label:'لم يسجل',short:'-',cls:'',cell:'att-empty',rank:0}; }
  function latest(records){ return A(records).slice().sort((a,b)=>Number(b?.id||0)-Number(a?.id||0))[0]||{}; }
  function bestStatus(records){ return A(records).slice().sort((a,b)=>{ const ra=statusInfo(a?.status).rank, rb=statusInfo(b?.status).rank; if(rb!==ra)return rb-ra; return Number(b?.id||0)-Number(a?.id||0); })[0]||{}; }
  function matchesSup(rec,selected){ if(!selected)return true; return idKey(supervisorIdOf(rec))===idKey(selected)||idKey(rec?.supervisor_id)===idKey(selected); }
  function active(rec){ return rec && recDate(rec) && (rec.worker_id!=null || workerName(null,rec)); }
  function workerProjectIds(w){ const out=[]; ['project_id','assigned_project_id','current_project_id'].forEach(k=>{ if(w&&w[k])out.push(w[k]); }); ['project_ids','assigned_project_ids','projects'].forEach(k=>{ const v=w&&w[k]; if(Array.isArray(v))v.forEach(x=>out.push(typeof x==='object'?(x.id||x.project_id):x)); else if(typeof v==='string')v.split(/[,،\s]+/).forEach(x=>x&&out.push(x)); }); return [...new Set(out.map(idKey).filter(Boolean))]; }
  function workerSupervisorIds(w){ const out=[]; ['supervisor_id','app_supervisor_id','assigned_supervisor_id'].forEach(k=>{ if(w&&w[k])out.push(w[k]); }); workerProjectIds(w).forEach(pid=>{ const p=projectRow(pid); if(p.supervisor_id)out.push(p.supervisor_id); }); return [...new Set(out.map(idKey).filter(Boolean))]; }
  function statusOptions(selected){ return [['present','حاضر'],['absent','غائب'],['leave','إجازة'],['transferred','نقل لمشروع آخر']].map(([v,l])=>`<option value="${v}" ${S(selected||'present')===v?'selected':''}>${l}</option>`).join(''); }
  function addStyle(){ if($id('attNamesOnceForceStyleV10183'))return; const st=document.createElement('style'); st.id='attNamesOnceForceStyleV10183'; st.textContent='.att-force-note{font-size:11px;color:#60706a;margin-top:3px;line-height:1.5}.att-cell{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:10px;font-weight:900;font-size:12px}.att-present{background:#e8f4ee;color:#137a4b;border:1px solid #b9dfcb}.att-absent{background:#fde8e8;color:#9d2222;border:1px solid #efb4b4}.att-empty{background:#f3f6f5;color:#87938f;border:1px solid #dce6e2}.att-leave{background:#fff7da;color:#8a5a00;border:1px solid #ead28d}.att-transfer{background:#eaf1ff;color:#1e4f9a;border:1px solid #bdd0ff}'; document.head.appendChild(st); }

  function groupAttendance(recs, withDate){ const map=new Map(); A(recs).filter(active).forEach(r=>{ const k=(withDate?recDate(r)+'|':'')+workerKey(r.worker_id,r); if(!map.has(k))map.set(k,{name:workerName(r.worker_id,r),records:[]}); map.get(k).records.push(r); }); return [...map.values()].sort((a,b)=>S(a.name).localeCompare(S(b.name),'ar')); }

  window.renderAttendance=function(){
    addStyle(); const b=$id('attendanceBody'); if(!b)return;
    const date=$id('attendanceFilterDate')?.value||''; const sid=$id('attendanceFilterSupervisor')?.value||''; const q=norm($id('attendanceSearch')?.value||'');
    const table=b.closest('table'); const th=table?.querySelector('thead'); if(th) th.innerHTML='<tr><th>التاريخ</th><th>العامل</th><th>المشرف</th><th>المشروع</th><th>الحالة</th><th>الفترة</th><th>ملاحظات</th><th>إجراء</th></tr>';
    let recs=A(ds().attendance).filter(r=>(!date||recDate(r)===date)&&matchesSup(r,sid));
    if(q) recs=recs.filter(r=>norm([workerName(r.worker_id,r),pName(projectIdOf(r)),sName(supervisorIdOf(r)),S(r.notes)].join(' ')).includes(q));
    const groups=groupAttendance(recs,true);
    b.innerHTML=groups.map(g=>{ const sample=bestStatus(g.records); const st=statusInfo(sample.status); const edit=latest(g.records); const projects=uniqueText(g.records.map(projectIdOf).filter(Boolean).map(pName)); const sups=uniqueText(g.records.map(supervisorIdOf).filter(Boolean).map(sName)); const shifts=uniqueText(g.records.map(x=>extractShift(x.notes)).filter(Boolean)); const notes=uniqueText(g.records.map(x=>cleanNote(x.notes)).filter(Boolean)); return `<tr><td>${E(recDate(sample)||recDate(g.records[0]))}</td><td><b>${E(g.name)}</b><div class="att-force-note">${g.records.length>1?'تم تجميع '+g.records.length+' سجلات محفوظة لنفس العامل':''}</div></td><td>${E(sups)}</td><td>${E(projects)}</td><td><span class="badge ${E(st.cls)}">${E(st.label)}</span></td><td>${E(shifts)}</td><td>${E(notes)}</td><td class="row-actions">${edit.id?`<button onclick="editAttendance(${Number(edit.id)})">تعديل آخر سجل</button>`:''}</td></tr>`; }).join('')||'<tr><td colspan="8">لا توجد سجلات حضور حسب الفلتر المختار</td></tr>';
  };
  try{ renderAttendance=window.renderAttendance; }catch(_){}

  window.renderAttendanceMonthly=function(){
    addStyle(); const body=$id('attendanceMatrixBody'), head=$id('attendanceMatrixHead'); if(!body||!head)return;
    const mEl=$id('attendanceMatrixMonth'); if(mEl&&!mEl.value)mEl.value=todayStr().slice(0,7);
    const month=mEl?.value||todayStr().slice(0,7); const sid=$id('attendanceMatrixSupervisor')?.value||''; const q=norm($id('attendanceMatrixSearch')?.value||''); const days=daysInMonth(month);
    let recs=A(ds().attendance).filter(r=>recMonth(r)===month&&matchesSup(r,sid));
    if(q) recs=recs.filter(r=>norm([workerName(r.worker_id,r),pName(projectIdOf(r)),sName(supervisorIdOf(r)),S(r.notes)].join(' ')).includes(q));
    const groups=groupAttendance(recs,false);
    head.innerHTML='<tr><th>الاسم</th><th>النوع</th><th>المشرف / الغني</th><th>المشاريع المسجلة</th><th>الفترات</th>'+Array.from({length:days},(_,i)=>`<th>${String(i+1).padStart(2,'0')}</th>`).join('')+'<th>حضور</th><th>غياب</th><th>إجازة</th><th>نقل</th><th>النسبة</th></tr>';
    let totalP=0,totalA=0,totalL=0,totalT=0; body.closest('table')?.classList.add('attendance-matrix-v10183');
    body.innerHTML=groups.map(g=>{ const byDate=new Map(); g.records.forEach(r=>{ const d=recDate(r); if(!byDate.has(d))byDate.set(d,[]); byDate.get(d).push(r); }); let p=0,a=0,l=0,t=0; const cells=[]; for(let d=1;d<=days;d++){ const inf=statusInfo(bestStatus(byDate.get(dateOf(month,d))||[]).status); if(inf.short==='ح')p++; else if(inf.short==='غ')a++; else if(inf.short==='ج')l++; else if(inf.short==='ن')t++; cells.push(`<td title="${E(inf.label)}"><span class="att-cell ${E(inf.cell)}">${E(inf.short)}</span></td>`); } totalP+=p; totalA+=a; totalL+=l; totalT+=t; const sample=latest(g.records); const w=workerRow(sample.worker_id); const type=(norm(w.worker_type||w.type).includes('مساند')||S(w.worker_type||w.type).toLowerCase().includes('support'))?'بديل / مساند':'عامل'; const sups=uniqueText(g.records.map(supervisorIdOf).filter(Boolean).map(sName)); const projs=uniqueText(g.records.map(projectIdOf).filter(Boolean).map(pName)); const shifts=uniqueText(g.records.map(r=>extractShift(r.notes)).filter(Boolean)); const denom=p+a+l+t; const pct=denom?p/denom*100:0; const cls=pct>=90?'green':(pct>=70?'amber':'red'); return `<tr><td><b>${E(g.name)}</b><div class="att-force-note">${g.records.length>1?'السجلات محفوظة ومجمعة: '+g.records.length:''}</div></td><td>${E(type)}</td><td>${E(sups)}</td><td>${E(projs)}</td><td>${E(shifts)}</td>${cells.join('')}<td><span class="badge green">${p}</span></td><td><span class="badge red">${a}</span></td><td><span class="badge amber">${l}</span></td><td><span class="badge">${t}</span></td><td><span class="badge ${E(cls)}">${pct.toFixed(1)}%</span></td></tr>`; }).join('')||`<tr><td colspan="${days+10}">لا توجد سجلات حضور مطابقة للفلاتر المختارة</td></tr>`;
    const denom=totalP+totalA+totalL+totalT; const pct=denom?totalP/denom*100:0; const sum=$id('attendanceMatrixSummary'); if(sum)sum.innerHTML=`<div class="kpi"><small>عدد العمال بدون تكرار</small><b>${groups.length}</b></div><div class="kpi"><small>إجمالي الحضور</small><b>${totalP}</b></div><div class="kpi"><small>إجمالي الغياب</small><b>${totalA}</b></div><div class="kpi"><small>نسبة الحضور</small><b>${pct.toFixed(1)}%</b></div>`;
  };
  try{ renderAttendanceMonthly=window.renderAttendanceMonthly; }catch(_){}

  window.renderAttendanceWorkersQuick=function(){
    const div=$id('attendanceQuick'); if(!div)return; const sid=$id('attendanceSupervisor')?.value||''; if(!sid){div.innerHTML='';return;}
    const seen=new Set(), rows=[]; A(ds().workers).forEach(w=>{ const k=norm(w.name||w.full_name); if(!k||seen.has(k))return; if(workerSupervisorIds(w).includes(idKey(sid))||idKey(w.supervisor_id)===idKey(sid)||idKey(w.app_supervisor_id)===idKey(sid)){seen.add(k);rows.push(w);} });
    div.innerHTML=rows.map(w=>`<div class="quick-item"><b>${E(w.name||w.full_name)}</b><div><button onclick="quickAttendance(${Number(w.id)},'present')">حاضر</button> <button class="danger" onclick="quickAttendance(${Number(w.id)},'absent')">غائب</button></div></div>`).join('');
  };
  try{ renderAttendanceWorkersQuick=window.renderAttendanceWorkersQuick; }catch(_){}

  function supervisorContext(){ const u=(typeof session==='function'?session():{})||{}; const allProjects=A(ds().projects); const supProjects=allProjects.filter(p=>idKey(p.supervisor_id)===idKey(u.id)); const pids=new Set(supProjects.map(p=>idKey(p.id))); const workers=A(ds().workers).filter(w=>workerSupervisorIds(w).includes(idKey(u.id))||workerProjectIds(w).some(pid=>pids.has(idKey(pid)))); return {u,projects:supProjects,workers}; }
  window.renderSupervisorAttendanceList=function(){
    addStyle(); const list=$id('supervisorAttendanceList'); if(!list)return; const {projects,workers}=supervisorContext(); const selected=$id('attendanceProject')?.value||''; const date=$id('attendanceDate')?.value||todayStr(); const q=norm($id('attendanceWorkerSearchV343')?.value||'');
    const seen=new Set(), rows=[]; workers.forEach(w=>{ const k=norm(w.name||w.full_name); if(!k||seen.has(k))return; const pids=workerProjectIds(w); if(selected && !pids.includes(idKey(selected)) && idKey(w.project_id)!==idKey(selected))return; if(q&&!norm(w.name||w.full_name).includes(q))return; seen.add(k); rows.push(w); }); rows.sort((a,b)=>S(a.name||a.full_name).localeCompare(S(b.name||b.full_name),'ar'));
    const todays=A(ds().attendance).filter(a=>recDate(a)===date); const byName=new Map(); todays.forEach(a=>{ const k=workerKey(a.worker_id,a); if(!byName.has(k))byName.set(k,[]); byName.get(k).push(a); });
    list.innerHTML=rows.map(w=>{ const k=norm(w.name||w.full_name); const recs=byName.get(k)||[]; const rec=latest(recs); const pid=selected||projectIdOf(rec)||workerProjectIds(w)[0]||w.project_id||''; const projectsText=uniqueText([...(workerProjectIds(w).map(pName)),...(recs.map(projectIdOf).filter(Boolean).map(pName))]); const st=rec.status||'present'; return `<div class="att-v343-card" data-worker="${E(w.id)}" data-worker-name="${E(w.name||w.full_name)}" data-project="${E(pid)}"><div class="att-v343-name">${E(w.name||w.full_name)}</div><div class="att-v343-meta">المشاريع: <b>${E(projectsText)}</b>${recs.length>1?`<br><span class="att-force-note">له ${recs.length} سجلات محفوظة، وسيظهر مرة واحدة فقط.</span>`:''}</div><div class="att-v343-row"><select class="att-status-v343" data-worker="${E(w.id)}" data-project="${E(pid)}">${statusOptions(st)}</select><input class="att-v343-note" data-worker="${E(w.id)}" placeholder="ملاحظة اختيارية" value="${E(cleanNote(rec.notes||''))}"></div></div>`; }).join('')||'<div class="sup-help">لا توجد أسماء مرتبطة بهذا المشروع أو المشرف.</div>';
  };
  try{ renderSupervisorAttendanceList=window.renderSupervisorAttendanceList; }catch(_){}

  window.saveSupervisorAttendance=async function(){
    const u=(typeof session==='function'?session():{})||{}; if(!u.id)return (typeof message==='function'?message('سجّل الدخول أولاً','err'):alert('سجّل الدخول أولاً'));
    const date=$id('attendanceDate')?.value||todayStr(); const shift=$id('attendanceShiftType')?.value||'زيارة يومية'; const selected=$id('attendanceProject')?.value||''; const cards=[...document.querySelectorAll('#supervisorAttendanceList .att-v343-card')];
    let ok=0,fail=0,last=''; const savedNames=new Set();
    for(const c of cards){ const nameKey=norm(c.dataset.workerName||c.querySelector('.att-v343-name')?.textContent||''); if(!nameKey||savedNames.has(nameKey))continue; savedNames.add(nameKey); const wid=N(c.dataset.worker); if(!wid)continue; const status=c.querySelector('select.att-status-v343')?.value||'present'; const note=c.querySelector('.att-v343-note')?.value||''; const pid=selected||c.dataset.project||''; const row={attendance_date:date,worker_id:wid,supervisor_id:N(u.id)||u.id,project_id:pid?(N(pid)||pid):null,status,notes:`الفترة: ${shift}${note?' | '+note:''}`,created_by:N(u.id)||u.id}; try{ const found=await sb.from('attendance').select('id,worker_id').eq('attendance_date',date).eq('worker_id',wid).limit(1); if(found.error)throw found.error; const res=(found.data&&found.data[0])?await sb.from('attendance').update(row).eq('id',found.data[0].id):await sb.from('attendance').insert([row]); if(res.error)throw res.error; ok++; }catch(e){fail++; last=e?.message||String(e); console.error('attendance save v10183 failed',row,e);} }
    const msgTxt=fail?`تم حفظ ${ok} وفشل ${fail}: ${last}`:`تم حفظ تحضير اليوم بدون تكرار لعدد ${ok} عامل`; try{ if(typeof message==='function')message(msgTxt,fail?'err':'ok'); else alert(msgTxt); }catch(_){ alert(msgTxt); }
    try{ if(typeof loadAll==='function')await loadAll(); }catch(_){} try{window.renderSupervisorAttendanceList();window.renderAttendance&&window.renderAttendance();window.renderAttendanceMonthly&&window.renderAttendanceMonthly();}catch(_){}
  };
  try{ saveSupervisorAttendance=window.saveSupervisorAttendance; }catch(_){}

  window.printAttendanceMonthlyV343=function(){ try{window.renderAttendanceMonthly();}catch(_){} setTimeout(()=>window.print(),100); };
  window.exportAttendanceMatrixCSV=function(){ try{window.renderAttendanceMonthly();}catch(_){} const rows=[]; rows.push([...document.querySelectorAll('#attendanceMatrixHead th')].map(th=>'"'+th.textContent.trim().replace(/"/g,'""')+'"').join(',')); document.querySelectorAll('#attendanceMatrixBody tr').forEach(tr=>rows.push([...tr.children].map(td=>'"'+td.textContent.trim().replace(/"/g,'""')+'"').join(','))); const month=$id('attendanceMatrixMonth')?.value||todayStr().slice(0,7); try{ if(typeof download==='function')download(`attendance-${month}-names-once.csv`,rows.join('\n')); else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8'}));a.download=`attendance-${month}-names-once.csv`;a.click();} }catch(e){console.error(e);} };

  function refresh(){ try{window.renderAttendance&&window.renderAttendance();}catch(_){} try{window.renderAttendanceMonthly&&window.renderAttendanceMonthly();}catch(_){} try{window.renderAttendanceWorkersQuick&&window.renderAttendanceWorkersQuick();}catch(_){} try{window.renderSupervisorAttendanceList&&window.renderSupervisorAttendanceList();}catch(_){} }
  document.addEventListener('change',e=>{ if(e.target&&['attendanceMatrixMonth','attendanceMatrixSupervisor','attendanceFilterSupervisor','attendanceFilterDate','attendanceProject','attendanceDate'].includes(e.target.id)) setTimeout(refresh,60); });
  document.addEventListener('input',e=>{ if(e.target&&['attendanceMatrixSearch','attendanceSearch','attendanceWorkerSearchV343'].includes(e.target.id)) setTimeout(refresh,60); });
  document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh,1600));
  setTimeout(refresh,2400);
  window.TASNEEF_ATTENDANCE_NAMES_ONCE_FORCE_BUILD=BUILD;
  console.log('Tasneef '+BUILD+' loaded');
})();

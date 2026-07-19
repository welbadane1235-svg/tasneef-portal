(function(){
  'use strict';
  if(window.tasneefDistributionV404) return;
  const VERSION='404';
  const $=id=>document.getElementById(id);
  const S=v=>(v==null?'':String(v)).trim();
  const N=v=>{const n=Number(v||0); return Number.isFinite(n)?n:0};
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>S(v).replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/\s+/g,' ').toLowerCase();
  const todayMonth=()=>new Date().toISOString().slice(0,7);
  const prevMonth=m=>{const d=new Date((m||todayMonth())+'-01T00:00:00'); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7)};
  const state={ready:false,employees:null,projects:null,users:null,distByMonth:{},selected:new Map(),lastLoad:0};
  const cacheTtl=1000*60*2;
  function sb(){return window.sb || window.supabaseClient || window._supabase || null;}
  function msg(t,err){const el=$('td404Msg'); if(!el) return; el.textContent=t; el.className='msg '+(err?'err':''); el.classList.remove('hidden');}
  async function safe(q,label){try{const r=await q; if(r.error){console.warn(label,r.error); return []} return r.data||[]}catch(e){console.warn(label,e); return []}}
  function empCode(e){return S(e.employee_code||e.code||e.emp_code||e.worker_code||e.id_code||e['أيدي الموظف']||e.employee_id||e.id)}
  function empName(e){return S(e.app_name||e.display_name||e.name_in_app||e.worker_name||e.name||e.full_name||e['اسم الموظف  في التطبيق ']||e['اسم الموظف في التطبيق']||e.iqama_name||'-')}
  function empRole(e){return S(e.job_title||e.role||e.position||e.job||e['الوظيفة']||'عامل')}
  function empDisplay(e){const c=empCode(e), n=empName(e); return c && !n.startsWith(c)? `${c} - ${n}` : (n||c||'-')}
  function isSupervisor(e){const r=norm(empRole(e)); return r.includes('مشرف')||r.includes('supervisor')}
  function isWorker(e){const r=norm(empRole(e)); return r.includes('عامل')||r.includes('worker')||r.includes('حارس')||r.includes('فني')||(!isSupervisor(e))}
  function projectName(p){return S(p.name||p.project_name||p.title||'-')}
  function projectActive(p){return p && p.is_active!==false && p.active!==false && !['inactive','deleted','archived','محذوف','موقوف'].includes(norm(p.status||'active'))}
  function month(){return $('td404Month')?.value||todayMonth()}
  function selectedProject(){const id=$('td404Project')?.value; return (state.projects||[]).find(p=>S(p.id)===S(id))}
  function selectedSupervisor(){const code=$('td404Supervisor')?.value; return (state.employees||[]).find(e=>empCode(e)===code)}
  function normalizeEmployeeRows(rows){return (rows||[]).map((e,i)=>({...e,__code:empCode(e)||('EMP-'+(i+1)),__name:empName(e),__role:empRole(e)})).filter(e=>e.__name&&e.__name!=='-')}
  function readSession(key){try{const o=JSON.parse(sessionStorage.getItem(key)||'null'); if(o&&Date.now()-o.t<cacheTtl) return o.v}catch(_){ } return null}
  function writeSession(key,v){try{sessionStorage.setItem(key,JSON.stringify({t:Date.now(),v}))}catch(_){}}
  async function loadEmployees(force){
    if(!force && state.employees) return state.employees;
    const c=readSession('td404_employees'); if(!force&&c){state.employees=c; return c;}
    const client=sb(); let rows=[];
    if(client){
      rows=await safe(client.from('employees_master_v386').select('*').limit(5000),'employees_master_v386');
      if(!rows.length) rows=await safe(client.from('employees').select('*').limit(5000),'employees');
      if(!rows.length) rows=await safe(client.from('workers').select('*').eq('is_active', true).limit(5000),'workers');
    }
    if(!rows.length && window.data){rows=[...(window.data.workers||[]),...(window.data.users||[])];}
    state.employees=normalizeEmployeeRows(rows); writeSession('td404_employees',state.employees); return state.employees;
  }
  async function loadProjects(force){
    if(!force && state.projects) return state.projects;
    const c=readSession('td404_projects'); if(!force&&c){state.projects=c; return c;}
    const client=sb(); let rows=[];
    if(client) rows=await safe(client.from('projects').select('id,name,project_name,title,supervisor_id,operation_type,status,is_active,active,required_daily_minutes,friday_minutes').eq('is_active', true).order('name').limit(3000),'projects');
    if(!rows.length && window.data) rows=window.data.projects||[];
    state.projects=(rows||[]).filter(projectActive); writeSession('td404_projects',state.projects); return state.projects;
  }
  async function loadDistribution(force){
    const m=month(); if(!force && state.distByMonth[m]) return state.distByMonth[m];
    const client=sb(); let rows=[];
    if(client) rows=await safe(client.from('monthly_distribution').select('*').eq('month_key',m).order('supervisor_name').order('project_name').limit(10000),'monthly_distribution');
    state.distByMonth[m]=rows||[]; return state.distByMonth[m];
  }
  function fillSelects(){
    const sups=(state.employees||[]).filter(isSupervisor).sort((a,b)=>empDisplay(a).localeCompare(empDisplay(b),'ar'));
    const workers=(state.employees||[]).filter(isWorker);
    const sup=$('td404Supervisor'); if(sup){const old=sup.value; sup.innerHTML='<option value="">اختر المشرف</option>'+sups.map(e=>`<option value="${esc(empCode(e))}">${esc(empDisplay(e))}</option>`).join(''); if(old) sup.value=old;}
    const pr=$('td404Project'); if(pr){const old=pr.value; pr.innerHTML='<option value="">اختر المشروع</option>'+(state.projects||[]).sort((a,b)=>projectName(a).localeCompare(projectName(b),'ar')).map(p=>`<option value="${esc(p.id)}">${esc(projectName(p))}</option>`).join(''); if(old) pr.value=old;}
    const fs=$('td404FilterSupervisor'); if(fs){const old=fs.value; const names=[...new Set((state.distByMonth[month()]||[]).map(r=>r.supervisor_name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar')); fs.innerHTML='<option value="">كل المشرفين</option>'+names.map(n=>`<option>${esc(n)}</option>`).join(''); fs.value=old;}
    const fp=$('td404FilterProject'); if(fp){const old=fp.value; const names=[...new Set((state.distByMonth[month()]||[]).map(r=>r.project_name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar')); fp.innerHTML='<option value="">كل المشاريع</option>'+names.map(n=>`<option>${esc(n)}</option>`).join(''); fp.value=old;}
    renderWorkers(); renderSelected();
  }
  function renderWorkers(){
    const box=$('td404WorkersBox'); if(!box) return;
    const q=norm($('td404WorkerSearch')?.value||'');
    const list=(state.employees||[]).filter(isWorker).filter(e=>!q || norm(empDisplay(e)).includes(q) || norm(empRole(e)).includes(q)).sort((a,b)=>empDisplay(a).localeCompare(empDisplay(b),'ar'));
    box.innerHTML=list.map(e=>{const code=empCode(e), on=state.selected.has(code); return `<button type="button" class="td404-worker ${on?'on':''}" onclick="tasneefDistributionV404.toggleWorker('${esc(code)}')"><b>${esc(empDisplay(e))}</b><small>${esc(empRole(e))}</small></button>`}).join('') || '<div class="td404-empty">لا يوجد عمال</div>';
  }
  function renderSelected(){const el=$('td404SelectedWorkers'); if(!el) return; const arr=[...state.selected.values()]; el.innerHTML=arr.length?arr.map(e=>`<span class="td404-chip">${esc(empDisplay(e))}</span>`).join(''):'لا يوجد عمال مختارون';}
  function toggleWorker(code){const e=(state.employees||[]).find(x=>empCode(x)===code); if(!e) return; if(state.selected.has(code)) state.selected.delete(code); else state.selected.set(code,e); renderWorkers(); renderSelected();}
  function clearSelection(){state.selected.clear(); renderWorkers(); renderSelected(); $('td404Notes')&&($('td404Notes').value='');}
  function hydrateCurrentProjectSelection(){
    const p=selectedProject(); if(!p) return;
    const rows=(state.distByMonth[month()]||[]).filter(r=>S(r.project_id)===S(p.id) && S(r.status||'active')==='active');
    state.selected.clear();
    rows.forEach(r=>{const e=(state.employees||[]).find(x=>empCode(x)===S(r.worker_employee_code)); if(e) state.selected.set(empCode(e),e); else state.selected.set(S(r.worker_employee_code),{employee_code:r.worker_employee_code,app_name:r.worker_name||r.worker_employee_code,job_title:r.role_type||'عامل'});});
    const first=rows[0]; if(first){const sup=$('td404Supervisor'); if(sup) sup.value=S(first.supervisor_employee_code||sup.value); const notes=$('td404Notes'); if(notes) notes.value=S(first.notes||'');}
    renderWorkers(); renderSelected();
  }
  async function saveProjectDistribution(){
    const client=sb(); if(!client){msg('لا يوجد اتصال بالسيرفر. تأكد من إعداد Supabase.',true); return;}
    const m=month(), p=selectedProject(), sup=selectedSupervisor(), status=$('td404Status')?.value||'active';
    if(!m||!p||!sup){msg('اختر الشهر والمشرف والمشروع أولاً.',true); return;}
    const chosen=[...state.selected.values()]; if(!chosen.length){msg('اختر عامل واحد على الأقل.',true); return;}
    const existing=await safe(client.from('monthly_distribution').select('id,worker_employee_code').eq('month_key',m).eq('project_id',p.id),'load existing');
    const chosenCodes=new Set(chosen.map(empCode));
    const toDelete=existing.filter(r=>!chosenCodes.has(S(r.worker_employee_code))).map(r=>r.id).filter(Boolean);
    if(toDelete.length) await safe(client.from('monthly_distribution').delete().in('id',toDelete),'delete removed');
    const rows=chosen.map(e=>({
      month_key:m,
      supervisor_employee_code:empCode(sup),
      supervisor_name:empDisplay(sup),
      project_id:N(p.id),
      project_name:projectName(p),
      worker_employee_code:empCode(e),
      worker_name:empName(e),
      role_type:empRole(e)||'عامل',
      status,
      start_date:m+'-01',
      notes:S($('td404Notes')?.value||'')
    }));
    const r=await client.from('monthly_distribution').upsert(rows,{onConflict:'month_key,project_id,worker_employee_code'}).select();
    if(r.error){msg('خطأ في الحفظ: '+r.error.message,true); return;}
    delete state.distByMonth[m]; await loadDistribution(true); fillSelects(); renderDistribution(); msg('تم حفظ توزيع المشروع بنجاح.');
  }
  async function copyPreviousMonth(){
    const client=sb(); if(!client){msg('لا يوجد اتصال بالسيرفر.',true); return;}
    const m=month(), pm=prevMonth(m);
    const rows=await safe(client.from('monthly_distribution').select('*').eq('month_key',pm).limit(10000),'copy previous');
    if(!rows.length){msg('لا يوجد توزيع في الشهر السابق: '+pm,true); return;}
    const copy=rows.map(({id,created_at,updated_at,...r})=>({...r,month_key:m,start_date:m+'-01'}));
    const res=await client.from('monthly_distribution').upsert(copy,{onConflict:'month_key,project_id,worker_employee_code'}).select();
    if(res.error){msg('تعذر نسخ الشهر السابق: '+res.error.message,true); return;}
    delete state.distByMonth[m]; await loadDistribution(true); fillSelects(); renderDistribution(); msg('تم نسخ توزيع '+pm+' إلى '+m+'.');
  }
  async function deleteRow(id){
    const client=sb(); if(!client) return; if(!confirm('حذف هذا العامل من توزيع الشهر؟')) return;
    const r=await client.from('monthly_distribution').delete().eq('id',id);
    if(r.error){msg('تعذر الحذف: '+r.error.message,true);return;}
    delete state.distByMonth[month()]; await loadDistribution(true); fillSelects(); renderDistribution();
  }
  function renderDistribution(){
    const box=$('td404DistributionBox'); if(!box) return;
    let rows=state.distByMonth[month()]||[]; const q=norm($('td404Search')?.value||''), fs=$('td404FilterSupervisor')?.value||'', fp=$('td404FilterProject')?.value||'';
    rows=rows.filter(r=>(!fs||r.supervisor_name===fs)&&(!fp||r.project_name===fp)&&(!q||norm([r.supervisor_name,r.project_name,r.worker_employee_code,r.worker_name,r.role_type].join(' ')).includes(q)));
    const groups=new Map(); rows.forEach(r=>{const k=(r.supervisor_name||'-')+'||'+(r.project_name||'-'); if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(r);});
    box.innerHTML=[...groups.entries()].map(([k,list])=>{const [sup,project]=k.split('||'); return `<div class="td404-dist-card"><div class="td404-dist-head"><div><b>${esc(project)}</b><small>${esc(sup)}</small></div><span>${list.length} عامل</span></div><div class="td404-dist-workers">${list.map(r=>`<span>${esc((r.worker_employee_code||'')+' - '+(r.worker_name||''))}<button type="button" onclick="tasneefDistributionV404.deleteRow(${Number(r.id)})">×</button></span>`).join('')}</div></div>`}).join('') || '<div class="td404-empty">لا يوجد توزيع لهذا الشهر.</div>';
  }
  function print(){
    const rows=state.distByMonth[month()]||[]; const groups=new Map(); rows.forEach(r=>{const k=(r.supervisor_name||'-')+'||'+(r.project_name||'-'); if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(r);});
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>توزيع العمال ${month()}</title><style>body{font-family:Tahoma,Arial,sans-serif;direction:rtl;margin:20px;color:#061f18}.head{display:flex;justify-content:space-between;border-bottom:3px solid #0A4033;padding-bottom:12px;margin-bottom:14px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.card{border:2px solid #0A4033;border-radius:14px;padding:12px;break-inside:avoid}.card h3{margin:0 0 6px;text-align:center}.card small{display:block;text-align:center;color:#60706a}.pill{display:inline-block;background:#eef8f5;border:1px solid #cfe2dc;border-radius:999px;padding:5px 8px;margin:4px;font-weight:700}@page{size:A4 landscape;margin:10mm}</style></head><body><div class="head"><h1>توزيع العمال الشهري</h1><h2>${month()}</h2></div><div class="grid">${[...groups.entries()].map(([k,list])=>{const [sup,project]=k.split('||'); return `<div class="card"><h3>${esc(project)}</h3><small>${esc(sup)}</small>${list.map(r=>`<span class="pill">${esc((r.worker_employee_code||'')+' - '+(r.worker_name||''))}</span>`).join('')}</div>`}).join('')}</div><script>setTimeout(()=>print(),300)<\/script></body></html>`;
    const w=window.open('','_blank'); if(w){w.document.open(); w.document.write(html); w.document.close();}
  }
  async function reload(force){await Promise.all([loadEmployees(force),loadProjects(force)]); await loadDistribution(force); fillSelects(); renderDistribution(); msg('تم تحميل البيانات من السيرفر.');}
  async function init(){
    const m=$('td404Month'); if(m && !m.value) m.value=todayMonth();
    const styleId='td404Css'; if(!$(styleId)){const st=document.createElement('style'); st.id=styleId; st.textContent='.td404-worker-box{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;max-height:330px;overflow:auto;border:1px solid var(--line);border-radius:14px;padding:8px;background:#fbfdfc}.td404-worker{background:#fff;color:#10231d;border:1px solid #dce6e2;border-radius:12px;padding:9px;text-align:right}.td404-worker.on{background:#0A4033;color:#fff}.td404-worker small{display:block;opacity:.75;margin-top:3px}.td404-selected,.td404-distribution-box{min-height:46px;border:1px solid var(--line);border-radius:14px;padding:10px;background:#fbfdfc}.td404-chip{display:inline-block;background:#eef8f5;color:#0A4033;border:1px solid #cfe2dc;border-radius:999px;padding:6px 9px;margin:3px;font-weight:800}.td404-dist-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:12px;margin-bottom:10px}.td404-dist-head{display:flex;justify-content:space-between;align-items:center;gap:8px;border-bottom:1px solid #edf1ef;padding-bottom:8px;margin-bottom:8px}.td404-dist-head b{color:#0A4033}.td404-dist-head small{display:block;color:#60706a;margin-top:3px}.td404-dist-workers{display:flex;flex-wrap:wrap;gap:6px}.td404-dist-workers span{background:#eef8f5;border:1px solid #cfe2dc;border-radius:999px;padding:5px 8px;font-weight:700}.td404-dist-workers button{background:#b83232;color:#fff;border-radius:50%;width:20px;height:20px;padding:0;margin-right:5px}.td404-empty{text-align:center;color:#60706a;padding:16px}@media(max-width:760px){.td404-worker-box{grid-template-columns:1fr}}'; document.head.appendChild(st);}
    ['td404Month','td404Project'].forEach(id=>$(id)?.addEventListener('change',async()=>{await loadDistribution(true); fillSelects(); renderDistribution(); if(id==='td404Project') hydrateCurrentProjectSelection();}));
    $('td404Supervisor')?.addEventListener('change',()=>{});
    await reload(false);
  }
  window.tasneefDistributionV404={init,reload,renderWorkers,toggleWorker,clearSelection,saveProjectDistribution,copyPreviousMonth,deleteRow,renderDistribution,print};
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>{if($('distribution')) init();},900)});
})();

/* Tasneef v10149 - Monthly Times Excel Style Professional Foundation
   قسم الأوقات الشهرية فقط.
   المعادلة مثل Excel: نسبة المشروع = دقائق المشروع / إجمالي دقائق المشرف.
   لا يوجد حقن متكرر ولا MutationObserver ولا حذف لأي بيانات.
*/
(function(){
  'use strict';
  if(window.__tasneefMonthlyExcelStyleV10149) return;
  window.__tasneefMonthlyExcelStyleV10149 = true;

  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const MANUAL_TABLE='monthly_time_manual_adjustments';
  const LOCAL_MANUAL='tasneef_monthly_manual_rows_excel_v10149';
  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const E=v=>S(v).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const N=v=>{const n=Number(S(v).replace(/,/g,'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))); return Number.isFinite(n)?n:0;};
  const pad=n=>String(n).padStart(2,'0');
  const ymNow=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1);};
  const nextMonth=ym=>{const [y,m]=S(ym).split('-').map(Number);const d=new Date(y,(m||1),1);return d.getFullYear()+'-'+pad(d.getMonth()+1);};
  const fmt0=n=>(Math.round(Number(n)||0)).toLocaleString('en-US');
  const fmt2=n=>(Math.round((Number(n)||0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

  const state={month:'',users:[],projects:[],workers:[],logs:[],manual:[],groups:[],filtered:[],loading:false};

  function client(){
    if(window.sb && typeof window.sb.from==='function') return window.sb;
    if(window.supabase && typeof window.supabase.createClient==='function'){
      try{ window.sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY); return window.sb; }catch(_){ }
    }
    return null;
  }
  async function allPaged(table, cols='*', queryFn=null, max=150000){
    const sb=client(), out=[], step=1000; if(!sb) return out;
    for(let from=0; from<max; from+=step){
      try{
        let q=sb.from(table).select(cols).range(from, Math.min(from+step-1,max-1));
        if(queryFn) q=queryFn(q);
        const {data,error}=await q;
        if(error){ console.warn('[monthly v10149]',table,error.message||error); break; }
        out.push(...A(data));
        if(!data || data.length<step) break;
      }catch(e){ console.warn('[monthly v10149]',table,e.message||e); break; }
    }
    return out;
  }
  function anyVal(r,keys){ for(const k of keys){ if(r && r[k]!==undefined && r[k]!==null && S(r[k])!=='') return r[k]; } return ''; }
  function userLabel(u){return S(u?.full_name||u?.name||u?.display_name||u?.employee_name||u?.username||u?.email||u?.id);}
  function projectLabel(p){return S(p?.name||p?.project_name||p?.title||p?.project_title||p?.building_name||p?.display_name||p?.code||p?.id);}
  function workerLabel(w){return S(w?.full_name||w?.name||w?.worker_name||w?.employee_name||w?.username||w?.id);}
  function flex(rows,id,labelFn){
    const x=S(id); if(!x) return null; const xl=x.toLowerCase();
    return A(rows).find(v=>S(v.id)===x||S(v.uuid)===x||S(v.code)===x||S(v.value)===x||S(labelFn(v)).toLowerCase()===xl||S(v.username).toLowerCase()===xl||S(v.email).toLowerCase()===xl)||null;
  }
  function nameUser(id){const u=flex(state.users,id,userLabel); return u?userLabel(u):'';}
  function nameProject(id){const p=flex(state.projects,id,projectLabel); return p?projectLabel(p):'';}
  function nameWorker(id){const w=flex(state.workers,id,workerLabel); return w?workerLabel(w):'';}
  function rowMonth(v){
    const raw=S(v); if(!raw) return '';
    let m=raw.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/); if(m) return m[1]+'-'+pad(m[2]);
    m=raw.match(/^(\d{1,2})[-\/.](\d{1,2})[-\.\/](\d{4})/); if(m){ const a=N(m[1]), b=N(m[2]); return m[3]+'-'+pad(a>12?b:a); }
    const d=new Date(raw); if(!isNaN(d)) return d.getFullYear()+'-'+pad(d.getMonth()+1);
    return '';
  }
  function minutesFromTimes(a,b){
    const to=t=>{const m=S(t).match(/^(\d{1,2}):(\d{2})/); return m?N(m[1])*60+N(m[2]):null;};
    const x=to(a), y0=to(b); if(x==null||y0==null) return 0; let y=y0; if(y<x) y+=1440; return Math.max(0,y-x);
  }
  function minutesFromRow(r){
    const m=N(anyVal(r,['actual_minutes','duration_minutes','total_minutes','minutes','work_minutes','actual_min','duration_min']));
    if(m) return m;
    const h=N(anyVal(r,['actual_hours','duration_hours','total_hours','work_hours']));
    if(h) return h*60;
    const inT=anyVal(r,['check_in','time_in','log_in','in_time','start_time','logIn','وقت الدخول']);
    const outT=anyVal(r,['check_out','time_out','log_out','out_time','end_time','logOut','وقت الخروج']);
    return minutesFromTimes(inT,outT);
  }
  function travelFromRow(r){return N(anyVal(r,['travel_minutes','transition_minutes','lost_minutes','transfer_minutes','وقت الانتقال']));}
  function idVal(r,keys){return S(anyVal(r,keys));}
  function workerProjectId(w){return idVal(w,['project_id','assigned_project_id','current_project_id','building_id']);}
  function workerSupervisorId(w){return idVal(w,['supervisor_id','app_supervisor_id','assigned_supervisor_id','manager_id']);}
  function projectSupervisorId(p){return idVal(p,['supervisor_id','manager_id','user_id','owner_id']);}

  async function loadLookups(){
    const [users,projects,workers]=await Promise.all([
      allPaged('app_users','*',null,50000),
      allPaged('projects','*',null,50000),
      allPaged('workers','*',null,50000)
    ]);
    state.users=users; state.projects=projects; state.workers=workers;
  }
  async function loadLogs(ym){
    const start=ym+'-01', end=nextMonth(ym)+'-01';
    let rows=await allPaged('time_logs','*',q=>q.gte('log_date',start).lt('log_date',end).order('log_date',{ascending:true}),200000);
    if(!rows.length){
      const all=await allPaged('time_logs','*',null,200000);
      rows=all.filter(r=>rowMonth(anyVal(r,['log_date','date','day','work_date','created_at','start_at','check_in_at']))===ym);
    }
    return rows;
  }
  function workerNamesFor(supervisorId, projectId, existingNames){
    const set=new Set();
    S(existingNames).split(/[,،]/).map(x=>S(x)).filter(Boolean).forEach(x=>set.add(x));
    A(state.workers).forEach(w=>{
      const pn=projectId && workerProjectId(w) && S(workerProjectId(w))===S(projectId);
      const sn=supervisorId && workerSupervisorId(w) && S(workerSupervisorId(w))===S(supervisorId);
      if((pn || (!projectId && sn) || (pn&&sn)) && workerLabel(w)) set.add(workerLabel(w));
    });
    return [...set].slice(0,24);
  }
  function normalize(r){
    const workerId=idVal(r,['worker_id','workerId','employee_id','employeeId','worker','العامل']);
    const worker=flex(state.workers,workerId,workerLabel)||{};
    const projectId=idVal(r,['project_id','projectId','building_id','site_id']) || workerProjectId(worker);
    const project=flex(state.projects,projectId,projectLabel)||{};
    const supervisorId=idVal(r,['supervisor_id','supervisorId','user_id','userId','manager_id','created_by','created_by_id']) || workerSupervisorId(worker) || projectSupervisorId(project);
    const supervisorName=S(anyVal(r,['supervisor_name','supervisor','user_name','created_by_name','manager_name','المشرف'])) || nameUser(supervisorId) || 'غير محدد';
    const projectName=S(anyVal(r,['project_name','project_title','project','site_name','المشروع'])) || nameProject(projectId) || 'غير محدد';
    const wNames=S(anyVal(r,['worker_names','workers','workers_names','employee_names','worker_name','أسماء العمال'])) || nameWorker(workerId);
    return {supervisorId,projectId,supervisorName,projectName,workerNames:wNames,minutes:minutesFromRow(r),travel:travelFromRow(r),count:1,source:'سجلات النظام'};
  }
  function aggregate(logs, manual){
    const map=new Map();
    A(logs).forEach(row=>{
      const r=normalize(row);
      const key=(r.supervisorId||r.supervisorName)+'|'+(r.projectId||r.projectName);
      if(!map.has(key)) map.set(key,{supervisorId:r.supervisorId,projectId:r.projectId,supervisor:r.supervisorName,project:r.projectName,minutes:0,travel:0,count:0,workerSet:new Set(),source:'سجلات النظام',manual:false});
      const g=map.get(key); g.minutes+=N(r.minutes); g.travel+=N(r.travel); g.count+=1;
      S(r.workerNames).split(/[,،]/).map(x=>S(x)).filter(Boolean).forEach(x=>g.workerSet.add(x));
    });
    A(manual).forEach(m=>{
      const key='manual|'+m.id;
      map.set(key,{id:m.id,supervisor:m.supervisor,project:m.project,minutes:N(m.minutes),travel:N(m.travel),count:0,workerSet:new Set(S(m.workers).split(/[,،]/).map(x=>S(x)).filter(Boolean)),source:'تعديل يدوي',manual:true});
    });
    const rows=[...map.values()].map(g=>{
      const derived=workerNamesFor(g.supervisorId,g.projectId,[...g.workerSet].join('، '));
      g.workers=derived.join('، ');
      return g;
    });
    rows.sort((a,b)=>S(a.supervisor).localeCompare(S(b.supervisor),'ar')||S(a.project).localeCompare(S(b.project),'ar'));
    return rows;
  }
  async function loadManual(ym){
    const local=(()=>{try{return A(JSON.parse(localStorage.getItem(LOCAL_MANUAL)||'[]')).filter(r=>S(r.month)===ym)}catch(_){return []}})();
    const sb=client(); if(!sb) return local;
    try{
      const {data,error}=await sb.from(MANUAL_TABLE).select('*').eq('month_key',ym);
      if(error) throw error;
      const remote=A(data).map(r=>({id:r.id,month:r.month_key,supervisor:r.supervisor_name,project:r.project_name,workers:r.worker_names,minutes:N(r.actual_minutes||r.required_minutes),travel:N(r.travel_minutes)}));
      const by=new Map([...remote,...local].map(x=>[S(x.id),x]));
      return [...by.values()];
    }catch(e){return local;}
  }
  function status(t,cls='amber'){const el=$('mt49Status'); if(el){el.textContent=t; el.className='badge '+cls;}}
  function msg(t,err=false){const el=$('mt49Message'); if(el){el.textContent=t||''; el.className='msg '+(err?'err':''); el.classList.toggle('hidden',!t);}}
  function filterRows(){
    const s=S($('mt49Supervisor')?.value), p=S($('mt49Project')?.value);
    return state.groups.filter(r=>(!s||r.supervisor===s)&&(!p||r.project===p));
  }
  function fillFilters(){
    const oldS=S($('mt49Supervisor')?.value), oldP=S($('mt49Project')?.value);
    const sups=[...new Set(state.groups.map(r=>r.supervisor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    const prjs=[...new Set(state.groups.map(r=>r.project).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    if($('mt49Supervisor')) $('mt49Supervisor').innerHTML='<option value="">كل المشرفين</option>'+sups.map(x=>`<option value="${E(x)}" ${x===oldS?'selected':''}>${E(x)}</option>`).join('');
    if($('mt49Project')) $('mt49Project').innerHTML='<option value="">كل المشاريع</option>'+prjs.map(x=>`<option value="${E(x)}" ${x===oldP?'selected':''}>${E(x)}</option>`).join('');
    if($('mt49SupervisorList')) $('mt49SupervisorList').innerHTML=[...new Set([...sups,...state.users.map(userLabel).filter(Boolean)])].map(x=>`<option value="${E(x)}"></option>`).join('');
    if($('mt49ProjectList')) $('mt49ProjectList').innerHTML=[...new Set([...prjs,...state.projects.map(projectLabel).filter(Boolean)])].map(x=>`<option value="${E(x)}"></option>`).join('');
  }
  function perfPct(minutes,total){return total?Math.round((N(minutes)/N(total))*100):0;}
  function renderSummary(rows){
    const minutes=rows.reduce((s,r)=>s+N(r.minutes),0), travel=rows.reduce((s,r)=>s+N(r.travel),0), count=rows.reduce((s,r)=>s+N(r.count),0);
    const sups=new Set(rows.map(r=>r.supervisor).filter(Boolean)), prjs=new Set(rows.map(r=>r.project).filter(Boolean));
    if($('mt49Summary')) $('mt49Summary').innerHTML=`<div class="kpi"><small>إجمالي الوقت</small><b>${fmt2(minutes/60)} ساعة</b></div><div class="kpi"><small>عدد السجلات</small><b>${fmt0(count)}</b></div><div class="kpi"><small>المشرفين</small><b>${sups.size}</b></div><div class="kpi"><small>المشاريع</small><b>${prjs.size}</b></div><div class="kpi"><small>وقت الانتقال</small><b>${fmt2(travel/60)}</b></div>`;
  }
  function renderVisitCards(rows){
    const box=$('mt49VisitGrid'); if(!box) return;
    if(!rows.length){box.innerHTML='<div class="msg">لا توجد بيانات لهذا الشهر.</div>';return;}
    const bySup=new Map();
    rows.forEach(r=>{ if(!bySup.has(r.supervisor)) bySup.set(r.supervisor,[]); bySup.get(r.supervisor).push(r); });
    box.innerHTML=[...bySup.entries()].map(([sup,items])=>{
      const total=items.reduce((s,r)=>s+N(r.minutes),0);
      const projectRows=items.map(r=>`<tr><td>${E(r.project)}</td><td>${fmt0(r.minutes)}</td><td>${perfPct(r.minutes,total)}%</td></tr>`).join('');
      const allWorkers=[...new Set(items.flatMap(r=>S(r.workers).split(/[,،]/).map(x=>S(x)).filter(Boolean)))];
      const workersHtml=allWorkers.length?allWorkers.map(w=>`<span>${E(w)}</span>`).join(''):'<small>لا توجد أسماء عمال مرتبطة</small>';
      return `<div class="mt49-supervisor-card"><h3>${E(sup)}</h3><table><tbody>${projectRows}<tr class="total"><td>الإجمالي</td><td>${fmt0(total)}</td><td>${total?100:0}%</td></tr></tbody></table><div class="mt49-workers-title">أسماء العمال</div><div class="mt49-worker-names">${workersHtml}</div></div>`;
    }).join('');
  }
  function renderWorkersGrid(rows){
    const box=$('mt49WorkersGrid'); if(!box) return;
    const projects=new Map();
    rows.forEach(r=>{ if(!projects.has(r.project)) projects.set(r.project,new Set()); S(r.workers).split(/[,،]/).map(x=>S(x)).filter(Boolean).forEach(w=>projects.get(r.project).add(w)); });
    if(!projects.size){ box.innerHTML='<div class="msg">لا توجد أسماء عمال مرتبطة بالسجلات.</div>'; return; }
    box.innerHTML=[...projects.entries()].map(([project,set])=>`<div class="mt49-project-workers"><h3>${E(project)}</h3><div>${[...set].map(w=>`<span>${E(w)}</span>`).join('')||'<small>لا توجد أسماء</small>'}</div></div>`).join('');
  }
  function renderTable(rows){
    const body=$('mt49Body'); if(!body) return;
    if(!rows.length){body.innerHTML='<tr><td colspan="10">لا توجد بيانات.</td></tr>';return;}
    const totalsBySup={}; rows.forEach(r=>{totalsBySup[r.supervisor]=(totalsBySup[r.supervisor]||0)+N(r.minutes);});
    body.innerHTML=rows.map(r=>{const pct=perfPct(r.minutes,totalsBySup[r.supervisor]);return `<tr><td>${E(r.supervisor)}</td><td>${E(r.project)}</td><td>${E(r.workers||'-')}</td><td>${N(r.count)}</td><td>${fmt0(r.minutes)}</td><td>${fmt2(N(r.minutes)/60)}</td><td>${fmt0(r.travel)}</td><td>${pct}%</td><td>${E(r.source)}</td><td>${r.manual?`<button class="light" onclick="TasneefMonthlyV10149.edit('${E(r.id)}')">تعديل</button> <button class="danger" onclick="TasneefMonthlyV10149.remove('${E(r.id)}')">حذف</button>`:'-'}</td></tr>`;}).join('');
  }
  function render(){
    state.filtered=filterRows(); renderSummary(state.filtered); renderVisitCards(state.filtered); renderWorkersGrid(state.filtered); renderTable(state.filtered);
    status('تم تحميل '+state.logs.length+' سجل','green');
  }
  async function load(){
    if(state.loading) return; state.loading=true;
    const ym=S($('mt49Month')?.value)||ymNow(); state.month=ym; if($('mt49Month')) $('mt49Month').value=ym;
    status('جاري التحميل...','amber'); msg('');
    try{
      await loadLookups();
      const [logs,manual]=await Promise.all([loadLogs(ym),loadManual(ym)]);
      state.logs=logs; state.manual=manual; state.groups=aggregate(logs,manual);
      fillFilters(); render();
      msg(`تم تحميل ${logs.length} سجل من Supabase لشهر ${ym}. النسبة محسوبة مثل Excel: دقائق المشروع ÷ إجمالي دقائق المشرف.`);
    }catch(e){console.error(e); status('خطأ','red'); msg('تعذر تحميل الأوقات الشهرية: '+(e.message||e),true);}
    finally{state.loading=false;}
  }
  function clearManual(){['mt49ManualId','mt49ManualSupervisor','mt49ManualProject','mt49ManualWorkers','mt49ManualMinutes','mt49ManualTravel'].forEach(id=>{if($(id))$(id).value='';});}
  async function saveManual(){
    const r={id:S($('mt49ManualId')?.value)||('m-'+Date.now()),month:S($('mt49Month')?.value)||ymNow(),supervisor:S($('mt49ManualSupervisor')?.value),project:S($('mt49ManualProject')?.value),workers:S($('mt49ManualWorkers')?.value),minutes:N($('mt49ManualMinutes')?.value),travel:N($('mt49ManualTravel')?.value)};
    if(!r.supervisor||!r.project){alert('اكتب اسم المشرف واسم المشروع');return;}
    const arr=(()=>{try{return A(JSON.parse(localStorage.getItem(LOCAL_MANUAL)||'[]'))}catch(_){return []}})();
    const idx=arr.findIndex(x=>S(x.id)===S(r.id)); if(idx>=0) arr[idx]=r; else arr.push(r); localStorage.setItem(LOCAL_MANUAL,JSON.stringify(arr));
    const sb=client(); if(sb){try{await sb.from(MANUAL_TABLE).upsert({id:r.id,month_key:r.month,supervisor_name:r.supervisor,project_name:r.project,worker_names:r.workers,actual_minutes:r.minutes,required_minutes:r.minutes,travel_minutes:r.travel,updated_at:new Date().toISOString()},{onConflict:'id'});}catch(e){console.warn(e);}}
    clearManual(); await load();
  }
  function editManual(id){const r=state.groups.find(x=>S(x.id)===S(id)); if(!r)return; $('mt49ManualId').value=r.id; $('mt49ManualSupervisor').value=r.supervisor; $('mt49ManualProject').value=r.project; $('mt49ManualWorkers').value=r.workers||''; $('mt49ManualMinutes').value=N(r.minutes)||''; $('mt49ManualTravel').value=N(r.travel)||'';}
  async function removeManual(id){if(!confirm('حذف هذا التعديل اليدوي؟'))return; const arr=(()=>{try{return A(JSON.parse(localStorage.getItem(LOCAL_MANUAL)||'[]'))}catch(_){return []}})().filter(x=>S(x.id)!==S(id)); localStorage.setItem(LOCAL_MANUAL,JSON.stringify(arr)); const sb=client(); if(sb) try{await sb.from(MANUAL_TABLE).delete().eq('id',id);}catch(_){ } await load();}
  function csv(){
    const rows=state.filtered||[]; const totals={}; rows.forEach(r=>totals[r.supervisor]=(totals[r.supervisor]||0)+N(r.minutes));
    const headers=['المشرف','المشروع','أسماء العمال','عدد السجلات','الدقائق','الساعات','وقت الانتقال','النسبة','المصدر'];
    const lines=[headers.join(',')].concat(rows.map(r=>[r.supervisor,r.project,r.workers||'',r.count,fmt0(r.minutes),fmt2(N(r.minutes)/60),fmt0(r.travel),perfPct(r.minutes,totals[r.supervisor])+'%',r.source].map(x=>'"'+S(x).replace(/"/g,'""')+'"').join(',')));
    const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='monthly-times-excel-style-'+(state.month||ymNow())+'.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  function printReport(){
    const rows=state.filtered||[], bySup=new Map(); rows.forEach(r=>{ if(!bySup.has(r.supervisor)) bySup.set(r.supervisor,[]); bySup.get(r.supervisor).push(r); });
    const cards=[...bySup.entries()].map(([sup,items])=>{const total=items.reduce((s,r)=>s+N(r.minutes),0); return `<div class="card"><h2>${E(sup)}</h2><table><tbody>${items.map(r=>`<tr><td>${E(r.project)}</td><td>${fmt0(r.minutes)}</td><td>${perfPct(r.minutes,total)}%</td></tr>`).join('')}<tr class="total"><td>الإجمالي</td><td>${fmt0(total)}</td><td>${total?100:0}%</td></tr></tbody></table><h3>أسماء العمال</h3><p>${E([...new Set(items.flatMap(r=>S(r.workers).split(/[,،]/).map(x=>S(x)).filter(Boolean)))].join('، ')||'-')}</p></div>`;}).join('');
    const w=window.open('','_blank','width=1200,height=850'); if(!w){csv();return;}
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>الأوقات الشهرية</title><style>body{font-family:Tahoma,Arial;margin:24px;color:#111}h1{text-align:center}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.card{border:2px solid #111;padding:10px;min-height:220px}h2{text-align:center;margin:0 0 8px}table{width:100%;border-collapse:collapse}td{padding:4px;text-align:center}.total{font-weight:bold;border-top:1px solid #111}p{line-height:1.8;text-align:center}@media print{.grid{grid-template-columns:repeat(4,1fr)}}</style></head><body><h1>تقرير الأوقات الشهرية - ${E(state.month)}</h1><div class="grid">${cards}</div><script>setTimeout(()=>print(),300)<\/script></body></html>`); w.document.close();
  }
  function bind(){
    if(!$('mt49Body')) return;
    if($('mt49Month')&&!$('mt49Month').value) $('mt49Month').value=ymNow();
    $('mt49Month')?.addEventListener('change',load);
    $('mt49Supervisor')?.addEventListener('change',render);
    $('mt49Project')?.addEventListener('change',render);
    $('mt49Refresh')?.addEventListener('click',load);
    $('mt49Print')?.addEventListener('click',printReport);
    $('mt49Csv')?.addEventListener('click',csv);
    $('mt49ManualSave')?.addEventListener('click',saveManual);
    $('mt49ManualClear')?.addEventListener('click',clearManual);
    load();
  }
  window.TasneefMonthlyV10149={reload:load,edit:editManual,remove:removeManual,print:printReport,csv};
  window.renderMonthly=load; window.exportMonthlyCSV=csv; window.printMonthlyReportV57=printReport;
  document.addEventListener('DOMContentLoaded',bind,{once:true}); window.addEventListener('load',()=>setTimeout(bind,250),{once:true});
})();

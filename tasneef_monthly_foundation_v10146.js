/* Tasneef v10146 - Monthly Time Logs Exact Source
   قسم الأوقات الشهرية فقط: يعتمد على جدول time_logs للشهر المختار ويجلب كل الصفوف بالترقيم.
   الهدف: العدد في الملخص = نفس count(*) من Supabase للشهر، مع دعم الشهور السابقة.
*/
(function(){
  'use strict';
  if(window.__tasneefMonthlyFoundationV10146) return;
  window.__tasneefMonthlyFoundationV10146 = true;

  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const MANUAL_TABLE='monthly_time_manual_adjustments';
  const LOCAL_MANUAL='tasneef_monthly_manual_rows_foundation_v10146';
  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const E=v=>S(v).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const N=v=>{const n=Number(S(v).replace(/,/g,'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)));return Number.isFinite(n)?n:0};
  const pad=n=>String(n).padStart(2,'0');
  const ymNow=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)};
  const nextMonth=ym=>{const [y,m]=S(ym).split('-').map(Number); const d=new Date(y,(m||1),1); return d.getFullYear()+'-'+pad(d.getMonth()+1)};
  const fmt=(n,d=2)=>(Math.round((Number(n)||0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
  const state={month:'',users:[],projects:[],workers:[],rawLogs:[],manual:[],rows:[],filtered:[],loading:false};

  function client(){
    if(window.sb && typeof window.sb.from==='function') return window.sb;
    if(window.supabase && typeof window.supabase.createClient==='function'){
      try{ window.sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY); return window.sb; }catch(_){ }
    }
    return null;
  }
  async function allPaged(table, cols='*', queryFn=null, max=100000){
    const sb=client(), out=[], step=1000; if(!sb) return out;
    for(let from=0; from<max; from+=step){
      try{
        let q=sb.from(table).select(cols).range(from, Math.min(from+step-1,max-1));
        if(queryFn) q=queryFn(q);
        const {data,error}=await q;
        if(error){ console.warn('[monthly v10146]',table,error.message||error); break; }
        out.push(...A(data));
        if(!data || data.length<step) break;
      }catch(e){ console.warn('[monthly v10146]',table,e.message||e); break; }
    }
    return out;
  }
  function anyVal(r,keys){ for(const k of keys){ if(r && r[k]!==undefined && r[k]!==null && S(r[k])!=='') return r[k]; } return ''; }
  function label(row,keys){ return anyVal(row,keys); }
  function userLabel(u){ return S(u?.full_name||u?.name||u?.display_name||u?.employee_name||u?.username||u?.email||u?.id); }
  function projectLabel(p){ return S(p?.name||p?.project_name||p?.title||p?.project_title||p?.building_name||p?.display_name||p?.code||p?.id); }
  function workerLabel(w){ return S(w?.full_name||w?.name||w?.worker_name||w?.employee_name||w?.username||w?.id); }
  function flex(rows,id,labelFn){
    const x=S(id); if(!x) return null; const xl=x.toLowerCase();
    return A(rows).find(v=>S(v.id)===x||S(v.uuid)===x||S(v.code)===x||S(v.value)===x||S(labelFn(v)).toLowerCase()===xl||S(v.username).toLowerCase()===xl||S(v.email).toLowerCase()===xl)||null;
  }
  function nameUser(id){ const u=flex(state.users,id,userLabel); return u?userLabel(u):''; }
  function nameProject(id){ const p=flex(state.projects,id,projectLabel); return p?projectLabel(p):''; }
  function nameWorker(id){ const w=flex(state.workers,id,workerLabel); return w?workerLabel(w):''; }
  function workerById(id){ return flex(state.workers,id,workerLabel)||{}; }
  function projectById(id){ return flex(state.projects,id,projectLabel)||{}; }
  function minutesFromTime(a,b){
    const to=t=>{ const m=S(t).match(/^(\d{1,2}):(\d{2})/); return m?N(m[1])*60+N(m[2]):null; };
    const x=to(a), y0=to(b); if(x==null||y0==null) return 0; let y=y0; if(y<x) y+=1440; return Math.max(0,y-x);
  }
  function parseDateToYm(v){
    const raw=S(v); if(!raw) return '';
    let m=raw.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/); if(m) return m[1]+'-'+pad(m[2]);
    m=raw.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})/); if(m){ const a=N(m[1]), b=N(m[2]); return m[3]+'-'+pad(a>12?b:a); }
    const d=new Date(raw); if(!isNaN(d)) return d.getFullYear()+'-'+pad(d.getMonth()+1);
    return '';
  }
  function rowMonth(r){ return parseDateToYm(anyVal(r,['log_date','date','day','work_date','created_at','updated_at','start_at','check_in_at','check_out_at','التاريخ','تاريخ'])); }

  async function loadLookups(){
    const [u,p,w]=await Promise.all([
      allPaged('app_users','*',null,50000),
      allPaged('projects','*',null,50000),
      allPaged('workers','*',null,50000)
    ]);
    state.users=u; state.projects=p; state.workers=w;
  }
  async function loadTimeLogs(ym){
    const start=ym+'-01', end=nextMonth(ym)+'-01';
    let rows=await allPaged('time_logs','*',q=>q.gte('log_date',start).lt('log_date',end).order('log_date',{ascending:true}),150000);
    // fallback في حال كان log_date محفوظ نصيًّا أو الصيغة غير قياسية
    if(!rows.length){
      const all=await allPaged('time_logs','*',null,150000);
      rows=all.filter(r=>rowMonth(r)===ym);
    }
    return rows;
  }
  async function loadManual(ym){
    const local=(()=>{try{return A(JSON.parse(localStorage.getItem(LOCAL_MANUAL)||'[]')).filter(r=>S(r.month)===ym)}catch(_){return []}})();
    const sb=client(); if(!sb) return local;
    try{
      const {data,error}=await sb.from(MANUAL_TABLE).select('*').eq('month_key',ym);
      if(error) throw error;
      return [...local,...A(data).map(r=>({id:r.id,month:r.month_key,supervisor:r.supervisor_name,project:r.project_name,workers:r.worker_names,requiredMin:N(r.required_minutes),actualMin:N(r.actual_minutes),travelMin:N(r.travel_minutes),percent:r.percent_override==null?'':N(r.percent_override),source:'تعديل يدوي',count:0}))];
    }catch(e){ console.warn('[monthly manual]',e.message||e); return local; }
  }
  function normalize(row){
    const workerId=anyVal(row,['worker_id','workerId','employee_id','employeeId','العامل']);
    const w=workerById(workerId);
    const projectId=anyVal(row,['project_id','projectId','building_id']) || anyVal(w,['project_id','assigned_project_id','current_project_id']);
    const p=projectById(projectId);
    const supervisorId=anyVal(row,['supervisor_id','supervisorId','user_id','userId','manager_id','created_by']) || anyVal(w,['supervisor_id','app_supervisor_id','manager_id']) || anyVal(p,['supervisor_id','manager_id']);
    const supervisor=label(row,['supervisor_name','supervisor','user_name','created_by_name','المشرف']) || nameUser(supervisorId) || (supervisorId?('ID '+supervisorId):'غير محدد');
    const project=label(row,['project_name','project_title','project','المشروع']) || nameProject(projectId) || (projectId?('ID '+projectId):'غير محدد');
    const workers=label(row,['workers','worker_names','workers_names','employee_names','أسماء العمال']) || nameWorker(workerId) || '';
    const req=N(anyVal(row,['required_minutes','required_min','target_minutes','scheduled_minutes','required']));
    const reqH=N(anyVal(row,['required_hours','target_hours','scheduled_hours']));
    const actual=N(anyVal(row,['actual_minutes','duration_minutes','total_minutes','minutes','work_minutes','actual_min']));
    const actualH=N(anyVal(row,['actual_hours','duration_hours','total_hours','work_hours']));
    const travel=N(anyVal(row,['travel_minutes','transition_minutes','lost_minutes','وقت الانتقال']));
    const inT=anyVal(row,['check_in','time_in','log_in','in_time','start_time','logIn','وقت الدخول']);
    const outT=anyVal(row,['check_out','time_out','log_out','out_time','end_time','logOut','وقت الخروج']);
    const actualMin=actual || (actualH?actualH*60:0) || minutesFromTime(inT,outT);
    const requiredMin=req || (reqH?reqH*60:0);
    return {supervisor,project,workers,count:1,requiredMin,actualMin,travelMin:travel,source:'time_logs',projectKey:S(projectId)||project,supervisorKey:S(supervisorId)||supervisor};
  }
  function aggregate(logs, manual){
    const map=new Map();
    A(logs).forEach(row=>{
      const r=normalize(row);
      const key=r.supervisor+'|'+r.project;
      if(!map.has(key)) map.set(key,{...r,count:0,requiredMin:0,actualMin:0,travelMin:0,workers:'',rawProjectKeys:new Set(),rawSupervisorKeys:new Set()});
      const g=map.get(key); g.count += 1; g.requiredMin += N(r.requiredMin); g.actualMin += N(r.actualMin); g.travelMin += N(r.travelMin);
      if(r.workers && !S(g.workers).includes(r.workers)) g.workers = g.workers ? g.workers+', '+r.workers : r.workers;
      if(r.projectKey && r.projectKey!=='غير محدد') g.rawProjectKeys.add(r.projectKey);
      if(r.supervisorKey && r.supervisorKey!=='غير محدد') g.rawSupervisorKeys.add(r.supervisorKey);
    });
    A(manual).forEach(r=>map.set('manual:'+r.id,{...r,source:'تعديل يدوي',rawProjectKeys:new Set(),rawSupervisorKeys:new Set()}));
    return [...map.values()].sort((a,b)=>S(a.supervisor).localeCompare(S(b.supervisor),'ar')||S(a.project).localeCompare(S(b.project),'ar'));
  }
  function perf(r){
    const pct=r.percent!==''&&r.percent!=null?Math.round(N(r.percent)):(N(r.requiredMin)?Math.round(N(r.actualMin)/N(r.requiredMin)*100):(N(r.actualMin)?100:0));
    if(pct>=95) return {pct,label:'ممتاز',cls:'green'};
    if(pct>=80) return {pct,label:'جيد',cls:'amber'};
    return {pct,label:'ضعيف',cls:'red'};
  }
  function status(t,c='amber'){ const el=$('mtStatusV10146'); if(el){el.textContent=t; el.className='badge '+c;} }
  function msg(t,err=false){ const el=$('mtMessageV10146'); if(el){el.textContent=t||''; el.className='msg '+(err?'err':''); el.classList.toggle('hidden',!t);} }
  function fillFilters(){
    const cs=S($('mtSupervisorV10146')?.value), cp=S($('mtProjectV10146')?.value);
    const sups=[...new Set(state.rows.map(r=>r.supervisor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    const prjs=[...new Set(state.rows.map(r=>r.project).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    if($('mtSupervisorV10146')) $('mtSupervisorV10146').innerHTML='<option value="">كل المشرفين</option>'+sups.map(x=>`<option value="${E(x)}" ${x===cs?'selected':''}>${E(x)}</option>`).join('');
    if($('mtProjectV10146')) $('mtProjectV10146').innerHTML='<option value="">كل المشاريع</option>'+prjs.map(x=>`<option value="${E(x)}" ${x===cp?'selected':''}>${E(x)}</option>`).join('');
    if($('mtSupervisorListV10146')) $('mtSupervisorListV10146').innerHTML=[...new Set([...sups,...state.users.map(userLabel).filter(Boolean)])].map(x=>`<option value="${E(x)}"></option>`).join('');
    if($('mtProjectListV10146')) $('mtProjectListV10146').innerHTML=[...new Set([...prjs,...state.projects.map(projectLabel).filter(Boolean)])].map(x=>`<option value="${E(x)}"></option>`).join('');
  }
  function filtered(){ const s=S($('mtSupervisorV10146')?.value), p=S($('mtProjectV10146')?.value); return state.rows.filter(r=>(!s||r.supervisor===s)&&(!p||r.project===p)); }
  function renderSummary(rows){
    const actual=rows.reduce((s,r)=>s+N(r.actualMin),0), req=rows.reduce((s,r)=>s+N(r.requiredMin),0), travel=rows.reduce((s,r)=>s+N(r.travelMin),0), rec=rows.reduce((s,r)=>s+N(r.count),0);
    const projects=new Set(), sups=new Set();
    rows.forEach(r=>{ if(S(r.source)!=='تعديل يدوي'){ A([...r.rawProjectKeys||[]]).forEach(x=>projects.add(x)); A([...r.rawSupervisorKeys||[]]).forEach(x=>sups.add(x)); } });
    if($('mtSummaryV10146')) $('mtSummaryV10146').innerHTML=`<div class="kpi"><small>إجمالي الوقت</small><b>${fmt(actual/60,2)} ساعة</b></div><div class="kpi"><small>الساعات المطلوبة</small><b>${fmt(req/60,2)}</b></div><div class="kpi"><small>وقت الانتقال</small><b>${fmt(travel/60,2)}</b></div><div class="kpi"><small>المشرفين</small><b>${sups.size || new Set(rows.map(r=>r.supervisor).filter(x=>x&&x!=='غير محدد')).size}</b></div><div class="kpi"><small>المشاريع</small><b>${projects.size || new Set(rows.map(r=>r.project).filter(x=>x&&x!=='غير محدد')).size}</b></div><div class="kpi"><small>عدد السجلات</small><b>${rec}</b></div>`;
  }
  function renderTable(rows){
    const b=$('mtBodyV10146'); if(!b) return;
    if(!rows.length){ b.innerHTML='<tr><td colspan="11">لا توجد بيانات للشهر المختار.</td></tr>'; return; }
    b.innerHTML=rows.map(r=>{ const p=perf(r); return `<tr><td>${E(r.supervisor)}</td><td>${E(r.project)}</td><td>${E(r.workers||'-')}</td><td>${N(r.count)}</td><td>${fmt(N(r.requiredMin)/60,2)}</td><td>${fmt(N(r.actualMin)/60,2)}</td><td>${fmt(N(r.travelMin)/60,2)}</td><td>${p.pct}%</td><td><span class="badge ${p.cls}">${p.label}</span></td><td>${E(r.source)}</td><td>${r.source==='تعديل يدوي'?`<button class="light" onclick="TasneefMonthlyV10146.edit('${E(r.id)}')">تعديل</button> <button class="danger" onclick="TasneefMonthlyV10146.remove('${E(r.id)}')">حذف</button>`:'-'}</td></tr>`; }).join('');
  }
  function render(){ state.filtered=filtered(); renderSummary(state.filtered); renderTable(state.filtered); status('تم تحميل '+state.rawLogs.length+' سجل خام و '+state.filtered.length+' صف','green'); }
  async function load(){
    if(state.loading) return; state.loading=true; const ym=S($('mtMonthV10146')?.value)||ymNow(); state.month=ym; if($('mtMonthV10146')) $('mtMonthV10146').value=ym;
    status('جاري تحميل كل سجلات time_logs...','amber'); msg('');
    try{
      await loadLookups();
      const [logs,manual]=await Promise.all([loadTimeLogs(ym),loadManual(ym)]);
      state.rawLogs=logs; state.manual=manual; state.rows=aggregate(logs,manual);
      fillFilters(); render();
      msg(`تم تحميل ${logs.length} سجل من time_logs لشهر ${ym}. الرقم يجب أن يطابق استعلام count(*) في Supabase. التعديلات اليدوية: ${manual.length}.`);
    }catch(e){ console.error(e); status('خطأ','red'); msg('تعذر تحميل الأوقات الشهرية: '+(e.message||e),true); }
    finally{ state.loading=false; }
  }
  function clear(){ ['mtManualIdV10146','mtManualSupervisorV10146','mtManualProjectV10146','mtManualWorkersV10146','mtManualRequiredV10146','mtManualActualV10146','mtManualTravelV10146','mtManualPercentV10146'].forEach(id=>{if($(id))$(id).value='';}); }
  async function upsertManual(r){
    r.id=r.id||('m-'+Date.now()); r.month=r.month||state.month||ymNow();
    const arr=(()=>{try{return A(JSON.parse(localStorage.getItem(LOCAL_MANUAL)||'[]'))}catch(_){return []}})();
    const idx=arr.findIndex(x=>S(x.id)===S(r.id)); if(idx>=0) arr[idx]=r; else arr.push(r); localStorage.setItem(LOCAL_MANUAL,JSON.stringify(arr));
    const sb=client(); if(!sb) return;
    await sb.from(MANUAL_TABLE).upsert({id:r.id,month_key:r.month,supervisor_name:r.supervisor,project_name:r.project,worker_names:r.workers||'',required_minutes:N(r.requiredMin),actual_minutes:N(r.actualMin),travel_minutes:N(r.travelMin),percent_override:r.percent===''?null:N(r.percent),updated_at:new Date().toISOString()},{onConflict:'id'});
  }
  async function removeManual(id){
    const arr=(()=>{try{return A(JSON.parse(localStorage.getItem(LOCAL_MANUAL)||'[]'))}catch(_){return []}})().filter(x=>S(x.id)!==S(id)); localStorage.setItem(LOCAL_MANUAL,JSON.stringify(arr));
    const sb=client(); if(sb) try{ await sb.from(MANUAL_TABLE).delete().eq('id',id); }catch(_){ }
  }
  async function save(){
    const r={id:S($('mtManualIdV10146')?.value),month:S($('mtMonthV10146')?.value)||ymNow(),supervisor:S($('mtManualSupervisorV10146')?.value),project:S($('mtManualProjectV10146')?.value),workers:S($('mtManualWorkersV10146')?.value),count:0,requiredMin:N($('mtManualRequiredV10146')?.value),actualMin:N($('mtManualActualV10146')?.value),travelMin:N($('mtManualTravelV10146')?.value),percent:S($('mtManualPercentV10146')?.value)===''?'':N($('mtManualPercentV10146')?.value),source:'تعديل يدوي'};
    if(!r.supervisor||!r.project){ alert('اكتب اسم المشرف واسم المشروع'); return; }
    await upsertManual(r); clear(); await load();
  }
  function edit(id){ const r=state.rows.find(x=>S(x.id)===S(id)); if(!r) return; $('mtManualIdV10146').value=r.id; $('mtManualSupervisorV10146').value=r.supervisor; $('mtManualProjectV10146').value=r.project; $('mtManualWorkersV10146').value=r.workers||''; $('mtManualRequiredV10146').value=N(r.requiredMin)||''; $('mtManualActualV10146').value=N(r.actualMin)||''; $('mtManualTravelV10146').value=N(r.travelMin)||''; $('mtManualPercentV10146').value=r.percent===''?'':N(r.percent); }
  async function remove(id){ if(!confirm('حذف هذا التعديل اليدوي؟')) return; await removeManual(id); await load(); }
  function csv(){
    const rows=state.filtered||[]; const headers=['المشرف','المشروع','أسماء العمال','عدد السجلات','الساعات المطلوبة','الساعات الفعلية','وقت الانتقال','نسبة العمل','حالة الأداء','المصدر'];
    const lines=[headers.join(',')].concat(rows.map(r=>{ const p=perf(r); return [r.supervisor,r.project,r.workers||'',N(r.count),fmt(N(r.requiredMin)/60,2),fmt(N(r.actualMin)/60,2),fmt(N(r.travelMin)/60,2),p.pct+'%',p.label,r.source].map(x=>'"'+S(x).replace(/"/g,'""')+'"').join(','); }));
    const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='monthly-times-'+(state.month||ymNow())+'.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  function print(){
    const rows=state.filtered||[];
    const w=window.open('','_blank','width=1100,height=800'); if(!w){ csv(); return; }
    const body=rows.map(r=>{const p=perf(r);return `<tr><td>${E(r.supervisor)}</td><td>${E(r.project)}</td><td>${E(r.workers||'-')}</td><td>${N(r.count)}</td><td>${fmt(N(r.requiredMin)/60,2)}</td><td>${fmt(N(r.actualMin)/60,2)}</td><td>${fmt(N(r.travelMin)/60,2)}</td><td>${p.pct}%</td><td>${p.label}</td></tr>`}).join('');
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية</title><style>body{font-family:Tahoma,Arial;margin:24px;color:#10231d}h1{color:#0A4033}table{width:100%;border-collapse:collapse}th,td{border:1px solid #dce6e2;padding:8px;text-align:right}th{background:#eef6f3}</style></head><body><h1>تقرير الأوقات الشهرية - ${E(state.month)}</h1><p>عدد السجلات الخام: ${state.rawLogs.length}</p><table><thead><tr><th>المشرف</th><th>المشروع</th><th>أسماء العمال</th><th>عدد السجلات</th><th>المطلوبة</th><th>الفعلية</th><th>الانتقال</th><th>النسبة</th><th>الحالة</th></tr></thead><tbody>${body||'<tr><td colspan="9">لا توجد بيانات</td></tr>'}</tbody></table><script>setTimeout(()=>print(),300)<\/script></body></html>`); w.document.close();
  }
  function bind(){
    if(!$('mtBodyV10146')) return;
    if($('mtMonthV10146')&&!$('mtMonthV10146').value) $('mtMonthV10146').value=ymNow();
    $('mtMonthV10146')?.addEventListener('change',load);
    $('mtSupervisorV10146')?.addEventListener('change',render);
    $('mtProjectV10146')?.addEventListener('change',render);
    $('mtRefreshV10146')?.addEventListener('click',load);
    $('mtCsvV10146')?.addEventListener('click',csv);
    $('mtPrintV10146')?.addEventListener('click',print);
    $('mtManualSaveV10146')?.addEventListener('click',save);
    $('mtManualClearV10146')?.addEventListener('click',clear);
    load();
  }
  window.TasneefMonthlyV10146={reload:load,edit,remove,csv,print};
  window.renderMonthly=load; window.exportMonthlyCSV=csv; window.printMonthlyReportV57=print;
  document.addEventListener('DOMContentLoaded',bind,{once:true}); window.addEventListener('load',()=>setTimeout(bind,300),{once:true});
})();

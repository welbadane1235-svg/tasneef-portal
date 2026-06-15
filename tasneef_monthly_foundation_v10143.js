/* Tasneef v10143 - Monthly Times Foundation Fix
   تأسيس صحيح لقسم الأوقات الشهرية بدون حقن وبدون مراقبة مستمرة.
   يقرأ كل سجلات الدخول والخروج من Supabase ثم يفلتر الشهر داخل المتصفح حتى لا تضيع سجلات الشهور القديمة أو التواريخ بصيغ مختلفة.
*/
(function(){
  'use strict';
  if(window.__tasneefMonthlyFoundationV10143) return;
  window.__tasneefMonthlyFoundationV10143 = true;

  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const MANUAL_TABLE='monthly_time_manual_adjustments';
  const LOCAL_MANUAL='tasneef_monthly_manual_rows_foundation_v10143';
  const MAX_ROWS=50000;

  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const E=v=>S(v).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const N=v=>{const n=Number(S(v).replace(/,/g,'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))); return Number.isFinite(n)?n:0;};
  const pad=n=>String(n).padStart(2,'0');
  const ymNow=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)};
  const monthTitle=ym=>(S(ym).slice(5,7)||'--')+'-'+(S(ym).slice(0,4)||'----');
  const fmt=(n,d=2)=>(Math.round((Number(n)||0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});

  const state={month:'',users:[],projects:[],workers:[],usersById:{},projectsById:{},workersById:{},rawLogs:[],manual:[],rows:[],filtered:[],loading:false,token:0};

  function client(){
    if(window.sb && typeof window.sb.from==='function') return window.sb;
    if(window.supabase && typeof window.supabase.createClient==='function'){
      try{ window.sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY); return window.sb; }catch(_){ }
    }
    return null;
  }
  async function allRows(table, cols='*', max=MAX_ROWS){
    const sb=client(); const out=[]; const step=1000;
    if(!sb) return out;
    for(let from=0; from<max; from+=step){
      try{
        const {data,error}=await sb.from(table).select(cols).range(from, Math.min(from+step-1,max-1));
        if(error){ console.warn('[monthly] table read failed:',table,error.message||error); break; }
        out.push(...A(data));
        if(!data || data.length<step) break;
      }catch(e){ console.warn('[monthly] table read failed:',table,e.message||e); break; }
    }
    return out;
  }
  function byId(rows){const m={};A(rows).forEach(r=>{if(r&&r.id!=null)m[String(r.id)]=r});return m;}
  async function loadLookups(){
    // v10143: نستخدم select(*) بدل أعمدة محددة لأن اختلاف أسماء الأعمدة في Supabase كان يجعل قراءة المشاريع/المشرفين تفشل بالكامل.
    const [users,projects,workers]=await Promise.all([
      allRows('app_users','*',20000),
      allRows('projects','*',20000),
      allRows('workers','*',20000)
    ]);
    state.users=users; state.projects=projects; state.workers=workers;
    state.usersById=byId(users); state.projectsById=byId(projects); state.workersById=byId(workers);
  }

  function parseDates(v){
    const raw=S(v); if(!raw) return [];
    const out=[]; const add=(y,m,d)=>{y=N(y);m=N(m);d=N(d); if(y>1900&&m>=1&&m<=12&&d>=1&&d<=31) out.push(y+'-'+pad(m)+'-'+pad(d));};
    let m=raw.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/); if(m) add(m[1],m[2],m[3]);
    m=raw.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})/); if(m){
      const a=N(m[1]),b=N(m[2]);
      if(a>12) add(m[3],b,a); else if(b>12) add(m[3],a,b); else { add(m[3],a,b); add(m[3],b,a); }
    }
    m=raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})T/); if(m) add(m[1],m[2],m[3]);
    const d=new Date(raw); if(!isNaN(d)) add(d.getFullYear(),d.getMonth()+1,d.getDate());
    return [...new Set(out)];
  }
  function datesOf(row){
    const keys=['log_date','date','day','work_date','created_at','updated_at','start_at','end_at','check_in_at','check_out_at','createdAt','updatedAt','التاريخ','تاريخ','تاريخ التسجيل'];
    let arr=[]; keys.forEach(k=>{if(row&&row[k]!=null) arr.push(...parseDates(row[k]));});
    return [...new Set(arr)];
  }
  function inMonth(row,ym){return datesOf(row).some(d=>d.startsWith(ym));}

  function storageLogs(ym){
    const out=[]; const seen=new Set();
    function walk(v,depth){
      if(depth>4||v==null) return;
      if(Array.isArray(v)){v.forEach(x=>walk(x,depth+1));return;}
      if(typeof v==='object'){
        const looksLikeLog=['log_date','date','project_id','project','project_name','supervisor_id','user_id','check_in','check_out','logIn','logOut','time_in','time_out','visit_type'].some(k=>v[k]!=null);
        if(looksLikeLog && inMonth(v,ym)){
          const sig=JSON.stringify(v).slice(0,900); if(!seen.has(sig)){seen.add(sig);out.push({...v,__sourceTable:'localStorage'});}
        }
        Object.keys(v).slice(0,100).forEach(k=>{
          if(/orders|inventory|invoice|products|tickets|language|image/i.test(k)) return;
          walk(v[k],depth+1);
        });
      }
    }
    try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||''; if(/orders|inventory|invoice|products|tickets|language|image/i.test(k)) continue; const raw=localStorage.getItem(k); if(!raw||raw.length>2000000) continue; try{walk(JSON.parse(raw),0)}catch(_){}}}catch(_){ }
    return out;
  }
  async function loadLogs(ym){
    // لا نستخدم gte/lte على التاريخ حتى لا تضيع سجلات محفوظة بصيغ 1/10/2026 أو نصوص قديمة.
    const tables=['time_logs','daily_logs','work_logs','supervisor_time_logs'];
    let all=[];
    for(const t of tables){
      const rows=await allRows(t,'*',MAX_ROWS);
      if(rows.length) all.push(...rows.map(r=>({...r,__sourceTable:t})));
    }
    try{ const d=window.data||{}; ['logs','time_logs','dailyLogs','workLogs'].forEach(k=>all.push(...A(d[k]).map(r=>({...r,__sourceTable:'window.data'})))); }catch(_){ }
    all.push(...storageLogs(ym));
    const seen=new Set();
    return all.filter(r=>inMonth(r,ym)).filter(r=>{
      const sig=(r.__sourceTable||'')+'|'+(r.id||'')+'|'+JSON.stringify(r).slice(0,700);
      if(seen.has(sig)) return false; seen.add(sig); return true;
    });
  }

  function anyVal(row,keys){for(const k of keys){if(row && row[k]!==undefined && row[k]!==null && S(row[k])!=='') return row[k];} return '';}
  function userLabel(u){return S(u?.full_name||u?.name||u?.display_name||u?.employee_name||u?.username||u?.email||u?.id);}
  function projectLabel(p){return S(p?.name||p?.project_name||p?.title||p?.project_title||p?.building_name||p?.display_name||p?.code||p?.id);}
  function workerLabel(w){return S(w?.full_name||w?.name||w?.worker_name||w?.employee_name||w?.username||w?.id);}
  function findByFlexibleId(rows,id,labelFn){
    const x=S(id); if(!x) return null;
    let r=A(rows).find(v=>S(v.id)===x || S(v.uuid)===x || S(v.code)===x || S(v.value)===x);
    if(r) return r;
    const xl=x.toLowerCase();
    return A(rows).find(v=>S(labelFn(v)).toLowerCase()===xl || S(v.username).toLowerCase()===xl || S(v.email).toLowerCase()===xl) || null;
  }
  function nameUser(id){const u=findByFlexibleId(state.users,id,userLabel);return u?userLabel(u):'';}
  function nameProject(id){const p=findByFlexibleId(state.projects,id,projectLabel);return p?projectLabel(p):'';}
  function nameWorker(id){const w=findByFlexibleId(state.workers,id,workerLabel);return w?workerLabel(w):'';}
  function pick(r,keys){for(const k of keys){if(r&&S(r[k])) return S(r[k]);}return '';}
  function workerById(id){return findByFlexibleId(state.workers,id,workerLabel)||{};}
  function projectById(id){return findByFlexibleId(state.projects,id,projectLabel)||{};}
  function minutesFromTime(a,b){
    const to=t=>{const m=S(t).match(/^(\d{1,2}):(\d{2})/); return m?N(m[1])*60+N(m[2]):null};
    const x=to(a), y0=to(b); if(x==null||y0==null) return 0; let y=y0; if(y<x)y+=1440; return Math.max(0,y-x);
  }
  function normalize(row){
    const workerId=anyVal(row,['worker_id','workerId','employee_worker_id','employeeId','employee_id','عامل_id','كود العامل']);
    const worker=workerById(workerId);
    const pid=anyVal(row,['project_id','projectId','assigned_project_id','current_project_id','site_id','building_id','property_id','project','project_code','مشروع_id']) || anyVal(worker,['project_id','assigned_project_id','current_project_id','projectId']);
    const projectObj=projectById(pid);
    const uid=anyVal(row,['supervisor_id','supervisorId','user_id','userId','created_by','createdBy','manager_id','managerId','app_user_id','appUserId','employee_id','employeeId','مشرف_id']) || anyVal(worker,['supervisor_id','assigned_supervisor_id','app_supervisor_id','manager_id','supervisorId']) || anyVal(projectObj,['supervisor_id','manager_id','user_id','supervisorId']);
    let supervisor=pick(row,['supervisor_name','supervisorName','user_name','userName','username','full_name','created_by_name','employee_name','manager_name','المشرف','اسم المشرف'])||nameUser(uid);
    let project=pick(row,['project_name','projectName','site_name','building_name','projectTitle','property_name','المشروع','اسم المشروع'])||nameProject(pid);
    if(!project && S(pid) && !/^\d+$/.test(S(pid))) project=S(pid);
    if(!supervisor && S(uid) && !/^\d+$/.test(S(uid))) supervisor=S(uid);
    supervisor=supervisor||'غير محدد';
    project=project||'غير محدد';
    const workers=pick(row,['worker_names','workers','team_names','worker_name','employee_names','employees','workerName','employeeName','أسماء العمال','العامل'])||nameWorker(workerId)||'';
    const inn=pick(row,['check_in','time_in','log_in','in_time','start_time','entry_time','login_time','logIn','وقت الدخول','الدخول']);
    const out=pick(row,['check_out','time_out','log_out','out_time','end_time','exit_time','logout_time','logOut','وقت الخروج','الخروج']);
    let actual=N(row.actual_minutes||row.duration_minutes||row.total_minutes||row.minutes||row.work_minutes||row.actual_min||row.duration_min||row['المدة']||row['الدقائق الفعلية']);
    if(!actual){const h=N(row.actual_hours||row.duration_hours||row.total_hours||row.hours||row.work_hours||row['الساعات الفعلية']); actual=h?h*60:minutesFromTime(inn,out);}
    let required=N(row.required_minutes||row.planned_minutes||row.target_minutes||row.expected_minutes||row.must_minutes||row.required_min||row['الدقائق المطلوبة']);
    if(!required){const h=N(row.required_hours||row.planned_hours||row.target_hours||row.expected_hours||row.must_hours||row['الساعات المطلوبة']); required=h?h*60:0;}
    let travel=N(row.travel_minutes||row.transfer_minutes||row.lost_minutes||row.wasted_minutes||row.travel_time||row.log_travel||row['وقت الانتقال']);
    if(!travel&&N(row.travel_hours)) travel=N(row.travel_hours)*60;
    return {id:'',source:'سجلات النظام'+(row.__sourceTable?' - '+row.__sourceTable:''),supervisor,project,workers,count:1,requiredMin:required,actualMin:actual,travelMin:travel,percent:''};
  }

  function localManual(){try{return A(JSON.parse(localStorage.getItem(LOCAL_MANUAL)||'[]'));}catch(_){return[];}}
  function saveLocalManual(rows){try{localStorage.setItem(LOCAL_MANUAL,JSON.stringify(A(rows)));}catch(_){}}
  async function loadManual(ym){
    const sb=client();
    if(sb){try{const {data,error}=await sb.from(MANUAL_TABLE).select('*').eq('month_key',ym).order('created_at',{ascending:true}); if(!error) return A(data).map(r=>({id:r.id,source:'تعديل يدوي',supervisor:S(r.supervisor_name),project:S(r.project_name),workers:S(r.workers_names),count:N(r.records_count)||1,requiredMin:N(r.required_minutes),actualMin:N(r.actual_minutes),travelMin:N(r.travel_minutes),percent:r.percent_override==null?'':N(r.percent_override)}));}catch(e){console.warn('[monthly] manual read failed',e.message||e);}}
    return localManual().filter(r=>r.month===ym);
  }
  async function upsertManual(row){
    const id=row.id||(crypto.randomUUID?crypto.randomUUID():String(Date.now())); const sb=client();
    if(sb){const payload={id,month_key:row.month,supervisor_name:row.supervisor,project_name:row.project,workers_names:row.workers||'',records_count:N(row.count)||1,required_minutes:N(row.requiredMin),actual_minutes:N(row.actualMin),travel_minutes:N(row.travelMin),percent_override:row.percent===''?null:N(row.percent),updated_at:new Date().toISOString()}; const {error}=await sb.from(MANUAL_TABLE).upsert(payload,{onConflict:'id'}); if(error) throw error; return id;}
    const rows=localManual(); const ix=rows.findIndex(r=>r.id===id); const next={...row,id,source:'تعديل يدوي'}; if(ix>=0)rows[ix]=next;else rows.push(next); saveLocalManual(rows); return id;
  }
  async function removeManual(id){const sb=client(); if(sb){const {error}=await sb.from(MANUAL_TABLE).delete().eq('id',id); if(error) throw error; return;} saveLocalManual(localManual().filter(r=>r.id!==id));}
  function aggregate(logs,manual){
    const map=new Map();
    A(logs).map(normalize).forEach(r=>{const key=r.supervisor+'||'+r.project; if(!map.has(key))map.set(key,{id:key,source:'سجلات النظام',supervisor:r.supervisor,project:r.project,workers:'',count:0,requiredMin:0,actualMin:0,travelMin:0,percent:''}); const g=map.get(key); g.count+=1; g.requiredMin+=N(r.requiredMin); g.actualMin+=N(r.actualMin); g.travelMin+=N(r.travelMin); if(r.workers&&!g.workers.includes(r.workers)) g.workers=g.workers?g.workers+', '+r.workers:r.workers;});
    A(manual).forEach(r=>map.set('manual:'+r.id,{...r,source:'تعديل يدوي'}));
    return [...map.values()].sort((a,b)=>S(a.supervisor).localeCompare(S(b.supervisor),'ar')||S(a.project).localeCompare(S(b.project),'ar'));
  }
  function perf(r){const pct=r.percent!==''&&r.percent!=null?Math.round(N(r.percent)):(N(r.requiredMin)?Math.round(N(r.actualMin)/N(r.requiredMin)*100):(N(r.actualMin)?100:0)); if(pct>=95)return{pct,label:'ممتاز',cls:'green'}; if(pct>=80)return{pct,label:'جيد',cls:'amber'}; return{pct,label:'ضعيف',cls:'red'};}
  function status(t,c='amber'){const el=$('mtStatusV10142'); if(el){el.textContent=t;el.className='badge '+c;}}
  function message(t,err=false){const el=$('mtMessageV10142'); if(el){el.textContent=t||'';el.className='msg '+(err?'err':'');el.classList.toggle('hidden',!t);}}
  function filterRows(){const s=S($('mtSupervisorV10142')?.value), p=S($('mtProjectV10142')?.value); return state.rows.filter(r=>(!s||r.supervisor===s)&&(!p||r.project===p));}
  function fillFilters(){
    const curS=S($('mtSupervisorV10142')?.value), curP=S($('mtProjectV10142')?.value);
    const sups=[...new Set(state.rows.map(r=>r.supervisor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    const prjs=[...new Set(state.rows.map(r=>r.project).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    if($('mtSupervisorV10142')) $('mtSupervisorV10142').innerHTML='<option value="">كل المشرفين</option>'+sups.map(x=>`<option value="${E(x)}" ${x===curS?'selected':''}>${E(x)}</option>`).join('');
    if($('mtProjectV10142')) $('mtProjectV10142').innerHTML='<option value="">كل المشاريع</option>'+prjs.map(x=>`<option value="${E(x)}" ${x===curP?'selected':''}>${E(x)}</option>`).join('');
    if($('mtSupervisorListV10142')) $('mtSupervisorListV10142').innerHTML=[...new Set([...sups,...state.users.map(u=>S(u.full_name||u.name||u.username)).filter(Boolean)])].map(x=>`<option value="${E(x)}"></option>`).join('');
    if($('mtProjectListV10142')) $('mtProjectListV10142').innerHTML=[...new Set([...prjs,...state.projects.map(p=>S(p.name||p.project_name||p.title)).filter(Boolean)])].map(x=>`<option value="${E(x)}"></option>`).join('');
  }
  function renderSummary(rows){const actual=rows.reduce((s,r)=>s+N(r.actualMin),0), req=rows.reduce((s,r)=>s+N(r.requiredMin),0), travel=rows.reduce((s,r)=>s+N(r.travelMin),0), rec=rows.reduce((s,r)=>s+N(r.count),0); if($('mtSummaryV10142')) $('mtSummaryV10142').innerHTML=`<div class="kpi"><small>إجمالي الوقت</small><b>${fmt(actual/60,2)} ساعة</b></div><div class="kpi"><small>الساعات المطلوبة</small><b>${fmt(req/60,2)}</b></div><div class="kpi"><small>وقت الانتقال</small><b>${fmt(travel/60,2)}</b></div><div class="kpi"><small>المشرفين</small><b>${new Set(rows.map(r=>r.supervisor)).size}</b></div><div class="kpi"><small>المشاريع</small><b>${new Set(rows.map(r=>r.project)).size}</b></div><div class="kpi"><small>عدد السجلات</small><b>${rec}</b></div>`;}
  function renderTable(rows){const b=$('mtBodyV10142'); if(!b)return; if(!rows.length){b.innerHTML='<tr><td colspan="11">لا توجد بيانات للشهر المختار. جرّب اختيار شهر آخر أو تأكد من وجود سجلات دخول وخروج محفوظة.</td></tr>';return;} b.innerHTML=rows.map(r=>{const p=perf(r); return `<tr><td>${E(r.supervisor)}</td><td>${E(r.project)}</td><td>${E(r.workers||'-')}</td><td>${N(r.count)}</td><td>${fmt(N(r.requiredMin)/60,2)}</td><td>${fmt(N(r.actualMin)/60,2)}</td><td>${fmt(N(r.travelMin)/60,2)}</td><td>${p.pct}%</td><td><span class="badge ${p.cls}">${p.label}</span></td><td>${E(r.source)}</td><td>${r.source==='تعديل يدوي'?`<button class="light" onclick="TasneefMonthlyV10142.edit('${E(r.id)}')">تعديل</button> <button class="danger" onclick="TasneefMonthlyV10142.remove('${E(r.id)}')">حذف</button>`:'-'}</td></tr>`}).join('');}
  function render(){state.filtered=filterRows(); renderSummary(state.filtered); renderTable(state.filtered); status('تم تحميل '+state.filtered.length+' صف','green');}
  async function load(){if(state.loading)return; state.loading=true; const token=++state.token; const ym=S($('mtMonthV10142')?.value)||ymNow(); state.month=ym; if($('mtMonthV10142')) $('mtMonthV10142').value=ym; status('جاري التحميل...','amber'); message('جاري قراءة كل سجلات الدخول والخروج ثم فلترة شهر '+monthTitle(ym)+'...'); try{await loadLookups(); const [logs,manual]=await Promise.all([loadLogs(ym),loadManual(ym)]); if(token!==state.token)return; state.rawLogs=logs; state.manual=manual; state.rows=aggregate(logs,manual); fillFilters(); render(); message(`تم تحميل ${logs.length} سجل دخول/خروج و ${manual.length} تعديل يدوي لشهر ${monthTitle(ym)}.`,false);}catch(e){console.error(e); status('خطأ','red'); message('تعذر تحميل الأوقات الشهرية: '+(e.message||e),true);}finally{state.loading=false;}}
  function clearForm(){['mtManualIdV10142','mtManualSupervisorV10142','mtManualProjectV10142','mtManualWorkersV10142','mtManualRequiredV10142','mtManualActualV10142','mtManualTravelV10142','mtManualPercentV10142'].forEach(id=>{if($(id))$(id).value='';});}
  async function saveForm(){const r={id:S($('mtManualIdV10142')?.value),month:S($('mtMonthV10142')?.value)||ymNow(),supervisor:S($('mtManualSupervisorV10142')?.value),project:S($('mtManualProjectV10142')?.value),workers:S($('mtManualWorkersV10142')?.value),count:1,requiredMin:N($('mtManualRequiredV10142')?.value),actualMin:N($('mtManualActualV10142')?.value),travelMin:N($('mtManualTravelV10142')?.value),percent:S($('mtManualPercentV10142')?.value)===''?'':N($('mtManualPercentV10142')?.value),source:'تعديل يدوي'}; if(!r.supervisor||!r.project){alert('اكتب اسم المشرف واسم المشروع');return;} try{await upsertManual(r); clearForm(); await load(); message('تم حفظ التعديل وظهر في الجدول والطباعة.',false);}catch(e){alert('تعذر حفظ التعديل: '+(e.message||e));}}
  function edit(id){const r=state.rows.find(x=>String(x.id)===String(id)); if(!r)return; $('mtManualIdV10142').value=r.id; $('mtManualSupervisorV10142').value=r.supervisor; $('mtManualProjectV10142').value=r.project; $('mtManualWorkersV10142').value=r.workers||''; $('mtManualRequiredV10142').value=N(r.requiredMin)||''; $('mtManualActualV10142').value=N(r.actualMin)||''; $('mtManualTravelV10142').value=N(r.travelMin)||''; $('mtManualPercentV10142').value=r.percent===''?'':N(r.percent);}
  async function remove(id){if(!confirm('حذف هذا التعديل اليدوي؟'))return; try{await removeManual(id); await load();}catch(e){alert('تعذر الحذف: '+(e.message||e));}}
  function csv(){const rows=state.filtered||[]; const headers=['المشرف','المشروع','أسماء العمال','عدد السجلات','الساعات المطلوبة','الساعات الفعلية','وقت الانتقال','نسبة العمل','حالة الأداء','المصدر']; const lines=[headers.join(',')].concat(rows.map(r=>{const p=perf(r); return [r.supervisor,r.project,r.workers||'',N(r.count),fmt(N(r.requiredMin)/60,2),fmt(N(r.actualMin)/60,2),fmt(N(r.travelMin)/60,2),p.pct+'%',p.label,r.source].map(x=>'"'+S(x).replace(/"/g,'""')+'"').join(',')})); const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='monthly-times-'+(state.month||ymNow())+'.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  function print(){const rows=state.filtered||[]; const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية</title><style>body{font-family:Tahoma,Arial,sans-serif;margin:24px;color:#10231d}h1{color:#0A4033;margin:0 0 8px}.muted{color:#60706a}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}.kpi{border:1px solid #dce6e2;border-radius:12px;padding:10px}.kpi small{color:#60706a}.kpi b{display:block;font-size:22px;color:#0A4033;margin-top:6px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:14px}th,td{border:1px solid #dce6e2;padding:8px;text-align:right}th{background:#f3f6f5}</style></head><body><h1>تقرير الأوقات الشهرية</h1><div class="muted">الشهر: ${E(monthTitle(state.month||ymNow()))}</div>${$('mtSummaryV10142')?.outerHTML||''}<table><thead><tr><th>المشرف</th><th>المشروع</th><th>أسماء العمال</th><th>عدد السجلات</th><th>الساعات المطلوبة</th><th>الساعات الفعلية</th><th>وقت الانتقال</th><th>النسبة</th><th>الحالة</th><th>المصدر</th></tr></thead><tbody>${rows.map(r=>{const p=perf(r);return `<tr><td>${E(r.supervisor)}</td><td>${E(r.project)}</td><td>${E(r.workers||'-')}</td><td>${N(r.count)}</td><td>${fmt(N(r.requiredMin)/60,2)}</td><td>${fmt(N(r.actualMin)/60,2)}</td><td>${fmt(N(r.travelMin)/60,2)}</td><td>${p.pct}%</td><td>${p.label}</td><td>${E(r.source)}</td></tr>`}).join('')||'<tr><td colspan="10">لا توجد بيانات</td></tr>'}</tbody></table><script>window.onload=function(){setTimeout(function(){window.print()},200)}<\/script></body></html>`; const w=window.open('','_blank'); if(!w){alert('اسمح بفتح نافذة الطباعة');return;} w.document.open(); w.document.write(html); w.document.close();}
  function bind(){if(!$('monthly')||!$('mtBodyV10142'))return; if($('mtMonthV10142')&&!$('mtMonthV10142').value)$('mtMonthV10142').value=ymNow(); $('mtMonthV10142')?.addEventListener('change',load); $('mtSupervisorV10142')?.addEventListener('change',render); $('mtProjectV10142')?.addEventListener('change',render); $('mtRefreshV10142')?.addEventListener('click',load); $('mtPrintV10142')?.addEventListener('click',print); $('mtCsvV10142')?.addEventListener('click',csv); $('mtManualSaveV10142')?.addEventListener('click',saveForm); $('mtManualClearV10142')?.addEventListener('click',clearForm); load();}
  window.TasneefMonthlyV10142={reload:load,edit,remove,print,csv}; window.renderMonthly=load; window.exportMonthlyCSV=csv; window.printMonthlyReportV57=print;
  document.addEventListener('DOMContentLoaded',bind,{once:true});
  window.addEventListener('load',()=>setTimeout(bind,300),{once:true});
})();

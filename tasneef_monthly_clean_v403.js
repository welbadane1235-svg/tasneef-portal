/* Tasneef V10801 - Monthly times stability and full-time percentage fix
   One source only: projects + monthly_distribution + time_logs.
   Non-destructive: reads data only and never updates source records.
*/
(function(){
  'use strict';

  const BUILD='V10801-PROFESSIONAL-PRINT-HOTFIX';
  const $=id=>document.getElementById(id);
  const S=v=>(v==null?'':String(v)).trim();
  const N=v=>{const n=Number(v||0);return Number.isFinite(n)?n:0;};
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>S(v).replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/\s+/g,' ').toLowerCase();
  const sb=()=>window.sb||window.supabaseClient||null;
  const nowMs=()=>typeof performance!=='undefined'&&performance.now?performance.now():Date.now();
  const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  const isAbortError=e=>e?.name==='AbortError'||/abort/i.test(S(e?.message));
  const isDev=()=>{try{return location.hostname==='localhost'||location.hostname==='127.0.0.1'||localStorage.getItem('tasneef_debug')==='1';}catch(_){return false;}};

  let latestRequestId=0;
  let activeController=null;
  let activeLoadKey='';
  let currentRawRows=[];
  let currentVisibleRows=[];
  let currentMonthLoaded='';
  let debounceTimer=null;
  let staticCache={loadedAt:0,projects:[],employees:[],users:[]};
  let staticLoadPromise=null;
  const STATIC_CACHE_MS=5*60*1000;

  function currentMonthLocal(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
  function selectedMonth(){return $('mc401Month')?.value||currentMonthLocal();}
  function selectedFilters(){return {supervisor:$('mc401Supervisor')?.value||'',type:$('mc401Type')?.value||''};}
  function parseIsoDateParts(value){
    const m=S(value).replace(/\//g,'-').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(!m)return null;
    const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);
    if(!Number.isInteger(y)||mo<1||mo>12||d<1||d>31)return null;
    return {y,mo,d};
  }
  function isoFromUtcDate(date){return date.toISOString().slice(0,10);}
  function addDaysIso(value,days){
    const p=parseIsoDateParts(value);if(!p)return '';
    return isoFromUtcDate(new Date(Date.UTC(p.y,p.mo-1,p.d+Number(days||0))));
  }
  function monthRange(m){
    m=/^\d{4}-\d{2}$/.test(S(m))?S(m):currentMonthLocal();
    const [y,mo]=m.split('-').map(Number);
    const from=m+'-01';
    const to=isoFromUtcDate(new Date(Date.UTC(y,mo,1)));
    return {month:m,from,to,fromIso:from+'T00:00:00',toIso:to+'T00:00:00',lastDay:addDaysIso(to,-1)};
  }
  function dateOnly(v){const p=parseIsoDateParts(v);return p?`${String(p.y).padStart(4,'0')}-${String(p.mo).padStart(2,'0')}-${String(p.d).padStart(2,'0')}`:'';}
  function utcWeekday(day){const p=parseIsoDateParts(day);return p?new Date(Date.UTC(p.y,p.mo-1,p.d)).getUTCDay():-1;}
  function maxDate(...values){return values.filter(Boolean).sort().at(-1)||'';}
  function minDate(...values){return values.filter(Boolean).sort()[0]||'';}
  function minsText(m){m=Math.round(N(m));const h=Math.floor(m/60),mm=m%60;if(!h)return mm+' دقيقة';if(!mm)return h+' ساعة';return h+' ساعة و '+mm+' دقيقة';}
  function pct(v){const n=Math.round(N(v)*10)/10;return String(n).replace(/\.0$/,'')+'%';}
  function fullDisplayPercentage(raw){return Math.min(Math.max(N(raw),0),100);}
  function calculateFullTimeMetrics(actualMinutes,requiredMinutes){
    const actual=Math.max(N(actualMinutes),0);
    const required=Math.max(N(requiredMinutes),0);
    const rawPercentage=required>0?(actual/required)*100:0;
    return {
      projectActualMinutes:actual,
      projectRequiredMinutes:required,
      rawPercentage:Number.isFinite(rawPercentage)?rawPercentage:0,
      displayedPercentage:fullDisplayPercentage(rawPercentage),
      overtimeMinutes:Math.max(actual-required,0)
    };
  }

  function entityActive(entity){
    if(!entity)return false;
    if(Object.prototype.hasOwnProperty.call(entity,'is_active'))return entity.is_active===true;
    const status=norm(entity.status||entity.project_status||entity.worker_status||'active');
    return !['inactive','stopped','ended','archived','deleted','cancelled','canceled','متوقف','موقوف','منتهي','مؤرشف','محذوف','ملغي'].some(x=>status.includes(x));
  }
  function codeOf(e){return S(e?.employee_code||e?.code||e?.worker_code||e?.employee_id_code||e?.employee_id||e?.id||'');}
  function empName(e){return S(e?.app_name||e?.employee_name||e?.name||e?.full_name||e?.worker_name||e?.iqama_name||'');}
  function cleanName(v){return S(v).replace(/TS-\d+\s*-\s*/ig,'').replace(/TS-\d+/ig,'').replace(/[()（）]/g,'').trim();}
  function projectId(p){return S(p?.id||p?.project_id||'');}
  function projectName(p){return S(p?.name||p?.project_name||p?.title||'-');}
  function projectTypeFromProjects(p){
    const t=norm(p?.operation_type||p?.project_type||p?.work_type||p?.type||p?.contract_type||'');
    if(t.includes('دوام')||t.includes('كامل')||t.includes('دائم')||t.includes('full')||t.includes('permanent')||t.includes('fixed')||t.includes('24')||t.includes('فتر'))return 'دوام كامل';
    return 'زيارة يومية';
  }
  function isFull(r){return S(r?.projectType).includes('دوام');}
  function userName(u){return S(u?.full_name||u?.name||u?.username||'');}

  function employeeMaps(employees){
    const byCode=new Map(),byName=new Map();
    for(const e of employees){
      const c=codeOf(e);if(c&&!byCode.has(c))byCode.set(c,e);
      const n=norm(empName(e));if(n&&!byName.has(n))byName.set(n,e);
    }
    return {byCode,byName};
  }
  function employeeFromDistribution(d,maps){
    const code=S(d?.worker_employee_code||d?.employee_code||d?.worker_code||d?.worker_id||d?.employee_id||'');
    if(code&&maps.byCode.has(code))return maps.byCode.get(code);
    const name=norm(cleanName(d?.worker_name||d?.employee_name||''));
    return name?maps.byName.get(name)||null:null;
  }
  function workerKey(d,e){return codeOf(e)||S(d?.worker_employee_code||d?.employee_code||d?.worker_code||d?.worker_id||d?.employee_id||norm(d?.worker_name||d?.employee_name));}
  function workerLabel(d,e){
    const code=codeOf(e)||S(d?.worker_employee_code||d?.employee_code||d?.worker_code||'');
    const name=empName(e)||cleanName(d?.worker_name||d?.employee_name||'');
    if(code&&name)return `${code} - ${name}`;
    return name||code||'-';
  }
  function supervisorLabel(d,p,users){
    const dCode=S(d?.supervisor_employee_code||d?.supervisor_code||'');
    const dName=S(d?.supervisor_name||'');
    if(dCode&&dName)return `${dCode} - ${cleanName(dName)}`;
    if(dName)return cleanName(dName);
    const id=S(p?.supervisor_id||p?.current_supervisor_id||p?.app_supervisor_id||'');
    const u=users.find(x=>S(x.id)===id);
    return userName(u)||S(p?.supervisor_name||'-');
  }

  function activeDistributionRow(d,m){
    if(Object.prototype.hasOwnProperty.call(d||{},'is_active')&&d.is_active!==true)return false;
    const status=norm(d?.status||'active');
    if(['inactive','ended','cancel','deleted','archived','متوقف','منتهي','ملغي','محذوف','مؤرشف'].some(x=>status.includes(x)))return false;
    const r=monthRange(m);
    const start=dateOnly(d?.start_date||d?.assignment_start||d?.effective_from||'');
    const end=dateOnly(d?.end_date||d?.assignment_end||d?.effective_to||'');
    if(start&&start>r.lastDay)return false;
    if(end&&end<r.from)return false;
    return true;
  }
  function logDate(l){return dateOnly(l?.log_date||l?.date||l?.work_date||l?.attendance_date||l?.day||l?.check_in||l?.created_at);}
  function logProjectId(l){return S(l?.project_id||l?.projectId||l?.project||l?.projectID||'');}
  function actualMinutes(l){
    const saved=N(l?.duration_minutes||l?.actual_minutes||l?.minutes||l?.total_minutes||l?.work_minutes||0);
    if(saved>0)return saved;
    const ci=l?.check_in||l?.checkin_at||l?.in_time||l?.start_time||l?.created_at;
    const co=l?.check_out||l?.checkout_at||l?.out_time||l?.end_time;
    if(ci&&co){const diff=(new Date(co)-new Date(ci))/60000;if(Number.isFinite(diff)&&diff>0)return diff;}
    return 0;
  }
  function employeeStart(e){return dateOnly(e?.employment_start_date||e?.hire_date||e?.joining_date||e?.start_date||e?.commencement_date||'');}
  function employeeEnd(e){return dateOnly(e?.employment_end_date||e?.stop_date||e?.stopped_at||e?.end_date||e?.termination_date||'');}
  function projectStart(p){return dateOnly(p?.contract_start||p?.start_date||p?.operation_start||p?.contract_start_date||'');}
  function projectEnd(p){return dateOnly(p?.contract_end||p?.end_date||p?.operation_end||p?.stopped_at||p?.contract_end_date||'');}

  const weekdayAliases={
    0:['sun','sunday','الاحد','الأحد'],1:['mon','monday','الاثنين'],2:['tue','tuesday','الثلاثاء'],3:['wed','wednesday','الاربعاء','الأربعاء'],4:['thu','thursday','الخميس'],5:['fri','friday','الجمعه','الجمعة'],6:['sat','saturday','السبت']
  };
  function valueList(v){
    if(Array.isArray(v))return v.map(S).filter(Boolean);
    if(v&&typeof v==='object')return Object.keys(v).filter(k=>v[k]).map(S);
    return S(v).split(/[،,|;/]+/).map(x=>x.trim()).filter(Boolean);
  }
  function configuredWorkingDay(p,day){
    const working=valueList(p?.working_days||p?.work_days||p?.days_of_work);
    const off=valueList(p?.weekly_off_days||p?.rest_days||p?.days_off);
    const aliases=weekdayAliases[day]||[];
    const matches=list=>list.some(v=>aliases.some(a=>norm(v)===norm(a)||norm(v).includes(norm(a))));
    if(working.length)return matches(working);
    if(off.length&&matches(off))return false;
    return true;
  }
  function projectHoliday(p,day){
    const dates=valueList(p?.holiday_dates||p?.holidays||p?.off_dates).map(dateOnly).filter(Boolean);
    return dates.includes(day);
  }
  function projectRequiredForDay(p,day){
    const weekday=utcWeekday(day);
    if(weekday<0||projectHoliday(p,day)||!configuredWorkingDay(p,weekday))return 0;
    const daily=N(p?.required_daily_minutes||p?.daily_required_minutes||p?.required_minutes||p?.minutes_per_day||0);
    const friday=N(p?.friday_minutes||p?.friday_required_minutes||p?.required_friday_minutes||0);
    if(weekday===5)return friday>0?friday:0;
    const perShift=N(p?.required_minutes_per_shift||p?.minutes_per_shift||0);
    const shifts=Math.max(1,N(p?.shift_count||p?.shifts_count||p?.number_of_shifts||1));
    return perShift>0?perShift*shifts:daily;
  }
  function assignmentActiveForDate(assignment,employee,day){
    const start=maxDate(
      dateOnly(assignment?.start_date||assignment?.assignment_start||assignment?.effective_from||''),
      employeeStart(employee)
    );
    const end=minDate(
      dateOnly(assignment?.end_date||assignment?.assignment_end||assignment?.effective_to||''),
      employeeEnd(employee)
    );
    if(start&&day<start)return false;
    if(end&&day>end)return false;
    return true;
  }
  function requiredMinutesForProjectWorkers(project,m,workerAssignments){
    const range=monthRange(m);
    const from=maxDate(range.from,projectStart(project));
    const to=minDate(range.lastDay,projectEnd(project));
    if(!from||!to||from>to)return {requiredMinutes:0,workerCount:0,workerRequired:new Map()};

    // نبني أيام الشهر مرة واحدة بتوقيت UTC. الحارس يمنع أي حلقة لا نهائية مهما كانت البيانات.
    const projectDays=[];
    let day=from;
    for(let guard=0;guard<32&&day&&day<=to;guard++){
      projectDays.push({day,required:projectRequiredForDay(project,day)});
      const next=addDaysIso(day,1);
      if(!next||next<=day){console.error(BUILD,'توقف أمان حساب الأيام', {day,next,project:projectId(project)});break;}
      day=next;
    }

    const workers=new Map();
    for(const item of workerAssignments||[]){
      const key=item.workerKey;if(!key)continue;
      if(!workers.has(key))workers.set(key,{employee:item.employee,assignments:[]});
      workers.get(key).assignments.push(item.distribution);
    }
    const workerRequired=new Map();
    for(const [key,item] of workers){
      const intervals=item.assignments.map(a=>({
        start:maxDate(dateOnly(a?.start_date||a?.assignment_start||a?.effective_from||''),employeeStart(item.employee)),
        end:minDate(dateOnly(a?.end_date||a?.assignment_end||a?.effective_to||''),employeeEnd(item.employee))
      }));
      let required=0;
      for(const info of projectDays){
        if(info.required<=0)continue;
        const active=intervals.some(x=>(!x.start||info.day>=x.start)&&(!x.end||info.day<=x.end));
        if(active)required+=info.required;
      }
      workerRequired.set(key,required);
    }
    return {requiredMinutes:[...workerRequired.values()].reduce((sum,v)=>sum+N(v),0),workerCount:workerRequired.size,workerRequired};
  }

  function queryWithSignal(builder,signal){return signal&&typeof builder?.abortSignal==='function'?builder.abortSignal(signal):builder;}
  async function runQuery(builder,signal,label,stats){
    stats.networkRequestsCount+=1;
    try{
      const result=await queryWithSignal(builder,signal);
      if(result?.error)throw result.error;
      return result?.data||[];
    }catch(e){
      if(isAbortError(e)||signal?.aborted)throw new DOMException('Aborted','AbortError');
      console.warn(BUILD,label,e?.message||e);
      throw e;
    }
  }
  async function loadStaticData(client,signal,force,stats){
    const fresh=staticCache.loadedAt&&(Date.now()-staticCache.loadedAt)<STATIC_CACHE_MS;
    if(!force&&fresh)return staticCache;
    // القوائم الأساسية ليست مرتبطة بالشهر؛ نحمّلها مرة واحدة ولا نلغيها عند التنقل السريع بين الشهور.
    if(staticLoadPromise)return staticLoadPromise;
    const task=(async()=>{
      const [projects,employees,users]=await Promise.all([
        runQuery(client.from('projects').select('*').eq('is_active',true).order('id').limit(5000),null,'projects',stats),
        runQuery(client.from('employees_master_v386').select('*').limit(10000),null,'employees_master_v386',stats),
        runQuery(client.from('app_users').select('*').limit(3000),null,'app_users',stats)
      ]);
      staticCache={loadedAt:Date.now(),projects,employees,users};
      return staticCache;
    })();
    staticLoadPromise=task;
    try{return await task;}finally{if(staticLoadPromise===task)staticLoadPromise=null;}
  }
  async function loadMonthData(client,m,signal,stats){
    const range=monthRange(m);
    const [distribution,logs]=await Promise.all([
      runQuery(client.from('monthly_distribution').select('project_id,project_name,supervisor_employee_code,supervisor_name,worker_employee_code,worker_name,month_key,status,start_date,end_date').eq('month_key',m).limit(20000),signal,'monthly_distribution month',stats),
      runQuery(client.from('time_logs').select('id,project_id,supervisor_id,log_date,check_in,check_out,duration_minutes,required_minutes,travel_minutes,created_at').gte('log_date',range.from).lt('log_date',range.to).order('log_date',{ascending:true}).limit(30000),signal,'time_logs month',stats)
    ]);
    return {distribution,logs};
  }

  function buildMonthlyTimesReport(raw,m,stats){
    const calculationStarted=nowMs();
    const projects=(raw.projects||[]).filter(entityActive);
    const employees=(raw.employees||[]).filter(entityActive);
    const users=(raw.users||[]).filter(u=>!Object.prototype.hasOwnProperty.call(u,'is_active')||u.is_active===true);
    const maps=employeeMaps(employees);
    const projectsById=new Map(projects.map(p=>[projectId(p),p]));
    const projectsByName=new Map(projects.map(p=>[norm(projectName(p)),p]));
    const rows=new Map();
    const distByProject=new Map();

    const ensureRow=project=>{
      if(!project||!entityActive(project))return null;
      const pid=projectId(project);if(!pid)return null;
      if(!rows.has(pid))rows.set(pid,{month:m,projectId:pid,projectName:projectName(project),projectType:projectTypeFromProjects(project),project,supervisorName:supervisorLabel(null,project,users),workers:[],workerKeys:new Set(),totalMinutes:0,requiredMinutes:0,loggedRequiredMinutes:0,logsCount:0});
      return rows.get(pid);
    };

    const uniqueDistribution=new Set();
    for(const d of raw.distribution||[]){
      if(!activeDistributionRow(d,m))continue;
      const project=projectsById.get(S(d.project_id))||projectsByName.get(norm(d.project_name));
      if(!project||!entityActive(project))continue;
      const employee=employeeFromDistribution(d,maps);
      if(employee&&!entityActive(employee))continue;
      const key=workerKey(d,employee);if(!key)continue;
      const dedupe=[projectId(project),key,dateOnly(d.start_date),dateOnly(d.end_date)].join('|');
      if(uniqueDistribution.has(dedupe))continue;
      uniqueDistribution.add(dedupe);
      const row=ensureRow(project);if(!row)continue;
      row.supervisorName=supervisorLabel(d,project,users)||row.supervisorName;
      if(!row.workerKeys.has(key)){row.workerKeys.add(key);row.workers.push(workerLabel(d,employee));}
      if(!distByProject.has(row.projectId))distByProject.set(row.projectId,[]);
      distByProject.get(row.projectId).push({workerKey:key,employee,distribution:d});
    }

    const seenLogs=new Set();
    for(const log of raw.logs||[]){
      const day=logDate(log);if(!day||day.slice(0,7)!==m)continue;
      const pid=logProjectId(log);const project=projectsById.get(pid);if(!project||!entityActive(project))continue;
      const key=S(log.id)||[pid,day,S(log.check_in),S(log.check_out)].join('|');
      if(seenLogs.has(key))continue;
      seenLogs.add(key);
      const row=ensureRow(project);if(!row)continue;
      row.totalMinutes+=actualMinutes(log);
      row.loggedRequiredMinutes+=N(log.required_minutes);
      row.logsCount+=1;
    }

    const reportRows=[];
    for(const row of rows.values()){
      row.workers=[...new Set(row.workers.filter(Boolean))];
      delete row.workerKeys;
      if(isFull(row)){
        const required=requiredMinutesForProjectWorkers(row.project,m,distByProject.get(row.projectId)||[]);
        row.workerCount=required.workerCount;
        row.workerRequiredMinutes=required.workerRequired;
        row.requiredMinutes=N(required.requiredMinutes);
        if(row.requiredMinutes<=0&&N(row.loggedRequiredMinutes)>0)row.requiredMinutes=N(row.loggedRequiredMinutes);
        const metrics=calculateFullTimeMetrics(row.totalMinutes,row.requiredMinutes);
        // حسب اعتماد التشغيل: جميع المشاريع الدائمة/الدوام الكامل تظهر بنسبة ثابتة 100%.
        // نحتفظ بالنسبة الخام والوقت الإضافي للتشخيص والتصدير دون تغيير السجلات الأصلية.
        Object.assign(row,metrics,{percentage:100,displayedPercentage:100});
        row.calcNote='مشروع دوام كامل — النسبة المعتمدة 100%';
      }else{
        row.calcNote='مدة المشروع ÷ إجمالي مدة مشاريع المشرف';
      }
      reportRows.push(row);
    }

    const dailyTotals=new Map();
    for(const row of reportRows){if(!isFull(row)){const key=row.supervisorName||'-';dailyTotals.set(key,N(dailyTotals.get(key))+N(row.totalMinutes));}}
    for(const row of reportRows){if(!isFull(row)){const total=N(dailyTotals.get(row.supervisorName||'-'));row.rawPercentage=total>0?(N(row.totalMinutes)/total)*100:0;row.percentage=row.rawPercentage;row.overtimeMinutes=0;}}

    reportRows.sort((a,b)=>(Number(isFull(a))-Number(isFull(b)))||S(a.supervisorName).localeCompare(S(b.supervisorName),'ar')||S(a.projectName).localeCompare(S(b.projectName),'ar'));
    stats.rawRecordsCount=(raw.logs||[]).length;
    stats.uniqueRecordsCount=seenLogs.size;
    stats.supervisorsCount=new Set(reportRows.map(r=>r.supervisorName).filter(Boolean)).size;
    stats.dailyVisitProjectsCount=reportRows.filter(r=>!isFull(r)).length;
    stats.fullTimeProjectsCount=reportRows.filter(isFull).length;
    stats.calculationDurationMs=Math.round(nowMs()-calculationStarted);
    return reportRows;
  }

  function filterRows(rows,filters){return rows.filter(r=>(!filters.supervisor||r.supervisorName===filters.supervisor)&&(!filters.type||(filters.type==='daily'&&!isFull(r))||(filters.type==='full'&&isFull(r))));}
  function setLoadingUi(isLoading,text){
    const message=$('mc401Message');if(message&&text)message.textContent=text;
    for(const id of ['mc401Show','mc401Print','mc401Export']){const el=$(id);if(el)el.disabled=!!isLoading;}
    const show=$('mc401Show');if(show)show.textContent=isLoading?'جاري التحميل…':'عرض الشهر';
  }
  function fillFilters(rows){
    const sup=$('mc401Supervisor');if(!sup)return;
    const current=sup.value;
    const values=[...new Set(rows.map(r=>r.supervisorName).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    sup.innerHTML='<option value="">كل المشرفين</option>'+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
    if(values.includes(current))sup.value=current;
  }
  function fullCard(row){
    const p=100;
    const pText=Math.abs(p-100)<0.0001?'100%':p.toFixed(1).replace(/\.0$/,'')+'%';
    const overtime=N(row.overtimeMinutes)>0?`<div class="mc401-row"><span>وقت إضافي</span><b>${esc(minsText(row.overtimeMinutes))}</b></div>`:'';
    return `<article class="mc401-card full"><h3>${esc(row.projectName)}</h3><div class="mc401-row"><span>المشرف</span><b>${esc(row.supervisorName||'-')}</b></div><div class="mc401-row"><span>نوع المشروع</span><b>${esc(row.projectType)}</b></div><div class="mc401-row"><span>عدد العمال المحتسبين</span><b>${N(row.workerCount||row.workers?.length)}</b></div><div class="mc401-row"><span>الوقت الفعلي</span><b>${esc(minsText(row.totalMinutes))}</b></div><div class="mc401-row"><span>الوقت المطلوب</span><b>${esc(minsText(row.requiredMinutes))}</b></div><div class="mc401-row"><span>النسبة</span><b>${pText}</b></div>${overtime}<div class="mc401-bar"><i style="width:${Math.min(Math.max(p,0),100).toFixed(0)}%"></i></div><div class="mc401-workers">${(row.workers||[]).map(w=>`<span class="mc401-pill">${esc(w)}</span>`).join('')||'<span class="mc401-pill">لا يوجد توزيع نشط</span>'}</div></article>`;
  }
  function dailyBox(supervisor,list){
    const total=list.reduce((sum,row)=>sum+N(row.totalMinutes),0);
    const workers=[...new Set(list.flatMap(row=>row.workers||[]))];
    return `<article class="mc406-daily-card"><div class="mc406-daily-head"><h3>${esc(supervisor||'-')}</h3><div class="mc406-mini"><span>المشاريع: ${list.length}</span><span>إجمالي الوقت: ${esc(minsText(total))}</span><span>الدقائق: ${Math.round(total).toLocaleString('en-US')}</span></div></div><table class="mc406-table"><thead><tr><th>المشروع</th><th>الوقت</th><th>الدقائق</th><th>النسبة</th><th>المعادلة</th></tr></thead><tbody>${list.map(row=>`<tr><td><b>${esc(row.projectName)}</b></td><td>${esc(minsText(row.totalMinutes))}</td><td>${Math.round(N(row.totalMinutes)).toLocaleString('en-US')}</td><td><b>${pct(row.percentage)}</b><div class="mc406-progress"><i style="width:${Math.min(Math.max(N(row.percentage),0),100).toFixed(0)}%"></i></div></td><td>${esc(row.calcNote)}</td></tr>`).join('')}</tbody></table><div class="mc406-workers"><b>العمال:</b> ${workers.map(w=>`<span class="mc406-pill">${esc(w)}</span>`).join('')||'<span class="mc406-pill">لا يوجد توزيع نشط</span>'}</div></article>`;
  }
  async function putHtmlBatched(container,items,emptyHtml,requestId,batchSize=12){
    if(!container)return;
    container.replaceChildren();
    if(!items.length){container.innerHTML=emptyHtml;return;}
    for(let i=0;i<items.length;i+=batchSize){
      if(requestId!==latestRequestId)return;
      const template=document.createElement('template');
      template.innerHTML=items.slice(i,i+batchSize).join('');
      container.appendChild(template.content);
      if(i+batchSize<items.length)await nextFrame();
    }
  }
  function ensureCss(){
    if($('mc406Css'))return;
    const style=document.createElement('style');style.id='mc406Css';style.textContent=`
      .mc406-daily-card{border:2px solid #0A4033;border-radius:16px;padding:14px;margin:12px 0;background:#fff;break-inside:avoid}.mc406-daily-head{display:flex;justify-content:space-between;gap:10px;align-items:center;border-bottom:1px solid #dce6e2;padding-bottom:8px;margin-bottom:8px}.mc406-daily-head h3{margin:0;color:#0A4033}.mc406-mini{display:flex;gap:6px;flex-wrap:wrap}.mc406-mini span{background:#eef8f5;border:1px solid #cfe2dc;border-radius:999px;padding:6px 9px;font-weight:900}.mc406-table{width:100%;border-collapse:collapse}.mc406-table th{background:#f2f8f5;color:#0A4033}.mc406-table th,.mc406-table td{padding:9px;border-bottom:1px solid #edf1ef;text-align:right}.mc406-progress{height:8px;background:#edf3f1;border-radius:999px;overflow:hidden}.mc406-progress i{display:block;height:100%;background:#0A4033}.mc406-workers{margin-top:9px}.mc406-pill{display:inline-block;background:#eef8f5;border:1px solid #d5e9e2;border-radius:999px;padding:5px 9px;margin:3px;font-weight:800;color:#0A4033}.mc401-toolbar button:disabled{opacity:.6;cursor:not-allowed}@page{size:A4 landscape;margin:8mm}`;
    document.head.appendChild(style);
  }

  async function renderRows(rows,requestId,stats){
    const renderStarted=nowMs();
    const daily=rows.filter(r=>!isFull(r));
    const full=rows.filter(isFull);
    const total=rows.reduce((sum,row)=>sum+N(row.totalMinutes),0);
    const summary=$('mc401Summary');
    if(summary)summary.innerHTML=[['الشهر',currentMonthLoaded||selectedMonth()],['إجمالي المشاريع',rows.length],['مشاريع الزيارة',daily.length],['مشاريع الدوام الكامل',full.length],['إجمالي الوقت',minsText(total)]].map(([label,value])=>`<div class="mc401-kpi"><small>${esc(label)}</small><b>${esc(value)}</b></div>`).join('');
    const groups=new Map();for(const row of daily){const key=row.supervisorName||'-';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
    await Promise.all([
      putHtmlBatched($('mc401Daily'),[...groups.entries()].map(([sup,list])=>dailyBox(sup,list)),'<div class="mc401-empty">لا توجد مشاريع زيارة يومية لهذا الشهر.</div>',requestId,5),
      putHtmlBatched($('mc401Full'),full.map(fullCard),'<div class="mc401-empty">لا توجد مشاريع دوام كامل لهذا الشهر.</div>',requestId,10)
    ]);
    if(requestId!==latestRequestId)return;
    const body=$('mc401Body');
    if(body){
      const tableRows=rows.map(row=>`<tr><td>${esc(currentMonthLoaded||selectedMonth())}</td><td>${esc(row.supervisorName)}</td><td>${esc(row.projectName)}</td><td>${esc(row.projectType)}</td><td>${(row.workers||[]).map(esc).join('، ')||'-'}</td><td>${Math.round(N(row.totalMinutes)).toLocaleString('en-US')}</td><td>${esc(minsText(row.totalMinutes))}</td><td><b>${pct(row.percentage)}</b></td><td>${esc(row.calcNote)}</td></tr>`);
      await putHtmlBatched(body,tableRows,'<tr><td colspan="9">لا توجد بيانات لهذا الشهر.</td></tr>',requestId,80);
    }
    stats.renderDurationMs=Math.round(nowMs()-renderStarted);
  }

  function logDiagnostics(stats,rows){
    if(!isDev())return;
    console.table(stats);
    rows.filter(isFull).forEach(row=>console.table({projectId:row.projectId,projectName:row.projectName,workersCount:N(row.workerCount),projectActualMinutes:Math.round(N(row.projectActualMinutes)),projectRequiredMinutes:Math.round(N(row.projectRequiredMinutes)),rawPercentage:Number(N(row.rawPercentage).toFixed(2)),displayedPercentage:Number(N(row.displayedPercentage).toFixed(2)),overtimeMinutes:Math.round(N(row.overtimeMinutes))}));
  }

  async function loadMonthlyTimes(monthValue,filters,options={}){
    const m=S(monthValue)||selectedMonth();
    const filterState=filters||selectedFilters();
    const loadKey=m;
    if((options.filterOnly||(!options.force&&currentMonthLoaded===m))&&currentRawRows.length){
      const requestId=latestRequestId;
      currentVisibleRows=filterRows(currentRawRows,filterState);
      await renderRows(currentVisibleRows,requestId,{renderDurationMs:0});
      window.tasneefMonthlyCleanV403Rows=currentVisibleRows;
      return currentVisibleRows;
    }
    if(activeLoadKey===loadKey&&activeController&&!activeController.signal.aborted&&!options.force)return null;
    if(activeController)activeController.abort();
    const controller=new AbortController();activeController=controller;activeLoadKey=loadKey;
    const requestId=++latestRequestId;
    const totalStarted=nowMs();
    const stats={selectedMonth:m,requestId,networkRequestsCount:0,rawRecordsCount:0,uniqueRecordsCount:0,supervisorsCount:0,dailyVisitProjectsCount:0,fullTimeProjectsCount:0,dataFetchDurationMs:0,calculationDurationMs:0,renderDurationMs:0,totalDurationMs:0};
    setLoadingUi(true,'جاري تحميل بيانات الشهر '+m+'…');
    try{
      const client=sb();if(!client)throw new Error('الاتصال بقاعدة البيانات غير جاهز');
      const fetchStarted=nowMs();
      const [staticData,monthData]=await Promise.all([
        loadStaticData(client,controller.signal,!!options.forceStatic,stats),
        loadMonthData(client,m,controller.signal,stats)
      ]);
      stats.dataFetchDurationMs=Math.round(nowMs()-fetchStarted);
      if(requestId!==latestRequestId||controller.signal.aborted)return null;
      const rows=buildMonthlyTimesReport({...staticData,...monthData},m,stats);
      if(requestId!==latestRequestId||controller.signal.aborted)return null;
      currentMonthLoaded=m;currentRawRows=rows;fillFilters(rows);
      const effectiveFilters=selectedFilters();
      currentVisibleRows=filterRows(rows,effectiveFilters);
      await renderRows(currentVisibleRows,requestId,stats);
      if(requestId!==latestRequestId||controller.signal.aborted)return null;
      window.tasneefMonthlyCleanV403Rows=currentVisibleRows;
      stats.totalDurationMs=Math.round(nowMs()-totalStarted);
      logDiagnostics(stats,rows);
      setLoadingUi(false,`تم تحميل ${rows.length} مشروعًا من شهر ${m} دون تداخل مع أي شهر آخر.`);
      return currentVisibleRows;
    }catch(e){
      if(isAbortError(e)||controller.signal.aborted){if(requestId===latestRequestId)setLoadingUi(false,'تم إلغاء الطلب السابق وتحميل الشهر الأحدث.');return null;}
      console.error(BUILD,e);
      if(requestId===latestRequestId)setLoadingUi(false,'تعذر تحميل بيانات الشهر من السيرفر: '+S(e?.message||e));
      return null;
    }finally{
      if(requestId===latestRequestId){activeLoadKey='';activeController=null;setLoadingUi(false);}
    }
  }

  function scheduleMonthLoad(force=false){
    clearTimeout(debounceTimer);
    debounceTimer=setTimeout(()=>loadMonthlyTimes(selectedMonth(),selectedFilters(),{force,forceStatic:force}),90);
  }
  async function applyFiltersOnly(){
    if(!currentRawRows.length||currentMonthLoaded!==selectedMonth())return scheduleMonthLoad(false);
    const requestId=latestRequestId;
    currentVisibleRows=filterRows(currentRawRows,selectedFilters());
    await renderRows(currentVisibleRows,requestId,{renderDurationMs:0});
    window.tasneefMonthlyCleanV403Rows=currentVisibleRows;
  }

  function printReport(){
    const rows=currentVisibleRows||[];
    if(!rows.length){
      const message=$('mc401Message');if(message)message.textContent='لا توجد بيانات جاهزة للطباعة.';
      return;
    }
    const daily=rows.filter(r=>!isFull(r));
    const full=rows.filter(isFull);
    const total=rows.reduce((s,r)=>s+N(r.totalMinutes),0);
    const groups=new Map();
    daily.forEach(r=>{const k=r.supervisorName||'-';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);});
    const logo=document.querySelector('img[src*="tasneef_logo_print"]')?.src||'tasneef_logo_print.png';
    const month=esc(currentMonthLoaded||selectedMonth());
    const printCss=`
      @page{size:A4 landscape;margin:7mm}
      *{box-sizing:border-box}
      html,body{margin:0;padding:0;background:#fff;color:#102b23}
      body{font-family:Tahoma,Arial,sans-serif;direction:rtl;font-size:10px;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .print-head{display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#0A4033,#13634f);color:#fff;padding:12px 16px;border-radius:12px;margin-bottom:9px}
      .print-brand{display:flex;align-items:center;gap:10px}.print-head img{width:62px;height:62px;object-fit:contain;background:#fff;border-radius:10px;padding:4px}.print-head h1{margin:0 0 4px;font-size:23px}.print-head p{margin:0;opacity:.9}.print-date{text-align:left;line-height:1.7}
      .print-kpis{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:7px;margin:8px 0 10px}
      .print-kpi{border:1px solid #cfe2dc;border-top:4px solid #0A4033;border-radius:10px;padding:7px;text-align:center;background:#f9fcfb;min-height:58px;display:flex;flex-direction:column;justify-content:center}
      .print-kpi span{display:block;color:#62746d;font-size:9px}.print-kpi b{display:block;color:#0A4033;font-size:15px;margin-top:3px}
      .section-title{background:#edf7f3;border-right:5px solid #0A4033;border-radius:7px;padding:6px 10px;color:#0A4033;margin:10px 0 6px;font-size:14px}
      .mc406-daily-card{border:1px solid #aecbc0;border-radius:9px;padding:7px;margin:6px 0;background:#fff;break-inside:avoid-page;page-break-inside:avoid}
      .mc406-daily-head{display:flex!important;justify-content:space-between;gap:6px;align-items:center;border-bottom:1px solid #dce6e2;padding-bottom:5px;margin-bottom:5px}
      .mc406-daily-head h3{margin:0;color:#0A4033;font-size:13px}.mc406-mini{display:flex!important;gap:4px;flex-wrap:wrap}
      .mc406-mini span{background:#eef8f5;border:1px solid #cfe2dc;border-radius:999px;padding:3px 6px;font-weight:700;font-size:8px}
      .mc406-table{display:table!important;width:100%;border-collapse:collapse;table-layout:fixed}.mc406-table thead{display:table-header-group!important}.mc406-table th{background:#0A4033;color:#fff}
      .mc406-table th,.mc406-table td{padding:4px;border:1px solid #e2ebe7;text-align:right;font-size:8px;vertical-align:middle}.mc406-table tr{break-inside:avoid}
      .mc406-progress,.mc401-bar{height:5px;background:#e5efeb;border-radius:999px;overflow:hidden;margin-top:2px}.mc406-progress i,.mc401-bar i{display:block;height:100%;background:#16865a}
      .mc406-workers,.mc401-workers{margin-top:4px;line-height:1.5}.mc406-pill,.mc401-pill{display:inline-block;background:#eef8f5;border:1px solid #d5e9e2;border-radius:999px;padding:2px 5px;margin:1px;font-size:7px;font-weight:700;color:#0A4033}
      .mc401-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px;align-items:start}
      .mc401-card{display:block!important;background:#fff;border:1px solid #aecbc0;border-top:4px solid #16865a;border-radius:9px;padding:7px;break-inside:avoid-page;page-break-inside:avoid;min-height:0}
      .mc401-card h3{margin:0 0 5px;text-align:center;color:#0A4033;font-size:12px}.mc401-row{display:grid!important;grid-template-columns:.9fr 1.1fr;gap:4px;border-top:1px solid #e7efec;padding:3px 0;align-items:center;font-size:8px}.mc401-row span{color:#65746f}.mc401-row b{color:#061f18}
      .print-footer{margin-top:8px;padding-top:6px;border-top:1px solid #d7e4df;text-align:center;color:#67766f;font-size:8px}
      @media print{.print-kpis{display:grid!important}.mc401-grid{display:grid!important}.mc406-daily-head,.mc406-mini{display:flex!important}.mc406-table{display:table!important}.mc406-table thead{display:table-header-group!important}}
    `;
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية ${month}</title><style>${printCss}</style></head><body><header class="print-head"><div class="print-brand"><img src="${logo}" alt="شركة تصنيف"><div><h1>تقرير الأوقات الشهرية</h1><p>شركة تصنيف لإدارة المرافق والتشغيل</p></div></div><div class="print-date"><b>الشهر: ${month}</b><br><span>تاريخ الطباعة: ${esc(new Date().toLocaleDateString('ar-SA'))}</span></div></header><section class="print-kpis"><div class="print-kpi"><span>إجمالي المشاريع</span><b>${rows.length}</b></div><div class="print-kpi"><span>مشاريع الزيارة اليومية</span><b>${daily.length}</b></div><div class="print-kpi"><span>المشاريع الدائمة</span><b>${full.length}</b></div><div class="print-kpi"><span>إجمالي الوقت الفعلي</span><b>${esc(minsText(total))}</b></div><div class="print-kpi"><span>مصدر البيانات</span><b>السيرفر المباشر</b></div></section><h2 class="section-title">مشاريع الزيارة اليومية</h2>${[...groups.entries()].map(([s,list])=>dailyBox(s,list)).join('')||'<p>لا توجد مشاريع زيارة يومية.</p>'}<h2 class="section-title">المشاريع الدائمة — النسبة المعتمدة 100%</h2><div class="mc401-grid">${full.map(fullCard).join('')||'<p>لا توجد مشاريع دائمة.</p>'}</div><footer class="print-footer">تم إنشاء هذا التقرير من نظام شركة تصنيف لإدارة المرافق، ويعتبر معتمدًا ما لم يرد خلاف ذلك.</footer></body></html>`;
    const win=window.open('','_blank');
    if(!win){const message=$('mc401Message');if(message)message.textContent='اسمح بالنوافذ المنبثقة حتى تعمل الطباعة.';return;}
    win.document.open();win.document.write(html);win.document.close();
    const trigger=()=>{try{win.focus();win.print();}catch(e){console.error(BUILD,'print',e);}};
    if(win.document.readyState==='complete')setTimeout(trigger,500);
    else win.addEventListener('load',()=>setTimeout(trigger,250),{once:true});
  }
  function exportCsv(){
    const rows=currentVisibleRows||[];
    const lines=[['month','supervisor','project','type','workers','actual_minutes','required_minutes','displayed_percentage','raw_percentage','overtime_minutes'].join(',')].concat(rows.map(r=>[currentMonthLoaded||selectedMonth(),r.supervisorName,r.projectName,r.projectType,(r.workers||[]).join(' | '),Math.round(N(r.totalMinutes)),Math.round(N(r.requiredMinutes)),pct(r.percentage),N(r.rawPercentage),Math.round(N(r.overtimeMinutes))].map(v=>`"${S(v).replace(/"/g,'""')}"`).join(',')));
    const anchor=document.createElement('a');anchor.href=URL.createObjectURL(new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}));anchor.download='monthly_times_'+(currentMonthLoaded||selectedMonth())+'_v10801.csv';anchor.click();setTimeout(()=>URL.revokeObjectURL(anchor.href),1200);
  }

  function bind(){
    ensureCss();document.querySelectorAll('.mc401-badge').forEach(el=>el.textContent='V10801');
    const monthInput=$('mc401Month');if(monthInput&&!monthInput.dataset.monthlyV10801){monthInput.dataset.monthlyV10801='1';monthInput.addEventListener('change',e=>{e.stopPropagation();scheduleMonthLoad(false);});}
    const show=$('mc401Show');if(show&&!show.dataset.monthlyV10801){show.dataset.monthlyV10801='1';show.addEventListener('click',()=>scheduleMonthLoad(true));}
    const sup=$('mc401Supervisor');if(sup&&!sup.dataset.monthlyV10801){sup.dataset.monthlyV10801='1';sup.addEventListener('change',applyFiltersOnly);}
    const type=$('mc401Type');if(type&&!type.dataset.monthlyV10801){type.dataset.monthlyV10801='1';type.addEventListener('change',applyFiltersOnly);}
    const print=$('mc401Print');if(print&&!print.dataset.monthlyV10801){print.dataset.monthlyV10801='1';print.addEventListener('click',printReport);}
    const csv=$('mc401Export');if(csv&&!csv.dataset.monthlyV10801){csv.dataset.monthlyV10801='1';csv.addEventListener('click',exportCsv);}
  }

  const api={
    render:(force=false)=>loadMonthlyTimes(selectedMonth(),selectedFilters(),{force,forceStatic:force}),
    loadMonthlyTimes,
    print:printReport,
    export:exportCsv,
    buildMonthlyTimesReport,
    calculateFullTimeMetrics,
    fullDisplayPercentage,
    dateMath:{monthRange,addDaysIso,utcWeekday},
    cancel:()=>activeController?.abort()
  };
  window.tasneefMonthlyCleanV403=api;
  window.renderMonthly=()=>api.render(false);
  window.__tasneefMonthlyUnifiedOnlyV10801=true;

  document.addEventListener('DOMContentLoaded',()=>{bind();setTimeout(()=>scheduleMonthLoad(false),450);});
})();

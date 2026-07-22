/* ===== TASNEEF V10812 - Supervisor recovery + editable formula payroll Excel ===== */
(function(){
  'use strict';
  if(window.__tasneefUnifiedEmployeePayrollFormulaV10812) return;
  window.__tasneefUnifiedEmployeePayrollFormulaV10812 = true;

  const VERSION='V10812';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const N=v=>Number(String(v??'').replace(/,/g,''))||0;
  const A=v=>Array.isArray(v)?v:[];
  const norm=v=>S(v).toLowerCase().replace(/[إأآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sbClient=()=>window.sb||window.supabaseClient||null;
  const showMsg=(text,err)=>{const el=$('cu413Msg');if(el){el.textContent=text;el.className='cu413-msg '+(err?'err':'');}else{try{if(typeof window.msg==='function')window.msg(text,err?'err':'ok');}catch(_){}}};

  function riyadhToday(){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}catch(_){return new Date().toISOString().slice(0,10);}}
  function todayMonth(){return riyadhToday().slice(0,7);}
  function monthBounds(m){const start=S(m||todayMonth())+'-01';const d=new Date(start+'T00:00:00');d.setMonth(d.getMonth()+1);const next=d.toISOString().slice(0,10);const end=new Date(Date.parse(next+'T00:00:00')-86400000).toISOString().slice(0,10);return{start,next,end};}
  function reportPeriod(m){const b=monthBounds(m),today=riyadhToday();let cutoff=b.end;if(today<b.start)cutoff='';else if(today<b.end)cutoff=today;return{...b,cutoff};}
  function dateDaysInclusive(start,end){if(!start||!end||end<start)return 0;const a=Date.parse(start+'T12:00:00'),z=Date.parse(end+'T12:00:00');return Number.isFinite(a)&&Number.isFinite(z)?Math.floor((z-a)/86400000)+1:0;}
  function dateOnly(v){return S(v).slice(0,10);}
  function timeText(v){const x=S(v);if(!x)return'';if(/^\d{2}:\d{2}/.test(x))return x.slice(0,5);if(/^\d{4}-\d{2}-\d{2}T/.test(x)&&/(Z|[+-]\d{2}:?\d{2})$/i.test(x)){const d=new Date(x);if(!Number.isNaN(d.getTime()))return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);}const m=x.match(/T(\d{2}:\d{2})/);return m?m[1]:x.slice(0,16).replace('T',' ');}
  function dateTimeLabel(date,val){const t=timeText(val);return date?(date+(t?' '+t:'')):(t||'');}
  function normalizeCode(v){const raw=S(v).toUpperCase().replace(/\s+/g,'').replace(/_/g,'-');const m=raw.match(/TS-?(\d+)/i);return m?'TS-'+String(Number(m[1])).padStart(2,'0'):raw;}
  function statusDeleted(x){const s=norm(x?.status||x?.state||'');return !!(x?.deleted_at||x?.is_deleted===true||['deleted','محذوف','ملغي','archived'].includes(s));}
  function isActiveStatus(x){const s=norm(x?.status||x?.state||'active');return !(x?.is_active===false||['inactive','stopped','stop','disabled','deleted','ended','موقوف','متوقف','محذوف','منتهي','غير نشط','غيرنشط'].includes(s));}

  function workerCode(w){return normalizeCode(w?.worker_code||w?.employee_code||w?.code||w?.emp_code||w?.worker_employee_code||w?.employee_number||w?.employee_ts_id||w?.id||'');}
  function workerName(w){return S(w?.worker_name||w?.app_name||w?.name||w?.full_name||w?.iqama_name||w?.employee_name||w?.display_name||workerCode(w));}
  function workerIqamaName(w){return S(w?.iqama_name||w?.residency_name||w?.official_name||'');}
  function workerIqamaNo(w){return S(w?.iqama_number||w?.residency_number||w?.national_id||w?.id_number||'');}
  function workerRoleFields(w){return [w?.job_title,w?.role_type,w?.position,w?.job,w?.profession,w?.role,w?.category,w?.worker_role,w?.worker_type,w?.employee_type,w?.job_type,w?.job_name,w?.title,w?.system_role,w?.user_role,w?.designation].map(S).filter(Boolean);}
  function workerRole(w){return workerRoleFields(w)[0]||'عامل';}
  function workerRoleText(w){return workerRoleFields(w).join(' | ')||'عامل';}
  function workerStartDate(w){return dateOnly(w?.work_start_date||w?.start_date||w?.join_date||w?.employment_start_date||w?.hiring_date||w?.created_at||'');}
  function workerEndDate(w){return dateOnly(w?.work_end_date||w?.end_date||w?.termination_date||w?.employment_end_date||'');}
  function workerBasicSalary(w){return N(w?.basic_salary||w?.salary_basic||w?.salary||w?.base_salary);}
  function workerAllowances(w){return N(w?.allowances||w?.housing_allowance||0)+N(w?.transport_allowance||0)+N(w?.food_allowance||0)+N(w?.other_allowances||0);}
  function workerTotalSalary(w){const direct=N(w?.total_salary||w?.salary_total||w?.net_salary);return direct||(workerBasicSalary(w)+workerAllowances(w));}
  function isSupervisor(w){const r=norm(workerRoleText(w));return r.includes('مشرف')||r.includes('supervisor');}
  function roleGroup(w){const r=norm(workerRoleText(w));if(r.includes('مشرف')||r.includes('supervisor'))return'supervisor';if(r.includes('فني')||r.includes('technician')||r.includes('tech'))return'technician';if(r.includes('حارس')||r.includes('امن')||r.includes('حراسه')||r.includes('حراسة')||r.includes('security')||r.includes('guard')||r.includes('watchman'))return'guard';if(r.includes('موظف')||r.includes('اداري')||r.includes('employee')||r.includes('admin'))return'employee';return'worker';}
  function roleLabel(g){return({supervisor:'مشرف',worker:'عامل',technician:'فني',guard:'حارس',employee:'موظف'})[g]||'موظف';}
  function employeeServiceRange(w,m){const p=reportPeriod(m);if(!p.cutoff)return{start:p.start,end:'',days:0};const start=[p.start,workerStartDate(w)].filter(Boolean).sort().pop()||p.start;const rawEnd=workerEndDate(w);const ends=[p.cutoff,rawEnd].filter(Boolean).sort();const end=ends[0]||'';return{start,end,days:dateDaysInclusive(start,end)};}
  function workerOverlapsMonth(w,m){const b=monthBounds(m),st=workerStartDate(w)||'1900-01-01',en=workerEndDate(w)||'9999-12-31';return st<b.next&&en>=b.start;}

  function employeeNameVariants(v){const raw=S(v);if(!raw)return[];const out=[];const add=x=>{x=S(x);if(x)out.push(x);};add(raw);add(raw.replace(/^TS[-_\s]?\d+\s*[-–—:|]?\s*/i,''));add(raw.replace(/\(.*?\)/g,' ').replace(/\s+/g,' ').trim());[...raw.matchAll(/[\(（]+([^\)）]+)[\)）]+/g)].forEach(m=>add(m[1]));raw.split(/[\/|،,–—]+/).forEach(add);return[...new Set(out.map(S).filter(Boolean))];}
  function employeeIdentityAliases(x){const out=[];const add=(kind,v)=>{v=S(v);if(!v)return;const k=kind+':'+norm(v);if(!out.includes(k))out.push(k);};[x?.worker_employee_code,x?.worker_code,x?.employee_code,x?.employee_ts_id,x?.code,x?.emp_code].forEach(v=>{const c=normalizeCode(v);if(c)add('code',c);});[x?.canonical_employee_id,x?.canonical_worker_id,x?.employee_id,x?.worker_id,x?.staff_id,x?.person_id,x?.user_id,x?.id].forEach(v=>add('id',v));[x?.worker_name,x?.worker_display_name,x?.worker_identity,x?.app_name,x?.display_name,x?.name,x?.full_name,x?.employee_name,x?.iqama_name,x?.residency_name].forEach(v=>employeeNameVariants(v).forEach(n=>add('name',n)));return out;}
  function canonicalEmployeeKey(w){const aliases=employeeIdentityAliases(w);return aliases.find(x=>x.startsWith('code:'))||aliases.find(x=>x.startsWith('id:'))||aliases.find(x=>x.startsWith('name:'))||'';}
  function buildEmployeeAliasIndex(workers){const aliasToKey=new Map(),employeeByKey=new Map();A(workers).forEach(w=>{const key=canonicalEmployeeKey(w);if(!key)return;employeeByKey.set(key,w);employeeIdentityAliases(w).forEach(a=>{if(!aliasToKey.has(a)||a.startsWith('code:'))aliasToKey.set(a,key);});});return{aliasToKey,employeeByKey};}
  function resolveEmployeeKey(record,index){const aliases=employeeIdentityAliases(record),priorities=['code:','id:','name:'];for(const p of priorities)for(const a of aliases)if(a.startsWith(p)&&index.aliasToKey.has(a))return index.aliasToKey.get(a);return'';}

  function mergeWorkers(master,legacy){const map=new Map(),nameIndex=new Map();function merge(a,b){const out={...(a||{})};Object.keys(b||{}).forEach(k=>{const v=b[k];if(v!==undefined&&v!==null&&S(v)!=='')out[k]=v;});return out;}function put(w,priority){const code=workerCode(w),n=norm(workerName(w));if(!code&&!n)return;let key=code||nameIndex.get(n)||('name:'+n);if(code&&nameIndex.has(n)&&nameIndex.get(n)!==code){const oldKey=nameIndex.get(n),old=map.get(oldKey);if(old){map.delete(oldKey);w=merge(old,w);}key=code;}const old=map.get(key);const merged=(!old||priority>=(old.__priority||0))?merge(old,w):merge(w,old);merged.__priority=Math.max(priority,old?.__priority||0);if(code)merged.employee_code=code;map.set(key,merged);if(n)nameIndex.set(n,code||key);}A(legacy).forEach(w=>put(w,1));A(master).forEach(w=>put(w,2));return[...map.values()].filter(w=>!statusDeleted(w));}

  function attendanceStatus(v){const x=norm(v);if(['absent','غائب','غياب','غ','a'].includes(x))return'absent';if(['late','متاخر','متأخر'].includes(x))return'late';if(['early_leave','خروج مبكر','انصراف مبكر'].includes(x))return'early_leave';if(['present','حاضر','حضور','ح','p'].includes(x))return'present';if(['leave','اجازه','إجازه','اجازة','إجازة'].includes(x))return'leave';if(['sick','مرضي','مرضى','اجازه مرضيه','إجازة مرضية'].includes(x))return'sick';if(['mission','ماموريه','مأمورية'].includes(x))return'mission';if(['weekly_off','راحه اسبوعيه','راحة أسبوعية','off'].includes(x))return'weekly_off';return x||'';}
  function attendanceDateOf(a){return S(a?.attendance_date||a?.work_date||a?.record_date||a?.log_date||a?.date||a?.check_in||a?.created_at||'').slice(0,10);}
  function attendanceInOf(a){return S(a?.check_in_time||a?.check_in||a?.in_time||a?.start_time||a?.login_time||'');}
  function attendanceOutOf(a){return S(a?.check_out_time||a?.check_out||a?.out_time||a?.end_time||a?.logout_time||'');}
  function attendanceStamp(a){const raw=S(a?.updated_at||a?.created_at||a?.attendance_date||'');const ms=Date.parse(raw);return Number.isFinite(ms)?ms:N(a?.id);}
  function attendanceIgnored(a){const s=norm(a?.status||a?.attendance_status||a?.state||'');return !!(a?.deleted_at||a?.is_deleted===true||a?.is_cancelled===true||['cancelled','canceled','rejected','failed','deleted','ملغي','مرفوض','محذوف','غير معتمد'].includes(s));}
  function attendanceMoment(date,val,fallback){const x=S(val);if(!x)return fallback||0;let ms=Date.parse(x);if(Number.isFinite(ms))return ms;const t=timeText(x);ms=Date.parse(date+'T'+(t||'00:00')+':00');return Number.isFinite(ms)?ms:(fallback||0);}
  function mergeAttendanceDay(records,date){const rows=A(records).filter(a=>!attendanceIgnored(a)).sort((a,b)=>attendanceStamp(a)-attendanceStamp(b));const latest=rows[rows.length-1]||{};const statuses=rows.map(a=>attendanceStatus(a.status||a.attendance_status||a.state));let status=attendanceStatus(latest.status||latest.attendance_status||latest.state);if(!status&&rows.some(a=>attendanceInOf(a)||attendanceOutOf(a)))status='present';const ins=rows.filter(a=>attendanceInOf(a)).map(a=>({v:attendanceInOf(a),ms:attendanceMoment(date,attendanceInOf(a),attendanceStamp(a))})).sort((a,b)=>a.ms-b.ms);const outs=rows.filter(a=>attendanceOutOf(a)).map(a=>({v:attendanceOutOf(a),ms:attendanceMoment(date,attendanceOutOf(a),attendanceStamp(a))})).sort((a,b)=>a.ms-b.ms);return{date,status,firstIn:ins[0]?.v||'',lastOut:outs[outs.length-1]?.v||'',conflict:(statuses.some(s=>['present','late','early_leave'].includes(s))||rows.some(a=>attendanceInOf(a)||attendanceOutOf(a)))&&statuses.includes('absent')};}
  function buildAttendanceStats(rows,index,month){const p=reportPeriod(month),grouped=new Map();let unresolved=0,ignored=0;A(rows).forEach(a=>{if(attendanceIgnored(a)){ignored++;return;}const date=attendanceDateOf(a);if(!date||date<p.start||date>=p.next||(p.cutoff&&date>p.cutoff))return;const key=resolveEmployeeKey(a,index);if(!key){unresolved++;return;}if(!grouped.has(key))grouped.set(key,new Map());const dm=grouped.get(key);if(!dm.has(date))dm.set(date,[]);dm.get(date).push(a);});const result=new Map();grouped.forEach((dm,key)=>{const days=[...dm.entries()].map(([d,r])=>mergeAttendanceDay(r,d)).sort((a,b)=>a.date.localeCompare(b.date));const counts={present:0,absent:0,leave:0,sick:0,mission:0,weeklyOff:0,late:0,earlyLeave:0,other:0,recorded:0,conflicts:0};const dayMap=new Map(),ins=[],outs=[];days.forEach(d=>{dayMap.set(d.date,d);if(d.status){counts.recorded++;if(['present','late','early_leave'].includes(d.status)){counts.present++;if(d.status==='late')counts.late++;if(d.status==='early_leave')counts.earlyLeave++;}else if(d.status==='absent')counts.absent++;else if(d.status==='leave')counts.leave++;else if(d.status==='sick')counts.sick++;else if(d.status==='mission')counts.mission++;else if(d.status==='weekly_off')counts.weeklyOff++;else counts.other++;}if(d.conflict)counts.conflicts++;if(['present','late','early_leave'].includes(d.status)){if(d.firstIn)ins.push({date:d.date,v:d.firstIn,ms:attendanceMoment(d.date,d.firstIn)});if(d.lastOut)outs.push({date:d.date,v:d.lastOut,ms:attendanceMoment(d.date,d.lastOut)});}});ins.sort((a,b)=>a.ms-b.ms);outs.sort((a,b)=>a.ms-b.ms);const worked=days.filter(d=>['present','late','early_leave'].includes(d.status));const firstWorked=worked[0]||null,lastWorked=worked[worked.length-1]||null;result.set(key,{...counts,days:dayMap,firstIn:firstWorked?dateTimeLabel(firstWorked.date,firstWorked.firstIn):'',lastOut:lastWorked?dateTimeLabel(lastWorked.date,lastWorked.lastOut):'',firstAttendanceDate:firstWorked?.date||'',lastAttendanceDate:lastWorked?.date||''});});result.meta={unresolved,ignored};return result;}

  function projectId(p){return S(p?.project_id||p?.id||p?.code||'');}
  function projectName(p){return S(p?.project_name||p?.name||p?.title||projectId(p));}
  function projectTypeRaw(x){return S(x?.operation_type||x?.project_type||x?.work_type||x?.type||x?.contract_type||x?.service_type||'');}
  function isFullTimeProject(x){const t=norm(projectTypeRaw(x));return t.includes('دوام')||t.includes('كامل')||t.includes('دائم')||t.includes('full')||t.includes('permanent')||t==='full time';}
  function assignmentOverlapDays(r,month){const p=reportPeriod(month);if(!p.cutoff)return 0;const st=[p.start,S(r?.start_date||r?.assignment_start||'')].filter(Boolean).sort().pop();const ends=[p.cutoff,S(r?.end_date||r?.assignment_end||'')].filter(Boolean).sort();return dateDaysInclusive(st,ends[0]);}
  function supervisorIdentity(r,workers){const code=normalizeCode(r?.supervisor_employee_code||r?.supervisor_code||'');const name=S(r?.supervisor_name||r?.supervisor_display_name||'');const sw=A(workers).find(w=>(code&&workerCode(w)===code)||(name&&norm(workerName(w))===norm(name)));const resolvedCode=code||workerCode(sw),resolvedName=name||workerName(sw)||'بدون مشرف';return{key:resolvedCode?('code:'+norm(resolvedCode)):(resolvedName!=='بدون مشرف'?'name:'+norm(resolvedName):'unassigned'),code:resolvedCode,name:resolvedName};}
  function findSupervisorWorker(g,workers){const code=normalizeCode(g?.code||'');if(code){const byCode=A(workers).find(w=>workerCode(w)===code);if(byCode)return byCode;}const targetNames=[...new Set(employeeNameVariants(g?.name||'').map(norm).filter(Boolean))];if(!targetNames.length)return null;return A(workers).find(w=>{const names=[...employeeNameVariants(workerName(w)),...employeeNameVariants(workerIqamaName(w))].map(norm).filter(Boolean);return names.some(n=>targetNames.includes(n)||targetNames.some(t=>t.length>=4&&(n.includes(t)||t.includes(n))));})||null;}
  function projectInfoFromAssignment(r,projectMap){const pid=S(r?.project_id||r?.project_code||''),p=projectMap.get(pid)||projectMap.get('name:'+norm(S(r?.project_name||r?.project_display_name||'')))||{};const name=S(r?.project_name||r?.project_display_name||projectName(p)||'بدون مشروع');const full=isFullTimeProject(r)||isFullTimeProject(p);return{id:pid,name,full,type:full?'دوام كامل':'زيارة يومية'};}

  async function fetchPagedRows(table,configure){const c=sbClient();if(!c)throw new Error('الاتصال بقاعدة البيانات غير جاهز.');const out=[];let start=0;const size=1000;while(start<100000){let q=c.from(table).select('*');q=configure?q=configure(q):q;q=q.range(start,start+size-1);const r=await q;if(r.error)throw r.error;const rows=r.data||[];out.push(...rows);if(rows.length<size)break;start+=size;}return out;}
  async function safeFetch(table,configure){try{return await fetchPagedRows(table,configure);}catch(e){console.warn(VERSION,table,e);return[];}}
  function hasField(o,k){return !!o&&o[k]!==undefined&&o[k]!==null&&S(o[k])!=='';}
  async function loadPayrollMap(month,index){
    const out=new Map(),c=sbClient();
    if(!c?.rpc)return out;
    try{
      const res=await c.rpc('get_unified_payroll_from_server',{p_month:month});
      if(res.error)throw res.error;
      const rows=A(res.data?.rows);
      rows.forEach(r=>{const key=resolveEmployeeKey({worker_id:r.worker_id,canonical_employee_id:r.canonical_employee_id,employee_id:r.employee_id,employee_code:r.employee_code,worker_code:r.worker_code,worker_name:r.worker_name,employee_name:r.employee_name,residency_name:r.residency_name,iqama_name:r.iqama_name,iqama_number:r.iqama_number},index);if(key&&!out.has(key))out.set(key,r);});
    }catch(e){console.warn(VERSION,'payroll RPC fallback',e);}
    return out;
  }
  function financialSnapshot(w,key,payrollMap,service,month,attendanceAbsent){
    const p=payrollMap.get(key)||{},daysInMonth=Number(monthBounds(month).end.slice(-2))||30;
    const basic=hasField(p,'base_salary')?N(p.base_salary):workerBasicSalary(w);
    const allowances=hasField(p,'allowances')?N(p.allowances):workerAllowances(w);
    const gross=hasField(p,'gross_salary')?N(p.gross_salary):(basic+allowances);
    const periodSalary=hasField(p,'period_salary')?N(p.period_salary):Math.round((gross/daysInMonth*Math.max(0,service.days))*100)/100;
    const commissions=hasField(p,'commissions')?N(p.commissions):N(w?.commissions||w?.commission||w?.bonus);
    const deductions=hasField(p,'deductions')?N(p.deductions):N(w?.deductions||w?.other_deductions||w?.absence_deduction);
    const rounding=hasField(p,'rounding')?N(p.rounding):N(w?.rounding||w?.rounding_adjustment);
    const advances=hasField(p,'advances')?N(p.advances):N(w?.advances||w?.advance_deduction||w?.loan_deduction);
    const net=hasField(p,'net_salary')?N(p.net_salary):Math.round((periodSalary+commissions+rounding-deductions-advances)*100)/100;
    const dueDays=hasField(p,'due_days')?N(p.due_days):Math.max(0,service.days-N(attendanceAbsent));
    const notes=S(p.notes||A(p.issues).join('، ')||w?.notes||'');
    return{basic,allowances,gross,periodSalary,commissions,deductions,rounding,advances,net,dueDays,notes,payrollRow:p};
  }

  function currentFilters(){return{month:S($('cu413WorkerExportMonth')?.value||todayMonth()).slice(0,7),search:S($('cu413WorkerSearch')?.value||''),role:S($('cu413WorkerRoleFilter')?.value||''),status:S($('cu413WorkerStatusFilter')?.value||''),roleLabel:S($('cu413WorkerRoleFilter')?.selectedOptions?.[0]?.textContent||'كل الفئات'),statusLabel:S($('cu413WorkerStatusFilter')?.selectedOptions?.[0]?.textContent||'كل الحالات')};}
  function sourceMatchesExactFilter(w,f){if(f.role&&roleGroup(w)!==f.role)return false;const active=isActiveStatus(w);if(f.status==='active'&&!active)return false;if(f.status==='inactive'&&active)return false;const q=norm(f.search);if(q){const bag=norm([workerCode(w),workerName(w),workerIqamaName(w),workerIqamaNo(w),workerRoleText(w),w?.status,w?.state,w?.active_status].join(' '));if(!bag.includes(q))return false;}return true;}
  function detailMatchesExactFilter(x,f){if(f.role&&x.roleGroup!==f.role)return false;const active=x.status!=='موقوف';if(f.status==='active'&&!active)return false;if(f.status==='inactive'&&active)return false;const q=norm(f.search);if(q){const bag=norm([x.code,x.name,x.iqamaName,x.iqamaNumber,x.roleLabel,x.status].join(' '));if(!bag.includes(q))return false;}return true;}
  function filterSummary(f){return [f.roleLabel||'كل الفئات',f.statusLabel||'كل الحالات',f.search?('بحث: '+f.search):''].filter(Boolean).join(' | ');}

  async function loadExcelJs(){
    if(window.ExcelJS)return window.ExcelJS;
    return await new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-tasneef-exceljs-v10812="1"]');
      if(existing){existing.addEventListener('load',()=>window.ExcelJS?resolve(window.ExcelJS):reject(new Error('تعذر تحميل مكتبة تنسيق Excel.')),{once:true});existing.addEventListener('error',()=>reject(new Error('تعذر تحميل مكتبة تنسيق Excel.')),{once:true});return;}
      const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';s.async=true;s.dataset.tasneefExceljsV10812='1';s.onload=()=>window.ExcelJS?resolve(window.ExcelJS):reject(new Error('تعذر تحميل مكتبة تنسيق Excel.'));s.onerror=()=>reject(new Error('تعذر تحميل مكتبة تنسيق Excel.'));document.head.appendChild(s);
    });
  }
  const ARGB=x=>'FF'+x;
  const BORDER_COLOR='B8D6CD';
  function excelBorder(){return{top:{style:'thin',color:{argb:ARGB(BORDER_COLOR)}},left:{style:'thin',color:{argb:ARGB(BORDER_COLOR)}},bottom:{style:'thin',color:{argb:ARGB(BORDER_COLOR)}},right:{style:'thin',color:{argb:ARGB(BORDER_COLOR)}}};}
  function styleMainCell(cell,opt={}){cell.font={name:'Calibri',size:opt.size||11,bold:!!opt.bold,color:{argb:ARGB(opt.fontColor||'111111')}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:ARGB(opt.fill||'F4FAF7')}};cell.alignment={horizontal:'center',vertical:'middle',wrapText:opt.wrap!==false,readingOrder:'rtl'};cell.border=excelBorder();if(opt.numFmt)cell.numFmt=opt.numFmt;}
  function addStyledSheetHeader(ws,lastCol,title,subtitle){ws.mergeCells(`A1:${lastCol}1`);ws.getCell('A1').value=title;ws.getRow(1).height=31;ws.getCell('A1').font={name:'Calibri',size:22,bold:true,color:{argb:ARGB('0B5D49')}};ws.getCell('A1').alignment={horizontal:'center',vertical:'middle',readingOrder:'rtl'};ws.mergeCells(`A2:${lastCol}2`);ws.getCell('A2').value=subtitle;ws.getRow(2).height=24;ws.getCell('A2').font={name:'Calibri',size:13,bold:true,color:{argb:ARGB('111111')}};ws.getCell('A2').alignment={horizontal:'center',vertical:'middle',readingOrder:'rtl'};}
  function addMainPayrollSheet(wb,month,details,filters){
    const ws=wb.addWorksheet('كشف الرواتب',{views:[{rightToLeft:true,state:'frozen',ySplit:3,activeCell:'A4'}],pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9,margins:{left:.2,right:.2,top:.35,bottom:.35,header:.15,footer:.15}}});
    const headers=['رقم','أيدي الموظف','الشهر','اسم الموظف في الإقامة','اسم الموظف الحركي','رقم الإقامة','مكان العمل','الوظيفة','بداية الدوام','نهاية الدوام','أيام الحضور','أيام الغياب','الأيام المستحقة','قيمة الرواتب الأساسية','البدلات','الإجمالي','إجمالي الراتب على أيام الفترة','العمولات','الخصومات','جبر الكسور','خصم السلف','الصافي','ملاحظات'];
    const daysInMonth=Number(monthBounds(month).end.slice(-2))||30;
    addStyledSheetHeader(ws,'W','كشف الرواتب',`الشهر: ${month} - شركة تصنيف لإدارة المرافق - ${filterSummary(filters)}`);
    const h=ws.getRow(3);h.values=headers;h.height=34;h.eachCell(c=>{c.font={name:'Calibri',size:11,bold:true,color:{argb:ARGB('FFFFFF')}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:ARGB('0B5D49')}};c.alignment={horizontal:'center',vertical:'middle',wrapText:true,readingOrder:'rtl'};c.border=excelBorder();});
    const moneyCols=new Set([14,15,16,17,18,19,20,21,22]);
    details.forEach((x,i)=>{
      const row=ws.addRow([i+1,x.code||'',month,x.iqamaName||'',x.name||'',x.iqamaNumber||'',x.workplace||'',x.roleLabel||'',x.firstIn||'لا يوجد تسجيل',x.lastOut||'لا يوجد تسجيل',x.present,x.absent,x.dueDays,x.basic,x.allowances,x.gross,x.periodSalary,x.commissions,x.deductions,x.rounding,x.advances,x.net,x.notes||'']);
      const rn=row.number;
      row.getCell(16).value={formula:`N${rn}+O${rn}`,result:N(x.gross)};
      row.getCell(17).value={formula:`IFERROR(P${rn}/${daysInMonth}*M${rn},0)`,result:N(x.periodSalary)};
      row.getCell(22).value={formula:`Q${rn}+R${rn}-S${rn}+T${rn}-U${rn}`,result:N(x.net)};
      row.height=23;const isSup=x.roleGroup==='supervisor';row.eachCell({includeEmpty:true},(c,col)=>styleMainCell(c,{fill:isSup?'DCEFE8':(i%2?'F7FBF9':'EEF7F4'),bold:isSup,fontColor:isSup?'064C3B':'111111',numFmt:moneyCols.has(col)?'#,##0.00':([1,11,12,13].includes(col)?'0':undefined)}));
      if(N(x.absent)>0)row.getCell(12).font={name:'Calibri',size:11,bold:true,color:{argb:ARGB('C00000')}};
      if(N(x.deductions)>0)row.getCell(19).font={name:'Calibri',size:11,bold:true,color:{argb:ARGB('C00000')}};
      if(N(x.advances)>0)row.getCell(21).font={name:'Calibri',size:11,bold:true,color:{argb:ARGB('C00000')}};
    });
    const firstDataRow=4,lastDataRow=3+details.length;
    const total=ws.addRow(['الإجمالي','','','','','','','','','','','','','','','','','','','','','','']);
    ws.mergeCells(total.number,1,total.number,10);
    const formulaCols={11:'K',12:'L',13:'M',14:'N',15:'O',16:'P',17:'Q',18:'R',19:'S',20:'T',21:'U',22:'V'};
    Object.entries(formulaCols).forEach(([col,letter])=>{const result=details.reduce((a,x)=>a+N(({11:x.present,12:x.absent,13:x.dueDays,14:x.basic,15:x.allowances,16:x.gross,17:x.periodSalary,18:x.commissions,19:x.deductions,20:x.rounding,21:x.advances,22:x.net})[col]),0);total.getCell(Number(col)).value={formula:`SUM(${letter}${firstDataRow}:${letter}${lastDataRow})`,result};});
    total.height=24;total.eachCell({includeEmpty:true},(c,col)=>styleMainCell(c,{fill:'FFFFFF',bold:true,fontColor:'111111',numFmt:moneyCols.has(col)?'#,##0.00':([11,12,13].includes(col)?'0':undefined)}));total.eachCell({includeEmpty:true},c=>{c.border={top:{style:'thin',color:{argb:ARGB('111111')}}};});
    ws.columns=[6,13,11,29,23,16,25,13,21,21,12,11,13,16,12,13,21,12,12,12,12,14,28].map(width=>({width}));
    ws.autoFilter={from:'A3',to:`W${Math.max(3,total.number)}`};ws.properties.defaultRowHeight=21;ws.headerFooter.oddFooter='شركة تصنيف لإدارة المرافق';
    return ws;
  }
  function addGroupedSheet(wb,details){const ws=wb.addWorksheet('حسب المشرف والمشروع',{views:[{rightToLeft:true,state:'frozen',ySplit:1}]});const headers=['اسم المشرف','المشروع','الفئة','كود الموظف','اسم الموظف','الاسم في الإقامة','مكان العمل','بداية الدوام','نهاية الدوام','أيام الحضور','أيام الغياب','الراتب','الصافي'];ws.addRow(headers);ws.getRow(1).eachCell(c=>{c.font={name:'Calibri',size:11,bold:true,color:{argb:ARGB('FFFFFF')}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:ARGB('0B5D49')}};c.alignment={horizontal:'center',vertical:'middle',wrapText:true,readingOrder:'rtl'};c.border=excelBorder();});details.forEach((x,i)=>{const r=ws.addRow([x.supervisorName,x.primaryProject,x.roleLabel,x.code,x.name,x.iqamaName,x.workplace,x.firstIn||'لا يوجد تسجيل',x.lastOut||'لا يوجد تسجيل',x.present,x.absent,x.gross,x.net]);r.eachCell({includeEmpty:true},(c,col)=>styleMainCell(c,{fill:x.roleGroup==='supervisor'?'DCEFE8':(i%2?'F7FBF9':'EEF7F4'),bold:x.roleGroup==='supervisor',numFmt:[12,13].includes(col)?'#,##0.00':undefined}));});ws.columns=[24,28,12,13,24,29,26,21,21,12,11,14,14].map(width=>({width}));ws.autoFilter={from:'A1',to:`M${Math.max(1,ws.rowCount)}`};return ws;}
  function addDailySheet(wb,month,details){const period=reportPeriod(month),days=[];for(let d=1;d<=Number(period.end.slice(-2));d++)days.push(String(d).padStart(2,'0'));const ws=wb.addWorksheet('كشف يومي',{views:[{rightToLeft:true,state:'frozen',ySplit:1,xSplit:6}]});const headers=['اسم المشرف','المشروع','الفئة','اسم الموظف مع الكود','الاسم في الإقامة','مكان العمل',...days,'الحضور','الغياب'];ws.addRow(headers);ws.getRow(1).eachCell(c=>{c.font={name:'Calibri',size:10,bold:true,color:{argb:ARGB('FFFFFF')}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:ARGB('0B5D49')}};c.alignment={horizontal:'center',vertical:'middle',wrapText:true,readingOrder:'rtl'};c.border=excelBorder();});details.forEach((x,i)=>{const vals=[x.supervisorName,x.primaryProject,x.roleLabel,x.employeeWithCode,x.iqamaName,x.workplace];days.forEach(dd=>{const st=x.dayMap.get(month+'-'+dd)?.status||'';vals.push(st==='present'?'ح':st==='late'?'ت':st==='early_leave'?'خ':st==='absent'?'غ':st==='leave'?'إ':st==='sick'?'م':st==='mission'?'أ':st==='weekly_off'?'ر':'-');});vals.push(x.present,x.absent);const r=ws.addRow(vals);r.eachCell({includeEmpty:true},c=>styleMainCell(c,{fill:x.roleGroup==='supervisor'?'DCEFE8':(i%2?'F7FBF9':'EEF7F4'),bold:x.roleGroup==='supervisor',size:9}));});ws.columns=[24,28,12,30,29,26,...days.map(()=>4.5),10,10].map(width=>({width}));return ws;}
  async function buildWorkbook(month,details,filters,meta){const ExcelJS=await loadExcelJs();const wb=new ExcelJS.Workbook();wb.creator='شركة تصنيف لإدارة المرافق';wb.created=new Date();wb.modified=new Date();wb.views=[{rightToLeft:true}];wb.calcProperties.fullCalcOnLoad=true;wb.calcProperties.forceFullCalc=true;wb.calcProperties.calcMode='auto';addMainPayrollSheet(wb,month,details,filters);addGroupedSheet(wb,details);addDailySheet(wb,month,details);const guide=wb.addWorksheet('الدليل',{views:[{rightToLeft:true}]});guide.addRows([['دليل التقرير'],['البند','التوضيح'],['الفلاتر المطبقة',filterSummary(filters)],['بداية الدوام','أول يوم حضور فعلي في الشهر مع وقت أول دخول.'],['نهاية الدوام','آخر يوم حضور فعلي في الشهر مع وقت آخر خروج.'],['مكان العمل - زيارة يومية','اسم المشرف المسؤول.'],['مكان العمل - دوام كامل','اسم المشروع.'],['الفئات','يتم تنزيل الفئة المختارة بالضبط؛ وعند اختيار كل الفئات تظهر جميع الفئات، ومنها العمال والحراس والمشرفون.'],['المعادلات الجاهزة','الإجمالي = الأساسي + البدلات، راتب الفترة = الإجمالي ÷ أيام الشهر × الأيام المستحقة، الصافي = راتب الفترة + العمولات - الخصومات + جبر الكسور - السلف.'],['قابلية التعديل','الملف غير محمي، وتعيد معادلات Excel الحساب تلقائيًا بعد تعديل القيم.'],['سجلات حضور غير مرتبطة',N(meta?.unresolved)],['سجلات مستبعدة أو ملغاة',N(meta?.ignored)]]);guide.mergeCells('A1:D1');guide.getCell('A1').font={name:'Calibri',size:16,bold:true,color:{argb:ARGB('FFFFFF')}};guide.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:ARGB('0B5D49')}};guide.getCell('A1').alignment={horizontal:'center',readingOrder:'rtl'};guide.getRow(2).eachCell(c=>{c.font={bold:true,color:{argb:ARGB('FFFFFF')}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:ARGB('0B5D49')}};c.border=excelBorder();});guide.columns=[32,85,12,12].map(width=>({width}));return wb;}
  async function saveExcelJsWorkbook(wb,filename){const buffer=await wb.xlsx.writeBuffer();const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}

  async function exportExcel(btn){
    btn=btn||$('cu413ExportWorkersExcel');if(btn?.disabled)return;const original=btn?.textContent||'تنزيل تقرير Excel احترافي';
    try{
      const f=currentFilters();if(!/^\d{4}-\d{2}$/.test(f.month))throw new Error('اختر شهرًا صحيحًا.');
      if(btn){btn.disabled=true;btn.textContent='جاري تجهيز التقرير حسب المشاريع...';}
      showMsg('جاري تجهيز أسماء الإقامة ومكان العمل والحضور والغياب...');
      const b=monthBounds(f.month);
      const [master,legacy,projects,dist,attendance]=await Promise.all([
        safeFetch('employees_master_v386'),
        safeFetch('workers'),
        safeFetch('projects'),
        safeFetch('monthly_distribution',q=>q.eq('month_key',f.month).order('supervisor_name',{ascending:true}).order('project_name',{ascending:true})),
        safeFetch('attendance',q=>q.gte('attendance_date',b.start).lt('attendance_date',b.next).order('attendance_date',{ascending:true}))
      ]);
      const workers=mergeWorkers(master,legacy);
      if(!workers.length)throw new Error('لا توجد بيانات موظفين في النظام الموحد.');
      const index=buildEmployeeAliasIndex(workers);
      const projectMap=new Map();A(projects).forEach(p=>{const id=projectId(p),name=projectName(p);if(id)projectMap.set(id,p);if(name)projectMap.set('name:'+norm(name),p);});
      const assignments=new Map(),supervisorProjects=new Map();
      A(dist).filter(isActiveStatus).forEach(r=>{const sup=supervisorIdentity(r,workers),weight=Math.max(1,assignmentOverlapDays(r,f.month)),pi=projectInfoFromAssignment(r,projectMap);if(sup.key!=='unassigned'){if(!supervisorProjects.has(sup.key))supervisorProjects.set(sup.key,{...sup,items:[]});supervisorProjects.get(sup.key).items.push({...pi,weight});}const key=resolveEmployeeKey(r,index);if(!key)return;if(!assignments.has(key))assignments.set(key,{supervisors:new Map(),items:[]});const a=assignments.get(key);if(!a.supervisors.has(sup.key))a.supervisors.set(sup.key,{...sup,count:0});a.supervisors.get(sup.key).count+=weight;a.items.push({...pi,weight,supervisor:sup});});
      const attStats=buildAttendanceStats(attendance,index,f.month);
      const payrollMap=await loadPayrollMap(f.month,index);
      const details=[];const seen=new Set();
      workers.filter(w=>!isSupervisor(w)&&workerOverlapsMonth(w,f.month)).forEach(w=>{const key=canonicalEmployeeKey(w);if(!key||seen.has(key))return;seen.add(key);const asg=assignments.get(key);let sup={key:'unassigned',name:'بدون مشرف',code:''};if(asg?.supervisors?.size)sup=[...asg.supervisors.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'ar'))[0];else{const sc=normalizeCode(w?.supervisor_employee_code||w?.supervisor_code||w?.supervisor_id||''),sn=S(w?.supervisor_name||'');const sw=workers.find(x=>workerCode(x)===sc||norm(workerName(x))===norm(sn));if(sc||sn||sw)sup={key:sc?('code:'+norm(sc)):('name:'+norm(sn||workerName(sw))),code:sc||workerCode(sw),name:sn||workerName(sw)||'بدون مشرف'};}
        const items=A(asg?.items).filter(i=>i.supervisor.key===sup.key||sup.key==='unassigned').sort((a,b)=>b.weight-a.weight||a.name.localeCompare(b.name,'ar'));
        const primary=items[0]||{name:'بدون مشروع',full:false,type:'غير محدد'};
        const projectsList=[...new Set(items.map(i=>i.name).filter(Boolean))];
        const workplaces=[...new Set(items.map(i=>i.full?i.name:sup.name).filter(Boolean))];
        const st=attStats.get(key)||{present:0,absent:0,leave:0,sick:0,mission:0,weeklyOff:0,late:0,earlyLeave:0,other:0,recorded:0,conflicts:0,days:new Map(),firstIn:'',lastOut:''};const service=employeeServiceRange(w,f.month),fin=financialSnapshot(w,key,payrollMap,service,f.month,st.absent);
        details.push({employeeKey:key,supervisorKey:sup.key,supervisorName:sup.name||'بدون مشرف',supervisorCode:sup.code||'',roleGroup:roleGroup(w),roleLabel:roleLabel(roleGroup(w)),roleOrder:{worker:1,guard:2,technician:3,employee:4}[roleGroup(w)]||5,code:workerCode(w),name:workerName(w),employeeWithCode:[workerCode(w),workerName(w)].filter(Boolean).join(' - '),iqamaName:workerIqamaName(w),iqamaNumber:workerIqamaNo(w),workplace:workplaces.join('، ')||(sup.name||'بدون توزيع'),projects:projectsList,primaryProject:primary.name,primaryProjectType:primary.type,basic:fin.basic,allowances:fin.allowances,gross:fin.gross,total:fin.gross,periodSalary:fin.periodSalary,commissions:fin.commissions,deductions:fin.deductions,rounding:fin.rounding,advances:fin.advances,net:fin.net,dueDays:fin.dueDays,notes:fin.notes,workStart:workerStartDate(w),workEnd:workerEndDate(w),firstIn:st.firstIn||'',lastOut:st.lastOut||'',present:N(st.present),absent:N(st.absent),leave:N(st.leave),sick:N(st.sick),mission:N(st.mission),weeklyOff:N(st.weeklyOff),unrecorded:Math.max(0,service.days-N(st.recorded)),status:isActiveStatus(w)?'نشط':'موقوف',dayMap:st.days||new Map()});
      });
      const groupMap=new Map(details.map(x=>[x.supervisorKey,{key:x.supervisorKey,name:x.supervisorName,code:x.supervisorCode}]));
      supervisorProjects.forEach((g,key)=>{if(!groupMap.has(key))groupMap.set(key,{key,name:g.name,code:g.code});});
      workers.filter(w=>isSupervisor(w)&&workerOverlapsMonth(w,f.month)).forEach(w=>{const code=workerCode(w),key=code?('code:'+norm(code)):('name:'+norm(workerName(w)));if(!groupMap.has(key))groupMap.set(key,{key,name:workerName(w),code});});
      [...groupMap.values()].forEach(g=>{
        if(g.key==='unassigned')return;
        const matched=findSupervisorWorker(g,workers);
        const sw=matched||{employee_code:g.code||'',worker_name:g.name||'مشرف',iqama_name:'',role_type:'مشرف',status:'active'};
        if(matched&&!workerOverlapsMonth(sw,f.month))return;
        const key=canonicalEmployeeKey(sw)||g.key;
        const oldIndex=details.findIndex(x=>x.employeeKey===key);if(oldIndex>=0)details.splice(oldIndex,1);
        const st=attStats.get(key)||{present:0,absent:0,leave:0,sick:0,mission:0,weeklyOff:0,recorded:0,days:new Map(),firstIn:'',lastOut:''};const service=employeeServiceRange(sw,f.month),fin=financialSnapshot(sw,key,payrollMap,service,f.month,st.absent);const projectRows=details.filter(x=>x.supervisorKey===g.key);const distProjects=A(supervisorProjects.get(g.key)?.items).sort((a,b)=>b.weight-a.weight||a.name.localeCompare(b.name,'ar')).map(x=>x.name);const projectsList=[...new Set([...distProjects,...projectRows.flatMap(x=>x.projects)].filter(Boolean))];
        details.push({employeeKey:key,supervisorKey:g.key,supervisorName:g.name||workerName(sw),supervisorCode:g.code||workerCode(sw),roleGroup:'supervisor',roleLabel:'مشرف',roleOrder:0,code:workerCode(sw)||g.code||'',name:workerName(sw)||g.name||'مشرف',employeeWithCode:[workerCode(sw)||g.code,workerName(sw)||g.name].filter(Boolean).join(' - '),iqamaName:workerIqamaName(sw),iqamaNumber:workerIqamaNo(sw),workplace:projectsList.join('، ')||'إشراف عام',projects:projectsList,primaryProject:projectsList[0]||'إشراف عام',primaryProjectType:'إشراف',basic:fin.basic,allowances:fin.allowances,gross:fin.gross,total:fin.gross,periodSalary:fin.periodSalary,commissions:fin.commissions,deductions:fin.deductions,rounding:fin.rounding,advances:fin.advances,net:fin.net,dueDays:fin.dueDays,notes:fin.notes,workStart:workerStartDate(sw),workEnd:workerEndDate(sw),firstIn:st.firstIn||'',lastOut:st.lastOut||'',present:N(st.present),absent:N(st.absent),leave:N(st.leave),sick:N(st.sick),mission:N(st.mission),weeklyOff:N(st.weeklyOff),unrecorded:Math.max(0,service.days-N(st.recorded)),status:isActiveStatus(sw)?'نشط':'موقوف',dayMap:st.days||new Map()});
      });
      const filtered=details.filter(x=>detailMatchesExactFilter(x,f)).sort((a,b)=>a.supervisorName.localeCompare(b.supervisorName,'ar')||((a.roleGroup==='supervisor'?0:1)-(b.roleGroup==='supervisor'?0:1))||a.primaryProject.localeCompare(b.primaryProject,'ar')||a.roleOrder-b.roleOrder||a.name.localeCompare(b.name,'ar'));
      if(!filtered.length)throw new Error('لا توجد بيانات مطابقة للفلاتر الحالية بالضبط.');
      const wb=await buildWorkbook(f.month,filtered,f,attStats.meta||{});
      await saveExcelJsWorkbook(wb,`كشف_الرواتب_حسب_الفلتر_${f.month}.xlsx`);
      showMsg(`تم تنزيل التقرير: ${filtered.length} سجل، الحضور ${filtered.reduce((a,x)=>a+x.present,0)} يوم، الغياب ${filtered.reduce((a,x)=>a+x.absent,0)} يوم.`);
    }catch(e){console.error(VERSION,e);showMsg('تعذر تنزيل Excel: '+(e?.message||e),true);}finally{if(btn){btn.disabled=false;btn.textContent=original;}}
  }

  function bind(){const btn=$('cu413ExportWorkersExcel');if(!btn||btn.dataset.v10812==='1')return;btn.dataset.v10812='1';btn.onclick=function(e){e?.preventDefault?.();exportExcel(btn);return false;};btn.textContent='تنزيل كشف الرواتب حسب الفلتر';window.exportSupervisorEmployeesExcelV10812=exportExcel;window.exportSupervisorEmployeesExcel=exportExcel;if(window.tasneefCoreUnifiedV413)window.tasneefCoreUnifiedV413.exportSupervisorEmployeesExcel=()=>exportExcel($('cu413ExportWorkersExcel'));}
  window.__tasneefUnifiedEmployeePayrollDiagnosticsV10812={roleGroup,isSupervisor,findSupervisorWorker,detailMatchesExactFilter};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,1600));window.addEventListener('load',()=>setTimeout(bind,2000));document.addEventListener('click',e=>{if(e.target.closest('#coreUnified [data-tab="workers"]'))setTimeout(bind,250);});try{new MutationObserver(()=>bind()).observe(document.body,{childList:true,subtree:true});}catch(_){ }setTimeout(bind,2600);
  console.log('Tasneef',VERSION,'supervisor recovery + editable formula payroll Excel loaded');
})();

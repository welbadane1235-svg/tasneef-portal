/* ===== TASNEEF V10833-EDITABLE - Exact unified distribution payroll Excel ===== */
(function(){
  'use strict';
  if(window.__tasneefUnifiedPayrollExcelV10833) return;
  window.__tasneefUnifiedPayrollExcelV10833=true;

  const VERSION='V10833-EDITABLE';
  const PAYROLL_DAYS=30;
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
  function dateOnly(v){return S(v).slice(0,10);}
  function dateDaysInclusive(start,end){if(!start||!end||end<start)return 0;const a=Date.parse(start+'T12:00:00'),z=Date.parse(end+'T12:00:00');return Number.isFinite(a)&&Number.isFinite(z)?Math.floor((z-a)/86400000)+1:0;}
  function timeText(v){const x=S(v);if(!x)return'';if(/^\d{2}:\d{2}/.test(x))return x.slice(0,5);if(/^\d{4}-\d{2}-\d{2}T/.test(x)&&/(Z|[+-]\d{2}:?\d{2})$/i.test(x)){const d=new Date(x);if(!Number.isNaN(d.getTime()))return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);}const m=x.match(/T(\d{2}:\d{2})/);return m?m[1]:x.slice(0,16).replace('T',' ');}
  function dateTimeLabel(date,val){const t=timeText(val);return date?(date+(t?' '+t:'')):(t||'');}
  function normalizeCode(v){const raw=S(v).toUpperCase().replace(/\s+/g,'').replace(/_/g,'-');const m=raw.match(/TS-?(\d+)/i);return m?'TS-'+String(Number(m[1])).padStart(2,'0'):raw;}
  function statusDeleted(x){const s=norm(x?.status||x?.state||'');return !!(x?.deleted_at||x?.is_deleted===true||['deleted','محذوف','ملغي','archived'].includes(s));}
  function isActiveStatus(x){const s=norm(x?.status||x?.state||'active');return !(x?.is_active===false||['inactive','stopped','stop','disabled','deleted','ended','موقوف','متوقف','محذوف','منتهي','غير نشط','غيرنشط'].includes(s));}

  function workerCode(w){return normalizeCode(w?.worker_code||w?.employee_code||w?.code||w?.emp_code||w?.worker_employee_code||w?.employee_number||w?.employee_ts_id||'');}
  function workerName(w){return S(w?.worker_name||w?.app_name||w?.name||w?.full_name||w?.employee_name||w?.display_name||w?.iqama_name||workerCode(w));}
  function workerIqamaName(w){return S(w?.iqama_name||w?.residency_name||w?.official_name||'');}
  function workerIqamaNo(w){return S(w?.iqama_number||w?.residency_number||w?.national_id||w?.id_number||'');}
  function workerRoleFields(w){return [w?.job_title,w?.role_type,w?.position,w?.job,w?.profession,w?.role,w?.category,w?.worker_role,w?.worker_type,w?.employee_type,w?.job_type,w?.job_name,w?.title,w?.system_role,w?.user_role,w?.designation].map(S).filter(Boolean);}
  function workerRole(w){return workerRoleFields(w)[0]||'عامل';}
  function workerRoleText(w){return workerRoleFields(w).join(' | ')||'عامل';}
  function workerStartDate(w){return dateOnly(w?.work_start_date||w?.hire_date||w?.employment_start_date||w?.start_work_date||w?.start_date||w?.join_date||w?.hiring_date||w?.created_at||'');}
  function workerEndDate(w){return dateOnly(w?.work_end_date||w?.employment_end_date||w?.termination_date||w?.end_work_date||w?.end_date||'');}
  function workerBasicSalary(w){return N(w?.basic_salary||w?.salary_basic||w?.base_salary||w?.salary||w?.main_salary);}
  function workerAllowances(w){const direct=N(w?.allowances||w?.allowance||w?.salary_allowance||w?.total_allowances||w?.benefits||w?.extra_allowance);return direct||N(w?.housing_allowance)+N(w?.transport_allowance)+N(w?.food_allowance)+N(w?.other_allowances);}
  function roleGroup(w){const r=norm(workerRoleText(w));if(r.includes('مشرف')||r.includes('supervisor'))return'supervisor';if(r.includes('فني')||r.includes('technician')||r.includes('tech'))return'technician';if(r.includes('حارس')||r.includes('امن')||r.includes('حراسه')||r.includes('حراسة')||r.includes('security')||r.includes('guard')||r.includes('watchman'))return'guard';if(r.includes('موظف')||r.includes('اداري')||r.includes('employee')||r.includes('admin'))return'employee';return'worker';}
  function roleLabel(g){return({supervisor:'مشرف',worker:'عامل',technician:'فني',guard:'حارس',employee:'موظف'})[g]||'موظف';}
  function isSupervisor(w){return roleGroup(w)==='supervisor';}
  function workerOverlapsMonth(w,m){const b=monthBounds(m),st=workerStartDate(w)||'1900-01-01',en=workerEndDate(w)||'9999-12-31';return st<b.next&&en>=b.start;}

  function strongEmployeeAliases(x){
    const out=[];const add=(kind,v)=>{v=S(v);if(!v)return;const k=kind+':'+norm(v);if(!out.includes(k))out.push(k);};
    [x?.canonical_employee_id,x?.canonical_worker_id,x?.employee_id,x?.worker_id,x?.staff_id,x?.person_id,x?.app_worker_id,x?.app_employee_id,x?.user_id,x?.id].forEach(v=>add('id',v));
    [x?.worker_employee_code,x?.worker_code,x?.employee_code,x?.employee_ts_id,x?.code,x?.emp_code].forEach(v=>{const c=normalizeCode(v);if(c)add('code',c);});
    [x?.iqama_number,x?.residency_number,x?.national_id,x?.id_number].forEach(v=>add('iqama',v));
    return out;
  }
  function employeeNameVariants(v){const raw=S(v);if(!raw)return[];const out=[];const add=x=>{x=S(x);if(x)out.push(x);};add(raw);add(raw.replace(/^TS[-_\s]?\d+\s*[-–—:|]?\s*/i,''));add(raw.replace(/\(.*?\)/g,' ').replace(/\s+/g,' ').trim());[...raw.matchAll(/[\(（]+([^\)）]+)[\)）]+/g)].forEach(m=>add(m[1]));raw.split(/[\/|،,–—]+/).forEach(add);return[...new Set(out.map(S).filter(Boolean))];}
  function employeeIdentityAliases(x){const out=[...strongEmployeeAliases(x)];const add=(kind,v)=>{v=S(v);if(!v)return;const k=kind+':'+norm(v);if(!out.includes(k))out.push(k);};[x?.worker_name,x?.worker_display_name,x?.worker_identity,x?.app_name,x?.display_name,x?.name,x?.full_name,x?.employee_name,x?.iqama_name,x?.residency_name].forEach(v=>employeeNameVariants(v).forEach(n=>add('name',n)));return out;}
  function canonicalEmployeeKey(w){return S(w?.__canonical_key)||strongEmployeeAliases(w)[0]||'';}
  function mergeWorkers(master,legacy){
    /* V10833: نفس منطق توحيد العمال المستخدم داخل النظام الموحد؛ الكود أولاً ثم الاسم. */
    const map=new Map(),nameIndex=new Map();
    const uniq=arr=>[...new Set(A(arr).map(S).filter(Boolean))];
    function merge(a,b){
      const out={...(a||{})};
      Object.keys(b||{}).forEach(k=>{const v=b[k];if(v!==undefined&&v!==null&&S(v)!=='')out[k]=v;});
      const codes=[],ids=[],names=[];
      [a,b].filter(Boolean).forEach(x=>{
        codes.push(...A(x.__identity_codes),x.worker_employee_code,x.worker_code,x.employee_code,x.employee_ts_id,x.code,x.emp_code);
        ids.push(...A(x.__identity_ids),x.canonical_employee_id,x.canonical_worker_id,x.employee_id,x.worker_id,x.staff_id,x.person_id,x.user_id,x.id,x.legacy_worker_id);
        names.push(...A(x.__identity_names),x.worker_name,x.worker_display_name,x.worker_identity,x.app_name,x.display_name,x.name,x.full_name,x.employee_name,x.iqama_name,x.residency_name);
      });
      out.__identity_codes=uniq(codes.map(normalizeCode));out.__identity_ids=uniq(ids);out.__identity_names=uniq(names);
      const code=normalizeCode(workerCode(out));if(code)out.employee_code=code;
      return out;
    }
    function put(w,priority,source,index){
      if(!w||statusDeleted(w))return;
      const code=normalizeCode(workerCode(w)),nameKey=norm(workerName(w));
      if(!code&&!nameKey)return;
      let key=code?('code:'+norm(code)):(nameIndex.get(nameKey)||('name:'+nameKey));
      if(code&&nameKey&&nameIndex.has(nameKey)&&nameIndex.get(nameKey)!==key){
        const oldKey=nameIndex.get(nameKey),old=map.get(oldKey);
        if(old){map.delete(oldKey);w=merge(old,w);}
      }
      const old=map.get(key),tagged={...w,__source_tables:[source],__priority:priority,__canonical_key:key};
      const merged=(!old||priority>=(old.__priority||0))?merge(old,tagged):merge(tagged,old);
      merged.__priority=Math.max(priority,old?.__priority||0);merged.__canonical_key=key;
      if(code)merged.employee_code=code;
      map.set(key,merged);
      if(nameKey)nameIndex.set(nameKey,key);
    }
    A(legacy).forEach((w,i)=>put(w,1,'workers',i));
    A(master).forEach((w,i)=>put(w,2,'employees_master_v386',i));
    const final=new Map();
    [...map.values()].forEach(w=>{
      const code=normalizeCode(workerCode(w)),nameKey=norm(workerName(w)),key=code?('code:'+norm(code)):('name:'+nameKey);
      const old=final.get(key),merged=old?merge(old,w):w;merged.__canonical_key=key;final.set(key,merged);
    });
    return[...final.values()].sort((a,b)=>workerName(a).localeCompare(workerName(b),'ar'));
  }
  function buildEmployeeAliasIndex(workers){
    const aliasToKey=new Map(),employeeByKey=new Map(),nameCounts=new Map();
    A(workers).forEach(w=>{const key=canonicalEmployeeKey(w);if(!key)return;employeeByKey.set(key,w);strongEmployeeAliases(w).forEach(a=>aliasToKey.set(a,key));employeeIdentityAliases(w).filter(a=>a.startsWith('name:')).forEach(a=>nameCounts.set(a,(nameCounts.get(a)||0)+1));});
    A(workers).forEach(w=>{const key=canonicalEmployeeKey(w);employeeIdentityAliases(w).filter(a=>a.startsWith('name:')&&nameCounts.get(a)===1).forEach(a=>aliasToKey.set(a,key));});
    return{aliasToKey,employeeByKey};
  }
  function relationEmployeeAliases(x){
    /* V10833: لا نستخدم id العام في سجلات التوزيع/الحضور لأنه معرف السجل وليس معرف الموظف. */
    const out=[];const add=(kind,v)=>{v=S(v);if(!v)return;const k=kind+':'+norm(v);if(!out.includes(k))out.push(k);};
    [x?.canonical_employee_id,x?.canonical_worker_id,x?.employee_id,x?.worker_id,x?.staff_id,x?.person_id,x?.app_worker_id,x?.app_employee_id,x?.employee_user_id,x?.worker_user_id].forEach(v=>add('id',v));
    [x?.worker_employee_code,x?.worker_code,x?.employee_code,x?.employee_ts_id,x?.code,x?.emp_code].forEach(v=>{const c=normalizeCode(v);if(c)add('code',c);});
    [x?.iqama_number,x?.residency_number,x?.national_id,x?.id_number].forEach(v=>add('iqama',v));
    [x?.worker_name,x?.worker_display_name,x?.worker_identity,x?.app_name,x?.display_name,x?.employee_name,x?.iqama_name,x?.residency_name].forEach(v=>employeeNameVariants(v).forEach(n=>add('name',n)));
    return out;
  }
  function resolveEmployeeKey(record,index){for(const prefix of ['code:','id:','iqama:','name:'])for(const a of relationEmployeeAliases(record))if(a.startsWith(prefix)&&index.aliasToKey.has(a))return index.aliasToKey.get(a);return'';}

  function attendanceStatus(v){const x=norm(v);if(['unpaid leave','unpaid_leave','اجازه غير مدفوعه','اجازة غير مدفوعة','إجازة غير مدفوعة','غ م'].includes(x))return'unpaid_leave';if(['absent','غائب','غياب','غ','a'].includes(x))return'absent';if(['late','متاخر','متأخر'].includes(x))return'late';if(['early_leave','خروج مبكر','انصراف مبكر'].includes(x))return'early_leave';if(['present','حاضر','حضور','ح','p'].includes(x))return'present';if(['leave','اجازه','إجازه','اجازة','إجازة'].includes(x))return'leave';if(['sick','مرضي','مرضى','اجازه مرضيه','إجازة مرضية'].includes(x))return'sick';if(['mission','ماموريه','مأمورية','م'].includes(x))return'mission';if(['weekly_off','راحه اسبوعيه','راحة أسبوعية','off','ر'].includes(x))return'weekly_off';return x||'';}
  function attendanceDateOf(a){return S(a?.attendance_date||a?.work_date||a?.record_date||a?.log_date||a?.date||a?.check_in||a?.created_at||'').slice(0,10);}
  function attendanceInOf(a){return S(a?.check_in_time||a?.check_in||a?.in_time||a?.start_time||a?.login_time||'');}
  function attendanceOutOf(a){return S(a?.check_out_time||a?.check_out||a?.out_time||a?.end_time||a?.logout_time||'');}
  function attendanceStamp(a){const raw=S(a?.updated_at||a?.created_at||a?.attendance_date||'');const ms=Date.parse(raw);return Number.isFinite(ms)?ms:N(a?.id);}
  function attendanceIgnored(a){const s=norm(a?.status||a?.attendance_status||a?.state||'');return !!(a?.deleted_at||a?.is_deleted===true||a?.is_cancelled===true||['cancelled','canceled','rejected','failed','deleted','ملغي','مرفوض','محذوف','غير معتمد'].includes(s));}
  function attendanceMoment(date,val,fallback){const x=S(val);if(!x)return fallback||0;let ms=Date.parse(x);if(Number.isFinite(ms))return ms;const t=timeText(x);ms=Date.parse(date+'T'+(t||'00:00')+':00');return Number.isFinite(ms)?ms:(fallback||0);}
  function mergeAttendanceDay(records,date){const rows=A(records).filter(a=>!attendanceIgnored(a)).sort((a,b)=>attendanceStamp(a)-attendanceStamp(b));const latest=rows[rows.length-1]||{};const statuses=rows.map(a=>attendanceStatus(a.status||a.attendance_status||a.state));let status=attendanceStatus(latest.status||latest.attendance_status||latest.state);if(!status&&rows.some(a=>attendanceInOf(a)||attendanceOutOf(a)))status='present';const ins=rows.filter(a=>attendanceInOf(a)).map(a=>({v:attendanceInOf(a),ms:attendanceMoment(date,attendanceInOf(a),attendanceStamp(a))})).sort((a,b)=>a.ms-b.ms);const outs=rows.filter(a=>attendanceOutOf(a)).map(a=>({v:attendanceOutOf(a),ms:attendanceMoment(date,attendanceOutOf(a),attendanceStamp(a))})).sort((a,b)=>a.ms-b.ms);return{date,status,firstIn:ins[0]?.v||'',lastOut:outs[outs.length-1]?.v||'',conflict:(statuses.some(s=>['present','late','early_leave'].includes(s))||rows.some(a=>attendanceInOf(a)||attendanceOutOf(a)))&&statuses.includes('absent')};}
  function buildAttendanceStats(rows,index,month){const p=reportPeriod(month),grouped=new Map();let unresolved=0,ignored=0;A(rows).forEach(a=>{if(attendanceIgnored(a)){ignored++;return;}const date=attendanceDateOf(a);if(!date||date<p.start||date>=p.next)return;const key=resolveEmployeeKey(a,index);if(!key){unresolved++;return;}if(!grouped.has(key))grouped.set(key,new Map());const dm=grouped.get(key);if(!dm.has(date))dm.set(date,[]);dm.get(date).push(a);});const result=new Map();grouped.forEach((dm,key)=>{const days=[...dm.entries()].map(([d,r])=>mergeAttendanceDay(r,d)).sort((a,b)=>a.date.localeCompare(b.date));const counts={present:0,absent:0,leave:0,sick:0,unpaidLeave:0,mission:0,weeklyOff:0,late:0,earlyLeave:0,other:0,recorded:0,conflicts:0};const dayMap=new Map();days.forEach(d=>{dayMap.set(d.date,d);if(d.status){counts.recorded++;if(['present','late','early_leave'].includes(d.status)){counts.present++;if(d.status==='late')counts.late++;if(d.status==='early_leave')counts.earlyLeave++;}else if(d.status==='absent')counts.absent++;else if(d.status==='leave')counts.leave++;else if(d.status==='sick')counts.sick++;else if(d.status==='unpaid_leave')counts.unpaidLeave++;else if(d.status==='mission')counts.mission++;else if(d.status==='weekly_off')counts.weeklyOff++;else counts.other++;}if(d.conflict)counts.conflicts++;});const worked=days.filter(d=>['present','late','early_leave','mission'].includes(d.status));const firstWorked=worked[0]||null,lastWorked=worked[worked.length-1]||null;result.set(key,{...counts,days:dayMap,firstIn:firstWorked?dateTimeLabel(firstWorked.date,firstWorked.firstIn):'',lastOut:lastWorked?dateTimeLabel(lastWorked.date,lastWorked.lastOut):'',firstAttendanceDate:firstWorked?.date||'',lastAttendanceDate:lastWorked?.date||''});});result.meta={unresolved,ignored};return result;}
  function attendanceSymbol(status){return({present:'ح',late:'ح',early_leave:'ح',absent:'غ',leave:'إ',sick:'إ',unpaid_leave:'غ م',mission:'م',weekly_off:'ر'})[status]||'-';}

  function projectId(p){return S(p?.project_id||p?.id||p?.code||'');}
  function projectName(p){return S(p?.project_name||p?.name||p?.title||projectId(p));}
  function projectTypeRaw(x){return S(x?.operation_type||x?.project_type||x?.work_type||x?.type||x?.contract_type||x?.service_type||'');}
  function isFullTimeProject(x){const t=norm(projectTypeRaw(x));return t.includes('دوام')||t.includes('كامل')||t.includes('دائم')||t.includes('full')||t.includes('permanent')||t==='full time';}
  function assignmentStart(r){return dateOnly(r?.start_date||r?.assignment_start||r?.effective_from||r?.from_date||'');}
  function assignmentEnd(r){return dateOnly(r?.end_date||r?.assignment_end||r?.effective_to||r?.to_date||'');}
  function assignmentRelevant(r,month){
    if(statusDeleted(r)||r?.is_active===false)return false;
    const state=norm(r?.status||r?.state||r?.active_status||'active');
    if(['inactive','ended','stopped','cancelled','canceled','disabled','موقوف','متوقف','منتهي','ملغي','غير نشط','غيرنشط'].includes(state))return false;
    const b=monthBounds(month),mk=S(r?.month_key||r?.month||'').slice(0,7);if(mk&&mk!==month)return false;
    const st=assignmentStart(r)||'1900-01-01',en=assignmentEnd(r)||'9999-12-31';return st<b.next&&en>=b.start;
  }
  function assignmentOverlapDays(r,month){const p=reportPeriod(month);const st=[p.start,assignmentStart(r)].filter(Boolean).sort().pop()||p.start;const ends=[p.end,assignmentEnd(r)].filter(Boolean).sort();return dateDaysInclusive(st,ends[0]||p.end);}
  function supervisorIdentity(r,workers){const code=normalizeCode(r?.supervisor_employee_code||r?.supervisor_code||'');const name=S(r?.supervisor_name||r?.supervisor_display_name||'');const id=S(r?.supervisor_id||r?.app_supervisor_id||r?.current_supervisor_id||'');const sw=A(workers).find(w=>(code&&workerCode(w)===code)||(id&&strongEmployeeAliases(w).includes('id:'+norm(id)))||(name&&norm(workerName(w))===norm(name)));const resolvedCode=code||workerCode(sw),resolvedName=name||workerName(sw)||'بدون مشرف';return{key:resolvedCode?('code:'+norm(resolvedCode)):(id?'id:'+norm(id):(resolvedName!=='بدون مشرف'?'name:'+norm(resolvedName):'unassigned')),code:resolvedCode,name:resolvedName,id};}
  function projectInfoFromAssignment(r,projectMap){const pid=S(r?.project_id||r?.project_code||r?.app_project_id||''),p=projectMap.get(pid)||projectMap.get('name:'+norm(S(r?.project_name||r?.project_display_name||'')))||{};const name=S(r?.project_name||r?.project_display_name||projectName(p)||'بدون مشروع');const full=isFullTimeProject(r)||isFullTimeProject(p);return{id:pid||projectId(p),name,full,type:full?'دوام كامل':'زيارة يومية',start:assignmentStart(r),end:assignmentEnd(r)};}

  function assignmentUpdatedMs(r){const v=r?.updated_at||r?.created_at||r?.assigned_at||r?.start_date||'';const ms=Date.parse(S(v));return Number.isFinite(ms)?ms:0;}
  function assignmentProjectKey(pi){return S(pi?.id)||('name:'+norm(pi?.name||''));}
  function dedupeDistributionRows(rows,month,index,workers,projectMap){
    /* صف واحد فقط لكل موظف/مشروع، وآخر تعديل هو المعتمد مثل شاشة التوزيع. */
    const map=new Map(),duplicates=[];
    A(rows).forEach((r,sourceIndex)=>{
      if(!assignmentRelevant(r,month))return;
      const employeeKey=resolveEmployeeKey(r,index);if(!employeeKey)return;
      const sup=supervisorIdentity(r,workers),pi=projectInfoFromAssignment(r,projectMap);if(!assignmentProjectKey(pi))return;
      const key=employeeKey+'|'+assignmentProjectKey(pi),candidate={row:r,employeeKey,sup,pi,updatedMs:assignmentUpdatedMs(r),sourceIndex};
      const old=map.get(key);
      if(!old||candidate.updatedMs>old.updatedMs||(candidate.updatedMs===old.updatedMs&&candidate.sourceIndex>old.sourceIndex)){
        if(old)duplicates.push(key);map.set(key,candidate);
      }else duplicates.push(key);
    });
    return{rows:[...map.values()],duplicates:[...new Set(duplicates)]};
  }
  function supervisorMatchesFilter(sup,value){const target=norm(value);if(!target)return true;return[sup?.key,sup?.code,sup?.name].map(norm).some(v=>v===target||v.includes(target)||target.includes(v));}
  function projectMatchesFilter(pi,value){const target=norm(value);if(!target)return true;return norm(pi?.id)===target||norm(pi?.name)===target||norm(pi?.name).includes(target)||target.includes(norm(pi?.name));}
  function chooseAssignmentSupervisor(asg,filters){
    let entries=[...asg.supervisors.values()];if(!entries.length)return null;
    if(filters?.supervisor){const exact=entries.find(x=>supervisorMatchesFilter(x,filters.supervisor));if(exact)return exact;}
    if(filters?.project){const item=A(asg.items).find(x=>projectMatchesFilter(x,filters.project));if(item){const exact=entries.find(x=>x.key===item.supervisor?.key);if(exact)return exact;}}
    entries.sort((a,b)=>N(b.projectCount)-N(a.projectCount)||N(b.latestMs)-N(a.latestMs)||N(b.weight)-N(a.weight)||S(a.name).localeCompare(S(b.name),'ar'));
    return entries[0];
  }
  function supervisorGroups(details){
    const groups=new Map();A(details).forEach(x=>{const key=x.supervisorKey||'unassigned';if(!groups.has(key))groups.set(key,{key,name:x.supervisorName||'بدون مشرف',code:x.supervisorCode||'',rows:[]});groups.get(key).rows.push(x);});
    return[...groups.values()].sort((a,b)=>{if(a.key==='unassigned')return 1;if(b.key==='unassigned')return-1;return S(a.name).localeCompare(S(b.name),'ar');}).map(g=>{g.rows.sort((a,b)=>(a.roleGroup==='supervisor'?-1:0)-(b.roleGroup==='supervisor'?-1:0)||S(a.primaryProject).localeCompare(S(b.primaryProject),'ar')||N(a.roleOrder)-N(b.roleOrder)||S(a.name).localeCompare(S(b.name),'ar'));return g;});
  }
  function sortByUnifiedHierarchy(details){return supervisorGroups(details).flatMap(g=>g.rows);}


  async function fetchPagedRows(table,configure){const c=sbClient();if(!c)throw new Error('الاتصال بقاعدة البيانات غير جاهز.');const out=[];let start=0;const size=1000;while(start<100000){let q=c.from(table).select('*');q=configure?configure(q):q;q=q.range(start,start+size-1);const r=await q;if(r.error)throw r.error;const rows=r.data||[];out.push(...rows);if(rows.length<size)break;start+=size;}return out;}
  async function safeFetch(table,configure){try{return await fetchPagedRows(table,configure);}catch(e){console.warn(VERSION,table,e);return[];}}
  function hasField(o,k){return !!o&&o[k]!==undefined&&o[k]!==null&&S(o[k])!=='';}
  async function loadPayrollMap(month,index){const out=new Map(),c=sbClient();if(!c?.rpc)return out;try{const res=await c.rpc('get_unified_payroll_from_server',{p_month:month});if(res.error)throw res.error;A(res.data?.rows).forEach(r=>{const key=resolveEmployeeKey(r,index);if(key&&!out.has(key))out.set(key,r);});}catch(e){console.warn(VERSION,'payroll RPC fallback',e);}return out;}
  function financialSnapshot(w,key,payrollMap,eligibleDays,dueDays){const p=payrollMap.get(key)||{};const basic=hasField(p,'base_salary')?N(p.base_salary):workerBasicSalary(w);const allowances=hasField(p,'allowances')?N(p.allowances):workerAllowances(w);const gross=basic+allowances;const commissions=hasField(p,'commissions')?N(p.commissions):N(w?.commissions||w?.commission||w?.bonus);let deductions;if(hasField(p,'other_deductions'))deductions=N(p.other_deductions);else if(hasField(p,'administrative_deductions'))deductions=N(p.administrative_deductions);else{const total=hasField(p,'deductions')?N(p.deductions):N(w?.deductions||w?.other_deductions);const absence=hasField(p,'absence_deduction')?N(p.absence_deduction):0;deductions=Math.max(0,total-absence);}const advances=hasField(p,'advances')?N(p.advances):N(w?.advances||w?.advance_deduction||w?.loan_deduction);const periodSalary=gross/PAYROLL_DAYS*Math.min(eligibleDays,dueDays);const before=periodSalary+commissions-deductions-advances;const rounding=Math.round(before)-before;const net=before+rounding;const notes=S(p.notes||A(p.issues).join('، ')||w?.notes||'');return{basic,allowances,gross,periodSalary,commissions,deductions,advances,rounding,net,notes};}

  function currentFilters(){return{month:S($('cu413WorkerExportMonth')?.value||todayMonth()).slice(0,7),search:S($('cu413WorkerSearch')?.value||''),role:S($('cu413WorkerRoleFilter')?.value||''),status:S($('cu413WorkerStatusFilter')?.value||''),supervisor:S($('cu413WorkerSupervisorFilter')?.value||''),project:S($('cu413WorkerProjectFilter')?.value||''),roleLabel:S($('cu413WorkerRoleFilter')?.selectedOptions?.[0]?.textContent||'كل الفئات'),statusLabel:S($('cu413WorkerStatusFilter')?.selectedOptions?.[0]?.textContent||'كل الحالات'),supervisorLabel:S($('cu413WorkerSupervisorFilter')?.selectedOptions?.[0]?.textContent||'كل المشرفين'),projectLabel:S($('cu413WorkerProjectFilter')?.selectedOptions?.[0]?.textContent||'كل المشاريع')};}
  function sourceMatchesBasicFilter(w,f){if(f.role&&roleGroup(w)!==f.role)return false;const active=isActiveStatus(w);if(f.status==='active'&&!active)return false;if(f.status==='inactive'&&active)return false;const q=norm(f.search);if(q){const bag=norm([workerCode(w),workerName(w),workerIqamaName(w),workerIqamaNo(w),workerRoleText(w),w?.status,w?.state,w?.active_status].join(' '));if(!bag.includes(q))return false;}return true;}
  function detailMatchesExactFilter(x,f){if(f.role&&x.roleGroup!==f.role)return false;const active=x.status!=='موقوف';if(f.status==='active'&&!active)return false;if(f.status==='inactive'&&active)return false;const q=norm(f.search);if(q){const bag=norm([x.code,x.name,x.iqamaName,x.iqamaNumber,x.roleLabel,x.originalJobTitle,x.status].join(' '));if(!bag.includes(q))return false;}if(f.supervisor){const target=norm(f.supervisor),bag=[x.supervisorKey,x.supervisorCode,x.supervisorName,x.roleGroup==='supervisor'?x.code:'',x.roleGroup==='supervisor'?x.name:''].map(norm);if(!bag.some(v=>v===target||v.includes(target)||target.includes(v)))return false;}if(f.project){const target=norm(f.project),ids=A(x.projectIds).map(norm),names=A(x.projects).map(norm);if(!ids.includes(target)&&!names.some(v=>v===target||v.includes(target)||target.includes(v)))return false;}return true;}
  function filterSummary(f){return [f.roleLabel||'كل الفئات',f.statusLabel||'كل الحالات',f.supervisorLabel||'كل المشرفين',f.projectLabel||'كل المشاريع',f.search?('بحث: '+f.search):''].filter(Boolean).join(' | ');}

  function cycleEligibility(w,asg,st,month){const startBase=month+'-01',endBase=month+'-30';const starts=[startBase,workerStartDate(w),asg?.firstStart,st?.firstAttendanceDate].filter(Boolean).sort();const start=starts[starts.length-1]||startBase;const ends=[endBase,workerEndDate(w)].filter(Boolean).sort();const end=ends[0]||endBase;if(start>end)return{start,end,days:0};const sMonth=start.slice(0,7),eMonth=end.slice(0,7);let sd=sMonth===month?Math.min(PAYROLL_DAYS,Math.max(1,N(start.slice(8,10)))):1;let ed=eMonth===month?Math.min(PAYROLL_DAYS,Math.max(0,N(end.slice(8,10)))):PAYROLL_DAYS;if(start.slice(0,7)>month||end.slice(0,7)<month||ed<sd)return{start,end,days:0};return{start:start<startBase?startBase:start,end:end>endBase?endBase:end,days:Math.max(0,ed-sd+1),startDay:sd,endDay:ed};}
  function symbolForDay(detail,month,day){if(day<detail.eligibilityStartDay||day>detail.eligibilityEndDay)return'-';const rec=detail.dayMap.get(`${month}-${String(day).padStart(2,'0')}`);return rec?attendanceSymbol(rec.status):'-';}

  async function loadExcelJs(){if(window.ExcelJS)return window.ExcelJS;return await new Promise((resolve,reject)=>{const existing=document.querySelector('script[data-tasneef-exceljs-v10833="1"]');if(existing){existing.addEventListener('load',()=>window.ExcelJS?resolve(window.ExcelJS):reject(new Error('تعذر تحميل مكتبة تنسيق Excel.')),{once:true});existing.addEventListener('error',()=>reject(new Error('تعذر تحميل مكتبة تنسيق Excel.')),{once:true});return;}const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';s.async=true;s.dataset.tasneefExceljsV10833='1';s.onload=()=>window.ExcelJS?resolve(window.ExcelJS):reject(new Error('تعذر تحميل مكتبة تنسيق Excel.'));s.onerror=()=>reject(new Error('تعذر تحميل مكتبة تنسيق Excel.'));document.head.appendChild(s);});}
  const ARGB=x=>'FF'+x;
  const GREEN='0B5D49',GREEN2='176B55',LIGHT_GREEN='EAF5F0',BORDER_COLOR='B8D6CD';
  function excelBorder(){return{top:{style:'thin',color:{argb:ARGB(BORDER_COLOR)}},left:{style:'thin',color:{argb:ARGB(BORDER_COLOR)}},bottom:{style:'thin',color:{argb:ARGB(BORDER_COLOR)}},right:{style:'thin',color:{argb:ARGB(BORDER_COLOR)}}};}
  function styleCell(cell,opt={}){cell.font={name:'Calibri',size:opt.size||10,bold:!!opt.bold,color:{argb:ARGB(opt.fontColor||'111111')}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:ARGB(opt.fill||'FFFFFF')}};cell.alignment={horizontal:opt.align||'center',vertical:'middle',wrapText:opt.wrap!==false,readingOrder:'rtl'};cell.border=excelBorder();if(opt.numFmt)cell.numFmt=opt.numFmt;}
  function addTitle(ws,lastCol,title,subtitle){ws.mergeCells(`A1:${lastCol}1`);ws.getCell('A1').value=title;ws.getRow(1).height=34;ws.getCell('A1').font={name:'Calibri',size:22,bold:true,color:{argb:ARGB(GREEN)}};ws.getCell('A1').alignment={horizontal:'center',vertical:'middle',readingOrder:'rtl'};ws.mergeCells(`A2:${lastCol}2`);ws.getCell('A2').value=subtitle;ws.getRow(2).height=24;ws.getCell('A2').font={name:'Calibri',size:12,bold:true,color:{argb:ARGB('33443F')}};ws.getCell('A2').alignment={horizontal:'center',vertical:'middle',readingOrder:'rtl'};}
  function styleHeader(row){row.height=38;row.eachCell({includeEmpty:true},c=>{c.font={name:'Calibri',size:10,bold:true,color:{argb:ARGB('FFFFFF')}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:ARGB(GREEN)}};c.alignment={horizontal:'center',vertical:'middle',wrapText:true,readingOrder:'rtl'};c.border=excelBorder();});}
  function statusFill(symbol){return({ح:'D9EAD3',غ:'F4CCCC','إ':'D9EAF7','غ م':'FCE5CD',ر:'E7E6E6',م:'E4D7F5','-':'FFFFFF'})[symbol]||'FFFFFF';}

  async function addMainPayrollSheet(wb,month,details,filters){
    const ws=wb.addWorksheet('كشف الرواتب',{views:[{rightToLeft:true,state:'frozen',ySplit:3,activeCell:'A4',showGridLines:false}],pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9,margins:{left:.2,right:.2,top:.35,bottom:.35,header:.15,footer:.15},printTitlesRow:'1:3'}});
    const headers=['م','كود الموظف','اسم الموظف في الإقامة','الاسم الحركي','رقم الإقامة','الفئة','المسمى الوظيفي','المشرف','مكان العمل','تاريخ المباشرة','بداية الفترة','نهاية الفترة','أيام الشهر المعتمدة','أيام الحضور','أيام الغياب','أيام الإجازة المدفوعة','أيام الإجازة غير المدفوعة','الأيام المستحقة','الراتب الأساسي','البدلات','إجمالي الراتب','قيمة اليوم','راتب الأيام المستحقة','العمولات','الخصومات','خصم السلف','جبر الكسور','صافي الراتب','ملاحظات','الحالة','المعرف الموحد'];
    addTitle(ws,'AE','كشف الرواتب',`الشهر: ${month} — شركة تصنيف لإدارة المرافق — ${filterSummary(filters)}`);
    ws.getRow(3).values=headers;styleHeader(ws.getRow(3));
    const moneyCols=new Set([19,20,21,22,23,24,25,26,27,28]);
    details.forEach((x,i)=>{const row=ws.addRow([i+1,x.code,x.iqamaName,x.name,x.iqamaNumber,x.roleLabel,x.originalJobTitle,x.supervisorName,x.workplace,x.workStart,x.eligibilityStart,x.eligibilityEnd,x.eligibleDays,0,0,0,0,0,x.basic,x.allowances,0,0,0,x.commissions,x.deductions,x.advances,0,0,x.notes,x.status,x.employeeKey]);const rn=row.number;row.getCell(14).value={formula:`IFERROR(XLOOKUP($AE${rn},'التحضير الشهري'!$J:$J,'التحضير الشهري'!$AO:$AO,0),0)`,result:x.attendanceCount};row.getCell(15).value={formula:`IFERROR(XLOOKUP($AE${rn},'التحضير الشهري'!$J:$J,'التحضير الشهري'!$AP:$AP,0),0)`,result:x.absent};row.getCell(16).value={formula:`IFERROR(XLOOKUP($AE${rn},'التحضير الشهري'!$J:$J,'التحضير الشهري'!$AQ:$AQ,0),0)`,result:x.paidLeave};row.getCell(17).value={formula:`IFERROR(XLOOKUP($AE${rn},'التحضير الشهري'!$J:$J,'التحضير الشهري'!$AR:$AR,0),0)`,result:x.unpaidLeave};row.getCell(18).value={formula:`MIN(M${rn},N${rn}+P${rn})`,result:x.dueDays};row.getCell(21).value={formula:`S${rn}+T${rn}`,result:x.gross};row.getCell(22).value={formula:`IFERROR(U${rn}/30,0)`,result:x.gross/30};row.getCell(23).value={formula:`V${rn}*R${rn}`,result:x.periodSalary};row.getCell(27).value={formula:`ROUND(W${rn}+X${rn}-Y${rn}-Z${rn},0)-(W${rn}+X${rn}-Y${rn}-Z${rn})`,result:x.rounding};row.getCell(28).value={formula:`W${rn}+X${rn}-Y${rn}-Z${rn}+AA${rn}`,result:x.net};row.height=24;const sup=x.roleGroup==='supervisor';row.eachCell({includeEmpty:true},(c,col)=>styleCell(c,{fill:sup?'DCEFE8':(i%2?'F8FBFA':'EEF7F4'),bold:sup,numFmt:moneyCols.has(col)?'#,##0.00 "ر.س"':([1,13,14,15,16,17,18].includes(col)?'0':undefined)}));[20,24,25,26,29].forEach(col=>{row.getCell(col).protection={locked:false};row.getCell(col).fill={type:'pattern',pattern:'solid',fgColor:{argb:ARGB('FFF7D6')}};});});
    const first=4,last=3+details.length,total=ws.addRow(['الإجمالي','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','']);ws.mergeCells(total.number,1,total.number,18);for(let col=19;col<=28;col++){const letter=ws.getColumn(col).letter;total.getCell(col).value={formula:`SUM(${letter}${first}:${letter}${last})`,result:details.reduce((a,x)=>a+N(({19:x.basic,20:x.allowances,21:x.gross,22:x.gross/30,23:x.periodSalary,24:x.commissions,25:x.deductions,26:x.advances,27:x.rounding,28:x.net})[col]),0)};}total.eachCell({includeEmpty:true},(c,col)=>styleCell(c,{fill:'D7EEE6',bold:true,numFmt:moneyCols.has(col)?'#,##0.00 "ر.س"':undefined}));
    ws.columns=[6,14,28,23,16,12,20,22,30,14,14,14,14,12,11,16,17,14,15,13,15,13,18,13,13,13,13,15,30,11,18].map(width=>({width}));ws.getColumn('AE').hidden=true;ws.autoFilter={from:'A3',to:`AD${Math.max(3,last)}`};ws.headerFooter.oddHeader='شركة تصنيف لإدارة المرافق — كشف الرواتب';ws.headerFooter.oddFooter='صفحة &P من &N';
    /* V10833-EDITABLE: الورقة غير محمية حتى تكون جميع الخلايا قابلة للتعديل في Excel. */ return ws;
  }
  async function addMonthlyAttendanceSheet(wb,month,details){
    const ws=wb.addWorksheet('التحضير الشهري',{views:[{rightToLeft:true,state:'frozen',ySplit:3,xSplit:10,showGridLines:false}],pageSetup:{orientation:'landscape',fitToPage:false,paperSize:9,printTitlesRow:'1:3'}});
    const days=Array.from({length:PAYROLL_DAYS},(_,i)=>String(i+1).padStart(2,'0'));
    const headers=['م','كود الموظف','الاسم الحركي','الاسم في الإقامة','الفئة','المسمى الوظيفي','المشرف','مكان العمل','تاريخ المباشرة','المعرف الموحد',...days,'أيام الحضور','أيام الغياب','إجازة مدفوعة','إجازة غير مدفوعة','مأمورية','راحة','غير محسوم','الأيام المستحقة','الراتب الأساسي','البدلات','إجمالي الراتب','صافي الراتب'];
    addTitle(ws,'AZ','التحضير الشهري',`مطابق لتوزيع النظام الموحد — كل مشرف ثم عمالته دون تكرار — الشهر ${month}`);ws.getRow(3).values=headers;styleHeader(ws.getRow(3));
    let seq=0;const dataRows=[];const groups=supervisorGroups(details);
    groups.forEach((g,gIndex)=>{
      const workers=g.rows.filter(x=>x.roleGroup!=='supervisor'),projects=[...new Set(workers.flatMap(x=>A(x.projects)).filter(Boolean))];
      const section=ws.addRow([`المشرف: ${g.name} | عدد العمالة: ${workers.length} | المشاريع: ${projects.join('، ')||'-'}`]);ws.mergeCells(section.number,1,section.number,52);section.height=27;section.getCell(1).font={bold:true,size:13,color:{argb:ARGB('FFFFFF')}};section.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:ARGB(g.key==='unassigned'?'777777':GREEN)}};section.getCell(1).alignment={horizontal:'right',vertical:'middle',readingOrder:'rtl'};
      const projectGroups=new Map();g.rows.forEach(x=>{const key=x.roleGroup==='supervisor'?'__supervisor__':(x.primaryProject||'بدون مشروع');if(!projectGroups.has(key))projectGroups.set(key,[]);projectGroups.get(key).push(x);});
      [...projectGroups.entries()].forEach(([projectNameKey,rows])=>{
        if(projectNameKey!=='__supervisor__'){
          const pr=ws.addRow([`المشروع: ${projectNameKey} | الموظفون: ${rows.length}`]);ws.mergeCells(pr.number,1,pr.number,52);pr.height=22;pr.getCell(1).font={bold:true,size:11,color:{argb:ARGB(GREEN)}};pr.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:ARGB('D7EEE6')}};pr.getCell(1).alignment={horizontal:'right',readingOrder:'rtl'};
        }
        rows.sort((a,b)=>N(a.roleOrder)-N(b.roleOrder)||S(a.name).localeCompare(S(b.name),'ar')).forEach(x=>{
          seq++;const values=[seq,x.code,x.name,x.iqamaName,x.roleLabel,x.originalJobTitle,x.supervisorName,x.workplace,x.workStart,x.employeeKey];for(let d=1;d<=PAYROLL_DAYS;d++)values.push(symbolForDay(x,month,d));values.push(0,0,0,0,0,0,0,0,x.basic,x.allowances,0,0);
          const row=ws.addRow(values),rn=row.number;dataRows.push(rn);row.getCell(41).value={formula:`COUNTIF(K${rn}:AN${rn},"ح")+COUNTIF(K${rn}:AN${rn},"م")`,result:x.attendanceCount};row.getCell(42).value={formula:`COUNTIF(K${rn}:AN${rn},"غ")`,result:x.absent};row.getCell(43).value={formula:`COUNTIF(K${rn}:AN${rn},"إ")`,result:x.paidLeave};row.getCell(44).value={formula:`COUNTIF(K${rn}:AN${rn},"غ م")`,result:x.unpaidLeave};row.getCell(45).value={formula:`COUNTIF(K${rn}:AN${rn},"م")`,result:x.mission};row.getCell(46).value={formula:`COUNTIF(K${rn}:AN${rn},"ر")`,result:x.weeklyOff};row.getCell(47).value={formula:`COUNTIF(K${rn}:AN${rn},"-")`,result:PAYROLL_DAYS-x.attendanceCount-x.absent-x.paidLeave-x.unpaidLeave-x.weeklyOff};row.getCell(48).value={formula:`MIN(30,AO${rn}+AQ${rn})`,result:x.dueDays};row.getCell(50).value={formula:`IFERROR(XLOOKUP($J${rn},'كشف الرواتب'!$AE:$AE,'كشف الرواتب'!$T:$T,0),0)`,result:x.allowances};row.getCell(51).value={formula:`AW${rn}+AX${rn}`,result:x.gross};row.getCell(52).value={formula:`IFERROR(XLOOKUP($J${rn},'كشف الرواتب'!$AE:$AE,'كشف الرواتب'!$AB:$AB,0),0)`,result:x.net};row.height=22;row.eachCell({includeEmpty:true},(c,col)=>styleCell(c,{fill:x.roleGroup==='supervisor'?'DCEFE8':(seq%2?'F8FBFA':'EEF7F4'),bold:x.roleGroup==='supervisor',size:9,numFmt:col>=49?'#,##0.00 "ر.س"':undefined}));for(let col=11;col<=40;col++){const cell=row.getCell(col);cell.protection={locked:false};cell.dataValidation={type:'list',allowBlank:false,formulae:['"ح,غ,إ,غ م,ر,م,-"'],showErrorMessage:true,errorTitle:'حالة غير صحيحة',error:'اختر حالة من القائمة.'};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:ARGB(statusFill(cell.value))}};}
        });
      });
    });
    ws.columns=[6,14,22,28,11,18,22,30,14,18,...Array(PAYROLL_DAYS).fill(5),12,11,13,15,11,9,12,13,15,13,15,15].map(width=>({width}));
    dataRows.forEach(rn=>{ws.getRow(rn).eachCell({includeEmpty:true},c=>{if(c.value&&typeof c.value==='object'&&c.value.formula)c.protection={locked:true};});});
    /* V10833-EDITABLE: التحضير الشهري غير محمي وتبقى القوائم والمعادلات فعالة. */ return ws;
  }
  function addGroupedSheet(wb,details){
    const ws=wb.addWorksheet('حسب المشرف والمشروع',{views:[{rightToLeft:true,state:'frozen',ySplit:1,showGridLines:false}]});
    const headers=['المشرف','المشروع الرئيسي','كل المشاريع','الفئة','كود الموظف','الاسم الحركي','الاسم في الإقامة','رقم الإقامة','مكان العمل','بداية الفترة','نهاية الفترة','أيام الحضور','أيام الغياب','الراتب الأساسي','صافي الراتب','الحالة'];
    ws.addRow(headers);styleHeader(ws.getRow(1));let seq=0;
    supervisorGroups(details).forEach((g,gIndex)=>{
      const workers=g.rows.filter(x=>x.roleGroup!=='supervisor'),projects=[...new Set(workers.flatMap(x=>A(x.projects)).filter(Boolean))];
      const sr=ws.addRow([`المشرف: ${g.name} | العمالة: ${workers.length} | المشاريع: ${projects.join('، ')||'-'}`]);ws.mergeCells(sr.number,1,sr.number,16);sr.getCell(1).font={bold:true,size:13,color:{argb:ARGB('FFFFFF')}};sr.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:ARGB(g.key==='unassigned'?'777777':GREEN)}};sr.getCell(1).alignment={horizontal:'right',readingOrder:'rtl'};
      g.rows.forEach(x=>{seq++;const r=ws.addRow([x.supervisorName,x.primaryProject,x.projects.join('، '),x.roleLabel,x.code,x.name,x.iqamaName,x.iqamaNumber,x.workplace,x.eligibilityStart,x.eligibilityEnd,x.attendanceCount,x.absent,x.basic,x.net,x.status]);r.eachCell({includeEmpty:true},(c,col)=>styleCell(c,{fill:x.roleGroup==='supervisor'?'DCEFE8':(seq%2?'F8FBFA':'EEF7F4'),bold:x.roleGroup==='supervisor',numFmt:[14,15].includes(col)?'#,##0.00 "ر.س"':undefined}));});
    });
    ws.columns=[24,25,35,12,14,24,28,16,30,14,14,12,11,15,15,11].map(width=>({width}));ws.autoFilter={from:'A1',to:`P${Math.max(1,ws.rowCount)}`};return ws;
  }

  function addSummarySheet(wb){const ws=wb.addWorksheet('ملخص الرواتب',{views:[{rightToLeft:true,showGridLines:false}]});addTitle(ws,'J','ملخص الرواتب','إجماليات حسب الفئة — مرتبطة مباشرة بورقة كشف الرواتب');const headers=['الفئة','عدد الموظفين','إجمالي الأساسي','إجمالي البدلات','إجمالي راتب الأيام','إجمالي العمولات','إجمالي الخصومات','إجمالي السلف','إجمالي جبر الكسور','إجمالي الصافي'];ws.getRow(3).values=headers;styleHeader(ws.getRow(3));const cats=['عامل','فني','حارس','مشرف','موظف'];cats.forEach((cat,i)=>{const rn=4+i,r=ws.addRow([cat]);r.getCell(2).value={formula:`COUNTIF('كشف الرواتب'!$F:$F,A${rn})`};for(const [col,src] of [[3,'S'],[4,'T'],[5,'W'],[6,'X'],[7,'Y'],[8,'Z'],[9,'AA'],[10,'AB']])r.getCell(col).value={formula:`SUMIF('كشف الرواتب'!$F:$F,A${rn},'كشف الرواتب'!$${src}:$${src})`};r.eachCell({includeEmpty:true},(c,col)=>styleCell(c,{fill:i%2?'F8FBFA':'EEF7F4',numFmt:col>=3?'#,##0.00 "ر.س"':undefined}));});const total=ws.addRow(['الإجمالي']);for(let col=2;col<=10;col++){const l=ws.getColumn(col).letter;total.getCell(col).value={formula:`SUM(${l}4:${l}8)`};}total.eachCell({includeEmpty:true},(c,col)=>styleCell(c,{fill:'D7EEE6',bold:true,numFmt:col>=3?'#,##0.00 "ر.س"':undefined}));ws.columns=[16,14,...Array(8).fill(18)].map(width=>({width}));return ws;}

  function addGuideSheet(wb,filters,diagnostics,meta){const ws=wb.addWorksheet('الدليل',{views:[{rightToLeft:true,showGridLines:false}]});addTitle(ws,'D','دليل ملف الرواتب','طريقة التعديل والمعادلات والتشخيص');const rows=[['البند','التوضيح'],['الفلاتر المطبقة',filterSummary(filters)],['مصدر الموظفين','الموظفون النشطون أولًا، ثم LEFT JOIN منطقي مع التوزيع والحضور والرواتب.'],['المعرف الموحد','canonical_employee_id أو معرف الموظف/العامل أو الكود أو رقم الإقامة؛ لا يتم حذف موظف بالاسم.'],['دورة الراتب','30 يومًا ثابتة. قيمة اليوم = إجمالي الراتب ÷ 30.'],['ح','حضور'],['غ','غياب'],['إ','إجازة مدفوعة'],['غ م','إجازة غير مدفوعة'],['ر','راحة'],['م','مأمورية وتُحتسب ضمن الحضور المستحق'],['-','غير محسوم أو قبل المباشرة؛ لا يُعتبر غيابًا تلقائيًا.'],['معادلة الحضور',"'=COUNTIF(K4:AN4,\"ح\")+COUNTIF(K4:AN4,\"م\")"],['معادلة الأيام المستحقة',"'=MIN(أيام الشهر المعتمدة, أيام الحضور + الإجازة المدفوعة)"],['معادلة قيمة اليوم',"'=إجمالي الراتب/30"],['معادلة راتب الأيام',"'=قيمة اليوم*الأيام المستحقة"],['معادلة جبر الكسور',"'=ROUND(راتب الأيام+العمولات-الخصومات-السلف,0)-(راتب الأيام+العمولات-الخصومات-السلف)"],['معادلة الصافي',"'=راتب الأيام+العمولات-الخصومات-السلف+جبر الكسور"],['الغياب','لا يخصم مرة ثانية؛ انخفاض الأيام المستحقة هو خصم الغياب.'],['الخلايا القابلة للتعديل','أيام التحضير، البدلات، العمولات، الخصومات، السلف، والملاحظات.'],['عدد الموظفين النشطين قبل الفلتر',diagnostics.activeEmployeesCount],['عدد الموظفين بعد الفلاتر الأساسية',diagnostics.employeesAfterFilters],['عدد الموظفين بعد الدمج',diagnostics.employeesAfterJoin],['عدد الموظفين بعد إزالة التكرار',diagnostics.uniqueEmployeesCount],['عدد الموظفين المصدرين',diagnostics.exportedEmployeesCount],['الموظفون المفقودون',A(diagnostics.missingEmployees).join('، ')||'لا يوجد'],['التكرارات المعالجة',A(diagnostics.duplicatedEmployees).join('، ')||'لا يوجد'],['هويات ضعيفة تحتاج مراجعة',A(diagnostics.weakIdentityEmployees).join('، ')||'لا يوجد'],['سجلات حضور غير مرتبطة',N(meta?.unresolved)],['سجلات حضور مستبعدة أو ملغاة',N(meta?.ignored)],['زمن تجهيز البيانات قبل إنشاء المصنف (مللي ثانية)',N(diagnostics?.dataPreparationMs)],['ملاحظة','تعديل ملف Excel لا يغير قاعدة البيانات.']];ws.getRow(3).values=rows[0];styleHeader(ws.getRow(3));rows.slice(1).forEach((r,i)=>{const row=ws.addRow(r);row.eachCell({includeEmpty:true},c=>styleCell(c,{fill:i%2?'F8FBFA':'FFFFFF',align:'right'}));});ws.columns=[34,100,15,15].map(width=>({width}));return ws;}

  async function buildWorkbook(month,details,filters,diagnostics,meta){const ExcelJS=await loadExcelJs();const wb=new ExcelJS.Workbook();wb.creator='شركة تصنيف لإدارة المرافق';wb.company='شركة تصنيف لإدارة المرافق';wb.created=new Date();wb.modified=new Date();wb.views=[{rightToLeft:true}];wb.calcProperties.fullCalcOnLoad=true;wb.calcProperties.forceFullCalc=true;wb.calcProperties.calcMode='auto';await addMainPayrollSheet(wb,month,details,filters);await addMonthlyAttendanceSheet(wb,month,details);addGroupedSheet(wb,details);addSummarySheet(wb);addGuideSheet(wb,filters,diagnostics,meta);return wb;}
  async function saveExcelJsWorkbook(wb,filename){const buffer=await wb.xlsx.writeBuffer();const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
  async function exportExcel(btn){
    btn=btn||$('cu413ExportWorkersExcel');if(btn?.disabled)return;const original=btn?.textContent||'تنزيل تقرير Excel احترافي';const started=performance.now();
    try{
      const f=currentFilters();if(!/^\d{4}-\d{2}$/.test(f.month))throw new Error('اختر شهرًا صحيحًا.');
      if(btn){btn.disabled=true;btn.textContent='جاري مطابقة النظام والتوزيع...';}
      showMsg('جاري استخدام نفس قائمة الموظفين ونفس توزيع النظام الموحد دون تكرار...');
      try{await window.tasneefCoreUnifiedV413?.reload?.(false);}catch(_){ }
      const b=monthBounds(f.month);
      const [master,legacy,projects,dist,attendance]=await Promise.all([
        safeFetch('employees_master_v386'),safeFetch('workers'),safeFetch('projects'),
        safeFetch('monthly_distribution',q=>q.eq('month_key',f.month).order('updated_at',{ascending:true}).order('project_name',{ascending:true})),
        safeFetch('attendance',q=>q.gte('attendance_date',b.start).lt('attendance_date',b.next).order('attendance_date',{ascending:true}))
      ]);
      let extraAssignments=[];if(!dist.length){const [links,assignments]=await Promise.all([safeFetch('worker_project_links_v386'),safeFetch('worker_project_assignments')]);extraAssignments=[...links,...assignments];}
      const exactCore=A(window.__tasneef_core_state?.allWorkers).filter(w=>!statusDeleted(w));
      const workers=mergeWorkers(exactCore.length?exactCore:master,exactCore.length?[]:legacy);if(!workers.length)throw new Error('لا توجد بيانات موظفين في النظام الموحد.');
      const index=buildEmployeeAliasIndex(workers),projectMap=new Map();A(projects).forEach(p=>{const id=projectId(p),name=projectName(p);if(id)projectMap.set(id,p);if(name)projectMap.set('name:'+norm(name),p);});
      const deduped=dedupeDistributionRows([...A(dist),...A(extraAssignments)],f.month,index,workers,projectMap),assignmentRows=deduped.rows;
      const assignmentsByEmployee=new Map(),supervisorProjects=new Map();
      assignmentRows.forEach(entry=>{
        const {row:r,employeeKey:key,sup,pi,updatedMs}=entry,weight=Math.max(1,assignmentOverlapDays(r,f.month)),pk=assignmentProjectKey(pi);
        if(sup.key!=='unassigned'){
          if(!supervisorProjects.has(sup.key))supervisorProjects.set(sup.key,{...sup,items:new Map()});
          supervisorProjects.get(sup.key).items.set(pk,{...pi,weight});
        }
        if(!assignmentsByEmployee.has(key))assignmentsByEmployee.set(key,{supervisors:new Map(),items:[],firstStart:'',lastEnd:''});
        const a=assignmentsByEmployee.get(key);
        if(!a.supervisors.has(sup.key))a.supervisors.set(sup.key,{...sup,weight:0,latestMs:0,projectKeys:new Set(),projectCount:0});
        const sg=a.supervisors.get(sup.key);sg.weight+=weight;sg.latestMs=Math.max(sg.latestMs,updatedMs);sg.projectKeys.add(pk);sg.projectCount=sg.projectKeys.size;
        a.items.push({...pi,weight,supervisor:sup,updatedMs});
        if(pi.start&&(!a.firstStart||pi.start<a.firstStart))a.firstStart=pi.start;if(pi.end&&(!a.lastEnd||pi.end>a.lastEnd))a.lastEnd=pi.end;
      });
      const attStats=buildAttendanceStats(attendance,index,f.month),payrollMap=await loadPayrollMap(f.month,index);
      const activeFilter={...f,status:'active'};const activeEmployeesCount=workers.filter(w=>workerOverlapsMonth(w,f.month)&&sourceMatchesBasicFilter(w,activeFilter)).length;
      const sourceCandidates=workers.filter(w=>workerOverlapsMonth(w,f.month)&&sourceMatchesBasicFilter(w,f));
      const keyCounts=new Map();sourceCandidates.forEach(w=>{const k=canonicalEmployeeKey(w);keyCounts.set(k,(keyCounts.get(k)||0)+1);});
      const duplicatedEmployees=[...keyCounts.entries()].filter(([,c])=>c>1).map(([k])=>k),weakIdentityEmployees=sourceCandidates.filter(w=>canonicalEmployeeKey(w).startsWith('source:')).map(w=>workerCode(w)||workerName(w));
      const detailRows=[],multiSupervisorConflicts=[];
      sourceCandidates.forEach(w=>{
        const employeeKey=canonicalEmployeeKey(w);if(!employeeKey)return;const rg=roleGroup(w),asg=assignmentsByEmployee.get(employeeKey)||{supervisors:new Map(),items:[],firstStart:'',lastEnd:''};
        let sup;if(rg==='supervisor'){const code=workerCode(w);sup={key:code?('code:'+norm(code)):employeeKey,code,name:workerName(w)};}else{sup=chooseAssignmentSupervisor(asg,f)||{key:'unassigned',code:'',name:'بدون مشرف'};if(asg.supervisors.size>1)multiSupervisorConflicts.push(`${workerCode(w)||workerName(w)}: ${[...asg.supervisors.values()].map(x=>x.name).join(' / ')}`);}
        let items=rg==='supervisor'?[...(supervisorProjects.get(sup.key)?.items?.values?.()||[])]:A(asg.items).filter(i=>i.supervisor?.key===sup.key);
        const uniqueProjects=new Map();items.forEach(i=>{const k=assignmentProjectKey(i);if(!uniqueProjects.has(k)||N(i.weight)>N(uniqueProjects.get(k).weight))uniqueProjects.set(k,i);});items=[...uniqueProjects.values()].sort((a,b)=>N(b.weight)-N(a.weight)||S(a.name).localeCompare(S(b.name),'ar'));
        const projectsList=items.map(i=>i.name).filter(Boolean),projectIds=items.map(i=>S(i.id)).filter(Boolean),primary=items[0]||{name:'بدون مشروع',type:'غير محدد',full:false};
        const workplaces=rg==='technician'&&!projectsList.length?['فني متنقل']:[...new Set(items.map(i=>i.full?i.name:sup.name).filter(Boolean))];
        const st=attStats.get(employeeKey)||{present:0,absent:0,leave:0,sick:0,unpaidLeave:0,mission:0,weeklyOff:0,recorded:0,days:new Map(),firstAttendanceDate:'',firstIn:'',lastOut:''};
        const eligibility=cycleEligibility(w,asg,st,f.month),attendanceCount=N(st.present)+N(st.mission),paidLeave=N(st.leave)+N(st.sick),dueDays=Math.min(eligibility.days,attendanceCount+paidLeave),fin=financialSnapshot(w,employeeKey,payrollMap,eligibility.days,dueDays);
        detailRows.push({employeeKey,roleGroup:rg,roleLabel:roleLabel(rg),roleOrder:{supervisor:0,technician:1,guard:2,worker:3,employee:4}[rg]??9,code:workerCode(w),name:workerName(w),iqamaName:workerIqamaName(w),iqamaNumber:workerIqamaNo(w),originalJobTitle:workerRole(w),supervisorKey:sup.key,supervisorCode:sup.code||'',supervisorName:sup.name||'بدون مشرف',projects:projectsList,projectIds,primaryProject:primary.name,primaryProjectType:primary.type,workplace:workplaces.join('، ')||(projectsList.join('، ')||'بدون توزيع'),workStart:workerStartDate(w),workEnd:workerEndDate(w),eligibilityStart:eligibility.start,eligibilityEnd:eligibility.end,eligibilityStartDay:eligibility.startDay||31,eligibilityEndDay:eligibility.endDay||0,eligibleDays:eligibility.days,firstIn:st.firstIn||'',lastOut:st.lastOut||'',attendanceCount,absent:N(st.absent),paidLeave,unpaidLeave:N(st.unpaidLeave),mission:N(st.mission),weeklyOff:N(st.weeklyOff),dueDays,basic:fin.basic,allowances:fin.allowances,gross:fin.gross,periodSalary:fin.periodSalary,commissions:fin.commissions,deductions:fin.deductions,advances:fin.advances,rounding:fin.rounding,net:fin.net,notes:[fin.notes,asg.supervisors.size>1?'يوجد أكثر من مشرف في التوزيع؛ تم اعتماد الربط الحالي دون تكرار.':''].filter(Boolean).join('، '),status:isActiveStatus(w)?'نشط':'موقوف',dayMap:st.days||new Map()});
      });
      const employeesAfterJoin=detailRows.length,uniqueMap=new Map();detailRows.forEach(x=>{if(!uniqueMap.has(x.employeeKey))uniqueMap.set(x.employeeKey,x);});
      const uniqueDetails=[...uniqueMap.values()],sourceKeys=new Set(sourceCandidates.map(canonicalEmployeeKey)),missingEmployees=[...sourceKeys].filter(k=>!uniqueMap.has(k)).map(k=>workerCode(index.employeeByKey.get(k))||workerName(index.employeeByKey.get(k))||k);
      const filtered=sortByUnifiedHierarchy(uniqueDetails.filter(x=>detailMatchesExactFilter(x,f)));if(!filtered.length)throw new Error('لا توجد بيانات مطابقة للفلاتر الحالية.');
      const diagnostics={activeEmployeesCount,employeesAfterFilters:sourceCandidates.length,employeesAfterJoin,uniqueEmployeesCount:uniqueDetails.length,exportedEmployeesCount:filtered.length,missingEmployees,duplicatedEmployees,distributionDuplicateRows:deduped.duplicates,multiSupervisorConflicts:[...new Set(multiSupervisorConflicts)],weakIdentityEmployees,dataPreparationMs:Math.round(performance.now()-started),generationMs:0};console.table(diagnostics);
      const wb=await buildWorkbook(f.month,filtered,f,diagnostics,attStats.meta||{});diagnostics.generationMs=Math.round(performance.now()-started);
      const guide=wb.getWorksheet('الدليل');if(guide){[['صفوف توزيع مكررة تم دمجها',diagnostics.distributionDuplicateRows.length],['موظفون ظهر لهم أكثر من مشرف وتم منع تكرارهم',diagnostics.multiSupervisorConflicts.join('، ')||'لا يوجد'],['الزمن الكلي لإنشاء الملف قبل التنزيل (مللي ثانية)',diagnostics.generationMs]].forEach(v=>{const rr=guide.addRow(v);rr.eachCell({includeEmpty:true},c=>styleCell(c,{fill:'EAF5F0',bold:true,align:'right'}));});}
      await saveExcelJsWorkbook(wb,`كشف_الموظفين_والرواتب_${f.month}.xlsx`);showMsg(`تم تنزيل ${filtered.length} موظفًا مطابقين للنظام. المفقود: ${missingEmployees.length}، التكرار: 0.`);
    }catch(e){console.error(VERSION,e);showMsg('تعذر تنزيل Excel: '+(e?.message||e),true);}finally{if(btn){btn.disabled=false;btn.textContent=original;}}
  }

  function bind(){const btn=$('cu413ExportWorkersExcel');if(!btn||btn.dataset.v10833==='1')return;btn.dataset.v10833='1';btn.onclick=function(e){e?.preventDefault?.();exportExcel(btn);return false;};btn.textContent='تنزيل كشف الموظفين والرواتب Excel';window.exportSupervisorEmployeesExcelV10833=exportExcel;window.exportSupervisorEmployeesExcel=exportExcel;if(window.tasneefCoreUnifiedV413)window.tasneefCoreUnifiedV413.exportSupervisorEmployeesExcel=()=>exportExcel($('cu413ExportWorkersExcel'));}
  window.__tasneefUnifiedPayrollDiagnosticsV10833={roleGroup,canonicalEmployeeKey,detailMatchesExactFilter,cycleEligibility,attendanceSymbol,mergeWorkers,buildEmployeeAliasIndex,resolveEmployeeKey,dedupeDistributionRows,sortByUnifiedHierarchy,supervisorGroups,chooseAssignmentSupervisor};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,1400));window.addEventListener('load',()=>setTimeout(bind,1800));document.addEventListener('click',e=>{if(e.target.closest('#coreUnified [data-tab="workers"]'))setTimeout(bind,250);});try{new MutationObserver(()=>bind()).observe(document.body,{childList:true,subtree:true});}catch(_){ }setTimeout(bind,2200);
  console.log('Tasneef',VERSION,'exact unified distribution payroll Excel loaded');
})();

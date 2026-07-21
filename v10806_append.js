/* ===== TASNEEF V10806 - Professional filtered supervisor employee Excel ===== */
(function(){
  'use strict';
  if(window.__tasneefUnifiedEmployeesExcelV10806) return;
  window.__tasneefUnifiedEmployeesExcelV10806 = true;

  const VERSION = 'V10806';
  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const N = v => Number(String(v ?? '').replace(/,/g,'')) || 0;
  const A = v => Array.isArray(v) ? v : [];
  const norm = v => S(v).toLowerCase()
    .replace(/[إأآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه')
    .replace(/[\u064B-\u0652]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
  const showMsg = (text,err)=>{ try{ if(typeof msg==='function') return msg(text, err?'err':'ok'); }catch(_){ } try{ alert(text); }catch(_){ } };
  const sbClient = () => window.sb || window.supabaseClient || (typeof client==='function' ? client() : null);

  function todayMonth(){ try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);}catch(_){return new Date().toISOString().slice(0,7);} }
  function riyadhToday(){ try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }catch(_){ return new Date().toISOString().slice(0,10); } }
  function monthBounds(m){ const start = S(m||todayMonth())+'-01'; const d = new Date(start+'T00:00:00'); d.setMonth(d.getMonth()+1); const next=d.toISOString().slice(0,10); const end=new Date(new Date(next+'T00:00:00').getTime()-86400000).toISOString().slice(0,10); return {start,next,end}; }
  function reportPeriod(m){ const b=monthBounds(m), today=riyadhToday(); let cutoff=b.end; if(today<b.start) cutoff=''; else if(today<b.end) cutoff=today; return {...b, cutoff}; }
  function dateDaysInclusive(start,end){ if(!start||!end||end<start) return 0; const a=Date.parse(start+'T12:00:00'), z=Date.parse(end+'T12:00:00'); return Number.isFinite(a)&&Number.isFinite(z) ? Math.floor((z-a)/86400000)+1 : 0; }
  function dateOnly(v){ return S(v).slice(0,10); }
  function timeText(v){ const x=S(v); if(!x) return ''; if(/^\d{2}:\d{2}/.test(x)) return x.slice(0,5); const m=x.match(/T(\d{2}:\d{2})/); return m?m[1]:x.slice(0,16).replace('T',' '); }
  function dateTimeLabel(date,val){ const t=timeText(val); return date ? (date + (t ? ' '+t : '')) : (t||''); }
  function normalizeCode(v){ return S(v).toUpperCase().replace(/\s+/g,'').replace(/_/g,'-'); }
  function statusDeleted(x){ const s=norm(x?.status||x?.state||''); return x?.deleted_at || x?.is_deleted===true || ['deleted','محذوف','ملغي'].includes(s); }
  function isActiveStatus(x){ const s=norm(x?.status||x?.state||'active'); return !(x?.is_active===false || ['inactive','stopped','stop','disabled','deleted','ended','موقوف','متوقف','محذوف','منتهي','غير نشط','غيرنشط'].includes(s)); }
  function roleText(w){ return S(w?.job_title || w?.role || w?.position || w?.job || w?.category || w?.worker_role || w?.type_label || ''); }
  function workerName(w){ return S(w?.name || w?.app_name || w?.employee_name || w?.full_name || w?.worker_name || w?.worker_display_name || w?.worker_identity || w?.display_name || ''); }
  function workerCode(w){ return normalizeCode(w?.worker_employee_code || w?.employee_code || w?.employee_number || w?.worker_code || w?.code || w?.employee_ts_id || ''); }
  function workerIqamaNo(w){ return S(w?.iqama_number || w?.residency_number || w?.national_id || w?.id_number || ''); }
  function workerIqamaName(w){ return S(w?.iqama_name || w?.residency_name || w?.official_name || ''); }
  function workerStartDate(w){ return dateOnly(w?.work_start_date || w?.start_date || w?.join_date || w?.employment_start_date || w?.hiring_date || w?.created_at || ''); }
  function workerEndDate(w){ return dateOnly(w?.work_end_date || w?.end_date || w?.termination_date || w?.employment_end_date || ''); }
  function workerBasicSalary(w){ return N(w?.basic_salary || w?.salary_basic || w?.salary || w?.base_salary); }
  function workerAllowances(w){ return N(w?.allowances || w?.housing_allowance || 0) + N(w?.transport_allowance || 0) + N(w?.food_allowance || 0) + N(w?.other_allowances || 0); }
  function workerTotalSalary(w){ const direct=N(w?.total_salary || w?.salary_total || w?.net_salary); return direct || (workerBasicSalary(w) + workerAllowances(w)); }
  function workerPhone(w){ return S(w?.phone || w?.mobile || w?.phone_number || w?.whatsapp || ''); }
  function projectNameFromRow(r){ return S(r?.project_name || r?.project_display_name || r?.project_title || ''); }
  function employeeServiceRange(w,m){ const p=reportPeriod(m); const start=[p.start,workerStartDate(w)].filter(Boolean).sort().pop()||p.start; const rawEnd=workerEndDate(w); const endCandidates=[p.cutoff,rawEnd].filter(Boolean).sort(); const end=endCandidates.length ? endCandidates[0] : ''; return {start,end,days:dateDaysInclusive(start,end)}; }
  function workerOverlapsMonth(w,m){ const b=monthBounds(m), st=workerStartDate(w)||'1900-01-01', en=workerEndDate(w)||'9999-12-31'; return st < b.next && en >= b.start; }
  function isSupervisorLike(w){ const r=norm(roleText(w)); return r.includes('مشرف') || r.includes('supervisor'); }
  function roleGroup(w){ const r=norm(roleText(w)); if(r.includes('فني')||r.includes('technician')||r.includes('tech')) return 'technician'; if(r.includes('حارس')||r.includes('امن')||r.includes('security')||r.includes('guard')) return 'guard'; if(r.includes('مشرف')||r.includes('supervisor')) return 'supervisor'; if(r.includes('عامل')||r.includes('clean')||r.includes('worker')||r.includes('janitor')) return 'worker'; return 'employee'; }
  function roleGroupLabel(g){ return ({worker:'العمال',technician:'الفنيون',guard:'الحراس',employee:'الموظفون',supervisor:'المشرفون'})[g] || 'الموظفون'; }
  function employeeNameVariants(v){ const raw=S(v); if(!raw) return []; const out=[]; const add=x=>{ x=S(x); if(x) out.push(x); };
    add(raw); add(raw.replace(/^TS[-_\s]?\d+\s*[-–—:|]?\s*/i,'')); add(raw.replace(/\(.*?\)/g,' ').replace(/\s+/g,' ').trim());
    [...raw.matchAll(/[\(（]+([^\)）]+)[\)）]+/g)].forEach(m=>add(m[1])); raw.split(/[\/|،,–—]+/).forEach(add);
    return [...new Set(out.map(S).filter(Boolean))]; }
  function employeeIdentityAliases(x){ const out=[]; const add=(kind,v)=>{ v=S(v); if(!v) return; const k = kind+':'+norm(v); if(!out.includes(k)) out.push(k); };
    [x?.worker_employee_code,x?.worker_code,x?.employee_code,x?.employee_ts_id,x?.code,x?.emp_code].forEach(v=>{ const c=normalizeCode(v); if(c) add('code',c); });
    [x?.canonical_employee_id,x?.canonical_worker_id,x?.employee_id,x?.worker_id,x?.staff_id,x?.person_id,x?.user_id,x?.id].forEach(v=>add('id',v));
    [x?.worker_name,x?.worker_display_name,x?.worker_identity,x?.app_name,x?.display_name,x?.name,x?.full_name,x?.employee_name,x?.iqama_name,x?.residency_name].forEach(v=>employeeNameVariants(v).forEach(n=>add('name',n)));
    return out;
  }
  function canonicalEmployeeKey(w){ const aliases=employeeIdentityAliases(w); return aliases.find(x=>x.startsWith('code:')) || aliases.find(x=>x.startsWith('id:')) || aliases.find(x=>x.startsWith('name:')) || ''; }
  function buildEmployeeAliasIndex(workers){ const aliasToKey=new Map(), employeeByKey=new Map(); A(workers).forEach(w=>{ const key=canonicalEmployeeKey(w); if(!key) return; employeeByKey.set(key,w); employeeIdentityAliases(w).forEach(a=>{ if(!aliasToKey.has(a) || a.startsWith('code:')) aliasToKey.set(a,key); }); }); return {aliasToKey, employeeByKey}; }
  function resolveEmployeeKey(record,index){ const aliases=employeeIdentityAliases(record), priorities=['code:','id:','name:']; for(const p of priorities) for(const a of aliases) if(a.startsWith(p) && index.aliasToKey.has(a)) return index.aliasToKey.get(a); return ''; }
  function attendanceStatus(v){ const x=norm(v); if(['absent','غائب','غياب','غ','a'].includes(x)) return 'absent'; if(['late','متاخر','متأخر'].includes(x)) return 'late'; if(['early_leave','خروج مبكر','انصراف مبكر'].includes(x)) return 'early_leave'; if(['present','حاضر','حضور','ح','p'].includes(x)) return 'present'; if(['leave','اجازه','إجازه','اجازة','إجازة'].includes(x)) return 'leave'; if(['sick','مرضي','مرضى','اجازه مرضيه','إجازة مرضية'].includes(x)) return 'sick'; if(['mission','ماموريه','مأمورية'].includes(x)) return 'mission'; if(['weekly_off','راحه اسبوعيه','راحة أسبوعية','off'].includes(x)) return 'weekly_off'; return x||''; }
  function attendanceDateOf(a){ return S(a?.attendance_date||a?.work_date||a?.record_date||a?.log_date||a?.date||a?.check_in||a?.created_at||'').slice(0,10); }
  function attendanceInOf(a){ return S(a?.check_in_time||a?.check_in||a?.in_time||a?.start_time||a?.login_time||''); }
  function attendanceOutOf(a){ return S(a?.check_out_time||a?.check_out||a?.out_time||a?.end_time||a?.logout_time||''); }
  function attendanceStamp(a){ const raw=S(a?.updated_at||a?.created_at||a?.attendance_date||''); const ms=Date.parse(raw); return Number.isFinite(ms) ? ms : N(a?.id); }
  function attendanceIgnored(a){ const s=norm(a?.status||a?.attendance_status||a?.state||''); return !!(a?.deleted_at||a?.is_deleted===true||a?.is_cancelled===true||['cancelled','canceled','rejected','failed','deleted','ملغي','مرفوض','محذوف','غير معتمد'].includes(s)); }
  function attendanceMoment(date,val,fallback){ const x=S(val); if(!x) return fallback||0; let ms=Date.parse(x); if(Number.isFinite(ms)) return ms; const t=timeText(x); ms=Date.parse(date+'T'+(t||'00:00')+':00'); return Number.isFinite(ms) ? ms : (fallback||0); }
  function mergeAttendanceDay(records,date){
    const rows=A(records).filter(a=>!attendanceIgnored(a)).sort((a,b)=>attendanceStamp(a)-attendanceStamp(b));
    const statuses=rows.map(a=>attendanceStatus(a.status||a.attendance_status||a.state));
    const hasClock=rows.some(a=>attendanceInOf(a)||attendanceOutOf(a));
    const hasPresent=hasClock || statuses.some(s=>['present','late','early_leave'].includes(s));
    const hasAbsent=statuses.includes('absent');
    let status='';
    if(hasPresent){ if(statuses.includes('late')) status='late'; else if(statuses.includes('early_leave')) status='early_leave'; else status='present'; }
    else if(hasAbsent) status='absent';
    else { const last=[...statuses].reverse().find(s=>['leave','sick','mission','weekly_off'].includes(s)); status=last||''; }
    const ins=rows.filter(a=>attendanceInOf(a)).map(a=>({v:attendanceInOf(a), ms:attendanceMoment(date,attendanceInOf(a),attendanceStamp(a))})).sort((a,b)=>a.ms-b.ms);
    const outs=rows.filter(a=>attendanceOutOf(a)).map(a=>({v:attendanceOutOf(a), ms:attendanceMoment(date,attendanceOutOf(a),attendanceStamp(a))})).sort((a,b)=>a.ms-b.ms);
    return {date,status,firstIn:ins[0]?.v||'',lastOut:outs[outs.length-1]?.v||'',conflict:hasPresent&&hasAbsent,rawCount:rows.length};
  }
  async function fetchPagedRows(table, configure){ const c=sbClient(); if(!c) throw new Error('الاتصال بقاعدة البيانات غير جاهز'); const out=[]; let start=0; const size=1000; while(start<200000){ let q=c.from(table).select('*'); q=configure(q); q=q.range(start,start+size-1); const r=await q; if(r.error) throw r.error; const rows=r.data||[]; out.push(...rows); if(rows.length<size) break; start+=size; } return out; }
  function buildEmployeeAttendanceStats(attendanceRows,index,month){
    const p=reportPeriod(month), grouped=new Map(); let unresolved=0, ignored=0;
    A(attendanceRows).forEach(a=>{ if(attendanceIgnored(a)){ignored++; return;} const date=attendanceDateOf(a); if(!date||date<p.start||date>=p.next||p.cutoff&&date>p.cutoff) return; const key=resolveEmployeeKey(a,index); if(!key){unresolved++; return;} if(!grouped.has(key)) grouped.set(key,new Map()); const dm=grouped.get(key); if(!dm.has(date)) dm.set(date,[]); dm.get(date).push(a); });
    const result=new Map();
    grouped.forEach((dm,key)=>{ const days=[...dm.entries()].map(([date,rows])=>mergeAttendanceDay(rows,date)).sort((a,b)=>a.date.localeCompare(b.date)); const counts={present:0,regularPresent:0,late:0,earlyLeave:0,absent:0,leave:0,sick:0,mission:0,weeklyOff:0,other:0,recorded:0,conflicts:0}; const dayMap=new Map(); const ins=[], outs=[];
      days.forEach(d=>{ dayMap.set(d.date,d); if(d.status){ counts.recorded++; if(['present','late','early_leave'].includes(d.status)){ counts.present++; if(d.status==='present') counts.regularPresent++; if(d.status==='late') counts.late++; if(d.status==='early_leave') counts.earlyLeave++; } else if(d.status==='absent') counts.absent++; else if(Object.prototype.hasOwnProperty.call(counts,d.status)) counts[d.status]++; else counts.other++; } if(d.conflict) counts.conflicts++; if(d.firstIn) ins.push({date:d.date,v:d.firstIn,ms:attendanceMoment(d.date,d.firstIn)}); if(d.lastOut) outs.push({date:d.date,v:d.lastOut,ms:attendanceMoment(d.date,d.lastOut)}); });
      ins.sort((a,b)=>a.ms-b.ms); outs.sort((a,b)=>a.ms-b.ms); const classified=days.filter(d=>d.status); result.set(key,{...counts,days:dayMap,firstAttendance:classified[0]?.date||'',lastAttendance:classified[classified.length-1]?.date||'',firstIn:ins.length?dateTimeLabel(ins[0].date,ins[0].v):(classified[0]?.date||''),lastOut:outs.length?dateTimeLabel(outs[outs.length-1].date,outs[outs.length-1].v):(classified[classified.length-1]?.date||'')}); });
    result.meta={unresolved,ignored}; return result;
  }
  function assignmentOverlapDays(r,month){ const p=reportPeriod(month); if(!p.cutoff) return 0; const st=[p.start,S(r?.start_date||r?.assignment_start||'')].filter(Boolean).sort().pop(); const ends=[p.cutoff,S(r?.end_date||r?.assignment_end||'')].filter(Boolean).sort(); const en=ends.length?ends[0]:p.cutoff; return dateDaysInclusive(st,en); }
  function supervisorIdentity(r, allWorkers){ const code=normalizeCode(S(r?.supervisor_employee_code||r?.supervisor_code||'')); const name=S(r?.supervisor_name||r?.supervisor_display_name||''); const sw=A(allWorkers).find(w=>(code&&workerCode(w)===code)||(name&&norm(workerName(w))===norm(name))); const resolvedCode=code||workerCode(sw); const resolvedName=name||workerName(sw)||'بدون مشرف'; return {key:resolvedCode?('code:'+norm(resolvedCode)):(resolvedName!=='بدون مشرف'?'name:'+norm(resolvedName):'unassigned'),code:resolvedCode,name:resolvedName}; }

  const GROUP_ORDER=['worker','technician','guard','employee'];
  const GROUP_COLORS={worker:'EAF6EE',technician:'EAF3FB',guard:'F9F1E8',employee:'F3ECFA'};
  const GROUP_HEAD={worker:'0E7C45',technician:'0A6C9D',guard:'A66216',employee:'6E44AD'};
  const SUP_COLORS=['0B6B57','0C4A6E','6D4C41','6B7280','7C3AED'];

  function xlsSet(ws,r,c,v){ XLSX.utils.sheet_add_aoa(ws, [[v]], {origin:{r,c}}); }
  function cellAddr(r,c){ return XLSX.utils.encode_cell({r,c}); }
  function setStyle(ws,r,c,style){ const addr=cellAddr(r,c); ws[addr]=ws[addr]||{t:'s',v:''}; ws[addr].s = Object.assign({}, ws[addr].s||{}, style||{}); }
  function styleRange(ws, r1,c1,r2,c2, style){ for(let r=r1;r<=r2;r++) for(let c=c1;c<=c2;c++) setStyle(ws,r,c,style); }
  function merge(ws,r1,c1,r2,c2){ ws['!merges']=ws['!merges']||[]; ws['!merges'].push({s:{r:r1,c:c1},e:{r:r2,c:c2}}); }
  function moneyStyle(){ return {numFmt:'#,##0.00', alignment:{horizontal:'center'}, border:thinBorder()}; }
  function percentStyle(){ return {numFmt:'0.0%', alignment:{horizontal:'center'}, border:thinBorder()}; }
  function thinBorder(){ return {top:{style:'thin',color:{rgb:'D7E0DD'}},bottom:{style:'thin',color:{rgb:'D7E0DD'}},left:{style:'thin',color:{rgb:'D7E0DD'}},right:{style:'thin',color:{rgb:'D7E0DD'}}}; }
  function titleStyle(bg){ return {fill:{fgColor:{rgb:bg}},font:{bold:true,color:{rgb:'FFFFFF'},sz:15},alignment:{horizontal:'center',vertical:'center'},border:thinBorder()}; }
  function subtitleStyle(){ return {fill:{fgColor:{rgb:'E8F3F0'}},font:{bold:true,color:{rgb:'084F40'}},alignment:{horizontal:'right'},border:thinBorder()}; }
  function headerStyle(bg){ return {fill:{fgColor:{rgb:bg}},font:{bold:true,color:{rgb:'FFFFFF'}},alignment:{horizontal:'center',vertical:'center',wrapText:true},border:thinBorder()}; }
  function rowStyle(alt){ return {fill:{fgColor:{rgb:alt?'F9FBFA':'FFFFFF'}},alignment:{horizontal:'center',vertical:'center',wrapText:true},border:thinBorder()}; }
  function badgeStyle(bg,fg){ return {fill:{fgColor:{rgb:bg}},font:{bold:true,color:{rgb:fg}},alignment:{horizontal:'center'},border:thinBorder()}; }
  function autosize(ws, widths){ ws['!cols']=widths.map(w=>({wch:w})); }
  function supervisorDetailsMap(workers){ const map=new Map(); A(workers).forEach(w=>{ if(!isSupervisorLike(w)) return; const byCode=workerCode(w), byName=norm(workerName(w)); if(byCode) map.set('code:'+norm(byCode), w); if(byName) map.set('name:'+byName, w); }); return map; }
  function findSupervisorRecord(sup, supMap){ return supMap.get(sup.supervisorKey) || supMap.get('name:'+norm(sup.supervisorName)) || null; }

  function detectFilters(btn){
    const root = btn?.closest('.card') || document.body;
    const found = {month:'', status:'', category:'', search:'', supervisor:'', project:'', labels:[]};
    const nodes = A(root.querySelectorAll('input,select'));
    const validValue = v => S(v) && !/^all$/i.test(S(v)) && !/^كل/.test(S(v)) && !/^اختر/.test(S(v));
    nodes.forEach(el=>{
      const tag=(el.tagName||'').toLowerCase(); const placeholder=S(el.placeholder); const id=S(el.id); const val=S(el.value);
      if(tag==='input' && el.type==='month' && !found.month) found.month = val || todayMonth();
      if(tag==='input' && (el.type==='search' || el.type==='text') && /بحث|الاسم|الكود|الاقامه|الإقامة/.test(placeholder+id) && !found.search) found.search = val;
      if(tag==='select'){
        const opts=A(el.options).map(o=>S(o.textContent));
        if(!found.status && opts.some(t=>/كل الحالات/.test(t)) && validValue(val)) found.status = val;
        else if(!found.category && opts.some(t=>/كل الفئات|كل الانواع|كل الأنواع/.test(t)) && validValue(val)) found.category = val;
        else if(!found.supervisor && opts.some(t=>/كل المشرفين/.test(t)) && validValue(val)) found.supervisor = val;
        else if(!found.project && opts.some(t=>/كل المشاريع/.test(t)) && validValue(val)) found.project = val;
      }
    });
    if(!found.month) found.month = todayMonth();
    return found;
  }
  function normalizeCategoryFilter(v){ const x=norm(v); if(!x) return ''; if(x.includes('عامل')||x==='worker') return 'worker'; if(x.includes('فني')||x.includes('technician')||x==='tech') return 'technician'; if(x.includes('حارس')||x.includes('guard')||x.includes('security')) return 'guard'; if(x.includes('موظف')||x==='employee'||x.includes('staff')) return 'employee'; return x; }
  function detailsMatchFilter(r, filters){
    const st = norm(filters.status);
    if(st){ const rowSt = norm(r.status); if(st.includes('نشط')||st==='active'){ if(rowSt!=='نشط' && rowSt!=='active') return false; } else if(st.includes('موقوف')||st==='inactive'){ if(rowSt!=='موقوف' && rowSt!=='inactive') return false; } }
    const cat = normalizeCategoryFilter(filters.category); if(cat && r.roleGroup !== cat) return false;
    if(filters.supervisor){ const want = norm(filters.supervisor); if(norm(r.supervisorName)!==want && norm(r.supervisorCode||'')!==want) return false; }
    if(filters.project){ const want = norm(filters.project); const ok = A(r.projects).some(p=>norm(p)===want); if(!ok) return false; }
    const q = norm(filters.search); if(q){ const bag=[r.name,r.code,r.iqamaName,r.iqamaNumber,r.supervisorName,r.supervisorCode,A(r.projects).join(' ')].map(norm).join(' | '); if(!bag.includes(q)) return false; }
    return true;
  }

  function buildWorkbook(month, details, workers, filters, meta){
    const wb = XLSX.utils.book_new();
    wb.Workbook = {Views:[{RTL:true}]};
    const supMap = supervisorDetailsMap(workers);

    // Summary sheet with colored supervisor sections
    const ws1 = XLSX.utils.aoa_to_sheet([[]]);
    let r=0;
    const title=`تقرير الموظفين والحضور والغياب حسب المشرف - ${month}`;
    xlsSet(ws1,r,0,title); merge(ws1,r,0,r,13); styleRange(ws1,r,0,r,13,titleStyle('084F40')); r++;
    const filterLine=`الفلاتر المطبقة: الشهر ${month} | الحالة ${filters.status||'الكل'} | الفئة ${filters.category||'الكل'} | البحث ${filters.search||'بدون'}${filters.supervisor?(' | المشرف '+filters.supervisor):''}${filters.project?(' | المشروع '+filters.project):''}`;
    xlsSet(ws1,r,0,filterLine); merge(ws1,r,0,r,13); styleRange(ws1,r,0,r,13,subtitleStyle()); r+=2;

    const orderedSups=[...new Map(details.map(x=>[x.supervisorKey||x.supervisorName,x.supervisorName])).entries()].map(([key,name])=>({key,name,rows:details.filter(d=>(d.supervisorKey||d.supervisorName)===key)}));
    orderedSups.sort((a,b)=>a.name.localeCompare(b.name,'ar'));
    orderedSups.forEach((g,idx)=>{
      const supRec=findSupervisorRecord({supervisorKey:g.key, supervisorName:g.name}, supMap) || {};
      const supColor=SUP_COLORS[idx % SUP_COLORS.length];
      const counts={worker:0,technician:0,guard:0,employee:0}; g.rows.forEach(x=>counts[x.roleGroup]=(counts[x.roleGroup]||0)+1);
      const projects=[...new Set(g.rows.flatMap(x=>A(x.projects)).filter(Boolean))];
      xlsSet(ws1,r,0,`المشرف: ${g.name}`); merge(ws1,r,0,r,13); styleRange(ws1,r,0,r,13,titleStyle(supColor)); r++;
      const infoRows=[
        ['اسم المشرف',g.name,'كود المشرف',workerCode(supRec)||S(g.key).replace(/^code:/,''),'الجوال',workerPhone(supRec)||'-','الحالة',isActiveStatus(supRec)?'نشط':'-'],
        ['الإقامة',workerIqamaNo(supRec)||'-','اسم الإقامة',workerIqamaName(supRec)||'-','عدد الموظفين',g.rows.length,'المشاريع',projects.join('، ')||'-'],
        ['العمال',counts.worker,'الفنيون',counts.technician,'الحراس',counts.guard,'الموظفون',counts.employee],
        ['إجمالي الرواتب',g.rows.reduce((a,x)=>a+x.total,0),'أيام الحضور',g.rows.reduce((a,x)=>a+x.present,0),'أيام الغياب',g.rows.reduce((a,x)=>a+x.absent,0),'أيام غير مسجلة',g.rows.reduce((a,x)=>a+x.unrecorded,0)]
      ];
      infoRows.forEach((row,i)=>{ XLSX.utils.sheet_add_aoa(ws1,[row],{origin:{r,c:0}}); for(let c=0;c<row.length;c++){ setStyle(ws1,r,c,rowStyle(i%2)); if([1,3,5,7].includes(c) && i===3 && (c===1||c===3||c===5||c===7)){} } setStyle(ws1,r,0,badgeStyle('D7EEE6','084F40')); setStyle(ws1,r,2,badgeStyle('D7EEE6','084F40')); setStyle(ws1,r,4,badgeStyle('D7EEE6','084F40')); setStyle(ws1,r,6,badgeStyle('D7EEE6','084F40')); setStyle(ws1,r,1, cStyleByIndex(i,1)); r++; });
      GROUP_ORDER.forEach(group=>{
        const rows=g.rows.filter(x=>x.roleGroup===group); if(!rows.length) return;
        xlsSet(ws1,r,0,roleGroupLabel(group)); merge(ws1,r,0,r,13); styleRange(ws1,r,0,r,13,headerStyle(GROUP_HEAD[group])); r++;
        const headers=['الكود','الاسم','اسم الإقامة','رقم الإقامة','المشاريع','الراتب الأساسي','البدلات','الإجمالي','بداية العمل','نهاية العمل','أول حضور','آخر خروج','الحضور','الغياب'];
        XLSX.utils.sheet_add_aoa(ws1,[headers],{origin:{r,c:0}}); styleRange(ws1,r,0,r,13,headerStyle(GROUP_HEAD[group])); r++;
        rows.forEach((x,i)=>{ const vals=[x.code,x.name,x.iqamaName||'-',x.iqamaNumber||'-',A(x.projects).join('، ')||'-',x.basic,x.allowances,x.total,x.workStart||'-',x.workEnd||'-',x.firstIn||'-',x.lastOut||'-',x.present,x.absent]; XLSX.utils.sheet_add_aoa(ws1,[vals],{origin:{r,c:0}}); styleRange(ws1,r,0,r,13,rowStyle(i%2)); setStyle(ws1,r,5,moneyStyle()); setStyle(ws1,r,6,moneyStyle()); setStyle(ws1,r,7,moneyStyle()); r++; });
        r++;
      });
      r++;
    });
    autosize(ws1,[14,26,14,18,14,12,12,12,13,13,18,18,10,10]);
    XLSX.utils.book_append_sheet(wb,ws1,'حسب المشرف');

    // Detailed filterable sheet
    const detailHeaders=['المشرف','كود المشرف','الفئة','الكود','الاسم','اسم الإقامة','رقم الإقامة','المشاريع','الحالة','الراتب الأساسي','البدلات','إجمالي الراتب','بداية العمل','نهاية العمل','أول حضور','آخر خروج','أيام الحضور','أيام الغياب','إجازة','مرضي','مأمورية','راحة أسبوعية','أيام غير مسجلة','نسبة اكتمال السجل'];
    const detailRows=details.map(x=>[x.supervisorName,x.supervisorCode||'',roleGroupLabel(x.roleGroup),x.code,x.name,x.iqamaName||'',x.iqamaNumber||'',A(x.projects).join('، '),x.status,x.basic,x.allowances,x.total,x.workStart||'',x.workEnd||'',x.firstIn||'',x.lastOut||'',x.present,x.absent,x.leave,x.sick,x.mission,x.weeklyOff,x.unrecorded,(x.serviceDays?x.recorded/x.serviceDays:0)]);
    const ws2=XLSX.utils.aoa_to_sheet([detailHeaders,...detailRows]);
    styleRange(ws2,0,0,0,detailHeaders.length-1,headerStyle('0A4033'));
    for(let i=1;i<=detailRows.length;i++){ styleRange(ws2,i,0,i,detailHeaders.length-1,rowStyle(i%2)); setStyle(ws2,i,9,moneyStyle()); setStyle(ws2,i,10,moneyStyle()); setStyle(ws2,i,11,moneyStyle()); setStyle(ws2,i,23,percentStyle()); }
    autosize(ws2,[24,13,12,12,24,24,16,28,10,12,12,13,12,12,18,18,10,10,10,10,10,12,13,14]);
    ws2['!autofilter']={ref:`A1:${XLSX.utils.encode_col(detailHeaders.length-1)}${detailRows.length+1}`};
    XLSX.utils.book_append_sheet(wb,ws2,'بيانات مفصلة');

    // Daily matrix sheet
    const days=[]; const p=reportPeriod(month); for(let d=1; d<=Number(p.end.slice(-2)); d++) days.push(String(d).padStart(2,'0'));
    const dailyHeaders=['المشرف','الفئة','الكود','الاسم',...days,'الحضور','الغياب','إجازات','غير مسجل'];
    const dailySheetRows=[];
    details.forEach(x=>{ const row=[x.supervisorName,roleGroupLabel(x.roleGroup),x.code,x.name]; days.forEach(dd=>{ const date=month+'-'+dd; const rec=x.dayMap.get(date); const st=rec?.status||''; row.push(st==='present'?'ح':st==='late'?'ت':st==='early_leave'?'خ':st==='absent'?'غ':st==='leave'?'إ':st==='sick'?'م':st==='mission'?'أ':st==='weekly_off'?'ر':'-'); }); row.push(x.present,x.absent,x.leave+x.sick+x.mission+x.weeklyOff,x.unrecorded); dailySheetRows.push(row); });
    const ws3=XLSX.utils.aoa_to_sheet([dailyHeaders,...dailySheetRows]);
    styleRange(ws3,0,0,0,dailyHeaders.length-1,headerStyle('084F40'));
    for(let i=1;i<=dailySheetRows.length;i++){ styleRange(ws3,i,0,i,dailyHeaders.length-1,rowStyle(i%2)); for(let c=4;c<4+days.length;c++){ const val=S(ws3[cellAddr(i,c)]?.v); if(val==='غ') setStyle(ws3,i,c,badgeStyle('FDE2E2','A52222')); else if(val==='ح'||val==='ت'||val==='خ') setStyle(ws3,i,c,badgeStyle('E5F4EC','08784D')); else if(val==='إ'||val==='م'||val==='أ'||val==='ر') setStyle(ws3,i,c,badgeStyle('FFF2CC','7A5700')); else setStyle(ws3,i,c,badgeStyle('F2F4F3','8A9993')); } }
    autosize(ws3,[24,12,12,24,...days.map(()=>4.5),9,9,10,12]);
    XLSX.utils.book_append_sheet(wb,ws3,'كشف يومي');

    // Summary sheet
    const sumHeaders=['المشرف','العمال','الفنيون','الحراس','الموظفون','الإجمالي','إجمالي الرواتب','الحضور','الغياب','غير مسجل'];
    const sumRows=orderedSups.map(g=>{ const counts={worker:0,technician:0,guard:0,employee:0}; g.rows.forEach(x=>counts[x.roleGroup]=(counts[x.roleGroup]||0)+1); return [g.name,counts.worker,counts.technician,counts.guard,counts.employee,g.rows.length,g.rows.reduce((a,x)=>a+x.total,0),g.rows.reduce((a,x)=>a+x.present,0),g.rows.reduce((a,x)=>a+x.absent,0),g.rows.reduce((a,x)=>a+x.unrecorded,0)]; });
    const ws4=XLSX.utils.aoa_to_sheet([sumHeaders,...sumRows]); styleRange(ws4,0,0,0,sumHeaders.length-1,headerStyle('0A4033')); for(let i=1;i<=sumRows.length;i++){ styleRange(ws4,i,0,i,sumHeaders.length-1,rowStyle(i%2)); setStyle(ws4,i,6,moneyStyle()); } autosize(ws4,[24,10,10,10,10,10,15,10,10,10]); XLSX.utils.book_append_sheet(wb,ws4,'ملخص');

    const ws5=XLSX.utils.aoa_to_sheet([
      ['دليل التقرير'],
      ['الرمز','المعنى'],['ح','حاضر'],['ت','متأخر ويُحتسب حضورًا'],['خ','خروج مبكر ويُحتسب حضورًا'],['غ','غياب مسجل'],['إ','إجازة'],['م','إجازة مرضية'],['أ','مأمورية'],['ر','راحة أسبوعية'],['-','لا يوجد تسجيل'],[],
      ['ملاحظات'],
      ['1',`التقرير ينزل حسب الفلاتر الحالية في الشاشة.`],
      ['2',`سجلات غير مرتبطة بموظف: ${N(meta?.unresolved)} | سجلات مستبعدة/ملغاة: ${N(meta?.ignored)}`],
      ['3','يتم دمج سجلات اليوم الواحد لكل موظف ويُعتمد حضور اليوم عند وجود حضور وغياب معًا.'],
      ['4','الأيام الفارغة لا تُحسب غيابًا، بل تظهر ضمن غير مسجل.']
    ]); merge(ws5,0,0,0,3); styleRange(ws5,0,0,0,3,titleStyle('084F40')); styleRange(ws5,1,0,1,1,headerStyle('0A4033')); autosize(ws5,[10,60,12,12]); XLSX.utils.book_append_sheet(wb,ws5,'الدليل');

    return wb;

    function cStyleByIndex(i,c){ return c; }
  }

  async function exportSupervisorEmployeesExcelV10806(btn){
    btn = btn || $('cu413ExportWorkersExcel') || [...document.querySelectorAll('button')].find(b=>/excel/i.test(S(b.textContent)));
    const original=btn?.textContent || 'تنزيل Excel مرتب';
    try{
      if(!window.XLSX) throw new Error('مكتبة Excel غير متاحة. أعد تحميل الصفحة.');
      const filters=detectFilters(btn); const month=S(filters.month||todayMonth()).slice(0,7); if(!/^\d{4}-\d{2}$/.test(month)) throw new Error('اختر شهرًا صحيحًا.');
      if(btn){ btn.disabled=true; btn.textContent='جاري تجهيز الملف الاحترافي...'; }
      showMsg('جاري تجهيز تقرير Excel الاحترافي حسب الفلاتر الحالية...');
      const b=monthBounds(month);
      const [workers, distRows, attendanceRows] = await Promise.all([
        fetchPagedRows('workers',q=>q.order('name',{ascending:true})),
        fetchPagedRows('monthly_distribution',q=>q.eq('month_key',month).order('supervisor_name',{ascending:true})),
        fetchPagedRows('attendance',q=>q.gte('attendance_date',b.start).lt('attendance_date',b.next).order('attendance_date',{ascending:true}))
      ]);
      const activeWorkers=A(workers).filter(w=>!statusDeleted(w));
      const index=buildEmployeeAliasIndex(activeWorkers);
      const assignments=new Map();
      A(distRows).filter(r=>isActiveStatus(r)).forEach(r=>{ const key=resolveEmployeeKey(r,index); if(!key) return; if(!assignments.has(key)) assignments.set(key,{supervisors:new Map(),projects:new Set()}); const a=assignments.get(key); const sup=supervisorIdentity(r, activeWorkers); const weight=Math.max(1,assignmentOverlapDays(r,month)); if(!a.supervisors.has(sup.key)) a.supervisors.set(sup.key,{...sup,count:0}); a.supervisors.get(sup.key).count += weight; const pn=projectNameFromRow(r); if(pn) a.projects.add(pn); });
      const attStats=buildEmployeeAttendanceStats(attendanceRows,index,month);
      const source=activeWorkers.filter(w=>!isSupervisorLike(w) && workerOverlapsMonth(w,month));
      const seen=new Set(), details=[];
      source.forEach(w=>{ const key=canonicalEmployeeKey(w); if(!key || seen.has(key)) return; seen.add(key); const asg=assignments.get(key); let sup={key:'unassigned',name:'بدون مشرف',code:''}; if(asg?.supervisors?.size){ sup=[...asg.supervisors.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'ar'))[0]; } else { const sc=normalizeCode(S(w.supervisor_employee_code||w.supervisor_code||w.supervisor_id||'')); const sn=S(w.supervisor_name||''); const sw=activeWorkers.find(x=>workerCode(x)===sc||norm(workerName(x))===norm(sn)); if(sc||sn||sw) sup={key:sc?('code:'+norm(sc)):('name:'+norm(sn||workerName(sw))), code:sc||workerCode(sw), name:sn||workerName(sw)||'بدون مشرف'}; }
        const st=attStats.get(key)||{present:0,regularPresent:0,late:0,earlyLeave:0,absent:0,leave:0,sick:0,mission:0,weeklyOff:0,other:0,recorded:0,conflicts:0,days:new Map(),firstIn:'',lastOut:''};
        const service=employeeServiceRange(w,month), unrecorded=Math.max(0,service.days-N(st.recorded));
        details.push({
          supervisorKey:sup.key, supervisorName:sup.name||'بدون مشرف', supervisorCode:sup.code||'',
          roleGroup:roleGroup(w), roleLabel:roleText(w), code:workerCode(w), name:workerName(w), iqamaName:workerIqamaName(w), iqamaNumber:workerIqamaNo(w), status:isActiveStatus(w)?'نشط':'موقوف', projects:[...(asg?.projects||[])], basic:workerBasicSalary(w), allowances:workerAllowances(w), total:workerTotalSalary(w), workStart:workerStartDate(w), workEnd:workerEndDate(w), firstIn:st.firstIn||'', lastOut:st.lastOut||'', present:N(st.present), absent:N(st.absent), leave:N(st.leave), sick:N(st.sick), mission:N(st.mission), weeklyOff:N(st.weeklyOff), late:N(st.late), earlyLeave:N(st.earlyLeave), other:N(st.other), recorded:N(st.recorded), conflicts:N(st.conflicts), dayMap:st.days||new Map(), serviceDays:service.days, unrecorded
        });
      });
      const filtered=details.filter(r=>detailsMatchFilter(r,filters)).sort((a,b)=>a.supervisorName.localeCompare(b.supervisorName,'ar') || GROUP_ORDER.indexOf(a.roleGroup)-GROUP_ORDER.indexOf(b.roleGroup) || a.name.localeCompare(b.name,'ar'));
      if(!filtered.length) throw new Error('لا توجد بيانات مطابقة للفلاتر الحالية.');
      const wb=buildWorkbook(month, filtered, activeWorkers, filters, attStats.meta||{});
      XLSX.writeFile(wb,`Tasneef_Professional_Filtered_Employees_${month}.xlsx`,{cellStyles:true,compression:true});
      showMsg(`تم تنزيل التقرير الاحترافي حسب الفلاتر الحالية بنجاح. عدد الموظفين: ${filtered.length}`);
    }catch(e){ console.error('V10806 export',e); showMsg('تعذر تنزيل Excel: '+(e?.message||e), true); }
    finally{ if(btn){ btn.disabled=false; btn.textContent=original; } }
  }

  window.exportSupervisorEmployeesExcel = exportSupervisorEmployeesExcelV10806;
  window.exportSupervisorEmployeesExcelV10806 = exportSupervisorEmployeesExcelV10806;

  function bindButtons(){
    const buttons=[...document.querySelectorAll('button')].filter(b=>/excel/i.test(S(b.textContent)) && /مرتب|احترافي/.test(S(b.textContent)));
    buttons.forEach(b=>{ if(b.dataset.v10806Bound) return; b.dataset.v10806Bound='1'; b.onclick=()=>exportSupervisorEmployeesExcelV10806(b); if(!/احترافي/.test(S(b.textContent))) b.textContent='تنزيل Excel احترافي'; });
    try{ const badge=[...document.querySelectorAll('*')].find(el=>S(el.textContent)==='V460'); if(badge) badge.textContent='V461'; }catch(_){ }
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(bindButtons,1200));
  window.addEventListener('load',()=>setTimeout(bindButtons,1600));
  setTimeout(bindButtons,2200);
  console.log('Tasneef',VERSION,'professional filtered employee Excel loaded');
})();

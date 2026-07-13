(function(){
  'use strict';
  // V450: إعادة بناء قسم الرواتب من الصفر على مصدر واحد فقط:
  // التوزيع الموحد يحدد المشرف والعمال، العمال الموحدون يحددون بيانات العامل والراتب، الحضور يحدد الغياب فقط.
  window.__tasneefSalariesUnifiedV440 = true;
  window.__tasneefSalariesUnifiedV451 = true;
  const VERSION='V452 رواتب حسب التوزيع النشط فقط';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const N=v=>Number(String(v??'').replace(/,/g,''))||0;
  const esc=s=>S(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>N(v).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2});
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const mStart=m=>m+'-01';
  const mEnd=m=>{const [y,mo]=S(m).split('-').map(Number); const d=new Date(y,mo,0); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const dim=m=>{const [y,mo]=S(m).split('-').map(Number); return new Date(y,mo,0).getDate()||30};
  const norm=s=>S(s).toLowerCase().replace(/[إأآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه').replace(/[ًٌٍَُِّْـ]/g,'').replace(/[\u200e\u200f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
  const active=v=>!['deleted','archived','inactive','stopped','ended','disabled','محذوف','موقوف','متوقف','منتهي','غير نشط','غيرنشط'].includes(norm(v||'active'));
  const present=v=>['present','حاضر','حضور','ح','p'].includes(norm(v));
  const absent=v=>['absent','غائب','غياب','غ','a'].includes(norm(v));
  let st={workers:[],dist:[],projects:[],attendance:[],saved:[],rows:[]};

  function msg(t,bad){const el=$('salaryMsg')||$('cu413Msg'); if(el){el.textContent=t; el.className=(el.id==='salaryMsg'?'msg ':'cu413-msg ')+(bad?'err':''); el.style.display='block'; el.classList?.remove('hidden');} console[bad?'warn':'log']('[salary-v450]',t);}
  async function all(table,select='*',build){let out=[],from=0,size=1000; while(true){let q=window.sb.from(table).select(select).range(from,from+size-1); if(build)q=build(q); const r=await q; if(r.error)throw r.error; out=out.concat(r.data||[]); if(!r.data||r.data.length<size)break; from+=size; if(from>30000)break;} return out;}
  async function tryAll(table,select='*',build){try{return await all(table,select,build)}catch(e){console.warn('salary v450 skip '+table,e.message);return []}}

  function codeNorm(v){let s=S(v); let m=s.match(/TS[-_\s]?(\d+)/i); if(m)return 'TS-'+String(Number(m[1])).padStart(2,'0'); return s;}
  function rawCode(x){return S(x.employee_code||x.employee_ts_id||x.code||x.worker_employee_code||x.worker_code||x.id)}
  function codeOf(x){return codeNorm(rawCode(x));}
  function nameOf(w){return S(w.app_name||w.employee_name||w.name||w.full_name||w.worker_name||w.residency_name||w.iqama_name)}
  function resName(w){return S(w.residency_name||w.iqama_name||w.name_on_iqama||w.employee_residency_name||w.employee_name||w.name||w.full_name)}
  function iqamaOf(w){return S(w.iqama_number||w.iqama_no||w.residency_number||w.id_number)}
  function jobOf(w){return S(w.job_title||w.position||w.role_name||'عامل')}
  function basicOf(w){return N(w.basic_salary ?? w.salary ?? w.base_salary ?? 0)}
  function allowanceOf(w){return N(w.allowance ?? w.allowances ?? w.salary_allowance ?? w.allowance_amount ?? w.housing_allowance ?? w.allowance_value ?? w.allowance_total ?? 0)}
  function startOf(w){return S(w.start_date||w.work_start_date||w.joining_date||w.date_start||w.default_start_date)}
  function endOf(w){return S(w.end_date||w.work_end_date||w.termination_date||w.date_end||w.default_end_date)}
  function catOf(job){const j=norm(job); if(j.includes('مشرف'))return'supervisors'; if(j.includes('فني')||j.includes('صيانة'))return'technicians'; if(j.includes('حارس'))return'guards'; return'workers';}
  function workerActive(w){return !(w?.deleted_at||w?.is_deleted===true||w?.active===false||w?.is_active===false) && active(w.status||w.state||w.active_status||'active')}
  function mergeWorkers(empRows,workerRows){
    const m=new Map();
    function put(w,priority){const c=codeOf(w); if(!c||/^\d+$/.test(c))return; const old=m.get(c); if(!old || priority>=(old.__priority||0)) m.set(c,Object.assign({},old||{},w,{__priority:priority})); else m.set(c,Object.assign({},w,old));}
    (workerRows||[]).forEach(w=>put(w,1));
    (empRows||[]).forEach(w=>put(w,2));
    return [...m.values()].filter(workerActive).sort((a,b)=>codeOf(a).localeCompare(codeOf(b),'en',{numeric:true}));
  }
  function workerByCode(code){const c=codeNorm(code); return st.workers.find(w=>codeOf(w)===c)||null;}
  function projectById(pid){return st.projects.find(p=>S(p.id)===S(pid)||S(p.project_id)===S(pid))||{};}
  function projectName(pid,d){const p=projectById(pid); return S(d?.project_name||p.name||p.project_name||p.title||pid||'');}
  function projectActive(pid){const p=projectById(pid); return !!S(pid) && !!(p.id||p.project_id) && !(p.deleted_at||p.is_deleted===true||p.active===false||p.is_active===false) && active(p.status||p.state||p.active_status||'active');}
  function pType(pid,d){const p=projectById(pid); return norm(p.operation_type||p.project_type||p.type||p.work_type||p.service_type||d?.operation_type||d?.project_type||d?.type||'');}
  function isDaily(pid,d){const t=pType(pid,d); return t.includes('زياره')||t.includes('زيارة')||t.includes('daily')||t.includes('visit')||t.includes('3 ساعات')||t.includes('جزئي');}
  function isFull(pid,d){const t=pType(pid,d); return t.includes('دوام كامل')||t.includes('كامل')||t.includes('full')||t.includes('9 ساعات')||t.includes('full time');}
  function dMonth(d){return S(d.month_key||d.month||d.salary_month||'').slice(0,7)}
  function dWorker(d){return codeNorm(d.worker_employee_code||d.employee_code||d.worker_code||d.worker_id||'')}
  function dSup(d){return codeNorm(d.supervisor_employee_code||d.supervisor_code||d.supervisor_worker_code||d.supervisor_id||'')}
  function dPid(d){return S(d.project_id||d.project_code||d.project||'')}
  function dPname(d){return projectName(dPid(d),d)}
  function dSupName(d){const sw=workerByCode(dSup(d)); return S(d.supervisor_name||nameOf(sw)||dSup(d)||'بدون مشرف')}
  function supervisorActive(code){const c=codeNorm(code); if(!c) return false; const w=workerByCode(c); return !!w && workerActive(w) && catOf(jobOf(w))==='supervisors';}
  function distRows(month){return st.dist.filter(d=>{const wc=dWorker(d), sc=dSup(d), pid=dPid(d); if(dMonth(d)!==month) return false; if(!active(d.status||'active')) return false; if(!wc || !workerByCode(wc) || !workerActive(workerByCode(wc))) return false; if(!sc || !supervisorActive(sc)) return false; if(!projectActive(pid)) return false; return true;});}

  function cleanDistribution(month){
    // المصدر الوحيد للرواتب هو التوزيع النشط. العامل يظهر مرة واحدة تحت مشرفه الموجود في أول توزيع نشط للشهر.
    const rows=distRows(month);
    const groups=[]; const groupMap=new Map(); const usedWorker=new Set();
    rows.forEach((d,idx)=>{
      const wc=dWorker(d), sc=dSup(d);
      const w=workerByCode(wc);
      if(!wc || usedWorker.has(wc)) return;
      if(catOf(jobOf(w))==='supervisors') return; // لا نضيف المشرف كعامل داخل نفس المجموعة
      const allForWorker=rows.filter(x=>dWorker(x)===wc && dSup(x)===sc);
      usedWorker.add(wc);
      if(!groupMap.has(sc)){groupMap.set(sc,{code:sc,name:dSupName(d),workers:[],_order:idx}); groups.push(groupMap.get(sc));}
      groupMap.get(sc).workers.push({code:wc,distRows:allForWorker,_order:idx});
    });
    groups.sort((a,b)=>a._order-b._order);
    groups.forEach(g=>g.workers.sort((a,b)=>a._order-b._order));
    return groups;
  }
  function workLocation(rows,supName){
    rows=rows||[];
    const pids=[...new Set(rows.map(dPid).filter(Boolean))];
    const hasDaily=rows.some(r=>isDaily(dPid(r),r));
    if(pids.length===1 && !hasDaily && isFull(pids[0],rows[0])) return dPname(rows[0]);
    return supName||'بدون مشرف';
  }
  function allProjectNames(rows){return [...new Set((rows||[]).map(dPname).filter(Boolean))].join('، ')}
  function clampDate(d,m){d=S(d).slice(0,10); if(!d)return''; const a=mStart(m),b=mEnd(m); if(d<a)return a; if(d>b)return b; return d;}
  function daysBetween(a,b,m){a=clampDate(a,m)||mStart(m); b=clampDate(b,m)||mEnd(m); if(b<a){const t=a;a=b;b=t;} return Math.max(0,Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000)+1);}
  function savedFor(code,month){const c=codeNorm(code), n=String(numId(c,0)); return st.saved.find(s=>S(s.salary_month).slice(0,7)===month && (codeNorm(s.employee_ts_id||s.employee_code)===c || S(s.entity_id)===n))||{};}
  function numId(code,idx){const c=codeNorm(code); const m=c.match(/TS-(\d+)/); if(m)return Number(m[1]); let h=0; for(let i=0;i<c.length;i++)h=((h*31)+c.charCodeAt(i))>>>0; return h||idx+1;}
  function matchAttendance(a,code,w){
    const keys=[code,nameOf(w),resName(w)].map(x=>norm(codeNorm(x))).filter(Boolean);
    const vals=[a.worker_employee_code,a.employee_code,a.employee_ts_id,a.worker_code,a.worker_identity,a.worker_name,a.employee_name].map(x=>norm(codeNorm(x))).filter(Boolean);
    return keys.some(k=>vals.some(v=>v===k || (k.length>2&&v.length>2&&(v.includes(k)||k.includes(v)))));
  }
  function attendanceStats(code,w,month){const p=new Set(),a=new Set(); st.attendance.forEach(r=>{const d=S(r.attendance_date||r.date||r.created_at).slice(0,10); if(!d.startsWith(month))return; if(!matchAttendance(r,code,w))return; if(absent(r.status||r.state||r.attendance_status))a.add(d); else if(present(r.status||r.state||r.attendance_status))p.add(d);}); a.forEach(d=>p.delete(d)); return {present:p.size,absent:a.size,absentDates:[...a].sort()};}
  function calc(r,month){const days=dim(month); r.gross_salary=N(r.basic_salary)+N(r.allowance); r.work_days=N(r.work_days); r.absent_days=Math.max(0,Math.min(N(r.absent_days),r.work_days)); r.payable_days=Math.max(0,r.work_days-r.absent_days); r.absence_deduction=Math.round((r.gross_salary/days*r.absent_days)*100)/100; r.salary_by_days=Math.round((r.gross_salary/days*r.work_days)*100)/100; r.deductions=Math.round((N(r.absence_deduction)+N(r.manual_extra_deductions))*100)/100; const pre=Math.round((N(r.salary_by_days)+N(r.commission)-N(r.deductions)-N(r.advance_deduction))*100)/100; const ceil=Math.ceil(pre-0.000001); r.rounding=Math.round(Math.max(0,ceil-pre)*100)/100; r.net_salary=Math.round((pre+r.rounding)*100)/100; if(r.absent_days>0 && !r._manual_notes) r.notes='خصم غياب: '+money(r.absent_days)+' '+(r.absent_days===1?'يوم':'أيام'); if(r.absent_days<=0 && !r._manual_notes && S(r.notes).startsWith('خصم غياب')) r.notes=''; return r;}

  function makeRow(code,rows,sup,month,idx,isSupervisor){
    const w=workerByCode(code)||{}; const sv=savedFor(code,month); const att=attendanceStats(code,w,month);
    const start=sv.start_date||startOf(w)||mStart(month); const end=sv.end_date||endOf(w)||mEnd(month);
    let r={
      entity_id:code, employee_ts_id:sv.employee_ts_id||code, salary_month:mStart(month),
      residency_name:sv.residency_name||resName(w)||nameOf(w), employee_name:sv.employee_name||nameOf(w)||resName(w)||code, iqama_no:sv.iqama_no||iqamaOf(w),
      work_location:sv.work_location|| (isSupervisor?'FM':workLocation(rows,sup.name)), project_name:sv.project_name||allProjectNames(rows),
      supervisor_code:sup.code, supervisor_name:sup.name, job_title:sv.job_title||jobOf(w)||(isSupervisor?'مشرف':'عامل'),
      start_date:clampDate(start,month)||mStart(month), end_date:clampDate(end,month)||mEnd(month),
      work_days:0, absent_days:N(sv.absent_days||att.absent), payable_days:0,
      basic_salary:N(sv.basic_salary ?? basicOf(w) ?? (isSupervisor?2000:1300)), allowance:N(sv.allowance ?? allowanceOf(w) ?? (isSupervisor?300:200)),
      commission:N(sv.commission||0), manual_extra_deductions:N(sv.manual_extra_deductions||0), advance_deduction:N(sv.advance_deduction||0), notes:sv.notes||'', _manual_notes:!!sv.notes,
      _groupTitle:'المشرف: '+sup.name, _isSupervisor:isSupervisor, _order:idx
    };
    r.work_days=daysBetween(r.start_date,r.end_date,month);
    return calc(r,month);
  }
  function buildRows(){
    const month=$('salaryMonth')?.value||today().slice(0,7), type=$('salaryType')?.value||'all', sf=$('salarySupervisor')?.value||'', pf=$('salaryProject')?.value||'', q=norm($('salarySearch')?.value||'');
    const rows=[]; const groups=cleanDistribution(month);
    groups.forEach(g=>{
      if(sf && sf!==g.code && sf!==norm(g.name)) return;
      const supCode=g.code; if(supCode){const supRows=[]; rows.push(makeRow(supCode,supRows,g,month,rows.length,true));}
      g.workers.forEach(item=>{
        if(pf && !item.distRows.some(d=>dPid(d)===pf)) return;
        const row=makeRow(item.code,item.distRows,g,month,rows.length,false);
        const cat=catOf(row.job_title); if(type!=='all' && type!==cat) return;
        const hay=norm([row.employee_ts_id,row.residency_name,row.employee_name,row.iqama_no,row.work_location,row.project_name,row.supervisor_name,row.job_title].join(' ')); if(q && !hay.includes(q)) return;
        rows.push(row);
      });
    });
    // إذا اخترت نوع كشف غير الكل، لا نعرض صف المشرف إلا في كشف المشرفين أو الكل.
    st.rows = rows.filter(r=> type==='all' || (type==='supervisors'?r._isSupervisor:!r._isSupervisor));
    render();
  }
  function input(r,k,w=110,type='text'){return `<input class="sal-input" type="${type}" style="width:${w}px" value="${esc(r[k]??'')}" onchange="tasneefSalariesUnifiedV440.update('${esc(r.entity_id)}','${k}',this.value)">`;}
  function rowHtml(r,i,month){return `<tr><td>${i}</td><td>${esc(r.employee_ts_id)}</td><td>${month}</td><td>${esc(r.residency_name)}</td><td>${esc(r.employee_name)}</td><td>${esc(r.iqama_no)}</td><td>${esc(r.work_location)}</td><td>${input(r,'notes',160)}</td><td>${esc(r.job_title)}</td><td>${input(r,'start_date',132,'date')}</td><td>${input(r,'end_date',132,'date')}</td><td>${money(r.work_days)}</td><td>${input(r,'absent_days',80,'number')}</td><td>${money(r.payable_days)}</td><td>${input(r,'basic_salary',90,'number')}</td><td>${input(r,'allowance',80,'number')}</td><td>${money(r.gross_salary)}</td><td>${money(r.salary_by_days)}</td><td>${input(r,'commission',80,'number')}</td><td>${input(r,'manual_extra_deductions',80,'number')}</td><td>${money(r.rounding)}</td><td>${input(r,'advance_deduction',80,'number')}</td><td><b>${money(r.net_salary)}</b></td></tr>`;}
  function totals(){return st.rows.reduce((a,r)=>{['basic_salary','allowance','gross_salary','salary_by_days','commission','deductions','rounding','advance_deduction','net_salary'].forEach(k=>a[k]=(a[k]||0)+N(r[k])); return a;},{});}
  function render(){const body=$('salaryBody'), kp=$('salaryKpis'); if(!body)return; const month=$('salaryMonth')?.value||today().slice(0,7); let html='',last='',i=0; st.rows.forEach(r=>{if(r._groupTitle!==last){last=r._groupTitle; html+=`<tr class="salary-group-row"><td colspan="23">${esc(last)}</td></tr>`;} html+=rowHtml(r,++i,month);}); body.innerHTML=html||'<tr><td colspan="23">لا توجد رواتب. اربط العمال في النظام الموحد → التوزيع أولًا.</td></tr>'; const t=totals(); if(kp)kp.innerHTML=`<div class="kpi"><small>عدد السجلات</small><b>${st.rows.length}</b></div><div class="kpi"><small>الأساسي</small><b>${money(t.basic_salary)}</b></div><div class="kpi"><small>البدلات</small><b>${money(t.allowance)}</b></div><div class="kpi"><small>الخصومات والسلف</small><b>${money(N(t.deductions)+N(t.advance_deduction))}</b></div><div class="kpi"><small>الصافي</small><b>${money(t.net_salary)}</b></div>`; const foot=$('salaryFoot'); if(foot)foot.innerHTML=`<tr><td colspan="14"><b>الإجمالي</b></td><td>${money(t.basic_salary)}</td><td>${money(t.allowance)}</td><td>${money(t.gross_salary)}</td><td>${money(t.salary_by_days)}</td><td>${money(t.commission)}</td><td>${money(t.deductions)}</td><td>${money(t.rounding)}</td><td>${money(t.advance_deduction)}</td><td>${money(t.net_salary)}</td></tr>`;}
  function update(id,k,v){const r=st.rows.find(x=>x.entity_id===id); if(!r)return; const month=$('salaryMonth')?.value||today().slice(0,7); if(['basic_salary','allowance','commission','manual_extra_deductions','advance_deduction','absent_days'].includes(k)) r[k]=N(v); else {r[k]=v; if(k==='notes')r._manual_notes=true;} if(['start_date','end_date'].includes(k))r.work_days=daysBetween(r.start_date,r.end_date,month); calc(r,month); render();}
  function fillFilters(month){const sup=$('salarySupervisor'), pr=$('salaryProject'); const groups=cleanDistribution(month); if(sup){const cur=sup.value; sup.innerHTML='<option value="">كل المشرفين</option>'+groups.map(g=>`<option value="${esc(g.code||norm(g.name))}">${esc(g.name)}${g.code?' - '+esc(g.code):''}</option>`).join(''); sup.value=[...sup.options].some(o=>o.value===cur)?cur:'';} if(pr){const cur=pr.value; const ps=new Map(); distRows(month).forEach(d=>{if(dPid(d))ps.set(dPid(d),dPname(d));}); pr.innerHTML='<option value="">كل المشاريع</option>'+[...ps.entries()].map(([id,n])=>`<option value="${esc(id)}">${esc(n)}</option>`).join(''); pr.value=ps.has(cur)?cur:'';}}
  let salaryLoading=false, lastLoadedMonth='';
  async function load(){
    if(salaryLoading){ msg('جاري التحميل، انتظر لحظة...'); return; }
    salaryLoading=true;
    try{
      if(!window.sb)throw new Error('Supabase غير جاهز');
      const month=($('salaryMonth')?.value||today().slice(0,7)).slice(0,7), start=mStart(month), end=mEnd(month);
      msg('جاري تحميل الرواتب من توزيع شهر '+month+' فقط...');
      // مهم جدًا: لا نحمل كل جدول التوزيع. نحمل شهر واحد فقط حتى لا تعلق الصفحة.
      const distPromise = tryAll('monthly_distribution','*',q=>q.eq('month_key',month).neq('status','deleted'));
      const attPromise = tryAll('attendance','*',q=>q.gte('attendance_date',start).lte('attendance_date',end));
      const savedPromise = tryAll('monthly_salaries','*',q=>q.eq('salary_month',start));
      const [emp,wrk,dist,att,projects,saved]=await Promise.all([
        tryAll('employees_master_v386','*'),
        tryAll('workers','*'),
        distPromise,
        attPromise,
        tryAll('projects','*'),
        savedPromise
      ]);
      st.workers=mergeWorkers(emp,wrk);
      st.dist=(dist||[]).filter(d=>dMonth(d)===month);
      st.attendance=att||[];
      st.projects=projects||[];
      st.saved=saved||[];
      lastLoadedMonth=month;
      fillFilters(month);
      buildRows();
      msg('تم تحميل الرواتب بدون تعليق: '+st.rows.length+' سجل من التوزيع الموحد.');
    }catch(e){console.error(e); msg('فشل تحميل الرواتب: '+(e.message||e),true);}
    finally{salaryLoading=false;}
  }
  async function save(approve){try{const month=$('salaryMonth')?.value||today().slice(0,7); const payload=st.rows.map((r,i)=>({salary_month:mStart(month),entity_type:'unified_distribution_v450',entity_id:numId(r.employee_ts_id,i),employee_ts_id:r.employee_ts_id,employee_code:r.employee_ts_id,residency_name:r.residency_name,iqama_no:r.iqama_no,employee_name:r.employee_name,work_location:r.work_location,project_name:r.project_name,supervisor_name:r.supervisor_name,job_title:r.job_title,start_date:r.start_date||null,end_date:r.end_date||null,work_days:N(r.work_days),absent_days:N(r.absent_days),payable_days:N(r.payable_days),basic_salary:N(r.basic_salary),allowance:N(r.allowance),gross_salary:N(r.gross_salary),salary_by_days:N(r.salary_by_days),commission:N(r.commission),deductions:N(r.deductions),rounding:N(r.rounding),advance_deduction:N(r.advance_deduction),net_salary:N(r.net_salary),notes:r.notes||'',is_approved:!!approve,approved_at:approve?new Date().toISOString():null,updated_at:new Date().toISOString()})); if(!payload.length)return msg('لا توجد رواتب للحفظ',true); const r=await window.sb.from('monthly_salaries').upsert(payload,{onConflict:'salary_month,entity_type,entity_id'}); if(r.error)throw r.error; msg(approve?'تم اعتماد الرواتب':'تم حفظ الرواتب');}catch(e){console.error(e); msg('فشل حفظ الرواتب: '+(e.message||e),true);}}
  function print(){const sec=$('salaries'); if(!sec)return; const w=window.open('','_blank'); w.document.write('<html dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Tahoma,Arial}table{border-collapse:collapse;width:100%;font-size:10px}td,th{border:1px solid #b8d6cd;padding:5px;text-align:center}th{background:#07513f;color:white}.salary-actions,.filters,.salary-note,#salaryMsg,#salaryKpis{display:none}.salary-group-row td{background:#dfeee9;font-weight:bold;text-align:right}</style></head><body>'+sec.innerHTML+'</body></html>'); w.document.close(); setTimeout(()=>w.print(),400);}
  function csv(){const month=$('salaryMonth')?.value||today().slice(0,7); const heads=['أيدي الموظف','الشهر','اسم الموظف في الإقامة','اسم الموظف الحركي','رقم الإقامة','مكان العمل','ملاحظات','الوظيفة','بداية الخدمة','نهاية الخدمة','أيام العمل','أيام الغياب','الأيام المستحقة','الأساسي','البدلات','الإجمالي','راتب الفترة','العمولات','الخصومات','جبر الكسور','السلف','الصافي']; const rows=st.rows.map(r=>[r.employee_ts_id,month,r.residency_name,r.employee_name,r.iqama_no,r.work_location,r.notes,r.job_title,r.start_date,r.end_date,r.work_days,r.absent_days,r.payable_days,r.basic_salary,r.allowance,r.gross_salary,r.salary_by_days,r.commission,r.deductions,r.rounding,r.advance_deduction,r.net_salary]); const csv=[heads,...rows].map(r=>r.map(x=>'"'+S(x).replace(/"/g,'""')+'"').join(',')).join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})); a.download='رواتب_'+month+'.csv'; a.click();}
  function inject(){let sec=$('salaries'); if(!sec){const main=document.querySelector('main.content')||document.body; sec=document.createElement('section'); sec.id='salaries'; sec.className='page hidden'; main.appendChild(sec);} sec.innerHTML=`<style>.salary-table-wrap{max-height:640px;overflow:auto}.salary-table{min-width:2300px}.salary-group-row td{background:#dfeee9;color:#064537;font-weight:900;text-align:right;font-size:13px}.salary-table th{position:sticky;top:0;z-index:2}.sal-input{width:110px;border:1px solid var(--line,#dce6e2);border-radius:8px;padding:6px;text-align:center}.salary-actions{display:flex;gap:8px;flex-wrap:wrap}.salary-note{background:#eef8f4;border:1px solid var(--line,#dce6e2);border-radius:14px;padding:10px;color:#07513f;font-weight:800}</style><div class="card"><div class="table-head"><h2>الرواتب</h2><span class="badge green">${VERSION}</span></div><div class="salary-note">تم حذف منطق الرواتب القديم. المصدر الوحيد: التوزيع الموحد يحدد المشرف والعمال، قسم العمال يعطي الراتب والبدلات، الحضور يعطي الغياب فقط. مكان العمل: زيارة يومية = اسم المشرف، دوام كامل واحد = اسم المشروع.</div><div id="salaryMsg" class="msg hidden"></div><div class="filters"><div><label>الشهر</label><input type="month" id="salaryMonth" value="${today().slice(0,7)}" onchange="tasneefSalariesUnifiedV440.load()"></div><div><label>نوع الكشف</label><select id="salaryType" onchange="tasneefSalariesUnifiedV440.buildRows()"><option value="all">الكل</option><option value="supervisors">رواتب المشرفين</option><option value="workers">رواتب العمال</option><option value="technicians">رواتب الفنيين</option><option value="guards">رواتب الحراس</option></select></div><div><label>المشرف</label><select id="salarySupervisor" onchange="tasneefSalariesUnifiedV440.buildRows()"><option value="">كل المشرفين</option></select></div><div><label>المشروع</label><select id="salaryProject" onchange="tasneefSalariesUnifiedV440.buildRows()"><option value="">كل المشاريع</option></select></div><div><label>بحث</label><input id="salarySearch" oninput="tasneefSalariesUnifiedV440.buildRows()" placeholder="اسم/إقامة/TS"></div></div><div class="salary-actions"><button onclick="tasneefSalariesUnifiedV440.load()">تحديث الرواتب</button><button class="light" onclick="tasneefSalariesUnifiedV440.save(false)">حفظ التعديلات</button><button class="light" onclick="tasneefSalariesUnifiedV440.save(true)">اعتماد الرواتب</button><button class="light" onclick="tasneefSalariesUnifiedV440.print()">طباعة</button><button class="light" onclick="tasneefSalariesUnifiedV440.csv()">تصدير CSV</button></div><div id="salaryKpis" class="kpis small"></div><div class="table-wrap salary-table-wrap"><table class="salary-table"><thead><tr><th>رقم</th><th>أيدي الموظف</th><th>الشهر</th><th>اسم الموظف في الإقامة</th><th>اسم الموظف الحركي</th><th>رقم الإقامة</th><th>مكان العمل</th><th>ملاحظات</th><th>الوظيفة</th><th>بداية الخدمة</th><th>نهاية الخدمة</th><th>أيام العمل</th><th>أيام الغياب</th><th>الأيام المستحقة</th><th>قيمة الرواتب الأساسية</th><th>البدلات</th><th>الإجمالي</th><th>إجمالي الراتب على أيام الفترة</th><th>العمولات</th><th>الخصومات</th><th>جبر الكسور</th><th>خصم السلف</th><th>الصافي</th></tr></thead><tbody id="salaryBody"></tbody><tfoot id="salaryFoot"></tfoot></table></div></div>`;}
  const api={inject,load,buildRows,update,save,print,csv};
  window.tasneefSalariesUnifiedV440=api; window.tasneefSalariesUnifiedV450=api; window.tasneefSalariesUnifiedV451=api; window.tasneefSalariesV10267=api; window.tasneefSalariesV10281=api;
  const oldShow=window.showPage; window.showPage=function(page,btn){const r=oldShow?oldShow.apply(this,arguments):undefined; if(page==='salaries')setTimeout(()=>{inject();load();},80); return r;};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(inject,900)); window.addEventListener('load',()=>setTimeout(inject,1100));
})();

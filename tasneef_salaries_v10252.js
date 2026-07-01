(function(){
  'use strict';
  const VERSION='V10252';
  const $=(id)=>document.getElementById(id);
  const esc=(v)=>String(v??'').replace(/[&<>"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
  const num=(v)=>Number(String(v??'').replace(/,/g,''))||0;
  const money=(v)=>Number(num(v).toFixed(2)).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2});
  const today=()=>new Date().toISOString().slice(0,10);
  const monthStart=(m)=>`${m}-01`;
  const daysInMonth=(m)=>{ const [y,mo]=String(m).split('-').map(Number); return new Date(y,mo,0).getDate(); };
  const dateRangeEnd=(m)=>{ const [y,mo]=String(m).split('-').map(Number); return `${y}-${String(mo).padStart(2,'0')}-${String(new Date(y,mo,0).getDate()).padStart(2,'0')}`; };
  let state={workers:[],projects:[],users:[],attendance:[],settings:[],saved:[],profiles:[],rows:[]};

  function msg(t,kind){ const el=$('salaryMsg'); if(!el) return; el.className='msg '+(kind==='err'?'err':''); el.textContent=t; el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'),5000); }
  async function fetchAll(table, select='*', build){
    let out=[], from=0, size=1000;
    while(true){
      let q=sb.from(table).select(select).range(from,from+size-1);
      if(build) q=build(q);
      const {data,error}=await q;
      if(error) throw error;
      out=out.concat(data||[]);
      if(!data || data.length<size) break;
      from+=size;
    }
    return out;
  }
  function supervisorName(id){ const u=state.users.find(x=>String(x.id)===String(id)); return u?.full_name||u?.username||''; }
  function workerSupId(w){ return w.app_supervisor_id || w.supervisor_id || null; }
  function workerProjectId(w){ return w.project_id || w.assigned_project_id || null; }
  function statusPresent(s){ return ['present','حاضر','حضور'].includes(String(s||'').trim()); }
  function statusAbsent(s){ return ['absent','غائب','غياب'].includes(String(s||'').trim()); }
  function settingFor(type,id){ return state.settings.find(s=>s.entity_type===type && String(s.entity_id)===String(id))||{}; }
  function savedFor(type,id,month){ return state.saved.find(s=>s.entity_type===type && String(s.entity_id)===String(id) && String(s.salary_month||'').slice(0,7)===month)||{}; }
  function workerNameKey(v){ return String(v||'').trim().replace(/\s+/g,' '); }

  function jobCategory(v){
    const s=String(v||'').trim();
    if(s.includes('مشرف')) return 'supervisors';
    if(s.includes('فني') || s.includes('صيانة')) return 'technicians';
    if(s.includes('حارس')) return 'guards';
    return 'workers';
  }
  function profileByName(name){
    const key=workerNameKey(name);
    if(!key) return null;
    return (state.profiles||[]).find(p=>workerNameKey(p.employee_name)===key || workerNameKey(p.residency_name)===key) || null;
  }
  function applyProfile(r, p){
    if(!p) return r;
    r.profile_id=p.id||null;
    r.employee_ts_id=r.employee_ts_id || p.employee_ts_id || '';
    r.residency_name=r.residency_name || p.residency_name || '';
    r.iqama_no=r.iqama_no || p.iqama_no || '';
    r.employee_name=r.employee_name || p.employee_name || '';
    r.work_location=p.work_location || r.work_location || 'FM';
    r.job_title=p.job_title || r.job_title || '';
    if(!r.start_date && p.default_start_date) r.start_date=String(p.default_start_date).slice(0,10);
    if(!r.end_date && p.default_end_date) r.end_date=String(p.default_end_date).slice(0,10);
    if((r.basic_salary===undefined || r.basic_salary===null || num(r.basic_salary)===0) && p.basic_salary!=null) r.basic_salary=num(p.basic_salary);
    if((r.allowance===undefined || r.allowance===null) && p.allowance!=null) r.allowance=num(p.allowance);
    if((r.commission===undefined || r.commission===null || num(r.commission)===0) && p.default_commission!=null) r.commission=num(p.default_commission);
    return r;
  }
  function projectNamesForGroup(g){
    const names=[...g.projectIds].map(id=>state.projects.find(p=>String(p.id)===String(id))?.name).filter(Boolean);
    return [...new Set(names)].join('، ');
  }
  function relatedProfileAttendance(p, month){
    const names=new Set([workerNameKey(p.employee_name),workerNameKey(p.residency_name)].filter(Boolean));
    const present=new Set(), absent=new Set();
    state.attendance.forEach(a=>{
      const d=String(a.attendance_date||'').slice(0,10); if(!d.startsWith(month)) return;
      const nm=workerNameKey(a.worker_identity||a.worker_name);
      if(!names.has(nm)) return;
      if(statusAbsent(a.status)) absent.add(d);
      else if(statusPresent(a.status)) present.add(d);
    });
    absent.forEach(d=>present.delete(d));
    return {present:present.size, absent:absent.size, presentDates:[...present].sort(), absentDates:[...absent].sort(), dates:[...new Set([...present,...absent])].sort()};
  }

  function projectSupId(pid){ const p=state.projects.find(x=>String(x.id)===String(pid)); return p?.supervisor_id||null; }
  function uniqueWorkerGroups(){
    const map=new Map();
    state.workers.filter(w=>String(w.status||'active')!=='deleted' && String(w.status||'active')!=='inactive').forEach(w=>{
      const name=workerNameKey(w.name||w.full_name||w.worker_identity);
      if(!name) return;
      if(!map.has(name)) map.set(name,{name,workers:[],ids:new Set(),supervisorIds:new Set(),projectIds:new Set()});
      const g=map.get(name); g.workers.push(w); if(w.id!=null) g.ids.add(String(w.id));
      const sid=workerSupId(w); if(sid) g.supervisorIds.add(String(sid));
      const pid=workerProjectId(w); if(pid){ g.projectIds.add(String(pid)); const ps=projectSupId(pid); if(ps) g.supervisorIds.add(String(ps)); }
    });
    return [...map.values()].map(g=>{
      g.rep=g.workers.slice().sort((a,b)=>{
        const ap=workerProjectId(a)?0:1, bp=workerProjectId(b)?0:1;
        if(ap!==bp) return ap-bp;
        return Number(a.id||999999)-Number(b.id||999999);
      })[0]||{};
      return g;
    }).sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  }
  function attendanceMatchesGroup(a,g){
    const name=workerNameKey(a.worker_identity||a.worker_name);
    if(name && name===g.name) return true;
    return a.worker_id!=null && g.ids.has(String(a.worker_id));
  }
  function attendanceDaysForGroup(g, month){
    const present=new Set(), absent=new Set();
    state.attendance.forEach(a=>{
      const d=String(a.attendance_date||'').slice(0,10); if(!d.startsWith(month)) return;
      if(!attendanceMatchesGroup(a,g)) return;
      if(statusAbsent(a.status)) absent.add(d);
      else if(statusPresent(a.status)) present.add(d);
    });
    absent.forEach(d=>present.delete(d));
    return {present:present.size, absent:absent.size, presentDates:[...present].sort(), absentDates:[...absent].sort(), dates:[...new Set([...present,...absent])].sort()};
  }
  function groupHasSupervisor(g,sid){ return !sid || g.supervisorIds.has(String(sid)); }
  function groupHasProject(g,pid){ return !pid || g.projectIds.has(String(pid)); }
  function serviceSpanFromDates(dates, fallbackMonth){
    const valid=(dates||[]).filter(Boolean).sort();
    if(valid.length) return {start:valid[0], end:valid[valid.length-1]};
    return {start:monthStart(fallbackMonth), end:dateRangeEnd(fallbackMonth)};
  }
  function normalizeDate(v){ return String(v||'').slice(0,10); }
  function clampDateToMonth(d, month){
    d=normalizeDate(d);
    const start=monthStart(month), end=dateRangeEnd(month);
    if(!d) return '';
    if(d<start) return start;
    if(d>end) return end;
    return d;
  }
  function daysBetweenInclusive(start,end,month){
    start=clampDateToMonth(start,month); end=clampDateToMonth(end,month);
    if(!start || !end) return 0;
    if(end<start){ const t=start; start=end; end=t; }
    const a=new Date(start+'T00:00:00'), b=new Date(end+'T00:00:00');
    return Math.max(0, Math.round((b-a)/86400000)+1);
  }
  function countDatesInRange(dates,start,end,month){
    start=clampDateToMonth(start,month); end=clampDateToMonth(end,month);
    if(!start || !end) return 0;
    if(end<start){ const t=start; start=end; end=t; }
    const seen=new Set((dates||[]).map(normalizeDate).filter(Boolean));
    let c=0; seen.forEach(d=>{ if(d>=start && d<=end) c++; });
    return c;
  }
  function applyPeriodFromDates(r, month){
    const span=serviceSpanFromDates(r._allDates||[], month);
    let start=clampDateToMonth(r.start_date||span.start, month) || monthStart(month);
    let end=clampDateToMonth(r.end_date||span.end, month) || dateRangeEnd(month);
    if(end<start){ const t=start; start=end; end=t; }
    r.start_date=start; r.end_date=end;
    r.work_days=daysBetweenInclusive(start,end,month);
    r.absent_days=countDatesInRange(r._absentDates||[],start,end,month);
    r.payable_days=Math.max(0,num(r.work_days)-num(r.absent_days));
    return r;
  }
  function supervisorAttendanceSpan(uid, month){
    const projectIds=new Set(state.projects.filter(p=>String(p.supervisor_id)===String(uid)).map(p=>String(p.id)));
    const relatedWorkers=state.workers.filter(w=>String(workerSupId(w))===String(uid) || projectIds.has(String(workerProjectId(w))));
    const workerIds=new Set(relatedWorkers.map(w=>String(w.id)));
    const names=new Set(relatedWorkers.map(w=>String(w.name||'').trim()).filter(Boolean));
    const dates=[], absentDates=[];
    state.attendance.forEach(a=>{
      const d=String(a.attendance_date||'').slice(0,10); if(!d.startsWith(month)) return;
      const ok=(a.worker_id!=null && workerIds.has(String(a.worker_id))) || (!a.worker_id && names.has(String(a.worker_identity||'').trim()));
      if(!ok) return;
      dates.push(d);
      if(statusAbsent(a.status)) absentDates.push(d);
    });
    return {...serviceSpanFromDates(dates, month), dates:[...new Set(dates)].sort(), absentDates:[...new Set(absentDates)].sort()};
  }
  function absenceNote(days){
    const d=num(days);
    if(d<=0) return '';
    return 'خصم غياب: '+money(d)+' '+(d===1?'يوم':'أيام');
  }
  function calcRow(r, dim){
    r.gross_salary=num(r.basic_salary)+num(r.allowance);
    r.work_days=num(r.work_days);               // أيام الفترة المسجلة من الحضور والغياب
    r.absent_days=num(r.absent_days);           // أيام الغياب داخل نفس الفترة
    r.payable_days=Math.max(0, r.work_days-r.absent_days); // للعرض فقط
    r.absence_deduction=(num(r.gross_salary)/dim)*r.absent_days;
    // إجمالي الراتب على أيام الفترة = راتب الفترة كاملة، والغياب يظهر في الخصومات حتى يكون واضحًا.
    r.salary_by_days=(num(r.gross_salary)/dim)*r.work_days;
    if(!r._manual_deductions){
      // خصم الغياب يدخل تلقائيًا في عمود الخصومات. لا يعتمد على خصومات محفوظة قديمة بقيمة صفر.
      const manualExtra=num(r.manual_extra_deductions||0);
      r.deductions=num(r.absence_deduction)+manualExtra;
    }
    r.net_salary=num(r.salary_by_days)+num(r.commission)-num(r.deductions)-num(r.advance_deduction)+num(r.rounding);
    return r;
  }
  function buildRows(){
    const month=$('salaryMonth')?.value||today().slice(0,7);
    const dim=daysInMonth(month);
    const type=$('salaryType')?.value||'supervisors';
    const sid=$('salarySupervisor')?.value||'';
    const pid=$('salaryProject')?.value||'';
    const q=($('salarySearch')?.value||'').trim();
    let rows=[];
    const usedProfiles=new Set();

    if(type==='workers' || type==='technicians' || type==='guards' || type==='all'){
      uniqueWorkerGroups().forEach(g=>{
        if(!groupHasSupervisor(g,sid)) return;
        if(!groupHasProject(g,pid)) return;
        const w=g.rep||{};
        const att=attendanceDaysForGroup(g,month);
        const span=serviceSpanFromDates(att.dates, month);
        const set=settingFor('worker',w.id), sv=savedFor('worker',w.id,month);
        const mainSid = workerSupId(w) || [...g.supervisorIds][0] || null;
        const prof=profileByName(g.name);
        let job=(prof?.job_title||set.job_title||'عامل');
        if(type!=='all' && type!==jobCategory(job)) return;
        let r={
          entity_type:'worker', entity_id:w.id || g.name, salary_month:monthStart(month),
          employee_ts_id: sv.employee_ts_id || prof?.employee_ts_id || '',
          residency_name: sv.residency_name || prof?.residency_name || '',
          iqama_no: sv.iqama_no || prof?.iqama_no || '',
          employee_name:g.name,
          work_location:prof?.work_location || projectNamesForGroup(g) || 'FM', project_name:projectNamesForGroup(g), supervisor_id:mainSid, supervisor_name:supervisorName(mainSid),
          job_title:job, start_date:sv.start_date||prof?.default_start_date||span.start, end_date:sv.end_date||prof?.default_end_date||span.end, work_days:att.present, absent_days:att.absent,
          basic_salary: sv.basic_salary??set.basic_salary??prof?.basic_salary??(jobCategory(job)==='guards'?1200:1300),
          allowance: sv.allowance??set.allowance??prof?.allowance??200,
          commission: sv.commission??prof?.default_commission??0, deductions: sv.deductions??0, rounding: sv.rounding??0, advance_deduction: sv.advance_deduction??0,
          payment_method:'', notes: sv.notes||set.notes||prof?.notes||'', _allDates:att.dates, _absentDates:att.absentDates
        };
        applyProfile(r,prof); if(prof?.employee_ts_id) usedProfiles.add(String(prof.employee_ts_id));
        applyPeriodFromDates(r, month);
        const autoDed = (num(r.basic_salary)+num(r.allowance))/dim*num(r.absent_days);
        const savedDed = (sv.deductions!==undefined && sv.deductions!==null) ? num(sv.deductions) : 0;
        r.manual_extra_deductions = Math.max(0, savedDed - autoDed);
        r._manual_deductions = false;
        r.deductions = autoDed + r.manual_extra_deductions;
        if(r.absent_days>0 && (!r.notes || String(r.notes).trim()==='')) r.notes = absenceNote(r.absent_days);
        rows.push(calcRow(r,dim));
      });
    }
    if(type==='supervisors' || type==='all'){
      state.users.filter(u=>String(u.role||'')==='supervisor' && u.is_active!==false).forEach(u=>{
        if(sid && String(u.id)!==String(sid)) return;
        const projects=state.projects.filter(p=>String(p.supervisor_id)===String(u.id) && (!pid || String(p.id)===String(pid)) && String(p.status||'active')!=='inactive');
        if(pid && !projects.length) return;
        const span=supervisorAttendanceSpan(u.id, month);
        const set=settingFor('supervisor',u.id), sv=savedFor('supervisor',u.id,month);
        const nm=u.full_name||u.username||'';
        const prof=profileByName(nm);
        let r={
          entity_type:'supervisor', entity_id:u.id, salary_month:monthStart(month),
          employee_ts_id: sv.employee_ts_id || prof?.employee_ts_id || '',
          residency_name: sv.residency_name || prof?.residency_name || '',
          iqama_no: sv.iqama_no || prof?.iqama_no || '',
          employee_name:nm,
          work_location:'FM', project_name:projects.map(p=>p.name).join('، '), supervisor_id:u.id, supervisor_name:nm,
          job_title:prof?.job_title||set.job_title||'مشرف', start_date:sv.start_date||prof?.default_start_date||span.start, end_date:sv.end_date||prof?.default_end_date||span.end, work_days:dim, absent_days:0,
          basic_salary: sv.basic_salary??set.basic_salary??prof?.basic_salary??2000,
          allowance: sv.allowance??set.allowance??prof?.allowance??300,
          commission: sv.commission??prof?.default_commission??0, deductions: sv.deductions??0, rounding: sv.rounding??0, advance_deduction: sv.advance_deduction??0,
          payment_method:'', notes: sv.notes||set.notes||prof?.notes||'', _allDates:span.dates||[], _absentDates:[]
        };
        applyProfile(r,prof); if(prof?.employee_ts_id) usedProfiles.add(String(prof.employee_ts_id));
        applyPeriodFromDates(r, month);
        rows.push(calcRow(r,dim));
      });
    }

    (state.profiles||[]).forEach((p,idx)=>{
      if(!p.employee_name) return;
      if(p.employee_ts_id && usedProfiles.has(String(p.employee_ts_id))) return;
      const cat=jobCategory(p.job_title);
      if(type!=='all' && type!==cat) return;
      const att=relatedProfileAttendance(p,month);
      const span=serviceSpanFromDates(att.dates, month);
      const start=p.default_start_date || span.start || monthStart(month);
      const end=p.default_end_date || span.end || dateRangeEnd(month);
      let r={
        entity_type:'profile', entity_id:p.employee_ts_id||p.id||('profile_'+idx), profile_id:p.id||null, salary_month:monthStart(month),
        employee_ts_id:p.employee_ts_id||'', residency_name:p.residency_name||'', iqama_no:p.iqama_no||'', employee_name:p.employee_name||'',
        work_location:p.work_location||'FM', project_name:p.work_location||'', supervisor_id:null, supervisor_name:p.work_location||'',
        job_title:p.job_title||'عامل', start_date:start, end_date:end, work_days:att.present||daysBetweenInclusive(start,end,month), absent_days:att.absent||0,
        basic_salary:p.basic_salary??(cat==='supervisors'?2000:1300), allowance:p.allowance??(cat==='supervisors'?300:200),
        commission:p.default_commission??0, deductions:0, rounding:0, advance_deduction:0, payment_method:'', notes:p.notes||'', _allDates:att.dates, _absentDates:att.absentDates
      };
      const sv=savedFor('profile',r.entity_id,month);
      if(sv.employee_name) Object.assign(r,{
        employee_ts_id: sv.employee_ts_id||r.employee_ts_id, residency_name: sv.residency_name||r.residency_name, iqama_no: sv.iqama_no||r.iqama_no,
        start_date: sv.start_date||r.start_date, end_date: sv.end_date||r.end_date, basic_salary: sv.basic_salary??r.basic_salary,
        allowance: sv.allowance??r.allowance, commission: sv.commission??r.commission, deductions: sv.deductions??r.deductions,
        rounding: sv.rounding??r.rounding, advance_deduction: sv.advance_deduction??r.advance_deduction, notes: sv.notes||r.notes
      });
      applyPeriodFromDates(r,month);
      if(r.absent_days>0 && (!r.notes || String(r.notes).trim()==='')) r.notes=absenceNote(r.absent_days);
      rows.push(calcRow(r,dim));
    });

    rows=rows.filter(r=> type==='all' || type===jobCategory(r.job_title));
    if(q) rows=rows.filter(r=>[r.employee_ts_id,r.residency_name,r.iqama_no,r.employee_name,r.supervisor_name,r.project_name,r.job_title].join(' ').includes(q));
    state.rows=rows;
    renderSalary();
  }

  function totals(rows){
    return rows.reduce((a,r)=>{ ['basic_salary','allowance','gross_salary','salary_by_days','commission','deductions','advance_deduction','rounding','net_salary','work_days','absent_days','payable_days'].forEach(k=>a[k]=(a[k]||0)+num(r[k])); return a; },{});
  }
  function rowInput(r,k,cls='sal-input money'){ return `<input class="${cls}" data-key="${k}" data-type="${r.entity_type}" data-id="${r.entity_id}" value="${esc(r[k]??0)}" onchange="tasneefSalariesV10252.update('${r.entity_type}','${r.entity_id}','${k}',this.value)">`; }
  function dateInput(r,k){ return `<input type="date" class="sal-input" style="width:135px" data-key="${k}" data-type="${r.entity_type}" data-id="${r.entity_id}" value="${esc(r[k]||'')}" onchange="tasneefSalariesV10252.update('${r.entity_type}','${r.entity_id}','${k}',this.value)">`; }
  function textInput(r,k,w=130){ return `<input class="sal-input" style="width:${w}px" data-key="${k}" data-type="${r.entity_type}" data-id="${r.entity_id}" value="${esc(r[k]||'')}" onchange="tasneefSalariesV10252.update('${r.entity_type}','${r.entity_id}','${k}',this.value)">`; }
  function renderSalary(){
    const body=$('salaryBody'); if(!body) return;
    const rows=state.rows||[], t=totals(rows), month=$('salaryMonth')?.value||today().slice(0,7);
    $('salaryKpis').innerHTML=`
      <div class="kpi"><small>عدد السجلات</small><b>${rows.length}</b></div>
      <div class="kpi"><small>الراتب الأساسي</small><b>${money(t.basic_salary)}</b></div>
      <div class="kpi"><small>البدلات</small><b>${money(t.allowance)}</b></div>
      <div class="kpi"><small>الخصومات والسلف</small><b>${money(num(t.deductions)+num(t.advance_deduction))}</b></div>
      <div class="kpi"><small>الصافي</small><b>${money(t.net_salary)}</b></div>`;
    body.innerHTML=rows.map((r,i)=>`<tr data-sal-row="${r.entity_type}_${r.entity_id}">
      <td>${i+1}</td><td>${textInput(r,'employee_ts_id',90)}</td><td>${esc(month)}</td>
      <td>${textInput(r,'residency_name',180)}</td><td>${textInput(r,'employee_name',120)}</td><td>${textInput(r,'iqama_no',120)}</td>
      <td>${esc(r.work_location||'FM')}</td><td>${esc(r.job_title||'')}</td>
      <td>${dateInput(r,'start_date')}</td><td>${dateInput(r,'end_date')}</td>
      <td>${money(r.work_days)}</td><td>${money(r.absent_days)}</td><td>${money(r.payable_days)}</td><td>${rowInput(r,'basic_salary')}</td><td>${rowInput(r,'allowance')}</td><td>${money(r.gross_salary)}</td><td>${money(r.salary_by_days)}</td>
      <td>${rowInput(r,'commission')}</td><td>${rowInput(r,'deductions')}</td><td>${rowInput(r,'rounding')}</td><td>${rowInput(r,'advance_deduction')}</td>
      <td><b>${money(r.net_salary)}</b></td>
      <td><input class="sal-input" data-key="notes" data-type="${r.entity_type}" data-id="${r.entity_id}" value="${esc(r.notes||'')}" onchange="tasneefSalariesV10252.update('${r.entity_type}','${r.entity_id}','notes',this.value)"></td>
    </tr>`).join('') || '<tr><td colspan="23">لا توجد بيانات رواتب</td></tr>';
    const foot=$('salaryFoot'); if(foot) foot.innerHTML=`<tr><td colspan="13"><b>الإجمالي</b></td><td>${money(t.basic_salary)}</td><td>${money(t.allowance)}</td><td>${money(t.gross_salary)}</td><td>${money(t.salary_by_days)}</td><td>${money(t.commission)}</td><td>${money(t.deductions)}</td><td>${money(t.rounding)}</td><td>${money(t.advance_deduction)}</td><td>${money(t.net_salary)}</td><td></td></tr>`;
  }
  function update(type,id,key,value){
    const r=state.rows.find(x=>x.entity_type===type && String(x.entity_id)===String(id)); if(!r) return;
    const month=$('salaryMonth')?.value||today().slice(0,7);
    if(key==='deductions') r._manual_deductions=true;
    if(key==='notes') r._manual_notes=true;
    r[key]=['commission','deductions','rounding','advance_deduction','basic_salary','allowance'].includes(key)?num(value):value;
    if(['start_date','end_date'].includes(key)){
      // عند تعديل بداية أو نهاية الخدمة يعاد حساب الأيام حسب الفترة الجديدة فورًا.
      applyPeriodFromDates(r, month);
      r._manual_deductions=false;
      if(r.absent_days>0 && !r._manual_notes) r.notes=absenceNote(r.absent_days);
      if(r.absent_days<=0 && !r._manual_notes && String(r.notes||'').startsWith('خصم غياب')) r.notes='';
    }
    if(key==='deductions'){
      // المستخدم عدّل الخصومات يدويًا؛ نعتبر الرقم المكتوب هو الخصم النهائي.
      r.manual_extra_deductions=Math.max(0, num(r.deductions)-num(r.absence_deduction));
    }
    if(['basic_salary','allowance'].includes(key) && !r._manual_deductions){
      const dim=daysInMonth(month);
      r.absence_deduction=(num(r.basic_salary)+num(r.allowance))/dim*num(r.absent_days);
      r.deductions=num(r.absence_deduction)+num(r.manual_extra_deductions||0);
    }
    calcRow(r,daysInMonth(month)); renderSalary();
  }
  async function loadSalary(){
    try{
      msg('جاري تحميل الرواتب...'); const month=$('salaryMonth')?.value||today().slice(0,7), start=monthStart(month), end=dateRangeEnd(month);
      const [workers,projects,users,attendance,settings,saved,profiles]=await Promise.all([
        fetchAll('workers','*'), fetchAll('projects','*'), fetchAll('app_users','*'),
        fetchAll('attendance','*',q=>q.gte('attendance_date',start).lte('attendance_date',end)),
        fetchAll('salary_settings','*').catch(()=>[]),
        fetchAll('monthly_salaries','*',q=>q.eq('salary_month',start)).catch(()=>[]),
        fetchAll('salary_employee_profiles','*').catch(()=>[])
      ]);
      state={workers,projects,users,attendance,settings,saved,profiles,rows:[]}; fillSalaryFilters(); buildRows(); msg('تم تحميل الرواتب');
    }catch(e){ console.error(e); msg('فشل تحميل الرواتب: '+(e.message||e),'err'); }
  }
  function fillSalaryFilters(){
    const sup=$('salarySupervisor'), pr=$('salaryProject'); if(!sup||!pr) return;
    const sv=sup.value, pv=pr.value;
    sup.innerHTML='<option value="">كل المشرفين</option>'+state.users.filter(u=>String(u.role||'')==='supervisor').map(u=>`<option value="${u.id}">${esc(u.full_name||u.username)}</option>`).join('');
    pr.innerHTML='<option value="">كل المشاريع</option>'+state.projects.filter(p=>String(p.status||'active')!=='inactive').map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
    sup.value=sv; pr.value=pv;
  }
  async function saveProfileRows(){
    const rows=state.rows||[];
    for(const r of rows){
      const payload={
        employee_ts_id:r.employee_ts_id||null,
        residency_name:r.residency_name||'',
        employee_name:r.employee_name||'',
        iqama_no:r.iqama_no||'',
        work_location:r.work_location||'FM',
        job_title:r.job_title||'',
        default_start_date:r.start_date||null,
        default_end_date:r.end_date||null,
        basic_salary:num(r.basic_salary),
        allowance:num(r.allowance),
        default_commission:num(r.commission),
        notes:r.notes||'',
        updated_at:new Date().toISOString()
      };
      if(!payload.employee_name && !payload.employee_ts_id) continue;
      if(r.profile_id){
        const {error}=await sb.from('salary_employee_profiles').update(payload).eq('id',r.profile_id);
        if(error) throw error;
      }else if(payload.employee_ts_id){
        const {error}=await sb.from('salary_employee_profiles').upsert(payload,{onConflict:'employee_ts_id'});
        if(error) throw error;
      }
    }
  }
  async function saveSalary(approve=false){
    try{
      await saveProfileRows().catch(e=>{ console.warn('profiles save skipped/failed',e); });
      const rows=(state.rows||[]).map(r=>({salary_month:monthStart($('salaryMonth')?.value||today().slice(0,7)),entity_type:r.entity_type,entity_id:r.entity_id,employee_ts_id:r.employee_ts_id||'',residency_name:r.residency_name||'',iqama_no:r.iqama_no||'',employee_name:r.employee_name,work_location:r.work_location||'FM',project_name:r.project_name||'',supervisor_id:r.supervisor_id,supervisor_name:r.supervisor_name,job_title:r.job_title,start_date:r.start_date||null,end_date:r.end_date||null,work_days:num(r.work_days),absent_days:num(r.absent_days),payable_days:num(r.payable_days),basic_salary:num(r.basic_salary),allowance:num(r.allowance),gross_salary:num(r.gross_salary),salary_by_days:num(r.salary_by_days),commission:num(r.commission),deductions:num(r.deductions),rounding:num(r.rounding),advance_deduction:num(r.advance_deduction),net_salary:num(r.net_salary),payment_method:'',notes:r.notes||'',is_approved:approve,approved_at:approve?new Date().toISOString():null,updated_at:new Date().toISOString()}));
      if(!rows.length) return msg('لا توجد رواتب للحفظ','err');
      const {error}=await sb.from('monthly_salaries').upsert(rows,{onConflict:'salary_month,entity_type,entity_id'});
      if(error) throw error; msg(approve?'تم اعتماد الرواتب':'تم حفظ تعديلات الرواتب'); await loadSalary();
    }catch(e){ console.error(e); msg('فشل حفظ الرواتب: '+(e.message||e),'err'); }
  }
  function salaryTableHtml(print=false){
    const rows=state.rows||[], t=totals(rows), month=$('salaryMonth')?.value||today().slice(0,7);
    const th=['رقم','أيدي الموظف','الشهر','اسم الموظف في الإقامة','اسم الموظف الحركي','رقم الإقامة','مكان العمل','الوظيفة','بداية الخدمة','نهاية الخدمة','أيام العمل','أيام الغياب','الأيام المستحقة','قيمة الرواتب الأساسية','البدلات','الإجمالي','إجمالي الراتب على أيام الفترة','العمولات','الخصومات','جبر الكسور','خصم السلف','الصافي','ملاحظات'];
    const trs=rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.employee_ts_id||'')}</td><td>${month}</td><td>${esc(r.residency_name||'')}</td><td>${esc(r.employee_name)}</td><td>${esc(r.iqama_no||'')}</td><td>${esc(r.work_location||'FM')}</td><td>${esc(r.job_title)}</td><td>${esc(r.start_date||'')}</td><td>${esc(r.end_date||'')}</td><td>${money(r.work_days)}</td><td>${money(r.absent_days)}</td><td>${money(r.payable_days)}</td><td>${money(r.basic_salary)}</td><td>${money(r.allowance)}</td><td>${money(r.gross_salary)}</td><td>${money(r.salary_by_days)}</td><td>${money(r.commission)}</td><td>${money(r.deductions)}</td><td>${money(r.rounding)}</td><td>${money(r.advance_deduction)}</td><td>${money(r.net_salary)}</td><td>${esc(r.notes)}</td></tr>`).join('');
    return `<html dir="rtl"><head><meta charset="utf-8"><style>
    body{font-family:Tahoma,Arial;margin:20px;color:#111}
    h1{text-align:center;color:#0b5d49;margin:0 0 8px}.meta{text-align:center;margin-bottom:14px;font-weight:bold}
    table{border-collapse:collapse;width:100%;font-size:11px}
    th{background:#0b5d49;color:white;font-weight:bold}
    td,th{border:1px solid #b8d6cd;padding:6px;text-align:center;vertical-align:middle}
    tbody tr:nth-child(even){background:#f7fbfa}
    tfoot td{font-weight:bold;background:#e8f3ef}
    .sign{display:flex;justify-content:space-between;margin-top:35px;font-weight:bold}.sign div{width:32%;text-align:center;border-top:1px solid #111;padding-top:8px}
    </style></head><body><h1>كشف الرواتب</h1><div class="meta">الشهر: ${month} - شركة تصنيف لإدارة المرافق</div><table><thead><tr>${th.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${trs}</tbody><tfoot><tr><td colspan="13">الإجمالي</td><td>${money(t.basic_salary)}</td><td>${money(t.allowance)}</td><td>${money(t.gross_salary)}</td><td>${money(t.salary_by_days)}</td><td>${money(t.commission)}</td><td>${money(t.deductions)}</td><td>${money(t.rounding)}</td><td>${money(t.advance_deduction)}</td><td>${money(t.net_salary)}</td><td></td></tr></tfoot></table><div class="sign"><div>إدارة الحسابات</div><div>مدير التشغيل</div><div>المدير العام</div></div></body></html>`;
  }
  function printSalary(){ const w=window.open('','_blank'); w.document.write(salaryTableHtml(true)); w.document.close(); setTimeout(()=>w.print(),500); }
  function exportSalaryExcel(){ const html=salaryTableHtml(false); const blob=new Blob(['\ufeff'+html],{type:'application/vnd.ms-excel;charset=utf-8;'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`كشف_الرواتب_${$('salaryMonth')?.value||''}.xls`; a.click(); }
  function inject(){
    if($('salaries')) return;
    const side=document.querySelector('.side'); const ref=[...document.querySelectorAll('.side .nav')].find(b=>String(b.textContent).includes('الأوقات الشهرية'));
    const btn=document.createElement('button'); btn.className='nav'; btn.textContent='الرواتب'; btn.onclick=function(){ showPage('salaries',this); setTimeout(loadSalary,50); };
    if(side) side.insertBefore(btn, ref?ref.nextSibling:side.querySelector('.nav.danger'));
    const main=document.querySelector('main.content'); const sec=document.createElement('section'); sec.id='salaries'; sec.className='page hidden'; sec.innerHTML=`
      <style>.salary-table-wrap{max-height:640px;overflow:auto}.salary-table{min-width:2300px}.salary-table th{position:sticky;top:0;z-index:2}.sal-input{width:110px;border:1px solid var(--line);border-radius:8px;padding:6px;text-align:center}.salary-actions{display:flex;gap:8px;flex-wrap:wrap}.salary-note{background:#eef8f4;border:1px solid var(--line);border-radius:14px;padding:10px;color:var(--brand);font-weight:800}</style>
      <div class="card"><div class="table-head"><h2>الرواتب</h2><span class="badge green">${VERSION}</span></div><div class="salary-note">تمت مطابقة كشف الرواتب مع ملف Excel: أيدي الموظف TS قابل للتعديل، اسم الموظف في الإقامة، الاسم الحركي، رقم الإقامة، وفلاتر العمال/المشرفين/الفنيين/الحراس.</div><div id="salaryMsg" class="msg hidden"></div>
      <div class="filters"><div><label>الشهر</label><input type="month" id="salaryMonth" value="${today().slice(0,7)}" onchange="tasneefSalariesV10252.load()"></div><div><label>نوع الكشف</label><select id="salaryType" onchange="tasneefSalariesV10252.buildRows()"><option value="supervisors">رواتب المشرفين</option><option value="workers">رواتب العمال</option><option value="technicians">رواتب الفنيين</option><option value="guards">رواتب الحراس</option><option value="all">الكل</option></select></div><div><label>المشرف</label><select id="salarySupervisor" onchange="tasneefSalariesV10252.buildRows()"><option value="">كل المشرفين</option></select></div><div><label>المشروع</label><select id="salaryProject" onchange="tasneefSalariesV10252.buildRows()"><option value="">كل المشاريع</option></select></div><div><label>بحث</label><input id="salarySearch" oninput="tasneefSalariesV10252.buildRows()" placeholder="اسم/إقامة/TS"></div></div>
      <div class="salary-actions"><button onclick="tasneefSalariesV10252.load()">تحديث الرواتب</button><button class="light" onclick="tasneefSalariesV10252.save(false)">حفظ التعديلات</button><button class="light" onclick="tasneefSalariesV10252.save(true)">اعتماد الرواتب</button><button class="light" onclick="tasneefSalariesV10252.print()">طباعة</button><button class="light" onclick="tasneefSalariesV10252.exportExcel()">تصدير Excel</button></div><div id="salaryKpis" class="kpis small"></div>
      <div class="table-wrap salary-table-wrap"><table class="salary-table"><thead><tr><th>رقم</th><th>أيدي الموظف</th><th>الشهر</th><th>اسم الموظف في الإقامة</th><th>اسم الموظف الحركي</th><th>رقم الإقامة</th><th>مكان العمل</th><th>الوظيفة</th><th>بداية الخدمة</th><th>نهاية الخدمة</th><th>أيام العمل</th><th>أيام الغياب</th><th>الأيام المستحقة</th><th>قيمة الرواتب الأساسية</th><th>البدلات</th><th>الإجمالي</th><th>إجمالي الراتب على أيام الفترة</th><th>العمولات</th><th>الخصومات</th><th>جبر الكسور</th><th>خصم السلف</th><th>الصافي</th><th>ملاحظات</th></tr></thead><tbody id="salaryBody"></tbody><tfoot id="salaryFoot"></tfoot></table></div></div>`;
    if(main) main.appendChild(sec);
  }
  window.tasneefSalariesV10252={inject,load:loadSalary,buildRows,update,save:saveSalary,print:printSalary,exportExcel:exportSalaryExcel};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(inject,500));
  window.addEventListener('load',()=>setTimeout(inject,700));
})();

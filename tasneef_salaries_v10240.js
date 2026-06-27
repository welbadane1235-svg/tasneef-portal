(function(){
  'use strict';
  const VERSION='V10240';
  const $=(id)=>document.getElementById(id);
  const esc=(v)=>String(v??'').replace(/[&<>"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
  const num=(v)=>Number(String(v??'').replace(/,/g,''))||0;
  const money=(v)=>Number(num(v).toFixed(2)).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2});
  const today=()=>new Date().toISOString().slice(0,10);
  const monthStart=(m)=>`${m}-01`;
  const daysInMonth=(m)=>{ const [y,mo]=String(m).split('-').map(Number); return new Date(y,mo,0).getDate(); };
  const dateRangeEnd=(m)=>{ const [y,mo]=String(m).split('-').map(Number); return `${y}-${String(mo).padStart(2,'0')}-${String(new Date(y,mo,0).getDate()).padStart(2,'0')}`; };
  let state={workers:[],projects:[],users:[],attendance:[],settings:[],saved:[],rows:[]};

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
    return {present:present.size, absent:absent.size, dates:[...new Set([...present,...absent])].sort()};
  }
  function groupHasSupervisor(g,sid){ return !sid || g.supervisorIds.has(String(sid)); }
  function groupHasProject(g,pid){ return !pid || g.projectIds.has(String(pid)); }
  function serviceSpanFromDates(dates, fallbackMonth){
    const valid=(dates||[]).filter(Boolean).sort();
    if(valid.length) return {start:valid[0], end:valid[valid.length-1]};
    return {start:monthStart(fallbackMonth), end:dateRangeEnd(fallbackMonth)};
  }
  function supervisorAttendanceSpan(uid, month){
    const projectIds=new Set(state.projects.filter(p=>String(p.supervisor_id)===String(uid)).map(p=>String(p.id)));
    const workerIds=new Set(state.workers.filter(w=>String(workerSupId(w))===String(uid) || projectIds.has(String(workerProjectId(w)))).map(w=>String(w.id)));
    const names=new Set(state.workers.filter(w=>String(workerSupId(w))===String(uid) || projectIds.has(String(workerProjectId(w)))).map(w=>String(w.name||'').trim()));
    const dates=[];
    state.attendance.forEach(a=>{
      const d=String(a.attendance_date||'').slice(0,10); if(!d.startsWith(month)) return;
      if((a.worker_id!=null && workerIds.has(String(a.worker_id))) || (!a.worker_id && names.has(String(a.worker_identity||'').trim()))) dates.push(d);
    });
    return serviceSpanFromDates(dates, month);
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

    if(type==='workers' || type==='all'){
      uniqueWorkerGroups().forEach(g=>{
        if(!groupHasSupervisor(g,sid)) return;
        if(!groupHasProject(g,pid)) return;
        const w=g.rep||{};
        const att=attendanceDaysForGroup(g,month);
        const span=serviceSpanFromDates(att.dates, month);
        const set=settingFor('worker',w.id), sv=savedFor('worker',w.id,month);
        const mainSid = workerSupId(w) || [...g.supervisorIds][0] || null;
        let r={
          entity_type:'worker', entity_id:w.id || g.name, salary_month:monthStart(month), employee_name:g.name,
          work_location:'FM', project_name:'', supervisor_id:mainSid, supervisor_name:supervisorName(mainSid),
          job_title:set.job_title||'عامل', start_date:sv.start_date||span.start, end_date:sv.end_date||span.end, work_days:att.present, absent_days:att.absent,
          basic_salary: sv.basic_salary??set.basic_salary??1300,
          allowance: sv.allowance??set.allowance??200,
          commission: sv.commission??0, deductions: sv.deductions??0, rounding: sv.rounding??0, advance_deduction: sv.advance_deduction??0,
          payment_method:'', notes: sv.notes||set.notes||''
        };
        // بدون تكرار أسماء: الراتب يحسب لكل اسم مرة واحدة من كل سجلات حضوره وغيابه.
        r.work_days = att.dates.length || (att.present + att.absent);
        r.payable_days = Math.max(0, r.work_days - r.absent_days);
        const autoDed = (num(r.basic_salary)+num(r.allowance))/dim*num(r.absent_days);
        // V10223: الخصومات تبدأ بخصم الغياب دائمًا. إذا كان محفوظًا خصم أكبر من خصم الغياب نعتبر الفرق خصمًا يدويًا إضافيًا.
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
        let r={
          entity_type:'supervisor', entity_id:u.id, salary_month:monthStart(month), employee_name:u.full_name||u.username||'',
          work_location:'FM', project_name:'', supervisor_id:u.id, supervisor_name:u.full_name||u.username||'',
          job_title:set.job_title||'مشرف', start_date:sv.start_date||span.start, end_date:sv.end_date||span.end, work_days:dim, absent_days:0,
          basic_salary: sv.basic_salary??set.basic_salary??2000,
          allowance: sv.allowance??set.allowance??300,
          commission: sv.commission??0, deductions: sv.deductions??0, rounding: sv.rounding??0, advance_deduction: sv.advance_deduction??0,
          payment_method:'', notes: sv.notes||set.notes||''
        };
        rows.push(calcRow(r,dim));
      });
    }
    if(q) rows=rows.filter(r=>[r.employee_name,r.supervisor_name,r.job_title].join(' ').includes(q));
    state.rows=rows;
    renderSalary();
  }
  function totals(rows){
    return rows.reduce((a,r)=>{ ['basic_salary','allowance','gross_salary','salary_by_days','commission','deductions','advance_deduction','rounding','net_salary','work_days','absent_days','payable_days'].forEach(k=>a[k]=(a[k]||0)+num(r[k])); return a; },{});
  }
  function rowInput(r,k,cls='sal-input money'){ return `<input class="${cls}" data-key="${k}" data-type="${r.entity_type}" data-id="${r.entity_id}" value="${esc(r[k]??0)}" onchange="tasneefSalariesV10240.update('${r.entity_type}','${r.entity_id}','${k}',this.value)">`; }
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
      <td>${i+1}</td><td>${esc(month)}</td><td><b>${esc(r.employee_name)}</b><br><small>${r.entity_type==='supervisor'?'مشرف':'عامل'}</small></td>
      <td>${esc(r.work_location||'FM')}</td><td>${esc(r.job_title||'')}</td>
      <td>${esc(r.start_date||'')}</td><td>${esc(r.end_date||'')}</td>
      <td>${money(r.work_days)}</td><td>${money(r.absent_days)}</td><td>${money(r.payable_days)}</td><td>${rowInput(r,'basic_salary')}</td><td>${rowInput(r,'allowance')}</td><td>${money(r.gross_salary)}</td><td>${money(r.salary_by_days)}</td>
      <td>${rowInput(r,'commission')}</td><td>${rowInput(r,'deductions')}</td><td>${rowInput(r,'rounding')}</td><td>${rowInput(r,'advance_deduction')}</td>
      <td><b>${money(r.net_salary)}</b></td>
      <td><input class="sal-input" data-key="notes" data-type="${r.entity_type}" data-id="${r.entity_id}" value="${esc(r.notes||'')}" onchange="tasneefSalariesV10240.update('${r.entity_type}','${r.entity_id}','notes',this.value)"></td>
    </tr>`).join('') || '<tr><td colspan="20">لا توجد بيانات رواتب</td></tr>';
    const foot=$('salaryFoot'); if(foot) foot.innerHTML=`<tr><td colspan="10"><b>الإجمالي</b></td><td>${money(t.basic_salary)}</td><td>${money(t.allowance)}</td><td>${money(t.gross_salary)}</td><td>${money(t.salary_by_days)}</td><td>${money(t.commission)}</td><td>${money(t.deductions)}</td><td>${money(t.rounding)}</td><td>${money(t.advance_deduction)}</td><td>${money(t.net_salary)}</td><td></td></tr>`;
  }
  function update(type,id,key,value){
    const r=state.rows.find(x=>x.entity_type===type && String(x.entity_id)===String(id)); if(!r) return;
    if(key==='deductions') r._manual_deductions=true;
    if(key==='notes') r._manual_notes=true;
    r[key]=['commission','deductions','rounding','advance_deduction','basic_salary','allowance'].includes(key)?num(value):value;
    if(key==='deductions'){
      // المستخدم عدّل الخصومات يدويًا؛ نعتبر الرقم المكتوب هو الخصم النهائي.
      r.manual_extra_deductions=Math.max(0, num(r.deductions)-num(r.absence_deduction));
    }
    if(['basic_salary','allowance'].includes(key) && !r._manual_deductions){
      const dim=daysInMonth($('salaryMonth')?.value||today().slice(0,7));
      r.absence_deduction=(num(r.basic_salary)+num(r.allowance))/dim*num(r.absent_days);
      r.deductions=num(r.absence_deduction)+num(r.manual_extra_deductions||0);
    }
    calcRow(r,daysInMonth($('salaryMonth')?.value||today().slice(0,7))); renderSalary();
  }
  async function loadSalary(){
    try{
      msg('جاري تحميل الرواتب...'); const month=$('salaryMonth')?.value||today().slice(0,7), start=monthStart(month), end=dateRangeEnd(month);
      const [workers,projects,users,attendance,settings,saved]=await Promise.all([
        fetchAll('workers','*'), fetchAll('projects','*'), fetchAll('app_users','*'),
        fetchAll('attendance','*',q=>q.gte('attendance_date',start).lte('attendance_date',end)),
        fetchAll('salary_settings','*').catch(()=>[]),
        fetchAll('monthly_salaries','*',q=>q.eq('salary_month',start)).catch(()=>[])
      ]);
      state={workers,projects,users,attendance,settings,saved,rows:[]}; fillSalaryFilters(); buildRows(); msg('تم تحميل الرواتب');
    }catch(e){ console.error(e); msg('فشل تحميل الرواتب: '+(e.message||e),'err'); }
  }
  function fillSalaryFilters(){
    const sup=$('salarySupervisor'), pr=$('salaryProject'); if(!sup||!pr) return;
    const sv=sup.value, pv=pr.value;
    sup.innerHTML='<option value="">كل المشرفين</option>'+state.users.filter(u=>String(u.role||'')==='supervisor').map(u=>`<option value="${u.id}">${esc(u.full_name||u.username)}</option>`).join('');
    pr.innerHTML='<option value="">كل المشاريع</option>'+state.projects.filter(p=>String(p.status||'active')!=='inactive').map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
    sup.value=sv; pr.value=pv;
  }
  async function saveSalary(approve=false){
    try{
      const rows=(state.rows||[]).map(r=>({salary_month:monthStart($('salaryMonth')?.value||today().slice(0,7)),entity_type:r.entity_type,entity_id:r.entity_id,employee_name:r.employee_name,work_location:'FM',project_name:'',supervisor_id:r.supervisor_id,supervisor_name:r.supervisor_name,job_title:r.job_title,start_date:r.start_date||null,end_date:r.end_date||null,work_days:num(r.work_days),absent_days:num(r.absent_days),payable_days:num(r.payable_days),basic_salary:num(r.basic_salary),allowance:num(r.allowance),gross_salary:num(r.gross_salary),salary_by_days:num(r.salary_by_days),commission:num(r.commission),deductions:num(r.deductions),rounding:num(r.rounding),advance_deduction:num(r.advance_deduction),net_salary:num(r.net_salary),payment_method:'',notes:r.notes||'',is_approved:approve,approved_at:approve?new Date().toISOString():null,updated_at:new Date().toISOString()}));
      if(!rows.length) return msg('لا توجد رواتب للحفظ','err');
      const {error}=await sb.from('monthly_salaries').upsert(rows,{onConflict:'salary_month,entity_type,entity_id'});
      if(error) throw error; msg(approve?'تم اعتماد الرواتب':'تم حفظ تعديلات الرواتب'); await loadSalary();
    }catch(e){ console.error(e); msg('فشل حفظ الرواتب: '+(e.message||e),'err'); }
  }
  function salaryTableHtml(print=false){
    const rows=state.rows||[], t=totals(rows), month=$('salaryMonth')?.value||today().slice(0,7);
    const th=['رقم','الشهر','اسم الموظف','مكان العمل','الوظيفة','بداية الخدمة','نهاية الخدمة','أيام العمل','أيام الغياب','الأيام المستحقة','قيمة الرواتب الأساسية','البدلات','الإجمالي','إجمالي الراتب على أيام الفترة','العمولات','الخصومات','جبر الكسور','خصم السلف','الصافي','ملاحظات'];
    const trs=rows.map((r,i)=>`<tr><td>${i+1}</td><td>${month}</td><td>${esc(r.employee_name)}</td><td>FM</td><td>${esc(r.job_title)}</td><td>${esc(r.start_date||'')}</td><td>${esc(r.end_date||'')}</td><td>${money(r.work_days)}</td><td>${money(r.absent_days)}</td><td>${money(r.payable_days)}</td><td>${money(r.basic_salary)}</td><td>${money(r.allowance)}</td><td>${money(r.gross_salary)}</td><td>${money(r.salary_by_days)}</td><td>${money(r.commission)}</td><td>${money(r.deductions)}</td><td>${money(r.rounding)}</td><td>${money(r.advance_deduction)}</td><td>${money(r.net_salary)}</td><td>${esc(r.notes)}</td></tr>`).join('');
    return `<html dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Tahoma,Arial;margin:20px;color:#111}h1{text-align:center;color:#0b5d49;margin:0 0 8px}.meta{text-align:center;margin-bottom:14px}table{border-collapse:collapse;width:100%;font-size:12px}th{background:#0b5d49;color:white}td,th{border:1px solid #b8d6cd;padding:6px;text-align:center}tfoot td{font-weight:bold;background:#e8f3ef}.sign{display:flex;justify-content:space-between;margin-top:35px;font-weight:bold}.sign div{width:32%;text-align:center;border-top:1px solid #111;padding-top:8px}</style></head><body><h1>كشف الرواتب</h1><div class="meta">الشهر: ${month} - شركة تصنيف لإدارة المرافق</div><table><thead><tr>${th.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${trs}</tbody><tfoot><tr><td colspan="10">الإجمالي</td><td>${money(t.basic_salary)}</td><td>${money(t.allowance)}</td><td>${money(t.gross_salary)}</td><td>${money(t.salary_by_days)}</td><td>${money(t.commission)}</td><td>${money(t.deductions)}</td><td>${money(t.rounding)}</td><td>${money(t.advance_deduction)}</td><td>${money(t.net_salary)}</td><td></td></tr></tfoot></table><div class="sign"><div>إدارة الحسابات</div><div>مدير التشغيل</div><div>المدير العام</div></div></body></html>`;
  }
  function printSalary(){ const w=window.open('','_blank'); w.document.write(salaryTableHtml(true)); w.document.close(); setTimeout(()=>w.print(),500); }

  function xmlEsc(v){ return String(v??'').replace(/[&<>"']/g,function(s){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[s]; }); }
  function xCell(v,style){
    const isNum=(typeof v==='number' && isFinite(v));
    const ss=style?` ss:StyleID="${style}"`:'';
    if(v===null || v===undefined || v==='') return `<Cell${ss}/>`;
    const val=isNum ? Number((+v).toFixed(2)) : v;
    return `<Cell${ss}><Data ss:Type="${isNum?'Number':'String'}">${xmlEsc(val)}</Data></Cell>`;
  }
  function xRow(arr,style){ return '<Row>'+arr.map(v=>xCell(v,style)).join('')+'</Row>'; }
  function arabicMonthLabel(m){
    const names=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    const parts=String(m||'').split('-'); const mo=Number(parts[1]||1); return names[mo-1]||String(m||'');
  }
  function monthYear(m){ const parts=String(m||'').split('-'); return `${arabicMonthLabel(m)} ${parts[0]||''}`.trim(); }
  function locationKey(r){ return String(r.work_location||'FM').trim().toUpperCase(); }
  function salaryExportRows(location){
    const rows=state.rows||[];
    if(location==='CN') return rows.filter(r=>locationKey(r)==='CN');
    return rows.filter(r=>locationKey(r)!=='CN');
  }
  function salaryExportSheet(name,title,rows,month,location){
    const headers=['ملاحظات','طريقة السداد','الصافي ','خصم السلف ','جبر الكسور','الخصومات ','العمولات ','اجمالي  الراتب على الأيام ','الإجمالي ','البدلات ','قمية الرواتب الأساسية ','أيام العمل ','نهاية الخدمة ','بداية الخدمة ','الوظيفة','اسم المشروع','مكان العمل','اسم الموظف ','الشهر','رقم '];
    const body=[];
    body.push(xRow(new Array(21).fill('')));
    body.push(xRow(['', new Date().toISOString().slice(0,10), ...new Array(19).fill('')], 'date'));
    body.push(xRow(['', title, ...new Array(19).fill('')], 'title'));
    body.push(xRow(['', ...headers], 'header'));
    let sums={net:0,adv:0,round:0,ded:0,comm:0,salaryDays:0,gross:0,allow:0,basic:0,work:0};
    rows.forEach((r,i)=>{
      sums.net+=num(r.net_salary); sums.adv+=num(r.advance_deduction); sums.round+=num(r.rounding); sums.ded+=num(r.deductions); sums.comm+=num(r.commission); sums.salaryDays+=num(r.salary_by_days); sums.gross+=num(r.gross_salary); sums.allow+=num(r.allowance); sums.basic+=num(r.basic_salary); sums.work+=num(r.work_days);
      body.push(xRow(['', r.notes||'', r.payment_method||'', num(r.net_salary), num(r.advance_deduction), num(r.rounding), num(r.deductions), num(r.commission), num(r.salary_by_days), num(r.gross_salary), num(r.allowance), num(r.basic_salary), num(r.work_days), r.end_date||'', r.start_date||'', r.job_title||'', r.project_name||'', location, r.employee_name||'', arabicMonthLabel(month), i+1]));
    });
    body.push(xRow(['', '', '', sums.net, sums.adv, sums.round, sums.ded, sums.comm, sums.salaryDays, sums.gross, sums.allow, sums.basic, 'الإجمالي', '', '', '', '', '', '', '', ''], 'total'));
    body.push(xRow(new Array(21).fill(''))); body.push(xRow(new Array(21).fill(''))); body.push(xRow(new Array(21).fill('')));
    body.push(xRow(['','إدارة الحسابات',...new Array(16).fill(''),'المدير العام','',''], 'sign'));
    body.push(xRow(new Array(21).fill('')));
    body.push(xRow(['','..............................................',...new Array(16).fill(''),'..............................................','',''], 'sign'));
    return `<Worksheet ss:Name="${xmlEsc(name)}"><Table ss:DefaultColumnWidth="85" ss:DefaultRowHeight="18">${body.join('')}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><DisplayRightToLeft/><FreezePanes/><FrozenNoSplit/><SplitHorizontal>4</SplitHorizontal><TopRowBottomPane>4</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions></Worksheet>`;
  }
  function projectAllocationSheet(month){
    const projects=(state.projects||[]).filter(p=>String(p.status||'active')!=='inactive');
    const totalUnits=projects.reduce((a,p)=>a+num(p.units_count||p.apartments_count||p.apartment_count||p.units||p.flats||p.shops||0),0)||1;
    const rows=[];
    rows.push(xRow(new Array(12).fill('')));
    rows.push(xRow(['', '', '', '', '', '', '', '', '', '', '', new Date().toISOString().slice(0,10)], 'date'));
    rows.push(xRow(['','تقسيم رواتب المشاريع',...new Array(10).fill('')], 'title'));
    rows.push(xRow(['','م','بيانات المشروع','','','','','','الوقت المتبقي','','','ملاحظات'], 'header'));
    rows.push(xRow(['','','اسم المشروع','عدد العمائر','عدد الشقق','نسبة رواتب الإدارة والصيانة ','تاريخ بداية العقد','تاريخ نهاية العقد','التاريخ يدوي','الأيام','الشهر',''], 'header'));
    projects.forEach((p,i)=>{
      const units=num(p.units_count||p.apartments_count||p.apartment_count||p.units||p.flats||p.shops||0);
      const buildings=num(p.buildings_count||p.building_count||p.buildings||p.towers||0);
      const ratio=units/totalUnits;
      rows.push(xRow(['', i+1, p.name||'', buildings, units, ratio, (p.contract_start||p.start_date||''), (p.contract_end||p.end_date||''), '', '', '', p.notes||'']));
    });
    return `<Worksheet ss:Name="ورقة2"><Table ss:DefaultColumnWidth="90" ss:DefaultRowHeight="18">${rows.join('')}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><DisplayRightToLeft/><FreezePanes/><FrozenNoSplit/><SplitHorizontal>5</SplitHorizontal><TopRowBottomPane>5</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions></Worksheet>`;
  }
  function exportSalaryExcel(){
    const month=$('salaryMonth')?.value||today().slice(0,7);
    const cnRows=salaryExportRows('CN');
    const fmRows=salaryExportRows('FM');
    const xml=`<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40"><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Tahoma" ss:Size="10"/></Style><Style ss:ID="title"><Font ss:FontName="Tahoma" ss:Size="14" ss:Bold="1"/><Alignment ss:Horizontal="Center"/></Style><Style ss:ID="header"><Interior ss:Color="#0B5D49" ss:Pattern="Solid"/><Font ss:FontName="Tahoma" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style><Style ss:ID="total"><Interior ss:Color="#E8F3EF" ss:Pattern="Solid"/><Font ss:FontName="Tahoma" ss:Bold="1"/><Alignment ss:Horizontal="Center"/></Style><Style ss:ID="sign"><Font ss:FontName="Tahoma" ss:Bold="1"/><Alignment ss:Horizontal="Center"/></Style><Style ss:ID="date"><Alignment ss:Horizontal="Center"/></Style></Styles>${salaryExportSheet('ورقة1',`رواتب العماله الخارجية ( تصنيف كلين ) عن شهر ${monthYear(month)} `,cnRows,month,'CN')}${projectAllocationSheet(month)}${salaryExportSheet('ورقة3',`رواتب العماله الخارجية ( تصنيف مرافق ) عن شهر ${monthYear(month)} `,fmRows,month,'FM')}</Workbook>`;
    const blob=new Blob(['\ufeff'+xml],{type:'application/vnd.ms-excel;charset=utf-8;'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`كشف_الرواتب_ثلاث_اوراق_${month}.xls`; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},500);
  }
  function inject(){
    if($('salaries')) return;
    const side=document.querySelector('.side'); const ref=[...document.querySelectorAll('.side .nav')].find(b=>String(b.textContent).includes('الأوقات الشهرية'));
    const btn=document.createElement('button'); btn.className='nav'; btn.textContent='الرواتب'; btn.onclick=function(){ showPage('salaries',this); setTimeout(loadSalary,50); };
    if(side) side.insertBefore(btn, ref?ref.nextSibling:side.querySelector('.nav.danger'));
    const main=document.querySelector('main.content'); const sec=document.createElement('section'); sec.id='salaries'; sec.className='page hidden'; sec.innerHTML=`
      <style>.salary-table-wrap{max-height:640px;overflow:auto}.salary-table{min-width:1700px}.salary-table th{position:sticky;top:0;z-index:2}.sal-input{width:110px;border:1px solid var(--line);border-radius:8px;padding:6px;text-align:center}.salary-actions{display:flex;gap:8px;flex-wrap:wrap}.salary-note{background:#eef8f4;border:1px solid var(--line);border-radius:14px;padding:10px;color:var(--brand);font-weight:800}</style>
      <div class="card"><div class="table-head"><h2>الرواتب</h2><span class="badge green">${VERSION}</span></div><div class="salary-note">مكان العمل ثابت FM. تم حذف اسم المشروع وطريقة السداد. الرواتب بدون تكرار أسماء العمال مثل كشف الحضور والغياب. العمال 1300 + 200 والمشرفون 2000 + 300. خصم الغياب يدخل تلقائيًا داخل عمود الخصومات ويظهر في الملاحظات، ويمكن تعديل الخصومات يدويًا.</div><div id="salaryMsg" class="msg hidden"></div>
      <div class="filters"><div><label>الشهر</label><input type="month" id="salaryMonth" value="${today().slice(0,7)}" onchange="tasneefSalariesV10240.load()"></div><div><label>نوع الكشف</label><select id="salaryType" onchange="tasneefSalariesV10240.buildRows()"><option value="supervisors">رواتب المشرفين</option><option value="workers">رواتب العمال</option><option value="all">الكل</option></select></div><div><label>المشرف</label><select id="salarySupervisor" onchange="tasneefSalariesV10240.buildRows()"><option value="">كل المشرفين</option></select></div><div><label>المشروع</label><select id="salaryProject" onchange="tasneefSalariesV10240.buildRows()"><option value="">كل المشاريع</option></select></div><div><label>بحث</label><input id="salarySearch" oninput="tasneefSalariesV10240.buildRows()" placeholder="اسم الموظف"></div></div>
      <div class="salary-actions"><button onclick="tasneefSalariesV10240.load()">تحديث الرواتب</button><button class="light" onclick="tasneefSalariesV10240.save(false)">حفظ التعديلات</button><button class="light" onclick="tasneefSalariesV10240.save(true)">اعتماد الرواتب</button><button class="light" onclick="tasneefSalariesV10240.print()">طباعة</button><button class="light" onclick="tasneefSalariesV10240.exportExcel()">تصدير Excel</button></div><div id="salaryKpis" class="kpis small"></div>
      <div class="table-wrap salary-table-wrap"><table class="salary-table"><thead><tr><th>رقم</th><th>الشهر</th><th>اسم الموظف</th><th>مكان العمل</th><th>الوظيفة</th><th>بداية الخدمة</th><th>نهاية الخدمة</th><th>أيام العمل</th><th>أيام الغياب</th><th>الأيام المستحقة</th><th>قيمة الرواتب الأساسية</th><th>البدلات</th><th>الإجمالي</th><th>إجمالي الراتب على أيام الفترة</th><th>العمولات</th><th>الخصومات</th><th>جبر الكسور</th><th>خصم السلف</th><th>الصافي</th><th>ملاحظات</th></tr></thead><tbody id="salaryBody"></tbody><tfoot id="salaryFoot"></tfoot></table></div></div>`;
    if(main) main.appendChild(sec);
  }
  window.tasneefSalariesV10240={inject,load:loadSalary,buildRows,update,save:saveSalary,print:printSalary,exportExcel:exportSalaryExcel};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(inject,500));
  window.addEventListener('load',()=>setTimeout(inject,700));
})();

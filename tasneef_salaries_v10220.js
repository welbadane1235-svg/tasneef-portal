(function(){
  'use strict';
  const VERSION='V10220';
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
  function attendanceMatchesWorker(a,w){
    const wid=String(w.id), name=String(w.name||'').trim();
    return (a.worker_id!=null && String(a.worker_id)===wid) || (!a.worker_id && String(a.worker_identity||'').trim()===name);
  }
  function attendanceDaysForWorker(w, month){
    const present=new Set(), absent=new Set();
    state.attendance.forEach(a=>{
      const d=String(a.attendance_date||'').slice(0,10); if(!d.startsWith(month)) return;
      if(!attendanceMatchesWorker(a,w)) return;
      if(statusAbsent(a.status)) absent.add(d);
      else if(statusPresent(a.status)) present.add(d);
    });
    absent.forEach(d=>present.delete(d));
    return {present:present.size, absent:absent.size, dates:[...new Set([...present,...absent])].sort()};
  }
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
    // إجمالي الراتب على أيام الفترة = راتب الفترة كاملة، والغياب يظهر في الخصومات حتى يكون واضحًا وممكن تعديله.
    r.salary_by_days=(num(r.gross_salary)/dim)*r.work_days;
    if(!r._manual_deductions) r.deductions=num(r.deductions||0);
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
      state.workers.filter(w=>String(w.status||'active')!=='deleted' && String(w.status||'active')!=='inactive').forEach(w=>{
        if(sid && String(workerSupId(w))!==String(sid)) return;
        if(pid && String(workerProjectId(w))!==String(pid)) return;
        const att=attendanceDaysForWorker(w,month);
        const span=serviceSpanFromDates(att.dates, month);
        const set=settingFor('worker',w.id), sv=savedFor('worker',w.id,month);
        let r={
          entity_type:'worker', entity_id:w.id, salary_month:monthStart(month), employee_name:w.name||'',
          work_location:'FM', project_name:'', supervisor_id:workerSupId(w), supervisor_name:supervisorName(workerSupId(w)),
          job_title:set.job_title||'عامل', start_date:sv.start_date||span.start, end_date:sv.end_date||span.end, work_days:att.present, absent_days:att.absent,
          basic_salary: sv.basic_salary??set.basic_salary??1300,
          allowance: sv.allowance??set.allowance??200,
          commission: sv.commission??0, deductions: sv.deductions??0, rounding: sv.rounding??0, advance_deduction: sv.advance_deduction??0,
          payment_method:'', notes: sv.notes||set.notes||''
        };
        // أيام العمل = كل أيام الفترة المسجلة، وليس الحضور فقط. الغياب يذهب تلقائيًا إلى الخصومات.
        r.work_days = att.dates.length || (att.present + att.absent);
        r.payable_days = Math.max(0, r.work_days - r.absent_days);
        const autoDed = (num(r.basic_salary)+num(r.allowance))/dim*num(r.absent_days);
        r._manual_deductions = (sv.deductions!==undefined && sv.deductions!==null);
        if(!r._manual_deductions) r.deductions = autoDed;
        if(!r.notes && r.absent_days>0) r.notes = absenceNote(r.absent_days);
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
  function rowInput(r,k,cls='sal-input money'){ return `<input class="${cls}" data-key="${k}" data-type="${r.entity_type}" data-id="${r.entity_id}" value="${esc(r[k]??0)}" onchange="tasneefSalariesV10220.update('${r.entity_type}','${r.entity_id}','${k}',this.value)">`; }
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
      <td><input class="sal-input" data-key="notes" data-type="${r.entity_type}" data-id="${r.entity_id}" value="${esc(r.notes||'')}" onchange="tasneefSalariesV10220.update('${r.entity_type}','${r.entity_id}','notes',this.value)"></td>
    </tr>`).join('') || '<tr><td colspan="20">لا توجد بيانات رواتب</td></tr>';
    const foot=$('salaryFoot'); if(foot) foot.innerHTML=`<tr><td colspan="10"><b>الإجمالي</b></td><td>${money(t.basic_salary)}</td><td>${money(t.allowance)}</td><td>${money(t.gross_salary)}</td><td>${money(t.salary_by_days)}</td><td>${money(t.commission)}</td><td>${money(t.deductions)}</td><td>${money(t.rounding)}</td><td>${money(t.advance_deduction)}</td><td>${money(t.net_salary)}</td><td></td></tr>`;
  }
  function update(type,id,key,value){
    const r=state.rows.find(x=>x.entity_type===type && String(x.entity_id)===String(id)); if(!r) return;
    if(key==='deductions') r._manual_deductions=true;
    if(key==='notes') r._manual_notes=true;
    r[key]=['commission','deductions','rounding','advance_deduction','basic_salary','allowance'].includes(key)?num(value):value;
    if(['basic_salary','allowance'].includes(key) && !r._manual_deductions){
      const dim=daysInMonth($('salaryMonth')?.value||today().slice(0,7));
      r.deductions=(num(r.basic_salary)+num(r.allowance))/dim*num(r.absent_days);
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
  function exportSalaryExcel(){ const html=salaryTableHtml(false); const blob=new Blob(['\ufeff'+html],{type:'application/vnd.ms-excel;charset=utf-8;'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`كشف_الرواتب_${$('salaryMonth')?.value||''}.xls`; a.click(); }
  function inject(){
    if($('salaries')) return;
    const side=document.querySelector('.side'); const ref=[...document.querySelectorAll('.side .nav')].find(b=>String(b.textContent).includes('الأوقات الشهرية'));
    const btn=document.createElement('button'); btn.className='nav'; btn.textContent='الرواتب'; btn.onclick=function(){ showPage('salaries',this); setTimeout(loadSalary,50); };
    if(side) side.insertBefore(btn, ref?ref.nextSibling:side.querySelector('.nav.danger'));
    const main=document.querySelector('main.content'); const sec=document.createElement('section'); sec.id='salaries'; sec.className='page hidden'; sec.innerHTML=`
      <style>.salary-table-wrap{max-height:640px;overflow:auto}.salary-table{min-width:1700px}.salary-table th{position:sticky;top:0;z-index:2}.sal-input{width:110px;border:1px solid var(--line);border-radius:8px;padding:6px;text-align:center}.salary-actions{display:flex;gap:8px;flex-wrap:wrap}.salary-note{background:#eef8f4;border:1px solid var(--line);border-radius:14px;padding:10px;color:var(--brand);font-weight:800}</style>
      <div class="card"><div class="table-head"><h2>الرواتب</h2><span class="badge green">${VERSION}</span></div><div class="salary-note">مكان العمل ثابت FM. تم حذف اسم المشروع وطريقة السداد. العمال 1300 + 200 والمشرفون 2000 + 300. الغياب يخصم تلقائيًا داخل عمود الخصومات ويكتب في الملاحظات: خصم غياب بعدد الأيام، ويمكن تعديل الخصومات يدويًا.</div><div id="salaryMsg" class="msg hidden"></div>
      <div class="filters"><div><label>الشهر</label><input type="month" id="salaryMonth" value="${today().slice(0,7)}" onchange="tasneefSalariesV10220.load()"></div><div><label>نوع الكشف</label><select id="salaryType" onchange="tasneefSalariesV10220.buildRows()"><option value="supervisors">رواتب المشرفين</option><option value="workers">رواتب العمال</option><option value="all">الكل</option></select></div><div><label>المشرف</label><select id="salarySupervisor" onchange="tasneefSalariesV10220.buildRows()"><option value="">كل المشرفين</option></select></div><div><label>المشروع</label><select id="salaryProject" onchange="tasneefSalariesV10220.buildRows()"><option value="">كل المشاريع</option></select></div><div><label>بحث</label><input id="salarySearch" oninput="tasneefSalariesV10220.buildRows()" placeholder="اسم الموظف"></div></div>
      <div class="salary-actions"><button onclick="tasneefSalariesV10220.load()">تحديث الرواتب</button><button class="light" onclick="tasneefSalariesV10220.save(false)">حفظ التعديلات</button><button class="light" onclick="tasneefSalariesV10220.save(true)">اعتماد الرواتب</button><button class="light" onclick="tasneefSalariesV10220.print()">طباعة</button><button class="light" onclick="tasneefSalariesV10220.exportExcel()">تصدير Excel</button></div><div id="salaryKpis" class="kpis small"></div>
      <div class="table-wrap salary-table-wrap"><table class="salary-table"><thead><tr><th>رقم</th><th>الشهر</th><th>اسم الموظف</th><th>مكان العمل</th><th>الوظيفة</th><th>بداية الخدمة</th><th>نهاية الخدمة</th><th>أيام العمل</th><th>أيام الغياب</th><th>الأيام المستحقة</th><th>قيمة الرواتب الأساسية</th><th>البدلات</th><th>الإجمالي</th><th>إجمالي الراتب على أيام الفترة</th><th>العمولات</th><th>الخصومات</th><th>جبر الكسور</th><th>خصم السلف</th><th>الصافي</th><th>ملاحظات</th></tr></thead><tbody id="salaryBody"></tbody><tfoot id="salaryFoot"></tfoot></table></div></div>`;
    if(main) main.appendChild(sec);
  }
  window.tasneefSalariesV10220={inject,load:loadSalary,buildRows,update,save:saveSalary,print:printSalary,exportExcel:exportSalaryExcel};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(inject,500));
  window.addEventListener('load',()=>setTimeout(inject,700));
})();

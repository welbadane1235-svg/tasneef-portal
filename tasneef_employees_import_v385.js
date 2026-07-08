/* V385 - Employees master import/list inside workers section */
(function(){
  'use strict';
  if(window.__tasneefEmployeesImportV385) return;
  window.__tasneefEmployeesImportV385 = true;
  const VERSION='385';
  const S=v=>String(v??'').trim();
  const N=v=>{const n=Number(v||0);return Number.isFinite(n)?n:0};
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>S(v).replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/\s+/g,' ').toLowerCase();
  const $=id=>document.getElementById(id);
  const getSb=()=>window.sb || window.supabaseClient || window.tasneefSupabase || null;
  let previewRows=[];

  function toast(t,kind){
    const el=$('empImportMsgV385');
    if(el){el.textContent=t;el.className='emp-msg-v385 '+(kind||'ok');}
    try{ if(typeof window.msg==='function') window.msg(t,kind==='err'?'err':'ok'); }catch(_){ }
  }
  function statusOf(r){return S(r.status||'نشط')||'نشط'}
  function jobClass(j){const x=norm(j); if(x.includes('مشرف'))return'sup'; if(x.includes('فني'))return'tech'; if(x.includes('حارس'))return'guard'; return'worker';}
  function asWorkerType(j){const c=jobClass(j); return c==='sup'?'supervisor':c==='tech'?'technician':c==='guard'?'guard':'primary';}
  function mapHeaders(row){
    const h={}; (row||[]).forEach((x,i)=>{const n=norm(x); if(!n) return;
      if(n==='رقم'||n.includes('serial')) h.serial_no=i;
      if(n.includes('ايدي')||n.includes('كود')||n.includes('code')||n.includes('id')) h.employee_code=i;
      if(n.includes('الاقامه')&&n.includes('اسم')) h.iqama_name=i;
      if(n.includes('التطبيق')) h.app_name=i;
      if(n.includes('رقم الاقامه')||n.includes('اقامه')) h.iqama_number=i;
      if(n.includes('وظيف')) h.job_title=i;
      if(n.includes('رواتب')||n.includes('اساسي')||n.includes('basic')) h.basic_salary=i;
      if(n.includes('بدلات')||n.includes('بدل')||n.includes('allow')) h.allowance=i;
      if(n.includes('اجمالي')||n.includes('total')) h.total_salary=i;
    });
    return h;
  }
  function rowToEmployee(r,h){
    const emp={
      serial_no: Math.round(N(r[h.serial_no])),
      employee_code: S(r[h.employee_code]),
      iqama_name: S(r[h.iqama_name]),
      app_name: S(r[h.app_name] || r[h.iqama_name]),
      iqama_number: S(r[h.iqama_number]),
      job_title: S(r[h.job_title] || 'عامل'),
      basic_salary: N(r[h.basic_salary]),
      allowance: N(r[h.allowance]),
      total_salary: N(r[h.total_salary]),
      status:'نشط'
    };
    if(!emp.total_salary) emp.total_salary = emp.basic_salary + emp.allowance;
    return emp;
  }
  function summarize(rows){
    const s={total:rows.length,workers:0,sup:0,tech:0,guard:0};
    rows.forEach(r=>{const c=jobClass(r.job_title); if(c==='sup')s.sup++; else if(c==='tech')s.tech++; else if(c==='guard')s.guard++; else s.workers++;});
    return s;
  }
  function renderPreview(rows){
    const box=$('empPreviewV385'); if(!box) return;
    const sum=summarize(rows);
    $('empSummaryV385').innerHTML=`<div><small>الإجمالي</small><b>${sum.total}</b></div><div><small>عمال</small><b>${sum.workers}</b></div><div><small>مشرفين</small><b>${sum.sup}</b></div><div><small>فنيين</small><b>${sum.tech}</b></div><div><small>حراس</small><b>${sum.guard}</b></div>`;
    const sample=rows.slice(0,12).map(r=>`<tr><td>${esc(r.employee_code)}</td><td><b>${esc(r.app_name)}</b><br><small>${esc(r.iqama_name)}</small></td><td>${esc(r.iqama_number)}</td><td><span class="emp-pill-v385 ${jobClass(r.job_title)}">${esc(r.job_title)}</span></td><td>${Math.round(N(r.total_salary)).toLocaleString('en-US')}</td></tr>`).join('');
    box.innerHTML=rows.length?`<div class="table-wrap"><table><thead><tr><th>الكود</th><th>اسم التطبيق / الإقامة</th><th>رقم الإقامة</th><th>الوظيفة</th><th>الإجمالي</th></tr></thead><tbody>${sample}</tbody></table></div><small>تم عرض أول ${Math.min(12,rows.length)} صف فقط قبل الاستيراد.</small>`:'<div class="emp-empty-v385">اختر ملف Excel لعرض المعاينة.</div>';
  }
  async function parseFile(file){
    if(!window.XLSX) throw new Error('مكتبة قراءة Excel لم تحمل بعد. تأكد من الاتصال بالإنترنت ثم أعد تحميل الصفحة.');
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf,{type:'array'});
    const sheet=wb.Sheets[wb.SheetNames[0]];
    const raw=XLSX.utils.sheet_to_json(sheet,{header:1,defval:''});
    const headerIdx=raw.findIndex(r=>r.some(c=>norm(c).includes('الموظف')||norm(c).includes('التطبيق')||norm(c).includes('الاقامه')));
    if(headerIdx<0) throw new Error('لم أتعرف على صف العناوين داخل الملف.');
    const h=mapHeaders(raw[headerIdx]);
    const needed=['employee_code','iqama_name','app_name','iqama_number','job_title'];
    const missing=needed.filter(k=>h[k]===undefined);
    if(missing.length) throw new Error('أعمدة ناقصة أو غير واضحة: '+missing.join(', '));
    return raw.slice(headerIdx+1).map(r=>rowToEmployee(r,h)).filter(e=>e.app_name && (e.employee_code||e.iqama_number));
  }
  async function handleFile(){
    try{
      const f=$('empFileV385')?.files?.[0]; if(!f) return toast('اختر ملف Excel أولًا','err');
      previewRows=await parseFile(f);
      renderPreview(previewRows);
      toast('تمت قراءة الملف بنجاح. راجع المعاينة ثم اضغط استيراد.');
    }catch(e){toast(e.message||String(e),'err')}
  }
  async function importEmployees(){
    try{
      if(!previewRows.length) return toast('لا توجد بيانات جاهزة للاستيراد. اختر الملف أولًا.','err');
      const sb=getSb(); if(!sb) return toast('الاتصال بقاعدة البيانات غير جاهز. أعد تحميل الصفحة.','err');
      const btn=$('empImportBtnV385'); if(btn){btn.disabled=true;btn.textContent='جاري الاستيراد...';}
      const rows=previewRows.map(r=>({...r,updated_at:new Date().toISOString()}));
      const res=await sb.from('employees_master_v385').upsert(rows,{onConflict:'employee_code'}).select('*');
      if(res.error) throw res.error;
      toast('تم استيراد '+rows.length+' موظف في قاعدة الموظفين بنجاح.');
      await loadEmployees();
    }catch(e){
      const m=String(e.message||e);
      if(m.includes('employees_master_v385')) toast('جدول الموظفين غير موجود. شغّل ملف SQL المرفق supabase_employees_master_seed_v385.sql مرة واحدة في Supabase.','err');
      else toast(m,'err');
    }finally{const btn=$('empImportBtnV385'); if(btn){btn.disabled=false;btn.textContent='استيراد إلى قاعدة الموظفين';}}
  }
  async function loadEmployees(){
    const body=$('empBodyV385'); if(!body) return;
    const sb=getSb(); if(!sb){body.innerHTML='<tr><td colspan="8">قاعدة البيانات غير جاهزة.</td></tr>'; return;}
    const q=S($('empSearchV385')?.value); const job=S($('empJobFilterV385')?.value);
    let req=sb.from('employees_master_v385').select('*').order('serial_no',{ascending:true}).limit(2000);
    const res=await req;
    if(res.error){body.innerHTML='<tr><td colspan="8">شغّل ملف SQL الخاص بالموظفين أولًا.</td></tr>'; return;}
    let rows=res.data||[];
    if(job) rows=rows.filter(r=>S(r.job_title)===job);
    if(q){const nq=norm(q); rows=rows.filter(r=>norm([r.employee_code,r.app_name,r.iqama_name,r.iqama_number,r.job_title].join(' ')).includes(nq));}
    const sum=summarize(rows);
    const s=$('empDbSummaryV385'); if(s) s.innerHTML=`<div><small>المعروض</small><b>${sum.total}</b></div><div><small>عمال</small><b>${sum.workers}</b></div><div><small>مشرفين</small><b>${sum.sup}</b></div><div><small>فنيين</small><b>${sum.tech}</b></div><div><small>حراس</small><b>${sum.guard}</b></div>`;
    body.innerHTML=rows.map(r=>`<tr><td>${esc(r.employee_code)}</td><td><b>${esc(r.app_name)}</b><br><small>${esc(r.iqama_name)}</small></td><td>${esc(r.iqama_number)}</td><td><span class="emp-pill-v385 ${jobClass(r.job_title)}">${esc(r.job_title)}</span></td><td>${Math.round(N(r.basic_salary)).toLocaleString('en-US')}</td><td>${Math.round(N(r.allowance)).toLocaleString('en-US')}</td><td>${Math.round(N(r.total_salary)).toLocaleString('en-US')}</td><td>${esc(statusOf(r))}</td></tr>`).join('') || '<tr><td colspan="8">لا توجد بيانات.</td></tr>';
  }
  async function syncToWorkers(){
    try{
      const sb=getSb(); if(!sb) return toast('قاعدة البيانات غير جاهزة.','err');
      const res=await sb.from('employees_master_v385').select('*').limit(2000);
      if(res.error) throw res.error;
      const employees=res.data||[];
      if(!employees.length) return toast('لا توجد بيانات موظفين للمزامنة.','err');
      const current=await sb.from('workers').select('id,name').limit(5000);
      const existing=new Set((current.data||[]).map(w=>norm(w.name)));
      const rows=employees.filter(e=>!existing.has(norm(e.app_name))).map(e=>({
        name:e.app_name,
        phone:'',
        salary:N(e.total_salary),
        type:asWorkerType(e.job_title),
        status:'active',
        notes:`${e.job_title||''} | كود: ${e.employee_code||''} | الإقامة: ${e.iqama_number||''} | اسم الإقامة: ${e.iqama_name||''}`
      }));
      if(!rows.length) return toast('كل الأسماء موجودة مسبقًا في جدول العمال الحالي.');
      const ins=await sb.from('workers').insert(rows).select('*');
      if(ins.error) throw ins.error;
      toast('تمت إضافة '+rows.length+' اسمًا إلى جدول العمال الحالي بدون تكرار.');
      try{ if(typeof window.loadAll==='function') await window.loadAll(); if(typeof window.renderWorkers==='function') window.renderWorkers(); }catch(_){ }
    }catch(e){toast(e.message||String(e),'err')}
  }
  function install(){
    const sec=$('workers'); if(!sec || $('employeesImportCardV385')) return;
    const style=document.createElement('style'); style.id='empImportCssV385'; style.textContent=`
      .emp-import-v385{border:1px solid #d7e8df;background:linear-gradient(180deg,#fff,#f7fcfa);border-radius:22px;padding:16px;margin-bottom:16px;box-shadow:0 8px 24px rgba(10,64,51,.05)}
      .emp-import-v385 h2{margin:0 0 8px;color:var(--brand,#0A4033)}.emp-import-v385 p{color:#60706a;line-height:1.8;margin:0 0 12px}.emp-grid-v385{display:grid;grid-template-columns:2fr auto auto auto;gap:10px;align-items:end}.emp-summary-v385{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:12px 0}.emp-summary-v385 div{border:1px solid #dcebe6;background:#fff;border-radius:16px;padding:12px;text-align:center}.emp-summary-v385 small{display:block;color:#60706a}.emp-summary-v385 b{font-size:24px;color:#0A4033}.emp-msg-v385{margin:10px 0;border-radius:14px;padding:10px;background:#eef7f3;color:#0A4033;border:1px solid #cfe4dc;font-weight:800}.emp-msg-v385.err{background:#ffe8e8;color:#9d2020;border-color:#efc3c3}.emp-pill-v385{display:inline-block;border-radius:999px;padding:5px 9px;font-weight:800;background:#eef6f3;color:#0A4033}.emp-pill-v385.sup{background:#e8f0ff;color:#174ea6}.emp-pill-v385.tech{background:#fff4df;color:#9a5a00}.emp-pill-v385.guard{background:#f3e8ff;color:#6b21a8}.emp-empty-v385{border:1px dashed #b9d4cb;background:#fff;border-radius:16px;padding:20px;text-align:center;color:#60706a}.emp-db-tools-v385{display:grid;grid-template-columns:2fr 1fr auto;gap:10px;align-items:end;margin:10px 0}@media(max-width:760px){.emp-grid-v385,.emp-db-tools-v385,.emp-summary-v385{grid-template-columns:1fr}}
    `; document.head.appendChild(style);
    const card=document.createElement('section'); card.className='emp-import-v385'; card.id='employeesImportCardV385'; card.innerHTML=`
      <h2>قاعدة الموظفين من Excel</h2>
      <p>استورد ملف الموظفين كما هو. سيتم اعتماد <b>اسم الموظف في التطبيق</b> كاسم العرض داخل النظام، مع حفظ اسم الإقامة والوظيفة والراتب. الربط بالمشاريع يتم لاحقًا من شاشة توزيع العمال حتى تبقى بيانات كل شهر محفوظة داخل شهرها.</p>
      <div class="emp-grid-v385"><div><label>ملف الموظفين Excel</label><input type="file" id="empFileV385" accept=".xlsx,.xls"></div><button type="button" class="light" id="empReadBtnV385">قراءة ومعاينة</button><button type="button" id="empImportBtnV385">استيراد إلى قاعدة الموظفين</button><button type="button" class="light" id="empSyncBtnV385">إضافة الأسماء لجدول العمال</button></div>
      <div id="empImportMsgV385" class="emp-msg-v385">جاهز لاستيراد بيانات الموظفين.</div>
      <div id="empSummaryV385" class="emp-summary-v385"></div><div id="empPreviewV385"></div>
      <hr style="border:0;border-top:1px solid #dcebe6;margin:16px 0">
      <h2>الموظفون المحفوظون</h2>
      <div class="emp-db-tools-v385"><input id="empSearchV385" placeholder="بحث بالكود، اسم التطبيق، رقم الإقامة، الوظيفة"><select id="empJobFilterV385"><option value="">كل الوظائف</option><option>مشرف</option><option>عامل</option><option>فني</option><option>حارس</option></select><button type="button" class="light" id="empLoadBtnV385">تحديث القائمة</button></div>
      <div id="empDbSummaryV385" class="emp-summary-v385"></div>
      <div class="table-wrap"><table><thead><tr><th>الكود</th><th>اسم التطبيق / الإقامة</th><th>رقم الإقامة</th><th>الوظيفة</th><th>الأساسي</th><th>البدلات</th><th>الإجمالي</th><th>الحالة</th></tr></thead><tbody id="empBodyV385"><tr><td colspan="8">اضغط تحديث القائمة.</td></tr></tbody></table></div>
    `;
    const firstCard=sec.querySelector('.card');
    if(firstCard) sec.insertBefore(card, firstCard); else sec.prepend(card);
    $('empReadBtnV385')?.addEventListener('click',handleFile);
    $('empImportBtnV385')?.addEventListener('click',importEmployees);
    $('empLoadBtnV385')?.addEventListener('click',loadEmployees);
    $('empSyncBtnV385')?.addEventListener('click',syncToWorkers);
    $('empSearchV385')?.addEventListener('input',loadEmployees);
    $('empJobFilterV385')?.addEventListener('change',loadEmployees);
    renderPreview([]);
    setTimeout(loadEmployees,600);
  }
  const oldShow=window.showPage;
  window.showPage=function(id,btn){const r=oldShow?oldShow.apply(this,arguments):undefined; if(id==='workers') setTimeout(install,100); return r;};
  function boot(){install();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.tasneefEmployeesImportV385={install,loadEmployees,importEmployees,syncToWorkers};
  console.log('Tasneef employees import V385 loaded');
})();

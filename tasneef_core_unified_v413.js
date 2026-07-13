/* Tasneef Core Unified V413
   بداية إعادة بناء الأقسام الأساسية بدون حذف بيانات.
   القاعدة: العمال من جدول العمال/الموظفين، المشاريع من projects، التوزيع من monthly_distribution. */
(function(){
  'use strict';
  if(window.__tasneefCoreUnifiedV413) return;
  window.__tasneefCoreUnifiedV413 = true;

  const VERSION='454';
  const S=v=>String(v??'').trim();
  const N=v=>{const n=Number(v||0);return Number.isFinite(n)?n:0};
  const $=id=>document.getElementById(id);
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>S(v).replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/\s+/g,' ').toLowerCase();
  const sb=()=>window.sb || window.supabaseClient || null;
  const todayMonth=()=>new Date().toISOString().slice(0,7);
  const prevMonth=m=>{const d=new Date((m||todayMonth())+'-01T00:00:00'); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7);};
  const monthEnd=m=>{const d=new Date((m||todayMonth())+'-01T00:00:00'); d.setMonth(d.getMonth()+1); d.setDate(0); return d.toISOString().slice(0,10);};

  const state={workers:[],projects:[],dist:{},borrow:{},att:{},loaded:false,tab:'distribution',selected:new Map(),selectedProjects:new Set(),borrowSelected:new Set()};

  function client(){const c=sb(); if(!c) showMsg('لا يوجد اتصال Supabase في الصفحة.', true); return c;}
  async function safe(label, p){try{const r=await p; if(r?.error){console.warn(label,r.error); return {data:[],error:r.error};} return r;}catch(e){console.warn(label,e); return {data:[],error:e};}}

  function workerCode(w){return S(w.worker_code||w.employee_code||w.code||w.emp_code||w.id||'');}
  function workerName(w){return S(w.worker_name||w.app_name||w.name||w.full_name||w.iqama_name||workerCode(w));}
  function workerRole(w){return S(w.job_title||w.role_type||w.position||w.job||w.profession||'عامل');}
  function workerDisplay(w){const c=workerCode(w), n=workerName(w); return c && !n.includes(c) ? `${c} - ${n}` : n;}
  function workerStartDate(w){return S(w.work_start_date||w.hire_date||w.employment_start_date||w.start_work_date||w.start_date||'');}
  function workerEndDate(w){return S(w.work_end_date||w.employment_end_date||w.termination_date||w.end_work_date||w.end_date||'');}
  function workerBasicSalary(w){return N(w.basic_salary||w.base_salary||w.salary||w.main_salary||0);}
  function workerAllowances(w){return N(w.allowances||w.allowance||w.salary_allowance||w.total_allowances||w.benefits||w.extra_allowance||0);}
  function workerTotalSalary(w){const t=N(w.total_salary||w.salary_total||w.total||w.gross_salary||0); return t || (workerBasicSalary(w)+workerAllowances(w));}
  function isSupervisor(w){return /مشرف|supervisor/i.test(workerRole(w));}
  function isWorker(w){return !/مشرف|supervisor/i.test(workerRole(w));}
  function projectId(p){return S(p.project_id||p.id||'');}
  function projectName(p){return S(p.project_name||p.name||p.title||projectId(p));}
  function projectTypeRaw(p){return S(p.operation_type||p.project_type||p.work_type||p.type||p.service_type||'daily_visit');}
  function projectType(p){const t=norm(projectTypeRaw(p)); return (t.includes('دوام')||t.includes('كامل')||t.includes('دائم')||t.includes('full')||t.includes('permanent')||t==='full_time')?'دوام كامل':'زيارة يومية';}
  function projectRequired(p){return N(p.required_daily_minutes||p.daily_required_minutes||p.required_minutes||p.monthly_required_minutes||p.required_time_minutes||p.expected_minutes||0);}
  function projectBuildings(p){return N(p.buildings_count||p.building_count||p.buildings||p.towers_count||p.towers||p.blocks_count||0);}
  function projectUnits(p){return N(p.units_count||p.apartments_count||p.flats_count||p.units||p.apartments||p.apartment_count||0);}
  function projectStartDate(p){return S(p.project_start_date||p.contract_start_date||p.contract_start||p.start_date||p.service_start_date||'');}
  function projectEndDate(p){return S(p.project_end_date||p.contract_end_date||p.contract_end||p.end_date||p.service_end_date||'');}
  function projectSupervisorCode(p){return S(p.supervisor_employee_code||p.current_supervisor_code||p.supervisor_code||p.supervisor_id||p.current_supervisor_id||'');}
  function projectSupervisorName(p){const code=projectSupervisorCode(p); const w=state.workers.find(x=>workerCode(x)===code||S(x.id)===code); return w?workerDisplay(w):S(p.supervisor_name||p.current_supervisor_name||code||'-');}
  function statusActive(x){const st=norm(x?.status||x?.state||x?.active_status||'active'); return !(x?.deleted_at||x?.is_deleted===true||x?.active===false||x?.is_active===false||['deleted','archived','inactive','stopped','ended','disabled','محذوف','موقوف','متوقف','منتهي','غير نشط','غيرنشط'].includes(st));}
  function byWorkerCode(code){const c=S(code); return (state.workers||[]).find(w=>workerCode(w)===c)||null;}
  function projectIsActiveId(pid){const p=(state.projects||[]).find(x=>projectId(x)===S(pid)); return !!p && statusActive(p);}
  function workerIsActiveCode(code){const w=byWorkerCode(code); return !!w && statusActive(w);}
  function supervisorIsActiveCode(code){if(!S(code)) return true; const w=byWorkerCode(code); return !!w && statusActive(w) && isSupervisor(w);}
  function normalizeWorkerCode(v){const m=S(v).match(/TS[-_\s]?(\d+)/i); return m?'TS-'+String(Number(m[1])).padStart(2,'0'):S(v);}
  function nextWorkerCode(){const arr=(state.allWorkers&&state.allWorkers.length?state.allWorkers:state.workers)||[]; let max=0; arr.forEach(w=>{const m=normalizeWorkerCode(workerCode(w)).match(/TS-(\d+)/); if(m) max=Math.max(max,Number(m[1]));}); return 'TS-'+String(max+1).padStart(2,'0');}
  async function generateWorkerCode(){const c=client(); if(c){try{const r=await c.rpc('tasneef_next_employee_code',{p_prefix:'TS'}); if(!r.error && r.data) return S(r.data);}catch(_){}} return nextWorkerCode();}
  async function fillNextWorkerCode(){const el=$('cu413WCode'); if(el && !S(el.value)){el.value=await generateWorkerCode();}}

  function installNav(){
    const side=document.querySelector('.side'); if(!side) return;
    if(document.querySelector('[data-page="coreUnified"]')) return;
    const btn=document.createElement('button');
    btn.className='nav'; btn.type='button'; btn.dataset.page='coreUnified'; btn.textContent='النظام الموحد';
    btn.onclick=function(){ if(window.showPage){ showPage('coreUnified', this); } else { showCorePage(this); } setTimeout(init,40); return false; };
    const after=[...side.querySelectorAll('button.nav')].find(b=>/المشاريع/.test(b.textContent||''));
    if(after) after.insertAdjacentElement('afterend', btn); else side.appendChild(btn);
  }

  function showCorePage(btn){
    document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));
    $('coreUnified')?.classList.remove('hidden');
    document.querySelectorAll('.nav').forEach(n=>n.classList.remove('active'));
    btn?.classList.add('active');
  }

  function installSection(){
    if($('coreUnified')) return;
    const main=document.querySelector('main.content') || document.querySelector('main') || document.body;
    const sec=document.createElement('section'); sec.id='coreUnified'; sec.className='page hidden';
    sec.innerHTML=`
      <div class="cu413-root">
        <div class="cu413-hero">
          <div><h2>النظام الموحد V${VERSION}</h2><p>بداية إعادة بناء العمال والمشاريع والتوزيع من الصفر بدون حذف البيانات القديمة. العمال من قسم العمال، نوع المشروع من قسم المشاريع، والربط من التوزيع.</p></div>
          <span>V${VERSION}</span>
        </div>
        <div id="cu413Msg" class="cu413-msg">جاهز</div>
        <div class="cu413-tabs">
          <button data-tab="workers" type="button">العمال والموظفين</button>
          <button data-tab="projects" type="button">المشاريع</button>
          <button data-tab="distribution" type="button" class="active">التوزيع</button>
          <button data-tab="attendance" type="button">الحضور والغياب</button>
          <button data-tab="borrowing" type="button">الاستعارة</button>
          <button data-tab="salaries" type="button">الرواتب</button>
        </div>
        <div class="cu413-actions"><button id="cu413Reload" type="button">تحديث من السيرفر</button><button class="light" id="cu413Print" type="button">طباعة التوزيع</button></div>
        <div id="cu413WorkersTab" class="cu413-tab hidden"></div>
        <div id="cu413ProjectsTab" class="cu413-tab hidden"></div>
        <div id="cu413DistributionTab" class="cu413-tab"></div>
        <div id="cu413AttendanceTab" class="cu413-tab hidden"></div>
        <div id="cu413BorrowingTab" class="cu413-tab hidden"></div>
      </div>`;
    main.appendChild(sec);
    document.querySelectorAll('#coreUnified [data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
    $('cu413Reload')?.addEventListener('click',()=>reload(true));
    $('cu413Print')?.addEventListener('click',printDistribution);
  }

  function installCss(){
    if($('cu413Css')) return;
    const st=document.createElement('style'); st.id='cu413Css';
    st.textContent=`
      .cu413-root{display:flex;flex-direction:column;gap:14px}.cu413-hero{background:linear-gradient(135deg,#084f40,#126a58);color:#fff;border-radius:24px;padding:22px;display:flex;justify-content:space-between;align-items:center}.cu413-hero h2{margin:0 0 6px}.cu413-hero p{margin:0;color:#e9f6f2;line-height:1.8}.cu413-hero span{background:white;color:#084f40;border-radius:999px;padding:8px 14px;font-weight:900}.cu413-msg{padding:10px 12px;border-radius:14px;background:#eef8f5;border:1px solid #cfe2dc;color:#0A4033;font-weight:800}.cu413-msg.err{background:#fde8e8;color:#9d2222;border-color:#efc3c3}.cu413-tabs,.cu413-actions{display:flex;gap:8px;flex-wrap:wrap}.cu413-tabs button,.cu413-actions button{border:0;border-radius:12px;padding:10px 14px;background:#eef8f5;color:#0A4033;font-weight:900;cursor:pointer}.cu413-tabs button.active,.cu413-actions button:not(.light){background:#0A4033;color:#fff}.cu413-grid{display:grid;grid-template-columns:390px 1fr;gap:14px}.cu413-card{background:#fff;border:1px solid #dce6e2;border-radius:20px;padding:16px}.cu413-card h3{margin:0 0 12px;color:#0A4033}.cu413-form{display:grid;gap:9px}.cu413-form label{font-size:12px;color:#0A4033;font-weight:900}.cu413-form input,.cu413-form select,.cu413-form textarea{width:100%;border:1px solid #dce6e2;border-radius:12px;padding:10px}.cu413-list{max-height:60vh;overflow:auto;border:1px solid #edf1ef;border-radius:14px;background:#fbfdfc;padding:8px}.cu413-row{display:flex;justify-content:space-between;gap:10px;background:#fff;border:1px solid #edf1ef;border-radius:12px;padding:9px;margin-bottom:7px;align-items:center}.cu413-row b{color:#0A4033}.cu413-row small{display:block;color:#60706a;margin-top:3px}.cu413-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}.cu413-kpi{background:#fff;border:1px solid #dce6e2;border-radius:14px;padding:10px;text-align:center}.cu413-kpi b{display:block;font-size:22px;color:#0A4033}.cu413-worker-pick{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;max-height:300px;overflow:auto;border:1px solid #dce6e2;border-radius:14px;padding:8px;background:#fbfdfc}.cu413-project-pick{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;max-height:260px;overflow:auto;border:1px solid #dce6e2;border-radius:14px;padding:8px;background:#fbfdfc}.cu413-worker{background:#fff;border:1px solid #dce6e2;color:#10231d;border-radius:12px;padding:9px;text-align:right}.cu413-worker.on{background:#0A4033;color:#fff}.cu413-chip{display:inline-flex;gap:5px;align-items:center;background:#eef8f5;border:1px solid #cfe2dc;color:#0A4033;border-radius:999px;padding:6px 9px;margin:3px;font-weight:800}.cu413-chip button{background:#b83232;color:white;border:0;border-radius:50%;width:18px;height:18px;padding:0}.cu413-dist-card{background:#fff;border:1px solid #dce6e2;border-radius:16px;padding:12px;margin-bottom:10px}.cu413-dist-card h4{margin:0;color:#0A4033}.cu413-dist-head{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #edf1ef;padding-bottom:8px;margin-bottom:8px}.cu413-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:900px){.cu413-grid,.cu413-two,.cu413-kpis{grid-template-columns:1fr}.cu413-worker-pick{grid-template-columns:1fr}}@media print{body *{visibility:hidden!important}#coreUnified,#coreUnified *{visibility:visible!important}#coreUnified{position:absolute;inset:0}.cu413-tabs,.cu413-actions,.cu413-form{display:none!important}.side{display:none!important}@page{size:A4 landscape;margin:10mm}}`;
    document.head.appendChild(st);
  }

  function showMsg(t,err){const el=$('cu413Msg'); if(el){el.textContent=t; el.className='cu413-msg '+(err?'err':'');}}
  function setTab(tab){state.tab=tab; document.querySelectorAll('#coreUnified [data-tab]').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab)); ['workers','projects','distribution','attendance','borrowing','salaries'].forEach(t=>$('cu413'+cap(t)+'Tab')?.classList.toggle('hidden', t!==tab)); render();}
  function cap(s){return s.charAt(0).toUpperCase()+s.slice(1);}

  async function loadWorkers(force){
    if(state.workers.length&&!force) return state.workers;
    const c=client(); if(!c) return [];
    const r1=await safe('employees_master_v386', c.from('employees_master_v386').select('*').limit(10000));
    const r2=await safe('workers', c.from('workers').select('*').limit(10000));
    const map=new Map(), nameIndex=new Map();
    function mergeWorker(a,b){
      const out=Object.assign({},a||{});
      Object.keys(b||{}).forEach(k=>{const v=b[k]; if(v!==undefined&&v!==null&&S(v)!=='') out[k]=v;});
      const code=normalizeWorkerCode(workerCode(out));
      if(code) out.employee_code=code;
      return out;
    }
    function put(w,prio){
      const code=normalizeWorkerCode(workerCode(w));
      const n=norm(workerName(w));
      if(!code && !n) return;
      let key=code || nameIndex.get(n) || ('name:'+n);
      if(code && nameIndex.has(n) && nameIndex.get(n)!==code){
        const oldKey=nameIndex.get(n), old=map.get(oldKey);
        if(old){ map.delete(oldKey); key=code; w=mergeWorker(old,w); }
      }
      const old=map.get(key);
      const merged = (!old || prio>=(old.__prio||0)) ? mergeWorker(old,w) : mergeWorker(w,old);
      merged.__prio=Math.max(prio, old?.__prio||0);
      if(code) merged.employee_code=code;
      map.set(key,merged);
      if(n) nameIndex.set(n,key);
      if(code) nameIndex.set(n,code);
    }
    (r2.data||[]).forEach(w=>put(w,1));
    (r1.data||[]).forEach(w=>put(w,2));
    // منع أي تكرار متبقٍ: الأولوية للكود، ثم الاسم، مع تجاهل الموقوف في القوائم التشغيلية.
    const final=new Map();
    [...map.values()].forEach(w=>{
      const code=normalizeWorkerCode(workerCode(w));
      const n=norm(workerName(w));
      const key=code || ('name:'+n);
      const old=final.get(key);
      final.set(key, old?mergeWorker(old,w):w);
    });
    state.allWorkers=[...final.values()].sort((a,b)=>workerDisplay(a).localeCompare(workerDisplay(b),'ar'));
    state.workers=state.allWorkers.filter(statusActive).sort((a,b)=>workerDisplay(a).localeCompare(workerDisplay(b),'ar'));
    return state.workers;
  }
  async function loadProjects(force){
    if(state.projects.length&&!force) return state.projects;
    const c=client(); if(!c) return [];
    const r=await safe('projects', c.from('projects').select('*').limit(5000));
    state.projects=(r.data||[]).filter(statusActive).sort((a,b)=>projectName(a).localeCompare(projectName(b),'ar'));
    return state.projects;
  }
  async function loadDistribution(force){
    const m=$('cu413Month')?.value||todayMonth();
    if(state.dist[m]&&!force) return state.dist[m];
    const c=client(); if(!c) return [];
    let r=await safe('monthly_distribution', c.from('monthly_distribution').select('*').eq('month_key',m).limit(30000));
    state.dist[m]=(r.data||[]).filter(statusActive);
    return state.dist[m];
  }
  async function loadBorrowings(month, force){
    const m=month||$('cu413Month')?.value||todayMonth();
    if(state.borrow[m]&&!force) return state.borrow[m];
    const c=client(); if(!c) return [];
    const start=m+'-01T00:00:00';
    const end=monthEnd(m)+'T23:59:59';
    let r=await safe('worker_borrowings', c.from('worker_borrowings').select('*').lte('start_at',end).gte('end_at',start).limit(10000));
    state.borrow[m]=(r.data||[]).filter(statusActive);
    return state.borrow[m];
  }
  function activeBorrowings(month, when){
    const m=month||todayMonth();
    const t=new Date(when||new Date()).getTime();
    return (state.borrow[m]||[]).filter(b=>{
      const st=norm(b.status||'active');
      if(['cancelled','canceled','ended','inactive','ملغي','منتهي','موقوف'].includes(st)) return false;
      const a=new Date(b.start_at||b.start_time||b.from_time||0).getTime();
      const z=new Date(b.end_at||b.end_time||b.to_time||0).getTime();
      return Number.isFinite(a)&&Number.isFinite(z)&&a<=t&&t<=z;
    });
  }
  function effectiveDistributionRows(month, when){
    const m=month||$('cu413Month')?.value||todayMonth();
    const base=(state.dist[m]||[]).filter(statusActive).filter(r=>workerIsActiveCode(S(r.worker_employee_code||r.worker_code||r.employee_code)) && projectIsActiveId(S(r.project_id)) && supervisorIsActiveCode(S(r.supervisor_employee_code||r.supervisor_code||r.supervisor_id)));
    const active=activeBorrowings(m, when);
    if(!active.length) return base;
    const borrowedCodes=new Set(active.map(b=>S(b.worker_employee_code||b.worker_code)).filter(Boolean));
    const out=base.filter(r=>!borrowedCodes.has(S(r.worker_employee_code||r.worker_code||r.employee_code)));
    active.forEach(b=>{
      const code=S(b.worker_employee_code||b.worker_code);
      const source=base.find(r=>S(r.worker_employee_code||r.worker_code||r.employee_code)===code)||{};
      const p=state.projects.find(x=>projectId(x)===S(b.project_id||b.borrow_project_id||source.project_id))||{};
      out.push(Object.assign({}, source, {
        id:'borrow_'+S(b.id||code),
        is_borrowed:true,
        borrowing_id:S(b.id||''),
        borrowed_from_supervisor_employee_code:S(b.original_supervisor_employee_code||source.supervisor_employee_code||''),
        borrowed_from_supervisor_name:S(b.original_supervisor_name||source.supervisor_name||''),
        supervisor_employee_code:S(b.borrowing_supervisor_employee_code||b.to_supervisor_employee_code||''),
        supervisor_name:S(b.borrowing_supervisor_name||b.to_supervisor_name||''),
        project_id:S(b.project_id||b.borrow_project_id||source.project_id||''),
        project_name:S(b.project_name||projectName(p)||source.project_name||''),
        worker_employee_code:code,
        worker_name:S(b.worker_name||source.worker_name||''),
        worker_display_name:S(b.worker_display_name||source.worker_display_name||((code?code+' - ':'')+S(b.worker_name||source.worker_name||''))),
        start_date:S(source.start_date||m+'-01'),
        end_date:S(source.end_date||null),
        status:'active'
      }));
    });
    return out;
  }
  async function reload(force){
    showMsg('جاري تحميل البيانات من السيرفر...');
    await Promise.all([loadWorkers(force), loadProjects(force)]);
    await loadDistribution(force);
    await loadBorrowings(($('cu413Month')?.value||todayMonth()),force);
    fillSelects(); render(); showMsg('تم تحميل البيانات من السيرفر بدون كاش.');
  }

  function render(){
    renderWorkersTab(); renderProjectsTab(); renderDistributionTab(); renderAttendanceTab(); renderBorrowingTab();
  }
  function renderWorkersTab(){
    const box=$('cu413WorkersTab'); if(!box) return;
    const q=norm($('cu413WorkerSearch')?.value||'');
    const rows=state.workers.filter(w=>!q||norm(workerDisplay(w)+' '+workerRole(w)).includes(q));
    box.innerHTML=`<div class="cu413-grid"><div class="cu413-card"><h3>إضافة / تعديل عامل أو موظف</h3><div class="cu413-form"><input type="hidden" id="cu413WEditMode"><label>كود العامل</label><div class="cu413-two"><input id="cu413WCode" placeholder="يتولد تلقائيًا مثل TS-71"><button type="button" class="light" onclick="tasneefCoreUnifiedV413.fillNextWorkerCode()">توليد الكود</button></div><label>اسم العامل في التطبيق</label><input id="cu413WName" placeholder="اسم العامل"><label>الوظيفة</label><select id="cu413WRole"><option>عامل</option><option>مشرف</option><option>فني</option><option>حارس</option></select><label>رقم الإقامة</label><input id="cu413WIqama"><label>الحالة</label><select id="cu413WStatus"><option value="active">نشط</option><option value="inactive">موقوف</option></select><div class="cu413-two"><div><label>تاريخ بداية العمل</label><input id="cu413WStartDate" type="date"></div><div><label>تاريخ نهاية العمل</label><input id="cu413WEndDate" type="date"></div></div><div class="cu413-two"><div><label>الراتب الأساسي</label><input id="cu413WSalary" type="number" oninput="tasneefCoreUnifiedV413.calcWorkerTotal()"></div><div><label>البدلات</label><input id="cu413WAllowance" type="number" oninput="tasneefCoreUnifiedV413.calcWorkerTotal()"></div></div><label>الإجمالي</label><input id="cu413WTotal" type="number" readonly><div class="cu413-two"><button type="button" onclick="tasneefCoreUnifiedV413.saveWorker()">حفظ العامل</button><button type="button" class="light" onclick="tasneefCoreUnifiedV413.clearWorkerForm()">تفريغ</button></div></div></div><div class="cu413-card"><h3>قائمة العمال والموظفين</h3><input id="cu413WorkerSearch" placeholder="بحث" value="${esc($('cu413WorkerSearch')?.value||'')}"><div class="cu413-kpis"><div class="cu413-kpi"><small>الإجمالي</small><b>${state.workers.length}</b></div><div class="cu413-kpi"><small>مشرفين</small><b>${state.workers.filter(isSupervisor).length}</b></div><div class="cu413-kpi"><small>عمال</small><b>${state.workers.filter(isWorker).length}</b></div><div class="cu413-kpi"><small>المعروض</small><b>${rows.length}</b></div></div><div class="cu413-list">${rows.map(w=>`<div class="cu413-row"><div><b>${esc(workerDisplay(w))}</b><small>${esc(workerRole(w))}</small><small>بداية العمل: ${esc(workerStartDate(w)||'-')} | نهاية العمل: ${esc(workerEndDate(w)||'-')}</small><small>الراتب الأساسي: ${workerBasicSalary(w).toLocaleString('en-US')} | البدلات: ${workerAllowances(w).toLocaleString('en-US')} | الإجمالي: ${workerTotalSalary(w).toLocaleString('en-US')}</small></div><div style="display:flex;gap:6px;align-items:center"><small>${esc(S(w.iqama_number||w.national_id||''))}</small><button type="button" class="light" onclick="tasneefCoreUnifiedV413.editWorker('${esc(workerCode(w))}')">تعديل</button></div></div>`).join('')||'<div class="cu413-row">لا توجد بيانات</div>'}</div></div></div>`;
    $('cu413WorkerSearch')?.addEventListener('input', renderWorkersTab); fillNextWorkerCode();
  }
  function calcWorkerTotal(){const t=N($('cu413WSalary')?.value)+N($('cu413WAllowance')?.value); if($('cu413WTotal')) $('cu413WTotal').value=t||'';}
  function projectViewMonth(){
    return $('cu413ProjectsMonth')?.value || $('cu413Month')?.value || todayMonth();
  }
  function distProjectId(r){return S(r.project_id||r.projectId||r.project_key||'');}
  function distSupervisorName(r){return S(r.supervisor_display_name||r.supervisor_name||r.supervisor_employee_code||'-');}
  function distWorkerDisplay(r){
    const c=S(r.worker_employee_code||r.worker_code||r.employee_code||'');
    const n=S(r.worker_display_name||r.worker_name||r.app_name||r.name||c);
    if(c && n && !n.includes(c)) return c+' - '+n;
    return n||c||'-';
  }
  function projectDistributionRows(pid, m){
    const id=S(pid), rows=effectiveDistributionRows(m);
    return rows.filter(r=>S(distProjectId(r))===id || norm(S(r.project_name||r.project_display_name))===norm(projectName(state.projects.find(p=>projectId(p)===id)||{})));
  }
  function projectDistributionSummary(p){
    const m=projectViewMonth();
    const rows=projectDistributionRows(projectId(p), m);
    const sup=[...new Set(rows.map(distSupervisorName).filter(Boolean))];
    const workers=[...new Set(rows.map(distWorkerDisplay).filter(Boolean))];
    return {month:m, rows, sup, workers};
  }
  async function refreshProjectsMonthDistribution(){
    const m=projectViewMonth();
    if($('cu413Month')) $('cu413Month').value=m;
    await loadDistribution(true);
    await loadBorrowings(m,true);
    renderProjectsTab();
  }
  function openProjectDistribution(pid){
    setTab('distribution');
    setTimeout(async()=>{
      const m=projectViewMonth();
      if($('cu413Month')) $('cu413Month').value=m;
      await loadDistribution(true);
      state.selectedProjects.clear();
      state.selectedProjects.add(S(pid));
      const rows=projectDistributionRows(pid,m);
      const first=rows[0]||{};
      if($('cu413Sup')) $('cu413Sup').value=S(first.supervisor_employee_code||'');
      state.selected.clear();
      rows.forEach(r=>{
        const c=S(r.worker_employee_code||r.worker_code||r.employee_code||'');
        if(!c) return;
        const w=state.workers.find(x=>workerCode(x)===c)||{employee_code:c,app_name:S(r.worker_name||r.worker_display_name||c),job_title:'عامل'};
        state.selected.set(c,w);
      });
      renderPickProjects(); renderPickWorkers(); renderSelected(); renderDistBox();
    },80);
  }
  function renderProjectsTab(){
    const box=$('cu413ProjectsTab'); if(!box) return;
    const q=norm($('cu413ProjectSearch')?.value||'');
    const m=$('cu413ProjectsMonth')?.value || $('cu413Month')?.value || todayMonth();
    const rows=state.projects.filter(p=>{
      const d=projectDistributionSummary(p);
      return !q || norm(projectName(p)+' '+projectType(p)+' '+projectSupervisorName(p)+' '+d.sup.join(' ')+' '+d.workers.join(' ')).includes(q);
    });
    const supOptions=state.workers.filter(isSupervisor).map(w=>`<option value="${esc(workerCode(w))}">${esc(workerDisplay(w))}</option>`).join('');
    box.innerHTML=`<div class="cu413-grid"><div class="cu413-card"><h3>إضافة / تعديل مشروع</h3><div class="cu413-form"><input type="hidden" id="cu413PId"><label>اسم المشروع</label><input id="cu413PName" placeholder="اسم المشروع"><label>نوع المشروع</label><select id="cu413PType"><option value="daily_visit">زيارة يومية</option><option value="full_time">دوام كامل</option></select><div class="cu413-two"><div><label>الوقت المطلوب / المستغرق بالدقائق</label><input id="cu413PReq" type="number" placeholder="مثال 480"></div><div><label>المشرف من السيرفر</label><select id="cu413PSupervisor"><option value="">بدون مشرف</option>${supOptions}</select></div></div><div class="cu413-two"><div><label>عدد العمائر</label><input id="cu413PBuildings" type="number" min="0" placeholder="0"></div><div><label>عدد الشقق</label><input id="cu413PUnits" type="number" min="0" placeholder="0"></div></div><div class="cu413-two"><div><label>تاريخ بداية المشروع</label><input id="cu413PStartDate" type="date"></div><div><label>تاريخ نهاية المشروع</label><input id="cu413PEndDate" type="date"></div></div><label>الحالة</label><select id="cu413PStatus"><option value="active">نشط</option><option value="inactive">موقوف</option></select><div class="cu413-two"><button type="button" onclick="tasneefCoreUnifiedV413.saveProject()">حفظ المشروع</button><button type="button" class="light" onclick="tasneefCoreUnifiedV413.clearProjectForm()">تفريغ</button></div></div></div><div class="cu413-card"><h3>قائمة المشاريع + التوزيع</h3><div class="cu413-two"><div><label>شهر عرض التوزيع</label><input type="month" id="cu413ProjectsMonth" value="${esc(m)}"></div><div><label>بحث</label><input id="cu413ProjectSearch" placeholder="بحث باسم المشروع أو المشرف أو العامل" value="${esc($('cu413ProjectSearch')?.value||'')}"></div></div><div class="cu413-kpis"><div class="cu413-kpi"><small>الإجمالي</small><b>${state.projects.length}</b></div><div class="cu413-kpi"><small>دوام كامل</small><b>${state.projects.filter(p=>projectType(p)==='دوام كامل').length}</b></div><div class="cu413-kpi"><small>زيارة يومية</small><b>${state.projects.filter(p=>projectType(p)!=='دوام كامل').length}</b></div><div class="cu413-kpi"><small>المعروض</small><b>${rows.length}</b></div></div><div class="cu413-list">${rows.map(p=>{const d=projectDistributionSummary(p); return `<div class="cu413-row"><div style="flex:1"><b>${esc(projectName(p))}</b><small>${esc(projectType(p))} | الوقت: ${projectRequired(p).toLocaleString('en-US')} د | العمائر: ${projectBuildings(p)} | الشقق: ${projectUnits(p)}</small><small>بداية المشروع: ${esc(projectStartDate(p)||'-')} | نهاية المشروع: ${esc(projectEndDate(p)||'-')}</small><small>المشرف الافتراضي في المشروع: ${esc(projectSupervisorName(p))}</small><small><b>توزيع شهر ${esc(d.month)}:</b> المشرف: ${esc(d.sup.join('، ')||'-')} | عدد العمال: ${d.workers.length}</small><div>${d.workers.slice(0,8).map(w=>`<span class="cu413-chip">${esc(w)}</span>`).join('')}${d.workers.length>8?`<span class="cu413-chip">+${d.workers.length-8}</span>`:''}</div></div><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end"><small>${esc(projectId(p))}</small><button type="button" class="light" onclick="tasneefCoreUnifiedV413.editProject('${esc(projectId(p))}')">تعديل المشروع</button><button type="button" class="light" onclick="tasneefCoreUnifiedV413.openProjectDistribution('${esc(projectId(p))}')">تعديل التوزيع</button></div></div>`}).join('')||'<div class="cu413-row">لا توجد مشاريع</div>'}</div></div></div>`;
    $('cu413ProjectSearch')?.addEventListener('input', renderProjectsTab);
    $('cu413ProjectsMonth')?.addEventListener('change', refreshProjectsMonthDistribution);
  }
  function fillSelects(){
    const month=$('cu413Month'); if(month&&!month.value) month.value=todayMonth();
    const sup=$('cu413Sup'), pr=$('cu413Project');
    if(sup){const cur=sup.value; const sups=state.workers.filter(isSupervisor); sup.innerHTML='<option value="">اختر المشرف</option>'+sups.map(w=>`<option value="${esc(workerCode(w))}">${esc(workerDisplay(w))}</option>`).join(''); sup.value=cur;}
    if(pr){const cur=pr.value; pr.innerHTML='<option value="">اختر المشروع</option>'+state.projects.map(p=>`<option value="${esc(projectId(p))}">${esc(projectName(p))} - ${esc(projectType(p))}</option>`).join(''); pr.value=cur;}
    ['cu413FilterSup','cu413FilterProject'].forEach(id=>{const el=$(id); if(!el) return; const cur=el.value; if(id.includes('Sup')){const names=[...new Set((state.dist[$('cu413Month')?.value||todayMonth()]||[]).map(r=>S(r.supervisor_name||r.supervisor_display_name)).filter(Boolean))]; el.innerHTML='<option value="">كل المشرفين</option>'+names.map(n=>`<option>${esc(n)}</option>`).join('');}else{const names=[...new Set((state.dist[$('cu413Month')?.value||todayMonth()]||[]).map(r=>S(r.project_name||r.project_display_name)).filter(Boolean))]; el.innerHTML='<option value="">كل المشاريع</option>'+names.map(n=>`<option>${esc(n)}</option>`).join('');} el.value=cur;});
  }
  function renderDistributionTab(){
    const box=$('cu413DistributionTab'); if(!box) return;
    const m=$('cu413Month')?.value||todayMonth();
    box.innerHTML=`<div class="cu413-grid"><div class="cu413-card"><h3>توزيع سريع بضغطة زر</h3><div class="cu413-form"><label>الشهر</label><input type="month" id="cu413Month" value="${esc(m)}"><label>المشرف</label><select id="cu413Sup"></select><div class="cu413-two"><div><label>بحث عن مشروع</label><input id="cu413ProjectSearchPick" placeholder="اسم المشروع أو النوع"></div><div><label>بحث عن عامل</label><input id="cu413PickSearch" placeholder="اسم العامل أو الكود"></div></div><div class="cu413-two"><div><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>المشاريع</b><button type="button" class="light" onclick="tasneefCoreUnifiedV413.selectVisibleProjects()">تحديد المشاريع الظاهرة</button></div><div id="cu413ProjectPick" class="cu413-project-pick"></div></div><div><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>العمال</b><button type="button" class="light" onclick="tasneefCoreUnifiedV413.selectVisibleWorkers()">تحديد العمال الظاهرين</button></div><div id="cu413WorkerPick" class="cu413-worker-pick"></div></div></div><label>المحدد</label><div id="cu413Selected" class="cu413-list" style="max-height:140px"></div><div class="cu413-two"><button type="button" onclick="tasneefCoreUnifiedV413.saveQuickDistribution()">ربط المحدد</button><button type="button" class="light" onclick="tasneefCoreUnifiedV413.clearDistributionSelection()">مسح الاختيار</button></div><button type="button" class="light" onclick="tasneefCoreUnifiedV413.copyPreviousMonth()">نسخ الشهر السابق</button></div></div><div class="cu413-card"><h3>توزيع الشهر</h3><div class="cu413-two"><select id="cu413FilterSup"><option value="">كل المشرفين</option></select><select id="cu413FilterProject"><option value="">كل المشاريع</option></select></div><div id="cu413DistBox" class="cu413-list"></div></div></div>`;
    fillSelects(); renderPickProjects(); renderPickWorkers(); renderSelected(); renderDistBox();
    ['cu413Month'].forEach(id=>$(id)?.addEventListener('change',async()=>{await loadDistribution(true); await loadBorrowings($('cu413Month')?.value||todayMonth(),true); fillSelects(); renderDistBox();}));
    ['cu413ProjectSearchPick'].forEach(id=>$(id)?.addEventListener('input', renderPickProjects));
    ['cu413PickSearch'].forEach(id=>$(id)?.addEventListener('input', renderPickWorkers));
    ['cu413FilterSup','cu413FilterProject'].forEach(id=>$(id)?.addEventListener('change', renderDistBox));
  }
  function visibleProjects(){const q=norm($('cu413ProjectSearchPick')?.value||''); return state.projects.filter(statusActive).filter(p=>!q||norm(projectName(p)+' '+projectType(p)+' '+projectSupervisorName(p)).includes(q));}
  function visibleWorkers(){const q=norm($('cu413PickSearch')?.value||''); const seen=new Set(); return state.workers.filter(w=>isWorker(w)).filter(statusActive).filter(w=>{const k=workerCode(w)||('name:'+norm(workerName(w))); if(seen.has(k)) return false; seen.add(k); return true;}).filter(w=>!q||norm(workerDisplay(w)+' '+workerRole(w)).includes(q));}
  function renderPickProjects(){
    const box=$('cu413ProjectPick'); if(!box) return;
    const rows=visibleProjects();
    box.innerHTML=rows.map(p=>`<button type="button" class="cu413-worker ${state.selectedProjects.has(projectId(p))?'on':''}" onclick="tasneefCoreUnifiedV413.toggleProject('${esc(projectId(p))}')"><b>${esc(projectName(p))}</b><small>${esc(projectType(p))}</small></button>`).join('')||'<div class="cu413-row">لا توجد مشاريع</div>';
  }
  function renderPickWorkers(){
    const box=$('cu413WorkerPick'); if(!box) return;
    const rows=visibleWorkers();
    box.innerHTML=rows.map(w=>`<button type="button" class="cu413-worker ${state.selected.has(workerCode(w))?'on':''}" onclick="tasneefCoreUnifiedV413.toggleWorker('${esc(workerCode(w))}')"><b>${esc(workerDisplay(w))}</b><small>${esc(workerRole(w))}</small></button>`).join('')||'<div class="cu413-row">لا يوجد عمال</div>';
  }
  function renderSelected(){
    const box=$('cu413Selected'); if(!box) return;
    const projects=[...state.selectedProjects].map(pid=>state.projects.find(p=>projectId(p)===pid)).filter(Boolean);
    const workers=[...state.selected.values()];
    box.innerHTML=`<div><b>المشاريع المحددة: ${projects.length}</b><br>${projects.map(p=>`<span class="cu413-chip">${esc(projectName(p))}<button onclick="tasneefCoreUnifiedV413.toggleProject('${esc(projectId(p))}')" type="button">×</button></span>`).join('')||'<small>لم يتم اختيار مشاريع</small>'}</div><div style="margin-top:8px"><b>العمال المحددون: ${workers.length}</b><br>${workers.map(w=>`<span class="cu413-chip">${esc(workerDisplay(w))}<button onclick="tasneefCoreUnifiedV413.toggleWorker('${esc(workerCode(w))}')" type="button">×</button></span>`).join('')||'<small>لم يتم اختيار عمال</small>'}</div>`;
  }
  function toggleProject(pid){ if(state.selectedProjects.has(pid)) state.selectedProjects.delete(pid); else state.selectedProjects.add(pid); renderPickProjects(); renderSelected(); }
  function toggleWorker(code){const w=(state.allWorkers||state.workers).find(x=>workerCode(x)===code); if(!w)return; if(state.selected.has(code)) state.selected.delete(code); else state.selected.set(code,w); renderPickWorkers(); renderSelected();}
  function selectVisibleProjects(){visibleProjects().forEach(p=>state.selectedProjects.add(projectId(p))); renderPickProjects(); renderSelected();}
  function selectVisibleWorkers(){visibleWorkers().forEach(w=>state.selected.set(workerCode(w),w)); renderPickWorkers(); renderSelected();}
  function clearDistributionSelection(){state.selected.clear(); state.selectedProjects.clear(); renderPickProjects(); renderPickWorkers(); renderSelected();}
  function hydrateProjectSelection(){
    const m=$('cu413Month')?.value||todayMonth(), pid=[...state.selectedProjects][0]||'';
    state.selected.clear();
    (state.dist[m]||[]).filter(r=>S(r.project_id)===S(pid)).forEach(r=>{const c=S(r.worker_employee_code||r.worker_code); const w=state.workers.find(x=>workerCode(x)===c)||{employee_code:c,app_name:S(r.worker_name||r.worker_display_name||c),job_title:'عامل'}; if(c) state.selected.set(c,w);});
    renderPickWorkers(); renderSelected();
  }
  function renderDistBox(){
    const box=$('cu413DistBox'); if(!box) return;
    const m=$('cu413Month')?.value||todayMonth(), fs=$('cu413FilterSup')?.value||'', fp=$('cu413FilterProject')?.value||'';
    let rows=effectiveDistributionRows(m); rows=rows.filter(r=>(!fs||S(r.supervisor_name||r.supervisor_display_name)===fs)&&(!fp||S(r.project_name||r.project_display_name)===fp));
    const groups=new Map(); rows.forEach(r=>{const k=S(r.supervisor_name||r.supervisor_display_name||r.supervisor_employee_code||'-')+'||'+S(r.project_name||r.project_display_name||r.project_id||'-'); if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(r);});
    box.innerHTML=[...groups.entries()].map(([k,list])=>{const [sup,proj]=k.split('||'); const first=list[0]||{}; return `<div class="cu413-dist-card"><div class="cu413-dist-head"><div><h4>${esc(proj)}</h4><small>${esc(sup)}</small></div><div style="display:flex;gap:6px;align-items:center"><b>${list.length} عامل</b><button type="button" class="light" onclick="tasneefCoreUnifiedV413.editDistribution('${esc(S(first.project_id))}')">تعديل</button></div></div>${list.map(r=>`<span class="cu413-chip" style="${r.is_borrowed?'background:#fff7df;border-color:#e5c76b':''}">${esc(S(r.worker_display_name||((r.worker_employee_code||'')+' - '+(r.worker_name||''))))}${r.is_borrowed?' <small>(استعارة من '+esc(S(r.borrowed_from_supervisor_name||'-'))+')</small>':''}</span>`).join('')}</div>`}).join('')||'<div class="cu413-row">لا يوجد توزيع لهذا الشهر</div>';
  }

  async function saveWorker(){
    const c=client(); if(!c)return; let code=S($('cu413WCode')?.value); const name=S($('cu413WName')?.value); if(!code){code=await generateWorkerCode(); if($('cu413WCode')) $('cu413WCode').value=code;} code=normalizeWorkerCode(code); if(!code||!name){showMsg('أدخل اسم العامل، وسيتم توليد الكود تلقائيًا.',true);return;}
    const row={employee_code:code, app_name:name, job_title:S($('cu413WRole')?.value||'عامل'), iqama_number:S($('cu413WIqama')?.value||''), work_start_date:S($('cu413WStartDate')?.value||'')||null, work_end_date:S($('cu413WEndDate')?.value||'')||null, basic_salary:N($('cu413WSalary')?.value), allowances:N($('cu413WAllowance')?.value), total_salary:N($('cu413WSalary')?.value)+N($('cu413WAllowance')?.value), status:S($('cu413WStatus')?.value||'active')};
    let r=await c.from('employees_master_v386').upsert(row,{onConflict:'employee_code'}).select();
    if(r.error){ r=await c.from('workers').insert({name:name, basic_salary:N($('cu413WSalary')?.value), allowances:N($('cu413WAllowance')?.value), total_salary:N($('cu413WSalary')?.value)+N($('cu413WAllowance')?.value), status:S($('cu413WStatus')?.value||'active')}).select(); }
    // تحديث جداول قديمة إن وجدت بدون تعطيل الحفظ الرئيسي.
    await safe('workers-update-code', c.from('workers').update({status:S($('cu413WStatus')?.value||'active'), basic_salary:N($('cu413WSalary')?.value), allowances:N($('cu413WAllowance')?.value), total_salary:N($('cu413WSalary')?.value)+N($('cu413WAllowance')?.value)}).eq('employee_code',code));
    await safe('workers-update-name', c.from('workers').update({status:S($('cu413WStatus')?.value||'active'), basic_salary:N($('cu413WSalary')?.value), allowances:N($('cu413WAllowance')?.value), total_salary:N($('cu413WSalary')?.value)+N($('cu413WAllowance')?.value)}).eq('name',name));
    if(r.error){showMsg('تعذر حفظ العامل: '+r.error.message,true);return;} state.workers=[]; state.allWorkers=[]; await reload(true); clearWorkerForm(); showMsg('تم حفظ العامل.');
  }
  function clearWorkerForm(){['cu413WEditMode','cu413WCode','cu413WName','cu413WIqama','cu413WStartDate','cu413WEndDate','cu413WSalary','cu413WAllowance','cu413WTotal'].forEach(id=>{const el=$(id); if(el) el.value='';}); const r=$('cu413WRole'); if(r) r.value='عامل'; const st=$('cu413WStatus'); if(st) st.value='active';}
  function editWorker(code){const w=(state.allWorkers||state.workers).find(x=>workerCode(x)===code); if(!w)return; setTab('workers'); setTimeout(()=>{if($('cu413WEditMode')) $('cu413WEditMode').value=code; if($('cu413WCode')) $('cu413WCode').value=workerCode(w); if($('cu413WName')) $('cu413WName').value=workerName(w); if($('cu413WRole')) $('cu413WRole').value=workerRole(w)||'عامل'; if($('cu413WIqama')) $('cu413WIqama').value=S(w.iqama_number||w.national_id||''); if($('cu413WStatus')) $('cu413WStatus').value=S(w.status||w.state||'active')||'active'; if($('cu413WStartDate')) $('cu413WStartDate').value=workerStartDate(w); if($('cu413WEndDate')) $('cu413WEndDate').value=workerEndDate(w); if($('cu413WSalary')) $('cu413WSalary').value=workerBasicSalary(w)||''; if($('cu413WAllowance')) $('cu413WAllowance').value=workerAllowances(w)||''; calcWorkerTotal();},60);}
  function clearProjectForm(){['cu413PId','cu413PName','cu413PReq','cu413PBuildings','cu413PUnits','cu413PStartDate','cu413PEndDate'].forEach(id=>{const el=$(id); if(el) el.value='';}); const t=$('cu413PType'); if(t)t.value='daily_visit'; const s=$('cu413PStatus'); if(s)s.value='active'; const sp=$('cu413PSupervisor'); if(sp)sp.value='';}
  function editProject(pid){const p=state.projects.find(x=>projectId(x)===S(pid)); if(!p)return; setTab('projects'); setTimeout(()=>{if($('cu413PId')) $('cu413PId').value=projectId(p); if($('cu413PName')) $('cu413PName').value=projectName(p); if($('cu413PType')) $('cu413PType').value=(projectType(p)==='دوام كامل'?'full_time':'daily_visit'); if($('cu413PReq')) $('cu413PReq').value=projectRequired(p)||''; if($('cu413PBuildings')) $('cu413PBuildings').value=projectBuildings(p)||''; if($('cu413PUnits')) $('cu413PUnits').value=projectUnits(p)||''; if($('cu413PStartDate')) $('cu413PStartDate').value=projectStartDate(p)||''; if($('cu413PEndDate')) $('cu413PEndDate').value=projectEndDate(p)||''; if($('cu413PStatus')) $('cu413PStatus').value=S(p.status||p.state||'active'); if($('cu413PSupervisor')) $('cu413PSupervisor').value=projectSupervisorCode(p);},60);}
  function editDistribution(pid){setTab('distribution'); setTimeout(()=>{state.selectedProjects.clear(); state.selectedProjects.add(S(pid)); renderPickProjects(); hydrateProjectSelection(); const m=$('cu413Month')?.value||todayMonth(); const rows=(state.dist[m]||[]).filter(r=>S(r.project_id)===S(pid)); const first=rows[0]||{}; const sup=$('cu413Sup'); if(sup) sup.value=S(first.supervisor_employee_code||''); renderSelected();},80);}
  async function saveProject(){
    const c=client(); if(!c)return; const name=S($('cu413PName')?.value); if(!name){showMsg('أدخل اسم المشروع.',true);return;}
    const pid=S($('cu413PId')?.value||'');
    const pStart=S($('cu413PStartDate')?.value||'')||null, pEnd=S($('cu413PEndDate')?.value||'')||null;
    const row={name, operation_type:S($('cu413PType')?.value||'daily_visit'), required_daily_minutes:N($('cu413PReq')?.value), status:S($('cu413PStatus')?.value||'active'), supervisor_employee_code:S($('cu413PSupervisor')?.value||''), buildings_count:N($('cu413PBuildings')?.value), units_count:N($('cu413PUnits')?.value), project_start_date:pStart, project_end_date:pEnd, contract_start:pStart, contract_end:pEnd, start_date:pStart, end_date:pEnd};
    let r;
    if(pid) r=await c.from('projects').update(row).eq('id',pid).select(); else r=await c.from('projects').insert(row).select();
    if(r.error){showMsg('تعذر حفظ المشروع: '+r.error.message,true);return;} state.projects=[]; await reload(true); clearProjectForm(); showMsg('تم حفظ المشروع.');
  }
  async function saveQuickDistribution(){
    const c=client(); if(!c)return;
    const m=$('cu413Month')?.value||todayMonth(), supCode=$('cu413Sup')?.value;
    const sup=state.workers.find(x=>workerCode(x)===S(supCode));
    const projects=[...state.selectedProjects].map(pid=>state.projects.find(p=>projectId(p)===pid)).filter(Boolean);
    const chosen=[...state.selected.values()];
    if(!m||!sup){showMsg('اختر الشهر والمشرف.',true);return;}
    if(!projects.length){showMsg('اختر مشروعًا واحدًا على الأقل.',true);return;}
    if(!chosen.length){showMsg('اختر عاملًا واحدًا على الأقل.',true);return;}
    const rows=[], rowKeys=new Set();
    projects.forEach(p=>chosen.forEach(w=>{const key=[m,projectId(p),workerCode(w)].join('|'); if(rowKeys.has(key)) return; rowKeys.add(key); rows.push({month_key:m, supervisor_employee_code:workerCode(sup), supervisor_name:workerName(sup), project_id:projectId(p), project_name:projectName(p), worker_employee_code:workerCode(w), worker_name:workerName(w), role_type:workerRole(w)||'عامل', shift_name:'default', required_minutes:projectRequired(p), start_date:m+'-01', end_date:null, status:'active'});}));
    const r=await c.from('monthly_distribution').upsert(rows,{onConflict:'month_key,project_id,worker_employee_code'}).select();
    if(r.error){showMsg('تعذر حفظ التوزيع: '+r.error.message,true);return;}
    delete state.dist[m]; await loadDistribution(true); await loadBorrowings($('cu413Month')?.value||todayMonth(),true); fillSelects(); renderDistBox(); showMsg('تم ربط '+chosen.length+' عامل مع '+projects.length+' مشروع بنجاح.');
  }
  async function saveDistribution(){ return saveQuickDistribution(); }
  async function copyPreviousMonth(){
    const c=client(); if(!c)return; const m=$('cu413Month')?.value||todayMonth(), pm=prevMonth(m); if(!confirm('نسخ توزيع '+pm+' إلى '+m+'؟'))return;
    const old=await safe('previous dist', c.from('monthly_distribution').select('*').eq('month_key',pm).limit(10000)); if(!(old.data||[]).length){showMsg('لا يوجد توزيع في الشهر السابق.',true);return;}
    const rows=(old.data||[]).map(({id,created_at,updated_at,...r})=>({...r,month_key:m,start_date:m+'-01',end_date:monthEnd(m)}));
    const res=await c.from('monthly_distribution').upsert(rows,{onConflict:'month_key,project_id,worker_employee_code'}).select(); if(res.error){showMsg('تعذر النسخ: '+res.error.message,true);return;} delete state.dist[m]; await loadDistribution(true); renderDistBox(); showMsg('تم نسخ توزيع الشهر السابق.');
  }

  function attendanceDate(){return $('cu413AttDate')?.value || new Date().toISOString().slice(0,10);}
  function attendanceMonth(){return attendanceDate().slice(0,7);}
  function attKey(r){return [S(r.worker_employee_code||r.worker_code||r.employee_code),S(r.project_id),S(r.attendance_date||r.date),S(r.shift_name||'default')].join('||');}
  async function loadAttendance(date, force){
    const c=client(); if(!c)return [];
    const d=date||attendanceDate(); if(state.att[d]&&!force) return state.att[d];
    const r=await safe('attendance', c.from('attendance').select('*').eq('attendance_date',d).limit(10000));
    state.att[d]=r.data||[]; return state.att[d];
  }
  function attendanceRows(){
    const d=attendanceDate(), m=d.slice(0,7), fs=$('cu413AttSup')?.value||'', fp=$('cu413AttProject')?.value||'';
    const dist=effectiveDistributionRows(m).filter(r=>(!fs||S(r.supervisor_employee_code)===fs||S(r.supervisor_name)===fs)&&(!fp||S(r.project_id)===fp));
    const att=state.att[d]||[]; const amap=new Map(att.map(a=>[attKey(a),a]));
    const seen=new Set();
    return dist.filter(r=>{
      const k=[S(r.worker_employee_code||r.worker_code||r.employee_code),S(r.project_id),S(d),S(r.shift_name||'default')].join('||');
      if(seen.has(k)) return false; seen.add(k); return true;
    }).map(r=>{
      const k=[S(r.worker_employee_code||r.worker_code||r.employee_code),S(r.project_id),S(d),S(r.shift_name||'default')].join('||');
      return {dist:r, att:amap.get(k)||null};
    });
  }
  async function renderAttendanceTab(){
    const box=$('cu413AttendanceTab'); if(!box) return;
    const d=$('cu413AttDate')?.value || new Date().toISOString().slice(0,10);
    if(!$('cu413AttDate')){
      box.innerHTML=`<div class="cu413-card"><h3>الحضور والغياب المرتبط بالتوزيع</h3><div class="cu413-two"><div><label>التاريخ</label><input type="date" id="cu413AttDate" value="${esc(d)}"></div><div><label>المشرف</label><select id="cu413AttSup"><option value="">كل المشرفين</option></select></div></div><div class="cu413-two"><div><label>المشروع</label><select id="cu413AttProject"><option value="">كل المشاريع</option></select></div><div style="display:flex;align-items:end;gap:8px"><button type="button" onclick="tasneefCoreUnifiedV413.refreshAttendance()">تحديث الحضور</button></div></div><div id="cu413AttBox" class="cu413-list" style="max-height:65vh;margin-top:10px"></div></div>`;
      $('cu413AttDate')?.addEventListener('change',()=>refreshAttendance());
      $('cu413AttSup')?.addEventListener('change',()=>renderAttendanceBox());
      $('cu413AttProject')?.addEventListener('change',()=>renderAttendanceBox());
    }
    await refreshAttendance(false);
  }
  function fillAttendanceFilters(){
    const m=attendanceMonth(); const rows=effectiveDistributionRows(m);
    const sup=$('cu413AttSup'), pr=$('cu413AttProject');
    if(sup){const cur=sup.value; const vals=[...new Map(rows.map(r=>[S(r.supervisor_employee_code||r.supervisor_name), S(r.supervisor_name||r.supervisor_employee_code)]).filter(x=>x[0])).entries()]; sup.innerHTML='<option value="">كل المشرفين</option>'+vals.map(([v,n])=>`<option value="${esc(v)}">${esc(n)}</option>`).join(''); sup.value=cur;}
    if(pr){const cur=pr.value; const vals=[...new Map(rows.map(r=>[S(r.project_id), S(r.project_name||r.project_id)]).filter(x=>x[0])).entries()]; pr.innerHTML='<option value="">كل المشاريع</option>'+vals.map(([v,n])=>`<option value="${esc(v)}">${esc(n)}</option>`).join(''); pr.value=cur;}
  }
  async function refreshAttendance(force=true){
    const d=attendanceDate(), m=d.slice(0,7);
    if($('cu413Month')) $('cu413Month').value=m;
    await loadDistribution(force);
    await loadBorrowings(m,force);
    await loadAttendance(d,force);
    fillAttendanceFilters(); renderAttendanceBox();
  }
  function attendanceStatusOptions(st){
    const opts=[['present','حاضر'],['absent','غائب'],['leave','إجازة'],['sick','مرضي'],['mission','مأمورية'],['weekly_off','راحة أسبوعية'],['late','متأخر'],['early_leave','خروج مبكر']];
    return opts.map(([v,n])=>`<option value="${v}" ${st===v?'selected':''}>${n}</option>`).join('');
  }
  function setAllAttendanceStatus(st){
    (window.__cu413AttendanceRows||[]).forEach((_,i)=>{const el=$('cu413AttStatus_'+i); if(el) el.value=st;});
  }
  async function saveAllAttendanceRows(){
    const rows=window.__cu413AttendanceRows||[];
    if(!rows.length){showMsg('لا توجد بيانات للحفظ.',true);return;}
    for(let i=0;i<rows.length;i++) await saveAttendanceRow(i,true);
    const d=attendanceDate(); delete state.att[d]; await loadAttendance(d,true); renderAttendanceBox(); showMsg('تم حفظ تحضير جميع العمال حسب التوزيع الحالي.');
  }
  function renderAttendanceBox(){
    const box=$('cu413AttBox'); if(!box) return;
    const rows=attendanceRows();
    const counts={present:0,absent:0,leave:0,sick:0,mission:0,weekly_off:0,late:0,early_leave:0};
    rows.forEach(x=>{const st=S(x.att?.status||'present'); if(counts[st]!=null) counts[st]++;});
    const groups=new Map();
    rows.forEach((item,i)=>{
      const r=item.dist||{};
      const supKey=S(r.supervisor_employee_code||r.supervisor_name||'بدون مشرف');
      const supName=S(r.supervisor_name||r.supervisor_employee_code||'بدون مشرف');
      if(!groups.has(supKey)) groups.set(supKey,{name:supName,items:[]});
      groups.get(supKey).items.push({...item,idx:i});
    });
    window.__cu413AttendanceRows=rows;
    const header=`<div class="cu413-kpis"><div class="cu413-kpi"><small>الموزعين</small><b>${rows.length}</b></div><div class="cu413-kpi"><small>حاضر</small><b>${counts.present}</b></div><div class="cu413-kpi"><small>غائب</small><b>${counts.absent}</b></div><div class="cu413-kpi"><small>إجازات/أخرى</small><b>${counts.leave+counts.sick+counts.mission+counts.weekly_off+counts.late+counts.early_leave}</b></div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 12px"><button type="button" onclick="tasneefCoreUnifiedV413.setAllAttendanceStatus('present')">تحضير الكل حاضر</button><button type="button" class="light" onclick="tasneefCoreUnifiedV413.setAllAttendanceStatus('absent')">تحديد الكل غائب</button><button type="button" onclick="tasneefCoreUnifiedV413.saveAllAttendanceRows()">حفظ الكل</button></div>`;
    if(!rows.length){box.innerHTML=header+'<div class="cu413-row">لا يوجد عمال موزعين لهذا التاريخ. اربط العمال أولاً من التوزيع.</div>';return;}
    box.innerHTML=header+[...groups.values()].map(g=>{
      const cards=g.items.map(({dist,att,idx})=>{
        const code=S(dist.worker_employee_code||dist.worker_code||dist.employee_code);
        const name=S(dist.worker_name||dist.worker_display_name||'');
        const project=S(dist.project_name||dist.project_id||'-');
        const st=S(att?.status||'present');
        const red=st==='absent'?'background:#fff1f1;border-color:#efb4b4;':'';
        return `<div class="cu413-att-card" style="${red}">
          <b>${esc(name||code)}</b>
          <small>${esc(code)} ${code&&project?' | ':''}${esc(project)}</small>
          <select id="cu413AttStatus_${idx}">${attendanceStatusOptions(st)}</select>
          <input id="cu413AttNotes_${idx}" placeholder="ملاحظات" value="${esc(S(att?.notes||''))}">
        </div>`;
      }).join('');
      return `<div class="cu413-att-group"><div class="cu413-att-head"><b>المشرف: ${esc(g.name)}</b><span>عدد العمال: ${g.items.length}</span></div><div class="cu413-att-grid">${cards}</div></div>`;
    }).join('');
  }
  async function saveAttendanceRow(i,silent){
    const c=client(); if(!c)return; const item=(window.__cu413AttendanceRows||[])[i]; if(!item){if(!silent) showMsg('لم يتم العثور على السطر.',true);return;}
    const d=attendanceDate(), r=item.dist, existing=item.att||{};
    const row={attendance_date:d, month_key:d.slice(0,7), worker_employee_code:S(r.worker_employee_code||r.worker_code||r.employee_code), worker_name:S(r.worker_name||r.worker_display_name||''), project_id:S(r.project_id), project_name:S(r.project_name||''), supervisor_employee_code:S(r.supervisor_employee_code||''), supervisor_name:S(r.supervisor_name||''), shift_name:S(r.shift_name||'default'), status:S($('cu413AttStatus_'+i)?.value||'present'), check_in_time:S($('cu413AttIn_'+i)?.value||'')||null, check_out_time:S($('cu413AttOut_'+i)?.value||'')||null, notes:S($('cu413AttNotes_'+i)?.value||''), source:'core_unified_v419'};
    let res;
    if(existing.id){res=await c.from('attendance').update(row).eq('id',existing.id).select();}
    else {
      const found=await safe('attendance-find', c.from('attendance').select('*').eq('attendance_date',d).eq('worker_employee_code',row.worker_employee_code).eq('project_id',row.project_id).eq('shift_name',row.shift_name).limit(1));
      if((found.data||[])[0]?.id) res=await c.from('attendance').update(row).eq('id',found.data[0].id).select();
      else res=await c.from('attendance').insert(row).select();
    }
    if(res?.error){if(!silent) showMsg('تعذر حفظ الحضور: '+res.error.message,true);return;}
    if(!silent){delete state.att[d]; await loadAttendance(d,true); renderAttendanceBox(); showMsg('تم حفظ الحضور بدون حذف أي بيانات.');}
  }

  function borrowMonth(){return $('cu413BorrowMonth')?.value || $('cu413Month')?.value || todayMonth();}
  
  function distSupervisorOptions(selected){
    const m=borrowMonth();
    const map=new Map();
    (state.dist[m]||[]).filter(statusActive).forEach(r=>{
      const code=S(r.supervisor_employee_code||r.supervisor_code||r.supervisor_id||'');
      const name=S(r.supervisor_name||'');
      if(!code && !name) return;
      const key=code||name;
      if(!map.has(key)) map.set(key,{code:key,name:name||key});
    });
    if(!map.size){
      state.workers.filter(statusActive).filter(isSupervisor).forEach(w=>{
        const code=workerCode(w), name=workerDisplay(w);
        if(code && !map.has(code)) map.set(code,{code,name});
      });
    }
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'ar')).map(x=>`<option value="${esc(x.code)}" ${selected===x.code?'selected':''}>${esc(x.name)}</option>`).join('');
  }
  function borrowSupOptions(selected){return distSupervisorOptions(selected);} 

  function borrowWorkerRows(){
    const m=borrowMonth(), from=$('cu413BorrowFromSup')?.value||'', q=norm($('cu413BorrowSearch')?.value||'');
    const rows=(state.dist[m]||[]).filter(statusActive).filter(r=>!from||S(r.supervisor_employee_code||r.supervisor_code||r.supervisor_id)===from||S(r.supervisor_name)===from);
    const map=new Map();
    rows.forEach(r=>{
      const code=S(r.worker_employee_code||r.worker_code||r.employee_code); if(!code) return;
      const label=S(r.worker_display_name||((code?code+' - ':'')+S(r.worker_name||'')));
      if(q&&!norm(label+' '+S(r.project_name)).includes(q)) return;
      if(!map.has(code)) map.set(code,{code,label,rows:[]});
      map.get(code).rows.push(r);
    });
    return [...map.values()].sort((a,b)=>a.label.localeCompare(b.label,'ar'));
  }
  async function renderBorrowingTab(){
    const box=$('cu413BorrowingTab'); if(!box) return;
    const m=borrowMonth();
    if(!$('cu413BorrowMonth')){
      const now=new Date(), later=new Date(Date.now()+2*60*60*1000);
      const dt=v=>{const z=new Date(v.getTime()-v.getTimezoneOffset()*60000); return z.toISOString().slice(0,16);};
      box.innerHTML=`<div class="cu413-grid"><div class="cu413-card"><h3>استعارة عامل مؤقتة</h3><div class="cu413-form"><label>الشهر</label><input type="month" id="cu413BorrowMonth" value="${esc($('cu413Month')?.value||todayMonth())}"><label>المشرف المستعير</label><select id="cu413BorrowToSup"><option value="">اختر المشرف الذي يحتاج العامل</option>${borrowSupOptions('')}</select><label>اختر مشرف آخر لعرض عماله</label><select id="cu413BorrowFromSup"><option value="">اختر المشرف الأصلي</option>${borrowSupOptions('')}</select><div class="cu413-two"><div><label>من الوقت</label><input type="datetime-local" id="cu413BorrowStart" value="${esc(dt(now))}"></div><div><label>إلى الوقت</label><input type="datetime-local" id="cu413BorrowEnd" value="${esc(dt(later))}"></div></div><label>بحث في عمال المشرف الأصلي</label><input id="cu413BorrowSearch" placeholder="اسم العامل أو الكود أو المشروع"><div id="cu413BorrowWorkers" class="cu413-worker-pick"></div><button type="button" onclick="tasneefCoreUnifiedV413.saveBorrowing()">حفظ الاستعارة</button></div></div><div class="cu413-card"><h3>الاستعارات الحالية والمجدولة</h3><div id="cu413BorrowList" class="cu413-list"></div></div></div>`;
      ['cu413BorrowMonth','cu413BorrowFromSup','cu413BorrowSearch'].forEach(id=>$(id)?.addEventListener(id==='cu413BorrowSearch'?'input':'change', async()=>{ if(id==='cu413BorrowMonth'){ if($('cu413Month')) $('cu413Month').value=borrowMonth(); await loadDistribution(true); await loadBorrowings(borrowMonth(),true); const to=$('cu413BorrowToSup'), from=$('cu413BorrowFromSup'); const tv=to?.value||'', fv=from?.value||''; if(to) to.innerHTML='<option value="">اختر المشرف الذي يحتاج العامل</option>'+borrowSupOptions(tv); if(from) from.innerHTML='<option value="">اختر المشرف الأصلي</option>'+borrowSupOptions(fv); } renderBorrowWorkers(); renderBorrowList(); }));
      $('cu413BorrowToSup')?.addEventListener('change', renderBorrowList);
    }
    await loadBorrowings(m,false); renderBorrowWorkers(); renderBorrowList();
  }
  function renderBorrowWorkers(){
    const box=$('cu413BorrowWorkers'); if(!box) return;
    const rows=borrowWorkerRows();
    box.innerHTML=rows.map(x=>`<button type="button" class="cu413-worker ${state.borrowSelected.has(x.code)?'on':''}" onclick="tasneefCoreUnifiedV413.toggleBorrowWorker('${esc(x.code)}')"><b>${esc(x.label)}</b><small>${esc([...new Set(x.rows.map(r=>S(r.project_name)).filter(Boolean))].join('، '))}</small></button>`).join('')||'<div class="cu413-row">اختر مشرفًا أصليًا لعرض عماله</div>';
  }
  function toggleBorrowWorker(code){ if(state.borrowSelected.has(code)) state.borrowSelected.delete(code); else state.borrowSelected.add(code); renderBorrowWorkers(); }
  function borrowStatusText(b){
    const now=Date.now(), a=new Date(b.start_at).getTime(), z=new Date(b.end_at).getTime();
    if(['cancelled','canceled','ملغي'].includes(norm(b.status))) return 'ملغية';
    if(now<a) return 'مجدولة'; if(now>z) return 'انتهت ورجع العامل لمشرفه'; return 'نشطة الآن';
  }
  function renderBorrowList(){
    const box=$('cu413BorrowList'); if(!box) return;
    const m=borrowMonth();
    const rows=(state.borrow[m]||[]).slice().sort((a,b)=>S(b.start_at).localeCompare(S(a.start_at)));
    box.innerHTML=rows.map(b=>`<div class="cu413-row"><div><b>${esc(S(b.worker_display_name||((b.worker_employee_code||'')+' - '+(b.worker_name||''))))}</b><small>من: ${esc(S(b.original_supervisor_name||'-'))} ← إلى: ${esc(S(b.borrowing_supervisor_name||'-'))}</small><small>${esc(S(b.start_at||'').replace('T',' ').slice(0,16))} إلى ${esc(S(b.end_at||'').replace('T',' ').slice(0,16))} | ${esc(borrowStatusText(b))}</small></div><button type="button" class="light" onclick="tasneefCoreUnifiedV413.cancelBorrowing('${esc(S(b.id))}')">إلغاء</button></div>`).join('')||'<div class="cu413-row">لا توجد استعارات لهذا الشهر</div>';
  }
  async function saveBorrowing(){
    const c=client(); if(!c) return;
    const m=borrowMonth(), from=$('cu413BorrowFromSup')?.value||'', to=$('cu413BorrowToSup')?.value||'', start=$('cu413BorrowStart')?.value||'', end=$('cu413BorrowEnd')?.value||'';
    if(!m||!from||!to||!start||!end){showMsg('اختر المشرف المستعير والمشرف الأصلي والوقت.',true);return;}
    if(from===to){showMsg('لا يمكن استعارة العامل من نفس المشرف.',true);return;}
    if(new Date(end)<=new Date(start)){showMsg('وقت النهاية يجب أن يكون بعد وقت البداية.',true);return;}
    const all=borrowWorkerRows().filter(x=>state.borrowSelected.has(x.code));
    if(!all.length){showMsg('حدد عاملًا واحدًا على الأقل للاستعارة.',true);return;}
    const fromW=state.workers.find(w=>workerCode(w)===from||workerName(w)===from||workerDisplay(w)===from)||{}, toW=state.workers.find(w=>workerCode(w)===to||workerName(w)===to||workerDisplay(w)===to)||{};
    const rows=all.map(x=>{const src=x.rows[0]||{}; const code=x.code; const name=S(src.worker_name||x.label.replace(code,'').replace('-','').trim()); return {month_key:m, worker_employee_code:code, worker_name:name, worker_display_name:x.label, original_supervisor_employee_code:from, original_supervisor_name:workerName(fromW)||S(src.supervisor_name||''), borrowing_supervisor_employee_code:to, borrowing_supervisor_name:workerName(toW), project_id:S(src.project_id||''), project_name:S(src.project_name||''), start_at:start, end_at:end, status:'active'};});
    const r=await c.from('worker_borrowings').insert(rows).select();
    if(r.error){showMsg('تعذر حفظ الاستعارة: '+r.error.message,true);return;}
    state.borrowSelected.clear(); delete state.borrow[m]; await loadBorrowings(m,true); renderBorrowWorkers(); renderBorrowList(); renderDistBox(); renderAttendanceBox(); showMsg('تم حفظ الاستعارة. خلال الوقت المحدد يظهر العامل مع المشرف المستعير، وبعد الوقت يرجع لمشرفه الأصلي تلقائيًا.');
  }
  async function cancelBorrowing(id){
    const c=client(); if(!c)return; if(!confirm('إلغاء الاستعارة؟')) return;
    const r=await c.from('worker_borrowings').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',id).select();
    if(r.error){showMsg('تعذر إلغاء الاستعارة: '+r.error.message,true);return;}
    const m=borrowMonth(); delete state.borrow[m]; await loadBorrowings(m,true); renderBorrowList(); renderDistBox(); renderAttendanceBox(); showMsg('تم إلغاء الاستعارة.');
  }

  function printDistribution(){window.print();}

  async function init(){installCss(); installNav(); installSection(); await reload(false); setTab(state.tab||'distribution');}
  window.tasneefCoreUnifiedV413={init,reload,saveWorker,fillNextWorkerCode,saveProject,saveDistribution,saveQuickDistribution,copyPreviousMonth,toggleWorker,toggleProject,selectVisibleProjects,selectVisibleWorkers,clearDistributionSelection,printDistribution,editWorker,clearWorkerForm,editProject,clearProjectForm,editDistribution,renderWorkersTab,renderProjectsTab,openProjectDistribution,refreshProjectsMonthDistribution,calcWorkerTotal,renderAttendanceTab,refreshAttendance,saveAttendanceRow,setAllAttendanceStatus,saveAllAttendanceRows,renderBorrowingTab,toggleBorrowWorker,saveBorrowing,cancelBorrowing,effectiveDistributionRows};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(init,1200));
  setInterval(installNav,2000);
})();

/* Tasneef Core Unified V413
   بداية إعادة بناء الأقسام الأساسية بدون حذف بيانات.
   القاعدة: العمال من جدول العمال/الموظفين، المشاريع من projects، التوزيع من monthly_distribution. */
(function(){
  'use strict';
  if(window.__tasneefCoreUnifiedV413) return;
  window.__tasneefCoreUnifiedV413 = true;

  const VERSION='460';
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

  function workerCode(w){return S(w?.worker_code||w?.employee_code||w?.code||w?.emp_code||w?.id||'');}
  function workerName(w){return S(w?.worker_name||w?.app_name||w?.name||w?.full_name||w?.iqama_name||workerCode(w));}
  function workerRole(w){return S(w?.job_title||w?.role_type||w?.position||w?.job||w?.profession||'عامل');}
  function workerDisplay(w){const c=workerCode(w), n=workerName(w); return c && !n.includes(c) ? `${c} - ${n}` : n;}
  function workerStartDate(w){return S(w?.work_start_date||w?.hire_date||w?.employment_start_date||w?.start_work_date||w?.start_date||'');}
  function workerEndDate(w){return S(w?.work_end_date||w?.employment_end_date||w?.termination_date||w?.end_work_date||w?.end_date||'');}
  function workerBasicSalary(w){return N(w?.basic_salary||w?.base_salary||w?.salary||w?.main_salary||0);}
  function workerAllowances(w){return N(w?.allowances||w?.allowance||w?.salary_allowance||w?.total_allowances||w?.benefits||w?.extra_allowance||0);}
  function workerTotalSalary(w){const t=N(w?.total_salary||w?.salary_total||w?.total||w?.gross_salary||0); return t || (workerBasicSalary(w)+workerAllowances(w));}
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
  function statusActive(x){const st=norm(x?.status||x?.state||x?.active_status||'active'); if(x?.deleted_at||x?.is_deleted===true||['deleted','archived','محذوف'].includes(st)) return false; if(['active','enabled','working','نشط','فعال','على راس العمل','علي راس العمل'].includes(st)) return true; if(['inactive','stopped','disabled','موقوف','متوقف','غير نشط','غيرنشط','خارج العمل'].includes(st)) return false; return x?.is_active===true;}
  function statusDeleted(x){const st=norm(x?.status||x?.state||x?.active_status||'active'); return !!(x?.deleted_at||x?.is_deleted===true||['deleted','archived','محذوف'].includes(st));}
  function projectStatusLabel(p){return statusActive(p)?'نشط':'موقوف';}
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
      .cu413-root{display:flex;flex-direction:column;gap:14px}.cu413-hero{background:linear-gradient(135deg,#084f40,#126a58);color:#fff;border-radius:24px;padding:22px;display:flex;justify-content:space-between;align-items:center}.cu413-hero h2{margin:0 0 6px}.cu413-hero p{margin:0;color:#e9f6f2;line-height:1.8}.cu413-hero span{background:white;color:#084f40;border-radius:999px;padding:8px 14px;font-weight:900}.cu413-msg{padding:10px 12px;border-radius:14px;background:#eef8f5;border:1px solid #cfe2dc;color:#0A4033;font-weight:800}.cu413-msg.err{background:#fde8e8;color:#9d2222;border-color:#efc3c3}.cu413-tabs,.cu413-actions{display:flex;gap:8px;flex-wrap:wrap}.cu413-tabs button,.cu413-actions button{border:0;border-radius:12px;padding:10px 14px;background:#eef8f5;color:#0A4033;font-weight:900;cursor:pointer}.cu413-tabs button.active,.cu413-actions button:not(.light){background:#0A4033;color:#fff}.cu413-grid{display:grid;grid-template-columns:390px 1fr;gap:14px}.cu413-card{background:#fff;border:1px solid #dce6e2;border-radius:20px;padding:16px}.cu413-card h3{margin:0 0 12px;color:#0A4033}.cu413-form{display:grid;gap:9px}.cu413-form label{font-size:12px;color:#0A4033;font-weight:900}.cu413-form input,.cu413-form select,.cu413-form textarea{width:100%;border:1px solid #dce6e2;border-radius:12px;padding:10px}.cu413-list{max-height:60vh;overflow:auto;border:1px solid #edf1ef;border-radius:14px;background:#fbfdfc;padding:8px}.cu413-row{display:flex;justify-content:space-between;gap:10px;background:#fff;border:1px solid #edf1ef;border-radius:12px;padding:9px;margin-bottom:7px;align-items:center}.cu413-row b{color:#0A4033}.cu413-row small{display:block;color:#60706a;margin-top:3px}.cu413-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}.cu413-kpi{background:#fff;border:1px solid #dce6e2;border-radius:14px;padding:10px;text-align:center}.cu413-kpi b{display:block;font-size:22px;color:#0A4033}.cu413-worker-pick{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;max-height:300px;overflow:auto;border:1px solid #dce6e2;border-radius:14px;padding:8px;background:#fbfdfc}.cu413-project-pick{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;max-height:260px;overflow:auto;border:1px solid #dce6e2;border-radius:14px;padding:8px;background:#fbfdfc}.cu413-worker{background:#fff;border:1px solid #dce6e2;color:#10231d;border-radius:12px;padding:9px;text-align:right}.cu413-worker.on{background:#0A4033;color:#fff}.cu413-chip{display:inline-flex;gap:5px;align-items:center;background:#eef8f5;border:1px solid #cfe2dc;color:#0A4033;border-radius:999px;padding:6px 9px;margin:3px;font-weight:800}.cu413-chip button{background:#b83232;color:white;border:0;border-radius:50%;width:18px;height:18px;padding:0}.cu413-dist-card{background:#fff;border:1px solid #dce6e2;border-radius:16px;padding:12px;margin-bottom:10px}.cu413-dist-card h4{margin:0;color:#0A4033}.cu413-dist-head{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #edf1ef;padding-bottom:8px;margin-bottom:8px}.cu413-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.cu413-workers-filters{display:grid;grid-template-columns:minmax(190px,1.4fr) repeat(3,minmax(125px,.8fr)) auto auto;gap:8px;margin-bottom:10px;align-items:center}.cu413-workers-filters input,.cu413-workers-filters select,.cu413-workers-filters button{width:100%;min-height:42px;border:1px solid #dce6e2;border-radius:12px;padding:9px}.cu413-workers-filters button{background:#0A4033;color:#fff;font-weight:900;cursor:pointer}.cu413-workers-filters button.light{background:#eef8f5;color:#0A4033}@media(max-width:900px){.cu413-grid,.cu413-two,.cu413-kpis,.cu413-workers-filters{grid-template-columns:1fr}.cu413-worker-pick{grid-template-columns:1fr}}@media print{body *{visibility:hidden!important}#coreUnified,#coreUnified *{visibility:visible!important}#coreUnified{position:absolute;inset:0}.cu413-tabs,.cu413-actions,.cu413-form{display:none!important}.side{display:none!important}@page{size:A4 landscape;margin:10mm}}`;
    document.head.appendChild(st);
  }

  function showMsg(t,err){const el=$('cu413Msg'); if(el){el.textContent=t; el.className='cu413-msg '+(err?'err':'');}}
  function setTab(tab){state.tab=tab; document.querySelectorAll('#coreUnified [data-tab]').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab)); ['workers','projects','distribution','attendance','borrowing','salaries'].forEach(t=>$('cu413'+cap(t)+'Tab')?.classList.toggle('hidden', t!==tab)); render();}
  function cap(s){return s.charAt(0).toUpperCase()+s.slice(1);}

  async function loadWorkers(force){
    if(state.workers.length&&!force) return state.workers;
    const c=client(); if(!c) return [];
    const r1=await safe('employees_master_v386', c.from('employees_master_v386').select('*').limit(10000));
    const r2=await safe('workers', c.from('workers').select('*').eq('is_active', true).limit(10000));
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
    const r=await safe('projects', c.from('projects').select('*').eq('is_active', true).limit(5000));
    state.projects=(r.data||[]).filter(p=>!statusDeleted(p)).sort((a,b)=>projectName(a).localeCompare(projectName(b),'ar')); // V456: عرض كل المشاريع غير المحذوفة في قائمة المشاريع، والموقوف لا يدخل التوزيع
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
  function workerRoleCategory(w){
    const r=norm(workerRole(w));
    if(r.includes('مشرف')||r.includes('supervisor')) return 'supervisor';
    if(r.includes('فني')||r.includes('technician')) return 'technician';
    if(r.includes('حارس')||r.includes('امن')||r.includes('security')||r.includes('guard')) return 'guard';
    if(r.includes('موظف')||r.includes('اداري')||r.includes('employee')||r.includes('admin')) return 'employee';
    return 'worker';
  }
  function filteredWorkers(){
    const q=norm($('cu413WorkerSearch')?.value||'');
    const role=S($('cu413WorkerRoleFilter')?.value||'');
    const status=S($('cu413WorkerStatusFilter')?.value||'');
    const all=(state.allWorkers&&state.allWorkers.length?state.allWorkers:state.workers).filter(w=>!statusDeleted(w));
    return all.filter(w=>{
      if(role && workerRoleCategory(w)!==role) return false;
      if(status==='active' && !statusActive(w)) return false;
      if(status==='inactive' && statusActive(w)) return false;
      return !q||norm(workerDisplay(w)+' '+workerRole(w)+' '+S(w.status||w.state||'')+' '+S(w.iqama_number||w.national_id||'')).includes(q);
    });
  }
  function exportRoleLabel(w){const c=workerRoleCategory(w); return c==='technician'?'فني':c==='guard'?'حارس':c==='employee'?'موظف':c==='supervisor'?'مشرف':'عامل';}
  function exportRoleGroup(w){const c=workerRoleCategory(w); return c==='technician'?'technician':c==='guard'?'guard':c==='employee'?'employee':c==='supervisor'?'supervisor':'worker';}
  function monthBounds(m){const start=S(m||todayMonth())+'-01'; const d=new Date(start+'T00:00:00'); d.setMonth(d.getMonth()+1); const next=d.toISOString().slice(0,10); const end=new Date(new Date(next+'T00:00:00').getTime()-86400000).toISOString().slice(0,10); return {start,next,end};}
  function workerOverlapsMonth(w,m){const b=monthBounds(m), st=workerStartDate(w)||'1900-01-01', en=workerEndDate(w)||'9999-12-31'; return st<b.next && en>=b.start;}
  function employeeIdentityAliases(x){const out=[]; const add=(kind,v)=>{v=S(v); if(!v)return; const k=kind+':'+norm(v); if(!out.includes(k))out.push(k);}; const code=normalizeWorkerCode(S(x?.worker_employee_code||x?.worker_code||x?.employee_code||x?.code||'')); if(code)add('code',code); [x?.worker_name,x?.worker_display_name,x?.app_name,x?.name,x?.full_name,x?.employee_name,x?.worker_identity,x?.iqama_name].forEach(v=>add('name',v)); return out;}
  function employeeIdentityKey(x){return employeeIdentityAliases(x)[0]||'';}
  function supervisorIdentity(r){const code=normalizeWorkerCode(S(r?.supervisor_employee_code||r?.supervisor_code||'')); const name=S(r?.supervisor_name||r?.supervisor_display_name||''); const sw=(state.allWorkers||state.workers||[]).find(w=>(code&&workerCode(w)===code)||(name&&norm(workerName(w))===norm(name))); const resolvedCode=code||workerCode(sw); const resolvedName=name||workerName(sw)||'بدون مشرف'; return {key:resolvedCode?('code:'+norm(resolvedCode)):(resolvedName!=='بدون مشرف'?'name:'+norm(resolvedName):'unassigned'),code:resolvedCode,name:resolvedName};}
  function attendanceStatus(v){const x=norm(v); if(['absent','غائب','غياب','غ','a'].includes(x))return'absent'; if(['present','حاضر','حضور','ح','p','late','متاخر','متأخر','early_leave','خروج مبكر'].includes(x))return'present'; if(['leave','اجازه','إجازه','اجازة','إجازة','sick','مرضي','مرضى','mission','ماموريه','مأمورية','weekly_off','راحه اسبوعيه','راحة أسبوعية'].includes(x))return'other'; return x||'';}
  function attendanceDateOf(a){return S(a?.attendance_date||a?.work_date||a?.record_date||a?.date||a?.check_in||a?.created_at||'').slice(0,10);}
  function timeText(v){const x=S(v); if(!x)return''; if(/^\d{2}:\d{2}/.test(x))return x.slice(0,5); const m=x.match(/T(\d{2}:\d{2})/); return m?m[1]:x.slice(0,16).replace('T',' ');}
  function attendanceInOf(a){return S(a?.check_in_time||a?.check_in||a?.in_time||a?.start_time||a?.login_time||'');}
  function attendanceOutOf(a){return S(a?.check_out_time||a?.check_out||a?.out_time||a?.end_time||a?.logout_time||'');}
  function attendanceStamp(a){const raw=S(a?.updated_at||a?.created_at||a?.attendance_date||''); const ms=Date.parse(raw); return Number.isFinite(ms)?ms:N(a?.id);}
  function dateTimeLabel(date,val){const t=timeText(val); return date?(date+(t?' '+t:'')):(t||'');}
  async function fetchPagedRows(table, configure){const c=client(); if(!c)throw new Error('الاتصال بقاعدة البيانات غير جاهز.'); const out=[]; let start=0; const size=1000; while(start<100000){let q=c.from(table).select('*'); q=configure(q); q=q.range(start,start+size-1); const r=await q; if(r.error)throw r.error; const rows=r.data||[]; out.push(...rows); if(rows.length<size)break; start+=size;} return out;}
  function buildEmployeeAttendanceStats(attendanceRows){
    const all=state.allWorkers||state.workers||[];
    const byKey=new Map();
    (attendanceRows||[]).forEach(a=>{
      let aliases=employeeIdentityAliases(a);
      if(a?.worker_id){const w=all.find(x=>S(x.id)===S(a.worker_id)); if(w)aliases=[...new Set([...aliases,...employeeIdentityAliases(w)])];}
      if(!aliases.length)return; const date=attendanceDateOf(a); if(!date)return;
      aliases.forEach(key=>{if(!byKey.has(key))byKey.set(key,new Map()); const dm=byKey.get(key), old=dm.get(date); if(!old||attendanceStamp(a)>=attendanceStamp(old))dm.set(date,a);});
    });
    const result=new Map();
    byKey.forEach((dm,key)=>{const records=[...dm.values()].sort((a,b)=>attendanceDateOf(a).localeCompare(attendanceDateOf(b))); let present=0,absent=0,other=0; const ins=[],outs=[]; records.forEach(a=>{const st=attendanceStatus(a.status||a.attendance_status||a.state); if(st==='present')present++; else if(st==='absent')absent++; else if(st)other++; const d=attendanceDateOf(a); if(attendanceInOf(a))ins.push({d,v:attendanceInOf(a)}); if(attendanceOutOf(a))outs.push({d,v:attendanceOutOf(a)});}); const first=records[0],last=records[records.length-1]; result.set(key,{present,absent,other,firstAttendance:first?attendanceDateOf(first):'',lastAttendance:last?attendanceDateOf(last):'',firstIn:ins.length?dateTimeLabel(ins[0].d,ins[0].v):(first?attendanceDateOf(first):''),lastOut:outs.length?dateTimeLabel(outs[outs.length-1].d,outs[outs.length-1].v):(last?attendanceDateOf(last):'')});});
    return result;
  }
  function styleXlsxRow(ws,row,startCol,endCol,style){if(!window.XLSX)return; for(let c=startCol;c<=endCol;c++){const addr=XLSX.utils.encode_cell({r:row,c}); if(!ws[addr])ws[addr]={t:'s',v:''}; ws[addr].s=style;}}
  function setXlsxNumberFormat(ws,row,col,fmt){const addr=XLSX.utils.encode_cell({r:row,c:col}); if(ws[addr])ws[addr].z=fmt;}
  function buildSupervisorEmployeeWorkbook(month,detailRows){
    if(!window.XLSX)throw new Error('مكتبة Excel غير محملة. أعد تحميل الصفحة ثم حاول مرة أخرى.');
    const headers=['م','المشرف','الفئة','الكود','اسم الموظف','اسم الإقامة','رقم الإقامة','الحالة','المشروع / المشاريع','الراتب الأساسي','البدلات','إجمالي الراتب','تاريخ بداية العمل','تاريخ نهاية العمل','أول حضور / دخول بالشهر','آخر حضور / خروج بالشهر','أيام الحضور','أيام الغياب','إجازات / أخرى'];
    const roleOrder=['worker','technician','guard','employee']; const roleTitles={worker:'العمال',technician:'الفنيون',guard:'الحراس',employee:'الموظفون'};
    const groups=new Map(); detailRows.forEach(r=>{const k=r.supervisorKey||'unassigned'; if(!groups.has(k))groups.set(k,{name:r.supervisorName||'بدون مشرف',rows:[]}); groups.get(k).rows.push(r);});
    const ordered=[...groups.values()].sort((a,b)=>{if(a.name==='بدون مشرف')return 1;if(b.name==='بدون مشرف')return-1;return a.name.localeCompare(b.name,'ar');});
    const aoa=[['شركة تصنيف لإدارة المرافق'],['كشف الموظفين مرتب حسب المشرف والفئة'],['الشهر',month,'تاريخ التنزيل',new Date().toLocaleString('en-GB',{timeZone:'Asia/Riyadh'})],[]]; const merges=[{s:{r:0,c:0},e:{r:0,c:headers.length-1}},{s:{r:1,c:0},e:{r:1,c:headers.length-1}}]; const supRows=[],catRows=[],headerRows=[],moneyRows=[]; let seq=1;
    ordered.forEach(g=>{const sr=aoa.length; supRows.push(sr); aoa.push([`المشرف: ${g.name} | العدد: ${g.rows.length}`]); merges.push({s:{r:sr,c:0},e:{r:sr,c:headers.length-1}}); roleOrder.forEach(role=>{const rows=g.rows.filter(r=>r.roleGroup===role).sort((a,b)=>a.name.localeCompare(b.name,'ar')); if(!rows.length)return; const cr=aoa.length; catRows.push(cr); aoa.push([`${roleTitles[role]} (${rows.length})`]); merges.push({s:{r:cr,c:0},e:{r:cr,c:headers.length-1}}); headerRows.push(aoa.length); aoa.push(headers); rows.forEach(r=>{const rr=aoa.length; moneyRows.push(rr); aoa.push([seq++,g.name,r.roleLabel,r.code,r.name,r.iqamaName,r.iqamaNumber,r.status,r.projects.join('، '),r.basic,r.allowances,r.total,r.workStart,r.workEnd,r.firstIn,r.lastOut,r.present,r.absent,r.other]);}); aoa.push([]);});});
    const ws=XLSX.utils.aoa_to_sheet(aoa); ws['!merges']=merges; ws['!cols']=[{wch:6},{wch:24},{wch:12},{wch:13},{wch:24},{wch:24},{wch:16},{wch:11},{wch:30},{wch:14},{wch:12},{wch:15},{wch:15},{wch:15},{wch:22},{wch:22},{wch:12},{wch:11},{wch:12}]; ws['!rows']=[{hpt:28},{hpt:24},{hpt:20}];
    const border={top:{style:'thin',color:{rgb:'DCE6E2'}},bottom:{style:'thin',color:{rgb:'DCE6E2'}},left:{style:'thin',color:{rgb:'DCE6E2'}},right:{style:'thin',color:{rgb:'DCE6E2'}}};
    styleXlsxRow(ws,0,0,headers.length-1,{fill:{fgColor:{rgb:'084F40'}},font:{bold:true,color:{rgb:'FFFFFF'},sz:16},alignment:{horizontal:'center',vertical:'center'}}); styleXlsxRow(ws,1,0,headers.length-1,{fill:{fgColor:{rgb:'126A58'}},font:{bold:true,color:{rgb:'FFFFFF'},sz:13},alignment:{horizontal:'center'}}); supRows.forEach(r=>styleXlsxRow(ws,r,0,headers.length-1,{fill:{fgColor:{rgb:'D7EEE6'}},font:{bold:true,color:{rgb:'084F40'},sz:12},alignment:{horizontal:'right'},border})); catRows.forEach(r=>styleXlsxRow(ws,r,0,headers.length-1,{fill:{fgColor:{rgb:'EEF8F5'}},font:{bold:true,color:{rgb:'0A4033'}},alignment:{horizontal:'right'},border})); headerRows.forEach(r=>styleXlsxRow(ws,r,0,headers.length-1,{fill:{fgColor:{rgb:'0A4033'}},font:{bold:true,color:{rgb:'FFFFFF'}},alignment:{horizontal:'center',vertical:'center',wrapText:true},border})); moneyRows.forEach(r=>{styleXlsxRow(ws,r,0,headers.length-1,{alignment:{horizontal:'right',vertical:'center',wrapText:true},border}); [9,10,11].forEach(c=>setXlsxNumberFormat(ws,r,c,'#,##0.00')); [16,17,18].forEach(c=>setXlsxNumberFormat(ws,r,c,'0'));});
    const flat=[headers,...detailRows.map((r,i)=>[i+1,r.supervisorName,r.roleLabel,r.code,r.name,r.iqamaName,r.iqamaNumber,r.status,r.projects.join('، '),r.basic,r.allowances,r.total,r.workStart,r.workEnd,r.firstIn,r.lastOut,r.present,r.absent,r.other])]; const ws2=XLSX.utils.aoa_to_sheet(flat); ws2['!cols']=ws['!cols']; ws2['!autofilter']={ref:`A1:${XLSX.utils.encode_col(headers.length-1)}${flat.length}`}; styleXlsxRow(ws2,0,0,headers.length-1,{fill:{fgColor:{rgb:'0A4033'}},font:{bold:true,color:{rgb:'FFFFFF'}},alignment:{horizontal:'center',wrapText:true},border}); for(let r=1;r<flat.length;r++){styleXlsxRow(ws2,r,0,headers.length-1,{alignment:{horizontal:'right',wrapText:true},border}); [9,10,11].forEach(c=>setXlsxNumberFormat(ws2,r,c,'#,##0.00'));}
    const sumHeaders=['المشرف','العمال','الفنيون','الحراس','الموظفون','الإجمالي','إجمالي الرواتب','أيام الحضور','أيام الغياب','إجازات / أخرى']; const sumRows=ordered.map(g=>{const x={worker:0,technician:0,guard:0,employee:0}; g.rows.forEach(r=>x[r.roleGroup]=(x[r.roleGroup]||0)+1); return [g.name,x.worker,x.technician,x.guard,x.employee,g.rows.length,g.rows.reduce((a,r)=>a+r.total,0),g.rows.reduce((a,r)=>a+r.present,0),g.rows.reduce((a,r)=>a+r.absent,0),g.rows.reduce((a,r)=>a+r.other,0)];}); const totals=['الإجمالي',...Array(4).fill(0),detailRows.length,detailRows.reduce((a,r)=>a+r.total,0),detailRows.reduce((a,r)=>a+r.present,0),detailRows.reduce((a,r)=>a+r.absent,0),detailRows.reduce((a,r)=>a+r.other,0)]; for(let i=1;i<=4;i++)totals[i]=sumRows.reduce((a,r)=>a+N(r[i]),0); const ws3=XLSX.utils.aoa_to_sheet([sumHeaders,...sumRows,totals]); ws3['!cols']=[{wch:26},{wch:11},{wch:11},{wch:11},{wch:11},{wch:11},{wch:17},{wch:13},{wch:13},{wch:13}]; ws3['!autofilter']={ref:`A1:J${sumRows.length+2}`}; styleXlsxRow(ws3,0,0,9,{fill:{fgColor:{rgb:'0A4033'}},font:{bold:true,color:{rgb:'FFFFFF'}},alignment:{horizontal:'center'},border}); styleXlsxRow(ws3,sumRows.length+1,0,9,{fill:{fgColor:{rgb:'D7EEE6'}},font:{bold:true,color:{rgb:'084F40'}},alignment:{horizontal:'right'},border}); for(let r=1;r<sumRows.length+2;r++){styleXlsxRow(ws3,r,0,9,{alignment:{horizontal:'right'},border}); setXlsxNumberFormat(ws3,r,6,'#,##0.00');}
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'حسب المشرف'); XLSX.utils.book_append_sheet(wb,ws2,'بيانات كاملة'); XLSX.utils.book_append_sheet(wb,ws3,'ملخص'); wb.Workbook={Views:[{RTL:true}]}; return wb;
  }
  async function exportSupervisorEmployeesExcel(){
    const btn=$('cu413ExportWorkersExcel'); if(btn?.disabled)return; const original=btn?.textContent||'تنزيل Excel مرتب';
    try{if(!window.XLSX)throw new Error('مكتبة Excel غير متاحة. أعد تحميل الصفحة.'); const month=S($('cu413WorkerExportMonth')?.value||$('cu413Month')?.value||todayMonth()).slice(0,7); if(!/^\d{4}-\d{2}$/.test(month))throw new Error('اختر شهرًا صحيحًا.'); if(btn){btn.disabled=true;btn.textContent='جاري تجهيز Excel...';} showMsg('جاري قراءة التوزيع والحضور وتجهيز ملف Excel...'); await loadWorkers(false); const b=monthBounds(month); const [distRows,attendanceRows]=await Promise.all([fetchPagedRows('monthly_distribution',q=>q.eq('month_key',month).order('supervisor_name',{ascending:true})),fetchPagedRows('attendance',q=>q.gte('attendance_date',b.start).lt('attendance_date',b.next).order('attendance_date',{ascending:true}))]);
      const assignments=new Map(); (distRows||[]).filter(r=>statusActive(r)).forEach(r=>{const aliases=employeeIdentityAliases(r); if(!aliases.length)return; const shared={supervisors:new Map(),projects:new Set()}; const existing=aliases.map(k=>assignments.get(k)).find(Boolean); const a=existing||shared; aliases.forEach(k=>assignments.set(k,a)); const sup=supervisorIdentity(r); if(!a.supervisors.has(sup.key))a.supervisors.set(sup.key,{...sup,count:0}); a.supervisors.get(sup.key).count++; const pn=S(r.project_name||r.project_display_name||''); if(pn)a.projects.add(pn);});
      const attStats=buildEmployeeAttendanceStats(attendanceRows); const source=(state.allWorkers&&state.allWorkers.length?state.allWorkers:state.workers).filter(w=>!statusDeleted(w)&&!isSupervisor(w)&&workerOverlapsMonth(w,month)); const seen=new Set(), details=[]; source.forEach(w=>{const aliases=employeeIdentityAliases(w), key=aliases[0]||''; if(!key||seen.has(key))return; seen.add(key); const asg=aliases.map(k=>assignments.get(k)).find(Boolean); let sup={key:'unassigned',name:'بدون مشرف',code:''}; if(asg?.supervisors?.size)sup=[...asg.supervisors.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'ar'))[0]; else {const sc=normalizeWorkerCode(S(w.supervisor_employee_code||w.supervisor_code||w.supervisor_id||'')), sn=S(w.supervisor_name||''); const sw=(state.allWorkers||state.workers||[]).find(x=>workerCode(x)===sc||norm(workerName(x))===norm(sn)); if(sc||sn||sw)sup={key:sc?('code:'+norm(sc)):('name:'+norm(sn||workerName(sw))),code:sc||workerCode(sw),name:sn||workerName(sw)||'بدون مشرف'};} const st=aliases.map(k=>attStats.get(k)).find(Boolean)||{present:0,absent:0,other:0,firstIn:'',lastOut:''}; details.push({supervisorKey:sup.key,supervisorName:sup.name||'بدون مشرف',roleGroup:exportRoleGroup(w),roleLabel:exportRoleLabel(w),code:workerCode(w),name:workerName(w),iqamaName:S(w.iqama_name||w.residency_name||''),iqamaNumber:S(w.iqama_number||w.national_id||w.residency_number||''),status:statusActive(w)?'نشط':'موقوف',projects:[...(asg?.projects||[])],basic:workerBasicSalary(w),allowances:workerAllowances(w),total:workerTotalSalary(w),workStart:workerStartDate(w),workEnd:workerEndDate(w),firstIn:st.firstIn||'',lastOut:st.lastOut||'',present:N(st.present),absent:N(st.absent),other:N(st.other)});});
      if(!details.length)throw new Error('لا يوجد موظفون ضمن فترة الشهر المحدد.'); details.sort((a,b)=>a.supervisorName.localeCompare(b.supervisorName,'ar')||(['worker','technician','guard','employee'].indexOf(a.roleGroup)-['worker','technician','guard','employee'].indexOf(b.roleGroup))||a.name.localeCompare(b.name,'ar')); const wb=buildSupervisorEmployeeWorkbook(month,details); XLSX.writeFile(wb,`tasneef_employees_by_supervisor_${month}.xlsx`,{cellStyles:true,compression:true}); showMsg(`تم تنزيل Excel لشهر ${month}: ${details.length} موظف، مرتب حسب المشرف ثم العمال والفنيين والحراس.`);
    }catch(e){console.error('Unified employee Excel V10803',e); showMsg('تعذر تنزيل Excel: '+(e?.message||e),true);} finally{if(btn){btn.disabled=false;btn.textContent=original;}}
  }
  function printWorkersFiltered(){
    const rows=filteredWorkers();
    const roleLabel=$('cu413WorkerRoleFilter')?.selectedOptions?.[0]?.textContent||'كل الفئات';
    const statusLabel=$('cu413WorkerStatusFilter')?.selectedOptions?.[0]?.textContent||'كل الحالات';
    const q=S($('cu413WorkerSearch')?.value||'');
    const money=v=>Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    const totalBasic=rows.reduce((sum,w)=>sum+workerBasicSalary(w),0);
    const totalAllowance=rows.reduce((sum,w)=>sum+workerAllowances(w),0);
    const totalSalary=rows.reduce((sum,w)=>sum+workerTotalSalary(w),0);
    const body=rows.map((w,i)=>`<tr><td>${i+1}</td><td>${esc(workerCode(w)||'-')}</td><td>${esc(workerName(w)||'-')}</td><td>${esc(workerRole(w)||'-')}</td><td>${esc(S(w.iqama_number||w.national_id||'-'))}</td><td>${statusActive(w)?'نشط':'موقوف'}</td><td>${esc(workerStartDate(w)||'-')}</td><td>${esc(workerEndDate(w)||'-')}</td><td>${money(workerBasicSalary(w))}</td><td>${money(workerAllowances(w))}</td><td><b>${money(workerTotalSalary(w))}</b></td></tr>`).join('');
    const win=window.open('','_blank','width=1350,height=850');
    if(!win){showMsg('اسمح بالنوافذ المنبثقة لإتمام الطباعة.',true);return;}
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>طباعة العمال والموظفين</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,Tahoma,sans-serif;padding:18px;color:#10251f}h1{margin:0 0 8px;color:#084f40}.meta{margin:0 0 14px;color:#475b54}.count{font-weight:700;margin-bottom:12px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0 0 14px}.summary div{border:1px solid #cfdcd7;border-radius:10px;padding:10px;background:#f6faf8}.summary small{display:block;color:#60706a;margin-bottom:5px}.summary b{font-size:16px;color:#084f40}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #cfdcd7;padding:7px;text-align:right;white-space:nowrap}th{background:#084f40;color:#fff}tfoot td{background:#eef6f2;font-weight:700}@media print{body{padding:0}.summary div{-webkit-print-color-adjust:exact;print-color-adjust:exact}th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><h1>شركة تصنيف لإدارة المرافق</h1><div class="meta">كشف العمال والموظفين حسب الفلتر</div><div class="count">الفئة: ${esc(roleLabel)} | الحالة: ${esc(statusLabel)}${q?' | البحث: '+esc(q):''} | عدد النتائج: ${rows.length}</div><div class="summary"><div><small>عدد النتائج</small><b>${rows.length}</b></div><div><small>إجمالي الرواتب الأساسية</small><b>${money(totalBasic)} ر.س</b></div><div><small>إجمالي البدلات</small><b>${money(totalAllowance)} ر.س</b></div><div><small>إجمالي الرواتب</small><b>${money(totalSalary)} ر.س</b></div></div><table><thead><tr><th>#</th><th>الكود</th><th>الاسم</th><th>الفئة</th><th>رقم الإقامة</th><th>الحالة</th><th>بداية العمل</th><th>نهاية العمل</th><th>الراتب الأساسي</th><th>البدلات</th><th>إجمالي الراتب</th></tr></thead><tbody>${body||'<tr><td colspan="11">لا توجد نتائج مطابقة</td></tr>'}</tbody><tfoot><tr><td colspan="8">الإجمالي حسب الفلتر</td><td>${money(totalBasic)}</td><td>${money(totalAllowance)}</td><td>${money(totalSalary)}</td></tr></tfoot></table><script>window.onload=()=>{window.print();}<\/script></body></html>`);
    win.document.close();
  }
  function renderWorkersTab(){
    const box=$('cu413WorkersTab'); if(!box) return;
    const searchValue=S($('cu413WorkerSearch')?.value||'');
    const roleValue=S($('cu413WorkerRoleFilter')?.value||'');
    const statusValue=S($('cu413WorkerStatusFilter')?.value||'');
    const exportMonthValue=S($('cu413WorkerExportMonth')?.value||$('cu413Month')?.value||todayMonth());
    const workerRows=(state.allWorkers&&state.allWorkers.length?state.allWorkers:state.workers).filter(w=>!statusDeleted(w));
    const rows=filteredWorkers();
    box.innerHTML=`<div class="cu413-grid"><div class="cu413-card"><h3>إضافة / تعديل عامل أو موظف</h3><div class="cu413-form"><input type="hidden" id="cu413WEditMode"><label>كود العامل</label><div class="cu413-two"><input id="cu413WCode" placeholder="يتولد تلقائيًا مثل TS-71"><button type="button" class="light" onclick="tasneefCoreUnifiedV413.fillNextWorkerCode()">توليد الكود</button></div><label>اسم العامل في التطبيق</label><input id="cu413WName" placeholder="اسم العامل"><label>الوظيفة</label><select id="cu413WRole"><option>عامل</option><option>مشرف</option><option>فني</option><option>حارس</option><option>موظف</option></select><label>رقم الإقامة</label><input id="cu413WIqama"><label>الحالة</label><select id="cu413WStatus"><option value="active">نشط</option><option value="inactive">موقوف</option></select><div class="cu413-two"><div><label>تاريخ بداية العمل</label><input id="cu413WStartDate" type="date"></div><div><label>تاريخ نهاية العمل</label><input id="cu413WEndDate" type="date"></div></div><div class="cu413-two"><div><label>الراتب الأساسي</label><input id="cu413WSalary" type="number" oninput="tasneefCoreUnifiedV413.calcWorkerTotal()"></div><div><label>البدلات</label><input id="cu413WAllowance" type="number" oninput="tasneefCoreUnifiedV413.calcWorkerTotal()"></div></div><label>الإجمالي</label><input id="cu413WTotal" type="number" readonly><div class="cu413-two"><button type="button" onclick="tasneefCoreUnifiedV413.saveWorker()">حفظ العامل</button><button type="button" class="light" onclick="tasneefCoreUnifiedV413.clearWorkerForm()">تفريغ</button></div></div></div><div class="cu413-card"><h3>قائمة العمال والموظفين</h3><div class="cu413-workers-filters"><input id="cu413WorkerSearch" placeholder="بحث بالاسم أو الكود أو الإقامة" value="${esc(searchValue)}"><select id="cu413WorkerRoleFilter"><option value="">كل الفئات</option><option value="supervisor" ${roleValue==='supervisor'?'selected':''}>مشرف</option><option value="technician" ${roleValue==='technician'?'selected':''}>فني</option><option value="employee" ${roleValue==='employee'?'selected':''}>موظف</option><option value="guard" ${roleValue==='guard'?'selected':''}>حارس</option><option value="worker" ${roleValue==='worker'?'selected':''}>عامل</option></select><select id="cu413WorkerStatusFilter"><option value="">كل الحالات</option><option value="active" ${statusValue==='active'?'selected':''}>نشط</option><option value="inactive" ${statusValue==='inactive'?'selected':''}>موقوف</option></select><input type="month" id="cu413WorkerExportMonth" value="${esc(exportMonthValue)}" title="شهر الحضور والغياب"><button type="button" class="light" onclick="tasneefCoreUnifiedV413.printWorkersFiltered()">طباعة حسب الفلتر</button><button type="button" id="cu413ExportWorkersExcel" onclick="tasneefCoreUnifiedV413.exportSupervisorEmployeesExcel()">تنزيل Excel مرتب</button></div><div class="cu413-kpis"><div class="cu413-kpi"><small>الإجمالي</small><b>${workerRows.length}</b></div><div class="cu413-kpi"><small>نشط</small><b>${workerRows.filter(statusActive).length}</b></div><div class="cu413-kpi"><small>موقوف</small><b>${workerRows.filter(w=>!statusActive(w)).length}</b></div><div class="cu413-kpi"><small>المعروض</small><b>${rows.length}</b></div></div><div class="cu413-list">${rows.map(w=>`<div class="cu413-row"><div><b>${esc(workerDisplay(w))}</b><small>${esc(workerRole(w))} <span class="cu458-status ${statusActive(w)?'cu458-on':'cu458-off'}">${statusActive(w)?'نشط':'موقوف'}</span></small><small>بداية العمل: ${esc(workerStartDate(w)||'-')} | نهاية العمل: ${esc(workerEndDate(w)||'-')}</small><small>الراتب الأساسي: ${workerBasicSalary(w).toLocaleString('en-US')} | البدلات: ${workerAllowances(w).toLocaleString('en-US')} | الإجمالي: ${workerTotalSalary(w).toLocaleString('en-US')}</small></div><div style="display:flex;gap:6px;align-items:center"><small>${esc(S(w.iqama_number||w.national_id||''))}</small><button type="button" class="light" onclick="tasneefCoreUnifiedV413.editWorker('${esc(workerCode(w))}')">تعديل</button></div></div>`).join('')||'<div class="cu413-row">لا توجد بيانات</div>'}</div></div></div>`;
    $('cu413WorkerSearch')?.addEventListener('input', renderWorkersTab);
    $('cu413WorkerRoleFilter')?.addEventListener('change', renderWorkersTab);
    $('cu413WorkerStatusFilter')?.addEventListener('change', renderWorkersTab);
    fillNextWorkerCode();
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
    const supOptions=state.workers.filter(isSupervisor).filter(statusActive).map(w=>`<option value="${esc(workerCode(w))}">${esc(workerDisplay(w))}</option>`).join('');
    box.innerHTML=`<div class="cu413-grid"><div class="cu413-card"><h3>إضافة / تعديل مشروع</h3><div class="cu413-form"><input type="hidden" id="cu413PId"><label>اسم المشروع</label><input id="cu413PName" placeholder="اسم المشروع"><label>نوع المشروع</label><select id="cu413PType"><option value="daily_visit">زيارة يومية</option><option value="full_time">دوام كامل</option></select><div class="cu413-two"><div><label>الوقت المطلوب / المستغرق بالدقائق</label><input id="cu413PReq" type="number" placeholder="مثال 480"></div><div><label>المشرف من السيرفر</label><select id="cu413PSupervisor"><option value="">بدون مشرف</option>${supOptions}</select></div></div><div class="cu413-two"><div><label>عدد العمائر</label><input id="cu413PBuildings" type="number" min="0" placeholder="0"></div><div><label>عدد الشقق</label><input id="cu413PUnits" type="number" min="0" placeholder="0"></div></div><div class="cu413-two"><div><label>تاريخ بداية المشروع</label><input id="cu413PStartDate" type="date"></div><div><label>تاريخ نهاية المشروع</label><input id="cu413PEndDate" type="date"></div></div><label>الحالة</label><select id="cu413PStatus"><option value="active">نشط</option><option value="inactive">موقوف</option></select><div class="cu413-two"><button type="button" onclick="tasneefCoreUnifiedV413.saveProject()">حفظ المشروع</button><button type="button" class="light" onclick="tasneefCoreUnifiedV413.clearProjectForm()">تفريغ</button></div></div></div><div class="cu413-card"><h3>قائمة المشاريع + التوزيع</h3><div class="cu413-two"><div><label>شهر عرض التوزيع</label><input type="month" id="cu413ProjectsMonth" value="${esc(m)}"></div><div><label>بحث</label><input id="cu413ProjectSearch" placeholder="بحث باسم المشروع أو المشرف أو العامل" value="${esc($('cu413ProjectSearch')?.value||'')}"></div></div><div class="cu413-kpis"><div class="cu413-kpi"><small>الإجمالي</small><b>${state.projects.length}</b></div><div class="cu413-kpi"><small>النشطة</small><b>${state.projects.filter(statusActive).length}</b></div><div class="cu413-kpi"><small>الموقوفة</small><b>${state.projects.filter(p=>!statusActive(p)).length}</b></div><div class="cu413-kpi"><small>المعروض</small><b>${rows.length}</b></div></div><div class="cu413-list">${rows.map(p=>{const d=projectDistributionSummary(p); return `<div class="cu413-row"><div style="flex:1"><b>${esc(projectName(p))}</b> <span class="cu413-chip" style="${statusActive(p)?'':'background:#fdeaea;border-color:#efc3c3;color:#9d2222'}">${projectStatusLabel(p)}</span><small>${esc(projectType(p))} | الوقت: ${projectRequired(p).toLocaleString('en-US')} د | العمائر: ${projectBuildings(p)} | الشقق: ${projectUnits(p)}</small><small>بداية المشروع: ${esc(projectStartDate(p)||'-')} | نهاية المشروع: ${esc(projectEndDate(p)||'-')}</small><small>المشرف الافتراضي في المشروع: ${esc(projectSupervisorName(p))}</small><small><b>توزيع شهر ${esc(d.month)}:</b> المشرف: ${esc(d.sup.join('، ')||'-')} | عدد العمال: ${d.workers.length}</small><div>${d.workers.slice(0,8).map(w=>`<span class="cu413-chip">${esc(w)}</span>`).join('')}${d.workers.length>8?`<span class="cu413-chip">+${d.workers.length-8}</span>`:''}</div></div><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end"><small>${esc(projectId(p))}</small><button type="button" class="light" onclick="tasneefCoreUnifiedV413.editProject('${esc(projectId(p))}')">تعديل المشروع</button>${statusActive(p)?`<button type="button" class="light" onclick="tasneefCoreUnifiedV413.openProjectDistribution('${esc(projectId(p))}')">تعديل التوزيع</button>`:`<small class="cu413-chip" style="background:#fdeaea;border-color:#efc3c3;color:#9d2222">موقوف عن التوزيع</small>`}</div></div>`}).join('')||'<div class="cu413-row">لا توجد مشاريع</div>'}</div></div></div>`;
    $('cu413ProjectSearch')?.addEventListener('input', renderProjectsTab);
    $('cu413ProjectsMonth')?.addEventListener('change', refreshProjectsMonthDistribution);
  }
  function fillSelects(){
    const month=$('cu413Month'); if(month&&!month.value) month.value=todayMonth();
    const sup=$('cu413Sup'), pr=$('cu413Project');
    if(sup){const cur=sup.value; const sups=state.workers.filter(isSupervisor); sup.innerHTML='<option value="">اختر المشرف</option>'+sups.map(w=>`<option value="${esc(workerCode(w))}">${esc(workerDisplay(w))}</option>`).join(''); sup.value=cur;}
    if(pr){const cur=pr.value; pr.innerHTML='<option value="">اختر المشروع</option>'+state.projects.filter(statusActive).map(p=>`<option value="${esc(projectId(p))}">${esc(projectName(p))} - ${esc(projectType(p))}</option>`).join(''); pr.value=cur;}
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
    const selectedStatus=S($('cu413WStatus')?.value||'active'); const isNowActive=selectedStatus==='active'; const row={employee_code:code, app_name:name, job_title:S($('cu413WRole')?.value||'عامل'), iqama_number:S($('cu413WIqama')?.value||''), work_start_date:S($('cu413WStartDate')?.value||'')||null, work_end_date:isNowActive?null:(S($('cu413WEndDate')?.value||'')||null), basic_salary:N($('cu413WSalary')?.value), allowances:N($('cu413WAllowance')?.value), total_salary:N($('cu413WSalary')?.value)+N($('cu413WAllowance')?.value), status:selectedStatus, state:selectedStatus, is_active:isNowActive, active:isNowActive};
    let r=await c.from('employees_master_v386').upsert(row,{onConflict:'employee_code'}).select();
    if(r.error){ r=await c.from('workers').insert({name:name, employee_code:code, basic_salary:N($('cu413WSalary')?.value), allowances:N($('cu413WAllowance')?.value), total_salary:N($('cu413WSalary')?.value)+N($('cu413WAllowance')?.value), status:selectedStatus, state:selectedStatus, is_active:isNowActive, active:isNowActive}).select(); }
    // تحديث جداول قديمة إن وجدت بدون تعطيل الحفظ الرئيسي.
    await safe('workers-update-code', c.from('workers').update({status:selectedStatus, state:selectedStatus, is_active:isNowActive, active:isNowActive, basic_salary:N($('cu413WSalary')?.value), allowances:N($('cu413WAllowance')?.value), total_salary:N($('cu413WSalary')?.value)+N($('cu413WAllowance')?.value)}).eq('employee_code',code));
    await safe('workers-update-name', c.from('workers').update({status:selectedStatus, state:selectedStatus, is_active:isNowActive, active:isNowActive, basic_salary:N($('cu413WSalary')?.value), allowances:N($('cu413WAllowance')?.value), total_salary:N($('cu413WSalary')?.value)+N($('cu413WAllowance')?.value)}).eq('name',name));
    if(r.error){showMsg('تعذر حفظ العامل: '+r.error.message,true);return;} state.workers=[]; state.allWorkers=[]; await reload(true); clearWorkerForm(); showMsg('تم حفظ العامل.');
  }
  function clearWorkerForm(){['cu413WEditMode','cu413WCode','cu413WName','cu413WIqama','cu413WStartDate','cu413WEndDate','cu413WSalary','cu413WAllowance','cu413WTotal'].forEach(id=>{const el=$(id); if(el) el.value='';}); const r=$('cu413WRole'); if(r) r.value='عامل'; const st=$('cu413WStatus'); if(st) st.value='active';}
  function editWorker(code){const w=(state.allWorkers||state.workers).find(x=>workerCode(x)===code); if(!w)return; setTab('workers'); setTimeout(()=>{if($('cu413WEditMode')) $('cu413WEditMode').value=code; if($('cu413WCode')) $('cu413WCode').value=workerCode(w); if($('cu413WName')) $('cu413WName').value=workerName(w); if($('cu413WRole')) $('cu413WRole').value=workerRole(w)||'عامل'; if($('cu413WIqama')) $('cu413WIqama').value=S(w.iqama_number||w.national_id||''); if($('cu413WStatus')) $('cu413WStatus').value=statusActive(w)?'active':'inactive'; if($('cu413WStartDate')) $('cu413WStartDate').value=workerStartDate(w); if($('cu413WEndDate')) $('cu413WEndDate').value=workerEndDate(w); if($('cu413WSalary')) $('cu413WSalary').value=workerBasicSalary(w)||''; if($('cu413WAllowance')) $('cu413WAllowance').value=workerAllowances(w)||''; calcWorkerTotal();},60);}
  function clearProjectForm(){['cu413PId','cu413PName','cu413PReq','cu413PBuildings','cu413PUnits','cu413PStartDate','cu413PEndDate'].forEach(id=>{const el=$(id); if(el) el.value='';}); const t=$('cu413PType'); if(t)t.value='daily_visit'; const s=$('cu413PStatus'); if(s)s.value='active'; const sp=$('cu413PSupervisor'); if(sp)sp.value='';}
  function editProject(pid){const p=state.projects.find(x=>projectId(x)===S(pid)); if(!p)return; setTab('projects'); setTimeout(()=>{if($('cu413PId')) $('cu413PId').value=projectId(p); if($('cu413PName')) $('cu413PName').value=projectName(p); if($('cu413PType')) $('cu413PType').value=(projectType(p)==='دوام كامل'?'full_time':'daily_visit'); if($('cu413PReq')) $('cu413PReq').value=projectRequired(p)||''; if($('cu413PBuildings')) $('cu413PBuildings').value=projectBuildings(p)||''; if($('cu413PUnits')) $('cu413PUnits').value=projectUnits(p)||''; if($('cu413PStartDate')) $('cu413PStartDate').value=projectStartDate(p)||''; if($('cu413PEndDate')) $('cu413PEndDate').value=projectEndDate(p)||''; if($('cu413PStatus')) $('cu413PStatus').value=S(p.status||p.state||'active'); if($('cu413PSupervisor')) $('cu413PSupervisor').value=projectSupervisorCode(p);},60);}
  function editDistribution(pid){setTab('distribution'); setTimeout(()=>{state.selectedProjects.clear(); state.selectedProjects.add(S(pid)); renderPickProjects(); hydrateProjectSelection(); const m=$('cu413Month')?.value||todayMonth(); const rows=(state.dist[m]||[]).filter(r=>S(r.project_id)===S(pid)); const first=rows[0]||{}; const sup=$('cu413Sup'); if(sup) sup.value=S(first.supervisor_employee_code||''); renderSelected();},80);}
  async function saveProject(){
    const c=client(); if(!c)return; const name=S($('cu413PName')?.value); if(!name){showMsg('أدخل اسم المشروع.',true);return;}
    const pid=S($('cu413PId')?.value||'');
    const pStart=S($('cu413PStartDate')?.value||'')||null, pEnd=S($('cu413PEndDate')?.value||'')||null;
    const supCode=S($('cu413PSupervisor')?.value||'');
    const supWorker=(state.workers||[]).find(x=>workerCode(x)===supCode)||null;
    const supName=supWorker?workerName(supWorker):'';
    let supUserId=null;
    try{
      const ur=await c.from('app_users').select('id,full_name,username,employee_code,role').limit(5000);
      const users=ur.data||[];
      const hit=users.find(u=>S(u.employee_code)===supCode || (supName && norm(u.full_name||u.username)===norm(supName)));
      if(hit) supUserId=hit.id;
    }catch(_){ }
    const row={name, operation_type:S($('cu413PType')?.value||'daily_visit'), required_daily_minutes:N($('cu413PReq')?.value), status:S($('cu413PStatus')?.value||'active'), state:S($('cu413PStatus')?.value||'active'), is_active:S($('cu413PStatus')?.value||'active')==='active', active:S($('cu413PStatus')?.value||'active')==='active', supervisor_employee_code:supCode||null, supervisor_name:supName||null, supervisor_id:supUserId, current_supervisor_id:supUserId, app_supervisor_id:supUserId, buildings_count:N($('cu413PBuildings')?.value), units_count:N($('cu413PUnits')?.value), project_start_date:pStart, project_end_date:pEnd, contract_start:pStart, contract_end:pEnd, start_date:pStart, end_date:pEnd, updated_at:new Date().toISOString()};
    let r;
    if(pid) r=await c.from('projects').update(row).eq('id',pid).select(); else r=await c.from('projects').insert(row).select();
    if(r.error){showMsg('تعذر حفظ المشروع: '+r.error.message,true);return;}
    const savedPid=pid||S((r.data||[])[0]?.id||'');
    if(savedPid){
      const m=todayMonth();
      await safe('sync monthly distribution supervisor',c.from('monthly_distribution').update({supervisor_employee_code:supCode||null,supervisor_name:supName||null,supervisor_id:supUserId,updated_at:new Date().toISOString()}).eq('month_key',m).eq('project_id',savedPid).neq('status','ended'));
      await safe('sync project monthly settings supervisor',c.from('project_monthly_settings_v387').update({supervisor_id:supUserId||supCode||null,supervisor_name:supName||null,updated_at:new Date().toISOString()}).eq('month_key',m).eq('project_id',savedPid));
    }
    state.projects=[]; state.dist={}; await reload(true); clearProjectForm(); showMsg('تم حفظ المشروع ونقله للمشرف الجديد وتحديث التوزيع الحالي.');
  }
  async function saveQuickDistribution(){
    const c=client(); if(!c)return;
    const m=$('cu413Month')?.value||todayMonth(), supCode=$('cu413Sup')?.value;
    const sup=state.workers.find(x=>workerCode(x)===S(supCode));
    const projects=[...state.selectedProjects].map(pid=>state.projects.find(p=>projectId(p)===pid)).filter(Boolean);
    const chosen=[...state.selected.values()];
    if(!m||!sup){showMsg('اختر الشهر والمشرف.',true);return;}
    if(!projects.length){showMsg('اختر مشروعًا واحدًا على الأقل.',true);return;}
    const now=new Date().toISOString(), endDate=new Date().toISOString().slice(0,10);
    for(const p of projects){
      const pid=projectId(p);
      const existing=await safe('existing distribution',c.from('monthly_distribution').select('id,worker_employee_code,status').eq('month_key',m).eq('project_id',pid).limit(10000));
      const chosenCodes=new Set(chosen.map(workerCode));
      const removed=(existing.data||[]).filter(x=>!chosenCodes.has(S(x.worker_employee_code)) && !['ended','inactive','cancelled','منتهي','ملغي'].includes(S(x.status).toLowerCase()));
      if(removed.length){
        const ids=removed.map(x=>x.id).filter(Boolean);
        if(ids.length) await safe('end removed workers',c.from('monthly_distribution').update({status:'ended',end_date:endDate,updated_at:now}).in('id',ids));
      }
    }
    const rows=[], rowKeys=new Set();
    projects.forEach(p=>chosen.forEach(w=>{const key=[m,projectId(p),workerCode(w)].join('|'); if(rowKeys.has(key)) return; rowKeys.add(key); rows.push({month_key:m, supervisor_employee_code:workerCode(sup), supervisor_name:workerName(sup), project_id:projectId(p), project_name:projectName(p), worker_employee_code:workerCode(w), worker_name:workerName(w), role_type:workerRole(w)||'عامل', shift_name:'default', required_minutes:projectRequired(p), start_date:m+'-01', end_date:null, status:'active',updated_at:now});}));
    if(rows.length){
      const r=await c.from('monthly_distribution').upsert(rows,{onConflict:'month_key,project_id,worker_employee_code'}).select();
      if(r.error){showMsg('تعذر حفظ التوزيع: '+r.error.message,true);return;}
    }
    delete state.dist[m]; await loadDistribution(true); await loadBorrowings($('cu413Month')?.value||todayMonth(),true); fillSelects(); renderDistBox(); showMsg(chosen.length?'تم تحديث الربط وإلغاء العمال غير المحددين من السجلات الجديدة.':'تم إلغاء ربط جميع العمال من المشروع لهذا الشهر.');
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
  window.tasneefCoreUnifiedV413={init,reload,saveWorker,fillNextWorkerCode,saveProject,saveDistribution,saveQuickDistribution,copyPreviousMonth,toggleWorker,toggleProject,selectVisibleProjects,selectVisibleWorkers,clearDistributionSelection,printDistribution,printWorkersFiltered,exportSupervisorEmployeesExcel,editWorker,clearWorkerForm,editProject,clearProjectForm,editDistribution,renderWorkersTab,renderProjectsTab,openProjectDistribution,refreshProjectsMonthDistribution,calcWorkerTotal,renderAttendanceTab,refreshAttendance,saveAttendanceRow,setAllAttendanceStatus,saveAllAttendanceRows,renderBorrowingTab,toggleBorrowWorker,saveBorrowing,cancelBorrowing,effectiveDistributionRows};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(init,1200));
  setInterval(installNav,2000);
})();

/* ===================== V458 Smart stop + visible status + no duplicates ===================== */
(function(){
  'use strict';
  const VERSION='V464';
  const S=v=>String(v??'').trim();
  const N=v=>Number(v)||0;
  const $=id=>document.getElementById(id);
  const esc=s=>S(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function norm(v){return S(v).toLowerCase().replace(/[إأآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه').replace(/[ًٌٍَُِّْـ]/g,'').replace(/\s+/g,'').trim();}
  function stopped(x){const st=[x?.status,x?.state,x?.active_status].map(norm).join('|'); return !!(x?.is_active===false||x?.active===false||x?.disabled===true||['inactive','stopped','paused','موقوف','موقف','متوقف','غيرنشط','غيرفعال'].some(a=>st.includes(norm(a))));}
  function deleted(x){const st=[x?.status,x?.state].map(norm).join('|'); return !!(x?.deleted_at||x?.is_deleted===true||st.includes('deleted')||st.includes('archived')||st.includes('محذوف'));}
  function code(w){return S(w?.employee_code||w?.worker_code||w?.code||w?.emp_code||w?.id||'');}
  function name(w){return S(w?.app_name||w?.name||w?.full_name||w?.worker_name||'');}
  function role(w){return S(w?.job_title||w?.role||w?.position||w?.worker_type||'عامل');}
  function isSup(w){return norm(role(w)).includes('مشرف')||norm(role(w)).includes('supervisor');}
  function display(w){const c=code(w), n=name(w); return c&&n&&!n.includes(c)?`${c} - ${n}`:(n||c||'-');}
  function client(){return window.supabaseClient||window.sb||window.supabase||null;}
  function currentMonth(){return $('cu413Month')?.value||$('cu413ProjectsMonth')?.value||new Date().toISOString().slice(0,7);}
  function show(text,bad){try{const el=$('cu413Msg'); if(el){el.textContent=text; el.classList.toggle('err',!!bad);}}catch(_){} if(bad) console.warn(text);}
  function allWorkers(){try{return ((window.tasneefCoreUnifiedV413&&window.__tasneef_core_state&&window.__tasneef_core_state.allWorkers)||[]);}catch(_){return [];}}
  function publicState(){
    // نحاول الوصول إلى الحالة الداخلية عبر إعادة استخدام البيانات الظاهرة في DOM غير ممكن؛ لذلك نخزن نسخة عامة من خلال monkey patch render.
    return window.__tasneefCoreUnifiedStateV458 || {workers:[],allWorkers:[],projects:[]};
  }
  function storeStateFromDOMFallback(){return publicState();}

  function getCoreApi(){return window.tasneefCoreUnifiedV413||{};}
  function activeSupervisors(){
    const st=publicState();
    const list=(st.allWorkers?.length?st.allWorkers:st.workers||[]).filter(w=>!deleted(w)&&!stopped(w)&&isSup(w));
    const m=new Map(); list.forEach(w=>{const c=code(w); if(c&&!m.has(c))m.set(c,w);}); return [...m.values()];
  }
  async function safeUpdate(table,payload,field,value){
    try{const r=await client().from(table).update(payload).eq(field,value).select(); if(r.error) throw r.error; return (r.data||[]).length;}catch(e){console.warn('safeUpdate skipped',table,field,e.message||e); return 0;}
  }
  async function loadAppUsersForTransfer(){
    try{const r=await client().from('app_users').select('*').limit(10000); return r.data||[];}catch(e){console.warn('app_users load skipped',e.message||e); return [];}
  }
  function userMatchScore(u, codeValue, nameValue){
    const c=S(codeValue), n=norm(nameValue);
    const vals=[u?.id,u?.employee_code,u?.worker_code,u?.code,u?.username,u?.email,u?.full_name,u?.name].map(S);
    if(c && vals.includes(c)) return 100;
    const names=[u?.full_name,u?.name,u?.username,u?.email].map(norm).filter(Boolean);
    if(n && names.includes(n)) return 90;
    if(n && names.some(x=>x.includes(n)||n.includes(x))) return 60;
    return 0;
  }
  function findAppUser(users, codeValue, nameValue){
    let best=null, score=0;
    (users||[]).forEach(u=>{const sc=userMatchScore(u,codeValue,nameValue); if(sc>score){score=sc; best=u;}});
    return best;
  }
  function projectSupMatch(p, oldCode, oldName, oldUser){
    const vals=[p.supervisor_employee_code,p.current_supervisor_code,p.supervisor_code,p.app_supervisor_code,p.supervisor_id,p.current_supervisor_id,p.app_supervisor_id].map(S);
    if(vals.includes(S(oldCode))) return true;
    if(oldUser && vals.includes(S(oldUser.id))) return true;
    const names=[p.supervisor_name,p.current_supervisor_name,p.app_supervisor_name].map(norm).filter(Boolean);
    const on=norm(oldName);
    return !!on && names.some(x=>x===on||x.includes(on)||on.includes(x));
  }
  async function updateProjectSupervisorById(pid,newCode,supName,newUser){
    const c=client(); let ok=0;
    const numericId=newUser && newUser.id!=null ? newUser.id : null;
    const payloads=[
      {supervisor_employee_code:newCode,supervisor_name:supName,updated_at:new Date().toISOString()},
      {current_supervisor_code:newCode,current_supervisor_name:supName,updated_at:new Date().toISOString()},
      {supervisor_code:newCode,updated_at:new Date().toISOString()},
      {app_supervisor_code:newCode,app_supervisor_name:supName,updated_at:new Date().toISOString()}
    ];
    if(numericId!==null){
      payloads.push({supervisor_id:numericId,updated_at:new Date().toISOString()});
      payloads.push({current_supervisor_id:numericId,updated_at:new Date().toISOString()});
      payloads.push({app_supervisor_id:numericId,updated_at:new Date().toISOString()});
    }
    for(const pay of payloads){try{const r=await c.from('projects').update(pay).eq('id',pid).select(); if(!r.error) ok+=(r.data||[]).length;}catch(e){console.warn('project supervisor update skipped',pid,Object.keys(pay).join(','),e.message||e);} }
    return ok?1:0;
  }
  async function transferSupervisor(oldCode,newCode){
    const c=client(); if(!c||!oldCode||!newCode||oldCode===newCode) return {dist:0,projects:0,logs:0,attendance:0,users:0};
    const users=await loadAppUsersForTransfer();
    const oldSup=activeSupervisors().find(w=>code(w)===oldCode)||{};
    const sup=activeSupervisors().find(w=>code(w)===newCode)||{};
    const oldName=name(oldSup)||S(oldCode);
    const supName=name(sup)||display(sup)||newCode;
    const oldUser=findAppUser(users,oldCode,oldName);
    const newUser=findAppUser(users,newCode,supName);
    const month=currentMonth();
    const fromDate=new Date().toISOString().slice(0,10);
    let result={dist:0,projects:0,logs:0,attendance:0,users:newUser?1:0};

    // V465 الحل الجذري العام: نقل واحد كامل من قاعدة البيانات نفسها.
    // ينقل المشاريع وحساب المشرف والتوزيع الحالي/المستقبلي والسجلات اليومية الحالية/المستقبلية.
    try{
      const rpc=await c.rpc('tasneef_transfer_supervisor_any_v465',{
        p_old_code:S(oldCode),
        p_new_code:S(newCode),
        p_old_name:S(oldName),
        p_new_name:S(supName),
        p_old_user_id:oldUser&&oldUser.id!=null?Number(oldUser.id):null,
        p_new_user_id:newUser&&newUser.id!=null?Number(newUser.id):null,
        p_from_month:month,
        p_from_date:fromDate,
        p_transfer_all_history:true
      });
      if(!rpc.error && rpc.data){
        const d=Array.isArray(rpc.data)?rpc.data[0]:rpc.data;
        result={
          dist:N(d.distribution_rows),
          projects:N(d.project_rows),
          logs:N(d.time_log_rows),
          attendance:N(d.attendance_rows),
          users:newUser?1:0
        };
        return result;
      }
      if(rpc.error) console.warn('V462 transfer RPC fallback',rpc.error.message||rpc.error);
    }catch(e){console.warn('V462 transfer RPC not available, fallback used',e.message||e);}

    // fallback لو لم يتم تشغيل SQL: محاولة مباشرة بدون لمس السجلات القديمة.
    let dist=0, projects=0, logs=0, attendance=0;
    const distPayload={supervisor_employee_code:newCode,supervisor_name:supName,updated_at:new Date().toISOString()};
    try{const r=await c.from('monthly_distribution').update(distPayload).eq('supervisor_employee_code',oldCode).gte('month_key',month).select(); if(!r.error) dist+=(r.data||[]).length;}catch(e){console.warn('distribution by old code skipped',e.message||e);}
    try{const r=await c.from('monthly_distribution').update(distPayload).eq('supervisor_name',oldName).gte('month_key',month).select(); if(!r.error) dist+=(r.data||[]).length;}catch(e){console.warn('distribution by old name skipped',e.message||e);}
    if(oldUser){try{const r=await c.from('monthly_distribution').update(distPayload).eq('supervisor_id',oldUser.id).gte('month_key',month).select(); if(!r.error) dist+=(r.data||[]).length;}catch(e){console.warn('distribution by old user id skipped',e.message||e);}}

    const pr=await c.from('projects').select('*').eq('is_active', true).limit(20000);
    const list=(pr.data||[]).filter(p=>projectSupMatch(p,oldCode,oldName,oldUser));
    for(const p of list){projects += await updateProjectSupervisorById(p.id,newCode,supName,newUser);}
    projects += await safeUpdate('projects',{supervisor_employee_code:newCode,supervisor_name:supName,updated_at:new Date().toISOString()},'supervisor_employee_code',oldCode);
    projects += await safeUpdate('projects',{supervisor_name:supName,updated_at:new Date().toISOString()},'supervisor_name',oldName);
    projects += await safeUpdate('projects',{current_supervisor_code:newCode,current_supervisor_name:supName,updated_at:new Date().toISOString()},'current_supervisor_code',oldCode);
    if(oldUser&&newUser){
      projects += await safeUpdate('projects',{supervisor_id:newUser.id,updated_at:new Date().toISOString()},'supervisor_id',oldUser.id);
      projects += await safeUpdate('projects',{current_supervisor_id:newUser.id,updated_at:new Date().toISOString()},'current_supervisor_id',oldUser.id);
      projects += await safeUpdate('projects',{app_supervisor_id:newUser.id,updated_at:new Date().toISOString()},'app_supervisor_id',oldUser.id);
      try{const r=await c.from('time_logs').update({supervisor_id:newUser.id,updated_at:new Date().toISOString()}).eq('supervisor_id',oldUser.id).gte('log_date',fromDate).select(); if(!r.error) logs+=(r.data||[]).length;}catch(e){console.warn('time_logs transfer skipped',e.message||e);}
      try{const r=await c.from('attendance').update({supervisor_id:newUser.id,supervisor_employee_code:newCode,supervisor_name:supName,updated_at:new Date().toISOString()}).eq('supervisor_id',oldUser.id).gte('attendance_date',fromDate).select(); if(!r.error) attendance+=(r.data||[]).length;}catch(e){console.warn('attendance transfer skipped',e.message||e);}
    }
    return {dist, projects, logs, attendance, users:newUser?1:0};
  }
  async function deactivateWorkerSmart(w){
    const c=client(); if(!c||!w)return false;
    const wcode=code(w), wname=name(w)||wcode;
    if(!wcode) return false;
    if(isSup(w)){
      const sups=activeSupervisors().filter(x=>code(x)!==wcode);
      if(sups.length){
        const options=sups.map((x,i)=>`${i+1}) ${display(x)}`).join('\n');
        const ans=prompt('سيتم إيقاف المشرف: '+display(w)+'\nاختر رقم المشرف البديل لنقل مشاريعه وموظفيه إليه:\n\n'+options);
        const idx=N(ans)-1;
        if(idx<0||idx>=sups.length){show('تم إلغاء الإيقاف لأنك لم تختار مشرف بديل.',true);return true;}
        const target=sups[idx];
        const res=await transferSupervisor(wcode,code(target));
        show('تم نقل مشاريع وموظفي المشرف إلى '+display(target)+' ثم إيقاف المشرف. التوزيع: '+res.dist+'، المشاريع: '+res.projects+'، حساب المشرف: '+(res.users?'تم':'لم يطابق'));
      }else if(!confirm('لا يوجد مشرف بديل نشط. هل تريد إيقاف المشرف بدون نقل؟')) return true;
    }
    const endDate=S($('cu413WEndDate')?.value||'')||new Date().toISOString().slice(0,10);
    if($('cu413WEndDate') && !$('cu413WEndDate').value) $('cu413WEndDate').value=endDate;
    const stopPayload={status:'inactive',state:'inactive',is_active:false,active:false,work_end_date:endDate,service_end_date:endDate,termination_date:endDate,end_date:endDate,updated_at:new Date().toISOString()};
    try{await c.from('employees_master_v386').update(stopPayload).eq('employee_code',wcode);}catch(e){console.warn('stop employees failed',e.message||e);}
    try{await c.from('workers').update(stopPayload).eq('employee_code',wcode);}catch(e){console.warn('stop workers by code failed',e.message||e);}
    try{await c.from('workers').update(stopPayload).eq('name',wname);}catch(e){console.warn('stop workers by name failed',e.message||e);}
    if(!isSup(w)){
      await c.from('monthly_distribution').update({status:'ended',end_date:endDate,updated_at:new Date().toISOString()}).eq('worker_employee_code',wcode).gte('month_key',currentMonth());
    }
    try{await getCoreApi().reload(true);}catch(_){}
    return true;
  }

  function installSmartCss(){
    if($('cu458Css')) return; const st=document.createElement('style'); st.id='cu458Css'; st.textContent='.cu458-status{display:inline-flex;margin-inline-start:6px;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:900}.cu458-on{background:#e7f8ef;color:#08784d;border:1px solid #bfe8d2}.cu458-off{background:#fdeaea;color:#9d2222;border:1px solid #efc3c3}.cu458-stopped-row{background:#fff7f7!important;border-color:#efc3c3!important}'; document.head.appendChild(st);
  }
  function enhanceWorkerCards(){
    installSmartCss();
    const cards=[...document.querySelectorAll('#cu413WorkersTab .cu413-row')];
    cards.forEach(card=>{
      const b=card.querySelector('b'); if(!b||card.dataset.v458Status)return;
      const txt=b.textContent||'';
      const off=/موقوف|متوقف|inactive|stopped/i.test(card.textContent||'');
      const span=document.createElement('span'); span.className='cu458-status '+(off?'cu458-off':'cu458-on'); span.textContent=off?'موقوف':'نشط'; b.after(span); card.dataset.v458Status='1'; if(off)card.classList.add('cu458-stopped-row');
    });
  }

  function installEndDateAutoFill(){
    const st=$('cu413WStatus'), end=$('cu413WEndDate');
    if(!st||!end||st.dataset.v459EndHook)return;
    st.dataset.v459EndHook='1';
    st.addEventListener('change',()=>{const v=norm(st.value); if(['inactive','stopped','موقوف','متوقف'].some(x=>v.includes(norm(x))) && !end.value) end.value=new Date().toISOString().slice(0,10);});
  }

  function hookSaveWorker(){
    const api=getCoreApi(); if(!api||api.__v458SmartStop)return;
    const oldSave=api.saveWorker;
    api.saveWorker=async function(){
      const edit=S($('cu413WEditMode')?.value||$('cu413WCode')?.value||'');
      const status=norm($('cu413WStatus')?.value||'active');
      const st=publicState(); const w=(st.allWorkers||st.workers||[]).find(x=>code(x)===edit)||{};
      const wasActive=!stopped(w)&&!deleted(w);
      if(edit && wasActive && ['inactive','stopped','موقوف','متوقف'].some(x=>status.includes(norm(x)))){
        const handled=await deactivateWorkerSmart(w);
        if(handled) return;
      }
      const r=await oldSave.apply(this,arguments);
      setTimeout(()=>{enhanceWorkerCards(); installEndDateAutoFill();},300);
      return r;
    };
    api.__v458SmartStop=true;
  }

  // نخزن الحالة العامة كلما تم تحميل النظام الموحد عبر التقاط النتائج من الجداول إن أمكن.
  async function syncPublicState(){
    const c=client(); if(!c)return;
    try{
      const [e,w,p]=await Promise.all([
        c.from('employees_master_v386').select('*').limit(10000),
        c.from('workers').select('*').eq('is_active', true).limit(10000),
        c.from('projects').select('*').eq('is_active', true).limit(10000)
      ]);
      const map=new Map();
      [...(e.data||[]),...(w.data||[])].forEach(x=>{const cde=code(x); if(!cde)return; if(!map.has(cde))map.set(cde,x); else map.set(cde,Object.assign({},map.get(cde),x));});
      const all=[...map.values()].filter(x=>!deleted(x));
      window.__tasneefCoreUnifiedStateV458={allWorkers:all,workers:all.filter(x=>!stopped(x)),projects:(p.data||[]).filter(x=>!deleted(x))};
    }catch(err){console.warn('v458 state sync failed',err);}
  }
  function install(){syncPublicState().then(()=>{hookSaveWorker(); setTimeout(()=>{enhanceWorkerCards(); installEndDateAutoFill();},300);});}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,1500));
  window.addEventListener('load',()=>setTimeout(install,1800));
  setInterval(()=>{hookSaveWorker(); enhanceWorkerCards(); installEndDateAutoFill();},2000);
  console.log('Tasneef core smart stop '+VERSION+' loaded - generic supervisor transfer');
})();

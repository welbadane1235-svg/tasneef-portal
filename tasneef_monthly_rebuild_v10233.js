/* ===== V10233 PERFORMANCE: Monthly loads once unless manual refresh =====
   Source of truth: current active projects. Logs are used only for time calculation. */
(function(){
  'use strict';
  if(window.__tasneefMonthlyRebuildV10233) return;
  window.__tasneefMonthlyRebuildV10233 = true;

  const VERSION='10233';
  const S=v=>String(v??'').trim();
  const N=v=>{const n=Number(v||0);return Number.isFinite(n)?n:0};
  const id=v=>S(v);
  const norm=v=>S(v).replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/\s+/g,' ').toLowerCase();
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=x=>document.getElementById(x);
  const D=()=>{try{return window.data||data||{}}catch(_){return {}}};
  const msg=(t,kind)=>{const el=$('rbMsg'); if(el){el.textContent=t; el.className='rb-msg '+(kind||'ok');} if(kind==='err'){try{if(typeof window.msg==='function') window.msg(t,'err')}catch(_){}}};
  const todayMonth=()=>{try{return today().slice(0,7)}catch(_){return new Date().toISOString().slice(0,7)}};
  const month=()=>$('rbMonth')?.value||todayMonth();
  const monthRange=()=>{const m=month(); const from=m+'-01'; const d=new Date(from+'T00:00:00'); d.setMonth(d.getMonth()+1); const to=d.toISOString().slice(0,10); return {m,from,to,fromIso:from+'T00:00:00',toIso:to+'T00:00:00'};};
  const arMins=m=>{m=Math.round(N(m)); const h=Math.floor(m/60), mm=m%60; if(!h) return mm+' دقيقة'; if(!mm) return h+' ساعة'; return h+' ساعة و '+mm+' دقيقة';};
  const pct=p=>N(p).toFixed(0)+'%';

  function projectName(p){return S(p?.name||p?.project_name||p?.title||'-')}
  function userName(u){return S(u?.full_name||u?.name||u?.username||'-')}
  function workerName(w){return S(w?.name||w?.full_name||w?.worker_name||'-')}
  function projectSupervisorId(p){return id(p?.supervisor_id||p?.current_supervisor_id||p?.app_supervisor_id||p?.manager_id||'')}
  function projectType(p){const t=norm(p?.operation_type||p?.project_type||p?.work_type||p?.type||''); return (t.includes('دوام')||t.includes('full')||t.includes('permanent')||t.includes('fixed'))?'دوام كامل':'زيارة';}
  function isActiveProject(p){
    if(!p) return false;
    if(p.deleted_at||p.deletedAt||p.archived_at||p.archivedAt||p.is_deleted===true||p.isDeleted===true||p.deleted===true||p.archived===true) return false;
    const st=norm(p.status||p.project_status||p.state||p.active_status||'active');
    const bad=['deleted','archived','cancelled','canceled','محذوف','محذوفه','محذوفة','ملغي','ملغيه','الغاء'];
    if(bad.includes(st)) return false;
    
    return true;
  }
  function logDay(l){return S(l.log_date||l.date||l.work_date||l.attendance_date||l.day||l.check_in||l.checkin_at||l.in_time||l.created_at).slice(0,10)}
  function actualMinutes(l){
    try{ if(typeof window.logActualMinutes==='function') return N(window.logActualMinutes(l)); }catch(_){ }
    const saved=N(l.duration_minutes||l.actual_minutes||l.minutes||l.total_minutes||l.work_minutes||0);
    if(saved>0) return saved;
    const ci=l.check_in||l.checkin_at||l.in_time||l.start_time; const co=l.check_out||l.checkout_at||l.out_time||l.end_time;
    if(ci&&co){try{ if(typeof window.minutesBetween==='function') return N(window.minutesBetween(ci,co)); }catch(_){ }
      const a=new Date(ci), b=new Date(co); const mins=(b-a)/60000; if(Number.isFinite(mins)&&mins>0) return mins;
    }
    return 0;
  }
  function projectRequiredDaily(p){return N(p?.required_daily_minutes||p?.daily_required_minutes||p?.required_minutes||p?.monthly_required_minutes||0)}
  function requiredMinutes(l,p){try{ if(typeof window.logRequiredMinutes==='function') return N(window.logRequiredMinutes(l)); }catch(_){ } return N(l.required_minutes||l.required_daily_minutes||projectRequiredDaily(p));}

  const state={loaded:false,projects:[],workers:[],users:[],logs:[],assignments:[],serverRows:[],cacheRows:[],monthKey:'',staticLoaded:false};

  async function loadServerMonthlyRows(){
    if(!window.sb) return [];
    const m=month();
    try{
      const r=await sb.rpc('tasneef_monthly_current_projects_times_v10198',{p_month:m});
      if(!r.error && Array.isArray(r.data)) return r.data||[];
      if(r.error) console.warn('V10198 rpc missing/error', r.error.message);
    }catch(e){console.warn('V10198 rpc catch', e?.message||e);}
    return [];
  }

  async function loadCacheMonthlyRows(){
    if(!window.sb) return [];
    const m=month();
    try{ await sb.rpc('refresh_monthly_times_cache_v10153',{p_month:m}); }catch(_){ }
    const a=await safeSelect('monthly_times_cache_v10153', sb.from('monthly_times_cache_v10153').select('*').eq('month_key',m));
    const b=await safeSelect('monthly_time_manual_adjustments_v10153', sb.from('monthly_time_manual_adjustments_v10153').select('*').eq('month_key',m));
    return (a||[]).concat(b||[]);
  }

  async function safeSelect(table, query){
    if(!window.sb) return [];
    try{ const res=await query; if(res.error){console.warn('V10196 table error', table, res.error.message); return [];} return res.data||[]; }catch(e){console.warn('V10196 table catch', table, e); return [];} }

  function mergeById(arrs){
    const m=new Map(); let i=0;
    (arrs||[]).flat().filter(Boolean).forEach(x=>{const k=id(x.id)||('row_'+(i++)); m.set(k,x);});
    return [...m.values()];
  }
  async function readMonthLogs(){
    if(!window.sb) return [];
    const r=monthRange();
    let logs=await safeSelect('time_logs_month_check_in', sb.from('time_logs').select('*').gte('check_in',r.fromIso).lt('check_in',r.toIso).order('check_in',{ascending:false}).limit(10000));
    if(logs.length) return logs;
    logs=await safeSelect('time_logs_month_log_date', sb.from('time_logs').select('*').gte('log_date',r.from).lt('log_date',r.to).limit(10000));
    return logs;
  }
  async function loadFresh(force){
    // V10202: تحسين أداء فقط. لا نحمل كل time_logs ولا loadAll. نحمل الشهر المطلوب فقط.
    const d1=D();
    const m=month();
    if(window.sb){
      if(!state.staticLoaded || force){
        const [projects,workers,users,assigns]=await Promise.all([
          safeSelect('projects', sb.from('projects').select('*').order('id').limit(3000)),
          safeSelect('workers', sb.from('workers').select('*').order('id').limit(5000)),
          safeSelect('app_users', sb.from('app_users').select('*').order('id').limit(2000)),
          safeSelect('worker_project_assignments', sb.from('worker_project_assignments').select('*').limit(10000))
        ]);
        state.projects=projects.length?projects:(d1.projects||[]);
        state.workers=workers.length?workers:(d1.workers||[]);
        state.users=users.length?users:(d1.users||d1.supervisors||[]);
        state.assignments=assigns.length?assigns:(d1.workerAssignments||d1.assignments||[]);
        state.staticLoaded=true;
      }
      if(force || state.monthKey!==m || !state.loaded){
        const logsMonth=await readMonthLogs();
        state.logs=mergeById([logsMonth, (d1.logs||[]).filter(l=>logDay(l).slice(0,7)===m)]);
        state.serverRows=await loadServerMonthlyRows();
        state.cacheRows=state.serverRows.length?[]:await loadCacheMonthlyRows();
        state.monthKey=m;
      }
      const d=D(); d.projects=state.projects; d.workers=state.workers; d.users=state.users; d.supervisors=state.users.filter(u=>u.role==='supervisor'&&u.is_active!==false); d.logs=state.logs; d.workerAssignments=state.assignments; d.monthlyServerRows=state.serverRows; d.monthlyCacheRows=state.cacheRows;
    }else{
      const d=D(); state.projects=d.projects||[]; state.workers=d.workers||[]; state.users=d.users||d.supervisors||[]; state.logs=(d.logs||[]).filter(l=>logDay(l).slice(0,7)===m); state.assignments=d.workerAssignments||d.assignments||[]; state.serverRows=d.monthlyServerRows||[]; state.cacheRows=d.monthlyCacheRows||[];
    }
    state.loaded=true;
  }

  function supervisorName(sid){const u=state.users.find(u=>id(u.id)===id(sid)); return userName(u)||'-'}
  function workerProjectIds(w){
    const ids=[];
    ['project_id','assigned_project_id','current_project_id','main_project_id'].forEach(k=>{if(w&&w[k]!=null&&S(w[k])!=='') ids.push(id(w[k]));});
    ['project_ids','assigned_project_ids','projects'].forEach(k=>{const v=w&&w[k]; if(Array.isArray(v)) v.forEach(x=>ids.push(id(typeof x==='object'?(x.id||x.project_id):x)));});
    return [...new Set(ids.filter(Boolean))];
  }
  function workerLive(w){
    if(!w) return false; if(w.deleted_at||w.is_deleted===true||w.deleted===true) return false; if(w.is_active===false||w.active===false) return false;
    const st=norm(w.status||'active'); return !['inactive','deleted','archived','stopped','محذوف','موقوف','متوقف'].includes(st);
  }
  function workersForProject(pid){
    const names=new Map();
    state.workers.forEach(w=>{if(workerLive(w)&&workerProjectIds(w).includes(id(pid))){const n=workerName(w); if(n&&n!=='-') names.set(norm(n),n);}});
    state.assignments.forEach(a=>{if(!a) return; if(a.is_active===false||a.active===false||a.deleted_at) return; if(id(a.project_id)!==id(pid)) return; const w=state.workers.find(x=>id(x.id)===id(a.worker_id)); const n=w?workerName(w):S(a.worker_name||a.name); if(n&&n!=='-') names.set(norm(n),n);});
    return [...names.values()].sort((a,b)=>a.localeCompare(b,'ar'));
  }

  function logProjectId(l){return id(l?.project_id||l?.projectId||l?.project||l?.projectID||'')}

  function cacheProjectKey(r){return id(r.project_id||r.project_key||r.projectId||'')}
  function cacheProjectName(r){return S(r.project_name||r.name||r.project||'')}
  function cacheActual(r){return N(r.actual_minutes||r.total_minutes||r.minutes||r.duration_minutes||0)}
  function cacheRequired(r){return N(r.required_minutes||r.required||0)}
  function cacheTravel(r){return N(r.travel_minutes||r.transfer_minutes||0)}
  function cacheCount(r){return N(r.record_count||r.logs_count||r.log_count||0)}
  function applyServerOrCacheRows(rows, live, outRows){
    if(!rows || !rows.length) return 0;
    const byId=new Map(live.map(p=>[id(p.id),p]));
    const byName=new Map(); live.forEach(p=>{ const n=norm(projectName(p)); if(n) byName.set(n,p); });
    let used=0;
    rows.forEach(cr=>{
      let p=null; const pk=cacheProjectKey(cr); if(pk && byId.has(pk)) p=byId.get(pk);
      if(!p){ const nm=norm(cacheProjectName(cr)); if(nm && byName.has(nm)) p=byName.get(nm); }
      if(!p) return; // لا نعرض أي مشروع غير موجود حاليًا
      const row=outRows.get(id(p.id)); if(!row) return;
      row.totalMinutes += cacheActual(cr);
      row.requiredMinutes += cacheRequired(cr);
      row.transferMinutes += cacheTravel(cr);
      row.logsCount += cacheCount(cr) || (cacheActual(cr)>0?1:0);
      used++;
    });
    return used;
  }

  function buildMonthlyTimesFromCurrentProjects(){
    const selectedSup=id($('rbSupervisor')?.value||'');
    const selectedProject=id($('rbProject')?.value||'');
    const m=month();
    const live=state.projects.filter(isActiveProject);
    const liveIds=new Set(live.map(p=>id(p.id)));
    const rows=new Map();
    live.forEach(p=>{
      const pid=id(p.id), sid=projectSupervisorId(p);
      if(selectedSup&&sid!==selectedSup) return;
      if(selectedProject&&pid!==selectedProject) return;
      rows.set(pid,{supervisorId:sid,supervisorName:supervisorName(sid),projectId:pid,projectName:projectName(p),projectType:projectType(p),project:p,totalMinutes:0,requiredMinutes:0,transferMinutes:0,logsCount:0,workers:workersForProject(pid)});
    });
    let liveLogHits=0;
    state.logs.forEach(l=>{
      const d=logDay(l); if(!d||d.slice(0,7)!==m) return;
      const pid=logProjectId(l); if(!liveIds.has(pid)) return;
      const row=rows.get(pid); if(!row) return;
      row.totalMinutes+=actualMinutes(l);
      row.requiredMinutes+=requiredMinutes(l,row.project);
      row.transferMinutes+=N(l.travel_minutes||l.transfer_minutes||l.transition_minutes||0);
      row.logsCount+=1; liveLogHits++;
    });
    // إذا كان time_logs غير مقروء من الصفحة، نستخدم دالة قاعدة البيانات v10198.
    // ولو لم يتم تشغيل SQL بعد، نستخدم جدول الملخص القديم كمصدر وقت فقط، وليس كمصدر مشاريع.
    if(liveLogHits===0){
      const usedServer=applyServerOrCacheRows(state.serverRows, live, rows);
      if(!usedServer) applyServerOrCacheRows(state.cacheRows, live, rows);
    }
    const bySupervisor={}; [...rows.values()].forEach(r=>{const k=id(r.supervisorId)||'none'; bySupervisor[k]=(bySupervisor[k]||0)+N(r.totalMinutes);});
    const out=[...rows.values()].map(r=>({...r,percentage:bySupervisor[id(r.supervisorId)||'none']?N(r.totalMinutes)/bySupervisor[id(r.supervisorId)||'none']*100:0,commitment:r.requiredMinutes?N(r.totalMinutes)/N(r.requiredMinutes)*100:0}));
    out.sort((a,b)=>a.supervisorName.localeCompare(b.supervisorName,'ar')||a.projectName.localeCompare(b.projectName,'ar'));
    return out;
  }

  function installCleanSection(){
    const sec=$('monthly'); if(!sec) return false;
    if(sec.dataset.rb10202==='1') return true;
    sec.dataset.rb10202='1';
    sec.innerHTML=`
      <div class="rb-monthly-root">
        <div class="rb-head"><div><h2>الأوقات الشهرية</h2><p>قسم جديد مبني من الصفر. المصدر الرسمي: المشاريع الحالية فقط. سجلات الدخول والخروج لحساب الوقت فقط.</p></div><span id="rbStatus">V${VERSION}</span></div>
        <div class="rb-filters">
          <div><label>الشهر</label><input type="month" id="rbMonth"></div>
          <div><label>المشرف</label><select id="rbSupervisor"><option value="">كل المشرفين</option></select></div>
          <div><label>المشروع</label><select id="rbProject"><option value="">كل المشاريع الحالية</option></select></div>
          <button type="button" id="rbRefresh" onclick="window.renderMonthlyRootV10199&&window.renderMonthlyRootV10199()">تحديث مباشر</button>
          <button type="button" id="rbPrint" onclick="window.printMonthlyRootV10199&&window.printMonthlyRootV10199()">طباعة التقرير</button>
          <button type="button" id="rbCsv" onclick="window.exportMonthlyRootV10199&&window.exportMonthlyRootV10199()">تصدير CSV</button>
        </div>
        <div id="rbMsg" class="rb-msg">جاهز</div>
        <div id="rbSummary" class="rb-summary"></div>
        <div class="rb-card"><div class="rb-title"><h3>مشاريع الزيارة اليومية</h3><small>نفس معادلة Excel: نسبة كل مشروع من إجمالي دقائق نفس المشرف.</small></div><div id="rbSupervisorCards" class="rb-supervisor-grid"></div></div>
        <div class="rb-card"><div class="rb-title"><h3>المشاريع والعمال الحاليون</h3><small>يعتمد على ربط العمال الحالي بالمشروع، وليس السجلات القديمة.</small></div><div id="rbProjectWorkers" class="rb-project-grid"></div></div>
        <div class="rb-card"><div class="rb-title"><h3>التفاصيل</h3><small>أي مشروع جديد يظهر حتى لو الوقت صفر، والمحذوف لا يظهر.</small></div><div class="table-wrap"><table><thead><tr><th>المشرف الحالي</th><th>المشروع الحالي</th><th>نوع المشروع</th><th>أسماء العمال الحالية</th><th>عدد السجلات</th><th>الدقائق</th><th>الساعات</th><th>وقت الانتقال</th><th>النسبة</th></tr></thead><tbody id="rbBody"><tr><td colspan="9">اضغط تحديث مباشر.</td></tr></tbody></table></div></div>
      </div>`;
    const style=document.createElement('style'); style.id='rbMonthlyCss10196'; style.textContent=`
      #monthly{background:#f4faf7}.rb-monthly-root{display:flex;flex-direction:column;gap:14px}.rb-head{background:linear-gradient(135deg,#084f40,#126a58);color:white;border-radius:22px;padding:22px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 10px 28px rgba(0,0,0,.08)}.rb-head h2{margin:0 0 6px;font-size:28px}.rb-head p{margin:0;color:#e9f6f2}.rb-head span{background:white;color:#084f40;border-radius:999px;padding:8px 14px;font-weight:900}.rb-filters{background:white;border:1px solid #dcebe6;border-radius:18px;padding:14px;display:grid;grid-template-columns:1fr 1fr 1fr auto auto auto;gap:10px;align-items:end}.rb-filters label{display:block;margin-bottom:5px;color:#073f34;font-weight:800}.rb-filters input,.rb-filters select{width:100%;padding:10px;border:1px solid #cfe0da;border-radius:12px;background:#fff}.rb-filters button{border:0;border-radius:12px;padding:12px 18px;background:#074f40;color:white;font-weight:900;cursor:pointer}.rb-msg{border-radius:14px;padding:10px;background:#eef7f3;border:1px solid #d5e9e1;color:#074f40;font-weight:800}.rb-msg.err{background:#ffe8e8;color:#9d2020}.rb-summary{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.rb-kpi{background:white;border:1px solid #dcebe6;border-radius:16px;padding:14px;text-align:center}.rb-kpi small{display:block;color:#5d716b}.rb-kpi b{font-size:26px;color:#074f40}.rb-card{background:white;border:1px solid #dcebe6;border-radius:18px;padding:14px}.rb-title{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}.rb-title h3{margin:0;color:#063d33}.rb-title small{color:#697c75}.rb-supervisor-grid{display:grid;grid-template-columns:repeat(4,minmax(260px,1fr));gap:12px}.rb-super-card{border:2px solid #111;border-radius:8px;padding:10px;min-height:320px;background:white}.rb-super-card h3{text-align:center;margin:0 0 8px;color:#111;font-size:20px}.rb-super-card table{width:100%;border-collapse:collapse}.rb-super-card td{padding:6px;border-bottom:1px solid #edf2f0;text-align:center}.rb-super-card tr.total td{font-weight:900;border-top:2px solid #111}.rb-workers-title{text-align:center;margin:22px 0 8px;font-size:18px;font-weight:900}.rb-worker-list{display:flex;flex-direction:column;align-items:center;gap:4px;font-weight:700}.rb-project-grid{display:grid;grid-template-columns:repeat(7,minmax(150px,1fr));gap:9px}.rb-project-card{border:2px solid #111;min-height:150px;padding:10px;text-align:center}.rb-project-card h3{font-size:16px;margin:0 0 6px}.rb-project-card small{display:block;color:#444;margin-bottom:7px}.rb-project-card span{display:block;font-weight:700;margin:3px}.rb-card table{width:100%;border-collapse:collapse}.rb-card th{background:#074f40;color:white}.rb-card td,.rb-card th{border:1px solid #dfeae6;padding:8px;text-align:center}.rb-empty{padding:24px;text-align:center;color:#777}@media(max-width:1200px){.rb-supervisor-grid{grid-template-columns:repeat(2,minmax(260px,1fr))}.rb-project-grid{grid-template-columns:repeat(3,minmax(150px,1fr))}.rb-filters,.rb-summary{grid-template-columns:1fr 1fr}}@media(max-width:760px){.rb-supervisor-grid,.rb-project-grid,.rb-filters,.rb-summary{grid-template-columns:1fr}}@media print{body *{visibility:hidden!important}#monthly,#monthly *{visibility:visible!important}#monthly{position:absolute!important;inset:0;background:#fff!important}.rb-filters,.rb-msg,.side,.hero,.nav{display:none!important}.rb-card,.rb-super-card,.rb-project-card,.rb-kpi{break-inside:avoid!important}}`;
    document.head.appendChild(style);
    const bm=$('rbMonth'); if(bm&&!bm.value) bm.value=todayMonth();
    $('rbRefresh')?.addEventListener('click',()=>render(true));
    $('rbPrint')?.addEventListener('click',()=>printReport());
    $('rbCsv')?.addEventListener('click',()=>exportCsv());
    ['rbMonth'].forEach(x=>$(x)?.addEventListener('change',()=>render(true)));
    ['rbSupervisor','rbProject'].forEach(x=>$(x)?.addEventListener('change',()=>render(false)));
    return true;
  }

  function fillFilters(){
    const curS=$('rbSupervisor')?.value||'', curP=$('rbProject')?.value||'';
    const live=state.projects.filter(isActiveProject);
    const supIds=[...new Set(live.map(projectSupervisorId).filter(Boolean))];
    const supSel=$('rbSupervisor'); if(supSel){ supSel.innerHTML='<option value="">كل المشرفين</option>'+supIds.map(sid=>`<option value="${esc(sid)}">${esc(supervisorName(sid))}</option>`).join(''); supSel.value=curS; }
    const pSel=$('rbProject'); if(pSel){ pSel.innerHTML='<option value="">كل المشاريع الحالية</option>'+live.sort((a,b)=>projectName(a).localeCompare(projectName(b),'ar')).map(p=>`<option value="${esc(p.id)}">${esc(projectName(p))}</option>`).join(''); pSel.value=curP; }
  }

  async function render(force){
    installCleanSection();
    if(force||!state.loaded) await loadFresh();
    fillFilters();
    const rows=buildMonthlyTimesFromCurrentProjects();
    window.__monthlyRowsRebuildV10199=rows; window.__monthlyRowsRebuildV10198=rows;
    const total=rows.reduce((a,r)=>a+N(r.totalMinutes),0), logs=rows.reduce((a,r)=>a+N(r.logsCount),0), travel=rows.reduce((a,r)=>a+N(r.transferMinutes),0), sups=new Set(rows.map(r=>id(r.supervisorId))).size;
    const sum=$('rbSummary'); if(sum) sum.innerHTML=`<div class="rb-kpi"><small>المشاريع الحالية</small><b>${rows.length}</b></div><div class="rb-kpi"><small>المشرفون</small><b>${sups}</b></div><div class="rb-kpi"><small>سجلات الشهر</small><b>${logs}</b></div><div class="rb-kpi"><small>سجلات الوقت المحملة</small><b>${state.logs.length}</b></div><div class="rb-kpi"><small>سجلات قاعدة البيانات/الملخص</small><b>${(state.serverRows.length||state.cacheRows.length)}</b></div><div class="rb-kpi"><small>إجمالي الدقائق</small><b>${Math.round(total).toLocaleString('en-US')}</b></div><div class="rb-kpi"><small>وقت الانتقال</small><b>${Math.round(travel).toLocaleString('en-US')}</b></div>`;
    const bySup=new Map(); rows.forEach(r=>{const k=id(r.supervisorId)||'none'; if(!bySup.has(k)) bySup.set(k,[]); bySup.get(k).push(r);});
    const sg=$('rbSupervisorCards'); if(sg){ sg.innerHTML=[...bySup.values()].map(items=>{const st=items.reduce((a,r)=>a+N(r.totalMinutes),0); const projectRows=items.map(r=>`<tr><td style="text-align:right"><b>${esc(r.projectName)}</b><br><small>${esc(r.projectType)}</small></td><td>${Math.round(N(r.totalMinutes)).toLocaleString('en-US')}</td><td>${pct(r.percentage)}</td></tr>`).join(''); const names=[...new Set(items.flatMap(r=>r.workers))]; return `<div class="rb-super-card"><h3>${esc(items[0].supervisorName||'-')}</h3><table><tbody>${projectRows}<tr class="total"><td>الإجمالي</td><td>${Math.round(st).toLocaleString('en-US')}</td><td>${st?'100%':'0%'}</td></tr></tbody></table><div class="rb-workers-title">أسماء العمال الحالية</div><div class="rb-worker-list">${names.length?names.map(n=>`<span>${esc(n)}</span>`).join(''):'<span>-</span>'}</div></div>`;}).join('')||'<div class="rb-empty">لا توجد مشاريع حالية لهذا الفلتر</div>'; }
    const pg=$('rbProjectWorkers'); if(pg){ pg.innerHTML=rows.map(r=>`<div class="rb-project-card"><h3>${esc(r.projectName)}</h3><small>${esc(r.supervisorName)} - ${esc(r.projectType)}</small>${r.workers.length?r.workers.map(n=>`<span>${esc(n)}</span>`).join(''):'<span>-</span>'}</div>`).join('')||'<div class="rb-empty">لا توجد مشاريع</div>'; }
    const body=$('rbBody'); if(body){ body.innerHTML=rows.map(r=>`<tr><td>${esc(r.supervisorName)}</td><td>${esc(r.projectName)}</td><td>${esc(r.projectType)}</td><td>${r.workers.map(esc).join('، ')||'-'}</td><td>${Math.round(r.logsCount).toLocaleString('en-US')}</td><td>${Math.round(r.totalMinutes).toLocaleString('en-US')}</td><td>${esc(arMins(r.totalMinutes))}</td><td>${Math.round(r.transferMinutes).toLocaleString('en-US')} دقيقة</td><td>${pct(r.percentage)}</td></tr>`).join('')||'<tr><td colspan="9">لا توجد مشاريع حالية لهذا الفلتر</td></tr>'; }
    if(force) msg('تم تحديث الأوقات الشهرية يدويًا مرة واحدة.'); else { const el=$('rbMsg'); if(el&&!el.textContent) msg('جاهز - الأوقات الشهرية محملة. لن يتم التحديث تلقائيًا إلا عند الضغط على تحديث.'); }
    return rows;
  }

  async function exportCsv(){const rows=await render(false); const lines=[['الشهر','المشرف الحالي','المشروع الحالي','نوع المشروع','أسماء العمال الحالية','عدد السجلات','الدقائق','الساعات','وقت الانتقال','النسبة'],...rows.map(r=>[month(),r.supervisorName,r.projectName,r.projectType,r.workers.join('، '),r.logsCount,Math.round(r.totalMinutes),arMins(r.totalMinutes),Math.round(r.transferMinutes),pct(r.percentage)])]; const blob=new Blob(['\ufeff'+lines.map(row=>row.map(x=>'"'+S(x).replace(/"/g,'""')+'"').join(',')).join('\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='monthly_rebuild_'+month()+'.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  async function printReport(){const rows=await render(false); const bySup=new Map(); rows.forEach(r=>{const k=id(r.supervisorId)||'none'; if(!bySup.has(k)) bySup.set(k,[]); bySup.get(k).push(r);}); const cards=[...bySup.values()].map(items=>{const st=items.reduce((a,r)=>a+N(r.totalMinutes),0); const trs=items.map(r=>`<tr><td>${esc(r.projectName)}</td><td>${Math.round(r.totalMinutes).toLocaleString('en-US')}</td><td>${pct(r.percentage)}</td></tr>`).join(''); const names=[...new Set(items.flatMap(r=>r.workers))].join('<br>')||'-'; return `<div class="card"><h2>${esc(items[0].supervisorName||'-')}</h2><table>${trs}<tr class="total"><td>الإجمالي</td><td>${Math.round(st).toLocaleString('en-US')}</td><td>${st?'100%':'0%'}</td></tr></table><h3>أسماء العمال الحالية</h3><p>${names}</p></div>`;}).join(''); const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>الأوقات الشهرية</title><style>@page{size:A4 landscape;margin:8mm}body{font-family:Tahoma,Arial,sans-serif;color:#111}.head{display:flex;justify-content:space-between;border-bottom:3px solid #074f40;margin-bottom:12px;color:#074f40}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.card{border:2px solid #111;border-radius:8px;padding:9px;min-height:300px;break-inside:avoid}.card h2{text-align:center;margin:0 0 8px}table{width:100%;border-collapse:collapse}td{border-bottom:1px solid #e6eeee;padding:6px;text-align:center}.total td{font-weight:900;border-top:2px solid #111}h3{text-align:center;margin:22px 0 6px}p{text-align:center;line-height:1.7;font-weight:700}</style></head><body><div class="head"><div><h1>شركة تصنيف لإدارة المرافق</h1><p>تقرير الأوقات الشهرية - مبني من المشاريع الحالية فقط</p></div><div><h1>${esc(month())}</h1><p>V${VERSION}</p></div></div><div class="grid">${cards||'<p>لا توجد بيانات</p>'}</div><script>setTimeout(()=>print(),400)<\/script></body></html>`; const w=window.open('','_blank'); if(w){w.document.write(html);w.document.close();}}

  window.buildMonthlyTimesFromCurrentProjects=buildMonthlyTimesFromCurrentProjects;
  window.renderMonthlyRootV10233=()=>render(true);
  window.renderMonthlyRootV10202=()=>render(true);
  window.printMonthlyRootV10202=()=>printReport();
  window.exportMonthlyRootV10202=()=>exportCsv();
  window.renderMonthlyRootV10199=()=>render(true);
  window.printMonthlyRootV10199=()=>printReport();
  window.exportMonthlyRootV10199=()=>exportCsv();
  window.renderMonthly=()=>render(true);
  window.monthlyRowsV60=()=>window.__monthlyRowsRebuildV10199||window.__monthlyRowsRebuildV10198||buildMonthlyTimesFromCurrentProjects();
  window.monthlyReportRowsV58=window.monthlyRowsV60;
  window.exportMonthlyCSV=exportCsv;
  window.printMonthlyReportV57=printReport;
  document.addEventListener('click',function(e){
    const b=e.target.closest&&e.target.closest('#rbRefresh,#rbPrint,#rbCsv'); if(!b) return;
    e.preventDefault(); e.stopPropagation();
    if(b.id==='rbRefresh') render(true);
    if(b.id==='rbPrint') printReport();
    if(b.id==='rbCsv') exportCsv();
  },true);

  const oldShow=window.showPage;
  window.showPage=function(id,btn){const r=oldShow?oldShow.apply(this,arguments):undefined; if(id==='monthly') setTimeout(()=>render(false),200); return r;};
  function boot(){installCleanSection();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  console.log('Tasneef V10233 monthly one-time/manual refresh loaded');
})();

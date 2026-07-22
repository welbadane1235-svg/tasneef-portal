/* ===== TASNEEF V10816 - Complete supervisor projects from unified distribution ===== */
(function(){
  'use strict';
  if(window.__tasneefSupervisorProjectsCompleteV10816) return;
  window.__tasneefSupervisorProjectsCompleteV10816 = true;

  const BUILD='V10816_SUPERVISOR_PROJECTS_COMPLETE';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const norm=v=>S(v).toLowerCase()
    .replace(/[إأآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه')
    .replace(/[\u064B-\u0652]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ')
    .replace(/\s+/g,' ').trim();
  const isOff=v=>['false','0','inactive','disabled','stopped','ended','deleted','archived','موقوف','متوقف','منتهي','محذوف','مؤرشف'].includes(norm(v));
  const activeRow=r=>!!r && r.is_active!==false && r.active!==false && !isOff(r.status||r.state);
  const currentMonth=()=>{
    try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);}
    catch(_){return new Date().toISOString().slice(0,7);}
  };
  const previousMonth=m=>{const [y,mo]=m.split('-').map(Number); const d=new Date(y,mo-2,1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');};
  function user(){
    try{ if(typeof session==='function'){const u=session(); if(u) return u;} }catch(_){}
    try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return {};}
  }
  function isSupervisor(){return norm(user().role)==='supervisor';}
  function identity(u){
    const ids=new Set([u.id,u.user_id,u.uid].map(S).filter(Boolean));
    const codes=new Set([u.employee_code,u.worker_employee_code,u.supervisor_employee_code,u.code,u.user_code,u.username].map(S).filter(Boolean));
    const names=new Set([u.full_name,u.name,u.display_name,u.username].map(norm).filter(Boolean));
    return {ids,codes,names,name:S(u.full_name||u.name||u.display_name||u.username),id:S(u.id||u.user_id||u.uid)};
  }
  function nameMatch(value,names){
    const n=norm(value); if(!n) return false;
    if(names.has(n)) return true;
    for(const x of names){
      if(!x) continue;
      const xt=x.split(' '), nt=n.split(' ');
      if(xt.length===1 && xt[0].length>=3 && nt[0]===xt[0]) return true;
      if(nt.length===1 && nt[0].length>=3 && xt[0]===nt[0]) return true;
    }
    return false;
  }
  function rowMatchesSupervisor(r,id){
    if(!r) return false;
    const rid=[r.supervisor_id,r.app_supervisor_id,r.current_supervisor_id,r.supervisor_user_id,r.manager_id].map(S).filter(Boolean);
    if(rid.some(v=>id.ids.has(v))) return true;
    const rc=[r.supervisor_employee_code,r.supervisor_code,r.employee_code,r.manager_code].map(S).filter(Boolean);
    if(rc.some(v=>id.codes.has(v))) return true;
    return [r.supervisor_name,r.manager_name,r.supervisor].some(v=>nameMatch(v,id.names));
  }
  function projectIdOf(r){return S(r?.project_id||r?.projectId||r?.project_key||r?.assigned_project_id||r?.current_project_id);}
  function projectNameOf(r){return S(r?.project_name||r?.project||r?.project_title||r?.name_project);}
  function workerIdOf(r){return S(r?.worker_id||r?.employee_id||r?.worker_user_id);}
  function workerMatchesSupervisor(w,id){
    if(rowMatchesSupervisor(w,id)) return true;
    const code=S(w?.supervisor_employee_code||w?.supervisor_code);
    const name=S(w?.supervisor_name||w?.manager_name);
    return (code&&id.codes.has(code)) || nameMatch(name,id.names);
  }
  function workerProjectIds(w){
    const out=new Set();
    [w?.project_id,w?.assigned_project_id,w?.current_project_id,w?.projectId].forEach(v=>{if(S(v))out.add(S(v));});
    A(w?.project_ids||w?.projects||w?.assigned_projects).forEach(v=>{const x=S(v?.id??v?.project_id??v); if(x)out.add(x);});
    return out;
  }
  async function safeQuery(label,promise){
    try{const r=await promise; if(r?.error){console.warn(BUILD,label,r.error.message); return [];} return r?.data||[];}
    catch(e){console.warn(BUILD,label,e?.message||e); return [];}
  }
  async function fetchBase(month){
    const [projects,workers,assignments,dist]=await Promise.all([
      safeQuery('projects',sb.from('projects').select('*').order('name')),
      safeQuery('workers',sb.from('workers').select('*').order('name')),
      safeQuery('worker_project_assignments',sb.from('worker_project_assignments').select('*').eq('is_active',true).order('id')),
      safeQuery('monthly_distribution '+month,sb.from('monthly_distribution').select('*').eq('month_key',month).limit(20000))
    ]);
    return {projects,workers,assignments,dist};
  }
  function uniqueProjects(rows){
    const map=new Map();
    A(rows).forEach(p=>{const k=S(p.id)||('name:'+norm(p.name)); if(k&&!map.has(k))map.set(k,p);});
    return [...map.values()].sort((a,b)=>S(a.name).localeCompare(S(b.name),'ar'));
  }
  function setSelect(id,projects,allLabel){
    const el=$(id); if(!el) return;
    const old=S(el.value);
    const esc=v=>S(v).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    el.innerHTML=(allLabel!==null?`<option value="">${esc(allLabel||'اختر المشروع')}</option>`:'')+
      projects.map(p=>`<option value="${esc(p.id)}">${esc(p.name||'-')}</option>`).join('');
    if([...el.options].some(o=>S(o.value)===old)) el.value=old;
  }
  function refill(projects){
    setSelect('logProject',projects,'اختر المشروع');
    setSelect('attendanceProject',projects,'كل مشاريع المشرف');
    setSelect('ticketProject',projects,'اختر المشروع');
    setSelect('supTicketFilterProject',projects,'كل المشاريع');
    setSelect('supOrderProjectV10061',projects,'اختر المشروع');
    setSelect('supOrderFilterProjectV10061',projects,'كل المشاريع');
    setSelect('supInventoryRequestProject',projects,'اختر المشروع');
    setSelect('supClientReportProject',projects,'اختر المشروع');
  }
  let cache=null, cacheAt=0, running=null;
  async function buildContext(force=false){
    if(!isSupervisor()||!window.sb) return null;
    if(!force&&cache&&Date.now()-cacheAt<30000) return cache;
    if(running&&!force) return running;
    running=(async()=>{
      const u=user(), id=identity(u), month=currentMonth();
      let base=await fetchBase(month);
      let matchedDist=A(base.dist).filter(r=>activeRow(r)&&rowMatchesSupervisor(r,id));
      if(!matchedDist.length){
        const pm=previousMonth(month);
        const prev=await safeQuery('monthly_distribution '+pm,sb.from('monthly_distribution').select('*').eq('month_key',pm).limit(20000));
        matchedDist=A(prev).filter(r=>activeRow(r)&&rowMatchesSupervisor(r,id));
      }
      const pids=new Set(); const pnames=new Set();
      A(base.projects).filter(p=>activeRow(p)&&rowMatchesSupervisor(p,id)).forEach(p=>pids.add(S(p.id)));
      matchedDist.forEach(r=>{const pid=projectIdOf(r), pn=norm(projectNameOf(r)); if(pid)pids.add(pid); if(pn)pnames.add(pn);});

      const supWorkers=A(base.workers).filter(w=>activeRow(w)&&workerMatchesSupervisor(w,id));
      const supWorkerIds=new Set(supWorkers.map(w=>S(w.id)).filter(Boolean));
      supWorkers.forEach(w=>workerProjectIds(w).forEach(pid=>pids.add(pid)));
      A(base.assignments).filter(a=>activeRow(a)&&supWorkerIds.has(workerIdOf(a))).forEach(a=>{const pid=projectIdOf(a); if(pid)pids.add(pid);});

      let projects=uniqueProjects(A(base.projects).filter(p=>activeRow(p)&&(pids.has(S(p.id))||pnames.has(norm(p.name)))));
      // البيانات الشهرية هي المرجع التشغيلي الحالي؛ نثبت الربط داخل ذاكرة صفحة المشرف فقط حتى لا تحذفه الفلاتر القديمة.
      projects=projects.map(p=>Object.assign({},p,{
        __original_supervisor_id:p.supervisor_id,
        supervisor_id:Number(id.id)||id.id||p.supervisor_id,
        app_supervisor_id:Number(id.id)||id.id||p.app_supervisor_id,
        current_supervisor_id:Number(id.id)||id.id||p.current_supervisor_id,
        supervisor_name:id.name||p.supervisor_name
      }));
      const finalIds=new Set(projects.map(p=>S(p.id)));
      const relevantAssignments=A(base.assignments).filter(a=>activeRow(a)&&finalIds.has(projectIdOf(a)));
      const assignmentWorkerIds=new Set(relevantAssignments.map(workerIdOf).filter(Boolean));
      const workers=A(base.workers).filter(w=>activeRow(w)&&(workerMatchesSupervisor(w,id)||assignmentWorkerIds.has(S(w.id))||[...workerProjectIds(w)].some(pid=>finalIds.has(pid))));
      cache={u,id,month,projects,workers,assignments:relevantAssignments,projectIds:finalIds,dist:matchedDist}; cacheAt=Date.now();
      return cache;
    })();
    try{return await running;}finally{running=null;}
  }
  async function apply(force=false){
    const ctx=await buildContext(force); if(!ctx) return;
    const d=window.data=window.data||{};
    d.projects=ctx.projects;
    d.workers=ctx.workers;
    d.workerAssignments=ctx.assignments;
    window.__tasneefSupervisorProjectIdsV371=new Set(ctx.projectIds);
    window.__tasneefSupervisorProjectIdsV10816=new Set(ctx.projectIds);
    refill(ctx.projects);
    const title=$('supTitle'); if(title) title.textContent='لوحة المشرف - '+(ctx.id.name||ctx.u.username||'');
    const help=document.querySelector('#supLogs .help,#supLogs .footer-note');
    if(help) help.dataset.projectCount=String(ctx.projects.length);
    try{ if(typeof renderTimeLogs==='function') renderTimeLogs(); }catch(e){console.warn(BUILD,e);}
    try{ if(typeof renderTickets==='function') renderTickets(); }catch(e){console.warn(BUILD,e);}
    try{ if(typeof renderSupervisorAttendanceList==='function'&&document.getElementById('supAttendance')?.classList.contains('active')) renderSupervisorAttendanceList(); }catch(e){console.warn(BUILD,e);}
    console.log(BUILD,'projects:',ctx.projects.length,'workers:',ctx.workers.length,'month:',ctx.month);
  }

  const previousInit=window.initSupervisor;
  window.initSupervisor=async function(){
    if(typeof previousInit==='function') await previousInit.apply(this,arguments);
    await apply(true);
  };
  try{initSupervisor=window.initSupervisor;}catch(_){}

  const previousLoadAll=window.loadAll;
  if(typeof previousLoadAll==='function') window.loadAll=async function(){
    const r=await previousLoadAll.apply(this,arguments);
    if(isSupervisor()) await apply(false);
    return r;
  };
  try{loadAll=window.loadAll;}catch(_){}

  window.refreshSupervisorProjectsV10816=()=>apply(true);
  function boot(){ if(isSupervisor()) apply(false); }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,700));
  window.addEventListener('load',()=>{setTimeout(boot,900);setTimeout(()=>apply(true),2400);});
  setTimeout(boot,3200);
  console.log('Tasneef '+BUILD+' loaded');
})();

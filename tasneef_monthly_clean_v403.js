/* V406 - Monthly times clean source rules
   Project type: projects only. Supervisor/workers: monthly_distribution. Time: time_logs.
   No destructive actions. June JSON is fallback only if DB has no rows for 2026-06. */
(function(){
  'use strict';
  const VERSION='407';
  const JUNE_URL='monthly_times_june_2026_v401.json?v=407-'+Date.now();
  const $=id=>document.getElementById(id);
  const S=v=>(v==null?'':String(v)).trim();
  const N=v=>{const n=Number(v||0);return Number.isFinite(n)?n:0};
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>S(v).replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/\s+/g,' ').toLowerCase();
  const minsText=m=>{m=Math.round(N(m)); const h=Math.floor(m/60), mm=m%60; if(!h) return mm+' دقيقة'; if(!mm) return h+' ساعة'; return h+' ساعة و '+mm+' دقيقة';};
  const pct=v=>{const n=N(v); return (Math.round(n*10)/10).toString().replace(/\.0$/,'')+'%';};
  const sb=()=>window.sb||window.supabaseClient||null;
  let loading=false, employeesCache=[], usersCache=[];

  function month(){return $('mc401Month')?.value || new Date().toISOString().slice(0,7)}
  function monthRange(m){const from=m+'-01'; const d=new Date(from+'T00:00:00'); d.setMonth(d.getMonth()+1); return {from,to:d.toISOString().slice(0,10),fromIso:from+'T00:00:00',toIso:d.toISOString().slice(0,10)+'T00:00:00'};}
  async function safe(promise,label){try{const r=await promise; if(r?.error){console.warn('V406',label,r.error.message); return [];} return r?.data||[];}catch(e){console.warn('V406',label,e?.message||e); return [];}}
  function codeOf(e){return S(e.employee_code||e.code||e.worker_code||e.employee_id_code||e.employee_id||'')}
  function empName(e){return S(e.app_name||e.employee_name||e.name||e.full_name||e.worker_name||e.iqama_name||'')}
  function cleanName(v){return S(v).replace(/TS-\d+\s*-\s*/ig,'').replace(/TS-\d+/ig,'').replace(/[()（）]/g,'').trim();}
  function buildEmpMaps(){const byCode=new Map(), byName=new Map(); employeesCache.forEach(e=>{const c=codeOf(e); if(c) byCode.set(c,e); const n=norm(empName(e)); if(n) byName.set(n,e);}); return {byCode,byName};}
  function labelFrom(code,name){const {byCode,byName}=buildEmpMaps(); const c=S(code); if(c && byCode.has(c)){const e=byCode.get(c); return `${c} - ${empName(e) || S(name) || c}`;} if(c && S(name)) return `${c} - ${cleanName(name)}`; if(c) return c; const raw=cleanName(name); if(raw && byName.has(norm(raw))){const e=byName.get(norm(raw)); const ec=codeOf(e); return ec?`${ec} - ${empName(e)}`:empName(e);} return raw || '-';}
  function projectName(p){return S(p?.name||p?.project_name||p?.title||'-')}
  function projectId(p){return S(p?.id||p?.project_id||'')}
  function projectTypeFromProjects(p){
    const t=norm(p?.operation_type||p?.project_type||p?.work_type||p?.type||'');
    if(t.includes('دوام')||t.includes('كامل')||t.includes('دائم')||t.includes('full')||t.includes('permanent')||t.includes('fixed')||t.includes('24')) return 'دوام كامل';
    return 'زيارة يومية';
  }
  function isFull(r){return S(r.projectType).includes('دوام')}

  function activeDistributionRow(r,m){
    const st=norm(r?.status||'active');
    if(st.includes('منتهي')||st.includes('ملغي')||st.includes('inactive')||st.includes('ended')||st.includes('cancel')) return false;
    const end=S(r?.end_date||'').slice(0,10);
    if(end && end < (m+'-01')) return false;
    return true;
  }

  function actualMinutes(l){
    const saved=N(l.duration_minutes||l.actual_minutes||l.minutes||l.total_minutes||l.work_minutes||0); if(saved>0) return saved;
    const ci=l.check_in||l.checkin_at||l.in_time||l.start_time||l.created_at, co=l.check_out||l.checkout_at||l.out_time||l.end_time;
    if(ci&&co){const a=new Date(ci), b=new Date(co); const m=(b-a)/60000; if(Number.isFinite(m)&&m>0) return m;} return 0;
  }
  function logDate(l){return S(l.log_date||l.date||l.work_date||l.attendance_date||l.day||l.check_in||l.created_at).slice(0,10)}
  function logPid(l){return S(l.project_id||l.projectId||l.project||l.projectID||'')}
  function userNameById(id){const u=usersCache.find(x=>S(x.id)===S(id)); return S(u?.full_name||u?.name||u?.username||'')}
  function projectSupervisorLabel(p){return labelFrom('', userNameById(p?.supervisor_id)||S(p?.supervisor_name||'-'))}
  function workingDaysInMonth(m){const r=monthRange(m); const start=new Date(r.from+'T00:00:00'); const end=new Date(r.to+'T00:00:00'); let days=0; for(let d=new Date(start); d<end; d.setDate(d.getDate()+1)){ if(d.getDay()!==5) days++; } return days || 26;}
  function requiredMonthly(p,m,total){const explicit=N(p.monthly_required_minutes||p.required_monthly_minutes); if(explicit>0) return explicit; const daily=N(p.required_daily_minutes||p.daily_required_minutes||p.required_minutes); if(daily>0) return daily*workingDaysInMonth(m); return N(total)||1;}
  function dateOnly(v){return S(v).slice(0,10);}
  function maxDate(a,b){return !a?b:(!b?a:(a>b?a:b));}
  function minDate(a,b){return !a?b:(!b?a:(a<b?a:b));}
  function addDaysIso(v,n){const d=new Date(v+'T00:00:00'); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10);}
  function workerKeyFromDistribution(d){return S(d.worker_id||d.employee_id||d.worker_employee_code||d.employee_code||d.worker_code||norm(d.worker_name||d.employee_name));}
  function distributionIsActiveForDate(d,day){
    if(d?.is_active===false) return false;
    const st=norm(d?.status||'active');
    if(st.includes('ملغي')||st.includes('cancel')||st.includes('inactive')) return false;
    const start=dateOnly(d?.start_date||d?.assignment_start||d?.effective_from||d?.created_at);
    const end=dateOnly(d?.end_date||d?.assignment_end||d?.effective_to);
    if(start && day<start) return false;
    if(end && day>end) return false;
    return true;
  }
  function projectRequiredForDay(p,day){
    const d=new Date(day+'T00:00:00');
    const daily=N(p.required_daily_minutes||p.daily_required_minutes||p.required_minutes);
    const friday=N(p.friday_minutes||p.friday_required_minutes);
    if(d.getDay()===5) return friday>0?friday:0;
    return daily;
  }
  function requiredMinutesForProjectWorkers(p,m,distRows){
    const r=monthRange(m);
    const projectStart=dateOnly(p.contract_start||p.start_date||p.operation_start);
    const projectEnd=dateOnly(p.contract_end||p.end_date||p.operation_end||p.stopped_at);
    const from=maxDate(r.from,projectStart||r.from);
    const lastMonthDay=addDaysIso(r.to,-1);
    const to=minDate(lastMonthDay,projectEnd||lastMonthDay);
    if(!from||!to||from>to) return {requiredMinutes:0,workerCount:0,workerRequired:new Map()};
    const unique=new Map();
    (distRows||[]).forEach(d=>{const k=workerKeyFromDistribution(d); if(!k)return; if(!unique.has(k))unique.set(k,[]); unique.get(k).push(d);});
    const workerRequired=new Map();
    unique.forEach((assignments,k)=>{let total=0; for(let day=from;day<=to;day=addDaysIso(day,1)){if(assignments.some(a=>distributionIsActiveForDate(a,day))) total+=projectRequiredForDay(p,day);} workerRequired.set(k,total);});
    return {requiredMinutes:[...workerRequired.values()].reduce((s,v)=>s+N(v),0),workerCount:workerRequired.size,workerRequired};
  }
  function fullDisplayPercentage(raw){const n=Math.max(0,N(raw)); return Math.min(n,100);}

  async function loadBase(){
    const c=sb(); if(!c) return {projects:[],dist:[],logs:[]};
    const m=month(), r=monthRange(m);
    const projects=await safe(c.from('projects').select('*').eq('is_active', true).order('id').limit(5000),'projects');
    let emps=await safe(c.from('employees_master_v386').select('*').limit(10000),'employees_master_v386');
    if(!emps.length) emps=await safe(c.from('workers').select('*').eq('is_active', true).limit(10000),'workers');
    employeesCache=emps;
    usersCache=await safe(c.from('app_users').select('*').limit(3000),'app_users');
    let dist=await safe(c.from('monthly_distribution').select('*').eq('month_key',m).limit(20000),'monthly_distribution');
    if(!dist.length) dist=await safe(c.from('monthly_distribution_view').select('*').eq('month_key',m).limit(20000),'monthly_distribution_view');
    dist=dist.filter(r=>activeDistributionRow(r,m));
    let logs=await safe(c.from('time_logs').select('*').gte('log_date',r.from).lt('log_date',r.to).limit(20000),'time_logs log_date');
    if(!logs.length) logs=await safe(c.from('time_logs').select('*').gte('check_in',r.fromIso).lt('check_in',r.toIso).limit(20000),'time_logs check_in');
    return {projects,dist,logs};
  }
  async function loadJuneFallback(){try{const res=await fetch(JUNE_URL,{cache:'no-store'}); return await res.json();}catch(_){return []}}
  function byProjectNameMap(projects){const mp=new Map(); projects.forEach(p=>{const n=norm(projectName(p)); if(n&&!mp.has(n)) mp.set(n,p);}); return mp;}
  function projectByName(projects,name){const nm=norm(name); const mp=byProjectNameMap(projects); if(mp.has(nm)) return mp.get(nm); return projects.find(p=>{const pn=norm(projectName(p)); return pn && (pn.includes(nm)||nm.includes(pn));});}

  async function buildRows(){
    const m=month();
    const {projects,dist,logs}=await loadBase();
    const pById=new Map(projects.map(p=>[projectId(p),p]));
    const rows=new Map();
    function ensureRow(p){
      if(!p) return null; const pid=projectId(p); if(!pid) return null;
      if(!rows.has(pid)){ rows.set(pid,{month:m,projectId:pid,projectName:projectName(p),projectType:projectTypeFromProjects(p),project:p,supervisorName:projectSupervisorLabel(p),workers:[],totalMinutes:0,requiredMinutes:0,loggedRequiredMinutes:0,logsCount:0}); }
      return rows.get(pid);
    }
    // 1) توزيع الشهر يحدد المشرف والعمال فقط.
    const distByPid=new Map();
    dist.forEach(d=>{
      const pid=S(d.project_id); if(!pid) return; const p=pById.get(pid) || projectByName(projects,d.project_name); const row=ensureRow(p || {id:pid,name:d.project_name,operation_type:'daily_visit'}); if(!row) return;
      if(S(d.supervisor_employee_code)||S(d.supervisor_name)) row.supervisorName=labelFrom(d.supervisor_employee_code,d.supervisor_name);
      const w=labelFrom(d.worker_employee_code,d.worker_name); if(w&&w!=='-') row.workers.push(w);
      if(!distByPid.has(row.projectId)) distByPid.set(row.projectId,[]); distByPid.get(row.projectId).push(d);
    });
    // 2) السجلات تحدد الوقت الفعلي فقط، مع منع تكرار السجل نفسه.
    const seenLogs=new Set();
    logs.forEach(l=>{
      const d=logDate(l); if(!d||d.slice(0,7)!==m) return;
      const pid=logPid(l); const p=pById.get(pid); if(!p) return;
      const logKey=S(l.id)||[pid,S(l.worker_id||l.employee_id||''),d,S(l.check_in||l.start_time||''),S(l.check_out||l.end_time||''),S(l.assignment_id||'')].join('|');
      if(seenLogs.has(logKey)) return; seenLogs.add(logKey);
      const row=ensureRow(p); if(!row) return;
      row.totalMinutes+=actualMinutes(l); row.loggedRequiredMinutes+=N(l.required_minutes||l.required_daily_minutes||0); row.logsCount+=1;
    });
    // 3) مشاريع موجودة في التوزيع بدون سجلات تظهر حتى لا يختفي العامل.
    // 4) إذا شهر 6 لا توجد سجلات في قاعدة البيانات، نحافظ على بيانات الشهر الموجودة سابقًا كاحتياط تاريخي فقط.
    if(m==='2026-06' && !logs.length && !rows.size){
      const june=await loadJuneFallback();
      june.forEach(x=>{const p=projectByName(projects,x.projectName||x.project_name); if(!p) return; const row=ensureRow(p); row.totalMinutes+=N(x.totalMinutes||x.minutes||0); row.requiredMinutes+=N(x.requiredMinutes||x.required_minutes||0); row.supervisorName=S(x.supervisorName||x.supervisor_name||row.supervisorName); row.workers=[...new Set([...(row.workers||[]),...((x.workers||x.workerCodes||[]).map(w=>S(w)))])]; row.logsCount+=N(x.logsCount||0);});
    }
    const out=[...rows.values()].map(r=>{
      r.workers=[...new Set((r.workers||[]).filter(Boolean))];
      if(isFull(r)){
        const calc=requiredMinutesForProjectWorkers(r.project,m,distByPid.get(r.projectId)||[]);
        r.workerCount=calc.workerCount;
        r.workerRequiredMinutes=calc.workerRequired;
        r.requiredMinutes=N(calc.requiredMinutes);
        if(r.requiredMinutes<=0 && r.workers.length){
          const perWorker=requiredMonthly(r.project,m,0);
          r.requiredMinutes=perWorker*r.workers.length;
          r.workerCount=r.workers.length;
        }
        if(r.requiredMinutes<=0 && N(r.loggedRequiredMinutes)>0) r.requiredMinutes=N(r.loggedRequiredMinutes);
        const raw=r.requiredMinutes>0?(N(r.totalMinutes)/r.requiredMinutes)*100:0;
        r.rawPercentage=Number.isFinite(raw)?raw:0;
        r.percentage=fullDisplayPercentage(r.rawPercentage);
        r.overtimeMinutes=Math.max(0,N(r.totalMinutes)-N(r.requiredMinutes));
        r.calcNote='دوام كامل: إجمالي الوقت الفعلي لجميع العمال ÷ إجمالي الوقت المطلوب لجميع العمال خلال الفترة';
      } else {r.calcNote='زيارة يومية: مدة المشروع ÷ إجمالي مدة المشرف';}
      return r;
    });
    const dailyTotals={}; out.filter(r=>!isFull(r)).forEach(r=>{const k=r.supervisorName||'-'; dailyTotals[k]=(dailyTotals[k]||0)+N(r.totalMinutes);});
    out.filter(r=>!isFull(r)).forEach(r=>{const total=dailyTotals[r.supervisorName||'-']||0; r.percentage=total?N(r.totalMinutes)/total*100:0;});
    return out.sort((a,b)=>(isFull(a)-isFull(b))||S(a.supervisorName).localeCompare(S(b.supervisorName),'ar')||S(a.projectName).localeCompare(S(b.projectName),'ar'));
  }

  function ensureCss(){
    if($('mc406Css')) return; const st=document.createElement('style'); st.id='mc406Css'; st.textContent=`
    .mc406-daily-card{border:2px solid #0A4033;border-radius:16px;padding:14px;margin:12px 0;background:#fff;break-inside:avoid}.mc406-daily-head{display:flex;justify-content:space-between;gap:10px;align-items:center;border-bottom:1px solid #dce6e2;padding-bottom:8px;margin-bottom:8px}.mc406-daily-head h3{margin:0;color:#0A4033}.mc406-mini{display:flex;gap:6px;flex-wrap:wrap}.mc406-mini span{background:#eef8f5;border:1px solid #cfe2dc;border-radius:999px;padding:6px 9px;font-weight:900}.mc406-table{width:100%;border-collapse:collapse}.mc406-table th{background:#f2f8f5;color:#0A4033}.mc406-table th,.mc406-table td{padding:9px;border-bottom:1px solid #edf1ef;text-align:right}.mc406-progress{height:8px;background:#edf3f1;border-radius:999px;overflow:hidden}.mc406-progress i{display:block;height:100%;background:#0A4033}.mc406-workers{margin-top:9px}.mc406-pill{display:inline-block;background:#eef8f5;border:1px solid #d5e9e2;border-radius:999px;padding:5px 9px;margin:3px;font-weight:800;color:#0A4033}@page{size:A4 landscape;margin:8mm}`; document.head.appendChild(st);
  }
  function fullCard(r){const p=fullDisplayPercentage(r.percentage); const pText=Math.abs(p-100)<0.0001?'100%':p.toFixed(1)+'%'; const extra=N(r.overtimeMinutes)>0?`<div class="mc401-row"><span>وقت إضافي</span><b>${esc(minsText(r.overtimeMinutes))}</b></div>`:''; return `<article class="mc401-card full"><h3>${esc(r.projectName)}</h3><div class="mc401-row"><span>المشرف</span><b>${esc(r.supervisorName||'-')}</b></div><div class="mc401-row"><span>نوع المشروع</span><b>${esc(r.projectType)}</b></div><div class="mc401-row"><span>عدد العمال المحتسبين</span><b>${N(r.workerCount||r.workers?.length)}</b></div><div class="mc401-row"><span>الوقت المستغرق</span><b>${esc(minsText(r.totalMinutes))}</b></div><div class="mc401-row"><span>الدقائق</span><b>${Math.round(N(r.totalMinutes)).toLocaleString('en-US')}</b></div><div class="mc401-row"><span>الوقت المطلوب</span><b>${esc(minsText(r.requiredMinutes))}</b></div><div class="mc401-row"><span>النسبة</span><b>${pText}</b></div>${extra}<div class="mc401-bar"><i style="width:${Math.max(0,Math.min(100,p)).toFixed(0)}%"></i></div><div class="mc401-workers">${(r.workers||[]).map(w=>`<span class="mc401-pill">${esc(w)}</span>`).join('')||'<span class="mc401-pill">لا يوجد توزيع</span>'}</div></article>`;}
  function dailyBox(sup,list){const total=list.reduce((a,r)=>a+N(r.totalMinutes),0); const workers=[...new Set(list.flatMap(r=>r.workers||[]))]; return `<article class="mc406-daily-card"><div class="mc406-daily-head"><h3>${esc(sup||'-')}</h3><div class="mc406-mini"><span>المشاريع: ${list.length}</span><span>إجمالي الوقت: ${esc(minsText(total))}</span><span>الدقائق: ${Math.round(total).toLocaleString('en-US')}</span></div></div><table class="mc406-table"><thead><tr><th>المشروع</th><th>الوقت</th><th>الدقائق</th><th>النسبة</th><th>المعادلة</th></tr></thead><tbody>${list.map(r=>`<tr><td><b>${esc(r.projectName)}</b></td><td>${esc(minsText(r.totalMinutes))}</td><td>${Math.round(N(r.totalMinutes)).toLocaleString('en-US')}</td><td><b>${pct(r.percentage)}</b><div class="mc406-progress"><i style="width:${Math.max(0,Math.min(100,N(r.percentage))).toFixed(0)}%"></i></div></td><td>${esc(r.calcNote)}</td></tr>`).join('')}</tbody></table><div class="mc406-workers"><b>العمال:</b> ${workers.map(w=>`<span class="mc406-pill">${esc(w)}</span>`).join('')||'<span class="mc406-pill">لا يوجد توزيع</span>'}</div></article>`;}
  async function fillFilters(rows){const sup=$('mc401Supervisor'), type=$('mc401Type'); if(sup){const cur=sup.value; const sups=[...new Set(rows.map(r=>r.supervisorName).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar')); sup.innerHTML='<option value="">كل المشرفين</option>'+sups.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join(''); if(sups.includes(cur)) sup.value=cur;} if(type && !type.value) type.value='';}
  async function render(force){if(loading) return; loading=true; ensureCss(); try{const msg=$('mc401Message'); if(msg) msg.textContent='جاري قراءة البيانات من السيرفر...'; let rows=await buildRows(); await fillFilters(rows); const sup=$('mc401Supervisor')?.value||'', type=$('mc401Type')?.value||''; rows=rows.filter(r=>(!sup||r.supervisorName===sup)&&(!type||(type==='daily'&&!isFull(r))||(type==='full'&&isFull(r)))); const daily=rows.filter(r=>!isFull(r)), full=rows.filter(isFull), total=rows.reduce((a,r)=>a+N(r.totalMinutes),0); const summary=$('mc401Summary'); if(summary) summary.innerHTML=[['الشهر',month()],['إجمالي المشاريع',rows.length],['مشاريع الزيارة',daily.length],['مشاريع الدوام الكامل',full.length],['إجمالي الوقت',minsText(total)]].map(x=>`<div class="mc401-kpi"><small>${esc(x[0])}</small><b>${esc(x[1])}</b></div>`).join(''); if(msg) msg.textContent='تم بناء الأوقات من السيرفر: نوع المشروع من قسم المشاريع، والعمال/المشرف من التوزيع، والوقت من السجلات.'; const groups=new Map(); daily.forEach(r=>{const k=r.supervisorName||'-'; if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(r);}); const dbox=$('mc401Daily'); if(dbox) dbox.innerHTML=daily.length?[...groups.entries()].map(([s,list])=>dailyBox(s,list)).join(''):'<div class="mc401-empty">لا توجد مشاريع زيارة يومية لهذا الشهر.</div>'; const fbox=$('mc401Full'); if(fbox) fbox.innerHTML=full.length?full.map(fullCard).join(''):'<div class="mc401-empty">لا توجد مشاريع دوام كامل لهذا الشهر.</div>'; const body=$('mc401Body'); if(body) body.innerHTML=rows.map(r=>`<tr><td>${esc(month())}</td><td>${esc(r.supervisorName)}</td><td>${esc(r.projectName)}</td><td>${esc(r.projectType)}</td><td>${(r.workers||[]).map(esc).join('، ')||'-'}</td><td>${Math.round(N(r.totalMinutes)).toLocaleString('en-US')}</td><td>${esc(minsText(r.totalMinutes))}</td><td><b>${pct(r.percentage)}</b></td><td>${esc(r.calcNote)}</td></tr>`).join('')||'<tr><td colspan="9">لا توجد بيانات لهذا الشهر.</td></tr>'; window.tasneefMonthlyCleanV403Rows=rows; return rows;} finally{loading=false;}}
  function printReport(){const rows=window.tasneefMonthlyCleanV403Rows||[]; const daily=rows.filter(r=>!isFull(r)), full=rows.filter(isFull), total=rows.reduce((a,r)=>a+N(r.totalMinutes),0); const groups=new Map(); daily.forEach(r=>{const k=r.supervisorName||'-'; if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(r);}); const logo=(document.querySelector('img[src*="tasneef_logo_print"]')?.src)||'tasneef_logo_print.png'; const style=document.getElementById('monthlyCleanV403Css')?.textContent||''; const extra=document.getElementById('mc406Css')?.textContent||''; const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية ${month()}</title><style>${style}\n${extra}\nbody{font-family:Tahoma,Arial,sans-serif;direction:rtl;margin:14px;color:#061f18}.print-head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0A4033;padding-bottom:10px;margin-bottom:10px}.print-head img{width:64px}.print-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:10px 0}.print-kpi{border:1px solid #cfe2dc;border-radius:12px;padding:8px;text-align:center}.section-title{background:#eef8f5;border-right:6px solid #0A4033;border-radius:10px;padding:9px;color:#0A4033}</style></head><body><div class="print-head"><div><img src="${logo}"></div><div><h1>تقرير الأوقات الشهرية</h1><b>شهر ${month()} - V407</b></div></div><div class="print-kpis"><div class="print-kpi">المشاريع<br><b>${rows.length}</b></div><div class="print-kpi">زيارة يومية<br><b>${daily.length}</b></div><div class="print-kpi">دوام كامل<br><b>${full.length}</b></div><div class="print-kpi">إجمالي الوقت<br><b>${minsText(total)}</b></div><div class="print-kpi">المصدر<br><b>السيرفر</b></div></div><h2 class="section-title">مشاريع الزيارة اليومية</h2>${[...groups.entries()].map(([s,list])=>dailyBox(s,list)).join('')||'<p>لا توجد.</p>'}<h2 class="section-title">مشاريع الدوام الكامل</h2><div class="mc401-grid">${full.map(fullCard).join('')||'<p>لا توجد.</p>'}</div><script>setTimeout(()=>print(),400)<\/script></body></html>`; const w=window.open('','_blank'); if(w){w.document.open(); w.document.write(html); w.document.close();}}
  function csv(){const rows=window.tasneefMonthlyCleanV403Rows||[]; const lines=[['month','supervisor','project','type','workers','actual_minutes','required_minutes','displayed_percentage','raw_percentage','overtime_minutes'].join(',')].concat(rows.map(r=>[month(),r.supervisorName,r.projectName,r.projectType,(r.workers||[]).join(' | '),r.totalMinutes,r.requiredMinutes,pct(r.percentage),N(r.rawPercentage||r.percentage),N(r.overtimeMinutes)].map(v=>`"${S(v).replace(/"/g,'""')}"`).join(','))); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'})); a.download='monthly_times_'+month()+'_v407.csv'; a.click();}
  function bind(){document.querySelectorAll('.mc401-badge').forEach(x=>x.textContent='V407'); $('mc401Show')?.addEventListener('click',()=>render(true)); $('mc401Month')?.addEventListener('change',()=>render(true)); $('mc401Supervisor')?.addEventListener('change',()=>render(false)); $('mc401Type')?.addEventListener('change',()=>render(false)); $('mc401Print')?.addEventListener('click',printReport); $('mc401Export')?.addEventListener('click',csv);}
  window.tasneefMonthlyCleanV403={render,print:printReport,buildRows};
  document.addEventListener('DOMContentLoaded',()=>{bind(); setTimeout(()=>render(true),800);});
})();

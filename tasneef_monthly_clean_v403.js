/* V403 clean monthly times - approved version: reads other months from time_logs and worker names/codes from workers section */
(function(){
  'use strict';
  const VERSION='403'; // approved same-version hotfix: worker codes for all months
  const JUNE_URL='monthly_times_june_2026_v401.json?v=403-' + Date.now();
  let JUNE_DATA=[];
  let DYNAMIC_DATA=[];
  let currentMonthLoaded='';
  let loading=false;
  const $=id=>document.getElementById(id);
  const S=v=>(v==null?'':String(v).trim());
  const N=v=>{const n=Number(v||0);return Number.isFinite(n)?n:0};
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>S(v).replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/\s+/g,' ').toLowerCase();
  const minsText=m=>{m=Math.round(N(m)); const h=Math.floor(m/60), mm=m%60; if(!h) return mm+' دقيقة'; if(!mm) return h+' ساعة'; return h+' ساعة و '+mm+' دقيقة';};
  const pct=v=>{const n=N(v); return (Math.round(n*10)/10).toString().replace(/\.0$/,'')+'%';};
  const isFull=r=>S(r.projectType).includes('دوام');
  const fullNames=['وجود الياسمين','الرمز 17 a','الرمز a17','الرمز','العجلان ريفيرا 19','العجلان 19','الماجدية 88','صفاء 28','صفاء 65','العجلان 30','مكين 37','برج جوديا صباح'];
  const dailyNames=['الشعلان 50','الشعلان 51'];
  function selectedMonth(){return $('mc401Month')?.value || new Date().toISOString().slice(0,7);}
  function monthRange(m){const from=m+'-01'; const d=new Date(from+'T00:00:00'); d.setMonth(d.getMonth()+1); const to=d.toISOString().slice(0,10); return {from,to,fromIso:from+'T00:00:00',toIso:to+'T00:00:00'};}
  function setVersion(){document.querySelectorAll('*').forEach(el=>{if(el.children.length===0 && /^V\d+$/i.test((el.textContent||'').trim())) el.textContent='V'+VERSION;});}
  function projectName(p){return S(p?.name||p?.project_name||p?.title||p?.project||'-')}
  function userName(u){return S(u?.full_name||u?.name||u?.username||u?.app_name||'-')}
  function employeeCode(x){return S(x?.employee_code||x?.code||x?.worker_code||x?.employee_id_code||x?.employee_id||'')}
  function workerName(w){const code=employeeCode(w); const name=S(w?.app_name||w?.employee_name||w?.name||w?.full_name||w?.worker_name||w?.iqama_name||'-'); return code && !name.includes(code) ? `${code} - ${name}` : name;}
  function employeeDisplayByCode(code, empByCode){const c=S(code); if(!c) return ''; const e=empByCode&&empByCode.get(c); const name=S(e?.app_name||e?.employee_name||e?.name||e?.iqama_name||''); return name ? `${c} - ${name}` : c;}
  function employeeDisplayByName(name, empByName){const n=S(name); if(!n) return ''; const e=empByName&&empByName.get(norm(n)); if(!e) return ''; const c=employeeCode(e); const app=S(e.app_name||e.employee_name||e.name||e.iqama_name||n); return c ? `${c} - ${app}` : app;}
  function nameWithoutCode(v){return S(v).replace(/TS-\d+\s*-\s*/i,'').replace(/TS-\d+/ig,'').replace(/[()（）]/g,'').trim();}
  function linkActiveInMonth(a, month){const r=monthRange(month); const st=S(a.start_date||a.from_date||'0000-01-01').slice(0,10); const en=S(a.end_date||a.to_date||'9999-12-31').slice(0,10); if(en && en<r.from) return false; if(st && st>=r.to) return false; const mk=S(a.month_key||a.month||''); return !mk || mk===month || (st<r.to && (!en || en>=r.from));}
  function projectSupervisorId(p){return S(p?.supervisor_id||p?.current_supervisor_id||p?.app_supervisor_id||p?.manager_id||'')}
  function forcedType(name, raw){const n=norm(name); if(dailyNames.some(x=>n.includes(norm(x)))) return 'زيارة يومية'; if(fullNames.some(x=>n.includes(norm(x)))) return 'دوام كامل'; const t=norm(raw||''); return (t.includes('دوام')||t.includes('full')||t.includes('permanent')||t.includes('fixed')||t.includes('24'))?'دوام كامل':'زيارة يومية';}
  function actualMinutes(l){
    const saved=N(l.duration_minutes||l.actual_minutes||l.minutes||l.total_minutes||l.work_minutes||l.actual_duration_minutes||0); if(saved>0) return saved;
    const ci=l.check_in||l.checkin_at||l.in_time||l.start_time||l.created_at; const co=l.check_out||l.checkout_at||l.out_time||l.end_time;
    if(ci&&co){const a=new Date(ci), b=new Date(co); const mins=(b-a)/60000; if(Number.isFinite(mins)&&mins>0) return mins;}
    return 0;
  }
  function logDay(l){return S(l.log_date||l.date||l.work_date||l.attendance_date||l.day||l.check_in||l.checkin_at||l.in_time||l.created_at).slice(0,10)}
  function logProjectId(l){return S(l.project_id||l.projectId||l.project||l.projectID||'')}
  function requiredFromProject(p){return N(p?.required_daily_minutes||p?.daily_required_minutes||p?.required_minutes||p?.monthly_required_minutes||0)}
  function requiredMinutesForMonth(row){
    if(!isFull(row)) return 0;
    if(N(row.requiredMinutes)>0) return N(row.requiredMinutes);
    const daily=N(row.requiredDailyMinutes||0); if(daily>0) return daily*26;
    return N(row.totalMinutes)||1;
  }
  async function safe(q){try{const r=await q; if(r.error){console.warn('V403 supabase error',r.error.message); return [];} return r.data||[];}catch(e){console.warn('V403 supabase catch',e); return []}}
  async function loadJune(){if(JUNE_DATA.length) return JUNE_DATA; try{const res=await fetch(JUNE_URL,{cache:'no-store'}); JUNE_DATA=await res.json();}catch(e){console.error('V403 June load failed',e); JUNE_DATA=[];} return JUNE_DATA;}
  function normalize(rows, month){
    const map=new Map();
    (rows||[]).forEach(r=>{
      const name=S(r.projectName||r.project_name||r.project||''); if(!name) return;
      const key=month+'|'+norm(name);
      const row=Object.assign({},r,{month,projectName:name});
      row.totalMinutes=N(row.totalMinutes||row.minutes||row.actual_minutes||0);
      row.projectType=forcedType(name,row.projectType||row.operation_type||row.type);
      row.supervisorName=S(row.supervisorName||row.supervisor_name||row.supervisor||'-');
      row.workers=Array.isArray(row.workers)?row.workers:(Array.isArray(row.workerCodes)?row.workerCodes:[]);
      row.workerCodes=Array.isArray(row.workerCodes)?row.workerCodes:[];
      row.requiredMinutes=N(row.requiredMinutes||row.required_minutes||0);
      if(!map.has(key)) map.set(key,row);
      else{const a=map.get(key); a.totalMinutes+=row.totalMinutes; a.requiredMinutes+=row.requiredMinutes; a.workers=[...new Set([...(a.workers||[]),...(row.workers||[])])]; a.workerCodes=[...new Set([...(a.workerCodes||[]),...(row.workerCodes||[])])];}
    });
    const out=[...map.values()];
    const dailyTotals={}; out.filter(r=>!isFull(r)).forEach(r=>{const k=r.supervisorName||'-'; dailyTotals[k]=(dailyTotals[k]||0)+N(r.totalMinutes);});
    out.forEach(r=>{if(isFull(r)){r.requiredMinutes=requiredMinutesForMonth(r); r.percentage=r.requiredMinutes?(N(r.totalMinutes)/N(r.requiredMinutes)*100):0; r.calcNote='دوام كامل: الوقت المستغرق ÷ الوقت المطلوب للمشروع نفسه';}
      else{const total=dailyTotals[r.supervisorName||'-']||0; r.percentage=total?(N(r.totalMinutes)/total*100):0; r.calcNote='زيارة يومية: مدة المشروع ÷ إجمالي مدة المشرف';}
      r.hoursText=r.hoursText||minsText(r.totalMinutes);
    });
    return out.sort((a,b)=>S(a.supervisorName).localeCompare(S(b.supervisorName),'ar')||S(a.projectName).localeCompare(S(b.projectName),'ar'));
  }
  async function loadDynamicMonth(month){
    if(currentMonthLoaded===month && DYNAMIC_DATA.length) return DYNAMIC_DATA;
    DYNAMIC_DATA=[]; currentMonthLoaded=month;
    const sb=window.sb; if(!sb){return []}
    const r=monthRange(month);
    const [projects,users,workers,employees,monthLinks,assignments,logs1,logs2]=await Promise.all([
      safe(sb.from('projects').select('*').limit(5000)),
      safe(sb.from('app_users').select('*').limit(3000)),
      safe(sb.from('workers').select('*').limit(6000)),
      safe(sb.from('employees_master_v386').select('*').limit(6000)),
      safe(sb.from('worker_project_links_v386').select('*').limit(20000)),
      safe(sb.from('worker_project_assignments').select('*').limit(20000)),
      safe(sb.from('time_logs').select('*').gte('check_in',r.fromIso).lt('check_in',r.toIso).limit(20000)),
      safe(sb.from('time_logs').select('*').gte('log_date',r.from).lt('log_date',r.to).limit(20000))
    ]);
    const logsMap=new Map(); [...logs1,...logs2].forEach(l=>{const k=S(l.id||JSON.stringify(l)); logsMap.set(k,l);}); const logs=[...logsMap.values()].filter(l=>logDay(l).slice(0,7)===month);
    const pById=new Map(projects.map(p=>[S(p.id),p]));
    const uById=new Map(users.map(u=>[S(u.id),u]));
    const wById=new Map(workers.map(w=>[S(w.id),w]));
    const empByCode=new Map(); const empByName=new Map(); employees.forEach(e=>{const c=employeeCode(e); if(c) empByCode.set(c,e); [e.app_name,e.employee_name,e.name,e.full_name,e.iqama_name].forEach(n=>{n=S(n); if(n) empByName.set(norm(n),e);});});
    const linksForMonth=(monthLinks||[]).filter(a=>S(a.status||'نشط')!=='خارج العمل' && linkActiveInMonth(a,month));
    const linksByProject=new Map();
    linksForMonth.forEach(a=>{const k=S(a.project_id); if(!k) return; if(!linksByProject.has(k)) linksByProject.set(k,[]); linksByProject.get(k).push(a);});
    function displayEmployeeFromLink(a){const c=S(a.employee_code||a.worker_code||a.code||''); const byCode=employeeDisplayByCode(c,empByCode); if(byCode) return byCode; const name=S(a.employee_name||a.app_name||a.worker_name||a.name||''); const byName=employeeDisplayByName(nameWithoutCode(name),empByName); if(byName) return byName; return c && name && !name.includes(c) ? `${c} - ${name}` : (name||c);}
    function supervisorDisplay(raw){const n=nameWithoutCode(raw); return employeeDisplayByName(n,empByName) || S(raw||'-');}
    function workersForProject(pid){
      const names=new Map();
      // المصدر الأول: قسم العمال الجديد v386، لأنه يحفظ الكود واسم التطبيق حسب الشهر.
      (linksByProject.get(S(pid))||[]).forEach(a=>{
        const n=displayEmployeeFromLink(a);
        if(n) names.set(norm(n),n);
      });
      // المصدر الثاني احتياطي: الربط القديم إذا لم توجد روابط شهرية.
      if(!names.size){
        assignments.forEach(a=>{if(S(a.project_id)!==S(pid)) return; if(a.is_active===false||a.active===false||a.deleted_at) return;
          const st=S(a.start_date||a.from_date||'0000-01-01').slice(0,10); const en=S(a.end_date||a.to_date||'9999-12-31').slice(0,10);
          if(en && en<r.from) return; if(st && st>=r.to) return;
          const w=wById.get(S(a.worker_id));
          const c=employeeCode(w)||S(a.employee_code||a.worker_code||'');
          const rawName=w?workerName(w):S(a.worker_name||a.name||a.worker_code||''); const n=employeeDisplayByCode(c,empByCode) || employeeDisplayByName(nameWithoutCode(rawName),empByName) || rawName;
          if(n) names.set(norm(n),n);
        });
        workers.forEach(w=>{const ids=[w.project_id,w.assigned_project_id,w.current_project_id,w.main_project_id].map(S).filter(Boolean); if(ids.includes(S(pid))){const c=employeeCode(w); const raw=workerName(w); const n=employeeDisplayByCode(c,empByCode)||employeeDisplayByName(nameWithoutCode(raw),empByName)||raw; if(n&&n!=='-') names.set(norm(n),n);}});
      }
      return [...names.values()].sort((a,b)=>a.localeCompare(b,'ar'));
    }
    const rowsByProject=new Map();
    logs.forEach(l=>{
      const pid=logProjectId(l); if(!pid) return; const p=pById.get(S(pid)); if(!p) return;
      const sid=projectSupervisorId(p); const sup=uById.get(S(sid)); const name=projectName(p); const k=S(pid);
      if(!rowsByProject.has(k)){
        const mLinks=linksByProject.get(S(pid))||[];
        const linkSup=S(mLinks.find(x=>S(x.supervisor_name))?.supervisor_name||'');
        const linkSupId=S(mLinks.find(x=>S(x.supervisor_id))?.supervisor_id||'')||sid;
        rowsByProject.set(k,{month,projectId:pid,projectName:name,projectType:forcedType(name,p.operation_type||p.project_type||p.type),supervisorId:linkSupId,supervisorName:supervisorDisplay(linkSup||(sup?userName(sup):S(p.supervisor_name||'-'))),workers:workersForProject(pid),workerCodes:[],totalMinutes:0,requiredDailyMinutes:requiredFromProject(p),requiredMinutes:0,logsCount:0});
      }
      const row=rowsByProject.get(k); row.totalMinutes+=actualMinutes(l); row.requiredMinutes+=N(l.required_minutes||l.required_daily_minutes||0); row.logsCount+=1;
    });
    DYNAMIC_DATA=normalize([...rowsByProject.values()],month);
    return DYNAMIC_DATA;
  }
  async function getRows(){const m=selectedMonth(); if(m==='2026-06') return normalize(await loadJune(),m); return await loadDynamicMonth(m);}
  async function fillSelectors(rows){const supSel=$('mc401Supervisor'); if(supSel){const cur=supSel.value; supSel.innerHTML='<option value="">كل المشرفين</option>'+[...new Set(rows.map(r=>r.supervisorName).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar')).map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join(''); supSel.value=cur;}}
  function fullCard(r){const p=N(r.percentage); return `<article class="mc401-card full"><h3>${esc(r.projectName)}</h3><div class="mc401-row"><span>المشرف</span><b>${esc(r.supervisorName||'-')}</b></div><div class="mc401-row"><span>نوع المشروع</span><b>${esc(r.projectType)}</b></div><div class="mc401-row"><span>الوقت المستغرق</span><b>${esc(r.hoursText||minsText(r.totalMinutes))}</b></div><div class="mc401-row"><span>إجمالي الدقائق</span><b>${Math.round(N(r.totalMinutes)).toLocaleString('en-US')}</b></div><div class="mc401-row"><span>الوقت المطلوب</span><b>${r.requiredMinutes?esc(minsText(r.requiredMinutes)):'-'}</b></div><div class="mc401-row"><span>نسبة المشروع</span><b>${pct(p)}</b></div><div class="mc401-bar"><i style="width:${Math.max(0,Math.min(100,p)).toFixed(0)}%"></i></div><div class="mc401-workers">${(r.workers||[]).map(w=>`<span class="mc401-pill">${esc(w)}</span>`).join('')||'<span class="mc401-pill">لا يوجد عمال</span>'}</div></article>`;}
  function dailySupervisorBox(sup,list){const total=list.reduce((a,r)=>a+N(r.totalMinutes),0); const workers=[...new Set(list.flatMap(r=>r.workers||[]))]; return `<article class="mc402-daily-card"><div class="mc402-daily-head"><h3>${esc(sup)}</h3><div class="mc402-mini-kpis"><span class="mc402-mini-kpi">المشاريع: ${list.length}</span><span class="mc402-mini-kpi">إجمالي الوقت: ${esc(minsText(total))}</span><span class="mc402-mini-kpi">الدقائق: ${Math.round(total).toLocaleString('en-US')}</span></div></div><table class="mc402-project-table"><thead><tr><th>المشروع</th><th>الوقت المستغرق</th><th>الدقائق</th><th>النسبة</th><th>المعادلة</th></tr></thead><tbody>${list.map(r=>{const p=N(r.percentage);return `<tr><td><b>${esc(r.projectName)}</b></td><td>${esc(r.hoursText||minsText(r.totalMinutes))}</td><td>${Math.round(N(r.totalMinutes)).toLocaleString('en-US')}</td><td><b>${pct(p)}</b><div class="mc402-progress"><i style="width:${Math.max(0,Math.min(100,p)).toFixed(0)}%"></i></div></td><td>مدة المشروع ÷ إجمالي مدة المشرف</td></tr>`}).join('')}</tbody></table><div class="mc402-workers-line"><b>العمال:</b> ${workers.map(w=>`<span class="mc401-pill">${esc(w)}</span>`).join('')||'<span class="mc401-pill">لا يوجد عمال</span>'}</div></article>`;}
  async function render(){if(loading) return; loading=true; setVersion(); const month=selectedMonth(); const msg=$('mc401Message'); if(msg) msg.textContent='جاري قراءة بيانات شهر '+month+'...'; try{let rows=await getRows(); await fillSelectors(rows); const sup=$('mc401Supervisor')?.value||''; const type=$('mc401Type')?.value||''; rows=rows.filter(r=>{if(sup&&r.supervisorName!==sup)return false; if(type==='daily'&&isFull(r))return false; if(type==='full'&&!isFull(r))return false; return true;}); const daily=rows.filter(r=>!isFull(r)); const full=rows.filter(isFull); const total=rows.reduce((a,r)=>a+N(r.totalMinutes),0); const summary=$('mc401Summary'); if(summary)summary.innerHTML=[['الشهر',month],['إجمالي المشاريع',rows.length],['مشاريع الزيارة',daily.length],['مشاريع الدوام الكامل',full.length],['إجمالي الوقت',minsText(total)]].map(x=>`<div class="mc401-kpi"><small>${esc(x[0])}</small><b>${esc(x[1])}</b></div>`).join(''); if(msg)msg.textContent= month==='2026-06' ? `تم تحميل ${rows.length} مشروع من ملف شهر 6.` : `تم تحميل ${rows.length} مشروع من سجلات شهر ${month}.`;
      const groups=new Map(); daily.forEach(r=>{const k=r.supervisorName||'-';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}); const dailyBox=$('mc401Daily'); if(dailyBox)dailyBox.innerHTML=daily.length?[...groups.entries()].map(([sup,list])=>dailySupervisorBox(sup,list)).join(''):'<div class="mc401-empty">لا توجد مشاريع زيارة يومية لهذا الشهر.</div>'; const fullBox=$('mc401Full'); if(fullBox){fullBox.className='mc401-grid'; fullBox.innerHTML=full.length?full.map(fullCard).join(''):'<div class="mc401-empty">لا توجد مشاريع دوام كامل لهذا الشهر.</div>';}
      const body=$('mc401Body'); if(body)body.innerHTML=rows.map(r=>`<tr><td>${esc(r.month)}</td><td>${esc(r.supervisorName)}</td><td>${esc(r.projectName)}</td><td>${esc(r.projectType)}</td><td>${(r.workers||[]).map(esc).join('، ')||'-'}</td><td>${Math.round(N(r.totalMinutes)).toLocaleString('en-US')}</td><td>${esc(r.hoursText||minsText(r.totalMinutes))}</td><td><b>${pct(r.percentage)}</b></td><td>${esc(r.calcNote||'')}</td></tr>`).join('')||'<tr><td colspan="9">لا توجد سجلات لهذا الشهر.</td></tr>'; window.tasneefMonthlyCleanV403Rows=rows; return rows;} finally{loading=false;}}
  function csv(){const rows=window.tasneefMonthlyCleanV403Rows||[]; const lines=[['month','supervisor','project','type','workers','minutes','hours','percentage'].join(',')].concat(rows.map(r=>[r.month,r.supervisorName,r.projectName,r.projectType,(r.workers||[]).join(' | '),r.totalMinutes,r.hoursText,pct(r.percentage)].map(v=>`"${S(v).replace(/"/g,'""')}"`).join(','))); const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='monthly_times_'+selectedMonth()+'_v403.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  async function printReport(){const rows=await render() || window.tasneefMonthlyCleanV403Rows || []; const month=selectedMonth(); const daily=rows.filter(r=>!isFull(r)), full=rows.filter(isFull), total=rows.reduce((a,r)=>a+N(r.totalMinutes),0); const groups=new Map(); daily.forEach(r=>{const k=r.supervisorName||'-'; if(!groups.has(k))groups.set(k,[]); groups.get(k).push(r);}); const logo=(document.querySelector('img[src*="tasneef_logo_print"]')?.src)||'tasneef_logo_print.png';
    const style=`body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#061f18;margin:14px;background:#fff}.head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0A4033;padding-bottom:10px;margin-bottom:10px}.brand{display:flex;gap:12px;align-items:center}.brand img{width:64px;max-height:64px;object-fit:contain}.brand h1{margin:0;font-size:24px;color:#0A4033}.month{background:#0A4033;color:#fff;border-radius:14px;padding:9px 16px;text-align:center}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:10px 0}.kpi{border:1px solid #cfe2dc;border-radius:12px;padding:8px;text-align:center;background:#fbfffd}.kpi b{font-size:18px;color:#0A4033}.section-title{margin:14px 0 8px;background:#eef8f5;border-right:6px solid #0A4033;padding:9px;border-radius:10px;color:#0A4033}.mc401-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.mc401-card{border:2px solid #0A4033;border-radius:12px;padding:9px;break-inside:avoid;page-break-inside:avoid}.mc401-card h3{text-align:center;margin:0 0 6px;font-size:17px}.mc401-row{display:grid;grid-template-columns:.9fr 1.3fr;border-top:1px solid #e7efec;padding:5px 0;font-size:12px}.mc401-pill{display:inline-block;background:#eef8f5;border:1px solid #d5e9e2;border-radius:999px;padding:3px 7px;margin:2px;font-weight:700;font-size:11px}.mc401-bar{height:7px;background:#edf3f1;border-radius:99px;overflow:hidden}.mc401-bar i{display:block;height:100%;background:#0A4033}.mc402-daily-card{border:2px solid #0A4033;border-radius:14px;padding:9px;margin:9px 0;break-inside:avoid;page-break-inside:avoid}.mc402-daily-head{display:flex;justify-content:space-between;gap:8px;align-items:center;border-bottom:1px solid #dce6e2;padding-bottom:6px;margin-bottom:6px}.mc402-daily-head h3{margin:0;color:#0A4033;font-size:18px}.mc402-mini-kpis{display:flex;gap:5px;flex-wrap:wrap}.mc402-mini-kpi{background:#eef8f5;border:1px solid #cfe2dc;border-radius:9px;padding:5px 7px;font-weight:900;font-size:11px}.mc402-project-table{width:100%;border-collapse:collapse;font-size:12px}.mc402-project-table th{background:#0A4033;color:white}.mc402-project-table th,.mc402-project-table td{padding:6px;border:1px solid #dfeae6;text-align:right}.mc402-workers-line{margin-top:7px;font-size:12px}.mc402-progress{height:6px;background:#edf3f1;border-radius:99px;overflow:hidden}.mc402-progress i{display:block;height:100%;background:#0A4033}.footer{text-align:center;color:#60706a;border-top:1px solid #dce6e2;margin-top:12px;padding-top:8px;font-size:11px}@page{size:A4 landscape;margin:8mm}@media print{.mc401-card,.mc402-daily-card{break-inside:avoid}.mc401-grid{grid-template-columns:repeat(3,1fr)}}`;
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية ${month}</title><style>${style}</style></head><body><header class="head"><div class="brand"><img src="${logo}"><div><h1>تقرير الأوقات الشهرية</h1><div>شركة تصنيف لإدارة المرافق — نسخة V403</div></div></div><div class="month"><small>الشهر</small><b>${month}</b></div></header><section class="kpis"><div class="kpi"><small>المشاريع</small><b>${rows.length}</b></div><div class="kpi"><small>زيارة يومية</small><b>${daily.length}</b></div><div class="kpi"><small>دوام كامل</small><b>${full.length}</b></div><div class="kpi"><small>إجمالي الوقت</small><b>${minsText(total)}</b></div><div class="kpi"><small>طريقة الحساب</small><b>آلي</b></div></section><h2 class="section-title">مشاريع الزيارة اليومية</h2>${[...groups.entries()].map(([sup,list])=>dailySupervisorBox(sup,list)).join('')||'<p>لا توجد مشاريع زيارة يومية.</p>'}<h2 class="section-title">مشاريع الدوام الكامل</h2><div class="mc401-grid">${full.map(fullCard).join('')||'<p>لا توجد مشاريع دوام كامل.</p>'}</div><div class="footer">تم إنشاء التقرير من نظام شركة تصنيف لإدارة المرافق — طباعة بالعرض</div><script>setTimeout(()=>print(),500)<\/script></body></html>`;
    const w=window.open('','_blank'); if(w){w.document.open(); w.document.write(html); w.document.close();}
  }
  function bind(){['mc401Show','mc401Supervisor','mc401Type','mc401Month'].forEach(id=>{const el=$(id); if(!el||el.dataset.v403==='1')return; el.dataset.v403='1'; el.addEventListener(id==='mc401Show'?'click':'change',()=>render());}); const p=$('mc401Print'); if(p&&p.dataset.v403!=='1'){p.dataset.v403='1'; p.addEventListener('click',printReport);} const e=$('mc401Export'); if(e&&e.dataset.v403!=='1'){e.dataset.v403='1'; e.addEventListener('click',csv);}}
  document.addEventListener('DOMContentLoaded',()=>{bind(); loadJune().then(render);}); setTimeout(()=>{bind(); render();},1000);
})();

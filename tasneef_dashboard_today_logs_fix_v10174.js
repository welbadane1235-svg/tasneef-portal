
/* ===== V10174: adopted source fix - dashboard zero + daily log date/id stability ===== */
(function(){
  'use strict';
  const FIX_VERSION='v10174-adopted-dashboard-source-fix';
  function $v(id){ return document.getElementById(id); }
  function localDateV10174(v){
    const d = v instanceof Date ? v : new Date(v);
    if(!d || isNaN(d)) return '';
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function todayV10174(){ return localDateV10174(new Date()); }
  try{ window.today = todayV10174; }catch(_){}
  function escV(v){
    try{ if(typeof esc==='function') return esc(v); }catch(_){}
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function dateFromAnyV(v){
    if(v===null || v===undefined || v==='') return '';
    const s=String(v).trim();
    const m=s.match(/(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if(m) return m[1]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[3]).padStart(2,'0');
    const d=new Date(s);
    return isNaN(d) ? '' : localDateV10174(d);
  }
  function logDateV(l){
    return dateFromAnyV(l && l.log_date) || dateFromAnyV(l && l.visit_date) ||
           dateFromAnyV(l && l.attendance_date) || dateFromAnyV(l && l.work_date) ||
           dateFromAnyV(l && l.date) || dateFromAnyV(l && l.check_in) ||
           dateFromAnyV(l && l.check_out) || dateFromAnyV(l && l.created_at) || '';
  }
  window.tasneefLogDateV10174 = logDateV;
  function isDailyLogV(l){ return String(l && l.visit_type || '') !== 'technician_attendance'; }
  function monthRangeV(){
    const selected = ($v('dailyDate') && $v('dailyDate').value) || todayV10174();
    const month = selected.slice(0,7);
    const y=Number(month.slice(0,4)), m=Number(month.slice(5,7));
    const start=month+'-01';
    const endDate=new Date(y,m,1);
    const end=endDate.getFullYear()+'-'+String(endDate.getMonth()+1).padStart(2,'0')+'-'+String(endDate.getDate()).padStart(2,'0');
    return {month,start,end};
  }
  function mergeRowsV(arrays){
    const map=new Map();
    (arrays||[]).flat().forEach(function(r,idx){
      if(!r) return;
      const key = r.id!==undefined && r.id!==null ? 'id:'+r.id : ['k',r.log_date||'',r.check_in||'',r.project_id||'',r.supervisor_id||'',idx].join('|');
      if(!map.has(key)) map.set(key,r);
      else map.set(key,Object.assign({},map.get(key),r));
    });
    return Array.from(map.values()).sort(function(a,b){
      const da = dateFromAnyV(b.check_in)||dateFromAnyV(b.log_date)||dateFromAnyV(b.created_at);
      const db = dateFromAnyV(a.check_in)||dateFromAnyV(a.log_date)||dateFromAnyV(a.created_at);
      if(da!==db) return da.localeCompare(db);
      return Number(b.id||0)-Number(a.id||0);
    });
  }
  async function queryV(q){
    try{ const r=await q; return r && !r.error ? (r.data||[]) : []; }catch(_){ return []; }
  }
  async function loadTimeLogsV10174(){
    if(!window.sb || !sb.from) return [];
    const r=monthRangeV();
    const sets=[];
    sets.push(await queryV(sb.from('time_logs').select('*').gte('log_date',r.start).lt('log_date',r.end).limit(3000)));
    sets.push(await queryV(sb.from('time_logs').select('*').gte('check_in',r.start+'T00:00:00').lt('check_in',r.end+'T00:00:00').limit(3000)));
    sets.push(await queryV(sb.from('time_logs').select('*').gte('created_at',r.start+'T00:00:00').lt('created_at',r.end+'T00:00:00').limit(3000)));
    let rows=mergeRowsV(sets);
    if(!rows.length){
      const latestA=await queryV(sb.from('time_logs').select('*').order('id',{ascending:false}).limit(1000));
      const latestB=latestA.length ? [] : await queryV(sb.from('time_logs').select('*').limit(1000));
      rows=mergeRowsV([latestA, latestB]);
    }
    return rows.filter(isDailyLogV);
  }
  const oldLoadAllV10174 = window.loadAll || (typeof loadAll==='function' ? loadAll : null);
  async function loadBaseIfNeeded(){
    if(!window.sb || !sb.from) return;
    if(!window.data) return;
    const tasks=[];
    if(!(data.users||[]).length) tasks.push(queryV(sb.from('app_users').select('*').order('id')).then(x=>data.users=x));
    if(!(data.projects||[]).length) tasks.push(queryV(sb.from('projects').select('*').order('id')).then(x=>data.projects=x));
    if(!(data.workers||[]).length) tasks.push(queryV(sb.from('workers').select('*').order('id')).then(x=>data.workers=x));
    if(!(data.tickets||[]).length) tasks.push(queryV(sb.from('tickets').select('*').order('created_at',{ascending:false}).limit(500)).then(x=>data.tickets=x));
    await Promise.all(tasks);
    data.supervisors = (data.users||[]).filter(u=>u.role==='supervisor' && u.is_active!==false);
    data.technicians = (data.users||[]).filter(u=>u.role==='technician' && u.is_active!==false);
  }
  async function loadAllV10174(){
    try{ if(typeof oldLoadAllV10174==='function') await oldLoadAllV10174(); }catch(e){ console.warn(FIX_VERSION,'old loadAll failed',e); }
    try{ await loadBaseIfNeeded(); }catch(e){ console.warn(FIX_VERSION,'base fallback failed',e); }
    try{
      const logs=await loadTimeLogsV10174();
      if(logs.length || !((window.data && data.logs)||[]).length) data.logs=logs;
      data.logsLoadError='';
      data.__dashboardFixVersion=FIX_VERSION;
    }catch(e){
      data.logsLoadError=String(e && e.message || e);
      console.warn(FIX_VERSION,'time_logs fallback failed',e);
    }
  }
  window.loadAll = loadAllV10174;
  try{ loadAll = loadAllV10174; }catch(_){}
  function workerNameKeyV(n){ return String(n||'').trim().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' '); }
  function uniqueWorkersCountV(){
    const set=new Set();
    ((window.data && data.workers)||[]).forEach(function(w){
      const st=String(w.status||'active').toLowerCase();
      if(st==='deleted') return;
      const n=workerNameKeyV(w.name);
      if(n) set.add(n);
    });
    return set.size;
  }
  function supNameV(id){
    try{ if(typeof supervisorName==='function') return supervisorName(id); }catch(_){}
    const u=((window.data&&data.users)||[]).find(x=>String(x.id)===String(id));
    return (u&&(u.full_name||u.username))||'-';
  }
  function minsTextV(m){
    try{ if(typeof minsToText==='function') return minsToText(m); }catch(_){}
    m=Number(m||0); return Math.floor(m/60)+':'+String(m%60).padStart(2,'0');
  }
  function minutesBetweenV(a,b){
    try{ if(typeof minutesBetween==='function') return minutesBetween(a,b); }catch(_){}
    if(!a||!b) return 0;
    const x=new Date(a), y=new Date(b);
    return isNaN(x)||isNaN(y) ? 0 : Math.max(0,Math.round((y-x)/60000));
  }
  function selectedDashboardDateV(logs){
    const d=todayV10174();
    if(logs.some(l=>logDateV(l)===d)) return d;
    const ds=logs.map(logDateV).filter(Boolean).sort();
    return ds.length ? ds[ds.length-1] : d;
  }
  function renderDashboardV10174(){
    if(!$v('kpiUsers') || !window.data) return;
    const users=data.users||[], projects=data.projects||[], workers=data.workers||[];
    const supervisors=(data.supervisors&&data.supervisors.length ? data.supervisors : users.filter(u=>u.role==='supervisor'&&u.is_active!==false));
    const logs=(data.logs||[]).filter(isDailyLogV);
    const chosen=selectedDashboardDateV(logs);
    const rows=logs.filter(l=>logDateV(l)===chosen);
    $v('kpiUsers').textContent=users.length;
    $v('kpiProjects').textContent=projects.length;
    $v('kpiWorkers').textContent=uniqueWorkersCountV() || workers.length;
    $v('kpiTodayLogs').textContent=rows.length;
    const div=$v('todaySummary');
    if(div){
      if(!logs.length){
        div.innerHTML='<div class="summary-item">لا توجد سجلات يومية محملة من قاعدة البيانات. راجع صلاحية قراءة جدول time_logs أو تاريخ السجلات.</div>';
      }else{
        const title = chosen===todayV10174() ? 'ملخص اليوم' : ('لا توجد سجلات بتاريخ اليوم، آخر سجلات محفوظة بتاريخ: '+chosen);
        div.innerHTML='<div class="summary-item" style="grid-column:1/-1"><b>'+escV(title)+'</b></div>'+supervisors.map(function(s){
          const rs=rows.filter(l=>String(l.supervisor_id)===String(s.id));
          const mins=rs.reduce((a,l)=>a+(Number(l.duration_minutes)||minutesBetweenV(l.check_in,l.check_out)),0);
          return '<div class="summary-item"><b>'+escV(s.full_name||s.username||supNameV(s.id))+'</b><br>عدد التسجيلات: '+rs.length+'<br>إجمالي الوقت: '+minsTextV(mins)+'</div>';
        }).join('');
      }
    }
  }
  window.renderDashboard = renderDashboardV10174;
  try{ renderDashboard = renderDashboardV10174; }catch(_){}
  const oldRenderAllV10174 = window.renderAll || (typeof renderAll==='function' ? renderAll : null);
  function renderAllV10174(){
    if(typeof oldRenderAllV10174==='function'){
      try{ oldRenderAllV10174(); }catch(e){ console.warn(FIX_VERSION,'old renderAll failed',e); }
    }
    renderDashboardV10174();
  }
  window.renderAll = renderAllV10174;
  try{ renderAll = renderAllV10174; }catch(_){}
  async function refreshAllV10174(){
    await loadAllV10174();
    try{ if(typeof hydrateForms==='function') hydrateForms(); }catch(e){ console.warn(e); }
    try{ renderAllV10174(); }catch(e){ console.warn(e); }
  }
  window.refreshAll = refreshAllV10174;
  try{ refreshAll = refreshAllV10174; }catch(_){}
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', function(){ if($v('dashboard')) refreshAllV10174(); }, {once:true});
  }else{
    if($v('dashboard')) refreshAllV10174();
  }
})();

/* ===== V10170: Dashboard daily logs real-date fix + unique workers =====
   أصل المشكلة: بعض السجلات لا تحمل log_date أو تحمل التاريخ في حقول أخرى،
   وبعض النسخ القديمة كانت تستخدم UTC في today() مما يجعل عداد اليوم = صفر.
   هذا الإصلاح من المصدر: يعتمد على بيانات time_logs المحملة، ويوحد استخراج التاريخ،
   ويمنع تكرار أسماء العمال في العد والعرض. */
(function(){
  if(window.__tasneefDashboardTodayLogsFixV10170) return;
  window.__tasneefDashboardTodayLogsFixV10170 = true;
  function $(id){ return document.getElementById(id); }
  function esc(v){
    try{ if(typeof window.esc === 'function') return window.esc(v); }catch(_){ }
    return String(v ?? '').replace(/[&<>"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
  }
  function localDate(d){
    const x = d instanceof Date ? d : new Date(d);
    if(!x || isNaN(x)) return '';
    return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
  }
  window.today = function(){ return localDate(new Date()); };
  function dateFromAny(v){
    if(v === null || v === undefined || v === '') return '';
    const s = String(v).trim();
    const m = s.match(/(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if(m) return m[1]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[3]).padStart(2,'0');
    const d = new Date(s);
    return isNaN(d) ? '' : localDate(d);
  }
  function logDate(l){
    return dateFromAny(l.log_date) || dateFromAny(l.visit_date) || dateFromAny(l.attendance_date) ||
           dateFromAny(l.work_date) || dateFromAny(l.date) || dateFromAny(l.check_in) ||
           dateFromAny(l.check_out) || dateFromAny(l.created_at) || '';
  }
  function isDailyLog(l){ return String(l && l.visit_type || '') !== 'technician_attendance'; }
  function normalizeName(v){ return String(v||'').trim().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' '); }
  function uniqueWorkersCount(){
    const set = new Set();
    ((window.data && data.workers) || []).forEach(function(w){
      const st = String(w.status || 'active').toLowerCase();
      if(st === 'deleted') return;
      const n = normalizeName(w.name);
      if(n) set.add(n);
    });
    return set.size;
  }
  function supervisorName(id){
    try{ if(typeof window.supervisorName === 'function') return window.supervisorName(id); }catch(_){ }
    const u = ((window.data && data.users) || []).find(function(x){return String(x.id)===String(id);});
    return (u && (u.full_name || u.username)) || '-';
  }
  function minsToText(m){
    try{ if(typeof window.minsToText === 'function') return window.minsToText(m); }catch(_){ }
    m = Number(m||0); const h=Math.floor(m/60), mm=m%60; return h+':'+String(mm).padStart(2,'0');
  }
  function minutesBetween(a,b){
    try{ if(typeof window.minutesBetween === 'function') return window.minutesBetween(a,b); }catch(_){ }
    if(!a || !b) return 0;
    const da=new Date(a), db=new Date(b);
    if(isNaN(da)||isNaN(db)) return 0;
    return Math.max(0, Math.round((db-da)/60000));
  }
  function effectiveDashboardDate(rows){
    const t = window.today();
    if(rows.some(function(l){return logDate(l) === t;})) return t;
    const dates = rows.map(logDate).filter(Boolean).sort();
    return dates.length ? dates[dates.length-1] : t;
  }
  window.tasneefLogDateV10170 = logDate;
  window.renderDashboard = function(){
    if(!$('kpiUsers')) return;
    const users = (window.data && data.users) || [];
    const projects = (window.data && data.projects) || [];
    const workers = (window.data && data.workers) || [];
    const supervisors = (window.data && data.supervisors) || users.filter(function(u){return u.role==='supervisor' && u.is_active!==false;});
    const allLogs = (((window.data && data.logs) || []).filter(isDailyLog));
    const chosenDate = effectiveDashboardDate(allLogs);
    const rows = allLogs.filter(function(l){return logDate(l) === chosenDate;});
    $('kpiUsers').textContent = users.length;
    $('kpiProjects').textContent = projects.length;
    $('kpiWorkers').textContent = uniqueWorkersCount() || workers.length;
    $('kpiTodayLogs').textContent = rows.length;
    const div = $('todaySummary');
    if(div){
      if(!allLogs.length){
        div.innerHTML = '<div class="summary-item">لا توجد سجلات يومية محفوظة في قاعدة البيانات.</div>';
      }else{
        const title = chosenDate === window.today() ? 'ملخص اليوم' : ('آخر سجلات محفوظة بتاريخ: ' + chosenDate);
        div.innerHTML = '<div class="summary-item" style="grid-column:1/-1"><b>'+esc(title)+'</b></div>' + supervisors.map(function(s){
          const logs = rows.filter(function(l){return String(l.supervisor_id)===String(s.id);});
          const mins = logs.reduce(function(a,l){return a + (Number(l.duration_minutes)||minutesBetween(l.check_in,l.check_out));},0);
          return '<div class="summary-item"><b>'+esc(s.full_name || s.username)+'</b><br>عدد التسجيلات: '+logs.length+'<br>إجمالي الوقت: '+minsToText(mins)+'</div>';
        }).join('');
      }
    }
  };
  const oldRenderAll = window.renderAll;
  window.renderAll = function(){
    if(typeof oldRenderAll === 'function') oldRenderAll.apply(this, arguments);
    try{ window.renderDashboard(); }catch(e){ console.warn('dashboard v10170 failed', e); }
  };
  function rerender(){ try{ window.renderDashboard(); }catch(_){ } }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){setTimeout(rerender,800);});
  else setTimeout(rerender,800);
  setTimeout(rerender,2200);
  setTimeout(rerender,5000);
})();

/* Tasneef v10141 - Monthly Times Clean Foundation
   - No UI injection/rebuild loops
   - Unique DOM ids so old monthly scripts cannot change this section
   - Reads Supabase + already loaded app data + safe local backup
   - Manual rows are upserted to Supabase, local backup only if Supabase is unavailable
*/
(function(){
  'use strict';
  if(window.__tasneefMonthlyCleanV10141) return;
  window.__tasneefMonthlyCleanV10141 = true;

  const SUPABASE_URL = 'https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const MANUAL_TABLE = 'monthly_time_manual_adjustments';
  const LOCAL_MANUAL = 'tasneef_monthly_manual_rows_clean_v10141';
  const $ = id => document.getElementById(id);
  const A = v => Array.isArray(v) ? v : [];
  const S = v => String(v ?? '').trim();
  const N = v => {
    const n = Number(String(v ?? '').replace(/,/g,'').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    return Number.isFinite(n) ? n : 0;
  };
  const esc = v => S(v).replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const pad = n => String(n).padStart(2,'0');
  const todayYM = () => { const d=new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1); };
  const endDay = (ym) => new Date(Number(ym.slice(0,4)), Number(ym.slice(5,7)), 0).getDate();
  const startDate = (ym) => ym + '-01';
  const endDate = (ym) => ym + '-' + pad(endDay(ym));
  const fmt = (n,d=2) => (Math.round((Number(n)||0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
  const monthLabel = ym => (S(ym).slice(5,7)||'--') + '-' + (S(ym).slice(0,4)||'----');

  const state = {
    month:'', token:0, loading:false,
    users:[], projects:[], workers:[], usersById:{}, projectsById:{}, workersById:{},
    baseLogs:[], manualRows:[], rows:[], filtered:[]
  };

  function sb(){
    if(window.sb && typeof window.sb.from === 'function') return window.sb;
    if(window.supabase && typeof window.supabase.createClient === 'function'){
      try{ window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); return window.sb; }catch(_){ }
    }
    return null;
  }

  async function rest(table, params){
    const url = SUPABASE_URL + '/rest/v1/' + table + '?' + params;
    const res = await fetch(url, {headers:{apikey:SUPABASE_ANON_KEY, Authorization:'Bearer '+SUPABASE_ANON_KEY, Accept:'application/json'}});
    if(!res.ok) throw new Error(table + ': ' + await res.text());
    return await res.json();
  }

  async function selectAll(table, cols='*', limit=5000){
    const client = sb();
    const out=[]; const size=1000;
    if(client){
      for(let from=0; from<limit; from+=size){
        try{
          const {data,error} = await client.from(table).select(cols).range(from, Math.min(from+size-1, limit-1));
          if(error) throw error;
          out.push(...A(data));
          if(!data || data.length < size) break;
        }catch(e){
          console.warn('monthly select failed', table, e.message || e);
          break;
        }
      }
      return out;
    }
    try{ return A(await rest(table, 'select='+encodeURIComponent(cols)+'&limit='+limit)); }catch(_){ return []; }
  }

  async function selectRange(table, dateCol, ym, cols='*'){
    const client = sb();
    const s = startDate(ym), e = endDate(ym);
    if(client){
      try{
        const {data,error} = await client.from(table).select(cols).gte(dateCol, s).lte(dateCol, e).limit(5000);
        if(error) throw error;
        return A(data);
      }catch(err){ console.warn('monthly range failed', table, dateCol, err.message || err); return []; }
    }
    try{
      return A(await rest(table, 'select=*&'+encodeURIComponent(dateCol)+'=gte.'+s+'&'+encodeURIComponent(dateCol)+'=lte.'+e+'&limit=5000'));
    }catch(_){ return []; }
  }

  function mapById(rows){ const o={}; A(rows).forEach(r => { if(r && r.id != null) o[String(r.id)] = r; }); return o; }

  function parseDateValue(v){
    const raw = S(v); if(!raw) return [];
    const out = [];
    function add(y,m,d){ y=Number(y); m=Number(m); d=Number(d); if(y>1900 && m>=1 && m<=12 && d>=1 && d<=31) out.push(y+'-'+pad(m)+'-'+pad(d)); }
    let m = raw.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/); if(m) add(m[1],m[2],m[3]);
    m = raw.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})/); if(m){ const a=+m[1], b=+m[2]; if(a>12) add(m[3],b,a); else if(b>12) add(m[3],a,b); else { add(m[3],b,a); add(m[3],a,b); } }
    const d = new Date(raw); if(!isNaN(d)) add(d.getFullYear(), d.getMonth()+1, d.getDate());
    return [...new Set(out)];
  }
  function rowDateList(row){
    const fields = ['log_date','date','day','work_date','attendance_date','created_at','updated_at','start_at','end_at','check_in_at','check_out_at','createdAt','updatedAt','التاريخ','تاريخ','تاريخ التسجيل'];
    let out=[]; fields.forEach(f => { if(row && row[f] != null) out.push(...parseDateValue(row[f])); });
    return [...new Set(out)];
  }
  function rowInMonth(row, ym){ return rowDateList(row).some(d => d.startsWith(ym)); }

  function pick(row, keys){ for(const k of keys){ if(row && S(row[k])) return S(row[k]); } return ''; }
  function toMinutesTime(t){ const m=S(t).match(/^(\d{1,2}):(\d{2})/); return m ? (Number(m[1])*60 + Number(m[2])) : null; }
  function diffMinutes(a,b){ const x=toMinutesTime(a), y0=toMinutesTime(b); if(x==null || y0==null) return 0; let y=y0; if(y<x) y+=1440; return Math.max(0,y-x); }
  function nameFromUser(id){ const u=state.usersById[String(id||'')]; return u ? S(u.full_name || u.username || u.name || id) : ''; }
  function projectName(id){ const p=state.projectsById[String(id||'')]; return p ? S(p.name || p.project_name || p.title || id) : ''; }
  function workerName(id){ const w=state.workersById[String(id||'')]; return w ? S(w.name || w.full_name || w.worker_name || id) : ''; }

  function loadedAppLogs(){
    const out=[];
    try{
      const d = window.data || {};
      ['logs','time_logs','dailyLogs','workLogs'].forEach(k => out.push(...A(d[k])));
    }catch(_){ }
    return out;
  }

  function localLogs(ym){
    const out=[]; const seen=new Set();
    function walk(v, depth){
      if(depth>3 || v == null) return;
      if(Array.isArray(v)){ v.forEach(x=>walk(x, depth+1)); return; }
      if(typeof v === 'object'){
        const dateOk = rowInMonth(v, ym);
        const signal = ['log_date','date','project_id','project','project_name','supervisor_id','user_id','check_in','check_out','logIn','logOut','time_in','time_out'].some(k => v[k] != null);
        if(dateOk && signal){ const sig = JSON.stringify(v).slice(0,650); if(!seen.has(sig)){ seen.add(sig); out.push(v); } }
        Object.keys(v).slice(0,60).forEach(k => {
          if(/orders|inventory|invoice|products|tickets/i.test(k)) return;
          walk(v[k], depth+1);
        });
      }
    }
    try{
      for(let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i) || '';
        if(/orders|inventory|invoice|products|tickets|language/i.test(k)) continue;
        const raw = localStorage.getItem(k); if(!raw || raw.length > 1500000) continue;
        try{ walk(JSON.parse(raw), 0); }catch(_){ }
      }
    }catch(_){ }
    return out;
  }

  async function loadLookups(){
    const [users, projects, workers] = await Promise.all([
      selectAll('app_users','id,username,full_name,role,is_active',5000),
      selectAll('projects','id,name,project_name,title,supervisor_id',5000),
      selectAll('workers','id,name,full_name,worker_name,project_id,supervisor_id,assigned_project_id,assigned_supervisor_id',5000)
    ]);
    state.users = users; state.projects = projects; state.workers = workers;
    state.usersById = mapById(users); state.projectsById = mapById(projects); state.workersById = mapById(workers);
  }

  async function loadBaseLogs(ym){
    const tables = [
      ['time_logs','log_date'], ['time_logs','date'], ['daily_logs','log_date'], ['work_logs','log_date'], ['attendance_logs','attendance_date']
    ];
    let all = [];
    for(const [t,c] of tables){
      const rows = await selectRange(t,c,ym,'*');
      if(rows.length) all.push(...rows.map(r => ({...r, __sourceTable:t})));
    }
    // safe fallback: already loaded data/local backup
    all.push(...loadedAppLogs());
    all.push(...localLogs(ym));
    const seen = new Set();
    return all.filter(r => rowInMonth(r, ym)).filter(r => {
      const sig = (r.__sourceTable||'')+'|'+(r.id||'')+'|'+JSON.stringify(r).slice(0,500);
      if(seen.has(sig)) return false; seen.add(sig); return true;
    });
  }

  function normalizeLog(row){
    const uid = row.supervisor_id ?? row.user_id ?? row.created_by ?? row.manager_id ?? row.employee_id ?? row.worker_id ?? '';
    const pid = row.project_id ?? row.assigned_project_id ?? row.site_id ?? row.building_id ?? '';
    const supervisor = pick(row,['supervisor_name','created_by_name','user_name','username','full_name','employee_name','manager_name','المشرف','اسم المشرف']) || nameFromUser(uid) || 'غير محدد';
    const project = pick(row,['project_name','project','site_name','building_name','projectTitle','المشروع','اسم المشروع']) || projectName(pid) || 'غير محدد';
    const workers = pick(row,['worker_names','workers','team_names','worker_name','employee_names','employees','أسماء العمال','العامل']) || workerName(row.worker_id) || '';
    const inn = pick(row,['check_in','time_in','log_in','in_time','start_time','entry_time','login_time','وقت الدخول','الدخول']);
    const out = pick(row,['check_out','time_out','log_out','out_time','end_time','exit_time','logout_time','وقت الخروج','الخروج']);
    let actual = N(row.actual_minutes || row.duration_minutes || row.total_minutes || row.minutes || row.work_minutes || row.actual_min || row.duration_min || row['المدة'] || row['الدقائق']);
    if(!actual){ const h = N(row.actual_hours || row.duration_hours || row.total_hours || row.hours || row.work_hours || row['الساعات الفعلية']); actual = h ? h*60 : diffMinutes(inn,out); }
    let required = N(row.required_minutes || row.planned_minutes || row.target_minutes || row.expected_minutes || row.must_minutes || row.required_min || row['الدقائق المطلوبة']);
    if(!required){ const h = N(row.required_hours || row.planned_hours || row.target_hours || row.expected_hours || row.must_hours || row['الساعات المطلوبة']); required = h ? h*60 : 0; }
    let travel = N(row.travel_minutes || row.transfer_minutes || row.lost_minutes || row.wasted_minutes || row.travel_time || row.log_travel || row['وقت الانتقال']);
    if(!travel && N(row.travel_hours)) travel = N(row.travel_hours)*60;
    return {id:'', source:'سجلات النظام', supervisor, project, workers, count:1, requiredMin:required, actualMin:actual, travelMin:travel, percent:''};
  }

  function getLocalManual(){ try{return A(JSON.parse(localStorage.getItem(LOCAL_MANUAL)||'[]'));}catch(_){return [];} }
  function setLocalManual(rows){ try{ localStorage.setItem(LOCAL_MANUAL, JSON.stringify(A(rows))); }catch(_){ } }
  async function loadManual(ym){
    const client = sb();
    if(client){
      try{
        const {data,error} = await client.from(MANUAL_TABLE).select('*').eq('month_key', ym).order('created_at',{ascending:true});
        if(error) throw error;
        return A(data).map(r => ({id:r.id,source:'تعديل يدوي',supervisor:S(r.supervisor_name),project:S(r.project_name),workers:S(r.workers_names),count:N(r.records_count)||1,requiredMin:N(r.required_minutes),actualMin:N(r.actual_minutes),travelMin:N(r.travel_minutes),percent:r.percent_override == null ? '' : N(r.percent_override)}));
      }catch(e){ console.warn('manual online read failed', e.message || e); }
    }
    return getLocalManual().filter(r => r.month === ym);
  }
  async function saveManual(row){
    const id = row.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    const client = sb();
    if(client){
      const payload = { id, month_key:row.month, supervisor_name:row.supervisor, project_name:row.project, workers_names:row.workers||'', records_count:N(row.count)||1, required_minutes:N(row.requiredMin), actual_minutes:N(row.actualMin), travel_minutes:N(row.travelMin), percent_override:row.percent===''?null:N(row.percent), updated_at:new Date().toISOString() };
      const {error} = await client.from(MANUAL_TABLE).upsert(payload,{onConflict:'id'});
      if(error) throw error;
      return id;
    }
    const rows=getLocalManual(); const ix=rows.findIndex(r => r.id === id); const next={...row,id,source:'تعديل يدوي'}; if(ix>=0) rows[ix]=next; else rows.push(next); setLocalManual(rows); return id;
  }
  async function deleteManual(id){
    const client = sb();
    if(client){ const {error} = await client.from(MANUAL_TABLE).delete().eq('id', id); if(error) throw error; return; }
    setLocalManual(getLocalManual().filter(r => r.id !== id));
  }

  function aggregate(baseLogs, manualRows){
    const map = new Map();
    A(baseLogs).map(normalizeLog).forEach(r => {
      const key = r.supervisor + '||' + r.project;
      if(!map.has(key)) map.set(key, {id:key,source:'سجلات النظام',supervisor:r.supervisor,project:r.project,workers:'',count:0,requiredMin:0,actualMin:0,travelMin:0,percent:''});
      const g = map.get(key);
      g.count += 1;
      g.requiredMin += N(r.requiredMin);
      g.actualMin += N(r.actualMin);
      g.travelMin += N(r.travelMin);
      if(r.workers && !g.workers.includes(r.workers)) g.workers = g.workers ? g.workers + ', ' + r.workers : r.workers;
    });
    A(manualRows).forEach(r => map.set('manual:'+r.id, {...r, source:'تعديل يدوي'}));
    return [...map.values()].sort((a,b) => S(a.supervisor).localeCompare(S(b.supervisor),'ar') || S(a.project).localeCompare(S(b.project),'ar'));
  }

  function performance(row){
    const pct = row.percent !== '' && row.percent != null ? Math.round(N(row.percent)) : (N(row.requiredMin) ? Math.round(N(row.actualMin)/N(row.requiredMin)*100) : (N(row.actualMin) ? 100 : 0));
    if(pct >= 95) return {pct, label:'ممتاز', cls:'green'};
    if(pct >= 80) return {pct, label:'جيد', cls:'amber'};
    return {pct, label:'ضعيف', cls:'red'};
  }

  function setStatus(txt, cls='amber'){ const el=$('mtStatusV10141'); if(el){ el.textContent=txt; el.className='badge '+cls; } }
  function setMessage(txt, err=false){ const el=$('mtMessageV10141'); if(!el) return; el.textContent=txt||''; el.className='msg '+(err?'err':''); el.classList.toggle('hidden', !txt); }
  function filterRows(rows){
    const sup=S($('mtSupervisorV10141')?.value), prj=S($('mtProjectV10141')?.value);
    return A(rows).filter(r => (!sup || r.supervisor === sup) && (!prj || r.project === prj));
  }
  function fillControls(){
    const supSel=$('mtSupervisorV10141'), prjSel=$('mtProjectV10141'); const curS=S(supSel?.value), curP=S(prjSel?.value);
    const sups=[...new Set(state.rows.map(r=>r.supervisor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    const prjs=[...new Set(state.rows.map(r=>r.project).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    if(supSel) supSel.innerHTML='<option value="">كل المشرفين</option>'+sups.map(x=>`<option value="${esc(x)}" ${x===curS?'selected':''}>${esc(x)}</option>`).join('');
    if(prjSel) prjSel.innerHTML='<option value="">كل المشاريع</option>'+prjs.map(x=>`<option value="${esc(x)}" ${x===curP?'selected':''}>${esc(x)}</option>`).join('');
    const dlS=$('mtSupervisorListV10141'), dlP=$('mtProjectListV10141');
    if(dlS) dlS.innerHTML=[...new Set([...sups, ...state.users.map(u=>S(u.full_name||u.username)).filter(Boolean)])].map(x=>`<option value="${esc(x)}"></option>`).join('');
    if(dlP) dlP.innerHTML=[...new Set([...prjs, ...state.projects.map(p=>S(p.name||p.project_name||p.title)).filter(Boolean)])].map(x=>`<option value="${esc(x)}"></option>`).join('');
  }
  function renderSummary(rows){
    const actual=rows.reduce((s,r)=>s+N(r.actualMin),0), req=rows.reduce((s,r)=>s+N(r.requiredMin),0), travel=rows.reduce((s,r)=>s+N(r.travelMin),0), rec=rows.reduce((s,r)=>s+N(r.count),0);
    const el=$('mtSummaryV10141'); if(!el) return;
    el.innerHTML = `<div class="kpi"><small>إجمالي الوقت</small><b>${fmt(actual/60,2)} ساعة</b></div><div class="kpi"><small>الساعات المطلوبة</small><b>${fmt(req/60,2)}</b></div><div class="kpi"><small>وقت الانتقال</small><b>${fmt(travel/60,2)}</b></div><div class="kpi"><small>المشرفين</small><b>${new Set(rows.map(r=>r.supervisor)).size}</b></div><div class="kpi"><small>المشاريع</small><b>${new Set(rows.map(r=>r.project)).size}</b></div><div class="kpi"><small>عدد السجلات</small><b>${rec}</b></div>`;
  }
  function renderTable(rows){
    const body=$('mtBodyV10141'); if(!body) return;
    if(!rows.length){ body.innerHTML = `<tr><td colspan="11">لا توجد بيانات للشهر المختار. إذا كانت لديك تسجيلات، اضغط تحديث أو تأكد أن تسجيل الدخول/الخروج محفوظ في النظام.</td></tr>`; return; }
    body.innerHTML = rows.map(r => { const p=performance(r); return `<tr><td>${esc(r.supervisor)}</td><td>${esc(r.project)}</td><td>${esc(r.workers||'-')}</td><td>${N(r.count)}</td><td>${fmt(N(r.requiredMin)/60,2)}</td><td>${fmt(N(r.actualMin)/60,2)}</td><td>${fmt(N(r.travelMin)/60,2)}</td><td>${p.pct}%</td><td><span class="badge ${p.cls}">${p.label}</span></td><td>${esc(r.source)}</td><td>${r.source==='تعديل يدوي'?`<button class="light" onclick="TasneefMonthlyV10141.edit('${esc(r.id)}')">تعديل</button> <button class="danger" onclick="TasneefMonthlyV10141.remove('${esc(r.id)}')">حذف</button>`:'-'}</td></tr>`; }).join('');
  }
  function render(){
    state.filtered = filterRows(state.rows);
    renderSummary(state.filtered);
    renderTable(state.filtered);
    setStatus('تم تحميل '+state.filtered.length+' صف', 'green');
  }

  async function load(){
    if(state.loading) return;
    state.loading = true;
    const token = ++state.token;
    const month = S($('mtMonthV10141')?.value) || todayYM();
    state.month = month;
    if($('mtMonthV10141')) $('mtMonthV10141').value = month;
    setStatus('جاري التحميل...', 'amber');
    setMessage('جاري تحميل الأوقات الشهرية من السجلات والتعديلات اليدوية...');
    try{
      await loadLookups();
      const [logs, manual] = await Promise.all([loadBaseLogs(month), loadManual(month)]);
      if(token !== state.token) return;
      state.baseLogs = logs; state.manualRows = manual; state.rows = aggregate(logs, manual);
      fillControls();
      render();
      setMessage(`تم تحميل ${logs.length} سجل من سجلات النظام و ${manual.length} تعديل يدوي لشهر ${monthLabel(month)}.`, false);
    }catch(e){
      console.error('Monthly v10141 load failed', e);
      setStatus('خطأ', 'red');
      setMessage('تعذر تحميل الأوقات الشهرية: '+(e.message||e), true);
    }finally{ state.loading = false; }
  }

  function clearForm(){ ['mtManualIdV10141','mtManualSupervisorV10141','mtManualProjectV10141','mtManualWorkersV10141','mtManualRequiredV10141','mtManualActualV10141','mtManualTravelV10141','mtManualPercentV10141'].forEach(id => { if($(id)) $(id).value=''; }); }
  async function saveForm(){
    const row = { id:S($('mtManualIdV10141')?.value), month:S($('mtMonthV10141')?.value)||todayYM(), supervisor:S($('mtManualSupervisorV10141')?.value), project:S($('mtManualProjectV10141')?.value), workers:S($('mtManualWorkersV10141')?.value), count:1, requiredMin:N($('mtManualRequiredV10141')?.value), actualMin:N($('mtManualActualV10141')?.value), travelMin:N($('mtManualTravelV10141')?.value), percent:S($('mtManualPercentV10141')?.value)===''?'':N($('mtManualPercentV10141')?.value), source:'تعديل يدوي' };
    if(!row.supervisor || !row.project){ alert('اكتب اسم المشرف واسم المشروع'); return; }
    try{ await saveManual(row); clearForm(); await load(); setMessage('تم حفظ التعديل وظهر فورًا في الجدول والطباعة.', false); }catch(e){ alert('تعذر حفظ التعديل: '+(e.message||e)); }
  }
  async function removeManual(id){ if(!confirm('حذف هذا التعديل اليدوي؟')) return; try{ await deleteManual(id); await load(); }catch(e){ alert('تعذر الحذف: '+(e.message||e)); } }
  function editManual(id){ const r=state.rows.find(x => String(x.id)===String(id)); if(!r) return; $('mtManualIdV10141').value=r.id; $('mtManualSupervisorV10141').value=r.supervisor; $('mtManualProjectV10141').value=r.project; $('mtManualWorkersV10141').value=r.workers||''; $('mtManualRequiredV10141').value=N(r.requiredMin)||''; $('mtManualActualV10141').value=N(r.actualMin)||''; $('mtManualTravelV10141').value=N(r.travelMin)||''; $('mtManualPercentV10141').value=r.percent===''?'':N(r.percent); }
  function exportCsv(){
    const rows=state.filtered||[]; const headers=['المشرف','المشروع','أسماء العمال','عدد السجلات','الساعات المطلوبة','الساعات الفعلية','وقت الانتقال','نسبة العمل','حالة الأداء','المصدر'];
    const lines=[headers.join(',')].concat(rows.map(r => { const p=performance(r); return [r.supervisor,r.project,r.workers||'',N(r.count),fmt(N(r.requiredMin)/60,2),fmt(N(r.actualMin)/60,2),fmt(N(r.travelMin)/60,2),p.pct+'%',p.label,r.source].map(x=>'"'+S(x).replace(/"/g,'""')+'"').join(','); }));
    const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='monthly-times-'+(state.month||todayYM())+'.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1200);
  }
  function printReport(){
    const rows=state.filtered||[]; const summary=$('mtSummaryV10141')?.outerHTML||'';
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية</title><style>body{font-family:Tahoma,Arial,sans-serif;margin:24px;color:#10231d}h1{margin:0 0 8px;color:#0A4033}.muted{color:#60706a}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}.kpi{border:1px solid #dce6e2;border-radius:12px;padding:10px}.kpi small{color:#60706a}.kpi b{display:block;font-size:22px;color:#0A4033;margin-top:6px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:14px}th,td{border:1px solid #dce6e2;padding:8px;text-align:right}th{background:#f3f6f5}</style></head><body><h1>تقرير الأوقات الشهرية</h1><div class="muted">الشهر: ${esc(monthLabel(state.month||todayYM()))}</div>${summary}<table><thead><tr><th>المشرف</th><th>المشروع</th><th>أسماء العمال</th><th>عدد السجلات</th><th>الساعات المطلوبة</th><th>الساعات الفعلية</th><th>وقت الانتقال</th><th>النسبة</th><th>الحالة</th><th>المصدر</th></tr></thead><tbody>${rows.map(r=>{const p=performance(r);return `<tr><td>${esc(r.supervisor)}</td><td>${esc(r.project)}</td><td>${esc(r.workers||'-')}</td><td>${N(r.count)}</td><td>${fmt(N(r.requiredMin)/60,2)}</td><td>${fmt(N(r.actualMin)/60,2)}</td><td>${fmt(N(r.travelMin)/60,2)}</td><td>${p.pct}%</td><td>${p.label}</td><td>${esc(r.source)}</td></tr>`}).join('')||'<tr><td colspan="10">لا توجد بيانات</td></tr>'}</tbody></table><script>window.onload=function(){setTimeout(function(){window.print()},200)}<\/script></body></html>`;
    const w=window.open('', '_blank'); if(!w){ alert('اسمح بفتح نافذة الطباعة'); return; } w.document.open(); w.document.write(html); w.document.close();
  }

  function bind(){
    if(!$('monthly') || !$('mtBodyV10141')) return;
    if($('mtMonthV10141') && !$('mtMonthV10141').value) $('mtMonthV10141').value=todayYM();
    $('mtMonthV10141')?.addEventListener('change', load);
    $('mtSupervisorV10141')?.addEventListener('change', render);
    $('mtProjectV10141')?.addEventListener('change', render);
    $('mtRefreshV10141')?.addEventListener('click', load);
    $('mtPrintV10141')?.addEventListener('click', printReport);
    $('mtCsvV10141')?.addEventListener('click', exportCsv);
    $('mtManualSaveV10141')?.addEventListener('click', saveForm);
    $('mtManualClearV10141')?.addEventListener('click', clearForm);
    // load once, then again when the user opens monthly if other app data loaded late
    load();
  }

  window.TasneefMonthlyV10141 = { reload:load, edit:editManual, remove:removeManual, print:printReport, csv:exportCsv };
  window.renderMonthly = load;
  window.exportMonthlyCSV = exportCsv;
  window.printMonthlyReportV57 = printReport;

  document.addEventListener('DOMContentLoaded', bind, {once:true});
  window.addEventListener('load', () => setTimeout(bind, 350), {once:true});
  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest && e.target.closest('[onclick*="monthly"]');
    if(btn) setTimeout(load, 350);
  }, true);
})();

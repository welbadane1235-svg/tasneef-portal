
(function(){
  'use strict';
  if(window.__tasneefMonthlyProfessionalV10139) return;
  window.__tasneefMonthlyProfessionalV10139 = true;

  const SUPABASE_URL = 'https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const MANUAL_TABLE = 'monthly_time_manual_adjustments';
  const LOCAL_MANUAL_KEY = 'tasneef_monthly_manual_rows_professional_v10139';

  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const N = v => { const n = Number(String(v ?? '').replace(/,/g,'')); return Number.isFinite(n) ? n : 0; };
  const esc = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pad = n => String(n).padStart(2,'0');
  const todayMonth = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth()+1); };
  const fmtNum = (n, d=2) => (Math.round((Number(n)||0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
  const monthLabel = ym => { const [y,m]=S(ym).split('-'); return (m||'') + '-' + (y||''); };

  let state = {
    ready:false, loading:false, month:'', users:[], projects:[], usersById:{}, projectsById:{}, logsRaw:[], manualRaw:[], rows:[], filteredRows:[], manualOnline:true
  };

  function setStatus(text, cls){ const el=$('monthlyStatusV10139'); if(!el) return; el.textContent=text; el.className='badge '+(cls||'amber'); }
  function setMsg(text, err){ const el=$('monthlyMsg'); if(!el) return; el.textContent=text||''; el.className='msg '+(err?'err':''); el.classList.toggle('hidden', !text); }
  function getClient(){
    if(window.sb && typeof window.sb.from === 'function') return window.sb;
    if(window.supabase && typeof window.supabase.createClient === 'function'){
      try{ window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); return window.sb; }catch(_){ return null; }
    }
    return null;
  }
  function byId(rows){ const o={}; (rows||[]).forEach(r=>{ if(r && r.id != null) o[String(r.id)] = r; }); return o; }

  async function selectPaged(table, cols='*'){
    const sb=getClient(); if(!sb) return [];
    const out=[]; const size=1000; let from=0;
    for(let page=0; page<20; page++){
      try{
        const {data,error} = await sb.from(table).select(cols).range(from, from+size-1);
        if(error) throw error;
        if(Array.isArray(data)) out.push(...data);
        if(!data || data.length < size) break;
        from += size;
      }catch(e){
        console.warn('monthly select failed', table, e);
        break;
      }
    }
    return out;
  }

  function parseISOFromParts(y,m,d){
    y=Number(y); m=Number(m); d=Number(d);
    if(!y || !m || !d || m<1 || m>12 || d<1 || d>31) return '';
    return y+'-'+pad(m)+'-'+pad(d);
  }
  function dateVariants(value){
    const s=S(value); if(!s) return [];
    const out=[];
    let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(m) out.push(parseISOFromParts(m[1],m[2],m[3]));
    m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if(m){
      const a=Number(m[1]), b=Number(m[2]), y=Number(m[3]);
      if(a>12) out.push(parseISOFromParts(y,b,a));
      else if(b>12) out.push(parseISOFromParts(y,a,b));
      else { out.push(parseISOFromParts(y,b,a)); out.push(parseISOFromParts(y,a,b)); }
    }
    const d=new Date(s); if(!isNaN(d)) out.push(d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()));
    return [...new Set(out.filter(Boolean))];
  }
  function firstDate(value){ return dateVariants(value)[0] || ''; }
  function rowDateVariants(row){
    const fields=['log_date','date','day','work_date','attendance_date','created_at','updated_at','start_at','end_at'];
    let out=[]; fields.forEach(f=>{ if(row && row[f]) out.push(...dateVariants(row[f])); });
    return [...new Set(out)];
  }
  function rowInMonth(row, month){ return rowDateVariants(row).some(d=>d.startsWith(month)); }

  function timeToMinutes(t){ const m=S(t).match(/^(\d{1,2}):(\d{2})/); if(!m) return null; return Number(m[1])*60+Number(m[2]); }
  function diffMinutes(a,b){
    const st=timeToMinutes(a), en0=timeToMinutes(b); if(st==null || en0==null) return 0;
    let en=en0; if(en<st) en += 1440; return Math.max(0,en-st);
  }
  function pick(row, names){ for(const n of names){ if(S(row && row[n])) return S(row[n]); } return ''; }
  function lookupUser(id){ const u=state.usersById[String(id||'')]; return u ? S(u.full_name||u.username||u.name||id) : ''; }
  function lookupProject(id){ const p=state.projectsById[String(id||'')]; return p ? S(p.name||p.project_name||p.title||id) : ''; }

  function normalizeLog(row){
    const date = rowDateVariants(row).find(d=>d.startsWith(state.month)) || firstDate(pick(row,['log_date','date','day','work_date','attendance_date','created_at']));
    const uid = row.supervisor_id ?? row.user_id ?? row.created_by ?? row.worker_id ?? row.employee_id ?? '';
    const pid = row.project_id ?? row.site_id ?? row.building_id ?? '';
    const supervisor = pick(row,['supervisor_name','user_name','username','created_by_name','full_name','employee_name','worker_name','name']) || lookupUser(uid) || 'غير محدد';
    const project = pick(row,['project_name','project','building_name','site_name','projectTitle']) || lookupProject(pid) || 'غير محدد';
    const inTime = pick(row,['check_in','time_in','log_in','in_time','start_time','entry_time','start_at']);
    const outTime = pick(row,['check_out','time_out','log_out','out_time','end_time','exit_time','end_at']);
    let actual = N(row.actual_minutes||row.duration_minutes||row.total_minutes||row.minutes||row.work_minutes||row.actual_min||row.duration_min);
    if(!actual){ const h=N(row.actual_hours||row.duration_hours||row.total_hours||row.hours||row.work_hours); actual = h ? h*60 : diffMinutes(inTime,outTime); }
    let required = N(row.required_minutes||row.planned_minutes||row.target_minutes||row.expected_minutes||row.must_minutes||row.required_min);
    if(!required){ const h=N(row.required_hours||row.planned_hours||row.target_hours||row.expected_hours||row.must_hours); required = h ? h*60 : 0; }
    let travel = N(row.travel_minutes||row.transfer_minutes||row.lost_minutes||row.wasted_minutes||row.travel_time||row.log_travel);
    if(!travel && N(row.travel_hours)) travel=N(row.travel_hours)*60;
    const workers = pick(row,['worker_names','workers','worker_name','employees','team_names']);
    return {date, supervisor, project, supervisorId:String(uid||''), projectId:String(pid||''), workers, count:1, requiredMin:required, actualMin:actual, travelMin:travel, source:'السجلات'};
  }

  function getLocalManual(){ try{return JSON.parse(localStorage.getItem(LOCAL_MANUAL_KEY)||'[]')||[];}catch(_){return [];} }
  function setLocalManual(rows){ try{localStorage.setItem(LOCAL_MANUAL_KEY, JSON.stringify(rows||[]));}catch(_){} }

  async function loadManual(month){
    const sb=getClient();
    if(!sb){ state.manualOnline=false; return getLocalManual().filter(r=>r.month===month); }
    try{
      const {data,error}=await sb.from(MANUAL_TABLE).select('*').eq('month_key',month).order('created_at',{ascending:true});
      if(error) throw error;
      state.manualOnline=true;
      return (data||[]).map(r=>({id:r.id, month:r.month_key, supervisor:S(r.supervisor_name), project:S(r.project_name), workers:S(r.workers_names), count:N(r.records_count), requiredMin:N(r.required_minutes), actualMin:N(r.actual_minutes), travelMin:N(r.travel_minutes), percent:r.percent_override==null?'':N(r.percent_override), source:'تعديل يدوي'}));
    }catch(e){
      console.warn('monthly manual online failed', e);
      state.manualOnline=false;
      return getLocalManual().filter(r=>r.month===month);
    }
  }

  async function saveManual(row){
    const sb=getClient();
    if(sb){
      const payload={
        id: row.id || crypto.randomUUID(), month_key: row.month, supervisor_name: row.supervisor, project_name: row.project,
        workers_names: row.workers || '', records_count: N(row.count)||0, required_minutes: N(row.requiredMin)||0, actual_minutes: N(row.actualMin)||0, travel_minutes: N(row.travelMin)||0,
        percent_override: row.percent==='' || row.percent==null ? null : N(row.percent), updated_at: new Date().toISOString()
      };
      const {error}=await sb.from(MANUAL_TABLE).upsert(payload,{onConflict:'id'});
      if(error) throw error;
      return payload.id;
    }
    const rows=getLocalManual(); const id=row.id||Date.now().toString(36);
    const next={...row,id,source:'تعديل يدوي'}; const idx=rows.findIndex(r=>r.id===id);
    if(idx>=0) rows[idx]=next; else rows.push(next); setLocalManual(rows); return id;
  }
  async function deleteManual(id){
    const sb=getClient();
    if(sb){ const {error}=await sb.from(MANUAL_TABLE).delete().eq('id',id); if(error) throw error; return; }
    setLocalManual(getLocalManual().filter(r=>r.id!==id));
  }

  function aggregate(logs, manual){
    const map=new Map();
    logs.filter(r=>rowInMonth(r,state.month)).map(normalizeLog).forEach(x=>{
      const key=(x.supervisor||'غير محدد')+'||'+(x.project||'غير محدد');
      if(!map.has(key)) map.set(key,{id:key, source:'السجلات', supervisor:x.supervisor, project:x.project, workers:'', count:0, requiredMin:0, actualMin:0, travelMin:0, percent:''});
      const g=map.get(key); g.count += 1; g.requiredMin += x.requiredMin; g.actualMin += x.actualMin; g.travelMin += x.travelMin;
      if(x.workers && !g.workers.includes(x.workers)) g.workers = g.workers ? g.workers+', '+x.workers : x.workers;
    });
    (manual||[]).forEach(r=>{
      const key='manual-'+r.id;
      map.set(key,{...r, id:r.id, source:'تعديل يدوي', count:N(r.count)||0, requiredMin:N(r.requiredMin), actualMin:N(r.actualMin), travelMin:N(r.travelMin), percent:r.percent===''?'':N(r.percent)});
    });
    return [...map.values()].sort((a,b)=>S(a.supervisor).localeCompare(S(b.supervisor),'ar') || S(a.project).localeCompare(S(b.project),'ar'));
  }

  function calcPerf(r){
    if(r.percent !== '' && r.percent != null){ const p=N(r.percent); return {pct:p, label:p>=95?'ممتاز':p>=80?'جيد':'منخفض', cls:p>=95?'green':p>=80?'amber':'red'}; }
    if(!r.requiredMin) return {pct:0,label:'غير محدد',cls:'amber'};
    const p=Math.round((r.actualMin/r.requiredMin)*100); return {pct:p,label:p>=95?'ممتاز':p>=80?'جيد':'منخفض',cls:p>=95?'green':p>=80?'amber':'red'};
  }
  function applyFilters(rows){
    const sf=S($('monthlySupervisor')?.value), pf=S($('monthlyProject')?.value);
    return rows.filter(r=>(!sf || r.supervisor===sf) && (!pf || r.project===pf));
  }
  function fillFilters(){
    const supSel=$('monthlySupervisor'), prjSel=$('monthlyProject');
    const curS=S(supSel?.value), curP=S(prjSel?.value);
    const sups=[...new Set(state.rows.map(r=>r.supervisor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    const prjs=[...new Set(state.rows.map(r=>r.project).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    if(supSel) supSel.innerHTML='<option value="">كل المشرفين</option>'+sups.map(x=>`<option ${x===curS?'selected':''} value="${esc(x)}">${esc(x)}</option>`).join('');
    if(prjSel) prjSel.innerHTML='<option value="">كل المشاريع</option>'+prjs.map(x=>`<option ${x===curP?'selected':''} value="${esc(x)}">${esc(x)}</option>`).join('');
    const dlS=$('monthlySupervisorList'), dlP=$('monthlyProjectList');
    if(dlS){ const names=[...new Set([...sups, ...state.users.map(u=>S(u.full_name||u.username)).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'ar')); dlS.innerHTML=names.map(n=>`<option value="${esc(n)}"></option>`).join(''); }
    if(dlP){ const names=[...new Set([...prjs, ...state.projects.map(p=>S(p.name||p.project_name||p.title)).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'ar')); dlP.innerHTML=names.map(n=>`<option value="${esc(n)}"></option>`).join(''); }
  }
  function renderSummary(rows){
    const totalActual=rows.reduce((s,r)=>s+N(r.actualMin),0), totalReq=rows.reduce((s,r)=>s+N(r.requiredMin),0), totalTravel=rows.reduce((s,r)=>s+N(r.travelMin),0);
    const supCount=new Set(rows.map(r=>r.supervisor).filter(Boolean)).size, prjCount=new Set(rows.map(r=>r.project).filter(Boolean)).size, rec=rows.reduce((s,r)=>s+N(r.count),0);
    const holder=$('monthlySummary'); if(!holder) return;
    holder.innerHTML=`
      <div class="kpi"><small>إجمالي الوقت</small><b>${fmtNum(totalActual/60,2)} ساعة</b></div>
      <div class="kpi"><small>الساعات المطلوبة</small><b>${fmtNum(totalReq/60,2)}</b></div>
      <div class="kpi"><small>وقت الانتقال</small><b>${fmtNum(totalTravel/60,2)}</b></div>
      <div class="kpi"><small>المشرفين</small><b>${supCount}</b></div>
      <div class="kpi"><small>المشاريع</small><b>${prjCount}</b></div>
      <div class="kpi"><small>عدد السجلات</small><b>${rec}</b></div>`;
  }
  function renderTable(rows){
    const body=$('monthlyBody'); if(!body) return;
    if(!rows.length){ body.innerHTML='<tr><td colspan="11">لا توجد بيانات لهذا الشهر. اختر شهرًا آخر أو اضغط تحديث بعد التأكد من وجود تسجيلات يومية.</td></tr>'; return; }
    body.innerHTML=rows.map(r=>{ const p=calcPerf(r); return `<tr>
      <td>${esc(r.supervisor)}</td><td>${esc(r.project)}</td><td>${esc(r.workers||'-')}</td><td>${N(r.count)}</td>
      <td>${fmtNum(N(r.requiredMin)/60,2)}</td><td>${fmtNum(N(r.actualMin)/60,2)}</td><td>${fmtNum(N(r.travelMin)/60,2)}</td>
      <td>${p.pct}%</td><td><span class="badge ${p.cls}">${p.label}</span></td><td>${esc(r.source)}</td>
      <td>${r.source==='تعديل يدوي'?`<button class="light" onclick="TasneefMonthlyV10139.edit('${esc(r.id)}')">تعديل</button> <button class="danger" onclick="TasneefMonthlyV10139.remove('${esc(r.id)}')">حذف</button>`:'-'}</td>
    </tr>`; }).join('');
  }
  function rerender(){ state.filteredRows=applyFilters(state.rows); renderSummary(state.filteredRows); renderTable(state.filteredRows); setStatus(`تم تحميل ${state.filteredRows.length} صف`, 'green'); }

  async function loadLookups(){
    const [users,projects]=await Promise.all([selectPaged('app_users','id,username,full_name,role'), selectPaged('projects','id,name,project_name,title')]);
    state.users=users||[]; state.projects=projects||[]; state.usersById=byId(state.users); state.projectsById=byId(state.projects);
  }
  async function loadAllLogs(){ state.logsRaw = await selectPaged('time_logs','*'); }

  async function renderMonthly(force){
    if(state.loading) return;
    state.loading=true; setStatus('جاري التحميل...', 'amber'); setMsg('جاري تحميل بيانات الأوقات الشهرية...');
    try{
      const month=S($('monthlyMonth')?.value)||todayMonth(); state.month=month; if($('monthlyMonth')) $('monthlyMonth').value=month;
      await loadLookups();
      await loadAllLogs();
      state.manualRaw = await loadManual(month);
      state.rows = aggregate(state.logsRaw, state.manualRaw);
      fillFilters();
      rerender();
      const allInMonth=state.logsRaw.filter(r=>rowInMonth(r,month)).length;
      setMsg(`تم تحميل ${allInMonth} سجل يومي و ${state.manualRaw.length} تعديل يدوي لشهر ${monthLabel(month)}.${state.manualOnline?'':' ملاحظة: جدول التعديلات اليدوية غير مفعّل، تم استخدام التخزين المحلي مؤقتًا.'}`, false);
    }catch(e){
      console.error(e); setMsg('تعذر تحميل الأوقات الشهرية: '+(e.message||e), true); setStatus('خطأ', 'red');
    }finally{ state.loading=false; }
  }

  function clearManualForm(){ ['monthlyManualId','monthlyManualSupervisor','monthlyManualProject','monthlyManualWorkers','monthlyManualRequired','monthlyManualActual','monthlyManualTravel','monthlyManualPercent'].forEach(id=>{ if($(id)) $(id).value=''; }); }
  async function saveManualFromForm(){
    try{
      const month=S($('monthlyMonth')?.value)||todayMonth();
      const row={ id:S($('monthlyManualId')?.value)||'', month, supervisor:S($('monthlyManualSupervisor')?.value), project:S($('monthlyManualProject')?.value), workers:S($('monthlyManualWorkers')?.value), count:1, requiredMin:N($('monthlyManualRequired')?.value), actualMin:N($('monthlyManualActual')?.value), travelMin:N($('monthlyManualTravel')?.value), percent:S($('monthlyManualPercent')?.value)===''?'':N($('monthlyManualPercent')?.value), source:'تعديل يدوي' };
      if(!row.supervisor || !row.project) { alert('اكتب اسم المشرف واسم المشروع'); return; }
      await saveManual(row); clearManualForm(); await renderMonthly(true); setMsg('تم حفظ التعديل اليدوي وظهر في التقرير والطباعة.', false);
    }catch(e){ alert('تعذر حفظ التعديل: '+(e.message||e)); }
  }
  async function removeManual(id){ if(!confirm('حذف هذا التعديل اليدوي؟')) return; try{ await deleteManual(id); await renderMonthly(true); }catch(e){ alert('تعذر الحذف: '+(e.message||e)); } }
  function editManual(id){ const r=state.rows.find(x=>String(x.id)===String(id)); if(!r) return; $('monthlyManualId').value=r.id; $('monthlyManualSupervisor').value=r.supervisor; $('monthlyManualProject').value=r.project; $('monthlyManualWorkers').value=r.workers||''; $('monthlyManualRequired').value=N(r.requiredMin)||''; $('monthlyManualActual').value=N(r.actualMin)||''; $('monthlyManualTravel').value=N(r.travelMin)||''; $('monthlyManualPercent').value=r.percent===''?'':N(r.percent); window.scrollTo({top:document.getElementById('monthly')?.offsetTop||0,behavior:'smooth'}); }

  function csv(){
    const rows=state.filteredRows||[]; const headers=['المشرف','المشروع','أسماء العمال','عدد السجلات','الساعات المطلوبة','الساعات الفعلية','وقت الانتقال','نسبة العمل','حالة الأداء','المصدر'];
    const lines=[headers.join(',')].concat(rows.map(r=>{const p=calcPerf(r); return [r.supervisor,r.project,r.workers||'',N(r.count),fmtNum(N(r.requiredMin)/60,2),fmtNum(N(r.actualMin)/60,2),fmtNum(N(r.travelMin)/60,2),p.pct+'%',p.label,r.source].map(x=>'"'+S(x).replace(/"/g,'""')+'"').join(',');}));
    const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='monthly-times-'+(state.month||todayMonth())+'.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  }
  function printReport(){
    const rows=state.filteredRows||[]; const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية</title><style>body{font-family:Tahoma,Arial,sans-serif;margin:24px;color:#10231d}h1{margin:0 0 8px}.muted{color:#60706a}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}.kpi{border:1px solid #dce6e2;border-radius:12px;padding:10px}.kpi b{display:block;font-size:22px;color:#0A4033;margin-top:6px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:14px}th,td{border:1px solid #dce6e2;padding:8px;text-align:right}th{background:#f3f6f5}.foot{margin-top:18px;color:#60706a;font-size:12px}</style></head><body><h1>تقرير الأوقات الشهرية</h1><div class="muted">الشهر: ${esc(monthLabel(state.month||S($('monthlyMonth')?.value)||todayMonth()))}</div>${$('monthlySummary')?.outerHTML?.replace('id="monthlySummary"','class="kpis"')||''}<table><thead><tr><th>المشرف</th><th>المشروع</th><th>أسماء العمال</th><th>عدد السجلات</th><th>الساعات المطلوبة</th><th>الساعات الفعلية</th><th>وقت الانتقال</th><th>نسبة العمل</th><th>حالة الأداء</th><th>المصدر</th></tr></thead><tbody>${rows.map(r=>{const p=calcPerf(r); return `<tr><td>${esc(r.supervisor)}</td><td>${esc(r.project)}</td><td>${esc(r.workers||'-')}</td><td>${N(r.count)}</td><td>${fmtNum(N(r.requiredMin)/60,2)}</td><td>${fmtNum(N(r.actualMin)/60,2)}</td><td>${fmtNum(N(r.travelMin)/60,2)}</td><td>${p.pct}%</td><td>${p.label}</td><td>${esc(r.source)}</td></tr>`;}).join('') || '<tr><td colspan="10">لا توجد بيانات</td></tr>'}</tbody></table><div class="foot">تم إنشاء التقرير حسب البيانات الظاهرة بعد آخر تحديث/تعديل.</div><script>window.onload=function(){setTimeout(function(){window.print();},250)}<\/script></body></html>`;
    const w=window.open('', '_blank'); if(!w){ alert('اسمح بفتح النوافذ المنبثقة للطباعة'); return; } w.document.open(); w.document.write(html); w.document.close();
  }

  function init(){
    if(state.ready) return; if(!$('monthly')) return; state.ready=true;
    if($('monthlyMonth') && !$('monthlyMonth').value) $('monthlyMonth').value=todayMonth();
    $('monthlyMonth')?.addEventListener('change',()=>renderMonthly(true));
    $('monthlySupervisor')?.addEventListener('change',rerender);
    $('monthlyProject')?.addEventListener('change',rerender);
    $('monthlyRefreshBtn')?.addEventListener('click',()=>renderMonthly(true));
    $('monthlyPrintBtn')?.addEventListener('click',printReport);
    $('monthlyCsvBtn')?.addEventListener('click',csv);
    $('monthlyManualSaveBtn')?.addEventListener('click',saveManualFromForm);
    $('monthlyManualClearBtn')?.addEventListener('click',clearManualForm);
    renderMonthly();
  }

  window.TasneefMonthlyV10139={edit:editManual, remove:removeManual, reload:renderMonthly};
  window.renderMonthly=renderMonthly;
  window.exportMonthlyCSV=csv;
  window.printMonthlyReportV57=printReport;
  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', init);
})();

(function(){
  'use strict';
  if(window.__tasneefMonthlyStableV10138) return;
  window.__tasneefMonthlyStableV10138 = true;

  const SUPABASE_URL = 'https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const $ = (id)=>document.getElementById(id);
  const S = (v)=>String(v ?? '').trim();
  const N = (v)=>{ const n = Number(String(v ?? '').replace(/,/g,'')); return Number.isFinite(n) ? n : 0; };
  const esc = (v)=>S(v).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pad = (n)=>String(n).padStart(2,'0');
  const nowMonth = ()=>{ const d=new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1); };
  const nextMonth = (ym)=>{ const [y,m]=S(ym).split('-').map(Number); const d=new Date(y || new Date().getFullYear(), (m||1), 1); return d.getFullYear()+'-'+pad(d.getMonth()+1); };
  const fmt = (n,d=2)=> (Math.round((Number(n)||0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
  const MANUAL_KEY = 'tasneef_monthly_manual_rows_v10138';

  let state = {month:'', loading:false, lookups:{users:[],projects:[],usersById:{},projectsById:{}}, logs:[], rows:[], manual:[]};
  let seq = 0;

  function getClient(){
    if(window.sb && typeof window.sb.from === 'function') return window.sb;
    if(window.supabase && typeof window.supabase.createClient === 'function'){
      try{ window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); return window.sb; }catch(_){ return null; }
    }
    return null;
  }

  function byId(arr){ const o={}; (arr||[]).forEach(x=>{ if(x && x.id != null) o[String(x.id)] = x; }); return o; }
  async function safeSelect(table, cols='*'){
    const sb=getClient(); if(!sb) return [];
    try{ const {data,error}=await sb.from(table).select(cols).limit(10000); if(error) return []; return Array.isArray(data)?data:[]; }catch(_){ return []; }
  }

  function parseDate(v){
    const s = S(v); if(!s) return '';
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if(iso) return iso[1]+'-'+pad(iso[2])+'-'+pad(iso[3]);
    const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if(dmy){
      let a=Number(dmy[1]), b=Number(dmy[2]), y=Number(dmy[3]);
      // Arabic operational records are usually day/month/year. If ambiguous, keep day/month.
      let day=a, month=b;
      if(a<=12 && b>12){ month=a; day=b; }
      return y+'-'+pad(month)+'-'+pad(day);
    }
    const d = new Date(s); if(!isNaN(d)) return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
    return '';
  }

  function monthOf(v){ return parseDate(v).slice(0,7); }
  function minutesBetween(a,b){
    a=S(a); b=S(b);
    if(!/^\d{1,2}:\d{2}/.test(a) || !/^\d{1,2}:\d{2}/.test(b)) return 0;
    const [ah,am]=a.split(':').map(Number), [bh,bm]=b.split(':').map(Number);
    let st=ah*60+am, en=bh*60+bm; if(en<st) en += 1440;
    return Math.max(0,en-st);
  }

  function getManual(){ try{ return JSON.parse(localStorage.getItem(MANUAL_KEY)||'[]')||[]; }catch(_){ return []; } }
  function setManual(rows){ try{ localStorage.setItem(MANUAL_KEY, JSON.stringify(rows||[])); }catch(_){ } }

  function localLogs(month){
    const out=[];
    try{
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i)||'';
        if(!/(time|log|سجل|daily|attendance)/i.test(k)) continue;
        try{
          const val=JSON.parse(localStorage.getItem(k)||'null');
          const walk=(x)=>{
            if(Array.isArray(x)) return x.forEach(walk);
            if(x && typeof x==='object'){
              const dt=parseDate(x.log_date||x.date||x.day||x.attendance_date||x.created_at);
              if(dt && dt.startsWith(month)) out.push({...x,__local_key:k});
              Object.keys(x).forEach(key=>{ if(x[key] && typeof x[key]==='object') walk(x[key]); });
            }
          };
          walk(val);
        }catch(_){ }
      }
    }catch(_){ }
    return out;
  }

  function pickName(id, raw, table, fields, fallback){
    for(const f of fields){ if(S(raw[f])) return S(raw[f]); }
    const obj = table[String(id||'')];
    const val = obj ? (obj.full_name||obj.username||obj.name||obj.project_name||obj.title) : '';
    return S(val || fallback || id || 'غير محدد');
  }

  function normalizeLog(r){
    const dt = parseDate(r.log_date||r.date||r.day||r.attendance_date||r.created_at);
    const uid = r.supervisor_id ?? r.user_id ?? r.created_by ?? r.worker_id ?? r.employee_id ?? '';
    const pid = r.project_id ?? r.building_id ?? r.site_id ?? '';
    const supervisor = pickName(uid, r, state.lookups.usersById, ['supervisor_name','user_name','username','created_by_name','full_name','employee_name','worker_name','name'], 'غير محدد');
    const project = pickName(pid, r, state.lookups.projectsById, ['project_name','project','building_name','site_name','projectTitle'], 'غير محدد');
    const inTime=S(r.check_in||r.time_in||r.log_in||r.in_time||r.start_time||r.entry_time);
    const outTime=S(r.check_out||r.time_out||r.log_out||r.out_time||r.end_time||r.exit_time);
    let actual=N(r.actual_minutes||r.duration_minutes||r.total_minutes||r.minutes||r.work_minutes);
    if(!actual){ const h=N(r.actual_hours||r.duration_hours||r.total_hours||r.hours||r.work_hours); actual = h ? h*60 : minutesBetween(inTime,outTime); }
    let required=N(r.required_minutes||r.planned_minutes||r.target_minutes||r.expected_minutes||r.must_minutes);
    if(!required){ const h=N(r.required_hours||r.planned_hours||r.target_hours||r.expected_hours||r.must_hours); required = h ? h*60 : 0; }
    let travel=N(r.travel_minutes||r.transfer_minutes||r.lost_minutes||r.wasted_minutes||r.travel_time||r.log_travel);
    if(!travel && N(r.travel_hours)) travel=N(r.travel_hours)*60;
    return {date:dt, supervisor, project, supervisorId:uid, projectId:pid, count:1, requiredMin:required, actualMin:actual, travelMin:travel, workers:S(r.worker_names||r.workers||r.worker_name||'')};
  }

  function aggregate(logs, supervisorFilter){
    const map=new Map();
    logs.map(normalizeLog).filter(x=>x.date && x.date.startsWith(state.month)).forEach(x=>{
      if(supervisorFilter && x.supervisor !== supervisorFilter && String(x.supervisorId)!==supervisorFilter) return;
      const key=x.supervisor+'||'+x.project;
      if(!map.has(key)) map.set(key,{id:key, source:'logs', supervisor:x.supervisor, project:x.project, workers:'', count:0, requiredMin:0, actualMin:0, travelMin:0, percent:null});
      const g=map.get(key);
      g.count += 1; g.requiredMin += x.requiredMin; g.actualMin += x.actualMin; g.travelMin += x.travelMin;
      if(x.workers) g.workers = g.workers ? g.workers+', '+x.workers : x.workers;
    });
    const manual = getManual().filter(r=>r.month===state.month).filter(r=>!supervisorFilter || r.supervisor===supervisorFilter);
    manual.forEach(r=>{
      map.set('manual-'+r.id,{...r, source:'manual', count:N(r.count), requiredMin:N(r.requiredMin), actualMin:N(r.actualMin), travelMin:N(r.travelMin), percent:r.percent===''?null:N(r.percent)});
    });
    return [...map.values()].sort((a,b)=>S(a.supervisor).localeCompare(S(b.supervisor),'ar') || S(a.project).localeCompare(S(b.project),'ar'));
  }

  function perf(r){
    if(r.percent != null && r.percent !== '') return {pct:N(r.percent), label:N(r.percent)>=95?'ممتاز':N(r.percent)>=80?'جيد':'منخفض', cls:N(r.percent)>=95?'green':N(r.percent)>=80?'amber':'red'};
    if(!r.requiredMin) return {pct:0,label:'لا يوجد وقت مطلوب',cls:'amber'};
    const pct=Math.round((r.actualMin/r.requiredMin)*100);
    return {pct,label:pct>=95?'ممتاز':pct>=80?'جيد':'منخفض',cls:pct>=95?'green':pct>=80?'amber':'red'};
  }

  function buildUI(){
    const sec=$('monthly'); if(!sec || sec.dataset.v10138Built) return;
    sec.dataset.v10138Built='1';
    sec.innerHTML = `
      <div class="card monthly-root-v10138">
        <h2>الأوقات الشهرية</h2>
        <div id="monthlyMsgV10138" class="msg hidden"></div>
        <div class="filters monthly-filters-v10138">
          <input type="month" id="monthlyMonth" value="${nowMonth()}">
          <select id="monthlySupervisor"><option value="">كل المشرفين</option></select>
          <button type="button" id="monthlyRefreshV10138" class="light">تحديث الأوقات</button>
          <button type="button" id="monthlyPrintV10138">طباعة تقرير الأوقات الشهرية</button>
          <button type="button" id="monthlyCsvV10138">تصدير CSV</button>
        </div>
        <div id="monthlySummary" class="kpis small"></div>
        <div class="card" style="box-shadow:none;margin-top:14px">
          <h2 style="font-size:20px">تعديل يدوي للأوقات الشهرية</h2>
          <div class="filters">
            <input id="monthlyManualSupervisor" list="monthlySupervisorListV10138" placeholder="اسم المشرف">
            <datalist id="monthlySupervisorListV10138"></datalist>
            <input id="monthlyManualProject" list="monthlyProjectListV10138" placeholder="اسم المشروع">
            <datalist id="monthlyProjectListV10138"></datalist>
            <input id="monthlyManualWorkers" placeholder="أسماء العمال - يمكن الإضافة والحذف">
            <input id="monthlyManualActual" type="number" step="1" placeholder="الدقائق الفعلية اختياري">
            <input id="monthlyManualPercent" type="number" step="1" placeholder="النسبة %">
            <button type="button" id="monthlyManualAddV10138">إضافة / تحديث صف</button>
          </div>
          <div class="footer-note">التعديل اليدوي يثبت في التقرير والطباعة فورًا، ومربوط بالشهر المختار.</div>
        </div>
        <div class="table-wrap"><table><thead><tr><th>المشرف</th><th>المشروع</th><th>أسماء العمال</th><th>عدد السجلات</th><th>الساعات المطلوبة</th><th>الساعات الفعلية</th><th>وقت الانتقال</th><th>نسبة العمل %</th><th>حالة الأداء</th><th>إجراء</th></tr></thead><tbody id="monthlyBody"></tbody></table></div>
      </div>`;
    const style=document.createElement('style');
    style.textContent = `
      #monthly .monthly-root-v10138 .filters{align-items:end} #monthly .footer-note{color:#60706a;font-size:13px;margin:8px 0 12px;line-height:1.7}
      #monthly .monthly-row-actions{display:flex;gap:6px;flex-wrap:wrap} #monthly .monthly-row-actions button{padding:7px 10px;font-size:12px;border-radius:9px}
      #monthlyPrintHolderV10138{display:none!important}
      @media print{body *{visibility:hidden!important}#monthlyPrintHolderV10138{display:block!important}.monthly-print-v10138,.monthly-print-v10138 *{visibility:visible!important}.monthly-print-v10138{position:absolute;inset:0;background:#fff;width:100%;padding:18px;color:#111}.monthly-print-v10138 table{width:100%;border-collapse:collapse;font-size:12px}.monthly-print-v10138 th,.monthly-print-v10138 td{border:1px solid #ddd;padding:8px;text-align:right;white-space:normal}.monthly-print-v10138 h1,.monthly-print-v10138 h2{margin:0 0 10px}.monthly-print-v10138 .print-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.monthly-print-v10138 .print-kpis div{border:1px solid #ddd;border-radius:10px;padding:10px}}
    `;
    document.head.appendChild(style);
    $('monthlyMonth')?.addEventListener('change',()=>window.renderMonthly());
    $('monthlySupervisor')?.addEventListener('change',()=>renderOnly());
    $('monthlyRefreshV10138')?.addEventListener('click',()=>window.renderMonthly(true));
    $('monthlyPrintV10138')?.addEventListener('click',()=>window.printMonthlyReportV57());
    $('monthlyCsvV10138')?.addEventListener('click',()=>window.exportMonthlyCSV());
    $('monthlyManualAddV10138')?.addEventListener('click',saveManualFromForm);
  }

  function setMsg(text, err){ const el=$('monthlyMsgV10138'); if(!el) return; el.textContent=text||''; el.className='msg '+(err?'err':''); el.classList.toggle('hidden', !text); }

  async function loadLookups(){
    const [users,projects]=await Promise.all([safeSelect('app_users','id,username,full_name,role'), safeSelect('projects','id,name,project_name,title')]);
    state.lookups={users,projects,usersById:byId(users),projectsById:byId(projects)};
    const supNames=[...new Set(users.filter(u=>/supervisor|admin|manager/i.test(S(u.role))).map(u=>S(u.full_name||u.username)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    const projNames=[...new Set(projects.map(p=>S(p.name||p.project_name||p.title)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    const dlS=$('monthlySupervisorListV10138'), dlP=$('monthlyProjectListV10138');
    if(dlS) dlS.innerHTML=supNames.map(n=>`<option value="${esc(n)}"></option>`).join('');
    if(dlP) dlP.innerHTML=projNames.map(n=>`<option value="${esc(n)}"></option>`).join('');
  }

  async function loadLogs(month){
    const sb=getClient(); let logs=[]; const start=month+'-01', end=nextMonth(month)+'-01';
    if(sb){
      const tries=[
        q=>q.gte('log_date',start).lt('log_date',end), q=>q.gte('date',start).lt('date',end), q=>q.gte('created_at',start).lt('created_at',end)
      ];
      for(const t of tries){ try{ const {data,error}=await t(sb.from('time_logs').select('*')).limit(10000); if(!error && Array.isArray(data) && data.length){ logs=data; break; } }catch(_){ } }
      if(!logs.length){
        try{ const {data,error}=await sb.from('time_logs').select('*').limit(10000); if(!error && Array.isArray(data)) logs=data.filter(r=>monthOf(r.log_date||r.date||r.day||r.attendance_date||r.created_at)===month); }catch(_){ }
      }
    }
    const loc=localLogs(month);
    // Merge without strict dedupe because old records often have no stable id.
    if(loc.length) logs = logs.concat(loc);
    return logs;
  }

  function fillSupervisorSelect(){
    const sel=$('monthlySupervisor'); if(!sel) return;
    const old=sel.value;
    const names=new Set();
    state.lookups.users.filter(u=>/supervisor|admin|manager/i.test(S(u.role))).forEach(u=>{ const n=S(u.full_name||u.username); if(n) names.add(n); });
    state.logs.map(normalizeLog).forEach(x=>{ if(x.supervisor && x.supervisor!=='غير محدد') names.add(x.supervisor); });
    getManual().filter(r=>r.month===state.month).forEach(r=>{ if(r.supervisor) names.add(r.supervisor); });
    sel.innerHTML='<option value="">كل المشرفين</option>'+[...names].sort((a,b)=>a.localeCompare(b,'ar')).map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
    if(old && [...sel.options].some(o=>o.value===old)) sel.value=old;
  }

  function calcRows(){
    const filter=$('monthlySupervisor')?.value||'';
    state.rows = aggregate(state.logs, filter);
  }

  function renderSummary(){
    const s=state.rows.reduce((a,r)=>{a.count+=N(r.count);a.req+=N(r.requiredMin);a.act+=N(r.actualMin);a.travel+=N(r.travelMin);return a;},{count:0,req:0,act:0,travel:0});
    const box=$('monthlySummary'); if(!box) return;
    box.innerHTML=`<div class="kpi"><small>عدد السجلات</small><b>${s.count}</b></div><div class="kpi"><small>الساعات المطلوبة</small><b>${fmt(s.req/60)}</b></div><div class="kpi"><small>الساعات الفعلية</small><b>${fmt(s.act/60)}</b></div><div class="kpi"><small>وقت الانتقال بالدقائق</small><b>${fmt(s.travel,0)}</b></div>`;
  }

  function renderRows(){
    const body=$('monthlyBody'); if(!body) return;
    if(!state.rows.length){ body.innerHTML='<tr><td colspan="10">لا توجد بيانات لهذا الشهر. اختر شهرًا آخر ثم اضغط تحديث الأوقات، أو أضف صفًا يدويًا.</td></tr>'; return; }
    body.innerHTML=state.rows.map(r=>{ const p=perf(r); return `<tr>
      <td>${esc(r.supervisor)}</td><td>${esc(r.project)}</td><td>${esc(r.workers||'')}</td><td>${N(r.count)}</td><td>${fmt(N(r.requiredMin)/60)}</td><td>${fmt(N(r.actualMin)/60)}</td><td>${fmt(N(r.travelMin),0)} د</td><td>${r.percent!=null && r.percent!=='' ? fmt(r.percent,0)+'%' : (r.requiredMin?p.pct+'%':'-')}</td><td><span class="badge ${p.cls}">${p.label}</span></td><td>${r.source==='manual'?`<div class="monthly-row-actions"><button class="light" onclick="monthlyEditManualV10138('${r.id}')">تعديل</button><button class="danger" onclick="monthlyDeleteManualV10138('${r.id}')">حذف</button></div>`:''}</td>
    </tr>`; }).join('');
  }

  function renderOnly(){ calcRows(); renderSummary(); renderRows(); }

  function saveManualFromForm(){
    const month=$('monthlyMonth')?.value||nowMonth();
    const supervisor=S($('monthlyManualSupervisor')?.value); const project=S($('monthlyManualProject')?.value);
    if(!supervisor || !project){ setMsg('اختر/اكتب اسم المشرف واسم المشروع أولًا.', true); return; }
    const rows=getManual();
    const id=month+'_'+supervisor+'_'+project;
    const old=rows.find(r=>r.id===id) || {};
    const row={...old,id,month,supervisor,project,workers:S($('monthlyManualWorkers')?.value),count:0,requiredMin:0,actualMin:N($('monthlyManualActual')?.value),travelMin:0,percent:S($('monthlyManualPercent')?.value)};
    const idx=rows.findIndex(r=>r.id===id); if(idx>=0) rows[idx]=row; else rows.push(row);
    setManual(rows); setMsg('تم تحديث الصف اليدوي وسيظهر في الطباعة فورًا.', false); renderOnly();
  }

  window.monthlyEditManualV10138=function(id){ const r=getManual().find(x=>x.id===id); if(!r) return; $('monthlyManualSupervisor').value=r.supervisor||''; $('monthlyManualProject').value=r.project||''; $('monthlyManualWorkers').value=r.workers||''; $('monthlyManualActual').value=r.actualMin||''; $('monthlyManualPercent').value=r.percent||''; window.scrollTo({top: $('monthly')?.offsetTop||0, behavior:'smooth'}); };
  window.monthlyDeleteManualV10138=function(id){ if(!confirm('حذف الصف اليدوي؟')) return; setManual(getManual().filter(r=>r.id!==id)); renderOnly(); };

  window.renderMonthly = async function(force){
    buildUI(); const month=$('monthlyMonth')?.value||nowMonth(); state.month=month; const my=++seq;
    setMsg('جاري تحميل بيانات الأوقات الشهرية...', false);
    if(force){ state.logs=[]; state.rows=[]; }
    try{
      await loadLookups(); if(my!==seq) return;
      state.logs=await loadLogs(month); if(my!==seq) return;
      fillSupervisorSelect(); renderOnly();
      setMsg(state.rows.length ? '' : 'لا توجد بيانات لهذا الشهر. إذا كانت البيانات قديمة اختر الشهر الصحيح أو أضف صفًا يدويًا.', false);
    }catch(e){ console.error(e); setMsg('تعذر تحميل الأوقات الشهرية: '+(e.message||e), true); renderOnly(); }
  };

  window.exportMonthlyCSV=function(){
    buildUI(); renderOnly();
    const header=['المشرف','المشروع','أسماء العمال','عدد السجلات','الساعات المطلوبة','الساعات الفعلية','وقت الانتقال بالدقائق','نسبة العمل','حالة الأداء'];
    const lines=[header].concat(state.rows.map(r=>{const p=perf(r);return [r.supervisor,r.project,r.workers||'',N(r.count),fmt(N(r.requiredMin)/60),fmt(N(r.actualMin)/60),fmt(N(r.travelMin),0),r.percent!=null&&r.percent!==''?fmt(r.percent,0)+'%':(r.requiredMin?p.pct+'%':'-'),p.label];}));
    const csv='\uFEFF'+lines.map(row=>row.map(v=>'"'+S(v).replace(/"/g,'""')+'"').join(',')).join('\n');
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download='monthly-times-'+(state.month||nowMonth())+'.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };

  window.printMonthlyReportV57=function(){
    buildUI(); renderOnly();
    const s=state.rows.reduce((a,r)=>{a.count+=N(r.count);a.req+=N(r.requiredMin);a.act+=N(r.actualMin);a.travel+=N(r.travelMin);return a;},{count:0,req:0,act:0,travel:0});
    const html=`<div class="monthly-print-v10138"><h1>تقرير الأوقات الشهرية</h1><h2>الشهر: ${esc(state.month||$('monthlyMonth')?.value||nowMonth())}</h2><div class="print-kpis"><div><b>عدد السجلات</b><br>${s.count}</div><div><b>الساعات المطلوبة</b><br>${fmt(s.req/60)}</div><div><b>الساعات الفعلية</b><br>${fmt(s.act/60)}</div><div><b>وقت الانتقال</b><br>${fmt(s.travel,0)} دقيقة</div></div><table><thead><tr><th>المشرف</th><th>المشروع</th><th>أسماء العمال</th><th>عدد السجلات</th><th>الساعات المطلوبة</th><th>الساعات الفعلية</th><th>وقت الانتقال</th><th>نسبة العمل</th><th>حالة الأداء</th></tr></thead><tbody>${state.rows.length?state.rows.map(r=>{const p=perf(r);return `<tr><td>${esc(r.supervisor)}</td><td>${esc(r.project)}</td><td>${esc(r.workers||'')}</td><td>${N(r.count)}</td><td>${fmt(N(r.requiredMin)/60)}</td><td>${fmt(N(r.actualMin)/60)}</td><td>${fmt(N(r.travelMin),0)} د</td><td>${r.percent!=null&&r.percent!==''?fmt(r.percent,0)+'%':(r.requiredMin?p.pct+'%':'-')}</td><td>${p.label}</td></tr>`;}).join(''):'<tr><td colspan="9">لا توجد بيانات</td></tr>'}</tbody></table><p style="margin-top:14px;color:#555">تم إنشاء التقرير من البيانات الظاهرة حاليًا بعد آخر تعديل.</p></div>`;
    let holder=$('monthlyPrintHolderV10138'); if(!holder){ holder=document.createElement('div'); holder.id='monthlyPrintHolderV10138'; document.body.appendChild(holder); }
    holder.innerHTML=html; setTimeout(()=>window.print(),150); setTimeout(()=>{ try{ holder.innerHTML=''; }catch(e){} }, 2500);
  };
  window.printMonthlyReport=window.printMonthlyReportV57;

  function hookPage(){
    const oldShow=window.showPage;
    if(typeof oldShow==='function' && !oldShow.__monthlyV10138){
      window.showPage=function(id,btn){ const res=oldShow.apply(this,arguments); if(id==='monthly'){ setTimeout(()=>window.renderMonthly(),60); } return res; };
      window.showPage.__monthlyV10138=true;
    }
  }
  document.addEventListener('DOMContentLoaded',()=>{ buildUI(); hookPage(); if(location.hash==='#monthly' || ($('monthly') && !$('monthly').classList.contains('hidden'))) setTimeout(()=>window.renderMonthly(),250); });
})();

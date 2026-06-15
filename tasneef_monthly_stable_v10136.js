(function(){
  'use strict';
  if(window.__tasneefMonthlyStableV10135) return;
  window.__tasneefMonthlyStableV10135 = true;

  const SUPABASE_URL = 'https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const $ = (id)=>document.getElementById(id);
  const S = (v)=>String(v ?? '').trim();
  const N = (v)=>{ const n = Number(String(v ?? '').replace(/,/g,'')); return Number.isFinite(n) ? n : 0; };
  const esc = (v)=>S(v).replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const pad = (n)=>String(n).padStart(2,'0');
  const todayMonth = ()=>{ const d=new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1); };
  const nextMonth = (ym)=>{ const [y,m]=S(ym).split('-').map(Number); const d=new Date(y, (m||1), 1); return d.getFullYear()+'-'+pad(d.getMonth()+1); };
  const fmt = (n, digits=2)=> (Math.round((Number(n)||0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
  const byId = (arr)=>Object.fromEntries((arr||[]).map(x=>[String(x.id), x]));

  let renderSeq = 0;
  let monthlyCache = { month:'', rows:[], summary:{}, logs:[] };

  function getClient(){
    if(window.sb && typeof window.sb.from === 'function') return window.sb;
    if(window.supabase && typeof window.supabase.createClient === 'function'){
      try{
        window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return window.sb;
      }catch(_){ return null; }
    }
    return null;
  }

  function msgMonthly(text, err){
    const el = $('monthlyMsgV10135') || document.createElement('div');
    if(!el.id){
      el.id='monthlyMsgV10135';
      el.className='msg';
      const section = $('monthly');
      const card = section?.querySelector('.card');
      card?.insertBefore(el, card.children[1] || null);
    }
    el.textContent = text || '';
    el.className = 'msg ' + (err ? 'err' : '');
    el.classList.toggle('hidden', !text);
  }

  function addControls(){
    const section = $('monthly');
    if(!section || section.dataset.v10135Ready) return;
    section.dataset.v10135Ready='1';
    const filters = section.querySelector('.filters');
    if(filters){
      if(!$('monthlyRefreshV10135')){
        const btn=document.createElement('button');
        btn.id='monthlyRefreshV10135';
        btn.type='button';
        btn.className='light';
        btn.textContent='تحديث الأوقات';
        btn.onclick=()=>window.renderMonthly();
        filters.appendChild(btn);
      }
    }
    const style=document.createElement('style');
    style.textContent = `
      #monthly .monthly-stable-note{background:#f8fbfa;border:1px dashed #dce6e2;border-radius:14px;padding:10px;margin:10px 0;color:#60706a;line-height:1.7;font-size:13px}
      #monthly .monthly-actions-v10135{display:flex;gap:6px;justify-content:flex-start;flex-wrap:wrap}
      #monthly .monthly-actions-v10135 button{padding:7px 10px;border-radius:9px;font-size:12px}
      @media print{body *{visibility:hidden!important}.monthly-print-v10135,.monthly-print-v10135 *{visibility:visible!important}.monthly-print-v10135{position:absolute;inset:0;background:#fff;width:100%;padding:18px;color:#111}.monthly-print-v10135 table{width:100%;border-collapse:collapse;font-size:12px}.monthly-print-v10135 th,.monthly-print-v10135 td{border:1px solid #ddd;padding:8px;text-align:right;white-space:normal}.monthly-print-v10135 h1,.monthly-print-v10135 h2{margin:0 0 10px}.monthly-print-v10135 .print-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.monthly-print-v10135 .print-kpis div{border:1px solid #ddd;border-radius:10px;padding:10px}}
    `;
    document.head.appendChild(style);
  }

  async function safeSelect(table, cols='*'){
    const sb=getClient(); if(!sb) return [];
    try{ const {data,error}=await sb.from(table).select(cols); if(error) return []; return data||[]; }catch(_){ return []; }
  }

  async function loadLookups(){
    const [users, projects] = await Promise.all([
      safeSelect('app_users','id,username,full_name,role'),
      safeSelect('projects','id,name,project_name,title')
    ]);
    return { users, projects, usersById:byId(users), projectsById:byId(projects) };
  }

  function localLogsForMonth(month){
    const out=[];
    const keys=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i)||'';
      if(/time|log|سجل|daily/i.test(k)) keys.push(k);
    }
    keys.forEach(k=>{
      try{
        const val=JSON.parse(localStorage.getItem(k)||'null');
        const walk=(x)=>{
          if(Array.isArray(x)) return x.forEach(walk);
          if(x && typeof x==='object'){
            const d=S(x.log_date||x.date||x.day||x.attendance_date||x.created_at).slice(0,10);
            if(d && d.startsWith(month)) out.push({...x,__source:k});
            Object.keys(x).forEach(key=>{ if(typeof x[key]==='object') walk(x[key]); });
          }
        };
        walk(val);
      }catch(_){ }
    });
    return out;
  }

  async function loadTimeLogs(month){
    const sb=getClient();
    const start = month + '-01';
    const end = nextMonth(month) + '-01';
    let logs=[];
    if(sb){
      const attempts = [
        q=>q.gte('log_date', start).lt('log_date', end).order('log_date',{ascending:true}),
        q=>q.gte('date', start).lt('date', end).order('date',{ascending:true}),
        q=>q.gte('created_at', start).lt('created_at', end).order('created_at',{ascending:true})
      ];
      for(const build of attempts){
        try{
          const {data,error}=await build(sb.from('time_logs').select('*')).limit(5000);
          if(!error && Array.isArray(data)){ logs=data; break; }
        }catch(_){ }
      }
    }
    if(!logs.length) logs = localLogsForMonth(month);
    return logs;
  }

  function minutesBetween(a,b){
    a=S(a); b=S(b);
    if(!a || !b || !/^\d{1,2}:\d{2}/.test(a) || !/^\d{1,2}:\d{2}/.test(b)) return 0;
    const [ah,am]=a.split(':').map(Number), [bh,bm]=b.split(':').map(Number);
    let start=ah*60+am, end=bh*60+bm;
    if(end<start) end += 24*60;
    return Math.max(0,end-start);
  }

  function pickName(id, raw, map, fields){
    for(const f of fields){ if(S(raw[f])) return S(raw[f]); }
    const obj = map[String(id||'')];
    return S(obj?.full_name || obj?.username || obj?.name || obj?.project_name || obj?.title || id || 'غير محدد');
  }

  function normalizeLog(r, lookups){
    const date = S(r.log_date||r.date||r.day||r.attendance_date||r.created_at).slice(0,10);
    const supervisorId = r.supervisor_id ?? r.user_id ?? r.created_by ?? r.worker_id ?? r.employee_id ?? '';
    const projectId = r.project_id ?? r.building_id ?? '';
    const supervisor = pickName(supervisorId, r, lookups.usersById, ['supervisor_name','user_name','username','created_by_name','full_name','employee_name','worker_name']);
    const project = pickName(projectId, r, lookups.projectsById, ['project_name','project','building_name','site_name']);
    const inTime = S(r.check_in||r.time_in||r.log_in||r.in_time||r.start_time||r.entry_time);
    const outTime = S(r.check_out||r.time_out||r.log_out||r.out_time||r.end_time||r.exit_time);
    let actualMin = N(r.actual_minutes||r.duration_minutes||r.total_minutes||r.minutes);
    if(!actualMin){
      const h = N(r.actual_hours||r.duration_hours||r.total_hours||r.hours||r.work_hours);
      actualMin = h ? h*60 : minutesBetween(inTime,outTime);
    }
    let reqMin = N(r.required_minutes||r.planned_minutes||r.target_minutes||r.expected_minutes);
    if(!reqMin){
      const h=N(r.required_hours||r.planned_hours||r.target_hours||r.expected_hours||r.must_hours);
      reqMin = h ? h*60 : 0;
    }
    let travelMin = N(r.travel_minutes||r.transfer_minutes||r.lost_minutes||r.wasted_minutes||r.travel_time||r.log_travel);
    if(!travelMin && N(r.travel_hours)) travelMin=N(r.travel_hours)*60;
    return { raw:r, date, supervisor, project, supervisorId, projectId, actualMin, reqMin, travelMin };
  }

  function aggregate(logs, lookups, filterSupervisor){
    const map = new Map();
    logs.map(r=>normalizeLog(r,lookups)).filter(x=>x.date).forEach(x=>{
      if(filterSupervisor && x.supervisor !== filterSupervisor && String(x.supervisorId) !== filterSupervisor) return;
      const key = x.supervisor + '||' + x.project;
      if(!map.has(key)) map.set(key,{supervisor:x.supervisor, project:x.project, count:0, requiredMin:0, actualMin:0, travelMin:0});
      const g=map.get(key);
      g.count += 1;
      g.requiredMin += x.reqMin;
      g.actualMin += x.actualMin;
      g.travelMin += x.travelMin;
    });
    return [...map.values()].sort((a,b)=>a.supervisor.localeCompare(b.supervisor,'ar') || a.project.localeCompare(b.project,'ar'));
  }

  function performance(row){
    if(!row.requiredMin) return {pct:0,label:'لا يوجد وقت مطلوب', cls:'amber'};
    const pct=Math.round((row.actualMin/row.requiredMin)*100);
    if(pct>=95) return {pct,label:'ممتاز', cls:'green'};
    if(pct>=80) return {pct,label:'جيد', cls:'amber'};
    return {pct,label:'منخفض', cls:'red'};
  }

  function renderSummary(rows){
    const summary = rows.reduce((a,r)=>{a.count+=r.count;a.req+=r.requiredMin;a.act+=r.actualMin;a.travel+=r.travelMin;return a;},{count:0,req:0,act:0,travel:0});
    monthlyCache.summary = summary;
    const box=$('monthlySummary');
    if(box) box.innerHTML = `
      <div class="kpi"><small>عدد السجلات</small><b>${summary.count}</b></div>
      <div class="kpi"><small>الساعات المطلوبة</small><b>${fmt(summary.req/60)}</b></div>
      <div class="kpi"><small>الساعات الفعلية</small><b>${fmt(summary.act/60)}</b></div>
      <div class="kpi"><small>وقت الانتقال بالدقائق</small><b>${fmt(summary.travel,0)}</b></div>
    `;
  }

  function renderRows(rows){
    const body=$('monthlyBody'); if(!body) return;
    if(!rows.length){
      body.innerHTML = '<tr><td colspan="8">لا توجد بيانات لهذا الشهر. تأكد من اختيار الشهر الصحيح أو من وجود تسجيلات يومية محفوظة.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(r=>{
      const p=performance(r);
      return `<tr>
        <td>${esc(r.supervisor)}</td>
        <td>${esc(r.project)}</td>
        <td>${r.count}</td>
        <td>${fmt(r.requiredMin/60)}</td>
        <td>${fmt(r.actualMin/60)}</td>
        <td>${fmt(r.travelMin,0)} د</td>
        <td>${r.requiredMin? p.pct+'%' : '-'}</td>
        <td><span class="badge ${p.cls}">${p.label}</span></td>
      </tr>`;
    }).join('');
  }

  async function fillSupervisorFilter(logs, lookups){
    const sel=$('monthlySupervisor'); if(!sel) return;
    const old=sel.value;
    const names = new Set();
    (lookups.users||[]).filter(u=>/supervisor|operations_manager|admin|manager/i.test(S(u.role))).forEach(u=>names.add(S(u.full_name||u.username)));
    logs.map(r=>normalizeLog(r,lookups)).forEach(x=>{ if(x.supervisor && x.supervisor!=='غير محدد') names.add(x.supervisor); });
    sel.innerHTML = '<option value="">كل المشرفين</option>' + [...names].filter(Boolean).sort((a,b)=>a.localeCompare(b,'ar')).map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
    if(old && [...sel.options].some(o=>o.value===old)) sel.value=old;
  }

  window.renderMonthly = async function(){
    addControls();
    const seq = ++renderSeq;
    const monthEl=$('monthlyMonth');
    if(monthEl && !monthEl.value) monthEl.value = todayMonth();
    const month = monthEl?.value || todayMonth();
    msgMonthly('جاري تحميل بيانات الأوقات الشهرية...', false);
    const body=$('monthlyBody'); if(body) body.innerHTML='<tr><td colspan="8">جاري التحميل...</td></tr>';
    try{
      const lookups = await loadLookups();
      const logs = await loadTimeLogs(month);
      if(seq !== renderSeq) return;
      await fillSupervisorFilter(logs, lookups);
      const filterSupervisor = $('monthlySupervisor')?.value || '';
      const rows = aggregate(logs, lookups, filterSupervisor);
      monthlyCache = {month, rows, logs, summary:{}};
      renderSummary(rows);
      renderRows(rows);
      msgMonthly(logs.length ? '' : 'لا توجد سجلات لهذا الشهر. لو عندك بيانات شهر سابق اختر الشهر من الفلتر واضغط تحديث الأوقات.', false);
    }catch(e){
      console.error('Monthly v10135 failed', e);
      msgMonthly('تعذر تحميل الأوقات الشهرية: '+(e.message||e), true);
      if(body) body.innerHTML='<tr><td colspan="8">تعذر تحميل البيانات</td></tr>';
    }
  };

  window.exportMonthlyCSV = function(){
    const rows = monthlyCache.rows || [];
    const header = ['المشرف','المشروع','عدد السجلات','الساعات المطلوبة','الساعات الفعلية','وقت الانتقال بالدقائق','نسبة العمل','حالة الأداء'];
    const lines = [header].concat(rows.map(r=>{
      const p=performance(r);
      return [r.supervisor,r.project,r.count,fmt(r.requiredMin/60),fmt(r.actualMin/60),fmt(r.travelMin,0),r.requiredMin?p.pct+'%':'-',p.label];
    }));
    const csv = '\uFEFF' + lines.map(row=>row.map(v=>'"'+S(v).replace(/"/g,'""')+'"').join(',')).join('\n');
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    a.download='monthly-times-'+(monthlyCache.month||todayMonth())+'.csv';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };

  window.printMonthlyReportV57 = async function(){
    await window.renderMonthly();
    const rows = monthlyCache.rows || [];
    const s = monthlyCache.summary || rows.reduce((a,r)=>{a.count+=r.count;a.req+=r.requiredMin;a.act+=r.actualMin;a.travel+=r.travelMin;return a;},{count:0,req:0,act:0,travel:0});
    const html = `<div class="monthly-print-v10135" id="monthlyPrintV10135">
      <h1>تقرير الأوقات الشهرية</h1>
      <h2>الشهر: ${esc(monthlyCache.month||$('monthlyMonth')?.value||todayMonth())}</h2>
      <div class="print-kpis">
        <div><b>عدد السجلات</b><br>${s.count||0}</div>
        <div><b>الساعات المطلوبة</b><br>${fmt((s.req||0)/60)}</div>
        <div><b>الساعات الفعلية</b><br>${fmt((s.act||0)/60)}</div>
        <div><b>وقت الانتقال</b><br>${fmt(s.travel||0,0)} دقيقة</div>
      </div>
      <table><thead><tr><th>المشرف</th><th>المشروع</th><th>عدد السجلات</th><th>الساعات المطلوبة</th><th>الساعات الفعلية</th><th>وقت الانتقال</th><th>نسبة العمل</th><th>حالة الأداء</th></tr></thead><tbody>
      ${rows.length ? rows.map(r=>{const p=performance(r);return `<tr><td>${esc(r.supervisor)}</td><td>${esc(r.project)}</td><td>${r.count}</td><td>${fmt(r.requiredMin/60)}</td><td>${fmt(r.actualMin/60)}</td><td>${fmt(r.travelMin,0)} د</td><td>${r.requiredMin?p.pct+'%':'-'}</td><td>${p.label}</td></tr>`}).join('') : '<tr><td colspan="8">لا توجد بيانات</td></tr>'}
      </tbody></table>
      <p style="margin-top:14px;color:#555">تم إنشاء التقرير حسب البيانات الحالية بعد آخر تحديث/تعديل.</p>
    </div>`;
    let holder=$('monthlyPrintHolderV10135');
    if(!holder){ holder=document.createElement('div'); holder.id='monthlyPrintHolderV10135'; document.body.appendChild(holder); }
    holder.innerHTML = html;
    setTimeout(()=>window.print(),150);
  };

  window.printMonthlyReport = window.printMonthlyReportV57;

  document.addEventListener('DOMContentLoaded', ()=>{
    addControls();
    const oldShow = window.showPage;
    if(typeof oldShow === 'function' && !oldShow.__monthlyV10135){
      window.showPage = function(id, btn){
        const res = oldShow.apply(this, arguments);
        if(id === 'monthly') setTimeout(()=>window.renderMonthly(), 80);
        return res;
      };
      window.showPage.__monthlyV10135 = true;
    }
    if(location.hash === '#monthly' || !document.querySelector('#monthly.hidden')) setTimeout(()=>window.renderMonthly(), 300);
  });
})();

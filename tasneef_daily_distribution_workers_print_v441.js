/* V441 - تثبيت عمود عمال التوزيع في التسجيلات اليومية والطباعة + تلوين الغائب */
(function(){
  'use strict';
  if(window.__tasneefDailyDistributionWorkersPrintV441) return;
  window.__tasneefDailyDistributionWorkersPrintV441 = true;
  const VERSION='V447 سريع';
  const S=v=>String(v??'').trim();
  const N=v=>Number(v)||0;
  const $=id=>document.getElementById(id);
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>S(v).replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').toLowerCase().trim();
  const today=()=>new Date().toISOString().slice(0,10);
  const dailyDate=()=>S($('dailyDate')?.value)||today();
  const dailyMonth=()=>dailyDate().slice(0,7);
  const statusAbsent=v=>['absent','غائب','غياب','غ'].includes(norm(v));
  const statusPresent=v=>['present','حاضر','حضور','ح'].includes(norm(v));
  const isActive=x=>!(x?.deleted_at||x?.is_deleted===true||x?.active===false||x?.is_active===false||['deleted','archived','inactive','stopped','ended','disabled','محذوف','موقوف','متوقف','منتهي','غير نشط','غيرنشط'].includes(norm(x?.status||x?.state||x?.active_status||'active')));
  const cache={dist:{},attendance:{},workers:null,projects:null};

  function css(){
    if($('td441Css')) return;
    const st=document.createElement('style'); st.id='td441Css';
    st.textContent=`
      .td441-workers-th,.td441-workers-td{display:table-cell!important;visibility:visible!important;opacity:1!important}
      .td441-workers-td{white-space:normal!important;min-width:190px;max-width:260px;vertical-align:top!important}
      .td441-chip{display:inline-block;background:#eef8f5;color:#064537;border:1px solid #cfe2dc;border-radius:999px;padding:4px 8px;margin:2px;font-weight:900;font-size:12px;line-height:1.35}
      .td441-chip.absent{background:#ffe8e8!important;color:#a01818!important;border-color:#f2b8b8!important}
      .td441-chip small{font-weight:700;color:inherit;opacity:.85}
      .td441-empty{display:inline-block;background:#fff8e6;color:#8a5b00;border:1px solid #efd38b;border-radius:999px;padding:4px 8px;margin:2px;font-weight:900;font-size:12px}
      @media print{.td441-workers-th,.td441-workers-td{display:table-cell!important;visibility:visible!important;opacity:1!important}.td441-chip{border:1px solid #0b5b4a!important;background:#eef8f5!important;color:#064537!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.td441-chip.absent{background:#ffe8e8!important;color:#a01818!important;border-color:#f2b8b8!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    `;
    document.head.appendChild(st);
  }
  async function safe(p){try{const r=await p; if(r&&r.error){console.warn('V441 supabase',r.error.message); return [];} return Array.isArray(r?.data)?r.data:[];}catch(e){console.warn('V441 catch',e); return [];}}
  async function loadWorkers(){
    if(cache.workers) return cache.workers;
    const c=window.sb; let rows=[];
    if(c){
      rows=await safe(c.from('employees_master_v386').select('*').limit(10000));
      if(!rows.length) rows=await safe(c.from('employees_master').select('*').limit(10000));
      if(!rows.length) rows=await safe(c.from('workers').select('*').limit(10000));
    }
    cache.workers=(rows||[]).filter(isActive); return cache.workers;
  }
  async function loadProjects(){
    if(cache.projects) return cache.projects;
    const c=window.sb; cache.projects=c?(await safe(c.from('projects').select('*').limit(10000))).filter(isActive):[];
    return cache.projects;
  }
  function empCode(e){return S(e.employee_code||e.code||e.emp_code||e.worker_code||e.id_code||e.employee_id||e.id)}
  function empName(e){return S(e.app_name||e.display_name||e.name_in_app||e.worker_name||e.name||e.full_name||e.iqama_name||'-')}
  function empDisplayByCode(code, fallback){
    code=S(code); fallback=S(fallback);
    const em=(cache.workers||[]).find(e=>empCode(e)===code);
    const name=em?empName(em):fallback;
    return code ? `${code} - ${name||code}` : (name||'-');
  }
  async function loadDistribution(month){
    month=month||dailyMonth();
    if(cache.dist[month]) return cache.dist[month];
    await Promise.all([loadWorkers(),loadProjects()]);
    const c=window.sb; let rows=[];
    if(c){
      rows=await safe(c.from('monthly_distribution').select('*').eq('month_key',month).limit(30000));
    }
    rows=(rows||[]).filter(r=>!['deleted','inactive','ended','محذوف','موقوف'].includes(norm(r.status||''))).map(r=>{
      const pid=S(r.project_id||r.projectId||'');
      const p=(cache.projects||[]).find(x=>S(x.id)===pid) || {};
      const code=S(r.worker_employee_code||r.employee_code||r.worker_code||r.worker_id||'');
      return {
        project_id:pid,
        project_name:S(r.project_name||r.project||p.name||p.project_name||p.title||''),
        supervisor_code:S(r.supervisor_employee_code||r.supervisor_code||''),
        supervisor_name:S(r.supervisor_name||r.supervisor||''),
        worker_code:code,
        worker_name:empDisplayByCode(code, r.worker_name||r.worker_employee_name||''),
        raw_worker_name:S(r.worker_name||r.worker_employee_name||'')
      };
    });
    cache.dist[month]=rows; return rows;
  }
  async function loadAttendance(date){
    date=date||dailyDate();
    if(cache.attendance[date]) return cache.attendance[date];
    const c=window.sb; let rows=[];
    if(c) rows=await safe(c.from('attendance').select('*').eq('attendance_date',date).limit(30000));
    cache.attendance[date]=rows||[]; return cache.attendance[date];
  }
  function absentIndex(att){
    const m=new Set();
    (att||[]).forEach(a=>{
      if(!statusAbsent(a.status||a.state||a.attendance_status)) return;
      [a.worker_employee_code,a.employee_code,a.worker_code,a.worker_id,a.worker_identity,a.worker_name,a.employee_name].forEach(v=>{v=S(v); if(v){m.add(v); m.add(norm(v));}});
    });
    return m;
  }
  function projectNameFromId(id){
    if(typeof window.projectName==='function') return window.projectName(id);
    const p=(window.data?.projects||[]).find(x=>S(x.id)===S(id)) || (cache.projects||[]).find(x=>S(x.id)===S(id));
    return S(p?.name||p?.project_name||p?.title||id||'');
  }
  function supervisorNameFromId(id){
    if(typeof window.supervisorName==='function') return window.supervisorName(id);
    const u=(window.data?.users||[]).find(x=>S(x.id)===S(id)) || (window.data?.app_users||[]).find(x=>S(x.id)===S(id));
    return S(u?.full_name||u?.name||u?.username||id||'');
  }
  function logRows(){
    try{ if(typeof window.filterLogs==='function') return window.filterLogs()||[]; }catch(_){ }
    return (window.data?.logs||[]);
  }
  function distributionForLog(log, dist){
    const pid=S(log.project_id||'');
    const pname=norm(projectNameFromId(pid));
    const sid=S(log.supervisor_id||'');
    const sname=norm(supervisorNameFromId(sid));
    let list=(dist||[]).filter(r=> pid && S(r.project_id)===pid);
    if(!list.length && pname) list=(dist||[]).filter(r=>norm(r.project_name)===pname);
    // إذا نفس المشروع موجود بأكثر من مشرف، نضيقه بالمشرف الموجود في السجل.
    if(list.length && (sid||sname)){
      const strict=list.filter(r=>(sid && S(r.supervisor_code)===sid) || (sname && norm(r.supervisor_name)===sname));
      if(strict.length) list=strict;
    }
    return list;
  }
  function chipsHtml(list, absentSet){
    const unique=[...new Map((list||[]).map(r=>[S(r.worker_code||r.worker_name),r])).values()];
    if(!unique.length) return '<span class="td441-empty">لا يوجد توزيع لهذا المشروع</span>';
    return unique.map(r=>{
      const code=S(r.worker_code); const name=S(r.worker_name||r.raw_worker_name||code);
      const absent = (code && (absentSet.has(code)||absentSet.has(norm(code)))) || absentSet.has(name) || absentSet.has(norm(name)) || absentSet.has(norm(r.raw_worker_name));
      return `<span class="td441-chip ${absent?'absent':''}">${esc(name)}</span>`;
    }).join('');
  }
  function ensureHeader(table){
    const head=table?.querySelector('thead tr'); if(!head) return;
    // احذف أي عمود عمال سابق ثم أعد إضافته بمكان ثابت بعد المشروع.
    [...head.children].forEach(th=>{ if(th.dataset.td405WorkersTh || th.dataset.td441WorkersTh || /عمال التوزيع|عمال/.test(S(th.textContent))) th.remove(); });
    const th=document.createElement('th'); th.className='td441-workers-th'; th.dataset.td441WorkersTh='1'; th.textContent='عمال التوزيع';
    const cells=[...head.children];
    const projectIdx=cells.findIndex(x=>/المشروع/.test(S(x.textContent)));
    if(projectIdx>=0 && cells[projectIdx+1]) head.insertBefore(th,cells[projectIdx+1]); else head.appendChild(th);
  }
  async function decorateDailyRows(){
    css();
    const body=$('logsBody'); if(!body) return;
    const table=body.closest('table'); if(!table) return;
    ensureHeader(table);
    const date=dailyDate(); const month=date.slice(0,7);
    const [dist, att]=await Promise.all([loadDistribution(month), loadAttendance(date)]);
    const absentSet=absentIndex(att);
    const rows=logRows();
    const trs=[...body.querySelectorAll('tr')].filter(tr=>tr.children.length && !/لا توجد/.test(S(tr.textContent)));
    trs.forEach((tr,i)=>{
      [...tr.children].forEach(td=>{ if(td.dataset.td405WorkersTd || td.dataset.td441WorkersTd || td.classList.contains('td405-daily-workers')) td.remove(); });
      const log=rows[i] || {};
      // إن لم نطابق عبر log، نقرأ اسم المشروع من الخلية بعد التاريخ/المشرف.
      let list=distributionForLog(log, dist);
      if(!list.length){
        const cells=[...tr.children];
        const pname=norm(cells.find(td=>td.cellIndex>=0 && /[\u0600-\u06FF]/.test(S(td.textContent)))?.textContent||'');
        if(pname) list=dist.filter(r=>norm(r.project_name)===pname);
      }
      const td=document.createElement('td'); td.className='td441-workers-td'; td.dataset.td441WorkersTd='1'; td.innerHTML=chipsHtml(list,absentSet);
      const cells=[...tr.children];
      // الجدول الحالي: التاريخ، المشرف، المشروع، نوع الزيارة... لذلك نضع بعد عمود المشروع.
      const projectIdx = Math.min(2, cells.length-1);
      if(cells[projectIdx+1]) tr.insertBefore(td,cells[projectIdx+1]); else tr.appendChild(td);
    });
  }
  function wrapRender(){
    if(window.renderTimeLogs && !window.renderTimeLogs.__td441){
      const old=window.renderTimeLogs;
      const fn=function(){ const r=old.apply(this,arguments); setTimeout(decorateDailyRows,60); setTimeout(decorateDailyRows,250); setTimeout(decorateDailyRows,700); return r; };
      fn.__td441=true; window.renderTimeLogs=fn; try{renderTimeLogs=fn;}catch(_){ }
    }
  }
  function bindFilters(){
    ['dailyDate','dailySupervisor','dailyProject','dailySearch'].forEach(id=>{
      const el=$(id); if(el && el.dataset.td441!=='1'){
        el.dataset.td441='1';
        const ev=id==='dailySearch'?'input':'change';
        el.addEventListener(ev,()=>{cache.attendance={}; if(id==='dailyDate'||id==='dailyProject'||id==='dailySupervisor'){cache.dist={};} setTimeout(decorateDailyRows,80); setTimeout(decorateDailyRows,400); setTimeout(decorateDailyRows,900);});
      }
    });
  }
  function minutesBetweenSafe(a,b){try{return typeof window.minutesBetween==='function'?window.minutesBetween(a,b):0;}catch(_){return 0;}}
  function minsText(m){try{return typeof window.minsToText==='function'?window.minsToText(m):String(m||0)+' د';}catch(_){return String(m||0)+' د';}}
  function timeOnlySafe(v){try{if(!v)return '-';const d=new Date(v);if(!Number.isNaN(d.getTime()))return d.toLocaleTimeString('ar-SA-u-nu-latn',{hour:'numeric',minute:'2-digit',hour12:true,timeZone:'Asia/Riyadh'});return S(v).slice(11,16);}catch(_){return S(v).slice(11,16);}}
  function visitText(v){try{return typeof window.visitTypeText==='function'?window.visitTypeText(v):S(v);}catch(_){return S(v);}}
  function logRequired(l){try{return typeof window.logRequiredMinutes==='function'?N(window.logRequiredMinutes(l)):N(l.required_minutes);}catch(_){return N(l.required_minutes);}}
  function logActual(l){return N(l.duration_minutes||minutesBetweenSafe(l.check_in,l.check_out));}
  function diffStatus(diff,req){ if(!req) return ['غير محدد','']; if(diff<-5) return ['ناقص وقت','bad']; if(diff>5) return ['زيادة وقت','warn']; return ['ضمن الوقت','ok']; }
  async function exportPdfV441(){
    const rows=logRows(); if(!rows.length){ if(typeof window.msg==='function') window.msg('لا توجد بيانات للطباعة','err'); return; }
    const date=dailyDate(); const month=date.slice(0,7);
    const [dist,att]=await Promise.all([loadDistribution(month),loadAttendance(date)]);
    const absentSet=absentIndex(att);
    let totalA=0,totalR=0,within=0,over=0,under=0;
    const trs=rows.map((l,i)=>{
      const req=logRequired(l), actual=logActual(l), diff=actual-req; totalA+=actual; totalR+=req;
      const [st,cls]=diffStatus(diff,req); if(cls==='bad') under++; else if(cls==='warn') over++; else if(cls==='ok') within++;
      const workers=chipsHtml(distributionForLog(l,dist),absentSet);
      return `<tr><td>${i+1}</td><td>${esc(supervisorNameFromId(l.supervisor_id))}</td><td>${esc(projectNameFromId(l.project_id))}</td><td class="workers">${workers}</td><td>${esc(visitText(l.visit_type))}</td><td>${esc(timeOnlySafe(l.check_in))}</td><td>${esc(timeOnlySafe(l.check_out))}</td><td>${esc(minsText(req))}</td><td>${esc(minsText(actual))}</td><td>${esc(minsText(Math.abs(diff)))}</td><td><span class="pill ${cls}">${st}</span></td><td>${esc(l.notes||'')}</td></tr>`;
    }).join('');
    const totalDiff=totalA-totalR;
    const selectedSupervisor=$('dailySupervisor')?.value?supervisorNameFromId($('dailySupervisor').value):'الكل';
    const selectedProject=$('dailyProject')?.value?projectNameFromId($('dailyProject').value):'الكل';
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير التشغيل اليومي</title><style>
      @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;color:#173b33;margin:0;background:#fff;font-size:11px}.header{display:flex;justify-content:space-between;border-bottom:3px solid #0b5b4a;padding-bottom:10px;margin-bottom:12px}.brand{font-size:22px;font-weight:900;color:#06483b}.sub{font-size:12px;color:#667;margin-top:4px}.title{text-align:left}.title h1{margin:0;font-size:20px;color:#0b5b4a}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.box{border:1px solid #d8e4df;border-radius:10px;padding:8px;background:#f8fbfa}.box b{display:block;color:#0b5b4a;margin-bottom:3px}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:10px 0}.kpi{border-radius:12px;padding:8px;background:#eef7f4;border:1px solid #d4e8e1;text-align:center}.kpi strong{display:block;font-size:16px;color:#063f34}table{width:100%;border-collapse:collapse;margin-top:8px}th{background:#0b5b4a;color:#fff;padding:7px;border:1px solid #0b5b4a}td{padding:6px;border:1px solid #dfe8e4;vertical-align:top;text-align:center}tbody tr:nth-child(even){background:#fafdfc}.workers{min-width:210px;max-width:270px;text-align:right}.td441-chip{display:inline-block;background:#eef8f5;color:#064537;border:1px solid #cfe2dc;border-radius:999px;padding:3px 6px;margin:2px;font-weight:900;font-size:10px}.td441-chip.absent{background:#ffe8e8!important;color:#a01818!important;border-color:#f2b8b8!important}.td441-empty{display:inline-block;background:#fff8e6;color:#8a5b00;border:1px solid #efd38b;border-radius:999px;padding:3px 6px;margin:2px;font-weight:900}.pill{display:inline-block;padding:4px 8px;border-radius:999px;font-weight:900}.ok{background:#e6f6ec;color:#116b32}.warn{background:#fff4d8;color:#8a5b00}.bad{background:#ffe5e5;color:#9c1d1d}.footer{margin-top:10px;display:flex;justify-content:space-between;color:#666;font-size:11px;border-top:1px solid #dfe8e4;padding-top:7px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.td441-chip.absent{background:#ffe8e8!important;color:#a01818!important}}
    </style></head><body><div class="header"><div><div class="brand">شركة تصنيف لإدارة المرافق</div><div class="sub">تقرير التشغيل اليومي للإدارة</div></div><div class="title"><h1>تقرير يومي للمدير</h1><div>التاريخ: ${esc(date)}</div><div class="sub">${VERSION}</div></div></div><div class="meta"><div class="box"><b>المشرف</b>${esc(selectedSupervisor)}</div><div class="box"><b>المشروع</b>${esc(selectedProject)}</div><div class="box"><b>عدد السجلات</b>${rows.length}</div><div class="box"><b>ملاحظة</b>العامل الغائب يظهر بالأحمر</div></div><div class="kpis"><div class="kpi"><strong>${esc(minsText(totalA))}</strong><span>إجمالي الوقت الفعلي</span></div><div class="kpi"><strong>${esc(minsText(totalR))}</strong><span>إجمالي الوقت المطلوب</span></div><div class="kpi"><strong>${esc((totalDiff>=0?'زيادة ':'نقص ')+minsText(Math.abs(totalDiff)))}</strong><span>فرق الوقت</span></div><div class="kpi"><strong>${within}</strong><span>ضمن الوقت</span></div><div class="kpi"><strong>${over} / ${under}</strong><span>زيادة / نقص</span></div></div><table><thead><tr><th>#</th><th>المشرف</th><th>المشروع</th><th>عمال التوزيع</th><th>نوع الزيارة</th><th>الدخول</th><th>الخروج</th><th>المطلوب</th><th>الفعلي</th><th>الفرق</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>${trs}</tbody></table><div class="footer"><span>شركة تصنيف لإدارة المرافق</span><span>مولّد من النظام</span></div><script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></body></html>`;
    const w=window.open('','_blank'); if(!w){ if(typeof window.msg==='function') window.msg('المتصفح منع فتح نافذة التقرير','err'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }
  function patchPrint(){
    window.exportDailyManagerPDF=exportPdfV441;
    try{exportDailyManagerPDF=exportPdfV441;}catch(_){ }
  }


  /* V447: حل timeout في التسجيلات اليومية - استعلام خفيف ومفهرس بدل تحميل الفترة الكبيرة */
  function dayPlusOne(d){ try{const x=new Date(String(d)+'T12:00:00'); x.setDate(x.getDate()+1); return x.toISOString().slice(0,10);}catch(_){return d;} }
  function rangeDays(from,to){ try{const a=new Date(String(from)+'T12:00:00'), b=new Date(String(to)+'T12:00:00'); return Math.max(1, Math.round((b-a)/86400000)+1);}catch(_){return 1;} }
  function getRangeV447(){
    let from=S($('dailyDateFromV10310')?.value || $('dailyDate')?.value || dailyDate() || today());
    let to=S($('dailyDateToV10310')?.value || $('dailyDate')?.value || from);
    if(!from) from=today(); if(!to) to=from;
    if(to<from){ const t=from; from=to; to=t; }
    return {from,to};
  }
  function setDailyMsgV447(t,bad){
    let el=$('dailyFastMsgV447');
    const card=$('logsBody')?.closest('.card') || $('daily');
    if(card && !el){ el=document.createElement('div'); el.id='dailyFastMsgV447'; el.className='msg'; const anchor=card.querySelector('.filters')||card.firstChild; anchor?.insertAdjacentElement('afterend', el); }
    if(el){ el.textContent=t; el.className='msg '+(bad?'err':''); el.classList.remove('hidden'); }
  }
  async function loadLogsFastV447(){
    const c=window.sb; if(!c) return [];
    const {from,to}=getRangeV447();
    const sup=S($('dailySupervisor')?.value||'');
    const proj=S($('dailyProject')?.value||'');
    const cols='id,user_id,supervisor_id,project_id,log_date,check_in,check_out,duration_minutes,travel_minutes,visit_type,required_minutes,time_difference_minutes,time_status,notes,created_at,updated_at';
    let q=c.from('time_logs').select(cols).gte('log_date',from).lte('log_date',to).order('log_date',{ascending:false}).order('id',{ascending:false}).limit(1200);
    if(sup) q=q.eq('supervisor_id',sup);
    if(proj) q=q.eq('project_id',proj);
    const r=await q;
    if(r.error) throw r.error;
    return r.data||[];
  }
  function renderDailyFastRowsV447(rows){
    const body=$('logsBody'); if(!body) return;
    const q=norm($('dailySearch')?.value||'');
    let dataRows=(rows||[]).filter(l=>S(l.visit_type||'')!=='technician_attendance');
    if(q){ dataRows=dataRows.filter(l=>norm([supervisorNameFromId(l.supervisor_id),projectNameFromId(l.project_id),visitText(l.visit_type),l.notes].join(' ')).includes(q)); }
    try{ window.data=window.data||{}; window.data.logs=dataRows; }catch(_){ }
    body.innerHTML=dataRows.map(l=>{
      const logDate=S(l.log_date||S(l.check_in).slice(0,10));
      const actual=logActual(l), required=logRequired(l), diff=(l.time_difference_minutes!==null&&l.time_difference_minutes!==undefined)?N(l.time_difference_minutes):(actual-required);
      const status=l.time_status || (diff<-5?'under_time':diff>5?'over_time':'within_time');
      const badge=`<span class="badge ${status==='under_time'?'red':status==='over_time'?'yellow':'green'}">${esc(status==='under_time'?'ناقص وقت':status==='over_time'?'زيادة وقت':'ضمن الوقت')}</span>`;
      return `<tr><td>${esc(logDate)}</td><td>${esc(supervisorNameFromId(l.supervisor_id))}</td><td>${esc(projectNameFromId(l.project_id))}</td><td>${esc(visitText(l.visit_type))}</td><td>${esc(timeOnlySafe(l.check_in))}</td><td>${esc(timeOnlySafe(l.check_out))}</td><td>${esc(minsText(required))}</td><td>${esc(minsText(actual))}</td><td>${diff>=0?'زيادة ':'نقص '}${esc(minsText(Math.abs(diff)))}</td><td>${badge}</td><td>${esc(l.travel_minutes||0)}</td><td>${esc(l.notes||'')}</td><td class="row-actions"></td><td class="row-actions"><button onclick="editTimeLog(${N(l.id)})">تعديل</button><button class="danger" onclick="deleteRow('time_logs',${N(l.id)})">حذف</button></td></tr>`;
    }).join('') || '<tr><td colspan="14">لا توجد بيانات</td></tr>';
    setTimeout(decorateDailyRows,60); setTimeout(decorateDailyRows,250);
  }
  let dailyRequestSeqV447=0;
  async function renderTimeLogsFastV447(){
    const requestId=++dailyRequestSeqV447;
    try{
      css(); bindFilters();
      const r=getRangeV447();
      const days=rangeDays(r.from,r.to);
      if(days>31){
        setDailyMsgV447('الفترة كبيرة جدًا. اختر شهر واحد كحد أقصى حتى لا يعلق السيرفر.', true);
        return;
      }
      setDailyMsgV447('جاري تحميل التسجيلات بطريقة سريعة...', false);
      const rows=await loadLogsFastV447();
      if(requestId!==dailyRequestSeqV447) return;
      renderDailyFastRowsV447(rows);
      setDailyMsgV447(`تم تحميل ${rows.length} سجل للفترة ${r.from} إلى ${r.to} بدون ضغط على السيرفر.`, false);
    }catch(e){
      if(requestId!==dailyRequestSeqV447) return;
      console.warn('V447 fast daily failed',e);
      setDailyMsgV447('تعذر تحميل الفترة بسرعة: '+(e.message||e), true);
    }
  }
  function installFastRenderV447(){
    window.renderTimeLogs=renderTimeLogsFastV447;
    try{ renderTimeLogs=renderTimeLogsFastV447; }catch(_){ }
    ['dailyDate','dailyDateFromV10310','dailyDateToV10310','dailySupervisor','dailyProject','dailySearch'].forEach(id=>{
      const el=$(id); if(el && el.dataset.td447!=='1'){
        el.dataset.td447='1';
        el.addEventListener(id==='dailySearch'?'input':'change',()=>{ cache.attendance={}; setTimeout(renderTimeLogsFastV447,30); });
      }
    });
  }

  function install(){css(); wrapRender(); bindFilters(); patchPrint(); installFastRenderV447(); setTimeout(renderTimeLogsFastV447,80); setTimeout(decorateDailyRows,450);}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,900));
  window.addEventListener('load',()=>setTimeout(install,1200));
  [1800,3000,5000,8000].forEach(t=>setTimeout(install,t));
  try{new MutationObserver(()=>{const body=$('logsBody'); if(body && !body.dataset.td441Decorating){ body.dataset.td441Decorating='1'; setTimeout(()=>{decorateDailyRows().finally(()=>{delete body.dataset.td441Decorating;});},120); }}).observe(document.body,{childList:true,subtree:true});}catch(_){}
  setInterval(()=>{wrapRender(); bindFilters(); patchPrint();},5000);
  window.tasneefDailyDistributionWorkersPrintV441={install,decorateDailyRows,reload:function(){cache.dist={};cache.attendance={};cache.workers=null;cache.projects=null;return install();}};
})();

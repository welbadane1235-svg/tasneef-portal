/* Tasneef Daily Logs Root V10510 - single source, loaded last */
(function(){
  'use strict';
  if(window.__tasneefDailyRootV10510) return;
  window.__tasneefDailyRootV10510=true;
  window.__tasneefLegacyDailyScriptsDisabled=true;

  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const byId=id=>document.getElementById(id);
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let rows=[], requestId=0, built=false;

  function sessionSafe(){try{return typeof session==='function'?(session()||{}):{}}catch(_){return{}}}
  function supervisorPage(){return location.pathname.toLowerCase().includes('supervisor') || sessionSafe().role==='supervisor'}
  function today(){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}catch(_){return new Date().toISOString().slice(0,10)}}
  function nextDay(d){const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+1);return x.toISOString().slice(0,10)}
  function supName(id){try{return typeof supervisorName==='function'?supervisorName(id):S((window.data?.users||[]).find(x=>S(x.id)===S(id))?.full_name||id)}catch(_){return S(id)}}
  function projectNameSafe(id){try{return typeof projectName==='function'?projectName(id):S((window.data?.projects||[]).find(x=>S(x.id)===S(id))?.name||id)}catch(_){return S(id)}}
  function visit(v){return ({surface:'نظافة سطحية',deep:'نظافة عميقة',maintenance:'صيانة',inspection:'تفقد'}[S(v)]||S(v)||'-')}
  function dateText(v){if(!v)return '-';try{return new Date(v).toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'})}catch(_){return S(v).slice(0,10)}}
  function timeText(v){if(!v)return '-';try{return new Date(v).toLocaleTimeString('ar-SA',{hour:'numeric',minute:'2-digit',hour12:true,timeZone:'Asia/Riyadh'})}catch(_){return S(v)}}
  function minutes(a,b){if(!a||!b)return 0;const n=Math.round((new Date(b)-new Date(a))/60000);return Number.isFinite(n)&&n>0?n:0}
  function durationText(n){n=Math.max(0,Math.round(Number(n)||0));const h=Math.floor(n/60),m=n%60;return h?`${h} س ${m} د`:`${m} د`}
  function status(l){const req=Number(l.required_minutes)||0, actual=Number(l.duration_minutes)||minutes(l.check_in,l.check_out);if(!l.check_out)return{label:'داخل المشروع',cls:'open'};const d=actual-req;if(!req||Math.abs(d)<=5)return{label:'ضمن الوقت',cls:'ok'};return d>0?{label:'زيادة وقت',cls:'over'}:{label:'نقص وقت',cls:'under'}}
  function workerMasterName(id){
    const w=A(window.data?.workers).find(x=>S(x.id||x.worker_id||x.app_worker_id)===S(id));
    return S(w?.name||w?.full_name||w?.worker_name||w?.app_name||'');
  }
  function parseWorkerNamesFromNotes(notes){
    const n=S(notes); if(!n)return [];
    const patterns=[/العمال(?: المختارون| المرتبطون| الحاضرون)?\s*[:：]\s*([^\n|]+)/i,/workers?\s*[:：]\s*([^\n|]+)/i];
    for(const re of patterns){const m=n.match(re);if(m&&m[1])return m[1].split(/[،,؛;\n]+/).map(S).filter(Boolean)}
    return [];
  }
  function workersList(l){
    const fromAttached=A(l.__selected_workers).map(S).filter(Boolean);
    const fromNotes=parseWorkerNamesFromNotes(l.notes);
    return [...new Set([...fromAttached,...fromNotes])];
  }
  function workers(l){const list=workersList(l);return list.length?list.join('، '):'-'}

  function removeLegacyScript(){
    document.querySelectorAll('script[src*="tasneef_daily_distribution_workers_print"],script[src*="tasneef_distribution_daily_bridge"]').forEach(x=>x.remove());
  }
  function replaceNode(id){const el=byId(id);if(!el)return null;const clone=el.cloneNode(true);clone.removeAttribute('onchange');clone.removeAttribute('oninput');el.replaceWith(clone);return clone}

  function buildAdmin(){
    const page=byId('daily'); if(!page)return;
    const oldCard=byId('logsBody')?.closest('.card'); if(!oldCard)return;
    oldCard.innerHTML=`
      <h2>التسجيلات اليومية</h2>
      <div class="daily-root-filters-v10510">
        <label>من تاريخ<input id="dailyRootFrom" type="date"></label>
        <label>إلى تاريخ<input id="dailyRootTo" type="date"></label>
        <label>المشرف<select id="dailyRootSupervisor"><option value="">الكل</option></select></label>
        <label>المشروع<select id="dailyRootProject"><option value="">الكل</option></select></label>
        <label>بحث<input id="dailyRootSearch" placeholder="بحث"></label>
        <button type="button" id="dailyRootPrint">طباعة التقرير / PDF</button>
        <button type="button" class="light" id="dailyRootWhatsapp">إرسال واتساب</button>
        <button type="button" class="light" id="dailyRootRefresh">تحديث</button>
      </div>
      <div id="dailyRootMessage" class="daily-root-message-v10510"></div>
      <div class="table-wrap"><table id="dailyRootTable"><thead><tr>
        <th>التاريخ</th><th>المشرف</th><th>المشروع</th><th>نوع الزيارة</th><th>الدخول</th><th>الخروج</th><th>المطلوب</th><th>المدة</th><th>الحالة</th><th>العمال</th><th>واتساب</th><th>إجراء</th>
      </tr></thead><tbody id="logsBody"></tbody></table></div>`;
    const t=today();byId('dailyRootFrom').value=t;byId('dailyRootTo').value=t;
    fillFilters(); bind();
  }
  function buildSupervisor(){
    const body=byId('logsBody');if(!body)return;
    const card=body.closest('.card');if(!card)return;
    const table=body.closest('table');if(table){table.querySelector('thead').innerHTML='<tr><th>المشروع</th><th>النوع</th><th>الدخول</th><th>الخروج</th><th>المطلوب</th><th>المدة</th><th>الحالة</th><th>واتساب</th></tr>';}
    let controls=card.querySelector('.daily-root-supervisor-v10510');
    if(!controls){controls=document.createElement('div');controls.className='daily-root-supervisor-v10510';controls.innerHTML='<input id="dailyRootFrom" type="date"><input id="dailyRootTo" type="date"><button id="dailyRootRefresh" type="button" class="light">تحديث</button>';card.insertBefore(controls,table?.parentElement||card.firstChild);}
    const t=today();byId('dailyRootFrom').value=t;byId('dailyRootTo').value=t;bind();
  }
  function fillFilters(){
    const sf=byId('dailyRootSupervisor'),pf=byId('dailyRootProject');
    if(sf){const users=A(window.data?.users).filter(u=>S(u.role)==='supervisor');sf.innerHTML='<option value="">الكل</option>'+users.map(u=>`<option value="${esc(u.id)}">${esc(u.full_name||u.name||u.username)}</option>`).join('')}
    if(pf){pf.innerHTML='<option value="">الكل</option>'+A(window.data?.projects).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}
  }
  function refreshFilterOptionsFromRows(){
    const sf=byId('dailyRootSupervisor'),pf=byId('dailyRootProject');
    if(sf){const current=S(sf.value),m=new Map();A(window.data?.users).filter(u=>S(u.role)==='supervisor').forEach(u=>m.set(S(u.id),S(u.full_name||u.name||u.username||u.id)));rows.forEach(r=>m.set(S(r.supervisor_id),supName(r.supervisor_id)));sf.innerHTML='<option value="">الكل</option>'+[...m.entries()].filter(x=>x[0]).sort((a,b)=>a[1].localeCompare(b[1],'ar')).map(([id,n])=>`<option value="${esc(id)}">${esc(n)}</option>`).join('');sf.value=current;}
    if(pf){const current=S(pf.value),m=new Map();A(window.data?.projects).forEach(p=>m.set(S(p.id),S(p.name||p.id)));rows.forEach(r=>m.set(S(r.project_id),projectNameSafe(r.project_id)));pf.innerHTML='<option value="">الكل</option>'+[...m.entries()].filter(x=>x[0]).sort((a,b)=>a[1].localeCompare(b[1],'ar')).map(([id,n])=>`<option value="${esc(id)}">${esc(n)}</option>`).join('');pf.value=current;}
  }
  function bind(){
    ['dailyRootFrom','dailyRootTo'].forEach(id=>byId(id)?.addEventListener('change',load));
    ['dailyRootSupervisor','dailyRootProject'].forEach(id=>byId(id)?.addEventListener('change',render));
    let timer;byId('dailyRootSearch')?.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(render,250)});
    byId('dailyRootRefresh')?.addEventListener('click',load);
    byId('dailyRootPrint')?.addEventListener('click',printCurrent);
    byId('dailyRootWhatsapp')?.addEventListener('click',sendWhatsapp);
  }
  function bounds(){let from=S(byId('dailyRootFrom')?.value||today()),to=S(byId('dailyRootTo')?.value||from);if(from>to)[from,to]=[to,from];return{from,to}}
  function merge(a,b){const m=new Map();[...A(a),...A(b)].forEach(x=>m.set(S(x.id)||[x.supervisor_id,x.project_id,x.check_in].join('|'),x));return [...m.values()].sort((x,y)=>new Date(y.check_in||y.created_at)-new Date(x.check_in||x.created_at))}
  async function load(){
    if(!window.sb)return;
    const rid=++requestId,{from,to}=bounds(),end=nextDay(to),msg=byId('dailyRootMessage'),body=byId('logsBody');
    if(msg)msg.textContent='جاري تحميل التسجيلات...';if(body)body.innerHTML='<tr><td colspan="12">جاري التحميل...</td></tr>';
    const cols='id,user_id,supervisor_id,project_id,check_in,check_out,log_date,duration_minutes,travel_minutes,visit_type,required_minutes,time_difference_minutes,time_status,notes,created_at,updated_at';
    try{
      let q1=sb.from('time_logs').select(cols).gte('log_date',from).lte('log_date',to).order('check_in',{ascending:false}).limit(2000);
      let q2=sb.from('time_logs').select(cols).gte('check_in',from+'T00:00:00').lt('check_in',end+'T00:00:00').order('check_in',{ascending:false}).limit(2000);
      const sup=supervisorPage()?S(sessionSafe().id):S(byId('dailyRootSupervisor')?.value||'');const proj=S(byId('dailyRootProject')?.value||'');
      if(sup){q1=q1.eq('supervisor_id',sup);q2=q2.eq('supervisor_id',sup)}if(proj){q1=q1.eq('project_id',proj);q2=q2.eq('project_id',proj)}
      let vq=sb.from('project_worker_visits').select('id,worker_id,supervisor_id,project_id,check_in,check_out').gte('check_in',from+'T00:00:00').lt('check_in',end+'T00:00:00').order('check_in',{ascending:false}).limit(5000);
      if(sup)vq=vq.eq('supervisor_id',sup);if(proj)vq=vq.eq('project_id',proj);
      const [r1,r2,vr]=await Promise.all([q1,q2,vq]);if(rid!==requestId)return;
      if(r1.error&&r2.error)throw r1.error;
      rows=merge(r1.error?[]:r1.data,r2.error?[]:r2.data);
      const visits=vr.error?[]:A(vr.data);
      rows.forEach(l=>{
        const t=new Date(l.check_in||l.created_at).getTime();
        const names=visits.filter(v=>S(v.supervisor_id)===S(l.supervisor_id)&&S(v.project_id)===S(l.project_id)&&Math.abs(new Date(v.check_in).getTime()-t)<=10*60*1000).map(v=>workerMasterName(v.worker_id)||('عامل '+S(v.worker_id))).filter(Boolean);
        l.__selected_workers=[...new Set(names)];
      });
      window.data=window.data||{};window.data.logs=rows;try{data.logs=rows}catch(_){ }
      refreshFilterOptionsFromRows();
      if(msg)msg.textContent=`تم تحميل ${rows.length} سجل للفترة ${from} إلى ${to}.`;
      render();
    }catch(e){console.error('Daily root V10510',e);if(msg)msg.textContent='تعذر تحميل التسجيلات: '+(e.message||e);if(body)body.innerHTML='<tr><td colspan="12">تعذر تحميل التسجيلات</td></tr>'}
  }
  function filtered(){
    const q=S(byId('dailyRootSearch')?.value).toLowerCase(),sup=S(byId('dailyRootSupervisor')?.value),proj=S(byId('dailyRootProject')?.value),b=bounds();
    return rows.filter(l=>{
      const d=S(l.log_date||dateText(l.check_in));
      if(d<b.from||d>b.to)return false;
      if(sup&&S(l.supervisor_id)!==sup)return false;
      if(proj&&S(l.project_id)!==proj)return false;
      if(q&&![supName(l.supervisor_id),projectNameSafe(l.project_id),visit(l.visit_type),l.notes,workers(l),d].join(' ').toLowerCase().includes(q))return false;
      return true;
    });
  }
  function waButton(l){return `<button class="light" onclick="window.sendLogWhatsapp&&window.sendLogWhatsapp(${Number(l.id)||0},'${l.check_out?'out':'in'}')">واتساب</button>`}
  function render(){
    const body=byId('logsBody');if(!body)return;const list=filtered();
    if(supervisorPage())body.innerHTML=list.map(l=>{const st=status(l),req=Number(l.required_minutes)||0,act=Number(l.duration_minutes)||minutes(l.check_in,l.check_out);return `<tr><td>${esc(projectNameSafe(l.project_id))}</td><td>${esc(visit(l.visit_type))}</td><td>${esc(timeText(l.check_in))}</td><td>${esc(timeText(l.check_out))}</td><td>${esc(durationText(req))}</td><td>${esc(durationText(act))}</td><td><span class="daily-root-status-v10510 ${st.cls}">${esc(st.label)}</span></td><td>${waButton(l)}</td></tr>`}).join('')||'<tr><td colspan="8">لا توجد تسجيلات</td></tr>';
    else body.innerHTML=list.map(l=>{const st=status(l),req=Number(l.required_minutes)||0,act=Number(l.duration_minutes)||minutes(l.check_in,l.check_out);return `<tr><td>${esc(l.log_date||dateText(l.check_in))}</td><td>${esc(supName(l.supervisor_id))}</td><td>${esc(projectNameSafe(l.project_id))}</td><td>${esc(visit(l.visit_type))}</td><td>${esc(timeText(l.check_in))}</td><td>${esc(timeText(l.check_out))}</td><td>${esc(durationText(req))}</td><td>${esc(durationText(act))}</td><td><span class="daily-root-status-v10510 ${st.cls}">${esc(st.label)}</span></td><td>${esc(workers(l))}</td><td>${waButton(l)}</td><td><button onclick="editTimeLog(${Number(l.id)||0})">تعديل</button> <button class="danger" onclick="deleteRow('time_logs',${Number(l.id)||0})">حذف</button></td></tr>`}).join('')||'<tr><td colspan="12">لا توجد تسجيلات</td></tr>';
  }
  function printCurrent(){
    const list=filtered();if(!list.length)return alert('لا توجد سجلات للطباعة');
    const w=window.open('','_blank');const b=bounds();
    w.document.write(`<html dir="rtl"><head><meta charset="utf-8"><title>التسجيلات اليومية</title><style>body{font-family:Arial;margin:25px}h1{text-align:center;color:#07533e}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #bbb;padding:7px;text-align:center}th{background:#07533e;color:#fff}</style></head><body><h1>التسجيلات اليومية</h1><p>الفترة: ${esc(b.from)} إلى ${esc(b.to)} — عدد السجلات: ${list.length}</p><table><thead><tr><th>التاريخ</th><th>المشرف</th><th>المشروع</th><th>النوع</th><th>الدخول</th><th>الخروج</th><th>المطلوب</th><th>المدة</th><th>الحالة</th><th>العمال</th></tr></thead><tbody>${list.map(l=>{const st=status(l),req=Number(l.required_minutes)||0,act=Number(l.duration_minutes)||minutes(l.check_in,l.check_out);return `<tr><td>${esc(l.log_date||dateText(l.check_in))}</td><td>${esc(supName(l.supervisor_id))}</td><td>${esc(projectNameSafe(l.project_id))}</td><td>${esc(visit(l.visit_type))}</td><td>${esc(timeText(l.check_in))}</td><td>${esc(timeText(l.check_out))}</td><td>${esc(durationText(req))}</td><td>${esc(durationText(act))}</td><td>${esc(st.label)}</td><td>${esc(workers(l))}</td></tr>`}).join('')}</tbody></table><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();
  }
  function sendWhatsapp(){const list=filtered();if(!list.length)return alert('لا توجد سجلات');const b=bounds();const lines=['التسجيلات اليومية','الفترة: '+b.from+' إلى '+b.to,'عدد السجلات: '+list.length,''];list.slice(0,50).forEach((l,i)=>lines.push(`${i+1}- ${projectNameSafe(l.project_id)} | ${supName(l.supervisor_id)} | ${timeText(l.check_in)} - ${timeText(l.check_out)} | ${workers(l)}`));window.open('https://wa.me/?text='+encodeURIComponent(lines.join('\n')),'_blank')}

  function css(){if(byId('dailyRootCssV10510'))return;const st=document.createElement('style');st.id='dailyRootCssV10510';st.textContent=`.daily-root-filters-v10510{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:10px;margin-bottom:10px}.daily-root-filters-v10510 label{font-weight:700}.daily-root-filters-v10510 input,.daily-root-filters-v10510 select{width:100%;margin-top:4px}.daily-root-message-v10510{padding:10px;background:#eef7f4;border-radius:10px;margin:8px 0}.daily-root-status-v10510{padding:4px 8px;border-radius:999px;font-weight:800}.daily-root-status-v10510.open{background:#fff3cd;color:#795500}.daily-root-status-v10510.ok{background:#e4f6ea;color:#075d31}.daily-root-status-v10510.over{background:#e5efff;color:#174b91}.daily-root-status-v10510.under{background:#fde8e8;color:#9b1c1c}.daily-root-supervisor-v10510{display:flex;gap:8px;margin:8px 0}@media(max-width:800px){.daily-root-filters-v10510{grid-template-columns:1fr 1fr}}`;document.head.appendChild(st)}
  function init(){removeLegacyScript();css();if(supervisorPage())buildSupervisor();else buildAdmin();built=true;window.renderTimeLogs=load;try{renderTimeLogs=load}catch(_){ }window.refreshDailyRangeLogsV10353=load;window.refreshDailyRangeLogsV10363=load;window.tasneefRefreshDailyFastV10506=load;window.tasneefRefreshDailyV10508=load;setTimeout(load,50);console.info('V10510 daily root loaded last; filters and selected workers enabled.');}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
})();

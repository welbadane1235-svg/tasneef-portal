/* Tasneef V10192 - Monthly times must show LIVE project supervisor and LIVE worker distribution
   Fixes: old supervisor names / old worker names in الأوقات الشهرية and مشاريع الزيارة اليومية.
*/
(function(){
  'use strict';
  if(window.__tasneefMonthlyLiveNamesV10192) return;
  window.__tasneefMonthlyLiveNamesV10192 = true;

  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const CACHE_TABLE='monthly_times_cache_v10153';
  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const N=v=>{const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:0;};
  const E=v=>S(v).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const pad=n=>String(n).padStart(2,'0');
  const ymNow=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1);};
  const fmt0=n=>(Math.round(Number(n)||0)).toLocaleString('en-US');
  const fmt2=n=>(Math.round((Number(n)||0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const headers=(extra={})=>Object.assign({apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY,Accept:'application/json'},extra||{});
  const state={month:'',rows:[],filtered:[],projects:[],workers:[],users:[]};

  function norm(v){return S(v).replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/\s+/g,' ').toLowerCase();}
  function activeWorker(w){const st=S(w.status||w.worker_status||'active').toLowerCase();return !['deleted','inactive','disabled','محذوف','غير نشط'].includes(st);}
  function userName(id){
    const u=A(state.users).find(x=>S(x.id)===S(id) || S(x.user_id)===S(id));
    return S(u?.full_name||u?.name||u?.username||u?.email)||'';
  }
  function projectIdFromWorker(w){return S(w.project_id||w.assigned_project_id||w.current_project_id||w.project_key||w.site_id||w.building_id);}
  function projectNameFromWorker(w){return S(w.project_name||w.assigned_project||w.current_project||w.project||w.site_name||w.building_name);}
  function findProject(row){
    const key=S(row.project_key||row.project_id);
    const name=S(row.project_name||row.project);
    let p=A(state.projects).find(x=>S(x.id)===key || S(x.project_key)===key);
    if(!p && name){
      const nn=norm(name);
      p=A(state.projects).find(x=>norm(x.name||x.project_name||x.project)===nn);
    }
    return p||null;
  }
  function currentSupervisorName(row){
    const p=findProject(row);
    const sid=S(p?.supervisor_id||p?.app_supervisor_id||p?.manager_id||row.supervisor_key||row.supervisor_id);
    return userName(sid) || S(row.supervisor_name||row.supervisor) || 'غير محدد';
  }
  function currentProjectName(row){
    const p=findProject(row);
    return S(p?.name||p?.project_name||row.project_name||row.project)||'غير محدد';
  }
  function currentWorkersForProject(row){
    const p=findProject(row);
    const pid=S(p?.id||row.project_key||row.project_id);
    const pname=currentProjectName(row);
    const np=norm(pname);
    const names=new Map();
    A(state.workers).forEach(w=>{
      if(!activeWorker(w)) return;
      const wp=projectIdFromWorker(w), wn=norm(projectNameFromWorker(w));
      const match=(pid && wp && S(wp)===pid) || (np && wn && wn===np);
      if(!match) return;
      const name=S(w.full_name||w.name||w.worker_name||w.employee_name||w.username||w.worker);
      const k=norm(name);
      if(k && !names.has(k)) names.set(k,name);
    });
    return [...names.values()].sort((a,b)=>a.localeCompare(b,'ar')).join('، ') || '-';
  }
  async function fetchJson(path){
    const res=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:headers()});
    if(!res.ok){const txt=await res.text().catch(()=>res.statusText);throw new Error(`${path}: ${res.status} ${txt}`);}
    return A(await res.json());
  }
  async function fetchAll(month){
    const cachePath=`${CACHE_TABLE}?select=*&month_key=eq.${encodeURIComponent(month)}&order=supervisor_name.asc,project_name.asc&limit=5000`;
    const [cache,projects,workers,users]=await Promise.all([
      fetchJson(cachePath),
      fetchJson('projects?select=*&limit=5000'),
      fetchJson('workers?select=*&limit=5000'),
      fetchJson('app_users?select=*&limit=5000')
    ]);
    state.projects=projects; state.workers=workers; state.users=users;
    return cache.map(r=>{
      const liveSupervisor=currentSupervisorName(r);
      const liveProject=currentProjectName(r);
      const liveWorkers=currentWorkersForProject(r);
      return {
        id:S(r.id)||`${S(r.month_key)}-${liveSupervisor}-${liveProject}`,
        supervisor:liveSupervisor,
        project:liveProject,
        workers:liveWorkers,
        count:N(r.record_count),
        minutes:N(r.actual_minutes),
        required:N(r.required_minutes),
        travel:N(r.travel_minutes),
        source:'ملخص رسمي + أسماء حية',
        updated_at:S(r.updated_at)
      };
    }).filter(r=>r.count||r.minutes||r.required||r.travel);
  }
  function setText(id,text,cls){const el=$(id); if(!el) return; el.textContent=text||''; if(cls) el.className='badge '+cls;}
  function message(text,err){const el=$('mt52Message'); if(!el) return; el.textContent=text||''; el.className='msg '+(err?'err':''); el.classList.toggle('hidden',!text);}
  function fillFilters(){
    const oldS=S($('mt52Supervisor')?.value), oldP=S($('mt52Project')?.value);
    const sups=[...new Set(state.rows.map(r=>r.supervisor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    const prjs=[...new Set(state.rows.map(r=>r.project).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    if($('mt52Supervisor')){$('mt52Supervisor').innerHTML='<option value="">كل المشرفين</option>'+sups.map(x=>`<option value="${E(x)}">${E(x)}</option>`).join(''); if(oldS&&sups.includes(oldS)) $('mt52Supervisor').value=oldS;}
    if($('mt52Project')){$('mt52Project').innerHTML='<option value="">كل المشاريع</option>'+prjs.map(x=>`<option value="${E(x)}">${E(x)}</option>`).join(''); if(oldP&&prjs.includes(oldP)) $('mt52Project').value=oldP;}
  }
  function filterRows(){const s=S($('mt52Supervisor')?.value), p=S($('mt52Project')?.value);return state.rows.filter(r=>(!s||r.supervisor===s)&&(!p||r.project===p));}
  function pctBySupervisor(rows,row){const total=rows.filter(x=>x.supervisor===row.supervisor).reduce((s,x)=>s+N(x.minutes),0);return total?Math.round(N(row.minutes)/total*100):0;}
  function splitWorkers(s){return [...new Set(S(s).split(/[,،|]+/).map(x=>S(x)).filter(x=>x&&x!=='-'))];}
  function renderSummary(rows){
    const minutes=rows.reduce((s,r)=>s+N(r.minutes),0), travel=rows.reduce((s,r)=>s+N(r.travel),0), count=rows.reduce((s,r)=>s+N(r.count),0);
    const sups=new Set(rows.map(r=>r.supervisor).filter(Boolean)), prjs=new Set(rows.map(r=>r.project).filter(Boolean));
    if($('mt52Summary')) $('mt52Summary').innerHTML=`<div class="mt52-kpi"><small>إجمالي الوقت</small><b>${fmt2(minutes/60)} ساعة</b></div><div class="mt52-kpi"><small>عدد السجلات</small><b>${fmt0(count)}</b></div><div class="mt52-kpi"><small>المشرفين</small><b>${sups.size}</b></div><div class="mt52-kpi"><small>المشاريع</small><b>${prjs.size}</b></div><div class="mt52-kpi"><small>وقت الانتقال</small><b>${fmt2(travel/60)}</b></div>`;
  }
  function renderVisitCards(rows){
    const box=$('mt52VisitGrid'); if(!box) return;
    if(!rows.length){box.innerHTML='<div class="msg">لا توجد بيانات لهذا الشهر.</div>';return;}
    const bySup=new Map(); rows.forEach(r=>{if(!bySup.has(r.supervisor)) bySup.set(r.supervisor,[]); bySup.get(r.supervisor).push(r);});
    box.innerHTML=[...bySup.entries()].map(([sup,items])=>{
      const total=items.reduce((s,r)=>s+N(r.minutes),0);
      const projectRows=items.sort((a,b)=>N(b.minutes)-N(a.minutes)).map(r=>`<tr><td>${E(r.project)}</td><td>${fmt0(r.minutes)}</td><td>${total?Math.round(N(r.minutes)/total*100):0}%</td></tr>`).join('');
      const allWorkers=[...new Set(items.flatMap(r=>splitWorkers(r.workers)))];
      const workersHtml=allWorkers.length?allWorkers.map(w=>`<span>${E(w)}</span>`).join(''):'<small>لا توجد أسماء عمال مرتبطة حاليًا</small>';
      return `<div class="mt52-supervisor-card"><h3>${E(sup)}</h3><table><tbody>${projectRows}<tr class="total"><td>الإجمالي</td><td>${fmt0(total)}</td><td>${total?100:0}%</td></tr></tbody></table><div class="mt52-workers-title">أسماء العمال الحالية</div><div class="mt52-worker-names">${workersHtml}</div></div>`;
    }).join('');
  }
  function renderTable(rows){
    const body=$('mt52Body'); if(!body) return;
    body.innerHTML=rows.map(r=>`<tr><td>${E(r.supervisor)}</td><td>${E(r.project)}</td><td>${E(r.workers)}</td><td>${fmt0(r.count)}</td><td>${fmt0(r.minutes)}</td><td>${fmt2(N(r.minutes)/60)}</td><td>${fmt0(r.travel)}</td><td>${pctBySupervisor(rows,r)}%</td><td>${E(r.source)}</td><td>${E(r.updated_at)}</td></tr>`).join('') || '<tr><td colspan="10">لا توجد بيانات</td></tr>';
  }
  function render(){
    const rows=filterRows(); state.filtered=rows;
    renderSummary(rows); renderVisitCards(rows); renderTable(rows);
    const note=$('mt52CacheNote'); if(note){note.textContent='تم عرض المشرفين والعمال من بيانات المشاريع والعمال الحالية، وليس من الأسماء القديمة داخل الملخص.'; note.classList.remove('hidden');}
  }
  async function load(){
    const month=S($('mt52Month')?.value)||S($('monthlyMonth')?.value)||ymNow();
    state.month=month; setText('mt52Status','جاري تحميل الأسماء الحالية...','amber'); message('');
    try{
      state.rows=await fetchAll(month);
      fillFilters(); render(); setText('mt52Status',`تم تحميل ${fmt0(state.rows.length)} مشروع بأسماء حية`,'green');
    }catch(e){console.error(e); message('تعذر تحديث الأسماء الحالية: '+(e.message||e),true); setText('mt52Status','تعذر التحديث','bad');}
  }
  function csv(){
    const rows=state.filtered&&state.filtered.length?state.filtered:filterRows();
    const heads=['المشرف الحالي','المشروع','أسماء العمال الحالية','عدد السجلات','الدقائق','الساعات','وقت الانتقال','النسبة','المصدر','آخر تحديث'];
    const lines=[heads,...rows.map(r=>[r.supervisor,r.project,r.workers,r.count,fmt0(r.minutes),fmt2(N(r.minutes)/60),fmt0(r.travel),pctBySupervisor(rows,r)+'%',r.source,r.updated_at||''])];
    const blob=new Blob(['\ufeff'+lines.map(r=>r.map(x=>'"'+S(x).replace(/"/g,'""')+'"').join(',')).join('\n')],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='monthly-live-names-'+(state.month||ymNow())+'.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  function printReport(){
    const rows=state.filtered&&state.filtered.length?state.filtered:filterRows();
    if(!rows.length){alert('لا توجد بيانات للطباعة');return;}
    const month=state.month||S($('mt52Month')?.value)||ymNow();
    const totalMinutes=rows.reduce((s,r)=>s+N(r.minutes),0), totalRecords=rows.reduce((s,r)=>s+N(r.count),0);
    const supCount=new Set(rows.map(r=>r.supervisor)).size, projectCount=new Set(rows.map(r=>r.project)).size;
    const bySup=new Map(); rows.forEach(r=>{if(!bySup.has(r.supervisor)) bySup.set(r.supervisor,[]); bySup.get(r.supervisor).push(r);});
    const cards=[...bySup.entries()].map(([sup,items])=>{
      const total=items.reduce((s,r)=>s+N(r.minutes),0);
      const trs=items.sort((a,b)=>N(b.minutes)-N(a.minutes)).map(r=>`<tr><td class="project">${E(r.project)}</td><td>${fmt0(r.minutes)}</td><td>${total?Math.round(N(r.minutes)/total*100):0}%</td></tr>`).join('');
      const workers=[...new Set(items.flatMap(r=>splitWorkers(r.workers)))];
      const workerTags=workers.length?workers.map(w=>`<span>${E(w)}</span>`).join(''):'<em>لا توجد أسماء عمال مرتبطة حاليًا</em>';
      return `<section class="sup-card"><header>${E(sup)}</header><table><thead><tr><th>المشروع</th><th>الدقائق</th><th>النسبة</th></tr></thead><tbody>${trs}<tr class="total"><td>الإجمالي</td><td>${fmt0(total)}</td><td>${total?100:0}%</td></tr></tbody></table><div class="workers-title">أسماء العمال الحالية</div><div class="workers">${workerTags}</div></section>`;
    }).join('');
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية ${E(month)}</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;color:#071b33;margin:0;background:#fff;font-size:11px}.page{padding:0}.report-head{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;border:2px solid #0A4033;border-radius:14px;padding:12px 16px;margin-bottom:10px;background:linear-gradient(135deg,#f7fffc,#eef8f4)}.report-head h1{margin:0;color:#0A4033;font-size:24px}.brand-box{border:1px solid #bdd8cf;border-radius:12px;padding:8px 12px;text-align:center;color:#0A4033;font-weight:900;min-width:150px;background:#fff}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0 12px}.meta div{border:1px solid #cfe0da;border-radius:12px;padding:9px;background:#fbfdfc;text-align:center}.meta small{display:block;color:#60706a;margin-bottom:4px}.meta b{font-size:18px;color:#0A4033}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;align-items:start}.sup-card{border:1.8px solid #0f2f28;border-radius:12px;padding:8px;break-inside:avoid;background:#fff;min-height:245px}.sup-card header{text-align:center;font-size:18px;font-weight:900;color:#0A4033;border-bottom:2px solid #0A4033;padding-bottom:6px;margin-bottom:6px}.sup-card table{width:100%;border-collapse:collapse}.sup-card th{background:#eef7f3;color:#0A4033;font-size:10px}.sup-card td,.sup-card th{padding:5px;border-bottom:1px solid #e4ece9;text-align:center}.sup-card td.project{text-align:right;font-weight:700}.sup-card tr.total td{font-weight:900;border-top:2px solid #0f2f28;background:#f8fbfa}.workers-title{text-align:center;font-weight:900;color:#0A4033;margin:10px 0 5px;font-size:13px}.workers{display:flex;flex-wrap:wrap;gap:4px;justify-content:center}.workers span{border:1px solid #d2e3dc;background:#f6fbf9;border-radius:999px;padding:3px 7px;font-size:10px;font-weight:700}.workers em{font-style:normal;color:#7b8b85}.footer{margin-top:10px;color:#60706a;font-size:10px;border-top:1px solid #dce8e4;padding-top:6px}.screen-actions{display:none}@media screen{body{background:#eef3f1}.page{max-width:1320px;margin:18px auto;background:#fff;padding:14px;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.12)}.screen-actions{display:flex;gap:8px;justify-content:flex-start;margin:0 0 10px}.screen-actions button{background:#0A4033;color:#fff;border:0;border-radius:10px;padding:9px 14px;font-weight:800;cursor:pointer}}@media print{.screen-actions{display:none!important}.sup-card{page-break-inside:avoid}.cards{grid-template-columns:repeat(4,1fr)}}</style></head><body><main class="page"><div class="screen-actions"><button onclick="window.print()">طباعة</button><button onclick="window.close()">إغلاق</button></div><section class="report-head"><div><h1>تقرير الأوقات الشهرية</h1><p>يعرض المشرف الحالي للمشروع وأسماء العمال الحالية من جدول العمال مباشرة.</p></div><div class="brand-box">شركة تصنيف<br><small>إدارة المرافق</small></div></section><section class="meta"><div><small>الشهر</small><b>${E(month)}</b></div><div><small>عدد السجلات</small><b>${fmt0(totalRecords)}</b></div><div><small>إجمالي الساعات</small><b>${fmt2(totalMinutes/60)}</b></div><div><small>المشاريع</small><b>${fmt0(projectCount)}</b></div></section><section class="cards">${cards}</section><div class="footer">تم إنشاء التقرير بالأسماء الحالية بعد آخر تحديث: ${new Date().toLocaleString('ar-SA')}</div></main><script>setTimeout(()=>window.print(),500)<\/script></body></html>`;
    const win=window.open('','_blank','width=1200,height=850'); if(!win){alert('المتصفح منع نافذة الطباعة.');return;} win.document.open(); win.document.write(html); win.document.close();
  }
  function rebuild(){
    alert('تحديث ملخص الشهر يحسب الدقائق فقط. أما أسماء المشرفين والعمال فيتم تحديثها تلقائيًا من البيانات الحالية.');
    load();
  }
  function bindButton(id,fn){
    const el=$(id); if(!el || el.__v10192Bound) return; el.__v10192Bound=true;
    el.addEventListener('click',function(e){e.preventDefault(); e.stopImmediatePropagation(); fn();},true);
  }
  function bind(){
    if($('mt52Month') && !$('mt52Month').value) $('mt52Month').value=ymNow();
    $('mt52Month')?.addEventListener('change',load);
    $('mt52Supervisor')?.addEventListener('change',render);
    $('mt52Project')?.addEventListener('change',render);
    bindButton('mt52Refresh',load); bindButton('mt52Rebuild',rebuild); bindButton('mt52Csv',csv); bindButton('mt52Print',printReport);
    window.TasneefMonthlyV10154=Object.assign({},window.TasneefMonthlyV10154||{},{reload:load,rebuild,csv,print:printReport,render});
    window.renderMonthly=load; window.exportMonthlyCSV=csv; window.printMonthlyReportV57=printReport;
    setTimeout(load,500);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true}); else setTimeout(bind,0);
  console.log('Tasneef V10192 monthly live supervisor/worker names loaded');
})();

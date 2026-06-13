/* Tasneef v10099 - Core Monthly Times Owner
   Scope: ONLY #monthly page. No global DOM deletion, no finance/tickets/services changes.
   Purpose: one stable renderer for monthly times and prevent duplicated monthly blocks INSIDE the monthly page only.
*/
(function(){
  'use strict';
  if(window.__tasneefMonthlyCoreV10099) return;
  window.__tasneefMonthlyCoreV10099 = true;
  const VERSION='v10099-monthly-core-only';
  const $=id=>document.getElementById(id);
  const N=v=>{ const x=Number(String(v??0).replace(/,/g,'').trim()); return Number.isFinite(x)?x:0; };
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today=()=>new Date().toISOString().slice(0,10);
  const monthNow=()=>today().slice(0,7);
  const dateOnly=v=>{ const s=String(v||''); if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10); const d=new Date(s); return isNaN(d)?'':d.toISOString().slice(0,10); };
  const monthStart=m=>`${m}-01`;
  const monthEnd=m=>{ const [y,mo]=String(m||monthNow()).split('-').map(Number); return `${y}-${String(mo).padStart(2,'0')}-${String(new Date(y,mo,0).getDate()).padStart(2,'0')}`; };
  const minsText=v=> typeof window.minsToText==='function' ? window.minsToText(N(v)) : `${Math.round(N(v))} دقيقة`;
  const pctText=v=>`${N(v).toFixed(1)}%`;
  function getData(){ window.data=window.data||{}; return window.data; }
  function users(){ const d=getData(); return Array.isArray(d.users)?d.users:(Array.isArray(d.supervisors)?d.supervisors:[]); }
  function projects(){ const d=getData(); return Array.isArray(d.projects)?d.projects:[]; }
  function logs(){ const d=getData(); return Array.isArray(d.logs)?d.logs:(Array.isArray(d.time_logs)?d.time_logs:[]); }
  function superName(id){ try{ if(typeof window.supervisorName==='function') return window.supervisorName(id); }catch(e){} const u=users().find(x=>String(x.id)===String(id)); return u?.full_name||u?.name||u?.username||'-'; }
  function projName(id){ try{ if(typeof window.projectName==='function') return window.projectName(id); }catch(e){} const p=projects().find(x=>String(x.id)===String(id)); return p?.name||p?.project_name||'-'; }
  function logActual(l){ try{ if(typeof window.logActualMinutes==='function') return N(window.logActualMinutes(l)); }catch(e){} if(l.duration_minutes!=null) return N(l.duration_minutes); if(l.total_minutes!=null) return N(l.total_minutes); try{ if(typeof window.minutesBetween==='function') return N(window.minutesBetween(l.check_in,l.check_out)); }catch(e){} return 0; }
  function requiredForProject(projectId, day){ try{ if(typeof window.requiredMinutesForLog==='function') return N(window.requiredMinutesForLog(projectId, day)); }catch(e){} const p=projects().find(x=>String(x.id)===String(projectId)); if(!p) return 0; const wd=new Date(day+'T00:00:00').getDay(); if(wd===5 && N(p.friday_minutes)>0) return N(p.friday_minutes); return N(p.required_daily_minutes||p.required_minutes||p.daily_minutes||0); }
  function daysInMonth(m){ const [y,mo]=String(m).split('-').map(Number); const last=new Date(y,mo,0).getDate(); return Array.from({length:last},(_,i)=>`${m}-${String(i+1).padStart(2,'0')}`); }
  function monthlyRoot(){ return $('monthly'); }
  function canonicalCard(){ const root=monthlyRoot(); if(!root) return null; return ($('monthlyBody')||{}).closest ? $('monthlyBody').closest('.card') : root.querySelector('.card'); }
  function normalizeMonthlyOnly(){
    const root=monthlyRoot(); if(!root) return;
    const card=canonicalCard() || root.querySelector('.card');
    if(!card) return;
    // never touch outside #monthly. Remove only duplicated monthly cards inside #monthly.
    Array.from(root.querySelectorAll(':scope > .card')).forEach(c=>{ if(c!==card) c.remove(); });
    ['monthlyBody','monthlySummary','monthlyMonth','monthlySupervisor'].forEach(id=>{
      const nodes=Array.from(root.querySelectorAll('#'+id));
      nodes.forEach((n,i)=>{ if(i>0) n.remove(); });
    });
  }
  function fillSupervisorFilter(){
    const sel=$('monthlySupervisor'); if(!sel) return;
    const current=sel.value||'';
    const list=users().filter(u=>!u.role || String(u.role).includes('supervisor') || String(u.role)==='مشرف');
    if(sel.options.length<=1 && list.length){
      sel.innerHTML='<option value="">كل المشرفين</option>'+list.map(u=>`<option value="${esc(u.id)}">${esc(u.full_name||u.name||u.username)}</option>`).join('');
      sel.value=current;
    }
  }
  const manualKey=()=>`tasneef_monthly_manual_core_${$('monthlyMonth')?.value||monthNow()}_${$('monthlySupervisor')?.value||'all'}`;
  const readManual=()=>{ try{return JSON.parse(localStorage.getItem(manualKey())||'{}')||{};}catch(e){return {}} };
  const writeManual=o=>localStorage.setItem(manualKey(), JSON.stringify(o||{}));
  const rowKey=(s,p)=>`${s||'none'}__${p||'none'}`;
  function monthLogs(month, sid){ let arr=logs().filter(l=>dateOnly(l.log_date||l.date||l.check_in||l.created_at).slice(0,7)===month); if(sid) arr=arr.filter(l=>String(l.supervisor_id||l.user_id||'')===String(sid)); return arr; }
  function buildRows(){
    const month=$('monthlyMonth')?.value||monthNow();
    const sid=$('monthlySupervisor')?.value||'';
    const ds=daysInMonth(month);
    const map=new Map();
    monthLogs(month,sid).forEach(l=>{
      const s=l.supervisor_id||l.user_id||''; const p=l.project_id||''; const k=rowKey(s,p);
      if(!map.has(k)) map.set(k,{key:k,s,p,records:0,actual:0,travel:0});
      const r=map.get(k); r.records++; r.actual+=logActual(l); r.travel+=N(l.travel_minutes||l.move_minutes);
    });
    let rows=[...map.values()].map(r=>{ const req=ds.reduce((a,d)=>a+requiredForProject(r.p,d),0); const percent=req? r.actual/req*100 : 0; return {...r,required:req,percent,workers:''}; });
    const manual=readManual();
    rows=rows.map(r=>{ const m=manual[r.key]||{}; return {...r,workers:m.workers??r.workers,percent:(m.percent!==undefined&&m.percent!=='')?N(m.percent):r.percent,hasManual:!!manual[r.key]}; });
    return rows.sort((a,b)=>String(superName(a.s)).localeCompare(String(superName(b.s)),'ar') || String(projName(a.p)).localeCompare(String(projName(b.p)),'ar'));
  }
  async function fetchMonthOnce(month){
    window.__monthlyCoreLoadedV10099=window.__monthlyCoreLoadedV10099||new Set();
    if(window.__monthlyCoreLoadedV10099.has(month) || window.__monthlyCoreLoadingV10099) return false;
    window.__monthlyCoreLoadingV10099=true;
    const before=monthLogs(month,'').length;
    try{
      if(typeof window.fetchTimeLogsRangeV91==='function') await window.fetchTimeLogsRangeV91(monthStart(month), monthEnd(month), {limit:5000});
      else if(window.sb){
        const r=await window.sb.from('time_logs').select('*').gte('log_date',monthStart(month)).lte('log_date',monthEnd(month)).order('id',{ascending:false}).limit(5000);
        if(!r.error){ const d=getData(); d.logs=Array.isArray(d.logs)?d.logs:[]; const seen=new Set(d.logs.map(x=>String(x.id||JSON.stringify(x)))); (r.data||[]).forEach(x=>{ const k=String(x.id||JSON.stringify(x)); if(!seen.has(k)) d.logs.push(x); }); }
      }
    }catch(e){ console.warn(VERSION,'fetch failed',e); }
    window.__monthlyCoreLoadingV10099=false;
    window.__monthlyCoreLoadedV10099.add(month);
    return monthLogs(month,'').length!==before;
  }
  window.monthlyCoreSaveV10099=function(k){ const manual=readManual(); const row=(window.__monthlyRowsCoreV10099||[]).find(r=>r.key===k)||{}; manual[k]={...(manual[k]||{}),workers:document.querySelector(`[data-monthly-workers-core="${CSS.escape(k)}"]`)?.value||'',percent:document.querySelector(`[data-monthly-percent-core="${CSS.escape(k)}"]`)?.value||'',supervisor_id:row.s,project_id:row.p}; writeManual(manual); window.renderMonthly(); };
  let rendering=false;
  window.renderMonthly=function(){
    if(rendering) return;
    rendering=true;
    try{
      normalizeMonthlyOnly(); fillSupervisorFilter();
      const m=$('monthlyMonth'); if(m && !m.value) m.value=monthNow();
      const body=$('monthlyBody'), summary=$('monthlySummary'); if(!body) return;
      const table=body.closest('table'); if(table?.tHead) table.tHead.innerHTML='<tr><th>المشرف</th><th>المشروع</th><th>أسماء العمال</th><th>عدد السجلات</th><th>الساعات المطلوبة</th><th>الساعات الفعلية</th><th>وقت الانتقال</th><th>نسبة العمل</th><th>إجراء</th></tr>';
      const rows=buildRows(); window.__monthlyRowsCoreV10099=rows;
      body.innerHTML=rows.map(r=>`<tr><td>${esc(superName(r.s))}</td><td>${esc(projName(r.p))}</td><td><input data-monthly-workers-core="${esc(r.key)}" value="${esc(r.workers||'')}" placeholder="أسماء العمال"></td><td>${r.records||0}</td><td>${minsText(r.required)}</td><td>${minsText(r.actual)}</td><td>${N(r.travel)} دقيقة</td><td><input data-monthly-percent-core="${esc(r.key)}" type="number" step="0.1" value="${N(r.percent).toFixed(1)}" style="width:90px"></td><td><button onclick="monthlyCoreSaveV10099('${esc(r.key)}')">حفظ</button></td></tr>`).join('') || '<tr><td colspan="9">لا توجد بيانات لهذا الشهر.</td></tr>';
      const total=rows.reduce((a,r)=>a+N(r.actual),0), req=rows.reduce((a,r)=>a+N(r.required),0), rec=rows.reduce((a,r)=>a+N(r.records),0), pct=rows.length?rows.reduce((a,r)=>a+N(r.percent),0)/rows.length:(req?total/req*100:0);
      if(summary) summary.innerHTML=`<div class="kpi"><small>عدد المشاريع</small><b>${rows.length}</b></div><div class="kpi"><small>عدد السجلات</small><b>${rec}</b></div><div class="kpi"><small>إجمالي الوقت</small><b>${minsText(total)}</b></div><div class="kpi"><small>إجمالي المطلوب</small><b>${minsText(req)}</b></div><div class="kpi"><small>متوسط النسبة</small><b>${pctText(pct)}</b></div>`;
      const month=$('monthlyMonth')?.value||monthNow();
      fetchMonthOnce(month).then(changed=>{ if(changed && $('monthly') && !$('monthly').classList.contains('hidden')) window.renderMonthly(); });
    }finally{ rendering=false; }
  };
  window.exportMonthlyCSV=function(){ const rows=window.__monthlyRowsCoreV10099||buildRows(); const csv=['المشرف,المشروع,أسماء العمال,عدد السجلات,الساعات المطلوبة,الساعات الفعلية,وقت الانتقال,نسبة العمل',...rows.map(r=>[superName(r.s),projName(r.p),r.workers||'',r.records||0,minsText(r.required),minsText(r.actual),N(r.travel)+' دقيقة',pctText(r.percent)].map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(','))].join('\n'); if(typeof window.download==='function') window.download('monthly.csv',csv); else { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download='monthly.csv'; a.click(); } };
  const oldShow=window.showPage;
  if(typeof oldShow==='function' && !oldShow.__monthlyCoreV10099){
    window.showPage=function(page,btn){ const r=oldShow.apply(this,arguments); if(page==='monthly') setTimeout(()=>{ try{window.renderMonthly();}catch(e){console.warn(VERSION,e);} },80); return r; };
    window.showPage.__monthlyCoreV10099=true;
  }
  function init(){ normalizeMonthlyOnly(); fillSupervisorFilter(); if($('monthlyBody')) window.renderMonthly(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.addEventListener('load',()=>setTimeout(init,500));
  console.log('Loaded '+VERSION);
})();

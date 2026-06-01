/* Tasneef v285 hotfix: monthly from daily logs + distribution export */
(function(){
  'use strict';
  const FIX_VERSION = 'v285-hotfix-monthly-distribution';
  const $ = id => document.getElementById(id);
  const sid = v => v == null ? '' : String(v);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const monthVal = () => $('monthlyMonth')?.value || new Date().toISOString().slice(0,7);
  const dateOnly = v => String(v || '').slice(0,10).replace(/\//g,'-');
  const inMonth = (v,m) => dateOnly(v).slice(0,7) === String(m||monthVal()).slice(0,7);
  const nextDay = d => { const x = new Date(d+'T00:00:00'); x.setDate(x.getDate()+1); return x.toISOString().slice(0,10); };
  const monthDays = m => { const [y,mo]=String(m).split('-').map(Number); const n=new Date(y,mo,0).getDate(); return Array.from({length:n},(_,i)=>`${m}-${String(i+1).padStart(2,'0')}`); };
  const getSupName = id => (typeof window.supervisorName==='function' ? window.supervisorName(id) : '') || (window.data?.users||[]).find(u=>sid(u.id)===sid(id))?.full_name || '-';
  const getProjName = id => (typeof window.projectName==='function' ? window.projectName(id) : '') || (window.data?.projects||[]).find(p=>sid(p.id)===sid(id))?.name || '-';
  const getWorkerName = id => (typeof window.workerName==='function' ? window.workerName(id) : '') || (window.data?.workers||[]).find(w=>sid(w.id)===sid(id))?.name || '';
  const minutesText = m => (typeof window.minsToText==='function' ? window.minsToText(Number(m)||0) : `${Math.floor((Number(m)||0)/60)} ساعة ${(Number(m)||0)%60} دقيقة`);
  function logMinutes(l){
    const direct = Number(l.duration_minutes ?? l.actual_minutes ?? l.minutes ?? 0);
    if(Number.isFinite(direct) && direct > 0) return direct;
    if(l.check_in && l.check_out){ const a=new Date(l.check_in), b=new Date(l.check_out); const d=(b-a)/60000; return Number.isFinite(d)&&d>0?Math.round(d):0; }
    return 0;
  }
  function projectSupervisor(pid){ return (window.data?.projects||[]).find(p=>sid(p.id)===sid(pid))?.supervisor_id || ''; }
  function assignments(){ return (window.data?.workerAssignments||[]).filter(a=>a && a.is_active!==false); }
  function workersForProject(pid){
    const names = new Set();
    (window.data?.workers||[]).forEach(w=>{ if(sid(w.project_id)===sid(pid) && (w.status||'active')!=='inactive') names.add(w.name); });
    assignments().forEach(a=>{ if(sid(a.project_id)===sid(pid)){ const n=getWorkerName(a.worker_id); if(n) names.add(n); } });
    return [...names].filter(Boolean).join('، ') || '-';
  }
  function mergeLogs(rows){
    if(!window.data) window.data = {};
    const map = new Map();
    (window.data.logs||[]).forEach(l=>{ if(l && l.id != null) map.set(sid(l.id), l); });
    (rows||[]).forEach(l=>{ if(l && l.id != null) map.set(sid(l.id), l); });
    window.data.logs = [...map.values()];
  }
  async function fetchMonthSmall(month){
    // محاولة خفيفة: نقرأ الشهر يومًا بيوم وبأعمدة محددة فقط حتى لا يعلق الاستعلام الكبير.
    const cachedKey = '__v285_month_loaded_' + month;
    if(window.data?.[cachedKey]) return (window.data.logs||[]).filter(l=>inMonth(l.log_date||l.check_in||l.created_at, month));
    const rows = [];
    const errors = [];
    for(const d of monthDays(month)){
      try{
        const r1 = await sb.from('time_logs')
          .select('id,log_date,check_in,check_out,duration_minutes,supervisor_id,project_id,worker_id,visit_type,time_status,notes')
          .eq('log_date', d).limit(800);
        if(r1.error) errors.push(r1.error.message); else rows.push(...(r1.data||[]));
      }catch(e){ errors.push(e?.message||String(e)); }
      try{
        const r2 = await sb.from('time_logs')
          .select('id,log_date,check_in,check_out,duration_minutes,supervisor_id,project_id,worker_id,visit_type,time_status,notes')
          .gte('check_in', d + 'T00:00:00').lt('check_in', nextDay(d) + 'T00:00:00').limit(800);
        if(r2.error) errors.push(r2.error.message); else rows.push(...(r2.data||[]));
      }catch(e){ errors.push(e?.message||String(e)); }
      // لو بدأ timeout نكمل لكن لا نكسر الصفحة.
    }
    mergeLogs(rows);
    if(window.data) window.data[cachedKey] = true;
    if(errors.length && window.data) window.data.monthlyV285Error = [...new Set(errors)].slice(0,3).join(' | ');
    return (window.data.logs||[]).filter(l=>inMonth(l.log_date||l.check_in||l.created_at, month));
  }
  function buildMonthlyRows(logs){
    const selectedSup = $('monthlySupervisor')?.value || '';
    const map = new Map();
    logs.forEach(l=>{
      const pid = l.project_id; if(!pid) return;
      const sup = l.supervisor_id || projectSupervisor(pid) || '';
      if(selectedSup && sid(sup)!==sid(selectedSup)) return;
      const key = sid(sup)+'_'+sid(pid);
      if(!map.has(key)) map.set(key, {sup, pid, minutes:0, count:0});
      const r = map.get(key); r.minutes += logMinutes(l); r.count += 1;
    });
    const rows = [...map.values()].sort((a,b)=>String(getSupName(a.sup)).localeCompare(String(getSupName(b.sup)),'ar') || String(getProjName(a.pid)).localeCompare(String(getProjName(b.pid)),'ar'));
    const totals = {}; rows.forEach(r=>{ totals[sid(r.sup)] = (totals[sid(r.sup)]||0)+r.minutes; });
    return rows.map(r=>({...r, percent: totals[sid(r.sup)] ? r.minutes/totals[sid(r.sup)]*100 : 0, workers:workersForProject(r.pid)}));
  }
  window.renderMonthly = async function(){
    const body = $('monthlyBody'); if(!body) return;
    const month = monthVal();
    body.innerHTML = '<tr><td colspan="6">جاري تحميل بيانات الشهر...</td></tr>';
    let logs = (window.data?.logs||[]).filter(l=>inMonth(l.log_date||l.check_in||l.created_at, month));
    if(!logs.length) logs = await fetchMonthSmall(month);
    const table = body.closest('table');
    if(table?.tHead) table.tHead.innerHTML = '<tr><th>المشرف</th><th>المشروع</th><th>أسماء العمال</th><th>الساعات الفعلية</th><th>نسبة العمل</th><th>حالة الأداء</th></tr>';
    const rows = buildMonthlyRows(logs);
    if(!rows.length){
      const err = window.data?.monthlyV285Error ? '<br><small style="color:#b00020">'+esc(window.data.monthlyV285Error)+'</small>' : '';
      body.innerHTML = '<tr><td colspan="6">لا توجد بيانات لهذا الشهر داخل time_logs بعد البحث الذكي.'+err+'</td></tr>';
      if($('monthlySummary')) $('monthlySummary').innerHTML = '<div class="kpi"><small>إجمالي الساعات الفعلية</small><b>0 دقيقة</b></div><div class="kpi"><small>عدد المشرفين</small><b>0</b></div><div class="kpi"><small>عدد المشاريع</small><b>0</b></div>';
      return;
    }
    let html='', last='__none__', group=0;
    const flush=()=>{ if(last!=='__none__'){ html += `<tr style="background:#f4fbf8;font-weight:900"><td colspan="3">مجموع ${esc(getSupName(last))}</td><td>${esc(minutesText(group))}</td><td>100%</td><td>—</td></tr>`; } };
    rows.forEach(r=>{ if(last!=='__none__' && sid(last)!==sid(r.sup)){ flush(); group=0; } last=r.sup; group+=r.minutes; const status=r.percent>=70?'جيد':'ضعيف'; html += `<tr><td>${esc(getSupName(r.sup))}</td><td>${esc(getProjName(r.pid))}</td><td>${esc(r.workers)}</td><td>${esc(minutesText(r.minutes))}</td><td>${r.percent.toFixed(1)}%</td><td>${status}</td></tr>`; });
    flush(); body.innerHTML = html;
    const grand = rows.reduce((a,r)=>a+r.minutes,0); const supCount = new Set(rows.map(r=>sid(r.sup))).size;
    if($('monthlySummary')) $('monthlySummary').innerHTML = `<div class="kpi"><small>إجمالي الساعات الفعلية</small><b>${esc(minutesText(grand))}</b></div><div class="kpi"><small>عدد المشرفين</small><b>${supCount}</b></div><div class="kpi"><small>عدد المشاريع</small><b>${rows.length}</b></div>`;
  };
  window.exportSupervisorWorkerDistributionV285 = function(){
    const projects=(window.data?.projects||[]).slice().sort((a,b)=>String(getSupName(a.supervisor_id)).localeCompare(String(getSupName(b.supervisor_id)),'ar') || String(a.name||'').localeCompare(String(b.name||''),'ar'));
    const rows=projects.map(p=>{ const workers=workersForProject(p.id); return {supervisor:getSupName(p.supervisor_id), project:p.name||getProjName(p.id), workers, count:workers==='-'?0:workers.split('،').filter(Boolean).length}; });
    const trs=rows.map(r=>`<tr><td>${esc(r.supervisor)}</td><td>${esc(r.project)}</td><td>${esc(r.workers)}</td><td>${r.count}</td></tr>`).join('');
    const html=`<html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>body{font-family:Tahoma,Arial}table{border-collapse:collapse;width:100%}th{background:#0a4033;color:#fff}td,th{border:1px solid #999;padding:8px;text-align:right}h2{color:#0a4033}</style></head><body><h2>توزيع المشرفين مع المشاريع والعمال</h2><table><thead><tr><th>المشرف</th><th>المشروع</th><th>العمال</th><th>عدد العمال</th></tr></thead><tbody>${trs}</tbody></table></body></html>`;
    const blob=new Blob(['\ufeff'+html],{type:'application/vnd.ms-excel;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='supervisors_workers_distribution.xls'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1200);
  };
  function injectExportBtn(){
    if($('exportSupervisorWorkerDistributionV285')) return;
    const section = $('projects') || $('workers') || document.body;
    const head = section.querySelector?.('.section-head') || section;
    const btn=document.createElement('button'); btn.id='exportSupervisorWorkerDistributionV285'; btn.type='button'; btn.textContent='تنزيل توزيع المشرفين والعمال'; btn.onclick=()=>window.exportSupervisorWorkerDistributionV285(); btn.style.marginInlineStart='8px'; head.appendChild(btn);
  }
  function bind(){ const m=$('monthlyMonth'), s=$('monthlySupervisor'); if(m && !m.dataset.v285){m.dataset.v285='1'; m.addEventListener('change',()=>window.renderMonthly());} if(s && !s.dataset.v285){s.dataset.v285='1'; s.addEventListener('change',()=>window.renderMonthly());} }
  function badge(){ ['tasneefFixBadgeV280','tasneefFixBadgeV281','tasneefFixBadgeV282','tasneefFixBadgeV283','tasneefFixBadgeV284','tasneefFixBadgeV285'].forEach(id=>{ const old=$(id); if(old) old.remove(); }); const b=document.createElement('div'); b.id='tasneefFixBadgeV285'; b.textContent='Tasneef '+FIX_VERSION; b.style.cssText='position:fixed;left:10px;bottom:10px;z-index:999999;background:#0a4033;color:#fff;padding:7px 11px;border-radius:12px;font:12px Arial;box-shadow:0 4px 12px #0003;opacity:.95'; document.body.appendChild(b); }
  function start(){ injectExportBtn(); bind(); badge(); if($('monthlyBody')) setTimeout(()=>window.renderMonthly(),500); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.addEventListener('load',()=>{ start(); let n=0; const t=setInterval(()=>{ badge(); injectExportBtn(); if(++n>12) clearInterval(t); },700); });
  console.log('Tasneef '+FIX_VERSION+' loaded');
})();

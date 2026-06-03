/* ===== V332: Monthly fast reliable month loading + editable workers/percent only ===== */
(function(){
  'use strict';
  const VERSION='v332-monthly-fast-manual';
  const $=id=>document.getElementById(id);
  const n=v=>{ const x=Number(String(v??0).replace(/,/g,'').trim()); return Number.isFinite(x)?x:0; };
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today=()=>new Date().toISOString().slice(0,10);
  const monthStart=m=>`${m}-01`;
  const monthEnd=m=>{ const [y,mo]=String(m||today().slice(0,7)).split('-').map(Number); return `${y}-${String(mo).padStart(2,'0')}-${String(new Date(y,mo,0).getDate()).padStart(2,'0')}`; };
  const dateOnly=v=>{ const s=String(v||''); if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10); const d=new Date(s); return isNaN(d)?'':d.toISOString().slice(0,10); };
  const minsText=v=> typeof window.minsToText==='function' ? window.minsToText(n(v)) : `${n(v)} دقيقة`;
  const pctText=v=> (n(v)).toFixed(1)+'%';
  const superName=id=> typeof window.supervisorName==='function' ? window.supervisorName(id) : ((window.data?.users||[]).find(u=>String(u.id)===String(id))?.full_name || '-');
  const projName=id=> typeof window.projectName==='function' ? window.projectName(id) : ((window.data?.projects||[]).find(p=>String(p.id)===String(id))?.name || '-');
  const keyBase=()=>`tasneef_monthly_manual_v332_${$('monthlyMonth')?.value||today().slice(0,7)}_${$('monthlySupervisor')?.value||'all'}`;
  const readManual=()=>{ try{return JSON.parse(localStorage.getItem(keyBase())||'{}')||{};}catch(e){return {}} };
  const writeManual=obj=>localStorage.setItem(keyBase(), JSON.stringify(obj||{}));
  function rowKey(s,p){ return `${s||'manual'}__${p||'manual'}`; }
  function getProjectReq(projectId, d){
    try{ if(typeof window.requiredMinutesForLog==='function') return n(window.requiredMinutesForLog(projectId,d)); }catch(e){}
    const p=(window.data?.projects||[]).find(x=>String(x.id)===String(projectId));
    if(!p) return 0;
    const day=new Date(d+'T00:00:00').getDay();
    if(day===5 && n(p.friday_minutes)>0) return n(p.friday_minutes);
    return n(p.required_daily_minutes||p.required_minutes||0);
  }
  function logActual(l){
    try{ if(typeof window.logActualMinutes==='function') return n(window.logActualMinutes(l)); }catch(e){}
    if(l.duration_minutes!=null) return n(l.duration_minutes);
    try{ if(typeof window.minutesBetween==='function') return n(window.minutesBetween(l.check_in,l.check_out)); }catch(e){}
    return 0;
  }
  function daysInMonth(m){ const [y,mo]=String(m).split('-').map(Number); const last=new Date(y,mo,0).getDate(); return Array.from({length:last},(_,i)=>`${m}-${String(i+1).padStart(2,'0')}`); }
  function monthLogs(month, sid){
    let logs=(window.data?.logs||[]).filter(l=>dateOnly(l.log_date||l.check_in||l.created_at).slice(0,7)===month);
    if(sid) logs=logs.filter(l=>String(l.supervisor_id)===String(sid));
    return logs;
  }
  async function ensureMonthLoaded(month){
    window.__tasneefMonthlyLoadedV332 = window.__tasneefMonthlyLoadedV332 || new Set();
    if(window.__tasneefMonthlyLoadedV332.has(month)) return;
    const before=monthLogs(month,'').length;
    try{
      if(typeof window.fetchTimeLogsRangeV91==='function'){
        await window.fetchTimeLogsRangeV91(monthStart(month), monthEnd(month), {limit:5000});
      }else if(window.sb){
        const res=await window.sb.from('time_logs').select('*').gte('log_date',monthStart(month)).lte('log_date',monthEnd(month)).order('id',{ascending:false}).limit(5000);
        if(!res.error){ window.data=window.data||{}; window.data.logs=Array.isArray(window.data.logs)?window.data.logs:[]; const seen=new Set(window.data.logs.map(x=>String(x.id||JSON.stringify(x)))); (res.data||[]).forEach(x=>{ const k=String(x.id||JSON.stringify(x)); if(!seen.has(k)) window.data.logs.push(x); }); }
      }
    }catch(e){ console.warn('V332 monthly fetch failed',e); }
    const after=monthLogs(month,'').length;
    window.__tasneefMonthlyLoadedV332.add(month);
    if(after!==before) return true;
  }
  function buildRows(){
    const month=$('monthlyMonth')?.value || today().slice(0,7);
    const sid=$('monthlySupervisor')?.value || '';
    const logs=monthLogs(month,sid);
    const days=daysInMonth(month);
    const map=new Map();
    logs.forEach(l=>{
      const s=l.supervisor_id||''; const p=l.project_id||''; const k=rowKey(s,p);
      if(!map.has(k)) map.set(k,{key:k,s,p,records:0,actual:0,travel:0,days:new Set()});
      const r=map.get(k); r.records++; r.days.add(dateOnly(l.log_date||l.check_in||l.created_at)); r.actual+=logActual(l); r.travel+=n(l.travel_minutes);
    });
    let rows=[...map.values()].map(r=>{
      const req=days.reduce((a,d)=>a+getProjectReq(r.p,d),0);
      const percent=req ? r.actual/req*100 : 0;
      return {...r, required:req, percent, workers:'', manual:false};
    });
    const manual=readManual();
    rows=rows.map(r=>{
      const m=manual[r.key]||{};
      return {...r, workers:m.workers??r.workers, percent:(m.percent!==undefined&&m.percent!=='')?n(m.percent):r.percent, hasManual:!!manual[r.key]};
    });
    Object.entries(manual).forEach(([k,m])=>{
      if(rows.some(r=>r.key===k)) return;
      rows.push({key:k,s:m.supervisor_id||'',p:m.project_id||'',records:n(m.records),actual:n(m.actual),travel:n(m.travel),required:n(m.required),percent:n(m.percent),workers:m.workers||'',manual:true,hasManual:true});
    });
    return rows.sort((a,b)=>String(superName(a.s)).localeCompare(String(superName(b.s)),'ar') || String(projName(a.p)).localeCompare(String(projName(b.p)),'ar'));
  }
  function injectMonthlyToolbar(){
    const card=$('monthly')?.querySelector('.card'); if(!card || $('monthlyManualToolbarV332')) return;
    const box=document.createElement('div'); box.id='monthlyManualToolbarV332'; box.className='card'; box.style.margin='12px 0';
    box.innerHTML=`<h3>تعديل النسب وأسماء العمال</h3><div class="filters"><select id="monthlyManualSupervisorV332"></select><select id="monthlyManualProjectV332"></select><input id="monthlyManualWorkersV332" placeholder="أسماء العمال"><input id="monthlyManualPercentV332" type="number" step="0.1" placeholder="النسبة %"><button onclick="monthlyAddManualRowV332()">إضافة صف يدوي</button><button class="light" onclick="monthlyClearManualV332()">مسح التعديلات اليدوية للشهر</button></div><div class="footer-note">التعديل هنا يغير النسبة وأسماء العمال فقط للشهر المختار، ولا يغير التسجيلات اليومية الأصلية.</div>`;
    const tableWrap=card.querySelector('.table-wrap'); card.insertBefore(box, tableWrap);
    fillManualSelects();
  }
  function fillManualSelects(){
    const sup=$('monthlyManualSupervisorV332'), proj=$('monthlyManualProjectV332');
    if(sup && !sup.dataset.filled){ sup.innerHTML='<option value="">اختر المشرف</option>'+((window.data?.supervisors||window.data?.users||[]).filter(u=>!u.role||u.role==='supervisor').map(u=>`<option value="${esc(u.id)}">${esc(u.full_name||u.name||u.username)}</option>`).join('')); sup.dataset.filled='1'; }
    if(proj && !proj.dataset.filled){ proj.innerHTML='<option value="">اختر المشروع</option>'+((window.data?.projects||[]).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')); proj.dataset.filled='1'; }
  }
  window.monthlyAddManualRowV332=function(){
    const s=$('monthlyManualSupervisorV332')?.value||''; const p=$('monthlyManualProjectV332')?.value||'';
    if(!s || !p){ alert('اختر المشرف والمشروع أولاً'); return; }
    const manual=readManual(); const k=rowKey(s,p);
    manual[k]={...(manual[k]||{}), supervisor_id:s, project_id:p, workers:$('monthlyManualWorkersV332')?.value||'', percent:n($('monthlyManualPercentV332')?.value), records:0, actual:0, travel:0, required:0};
    writeManual(manual); renderMonthly();
  };
  window.monthlySaveOverrideV332=function(k){
    const manual=readManual(); const row=window.__monthlyRowsV332?.find(r=>r.key===k)||{};
    manual[k]={...(manual[k]||{}), supervisor_id:row.s, project_id:row.p, workers:document.querySelector(`[data-monthly-workers="${CSS.escape(k)}"]`)?.value||'', percent:document.querySelector(`[data-monthly-percent="${CSS.escape(k)}"]`)?.value||'', records:row.records, actual:row.actual, travel:row.travel, required:row.required};
    writeManual(manual); renderMonthly();
  };
  window.monthlyDeleteOverrideV332=function(k){ const manual=readManual(); delete manual[k]; writeManual(manual); renderMonthly(); };
  window.monthlyClearManualV332=function(){ if(confirm('مسح كل تعديلات النسب والعمال لهذا الشهر؟')){ localStorage.removeItem(keyBase()); renderMonthly(); } };
  window.renderMonthly=function(){
    const body=$('monthlyBody'); if(!body) return;
    injectMonthlyToolbar(); fillManualSelects();
    const month=$('monthlyMonth')?.value || today().slice(0,7);
    const sid=$('monthlySupervisor')?.value || '';
    const rows=buildRows(); window.__monthlyRowsV332=rows;
    const table=body.closest('table');
    if(table?.tHead) table.tHead.innerHTML='<tr><th>المشرف</th><th>المشروع</th><th>أسماء العمال</th><th>عدد السجلات</th><th>الساعات المطلوبة</th><th>الساعات الفعلية</th><th>وقت الانتقال</th><th>نسبة العمل %</th><th>إجراء</th></tr>';
    body.innerHTML = rows.map(r=>`<tr><td>${esc(superName(r.s))}</td><td>${esc(projName(r.p))}</td><td><input data-monthly-workers="${esc(r.key)}" value="${esc(r.workers||'')}" placeholder="أسماء العمال" style="min-width:220px"></td><td>${r.records||0}${r.manual?' <span class="badge neutral">يدوي</span>':''}</td><td>${minsText(r.required)}</td><td>${minsText(r.actual)}</td><td>${n(r.travel)} دقيقة</td><td><input data-monthly-percent="${esc(r.key)}" type="number" step="0.1" value="${n(r.percent).toFixed(1)}" style="width:95px"></td><td><button onclick="monthlySaveOverrideV332('${esc(r.key)}')">حفظ</button><button class="light" onclick="monthlyDeleteOverrideV332('${esc(r.key)}')">إلغاء التعديل</button></td></tr>`).join('') || '<tr><td colspan="9">لا توجد بيانات لهذا الشهر. يمكنك إضافة صف يدوي من صندوق تعديل النسب وأسماء العمال.</td></tr>';
    const total=rows.reduce((a,r)=>a+n(r.actual),0), required=rows.reduce((a,r)=>a+n(r.required),0), records=rows.reduce((a,r)=>a+n(r.records),0), pct=rows.length? rows.reduce((a,r)=>a+n(r.percent),0)/rows.length : (required?total/required*100:0);
    if($('monthlySummary')) $('monthlySummary').innerHTML=`<div class="kpi"><small>عدد المشاريع</small><b>${rows.length}</b></div><div class="kpi"><small>عدد السجلات</small><b>${records}</b></div><div class="kpi"><small>إجمالي الوقت</small><b>${minsText(total)}</b></div><div class="kpi"><small>إجمالي المطلوب</small><b>${minsText(required)}</b></div><div class="kpi"><small>متوسط النسبة</small><b>${pctText(pct)}</b></div>`;
    // Load selected month in background once; no timeout freezes, no repeated refresh.
    if(!window.__tasneefMonthlyLoadedV332?.has(month) && !window.__tasneefMonthlyLoadingV332){
      window.__tasneefMonthlyLoadingV332=true;
      ensureMonthLoaded(month).then(changed=>{ window.__tasneefMonthlyLoadingV332=false; if(changed) renderMonthly(); }).catch(()=>{ window.__tasneefMonthlyLoadingV332=false; });
    }
  };
  window.exportMonthlyCSV=function(){
    const rows=window.__monthlyRowsV332||buildRows();
    const csv=['المشرف,المشروع,أسماء العمال,عدد السجلات,الساعات المطلوبة,الساعات الفعلية,وقت الانتقال,نسبة العمل',...rows.map(r=>[superName(r.s),projName(r.p),r.workers||'',r.records||0,minsText(r.required),minsText(r.actual),(n(r.travel)+' دقيقة'),pctText(r.percent)].map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(','))].join('\n');
    if(typeof window.download==='function') window.download('monthly.csv',csv); else { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='monthly.csv'; a.click(); }
  };
  window.addEventListener('load',()=>setTimeout(()=>{ try{ if($('monthlyBody')) renderMonthly(); }catch(e){ console.warn(VERSION,e); } },700));
  console.log('Loaded '+VERSION);
})();

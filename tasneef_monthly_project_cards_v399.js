/* V399 FINAL - الأوقات الشهرية الصحيحة من ملف شهر 6 بدون تجميد قديم */
(function(){
  'use strict';
  const VERSION='399';
  const MONTH='2026-06';
  const DATA_URL='monthly_june_codes_v389.json?v=399-'+Date.now();
  let RAW=[];
  const $=id=>document.getElementById(id);
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s||'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  const mins=m=>{m=Math.round(+m||0); const h=Math.floor(m/60), mm=m%60; if(!h) return mm+' دقيقة'; if(!mm) return h+' ساعة'; return h+' ساعة و '+mm+' دقيقة';};
  const pct=n=>{n=+n||0; return (Math.round(n*10)/10).toString().replace(/\.0$/,'')+'%';};
  const fullKeys=['وجود الياسمين','الرمز','الرمز 17 a','الرمز a17','العجلان ريفيرا 19','العجلان 19','الماجدية 88','صفاء 28','صفاء 65','العجلان 30','مكين 37'];
  const dailyKeys=['الشعلان 50','الشعلان 51'];
  const requiredByProject=[['وجود الياسمين',16200],['الرمز',16200],['الرمز 17 a',16200],['الرمز a17',16200],['العجلان ريفيرا 19',16200],['العجلان 19',16200],['الماجدية 88',16200],['صفاء 28',16200],['صفاء 65',21600],['العجلان 30',5940],['مكين 37',16200]];
  function isDailyName(n){const x=norm(n); return dailyKeys.some(k=>x.includes(norm(k)));}
  function isFullName(n){const x=norm(n); return fullKeys.some(k=>x.includes(norm(k)));}
  function reqFor(n,total){const x=norm(n); for(const [k,v] of requiredByProject){ if(x.includes(norm(k))) return v; } return total||1;}
  function isFull(r){return String(r.projectType||'').includes('دوام كامل');}
  function ensureCss(){
    if($('mt399css')) return;
    const st=document.createElement('style'); st.id='mt399css'; st.textContent=`
      .mt399-alert{background:#eaf7f2;border:1px solid #b9dfcb;color:#0A4033;border-radius:14px;padding:11px 14px;margin:10px 0;font-weight:900;grid-column:1/-1}
      .mt399-super{font-size:18px;font-weight:900;color:#0A4033;background:#f4faf7;border-right:6px solid #0A4033;border-radius:12px;padding:10px 12px;margin:14px 0 10px}.mt399-grid{display:grid;grid-template-columns:repeat(3,minmax(260px,1fr));gap:12px}.mt399-card{background:#fff;border:2px solid #111;border-radius:14px;padding:13px;min-height:220px;break-inside:avoid;page-break-inside:avoid}.mt399-card.full{border-color:#0A4033;background:linear-gradient(180deg,#fff,#f8fffb)}.mt399-card h4{margin:0 0 10px;text-align:center;font-size:20px;color:#061f18}.mt399-row{display:grid;grid-template-columns:1fr 1.25fr;gap:8px;border-top:1px solid #e7efec;padding:7px 0}.mt399-row span{color:#66746f}.mt399-row b{color:#061f18}.mt399-bar{height:9px;background:#edf3f1;border-radius:999px;overflow:hidden}.mt399-bar i{display:block;height:100%;background:#0A4033}.mt399-pills{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:9px}.mt399-pill{background:#eef8f5;border:1px solid #d5e9e2;border-radius:999px;padding:5px 9px;font-weight:900;color:#0A4033}.mt399-empty{padding:20px;border:1px dashed #b9dfcb;border-radius:16px;text-align:center;color:#60706a}
      @media(max-width:1200px){.mt399-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:760px){.mt399-grid{grid-template-columns:1fr}}
    `; document.head.appendChild(st);
  }
  function setBadge(){
    document.querySelectorAll('body *').forEach(el=>{ if(el.children.length===0 && /^V\d+$/i.test((el.textContent||'').trim())) el.textContent='V'+VERSION; });
    let b=$('mt399badge'); if(!b){b=document.createElement('div'); b.id='mt399badge'; b.textContent='V'+VERSION; b.style.cssText='position:fixed;left:14px;top:14px;z-index:999999;background:#fff;color:#0A4033;border:2px solid #0A4033;border-radius:999px;padding:8px 14px;font-weight:900;font-family:Tahoma,Arial,sans-serif;box-shadow:0 8px 22px rgba(0,0,0,.15)'; document.body.appendChild(b);} else b.textContent='V'+VERSION;
  }
  function fixMonth(){ const el=$('mt52Month'); if(el){el.value=MONTH; el.setAttribute('value',MONTH);} }
  function normalize(raw){
    const map=new Map();
    (raw||[]).forEach(x=>{
      const name=String(x.projectName||'').trim(); if(!name) return;
      const key=norm(name);
      const r={...x, month:MONTH, projectName:name, totalMinutes:+x.totalMinutes||0};
      if(isDailyName(name)) r.projectType='زيارة يومية'; else if(isFullName(name)) r.projectType='دوام كامل'; else r.projectType=String(x.projectType||'زيارة يومية');
      r.supervisorName=String(x.supervisorName||x.supervisorId||'-');
      r.workers=Array.isArray(x.workers)&&x.workers.length?x.workers:(Array.isArray(x.workerCodes)?x.workerCodes:[]);
      r.requiredMinutes=+x.requiredMinutes||0;
      if(r.projectType.includes('دوام كامل')) r.requiredMinutes=reqFor(name,r.totalMinutes);
      if(map.has(key)){ const a=map.get(key); a.totalMinutes+=r.totalMinutes; a.workers=[...new Set([...(a.workers||[]),...(r.workers||[])])]; }
      else map.set(key,r);
    });
    const rows=[...map.values()];
    const supTotals={}; rows.filter(r=>!isFull(r)).forEach(r=>{supTotals[r.supervisorName]=(supTotals[r.supervisorName]||0)+r.totalMinutes;});
    rows.forEach(r=>{ if(isFull(r)) r.percentage=r.requiredMinutes?(r.totalMinutes/r.requiredMinutes*100):0; else r.percentage=(supTotals[r.supervisorName]?(r.totalMinutes/supTotals[r.supervisorName]*100):0); r.hoursText=mins(r.totalMinutes); });
    return rows.sort((a,b)=> (isFull(a)-isFull(b)) || String(a.supervisorName).localeCompare(String(b.supervisorName),'ar') || String(a.projectName).localeCompare(String(b.projectName),'ar'));
  }
  function rows(){return normalize(RAW);} window.tasneefMonthlyV399Rows=rows;
  function card(r){return `<article class="mt399-card ${isFull(r)?'full':''}"><h4>${esc(r.projectName)}</h4><div class="mt399-row"><span>المشرف</span><b>${esc(r.supervisorName)}</b></div><div class="mt399-row"><span>نوع المشروع</span><b>${esc(r.projectType)}</b></div><div class="mt399-row"><span>الوقت المستغرق</span><b>${esc(mins(r.totalMinutes))}</b></div><div class="mt399-row"><span>إجمالي الدقائق</span><b>${Math.round(r.totalMinutes).toLocaleString('en-US')}</b></div>${isFull(r)?`<div class="mt399-row"><span>الوقت المطلوب</span><b>${esc(mins(r.requiredMinutes))}</b></div>`:''}<div class="mt399-row"><span>نسبة المشروع</span><b>${pct(r.percentage)}</b></div><div class="mt399-bar"><i style="width:${Math.min(100,Math.max(0,+r.percentage||0)).toFixed(0)}%"></i></div><div class="mt399-pills">${(r.workers||[]).map(w=>`<span class="mt399-pill">${esc(w)}</span>`).join('')||'<span class="mt399-pill">لا يوجد عمال</span>'}</div></article>`;}
  function render(){
    ensureCss(); setBadge(); fixMonth(); const all=rows(), daily=all.filter(r=>!isFull(r)), full=all.filter(isFull); window.tasneefMonthlyV396Rows=all; window.tasneefMonthlyV398Rows=all;
    const msg=$('mt52Message'); if(msg){msg.classList.remove('hidden'); msg.style.display='block'; msg.textContent='V399: تم عرض بيانات شهر 2026-06 من ملف الأوقات الشهري الصحيح، بدون تجميد قديم وبدون تصفير.';}
    const total=all.reduce((a,r)=>a+r.totalMinutes,0); const summary=$('mt52Summary'); if(summary){summary.innerHTML=`<div class="mt52-kpi"><small>الشهر</small><b>${MONTH}</b></div><div class="mt52-kpi"><small>المشاريع</small><b>${all.length}</b></div><div class="mt52-kpi"><small>مشاريع الزيارة</small><b>${daily.length}</b></div><div class="mt52-kpi"><small>دوام كامل / دائم</small><b>${full.length}</b></div><div class="mt52-kpi"><small>إجمالي الوقت</small><b>${esc(mins(total))}</b></div>`;}
    const vg=$('mt52VisitGrid'); if(vg){const groups=new Map(); daily.forEach(r=>{if(!groups.has(r.supervisorName))groups.set(r.supervisorName,[]); groups.get(r.supervisorName).push(r);}); vg.className=''; vg.innerHTML='<div class="mt399-alert">مشاريع الزيارة اليومية: كل مشروع مربع مستقل تحت اسم المشرف.</div>'+[...groups.entries()].map(([sup,list])=>`<section><div class="mt399-super">${esc(sup)}</div><div class="mt399-grid">${list.map(card).join('')}</div></section>`).join('');}
    const wg=$('mt52WorkersGrid'); if(wg){wg.className='mt399-grid'; wg.innerHTML=full.length?full.map(card).join(''):'<div class="mt399-empty">لا توجد مشاريع دوام كامل.</div>'; const cardTitle=document.querySelector('.monthly-workers-v10152 h2'); if(cardTitle) cardTitle.textContent='مشاريع الدوام الكامل / الدائمة'; const sm=document.querySelector('.monthly-workers-v10152 small'); if(sm) sm.textContent='كل مشروع مربع مستقل وحسابه لحاله.';}
    const tb=$('mt52Body'); if(tb){tb.innerHTML=all.map(r=>`<tr><td>${esc(r.supervisorName)}</td><td>${esc(r.projectName)}</td><td>${(r.workers||[]).map(esc).join('، ')}</td><td>-</td><td>${Math.round(r.totalMinutes).toLocaleString('en-US')}</td><td>${esc(mins(r.totalMinutes))}</td><td>${isFull(r)?Math.round(r.requiredMinutes).toLocaleString('en-US'):'-'}</td><td><b>${pct(r.percentage)}</b></td><td>${esc(r.projectType)}</td><td>${isFull(r)?'الوقت المستغرق ÷ الوقت المطلوب للمشروع نفسه':'وقت المشروع ÷ إجمالي وقت المشرف'}</td><td>V399</td></tr>`).join('');}
    return all;
  }
  function printReport(ev){ if(ev){ev.preventDefault(); ev.stopPropagation(); if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();} const all=render(), daily=all.filter(r=>!isFull(r)), full=all.filter(isFull), total=all.reduce((a,r)=>a+r.totalMinutes,0); const groups=new Map(); daily.forEach(r=>{if(!groups.has(r.supervisorName))groups.set(r.supervisorName,[]); groups.get(r.supervisorName).push(r);}); const css=`body{font-family:Tahoma,Arial,sans-serif;direction:rtl;margin:20px;color:#061f18}.head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0A4033;padding-bottom:12px;margin-bottom:12px}.logo{width:70px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.kpi{border:1px solid #cfe2dc;border-radius:14px;padding:10px;text-align:center}.kpi b{font-size:20px;color:#0A4033}.title{background:#eef8f5;border-right:6px solid #0A4033;border-radius:12px;padding:10px;margin:18px 0 10px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.mt399-card{background:#fff;border:2px solid #111;border-radius:14px;padding:13px;min-height:210px;break-inside:avoid;page-break-inside:avoid}.mt399-card.full{border-color:#0A4033}.mt399-card h4{text-align:center;margin:0 0 8px}.mt399-row{display:grid;grid-template-columns:1fr 1.25fr;border-top:1px solid #e7efec;padding:6px 0}.mt399-pills{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;margin-top:8px}.mt399-pill{background:#eef8f5;border:1px solid #d5e9e2;border-radius:999px;padding:4px 8px;font-weight:800}.mt399-bar{height:8px;background:#edf3f1;border-radius:999px;overflow:hidden}.mt399-bar i{display:block;height:100%;background:#0A4033}@page{size:A4;margin:11mm}@media print{.mt399-card{break-inside:avoid}.grid{grid-template-columns:repeat(2,1fr)}}`; const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية ${MONTH}</title><style>${css}</style></head><body><header class="head"><div><h1>تقرير الأوقات الشهرية</h1><b>شهر ${MONTH} - V399</b></div><img class="logo" src="tasneef_logo_print.png"></header><section class="kpis"><div class="kpi"><small>المشاريع</small><b>${all.length}</b></div><div class="kpi"><small>زيارة يومية</small><b>${daily.length}</b></div><div class="kpi"><small>دوام كامل</small><b>${full.length}</b></div><div class="kpi"><small>إجمالي الوقت</small><b>${mins(total)}</b></div></section><h2 class="title">مشاريع الزيارة اليومية</h2>${[...groups.entries()].map(([sup,list])=>`<h3>${esc(sup)}</h3><div class="grid">${list.map(card).join('')}</div>`).join('')}<h2 class="title">مشاريع الدوام الكامل / الدائمة</h2><div class="grid">${full.map(card).join('')}</div><script>setTimeout(()=>print(),300)<\/script></body></html>`; const w=window.open('','_blank'); if(w){w.document.open(); w.document.write(html); w.document.close();} }
  async function load(){ try{ const res=await fetch(DATA_URL,{cache:'no-store'}); RAW=await res.json(); }catch(e){ console.error('V399 load failed',e); RAW=[]; } render(); }
  function bind(){ ['mt52Refresh','mt52Rebuild','mt52Print','mt52Csv'].forEach(id=>{const b=$(id); if(b && b.dataset.v399!=='1'){b.dataset.v399='1'; b.addEventListener('click',e=>{ if(id==='mt52Print'){printReport(e);} else {e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation)e.stopImmediatePropagation(); render();} },true); }}); document.querySelectorAll('button').forEach(b=>{const t=(b.textContent||'').trim(); if(/طباعة التقرير|طباعة الأوقات الشهرية/.test(t)&&b.dataset.v399!=='1'){b.dataset.v399='1'; b.addEventListener('click',printReport,true);}}); }
  window.tasneefMonthlyV399={load,render,print:printReport,rows};
  document.addEventListener('DOMContentLoaded',()=>{bind(); load();});
  [300,900,1700,3000,5000,8000].forEach(t=>setTimeout(()=>{bind(); render();},t));
  setInterval(()=>{bind(); setBadge(); const txt=(($('mt52Summary')||{}).textContent||'')+(($('mt52VisitGrid')||{}).textContent||''); if(/2026-07|0 دقيقة|V390/.test(txt)) render();},700);
})();

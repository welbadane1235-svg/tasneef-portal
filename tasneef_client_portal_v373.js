/* V373 - بوابة العملاء الجديدة من الصفر: تقرير العميل + التسجيلات اليومية + تذاكر المشروع + فلاتر + تقييم */
(function(){
  'use strict';
  const $ = (id)=>document.getElementById(id);
  const q = (s,root=document)=>root.querySelector(s);
  const esc = (v)=>String(v ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const today = ()=>new Date().toISOString().slice(0,10);
  const monthStart = ()=>{ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01'; };
  const dateOnly = (v)=>String(v||'').slice(0,10);
  const inRange = (date,from,to)=>{ const d=dateOnly(date); return (!from || d>=from) && (!to || d<=to); };
  const minutesBetween = (a,b)=>{ if(!a||!b) return 0; const m=Math.round((new Date(b)-new Date(a))/60000); return isFinite(m)&&m>0?m:0; };
  const minTxt = (m)=>{ m=Number(m)||0; const h=Math.floor(m/60), r=m%60; return h?`${h} س ${r} د`:`${r} د`; };
  const fmt = (v)=>{ try{return v?new Date(v).toLocaleString('ar-SA',{year:'numeric',month:'2-digit',day:'2-digit',hour:'numeric',minute:'2-digit'}):'-';}catch(e){return v||'-';} };
  const statusLabel = (s)=>({open:'مفتوحة',processing:'قيد التنفيذ',in_progress:'قيد التنفيذ',closed:'مغلقة',pending:'معلقة',reopened:'معاد فتحها'}[String(s||'open')]||s||'مفتوحة');
  const statusClass = (s)=>String(s||'open')==='closed'?'green':(String(s||'')==='processing'||String(s||'')==='in_progress'?'amber':'red');
  const projectName = (id)=> (window.data?.projects||[]).find(p=>String(p.id)===String(id))?.name || '-';
  const supervisorName = (id)=> (window.data?.users||[]).find(u=>String(u.id)===String(id))?.full_name || '-';
  const reportTitle = (r)=> r?.title || r?.report_title || r?.report_no || 'تقرير مشروع';
  const ticketNo = (t)=> t?.ticket_number || t?.ticket_no || (t?.id?('T-'+String(t.id).padStart(4,'0')):'-');
  const imgArr = (v)=>{ if(!v) return []; if(Array.isArray(v)) return v; try{ const x=JSON.parse(v); return Array.isArray(x)?x:[]; }catch(e){ return []; } };
  const srcOf = (x)=> typeof x==='string'?x:(x?.url||x?.data||x?.src||'');
  let state = { projectId:'', from:'', to:'', logs:[], tickets:[], reports:[], services:[], ratings:[] };

  function injectStyle(){
    if($('clientPortalV373Style')) return;
    const st=document.createElement('style'); st.id='clientPortalV373Style'; st.textContent = `
      .cp-v373-hero{background:linear-gradient(135deg,#073e31,#0b684f);color:#fff;border-radius:26px;padding:22px;margin-bottom:16px;display:flex;justify-content:space-between;gap:14px;align-items:center;box-shadow:0 18px 40px rgba(10,64,51,.16)}
      .cp-v373-hero h2{margin:0 0 8px;color:#fff}.cp-v373-hero p{margin:0;color:#e1fff3;line-height:1.8}.cp-v373-filters{display:grid;grid-template-columns:2fr 1fr 1fr auto auto;gap:10px;align-items:end}.cp-v373-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin:14px 0}.cp-v373-kpi{background:#fff;border:1px solid var(--line);border-radius:18px;padding:14px;box-shadow:0 8px 24px rgba(10,64,51,.05)}.cp-v373-kpi small{color:var(--muted);display:block}.cp-v373-kpi b{display:block;margin-top:6px;color:var(--brand);font-size:24px}.cp-v373-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.cp-v373-card{background:#fbfdfc;border:1px solid var(--line);border-radius:18px;padding:14px}.cp-v373-card h3{margin:0 0 8px;color:var(--brand)}.cp-v373-preview{border:1px solid #cfe2dc;border-radius:22px;overflow:hidden;background:#fff}.cp-v373-preview-head{background:linear-gradient(135deg,#073e31,#0b684f);color:#fff;padding:18px}.cp-v373-preview-head h3{margin:0;color:#fff}.cp-v373-preview-body{padding:16px}.cp-v373-link{direction:ltr;text-align:left;background:#f5faf8;border:1px dashed #bfd7ce;border-radius:14px;padding:10px;color:#31544a;word-break:break-all}.cp-v373-stars{font-size:18px;color:#b88b35;font-weight:900}.cp-v373-empty{border:1px dashed #bfd7ce;border-radius:16px;padding:18px;text-align:center;color:#60706a;background:#fbfdfc}.cp-v373-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.cp-v373-tabs button{box-shadow:none}.cp-v373-tabs button.active{background:#073e31;color:white}.cp-v373-table td{white-space:normal}.cp-v373-badge{display:inline-block;padding:5px 9px;border-radius:999px;background:#eef6f3;color:#0A4033;font-size:12px;font-weight:800}.cp-v373-badge.red{background:#fde8e8;color:#9d2222}.cp-v373-badge.green{background:#e4f5ea;color:#137a4b}.cp-v373-badge.amber{background:#fff4d6;color:#8a5c00}.cp-v373-badge.blue{background:#eaf2fb;color:#1d6097}
      @media(max-width:1100px){.cp-v373-filters,.cp-v373-kpis,.cp-v373-grid{grid-template-columns:1fr}.cp-v373-hero{display:block}}
    `; document.head.appendChild(st);
  }

  function injectSection(){
    injectStyle();
    const side=q('.side');
    if(side && !$('clientPortalNavV373')){
      const btn=document.createElement('button');
      btn.className='nav'; btn.id='clientPortalNavV373'; btn.dataset.page='clientPortalV373';
      btn.textContent='بوابة العملاء';
      btn.onclick=function(){ if(window.showPage) window.showPage('clientPortalV373', this); setTimeout(window.renderClientPortalV373,50); return false; };
      const logout=q('.side .nav.danger'); side.insertBefore(btn, logout || null);
    }
    const main=q('main.content');
    if(main && !$('clientPortalV373')){
      const sec=document.createElement('section'); sec.id='clientPortalV373'; sec.className='page hidden';
      sec.innerHTML = `
        <div class="cp-v373-hero">
          <div><h2>بوابة العملاء الجديدة</h2><p>تقرير منظم للعميل يشمل التسجيلات اليومية، الأعمال المنفذة، تذاكر المشروع، فلاتر من يوم إلى يوم، وتقييم احترافي.</p></div>
          <div class="actions"><button onclick="copyClientPortalLinkV373()">نسخ رابط العميل</button><button class="light" onclick="openClientPortalLinkV373()">فتح الرابط</button></div>
        </div>
        <div class="card">
          <h2>إعداد تقرير العميل</h2>
          <div class="cp-v373-filters">
            <div><label>المشروع</label><select id="cpProjectV373" onchange="renderClientPortalV373()"></select></div>
            <div><label>من تاريخ</label><input type="date" id="cpFromV373" onchange="renderClientPortalV373()"></div>
            <div><label>إلى تاريخ</label><input type="date" id="cpToV373" onchange="renderClientPortalV373()"></div>
            <button onclick="loadClientPortalV373(this)">تحديث التقرير</button>
            <button class="light" onclick="resetClientPortalFiltersV373()">الشهر الحالي</button>
          </div>
          <div id="cpLinkBoxV373" class="cp-v373-link" style="margin-top:12px">اختر مشروعًا لإنشاء الرابط.</div>
        </div>
        <div id="cpKpisV373" class="cp-v373-kpis"></div>
        <div class="cp-v373-grid">
          <div class="card"><h2>التسجيلات اليومية</h2><div id="cpLogsBoxV373"></div></div>
          <div class="card"><h2>التذاكر الخاصة بالمشروع</h2><div id="cpTicketsBoxV373"></div></div>
          <div class="card"><h2>التقييم الاحترافي</h2><div id="cpRatingsBoxV373"></div></div>
        </div>
        <div class="card"><h2>الأعمال والتقارير المنفذة</h2><div id="cpReportsBoxV373"></div></div>
        <div class="card"><h2>معاينة صفحة العميل</h2><div id="cpPreviewV373" class="cp-v373-preview"></div></div>`;
      const dash=$('dashboard'); if(dash && dash.parentNode) dash.parentNode.insertBefore(sec, dash.nextSibling); else main.appendChild(sec);
    }
    initFilters();
  }

  function initFilters(){
    const sel=$('cpProjectV373'); if(sel){
      const current=sel.value;
      const projects=window.data?.projects||[];
      sel.innerHTML='<option value="">اختر المشروع</option>'+projects.map(p=>`<option value="${esc(p.id)}">${esc(p.name||'-')}</option>`).join('');
      if(current) sel.value=current;
    }
    if($('cpFromV373') && !$('cpFromV373').value) $('cpFromV373').value=monthStart();
    if($('cpToV373') && !$('cpToV373').value) $('cpToV373').value=today();
  }

  function getFilters(){ return { projectId:$('cpProjectV373')?.value||'', from:$('cpFromV373')?.value||monthStart(), to:$('cpToV373')?.value||today() }; }
  function makeToken(){ const f=getFilters(); if(!f.projectId) return ''; const payload={project_id:String(f.projectId), from:f.from, to:f.to, v:373, ts:Date.now()}; return btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
  function link(){ const token=makeToken(); if(!token) return ''; const base=location.href.replace(/admin\.html.*$/,'client-report.html').replace(/#.*$/,''); return base+'?token='+encodeURIComponent(token); }

  async function queryExtras(projectId, from, to){
    const logsAll=(window.data?.logs||[]).filter(l=>String(l.project_id)===String(projectId) && inRange(l.log_date||l.check_in,from,to));
    const ticketsAll=(window.data?.tickets||[]).filter(t=>String(t.project_id)===String(projectId) && inRange(t.created_at||t.updated_at,from,to));
    let reports=[], services=[], ratings=[];
    try{
      let qr=window.sb.from('client_reports').select('*').eq('project_id', projectId).order('report_date',{ascending:false}).limit(500);
      if(from) qr=qr.gte('report_date',from); if(to) qr=qr.lte('report_date',to);
      const rr=await qr; reports=rr.data||[];
    }catch(e){ reports=[]; }
    const ids=reports.map(r=>r.id).filter(Boolean);
    if(ids.length){
      try{ const sr=await window.sb.from('client_report_services').select('*').in('report_id', ids).order('id',{ascending:true}); services=sr.data||[]; }catch(e){ services=[]; }
    }
    try{
      let rt=window.sb.from('client_service_ratings').select('*').eq('project_id', projectId).order('created_at',{ascending:false}).limit(300);
      if(from) rt=rt.gte('created_at',from+'T00:00:00'); if(to) rt=rt.lte('created_at',to+'T23:59:59');
      const rs=await rt; ratings=rs.data||[];
    }catch(e){ ratings=[]; }
    return {logs:logsAll, tickets:ticketsAll, reports, services, ratings};
  }

  function stats(){
    const minutes=state.logs.reduce((a,l)=>a+(Number(l.duration_minutes)||minutesBetween(l.check_in,l.check_out)),0);
    const days=new Set(state.logs.map(l=>dateOnly(l.log_date||l.check_in)).filter(Boolean)).size;
    const open=state.tickets.filter(t=>String(t.status||'open')!=='closed').length;
    const closed=state.tickets.length-open;
    const ratingNums=state.ratings.map(r=>Number(r.rating_value||r.score||({'ممتاز':5,'جيد جدًا':4,'جيد':3,'يحتاج تحسين':2}[r.rating]||0))).filter(Boolean);
    const avg=ratingNums.length?(ratingNums.reduce((a,b)=>a+b,0)/ratingNums.length).toFixed(1):'-';
    return {minutes,days,open,closed,avg};
  }
  function renderKpis(){ const s=stats(); const items=[['إجمالي ساعات العمل',minTxt(s.minutes)],['أيام الحضور',s.days],['التقارير',state.reports.length],['الأعمال المنفذة',state.services.length],['تذاكر مفتوحة',s.open],['متوسط التقييم',s.avg]]; $('cpKpisV373').innerHTML=items.map(i=>`<div class="cp-v373-kpi"><small>${i[0]}</small><b>${i[1]}</b></div>`).join(''); }
  function renderLogs(){ const rows=state.logs.slice(0,80).map(l=>`<tr><td>${esc(dateOnly(l.log_date||l.check_in))}</td><td>${esc(supervisorName(l.supervisor_id))}</td><td>${esc(fmt(l.check_in))}</td><td>${esc(l.check_out?fmt(l.check_out):'-')}</td><td>${esc(minTxt(Number(l.duration_minutes)||minutesBetween(l.check_in,l.check_out)))}</td></tr>`).join(''); $('cpLogsBoxV373').innerHTML=rows?`<div class="table-wrap"><table class="cp-v373-table"><thead><tr><th>التاريخ</th><th>المشرف</th><th>دخول</th><th>خروج</th><th>المدة</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="cp-v373-empty">لا توجد تسجيلات ضمن الفترة.</div>'; }
  function renderTickets(){ const rows=state.tickets.slice(0,80).map(t=>`<tr><td><b>${esc(ticketNo(t))}</b></td><td>${esc(t.title||'-')}<br><small>${esc(t.description||'')}</small></td><td><span class="cp-v373-badge ${statusClass(t.status)}">${esc(statusLabel(t.status))}</span></td><td>${esc(fmt(t.created_at))}</td><td>${esc(t.closure_note||t.close_note||'-')}</td></tr>`).join(''); $('cpTicketsBoxV373').innerHTML=rows?`<div class="table-wrap"><table class="cp-v373-table"><thead><tr><th>الرقم</th><th>التذكرة</th><th>الحالة</th><th>التاريخ</th><th>الإجراء</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="cp-v373-empty">لا توجد تذاكر ضمن الفترة.</div>'; }
  function renderReports(){
    const html=state.reports.map(r=>{ const ss=state.services.filter(s=>String(s.report_id)===String(r.id)); return `<div class="cp-v373-card"><h3>${esc(reportTitle(r))}</h3><p><span class="cp-v373-badge blue">${esc(dateOnly(r.report_date||r.created_at))}</span> <span class="cp-v373-badge green">${ss.length} أعمال</span></p><p style="color:#60706a;line-height:1.7">${esc(r.executive_summary||'تقرير أعمال منفذة للمشروع.')}</p></div>`; }).join('');
    $('cpReportsBoxV373').innerHTML=html?`<div class="cp-v373-grid">${html}</div>`:'<div class="cp-v373-empty">لا توجد تقارير أعمال ضمن الفترة.</div>';
  }
  function renderRatings(){ const rows=state.ratings.slice(0,50).map(r=>`<tr><td>${esc(fmt(r.created_at))}</td><td><span class="cp-v373-stars">${'★'.repeat(Math.max(1,Math.min(5,Number(r.rating_value||r.score||({'ممتاز':5,'جيد جدًا':4,'جيد':3,'يحتاج تحسين':2}[r.rating]||0))||0)))}</span><br><small>${esc(r.rating||'')}</small></td><td>${esc(r.comment||'-')}</td><td>${r.followup_requested?'نعم':'لا'}</td></tr>`).join(''); $('cpRatingsBoxV373').innerHTML=rows?`<div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>التقييم</th><th>الملاحظة</th><th>متابعة</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="cp-v373-empty">لم يتم تسجيل تقييمات ضمن الفترة.</div>'; }
  function renderPreview(){ const s=stats(); const pn=projectName(state.projectId); $('cpPreviewV373').innerHTML=`<div class="cp-v373-preview-head"><h3>بوابة مشروع ${esc(pn)}</h3><small>من ${esc(state.from)} إلى ${esc(state.to)}</small></div><div class="cp-v373-preview-body"><div class="cp-v373-kpis"><div class="cp-v373-kpi"><small>ساعات العمل</small><b>${minTxt(s.minutes)}</b></div><div class="cp-v373-kpi"><small>الأعمال</small><b>${state.services.length}</b></div><div class="cp-v373-kpi"><small>التذاكر</small><b>${state.tickets.length}</b></div><div class="cp-v373-kpi"><small>التقييم</small><b>${s.avg}</b></div></div><p style="line-height:1.8;color:#60706a">هذه هي الصورة التي ستظهر للعميل في الرابط: تقرير منظم وسهل القراءة، مع فلاتر الفترة المحددة.</p></div>`; }

  window.loadClientPortalV373 = async function(btn){
    try{
      injectSection(); initFilters();
      const f=getFilters(); if(!f.projectId){ renderEmpty(); return; }
      if(btn) { btn.disabled=true; btn.textContent='جاري التحميل...'; }
      state.projectId=f.projectId; state.from=f.from; state.to=f.to;
      const extra=await queryExtras(f.projectId,f.from,f.to); Object.assign(state,extra);
      $('cpLinkBoxV373').textContent=link(); renderKpis(); renderLogs(); renderTickets(); renderReports(); renderRatings(); renderPreview();
    }catch(e){ if(window.msg) window.msg(e.message||String(e),'err'); }
    finally{ if(btn){ btn.disabled=false; btn.textContent='تحديث التقرير'; } }
  };
  function renderEmpty(){ $('cpLinkBoxV373').textContent='اختر مشروعًا لإنشاء رابط العميل.'; ['cpKpisV373','cpLogsBoxV373','cpTicketsBoxV373','cpReportsBoxV373','cpRatingsBoxV373','cpPreviewV373'].forEach(id=>{ if($(id)) $(id).innerHTML='<div class="cp-v373-empty">اختر المشروع والفترة لعرض البيانات.</div>'; }); }
  window.renderClientPortalV373 = function(){ injectSection(); const f=getFilters(); if(!f.projectId){ renderEmpty(); return; } window.loadClientPortalV373(); };
  window.resetClientPortalFiltersV373 = function(){ if($('cpFromV373')) $('cpFromV373').value=monthStart(); if($('cpToV373')) $('cpToV373').value=today(); window.renderClientPortalV373(); };
  window.copyClientPortalLinkV373 = async function(){ const l=link(); if(!l) return window.msg&&window.msg('اختر المشروع أولًا','err'); try{ await navigator.clipboard.writeText(l); }catch(e){} if($('cpLinkBoxV373')) $('cpLinkBoxV373').textContent=l; window.msg&&window.msg('تم نسخ رابط العميل'); };
  window.openClientPortalLinkV373 = function(){ const l=link(); if(!l) return window.msg&&window.msg('اختر المشروع أولًا','err'); window.open(l,'_blank'); };

  function hook(){
    injectSection();
    const oldHydrate=window.hydrateForms; if(typeof oldHydrate==='function' && !oldHydrate.__cp373){ window.hydrateForms=function(){ oldHydrate.apply(this,arguments); injectSection(); initFilters(); }; window.hydrateForms.__cp373=true; }
    const oldRender=window.renderAll; if(typeof oldRender==='function' && !oldRender.__cp373){ window.renderAll=function(){ oldRender.apply(this,arguments); injectSection(); if(!$('clientPortalV373')?.classList.contains('hidden')) window.renderClientPortalV373(); }; window.renderAll.__cp373=true; }
    setTimeout(()=>{injectSection(); initFilters(); renderEmpty();},300);
  }
  if(document.readyState==='complete') hook(); else window.addEventListener('load', hook);
})();

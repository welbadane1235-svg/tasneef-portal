/* V376 - بوابة العملاء: اختصار روابط تلقائي + واتساب باسم الشركة + أعمال سنوية + تقييم آمن */
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
  const daysLeftText = (v)=>{ if(!v) return '-'; const d=new Date(String(v).slice(0,10)+'T23:59:59'); const n=Math.ceil((d-new Date())/86400000); return isFinite(n) ? (n<0?'منتهي':n+' يوم') : '-'; };
  const annualRows = ()=>{ const annual=(state.smart?.annual||[]); return annual.map(a=>{ const visits=Number(a.visits)||0, done=Array.isArray(a.done)?a.done.length:0; return {name:a.name||'-', visits, done, remain:Math.max(0,visits-done), status:done>=visits?'مكتمل':(done>0?'جاري':'لم يبدأ'), notes:a.notes||''}; }); };
  const annualDoneCount = ()=>annualRows().reduce((a,r)=>a+(Number(r.done)||0),0);
  const annualRemainCount = ()=>annualRows().reduce((a,r)=>a+(Number(r.remain)||0),0);
  const currentProject = ()=> (window.data?.projects||[]).find(p=>String(p.id)===String(state.projectId)) || {};
  const fmt = (v)=>{ try{return v?new Date(v).toLocaleString('ar-SA',{year:'numeric',month:'2-digit',day:'2-digit',hour:'numeric',minute:'2-digit'}):'-';}catch(e){return v||'-';} };
  const statusLabel = (s)=>({open:'مفتوحة',processing:'قيد التنفيذ',in_progress:'قيد التنفيذ',closed:'مغلقة',pending:'معلقة',reopened:'معاد فتحها'}[String(s||'open')]||s||'مفتوحة');
  const statusClass = (s)=>String(s||'open')==='closed'?'green':(String(s||'')==='processing'||String(s||'')==='in_progress'?'amber':'red');
  const projectName = (id)=> (window.data?.projects||[]).find(p=>String(p.id)===String(id))?.name || '-';
  const supervisorName = (id)=> (window.data?.users||[]).find(u=>String(u.id)===String(id))?.full_name || '-';
  const reportTitle = (r)=> r?.title || r?.report_title || r?.report_no || 'تقرير مشروع';
  const ticketNo = (t)=> t?.ticket_number || t?.ticket_no || (t?.id?('T-'+String(t.id).padStart(4,'0')):'-');
  const imgArr = (v)=>{ if(!v) return []; if(Array.isArray(v)) return v; try{ const x=JSON.parse(v); return Array.isArray(x)?x:[]; }catch(e){ return []; } };
  const srcOf = (x)=> typeof x==='string'?x:(x?.url||x?.data||x?.src||'');
  let state = { projectId:'', from:'', to:'', logs:[], tickets:[], reports:[], services:[], ratings:[], smart:null };

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
          <div id="cpLinkBoxV373" class="cp-v373-link" style="margin-top:12px">اختر مشروعًا لإنشاء الرابط.</div><div class="actions" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" onclick="createShortClientPortalLinkV376()">إنشاء اختصار تلقائي</button><button type="button" onclick="copyClientPortalLinkV373()">نسخ المختصر</button><button type="button" class="light" onclick="openClientPortalLinkV373()">فتح الرابط</button><button type="button" class="light" onclick="sendClientPortalWhatsappV373()">إرسال واتساب</button></div>
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
  function makeToken(){ const f=getFilters(); if(!f.projectId) return ''; const payload={project_id:String(f.projectId), from:f.from, to:f.to, v:376, ts:Date.now()}; return btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
  function link(){ const token=makeToken(); if(!token) return ''; const base=location.href.replace(/admin\.html.*$/,'client-report.html').replace(/#.*$/,''); return base+'?token='+encodeURIComponent(token); }

  function simpleHash(str){
    let h=2166136261;
    for(let i=0;i<String(str).length;i++){ h^=String(str).charCodeAt(i); h+=(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24); }
    return (h>>>0).toString(36);
  }
  function transliterateProjectNameV377(name){
    let s=String(name||'').trim().toLowerCase();
    const map=[
      [/شركة/g,''], [/مشروع/g,''], [/جمعية/g,''],
      [/الماجدية|ماجدية/g,'majdia'], [/الرمز|رمز/g,'ramz'], [/فرساي/g,'versai'],
      [/العجلان|عجلان/g,'ajlan'], [/صفا|صفاء/g,'safa'], [/تعمير/g,'tameer'],
      [/مغنى|مغني/g,'maghna'], [/هاجر/g,'hajar'], [/جادة/g,'jada'], [/كاف/g,'kaf'],
      [/واجهة/g,'wajha'], [/قرطبة/g,'qurtuba'], [/الين|ألين|ايلين/g,'alen'],
      [/جوديا/g,'jodia'], [/الياسمين/g,'yasmin'], [/آفاق|افاق/g,'afaq'],
      [/الرؤيا|رؤيا/g,'roya'], [/رايات/g,'rayat'], [/نجد/g,'najd'],
      [/الشعلان/g,'shalan'], [/اتحاد/g,'etihad'], [/العاصمة/g,'capital']
    ];
    map.forEach(([re,val])=>{ s=s.replace(re,val); });
    s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    s=s.replace(/[^a-z0-9]+/g,'-').replace(/-+/g,'-').replace(/^-+|-+$/g,'');
    return s || 'project';
  }
  function projectSlug(){
    const pn=(projectName(getFilters().projectId)||'project').toString().trim();
    return transliterateProjectNameV377(pn).slice(0,22) || 'project';
  }
  function shortCacheKey(longUrl){ return 'tasneef_short_url_v377_'+simpleHash(longUrl); }
  function shortAliasCandidatesV377(longUrl){
    const slug=projectSlug().replace(/[^a-z0-9-]/g,'').replace(/^-+|-+$/g,'') || 'project';
    const h=simpleHash(longUrl).slice(0,5);
    const compact=slug.replace(/-/g,'').slice(0,18) || 'project';
    const dashed=slug.slice(0,18) || 'project';
    // كل الأسماء تبدأ بـ tasneef، وإذا كان الاسم مستخدمًا نجرب بدائل تلقائية.
    return [
      `tasneef-${dashed}-${h}`,
      `tasneef-${dashed}`,
      `tasneef${compact}${h}`,
      `tasneef${h}`
    ];
  }
  async function shortenUrlV376(longUrl, force){
    if(!longUrl) return '';
    const key=shortCacheKey(longUrl);
    if(!force){
      const cached=localStorage.getItem(key);
      if(cached && /^https?:\/\//.test(cached)) return cached;
    }
    const aliases=shortAliasCandidatesV377(longUrl);
    const services=[];
    aliases.forEach(alias=>{
      services.push('https://is.gd/create.php?format=simple&shorturl='+encodeURIComponent(alias)+'&url='+encodeURIComponent(longUrl));
    });
    services.push('https://is.gd/create.php?format=simple&url='+encodeURIComponent(longUrl));
    services.push('https://tinyurl.com/api-create.php?url='+encodeURIComponent(longUrl));
    let lastErr='';
    for(const u of services){
      try{
        const r=await fetch(u,{method:'GET',cache:'no-store'});
        const txt=(await r.text()).trim();
        if(r.ok && /^https?:\/\//.test(txt) && !/error|invalid/i.test(txt)){
          localStorage.setItem(key,txt);
          return txt;
        }
        lastErr=txt || r.statusText || 'فشل الاختصار';
      }catch(e){ lastErr=e.message||String(e); }
    }
    throw new Error('تعذر إنشاء الرابط المختصر الآن. سيتم استخدام الرابط الأصلي. '+lastErr);
  }
  function renderLinkBoxV376(longUrl, shortUrl, loading){
    const box=$('cpLinkBoxV373'); if(!box) return;
    if(!longUrl){ box.textContent='اختر مشروعًا لإنشاء الرابط.'; return; }
    const suggested=shortAliasCandidatesV377(longUrl)[0] || 'tasneef-project';
    box.innerHTML=`<div style="direction:rtl;text-align:right;font-weight:800;color:#073e31;margin-bottom:6px">بوابة شركة تصنيف لإدارة المرافق</div>
      <div style="direction:ltr;text-align:left;word-break:break-all"><small style="color:#60706a">الرابط المختصر:</small><br><b>${esc(loading?'جاري إنشاء الرابط المختصر يبدأ باسم tasneef...':(shortUrl||'لم يتم إنشاؤه بعد'))}</b></div>
      <div style="direction:ltr;text-align:left;word-break:break-all;margin-top:8px"><small style="color:#60706a">الاسم المقترح:</small><br>${esc(suggested)}</div>
      <div style="direction:ltr;text-align:left;word-break:break-all;margin-top:8px"><small style="color:#60706a">الرابط الأصلي:</small><br>${esc(longUrl)}</div>`;
  }

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
    let smart={annual:[]};
    try{ const sm=await window.sb.from('project_contract_smart').select('*').eq('project_id', projectId).maybeSingle(); smart=(sm.data&&sm.data.payload)||{annual:[]}; }catch(e){ smart={annual:[]}; }
    return {logs:logsAll, tickets:ticketsAll, reports, services, ratings, smart};
  }

  function stats(){
    const minutes=state.logs.reduce((a,l)=>a+(Number(l.duration_minutes)||minutesBetween(l.check_in,l.check_out)),0);
    const days=new Set(state.logs.map(l=>dateOnly(l.log_date||l.check_in)).filter(Boolean)).size;
    const open=state.tickets.filter(t=>String(t.status||'open')!=='closed').length;
    const closed=state.tickets.length-open;
    const ratingNums=state.ratings.map(r=>Number(r.score||({'ممتاز':5,'جيد جدًا':4,'جيد':3,'يحتاج تحسين':2}[r.rating]||0))).filter(Boolean);
    const avg=ratingNums.length?(ratingNums.reduce((a,b)=>a+b,0)/ratingNums.length).toFixed(1):'-';
    return {minutes,days,open,closed,avg,annualDone:annualDoneCount(),annualRemain:annualRemainCount(),contractLeft:daysLeftText(currentProject().contract_end||currentProject().end_date)};
  }
  function renderKpis(){ const s=stats(); const items=[['إجمالي ساعات العمل',minTxt(s.minutes)],['أيام الحضور',s.days],['المتبقي على العقد',s.contractLeft],['الأعمال السنوية المنفذة',s.annualDone],['تذاكر مفتوحة',s.open],['متوسط التقييم',s.avg]]; $('cpKpisV373').innerHTML=items.map(i=>`<div class="cp-v373-kpi"><small>${i[0]}</small><b>${i[1]}</b></div>`).join(''); }
  function renderLogs(){ const rows=state.logs.slice(0,80).map(l=>`<tr><td>${esc(dateOnly(l.log_date||l.check_in))}</td><td>${esc(supervisorName(l.supervisor_id))}</td><td>${esc(fmt(l.check_in))}</td><td>${esc(l.check_out?fmt(l.check_out):'-')}</td><td>${esc(minTxt(Number(l.duration_minutes)||minutesBetween(l.check_in,l.check_out)))}</td></tr>`).join(''); $('cpLogsBoxV373').innerHTML=rows?`<div class="table-wrap"><table class="cp-v373-table"><thead><tr><th>التاريخ</th><th>المشرف</th><th>دخول</th><th>خروج</th><th>المدة</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="cp-v373-empty">لا توجد تسجيلات ضمن الفترة.</div>'; }
  function renderTickets(){ const rows=state.tickets.slice(0,80).map(t=>`<tr><td><b>${esc(ticketNo(t))}</b></td><td>${esc(t.title||'-')}<br><small>${esc(t.description||'')}</small></td><td><span class="cp-v373-badge ${statusClass(t.status)}">${esc(statusLabel(t.status))}</span></td><td>${esc(fmt(t.created_at))}</td><td>${esc(t.closure_note||t.close_note||'-')}</td></tr>`).join(''); $('cpTicketsBoxV373').innerHTML=rows?`<div class="table-wrap"><table class="cp-v373-table"><thead><tr><th>الرقم</th><th>التذكرة</th><th>الحالة</th><th>التاريخ</th><th>الإجراء</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="cp-v373-empty">لا توجد تذاكر ضمن الفترة.</div>'; }
  function renderReports(){
    const annual=annualRows();
    const annualHtml=annual.length?`<div class="table-wrap"><table class="cp-v373-table"><thead><tr><th>الخدمة السنوية</th><th>عدد الزيارات</th><th>المنفذ</th><th>المتبقي</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>${annual.map(r=>`<tr><td><b>${esc(r.name)}</b></td><td>${r.visits}</td><td><span class="cp-v373-badge green">${r.done}</span></td><td><span class="cp-v373-badge amber">${r.remain}</span></td><td>${esc(r.status)}</td><td>${esc(r.notes||'-')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="cp-v373-empty">لا توجد أعمال سنوية مسجلة لهذا المشروع في بيانات العقد.</div>';
    const photos=state.reports.map(r=>{ const ss=state.services.filter(s=>String(s.report_id)===String(r.id)); return `<div class="cp-v373-card"><h3>${esc(reportTitle(r))}</h3><p><span class="cp-v373-badge blue">${esc(dateOnly(r.report_date||r.created_at))}</span> <span class="cp-v373-badge green">${ss.length} أعمال مصورة</span></p><p style="color:#60706a;line-height:1.7">${esc(r.executive_summary||'تقرير أعمال مصورة للمشروع.')}</p></div>`; }).join('');
    $('cpReportsBoxV373').innerHTML=`<h3 style="color:var(--brand);margin:0 0 10px">الأعمال السنوية من العقد</h3>${annualHtml}<h3 style="color:var(--brand);margin:18px 0 10px">التقارير المصورة</h3>${photos?`<div class="cp-v373-grid">${photos}</div>`:'<div class="cp-v373-empty">لا توجد تقارير مصورة ضمن الفترة.</div>'}`;
  }
  function renderRatings(){ const rows=state.ratings.slice(0,50).map(r=>`<tr><td>${esc(fmt(r.created_at))}</td><td><span class="cp-v373-stars">${'★'.repeat(Math.max(1,Math.min(5,Number(r.rating_value||r.score||({'ممتاز':5,'جيد جدًا':4,'جيد':3,'يحتاج تحسين':2}[r.rating]||0))||0)))}</span><br><small>${esc(r.rating||'')}</small></td><td>${esc(r.comment||'-')}</td><td>${r.followup_requested?'نعم':'لا'}</td></tr>`).join(''); $('cpRatingsBoxV373').innerHTML=rows?`<div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>التقييم</th><th>الملاحظة</th><th>متابعة</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="cp-v373-empty">لم يتم تسجيل تقييمات ضمن الفترة.</div>'; }
  function renderPreview(){ const s=stats(); const pn=projectName(state.projectId); $('cpPreviewV373').innerHTML=`<div class="cp-v373-preview-head"><h3>بوابة مشروع ${esc(pn)}</h3><small>من ${esc(state.from)} إلى ${esc(state.to)}</small></div><div class="cp-v373-preview-body"><div class="cp-v373-kpis"><div class="cp-v373-kpi"><small>ساعات العمل</small><b>${minTxt(s.minutes)}</b></div><div class="cp-v373-kpi"><small>الأعمال السنوية المنفذة</small><b>${s.annualDone}</b></div><div class="cp-v373-kpi"><small>المتبقي على العقد</small><b>${esc(s.contractLeft)}</b></div><div class="cp-v373-kpi"><small>التذاكر</small><b>${state.tickets.length}</b></div></div><p style="line-height:1.8;color:#60706a">هذه هي الصورة التي ستظهر للعميل في الرابط: تقرير منظم وسهل القراءة، مع فلاتر الفترة المحددة.</p></div>`; }

  window.loadClientPortalV373 = async function(btn){
    try{
      injectSection(); initFilters();
      const f=getFilters(); if(!f.projectId){ renderEmpty(); return; }
      if(btn) { btn.disabled=true; btn.textContent='جاري التحميل...'; }
      state.projectId=f.projectId; state.from=f.from; state.to=f.to;
      const extra=await queryExtras(f.projectId,f.from,f.to); Object.assign(state,extra);
      renderLinkBoxV376(link(), localStorage.getItem(shortCacheKey(link()))); renderKpis(); renderLogs(); renderTickets(); renderReports(); renderRatings(); renderPreview();
    }catch(e){ if(window.msg) window.msg(e.message||String(e),'err'); }
    finally{ if(btn){ btn.disabled=false; btn.textContent='تحديث التقرير'; } }
  };
  function renderEmpty(){ $('cpLinkBoxV373').textContent='اختر مشروعًا لإنشاء رابط العميل.'; ['cpKpisV373','cpLogsBoxV373','cpTicketsBoxV373','cpReportsBoxV373','cpRatingsBoxV373','cpPreviewV373'].forEach(id=>{ if($(id)) $(id).innerHTML='<div class="cp-v373-empty">اختر المشروع والفترة لعرض البيانات.</div>'; }); }
  window.renderClientPortalV373 = function(){ injectSection(); const f=getFilters(); if(!f.projectId){ renderEmpty(); return; } window.loadClientPortalV373(); };
  window.resetClientPortalFiltersV373 = function(){ if($('cpFromV373')) $('cpFromV373').value=monthStart(); if($('cpToV373')) $('cpToV373').value=today(); window.renderClientPortalV373(); };
  window.createShortClientPortalLinkV376 = async function(force){
    const l=link(); if(!l) return window.msg&&window.msg('اختر المشروع أولًا','err');
    renderLinkBoxV376(l,'',true);
    try{
      const shortUrl=await shortenUrlV376(l, !!force);
      renderLinkBoxV376(l, shortUrl, false);
      window.msg&&window.msg('تم إنشاء الرابط المختصر');
      return shortUrl;
    }catch(e){
      renderLinkBoxV376(l, localStorage.getItem(shortCacheKey(l)) || '', false);
      window.msg&&window.msg(e.message||String(e),'err');
      return l;
    }
  };
  window.copyClientPortalLinkV373 = async function(){
    const l=link(); if(!l) return window.msg&&window.msg('اختر المشروع أولًا','err');
    let finalUrl=localStorage.getItem(shortCacheKey(l));
    if(!finalUrl) finalUrl=await window.createShortClientPortalLinkV376(false);
    try{ await navigator.clipboard.writeText(finalUrl||l); }catch(e){}
    renderLinkBoxV376(l, finalUrl, false);
    window.msg&&window.msg(finalUrl && finalUrl!==l ? 'تم نسخ الرابط المختصر' : 'تم نسخ الرابط الأصلي');
  };
  window.openClientPortalLinkV373 = function(){ const l=link(); if(!l) return window.msg&&window.msg('اختر المشروع أولًا','err'); window.open(l,'_blank'); };
  window.sendClientPortalWhatsappV373 = async function(){
    const l=link(); if(!l) return window.msg&&window.msg('اختر المشروع أولًا','err');
    let finalUrl=localStorage.getItem(shortCacheKey(l));
    if(!finalUrl) finalUrl=await window.createShortClientPortalLinkV376(false);
    finalUrl=finalUrl||l;
    const txt=`السيد رئيس الجمعية المحترم،

يسر شركة تصنيف لإدارة المرافق تزويدكم برابط بوابة مشروعكم للاطلاع على التقرير والتسجيلات اليومية والتذاكر والأعمال السنوية خلال الفترة المحددة.

بوابة شركة تصنيف لإدارة المرافق:
${finalUrl}

وتقبلوا تحياتنا،
شركة تصنيف لإدارة المرافق`;
    window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
  };

  function hook(){
    injectSection();
    const oldHydrate=window.hydrateForms; if(typeof oldHydrate==='function' && !oldHydrate.__cp373){ window.hydrateForms=function(){ oldHydrate.apply(this,arguments); injectSection(); initFilters(); }; window.hydrateForms.__cp373=true; }
    const oldRender=window.renderAll; if(typeof oldRender==='function' && !oldRender.__cp373){ window.renderAll=function(){ oldRender.apply(this,arguments); injectSection(); if(!$('clientPortalV373')?.classList.contains('hidden')) window.renderClientPortalV373(); }; window.renderAll.__cp373=true; }
    setTimeout(()=>{injectSection(); initFilters(); renderEmpty();},300);
  }
  if(document.readyState==='complete') hook(); else window.addEventListener('load', hook);
})();


/* V449 - تثبيت رابط العميل داخل قاعدة البيانات وعدم الاعتماد على الكاش */
(function(){
  'use strict';
  if(window.__tasneefClientPortalPersistentV449) return;
  window.__tasneefClientPortalPersistentV449 = true;
  const $ = (id)=>document.getElementById(id);
  const esc = (v)=>String(v ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const msg = (t,bad)=>{ try{ if(typeof window.msg==='function') window.msg(t,bad?'err':'ok'); }catch(_){} };
  const pid = ()=>String($('cpProjectV373')?.value || '').trim();
  const baseUrl = ()=>{
    const href = location.href.split('#')[0].split('?')[0];
    if(/admin\.html$/i.test(href)) return href.replace(/admin\.html$/i,'client-report.html');
    return href.replace(/[^\/]*$/,'client-report.html');
  };
  const stableUrl = (projectId=pid())=> projectId ? (baseUrl()+'?project_id='+encodeURIComponent(projectId)) : '';
  function projectRow(projectId=pid()){
    return (window.data?.projects||[]).find(p=>String(p.id)===String(projectId)) || null;
  }
  function setProjectRowFields(projectId, fields){
    const p=projectRow(projectId); if(p) Object.assign(p, fields||{});
  }
  function tokenFor(projectId){
    try{ return btoa(unescape(encodeURIComponent(JSON.stringify({project_id:String(projectId), stable:true, v:449})))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
    catch(_){ return 'project_'+String(projectId); }
  }
  function renderPersistentLink(longUrl, shortUrl, saved){
    const box=$('cpLinkBoxV373'); if(!box) return;
    if(!longUrl){ box.textContent='اختر مشروعًا لإنشاء الرابط.'; return; }
    box.innerHTML = `<div style="direction:rtl;text-align:right;font-weight:900;color:#073e31;margin-bottom:6px">رابط العميل الثابت محفوظ في السيرفر</div>
      <div style="direction:ltr;text-align:left;word-break:break-all"><small style="color:#60706a">الرابط المستخدم:</small><br><b>${esc(shortUrl || longUrl)}</b></div>
      ${shortUrl?`<div style="direction:ltr;text-align:left;word-break:break-all;margin-top:8px"><small style="color:#60706a">الرابط الأصلي الثابت:</small><br>${esc(longUrl)}</div>`:''}
      <div style="direction:rtl;text-align:right;margin-top:8px;color:${saved?'#137a4b':'#9a6b00'};font-weight:800">${saved?'محفوظ ولن يختفي بعد التحديث.':'يظهر الآن كرابط ثابت، وشغّل SQL V449 ليتم حفظه في السيرفر.'}</div>`;
  }
  async function saveProjectLink(projectId=pid(), extra={}){
    if(!projectId) return '';
    const p=projectRow(projectId) || {};
    const longUrl = p.client_portal_url || stableUrl(projectId);
    const payload = {
      client_portal_token: p.client_portal_token || tokenFor(projectId),
      client_portal_url: longUrl,
      client_portal_updated_at: new Date().toISOString(),
      ...extra
    };
    if(!payload.client_portal_short_url && p.client_portal_short_url) payload.client_portal_short_url = p.client_portal_short_url;
    setProjectRowFields(projectId, payload);
    if(window.sb){
      const r=await window.sb.from('projects').update(payload).eq('id', projectId);
      if(r.error){ console.warn('V449 project link save skipped:', r.error.message); return longUrl; }
    }
    return longUrl;
  }
  async function ensureAndRender(){
    const projectId=pid();
    if(!projectId){ renderPersistentLink('', '', false); return ''; }
    const p=projectRow(projectId) || {};
    const longUrl = p.client_portal_url || stableUrl(projectId);
    const shortUrl = p.client_portal_short_url || '';
    let saved=!!p.client_portal_url;
    renderPersistentLink(longUrl, shortUrl, saved);
    if(!saved){
      try{ await saveProjectLink(projectId); saved=true; }catch(e){ console.warn(e); }
      const pp=projectRow(projectId)||{};
      renderPersistentLink(pp.client_portal_url||longUrl, pp.client_portal_short_url||shortUrl, saved);
    }
    return (projectRow(projectId)?.client_portal_short_url || projectRow(projectId)?.client_portal_url || longUrl);
  }
  function shortAlias(projectId=pid()){
    const name=(projectRow(projectId)?.name || 'project').toString().trim().toLowerCase()
      .replace(/[إأآا]/g,'a').replace(/[ىىي]/g,'y').replace(/[^a-z0-9]+/g,'-').replace(/-+/g,'-').replace(/^-+|-+$/g,'').slice(0,20) || 'project';
    return 'tasneef-'+name+'-'+String(projectId).replace(/\D/g,'').slice(-4);
  }
  async function createShort(longUrl, projectId=pid()){
    const alias=shortAlias(projectId);
    const tries=[
      'https://is.gd/create.php?format=simple&shorturl='+encodeURIComponent(alias)+'&url='+encodeURIComponent(longUrl),
      'https://is.gd/create.php?format=simple&url='+encodeURIComponent(longUrl),
      'https://tinyurl.com/api-create.php?url='+encodeURIComponent(longUrl)
    ];
    for(const u of tries){
      try{
        const r=await fetch(u,{cache:'no-store'}); const txt=(await r.text()).trim();
        if(r.ok && /^https?:\/\//.test(txt) && !/error|invalid/i.test(txt)) return txt;
      }catch(e){ console.warn(e); }
    }
    return longUrl;
  }
  const oldLoad=window.loadClientPortalV373;
  if(typeof oldLoad==='function'){
    window.loadClientPortalV373 = async function(btn){
      const res = await oldLoad.apply(this, arguments);
      setTimeout(ensureAndRender, 50);
      return res;
    };
  }
  const oldRender=window.renderClientPortalV373;
  if(typeof oldRender==='function'){
    window.renderClientPortalV373 = function(){
      const res = oldRender.apply(this, arguments);
      setTimeout(ensureAndRender, 120);
      return res;
    };
  }
  window.createShortClientPortalLinkV376 = async function(){
    const projectId=pid(); if(!projectId) return msg('اختر المشروع أولًا', true);
    const longUrl = await saveProjectLink(projectId);
    renderPersistentLink(longUrl, 'جاري إنشاء الرابط المختصر...', true);
    const shortUrl = await createShort(longUrl, projectId);
    await saveProjectLink(projectId, {client_portal_short_url: shortUrl});
    renderPersistentLink(longUrl, shortUrl, true);
    msg(shortUrl && shortUrl!==longUrl ? 'تم إنشاء وحفظ الرابط المختصر' : 'تم حفظ الرابط الأصلي الثابت');
    return shortUrl || longUrl;
  };
  window.copyClientPortalLinkV373 = async function(){
    const projectId=pid(); if(!projectId) return msg('اختر المشروع أولًا', true);
    await ensureAndRender();
    const p=projectRow(projectId)||{};
    const finalUrl=p.client_portal_short_url || p.client_portal_url || stableUrl(projectId);
    try{ await navigator.clipboard.writeText(finalUrl); }catch(_){}
    renderPersistentLink(p.client_portal_url||stableUrl(projectId), p.client_portal_short_url||'', !!p.client_portal_url);
    msg('تم نسخ رابط العميل الثابت');
  };
  window.openClientPortalLinkV373 = async function(){
    const projectId=pid(); if(!projectId) return msg('اختر المشروع أولًا', true);
    await ensureAndRender();
    const p=projectRow(projectId)||{};
    window.open(p.client_portal_short_url || p.client_portal_url || stableUrl(projectId), '_blank');
  };
  window.sendClientPortalWhatsappV373 = async function(){
    const projectId=pid(); if(!projectId) return msg('اختر المشروع أولًا', true);
    await ensureAndRender();
    const p=projectRow(projectId)||{};
    const finalUrl=p.client_portal_short_url || p.client_portal_url || stableUrl(projectId);
    const txt=`السيد رئيس الجمعية المحترم،\n\nيسر شركة تصنيف لإدارة المرافق تزويدكم برابط بوابة مشروعكم للاطلاع على التقرير والتسجيلات اليومية والتذاكر والأعمال السنوية.\n\nرابط بوابة العميل:\n${finalUrl}\n\nوتقبلوا تحياتنا،\nشركة تصنيف لإدارة المرافق`;
    window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
  };
  document.addEventListener('change', e=>{ if(e.target && e.target.id==='cpProjectV373') setTimeout(ensureAndRender, 80); });
  setTimeout(ensureAndRender, 900);
})();


/* V471 - رابط داخلي مختصر دائم بدون TinyURL */
(function(){
  'use strict';
  if(window.__tasneefClientShortInternalV471) return;
  window.__tasneefClientShortInternalV471 = true;
  const $=(id)=>document.getElementById(id);
  const esc=(v)=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const msg=(t,bad)=>{try{ if(typeof window.msg==='function') window.msg(t,bad?'err':'ok'); }catch(_){}};
  const pid=()=>String($('cpProjectV373')?.value||'').trim();
  function projectRow(projectId=pid()){return (window.data?.projects||[]).find(p=>String(p.id)===String(projectId))||null;}
  function baseShort(){
    const href=location.href.split('#')[0].split('?')[0];
    if(/admin\.html$/i.test(href)) return href.replace(/admin\.html$/i,'c.html');
    return href.replace(/[^\/]*$/,'c.html');
  }
  function baseLong(){
    const href=location.href.split('#')[0].split('?')[0];
    if(/admin\.html$/i.test(href)) return href.replace(/admin\.html$/i,'client-report.html');
    return href.replace(/[^\/]*$/,'client-report.html');
  }
  function internalShortUrl(projectId=pid()){
    return projectId ? (baseShort()+'?p='+encodeURIComponent(projectId)) : '';
  }
  function internalLongUrl(projectId=pid()){
    return projectId ? (baseLong()+'?project_id='+encodeURIComponent(projectId)) : '';
  }
  function renderBox(){
    const projectId=pid(); const box=$('cpLinkBoxV373'); if(!box) return '';
    if(!projectId){box.textContent='اختر مشروعًا لإنشاء الرابط.'; return '';}
    const shortUrl=internalShortUrl(projectId), longUrl=internalLongUrl(projectId);
    box.innerHTML=`<div style="direction:rtl;text-align:right;font-weight:900;color:#073e31;margin-bottom:6px">رابط عميل مختصر داخلي ودائم</div>
    <div style="direction:ltr;text-align:left;word-break:break-all"><small style="color:#60706a">الرابط المختصر:</small><br><b>${esc(shortUrl)}</b></div>
    <div style="direction:ltr;text-align:left;word-break:break-all;margin-top:8px"><small style="color:#60706a">الرابط الطويل الاحتياطي:</small><br>${esc(longUrl)}</div>
    <div style="direction:rtl;text-align:right;margin-top:8px;color:#137a4b;font-weight:800">هذا الرابط لا يعتمد على TinyURL، ويظل يعمل طالما الموقع وقاعدة البيانات شغالة.</div>`;
    return shortUrl;
  }
  async function saveShort(projectId=pid()){
    if(!projectId) return '';
    const p=projectRow(projectId)||{};
    const payload={
      client_portal_url: internalLongUrl(projectId),
      client_portal_short_url: internalShortUrl(projectId),
      client_portal_updated_at: new Date().toISOString()
    };
    Object.assign(p,payload);
    if(window.sb){try{await window.sb.from('projects').update(payload).eq('id', projectId);}catch(e){console.warn('V471 save short skipped',e);}}
    return payload.client_portal_short_url;
  }
  window.createShortClientPortalLinkV376 = async function(){
    const projectId=pid(); if(!projectId){msg('اختر المشروع أولًا',true); return '';}
    const u=await saveShort(projectId); renderBox(); msg('تم إنشاء الرابط المختصر الداخلي'); return u;
  };
  window.copyClientPortalLinkV373 = async function(){
    const projectId=pid(); if(!projectId){msg('اختر المشروع أولًا',true); return;}
    const u=await saveShort(projectId); renderBox(); try{await navigator.clipboard.writeText(u);}catch(_){} msg('تم نسخ الرابط المختصر');
  };
  window.openClientPortalLinkV373 = async function(){
    const projectId=pid(); if(!projectId){msg('اختر المشروع أولًا',true); return;}
    const u=await saveShort(projectId); renderBox(); window.open(u,'_blank');
  };
  window.sendClientPortalWhatsappV373 = async function(){
    const projectId=pid(); if(!projectId){msg('اختر المشروع أولًا',true); return;}
    const u=await saveShort(projectId); renderBox();
    const txt=`السيد رئيس الجمعية المحترم،\n\nرابط بوابة مشروعكم لدى شركة تصنيف لإدارة المرافق:\n${u}\n\nوتقبلوا تحياتنا،\nشركة تصنيف لإدارة المرافق`;
    window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
  };
  const oldLoad=window.loadClientPortalV373;
  if(typeof oldLoad==='function' && !oldLoad.__v471){
    window.loadClientPortalV373=async function(){const r=await oldLoad.apply(this,arguments); setTimeout(()=>{saveShort().then(renderBox).catch(()=>renderBox());},150); return r;};
    window.loadClientPortalV373.__v471=true;
  }
  document.addEventListener('change',e=>{if(e.target&&e.target.id==='cpProjectV373') setTimeout(()=>{saveShort().then(renderBox).catch(()=>renderBox());},120);});
  setTimeout(()=>{saveShort().then(renderBox).catch(()=>renderBox());},1200);
})();

/* Tasneef V10246 - Tickets root clean + one loader + filtered export
   يعتمد على نسخة المستخدم. لا يلمس قاعدة البيانات. يعرض/يفلتر/يصدر من مصدر واحد فقط. */
(function(){
  'use strict';
  if(window.__tasneefTicketsRootV10246) return;
  window.__tasneefTicketsRootV10246 = true;

  const VERSION='V10246';
  const TABLE='tickets';
  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const K = v => S(v).toLowerCase().replace(/\s+/g,' ');
  const E = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const arr = v => Array.isArray(v) ? v : [];
  const dataObj = () => window.data || (window.data={});
  const titleOptions = ['صيانة','صهريج','سباكة','تعطير','تشجير','كهرباء','نظافة','دفاع مدني','مصاعد'];
  const statusMap = {open:'مفتوح',processing:'تحت المعالجة',closed:'مغلق'};
  const priorityMap = {normal:'عادي',high:'مهم',urgent:'عاجل',low:'منخفض'};
  const NO_RECEIPT='__no_receipt__';
  const NO_CLOSED='__no_closed__';
  let allTickets=[];
  let filteredTickets=[];
  let loadingPromise=null;
  let loadedAt=0;

  function msgOk(text){ try{ if(typeof window.msg==='function') window.msg(text,'ok'); else console.log(text); }catch(_){ console.log(text); } }
  function msgErr(text){ try{ if(typeof window.msg==='function') window.msg(text,'err'); else alert(text); }catch(_){ alert(text); } }
  function projects(){ return arr(dataObj().projects); }
  function users(){ return arr(dataObj().users || dataObj().app_users); }
  function projectLookup(id){
    if(!S(id)) return '';
    try{ if(typeof window.projectName==='function'){ const v=S(window.projectName(id)); if(v && v!=='-') return v; } }catch(_){ }
    const p=projects().find(x=>String(x.id)===String(id));
    return S(p && (p.name || p.project_name || p.title));
  }
  function userLookup(id){
    if(!S(id)) return '';
    try{ if(typeof window.supervisorName==='function'){ const v=S(window.supervisorName(id)); if(v && v!=='-') return v; } }catch(_){ }
    const u=users().find(x=>String(x.id)===String(id));
    return S(u && (u.full_name || u.name || u.username));
  }
  function first(t, keys){ for(const k of keys){ const v=S(t && t[k]); if(v && v!=='-') return v; } return ''; }
  function ticketProject(t){ return first(t,['project_name','projectName','project','project_title','project_label']) || projectLookup(t.project_id || t.projectId) || '-'; }
  function ticketSupervisor(t){ return first(t,['supervisor_name','supervisorName','supervisor','supervisor_full_name','assigned_supervisor_name']) || userLookup(t.supervisor_id || t.supervisorId) || '-'; }
  function ticketRecipient(t){
    return first(t,['claimed_by_name','claimed_name','claimedByName','claimed_by_user_name','received_by_name','recipient_name','receiver_name','receiver','assigned_to_name','technician_name','handler_name','assignee_name','claimed_by'])
      || userLookup(t.claimed_by_id || t.claimedById || t.claimed_by || t.assigned_to || t.technician_id)
      || '-';
  }
  function ticketClosedBy(t){
    return first(t,['closed_by_name','closedByName','closed_by_user_name','closed_name','closer_name','closed_by_user','closed_by'])
      || userLookup(t.closed_by_id || t.closedById || t.closed_by)
      || '-';
  }
  function hasReceipt(t){ const r=ticketRecipient(t); return !!(r && r !== '-' && K(r)!=='بدون استلام'); }
  function hasClosedBy(t){ const r=ticketClosedBy(t); return !!(r && r !== '-' && K(r)!=='بدون إغلاق'); }
  function ticketNo(t){ return S(t.ticket_number || t.ticket_no || t.no) || ('T-' + String(t.id || 0).padStart(4,'0')); }
  function dateRaw(t){ return S(t.created_at || t.createdAt || t.date || t.updated_at); }
  function dateMs(t){ const raw=dateRaw(t); const ms=raw?Date.parse(raw):NaN; return isNaN(ms) ? (Number(t.id)||0) : ms; }
  function fmtDate(t){ const raw=dateRaw(t); if(!raw) return '-'; const dt=new Date(raw); if(isNaN(dt.getTime())) return raw; try{return dt.toLocaleString('ar-SA',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}catch(_){return raw;} }
  function statusLabel(s){ return statusMap[S(s)] || S(s) || '-'; }
  function priorityLabel(p){ return priorityMap[S(p)] || S(p) || '-'; }
  function statusClass(s){ return S(s)==='closed'?'green':S(s)==='processing'?'amber':'red'; }
  function unique(vals){ const seen=new Set(), out=[]; vals.map(S).filter(v=>v && v!=='-').forEach(v=>{ const k=K(v); if(!seen.has(k)){seen.add(k); out.push(v);} }); return out.sort((a,b)=>a.localeCompare(b,'ar')); }
  function setOptions(id, allLabel, values, extraHtml){
    const el=$(id); if(!el) return;
    const old=el.value;
    const list=unique(values);
    el.innerHTML = `<option value="">${E(allLabel)}</option>` + (extraHtml||'') + list.map(v=>`<option value="${E(v)}">${E(v)}</option>`).join('');
    if([...el.options].some(o=>o.value===old)) el.value=old;
  }
  function ensureStyle(){
    if($('tasneefTicketRootStyleV10246')) return;
    const st=document.createElement('style'); st.id='tasneefTicketRootStyleV10246'; st.textContent=`
      .ticket-root-v10246-filters{display:grid!important;grid-template-columns:repeat(2,minmax(180px,1fr));gap:8px;margin:10px 0 14px}
      .ticket-root-v10246-filters select,.ticket-root-v10246-filters input{width:100%!important;padding:10px!important;border:1px solid #cfe2dc!important;border-radius:10px!important;background:#fff!important;color:#062f26!important}
      .ticket-root-v10246-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:2px}.ticket-root-v10246-actions button{min-height:38px}
      .ticket-root-v10246-summary{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin:10px 0}.ticket-root-v10246-kpi{background:#eef8f5;border:1px solid #d5ece5;border-radius:10px;padding:8px 12px;font-weight:800;color:#003b2f}
      .ticket-root-v10246-version{font-size:12px;color:#0b5d49;font-weight:900;align-self:center}.smart-ticket-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}.smart-ticket-card{border:1px solid #dbe9e4;border-radius:14px;padding:12px;background:white;box-shadow:0 4px 14px rgba(0,0,0,.04)}.smart-ticket-top,.smart-ticket-meta,.smart-ticket-mini,.smart-ticket-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:space-between}.smart-ticket-status{border-radius:20px;padding:4px 10px}.smart-ticket-status.green{background:#e7f8ed;color:#07622a}.smart-ticket-status.red{background:#ffecec;color:#b00020}.smart-ticket-status.amber{background:#fff6db;color:#7a4b00}.smart-ticket-note,.smart-ticket-card p{background:#f5faf8;border-radius:10px;padding:8px}.smart-ticket-actions button{margin:2px}
      @media(max-width:800px){.ticket-root-v10246-filters{grid-template-columns:1fr!important}}
    `; document.head.appendChild(st);
  }
  function ensureTitleSelect(){ const sel=$('ticketTitle'); if(!sel) return; const old=sel.value; sel.innerHTML='<option value="">اختر نوع المشكلة</option>'+titleOptions.map(v=>`<option value="${E(v)}">${E(v)}</option>`).join(''); if(titleOptions.includes(old)) sel.value=old; }
  function ensureFilters(){
    const body=$('ticketsBody'); if(!body) return;
    const card=body.closest('.card') || body.parentElement;
    // إزالة أي أزرار تنزيل مكررة خارج فلترنا فقط
    [...document.querySelectorAll('#ticketFiltersV10229,#ticketFiltersV10225,#ticketFiltersV10224,.ticket-clean-filters-v10229')].forEach(n=>{ if(n.id!=='ticketFiltersV10246') n.remove(); });
    let wrap=$('ticketFiltersV10246');
    if(!wrap){
      const old=card && card.querySelector('.filters');
      wrap=document.createElement('div'); wrap.id='ticketFiltersV10246'; wrap.className='ticket-root-v10246-filters';
      wrap.innerHTML=`
        <select id="ticketRootProjectV10246"><option value="">كل المشاريع</option></select>
        <select id="ticketRootSupervisorV10246"><option value="">كل المشرفين</option></select>
        <select id="ticketRootTitleV10246"><option value="">كل أنواع المشكلة</option></select>
        <select id="ticketRootStatusV10246"><option value="">كل الحالات</option><option value="open">مفتوح</option><option value="processing">تحت المعالجة</option><option value="closed">مغلق</option></select>
        <select id="ticketRootRecipientV10246"><option value="">كل المستلمين</option><option value="${NO_RECEIPT}">بدون استلام</option></select>
        <select id="ticketRootClosedByV10246"><option value="">كل المغلقين</option><option value="${NO_CLOSED}">بدون إغلاق</option></select>
        <select id="ticketRootSortV10246"><option value="newest">الأحدث أولاً</option><option value="oldest">الأقدم أولاً</option></select>
        <input id="ticketRootSearchV10246" placeholder="بحث برقم التكت، المشروع، المشرف، المستلم، المغلق، العنوان أو الوصف">
        <div class="ticket-root-v10246-actions"><button type="button" id="ticketRootPdfV10246">تنزيل PDF</button><button type="button" class="light" id="ticketRootCsvV10246">تصدير CSV</button><button type="button" class="light" id="ticketRootRefreshV10246">تحديث التكتات</button><span class="ticket-root-v10246-version">${VERSION}</span></div>`;
      if(old) old.replaceWith(wrap); else card.insertBefore(wrap, $('ticketsSmartSummary') || body);
    }
    ['ticketRootProjectV10246','ticketRootSupervisorV10246','ticketRootTitleV10246','ticketRootStatusV10246','ticketRootRecipientV10246','ticketRootClosedByV10246','ticketRootSortV10246'].forEach(id=>{ const el=$(id); if(el && !el.dataset.bound10246){ el.dataset.bound10246='1'; el.addEventListener('change',()=>renderTicketsRoot(),true); }});
    const q=$('ticketRootSearchV10246'); if(q && !q.dataset.bound10246){ q.dataset.bound10246='1'; q.addEventListener('input',()=>renderTicketsRoot(),true); }
    const pdf=$('ticketRootPdfV10246'); if(pdf && !pdf.dataset.bound10246){ pdf.dataset.bound10246='1'; pdf.addEventListener('click',()=>exportFilteredPdf(),true); }
    const csv=$('ticketRootCsvV10246'); if(csv && !csv.dataset.bound10246){ csv.dataset.bound10246='1'; csv.addEventListener('click',()=>exportFilteredCsv(),true); }
    const ref=$('ticketRootRefreshV10246'); if(ref && !ref.dataset.bound10246){ ref.dataset.bound10246='1'; ref.addEventListener('click',async()=>{ loadedAt=0; await loadTickets(true); renderTicketsRoot(); },true); }
  }
  function populateFilters(){
    setOptions('ticketRootProjectV10246','كل المشاريع', allTickets.map(ticketProject));
    setOptions('ticketRootSupervisorV10246','كل المشرفين', allTickets.map(ticketSupervisor));
    setOptions('ticketRootTitleV10246','كل أنواع المشكلة', titleOptions.concat(allTickets.map(t=>t.title||t.problem_type||t.category)));
    setOptions('ticketRootRecipientV10246','كل المستلمين', allTickets.map(ticketRecipient), `<option value="${NO_RECEIPT}">بدون استلام</option>`);
    setOptions('ticketRootClosedByV10246','كل المغلقين', allTickets.map(ticketClosedBy), `<option value="${NO_CLOSED}">بدون إغلاق</option>`);
  }
  function filterState(){ return {project:K($('ticketRootProjectV10246')?.value), supervisor:K($('ticketRootSupervisorV10246')?.value), title:K($('ticketRootTitleV10246')?.value), status:S($('ticketRootStatusV10246')?.value), recipient:S($('ticketRootRecipientV10246')?.value), closed:S($('ticketRootClosedByV10246')?.value), sort:S($('ticketRootSortV10246')?.value||'newest'), search:K($('ticketRootSearchV10246')?.value)}; }
  function cardText(t){ return [ticketNo(t), t.title, t.description, ticketProject(t), ticketSupervisor(t), statusLabel(t.status), priorityLabel(t.priority), ticketRecipient(t), ticketClosedBy(t), t.closure_note].join(' '); }
  function match(t,f){
    if(f.project && K(ticketProject(t))!==f.project) return false;
    if(f.supervisor && K(ticketSupervisor(t))!==f.supervisor) return false;
    if(f.title && K(t.title)!==f.title) return false;
    if(f.status && S(t.status||'open')!==f.status) return false;
    if(f.recipient===NO_RECEIPT && hasReceipt(t)) return false;
    else if(f.recipient && f.recipient!==NO_RECEIPT && K(ticketRecipient(t))!==K(f.recipient)) return false;
    if(f.closed===NO_CLOSED && hasClosedBy(t)) return false;
    else if(f.closed && f.closed!==NO_CLOSED && K(ticketClosedBy(t))!==K(f.closed)) return false;
    if(f.search && !K(cardText(t)).includes(f.search)) return false;
    return true;
  }
  async function loadTickets(force){
    if(loadingPromise) return loadingPromise;
    const now=Date.now();
    if(!force && allTickets.length && now-loadedAt<180000) return allTickets;
    loadingPromise=(async()=>{
      if(!window.sb || !window.sb.from){ allTickets=arr(dataObj().tickets); loadedAt=Date.now(); return allTickets; }
      const pageSize=1000; let from=0; let out=[];
      for(let guard=0; guard<30; guard++){
        const to=from+pageSize-1;
        let q=window.sb.from(TABLE).select('*').order('created_at',{ascending:false}).range(from,to);
        const r=await q;
        if(r.error){ console.warn('Tickets load error', r.error); if(out.length===0) out=arr(dataObj().tickets); break; }
        const rows=arr(r.data); out=out.concat(rows);
        if(rows.length<pageSize) break;
        from+=pageSize;
      }
      allTickets=out; dataObj().tickets=out; loadedAt=Date.now(); return out;
    })().finally(()=>{ loadingPromise=null; });
    return loadingPromise;
  }
  function durationText(t){ const start=Date.parse(dateRaw(t)||''); const end=t.closed_at?Date.parse(t.closed_at):Date.now(); if(isNaN(start)||isNaN(end)) return '-'; const mins=Math.max(0,Math.round((end-start)/60000)); const days=Math.floor(mins/1440), hrs=Math.floor((mins%1440)/60), mm=mins%60; if(days) return `${days} يوم ${hrs} س`; if(hrs) return `${hrs} س ${mm} د`; return `${mm} د`; }
  function card(t){ const id=Number(t.id)||0; const canPdf=typeof window.ticketDownloadPdfV206==='function'; const canView=typeof window.viewTicketSmartV147==='function'; const canClaim=typeof window.claimTicket==='function'; const canClose=typeof window.closeTicket==='function'; const canSet=typeof window.setTicketStatus==='function'; const actions=[canView?`<button type="button" onclick="viewTicketSmartV147(${id})">عرض</button>`:'',canPdf?`<button type="button" class="light" onclick="ticketDownloadPdfV206(${id})">PDF</button>`:'',`<button type="button" class="light" onclick="editTicket(${id})">تعديل</button>`,S(t.status)==='closed'?(canSet?`<button type="button" class="light" onclick="setTicketStatus(${id},'open')">إعادة فتح</button>`:''):`${S(t.status)!=='processing'&&canClaim?`<button type="button" class="light" onclick="claimTicket(${id})">استلام</button>`:''}${canClose?`<button type="button" onclick="closeTicket(${id})">إغلاق</button>`:''}`,`<button type="button" class="light" onclick="sendTicketWhatsappV10246(${id})">إرسال واتساب</button>`,`<button type="button" class="danger" onclick="deleteRow('tickets',${id})">حذف</button>`].filter(Boolean).join(' ');
    return `<article class="smart-ticket-card ${statusClass(t.status)}" data-ticket-id="${E(id)}"><div class="smart-ticket-top"><div><strong>${E(ticketNo(t))}</strong><small>${E(fmtDate(t))}</small></div><span class="smart-ticket-status ${statusClass(t.status)}">${E(statusLabel(t.status))}</span></div><h3>${E(t.title||'-')}</h3><div class="smart-ticket-meta"><span>المشروع: <b>${E(ticketProject(t))}</b></span><span>المشرف: <b>${E(ticketSupervisor(t))}</b></span><span>الأولوية: <b>${E(priorityLabel(t.priority))}</b></span><span>مدة الفتح: <b>${E(durationText(t))}</b></span></div><p>${E(t.description||'لا يوجد وصف')}</p><div class="smart-ticket-mini"><span>المستلم: ${E(ticketRecipient(t))}</span><span>المغلق: ${E(ticketClosedBy(t))}</span></div>${t.closure_note?`<div class="smart-ticket-note">الحل: ${E(t.closure_note)}</div>`:''}<div class="smart-ticket-actions">${actions}</div></article>`;
  }
  function updateSummary(rows){ const box=$('ticketsSmartSummary'); if(!box) return; const total=allTickets.length, view=rows.length, open=allTickets.filter(t=>S(t.status||'open')==='open').length, proc=allTickets.filter(t=>S(t.status)==='processing').length, closed=allTickets.filter(t=>S(t.status)==='closed').length; box.innerHTML=`<div class="ticket-root-v10246-summary"><span class="ticket-root-v10246-kpi">الإجمالي: <b>${total}</b></span><span class="ticket-root-v10246-kpi">المعروض: <b>${view}</b></span><span class="ticket-root-v10246-kpi">مفتوح: <b>${open}</b></span><span class="ticket-root-v10246-kpi">تحت المعالجة: <b>${proc}</b></span><span class="ticket-root-v10246-kpi">مغلق: <b>${closed}</b></span></div>`; }
  async function renderTicketsRoot(){
    const body=$('ticketsBody'); if(!body) return;
    ensureStyle(); ensureTitleSelect(); ensureFilters();
    await loadTickets(false);
    populateFilters();
    const f=filterState();
    let rows=allTickets.filter(t=>match(t,f));
    rows.sort((a,b)=>f.sort==='oldest'?dateMs(a)-dateMs(b):dateMs(b)-dateMs(a));
    filteredTickets=rows;
    body.classList.add('smart-ticket-grid');
    body.innerHTML=rows.map(card).join('') || '<div class="muted" style="padding:16px">لا توجد تكتات مطابقة للفلاتر الحالية</div>';
    updateSummary(rows);
  }
  function whatsappText(t){ return ['تكت صيانة','','رقم التكت: '+ticketNo(t),'المشروع: '+ticketProject(t),'المشرف: '+ticketSupervisor(t),'العنوان: '+S(t.title||'-'),'الوصف: '+S(t.description||'-'),'الحالة: '+statusLabel(t.status),'المستلم: '+ticketRecipient(t),'المغلق: '+ticketClosedBy(t)].join('\n'); }
  window.sendTicketWhatsappV10246=function(id){ const t=allTickets.find(x=>String(x.id)===String(id)); if(!t) return alert('لم يتم العثور على التكت'); window.open('https://wa.me/?text='+encodeURIComponent(whatsappText(t)),'_blank','noopener'); };
  function csvEscape(v){ return '"'+S(v).replace(/"/g,'""')+'"'; }
  function rowsForExport(){ return filteredTickets && filteredTickets.length ? filteredTickets : allTickets.filter(t=>match(t,filterState())); }
  function exportFilteredCsv(){ const rows=rowsForExport(); const heads=['رقم التكت','التاريخ','المشروع','المشرف','نوع المشكلة','الأولوية','الحالة','المستلم','المغلق','الوصف','الحل']; const lines=[heads.map(csvEscape).join(',')].concat(rows.map(t=>[ticketNo(t),fmtDate(t),ticketProject(t),ticketSupervisor(t),t.title,priorityLabel(t.priority),statusLabel(t.status),ticketRecipient(t),ticketClosedBy(t),t.description,t.closure_note].map(csvEscape).join(','))); const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='tickets_filtered_'+new Date().toISOString().slice(0,10)+'.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
  function exportFilteredPdf(){ const rows=rowsForExport(); const filters=filterState(); const html=`<html dir="rtl"><head><meta charset="utf-8"><title>تقرير التكتات</title><style>body{font-family:Tahoma,Arial;padding:20px}h2{color:#064d3b}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#064d3b;color:white}td,th{border:1px solid #ccc;padding:6px;text-align:right}.meta{margin:10px 0;color:#333}</style></head><body><h2>تقرير التكتات حسب الفلاتر</h2><div class="meta">التاريخ: ${new Date().toLocaleString('ar-SA')} - عدد النتائج: ${rows.length}</div><table><thead><tr><th>رقم التكت</th><th>التاريخ</th><th>المشروع</th><th>المشرف</th><th>نوع المشكلة</th><th>الحالة</th><th>المستلم</th><th>المغلق</th><th>الوصف</th></tr></thead><tbody>${rows.map(t=>`<tr><td>${E(ticketNo(t))}</td><td>${E(fmtDate(t))}</td><td>${E(ticketProject(t))}</td><td>${E(ticketSupervisor(t))}</td><td>${E(t.title)}</td><td>${E(statusLabel(t.status))}</td><td>${E(ticketRecipient(t))}</td><td>${E(ticketClosedBy(t))}</td><td>${E(t.description)}</td></tr>`).join('')}</tbody></table></body></html>`; const w=window.open('','_blank'); if(!w) return msgErr('المتصفح منع فتح نافذة الطباعة'); w.document.write(html); w.document.close(); setTimeout(()=>{try{w.print();}catch(_){}},600); }
  window.renderTickets=renderTicketsRoot;
  window.renderTicketsCleanV10229=renderTicketsRoot;
  window.renderTicketsRootV10246=renderTicketsRoot;
  async function boot(){ try{ ensureStyle(); ensureTitleSelect(); ensureFilters(); await loadTickets(false); renderTicketsRoot(); }catch(e){ console.error(e); msgErr(e.message||'تعذر تحميل التكتات'); } }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,500));
  // يعمل مرة واحدة فقط بعد التحميل، بدون setInterval وبدون إعادة كتابة من نسخ قديمة.
  window.addEventListener('load',()=>setTimeout(boot,900));
})();

/* Tasneef V10286 - Tickets date range filters + professional client print
   يعتمد على نسخة المستخدم. لا يلمس قاعدة البيانات. يعرض/يفلتر/يصدر من مصدر واحد فقط. */
(function(){
  'use strict';
  if(window.__tasneefTicketsRootV10246) return;
  window.__tasneefTicketsRootV10246 = true;

  const VERSION='V10286';
  const TABLE='tickets';
  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const K = v => S(v).toLowerCase().replace(/\s+/g,' ');
  const E = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const arr = v => Array.isArray(v) ? v : [];
  const dataObj = () => window.data || (window.data={});
  const titleOptions = ['صيانة','نظافة','مشكلة نظافة','سباكة','تعطير','تشجير','كهرباء','صهاريج','دفاع مدني','مصاعد'];
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
  function ticketDateOnly(t){ const ms=dateMs(t); if(!ms) return ''; const d=new Date(ms); if(isNaN(d.getTime())) return ''; const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
  function todayIso(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function arDate(v){ if(!S(v)) return 'غير محدد'; const d=new Date(S(v)+'T12:00:00'); if(isNaN(d.getTime())) return S(v); try{return d.toLocaleDateString('ar-SA',{year:'numeric',month:'2-digit',day:'2-digit'});}catch(_){return S(v);} }
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
        <label class="ticket-root-v10246-date-label">من تاريخ<input type="date" id="ticketRootDateFromV10246"></label>
        <label class="ticket-root-v10246-date-label">إلى تاريخ<input type="date" id="ticketRootDateToV10246"></label>
        <input id="ticketRootSearchV10246" placeholder="بحث برقم التكت، المشروع، المشرف، المستلم، المغلق، العنوان أو الوصف">
        <div class="ticket-root-v10246-actions"><button type="button" id="ticketRootPdfV10246">طباعة / PDF للعميل</button><button type="button" class="light" id="ticketRootCsvV10246">تصدير CSV</button><button type="button" class="light" id="ticketRootRefreshV10246">تحديث التكتات</button><span class="ticket-root-v10246-version">${VERSION}</span></div>`;
      if(old) old.replaceWith(wrap); else card.insertBefore(wrap, $('ticketsSmartSummary') || body);
    }
    ['ticketRootProjectV10246','ticketRootSupervisorV10246','ticketRootTitleV10246','ticketRootStatusV10246','ticketRootRecipientV10246','ticketRootClosedByV10246','ticketRootSortV10246','ticketRootDateFromV10246','ticketRootDateToV10246'].forEach(id=>{ const el=$(id); if(el && !el.dataset.bound10246){ el.dataset.bound10246='1'; el.addEventListener('change',()=>renderTicketsRoot(),true); }});
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
  function filterState(){ return {project:K($('ticketRootProjectV10246')?.value), supervisor:K($('ticketRootSupervisorV10246')?.value), title:K($('ticketRootTitleV10246')?.value), status:S($('ticketRootStatusV10246')?.value), recipient:S($('ticketRootRecipientV10246')?.value), closed:S($('ticketRootClosedByV10246')?.value), sort:S($('ticketRootSortV10246')?.value||'newest'), from:S($('ticketRootDateFromV10246')?.value), to:S($('ticketRootDateToV10246')?.value), search:K($('ticketRootSearchV10246')?.value)}; }
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
    const d=ticketDateOnly(t);
    if(f.from && (!d || d < f.from)) return false;
    if(f.to && (!d || d > f.to)) return false;
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
  function ticketCloseMethodText(t){ return S(t.closure_note) || S(t.close_method) || S(t.closeMethod) || S(t.closing_method) || S(t.closingMethod) || S(t.resolution) || S(t.solution) || S(t.close_note) || S(t.closing_note) || S(t.close_description) || S(t['طريقة الإغلاق']) || S(t['حل المشكلة']) || S(t['وصف الإغلاق']); }
  function whatsappText(t){
    const lines=['تكت صيانة','','رقم التكت: '+ticketNo(t),'المشروع: '+ticketProject(t),'المشرف: '+ticketSupervisor(t),'العنوان: '+S(t.title||'-'),'الوصف: '+S(t.description||'-'),'الحالة: '+statusLabel(t.status),'المستلم: '+ticketRecipient(t),'المغلق: '+ticketClosedBy(t)];
    const method=ticketCloseMethodText(t);
    if(S(t.status)==='closed'){
      lines.push('طريقة الإغلاق: '+(method||'-'));
    }
    return lines.join('\n');
  }
  window.sendTicketWhatsappV10246=function(id){ const t=allTickets.find(x=>String(x.id)===String(id)); if(!t) return alert('لم يتم العثور على التكت'); window.open('https://wa.me/?text='+encodeURIComponent(whatsappText(t)),'_blank','noopener'); };
  function csvEscape(v){ return '"'+S(v).replace(/"/g,'""')+'"'; }
  function rowsForExport(){ return filteredTickets && filteredTickets.length ? filteredTickets : allTickets.filter(t=>match(t,filterState())); }
  function exportFilteredCsv(){ const rows=rowsForExport(); const heads=['رقم التكت','التاريخ','المشروع','المشرف','نوع المشكلة','الأولوية','الحالة','المستلم','المغلق','الوصف','الحل']; const lines=[heads.map(csvEscape).join(',')].concat(rows.map(t=>[ticketNo(t),fmtDate(t),ticketProject(t),ticketSupervisor(t),t.title,priorityLabel(t.priority),statusLabel(t.status),ticketRecipient(t),ticketClosedBy(t),t.description,t.closure_note].map(csvEscape).join(','))); const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='tickets_filtered_'+new Date().toISOString().slice(0,10)+'.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
  function filterLabel(f){
    const parts=[];
    if(f.from || f.to) parts.push(`الفترة: من ${arDate(f.from)} إلى ${arDate(f.to)}`);
    if(f.project) parts.push(`المشروع: ${$('ticketRootProjectV10246')?.value || 'الكل'}`);
    if(f.supervisor) parts.push(`المشرف: ${$('ticketRootSupervisorV10246')?.value || 'الكل'}`);
    if(f.title) parts.push(`نوع المشكلة: ${$('ticketRootTitleV10246')?.value || 'الكل'}`);
    if(f.status) parts.push(`الحالة: ${statusLabel(f.status)}`);
    if(f.recipient) parts.push(`المستلم: ${f.recipient===NO_RECEIPT?'بدون استلام':$('ticketRootRecipientV10246')?.value}`);
    if(f.closed) parts.push(`المغلق: ${f.closed===NO_CLOSED?'بدون إغلاق':$('ticketRootClosedByV10246')?.value}`);
    if(f.search) parts.push(`بحث: ${$('ticketRootSearchV10246')?.value}`);
    return parts.length ? parts.join(' | ') : 'كل التكتات بدون فلاتر محددة';
  }
  function exportFilteredPdf(){
    const rows=rowsForExport();
    const f=filterState();
    const generatedAt=new Date().toLocaleString('ar-SA');
    const counts={total:rows.length, open:rows.filter(t=>S(t.status||'open')==='open').length, proc:rows.filter(t=>S(t.status)==='processing').length, closed:rows.filter(t=>S(t.status)==='closed').length};
    const html=`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>تقرير التكتات - شركة تصنيف</title><style>
      @page{size:A4 landscape;margin:9mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;margin:0;background:#fff;color:#133d33;font-size:11px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{padding:14px;border:2px solid #0b5a49;min-height:100vh}.head{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #0b5a49;padding-bottom:10px;margin-bottom:10px}.brand{display:flex;align-items:center;gap:10px}.logoBox{width:72px;height:58px;border:2px solid #d5b15d;border-radius:16px;display:grid;place-items:center;background:#f8fbfa;overflow:hidden}.logoBox img{max-width:68px;max-height:52px}.logoText{font-weight:900;color:#0b5a49;font-size:17px}.brand h1{font-size:18px;margin:0;color:#0b5a49}.brand p{margin:3px 0 0;color:#687b74}.title{text-align:left}.title h2{margin:0;font-size:24px;color:#0b5a49}.title p{margin:4px 0;color:#687b74}.meta{border:1px solid #dce9e4;background:#f3faf7;border-radius:12px;padding:9px;margin:10px 0;line-height:1.8}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.kpi{border:1px solid #dce9e4;border-radius:12px;padding:10px;text-align:center;background:#fff}.kpi b{display:block;color:#0b5a49;font-size:18px;margin-top:3px}table{width:100%;border-collapse:collapse;margin-top:10px}th{background:#0b5a49;color:#fff;font-weight:900;padding:7px;border:1px solid #0b5a49;white-space:nowrap}td{border:1px solid #d9e6e1;padding:6px;vertical-align:top;color:#12382f}tbody tr:nth-child(even){background:#f7fbfa}.desc{max-width:270px;line-height:1.45}.status{font-weight:900}.closed{color:#06703b}.open{color:#b00020}.processing{color:#8a5a00}.foot{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}.sign{border:1px solid #d9e6e1;border-radius:12px;min-height:66px;padding:10px}.note{text-align:center;color:#0b5a49;margin-top:10px;font-weight:800}.copy-label{display:inline-block;margin-top:8px;background:#0b5a49;color:#fff;border-radius:999px;padding:7px 18px;font-weight:900}.noPrint{display:none}@media print{.sheet{border-radius:0}.sign,tr{break-inside:avoid}}
    </style></head><body><div class="sheet"><div class="head"><div class="brand"><div class="logoBox"><img src="tasneef_logo_print.png" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span class="logoText" style="display:none">تصنيف</span></div><div><h1>شركة تصنيف لإدارة المرافق</h1><p>تقرير تكتات العملاء حسب الفلاتر المحددة</p></div></div><div class="title"><h2>تقرير التكتات</h2><p>تاريخ الإصدار: ${E(generatedAt)}</p></div></div><div class="meta"><b>الفلاتر المطبقة:</b> ${E(filterLabel(f))}</div><div class="kpis"><div class="kpi">إجمالي النتائج<b>${counts.total}</b></div><div class="kpi">مفتوح<b>${counts.open}</b></div><div class="kpi">تحت المعالجة<b>${counts.proc}</b></div><div class="kpi">مغلق<b>${counts.closed}</b></div></div><table><thead><tr><th>م</th><th>رقم التكت</th><th>التاريخ</th><th>المشروع</th><th>المشرف</th><th>نوع المشكلة</th><th>الأولوية</th><th>الحالة</th><th>المستلم</th><th>المغلق</th><th>الوصف / الإجراء</th></tr></thead><tbody>${rows.map((t,i)=>`<tr><td>${i+1}</td><td>${E(ticketNo(t))}</td><td>${E(fmtDate(t))}</td><td>${E(ticketProject(t))}</td><td>${E(ticketSupervisor(t))}</td><td>${E(t.title||'-')}</td><td>${E(priorityLabel(t.priority))}</td><td class="status ${S(t.status)==='closed'?'closed':S(t.status)==='processing'?'processing':'open'}">${E(statusLabel(t.status))}</td><td>${E(ticketRecipient(t))}</td><td>${E(ticketClosedBy(t))}</td><td class="desc"><b>الوصف:</b> ${E(t.description||'-')}${t.closure_note?`<br><b>الإجراء:</b> ${E(t.closure_note)}`:''}</td></tr>`).join('') || '<tr><td colspan="11" style="text-align:center;padding:25px">لا توجد تكتات مطابقة للفلاتر</td></tr>'}</tbody></table><div class="note report-disclaimer">تم إنشاء هذا التقرير من نظام شركة تصنيف لإدارة المرافق، ويعتبر معتمدًا ما لم يبرر العميل خلاف ذلك.</div><div class="copy-label">نسخة الإدارة</div></div><script>window.onload=function(){setTimeout(function(){window.print()},650)}</script></body></html>`;
    const w=window.open('','_blank');
    if(!w) return msgErr('المتصفح منع فتح نافذة الطباعة');
    w.document.open(); w.document.write(html); w.document.close();
  }
  window.renderTickets=renderTicketsRoot;
  window.renderTicketsCleanV10229=renderTicketsRoot;
  window.renderTicketsRootV10246=renderTicketsRoot;
  async function boot(){ try{ ensureStyle(); ensureTitleSelect(); ensureFilters(); await loadTickets(false); renderTicketsRoot(); }catch(e){ console.error(e); msgErr(e.message||'تعذر تحميل التكتات'); } }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,500));
  // يعمل مرة واحدة فقط بعد التحميل، بدون setInterval وبدون إعادة كتابة من نسخ قديمة.
  window.addEventListener('load',()=>setTimeout(boot,900));
})();

/* ===== V245 Abu Samer: تثبيت صيغة واتساب إغلاق التكت داخل ملف التكتات الجذري ===== */
(function(){
  function S(v){ return String(v ?? '').trim(); }
  function A(v){ return Array.isArray(v) ? v : []; }
  function D(){ return window.data || window.appData || {}; }
  function tickets(){ try{ if(Array.isArray(allTickets)) return allTickets; }catch(_){ } return A(D().tickets); }
  function findTicket(id){ return tickets().find(t => String(t.id) === String(id)); }
  function no(t){ return S(t.ticket_number || t.ticket_no) || ('T-' + String(t.id || 0).padStart(4,'0')); }
  function project(t){
    try{ if(typeof ticketProject === 'function'){ const n=ticketProject(t); if(S(n)) return n; } }catch(_){ }
    try{ if(typeof projectNameSafe === 'function'){ const n=projectNameSafe(t.project_id); if(S(n)) return n; } }catch(_){ }
    try{ if(typeof projectName === 'function'){ const n=projectName(t.project_id); if(S(n)) return n; } }catch(_){ }
    try{ const p=A(D().projects).find(p=>String(p.id)===String(t.project_id)); if(p && S(p.name)) return p.name; }catch(_){ }
    return S(t.project_name) || '-';
  }
  function statusLabel(v){ v=S(v); return v==='closed'?'مغلق':(v==='processing'?'تحت المعالجة':'مفتوح'); }
  function method(t){ return S(t.closure_note) || S(t.close_method) || S(t.closeMethod) || S(t.closing_method) || S(t.closingMethod) || S(t.resolution) || S(t.solution) || S(t.close_note) || S(t.closing_note) || S(t.close_description) || S(t['طريقة الإغلاق']) || S(t['حل المشكلة']) || S(t['وصف الإغلاق']); }
  function dObj(v){ const d=v?new Date(v):new Date(); return isNaN(d)?new Date():d; }
  function dateLabel(v){ const d=dObj(v); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function timeLabel(v){ try{ return dObj(v).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}); }catch(_){ return ''; } }
  function build(t){
    const closed=S(t.status)==='closed';
    const dt=closed?(t.closed_at||t.updated_at||t.created_at):(t.created_at||t.updated_at);
    if(closed){
      return ['تم إغلاق التكت','','اسم المشروع: '+project(t),'رقم التكت: '+no(t),'وصف المشكلة: '+(S(t.description)||S(t.title)||'-'),'حالة المشكلة: مغلق','طريقة الإغلاق: '+(method(t)||'-'),'تم الإغلاق بواسطة: '+(S(t.closed_by_name)||'-'),'التاريخ: '+dateLabel(dt),'الوقت: '+timeLabel(dt)].join('\n');
    }
    return ['تم تسجيل تكت جديد','','اسم المشروع: '+project(t),'رقم التكت: '+no(t),'وصف المشكلة: '+(S(t.description)||S(t.title)||'-'),'حالة المشكلة: '+statusLabel(t.status),'التاريخ: '+dateLabel(dt),'الوقت: '+timeLabel(dt)].join('\n');
  }
  window.buildTicketWhatsappRootV245=build;
  window.sendTicketWhatsappV10246=function(id){ const t=findTicket(id); if(!t) return alert('لم يتم العثور على التكت'); window.open('https://wa.me/?text='+encodeURIComponent(build(t)),'_blank','noopener'); };
})();

/* ===== V10364: Ticket priority SLA bars + required validation ===== */
(function(){
  'use strict';
  if(window.__tasneefTicketSlaV10364) return;
  window.__tasneefTicketSlaV10364 = true;
  const BUILD='v10370-ticket-sla-date-range-fix';
  const STORE='tasneef_ticket_sla_hours_v10364';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const E=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function D(){ window.data=window.data || {}; return window.data; }
  function notify(text,type){ try{ if(typeof window.msg==='function') window.msg(text,type||'err'); else alert(text); }catch(_){ alert(text); } }
  function cfg(){
    let c={urgent:4, high:12, normal:24};
    try{ c=Object.assign(c, JSON.parse(localStorage.getItem(STORE)||'{}')); }catch(_){ }
    ['urgent','high','normal'].forEach(k=>{ c[k]=Math.max(1, Number(c[k])||({urgent:4,high:12,normal:24}[k])); });
    return c;
  }
  function setCfg(k,v){ const c=cfg(); c[k]=Math.max(1, Number(v)||1); localStorage.setItem(STORE, JSON.stringify(c)); }
  function priorityKey(p){ p=S(p); if(p==='urgent') return 'urgent'; if(p==='high') return 'high'; return 'normal'; }
  function priorityLabel(p){ p=S(p); return p==='urgent'?'عاجل':(p==='high'?'مهم':(p==='low'?'منخفض':'عادي')); }
  function statusLabel(s){ s=S(s||'open'); return s==='closed'?'مغلق':(s==='processing'?'تحت المعالجة':'مفتوح'); }
  function ticketNo(t){ return S(t.ticket_number||t.ticket_no||t.no) || ('T-'+String(t.id||0).padStart(4,'0')); }
  function projectNameSafe(id){ try{ if(typeof window.projectName==='function'){ const v=window.projectName(id); if(S(v)&&S(v)!=='-') return v; } }catch(_){ } const p=A(D().projects).find(x=>String(x.id)===String(id)); return S(p&&(p.name||p.project_name))||'-'; }
  function supervisorNameSafe(id){ try{ if(typeof window.supervisorName==='function'){ const v=window.supervisorName(id); if(S(v)&&S(v)!=='-') return v; } }catch(_){ } const u=A(D().users||D().app_users).find(x=>String(x.id)===String(id)); return S(u&&(u.full_name||u.name||u.username))||'-'; }
  function projectOf(t){ return S(t.project_name||t.projectName||t.project) || projectNameSafe(t.project_id||t.projectId); }
  function supervisorOf(t){ return S(t.supervisor_name||t.supervisorName||t.supervisor) || supervisorNameSafe(t.supervisor_id||t.supervisorId); }
  function recipientOf(t){ return S(t.claimed_by_name||t.received_by_name||t.recipient_name||t.assignee_name||t.technician_name) || supervisorNameSafe(t.claimed_by||t.assigned_to||t.technician_id) || '-'; }
  function closedByOf(t){ return S(t.closed_by_name||t.closed_name||t.closer_name) || supervisorNameSafe(t.closed_by||t.closed_by_id) || '-'; }
  function dateMs(t){ const raw=S(t.created_at||t.createdAt||t.date||t.updated_at); const n=Date.parse(raw); return isNaN(n)?(Number(t.id)||0):n; }
  function ticketDateOnlyV10370(t){
    const raw=S(t.created_at||t.createdAt||t.date||t.updated_at);
    const d=raw?new Date(raw):null;
    if(!d || isNaN(d.getTime())) return '';
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function fmtDate(v){ const d=v?new Date(v):null; if(!d||isNaN(d)) return '-'; try{return d.toLocaleString('ar-SA',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}catch(_){return S(v).slice(0,16);} }
  function durationText(min){ min=Math.max(0,Math.round(Number(min)||0)); const d=Math.floor(min/1440), h=Math.floor((min%1440)/60), m=min%60; if(d) return d+' يوم '+h+' س'; if(h) return h+' س '+m+' د'; return m+' د'; }
  function slaInfo(t){
    const c=cfg(); const key=priorityKey(t.priority); const dueH=Number(c[key]||24); const dueMin=dueH*60;
    const start=Date.parse(S(t.created_at||t.createdAt||t.date||t.updated_at));
    const closed=S(t.status)==='closed'; const end=closed?Date.parse(S(t.closed_at||t.updated_at)):Date.now();
    const elapsed=(!isNaN(start)&&!isNaN(end))?Math.max(0,Math.round((end-start)/60000)):0;
    let state='standard';
    if(elapsed>dueMin) state='late';
    else if(elapsed>=dueMin*0.8) state='near';
    const pct=Math.max(4, Math.min(100, Math.round((elapsed/Math.max(1,dueMin))*100)));
    const label=state==='late'?'متأخر':(state==='near'?'قارب':'قياسي');
    return {key,dueH,dueMin,elapsed,state,label,pct,closed};
  }
  function stateClass(st){ return st==='late'?'sla-red':(st==='near'?'sla-yellow':'sla-green'); }
  function normalizeFilterValue(v){ v=S(v); if(v==='red'||v==='late') return 'late'; if(v==='yellow'||v==='near') return 'near'; if(v==='green'||v==='standard') return 'standard'; return ''; }
  function ensureStyle(){ if($('ticketSlaStyleV10364')) return; const st=document.createElement('style'); st.id='ticketSlaStyleV10364'; st.textContent=`
    .ticket-sla-panel-v10364{border:1px solid #d8e9e3;background:#f7fbfa;border-radius:14px;padding:12px;margin:10px 0;display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:10px;align-items:end}
    .ticket-sla-panel-v10364 label{font-weight:900;color:#063d32;font-size:12px;margin:0!important}.ticket-sla-panel-v10364 input,.ticket-sla-panel-v10364 select{width:100%;border:1px solid #cfe2dc;border-radius:10px;padding:9px;background:white;color:#062f26;font-weight:800}.ticket-sla-panel-title{grid-column:1/-1;font-weight:900;color:#075342;margin-bottom:0}.ticket-sla-help{grid-column:1/-1;color:#657b72;font-size:12px;font-weight:700}.ticket-sla-card{position:relative;overflow:hidden;border-top:0!important}.ticket-sla-strip{height:8px;border-radius:999px;background:#edf3f1;margin:0 0 10px;overflow:hidden}.ticket-sla-fill{display:block;height:100%;border-radius:999px}.ticket-sla-card.sla-red{border-color:#efb8b8!important;background:#fff8f8!important}.ticket-sla-card.sla-yellow{border-color:#f0d98c!important;background:#fffdf3!important}.ticket-sla-card.sla-green{border-color:#b9e1c7!important;background:#f8fff9!important}.ticket-sla-fill.sla-red{background:#d92d20}.ticket-sla-fill.sla-yellow{background:#f0b429}.ticket-sla-fill.sla-green{background:#168a43}.ticket-sla-badge{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:5px 10px;font-weight:900;font-size:12px}.ticket-sla-badge.sla-red{background:#ffe8e8;color:#a40000}.ticket-sla-badge.sla-yellow{background:#fff4cf;color:#7a4b00}.ticket-sla-badge.sla-green{background:#e8f8ef;color:#086b32}.ticket-sla-missing{outline:2px solid #d92d20!important;background:#fff8f8!important}@media(max-width:900px){.ticket-sla-panel-v10364{grid-template-columns:1fr 1fr}.ticket-sla-panel-title,.ticket-sla-help{grid-column:1/-1}}.ticket-sla-panel-limited-v10366{grid-template-columns:minmax(190px,280px) 1fr!important}.ticket-sla-panel-limited-v10366 .ticket-sla-help{grid-column:auto!important;align-self:center}`;
    document.head.appendChild(st);
  }
  function panelHtml(prefix, limited){ const c=cfg(); const filter=`<label>فلتر الشريط<select id="${prefix}TicketSlaFilterV10364"><option value="">كل الأشرطة</option><option value="late">متأخر</option><option value="near">قارب</option><option value="standard">قياسي</option></select></label>`; if(limited){ return `<div id="${prefix}TicketSlaPanelV10364" class="ticket-sla-panel-v10364 ticket-sla-panel-limited-v10366"><div class="ticket-sla-panel-title">فلتر الشريط</div>${filter}<div class="ticket-sla-help">الأحمر: متأخر، الأصفر: قارب، الأخضر: قياسي.</div></div>`; } return `<div id="${prefix}TicketSlaPanelV10364" class="ticket-sla-panel-v10364"><div class="ticket-sla-panel-title">أوقات الأولوية والتنبيه</div><label>عاجل / ساعة<input type="number" min="1" id="${prefix}SlaUrgentV10364" value="${E(c.urgent)}"></label><label>مهم / ساعة<input type="number" min="1" id="${prefix}SlaHighV10364" value="${E(c.high)}"></label><label>عادي / ساعة<input type="number" min="1" id="${prefix}SlaNormalV10364" value="${E(c.normal)}"></label>${filter}<div class="ticket-sla-help">الأحمر: متأخر عن الوقت المحدد، الأصفر: قارب انتهاء الوقت، الأخضر: قياسي أو تم إنجازه في الوقت.</div></div>`; }
  function bindPanel(prefix){
    [['Urgent','urgent'],['High','high'],['Normal','normal']].forEach(([id,k])=>{ const el=$(prefix+'Sla'+id+'V10364'); if(el&&!el.dataset.slaBound){ el.dataset.slaBound='1'; el.addEventListener('change',()=>{ setCfg(k,el.value); renderTicketsSafe(); }); } });
    const f=$(prefix+'TicketSlaFilterV10364'); if(f&&!f.dataset.slaBound){ f.dataset.slaBound='1'; f.addEventListener('change',()=>renderTicketsSafe()); }
  }
  function ensurePanels(){
    ensureStyle();
    const adminBody=$('ticketsBody'); if(adminBody && !$('admTicketSlaPanelV10364')){ const card=adminBody.closest('.card')||adminBody.parentElement; const target=$('ticketFiltersV10246') || (card&&card.querySelector('.filters')) || adminBody; if(target){ target.insertAdjacentHTML('beforebegin',panelHtml('adm', false)); } }
    const supBody=$('supTicketsBody'); if(supBody && !$('supTicketSlaPanelV10364')){ const card=supBody.closest('.card')||supBody.parentElement; const target=card && card.querySelector('.filters'); if(target){ target.insertAdjacentHTML('afterend',panelHtml('sup', true)); } }
    bindPanel('adm'); bindPanel('sup');
  }
  function selectedSlaFilter(){ return normalizeFilterValue($('admTicketSlaFilterV10364')?.value || $('supTicketSlaFilterV10364')?.value); }
  async function loadTicketsQuick(){
    if(A(D().tickets).length) return A(D().tickets);
    if(!window.sb || !sb.from) return [];
    const r=await sb.from('tickets').select('*').order('created_at',{ascending:false}).limit(1000);
    if(r.error) throw r.error;
    D().tickets=A(r.data);
    return D().tickets;
  }
  function filterAdmin(rows){
    const st=S($('ticketRootStatusV10246')?.value || $('ticketFilterStatus')?.value); const q=(S($('ticketRootSearchV10246')?.value || $('ticketSearch')?.value)).toLowerCase(); const title=S($('ticketRootTitleV10246')?.value); const sla=selectedSlaFilter();
    const proj=S($('ticketRootProjectV10246')?.value).toLowerCase(); const sup=S($('ticketRootSupervisorV10246')?.value).toLowerCase();
    let from=S($('ticketRootDateFromV10246')?.value), to=S($('ticketRootDateToV10246')?.value);
    if(from && to && from>to){ const tmp=from; from=to; to=tmp; }
    return rows.filter(t=>{
      const dd=ticketDateOnlyV10370(t);
      if(from && (!dd || dd<from)) return false;
      if(to && (!dd || dd>to)) return false;
      if(st && S(t.status||'open')!==st) return false; if(title && S(t.title)!==title) return false; if(proj && projectOf(t).toLowerCase()!==proj) return false; if(sup && supervisorOf(t).toLowerCase()!==sup) return false; if(sla && slaInfo(t).state!==sla) return false; if(q && ![ticketNo(t),t.title,t.description,projectOf(t),supervisorOf(t),statusLabel(t.status),priorityLabel(t.priority),recipientOf(t),closedByOf(t),t.closure_note].join(' ').toLowerCase().includes(q)) return false; return true; });
  }
  function filterSup(rows){
    const st=S($('supTicketFilterStatus')?.value); const pid=S($('supTicketFilterProject')?.value); const q=S($('supTicketSearch')?.value).toLowerCase(); const sla=normalizeFilterValue($('supTicketSlaFilterV10364')?.value);
    return rows.filter(t=>{ if(pid && String(t.project_id)!==pid) return false; if(st && S(t.status||'open')!==st) return false; if(sla && slaInfo(t).state!==sla) return false; if(q && ![ticketNo(t),t.title,t.description,projectOf(t),supervisorOf(t),statusLabel(t.status),priorityLabel(t.priority),recipientOf(t),closedByOf(t),t.closure_note].join(' ').toLowerCase().includes(q)) return false; return true; });
  }
  function card(t, mode){
    const id=Number(t.id)||0, inf=slaInfo(t), cls=stateClass(inf.state);
    const canPdf=typeof window.ticketDownloadPdfV206==='function'; const canView=typeof window.viewTicketSmartV147==='function'; const canClaim=typeof window.claimTicket==='function'; const canClose=typeof window.closeTicket==='function'; const canSet=typeof window.setTicketStatus==='function';
    const actions=[canView?`<button type="button" onclick="viewTicketSmartV147(${id})">عرض</button>`:'',canPdf?`<button type="button" class="light" onclick="ticketDownloadPdfV206(${id})">PDF</button>`:'',`<button type="button" class="light" onclick="editTicket(${id})">تعديل</button>`,S(t.status)==='closed'?(canSet?`<button type="button" class="light" onclick="setTicketStatus(${id},'open')">إعادة فتح</button>`:''):`${S(t.status)!=='processing'&&canClaim?`<button type="button" class="light" onclick="claimTicket(${id})">استلام</button>`:''}${canClose?`<button type="button" onclick="closeTicket(${id})">إغلاق</button>`:''}`,`<button type="button" class="light" onclick="${typeof window.sendTicketWhatsappV10246==='function'?'sendTicketWhatsappV10246':'sendTicketWhatsApp'}(${id})">واتساب</button>`,mode==='admin'?`<button type="button" class="danger" onclick="deleteRow('tickets',${id})">حذف</button>`:''].filter(Boolean).join(' ');
    return `<article class="smart-ticket-card ticket-sla-card ${cls}" data-ticket-id="${E(id)}"><div class="ticket-sla-strip"><span class="ticket-sla-fill ${cls}" style="width:${inf.pct}%"></span></div><div class="smart-ticket-top"><div><strong>${E(ticketNo(t))}</strong><small>${E(fmtDate(t.created_at||t.updated_at))}</small></div><span class="smart-ticket-status ${S(t.status)==='closed'?'green':S(t.status)==='processing'?'amber':'red'}">${E(statusLabel(t.status))}</span></div><h3>${E(t.title||'-')}</h3><div class="smart-ticket-meta"><span>المشروع: <b>${E(projectOf(t))}</b></span><span>المشرف: <b>${E(supervisorOf(t))}</b></span><span>الأولوية: <b>${E(priorityLabel(t.priority))}</b></span><span>الوقت المحدد: <b>${E(inf.dueH)} س</b></span><span>المدة: <b>${E(durationText(inf.elapsed))}</b></span><span class="ticket-sla-badge ${cls}">${E(inf.label)}</span></div><p>${E(t.description||'لا يوجد وصف')}</p><div class="smart-ticket-mini"><span>المستلم: ${E(recipientOf(t))}</span><span>المغلق: ${E(closedByOf(t))}</span></div>${S(t.closure_note)?`<div class="smart-ticket-note">الحل: ${E(t.closure_note)}</div>`:''}<div class="smart-ticket-actions">${actions}</div></article>`;
  }
  function updateSummary(rows, all, mode){ const box=$(mode==='admin'?'ticketsSmartSummary':'supTicketsSmartSummary'); if(!box) return; const late=rows.filter(t=>slaInfo(t).state==='late').length, near=rows.filter(t=>slaInfo(t).state==='near').length, std=rows.filter(t=>slaInfo(t).state==='standard').length; box.innerHTML=`<div class="ticket-root-v10246-summary"><span class="ticket-root-v10246-kpi">الإجمالي: <b>${all.length}</b></span><span class="ticket-root-v10246-kpi">المعروض: <b>${rows.length}</b></span><span class="ticket-root-v10246-kpi">متأخر: <b>${late}</b></span><span class="ticket-root-v10246-kpi">قارب: <b>${near}</b></span><span class="ticket-root-v10246-kpi">قياسي: <b>${std}</b></span></div>`; }
  async function renderTicketsNew(){
    ensurePanels();
    const adminBody=$('ticketsBody'), supBody=$('supTicketsBody'); if(!adminBody&&!supBody) return;
    let rows=[]; try{ rows=await loadTicketsQuick(); }catch(e){ console.warn(BUILD,e); rows=A(D().tickets); }
    const sort=S($('ticketRootSortV10246')?.value || $('ticketSortOrder')?.value || $('supTicketSortOrder')?.value || 'newest');
    if(adminBody){ let list=filterAdmin(rows); list.sort((a,b)=>sort==='oldest'?dateMs(a)-dateMs(b):dateMs(b)-dateMs(a)); adminBody.classList.add('smart-ticket-grid'); adminBody.innerHTML=list.map(t=>card(t,'admin')).join('') || '<div class="muted" style="padding:16px">لا توجد تكتات مطابقة للفلاتر الحالية</div>'; updateSummary(list,rows,'admin'); }
    if(supBody){ let list=filterSup(rows); list.sort((a,b)=>sort==='oldest'?dateMs(a)-dateMs(b):dateMs(b)-dateMs(a)); supBody.classList.add('smart-ticket-grid'); supBody.innerHTML=list.map(t=>card(t,'sup')).join('') || '<div class="muted" style="padding:16px">لا توجد تكتات مطابقة للفلاتر الحالية</div>'; updateSummary(list,rows,'sup'); }
  }
  async function renderTicketsSafe(){ try{ await renderTicketsNew(); }catch(e){ console.error(BUILD,e); } }
  const oldSave=window.saveTicket;
  window.saveTicket=async function(){
    const projectEl=$('ticketProject'), supEl=$('ticketSupervisor');
    const projectVal=S(projectEl?.value); const user=(typeof window.session==='function'?window.session():null)||{}; const supVal=S(supEl?.value || (user.role==='supervisor'?user.id:''));
    [projectEl,supEl].forEach(el=>el&&el.classList.remove('ticket-sla-missing'));
    const missing=[]; if(!projectVal){ missing.push('المشروع'); if(projectEl) projectEl.classList.add('ticket-sla-missing'); }
    if(!supVal){ missing.push('المشرف'); if(supEl) supEl.classList.add('ticket-sla-missing'); }
    if(missing.length){ notify('لا يمكن رفع التكت. يرجى تحديد: '+missing.join(' و '),'err'); return; }
    if(typeof oldSave==='function') return await oldSave.apply(this,arguments);
  };
  window.renderTickets=renderTicketsNew;
  window.renderTicketsSlaV10364=renderTicketsNew;
  function bindExistingFilters(){ ['ticketFilterStatus','ticketSortOrder','ticketSearch','supTicketFilterProject','supTicketFilterStatus','supTicketSortOrder','supTicketSearch','ticketRootProjectV10246','ticketRootSupervisorV10246','ticketRootTitleV10246','ticketRootStatusV10246','ticketRootSortV10246','ticketRootSearchV10246','ticketRootDateFromV10246','ticketRootDateToV10246'].forEach(id=>{ const el=$(id); if(el&&!el.dataset.slaV10364){ el.dataset.slaV10364='1'; el.addEventListener((el.tagName==='INPUT' && el.type!=='date')?'input':'change',()=>renderTicketsSafe(),true); } }); }
  function boot(){ ensurePanels(); bindExistingFilters(); setTimeout(renderTicketsSafe,150); }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,700)); window.addEventListener('load',()=>setTimeout(boot,1100)); setTimeout(boot,1800);
  console.log('Tasneef '+BUILD+' loaded');
})();


/* ===== V10369: Force current account as ticket responsible/supervisor before save ===== */
(function(){
  'use strict';
  if(window.__tasneefTicketResponsibleFixV10369) return;
  window.__tasneefTicketResponsibleFixV10369 = true;
  const BUILD='V10369_TICKET_RESPONSIBLE_FIX';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  function msgx(t,type){ try{ if(typeof window.msg==='function') return window.msg(t,type||'err'); }catch(_){} try{ if(typeof window.notify==='function') return window.notify(t,type||'err'); }catch(_){} alert(t); }
  function currentUser(){
    try{ if(typeof window.session==='function'){ const u=window.session(); if(u) return u; } }catch(_){ }
    try{ const u=JSON.parse(localStorage.getItem('tasneef_user')||'{}'); if(u && Object.keys(u).length) return u; }catch(_){ }
    return window.currentUser || {};
  }
  function userId(u){ return S(u.id || u.user_id || u.uid || u.employee_id); }
  function userName(u){ return S(u.full_name || u.name || u.display_name || u.username || u.email || userId(u)); }
  function roleOf(u){ return S(u.role || u.user_role || u.type || '').toLowerCase(); }
  function isFieldAccount(u){ const r=roleOf(u); return r.includes('supervisor') || r.includes('technician') || r.includes('مشرف') || r.includes('فني') || r.includes('tech'); }
  function ensureCurrentOption(sel,u){
    if(!sel || !isFieldAccount(u)) return false;
    const uid=userId(u), uname=userName(u);
    if(!uid && !uname) return false;
    let match=null;
    Array.from(sel.options||[]).forEach(opt=>{
      const ov=S(opt.value), ot=S(opt.textContent).toLowerCase();
      if((uid && ov===uid) || (uname && ot===uname.toLowerCase())) match=opt;
    });
    if(!match){
      match=document.createElement('option');
      match.value=uid || uname;
      match.textContent=uname || uid;
      match.dataset.autoCurrentAccount='1';
      sel.appendChild(match);
    }
    sel.value=match.value;
    sel.dataset.autoCurrentAccount='1';
    try{ sel.dispatchEvent(new Event('change',{bubbles:true})); }catch(_){ }
    return !!sel.value;
  }
  function ensureTicketSupervisorField(){
    const u=currentUser();
    let sel=$('ticketSupervisor');
    const formProject=$('ticketProject');
    const hasTicketForm=!!($('ticketFormTitle') && formProject);
    if(!sel && hasTicketForm && isFieldAccount(u)){
      sel=document.createElement('select');
      sel.id='ticketSupervisor';
      sel.name='ticketSupervisor';
      sel.style.display='none';
      formProject.insertAdjacentElement('afterend',sel);
    }
    if(sel && isFieldAccount(u)) ensureCurrentOption(sel,u);
    const display=$('ticketCurrentSupervisorNameV10367') || $('ticketCurrentUserNameV10367');
    if(display) display.value=userName(u) || '-';
    return sel;
  }
  function ensureTechnicianProjectSupervisor(){
    const u=currentUser();
    const projectId=S($('techNewTicketProject')?.value);
    if(!projectId || !isFieldAccount(u)) return;
    const d=window.data || {};
    const projects=Array.isArray(d.projects)?d.projects:[];
    const p=projects.find(x=>S(x.id)===projectId);
    if(p && !S(p.supervisor_id)){
      p.supervisor_id=userId(u) || p.supervisor_id;
      p.supervisor_name=userName(u) || p.supervisor_name;
    }
    const display=$('techCurrentTicketUserNameV10367');
    if(display) display.value=userName(u) || '-';
  }
  function validateTicketBeforeSave(){
    const projectVal=S($('ticketProject')?.value);
    const supVal=S($('ticketSupervisor')?.value);
    if(!projectVal){ msgx('لا يمكن رفع التكت. يرجى تحديد: المشروع','err'); return false; }
    if(!supVal){ msgx('لا يمكن رفع التكت. يرجى تحديد: المشرف','err'); return false; }
    return true;
  }
  const prevSaveTicket=window.saveTicket;
  window.saveTicket=async function(){
    ensureTicketSupervisorField();
    if(!validateTicketBeforeSave()) return;
    return typeof prevSaveTicket==='function' ? await prevSaveTicket.apply(this,arguments) : undefined;
  };
  const prevTechSave=window.saveTechnicianTicket;
  window.saveTechnicianTicket=async function(){
    ensureTechnicianProjectSupervisor();
    return typeof prevTechSave==='function' ? await prevTechSave.apply(this,arguments) : undefined;
  };
  const prevClear=window.clearTicketForm;
  window.clearTicketForm=function(){ const r=typeof prevClear==='function'?prevClear.apply(this,arguments):undefined; setTimeout(ensureTicketSupervisorField,60); return r; };
  function boot(){ ensureTicketSupervisorField(); ensureTechnicianProjectSupervisor(); }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,600));
  window.addEventListener('load',()=>{ setTimeout(boot,800); setTimeout(boot,1800); });
  setInterval(boot,2500);
  console.log('Tasneef '+BUILD+' loaded');
})();

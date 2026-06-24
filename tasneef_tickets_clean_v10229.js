/* Tasneef V10229 - Tickets section clean single source
   Scope: Admin tickets only. No database delete/update except existing user actions (save/edit/delete/claim/close).
   Replaces old ticket render/filter logic with one clean renderer using window.data.tickets. */
(function(){
  'use strict';
  if(window.__tasneefTicketsCleanV10229) return;
  window.__tasneefTicketsCleanV10229 = true;

  const VERSION='V10229';
  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const K = v => S(v).toLowerCase().replace(/\s+/g,' ');
  const E = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const arr = v => Array.isArray(v) ? v : [];
  const d = () => window.data || {};
  const tickets = () => arr(d().tickets);
  const projects = () => arr(d().projects);
  const users = () => arr(d().users || d().app_users);
  const titleOptions = ['صيانة','سباكة','تعطير','تشجير','كهرباء','صواريخ','دفاع مدني','مصاعد'];
  const statusMap = {open:'مفتوح',processing:'تحت المعالجة',closed:'مغلق'};
  const priorityMap = {normal:'عادي',high:'مهم',urgent:'عاجل',low:'منخفض'};

  function lookupProjectName(id){
    if(!S(id)) return '';
    try{ if(typeof window.projectName === 'function'){ const v=S(window.projectName(id)); if(v && v !== '-') return v; } }catch(_){ }
    const p = projects().find(x => String(x.id) === String(id));
    return S(p && (p.name || p.project_name || p.title)) || '';
  }
  function lookupUserName(id){
    if(!S(id)) return '';
    try{ if(typeof window.supervisorName === 'function'){ const v=S(window.supervisorName(id)); if(v && v !== '-') return v; } }catch(_){ }
    const u = users().find(x => String(x.id) === String(id));
    return S(u && (u.full_name || u.name || u.username)) || '';
  }
  function firstText(t, keys){
    for(const k of keys){ const v=S(t && t[k]); if(v && v !== '-') return v; }
    return '';
  }
  function ticketProject(t){
    return firstText(t,['project_name','projectName','project','project_title','project_label']) || lookupProjectName(t.project_id || t.projectId) || '-';
  }
  function ticketSupervisor(t){
    return firstText(t,['supervisor_name','supervisorName','supervisor','supervisor_full_name','assigned_supervisor_name']) || lookupUserName(t.supervisor_id || t.supervisorId) || '-';
  }
  function ticketRecipient(t){
    return firstText(t,[
      'claimed_by_name','claimed_name','claimedByName','claimed_by_user_name','received_by_name','recipient_name','receiver_name','receiver','assigned_to_name','technician_name','handler_name','assignee_name','claimed_by'
    ]) || lookupUserName(t.claimed_by_id || t.claimedById || t.claimed_by || t.assigned_to || t.technician_id) || '-';
  }
  function ticketClosedBy(t){
    return firstText(t,[
      'closed_by_name','closedByName','closed_by_user_name','closed_name','closer_name','closed_by_user','closed_by'
    ]) || lookupUserName(t.closed_by_id || t.closedById || t.closed_by) || '-';
  }
  function projectName(id){ return lookupProjectName(id) || '-'; }
  function supervisorName(id){ return lookupUserName(id) || '-'; }
  function ticketNo(t){
    return S(t.ticket_number || t.ticket_no || t.no) || ('T-' + String(t.id || 0).padStart(4,'0'));
  }
  function dateMs(t){
    const raw = S(t.created_at || t.createdAt || t.date || t.updated_at);
    const ms = raw ? Date.parse(raw) : NaN;
    return isNaN(ms) ? (Number(t.id)||0) : ms;
  }
  function fmtDate(t){
    const raw = S(t.created_at || t.createdAt || t.date || t.updated_at);
    if(!raw) return '-';
    const dt = new Date(raw);
    if(isNaN(dt.getTime())) return raw;
    try { return dt.toLocaleString('ar-SA',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); }
    catch(_) { return raw; }
  }
  function durationText(t){
    const start = Date.parse(t.created_at || t.createdAt || t.date || '');
    const end = t.closed_at ? Date.parse(t.closed_at) : Date.now();
    if(isNaN(start) || isNaN(end)) return '-';
    const mins = Math.max(0, Math.round((end-start)/60000));
    const days = Math.floor(mins/1440), hrs = Math.floor((mins%1440)/60), mm = mins%60;
    if(days) return `${days} يوم ${hrs} س`;
    if(hrs) return `${hrs} س ${mm} د`;
    return `${mm} د`;
  }
  function unique(vals){
    const seen=new Set(), out=[];
    vals.map(S).filter(v=>v && v !== '-').forEach(v=>{ const k=K(v); if(!seen.has(k)){ seen.add(k); out.push(v); } });
    return out.sort((a,b)=>a.localeCompare(b,'ar'));
  }
  function setSelectOptions(id, allLabel, vals, fixed){
    const el=$(id); if(!el) return;
    const old=el.value;
    const list = fixed ? vals : unique(vals);
    el.innerHTML = `<option value="">${E(allLabel)}</option>` + list.map(v=>`<option value="${E(v)}">${E(v)}</option>`).join('');
    if([...el.options].some(o=>o.value===old)) el.value=old;
  }
  function ensureTicketTitleSelect(){
    const sel=$('ticketTitle'); if(!sel) return;
    const old=sel.value;
    sel.innerHTML = '<option value="">اختر نوع المشكلة</option>' + titleOptions.map(v=>`<option value="${E(v)}">${E(v)}</option>`).join('');
    if(titleOptions.includes(old)) sel.value=old;
  }
  function ensureCleanFilters(){
    const body=$('ticketsBody'); if(!body) return;
    let wrap=$('ticketFiltersV10229');
    if(!wrap){
      const card = body.closest('.card') || body.parentElement;
      const old = card && card.querySelector('.filters');
      wrap = document.createElement('div');
      wrap.id='ticketFiltersV10229';
      wrap.className='filters ticket-clean-filters-v10229';
      wrap.innerHTML = `
        <select id="ticketCleanProject"><option value="">كل المشاريع</option></select>
        <select id="ticketCleanSupervisor"><option value="">كل المشرفين</option></select>
        <select id="ticketCleanTitle"><option value="">كل أنواع المشكلة</option></select>
        <select id="ticketCleanStatus"><option value="">كل الحالات</option><option value="open">مفتوح</option><option value="processing">تحت المعالجة</option><option value="closed">مغلق</option></select>
        <select id="ticketCleanClaimed"><option value="">كل المستلمين</option></select>
        <select id="ticketCleanClosedBy"><option value="">كل المغلقين</option></select>
        <select id="ticketCleanSort"><option value="newest">الأحدث أولاً</option><option value="oldest">الأقدم أولاً</option></select>
        <input id="ticketCleanSearch" placeholder="بحث برقم التكت، المشروع، المشرف، المستلم، المغلق، العنوان أو الوصف">
        <small class="ticket-clean-version">${VERSION}</small>`;
      if(old) old.replaceWith(wrap); else card.insertBefore(wrap, $('ticketsSmartSummary') || body);
    }
    ['ticketCleanProject','ticketCleanSupervisor','ticketCleanTitle','ticketCleanStatus','ticketCleanClaimed','ticketCleanClosedBy','ticketCleanSort'].forEach(id=>{
      const el=$(id); if(el && !el.dataset.cleanBound10229){ el.dataset.cleanBound10229='1'; el.addEventListener('change', renderTicketsClean, true); }
    });
    const q=$('ticketCleanSearch');
    if(q && !q.dataset.cleanBound10229){ q.dataset.cleanBound10229='1'; q.addEventListener('input', renderTicketsClean, true); }
  }
  function domCardValues(label){
    // احتياط قوي: لو البيانات القديمة ناقصة، نقرأ القيم من كروت التكتات الظاهرة نفسها.
    const vals=[];
    document.querySelectorAll('#ticketsBody .smart-ticket-card').forEach(card=>{
      const txt=card.innerText || '';
      const re=new RegExp(label+'\\s*[:：]\\s*([^\\n\\r]+)','i');
      const m=txt.match(re);
      if(m && S(m[1])) vals.push(S(m[1]));
    });
    return vals;
  }
  function populateFilterOptions(){
    const rows=tickets();
    setSelectOptions('ticketCleanProject','كل المشاريع', rows.map(ticketProject).concat(domCardValues('المشروع')));
    setSelectOptions('ticketCleanSupervisor','كل المشرفين', rows.map(ticketSupervisor).concat(domCardValues('المشرف')));
    setSelectOptions('ticketCleanTitle','كل أنواع المشكلة', titleOptions.concat(rows.map(t=>t.title || t.problem_type || t.category)).concat(domCardValues('العنوان')), false);
    setSelectOptions('ticketCleanClaimed','كل المستلمين', rows.map(ticketRecipient).concat(domCardValues('المستلم')));
    setSelectOptions('ticketCleanClosedBy','كل المغلقين', rows.map(ticketClosedBy).concat(domCardValues('المغلق')));
  }
  function filters(){
    return {
      project: K($('ticketCleanProject')?.value),
      supervisor: K($('ticketCleanSupervisor')?.value),
      title: K($('ticketCleanTitle')?.value),
      status: S($('ticketCleanStatus')?.value),
      claimed: K($('ticketCleanClaimed')?.value),
      closed: K($('ticketCleanClosedBy')?.value),
      sort: S($('ticketCleanSort')?.value || 'newest'),
      search: K($('ticketCleanSearch')?.value)
    };
  }
  function statusLabel(s){ return statusMap[S(s)] || S(s) || '-'; }
  function priorityLabel(p){ return priorityMap[S(p)] || S(p) || '-'; }
  function statusClass(s){ return S(s)==='closed'?'green':S(s)==='processing'?'amber':'red'; }
  function priorityClass(p){ return S(p)==='urgent'||S(p)==='high'?'red':S(p)==='low'?'green':'amber'; }
  function cardText(t){
    return [ticketNo(t), t.title, t.description, ticketProject(t), ticketSupervisor(t), statusLabel(t.status), priorityLabel(t.priority), ticketRecipient(t), ticketClosedBy(t), t.closure_note].join(' ');
  }
  function match(t,f){
    if(f.project && K(ticketProject(t)) !== f.project) return false;
    if(f.supervisor && K(ticketSupervisor(t)) !== f.supervisor) return false;
    if(f.title && K(t.title) !== f.title) return false;
    if(f.status && S(t.status || 'open') !== f.status) return false;
    if(f.claimed && K(ticketRecipient(t)) !== f.claimed) return false;
    if(f.closed && K(ticketClosedBy(t)) !== f.closed) return false;
    if(f.search && !K(cardText(t)).includes(f.search)) return false;
    return true;
  }
  function whatsAppMessage(t){
    return ['تكت صيانة', '', 'رقم التكت: '+ticketNo(t), 'المشروع: '+ticketProject(t), 'المشرف: '+ticketSupervisor(t), 'العنوان: '+S(t.title||'-'), 'الوصف: '+S(t.description||'-'), 'الحالة: '+statusLabel(t.status), 'المستلم: '+S(ticketRecipient(t)), 'المغلق: '+S(ticketClosedBy(t))].join('\n');
  }
  function sendTicketWhatsappV10229(id){
    const t=tickets().find(x=>String(x.id)===String(id));
    if(!t) return alert('لم يتم العثور على التكت');
    window.open('https://wa.me/?text='+encodeURIComponent(whatsAppMessage(t)),'_blank','noopener');
  }
  window.sendTicketWhatsappV10229 = sendTicketWhatsappV10229;
  function ticketCard(t){
    const id=Number(t.id)||0;
    const canPdf = typeof window.ticketDownloadPdfV206 === 'function';
    const canView = typeof window.viewTicketSmartV147 === 'function';
    const canClaim = typeof window.claimTicket === 'function';
    const canClose = typeof window.closeTicket === 'function';
    const canSet = typeof window.setTicketStatus === 'function';
    const actions = [
      canView ? `<button type="button" onclick="viewTicketSmartV147(${id})">عرض</button>` : '',
      canPdf ? `<button type="button" class="light" onclick="ticketDownloadPdfV206(${id})">PDF</button>` : '',
      `<button type="button" class="light" onclick="editTicket(${id})">تعديل</button>`,
      S(t.status)==='closed'
        ? (canSet ? `<button type="button" class="light" onclick="setTicketStatus(${id},'open')">إعادة فتح</button>` : '')
        : `${S(t.status)!=='processing' && canClaim ? `<button type="button" class="light" onclick="claimTicket(${id})">استلام</button>` : ''}${canClose ? `<button type="button" onclick="closeTicket(${id})">إغلاق</button>` : ''}`,
      `<button type="button" class="light" onclick="sendTicketWhatsappV10229(${id})">إرسال واتساب</button>`,
      `<button type="button" class="danger" onclick="deleteRow('tickets',${id})">حذف</button>`
    ].filter(Boolean).join(' ');
    return `<article class="smart-ticket-card ticket-clean-card-v10229 ${statusClass(t.status)}" data-ticket-id="${E(id)}">
      <div class="smart-ticket-top"><div><strong>${E(ticketNo(t))}</strong><small>${E(fmtDate(t))}</small></div><span class="smart-ticket-status ${statusClass(t.status)}">${E(statusLabel(t.status))}</span></div>
      <h3>${E(t.title || '-')}</h3>
      <div class="smart-ticket-meta"><span>المشروع: <b>${E(ticketProject(t))}</b></span><span>المشرف: <b>${E(ticketSupervisor(t))}</b></span><span>الأولوية: <b>${E(priorityLabel(t.priority))}</b></span><span>مدة الفتح: <b>${E(durationText(t))}</b></span></div>
      <p>${E(t.description || 'لا يوجد وصف')}</p>
      <div class="smart-ticket-mini"><span>المستلم: ${E(ticketRecipient(t))}</span><span>المغلق: ${E(ticketClosedBy(t))}</span></div>
      ${t.closure_note ? `<div class="smart-ticket-note">الحل: ${E(t.closure_note)}</div>` : ''}
      <div class="smart-ticket-actions">${actions}</div>
    </article>`;
  }
  function updateSummary(rows){
    const box=$('ticketsSmartSummary'); if(!box) return;
    const total=rows.length, open=rows.filter(t=>S(t.status||'open')==='open').length, proc=rows.filter(t=>S(t.status)==='processing').length, closed=rows.filter(t=>S(t.status)==='closed').length;
    box.innerHTML = `<div class="ticket-clean-summary-v10229"><span class="ticket-root-v10225-kpi">الإجمالي: <b>${total}</b></span><span class="ticket-root-v10225-kpi">مفتوح: <b>${open}</b></span><span class="ticket-root-v10225-kpi">تحت المعالجة: <b>${proc}</b></span><span class="ticket-root-v10225-kpi">مغلق: <b>${closed}</b></span></div>`;
  }
  function addStyle(){
    if($('ticketCleanV10229Style')) return;
    const st=document.createElement('style'); st.id='ticketCleanV10229Style';
    st.textContent = `
      .ticket-clean-filters-v10229{display:grid!important;grid-template-columns:repeat(2,minmax(170px,1fr));gap:8px!important;margin:10px 0 14px!important}
      .ticket-clean-filters-v10229 select,.ticket-clean-filters-v10229 input{width:100%!important;color:#062f26!important;background:#fff!important;border:1px solid #cfe2dc!important;border-radius:10px!important;padding:10px!important}
      .ticket-clean-filters-v10229 option{color:#111!important;background:#fff!important}
      .ticket-clean-version{color:#0b5d49;font-weight:800;align-self:center}
      .ticket-clean-summary-v10229{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin:10px 0}
      @media(max-width:800px){.ticket-clean-filters-v10229{grid-template-columns:1fr!important}}
    `;
    document.head.appendChild(st);
  }
  function renderTicketsClean(){
    const body=$('ticketsBody'); if(!body) return;
    addStyle(); ensureTicketTitleSelect(); ensureCleanFilters(); populateFilterOptions();
    const f=filters();
    let rows=tickets().filter(t=>match(t,f));
    rows.sort((a,b)=> f.sort==='oldest' ? dateMs(a)-dateMs(b) : dateMs(b)-dateMs(a));
    body.classList.add('smart-ticket-grid');
    body.innerHTML = rows.map(ticketCard).join('') || '<div class="muted" style="padding:16px">لا توجد تكتات مطابقة للفلاتر الحالية</div>';
    updateSummary(rows);
  }
  window.renderTickets = renderTicketsClean;
  window.renderTicketsCleanV10229 = renderTicketsClean;
  function boot(){ addStyle(); ensureTicketTitleSelect(); ensureCleanFilters(); populateFilterOptions(); renderTicketsClean(); }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,700));
  window.addEventListener('load',()=>[300,900,1800,3500].forEach(ms=>setTimeout(boot,ms)));
})();

/* Tasneef Tickets + Orders Filters Patch v10032
   - Adds/ensures orders concern filter (تخص العميل / تخص الجمعية) without changing orders logic.
   - Converts ticket title to dropdown problem type.
   - Adds ticket filters: supervisor, problem type, receiver, creator, closer.
   - Saves created_by_name for the account creating tickets.
*/
(function(){
  'use strict';
  if(window.__tasneefTicketsOrdersFiltersV10032) return;
  window.__tasneefTicketsOrdersFiltersV10032 = true;

  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const A = v => Array.isArray(v) ? v : [];
  const esc = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const PROBLEM_TYPES = ['صيانة','سباكة','تعطير','تشجير','كهرباء','صهاريج','دفاع مدني','مصاعد'];

  function currentUser(){
    try{ if(typeof window.session === 'function') return window.session() || {}; }catch(_){ }
    try{ return JSON.parse(localStorage.getItem('tasneef_user') || 'null') || {}; }catch(_){ return {}; }
  }
  function currentNamePatch(){
    const u = currentUser();
    return S(u.full_name || u.name || u.username || u.email || u.role || 'غير محدد');
  }
  function users(){ return A(window.data && window.data.users); }
  function projects(){ return A(window.data && window.data.projects); }
  function tickets(){ return A(window.data && window.data.tickets); }
  function userName(id){
    const u = users().find(x => String(x.id) === String(id));
    return S(u && (u.full_name || u.name || u.username || u.email)) || '';
  }
  function projectName2(id){
    try{ if(typeof window.projectName === 'function') return window.projectName(id) || ''; }catch(_){ }
    const p = projects().find(x => String(x.id) === String(id));
    return S(p && (p.name || p.project_name)) || '';
  }
  function supervisorName2(id){
    try{ if(typeof window.supervisorName === 'function') return window.supervisorName(id) || ''; }catch(_){ }
    return userName(id);
  }
  function ticketNo2(t){
    try{ if(typeof window.ticketNo === 'function') return window.ticketNo(t); }catch(_){ }
    return S(t.ticket_number || ('T-' + String(t.id || '').padStart(4,'0')));
  }
  function fmtDate(v){
    try{ return v ? new Date(v).toLocaleString('ar-SA') : '-'; }catch(_){ return S(v)||'-'; }
  }
  function statusLabel(v){
    const m = {open:'مفتوح', processing:'تحت المعالجة', closed:'مغلق'};
    return m[S(v)] || S(v) || '-';
  }
  function priorityLabel(v){
    const m = {urgent:'عاجل', high:'مهم', normal:'عادي', low:'منخفض'};
    return m[S(v)] || S(v) || 'عادي';
  }
  function statusClass(v){
    v=S(v);
    if(v==='closed') return 'done';
    if(v==='processing') return 'doing';
    return 'open';
  }
  function peopleFromTickets(fieldA, fieldB){
    const set = new Map();
    tickets().forEach(t=>{
      const name = S(t[fieldA]) || (fieldB ? userName(t[fieldB]) : '');
      if(name) set.set(name, name);
    });
    return Array.from(set.values()).sort((a,b)=>a.localeCompare(b,'ar'));
  }
  function supervisorsList(){
    const map = new Map();
    users().forEach(u=>{
      const role = S(u.role);
      if(['supervisor','manager','operational_manager','admin','general_manager','مشرف','مدير تشغيلي','مدير عام','مدير النظام'].includes(role)){
        map.set(String(u.id), S(u.full_name || u.name || u.username || u.email || u.id));
      }
    });
    tickets().forEach(t=>{
      const n = supervisorName2(t.supervisor_id);
      if(n && t.supervisor_id) map.set(String(t.supervisor_id), n);
    });
    return Array.from(map.entries()).map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  }
  function optionHtml(rows, selected){
    return rows.map(x=>`<option value="${esc(x)}" ${S(selected)===S(x)?'selected':''}>${esc(x)}</option>`).join('');
  }

  function ensureOrderConcernFilter(){
    // v10031 already has this filter. This is a safety fallback only.
    if($('orderConcernFilterV10031') || $('orderConcernFilterV10032')) return;
    const filters = document.querySelector('#orders .orders-filters-v233') || document.querySelector('#orders .filters');
    if(!filters) return;
    const wrap = document.createElement('div');
    wrap.id = 'orderConcernFilterWrapV10032';
    wrap.innerHTML = '<label>تخص</label><select id="orderConcernFilterV10032"><option value="">الكل</option><option value="client">تخص العميل</option><option value="association">تخص الجمعية</option></select>';
    filters.appendChild(wrap);
    const el = $('orderConcernFilterV10032');
    el.addEventListener('change', ()=>{ try{ if(typeof window.renderOrdersV233==='function') window.renderOrdersV233(); }catch(_){} });
  }

  function ensureTicketTitleDropdown(){
    const current = $('ticketTitle');
    if(!current || current.tagName === 'SELECT') return;
    const value = S(current.value);
    const sel = document.createElement('select');
    sel.id = 'ticketTitle';
    sel.innerHTML = '<option value="">اختر نوع المشكلة</option>' + PROBLEM_TYPES.map(v=>`<option value="${esc(v)}" ${value===v?'selected':''}>${esc(v)}</option>`).join('');
    current.replaceWith(sel);
  }

  function fillTicketFilterOptions(){
    const sSel = $('ticketFilterSupervisorV10032');
    if(sSel){
      const val = sSel.value;
      sSel.innerHTML = '<option value="">كل المشرفين</option>' + supervisorsList().map(s=>`<option value="${esc(s.id)}" ${S(val)===S(s.id)?'selected':''}>${esc(s.name)}</option>`).join('');
    }
    const typeSel = $('ticketFilterProblemTypeV10032');
    if(typeSel){
      const val = typeSel.value;
      typeSel.innerHTML = '<option value="">كل أنواع المشكلة</option>' + PROBLEM_TYPES.map(t=>`<option value="${esc(t)}" ${S(val)===S(t)?'selected':''}>${esc(t)}</option>`).join('');
    }
    const recSel = $('ticketFilterReceiverV10032');
    if(recSel){
      const val = recSel.value;
      recSel.innerHTML = '<option value="">كل المستلمين</option>' + optionHtml(peopleFromTickets('claimed_by_name','claimed_by'), val);
    }
    const createdSel = $('ticketFilterCreatorV10032');
    if(createdSel){
      const val = createdSel.value;
      const names = new Map();
      tickets().forEach(t=>{ const n = S(t.created_by_name) || userName(t.created_by); if(n) names.set(n,n); });
      createdSel.innerHTML = '<option value="">كل المنشئين</option>' + optionHtml(Array.from(names.values()).sort((a,b)=>a.localeCompare(b,'ar')), val);
    }
    const closedSel = $('ticketFilterCloserV10032');
    if(closedSel){
      const val = closedSel.value;
      closedSel.innerHTML = '<option value="">كل المغلقين</option>' + optionHtml(peopleFromTickets('closed_by_name','closed_by'), val);
    }
  }

  function ensureTicketFilters(){
    const filters = document.querySelector('#tickets .filters');
    if(filters && !$('ticketFilterProblemTypeV10032')){
      const html = `
        <select id="ticketFilterSupervisorV10032" onchange="renderTickets()"><option value="">كل المشرفين</option></select>
        <select id="ticketFilterProblemTypeV10032" onchange="renderTickets()"><option value="">كل أنواع المشكلة</option></select>
        <select id="ticketFilterReceiverV10032" onchange="renderTickets()"><option value="">كل المستلمين</option></select>
        <select id="ticketFilterCreatorV10032" onchange="renderTickets()"><option value="">كل المنشئين</option></select>
        <select id="ticketFilterCloserV10032" onchange="renderTickets()"><option value="">كل المغلقين</option></select>
      `;
      filters.insertAdjacentHTML('beforeend', html);
    }
    fillTicketFilterOptions();
  }

  function ensureCss(){
    if($('ticketOrdersFiltersV10032Style')) return;
    const st = document.createElement('style');
    st.id = 'ticketOrdersFiltersV10032Style';
    st.textContent = `
      #tickets .filters{display:flex;flex-wrap:wrap;gap:8px;align-items:end}
      #tickets .filters select,#tickets .filters input{min-width:145px}
      .ticket-card-v10032{background:#fff;border:1px solid #e5ece7;border-radius:20px;padding:15px;box-shadow:0 10px 26px rgba(0,0,0,.06);position:relative;overflow:hidden;display:grid;gap:10px}
      .ticket-card-v10032:before{content:"";position:absolute;inset-inline-start:0;top:0;bottom:0;width:5px;background:#174d35}.ticket-card-v10032.open:before{background:#b83232}.ticket-card-v10032.doing:before{background:#d69e2e}.ticket-card-v10032.done:before{background:#138a4b}
      .ticket-head-v10032{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.ticket-head-v10032 h3{margin:4px 0 0;color:#123b2a;font-size:17px}.ticket-head-v10032 small{color:#728178}.ticket-status-v10032{border-radius:999px;padding:5px 10px;font-size:12px;font-weight:800;white-space:nowrap}.ticket-status-v10032.open{background:#fde8e8;color:#9b1c1c}.ticket-status-v10032.doing{background:#fff7db;color:#8a5a00}.ticket-status-v10032.done{background:#e5f7ec;color:#116c3b}
      .ticket-meta-v10032{display:grid;grid-template-columns:1fr 1fr;gap:7px}.ticket-meta-v10032 span{background:#f7faf8;border:1px solid #edf3ef;border-radius:12px;padding:8px;font-size:12px;color:#394940}.ticket-meta-v10032 b{display:block;color:#123b2a;margin-top:3px}.ticket-desc-v10032{background:#fbfdfc;border:1px dashed #d8e8e2;border-radius:12px;padding:9px;line-height:1.65;color:#43534c;min-height:42px}.ticket-actions-v10032{display:flex;flex-wrap:wrap;gap:6px}.ticket-actions-v10032 button{padding:8px 10px;border-radius:11px}.ticket-empty-v10032{grid-column:1/-1;text-align:center;background:#fff;border-radius:16px;padding:25px;color:#6b7d74;border:1px dashed #d3ded8}
      @media(max-width:800px){.ticket-meta-v10032{grid-template-columns:1fr}}
    `;
    document.head.appendChild(st);
  }

  function passTicketFilters(t){
    const st = S($('ticketFilterStatus') && $('ticketFilterStatus').value);
    const q = S($('ticketSearch') && $('ticketSearch').value).toLowerCase();
    const sup = S($('ticketFilterSupervisorV10032') && $('ticketFilterSupervisorV10032').value);
    const typ = S($('ticketFilterProblemTypeV10032') && $('ticketFilterProblemTypeV10032').value);
    const rec = S($('ticketFilterReceiverV10032') && $('ticketFilterReceiverV10032').value);
    const cre = S($('ticketFilterCreatorV10032') && $('ticketFilterCreatorV10032').value);
    const clo = S($('ticketFilterCloserV10032') && $('ticketFilterCloserV10032').value);
    const creator = S(t.created_by_name) || userName(t.created_by);
    const receiver = S(t.claimed_by_name) || userName(t.claimed_by);
    const closer = S(t.closed_by_name) || userName(t.closed_by);
    if(st && S(t.status) !== st) return false;
    if(sup && S(t.supervisor_id) !== sup) return false;
    if(typ && S(t.title) !== typ) return false;
    if(rec && receiver !== rec) return false;
    if(cre && creator !== cre) return false;
    if(clo && closer !== clo) return false;
    if(q){
      const hay = [ticketNo2(t),t.title,t.description,projectName2(t.project_id),supervisorName2(t.supervisor_id),statusLabel(t.status),priorityLabel(t.priority),receiver,creator,closer,t.closure_note].map(S).join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  }

  function ticketCard(t){
    const creator = S(t.created_by_name) || userName(t.created_by) || '-';
    const receiver = S(t.claimed_by_name) || userName(t.claimed_by) || '-';
    const closer = S(t.closed_by_name) || userName(t.closed_by) || '-';
    const cls = statusClass(t.status);
    const closed = S(t.status)==='closed';
    const processing = S(t.status)==='processing';
    const id = Number(t.id)||0;
    return `<article class="ticket-card-v10032 ${cls}">
      <div class="ticket-head-v10032"><div><small>${esc(ticketNo2(t))}</small><h3>${esc(t.title||'-')}</h3></div><span class="ticket-status-v10032 ${cls}">${esc(statusLabel(t.status))}</span></div>
      <div class="ticket-meta-v10032">
        <span>المشروع<b>${esc(projectName2(t.project_id)||'-')}</b></span>
        <span>المشرف<b>${esc(supervisorName2(t.supervisor_id)||'-')}</b></span>
        <span>نوع المشكلة<b>${esc(t.title||'-')}</b></span>
        <span>الأولوية<b>${esc(priorityLabel(t.priority))}</b></span>
        <span>المنشئ<b>${esc(creator)}</b></span>
        <span>المستلم<b>${esc(receiver)}</b></span>
        <span>المغلق<b>${esc(closer)}</b></span>
        <span>تاريخ الإنشاء<b>${esc(fmtDate(t.created_at))}</b></span>
      </div>
      <div class="ticket-desc-v10032">${esc(t.description||'لا يوجد وصف')}</div>
      ${t.closure_note?`<div class="ticket-desc-v10032"><b>طريقة الإغلاق:</b><br>${esc(t.closure_note)}</div>`:''}
      <div class="ticket-actions-v10032">
        <button onclick="editTicket(${id})">تعديل</button>
        ${closed?`<button class="light" onclick="setTicketStatus(${id},'open')">إعادة فتح</button>`:`${!processing?`<button class="light" onclick="claimTicket(${id})">استلام</button>`:''}<button onclick="closeTicket(${id})">إغلاق</button>`}
        ${typeof window.sendTicketWhatsAppV43 === 'function' ? `<button class="light" onclick="sendTicketWhatsAppV43(${id})">واتساب</button>` : ''}
        <button class="danger" onclick="deleteRow('tickets',${id})">حذف</button>
      </div>
    </article>`;
  }

  function renderTicketsV10032(){
    ensureCss(); ensureTicketTitleDropdown(); ensureTicketFilters();
    const body = $('ticketsBody');
    if(!body) return;
    const list = tickets().filter(passTicketFilters);
    const total = tickets().length;
    const open = list.filter(t=>S(t.status)==='open').length;
    const proc = list.filter(t=>S(t.status)==='processing').length;
    const closed = list.filter(t=>S(t.status)==='closed').length;
    const summary = $('ticketsSmartSummary');
    if(summary){
      summary.innerHTML = `
        <div class="smart-ticket-kpi"><span>النتائج</span><b>${list.length}</b></div>
        <div class="smart-ticket-kpi red"><span>مفتوح</span><b>${open}</b></div>
        <div class="smart-ticket-kpi amber"><span>تحت المعالجة</span><b>${proc}</b></div>
        <div class="smart-ticket-kpi green"><span>مغلق</span><b>${closed}</b></div>
        <div class="smart-ticket-kpi"><span>إجمالي التكتات</span><b>${total}</b></div>
      `;
    }
    body.classList.add('smart-ticket-grid');
    body.innerHTML = list.map(ticketCard).join('') || '<div class="ticket-empty-v10032">لا توجد تكتات حسب الفلاتر الحالية</div>';
  }

  async function saveTicketV10032(){
    const u = currentUser();
    if(!u || !u.id) return (typeof window.msg==='function' ? window.msg('سجّل الدخول أولاً','err') : alert('سجّل الدخول أولاً'));
    const title = S($('ticketTitle') && $('ticketTitle').value);
    if(!title) return (typeof window.msg==='function' ? window.msg('عنوان التكت مطلوب','err') : alert('عنوان التكت مطلوب'));
    if(!window.sb) return alert('الاتصال غير جاهز');
    const status = S($('ticketStatus') && $('ticketStatus').value) || 'open';
    const id = S($('ticketId') && $('ticketId').value);
    const now = new Date().toISOString();
    const existing = id ? tickets().find(x=>String(x.id)===String(id)) : null;
    const row = {
      project_id: Number($('ticketProject') && $('ticketProject').value) || null,
      supervisor_id: Number(($('ticketSupervisor') && $('ticketSupervisor').value) || (S(u.role)==='supervisor' ? u.id : '')) || null,
      title,
      description: ($('ticketDescription') && $('ticketDescription').value) || '',
      priority: S($('ticketPriority') && $('ticketPriority').value) || 'normal',
      status,
      updated_at: now
    };
    if(!id){ row.created_by = u.id; row.created_by_name = currentNamePatch(); }
    else if(existing && !S(existing.created_by_name)){ row.created_by_name = userName(existing.created_by) || currentNamePatch(); }
    if(status === 'closed'){
      const note = S($('ticketClosureNote') && $('ticketClosureNote').value) || prompt('كيف تم إغلاق التكت؟\nاكتب طريقة الحل أو الإجراء المنفذ','') || '';
      if(!S(note)) return (typeof window.msg==='function' ? window.msg('لا يمكن إغلاق التكت بدون ذكر كيف تم الإغلاق','err') : alert('لا يمكن إغلاق التكت بدون ذكر كيف تم الإغلاق'));
      const closer = S($('ticketClosedByName') && $('ticketClosedByName').value) || currentNamePatch();
      row.closed_at = now; row.closed_by = u.id; row.closed_by_name = closer; row.closure_note = note;
      if(existing && !existing.claimed_at){ row.claimed_by = u.id; row.claimed_by_name = closer; row.claimed_at = now; }
    }else{
      row.closed_at = null; row.closed_by = null; row.closed_by_name = null; row.closure_note = null;
    }
    const req = id ? await sb.from('tickets').update(row).eq('id', id).select('*').maybeSingle() : await sb.from('tickets').insert(row).select('*').single();
    if(req.error) return (typeof window.msg==='function' ? window.msg(req.error.message,'err') : alert(req.error.message));
    if(!id && req.data && !req.data.ticket_number){
      const tn = 'T-' + String(req.data.id).padStart(4,'0');
      await sb.from('tickets').update({ticket_number:tn}).eq('id', req.data.id);
    }
    try{ if(typeof window.playAppSound==='function') window.playAppSound('ticket'); }catch(_){ }
    if(typeof window.msg==='function') window.msg(id?'تم تحديث التكت':'تم حفظ التكت');
    try{ if(typeof window.clearTicketForm==='function') window.clearTicketForm(); }catch(_){ }
    if(S(u.role)==='supervisor' && typeof window.initSupervisor==='function') await window.initSupervisor();
    else if(typeof window.refreshAll==='function') await window.refreshAll();
    renderTicketsV10032();
  }

  function patchClearAndEdit(){
    const oldClear = window.clearTicketForm;
    window.clearTicketForm = function(){
      if(typeof oldClear === 'function') oldClear.apply(this, arguments);
      setTimeout(()=>{ ensureTicketTitleDropdown(); if($('ticketTitle')) $('ticketTitle').value=''; }, 20);
    };
    const oldEdit = window.editTicket;
    window.editTicket = function(id){
      if(typeof oldEdit === 'function') oldEdit.apply(this, arguments);
      setTimeout(()=>{ ensureTicketTitleDropdown(); const t=tickets().find(x=>String(x.id)===String(id)); if(t && $('ticketTitle')) $('ticketTitle').value=S(t.title); }, 30);
    };
  }

  function boot(){
    ensureCss();
    ensureOrderConcernFilter();
    ensureTicketTitleDropdown();
    ensureTicketFilters();
    window.saveTicket = saveTicketV10032;
    window.renderTickets = renderTicketsV10032;
    patchClearAndEdit();
    setTimeout(()=>{ ensureOrderConcernFilter(); ensureTicketTitleDropdown(); ensureTicketFilters(); try{ renderTicketsV10032(); }catch(_){} }, 500);
    setTimeout(()=>{ ensureOrderConcernFilter(); ensureTicketTitleDropdown(); ensureTicketFilters(); try{ renderTicketsV10032(); }catch(_){} }, 1500);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('load', boot);
})();

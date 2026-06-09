/* Tasneef Tickets Filters Exact Stable v10041
   إصلاح نهائي للفلاتر: المشرف، نوع المشكلة، المستلم، المنشئ، المغلق + عنوان التكت كقائمة.
*/
(function(){
  'use strict';
  if(window.__tasneefTicketsFiltersExactV10041) return;
  window.__tasneefTicketsFiltersExactV10041 = true;

  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const A = v => Array.isArray(v) ? v : [];
  const esc = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const PROBLEM_TYPES = ['صيانة','سباكة','تعطير','تشجير','كهرباء','صهاريج','دفاع مدني','مصاعد'];

  function currentUser(){ try{ if(typeof window.session==='function') return window.session() || {}; }catch(_){} try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};} }
  function currentUserName(){ const u=currentUser(); return S(u.full_name||u.name||u.username||u.email||u.role||'غير محدد'); }
  function data(){ return window.data || {}; }
  function users(){ return A(data().users); }
  function projects(){ return A(data().projects); }
  function tickets(){ return A(data().tickets); }
  function userName(id){ const u=users().find(x=>String(x.id)===String(id)); return S(u&&(u.full_name||u.name||u.username||u.email||u.id)); }
  function projectName(id){ try{ if(typeof window.projectName==='function') return window.projectName(id)||''; }catch(_){} const p=projects().find(x=>String(x.id)===String(id)); return S(p&&(p.name||p.project_name||p.id)); }
  function supervisorName(id){ try{ if(typeof window.supervisorName==='function') return window.supervisorName(id)||''; }catch(_){} return userName(id); }
  function ticketNo(t){ try{ if(typeof window.ticketNo==='function') return window.ticketNo(t)||''; }catch(_){} return S(t.ticket_number||('T-'+String(t.id||'').padStart(4,'0'))); }
  function statusLabel(v){ return ({open:'مفتوح',processing:'تحت المعالجة',closed:'مغلق'}[S(v)] || S(v)||'-'); }
  function priorityLabel(v){ return ({urgent:'عاجل',high:'مهم',normal:'عادي',low:'منخفض'}[S(v)] || S(v)||'عادي'); }
  function statusClass(v){ v=S(v); return v==='closed'?'done':(v==='processing'?'doing':'open'); }
  function fmt(v){ try{return v?new Date(v).toLocaleString('ar-SA'):'-';}catch(_){return S(v)||'-';} }
  function creatorName(t){ return S(t.created_by_name||t.creator_name) || userName(t.created_by||t.created_by_id) || 'غير محدد'; }
  function receiverName(t){ return S(t.claimed_by_name||t.receiver_name||t.assigned_to_name||t.received_by_name) || userName(t.claimed_by||t.receiver_id||t.assigned_to||t.received_by) || ''; }
  function closerName(t){ return S(t.closed_by_name||t.closer_name||t.ticketClosedByName) || userName(t.closed_by||t.closer_id) || ''; }
  function unique(arr){ return Array.from(new Set(arr.map(S).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'ar')); }
  function supervisors(){
    const rows=[];
    users().forEach(u=>{ const nm=S(u.full_name||u.name||u.username||u.email||u.id); if(nm) rows.push({value:String(u.id), label:nm}); });
    tickets().forEach(t=>{ const nm=supervisorName(t.supervisor_id); if(nm && t.supervisor_id) rows.push({value:String(t.supervisor_id), label:nm}); });
    const seen=new Map(); rows.forEach(r=>{ if(!seen.has(r.value)) seen.set(r.value,r); });
    return Array.from(seen.values()).sort((a,b)=>a.label.localeCompare(b.label,'ar'));
  }

  function titleDropdown(){
    const cur=$('ticketTitle'); if(!cur || cur.tagName==='SELECT') return;
    const val=S(cur.value); const sel=document.createElement('select'); sel.id='ticketTitle';
    sel.innerHTML='<option value="">اختر نوع المشكلة</option>'+PROBLEM_TYPES.map(x=>`<option value="${esc(x)}" ${val===x?'selected':''}>${esc(x)}</option>`).join('');
    cur.replaceWith(sel);
  }

  function ensureFilters(){
    const box=document.querySelector('#tickets .filters'); if(!box) return;
    const make=(id, html)=>{ if(!$(id)) box.insertAdjacentHTML('beforeend', html); };
    make('ticketFilterSupervisorV10041','<select id="ticketFilterSupervisorV10041"><option value="">كل المشرفين</option></select>');
    make('ticketFilterProblemTypeV10041','<select id="ticketFilterProblemTypeV10041"><option value="">كل أنواع المشكلة</option></select>');
    make('ticketFilterReceiverV10041','<select id="ticketFilterReceiverV10041"><option value="">كل المستلمين</option></select>');
    make('ticketFilterCreatorV10041','<select id="ticketFilterCreatorV10041"><option value="">كل المنشئين</option></select>');
    make('ticketFilterCloserV10041','<select id="ticketFilterCloserV10041"><option value="">كل المغلقين</option></select>');
    fillOptions(); bindFilters();
  }
  function setOpts(id, label, rows, val){ const el=$(id); if(!el) return; const current=val ?? el.value; el.innerHTML=`<option value="">${label}</option>`+rows.map(r=> typeof r==='string'?`<option value="${esc(r)}" ${S(current)===S(r)?'selected':''}>${esc(r)}</option>`:`<option value="${esc(r.value)}" ${S(current)===S(r.value)?'selected':''}>${esc(r.label)}</option>`).join(''); if(current) el.value=current; }
  function fillOptions(){
    setOpts('ticketFilterSupervisorV10041','كل المشرفين',supervisors());
    setOpts('ticketFilterProblemTypeV10041','كل أنواع المشكلة',PROBLEM_TYPES);
    setOpts('ticketFilterReceiverV10041','كل المستلمين',unique(tickets().map(receiverName)));
    setOpts('ticketFilterCreatorV10041','كل المنشئين',unique(tickets().map(creatorName)));
    setOpts('ticketFilterCloserV10041','كل المغلقين',unique(tickets().map(closerName)));
  }
  function bindFilters(){
    ['ticketFilterStatus','ticketSearch','ticketFilterSupervisorV10041','ticketFilterProblemTypeV10041','ticketFilterReceiverV10041','ticketFilterCreatorV10041','ticketFilterCloserV10041'].forEach(id=>{
      const el=$(id); if(!el || el.__ticketsV10041) return; el.__ticketsV10041=true;
      const fn=()=>{ window.renderTickets(); };
      el.addEventListener('input', fn); el.addEventListener('change', fn);
    });
  }

  function pass(t){
    const st=S($('ticketFilterStatus')?.value);
    const q=S($('ticketSearch')?.value).toLowerCase();
    const sup=S($('ticketFilterSupervisorV10041')?.value);
    const type=S($('ticketFilterProblemTypeV10041')?.value);
    const rec=S($('ticketFilterReceiverV10041')?.value);
    const cre=S($('ticketFilterCreatorV10041')?.value);
    const clo=S($('ticketFilterCloserV10041')?.value);
    if(st && S(t.status)!==st) return false;
    if(sup && S(t.supervisor_id)!==sup && supervisorName(t.supervisor_id)!==sup) return false;
    if(type && S(t.title)!==type) return false;
    if(rec && receiverName(t)!==rec) return false;
    if(cre && creatorName(t)!==cre) return false;
    if(clo && closerName(t)!==clo) return false;
    if(q){
      const hay=[ticketNo(t),t.title,t.description,projectName(t.project_id),supervisorName(t.supervisor_id),statusLabel(t.status),priorityLabel(t.priority),receiverName(t),creatorName(t),closerName(t),t.closure_note].map(S).join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  }
  function css(){
    if($('ticketsExactStyleV10041')) return;
    const st=document.createElement('style'); st.id='ticketsExactStyleV10041'; st.textContent=`
    .smart-ticket-grid{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:13px}.ticket-card-v10041{background:#fff;border:1px solid #dce6e2;border-radius:20px;padding:15px;box-shadow:0 8px 22px rgba(10,64,51,.06);display:grid;gap:10px;border-inline-start:5px solid #b83232}.ticket-card-v10041.doing{border-inline-start-color:#d69e2e}.ticket-card-v10041.done{border-inline-start-color:#137a4b}.ticket-head-v10041{display:flex;justify-content:space-between;gap:10px}.ticket-head-v10041 h3{margin:3px 0;color:#0A4033}.ticket-head-v10041 small{color:#60706a}.ticket-status-v10041{border-radius:999px;padding:5px 10px;font-size:12px;font-weight:900;background:#eef6f3;color:#0A4033;white-space:nowrap}.ticket-meta-v10041{display:grid;grid-template-columns:1fr 1fr;gap:7px}.ticket-meta-v10041 span{background:#f8fbfa;border:1px solid #edf1ef;border-radius:12px;padding:8px;font-size:12px;color:#60706a}.ticket-meta-v10041 b{display:block;color:#10231d;margin-top:3px}.ticket-desc-v10041{background:#fbfdfc;border:1px dashed #d8e8e2;border-radius:12px;padding:9px;line-height:1.6;color:#364b44}.ticket-actions-v10041{display:flex;gap:6px;flex-wrap:wrap}.ticket-actions-v10041 button{padding:8px 10px;border-radius:10px;font-size:12px}.ticket-empty-v10041{grid-column:1/-1;text-align:center;background:#fff;border:1px dashed #b9d8ca;border-radius:16px;padding:22px;color:#60706a}`;
    document.head.appendChild(st);
  }
  function card(t){ const cls=statusClass(t.status); const id=Number(t.id)||0; return `<article class="ticket-card-v10041 ${cls}"><div class="ticket-head-v10041"><div><small>${esc(ticketNo(t))}</small><h3>${esc(t.title||'-')}</h3></div><span class="ticket-status-v10041">${esc(statusLabel(t.status))}</span></div><div class="ticket-meta-v10041"><span>المشروع<b>${esc(projectName(t.project_id)||'-')}</b></span><span>المشرف<b>${esc(supervisorName(t.supervisor_id)||'-')}</b></span><span>نوع المشكلة<b>${esc(t.title||'-')}</b></span><span>الأولوية<b>${esc(priorityLabel(t.priority))}</b></span><span>المستلم<b>${esc(receiverName(t)||'-')}</b></span><span>المنشئ<b>${esc(creatorName(t)||'-')}</b></span><span>المغلق<b>${esc(closerName(t)||'-')}</b></span><span>تاريخ الإنشاء<b>${esc(fmt(t.created_at))}</b></span></div><div class="ticket-desc-v10041">${esc(t.description||'لا يوجد وصف')}</div>${t.closure_note?`<div class="ticket-desc-v10041"><b>طريقة الإغلاق:</b><br>${esc(t.closure_note)}</div>`:''}<div class="ticket-actions-v10041"><button onclick="editTicket(${id})">تعديل</button>${S(t.status)==='closed'?`<button class="light" onclick="setTicketStatus(${id},'open')">إعادة فتح</button>`:`<button class="light" onclick="claimTicket(${id})">استلام</button><button onclick="closeTicket(${id})">إغلاق</button>`}<button class="danger" onclick="deleteRow('tickets',${id})">حذف</button></div></article>`; }
  function renderTickets(){
    css(); titleDropdown(); ensureFilters();
    const body=$('ticketsBody'); if(!body) return;
    const list=tickets().filter(pass);
    const summary=$('ticketsSmartSummary');
    if(summary){ summary.innerHTML=`<div class="smart-ticket-kpi"><span>النتائج</span><b>${list.length}</b></div><div class="smart-ticket-kpi red"><span>مفتوح</span><b>${list.filter(t=>S(t.status)==='open').length}</b></div><div class="smart-ticket-kpi amber"><span>تحت المعالجة</span><b>${list.filter(t=>S(t.status)==='processing').length}</b></div><div class="smart-ticket-kpi green"><span>مغلق</span><b>${list.filter(t=>S(t.status)==='closed').length}</b></div><div class="smart-ticket-kpi"><span>إجمالي التكتات</span><b>${tickets().length}</b></div>`; }
    body.classList.add('smart-ticket-grid'); body.innerHTML=list.map(card).join('') || '<div class="ticket-empty-v10041">لا توجد تكتات حسب الفلاتر الحالية</div>';
  }
  async function saveTicket(){
    const u=currentUser(); if(!u||!u.id) return alert('سجّل الدخول أولاً');
    titleDropdown(); const title=S($('ticketTitle')?.value); if(!title) return alert('نوع المشكلة مطلوب');
    if(!window.sb) return alert('الاتصال غير جاهز');
    const id=S($('ticketId')?.value); const status=S($('ticketStatus')?.value)||'open'; const now=new Date().toISOString();
    const row={project_id:Number($('ticketProject')?.value)||null,supervisor_id:Number($('ticketSupervisor')?.value)||null,title,description:S($('ticketDescription')?.value),priority:S($('ticketPriority')?.value)||'normal',status,updated_at:now};
    if(!id){ row.created_by=u.id; row.created_by_name=currentUserName(); }
    if(status==='closed'){
      const note=S($('ticketClosureNote')?.value)||prompt('كيف تم إغلاق التكت؟','')||''; if(!note) return alert('لا يمكن إغلاق التكت بدون طريقة الإغلاق');
      row.closed_at=now; row.closed_by=u.id; row.closed_by_name=S($('ticketClosedByName')?.value)||currentUserName(); row.closure_note=note;
    }
    const req = id ? await sb.from('tickets').update(row).eq('id',id).select('*').maybeSingle() : await sb.from('tickets').insert(row).select('*').single();
    if(req.error) return alert(req.error.message);
    if(!id && req.data && !req.data.ticket_number) await sb.from('tickets').update({ticket_number:'T-'+String(req.data.id).padStart(4,'0')}).eq('id',req.data.id);
    try{ if(typeof window.clearTicketForm==='function') window.clearTicketForm(); }catch(_){}
    if(typeof window.refreshAll==='function') await window.refreshAll();
    renderTickets();
  }
  function boot(){ css(); titleDropdown(); ensureFilters(); window.renderTickets=renderTickets; window.saveTicket=saveTicket; renderTickets(); setTimeout(()=>{window.renderTickets=renderTickets; window.saveTicket=saveTicket; renderTickets();},1200); setInterval(()=>{window.renderTickets=renderTickets; window.saveTicket=saveTicket; ensureFilters();},1500); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',boot);
  document.addEventListener('input', e=>{ if(e.target && e.target.closest && e.target.closest('#tickets .filters')) setTimeout(renderTickets,0); }, true);
  document.addEventListener('change', e=>{ if(e.target && e.target.closest && e.target.closest('#tickets .filters')) setTimeout(renderTickets,0); }, true);
})();

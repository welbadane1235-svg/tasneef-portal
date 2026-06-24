(function(){
  'use strict';
  const VERSION='V10225';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const N=v=>S(v).toLowerCase().replace(/\s+/g,' ');
  const A=v=>Array.isArray(v)?v:[];
  const E=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const TITLES=['صيانة','سباكة','تعطير','تشجير','كهرباء','صواريخ','دفاع مدني','مصاعد'];
  let rendering=false;

  function data(){ return window.data || {}; }
  function projects(){ return A(data().projects); }
  function users(){ return A(data().users).concat(A(data().supervisors)).filter((v,i,arr)=>arr.findIndex(x=>S(x.id)===S(v.id))===i); }
  function tickets(){ return A(data().tickets); }
  function projectNameById(id){
    const p=projects().find(x=>S(x.id)===S(id));
    return p ? S(p.name || p.project_name || p.title || '') : '';
  }
  function supervisorNameById(id){
    const u=users().find(x=>S(x.id)===S(id));
    return u ? S(u.full_name || u.username || u.name || '') : '';
  }
  function ticketProjectName(t){ return S(t.project_name || t.projectName || t.project || projectNameById(t.project_id) || '-'); }
  function ticketSupervisorName(t){ return S(t.supervisor_name || t.supervisorName || t.supervisor || supervisorNameById(t.supervisor_id) || '-'); }
  function ticketNo(t){ return S(t.ticket_number || t.ticket_no || t.no) || ('T-'+S(t.id||0).padStart(4,'0')); }
  function ticketDate(t){ return Date.parse(t.created_at || t.opened_at || t.updated_at || t.date || '') || Number(t.id||0) || 0; }
  function fmt(v){ if(!v) return '-'; const d=new Date(v); if(isNaN(d)) return S(v); return d.toLocaleString('ar-SA',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); }
  function statusLabel(s){ s=S(s||'open'); return s==='closed'?'مغلق':(s==='processing'?'تحت المعالجة':'مفتوح'); }
  function statusClass(s){ s=S(s||'open'); return s==='closed'?'green':(s==='processing'?'amber':'red'); }
  function priorityLabel(p){ p=S(p||'normal'); return p==='urgent'?'عاجل':(p==='high'?'مهم':(p==='low'?'منخفض':'عادي')); }

  function css(){
    if($('ticketsRootV10225Style')) return;
    const st=document.createElement('style'); st.id='ticketsRootV10225Style'; st.textContent=`
      .ticket-root-v10225-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
      .ticket-root-v10225-row select,.ticket-root-v10225-row input{min-height:38px;border:1px solid var(--line,#d8e6e1);border-radius:10px;padding:8px;background:#fff}
      .ticket-root-v10225-grid{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:12px;margin-top:12px}
      .ticket-root-v10225-card{border:1px solid var(--line,#d8e6e1);border-radius:14px;background:#fff;padding:12px;box-shadow:0 2px 10px rgba(0,0,0,.05);overflow:hidden}
      .ticket-root-v10225-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:8px}
      .ticket-root-v10225-card h3{margin:6px 0;color:var(--brand,#0b5d49);font-size:18px}
      .ticket-root-v10225-meta{display:grid;gap:5px;font-size:13px;color:#345}.ticket-root-v10225-desc{background:#f7fbf9;border-radius:10px;padding:8px;margin-top:8px;min-height:42px;white-space:pre-wrap;word-break:break-word}
      .ticket-root-v10225-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.ticket-root-v10225-actions button{padding:7px 10px;border-radius:9px}
      .ticket-root-v10225-empty{padding:22px;text-align:center;background:#f7fbf9;border:1px dashed var(--line,#d8e6e1);border-radius:14px;grid-column:1/-1}
      .ticket-root-v10225-summary{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.ticket-root-v10225-kpi{background:#eef8f4;border:1px solid var(--line,#d8e6e1);border-radius:12px;padding:8px 12px;font-weight:800}.ticket-root-v10225-kpi b{font-size:20px;color:var(--brand,#0b5d49)}
      .ticket-root-v10225-version{font-size:12px;color:#678;margin-inline-start:auto}
    `; document.head.appendChild(st);
  }
  function options(rows,label,all){ return `<option value="">${E(all)}</option>`+rows.map(r=>`<option value="${E(r.value ?? r.id)}">${E(label(r))}</option>`).join(''); }
  function fillKeep(el, html){ if(!el) return; const old=el.value; el.innerHTML=html; if([...el.options].some(o=>o.value===old)) el.value=old; }


  function uniqueByValue(rows){
    const out=[]; const seen=new Set();
    rows.forEach(r=>{ const v=S(r.value); if(!v || seen.has(v)) return; seen.add(v); out.push(r); });
    return out.sort((a,b)=>S(a.label).localeCompare(S(b.label),'ar'));
  }
  function projectFilterRows(){
    const rows=[];
    projects().forEach(p=>{ const name=S(p.name||p.project_name||p.title||''); if(name) rows.push({value:'id:'+S(p.id), label:name}); });
    tickets().forEach(t=>{
      const pid=S(t.project_id||t.projectId||''); const name=ticketProjectName(t);
      if(pid && name && name!=='-') rows.push({value:'id:'+pid, label:name});
      else if(name && name!=='-') rows.push({value:'name:'+name, label:name});
    });
    return uniqueByValue(rows);
  }
  function supervisorFilterRows(){
    const rows=[];
    users().filter(u=>!u.role || S(u.role)==='supervisor').forEach(u=>{ const name=S(u.full_name||u.username||u.name||''); if(name) rows.push({value:'id:'+S(u.id), label:name}); });
    tickets().forEach(t=>{
      const sid=S(t.supervisor_id||t.supervisorId||''); const name=ticketSupervisorName(t);
      if(sid && name && name!=='-') rows.push({value:'id:'+sid, label:name});
      else if(name && name!=='-') rows.push({value:'name:'+name, label:name});
    });
    return uniqueByValue(rows);
  }
  function ticketPersonName(t, kind){
    if(kind==='claimed') return S(t.claimed_by_name||t.received_by_name||t.assigned_to_name||t.receiver_name||t.claimed_by||'');
    return S(t.closed_by_name||t.closer_name||t.closed_by||'');
  }
  function personFilterRows(kind){
    const rows=[];
    tickets().forEach(t=>{
      const name=ticketPersonName(t,kind);
      const id=kind==='claimed'?S(t.claimed_by||t.received_by||t.assigned_to||''):S(t.closed_by||'');
      if(id && name) rows.push({value:'id:'+id,label:name});
      else if(name) rows.push({value:'name:'+name,label:name});
    });
    return uniqueByValue(rows);
  }
  function optionRows(rows, all){ return `<option value="">${E(all)}</option>`+rows.map(r=>`<option value="${E(r.value)}">${E(r.label)}</option>`).join(''); }
  function valueMatchesIdOrName(val, id, name){
    if(!val) return true;
    if(val.startsWith('id:')) return S(id)===val.slice(3);
    if(val.startsWith('name:')) return N(name)===N(val.slice(5));
    return S(id)===val || N(name)===N(val);
  }

  function removeLegacyFiltersNoise(){
    // أخفي فلاتر قديمة مكررة ولا أحذف بيانات ولا عناصر مهمة.
    ['ticketFilterProject','ticketFilterSupervisor','ticketFilterPriority'].forEach(id=>{ const el=$(id); if(el && !el.dataset.rootHidden){ el.dataset.rootHidden='1'; el.style.display='none'; el.disabled=true; } });
    const oldTitle=$('ticketFilterTitle'); if(oldTitle && oldTitle.tagName==='INPUT' && !oldTitle.dataset.rootHidden){ oldTitle.dataset.rootHidden='1'; oldTitle.style.display='none'; oldTitle.disabled=true; }
  }

  function ensureFilters(){
    css();
    const page=$('tickets'); const body=$('ticketsBody'); const search=$('ticketSearch');
    if(!page || !body || !search) return;
    removeLegacyFiltersNoise();
    let row=$('ticketRootFiltersV10225');
    if(!row){
      const oldBox=search.closest('.filters') || search.parentElement;
      row=document.createElement('div'); row.id='ticketRootFiltersV10225'; row.className='ticket-root-v10225-row';
      row.innerHTML=`
        <select id="ticketRootProjectV10225"><option value="">كل المشاريع</option></select>
        <select id="ticketRootSupervisorV10225"><option value="">كل المشرفين</option></select>
        <select id="ticketRootTitleV10225"><option value="">كل أنواع المشكلة</option></select>
        <select id="ticketRootStatusV10225"><option value="">كل الحالات</option><option value="open">مفتوح</option><option value="processing">تحت المعالجة</option><option value="closed">مغلق</option></select>
        <select id="ticketRootClaimedV10225"><option value="">كل المستلمين</option></select>
        <select id="ticketRootClosedByV10225"><option value="">كل المغلقين</option></select>
        <select id="ticketRootOrderV10225"><option value="newest">الأحدث أولاً</option><option value="oldest">الأقدم أولاً</option></select>
        <input id="ticketRootSearchV10225" placeholder="بحث برقم التكت، المشروع، المشرف، المستلم، المغلق، العنوان أو الوصف">
        <span class="ticket-root-v10225-version">${VERSION}</span>
      `;
      if(oldBox) oldBox.replaceWith(row); else body.parentElement.insertBefore(row,body);
    }
    fillKeep($('ticketRootProjectV10225'), optionRows(projectFilterRows(), 'كل المشاريع'));
    fillKeep($('ticketRootSupervisorV10225'), optionRows(supervisorFilterRows(), 'كل المشرفين'));
    fillKeep($('ticketRootTitleV10225'), options(TITLES.map(x=>({id:x})), r=>r.id, 'كل أنواع المشكلة'));
    fillKeep($('ticketRootClaimedV10225'), optionRows(personFilterRows('claimed'), 'كل المستلمين'));
    fillKeep($('ticketRootClosedByV10225'), optionRows(personFilterRows('closed'), 'كل المغلقين'));
    // توافق مع القيم القديمة عند أول تحميل
    if(!$('ticketRootStatusV10225').dataset.synced){ $('ticketRootStatusV10225').value=$('ticketFilterStatus')?.value||''; $('ticketRootStatusV10225').dataset.synced='1'; }
    if(!$('ticketRootOrderV10225').dataset.synced){ $('ticketRootOrderV10225').value=$('ticketSortOrder')?.value||'newest'; $('ticketRootOrderV10225').dataset.synced='1'; }
    if(!$('ticketRootSearchV10225').dataset.synced){ $('ticketRootSearchV10225').value=$('ticketSearch')?.value||''; $('ticketRootSearchV10225').dataset.synced='1'; }
    ['ticketRootProjectV10225','ticketRootSupervisorV10225','ticketRootTitleV10225','ticketRootStatusV10225','ticketRootClaimedV10225','ticketRootClosedByV10225','ticketRootOrderV10225'].forEach(id=>{ const el=$(id); if(el && !el.dataset.rootBound){ el.dataset.rootBound='1'; el.addEventListener('change',rootRender); }});
    const q=$('ticketRootSearchV10225'); if(q && !q.dataset.rootBound){ q.dataset.rootBound='1'; q.addEventListener('input',rootRender); }
  }

  function getFilters(){
    return {
      project:S($('ticketRootProjectV10225')?.value||''),
      supervisor:S($('ticketRootSupervisorV10225')?.value||''),
      title:S($('ticketRootTitleV10225')?.value||''),
      status:S($('ticketRootStatusV10225')?.value||''),
      claimed:S($('ticketRootClaimedV10225')?.value||''),
      closedBy:S($('ticketRootClosedByV10225')?.value||''),
      order:S($('ticketRootOrderV10225')?.value||'newest'),
      search:N($('ticketRootSearchV10225')?.value||'')
    };
  }
  function rowMatchesProject(t, val){ return valueMatchesIdOrName(val, S(t.project_id||t.projectId||''), ticketProjectName(t)); }
  function rowMatchesSupervisor(t, val){ return valueMatchesIdOrName(val, S(t.supervisor_id||t.supervisorId||''), ticketSupervisorName(t)); }
  function rowMatchesClaimed(t, val){ return valueMatchesIdOrName(val, S(t.claimed_by||t.received_by||t.assigned_to||''), ticketPersonName(t,'claimed')); }
  function rowMatchesClosedBy(t, val){ return valueMatchesIdOrName(val, S(t.closed_by||''), ticketPersonName(t,'closed')); }
  function rowMatchesTitle(t, val){ if(!val) return true; return N(t.title)===N(val); }
  function filteredTickets(){
    const f=getFilters();
    let list=tickets().slice();
    list=list.filter(t=>rowMatchesProject(t,f.project));
    list=list.filter(t=>rowMatchesSupervisor(t,f.supervisor));
    list=list.filter(t=>rowMatchesTitle(t,f.title));
    if(f.status) list=list.filter(t=>S(t.status||'open')===f.status);
    list=list.filter(t=>rowMatchesClaimed(t,f.claimed));
    list=list.filter(t=>rowMatchesClosedBy(t,f.closedBy));
    if(f.search){
      list=list.filter(t=>N([ticketNo(t),t.title,t.description,t.priority,priorityLabel(t.priority),statusLabel(t.status),ticketProjectName(t),ticketSupervisorName(t),t.claimed_by_name,t.claimed_by,t.received_by_name,t.assigned_to_name,t.closed_by_name,t.closed_by,t.closure_note].join(' ')).includes(f.search));
    }
    list.sort((a,b)=> f.order==='oldest' ? ticketDate(a)-ticketDate(b) : ticketDate(b)-ticketDate(a));
    window.__tasneefFilteredTicketsV10225=list;
    return list;
  }
  function summary(list){
    const open=list.filter(t=>S(t.status||'open')==='open').length;
    const proc=list.filter(t=>S(t.status)==='processing').length;
    const closed=list.filter(t=>S(t.status)==='closed').length;
    return `<div class="ticket-root-v10225-summary"><span class="ticket-root-v10225-kpi">الإجمالي: <b>${list.length}</b></span><span class="ticket-root-v10225-kpi">مفتوح: <b>${open}</b></span><span class="ticket-root-v10225-kpi">تحت المعالجة: <b>${proc}</b></span><span class="ticket-root-v10225-kpi">مغلق: <b>${closed}</b></span></div>`;
  }
  function card(t){
    const id=Number(t.id)||0, st=S(t.status||'open');
    const view=typeof window.viewTicketSmartV147==='function'?`<button class="light" onclick="viewTicketSmartV147(${id})">عرض</button>`:'';
    const pdf=typeof window.ticketDownloadPdfV206==='function'?`<button class="light" onclick="ticketDownloadPdfV206(${id})">PDF</button>`:'';
    const edit=typeof window.editTicket==='function'?`<button class="light" onclick="editTicket(${id})">تعديل</button>`:'';
    const claim=st!=='closed'&&st!=='processing'&&typeof window.claimTicket==='function'?`<button class="light" onclick="claimTicket(${id})">استلام</button>`:'';
    const close=st!=='closed'&&typeof window.closeTicket==='function'?`<button onclick="closeTicket(${id})">إغلاق</button>`:'';
    const reopen=st==='closed'&&typeof window.setTicketStatus==='function'?`<button class="light" onclick="setTicketStatus(${id},'open')">إعادة فتح</button>`:'';
    const del=typeof window.deleteRow==='function'?`<button class="danger" onclick="deleteRow('tickets',${id})">حذف</button>`:'';
    return `<article class="ticket-root-v10225-card" data-ticket-id="${E(id)}"><div class="ticket-root-v10225-top"><div><b>${E(ticketNo(t))}</b><br><small>${E(fmt(t.created_at||t.opened_at||t.updated_at))}</small></div><span class="badge ${statusClass(st)}">${E(statusLabel(st))}</span></div><h3>${E(t.title||'-')}</h3><div class="ticket-root-v10225-meta"><span>المشروع: <b>${E(ticketProjectName(t))}</b></span><span>المشرف: <b>${E(ticketSupervisorName(t))}</b></span><span>الأولوية: <b>${E(priorityLabel(t.priority))}</b></span><span>المستلم: <b>${E(ticketPersonName(t,'claimed')||'-')}</b></span><span>المغلق: <b>${E(ticketPersonName(t,'closed')||'-')}</b></span></div><div class="ticket-root-v10225-desc">${E(t.description||'لا يوجد وصف')}</div>${t.closure_note?`<div class="ticket-root-v10225-desc"><b>الحل:</b> ${E(t.closure_note)}</div>`:''}<div class="ticket-root-v10225-actions">${view}${pdf}${edit}${claim}${close}${reopen}${del}</div></article>`;
  }

  function rootRender(){
    if(rendering) return;
    rendering=true;
    try{
      const body=$('ticketsBody');
      if(!body){ const legacy=window.__tasneefLegacyRenderTicketsV10225; if(typeof legacy==='function') return legacy.apply(this,arguments); return; }
      ensureFilters();
      const list=filteredTickets();
      const sum=$('ticketsSmartSummary'); if(sum) sum.innerHTML=summary(list);
      body.className = (body.className||'').split(/\s+/).filter(c=>c && !/^ticket-.*grid/.test(c)).join(' ');
      body.classList.add('ticket-root-v10225-grid');
      body.innerHTML=list.length?list.map(card).join(''):'<div class="ticket-root-v10225-empty">لا توجد تكتات مطابقة للفلاتر الحالية</div>';
    }catch(e){ console.error('tickets root V10225',e); }
    finally{ rendering=false; }
  }

  function lockRenderFunction(){
    if(window.renderTickets!==rootRender){
      if(typeof window.renderTickets==='function' && window.renderTickets!==rootRender) window.__tasneefLegacyRenderTicketsV10225=window.renderTickets;
      try{
        Object.defineProperty(window,'renderTickets',{configurable:true, enumerable:true, get(){ return rootRender; }, set(fn){ if(typeof fn==='function' && fn!==rootRender) window.__tasneefLegacyRenderTicketsV10225=fn; }});
      }catch(_){ window.renderTickets=rootRender; }
    }
  }

  function boot(){
    lockRenderFunction();
    ensureFilters();
    rootRender();
    const body=$('ticketsBody');
    if(body && !body.dataset.rootObserve10224){
      body.dataset.rootObserve10224='1';
      const mo=new MutationObserver(()=>{
        if(rendering) return;
        // إذا سكربت قديم كتب جدول/نتائج غير تابعة لنا، نعيد الرسم فوراً.
        if(!body.classList.contains('ticket-root-v10225-grid')) setTimeout(rootRender,0);
      });
      mo.observe(body,{childList:true,subtree:false,attributes:true,attributeFilter:['class']});
    }
  }

  window.getFilteredTicketsV10225=filteredTickets;
  window.tasneefTicketsRootRenderV10225=rootRender;
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,300));
  window.addEventListener('load',()=>{ [200,700,1500,3000,6000].forEach(ms=>setTimeout(boot,ms)); });
  let tries=0; const timer=setInterval(()=>{ tries++; boot(); if(tries>30) clearInterval(timer); }, 500);
})();

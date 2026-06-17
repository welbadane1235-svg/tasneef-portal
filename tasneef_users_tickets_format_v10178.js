/* Tasneef v10178 - Users supervisor phone + exact ticket WhatsApp format
   Safe patch: users + tickets only. Does not touch finance, orders, contracts, monthly or project command center. */
(function(){
  'use strict';
  if(window.__tasneefUsersTicketsFormatV10178) return;
  window.__tasneefUsersTicketsFormatV10178 = true;

  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const A = v => Array.isArray(v) ? v : [];
  const esc = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const client = () => window.sb || window.supabaseClient || window.supabase || null;
  const data = () => window.data || {};
  const users = () => A(data().users);
  const projects = () => A(data().projects);
  const tickets = () => A(data().tickets);
  const roleLabel = r => ({admin:'مدير عام',financial_manager:'مدير مالي',operations_manager:'مدير تشغيلي',warehouse_manager:'مدير مخازن',technician:'فني',supervisor:'مشرف'}[S(r)] || S(r) || '-');
  const statusLabel = s => ({open:'مفتوح',processing:'تحت المعالجة',closed:'مغلق'}[S(s)] || S(s) || '-');
  const waUrl = msg => 'https://wa.me/?text=' + encodeURIComponent(msg);

  function localPhones(){ try{return JSON.parse(localStorage.getItem('tasneef_user_supervisor_phone_v10178')||'{}') || {}; }catch(_){return{};} }
  function saveLocalPhone(id, phone){ const m=localPhones(); if(id) m[String(id)] = S(phone); localStorage.setItem('tasneef_user_supervisor_phone_v10178', JSON.stringify(m)); }
  function userPhone(u){ return S(u && (u.supervisor_phone || u.supervisor_mobile || u.mobile || u.phone || u.phone_number || u.whatsapp || localPhones()[String(u.id)])); }

  function currentUser(){ try{ if(typeof window.session==='function') return window.session() || {}; }catch(_){} try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}') || {}; }catch(_){return{};} }

  function projectName(id){
    try{ if(typeof window.projectName==='function') return window.projectName(id)||''; }catch(_){ }
    const p = projects().find(x => String(x.id) === String(id));
    return S(p && (p.name || p.project_name || p.title || p.id));
  }
  function ticketNo(t){
    try{ if(typeof window.ticketNo==='function') return window.ticketNo(t)||''; }catch(_){ }
    return S(t && (t.ticket_number || t.ticket_no || t.no)) || ('T-' + String((t && t.id) || '').padStart(4,'0'));
  }
  function ticketDate(t){
    const raw = S(t && (t.created_at || t.createdAt || t.date || t.updated_at));
    if(!raw) return new Date();
    const d = new Date(raw);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  function gregDate(d){
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function arTime(d){
    try{return d.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit',hour12:true});}catch(_){return ''}
  }
  function findTicketFromCard(card){
    const no = S(card.querySelector('.ticket-head-v10041 small')?.textContent || card.querySelector('small')?.textContent);
    const title = S(card.querySelector('.ticket-head-v10041 h3')?.textContent || card.querySelector('h3')?.textContent);
    const desc = S(card.querySelector('.ticket-desc-v10041')?.textContent || '');
    return tickets().find(t => S(ticketNo(t))===no) || tickets().find(t => title && S(t.title)===title && (!desc || S(t.description).includes(desc.slice(0,20)))) || null;
  }
  function ticketMessage(t, card){
    const isClosed = S(t && t.status) === 'closed' || /مغلق/.test(S(card?.textContent));
    const d = ticketDate(t);
    const title = isClosed ? 'تم إغلاق التكت' : 'تم تسجيل تكت جديد';
    const pName = projectName(t && t.project_id) || extractMeta(card,'المشروع') || '-';
    const no = ticketNo(t) || extractTicketNo(card) || '-';
    const description = S(t && (t.description || t.problem_description || t.notes)) || extractDescription(card) || '-';
    const status = statusLabel(t && t.status) || extractMeta(card,'الحالة') || '-';
    return [
      title,
      '',
      'اسم المشروع: ' + pName,
      'رقم التكت: ' + no,
      'وصف المشكلة: ' + description,
      'حالة المشكلة: ' + status,
      'التاريخ: ' + gregDate(d),
      'الوقت: ' + arTime(d)
    ].join('\n');
  }
  function extractTicketNo(card){return S(card?.querySelector('small')?.textContent);}
  function extractDescription(card){
    const blocks = Array.from(card?.querySelectorAll('.ticket-desc-v10041')||[]).map(x=>S(x.textContent)).filter(Boolean);
    return blocks[0] || '';
  }
  function extractMeta(card,label){
    const spans = Array.from(card?.querySelectorAll('.ticket-meta-v10041 span')||[]);
    for(const sp of spans){ if(S(sp.childNodes[0]?.textContent).includes(label) || S(sp.textContent).startsWith(label)){ return S(sp.querySelector('b')?.textContent); } }
    return '';
  }

  function patchTicketWhatsappButtons(){
    const box = $('ticketsBody'); if(!box) return;
    Array.from(box.querySelectorAll('.tas-v10097-wa-ticket')).forEach((btn)=>{
      if(btn.__tasV10178) return;
      btn.__tasV10178 = true;
      btn.textContent = 'إرسال واتساب';
      btn.onclick = function(ev){
        ev.preventDefault(); ev.stopPropagation();
        const card = btn.closest('.ticket-card-v10041') || btn.closest('article') || btn.parentElement;
        const t = findTicketFromCard(card);
        window.open(waUrl(ticketMessage(t, card)), '_blank', 'noopener');
      };
    });
  }

  function ensureUserSupervisorPhoneField(){
    const role = $('userRole');
    if(role && !$('userSupervisorPhone')){
      role.insertAdjacentHTML('afterend','<label>رقم المشرف</label><input id="userSupervisorPhone" placeholder="05xxxxxxxx أو 9665xxxxxxxx">');
    }
    const head = document.querySelector('#users table thead tr');
    if(head && !head.querySelector('[data-user-phone-col]')){
      const th=document.createElement('th'); th.dataset.userPhoneCol='1'; th.textContent='رقم المشرف';
      head.insertBefore(th, head.lastElementChild);
    }
  }

  function userPerms(){
    const obj={};
    document.querySelectorAll('#userPermissionsBoxV72 input[data-perm]').forEach(i=>{ obj[i.dataset.perm] = !!i.checked; });
    return obj;
  }
  function setUserPerms(u){
    const p = (u && (u.permissions || u.perms || u.user_permissions)) || {};
    document.querySelectorAll('#userPermissionsBoxV72 input[data-perm]').forEach(i=>{ i.checked = !!p[i.dataset.perm]; });
  }

  window.renderUsers = function renderUsersV10178(){
    ensureUserSupervisorPhoneField();
    const body = $('usersBody'); if(!body) return;
    body.innerHTML = users().map(u=>`<tr>
      <td>${esc(u.full_name || u.name || '')}</td>
      <td>${esc(u.username || u.email || '')}</td>
      <td>${esc(roleLabel(u.role || u.user_role || u.type))}</td>
      <td>${(u.active===false || u.is_active===false || S(u.status)==='inactive') ? 'موقوف' : 'نشط'}</td>
      <td>${esc(userPhone(u) || '-')}</td>
      <td><button onclick="editUser(${Number(u.id)||0})">تعديل</button> <button class="danger" onclick="deleteRow('app_users',${Number(u.id)||0})">حذف</button></td>
    </tr>`).join('') || '<tr><td colspan="6">لا يوجد مستخدمون</td></tr>';
  };

  window.clearUserForm = function clearUserFormV10178(){
    ensureUserSupervisorPhoneField();
    ['userId','userFullName','userUsername','userPassword','userSupervisorPhone'].forEach(id=>{ if($(id)) $(id).value=''; });
    if($('userRole')) $('userRole').value='supervisor';
    if($('userActive')) $('userActive').value='true';
    document.querySelectorAll('#userPermissionsBoxV72 input[data-perm]').forEach(i=>i.checked=false);
    if($('userFormTitle')) $('userFormTitle').textContent='إضافة مستخدم';
  };

  window.editUser = function editUserV10178(id){
    ensureUserSupervisorPhoneField();
    const u = users().find(x=>String(x.id)===String(id)); if(!u) return;
    if($('userFormTitle')) $('userFormTitle').textContent='تعديل مستخدم';
    if($('userId')) $('userId').value = u.id || '';
    if($('userFullName')) $('userFullName').value = S(u.full_name || u.name || '');
    if($('userUsername')) $('userUsername').value = S(u.username || u.email || '');
    if($('userPassword')) $('userPassword').value = '';
    if($('userRole')) $('userRole').value = S(u.role || u.user_role || u.type || 'supervisor');
    if($('userActive')) $('userActive').value = (u.active===false || u.is_active===false || S(u.status)==='inactive') ? 'false' : 'true';
    if($('userSupervisorPhone')) $('userSupervisorPhone').value = userPhone(u);
    setUserPerms(u);
  };

  window.saveUser = async function saveUserV10178(){
    ensureUserSupervisorPhoneField();
    const c = client(); if(!c) return alert('الاتصال غير جاهز');
    const id=S($('userId')?.value);
    const phone=S($('userSupervisorPhone')?.value);
    const row={
      full_name:S($('userFullName')?.value),
      username:S($('userUsername')?.value),
      role:S($('userRole')?.value)||'supervisor',
      active:S($('userActive')?.value)!=='false',
      supervisor_phone:phone,
      permissions:userPerms(),
      updated_at:new Date().toISOString()
    };
    const pass=S($('userPassword')?.value); if(pass) row.password=pass;
    if(!row.full_name || !row.username) return alert('الاسم واسم المستخدم مطلوبان');
    let res;
    if(id) res = await c.from('app_users').update(row).eq('id',id).select('*').maybeSingle();
    else res = await c.from('app_users').insert(row).select('*').single();
    if(res.error && /supervisor_phone|column|schema|PGRST/i.test(res.error.message||'')){
      const fallback={...row}; delete fallback.supervisor_phone;
      if(id) res = await c.from('app_users').update(fallback).eq('id',id).select('*').maybeSingle();
      else res = await c.from('app_users').insert(fallback).select('*').single();
      if(!res.error) saveLocalPhone(id || res.data?.id, phone);
    }
    if(res.error) return alert(res.error.message || String(res.error));
    if(res.data && phone) saveLocalPhone(res.data.id, phone);
    try{ if(typeof window.refreshAll==='function') await window.refreshAll(); }catch(_){ }
    clearUserFormV10178();
    try{ window.renderUsers(); }catch(_){ }
    if(typeof window.msg==='function') window.msg('تم حفظ المستخدم');
  };

  function boot(){
    ensureUserSupervisorPhoneField();
    try{ window.renderUsers(); }catch(_){ }
    patchTicketWhatsappButtons();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',boot);
  setInterval(()=>{ ensureUserSupervisorPhoneField(); patchTicketWhatsappButtons(); }, 1000);
})();

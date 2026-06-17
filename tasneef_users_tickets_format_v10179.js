/* Tasneef v10179 - Users supervisor phone robust save + exact ticket WhatsApp format
   Fixes: edit button with text/uuid ids, app_users schema without active/supervisor_phone, keeps ticket format.
   Scope: users + ticket WhatsApp only. */
(function(){
  'use strict';
  if(window.__tasneefUsersTicketsFormatV10179) return;
  window.__tasneefUsersTicketsFormatV10179 = true;

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

  function localPhones(){ try{return JSON.parse(localStorage.getItem('tasneef_user_supervisor_phone_v10179')||localStorage.getItem('tasneef_user_supervisor_phone_v10178')||'{}') || {}; }catch(_){return{};} }
  function saveLocalPhone(id, phone){ const m=localPhones(); if(id) m[String(id)] = S(phone); localStorage.setItem('tasneef_user_supervisor_phone_v10179', JSON.stringify(m)); }
  function userId(u){ return S(u && (u.id ?? u.user_id ?? u.uuid ?? u.username ?? u.email)); }
  function userPhone(u){ return S(u && (u.supervisor_phone || u.supervisor_mobile || u.mobile || u.phone || u.phone_number || u.whatsapp || localPhones()[userId(u)] || localPhones()[String(u&&u.id)])); }

  function currentUser(){ try{ if(typeof window.session==='function') return window.session() || {}; }catch(_){} try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}') || {}; }catch(_){return{};} }
  function projectName(id){ try{ if(typeof window.projectName==='function') return window.projectName(id)||''; }catch(_){ } const p=projects().find(x=>String(x.id)===String(id)); return S(p&&(p.name||p.project_name||p.title||p.id)); }
  function ticketNo(t){ try{ if(typeof window.ticketNo==='function') return window.ticketNo(t)||''; }catch(_){ } return S(t&&(t.ticket_number||t.ticket_no||t.no)) || ('T-' + String((t&&t.id)||'').padStart(4,'0')); }
  function ticketDate(t){ const raw=S(t&&(t.created_at||t.createdAt||t.date||t.updated_at)); if(!raw) return new Date(); const d=new Date(raw); return isNaN(d.getTime())?new Date():d; }
  function gregDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function arTime(d){ try{return d.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit',hour12:true});}catch(_){return ''} }
  function extractTicketNo(card){return S(card?.querySelector('small')?.textContent);}
  function extractDescription(card){ const blocks=Array.from(card?.querySelectorAll('.ticket-desc-v10041')||[]).map(x=>S(x.textContent)).filter(Boolean); return blocks[0]||''; }
  function extractMeta(card,label){ const spans=Array.from(card?.querySelectorAll('.ticket-meta-v10041 span')||[]); for(const sp of spans){ if(S(sp.childNodes[0]?.textContent).includes(label)||S(sp.textContent).startsWith(label)){ return S(sp.querySelector('b')?.textContent); } } return ''; }
  function findTicketFromCard(card){ const no=S(card?.querySelector('.ticket-head-v10041 small')?.textContent||card?.querySelector('small')?.textContent); const title=S(card?.querySelector('.ticket-head-v10041 h3')?.textContent||card?.querySelector('h3')?.textContent); const desc=S(card?.querySelector('.ticket-desc-v10041')?.textContent||''); return tickets().find(t=>S(ticketNo(t))===no) || tickets().find(t=>title&&S(t.title)===title&&(!desc||S(t.description).includes(desc.slice(0,20)))) || null; }
  function ticketMessage(t, card){ const isClosed=S(t&&t.status)==='closed'||/مغلق/.test(S(card?.textContent)); const d=ticketDate(t); return [isClosed?'تم إغلاق التكت':'تم تسجيل تكت جديد','', 'اسم المشروع: '+(projectName(t&&t.project_id)||extractMeta(card,'المشروع')||'-'), 'رقم التكت: '+(ticketNo(t)||extractTicketNo(card)||'-'), 'وصف المشكلة: '+(S(t&&(t.description||t.problem_description||t.notes))||extractDescription(card)||'-'), 'حالة المشكلة: '+(statusLabel(t&&t.status)||extractMeta(card,'الحالة')||'-'), 'التاريخ: '+gregDate(d), 'الوقت: '+arTime(d)].join('\n'); }
  function patchTicketWhatsappButtons(){ const box=$('ticketsBody'); if(!box) return; Array.from(box.querySelectorAll('.tas-v10097-wa-ticket')).forEach(btn=>{ if(btn.__tasV10179) return; btn.__tasV10179=true; btn.textContent='إرسال واتساب'; btn.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); const card=btn.closest('.ticket-card-v10041')||btn.closest('article')||btn.parentElement; const t=findTicketFromCard(card); window.open(waUrl(ticketMessage(t,card)),'_blank','noopener'); }; }); }

  function ensureUserSupervisorPhoneField(){
    const role=$('userRole');
    if(role && !$('userSupervisorPhone')) role.insertAdjacentHTML('afterend','<label>رقم المشرف</label><input id="userSupervisorPhone" placeholder="05xxxxxxxx أو 9665xxxxxxxx">');
    const head=document.querySelector('#users table thead tr');
    if(head && !head.querySelector('[data-user-phone-col]')){ const th=document.createElement('th'); th.dataset.userPhoneCol='1'; th.textContent='رقم المشرف'; head.insertBefore(th, head.lastElementChild); }
  }
  function userPerms(){ const obj={}; document.querySelectorAll('#userPermissionsBoxV72 input[data-perm]').forEach(i=>{ obj[i.dataset.perm]=!!i.checked; }); return obj; }
  function setUserPerms(u){ const p=(u&&(u.permissions||u.perms||u.user_permissions))||{}; document.querySelectorAll('#userPermissionsBoxV72 input[data-perm]').forEach(i=>{ i.checked=!!p[i.dataset.perm]; }); }
  function isStopped(u){ return u && (u.active===false || u.is_active===false || S(u.status)==='inactive' || S(u.status)==='stopped' || S(u.status)==='موقوف'); }

  window.renderUsers = function renderUsersV10179(){
    ensureUserSupervisorPhoneField(); const body=$('usersBody'); if(!body) return;
    body.innerHTML=users().map(u=>{ const id=userId(u); const safeId=encodeURIComponent(id); return `<tr>
      <td>${esc(u.full_name||u.name||'')}</td><td>${esc(u.username||u.email||'')}</td><td>${esc(roleLabel(u.role||u.user_role||u.type))}</td><td>${isStopped(u)?'موقوف':'نشط'}</td><td>${esc(userPhone(u)||'-')}</td>
      <td><button onclick="editUser('${safeId}')">تعديل</button> <button class="danger" onclick="deleteRow('app_users','${safeId}')">حذف</button></td></tr>`; }).join('') || '<tr><td colspan="6">لا يوجد مستخدمون</td></tr>';
  };
  window.clearUserForm = function clearUserFormV10179(){
    ensureUserSupervisorPhoneField(); ['userId','userFullName','userUsername','userPassword','userSupervisorPhone'].forEach(id=>{ if($(id)) $(id).value=''; }); if($('userRole')) $('userRole').value='supervisor'; if($('userActive')) $('userActive').value='true'; document.querySelectorAll('#userPermissionsBoxV72 input[data-perm]').forEach(i=>i.checked=false); if($('userFormTitle')) $('userFormTitle').textContent='إضافة مستخدم';
  };
  window.editUser = function editUserV10179(encodedId){
    ensureUserSupervisorPhoneField(); const wanted=decodeURIComponent(S(encodedId)); const u=users().find(x=>userId(x)===wanted || String(x.id)===wanted); if(!u) return alert('لم يتم العثور على المستخدم');
    if($('userFormTitle')) $('userFormTitle').textContent='تعديل مستخدم'; if($('userId')) $('userId').value=userId(u); if($('userFullName')) $('userFullName').value=S(u.full_name||u.name||''); if($('userUsername')) $('userUsername').value=S(u.username||u.email||''); if($('userPassword')) $('userPassword').value=''; if($('userRole')) $('userRole').value=S(u.role||u.user_role||u.type||'supervisor'); if($('userActive')) $('userActive').value=isStopped(u)?'false':'true'; if($('userSupervisorPhone')) $('userSupervisorPhone').value=userPhone(u); setUserPerms(u);
  };

  async function saveWithSchemaFallback(c, table, row, id){
    let payload={...row}; let res;
    for(let attempt=0; attempt<8; attempt++){
      res = id ? await c.from(table).update(payload).eq('id',id).select('*').maybeSingle() : await c.from(table).insert(payload).select('*').single();
      if(!res.error) return res;
      const msg=S(res.error.message || res.error.details || res.error.hint || res.error);
      const m = msg.match(/'([^']+)' column|column '([^']+)'|Could not find the '([^']+)' column/i);
      const col = m && (m[1]||m[2]||m[3]);
      if(col && Object.prototype.hasOwnProperty.call(payload,col)){ delete payload[col]; continue; }
      // common older schemas: remove optional columns one by one
      for(const opt of ['supervisor_phone','updated_at','permissions','status','is_active','active','password']){
        if(Object.prototype.hasOwnProperty.call(payload,opt)){ delete payload[opt]; continue; }
      }
      return res;
    }
    return res;
  }

  window.saveUser = async function saveUserV10179(){
    ensureUserSupervisorPhoneField(); const c=client(); if(!c) return alert('الاتصال غير جاهز');
    const id=S($('userId')?.value); const phone=S($('userSupervisorPhone')?.value);
    const status = S($('userActive')?.value)==='false' ? 'inactive' : 'active';
    const row={ full_name:S($('userFullName')?.value), username:S($('userUsername')?.value), role:S($('userRole')?.value)||'supervisor', status, is_active:status==='active', supervisor_phone:phone, permissions:userPerms(), updated_at:new Date().toISOString() };
    const pass=S($('userPassword')?.value); if(pass) row.password=pass;
    if(!row.full_name || !row.username) return alert('الاسم واسم المستخدم مطلوبان');
    const res=await saveWithSchemaFallback(c,'app_users',row,id);
    if(res.error) return alert(res.error.message || String(res.error));
    if(phone) saveLocalPhone(id || res.data?.id || res.data?.username || row.username, phone);
    try{ if(typeof window.refreshAll==='function') await window.refreshAll(); }catch(_){ }
    window.clearUserForm(); try{ window.renderUsers(); }catch(_){ }
    if(typeof window.msg==='function') window.msg('تم حفظ المستخدم');
  };

  function boot(){ ensureUserSupervisorPhoneField(); try{ window.renderUsers(); }catch(_){ } patchTicketWhatsappButtons(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',boot);
  setInterval(()=>{ ensureUserSupervisorPhoneField(); patchTicketWhatsappButtons(); }, 1000);
})();

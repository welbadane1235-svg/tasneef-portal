/* Tasneef v10180 - Users supervisor phone isolated per user + exact ticket WhatsApp format
   Scope: users + ticket WhatsApp only. No finance changes. */
(function(){
  'use strict';
  if(window.__tasneefUsersTicketsFormatV10180) return;
  window.__tasneefUsersTicketsFormatV10180 = true;

  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const A = v => Array.isArray(v) ? v : [];
  const esc = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const client = () => window.sb || window.supabaseClient || window.supabase || null;
  const data = () => window.data || {};
  const users = () => A(data().users);
  const projects = () => A(data().projects);
  const tickets = () => A(data().tickets);
  const roleLabel = r => ({admin:'مدير عام',general_manager:'مدير عام',system_admin:'مدير النظام',financial_manager:'مدير مالي',operations_manager:'مدير تشغيلي',warehouse_manager:'مدير مخازن',technician:'فني',supervisor:'مشرف'}[S(r)] || S(r) || '-');
  const statusLabel = s => ({open:'مفتوح',processing:'تحت المعالجة',closed:'مغلق'}[S(s)] || S(s) || '-');
  const waUrl = msg => 'https://wa.me/?text=' + encodeURIComponent(msg);

  function getPerms(u){
    let p = u && (u.permissions || u.perms || u.user_permissions);
    if(typeof p === 'string'){ try{ p = JSON.parse(p); }catch(_){ p = {}; } }
    return p && typeof p === 'object' ? p : {};
  }
  function stableKeys(u){
    const p=getPerms(u), arr=[];
    [u&&u.id,u&&u.user_id,u&&u.uuid,u&&u.username,u&&u.email,u&&u.full_name,u&&u.name,p.user_id,p.username].forEach(v=>{const x=S(v); if(x&&!arr.includes(x))arr.push(x);});
    return arr;
  }
  function primaryKey(u){ return stableKeys(u)[0] || ''; }
  function localPhones(){
    try{ const raw=JSON.parse(localStorage.getItem('tasneef_user_supervisor_phone_v10180')||'{}'); return raw && typeof raw==='object' && !Array.isArray(raw) ? raw : {}; }catch(_){return{};}
  }
  function saveLocalPhoneFor(u, phone){
    const m=localPhones(); const keys=stableKeys(u); keys.forEach(k=>{m[k]=S(phone);}); localStorage.setItem('tasneef_user_supervisor_phone_v10180', JSON.stringify(m));
  }
  function userPhone(u){
    const p=getPerms(u), loc=localPhones();
    const direct=S(u && (u.supervisor_phone || u.supervisor_mobile || u.mobile || u.phone || u.phone_number || u.whatsapp));
    if(direct) return direct;
    const fromPerm=S(p.supervisor_phone || p.__supervisor_phone || p.supervisor_mobile || p.phone);
    if(fromPerm) return fromPerm;
    for(const k of stableKeys(u)){ if(S(loc[k])) return S(loc[k]); }
    return '';
  }
  function currentUser(){ try{ if(typeof window.session==='function') return window.session() || {}; }catch(_){} try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}') || {}; }catch(_){return{};} }
  function currentUserName(){ const u=currentUser(); return S(u.full_name||u.name||u.username||u.email||u.role||'غير محدد'); }
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
  function patchTicketWhatsappButtons(){ const box=$('ticketsBody'); if(!box) return; Array.from(box.querySelectorAll('.tas-v10097-wa-ticket')).forEach(btn=>{ if(btn.__tasV10180) return; btn.__tasV10180=true; btn.textContent='إرسال واتساب'; btn.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); const card=btn.closest('.ticket-card-v10041')||btn.closest('article')||btn.parentElement; const t=findTicketFromCard(card); window.open(waUrl(ticketMessage(t,card)),'_blank','noopener'); }; }); }

  function ensureUserSupervisorPhoneField(){
    const role=$('userRole');
    if(role && !$('userSupervisorPhone')) role.insertAdjacentHTML('afterend','<label>رقم المشرف</label><input id="userSupervisorPhone" placeholder="05xxxxxxxx أو 9665xxxxxxxx">');
    const head=document.querySelector('#users table thead tr');
    if(head && !head.querySelector('[data-user-phone-col]')){ const th=document.createElement('th'); th.dataset.userPhoneCol='1'; th.textContent='رقم المشرف'; head.insertBefore(th, head.lastElementChild); }
  }
  function userPermsFromForm(base={}){ const obj={...base}; document.querySelectorAll('#userPermissionsBoxV72 input[data-perm]').forEach(i=>{ obj[i.dataset.perm]=!!i.checked; }); return obj; }
  function setUserPerms(u){ const p=getPerms(u); document.querySelectorAll('#userPermissionsBoxV72 input[data-perm]').forEach(i=>{ i.checked=!!p[i.dataset.perm]; }); }
  function isStopped(u){ return u && (u.is_active===false || S(u.status)==='inactive' || S(u.status)==='stopped' || S(u.status)==='موقوف'); }
  function findUserByKey(key){ key=decodeURIComponent(S(key)); return users().find(x=>stableKeys(x).includes(key) || String(x.id)===key || String(x.username)===key); }

  window.renderUsers = function renderUsersV10180(){
    ensureUserSupervisorPhoneField(); const body=$('usersBody'); if(!body) return;
    body.innerHTML=users().map(u=>{ const key=primaryKey(u); const safeId=encodeURIComponent(key); return `<tr>
      <td>${esc(u.full_name||u.name||'')}</td><td>${esc(u.username||u.email||'')}</td><td>${esc(roleLabel(u.role||u.user_role||u.type))}</td><td>${isStopped(u)?'موقوف':'نشط'}</td><td>${esc(userPhone(u)||'-')}</td>
      <td><button onclick="editUser('${safeId}')">تعديل</button> <button class="danger" onclick="deleteRow('app_users','${safeId}')">حذف</button></td></tr>`; }).join('') || '<tr><td colspan="6">لا يوجد مستخدمون</td></tr>';
  };
  window.clearUserForm = function clearUserFormV10180(){
    ensureUserSupervisorPhoneField(); ['userId','userFullName','userUsername','userPassword','userSupervisorPhone'].forEach(id=>{ if($(id)) $(id).value=''; }); if($('userRole')) $('userRole').value='supervisor'; if($('userActive')) $('userActive').value='true'; document.querySelectorAll('#userPermissionsBoxV72 input[data-perm]').forEach(i=>i.checked=false); if($('userFormTitle')) $('userFormTitle').textContent='إضافة مستخدم';
  };
  window.editUser = function editUserV10180(encodedId){
    ensureUserSupervisorPhoneField(); const u=findUserByKey(encodedId); if(!u) return alert('لم يتم العثور على المستخدم');
    if($('userFormTitle')) $('userFormTitle').textContent='تعديل مستخدم';
    if($('userId')) $('userId').value=S(u.id||u.user_id||u.uuid||u.username||u.email);
    if($('userFullName')) $('userFullName').value=S(u.full_name||u.name||'');
    if($('userUsername')) $('userUsername').value=S(u.username||u.email||'');
    if($('userPassword')) $('userPassword').value='';
    if($('userRole')) $('userRole').value=S(u.role||u.user_role||u.type||'supervisor');
    if($('userActive')) $('userActive').value=isStopped(u)?'false':'true';
    if($('userSupervisorPhone')) $('userSupervisorPhone').value=userPhone(u);
    setUserPerms(u);
  };

  async function saveWithSchemaFallback(c, table, row, old){
    let payload={...row}; let res; const id=S(old && old.id);
    for(let attempt=0; attempt<12; attempt++){
      res = id ? await c.from(table).update(payload).eq('id',id).select('*').maybeSingle() : await c.from(table).insert(payload).select('*').single();
      if(!res.error) return res;
      const msg=S(res.error.message || res.error.details || res.error.hint || res.error);
      const m = msg.match(/'([^']+)' column|column '([^']+)'|Could not find the '([^']+)' column/i);
      const col = m && (m[1]||m[2]||m[3]);
      if(col && Object.prototype.hasOwnProperty.call(payload,col)){ delete payload[col]; continue; }
      const removable=['supervisor_phone','permissions','updated_at','status','is_active','active','password','full_name','name','username','role'];
      const opt=removable.find(k=>Object.prototype.hasOwnProperty.call(payload,k));
      if(opt){ delete payload[opt]; continue; }
      return res;
    }
    return res;
  }

  window.saveUser = async function saveUserV10180(){
    ensureUserSupervisorPhoneField(); const c=client(); if(!c) return alert('الاتصال غير جاهز');
    const formId=S($('userId')?.value); const old=findUserByKey(formId); const phone=S($('userSupervisorPhone')?.value);
    const basePerms=getPerms(old);
    const permissions=userPermsFromForm(basePerms);
    permissions.supervisor_phone=phone;
    permissions.__supervisor_phone=phone;
    const row={};
    const fullName=S($('userFullName')?.value), username=S($('userUsername')?.value), role=S($('userRole')?.value)||'supervisor';
    if(!fullName || !username) return alert('الاسم واسم المستخدم مطلوبان');
    // Keep only common fields; optional fields are removed automatically if schema doesn't have them.
    row.full_name=fullName; row.name=fullName; row.username=username; row.role=role; row.user_role=role; row.type=role; row.permissions=permissions; row.updated_at=new Date().toISOString();
    const status = S($('userActive')?.value)==='false' ? 'inactive' : 'active';
    if(old && Object.prototype.hasOwnProperty.call(old,'status')) row.status=status;
    if(old && Object.prototype.hasOwnProperty.call(old,'is_active')) row.is_active=status==='active';
    if(old && Object.prototype.hasOwnProperty.call(old,'supervisor_phone')) row.supervisor_phone=phone;
    const pass=S($('userPassword')?.value); if(pass) row.password=pass;
    const res=await saveWithSchemaFallback(c,'app_users',row,old);
    if(res.error) return alert(res.error.message || String(res.error));
    const saved={...(old||{}),...(res.data||{}),username,full_name:fullName,permissions};
    if(phone) saveLocalPhoneFor(saved, phone);
    // Update local data immediately so the phone stays attached only to this user.
    try{
      const list=users(); const idx=list.findIndex(u=>primaryKey(u)===primaryKey(old||saved)||S(u.username)===S(username));
      if(idx>=0) list[idx]=saved; else list.push(saved);
    }catch(_){ }
    window.clearUserForm(); try{ window.renderUsers(); }catch(_){ }
    if(typeof window.refreshAll==='function') window.refreshAll().then(()=>{try{window.renderUsers();}catch(_){}}).catch(()=>{});
    if(typeof window.msg==='function') window.msg('تم حفظ المستخدم');
  };

  function boot(){ ensureUserSupervisorPhoneField(); try{ window.renderUsers(); }catch(_){ } patchTicketWhatsappButtons(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',boot);
  setInterval(()=>{ ensureUserSupervisorPhoneField(); patchTicketWhatsappButtons(); }, 1200);
})();

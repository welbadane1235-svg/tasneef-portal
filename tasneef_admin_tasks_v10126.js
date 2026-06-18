/* Tasneef v10126 - Admin Tasks Clean Online Rebuild
   حل جذري لقسم مهام إدارية: Supabase فقط، بدون تخزين محلي، بدون مراقبة متكررة للقائمة، وبدون إرسال قيم تاريخ فارغة.
*/
(function(){
  'use strict';
  if(window.__tasneefAdminTasksV10126) return;
  window.__tasneefAdminTasksV10126=true;

  const VERSION='v10184-admin-tasks-close-approve-notes';
  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const TABLE='admin_tasks';
  const DISMISS_PREFIX='tasneef_admin_task_dismiss_v10126_';

  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const $=id=>document.getElementById(id);
  const esc=v=>S(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  const todayKey=()=>new Date().toISOString().slice(0,10);
  const nowIso=()=>new Date().toISOString();
  const safeJson=(raw)=>{ try{return JSON.parse(raw)}catch(_){return null} };
  const msg=(t,type)=>{ try{ if(typeof window.msg==='function') window.msg(t,type); else console.log(t); }catch(_){ console.log(t); } };

  function normalizeKey(v){
    return S(v).toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g,'')
      .replace(/ـ/g,'')
      .replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
      .replace(/[|،,;؛:\-_/\\()\[\]{}\.]+/g,'')
      .replace(/\s+/g,'');
  }
  function uniqueKeys(vals){
    const out=[], seen=new Set();
    vals.map(S).filter(Boolean).forEach(v=>{
      [v, v.toLowerCase(), normalizeKey(v)].forEach(x=>{ x=S(x); if(x&&!seen.has(x)){seen.add(x); out.push(x);} });
    });
    return out;
  }
  function same(a,b){
    a=normalizeKey(a); b=normalizeKey(b);
    return !!a && !!b && (a===b || (a.length>3 && b.length>3 && (a.includes(b)||b.includes(a))));
  }
  function readCurrentUser(){
    const keys=['tasneef_user','currentUser','user','tasneef_current_user','tasneef_login_user','loggedUser','logged_user','tasneef_logged_user','auth_user','session_user','current_user'];
    const stores=[]; try{stores.push(localStorage)}catch(_){} try{stores.push(sessionStorage)}catch(_){}
    let best=null, score=-1;
    function scoreObj(o){
      if(!o||typeof o!=='object'||Array.isArray(o)) return -1;
      let sc=0;
      if(S(o.username||o.user_name||o.email||o.id||o.user_id||o.uid)) sc+=5;
      if(S(o.full_name||o.fullName||o.name||o.display_name)) sc+=4;
      if(S(o.role||o.user_role||o.type||o.position)) sc+=2;
      return sc;
    }
    function consider(o){
      if(!o||typeof o!=='object') return;
      ['user','profile','currentUser','account'].forEach(k=>{ if(o[k]&&typeof o[k]==='object') consider(o[k]); });
      const sc=scoreObj(o); if(sc>score){best=o; score=sc;}
    }
    stores.forEach(st=>{
      keys.forEach(k=>{ const v=safeJson(st.getItem(k)); consider(v); });
      try{
        for(let i=0;i<st.length;i++){
          const k=st.key(i)||''; if(!/user|login|auth|session|current|account|tasneef/i.test(k)) continue;
          const raw=st.getItem(k); if(!raw || raw.length>200000) continue;
          const v=safeJson(raw); if(Array.isArray(v)) v.forEach(consider); else consider(v);
        }
      }catch(_){ }
    });
    ['currentUser','loggedUser','tasneefUser','authUser','user'].forEach(k=>{ try{consider(window[k])}catch(_){} });
    try{
      const txt=(document.querySelector('#currentUserName,#loggedUserName,#userDisplayName,.current-user,.user-name,.brand small')||{}).textContent||'';
      if(txt) consider({name:txt, full_name:txt});
    }catch(_){ }
    return best||{};
  }
  function userDisplay(u=readCurrentUser()){ return S(u.full_name||u.fullName||u.name||u.display_name||u.username||u.user_name||u.email||'مستخدم'); }
  function userLogin(u=readCurrentUser()){ return S(u.username||u.user_name||u.email||u.login||u.id||u.uid||u.user_id||u.name||u.full_name||''); }
  function userAliases(u=readCurrentUser()){
    return uniqueKeys([u.id,u.uid,u.user_id,u.username,u.user_name,u.email,u.login,u.mobile,u.phone,u.full_name,u.fullName,u.name,u.display_name,userDisplay(u),userLogin(u)]);
  }

  async function api(path,options){
    return fetch(SUPABASE_URL+path,Object.assign({
      cache:'no-store',
      headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY,Accept:'application/json','Content-Type':'application/json',Prefer:'return=representation'}
    },options||{}));
  }

  let users=[], rows=[], activeTab='my';

  async function loadUsers(){
    const out=[], seen=new Set();
    const add=u=>{
      if(!u||typeof u!=='object') return;
      const active=u.active??u.is_active??u.status;
      if(active===false || active==='false' || /موقوف|inactive|disabled/i.test(S(active))) return;
      const name=S(u.full_name||u.fullName||u.name||u.display_name||u.username||u.user_name||u.email||u.id||u.uid||u.user_id);
      const login=S(u.username||u.user_name||u.email||u.login||u.id||u.uid||u.user_id||name);
      if(!name&&!login) return;
      const key=normalizeKey(login||name); if(seen.has(key)) return; seen.add(key);
      out.push({
        name:name||login,
        login:login||name,
        role:S(u.role||u.user_role||u.type||u.position||u.job_title||u.title),
        keys:uniqueKeys([u.id,u.uid,u.user_id,u.username,u.user_name,u.email,u.login,u.mobile,u.phone,u.full_name,u.fullName,u.name,u.display_name,name,login])
      });
    };
    try{
      const res=await api('/rest/v1/app_users?select=*&limit=1000',{method:'GET'});
      if(res.ok) A(await res.json()).forEach(add);
      else console.warn('app_users failed',await res.text().catch(()=>res.status));
    }catch(e){ console.warn('loadUsers app_users error',e); }
    try{ document.querySelectorAll('#usersBody tr').forEach(tr=>{ const c=[...tr.children].map(td=>S(td.textContent)); if(c.length) add({full_name:c[0],username:c[1],role:c[2],status:c[3]}); }); }catch(_){ }
    add(readCurrentUser());
    users=out.sort((a,b)=>a.name.localeCompare(b.name,'ar'));
    fillUsersSelect();
    return users;
  }

  function cleanDueValue(v){
    v=S(v).replace(/^"+|"+$/g,'').trim();
    if(!v || v==='null' || v==='undefined') return null;
    const d=new Date(v);
    if(!Number.isFinite(d.getTime())) return null;
    return d.toISOString();
  }
  function cleanText(v){ return S(v).replace(/\u0000/g,''); }
  function taskFromDb(t){
    t=t||{};
    return {
      id:t.id,
      title:S(t.title), details:S(t.details), task_type:S(t.task_type||'مهمة إدارية'), priority:S(t.priority||'عادي'), schedule_type:S(t.schedule_type||'فورية'),
      from_user:S(t.from_user), from_name:S(t.from_name), from_keys:S(t.from_keys),
      to_user:S(t.to_user), to_name:S(t.to_name), to_keys:S(t.to_keys),
      due_at:S(t.due_at), status:S(t.status||'open'),
      created_at:S(t.created_at), updated_at:S(t.updated_at), closed_at:S(t.closed_at), closed_by:S(t.closed_by), approved_at:S(t.approved_at), approved_by:S(t.approved_by), approved_note:S(t.approved_note)
    };
  }
  function keyListFromTask(t,side){
    const vals=side==='to'?[t.to_user,t.to_name,t.to_keys]:[t.from_user,t.from_name,t.from_keys];
    return uniqueKeys(vals.flatMap(v=>S(v).split('|')));
  }
  function matchesKeys(taskKeys, curKeys=userAliases()){
    return taskKeys.some(a=>curKeys.some(b=>same(a,b)));
  }
  function isToMe(t){ return matchesKeys(keyListFromTask(t,'to')); }
  function isFromMe(t){ return matchesKeys(keyListFromTask(t,'from')); }
  function isRelevant(t){ return isToMe(t)||isFromMe(t); }

  async function loadTasks(){
    const res=await api('/rest/v1/'+TABLE+'?select=*&order=id.desc&limit=1000',{method:'GET'});
    if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
    rows=A(await res.json()).map(taskFromDb);
    render();
    return rows;
  }
  async function saveTask(){
    const title=cleanText($('at26Title')?.value); const details=cleanText($('at26Details')?.value);
    if(!title) return alert('اكتب عنوان المهمة');
    if(!details) return alert('اكتب تفاصيل المهمة');
    const rec=users[Number($('at26Recipient')?.value||0)] || null;
    if(!rec) return alert('اختر المستلم من إدارة المستخدمين');
    const schedule_type=S($('at26ScheduleType')?.value||'فورية');
    const due_at=schedule_type==='مجدولة'?cleanDueValue($('at26Due')?.value):null;
    const cu=readCurrentUser();
    const payload={
      title, details,
      task_type:cleanText($('at26TaskType')?.value||'مهمة إدارية'),
      priority:cleanText($('at26Priority')?.value||'عادي'),
      schedule_type,
      from_user:userLogin(cu), from_name:userDisplay(cu), from_keys:userAliases(cu).join('|'),
      to_user:rec.login, to_name:rec.name, to_keys:A(rec.keys).join('|'),
      due_at:due_at, status:'open', updated_at:nowIso()
    };
    // لا نرسل أي تاريخ فارغ. هذا أصل المشكلة السابقة.
    if(payload.due_at===null) delete payload.due_at;
    const res=await api('/rest/v1/'+TABLE,{method:'POST',body:JSON.stringify(payload)});
    if(!res.ok){
      const tx=await res.text().catch(()=>String(res.status));
      alert('لم يتم حفظ المهمة أونلاين في Supabase.\n\nالسبب:\n'+tx+'\n\nشغّل ملف admin_tasks_v10126.sql كاملًا ثم أعد المحاولة.');
      return;
    }
    clearForm();
    msg('تم حفظ المهمة أونلاين وظهورها للمستلم','ok');
    activeTab='open';
    await loadTasks();
  }
  async function updateTask(id,patch){
    patch=Object.assign({},patch,{updated_at:nowIso()});
    Object.keys(patch).forEach(k=>{ if(patch[k]==='') patch[k]=null; });
    const res=await api('/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(patch)});
    if(!res.ok) return alert('تعذر تحديث المهمة:\n'+await res.text().catch(()=>String(res.status)));
    await loadTasks();
  }
  function promptModal(title,label,placeholder,required=true){
    return new Promise(resolve=>{
      const id='at26Prompt_'+Date.now();
      document.body.insertAdjacentHTML('beforeend',`<div id="${id}" class="at26-modal show"><div class="at26-box"><h3>${esc(title)}</h3><div class="at26-box-body"><label>${esc(label)}</label><textarea id="${id}_txt" style="width:100%;min-height:120px;border:1px solid #d6e3df;border-radius:12px;padding:10px;margin-top:8px;direction:rtl" placeholder="${esc(placeholder||'')}"></textarea></div><div class="at26-box-actions"><button class="at26-btn light" id="${id}_cancel">إلغاء</button><button class="at26-btn" id="${id}_ok">اعتماد</button></div></div></div>`);
      const root=$(id), txt=$(id+'_txt');
      $(id+'_cancel').onclick=()=>{root.remove(); resolve(null);};
      $(id+'_ok').onclick=()=>{const v=cleanText(txt.value); if(required&&!v){alert('اكتب البيان المطلوب أولاً'); return;} root.remove(); resolve(v);};
      setTimeout(()=>txt&&txt.focus(),80);
    });
  }
  function approveDecisionModal(){
    return new Promise(resolve=>{
      const id='at26Approve_'+Date.now();
      document.body.insertAdjacentHTML('beforeend',`<div id="${id}" class="at26-modal show"><div class="at26-box"><h3>اعتماد إغلاق المهمة</h3><div class="at26-box-body"><p class="at26-muted">اختر اعتماد المهمة أو رفض الاعتماد مع كتابة السبب.</p><label>ملاحظة الاعتماد / سبب عدم الاعتماد</label><textarea id="${id}_txt" style="width:100%;min-height:120px;border:1px solid #d6e3df;border-radius:12px;padding:10px;margin-top:8px;direction:rtl" placeholder="اكتب الملاحظة أو السبب"></textarea></div><div class="at26-box-actions"><button class="at26-btn light" id="${id}_cancel">إلغاء</button><button class="at26-btn danger" id="${id}_reject" style="background:#c53030;color:#fff">عدم اعتماد</button><button class="at26-btn" id="${id}_approve">اعتماد</button></div></div></div>`);
      const root=$(id), txt=$(id+'_txt');
      $(id+'_cancel').onclick=()=>{root.remove(); resolve(null);};
      $(id+'_approve').onclick=()=>{const v=cleanText(txt.value); root.remove(); resolve({approved:true,note:v||'تم الاعتماد'});};
      $(id+'_reject').onclick=()=>{const v=cleanText(txt.value); if(!v){alert('اكتب سبب عدم الاعتماد'); return;} root.remove(); resolve({approved:false,note:v});};
      setTimeout(()=>txt&&txt.focus(),80);
    });
  }
  async function closeTaskWithAction(id){
    const t=rows.find(x=>String(x.id)===String(id));
    const action=await promptModal('إغلاق المهمة','الإجراء الذي تم اتخاذه','مثال: تم تنفيذ المطلوب وإرفاق الصور في القروب',true);
    if(action===null) return;
    const oldDetails=S(t&&t.details);
    const nextDetails=oldDetails.includes('إجراء الإغلاق:')?oldDetails:(oldDetails+'\n\nإجراء الإغلاق: '+action);
    await updateTask(id,{status:'closed',closed_at:nowIso(),closed_by:userDisplay(),details:nextDetails,approved_note:'إجراء الإغلاق: '+action});
  }
  async function approveTaskWithDecision(id){
    const decision=await approveDecisionModal();
    if(!decision) return;
    if(decision.approved){
      await updateTask(id,{status:'approved',approved_at:nowIso(),approved_by:userDisplay(),approved_note:'تم الاعتماد: '+decision.note});
    }else{
      await updateTask(id,{status:'open',approved_at:null,approved_by:null,approved_note:'لم يتم الاعتماد: '+decision.note});
    }
  }

  function injectCss(){
    if($('at26Style')) return;
    const st=document.createElement('style'); st.id='at26Style'; st.textContent=`
      .at26-card{background:#fff;border:1px solid #dce6e2;border-radius:20px;padding:16px;margin:12px 0;box-shadow:0 6px 18px rgba(10,64,51,.05)}
      .at26-head{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.at26-title{color:#0A4033;font-weight:900;font-size:22px}.at26-muted{color:#61736d;font-size:13px;line-height:1.7}
      .at26-grid{display:grid;grid-template-columns:repeat(4,minmax(170px,1fr));gap:10px}.at26-grid .wide{grid-column:span 2}.at26-grid .full{grid-column:1/-1}.at26-grid label{font-weight:900;color:#0A4033;font-size:13px}.at26-grid input,.at26-grid select,.at26-grid textarea{width:100%;border:1px solid #d6e3df;border-radius:11px;padding:10px;background:#fff}.at26-grid textarea{min-height:80px}
      .at26-btn{background:#0A4033;color:#fff;border:0;border-radius:11px;padding:10px 14px;font-weight:900;cursor:pointer}.at26-btn.light{background:#eef6f3;color:#0A4033;border:1px solid #d6e3df}.at26-btn.red{background:#b83232}.at26-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.at26-tabs{display:flex;gap:8px;flex-wrap:wrap}.at26-tab{border:1px solid #d6e3df;background:#fff;color:#0A4033;border-radius:999px;padding:8px 13px;font-weight:900;cursor:pointer}.at26-tab.active{background:#0A4033;color:#fff}.at26-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.at26-kpi>div{background:#fff;border:1px solid #dce6e2;border-radius:18px;padding:12px}.at26-kpi b{display:block;font-size:26px;color:#0A4033;margin-top:8px}.at26-table{width:100%;border-collapse:collapse;font-size:13px}.at26-table th,.at26-table td{border-bottom:1px solid #edf2f0;padding:10px;text-align:right;vertical-align:top}.at26-table th{background:#f4f8f7;color:#0A4033}.at26-details{white-space:pre-wrap;line-height:1.7;max-width:420px}.at26-empty{text-align:center;color:#61736d;padding:20px}.at26-badge{display:inline-block;border-radius:999px;padding:4px 8px;background:#eef6f3;color:#0A4033;font-weight:900;font-size:12px}.at26-badge.red{background:#fde8e8;color:#a32626}.at26-badge.green{background:#e7f5ee;color:#167a4c}
      .at26-modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:999999;align-items:center;justify-content:center;padding:16px}.at26-modal.show{display:flex}.at26-box{background:#fff;border-radius:22px;max-width:560px;width:min(96vw,560px);overflow:hidden;box-shadow:0 20px 70px rgba(0,0,0,.25)}.at26-box h3{margin:0;background:#0A4033;color:#fff;padding:18px}.at26-box-body{padding:18px;line-height:1.8}.at26-box-actions{display:flex;justify-content:flex-end;gap:8px;padding:0 18px 18px}
      @media(max-width:900px){.at26-grid,.at26-kpi{grid-template-columns:1fr}.at26-grid .wide{grid-column:auto}.at26-details{max-width:260px}}
    `; document.head.appendChild(st);
  }
  function sidebar(){ return document.querySelector('.side,.sidebar,aside,[class*="side"]') || document.body; }
  function ensureNav(){
    let btn=$('at26Nav') || document.querySelector('button[data-page="adminTasks"]');
    if(!btn){
      btn=document.createElement('button'); btn.id='at26Nav'; btn.className='nav'; btn.type='button'; btn.textContent='مهام إدارية'; btn.setAttribute('data-page','adminTasks'); btn.onclick=e=>{e.preventDefault();openPage();};
      const cont=sidebar(); const buttons=[...cont.querySelectorAll('button')]; const logout=buttons.find(b=>/تسجيل\s*خروج/.test(S(b.textContent)));
      if(logout && logout.parentNode) logout.parentNode.insertBefore(btn,logout); else cont.appendChild(btn);
    }
    btn.hidden=false; btn.removeAttribute('hidden'); btn.removeAttribute('disabled'); btn.style.cssText+=';display:block!important;visibility:visible!important;opacity:1!important';
    btn.onclick=e=>{e.preventDefault();openPage();};
    return btn;
  }
  function ensureSection(){
    if($('adminTasks')) return $('adminTasks');
    const sec=document.createElement('section'); sec.id='adminTasks'; sec.className='page hidden';
    sec.innerHTML=`
      <div class="at26-card at26-head"><div><div class="at26-title">مهام إدارية</div><div class="at26-muted">إرسال ومتابعة المهام بين مستخدمي إدارة المستخدمين فقط. الحفظ أونلاين على Supabase فقط.</div></div><div class="at26-actions"><button class="at26-btn light" id="at26Refresh">تحديث</button><button class="at26-btn" id="at26ShowForm">إضافة مهمة</button></div></div>
      <div class="at26-card" id="at26Form" style="display:none"><div class="at26-title" style="font-size:20px">إضافة مهمة إدارية</div><div class="at26-grid" style="margin-top:12px">
        <div class="wide"><label>عنوان المهمة</label><input id="at26Title" placeholder="مثال: مراجعة تقرير التشغيل اليومي"></div>
        <div><label>نوع الجدولة</label><select id="at26ScheduleType"><option>فورية</option><option>مجدولة</option></select></div>
        <div><label>الأولوية</label><select id="at26Priority"><option>عادي</option><option>مهم</option><option>عاجل</option></select></div>
        <div><label>المستلم من إدارة المستخدمين</label><select id="at26Recipient"></select><div class="at26-muted">تظهر فقط أسماء المستخدمين المسجلين في إدارة المستخدمين.</div></div>
        <div><label>تاريخ ووقت الجدولة</label><input id="at26Due" type="datetime-local"></div>
        <div class="wide"><label>نوع المهمة</label><select id="at26TaskType"><option>مهمة إدارية</option><option>متابعة مالية</option><option>متابعة تشغيل</option><option>متابعة صيانة</option><option>متابعة مخزون</option></select></div>
        <div class="full"><label>تفاصيل المهمة</label><textarea id="at26Details" placeholder="اكتب تفاصيل المهمة المطلوبة بوضوح"></textarea></div>
      </div><div class="at26-actions" style="justify-content:flex-end;margin-top:12px"><button class="at26-btn light" id="at26Cancel">إلغاء</button><button class="at26-btn" id="at26Save">حفظ المهمة</button></div></div>
      <div class="at26-kpi"><div>مهامي<b id="at26MyCount">0</b></div><div>مهام مفتوحة<b id="at26OpenCount">0</b></div><div>مغلقة تنتظر اعتماد<b id="at26ClosedCount">0</b></div><div>تم الاعتماد<b id="at26ApprovedCount">0</b></div></div>
      <div class="at26-card"><div class="at26-head"><div class="at26-tabs"><button class="at26-tab active" data-tab="my">مهامي</button><button class="at26-tab" data-tab="open">مهام مفتوحة</button><button class="at26-tab" data-tab="closed">مهام مغلقة</button><button class="at26-tab" data-tab="approved">تم الاعتماد</button></div><div class="at26-actions"><input id="at26Search" placeholder="بحث في المهام" style="border:1px solid #d6e3df;border-radius:11px;padding:10px"><select id="at26FilterPriority" style="border:1px solid #d6e3df;border-radius:11px;padding:10px"><option value="">كل الأولويات</option><option>عادي</option><option>مهم</option><option>عاجل</option></select><button class="at26-btn light" id="at26Print">طباعة المعروض</button></div></div><div style="overflow:auto;margin-top:12px"><table class="at26-table"><thead><tr><th>الحالة</th><th>المهمة</th><th>من</th><th>إلى</th><th>الأولوية</th><th>الجدولة</th><th>أنشئت</th><th>أغلقت</th><th>اعتمدت</th><th>إجراء</th></tr></thead><tbody id="at26Body"><tr><td colspan="10" class="at26-empty">جاري التحميل...</td></tr></tbody></table></div></div>
      <div class="at26-modal" id="at26Reminder"><div class="at26-box"><h3>تذكير بمهمة إدارية</h3><div class="at26-box-body" id="at26ReminderBody"></div><div class="at26-box-actions"><button class="at26-btn light" id="at26Dismiss">إغلاق التذكير</button><button class="at26-btn" id="at26OpenReminder">فتح المهمة</button></div></div></div>`;
    const host=document.querySelector('main,.main,.content,#content') || document.body; host.appendChild(sec);
    return sec;
  }
  function clearForm(){ ['at26Title','at26Details','at26Due'].forEach(id=>{ if($(id)) $(id).value=''; }); if($('at26ScheduleType')) $('at26ScheduleType').value='فورية'; }
  function fillUsersSelect(){
    const sel=$('at26Recipient'); if(!sel) return;
    sel.innerHTML=users.map((u,i)=>`<option value="${i}">${esc(u.name)}${u.role?' - '+esc(u.role):''}</option>`).join('') || '<option value="">لا توجد أسماء في إدارة المستخدمين</option>';
  }
  function formatDate(v){ if(!S(v)) return '—'; const d=new Date(v); return Number.isFinite(d.getTime())?d.toLocaleString('ar-SA'):S(v); }
  function filteredRows(){
    const q=normalizeKey($('at26Search')?.value||''); const pr=S($('at26FilterPriority')?.value||'');
    return rows.filter(isRelevant).filter(t=>{
      if(activeTab==='my' && !isToMe(t)) return false;
      if(activeTab==='open' && t.status!=='open') return false;
      if(activeTab==='closed' && t.status!=='closed') return false;
      if(activeTab==='approved' && t.status!=='approved') return false;
      if(pr && t.priority!==pr) return false;
      if(q && !normalizeKey([t.title,t.details,t.from_name,t.to_name,t.priority,t.task_type].join(' ')).includes(q)) return false;
      return true;
    });
  }
  function statusLabel(s){ return s==='approved'?'<span class="at26-badge green">تم الاعتماد</span>':s==='closed'?'<span class="at26-badge">مغلقة</span>':'<span class="at26-badge red">مفتوحة</span>'; }
  function render(){
    const relevant=rows.filter(isRelevant), mine=rows.filter(isToMe);
    if($('at26MyCount')) $('at26MyCount').textContent=mine.length;
    if($('at26OpenCount')) $('at26OpenCount').textContent=relevant.filter(t=>t.status==='open').length;
    if($('at26ClosedCount')) $('at26ClosedCount').textContent=relevant.filter(t=>t.status==='closed').length;
    if($('at26ApprovedCount')) $('at26ApprovedCount').textContent=relevant.filter(t=>t.status==='approved').length;
    document.querySelectorAll('.at26-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===activeTab));
    const body=$('at26Body'); if(!body) return;
    const list=filteredRows();
    if(!list.length){ body.innerHTML='<tr><td colspan="10" class="at26-empty">لا توجد مهام حسب الفلتر الحالي</td></tr>'; return; }
    body.innerHTML=list.map(t=>{
      const actions=[];
      if(t.status==='open' && isToMe(t)) actions.push(`<button class="at26-btn light" data-close="${esc(t.id)}">إغلاق</button>`);
      if(t.status==='closed' && isFromMe(t)) actions.push(`<button class="at26-btn" data-approve="${esc(t.id)}">اعتماد</button>`);
      return `<tr data-id="${esc(t.id)}"><td>${statusLabel(t.status)}</td><td><b>${esc(t.title)}</b><div class="at26-details">${esc(t.details)}${t.approved_note?'<br><br><b>ملاحظة:</b> '+esc(t.approved_note):''}</div></td><td>${esc(t.from_name||t.from_user)}</td><td>${esc(t.to_name||t.to_user)}</td><td>${esc(t.priority)}</td><td>${esc(t.schedule_type)}<br>${formatDate(t.due_at)}</td><td>${formatDate(t.created_at)}</td><td>${formatDate(t.closed_at)}</td><td>${formatDate(t.approved_at)}</td><td>${actions.join(' ')||'—'}</td></tr>`;
    }).join('');
    body.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeTaskWithAction(b.dataset.close));
    body.querySelectorAll('[data-approve]').forEach(b=>b.onclick=()=>approveTaskWithDecision(b.dataset.approve));
  }
  function openPage(){
    ensureNav(); ensureSection();
    try{ if(typeof window.showPage==='function') window.showPage('adminTasks',$('at26Nav')); else throw new Error('no showPage'); }
    catch(_){ document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden')); $('adminTasks')?.classList.remove('hidden'); document.querySelectorAll('.nav').forEach(b=>b.classList.remove('active')); $('at26Nav')?.classList.add('active'); }
    loadUsers().then(loadTasks).catch(e=>alert('تعذر فتح المهام:\n'+(e.message||e)));
  }
  function dueForReminder(t){
    if(t.status!=='open' || !isToMe(t)) return false;
    const due=cleanDueValue(t.due_at);
    return !due || new Date(due).getTime()<=Date.now();
  }
  let reminderId='';
  function showReminder(){
    const t=rows.find(x=>dueForReminder(x) && localStorage.getItem(DISMISS_PREFIX+x.id+'_'+todayKey())!=='1');
    if(!t) return;
    reminderId=t.id;
    ensureSection();
    $('at26ReminderBody').innerHTML=`<b>${esc(t.title)}</b><br><br><b>من:</b> ${esc(t.from_name||t.from_user)}<br><b>الأولوية:</b> ${esc(t.priority)}<br><b>الجدولة:</b> ${formatDate(t.due_at)}<br><br><div class="at26-details">${esc(t.details)}</div>`;
    $('at26Reminder').classList.add('show');
  }
  function printRows(){
    const list=filteredRows();
    const w=window.open('','_blank'); if(!w) return alert('اسمح بالنوافذ المنبثقة');
    w.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>مهام إدارية</title><style>body{font-family:Tahoma;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px;text-align:right;vertical-align:top}th{background:#eef6f3}.d{white-space:pre-wrap}</style></head><body><h2>تقرير المهام الإدارية</h2><table><thead><tr><th>الحالة</th><th>المهمة</th><th>من</th><th>إلى</th><th>الأولوية</th><th>الجدولة</th><th>أنشئت</th></tr></thead><tbody>${list.map(t=>`<tr><td>${esc(t.status)}</td><td><b>${esc(t.title)}</b><div class="d">${esc(t.details)}</div></td><td>${esc(t.from_name)}</td><td>${esc(t.to_name)}</td><td>${esc(t.priority)}</td><td>${formatDate(t.due_at)}</td><td>${formatDate(t.created_at)}</td></tr>`).join('')}</tbody></table></body></html>`);
    w.document.close(); setTimeout(()=>w.print(),300);
  }
  function bind(){
    $('at26ShowForm').onclick=()=>{ $('at26Form').style.display='block'; loadUsers(); };
    $('at26Cancel').onclick=()=>{ $('at26Form').style.display='none'; clearForm(); };
    $('at26Save').onclick=saveTask;
    $('at26Refresh').onclick=()=>loadUsers().then(loadTasks).then(showReminder).catch(e=>alert(e.message||e));
    $('at26ScheduleType').onchange=()=>{ if($('at26ScheduleType').value==='فورية') $('at26Due').value=''; };
    $('at26Search').oninput=render; $('at26FilterPriority').onchange=render; $('at26Print').onclick=printRows;
    document.querySelectorAll('.at26-tab').forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab; render();});
    $('at26Dismiss').onclick=()=>{ if(reminderId) localStorage.setItem(DISMISS_PREFIX+reminderId+'_'+todayKey(),'1'); $('at26Reminder').classList.remove('show'); };
    $('at26OpenReminder').onclick=()=>{ $('at26Reminder').classList.remove('show'); openPage(); setTimeout(()=>{ const tr=document.querySelector(`tr[data-id="${CSS.escape(String(reminderId))}"]`); if(tr) tr.scrollIntoView({behavior:'smooth',block:'center'}); },600); };
  }
  async function init(){
    injectCss(); ensureNav(); ensureSection(); bind(); fillUsersSelect();
    setTimeout(ensureNav,500); setTimeout(ensureNav,1800); setTimeout(ensureNav,3500);
    try{ await loadUsers(); await loadTasks(); setTimeout(showReminder,800); }catch(e){ console.warn('admin tasks init failed',e); }
  }
  window.tasneefAdminTasksV10126={open:openPage,loadTasks,loadUsers,diagnose:()=>({version:VERSION,user:readCurrentUser(),aliases:userAliases(),users,rows,relevant:rows.filter(isRelevant)})};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else setTimeout(init,250);
})();

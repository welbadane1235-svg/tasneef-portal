/* Tasneef v10123 - Administrative Tasks Sidebar Restore + Online Robust Save Fix
   Scope: new section only. Does not touch finance, inventory, orders, tickets, contracts, attendance, monthly, or permissions.
*/
(function(){
  'use strict';
  if(window.__tasneefAdminTasksV10125) return;
  window.__tasneefAdminTasksV10125 = true;

  const VERSION='v10125-admin-tasks-no-freeze-sidebar-stable';
  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const TABLE='admin_tasks';
  const LOCAL_KEY='tasneef_admin_tasks_v10125_local';
  const DISMISS_PREFIX='tasneef_admin_task_dismiss_v10125_';

  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const esc=v=>S(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  const nowIso=()=>new Date().toISOString();
  const todayKey=()=>new Date().toISOString().slice(0,10);
  const $=id=>document.getElementById(id);
  const say=(t,type)=>{ try{ if(typeof window.msg==='function') window.msg(t,type); else console.log(t); }catch(_){ console.log(t); } };

  function scoreUserObj(v){
    if(!v || typeof v!=='object' || Array.isArray(v)) return 0;
    const txt=[v.full_name,v.fullName,v.name,v.display_name,v.username,v.user_name,v.email,v.role,v.user_role,v.type,v.position].map(S).join(' ');
    let score=0;
    if(S(v.username||v.user_name||v.email||v.id||v.user_id||v.uid)) score+=4;
    if(S(v.full_name||v.fullName||v.name||v.display_name)) score+=3;
    if(S(v.role||v.user_role||v.type||v.position)) score+=2;
    if(/admin|manager|supervisor|technician|مدير|مشرف|فني|مالي|تشغيل|مخزن/i.test(txt)) score+=2;
    if(v.password || v.permissions || v.active!==undefined || v.is_active!==undefined) score+=1;
    return score;
  }
  function currentUser(){
    const directKeys=['tasneef_user','currentUser','user','tasneef_current_user','tasneef_login_user','loggedUser','logged_user','tasneef_logged_user','auth_user','session_user','current_user'];
    const stores=[];
    try{ stores.push(localStorage); }catch(_){}
    try{ stores.push(sessionStorage); }catch(_){}
    let best=null, bestScore=0;
    const consider=(v)=>{
      if(!v || typeof v!=='object') return;
      if(v.user && typeof v.user==='object') consider(v.user);
      if(v.profile && typeof v.profile==='object') consider(v.profile);
      if(v.currentUser && typeof v.currentUser==='object') consider(v.currentUser);
      const sc=scoreUserObj(v);
      if(sc>bestScore){ best=v; bestScore=sc; }
    };
    for(const st of stores){
      for(const k of directKeys){
        try{ const raw=st.getItem(k); if(!raw) continue; consider(JSON.parse(raw)); }catch(_){ }
      }
      try{
        for(let i=0;i<st.length;i++){
          const k=st.key(i)||'';
          if(!/user|login|auth|session|current|account|tasneef/i.test(k)) continue;
          const raw=st.getItem(k); if(!raw || raw.length>200000) continue;
          let v; try{ v=JSON.parse(raw); }catch(_){ continue; }
          if(Array.isArray(v)) v.forEach(consider); else consider(v);
        }
      }catch(_){ }
    }
    ['currentUser','loggedUser','tasneefUser','user','authUser','tasneef_current_user'].forEach(k=>{ try{ consider(window[k]); }catch(_){} });
    // احتياط: بعض النسخ تعرض اسم المستخدم الحالي في عناصر الواجهة فقط
    try{
      const txt=(document.querySelector('#currentUserName,#loggedUserName,#userDisplayName,.current-user,.user-name,.brand small')||{}).textContent||'';
      if(txt && /[ء-يA-Za-z0-9]/.test(txt)) consider({name:txt, full_name:txt, role:txt});
    }catch(_){}
    return best || {};
  }
  function normUserKey(v){
    return S(v).toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g,'')
      .replace(/ـ/g,'')
      .replace(/[أإآ]/g,'ا')
      .replace(/ى/g,'ي')
      .replace(/ة/g,'ه')
      .replace(/\s+/g,'')
      .replace(/[|،,;؛:\-_/\\()\[\]{}]+/g,'');
  }
  function uniqueKeys(vals){
    const out=[]; const seen=new Set();
    vals.map(S).filter(Boolean).forEach(v=>{
      [v, v.toLowerCase(), normUserKey(v)].forEach(x=>{ x=S(x); if(x && !seen.has(x)){ seen.add(x); out.push(x); } });
    });
    return out;
  }
  function currentKeys(u=currentUser()){
    const vals=[u.id,u.uid,u.user_id,u.username,u.user_name,u.email,u.full_name,u.fullName,u.name,u.display_name,u.login,u.mobile,u.phone];
    // توسعة المفاتيح من جدول إدارة المستخدمين: إذا عرفنا اسم/مستخدم الحساب الحالي نضيف كل معرفات نفس المستخدم.
    try{
      const base=uniqueKeys(vals);
      A(systemUsersCache).forEach(x=>{
        const aliases=A(x.aliases).length?x.aliases:[x.login,x.name,x.email,x.id,x.username];
        const expanded=uniqueKeys(aliases);
        if(expanded.some(a=>base.some(b=>sameUserMatch(a,b)))) vals.push(...expanded);
      });
    }catch(_){ }
    return uniqueKeys(vals);
  }
  function userName(u=currentUser()){ return S(u.full_name||u.fullName||u.name||u.display_name||u.username||u.email||'مستخدم'); }
  function userLogin(u=currentUser()){ return S(u.username||u.user_name||u.email||u.id||u.name||u.full_name||''); }
  function userRole(u=currentUser()){ return S(u.role||u.user_role||u.type||u.position||''); }
  function isManager(){
    const u=currentUser();
    const txt=[u.role,u.user_role,u.type,u.position,u.username,u.full_name,u.name,u.email].map(S).join(' ').toLowerCase();
    return /admin|manager|owner|system|مدير|اداري|إداري|ادارة|إدارة|النظام/.test(txt) || ['admin','general_manager','operations_manager','financial_manager','warehouse_manager','system_admin','owner'].includes(userRole(u));
  }
  function isSupervisor(){ return /supervisor|مشرف/i.test(userRole(currentUser())+' '+userName()); }
  function canCreate(){ return isManager(); }

  async function api(path, options){
    return fetch(SUPABASE_URL+path, Object.assign({
      cache:'no-store',
      headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY,Accept:'application/json','Content-Type':'application/json',Prefer:'return=representation'}
    }, options||{}));
  }

  async function diagnoseAdminTasksTable(){
    try{
      const res=await api('/rest/v1/'+TABLE+'?select=id,title,status,created_at&limit=1',{method:'GET'});
      if(!res.ok){
        const txt=await res.text().catch(()=>String(res.status));
        console.error('admin_tasks diagnostic failed', res.status, txt);
        return {ok:false, message: txt||String(res.status)};
      }
      return {ok:true};
    }catch(e){
      console.error('admin_tasks diagnostic exception', e);
      return {ok:false, message:e.message||String(e)};
    }
  }

  function readLocal(){ return []; }
  function writeLocal(rows){ /* v10121: لا نحفظ المهام محليًا حتى تظهر لكل المستخدمين من Supabase فقط */ }

  let state={rows:[], loaded:false, online:true};

  function normalizeTask(t){
    t=t||{};
    return {
      id:t.id || t.local_id || ('L'+Date.now()+Math.random().toString(16).slice(2)),
      title:S(t.title), details:S(t.details), task_type:S(t.task_type||'مهمة إدارية'), priority:S(t.priority||'عادي'), schedule_type:S(t.schedule_type||t.scheduleType||'مجدولة'),
      from_user:S(t.from_user), from_name:S(t.from_name), to_user:S(t.to_user), to_name:S(t.to_name), to_role:S(t.to_role),
      due_at:S(t.due_at), status:S(t.status||'open'), created_at:S(t.created_at||nowIso()), updated_at:S(t.updated_at||nowIso()),
      closed_at:S(t.closed_at), closed_by:S(t.closed_by), approved_at:S(t.approved_at), approved_by:S(t.approved_by), approved_note:S(t.approved_note)
    };
  }
  function sortRows(rows){
    return A(rows).map(normalizeTask).sort((a,b)=>{
      const order={open:0,closed:1,approved:2}; const ao=order[a.status]??3, bo=order[b.status]??3; if(ao!==bo) return ao-bo;
      const ad=a.due_at||'9999', bd=b.due_at||'9999'; const dc=ad.localeCompare(bd); if(dc) return dc;
      return S(b.created_at).localeCompare(S(a.created_at));
    });
  }
  async function loadTasks(){
    try{
      const res=await api('/rest/v1/'+TABLE+'?select=*&order=created_at.desc&limit=1000',{method:'GET'});
      if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
      const onlineRows=await res.json();
      state.rows=sortRows(onlineRows);
      state.online=true;
    }catch(e){
      console.error('v10121 load online failed', e);
      state.rows=[];
      state.online=false;
      say('تعذر تحميل المهام من Supabase. شغّل SQL v10125 ثم أعد فتح الصفحة.','err');
    }
    state.loaded=true;
    return state.rows;
  }

  async function saveTask(payload){
    payload=normalizeTask(Object.assign({},payload,{updated_at:nowIso()}));
    if(String(payload.id).startsWith('L')) delete payload.id;
    try{
      const res=await api('/rest/v1/'+TABLE,{method:'POST',body:JSON.stringify(payload)});
      if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
      let json=[]; try{ json=await res.json(); }catch(_){}
      const saved=Array.isArray(json)?json[0]:json;
      await loadTasks();
      return saved||payload;
    }catch(e){
      console.error('v10125 save online failed', e);
      const details=(e && e.message) ? String(e.message).slice(0,700) : '';
      say('لم يتم حفظ المهمة أونلاين. شغّل SQL v10125 وتأكد من ظهور جدول admin_tasks.','err');
      alert('لم يتم حفظ المهمة أونلاين في Supabase، لذلك لن تظهر للمستلم.\n\nالسبب من Supabase:\n' + details + '\n\nالحل: شغّل ملف admin_tasks_v10125.sql كاملًا ثم اعمل Ctrl+F5 وأعد الحفظ.');
      return null;
    }
  }

  async function patchTask(id, patch){
    patch=Object.assign({},patch,{updated_at:nowIso()});
    if(String(id).startsWith('L')){ alert('هذه مهمة محلية قديمة ولن يتم تحديثها. أعد إنشاء المهمة بعد تشغيل Supabase.'); return; }
    try{
      const res=await api('/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(patch)});
      if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
      await loadTasks();
    }catch(e){ console.error('patchTask failed',e); say('لم يتم تحديث المهمة: '+(e.message||e),'err'); }
  }

  function roleLabel(r){
    r=S(r);
    const m={admin:'مدير عام',general_manager:'مدير عام',operations_manager:'مدير تشغيلي',financial_manager:'مدير مالي',warehouse_manager:'مدير مخازن',supervisor:'مشرف',technician:'فني'};
    return m[r]||r;
  }
  let systemUsersCache=[];
  async function collectUsers(){
    const out=[]; const seen=new Set();
    const add=u=>{
      if(!u||typeof u!=='object') return;
      const active = u.active ?? u.is_active ?? u.status;
      if(active===false || active==='false' || active==='موقوف' || active==='inactive') return;
      const name=S(u.full_name||u.fullName||u.name||u.display_name||u.username||u.user_name||u.email||u.id||u.uid||u.user_id);
      const role=S(u.role||u.user_role||u.type||u.position||u.job_title||u.title);
      const aliases=uniqueKeys([u.id,u.uid,u.user_id,u.username,u.user_name,u.email,u.full_name,u.fullName,u.name,u.display_name,u.login,u.mobile,u.phone,name]);
      const login=S(u.username||u.user_name||u.email||u.login||u.id||u.uid||u.user_id||name);
      if(!name&&!login) return;
      const key=normUserKey(login||name); if(seen.has(key)) return; seen.add(key);
      out.push({name:name||login, login:login||name, role, aliases});
    };

    // المصدر الرسمي: جدول إدارة المستخدمين app_users فقط
    try{
      const res=await api('/rest/v1/app_users?select=*&limit=1000',{method:'GET'});
      if(res.ok){
        const rows=await res.json();
        A(rows).forEach(add);
      }else{
        console.warn('app_users load failed', await res.text().catch(()=>res.status));
      }
    }catch(e){ console.warn('app_users fetch error', e); }

    // احتياط: إذا كان جدول إدارة المستخدمين معروضًا في الصفحة، نقرأ أسماءه فقط
    try{
      document.querySelectorAll('#usersBody tr').forEach(tr=>{
        const cells=[...tr.children].map(td=>S(td.textContent));
        if(cells.length>=2) add({full_name:cells[0], username:cells[1], role:cells[2], active:!/موقوف|false|inactive/i.test(cells[3]||'')});
      });
    }catch(_){ }

    // احتياط محلي محدود جدًا: مفاتيح المستخدمين فقط، وليس العمال أو المشرفين أو المشاريع
    try{
      ['app_users','tasneef_app_users','tasneef_users','users','appUsers'].forEach(k=>{
        const raw=localStorage.getItem(k); if(!raw) return;
        let v; try{v=JSON.parse(raw);}catch(_){return;}
        if(Array.isArray(v)) v.forEach(add);
        else if(v && typeof v==='object') A(v.rows||v.data||v.users||[]).forEach(add);
      });
    }catch(_){ }

    // تأكد أن المستخدم الحالي موجود في القائمة، إذا لم تصل بيانات إدارة المستخدمين لأي سبب
    add(currentUser());
    out.sort((a,b)=>a.name.localeCompare(b.name,'ar'));
    systemUsersCache=out;
    return out;
  }

  function injectCss(){
    if($('tasneefAdminTasksStyleV10125')) return;
    const st=document.createElement('style'); st.id='tasneefAdminTasksStyleV10125';
    st.textContent=`
      .at10121-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
      .at10121-grid{display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:10px}.at10121-grid .wide{grid-column:span 2}.at10121-grid .full{grid-column:1/-1}
      .at10121-muted{color:#60706a;font-size:13px;line-height:1.7}.at10121-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.at10121-chip{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:5px 9px;background:#eef6f3;color:#0A4033;font-weight:900;font-size:12px}.at10121-chip.red{background:#fde8e8;color:#9d2222}.at10121-chip.amber{background:#fff5da;color:#8a6700}.at10121-chip.green{background:#e8f4ee;color:#137a4b}.at10121-btn-mini{padding:7px 9px!important;border-radius:9px!important;font-size:12px!important}.at10121-form{display:none}.at10121-form.show{display:block}.at10121-empty{padding:18px;text-align:center;color:#60706a}.at10121-task-title{font-weight:900;color:#0A4033}.at10121-details{max-width:420px;white-space:normal;line-height:1.7;color:#263b35}.at10121-badge-count{display:inline-grid;place-items:center;min-width:20px;height:20px;border-radius:999px;background:#b83232;color:#fff;font-size:11px;margin-inline-start:6px;padding:0 5px}
      .at10121-modal{position:fixed;inset:0;background:rgba(2,15,11,.48);z-index:999999;display:none;align-items:center;justify-content:center;padding:18px}.at10121-modal.show{display:flex}.at10121-box{width:min(560px,96vw);background:#fff;border-radius:24px;border:1px solid #dce6e2;box-shadow:0 24px 70px rgba(0,0,0,.25);overflow:hidden}.at10121-box-head{background:linear-gradient(135deg,#0A4033,#0f5a47);color:#fff;padding:18px 20px}.at10121-box-head h3{margin:0 0 6px}.at10121-box-body{padding:18px 20px}.at10121-reminder-card{background:#f8fbfa;border:1px solid #dce6e2;border-radius:16px;padding:13px;line-height:1.8}.at10121-box-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;padding:0 20px 20px}.at10121-box-actions .light{background:#eef6f3;color:#0A4033;border:1px solid #dce6e2}
      .at10121-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.at10121-tab{border:1px solid #dce6e2;background:#fff;color:#0A4033;border-radius:999px;padding:9px 14px;font-weight:900;cursor:pointer}.at10121-tab.active{background:#0A4033;color:#fff}.at10121-tab .count{display:inline-grid;place-items:center;min-width:20px;height:20px;background:#f0b429;color:#0A4033;border-radius:999px;margin-inline-start:6px;padding:0 5px;font-size:11px}
      @media(max-width:900px){.at10121-grid{grid-template-columns:1fr}.at10121-grid .wide{grid-column:auto}.at10121-details{max-width:260px}.at10121-head{align-items:flex-start}}
    `;
    document.head.appendChild(st);
  }


  function sidebarContainer(){
    return document.querySelector('.side') || document.querySelector('.sidebar') || document.querySelector('aside') || document.querySelector('[class*="side"]') || document.body;
  }
  function ensureAdminTasksNav(){
    let btn=document.querySelector('button.nav[data-page="adminTasks"], button[data-page="adminTasks"], button[data-section="adminTasks"], #at10125AdminTasksNav');
    if(!btn){
      btn=document.createElement('button');
      btn.className='nav';
      btn.id='at10125AdminTasksNav';
      btn.setAttribute('data-page','adminTasks');
      btn.setAttribute('data-section','adminTasks');
      btn.setAttribute('data-permission','adminTasks');
      btn.setAttribute('data-module','adminTasks');
      btn.innerHTML='مهام إدارية <span id="at10121NavBadge" class="at10121-badge-count" style="display:none">0</span>';
      btn.onclick=function(e){ try{ e.preventDefault(); e.stopPropagation(); }catch(_){} openPage(); return false; };
      const container=sidebarContainer();
      const all=[...container.querySelectorAll('button.nav, button')];
      const logout=all.find(b=>/تسجيل\s*خروج/.test(S(b.textContent)));
      if(logout && logout.parentNode) logout.parentNode.insertBefore(btn, logout);
      else container.appendChild(btn);
    }
    btn.classList.add('nav');
    btn.id='at10125AdminTasksNav';
    btn.setAttribute('data-page','adminTasks');
    btn.setAttribute('data-section','adminTasks');
    btn.setAttribute('data-permission','adminTasks');
    btn.onclick=function(e){ try{ e.preventDefault(); e.stopPropagation(); }catch(_){} openPage(); return false; };
    btn.hidden=false;
    btn.removeAttribute('hidden');
    btn.removeAttribute('disabled');
    btn.style.setProperty('display','block','important');
    btn.style.setProperty('visibility','visible','important');
    btn.style.setProperty('opacity','1','important');
    if(!/مهام\s*إدارية/.test(S(btn.textContent))) btn.innerHTML='مهام إدارية <span id="at10121NavBadge" class="at10121-badge-count" style="display:none">0</span>';
    return btn;
  }
  function startNavKeeper(){
    if(window.__at10125NavKeeperStarted) return;
    window.__at10125NavKeeperStarted=true;
    let busy=false;
    const run=()=>{
      if(busy) return;
      busy=true;
      try{ ensureAdminTasksNav(); }catch(e){ console.warn('admin tasks nav restore failed',e); }
      setTimeout(()=>{ busy=false; },120);
    };
    run(); setTimeout(run,700); setTimeout(run,1800); setTimeout(run,3500);
    // لا نراقب خصائص style/class حتى لا ندخل في حلقة لا نهائية وتتعطل الصفحة.
    try{
      const container=sidebarContainer();
      if(container && !window.__at10125NavObserver){
        window.__at10125NavObserver = new MutationObserver(()=>setTimeout(run,150));
        window.__at10125NavObserver.observe(container,{childList:true,subtree:true});
      }
    }catch(_){ }
    setInterval(run,12000);
  }

  function ensureNavAndSection(){
    injectCss();
    if(!$('adminTasks')){
      const content=document.querySelector('.content')||document.body;
      const sec=document.createElement('section'); sec.id='adminTasks'; sec.className='page hidden';
      sec.innerHTML=`
        <div class="card section-head at10121-head">
          <div><h2>مهام إدارية</h2><p>إرسال ومتابعة المهام بين الإداريين والمشرفين مع مهمة فورية أو مجدولة، وإغلاق ثم اعتماد من منشئ المهمة.</p></div>
          <div class="at10121-actions"><button onclick="window.tasneefAdminTasksV10121.openNew()" id="at10121NewBtn">إضافة مهمة</button><button class="light" onclick="window.tasneefAdminTasksV10121.refresh()">تحديث</button></div>
        </div>
        <div class="card at10121-form" id="at10121FormCard">
          <h2>إضافة مهمة إدارية</h2>
          <div class="at10121-muted">المرسل يتم تسجيله تلقائيًا باسم المستخدم الحالي. المستلم يتم اختياره من أسماء المستخدمين في إدارة المستخدمين فقط، وتظهر المهمة في حساب المستلم وللمرسل لمتابعة الإغلاق والاعتماد.</div>
          <div class="at10121-grid">
            <div class="wide"><label>عنوان المهمة</label><input id="at10121Title" placeholder="مثال: مراجعة تقرير التشغيل اليومي"></div>
            <div><label>نوع الجدولة</label><select id="at10121ScheduleType" onchange="window.tasneefAdminTasksV10121.toggleSchedule()"><option>مهمة فورية</option><option selected>مجدولة</option></select></div>
            <div><label>الأولوية</label><select id="at10121Priority"><option>عادي</option><option>مهم</option><option>عاجل</option></select></div>
            <div><label>تاريخ ووقت الجدولة</label><input id="at10121Due" type="datetime-local"></div>
            <div class="wide"><label>المستلم من إدارة المستخدمين</label><select id="at10121Recipient"></select><div class="at10121-muted">تظهر هنا أسماء المستخدمين المسجلين في قسم إدارة المستخدمين فقط.</div></div>
            <div class="wide"><label>نوع المهمة</label><select id="at10121Type"><option>مهمة إدارية</option><option>متابعة تشغيل</option><option>متابعة مالية</option><option>متابعة مشروع</option><option>طلب تقرير</option><option>ملاحظة عاجلة</option></select></div>
            <div class="full"><label>تفاصيل المهمة</label><textarea id="at10121Details" placeholder="اكتب تفاصيل المهمة المطلوبة بوضوح..."></textarea></div>
          </div>
          <div class="actions"><button onclick="window.tasneefAdminTasksV10121.create()">حفظ المهمة</button><button class="light" onclick="window.tasneefAdminTasksV10121.closeNew()">إلغاء</button></div>
        </div>
        <div class="kpis small" id="at10121Kpis"></div>
        <div class="card">
          <div class="at10121-tabs" id="at10121Tabs">
            <button class="at10121-tab active" data-tab="mine" onclick="window.tasneefAdminTasksV10121.setTab('mine')">مهامي <span class="count" id="at10121CountMine">0</span></button>
            <button class="at10121-tab" data-tab="open" onclick="window.tasneefAdminTasksV10121.setTab('open')">مهام مفتوحة <span class="count" id="at10121CountOpen">0</span></button>
            <button class="at10121-tab" data-tab="closed" onclick="window.tasneefAdminTasksV10121.setTab('closed')">مهام مغلقة <span class="count" id="at10121CountClosed">0</span></button>
            <button class="at10121-tab" data-tab="approved" onclick="window.tasneefAdminTasksV10121.setTab('approved')">تم الاعتماد <span class="count" id="at10121CountApproved">0</span></button>
          </div>
          <div class="filters">
            <input id="at10121Search" placeholder="بحث في المهام" oninput="window.tasneefAdminTasksV10121.render()">
            <select id="at10121PriorityFilter" onchange="window.tasneefAdminTasksV10121.render()"><option value="">كل الأولويات</option><option>عادي</option><option>مهم</option><option>عاجل</option></select>
            <select id="at10121TypeFilter" onchange="window.tasneefAdminTasksV10121.render()"><option value="">كل أنواع المهام</option><option>مهمة إدارية</option><option>متابعة تشغيل</option><option>متابعة مالية</option><option>متابعة مشروع</option><option>طلب تقرير</option><option>ملاحظة عاجلة</option></select>
            <select id="at10121ScheduleFilter" onchange="window.tasneefAdminTasksV10121.render()"><option value="">فورية ومجدولة</option><option>مهمة فورية</option><option>مجدولة</option></select>
            <input id="at10121FromDate" type="date" title="من تاريخ" onchange="window.tasneefAdminTasksV10121.render()">
            <input id="at10121ToDate" type="date" title="إلى تاريخ" onchange="window.tasneefAdminTasksV10121.render()">
            <button class="light" onclick="window.tasneefAdminTasksV10121.print()">طباعة المعروض</button>
          </div>
          <div class="table-wrap"><table><thead><tr><th>الحالة</th><th>المهمة</th><th>من</th><th>إلى</th><th>الجدولة</th><th>أنشئت</th><th>أغلقت</th><th>اعتمدت</th><th>إجراء</th></tr></thead><tbody id="at10121Body"></tbody></table></div>
        </div>`;
      content.appendChild(sec);
    }
    if(!$('at10121Modal')){
      const modal=document.createElement('div'); modal.id='at10121Modal'; modal.className='at10121-modal';
      modal.innerHTML=`<div class="at10121-box"><div class="at10121-box-head"><h3>تذكير مهمة إدارية</h3><div id="at10121ModalSub">لديك مهمة تحتاج متابعة</div></div><div class="at10121-box-body"><div id="at10121ModalContent" class="at10121-reminder-card"></div></div><div class="at10121-box-actions"><button class="light" onclick="window.tasneefAdminTasksV10121.dismissReminder()">إغلاق التذكير</button><button onclick="window.tasneefAdminTasksV10121.openFromReminder()">فتح المهمة</button></div></div>`;
      document.body.appendChild(modal);
    }
    ensureAdminTasksNav();
    fillRecipients();
    if(!canCreate()){
      const nb=$('at10121NewBtn'); if(nb) nb.style.display='none';
      const fc=$('at10121FormCard'); if(fc) fc.classList.remove('show');
    }
  }

  async function fillRecipients(){
    const sel=$('at10121Recipient'); if(!sel) return;
    const old=sel.value;
    sel.innerHTML=`<option value="">جاري تحميل أسماء المستخدمين...</option>`;
    let users=[];
    try{ users=await collectUsers(); }catch(e){ console.warn('collect system users failed', e); users=systemUsersCache||[]; }
    let html=`<option value="">اختر المستلم من إدارة المستخدمين</option>`;
    users.forEach((u,idx)=>{
      const payload={login:u.login,name:u.name,role:u.role,aliases:A(u.aliases).length?u.aliases:[u.login,u.name]};
      const val='userjson:'+btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      html+=`<option value="${esc(val)}">${esc(u.name)}${u.role?' - '+esc(roleLabel(u.role)):''}</option>`;
    });
    if(!users.length) html+=`<option value="">لا توجد أسماء مستخدمين - راجع إدارة المستخدمين</option>`;
    sel.innerHTML=html;
    if(old) sel.value=old;
  }
  function parseRecipient(){
    const val=S($('at10121Recipient')&&$('at10121Recipient').value);
    if(!val) return {to_user:'',to_name:'',to_role:''};
    if(val.startsWith('userjson:')){
      try{
        const o=JSON.parse(decodeURIComponent(escape(atob(val.slice(9)))));
        const aliases=uniqueKeys(A(o.aliases).concat([o.login,o.name]));
        return {to_user:aliases.join(' || '),to_name:S(o.name||o.login),to_role:S(o.role)};
      }catch(e){ console.warn('recipient parse json failed', e); }
    }
    const parts=val.split('|');
    return {to_user:S((parts[0]||'').replace('user:','')),to_name:S(parts[1]),to_role:S(parts[2])};
  }
  function dtLocalToIso(v){ if(!S(v)) return ''; const d=new Date(v); return isNaN(d.getTime())?'':d.toISOString(); }
  function formatDate(v){ if(!S(v)) return '—'; try{return new Date(v).toLocaleString('ar-SA',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}catch(_){return S(v);} }
  function priorityChip(p){ p=S(p)||'عادي'; const cls=p==='عاجل'?'red':(p==='مهم'?'amber':'green'); return `<span class="at10121-chip ${cls}">${esc(p)}</span>`; }
  function statusChip(t){ return t.status==='approved'?'<span class="at10121-chip green">تم الاعتماد</span>':(t.status==='closed'?'<span class="at10121-chip amber">مغلقة</span>':'<span class="at10121-chip amber">مفتوحة</span>'); }
  function isOverdue(t){ return t.status==='open' && S(t.due_at) && new Date(t.due_at).getTime() < Date.now(); }
  function splitUserTargets(vals){
    const raw=[];
    vals.forEach(v=>{ S(v).split(/\s*\|\|\s*|\s*[,،؛;]\s*/).forEach(x=>raw.push(x)); });
    return uniqueKeys(raw);
  }
  function sameUserMatch(a,b){
    a=S(a); b=S(b);
    if(!a || !b) return false;
    const na=normUserKey(a), nb=normUserKey(b);
    if(!na || !nb) return false;
    if(na===nb) return true;
    if(na.length>=3 && nb.includes(na)) return true;
    if(nb.length>=3 && na.includes(nb)) return true;
    return false;
  }
  function matchesCurrentUser(t){
    const keys=currentKeys(); const role=normUserKey(userRole());
    const targets=splitUserTargets([t.to_user,t.to_name]);
    if(targets.some(target=>keys.some(k=>sameUserMatch(target,k)))) return true;
    const tr=normUserKey(t.to_role);
    if(tr && (tr===role || (tr===normUserKey('supervisor') && isSupervisor()) || (tr===normUserKey('مشرف') && isSupervisor()) || (tr===normUserKey('admin') && isManager()))) return true;
    return false;
  }
  function isSender(t){
    const keys=currentKeys();
    const targets=splitUserTargets([t.from_user,t.from_name]);
    return targets.some(target=>keys.some(k=>sameUserMatch(target,k))) || (!targets.length && S(t.from_name)==='مستخدم');
  }
  function isRelevant(t){
    // إدارة النظام ترى كل المهام للمتابعة والاعتماد، حتى لو تعذر مطابقة اسم الجلسة.
    if(isManager()) return true;
    return matchesCurrentUser(t) || isSender(t);
  }
  let currentTab='mine';

  function filteredRows(){
    const q=S($('at10121Search')&&$('at10121Search').value).toLowerCase();
    const pr=S($('at10121PriorityFilter')&&$('at10121PriorityFilter').value);
    const tf=S($('at10121TypeFilter')&&$('at10121TypeFilter').value);
    const sf=S($('at10121ScheduleFilter')&&$('at10121ScheduleFilter').value);
    const from=S($('at10121FromDate')&&$('at10121FromDate').value);
    const to=S($('at10121ToDate')&&$('at10121ToDate').value);
    return state.rows.filter(t=>{
      if(!isRelevant(t)) return false;
      if(pr && t.priority!==pr) return false;
      if(tf && t.task_type!==tf) return false;
      if(sf && t.schedule_type!==sf) return false;
      if(from && S(t.created_at).slice(0,10)<from) return false;
      if(to && S(t.created_at).slice(0,10)>to) return false;
      if(q && ![t.title,t.details,t.from_name,t.to_name,t.task_type,t.priority,t.schedule_type].join(' ').toLowerCase().includes(q)) return false;
      if(currentTab==='mine' && !(t.status==='open' && matchesCurrentUser(t))) return false;
      if(currentTab==='open' && !(t.status==='open' && isRelevant(t))) return false;
      if(currentTab==='closed' && !(t.status==='closed' && isRelevant(t))) return false;
      if(currentTab==='approved' && !(t.status==='approved' && isRelevant(t))) return false;
      return true;
    });
  }


  function render(){
    ensureNavAndSection();
    const rows=filteredRows();
    const rel=state.rows.filter(isRelevant);
    const open=rel.filter(t=>t.status==='open').length;
    const closed=rel.filter(t=>t.status==='closed').length;
    const approved=rel.filter(t=>t.status==='approved').length;
    const mine=rel.filter(t=>t.status==='open'&&matchesCurrentUser(t)).length;
    const overdue=rel.filter(isOverdue).length;
    const k=$('at10121Kpis'); if(k) k.innerHTML=`<div class="kpi"><small>مهامي</small><b>${mine}</b></div><div class="kpi"><small>مهام مفتوحة</small><b>${open}</b></div><div class="kpi"><small>مهام مغلقة تنتظر اعتماد</small><b>${closed}</b></div><div class="kpi"><small>المهام المتأخرة</small><b>${overdue}</b></div>`;
    const badge=$('at10121NavBadge'); if(badge){ badge.textContent=mine; badge.style.display=mine? 'inline-grid':'none'; }
    const counts={Mine:mine,Open:open,Closed:closed,Approved:approved}; Object.keys(counts).forEach(k2=>{ const el=$('at10121Count'+k2); if(el) el.textContent=counts[k2]; });
    document.querySelectorAll('.at10121-tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===currentTab));
    const body=$('at10121Body'); if(!body) return;
    if(!rows.length){ body.innerHTML=`<tr><td colspan="9" class="at10121-empty">لا توجد مهام حسب الفلتر الحالي</td></tr>`; return; }
    body.innerHTML=rows.map(t=>`
      <tr data-at-id="${esc(t.id)}">
        <td>${statusChip(t)}${isOverdue(t)?' <span class="at10121-chip red">متأخرة</span>':''}</td>
        <td><div class="at10121-task-title">${esc(t.title||'بدون عنوان')}</div><div>${priorityChip(t.priority)} <span class="at10121-chip">${esc(t.task_type||'مهمة إدارية')}</span> <span class="at10121-chip">${esc(t.schedule_type||'مجدولة')}</span></div><div class="at10121-details">${esc(t.details||'')}</div></td>
        <td>${esc(t.from_name||t.from_user||'—')}</td>
        <td>${esc(t.to_name||roleLabel(t.to_role)||t.to_user||'—')}</td>
        <td>${formatDate(t.due_at)}</td>
        <td>${formatDate(t.created_at)}</td>
        <td>${t.closed_at?formatDate(t.closed_at):'—'}</td>
        <td>${t.approved_at?formatDate(t.approved_at):'—'}</td>
        <td><div class="row-actions"><button class="light at10121-btn-mini" onclick="window.tasneefAdminTasksV10121.view('${esc(t.id)}')">عرض</button>${t.status==='open'&&matchesCurrentUser(t)?`<button class="at10121-btn-mini" onclick="window.tasneefAdminTasksV10121.closeTask('${esc(t.id)}')">إغلاق المهمة</button>`:''}${t.status==='closed'&&isSender(t)?`<button class="at10121-btn-mini" onclick="window.tasneefAdminTasksV10121.approveTask('${esc(t.id)}')">اعتماد</button>`:''}</div></td>
      </tr>`).join('');
  }
  async function refresh(){ await loadTasks(); render(); }
  function openNew(){ if(!canCreate()) return alert('إضافة المهام متاحة للإدارة فقط'); ensureNavAndSection(); $('at10121FormCard').classList.add('show'); fillRecipients(); }
  function closeNew(){ const f=$('at10121FormCard'); if(f) f.classList.remove('show'); }
  async function create(){
    if(!canCreate()) return alert('إضافة المهام متاحة للإدارة فقط');
    const title=S($('at10121Title')&&$('at10121Title').value); if(!title) return alert('اكتب عنوان المهمة');
    const rec=parseRecipient(); if(!rec.to_user && !rec.to_name) return alert('اختر المستلم من إدارة المستخدمين');
    const diag=await diagnoseAdminTasksTable();
    if(!diag.ok){
      alert('جدول المهام admin_tasks غير جاهز أو لم يتم تحديثه في Supabase.\n\nشغّل ملف admin_tasks_v10125.sql كاملًا ثم اعمل Ctrl+F5.\n\nتفاصيل: ' + String(diag.message||'').slice(0,500));
      return;
    }
    const u=currentUser();
    const scheduleType=S($('at10121ScheduleType')&&$('at10121ScheduleType').value)||'مجدولة';
    const dueVal = scheduleType==='مهمة فورية' ? nowIso() : dtLocalToIso($('at10121Due')&&$('at10121Due').value);
    const payload=Object.assign({
      title, details:S($('at10121Details')&&$('at10121Details').value), task_type:S($('at10121Type')&&$('at10121Type').value)||'مهمة إدارية', priority:S($('at10121Priority')&&$('at10121Priority').value)||'عادي', schedule_type:scheduleType,
      from_user:userLogin(u), from_name:userName(u), due_at:dueVal, status:'open', created_at:nowIso(), updated_at:nowIso()
    }, rec);
    const saved=await saveTask(payload);
    if(!saved) return;
    ['at10121Title','at10121Details','at10121Due'].forEach(id=>{ const el=$(id); if(el) el.value=''; });
    currentTab='open';
    closeNew();
    await refresh();
    say('تم إنشاء المهمة الإدارية وظهرت في مهام مفتوحة','ok');
    setTimeout(()=>{ const id=saved && (saved.id||saved.local_id); const tr=id&&document.querySelector(`tr[data-at-id="${CSS.escape(String(id))}"]`); if(tr) tr.scrollIntoView({behavior:'smooth',block:'center'}); },500);
  }
  function view(id){
    const t=state.rows.find(x=>String(x.id)===String(id)); if(!t) return;
    ensureNavAndSection();
    $('at10121ModalSub').textContent='عرض مهمة إدارية';
    $('at10121ModalContent').innerHTML=`<b>${esc(t.title)}</b><br><br><b>من:</b> ${esc(t.from_name||t.from_user||'—')}<br><b>إلى:</b> ${esc(t.to_name||roleLabel(t.to_role)||t.to_user||'—')}<br><b>الأولوية:</b> ${esc(t.priority)}<br><b>نوع الجدولة:</b> ${esc(t.schedule_type||'مجدولة')}<br><b>الجدولة:</b> ${formatDate(t.due_at)}<br><b>أنشئت:</b> ${formatDate(t.created_at)}<br><b>أغلقت:</b> ${t.closed_at?formatDate(t.closed_at):'—'}<br><b>اعتمدت:</b> ${t.approved_at?formatDate(t.approved_at):'—'}<hr style="border:0;border-top:1px solid #dce6e2"><div style="white-space:pre-wrap;line-height:1.8">${esc(t.details||'لا توجد تفاصيل')}</div>`;
    const modal=$('at10121Modal'); if(modal) modal.classList.add('show');
    window.__at10121ReminderTaskId=id;
  }
  async function closeTask(id){
    if(!matchesCurrentUser(state.rows.find(x=>String(x.id)===String(id))||{})) return alert('الإغلاق متاح للمستلم فقط');
    if(!confirm('تأكيد إغلاق المهمة؟ ستنتظر اعتماد منشئ المهمة.')) return;
    await patchTask(id,{status:'closed',closed_at:nowIso(),closed_by:userName()});
    render(); say('تم إغلاق المهمة وتنتظر اعتماد منشئ المهمة','ok');
  }
  async function approveTask(id){
    const t=state.rows.find(x=>String(x.id)===String(id));
    if(!t) return;
    if(!isSender(t)) return alert('الاعتماد متاح فقط لمن أنشأ المهمة');
    if(t.status!=='closed') return alert('لا يمكن اعتماد المهمة قبل إغلاقها من المستلم');
    if(!confirm('اعتماد إغلاق المهمة؟')) return;
    await patchTask(id,{status:'approved',approved_at:nowIso(),approved_by:userName()});
    currentTab='approved'; render(); say('تم اعتماد المهمة','ok');
  }
  function setTab(tab){ currentTab=tab||'mine'; render(); }
  function toggleSchedule(){
    const st=S($('at10121ScheduleType')&&$('at10121ScheduleType').value);
    const due=$('at10121Due'); if(!due) return;
    if(st==='مهمة فورية'){ due.value=''; due.disabled=true; }
    else due.disabled=false;
  }

  function openPage(){
    ensureNavAndSection();
    const nav=document.querySelector('button.nav[data-page="adminTasks"]');
    try{ if(typeof window.showPage==='function') window.showPage('adminTasks',nav); else throw new Error('no showPage'); }
    catch(_){
      document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));
      const sec=$('adminTasks'); if(sec) sec.classList.remove('hidden');
      document.querySelectorAll('.nav').forEach(b=>b.classList.remove('active')); if(nav) nav.classList.add('active');
    }
    refresh();
  }
  function dueForReminder(t){
    if(t.status!=='open') return false;
    // التذكير يظهر للمستلم فقط، وليس لكل مدير يشاهد قائمة المهام.
    if(!matchesCurrentUser(t)) return false;
    if(!S(t.due_at)) return true;
    return new Date(t.due_at).getTime() <= Date.now();
  }
  let reminderTask=null;
  function showReminderIfAny(){
    const tasks=state.rows.filter(dueForReminder).filter(t=>localStorage.getItem(DISMISS_PREFIX+t.id+'_'+todayKey())!=='1');
    if(!tasks.length) return;
    reminderTask=tasks[0];
    ensureNavAndSection();
    $('at10121ModalSub').textContent=tasks.length>1?`لديك ${tasks.length} مهام مفتوحة تحتاج متابعة`:'لديك مهمة مفتوحة تحتاج متابعة';
    $('at10121ModalContent').innerHTML=`<b>${esc(reminderTask.title)}</b><br><br><b>من:</b> ${esc(reminderTask.from_name||reminderTask.from_user||'—')}<br><b>الأولوية:</b> ${esc(reminderTask.priority)}<br><b>الجدولة:</b> ${formatDate(reminderTask.due_at)}<br><br><div style="white-space:pre-wrap">${esc(reminderTask.details||'')}</div>`;
    $('at10121Modal').classList.add('show');
  }
  function dismissReminder(){
    const m=$('at10121Modal'); if(m) m.classList.remove('show');
    const id=reminderTask && reminderTask.id || window.__at10121ReminderTaskId;
    if(id) try{localStorage.setItem(DISMISS_PREFIX+id+'_'+todayKey(),'1');}catch(_){ }
  }
  function openFromReminder(){
    const m=$('at10121Modal'); if(m) m.classList.remove('show');
    openPage();
    const id=reminderTask && reminderTask.id;
    setTimeout(()=>{ const tr=document.querySelector(`tr[data-at-id="${CSS.escape(String(id||''))}"]`); if(tr) tr.scrollIntoView({behavior:'smooth',block:'center'}); },450);
  }
  function printTasks(){
    const rows=filteredRows();
    const html=`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>طباعة المهام الإدارية</title><style>body{font-family:Tahoma,Arial;padding:24px;color:#10231d}h1{color:#0A4033}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #dce6e2;padding:8px;text-align:right;vertical-align:top}th{background:#eef6f3}.details{white-space:pre-wrap;line-height:1.6}</style></head><body><h1>تقرير المهام الإدارية</h1><p>تاريخ الطباعة: ${new Date().toLocaleString('ar-SA')}</p><table><thead><tr><th>الحالة</th><th>المهمة</th><th>من</th><th>إلى</th><th>الأولوية</th><th>الجدولة</th><th>أنشئت</th><th>أغلقت</th><th>اعتمدت</th></tr></thead><tbody>${rows.map(t=>`<tr><td>${t.status==='approved'?'تم الاعتماد':(t.status==='closed'?'مغلقة':'مفتوحة')}</td><td><b>${esc(t.title)}</b><div class="details">${esc(t.details)}</div></td><td>${esc(t.from_name||t.from_user)}</td><td>${esc(t.to_name||roleLabel(t.to_role)||t.to_user)}</td><td>${esc(t.priority)}</td><td>${formatDate(t.due_at)}</td><td>${formatDate(t.created_at)}</td><td>${t.closed_at?formatDate(t.closed_at):'—'}</td><td>${t.approved_at?formatDate(t.approved_at):'—'}</td></tr>`).join('')}</tbody></table></body></html>`;
    const w=window.open('','_blank'); if(!w) return alert('اسمح بالنوافذ المنبثقة للطباعة'); w.document.write(html); w.document.close(); setTimeout(()=>w.print(),400);
  }

  async function init(){
    ensureNavAndSection();
    startNavKeeper();
    await collectUsers().catch(()=>{});
    await loadTasks();
    await collectUsers().catch(()=>{});
    render();
    setTimeout(showReminderIfAny,900);
    setTimeout(async()=>{ await collectUsers().catch(()=>{}); await loadTasks(); render(); showReminderIfAny(); },4500);
    setTimeout(async()=>{ await collectUsers().catch(()=>{}); await loadTasks(); render(); showReminderIfAny(); },12000);
  }

  function diagnose(){
    const u=currentUser();
    return {version:VERSION,currentUser:u,currentKeys:currentKeys(u),totalTasks:state.rows.length,relevantTasks:state.rows.filter(isRelevant).length,online:state.online,tab:currentTab,users:systemUsersCache};
  }
  window.tasneefAdminTasksV10121={init,refresh,render,open:openPage,openNew,closeNew,create,view,closeTask,approveTask,setTab,toggleSchedule,dismissReminder,openFromReminder,print:printTasks,diagnose};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init,300);
})();

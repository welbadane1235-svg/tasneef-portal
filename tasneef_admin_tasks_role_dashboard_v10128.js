/* Tasneef v10128 - Admin Tasks Role Dashboard + Reminder
   يظهر كرت المهام ونافذة التذكير في نسخ المشرفين والفنيين أيضًا، بدون لمس حفظ المهام.
*/
(function(){
  'use strict';
  if(window.__tasneefAdminTasksRoleDashV10128) return;
  window.__tasneefAdminTasksRoleDashV10128=true;

  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const TABLE='admin_tasks';
  const DISMISS_PREFIX='tasneef_admin_task_reminder_dismiss_v10128_';
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const $=id=>document.getElementById(id);
  const esc=v=>S(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  const todayKey=()=>new Date().toISOString().slice(0,10);
  const safeJson=(raw)=>{ try{return JSON.parse(raw)}catch(_){return null} };

  function normalizeKey(v){
    return S(v).toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g,'').replace(/ـ/g,'')
      .replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
      .replace(/[|،,;؛:\-_/\\()\[\]{}\.]+/g,'')
      .replace(/\s+/g,'');
  }
  function uniqueKeys(vals){
    const out=[], seen=new Set();
    vals.flatMap(v=>S(v).split('|')).map(S).filter(Boolean).forEach(v=>{
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
      ['user','profile','currentUser','account','data'].forEach(k=>{ if(o[k]&&typeof o[k]==='object') consider(o[k]); });
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
      const nodes=[...document.querySelectorAll('#currentUserName,#loggedUserName,#userDisplayName,.current-user,.user-name,.brand small,.brand strong,.welcome,.user-info')];
      nodes.map(n=>S(n.textContent)).filter(Boolean).forEach(txt=>consider({name:txt,full_name:txt,username:txt}));
    }catch(_){ }
    return best||{};
  }
  function userDisplay(u=readCurrentUser()){ return S(u.full_name||u.fullName||u.name||u.display_name||u.username||u.user_name||u.email||'مستخدم'); }
  function userLogin(u=readCurrentUser()){ return S(u.username||u.user_name||u.email||u.login||u.id||u.uid||u.user_id||u.name||u.full_name||''); }
  function userAliases(u=readCurrentUser()){
    return uniqueKeys([u.id,u.uid,u.user_id,u.username,u.user_name,u.email,u.login,u.mobile,u.phone,u.full_name,u.fullName,u.name,u.display_name,userDisplay(u),userLogin(u)]);
  }
  function keyList(t,side){
    const vals=side==='to'?[t.to_user,t.to_name,t.to_keys]:[t.from_user,t.from_name,t.from_keys];
    return uniqueKeys(vals);
  }
  function matches(keys, cur=userAliases()){ return keys.some(a=>cur.some(b=>same(a,b))); }
  function isToMe(t){ return matches(keyList(t,'to')); }
  function isFromMe(t){ return matches(keyList(t,'from')); }
  function relevant(t){ return isToMe(t)||isFromMe(t); }
  function isOpen(t){ return S(t.status||'open')==='open'; }
  function isDue(t){
    if(!isOpen(t) || !isToMe(t)) return false;
    const schedule=S(t.schedule_type||'فورية');
    if(schedule==='فورية' || !S(t.due_at)) return true;
    const d=new Date(t.due_at); return Number.isFinite(d.getTime()) && d.getTime()<=Date.now();
  }
  async function api(path,options){
    return fetch(SUPABASE_URL+path,Object.assign({
      cache:'no-store',
      headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY,Accept:'application/json','Content-Type':'application/json'}
    },options||{}));
  }
  async function loadTasks(){
    const res=await api('/rest/v1/'+TABLE+'?select=*&order=created_at.desc&limit=500',{method:'GET'});
    if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
    return A(await res.json()).filter(relevant);
  }
  function injectCss(){
    if($('at28Style')) return;
    const st=document.createElement('style'); st.id='at28Style'; st.textContent=`
      .at28-task-card{cursor:pointer;position:relative;overflow:hidden;border:1px solid #dce6e2!important;background:linear-gradient(135deg,#fff,#f2fbf8)!important;transition:.18s ease;min-height:82px}.at28-task-card:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(10,64,51,.12)}.at28-task-card small{display:block;color:#61736d}.at28-task-card b{color:#0A4033;font-size:30px}.at28-chip{position:absolute;left:14px;bottom:10px;background:#0A4033;color:#fff;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:900}.at28-chip.warn{background:#b26a00}
      .at28-float{position:fixed;left:18px;bottom:22px;z-index:99990;background:#0A4033;color:#fff;border:0;border-radius:16px;padding:12px 16px;font-weight:900;box-shadow:0 14px 40px rgba(0,0,0,.22);cursor:pointer}.at28-float b{background:#fff;color:#0A4033;border-radius:999px;padding:2px 7px;margin-right:6px}
      .at28-modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:999999;align-items:center;justify-content:center;padding:16px}.at28-modal.show{display:flex}.at28-box{background:#fff;border-radius:22px;width:min(920px,96vw);max-height:86vh;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.28);direction:rtl}.at28-head{background:#0A4033;color:#fff;padding:18px 20px;display:flex;justify-content:space-between;gap:10px;align-items:center}.at28-head h3{margin:0;font-size:22px}.at28-body{padding:16px;overflow:auto;max-height:64vh}.at28-row{border:1px solid #e2ebe8;border-radius:16px;padding:12px;margin-bottom:10px;background:#fff}.at28-row h4{margin:0 0 6px;color:#0A4033}.at28-meta{display:flex;flex-wrap:wrap;gap:7px;color:#61736d;font-size:12px}.at28-badge{background:#eef6f3;color:#0A4033;border-radius:999px;padding:4px 8px;font-weight:900}.at28-badge.red{background:#fde8e8;color:#a32626}.at28-badge.green{background:#e7f5ee;color:#167a4c}.at28-actions{display:flex;gap:8px;justify-content:flex-end;padding:0 16px 16px}.at28-btn{border:0;border-radius:12px;padding:10px 14px;background:#0A4033;color:#fff;font-weight:900;cursor:pointer}.at28-btn.light{background:#eef6f3;color:#0A4033;border:1px solid #d6e3df}.at28-empty{text-align:center;color:#61736d;padding:28px}.at28-details{white-space:pre-wrap;color:#1f2d28;line-height:1.7;margin-top:8px}
    `; document.head.appendChild(st);
  }
  function dashboard(){
    const d=$('dashboard') || document.querySelector('[data-page="dashboard"],.dashboard');
    if(d) return d;
    return [...document.querySelectorAll('section,.page,main,.content,#content')].find(x=>/لوحة\s*التحكم|ملخص\s*اليوم|تكتات\s*اليوم/.test(S(x.textContent))) || document.querySelector('main,.main,.content,#content') || document.body;
  }
  function pickCardContainer(dash){
    const ticket=[...dash.querySelectorAll('div,section,article')].find(x=>/تكتات\s*اليوم|التكتات|tickets?/i.test(S(x.textContent)) && x.children.length<8);
    if(ticket){
      const p=ticket.parentElement;
      if(p && p!==document.body) return {container:p, after:ticket};
    }
    const k= dash.querySelector('.kpis,.stats,.cards,.grid,[class*="kpi"],[class*="stats"],[class*="cards"]');
    return {container:k||dash, after:null};
  }
  function ensureCard(){
    const dash=dashboard(); if(!dash) return null;
    let card=$('at28DashboardTaskCard');
    if(!card){
      card=document.createElement('div'); card.id='at28DashboardTaskCard'; card.className='kpi card at28-task-card';
      card.innerHTML='<small>مهام إدارية</small><b id="at28TaskCount">0</b><span class="at28-chip" id="at28DueCount">0 مستحقة</span>';
      const pos=pickCardContainer(dash);
      if(pos.after && pos.after.nextSibling) pos.container.insertBefore(card,pos.after.nextSibling); else pos.container.appendChild(card);
      card.onclick=openSmartModal;
    }
    card.style.display='block'; card.style.visibility='visible';
    return card;
  }
  function ensureFloat(){
    if($('at28Float')) return $('at28Float');
    const b=document.createElement('button'); b.id='at28Float'; b.className='at28-float'; b.innerHTML='مهام إدارية <b id="at28FloatCount">0</b>'; b.onclick=openSmartModal; document.body.appendChild(b); return b;
  }
  function ensureModal(){
    if($('at28Modal')) return $('at28Modal');
    const m=document.createElement('div'); m.id='at28Modal'; m.className='at28-modal';
    m.innerHTML='<div class="at28-box"><div class="at28-head"><h3>المهام الإدارية</h3><button class="at28-btn light" id="at28CloseTop">إغلاق</button></div><div class="at28-body" id="at28ModalBody"><div class="at28-empty">جاري التحميل...</div></div><div class="at28-actions"><button class="at28-btn light" id="at28Close">إغلاق</button><button class="at28-btn" id="at28OpenSection">فتح قسم مهام إدارية</button></div></div>';
    document.body.appendChild(m);
    $('at28Close').onclick=$('at28CloseTop').onclick=()=>m.classList.remove('show');
    $('at28OpenSection').onclick=()=>{ m.classList.remove('show'); openSection(); };
    m.addEventListener('click',e=>{ if(e.target===m) m.classList.remove('show'); });
    return m;
  }
  function fmt(v){ if(!S(v)) return '—'; const d=new Date(v); return Number.isFinite(d.getTime())?d.toLocaleString('ar-SA'):S(v); }
  function statusBadge(t){ const st=S(t.status||'open'); if(st==='approved') return '<span class="at28-badge green">تم الاعتماد</span>'; if(st==='closed') return '<span class="at28-badge">مغلقة</span>'; return isDue(t)?'<span class="at28-badge red">مستحقة</span>':'<span class="at28-badge">مفتوحة</span>'; }
  function renderModal(tasks){
    const body=$('at28ModalBody'); if(!body) return;
    const list=tasks.filter(t=>S(t.status)!=='approved').slice(0,40);
    if(!list.length){ body.innerHTML='<div class="at28-empty">لا توجد مهام إدارية مفتوحة حاليًا.</div>'; return; }
    body.innerHTML=list.map(t=>`<div class="at28-row"><h4>${esc(t.title||'مهمة إدارية')}</h4><div class="at28-meta">${statusBadge(t)}<span class="at28-badge">من: ${esc(t.from_name||t.from_user||'—')}</span><span class="at28-badge">إلى: ${esc(t.to_name||t.to_user||'—')}</span><span class="at28-badge">الأولوية: ${esc(t.priority||'عادي')}</span><span class="at28-badge">الجدولة: ${esc(t.schedule_type||'فورية')}</span><span class="at28-badge">الموعد: ${fmt(t.due_at)}</span></div><div class="at28-details">${esc(t.details||'')}</div></div>`).join('');
  }
  let cached=[];
  async function refresh(){
    injectCss(); ensureModal(); const card=ensureCard(); ensureFloat();
    try{ cached=await loadTasks(); }catch(e){ console.warn('admin tasks v10128 load failed',e); cached=[]; }
    const open=cached.filter(t=>isOpen(t)).length;
    const due=cached.filter(isDue).length;
    if($('at28TaskCount')) $('at28TaskCount').textContent=open;
    if($('at28DueCount')) { $('at28DueCount').textContent=due+' مستحقة'; $('at28DueCount').className='at28-chip '+(due?'warn':''); }
    if($('at28FloatCount')) $('at28FloatCount').textContent=open;
    const fl=$('at28Float'); if(fl) fl.style.display=(card && card.offsetParent)?'none':'block';
    return cached;
  }
  async function openSmartModal(){
    ensureModal(); $('at28Modal').classList.add('show');
    if($('at28ModalBody')) $('at28ModalBody').innerHTML='<div class="at28-empty">جاري تحميل المهام...</div>';
    const tasks=await refresh(); renderModal(tasks);
  }
  function openSection(){
    try{ if(window.tasneefAdminTasksV10126 && typeof window.tasneefAdminTasksV10126.open==='function') return window.tasneefAdminTasksV10126.open(); }catch(_){ }
    const btn=$('at26Nav')||document.querySelector('button[data-page="adminTasks"]'); if(btn){ btn.click(); return; }
    const sec=$('adminTasks'); if(sec){ document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden')); sec.classList.remove('hidden'); window.scrollTo({top:0,behavior:'smooth'}); return; }
    openSmartModal();
  }
  function showReminderOnce(){
    const t=cached.find(x=>isDue(x) && localStorage.getItem(DISMISS_PREFIX+x.id+'_'+todayKey())!=='1');
    if(!t) return;
    ensureModal(); renderModal([t]); $('at28Modal').classList.add('show');
    const actions=document.querySelector('#at28Modal .at28-actions');
    if(actions && !$('at28DismissReminder')){
      const b=document.createElement('button'); b.id='at28DismissReminder'; b.className='at28-btn light'; b.textContent='إغلاق التذكير';
      b.onclick=()=>{ localStorage.setItem(DISMISS_PREFIX+t.id+'_'+todayKey(),'1'); $('at28Modal').classList.remove('show'); b.remove(); };
      actions.insertBefore(b,actions.firstChild);
    }
  }
  async function init(){
    injectCss(); ensureCard(); ensureFloat(); ensureModal();
    await refresh(); setTimeout(showReminderOnce,900);
    setTimeout(refresh,1200); setTimeout(refresh,3500); setInterval(refresh,90000);
    document.addEventListener('visibilitychange',()=>{ if(!document.hidden) refresh().then(showReminderOnce); });
  }
  window.tasneefAdminTasksRoleDashV10128={refresh,openSmartModal,diagnose:()=>({user:readCurrentUser(),aliases:userAliases(),tasks:cached})};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else setTimeout(init,300);
})();

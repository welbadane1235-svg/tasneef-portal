/* Tasneef v10127 - Admin Tasks Dashboard Smart Card
   كرت مهام إدارية في لوحة التحكم بجانب كروت الملخص، مع نافذة ذكية لعرض المهام.
*/
(function(){
  'use strict';
  if(window.__tasneefAdminTasksDashboardCardV10127) return;
  window.__tasneefAdminTasksDashboardCardV10127=true;

  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const TABLE='admin_tasks';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const esc=v=>S(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));

  function normalizeKey(v){
    return S(v).toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g,'')
      .replace(/ـ/g,'')
      .replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
      .replace(/[|،,;؛:\-_/\\()\[\]{}\.]+/g,'')
      .replace(/\s+/g,'');
  }
  function same(a,b){
    a=normalizeKey(a); b=normalizeKey(b);
    return !!a && !!b && (a===b || (a.length>3 && b.length>3 && (a.includes(b)||b.includes(a))));
  }
  function unique(vals){
    const out=[], seen=new Set();
    vals.map(S).filter(Boolean).forEach(v=>{
      [v, v.toLowerCase(), normalizeKey(v)].forEach(x=>{x=S(x); if(x&&!seen.has(x)){seen.add(x); out.push(x);}});
    });
    return out;
  }
  function safeJson(raw){try{return JSON.parse(raw)}catch(_){return null}}
  function readCurrentUser(){
    const keys=['tasneef_user','currentUser','user','tasneef_current_user','tasneef_login_user','loggedUser','logged_user','tasneef_logged_user','auth_user','session_user','current_user'];
    const stores=[]; try{stores.push(localStorage)}catch(_){} try{stores.push(sessionStorage)}catch(_){}
    let best=null, score=-1;
    function consider(o){
      if(!o||typeof o!=='object'||Array.isArray(o)) return;
      ['user','profile','currentUser','account'].forEach(k=>{ if(o[k]&&typeof o[k]==='object') consider(o[k]); });
      let sc=0;
      if(S(o.username||o.user_name||o.email||o.id||o.user_id||o.uid)) sc+=5;
      if(S(o.full_name||o.fullName||o.name||o.display_name)) sc+=4;
      if(S(o.role||o.user_role||o.type)) sc+=2;
      if(sc>score){best=o; score=sc;}
    }
    stores.forEach(st=>{
      keys.forEach(k=>consider(safeJson(st.getItem(k))));
      try{
        for(let i=0;i<st.length;i++){
          const k=st.key(i)||''; if(!/user|login|auth|session|current|account|tasneef/i.test(k)) continue;
          const raw=st.getItem(k); if(!raw || raw.length>200000) continue;
          const v=safeJson(raw); if(Array.isArray(v)) v.forEach(consider); else consider(v);
        }
      }catch(_){ }
    });
    ['currentUser','loggedUser','tasneefUser','authUser','user'].forEach(k=>{try{consider(window[k])}catch(_){}});
    try{
      const txt=(document.querySelector('#currentUserName,#loggedUserName,#userDisplayName,.current-user,.user-name,.brand small')||{}).textContent||'';
      if(txt) consider({name:txt, full_name:txt});
    }catch(_){ }
    return best||{};
  }
  function userKeys(){
    const u=readCurrentUser();
    return unique([u.id,u.uid,u.user_id,u.username,u.user_name,u.email,u.login,u.mobile,u.phone,u.full_name,u.fullName,u.name,u.display_name]);
  }
  function belongsToMe(t){
    const keys=userKeys(); if(!keys.length) return true;
    const vals=unique([t.from_user,t.from_name,t.from_keys,t.to_user,t.to_name,t.to_keys].join('|').split('|'));
    return vals.some(v=>keys.some(k=>same(v,k)));
  }
  function isForMe(t){
    const keys=userKeys(); if(!keys.length) return true;
    const vals=unique([t.to_user,t.to_name,t.to_keys].join('|').split('|'));
    return vals.some(v=>keys.some(k=>same(v,k)));
  }
  function isDue(t){
    if(S(t.status)==='approved') return false;
    if(S(t.status)==='closed') return false;
    const st=S(t.schedule_type||t.task_schedule||'فورية');
    if(st.includes('فورية')) return true;
    if(!t.due_at) return false;
    const d=new Date(t.due_at); return !isNaN(d) && d.getTime()<=Date.now();
  }
  async function api(path,options){
    return fetch(SUPABASE_URL+path,Object.assign({
      cache:'no-store',
      headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY,Accept:'application/json','Content-Type':'application/json'}
    },options||{}));
  }
  async function loadTasks(){
    try{
      const res=await api('/rest/v1/'+TABLE+'?select=*&order=created_at.desc&limit=200',{method:'GET'});
      if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
      return A(await res.json()).filter(belongsToMe);
    }catch(e){ console.warn('Tasneef admin tasks dashboard load failed:',e); return []; }
  }
  function injectCss(){
    if($('at27Style')) return;
    const st=document.createElement('style'); st.id='at27Style'; st.textContent=`
      .at27-task-card{cursor:pointer;position:relative;overflow:hidden;border:1px solid #dce6e2!important;background:linear-gradient(135deg,#fff,#f3faf7)!important;transition:.18s ease}.at27-task-card:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(10,64,51,.10)}
      .at27-task-card small{display:block;color:#61736d}.at27-task-card b{color:#0A4033}.at27-chip{position:absolute;left:14px;bottom:10px;background:#0A4033;color:#fff;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:900}.at27-chip.warn{background:#b26a00}.at27-modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:999999;align-items:center;justify-content:center;padding:16px}.at27-modal.show{display:flex}.at27-box{background:#fff;border-radius:22px;width:min(900px,96vw);max-height:86vh;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.28);direction:rtl}.at27-head{background:#0A4033;color:#fff;padding:18px 20px;display:flex;justify-content:space-between;gap:10px;align-items:center}.at27-head h3{margin:0;font-size:22px}.at27-body{padding:16px;overflow:auto;max-height:64vh}.at27-row{border:1px solid #e2ebe8;border-radius:16px;padding:12px;margin-bottom:10px;background:#fff}.at27-row h4{margin:0 0 6px;color:#0A4033}.at27-meta{display:flex;flex-wrap:wrap;gap:7px;color:#61736d;font-size:12px}.at27-badge{background:#eef6f3;color:#0A4033;border-radius:999px;padding:4px 8px;font-weight:900}.at27-badge.red{background:#fde8e8;color:#a32626}.at27-badge.green{background:#e7f5ee;color:#167a4c}.at27-actions{display:flex;gap:8px;justify-content:flex-end;padding:0 16px 16px}.at27-btn{border:0;border-radius:12px;padding:10px 14px;background:#0A4033;color:#fff;font-weight:900;cursor:pointer}.at27-btn.light{background:#eef6f3;color:#0A4033;border:1px solid #d6e3df}.at27-empty{text-align:center;color:#61736d;padding:28px}.at27-details{white-space:pre-wrap;color:#1f2d28;line-height:1.7;margin-top:8px}
    `; document.head.appendChild(st);
  }
  function ensureCard(){
    const dash=$('dashboard'); if(!dash) return null;
    let kpis=dash.querySelector('.kpis');
    if(!kpis){ kpis=document.createElement('div'); kpis.className='kpis'; dash.insertBefore(kpis,dash.firstChild); }
    let card=$('at27DashboardTaskCard');
    if(!card){
      card=document.createElement('div'); card.id='at27DashboardTaskCard'; card.className='kpi at27-task-card';
      card.innerHTML='<small>مهام إدارية</small><b id="at27TaskCount">0</b><span class="at27-chip" id="at27DueCount">0 مستحقة</span>';
      // نحاول وضع الكرت بجانب كرت التكتات إن وجد، وإلا داخل كروت لوحة التحكم
      const ticket=[...kpis.children].find(x=>/تكت|ticket/i.test(x.textContent||''));
      if(ticket && ticket.nextSibling) kpis.insertBefore(card,ticket.nextSibling); else kpis.appendChild(card);
      card.onclick=()=>openModal();
    }
    return card;
  }
  function ensureModal(){
    if($('at27Modal')) return $('at27Modal');
    const m=document.createElement('div'); m.id='at27Modal'; m.className='at27-modal';
    m.innerHTML='<div class="at27-box"><div class="at27-head"><h3>المهام الإدارية</h3><button class="at27-btn light" id="at27CloseTop">إغلاق</button></div><div class="at27-body" id="at27ModalBody"><div class="at27-empty">جاري التحميل...</div></div><div class="at27-actions"><button class="at27-btn light" id="at27Close">إغلاق</button><button class="at27-btn" id="at27OpenSection">فتح قسم مهام إدارية</button></div></div>';
    document.body.appendChild(m);
    $('at27Close').onclick=$('at27CloseTop').onclick=()=>m.classList.remove('show');
    $('at27OpenSection').onclick=()=>{ m.classList.remove('show'); openAdminTasksSection(); };
    m.addEventListener('click',e=>{ if(e.target===m) m.classList.remove('show'); });
    return m;
  }
  function statusLabel(t){
    const st=S(t.status||'open');
    if(st==='approved') return '<span class="at27-badge green">تم الاعتماد</span>';
    if(st==='closed') return '<span class="at27-badge">مغلقة</span>';
    return isDue(t)?'<span class="at27-badge red">مستحقة</span>':'<span class="at27-badge">مفتوحة</span>';
  }
  function fmtDate(v){ if(!v) return '—'; const d=new Date(v); return isNaN(d)?'—':d.toLocaleString('ar-SA'); }
  function renderModal(tasks){
    const body=$('at27ModalBody'); if(!body) return;
    const list=tasks.filter(t=>S(t.status)!=='approved').slice(0,30);
    if(!list.length){ body.innerHTML='<div class="at27-empty">لا توجد مهام إدارية مفتوحة حاليًا.</div>'; return; }
    body.innerHTML=list.map(t=>`
      <div class="at27-row">
        <h4>${esc(t.title||t.task_title||'مهمة إدارية')}</h4>
        <div class="at27-meta">
          ${statusLabel(t)}
          <span class="at27-badge">من: ${esc(t.from_name||t.from_user||'—')}</span>
          <span class="at27-badge">إلى: ${esc(t.to_name||t.to_user||'—')}</span>
          <span class="at27-badge">الأولوية: ${esc(t.priority||'عادي')}</span>
          <span class="at27-badge">الجدولة: ${esc(t.schedule_type||'فورية')}</span>
          <span class="at27-badge">الموعد: ${fmtDate(t.due_at)}</span>
        </div>
        <div class="at27-details">${esc(t.details||t.description||'')}</div>
      </div>`).join('');
  }
  let cached=[];
  async function refreshCard(){
    injectCss(); ensureCard(); ensureModal();
    cached=await loadTasks();
    const open=cached.filter(t=>S(t.status)!=='closed' && S(t.status)!=='approved').length;
    const due=cached.filter(t=>isForMe(t)&&isDue(t)).length;
    if($('at27TaskCount')) $('at27TaskCount').textContent=open;
    if($('at27DueCount')) { $('at27DueCount').textContent=due+' مستحقة'; $('at27DueCount').className='at27-chip '+(due?'warn':''); }
  }
  async function openModal(){
    ensureModal();
    const m=$('at27Modal'), body=$('at27ModalBody');
    if(body) body.innerHTML='<div class="at27-empty">جاري تحميل المهام...</div>';
    m.classList.add('show');
    cached=await loadTasks();
    renderModal(cached);
    refreshCard();
  }
  function openAdminTasksSection(){
    try{
      const btn=$('at26Nav') || document.querySelector('button[data-page="adminTasks"],button[onclick*="adminTasks"]');
      if(btn){ btn.click(); return; }
      if(typeof window.showPage==='function') { window.showPage('adminTasks'); return; }
      const sec=$('adminTasks'); if(sec){ document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden')); sec.classList.remove('hidden'); window.scrollTo({top:0,behavior:'smooth'}); }
    }catch(e){ console.warn(e); }
  }
  function init(){
    injectCss(); ensureCard(); ensureModal(); refreshCard();
    setInterval(refreshCard,60000);
    document.addEventListener('visibilitychange',()=>{ if(!document.hidden) refreshCard(); });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else setTimeout(init,200);
})();

/* Tasneef v10130 - Field Admin Tasks for supervisor.html + technician.html
   Shows admin tasks for supervisor/technician pages, online from Supabase only.
*/
(function(){
  'use strict';
  if(window.__tasneefFieldAdminTasksV10130) return;
  window.__tasneefFieldAdminTasksV10130=true;
  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const TABLE='admin_tasks';
  const DISMISS='tasneef_field_admin_tasks_dismiss_v10130_';
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const $=id=>document.getElementById(id);
  const esc=v=>S(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  const today=()=>new Date().toISOString().slice(0,10);
  const nowIso=()=>new Date().toISOString();
  function normalize(v){return S(v).toLowerCase().replace(/[\u064B-\u065F\u0670]/g,'').replace(/ـ/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[|،,;؛:\-_/\\()\[\]{}\.]+/g,'').replace(/\s+/g,'');}
  function unique(vals){const out=[],seen=new Set(); vals.map(S).filter(Boolean).forEach(v=>[v,v.toLowerCase(),normalize(v)].forEach(x=>{x=S(x); if(x&&!seen.has(x)){seen.add(x);out.push(x)}})); return out;}
  function same(a,b){a=normalize(a);b=normalize(b);return !!a&&!!b&&(a===b||(a.length>3&&b.length>3&&(a.includes(b)||b.includes(a))));}
  function safeJson(raw){try{return JSON.parse(raw)}catch(_){return null}}
  function readUser(){
    const keys=['tasneef_user','tasneef_session','currentUser','user','loggedUser','tasneef_current_user','tasneef_login_user','session_user'];
    let best=null,score=-1;
    function sc(o){if(!o||typeof o!=='object'||Array.isArray(o))return -1;let n=0;if(S(o.username||o.user_name||o.email||o.id||o.user_id||o.uid))n+=5;if(S(o.full_name||o.name||o.display_name))n+=4;if(S(o.role||o.type||o.position))n+=2;return n;}
    function consider(o){if(!o||typeof o!=='object')return; ['user','profile','currentUser','account'].forEach(k=>{if(o[k]&&typeof o[k]==='object')consider(o[k])}); const n=sc(o); if(n>score){best=o;score=n;}}
    [localStorage,sessionStorage].forEach(st=>{try{keys.forEach(k=>consider(safeJson(st.getItem(k)))); for(let i=0;i<st.length;i++){const k=st.key(i)||''; if(!/user|login|auth|session|current|account|tasneef/i.test(k))continue; const raw=st.getItem(k); if(!raw||raw.length>200000)continue; const v=safeJson(raw); if(Array.isArray(v))v.forEach(consider); else consider(v);}}catch(_){}});
    try{ if(typeof window.session==='function') consider(window.session()); }catch(_){ }
    ['currentUser','loggedUser','tasneefUser','authUser','user'].forEach(k=>{try{consider(window[k])}catch(_){}});
    return best||{};
  }
  function display(u=readUser()){return S(u.full_name||u.fullName||u.name||u.display_name||u.username||u.user_name||u.email||'المستخدم');}
  function login(u=readUser()){return S(u.username||u.user_name||u.email||u.login||u.id||u.uid||u.user_id||u.name||u.full_name||'');}
  function aliases(u=readUser()){return unique([u.id,u.uid,u.user_id,u.username,u.user_name,u.email,u.login,u.mobile,u.phone,u.full_name,u.fullName,u.name,u.display_name,display(u),login(u)]);}
  function keysFromTask(t,side){const vals=side==='to'?[t.to_user,t.to_name,t.to_keys]:[t.from_user,t.from_name,t.from_keys]; return unique(vals.flatMap(v=>S(v).split('|')));}
  function matchTask(keys,cur=aliases()){return keys.some(a=>cur.some(b=>same(a,b)));}
  function isToMe(t){return matchTask(keysFromTask(t,'to'));}
  function isFromMe(t){return matchTask(keysFromTask(t,'from'));}
  function relevant(t){return isToMe(t)||isFromMe(t);}
  function getClient(){
    if(window.sb&&window.sb.from) return window.sb;
    if(window.supabase&&window.supabase.createClient){ window.sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY); return window.sb; }
    return null;
  }
  async function load(){
    const sb=getClient(); if(!sb) throw new Error('Supabase غير جاهز');
    const {data,error}=await sb.from(TABLE).select('*').order('id',{ascending:false}).limit(1000);
    if(error) throw error;
    state.rows=A(data).map(x=>Object.assign({},x,{status:S(x.status||'open')}));
    return state.rows;
  }
  const state={rows:[],tab:'my',boot:false};
  function pageType(){ if($('techAdminTasksContent')) return 'technician'; if($('supAdminTasksContent')) return 'supervisor'; return ''; }
  function host(){ return $('techAdminTasksContent')||$('supAdminTasksContent'); }
  function statusText(s){return s==='approved'?'تم الاعتماد':s==='closed'?'مغلقة':'مفتوحة';}
  function formatDate(v){ if(!S(v)) return '—'; const d=new Date(v); return Number.isFinite(d.getTime())?d.toLocaleString('ar-SA'):S(v); }
  function due(t){ if(S(t.schedule_type)==='فورية') return true; if(!S(t.due_at)) return false; const d=new Date(t.due_at); return Number.isFinite(d.getTime()) && d<=new Date(); }
  function renderShell(){
    const h=host(); if(!h) return;
    if($('fieldTasksShellV10130')) return;
    h.innerHTML=`<style>
      .ft30-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}.ft30-kpis div{background:#fff;border:1px solid #dce6e2;border-radius:16px;padding:12px}.ft30-kpis small{color:#60706a}.ft30-kpis b{display:block;font-size:24px;color:#0A4033;margin-top:6px}.ft30-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.ft30-tab{background:#fff!important;color:#0A4033!important;border:1px solid #dce6e2!important;border-radius:999px!important;padding:8px 13px!important}.ft30-tab.active{background:#0A4033!important;color:#fff!important}.ft30-card{background:#fff;border:1px solid #dce6e2;border-radius:16px;padding:12px;margin:10px 0;line-height:1.8}.ft30-card h3{margin:0 0 6px;color:#0A4033}.ft30-meta{display:flex;gap:8px;flex-wrap:wrap;color:#60706a;font-size:12px}.ft30-badge{display:inline-block;border-radius:999px;padding:3px 8px;background:#eef6f3;color:#0A4033;font-weight:900}.ft30-badge.red{background:#fde8e8;color:#a32626}.ft30-badge.green{background:#e6f6ee;color:#137a4b}.ft30-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.ft30-modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:999999;align-items:center;justify-content:center;padding:16px}.ft30-modal.show{display:flex}.ft30-box{background:#fff;border-radius:22px;width:min(96vw,560px);overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.28)}.ft30-box h3{margin:0;background:#0A4033;color:#fff;padding:18px}.ft30-box-body{padding:18px;line-height:1.8}.ft30-box-actions{display:flex;justify-content:flex-end;gap:8px;padding:0 18px 18px}@media(max-width:760px){.ft30-kpis{grid-template-columns:1fr 1fr}}
    </style><div id="fieldTasksShellV10130"><div class="ft30-kpis"><div><small>مهامي</small><b id="ft30My">0</b></div><div><small>مفتوحة</small><b id="ft30Open">0</b></div><div><small>مغلقة</small><b id="ft30Closed">0</b></div><div><small>تم الاعتماد</small><b id="ft30Approved">0</b></div></div><div class="ft30-tabs"><button class="ft30-tab active" data-tab="my">مهامي</button><button class="ft30-tab" data-tab="open">مهام مفتوحة</button><button class="ft30-tab" data-tab="closed">مهام مغلقة</button><button class="ft30-tab" data-tab="approved">تم الاعتماد</button><button class="ft30-tab" data-tab="from">أنشأتها</button><button class="ft30-tab" id="ft30Refresh">تحديث</button></div><div id="ft30List"><div class="ft30-card">جاري تحميل المهام...</div></div></div><div class="ft30-modal" id="ft30Reminder"><div class="ft30-box"><h3>تذكير بمهمة إدارية</h3><div class="ft30-box-body" id="ft30ReminderBody"></div><div class="ft30-box-actions"><button class="ft30-tab" id="ft30Dismiss">إغلاق التذكير</button><button class="ft30-tab active" id="ft30OpenReminder">فتح المهمة</button></div></div></div>`;
    h.querySelectorAll('.ft30-tab[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab; h.querySelectorAll('.ft30-tab[data-tab]').forEach(x=>x.classList.toggle('active',x===b)); render();});
    $('ft30Refresh').onclick=refresh;
  }
  function tabRows(){
    return state.rows.filter(relevant).filter(t=>{
      if(state.tab==='my') return isToMe(t);
      if(state.tab==='from') return isFromMe(t);
      if(state.tab==='open') return t.status==='open';
      if(state.tab==='closed') return t.status==='closed';
      if(state.tab==='approved') return t.status==='approved';
      return true;
    });
  }
  function render(){
    renderShell();
    const list=$('ft30List'); if(!list) return;
    const rel=state.rows.filter(relevant);
    const my=state.rows.filter(isToMe);
    const open=rel.filter(t=>t.status==='open');
    const closed=rel.filter(t=>t.status==='closed');
    const approved=rel.filter(t=>t.status==='approved');
    if($('ft30My')) $('ft30My').textContent=my.length;
    if($('ft30Open')) $('ft30Open').textContent=open.length;
    if($('ft30Closed')) $('ft30Closed').textContent=closed.length;
    if($('ft30Approved')) $('ft30Approved').textContent=approved.length;
    const rows=tabRows();
    if(!rows.length){ list.innerHTML='<div class="ft30-card" style="text-align:center;color:#60706a">لا توجد مهام في هذا التبويب</div>'; return; }
    list.innerHTML=rows.map(t=>`<div class="ft30-card"><div class="ft30-meta"><span class="ft30-badge ${t.status==='open'?'red':t.status==='approved'?'green':''}">${statusText(t.status)}</span><span>${esc(t.priority||'عادي')}</span><span>${esc(t.schedule_type||'فورية')}</span></div><h3>${esc(t.title||'مهمة بدون عنوان')}</h3><div>${esc(t.details||'').replace(/\n/g,'<br>')}</div><div class="ft30-meta"><span>من: ${esc(t.from_name||t.from_user||'—')}</span><span>إلى: ${esc(t.to_name||t.to_user||'—')}</span><span>الاستحقاق: ${esc(formatDate(t.due_at))}</span><span>أنشئت: ${esc(formatDate(t.created_at))}</span></div><div class="ft30-actions">${t.status==='open'&&isToMe(t)?`<button class="ft30-tab active" onclick="TasneefFieldAdminTasksV10130.closeTask(${Number(t.id)})">إغلاق المهمة</button>`:''}${t.status==='closed'&&isFromMe(t)?`<button class="ft30-tab active" onclick="TasneefFieldAdminTasksV10130.approveTask(${Number(t.id)})">اعتماد</button>`:''}</div></div>`).join('');
  }
  async function patch(id,body){ const sb=getClient(); if(!sb) return alert('Supabase غير جاهز'); const {error}=await sb.from(TABLE).update(Object.assign({},body,{updated_at:nowIso()})).eq('id',id); if(error) return alert('تعذر تحديث المهمة: '+error.message); await refresh(); }
  async function closeTask(id){ await patch(id,{status:'closed',closed_at:nowIso(),closed_by:display()}); }
  async function approveTask(id){ await patch(id,{status:'approved',approved_at:nowIso(),approved_by:display()}); }
  function openPage(){
    const p=pageType();
    if(p==='technician'){
      const btn=[...document.querySelectorAll('.tech-main-tab')].find(b=>String(b.getAttribute('onclick')||'').includes('techAdminTasksTab'));
      if(typeof window.showTechMainTab==='function') window.showTechMainTab('techAdminTasksTab',btn); else $('techAdminTasksTab')?.classList.add('active');
    }else if(p==='supervisor'){
      const btn=[...document.querySelectorAll('.sup-tab')].find(b=>String(b.getAttribute('onclick')||'').includes('supAdminTasks'));
      if(typeof window.showSupervisorWindow==='function') window.showSupervisorWindow('supAdminTasks',btn); else $('supAdminTasks')?.classList.add('active');
    }
    render();
  }
  function showReminder(){
    const dueRows=state.rows.filter(t=>isToMe(t)&&t.status==='open'&&due(t));
    if(!dueRows.length) return;
    const first=dueRows[0]; const key=DISMISS+today()+'_'+(first.id||'x');
    try{ if(localStorage.getItem(key)) return; }catch(_){ }
    const modal=$('ft30Reminder'); if(!modal) return;
    $('ft30ReminderBody').innerHTML=`لديك <b>${dueRows.length}</b> مهمة إدارية مستحقة.<br><br><b>${esc(first.title||'مهمة')}</b><br>${esc(first.details||'').slice(0,180)}`;
    $('ft30Dismiss').onclick=()=>{try{localStorage.setItem(key,'1')}catch(_){ } modal.classList.remove('show');};
    $('ft30OpenReminder').onclick=()=>{modal.classList.remove('show');openPage();};
    modal.classList.add('show');
  }
  async function refresh(){ renderShell(); try{ await load(); render(); setTimeout(showReminder,250); }catch(e){ const list=$('ft30List'); if(list) list.innerHTML='<div class="ft30-card" style="color:#a32626">تعذر تحميل المهام من Supabase: '+esc(e.message||e)+'</div>'; } }
  function install(){ renderShell(); setTimeout(refresh,700); setTimeout(refresh,2500); }
  window.TasneefFieldAdminTasksV10130={refresh,open:openPage,closeTask,approveTask};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install); else install();
})();

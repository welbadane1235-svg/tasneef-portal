/* Tasneef v10150 - Daily logs no duplicate + smart toast
   يمنع تكرار تسجيل الدخول/الخروج عند تعليق النت أو الضغط المتكرر.
   يعمل على صفحة المشرف فقط ولا يلمس الأقسام الأخرى.
*/
(function(){
  'use strict';
  const VERSION='v10154-daily-logs-camera-whatsapp-restored';
  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const TABLE='time_logs';
  const LOCK_PREFIX='tasneef_daily_log_lock_v10151:';
  const S=v=>String(v==null?'':v).trim();
  const $=id=>document.getElementById(id);
  const nowIso=()=>new Date().toISOString();
  const today=()=>{const d=new Date(); const z=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate());};
  const timeNow=()=>{const d=new Date(); const z=n=>String(n).padStart(2,'0'); return z(d.getHours())+':'+z(d.getMinutes());};
  function tzOffset(){
    const off=-new Date().getTimezoneOffset();
    const sign=off>=0?'+':'-';
    const abs=Math.abs(off);
    return sign+String(Math.floor(abs/60)).padStart(2,'0')+':'+String(abs%60).padStart(2,'0');
  }
  function cleanTime(t){
    t=S(t);
    if(!t) return timeNow();
    if(/T/.test(t)){ try{ const d=new Date(t); if(!isNaN(d)){ const z=n=>String(n).padStart(2,'0'); return z(d.getHours())+':'+z(d.getMinutes()); } }catch(_){ } }
    const m=t.match(/(\d{1,2}):(\d{2})/);
    if(m) return String(m[1]).padStart(2,'0')+':'+m[2];
    return timeNow();
  }
  function toDbTimestamp(t){
    // Supabase column is timestamptz; never send HH:MM alone.
    const d=logDate();
    const hm=cleanTime(t);
    return d+'T'+hm+':00'+tzOffset();
  }
  function displayTime(v){ return cleanTime(v); }
  function getClient(){
    if(window.sb&&window.sb.from) return window.sb;
    if(window.supabaseClient&&window.supabaseClient.from) return window.supabaseClient;
    if(window.supabase&&window.supabase.from) return window.supabase;
    if(window.supabase&&window.supabase.createClient){ window.sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY); return window.sb; }
    return null;
  }
  function readJson(raw){try{return JSON.parse(raw||'{}')||{}}catch(_){return {}}}
  function currentUser(){
    try{ if(typeof window.session==='function') return window.session()||{}; }catch(_){ }
    const keys=['tasneef_user','tasneef_session','currentUser','user','loggedUser','tasneef_current_user','tasneef_login_user','session_user'];
    for(const st of [localStorage,sessionStorage]){
      try{ for(const k of keys){ const o=readJson(st.getItem(k)); if(o&&(o.id||o.full_name||o.name||o.username||o.email||o.role)) return o.user||o.profile||o; } }catch(_){ }
    }
    for(const k of ['currentUser','loggedUser','tasneefUser','authUser','user']){ try{ const o=window[k]; if(o&&(o.id||o.full_name||o.name||o.username||o.email)) return o; }catch(_){ } }
    return {};
  }
  function userId(){ const u=currentUser(); return S(u.id||u.user_id||u.uid||u.username||u.email||u.full_name||u.name||'supervisor'); }
  function userName(){ const u=currentUser(); return S(u.full_name||u.name||u.username||u.email||u.id||'المشرف'); }
  function projectInfo(){
    const el=$('logProject');
    const val=S(el&&el.value);
    const text=S(el&&el.options&&el.selectedIndex>=0 ? el.options[el.selectedIndex].textContent : '');
    return {id:val, name:text||val};
  }
  function visitType(){ return S($('logVisitType')&&$('logVisitType').value)||'surface'; }
  function logDate(){ const d=$('logDate'); if(d&&!S(d.value)) d.value=today(); return S(d&&d.value)||today(); }
  function opKey(kind){ const p=projectInfo(); return [kind,logDate(),userId(),p.id||p.name,visitType()].join('|'); }
  function lockRead(key){try{return readJson(localStorage.getItem(LOCK_PREFIX+key));}catch(_){return {}}}
  function lockWrite(key,obj){try{localStorage.setItem(LOCK_PREFIX+key,JSON.stringify(Object.assign({ts:Date.now()},obj||{})));}catch(_){ }}
  function lockClear(key){try{localStorage.removeItem(LOCK_PREFIX+key);}catch(_){ }}
  function recent(lock,ms){ return lock&&lock.ts&&(Date.now()-Number(lock.ts)<ms); }
  function smartToast(text,type){
    let box=document.getElementById('smartDailyLogToastV10150');
    if(!box){
      box=document.createElement('div'); box.id='smartDailyLogToastV10150';
      box.innerHTML='<div class="sdlt-icon">✓</div><div class="sdlt-text"></div>';
      document.body.appendChild(box);
      const st=document.createElement('style'); st.id='smartDailyLogToastV10150Style';
      st.textContent=`#smartDailyLogToastV10150{position:fixed;left:50%;top:22px;transform:translateX(-50%) translateY(-16px);z-index:999999;background:#0A4B3C;color:#fff;border-radius:18px;padding:14px 18px;min-width:min(420px,92vw);box-shadow:0 18px 50px rgba(0,0,0,.22);display:flex;align-items:center;gap:12px;opacity:0;pointer-events:none;transition:.22s ease;font-family:Tahoma,Arial,sans-serif;direction:rtl}.sdlt-icon{width:34px;height:34px;border-radius:999px;background:rgba(255,255,255,.16);display:grid;place-items:center;font-weight:900}.sdlt-text{font-weight:900;line-height:1.7}#smartDailyLogToastV10150.show{opacity:1;transform:translateX(-50%) translateY(0)}#smartDailyLogToastV10150.err{background:#b83232}#smartDailyLogToastV10150.wait{background:#8a6700}`;
      document.head.appendChild(st);
    }
    box.classList.remove('err','wait','show');
    if(type==='err') box.classList.add('err'); if(type==='wait') box.classList.add('wait');
    box.querySelector('.sdlt-text').textContent=text;
    requestAnimationFrame(()=>box.classList.add('show'));
    clearTimeout(window.__sdltTimerV10150); window.__sdltTimerV10150=setTimeout(()=>box.classList.remove('show'),2600);
    try{ if(typeof window.msg==='function') window.msg(text); }catch(_){ }
  }


  function dailyMediaMessage(kind,time){
    const p=projectInfo();
    const action=kind==='in'?'تسجيل دخول':'تسجيل خروج';
    return [
      'شركة تصنيف لإدارة المرافق',
      action,
      'المشرف: '+userName(),
      'المشروع: '+(p.name||p.id||'-'),
      'نوع الزيارة: '+visitType(),
      'التاريخ: '+logDate(),
      'الوقت: '+displayTime(time||timeNow())
    ].join('\n');
  }
  function openDailyCamera(kind){
    try{
      const input=document.createElement('input');
      input.type='file'; input.accept='image/*'; input.capture='environment';
      input.style.position='fixed'; input.style.left='-9999px'; input.style.top='-9999px';
      input.setAttribute('aria-hidden','true');
      document.body.appendChild(input);
      input.onchange=function(){
        const f=input.files&&input.files[0];
        if(f){ smartToast((kind==='in'?'تم فتح تصوير الدخول':'تم فتح تصوير الخروج'),'wait'); }
        setTimeout(()=>{try{input.remove();}catch(_){ }},1000);
      };
      input.click();
    }catch(_){ }
  }
  function openDailyWhatsapp(kind,time){
    try{
      const text=dailyMediaMessage(kind,time);
      const url='https://wa.me/?text='+encodeURIComponent(text);
      window.open(url,'_blank','noopener');
    }catch(_){ }
  }
  function shouldOpenMediaOnce(key){
    const lk=lockRead('media|'+key);
    if(recent(lk,120000)) return false;
    lockWrite('media|'+key,{status:'opened'});
    return true;
  }
  function installDailyClickGuard(){
    if(window.__tasneefDailyClickGuardV10154) return;
    window.__tasneefDailyClickGuardV10154=true;
    document.addEventListener('click',function(ev){
      const b=ev.target && ev.target.closest ? ev.target.closest('button') : null;
      if(!b) return;
      const t=S(b.textContent);
      const inLogs=!!(b.closest('#supLogs') || (document.getElementById('logProject') && document.getElementById('logProject').closest('section')));
      if(!inLogs || !/دخول الآن|خروج الآن|تسجيل دخول|تسجيل خروج|انصراف/.test(t)) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      if(/دخول الآن|تسجيل دخول/.test(t)) return checkInSmart();
      if(/خروج الآن|تسجيل خروج|انصراف/.test(t)) return checkOutSmart();
    },true);
  }


  function buttonBusy(kind,busy){
    const buttons=[...document.querySelectorAll('button')];
    const b=buttons.find(x=> kind==='in' ? /دخول الآن|تسجيل دخول/.test(S(x.textContent)) : /خروج الآن|تسجيل خروج|انصراف/.test(S(x.textContent)) );
    if(!b) return;
    if(busy){ b.dataset.oldText=b.dataset.oldText||b.textContent; b.disabled=true; b.textContent='جاري الحفظ...'; }
    else{ b.disabled=false; if(b.dataset.oldText) b.textContent=b.dataset.oldText; }
  }
  function sameProject(r,p){ const vals=[r.project_id,r.project_name,r.project,r.site_id,r.site_name,r.building_id].map(S).filter(Boolean); return !p.id&&!p.name ? true : vals.includes(S(p.id))||vals.includes(S(p.name)); }
  function sameUser(r){ const uid=userId(), un=userName(); const vals=[r.supervisor_id,r.user_id,r.created_by,r.created_by_id,r.supervisor_name,r.supervisor,r.user_name,r.created_by_name,r.manager_name].map(S).filter(Boolean); return vals.length? vals.includes(uid)||vals.includes(un) : true; }
  function sameVisit(r){ const v=visitType(); const rv=S(r.visit_type||r.service_type||r.type); return !rv || rv===v; }
  function hasIn(r){ return S(r.check_in||r.time_in||r.log_in||r.in_time||r.start_time); }
  function hasOut(r){ return S(r.check_out||r.time_out||r.log_out||r.out_time||r.end_time); }
  function rowId(r){ return r.id||r.log_id||r.uuid||r.key; }
  function byNewest(a,b){ return S(b.created_at||b.updated_at||b.id).localeCompare(S(a.created_at||a.updated_at||a.id)); }
  async function fetchTodayRows(){
    const sb=getClient(); if(!sb) throw new Error('Supabase غير جاهز');
    const d=logDate();
    let res=await sb.from(TABLE).select('*').eq('log_date',d).limit(1000);
    if(res.error){
      res=await sb.from(TABLE).select('*').eq('date',d).limit(1000);
    }
    if(res.error) throw res.error;
    const p=projectInfo();
    return (res.data||[]).filter(r=>sameProject(r,p)&&sameUser(r)&&sameVisit(r)).sort(byNewest);
  }
  function fillForm(kind,time,row){
    if(kind==='in' && $('logIn')) $('logIn').value=displayTime(time||hasIn(row)||timeNow());
    if(kind==='out' && $('logOut')) $('logOut').value=displayTime(time||hasOut(row)||timeNow());
    if(row && rowId(row) && $('logId')) $('logId').value=rowId(row);
  }
  async function insertCheckIn(t){
    const sb=getClient(); const p=projectInfo(); const u=currentUser();
    const payload={
      log_date:logDate(), project_id:p.id||p.name, supervisor_id:S(u.id||u.user_id||u.username||u.email||userName()), visit_type:visitType(),
      check_in:toDbTimestamp(t), check_out:null, travel_minutes:Number(S($('logTravel')&&$('logTravel').value))||0, notes:S($('logNotes')&&$('logNotes').value), created_at:nowIso(), updated_at:nowIso()
    };
    const {data,error}=await sb.from(TABLE).insert(payload).select('*').single();
    if(error) throw error;
    return data||payload;
  }
  async function updateCheckOut(row,t){
    const sb=getClient(); const id=rowId(row);
    const payload={check_out:toDbTimestamp(t), updated_at:nowIso(), travel_minutes:Number(S($('logTravel')&&$('logTravel').value))||Number(row.travel_minutes||row.transition_minutes||row.lost_minutes||0)||0, notes:S($('logNotes')&&$('logNotes').value)||S(row.notes)};
    if(!id) throw new Error('لم يتم العثور على رقم السجل المفتوح');
    const {data,error}=await sb.from(TABLE).update(payload).eq('id',id).select('*').single();
    if(error) throw error;
    return data||Object.assign({},row,payload);
  }
  async function checkInSmart(){
    const key=opKey('in'), l=lockRead(key);
    if(recent(l,120000)){ smartToast(l.status==='done'?'تم تسجيل الدخول':'جاري حفظ تسجيل الدخول، لا تضغط مرة ثانية','wait'); return; }
    lockWrite(key,{status:'pending'}); const __openMediaIn=shouldOpenMediaOnce(key); if(__openMediaIn) openDailyCamera('in'); buttonBusy('in',true);
    try{
      const rows=await fetchTodayRows();
      const open=rows.find(r=>hasIn(r)&&!hasOut(r));
      if(open){ fillForm('in',hasIn(open),open); lockWrite(key,{status:'done'}); smartToast('تم تسجيل الدخول'); if(__openMediaIn) openDailyWhatsapp('in',hasIn(open)); return; }
      const t=timeNow(); const row=await insertCheckIn(t); fillForm('in',t,row); lockWrite(key,{status:'done'}); smartToast('تم تسجيل الدخول'); if(__openMediaIn) openDailyWhatsapp('in',t);
      try{ if(typeof window.renderSupervisorDailySummary==='function') window.renderSupervisorDailySummary(); }catch(_){ }
    }catch(e){ lockClear(key); smartToast('تعذر تسجيل الدخول: '+S(e.message||e),'err'); }
    finally{ buttonBusy('in',false); }
  }
  async function checkOutSmart(){
    const key=opKey('out'), l=lockRead(key);
    if(recent(l,120000)){ smartToast(l.status==='done'?'تم تسجيل الخروج':'جاري حفظ تسجيل الخروج، لا تضغط مرة ثانية','wait'); return; }
    lockWrite(key,{status:'pending'}); const __openMediaOut=shouldOpenMediaOnce(key); if(__openMediaOut) openDailyCamera('out'); buttonBusy('out',true);
    try{
      const rows=await fetchTodayRows();
      const open=rows.find(r=>hasIn(r)&&!hasOut(r));
      if(open){ const t=timeNow(); const row=await updateCheckOut(open,t); fillForm('out',t,row); lockWrite(key,{status:'done'}); smartToast('تم تسجيل الخروج'); if(__openMediaOut) openDailyWhatsapp('out',t); return; }
      const already=rows.find(r=>hasIn(r)&&hasOut(r));
      if(already){ fillForm('out',hasOut(already),already); lockWrite(key,{status:'done'}); smartToast('تم تسجيل الخروج'); if(__openMediaOut) openDailyWhatsapp('out',hasOut(already)); return; }
      lockClear(key); smartToast('لا يوجد تسجيل دخول مفتوح لهذا المشروع اليوم','err');
    }catch(e){ lockClear(key); smartToast('تعذر تسجيل الخروج: '+S(e.message||e),'err'); }
    finally{ buttonBusy('out',false); }
  }
  function install(){
    if(!document.getElementById('logProject')) return;
    window.supervisorCheckIn=function(){ return checkInSmart(); };
    window.supervisorCheckOut=function(){ return checkOutSmart(); };
    installDailyClickGuard();
    // حفظ يدوي بصيغة صحيحة: يحول HH:MM إلى تاريخ + وقت كامل قبل الإرسال إلى Supabase.
    window.saveTimeLog=async function(){
      const key=opKey('manual'), l=lockRead(key);
      if(recent(l,90000)){ smartToast('جاري حفظ التسجيل، لا تضغط مرة ثانية','wait'); return; }
      lockWrite(key,{status:'pending'});
      try{
        const rows=await fetchTodayRows();
        const id=S($('logId')&&$('logId').value);
        const p=projectInfo(); const u=currentUser();
        const inVal=S($('logIn')&&$('logIn').value);
        const outVal=S($('logOut')&&$('logOut').value);
        const payload={
          log_date:logDate(),
          project_id:p.id||p.name,
          supervisor_id:S(u.id||u.user_id||u.username||u.email||userName()),
          supervisor_name:userName(),
          visit_type:visitType(),
          travel_minutes:Number(S($('logTravel')&&$('logTravel').value))||0,
          notes:S($('logNotes')&&$('logNotes').value),
          updated_at:nowIso()
        };
        if(inVal) payload.check_in=toDbTimestamp(inVal);
        if(outVal) payload.check_out=toDbTimestamp(outVal);
        const sb=getClient();
        let result;
        if(id){
          result=await sb.from(TABLE).update(payload).eq('id',id).select('*').single();
        }else{
          const open=rows.find(r=>hasIn(r)&&!hasOut(r));
          if(open&&rowId(open)){
            result=await sb.from(TABLE).update(payload).eq('id',rowId(open)).select('*').single();
          }else{
            payload.created_at=nowIso();
            result=await sb.from(TABLE).insert(payload).select('*').single();
          }
        }
        if(result.error) throw result.error;
        fillForm('in',payload.check_in,result.data||payload);
        if(payload.check_out) fillForm('out',payload.check_out,result.data||payload);
        lockWrite(key,{status:'done'});
        smartToast('تم حفظ التسجيل');
        try{ if(typeof window.renderSupervisorDailySummary==='function') window.renderSupervisorDailySummary(); }catch(_){ }
        try{ if(typeof window.renderTimeLogs==='function') window.renderTimeLogs(); }catch(_){ }
      }catch(e){ lockClear(key); smartToast('تعذر حفظ التسجيل: '+S(e.message||e),'err'); }
    };
    console.log(VERSION,'installed - login/logout with camera and whatsapp');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(install,900)); else setTimeout(install,900);
  setTimeout(install,2500);
})();

/* Tasneef v10150 - Daily logs no duplicate + smart toast
   يمنع تكرار تسجيل الدخول/الخروج عند تعليق النت أو الضغط المتكرر.
   يعمل على صفحة المشرف فقط ولا يلمس الأقسام الأخرى.
*/
(function(){
  'use strict';
  const VERSION='v10169-dashboard-daily-workers-fix';
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
    const pm=/(^|\s)PM($|\s)|مساء|(^|\s)م($|\s)|م$/i.test(t);
    const am=/(^|\s)AM($|\s)|صباح|(^|\s)ص($|\s)|ص$/i.test(t);
    if(/T/.test(t)){ try{ const d=new Date(t); if(!isNaN(d)){ const z=n=>String(n).padStart(2,'0'); return z(d.getHours())+':'+z(d.getMinutes()); } }catch(_){ } }
    const m=t.match(/(\d{1,2}):(\d{2})/);
    if(m){
      let h=Number(m[1]); const mm=m[2];
      if(pm && h<12) h+=12;
      if(am && h===12) h=0;
      if(h<0||h>23) h=Number(m[1])||0;
      return String(h).padStart(2,'0')+':'+mm;
    }
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


  function cleanWorkerNameText(txt){
    txt=S(txt).replace(/حاضر|غائب|غياب|حضور|present|absent|موجود|غير موجود|✓|✔|☑/gi,' ')
            .replace(/[:：]+/g,' ').replace(/\s+/g,' ').trim();
    return txt;
  }
  function uniqueNames(arr){
    const out=[]; const seen=new Set();
    (arr||[]).map(cleanWorkerNameText).filter(Boolean).forEach(n=>{ const k=n.toLowerCase(); if(!seen.has(k)){seen.add(k); out.push(n);} });
    return out;
  }
  function workerNameFromAny(o){
    if(!o) return '';
    if(typeof o==='string') return o;
    return S(o.worker_name||o.workerName||o.employee_name||o.employeeName||o.name||o.full_name||o.fullName||o.worker||o.employee||o.label||o.text);
  }
  function readLocalWorkerNames(){
    const names=[]; const d=logDate(); const sup=userName();
    try{
      const stores=[localStorage,sessionStorage];
      stores.forEach(st=>{
        for(let i=0;i<st.length;i++){
          const k=st.key(i)||'';
          if(!/attend|worker|عمال|حضور|tasneef/i.test(k)) continue;
          let v=st.getItem(k); if(!v || v.length>250000) continue;
          let obj; try{ obj=JSON.parse(v); }catch(_){ obj=null; }
          const walk=(x)=>{
            if(!x) return;
            if(Array.isArray(x)){ x.forEach(walk); return; }
            if(typeof x==='object'){
              const date=S(x.date||x.attendance_date||x.log_date||x.day||x.work_date);
              const supervisor=S(x.supervisor||x.supervisor_name||x.supervisorName||x.manager||x.manager_name);
              const status=S(x.status||x.attendance_status||x.state);
              const looksToday=!date || date===d || date.includes(d);
              const looksSupervisor=!supervisor || supervisor===sup || supervisor.includes(sup) || sup.includes(supervisor);
              const isPresent=!status || /present|حاضر|موجود|yes|true/i.test(status);
              if(looksToday && looksSupervisor && isPresent){
                const n=workerNameFromAny(x); if(n) names.push(n);
              }
              Object.keys(x).slice(0,80).forEach(key=>walk(x[key]));
            }
          };
          if(obj) walk(obj);
        }
      });
    }catch(_){ }
    return uniqueNames(names);
  }
  function readDomWorkerNames(){
    const names=[];
    try{
      const boxes=['#supervisorAttendanceList','#attendanceQuick','#workerProjectTimeBox','#workerProjectPanel','#dailyWorkersBox','#workersForProject','#projectWorkersList'];
      boxes.forEach(sel=>{
        document.querySelectorAll(sel+' input[type="checkbox"]:checked,'+sel+' input[type="radio"]:checked').forEach(inp=>{
          const ds=inp.dataset||{};
          let n=ds.workerName||ds.name||inp.getAttribute('data-worker-name')||inp.getAttribute('data-name')||inp.value;
          const lab=inp.closest('label')||inp.closest('.worker-item')||inp.parentElement;
          if(lab && (!n || /^on|true|1$/i.test(S(n)))) n=lab.textContent;
          if(n) names.push(n);
        });
      });
      document.querySelectorAll('[data-worker-name].active,[data-worker-name].selected,[data-worker-name][aria-checked="true"]').forEach(el=>names.push(el.getAttribute('data-worker-name')));
    }catch(_){ }
    return uniqueNames(names);
  }
  async function readSupabaseWorkerNames(){
    const sb=getClient(); if(!sb) return [];
    const d=logDate(); const sup=userName(); const uid=userId();
    try{
      const res=await sb.from('attendance').select('*').limit(1000);
      if(res.error) return [];
      const rows=(res.data||[]).filter(r=>{
        const date=S(r.attendance_date||r.date||r.log_date||r.day||r.work_date);
        const supervisor=S(r.supervisor_name||r.supervisor||r.manager_name||r.manager||r.supervisor_id||r.user_id||r.created_by);
        const status=S(r.status||r.attendance_status||r.state);
        const okDate=!date || date===d || date.includes(d);
        const okSup=!supervisor || supervisor===sup || supervisor===uid || supervisor.includes(sup) || sup.includes(supervisor);
        const okStatus=!status || /present|حاضر|موجود|yes|true/i.test(status);
        return okDate && okSup && okStatus;
      });
      let names=rows.map(workerNameFromAny).filter(Boolean);
      const missingIds=rows.map(r=>S(r.worker_id||r.employee_id||r.worker)).filter(x=>x && !isNaN(Number(x)));
      if(missingIds.length && names.length<rows.length){
        try{
          const wr=await sb.from('workers').select('*').in('id',[...new Set(missingIds.map(Number))]);
          if(!wr.error){
            const map={}; (wr.data||[]).forEach(w=>{map[S(w.id)]=workerNameFromAny(w);});
            rows.forEach(r=>{ const n=map[S(r.worker_id||r.employee_id||r.worker)]; if(n) names.push(n); });
          }
        }catch(_){ }
      }
      return uniqueNames(names);
    }catch(_){ return []; }
  }
  async function currentWorkerNamesForMessage(){
    let names=uniqueNames([...(window.__tasneefDailySelectedWorkers||[]).map(x=>typeof x==='string'?x:(x&&x.name)),...readDomWorkerNames(),...readLocalWorkerNames()]);
    if(!names.length) names=await readSupabaseWorkerNames();
    return uniqueNames(names).slice(0,25);
  }
  async function dailyMediaMessage(kind,time){
    const p=projectInfo();
    const action=kind==='in'?'تسجيل دخول':'تسجيل خروج';
    const workers=await currentWorkerNamesForMessage();
    const lines=[
      'شركة تصنيف لإدارة المرافق',
      action,
      'المشرف: '+userName(),
      'المشروع: '+(p.name||p.id||'-'),
      'نوع الزيارة: '+visitType(),
      'التاريخ: '+logDate(),
      'الوقت: '+displayTime(time||timeNow())
    ];
    if(workers.length) lines.push('العمال: '+workers.join('، '));
    lines.push('تم إرفاق صورة موثقة بالتاريخ والوقت');
    return lines.join('\n');
  }
  function fileToImage(file){
    return new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>reject(new Error('تعذر قراءة الصورة'));
      img.src=URL.createObjectURL(file);
    });
  }
  async function makeStampedPhoto(file,kind,time){
    const img=await fileToImage(file);
    const max=1280;
    let w=img.naturalWidth||img.width||900, h=img.naturalHeight||img.height||900;
    const scale=Math.min(1,max/Math.max(w,h));
    w=Math.round(w*scale); h=Math.round(h*scale);
    const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
    const ctx=canvas.getContext('2d'); ctx.drawImage(img,0,0,w,h);
    const p=projectInfo();
    const action=kind==='in'?'تسجيل دخول':'تسجيل خروج';
    const lines=[
      action+' - شركة تصنيف لإدارة المرافق',
      'المشرف: '+userName(),
      'المشروع: '+(p.name||p.id||'-'),
      'التاريخ: '+logDate()+'   الوقت: '+displayTime(time||timeNow())
    ];
    const pad=Math.max(14,Math.round(w*0.018));
    const fs=Math.max(18,Math.round(w*0.028));
    ctx.font='700 '+fs+'px Tahoma, Arial, sans-serif';
    ctx.textAlign='right'; ctx.textBaseline='middle';
    const lineH=Math.round(fs*1.55);
    const boxH=pad*2+lineH*lines.length;
    ctx.fillStyle='rgba(0,0,0,.62)'; ctx.fillRect(0,h-boxH,w,boxH);
    ctx.fillStyle='#fff'; ctx.shadowColor='rgba(0,0,0,.55)'; ctx.shadowBlur=3;
    lines.forEach((line,i)=>ctx.fillText(line,w-pad,h-boxH+pad+(i+.5)*lineH));
    const blob=await new Promise(res=>canvas.toBlob(res,'image/jpeg',0.84));
    if(!blob) throw new Error('تعذر تجهيز الصورة');
    const safeAction=kind==='in'?'دخول':'خروج';
    const name='تصنيف_'+safeAction+'_'+logDate()+'_'+displayTime(time||timeNow()).replace(':','-')+'.jpg';
    return new File([blob],name,{type:'image/jpeg',lastModified:Date.now()});
  }
  function ensureCameraUiStyle(){
    if(document.getElementById('tasneefDailyCameraStyleV10157')) return;
    const st=document.createElement('style'); st.id='tasneefDailyCameraStyleV10157';
    st.textContent=`#tasneefDailyCameraV10157{position:fixed;inset:0;z-index:1000000;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;font-family:Tahoma,Arial,sans-serif;direction:rtl}#tasneefDailyCameraV10157 .cam-card{width:min(560px,96vw);background:#062f27;border:1px solid rgba(255,255,255,.14);border-radius:22px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.45);color:#fff}#tasneefDailyCameraV10157 .cam-head{padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;background:#0A4B3C}#tasneefDailyCameraV10157 .cam-title{font-weight:900;line-height:1.6}#tasneefDailyCameraV10157 .cam-close{border:0;border-radius:999px;background:rgba(255,255,255,.12);color:#fff;width:38px;height:38px;font-size:20px;cursor:pointer}#tasneefDailyCameraV10157 .cam-video-wrap{position:relative;background:#000;aspect-ratio:3/4;max-height:68vh;display:grid;place-items:center;overflow:hidden}#tasneefDailyCameraV10157 video{width:100%;height:100%;object-fit:cover;background:#000}#tasneefDailyCameraV10157 .cam-stamp-preview{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(transparent,rgba(0,0,0,.78));padding:48px 14px 14px;text-align:right;font-weight:900;line-height:1.7;text-shadow:0 2px 6px #000;font-size:14px}#tasneefDailyCameraV10157 .cam-actions{display:flex;gap:10px;padding:13px;background:#08392f}#tasneefDailyCameraV10157 .cam-actions button{flex:1;border:0;border-radius:14px;padding:13px 10px;font-weight:900;cursor:pointer}#tasneefDailyCameraV10157 .cam-capture{background:#fff;color:#06382e}#tasneefDailyCameraV10157 .cam-switch{background:#d9b45b;color:#1d1604}#tasneefDailyCameraV10157 .cam-note{padding:0 14px 14px;color:#d9efe9;font-size:12px;line-height:1.7}`;
    document.head.appendChild(st);
  }
  async function makeStampedPhotoFromSource(source,kind,time){
    const vw=source.videoWidth||source.naturalWidth||source.width||900;
    const vh=source.videoHeight||source.naturalHeight||source.height||1200;
    const max=1280;
    const scale=Math.min(1,max/Math.max(vw,vh));
    const w=Math.max(1,Math.round(vw*scale));
    const h=Math.max(1,Math.round(vh*scale));
    const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
    const ctx=canvas.getContext('2d'); ctx.drawImage(source,0,0,w,h);
    const p=projectInfo();
    const action=kind==='in'?'تسجيل دخول':'تسجيل خروج';
    const lines=[
      action+' - شركة تصنيف لإدارة المرافق',
      'المشرف: '+userName(),
      'المشروع: '+(p.name||p.id||'-'),
      'التاريخ: '+logDate()+'   الوقت: '+displayTime(time||timeNow())
    ];
    const pad=Math.max(14,Math.round(w*0.018));
    const fs=Math.max(18,Math.round(w*0.028));
    ctx.font='700 '+fs+'px Tahoma, Arial, sans-serif';
    ctx.textAlign='right'; ctx.textBaseline='middle';
    const lineH=Math.round(fs*1.55);
    const boxH=pad*2+lineH*lines.length;
    ctx.fillStyle='rgba(0,0,0,.66)'; ctx.fillRect(0,h-boxH,w,boxH);
    ctx.fillStyle='#fff'; ctx.shadowColor='rgba(0,0,0,.55)'; ctx.shadowBlur=3;
    lines.forEach((line,i)=>ctx.fillText(line,w-pad,h-boxH+pad+(i+.5)*lineH));
    const blob=await new Promise(res=>canvas.toBlob(res,'image/jpeg',0.86));
    if(!blob) throw new Error('تعذر تجهيز الصورة');
    const safeAction=kind==='in'?'دخول':'خروج';
    const name='تصنيف_'+safeAction+'_'+logDate()+'_'+displayTime(time||timeNow()).replace(':','-')+'.jpg';
    return new File([blob],name,{type:'image/jpeg',lastModified:Date.now()});
  }
  function captureDailyPhotoFallback(kind,time){
    return new Promise((resolve,reject)=>{
      try{
        const input=document.createElement('input');
        input.type='file'; input.accept='image/*'; input.capture='environment';
        input.style.position='fixed'; input.style.left='-9999px'; input.style.top='-9999px';
        input.setAttribute('aria-hidden','true'); document.body.appendChild(input);
        let done=false;
        input.onchange=async function(){
          if(done) return; done=true;
          const f=input.files&&input.files[0];
          try{
            if(!f) throw new Error('الصورة مطلوبة');
            smartToast('جاري توثيق الصورة بالتاريخ والوقت','wait');
            const stamped=await makeStampedPhoto(f,kind,time);
            resolve(stamped);
          }catch(e){ reject(e); }
          setTimeout(()=>{try{input.remove();}catch(_){ }},1000);
        };
        input.click();
      }catch(e){ reject(e); }
    });
  }
  function captureDailyPhoto(kind,time){
    return new Promise(async (resolve,reject)=>{
      if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
        try{ return resolve(await captureDailyPhotoFallback(kind,time)); }catch(e){ return reject(e); }
      }
      ensureCameraUiStyle();
      let stream=null;
      let facing='environment';
      const action=kind==='in'?'تسجيل دخول':'تسجيل خروج';
      const p=projectInfo();
      const wrap=document.createElement('div'); wrap.id='tasneefDailyCameraV10157';
      wrap.innerHTML=`<div class="cam-card"><div class="cam-head"><div class="cam-title">${action}<br><span style="font-size:12px;font-weight:700;opacity:.9">التقط صورة للتوثيق قبل الحفظ</span></div><button type="button" class="cam-close" aria-label="إغلاق">×</button></div><div class="cam-video-wrap"><video autoplay playsinline muted></video><div class="cam-stamp-preview">${action}<br>المشرف: ${userName()}<br>المشروع: ${(p.name||p.id||'-')}<br>التاريخ: ${logDate()} — الوقت: ${displayTime(time||timeNow())}</div></div><div class="cam-actions"><button type="button" class="cam-capture">التقاط الصورة</button><button type="button" class="cam-switch">تبديل الكاميرا</button></div><div class="cam-note">بعد التقاط الصورة يتم ختمها بالتاريخ والوقت ثم حفظ التسجيل وفتح الواتساب مباشرة.</div></div>`;
      document.body.appendChild(wrap);
      const video=wrap.querySelector('video');
      const closeBtn=wrap.querySelector('.cam-close');
      const capBtn=wrap.querySelector('.cam-capture');
      const switchBtn=wrap.querySelector('.cam-switch');
      const stop=()=>{ try{ if(stream) stream.getTracks().forEach(t=>t.stop()); }catch(_){ } try{wrap.remove();}catch(_){ } };
      async function startCamera(){
        try{ if(stream) stream.getTracks().forEach(t=>t.stop()); }catch(_){ }
        stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing}},audio:false});
        video.srcObject=stream;
        await video.play().catch(()=>{});
      }
      closeBtn.onclick=()=>{ stop(); reject(new Error('الصورة مطلوبة')); };
      switchBtn.onclick=async()=>{
        facing=facing==='environment'?'user':'environment';
        smartToast('جاري تبديل الكاميرا','wait');
        try{ await startCamera(); }catch(e){ smartToast('تعذر تبديل الكاميرا','err'); }
      };
      capBtn.onclick=async()=>{
        try{
          capBtn.disabled=true; capBtn.textContent='جاري تجهيز الصورة...';
          smartToast('جاري ختم الصورة بالتاريخ والوقت','wait');
          const stamped=await makeStampedPhotoFromSource(video,kind,time);
          stop();
          resolve(stamped);
        }catch(e){ capBtn.disabled=false; capBtn.textContent='التقاط الصورة'; reject(e); stop(); }
      };
      try{ await startCamera(); }
      catch(e){
        stop();
        try{ resolve(await captureDailyPhotoFallback(kind,time)); }
        catch(e2){ reject(new Error('لا يتم التسجيل بدون تصوير')); }
      }
    });
  }
  async function shareDailyWhatsapp(kind,time,photoFile){
    const text=await dailyMediaMessage(kind,time);
    try{
      if(photoFile && navigator.canShare && navigator.canShare({files:[photoFile]})){
        await navigator.share({files:[photoFile],text:titleSafe(text),title:'تصنيف - '+(kind==='in'?'تسجيل دخول':'تسجيل خروج')});
        return;
      }
    }catch(e){
      // إذا أغلق المستخدم المشاركة لا نلغي التسجيل؛ الحفظ تم فعلاً بعد وجود الصورة.
    }
    try{
      const url='https://wa.me/?text='+encodeURIComponent(text);
      window.open(url,'_blank','noopener');
      if(photoFile){
        const a=document.createElement('a');
        a.href=URL.createObjectURL(photoFile); a.download=photoFile.name;
        a.style.display='none'; document.body.appendChild(a); a.click();
        setTimeout(()=>{try{URL.revokeObjectURL(a.href);a.remove();}catch(_){ }},3000);
        smartToast('تم فتح واتساب، والصورة نزلت لإرفاقها إذا لم يرسلها الجهاز تلقائياً','wait');
      }
    }catch(_){ }
  }
  function titleSafe(t){ return S(t).slice(0,900); }
  function openDailyCamera(kind){
    // v10157: التصوير من كاميرا التطبيق شرط قبل الحفظ.
    return null;
  }
  function openDailyWhatsapp(kind,time){
    // v10157: الإرسال يتم بعد التقاط الصورة وختمها وحفظ التسجيل.
    return shareDailyWhatsapp(kind,time,null);
  }
  function shouldOpenMediaOnce(key){
    const lk=lockRead('media|'+key);
    if(recent(lk,120000)) return false;
    lockWrite('media|'+key,{status:'opened'});
    return true;
  }
  function installDailyClickGuard(){
    if(window.__tasneefDailyClickGuardV10155) return;
    window.__tasneefDailyClickGuardV10155=true;
    document.addEventListener('click',function(ev){
      const b=ev.target && ev.target.closest ? ev.target.closest('button') : null;
      if(!b) return;
      const t=S(b.textContent);
      // لا نلتقط زر تسجيل الخروج من التطبيق. الالتقاط يكون فقط داخل قسم التسجيلات اليومية أو كرت نموذج التسجيل.
      const inDailySection=!!b.closest('#supLogs,#daily');
      const inLogCard=!!(b.closest('.card') && b.closest('.card').querySelector('#logProject'));
      const inLogs=!!(inDailySection || inLogCard);
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
  function isAdminDailyEditAllowed(){
    const u=currentUser();
    const role=S(u.role||u.user_role||u.type||'').toLowerCase();
    const isAdminPage=/admin\.html/i.test(location.pathname)||!!document.querySelector('section#daily');
    return isAdminPage || ['admin','manager','operations_manager','financial_manager','warehouse_manager','مدير عام','مدير'].includes(role);
  }
  function hideSupervisorManualSave(){
    if(isAdminDailyEditAllowed()) return;
    try{
      [...document.querySelectorAll('button')].forEach(b=>{
        if(/حفظ يدوي/.test(S(b.textContent))){ b.style.display='none'; b.disabled=true; b.title='التعديل مسموح للإدارة فقط'; }
      });
      ['logIn','logOut','logTravel'].forEach(id=>{ const el=$(id); if(el){ el.readOnly=true; el.title='التعديل مسموح للإدارة فقط'; } });
    }catch(_){ }
  }
  function unsupportedColumn(error){
    const msg=S(error&&error.message||error);
    const m=msg.match(/Could not find the '([^']+)' column|column ["']?([^"'\s]+)["']? does not exist/i);
    return m ? (m[1]||m[2]||'') : '';
  }
  async function safeInsert(payload){
    const sb=getClient();
    let p=Object.assign({},payload);
    for(let i=0;i<8;i++){
      const res=await sb.from(TABLE).insert(p).select('*').single();
      if(!res.error) return res;
      const col=unsupportedColumn(res.error);
      if(col && Object.prototype.hasOwnProperty.call(p,col)){ delete p[col]; continue; }
      return res;
    }
    return {error:new Error('تعذر حفظ التسجيل بعد تنظيف الحقول غير الموجودة')};
  }
  async function safeUpdate(payload,id){
    const sb=getClient();
    let p=Object.assign({},payload);
    for(let i=0;i<8;i++){
      const res=await sb.from(TABLE).update(p).eq('id',id).select('*').single();
      if(!res.error) return res;
      const col=unsupportedColumn(res.error);
      if(col && Object.prototype.hasOwnProperty.call(p,col)){ delete p[col]; continue; }
      return res;
    }
    return {error:new Error('تعذر تعديل التسجيل بعد تنظيف الحقول غير الموجودة')};
  }

  async function fetchLogById(id){
    id=S(id); if(!id) return null;
    const sb=getClient(); if(!sb) return null;
    try{
      const res=await sb.from(TABLE).select('*').eq('id',id).maybeSingle();
      if(res && !res.error && res.data) return res.data;
    }catch(_){ }
    return null;
  }
  function dateFromRow(row){
    const v=S(row&&row.log_date)||S(row&&row.date)||S(row&&row.work_date)||S(row&&row.created_date);
    if(/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const t=S(hasIn(row)||hasOut(row)||row&&row.created_at);
    if(/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0,10);
    return logDate();
  }
  function toDbTimestampOnDate(date,t){
    const d=/^\d{4}-\d{2}-\d{2}$/.test(S(date)) ? S(date) : logDate();
    const hm=cleanTime(t);
    return d+'T'+hm+':00'+tzOffset();
  }
  function keepDailyFiltersOn(date){
    date=S(date);
    try{ if(date && $('logDate')) $('logDate').value=date; }catch(_){ }
    try{ if(date && $('dailyDate')) $('dailyDate').value=date; }catch(_){ }
  }
  function mergeManualPayloadWithOriginal(original,payload){
    const base=Object.assign({},original||{});
    const out={updated_at:nowIso()};
    // لا نرسل حقول فارغة فوق السجل القديم. نحافظ على تاريخ السجل الأصلي عند تعديل الوقت فقط.
    const effectiveDate=dateFromRow(base)||S(payload.log_date)||logDate();
    out.log_date=effectiveDate;
    if(S(payload.project_id)) out.project_id=payload.project_id; else if(S(base.project_id)) out.project_id=base.project_id;
    if(S(payload.supervisor_id)) out.supervisor_id=payload.supervisor_id; else if(S(base.supervisor_id)) out.supervisor_id=base.supervisor_id;
    if(S(payload.visit_type)) out.visit_type=payload.visit_type; else if(S(base.visit_type)) out.visit_type=base.visit_type;
    if(Object.prototype.hasOwnProperty.call(payload,'travel_minutes')) out.travel_minutes=payload.travel_minutes;
    if(Object.prototype.hasOwnProperty.call(payload,'notes')) out.notes=payload.notes;
    if(Object.prototype.hasOwnProperty.call(payload,'check_in')) out.check_in=payload.check_in;
    if(Object.prototype.hasOwnProperty.call(payload,'check_out')) out.check_out=payload.check_out;
    return out;
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
    const {data,error}=await safeInsert(payload);
    if(error) throw error;
    return data||payload;
  }
  async function updateCheckOut(row,t){
    const sb=getClient(); const id=rowId(row);
    const payload={check_out:toDbTimestamp(t), updated_at:nowIso(), travel_minutes:Number(S($('logTravel')&&$('logTravel').value))||Number(row.travel_minutes||row.transition_minutes||row.lost_minutes||0)||0, notes:S($('logNotes')&&$('logNotes').value)||S(row.notes)};
    if(!id) throw new Error('لم يتم العثور على رقم السجل المفتوح');
    const {data,error}=await safeUpdate(payload,id);
    if(error) throw error;
    return data||Object.assign({},row,payload);
  }

  // ===== v10164: تحضير العمال + اختيار عمال المشروع قبل التصوير =====

  const W_ATT='daily_worker_attendance', W_MOV='worker_project_movements', W_GRP='project_work_groups';
  function wEsc(s){return S(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function WN(v){return Number(v||0)||0;}
  function wReadJson(v,d){try{return JSON.parse(v||'')||d}catch(_){return d}}
  function wArr(v){return Array.isArray(v)?v:[];}
  function wNow(){return new Date().toISOString();}
  function wMin(a,b){const x=new Date(a),y=new Date(b);return Math.max(0,Math.round((y-x)/60000));}
  function wWorkerName(o){return S(o&& (o.full_name||o.name||o.worker_name||o.employee_name||o.username||o.id));}
  function wWorkerKey(o){return S(o&& (o.id||o.worker_id||o.key||o.full_name||o.name||o.worker_name));}
  async function wSafeSelect(table,sel,limit){const c=getClient(); if(!c) throw new Error('Supabase غير جاهز'); const r=await c.from(table).select(sel||'*').limit(limit||5000); if(r.error) throw r.error; return r.data||[];}
  function wUnsupported(error){const msg=S(error&&error.message||error); const m=msg.match(/Could not find the '([^']+)' column|column ["']?([^"'\s]+)["']? does not exist/i); return m ? (m[1]||m[2]||'') : '';}
  async function wSafeInsert(table,payload){let p=Object.assign({},payload); for(let i=0;i<10;i++){const r=await getClient().from(table).insert(p).select('*').single(); if(!r.error) return r; const col=wUnsupported(r.error); if(col && Object.prototype.hasOwnProperty.call(p,col)){delete p[col]; continue;} return r;} return {error:new Error('تعذر الحفظ')};}
  async function wSafeUpdate(table,payload,id){let p=Object.assign({},payload); for(let i=0;i<10;i++){const r=await getClient().from(table).update(p).eq('id',id).select('*').single(); if(!r.error) return r; const col=wUnsupported(r.error); if(col && Object.prototype.hasOwnProperty.call(p,col)){delete p[col]; continue;} return r;} return {error:new Error('تعذر التعديل')};}
  function wCleanWorkerName(n){
    return S(n).replace(/\s+/g,' ').trim();
  }
  function wDedupeWorkers(list){
    const map=new Map();
    (list||[]).forEach(w=>{
      const name=wCleanWorkerName(w.name);
      if(!name) return;
      // الأساس في التحضير هو اسم العامل حتى لا يتكرر إذا كان له أكثر من سجل أو أكثر من مشروع.
      const keyByName=name.toLowerCase();
      if(!map.has(keyByName)){
        map.set(keyByName,{key:S(w.key||name),name,raw:w.raw||w});
      }
    });
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  }
  async function wWorkers(){
    let rows=[]; try{rows=await wSafeSelect('workers','*',5000)}catch(_){rows=[]}
    const uk=userId(), un=userName();
    const filtered=rows.filter(w=>{
      const st=S(w.status||w.worker_status||w.active);
      if(/inactive|موقوف|false/i.test(st)) return false;
      const sup=[w.supervisor_id,w.supervisor_key,w.supervisor_name,w.supervisor,w.manager_name,w.project_supervisor].map(S).filter(Boolean);
      return !sup.length||sup.includes(uk)||sup.includes(un)||sup.some(x=>x.includes(un)||un.includes(x));
    }).map(w=>({key:wWorkerKey(w), name:wWorkerName(w), raw:w})).filter(w=>w.key&&w.name);
    return wDedupeWorkers(filtered);
  }
  async function wPrepared(){
    try{const r=await getClient().from(W_ATT).select('*').eq('attendance_date',logDate()).eq('supervisor_key',userId()).eq('status','present').limit(1000); if(r.error) throw r.error; return r.data||[];}catch(e){return []}
  }
  async function wOpen(){
    try{const r=await getClient().from(W_MOV).select('*').eq('supervisor_key',userId()).eq('status','open').limit(1000); if(r.error) throw r.error; return r.data||[];}catch(e){return []}
  }
  function wProjectMatches(m,p){const vals=[m.project_key,m.project_name,m.project_id,m.project,m.group_name,m.group_key].map(S); return vals.includes(S(p.id))||vals.includes(S(p.name));}
  async function wGroups(){
    let rows=[]; try{rows=await wSafeSelect(W_GRP,'*',200)}catch(_){ }
    if(!rows.length) rows=[{group_key:'shaalan_50_51',group_name:'الشعلان 50/51',allocation:[{project_key:'الشعلان 50',project_name:'الشعلان 50',percent:50},{project_key:'الشعلان 51',project_name:'الشعلان 51',percent:50}],is_active:true}];
    return rows.filter(g=>g.is_active!==false).map(g=>({key:S(g.group_key||g.id),name:S(g.group_name||g.name),allocation:typeof g.allocation==='string'?wReadJson(g.allocation,[]):wArr(g.allocation)}));
  }
  async function wTarget(){
    const p=projectInfo(); const groups=await wGroups();
    const g=groups.find(x=>x.name===p.name||x.key===p.id||p.name.includes(x.name)||x.name.includes(p.name));
    if(g) return {type:'group',key:g.key,name:g.name,allocation:g.allocation};
    return {type:'project',key:p.id||p.name,name:p.name||p.id,allocation:[]};
  }
  function wSetSelectedWorkers(ws){
    const names=(ws||[]).map(w=>S(w.name||w.worker_name||w)).filter(Boolean);
    window.__tasneefDailySelectedWorkers=names;
    let box=document.getElementById('tasneefDailySelectedWorkersHiddenV10164');
    if(!box){box=document.createElement('div');box.id='tasneefDailySelectedWorkersHiddenV10164';box.style.display='none';document.body.appendChild(box)}
    box.innerHTML=names.map(n=>`<label><input type="checkbox" checked data-worker-name="${wEsc(n)}">${wEsc(n)}</label>`).join('');
  }
  function wStyle(){
    if(document.getElementById('tasneefWFlowStyleV10164')) return;
    const st=document.createElement('style'); st.id='tasneefWFlowStyleV10164';
    st.textContent=`.wf64-panel{border:1px solid #dce8e3;background:#fbfdfc;border-radius:18px;padding:12px;margin:10px 0}.wf64-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.wf64-kpi{background:#fff;border:1px solid #e3eeea;border-radius:14px;padding:10px;text-align:center}.wf64-kpi small{display:block;color:#60706a;margin-bottom:4px}.wf64-kpi b{font-size:24px;color:#0A4033}.wf64-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.wf64-actions button{border:0;border-radius:12px;padding:10px 13px;font-weight:900;cursor:pointer;background:#0A4033;color:#fff}.wf64-actions .light{background:#eef6f3;color:#0A4033;border:1px solid #dce8e3}.wf64-modal{position:fixed;inset:0;z-index:1000001;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;direction:rtl;font-family:Tahoma,Arial,sans-serif}.wf64-card{width:min(620px,94vw);max-height:86vh;overflow:auto;background:#fff;border-radius:22px;box-shadow:0 24px 80px rgba(0,0,0,.25);padding:16px}.wf64-card h2{margin:0 0 8px;color:#0A4033}.wf64-list{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:12px 0}.wf64-worker{border:1px solid #e1ebe7;border-radius:14px;padding:10px;background:#fbfdfc;font-weight:900}.wf64-worker input{width:auto!important;margin-left:7px}.wf64-note{color:#60706a;line-height:1.7;font-size:13px}.wf64-toast{position:fixed;top:76px;left:50%;transform:translateX(-50%);background:#0A4033;color:#fff;padding:12px 16px;border-radius:16px;z-index:1000002;font-weight:900;box-shadow:0 14px 45px rgba(0,0,0,.2)}@media(max-width:760px){.wf64-kpis,.wf64-list{grid-template-columns:1fr}}`;
    document.head.appendChild(st);
  }
  function wToast(t){smartToast(t);}
  async function wStats(){
    const prep=await wPrepared(), open=await wOpen();
    const openKeys=new Set(open.map(x=>S(x.worker_key)));
    const preparedByName=new Map();
    (prep||[]).forEach(x=>{const n=wCleanWorkerName(x.worker_name); if(n&&!preparedByName.has(n.toLowerCase())) preparedByName.set(n.toLowerCase(),x);});
    const prepUniq=[...preparedByName.values()];
    const preparedKeys=new Set(prepUniq.map(x=>S(x.worker_key)));
    return {prepared:prepUniq.length, working:open.length, available:[...preparedKeys].filter(k=>!openKeys.has(k)).length, prep:prepUniq, open, openKeys};
  }
  async function wRenderPanel(){
    if(!document.getElementById('logProject')) return; wStyle();
    let host=document.getElementById('tasneefWorkerFlowPanelV10164');
    if(!host){
      const logCard=document.getElementById('logProject')?.closest('.card')||document.querySelector('section.card');
      if(!logCard) return;
      host=document.createElement('div'); host.id='tasneefWorkerFlowPanelV10164'; host.className='wf64-panel';
      const actions=logCard.querySelector('.actions'); if(actions) logCard.insertBefore(host,actions); else logCard.appendChild(host);
    }
    const st=await wStats();
    host.innerHTML=`<div class="wf64-kpis"><div class="wf64-kpi"><small>عمال اليوم</small><b>${st.prepared}</b></div><div class="wf64-kpi"><small>يعملون الآن</small><b>${st.working}</b></div><div class="wf64-kpi"><small>المتاح</small><b>${st.available}</b></div></div><div class="wf64-actions"><button type="button" onclick="TasneefWorkerFlowV10164.prepare()">تحضير العمال</button><button type="button" class="light" onclick="TasneefWorkerFlowV10164.summary()">ملخص اليوم</button></div>`;
    wRenderDailyWorkersCard();
  }
  function wModal(title,body,okText){
    return new Promise(resolve=>{
      wStyle(); const m=document.createElement('div'); m.className='wf64-modal';
      m.innerHTML=`<div class="wf64-card"><h2>${wEsc(title)}</h2>${body}<div class="wf64-actions"><button type="button" data-ok="1">${wEsc(okText||'اعتماد')}</button><button type="button" class="light" data-close="1">إلغاء</button></div></div>`;
      document.body.appendChild(m);
      m.querySelector('[data-close]').onclick=()=>{m.remove();resolve(null)};
      m.querySelector('[data-ok]').onclick=()=>{resolve(m);};
    });
  }
  async function wPrepare(){
    const workers=await wWorkers(); const present=await wPrepared(); const presentSet=new Set(present.map(x=>S(x.worker_key)));
    const list=workers.length?workers.map(w=>`<label class="wf64-worker"><input type="checkbox" value="${wEsc(w.key)}" data-name="${wEsc(w.name)}" ${presentSet.has(w.key)?'checked':''}>${wEsc(w.name)}</label>`).join(''):'<div class="wf64-note">لا يوجد عمال مرتبطون بهذا المشرف.</div>';
    const m=await wModal('تحضير العمال من السكن',`<div class="wf64-note">حدد العمال الحاضرين معك اليوم. هؤلاء سيصبحون رصيدك المتاح للتوزيع على المشاريع.</div><div class="wf64-list">${list}</div>`,'اعتماد الحضور');
    if(!m) return;
    const selected=[...m.querySelectorAll('input:checked')].map(i=>({key:i.value,name:i.dataset.name||i.value})); m.remove();
    if(!selected.length){wToast('حدد عامل واحد على الأقل'); return;}
    const rows=selected.map(w=>({attendance_date:logDate(),supervisor_key:userId(),supervisor_name:userName(),worker_key:w.key,worker_name:w.name,status:'present',prepared_at:wNow(),updated_at:wNow()}));
    const r=await getClient().from(W_ATT).upsert(rows,{onConflict:'attendance_date,supervisor_key,worker_key'});
    if(r.error){smartToast('شغل ملف SQL الخاص بتحضير العمال أولاً: '+r.error.message,'err'); return;}
    wToast('تم تحضير '+selected.length+' عمال لهذا اليوم'); await wRenderPanel();
  }
  async function wAskIn(){
    const st=await wStats();
    if(!st.prepared){ await wPrepare(); }
    const st2=await wStats(); const openKeys=st2.openKeys;
    const workers=st2.prep.filter(x=>!openKeys.has(S(x.worker_key))).map(x=>({key:S(x.worker_key),name:S(x.worker_name)}));
    if(!workers.length){smartToast('لا يوجد عمال متاحين. كل العمال يعملون الآن أو لم يتم تحضيرهم.','err'); return null;}
    const p=projectInfo();
    const list=workers.map(w=>`<label class="wf64-worker"><input type="checkbox" value="${wEsc(w.key)}" data-name="${wEsc(w.name)}">${wEsc(w.name)}</label>`).join('');
    const m=await wModal('اختيار عمال المشروع',`<div class="wf64-note">المشروع: <b>${wEsc(p.name||p.id)}</b><br>المتاح الآن: <b>${workers.length}</b>. اختر العمال الذين سيدخلون هذا المشروع، ثم ستفتح الكاميرا.</div><div class="wf64-list" id="workersForProject">${list}</div>`,'اعتماد العمال والمتابعة للتصوير');
    if(!m) return null;
    const selected=[...m.querySelectorAll('input:checked')].map(i=>({key:i.value,name:i.dataset.name||i.value}));
    m.remove();
    if(!selected.length){smartToast('لم يتم اختيار عمال، لن يتم تسجيل الدخول','err'); return null;}
    wSetSelectedWorkers(selected); return selected;
  }
  async function wAskOut(){
    const p=projectInfo(); const rows=(await wOpen()).filter(m=>wProjectMatches(m,p));
    if(!rows.length){ wSetSelectedWorkers([]); return []; }
    const list=rows.map(m=>`<label class="wf64-worker"><input type="checkbox" value="${wEsc(m.id)}" data-key="${wEsc(m.worker_key)}" data-name="${wEsc(m.worker_name)}" checked>${wEsc(m.worker_name)}</label>`).join('');
    const m=await wModal('عمال المشروع الحالي',`<div class="wf64-note">اختر العمال الذين سيتم تسجيل خروجهم من <b>${wEsc(p.name||p.id)}</b>. الافتراضي إخراج الجميع.</div><div class="wf64-list" id="workersForProject">${list}</div>`,'اعتماد العمال والمتابعة للتصوير');
    if(!m) return null;
    const selected=[...m.querySelectorAll('input:checked')].map(i=>({id:i.value,key:i.dataset.key,name:i.dataset.name||i.value}));
    m.remove(); wSetSelectedWorkers(selected); return selected;
  }
  async function wCloseMovement(m,reason,t){const end=t||wNow(); const mins=wMin(m.start_at,end); const r=await wSafeUpdate(W_MOV,{end_at:end,actual_minutes:mins,status:'closed',close_reason:reason||'خروج',updated_at:end},m.id); if(r.error) throw r.error; return r.data;}
  async function wStartMovements(workers,row){
    if(!workers||!workers.length) return; const target=await wTarget(); const open=await wOpen(); const now=wNow();
    for(const w of workers){
      for(const m of open.filter(x=>S(x.worker_key)===S(w.key))){ await wCloseMovement(m,'نقل تلقائي',now); }
      const payload={idempotency_key:[logDate(),userId(),w.key,target.type,target.key,now.slice(0,16)].join('|'),movement_date:logDate(),supervisor_key:userId(),supervisor_name:userName(),worker_key:w.key,worker_name:w.name,target_type:target.type,project_key:target.type==='project'?target.key:null,project_name:target.name,group_key:target.type==='group'?target.key:null,group_name:target.type==='group'?target.name:null,allocation:target.allocation||[],visit_type:visitType(),time_log_id:S(rowId(row)||($('logId')&&$('logId').value)),start_at:now,status:'open',notes:'دخول من التسجيلات اليومية',created_at:now,updated_at:now};
      const r=await wSafeInsert(W_MOV,payload); if(r.error && !/duplicate|unique/i.test(S(r.error.message))) console.warn('worker movement insert failed',r.error);
    }
    await wRenderPanel();
  }
  async function wCloseSelected(selected){
    if(!selected||!selected.length) return; const ids=new Set(selected.map(x=>S(x.id)).filter(Boolean)); const keys=new Set(selected.map(x=>S(x.key)).filter(Boolean)); const now=wNow();
    const rows=await wOpen();
    for(const m of rows.filter(x=>(ids.has(S(x.id))||keys.has(S(x.worker_key))) && wProjectMatches(x,projectInfo()))){ await wCloseMovement(m,'خروج',now); }
    await wRenderPanel();
  }
  async function wSummary(){
    const st=await wStats(); const p=projectInfo();
    const openList=st.open.length?st.open.map(m=>`<div class="wf64-worker"><b>${wEsc(m.worker_name)}</b><span>${wEsc(m.project_name||m.group_name||'-')}</span></div>`).join(''):'<div class="wf64-note">لا يوجد عمال يعملون الآن.</div>';
    const m=await wModal('ملخص عمال اليوم',`<div class="wf64-kpis"><div class="wf64-kpi"><small>عمال اليوم</small><b>${st.prepared}</b></div><div class="wf64-kpi"><small>يعملون الآن</small><b>${st.working}</b></div><div class="wf64-kpi"><small>المتاح</small><b>${st.available}</b></div></div><h3 style="color:#0A4033">العمال المفتوحين الآن</h3><div class="wf64-list">${openList}</div>`,'إغلاق'); if(m) m.remove();
  }
  async function wRenderDailyWorkersCard(){
    try{
      const daily=document.getElementById('daily')||document.body; let card=document.getElementById('tasneefDailyWorkersRecordV10164');
      if(!card && document.getElementById('logsBody')){card=document.createElement('div');card.id='tasneefDailyWorkersRecordV10164';card.className='card';card.innerHTML='<h2>عمال التسجيلات اليومية</h2><div id="tasneefDailyWorkersTableV10164" class="table-wrap"></div>'; daily.appendChild(card);}
      const box=document.getElementById('tasneefDailyWorkersTableV10164'); if(!box)return;
      const date=S(document.getElementById('dailyDate')&&document.getElementById('dailyDate').value)||logDate();
      const r=await getClient().from(W_MOV).select('*').eq('movement_date',date).limit(1000); if(r.error){box.innerHTML='<div class="wf64-note">شغل ملف SQL الخاص بحركة العمال حتى تظهر هنا.</div>'; return;}
      let rows=r.data||[];
      // v10167: إذا حُذف سجل التسجيل اليومي، لا تُعرض حركة العمال المرتبطة به.
      try{
        const lr=await getClient().from(TABLE).select('id,log_date,created_at,check_in').limit(2000);
        if(!lr.error){
          const live=new Set((lr.data||[]).filter(x=>{const dd=S(x.log_date)||S(x.created_at).slice(0,10)||S(x.check_in).slice(0,10); return !dd||dd===date;}).map(x=>S(rowId(x)||x.id)).filter(Boolean));
          rows=rows.filter(m=>!S(m.time_log_id)||live.has(S(m.time_log_id)));
        }
      }catch(_){ }
      box.innerHTML=`<table><thead><tr><th>العامل</th><th>المشرف</th><th>المشروع</th><th>الدخول</th><th>الخروج</th><th>الحالة</th></tr></thead><tbody>${rows.length?rows.map(m=>`<tr><td>${wEsc(m.worker_name)}</td><td>${wEsc(m.supervisor_name)}</td><td>${wEsc(m.project_name||m.group_name)}</td><td>${m.start_at?new Date(m.start_at).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}):'-'}</td><td>${m.end_at?new Date(m.end_at).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}):'-'}</td><td>${m.status==='open'?'يعمل الآن':'مغلق'}</td></tr>`).join(''):'<tr><td colspan="6">لا توجد حركات عمال لهذا التاريخ.</td></tr>'}</tbody></table>`;
    }catch(_){ }
  }
  async function wRenderAttendanceWorkersCard(){
    try{
      const sec=document.getElementById('attendance'); if(!sec || document.getElementById('tasneefAttendanceWorkersPreparedV10164')) return;
      const card=document.createElement('div'); card.id='tasneefAttendanceWorkersPreparedV10164'; card.className='card'; card.innerHTML='<h2>تحضير العمال من المشرفين</h2><div id="tasneefAttendanceWorkersPreparedBodyV10164" class="table-wrap"></div>'; sec.insertBefore(card,sec.firstChild);
      const render=async()=>{const d=S(document.getElementById('attendanceFilterDate')&&document.getElementById('attendanceFilterDate').value)||today(); const r=await getClient().from(W_ATT).select('*').eq('attendance_date',d).limit(1000); const rows=(r&&!r.error)?(r.data||[]):[]; document.getElementById('tasneefAttendanceWorkersPreparedBodyV10164').innerHTML=`<table><thead><tr><th>التاريخ</th><th>العامل</th><th>المشرف</th><th>الحالة</th><th>وقت التحضير</th></tr></thead><tbody>${rows.length?rows.map(x=>`<tr><td>${wEsc(x.attendance_date)}</td><td>${wEsc(x.worker_name)}</td><td>${wEsc(x.supervisor_name)}</td><td>حاضر</td><td>${x.prepared_at?new Date(x.prepared_at).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}):'-'}</td></tr>`).join(''):'<tr><td colspan="5">لا توجد بيانات تحضير.</td></tr>'}</tbody></table>`}; await render(); setInterval(render,20000);
    }catch(_){ }
  }
  window.TasneefWorkerFlowV10164={prepare:wPrepare,summary:wSummary,render:wRenderPanel};

  async function checkInSmart(){
    const key=opKey('in'), l=lockRead(key);
    if(recent(l,120000)){ smartToast(l.status==='done'?'تم تسجيل الدخول':'جاري حفظ تسجيل الدخول، لا تضغط مرة ثانية','wait'); return; }
    lockWrite(key,{status:'pending'}); buttonBusy('in',true);
    try{
      const rows=await fetchTodayRows();
      const open=rows.find(r=>hasIn(r)&&!hasOut(r));
      if(open){ fillForm('in',hasIn(open),open); lockWrite(key,{status:'done'}); smartToast('تم تسجيل الدخول مسبقاً'); return; }
      const selectedWorkers=await wAskIn();
      if(!selectedWorkers){ lockClear(key); return; }
      const t=timeNow();
      const photo=await captureDailyPhoto('in',t);
      const row=await insertCheckIn(t); fillForm('in',t,row); await wStartMovements(selectedWorkers,row); lockWrite(key,{status:'done'}); smartToast('تم تسجيل الدخول'); await shareDailyWhatsapp('in',t,photo);
      try{ if(typeof window.renderSupervisorDailySummary==='function') window.renderSupervisorDailySummary(); }catch(_){ }
    }catch(e){ lockClear(key); smartToast(/الصورة مطلوبة|تعذر تجهيز الصورة|تعذر قراءة الصورة/.test(S(e.message||e))?'لا يتم تسجيل الدخول بدون صورة':'تعذر تسجيل الدخول: '+S(e.message||e),'err'); }
    finally{ buttonBusy('in',false); }
  }
  async function checkOutSmart(){
    const key=opKey('out'), l=lockRead(key);
    if(recent(l,120000)){ smartToast(l.status==='done'?'تم تسجيل الخروج':'جاري حفظ تسجيل الخروج، لا تضغط مرة ثانية','wait'); return; }
    lockWrite(key,{status:'pending'}); buttonBusy('out',true);
    try{
      const rows=await fetchTodayRows();
      const open=rows.find(r=>hasIn(r)&&!hasOut(r));
      if(open){ const selectedWorkers=await wAskOut(); if(selectedWorkers===null){ lockClear(key); return; } const t=timeNow(); const photo=await captureDailyPhoto('out',t); const row=await updateCheckOut(open,t); fillForm('out',t,row); await wCloseSelected(selectedWorkers); lockWrite(key,{status:'done'}); smartToast('تم تسجيل الخروج'); await shareDailyWhatsapp('out',t,photo); return; }
      const already=rows.find(r=>hasIn(r)&&hasOut(r));
      if(already){ fillForm('out',hasOut(already),already); lockWrite(key,{status:'done'}); smartToast('تم تسجيل الخروج مسبقاً'); return; }
      lockClear(key); smartToast('لا يوجد تسجيل دخول مفتوح لهذا المشروع اليوم','err');
    }catch(e){ lockClear(key); smartToast(/الصورة مطلوبة|تعذر تجهيز الصورة|تعذر قراءة الصورة/.test(S(e.message||e))?'لا يتم تسجيل الخروج بدون صورة':'تعذر تسجيل الخروج: '+S(e.message||e),'err'); }
    finally{ buttonBusy('out',false); }
  }


  // ===== v10169: إصلاح لوحة الرئيسية - تسجيلات اليوم + عدم تكرار العمال =====
  function admDateOfRow(row){
    const direct=S(row&& (row.log_date||row.visit_date||row.attendance_date||row.date||row.work_date));
    if(/^\d{4}-\d{2}-\d{2}/.test(direct)) return direct.slice(0,10);
    const t=S(row&& (row.check_in||row.check_out||row.created_at||row.updated_at));
    if(/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0,10);
    return '';
  }
  function admSupName(row){ return S(row&& (row.supervisor_name||row.supervisor||row.user_name||row.created_by_name||row.manager_name||row.supervisor_id||row.user_id||'غير محدد'))||'غير محدد'; }
  function admMinutesFromTime(v){
    const hm=cleanTime(v); const m=hm.match(/^(\d{2}):(\d{2})$/); if(!m) return null;
    return Number(m[1])*60+Number(m[2]);
  }
  function admDuration(row){
    const a=S(row&& (row.check_in||row.time_in||row.log_in||row.in_time||row.start_time));
    const b=S(row&& (row.check_out||row.time_out||row.log_out||row.out_time||row.end_time));
    if(!a||!b) return 0;
    try{ const da=new Date(a), db=new Date(b); if(!isNaN(da)&&!isNaN(db)){ const m=Math.round((db-da)/60000); return m>0?m:0; } }catch(_){ }
    const x=admMinutesFromTime(a), y=admMinutesFromTime(b); if(x==null||y==null) return 0;
    return Math.max(0,y-x);
  }
  function admFmtHM(mins){ mins=Math.max(0,Math.round(Number(mins)||0)); return Math.floor(mins/60)+':'+String(mins%60).padStart(2,'0'); }
  function admNormName(n){ return S(n).replace(/[ً-ٰٟ]/g,'').replace(/\s+/g,' ').trim().toLowerCase(); }
  function admWorkerName(w){ return S(w&& (w.full_name||w.name||w.worker_name||w.employee_name||w.username)); }
  async function admSelectAll(table,limit){
    try{ const r=await getClient().from(table).select('*').limit(limit||5000); if(r&&!r.error) return r.data||[]; }catch(_){ }
    return [];
  }
  async function admLoadTodayRows(date){
    const all=await admSelectAll(TABLE,5000);
    const seen=new Set(), out=[];
    all.forEach(r=>{
      if(admDateOfRow(r)!==date) return;
      const k=S(rowId(r)||JSON.stringify([r.check_in,r.check_out,r.project_id,r.project_name,r.supervisor_id,r.supervisor_name]));
      if(seen.has(k)) return; seen.add(k); out.push(r);
    });
    return out;
  }
  async function admRenderHomeSummaryV10169(){
    if(!document.getElementById('todaySummary')&&!document.getElementById('kpiTodayLogs')&&!document.getElementById('kpiWorkers')) return;
    const d=today();
    const rows=await admLoadTodayRows(d);
    const kpi=document.getElementById('kpiTodayLogs'); if(kpi) kpi.textContent=String(rows.length);
    const by=new Map();
    rows.forEach(r=>{
      const sup=admSupName(r); if(!by.has(sup)) by.set(sup,{count:0,mins:0});
      const x=by.get(sup); x.count+=1; x.mins+=admDuration(r);
    });
    const box=document.getElementById('todaySummary');
    if(box){
      if(by.size){
        box.innerHTML=[...by.entries()].sort((a,b)=>a[0].localeCompare(b[0],'ar')).map(([sup,x])=>`<div class="summary-item"><b>${wEsc(sup)}</b><br>عدد التسجيلات: ${x.count}<br>إجمالي الوقت: ${admFmtHM(x.mins)}</div>`).join('');
      }else{
        box.innerHTML='<div class="summary-item">لا توجد تسجيلات يومية محفوظة بتاريخ اليوم. إذا كنت تعرض تاريخًا سابقًا افتح تبويب التسجيلات اليومية واختر التاريخ المطلوب.</div>';
      }
    }
    try{
      const workers=await admSelectAll('workers',5000);
      if(workers.length){
        const names=new Set(); workers.forEach(w=>{ const n=admNormName(admWorkerName(w)); if(n) names.add(n); });
        const kw=document.getElementById('kpiWorkers'); if(kw) kw.textContent=String(names.size||workers.length);
      }
    }catch(_){ }
  }
  function admDedupeWorkerRowsV10169(){
    ['workersBody','workersTableBody','workerBody'].forEach(id=>{
      const body=document.getElementById(id); if(!body) return;
      const seen=new Set();
      [...body.querySelectorAll('tr')].forEach(tr=>{
        const tds=[...tr.children].map(td=>admNormName(td.textContent)).filter(Boolean);
        if(!tds.length) return;
        const key=tds.join('|');
        if(seen.has(key)) tr.remove(); else seen.add(key);
      });
    });
  }
  function admInstallDashboardFixV10169(){
    if(window.__tasneefDashboardDailyWorkersFixV10169) return;
    window.__tasneefDashboardDailyWorkersFixV10169=true;
    admRenderHomeSummaryV10169().catch(()=>{});
    admDedupeWorkerRowsV10169();
    setInterval(()=>{admRenderHomeSummaryV10169().catch(()=>{}); admDedupeWorkerRowsV10169();},7000);
  }

  function install(){
    try{ admInstallDashboardFixV10169(); }catch(_){ }
    if(!document.getElementById('logProject')) return;
    window.supervisorCheckIn=function(){ return checkInSmart(); };
    window.supervisorCheckOut=function(){ return checkOutSmart(); };
    installDailyClickGuard();
    hideSupervisorManualSave();
    setTimeout(()=>{try{wRenderPanel();wRenderAttendanceWorkersCard();wRenderDailyWorkersCard();}catch(_){}},500);
    setInterval(()=>{try{wRenderPanel();wRenderDailyWorkersCard();}catch(_){}},30000);
    // حفظ يدوي بصيغة صحيحة: يحول HH:MM إلى تاريخ + وقت كامل قبل الإرسال إلى Supabase.
    window.saveTimeLog=async function(){
      if(!isAdminDailyEditAllowed()){ smartToast('التعديل مسموح للإدارة فقط','err'); return; }
      const key=opKey('manual'), l=lockRead(key);
      if(recent(l,90000)){ smartToast('جاري حفظ التسجيل، لا تضغط مرة ثانية','wait'); return; }
      lockWrite(key,{status:'pending'});
      try{
        const id=S($('logId')&&$('logId').value);
        const p=projectInfo(); const u=currentUser();
        const inVal=S($('logIn')&&$('logIn').value);
        const outVal=S($('logOut')&&$('logOut').value);
        const original=id ? await fetchLogById(id) : null;
        const originalDate=original ? dateFromRow(original) : logDate();
        const effectiveDate=originalDate || logDate();

        const rawPayload={
          log_date:effectiveDate,
          project_id:p.id||p.name,
          supervisor_id:S(u.id||u.user_id||u.username||u.email||userName()),
          visit_type:visitType(),
          travel_minutes:Number(S($('logTravel')&&$('logTravel').value))||0,
          notes:S($('logNotes')&&$('logNotes').value),
          updated_at:nowIso()
        };
        if(inVal) rawPayload.check_in=toDbTimestampOnDate(effectiveDate,inVal);
        if(outVal) rawPayload.check_out=toDbTimestampOnDate(effectiveDate,outVal);

        let result;
        if(id){
          // التعديل يتم على نفس السجل فقط، مع الحفاظ على تاريخ السجل الأصلي وعدم إرسال فراغات تمسح البيانات.
          const updatePayload=mergeManualPayloadWithOriginal(original||{},rawPayload);
          result=await safeUpdate(updatePayload,id);
          if(result.error) throw result.error;
          const saved=result.data||Object.assign({},original||{},updatePayload,{id});
          keepDailyFiltersOn(dateFromRow(saved)||effectiveDate);
          if($('logId')) $('logId').value=rowId(saved)||id;
          fillForm('in',hasIn(saved)||updatePayload.check_in,saved);
          if(hasOut(saved)||updatePayload.check_out) fillForm('out',hasOut(saved)||updatePayload.check_out,saved);
        }else{
          const rows=await fetchTodayRows();
          const open=rows.find(r=>hasIn(r)&&!hasOut(r));
          if(open&&rowId(open)){
            const updatePayload=mergeManualPayloadWithOriginal(open,rawPayload);
            result=await safeUpdate(updatePayload,rowId(open));
            if(result.error) throw result.error;
            const saved=result.data||Object.assign({},open,updatePayload);
            keepDailyFiltersOn(dateFromRow(saved));
            fillForm('in',hasIn(saved)||updatePayload.check_in,saved);
            if(hasOut(saved)||updatePayload.check_out) fillForm('out',hasOut(saved)||updatePayload.check_out,saved);
          }else{
            const insertPayload=Object.assign({},rawPayload,{log_date:logDate(),created_at:nowIso()});
            if(inVal) insertPayload.check_in=toDbTimestampOnDate(insertPayload.log_date,inVal);
            if(outVal) insertPayload.check_out=toDbTimestampOnDate(insertPayload.log_date,outVal);
            result=await safeInsert(insertPayload);
            if(result.error) throw result.error;
            const saved=result.data||insertPayload;
            keepDailyFiltersOn(dateFromRow(saved)||insertPayload.log_date);
            fillForm('in',hasIn(saved)||insertPayload.check_in,saved);
            if(hasOut(saved)||insertPayload.check_out) fillForm('out',hasOut(saved)||insertPayload.check_out,saved);
          }
        }
        lockWrite(key,{status:'done'});
        smartToast('تم تعديل السجل وبقي ظاهرًا');
        try{ if(typeof window.renderSupervisorDailySummary==='function') window.renderSupervisorDailySummary(); }catch(_){ }
        try{ if(typeof window.renderTimeLogs==='function') window.renderTimeLogs(); }catch(_){ }
      }catch(e){
        lockClear(key);
        smartToast('تعذر حفظ التعديل: '+S(e.message||e),'err');
      }
    };
    console.log(VERSION,'installed - worker attendance project flow + admin edit preserve');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(install,900)); else setTimeout(install,900);
  setTimeout(install,2500);
})();

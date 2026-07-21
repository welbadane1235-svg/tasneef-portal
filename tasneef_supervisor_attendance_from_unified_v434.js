(function(){
  'use strict';
  const BUILD='V10802 strict supervisor worker scope';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const N=v=>Number(v)||0;
  const esc=s=>S(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>S(s).toLowerCase().replace(/[إأآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
  const today=()=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}catch(_){const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}};
  const monthOf=d=>S(d||today()).slice(0,7);
  const statusCode=v=>{const x=norm(v); if(['absent','غائب','غياب','غ','a'].includes(x))return 'absent'; if(['present','حاضر','حضور','ح','p'].includes(x))return 'present'; return x||'present';};
  const isOff=v=>['deleted','inactive','stopped','ended','محذوف','موقوف','منتهي'].includes(norm(v));
  function getUser(){try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return {};}}
  function userKeys(u){return [u.employee_code,u.worker_employee_code,u.code,u.user_code,u.username,u.id,u.full_name,u.name,u.display_name].map(S).filter(Boolean);}
  function toast(t,bad){
    try{ if(typeof window.msg==='function') window.msg(t,bad?'err':'ok'); }catch(_){}
    const e=$('supUniMsg')||$('attSupMsg')||$('globalMsg');
    if(e){e.textContent=t; e.style.display='block'; e.style.color=bad?'#9d2222':'#07513f';}
  }
  async function q(table,cols='*'){
    const r=await window.sb.from(table).select(cols);
    if(r.error) throw r.error;
    return r.data||[];
  }
  async function qAttendanceMonth(m){
    const from=m+'-01'; const [y,mo]=m.split('-').map(Number); const d=new Date(y,mo,1); const to=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const all=[]; let start=0; const size=1000;
    while(true){
      const r=await window.sb.from('attendance').select('*').gte('attendance_date',from).lt('attendance_date',to).range(start,start+size-1);
      if(r.error) throw r.error;
      const rows=r.data||[]; all.push(...rows);
      if(rows.length<size)break; start+=size; if(start>30000)break;
    }
    return all;
  }
  function getName(row){return S(row.worker_name||row.worker_identity||row.app_name||row.name||row.full_name||row.employee_name||'');}
  function getCode(row){return S(row.worker_employee_code||row.employee_code||row.worker_code||row.code||row.id||'');}
  function getProjectKey(row){return S(row.project_key||row.project_id||row.project_code||'');}
  function getProjectName(row){return S(row.project_name||row.project||row.name_project||row.project_title||'');}
  function getSupCode(row){return S(row.supervisor_employee_code||row.supervisor_code||row.supervisor_id||'');}
  function getSupName(row){return S(row.supervisor_name||row.supervisor||'');}
  function matchSupervisor(row,u){
    const keys=userKeys(u); const rowKeys=[getSupCode(row),getSupName(row)].filter(Boolean);
    if(!keys.length) return true;
    return rowKeys.some(rk=>keys.some(k=>S(rk)===S(k)||norm(rk)===norm(k)));
  }
  function dedupeDistribution(rows){
    const map=new Map();
    rows.filter(r=>!isOff(r.status||r.state)).forEach(r=>{
      const name=getName(r), code=getCode(r);
      if(!name&&!code) return;
      const key=code?('code:'+code):('name:'+norm(name));
      if(!map.has(key)){
        map.set(key,{worker_name:name,worker_employee_code:code,supervisor_employee_code:getSupCode(r),supervisor_name:getSupName(r),projects:[],raw:[]});
      }
      const o=map.get(key); o.raw.push(r);
      if(!o.worker_name && name) o.worker_name=name;
      if(!o.worker_employee_code && code) o.worker_employee_code=code;
      if(!o.supervisor_employee_code && getSupCode(r)) o.supervisor_employee_code=getSupCode(r);
      if(!o.supervisor_name && getSupName(r)) o.supervisor_name=getSupName(r);
      const pk=getProjectKey(r), pn=getProjectName(r);
      if((pk||pn) && !o.projects.some(p=>p.key===pk && p.name===pn)) o.projects.push({key:pk,name:pn});
    });
    return [...map.values()].sort((a,b)=>S(a.worker_employee_code).localeCompare(S(b.worker_employee_code),'en') || S(a.worker_name).localeCompare(S(b.worker_name),'ar'));
  }
  function recStamp(a){const raw=S(a?.updated_at||a?.created_at||a?.attendance_date||'');const ms=Date.parse(raw);return Number.isFinite(ms)?ms:0;}
  function buildRecMap(att){
    const m=new Map();
    const put=(key,val)=>{const old=m.get(key);if(!old||recStamp(val.raw)>recStamp(old.raw)||(recStamp(val.raw)===recStamp(old.raw)&&N(val.raw?.id)>N(old.raw?.id)))m.set(key,val);};
    (att||[]).forEach(a=>{
      const d=S(a.attendance_date||a.date||a.created_at).slice(0,10); if(!d)return;
      const code=S(a.worker_employee_code||a.worker_code||a.employee_code||'');
      const name=S(a.worker_name||a.worker_identity||a.name||'');
      const st=statusCode(a.status||a.attendance_status||a.state);
      const val={status:st,notes:S(a.notes||''),raw:a};
      if(code) put('code:'+code+'|'+d,val);
      if(name) put('name:'+norm(name)+'|'+d,val);
    });
    return m;
  }
  function getRecord(rec,w,date){return (w.worker_employee_code&&rec.get('code:'+w.worker_employee_code+'|'+date))||rec.get('name:'+norm(w.worker_name)+'|'+date)||null;}
  function css(){
    if($('supUniV433Css'))return;
    const st=document.createElement('style'); st.id='supUniV433Css'; st.textContent=`
      #supervisorAttendanceList.sup-uni-v433{margin-top:12px;direction:rtl;text-align:right}
      .sup-uni-toolbar{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:10px;margin:10px 0;align-items:end}
      .sup-uni-toolbar label{font-weight:800;color:#064033}.sup-uni-toolbar select,.sup-uni-toolbar input{width:100%;height:42px;border:1px solid #d6e6df;border-radius:12px;padding:8px;background:#fff}
      .sup-uni-actions{display:flex!important;flex-direction:row!important;gap:8px;align-items:center;justify-content:flex-start;flex-wrap:wrap;margin:10px 0;clear:both}
      .sup-uni-actions button{width:auto!important;height:auto!important;min-width:120px!important;max-width:none!important;writing-mode:horizontal-tb!important;display:inline-flex!important;align-items:center;justify-content:center;padding:10px 14px;border-radius:12px;border:1px solid #cfe2da;background:#edf8f4;color:#064033;font-weight:900;cursor:pointer}
      .sup-uni-actions button.main{background:#07513f;color:#fff;border-color:#07513f}
      .sup-uni-msg{background:#eef8f4;border:1px solid #d6e9e0;border-radius:12px;padding:10px;margin:10px 0;color:#07513f;font-weight:900}
      .sup-uni-group{background:#eaf6f2;border:1px solid #d6e9e0;border-radius:14px;padding:12px;margin:14px 0 10px;color:#064033;font-weight:900}
      .sup-uni-workers{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;align-items:start}
      .sup-uni-worker{background:#fff;border:1px solid #dcebe4;border-radius:14px;padding:12px;box-shadow:0 1px 0 rgba(0,0,0,.02)}
      .sup-uni-worker b{display:block;color:#063d33;font-size:15px}.sup-uni-code{display:inline-block;margin-right:6px;color:#07513f;font-weight:900}.sup-uni-worker small{display:block;color:#66736f;margin:4px 0 8px}
      .sup-uni-worker select,.sup-uni-worker input{width:100%;height:40px;border:1px solid #d6e6df;border-radius:10px;margin-top:7px;padding:8px;background:#fff}.sup-uni-worker.absent{background:#fff4f4;border-color:#f0caca}
      @media(max-width:760px){.sup-uni-toolbar{grid-template-columns:1fr 1fr}.sup-uni-actions button{min-width:105px!important}.sup-uni-workers{grid-template-columns:1fr}}
    `; document.head.appendChild(st);
  }
  let state={};
  let loadSeqV435=0;
  async function load(date,force=false){
    const mySeq=++loadSeqV435;
    if(!window.sb) throw new Error('Supabase غير جاهز');
    const month=monthOf(date);
    if(typeof window.getUnifiedSupervisorWorkersV10713!=='function') throw new Error('مصدر عمال المشرف الموحد غير جاهز');
    // تحضير اليوم والدخول/الخروج يستخدمان نفس الدالة ونفس قائمة العمال حرفيًا.
    const [unified,att]=await Promise.all([
      window.getUnifiedSupervisorWorkersV10713(date,force),
      qAttendanceMonth(month)
    ]);
    if(mySeq!==loadSeqV435) return null;
    return {month,workers:unified?.workers||[],identity:unified?.identity||{},assignments:unified?.assignments||[],att};
  }
  function currentFilters(){return {date:($('supUniDate')?.value||$('attendanceDate')?.value||today()), project:S($('supUniProject')?.value), search:norm($('supUniSearch')?.value)};}
  function projectOptions(workers){
    const seen=new Map(); workers.forEach(w=>(w.projects||[]).forEach(p=>{const k=p.key||p.name; if(k&&!seen.has(k)) seen.set(k,p.name||p.key);}));
    return [...seen.entries()].map(([k,n])=>`<option value="${esc(k)}">${esc(n)}</option>`).join('');
  }
  function filteredWorkers(){
    const f=currentFilters();
    return (state.workers||[]).filter(w=>{
      const pOk=!f.project||(w.projects||[]).some(p=>S(p.key)===f.project||S(p.name)===f.project);
      const sOk=!f.search||norm(w.worker_name).includes(f.search)||norm(w.worker_employee_code).includes(f.search);
      return pOk&&sOk;
    });
  }
  function render(){
    css();
    const list=$('supervisorAttendanceList'); if(!list)return;
    const date=($('attendanceDate')?.value||today()); if($('attendanceDate')) $('attendanceDate').value=date;
    const rec=buildRecMap(state.att||[]);
    const workers=filteredWorkers();
    const pCur=S($('supUniProject')?.value);
    list.classList.add('sup-uni-v433');
    const projectOpts=projectOptions(state.workers||[]);
    list.innerHTML=`
      <div class="sup-uni-msg" id="supUniMsg">مصدر الأسماء: النظام الموحد → التوزيع. بدون تكرار للعامل.</div>
      <div class="sup-uni-toolbar">
        <label>التاريخ<input type="date" id="supUniDate" value="${esc(date)}"></label>
        <label>المشروع<select id="supUniProject"><option value="">كل المشاريع</option>${projectOpts}</select></label>
        <label>بحث العامل<input id="supUniSearch" placeholder="اسم العامل أو الكود"></label>
        <label>النسخة<input value="${BUILD}" disabled></label>
      </div>
      <div class="sup-uni-actions"><button id="supUniRefresh">تحديث الأسماء</button><button id="supUniAllP">اعتماد الكل حاضر</button><button id="supUniAllA">اعتماد الكل غائب</button><button class="main" id="supUniSave">حفظ تحضير اليوم</button></div>
      <div class="sup-uni-group">المشرف: ${esc((state.identity?.name)||(state.workers?.[0]?.supervisor_name)||getUser().full_name||getUser().name||getUser().username||'-')} <small>عدد العمال: ${(state.workers||[]).length}</small></div>
      <div class="sup-uni-workers" id="supUniWorkers">${workers.map(w=>{
        const r=getRecord(rec,w,date); const st=statusCode(r?.status||'present');
        const projects=(w.projects||[]).map(p=>p.name||p.key).filter(Boolean).join('، ');
        const label=esc(w.worker_name||'-')+(w.worker_employee_code?` <span class="sup-uni-code">${esc(w.worker_employee_code)}</span>`:'');
        return `<div class="sup-uni-worker ${st==='absent'?'absent':''}" data-code="${esc(w.worker_employee_code)}" data-name="${esc(w.worker_name)}"><b>${label}</b><small>${esc(projects||'-')}</small><select><option value="present" ${st!=='absent'?'selected':''}>حاضر</option><option value="absent" ${st==='absent'?'selected':''}>غائب</option></select><input placeholder="ملاحظات" value="${esc(r?.notes||'')}"></div>`;
      }).join('')||'<div class="sup-uni-worker">لا يوجد عمال من التوزيع لهذا المشرف في هذا الشهر</div>'}</div>
    `;
    if($('supUniProject')) $('supUniProject').value=pCur;
    $('supUniDate').onchange=()=>{ if($('attendanceDate')) $('attendanceDate').value=$('supUniDate').value; renderSupervisorUnified(true); };
    $('supUniProject').onchange=render;
    $('supUniSearch').oninput=render;
    $('supUniAllP').onclick=()=>document.querySelectorAll('#supUniWorkers select').forEach(s=>{s.value='present'; s.closest('.sup-uni-worker')?.classList.remove('absent');});
    $('supUniAllA').onclick=()=>document.querySelectorAll('#supUniWorkers select').forEach(s=>{s.value='absent'; s.closest('.sup-uni-worker')?.classList.add('absent');});
    $('supUniRefresh').onclick=()=>renderSupervisorUnified(true);
    $('supUniSave').onclick=saveSupervisorUnified;
    document.querySelectorAll('#supUniWorkers select').forEach(sel=>sel.onchange=()=>sel.closest('.sup-uni-worker')?.classList.toggle('absent',sel.value==='absent'));
  }
  async function renderSupervisorUnified(force){
    const list=$('supervisorAttendanceList'); if(!list)return;
    try{
      css();
      const date=($('attendanceDate')?.value||$('supUniDate')?.value||today());
      if(!state.loaded || force || state.month!==monthOf(date)){
        list.classList.add('sup-uni-v433'); list.innerHTML='<div class="sup-uni-msg">جار تحميل العمال من النظام الموحد...</div>';
        const data=await load(date,!!force); if(!data) return;
        state={loaded:true,month:data.month,dist:data.assignments||[],att:data.att,workers:data.workers||[],identity:data.identity||{}};
      }
      render();
      if(!(state.workers||[]).length) toast('لا يوجد عمال مربوطين بك في النظام الموحد لهذا الشهر. راجع التوزيع.',true);
      else toast('جاهز - تم تحميل '+state.workers.length+' عامل من التوزيع الموحد.');
    }catch(e){ if(list) list.innerHTML='<div class="sup-uni-msg">تعذر التحميل: '+esc(e.message||e)+'</div>'; }
  }
  async function saveSupervisorUnified(){
    const btn=$('supUniSave'); if(btn?.disabled) return;
    try{
      const date=($('supUniDate')?.value||$('attendanceDate')?.value||today());
      const cards=[...document.querySelectorAll('#supUniWorkers .sup-uni-worker[data-name]')];
      if(!cards.length) return toast('لا يوجد عمال للحفظ',true);
      if(btn){btn.disabled=true;btn.textContent='جاري الحفظ...';}
      const byKey=new Map((state.workers||[]).map(w=>[(w.worker_employee_code?('code:'+w.worker_employee_code):('name:'+norm(w.worker_name))),w]));
      const payload=cards.map(c=>{
        const code=S(c.dataset.code), name=S(c.dataset.name);
        const w=byKey.get(code?'code:'+code:'name:'+norm(name))||{};
        const ps=w.projects||[];
        return {
          worker_identity:name,
          worker_name:name,
          worker_employee_code:code,
          project_key:ps.map(p=>p.key).filter(Boolean).join(','),
          project_name:ps.map(p=>p.name||p.key).filter(Boolean).join('، '),
          supervisor_employee_code:w.supervisor_employee_code||'',
          supervisor_name:w.supervisor_name||getUser().full_name||getUser().name||getUser().username||'',
          status:c.querySelector('select')?.value||'present',
          notes:c.querySelector('input')?.value||''
        };
      });
      const r=await window.sb.rpc('tasneef_save_attendance_unified_v430',{p_date:date,p_records:payload});
      if(r.error) throw r.error;
      state.loaded=false; await renderSupervisorUnified(true);
      const rec=buildRecMap(state.att||[]); let verified=0;
      (state.workers||[]).forEach(w=>{if(getRecord(rec,w,date))verified++;});
      if(verified<cards.length) throw new Error('تم الحفظ لكن لم تظهر كل السجلات بعد التحقق ('+verified+' من '+cards.length+').');
      toast('تم حفظ والتحقق من '+verified+' سجل بتاريخ '+date+'.');
    }catch(e){ toast('فشل الحفظ: '+(e.message||e),true); }
    finally{if(btn){btn.disabled=false;btn.textContent='حفظ تحضير اليوم';}}
  }
  function bind(){
    window.renderSupervisorAttendanceList=()=>renderSupervisorUnified(true);
    window.saveSupervisorAttendance=saveSupervisorUnified;
    try{ renderSupervisorAttendanceList=window.renderSupervisorAttendanceList; saveSupervisorAttendance=window.saveSupervisorAttendance; }catch(_){}
  }
  bind(); [200,800,1600,2800,4500,7000,10000,15000].forEach(t=>setTimeout(bind,t)); setInterval(bind,3000);
  const oldShow=window.showSupervisorWindow;
  window.showSupervisorWindow=function(id,btn){const r=oldShow?oldShow.apply(this,arguments):undefined; if(id==='supAttendance') setTimeout(()=>renderSupervisorUnified(true),150); return r;};
  const oldInit=window.initSupervisor;
  window.initSupervisor=async function(){if(oldInit) await oldInit.apply(this,arguments); setTimeout(()=>renderSupervisorUnified(true),700);};
  document.addEventListener('DOMContentLoaded',()=>{bind(); setTimeout(()=>{if($('supervisorAttendanceList')) renderSupervisorUnified(true);},1000);});
  try{new MutationObserver(()=>{if($('supervisorAttendanceList')) { const txt=$('supervisorAttendanceList').textContent||''; if(!$('supervisorAttendanceList').classList.contains('sup-uni-v433') || txt.includes('اختر المشروع') || txt.includes('الفترة')) setTimeout(()=>renderSupervisorUnified(true),80); }}).observe(document.body,{childList:true,subtree:true});}catch(_){}
  console.log('Tasneef supervisor attendance from unified distribution loaded '+BUILD);
})();

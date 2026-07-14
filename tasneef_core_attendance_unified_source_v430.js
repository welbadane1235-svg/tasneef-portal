(function(){
  'use strict';
  const BUILD='V444 ثابت - حفظ وتحميل الحضور بدون اختفاء';
  const S=v=>String(v??'').trim();
  const N=v=>Number(v)||0;
  const $=id=>document.getElementById(id);
  const esc=s=>S(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>S(s).toLowerCase().replace(/[إأآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
  const today=()=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}catch(_){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}};
  const monthNow=()=>today().slice(0,7);
  const daysOfMonth=m=>{const y=N(m.slice(0,4)),mo=N(m.slice(5,7));return Array.from({length:new Date(y,mo,0).getDate()||31},(_,i)=>String(i+1).padStart(2,'0'));};
  const dateKey=v=>{const x=S(v); if(/^\d{4}-\d{2}-\d{2}/.test(x)) return x.slice(0,10); return x.slice(0,10);};
  const statusCode=v=>{const x=norm(v); if(['absent','غائب','غياب','غ','a'].includes(x))return 'absent'; if(['leave','اجازه','إجازه','اجازة','إجازة'].includes(x))return 'leave'; if(['sick','مرضي','مرضى'].includes(x))return 'sick'; if(['mission','ماموريه','مأمورية'].includes(x))return 'mission'; if(['weekly_off','راحه اسبوعيه','راحة أسبوعية'].includes(x))return 'weekly_off'; if(['late','متاخر','متأخر'].includes(x))return 'late'; if(['early_leave','خروج مبكر'].includes(x))return 'early_leave'; if(['present','حاضر','حضور','ح','p'].includes(x))return 'present'; return x||'';};
  const stLabel=s=>({present:'حاضر',absent:'غائب',leave:'إجازة',sick:'مرضي',mission:'مأمورية',weekly_off:'راحة أسبوعية',late:'متأخر',early_leave:'خروج مبكر'}[statusCode(s)]||S(s)||'حاضر');
  function nameVariants(v){
    const raw=S(v); if(!raw) return [];
    const out=[]; const add=x=>{x=S(x); if(x) out.push(x);};
    add(raw);
    add(raw.replace(/^TS-?\d+\s*[-–—:|]?\s*/i,''));
    add(raw.replace(/\(.*?\)/g,' ').replace(/\s+/g,' ').trim());
    const par=[...raw.matchAll(/[\(（]+([^\)）]+)[\)）]+/g)].map(m=>m[1]);
    par.forEach(add);
    raw.split(/[\/|،,\-–—]+/).forEach(add);
    return [...new Set(out.map(x=>S(x)).filter(Boolean))];
  }
  const client=()=>window.sb||window.supabaseClient||null;
  async function safe(label,p){try{const r=await p; if(r?.error){console.warn(label,r.error);return {data:[],error:r.error};} return r;}catch(e){console.warn(label,e);return {data:[],error:e};}}
  function msg(t,bad){const e=$('cu427Msg')||$('cu413Msg'); if(e){e.textContent=t;e.classList.toggle('err',!!bad);} try{if(window.msg) window.msg(t,bad?'err':'ok');}catch(_){}}
  function css(){if($('cu427Css'))return; const st=document.createElement('style'); st.id='cu427Css'; st.textContent=`
    #cu413AttendanceTab .cu427-card{background:#fff;border:1px solid #dce6e2;border-radius:22px;padding:18px;margin:12px 0;direction:rtl}
    #cu413AttendanceTab .cu427-head{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}
    #cu413AttendanceTab .cu427-head h2{color:#07513f;margin:0;font-size:22px}
    #cu413AttendanceTab .cu427-msg{background:#eef8f4;border:1px solid #d3e9df;border-radius:12px;padding:10px;margin:10px 0;color:#07513f;font-weight:800}
    #cu413AttendanceTab .cu427-msg.err{background:#fdeaea;color:#9d2222;border-color:#efc3c3}
    #cu413AttendanceTab .cu427-controls{display:grid;grid-template-columns:repeat(5,minmax(140px,1fr));gap:10px;margin:12px 0}
    #cu413AttendanceTab .cu427-controls label{font-size:12px;color:#07513f;font-weight:900}
    #cu413AttendanceTab .cu427-controls input,#cu413AttendanceTab .cu427-controls select{width:100%;border:1px solid #dce6e2;border-radius:12px;padding:10px;background:#fff}
    #cu413AttendanceTab .cu427-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;align-items:center}
    #cu413AttendanceTab .cu427-actions button{border:0;border-radius:12px;background:#07513f;color:#fff;padding:10px 14px;font-weight:900;cursor:pointer}
    #cu413AttendanceTab .cu427-actions button.light{background:#eef8f4;color:#07513f;border:1px solid #d3e9df}
    #cu413AttendanceTab .cu427-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:10px 0}
    #cu413AttendanceTab .cu427-kpis div{border:1px solid #dce6e2;border-radius:14px;padding:12px;text-align:center;background:#fff}
    #cu413AttendanceTab .cu427-kpis b{display:block;font-size:26px;color:#07513f}
    #cu413AttendanceTab .cu427-workers{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;align-items:start;width:100%}
    #cu413AttendanceTab .cu427-worker{border:1px solid #dce9e3;border-radius:14px;background:#fbfefc;padding:10px;min-height:108px;box-sizing:border-box}
    #cu413AttendanceTab .cu427-worker b{display:block;color:#063d33;font-size:15px}
    #cu413AttendanceTab .cu427-worker small{display:block;color:#60706a;margin:4px 0;line-height:1.5;min-height:34px}
    #cu413AttendanceTab .cu427-worker select,#cu413AttendanceTab .cu427-worker input{width:100%;margin-top:6px;border:1px solid #dce6e2;border-radius:10px;padding:8px;background:#fff}
    #cu413AttendanceTab .cu427-worker.absent{background:#fff1f1;border-color:#efb4b4}
    #cu413AttendanceTab .cu427-super{grid-column:1/-1;background:#e9f5f1!important;color:#063d33;font-weight:900;min-height:auto;display:flex;justify-content:space-between;gap:10px;border-radius:14px}
    #cu413AttendanceTab .cu427-table-wrap{max-height:62vh;overflow:auto;border:1px solid #dce9e3;border-radius:14px;margin-top:10px;background:#fff}
    #cu413AttendanceTab .cu427-table{width:100%;border-collapse:collapse;background:#fff;direction:rtl}
    #cu413AttendanceTab .cu427-table th{background:#07513f;color:#fff;position:sticky;top:0;z-index:3}
    #cu413AttendanceTab .cu427-table th,#cu413AttendanceTab .cu427-table td{border:1px solid #dce9e3;padding:7px;text-align:center;white-space:nowrap}
    #cu413AttendanceTab .cu427-table th:first-child,#cu413AttendanceTab .cu427-table td:first-child{position:sticky;right:0;background:#fff;text-align:right;font-weight:900;z-index:2;min-width:170px}
    #cu413AttendanceTab .cu427-table th:first-child{background:#07513f;color:#fff;z-index:4}
    #cu413AttendanceTab .cu427-p{background:#e8f4ee;color:#08784d;font-weight:900}
    #cu413AttendanceTab .cu427-a{background:#fdeaea;color:#a22;font-weight:900}
    #cu413AttendanceTab .cu427-o{background:#fff7de;color:#7a5700;font-weight:900}
    #cu413AttendanceTab .cu427-e{color:#8a9993}
    @media(max-width:900px){#cu413AttendanceTab .cu427-controls{grid-template-columns:1fr 1fr}#cu413AttendanceTab .cu427-kpis{grid-template-columns:repeat(2,1fr)}}
    @media print{#cu413AttendanceTab .cu427-controls,#cu413AttendanceTab .cu427-actions,#cu413AttendanceTab .cu427-msg,#cu413AttendanceTab .cu427-workers{display:none!important}#cu413AttendanceTab .cu427-table-wrap{max-height:none;overflow:visible}}
  `; document.head.appendChild(st);}
  let state={dist:[],att:[],workers:[],month:''};
  const distCode=r=>S(r.worker_employee_code||r.worker_code||r.employee_code||r.worker_id||'');
  const distName=r=>S(r.worker_name||r.worker_display_name||r.app_name||r.name||distCode(r));
  const distProjectId=r=>S(r.project_id||'');
  const distProject=r=>S(r.project_name||r.project||r.project_title||distProjectId(r)||'-');
  const distSupCode=r=>S(r.supervisor_employee_code||r.supervisor_code||r.supervisor_id||'');
  const distSupName=r=>S(r.supervisor_name||r.supervisor_full_name||distSupCode(r)||'بدون مشرف');
  function workerUniqKey(r){return distCode(r) ? 'code:'+norm(distCode(r)) : 'name:'+norm(distName(r));}
  function mergeDistribution(rows){
    const m=new Map();
    (rows||[]).forEach(r=>{
      if(!distName(r) && !distCode(r))return;
      if(['ended','inactive','deleted','منتهي','موقوف','محذوف'].includes(norm(r.status)))return;
      const k=workerUniqKey(r); if(!k.endsWith(':')){
        if(!m.has(k)) m.set(k,Object.assign({},r,{__projects:[],__projectIds:[],__raw:[r]}));
        const o=m.get(k);
        const pn=distProject(r), pid=distProjectId(r);
        if(pid && !o.__projectIds.includes(pid)) o.__projectIds.push(pid);
        if(pn && pn!=='-' && !o.__projects.includes(pn)) o.__projects.push(pn);
        if(!distSupCode(o) && distSupCode(r)) {o.supervisor_employee_code=distSupCode(r); o.supervisor_name=distSupName(r);}
        if(!o.project_id && pid) o.project_id=pid;
        if(!o.project_name && pn) o.project_name=pn;
        o.__raw.push(r);
      }
    });
    return [...m.values()].sort((a,b)=>distSupName(a).localeCompare(distSupName(b),'ar')||distName(a).localeCompare(distName(b),'ar'));
  }

  function isInactiveValue(v){const x=norm(v);return ['deleted','inactive','stopped','stop','محذوف','موقوف','غير نشط','غيرنشط','منتهي','ended'].includes(x) || v===false || v==='false';}
  function recordInactive(o){if(!o)return false; return isInactiveValue(o.status)||isInactiveValue(o.state)||isInactiveValue(o.active)||isInactiveValue(o.is_active)||isInactiveValue(o.enabled);}
  function codeOf(o){return S(o.employee_code||o.worker_employee_code||o.worker_code||o.code||o.id_code||'');}
  function nameOf(o){return S(o.app_name||o.name||o.full_name||o.employee_name||o.worker_name||o.worker_identity||o.username||'');}
  function findRef(list, code, name){code=norm(code);name=norm(name);return (list||[]).find(x=>{const xc=norm(codeOf(x)); const xn=norm(nameOf(x)); return (code&&xc&&code===xc)||(name&&xn&&name===xn);});}
  function distributionRowActive(r, workers, projects, users){
    if(isInactiveValue(r.status)||isInactiveValue(r.state)) return false;
    const w=findRef(workers, distCode(r), distName(r)); if(w && recordInactive(w)) return false;
    const p=(projects||[]).find(x=>S(x.id)===distProjectId(r) || norm(x.name||x.project_name||x.title)===norm(distProject(r))); if(p && recordInactive(p)) return false;
    const sup=findRef(workers, distSupCode(r), distSupName(r)); if(sup && recordInactive(sup)) return false;
    const u=(users||[]).find(x=>norm(x.full_name||x.name||x.username)===norm(distSupName(r)) || S(x.id)===distSupCode(r)); if(u && recordInactive(u)) return false;
    return true;
  }

  function workerNameFromOldId(id){
    const w=(state.workers||[]).find(x=>S(x.id)===S(id));
    return S(w?.name||w?.full_name||w?.worker_name||w?.worker_identity||w?.app_name||'');
  }
  function workerCodeFromOldId(id){
    const w=(state.workers||[]).find(x=>S(x.id)===S(id));
    return S(w?.employee_code||w?.worker_employee_code||w?.code||w?.id_code||'');
  }
  function attAliases(a){
    const out=[];
    const add=(prefix,val)=>{val=S(val); if(val) out.push(prefix+':'+norm(val));};
    add('code',a.worker_employee_code||a.worker_code||a.employee_code||a.code);
    [a.worker_identity,a.worker_name,a.name,a.app_name,a.employee_name].forEach(v=>nameVariants(v).forEach(n=>add('name',n)));
    if(a.worker_id){
      add('code',workerCodeFromOldId(a.worker_id));
      nameVariants(workerNameFromOldId(a.worker_id)).forEach(n=>add('name',n));
      add('oldid',a.worker_id);
    }
    return [...new Set(out.filter(x=>!x.endsWith(':')))].filter(x=>x!==':');
  }
  function rowAliases(r){
    const out=[]; const add=(prefix,val)=>{val=S(val); if(val) out.push(prefix+':'+norm(val));};
    add('code',distCode(r));
    nameVariants(distName(r)).forEach(n=>add('name',n));
    // أسماء العامل في التوزيع قد تكون "TS-01 - الاسم" أو فيها اسم بديل بين أقواس.
    return [...new Set(out.filter(x=>!x.endsWith(':')))].filter(x=>x!==':');
  }
  function recStamp(a){
    const raw=S(a?.updated_at||a?.created_at||a?.attendance_date||a?.date||'');
    const ms=Date.parse(raw); return Number.isFinite(ms)?ms:0;
  }
  function putBest(m,k,a){
    const old=m.get(k);
    // آخر تعديل هو المصدر الصحيح دائمًا؛ لا نعطي الغياب أولوية دائمة حتى لا يختفي تصحيح الحضور.
    if(!old || recStamp(a)>recStamp(old) || (recStamp(a)===recStamp(old) && N(a?.id)>N(old?.id))) m.set(k,a);
  }
  function buildAttMap(){
    const m=new Map();
    (state.att||[]).forEach(a=>{
      const d=dateKey(a.attendance_date||a.date||a.created_at); if(!d)return;
      attAliases(a).forEach(alias=>putBest(m,alias+'|'+d,a));
    });
    return m;
  }
  function getRowRec(amap,r,date){
    for(const a of rowAliases(r)){const rec=amap.get(a+'|'+date); if(rec)return rec;}
    return null;
  }
  function rowAttKey(r,date){return rowAliases(r)[0]+'|'+date;}
  const numericId=v=>/^\d+$/.test(S(v))?S(v):null;
  function filters(){return {date:$('cu427Date')?.value||today(), month:($('cu427Month')?.value||monthNow()).slice(0,7), sup:$('cu427Sup')?.value||'', project:$('cu427Project')?.value||'', search:norm($('cu427Search')?.value||'')};}
  let loadSeqV444=0;
  async function fetchAttendanceMonthV444(c,month){
    const from=month+'-01'; const [y,mo]=month.split('-').map(Number);
    const next=new Date(y,mo,1); const to=next.getFullYear()+'-'+String(next.getMonth()+1).padStart(2,'0')+'-'+String(next.getDate()).padStart(2,'0');
    const all=[]; let start=0; const size=1000;
    while(start<100000){
      const r=await c.from('attendance').select('*').gte('attendance_date',from).lt('attendance_date',to).order('attendance_date',{ascending:true}).range(start,start+size-1);
      if(r.error) throw r.error;
      const rows=r.data||[]; all.push(...rows); if(rows.length<size) break; start+=size;
    }
    return all;
  }
  async function load(month,force){
    const c=client(); if(!c){msg('Supabase غير جاهز',true);return false;}
    if(!force && state.month===month)return true;
    const mySeq=++loadSeqV444;
    const [dr,ar,wr,er,pr,ur]=await Promise.all([
      safe('monthly_distribution unified', c.from('monthly_distribution').select('*').eq('month_key',month).limit(50000)),
      (async()=>{try{return {data:await fetchAttendanceMonthV444(c,month),error:null};}catch(e){return {data:[],error:e};}})(),
      safe('workers legacy', c.from('workers').select('*').limit(50000)),
      safe('employees master', c.from('employees_master_v386').select('*').limit(50000)),
      safe('projects active filter', c.from('projects').select('*').limit(50000)),
      safe('app users active filter', c.from('app_users').select('*').limit(50000))
    ]);
    if(mySeq!==loadSeqV444) return false; // تجاهل أي طلب قديم وصل بعد طلب أحدث.
    if(ar.error) throw ar.error;
    const emps=(er.data||[]).map(x=>Object.assign({},x,{name:S(x.app_name||x.name||x.full_name||x.employee_name),employee_code:S(x.employee_code||x.worker_employee_code||x.code)}));
    const allWorkers=[...(wr.data||[]),...emps];
    const activeDist=(dr.data||[]).filter(r=>distributionRowActive(r, allWorkers, pr.data||[], ur.data||[]));
    state={dist:mergeDistribution(activeDist),att:ar.data||[],workers:allWorkers,month,loadedAt:Date.now()};
    return true;
  }
  function nextMonth(m){const y=N(m.slice(0,4)),mo=N(m.slice(5,7));const d=new Date(y,mo,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
  function currentRows(){const f=filters(); return state.dist.filter(r=>(!f.sup||distSupCode(r)===f.sup||distSupName(r)===f.sup)&&(!f.project||((r.__projectIds||[]).includes(f.project)||distProjectId(r)===f.project))&&(!f.search||norm(distName(r)).includes(f.search)||norm(distCode(r)).includes(f.search)||norm((r.__projects||[]).join(' ')).includes(f.search)));}
  function fillSelects(){
    const f=filters(); const sup=$('cu427Sup'), pr=$('cu427Project');
    const sups=[...new Map(state.dist.map(r=>[distSupCode(r)||distSupName(r),distSupName(r)]).filter(x=>x[0])).entries()];
    const pmap=new Map(); state.dist.forEach(r=>(r.__projectIds||[]).forEach((pid,i)=>{if(pid&&!pmap.has(pid))pmap.set(pid,(r.__projects||[])[i]||distProject(r));}));
    if(sup){sup.innerHTML='<option value="">كل المشرفين</option>'+sups.map(([v,n])=>`<option value="${esc(v)}">${esc(n)}</option>`).join(''); sup.value=sups.some(x=>x[0]===f.sup)?f.sup:'';}
    if(pr){pr.innerHTML='<option value="">كل المشاريع</option>'+[...pmap.entries()].map(([v,n])=>`<option value="${esc(v)}">${esc(n)}</option>`).join(''); pr.value=pmap.has(f.project)?f.project:'';}
  }
  function render(){
    fillSelects(); const f=filters(); const rows=currentRows(); const amap=buildAttMap();
    let p=0,a=0,o=0; rows.forEach(r=>{const rec=getRowRec(amap,r,f.date); const st=statusCode(rec?.status||''); if(st==='present')p++; else if(st==='absent')a++; else if(st)o++;});
    $('cu427Kpis').innerHTML=`<div><small>الموزعين بدون تكرار</small><b>${rows.length}</b></div><div><small>حاضر</small><b>${p}</b></div><div><small>غائب</small><b>${a}</b></div><div><small>إجازات/أخرى</small><b>${o}</b></div>`;
    const groups=new Map(); rows.forEach(r=>{const k=distSupCode(r)||distSupName(r)||'بدون مشرف'; if(!groups.has(k))groups.set(k,{name:distSupName(r),items:[]}); groups.get(k).items.push(r);});
    $('cu427Workers').innerHTML=[...groups.values()].map(g=>`<div class="cu427-worker cu427-super"><span>المشرف: ${esc(g.name)}</span><span>عدد العمال: ${g.items.length}</span></div>`+g.items.map(r=>{
      const rec=getRowRec(amap,r,f.date); const st=statusCode(rec?.status||'present'); const projects=(r.__projects&&r.__projects.length?r.__projects.join('، '):distProject(r));
      return `<div class="cu427-worker ${st==='absent'?'absent':''}" data-wkey="${esc(workerUniqKey(r))}"><b>${esc(distName(r))}</b><small>${esc(distCode(r))}${distCode(r)?' | ':''}${esc(projects)}</small><select><option value="present" ${st==='present'?'selected':''}>حاضر</option><option value="absent" ${st==='absent'?'selected':''}>غائب</option><option value="leave" ${st==='leave'?'selected':''}>إجازة</option><option value="sick" ${st==='sick'?'selected':''}>مرضي</option><option value="mission" ${st==='mission'?'selected':''}>مأمورية</option><option value="weekly_off" ${st==='weekly_off'?'selected':''}>راحة أسبوعية</option><option value="late" ${st==='late'?'selected':''}>متأخر</option><option value="early_leave" ${st==='early_leave'?'selected':''}>خروج مبكر</option></select><input placeholder="ملاحظات" value="${esc(rec?.notes||'')}"></div>`;
    }).join('')).join('') || '<div class="cu427-worker">لا يوجد عمال في التوزيع لهذا الشهر.</div>';
    renderTable(rows,amap,f.month);
  }
  function renderTable(rows,amap,month){
    const days=daysOfMonth(month); const head=$('cu427Head'), body=$('cu427Body'); if(!head||!body)return;
    head.innerHTML='<tr><th>العامل</th>'+days.map(d=>`<th>${d}</th>`).join('')+'<th>حضور</th><th>غياب</th></tr>';
    const groups=new Map(); rows.forEach(r=>{const k=distSupCode(r)||distSupName(r)||'بدون مشرف'; if(!groups.has(k))groups.set(k,{name:distSupName(r),items:[]}); groups.get(k).items.push(r);});
    body.innerHTML=[...groups.values()].map(g=>`<tr><td colspan="${days.length+3}" class="cu427-super">المشرف: ${esc(g.name)} - عدد العمال: ${g.items.length}</td></tr>`+g.items.map(r=>{
      let p=0,a=0; const cells=days.map(day=>{const rec=getRowRec(amap,r,month+'-'+day); const st=statusCode(rec?.status||''); if(st==='present'){p++;return '<td class="cu427-p">ح</td>';} if(st==='absent'){a++;return '<td class="cu427-a">غ</td>';} if(st){return `<td class="cu427-o">${esc(stLabel(st).slice(0,1))}</td>`;} return '<td class="cu427-e">-</td>';}).join('');
      return `<tr><td>${esc(distName(r))}</td>${cells}<td>${p}</td><td>${a}</td></tr>`;
    }).join('')).join('');
  }
  function shell(){
    css(); const tab=$('cu413AttendanceTab'); if(!tab)return; if($('cu427Root'))return;
    tab.innerHTML=`<div class="cu427-card" id="cu427Root"><div class="cu427-head"><h2>الحضور والغياب</h2><b>${BUILD}</b></div><div id="cu427Msg" class="cu427-msg">تم اعتماد هذه النسخة: كشف الحضور من السجلات القديمة والجديدة، والعمال/المشرفون من النظام الموحد → التوزيع، بدون تكرار.</div><div class="cu427-controls"><label>التاريخ<input type="date" id="cu427Date" value="${today()}"></label><label>الشهر<input type="month" id="cu427Month" value="${monthNow()}"></label><label>المشرف<select id="cu427Sup"><option value="">كل المشرفين</option></select></label><label>المشروع<select id="cu427Project"><option value="">كل المشاريع</option></select></label><label>بحث<input id="cu427Search" placeholder="اسم العامل أو الكود أو المشروع"></label></div><div class="cu427-actions"><button id="cu427Refresh">تحديث مباشر</button><button id="cu427AllP" class="light">اعتماد الكل حاضر</button><button id="cu427AllA" class="light">اعتماد الكل غائب</button><button id="cu427Save">حفظ التحضير</button><button id="cu427Print" class="light">طباعة</button><button id="cu427Csv" class="light">تصدير CSV</button></div><div id="cu427Kpis" class="cu427-kpis"></div><h3>تحضير اليوم</h3><div id="cu427Workers" class="cu427-workers"></div><h3>كشف الشهر</h3><div class="cu427-table-wrap"><table class="cu427-table"><thead id="cu427Head"></thead><tbody id="cu427Body"></tbody></table></div></div>`;
    $('cu427Date').addEventListener('change',()=>{const d=$('cu427Date').value;if(d)$('cu427Month').value=d.slice(0,7);refresh(true);});
    $('cu427Month').addEventListener('change',()=>refresh(true));
    ['cu427Sup','cu427Project'].forEach(id=>$(id).addEventListener('change',render));
    $('cu427Search').addEventListener('input',render);
    $('cu427Refresh').onclick=()=>refresh(true);
    $('cu427AllP').onclick=()=>{document.querySelectorAll('#cu427Workers .cu427-worker[data-wkey] select').forEach(s=>s.value='present');};
    $('cu427AllA').onclick=()=>{document.querySelectorAll('#cu427Workers .cu427-worker[data-wkey] select').forEach(s=>s.value='absent');};
    $('cu427Print').onclick=()=>window.print(); $('cu427Csv').onclick=exportCsv; $('cu427Save').onclick=save;
  }
  async function refresh(force){shell(); const f=filters(); msg('جاري تحميل التوزيع والحضور...'); await load(f.month,force); render(); msg('تم التحميل: '+state.dist.length+' عامل بدون تكرار من التوزيع الحالي.');}
  async function save(){
    const btn=$('cu427Save'); if(btn?.disabled) return;
    try{const c=client(); if(!c)return msg('Supabase غير جاهز',true); const f=filters(); const rows=currentRows(); if(!rows.length)return msg('لا يوجد عمال للحفظ.',true);
      if(btn){btn.disabled=true;btn.textContent='جاري الحفظ...';}
      const card=new Map([...document.querySelectorAll('#cu427Workers .cu427-worker[data-wkey]')].map(el=>[el.dataset.wkey,el]));
      const payload=rows.map(r=>{const el=card.get(workerUniqKey(r)); if(!el)return null; return {worker_identity:distName(r),worker_name:distName(r),worker_employee_code:distCode(r),worker_code:distCode(r),project_key:distProjectId(r)||((r.__projectIds||[])[0]||''),project_name:(r.__projects||[])[0]||distProject(r),supervisor_employee_code:distSupCode(r),supervisor_name:distSupName(r),status:S(el.querySelector('select')?.value||'present'),notes:S(el.querySelector('input')?.value||'')};}).filter(Boolean);
      const rpc=await c.rpc('tasneef_save_attendance_unified_v430',{p_date:f.date,p_records:payload});
      if(rpc.error) throw rpc.error;
      await load(f.month,true);
      const amap=buildAttMap(); let verified=0;
      rows.forEach(r=>{ if(getRowRec(amap,r,f.date)) verified++; });
      render();
      if(verified<payload.length) throw new Error('تم الحفظ لكن لم تُقرأ كل السجلات بعد التحقق ('+verified+' من '+payload.length+'). اضغط تحديث مباشر مرة واحدة.');
      msg('تم حفظ والتحقق من '+verified+' سجل بتاريخ '+f.date+'.');
    }catch(e){msg('فشل الحفظ: '+(e.message||e),true);}
    finally{if(btn){btn.disabled=false;btn.textContent='حفظ التحضير';}}
  }
  function exportCsv(){const rows=[];document.querySelectorAll('#cu427Body tr').forEach(tr=>rows.push([...tr.children].map(td=>td.textContent.trim())));const csv=rows.map(r=>r.map(x=>'"'+S(x).replace(/"/g,'""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='attendance_old_style_'+(filters().month||monthNow())+'.csv';a.click();}
  function visible(){const tab=$('cu413AttendanceTab');return !!tab&&!tab.classList.contains('hidden')&&getComputedStyle(tab).display!=='none';}
  function activate(){if(!visible())return; if(!$('cu427Root'))shell(); refresh(false);}
  document.addEventListener('click',e=>{if(e.target.closest('#coreUnified [data-tab="attendance"]'))setTimeout(activate,100);});
  document.addEventListener('DOMContentLoaded',()=>setTimeout(activate,1500));
  try{new MutationObserver(()=>{if(visible()&&!$('cu427Root'))setTimeout(activate,80);}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});}catch(_){ }
  window.tasneefCoreAttendanceV430={refresh,save,activate};
  console.log('Tasneef core attendance V430 loaded');
})();

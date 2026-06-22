/* ===== TASNEEF V10207 ATTENDANCE UNIQUE NAME CANONICAL WORKER_ID =====
   حل جذري للحضور والغياب:
   - كل اسم عامل يظهر مرة واحدة فقط في الشاشة والطباعة والتصدير.
   - يتم توحيد نفس الاسم داخليًا على ID ثابت بدون إظهار الرقم.
   - لا يظهر #ID نهائيًا للمستخدم.
   - كشف الشهر والطباعة والتصدير CSV/Excel من نفس مصدر بيانات الشاشة.
   - كشف الشهر مجمع حسب المشرف الحالي، وتحت كل مشرف عماله.
*/
(function(){
  'use strict';
  if(window.__tasneefAttendanceUniqueNameV10207) return;
  window.__tasneefAttendanceUniqueNameV10207 = true;

  const BUILD='V10207';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const N=v=>Number(v)||0;
  const esc=s=>S(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>S(s).toLowerCase().replace(/[إأآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();

  const st={workers:[],projects:[],users:[],attendance:[],loadedMonth:'',loaded:false};

  function today(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function monthNow(){ return today().slice(0,7); }
  function monthRange(m){ const y=N(m.slice(0,4)), mo=N(m.slice(5,7)); const from=`${y}-${String(mo).padStart(2,'0')}-01`; const toD=new Date(y,mo,1); const to=toD.getFullYear()+'-'+String(toD.getMonth()+1).padStart(2,'0')+'-'+String(toD.getDate()).padStart(2,'0'); return {from,to}; }
  function daysOfMonth(m){ const y=N(m.slice(0,4)), mo=N(m.slice(5,7)); const last=new Date(y,mo,0).getDate()||31; return Array.from({length:last},(_,i)=>String(i+1).padStart(2,'0')); }
  async function safe(q){ try{ const r=await q; if(r.error){ console.warn('attendance '+BUILD,r.error.message); return []; } return r.data||[]; }catch(e){ console.warn('attendance '+BUILD,e); return []; } }
  function id(v){ return S(v); }
  function recordDate(a){ return S(a.attendance_date||a.date).slice(0,10); }

  function projectById(pid){ return (st.projects||[]).find(p=>id(p.id)===id(pid))||{}; }
  function projectName(pid){ const p=projectById(pid); return S(p.name||p.project_name||p.title||pid||'-')||'-'; }
  function userById(uid){ return (st.users||[]).find(u=>id(u.id)===id(uid))||{}; }
  function userName(uid){ const u=userById(uid); return S(u.full_name||u.name||u.username||uid||'-')||'-'; }
  function workerBaseName(w){ return S(w.__display_name||w.name||w.full_name||w.worker_name||w.worker_identity||w.id||'-')||'-'; }
  function workerLabel(w){ return workerBaseName(w); }
  function workerInternalId(w){ return id(w.__display_id || w.id || ''); }
  function workerIds(w){ return Array.isArray(w.__worker_ids) && w.__worker_ids.length ? w.__worker_ids.map(id) : [id(w.id)].filter(Boolean); }
  function workerProjectId(w){ return w.project_id || w.assigned_project_id || w.current_project_id || ''; }
  function workerSupervisorId(w){ const p=projectById(workerProjectId(w)); return w.supervisor_id || w.app_supervisor_id || p.supervisor_id || ''; }
  function workerStatus(w){ return norm(w.status||w.state||'active'); }
  function isWorkerActive(w){ const s=workerStatus(w); return s!=='deleted' && s!=='inactive' && s!=='محذوف' && s!=='موقوف'; }
  function workerById(wid){ return uniqueWorkers().find(w=>workerInternalId(w)===id(wid)) || (st.workers||[]).find(w=>id(w.id)===id(wid)); }

  function uniqueWorkers(){
    const map=new Map();
    const rows=(st.workers||[]).filter(w=>w && w.id && isWorkerActive(w)).slice().sort((a,b)=>{
      const na=workerBaseName(a).localeCompare(workerBaseName(b),'ar');
      if(na) return na;
      return N(a.id)-N(b.id);
    });
    rows.forEach(w=>{
      const name=workerBaseName(w);
      const k=norm(name);
      if(!k) return;
      if(!map.has(k)){
        const clone=Object.assign({}, w);
        clone.__display_name=name;
        clone.__display_id=id(w.id);        // ID ثابت داخلي، لا يظهر للمستخدم
        clone.__worker_ids=[id(w.id)];      // كل IDs التي تحمل نفس الاسم للدمج في العرض
        clone.__all_workers=[w];
        map.set(k, clone);
      }else{
        const ex=map.get(k);
        if(!ex.__worker_ids.includes(id(w.id))) ex.__worker_ids.push(id(w.id));
        ex.__all_workers.push(w);
      }
    });
    return [...map.values()].sort((a,b)=>{
      const sa=userName(workerSupervisorId(a)).localeCompare(userName(workerSupervisorId(b)),'ar');
      if(sa) return sa;
      return workerLabel(a).localeCompare(workerLabel(b),'ar');
    });
  }

  function getWorkerRecord(w,date,recMap){
    const ids=workerIds(w);
    let present=null;
    for(const wid of ids){
      const r=recMap.get(id(wid)+'|'+date);
      if(!r) continue;
      if(r.status==='absent') return r; // الغياب يغلب عند دمج نفس الاسم
      if(r.status==='present') present=r;
    }
    return present;
  }

  function groupWorkers(workers){
    const map=new Map();
    workers.forEach(w=>{
      const sid=id(workerSupervisorId(w)) || 'none';
      if(!map.has(sid)) map.set(sid,{sid,name:sid==='none'?'-':userName(sid),workers:[]});
      map.get(sid).workers.push(w);
    });
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  }

  async function load(month, force){
    if(!window.sb) throw new Error('لا يوجد اتصال Supabase');
    if(st.loaded && st.loadedMonth===month && !force) return;
    const r=monthRange(month);
    const [workers,projects,users,attendance]=await Promise.all([
      safe(sb.from('workers').select('*').limit(5000)),
      safe(sb.from('projects').select('*').limit(5000)),
      safe(sb.from('app_users').select('*').limit(1000)),
      safe(sb.from('attendance').select('*').gte('attendance_date',r.from).lt('attendance_date',r.to).limit(20000))
    ]);
    st.workers=workers||[]; st.projects=projects||[]; st.users=users||[]; st.attendance=attendance||[];
    st.loadedMonth=month; st.loaded=true;
  }

  function buildRecordMap(){
    const m=new Map();
    (st.attendance||[]).forEach(a=>{
      const wid=id(a.worker_id||'');
      const d=recordDate(a);
      if(!wid || !d) return;
      const key=wid+'|'+d;
      const old=m.get(key);
      // لو حصل تكرار بالخطأ لنفس worker_id واليوم: الغياب يغلب، ثم آخر سجل معروف.
      if(!old || a.status==='absent' || (old.status!=='absent' && a.id>old.id)) m.set(key,a);
    });
    return m;
  }

  function filteredWorkers(){
    const sid=$('attRbSupervisor')?.value||'';
    const q=norm($('attRbSearch')?.value||'');
    let rows=uniqueWorkers();
    if(sid) rows=rows.filter(w=>id(workerSupervisorId(w))===id(sid));
    if(q){
      rows=rows.filter(w=>norm([workerLabel(w),workerBaseName(w),projectName(workerProjectId(w)),userName(workerSupervisorId(w)),w.id].join(' ')).includes(q));
    }
    return rows;
  }

  function fillFilters(){
    const sel=$('attRbSupervisor'); if(!sel) return;
    const cur=sel.value||'';
    const ids=[...new Set(uniqueWorkers().map(w=>id(workerSupervisorId(w))).filter(Boolean))];
    sel.innerHTML='<option value="">كل المشرفين</option>'+ids.map(x=>`<option value="${esc(x)}">${esc(userName(x))}</option>`).join('');
    sel.value=cur;
  }

  function statusClass(s){ return s==='present'?'att-present':s==='absent'?'att-absent':'att-empty'; }
  function statusSymbol(s){ return s==='present'?'ح':s==='absent'?'غ':'-'; }
  function statusLabel(s){ return s==='present'?'حاضر':s==='absent'?'غائب':'غير مسجل'; }

  function ensureCss(){
    if($('attRbCss10207')) return;
    const css=document.createElement('style'); css.id='attRbCss10207'; css.textContent=`
      .att-worker-id{display:block;font-size:11px;color:#60756f;font-weight:700;margin-top:3px}
      .att-supervisor-row td{background:#eaf5f1!important;color:#063d33!important;font-weight:900;text-align:right!important;border-top:2px solid #0b5a4a!important}
      .att-supervisor-row small{color:#60756f;font-weight:800;margin-right:8px}
      .att-rb-matrix th:first-child,.att-rb-matrix td:first-child{position:sticky;right:0;background:#fff;z-index:2;min-width:160px}
      .att-rb-matrix th:first-child{background:#074f40!important;color:#fff!important;z-index:3}
      @media print{
        .att-rb-controls,.att-rb-msg,.att-rb-summary,#attRbWorkers{display:none!important}
        .att-rb-card{page-break-inside:avoid;border:0!important}
        .att-supervisor-row td{background:#eef7f3!important;color:#000!important}
      }
    `; document.head.appendChild(css);
  }

  function ensureInstalled(){
    ensureCss();
    if($('attRbDate') && !$('attRbDate').value) $('attRbDate').value=today();
    if($('attRbMonth') && !$('attRbMonth').value) $('attRbMonth').value=monthNow();
    const binds=[['attRbRefresh',()=>render(true)],['attRbSave',save],['attRbPrint',print],['attRbCsv',exportCsv]];
    binds.forEach(([bid,fn])=>{ const el=$(bid); if(el && el.dataset.v10205!=='1'){ el.dataset.v10205='1'; el.onclick=e=>{e&&e.preventDefault&&e.preventDefault(); Promise.resolve(fn()).catch(err=>message(err.message||String(err),'err'));}; }});
    ['attRbDate','attRbMonth','attRbSupervisor','attRbSearch'].forEach(bid=>{ const el=$(bid); if(el && el.dataset.v10205Change!=='1'){ el.dataset.v10205Change='1'; el.addEventListener('change',()=>render(false).catch(console.warn)); el.addEventListener('input',()=>render(false).catch(console.warn)); }});
  }

  function message(t,kind){ const m=$('attRbMsg'); if(m){ m.textContent=t; m.className='att-rb-msg '+(kind==='err'?'err':'ok'); } try{ if(kind==='err' && typeof window.msg==='function') window.msg(t,'err'); }catch(_){}}

  async function render(force){
    ensureInstalled();
    const month=($('attRbMonth')?.value||monthNow()).slice(0,7);
    await load(month, !!force);
    fillFilters();
    const date=$('attRbDate')?.value||today();
    const workers=filteredWorkers();
    const recMap=buildRecordMap();
    const dayRecs=workers.map(w=>getWorkerRecord(w,date,recMap)).filter(Boolean);
    const present=dayRecs.filter(a=>a.status==='present').length;
    const absent=dayRecs.filter(a=>a.status==='absent').length;
    const duplicateNames=countDuplicateNames(uniqueWorkers());

    const sum=$('attRbSummary');
    if(sum){
      sum.innerHTML=`
        <div class="att-rb-kpi"><small>العمال الحاليون</small><b>${workers.length}</b></div>
        <div class="att-rb-kpi"><small>حضور اليوم</small><b>${present}</b></div>
        <div class="att-rb-kpi"><small>غياب اليوم</small><b>${absent}</b></div>
        <div class="att-rb-kpi"><small>أسماء تم توحيدها</small><b>${duplicateNames}</b></div>
        <div class="att-rb-kpi"><small>النسخة</small><b>${BUILD}</b></div>`;
    }
    message('جاهز - كل اسم عامل يظهر مرة واحدة فقط بدون رقم ID وبدون تكرار.');
    renderWorkersBox(workers,date,recMap);
    renderToday(workers,date,recMap);
    renderMatrix(workers,month,recMap);
    return workers;
  }

  function countDuplicateNames(workers){ return (st.workers||[]).filter(w=>w&&w.id&&isWorkerActive(w)).length - uniqueWorkers().length; }

  function renderWorkersBox(workers,date,recMap){
    const box=$('attRbWorkers'); if(!box) return;
    const groups=groupWorkers(workers);
    box.innerHTML=groups.map(g=>`
      <div class="att-rb-worker" style="grid-column:1/-1;background:#eaf5f1"><b>المشرف: ${esc(g.name)}</b><small>عدد العمال: ${g.workers.length}</small></div>
      ${g.workers.map(w=>{
        const r=getWorkerRecord(w,date,recMap);
        return `<div class="att-rb-worker" data-wid="${esc(workerInternalId(w))}" title="اسم موحد داخليًا">
          <b>${esc(workerLabel(w))}</b>
          <small>${esc(projectName(workerProjectId(w)))}</small>
          <select class="attStatus">
            <option value="present" ${(!r||r.status==='present')?'selected':''}>حاضر</option>
            <option value="absent" ${r&&r.status==='absent'?'selected':''}>غائب</option>
          </select>
          <input class="attNotes" placeholder="ملاحظات" value="${esc(r?.notes||'')}">
        </div>`;
      }).join('')}`).join('') || '<div class="att-rb-worker">لا يوجد عمال حسب الفلتر</div>';
  }

  function renderToday(workers,date,recMap){
    const body=$('attRbTodayBody'); if(!body) return;
    const groups=groupWorkers(workers);
    body.innerHTML=groups.map(g=>`
      <tr class="att-supervisor-row"><td colspan="5">المشرف: ${esc(g.name)} <small>عدد العمال: ${g.workers.length}</small></td></tr>
      ${g.workers.map(w=>{
        const r=getWorkerRecord(w,date,recMap);
        return `<tr title="اسم موحد داخليًا">
          <td><b>${esc(workerLabel(w))}</b></td>
          <td>${esc(g.name)}</td>
          <td>${esc(projectName(workerProjectId(w)))}</td>
          <td class="${statusClass(r?.status)}">${statusLabel(r?.status)}</td>
          <td>${esc(r?.notes||'')}</td>
        </tr>`;
      }).join('')}`).join('') || '<tr><td colspan="5">لا توجد بيانات</td></tr>';
  }

  function renderMatrix(workers,month,recMap){
    const head=$('attRbMatrixHead'), body=$('attRbMatrixBody'); if(!head||!body) return;
    const days=daysOfMonth(month);
    const cols=days.length+3;
    head.innerHTML='<tr><th>العامل</th>'+days.map(d=>`<th>${d}</th>`).join('')+'<th>حضور</th><th>غياب</th></tr>';
    const groups=groupWorkers(workers);
    body.innerHTML=groups.map(g=>{
      const rows=g.workers.map(w=>{
        let p=0,a=0;
        const cells=days.map(d=>{
          const ds=month+'-'+d;
          const r=getWorkerRecord(w,ds,recMap);
          if(r?.status==='present'){p++; return '<td class="att-present">ح</td>';}
          if(r?.status==='absent'){a++; return '<td class="att-absent">غ</td>';}
          return '<td class="att-empty">-</td>';
        }).join('');
        return `<tr title="اسم موحد داخليًا"><td><b>${esc(workerLabel(w))}</b></td>${cells}<td>${p}</td><td>${a}</td></tr>`;
      }).join('');
      return `<tr class="att-supervisor-row"><td colspan="${cols}">المشرف: ${esc(g.name)} <small>عدد العمال: ${g.workers.length}</small></td></tr>${rows}`;
    }).join('') || '<tr><td>لا توجد بيانات</td></tr>';
  }

  async function save(){
    if(!window.sb) throw new Error('لا يوجد اتصال Supabase');
    const date=$('attRbDate')?.value||today();
    const rows=[...document.querySelectorAll('#attRbWorkers .att-rb-worker[data-wid]')];
    if(!rows.length) return message('لا يوجد عمال للحفظ','err');
    for(const el of rows){
      const wid=el.dataset.wid;
      const w=workerById(wid);
      if(!w||!w.id) continue;
      const row={
        attendance_date:date,
        worker_id:N(workerInternalId(w)),
        worker_identity:workerBaseName(w),
        supervisor_id:N(workerSupervisorId(w))||null,
        project_id:N(workerProjectId(w))||null,
        status:el.querySelector('.attStatus')?.value||'present',
        notes:el.querySelector('.attNotes')?.value||'',
        created_at:new Date().toISOString()
      };
      const existing=await sb.from('attendance').select('id').eq('attendance_date',date).eq('worker_id',N(workerInternalId(w))).maybeSingle();
      if(existing.error && existing.error.code!=='PGRST116') throw existing.error;
      if(existing.data?.id){ const r=await sb.from('attendance').update(row).eq('id',existing.data.id); if(r.error) throw r.error; }
      else { const r=await sb.from('attendance').insert(row); if(r.error) throw r.error; }
    }
    message('تم حفظ التحضير، كل اسم يظهر مرة واحدة فقط بدون تكرار.');
    await render(true);
  }

  function print(){ window.print(); }

  async function exportCsv(){
    await render(false);
    const month=($('attRbMonth')?.value||monthNow()).slice(0,7);
    const workers=filteredWorkers();
    const recMap=buildRecordMap();
    const days=daysOfMonth(month);
    const rows=[];
    rows.push(['المشرف','العامل',...days,'حضور','غياب']);
    groupWorkers(workers).forEach(g=>{
      rows.push([`المشرف: ${g.name}`,'']);
      g.workers.forEach(w=>{
        let p=0,a=0;
        const cells=days.map(d=>{ const r=getWorkerRecord(w,month+'-'+d,recMap); if(r?.status==='present'){p++; return 'ح';} if(r?.status==='absent'){a++; return 'غ';} return '-'; });
        rows.push([g.name, workerLabel(w), ...cells, p, a]);
      });
    });
    const csv=rows.map(r=>r.map(x=>'"'+S(x).replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='attendance_unique_names_no_id_'+month+'.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  window.renderAttendanceRootV10201=function(force){ return render(!!force); };
  window.saveAttendanceRootV10201=save;
  window.printAttendanceRootV10201=print;
  window.exportAttendanceRootV10201=exportCsv;
  window.renderAttendanceRootV10202=function(force){ return render(!!force); };
  window.saveAttendanceRootV10202=save;
  window.printAttendanceRootV10202=print;
  window.exportAttendanceRootV10202=exportCsv;
  window.renderAttendance=()=>render(false);
  window.renderAttendanceMonthly=()=>render(false);
  window.exportAttendanceMatrixCSV=exportCsv;

  const oldShow=window.showPage;
  window.showPage=function(page,btn){ const r=oldShow?oldShow.apply(this,arguments):undefined; if(page==='attendance') setTimeout(()=>render(true).catch(e=>message(e.message||String(e),'err')),250); return r; };

  document.addEventListener('DOMContentLoaded',()=>{ setTimeout(()=>{ ensureInstalled(); if($('attendance') && !$('attendance').classList.contains('hidden')) render(true).catch(e=>message(e.message||String(e),'err')); },1500); });
  setTimeout(()=>ensureInstalled(),2500);
  console.log('Tasneef attendance unique names canonical id loaded '+BUILD);
})();

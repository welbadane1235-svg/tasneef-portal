
/* ===== TASNEEF V10204 ATTENDANCE BY WORKER_ID VIEW FIX =====
   إصلاح جذري لعرض الحضور والغياب:
   - لا يعتمد على اسم العامل worker_identity للعرض أو التجميع.
   - يعتمد على worker_id فقط، لأن عندكم أسماء مكررة.
*/
(function(){
  'use strict';
  if(window.__tasneefAttendanceWorkerIdViewV10204) return;
  window.__tasneefAttendanceWorkerIdViewV10204 = true;

  const BUILD='V10204';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const N=v=>Number(v)||0;
  const esc=s=>S(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>S(s).toLowerCase().replace(/[إأآا]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();

  const st={workers:[],projects:[],users:[],attendance:[],loadedMonth:'',loaded:false};

  function today(){
    const d=new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function monthNow(){ return today().slice(0,7); }
  function monthRange(m){
    const y=N(m.slice(0,4)), mo=N(m.slice(5,7));
    const from=`${y}-${String(mo).padStart(2,'0')}-01`;
    const toDate=new Date(y,mo,1);
    const to=toDate.getFullYear()+'-'+String(toDate.getMonth()+1).padStart(2,'0')+'-'+String(toDate.getDate()).padStart(2,'0');
    return {from,to};
  }
  function daysOfMonth(m){
    const y=N(m.slice(0,4)), mo=N(m.slice(5,7));
    const last=new Date(y,mo,0).getDate()||31;
    return Array.from({length:last},(_,i)=>String(i+1).padStart(2,'0'));
  }
  async function safe(q){
    try{ const r=await q; if(r.error){ console.warn('attendance v10204',r.error.message); return []; } return r.data||[]; }
    catch(e){ console.warn('attendance v10204',e); return []; }
  }
  function userName(id){
    const u=st.users.find(x=>S(x.id)===S(id))||{};
    return S(u.full_name||u.name||u.username||id||'-')||'-';
  }
  function projectById(id){ return st.projects.find(p=>S(p.id)===S(id))||{}; }
  function projectName(id){
    const p=projectById(id);
    return S(p.name||p.project_name||id||'-')||'-';
  }
  function workerName(w){ return S(w.name||w.full_name||w.worker_name||w.id||'-')||'-'; }
  function workerProjectId(w){ return w.project_id || w.assigned_project_id || w.current_project_id || ''; }
  function workerSupervisorId(w){
    const p=projectById(workerProjectId(w));
    return w.supervisor_id || w.app_supervisor_id || p.supervisor_id || '';
  }
  function currentWorkers(){
    return (st.workers||[]).filter(w=>{
      const status=norm(w.status||w.state||'active');
      return status!=='deleted' && status!=='inactive' && status!=='محذوف';
    }).sort((a,b)=>workerName(a).localeCompare(workerName(b),'ar'));
  }
  async function load(month, force){
    if(!window.sb) throw new Error('لا يوجد اتصال Supabase');
    if(st.loaded && st.loadedMonth===month && !force) return;
    const r=monthRange(month);
    const [workers,projects,users,attendance]=await Promise.all([
      safe(sb.from('workers').select('*').limit(5000)),
      safe(sb.from('projects').select('*').limit(5000)),
      safe(sb.from('app_users').select('*').limit(1000)),
      safe(sb.from('attendance').select('*').gte('attendance_date',r.from).lt('attendance_date',r.to).limit(10000))
    ]);
    st.workers=workers||[];
    st.projects=projects||[];
    st.users=users||[];
    st.attendance=attendance||[];
    st.loadedMonth=month;
    st.loaded=true;
  }
  function filteredWorkers(){
    const sid=$('attRbSupervisor')?.value||'';
    const q=norm($('attRbSearch')?.value||'');
    let rows=currentWorkers();
    if(sid) rows=rows.filter(w=>S(workerSupervisorId(w))===S(sid));
    if(q) rows=rows.filter(w=>norm([workerName(w),projectName(workerProjectId(w)),userName(workerSupervisorId(w)),w.id].join(' ')).includes(q));
    return rows;
  }
  function fillFilters(){
    const sel=$('attRbSupervisor');
    if(!sel) return;
    const cur=sel.value||'';
    const ids=[...new Set(currentWorkers().map(workerSupervisorId).filter(Boolean).map(S))];
    sel.innerHTML='<option value="">كل المشرفين</option>'+ids.map(id=>`<option value="${esc(id)}">${esc(userName(id))}</option>`).join('');
    sel.value=cur;
  }
  function statusClass(sts){ return sts==='present'?'att-present':sts==='absent'?'att-absent':'att-empty'; }
  function statusLabel(sts){ return sts==='present'?'حاضر':sts==='absent'?'غائب':'غير مسجل'; }
  function recordDate(a){ return S(a.attendance_date||a.date).slice(0,10); }

  function buildRecordMap(){
    const m=new Map();
    (st.attendance||[]).forEach(a=>{
      const wid=S(a.worker_id||'');
      const d=recordDate(a);
      if(!wid||!d) return;
      m.set(wid+'|'+d,a);
    });
    return m;
  }

  async function render(force){
    const month=$('attRbMonth')?.value||monthNow();
    await load(month, force);
    fillFilters();

    const date=$('attRbDate')?.value||today();
    const workers=filteredWorkers();
    const recMap=buildRecordMap();

    const dayRecs=workers.map(w=>recMap.get(S(w.id)+'|'+date)).filter(Boolean);
    const present=dayRecs.filter(a=>a.status==='present').length;
    const absent=dayRecs.filter(a=>a.status==='absent').length;

    const msg=$('attRbMsg');
    if(msg) msg.textContent='جاهز - العرض الآن يعتمد على worker_id وليس اسم العامل، حتى لا تتكرر أسماء العمال.';

    const sum=$('attRbSummary');
    if(sum){
      sum.innerHTML=`
        <div class="att-rb-kpi"><small>العمال الحاليون</small><b>${workers.length}</b></div>
        <div class="att-rb-kpi"><small>حضور اليوم</small><b>${present}</b></div>
        <div class="att-rb-kpi"><small>غياب اليوم</small><b>${absent}</b></div>
        <div class="att-rb-kpi"><small>سجلات الشهر</small><b>${st.attendance.length}</b></div>
        <div class="att-rb-kpi"><small>النسخة</small><b>${BUILD}</b></div>`;
    }

    const box=$('attRbWorkers');
    if(box){
      box.innerHTML=workers.map(w=>{
        const r=recMap.get(S(w.id)+'|'+date);
        const sid=workerSupervisorId(w), pid=workerProjectId(w);
        return `<div class="att-rb-worker" data-wid="${esc(w.id)}" title="worker_id: ${esc(w.id)}">
          <b>${esc(workerName(w))}</b>
          <small>${esc(userName(sid))} - ${esc(projectName(pid))}</small>
          <select class="attStatus">
            <option value="present" ${(!r||r.status==='present')?'selected':''}>حاضر</option>
            <option value="absent" ${r&&r.status==='absent'?'selected':''}>غائب</option>
          </select>
          <input class="attNotes" placeholder="ملاحظات" value="${esc(r?.notes||'')}">
        </div>`;
      }).join('') || '<div class="att-rb-worker">لا يوجد عمال حسب الفلتر</div>';
    }

    const todayBody=$('attRbTodayBody');
    if(todayBody){
      todayBody.innerHTML=workers.map(w=>{
        const r=recMap.get(S(w.id)+'|'+date);
        const sid=workerSupervisorId(w), pid=workerProjectId(w);
        return `<tr>
          <td>${esc(workerName(w))}</td>
          <td>${esc(userName(sid))}</td>
          <td>${esc(projectName(pid))}</td>
          <td class="${statusClass(r?.status)}">${statusLabel(r?.status)}</td>
          <td>${esc(r?.notes||'')}</td>
        </tr>`;
      }).join('') || '<tr><td colspan="5">لا توجد بيانات</td></tr>';
    }

    renderMatrix(workers, month, recMap);
  }

  function renderMatrix(workers, month, recMap){
    const head=$('attRbMatrixHead'), body=$('attRbMatrixBody');
    if(!head||!body) return;
    const days=daysOfMonth(month);
    head.innerHTML='<tr><th>العامل</th>'+days.map(d=>`<th>${d}</th>`).join('')+'<th>حضور</th><th>غياب</th></tr>';
    body.innerHTML=workers.map(w=>{
      let p=0,a=0;
      const cells=days.map(d=>{
        const ds=month+'-'+d;
        const r=recMap.get(S(w.id)+'|'+ds);
        if(r?.status==='present'){p++; return '<td class="att-present">ح</td>';}
        if(r?.status==='absent'){a++; return '<td class="att-absent">غ</td>';}
        return '<td class="att-empty">-</td>';
      }).join('');
      return `<tr title="worker_id: ${esc(w.id)}"><td><b>${esc(workerName(w))}</b></td>${cells}<td>${p}</td><td>${a}</td></tr>`;
    }).join('') || '<tr><td>لا توجد بيانات</td></tr>';
  }

  async function save(){
    if(!window.sb) return alert('لا يوجد اتصال Supabase');
    const date=$('attRbDate')?.value||today();
    const rows=[...document.querySelectorAll('#attRbWorkers .att-rb-worker[data-wid]')];
    for(const el of rows){
      const wid=el.dataset.wid;
      const w=st.workers.find(x=>S(x.id)===S(wid));
      if(!w) continue;
      const row={
        attendance_date:date,
        worker_id:Number(wid),
        worker_identity:workerName(w),
        supervisor_id:N(workerSupervisorId(w))||null,
        project_id:N(workerProjectId(w))||null,
        status:el.querySelector('.attStatus')?.value||'present',
        notes:el.querySelector('.attNotes')?.value||'',
        created_at:new Date().toISOString()
      };
      const existing=await safe(sb.from('attendance').select('id').eq('attendance_date',date).eq('worker_id',Number(wid)).maybeSingle());
      if(existing && existing.id){
        const r=await sb.from('attendance').update(row).eq('id',existing.id);
        if(r.error) throw new Error(r.error.message);
      }else{
        const r=await sb.from('attendance').insert(row);
        if(r.error) throw new Error(r.error.message);
      }
    }
    await render(true);
  }

  function print(){ window.print(); }
  function csv(){
    const rows=[];
    const th=[...document.querySelectorAll('#attRbMatrixHead th')].map(x=>'"'+x.textContent.trim().replace(/"/g,'""')+'"').join(',');
    rows.push(th);
    document.querySelectorAll('#attRbMatrixBody tr').forEach(tr=>{
      rows.push([...tr.children].map(td=>'"'+td.textContent.trim().replace(/"/g,'""')+'"').join(','));
    });
    const blob=new Blob(['\ufeff'+rows.join('\n')],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='attendance_by_worker_id_'+($('attRbMonth')?.value||monthNow())+'.csv';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  function hook(){
    if($('attRbRefresh')) $('attRbRefresh').onclick=()=>render(true).catch(e=>alert(e.message||String(e)));
    if($('attRbSave')) $('attRbSave').onclick=()=>save().catch(e=>alert(e.message||String(e)));
    if($('attRbPrint')) $('attRbPrint').onclick=print;
    if($('attRbCsv')) $('attRbCsv').onclick=csv;
    ['attRbDate','attRbMonth','attRbSupervisor','attRbSearch'].forEach(id=>{
      const el=$(id);
      if(el && !el.dataset.v10204){
        el.dataset.v10204='1';
        el.addEventListener('input',()=>render(false).catch(console.warn));
        el.addEventListener('change',()=>render(false).catch(console.warn));
      }
    });
  }

  window.renderAttendanceRootV10201=function(force){
    hook();
    return render(!!force);
  };
  window.saveAttendanceRootV10201=save;
  window.printAttendanceRootV10201=print;
  window.exportAttendanceRootV10201=csv;

  const oldShow=window.showPage;
  window.showPage=function(id,btn){
    const r=oldShow?oldShow.apply(this,arguments):undefined;
    if(id==='attendance') setTimeout(()=>{ hook(); render(true).catch(console.warn); },250);
    return r;
  };

  document.addEventListener('DOMContentLoaded',()=>{
    setTimeout(()=>{ hook(); if($('attendance') && !$('attendance').classList.contains('hidden')) render(true).catch(console.warn); },1200);
  });

  console.log('Tasneef attendance worker_id view fix loaded '+BUILD);
})();

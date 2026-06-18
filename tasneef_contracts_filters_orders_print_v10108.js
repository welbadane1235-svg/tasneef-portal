/* Tasneef v10108 - Contract service filters + executed print + Orders filtered print
   Scope only: الخدمات التعاقدية + طباعة الأوردرات حسب الفلاتر.
   لا يغير الحفظ ولا المالية ولا المخزون ولا التكتات ولا الأوقات الشهرية.
*/
(function(){
  'use strict';
  if(window.__tasneefContractsOrdersPrintV10108) return;
  window.__tasneefContractsOrdersPrintV10108 = true;
  const VERSION='v10108-contract-filters-orders-print';
  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const N=v=>{const x=Number(String(v??'').replace(/,/g,'').replace(/[^0-9.\-]/g,''));return Number.isFinite(x)?x:0;};
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const today=()=>new Date().toISOString().slice(0,10);
  const client=()=>window.sb||window.supabaseClient||window.supabase||null;
  function txt(el){return S(el?.textContent).replace(/\s+/g,' ')}
  function norm(v){return S(v).replace(/\s+/g,'').toLowerCase();}
  function msg(t,type){try{ if(typeof window.msg==='function') return window.msg(t,type); }catch(_){} if(type==='err') console.error(t); else console.log(t);}
  function parseDate(v){const s=S(v); if(!s) return null; const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m) return new Date(+m[1],+m[2]-1,+m[3]); const d=new Date(s); return isNaN(d)?null:new Date(d.getFullYear(),d.getMonth(),d.getDate());}
  function fmtDate(d){return d instanceof Date && !isNaN(d) ? d.toISOString().slice(0,10) : '';}
  function addDays(d,n){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); x.setDate(x.getDate()+Number(n||0)); return x;}
  function iso(v){return S(v).slice(0,10);}
  function projectList(){return A(window.data?.projects||[]);}
  function projectById(id){return projectList().find(p=>S(p.id)===S(id))||{};}
  function projectName(id){return projectById(id).name || ('مشروع '+S(id));}
  function supervisorName(id){try{ if(typeof window.supervisorName==='function') return window.supervisorName(id); }catch(_){} const u=A(window.data?.users||[]).find(x=>S(x.id)===S(id)); return u?.full_name||u?.name||u?.username||'';}
  function statusCode(status){const s=S(status); if(/منجزة|منفذة|مكتملة|تمت/.test(s)) return 'done'; if(/متأخرة/.test(s)) return 'late'; if(/قريبة/.test(s)) return 'soon'; if(/مراجعة/.test(s)) return 'review'; if(/مستحقة/.test(s)) return 'due'; return '';}
  function rowDone(r){return statusCode(r.status)==='done' || (N(r.visits)>0 && N(r.done)>=N(r.visits)) || (N(r.visits)>0 && N(r.remaining)<=0);}
  function dueStatus(due,done){ if(done) return 'منفذة'; const d=parseDate(due); if(!d) return 'مستحقة'; const now=parseDate(today()); const diff=Math.ceil((d-now)/86400000); if(diff<0) return 'متأخرة'; if(diff<=15) return 'قريبة'; return 'مستحقة'; }
  function serviceSection(){return $('servicesSubTab') || $('contracts') || document;}
  function serviceTable(){return $('contractServicesBody')?.closest('table')||null;}
  function headers(table){return [...(table?.querySelectorAll('thead th')||[])].map(th=>txt(th));}
  function headerIndex(heads,patterns){return heads.findIndex(h=>patterns.some(p=>norm(h).includes(norm(p))));}
  function cells(tr){return [...tr.children].filter(x=>/TD|TH/.test(x.tagName));}
  function tableMap(table){const h=headers(table); return {project:headerIndex(h,['المشروع']),supervisor:headerIndex(h,['المشرف']),service:headerIndex(h,['الخدمة','اسم الخدمة']),type:headerIndex(h,['النوع']),repeat:headerIndex(h,['التكرار']),visits:headerIndex(h,['عدد الزيارات','الزيارات']),done:h.findIndex(x=>norm(x)==='تم'||norm(x).includes('تم')),remaining:headerIndex(h,['المتبقي']),last:headerIndex(h,['آخر تنفيذ','اخر تنفيذ']),due:headerIndex(h,['الاستحقاق','تاريخ']),status:headerIndex(h,['الحالة']),notes:headerIndex(h,['ملاحظات']),action:headerIndex(h,['إجراء','اجراء'])};}
  function rowFromTr(tr,map){const c=cells(tr); const get=i=>i>=0?txt(c[i]):''; const visits=N(get(map.visits)); const done=N(get(map.done)); const remText=get(map.remaining); return {source:'table',tr,project:get(map.project),project_id:tr.dataset.projectId||'',supervisor:get(map.supervisor),service:get(map.service),type:get(map.type),repeat:get(map.repeat),visits,done,remaining:remText?N(remText):Math.max(0,visits-done),last:get(map.last),due:get(map.due),status:get(map.status),notes:get(map.notes),text:txt(tr)};}

  async function loadSmartRows(){
    const sb=client();
    if(!sb) return [];
    try{
      const res=await sb.from('project_contract_smart').select('project_id,payload,updated_at').limit(5000);
      if(res.error) throw res.error;
      return A(res.data);
    }catch(e){console.warn(VERSION,'load project_contract_smart failed',e); return [];}
  }
  function readSmartCacheRows(){
    try{const raw=localStorage.getItem('tasneef_contract_smart_v10107_cache')||localStorage.getItem('tasneef_contract_smart_v299')||'{}'; const obj=JSON.parse(raw)||{}; return Object.entries(obj).map(([project_id,payload])=>({project_id,payload}));}catch(_){return []}
  }
  function rangeForProject(project){const start=iso(project.contract_start)||today(); const rawEnd=iso(project.contract_end)||fmtDate(addDays(parseDate(start)||new Date(),365)); const s=parseDate(today())>parseDate(start)?today():start; const e=parseDate(rawEnd)<parseDate(s)?s:rawEnd; return {start:s,end:e,days:Math.max(0,Math.round((parseDate(e)-parseDate(s))/86400000))};}
  function buildSchedule(project,item,allAnnual){
    const visits=Math.max(1,N(item.visits||1));
    const p=project||{}; const rg=rangeForProject(p); const existing=A(item.schedule).map((x,i)=> typeof x==='string'?{no:i+1,date:x,done:false}:{no:N(x.no||i+1),date:S(x.date),done:!!x.done}).filter(x=>x.date);
    const doneSet=new Set(A(item.done).map(Number)); const used=new Set();
    A(allAnnual).forEach(a=>{ if(S(a.id)===S(item.id)) return; A(a.schedule).forEach((x,i)=>{const d=typeof x==='string'?x:S(x.date); if(d) used.add(d);}); });
    const out=[];
    existing.forEach((x)=>{ if(out.length<visits && parseDate(x.date)>=parseDate(rg.start) && parseDate(x.date)<=parseDate(rg.end)){out.push({no:out.length+1,date:x.date,done:x.done||doneSet.has(out.length+1)}); used.add(x.date);} });
    for(let i=out.length;i<visits;i++){
      const pos=i+1; const gap=rg.days<=0?0:Math.round((rg.days*pos)/(visits+1)); let target=addDays(parseDate(rg.start)||new Date(),gap); let chosen='';
      for(let off=0; off<=Math.max(2,rg.days+3); off++){
        const f=fmtDate(addDays(target,off)); if(parseDate(f)<=parseDate(rg.end) && !used.has(f)){chosen=f;break;}
        const b=fmtDate(addDays(target,-off)); if(parseDate(b)>=parseDate(rg.start) && !used.has(b)){chosen=b;break;}
      }
      chosen=chosen||fmtDate(target); used.add(chosen); out.push({no:pos,date:chosen,done:doneSet.has(pos)});
    }
    return out;
  }
  function annualRowsFromSmart(rawRows,includeDone){
    const rows=[];
    rawRows.forEach(row=>{
      const project_id=S(row.project_id); const payload=row.payload||{}; const annual=A(payload.annual); if(!annual.length) return;
      const p=projectById(project_id); const pname=p.name||projectName(project_id); const sup=supervisorName(p.supervisor_id||p.manager_id)||'-';
      annual.forEach(a=>{
        const schedule=buildSchedule(p,a,annual);
        const doneSet=new Set(A(a.done).map(Number)); const done=A(a.done).length || schedule.filter(x=>x.done).length; const visits=Math.max(1,N(a.visits||1)); const remaining=Math.max(0,visits-done);
        const next=(schedule.find(x=>!doneSet.has(Number(x.no))&&!x.done)||{}).date || '-';
        const st=dueStatus(next, remaining<=0);
        const notes=(a.notes?S(a.notes)+' - ':'')+'جدولة: '+schedule.map(x=>`${x.no}: ${x.date||'-'}${(doneSet.has(Number(x.no))||x.done)?' ✓':''}`).join(' | ');
        const r={source:'annual',project:pname,project_id,supervisor:sup,service:S(a.name)||'خدمة سنوية',type:'سنوية من العقد',repeat:'سنوي',visits,done,remaining,last:'-',due:next,status:st,notes,text:[pname,sup,a.name,'سنوية من العقد',st,notes].join(' '),schedule};
        if(includeDone || !rowDone(r)) rows.push(r);
      });
    });
    return rows;
  }
  let smartRowsCache=[];
  async function refreshAnnualRows(){
    const remote=await loadSmartRows();
    smartRowsCache=remote.length?remote:readSmartCacheRows();
    injectAnnualRows();
    applyServiceFilters();
  }
  function makeAnnualCell(h,r){const k=norm(h); if(k.includes('المشروع'))return esc(r.project); if(k.includes('المشرف'))return esc(r.supervisor); if(k.includes('الخدمة'))return esc(r.service); if(k.includes('النوع'))return esc(r.type); if(k.includes('التكرار'))return esc(r.repeat); if(k.includes('عددالزيارات')||k.includes('الزيارات'))return r.visits; if(k==='تم'||k.includes('تم'))return r.done; if(k.includes('المتبقي'))return r.remaining; if(k.includes('آخر'))return esc(r.last); if(k.includes('استحقاق')||k.includes('تاريخ'))return esc(r.due); if(k.includes('الحالة'))return `<span class="badge">${esc(r.status)}</span>`; if(k.includes('ملاحظات'))return esc(r.notes); if(k.includes('إجراء')||k.includes('اجراء'))return `<button class="light" onclick="openContractSmartModal('${esc(r.project_id)}','edit')">عرض</button>`; return '';}
  function injectAnnualRows(){
    const table=serviceTable(); if(!table) return; const tbody=$('contractServicesBody'); if(!tbody) return;
    [...tbody.querySelectorAll('[data-v10108-annual-row], [data-v10107-annual-row]')].forEach(x=>x.remove());
    const h=headers(table); const rows=annualRowsFromSmart(smartRowsCache,true);
    rows.forEach(r=>{const tr=document.createElement('tr'); tr.dataset.v10108AnnualRow='1'; tr.dataset.projectId=r.project_id; tr.className='v10108-annual-linked-row'; tr.innerHTML=h.map(x=>`<td>${makeAnnualCell(x,r)}</td>`).join(''); tbody.appendChild(tr);});
  }
  function selectedText(id){const el=$(id); return S(el?.selectedOptions?.[0]?.textContent||'');}
  function serviceFilterValues(){return {q:S($('serviceSearch')?.value).toLowerCase(),project:S($('serviceFilterProject')?.value),projectText:selectedText('serviceFilterProject'),supervisor:S($('serviceFilterSupervisor')?.value),supervisorText:selectedText('serviceFilterSupervisor'),status:S($('serviceFilterStatus')?.value),type:S($('serviceFilterType')?.value),typeText:selectedText('serviceFilterType'),date:S($('serviceFilterDate')?.value)};}
  function rowMatchesServiceFilters(r,f){
    const hay=[r.project,r.supervisor,r.service,r.type,r.repeat,r.status,r.notes,r.due,r.last].join(' ').toLowerCase();
    if(f.q && !hay.includes(f.q)) return false;
    if(f.project){const pnorm=norm(r.project); if(S(r.project_id)!==f.project && norm(f.projectText)!==pnorm && !pnorm.includes(norm(f.project)) && !pnorm.includes(norm(f.projectText))) return false;}
    if(f.supervisor){const sn=norm(r.supervisor); if(sn && norm(f.supervisorText)!==sn && !sn.includes(norm(f.supervisor)) && !sn.includes(norm(f.supervisorText))) return false;}
    if(f.status){ if(statusCode(r.status)!==f.status) return false; } else { if(rowDone(r)) return false; }
    if(f.type){const tn=norm(r.type+' '+r.service); if(!tn.includes(norm(f.type)) && !tn.includes(norm(f.typeText))) return false;}
    if(f.date){ const d=iso(r.due)||iso(r.last); if(d!==f.date) return false; }
    return true;
  }
  function allServiceRows(includeDone){
    const table=serviceTable(); let rows=[];
    if(table){const map=tableMap(table); rows=[...table.querySelectorAll('tbody tr')].filter(tr=>!tr.dataset.v10108AnnualRow&&!tr.dataset.v10107AnnualRow).map(tr=>rowFromTr(tr,map)).filter(r=>r.service||r.project);}
    rows=rows.concat(annualRowsFromSmart(smartRowsCache,!!includeDone));
    const seen=new Set(); return rows.filter(r=>{const k=[r.project,r.service,r.type,r.visits,r.due].join('|'); if(seen.has(k)) return false; seen.add(k); return true;});
  }
  function applyServiceFilters(){
    const table=serviceTable(); if(!table) return; const map=tableMap(table); const f=serviceFilterValues();
    [...table.querySelectorAll('tbody tr')].forEach(tr=>{const r=rowFromTr(tr,map); tr.style.display=rowMatchesServiceFilters(r,f)?'':'none';});
    const all=allServiceRows(true); const visible=all.filter(r=>rowMatchesServiceFilters(r,f));
    if($('servicesTotalCount')) $('servicesTotalCount').textContent=all.filter(r=>!rowDone(r)).length;
    if($('servicesDueCount')) $('servicesDueCount').textContent=all.filter(r=>statusCode(r.status)==='due'&&!rowDone(r)).length;
    if($('servicesSoonCount')) $('servicesSoonCount').textContent=all.filter(r=>statusCode(r.status)==='soon').length;
    if($('servicesLateCount')) $('servicesLateCount').textContent=all.filter(r=>statusCode(r.status)==='late').length;
    if($('servicesDoneCount')) $('servicesDoneCount').textContent=all.filter(rowDone).length;
    if($('servicesReviewCount')) $('servicesReviewCount').textContent=all.filter(r=>statusCode(r.status)==='review').length;
  }
  function installServiceFilterHooks(){
    ['serviceSearch','serviceFilterProject','serviceFilterSupervisor','serviceFilterStatus','serviceFilterType','serviceFilterDate'].forEach(id=>{const el=$(id); if(el&&!el.__v10108){el.__v10108=1; el.addEventListener('input',()=>setTimeout(()=>{injectAnnualRows();applyServiceFilters();},30)); el.addEventListener('change',()=>setTimeout(()=>{injectAnnualRows();applyServiceFilters();},30));}});
    const type=$('serviceFilterType'); if(type && ![...type.options].some(o=>S(o.value)==='سنوية من العقد'||S(o.textContent)==='سنوية من العقد')) type.insertAdjacentHTML('beforeend','<option value="سنوية من العقد">سنوية من العقد</option>');
    const old=window.renderContractServices; if(!window.__renderContractServicesV10108Wrapped){window.__renderContractServicesV10108Wrapped=1; window.renderContractServices=function(){const out=typeof old==='function'?old.apply(this,arguments):undefined; setTimeout(()=>{injectAnnualRows();applyServiceFilters();},100); return out;};}
    const oldReset=window.resetServiceFilters; if(!window.__resetServiceFiltersV10108Wrapped){window.__resetServiceFiltersV10108Wrapped=1; window.resetServiceFilters=function(){const out=typeof oldReset==='function'?oldReset.apply(this,arguments):undefined; ['serviceSearch','serviceFilterProject','serviceFilterSupervisor','serviceFilterStatus','serviceFilterType','serviceFilterDate'].forEach(id=>{const el=$(id); if(el) el.value='';}); setTimeout(()=>{injectAnnualRows();applyServiceFilters();},80); return out;};}
  }

  function printDoc(title,body){
    const w=window.open('','_blank','width=1400,height=900'); if(!w){alert('تعذر فتح نافذة الطباعة');return;}
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4 landscape;margin:8mm}body{font-family:Arial,Tahoma,sans-serif;direction:rtl;color:#17252f;margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.wrap{padding:10px}.title{text-align:center;font-size:26px;font-weight:900;color:#064c3b;margin:0 0 8px}.sub{text-align:center;color:#566;margin-bottom:14px}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:8px 0 14px}.meta div{border:1px solid #d9e8e1;border-radius:12px;padding:8px;text-align:center;background:#fbfefd}.meta b{display:block;color:#064c3b;font-size:18px}.block{page-break-inside:avoid;margin-bottom:14px;border:1px solid #d9e8e1;border-radius:14px;overflow:hidden}.block h2{margin:0;background:#064c3b;color:#fff;font-size:16px;padding:9px 11px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #d7e1dd;padding:6px 4px;text-align:center;font-size:11px;word-break:break-word}th{background:#eef7f3;color:#064c3b;font-weight:900}tbody tr:nth-child(even) td{background:#fafcfb}.small td,.small th{font-size:9px;padding:5px 3px}.badge{display:inline-block;border-radius:10px;background:#fff1d6;color:#7a4b00;padding:2px 7px;font-weight:800}</style></head><body><div class="wrap"><h1 class="title">${esc(title)}</h1><div class="sub">تاريخ الطباعة: ${esc(today())}</div>${body}</div></body></html>`;
    w.document.open(); w.document.write(html); w.document.close(); w.focus(); setTimeout(()=>w.print(),500);
  }
  window.printContractServicesSmartV10108=async function(){
    await refreshAnnualRows();
    const f=serviceFilterValues(); const rows=allServiceRows(f.status==='done'||!!f.status).filter(r=>rowMatchesServiceFilters(r,f));
    if(!rows.length){alert('لا توجد خدمات حسب الفلاتر الحالية للطباعة');return;}
    const g=new Map(); rows.forEach(r=>{const k=r.project||'بدون مشروع'; if(!g.has(k)) g.set(k,[]); g.get(k).push(r);});
    let body=`<div class="meta"><div>إجمالي النتائج<b>${rows.length}</b></div><div>المشاريع<b>${g.size}</b></div><div>منفذة ضمن النتائج<b>${rows.filter(rowDone).length}</b></div><div>غير منفذة<b>${rows.filter(r=>!rowDone(r)).length}</b></div></div>`;
    g.forEach((items,project)=>{body+=`<section class="block"><h2>${esc(project)}</h2><table><thead><tr><th>#</th><th>الخدمة</th><th>المشرف</th><th>النوع</th><th>التكرار</th><th>الزيارات</th><th>تم</th><th>المتبقي</th><th>الاستحقاق</th><th>الحالة</th><th>ملاحظات / الجدولة</th></tr></thead><tbody>${items.map((r,i)=>`<tr><td>${i+1}</td><td><b>${esc(r.service)}</b></td><td>${esc(r.supervisor||'-')}</td><td>${esc(r.type||'-')}</td><td>${esc(r.repeat||'-')}</td><td>${N(r.visits)}</td><td>${N(r.done)}</td><td>${N(r.remaining)}</td><td>${esc(r.due||'-')}</td><td><span class="badge">${esc(r.status||'-')}</span></td><td>${esc(r.notes||'-')}</td></tr>`).join('')}</tbody></table></section>`;});
    printDoc('الجدول الذكي للخدمات التعاقدية والسنوية',body);
  };
  window.printContractServicesSmartV10107=window.printContractServicesSmartV10108;
  window.tasneefPrintContractsServicesV10097=window.printContractServicesSmartV10108;
  function installSmartButton(){const sec=serviceSection(); if(!sec||$('[data-v10108-smart-print]')) return; const head=sec.querySelector('.table-head .row-actions')||sec.querySelector('.table-head')||sec; const btn=document.createElement('button'); btn.type='button'; btn.className='light'; btn.dataset.v10108SmartPrint='1'; btn.textContent='جدول ذكي'; btn.onclick=window.printContractServicesSmartV10108; head.insertBefore(btn,head.firstChild);}

  // ===== Orders filtered print =====
  const ORDER_HEADERS=['رقم الطلب','رقم الطلب بالجروب','تاريخ الطلب','وقت الطلب','مرسل الطلب','المشروع','نوع العقار','رقم الشقة','اسم العميل','رقم العميل','المنفذ','التفاصيل','ملاحظات','تخص','تاريخ التنفيذ','كيفية التنفيذ','حالة التنفيذ','تقرير','السعر (شامل الضريبة)','الضريبة 15%','السعر قبل الضريبة','التكلفة','الربح','حالة السداد','الإيصال','رقم الفاتورة','فوترة بالسيستم'];
  function readOrders(){try{return A(JSON.parse(localStorage.getItem('tasneef_orders_v233')||'[]'));}catch(_){return []}}
  function ofield(r,h){return S(r?.[h] ?? '');}
  function orderDate(r){return ofield(r,'تاريخ الطلب')||S(r.order_date||r.created_at).slice(0,10);}
  function orderPay(r){const p=ofield(r,'حالة السداد')||S(r.payment_status); if(/آجل|أجل|اجل/.test(p))return'آجل'; if(/مسدد|تم السداد|مدفوع/.test(p))return'تم السداد'; return p;}
  function orderConcern(r){const c=ofield(r,'تخص')||S(r.concern); if(/عميل/.test(c))return'client'; if(/جمعية|اتحاد/.test(c))return'association'; return '';}
  function passOrderFilters(r){const q=S($('orderSearchV233')?.value).toLowerCase(), project=S($('orderProjectFilterV233')?.value), exec=S($('orderExecutorFilterV233')?.value), sender=S($('orderSenderFilterV233')?.value), status=S($('orderStatusFilterV233')?.value), pay=S($('orderPaymentFilterV233')?.value), bill=S($('orderBillingFilterV233')?.value), cn=S($('orderConcernFilterV10036')?.value), from=S($('orderFromDateV233')?.value), to=S($('orderToDateV233')?.value);
    if(project&&ofield(r,'المشروع')!==project)return false; if(exec&&ofield(r,'المنفذ')!==exec)return false; if(sender&&ofield(r,'مرسل الطلب')!==sender)return false; if(status&&ofield(r,'حالة التنفيذ')!==status)return false; if(pay&&orderPay(r)!==pay&&ofield(r,'حالة السداد')!==pay)return false; if(bill&&ofield(r,'فوترة بالسيستم')!==bill)return false; if(cn&&orderConcern(r)!==cn)return false; const d=orderDate(r); if(from&&d&&d<from)return false; if(to&&d&&d>to)return false; if(q){const hay=ORDER_HEADERS.map(h=>ofield(r,h)).join(' ').toLowerCase(); if(!hay.includes(q))return false;} return true;}
  window.printOrdersFilteredV10108=function(){const rows=readOrders().filter(passOrderFilters); if(!rows.length){alert('لا توجد أوردرات حسب الفلتر الحالي');return;} const g=new Map(); rows.forEach(r=>{const k=ofield(r,'المشروع')||'بدون مشروع'; if(!g.has(k))g.set(k,[]); g.get(k).push(r);}); let total=rows.reduce((a,r)=>a+N(ofield(r,'السعر (شامل الضريبة)')),0), cost=rows.reduce((a,r)=>a+N(ofield(r,'التكلفة')),0), profit=rows.reduce((a,r)=>a+N(ofield(r,'الربح')),0);
    let body=`<div class="meta"><div>عدد الأوردرات<b>${rows.length}</b></div><div>المشاريع<b>${g.size}</b></div><div>الإجمالي شامل الضريبة<b>${total.toLocaleString('ar-SA')}</b></div><div>الربح<b>${profit.toLocaleString('ar-SA')}</b></div></div>`;
    g.forEach((items,project)=>{body+=`<section class="block"><h2>${esc(project)}</h2><table class="small"><thead><tr>${ORDER_HEADERS.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${items.map(r=>`<tr>${ORDER_HEADERS.map(h=>`<td>${esc(ofield(r,h)||'-')}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`;}); printDoc('تقرير الأوردرات حسب الفلتر',body);};
  function installOrdersPrintButton(){const orders=$('orders'); if(!orders||orders.querySelector('[data-v10108-orders-print]')) return; const actions=orders.querySelector('.section-head .actions')||orders.querySelector('.section-head'); if(!actions)return; const b=document.createElement('button'); b.type='button'; b.className='light'; b.dataset.v10108OrdersPrint='1'; b.textContent='طباعة حسب الفلتر'; b.onclick=window.printOrdersFilteredV10108; actions.appendChild(b);}

  function boot(){try{installServiceFilterHooks(); installSmartButton(); installOrdersPrintButton(); refreshAnnualRows(); setTimeout(()=>{injectAnnualRows();applyServiceFilters();},700);}catch(e){console.warn(VERSION,e);}}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else setTimeout(boot,0);
  window.addEventListener('load',()=>setTimeout(boot,800),{once:true});
  const oldShow=window.showPage; if(!window.__showPageV10108Wrapped){window.__showPageV10108Wrapped=1; window.showPage=function(id,btn){const out=typeof oldShow==='function'?oldShow.apply(this,arguments):undefined; setTimeout(()=>{boot(); if(id==='contracts') refreshAnnualRows();},120); return out;};}
  console.log('Loaded '+VERSION);
})();

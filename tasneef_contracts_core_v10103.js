/* Tasneef v10103 - Contracts Core Supabase Save
   Scope: قسم الخدمات والعقود فقط.
   حل أساسي: مصدر واحد للحفظ والقراءة من project_contract_smart، بدون سكربتات حفظ متعددة.
*/
(function(){
  'use strict';
  if(window.__tasneefContractsCoreV10103) return;
  window.__tasneefContractsCoreV10103 = true;

  const VERSION='v10103-contracts-core-supabase-save';
  const TABLE='project_contract_smart';
  const LS_KEY='tasneef_contract_smart_v10103_cache';
  const OLD_LS_KEY='tasneef_contract_smart_v299';
  const CORE=[
    {key:'elevators',label:'مصاعد'},
    {key:'pools',label:'مسابح'},
    {key:'civilDefense',label:'دفاع مدني'}
  ];
  const ANNUAL_OPTIONS=['غسيل خزانات علوية','غسيل خزانات أرضية','رش مبيدات','غسيل الأسطح','تنظيف الممرات','تنظيف المناور','تنظيف المكيفات','تنظيف غرفة المصاعد','غسيل المواقف','تنظيف عدسات الكاميرات','التعطير','خدمة أخرى'];

  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const N=v=>{const x=Number(v);return Number.isFinite(x)?x:0;};
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const client=()=>window.sb||window.supabaseClient||window.supabase||null;
  const today=()=>new Date().toISOString().slice(0,10);
  const say=(t,type)=>{try{if(typeof window.msg==='function') return window.msg(t,type);}catch(_){} if(type==='err') console.error(t); alert(t);};
  function parseDate(value){const text=S(value); if(!text) return null; const m=text.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m) return new Date(+m[1],+m[2]-1,+m[3]); const d=new Date(text); return Number.isNaN(d.getTime())?null:new Date(d.getFullYear(),d.getMonth(),d.getDate());}
  function daysLeft(end){const d=parseDate(end); if(!d) return null; const now=new Date(); const s=new Date(now.getFullYear(),now.getMonth(),now.getDate()); return Math.ceil((d-s)/86400000);}
  function contractInfo(project){const days=daysLeft(project&&project.contract_end); if(days===null) return {key:'missing',text:'بيانات ناقصة',cls:'amber',days:'-'}; if(days<0) return {key:'expired',text:'منتهي',cls:'red',days}; if(days<=30) return {key:'soon',text:'قريب الانتهاء',cls:'amber',days}; return {key:'active',text:'نشط',cls:'green',days};}
  function iso(v){return S(v).slice(0,10);}
  function projects(){return A((window.data&&window.data.projects)||[]);}
  function projectById(id){return projects().find(p=>S(p.id)===S(id))||null;}

  let cache={};
  let loaded=false;
  let currentProjectId='';
  let readonlyMode=false;
  let currentRecord=null;

  function emptyRecord(){
    const contracts={};
    CORE.forEach(x=>contracts[x.key]={onUs:false,company:'',phone:'',start:'',end:'',visits:0,done:[],notes:''});
    return {contracts,annual:[],association:{name:'',manager:'',phone:''},updated_at:null};
  }
  function normalize(raw){
    const out=emptyRecord(); raw=raw||{};
    const old=raw.contracts||raw.core||{};
    CORE.forEach(x=>{const r=old[x.key]||{}; out.contracts[x.key]={onUs:!!(r.onUs??r.on_us),company:S(r.company||r.company_name),phone:S(r.phone||r.company_phone),start:S(r.start||r.from||r.contract_start),end:S(r.end||r.to||r.contract_end),visits:Math.max(0,N(r.visits||r.visit_count)),done:A(r.done).map(Number).filter(Boolean),notes:S(r.notes)};});
    out.annual=A(raw.annual).map(a=>({id:S(a.id)||('a'+Date.now()+Math.random().toString(16).slice(2)),name:S(a.name),visits:Math.max(1,N(a.visits||a.visit_count||1)),done:A(a.done).map(Number).filter(Boolean),notes:S(a.notes)})).filter(a=>a.name);
    const assoc=raw.association||raw.assoc||{}; out.association={name:S(assoc.name||raw.assoc_name),manager:S(assoc.manager||raw.assoc_manager),phone:S(assoc.phone||raw.assoc_phone)};
    out.updated_at=raw.updated_at||null;
    return out;
  }
  function readObj(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(_){return {};}}
  function writeCache(){try{localStorage.setItem(LS_KEY,JSON.stringify(cache));}catch(_){}}
  function getRecord(projectId){return normalize(cache[S(projectId)]||{});}
  function putRecord(projectId,rec){cache[S(projectId)]=normalize(rec); writeCache();}

  async function loadSmart(force){
    if(loaded&&!force) return;
    cache={...readObj(OLD_LS_KEY),...readObj(LS_KEY)};
    const c=client();
    if(c){
      const res=await c.from(TABLE).select('project_id,payload,updated_at').limit(5000);
      if(res.error) throw new Error('فشل قراءة جدول الخدمات والعقود: '+res.error.message);
      A(res.data).forEach(row=>{const rec=normalize(row.payload||{}); rec.updated_at=row.updated_at||rec.updated_at; cache[S(row.project_id)]=rec;});
      writeCache();
    }
    loaded=true;
  }
  async function saveSmart(projectId,rec){
    const c=client(); if(!c) throw new Error('Supabase غير متصل، لا يمكن الحفظ.');
    const payload=normalize({...rec,updated_at:new Date().toISOString()});
    const res=await c.from(TABLE).upsert({project_id:S(projectId),payload,updated_at:new Date().toISOString()},{onConflict:'project_id'}).select('project_id,payload,updated_at').single();
    if(res.error) throw new Error(res.error.message||'فشل الحفظ في Supabase');
    const saved=normalize(res.data.payload||payload); saved.updated_at=res.data.updated_at||saved.updated_at; putRecord(projectId,saved); return saved;
  }

  function fillAnnualSelect(){const sel=$('csAnnualSelect'); if(!sel) return; sel.innerHTML=ANNUAL_OPTIONS.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');}
  function visitChips(kind,key,visits,done){visits=Math.max(0,N(visits)); done=new Set(A(done).map(Number)); if(!visits) return '<div class="contract-empty-v10">حدد عدد الزيارات حتى تظهر الأرقام.</div>'; return Array.from({length:visits},(_,i)=>{const no=i+1; return `<button type="button" class="visit-chip-v10 ${done.has(no)?'done':''}" ${readonlyMode?'disabled':''} onclick="${kind}('${esc(key)}',${no})">${no}</button>`;}).join('');}
  function collectCoreFromScreen(){
    const rec=normalize(currentRecord||getRecord(currentProjectId));
    CORE.forEach(item=>{const card=document.querySelector(`[data-v10103-contract="${item.key}"]`)||document.querySelector(`[data-v10-contract="${item.key}"]`); if(!card) return; const old=rec.contracts[item.key]||{}; const visits=Math.max(0,N(card.querySelector('[data-field="visits"]')?.value)); rec.contracts[item.key]={onUs:!!card.querySelector('[data-field="onUs"]')?.checked,company:S(card.querySelector('[data-field="company"]')?.value),phone:S(card.querySelector('[data-field="phone"]')?.value),start:S(card.querySelector('[data-field="start"]')?.value),end:S(card.querySelector('[data-field="end"]')?.value),visits,done:A(old.done).map(Number).filter(x=>x>0&&x<=visits),notes:S(card.querySelector('[data-field="notes"]')?.value)};});
    rec.association={name:S($('csAssocName')?.value||rec.association?.name),manager:S($('csAssocManager')?.value||rec.association?.manager),phone:S($('csAssocPhone')?.value||rec.association?.phone)};
    currentRecord=normalize(rec); putRecord(currentProjectId,currentRecord); return currentRecord;
  }
  function missing(row){const m=[]; if(!row.company)m.push('اسم الشركة'); if(!row.phone)m.push('رقم الشركة'); if(!row.start)m.push('من تاريخ'); if(!row.end)m.push('إلى تاريخ'); if(!N(row.visits))m.push('عدد الزيارات'); return m;}
  function renderCore(record){const box=$('contractCoreServices'); if(!box) return; box.classList.remove('three'); box.classList.add('contract-grid-v10'); box.innerHTML=CORE.map(item=>{const r=record.contracts[item.key]||{}; const miss=missing(r); return `<section class="contract-card-v10 ${r.onUs?'on-us':''}" data-v10103-contract="${item.key}" data-v10-contract="${item.key}"><div class="contract-card-head-v10"><h3>${esc(item.label)}</h3><label class="contract-switch-v10"><input type="checkbox" data-field="onUs" ${r.onUs?'checked':''} ${readonlyMode?'disabled':''} onchange="contractV10103RefreshCore()"><span>العقد علينا</span></label></div><div class="contract-fields-v10 ${r.onUs?'':'muted-off'}"><div><label>اسم الشركة</label><input data-field="company" value="${esc(r.company)}" ${readonlyMode?'disabled':''}></div><div><label>رقم الشركة</label><input data-field="phone" value="${esc(r.phone)}" ${readonlyMode?'disabled':''}></div><div><label>من تاريخ</label><input type="date" data-field="start" value="${esc(r.start)}" ${readonlyMode?'disabled':''}></div><div><label>إلى تاريخ</label><input type="date" data-field="end" value="${esc(r.end)}" ${readonlyMode?'disabled':''}></div><div><label>عدد الزيارات</label><input type="number" min="0" data-field="visits" value="${esc(r.visits)}" ${readonlyMode?'disabled':''} onchange="contractV10103RefreshCore()"></div><div><label>ملاحظات</label><input data-field="notes" value="${esc(r.notes)}" ${readonlyMode?'disabled':''}></div></div><div class="visit-row-v10">${visitChips('contractV10103ToggleCoreVisit',item.key,r.visits,r.done)}</div>${r.onUs&&miss.length?`<div class="contract-warning-v10">ناقص: ${esc(miss.join('، '))}</div>`:''}</section>`;}).join('');}
  function renderAnnual(record){fillAnnualSelect(); const body=$('csAnnualBody'); if(!body) return; if($('csAssocName')) $('csAssocName').value=record.association?.name||''; if($('csAssocManager')) $('csAssocManager').value=record.association?.manager||''; if($('csAssocPhone')) $('csAssocPhone').value=record.association?.phone||''; body.innerHTML=A(record.annual).map(item=>`<tr><td><b>${esc(item.name)}</b>${item.notes?`<br><small>${esc(item.notes)}</small>`:''}</td><td>${N(item.visits)}</td><td><div class="visit-row-v10">${visitChips('contractV10103ToggleAnnualVisit',item.id,item.visits,item.done)}</div></td><td>${A(item.done).length}</td><td>${Math.max(0,N(item.visits)-A(item.done).length)}</td><td>${readonlyMode?'-':`<button class="danger" onclick="contractV10103DeleteAnnual('${esc(item.id)}')">حذف</button>`}</td></tr>`).join('')||'<tr><td colspan="6">لا توجد خدمات سنوية بعد</td></tr>';}
  function renderReport(record){const box=$('csClientReportBox'); if(!box) return; const p=projectById(currentProjectId)||{}; const coreRows=CORE.map(item=>{const r=record.contracts[item.key]||{}; if(!r.onUs&&!r.company&&!r.phone&&!r.start&&!r.end&&!N(r.visits)) return ''; return `<tr><td>${esc(item.label)}</td><td>${esc(r.company||'-')}</td><td>${esc(r.phone||'-')}</td><td>${esc(r.start||'-')}</td><td>${esc(r.end||'-')}</td><td>${A(r.done).length} / ${N(r.visits)}</td></tr>`;}).filter(Boolean).join(''); const annualRows=A(record.annual).map(a=>`<tr><td>${esc(a.name)}</td><td colspan="4">خدمة سنوية</td><td>${A(a.done).length} / ${N(a.visits)}</td></tr>`).join(''); box.innerHTML=`<div class="smart-box"><b>المشروع:</b> ${esc(p.name||'-')}</div><table class="smart-report-table"><thead><tr><th>القسم / الخدمة</th><th>الشركة</th><th>رقم الشركة</th><th>من</th><th>إلى</th><th>التنفيذ</th></tr></thead><tbody>${coreRows||'<tr><td colspan="6">لا توجد بيانات عقود</td></tr>'}${annualRows}</tbody></table>`;}
  function renderModalAll(){const rec=normalize(currentRecord||getRecord(currentProjectId)); currentRecord=rec; renderCore(rec); renderAnnual(rec); renderReport(rec);}

  window.contractV10103RefreshCore=function(){currentRecord=collectCoreFromScreen(); renderCore(currentRecord); renderReport(currentRecord);};
  window.contractV10103ToggleCoreVisit=function(key,no){if(readonlyMode) return; currentRecord=collectCoreFromScreen(); const r=currentRecord.contracts[key]; if(!r) return; const set=new Set(A(r.done).map(Number)); const n=Number(no); if(set.has(n)) set.delete(n); else set.add(n); r.done=[...set].sort((a,b)=>a-b); putRecord(currentProjectId,currentRecord); renderCore(currentRecord); renderReport(currentRecord);};
  window.addContractAnnualService=function(){if(readonlyMode) return; currentRecord=collectCoreFromScreen(); let name=S($('csAnnualCustom')?.value)||S($('csAnnualSelect')?.value); const visits=Math.max(1,N($('csAnnualVisits')?.value||1)); if(!name){say('اختر الخدمة أو اكتب اسمها','err'); return;} currentRecord.annual.push({id:'a'+Date.now()+Math.random().toString(16).slice(2),name,visits,done:[],notes:''}); putRecord(currentProjectId,currentRecord); if($('csAnnualCustom')) $('csAnnualCustom').value=''; if($('csAnnualVisits')) $('csAnnualVisits').value='1'; renderAnnual(currentRecord); renderReport(currentRecord);};
  window.contractV10103ToggleAnnualVisit=function(id,no){if(readonlyMode) return; currentRecord=collectCoreFromScreen(); const item=A(currentRecord.annual).find(x=>S(x.id)===S(id)); if(!item) return; const set=new Set(A(item.done).map(Number)); const n=Number(no); if(set.has(n)) set.delete(n); else set.add(n); item.done=[...set].sort((a,b)=>a-b); putRecord(currentProjectId,currentRecord); renderAnnual(currentRecord); renderReport(currentRecord);};
  window.contractV10103DeleteAnnual=function(id){if(readonlyMode) return; if(!confirm('حذف هذه الخدمة السنوية؟')) return; currentRecord=collectCoreFromScreen(); currentRecord.annual=A(currentRecord.annual).filter(x=>S(x.id)!==S(id)); putRecord(currentProjectId,currentRecord); renderAnnual(currentRecord); renderReport(currentRecord);};
  // Aliases for old inline buttons if any remain.
  window.contractV10RefreshCore=window.contractV10103RefreshCore;
  window.contractV10ToggleCoreVisit=window.contractV10103ToggleCoreVisit;
  window.contractV10ToggleAnnualVisit=window.contractV10103ToggleAnnualVisit;
  window.contractV10DeleteAnnual=window.contractV10103DeleteAnnual;

  window.openContractSmartModal=async function(projectId,mode){
    try{await loadSmart();}catch(e){console.error(VERSION,e); say(e.message||e,'err');}
    currentProjectId=S(projectId); readonlyMode=mode==='view'; currentRecord=getRecord(projectId);
    if($('contractSmartProjectId')) $('contractSmartProjectId').value=currentProjectId;
    const p=projectById(projectId)||{}; if($('contractSmartTitle')) $('contractSmartTitle').textContent=(readonlyMode?'عرض عقود: ':'تعديل عقود: ')+(p.name||''); if($('contractSmartSub')) $('contractSmartSub').textContent='العقود والخدمات السنوية تحفظ مباشرة في Supabase';
    const save=$('contractSmartSaveBtn'); if(save){save.style.display=readonlyMode?'none':''; save.onclick=window.saveContractSmartModal; save.textContent='حفظ';}
    renderModalAll();
    document.querySelectorAll('.contract-smart-tabs button').forEach(b=>b.classList.remove('active'));
    document.querySelector('.contract-smart-tabs button')?.classList.add('active');
    ['Main','Annual','Report'].forEach(name=>$('contractSmart'+name+'Tab')?.classList.toggle('hidden',name!=='Main'));
    const modal=$('contractSmartModal'); if(modal){document.body.appendChild(modal); modal.classList.remove('hidden'); modal.style.display='flex';}
    document.body.style.overflow='hidden';
  };
  window.closeContractSmartModal=function(){const modal=$('contractSmartModal'); if(modal){modal.classList.add('hidden'); modal.style.display='';} document.body.style.overflow=''; currentProjectId=''; readonlyMode=false; currentRecord=null;};
  window.contractSmartBackdrop=function(ev){if(ev&&ev.target&&ev.target.id==='contractSmartModal') window.closeContractSmartModal();};
  window.contractSmartTab=function(tab,btn){currentRecord=collectCoreFromScreen(); ['main','annual','report'].forEach(name=>$('contractSmart'+name.charAt(0).toUpperCase()+name.slice(1)+'Tab')?.classList.add('hidden')); $('contractSmart'+tab.charAt(0).toUpperCase()+tab.slice(1)+'Tab')?.classList.remove('hidden'); document.querySelectorAll('.contract-smart-tabs button').forEach(b=>b.classList.remove('active')); btn?.classList.add('active'); if(tab==='annual') renderAnnual(currentRecord); if(tab==='report') renderReport(currentRecord);};
  window.saveContractSmartModal=async function(){
    if(!currentProjectId){say('لم يتم تحديد المشروع','err'); return;}
    const btn=$('contractSmartSaveBtn'); const old=btn?btn.textContent:'حفظ';
    try{if(btn){btn.disabled=true; btn.textContent='جاري الحفظ...';}
      currentRecord=collectCoreFromScreen();
      // إذا اختار خدمة ولم يضغط إضافة نحفظها أيضًا.
      const pending=S($('csAnnualCustom')?.value)||S($('csAnnualSelect')?.value&&window.__tasneefAnnualTouchedV10103?$('csAnnualSelect')?.value:'');
      if(pending){const visits=Math.max(1,N($('csAnnualVisits')?.value||1)); currentRecord.annual.push({id:'a'+Date.now()+Math.random().toString(16).slice(2),name:pending,visits,done:[],notes:''}); if($('csAnnualCustom')) $('csAnnualCustom').value=''; if($('csAnnualVisits')) $('csAnnualVisits').value='1';}
      const saved=await saveSmart(currentProjectId,currentRecord);
      currentRecord=saved; renderModalAll(); renderContracts(); renderSmartAlerts(); say('تم حفظ الخدمات والعقود بنجاح','ok');
    }catch(e){console.error(VERSION,e); say('فشل حفظ الخدمات والعقود: '+(e.message||e),'err');}
    finally{if(btn){btn.disabled=false; btn.textContent=old;}}
  };
  ['csAnnualSelect','csAnnualCustom','csAnnualVisits'].forEach(id=>document.addEventListener('input',e=>{if(e.target&&e.target.id===id) window.__tasneefAnnualTouchedV10103=true;},true));
  ['csAnnualSelect','csAnnualCustom','csAnnualVisits'].forEach(id=>document.addEventListener('change',e=>{if(e.target&&e.target.id===id) window.__tasneefAnnualTouchedV10103=true;},true));

  function alertsForProject(p,rec){const arr=[]; CORE.forEach(item=>{const r=rec.contracts[item.key]; if(!r) return; if(r.onUs){const m=missing(r); if(m.length) arr.push({group:item.label,project:p.name||'-',text:'بيانات ناقصة: '+m.join('، ')}); const rem=Math.max(0,N(r.visits)-A(r.done).length); if(N(r.visits)&&rem) arr.push({group:item.label,project:p.name||'-',text:`متبقي ${rem} زيارة من ${N(r.visits)}`});}}); A(rec.annual).forEach(a=>{const rem=Math.max(0,N(a.visits)-A(a.done).length); if(rem) arr.push({group:'خدمات سنوية',project:p.name||'-',text:`${a.name}: متبقي ${rem} من ${N(a.visits)}`});}); return arr;}
  window.renderSmartAlerts=function(){const host=$('contractsAlertsList'); if(!host) return; const alerts=[]; projects().forEach(p=>alerts.push(...alertsForProject(p,getRecord(p.id)))); const grouped=new Map(); alerts.forEach(a=>{if(!grouped.has(a.group)) grouped.set(a.group,[]); grouped.get(a.group).push(a);}); host.innerHTML=[...grouped.entries()].map(([g,rows])=>`<div class="alert-item warn contract-alert-group-v10"><b>${esc(g)}</b>${rows.slice(0,12).map(r=>`<div><strong>${esc(r.project)}</strong>: ${esc(r.text)}</div>`).join('')}</div>`).join('');};
  window.renderContracts=function(){const body=$('contractsBody'); if(!body) return; const q=S($('contractSearch')?.value); const status=S($('contractFilterStatus')?.value); let rows=projects(); if(q) rows=rows.filter(p=>[p.name,p.location].join(' ').includes(q)); if(status) rows=rows.filter(p=>contractInfo(p).key===status); rows.sort((a,b)=>(daysLeft(a.contract_end)??999999)-(daysLeft(b.contract_end)??999999)); body.innerHTML=rows.map(p=>{const info=contractInfo(p); return `<tr><td><b>${esc(p.name)}</b></td><td>${N(p.buildings_count)}</td><td>${N(p.units_count)}</td><td>${esc(iso(p.contract_start)||'-')}</td><td>${esc(iso(p.contract_end)||'-')}</td><td>${esc(info.days)}</td><td><span class="badge ${esc(info.cls)}">${esc(info.text)}</span></td><td class="row-actions"><button class="light" onclick="openContractSmartModal('${esc(p.id)}','view')">عرض</button><button onclick="openContractSmartModal('${esc(p.id)}','edit')">تعديل</button></td></tr>`;}).join('')||'<tr><td colspan="8">لا توجد بيانات</td></tr>'; if($('contractsActiveCount')) $('contractsActiveCount').textContent=projects().filter(p=>contractInfo(p).key==='active').length; if($('contractsSoonCount')) $('contractsSoonCount').textContent=projects().filter(p=>contractInfo(p).key==='soon').length; if($('contractsExpiredCount')) $('contractsExpiredCount').textContent=projects().filter(p=>contractInfo(p).key==='expired').length; window.renderSmartAlerts();};
  window.exportContractsCSV=function(){const rows=[['المشروع','العمائر','الشقق','بداية العقد','نهاية العقد','الأيام المتبقية','الحالة']]; projects().forEach(p=>{const i=contractInfo(p); rows.push([p.name||'',N(p.buildings_count),N(p.units_count),iso(p.contract_start),iso(p.contract_end),i.days,i.text]);}); const csv=rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\n'); if(typeof window.download==='function') window.download('contracts.csv',csv); else {const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='contracts.csv'; a.click();}};

  function installCss(){if($('contractCoreV10103Css')) return; const st=document.createElement('style'); st.id='contractCoreV10103Css'; st.textContent=`#contractSmartModal.contract-smart-modal{position:fixed!important;inset:0!important;z-index:999999!important;display:flex;align-items:center;justify-content:center;background:rgba(8,31,25,.62)!important;padding:18px!important}#contractSmartModal.contract-smart-modal.hidden{display:none!important}#contractSmartModal .contract-smart-panel{width:min(1260px,96vw)!important;max-height:92vh!important;overflow:auto!important;background:#fff!important;border-radius:24px!important;box-shadow:0 30px 90px rgba(0,0,0,.28)!important}.contract-grid-v10{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(270px,1fr))!important;gap:12px!important}.contract-card-v10{border:1px solid #d9e8e1;border-radius:14px;background:#fff;padding:12px}.contract-card-v10.on-us{border-color:#86cdb5;background:#fbfffd}.contract-card-head-v10{display:flex;align-items:center;justify-content:space-between;gap:10px}.contract-card-head-v10 h3{margin:0;color:#063f32}.contract-switch-v10{display:inline-flex;align-items:center;gap:7px;margin:0;color:#063f32;font-weight:800}.contract-switch-v10 input{width:auto}.contract-fields-v10{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.contract-fields-v10.muted-off{opacity:.42}.visit-row-v10{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.visit-chip-v10{min-width:34px;height:34px;border-radius:10px;background:#eef6f3!important;color:#064c3b!important;border:1px solid #d7e8e1!important;padding:0 8px!important}.visit-chip-v10.done{background:#064c3b!important;color:#fff!important;border-color:#064c3b!important}.contract-warning-v10{margin-top:10px;border:1px solid #f0c3c3;background:#fdecec;color:#9d2222;border-radius:10px;padding:8px;font-weight:800}.contract-empty-v10{border:1px dashed #d7e8e1;border-radius:10px;padding:8px;color:#60706a;background:#fbfdfc}.contract-alert-group-v10 div{margin-top:6px;line-height:1.7}@media(max-width:760px){.contract-fields-v10{grid-template-columns:1fr}}`; document.head.appendChild(st);}
  async function boot(){installCss(); fillAnnualSelect(); try{await loadSmart();}catch(e){console.warn(VERSION,e);} try{renderContracts();}catch(e){console.warn(VERSION,e);}}
  const oldShowPage=window.showPage; window.showPage=function(id,btn){if(id!=='contracts') window.closeContractSmartModal?.(); const r=oldShowPage?oldShowPage.apply(this,arguments):undefined; if(id==='contracts') setTimeout(()=>renderContracts(),80); return r;};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else setTimeout(boot,0);
  window.addEventListener('load',()=>setTimeout(boot,500),{once:true});
  console.log('Loaded '+VERSION);
})();

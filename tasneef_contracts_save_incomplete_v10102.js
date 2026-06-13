/* Tasneef v10102 - Contracts Save Incomplete Fields Fix
   Scope: قسم الخدمات والعقود فقط.
   الهدف: حفظ البيانات حتى لو ناقصة، مع منع حفظ سجل فارغ فوق بيانات محفوظة.
   لا يلمس المالية أو المخزون أو التكتات أو الأوقات الشهرية.
*/
(function(){
  'use strict';
  if(window.__tasneefContractsSaveIncompleteV10102) return;
  window.__tasneefContractsSaveIncompleteV10102=true;

  const VERSION='v10102-contracts-save-incomplete-fields-fix';
  const TABLE='project_contract_smart';
  const LS_KEY='tasneef_contract_smart_v299';
  const CORE=[
    {key:'elevators',label:'مصاعد'},
    {key:'pools',label:'مسابح'},
    {key:'civilDefense',label:'دفاع مدني'}
  ];
  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const N=v=>{const x=Number(v);return Number.isFinite(x)?x:0;};
  const client=()=>window.sb||window.supabaseClient||window.supabase||null;
  const say=(t,type)=>{try{if(typeof window.msg==='function') return window.msg(t,type);}catch(_){ } alert(t);};
  const pid=()=>S($('contractSmartProjectId')?.value||window.__tasneefActiveContractProjectId||'');

  function emptyRecord(){
    const contracts={};
    CORE.forEach(x=>contracts[x.key]={onUs:false,company:'',phone:'',start:'',end:'',visits:0,done:[],notes:''});
    return {contracts,annual:[],association:{name:'',manager:'',phone:''},updated_at:null};
  }
  function normalize(raw){
    const base=emptyRecord(); raw=raw||{};
    const oldContracts=raw.contracts||raw.core||{};
    CORE.forEach(x=>{
      const r=oldContracts[x.key]||{};
      base.contracts[x.key]={
        onUs:!!(r.onUs??r.on_us),
        company:S(r.company||r.company_name),
        phone:S(r.phone||r.company_phone),
        start:S(r.start||r.from||r.contract_start),
        end:S(r.end||r.to||r.contract_end),
        visits:Math.max(0,N(r.visits||r.visit_count)),
        done:A(r.done).map(Number).filter(Boolean),
        notes:S(r.notes)
      };
    });
    base.annual=A(raw.annual).map(a=>({
      id:S(a.id)||('a'+Date.now()+Math.random().toString(16).slice(2)),
      name:S(a.name),
      visits:Math.max(1,N(a.visits||a.visit_count||1)),
      done:A(a.done).map(Number).filter(Boolean),
      notes:S(a.notes)
    })).filter(a=>a.name);
    const assoc=raw.association||raw.assoc||{};
    base.association={name:S(assoc.name||raw.assoc_name),manager:S(assoc.manager||raw.assoc_manager),phone:S(assoc.phone||raw.assoc_phone)};
    base.updated_at=raw.updated_at||null;
    return base;
  }
  function hasUsefulData(rec){
    rec=normalize(rec);
    const hasCore=CORE.some(x=>{const r=rec.contracts[x.key]||{}; return r.onUs||r.company||r.phone||r.start||r.end||N(r.visits)||A(r.done).length||r.notes;});
    const hasAnnual=A(rec.annual).some(a=>a.name||N(a.visits)>1||A(a.done).length||a.notes);
    const hasAssoc=!!(rec.association?.name||rec.association?.manager||rec.association?.phone);
    return hasCore||hasAnnual||hasAssoc;
  }
  function readLS(){try{return JSON.parse(localStorage.getItem(LS_KEY)||'{}')||{};}catch(_){return {};}}
  function writeLS(projectId, rec){try{const all=readLS(); all[S(projectId)]=normalize(rec); localStorage.setItem(LS_KEY,JSON.stringify(all));}catch(_){}}
  function localRecord(projectId){return normalize(readLS()[S(projectId)]||{});}

  async function fetchRemote(projectId){
    const c=client(); if(!c) return null;
    const res=await c.from(TABLE).select('project_id,payload,updated_at').eq('project_id',S(projectId)).maybeSingle();
    if(res.error) throw new Error(res.error.message||'فشل قراءة بيانات العقود');
    if(!res.data) return null;
    const rec=normalize(res.data.payload||{}); rec.updated_at=res.data.updated_at||rec.updated_at; return rec;
  }
  async function saveRemote(projectId, rec){
    const c=client(); if(!c) throw new Error('Supabase غير متصل، لا يمكن الحفظ.');
    const payload=normalize({...rec,updated_at:new Date().toISOString()});
    const res=await c.from(TABLE)
      .upsert({project_id:S(projectId),payload,updated_at:new Date().toISOString()},{onConflict:'project_id'})
      .select('project_id,payload,updated_at')
      .maybeSingle();
    if(res.error) throw new Error(res.error.message||'فشل الحفظ في Supabase');
    if(!res.data) throw new Error('لم يرجع Supabase تأكيد الحفظ.');
    const saved=normalize(res.data.payload||payload); saved.updated_at=res.data.updated_at||saved.updated_at; return saved;
  }

  function collectCurrentRecord(projectId, base){
    const rec=normalize(base||localRecord(projectId));
    CORE.forEach(item=>{
      const card=document.querySelector(`[data-v10-contract="${item.key}"]`) || document.querySelector(`[data-contract-key="${item.key}"]`);
      const prev=rec.contracts[item.key]||{};
      if(card){
        const visits=Math.max(0,N(card.querySelector('[data-field="visits"]')?.value));
        rec.contracts[item.key]={
          onUs:!!card.querySelector('[data-field="onUs"]')?.checked,
          company:S(card.querySelector('[data-field="company"]')?.value),
          phone:S(card.querySelector('[data-field="phone"]')?.value),
          start:S(card.querySelector('[data-field="start"]')?.value),
          end:S(card.querySelector('[data-field="end"]')?.value),
          visits,
          done:A(prev.done).map(Number).filter(x=>x>0&&x<=visits),
          notes:S(card.querySelector('[data-field="notes"]')?.value)
        };
      }
    });
    rec.association={
      name:S($('csAssocName')?.value||rec.association?.name),
      manager:S($('csAssocManager')?.value||rec.association?.manager),
      phone:S($('csAssocPhone')?.value||rec.association?.phone)
    };

    // إذا المستخدم اختار خدمة سنوية ولم يضغط زر إضافة، احفظها عند الضغط على حفظ.
    const custom=S($('csAnnualCustom')?.value);
    const selected=S($('csAnnualSelect')?.value);
    const visitsRaw=S($('csAnnualVisits')?.value);
    const touched=window.__tasneefAnnualTouchedV10102===true || !!custom || (visitsRaw && visitsRaw!=='1');
    const pendingName=custom || (touched ? selected : '');
    if(pendingName){
      const visits=Math.max(1,N(visitsRaw||1));
      const exists=A(rec.annual).some(a=>S(a.name)===pendingName && N(a.visits)===visits);
      if(!exists) rec.annual.push({id:'a'+Date.now()+Math.random().toString(16).slice(2),name:pendingName,visits,done:[],notes:''});
      if($('csAnnualCustom')) $('csAnnualCustom').value='';
      if($('csAnnualVisits')) $('csAnnualVisits').value='1';
      window.__tasneefAnnualTouchedV10102=false;
    }
    return normalize(rec);
  }

  function attachAnnualTouchWatch(){
    ['csAnnualSelect','csAnnualCustom','csAnnualVisits'].forEach(id=>{
      const el=$(id); if(!el || el.dataset.v10102Touch) return;
      el.dataset.v10102Touch='1';
      el.addEventListener('change',()=>{window.__tasneefAnnualTouchedV10102=true;});
      el.addEventListener('input',()=>{window.__tasneefAnnualTouchedV10102=true;});
    });
  }

  const oldOpen=window.openContractSmartModal;
  window.openContractSmartModal=async function(projectId, mode){
    window.__tasneefActiveContractProjectId=S(projectId);
    if($('contractSmartProjectId')) $('contractSmartProjectId').value=S(projectId);
    const result=oldOpen? await oldOpen.apply(this,arguments) : undefined;
    setTimeout(attachAnnualTouchWatch,80);
    return result;
  };

  const oldAddAnnual=window.addContractAnnualService;
  window.addContractAnnualService=function(){
    window.__tasneefAnnualTouchedV10102=false;
    return oldAddAnnual? oldAddAnnual.apply(this,arguments) : undefined;
  };

  window.saveContractSmartModal=async function(){
    const projectId=pid();
    if(!projectId){say('لم يتم تحديد المشروع، لا يمكن الحفظ.','err'); return;}
    const btn=$('contractSmartSaveBtn'); const oldText=btn?btn.textContent:'';
    try{
      if(btn){btn.disabled=true; btn.textContent='جاري الحفظ...';}
      const remote=await fetchRemote(projectId).catch(()=>null);
      const rec=collectCurrentRecord(projectId, remote||localRecord(projectId));

      // يحفظ الناقص، لكن لا يسمح بسجل فارغ تمامًا يمسح بيانات موجودة.
      if(!hasUsefulData(rec) && hasUsefulData(remote)){
        throw new Error('تم منع حفظ سجل فارغ فوق بيانات محفوظة. افتح المشروع مرة أخرى ثم عدّل البيانات.');
      }
      if(!hasUsefulData(rec)){
        throw new Error('لا توجد أي بيانات للحفظ. اكتب أي قيمة في العقد أو أضف خدمة سنوية ثم اضغط حفظ.');
      }

      const saved=await saveRemote(projectId, rec);
      writeLS(projectId,saved);
      say('تم حفظ الخدمات والعقود في Supabase بنجاح','ok');
      try{ if(typeof window.renderContracts==='function') window.renderContracts(); }catch(_){ }
      try{ if(typeof window.renderSmartAlerts==='function') window.renderSmartAlerts(); }catch(_){ }
    }catch(e){
      console.error(VERSION,e);
      say('فشل حفظ الخدمات والعقود: '+(e.message||e),'err');
    }finally{
      if(btn){btn.disabled=false; btn.textContent=oldText||'حفظ';}
    }
  };

  window.addEventListener('load',()=>setTimeout(attachAnnualTouchWatch,1000));
  console.log('Loaded '+VERSION);
})();

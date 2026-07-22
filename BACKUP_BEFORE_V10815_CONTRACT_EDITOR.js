/*
 * Tasneef ContractsServicesEditor V10814
 * Restores the contracts/services editor only inside #contracts.
 * Lazy-loads a single project's smart contracts, annual services, attachments and audit trail.
 */
(function(){
  'use strict';
  if(window.__tasneefContractsServicesEditorV10807) return;
  window.__tasneefContractsServicesEditorV10807=true;
  window.TASNEEF_BUILD='V10814_CONTRACT_ACTOR_ID_TYPE_FIX_R2';

  const VERSION='V10814-R2';
  const MODAL_ID='contractsServicesEditorV10807';
  const LS_KEY='tasneef_contract_smart_v299';
  const CONTRACT_FILES_BUCKET='contract-files';
  const CONTRACT_FILE_MAX=10*1024*1024;
  const CONTRACT_FILE_TYPES=new Set(['application/pdf','image/jpeg','image/png']);
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const N=v=>{const n=Number(v??0);return Number.isFinite(n)?n:0;};
  const ID=v=>{const x=S(v);if(!x)throw new Error('معرف السجل غير صالح');return x;};
  const safeUserId=v=>/^\d+$/.test(S(v))?S(v):null;
  const E=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=v=>JSON.parse(JSON.stringify(v??null));
  const nowIso=()=>new Date().toISOString();
  const dateOnly=v=>S(v).slice(0,10);
  const globalData=()=>window.data||(typeof data!=='undefined'?data:{});
  const client=()=>window.sb||(typeof sb!=='undefined'?sb:null);
  const getUser=()=>{try{return typeof session==='function'?(session()||{}):JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return {};}};
  const role=()=>S(getUser().role||getUser().role_key);
  const parsePerms=()=>{let p=getUser().permissions||{};if(typeof p==='string'){try{p=JSON.parse(p||'{}')}catch(_){p={}}}return p||{};};
  const hasExplicit=(...keys)=>{const p=parsePerms();return keys.some(k=>p[k]===true||p[k]==='allow'||p[k]===1);};
  const isFullManager=()=>['admin','system_admin','general_manager'].includes(role());
  const isOperations=()=>role()==='operations_manager';
  const isFinancial=()=>role()==='financial_manager';
  const canEditAll=()=>isFullManager()||isOperations()||hasExplicit('contracts.manage','contracts.update','contracts_services.update','contracts.edit');
  const canEditFinance=()=>isFullManager()||isFinancial()||hasExplicit('contracts.financial.update','contracts_finance.update','contracts.value.update');
  const canArchive=()=>isFullManager()||hasExplicit('contracts.archive','contracts_services.archive');
  const canManageAttachments=()=>isFullManager()||isOperations()||hasExplicit('contracts.attachments.manage','contracts_attachments.manage');
  const canAdminExecuted=()=>isFullManager()||hasExplicit('contracts.executed.override');
  const canRenew=()=>isFullManager()||hasExplicit('contracts.renew');
  const canNonRenew=()=>isFullManager()||hasExplicit('contracts.non_renew');
  const canStopFromContract=()=>isFullManager()||hasExplicit('projects.stop_from_contract');

  const CONTRACT_DEFS=[
    {key:'operation',title:'عقد التشغيل الأساسي',provider:'الجهة المتعاقدة',asset:'عدد المباني/الوحدات',scope:'نطاق التشغيل'},
    {key:'elevators',title:'عقد المصاعد',provider:'اسم شركة المصاعد',asset:'عدد المصاعد',scope:'الخدمات المشمولة'},
    {key:'pools',title:'عقد المسابح',provider:'اسم مقدم الخدمة',asset:'عدد المسابح',scope:'المواد والخدمات المشمولة'},
    {key:'civilDefense',title:'عقد الدفاع المدني',provider:'اسم الشركة',asset:'عدد الأنظمة/المواقع',scope:'الأنظمة المشمولة'},
    {key:'cleaning',title:'عقد النظافة',provider:'اسم مقدم الخدمة',asset:'عدد المواقع',scope:'نطاق النظافة'},
    {key:'maintenance',title:'عقد الصيانة',provider:'اسم مقدم الخدمة',asset:'عدد المواقع/الأصول',scope:'نطاق الصيانة'}
  ];
  const DEFAULT_ANNUAL=['غسيل الخزانات','مكافحة الحشرات','تنظيف الواجهات','صيانة المصاعد','صيانة الدفاع المدني','صيانة المسابح','فحص المضخات','صيانة الكاميرات','التشجير','خدمة أخرى'];

  const state={
    open:false,loading:false,saving:false,dirty:false,projectId:null,project:null,smartRow:null,rawPayload:{},model:null,baseline:null,
    services:[],attachments:[],audit:[],contractRows:[],mode:'view',showArchived:false,lastError:'',closePending:false,
    renewal:null,nonRenew:null,serviceExecution:null,alertsLoading:false
  };

  function toast(text,type='ok'){
    let t=$('csEditorToastV10807');
    if(!t){t=document.createElement('div');t.id='csEditorToastV10807';t.className='cs-editor-toast hidden';document.body.appendChild(t);}
    t.textContent=text;t.className='cs-editor-toast '+(type==='error'?'error':'');
    clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.add('hidden'),4500);
  }
  function setStatus(text,type=''){
    const el=$('csEditorStatusV10807');if(!el)return;el.textContent=text||'';el.className='cs-editor-status '+type;
  }
  function friendlyError(error){
    const raw=S(error?.message||error);
    console.error('[ContractsServicesEditor '+VERSION+']',error);
    if(/operator does not exist:\s*(text|bigint)\s*=\s*(text|bigint)|invalid input syntax for type bigint|column\s+"?[^"]+"?\s+is of type\s+[^\s]+\s+but expression is of type\s+[^\s]+|42804|22P02|42883/i.test(raw))return 'تعذر حفظ التعديلات بسبب عدم تطابق معرف السجل. يرجى تحديث البيانات ثم إعادة المحاولة.';
    if(/PGRST202|Could not find the function|function .* does not exist|schema cache|bucket not found|storage.*policy|row-level security/i.test(raw))return 'تحديث قاعدة بيانات العقود والتخزين مطلوب. شغّل ملف SQL المرفق ثم أعد المحاولة.';
    return raw||'تعذر تنفيذ العملية. حاول مرة أخرى.';
  }
  function projectList(){return globalData().projects||[];}
  function projectById(id){return projectList().find(p=>S(p.id)===S(id))||null;}
  function supervisorOwns(project){const u=getUser();return role()==='supervisor'&&S(project?.supervisor_id)===S(u.id);}
  function canViewProject(project){
    if(['admin','general_manager','financial_manager','operations_manager','warehouse_manager'].includes(role())) return true;
    if(role()==='supervisor') return supervisorOwns(project)||hasExplicit('contracts.view_all','contracts.view');
    return hasExplicit('contracts.view','contracts.manage');
  }
  function canEditProject(project){
    if(canEditAll()) return true;
    return role()==='supervisor'&&supervisorOwns(project)&&hasExplicit('contracts.update','contracts_services.update','contracts.edit');
  }
  function isEditable(){return state.mode==='edit'&&canEditProject(state.project);}

  function readLegacyLocal(projectId){
    try{const all=JSON.parse(localStorage.getItem(LS_KEY)||'{}')||{};return clone(all[S(projectId)]||{});}catch(_){return {};}
  }
  function writeLegacyLocal(projectId,payload){
    try{const all=JSON.parse(localStorage.getItem(LS_KEY)||'{}')||{};all[S(projectId)]=clone(payload);localStorage.setItem(LS_KEY,JSON.stringify(all));}catch(_){ }
  }

  function emptyContract(){return {enabled:false,provider:'',contract_number:'',start_date:'',end_date:'',asset_count:0,visits:0,value:0,status:'',contact_name:'',phone:'',certificate_number:'',certificate_end_date:'',scope:'',notes:'',attachment:''};}
  function mapLegacyCore(old,existing){
    const x=old||{},c=Object.assign(emptyContract(),existing||{});
    if(c.enabled===false&&x.onUs!=null)c.enabled=!!x.onUs;
    if(!c.provider)c.provider=S(x.company);
    if(!c.phone)c.phone=S(x.phone);
    if(!c.attachment)c.attachment=S(x.attachment);
    if(!c.notes)c.notes=S(x.notes);
    if(!c.visits)c.visits=N(x.visits);
    c.done=Array.isArray(x.done)?clone(x.done):(Array.isArray(c.done)?c.done:[]);
    return c;
  }
  function normalizeSmart(payload,project){
    const raw=clone(payload)||{};
    const contracts=raw.contracts||{};
    const operation=Object.assign(emptyContract(),contracts.operation||{});
    operation.enabled=true;
    operation.provider=operation.provider||S(raw.association?.name);
    operation.start_date=operation.start_date||dateOnly(project?.contract_start||project?.project_start_date||project?.start_date);
    operation.end_date=operation.end_date||dateOnly(project?.contract_end||project?.project_end_date||project?.end_date);
    operation.asset_count=operation.asset_count||N(project?.buildings_count||project?.units_count);
    const model={
      association:Object.assign({name:'',manager:'',phone:''},raw.association||{}),
      contracts:{
        operation,
        elevators:mapLegacyCore(raw.core?.elevators,contracts.elevators),
        pools:mapLegacyCore(raw.core?.pools,contracts.pools),
        civilDefense:mapLegacyCore(raw.core?.civilDefense,contracts.civilDefense),
        cleaning:Object.assign(emptyContract(),contracts.cleaning||{}),
        maintenance:Object.assign(emptyContract(),contracts.maintenance||{}),
        others:Array.isArray(contracts.others)?clone(contracts.others):[]
      },
      annualLegacy:Array.isArray(raw.annual)?clone(raw.annual):[],
      attachments:Array.isArray(raw.attachments)?clone(raw.attachments):[],
      archivedServiceIds:Array.isArray(raw.archived_service_ids)?raw.archived_service_ids.map(S):[],
      meta:Object.assign({},raw.meta||{})
    };
    return model;
  }
  function serializeSmart(model){
    const out=clone(state.rawPayload)||{};
    out.association=clone(model.association);
    out.contracts=clone(model.contracts);
    out.attachments=clone((model.attachments||[]).filter(x=>x.source==='smart_attachment'||!x.source).map(x=>({id:x.id,category:x.category||'عقد',name:x.name||'',url:x.url||x.file_url||'',notes:x.notes||'',is_archived:!!x.is_archived,archived_at:x.archived_at||null})));
    out.archived_service_ids=clone(model.archivedServiceIds||[]);
    const legacyAnnual=clone(model.annualLegacy||[]);
    const legacyMap=new Map(legacyAnnual.map((x,i)=>[S(x.id||('legacy_'+i)),x]));
    (model.annualServices||[]).filter(x=>x.source==='smart').forEach(x=>{
      const item={id:x.id,name:x.service_name,visits:N(x.visit_count),done:Array.from({length:Math.max(0,N(x.executed_count))},(_,i)=>i+1),notes:x.notes||'',frequency:x.frequency||'',start_date:x.start_date||'',end_date:x.end_date||'',last_execution_date:x.last_execution_date||'',next_due_date:x.next_due_date||'',status:x.status||'',is_archived:!!x.is_archived};
      if(legacyMap.has(S(x.id)))Object.assign(legacyMap.get(S(x.id)),item);else legacyAnnual.push(item);
    });
    out.annual=legacyAnnual;
    out.core=out.core||{};
    [['elevators','elevators'],['pools','pools'],['civilDefense','civilDefense']].forEach(([oldKey,newKey])=>{
      const c=model.contracts[newKey]||emptyContract();
      out.core[oldKey]=Object.assign({},out.core[oldKey]||{}, {onUs:!!c.enabled,visits:N(c.visits),company:c.provider||'',phone:c.phone||'',attachment:c.attachment||'',notes:c.notes||'',done:Array.isArray(c.done)?clone(c.done):[]});
    });
    out.meta=Object.assign({},out.meta||{},model.meta||{},{schema_version:VERSION,last_editor:'ContractsServicesEditor'});
    return out;
  }

  function ensureModal(){
    if($(MODAL_ID)) return;
    const wrap=document.createElement('div');wrap.id=MODAL_ID;wrap.className='cs-editor-modal hidden';
    wrap.innerHTML=`<div class="cs-editor-panel" role="dialog" aria-modal="true" aria-labelledby="csEditorTitleV10807">
      <div class="cs-editor-head"><div><h2 id="csEditorTitleV10807">إدارة عقود وخدمات المشروع</h2><p id="csEditorSubtitleV10807">تحميل بيانات المشروع...</p></div><div class="cs-editor-head-actions"><button class="cs-editor-btn light" data-action="reload">تحديث البيانات</button><button class="cs-editor-btn danger" data-action="close">إغلاق</button></div></div>
      <div class="cs-editor-summary" id="csEditorSummaryV10807"></div>
      <div class="cs-editor-tabs">
        <button class="cs-editor-tab active" data-tab="contracts">العقود</button><button class="cs-editor-tab" data-tab="annual">الخدمات السنوية</button><button class="cs-editor-tab" data-tab="attachments">المرفقات</button><button class="cs-editor-tab" data-tab="audit">سجل التعديلات</button>
      </div>
      <div class="cs-editor-body" id="csEditorBodyV10807"><div class="cs-editor-skeleton"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
      <div class="cs-editor-foot"><div class="cs-editor-foot-left"><input id="csEditorReasonV10807" class="cs-editor-save-reason" placeholder="سبب التعديل (إلزامي للتغييرات الحساسة)"/><span id="csEditorStatusV10807" class="cs-editor-status"></span></div><button id="csEditorSaveV10807" class="cs-editor-btn" data-action="save">حفظ التعديلات</button></div>
      <div class="cs-editor-guard hidden" id="csEditorGuardV10807"><div class="cs-editor-guard-card"><h3>توجد تعديلات غير محفوظة</h3><p>هل تريد إغلاق النافذة وفقد التعديلات الحالية؟</p><div class="cs-editor-guard-actions"><button class="cs-editor-btn danger" data-action="discard-close">إغلاق دون حفظ</button><button class="cs-editor-btn light" data-action="cancel-close">العودة للتعديل</button></div></div></div>
    </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click',onModalClick);
    wrap.addEventListener('input',onModalInput);
    wrap.addEventListener('change',onModalInput);
    wrap.addEventListener('click',e=>{if(e.target===wrap)requestClose();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.open)requestClose();});
  }
  function onModalClick(e){
    const action=e.target.closest('[data-action]')?.dataset.action;
    if(action==='close')requestClose();
    else if(action==='discard-close')forceClose();
    else if(action==='cancel-close')$('csEditorGuardV10807')?.classList.add('hidden');
    else if(action==='save')ContractsServicesEditor.saveContractChanges();
    else if(action==='reload')ContractsServicesEditor.openEditor(state.projectId,state.mode,true);
    else if(action==='add-service')addAnnualService();
    else if(action==='archive-service')archiveAnnualService(Number(e.target.closest('[data-service-index]')?.dataset.serviceIndex));
    else if(action==='restore-service')restoreAnnualService(Number(e.target.closest('[data-service-index]')?.dataset.serviceIndex));
    else if(action==='add-attachment')addAttachment();
    else if(action==='archive-attachment')archiveAttachment(Number(e.target.closest('[data-attachment-index]')?.dataset.attachmentIndex));
    else if(action==='open-storage-attachment')openStorageAttachment(Number(e.target.closest('[data-attachment-index]')?.dataset.attachmentIndex));
    else if(action==='add-other-contract')addOtherContract();
    else if(action==='remove-other-contract')removeOtherContract(Number(e.target.closest('[data-other-index]')?.dataset.otherIndex));
    else if(action==='renew-submit')submitRenewal();
    else if(action==='renew-cancel'){state.renewal=null;renderContractsPane();}
    else if(action==='nonrenew-confirm')confirmNonRenew();
    else if(action==='nonrenew-cancel')hideActionLayer();
    else if(action==='execute-service-confirm')confirmServiceExecution();
    else if(action==='execute-service-cancel')hideActionLayer();
    const tab=e.target.closest('[data-tab]')?.dataset.tab;if(tab)switchTab(tab);
  }
  function onModalInput(e){
    if(!state.open||state.loading)return;
    const t=e.target;
    if(t.matches('[data-contract-key][data-contract-field]')){
      const c=state.model.contracts[t.dataset.contractKey];if(c)c[t.dataset.contractField]=t.type==='checkbox'?t.checked:(t.type==='number'?N(t.value):t.value);
      markDirty();
    }else if(t.matches('[data-association-field]')){state.model.association[t.dataset.associationField]=t.value;markDirty();}
    else if(t.matches('[data-annual-index][data-annual-field]')){
      const row=state.model.annualServices[Number(t.dataset.annualIndex)];if(row){row[t.dataset.annualField]=t.type==='number'?N(t.value):t.value;row.remaining_count=Math.max(N(row.visit_count)-N(row.executed_count),0);const rem=$(`csRemain_${t.dataset.annualIndex}`);if(rem)rem.textContent=row.remaining_count;markDirty();}
    }else if(t.matches('[data-attachment-index][data-attachment-field]')){
      const row=state.model.attachments[Number(t.dataset.attachmentIndex)];if(row){row[t.dataset.attachmentField]=t.value;markDirty();}
    }else if(t.matches('[data-other-index][data-other-field]')){
      const row=state.model.contracts.others[Number(t.dataset.otherIndex)];if(row){row[t.dataset.otherField]=t.type==='number'?N(t.value):t.value;markDirty();}
    }else if(t.id==='csShowArchivedV10807'){state.showArchived=t.checked;renderAnnualPane();}
  }
  function markDirty(){state.dirty=true;setStatus('توجد تعديلات غير محفوظة');}

  function requestClose(){
    if(state.saving)return;
    if(state.dirty){$('csEditorGuardV10807')?.classList.remove('hidden');return;}
    forceClose();
  }
  function forceClose(){
    $(MODAL_ID)?.classList.add('hidden');$('csEditorGuardV10807')?.classList.add('hidden');document.body.style.overflow='';state.open=false;state.dirty=false;state.projectId=null;state.project=null;state.renewal=null;state.nonRenew=null;state.serviceExecution=null;hideActionLayer();
  }
  function switchTab(tab){
    document.querySelectorAll(`#${MODAL_ID} .cs-editor-tab`).forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    document.querySelectorAll(`#${MODAL_ID} .cs-editor-pane`).forEach(p=>p.classList.toggle('hidden',p.dataset.pane!==tab));
    if(tab==='audit')renderAuditPane();
  }

  async function safeSelect(table,build){
    const c=client();if(!c)return {data:[],error:{message:'Supabase client unavailable'}};
    try{const r=await build(c.from(table));return r||{data:[],error:null};}catch(e){return {data:[],error:e};}
  }
  async function loadProjectContracts(projectId){
    projectId=ID(projectId);
    let project=projectById(projectId);
    if(!project){const r=await safeSelect('projects',q=>q.select('*').eq('id',projectId).maybeSingle());project=r.data||null;}
    if(!project)throw new Error('لم يتم العثور على المشروع المحدد.');
    const r=await safeSelect('project_contract_smart',q=>q.select('*').eq('project_id',projectId).maybeSingle());
    const local=readLegacyLocal(projectId);
    let row=r.data||null,payload=row?.payload||{};
    if((r.error||!row)&&Object.keys(local).length)payload=local;
    state.project=project;state.smartRow=row;state.rawPayload=clone(payload)||{};
    return {project,row,payload};
  }
  async function loadAnnualServices(projectId){
    projectId=ID(projectId);
    const r=await safeSelect('contract_services',q=>q.select('*').eq('project_id',projectId).order('id',{ascending:true}));
    if(r.error){console.warn('[ContractsServicesEditor] contract_services',r.error.message||r.error);return [];}
    return (r.data||[]).map(x=>Object.assign({},x,{source:'db',_baseline:clone(x),is_archived:!!x.is_archived}));
  }
  async function loadContractAttachments(projectId){
    projectId=ID(projectId);
    const r=await safeSelect('contract_attachments',q=>q.select('*').eq('project_id',projectId).order('created_at',{ascending:false}));
    return r.error?[]:(r.data||[]).map(x=>Object.assign({},x,{source:'db_attachment'}));
  }
  async function loadAudit(projectId){
    projectId=ID(projectId);
    const r=await safeSelect('contract_change_logs',q=>q.select('*').eq('project_id',projectId).order('changed_at',{ascending:false}).limit(200));
    if(!r.error)return r.data||[];
    const f=await safeSelect('audit_logs',q=>q.select('*').eq('module','contracts_services').eq('record_id',S(projectId)).order('created_at',{ascending:false}).limit(100));
    return f.error?[]:(f.data||[]).map(x=>({field_name:x.action,old_value:x.old_value,new_value:x.new_value,changed_by:x.user_id,changed_at:x.created_at,reason:x.reason||''}));
  }
  async function loadNormalizedContracts(projectId){
    projectId=ID(projectId);
    const r=await safeSelect('contracts',q=>q.select('*').eq('project_id',projectId).order('created_at',{ascending:false}));
    if(r.error){console.warn('[ContractsServicesEditor] contracts registry unavailable',r.error.message||r.error);return [];}
    return r.data||[];
  }
  function currentContractRow(key){
    return (state.contractRows||[]).find(x=>S(x.contract_key)===S(key)&&x.is_active!==false&&!['renewed','not_renewed','cancelled','archived'].includes(S(x.status)))
      ||(state.contractRows||[]).find(x=>S(x.contract_key)===S(key))||null;
  }

  function mergeAnnual(model,dbRows){
    const archivedIds=new Set(model.archivedServiceIds||[]);
    const rows=dbRows.map(x=>Object.assign({},x,{is_archived:!!x.is_archived||archivedIds.has(S(x.id)),remaining_count:Math.max(N(x.visit_count)-N(x.executed_count),0)}));
    const names=new Set(rows.map(x=>normalizeName(x.service_name)));
    (model.annualLegacy||[]).forEach((a,i)=>{
      if(names.has(normalizeName(a.name)))return;
      rows.push({id:S(a.id||('legacy_'+i)),source:'smart',service_name:a.name||'',service_type:a.service_type||a.name||'',frequency:a.frequency||'سنوي',visit_count:N(a.visits||1)||1,executed_count:Array.isArray(a.done)?a.done.length:N(a.executed_count),remaining_count:Math.max((N(a.visits)||1)-(Array.isArray(a.done)?a.done.length:N(a.executed_count)),0),start_date:dateOnly(a.start_date),end_date:dateOnly(a.end_date),last_execution_date:dateOnly(a.last_execution_date),next_due_date:dateOnly(a.next_due_date),status:a.status||'',notes:a.notes||'',executor_name:a.executor_name||'',is_archived:!!a.is_archived,_baseline:clone(a)});
    });
    return rows;
  }
  function normalizeName(v){return S(v).toLowerCase().replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/\s+/g,' ');}
  function buildAttachments(model,dbRows){
    const out=[];
    (dbRows||[]).forEach(x=>out.push(Object.assign({source:'db_attachment'},x)));
    (model.attachments||[]).forEach((x,i)=>out.push(Object.assign({id:x.id||('smart_att_'+i),source:'smart_attachment',category:'عقد',name:'مرفق',url:'',notes:'',is_archived:false},x)));
    CONTRACT_DEFS.forEach(d=>{const c=model.contracts[d.key];if(c?.attachment)out.push({id:'contract_'+d.key,source:'contract_field',contract_key:d.key,category:d.title,name:'مرفق '+d.title,url:c.attachment,notes:'',is_archived:false});});
    return out;
  }

  async function openEditor(projectId,mode='edit',forceReload=false){
    ensureModal();
    const project=projectById(projectId);
    if(project&&!canViewProject(project)){toast('ليس لديك صلاحية لعرض عقود هذا المشروع','error');return;}
    if(mode==='edit'&&project&&!canEditProject(project))mode='view';
    state.open=true;state.loading=true;state.projectId=ID(projectId);state.mode=mode;state.dirty=false;state.lastError='';
    $(MODAL_ID).classList.remove('hidden');document.body.style.overflow='hidden';
    $('csEditorBodyV10807').innerHTML='<div class="cs-editor-skeleton"><i></i><i></i><i></i><i></i><i></i><i></i></div>';
    $('csEditorSaveV10807').style.display=mode==='edit'?'':'none';setStatus('جاري تحميل بيانات المشروع المحدد...');
    try{
      const [pc,services,attachments,audit,contractRows]=await Promise.all([loadProjectContracts(projectId),loadAnnualServices(projectId),loadContractAttachments(projectId),loadAudit(projectId),loadNormalizedContracts(projectId)]);
      if(!canViewProject(pc.project))throw new Error('ليس لديك صلاحية لعرض هذا المشروع.');
      if(mode==='edit'&&!canEditProject(pc.project))state.mode='view';
      const model=normalizeSmart(pc.payload,pc.project);
      model.annualServices=mergeAnnual(model,services);
      model.attachments=buildAttachments(model,attachments);
      state.services=services;state.attachments=attachments;state.audit=audit;state.contractRows=contractRows;state.model=model;state.baseline=clone(model);state.loading=false;state.dirty=false;
      renderEditor();setStatus(state.mode==='edit'?'تم تحميل البيانات.':'وضع العرض فقط.','ok');
    }catch(e){
      state.loading=false;state.lastError=friendlyError(e);$('csEditorBodyV10807').innerHTML=`<div class="cs-editor-empty"><h3>تعذر تحميل بيانات العقود والخدمات</h3><p>${E(state.lastError)}</p><button class="cs-editor-btn" data-action="reload">إعادة المحاولة</button></div>`;setStatus(state.lastError,'error');
    }
  }

  function renderEditor(){
    const p=state.project,m=state.model;
    $('csEditorTitleV10807').textContent='إدارة عقود وخدمات المشروع';
    $('csEditorSubtitleV10807').textContent=`${p?.name||'-'} — تحميل عند الطلب فقط — ${state.mode==='edit'?'وضع التعديل':'وضع العرض'}`;
    const contractsCount=CONTRACT_DEFS.filter(d=>m.contracts[d.key]?.enabled).length+(m.contracts.others||[]).filter(x=>!x.is_archived).length;
    const annualCount=(m.annualServices||[]).filter(x=>!x.is_archived).length;
    $('csEditorSummaryV10807').innerHTML=`<div><small>اسم المشروع</small><b>${E(p?.name||'-')}</b></div><div><small>كود المشروع</small><b>${E(p?.code||p?.project_code||p?.id||'-')}</b></div><div><small>حالة المشروع</small><b>${E(p?.is_active===false?'موقوف':(p?.status||'نشط'))}</b></div><div><small>عدد العقود</small><b>${contractsCount}</b></div><div><small>الخدمات السنوية</small><b>${annualCount}</b></div>`;
    $('csEditorBodyV10807').innerHTML=`<section class="cs-editor-pane" data-pane="contracts" id="csContractsPaneV10807"></section><section class="cs-editor-pane hidden" data-pane="annual" id="csAnnualPaneV10807"></section><section class="cs-editor-pane hidden" data-pane="attachments" id="csAttachmentsPaneV10807"></section><section class="cs-editor-pane hidden" data-pane="audit" id="csAuditPaneV10807"></section>`;
    $('csEditorSaveV10807').style.display=isEditable()?'':'none';$('csEditorReasonV10807').disabled=!isEditable();
    renderContractsPane();renderAnnualPane();renderAttachmentsPane();renderAuditPane();switchTab('contracts');
  }

  function field(key,field,label,type='text',extra=''){
    const c=state.model.contracts[key]||emptyContract();
    const disabled=!isEditable()||(field==='value'&&!canEditFinance());
    const cls=field==='value'&&!canEditFinance()?' finance-locked':'';
    const val=c[field]??'';
    if(type==='textarea')return `<div class="cs-editor-field span-all${cls}"><label>${E(label)}</label><textarea data-contract-key="${key}" data-contract-field="${field}" ${disabled?'disabled':''}>${E(val)}</textarea></div>`;
    if(type==='select')return `<div class="cs-editor-field${cls}"><label>${E(label)}</label><select data-contract-key="${key}" data-contract-field="${field}" ${disabled?'disabled':''}><option value="">اختر</option>${['نشط','قريب الانتهاء','منتهي','موقوف','قيد التجديد','لا يحتاج تجديد'].map(x=>`<option ${S(val)===x?'selected':''}>${x}</option>`).join('')}</select></div>`;
    return `<div class="cs-editor-field${cls}"><label>${E(label)}</label><input type="${type}" value="${E(val)}" data-contract-key="${key}" data-contract-field="${field}" ${disabled?'disabled':''} ${extra}></div>`;
  }
  function contractCard(def){
    const c=state.model.contracts[def.key]||emptyContract();
    const disabled=!isEditable();
    return `<article class="cs-editor-card"><h3><span>${E(def.title)}</span><span class="cs-editor-badge ${c.enabled?'':'gray'}">${c.enabled?'ضمن المشروع':'غير مفعل'}</span></h3>
      <label class="cs-editor-switch"><input type="checkbox" data-contract-key="${def.key}" data-contract-field="enabled" ${c.enabled?'checked':''} ${disabled?'disabled':''}> العقد/الخدمة ضمن المشروع</label>
      <div class="cs-editor-fields">
        ${field(def.key,'provider',def.provider)}${field(def.key,'contract_number','رقم العقد')}${field(def.key,'status','حالة العقد','select')}
        ${field(def.key,'start_date','تاريخ البداية','date')}${field(def.key,'end_date','تاريخ النهاية','date')}${field(def.key,'visits','عدد الزيارات','number','min="0"')}
        ${field(def.key,'asset_count',def.asset,'number','min="0"')}${field(def.key,'value','قيمة العقد','number','min="0" step="0.01"')}${field(def.key,'contact_name','مسؤول التواصل')}
        ${field(def.key,'phone','رقم الجوال','tel')}${field(def.key,'certificate_number',def.key==='civilDefense'?'رقم الشهادة أو الرخصة':'رقم الشهادة/المرجع')}${field(def.key,'certificate_end_date','تاريخ انتهاء الشهادة','date')}
        ${field(def.key,'scope',def.scope,'textarea')}${field(def.key,'attachment','رابط/اسم مرفق العقد')}${field(def.key,'notes','الملاحظات','textarea')}
      </div></article>`;
  }
  function renderContractsPane(){
    const pane=$('csContractsPaneV10807');if(!pane)return;
    pane.innerHTML=`${renewalPanelHtml()}<div class="cs-editor-card full" style="margin-bottom:14px"><h3>بيانات الجمعية والتواصل</h3><div class="cs-editor-fields"><div class="cs-editor-field"><label>اسم الجمعية</label><input data-association-field="name" value="${E(state.model.association.name)}" ${!isEditable()?'disabled':''}></div><div class="cs-editor-field"><label>مدير الجمعية</label><input data-association-field="manager" value="${E(state.model.association.manager)}" ${!isEditable()?'disabled':''}></div><div class="cs-editor-field"><label>رقم الجوال</label><input data-association-field="phone" value="${E(state.model.association.phone)}" ${!isEditable()?'disabled':''}></div></div></div>
      <div class="cs-editor-grid">${CONTRACT_DEFS.map(contractCard).join('')}<article class="cs-editor-card full"><div class="cs-editor-toolbar"><h3>العقود الأخرى</h3>${isEditable()?'<button class="cs-editor-btn light" data-action="add-other-contract">إضافة عقد آخر</button>':''}</div>${otherContractsHtml()}</article></div>`;
  }
  function otherContractsHtml(){
    const rows=state.model.contracts.others||[];
    if(!rows.length)return '<div class="cs-editor-empty">لا توجد عقود أخرى مسجلة.</div>';
    return `<div class="cs-editor-table-wrap"><table class="cs-editor-table"><thead><tr><th>نوع العقد</th><th>مقدم الخدمة</th><th>رقم العقد</th><th>البداية</th><th>النهاية</th><th>القيمة</th><th>الحالة</th><th>ملاحظات</th><th>إجراء</th></tr></thead><tbody>${rows.map((r,i)=>`<tr data-other-index="${i}"><td><input data-other-index="${i}" data-other-field="type" value="${E(r.type||'')}" ${!isEditable()?'disabled':''}></td><td><input data-other-index="${i}" data-other-field="provider" value="${E(r.provider||'')}" ${!isEditable()?'disabled':''}></td><td><input data-other-index="${i}" data-other-field="contract_number" value="${E(r.contract_number||'')}" ${!isEditable()?'disabled':''}></td><td><input type="date" data-other-index="${i}" data-other-field="start_date" value="${E(dateOnly(r.start_date))}" ${!isEditable()?'disabled':''}></td><td><input type="date" data-other-index="${i}" data-other-field="end_date" value="${E(dateOnly(r.end_date))}" ${!isEditable()?'disabled':''}></td><td><input type="number" data-other-index="${i}" data-other-field="value" value="${E(N(r.value))}" ${!isEditable()||!canEditFinance()?'disabled':''}></td><td><input data-other-index="${i}" data-other-field="status" value="${E(r.status||'')}" ${!isEditable()?'disabled':''}></td><td><textarea data-other-index="${i}" data-other-field="notes" ${!isEditable()?'disabled':''}>${E(r.notes||'')}</textarea></td><td>${isEditable()?`<button class="cs-editor-btn danger" data-action="remove-other-contract">أرشفة</button>`:'-'}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function addOtherContract(){if(!isEditable())return;state.model.contracts.others.push({id:'other_'+Date.now(),type:'',provider:'',contract_number:'',start_date:'',end_date:'',value:0,status:'',notes:'',is_archived:false});markDirty();renderContractsPane();}
  function removeOtherContract(i){if(!isEditable())return;const r=state.model.contracts.others[i];if(!r)return;r.is_archived=true;r.archived_at=nowIso();markDirty();renderContractsPane();}

  function annualRowHtml(r,i){
    const editable=isEditable(),execEditable=editable&&canAdminExecuted();
    return `<tr class="${r.is_archived?'archived':''}" data-service-index="${i}">
      <td><input list="csAnnualNamesV10807" data-annual-index="${i}" data-annual-field="service_name" value="${E(r.service_name||'')}" ${!editable?'disabled':''}></td>
      <td><input data-annual-index="${i}" data-annual-field="service_type" value="${E(r.service_type||r.service_name||'')}" ${!editable?'disabled':''}></td>
      <td><input type="number" min="0" class="cs-editor-number" data-annual-index="${i}" data-annual-field="visit_count" value="${N(r.visit_count)}" ${!editable?'disabled':''}></td>
      <td><input type="number" min="0" class="cs-editor-number" data-annual-index="${i}" data-annual-field="executed_count" value="${N(r.executed_count)}" ${!execEditable?'disabled title="يتم احتسابه من سجلات التنفيذ، والتعديل الإداري يتطلب صلاحية وسبب"':''}></td>
      <td id="csRemain_${i}" class="cs-editor-number"><b>${Math.max(N(r.visit_count)-N(r.executed_count),0)}</b></td>
      <td><input data-annual-index="${i}" data-annual-field="frequency" value="${E(r.frequency||'سنوي')}" ${!editable?'disabled':''}></td>
      <td><input type="date" data-annual-index="${i}" data-annual-field="start_date" value="${E(dateOnly(r.start_date))}" ${!editable?'disabled':''}></td>
      <td><input type="date" data-annual-index="${i}" data-annual-field="end_date" value="${E(dateOnly(r.end_date))}" ${!editable?'disabled':''}></td>
      <td><input type="date" data-annual-index="${i}" data-annual-field="last_execution_date" value="${E(dateOnly(r.last_execution_date))}" ${!editable?'disabled':''}></td>
      <td><input type="date" data-annual-index="${i}" data-annual-field="next_due_date" value="${E(dateOnly(r.next_due_date))}" ${!editable?'disabled':''}></td>
      <td><input data-annual-index="${i}" data-annual-field="status" value="${E(r.status||'')}" ${!editable?'disabled':''}></td>
      <td><textarea data-annual-index="${i}" data-annual-field="notes" ${!editable?'disabled':''}>${E(r.notes||'')}</textarea></td>
      <td>${r.is_archived?(canArchive()&&editable?'<button class="cs-editor-btn light" data-action="restore-service">استعادة</button>':'مؤرشفة'):(editable?'<button class="cs-editor-btn danger" data-action="archive-service">أرشفة</button>':'-')}</td>
    </tr>`;
  }
  function renderAnnualPane(){
    const pane=$('csAnnualPaneV10807');if(!pane)return;
    const rows=state.model.annualServices||[];const visible=rows.map((r,i)=>({r,i})).filter(x=>state.showArchived||!x.r.is_archived);
    pane.innerHTML=`<datalist id="csAnnualNamesV10807">${DEFAULT_ANNUAL.map(x=>`<option value="${E(x)}">`).join('')}</datalist><div class="cs-editor-toolbar"><div><h3>الخدمات السنوية</h3><small>المتبقي = العدد السنوي − عدد مرات التنفيذ المعتمدة</small></div><div class="cs-editor-toolbar-actions"><label class="cs-editor-switch" style="margin:0"><input id="csShowArchivedV10807" type="checkbox" ${state.showArchived?'checked':''}> عرض المؤرشف</label>${isEditable()?'<button class="cs-editor-btn light" data-action="add-service">إضافة خدمة سنوية</button>':''}</div></div>
      <div class="cs-editor-table-wrap"><table class="cs-editor-table"><thead><tr><th>اسم الخدمة</th><th>النوع</th><th>العدد السنوي</th><th>المنفذ</th><th>المتبقي</th><th>التكرار</th><th>البداية</th><th>النهاية</th><th>آخر تنفيذ</th><th>الموعد القادم</th><th>الحالة</th><th>الملاحظات</th><th>إجراء</th></tr></thead><tbody>${visible.map(x=>annualRowHtml(x.r,x.i)).join('')||'<tr><td colspan="13"><div class="cs-editor-empty">لا توجد خدمات سنوية مسجلة لهذا المشروع.</div></td></tr>'}</tbody></table></div>`;
  }
  function addAnnualService(){
    if(!isEditable())return;
    state.model.annualServices.push({id:'new_'+Date.now(),source:'new',service_name:'',service_type:'',frequency:'سنوي',visit_count:1,executed_count:0,remaining_count:1,start_date:dateOnly(state.project?.contract_start||state.project?.start_date),end_date:dateOnly(state.project?.contract_end||state.project?.end_date),last_execution_date:'',next_due_date:'',status:'مستحقة',notes:'',executor_name:'',is_archived:false,_baseline:null});
    markDirty();renderAnnualPane();
  }
  function archiveAnnualService(i){
    if(!isEditable()||!canArchive()){toast('لا توجد صلاحية لأرشفة الخدمة','error');return;}
    const r=state.model.annualServices[i];if(!r)return;r.is_archived=true;r.archive_reason=S($('csEditorReasonV10807')?.value);r.archived_at=nowIso();markDirty();renderAnnualPane();
  }
  function restoreAnnualService(i){if(!isEditable()||!canArchive())return;const r=state.model.annualServices[i];if(!r)return;r.is_archived=false;r.archived_at=null;markDirty();renderAnnualPane();}

  function renderAttachmentsPane(){
    const pane=$('csAttachmentsPaneV10807');if(!pane)return;
    const rows=(state.model.attachments||[]).filter(x=>!x.is_archived);
    pane.innerHTML=`<div class="cs-editor-toolbar"><div><h3>المرفقات</h3><small>ملفات العقود، عروض الأسعار، الشهادات، الفواتير، التقارير والصور</small></div>${isEditable()&&canManageAttachments()?'<button class="cs-editor-btn light" data-action="add-attachment">إضافة مرفق</button>':''}</div><div class="cs-editor-attachments">${rows.map((a,i)=>attachmentHtml(a,state.model.attachments.indexOf(a))).join('')||'<div class="cs-editor-empty">لا توجد مرفقات مسجلة.</div>'}</div>`;
  }
  function attachmentHtml(a,i){
    const editable=isEditable()&&canManageAttachments()&&(a.source==='smart_attachment'||!a.source),external=a.url||a.file_url||a.attachment_url,stored=a.storage_path;
    const opener=stored?`<button class="cs-editor-btn light" data-action="open-storage-attachment">فتح المرفق المحفوظ</button>`:(external?`<a href="${E(external)}" target="_blank" rel="noopener">فتح المرفق</a>`:'');
    return `<article class="cs-editor-attachment" data-attachment-index="${i}"><div class="cs-editor-field"><label>التصنيف</label><select data-attachment-index="${i}" data-attachment-field="category" ${!editable?'disabled':''}>${['عقد','عرض سعر','شهادة','فاتورة','تقرير','صورة','أخرى'].map(x=>`<option ${S(a.category)===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="cs-editor-field"><label>اسم الملف</label><input data-attachment-index="${i}" data-attachment-field="name" value="${E(a.name||a.file_name||'')}" ${!editable?'disabled':''}></div><div class="cs-editor-field"><label>الرابط أو اسم المرفق</label><input data-attachment-index="${i}" data-attachment-field="url" value="${E(external||'')}" ${!editable?'disabled':''}></div>${opener}<div class="cs-editor-field"><label>ملاحظات</label><textarea data-attachment-index="${i}" data-attachment-field="notes" ${!editable?'disabled':''}>${E(a.notes||'')}</textarea></div>${editable?'<button class="cs-editor-btn danger" data-action="archive-attachment">أرشفة المرفق</button>':''}</article>`;
  }
  async function openStorageAttachment(i){
    const a=state.model?.attachments?.[i];if(!a?.storage_path)return;const c=client();if(!c)return toast('تعذر الاتصال بالتخزين','error');
    try{const r=await c.storage.from(a.storage_bucket||CONTRACT_FILES_BUCKET).download(a.storage_path);if(r.error)throw r.error;const url=URL.createObjectURL(r.data);window.open(url,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){toast(friendlyError(e),'error');}
  }
  function validateContractFile(file){if(!file)return;if(!CONTRACT_FILE_TYPES.has(file.type))throw new Error('نوع ملف العقد غير مسموح. استخدم PDF أو JPG أو PNG.');if(file.size>CONTRACT_FILE_MAX)throw new Error('حجم ملف العقد أكبر من 10MB.');}
  function safeContractFileName(name){return S(name).replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-120)||'contract';}
  async function uploadRenewalFile(file){
    validateContractFile(file);const c=client(),projectId=ID(state.projectId),safe=safeContractFileName(file.name),token=(crypto?.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(16).slice(2));const path=`projects/${projectId}/contracts/${Date.now()}-${token}-${safe}`;
    const up=await c.storage.from(CONTRACT_FILES_BUCKET).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});if(up.error)throw up.error;
    return {name:file.name,file_url:'',storage_bucket:CONTRACT_FILES_BUCKET,storage_path:path,mime_type:file.type,size_bytes:file.size};
  }
  function addAttachment(){if(!isEditable()||!canManageAttachments())return;state.model.attachments.push({id:'att_'+Date.now(),source:'smart_attachment',category:'عقد',name:'',url:'',notes:'',is_archived:false});markDirty();renderAttachmentsPane();}
  function archiveAttachment(i){if(!isEditable()||!canManageAttachments())return;const a=state.model.attachments[i];if(!a)return;a.is_archived=true;a.archived_at=nowIso();markDirty();renderAttachmentsPane();}

  function renderAuditPane(){
    const pane=$('csAuditPaneV10807');if(!pane)return;
    const rows=state.audit||[];
    pane.innerHTML=`<div class="cs-editor-toolbar"><div><h3>سجل التعديلات</h3><small>الحقل والقيمة السابقة والجديدة والمستخدم والتاريخ والسبب</small></div></div><div class="cs-editor-audit">${rows.map(a=>`<div class="cs-editor-audit-row"><div><b>${E(a.field_name||a.action||'-')}</b><small>${E(a.entity_type||'')}</small></div><div><b>${E(a.changed_by_name||a.user_name||a.changed_by||'-')}</b><small>${E(formatDateTime(a.changed_at||a.created_at))}</small></div><div class="cs-editor-audit-value"><small>السابق</small><br>${E(displayValue(a.old_value))}</div><div class="cs-editor-audit-value"><small>الجديد</small><br>${E(displayValue(a.new_value))}</div><div><small>السبب</small><br>${E(a.reason||'-')}</div></div>`).join('')||'<div class="cs-editor-empty">لا توجد تعديلات مسجلة بعد.</div>'}</div>`;
  }
  function displayValue(v){if(v==null)return '-';if(typeof v==='object')return JSON.stringify(v);return S(v);}
  function formatDateTime(v){if(!v)return '-';try{return new Date(v).toLocaleString('ar-SA-u-nu-latn',{timeZone:'Asia/Riyadh'});}catch(_){return S(v);}}

  function collectProjectChanges(){
    const op=state.model.contracts.operation||{},base=state.baseline?.contracts?.operation||{},out={};
    if(dateOnly(op.start_date)!==dateOnly(base.start_date))out.contract_start=dateOnly(op.start_date)||null;
    if(dateOnly(op.end_date)!==dateOnly(base.end_date))out.contract_end=dateOnly(op.end_date)||null;
    return out;
  }
  function changed(a,b){return JSON.stringify(a??null)!==JSON.stringify(b??null);}
  function annualDbPayload(row){return {id:row.id,service_name:S(row.service_name),service_type:S(row.service_type||row.service_name),frequency:S(row.frequency||'سنوي'),visit_count:N(row.visit_count),executed_count:N(row.executed_count),remaining_count:Math.max(N(row.visit_count)-N(row.executed_count),0),start_date:dateOnly(row.start_date)||null,end_date:dateOnly(row.end_date)||null,last_execution_date:dateOnly(row.last_execution_date)||null,next_due_date:dateOnly(row.next_due_date)||null,status:S(row.status||'مستحقة'),executor_name:S(row.executor_name),notes:S(row.notes),is_archived:!!row.is_archived,expected_updated_at:row._baseline?.updated_at||null,archive_reason:S(row.archive_reason)};}
  function computeChanges(){
    const current=state.model,base=state.baseline||{};
    const serviceChanges=[],newServices=[],archivedIds=[];
    (current.annualServices||[]).forEach(r=>{
      if(r.source==='db'){
        if(r.is_archived&&!r._baseline?.is_archived)archivedIds.push(r.id);
        if(changed(annualDbPayload(r),annualDbPayload(Object.assign({},r._baseline||{}, {_baseline:r._baseline}))))serviceChanges.push(annualDbPayload(r));
      }else if(r.source==='new'&&!r.is_archived)newServices.push(annualDbPayload(r));
    });
    const smartCurrent=serializeSmart(current);const smartBase=(()=>{const save=state.model;state.model=base;const x=serializeSmart(base);state.model=save;return x;})();
    const projectChanges=collectProjectChanges();
    const auditRows=buildAuditRows(base,current);
    return {smartCurrent,smartChanged:changed(smartCurrent,smartBase),serviceChanges,newServices,archivedIds,projectChanges,auditRows};
  }
  function diffObjects(oldObj,newObj,prefix='',out=[]){
    const keys=new Set([...Object.keys(oldObj||{}),...Object.keys(newObj||{})]);
    for(const k of keys){const path=prefix?prefix+'.'+k:k;const a=oldObj?.[k],b=newObj?.[k];if(typeof a==='object'&&a&&!Array.isArray(a)&&typeof b==='object'&&b&&!Array.isArray(b))diffObjects(a,b,path,out);else if(changed(a,b))out.push({field_name:path,old_value:a,new_value:b});if(out.length>=200)break;}
    return out;
  }
  function buildAuditRows(base,current){
    const out=[];
    diffObjects(base.contracts||{},current.contracts||{},'contracts',out);
    diffObjects(base.association||{},current.association||{},'association',out);
    const annualFields=['service_name','service_type','frequency','visit_count','executed_count','remaining_count','start_date','end_date','last_execution_date','next_due_date','status','notes','is_archived'];
    const a0=new Map((base.annualServices||[]).map((x,i)=>[S(x.id||('row_'+i)),x]));
    const a1=new Map((current.annualServices||[]).map((x,i)=>[S(x.id||('row_'+i)),x]));
    new Set([...a0.keys(),...a1.keys()]).forEach(id=>{const x=a0.get(id)||{},y=a1.get(id)||{};annualFields.forEach(f=>{if(changed(x[f],y[f]))out.push({field_name:`annualServices.${id}.${f}`,old_value:x[f],new_value:y[f]});});});
    const att0=new Map((base.attachments||[]).map((x,i)=>[S(x.id||('att_'+i)),x]));
    const att1=new Map((current.attachments||[]).map((x,i)=>[S(x.id||('att_'+i)),x]));
    new Set([...att0.keys(),...att1.keys()]).forEach(id=>{const x=att0.get(id)||{},y=att1.get(id)||{};['category','name','url','notes','is_archived'].forEach(f=>{if(changed(x[f]??x.file_url,y[f]??y.file_url))out.push({field_name:`attachments.${id}.${f}`,old_value:x[f]??x.file_url,new_value:y[f]??y.file_url});});});
    return out.slice(0,200);
  }
  function validateBeforeSave(changes){
    const errors=[];
    CONTRACT_DEFS.forEach(d=>{const c=state.model.contracts[d.key];if(c?.enabled){if(d.key==='operation'&&!c.start_date)errors.push('تاريخ بداية عقد التشغيل الأساسي مطلوب');if(c.end_date&&c.start_date&&c.end_date<c.start_date)errors.push(`تاريخ نهاية ${d.title} يسبق البداية`);}});
    (state.model.annualServices||[]).filter(x=>!x.is_archived).forEach((r,i)=>{if(!S(r.service_name))errors.push(`اسم الخدمة السنوية في الصف ${i+1} مطلوب`);if(N(r.executed_count)>N(r.visit_count))errors.push(`عدد المنفذ أكبر من العدد السنوي لخدمة ${r.service_name||i+1}`);});
    const reason=S($('csEditorReasonV10807')?.value);
    const sensitive=changes.auditRows.some(x=>/value|contract_number|start_date|end_date|visit_count|executed_count|provider|attachment|certificate/i.test(x.field_name));
    if(sensitive&&!reason)errors.push('سبب التعديل مطلوب عند تغيير القيم أو التواريخ أو أعداد الخدمات أو المرفقات');
    if(!canEditFinance()&&changes.auditRows.some(x=>/\.value$/.test(x.field_name)))errors.push('لا توجد صلاحية لتعديل القيم المالية');
    return errors;
  }

  async function saveViaRpc(changes,reason){
    const c=client();if(!c)throw new Error('تعذر الاتصال بقاعدة البيانات.');
    const u=getUser();
    const args={p_project_id:ID(state.projectId),p_expected_smart_updated_at:state.smartRow?.updated_at||null,p_smart_payload:changes.smartCurrent,p_project_changes:changes.projectChanges,p_service_changes:changes.serviceChanges,p_new_services:changes.newServices,p_archived_ids:changes.archivedIds,p_audit_rows:changes.auditRows,p_user_id:S(u.id),p_user_name:S(u.full_name||u.username),p_reason:reason};
    const r=await c.rpc('save_contracts_services_editor_v10814',args);
    if(r.error)throw r.error;
    return r.data;
  }
  function isMissingRpc(error){return /function .* does not exist|Could not find the function|schema cache|PGRST202/i.test(S(error?.message||error));}
  async function fallbackSave(changes,reason){
    const c=client();if(!c)throw new Error('تعذر الاتصال بقاعدة البيانات.');
    const u=getUser(),pid=ID(state.projectId);
    const latest=await c.from('project_contract_smart').select('project_id,updated_at').eq('project_id',pid).maybeSingle();
    if(!latest.error&&state.smartRow?.updated_at&&latest.data?.updated_at&&S(latest.data.updated_at)!==S(state.smartRow.updated_at))throw new Error('تم تعديل هذا السجل من مستخدم آخر. حدّث البيانات قبل الحفظ.');
    if(changes.smartChanged){const r=await c.from('project_contract_smart').upsert({project_id:pid,payload:changes.smartCurrent,updated_at:nowIso(),updated_by:Number(u.id)||null},{onConflict:'project_id'});if(r.error)throw r.error;}
    if(Object.keys(changes.projectChanges).length){const r=await c.from('projects').update(Object.assign({},changes.projectChanges)).eq('id',pid);if(r.error)throw r.error;}
    for(const row of changes.serviceChanges){
      if(row.expected_updated_at){const chk=await c.from('contract_services').select('updated_at').eq('id',row.id).maybeSingle();if(!chk.error&&chk.data?.updated_at&&S(chk.data.updated_at)!==S(row.expected_updated_at))throw new Error('تم تعديل إحدى الخدمات من مستخدم آخر. حدّث البيانات قبل الحفظ.');}
      const payload=Object.assign({},row);delete payload.id;delete payload.expected_updated_at;delete payload.archive_reason;const r=await c.from('contract_services').update(Object.assign(payload,{updated_at:nowIso()})).eq('id',row.id);if(r.error)throw r.error;
    }
    for(const row of changes.newServices){const payload=Object.assign({},row,{project_id:pid,project_name:state.project?.name||'',supervisor_id:state.project?.supervisor_id||null,supervisor_name:'',created_at:nowIso(),updated_at:nowIso()});delete payload.id;delete payload.expected_updated_at;delete payload.archive_reason;const r=await c.from('contract_services').insert(payload);if(r.error)throw r.error;}
    if(changes.archivedIds.length){let r=await c.from('contract_services').update({is_archived:true,archived_at:nowIso(),archived_by:Number(u.id)||null,archive_reason:reason,updated_at:nowIso()}).in('id',changes.archivedIds);if(r.error){r=await c.from('contract_services').update({status:'مؤرشفة',updated_at:nowIso()}).in('id',changes.archivedIds);if(r.error)throw r.error;}}
    if(changes.auditRows.length){const rows=changes.auditRows.map(x=>({entity_type:'contracts_services',entity_id:S(state.projectId),project_id:pid,field_name:x.field_name,old_value:x.old_value==null?null:JSON.stringify(x.old_value),new_value:x.new_value==null?null:JSON.stringify(x.new_value),changed_by:Number(u.id)||null,changed_by_name:S(u.full_name||u.username),changed_at:nowIso(),reason}));const ar=await c.from('contract_change_logs').insert(rows);if(ar.error)console.warn('[ContractsServicesEditor] audit fallback',ar.error.message);}
    return {fallback:true};
  }

  async function saveContractChanges(){
    if(!isEditable()||state.saving||state.loading)return;
    const changes=computeChanges();
    if(!changes.smartChanged&&!changes.serviceChanges.length&&!changes.newServices.length&&!changes.archivedIds.length&&!Object.keys(changes.projectChanges).length){setStatus('لا توجد تعديلات للحفظ.');return;}
    const errors=validateBeforeSave(changes);if(errors.length){setStatus(errors[0],'error');toast(errors[0],'error');return;}
    const reason=S($('csEditorReasonV10807')?.value);
    state.saving=true;const btn=$('csEditorSaveV10807');btn.disabled=true;btn.textContent='جاري الحفظ...';setStatus('يتم حفظ التعديلات والتحقق من التعارض...');
    try{
      let result;
      result=await saveViaRpc(changes,reason);
      writeLegacyLocal(state.projectId,changes.smartCurrent);
      toast('تم حفظ تعديلات العقود والخدمات بنجاح');setStatus('تم الحفظ بنجاح.','ok');state.dirty=false;
      await refreshAffectedProject();
      await openEditor(state.projectId,state.mode,true);
    }catch(e){const text=friendlyError(e);state.lastError=text;setStatus(text,'error');toast(text,'error');btn.textContent='إعادة محاولة الحفظ';}
    finally{state.saving=false;btn.disabled=false;if(btn.textContent!=='إعادة محاولة الحفظ')btn.textContent='حفظ التعديلات';}
  }
  async function saveAnnualServiceChanges(){return saveContractChanges();}
  async function refreshAffectedProject(){
    try{
      const c=client();if(c){const pr=await c.from('projects').select('*').eq('id',state.projectId).maybeSingle();if(!pr.error&&pr.data){const arr=projectList(),idx=arr.findIndex(x=>S(x.id)===S(state.projectId));if(idx>=0)arr[idx]=pr.data;state.project=pr.data;}}
      if(typeof window.renderContracts==='function')window.renderContracts();
      if(typeof window.renderContractServices==='function')window.renderContractServices();
    }catch(e){console.warn(e);}
  }


  function ensureActionLayer(){
    ensureModal();
    const panel=$(MODAL_ID)?.querySelector('.cs-editor-panel');if(!panel||$('csEditorActionLayerV10814'))return;
    const layer=document.createElement('div');layer.id='csEditorActionLayerV10814';layer.className='cs-editor-guard hidden';panel.appendChild(layer);
  }
  function showActionLayer(html){ensureActionLayer();const x=$('csEditorActionLayerV10814');x.innerHTML=`<div class="cs-editor-action-card">${html}</div>`;x.classList.remove('hidden');}
  function hideActionLayer(){const x=$('csEditorActionLayerV10814');if(x){x.classList.add('hidden');x.innerHTML='';}state.nonRenew=null;state.serviceExecution=null;}
  function contractDef(key){return CONTRACT_DEFS.find(x=>x.key===key)||{key,title:key,provider:'مقدم الخدمة'};}
  function statusArabic(v){return ({draft:'مسودة',active:'نشط',expiring:'قريب الانتهاء',expired:'منتهي',renewed:'تم التجديد',not_renewed:'لم يجدد',cancelled:'ملغي',archived:'مؤرشف'}[S(v)]||S(v)||'-');}
  function renewalPanelHtml(){
    if(!state.renewal)return '';
    const r=state.renewal,c=state.model?.contracts?.[r.contractKey]||emptyContract(),def=contractDef(r.contractKey),services=(state.model?.annualServices||[]).filter(x=>!x.is_archived);
    return `<article class="cs-editor-card full cs-renewal-panel" id="csRenewalPanelV10814"><div class="cs-editor-toolbar"><div><h3>تجديد ${E(def.title)}</h3><small>العقد القديم سيبقى محفوظًا، وسيتم إنشاء عقد جديد مرتبط به.</small></div><button class="cs-editor-btn light" data-action="renew-cancel">إلغاء التجديد</button></div>
      <div class="cs-renew-old"><div><small>رقم العقد السابق</small><b>${E(c.contract_number||r.contractRow?.contract_number||'-')}</b></div><div><small>الفترة السابقة</small><b>${E(dateOnly(c.start_date)||'-')} — ${E(dateOnly(c.end_date)||'-')}</b></div><div><small>الحالة السابقة</small><b>${E(statusArabic(r.contractRow?.status||c.status||'expired'))}</b></div><div><small>مقدم الخدمة</small><b>${E(c.provider||'-')}</b></div></div>
      <div class="cs-editor-fields"><div class="cs-editor-field"><label>تاريخ بداية العقد الجديد</label><input id="csRenewStartV10814" type="date" value="${E(r.start_date||'')}"></div><div class="cs-editor-field"><label>تاريخ نهاية العقد الجديد</label><input id="csRenewEndV10814" type="date" value="${E(r.end_date||'')}"></div><div class="cs-editor-field"><label>قيمة العقد الجديدة</label><input id="csRenewValueV10814" type="number" min="0" step="0.01" value="${E(r.value)}" ${!canEditFinance()?'disabled':''}></div><div class="cs-editor-field"><label>${E(def.provider)}</label><input id="csRenewProviderV10814" value="${E(r.provider||c.provider||'')}"></div><div class="cs-editor-field"><label>تاريخ التنبيه القادم</label><input id="csRenewAlertV10814" type="date" value="${E(r.alert_date||'')}"></div><div class="cs-editor-field"><label>رفع العقد الجديد</label><input id="csRenewFileV10814" type="file" accept="application/pdf,image/jpeg,image/png" ${!canManageAttachments()?'disabled':''}><small>PDF أو JPG أو PNG — حتى 10MB</small></div><div class="cs-editor-field"><label>رابط مرفق خارجي (اختياري)</label><input id="csRenewAttachmentV10814" value="" placeholder="https://..."></div><div class="cs-editor-field span-all"><label>ملاحظات وسبب التجديد</label><textarea id="csRenewNotesV10814">${E(r.notes||'')}</textarea></div>${state.project?.is_active===false?'<label class="cs-editor-switch span-all"><input id="csRenewReactivateV10814" type="checkbox"> إعادة تنشيط المشروع بعد التجديد</label>':''}</div>
      <div class="cs-renew-services"><h4>خطة الخدمات السنوية الجديدة</h4><small>راجع الخدمات والأعداد؛ لا يتم نقل التنفيذات القديمة.</small><div class="cs-editor-table-wrap"><table class="cs-editor-table"><thead><tr><th>نسخ</th><th>الخدمة</th><th>العدد السنوي الجديد</th><th>التكرار</th><th>ملاحظات</th></tr></thead><tbody>${services.map((x,i)=>`<tr data-renew-service-index="${i}"><td><input type="checkbox" data-renew-service-enabled checked></td><td><input data-renew-service-name value="${E(x.service_name||'')}"></td><td><input type="number" min="0" data-renew-service-count value="${N(x.visit_count)}"></td><td><input data-renew-service-frequency value="${E(x.frequency||'سنوي')}"></td><td><input data-renew-service-notes value="${E(x.notes||'')}"></td></tr>`).join('')||'<tr><td colspan="5">لا توجد خدمات سابقة، ويمكن إضافتها بعد التجديد.</td></tr>'}</tbody></table></div></div>
      <div class="cs-renew-actions"><button class="cs-editor-btn" data-action="renew-submit">إنشاء العقد الجديد وحفظ التجديد</button></div></article>`;
  }
  async function startRenewal(projectId,contractKey='operation',contractId=null){
    if(!canRenew()){toast('لا توجد صلاحية لتجديد العقود','error');return;}
    await openEditor(ID(projectId),'edit');if(!state.open||state.lastError)return;
    const c=state.model.contracts[contractKey]||emptyContract(),row=(state.contractRows||[]).find(x=>S(x.id)===S(contractId))||currentContractRow(contractKey);
    const nextStart=dateOnly(c.end_date)?new Date(dateOnly(c.end_date)+'T00:00:00'):new Date();nextStart.setDate(nextStart.getDate()+1);
    const nextEnd=new Date(nextStart);nextEnd.setFullYear(nextEnd.getFullYear()+1);nextEnd.setDate(nextEnd.getDate()-1);
    state.renewal={contractKey,contractId:S(contractId||row?.id||''),contractRow:row,start_date:dateOnly(nextStart.toISOString()),end_date:dateOnly(nextEnd.toISOString()),value:N(c.value),provider:c.provider||'',alert_date:'',notes:''};
    renderContractsPane();switchTab('contracts');setTimeout(()=>$('csRenewalPanelV10814')?.scrollIntoView({behavior:'smooth',block:'start'}),50);
  }
  function collectRenewalServices(){return [...document.querySelectorAll('#csRenewalPanelV10814 [data-renew-service-index]')].filter(tr=>tr.querySelector('[data-renew-service-enabled]')?.checked).map(tr=>({service_name:S(tr.querySelector('[data-renew-service-name]')?.value),visit_count:N(tr.querySelector('[data-renew-service-count]')?.value),frequency:S(tr.querySelector('[data-renew-service-frequency]')?.value||'سنوي'),notes:S(tr.querySelector('[data-renew-service-notes]')?.value)})).filter(x=>x.service_name);}
  async function submitRenewal(){
    if(!state.renewal||state.saving)return;const c=client();if(!c)return toast('تعذر الاتصال بقاعدة البيانات','error');
    const start=dateOnly($('csRenewStartV10814')?.value),end=dateOnly($('csRenewEndV10814')?.value);if(!start||!end)return toast('تاريخا بداية ونهاية العقد الجديد مطلوبان','error');if(end<start)return toast('تاريخ نهاية العقد الجديد يسبق البداية','error');
    const u=getUser(),file=$('csRenewFileV10814')?.files?.[0]||null,external=S($('csRenewAttachmentV10814')?.value);let uploaded=null,committed=false;
    state.saving=true;setStatus(file?'جاري رفع العقد الجديد ثم حفظ التجديد...':'جاري إنشاء العقد الجديد داخل عملية واحدة...');
    try{
      if(file)uploaded=await uploadRenewalFile(file);
      const attachment=uploaded||{name:external,file_url:external,storage_bucket:'',storage_path:'',mime_type:'',size_bytes:0};
      const args={p_project_id:ID(state.projectId),p_contract_id:S(state.renewal.contractId)||null,p_contract_key:S(state.renewal.contractKey),p_new_start:start,p_new_end:end,p_new_value:N($('csRenewValueV10814')?.value),p_provider:S($('csRenewProviderV10814')?.value),p_annual_services:collectRenewalServices(),p_notes:S($('csRenewNotesV10814')?.value),p_attachment:attachment,p_alert_date:dateOnly($('csRenewAlertV10814')?.value)||null,p_reactivate:!!$('csRenewReactivateV10814')?.checked,p_user_id:S(u.id),p_user_name:S(u.full_name||u.username)};
      const r=await c.rpc('renew_project_contract_v10814',args);if(r.error)throw r.error;committed=true;state.renewal=null;toast('تم تجديد العقد وإنشاء عقد جديد مع حفظ العقد السابق');await openEditor(state.projectId,'edit',true);renderContractAlerts();
    }catch(e){if(uploaded?.storage_path&&!committed){try{await c.storage.from(uploaded.storage_bucket||CONTRACT_FILES_BUCKET).remove([uploaded.storage_path]);}catch(_){}}const t=friendlyError(e);setStatus(t,'error');toast(t,'error');}finally{state.saving=false;}
  }
  async function startNonRenew(projectId,contractKey='operation',contractId=null){
    if(!canNonRenew()||!canStopFromContract()){toast('لا توجد صلاحية لعدم التجديد وإيقاف المشروع','error');return;}
    await openEditor(ID(projectId),'view');if(!state.open||state.lastError)return;const c=state.model.contracts[contractKey]||emptyContract(),row=(state.contractRows||[]).find(x=>S(x.id)===S(contractId))||currentContractRow(contractKey);state.nonRenew={contractKey,contractId:S(contractId||row?.id||''),contractRow:row};
    showActionLayer(`<h3>تأكيد عدم التجديد وإيقاف المشروع</h3><p class="cs-action-warning">سيتم إنهاء العقد وإيقاف المشروع وإخفاؤه من العمليات الحالية. لن يتم حذف البيانات التاريخية أو المرفقات.</p><div class="cs-renew-old"><div><small>المشروع</small><b>${E(state.project?.name||'-')}</b></div><div><small>العقد</small><b>${E(contractDef(contractKey).title)}</b></div><div><small>رقم العقد</small><b>${E(c.contract_number||row?.contract_number||'-')}</b></div><div><small>تاريخ النهاية</small><b>${E(dateOnly(c.end_date)||dateOnly(row?.end_date)||'-')}</b></div></div><div class="cs-editor-field"><label>سبب عدم التجديد</label><select id="csNonRenewReasonV10814"><option value="">اختر السبب</option>${['السعر','العميل لم يرغب بالتجديد','تم التعاقد مع شركة أخرى','عدم رضا العميل','انتهاء النشاط','المشروع مغلق','قرار إداري','سبب آخر'].map(x=>`<option>${x}</option>`).join('')}</select></div><div class="cs-editor-field"><label>تفاصيل السبب</label><textarea id="csNonRenewDetailsV10814"></textarea></div><div class="cs-editor-guard-actions"><button class="cs-editor-btn danger" data-action="nonrenew-confirm">تأكيد عدم التجديد</button><button class="cs-editor-btn light" data-action="nonrenew-cancel">إلغاء</button></div>`);
  }
  async function confirmNonRenew(){
    if(!state.nonRenew||state.saving)return;const reason=S($('csNonRenewReasonV10814')?.value),details=S($('csNonRenewDetailsV10814')?.value);if(!reason)return toast('اختر سبب عدم التجديد','error');if(reason==='سبب آخر'&&!details)return toast('اكتب تفاصيل السبب الآخر','error');const c=client(),u=getUser();if(!c)return;
    state.saving=true;try{const r=await c.rpc('non_renew_project_contract_v10814',{p_project_id:ID(state.projectId),p_contract_id:S(state.nonRenew.contractId)||null,p_contract_key:S(state.nonRenew.contractKey),p_reason:reason,p_details:details,p_user_id:S(u.id),p_user_name:S(u.full_name||u.username)});if(r.error)throw r.error;const p=projectById(state.projectId);if(p){p.is_active=false;p.status='stopped';p.stopped_reason='contract_not_renewed';}hideActionLayer();state.dirty=false;toast('تم إيقاف العقد والمشروع مع الاحتفاظ بجميع البيانات التاريخية');forceClose();renderContractsOnly();renderContractAlerts();}
    catch(e){const t=friendlyError(e);toast(t,'error');setStatus(t,'error');}finally{state.saving=false;}
  }
  async function startServiceExecution(serviceId){
    let row=(globalData().contractServices||[]).find(x=>S(x.id)===S(serviceId));if(!row){const r=await safeSelect('contract_services',q=>q.select('*').eq('id',S(serviceId)).maybeSingle());row=r.data||null;}if(!row||!row.project_id)return toast('تعذر تحديد المشروع المرتبط بالخدمة','error');
    await openEditor(ID(row.project_id),'edit');if(!state.open||state.lastError)return;state.serviceExecution=row;switchTab('annual');showActionLayer(`<h3>تسجيل تنفيذ خدمة سنوية</h3><div class="cs-renew-old"><div><small>المشروع</small><b>${E(row.project_name||state.project?.name||'-')}</b></div><div><small>الخدمة</small><b>${E(row.service_name||'-')}</b></div><div><small>المنفذ سابقًا</small><b>${N(row.executed_count)}</b></div><div><small>المتبقي</small><b>${Math.max(N(row.visit_count)-N(row.executed_count),0)}</b></div></div><div class="cs-editor-fields"><div class="cs-editor-field"><label>تاريخ التنفيذ</label><input id="csExecuteDateV10814" type="date" value="${dateOnly(new Date().toISOString())}"></div><div class="cs-editor-field"><label>اسم المنفذ</label><input id="csExecuteByV10814" value="${E(getUser().full_name||getUser().username||'')}"></div><div class="cs-editor-field span-all"><label>ملاحظات التنفيذ</label><textarea id="csExecuteNotesV10814"></textarea></div></div><div class="cs-editor-guard-actions"><button class="cs-editor-btn" data-action="execute-service-confirm">حفظ التنفيذ</button><button class="cs-editor-btn light" data-action="execute-service-cancel">إلغاء</button></div>`);
  }
  async function confirmServiceExecution(){
    const row=state.serviceExecution;if(!row||state.saving)return;const c=client(),u=getUser();if(!c)return;state.saving=true;try{const r=await c.rpc('execute_annual_service_v10814',{p_service_id:S(row.id),p_project_id:ID(row.project_id),p_execution_date:dateOnly($('csExecuteDateV10814')?.value),p_executor:S($('csExecuteByV10814')?.value),p_notes:S($('csExecuteNotesV10814')?.value),p_user_id:S(u.id),p_user_name:S(u.full_name||u.username)});if(r.error)throw r.error;hideActionLayer();toast('تم تسجيل تنفيذ الخدمة بنجاح');await openEditor(state.projectId,'edit',true);if(typeof window.refreshAll==='function')await window.refreshAll();}
    catch(e){const t=friendlyError(e);toast(t,'error');setStatus(t,'error');}finally{state.saving=false;}
  }
  async function loadExpiryRegistry(){
    const threshold=new Date();threshold.setDate(threshold.getDate()+30);const end=dateOnly(threshold.toISOString());const r=await safeSelect('contracts',q=>q.select('*').eq('is_active',true).lte('end_date',end).order('end_date',{ascending:true}).limit(500));if(!r.error&&r.data?.length)return r.data;
    return projectList().filter(projectVisible).map(p=>({id:null,project_id:p.id,project_name:p.name,contract_key:'operation',contract_type:'عقد التشغيل الأساسي',contract_number:'',provider:'',end_date:projectEnd(p),status:contractInfo(p).key==='expired'?'expired':'expiring',is_active:true})).filter(x=>x.end_date&&daysLeft(x.end_date)<=30);
  }
  async function renderContractAlerts(){
    if(state.alertsLoading)return;state.alertsLoading=true;const targets=[$('contractsAlertsList'),$('contractDashboardAlerts')].filter(Boolean);targets.forEach(x=>x.innerHTML='<div class="cs-editor-empty">جاري تحميل تنبيهات العقود...</div>');
    try{const rows=await loadExpiryRegistry(),seen=new Set(),clean=rows.filter(x=>{const k=`${S(x.project_id)}:${S(x.contract_key)}:${dateOnly(x.end_date)}`;if(seen.has(k)||['resolved','renewed','not_renewed','archived'].includes(S(x.notification_status||x.status)))return false;seen.add(k);return true;});const html=clean.map(x=>{const p=projectById(x.project_id)||{},d=daysLeft(dateOnly(x.end_date)),expired=d<0,renew=canRenew()?`<button class="cs-editor-btn" onclick="ContractsServicesEditor.startRenewal('${E(x.project_id)}','${E(x.contract_key||'operation')}','${E(x.id||'')}')">تجديد</button>`:'',non=canNonRenew()&&canStopFromContract()?`<button class="cs-editor-btn danger" onclick="ContractsServicesEditor.startNonRenew('${E(x.project_id)}','${E(x.contract_key||'operation')}','${E(x.id||'')}')">لم يجدد</button>`:'';return `<article class="cs-expiry-alert ${expired?'expired':'soon'}"><div><h4>${E(x.project_name||p.name||'-')} — ${E(x.contract_type||contractDef(x.contract_key||'operation').title)}</h4><p>رقم العقد: ${E(x.contract_number||'-')} | مقدم الخدمة: ${E(x.provider||'-')}</p><small>تاريخ الانتهاء: ${E(dateOnly(x.end_date)||'-')} — ${expired?`منتهي منذ ${Math.abs(d)} يوم`:`متبقي ${d} يوم`}</small></div><div class="cs-expiry-actions">${renew}${non}</div></article>`;}).join('')||'<div class="cs-editor-empty">لا توجد عقود منتهية أو قريبة الانتهاء تحتاج قرارًا.</div>';targets.forEach(x=>x.innerHTML=html);}
    catch(e){const t=friendlyError(e);targets.forEach(x=>x.innerHTML=`<div class="cs-editor-empty">${E(t)}</div>`);}finally{state.alertsLoading=false;}
  }

  function contractDate(p,key){return dateOnly(p?.[key]||'');}
  function projectStart(p){return contractDate(p,'contract_start')||contractDate(p,'project_start_date')||contractDate(p,'start_date');}
  function projectEnd(p){return contractDate(p,'contract_end')||contractDate(p,'project_end_date')||contractDate(p,'end_date');}
  function daysLeft(v){if(!v)return null;const d=new Date(v+'T00:00:00');if(Number.isNaN(d.getTime()))return null;const n=new Date();n.setHours(0,0,0,0);return Math.ceil((d-n)/86400000);}
  function contractInfo(p){
    const end=projectEnd(p),d=daysLeft(end);if(!end||d==null)return {key:'missing',text:'بيانات ناقصة',cls:'amber',days:'-'};if(d<0)return {key:'expired',text:'منتهي',cls:'red',days:'منتهي'};if(d<=30)return {key:'soon',text:'قريب الانتهاء',cls:'amber',days:d+' يوم'};return {key:'active',text:'نشط',cls:'green',days:d+' يوم'};
  }
  function projectVisible(p){if(!p)return false;if(p.deleted_at||p.is_deleted===true)return false;if('is_active'in p&&p.is_active!==true)return false;return true;}
  function renderContractsOnly(){
    const body=$('contractsBody');if(!body)return;
    const q=S($('contractSearch')?.value),filter=S($('contractFilterStatus')?.value);
    let rows=projectList().filter(projectVisible).filter(canViewProject);
    if(q)rows=rows.filter(p=>S(p.name).includes(q)||S(p.code||p.project_code).includes(q));if(filter)rows=rows.filter(p=>contractInfo(p).key===filter);
    rows.sort((a,b)=>(daysLeft(projectEnd(a))??999999)-(daysLeft(projectEnd(b))??999999));
    body.innerHTML=rows.map(p=>{const c=contractInfo(p),edit=canEditProject(p)?`<button class="cs-editor-trigger" onclick="ContractsServicesEditor.openEditor('${E(p.id)}','edit')">تعديل</button>`:'';return `<tr><td><b>${E(p.name||'-')}</b></td><td>${N(p.buildings_count)}</td><td>${N(p.units_count)}</td><td>${E(projectStart(p)||'-')}</td><td>${E(projectEnd(p)||'-')}</td><td>${E(c.days)}</td><td><span class="badge ${c.cls}">${E(c.text)}</span></td><td class="row-actions"><button class="light cs-editor-trigger" onclick="ContractsServicesEditor.openEditor('${E(p.id)}','view')">عرض</button>${edit}</td></tr>`;}).join('')||'<tr><td colspan="8">لا توجد بيانات</td></tr>';
    const counted=projectList().filter(projectVisible);const set=(id,key)=>{const el=$(id);if(el)el.textContent=counted.filter(p=>contractInfo(p).key===key).length;};set('contractsActiveCount','active');set('contractsSoonCount','soon');set('contractsExpiredCount','expired');set('contractsMissingCount','missing');renderContractAlerts();
  }
  async function openServiceEditor(serviceId){
    let row=(globalData().contractServices||[]).find(x=>S(x.id)===S(serviceId));
    if(!row){const r=await safeSelect('contract_services',q=>q.select('*').eq('id',S(serviceId)).maybeSingle());row=r.data||null;}
    if(!row||!row.project_id){toast('تعذر تحديد المشروع المرتبط بالخدمة','error');return;}
    await ContractsServicesEditor.openEditor(row.project_id,'edit');
    switchTab('annual');
  }
  function installContractsScope(){
    window.renderContracts=renderContractsOnly;
    window.openContractSmartModal=function(projectId,mode){return ContractsServicesEditor.openEditor(projectId,mode||'edit');};
    window.closeContractSmartModal=function(){return ContractsServicesEditor.closeEditor();};
    window.editContractService=openServiceEditor;
    window.executeContractService=startServiceExecution;
    window.renderContractAlerts=renderContractAlerts;
    window.startContractRenewalV10814=startRenewal;
    window.startContractNonRenewV10814=startNonRenew;
    window.openNewContractService=function(){toast('اختر المشروع من جدول العقود ثم اضغط تعديل، وبعدها أضف الخدمة من تبويب الخدمات السنوية.');};
    const header=$('contracts')?.querySelector('.section-head');const old=header?.querySelector('button[onclick*="showPage(\'projects\'"]');if(old){old.textContent='تحديث العقود';old.removeAttribute('onclick');old.addEventListener('click',renderContractsOnly);}
    const oldModal=$('contractSmartModal');if(oldModal)oldModal.remove();
    const oldServiceModal=$('contractServiceModalV339');if(oldServiceModal)oldServiceModal.remove();
    const oldShow=window.showPage;if(typeof oldShow==='function'&&!oldShow.__contractsEditorWrapped){const wrapped=function(id,btn){const r=oldShow.apply(this,arguments);if(id==='contracts')setTimeout(renderContractsOnly,20);return r;};wrapped.__contractsEditorWrapped=true;window.showPage=wrapped;}
    if(!$('contracts')?.classList.contains('hidden'))renderContractsOnly();
  }

  const ContractsServicesEditor={openEditor,loadProjectContracts,loadAnnualServices,loadContractAttachments,loadNormalizedContracts,saveContractChanges,saveAnnualServiceChanges,startRenewal,startNonRenew,startServiceExecution,renderContractAlerts,closeEditor:requestClose,getState:()=>state};
  window.ContractsServicesEditor=ContractsServicesEditor;

  function boot(){ensureModal();ensureActionLayer();installContractsScope();setTimeout(installContractsScope,900);setTimeout(installContractsScope,2200);setTimeout(renderContractAlerts,500);console.log('Tasneef ContractsServicesEditor '+VERSION+' loaded');}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

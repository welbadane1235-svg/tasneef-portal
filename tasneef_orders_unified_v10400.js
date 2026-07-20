/* Tasneef Orders Recovery V1 — same approved V10714
   المصدر الوحيد لقسم الأوردرات.
   - يحافظ على كل بيانات orders_shared القديمة دون حذف أو إعادة كتابة جماعية.
   - يمنع تشغيل سكربتات الأوردرات القديمة.
   - نوع الطلب: عميل داخلي / جمعية / أوردر خارجي.
   - منشئ الطلب والمعدل يسجلان تلقائياً من جلسة المستخدم.
   - تحقق إلزامي لاسم العميل ورقمه والوحدة والتفاصيل.
   - سجل تدقيق مستقل لكل إنشاء وتعديل.
*/
(function(){
  'use strict';
  if(window.__tasneefOrdersUnifiedV10713Stable) return;
  window.__tasneefOrdersUnifiedV10713Stable=true;
  window.__tasneefOrdersUnifiedV10417=true;
  console.info('Orders module version: ORDERS-RECOVERY-V1');

  const URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const TABLE='orders_shared';
  const AUDIT='order_audit_logs';
  let rows=[], page=1, pageSize=50, total=0, totalPages=1, totalKnown=false, hasMore=false, saving=false, editNo='', latestRequestId=0, loadController=null, searchTimer=null, lastSummary=null, quoteRows=[], recoveryCursors=[null];
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const E=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const now=()=>new Date().toISOString();
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const timeNow=()=>new Intl.DateTimeFormat('ar-SA',{timeZone:'Asia/Riyadh',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date());
  const notify=(t,type='ok')=>{ try{ if(typeof window.msg==='function') window.msg(t,type); else alert(t); }catch(_){ alert(t); } };
  const user=()=>{ try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};} };
  const userName=u=>S(u.name||u.full_name||u.display_name||u.username||u.email||'مستخدم النظام');
  const userRole=u=>S(u.role||u.type||u.user_role||'user');
  const orderNo=r=>S(r?.order_no||r?.data?.['رقم الطلب']||r?.data?.order_no||r?.data?.external_order_number||r?.data?.excel_order_number||r?.data?.legacy_order_number||r?.id);
  const dataOf=r=>r&&r.data&&typeof r.data==='object'?r.data:r||{};
  const field=(r,...keys)=>{const d=dataOf(r); for(const k of keys){ if(d[k]!==undefined&&d[k]!==null&&S(d[k])!=='') return d[k]; } return '';};
  const num=v=>{const n=Number(S(v).replace(/,/g,'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0;};
  const money=v=>num(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';
  const isSupervisorPage=()=>!!document.getElementById('supOrdersBodyV10061')&&!document.getElementById('ordersCardsV360');
  const norm=v=>S(v).toLowerCase().replace(/[\s_\-]+/g,'').replace(/[^\p{L}\p{N}@.]/gu,'');
  const normalizeOrderNumber=v=>S(v).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\s+/g,'');
  window.normalizeOrderNumber=normalizeOrderNumber;
  function userKeys(){
    const u=user();
    return new Set([u.id,u.user_id,u.uuid,u.email,u.username,u.name,u.full_name,u.display_name].map(norm).filter(Boolean));
  }
  function recordMatchesCurrentUser(x){
    if(!x||typeof x!=='object')return false;
    const keys=userKeys();
    const vals=[x.supervisor_id,x.supervisorId,x.assigned_supervisor_id,x.manager_id,x.user_id,x.employee_id,x.id,
      x.supervisor_name,x.supervisorName,x.assigned_supervisor,x.manager_name,x.user_name,x.username,x.name,x.full_name,x.email];
    return vals.map(norm).some(v=>v&&keys.has(v));
  }
  function allProjects(){
    const list=(window.data&&Array.isArray(window.data.projects)?window.data.projects:[]);
    return list.map(p=>({id:S(p.id||p.project_id),name:S(p.name||p.project_name||p.official_name||p.client_name),raw:p})).filter(x=>x.name);
  }
  function supervisorProjectNames(){
    if(!isSupervisorPage())return new Set(allProjects().map(x=>x.name));
    const out=new Set();
    const addProjectRef=v=>{
      const raw=S(v);if(!raw)return;
      const hit=allProjects().find(p=>S(p.id)===raw||norm(p.name)===norm(raw));
      if(hit)out.add(hit.name);
    };
    allProjects().forEach(p=>{
      const x=p.raw||{};
      const candidates=[x.supervisor_id,x.supervisorId,x.assigned_supervisor_id,x.manager_id,x.supervisor_name,x.supervisorName,x.assigned_supervisor,x.manager_name];
      if(candidates.some(v=>userKeys().has(norm(v))))out.add(p.name);
      if(Array.isArray(x.supervisors)&&x.supervisors.some(recordMatchesCurrentUser))out.add(p.name);
    });
    if(window.data&&typeof window.data==='object'){
      ['distributions','assignments','project_assignments','worker_projects','supervisor_projects','allocations'].forEach(k=>{
        const list=Array.isArray(window.data[k])?window.data[k]:[];
        list.forEach(x=>{if(recordMatchesCurrentUser(x))addProjectRef(x.project_id||x.projectId||x.project_name||x.project||x.site_id||x.site_name);});
      });
    }
    return out;
  }
  const systemProjectNames=()=>projects().map(x=>x.name);
  const normalizePhone=v=>{let x=S(v).replace(/\D/g,'');if(x.startsWith('00'))x=x.slice(2);if(x.startsWith('0'))x='966'+x.slice(1);if(!x.startsWith('966')&&x.length===9)x='966'+x;return x;};
  const fileToDataURL=file=>new Promise((resolve,reject)=>{if(!file)return resolve(null);if(file.size>5*1024*1024)return reject(new Error('حجم الإيصال أكبر من 5 ميجابايت'));const r=new FileReader();r.onload=()=>resolve({url:String(r.result||''),data_url:String(r.result||''),name:file.name,type:file.type,size:file.size,saved_at:now()});r.onerror=()=>reject(new Error('تعذر قراءة ملف الإيصال'));r.readAsDataURL(file);});

  async function apiResponse(path,opt={}){
    const res=await fetch(URL+path,{...opt,cache:'no-store',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',Accept:'application/json',Prefer:'return=representation,resolution=merge-duplicates',...(opt.headers||{})}});
    if(!res.ok){
      const body=await res.text().catch(()=>''), err=new Error(body||('HTTP '+res.status));
      err.status=res.status;err.responseBody=body;throw err;
    }
    return res;
  }
  async function api(path,opt={}){
    const res=await apiResponse(path,opt);const text=await res.text();return text?JSON.parse(text):null;
  }

  function currentFilters(overrides={}){
    const isSup=!!$('supOrderSearchV10061')&&!$('orderSearchV233');
    const f={
      search:S($(isSup?'supOrderSearchV10061':'orderSearchV233')?.value),
      project:S($(isSup?'supOrderFilterProjectV10061':'orderProjectFilterV233')?.value),
      executor:S($(isSup?'ouSupExecutorFilter':'orderExecutorFilterV233')?.value),
      sender:S($('orderSenderFilterV233')?.value),
      executionStatus:S($(isSup?'supOrderFilterStatusV10061':'orderStatusFilterV233')?.value),
      paymentStatus:S($(isSup?'ouSupPaymentFilter':'orderPaymentFilterV233')?.value),
      invoiceStatus:S($(isSup?'ouSupBillingFilter':'orderBillingFilterV233')?.value),
      orderType:S($(isSup?'ouSupTypeFilter':'ouAdminTypeFilter')?.value),
      dateFrom:S($('orderFromDateV233')?.value),
      dateTo:S($('orderToDateV233')?.value)
    };
    return {...f,...overrides};
  }
  function allowedProjectsForRequest(){
    if(!isSupervisorPage())return null;
    return [...supervisorProjectNames()];
  }
  const ORDER_LIST_SELECT=[
    'order_no','updated_at',
    'order_number:data->>order_number','external_order_number:data->>external_order_number','legacy_order_number:data->>legacy_order_number','excel_order_number:data->>excel_order_number','order_number_ar:data->>"رقم الطلب"',
    'project_name:data->>project_name','project_alt:data->>"المشروع"','project_name_ar:data->>"اسم المشروع"','flow_project_name:flow->>project_name',
    'customer_name:data->>customer_name','customer_name_ar:data->>"اسم العميل"',
    'customer_phone:data->>customer_phone','customer_phone_ar:data->>"رقم العميل"','mobile:data->>mobile',
    'unit_number:data->>unit_number','unit_number_ar:data->>"رقم الشقة"',
    'executor_name:data->>executor_name','executor_name_ar:data->>"المنفذ"',
    'created_by_name:data->>created_by_name','created_by_ar:data->>"منشئ الطلب"','sender_ar:data->>"مرسل الطلب"','updated_by_name:data->>updated_by_name',
    'execution_status:data->>status','execution_status_ar:data->>"حالة التنفيذ"',
    'payment_status:data->>payment_status','payment_status_ar:data->>"حالة السداد"',
    'billing_status:data->>billing_status','billing_status_ar:data->>"حالة الفوترة"',
    'order_type:data->>order_type','order_type_ar:data->>"نوع الطلب"',
    'invoice_number:data->>invoice_number','invoice_number_ar:data->>"رقم الفاتورة"','invoice_date:data->>invoice_date','invoice_date_ar:data->>"تاريخ الفوترة"',
    'inclusive_total:data->>inclusive_total','total_with_vat:data->>total_with_vat','inclusive_ar:data->>"السعر (شامل الضريبة)"',
    'before_vat:data->>before_vat','before_ar:data->>"السعر قبل الضريبة"','vat_amount:data->>vat_amount','vat_ar:data->>"الضريبة 15%"',
    'cost:data->>cost','cost_ar:data->>"التكلفة"','net_profit:data->>net_profit','profit_ar:data->>"الربح"',
    'order_date:data->>order_date','order_date_ar:data->>"تاريخ الطلب"','description:data->>description','details_ar:data->>"التفاصيل"'
  ].join(',');
  const FILTER_PATHS={
    project:['data->>project_name','data->>"المشروع"','data->>"اسم المشروع"','flow->>project_name'],
    executor:['data->>executor_name','data->>"المنفذ"'],sender:['data->>created_by_name','data->>"منشئ الطلب"','data->>"مرسل الطلب"'],
    executionStatus:['data->>status','data->>"حالة التنفيذ"'],paymentStatus:['data->>payment_status','data->>"حالة السداد"'],
    invoiceStatus:['data->>billing_status','data->>"حالة الفوترة"'],orderType:['data->>order_type','data->>"نوع الطلب"']
  };
  const SEARCH_PATHS=['order_no','data->>order_number','data->>external_order_number','data->>legacy_order_number','data->>excel_order_number','data->>"رقم الطلب"','data->>customer_name','data->>"اسم العميل"','data->>customer_phone','data->>"رقم العميل"','data->>mobile','data->>project_name','data->>"المشروع"','data->>"اسم المشروع"','data->>executor_name','data->>"المنفذ"','data->>order_type','data->>"نوع الطلب"'];
  function pgValue(v){return '"'+S(v).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';}
  function orExact(paths,values){
    const vals=[...new Set((Array.isArray(values)?values:[values]).map(S).filter(Boolean))];if(!vals.length)return '';
    return 'or('+paths.flatMap(p=>vals.map(v=>p+'.eq.'+pgValue(v))).join(',')+')';
  }
  function orLike(paths,values){
    const vals=[...new Set((Array.isArray(values)?values:[values]).map(S).filter(Boolean))];if(!vals.length)return '';
    return 'or('+paths.flatMap(p=>vals.map(v=>p+'.ilike.'+pgValue('*'+v.replace(/\*/g,'')+'*'))).join(',')+')';
  }
  function buildOrdersRestPath(f,{offset=0,limit=51,select=ORDER_LIST_SELECT,withOrder=true}={}){
    const q=new URLSearchParams();q.set('select',select);if(withOrder)q.set('order','updated_at.desc.nullslast,order_no.desc.nullslast');q.set('offset',String(Math.max(0,offset)));q.set('limit',String(Math.max(1,limit)));
    const groups=[];
    const allowed=allowedProjectsForRequest();if(Array.isArray(allowed))groups.push(orExact(FILTER_PATHS.project,allowed.length?allowed:['__NO_PROJECT_ACCESS__']));
    [['project','project'],['executor','executor'],['sender','sender'],['executionStatus','executionStatus'],['paymentStatus','paymentStatus'],['invoiceStatus','invoiceStatus'],['orderType','orderType']].forEach(([fk,pk])=>{
      const value=S(f[fk]);if(!value)return;
      if(fk==='invoiceStatus'&&value==='لم تتم')groups.push('or('+FILTER_PATHS[pk].flatMap(p=>[p+'.eq.'+pgValue(value),p+'.is.null']).join(',')+')');
      else groups.push(orExact(FILTER_PATHS[pk],value));
    });
    if(S(f.search)){const raw=S(f.search),normalized=normalizeOrderNumber(raw);groups.push(orLike(SEARCH_PATHS,[raw,normalized]));}
    const activeGroups=groups.filter(Boolean);if(activeGroups.length)q.set('and','('+activeGroups.join(',')+')');
    if(S(f.dateFrom))q.append('updated_at','gte.'+f.dateFrom+'T00:00:00+03:00');
    if(S(f.dateTo))q.append('updated_at','lte.'+f.dateTo+'T23:59:59+03:00');
    return '/rest/v1/'+TABLE+'?'+q.toString();
  }
  function compactOrderRow(r){
    const pick=(...keys)=>{for(const k of keys){if(r[k]!==undefined&&r[k]!==null&&S(r[k])!=='')return r[k];}return '';};
    const canonical=pick('order_no','order_number','external_order_number','legacy_order_number','excel_order_number','order_number_ar');
    const project=pick('project_name','project_alt','project_name_ar','flow_project_name')||'مشروع غير مرتبط';
    const executor=pick('executor_name','executor_name_ar')||'لم يتم تعيين منفذ';
    return {order_no:pick('order_no')||canonical,updated_at:r.updated_at,data:{
      'رقم الطلب':canonical,order_no:canonical,'اسم المشروع':project,project_name:project,
      'اسم العميل':pick('customer_name','customer_name_ar'),customer_name:pick('customer_name','customer_name_ar'),
      'رقم العميل':pick('customer_phone','customer_phone_ar','mobile'),customer_phone:pick('customer_phone','customer_phone_ar','mobile'),
      'رقم الشقة':pick('unit_number','unit_number_ar'),unit_number:pick('unit_number','unit_number_ar'),
      'المنفذ':executor,executor_name:executor,'حالة التنفيذ':pick('execution_status','execution_status_ar'),status:pick('execution_status','execution_status_ar'),
      'حالة السداد':pick('payment_status','payment_status_ar'),payment_status:pick('payment_status','payment_status_ar'),
      'حالة الفوترة':pick('billing_status','billing_status_ar')||'لم تتم',billing_status:pick('billing_status','billing_status_ar')||'لم تتم',
      'نوع الطلب':pick('order_type','order_type_ar'),order_type:pick('order_type','order_type_ar'),
      'رقم الفاتورة':pick('invoice_number','invoice_number_ar'),invoice_number:pick('invoice_number','invoice_number_ar'),
      'تاريخ الفوترة':pick('invoice_date','invoice_date_ar'),invoice_date:pick('invoice_date','invoice_date_ar'),
      'السعر (شامل الضريبة)':pick('inclusive_total','total_with_vat','inclusive_ar'),'السعر قبل الضريبة':pick('before_vat','before_ar'),'الضريبة 15%':pick('vat_amount','vat_ar'),
      'التكلفة':pick('cost','cost_ar'),'الربح':pick('net_profit','profit_ar'),'تاريخ الطلب':pick('order_date','order_date_ar')||r.updated_at,
      'التفاصيل':pick('description','details_ar'),'منشئ الطلب':pick('created_by_name','created_by_ar','sender_ar'),created_by_name:pick('created_by_name','created_by_ar','sender_ar'),updated_by_name:pick('updated_by_name')
    },__light:true};
  }
  async function loadOrdersEmergencyPage({signal,requestedPage=page,requestedPageSize=pageSize}={}){
    const startedAt=new Date(),started=performance.now();
    const size=Math.max(1,Math.min(Number(requestedPageSize)||50,100));
    const current=Math.max(1,Number(requestedPage)||1);
    const f=currentFilters();
    const exactOrder=normalizeOrderNumber(f.search||'');
    const cursor=recoveryCursors[current-1]||null;
    const body={
      p_limit:size,
      p_before_updated_at:cursor?.updated_at||null,
      p_before_order_no:cursor?.order_no||null,
      p_order_no:exactOrder||null
    };
    let httpStatus=0,errorCode='',errorMessage='';
    try{
      const res=await apiResponse('/rest/v1/rpc/get_orders_emergency_page_v1',{method:'POST',body:JSON.stringify(body),signal,headers:{Prefer:'return=representation'}});
      httpStatus=res.status;
      const payload=await res.json();
      const raw=Array.isArray(payload)?(payload[0]||{}):(payload||{});
      const list=Array.isArray(raw.rows)?raw.rows:[];
      const normalized=list.map(r=>({...r,__light:false}));
      const nextCursor=raw.next_cursor||null;
      if(nextCursor)recoveryCursors[current]=nextCursor;
      console.table({
        moduleVersion:'ORDERS-RECOVERY-V1',tableName:TABLE,
        requestStartedAt:startedAt.toISOString(),requestFinishedAt:new Date().toISOString(),
        durationMs:Math.round(performance.now()-started),httpStatus,rowsCount:normalized.length,
        errorCode:'',errorMessage:''
      });
      return {rows:normalized,page:current,pageSize:size,hasMore:raw.has_more===true};
    }catch(e){
      errorCode=S(e?.code||e?.status||'');errorMessage=S(e?.message||e);
      console.table({
        moduleVersion:'ORDERS-RECOVERY-V1',tableName:TABLE,
        requestStartedAt:startedAt.toISOString(),requestFinishedAt:new Date().toISOString(),
        durationMs:Math.round(performance.now()-started),httpStatus:httpStatus||Number(e?.status)||0,rowsCount:0,
        errorCode,errorMessage
      });
      console.error('Orders load failed:',e);
      throw e;
    }
  }
  window.loadOrdersEmergencyPage=loadOrdersEmergencyPage;

  async function getOrdersPage(f=currentFilters(),{signal,requestedPage=page,requestedPageSize=pageSize}={}){
    const size=Math.max(1,Math.min(Number(requestedPageSize)||50,500)),current=Math.max(1,Number(requestedPage)||1),offset=(current-1)*size;
    const res=await apiResponse(buildOrdersRestPath(f,{offset,limit:size+1}),{signal,headers:{Prefer:'return=representation'}});
    const raw=await res.json();const more=Array.isArray(raw)&&raw.length>size;const pageRows=(Array.isArray(raw)?raw:[]).slice(0,size).map(compactOrderRow);
    return {rows:pageRows,page:current,pageSize:size,hasMore:more};
  }
  function summaryBody(f){return {p_search:f.search||null,p_project:f.project||null,p_executor:f.executor||null,p_sender:f.sender||null,p_execution_status:f.executionStatus||null,p_payment_status:f.paymentStatus||null,p_invoice_status:f.invoiceStatus||null,p_order_type:f.orderType||null,p_date_from:f.dateFrom||null,p_date_to:f.dateTo||null,p_allowed_projects:allowedProjectsForRequest()};}
  async function getOrdersCount(f=currentFilters(),signal){
    const res=await apiResponse(buildOrdersRestPath(f,{offset:0,limit:1,select:'order_no',withOrder:false}),{signal,headers:{Prefer:'count=exact'}});await res.text();
    const cr=S(res.headers.get('content-range')),m=cr.match(/\/(\d+|\*)$/);return m&&m[1]!=='*'?Number(m[1]):NaN;
  }
  async function getOrdersSummary(f=currentFilters(),signal){
    const out=await api('/rest/v1/rpc/get_orders_summary_stable_v10713',{method:'POST',body:JSON.stringify(summaryBody(f)),signal});return Array.isArray(out)?out[0]:out;
  }
  async function fetchAllUnifiedOrders(f=currentFilters()){
    const all=[];let exportPage=1;
    while(true){
      const result=await getOrdersPage(f,{requestedPage:exportPage,requestedPageSize:500});all.push(...result.rows);
      if(!result.hasMore||!result.rows.length)break;exportPage++;if(exportPage>1000)throw new Error('تم إيقاف التصدير لحماية المتصفح من حلقة غير متوقعة');
    }
    return {rows:all,total:all.length};
  }
  async function getOrderDetails(no){
    const paths=['order_no','data->>order_number','data->>external_order_number','data->>legacy_order_number','data->>excel_order_number','data->>"رقم الطلب"'];
    const q=new URLSearchParams();q.set('select','*');q.set('limit','1');q.set('or','('+paths.map(p=>p+'.eq.'+pgValue(no)).join(',')+')');
    const out=await api('/rest/v1/'+TABLE+'?'+q.toString());return Array.isArray(out)?out[0]:null;
  }
  const fetchFullOrder=getOrderDetails;
  window.tasneefOrdersDataV10713={getOrdersPage,getOrdersSummary,getOrderDetails};


  if(!document.getElementById('ouSupervisorRestrictionStyle')){const st=document.createElement('style');st.id='ouSupervisorRestrictionStyle';st.textContent='.ou-supervisor-locked{background:#f3f5f4!important;color:#667!important;cursor:not-allowed!important;opacity:.82}.ou-supervisor-locked:disabled{opacity:.82}';document.head.appendChild(st);}

  const SUPERVISOR_EDIT_ALLOWED_IDS=new Set(['ouStatus','ouPayment']);
  function applySupervisorEditRestrictions(active){
    if(!isSupervisorPage())return;
    const form=$('supOrderFormV10061')||$('orderFormV233')||document.querySelector('#supOrdersSectionV10061 form, #ordersSectionV233 form');
    const root=form||document;
    root.querySelectorAll('input,select,textarea').forEach(el=>{
      const allowed=SUPERVISOR_EDIT_ALLOWED_IDS.has(el.id);
      if(active&&!allowed){
        el.dataset.ouSupervisorLocked='1';
        if(el.tagName==='SELECT'||el.type==='file'||el.type==='date'||el.type==='number')el.disabled=true;
        else el.readOnly=true;
        el.setAttribute('aria-disabled','true');
        el.classList.add('ou-supervisor-locked');
      }else if(el.dataset.ouSupervisorLocked==='1'){
        el.disabled=false;el.readOnly=false;el.removeAttribute('aria-disabled');el.classList.remove('ou-supervisor-locked');delete el.dataset.ouSupervisorLocked;
      }
    });
    const delBtn=document.querySelector('[onclick*="deleteCurrentOrderV233"], [onclick*="deleteCurrent"], #supOrderDeleteV10061');
    if(delBtn)delBtn.style.display=active?'none':'';
    const title=$('supOrderFormTitleV10061');
    if(title&&active)title.textContent='تعديل حالة التنفيذ والسداد فقط';
    let note=$('ouSupervisorEditNotice');
    if(active){
      if(!note){
        note=document.createElement('div');note.id='ouSupervisorEditNotice';note.className='ou-note';
        note.textContent='صلاحية المشرف: يمكن تعديل حالة التنفيذ وحالة السداد فقط. بقية بيانات الأوردر للعرض.';
        const anchor=title||form?.firstElementChild;anchor?.insertAdjacentElement('afterend',note);
      }
    }else note?.remove();
  }

  function projects(){
    const list=allProjects();
    if(!isSupervisorPage())return list;
    const allowed=supervisorProjectNames();
    return list.filter(p=>allowed.has(p.name));
  }
  function projectName(r){
    const d=dataOf(r), direct=field(r,'project_name','المشروع','اسم المشروع','project','projectName','الموقع','site_name','site');
    if(S(direct)) return S(direct);
    const flow=(r&&r.flow&&typeof r.flow==='object')?r.flow:{};
    const flowName=S(flow.project_name||flow['المشروع']||flow.project||flow.site_name);
    if(flowName) return flowName;
    const pid=S(d.project_id||d['معرف المشروع']||d.projectId||flow.project_id||flow.projectId||r?.project_id);
    if(pid){ const hit=allProjects().find(p=>S(p.id)===pid); if(hit) return hit.name; }
    return '';
  }
  function receiptFromRow(r){
    const d=dataOf(r), candidates=[d.__tasneef_order_receipt_v10140,d['بيانات الإيصال'],d.receipt_meta,d.receipt_data,d['الإيصال'],d.receipt,d.receipt_url,d.receiptUrl,d.attachment,d.attachment_url,d.file_url];
    for(const x of candidates){
      if(!x) continue;
      if(typeof x==='string'&&S(x)) return {url:S(x),name:'إيصال '+orderNo(r),type:/\.pdf(?:$|\?)/i.test(x)?'application/pdf':''};
      if(typeof x==='object'){
        const url=S(x.url||x.data_url||x.dataUrl||x.public_url||x.publicUrl||x.path||x.src||x.file);
        if(url) return {url,name:S(x.name||x.file_name||x.filename||'إيصال '+orderNo(r)),type:S(x.type||x.mime_type||x.mime)};
      }
    }
    return null;
  }
  async function openReceipt(idx){
    let r=rows[idx];if(r?.__light)r=await fetchFullOrder(orderNo(r))||r;const rec=receiptFromRow(r); if(!rec?.url){notify('لا يوجد إيصال محفوظ لهذا الأوردر','err');return;}
    const url=rec.url,isPdf=/pdf|\.pdf(?:$|\?)/i.test(rec.type+' '+url);
    const w=window.open('','_blank'); if(!w){notify('اسمح بالنوافذ المنبثقة لعرض الإيصال','err');return;}
    const body=isPdf?`<iframe src="${E(url)}" style="width:100%;height:calc(100vh - 54px);border:0"></iframe>`:`<img src="${E(url)}" alt="الإيصال" style="max-width:100%;height:auto;display:block;margin:auto">`;
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${E(rec.name)}</title><style>body{margin:0;background:#f2f5f4;font-family:Tahoma,Arial}.bar{background:#064b3b;color:#fff;padding:14px 18px;font-weight:800}.content{padding:14px;text-align:center}</style></head><body><div class="bar">${E(rec.name)}</div><div class="content">${body}</div></body></html>`);w.document.close();
  }
  function cardState(r){
    const status=S(field(r,'حالة التنفيذ','status')),payment=S(field(r,'حالة السداد','payment_status')),billing=S(field(r,'حالة الفوترة','billing_status')||'لم تتم'),invoiceNo=S(field(r,'رقم الفاتورة','invoice_number')),invoiceDate=S(field(r,'تاريخ الفوترة','invoice_date'));
    if(/ملغي|ملغى|cancel/i.test(status)) return 'ou-card-cancelled';
    if(/لم ينفذ|جديد|لم يتم/i.test(status)) return 'ou-card-pending';
    const done=/تم التنفيذ|مكتمل|منفذ/i.test(status),paid=/تم السداد|مسدد|مدفوع/i.test(payment),billed=/تمت|مفوتر/i.test(billing)&&!!invoiceNo&&!!invoiceDate;
    return done&&paid&&billed?'ou-card-complete':'ou-card-warning';
  }
  function renderSummary(list){
    const host=$('ordersSummaryV233');if(!host)return;
    const totals=list.reduce((a,r)=>{const inc=num(field(r,'السعر (شامل الضريبة)','inclusive_total','total_with_vat')),bef=num(field(r,'السعر قبل الضريبة','before_vat'))||(inc/1.15),vat=num(field(r,'الضريبة 15%','vat_amount'))||(inc-bef);a.before+=bef;a.vat+=vat;a.inclusive+=inc;return a;},{before:0,vat:0,inclusive:0});
    host.className='ou-summary-fixed';host.innerHTML=`<div><small>السعر قبل الضريبة</small><b>${E(money(totals.before))}</b></div><div><small>الضريبة 15%</small><b>${E(money(totals.vat))}</b></div><div><small>شامل الضريبة</small><b>${E(money(totals.inclusive))}</b></div>`;
  }

  function orderDate(r){
    const raw=S(field(r,'تاريخ الطلب','order_date','created_at')||r?.updated_at); if(!raw)return '';
    const m=raw.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/); if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    const m2=raw.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/); if(m2)return `${m2[3]}-${m2[1].padStart(2,'0')}-${m2[2].padStart(2,'0')}`;
    const dt=new Date(raw); return Number.isNaN(dt.getTime())?'':new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(dt);
  }
  function executors(){
    const out=new Map(), add=(x,forcedRole='')=>{
      if(!x||typeof x!=='object')return;
      const name=S(x.name||x.full_name||x.worker_name||x.username||x.display_name);
      const role=S(forcedRole||x.role||x.type||x.job_title||x.position||x.category||x.worker_type).toLowerCase();
      const activeRaw=S(x.status||x.state||'active').toLowerCase();
      const active=(x.is_active!==false&&x.active!==false&&!/inactive|stopped|موقوف|غير نشط/.test(activeRaw));
      const allowed=/supervisor|technician|technical|مشرف|فني/.test(role);
      if(name&&allowed&&active)out.set(name,{name,role:/technician|technical|فني/.test(role)?'فني':'مشرف'});
    };
    if(window.data){
      (window.data.supervisors||[]).forEach(x=>add(x,'supervisor'));
      (window.data.technicians||[]).forEach(x=>add(x,'technician'));
      ['users','workers','employees'].forEach(k=>(window.data[k]||[]).forEach(x=>add(x)));
    }
    return [...out.values()].sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  }
  function makeNo(){
    const max=rows.reduce((m,r)=>{const z=orderNo(r).match(/(\d+)/g); return Math.max(m,z?Number(z[z.length-1])||0:0);},0);
    return 'ORD-'+String(max+1).padStart(6,'0');
  }
  function stopLegacy(){
    ['__tasneefOrdersV233','__tasneefOrdersSharedSyncDisabled','__tasneefOrdersRootMasterV10031','__tasneefOrdersRootLockV10033','__tasneefOrdersMasterLockV10024','__tasneefOrdersStabilityPatchV10022','__tasneefOrdersFinalStabilityV10023','__tasneefOrdersRootCleanV10189','__tasneefSupervisorOrdersV10061'].forEach(k=>window[k]=true);
  }
  stopLegacy();

  function injectStyle(){ if($('ordersUnifiedStyle10400'))return; const st=document.createElement('style');st.id='ordersUnifiedStyle10400';st.textContent=`
  .ou-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ou-wide{grid-column:1/-1}.ou-required label:after{content:' *';color:#b42318}.ou-invalid{border-color:#d92d20!important;box-shadow:0 0 0 3px rgba(217,45,32,.12)!important}.ou-select{position:relative}.ou-note{background:#f3f8f6;border:1px solid #d7e7e0;padding:9px;border-radius:11px;color:#315d50}.ou-card{background:#fff;border:1px solid var(--line,#dce7e2);border-radius:17px;padding:13px;display:grid;gap:9px}.ou-head{display:flex;justify-content:space-between;gap:9px}.ou-head h3{margin:0;color:var(--brand,#075e4c)}.ou-chips{display:flex;gap:6px;flex-wrap:wrap}.ou-chip{padding:5px 9px;border-radius:999px;background:#edf7f3;color:#075e4c;font-size:12px;font-weight:800}.ou-meta{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.ou-meta div{padding:8px;background:#f8fbfa;border-radius:10px}.ou-meta small{display:block;color:#6a7974}.ou-actions{display:flex;gap:7px;flex-wrap:wrap}.ou-history{display:grid;gap:8px}.ou-history article{padding:10px;border:1px solid #e0e9e5;border-radius:12px;background:#fbfdfc}.ou-modal{position:fixed;inset:0;background:rgba(0,35,28,.52);z-index:100000;display:grid;place-items:center;padding:16px}.ou-modal>div{width:min(900px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:16px}.ou-creator{font-weight:800;color:#075e4c}.ou-money-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.ou-money{padding:10px;border-radius:12px;background:#f4f8f6;border:1px solid #dce8e3}.ou-money small{display:block;color:#67766f}.ou-money b{font-size:15px}.ou-smart-wrap{position:relative}.ou-smart-menu{position:absolute;z-index:10020;top:calc(100% + 4px);right:0;left:0;max-height:230px;overflow:auto;background:#fff;border:1px solid #d7e4de;border-radius:12px;box-shadow:0 12px 30px rgba(0,40,30,.14);padding:5px;display:none}.ou-smart-menu.open{display:block}.ou-smart-option{padding:9px 10px;border-radius:9px;cursor:pointer}.ou-smart-option:hover,.ou-smart-option.active{background:#edf7f3;color:#075e4c}.ou-smart-empty{padding:10px;color:#77847f;text-align:center}.ou-filter-extra{min-width:150px}@media(max-width:800px){.ou-grid{grid-template-columns:1fr}.ou-wide{grid-column:auto}.ou-meta,.ou-money-grid{grid-template-columns:1fr}}
  #ordersSummaryV233.ou-summary-fixed{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px!important;height:auto!important;min-height:0!important;align-items:stretch!important;margin:10px 0!important}
  #ordersSummaryV233.ou-summary-fixed>div{height:auto!important;min-height:76px!important;max-height:none!important;padding:12px!important;border:1px solid #dce7e2!important;border-radius:14px!important;background:#fff!important;display:flex!important;flex-direction:column!important;justify-content:center!important;overflow:visible!important}
  #ordersSummaryV233.ou-summary-fixed small{display:block;color:#66756f;margin-bottom:5px}#ordersSummaryV233.ou-summary-fixed b{font-size:20px;line-height:1.3;color:#063f33;white-space:nowrap}
  .ou-card.ou-card-complete{background:#effaf4;border-color:#80c99f;box-shadow:inset 5px 0 0 #21864f}.ou-card.ou-card-warning{background:#fff9e8;border-color:#e7c96a;box-shadow:inset 5px 0 0 #d5a514}.ou-card.ou-card-pending{background:#fff1f1;border-color:#efaaaa;box-shadow:inset 5px 0 0 #e15c5c}.ou-card.ou-card-cancelled{background:#f7dddd;border-color:#a72b2b;box-shadow:inset 5px 0 0 #861f1f}.ou-card.ou-card-cancelled .ou-head h3{color:#7f1d1d}
  .ou-receipt-disabled{opacity:.5;cursor:not-allowed!important}.ou-actions button{min-width:92px}
  @media(max-width:900px){#ordersSummaryV233.ou-summary-fixed{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:520px){#ordersSummaryV233.ou-summary-fixed{grid-template-columns:1fr!important}}
  
  .ou-quote-pick{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end}.ou-quote-orders{max-height:330px;overflow:auto;border:1px solid #dce7e2;border-radius:14px;padding:8px;background:#fbfdfc}.ou-quote-row{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:9px;border-bottom:1px solid #edf1ef}.ou-quote-row:last-child{border-bottom:0}.ou-quote-row input{width:auto}.ou-quote-tools{display:flex;gap:8px;flex-wrap:wrap}.orders-section-actions-v10410{display:flex!important;gap:8px!important;flex-wrap:wrap!important;align-items:center!important;margin:0!important}.orders-section-actions-v10410 button{white-space:nowrap}
`;document.head.appendChild(st);}

  function optionList(id,values){let d=$(id);if(!d){d=document.createElement('datalist');d.id=id;document.body.appendChild(d);}d.innerHTML=[...new Set(values.filter(Boolean))].map(v=>`<option value="${E(v)}"></option>`).join('');}
  function smartInput(id,getValues){
    const input=$(id); if(!input||input.dataset.ouSmart)return; input.dataset.ouSmart='1'; input.removeAttribute('list');
    const wrap=document.createElement('div');wrap.className='ou-smart-wrap';input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
    const menu=document.createElement('div');menu.className='ou-smart-menu';wrap.appendChild(menu);let active=-1;
    const values=()=>[...new Set((typeof getValues==='function'?getValues():getValues||[]).map(x=>S(x)).filter(Boolean))];
    const draw=()=>{const q=S(input.value).toLowerCase(),all=values(),items=all.filter(x=>!q||x.toLowerCase().includes(q)).slice(0,80);active=-1;menu.innerHTML=items.length?items.map(x=>`<div class="ou-smart-option" data-value="${E(x)}">${E(x)}</div>`).join(''):'<div class="ou-smart-empty">لا توجد نتائج</div>';menu.classList.add('open');};
    input.addEventListener('focus',draw);input.addEventListener('input',draw);
    input.addEventListener('keydown',e=>{const opts=[...menu.querySelectorAll('.ou-smart-option')];if(e.key==='ArrowDown'){e.preventDefault();active=Math.min(opts.length-1,active+1);}else if(e.key==='ArrowUp'){e.preventDefault();active=Math.max(0,active-1);}else if(e.key==='Enter'&&active>=0){e.preventDefault();input.value=opts[active].dataset.value;menu.classList.remove('open');input.dispatchEvent(new Event('change',{bubbles:true}));}else if(e.key==='Escape')menu.classList.remove('open');opts.forEach((o,i)=>o.classList.toggle('active',i===active));opts[active]?.scrollIntoView({block:'nearest'});});
    menu.addEventListener('mousedown',e=>{const o=e.target.closest('.ou-smart-option');if(!o)return;e.preventDefault();input.value=o.dataset.value;menu.classList.remove('open');input.dispatchEvent(new Event('change',{bubbles:true}));});
    document.addEventListener('mousedown',e=>{if(!wrap.contains(e.target))menu.classList.remove('open');});
  }
  function setupSmartInputs(){
    smartInput('ouProject',()=>projects().map(x=>x.name));
    smartInput('ouCustomer',()=>rows.map(r=>S(field(r,'اسم العميل','customer_name'))).filter(Boolean));
    smartInput('ouExecutor',()=>executors().map(x=>x.name));
  }
  function recalcFinance(){
    const inclusive=Math.max(0,num($('ouInclusive')?.value??$('ouPrice')?.value));
    const before=inclusive/1.15, vat=inclusive-before, cost=Math.max(0,num($('ouCost')?.value)), profit=before-cost;
    if($('ouBefore'))$('ouBefore').value=before.toFixed(2);if($('ouVat'))$('ouVat').value=vat.toFixed(2);if($('ouProfit'))$('ouProfit').value=profit.toFixed(2);
  }
  function ensureExtraFilters(){
    const adminHost=$('orderSearchV233')?.closest('.filters')||$('orderSearchV233')?.parentElement;
    if(adminHost&&!$('ouAdminTypeFilter')) adminHost.insertAdjacentHTML('beforeend','<select id="ouAdminTypeFilter" class="ou-filter-extra"><option value="">كل أنواع الطلب</option><option value="internal">عميل داخلي</option><option value="association">جمعية</option><option value="external">أوردر خارجي</option></select>');
    const supHost=$('supOrderSearchV10061')?.closest('.filters')||$('supOrderSearchV10061')?.parentElement;
    if(supHost&&!$('ouSupTypeFilter')) supHost.insertAdjacentHTML('beforeend','<select id="ouSupTypeFilter" class="ou-filter-extra"><option value="">كل أنواع الطلب</option><option value="internal">عميل داخلي</option><option value="association">جمعية</option><option value="external">أوردر خارجي</option></select><select id="ouSupExecutorFilter" class="ou-filter-extra"><option value="">كل المنفذين</option></select><select id="ouSupPaymentFilter" class="ou-filter-extra"><option value="">كل حالات السداد</option></select><select id="ouSupBillingFilter" class="ou-filter-extra"><option value="">كل حالات الفوترة</option><option>تمت</option><option>لم تتم</option></select>');
  }
  function cleanupLegacyReceiptFields(){
    const keep=$('ouReceiptFile');
    document.querySelectorAll('input[type="file"]').forEach(inp=>{
      if(inp===keep) return;
      const accept=S(inp.getAttribute('accept')).toLowerCase();
      const wrap=inp.closest('.split,.field,.form-group,.ou-wide')||inp.parentElement;
      const text=S(wrap?.textContent);
      if(/receipt|إيصال|ايصال/.test((text+' '+accept).toLowerCase())) wrap?.remove();
    });
  }
  function rebuildAdmin(){
    const host=$('orderFormFieldsV233'); if(!host)return false;
    $('orderGroupNoV233')?.closest('.split')?.remove();
    const title=$('orderFormTitleV233'); if(title)title.textContent='إضافة أوردر';
    const note=host.parentElement?.querySelector('.footer-note'); if(note)note.textContent='منشئ الطلب ووقت الإنشاء يسجلان تلقائياً. لا يمكن الحفظ قبل إكمال البيانات الإلزامية.';
    host.className='ou-grid';
    host.innerHTML=`
      <div class="ou-required"><label>نوع الطلب</label><select id="ouType"><option value="">اختر النوع</option><option value="internal">عميل داخلي</option><option value="association">جمعية</option><option value="external">أوردر خارجي</option></select></div>
      <div class="ou-required"><label>المشروع / الموقع</label><input id="ouProject" list="ouProjectsList" placeholder="اكتب للبحث أو اختر"></div>
      <div class="ou-required"><label>اسم العميل / المسؤول</label><input id="ouCustomer" list="ouCustomersList" placeholder="اسم العميل"></div>
      <div class="ou-required"><label>رقم العميل</label><input id="ouPhone" inputmode="tel" placeholder="05xxxxxxxx"></div>
      <div class="ou-required"><label>رقم الشقة / الوحدة / الموقع</label><input id="ouUnit" placeholder="مثال A-12 أو البيسمنت"></div>
      <div><label>المنفذ (مشرف أو فني)</label><input id="ouExecutor" placeholder="اكتب اسم المشرف أو الفني للبحث"></div>
      <div><label>حالة التنفيذ</label><select id="ouStatus"><option>لم ينفذ</option><option>تحت التنفيذ</option><option>تم التنفيذ</option><option>ملغي</option></select></div>
      <div><label>حالة السداد</label><select id="ouPayment"><option value="">غير محدد</option><option>آجل</option><option>تم السداد</option><option>جزئي</option></select></div>
      <div><label>حالة الفوترة</label><select id="ouBilling"><option value="لم تتم">لم تتم</option><option value="تمت">تمت</option></select></div>
      <div><label>رقم الفاتورة</label><input id="ouInvoiceNo" placeholder="يظهر عند اختيار تمت"></div>
      <div><label>تاريخ الفوترة</label><input id="ouInvoiceDate" type="date"></div>
      <div><label>الإجمالي شامل الضريبة</label><input id="ouInclusive" type="number" min="0" step="0.01" placeholder="0.00"></div>
      <div><label>القيمة قبل الضريبة</label><input id="ouBefore" type="number" readonly></div>
      <div><label>الضريبة 15%</label><input id="ouVat" type="number" readonly></div>
      <div><label>التكلفة</label><input id="ouCost" type="number" min="0" step="0.01" placeholder="0.00"></div>
      <div><label>صافي الربح</label><input id="ouProfit" type="number" readonly></div>
      <div class="ou-wide ou-required"><label>تفاصيل الطلب</label><textarea id="ouDetails" rows="4" placeholder="اكتب وصف الطلب بوضوح"></textarea></div>
      <div class="ou-wide"><label>ملاحظات</label><textarea id="ouNotes" rows="2"></textarea></div>
      <div class="ou-wide"><label>الإيصال (PDF أو صورة حتى 5MB)</label><input id="ouReceiptFile" type="file" accept="application/pdf,image/*"><small id="ouReceiptCurrent"></small></div>
      <div class="ou-wide ou-note">منشئ الطلب: <span id="ouCreator" class="ou-creator"></span></div>`;
    cleanupLegacyReceiptFields();
    optionList('ouProjectsList',projects().map(x=>x.name));
    const names=rows.map(r=>S(field(r,'اسم العميل','customer_name'))).filter(Boolean); optionList('ouCustomersList',names);
    $('ouCreator').textContent=userName(user());setupSmartInputs();['ouInclusive','ouCost'].forEach(id=>$(id)?.addEventListener('input',recalcFinance));recalcFinance();
    const search=$('orderSearchV233'); if(search)search.placeholder='بحث برقم الأوردر، النوع، المشروع، العميل، الجوال أو التفاصيل';
    const btn=host.parentElement?.querySelector('.actions button'); if(btn){btn.onclick=save;btn.textContent='حفظ الأوردر';}
    const newBtn=host.parentElement?.querySelectorAll('.actions button')[1]; if(newBtn)newBtn.onclick=clear;
    const delBtn=host.parentElement?.querySelectorAll('.actions button')[2]; if(delBtn)delBtn.onclick=deleteCurrent;
    return true;
  }
  function rebuildSupervisor(){
    const form=$('supOrderEditNoV10061')?.parentElement; if(!form)return false;
    const help=form.querySelector('.sup-help'); if(help)help.textContent='أنشئ الطلب بعد إكمال البيانات المطلوبة. اسم منشئ الطلب يسجل تلقائياً من حسابك.';
    const keepTitle=$('supOrderFormTitleV10061');
    form.innerHTML=`<h2 id="supOrderFormTitleV10061">رفع / تعديل أوردر</h2><div class="sup-help">منشئ الطلب يسجل تلقائياً ولا يمكن تغييره.</div><input type="hidden" id="supOrderEditNoV10061"><div class="ou-grid">
      <div class="ou-required"><label>نوع الطلب</label><select id="ouType"><option value="">اختر النوع</option><option value="internal">عميل داخلي</option><option value="association">جمعية</option><option value="external">أوردر خارجي</option></select></div>
      <div class="ou-required"><label>المشروع / الموقع</label><input id="ouProject" list="ouProjectsList" placeholder="اكتب للبحث"></div>
      <div class="ou-required"><label>اسم العميل / المسؤول</label><input id="ouCustomer" list="ouCustomersList"></div>
      <div class="ou-required"><label>رقم العميل</label><input id="ouPhone" inputmode="tel"></div>
      <div class="ou-required"><label>رقم الشقة / الوحدة / الموقع</label><input id="ouUnit"></div>
      <div><label>المنفذ (مشرف أو فني)</label><input id="ouExecutor" placeholder="اكتب اسم المشرف أو الفني للبحث"></div>
      <div><label>حالة التنفيذ</label><select id="ouStatus"><option>لم ينفذ</option><option>تحت التنفيذ</option><option>تم التنفيذ</option><option>ملغي</option></select></div>
      <div><label>حالة السداد</label><select id="ouPayment"><option value="">غير محدد</option><option>آجل</option><option>تم السداد</option><option>جزئي</option></select></div>
      <div><label>حالة الفوترة</label><select id="ouBilling"><option value="لم تتم">لم تتم</option><option value="تمت">تمت</option></select></div>
      <div><label>رقم الفاتورة</label><input id="ouInvoiceNo" placeholder="يظهر عند اختيار تمت"></div>
      <div><label>تاريخ الفوترة</label><input id="ouInvoiceDate" type="date"></div>
      <div><label>الإجمالي شامل الضريبة</label><input id="ouInclusive" type="number" min="0" step="0.01"></div>
      <div><label>القيمة قبل الضريبة</label><input id="ouBefore" type="number" readonly></div>
      <div><label>الضريبة 15%</label><input id="ouVat" type="number" readonly></div>
      <div><label>التكلفة</label><input id="ouCost" type="number" min="0" step="0.01"></div>
      <div><label>صافي الربح</label><input id="ouProfit" type="number" readonly></div>
      <div class="ou-wide ou-required"><label>تفاصيل الطلب</label><textarea id="ouDetails"></textarea></div>
      <div class="ou-wide"><label>ملاحظات</label><textarea id="ouNotes"></textarea></div>
      <div class="ou-wide"><label>الإيصال (PDF أو صورة حتى 5MB)</label><input id="ouReceiptFile" type="file" accept="application/pdf,image/*"><small id="ouReceiptCurrent"></small></div>
      <div class="ou-wide ou-note">منشئ الطلب: <span id="ouCreator" class="ou-creator"></span></div></div><div class="actions"><button id="ouSaveBtn">حفظ الأوردر</button><button class="light" id="ouNewBtn">أوردر جديد</button></div>`;
    cleanupLegacyReceiptFields();
    optionList('ouProjectsList',projects().map(x=>x.name));optionList('ouCustomersList',rows.map(r=>S(field(r,'اسم العميل','customer_name'))));
    $('ouCreator').textContent=userName(user());setupSmartInputs();['ouInclusive','ouCost'].forEach(id=>$(id)?.addEventListener('input',recalcFinance));recalcFinance();$('ouSaveBtn').onclick=save;$('ouNewBtn').onclick=clear;return true;
  }

  function values(){
    return {type:S($('ouType')?.value),project:S($('ouProject')?.value),customer:S($('ouCustomer')?.value),phone:S($('ouPhone')?.value),unit:S($('ouUnit')?.value),executor:S($('ouExecutor')?.value),status:S($('ouStatus')?.value)||'لم ينفذ',payment:S($('ouPayment')?.value),billing:S($('ouBilling')?.value)||'لم تتم',invoiceNo:S($('ouInvoiceNo')?.value),invoiceDate:S($('ouInvoiceDate')?.value),price:num($('ouInclusive')?.value??$('ouPrice')?.value),cost:num($('ouCost')?.value),details:S($('ouDetails')?.value),notes:S($('ouNotes')?.value)};
  }
  function validate(v){
    const required=[['ouType',v.type,'نوع الطلب'],['ouProject',v.project,'المشروع أو الموقع'],['ouCustomer',v.customer,'اسم العميل'],['ouPhone',v.phone,'رقم العميل'],['ouUnit',v.unit,'رقم الشقة أو الوحدة'],['ouDetails',v.details,'تفاصيل الطلب']];
    document.querySelectorAll('.ou-invalid').forEach(x=>x.classList.remove('ou-invalid'));
    const missing=required.filter(x=>!x[1]); missing.forEach(x=>$(x[0])?.classList.add('ou-invalid'));
    if(missing.length){notify('لا يمكن حفظ الطلب. أكمل: '+missing.map(x=>x[2]).join('، '),'err');$(missing[0][0])?.focus();return false;}
    if(!systemProjectNames().includes(v.project)){ $('ouProject')?.classList.add('ou-invalid'); notify('اختر مشروعاً موجوداً في النظام من القائمة','err'); return false; }
    if(!/^\+?[0-9\s-]{7,15}$/.test(v.phone)){ $('ouPhone')?.classList.add('ou-invalid'); notify('رقم العميل غير صحيح','err'); return false; }
    if(v.billing==='تمت'&&!v.invoiceNo){$('ouInvoiceNo')?.classList.add('ou-invalid');notify('اكتب رقم الفاتورة عند اختيار تمت','err');return false;}
    if(v.billing==='تمت'&&!v.invoiceDate){$('ouInvoiceDate')?.classList.add('ou-invalid');notify('حدد تاريخ الفوترة عند اختيار تمت','err');return false;}
    if(v.price<0||v.cost<0){notify('القيم المالية لا يمكن أن تكون سالبة','err');return false;}
    return true;
  }
  function toData(v,old={}){
    const u=user(), created=old.created_at||old['تاريخ الإنشاء']||old['تاريخ الطلب']||now(), creator=old.created_by_name||old['منشئ الطلب']||old['مرسل الطلب']||userName(u);
    const before=v.price/1.15, vat=v.price-before, profit=before-v.cost;
    return {...old,
      order_type:v.type, 'نوع الطلب':v.type==='internal'?'عميل داخلي':v.type==='association'?'جمعية':'أوردر خارجي',
      project_name:v.project,'المشروع':v.project,customer_name:v.customer,'اسم العميل':v.customer,customer_phone:v.phone,'رقم العميل':v.phone,
      unit_number:v.unit,'رقم الشقة':v.unit,executor_name:v.executor,'المنفذ':v.executor,description:v.details,'التفاصيل':v.details,'ملاحظات':v.notes,
      status:v.status,'حالة التنفيذ':v.status,payment_status:v.payment,'حالة السداد':v.payment,billing_status:v.billing,'حالة الفوترة':v.billing,invoice_number:v.billing==='تمت'?v.invoiceNo:'','رقم الفاتورة':v.billing==='تمت'?v.invoiceNo:'',invoice_date:v.billing==='تمت'?v.invoiceDate:'','تاريخ الفوترة':v.billing==='تمت'?v.invoiceDate:'',
      'السعر (شامل الضريبة)':v.price,inclusive_total:v.price,total_with_vat:v.price,'الضريبة 15%':vat,vat_amount:vat,'السعر قبل الضريبة':before,before_vat:before,'التكلفة':v.cost,cost:v.cost,'الربح':profit,net_profit:profit,
      created_by_id:S(old.created_by_id||old['معرف منشئ الطلب']||u.id||u.user_id||u.email),created_by_name:creator,created_by_role:S(old.created_by_role||old['صفة منشئ الطلب']||userRole(u)),created_at:created,'منشئ الطلب':creator,'مرسل الطلب':creator,
      updated_by_id:S(u.id||u.user_id||u.email),updated_by_name:userName(u),updated_by_role:userRole(u),updated_at:now(),'آخر تعديل بواسطة':userName(u)
    };
  }
  function diff(oldD,newD){
    const labels={order_type:'نوع الطلب',project_name:'المشروع',customer_name:'اسم العميل',customer_phone:'رقم العميل',unit_number:'رقم الشقة/الوحدة',executor_name:'المنفذ',description:'تفاصيل الطلب','ملاحظات':'الملاحظات',status:'حالة التنفيذ',payment_status:'حالة السداد',billing_status:'حالة الفوترة',invoice_number:'رقم الفاتورة',invoice_date:'تاريخ الفوترة','السعر (شامل الضريبة)':'الإجمالي شامل الضريبة','الضريبة 15%':'الضريبة','السعر قبل الضريبة':'قبل الضريبة','التكلفة':'التكلفة','الربح':'صافي الربح'};
    return Object.keys(labels).filter(k=>S(oldD[k])!==S(newD[k])).map(k=>({field_name:k,field_label:labels[k],old_value:S(oldD[k]),new_value:S(newD[k])}));
  }
  async function audit(no,action,changes=[]){
    const u=user(); const items=changes.length?changes:[{field_name:'order',field_label:action==='create'?'إنشاء الطلب':'العملية',old_value:'',new_value:action}];
    const payload=items.map(c=>({order_no:no,action_type:action,...c,changed_by_id:S(u.id||u.user_id||u.email),changed_by_name:userName(u),changed_by_role:userRole(u),changed_at:now()}));
    try{await api('/rest/v1/'+AUDIT,{method:'POST',body:JSON.stringify(payload)});}catch(e){console.warn('تعذر حفظ سجل التدقيق',e);}
  }
  function setOrdersListLoadingState(text='جارٍ تحميل الأوردرات...'){
    const admin=$('ordersCardsV360');if(admin)admin.innerHTML=`<div class="ou-note">${E(text)}</div>`;
    const sup=$('supOrdersBodyV10061');if(sup)sup.innerHTML=`<div class="ou-note">${E(text)}</div>`;
  }
  function setSummaryLoadingState(){
    ['ordersTotalKpiV233','ordersDoneKpiV233','ordersDueKpiV233','ordersProfitKpiV233'].forEach(id=>{const el=$(id);if(el)el.textContent='…';});
    const host=$('ordersSummaryV233');if(host)host.innerHTML='<div class="ou-note">جاري تحميل ملخص الأوردرات…</div>';
  }
  function setSummaryErrorState(){
    ['ordersDoneKpiV233','ordersDueKpiV233','ordersProfitKpiV233'].forEach(id=>{const el=$(id);if(el)el.textContent='—';});
    const host=$('ordersSummaryV233');if(host)host.innerHTML='<div class="ou-note">تعذر تحميل الملخص المالي، بينما قائمة الأوردرات تعمل بصورة مستقلة.</div>';
  }
  function setOrdersError(message){
    const html=`<div class="ou-note">${E(message)} <button class="light" onclick="tasneefOrders10400.load()">إعادة المحاولة</button></div>`;
    const admin=$('ordersCardsV360');if(admin)admin.innerHTML=html;const sup=$('supOrdersBodyV10061');if(sup)sup.innerHTML=html;
  }
  async function load(){
    const requestId=++latestRequestId;
    if(loadController)loadController.abort();
    loadController=new AbortController();
    setOrdersListLoadingState('جاري تحميل آخر الأوردرات…');
    lastSummary=null;totalKnown=false;total=0;totalPages=1;
    ['ordersTotalKpiV233','ordersDoneKpiV233','ordersDueKpiV233','ordersProfitKpiV233'].forEach(id=>{const el=$(id);if(el)el.textContent='—';});
    const summaryHost=$('ordersSummaryV233');if(summaryHost)summaryHost.innerHTML='<div class="ou-note">تم فصل الملخص المالي مؤقتًا حتى استعادة قائمة الأوردرات بصورة مستقرة.</div>';
    try{
      const result=await loadOrdersEmergencyPage({signal:loadController.signal,requestedPage:page,requestedPageSize:pageSize});
      if(requestId!==latestRequestId)return;
      rows=result.rows;page=result.page;pageSize=result.pageSize;hasMore=result.hasMore;
      render();hydrateFilters();optionList('ouCustomersList',rows.map(r=>S(field(r,'اسم العميل','customer_name'))));
    }catch(e){
      if(e.name==='AbortError')return;
      const timeout=/57014|statement timeout|canceling statement/i.test(S(e.message));
      const message=timeout?'تعذر تحميل قائمة الأوردرات بسبب بطء سياسة القراءة في قاعدة البيانات.':'تعذر تحميل قائمة الأوردرات من السيرفر.';
      setOrdersError(message);
    }
  }

  async function save(ev){
    ev?.preventDefault?.(); if(saving)return; const v=values(); if(!validate(v))return; saving=true;
    try{
      const current=editNo?rows.find(r=>orderNo(r)===editNo):null; const no=editNo||makeNo(); const oldD=current?dataOf(current):{};
      let d;
      if(current&&isSupervisorPage()){
        const u=user();
        d={...oldD,
          status:v.status,'حالة التنفيذ':v.status,
          payment_status:v.payment,'حالة السداد':v.payment,
          updated_by_id:S(u.id||u.user_id||u.email),updated_by_name:userName(u),updated_by_role:userRole(u),updated_at:now(),'آخر تعديل بواسطة':userName(u)
        };
      }else{
        d=toData(v,oldD);
        const picked=$('ouReceiptFile')?.files?.[0]; if(picked){const rec=await fileToDataURL(picked);d.__tasneef_order_receipt_v10140=rec;d['بيانات الإيصال']=rec;d['الإيصال']=rec;}
      }
      d['رقم الطلب']=no; d.order_no=no; if(!oldD['تاريخ الطلب'])d['تاريخ الطلب']=today(); if(!oldD['وقت الطلب'])d['وقت الطلب']=timeNow(); d['مرسل الطلب']=d['منشئ الطلب']||d.created_by_name;
      await api('/rest/v1/'+TABLE+'?on_conflict=order_no',{method:'POST',body:JSON.stringify([{order_no:no,data:d,flow:current?.flow||{},updated_at:now()}])});
      await audit(no,current?'update':'create',current?diff(oldD,d):[]); notify(current?'تم تعديل الأوردر وتسجيل التغييرات':'تم إنشاء الأوردر وتسجيل المنشئ تلقائياً','ok'); clear(); await load();
    }catch(e){notify('فشل حفظ الأوردر: '+e.message,'err');}finally{saving=false;}
  }
  function clear(){applySupervisorEditRestrictions(false);editNo='';['ouType','ouProject','ouCustomer','ouPhone','ouUnit','ouExecutor','ouPayment','ouBilling','ouInvoiceNo','ouInvoiceDate','ouInclusive','ouBefore','ouVat','ouCost','ouProfit','ouDetails','ouNotes','ouReceiptFile'].forEach(id=>{if($(id))$(id).value='';});if($('ouStatus'))$('ouStatus').value='لم ينفذ';if($('ouBilling'))$('ouBilling').value='لم تتم';if($('orderNoV233'))$('orderNoV233').value='';if($('orderFormTitleV233'))$('orderFormTitleV233').textContent='إضافة أوردر';if($('supOrderFormTitleV10061'))$('supOrderFormTitleV10061').textContent='رفع أوردر';if($('ouReceiptCurrent'))$('ouReceiptCurrent').textContent='';document.querySelectorAll('.ou-invalid').forEach(x=>x.classList.remove('ou-invalid'));recalcFinance();}
  async function edit(idx){let r=rows[idx];if(!r)return;if(r?.__light)r=await fetchFullOrder(orderNo(r))||r;const d=dataOf(r);editNo=orderNo(r);const set=(id,v)=>{if($(id))$(id).value=S(v)};set('ouType',d.order_type||(/جمعية/.test(S(d['نوع الطلب']||d['تخص']))?'association':/خارجي/.test(S(d['نوع الطلب']))?'external':'internal'));set('ouProject',projectName(r));set('ouCustomer',field(r,'customer_name','اسم العميل'));set('ouPhone',field(r,'customer_phone','رقم العميل'));set('ouUnit',field(r,'unit_number','رقم الشقة'));set('ouExecutor',field(r,'executor_name','المنفذ'));set('ouStatus',field(r,'status','حالة التنفيذ'));set('ouPayment',field(r,'payment_status','حالة السداد'));set('ouBilling',field(r,'billing_status','حالة الفوترة')||'لم تتم');set('ouInvoiceNo',field(r,'invoice_number','رقم الفاتورة'));set('ouInvoiceDate',field(r,'invoice_date','تاريخ الفوترة'));$('ouBilling')?.dispatchEvent(new Event('change',{bubbles:true}));set('ouInvoiceNo',field(r,'invoice_number','رقم الفاتورة'));set('ouInvoiceDate',field(r,'invoice_date','تاريخ الفوترة'));set('ouInclusive',field(r,'السعر (شامل الضريبة)','inclusive_total','total_with_vat'));set('ouBefore',field(r,'السعر قبل الضريبة','before_vat'));set('ouVat',field(r,'الضريبة 15%','vat_amount'));set('ouCost',field(r,'التكلفة','cost'));set('ouProfit',field(r,'الربح','net_profit'));recalcFinance();set('ouDetails',field(r,'description','التفاصيل'));set('ouNotes',field(r,'ملاحظات'));const rec=receiptFromRow(r);if($('ouReceiptCurrent'))$('ouReceiptCurrent').textContent=rec?('الإيصال الحالي: '+rec.name):'لا يوجد إيصال محفوظ';if($('orderNoV233'))$('orderNoV233').value=editNo;if($('orderFormTitleV233'))$('orderFormTitleV233').textContent='تعديل أوردر '+editNo;if($('supOrderFormTitleV10061'))$('supOrderFormTitleV10061').textContent='تعديل أوردر '+editNo;applySupervisorEditRestrictions(true);window.scrollTo({top:0,behavior:'smooth'});}
  async function del(idx){const r=rows[idx];if(!r||!confirm('حذف الأوردر '+orderNo(r)+'؟'))return;try{await api('/rest/v1/'+TABLE+'?order_no=eq.'+encodeURIComponent(orderNo(r)),{method:'DELETE'});await audit(orderNo(r),'delete');notify('تم حذف الأوردر','ok');clear();await load();}catch(e){notify('تعذر الحذف: '+e.message,'err');}}
  function deleteCurrent(){const idx=rows.findIndex(r=>orderNo(r)===editNo);if(idx>=0)del(idx);else notify('اختر أوردر للتعديل أولاً','err');}
  function createdByCurrentUser(r){
    const d=dataOf(r), keys=userKeys();
    const vals=[d.created_by_id,d['معرف منشئ الطلب'],d.created_by_name,d['منشئ الطلب'],d['مرسل الطلب'],d.creator_id,d.creator_name];
    return vals.map(norm).some(v=>v&&keys.has(v));
  }
  function visibleToSupervisor(r){
    if(!isSupervisorPage())return true;
    const mine=supervisorProjectNames();
    return mine.has(projectName(r))||createdByCurrentUser(r);
  }
  function filterRows(){
    const isSup=!!$('supOrderSearchV10061')&&!$('orderSearchV233');
    const q=S($(isSup?'supOrderSearchV10061':'orderSearchV233')?.value).toLowerCase();
    const pf=S($(isSup?'supOrderFilterProjectV10061':'orderProjectFilterV233')?.value);
    const sf=S($(isSup?'supOrderFilterStatusV10061':'orderStatusFilterV233')?.value);
    const tf=S($(isSup?'ouSupTypeFilter':'ouAdminTypeFilter')?.value);
    const ef=S($(isSup?'ouSupExecutorFilter':'orderExecutorFilterV233')?.value);
    const payf=S($(isSup?'ouSupPaymentFilter':'orderPaymentFilterV233')?.value);
    const billf=S($(isSup?'ouSupBillingFilter':'orderBillingFilterV233')?.value);
    const senderf=S($('orderSenderFilterV233')?.value);
    const from=S($('orderFromDateV233')?.value),to=S($('orderToDateV233')?.value);
    return rows.filter(r=>{
      const d=dataOf(r),proj=projectName(r),status=S(field(r,'حالة التنفيذ','status')),exec=S(field(r,'المنفذ','executor_name')),payment=S(field(r,'حالة السداد','payment_status')),billing=S(field(r,'حالة الفوترة','billing_status')||'لم تتم'),sender=S(d.created_by_name||d['منشئ الطلب']||d['مرسل الطلب']),dt=orderDate(r);
      const normalizedQuery=normalizeOrderNumber(q); const normalizedNo=normalizeOrderNumber(orderNo(r)); const text=[orderNo(r),proj,...Object.values(d)].join(' ').toLowerCase();
      const rawType=S(d.order_type||(/جمعية/.test(S(d['نوع الطلب']))?'association':/خارجي/.test(S(d['نوع الطلب']))?'external':'internal'));
      return visibleToSupervisor(r)&&(!q||normalizedNo.includes(normalizedQuery)||text.includes(q))&&(!pf||proj===pf)&&(!sf||status===sf)&&(!tf||rawType===tf)&&(!ef||exec===ef)&&(!payf||payment===payf)&&(!billf||billing===billf)&&(!senderf||sender===senderf)&&(!from||dt>=from)&&(!to||dt<=to);
    });
  }
  function receiptFileFromDataUrl(rec, no){
    try{
      const url=S(rec?.url); if(!url.startsWith('data:')) return null;
      const m=url.match(/^data:([^;,]+)?(;base64)?,(.*)$/); if(!m) return null;
      const mime=m[1]||rec?.type||'application/octet-stream';
      const raw=m[2]?atob(m[3]):decodeURIComponent(m[3]);
      const bytes=new Uint8Array(raw.length); for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
      const ext=/pdf/i.test(mime)?'.pdf':/png/i.test(mime)?'.png':/webp/i.test(mime)?'.webp':'.jpg';
      const name=S(rec?.name||('receipt-'+no+ext)).replace(/[\/:*?"<>|]+/g,'-');
      return new File([bytes],name,{type:mime});
    }catch(e){console.warn('receiptFileFromDataUrl failed',e);return null;}
  }
  function fullOrderWhatsappText(r, receipt){
    const d=dataOf(r),inc=num(field(r,'السعر (شامل الضريبة)','inclusive_total','total_with_vat')),
      bef=num(field(r,'السعر قبل الضريبة','before_vat'))||(inc/1.15),
      vat=num(field(r,'الضريبة 15%','vat_amount'))||(inc-bef),cost=num(field(r,'التكلفة','cost')),
      profit=num(field(r,'الربح','net_profit'))||(bef-cost);
    const lines=[
      `*تفاصيل الأوردر ${orderNo(r)}*`,
      `تاريخ الطلب: ${field(r,'تاريخ الطلب','order_date','created_at')||'-'}`,
      `نوع الطلب: ${d['نوع الطلب']||d.order_type||'-'}`,
      `المشروع / الموقع: ${projectName(r)||'-'}`,
      `اسم العميل: ${field(r,'اسم العميل','customer_name')||'-'}`,
      `رقم العميل: ${field(r,'رقم العميل','customer_phone')||'-'}`,
      `الشقة / الوحدة / الموقع: ${field(r,'رقم الشقة','unit_number')||'-'}`,
      `المنفذ: ${field(r,'المنفذ','executor_name')||'-'}`,
      `حالة التنفيذ: ${field(r,'حالة التنفيذ','status')||'-'}`,
      `حالة السداد: ${field(r,'حالة السداد','payment_status')||'-'}`,
      `حالة الفوترة: ${effectiveBilling(r)||'-'}`,
      `رقم الفاتورة: ${field(r,'رقم الفاتورة','invoice_number')||'-'}`,
      `تاريخ الفوترة: ${field(r,'تاريخ الفوترة','invoice_date')||'-'}`,
      '',
      '*القيم المالية*',
      `قبل الضريبة: ${money(bef)}`,
      `الضريبة 15%: ${money(vat)}`,
      `شامل الضريبة: ${money(inc)}`,
      `التكلفة: ${money(cost)}`,
      `صافي الربح: ${money(profit)}`,
      '',
      `تفاصيل الطلب: ${field(r,'التفاصيل','description')||'-'}`,
      `ملاحظات: ${field(r,'ملاحظات','notes')||'-'}`,
      `منشئ الطلب: ${d.created_by_name||d['منشئ الطلب']||d['مرسل الطلب']||'-'}`,
      `آخر تعديل بواسطة: ${d.updated_by_name||'-'}`
    ];
    const publicUrl=S(receipt?.url);
    if(publicUrl&&/^https?:\/\//i.test(publicUrl)&&!/github\.io\/.*404/i.test(publicUrl)) lines.push('',`رابط الإيصال: ${publicUrl}`);
    else if(receipt) lines.push('','يوجد إيصال مرفق مع الأوردر.');
    return lines.join('\n');
  }
  async function sendWhatsApp(idx){
    let r=rows[idx];if(!r)return;if(r?.__light)r=await getOrderDetails(orderNo(r))||r;
    const phone=normalizePhone(field(r,'رقم العميل','customer_phone'));if(!phone){notify('لا يوجد رقم عميل صالح','err');return;}
    const receipt=receiptFromRow(r), text=fullOrderWhatsappText(r,receipt), file=receiptFileFromDataUrl(receipt,orderNo(r));
    try{
      if(file&&navigator.share&&navigator.canShare?.({files:[file]})){
        await navigator.share({title:'أوردر '+orderNo(r),text,files:[file]});
        notify('تم تجهيز تفاصيل الأوردر والإيصال للمشاركة عبر واتساب','ok');
        return;
      }
    }catch(e){ if(e?.name==='AbortError')return; console.warn('Native share failed',e); }
    if(receipt?.url&&receipt.url.startsWith('data:')){
      try{
        const a=document.createElement('a');a.href=receipt.url;a.download=receipt.name||('إيصال '+orderNo(r));document.body.appendChild(a);a.click();a.remove();
        notify('تم تنزيل الإيصال. سيتم فتح واتساب؛ أرفق الملف المحمّل مع الرسالة.','ok');
      }catch(e){}
    }else if(receipt?.url&&/^https?:\/\//i.test(receipt.url)){
      // الرابط العام مدرج داخل الرسالة، لذلك لا نحتاج تنزيله.
    }
    window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(text),'_blank');
  }
  async function viewOrder(idx){
    let r=rows[idx]; if(!r)return;if(r?.__light)r=await fetchFullOrder(orderNo(r))||r;
    const d=dataOf(r),inclusive=num(field(r,'السعر (شامل الضريبة)','inclusive_total','total_with_vat')),before=num(field(r,'السعر قبل الضريبة','before_vat'))||(inclusive/1.15),vat=num(field(r,'الضريبة 15%','vat_amount'))||(inclusive-before),cost=num(field(r,'التكلفة','cost')),profit=num(field(r,'الربح','net_profit'))||(before-cost),receipt=receiptFromRow(r);
    const item=(label,value)=>`<div><small>${E(label)}</small><b>${E(value||'-')}</b></div>`;
    document.body.insertAdjacentHTML('beforeend',`<div class="ou-modal" onclick="if(event.target===this)this.remove()"><div style="width:min(900px,96vw)"><div class="ou-head"><h2>عرض الأوردر ${E(orderNo(r))}</h2><button class="light" onclick="this.closest('.ou-modal').remove()">إغلاق</button></div><div class="ou-meta">${item('المشروع',projectName(r))}${item('نوع الطلب',d['نوع الطلب']||d.order_type)}${item('العميل',field(r,'اسم العميل','customer_name'))}${item('الجوال',field(r,'رقم العميل','customer_phone'))}${item('الوحدة / الموقع',field(r,'رقم الشقة','unit_number'))}${item('المنفذ',field(r,'المنفذ','executor_name'))}${item('حالة التنفيذ',field(r,'حالة التنفيذ','status'))}${item('حالة السداد',field(r,'حالة السداد','payment_status'))}${item('حالة الفوترة',effectiveBilling(r))}${item('رقم الفاتورة',field(r,'رقم الفاتورة','invoice_number'))}${item('تاريخ الفوترة',field(r,'تاريخ الفوترة','invoice_date'))}${item('منشئ الطلب',d.created_by_name||d['منشئ الطلب'])}${item('آخر تعديل',d.updated_by_name)}</div><div class="ou-money-grid"><div class="ou-money"><small>قبل الضريبة</small><b>${E(money(before))}</b></div><div class="ou-money"><small>الضريبة 15%</small><b>${E(money(vat))}</b></div><div class="ou-money"><small>شامل الضريبة</small><b>${E(money(inclusive))}</b></div><div class="ou-money"><small>التكلفة</small><b>${E(money(cost))}</b></div><div class="ou-money"><small>صافي الربح</small><b>${E(money(profit))}</b></div></div><div class="ou-note" style="margin-top:12px"><b>تفاصيل الطلب</b><p>${E(field(r,'التفاصيل','description')||'-')}</p><b>ملاحظات</b><p>${E(field(r,'ملاحظات','notes')||'-')}</p></div><div class="actions"><button class="light ${receipt?'':'ou-receipt-disabled'}" ${receipt?'':'disabled'} onclick="tasneefOrders10400.openReceipt(${idx})">عرض الإيصال</button><button class="light" onclick="tasneefOrders10400.sendWhatsApp(${idx})">إرسال واتساب</button></div></div></div>`);
  }
  function card(r,idx){
    const d=dataOf(r),type=S(d['نوع الطلب']||d.order_type||'-'),creator=S(d.created_by_name||d['منشئ الطلب']||d['مرسل الطلب']||'-');
    const inclusive=num(field(r,'السعر (شامل الضريبة)','inclusive_total','total_with_vat')),before=num(field(r,'السعر قبل الضريبة','before_vat'))||(inclusive/1.15),vat=num(field(r,'الضريبة 15%','vat_amount'))||(inclusive-before),cost=num(field(r,'التكلفة','cost')),profit=num(field(r,'الربح','net_profit'))||(before-cost);
    const receipt=receiptFromRow(r)||r?.__has_receipt,receiptAvailable=!!r?.__light||!!receipt,state=cardState(r);
    return `<article class="ou-card ${state}"><div class="ou-head"><div><h3>${E(orderNo(r))}</h3><small>${E(field(r,'تاريخ الطلب','created_at')||'-')}</small></div><span class="ou-chip">${E(type)}</span></div><div class="ou-chips"><span class="ou-chip">${E(field(r,'حالة التنفيذ','status')||'-')}</span><span class="ou-chip">${E(field(r,'حالة السداد','payment_status')||'غير محدد')}</span><span class="ou-chip">المنفذ: ${E(field(r,'المنفذ','executor_name')||'غير محدد')}</span><span class="ou-chip">الفوترة: ${E(field(r,'حالة الفوترة','billing_status')||'لم تتم')}</span></div><div class="ou-meta"><div><small>المشروع</small><b>${E(projectName(r)||'-')}</b></div><div><small>العميل</small><b>${E(field(r,'اسم العميل','customer_name')||'-')}</b></div><div><small>الجوال</small><b>${E(field(r,'رقم العميل','customer_phone')||'-')}</b></div><div><small>الوحدة</small><b>${E(field(r,'رقم الشقة','unit_number')||'-')}</b></div><div><small>المنشئ</small><b>${E(creator)}</b></div><div><small>آخر تعديل</small><b>${E(d.updated_by_name||'-')}</b></div><div><small>رقم الفاتورة</small><b>${E(field(r,'رقم الفاتورة','invoice_number')||'-')}</b></div><div><small>تاريخ الفوترة</small><b>${E(field(r,'تاريخ الفوترة','invoice_date')||'-')}</b></div></div><div class="ou-money-grid"><div class="ou-money"><small>قبل الضريبة</small><b>${E(money(before))}</b></div><div class="ou-money"><small>الضريبة 15%</small><b>${E(money(vat))}</b></div><div class="ou-money"><small>شامل الضريبة</small><b>${E(money(inclusive))}</b></div><div class="ou-money"><small>التكلفة</small><b>${E(money(cost))}</b></div><div class="ou-money"><small>صافي الربح</small><b>${E(money(profit))}</b></div></div><p>${E(field(r,'التفاصيل','description')||'')}</p><div class="ou-actions"><button class="light" onclick="tasneefOrders10400.view(${idx})">عرض</button><button onclick="tasneefOrders10400.edit(${idx})">تعديل</button><button class="light ${receiptAvailable?'':'ou-receipt-disabled'}" ${receiptAvailable?'':'disabled'} onclick="tasneefOrders10400.openReceipt(${idx})">عرض الإيصال</button><button class="light" onclick="tasneefOrders10400.sendWhatsApp(${idx})">إرسال واتساب</button><button class="light" onclick="tasneefOrders10400.history('${E(orderNo(r))}')">سجل التعديلات</button><button class="danger" onclick="tasneefOrders10400.del(${idx})">حذف</button></div></article>`;
  }
  function renderSummaryFromServer(summary){
    if(!summary)return;
    if($('ordersTotalKpiV233'))$('ordersTotalKpiV233').textContent=Number(summary.total_orders||0).toLocaleString('ar-SA');
    if($('ordersDoneKpiV233'))$('ordersDoneKpiV233').textContent=Number(summary.completed_orders||0).toLocaleString('ar-SA');
    if($('ordersDueKpiV233'))$('ordersDueKpiV233').textContent=Number(summary.unpaid_orders||0).toLocaleString('ar-SA');
    if($('ordersProfitKpiV233'))$('ordersProfitKpiV233').textContent=money(summary.total_net_profit||0).replace(' ر.س','');
    const hasFinancial=['total_before_vat','total_vat_amount','total_inclusive'].some(k=>Object.prototype.hasOwnProperty.call(summary,k));
    if(!hasFinancial){renderSummary(rows);return;}
    const before=num(summary.total_before_vat),vat=num(summary.total_vat_amount),inclusive=num(summary.total_inclusive);
    const host=$('ordersSummaryV233');if(host){host.className='ou-summary-fixed';host.innerHTML=`<div><small>السعر قبل الضريبة</small><b>${E(money(before))}</b></div><div><small>الضريبة 15%</small><b>${E(money(vat))}</b></div><div><small>شامل الضريبة</small><b>${E(money(inclusive))}</b></div>`;}
  }
  function render(){
    const startNo=rows.length?((page-1)*pageSize+1):0,endNo=rows.length?(startNo+rows.length-1):0;
    const totalLabel=totalKnown?` من أصل ${total.toLocaleString('ar-SA')} أوردرًا`:' — الإجمالي قيد الحساب';
    const pageLabel=totalKnown?`صفحة ${page.toLocaleString('ar-SA')} من ${totalPages.toLocaleString('ar-SA')}`:`صفحة ${page.toLocaleString('ar-SA')}`;
    const prevDisabled=page<=1,nextDisabled=totalKnown?page>=totalPages:!hasMore;
    const admin=$('ordersCardsV360');
    if(admin){
      admin.innerHTML=rows.map((r,idx)=>card(r,idx)).join('')||'<div class="ou-note">لا توجد أوردرات مطابقة للفلاتر.</div>';
      const p=$('ordersPagerV360');if(p)p.innerHTML=`<button class="light" ${prevDisabled?'disabled':''} onclick="tasneefOrders10400.page(-1)">السابق</button><b>عرض ${startNo.toLocaleString('ar-SA')}–${endNo.toLocaleString('ar-SA')}${totalLabel} — ${pageLabel}</b><select id="ouPageSize" aria-label="عدد الأوردرات في الصفحة"><option value="25" ${pageSize===25?'selected':''}>25</option><option value="50" ${pageSize===50?'selected':''}>50</option><option value="100" ${pageSize===100?'selected':''}>100</option></select><button class="light" ${nextDisabled?'disabled':''} onclick="tasneefOrders10400.page(1)">التالي</button>`;
      const ps=$('ouPageSize');if(ps)ps.onchange=()=>{pageSize=Number(ps.value)||50;page=1;recoveryCursors=[null];load();};
    }
    const sup=$('supOrdersBodyV10061');if(sup)sup.innerHTML=rows.map((r,idx)=>card(r,idx)).join('')||'<div class="ou-note">لا توجد أوردرات مطابقة للفلاتر.</div>';
    if(lastSummary)renderSummaryFromServer(lastSummary);
  }
  function hydrateFilters(){
    const fill=(id,vals,first)=>{const el=$(id);if(!el)return;const cur=el.value;el.innerHTML=`<option value="">${first}</option>`+[...new Set(vals.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar')).map(x=>`<option value="${E(x)}">${E(x)}</option>`).join('');if([...el.options].some(o=>o.value===cur))el.value=cur;};
    const projs=isSupervisorPage()?[...supervisorProjectNames()]:systemProjectNames();
    const execs=executors().map(x=>x.name);
    const stats=['لم ينفذ','قيد التنفيذ','تم التنفيذ','ملغي'];
    const pays=['آجل','جزئي','تم السداد','غير مسدد'];
    const bills=['لم تتم','تمت'];
    fill('orderProjectFilterV233',projs,'كل المشاريع');fill('supOrderFilterProjectV10061',projs,'كل المشاريع');
    fill('orderStatusFilterV233',stats,'كل الحالات');fill('supOrderFilterStatusV10061',stats,'كل الحالات');
    fill('orderExecutorFilterV233',execs,'كل المنفذين');fill('ouSupExecutorFilter',execs,'كل المنفذين');
    fill('orderPaymentFilterV233',pays,'كل حالات السداد');fill('ouSupPaymentFilter',pays,'كل حالات السداد');
    fill('orderBillingFilterV233',bills,'كل حالات الفوترة');fill('ouSupBillingFilter',bills,'كل حالات الفوترة');
  }
  async function history(no){try{const h=await api('/rest/v1/'+AUDIT+'?order_no=eq.'+encodeURIComponent(no)+'&select=*&order=changed_at.desc');document.body.insertAdjacentHTML('beforeend',`<div class="ou-modal" onclick="if(event.target===this)this.remove()"><div><div class="ou-head"><h2>سجل تعديلات ${E(no)}</h2><button class="light" onclick="this.closest('.ou-modal').remove()">إغلاق</button></div><div class="ou-history">${(h||[]).map(x=>`<article><b>${E(x.changed_by_name||'-')}</b> — ${E(x.field_label||x.action_type||'-')}<br><small>${E(new Date(x.changed_at).toLocaleString('ar-SA',{hour12:true}))}</small><div>${E(x.old_value||'-')} ⟵ ${E(x.new_value||'-')}</div></article>`).join('')||'<div class="ou-note">لا توجد تعديلات مسجلة</div>'}</div></div></div>`);}catch(e){notify('شغّل ملف SQL الخاص بسجل التعديلات أولاً','err');}}
  function scheduleLoad(immediate=false){
    clearTimeout(searchTimer);
    if(immediate)return load();
    searchTimer=setTimeout(()=>load(),400);
  }
  function bind(){
    const ids=['orderSearchV233','orderProjectFilterV233','orderExecutorFilterV233','orderSenderFilterV233','orderStatusFilterV233','orderPaymentFilterV233','orderBillingFilterV233','orderFromDateV233','orderToDateV233','supOrderSearchV10061','supOrderFilterProjectV10061','supOrderFilterStatusV10061','ouAdminTypeFilter','ouSupTypeFilter','ouSupExecutorFilter','ouSupPaymentFilter','ouSupBillingFilter'];
    ids.forEach(id=>{const el=$(id);if(el&&!el.dataset.ouBound){el.dataset.ouBound='1';el.addEventListener('input',()=>{page=1;recoveryCursors=[null];scheduleLoad(false)});el.addEventListener('change',()=>{page=1;recoveryCursors=[null];scheduleLoad(true)});}});
  }
  window.resetOrdersFiltersV233=function(){['orderSearchV233','orderProjectFilterV233','orderExecutorFilterV233','orderSenderFilterV233','orderStatusFilterV233','orderPaymentFilterV233','orderBillingFilterV233','orderFromDateV233','orderToDateV233','ouAdminTypeFilter','supOrderSearchV10061','supOrderFilterProjectV10061','supOrderFilterStatusV10061','ouSupTypeFilter','ouSupExecutorFilter','ouSupPaymentFilter','ouSupBillingFilter'].forEach(id=>{if($(id))$(id).value='';});page=1;load();};
  function boot(){stopLegacy();injectStyle();fixOrdersHeader();const ok=rebuildAdmin()||rebuildSupervisor();cleanupLegacyReceiptFields();if(!ok){console.error('تعذر تهيئة قسم الأوردرات: المكوّن الأساسي غير موجود');return;}ensureExtraFilters();setupSmartInputs();hydrateFilters();['ouInclusive','ouCost'].forEach(id=>{const el=$(id);if(el&&!el.dataset.ouCalc){el.dataset.ouCalc='1';el.addEventListener('input',recalcFinance);}});bind();const bill=$('ouBilling');if(bill&&!bill.dataset.ouBilling){bill.dataset.ouBilling='1';const sync=()=>{const done=bill.value==='تمت';if($('ouInvoiceNo'))$('ouInvoiceNo').disabled=!done;if($('ouInvoiceDate'))$('ouInvoiceDate').disabled=!done;if(!done){if($('ouInvoiceNo'))$('ouInvoiceNo').value='';if($('ouInvoiceDate'))$('ouInvoiceDate').value='';}};bill.addEventListener('change',sync);sync();}clear();load();}

  function currentFilteredOrders(){ return rows; }
  function isDeferredOrder(r){
    const payment=S(field(r,'حالة السداد','payment_status')).replace(/\s+/g,' ').trim();
    return /^(آجل|اجل)$/i.test(payment);
  }
  function quoteProjectOptions(){
    const allowed=new Set(systemProjectNames());return [...new Set(rows.filter(r=>isDeferredOrder(r)&&allowed.has(projectName(r))).map(projectName).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  }
  function ensureXlsx(){
    if(window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise((resolve,reject)=>{
      const old=document.querySelector('script[data-ou-xlsx]');
      if(old){old.addEventListener('load',()=>resolve(window.XLSX));old.addEventListener('error',reject);return;}
      const s=document.createElement('script');s.dataset.ouXlsx='1';s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.onload=()=>resolve(window.XLSX);s.onerror=()=>reject(new Error('تعذر تحميل مكتبة Excel'));document.head.appendChild(s);
    });
  }
  async function exportOrdersExcel(){
    try{
      const XLSX=await ensureXlsx(), result=await fetchAllUnifiedOrders(currentFilters()), list=result.rows;
      if(Number(result.total)!==list.length)console.warn('Export count differs',result.total,list.length);
      if(!list.length){notify('لا توجد أوردرات مطابقة للتصدير','err');return;}
      const aoa=[['رقم الأوردر','تاريخ الطلب','نوع الطلب','المشروع','اسم العميل','رقم العميل','الوحدة/الموقع','المنفذ','حالة التنفيذ','حالة السداد','حالة الفوترة','رقم الفاتورة','تاريخ الفوترة','قبل الضريبة','الضريبة 15%','شامل الضريبة','التكلفة','صافي الربح','التفاصيل','الملاحظات','منشئ الطلب','آخر تعديل بواسطة']];
      list.forEach(r=>{
        const d=dataOf(r),inc=num(field(r,'السعر (شامل الضريبة)','inclusive_total','total_with_vat')),bef=num(field(r,'السعر قبل الضريبة','before_vat'))||(inc/1.15),vat=num(field(r,'الضريبة 15%','vat_amount'))||(inc-bef),cost=num(field(r,'التكلفة','cost')),profit=num(field(r,'الربح','net_profit'))||(bef-cost);
        aoa.push([orderNo(r),orderDate(r),S(d['نوع الطلب']||d.order_type),projectName(r),field(r,'اسم العميل','customer_name'),field(r,'رقم العميل','customer_phone'),field(r,'رقم الشقة','unit_number'),field(r,'المنفذ','executor_name'),field(r,'حالة التنفيذ','status'),field(r,'حالة السداد','payment_status'),effectiveBilling(r),field(r,'رقم الفاتورة','invoice_number'),field(r,'تاريخ الفوترة','invoice_date'),bef,vat,inc,cost,profit,field(r,'التفاصيل','description'),field(r,'ملاحظات','notes'),S(d.created_by_name||d['منشئ الطلب']),S(d.updated_by_name||d['آخر تعديل بواسطة'])]);
      });
      const ws=XLSX.utils.aoa_to_sheet(aoa);ws['!cols']=[14,12,16,22,22,16,16,18,16,16,16,17,14,15,15,15,15,15,38,28,20,20].map(w=>({wch:w}));
      for(let r=1;r<aoa.length;r++) for(let c=13;c<=17;c++){const cell=XLSX.utils.encode_cell({r,c});if(ws[cell])ws[cell].z='#,##0.00';}
      ws['!autofilter']={ref:`A1:V${aoa.length}`};
      const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'الأوردرات');
      XLSX.writeFile(wb,`سجل_الأوردرات_${today()}.xlsx`,{compression:true,cellStyles:true});
    }catch(e){notify('تعذر إنشاء ملف Excel: '+e.message,'err');}
  }
  function effectiveBilling(r){
    const no=S(field(r,'رقم الفاتورة','invoice_number')),dt=S(field(r,'تاريخ الفوترة','invoice_date')),raw=S(field(r,'حالة الفوترة','billing_status'));
    return (no||dt||/تمت|مفوتر/i.test(raw))?'تمت':'لم تتم';
  }
  function openQuoteBuilder(){
    document.querySelector('.ou-quote-modal')?.remove();
    const projectsList=quoteProjectOptions();
    const html=`<div class="ou-modal ou-quote-modal" onclick="if(event.target===this)this.remove()"><div style="width:min(1050px,96vw)"><div class="ou-head"><h2>إنشاء عرض سعر</h2><button class="light" onclick="this.closest('.ou-modal').remove()">إغلاق</button></div>
      <div class="ou-grid"><div><label>المشروع</label><select id="ouQuoteProject"><option value="">اختر المشروع</option>${projectsList.map(x=>`<option value="${E(x)}">${E(x)}</option>`).join('')}</select></div><div><label>رقم عرض السعر</label><input id="ouQuoteNo" value="QUO-${String(Date.now()).slice(-6)}"></div><div><label>التاريخ</label><input id="ouQuoteDate" type="date" value="${today()}"></div><div><label>المرجع</label><input id="ouQuoteRef" value="مجموعة أوردرات"></div><div><label>العميل</label><input id="ouQuoteCustomer"></div><div><label>الهاتف</label><input id="ouQuotePhone"></div><div class="ou-wide"><label>العنوان</label><input id="ouQuoteAddress" placeholder="المدينة، الحي، المملكة العربية السعودية"></div><div class="ou-wide"><label>ملاحظات</label><input id="ouQuoteNotes" value="الرجاء إرسال الإيصال بعد التحويل"></div></div>
      <div class="ou-quote-tools"><button class="light" id="ouQuoteSelectAll">تحديد الكل</button><button class="light" id="ouQuoteClearAll">إلغاء التحديد</button><b id="ouQuoteCount">0 أوردر محدد</b></div><div id="ouQuoteOrders" class="ou-quote-orders"><div class="ou-note">اختر المشروع لعرض الأوردرات</div></div><div class="actions"><button id="ouQuotePrint">إنشاء وطباعة عرض السعر</button><button class="light" id="ouQuoteWhatsApp">إرسال واتساب</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend',html);
    const modal=document.querySelector('.ou-quote-modal'), sel=modal.querySelector('#ouQuoteProject'), host=modal.querySelector('#ouQuoteOrders'), count=modal.querySelector('#ouQuoteCount');
    const updateCount=()=>{count.textContent=host.querySelectorAll('input[type=checkbox]:checked').length+' أوردر محدد';};
    const draw=()=>{const p=sel.value,list=rows.map((r,idx)=>({r,idx})).filter(x=>projectName(x.r)===p&&isDeferredOrder(x.r));host.innerHTML=list.length?list.map(({r,idx})=>{const inc=num(field(r,'السعر (شامل الضريبة)','inclusive_total','total_with_vat'));return `<label class="ou-quote-row"><input type="checkbox" data-row-index="${idx}"><span><b>${E(orderNo(r))}</b><br><small>${E(field(r,'التفاصيل','description')||'-')}</small></span><b>${E(money(inc))}</b></label>`;}).join(''):'<div class="ou-note">لا توجد أوردرات آجلة لهذا المشروع</div>';host.querySelectorAll('input[type=checkbox]').forEach(x=>x.addEventListener('change',updateCount));updateCount();const first=list[0]?.r;if(first){modal.querySelector('#ouQuoteCustomer').value=S(field(first,'اسم العميل','customer_name'));modal.querySelector('#ouQuotePhone').value=S(field(first,'رقم العميل','customer_phone'));}};
    sel.addEventListener('change',draw);modal.querySelector('#ouQuoteSelectAll').onclick=()=>{host.querySelectorAll('input[type=checkbox]').forEach(x=>x.checked=true);updateCount();};modal.querySelector('#ouQuoteClearAll').onclick=()=>{host.querySelectorAll('input[type=checkbox]').forEach(x=>x.checked=false);updateCount();};modal.querySelector('#ouQuotePrint').onclick=()=>printSelectedQuote(modal);modal.querySelector('#ouQuoteWhatsApp').onclick=()=>sendSelectedQuoteWhatsApp(modal);sel.focus();
  }

  function selectedQuoteData(modal){
    const p=S(modal.querySelector('#ouQuoteProject').value);
    const selectedIndexes=[...modal.querySelectorAll('#ouQuoteOrders input[type=checkbox]:checked')].map(x=>Number(x.dataset.rowIndex)).filter(Number.isInteger);
    const list=selectedIndexes.map(i=>rows[i]).filter(r=>r&&projectName(r)===p&&isDeferredOrder(r));
    return {p,list};
  }
  function sendSelectedQuoteWhatsApp(modal){
    const {p,list}=selectedQuoteData(modal);
    if(!p){notify('اختر المشروع أولاً','err');return;}
    if(!list.length){notify('حدد أوردرًا آجلاً واحدًا على الأقل','err');return;}
    const phoneRaw=S(modal.querySelector('#ouQuotePhone').value).replace(/\D/g,'');
    let phone=phoneRaw;
    if(phone.startsWith('0')) phone='966'+phone.slice(1);
    else if(phone.length===9&&phone.startsWith('5')) phone='966'+phone;
    if(!phone){notify('أدخل رقم جوال العميل لإرسال عرض السعر','err');return;}
    const qno=S(modal.querySelector('#ouQuoteNo').value),customer=S(modal.querySelector('#ouQuoteCustomer').value)||p;
    let subtotal=0,vatTotal=0,total=0;
    const lines=list.map((r,i)=>{
      const inc=num(field(r,'السعر (شامل الضريبة)','inclusive_total','total_with_vat'));
      const before=num(field(r,'السعر قبل الضريبة','before_vat'))||(inc/1.15);
      const vat=num(field(r,'الضريبة 15%','vat_amount'))||(inc-before);
      subtotal+=before;vatTotal+=vat;total+=inc;
      return `${i+1}- ${orderNo(r)} | ${S(field(r,'التفاصيل','description')||'-')} | ${money(inc)}`;
    }).join('\n');
    const text=`عرض سعر ${qno}\nالعميل: ${customer}\nالمشروع: ${p}\n\n${lines}\n\nقبل الضريبة: ${money(subtotal)}\nالضريبة: ${money(vatTotal)}\nالإجمالي شامل الضريبة: ${money(total)}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener');
  }

  function printSelectedQuote(modal){
    const {p,list}=selectedQuoteData(modal);
    if(!p){notify('اختر المشروع أولاً','err');return;} if(!list.length){notify('حدد أوردرًا واحدًا على الأقل','err');return;}
    const customer=S(modal.querySelector('#ouQuoteCustomer').value),phone=S(modal.querySelector('#ouQuotePhone').value),address=S(modal.querySelector('#ouQuoteAddress').value),qno=S(modal.querySelector('#ouQuoteNo').value),qdate=S(modal.querySelector('#ouQuoteDate').value),ref=S(modal.querySelector('#ouQuoteRef').value),notes=S(modal.querySelector('#ouQuoteNotes').value);
    let subtotal=0,vatTotal=0,total=0;const lines=list.map((r,i)=>{const inc=num(field(r,'السعر (شامل الضريبة)','inclusive_total','total_with_vat')),before=num(field(r,'السعر قبل الضريبة','before_vat'))||(inc/1.15),vat=num(field(r,'الضريبة 15%','vat_amount'))||(inc-before);subtotal+=before;vatTotal+=vat;total+=inc;return `<tr><td>${i+1}</td><td class="desc">${E(field(r,'التفاصيل','description')||'-')}<br><b>${E(orderNo(r))}</b></td><td>1</td><td>${before.toFixed(2)}</td><td>${before.toFixed(2)}</td><td>${vat.toFixed(2)}<br><small>15%</small></td><td>${inc.toFixed(2)}</td></tr>`;}).join('');
    const w=window.open('','_blank');if(!w){notify('اسمح بالنوافذ المنبثقة لطباعة عرض السعر','err');return;}
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${E(qno)}</title><style>@page{size:A4;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;color:#111;margin:0;font-size:11px}.head{display:grid;grid-template-columns:1fr 150px 1fr;align-items:start;gap:18px;border-bottom:2px solid #d7e0eb;padding:4px 0 16px}.en{text-align:left;direction:ltr}.ar{text-align:right}.head h2{font-size:21px;margin:0 0 5px}.logo{display:flex;align-items:center;justify-content:center;height:95px}.logo img{max-width:135px;max-height:82px}.title{text-align:center;font-size:28px;margin:25px 0}.info,.items{width:100%;border-collapse:collapse}.info td,.items th,.items td{border:1px solid #c8d5e5;padding:6px}.info td.label{font-weight:bold;width:12%}.items{margin-top:24px}.items th{text-align:center;font-weight:bold}.items td{text-align:center}.items .desc{text-align:right;min-width:240px}.totals{margin:18px 0 0 auto;width:47%;border-collapse:collapse}.totals td{padding:6px;font-weight:bold}.notes{margin-top:28px;text-align:right}.footer{position:fixed;bottom:0;left:0;right:0;text-align:center;color:#556070;font-size:9px}.currency{font-weight:bold;margin-inline-start:5px}@media print{button{display:none}}</style></head><body><div class="head"><div class="ar"><h2>شركة تصنيف للتشغيل<br>والصيانة</h2><div>6441، حي قرطبة، شارع سعيد بن زيد، الرياض، 13248، المملكة العربية السعودية</div><div>920015589</div><div>رقم التسجيل الضريبي 311784213300003</div><div>رقم السجل التجاري 1010915542</div></div><div class="logo"><img src="tasneef_logo_print.png"></div><div class="en"><h2>Tasnef Future Company</h2><div>6441, Qurtubah Dist, Said Ibn Zaid, Riyadh, 13248, Kingdom of Saudi Arabia</div><div>920015589</div><div>VAT number 311784213300003</div><div>CR Number 1010915542</div></div></div><h1 class="title">عرض سعر Quote</h1><table class="info"><tr><td class="label">العميل<br>Customer</td><td>${E(customer||p)}</td></tr><tr><td class="label">العنوان<br>Address</td><td>${E(address||p)}</td></tr><tr><td class="label">الهاتف<br>Phone</td><td>${E(phone)}</td></tr><tr><td class="label">التاريخ<br>Date</td><td>${E(qdate)}</td><td class="label">رقم<br>Number</td><td>${E(qno)}</td></tr><tr><td class="label">المرجع<br>Reference</td><td colspan="3">${E(ref)}</td></tr></table><table class="items"><thead><tr><th>#</th><th>الوصف<br>Description</th><th>الكمية<br>Qty</th><th>السعر<br>Price</th><th>المبلغ الخاضع للضريبة<br>Taxable amount</th><th>القيمة المضافة<br>VAT amount</th><th>المجموع<br>Line amount</th></tr></thead><tbody>${lines}</tbody></table><table class="totals"><tr><td>المجموع الفرعي Subtotal</td><td>${subtotal.toFixed(2)} <span class="currency">ر.س</span></td></tr><tr><td>إجمالي ضريبة القيمة المضافة VAT Total</td><td>${vatTotal.toFixed(2)} <span class="currency">ر.س</span></td></tr><tr><td>المجموع شامل القيمة المضافة Total</td><td>${total.toFixed(2)} <span class="currency">ر.س</span></td></tr></table><div class="notes"><b>ملاحظات<br>Notes</b><p>${E(notes)}</p></div><div class="footer">Tasnef Future Company - شركة تصنيف للتشغيل والصيانة &nbsp; | &nbsp; ${E(qno)}</div><script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>`);w.document.close();
  }
  async function printFilteredOrders(){
    let list=[];try{list=(await fetchAllUnifiedOrders(currentFilters())).rows;}catch(e){notify('تعذر تحميل بيانات الطباعة: '+e.message,'err');return;}
    if(!list.length){notify('لا توجد أوردرات مطابقة للطباعة','err');return;}
    const w=window.open('','_blank');if(!w)return;w.document.write(`<html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>الأوردرات</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Tahoma,Arial}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #bbb;padding:6px;text-align:right}th{background:#eef6f3}</style></head><body><h2>سجل الأوردرات حسب الفلتر</h2><table><thead><tr><th>الرقم</th><th>المشروع</th><th>العميل</th><th>المنفذ</th><th>التنفيذ</th><th>السداد</th><th>الفوترة</th><th>شامل الضريبة</th></tr></thead><tbody>${list.map(r=>`<tr><td>${E(orderNo(r))}</td><td>${E(projectName(r))}</td><td>${E(field(r,'اسم العميل','customer_name'))}</td><td>${E(field(r,'المنفذ','executor_name'))}</td><td>${E(field(r,'حالة التنفيذ','status'))}</td><td>${E(field(r,'حالة السداد','payment_status'))}</td><td>${E(effectiveBilling(r))}</td><td>${E(money(field(r,'السعر (شامل الضريبة)','inclusive_total','total_with_vat')))}</td></tr>`).join('')}</tbody></table><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();
  }
  function fixOrdersHeader(){
    const section=$('orders');if(!section)return;const head=section.querySelector('.section-head');if(!head)return;let actions=head.querySelector('.actions');if(!actions){actions=document.createElement('div');actions.className='actions';head.appendChild(actions);}actions.className='actions orders-section-actions-v10410';actions.innerHTML='<button onclick="clearOrderFormV233()">+ أوردر جديد</button><button class="light" onclick="tasneefOrders10400.refresh()">تحديث</button><button class="light" onclick="tasneefOrders10400.exportExcel()">تصدير Excel</button><button class="light" onclick="tasneefOrders10400.openQuoteBuilder()">عروض الأسعار</button><button class="light" onclick="tasneefOrders10400.printFiltered()">طباعة حسب الفلتر</button>';
  }

    window.tasneefOrders10400={load,save,edit,del,history,view:viewOrder,openReceipt,sendWhatsApp,page:d=>{const requested=Math.max(1,page+Number(d||0));if(requested!==page&&(Number(d||0)<0||hasMore)){page=requested;load();}},clear,render,exportExcel:()=>notify('تم إيقاف التصدير مؤقتًا أثناء استعادة قائمة الأوردرات.','err'),openQuoteBuilder,printFiltered:()=>notify('تم إيقاف الطباعة مؤقتًا أثناء استعادة قائمة الأوردرات.','err'),refresh:()=>{recoveryCursors=[null];page=1;load();}};window.supOrdersLoadV10061=load;
  window.saveOrderV233=save;window.clearOrderFormV233=clear;window.deleteCurrentOrderV233=deleteCurrent;window.editOrderV233=edit;window.deleteOrderV233=del;window.renderOrdersV233=render;
  window.supOrdersSaveV10061=save;window.supOrdersClearV10061=clear;window.supOrdersRenderV10061=render;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

/* Tasneef v10180 - Project Service Command Center
   Read-only reporting module. Improves project fields + supervisor phone lookup. */
(function(){
  'use strict';
  const VERSION='v10184-project-command-center-open-fix';
  const STATE={loaded:false,tab:'dashboard',projects:[],users:[],contracts:[],contractServices:[],annualServices:[],projectServices:[],serviceSchedules:[],smartContracts:[],tickets:[],selectedProjectId:'',filterProjectId:'',filterSupervisorId:'',lastLoadedAt:''};
  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const N=v=>Number(v||0)||0;
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const today=()=>new Date().toISOString().slice(0,10);
  const client=()=>window.sb||window.supabaseClient||window.supabase||null;
  const arDate=v=>{const x=S(v); if(!x)return '-'; return x.slice(0,10)||'-';};
  const phoneLink=v=>{const p=S(v); return p?`<a href="tel:${esc(p)}">${esc(p)}</a>`:'-';};
  const asUrl=v=>{let u=S(v); if(!u)return ''; if(!/^https?:\/\//i.test(u)&&/^(www\.|maps\.|goo\.gl|maps\.app|google\.)/i.test(u))u='https://'+u; return u;};
  const linkCell=v=>{const u=asUrl(v); return u?`<a href="${esc(u)}" target="_blank" rel="noopener">فتح الموقع</a>`:'-';};
  const pct=(a,b)=> b>0?Math.min(100,Math.round((N(a)/N(b))*100)):0;
  const money=v=>`${N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س`;
  const field=(o,keys,def='')=>{for(const k of keys){if(o && o[k]!=null && S(o[k])!=='')return o[k];} return def;};
  const low=s=>S(s).toLowerCase();
  const idOf=p=>S(field(p,['id','project_id','uuid','code','project_code']));
  const projectName=p=>S(field(p,['name','project_name','title','projectTitle','project'],''));
  const userName=u=>S(field(u,['full_name','name','username','display_name','email'],''));
  const userPhone=u=>{const p=objPerms(u), loc=localUserPhones(); const direct=S(field(u,['supervisor_phone','supervisor_mobile','phone','mobile','phone_number','mobile_number','whatsapp','contact_phone'],'')); if(direct)return direct; const pp=S(p.supervisor_phone||p.__supervisor_phone||p.phone); if(pp)return pp; for(const k of [u&&u.id,u&&u.username,u&&u.email,u&&u.full_name].map(S).filter(Boolean)){ if(S(loc[k]))return S(loc[k]); } return '';};
  const cleanNum=v=>{const x=S(v).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d.]/g,''); return N(x);};
  function objPerms(o){ let p=o&&(o.permissions||o.perms||o.user_permissions); if(typeof p==='string'){try{p=JSON.parse(p);}catch(_){p={};}} return p&&typeof p==='object'?p:{}; }
  function localUserPhones(){ try{const a=JSON.parse(localStorage.getItem('tasneef_user_supervisor_phone_v10180')||'{}'); return a&&typeof a==='object'?a:{};}catch(_){return{};} }
  function projectRelatedContracts(p){ const pid=idOf(p), pn=projectName(p); return STATE.contracts.filter(c=>rowProjectId(c)===pid || rowProjectName(c)===pn || S(field(c,['project','project_title','projectName'],'')).toLowerCase()===pn.toLowerCase()); }
  function fromRelatedContracts(p, keys){ for(const c of projectRelatedContracts(p)){ const v=field(c,keys,''); if(S(v)!=='') return v; } return ''; }

  function readLocalObj(key){try{const x=JSON.parse(localStorage.getItem(key)||'{}'); return x&&typeof x==='object'?x:{};}catch(_){return{};}}
  function smartRawRows(){
    const rows=[...A(STATE.smartContracts)];
    const local={...readLocalObj('tasneef_contract_smart_v299'),...readLocalObj('tasneef_contract_smart_v10107_cache')};
    Object.entries(local).forEach(([project_id,payload])=>rows.push({project_id,payload,_local:true}));
    const seen=new Map();
    rows.forEach(r=>{const k=S(field(r,['project_id','projectId','project'],'')||rowProjectId(r)||rowProjectName(r)); if(k)seen.set(k,r);});
    return [...seen.values()];
  }
  function smartRecordForProject(p){
    const pid=idOf(p), pn=projectName(p).toLowerCase();
    const row=smartRawRows().find(r=>S(field(r,['project_id','projectId','project'],'')||rowProjectId(r))===pid || rowProjectName(r).toLowerCase()===pn);
    const payload=row&&(row.payload||row.data||row.record||row);
    return payload&&typeof payload==='object'?payload:{};
  }
  function smartAssoc(p){const a=smartRecordForProject(p).association||{}; return a&&typeof a==='object'?a:{};}

  function projectDistrict(p){return S(field(p,['district','neighborhood','neighbourhood','area','city_area','district_name','location_area','حي','الحى','الحي'],'') || fromRelatedContracts(p,['district','neighborhood','area','حي','الحي']));}
  function projectLocation(p){return S(field(p,['location_url','map_url','maps_url','google_maps','location_link','location','site_url','site_link','map','site_location','google_map_url'],'' ) || fromRelatedContracts(p,['location_url','map_url','maps_url','google_maps','location_link','location','site_url','site_link','map']));}
  function projectBuildings(p){return cleanNum(field(p,['buildings_count','building_count','buildings','building','num_buildings','no_buildings','buildingsNo','blocks','towers','عدد_المباني','عدد_العمائر'],0) || fromRelatedContracts(p,['buildings_count','building_count','buildings','building','num_buildings','blocks','towers','عدد_المباني','عدد_العمائر']));}
  function projectApartments(p){return cleanNum(field(p,['apartments_count','apartment_count','apartments','apartment','units','unit_count','units_count','flats','flat_count','num_apartments','no_apartments','total_units','عدد_الشقق','عدد_الوحدات'],0) || fromRelatedContracts(p,['apartments_count','apartment_count','apartments','units','unit_count','units_count','flats','flat_count','num_apartments','total_units','عدد_الشقق','عدد_الوحدات']));}
  function projectScentDevices(p){return cleanNum(field(p,['scent_devices','scent_device_count','fragrance_devices','fragrance_devices_count','perfume_devices','perfume_device_count','aroma_devices','diffusers','diffuser_count','scent_count','air_freshener_count','عدد_اجهزة_التعطير','عدد_أجهزة_التعطير'],0) || fromRelatedContracts(p,['scent_devices','scent_device_count','fragrance_devices','perfume_devices','aroma_devices','diffusers','air_freshener_count','عدد_اجهزة_التعطير']));}
  function propertyManagerName(p){const a=smartAssoc(p); return S(field(p,['property_manager','property_manager_name','manager_name','real_estate_manager','asset_manager','propertyManager','مدير_العقار'],'' ) || field(a,['manager','property_manager','property_manager_name','manager_name'],'') || fromRelatedContracts(p,['property_manager','property_manager_name','manager_name','real_estate_manager','asset_manager','مدير_العقار']));}
  function propertyManagerPhone(p){const a=smartAssoc(p); return S(field(p,['property_manager_phone','manager_phone','real_estate_manager_phone','asset_manager_phone','property_manager_mobile','propertyManagerPhone'],'' ) || field(a,['phone','manager_phone','property_manager_phone'],'') || fromRelatedContracts(p,['property_manager_phone','manager_phone','real_estate_manager_phone','asset_manager_phone']));}
  function associationPresidentName(p){const a=smartAssoc(p); return S(field(p,['association_president','association_president_name','chairman','hoa_president','president_name','association_head','رئيس_الجمعية'],'' ) || field(a,['name','president','association_president','chairman'],'') || fromRelatedContracts(p,['association_president','association_president_name','chairman','hoa_president','president_name','رئيس_الجمعية']));}
  function associationPresidentPhone(p){const a=smartAssoc(p); return S(field(p,['association_president_phone','chairman_phone','hoa_president_phone','president_phone','association_head_phone'],'' ) || field(a,['president_phone','association_president_phone','chairman_phone'],'') || fromRelatedContracts(p,['association_president_phone','chairman_phone','hoa_president_phone','president_phone']));}

  function supervisorOf(p){
    const sid=S(field(p,['supervisor_id','supervisorId','supervisor_user_id','assigned_supervisor_id'],''));
    const nameDirect=S(field(p,['supervisor_name','supervisor','assigned_supervisor','مشرف'],''));
    const phoneDirect=S(field(p,['supervisor_phone','supervisor_mobile','supervisor_contact','supervisor_whatsapp'],''));
    const u=sid?STATE.users.find(x=>S(field(x,['id','user_id','uuid','username','email']))===sid):STATE.users.find(x=>nameDirect && userName(x)===nameDirect);
    return {id:sid||S(field(u||{},['id','user_id','uuid','username'],'')),name:nameDirect||userName(u)||'-',phone:phoneDirect||userPhone(u)||''};
  }

  async function table(name,select='*',limit=8000){
    try{const c=client(); if(!c)return[]; const r=await c.from(name).select(select).limit(limit); if(r.error)return[]; return A(r.data);}catch(_){return[];}
  }
  async function load(force){
    if(STATE.loaded&&!force)return;
    const [projects,users,users2,contracts,contracts2,cs,cs2,annual,annual2,ps,schedules,smartContracts,tickets]=await Promise.all([
      table('projects','*',8000),
      table('app_users','*',5000),
      table('users','*',5000),
      table('project_contracts','*',8000),
      table('contracts','*',8000),
      table('contract_services','*',10000),
      table('project_contract_services','*',10000),
      table('annual_services','*',10000),
      table('project_annual_services','*',10000),
      table('project_services','*',10000),
      table('service_schedules','*',10000),
      table('project_contract_smart','*',10000),
      table('tickets','*',10000)
    ]);
    STATE.projects=projects;
    STATE.users=[...users,...users2];
    STATE.contracts=[...contracts,...contracts2];
    STATE.contractServices=[...cs,...cs2];
    STATE.annualServices=[...annual,...annual2];
    STATE.projectServices=ps;
    STATE.serviceSchedules=schedules;
    STATE.smartContracts=smartContracts;
    STATE.tickets=tickets;
    if(!STATE.selectedProjectId && projects[0]) STATE.selectedProjectId=idOf(projects[0]);
    STATE.loaded=true;
    STATE.lastLoadedAt=new Date().toLocaleString('ar-SA');
  }

  function serviceName(row){return S(field(row,['service_name','name','title','service','service_type','type','category','maintenance_type','contract_service_name'],''));}
  function serviceKey(name){
    const t=low(name);
    if(/خزان|خزانات|tank/.test(t))return 'غسيل خزانات';
    if(/مبيد|رش|حشر|pest/.test(t))return 'رش مبيدات';
    if(/واجه|facade/.test(t))return 'تنظيف واجهات';
    if(/مصعد|elevator|lift/.test(t))return 'صيانة مصاعد';
    if(/مسبح|pool/.test(t))return 'صيانة مسابح';
    if(/دفاع|حريق|fire|civil/.test(t))return 'الدفاع المدني';
    if(/تعطير|fragrance|scent|aroma/.test(t))return 'أجهزة التعطير';
    if(/نظاف|clean/.test(t))return 'النظافة';
    return S(name)||'خدمة غير محددة';
  }
  function rowProjectId(r){return S(field(r,['project_id','projectId','project','site_id','property_id'],''));}
  function rowProjectName(r){return S(field(r,['project_name','projectName','site_name','property_name'],''));}
  function rowContractId(r){return S(field(r,['contract_id','project_contract_id','contractId'],''));}
  function contractIdsForProject(p){
    const pid=idOf(p), pn=projectName(p);
    return STATE.contracts.filter(c=>rowProjectId(c)===pid || rowProjectName(c)===pn || S(field(c,['project'],''))===pn).map(c=>S(field(c,['id','contract_id','uuid']))).filter(Boolean);
  }
  function smartServiceRowsForProject(p){
    const rec=smartRecordForProject(p);
    const out=[];
    const pid=idOf(p), pn=projectName(p);
    const contracts=rec.contracts||rec.core||{};
    const coreNames={elevators:'صيانة مصاعد',pools:'صيانة مسابح',civilDefense:'الدفاع المدني',civil_defense:'الدفاع المدني'};
    Object.keys(contracts||{}).forEach(k=>{
      const r=contracts[k]||{}; const service=coreNames[k]||serviceKey(k);
      const visits=N(r.visits||r.visit_count||r.count||0);
      const done=A(r.done).length || N(r.done_count||r.completed_count||0);
      const active=!!(r.onUs??r.on_us) || S(r.company||r.company_name||r.phone||r.start||r.end) || visits>0;
      if(active) out.push({project_id:pid,project_name:pn,service_name:service,required_count:Math.max(1,visits||1),completed_count:done,due_date:S(r.end||r.next_date||''),status:(done>=Math.max(1,visits||1))?'مكتمل':(active?'مستمر':'غير مفعل'),_smart:true,_source:'عقد'});
    });
    A(rec.annual).forEach(a=>{
      const visits=Math.max(1,N(a.visits||a.visit_count||a.required_count||1));
      const done=A(a.done).length || N(a.done_count||a.completed_count||0);
      const sched=A(a.schedule).map(x=>typeof x==='string'?x:S(x&&x.date)).filter(Boolean);
      const notDone=A(a.schedule).filter((x,i)=>!(A(a.done).map(Number).includes(i+1)||x.done));
      const next=notDone.map(x=>typeof x==='string'?x:S(x&&x.date)).filter(Boolean).sort()[0]||sched.sort()[0]||'';
      out.push({project_id:pid,project_name:pn,service_name:S(a.name)||'خدمة سنوية',required_count:visits,completed_count:done,due_date:next,status:done>=visits?'مكتمل':'مستمر',schedule:sched,_smart:true,_source:'سنوي'});
    });
    return out;
  }
  function relatedRowsForProject(p){
    const pid=idOf(p), pn=projectName(p), pnLow=pn.toLowerCase(), cids=contractIdsForProject(p);
    const direct=r=>{
      const rid=rowProjectId(r), rn=rowProjectName(r).toLowerCase();
      const pfield=S(field(r,['project','project_title','projectName','project_name','site','site_name','property','property_name'],'')).toLowerCase();
      return rid===pid || rn===pnLow || pfield===pnLow || cids.includes(rowContractId(r));
    };
    const rows=[...STATE.contractServices,...STATE.annualServices,...STATE.projectServices,...STATE.serviceSchedules].filter(direct);
    return [...smartServiceRowsForProject(p),...rows];
  }
  function requiredCount(r){
    const x=field(r,['required_count','visits_count','annual_count','count','quantity','qty','frequency_count','service_count','times','number_of_visits'],null);
    if(x!=null && S(x)!=='')return Math.max(1,N(x)||1);
    const freq=low(field(r,['frequency','schedule','period','repeat','recurrence'],''));
    if(/monthly|شهري/.test(freq))return 12;
    if(/quarter|ربع/.test(freq))return 4;
    if(/half|نصف/.test(freq))return 2;
    return 1;
  }
  function completedCount(r){
    const val=field(r,['completed_count','done_count','executed_count','visits_done','completed_visits','done_visits'],null);
    if(val!=null && S(val)!=='')return N(val);
    const st=low(field(r,['status','state','service_status','execution_status'],''));
    return /done|completed|closed|منجز|مكتمل|تم/.test(st)?1:0;
  }
  function dueDate(r){return S(field(r,['due_date','scheduled_date','next_date','service_date','date','planned_date','target_date','end_date'],''));}
  function serviceStatus(r){return S(field(r,['status','state','service_status','contract_status','activation_status'],''));}
  function isActiveStatus(v){const t=low(v); return !t || /active|enabled|فعال|مفعل|ساري|منجز|completed|done/.test(t);}
  function ticketsForProjectService(p,key){
    const pid=idOf(p), pn=projectName(p), k=low(key);
    return STATE.tickets.filter(t=>{
      const same=rowProjectId(t)===pid || rowProjectName(t)===pn || S(field(t,['project'],''))===pn;
      if(!same)return false;
      const text=[field(t,['title','subject','description','category','service_name','type'],'')].map(S).join(' ').toLowerCase();
      return k && text.includes(k.split(' ')[0]);
    });
  }
  function serviceSummary(p){
    const groups={};
    relatedRowsForProject(p).forEach(r=>{
      const key=serviceKey(serviceName(r)||field(r,['description','notes'],'خدمة'));
      if(!groups[key])groups[key]={service:key,required:0,scheduled:0,done:0,remaining:0,late:0,last:'-',status:'جيد',rows:[]};
      groups[key].rows.push(r);
      groups[key].required+=requiredCount(r);
      groups[key].scheduled+=dueDate(r)?1:0;
      groups[key].done+=completedCount(r);
    });
    Object.values(groups).forEach(g=>{
      const dates=g.rows.map(dueDate).filter(Boolean).sort();
      const todayStr=today();
      const lateRows=g.rows.filter(r=>dueDate(r) && dueDate(r).slice(0,10)<todayStr && completedCount(r)<=0).length;
      const ticketsDone=ticketsForProjectService(p,g.service).filter(t=>/done|closed|completed|منجز|مغلق|تم/.test(low(field(t,['status','state'],'')))).length;
      if(ticketsDone>0)g.done=Math.max(g.done,ticketsDone);
      g.remaining=Math.max(0,g.required-g.done);
      g.late=lateRows;
      g.last=dates.length?dates[dates.length-1].slice(0,10):'-';
      if(g.late>0)g.status='متأخر'; else if(g.remaining>0)g.status='مستمر'; else g.status='مكتمل';
    });
    return Object.values(groups).sort((a,b)=>a.service.localeCompare(b.service,'ar'));
  }

  function hasContractService(p,patterns){
    const rows=[...relatedRowsForProject(p),...STATE.contracts.filter(c=>contractIdsForProject(p).includes(S(field(c,['id','contract_id','uuid']))))];
    return rows.some(r=>patterns.some(re=>re.test(low([serviceName(r),field(r,['name','title','description','contract_type','maintenance_type','notes'],'')].map(S).join(' ')))));
  }
  function contractActivationAlerts(p){
    const alerts=[];
    const specs=[
      {name:'عقد صيانة المصاعد',patterns:[/مصعد|elevator|lift/],keys:['elevator_contract_status','elevator_status','lift_contract_status','maintenance_elevator_status']},
      {name:'عقد صيانة المسابح',patterns:[/مسبح|pool/],keys:['pool_contract_status','pool_status','swimming_pool_contract_status']},
      {name:'عقد الدفاع المدني',patterns:[/دفاع|حريق|fire|civil/],keys:['fire_contract_status','civil_defense_status','fire_safety_status','defense_contract_status']}
    ];
    specs.forEach(s=>{
      const val=S(field(p,s.keys,''));
      const exists=hasContractService(p,s.patterns) || val;
      if(!exists || !isActiveStatus(val)) alerts.push({project:p,type:'عقد غير مفعل',field:s.name,priority:'عالية',action:'تفعيل أو تحديث حالة العقد'});
    });
    return alerts;
  }
  function missingDataAlerts(p){
    const sup=supervisorOf(p);
    const checks=[
      ['الحي',projectDistrict(p),'متوسطة'],['رابط الموقع',projectLocation(p),'عالية'],['عدد المباني',projectBuildings(p),'متوسطة'],['عدد الشقق',projectApartments(p),'متوسطة'],['عدد أجهزة التعطير',projectScentDevices(p),'منخفضة'],['اسم المشرف',sup.name&&sup.name!=='-'?sup.name:'','عالية'],['رقم جوال المشرف',sup.phone,'عالية'],['اسم مدير العقار',propertyManagerName(p),'متوسطة'],['رقم مدير العقار',propertyManagerPhone(p),'متوسطة'],['اسم رئيس الجمعية',associationPresidentName(p),'متوسطة'],['رقم رئيس الجمعية',associationPresidentPhone(p),'متوسطة']
    ];
    return checks.filter(x=>!S(x[1])||N(x[1])===0 && /^عدد/.test(x[0])).map(x=>({project:p,type:'بيانات ناقصة',field:x[0],priority:x[2],action:'استكمال بيانات المشروع'}));
  }
  function delayAlerts(p){
    return serviceSummary(p).filter(s=>s.late>0).map(s=>({project:p,type:'خدمة متأخرة',field:s.service,priority:'عالية',action:'متابعة تنفيذ الخدمة المتأخرة'}));
  }
  function alertsAll(){return filteredProjects().flatMap(p=>[...missingDataAlerts(p),...contractActivationAlerts(p),...delayAlerts(p)]);}
  function completeness(p){const total=11; const missing=missingDataAlerts(p).length; return Math.max(0,Math.round(((total-missing)/total)*100));}
  function projectStatus(p){const a=[...missingDataAlerts(p),...contractActivationAlerts(p),...delayAlerts(p)]; if(a.some(x=>x.priority==='عالية'))return 'يحتاج متابعة'; if(a.length)return 'ناقص بيانات'; return 'مكتمل';}
  function statusClass(s){return /متأخر|عالية|يحتاج/.test(S(s))?'bad':/مستمر|ناقص|متوسطة/.test(S(s))?'warn':'ok';}

  function ensureStyle(){
    if($('pccStyle10172'))return;
    const st=document.createElement('style'); st.id='pccStyle10172'; st.textContent=`
    #projectCommandCenter.pcc-page{display:block}.pcc-shell{display:grid;gap:14px;direction:rtl}.pcc-hero{background:linear-gradient(135deg,#063b31,#0f7a5a);color:#fff;border-radius:24px;padding:22px;display:flex;justify-content:space-between;gap:16px;align-items:center;box-shadow:0 18px 42px rgba(7,61,49,.17)}.pcc-hero h2{margin:0;color:#fff;font-size:28px}.pcc-hero p{margin:7px 0 0;color:#dff7ef;line-height:1.7}.pcc-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.pcc-tabs button{border:1px solid #cfe5dd;background:#f1f8f5;color:#073d31;border-radius:15px;padding:12px;font-weight:800;cursor:pointer}.pcc-tabs button.active{background:#073d31;color:#fff}.pcc-card{background:#fff;border:1px solid #d8e9e3;border-radius:18px;padding:16px;box-shadow:0 9px 28px rgba(7,61,49,.055)}.pcc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.pcc-grid.three{grid-template-columns:repeat(3,1fr)}.pcc-grid.two{grid-template-columns:repeat(2,1fr)}.pcc-kpi small{color:#647b74}.pcc-kpi b{display:block;color:#073d31;font-size:27px;margin-top:8px}.pcc-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:end}.pcc-actions>*{min-width:135px}.pcc-soft{background:#f5faf8;border:1px solid #d8ebe3;border-radius:14px;padding:11px}.pcc-soft small{display:block;color:#668078}.pcc-soft b{color:#073d31}.pcc-table{overflow:auto;border:1px solid #d8e9e3;border-radius:16px;background:#fff;max-height:60vh}.pcc-table table{width:100%;border-collapse:collapse;font-size:13px}.pcc-table th,.pcc-table td{padding:10px;border-bottom:1px solid #edf3f1;text-align:right;white-space:nowrap}.pcc-table th{background:#f6faf8;color:#365e54;position:sticky;top:0;z-index:1}.pcc-badge{display:inline-flex;border-radius:999px;padding:5px 11px;font-size:12px;font-weight:900}.pcc-badge.ok{background:#e8f7ef;color:#087047}.pcc-badge.warn{background:#fff5db;color:#8a5b00}.pcc-badge.bad{background:#fde9e9;color:#a92525}.pcc-progress{height:9px;background:#edf3f0;border-radius:999px;overflow:hidden}.pcc-progress span{display:block;height:100%;background:linear-gradient(90deg,#0f7a5a,#45b384);border-radius:999px}.pcc-print-head{display:none}.pcc-signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:26px}.pcc-signatures div{border-top:1px solid #80978f;text-align:center;padding-top:10px;color:#073d31;font-weight:900}@media(max-width:1100px){.pcc-tabs,.pcc-grid,.pcc-grid.three,.pcc-grid.two{grid-template-columns:1fr 1fr}.pcc-hero{flex-direction:column;align-items:flex-start}}@media(max-width:720px){.pcc-tabs,.pcc-grid,.pcc-grid.three,.pcc-grid.two{grid-template-columns:1fr}}
    `; document.head.appendChild(st);
  }
  function ensurePage(){
    ensureStyle();
    let page=$('projectCommandCenter');
    if(!page){page=document.createElement('section'); page.id='projectCommandCenter'; page.className='page hidden pcc-page'; const main=document.querySelector('main.content')||document.querySelector('.content')||document.body; main.appendChild(page);}
    const side=document.querySelector('.side');
    if(side&&!$('pccNav10172')){
      const btn=document.createElement('button'); btn.className='nav'; btn.id='pccNav10172'; btn.dataset.page='projectCommandCenter'; btn.textContent='مركز متابعة المشاريع'; btn.onclick=function(){ if(window.showPage)window.showPage('projectCommandCenter',btn); setTimeout(()=>window.projectCommandCenterV10172&&window.projectCommandCenterV10172.open(),60); return false; };
      const ref=[...side.querySelectorAll('.nav')].find(b=>S(b.textContent).includes('تقارير العملاء'))||side.querySelector('.danger'); side.insertBefore(btn,ref||null);
    }
    return page;
  }
  function header(){return `<div class="pcc-hero"><div><h2>مركز متابعة المشاريع والخدمات</h2><p>لوحة تنفيذية لقراءة حالة الخدمات، التنبيهات، العقود غير المفعلة، والبيانات الناقصة دون تعديل أي قسم آخر.</p></div><div class="pcc-actions"><button class="light" onclick="projectCommandCenterV10172.reload()">تحديث البيانات</button><button onclick="projectCommandCenterV10172.printCurrent()">طباعة PDF</button></div></div><div class="pcc-tabs">${[['dashboard','لوحة المؤشرات'],['project','ملف المشروع التنفيذي'],['alerts','التنبيهات والمخاطر'],['all','ملخص كل المشاريع']].map(([id,l])=>`<button class="${STATE.tab===id?'active':''}" onclick="projectCommandCenterV10172.tab('${id}')">${l}</button>`).join('')}</div>${STATE.loaded?filterBar():''}`;}
  function render(){const page=ensurePage(); if(!STATE.loaded){page.innerHTML=`<div class="pcc-shell">${header()}<div class="pcc-card">جاري تحميل مركز متابعة المشاريع...</div></div>`; return;} page.innerHTML=`<div class="pcc-shell">${header()}<div id="pccBody10172">${bodyHtml()}</div></div>`;}
  function bodyHtml(){if(STATE.tab==='project')return projectTab(); if(STATE.tab==='alerts')return alertsTab(); if(STATE.tab==='all')return allProjectsTab(); return dashboardTab();}
  function dashboardTab(){
    const projects=filteredProjects(); const total=projects.length, alerts=alertsAll(), high=alerts.filter(a=>a.priority==='عالية').length, missing=alerts.filter(a=>a.type==='بيانات ناقصة').length, late=alerts.filter(a=>a.type==='خدمة متأخرة').length;
    const complete=projects.filter(p=>completeness(p)>=100).length;
    const inactive=alerts.filter(a=>a.type==='عقد غير مفعل').length;
    return `<div class="pcc-grid"><div class="pcc-card pcc-kpi"><small>إجمالي المشاريع</small><b>${total}</b></div><div class="pcc-card pcc-kpi"><small>مشاريع مكتملة البيانات</small><b>${complete}</b></div><div class="pcc-card pcc-kpi"><small>تنبيهات عالية</small><b>${high}</b></div><div class="pcc-card pcc-kpi"><small>خدمات متأخرة</small><b>${late}</b></div></div><div class="pcc-grid three"><div class="pcc-card"><h3>البيانات الناقصة</h3><b style="font-size:32px;color:#073d31">${missing}</b><p>اسم مدير العقار، رئيس الجمعية، الموقع، المشرف، الجوال، المباني، الشقق، أجهزة التعطير.</p></div><div class="pcc-card"><h3>العقود غير المفعلة</h3><b style="font-size:32px;color:#a92525">${inactive}</b><p>مصاعد، مسابح، دفاع مدني أو أي عقد مرتبط ولم يتم تفعيله.</p></div><div class="pcc-card"><h3>آخر تحديث</h3><b>${esc(STATE.lastLoadedAt||'-')}</b><p>البيانات مقروءة فقط من النظام الحالي بدون تعديل.</p></div></div>${topAlertsHtml(alerts.slice(0,12))}`;
  }
  function topAlertsHtml(rows){return `<div class="pcc-card"><h3>أهم التنبيهات</h3><div class="pcc-table"><table><thead><tr><th>المشروع</th><th>الحي</th><th>نوع المشكلة</th><th>البيان</th><th>الأولوية</th><th>الإجراء المطلوب</th></tr></thead><tbody>${rows.map(a=>`<tr><td>${esc(projectName(a.project))}</td><td>${esc(projectDistrict(a.project)||'-')}</td><td>${esc(a.type)}</td><td>${esc(a.field)}</td><td><span class="pcc-badge ${statusClass(a.priority)}">${esc(a.priority)}</span></td><td>${esc(a.action)}</td></tr>`).join('')||'<tr><td colspan="6">لا توجد تنبيهات</td></tr>'}</tbody></table></div></div>`;}
  function projectSelect(){const rows=filteredProjects().length?filteredProjects():STATE.projects; return `<select id="pccProjectSelect10172" onchange="projectCommandCenterV10172.select(this.value)">${rows.map(p=>`<option value="${esc(idOf(p))}" ${STATE.selectedProjectId===idOf(p)?'selected':''}>${esc(projectName(p)||idOf(p))}</option>`).join('')}</select>`;}
  function projectTab(){
    const rows=filteredProjects().length?filteredProjects():STATE.projects; const p=rows.find(x=>idOf(x)===STATE.selectedProjectId)||rows[0]; if(!p)return '<div class="pcc-card">لا توجد مشاريع</div>';
    const sup=supervisorOf(p), services=serviceSummary(p), compl=completeness(p), alerts=[...missingDataAlerts(p),...contractActivationAlerts(p),...delayAlerts(p)];
    return `<div class="pcc-card"><div class="pcc-actions"><div style="flex:1"><label>اختيار المشروع</label>${projectSelect()}</div><button onclick="projectCommandCenterV10172.printProject('${esc(idOf(p))}')">طباعة ملخص المشروع</button></div></div><div id="pccProjectPrintable10172">${projectProfileHtml(p,sup,services,alerts,compl)}</div>`;
  }
  function projectProfileHtml(p,sup,services,alerts,compl){
    return `<div class="pcc-card"><h3>ملف المشروع التنفيذي: ${esc(projectName(p)||'-')}</h3><div class="pcc-grid"><div class="pcc-soft"><small>الحي</small><b>${esc(projectDistrict(p)||'-')}</b></div><div class="pcc-soft"><small>المشرف</small><b>${esc(sup.name||'-')}</b></div><div class="pcc-soft"><small>جوال المشرف</small><b>${phoneLink(sup.phone)}</b></div><div class="pcc-soft"><small>رابط الموقع</small><b>${linkCell(projectLocation(p))}</b></div><div class="pcc-soft"><small>عدد المباني</small><b>${N(projectBuildings(p))}</b></div><div class="pcc-soft"><small>عدد الشقق</small><b>${N(projectApartments(p))}</b></div><div class="pcc-soft"><small>أجهزة التعطير</small><b>${N(projectScentDevices(p))}</b></div><div class="pcc-soft"><small>اكتمال البيانات</small><b>${compl}%</b><div class="pcc-progress"><span style="width:${compl}%"></span></div></div><div class="pcc-soft"><small>مدير العقار</small><b>${esc(propertyManagerName(p)||'-')}</b></div><div class="pcc-soft"><small>جوال مدير العقار</small><b>${phoneLink(propertyManagerPhone(p))}</b></div><div class="pcc-soft"><small>رئيس الجمعية</small><b>${esc(associationPresidentName(p)||'-')}</b></div><div class="pcc-soft"><small>جوال رئيس الجمعية</small><b>${phoneLink(associationPresidentPhone(p))}</b></div></div></div><div class="pcc-card"><h3>حالة الخدمات التعاقدية والسنوية</h3><div class="pcc-table"><table><thead><tr><th>الخدمة</th><th>المطلوب بالعقد</th><th>المجدول</th><th>المنفذ</th><th>المتبقي</th><th>المتأخر</th><th>آخر تاريخ</th><th>الحالة</th></tr></thead><tbody>${services.map(s=>`<tr><td><b>${esc(s.service)}</b></td><td>${N(s.required)}</td><td>${N(s.scheduled)}</td><td>${N(s.done)}</td><td>${N(s.remaining)}</td><td>${N(s.late)}</td><td>${esc(s.last)}</td><td><span class="pcc-badge ${statusClass(s.status)}">${esc(s.status)}</span></td></tr>`).join('')||'<tr><td colspan="8">لا توجد خدمات مرتبطة ظاهرة لهذا المشروع</td></tr>'}</tbody></table></div></div>${topAlertsHtml(alerts)}`;
  }
  function alertsTab(){const alerts=alertsAll(); return `<div class="pcc-card"><div class="pcc-actions"><button onclick="projectCommandCenterV10172.printAlerts()">طباعة تقرير التنبيهات</button></div></div>${topAlertsHtml(alerts)}`;}
  function allProjectsTab(){
    const rows=filteredProjects().map(p=>{const sv=serviceSummary(p), al=[...missingDataAlerts(p),...contractActivationAlerts(p),...delayAlerts(p)], sup=supervisorOf(p); return {p,sv,al,sup};});
    return `<div class="pcc-card"><div class="pcc-actions"><button onclick="projectCommandCenterV10172.printAll()">طباعة ملخص كل المشاريع</button></div><h3>ملخص كل المشاريع</h3><div class="pcc-table"><table><thead><tr><th>المشروع</th><th>الحي</th><th>المشرف</th><th>جوال المشرف</th><th>الموقع</th><th>المباني</th><th>الشقق</th><th>أجهزة التعطير</th><th>الخدمات المطلوبة</th><th>المنفذة</th><th>المتأخرة</th><th>البيانات الناقصة</th><th>حالة المشروع</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(projectName(r.p))}</td><td>${esc(projectDistrict(r.p)||'-')}</td><td>${esc(r.sup.name||'-')}</td><td>${esc(r.sup.phone||'-')}</td><td>${linkCell(projectLocation(r.p))}</td><td>${N(projectBuildings(r.p))}</td><td>${N(projectApartments(r.p))}</td><td>${N(projectScentDevices(r.p))}</td><td>${r.sv.reduce((a,s)=>a+N(s.required),0)}</td><td>${r.sv.reduce((a,s)=>a+N(s.done),0)}</td><td>${r.sv.reduce((a,s)=>a+N(s.late),0)}</td><td>${missingDataAlerts(r.p).length}</td><td><span class="pcc-badge ${statusClass(projectStatus(r.p))}">${esc(projectStatus(r.p))}</span></td></tr>`).join('')||'<tr><td colspan="13">لا توجد مشاريع</td></tr>'}</tbody></table></div></div>`;
  }
  function printHtml(title,content){
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Tahoma,Arial,sans-serif;margin:18px;color:#073d31}.print-head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #073d31;padding-bottom:12px;margin-bottom:14px}.brand{font-size:24px;font-weight:900}.muted{color:#667c75}.pcc-card{border:1px solid #d8e9e3;border-radius:14px;padding:14px;margin-bottom:12px}.pcc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.pcc-grid.three{grid-template-columns:repeat(3,1fr)}.pcc-soft{background:#f5faf8;border:1px solid #d8ebe3;border-radius:12px;padding:9px}.pcc-soft small{display:block;color:#667c75}.pcc-soft b{color:#073d31}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #d8e9e3;padding:7px;text-align:right}th{background:#f3faf7}.pcc-badge{font-weight:900}.pcc-progress{height:8px;background:#edf3f0;border-radius:999px;overflow:hidden}.pcc-progress span{display:block;height:100%;background:#0f7a5a}.pcc-actions,button{display:none!important}a{color:#075cbd;text-decoration:underline}.pcc-signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:25px;margin-top:35px}.pcc-signatures div{border-top:1px solid #80978f;text-align:center;padding-top:10px;font-weight:900}@media print{body{margin:10mm}.pcc-table{max-height:none!important;overflow:visible!important}}</style></head><body><div class="print-head"><div><div class="brand">شركة تصنيف لإدارة المرافق</div><div class="muted">${esc(title)}</div></div><div>${new Date().toLocaleDateString('ar-SA')}</div></div>${content}<div class="pcc-signatures"><div>مدير التشغيل</div><div>مدير الإدارة</div><div>اعتماد الإدارة</div></div><script>window.onload=function(){setTimeout(function(){window.print()},350)}<\/script></body></html>`;
    const w=window.open('','_blank'); if(w){w.document.write(html); w.document.close();}
  }
  const api={
    open:async()=>{ensurePage(); await load(false); render();},
    reload:async()=>{STATE.loaded=false; render(); await load(true); render();},
    tab:t=>{STATE.tab=t; render();},
    select:id=>{STATE.selectedProjectId=id; render();},
    filterProject:id=>{STATE.filterProjectId=S(id); if(id)STATE.selectedProjectId=S(id); render();},
    filterSupervisor:id=>{STATE.filterSupervisorId=S(id); const rows=filteredProjects(); if(rows[0])STATE.selectedProjectId=idOf(rows[0]); render();},
    clearFilters:()=>{STATE.filterProjectId=''; STATE.filterSupervisorId=''; render();},
    printCurrent:()=>{if(STATE.tab==='project')api.printProject(STATE.selectedProjectId); else if(STATE.tab==='alerts')api.printAlerts(); else if(STATE.tab==='all')api.printAll(); else printHtml('لوحة مؤشرات المشاريع',bodyHtml());},
    printProject:id=>{const rows=filteredProjects().length?filteredProjects():STATE.projects; const p=STATE.projects.find(x=>idOf(x)===S(id))||rows[0]; if(!p)return; printHtml('ملخص المشروع - '+projectName(p),projectProfileHtml(p,supervisorOf(p),serviceSummary(p),[...missingDataAlerts(p),...contractActivationAlerts(p),...delayAlerts(p)],completeness(p)));},
    printAlerts:()=>printHtml('تقرير التنبيهات والمخاطر',topAlertsHtml(alertsAll())),
    printAll:()=>printHtml('ملخص كل المشاريع',allProjectsTab())
  };
  window.projectCommandCenterV10172=api;
  function attachNavHandlers(){
    try{
      document.querySelectorAll('.nav,button').forEach(btn=>{
        const t=S(btn.textContent);
        if(!/مركز متابعة المشاريع/.test(t) || btn.__pcc10184Bound) return;
        btn.__pcc10184Bound=true;
        btn.onclick=function(ev){
          try{ if(ev){ev.preventDefault(); ev.stopPropagation();} }catch(_){}
          document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));
          ensurePage().classList.remove('hidden');
          document.querySelectorAll('.nav').forEach(n=>n.classList.remove('active'));
          btn.classList.add('active');
          api.open().catch(e=>{ensurePage().innerHTML=`<div class="pcc-shell"><div class="pcc-card"><h3>تعذر فتح مركز متابعة المشاريع</h3><p>${esc(e.message||e)}</p><button onclick="projectCommandCenterV10172.reload()">إعادة المحاولة</button></div></div>`;});
          return false;
        };
      });
    }catch(e){console.warn('pcc attach nav failed',e);}
  }
  function patchShowPage(){
    if(window.__pccShowPagePatched10184) return;
    window.__pccShowPagePatched10184=true;
    const old=window.showPage;
    window.showPage=function(id,btn){
      if(id==='projectCommandCenter'){
        document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));
        ensurePage().classList.remove('hidden');
        document.querySelectorAll('.nav').forEach(n=>n.classList.remove('active'));
        if(btn) btn.classList.add('active');
        api.open().catch(e=>{ensurePage().innerHTML=`<div class="pcc-shell"><div class="pcc-card"><h3>تعذر فتح مركز متابعة المشاريع</h3><p>${esc(e.message||e)}</p><button onclick="projectCommandCenterV10172.reload()">إعادة المحاولة</button></div></div>`;});
        return;
      }
      return typeof old==='function'?old.apply(this,arguments):undefined;
    };
    try{showPage=window.showPage;}catch(_){}
  }
  function boot(){ensurePage(); patchShowPage(); attachNavHandlers(); setTimeout(attachNavHandlers,800); setTimeout(attachNavHandlers,2500);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot); else boot(); window.addEventListener('load',boot);
  console.log('Tasneef '+VERSION+' loaded');
})();

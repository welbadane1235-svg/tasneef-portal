/*
 * Tasneef Unified Permissions V10817
 * Central RBAC service, live permission versioning, project scopes, UI guards,
 * user permission editor and server/RLS-aware session header.
 */
(function(){
  'use strict';
  if(window.__tasneefPermissionsV10817) return;
  window.__tasneefPermissionsV10817=true;
  window.__tasneefUnifiedPermissionsOnly=true;
  const BUILD='V10823_ATOMIC_PERMISSIONS_UI';
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const $=id=>document.getElementById(id);
  const now=()=>new Date().toISOString();
  const safeJson=v=>{try{return typeof v==='string'?JSON.parse(v||'{}'):(v||{});}catch(_){return {};}};
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const currentUser=()=>{try{return typeof window.session==='function'?(window.session()||{}):JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return {};}};
  const putUser=u=>localStorage.setItem('tasneef_user',JSON.stringify(u||{}));
  const client=()=>window.sb||(typeof sb!=='undefined'?sb:null);
  const toast=(text,type='ok')=>{if(typeof window.msg==='function')return window.msg(text,type==='err'?'err':'ok');console[type==='err'?'error':'log'](text);};
  const uuid=()=>{try{return crypto.randomUUID();}catch(_){return 'device-'+Date.now()+'-'+Math.random().toString(36).slice(2);}};

  const GROUPS={
    dashboard:['لوحة التحكم',[['view','عرض لوحة التحكم']]],
    users:['المستخدمون',[['view','عرض المستخدمين'],['create','إضافة مستخدم'],['edit','تعديل مستخدم'],['disable','إيقاف وإعادة تفعيل مستخدم'],['manage_permissions','إدارة الصلاحيات'],['copy_permissions','نسخ الصلاحيات'],['end_sessions','إنهاء الجلسات']]],
    projects:['المشاريع',[['view','عرض المشاريع'],['create','إضافة مشروع'],['edit','تعديل مشروع'],['stop','إيقاف مشروع'],['reactivate','إعادة تفعيل مشروع'],['stop_from_contract','إيقاف من قرار العقد'],['view_financial','عرض مالية المشروع']]],
    contracts:['العقود والخدمات',[['view','عرض العقود'],['create','إضافة عقد'],['edit','تعديل عقد'],['renew','تجديد عقد'],['non_renew','عدم التجديد'],['archive','أرشفة عقد'],['view_financial','عرض القيم المالية'],['edit_financial','تعديل القيم المالية'],['manage_services','إدارة الخدمات السنوية'],['manage_attachments','إدارة المرفقات']]],
    workers:['العمال والموظفون',[['view','عرض العمال'],['create','إضافة عامل'],['edit','تعديل عامل'],['stop','إيقاف عامل'],['reactivate','إعادة تفعيل عامل']]],
    distribution:['التوزيع',[['view','عرض التوزيع'],['create','إنشاء توزيع'],['edit','تعديل التوزيع'],['transfer','نقل عامل'],['delete','حذف أو إنهاء توزيع']]],
    attendance:['الحضور والغياب',[['view','عرض الحضور'],['create','تسجيل الحضور'],['edit','تعديل الحضور'],['approve','اعتماد الحضور'],['delete','حذف سجل حضور']]],
    daily_preparation:['تحضير اليوم',[['view','عرض تحضير اليوم'],['create','إنشاء التحضير'],['edit','تعديل التحضير'],['approve','اعتماد التحضير']]],
    checkin_checkout:['الدخول والخروج',[['view','عرض الدخول والخروج'],['checkin','تسجيل الدخول'],['checkout','تسجيل الخروج'],['manual_save','الحفظ اليدوي'],['force_checkout','إجبار تسجيل الخروج']]],
    monthly_times:['الأوقات الشهرية',[['view','عرض الأوقات'],['recalculate','إعادة الاحتساب'],['print','الطباعة'],['export','التصدير']]],
    payroll:['الرواتب',[['view','عرض الرواتب'],['recalculate','إعادة الاحتساب'],['edit','تعديل الرواتب'],['approve','اعتماد الرواتب'],['print','الطباعة'],['export','التصدير'],['view_financial','عرض البيانات المالية']]],
    tickets:['التكتات',[['view','عرض التكتات'],['create','إنشاء تكت'],['edit','تعديل التكت'],['assign','استلام أو إسناد التكت'],['close','إغلاق التكت'],['delete','حذف التكت']]],
    orders:['الأوردرات',[['view','عرض الأوردرات'],['create','إضافة أوردر'],['edit','تعديل أوردر'],['archive','أرشفة أوردر'],['print','الطباعة'],['export','التصدير'],['manage_receipts','إدارة الإيصالات'],['view_financial','عرض المالية'],['edit_financial','تعديل المالية']]],
    crm:['CRM والمبيعات',[['view','عرض CRM'],['create','إضافة عميل'],['edit','تعديل العميل'],['assign','إسناد عميل'],['close','إغلاق الفرصة'],['export','التصدير']]],
    inventory:['المخزن والجرد',[['view','عرض المخزن'],['create','إضافة صنف'],['edit','تعديل صنف'],['issue','صرف مخزون'],['receive','استلام مخزون'],['approve','اعتماد حركة مخزون']]],
    notifications:['التنبيهات',[['view','عرض التنبيهات'],['manage','إدارة التنبيهات'],['resolve','حسم التنبيه']]],
    reports:['التقارير',[['view','عرض التقارير'],['print','الطباعة'],['export','التصدير']]],
    clients:['العملاء',[['view','عرض العملاء'],['create','إضافة عميل'],['edit','تعديل العميل']]],
    quotes:['عروض الأسعار',[['view','عرض عروض الأسعار'],['create','إضافة عرض'],['edit','تعديل عرض'],['approve','اعتماد عرض'],['print','الطباعة'],['export','التصدير'],['view_financial','عرض المالية']]],
    expenses:['المصروفات والعهدة',[['view','عرض المصروفات'],['create','إضافة مصروف'],['edit','تعديل المصروف'],['approve','اعتماد المصروف'],['view_financial','عرض المالية']]],
    maintenance:['الصيانة',[['view','عرض الصيانة'],['manage','إدارة الصيانة']]],
    quality:['الجودة',[['view','عرض الجودة'],['manage','إدارة الجودة']]],
    supervisor_reports:['تقارير المشرفين',[['view','عرض التقارير'],['edit','تعديل التقرير'],['print','الطباعة']]],
    files:['الملفات',[['view','عرض الملفات'],['upload','رفع ملف'],['delete','حذف ملف']]],
    portal:['بوابة العملاء',[['view','عرض البوابة'],['manage','إدارة البوابة']]],
    settings:['الإعدادات',[['view','عرض الإعدادات'],['manage','إدارة الإعدادات']]],
    audit_log:['سجل الرقابة',[['view','عرض سجل الرقابة']]],
    assistant:['المساعد الإداري',[['view','فتح المساعد'],['manage','استخدام الإجراءات']]],
    export_center:['مركز التصدير',[['view','عرض مركز التصدير'],['export','تنزيل الملفات']]]
  };
  const CATALOG=[];
  Object.entries(GROUPS).forEach(([module,[moduleName,actions]])=>actions.forEach(([action,label])=>CATALOG.push({permission_key:module+'.'+action,module,module_name:moduleName,action,action_name:label,is_sensitive:/delete|approve|manage|financial|stop|renew|disable|sessions/.test(action)})));
  const KEYS=new Set(CATALOG.map(x=>x.permission_key));
  const ALIASES={
    'users.manage':'users.manage_permissions','users.update':'users.edit','users.status':'users.disable','projects.update':'projects.edit','workers.update':'workers.edit',
    'contracts.update':'contracts.edit','contracts.manage':'contracts.edit','contracts_services.update':'contracts.manage_services','contracts.attachments.manage':'contracts.manage_attachments','contracts_attachments.manage':'contracts.manage_attachments',
    'contracts.financial.update':'contracts.edit_financial','contracts_finance.update':'contracts.edit_financial','contracts.value.update':'contracts.edit_financial',
    'daily_records.view':'daily_preparation.view','daily_records.create':'daily_preparation.create','daily_records.update':'daily_preparation.edit','daily_records.manage':'daily_preparation.edit','daily_records.print':'reports.print',
    'salaries.view':'payroll.view','salaries.manage':'payroll.edit','salaries.print':'payroll.print','salaries.export':'payroll.export','salaries.view_financial':'payroll.view_financial',
    'client_portal.view':'portal.view','client_portal.manage':'portal.manage','audit.audit_view':'audit_log.view','audit.view':'audit_log.view',
    'files.files_upload':'files.upload','files.files_delete':'files.delete','orders.manage':'orders.edit','tickets.manage':'tickets.edit','inventory.manage':'inventory.edit',
    'attendance.manage':'attendance.edit','distribution.manage':'distribution.edit','crm.manage':'crm.edit','crm.update':'crm.edit','clients.manage':'clients.edit','clients.update':'clients.edit','quotes.manage':'quotes.edit','quotes.update':'quotes.edit','expenses.manage':'expenses.edit',
    'maintenance.manage':'maintenance.manage','settings.view':'settings.view','contracts.executed.override':'contracts.manage_services'
  };
  const normalizeKey=k=>ALIASES[S(k)]||S(k);
  const SUPER_ROLES=new Set(['super_admin','system_admin','admin']);
  const ROLE_LABELS={super_admin:'المدير العام',operations_manager:'مدير التشغيل',sales_manager:'مدير المبيعات',accountant:'المحاسب',maintenance_manager:'مدير الصيانة',quality_manager:'مدير الجودة',hr_manager:'مدير الموارد البشرية',warehouse_manager:'مدير المخازن',contracts_officer:'مسؤول العقود',hr_officer:'مسؤول الموارد البشرية',tickets_officer:'مسؤول التكتات',orders_officer:'مسؤول الأوردرات',sales_employee:'موظف مبيعات',data_entry:'موظف إدخال بيانات',supervisor:'مشرف',technician:'فني',read_only:'مراقب قراءة فقط',custom:'مستخدم مخصص'};
  const ROLE_TEMPLATES={
    super_admin:['*'],
    operations_manager:['dashboard.view','projects.view','projects.create','projects.edit','projects.stop','projects.reactivate','contracts.view','contracts.edit','contracts.renew','contracts.non_renew','contracts.manage_services','contracts.manage_attachments','workers.view','workers.create','workers.edit','workers.stop','workers.reactivate','distribution.view','distribution.create','distribution.edit','distribution.transfer','distribution.delete','attendance.view','attendance.create','attendance.edit','attendance.approve','daily_preparation.view','daily_preparation.create','daily_preparation.edit','daily_preparation.approve','checkin_checkout.view','checkin_checkout.checkin','checkin_checkout.checkout','checkin_checkout.manual_save','checkin_checkout.force_checkout','monthly_times.view','monthly_times.recalculate','monthly_times.print','monthly_times.export','tickets.view','tickets.create','tickets.edit','tickets.assign','tickets.close','orders.view','orders.create','orders.edit','orders.print','reports.view','reports.print','notifications.view','notifications.manage','notifications.resolve','supervisor_reports.view','supervisor_reports.edit','supervisor_reports.print'],
    sales_manager:['dashboard.view','crm.view','crm.create','crm.edit','crm.assign','crm.close','crm.export','clients.view','clients.create','clients.edit','quotes.view','quotes.create','quotes.edit','quotes.approve','quotes.print','quotes.export','quotes.view_financial','contracts.view','reports.view','reports.export'],
    accountant:['dashboard.view','payroll.view','payroll.recalculate','payroll.edit','payroll.approve','payroll.print','payroll.export','payroll.view_financial','contracts.view','contracts.view_financial','orders.view','orders.view_financial','expenses.view','expenses.create','expenses.edit','expenses.approve','expenses.view_financial','reports.view','reports.print','reports.export'],
    maintenance_manager:['dashboard.view','projects.view','workers.view','tickets.view','tickets.create','tickets.edit','tickets.assign','tickets.close','maintenance.view','maintenance.manage','inventory.view','inventory.issue','contracts.view','contracts.manage_services','reports.view'],
    supervisor:['dashboard.view','projects.view','workers.view','attendance.view','attendance.create','attendance.edit','daily_preparation.view','daily_preparation.create','daily_preparation.edit','checkin_checkout.view','checkin_checkout.checkin','checkin_checkout.checkout','tickets.view','tickets.create','tickets.edit','tickets.assign','orders.view','orders.create','orders.edit','supervisor_reports.view','supervisor_reports.edit','supervisor_reports.print','inventory.view','inventory.issue'],
    technician:['tickets.view','tickets.edit','tickets.assign','tickets.close','attendance.view','attendance.create','checkin_checkout.view','checkin_checkout.checkin','checkin_checkout.checkout','inventory.view','inventory.issue'],
    sales_employee:['dashboard.view','crm.view','crm.create','crm.edit','crm.assign','clients.view','clients.create','clients.edit','quotes.view','quotes.create','quotes.edit','quotes.print'],
    read_only:[...CATALOG.filter(x=>x.action==='view').map(x=>x.permission_key)],
    warehouse_manager:['dashboard.view','inventory.view','inventory.create','inventory.edit','inventory.issue','inventory.receive','inventory.approve','reports.view','reports.print','reports.export','workers.view','projects.view'],
    custom:['dashboard.view']
  };
  const PAGE_PERMISSIONS={dashboard:'dashboard.view',users:'users.view',projects:'projects.view',workers:'workers.view',distribution:'distribution.view',attendance:'attendance.view',daily:'checkin_checkout.view',monthly:'monthly_times.view',salaries:'payroll.view',contracts:'contracts.view',crm:'crm.view',tickets:'tickets.view',orders:'orders.view',inventoryAudit:'inventory.view',alerts:'notifications.view',export:'export_center.view',assistant:'assistant.view',adminTasks:'notifications.manage'};
  const SUP_PAGE_PERMISSIONS={supSummary:'dashboard.view',supAttendance:'attendance.view',supLogs:'checkin_checkout.view',supTickets:'tickets.view',supOrders:'orders.view',supClientDailyReport:'supervisor_reports.view',supAdminTasks:'notifications.view'};
  const TECH_PAGE_PERMISSIONS={techOpen:'tickets.view',techMine:'tickets.view',techDone:'tickets.view',techAttendanceTab:'attendance.view',techTicketsTab:'tickets.view'};
  const ACTION_PERMISSIONS={
    saveUser:'users.edit',toggleUserStatusV10700:'users.disable',endUserSessionsV10700:'users.end_sessions',copyUserPermissionsV10700:'users.copy_permissions',
    saveProject:'projects.edit',clearProjectForm:'projects.create',saveProjectManagerSupervisor:'projects.edit',addExistingWorkerToProject:'distribution.edit',addWorkerInsideProject:'workers.create',
    saveWorker:'workers.edit',clearWorkerForm:'workers.create',saveAttendance:'attendance.edit',clearAttendanceForm:'attendance.create',exportAttendanceMatrixCSV:'attendance.view',
    saveTimeLog:'checkin_checkout.manual_save',setNow:'checkin_checkout.manual_save',exportDailyManagerPDF:'reports.print',sendDailyManagerWhatsapp:'reports.view',
    saveTicket:'tickets.edit',clearTicketForm:'tickets.create',claimTicket:'tickets.assign',closeTicket:'tickets.close',deleteTicket:'tickets.delete',setTicketStatus:'tickets.edit',
    saveOrderV233:'orders.edit',clearOrderFormV233:'orders.create',deleteCurrentOrderV233:'orders.archive',renderOrdersV233:'orders.view','tasneefOrders10400.exportExcel':'orders.export','tasneefOrders10400.printFiltered':'orders.print','tasneefOrders10400.openQuoteBuilder':'quotes.create',
    openNewContractService:'contracts.manage_services',editContractService:'contracts.edit',executeContractService:'contracts.manage_services',startContractRenewalV10814:'contracts.renew',startContractNonRenewV10814:'contracts.non_renew',exportContractServicesCSV:'contracts.view','tasneefPrintContractsServicesV10097':'contracts.view',
    'tasneefDistributionV404':'distribution.edit','tasneefInventoryAuditV10059.newAudit':'inventory.create','tasneefInventoryAuditV10059.closeAudit':'inventory.approve','tasneefInventoryAuditV10059.exportCsv':'inventory.view','tasneefInventoryAuditV10059.print':'inventory.view',
    exportMeetingExcelV229:'export_center.export',downloadImportTemplateV223:'export_center.export',exportTable:'reports.export',assistantQuick:'assistant.manage',assistantSend:'assistant.manage',assistantPrintLast:'assistant.view',assistantWhatsappLast:'assistant.manage',
    supervisorCheckIn:'checkin_checkout.checkin',supervisorCheckOut:'checkin_checkout.checkout',supervisorExitSelectedWorkers:'checkin_checkout.force_checkout',supOrdersSaveV10061:'orders.edit',supervisorSaveInventoryRequest:'inventory.issue',supClientSaveDailyReport:'supervisor_reports.edit',
    saveTechnicianTicket:'tickets.edit',clearTechnicianTicketForm:'tickets.create',techAttendanceCheckIn:'checkin_checkout.checkin',techAttendanceCheckOut:'checkin_checkout.checkout',techAttendanceAbsent:'attendance.create',deleteTechAttendance:'attendance.delete',printTechAttendancePDF:'attendance.view',
    movePremiumService:'supervisor_reports.edit',removePremiumService:'supervisor_reports.edit',removePremiumImage:'supervisor_reports.edit',handlePremiumImages:'supervisor_reports.edit',setPremiumServiceField:'supervisor_reports.edit',sendPremiumWhatsapp:'reports.view',
    supClientAddService:'supervisor_reports.edit',supClientOpenSlideModal:'supervisor_reports.view',supClientRemoveImg:'supervisor_reports.edit',supClientHandleImages:'supervisor_reports.edit',supClientSetService:'supervisor_reports.edit',supClientSaveDailyReport:'supervisor_reports.edit',supClientReportProjectChanged:'supervisor_reports.view',renderSupervisorDailySummary:'supervisor_reports.view',
    toggleAnnualVisit:'contracts.manage_services',toggleCoreVisit:'contracts.manage_services',renderCostReductionV152:'expenses.view',v118ShowProductDetail:'inventory.view',sendLogWhatsapp:'checkin_checkout.view',deleteOrderV233:'orders.archive'
  };
  const FINANCIAL_PERMISSION_BY_SECTION={contracts:'contracts.view_financial',orders:'orders.view_financial',salaries:'payroll.view_financial',projects:'projects.view_financial',crm:'quotes.view_financial'};
  const NON_ACTION_FUNCTIONS=new Set(['showPage','showSupervisorWindow','showTechWindow','showTechMainTab','showTechMainTabById','logout','login','refreshAll','print','window.print','window.open','document.getElementById','event.stopPropagation','this.closest','copyText','playAppSound','enableSupervisorSounds','assistantClear','assistantCopyLast','resetServiceFilters','resetOrdersFiltersV233','resetTicketAdvancedFiltersV10801','clearBatchFiltersV149','filterSupplierInvoicesV178','changeOrdersPageV360']);
  const MODULE_HINTS=[
    [/permission|security|user|session/i,'users'],[/contract|annualservice|servicevisit/i,'contracts'],[/project/i,'projects'],[/worker|employee/i,'workers'],[/distribution|assignment|smartworkerproject/i,'distribution'],[/attendance|absent/i,'attendance'],[/checkin|checkout|timelog|logform|exitselected/i,'checkin_checkout'],[/monthly/i,'monthly_times'],[/salary|salar|payroll/i,'payroll'],[/ticket/i,'tickets'],[/order|receipt|quote/i,'orders'],[/crm|customer|communication|opportunity/i,'crm'],[/inventory|stock|supplier|consumption/i,'inventory'],[/finance|expense|costcenter/i,'expenses'],[/alert|notification/i,'notifications'],[/portal|gateway/i,'portal'],[/supervisorreport|clientdailyreport/i,'supervisor_reports'],[/report/i,'reports'],[/assistant/i,'assistant'],[/export|download/i,'export_center']
  ];
  function existingPermission(module,action){const direct=module+'.'+action;if(KEYS.has(direct))return direct;const fallback=['edit','manage','view'].map(a=>module+'.'+a).find(k=>KEYS.has(k));return fallback||'';}
  function inferPermission(path){path=S(path);if(!path||NON_ACTION_FUNCTIONS.has(path))return '';if(ACTION_PERMISSIONS[path])return ACTION_PERMISSIONS[path];
    if(/^OrdersUI\./.test(path)){const a=path.split('.').pop();return ({newOrder:'orders.create',save:'orders.edit',edit:'orders.edit',archive:'orders.archive',archiveCurrent:'orders.archive',restore:'orders.archive',deleteAttachment:'orders.manage_receipts',receipts:'orders.manage_receipts',openAttachment:'orders.view',exportExcel:'orders.export',print:'orders.print',quote:'quotes.create',view:'orders.view',whatsapp:'orders.view',page:'orders.view',refresh:'orders.view',resetFilters:'orders.view'}[a]||'orders.view');}
    if(/^ContractsServicesEditor\./.test(path)){const a=path.split('.').pop();return ({openEditor:'contracts.edit',openAlertDetails:'contracts.view',snoozeAlert:'notifications.manage',startRenewal:'contracts.renew',startNonRenew:'contracts.non_renew',renderContractAlerts:'notifications.view'}[a]||'contracts.view');}
    if(/^tasneefCRM\./.test(path)){const a=path.split('.').pop();return /export/i.test(a)?'crm.export':/complete|convert|save|edit|status|task|communication/i.test(a)?'crm.edit':/openCustomer|openProfile/.test(a)?'crm.view':'crm.view';}
    const low=path.toLowerCase();const module=(MODULE_HINTS.find(([rx])=>rx.test(low))||[])[1];if(!module)return '';
    let action='view';if(/nonrenew|non_renew/.test(low))action='non_renew';else if(/renew/.test(low))action='renew';else if(/force.*checkout|exitselected/.test(low))action='force_checkout';else if(/checkout/.test(low))action='checkout';else if(/checkin/.test(low))action='checkin';else if(/assign|claim/.test(low))action='assign';else if(/archive/.test(low))action='archive';else if(/delete|remove/.test(low))action='delete';else if(/approve/.test(low))action='approve';else if(/close/.test(low))action=module==='tickets'?'close':'edit';else if(/export|csv|excel|download/.test(low))action='export';else if(/print|pdf/.test(low))action='print';else if(/upload|attachment|image/.test(low))action=module==='contracts'?'manage_attachments':module==='orders'?'manage_receipts':'edit';else if(/create|new|add/.test(low))action='create';else if(/save|edit|update|toggle|mark|execute|complete|convert|move|return|reject|dismiss|set/.test(low))action='edit';
    return existingPermission(module,action);
  }
  const TABLE_OPERATION_PERMISSIONS={app_users:'users.disable',projects:'projects.stop',workers:'workers.stop',attendance:'attendance.delete',time_logs:'checkin_checkout.manual_save',tickets:'tickets.delete',orders:'orders.archive',app_orders:'orders.archive',contracts:'contracts.archive',contract_services:'contracts.archive',contract_attachments:'contracts.manage_attachments',inventory_items:'inventory.edit',inventory_movements:'inventory.approve',inventory_requests:'inventory.approve',salary_records:'payroll.edit',payroll_records:'payroll.edit'};
  function permissionForHandler(text){text=S(text);const path=functionPathFromOnclick(text);if(['deleteRow','financeDelete'].includes(path)){const m=text.match(/^[^(]+\(\s*['"]([^'"]+)/);return TABLE_OPERATION_PERMISSIONS[S(m?.[1])]||inferPermission(path);}return inferPermission(path);}

  const state={loaded:false,userId:'',version:0,roleKey:'',effective:{},sources:{},scopeType:'all',projectIds:[],loading:null,lastLoadAt:0,uiFrame:0,uiRevision:0,applying:false};
  const adminState={targetId:null,initialOverrides:{},overrides:{},effective:{},sources:{},bundle:null,loading:false};
  let broadcast=null;
  try{broadcast=new BroadcastChannel('tasneef-permissions-v10817');broadcast.onmessage=e=>{if(e.data?.type==='permissions-updated')checkVersion(true);};}catch(_){}

  const ROLE_KEY_ALIASES={admin:'super_admin',system_admin:'super_admin',super_admin:'super_admin',general_manager:'operations_manager',operations_manager:'operations_manager',financial_manager:'accountant',finance_manager:'accountant',accountant:'accountant',warehouse_manager:'warehouse_manager',warehouse_officer:'warehouse_manager',maintenance_manager:'maintenance_manager',sales_manager:'sales_manager',sales_employee:'sales_employee',supervisor:'supervisor',technician:'technician',read_only:'read_only',custom:'custom'};
  function roleKey(u=currentUser()){
    const explicit=S(u?.role_key).toLowerCase(),legacy=S(u?.role).toLowerCase();
    const chosen=(explicit&&explicit!=='custom')?explicit:(legacy||explicit||'custom');
    return ROLE_KEY_ALIASES[chosen]||chosen||'custom';
  }
  function isSuper(u=currentUser()){return roleKey(u)==='super_admin'||SUPER_ROLES.has(S(u?.role_key).toLowerCase())||SUPER_ROLES.has(S(u?.role).toLowerCase());}
  function token(){
    return S(
      currentUser().permission_session_token||
      currentUser().session_token||
      localStorage.getItem('tasneef_session_token_v10817')||
      localStorage.getItem('tasneef_permission_session_v10817')
    );
  }
  function setSessionHeader(){const t=token();const c=client();if(!t||!c)return;try{if(c.rest?.headers)c.rest.headers['x-tasneef-session']=t;if(c.storage?.headers)c.storage.headers['x-tasneef-session']=t;}catch(e){console.warn(BUILD,'header',e);}}
  function cacheKey(userId,version){return `tasneef:user-permissions:${S(userId)}:${Number(version)||0}`;}
  function clearPermissionCache(userId){const prefix='tasneef:user-permissions:'+S(userId)+':';Object.keys(localStorage).forEach(k=>{if(k.startsWith(prefix))localStorage.removeItem(k);});}
  function scopeAllowed(ctx={}){
    const pid=S(ctx.project_id||ctx.projectId||ctx.resource?.project_id);
    if(!pid||state.scopeType==='all')return true;
    if(['assigned_projects','specific_projects','supervisor_projects'].includes(state.scopeType))return state.projectIds.map(S).includes(pid);
    if(state.scopeType==='own')return S(ctx.created_by||ctx.resource?.created_by)===S(state.userId);
    return true;
  }
  function fallbackEffective(u){
    const result={},sources={};
    const serverEffective=safeJson(u.effective_permissions||u.permissions_effective);
    const custom=safeJson(u.permissions),denials=safeJson(u.permission_denials||u.denials),rk=roleKey(u);const preset=ROLE_TEMPLATES[rk]||[];
    CATALOG.forEach(p=>{let v=preset.includes('*')||preset.includes(p.permission_key),src=v?'role':'none';const aliases=[p.permission_key,...Object.entries(ALIASES).filter(([,to])=>to===p.permission_key).map(([from])=>from)];
      if(Object.prototype.hasOwnProperty.call(serverEffective,p.permission_key)){v=serverEffective[p.permission_key]===true;src='server';}
      for(const k of aliases){if(denials[k]===true||denials[k]==='deny'||custom[k]===false||custom[k]==='deny'){v=false;src='user_deny';break;}if(custom[k]===true||custom[k]==='allow'||custom[k]===1){v=true;src='user_allow';}}
      result[p.permission_key]=isSuper(u)?true:!!v;sources[p.permission_key]=isSuper(u)?'super_admin':src;
    });return {permissions:result,sources,role_key:rk,permissions_version:Number(u.permissions_version||0),scope_type:u.scope_type||'all',project_ids:A(u.allowed_project_ids)};
  }
  async function callRpc(name,args={}){const c=client();if(!c)throw new Error('قاعدة البيانات غير متاحة');setSessionHeader();const r=await c.rpc(name,args);if(r.error)throw r.error;return r.data;}
  function isMissingRpc(e){return /PGRST202|Could not find the function|function .* does not exist|schema cache/i.test(S(e?.message||e));}
  async function load(force=false){
    const u=currentUser(),uid=S(u.id||u.user_id);if(!uid)return fallbackEffective(u);
    if(state.loading&&!force)return state.loading;if(state.loaded&&!force&&Date.now()-state.lastLoadAt<30000)return state;
    state.loading=(async()=>{setSessionHeader();let bundle=null;try{bundle=await callRpc('get_effective_permissions_v10817',{p_session_token:token()||null,p_target_user_id:Number(uid)});if(Array.isArray(bundle))bundle=bundle[0];}catch(e){if(!isMissingRpc(e))console.warn(BUILD,'server permissions fallback:',e.message||e);bundle=fallbackEffective(u);}
      bundle=bundle||fallbackEffective(u);state.userId=uid;state.version=Number(bundle.permissions_version||u.permissions_version||0);state.roleKey=S(bundle.role_key||roleKey(u));state.effective=safeJson(bundle.permissions||bundle.effective_permissions);state.sources=safeJson(bundle.sources);state.scopeType=S(bundle.scope_type||u.scope_type||'all');state.projectIds=A(bundle.project_ids||bundle.allowed_project_ids).map(S);if(isSuper(u))CATALOG.forEach(p=>{state.effective[p.permission_key]=true;state.sources[p.permission_key]='super_admin';});state.loaded=true;state.lastLoadAt=Date.now();localStorage.setItem(cacheKey(uid,state.version),JSON.stringify({effective:state.effective,sources:state.sources,scopeType:state.scopeType,projectIds:state.projectIds,at:now()}));const nu={...u,permissions_version:state.version,effective_permissions:state.effective,permission_sources:state.sources};putUser(nu);applyUI(true);return state;})().finally(()=>state.loading=null);return state.loading;
  }
  function canPermission(key,ctx={}){
    const k=normalizeKey(key),u=currentUser();
    if(!u||!S(u.id||u.user_id))return false;
    if(u.is_active===false||['suspended','locked','expired','disabled'].includes(S(u.status).toLowerCase()))return false;
    if(isSuper(u))return true;
    let v;
    if(state.loaded&&S(state.userId)===S(u.id||u.user_id))v=state.effective[k];
    else{const fb=fallbackEffective(u);v=fb.permissions[k];state.scopeType=fb.scope_type;state.projectIds=A(fb.project_ids).map(S);}
    return v===true&&scopeAllowed(ctx||{});
  }
  function requirePermission(key,ctx={}){if(canPermission(key,ctx))return true;toast('ليس لديك صلاحية لتنفيذ هذا الإجراء','err');return false;}
  async function checkVersion(forceReload=false){const u=currentUser();if(!u?.id||!token())return;try{const d=await callRpc('get_permissions_version_v10817',{p_session_token:token()});const v=Number(typeof d==='object'?d?.permissions_version:d);if(forceReload||v>Number(state.version||u.permissions_version||0)){clearPermissionCache(u.id);await load(true);broadcast?.postMessage({type:'permissions-reloaded',userId:u.id,version:v});}}catch(e){if(!isMissingRpc(e))console.warn(BUILD,'version check',e.message||e);}}
  window.PermissionsService={BUILD,CATALOG,ALIASES,ROLE_TEMPLATES,getCurrentUserPermissions:load,load,can:canPermission,require:requirePermission,checkVersion,clearUserCache:clearPermissionCache,isSuperAdmin:isSuper,normalizeKey,inferActionPermission:inferPermission,state};
  window.can=function(a,b,c,d){return typeof a==='string'?canPermission(a,b||{}):canPermission(b,c||{});};
  window.requirePermissionV10700=function(k,ctx,res){return requirePermission(k,{...(ctx||{}),resource:res});};
  window.requirePermission=function(k,ctx){return requirePermission(k,ctx);};

  function functionPathFromOnclick(text){const m=S(text).match(/^\s*([\w$.]+)/);return m?m[1]:'';}
  function handlerText(el){return S(el?.getAttribute?.('onclick')||el?.getAttribute?.('onchange')||el?.getAttribute?.('onsubmit'));}
  function resolvePath(path){const parts=S(path).split('.');let obj=window;for(const p of parts.slice(0,-1)){obj=obj?.[p];if(!obj)return null;}return {obj,key:parts.at(-1)};}
  function guardFunction(path,permission){const r=resolvePath(path);if(!r||typeof r.obj?.[r.key]!=='function')return;const old=r.obj[r.key];if(old.__permissionGuardV10817===permission)return;const wrapped=function(){const first=arguments[0];const ctx=typeof first==='object'?first:{project_id:first?.project_id};if(!requirePermission(permission,ctx))return undefined;return old.apply(this,arguments);};wrapped.__permissionGuardV10817=permission;wrapped.__permissionOriginal=old;r.obj[r.key]=wrapped;}
  function guardTableOperation(path){const r=resolvePath(path);if(!r||typeof r.obj?.[r.key]!=='function')return;const old=r.obj[r.key];if(old.__permissionGuardV10817==='dynamic_table')return;const wrapped=function(table){const p=TABLE_OPERATION_PERMISSIONS[S(table)]||'settings.manage';if(!requirePermission(p))return undefined;return old.apply(this,arguments);};wrapped.__permissionGuardV10817='dynamic_table';wrapped.__permissionOriginal=old;r.obj[r.key]=wrapped;}
  function installGuards(){Object.entries(ACTION_PERMISSIONS).forEach(([fn,p])=>guardFunction(fn,p));guardTableOperation('deleteRow');guardTableOperation('financeDelete');document.querySelectorAll('[onclick],[onchange],[onsubmit]').forEach(el=>{const txt=handlerText(el),fn=functionPathFromOnclick(txt),p=permissionForHandler(txt);if(p&&!['deleteRow','financeDelete'].includes(fn))guardFunction(fn,p);});}
  function wrapRoutes(){
    if(typeof window.showPage==='function'&&!window.showPage.__permissionsV10817){const old=window.showPage;const w=function(id,btn){const p=PAGE_PERMISSIONS[id];if(p&&!requirePermission(p))return false;return old.apply(this,arguments);};w.__permissionsV10817=true;window.showPage=w;}
    if(typeof window.showSupervisorWindow==='function'&&!window.showSupervisorWindow.__permissionsV10817){const old=window.showSupervisorWindow;const w=function(id,btn){const p=SUP_PAGE_PERMISSIONS[id];if(p&&!requirePermission(p))return false;return old.apply(this,arguments);};w.__permissionsV10817=true;window.showSupervisorWindow=w;}
    if(typeof window.showTechWindow==='function'&&!window.showTechWindow.__permissionsV10817){const old=window.showTechWindow;const w=function(id,btn){const p=TECH_PAGE_PERMISSIONS[id];if(p&&!requirePermission(p))return false;return old.apply(this,arguments);};w.__permissionsV10817=true;window.showTechWindow=w;}
    if(typeof window.showTechMainTab==='function'&&!window.showTechMainTab.__permissionsV10817){const old=window.showTechMainTab;const w=function(id,btn){const p=TECH_PAGE_PERMISSIONS[id];if(p&&!requirePermission(p))return false;return old.apply(this,arguments);};w.__permissionsV10817=true;window.showTechMainTab=w;}
  }
  function closestSectionId(el){return el.closest('section.page,section,[id]')?.id||'';}
  function applyFinancialRedaction(){
    document.querySelectorAll('.perm17-financial-redacted').forEach(el=>el.classList.remove('perm17-financial-redacted'));
    document.querySelectorAll('[data-perm17-financial-hidden="true"]').forEach(el=>{el.style.display=el.dataset.perm17PreviousDisplay||'';delete el.dataset.perm17FinancialHidden;delete el.dataset.perm17PreviousDisplay;});
    document.querySelectorAll('section.page').forEach(section=>{const permission=FINANCIAL_PERMISSION_BY_SECTION[section.id];if(!permission||canPermission(permission))return;section.querySelectorAll('label,.ov8-finance-row,[data-financial],.financial,.money-value').forEach(el=>{const t=S(el.textContent);if(el.matches('.ov8-finance-row,[data-financial],.financial,.money-value')||/قيمة|تكلفة|ربح|راتب|خصم|سلف|إجمالي المبالغ|قبل الضريبة|الضريبة/.test(t))el.classList.add('perm17-financial-redacted');});section.querySelectorAll('table').forEach(table=>{const heads=[...table.querySelectorAll('thead th')];heads.forEach((th,i)=>{if(/قيمة|تكلفة|ربح|راتب|خصم|سلف|إجمالي|ضريبة|مالي/.test(S(th.textContent))){[th,...table.querySelectorAll('tbody tr')].map((node,idx)=>idx===0?node:node.children[i]).filter(Boolean).forEach(cell=>{if(!cell.dataset.perm17FinancialHidden){cell.dataset.perm17PreviousDisplay=cell.style.display||'';cell.dataset.perm17FinancialHidden='true';}cell.style.display='none';});}});});});
  }
  function enforceVisiblePagePermission(){
    if(!state.loaded)return;
    const visible=[...document.querySelectorAll('section.page')].find(el=>getComputedStyle(el).display!=='none'&&!el.classList.contains('hidden'));
    if(!visible)return;const p=PAGE_PERMISSIONS[visible.id];if(!p||canPermission(p))return;
    visible.style.display='none';const fallback=canPermission('dashboard.view')?$('dashboard'):null;if(fallback)fallback.style.display='block';toast('تم تحديث صلاحياتك ولم يعد هذا القسم متاحًا','err');
  }
  function applyUINow(){
    const u=currentUser();
    if(S(u?.id||u?.user_id) && !state.loaded) return;
    if(state.applying) return;
    state.applying=true;
    document.documentElement.classList.add('tasneef-permissions-applying-v10823');
    try{
      wrapRoutes();installGuards();
      document.querySelectorAll('[onclick*="showPage("]').forEach(el=>{const m=S(el.getAttribute('onclick')).match(/showPage\(['"]([^'"]+)/);const p=m&&PAGE_PERMISSIONS[m[1]];if(p){const allowed=canPermission(p);el.dataset.permission=p;el.dataset.permissionHidden=allowed?'false':'true';if(allowed&&el.style.display==='none')el.style.removeProperty('display');}});
      document.querySelectorAll('[onclick*="showSupervisorWindow("]').forEach(el=>{const m=S(el.getAttribute('onclick')).match(/showSupervisorWindow\(['"]([^'"]+)/);const p=m&&SUP_PAGE_PERMISSIONS[m[1]];if(p){const allowed=canPermission(p);el.dataset.permission=p;el.dataset.permissionHidden=allowed?'false':'true';if(allowed&&el.style.display==='none')el.style.removeProperty('display');}});
      document.querySelectorAll('[onclick],[onchange],[onsubmit]').forEach(el=>{const txt=handlerText(el),p=permissionForHandler(txt);if(p){const allowed=canPermission(p);el.dataset.permission=p;el.dataset.permissionHidden=allowed?'false':'true';if(allowed&&el.style.display==='none'&&!el.classList.contains('hidden'))el.style.removeProperty('display');}});
      document.querySelectorAll('[onclick^="openAdvancedUserForm"]').forEach(el=>{const hasId=!/openAdvancedUserForm\(\s*\)/.test(S(el.getAttribute('onclick')));el.dataset.permission=hasId?'users.edit':'users.create';el.dataset.permissionSecondary='users.manage_permissions';});
      document.querySelectorAll('[data-permission]').forEach(el=>{const p=el.dataset.permission,p2=el.dataset.permissionSecondary,allowed=canPermission(p)&&(!p2||canPermission(p2));el.dataset.permissionHidden=allowed?'false':'true';el.disabled=!allowed;if(allowed&&el.style.display==='none'&&!el.classList.contains('hidden'))el.style.removeProperty('display');});
      applyFinancialRedaction();
      enforceVisiblePagePermission();
      state.uiRevision++;
      document.documentElement.dataset.tasneefPermissionsReady='true';
    }finally{
      state.applying=false;
      requestAnimationFrame(()=>document.documentElement.classList.remove('tasneef-permissions-applying-v10823'));
    }
  }
  function applyUI(force=false){
    if(force){
      if(state.uiFrame){cancelAnimationFrame(state.uiFrame);state.uiFrame=0;}
      return applyUINow();
    }
    if(state.uiFrame) return;
    state.uiFrame=requestAnimationFrame(()=>{state.uiFrame=0;applyUINow();});
  }
  function guardDomEvent(e){const selector=e.type==='submit'?'form[data-permission],form[onsubmit]':'[data-permission],[onclick],[onchange]';const el=e.target.closest?.(selector);if(!el)return;const p=el.dataset.permission||permissionForHandler(handlerText(el)),p2=el.dataset.permissionSecondary;if(p&&(!canPermission(p)||(p2&&!canPermission(p2)))){e.preventDefault();e.stopImmediatePropagation();toast('ليس لديك صلاحية لتنفيذ هذا الإجراء','err');}}
  document.addEventListener('click',guardDomEvent,true);document.addEventListener('change',guardDomEvent,true);document.addEventListener('submit',guardDomEvent,true);

  function attachTokenFromSession(){setSessionHeader();}
  async function permissionLogin(){
    const username=S($('loginUsername')?.value),password=S($('loginPassword')?.value);if(!username||!password)return toast('أدخل اسم المستخدم وكلمة المرور','err');
    const deviceKey='tasneef_permission_device_v10817';let deviceId=localStorage.getItem(deviceKey);if(!deviceId){deviceId=uuid();localStorage.setItem(deviceKey,deviceId);}
    try{const out=await callRpc('tasneef_login_v10817',{p_username:username,p_password:password,p_device_id:deviceId});const d=Array.isArray(out)?out[0]:out;if(!d?.ok||!d?.user)throw new Error(d?.message||'بيانات الدخول غير صحيحة');let u={...d.user,permission_session_token:d.session_token,session_token:d.session_token,permissions_version:d.permissions_version,permissions:d.permissions||{},effective_permissions:d.permissions||{}};if(typeof window.tasneefNormalizeSessionUserV10821==='function')u=window.tasneefNormalizeSessionUserV10821(u);localStorage.setItem('tasneef_session_token_v10817',d.session_token);localStorage.setItem('tasneef_permission_session_v10817',d.session_token);putUser(u);setSessionHeader();await load(true);if(typeof window.tasneefGo==='function')window.tasneefGo(homeForUser(u));else location.href=homeForUser(u);}
    catch(e){if(isMissingRpc(e)&&typeof permissionLogin.__old==='function')return permissionLogin.__old();toast(S(e.message||e),'err');}
  }
  function hookLoginLogout(){
    /* app.js owns the secure login flow. Replacing it caused role/session fields to be lost and every account to be routed as unauthorized. */
    if(document.getElementById('loginUsername')&&typeof window.login!=='function'){permissionLogin.__permissionsV10817=true;window.login=permissionLogin;}
    if(typeof window.logout==='function'&&!window.logout.__permissionsV10817){const old=window.logout;const w=async function(){try{if(token())await callRpc('tasneef_logout_v10817',{p_session_token:token()});}catch(_){}const u=currentUser();clearPermissionCache(u.id);localStorage.removeItem('tasneef_permission_session_v10817');broadcast?.postMessage({type:'logout',userId:u.id});return old.apply(this,arguments);};w.__permissionsV10817=true;window.logout=w;}
  }

  function ensureRoleOptions(){
    ['userRole','userRoleFilterV10700'].forEach(id=>{const el=$(id);if(!el)return;Object.entries(ROLE_LABELS).forEach(([k,label])=>{if(![...el.options].some(o=>o.value===k)){const o=document.createElement('option');o.value=k;o.textContent=label;el.appendChild(o);}});});
    const roleEl=$('userRole');if(roleEl&&!roleEl.__permissionsV10817){roleEl.__permissionsV10817=true;roleEl.addEventListener('change',()=>{adminState.pendingRole=S(roleEl.value);renderPermissionMatrix(true);});}
  }
  function legacyRouteRole(role){const k=S(role||'custom');if(k==='supervisor')return 'supervisor';if(k==='technician')return 'technician';/* app_users.role is a legacy routing field and may have a strict check constraint. RBAC stays in role_key. */return 'admin';}
  function homeForUser(u){const rk=S(u?.role_key||u?.role);if(rk==='technician'||u?.role==='technician')return 'technician.html';if(rk==='supervisor'||u?.role==='supervisor')return 'supervisor.html';return 'admin.html';}
  function ensureAdminToolbar(){
    ensureRoleOptions();const pane=document.querySelector('[data-perm-pane="permissions"]');if(!pane||$('permissionToolbarV10817'))return;
    const old=pane.querySelector('.perm-toolbar');if(old)old.style.display='none';
    const toolbar=document.createElement('div');toolbar.id='permissionToolbarV10817';toolbar.innerHTML=`<div class="perm17-toolbar"><input id="permissionSearchV10817" placeholder="ابحث عن قسم أو صلاحية"><select id="permissionRoleTemplateV10817"><option value="">تطبيق قالب دور…</option>${Object.keys(ROLE_TEMPLATES).map(k=>`<option value="${k}">${esc(k)}</option>`).join('')}</select><button class="light" type="button" onclick="applyRoleTemplateV10817()">تطبيق القالب</button><button class="light" type="button" onclick="pastePermissionsV10817()">لصق الصلاحيات</button><button class="light" type="button" onclick="inspectPermissionsV10817()">فحص الصلاحيات</button><button class="light" type="button" data-super-only-v10817 onclick="grantAllPermissionsV10817()">تفعيل جميع الصلاحيات</button><button class="light" type="button" data-super-only-v10817 onclick="revokeAllPermissionsV10817()">إلغاء جميع الصلاحيات</button></div><div class="perm17-legend"><span>من الدور</span><span>مضافة للمستخدم</span><span>ممنوعة للمستخدم</span></div><div id="permissionWarningV10817" class="perm17-warning">المنع الصريح أقوى من الدور، والصلاحية الخاصة بالمستخدم أقوى من القالب.</div>`;
    pane.insertBefore(toolbar,pane.querySelector('#permissionMatrixV10700'));$('permissionSearchV10817').addEventListener('input',renderPermissionMatrix);
  }
  function effectiveForTarget(key,override){const rk=S($('userRole')?.value||adminState.bundle?.role_key||'custom');if(SUPER_ROLES.has(rk))return {value:true,source:'super_admin'};if(override===true)return {value:true,source:'user_allow'};if(override===false)return {value:false,source:'user_deny'};const v=(ROLE_TEMPLATES[rk]||[]).includes('*')||(ROLE_TEMPLATES[rk]||[]).includes(key);return {value:v,source:v?'role':'none'};}
  function sourceLabel(src){return ({super_admin:'المدير العام',user_allow:'مضافة للمستخدم',user_deny:'ممنوعة للمستخدم',role:'من الدور',none:'غير ممنوحة'}[src]||src);}
  function renderPermissionMatrix(preserveScroll=false){
    ensureAdminToolbar();const box=$('permissionMatrixV10700');if(!box)return;const previousScroll=preserveScroll?box.scrollTop:0;box.className='permission-matrix-v10817';const q=S($('permissionSearchV10817')?.value).toLowerCase();const groups={};CATALOG.filter(p=>!q||[p.permission_key,p.module_name,p.action_name].some(v=>S(v).toLowerCase().includes(q))).forEach(p=>(groups[p.module]??=[]).push(p));
    box.innerHTML=Object.entries(groups).map(([m,rows])=>`<section class="perm17-module"><div class="perm17-module-head"><b>${esc(rows[0].module_name)}</b><div class="perm17-module-actions"><button type="button" class="light" onclick="setPermissionModuleV10817('${m}','allow')">تفعيل القسم</button><button type="button" class="light" onclick="setPermissionModuleV10817('${m}','deny')">منع القسم</button><button type="button" class="light" onclick="setPermissionModuleV10817('${m}','inherit')">من الدور</button></div></div><div class="perm17-grid">${rows.map(p=>{const ov=Object.prototype.hasOwnProperty.call(adminState.overrides,p.permission_key)?adminState.overrides[p.permission_key]:null;const ef=effectiveForTarget(p.permission_key,ov);return `<label class="perm17-row ${p.is_sensitive?'sensitive':''}"><span><b>${esc(p.action_name)}</b><small class="perm17-key">${esc(p.permission_key)}</small></span><select data-permission-key="${esc(p.permission_key)}" onchange="permissionOverrideChangedV10817(this)"><option value="inherit" ${ov===null?'selected':''}>من الدور</option><option value="allow" ${ov===true?'selected':''}>مسموح للمستخدم</option><option value="deny" ${ov===false?'selected':''}>ممنوع للمستخدم</option></select><span class="perm17-source ${ef.source==='user_allow'?'allow':ef.source==='user_deny'?'deny':ef.source==='role'?'role':''}">${sourceLabel(ef.source)}</span></label>`;}).join('')}</div></section>`).join('');
    document.querySelectorAll('[data-super-only-v10817]').forEach(x=>x.style.display=isSuper()?'':'none');
    if(preserveScroll)requestAnimationFrame(()=>{box.scrollTop=previousScroll;});
  }
  window.renderPermissionMatrixV10700=renderPermissionMatrix;
  function refreshPermissionRowV10823(sel){const k=sel?.dataset?.permissionKey;if(!k)return;const row=sel.closest('.perm17-row'),badge=row?.querySelector('.perm17-source');if(!badge)return;const ov=Object.prototype.hasOwnProperty.call(adminState.overrides,k)?adminState.overrides[k]:null,ef=effectiveForTarget(k,ov);badge.className='perm17-source '+(ef.source==='user_allow'?'allow':ef.source==='user_deny'?'deny':ef.source==='role'?'role':'');badge.textContent=sourceLabel(ef.source);row.dataset.permissionDirty=adminState.initialOverrides[k]!==adminState.overrides[k]?'true':'false';}
  window.permissionOverrideChangedV10817=sel=>{const k=sel.dataset.permissionKey;if(sel.value==='inherit')delete adminState.overrides[k];else adminState.overrides[k]=sel.value==='allow';refreshPermissionRowV10823(sel);};
  window.setPermissionModuleV10817=(module,mode)=>{CATALOG.filter(p=>p.module===module).forEach(p=>{if(mode==='inherit')delete adminState.overrides[p.permission_key];else adminState.overrides[p.permission_key]=mode==='allow';});renderPermissionMatrix(true);};
  window.setAllPermissionsV10700=on=>{CATALOG.forEach(p=>adminState.overrides[p.permission_key]=!!on);renderPermissionMatrix(true);};
  window.applyRoleTemplateV10817=()=>{const rk=S($('permissionRoleTemplateV10817')?.value);if(!rk)return;const roleSelect=$('userRole');if(roleSelect&&[...roleSelect.options].some(o=>o.value===rk))roleSelect.value=rk;adminState.overrides={};renderPermissionMatrix(true);toast('تم تطبيق قالب الدور وإزالة الاستثناءات القديمة. احفظ لتثبيت التغيير.');};
  window.copyUserPermissionsV10700=async id=>{if(!requirePermission('users.copy_permissions'))return;let b=null;try{b=await callRpc('get_user_permission_admin_v10817',{p_session_token:token(),p_target_user_id:Number(id)});}catch(_){const u=A(window.data?.users).find(x=>S(x.id)===S(id));b={overrides:safeJson(u?.permissions),scope_type:u?.scope_type,project_ids:A(u?.allowed_project_ids)};}localStorage.setItem('tasneef_permissions_clipboard_v10817',JSON.stringify({source_user_id:id,overrides:b?.overrides||{},scope_type:b?.scope_type,project_ids:A(b?.project_ids)}));toast('تم نسخ الصلاحيات. افتح المستخدم الهدف واضغط لصق الصلاحيات.');};
  window.pastePermissionsV10817=()=>{const p=safeJson(localStorage.getItem('tasneef_permissions_clipboard_v10817'));if(!p||!p.overrides)return toast('لا توجد صلاحيات منسوخة','err');adminState.overrides={...p.overrides};if($('userScopeType')&&p.scope_type)$('userScopeType').value=p.scope_type;const ids=A(p.project_ids).map(S);[...$('userProjectsScope')?.options||[]].forEach(o=>o.selected=ids.includes(S(o.value)));renderPermissionMatrix();toast('تم لصق الصلاحيات والنطاق. احفظ لتثبيت التغيير.');};
  function field(id,v){if($(id))$(id).value=v??'';}
  async function loadTargetBundle(id){
    adminState.loading=true;try{let b=null;try{b=await callRpc('get_user_permission_admin_v10817',{p_session_token:token(),p_target_user_id:Number(id)});if(Array.isArray(b))b=b[0];}catch(e){if(!isMissingRpc(e))throw e;const u=A(window.data?.users).find(x=>S(x.id)===S(id))||{};b={user:u,overrides:safeJson(u.permissions),effective:fallbackEffective(u).permissions,sources:fallbackEffective(u).sources,project_ids:A(u.allowed_project_ids),scope_type:u.scope_type};}
      adminState.bundle=b||{};adminState.targetId=Number(id);adminState.initialOverrides={...(b?.overrides||{})};adminState.overrides={...(b?.overrides||{})};return b;
    }finally{adminState.loading=false;}
  }
  window.openAdvancedUserForm=async function(id){
    if(!requirePermission(id?'users.edit':'users.create')||!requirePermission('users.manage_permissions'))return;
    const drawer=$('advancedUserDrawerV10700');drawer?.classList.remove('hidden');ensureAdminToolbar();adminState.targetId=id?Number(id):null;adminState.initialOverrides={};adminState.overrides={};if(!id){if(typeof window.clearUserForm==='function')window.clearUserForm();renderPermissionMatrix();return;}
    const b=await loadTargetBundle(id),u=b.user||A(window.data?.users).find(x=>S(x.id)===S(id))||{};field('userId',u.id);field('userFullName',u.full_name);field('userUsername',u.username);field('userEmail',u.email);field('userPhone',u.phone||u.supervisor_phone);field('userJobTitle',u.job_title);field('userDepartment',u.department_id);field('userRole',u.role_key||u.role||'custom');field('userManager',u.manager_id);field('userStatus',u.status||(u.is_active===false?'suspended':'active'));field('userValidFrom',u.valid_from);field('userValidUntil',u.valid_until);field('userNotes',u.notes);field('userScopeType',b.scope_type||u.scope_type||'all');if($('userFormTitle'))$('userFormTitle').textContent='تعديل المستخدم — '+S(u.full_name||u.username);const ids=A(b.project_ids||u.allowed_project_ids).map(S);[...$('userProjectsScope')?.options||[]].forEach(o=>o.selected=ids.includes(S(o.value)));renderPermissionMatrix();
  };
  window.editUser=id=>window.openAdvancedUserForm(id);
  window.previewEffectivePermissionsV10700=()=>window.inspectPermissionsV10817();
  async function reasonDialog(title,message){return new Promise(resolve=>{let m=$('permissionsModalV10817');if(!m){m=document.createElement('div');m.id='permissionsModalV10817';m.className='perm17-modal hidden';document.body.appendChild(m);}m.innerHTML=`<div class="perm17-dialog"><h3>${esc(title)}</h3><p>${esc(message)}</p><label>سبب التغيير<textarea id="permissionReasonV10817" required></textarea></label><div class="actions"><button id="permissionReasonConfirmV10817">تأكيد</button><button class="light" id="permissionReasonCancelV10817">إلغاء</button></div></div>`;m.classList.remove('hidden');$('permissionReasonCancelV10817').onclick=()=>{m.classList.add('hidden');resolve(null);};$('permissionReasonConfirmV10817').onclick=()=>{const v=S($('permissionReasonV10817').value);if(!v)return toast('سبب التغيير مطلوب','err');m.classList.add('hidden');resolve(v);};});}
  function changedOverrides(){const keys=new Set([...Object.keys(adminState.initialOverrides),...Object.keys(adminState.overrides)]);return [...keys].filter(k=>adminState.initialOverrides[k]!==adminState.overrides[k]).map(k=>({permission_key:k,granted:Object.prototype.hasOwnProperty.call(adminState.overrides,k)?adminState.overrides[k]:null}));}
  function completeOverrideSnapshotV10823(){return CATALOG.map(p=>({permission_key:p.permission_key,granted:Object.prototype.hasOwnProperty.call(adminState.overrides,p.permission_key)?adminState.overrides[p.permission_key]:null}));}
  window.saveUser=async function(){
    const id=S($('userId')?.value),isNew=!id;if(!requirePermission(isNew?'users.create':'users.edit')||!requirePermission('users.manage_permissions'))return;const username=S($('userUsername')?.value),fullName=S($('userFullName')?.value);if(!username||!fullName)return toast('الاسم الكامل واسم المستخدم مطلوبان','err');const selectedProjects=[...$('userProjectsScope')?.selectedOptions||[]].map(o=>Number(o.value)).filter(Number.isSafeInteger);const status=S($('userStatus')?.value||'active'),oldStatus=S(adminState.bundle?.user?.status||(adminState.bundle?.user?.is_active===false?'suspended':'active'));if(!isNew&&status!==oldStatus&&!requirePermission('users.disable'))return;const reason=await reasonDialog(isNew?'إضافة مستخدم وصلاحياته':'حفظ المستخدم والصلاحيات','اكتب سبب إنشاء المستخدم أو تعديل دوره وصلاحياته ونطاق مشاريعه.');if(!reason)return;const base={full_name:fullName,username,email:S($('userEmail')?.value)||null,phone:S($('userPhone')?.value)||null,job_title:S($('userJobTitle')?.value)||null,department_id:Number($('userDepartment')?.value)||null,role:legacyRouteRole(S($('userRole')?.value||'custom')),role_key:S($('userRole')?.value||'custom'),manager_id:Number($('userManager')?.value)||null,status,is_active:status==='active',valid_from:S($('userValidFrom')?.value)||null,valid_until:S($('userValidUntil')?.value)||null,notes:S($('userNotes')?.value)||null,scope_type:S($('userScopeType')?.value||'all'),allowed_project_ids:selectedProjects,force_password_change:!!$('userForcePasswordChange')?.checked,mfa_required:!!$('userMfaRequired')?.checked,login_attempt_limit:Number($('userLoginLimit')?.value)||5,session_timeout_minutes:Number($('userSessionTimeout')?.value)||480,updated_at:now()};if(S($('userPassword')?.value))base.password=S($('userPassword').value);else if(!id)base.password='123456';
    const btn=document.querySelector('.perm-save button');if(btn?.disabled)return;btn&&(btn.disabled=true);try{const c=client();let bundle=null,targetId=Number(id)||null;try{bundle=await callRpc('save_app_user_permissions_v10817',{p_session_token:token(),p_target_user_id:targetId,p_user_data:base,p_role_key:base.role_key,p_changes:completeOverrideSnapshotV10823(),p_scope_type:base.scope_type,p_project_ids:selectedProjects,p_reason:reason,p_source:'users_admin'});targetId=Number(bundle?.saved_user_id||bundle?.user?.id||targetId);}catch(e){if(!isMissingRpc(e))throw e;let saved;if(id){const r=await c.from('app_users').update(base).eq('id',Number(id)).select('*').maybeSingle();if(r.error)throw r.error;saved=r.data;}else{const r=await c.from('app_users').insert({...base,created_by:Number(currentUser().id)||null}).select('*').single();if(r.error)throw r.error;saved=r.data;}targetId=Number(saved?.id||id);try{bundle=await callRpc('save_user_permission_bundle_v10817',{p_session_token:token(),p_target_user_id:targetId,p_role_key:base.role_key,p_changes:completeOverrideSnapshotV10823(),p_scope_type:base.scope_type,p_project_ids:selectedProjects,p_reason:reason,p_source:'users_admin'});}catch(inner){if(!isMissingRpc(inner))throw inner;await c.from('app_users').update({permissions:adminState.overrides,allowed_project_ids:selectedProjects,scope_type:base.scope_type,permissions_version:Number(saved?.permissions_version||0)+1}).eq('id',targetId);}}
      if(bundle){adminState.bundle=bundle;adminState.initialOverrides={...(bundle.overrides||adminState.overrides)};adminState.overrides={...adminState.initialOverrides};}
      clearPermissionCache(targetId);broadcast?.postMessage({type:'permissions-updated',userId:targetId,version:Number(bundle?.permissions_version||0)});toast('تم حفظ الدور والصلاحيات وتطبيقها كوحدة واحدة');$('advancedUserDrawerV10700')?.classList.add('hidden');if(typeof window.refreshAll==='function')await window.refreshAll();if(typeof window.loadSecurityCenterV10700==='function')await window.loadSecurityCenterV10700(true);applyUI(true);
    }catch(e){console.error(BUILD,e);const raw=S(e.message||e);toast(/app_users_role_check|violates check constraint/i.test(raw)?'تعذر حفظ الدور بسبب قيد قديم في قاعدة البيانات. شغّل ملف إصلاح الأدوار V10822 ثم أعد المحاولة.':raw,'err');}finally{btn&&(btn.disabled=false);}
  };
  window.toggleUserStatusV10700=async function(id,currentStatus){if(!requirePermission('users.disable'))return;const next=currentStatus==='active'?'suspended':'active';const reason=await reasonDialog(next==='active'?'إعادة تفعيل المستخدم':'إيقاف المستخدم',`سيتم ${next==='active'?'إعادة تفعيل':'إيقاف'} الحساب وتحديث جلساته فورًا.`);if(!reason)return;try{await callRpc('set_user_status_v10817',{p_session_token:token(),p_target_user_id:Number(id),p_status:next,p_reason:reason});clearPermissionCache(id);broadcast?.postMessage({type:'permissions-updated',userId:Number(id)});toast(next==='active'?'تمت إعادة تفعيل المستخدم':'تم إيقاف المستخدم وإنهاء صلاحية جلساته');if(typeof window.refreshAll==='function')await window.refreshAll();if(typeof window.loadSecurityCenterV10700==='function')await window.loadSecurityCenterV10700(true);}catch(e){toast(S(e.message||e),'err');}};
  window.endUserSessionsV10700=async function(id){if(!requirePermission('users.end_sessions'))return;const reason=await reasonDialog('إنهاء جلسات المستخدم','سيتم إنهاء جميع جلسات هذا المستخدم على الأجهزة المختلفة.');if(!reason)return;try{const out=await callRpc('end_user_sessions_v10817',{p_session_token:token(),p_target_user_id:Number(id),p_reason:reason});broadcast?.postMessage({type:'permissions-updated',userId:Number(id)});toast(`تم إنهاء ${Number(out?.ended_sessions||0)} جلسة`);if(typeof window.loadSecurityCenterV10700==='function')await window.loadSecurityCenterV10700(true);}catch(e){toast(S(e.message||e),'err');}};
  async function bulkPermission(action){if(!isSuper())return toast('هذا الإجراء للمدير العام فقط','err');const id=Number($('userId')?.value);if(!id)return toast('احفظ المستخدم أولًا','err');const reason=await reasonDialog(action==='grant'?'تفعيل جميع الصلاحيات':'إلغاء جميع الصلاحيات',`سيتم ${action==='grant'?'منح':'منع'} ${CATALOG.length} صلاحية للمستخدم.`);if(!reason)return;const rpc=action==='grant'?'grant_all_permissions_v10817':'revoke_all_permissions_v10817';try{await callRpc(rpc,{p_session_token:token(),p_target_user_id:id,p_reason:reason});await loadTargetBundle(id);renderPermissionMatrix();clearPermissionCache(id);broadcast?.postMessage({type:'permissions-updated',userId:id});toast('تم تحديث جميع الصلاحيات');}catch(e){toast(S(e.message||e),'err');}}
  window.grantAllPermissionsV10817=()=>bulkPermission('grant');window.revokeAllPermissionsV10817=()=>bulkPermission('revoke');
  window.inspectPermissionsV10817=async function(){const id=Number($('userId')?.value||currentUser().id);let rows=[];try{rows=await callRpc('inspect_user_permissions_v10817',{p_session_token:token(),p_target_user_id:id});}catch(e){rows=CATALOG.map(p=>{const ov=adminState.overrides[p.permission_key];const ef=effectiveForTarget(p.permission_key,ov);return {module_name:p.module_name,permission_key:p.permission_key,permission_name:p.action_name,effective:ef.value,source:sourceLabel(ef.source),ui_status:canPermission(p.permission_key)?'مسموح':'ممنوع',server_status:'يتطلب SQL',rls_status:'يتطلب SQL'};});}
    let m=$('permissionsModalV10817');if(!m){m=document.createElement('div');m.id='permissionsModalV10817';m.className='perm17-modal hidden';document.body.appendChild(m);}m.innerHTML=`<div class="perm17-dialog"><h3>فحص الصلاحيات</h3><div class="table-wrap"><table><thead><tr><th>القسم</th><th>الصلاحية</th><th>النتيجة</th><th>المصدر</th><th>الواجهة</th><th>السيرفر</th><th>RLS</th></tr></thead><tbody>${A(rows).map(r=>`<tr><td>${esc(r.module_name||r.module)}</td><td><b>${esc(r.permission_name||r.action_name)}</b><small class="perm17-key">${esc(r.permission_key)}</small></td><td>${r.effective?'مفعلة':'موقوفة'}</td><td>${esc(r.source)}</td><td>${esc(r.ui_status||'-')}</td><td>${esc(r.server_status||'-')}</td><td>${esc(r.rls_status||'-')}</td></tr>`).join('')}</tbody></table></div><div class="actions"><button onclick="document.getElementById('permissionsModalV10817').classList.add('hidden')">إغلاق</button></div></div>`;m.classList.remove('hidden');};

  window.__tasneefLegacyPermissionsDisabledV10817=true;
  const permissionRefreshBase=window.refreshAll;if(typeof permissionRefreshBase==='function'&&!permissionRefreshBase.__permissionsV10817){const w=async function(){const out=await permissionRefreshBase.apply(this,arguments);await load(false);applyUI();return out;};w.__permissionsV10817=true;window.refreshAll=w;}
  const oldLoadSecurity=window.loadSecurityCenterV10700;
  window.loadSecurityCenterV10700=async function(force){if(typeof oldLoadSecurity==='function')try{await oldLoadSecurity(force);}catch(e){console.warn(BUILD,e);}ensureAdminToolbar();renderPermissionMatrix();return load(!!force);};
  const oldRenderUsers=window.renderUsers;
  window.renderUsers=function(){if(typeof oldRenderUsers==='function')oldRenderUsers();document.querySelectorAll('#usersBody tr').forEach(tr=>{const edit=tr.querySelector('button[onclick^="openAdvancedUserForm"]');if(edit&&(!canPermission('users.edit')||!canPermission('users.manage_permissions')))edit.style.display='none';});};

  function boot(){
    attachTokenFromSession();ensureRoleOptions();hookLoginLogout();
    const authenticated=!!S(currentUser()?.id||currentUser()?.user_id);
    const ready=authenticated?load(false):Promise.resolve(state);
    ready.catch(e=>console.warn(BUILD,'permission boot fallback',e)).finally(()=>{
      if(authenticated&&!state.loaded){const fb=fallbackEffective(currentUser());state.userId=S(currentUser().id||currentUser().user_id);state.effective=fb.permissions;state.sources=fb.sources;state.scopeType=fb.scope_type;state.projectIds=A(fb.project_ids).map(S);state.loaded=true;}
      wrapRoutes();installGuards();applyUI();ensureAdminToolbar();renderPermissionMatrix();
    });
    [750,1500,3000,7000].forEach(ms=>setTimeout(()=>{hookLoginLogout();if(!authenticated||state.loaded){wrapRoutes();installGuards();applyUI();}},ms));
    const mo=new MutationObserver(()=>{if(state.applying)return;clearTimeout(mo._t);mo._t=setTimeout(()=>{if(!authenticated||state.loaded)applyUI(false);},220);});if(document.body)mo.observe(document.body,{childList:true,subtree:true});
    setInterval(()=>{hookLoginLogout();if(!authenticated||state.loaded){wrapRoutes();installGuards();}checkVersion(false);},45000);
    window.addEventListener('focus',()=>checkVersion(false));window.addEventListener('storage',e=>{if(e.key==='tasneef_user'||e.key?.startsWith('tasneef:user-permissions:'))load(true);});console.log('Tasneef '+BUILD+' loaded; '+CATALOG.length+' permission keys');
  }
  setSessionHeader();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

/* V10823: atomic permissions editor, stable UI and legacy permission engines disabled. */

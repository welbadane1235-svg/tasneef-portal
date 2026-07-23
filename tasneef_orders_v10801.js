/* TASNEEF ORDERS V10801 — clean server-first rebuild
   Single data source: window.OrdersService
   Requires: supabase_orders_rebuild_v10800.sql + supabase_orders_receipts_finance_v10801.sql
*/
(function(){
  'use strict';
  if(window.__tasneefOrdersV10801Loaded) return;
  window.__tasneefOrdersV10801Loaded=true;
  window.__tasneefOrdersUnifiedOnlyV10801=true;

  const BUILD='V10826-ORDER-PROJECT-OPTIONS-SCOPE';
  const PAGE_SIZE=50;
  const BUCKET='order-receipts';
  const ALLOWED_MIME=new Set(['application/pdf','image/jpeg','image/png']);
  const MAX_FILE_SIZE=5*1024*1024;
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const E=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const N=v=>{const n=Number(String(v??'').replace(/,/g,'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0;};
  const money=v=>N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';
  const dateToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const currentUser=()=>{try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};}};
  const actor=()=>{const u=currentUser();return {id:S(u.id||u.user_id||u.uuid||'anonymous'),name:S(u.full_name||u.name||u.username||'مستخدم النظام'),role:S(u.role_key||u.role||'user')};};
  const adminRoles=new Set(['admin','system_admin','general_manager','operations_manager','financial_manager','finance_manager','orders_officer']);
  const isSupervisor=()=>actor().role==='supervisor'||!!$('supOrders');
  const isAdmin=()=>adminRoles.has(actor().role)||!!$('orders');
  const notify=(text,type='ok')=>{if(typeof window.msg==='function')window.msg(text,type);else alert(text);};
  const uuid=()=>crypto?.randomUUID?crypto.randomUUID():(Date.now()+'-'+Math.random().toString(16).slice(2));
  const sb=()=>{if(!window.sb)throw new Error('اتصال Supabase غير جاهز');return window.sb;};
  const permissionSessionToken=()=>S(
    currentUser().permission_session_token||
    currentUser().session_token||
    localStorage.getItem('tasneef_session_token_v10817')||
    localStorage.getItem('tasneef_permission_session_v10817')
  );
  const effectiveRole=()=>S(currentUser().role_key||currentUser().role||'user').toLowerCase();
  function normalizeProjectRows(rows){
    const seen=new Set(),out=[];
    (Array.isArray(rows)?rows:[]).forEach(p=>{
      const id=S(p?.id??p?.project_id),name=S(p?.name||p?.project_name||p?.official_name||p?.display_name);
      if(!id||!name||seen.has(id))return;
      const active=p?.is_active!==false&&!['stopped','inactive','archived'].includes(S(p?.status).toLowerCase());
      if(!active)return;
      seen.add(id);out.push({id,name,code:S(p?.project_code||p?.code)});
    });
    return out.sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  }
  const friendlyError=e=>{
    let raw=S(e?.message||e?.details||e);
    if(raw.startsWith('{')){try{const j=JSON.parse(raw);raw=S(j.message||j.error||j.details||raw);}catch(_){}}
    if(/orders_.*v10800|function.*does not exist|PGRST202|404/i.test(raw)) return 'شغّل ملف V10800 الأساسي ثم ملف supabase_orders_receipts_finance_v10801.sql.';
    if(/statement timeout|57014/i.test(raw)) return 'انتهت مهلة الاستعلام. راجع فهارس V10800 وتحديث V10801 في قاعدة البيانات.';
    if(/SUPERVISOR_FIELDS_RESTRICTED/i.test(raw)) return 'المشرف يستطيع تعديل حالة التنفيذ والسداد والملاحظات فقط.';
    if(/ORDER_NOT_FOUND/i.test(raw)) return 'الأوردر غير موجود أو تم نقله.';
    if(/duplicate|unique|request_id/i.test(raw)) return 'تم منع إنشاء سجل مكرر. حدّث القائمة للتحقق من الأوردر.';
    return raw||'حدث خطأ غير معروف';
  };

  function allowedProjectNames(){
    if(!isSupervisor()) return null;
    if(Array.isArray(state.allowedProjects)) return state.allowedProjects;
    return [];
  }
  async function loadOrderProjectOptions(force=false){
    if(state.projectOptionsLoading&&!force)return state.projectOptionsLoading;
    if(state.projectOptionsLoaded&&!force)return state.projectOptions;
    state.projectOptionsLoading=(async()=>{
      let rows=[];
      try{
        if(window.PermissionsService?.load)await window.PermissionsService.load(false);
        const token=permissionSessionToken();
        if(token){
          const {data,error}=await sb().rpc('orders_project_options_v10826',{p_session_token:token});
          if(error)throw error;
          rows=normalizeProjectRows(data);
        }
      }catch(e){console.warn(BUILD,'orders_project_options_v10826 fallback:',e?.message||e);}
      if(!rows.length){
        try{
          const u=currentUser();
          if(window.ProjectsService?.getAccessibleProjects){
            rows=normalizeProjectRows(await window.ProjectsService.getAccessibleProjects(u.id,effectiveRole(),{period:'current'}));
          }
        }catch(e){console.warn(BUILD,'ProjectsService fallback:',e?.message||e);}
      }
      if(!rows.length)rows=normalizeProjectRows(window.data?.projects||[]);
      state.projectOptions=rows;
      state.projectOptionsLoaded=true;
      return rows;
    })().finally(()=>{state.projectOptionsLoading=null;});
    return state.projectOptionsLoading;
  }
  async function resolveAllowedProjects(force=false){
    const rows=await loadOrderProjectOptions(force);
    state.allowedProjects=isSupervisor()?rows.map(p=>p.name):null;
  }
  function rpcArgs(filters={}){
    return {
      p_search:filters.search||null,p_project:filters.project||null,p_executor:filters.executor||null,p_sender:filters.sender||null,
      p_order_type:filters.orderType||null,p_customer_type:filters.customerType||null,p_execution_status:filters.executionStatus||null,
      p_payment_status:filters.paymentStatus||null,p_invoice_status:filters.invoiceStatus||null,p_archive_status:filters.archiveStatus||'active',
      p_date_from:filters.dateFrom||null,p_date_to:filters.dateTo||null,p_allowed_projects:allowedProjectNames()
    };
  }

  const orderMetrics={requests:0,lastPageMs:0,lastSummaryMs:0,lastDetailsMs:0,lastSaveMs:0,lastExportCount:0};
  async function timed(metric,fn){const t=performance.now();orderMetrics.requests++;try{return await fn();}finally{orderMetrics[metric]=Math.round(performance.now()-t);}}

  const OrdersService={
    version:BUILD,metrics:orderMetrics,
    async getOrdersPage(params={}){
      return timed('lastPageMs',async()=>{const page=Math.max(1,Number(params.page)||1),pageSize=Math.min(500,Math.max(1,Number(params.pageSize)||PAGE_SIZE));let q=sb().rpc('orders_get_page_v10800',{p_page:page,p_page_size:pageSize,...rpcArgs(params.filters||{})});if(params.signal&&typeof q.abortSignal==='function')q=q.abortSignal(params.signal);const {data,error}=await q;if(error)throw error;return data||{rows:[],total:0,page,page_size:pageSize,total_pages:1};});
    },
    async getOrdersSummary(filters={},signal){return timed('lastSummaryMs',async()=>{let q=sb().rpc('orders_get_summary_v10800',rpcArgs(filters));if(signal&&typeof q.abortSignal==='function')q=q.abortSignal(signal);const {data,error}=await q;if(error)throw error;return data||{};});},
    async getOrderDetails(orderId){return timed('lastDetailsMs',async()=>{const {data,error}=await sb().rpc('orders_get_details_v10800',{p_order_id:orderId});if(error)throw error;return data;});},
    async createOrder(payload,requestId){return timed('lastSaveMs',async()=>{const a=actor();const {data,error}=await sb().rpc('orders_create_v10800',{p_payload:payload,p_actor_id:a.id,p_actor_name:a.name,p_request_id:requestId});if(error)throw error;return data;});},
    async updateOrder(orderId,payload,reason){return timed('lastSaveMs',async()=>{const a=actor();const {data,error}=await sb().rpc('orders_update_v10800',{p_order_id:orderId,p_payload:payload,p_actor_id:a.id,p_actor_name:a.name,p_reason:reason||null});if(error)throw error;return data;});},
    async archiveOrder(orderId,reason){const a=actor();const {data,error}=await sb().rpc('orders_archive_v10800',{p_order_id:orderId,p_actor_id:a.id,p_actor_name:a.name,p_reason:reason||null});if(error)throw error;return data;},
    async restoreOrder(orderId,reason){const a=actor();const {data,error}=await sb().rpc('orders_restore_v10800',{p_order_id:orderId,p_actor_id:a.id,p_actor_name:a.name,p_reason:reason||null});if(error)throw error;return data;},
    validateReceipt(file){if(!file)return;if(!ALLOWED_MIME.has(file.type))throw new Error('نوع الملف غير مسموح. استخدم PDF أو JPG أو PNG فقط.');if(file.size>MAX_FILE_SIZE)throw new Error('حجم الملف أكبر من 5MB.');},
    async uploadOrderReceipt(orderId,file){
      this.validateReceipt(file);const a=actor();const safe=S(file.name).replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-120)||'receipt';
      const path=`orders/${orderId}/receipts/${Date.now()}-${uuid()}-${safe}`;
      const up=await sb().storage.from(BUCKET).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
      if(up.error)throw up.error;
      const {data,error}=await sb().rpc('orders_add_attachment_v10800',{p_order_id:orderId,p_bucket:BUCKET,p_path:path,p_file_name:file.name,p_mime_type:file.type,p_file_size:file.size,p_actor_id:a.id,p_actor_name:a.name});
      if(error)throw error;return data;
    },
    async getOrderReceipt(orderId){const d=await this.getOrderDetails(orderId);return d?.attachments||[];},
    async deleteOrderReceipt(attachmentId,reason){const a=actor();const {data,error}=await sb().rpc('orders_delete_attachment_v10800',{p_attachment_id:attachmentId,p_actor_id:a.id,p_actor_name:a.name,p_reason:reason||null});if(error)throw error;return data;},
    async openAttachment(att){
      if(att.storage_path){const {data,error}=await sb().storage.from(att.storage_bucket||BUCKET).download(att.storage_path);if(error)throw error;const url=URL.createObjectURL(data);window.open(url,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(url),60000);return;}
      if(att.external_url){window.open(att.external_url,'_blank','noopener');return;}
      const p=att.legacy_payload||{};const candidates=[p?.receipt?.data_url,p?.receipt?.url,p?.receipt?.data,p?.receipt_url,p?.attachment,p?.receipt?.receipt_url];
      const hit=candidates.find(x=>typeof x==='string'&&(x.startsWith('data:')||x.startsWith('http')));
      if(hit){window.open(hit,'_blank','noopener');return;}
      throw new Error('الإيصال القديم محفوظ مرجعيًا لكن رابط العرض غير متاح. لم يتم حذف بياناته الأصلية.');
    },
    async getFilterOptions(){const {data,error}=await sb().rpc('orders_filter_options_v10800',{p_allowed_projects:allowedProjectNames()});if(error)throw error;return data||{};},
    async exportOrders(filters={}){let page=1,out=[];for(;;){const r=await this.getOrdersPage({page,pageSize:500,filters});out.push(...(r.rows||[]));if(page>=Number(r.total_pages||1)||!(r.rows||[]).length)break;page++;if(page>2000)throw new Error('تم إيقاف التصدير لحماية المتصفح.');}orderMetrics.lastExportCount=out.length;return out;},
    async migrationReport(){const {data,error}=await sb().rpc('orders_migration_report_v10800');if(error)throw error;return data;}
  };
  window.OrdersService=OrdersService;

  const state={rows:[],page:1,total:0,totalPages:1,filters:{archiveStatus:'active'},selected:new Set(),editingId:null,requestId:null,saving:false,loadToken:0,summaryToken:0,filtersLoaded:false,allowedProjects:undefined,projectOptions:[],projectOptionsLoaded:false,projectOptionsLoading:null,loadController:null,summaryController:null,pendingUploadOrderId:null};

  function injectStyle(){
    if($('ordersV10801Style'))return;const st=document.createElement('style');st.id='ordersV10801Style';st.textContent=`
    .ov8-head{display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap}.ov8-actions{display:flex;gap:8px;flex-wrap:wrap}.ov8-kpis{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:10px;margin:12px 0}.ov8-kpi{background:#fff;border:1px solid var(--line,#dfe7e3);border-radius:16px;padding:14px}.ov8-kpi small{display:block;color:#6b7772}.ov8-kpi b{display:block;font-size:25px;color:var(--brand,#0A4033);margin-top:5px}.ov8-layout{display:grid;grid-template-columns:minmax(320px,420px) 1fr;gap:14px;align-items:start}.ov8-form{position:sticky;top:10px}.ov8-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.ov8-grid .wide{grid-column:1/-1}.ov8-status{padding:10px;border-radius:12px;background:#f4f8f6;color:#45635a;margin:10px 0}.ov8-status.err{background:#fff0f0;color:#9b2c2c}.ov8-filters{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:8px;margin-bottom:12px}.ov8-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:11px}.ov8-card{background:#fff;border:1px solid var(--line,#dfe7e3);border-right:6px solid #9aa7a2;border-radius:17px;padding:13px;display:grid;gap:9px;box-shadow:0 7px 20px rgba(10,64,51,.05);transition:.18s ease}.ov8-card:hover{transform:translateY(-1px);box-shadow:0 10px 25px rgba(10,64,51,.09)}.ov8-card.status-complete{border-right-color:#16865a;background:linear-gradient(135deg,#fff 0%,#f2fbf6 100%)}.ov8-card.status-complete-unpaid{border-right-color:#d28a00;background:linear-gradient(135deg,#fff 0%,#fff9e9 100%)}.ov8-card.status-progress{border-right-color:#e3aa24;background:linear-gradient(135deg,#fff 0%,#fffaf0 100%)}.ov8-card.status-pending{border-right-color:#c94848;background:linear-gradient(135deg,#fff 0%,#fff5f5 100%)}.ov8-card.status-cancelled{border-right-color:#7b8581;background:linear-gradient(135deg,#fff 0%,#f3f5f4 100%)}.ov8-card.archived{opacity:.72;border-style:dashed}.ov8-card-head{display:flex;justify-content:space-between;gap:9px}.ov8-card h3{margin:0;color:var(--brand,#0A4033)}.ov8-card small{color:#6b7772}.ov8-chips{display:flex;gap:5px;flex-wrap:wrap}.ov8-chip{padding:4px 8px;border-radius:999px;background:#eef6f3;color:#0A4033;font-size:11px;font-weight:800}.ov8-chip.warn{background:#fff3d6;color:#795800}.ov8-chip.bad{background:#fde7e7;color:#982a2a}.ov8-meta{display:grid;grid-template-columns:1fr 1fr;gap:6px}.ov8-meta div{background:#f8fbfa;border-radius:10px;padding:7px;min-width:0}.ov8-meta b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ov8-finance-row{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.ov8-finance-row>div{background:#eef6f3;border:1px solid #d9e8e2;border-radius:11px;padding:8px;text-align:center}.ov8-finance-row small{display:block;color:#65736d}.ov8-finance-row b{display:block;color:#0A4033;font-size:14px;margin-top:3px}.ov8-receipt-btn{background:#0A4B3C!important;color:#fff!important;border-color:#0A4B3C!important;font-weight:900}.ov8-whatsapp-btn{background:#25D366!important;color:#fff!important;border-color:#20bd5a!important;font-weight:900}.ov8-whatsapp-btn:hover{filter:brightness(.94)}.ov8-receipt-btn[disabled]{opacity:.48!important;cursor:not-allowed!important}.ov8-receipt-preview{position:fixed;inset:0;background:rgba(0,0,0,.68);z-index:1000000;display:flex;align-items:center;justify-content:center;padding:16px}.ov8-receipt-preview-card{background:#fff;width:min(1120px,97vw);height:min(90vh,900px);border-radius:18px;display:flex;flex-direction:column;overflow:hidden}.ov8-receipt-preview-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #e3eae6}.ov8-receipt-preview-body{flex:1;min-height:0;background:#f3f6f5;display:flex;align-items:center;justify-content:center}.ov8-receipt-preview-body iframe,.ov8-receipt-preview-body img{width:100%;height:100%;border:0;object-fit:contain;background:#fff}.ov8-receipt-loading{padding:24px;text-align:center;color:#45635a}.ov8-details{background:#fbfdfc;border:1px dashed #dce8e3;border-radius:11px;padding:8px;line-height:1.65;min-height:55px}.ov8-card-actions{display:flex;gap:6px;flex-wrap:wrap}.ov8-card-actions button{font-size:12px;padding:7px 9px}.ov8-pager{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px;padding:10px;background:#f8fbfa;border:1px solid var(--line,#dfe7e3);border-radius:13px}.ov8-modal{position:fixed;inset:0;background:rgba(0,0,0,.48);z-index:999999;display:flex;align-items:center;justify-content:center;padding:18px}.ov8-modal-card{background:#fff;width:min(1040px,96vw);max-height:92vh;overflow:auto;border-radius:20px;padding:18px}.ov8-modal-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.ov8-detail-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.ov8-detail-grid div{background:#f8fbfa;padding:9px;border-radius:10px}.ov8-attachments,.ov8-audit{display:grid;gap:7px}.ov8-attachment,.ov8-audit article{border:1px solid #e3eae6;border-radius:11px;padding:9px}.ov8-check{display:flex;align-items:center;gap:6px}.ov8-required{color:#a32222}.ov8-inline-note{font-size:12px;color:#65736d;line-height:1.5}.ov8-finance-lock{display:none}.ov8-supervisor .ov8-finance-lock{display:block}.ov8-supervisor [data-finance]{display:none!important}.ov8-supervisor-edit [data-supervisor-lock]{pointer-events:none;opacity:.65}.ov8-empty{grid-column:1/-1;text-align:center;padding:25px;border:1px dashed #ccdcd4;border-radius:14px;color:#65736d}
    @media(max-width:1100px){.ov8-layout{grid-template-columns:1fr}.ov8-form{position:static}.ov8-filters{grid-template-columns:repeat(2,1fr)}}@media(max-width:680px){.ov8-kpis,.ov8-grid,.ov8-filters,.ov8-detail-grid,.ov8-finance-row{grid-template-columns:1fr}.ov8-pager{flex-direction:column;align-items:stretch}}
    `;document.head.appendChild(st);
  }

  function adminMarkup(){return `
    <div class="card"><div class="ov8-head"><div><h2>قسم الأوردرات</h2><p>مصدر واحد مباشر من السيرفر — ${BUILD}</p></div><div class="ov8-actions"><button onclick="OrdersUI.newOrder()">+ أوردر جديد</button><button class="light" onclick="OrdersUI.refresh()">تحديث</button><button class="light" onclick="OrdersUI.exportExcel()">تصدير Excel</button><button class="light" onclick="OrdersUI.quote()">عروض الأسعار</button><button class="light" onclick="OrdersUI.print()">طباعة</button></div></div></div>
    <div class="ov8-kpis"><div class="ov8-kpi"><small>إجمالي الأوردرات</small><b id="ov8KpiTotal">—</b></div><div class="ov8-kpi"><small>تم التنفيذ</small><b id="ov8KpiDone">—</b></div><div class="ov8-kpi"><small>آجل / غير مسدد</small><b id="ov8KpiDue">—</b></div><div class="ov8-kpi"><small>صافي الربح</small><b id="ov8KpiProfit">—</b></div></div>
    <div class="ov8-finance-row" style="margin:0 0 12px"><div><small>إجمالي السعر قبل الضريبة</small><b id="ov8KpiSubtotal">—</b></div><div><small>إجمالي الضريبة</small><b id="ov8KpiTax">—</b></div><div><small>إجمالي السعر شامل الضريبة</small><b id="ov8KpiTotalAmount">—</b></div></div>
    <div class="ov8-layout"><div class="card ov8-form" id="ov8FormCard"><h2 id="ov8FormTitle">إضافة أوردر</h2><input type="hidden" id="ov8EditId"><div class="ov8-grid">
      <div><label>رقم الأوردر</label><input id="ov8Number" readonly placeholder="تلقائي وآمن"></div><div><label>تاريخ الطلب</label><input id="ov8OrderDate" type="date"></div>
      <div><label>نوع الطلب <span class="ov8-required">*</span></label><select id="ov8OrderType"><option value="داخلي">داخلي</option><option value="جمعية">جمعية</option><option value="خارجي">خارجي</option></select></div><div><label>نوع العميل</label><select id="ov8CustomerType"><option value="جمعية">جمعية</option><option value="فرد">فرد</option><option value="شركة">شركة</option><option value="داخلي">داخلي</option></select></div>
      <div class="wide" data-supervisor-lock><label>المشروع / الموقع <span class="ov8-required">*</span></label><select id="ov8Project"></select></div>
      <div data-supervisor-lock><label>اسم العميل / المسؤول <span class="ov8-required">*</span></label><input id="ov8Customer"></div><div data-supervisor-lock><label>رقم العميل <span class="ov8-required">*</span></label><input id="ov8Phone"></div>
      <div data-supervisor-lock><label>رقم الوحدة / الموقع <span class="ov8-required">*</span></label><input id="ov8Unit"></div><div data-supervisor-lock><label>المنفذ</label><input id="ov8Executor" list="ov8ExecutorsList"><datalist id="ov8ExecutorsList"></datalist></div>
      <div><label>حالة التنفيذ</label><select id="ov8Execution"><option>لم ينفذ</option><option>قيد التنفيذ</option><option>تم التنفيذ</option><option>تم جزئيًا</option><option>ملغي</option></select></div><div><label>حالة السداد</label><select id="ov8Payment"><option>غير مسدد</option><option>مسدد جزئيًا</option><option>تم السداد</option><option>آجل</option></select></div>
      <div data-finance data-supervisor-lock><label>حالة الفوترة</label><select id="ov8InvoiceStatus"><option>لم تتم</option><option>تمت</option><option>لا يحتاج فاتورة</option></select></div><div data-finance data-supervisor-lock><label>رقم الفاتورة</label><input id="ov8InvoiceNo"></div>
      <div data-finance data-supervisor-lock><label>تاريخ الفاتورة</label><input id="ov8InvoiceDate" type="date"></div><div data-finance data-supervisor-lock><label>نسبة الضريبة %</label><input id="ov8TaxRate" type="number" step="0.01" value="15"></div>
      <div data-finance data-supervisor-lock><label>السعر شامل الضريبة</label><input id="ov8Total" type="number" step="0.01" min="0" placeholder="اكتب المبلغ النهائي شامل الضريبة"></div><div data-finance data-supervisor-lock><label>السعر قبل الضريبة (تلقائي)</label><input id="ov8Subtotal" type="number" step="0.01" readonly></div>
      <div data-finance data-supervisor-lock><label>قيمة الضريبة (تلقائي)</label><input id="ov8Tax" type="number" step="0.01" readonly></div><div data-finance data-supervisor-lock><label>التكلفة</label><input id="ov8Cost" type="number" step="0.01"></div>
      <div class="wide" data-finance data-supervisor-lock><label>صافي الربح</label><input id="ov8Profit" type="number" step="0.01" readonly></div>
      <div class="wide"><label>تفاصيل الطلب <span class="ov8-required">*</span></label><textarea id="ov8Details"></textarea></div><div class="wide"><label>الملاحظات</label><textarea id="ov8Notes"></textarea></div>
      <div class="wide"><label>سبب التعديل <span id="ov8ReasonRequired" class="ov8-inline-note">يطلب عند تعديل سجل قائم</span></label><input id="ov8Reason"></div>
      <div class="wide" data-supervisor-lock><label>الإيصالات / المرفقات</label><input id="ov8Files" type="file" multiple accept="application/pdf,image/jpeg,image/png"><small class="ov8-inline-note">PDF أو JPG أو PNG — بحد أقصى 5MB لكل ملف. فشل الرفع لا يلغي حفظ الأوردر.</small></div>
    </div><div class="ov8-status" id="ov8SaveStatus">جاهز للحفظ.</div><div class="actions"><button id="ov8SaveBtn" onclick="OrdersUI.save()">حفظ الأوردر</button><button class="light" onclick="OrdersUI.newOrder()">تفريغ</button><button class="danger" id="ov8ArchiveCurrent" onclick="OrdersUI.archiveCurrent()">أرشفة المحدد</button></div></div>
    <div class="card"><div class="ov8-head"><h2>سجل الأوردرات</h2><span id="ov8LoadStatus" class="ov8-status">جاري تحميل الأوردرات…</span></div>
      <div class="ov8-filters"><input id="ov8Search" placeholder="بحث في الرقم، العميل، الجوال، المشروع، المنفذ، الفاتورة"><select id="ov8FilterProject"><option value="">كل المشاريع</option></select><select id="ov8FilterExecutor"><option value="">كل المنفذين</option></select><select id="ov8FilterSender"><option value="">كل مرسلي الطلب</option></select><select id="ov8FilterType"><option value="">كل أنواع الطلب</option><option>داخلي</option><option>جمعية</option><option>خارجي</option></select><select id="ov8FilterCustomerType"><option value="">كل أنواع العملاء</option><option>جمعية</option><option>فرد</option><option>شركة</option><option>داخلي</option></select><select id="ov8FilterExecution"><option value="">كل حالات التنفيذ</option><option>لم ينفذ</option><option>قيد التنفيذ</option><option>تم التنفيذ</option><option>تم جزئيًا</option><option>ملغي</option></select><select id="ov8FilterPayment"><option value="">كل حالات السداد</option><option>غير مسدد</option><option>مسدد جزئيًا</option><option>تم السداد</option><option>آجل</option></select><select id="ov8FilterInvoice"><option value="">كل حالات الفوترة</option><option>لم تتم</option><option>تمت</option><option>لا يحتاج فاتورة</option></select><select id="ov8FilterArchive"><option value="active">النشط</option><option value="archived">المؤرشف</option><option value="all">الكل</option></select><input id="ov8DateFrom" type="date" title="من تاريخ"><input id="ov8DateTo" type="date" title="إلى تاريخ"><button class="light" onclick="OrdersUI.resetFilters()">إعادة تعيين</button></div>
      <div class="ov8-cards" id="ov8Cards"></div><div class="ov8-pager" id="ov8Pager"></div>
    </div></div>`;}

  function supervisorMarkup(){return `<section class="card ov8-supervisor"><h2 id="ov8FormTitle">رفع أوردر</h2><div id="ov8FormMount"></div></section><section class="card"><div class="ov8-head"><h2>أوردرات مشاريعي</h2><button class="light" onclick="OrdersUI.refresh()">تحديث</button></div><div class="ov8-filters"><input id="ov8Search" placeholder="بحث"><select id="ov8FilterProject"><option value="">كل المشاريع</option></select><select id="ov8FilterExecution"><option value="">كل الحالات</option><option>لم ينفذ</option><option>قيد التنفيذ</option><option>تم التنفيذ</option><option>تم جزئيًا</option><option>ملغي</option></select><select id="ov8FilterPayment"><option value="">كل السداد</option><option>غير مسدد</option><option>مسدد جزئيًا</option><option>تم السداد</option><option>آجل</option></select></div><div id="ov8LoadStatus" class="ov8-status">جاري تحميل الأوردرات…</div><div class="ov8-cards" id="ov8Cards"></div><div class="ov8-pager" id="ov8Pager"></div></section>`;}

  function mount(){
    injectStyle();
    const admin=$('orders'),sup=$('supOrders');
    if(admin){admin.innerHTML=adminMarkup();}
    else if(sup){sup.innerHTML=supervisorMarkup();const form=document.createElement('div');form.innerHTML=adminMarkup();const source=form.querySelector('#ov8FormCard');$('ov8FormMount').replaceWith(source);source.classList.add('ov8-supervisor');source.classList.remove('card');source.querySelector('#ov8ArchiveCurrent')?.remove();}
    else return false;
    if(isSupervisor())$('ov8FormCard')?.classList.add('ov8-supervisor');
    return true;
  }

  function projects(){return state.projectOptions.length?state.projectOptions:normalizeProjectRows(window.data?.projects||[]);}
  function executors(){
    const src=[...(window.data?.users||[]),...(window.data?.supervisors||[]),...(window.data?.workers||[])];
    return [...new Set(src.filter(x=>x&&x.is_active!==false).map(x=>S(x.full_name||x.name||x.worker_name||x.username)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  }
  function fillSelect(id,items,first,asObjects=false){const el=$(id);if(!el)return;const old=el.value;el.innerHTML=`<option value="">${E(first)}</option>`+items.map(x=>asObjects?`<option value="${E(x.id)}" data-name="${E(x.name)}">${E(x.name)}</option>`:`<option value="${E(x)}">${E(x)}</option>`).join('');if([...el.options].some(o=>o.value===old))el.value=old;}
  function ensureProjectOption(projectId,projectName){const el=$('ov8Project'),id=S(projectId),name=S(projectName);if(!el||!id)return;let option=[...el.options].find(o=>S(o.value)===id);if(!option){option=document.createElement('option');option.value=id;option.dataset.name=name||('مشروع '+id);option.textContent=name||('مشروع '+id);el.appendChild(option);}else if(name){option.dataset.name=name;option.textContent=name;}el.value=id;}
  function hydrateReferences(){fillSelect('ov8Project',projects(),'اختر المشروع',true);const dl=$('ov8ExecutorsList');if(dl)dl.innerHTML=executors().map(x=>`<option value="${E(x)}"></option>`).join('');if($('ov8Project')&&$('ov8Project').options.length<=1)setSaveStatus('لا توجد مشاريع متاحة لهذا الحساب. راجع نطاق المشاريع أو صلاحية الأوردرات.',true);}

  function collectFilters(){return {search:S($('ov8Search')?.value),project:S($('ov8FilterProject')?.value),executor:S($('ov8FilterExecutor')?.value),sender:S($('ov8FilterSender')?.value),orderType:S($('ov8FilterType')?.value),customerType:S($('ov8FilterCustomerType')?.value),executionStatus:S($('ov8FilterExecution')?.value),paymentStatus:S($('ov8FilterPayment')?.value),invoiceStatus:S($('ov8FilterInvoice')?.value),archiveStatus:S($('ov8FilterArchive')?.value)||'active',dateFrom:S($('ov8DateFrom')?.value),dateTo:S($('ov8DateTo')?.value)};}
  function setLoadStatus(text,err=false){const el=$('ov8LoadStatus');if(el){el.textContent=text;el.className='ov8-status'+(err?' err':'');}}
  function setSaveStatus(text,err=false){const el=$('ov8SaveStatus');if(el){el.textContent=text;el.className='ov8-status'+(err?' err':'');}}
  function recalc(){const total=Math.max(N($('ov8Total')?.value),0),rate=Math.max(N($('ov8TaxRate')?.value||15),0),divisor=100+rate,sub=divisor>0?Math.round((total*100/divisor)*100)/100:Math.round(total*100)/100,tax=Math.round((total-sub)*100)/100,cost=N($('ov8Cost')?.value),profit=Math.round((total-cost)*100)/100;if($('ov8Subtotal'))$('ov8Subtotal').value=sub.toFixed(2);if($('ov8Tax'))$('ov8Tax').value=tax.toFixed(2);if($('ov8Profit'))$('ov8Profit').value=profit.toFixed(2);}
  function payloadFromForm(){
    const po=$('ov8Project')?.selectedOptions?.[0];
    return {order_type:S($('ov8OrderType')?.value),customer_type:S($('ov8CustomerType')?.value),customer_name:S($('ov8Customer')?.value),customer_phone:S($('ov8Phone')?.value),unit_number:S($('ov8Unit')?.value),project_id:S($('ov8Project')?.value),project_name:S(po?.dataset?.name||po?.textContent),executor_name:S($('ov8Executor')?.value),execution_status:S($('ov8Execution')?.value)||'لم ينفذ',payment_status:S($('ov8Payment')?.value)||'غير مسدد',invoice_status:S($('ov8InvoiceStatus')?.value)||'لم تتم',invoice_number:S($('ov8InvoiceNo')?.value),invoice_date:S($('ov8InvoiceDate')?.value),subtotal:N($('ov8Subtotal')?.value),tax_rate:N($('ov8TaxRate')?.value||15),tax_amount:N($('ov8Tax')?.value),total_amount:N($('ov8Total')?.value),cost:N($('ov8Cost')?.value),net_profit:N($('ov8Profit')?.value),details:S($('ov8Details')?.value),notes:S($('ov8Notes')?.value),order_date:S($('ov8OrderDate')?.value)||dateToday()};
  }
  function validatePayload(p){const missing=[];if(!p.project_id||!/^\d+$/.test(S(p.project_id))||!p.project_name||p.project_name==='اختر المشروع')missing.push('المشروع');if(!p.customer_name)missing.push('اسم العميل');if(!p.customer_phone)missing.push('رقم العميل');if(!p.unit_number)missing.push('الوحدة / الموقع');if(!p.details)missing.push('التفاصيل');if(missing.length)throw new Error('أكمل الحقول المطلوبة: '+missing.join('، '));}
  function setSaving(on){state.saving=on;const b=$('ov8SaveBtn');if(b){b.disabled=on;b.textContent=on?'جاري الحفظ…':(state.pendingUploadOrderId?'إعادة محاولة رفع الملفات':'حفظ الأوردر');}}

  async function loadFilters(){
    if(state.filtersLoaded)return;
    try{
      const o=await OrdersService.getFilterOptions();
      const projectNames=(o.projects&&o.projects.length)?o.projects:projects().map(p=>p.name);
      fillSelect('ov8FilterProject',projectNames,'كل المشاريع');
      fillSelect('ov8FilterExecutor',o.executors||[],'كل المنفذين');
      fillSelect('ov8FilterSender',o.senders||[],'كل مرسلي الطلب');
      const dl=$('ov8ExecutorsList');if(dl&&!dl.children.length)dl.innerHTML=(o.executors||[]).map(x=>`<option value="${E(x)}"></option>`).join('');
      state.filtersLoaded=true;
    }catch(e){
      console.warn(BUILD,'filter options',e);
      fillSelect('ov8FilterProject',projects().map(p=>p.name),'كل المشاريع');
    }
  }
  async function load(){
    const token=++state.loadToken;state.filters=collectFilters();state.loadController?.abort();state.loadController=new AbortController();setLoadStatus('جاري تحميل الأوردرات…');
    try{const r=await OrdersService.getOrdersPage({page:state.page,pageSize:PAGE_SIZE,filters:state.filters,signal:state.loadController.signal});if(token!==state.loadToken)return;state.rows=r.rows||[];state.total=Number(r.total||0);state.totalPages=Number(r.total_pages||1);state.page=Number(r.page||1);renderCards();setLoadStatus(state.rows.length?`تم تحميل الأوردرات خلال ${OrdersService.metrics.lastPageMs}ms.`:'لا توجد أوردرات مطابقة.');}
    catch(e){if(token!==state.loadToken||e?.name==='AbortError')return;renderCards();setLoadStatus('تعذر تحميل الأوردرات من السيرفر: '+friendlyError(e),true);}
    loadSummary();
  }
  async function loadSummary(){
    const token=++state.summaryToken;state.summaryController?.abort();state.summaryController=new AbortController();
    const ids=['ov8KpiTotal','ov8KpiDone','ov8KpiDue','ov8KpiProfit','ov8KpiSubtotal','ov8KpiTax','ov8KpiTotalAmount'];
    ids.forEach(id=>{if($(id))$(id).textContent='…';});
    try{
      const s=await OrdersService.getOrdersSummary(state.filters,state.summaryController.signal);if(token!==state.summaryToken)return;
      if($('ov8KpiTotal'))$('ov8KpiTotal').textContent=Number(s.total_orders||0).toLocaleString('ar-SA');
      if($('ov8KpiDone'))$('ov8KpiDone').textContent=Number(s.completed_orders||0).toLocaleString('ar-SA');
      if($('ov8KpiDue'))$('ov8KpiDue').textContent=Number(s.unpaid_orders||0).toLocaleString('ar-SA');
      if($('ov8KpiProfit'))$('ov8KpiProfit').textContent=money(s.total_net_profit||0);
      if($('ov8KpiSubtotal'))$('ov8KpiSubtotal').textContent=money(s.total_subtotal||0);
      if($('ov8KpiTax'))$('ov8KpiTax').textContent=money(s.total_tax_amount||0);
      if($('ov8KpiTotalAmount'))$('ov8KpiTotalAmount').textContent=money(s.total_amount||0);
    }catch(e){if(token!==state.summaryToken||e?.name==='AbortError')return;ids.forEach(id=>{if($(id))$(id).textContent='تعذر';});}
  }

  const canArchive=()=>adminRoles.has(actor().role);
  function statusClass(v){v=S(v);if(v.includes('ملغي')||v.includes('غير مسدد'))return 'bad';if(v.includes('آجل')||v.includes('جزئي')||v.includes('قيد'))return 'warn';return '';}
  function orderCardClass(r){const execution=S(r?.execution_status),payment=S(r?.payment_status);if(r?.is_archived||execution.includes('ملغي'))return 'status-cancelled';if(execution.includes('تم التنفيذ'))return payment.includes('تم السداد')?'status-complete':'status-complete-unpaid';if(execution.includes('قيد')||execution.includes('جزئي'))return 'status-progress';return 'status-pending';}
  function whatsappNumber(value){
    let digits=S(value).replace(/\D/g,'');
    if(!digits)return '';
    if(digits.startsWith('00'))digits=digits.slice(2);
    if(digits.startsWith('0'))digits='966'+digits.slice(1);
    else if(digits.startsWith('5')&&digits.length===9)digits='966'+digits;
    return digits;
  }
  function whatsappMessage(r){
    return [
      'السلام عليكم ورحمة الله وبركاته،',
      `تفاصيل الأوردر رقم: ${S(r.canonical_order_number||r.order_number||'-')}`,
      `المشروع: ${S(r.project_name||'-')}`,
      `العميل: ${S(r.customer_name||'-')}`,
      `حالة التنفيذ: ${S(r.execution_status||'-')}`,
      `السعر شامل الضريبة: ${money(r.total_amount)}`,
      r.details?`التفاصيل: ${S(r.details)}`:'',
      '',
      'شركة تصنيف لإدارة المرافق'
    ].filter(Boolean).join('\n');
  }
  function whatsapp(id){
    const r=state.rows.find(x=>S(x.id)===S(id));
    if(!r)return notify('تعذر العثور على بيانات الأوردر. حدّث القائمة وحاول مرة أخرى.','err');
    const phone=whatsappNumber(r.customer_phone);
    if(!phone)return notify('لا يوجد رقم جوال صالح لهذا الأوردر.','err');
    const url=`https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage(r))}`;
    window.open(url,'_blank','noopener,noreferrer');
  }
  function hasLegacyReceiptData(data){
    if(!data||typeof data!=='object')return false;
    const keys=['__tasneef_order_receipt_v10140','بيانات الإيصال','الإيصال','receipt','receipt_url','receiptUrl','receipt_data','receiptData','payment_receipt','attachment','attachment_url','file_url','سند','السند'];
    return keys.some(k=>{const v=data[k];return v!==undefined&&v!==null&&v!=='';});
  }
  function receiptCount(r){return Math.max(Number(r.receipt_count||0),r.has_legacy_receipt?1:0);}
  function renderCards(){
    const host=$('ov8Cards');if(!host)return;
    if(!state.rows.length){host.innerHTML='<div class="ov8-empty">لا توجد أوردرات مطابقة للفلاتر الحالية.</div>';renderPager();return;}
    host.innerHTML=state.rows.map(r=>{
      const rc=receiptCount(r);
      return `<article class="ov8-card ${orderCardClass(r)} ${r.is_archived?'archived':''}"><div class="ov8-card-head"><div><h3>${E(r.canonical_order_number||r.order_number||'-')}</h3><small>${E(r.order_date||'')} · ${E(r.created_by_name||'-')}</small></div><label class="ov8-check"><input type="checkbox" data-order-select="${E(r.id)}" ${state.selected.has(r.id)?'checked':''}> عرض سعر</label></div><div class="ov8-chips"><span class="ov8-chip ${statusClass(r.execution_status)}">${E(r.execution_status||'-')}</span><span class="ov8-chip ${statusClass(r.payment_status)}">${E(r.payment_status||'-')}</span><span class="ov8-chip">${E(r.invoice_status||'-')}</span>${r.is_archived?'<span class="ov8-chip bad">مؤرشف</span>':''}</div><div class="ov8-meta"><div><small>المشروع</small><b>${E(r.project_name||'غير مرتبط')}</b></div><div><small>المنفذ</small><b>${E(r.executor_name||'غير محدد')}</b></div><div><small>العميل</small><b>${E(r.customer_name||'-')}</b></div><div><small>الجوال</small><b>${E(r.customer_phone||'-')}</b></div></div><div class="ov8-finance-row"><div><small>قبل الضريبة</small><b>${money(r.subtotal)}</b></div><div><small>الضريبة</small><b>${money(r.tax_amount)}</b></div><div><small>السعر شامل الضريبة</small><b>${money(r.total_amount)}</b></div></div><div class="ov8-details">${E(r.details||'لا توجد تفاصيل')}</div><div class="ov8-card-actions"><button onclick="OrdersUI.view('${E(r.id)}')">عرض</button><button class="light" onclick="OrdersUI.edit('${E(r.id)}')">تعديل</button><button class="ov8-whatsapp-btn" onclick="OrdersUI.whatsapp('${E(r.id)}')">واتساب</button><button class="ov8-receipt-btn" onclick="OrdersUI.receipts('${E(r.id)}')" ${rc?'':'disabled'}>${rc?`عرض الإيصال (${rc})`:'لا يوجد إيصال'}</button>${canArchive()?(r.is_archived?`<button class="light" onclick="OrdersUI.restore('${E(r.id)}')">استرجاع</button>`:`<button class="danger" onclick="OrdersUI.archive('${E(r.id)}')">أرشفة</button>`):''}</div></article>`;
    }).join('');
    host.querySelectorAll('[data-order-select]').forEach(x=>x.addEventListener('change',()=>{x.checked?state.selected.add(x.dataset.orderSelect):state.selected.delete(x.dataset.orderSelect);}));renderPager();
  }
  function renderPager(){const p=$('ov8Pager');if(!p)return;const start=state.total?(state.page-1)*PAGE_SIZE+1:0,end=Math.min(state.page*PAGE_SIZE,state.total);p.innerHTML=`<div>عرض ${start}–${end} من أصل ${state.total.toLocaleString('ar-SA')} أوردر — صفحة ${state.page} من ${state.totalPages}</div><div class="ov8-actions"><button class="light" ${state.page<=1?'disabled':''} onclick="OrdersUI.page(-1)">السابق</button><button class="light" ${state.page>=state.totalPages?'disabled':''} onclick="OrdersUI.page(1)">التالي</button></div>`;}

  function resetForm(){state.editingId=null;state.requestId=null;state.pendingUploadOrderId=null;if($('ov8EditId'))$('ov8EditId').value='';if($('ov8FormTitle'))$('ov8FormTitle').textContent=isSupervisor()?'رفع أوردر':'إضافة أوردر';['ov8Number','ov8Customer','ov8Phone','ov8Unit','ov8Executor','ov8InvoiceNo','ov8InvoiceDate','ov8Subtotal','ov8Tax','ov8Total','ov8Cost','ov8Profit','ov8Details','ov8Notes','ov8Reason'].forEach(id=>{if($(id))$(id).value='';});if($('ov8Project'))$('ov8Project').value='';if($('ov8OrderDate'))$('ov8OrderDate').value=dateToday();if($('ov8TaxRate'))$('ov8TaxRate').value='15';if($('ov8Execution'))$('ov8Execution').value='لم ينفذ';if($('ov8Payment'))$('ov8Payment').value='غير مسدد';if($('ov8InvoiceStatus'))$('ov8InvoiceStatus').value='لم تتم';if($('ov8Files'))$('ov8Files').value='';$('ov8FormCard')?.classList.remove('ov8-supervisor-edit');setSaveStatus('جاهز للحفظ.');recalc();}
  async function uploadSelectedFiles(orderId){const files=[...($('ov8Files')?.files||[])];files.forEach(f=>OrdersService.validateReceipt(f));const failed=[];for(const file of files){try{await OrdersService.uploadOrderReceipt(orderId,file);}catch(e){failed.push(file.name+': '+friendlyError(e));}}return failed;}
  async function save(){
    if(state.saving)return;
    try{
      setSaving(true);
      if(state.pendingUploadOrderId){
        setSaveStatus('جاري إعادة رفع الملفات دون إنشاء أوردر جديد…');
        const failed=await uploadSelectedFiles(state.pendingUploadOrderId);
        if(failed.length){setSaveStatus('ما زال رفع بعض الملفات متعذرًا: '+failed.join(' | '),true);return;}
        notify('تم رفع الإيصالات وربطها بالأوردر الموجود.');resetForm();await load();return;
      }
      const p=payloadFromForm(),files=[...($('ov8Files')?.files||[])];
      validatePayload(p);files.forEach(f=>OrdersService.validateReceipt(f));
      if(state.editingId&&!S($('ov8Reason')?.value))throw new Error('اكتب سبب التعديل قبل الحفظ.');
      setSaveStatus(state.editingId?'جاري تحديث الأوردر…':'جاري إنشاء الأوردر…');
      const wasEditing=!!state.editingId;
      let saved;
      if(state.editingId){
        if(isSupervisor()){const restricted={execution_status:p.execution_status,payment_status:p.payment_status,notes:p.notes};saved=await OrdersService.updateOrder(state.editingId,restricted,S($('ov8Reason')?.value));}
        else saved=await OrdersService.updateOrder(state.editingId,p,S($('ov8Reason')?.value));
      }else{state.requestId=state.requestId||uuid();saved=await OrdersService.createOrder(p,state.requestId);}
      const orderId=saved.id||state.editingId;
      const failed=await uploadSelectedFiles(orderId);
      notify(wasEditing?'تم تحديث الأوردر':'تم إنشاء الأوردر');state.page=1;await load();
      if(failed.length){state.pendingUploadOrderId=orderId;state.editingId=null;state.requestId=null;setSaveStatus('تم حفظ الأوردر، لكن فشل رفع بعض الملفات. اضغط إعادة المحاولة دون إنشاء أوردر جديد: '+failed.join(' | '),true);return;}
      setSaveStatus('تم حفظ الأوردر والإيصالات بنجاح.');resetForm();
    }catch(e){setSaveStatus('تعذر الحفظ: '+friendlyError(e),true);notify(friendlyError(e),'err');}
    finally{setSaving(false);}
  }
  async function edit(id){try{const d=await OrdersService.getOrderDetails(id),r=d?.order;if(!r)throw new Error('ORDER_NOT_FOUND');state.editingId=id;if($('ov8EditId'))$('ov8EditId').value=id;if($('ov8FormTitle'))$('ov8FormTitle').textContent='تعديل أوردر '+(r.canonical_order_number||r.order_number);const set=(id,v)=>{if($(id))$(id).value=v??''};set('ov8Number',r.canonical_order_number||r.order_number);set('ov8OrderDate',r.order_date);set('ov8OrderType',r.order_type);set('ov8CustomerType',r.customer_type);ensureProjectOption(r.project_id,r.project_name);if(!$('ov8Project')?.value){const hit=[...($('ov8Project')?.options||[])].find(o=>S(o.dataset.name||o.textContent)===S(r.project_name));if(hit)$('ov8Project').value=hit.value;}set('ov8Customer',r.customer_name);set('ov8Phone',r.customer_phone);set('ov8Unit',r.unit_number);set('ov8Executor',r.executor_name);set('ov8Execution',r.execution_status);set('ov8Payment',r.payment_status);set('ov8InvoiceStatus',r.invoice_status);set('ov8InvoiceNo',r.invoice_number);set('ov8InvoiceDate',r.invoice_date);set('ov8TaxRate',r.tax_rate||15);set('ov8Subtotal',r.subtotal);set('ov8Tax',r.tax_amount);set('ov8Total',N(r.total_amount)>0?r.total_amount:Math.round((N(r.subtotal)+N(r.tax_amount))*100)/100);set('ov8Cost',r.cost);set('ov8Profit',r.net_profit);set('ov8Details',r.details);set('ov8Notes',r.notes);set('ov8Reason','');recalc();if(isSupervisor())$('ov8FormCard')?.classList.add('ov8-supervisor-edit');setSaveStatus(`تم تحميل الأوردر. المرفقات الحالية: ${(d.attachments||[]).length}`);$('ov8FormCard')?.scrollIntoView({behavior:'smooth',block:'start'});}catch(e){notify(friendlyError(e),'err');}}
  async function archive(id){const reason=prompt('اكتب سبب الأرشفة:');if(reason===null)return;try{await OrdersService.archiveOrder(id,reason);notify('تمت أرشفة الأوردر دون حذف بياناته أو إيصالاته.');await load();}catch(e){notify(friendlyError(e),'err');}}
  async function restore(id){const reason=prompt('اكتب سبب الاسترجاع:');if(reason===null)return;try{await OrdersService.restoreOrder(id,reason);notify('تم استرجاع الأوردر.');await load();}catch(e){notify(friendlyError(e),'err');}}

  function detailValue(label,value){return `<div><small>${E(label)}</small><b>${E(value??'-')}</b></div>`;}
  function legacyAttachmentsFromData(data,orderId){
    if(!hasLegacyReceiptData(data))return [];
    const obj=data||{};
    const nested=obj.__tasneef_order_receipt_v10140||obj['بيانات الإيصال']||obj['الإيصال']||obj.receipt||obj.payment_receipt||obj.attachment||{};
    const direct=obj.receipt_url||obj.receiptUrl||obj.receipt_data||obj.receiptData||obj.attachment_url||obj.file_url||obj['سند']||obj['السند'];
    const payload=(nested&&typeof nested==='object')?nested:{data:nested};
    if(direct&&!payload.url&&!payload.data&&!payload.data_url)payload.url=direct;
    const name=S(payload.name||payload.file_name||obj.receipt_name||obj.file_name||'إيصال قديم');
    const type=S(payload.type||payload.mime_type||obj.receipt_type||'application/octet-stream');
    return [{id:`legacy-${orderId}`,order_id:orderId,file_name:name,mime_type:type,file_size:N(payload.size||payload.file_size||0),legacy_payload:{receipt:payload,receipt_url:direct,raw:obj},is_legacy:true}];
  }
  function normalizedAttachments(d,orderId){
    const rows=Array.isArray(d?.attachments)?d.attachments.filter(Boolean):[];
    if(rows.length)return rows;
    return legacyAttachmentsFromData(d?.legacy_data||d?.order?.data,orderId);
  }
  function closeReceiptPreview(){const modal=$('ov8ReceiptPreview');if(modal){const url=modal.dataset.objectUrl;if(url)URL.revokeObjectURL(url);modal.remove();}}
  function showReceiptLoading(title){
    closeReceiptPreview();
    document.body.insertAdjacentHTML('beforeend',`<div class="ov8-receipt-preview" id="ov8ReceiptPreview"><div class="ov8-receipt-preview-card"><div class="ov8-receipt-preview-head"><h3>${E(title||'عرض الإيصال')}</h3><div class="ov8-actions"><button class="light" id="ov8ReceiptOpenNew" style="display:none">فتح في نافذة جديدة</button><button class="light" onclick="OrdersUI.closeReceiptPreview()">إغلاق</button></div></div><div class="ov8-receipt-preview-body" id="ov8ReceiptPreviewBody"><div class="ov8-receipt-loading">جاري تحميل الإيصال…</div></div></div></div>`);
  }
  function findLegacyCandidate(att){
    const p=att?.legacy_payload||{};const r=p.receipt||p.raw?.receipt||p.raw?.__tasneef_order_receipt_v10140||p.raw?.['بيانات الإيصال']||p.raw?.['الإيصال']||{};
    const values=[r.data_url,r.url,r.data,r.file_url,r.receipt_url,p.receipt_url,p.url,p.data,p.raw?.receipt_url,p.raw?.receiptUrl,p.raw?.receipt_data,p.raw?.receiptData,p.raw?.attachment_url,p.raw?.file_url,p.raw?.['سند'],p.raw?.['السند']];
    return values.find(x=>typeof x==='string'&&(x.startsWith('data:')||x.startsWith('blob:')||x.startsWith('http://')||x.startsWith('https://')))||'';
  }
  async function resolveAttachmentSource(att){
    if(att.storage_path){const {data,error}=await sb().storage.from(att.storage_bucket||BUCKET).download(att.storage_path);if(error)throw error;return {url:URL.createObjectURL(data),objectUrl:true,mime:S(att.mime_type||data.type),name:att.file_name};}
    if(att.external_url)return {url:att.external_url,mime:S(att.mime_type),name:att.file_name};
    const legacy=findLegacyCandidate(att);if(legacy)return {url:legacy,mime:S(att.mime_type),name:att.file_name};
    throw new Error('الإيصال محفوظ في البيانات القديمة، لكن لا يحتوي على رابط أو ملف قابل للعرض.');
  }
  async function showAttachment(att){
    showReceiptLoading(att.file_name||'عرض الإيصال');
    try{
      const src=await resolveAttachmentSource(att),modal=$('ov8ReceiptPreview'),body=$('ov8ReceiptPreviewBody');if(!modal||!body){if(src.objectUrl)URL.revokeObjectURL(src.url);return;}
      if(src.objectUrl)modal.dataset.objectUrl=src.url;
      const mime=S(src.mime).toLowerCase(),isImage=mime.startsWith('image/')||/\.(png|jpe?g|webp|gif)(\?|$)/i.test(src.url);
      body.innerHTML=isImage?`<img src="${E(src.url)}" alt="${E(src.name||'الإيصال')}">`:`<iframe src="${E(src.url)}" title="${E(src.name||'الإيصال')}"></iframe>`;
      const open=$('ov8ReceiptOpenNew');if(open){open.style.display='inline-block';open.onclick=()=>window.open(src.url,'_blank','noopener');}
    }catch(e){const body=$('ov8ReceiptPreviewBody');if(body)body.innerHTML=`<div class="ov8-receipt-loading" style="color:#9b2c2c">تعذر عرض الإيصال: ${E(friendlyError(e))}</div>`;}
  }
  async function view(id){try{const d=await OrdersService.getOrderDetails(id),r=d?.order;if(!r)throw new Error('ORDER_NOT_FOUND');const attachments=normalizedAttachments(d,id),audit=d.audit||[];document.body.insertAdjacentHTML('beforeend',`<div class="ov8-modal" id="ov8Modal"><div class="ov8-modal-card"><div class="ov8-modal-head"><h2>الأوردر ${E(r.canonical_order_number||r.order_number)}</h2><div class="ov8-actions"><button class="ov8-whatsapp-btn" onclick="OrdersUI.whatsapp('${E(id)}')">واتساب</button><button class="light" onclick="document.getElementById('ov8Modal').remove()">إغلاق</button></div></div><div class="ov8-detail-grid">${detailValue('المشروع',r.project_name)}${detailValue('العميل',r.customer_name)}${detailValue('الجوال',r.customer_phone)}${detailValue('الوحدة',r.unit_number)}${detailValue('المنفذ',r.executor_name)}${detailValue('التنفيذ',r.execution_status)}${detailValue('السداد',r.payment_status)}${detailValue('الفوترة',r.invoice_status)}${detailValue('السعر قبل الضريبة',money(r.subtotal))}${detailValue('الضريبة',money(r.tax_amount))}${detailValue('السعر شامل الضريبة',money(r.total_amount))}${detailValue('التكلفة',money(r.cost))}${detailValue('صافي الربح',money(r.net_profit))}${detailValue('أنشأه',r.created_by_name)}${detailValue('تاريخ الإنشاء',r.created_at?new Date(r.created_at).toLocaleString('ar-SA'):'-')}${detailValue('آخر تعديل',r.updated_by_name||'-')}${detailValue('تاريخ التعديل',r.updated_at?new Date(r.updated_at).toLocaleString('ar-SA'):'-')}</div><h3>التفاصيل</h3><div class="ov8-details">${E(r.details||'-')}</div><h3>الملاحظات</h3><div class="ov8-details">${E(r.notes||'-')}</div><h3>الإيصالات والمرفقات</h3><div class="ov8-attachments">${attachments.map(a=>`<div class="ov8-attachment"><b>${E(a.file_name||'إيصال')}</b><small> ${E(a.mime_type||'')} · ${a.file_size?Math.round(a.file_size/1024)+' KB':''}${a.is_legacy?' · محفوظ من النسخة القديمة':''}</small><div class="ov8-actions"><button class="ov8-receipt-btn" onclick="OrdersUI.openAttachment('${E(a.id)}','${E(id)}')">عرض الإيصال</button>${a.is_legacy?'':`<button class="danger" onclick="OrdersUI.deleteAttachment('${E(a.id)}','${E(id)}')">حذف منطقي</button>`}</div></div>`).join('')||'<div class="ov8-empty">لا يوجد إيصال محفوظ فعلًا.</div>'}</div><h3>سجل التعديلات</h3><div class="ov8-audit">${audit.map(a=>`<article><b>${E(a.action_type)}</b> — ${E(a.actor_name||'-')}<small> · ${E(a.changed_at?new Date(a.changed_at).toLocaleString('ar-SA'):'')}</small><div>${E(a.reason||'')}</div></article>`).join('')||'<div class="ov8-empty">لا توجد تعديلات مسجلة.</div>'}</div></div></div>`);}catch(e){notify(friendlyError(e),'err');}}
  async function openAttachment(attId,orderId){try{const d=await OrdersService.getOrderDetails(orderId),attachments=normalizedAttachments(d,orderId),a=attachments.find(x=>S(x.id)===S(attId));if(!a)throw new Error('المرفق غير موجود');await showAttachment(a);}catch(e){notify(friendlyError(e),'err');}}
  async function deleteAttachment(attId,orderId){const reason=prompt('سبب حذف الإيصال منطقيًا:');if(reason===null)return;try{await OrdersService.deleteOrderReceipt(attId,reason);notify('تم إخفاء الإيصال منطقيًا ولم يُحذف الملف من التخزين.');$('ov8Modal')?.remove();await view(orderId);await load();}catch(e){notify(friendlyError(e),'err');}}
  async function receipts(id){
    try{const d=await OrdersService.getOrderDetails(id),attachments=normalizedAttachments(d,id);if(!attachments.length)throw new Error('لا يوجد إيصال محفوظ لهذا الأوردر.');if(attachments.length===1){await showAttachment(attachments[0]);return;}
      document.body.insertAdjacentHTML('beforeend',`<div class="ov8-modal" id="ov8ReceiptsModal"><div class="ov8-modal-card" style="width:min(720px,96vw)"><div class="ov8-modal-head"><h2>إيصالات الأوردر (${attachments.length})</h2><button class="light" onclick="document.getElementById('ov8ReceiptsModal').remove()">إغلاق</button></div><div class="ov8-attachments">${attachments.map(a=>`<div class="ov8-attachment"><b>${E(a.file_name||'إيصال')}</b><div class="ov8-actions"><button class="ov8-receipt-btn" onclick="OrdersUI.openAttachment('${E(a.id)}','${E(id)}')">عرض الإيصال</button></div></div>`).join('')}</div></div></div>`);
    }catch(e){notify(friendlyError(e),'err');}
  }

  async function exportExcel(){try{setLoadStatus('جاري تجهيز جميع نتائج Excel من السيرفر…');const list=await OrdersService.exportOrders(collectFilters());if(!list.length)throw new Error('لا توجد نتائج للتصدير');const rows=list.map(r=>({'رقم الأوردر':r.canonical_order_number,'المشروع':r.project_name,'العميل':r.customer_name,'رقم الجوال':r.customer_phone,'المنفذ':r.executor_name,'حالة التنفيذ':r.execution_status,'حالة السداد':r.payment_status,'حالة الفوترة':r.invoice_status,'قبل الضريبة':N(r.subtotal),'الضريبة':N(r.tax_amount),'السعر شامل الضريبة':N(r.total_amount),'التكلفة':N(r.cost),'صافي الربح':N(r.net_profit),'رقم الفاتورة':r.invoice_number||'','يوجد إيصال':Number(r.receipt_count||0)>0?'نعم':'لا','التاريخ':r.order_date||''}));if(window.XLSX){const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Orders');XLSX.writeFile(wb,`Tasneef_Orders_${dateToday()}.xlsx`);}else{const csv='\uFEFF'+[Object.keys(rows[0]).join(','),...rows.map(x=>Object.values(x).map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`Tasneef_Orders_${dateToday()}.csv`;a.click();URL.revokeObjectURL(a.href);}setLoadStatus(`تم تصدير ${list.length} أوردر، وهو نفس إجمالي نتائج الفلاتر.`);}catch(e){setLoadStatus('تعذر التصدير: '+friendlyError(e),true);}}
  async function printOrders(){try{const list=await OrdersService.exportOrders(collectFilters());if(!list.length)throw new Error('لا توجد نتائج للطباعة');const w=window.open('','_blank');if(!w)throw new Error('اسمح بالنوافذ المنبثقة');w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>الأوردرات</title><style>@page{size:A4 landscape;margin:9mm}body{font-family:Tahoma,Arial}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #bbb;padding:5px;text-align:right}th{background:#eef6f3}h2{color:#0A4033}</style></head><body><h2>سجل الأوردرات — ${E(dateToday())}</h2><table><thead><tr><th>الرقم</th><th>المشروع</th><th>العميل</th><th>المنفذ</th><th>التنفيذ</th><th>السداد</th><th>الفوترة</th><th>قبل الضريبة</th><th>الضريبة</th><th>السعر شامل الضريبة</th><th>التاريخ</th></tr></thead><tbody>${list.map(r=>`<tr><td>${E(r.canonical_order_number)}</td><td>${E(r.project_name)}</td><td>${E(r.customer_name)}</td><td>${E(r.executor_name)}</td><td>${E(r.execution_status)}</td><td>${E(r.payment_status)}</td><td>${E(r.invoice_status)}</td><td>${E(money(r.subtotal))}</td><td>${E(money(r.tax_amount))}</td><td>${E(money(r.total_amount))}</td><td>${E(r.order_date)}</td></tr>`).join('')}</tbody></table><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();}catch(e){notify(friendlyError(e),'err');}}
  async function quote(){let ids=[...state.selected];if(!ids.length)ids=state.rows.filter(r=>['آجل','غير مسدد','مسدد جزئيًا'].includes(r.payment_status)).map(r=>r.id);const list=state.rows.filter(r=>ids.includes(r.id));if(!list.length)return notify('حدد أوردرات أو اعرض صفحة تحتوي أوردرات آجلة.','err');const w=window.open('','_blank');if(!w)return notify('اسمح بالنوافذ المنبثقة','err');let sub=0,tax=0,total=0;const body=list.map((r,i)=>{sub+=N(r.subtotal);tax+=N(r.tax_amount);total+=N(r.total_amount);return `<tr><td>${i+1}</td><td>${E(r.details)}</td><td>${E(r.canonical_order_number)}</td><td>${money(r.subtotal)}</td><td>${money(r.tax_amount)}</td><td>${money(r.total_amount)}</td></tr>`}).join('');w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>عرض سعر</title><style>body{font-family:Tahoma,Arial;padding:30px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:8px}th{background:#eef6f3}.tot{margin-top:20px;width:420px}</style></head><body><h1>عرض سعر</h1><p>شركة تصنيف لإدارة المرافق</p><table><thead><tr><th>#</th><th>الوصف</th><th>رقم الأوردر</th><th>قبل الضريبة</th><th>الضريبة</th><th>الإجمالي</th></tr></thead><tbody>${body}</tbody></table><table class="tot"><tr><td>قبل الضريبة</td><td>${money(sub)}</td></tr><tr><td>الضريبة</td><td>${money(tax)}</td></tr><tr><td>الإجمالي</td><td>${money(total)}</td></tr></table><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();}

  function bind(){
    ['ov8Total','ov8TaxRate','ov8Cost'].forEach(id=>$(id)?.addEventListener('input',recalc));
    const search=$('ov8Search');let t;if(search)search.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>{state.page=1;load();},400);});
    ['ov8FilterProject','ov8FilterExecutor','ov8FilterSender','ov8FilterType','ov8FilterCustomerType','ov8FilterExecution','ov8FilterPayment','ov8FilterInvoice','ov8FilterArchive','ov8DateFrom','ov8DateTo'].forEach(id=>$(id)?.addEventListener('change',()=>{state.page=1;load();}));
    $('ov8InvoiceStatus')?.addEventListener('change',()=>{const done=$('ov8InvoiceStatus').value==='تمت';if($('ov8InvoiceNo'))$('ov8InvoiceNo').disabled=!done;if($('ov8InvoiceDate'))$('ov8InvoiceDate').disabled=!done;});
  }

  const OrdersUI={
    refresh:async()=>{await resolveAllowedProjects(true);hydrateReferences();state.filtersLoaded=false;await loadFilters();return load();},newOrder:()=>resetForm(),save,page:d=>{const n=Math.min(state.totalPages,Math.max(1,state.page+Number(d||0)));if(n!==state.page){state.page=n;load();}},
    edit,view,receipts,archive,restore,whatsapp,closeReceiptPreview,archiveCurrent:()=>state.editingId?archive(state.editingId):notify('اختر أوردرًا أولًا.','err'),openAttachment,deleteAttachment,
    resetFilters(){['ov8Search','ov8FilterProject','ov8FilterExecutor','ov8FilterSender','ov8FilterType','ov8FilterCustomerType','ov8FilterExecution','ov8FilterPayment','ov8FilterInvoice','ov8DateFrom','ov8DateTo'].forEach(id=>{if($(id))$(id).value='';});if($('ov8FilterArchive'))$('ov8FilterArchive').value='active';state.page=1;load();},
    exportExcel,print:printOrders,quote
  };
  window.OrdersUI=OrdersUI;
  window.tasneefOrders10400={load,refresh:load,save,edit:(i)=>state.rows[i]&&edit(state.rows[i].id),del:(i)=>state.rows[i]&&archive(state.rows[i].id),view:(i)=>state.rows[i]&&view(state.rows[i].id),page:d=>OrdersUI.page(d),clear:resetForm,render:renderCards,exportExcel,printFiltered:printOrders,openQuoteBuilder:quote};
  window.saveOrderV233=save;window.clearOrderFormV233=resetForm;window.renderOrdersV233=load;window.deleteCurrentOrderV233=OrdersUI.archiveCurrent;
  window.supOrdersLoadV10061=load;window.supOrdersRenderV10061=load;window.supOrdersSaveV10061=save;window.supOrdersClearV10061=resetForm;

  async function boot(){if(!mount())return;bind();resetForm();await resolveAllowedProjects();hydrateReferences();await loadFilters();await load();setTimeout(async()=>{await resolveAllowedProjects(true);hydrateReferences();},900);console.log('Tasneef Orders',BUILD,'loaded — scoped project options');}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0));else setTimeout(boot,0);
})();

/* TASNEEF v286 Professional Orders Hotfix */
(function(){
  if(window.__tasneefV286Orders) return;
  window.__tasneefV286Orders = true;
  const VERSION = 'v286-professional-orders';
  const ORDER_TABLE = 'professional_orders';
  const LOG_TABLE = 'professional_order_logs';
  let ordersCache = [];
  let logsCache = [];
  let selectedOrderId = null;

  const statusMap = {
    new_operations:'جديد من التشغيل',
    returned_to_operations:'معاد للتشغيل',
    sent_finance:'مرسل للمالية',
    returned_from_finance:'معاد من المالية',
    finance_approved:'معتمد ماليًا',
    final_pending:'بانتظار المدير',
    final_approved:'معتمد نهائيًا',
    in_execution:'قيد التنفيذ',
    executed:'تم التنفيذ',
    closed:'مغلق',
    rejected:'مرفوض'
  };
  const stageMap = {operations:'التشغيل', finance:'المالية', general:'مدير النظام', execution:'التنفيذ', closed:'مغلق'};
  const priorityClass = {عاجل:'red', مهم:'amber', عادي:'green'};
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const num = v => { const n = Number(String(v ?? 0).replace(/,/g,'')); return Number.isFinite(n)?n:0; };
  const money = v => num(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2});
  const today = () => { const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); };
  const nowISO = () => new Date().toISOString();
  function toast(t, bad){ try{ if(typeof msg==='function') msg(t, bad?'err':''); else alert(t); }catch(e){ alert(t); } }
  function user(){ try{ return (typeof session==='function' && session()) || JSON.parse(localStorage.getItem('tasneef_user')||'null') || {}; }catch(e){ return {}; } }
  function role(){ return user().role || 'admin'; }
  function userName(){ return user().full_name || user().username || 'مستخدم'; }
  function projects(){ return (window.data && Array.isArray(window.data.projects)) ? window.data.projects : []; }
  function projectName(id){ const p=projects().find(x=>String(x.id)===String(id)); return p?.name || ''; }
  function isSupervisor(){ return role()==='supervisor'; }
  function canOperate(){ return ['admin','operations_manager','general_manager'].includes(role()); }
  function canFinance(){ return ['admin','financial_manager','general_manager'].includes(role()); }
  function canGeneral(){ return ['admin','general_manager'].includes(role()); }
  function canDelete(){ return ['admin','general_manager'].includes(role()); }

  function ensureBadge(){
    let b=$('tasneefV286Badge');
    if(!b){
      b=document.createElement('div'); b.id='tasneefV286Badge';
      b.style.cssText='position:fixed;left:10px;bottom:54px;z-index:99999;background:#0A4033;color:#fff;padding:7px 10px;border-radius:999px;font:12px Tahoma;box-shadow:0 4px 16px rgba(0,0,0,.18)';
      document.body.appendChild(b);
    }
    b.textContent='Tasneef '+VERSION;
  }
  function ensureStyle(){
    if($('ordersStyleV286')) return;
    const st=document.createElement('style'); st.id='ordersStyleV286';
    st.textContent=`
    .orders-pro-v286{display:grid;gap:14px}.orders-pro-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.orders-pro-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}.orders-pro-kpis .kpi b{font-size:24px}.orders-pro-layout{display:grid;grid-template-columns:430px 1fr;gap:16px;align-items:start}.orders-pro-form{position:sticky;top:10px;max-height:86vh;overflow:auto}.orders-pro-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.orders-pro-grid .wide{grid-column:1/-1}.orders-pro-filters{display:grid;grid-template-columns:2fr repeat(5,1fr);gap:8px;align-items:end;background:#fff;border:1px solid var(--line);border-radius:18px;padding:10px;margin-bottom:10px}.order-flow{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.order-step{padding:6px 9px;border-radius:999px;background:#eef6f3;color:#0A4033;border:1px solid #dce6e2;font-size:12px;font-weight:800}.order-step.active{background:#0A4033;color:#fff}.order-card-actions{display:flex;gap:6px;flex-wrap:wrap}.order-log-box{max-height:230px;overflow:auto;border:1px solid var(--line);border-radius:14px;background:#fbfdfc;padding:8px;margin-top:8px}.order-log-item{border-bottom:1px solid #e8efec;padding:7px 4px;line-height:1.7}.order-log-item:last-child{border-bottom:0}.muted{color:#60706a}.order-status-chip{font-weight:900}.orders-pro-table td{white-space:normal;min-width:120px}.orders-pro-table td.desc{min-width:240px}.orders-pro-table .row-actions{min-width:230px}@media(max-width:1100px){.orders-pro-layout,.orders-pro-kpis,.orders-pro-filters{grid-template-columns:1fr}.orders-pro-form{position:static}.orders-pro-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(st);
  }

  function orderFormHtml(prefix='op'){
    return `<input type="hidden" id="${prefix}OrderIdV286">
      <div class="orders-pro-grid">
        <div><label>رقم النظام</label><input id="${prefix}OrderNoV286" readonly placeholder="تلقائي"></div>
        <div><label>رقم القروب</label><input id="${prefix}GroupNoV286" placeholder="رقم الأوردر في القروب"></div>
        <div><label>المشروع</label><select id="${prefix}ProjectV286"></select></div>
        <div><label>نوع الأوردر</label><select id="${prefix}TypeV286"><option>مصروف تشغيلي</option><option>مواد</option><option>صيانة</option><option>مشتريات</option><option>خدمة خارجية</option><option>طارئ</option></select></div>
        <div><label>الأولوية</label><select id="${prefix}PriorityV286"><option>عادي</option><option>مهم</option><option>عاجل</option></select></div>
        <div><label>الكمية</label><input id="${prefix}QtyV286" type="number" step="0.01" value="1"></div>
        <div class="wide"><label>عنوان مختصر</label><input id="${prefix}TitleV286" placeholder="مثال: شراء لمبات للبيسمنت"></div>
        <div class="wide"><label>وصف الطلب</label><textarea id="${prefix}DescV286" placeholder="اكتب تفاصيل الطلب والسبب"></textarea></div>
        <div><label>المبلغ المتوقع</label><input id="${prefix}EstimatedV286" type="number" step="0.01" placeholder="اختياري"></div>
        <div><label>المسؤول / المنفذ</label><input id="${prefix}AssignedV286" placeholder="اختياري"></div>
      </div>
      <div class="actions"><button type="button" onclick="saveProfessionalOrderV286('${prefix}')">حفظ الأوردر</button><button type="button" class="light" onclick="clearProfessionalOrderFormV286('${prefix}')">جديد</button></div>`;
  }

  function fillProjectSelect(selId){
    const sel=$(selId); if(!sel) return;
    let arr=projects();
    const u=user();
    if(u.role==='supervisor') arr = arr.filter(p=>String(p.supervisor_id)===String(u.id) || String(p.app_supervisor_id)===String(u.id));
    sel.innerHTML = '<option value="">اختر المشروع</option>'+arr.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  }

  function adminHtml(){
    return `<div class="orders-pro-v286">
      <div class="card orders-pro-head"><div><h2>إدارة الأوردرات الاحترافية</h2><p class="muted">سير عمل مشترك بين التشغيل والمالية ومدير النظام مع سجل حركة كامل.</p></div><div class="actions"><button onclick="loadProfessionalOrdersV286()">تحديث</button><button class="light" onclick="exportProfessionalOrdersV286()">تنزيل Excel</button></div></div>
      <div class="orders-pro-kpis">
        <div class="kpi"><small>الإجمالي</small><b id="opKpiTotalV286">0</b></div><div class="kpi"><small>التشغيل</small><b id="opKpiOpsV286">0</b></div><div class="kpi"><small>المالية</small><b id="opKpiFinV286">0</b></div><div class="kpi"><small>المدير</small><b id="opKpiGenV286">0</b></div><div class="kpi"><small>منفذ</small><b id="opKpiExeV286">0</b></div><div class="kpi"><small>مغلق</small><b id="opKpiClosedV286">0</b></div>
      </div>
      <div class="orders-pro-layout">
        <div class="card orders-pro-form"><h2 id="opFormTitleV286">إنشاء أوردر</h2>${orderFormHtml('op')}<div id="opFinanceBoxV286" class="hidden"><hr><h3>بيانات المالية</h3><div class="orders-pro-grid"><div><label>المبلغ المعتمد</label><input id="opApprovedV286" type="number" step="0.01"></div><div><label>طريقة الدفع</label><select id="opPaymentV286"><option value="">اختر</option><option>نقدي</option><option>تحويل</option><option>عهدة</option><option>فاتورة آجلة</option></select></div><div><label>المورد</label><input id="opSupplierV286"></div><div><label>رقم الفاتورة</label><input id="opInvoiceV286"></div><div class="wide"><label>ملاحظات المالية</label><textarea id="opFinanceNotesV286"></textarea></div></div><div class="actions"><button onclick="financeApproveOrderV286()">اعتماد مالي</button><button class="light" onclick="returnOrderV286('operations')">إرجاع للتشغيل</button></div></div><div id="opLogBoxV286" class="order-log-box hidden"></div></div>
        <div class="card"><div class="orders-pro-filters"><input id="opSearchV286" placeholder="بحث" oninput="renderProfessionalOrdersV286()"><select id="opStatusFilterV286" onchange="renderProfessionalOrdersV286()"><option value="">كل الحالات</option>${Object.entries(statusMap).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><select id="opProjectFilterV286" onchange="renderProfessionalOrdersV286()"><option value="">كل المشاريع</option></select><select id="opPriorityFilterV286" onchange="renderProfessionalOrdersV286()"><option value="">كل الأولويات</option><option>عاجل</option><option>مهم</option><option>عادي</option></select><input type="date" id="opFromV286" onchange="renderProfessionalOrdersV286()"><input type="date" id="opToV286" onchange="renderProfessionalOrdersV286()"></div><div class="table-wrap"><table class="orders-pro-table"><thead id="opOrdersHeadV286"></thead><tbody id="opOrdersBodyV286"></tbody></table></div></div>
      </div>
    </div>`;
  }

  function supervisorHtml(){
    return `<section class="card"><h2>إنشاء أوردر</h2><div class="sup-help">يتم إرسال الأوردر للتشغيل، وبعدها ينتقل للمالية ثم مدير النظام حسب الاعتماد.</div>${orderFormHtml('sup')}</section><section class="card"><div class="orders-pro-head"><h2>أوردراتي</h2><button class="light" onclick="loadProfessionalOrdersV286()">تحديث</button></div><div class="table-wrap"><table class="orders-pro-table"><thead id="opOrdersHeadV286"></thead><tbody id="opOrdersBodyV286"></tbody></table></div></section>`;
  }

  function injectAdmin(){
    const sec=$('orders'); if(!sec || sec.dataset.v286==='1') return;
    sec.dataset.v286='1';
    sec.innerHTML = adminHtml();
    fillProjectSelect('opProjectV286'); fillProjectFilter();
    loadProfessionalOrdersV286();
  }
  function injectSupervisor(){
    const shell=document.querySelector('.mobile-shell'); if(!shell || $('supOrders')) return;
    const nav=document.querySelector('.sup-tabs');
    if(nav){ const btn=document.createElement('button'); btn.className='sup-tab'; btn.type='button'; btn.textContent='الأوردرات'; btn.onclick=function(){ showSupervisorWindow('supOrders',this); setTimeout(loadProfessionalOrdersV286,50); }; nav.appendChild(btn); }
    const sec=document.createElement('section'); sec.id='supOrders'; sec.className='sup-page'; sec.innerHTML=supervisorHtml();
    const summary=$('supSummary'); if(summary) summary.parentNode.insertBefore(sec, summary); else shell.appendChild(sec);
    fillProjectSelect('supProjectV286'); loadProfessionalOrdersV286();
  }

  function fillProjectFilter(){
    const sel=$('opProjectFilterV286'); if(!sel) return;
    sel.innerHTML='<option value="">كل المشاريع</option>'+projects().map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  }

  async function nextOrderNo(){
    const y=new Date().getFullYear();
    const prefix=`ORD-${y}-`;
    let max=0;
    try{
      const {data,error}=await window.sb.from(ORDER_TABLE).select('order_no').like('order_no', prefix+'%').limit(1000);
      if(!error && data) data.forEach(r=>{ const n=Number(String(r.order_no||'').split('-').pop()); if(Number.isFinite(n)) max=Math.max(max,n); });
    }catch(e){}
    return prefix + String(max+1).padStart(4,'0');
  }

  async function addLog(orderId, action, fromStatus, toStatus, note){
    if(!orderId || !window.sb) return;
    const u=user();
    await window.sb.from(LOG_TABLE).insert({order_id:orderId, action, from_status:fromStatus||'', to_status:toStatus||'', user_id:u.id||null, user_name:userName(), user_role:role(), note:note||''});
  }

  async function loadProfessionalOrdersV286(){
    ensureBadge(); ensureStyle();
    if(!window.sb){ toast('اتصال Supabase غير جاهز', true); return; }
    try{
      let q=window.sb.from(ORDER_TABLE).select('*').order('created_at',{ascending:false}).limit(500);
      const u=user();
      if(u.role==='supervisor') q=q.eq('requester_id', u.id);
      const {data,error}=await q;
      if(error) throw error;
      ordersCache=data||[];
      const ids=ordersCache.map(o=>o.id).filter(Boolean);
      logsCache=[];
      if(ids.length){
        const lr=await window.sb.from(LOG_TABLE).select('*').in('order_id', ids).order('created_at',{ascending:false}).limit(1200);
        if(!lr.error) logsCache=lr.data||[];
      }
      renderProfessionalOrdersV286();
    }catch(e){
      toast('خطأ الأوردرات: '+(e.message||e), true);
      const body=$('opOrdersBodyV286'); if(body) body.innerHTML=`<tr><td colspan="9">${esc(e.message||e)}<br>تأكد من تشغيل ملف SQL: schema_update_v286_professional_orders.sql</td></tr>`;
    }
  }
  window.loadProfessionalOrdersV286=loadProfessionalOrdersV286;

  function readForm(prefix){
    const projectId=$(prefix+'ProjectV286')?.value || '';
    const pName=projectName(projectId) || ($(prefix+'ProjectV286')?.selectedOptions?.[0]?.textContent||'');
    return {project_id:projectId?Number(projectId):null, project_name:pName||'', group_no:$(prefix+'GroupNoV286')?.value||'', order_type:$(prefix+'TypeV286')?.value||'مصروف تشغيلي', priority:$(prefix+'PriorityV286')?.value||'عادي', title:$(prefix+'TitleV286')?.value||'', description:$(prefix+'DescV286')?.value||'', quantity:num($(prefix+'QtyV286')?.value||1), estimated_amount:num($(prefix+'EstimatedV286')?.value), assigned_to:$(prefix+'AssignedV286')?.value||''};
  }
  async function saveProfessionalOrderV286(prefix){
    if(!window.sb) return toast('اتصال Supabase غير جاهز', true);
    const id=$(prefix+'OrderIdV286')?.value;
    const row=readForm(prefix);
    if(!row.project_id) return toast('اختر المشروع', true);
    if(!row.title && !row.description) return toast('اكتب عنوان أو وصف الأوردر', true);
    const u=user();
    try{
      if(id){
        const old=ordersCache.find(o=>String(o.id)===String(id));
        const {error}=await window.sb.from(ORDER_TABLE).update(row).eq('id', id); if(error) throw error;
        await addLog(id,'تعديل الأوردر',old?.status,old?.status,'تم تعديل بيانات الأوردر');
        toast('تم تحديث الأوردر');
      }else{
        row.order_no=await nextOrderNo(); row.requester_id=u.id||null; row.requester_name=userName(); row.requester_role=role(); row.status='new_operations'; row.current_stage='operations';
        const {data,error}=await window.sb.from(ORDER_TABLE).insert(row).select('*').single(); if(error) throw error;
        await addLog(data.id,'إنشاء أوردر','',row.status,'تم إنشاء الأوردر من '+userName());
        toast('تم إنشاء الأوردر وإرساله للتشغيل');
      }
      clearProfessionalOrderFormV286(prefix); await loadProfessionalOrdersV286();
    }catch(e){ toast(e.message||String(e), true); }
  }
  window.saveProfessionalOrderV286=saveProfessionalOrderV286;

  function clearProfessionalOrderFormV286(prefix){
    [prefix+'OrderIdV286',prefix+'OrderNoV286',prefix+'GroupNoV286',prefix+'TitleV286',prefix+'DescV286',prefix+'EstimatedV286',prefix+'AssignedV286'].forEach(id=>{ if($(id)) $(id).value=''; });
    if($(prefix+'QtyV286')) $(prefix+'QtyV286').value='1';
    if($(prefix+'PriorityV286')) $(prefix+'PriorityV286').value='عادي';
    if($(prefix+'TypeV286')) $(prefix+'TypeV286').value='مصروف تشغيلي';
    if($('opFormTitleV286')) $('opFormTitleV286').textContent='إنشاء أوردر';
    selectedOrderId=null; renderLogsBox(null);
  }
  window.clearProfessionalOrderFormV286=clearProfessionalOrderFormV286;

  function editProfessionalOrderV286(id){
    const o=ordersCache.find(x=>String(x.id)===String(id)); if(!o) return;
    selectedOrderId=o.id;
    const prefix=$('opProjectV286')?'op':'sup';
    $(prefix+'OrderIdV286').value=o.id; $(prefix+'OrderNoV286').value=o.order_no||''; $(prefix+'GroupNoV286').value=o.group_no||''; $(prefix+'ProjectV286').value=o.project_id||''; $(prefix+'TypeV286').value=o.order_type||'مصروف تشغيلي'; $(prefix+'PriorityV286').value=o.priority||'عادي'; $(prefix+'QtyV286').value=o.quantity||1; $(prefix+'TitleV286').value=o.title||''; $(prefix+'DescV286').value=o.description||''; $(prefix+'EstimatedV286').value=o.estimated_amount||''; $(prefix+'AssignedV286').value=o.assigned_to||'';
    if($('opApprovedV286')) $('opApprovedV286').value=o.approved_amount||'';
    if($('opPaymentV286')) $('opPaymentV286').value=o.payment_method||'';
    if($('opSupplierV286')) $('opSupplierV286').value=o.supplier_name||'';
    if($('opInvoiceV286')) $('opInvoiceV286').value=o.invoice_no||'';
    if($('opFinanceNotesV286')) $('opFinanceNotesV286').value=o.finance_notes||'';
    if($('opFormTitleV286')) $('opFormTitleV286').textContent='تعديل '+(o.order_no||'');
    renderLogsBox(o.id);
    $('orders')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  window.editProfessionalOrderV286=editProfessionalOrderV286;

  async function updateStatus(id, toStatus, action, note, patch={}){
    const o=ordersCache.find(x=>String(x.id)===String(id)); if(!o) return;
    const stage = toStatus==='sent_finance' || toStatus==='returned_from_finance' ? 'finance' : (toStatus==='finance_approved'||toStatus==='final_pending' ? 'general' : (toStatus==='final_approved'||toStatus==='in_execution'||toStatus==='executed' ? 'execution' : (toStatus==='closed'?'closed':'operations')));
    const row=Object.assign({status:toStatus,current_stage:stage},patch);
    if(toStatus==='sent_finance') row.sent_finance_at=nowISO();
    if(toStatus==='finance_approved') row.finance_approved_at=nowISO();
    if(toStatus==='final_approved') row.final_approved_at=nowISO();
    if(toStatus==='executed') row.executed_at=nowISO();
    if(toStatus==='closed') row.closed_at=nowISO();
    const {error}=await window.sb.from(ORDER_TABLE).update(row).eq('id', id); if(error) return toast(error.message,true);
    await addLog(id,action,o.status,toStatus,note||''); toast('تم تحديث حالة الأوردر'); await loadProfessionalOrdersV286();
  }
  window.sendOrderToFinanceV286=id=>updateStatus(id,'sent_finance','إرسال للمالية','تمت مراجعة التشغيل وإرسال الأوردر للمالية');
  window.sendOrderToGeneralV286=id=>updateStatus(id,'final_pending','إرسال لمدير النظام','تم اعتماد المالية وإرسال الأوردر للمدير');
  window.finalApproveOrderV286=id=>updateStatus(id,'final_approved','اعتماد نهائي','تم الاعتماد النهائي');
  window.markOrderExecutionV286=async function(id){ const note=prompt('اكتب ملاحظة التنفيذ أو اسم المنفذ:')||''; await updateStatus(id,'executed','تنفيذ الأوردر',note,{execution_notes:note}); };
  window.closeOrderV286=id=>updateStatus(id,'closed','إغلاق الأوردر','تم إغلاق الأوردر');
  window.rejectOrderV286=async function(id){ const note=prompt('سبب الرفض:')||''; if(!note) return; await updateStatus(id,'rejected','رفض الأوردر',note,{rejection_reason:note}); };
  window.returnOrderV286=async function(target){ if(!selectedOrderId) return toast('اختر أوردر أولاً',true); const note=prompt('سبب الإرجاع:')||''; if(!note) return; await updateStatus(selectedOrderId, target==='operations'?'returned_to_operations':'returned_from_finance', target==='operations'?'إرجاع للتشغيل':'إرجاع من المدير', note); };
  window.financeApproveOrderV286=async function(){
    if(!selectedOrderId) return toast('اختر أوردر أولاً', true);
    const patch={approved_amount:num($('opApprovedV286')?.value), payment_method:$('opPaymentV286')?.value||'', supplier_name:$('opSupplierV286')?.value||'', invoice_no:$('opInvoiceV286')?.value||'', finance_notes:$('opFinanceNotesV286')?.value||''};
    await updateStatus(selectedOrderId,'finance_approved','اعتماد مالي','تم اعتماد الأوردر ماليًا',patch);
  };
  window.deleteProfessionalOrderV286=async function(id){ if(!canDelete()) return toast('الحذف للمدير فقط',true); if(!confirm('حذف الأوردر نهائيًا؟')) return; const {error}=await window.sb.from(ORDER_TABLE).delete().eq('id',id); if(error) return toast(error.message,true); toast('تم الحذف'); await loadProfessionalOrdersV286(); };

  function actions(o){
    const a=[];
    a.push(`<button onclick="editProfessionalOrderV286(${o.id})">عرض/تعديل</button>`);
    if(canOperate() && ['new_operations','returned_to_operations','returned_from_finance'].includes(o.status)) a.push(`<button class="light" onclick="sendOrderToFinanceV286(${o.id})">إرسال للمالية</button>`);
    if(canFinance() && o.status==='sent_finance') a.push(`<button class="light" onclick="editProfessionalOrderV286(${o.id});document.getElementById('opFinanceBoxV286')?.classList.remove('hidden')">اعتماد مالي</button>`);
    if(canGeneral() && ['finance_approved','final_pending'].includes(o.status)) a.push(`<button class="light" onclick="finalApproveOrderV286(${o.id})">اعتماد نهائي</button>`);
    if((canOperate()||isSupervisor()) && ['final_approved','in_execution'].includes(o.status)) a.push(`<button class="light" onclick="markOrderExecutionV286(${o.id})">تم التنفيذ</button>`);
    if(canGeneral() && o.status==='executed') a.push(`<button class="light" onclick="closeOrderV286(${o.id})">إغلاق</button>`);
    if((canOperate()||canGeneral()) && !['closed','rejected'].includes(o.status)) a.push(`<button class="danger" onclick="rejectOrderV286(${o.id})">رفض</button>`);
    if(canDelete()) a.push(`<button class="danger" onclick="deleteProfessionalOrderV286(${o.id})">حذف</button>`);
    return `<div class="order-card-actions">${a.join('')}</div>`;
  }

  function filtered(){
    let arr=[...ordersCache];
    const q=($('opSearchV286')?.value||'').toLowerCase().trim();
    const st=$('opStatusFilterV286')?.value||''; const pr=$('opProjectFilterV286')?.value||''; const pri=$('opPriorityFilterV286')?.value||''; const from=$('opFromV286')?.value||''; const to=$('opToV286')?.value||'';
    if(st) arr=arr.filter(o=>o.status===st); if(pr) arr=arr.filter(o=>String(o.project_id)===String(pr)); if(pri) arr=arr.filter(o=>o.priority===pri);
    if(from) arr=arr.filter(o=>String(o.created_at||'').slice(0,10)>=from); if(to) arr=arr.filter(o=>String(o.created_at||'').slice(0,10)<=to);
    if(q) arr=arr.filter(o=>[o.order_no,o.group_no,o.project_name,o.title,o.description,o.requester_name,o.assigned_to,o.supplier_name,o.invoice_no].join(' ').toLowerCase().includes(q));
    return arr;
  }
  function updateKpis(rows){
    const set=(id,v)=>{ if($(id)) $(id).textContent=v; };
    set('opKpiTotalV286', rows.length); set('opKpiOpsV286', rows.filter(o=>['new_operations','returned_to_operations','returned_from_finance'].includes(o.status)).length); set('opKpiFinV286', rows.filter(o=>o.status==='sent_finance').length); set('opKpiGenV286', rows.filter(o=>['finance_approved','final_pending'].includes(o.status)).length); set('opKpiExeV286', rows.filter(o=>['final_approved','in_execution','executed'].includes(o.status)).length); set('opKpiClosedV286', rows.filter(o=>o.status==='closed').length);
  }
  function renderProfessionalOrdersV286(){
    ensureStyle(); ensureBadge(); fillProjectFilter();
    const rows=filtered(); updateKpis(rows);
    const head=$('opOrdersHeadV286'), body=$('opOrdersBodyV286'); if(!head||!body) return;
    head.innerHTML='<tr><th>رقم الأوردر</th><th>المشروع</th><th>العنوان</th><th>الأولوية</th><th>الحالة</th><th>المرحلة</th><th>المبلغ</th><th>مقدم الطلب</th><th>التاريخ</th><th>الإجراءات</th></tr>';
    body.innerHTML=rows.map(o=>`<tr><td><b>${esc(o.order_no)}</b><br><span class="muted">قروب: ${esc(o.group_no||'-')}</span></td><td>${esc(o.project_name||projectName(o.project_id)||'-')}</td><td class="desc"><b>${esc(o.title||'-')}</b><br><span class="muted">${esc(o.description||'')}</span></td><td><span class="badge ${priorityClass[o.priority]||''}">${esc(o.priority||'عادي')}</span></td><td><span class="badge order-status-chip">${esc(statusMap[o.status]||o.status)}</span></td><td>${esc(stageMap[o.current_stage]||o.current_stage||'-')}</td><td>${money(o.approved_amount||o.estimated_amount)} ر.س</td><td>${esc(o.requester_name||'-')}</td><td>${esc(String(o.created_at||'').slice(0,10))}</td><td class="row-actions">${actions(o)}</td></tr>`).join('') || '<tr><td colspan="10">لا توجد أوردرات</td></tr>';
  }
  window.renderProfessionalOrdersV286=renderProfessionalOrdersV286;

  function renderLogsBox(orderId){
    const box=$('opLogBoxV286'); if(!box) return;
    if(!orderId){ box.classList.add('hidden'); box.innerHTML=''; return; }
    box.classList.remove('hidden');
    const logs=logsCache.filter(l=>String(l.order_id)===String(orderId));
    box.innerHTML='<h3>سجل حركة الأوردر</h3>'+(logs.map(l=>`<div class="order-log-item"><b>${esc(l.action)}</b><br><span class="muted">${esc(l.user_name||'-')} - ${esc(String(l.created_at||'').slice(0,16).replace('T',' '))}</span><br>${esc(l.note||'')}</div>`).join('')||'<div class="muted">لا يوجد سجل حركة بعد</div>');
  }

  function exportProfessionalOrdersV286(){
    const rows=filtered();
    const headers=['رقم الأوردر','رقم القروب','المشروع','العنوان','الوصف','النوع','الأولوية','الحالة','المرحلة','المبلغ المتوقع','المبلغ المعتمد','طريقة الدفع','المورد','رقم الفاتورة','مقدم الطلب','التاريخ'];
    const xmlRows=rows.map(o=>[o.order_no,o.group_no,o.project_name,o.title,o.description,o.order_type,o.priority,statusMap[o.status]||o.status,stageMap[o.current_stage]||o.current_stage,o.estimated_amount,o.approved_amount,o.payment_method,o.supplier_name,o.invoice_no,o.requester_name,String(o.created_at||'').slice(0,10)]);
    const xml=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Orders"><Table><Row>${headers.map(h=>`<Cell><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('')}</Row>${xmlRows.map(r=>`<Row>${r.map(c=>`<Cell><Data ss:Type="String">${esc(c??'')}</Data></Cell>`).join('')}</Row>`).join('')}</Table></Worksheet></Workbook>`;
    const blob=new Blob(['\ufeff'+xml],{type:'application/vnd.ms-excel'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='professional_orders.xls'; a.click(); URL.revokeObjectURL(a.href);
  }
  window.exportProfessionalOrdersV286=exportProfessionalOrdersV286;

  const oldShow=window.showPage;
  window.showPage=function(id,btn){ if(typeof oldShow==='function') oldShow(id,btn); if(id==='orders') setTimeout(injectAdmin,50); };
  const oldSup=window.showSupervisorWindow;
  window.showSupervisorWindow=function(id,btn){ if(typeof oldSup==='function') oldSup(id,btn); if(id==='supOrders') setTimeout(loadProfessionalOrdersV286,50); };
  document.addEventListener('DOMContentLoaded', function(){ ensureBadge(); ensureStyle(); setTimeout(()=>{ injectAdmin(); injectSupervisor(); },700); });
})();

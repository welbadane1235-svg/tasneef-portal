/* TASNEEF v289 Excel Orders Flow - same Excel idea, split by roles */
(function(){
  if(window.__tasneefV289ExcelOrdersFlow) return;
  window.__tasneefV289ExcelOrdersFlow = true;
  const VERSION='v289-excel-orders-flow';
  const ORDER_TABLE='professional_orders';
  const LOG_TABLE='professional_order_logs';
  let cache=[];
  let logs=[];
  let legacy=[];
  let active='create';
  let selectedId=null;
  let loaded=false;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const n=v=>{const x=Number(String(v??0).replace(/,/g,'').trim());return Number.isFinite(x)?x:0;};
  const money=v=>n(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2});
  const today=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10);};
  const now=()=>new Date().toISOString();
  const msgx=(t,bad)=>{try{ if(typeof msg==='function') msg(t,bad?'err':''); else alert(t);}catch(e){alert(t);}};
  const user=()=>{try{return (typeof session==='function'&&session())||JSON.parse(localStorage.getItem('tasneef_user')||'null')||{};}catch(e){return {};}};
  const role=()=>String(user().role||'').trim();
  const uid=()=>user().id||user().user_id||null;
  const uname=()=>user().full_name||user().username||'مستخدم';
  const projects=()=>window.data&&Array.isArray(window.data.projects)?window.data.projects:[];
  const pName=id=>{const p=projects().find(x=>String(x.id)===String(id));return p?.name||'';};
  const canAdmin=()=>['admin','general_manager','system_manager'].includes(role());
  const canFinance=()=>canAdmin()||['financial_manager','finance'].includes(role());
  const canCreate=()=>canAdmin()||['supervisor','technician','operations_manager','operation','admin'].includes(role());
  const isTech=()=>role()==='technician';
  const isSup=()=>role()==='supervisor';
  const orderStatuses={sent_finance:'عند المالية',finance_approved:'عند مدير النظام',closed:'مغلق',rejected:'مرفوض'};
  const legacySeed=()=>window.TASNEEF_ORDERS_SEED||{headers:[],orders:[],lists:{}};

  function calcGross(gross,cost){
    gross=n(gross); cost=n(cost);
    const before=+(gross/1.15).toFixed(2);
    const vat=+(gross-before).toFixed(2);
    const profit=+(before-cost).toFixed(2);
    return {before,vat,profit};
  }
  function ensureBadge(){
    let b=$('tasneefV289Badge'); if(!b){b=document.createElement('div');b.id='tasneefV289Badge';b.style.cssText='position:fixed;left:10px;bottom:118px;z-index:99999;background:#0A4033;color:#fff;padding:7px 10px;border-radius:999px;font:12px Tahoma;box-shadow:0 3px 14px #0002';document.body.appendChild(b);} b.textContent='Tasneef '+VERSION;
  }
  function ensureStyle(){
    if($('ordersStyleV289')) return;
    const st=document.createElement('style'); st.id='ordersStyleV289'; st.textContent=`
      .orders-v289{display:grid;gap:14px}.orders-head-v289{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.orders-tabs-v289{display:flex;gap:8px;flex-wrap:wrap;background:#fff;border:1px solid var(--line,#dce6e2);border-radius:18px;padding:10px}.orders-tabs-v289 button{background:#eef6f3;color:#0A4033;border:1px solid #dce6e2}.orders-tabs-v289 button.active{background:#0A4033;color:#fff}.orders-layout-v289{display:grid;grid-template-columns:430px 1fr;gap:16px;align-items:start}.orders-form-v289{position:sticky;top:10px;max-height:86vh;overflow:auto}.orders-grid-v289{display:grid;grid-template-columns:1fr 1fr;gap:9px}.orders-grid-v289 .wide{grid-column:1/-1}.orders-kpis-v289{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.orders-filter-v289{display:grid;grid-template-columns:2fr repeat(4,1fr);gap:8px;background:#fff;border:1px solid var(--line,#dce6e2);border-radius:18px;padding:10px;margin-bottom:10px}.orders-table-v289 td{white-space:normal;min-width:115px}.orders-table-v289 td.details{min-width:280px}.stage-v289{display:inline-block;padding:5px 9px;border-radius:999px;background:#eef6f3;color:#0A4033;font-size:12px;font-weight:800}.stage-v289.finance{background:#fff5da;color:#8a6700}.stage-v289.manager{background:#e8f0ff;color:#1b4d89}.stage-v289.closed{background:#e8f4ee;color:#137a4b}.stage-v289.rejected{background:#fde8e8;color:#9d2222}.order-actions-v289{display:flex;gap:6px;flex-wrap:wrap}.order-actions-v289 button{padding:7px 9px;border-radius:9px;font-size:12px}.logbox-v289{max-height:210px;overflow:auto;border:1px solid var(--line,#dce6e2);border-radius:14px;background:#fbfdfc;padding:8px;margin-top:8px}.logitem-v289{border-bottom:1px solid #e8efec;padding:7px 4px;line-height:1.6}.logitem-v289:last-child{border-bottom:0}.muted-v289{color:#60706a}.readonly-v289{background:#f4f8f6!important;color:#0A4033!important;font-weight:800}.finance-box-v289{background:#fffdf5;border:1px solid #f1daa0;border-radius:16px;padding:12px;margin:12px 0}.manager-box-v289{background:#f6f9ff;border:1px solid #cfdcff;border-radius:16px;padding:12px;margin:12px 0}@media(max-width:1100px){.orders-layout-v289{grid-template-columns:1fr}.orders-form-v289{position:static}.orders-filter-v289,.orders-kpis-v289{grid-template-columns:1fr}.orders-grid-v289{grid-template-columns:1fr}}
    `; document.head.appendChild(st);
  }
  function safeId(prefix, name){return prefix+'_'+String(name).replace(/[^a-zA-Z0-9\u0600-\u06FF]/g,'_');}
  function nextNo(){return 'ORD'+String(Date.now()).slice(-7);} 
  function fieldsHtml(mode){
    const disabledFinance = mode==='finance' ? '' : 'readonly';
    return `
      <div><label>رقم الطلب / النظام</label><input id="o_no" class="readonly-v289" readonly placeholder="تلقائي"></div>
      <div><label>رقم الطلب بالجروب</label><input id="o_group" placeholder="اكتب رقم الطلب في القروب"></div>
      <div><label>تاريخ الطلب</label><input id="o_date" type="date"></div>
      <div><label>مرسل الطلب</label><input id="o_sender" placeholder="اسم مرسل الطلب"></div>
      <div><label>المشروع</label><select id="o_project"><option value="">اختر المشروع</option></select></div>
      <div><label>نوع العقار</label><input id="o_property" list="list_property" placeholder="شقة / عمارة / فيلا"><datalist id="list_property"><option value="شقة"><option value="عمارة"><option value="فيلا"><option value="مكتب"><option value="عام"></datalist></div>
      <div><label>رقم الشقة</label><input id="o_unit"></div>
      <div><label>اسم العميل</label><input id="o_client"></div>
      <div><label>رقم العميل</label><input id="o_phone"></div>
      <div><label>المنفذ</label><input id="o_executor" placeholder="اسم الفني / المنفذ"></div>
      <div class="wide"><label>التفاصيل</label><textarea id="o_details" placeholder="اكتب تفاصيل الطلب مثل ملف الإكسل"></textarea></div>
      <div class="wide"><label>ملاحظات</label><textarea id="o_notes"></textarea></div>
      <div><label>تخص</label><select id="o_belongs"><option value="تخص العميل">تخص العميل</option><option value="تخص الجمعية">تخص الجمعية</option><option value="تخص التشغيل">تخص التشغيل</option><option value="عام">عام</option></select></div>
      <div><label>السعر شامل الضريبة</label><input id="o_gross" type="number" step="0.01" oninput="ordersV289PreviewCalc()"></div>
      <div><label>التكلفة</label><input id="o_cost" type="number" step="0.01" oninput="ordersV289PreviewCalc()"></div>
      <div><label>الضريبة 15%</label><input id="o_vat" class="readonly-v289" readonly></div>
      <div><label>السعر قبل الضريبة</label><input id="o_before" class="readonly-v289" readonly></div>
      <div><label>الربح</label><input id="o_profit" class="readonly-v289" readonly></div>
    `;
  }
  function financeFieldsHtml(){return `
    <div class="finance-box-v289" id="financeBoxV289">
      <h3>قسم المالية - اعتماد وفاتورة</h3>
      <div class="orders-grid-v289">
        <div><label>المبلغ المعتمد</label><input id="f_amount" type="number" step="0.01" oninput="ordersV289PreviewFinanceCalc()"></div>
        <div><label>التكلفة المعتمدة</label><input id="f_cost" type="number" step="0.01" oninput="ordersV289PreviewFinanceCalc()"></div>
        <div><label>الضريبة</label><input id="f_vat" class="readonly-v289" readonly></div>
        <div><label>السعر قبل الضريبة</label><input id="f_before" class="readonly-v289" readonly></div>
        <div><label>الربح</label><input id="f_profit" class="readonly-v289" readonly></div>
        <div><label>حالة السداد</label><select id="f_payment"><option value="تم السداد">تم السداد</option><option value="آجل">آجل</option><option value="جزئي">جزئي</option><option value="مجاني">مجاني</option></select></div>
        <div><label>رقم الفاتورة</label><input id="f_invoice" placeholder="INV-000000"></div>
        <div><label>فوترة بالسيستم</label><select id="f_billing"><option value="تمت الفوترة">تمت الفوترة</option><option value="لم تتم">لم تتم</option><option value="معفى">معفى</option></select></div>
        <div class="wide"><label>ملاحظات المالية</label><textarea id="f_notes"></textarea></div>
      </div>
      <div class="actions"><button onclick="financeApproveV289()">اعتماد المالية وإرسال لمدير النظام</button><button class="danger" onclick="rejectOrderV289()">رفض</button></div>
    </div>`;}
  function managerFieldsHtml(){return `
    <div class="manager-box-v289" id="managerBoxV289">
      <h3>مدير النظام - كل الصلاحيات</h3>
      <div class="orders-grid-v289">
        <div><label>حالة التنفيذ</label><select id="m_exec_status"><option value="لم ينفذ">لم ينفذ</option><option value="تم التنفيذ">تم التنفيذ</option><option value="جزئي">جزئي</option></select></div>
        <div><label>تاريخ التنفيذ</label><input id="m_exec_date" type="date"></div>
        <div><label>تقرير</label><select id="m_report"><option value="لم يصدر">لم يصدر</option><option value="صدر التقرير">صدر التقرير</option></select></div>
        <div class="wide"><label>كيفية التنفيذ</label><textarea id="m_exec_method"></textarea></div>
      </div>
      <div class="actions"><button onclick="managerCloseV289()">اعتماد وإغلاق</button><button class="light" onclick="managerReturnFinanceV289()">إرجاع للمالية</button><button class="danger" onclick="rejectOrderV289()">رفض</button></div>
    </div>`;}
  function projectOptions(){return projects().map(p=>`<option value="${esc(p.id)}">${esc(p.name||p.project_name||p.id)}</option>`).join('');}
  function fillProjects(){['o_project','filterProjectV289'].forEach(id=>{const el=$(id); if(el && !el.dataset.filled){el.insertAdjacentHTML('beforeend',projectOptions());el.dataset.filled='1';}});}
  function pickStage(){
    if(canAdmin()) return active;
    if(canFinance()) return 'finance';
    return 'create';
  }
  function tabsHtml(){
    const tabs=[];
    if(canCreate()) tabs.push(['create','إنشاء الطلبات']);
    if(canFinance()) tabs.push(['finance','المالية']);
    if(canAdmin()) tabs.push(['manager','مدير النظام'],['all','كل الأوردرات'],['legacy','الأوردرات القديمة']);
    return `<div class="orders-tabs-v289">${tabs.map(t=>`<button id="tab_${t[0]}_v289" onclick="setOrdersStageV289('${t[0]}')">${t[1]} <span id="count_${t[0]}_v289"></span></button>`).join('')}</div>`;
  }
  function adminHtml(){
    active=pickStage();
    return `<div class="orders-v289">
      <div class="card orders-head-v289"><div><h2>قسم الأوردرات</h2><p>نفس فكرة ملف الإكسل: الفني/التشغيل ينشئ الطلب ويحدد المبلغ، المالية تعتمد وتصدر الفاتورة، ومدير النظام لديه كل الصلاحيات.</p></div><div class="actions"><button onclick="loadOrdersV289(true)">تحديث</button><button class="light" onclick="exportOrdersV289()">تنزيل Excel</button></div></div>
      ${tabsHtml()}
      <div class="orders-kpis-v289"><div class="kpi"><small>المعروض الآن</small><b id="kpiShownV289">0</b></div><div class="kpi"><small>عند المالية</small><b id="kpiFinanceV289">0</b></div><div class="kpi"><small>عند مدير النظام</small><b id="kpiManagerV289">0</b></div><div class="kpi"><small>المبلغ</small><b id="kpiAmountV289">0</b></div></div>
      <div class="orders-layout-v289" id="ordersLayoutV289">
        <section class="card orders-form-v289" id="formCardV289"><h2 id="formTitleV289">إنشاء طلب</h2><input type="hidden" id="editIdV289"><div class="orders-grid-v289">${fieldsHtml('create')}</div><div id="financeAreaV289"></div><div id="managerAreaV289"></div><div class="actions" id="formActionsV289"><button onclick="saveAndSendOrderV289()">حفظ وإرسال للمالية</button><button class="light" onclick="clearOrderV289()">جديد</button></div><div id="logBoxV289" class="logbox-v289 hidden"></div></section>
        <section class="card"><div class="orders-filter-v289"><input id="searchV289" oninput="renderOrdersV289()" placeholder="بحث برقم الطلب، القروب، المشروع، العميل، التفاصيل"><select id="filterProjectV289" onchange="renderOrdersV289()"><option value="">كل المشاريع</option></select><select id="filterStatusV289" onchange="renderOrdersV289()"><option value="">كل الحالات</option><option value="sent_finance">عند المالية</option><option value="finance_approved">عند مدير النظام</option><option value="closed">مغلق</option><option value="rejected">مرفوض</option></select><input id="fromV289" type="date" onchange="renderOrdersV289()"><input id="toV289" type="date" onchange="renderOrdersV289()"></div><div class="table-wrap"><table class="orders-table-v289"><thead id="headV289"></thead><tbody id="bodyV289"></tbody></table></div></section>
      </div>
    </div>`;
  }
  function compactHtml(context){
    return `<section class="card orders-v289"><div class="orders-head-v289"><div><h2>إنشاء أوردر</h2><p>اكتب الطلب وحدد المبلغ ثم أرسله للمالية مباشرة.</p></div><button class="light" onclick="loadOrdersV289(true)">تحديث</button></div><div class="orders-layout-v289"><section class="card orders-form-v289"><input type="hidden" id="editIdV289"><div class="orders-grid-v289">${fieldsHtml('create')}</div><div class="actions"><button onclick="saveAndSendOrderV289()">حفظ وإرسال للمالية</button><button class="light" onclick="clearOrderV289()">تفريغ</button></div></section><section class="card"><h2>طلباتي</h2><div class="table-wrap"><table class="orders-table-v289"><thead id="headV289"></thead><tbody id="bodyV289"></tbody></table></div></section></div></section>`;
  }
  function orderToRow(o){
    const ex=o.extra_data||{};
    const gross=n(o.approved_amount||o.estimated_amount||ex.gross_amount);
    const cost=n(o.cost_amount||ex.cost_amount);
    const c=calcGross(gross,cost);
    return {
      id:o.id, no:o.order_no, group:o.group_no, date:String(o.created_at||'').slice(0,10), sender:o.requester_name, project:o.project_name||pName(o.project_id), property:ex.property_type, unit:ex.unit_no, client:ex.client_name, phone:ex.client_phone, executor:o.assigned_to, details:o.description||o.title, notes:o.finance_notes||ex.notes, belongs:ex.belongs_to, gross, vat:n(o.tax_amount||ex.tax_amount||c.vat), before:n(o.price_before_tax||ex.price_before_tax||c.before), cost, profit:n(o.profit_amount||ex.profit_amount||c.profit), payment:o.billing_status||ex.payment_status, invoice:o.invoice_no, billing:ex.system_billing_status, execStatus:ex.execution_status, execDate:ex.execution_date, execMethod:o.execution_notes||ex.execution_method, report:ex.report_status, status:o.status, raw:o
    };
  }
  function legacyRows(){
    const seed=legacySeed(); const headers=(seed.headers||[]).filter(h=>!String(h).startsWith('__excel_col_'));
    return (seed.orders||[]).map((r,i)=>({legacy:true,id:'legacy_'+i,headers, no:r['رقم الطلب'],group:r['رقم الطلب بالجروب'],date:r['تاريخ الطلب'],sender:r['مرسل الطلب'],project:r['المشروع'],property:r['نوع العقار'],unit:r['رقم الشقة'],client:r['اسم العميل'],phone:r['رقم العميل'],executor:r['المنفذ'],details:r['التفاصيل'],notes:r['ملاحظات'],belongs:r['تخص'],gross:n(r['السعر (شامل الضريبة)']),vat:n(r['الضريبة 15%']),before:n(r['السعر قبل الضريبة']),cost:n(r['التكلفة']),profit:n(r['الربح']),payment:r['حالة السداد'],invoice:r['رقم الفاتورة '],billing:r['فوترة بالسيستم'],execStatus:r['حالة التنفيذ'],execDate:r['تاريخ التنفيذ'],execMethod:r['كيفية التنفيذ'],report:r['تقرير'],status:'legacy',raw:r}));
  }
  function rowsForActive(){
    let rows=cache.map(orderToRow);
    if(active==='finance') rows=rows.filter(r=>r.status==='sent_finance');
    else if(active==='manager') rows=rows.filter(r=>r.status==='finance_approved');
    else if(active==='create'){
      if(canAdmin()) rows=rows.filter(r=>r.status==='sent_finance');
      else rows=rows.filter(r=>String(r.raw.requester_id||'')===String(uid()||'') || String(r.sender||'')===String(uname()));
    } else if(active==='legacy') rows=legacyRows();
    else if(active==='all') rows=rows.concat(legacyRows());
    const q=($('searchV289')?.value||'').toLowerCase().trim();
    const pr=$('filterProjectV289')?.value||''; const st=$('filterStatusV289')?.value||''; const from=$('fromV289')?.value||''; const to=$('toV289')?.value||'';
    if(pr) rows=rows.filter(r=>String(r.raw?.project_id||'')===String(pr)||String(r.project||'')===pName(pr));
    if(st) rows=rows.filter(r=>r.status===st);
    if(from) rows=rows.filter(r=>String(r.date||'')>=from);
    if(to) rows=rows.filter(r=>String(r.date||'')<=to);
    if(q) rows=rows.filter(r=>[r.no,r.group,r.project,r.client,r.phone,r.executor,r.details,r.notes,r.invoice].join(' ').toLowerCase().includes(q));
    return rows;
  }
  function updateKpis(rows){
    const set=(id,v)=>{if($(id))$(id).textContent=v};
    set('kpiShownV289',rows.length); set('kpiFinanceV289',cache.filter(o=>o.status==='sent_finance').length); set('kpiManagerV289',cache.filter(o=>o.status==='finance_approved').length); set('kpiAmountV289',money(rows.reduce((s,r)=>s+n(r.gross),0)));
    ['create','finance','manager','all','legacy'].forEach(k=>{const e=$('count_'+k+'_v289'); if(e){let c=0; if(k==='finance')c=cache.filter(o=>o.status==='sent_finance').length; else if(k==='manager')c=cache.filter(o=>o.status==='finance_approved').length; else if(k==='legacy')c=legacyRows().length; else if(k==='all')c=cache.length+legacyRows().length; else c=cache.filter(o=>o.status==='sent_finance').length; e.textContent='('+c+')';}});
    document.querySelectorAll('.orders-tabs-v289 button').forEach(b=>b.classList.remove('active')); const tab=$('tab_'+active+'_v289'); if(tab)tab.classList.add('active');
  }
  function headers(){return ['رقم الطلب','رقم الطلب بالجروب','تاريخ الطلب','مرسل الطلب','المشروع','نوع العقار','رقم الشقة','اسم العميل','رقم العميل','المنفذ','التفاصيل','ملاحظات','تخص','حالة التنفيذ','تقرير','السعر شامل الضريبة','الضريبة 15%','السعر قبل الضريبة','التكلفة','الربح','حالة السداد','رقم الفاتورة','فوترة بالسيستم','المرحلة','إجراء'];}
  function stageLabel(r){ if(r.legacy)return 'قديم'; return orderStatuses[r.status]||r.status; }
  function stageCls(r){ if(r.status==='sent_finance')return 'finance'; if(r.status==='finance_approved')return 'manager'; if(r.status==='closed')return 'closed'; if(r.status==='rejected')return 'rejected'; return '';}
  function actions(r){
    if(r.legacy) return '<span class="muted-v289">عرض فقط</span>';
    const a=[];
    if(canAdmin()||String(r.raw.requester_id||'')===String(uid()||'')) a.push(`<button onclick="editOrderV289(${r.id})">عرض/تعديل</button>`);
    if(canFinance() && r.status==='sent_finance') a.push(`<button class="light" onclick="editOrderV289(${r.id});setOrdersStageV289('finance')">اعتماد مالي</button>`);
    if(canAdmin() && r.status==='finance_approved') a.push(`<button class="light" onclick="editOrderV289(${r.id});setOrdersStageV289('manager')">اعتماد المدير</button>`);
    if(canAdmin()) a.push(`<button class="danger" onclick="deleteOrderV289(${r.id})">حذف</button>`);
    return `<div class="order-actions-v289">${a.join('')}</div>`;
  }
  function renderOrdersV289(){
    ensureStyle(); ensureBadge(); fillProjects();
    let rows=rowsForActive(); updateKpis(rows);
    const form=$('formCardV289'); const layout=$('ordersLayoutV289');
    if(form){ form.style.display=(active==='legacy'||active==='all')?'none':''; }
    if(layout){ layout.style.gridTemplateColumns=(active==='legacy'||active==='all')?'1fr':'430px 1fr'; }
    const h=$('headV289'), b=$('bodyV289'); if(!h||!b)return;
    h.innerHTML='<tr>'+headers().map(x=>`<th>${esc(x)}</th>`).join('')+'</tr>';
    b.innerHTML=rows.map(r=>`<tr><td><b>${esc(r.no)}</b></td><td>${esc(r.group||'')}</td><td>${esc(r.date||'')}</td><td>${esc(r.sender||'')}</td><td>${esc(r.project||'')}</td><td>${esc(r.property||'')}</td><td>${esc(r.unit||'')}</td><td>${esc(r.client||'')}</td><td>${esc(r.phone||'')}</td><td>${esc(r.executor||'')}</td><td class="details">${esc(r.details||'')}</td><td class="details">${esc(r.notes||'')}</td><td>${esc(r.belongs||'')}</td><td>${esc(r.execStatus||'')}</td><td>${esc(r.report||'')}</td><td>${money(r.gross)}</td><td>${money(r.vat)}</td><td>${money(r.before)}</td><td>${money(r.cost)}</td><td>${money(r.profit)}</td><td>${esc(r.payment||'')}</td><td>${esc(r.invoice||'')}</td><td>${esc(r.billing||'')}</td><td><span class="stage-v289 ${stageCls(r)}">${esc(stageLabel(r))}</span></td><td>${actions(r)}</td></tr>`).join('')||`<tr><td colspan="${headers().length}">لا توجد بيانات في هذه النافذة</td></tr>`;
  }
  async function loadOrdersV289(force){
    ensureBadge(); ensureStyle();
    if(!window.sb) return msgx('Supabase غير متصل',true);
    if(loaded && !force){renderOrdersV289();return;}
    loaded=true;
    const {data,error}=await window.sb.from(ORDER_TABLE).select('*').order('created_at',{ascending:false}).limit(500);
    if(error){msgx('خطأ تحميل الأوردرات: '+error.message,true);return;}
    cache=data||[];
    const ids=cache.map(x=>x.id).filter(Boolean).slice(0,500);
    if(ids.length){const r=await window.sb.from(LOG_TABLE).select('*').in('order_id',ids).order('created_at',{ascending:false}).limit(1000); logs=r.data||[];}
    renderOrdersV289();
  }
  window.loadOrdersV289=loadOrdersV289;
  function collectBase(){
    const pr=$('o_project')?.value||''; const gross=n($('o_gross')?.value); const cost=n($('o_cost')?.value); const c=calcGross(gross,cost);
    return {
      group_no:$('o_group')?.value||'', project_id:pr?Number(pr):null, project_name:pName(pr)||($('o_project')?.selectedOptions?.[0]?.text||''), requester_id:uid(), requester_name:$('o_sender')?.value||uname(), requester_role:role(), order_type:$('o_belongs')?.value||'صيانة', priority:'عادي', title:($('o_details')?.value||'').slice(0,80), description:$('o_details')?.value||'', quantity:1, estimated_amount:gross, approved_amount:0, cost_amount:cost, tax_amount:c.vat, price_before_tax:c.before, profit_amount:c.profit, assigned_to:$('o_executor')?.value||'', status:'sent_finance', current_stage:'finance', extra_data:{order_date:$('o_date')?.value||today(), property_type:$('o_property')?.value||'', unit_no:$('o_unit')?.value||'', client_name:$('o_client')?.value||'', client_phone:$('o_phone')?.value||'', notes:$('o_notes')?.value||'', belongs_to:$('o_belongs')?.value||'', gross_amount:gross, cost_amount:cost, tax_amount:c.vat, price_before_tax:c.before, profit_amount:c.profit, payment_status:'', system_billing_status:'', execution_status:'لم ينفذ', report_status:'لم يصدر'}
    };
  }
  async function addLog(orderId,action,from,to,note){ try{await window.sb.from(LOG_TABLE).insert({order_id:orderId,action,from_status:from||'',to_status:to||'',user_id:uid(),user_name:uname(),user_role:role(),note:note||''});}catch(e){} }
  async function saveAndSendOrderV289(){
    if(!window.sb)return msgx('Supabase غير متصل',true);
    const id=$('editIdV289')?.value;
    const patch=collectBase();
    if(!patch.project_name && !patch.project_id) return msgx('اختر المشروع',true);
    if(!patch.description) return msgx('اكتب تفاصيل الطلب',true);
    if(id){
      const old=cache.find(x=>String(x.id)===String(id));
      const {error}=await window.sb.from(ORDER_TABLE).update(patch).eq('id',id);
      if(error)return msgx(error.message,true); await addLog(id,'تعديل الطلب وإرساله للمالية',old?.status,'sent_finance','تم تعديل الطلب من التشغيل/الفني'); msgx('تم التحديث والإرسال للمالية');
    }else{
      patch.order_no=nextNo();
      const {data,error}=await window.sb.from(ORDER_TABLE).insert(patch).select('id').single();
      if(error)return msgx(error.message,true); await addLog(data.id,'إنشاء الطلب وإرساله للمالية','', 'sent_finance','تم إنشاء الطلب مع تحديد المبلغ'); msgx('تم حفظ الطلب وإرساله للمالية');
    }
    clearOrderV289(); await loadOrdersV289(true);
  }
  window.saveAndSendOrderV289=saveAndSendOrderV289;
  window.ordersV289PreviewCalc=function(){const gross=$('o_gross')?.value,cost=$('o_cost')?.value,c=calcGross(gross,cost); if($('o_vat'))$('o_vat').value=c.vat; if($('o_before'))$('o_before').value=c.before; if($('o_profit'))$('o_profit').value=c.profit;};
  window.ordersV289PreviewFinanceCalc=function(){const gross=$('f_amount')?.value,cost=$('f_cost')?.value,c=calcGross(gross,cost); if($('f_vat'))$('f_vat').value=c.vat; if($('f_before'))$('f_before').value=c.before; if($('f_profit'))$('f_profit').value=c.profit;};
  function clearOrderV289(){selectedId=null; ['editIdV289','o_no','o_group','o_date','o_sender','o_project','o_property','o_unit','o_client','o_phone','o_executor','o_details','o_notes','o_belongs','o_gross','o_cost','o_vat','o_before','o_profit','f_amount','f_cost','f_vat','f_before','f_profit','f_payment','f_invoice','f_billing','f_notes','m_exec_status','m_exec_date','m_report','m_exec_method'].forEach(id=>{const el=$(id); if(el) el.value='';}); if($('o_date'))$('o_date').value=today(); if($('o_sender'))$('o_sender').value=uname(); if($('formTitleV289'))$('formTitleV289').textContent='إنشاء طلب'; renderLogBox(null);}
  window.clearOrderV289=clearOrderV289;
  function setFormFromOrder(o){
    const r=orderToRow(o), ex=o.extra_data||{}; selectedId=o.id;
    const set=(id,v)=>{if($(id))$(id).value=v??''};
    set('editIdV289',o.id); set('o_no',r.no); set('o_group',r.group); set('o_date',ex.order_date||r.date); set('o_sender',r.sender); set('o_project',o.project_id||''); set('o_property',r.property); set('o_unit',r.unit); set('o_client',r.client); set('o_phone',r.phone); set('o_executor',r.executor); set('o_details',r.details); set('o_notes',ex.notes||r.notes); set('o_belongs',r.belongs); set('o_gross',r.gross); set('o_cost',r.cost); set('o_vat',r.vat); set('o_before',r.before); set('o_profit',r.profit);
    set('f_amount',o.approved_amount||r.gross); set('f_cost',r.cost); set('f_vat',r.vat); set('f_before',r.before); set('f_profit',r.profit); set('f_payment',r.payment||'تم السداد'); set('f_invoice',r.invoice); set('f_billing',r.billing||'تمت الفوترة'); set('f_notes',o.finance_notes||'');
    set('m_exec_status',r.execStatus||'تم التنفيذ'); set('m_exec_date',r.execDate||today()); set('m_report',r.report||'لم يصدر'); set('m_exec_method',r.execMethod||'');
    if($('formTitleV289'))$('formTitleV289').textContent='الأوردر '+r.no;
    renderLogBox(o.id);
  }
  window.editOrderV289=function(id){ const o=cache.find(x=>String(x.id)===String(id)); if(!o)return; if(active==='finance'){$('financeAreaV289').innerHTML=financeFieldsHtml();$('managerAreaV289').innerHTML='';} else if(active==='manager'){$('financeAreaV289').innerHTML=financeFieldsHtml();$('managerAreaV289').innerHTML=managerFieldsHtml();} setFormFromOrder(o); };
  function renderLogBox(id){ const box=$('logBoxV289'); if(!box)return; if(!id){box.classList.add('hidden');box.innerHTML='';return;} box.classList.remove('hidden'); const ls=logs.filter(l=>String(l.order_id)===String(id)); box.innerHTML='<h3>سجل الحركة</h3>'+(ls.map(l=>`<div class="logitem-v289"><b>${esc(l.action)}</b><br><span class="muted-v289">${esc(l.user_name||'')} - ${esc(String(l.created_at||'').slice(0,16).replace('T',' '))}</span><br>${esc(l.note||'')}</div>`).join('')||'<div class="muted-v289">لا يوجد سجل بعد</div>');}
  async function financeApproveV289(){
    if(!selectedId)return msgx('اختر أوردر أولاً',true); const amount=n($('f_amount')?.value), cost=n($('f_cost')?.value), c=calcGross(amount,cost); const old=cache.find(x=>String(x.id)===String(selectedId));
    const ex=Object.assign({},old?.extra_data||{},{payment_status:$('f_payment')?.value||'',system_billing_status:$('f_billing')?.value||'',cost_amount:cost,tax_amount:c.vat,price_before_tax:c.before,profit_amount:c.profit});
    const patch={approved_amount:amount,cost_amount:cost,tax_amount:c.vat,price_before_tax:c.before,profit_amount:c.profit,billing_status:$('f_payment')?.value||'',invoice_no:$('f_invoice')?.value||'',finance_notes:$('f_notes')?.value||'',extra_data:ex,status:'finance_approved',current_stage:'manager',finance_approved_at:now()};
    const {error}=await window.sb.from(ORDER_TABLE).update(patch).eq('id',selectedId); if(error)return msgx(error.message,true); await addLog(selectedId,'اعتماد المالية وإصدار الفاتورة',old?.status,'finance_approved','رقم الفاتورة: '+($('f_invoice')?.value||'')); msgx('تم اعتماد المالية وإرسال الطلب لمدير النظام'); clearOrderV289(); await loadOrdersV289(true);
  }
  window.financeApproveV289=financeApproveV289;
  async function managerCloseV289(){
    if(!selectedId)return msgx('اختر أوردر أولاً',true); const old=cache.find(x=>String(x.id)===String(selectedId)); const ex=Object.assign({},old?.extra_data||{},{execution_status:$('m_exec_status')?.value||'تم التنفيذ',execution_date:$('m_exec_date')?.value||today(),execution_method:$('m_exec_method')?.value||'',report_status:$('m_report')?.value||'لم يصدر'});
    const patch={status:'closed',current_stage:'closed',execution_notes:$('m_exec_method')?.value||'',extra_data:ex,closed_at:now(),executed_at:now()}; const {error}=await window.sb.from(ORDER_TABLE).update(patch).eq('id',selectedId); if(error)return msgx(error.message,true); await addLog(selectedId,'اعتماد مدير النظام وإغلاق الطلب',old?.status,'closed','تم الاعتماد والإغلاق'); msgx('تم الإغلاق'); clearOrderV289(); await loadOrdersV289(true);
  }
  window.managerCloseV289=managerCloseV289;
  async function managerReturnFinanceV289(){ if(!selectedId)return msgx('اختر أوردر أولاً',true); const note=prompt('سبب الإرجاع للمالية:')||''; const old=cache.find(x=>String(x.id)===String(selectedId)); const {error}=await window.sb.from(ORDER_TABLE).update({status:'sent_finance',current_stage:'finance'}).eq('id',selectedId); if(error)return msgx(error.message,true); await addLog(selectedId,'إرجاع للمالية',old?.status,'sent_finance',note); clearOrderV289(); await loadOrdersV289(true); }
  window.managerReturnFinanceV289=managerReturnFinanceV289;
  async function rejectOrderV289(){ if(!selectedId)return msgx('اختر أوردر أولاً',true); const note=prompt('سبب الرفض:')||''; if(!note)return; const old=cache.find(x=>String(x.id)===String(selectedId)); const {error}=await window.sb.from(ORDER_TABLE).update({status:'rejected',current_stage:'closed',rejection_reason:note}).eq('id',selectedId); if(error)return msgx(error.message,true); await addLog(selectedId,'رفض الطلب',old?.status,'rejected',note); clearOrderV289(); await loadOrdersV289(true); }
  window.rejectOrderV289=rejectOrderV289;
  async function deleteOrderV289(id){ if(!canAdmin())return; if(!confirm('حذف الأوردر نهائيًا؟'))return; const {error}=await window.sb.from(ORDER_TABLE).delete().eq('id',id); if(error)return msgx(error.message,true); msgx('تم الحذف'); await loadOrdersV289(true); }
  window.deleteOrderV289=deleteOrderV289;
  function exportOrdersV289(){ const rows=rowsForActive(); const hs=headers().filter(h=>h!=='إجراء'); const xmlRows=rows.map(r=>[r.no,r.group,r.date,r.sender,r.project,r.property,r.unit,r.client,r.phone,r.executor,r.details,r.notes,r.belongs,r.execStatus,r.report,r.gross,r.vat,r.before,r.cost,r.profit,r.payment,r.invoice,r.billing,stageLabel(r)]); const xml=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Orders"><Table><Row>${hs.map(h=>`<Cell><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('')}</Row>${xmlRows.map(r=>`<Row>${r.map(c=>`<Cell><Data ss:Type="String">${esc(c??'')}</Data></Cell>`).join('')}</Row>`).join('')}</Table></Worksheet></Workbook>`; const blob=new Blob(['\ufeff'+xml],{type:'application/vnd.ms-excel'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='tasneef_orders_'+active+'.xls'; a.click(); URL.revokeObjectURL(a.href); }
  window.exportOrdersV289=exportOrdersV289;
  function setupMode(){
    if(active==='finance'){$('financeAreaV289').innerHTML=financeFieldsHtml();$('managerAreaV289').innerHTML='';$('formActionsV289')&&( $('formActionsV289').innerHTML='<button class="light" onclick="clearOrderV289()">تفريغ</button>' );}
    else if(active==='manager'){$('financeAreaV289').innerHTML=financeFieldsHtml();$('managerAreaV289').innerHTML=managerFieldsHtml();$('formActionsV289')&&( $('formActionsV289').innerHTML='<button class="light" onclick="clearOrderV289()">تفريغ</button>' );}
    else {$('financeAreaV289')&&($('financeAreaV289').innerHTML='');$('managerAreaV289')&&($('managerAreaV289').innerHTML='');$('formActionsV289')&&( $('formActionsV289').innerHTML='<button onclick="saveAndSendOrderV289()">حفظ وإرسال للمالية</button><button class="light" onclick="clearOrderV289()">جديد</button>' );}
    clearOrderV289(); fillProjects();
  }
  window.setOrdersStageV289=function(k){ active=k; setupMode(); renderOrdersV289(); };
  function injectAdmin(){ const sec=$('orders'); if(!sec||sec.dataset.v289==='1')return; sec.dataset.v289='1'; sec.innerHTML=adminHtml(); setupMode(); loadOrdersV289(false); }
  function injectSupervisor(){
    const nav=document.querySelector('.sup-tabs'); if(nav&&!$('supOrdersBtnV289')){ const btn=document.createElement('button'); btn.id='supOrdersBtnV289'; btn.className='sup-tab'; btn.textContent='الأوردرات'; btn.onclick=function(){showSupervisorWindow('supOrders',this);setTimeout(()=>{active='create';loadOrdersV289(true)},60)}; nav.appendChild(btn); }
    const root=document.querySelector('.mobile-shell')||document.querySelector('.app-shell')||document.body; if(!$('supOrders')){ const sec=document.createElement('section'); sec.id='supOrders'; sec.className='sup-page card'; sec.innerHTML=compactHtml('supervisor'); const pages=document.querySelector('#supSummary')?.parentElement||document.querySelector('.mobile-shell')||document.body; pages.appendChild(sec); active='create'; fillProjects(); clearOrderV289(); }
  }
  function injectTechnician(){
    if($('techOrdersV289'))return; const shell=document.querySelector('.tech-shell')||document.body; const sec=document.createElement('section'); sec.id='techOrdersV289'; sec.innerHTML=compactHtml('technician'); shell.insertBefore(sec, shell.children[2]||null); active='create'; fillProjects(); clearOrderV289(); loadOrdersV289(false);
  }
  const oldShow=window.showPage; window.showPage=function(id,btn){ if(typeof oldShow==='function')oldShow(id,btn); if(id==='orders')setTimeout(injectAdmin,60); };
  const oldSup=window.showSupervisorWindow; window.showSupervisorWindow=function(id,btn){ if(typeof oldSup==='function')oldSup(id,btn); if(id==='supOrders')setTimeout(()=>loadOrdersV289(false),60); };
  const oldTech=window.initTechnician; if(typeof oldTech==='function'){ window.initTechnician=async function(){ await oldTech.apply(this,arguments); setTimeout(injectTechnician,500); }; }
  document.addEventListener('DOMContentLoaded',function(){ ensureBadge(); ensureStyle(); setTimeout(()=>{ if($('orders'))injectAdmin(); if(document.querySelector('.sup-tabs'))injectSupervisor(); if(document.querySelector('.tech-shell'))injectTechnician(); },1000); });
})();

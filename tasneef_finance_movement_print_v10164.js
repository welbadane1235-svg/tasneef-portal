/* Tasneef v10158 - Finance movement filters + product edit price + correct print selection
   Scope: المالية والمخزون فقط.
   - تبويب حركة المخزون: فلتر المشرفين + فلتر التاريخ.
   - اسم المنتج في الحركات يُقرأ من جدول المنتجات الرسمي، لذلك إذا تغير اسم المنتج يظهر الاسم الجديد في الحركات القديمة بدون إنشاء حركة جديدة.
*/
(function(){
  'use strict';
  if(window.__tasneefFinanceMovementFiltersSyncV10163) return;
  window.__tasneefFinanceMovementFiltersSyncV10163 = true;

  const VERSION='v10164-finance-voucher-invoice-project-current-audit';
  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const N=v=>Number(v||0)||0;
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=v=>`${N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س`;
  const client=()=>window.sb||window.supabaseClient||window.supabase||null;
  const state=()=>window.financeProStateV15||{};
  const VAT=0.15;
  const filters={supervisor:'', dateFrom:'', dateTo:'', type:''};
  let syncing=false;
  let didAutoSync=false;

  function safeJson(v){
    const t=S(v);
    if(!t.startsWith('finance_pro_v15:')) return {};
    try{return JSON.parse(t.replace('finance_pro_v15:',''))||{};}catch(_){return{};}
  }
  function itemCode(i){return S(i&&(i.product_code||i.serial_number||i.barcode||i.supplier_barcode||i.code));}
  function itemCost(i){return N(i&&(i.unit_cost||i.cost||i.price||i.purchase_price));}
  function movementDate(m){return S(m&&(m.movement_date||m.date||m.created_at)).slice(0,10);}
  function movementTypeLabel(t){return ({in:'داخل',out:'صرف',consume:'استهلاك',waste:'هدر',damaged:'تالف',scrap:'سكراب',return:'مرتجع'})[S(t)]||S(t)||'-';}
  function movementOutTypes(){return ['out','consume','waste','damaged','scrap'];}
  function productKeys(obj){
    const keys=[];
    [obj&&obj.id,obj&&obj.item_id,obj&&obj.product_code,obj&&obj.serial_number,obj&&obj.barcode,obj&&obj.supplier_barcode,obj&&obj.code,obj&&obj.name,obj&&obj.item_name].forEach(v=>{
      const x=S(v).toLowerCase();
      if(x&&!keys.includes(x)) keys.push(x);
    });
    return keys;
  }
  function officialItemForMovement(m){
    const st=state();
    const keys=productKeys(m);
    return A(st.items).find(i=>productKeys(i).some(k=>keys.includes(k)))||null;
  }
  function officialProductName(m){
    const it=officialItemForMovement(m);
    return S(it&&(it.name||it.item_name)) || S(m&&m.item_name) || S(m&&m.product_name) || S(m&&m.product_code) || '-';
  }
  function projectName(id){
    const st=state();
    const p=A(st.projects).find(x=>String(x.id)===String(id));
    return S(p&&(p.name||p.project_name))||'';
  }
  function staffName(id){
    const st=state();
    const u=A(st.users).find(x=>String(x.id)===String(id));
    return S(u&&(u.full_name||u.name||u.username))||S(id);
  }
  function movementUnitCost(m){
    const meta=safeJson(m&&m.notes)||{};
    if(N(m&&m.unit_cost)>0) return N(m.unit_cost);
    if(N(meta.beforeVat)>0&&N(m&&m.quantity)>0) return N(meta.beforeVat)/N(m.quantity);
    const it=officialItemForMovement(m);
    return it?itemCost(it):0;
  }
  function movementNet(m){
    const meta=safeJson(m&&m.notes)||{};
    if(N(meta.beforeVat)>0) return N(meta.beforeVat);
    return N(m&&m.quantity)*movementUnitCost(m);
  }
  function movementDistributionRows(m){
    const meta=safeJson(m&&m.notes)||{};
    const rows=A(meta.distribution);
    if(!rows.length) return [{...m,parent_id:m.id,distribution_index:null,base_movement_type:S(m.movement_type),distribution_note:'',order_no:S(m&&m.order_no||''),project_name:S(m&&m.project_name||'')}];
    return rows.map((d,idx)=>({
      ...m,
      parent_id:m.id,
      distribution_index:idx,
      is_distribution_row:true,
      base_movement_type:S(m.movement_type),
      movement_type:S(d.type||m.movement_type)||S(m.movement_type),
      quantity:N(d.qty),
      center:S(d.center||m.cost_center),
      project_id:d.projectId||m.project_id||null,
      project_name:S(d.projectName||projectName(d.projectId)||m.project_name||''),
      order_no:S(d.orderNo||m.order_no||''),
      distribution_note:S(d.note||'')
    })).filter(r=>N(r.quantity)>0);
  }
  function movementStaffId(m){return S(safeJson(m&&m.notes).staffId || m.staff_id || m.supervisor_id || m.user_id || m.created_by || '');}
  function movementStaffName(m){
    const id=movementStaffId(m);
    return S(m&&m.receiver) || (id?staffName(id):'') || '-';
  }
  function supervisorOptions(){
    const st=state();
    const map=new Map();
    const add=(value,name)=>{
      name=S(name); value=S(value)||name; if(!name) return;
      const key=name.replace(/\s+/g,' ').trim().toLowerCase();
      if(!map.has(key)) map.set(key,[value,name]);
    };
    A(st.users).forEach(u=>{
      const name=S(u.full_name||u.name||u.username);
      if(!name) return;
      const role=S(u.role||u.user_role||u.type).toLowerCase();
      if(/supervisor|مشرف|admin|manager|مدير/.test(role) || A(st.movements).some(m=>S(m.receiver)===name || movementStaffId(m)===S(u.id))){
        add(S(u.id)||name, name);
      }
    });
    A(st.movements).forEach(m=>{ add(S(m.receiver), S(m.receiver)); });
    return [...map.values()].sort((a,b)=>a[1].localeCompare(b[1],'ar'));
  }
  function movementMatchesSupervisor(m, value){
    if(!value) return true;
    const st=state();
    const mvId=movementStaffId(m);
    const rec=S(m.receiver);
    const u=A(st.users).find(x=>String(x.id)===String(value));
    const names=[value, u&&u.full_name, u&&u.name, u&&u.username].map(S).filter(Boolean);
    if(mvId && String(mvId)===String(value)) return true;
    return names.some(n=>rec===n || rec.includes(n) || n.includes(rec));
  }
  function passesFilters(row){
    const d=movementDate(row);
    if(filters.dateFrom && d && d<filters.dateFrom) return false;
    if(filters.dateTo && d && d>filters.dateTo) return false;
    if(filters.supervisor && !movementMatchesSupervisor(row, filters.supervisor)) return false;
    if(filters.type && S(row.movement_type)!==filters.type) return false;
    return true;
  }
  function currentMovementRows(){
    return A(state().movements).flatMap(movementDistributionRows).filter(passesFilters)
      .sort((a,b)=>S(movementDate(b)||b.created_at).localeCompare(S(movementDate(a)||a.created_at)) || N(b.id)-N(a.id));
  }

  function rowKey(r){
    return [r.parent_id||r.id||'', r.distribution_index==null?'main':r.distribution_index, S(r.movement_type), S(r.project_id||''), S(r.order_no||''), N(r.quantity)].join('|');
  }
  function selectedRows(){
    const checked=[...document.querySelectorAll('.fm10156-select-row:checked')].map(x=>S(x.value));
    if(!checked.length) return [];
    const map=window.__fm10158SelectedRowsMap instanceof Map ? window.__fm10158SelectedRowsMap : null;
    if(map){
      return checked.map(k=>map.get(k)).filter(Boolean);
    }
    const set=new Set(checked);
    return currentMovementRows().filter(r=>set.has(rowKey(r)));
  }
  function voucherTitle(rows){
    const types=[...new Set(A(rows).map(r=>S(r.movement_type)).filter(Boolean))];
    if(types.length===1){
      return ({out:'سند صرف مخزون',consume:'سند استهلاك مخزون',damaged:'سند تالف مخزون',waste:'سند هدر مخزون',scrap:'سند سكراب مخزون',return:'سند مرتجع مخزون',in:'سند إدخال مخزون'})[types[0]] || 'سند حركة مخزون';
    }
    return 'سند حركة مخزون';
  }

  function distributorCode(item,m){
    return S(item&&(item.supplier_barcode||item.supplier_code||item.distributor_code||item.vendor_code||item.external_code)) || S(m&&(m.supplier_barcode||m.supplier_code||m.vendor_code||m.external_code)) || '-';
  }
  function internalCode(item,m){
    return S(itemCode(item)) || S(m&&(m.product_code||m.barcode||m.code)) || '-';
  }
  function productTypeLabel(item,m){
    const raw=S(item&&(item.item_type||item.type||item.category)) || S(m&&(m.item_type||m.type||m.category)) || 'مادة';
    const low=raw.toLowerCase();
    if(['tool','tools'].includes(low)||['عدة','معدات','أداة','اداة','مكينة'].includes(raw)) return raw==='مكينة'?'مكينة':'أداة';
    if(['material','materials'].includes(low)||['مادة','مواد'].includes(raw)) return 'مادة';
    return raw;
  }
  function supplierNameForRows(rows){
    const vals=[];
    A(rows).forEach(r=>{
      const item=officialItemForMovement(r)||{};
      const meta=safeJson(r&&r.notes)||{};
      [r&&r.supplier_name,r&&r.supplier,r&&r.vendor_name,r&&r.vendor,meta.supplierName,meta.supplier,item&&item.supplier_name,item&&item.supplier,item&&item.vendor_name,item&&item.vendor].forEach(v=>{
        const x=S(v); if(x && x!=='-' && !vals.includes(x)) vals.push(x);
      });
    });
    return vals.join(' / ') || 'المورد';
  }
  function systemOperationNo(rows){
    const ids=[];
    A(rows).forEach(r=>{
      const v=S(r&&r.parent_id || r&&r.id || r&&r.movement_id || '');
      if(v && !ids.includes(v)) ids.push(v);
    });
    if(!ids.length) return '-';
    return ids.length===1 ? ids[0] : ids.slice(0,6).join(' / ') + (ids.length>6 ? ' +' + (ids.length-6) : '');
  }
  function isInputVoucher(rows){
    const types=[...new Set(A(rows).map(r=>S(r.movement_type)).filter(Boolean))];
    return types.length===1 && types[0]==='in';
  }

  function isProjectUseVoucher(rows){
    const useTypes=['consume','damaged','waste','scrap'];
    const types=[...new Set(A(rows).map(r=>S(r.movement_type)).filter(Boolean))];
    return types.length>0 && types.every(t=>useTypes.includes(t));
  }
  function firstValue(){
    for(const v of arguments){ const x=S(v); if(x && x!=='-' && x!=='null' && x!=='undefined') return x; }
    return '';
  }
  function invoiceSystemNo(rows){
    const vals=[];
    A(rows).forEach(r=>{
      const meta=safeJson(r&&r.notes)||{};
      const v=firstValue(
        r&&r.system_invoice_number, r&&r.system_invoice_no,
        r&&r.invoice_number, r&&r.invoice_no, r&&r.invoice_id,
        r&&r.bill_number, r&&r.bill_no, r&&r.purchase_invoice_no,
        r&&r.supplier_invoice_no, r&&r.receipt_no, r&&r.operation_no,
        meta.systemInvoiceNumber, meta.systemInvoiceNo, meta.invoiceNumber, meta.invoiceNo,
        meta.invoice_id, meta.invoiceId, meta.billNumber, meta.billNo, meta.purchaseInvoiceNo,
        meta.supplierInvoiceNo, meta.receiptNo, meta.operationNo
      );
      if(v && !vals.includes(v)) vals.push(v);
    });
    return vals.length ? (vals.length===1 ? vals[0] : vals.slice(0,6).join(' / ') + (vals.length>6 ? ' +' + (vals.length-6) : '')) : '-';
  }
  function currentQtyForItem(item,m){
    const explicit=[item&&item.current_quantity,item&&item.available_quantity,item&&item.available_qty,item&&item.stock_quantity,item&&item.stock,item&&item.balance,item&&item.quantity];
    for(const v of explicit){ if(v!==undefined && v!==null && S(v)!=='') return N(v); }
    const st=state();
    const keys=productKeys(item).concat(productKeys(m));
    let total=0;
    A(st.movements).forEach(x=>{
      if(!productKeys(x).some(k=>keys.includes(k))) return;
      const t=S(x.movement_type);
      const q=N(x.quantity);
      if(t==='in'||t==='return') total+=q;
      else if(['out','consume','waste','damaged','scrap'].includes(t)) total-=q;
    });
    return total;
  }
  function projectNameForMovement(r){
    return S(r&&r.project_name)||projectName(r&&r.project_id)||S(r&&r.center)||'-';
  }
  function userDisplayName(id){
    const st=state();
    const u=A(st.users).find(x=>String(x.id)===String(id));
    return S(u&&(u.full_name||u.name||u.username||u.email))||S(id)||'';
  }
  function movementAuditValue(m,kind){
    const meta=safeJson(m&&m.notes)||{};
    if(kind==='created'){
      return firstValue(m&&m.created_by_name,m&&m.creator_name,m&&m.added_by_name,meta.createdByName,meta.creatorName,meta.addedByName,userDisplayName(m&&m.created_by),userDisplayName(m&&m.user_id),userDisplayName(meta.createdBy),userDisplayName(meta.userId));
    }
    return firstValue(m&&m.updated_by_name,m&&m.modified_by_name,m&&m.edited_by_name,meta.updatedByName,meta.modifiedByName,meta.editedByName,userDisplayName(m&&m.updated_by),userDisplayName(m&&m.modified_by),userDisplayName(meta.updatedBy),userDisplayName(meta.modifiedBy));
  }
  function movementAuditDate(m,kind){
    const meta=safeJson(m&&m.notes)||{};
    return kind==='created' ? firstValue(m&&m.created_at,meta.createdAt) : firstValue(m&&m.updated_at,m&&m.modified_at,meta.updatedAt,meta.modifiedAt);
  }

  function printDateLabel(rows){
    const dates=[...new Set(A(rows).map(r=>movementDate(r)).filter(Boolean))];
    if(dates.length===1) return dates[0];
    if(filters.dateFrom||filters.dateTo) return `${filters.dateFrom||'البداية'} إلى ${filters.dateTo||'النهاية'}`;
    return 'حسب الفلتر / متعدد';
  }

  function printRows(selectedOnly){
    const rows=selectedOnly?selectedRows():currentMovementRows();
    if(!rows.length){ alert(selectedOnly?'اختر حركة واحدة على الأقل للطباعة':'لا توجد حركات حسب الفلاتر للطباعة'); return; }
    const title=voucherTitle(rows).replace(' مخزون','');
    const now=new Date().toLocaleString('ar-SA');
    const totalQty=rows.reduce((a,r)=>a+N(r.quantity),0);
    const totalNet=rows.reduce((a,r)=>a+movementNet(r),0);
    const totalTax=rows.reduce((a,r)=>a+(movementNet(r)*VAT),0);
    const totalGross=totalNet+totalTax;
    const isIn=isInputVoucher(rows);
    const needsProjectCurrent=isProjectUseVoucher(rows);
    const supervisor=filters.supervisor ? ((supervisorOptions().find(([v])=>v===filters.supervisor)||[])[1] || filters.supervisor) : ([...new Set(rows.map(r=>movementStaffName(r)).filter(Boolean))].join(' / ')||'الكل');
    const supplier=isIn ? supplierNameForRows(rows) : supervisor;
    const invoiceNo=invoiceSystemNo(rows);
    const operationDate=printDateLabel(rows);
    const logoUrl=new URL('tasneef_logo_print.png', window.location.href).href;
    const bodyRows=rows.map((r,idx)=>{
      const item=officialItemForMovement(r)||{};
      const qty=N(r.quantity);
      const net=movementNet(r);
      const unit=movementUnitCost(r);
      const tax=net*VAT;
      const gross=net+tax;
      return `<tr>
        <td>${idx+1}</td>
        <td>${esc(movementDate(r)||'-')}</td>
        <td>${esc(internalCode(item,r))}</td>
        <td class="prod">${esc(officialProductName(r))}</td>
        ${needsProjectCurrent?`<td>${esc(projectNameForMovement(r))}</td><td>${N(currentQtyForItem(item,r))}</td>`:''}
        <td>${esc(productTypeLabel(item,r))}</td>
        <td>${esc(distributorCode(item,r))}</td>
        <td>${qty}</td>
        <td>${money(unit)}</td>
        <td>${money(net)}</td>
        <td>${money(tax)}</td>
        <td>${money(gross)}</td>
      </tr>`;
    }).join('');
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      @page{size:A4 landscape;margin:10mm}
      *{box-sizing:border-box}
      body{font-family:Tahoma,Arial,sans-serif;margin:0;background:#fff;color:#14342d;font-size:11.5px}
      .page{padding:8px 10px}
      .topbar{display:grid;grid-template-columns:1.1fr 1fr 1.1fr;align-items:center;gap:14px;border-bottom:4px solid #183e35;padding-bottom:10px;margin-bottom:14px}
      .top-right{text-align:right}
      .company{font-size:20px;font-weight:900;color:#183e35;margin-bottom:6px}
      .title{font-size:26px;font-weight:900;text-align:center;color:#183e35;letter-spacing:.3px}
      .top-left{text-align:left;font-weight:700;color:#3e4e4a}
      .top-left b{display:block;color:#111;font-size:18px;margin-top:4px}
      .logo-wrap{display:flex;align-items:center;justify-content:flex-end;gap:12px}
      .logo-box{width:92px;height:64px;border:1px solid #d7e2de;border-radius:16px;display:grid;place-items:center;background:#fff;padding:8px;overflow:hidden}
      .logo-box img{max-width:100%;max-height:100%;object-fit:contain;display:block}
      .meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-bottom:12px}
      .stat{border:1px solid #d9e3e0;border-radius:16px;padding:10px 12px;background:linear-gradient(180deg,#fff,#f8fbfa)}
      .stat small{display:block;color:#6f7f7b;font-weight:700;margin-bottom:5px}
      .stat b{font-size:17px;color:#173d34}
      .table-wrap{border:1px solid #dbe4e1;border-radius:18px;overflow:hidden}
      table{width:100%;border-collapse:collapse}
      th,td{padding:9px 7px;border-bottom:1px solid #ebf0ee;text-align:center;vertical-align:middle}
      th{background:#184237;color:#fff;font-size:13px;font-weight:900}
      tbody tr:nth-child(even){background:#fbfcfc}
      tbody td.prod{text-align:right;font-weight:700}
      tfoot td{background:#eef5f2;font-weight:900}
      .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px}
      .summary .box{border:2px solid #d5e3de;border-radius:18px;padding:14px;background:#fcfffe;text-align:center}
      .summary .box small{display:block;color:#61756f;font-size:13px;font-weight:700;margin-bottom:6px}
      .summary .box b{font-size:21px;color:#173d34}
      .signs{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:28px}
      .sign{min-height:70px;padding-top:38px;border-top:3px solid #253f39;text-align:center;font-weight:800;color:#1d3630}
      .footline{margin-top:8px;text-align:center;color:#8a9894;font-size:10px}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body><div class="page">
      <div class="topbar">
        <div class="top-right"><div class="company">شركة تصنيف لإدارة المرافق</div><div style="font-size:12px;color:#677773">${isIn?'مستند إدخال مخزني معتمد':'مستند صرف مخزني معتمد'}</div></div>
        <div class="title">${esc(title)}</div>
        <div class="top-left">تاريخ الطباعة<b>${esc(now)}</b></div>
      </div>
      <div class="logo-wrap" style="margin-bottom:12px;justify-content:space-between">
        <div class="meta" style="flex:1;margin:0 0 0 12px">
          <div class="stat"><small>عدد الحركات</small><b>${rows.length}</b></div>
          <div class="stat"><small>${isIn?'المورد':'المشرف'}</small><b>${esc(isIn?supplier:supervisor)}</b></div>
          <div class="stat"><small>تاريخ يوم العملية</small><b>${esc(operationDate)}</b></div>
          ${isIn?`<div class="stat"><small>رقم فاتورة النظام</small><b>${esc(invoiceNo)}</b></div>`:''}
        </div>
        <div class="logo-box"><img src="${esc(logoUrl)}" alt="شعار تطبيق تصنيف"></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>التاريخ</th>
              <th>الكود الداخلي</th>
              <th>المنتج</th>
              ${needsProjectCurrent?'<th>اسم المشروع</th><th>الكمية الحالية</th>':''}
              <th>نوع المنتج</th>
              <th>كود الموزع</th>
              <th>الكمية</th>
              <th>سعر الحبة</th>
              <th>المجموع قبل الضريبة</th>
              <th>الضريبة</th>
              <th>المجموع بعد الضريبة</th>
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="${needsProjectCurrent?8:6}">الإجمالي</td>
              <td>${N(totalQty)}</td>
              <td></td>
              <td>${money(totalNet)}</td>
              <td>${money(totalTax)}</td>
              <td>${money(totalGross)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="signs">
        <div class="sign">${isIn?'المحاسب':'المستلم'}</div>
        <div class="sign">مسؤول المخزن</div>
        <div class="sign">اعتماد الإدارة</div>
      </div>
      <div class="footline">Tasneef Inventory Voucher</div>
    </div><script>window.onload=function(){setTimeout(function(){window.print()},250)}</script></body></html>`;
    const w=window.open('','_blank');
    if(!w){ alert('المتصفح منع فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }
  window.financeProPrintSelectedMovementsV10156=function(){printRows(true);};
  window.financeProPrintFilteredMovementsV10156=function(){printRows(false);};
  function syncMovementNamesInMemory(){
    const st=state();
    A(st.movements).forEach(m=>{
      const name=officialProductName(m);
      if(name && name!=='-' && S(m.item_name)!==name){ m.item_name=name; }
    });
  }
  async function syncMovementNamesToDb(force){
    if(syncing) return;
    const st=state();
    if(!force && didAutoSync) return;
    const c=client();
    if(!c||!c.from||!A(st.movements).length||!A(st.items).length) return;
    const mismatches=new Map();
    A(st.movements).forEach(m=>{
      const it=officialItemForMovement(m);
      const name=S(it&&(it.name||it.item_name));
      if(!it||!name||S(m.item_name)===name) return;
      const key=S(it.id||itemCode(it)||name);
      if(key) mismatches.set(key,{item:it,name});
    });
    if(!mismatches.size) { didAutoSync=true; return; }
    syncing=true;
    try{
      let count=0;
      for(const {item,name} of mismatches.values()){
        if(count>=60) break;
        if(S(item.id)){
          const r=await c.from('inventory_movements').update({item_name:name}).eq('item_id',item.id);
          if(r.error) console.warn('v10155 sync item_id failed', r.error.message||r.error);
          count++;
        }
        const code=itemCode(item);
        if(code){
          const r2=await c.from('inventory_movements').update({item_name:name}).eq('product_code',code);
          if(r2.error) console.warn('v10155 sync product_code failed', r2.error.message||r2.error);
        }
      }
      didAutoSync=true;
      syncMovementNamesInMemory();
    }catch(e){ console.warn('v10155 sync names failed', e); }
    finally{ syncing=false; }
  }

  function renderEnhancedMovementList(){
    const box=$('finMovementListV10155');
    if(!box) return;
    syncMovementNamesInMemory();
    const rows=currentMovementRows();
    const st=state();
    const totalQty=rows.reduce((a,r)=>a+N(r.quantity),0);
    const totalNet=rows.reduce((a,r)=>a+movementNet(r),0);
    const types=[['','كل الحركات'],['in','داخل'],['out','صرف'],['consume','استهلاك'],['damaged','تالف'],['waste','هدر'],['scrap','سكراب'],['return','مرتجع']];
    const supOpts=supervisorOptions();
    const filterHtml=`<div class="fin-card fm10155-filter-card"><h3>حركة المخزون</h3><div class="fin-actions fm10155-filters">
      <div><label>المشرفين</label><select id="fm10155Supervisor"><option value="">كل المشرفين</option>${supOpts.map(([v,n])=>`<option value="${esc(v)}" ${filters.supervisor===v?'selected':''}>${esc(n)}</option>`).join('')}</select></div>
      <div><label>من تاريخ</label><input id="fm10155DateFrom" type="date" value="${esc(filters.dateFrom)}"></div>
      <div><label>إلى تاريخ</label><input id="fm10155DateTo" type="date" value="${esc(filters.dateTo)}"></div>
      <div><label>نوع الحركة</label><select id="fm10155Type">${types.map(([v,n])=>`<option value="${esc(v)}" ${filters.type===v?'selected':''}>${esc(n)}</option>`).join('')}</select></div>
      <button class="light" type="button" id="fm10155ClearFilters">تفريغ الفلاتر</button>
      <button class="light" type="button" id="fm10155SyncNames">مزامنة أسماء المنتجات</button>
      <button class="light" type="button" id="fm10156PrintSelected">طباعة المحدد</button>
      <button type="button" id="fm10156PrintFiltered">طباعة حسب الفلاتر</button>
    </div><div class="fin-grid three" style="margin-top:10px"><div class="fin-soft">عدد الحركات: <b>${rows.length}</b></div><div class="fin-soft">إجمالي الكمية: <b>${totalQty}</b></div><div class="fin-soft">القيمة قبل الضريبة: <b>${money(totalNet)}</b></div></div></div>`;
    window.__fm10158SelectedRowsMap=new Map();
    const tableHtml=`<div class="fin-card"><h3>سجل حركة المخزون حسب الفلاتر</h3><div class="fin-table"><table><thead><tr><th><input type="checkbox" id="fm10156SelectAll"></th><th>التاريخ</th><th>المنتج</th><th>الكود</th><th>نوع الحركة</th><th>الكمية</th><th>المشرف / المستلم</th><th>المشروع</th><th>الأوردر</th><th>القيمة</th><th>إجراء</th></tr></thead><tbody>${rows.map((r,idx)=>{
      const selectKey='r'+idx;
      window.__fm10158SelectedRowsMap.set(selectKey,r);
      const parent=r.parent_id||r.id;
      const item=officialItemForMovement(r)||{};
      const productName=officialProductName(r);
      const project=S(r.project_name)||projectName(r.project_id)||'-';
      return `<tr data-fm10155-row="1" data-id="${esc(parent)}"><td><input type="checkbox" class="fm10156-select-row" value="${esc(selectKey)}"></td><td>${esc(movementDate(r)||'-')}</td><td><b>${esc(productName)}</b></td><td>${esc(itemCode(item)||r.product_code||r.barcode||'-')}</td><td><span class="fin-badge ${movementOutTypes().includes(S(r.movement_type))?'warn':S(r.movement_type)==='return'?'neutral':''}">${esc(movementTypeLabel(r.movement_type))}</span></td><td>${N(r.quantity)}</td><td>${esc(movementStaffName(r))}</td><td>${esc(project)}</td><td>${esc(r.order_no||'-')}</td><td>${money(movementNet(r))}</td><td class="fin-actions"><button class="light" onclick="financeProShowMovementV15(${Number(parent)||0})">عرض</button><button onclick="financeProEditMovementV15(${Number(parent)||0})">تعديل</button>${(typeof window.financeProDeleteMovementV15==='function')?`<button class="danger" onclick="financeProDeleteMovementV15(${Number(parent)||0})">حذف</button>`:''}</td></tr>`;
    }).join('')||'<tr><td colspan="11">لا توجد حركات حسب الفلاتر.</td></tr>'}</tbody></table></div></div>`;
    box.innerHTML=filterHtml+tableHtml;
    bindFilters();
  }
  function bindFilters(){
    const sup=$('fm10155Supervisor'), from=$('fm10155DateFrom'), to=$('fm10155DateTo'), type=$('fm10155Type');
    if(sup) sup.onchange=()=>{filters.supervisor=S(sup.value); renderEnhancedMovementList();};
    if(from) from.onchange=()=>{filters.dateFrom=S(from.value); renderEnhancedMovementList();};
    if(to) to.onchange=()=>{filters.dateTo=S(to.value); renderEnhancedMovementList();};
    if(type) type.onchange=()=>{filters.type=S(type.value); renderEnhancedMovementList();};
    const clear=$('fm10155ClearFilters'); if(clear) clear.onclick=()=>{filters.supervisor='';filters.dateFrom='';filters.dateTo='';filters.type='';renderEnhancedMovementList();};
    const sync=$('fm10155SyncNames'); if(sync) sync.onclick=async()=>{sync.disabled=true; sync.textContent='جاري المزامنة...'; await syncMovementNamesToDb(true); if(typeof window.financeProLoadV15==='function') await window.financeProLoadV15(true); setTimeout(()=>{sync.disabled=false;sync.textContent='مزامنة أسماء المنتجات'; enhanceMovementTab();},400);};
    const ps=$('fm10156PrintSelected'); if(ps) ps.onclick=()=>printRows(true);
    const pf=$('fm10156PrintFiltered'); if(pf) pf.onclick=()=>printRows(false);
    const all=$('fm10156SelectAll'); if(all) all.onchange=()=>{document.querySelectorAll('.fm10156-select-row').forEach(x=>{x.checked=all.checked;});};
  }
  function hideCoreMovementLists(body, formCard){
    A([...body.querySelectorAll(':scope > .fin-card')]).forEach(card=>{
      if(card===formCard) return;
      if(card.id==='fm10155Host') return;
      const txt=S(card.textContent);
      if(card.querySelector('.fin-table') && /حركة|الحركات|المخزون|سجل/.test(txt)) card.style.display='none';
    });
  }
  function enhanceMovementTab(){
    const st=state();
    if(!st || st.tab!=='movement') return;
    const body=$('finBodyV15'); if(!body) return;
    syncMovementNamesInMemory();
    const formCard=$('finMoveItemV15')?.closest('.fin-card') || null;
    let host=$('fm10155Host');
    if(!host){
      host=document.createElement('div');
      host.id='fm10155Host';
      host.innerHTML='<div id="finMovementListV10155"></div>';
      if(formCard && formCard.nextSibling) body.insertBefore(host, formCard.nextSibling); else body.appendChild(host);
    }
    hideCoreMovementLists(body, formCard);
    renderEnhancedMovementList();
    syncMovementNamesToDb(false);
  }
  function patchShowMovement(){
    if(window.__fm10155ShowPatched) return; window.__fm10155ShowPatched=true;
    const old=window.financeProShowMovementV15;
    window.financeProShowMovementV15=function(id){
      const st=state();
      const m=A(st.movements).find(x=>String(x.id)===String(id));
      if(!m || !old) return old?old.apply(this,arguments):undefined;
      const oldName=m.item_name;
      const name=officialProductName(m);
      if(name) m.item_name=name;
      const res=old.apply(this,arguments);
      m.item_name=oldName;
      // ensure modal visible name is official even if base copied old value elsewhere
      setTimeout(()=>{
        const cards=[...document.querySelectorAll('.fin-modal-card,.fin-modal-backdrop')];
        cards.forEach(card=>{
          const b=[...card.querySelectorAll('b')].find(x=>S(x.textContent)===S(oldName));
          if(b&&name) b.textContent=name;
          if(card.querySelector('.fm10164-audit-box')) return;
          const createdBy=movementAuditValue(m,'created')||'غير محدد';
          const updatedBy=movementAuditValue(m,'updated')||'غير محدد';
          const createdAt=movementAuditDate(m,'created')||'-';
          const updatedAt=movementAuditDate(m,'updated')||'-';
          const audit=document.createElement('div');
          audit.className='fm10164-audit-box';
          audit.innerHTML=`<div style="display:grid;grid-template-columns:repeat(2,minmax(180px,1fr));gap:10px;margin-top:12px">
            <div style="border:1px solid #dce6e2;border-radius:14px;padding:10px;background:#f8fbfa"><small style="color:#60706a">أضيف بواسطة</small><b style="display:block;margin-top:5px;color:#073d31">${esc(createdBy)}</b><small>${esc(createdAt)}</small></div>
            <div style="border:1px solid #dce6e2;border-radius:14px;padding:10px;background:#f8fbfa"><small style="color:#60706a">آخر تعديل بواسطة</small><b style="display:block;margin-top:5px;color:#073d31">${esc(updatedBy)}</b><small>${esc(updatedAt)}</small></div>
          </div>`;
          const target=card.querySelector('.fin-modal-card') || card.querySelector('.fin-modal-body') || card;
          target.appendChild(audit);
        });
      },20);
      return res;
    };
  }
  function patchFinanceHooks(){
    if(window.__fm10155HooksPatched) return; window.__fm10155HooksPatched=true;
    const oldTab=window.financeProTabV15;
    if(typeof oldTab==='function'){
      window.financeProTabV15=function(){ const r=oldTab.apply(this,arguments); setTimeout(enhanceMovementTab,80); return r; };
    }
    const oldLoad=window.financeProLoadV15;
    if(typeof oldLoad==='function'){
      window.financeProLoadV15=async function(){ const r=await oldLoad.apply(this,arguments); setTimeout(enhanceMovementTab,120); return r; };
    }
    const oldEdit=window.financeProEditMovementV15;
    if(typeof oldEdit==='function'){
      window.financeProEditMovementV15=function(){ const r=oldEdit.apply(this,arguments); setTimeout(enhanceMovementTab,120); return r; };
    }
  }
  function installStyle(){
    if($('fm10156Style')) return;
    const st=document.createElement('style'); st.id='fm10156Style';
    st.textContent=`#fm10155Host{display:block!important;margin-top:12px}.fm10155-filters>div{min-width:160px}.fm10155-filter-card{border-color:#bfe1d6!important;background:linear-gradient(180deg,#fff,#f8fffc)!important}#finMovementListV10155 .fin-table{max-height:64vh}#fm10155SyncNames,#fm10156PrintSelected,#fm10156PrintFiltered{border:1px solid #cfe3db!important}.fm10156-select-row{width:18px;height:18px;cursor:pointer}#fm10156SelectAll{width:18px;height:18px}`;
    document.head.appendChild(st);
  }
  function boot(){ installStyle(); patchFinanceHooks(); patchShowMovement(); setTimeout(enhanceMovementTab,150); setTimeout(enhanceMovementTab,800); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.addEventListener('load',()=>setTimeout(boot,600),{once:true});
  console.log('Loaded '+VERSION);
})();

/* Tasneef v10158 - Safe product edit for fallback movement-only products
   Fixes: invalid input syntax for type bigint: "fb_*" when editing products rendered from inventory movements.
   Scope: المالية والمخزون فقط. No new movement is created. */
(function(){
  'use strict';
  if(window.__tasneefFinanceSafeProductEditV10157) return;
  window.__tasneefFinanceSafeProductEditV10157 = true;

  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const client=()=>window.sb||window.supabaseClient||window.supabase||null;
  const state=()=>window.financeProStateV15||{};
  const isBigint=v=>/^\d+$/.test(S(v));
  const currentUser=()=>{try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};}};
  function isSystemAdmin(){
    const u=currentUser();
    const text=[u.role,u.user_role,u.type,u.position,u.username,u.full_name,u.name,u.email].map(S).join(' ').toLowerCase();
    return /admin|system|owner|مدير\s*عام|مدير\s*النظام|النظام|ادارة|الإدارة/.test(text) || ['admin','general_manager','system_admin','owner'].includes(S(u.role||u.user_role||u.type));
  }
  function itemCode(i){return S(i&&(i.product_code||i.serial_number||i.barcode||i.supplier_barcode||i.code));}
  function productKeys(obj){
    const keys=[];
    [obj&&obj.id,obj&&obj.item_id,obj&&obj.product_code,obj&&obj.serial_number,obj&&obj.barcode,obj&&obj.supplier_barcode,obj&&obj.code,obj&&obj.name,obj&&obj.item_name].forEach(v=>{const x=S(v).toLowerCase(); if(x&&!keys.includes(x)) keys.push(x);});
    return keys;
  }
  function getIdFromCard(card){
    const btn=card && card.querySelector('.fin-show-product-btn,[onclick*="financeProShowProductV15"],[onclick*="financeProDeleteProductV15"],[onchange*="financeProUploadProductImageV15"]');
    const txt=(btn && (btn.getAttribute('onclick')||btn.getAttribute('onchange')||'')) || '';
    let m=txt.match(/financePro(?:ShowProduct|DeleteProduct|UploadProductImage)V15\(['"]([^'"]+)['"]/);
    if(m) return m[1];
    const file=card && card.querySelector('input[type="file"][onchange*="financeProUploadProductImageV15"]');
    const ot=(file && file.getAttribute('onchange')) || '';
    m=ot.match(/financeProUploadProductImageV15\(['"]([^'"]+)['"]/);
    return m?m[1]:'';
  }
  function metaValue(card,label){
    const L=S(label).replace(/\s+/g,' ').toLowerCase();
    const boxes=[...(card?.querySelectorAll('.fin-meta div')||[])];
    for(const b of boxes){
      const small=S(b.querySelector('small')?.textContent||'').replace(/\s+/g,' ').toLowerCase();
      if(small.includes(L)) return S(b.querySelector('b,strong')?.textContent||'');
    }
    return '';
  }
  function officialItemByCardData(data){
    const st=state();
    const keys=[];
    [data.id,data.code,data.name].forEach(v=>{const x=S(v).toLowerCase(); if(x) keys.push(x);});
    return A(st.items).find(i=>productKeys(i).some(k=>keys.includes(k))) || null;
  }
  function cardDataFromButton(btn){
    const card=btn?.closest('.fin-product-card');
    const id=getIdFromCard(card);
    const data={
      id,
      oldName:S(card?.querySelector('h4')?.textContent||''),
      name:S(card?.querySelector('h4')?.textContent||''),
      code:metaValue(card,'الكود'),
      unit:metaValue(card,'الوحدة') || 'حبة',
      item_type:metaValue(card,'النوع') || 'مادة',
      cost:S(metaValue(card,'سعر قبل الضريبة')).replace(/[^0-9.]/g,'') || '0'
    };
    const official=officialItemByCardData(data);
    if(official){
      data.officialId=S(official.id);
      data.name=S(official.name||official.item_name||data.name);
      data.code=itemCode(official)||data.code;
      data.unit=S(official.unit||data.unit);
      data.item_type=S(official.item_type||official.type||official.category||data.item_type);
      data.cost=S(official.unit_cost||official.cost||official.price||official.purchase_price||data.cost||0);
    }
    data.isFallback=!isBigint(data.id) && !isBigint(data.officialId);
    return data;
  }
  function closeModal(){ $('finProductEditModalV10157')?.remove(); }
  function openModal(data){
    closeModal();
    const root=document.createElement('div');
    root.id='finProductEditModalV10157'; root.className='fp10157-backdrop';
    root.innerHTML=`<div class="fp10157-card" role="dialog" aria-modal="true">
      <div class="fp10157-head"><h2>تعديل المنتج</h2><button type="button" class="danger" data-close>إغلاق</button></div>
      <div class="fp10157-note">${data.isFallback?'هذا المنتج ظاهر من حركة مخزون قديمة فقط وليس له رقم منتج رسمي. سيتم تحديث اسم المنتج داخل الحركات القديمة المطابقة للكود بدون إنشاء حركة جديدة.':'التعديل سيحدث المنتج الرسمي ويزامن الاسم والسعر داخل حركات المخزون القديمة بدون إنشاء حركة جديدة.'}</div>
      <input type="hidden" id="fp10157Id" value="${esc(data.id)}">
      <input type="hidden" id="fp10157OfficialId" value="${esc(data.officialId||'')}">
      <input type="hidden" id="fp10157OldName" value="${esc(data.oldName||data.name)}">
      <div class="fp10157-grid">
        <div><label>اسم المنتج</label><input id="fp10157Name" value="${esc(data.name)}"></div>
        <div><label>نوع المنتج</label><select id="fp10157Type"><option value="مادة">مادة</option><option value="أداة">أداة</option><option value="مكينة">مكينة</option><option value="عدة">عدة</option><option value="غير">غير</option></select></div>
        <div><label>الوحدة</label><input id="fp10157Unit" value="${esc(data.unit||'حبة')}"></div>
        <div><label>السعر قبل الضريبة</label><input id="fp10157Cost" type="number" min="0" step="0.01" value="${esc(data.cost||0)}"></div>
        <div><label>الكود</label><input id="fp10157Code" value="${esc(data.code||'-')}" readonly></div>
      </div>
      <div class="fp10157-actions"><button type="button" id="fp10157Save">حفظ التعديل</button><button type="button" class="light" data-close>إلغاء</button></div>
    </div>`;
    document.body.appendChild(root);
    const type=$('fp10157Type'); if(type) type.value=S(data.item_type)||'مادة';
    root.addEventListener('click',e=>{ if(e.target===root || e.target.closest('[data-close]')) closeModal(); });
    $('fp10157Save').onclick=saveEdit;
  }
  async function updateMovementsByCodeOrName(c,{officialId,code,oldName,name}){
    let updated=0;
    const promises=[];
    const seen=new Set();
    function add(label,builder){ if(seen.has(label)) return; seen.add(label); promises.push(builder.then(r=>{ if(r.error) console.warn('v10158 movement sync', label, r.error.message||r.error); else updated++; })); }
    if(isBigint(officialId)) add('item_id:'+officialId, c.from('inventory_movements').update({item_name:name}).eq('item_id',officialId));
    if(S(code)&&S(code)!=='-'){
      add('product_code:'+code, c.from('inventory_movements').update({item_name:name}).eq('product_code',code));
      add('barcode:'+code, c.from('inventory_movements').update({item_name:name}).eq('barcode',code));
    }
    if(S(oldName)&&S(oldName)!==S(name)) add('item_name:'+oldName, c.from('inventory_movements').update({item_name:name}).eq('item_name',oldName));
    await Promise.all(promises);
    return updated;
  }
  async function saveEdit(){
    if(!isSystemAdmin()) return alert('هذا الإجراء خاص بإدارة النظام فقط');
    const id=S($('fp10157Id')?.value), officialId=S($('fp10157OfficialId')?.value), oldName=S($('fp10157OldName')?.value);
    const name=S($('fp10157Name')?.value), type=S($('fp10157Type')?.value)||'مادة', unit=S($('fp10157Unit')?.value)||'حبة', code=S($('fp10157Code')?.value);
    const cost=Number($('fp10157Cost')?.value||0)||0;
    if(!name) return alert('اسم المنتج مطلوب');
    const c=client(); if(!c||!c.from) return alert('الاتصال بقاعدة البيانات غير جاهز');
    const btn=$('fp10157Save');
    try{
      if(btn){btn.disabled=true; btn.textContent='جاري الحفظ...';}
      const realId=isBigint(officialId)?officialId:(isBigint(id)?id:'');
      if(realId){
        const patch={name, item_type:type, type:type, category:type, unit, unit_cost:cost, cost:cost, price:cost, purchase_price:cost};
        const res=await c.from('inventory_items').update(patch).eq('id',realId).select('*');
        if(res.error) throw res.error;
      }
      await updateMovementsByCodeOrName(c,{officialId:realId,code,oldName,name});
      // update local state immediately
      const st=state();
      A(st.items).forEach(i=>{ if((realId&&S(i.id)===S(realId)) || (code&&[i.product_code,i.serial_number,i.barcode,i.supplier_barcode,i.code].map(S).includes(code))){ i.name=name; i.item_type=type; i.type=type; i.category=type; i.unit=unit; i.unit_cost=cost; i.cost=cost; i.price=cost; i.purchase_price=cost; } });
      A(st.movements).forEach(m=>{ if((realId&&S(m.item_id)===S(realId)) || (code&&[m.product_code,m.barcode].map(S).includes(code)) || (oldName&&S(m.item_name)===oldName)){ m.item_name=name; } });
      closeModal();
      if(typeof window.financeProLoadV15==='function') await window.financeProLoadV15(true);
      else if(typeof window.financeProRenderProductListV15==='function') window.financeProRenderProductListV15();
      if(typeof window.financeProRenderProductListV15==='function') setTimeout(window.financeProRenderProductListV15,300);
      if(typeof msg==='function') msg(realId?'تم تعديل المنتج ومزامنة الحركات القديمة':'تم تحديث اسم المنتج في الحركات القديمة المطابقة');
    }catch(e){ alert('لم يتم تعديل المنتج: '+(e.message||e)); }
    finally{ if(btn){btn.disabled=false; btn.textContent='حفظ التعديل';} }
  }
  function installStyle(){
    if($('fp10157Style')) return;
    const st=document.createElement('style'); st.id='fp10157Style';
    st.textContent=`.fp10157-backdrop{position:fixed;inset:0;z-index:2147483100;background:rgba(0,35,28,.48);display:grid;place-items:center;padding:18px;direction:rtl}.fp10157-card{width:min(720px,96vw);background:#fff;border-radius:22px;border:1px solid #d9e7e2;box-shadow:0 30px 100px rgba(0,0,0,.25);padding:18px;color:#073d31}.fp10157-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.fp10157-head h2{margin:0}.fp10157-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin:14px 0}.fp10157-grid input,.fp10157-grid select{width:100%;border:1px solid #d9e7e2;border-radius:12px;padding:10px;background:#fff}.fp10157-note{background:#f4faf7;border:1px solid #d8ebe3;border-radius:12px;padding:10px;margin-top:12px;line-height:1.8}.fp10157-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}.fp10157-actions button,.fp10157-head button{border:0;border-radius:12px;padding:10px 14px;font-weight:800;background:#0b4f3a;color:#fff;cursor:pointer}.fp10157-actions .light{background:#eef7f3;color:#073d31}.fp10157-head .danger{background:#c73535;color:#fff}`;
    document.head.appendChild(st);
  }
  function captureEditClicks(e){
    const btn=e.target.closest && e.target.closest('[data-v10113-edit-product]');
    if(!btn) return;
    const data=cardDataFromButton(btn);
    const id=S(data.id||data.officialId);
    if(!id) return;
    e.preventDefault();
    e.stopPropagation();
    if(typeof e.stopImmediatePropagation==='function') e.stopImmediatePropagation();
    openModal(data);
    return false;
  }
  function boot(){
    installStyle();
    document.removeEventListener('click',captureEditClicks,true);
    document.addEventListener('click',captureEditClicks,true);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.addEventListener('load',boot,{once:true});
  console.log('Loaded v10158 safe product edit');
})();


/* Tasneef v10158 - Products filters and movement print selection hardening
   Fixes product cards filters without touching other sections. */
(function(){
  'use strict';
  if(window.__tasneefFinanceProductsFiltersV10158) return;
  window.__tasneefFinanceProductsFiltersV10158=true;
  const S=v=>String(v??'').trim();
  const N=v=>Number(v||0)||0;
  const A=v=>Array.isArray(v)?v:[];
  const $=id=>document.getElementById(id);
  const state=()=>window.financeProStateV15||{};
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=v=>`${N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س`;
  const VAT=0.15;
  function itemCode(i){return S(i&&(i.product_code||i.serial_number||i.barcode||i.supplier_barcode||i.code));}
  function itemCost(i){return N(i&&(i.unit_cost||i.cost||i.price||i.purchase_price));}
  function productType(i){const r=S(i&&(i.item_type||i.type||i.category)); const low=r.toLowerCase(); if(['tool','tools','أداة','اداة','عدة','معدات'].includes(low)||['عدة','معدات','أداة','اداة'].includes(r))return 'أداة'; if(['machine','machines','مكينة','ماكينة'].includes(low)||['مكينة','ماكينة'].includes(r))return 'مكينة'; if(['material','materials','مادة','مواد'].includes(low)||['مادة','مواد'].includes(r))return 'مادة'; return r||'مادة';}
  function productKeys(obj){const keys=[]; [obj&&obj.id,obj&&obj.item_id,obj&&obj.product_code,obj&&obj.serial_number,obj&&obj.barcode,obj&&obj.supplier_barcode,obj&&obj.distributor_code,obj&&obj.code,obj&&obj.name,obj&&obj.item_name].forEach(v=>{const x=S(v).toLowerCase(); if(x&&!keys.includes(x))keys.push(x);}); return keys;}
  function lockedImageUrl(item){
    if(S(item&&item.image_url)) return S(item.image_url);
    const cache=state().imageCache||{};
    for(const k of productKeys(item)){ if(S(cache[k])) return S(cache[k]); }
    return '';
  }
  function movementRowsForItem(item){
    const st=state(), code=itemCode(item), id=S(item&&item.id), name=S(item&&item.name);
    return A(st.movements).filter(m=>S(m.item_id)===id || (code && [m.product_code,m.barcode].map(S).includes(code)) || (!m.item_id && S(m.item_name)===name));
  }
  function qty(item){
    const rows=movementRowsForItem(item);
    if(!rows.length) return N(item&&item.quantity);
    const safeJson=v=>{const t=S(v); if(!t.startsWith('finance_pro_v15:')) return {}; try{return JSON.parse(t.replace('finance_pro_v15:',''))||{};}catch(_){return{};}};
    const sign=t=>{t=S(t); if(t==='in'||t==='return') return 1; if(['out','consume','waste','damaged','scrap'].includes(t)) return -1; return 0;};
    let total=N(item&&item.quantity);
    rows.forEach(m=>{
      const meta=safeJson(m.notes)||{};
      const returned=A(meta.distribution).filter(d=>S(d.type)==='return'&&S(m.movement_type)!=='return').reduce((a,d)=>a+N(d.qty),0);
      total += returned;
    });
    return total;
  }
  function officialProducts(){
    const st=state();
    const list=A(st.items).length?A(st.items):[];
    return list.slice().sort((a,b)=>S(a.name).localeCompare(S(b.name),'ar'));
  }
  function renderFixedProductList(){
    const box=$('finProductListV15'); if(!box) return false;
    const items=officialProducts();
    const q=S($('finProductSearchV15')?.value).toLowerCase();
    const status=S($('finProductStatusV15')?.value);
    const unit=S($('finProductUnitV15')?.value);
    const type=S($('finProductTypeV15')?.value);
    const imageFilter=S($('finProductImageFilterV15')?.value);
    let rows=items.filter(i=>{
      const hay=[i.name,itemCode(i),i.category,i.supplier,i.supplier_barcode,i.distributor_code,i.unit].map(S).join(' ').toLowerCase();
      const qv=qty(i), min=N(i.min_quantity||i.reorder_level||1), hasImage=!!S(lockedImageUrl(i));
      if(q && !hay.includes(q)) return false;
      if(status==='available' && !(qv>min)) return false;
      if(status==='low' && !(qv>0 && qv<=min)) return false;
      if(status==='zero' && qv!==0) return false;
      if(unit && S(i.unit)!==unit) return false;
      if(type && productType(i)!==type && S(i.item_type)!==type && S(i.type)!==type && S(i.category)!==type) return false;
      if(imageFilter==='without' && hasImage) return false;
      if(imageFilter==='with' && !hasImage) return false;
      return true;
    });
    const withImg=rows.filter(x=>S(lockedImageUrl(x))).length, noImg=rows.length-withImg;
    box.innerHTML=`<div class="fin-product-note">عدد المنتجات المعروضة: ${rows.length} | فيها صور: ${withImg} | بدون صور: ${noImg}</div><div class="fin-report-cards">${rows.map(i=>{
      const qv=qty(i), min=N(i.min_quantity||i.reorder_level||1), low=qv>0&&qv<=min, zero=qv===0;
      const imageUrl=lockedImageUrl(i);
      const img=imageUrl?`<img class="fin-thumb" loading="lazy" src="${esc(imageUrl)}" alt="" onclick="financeProZoomImageV15('${encodeURIComponent(imageUrl)}','${encodeURIComponent(S(i.name))}')">`:'<div class="fin-thumb" style="display:grid;place-items:center;color:#8aa096;font-size:11px">بدون صورة</div>';
      return `<div class="fin-product-card">${img}<h4>${esc(i.name||'-')}</h4><span class="fin-badge ${zero?'bad':low?'warn':''}">${zero?'رصيد صفر':low?'قارب الانتهاء':'متوفر'}</span><div class="fin-meta"><div><small>الكود</small><b>${esc(itemCode(i)||'-')}</b></div><div><small>الوحدة</small><b>${esc(i.unit||'-')}</b></div><div><small>النوع</small><b>${esc(productType(i))}</b></div><div><small>الكمية</small><b>${N(qv)}</b></div><div><small>سعر قبل الضريبة</small><b>${money(itemCost(i))}</b></div><div><small>بعد الضريبة للوحدة</small><b>${money(itemCost(i)*(1+VAT))}</b></div></div><div class="fin-card-actions"><button type="button" class="light" data-v10113-edit-product="1">تعديل المنتج</button><button type="button" class="fin-show-product-btn" onclick="return financeProShowProductV15('${esc(i.id)}')">عرض المنتج</button><label class="light" style="display:inline-flex;align-items:center;justify-content:center;min-width:130px;cursor:pointer;border:1px solid #d8ebe3;border-radius:11px;padding:8px 11px;background:#eef7f3;color:#073d31">تحميل صورة<input type="file" accept="image/*" style="display:none" onchange="financeProUploadProductImageV15('${esc(i.id)}',this)"></label></div></div>`;
    }).join('')||'<div class="fin-soft">لا توجد منتجات حسب الفلتر.</div>'}</div>`;
    return true;
  }
  function patch(){
    const old=window.financeProRenderProductListV15;
    window.financeProRenderProductListV15=function(){
      if(renderFixedProductList()) return;
      return typeof old==='function'?old.apply(this,arguments):undefined;
    };
  }
  function boot(){ patch(); if($('finProductListV15')) renderFixedProductList(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.addEventListener('load',()=>setTimeout(boot,800),{once:true});
  console.log('Loaded v10158 product filters hard fix');
})();

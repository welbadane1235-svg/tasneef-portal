/* Tasneef Supplier Return + Distributor Code Patch v10030
   محدود على المالية/المخزون فقط، ولا يلمس قسم الأوردرات.
   إصلاح v10030:
   - يجعل عرض بيانات المنتج يحسب supplier_return دائماً حتى لو سكربت آخر غيّر الدالة بعد التحميل.
   - تحميله في آخر admin.html حتى لا يتم كسره من أي سكربت مالي آخر.
   - يضيف أزرار طباعة داخل قسم المالية.
*/
(function(){
  'use strict';
  if(window.__tasneefSupplierReturnDistributorPatchV10030Started) return;
  window.__tasneefSupplierReturnDistributorPatchV10030Started = true;

  const VERSION = 'supplier_return_distributor_code_v10030';
  const $ = id => document.getElementById(id);
  const A = v => Array.isArray(v) ? v : [];
  const S = v => String(v ?? '').trim();
  const N = v => Number(String(v ?? '').replace(/,/g,'').replace(/[^0-9.\-]/g,'')) || 0;
  const esc = v => S(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const today = () => new Date().toISOString().slice(0,10);
  const state = () => window.financeProStateV15 || {items:[], movements:[]};
  const money = v => N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ر.س';
  const itemCode = i => S(i && (i.product_code || i.serial_number || i.barcode || i.code || ''));
  const itemSupplierCode = i => S(i && (i.supplier_barcode || i.distributor_code || i.vendor_code || i.barcode || ''));
  const itemCost = i => N(i && (i.unit_cost || i.cost || i.price || i.purchase_price));
  const supplierOfItem = i => S(i && (i.supplier || i.vendor || i.receiver || ''));

  function ensureMiniStyle(){
    if($('supplierReturnDistributorPatchStyleV10030')) return;
    const st=document.createElement('style');
    st.id='supplierReturnDistributorPatchStyleV10030';
    st.textContent = `
      .tasneef-code-match-v10030{margin-top:6px;background:#edf8f3;border:1px solid #cfe8dd;color:#07513f;border-radius:11px;padding:7px 9px;font-size:12px;font-weight:800}
      .tasneef-code-match-v10030.bad{background:#fff4df;border-color:#efd19a;color:#7a5200}
      .tasneef-return-modal-v10030 .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.tasneef-return-modal-v10030 label{display:block;margin:8px 0 4px;font-weight:800;color:#073d31}.tasneef-return-modal-v10030 input,.tasneef-return-modal-v10030 select,.tasneef-return-modal-v10030 textarea{width:100%}
      .finance-print-actions-v10030{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.finance-print-actions-v10030 button{border-radius:12px;padding:9px 13px}
      @media(max-width:700px){.tasneef-return-modal-v10030 .grid{grid-template-columns:1fr}}
      @media print{.no-print-v10030,.fin-actions button,.finance-print-actions-v10030{display:none!important}.modal-backdrop{position:static!important;background:#fff!important;display:block!important;padding:0!important}.card{box-shadow:none!important}}
    `;
    document.head.appendChild(st);
  }

  function findItemByDistributorCode(code){
    const c=S(code).toLowerCase();
    if(!c) return null;
    return A(state().items).find(i => [
      i.supplier_barcode, i.distributor_code, i.vendor_code, i.barcode, i.product_code, i.serial_number, i.code
    ].map(S).some(x => x && x.toLowerCase() === c));
  }

  function showCodeMatch(item, code){
    let box=$('finDistributorCodeMatchV10030');
    const input=$('finLineDistributorCodeV15');
    if(!input) return;
    if(!box){
      box=document.createElement('div');
      box.id='finDistributorCodeMatchV10030';
      input.insertAdjacentElement('afterend', box);
    }
    if(item){
      box.className='tasneef-code-match-v10030';
      box.innerHTML='تم التعرف على المنتج: <b>'+esc(item.name||'-')+'</b> — الكود الداخلي: <b>'+esc(itemCode(item)||'-')+'</b>';
    }else if(S(code)){
      box.className='tasneef-code-match-v10030 bad';
      box.textContent='لم يتم العثور على منتج بهذا الكود. سيتم اعتباره منتج جديد إذا أكملت الإضافة.';
    }else{
      box.remove();
    }
  }

  function fillExistingProductByDistributorCode(){
    const input=$('finLineDistributorCodeV15');
    if(!input) return;
    const code=S(input.value);
    const item=findItemByDistributorCode(code);
    showCodeMatch(item, code);
    if(!item) return;
    const existing=$('finExistingProductV15');
    if(existing) existing.value=S(item.id);
    if(typeof window.financeProFillExistingProductV15 === 'function'){
      try{ window.financeProFillExistingProductV15(item.id); }catch(_){ }
    }
    if($('finLineNameV15')) $('finLineNameV15').value=S(item.name||'');
    if($('finLineCodeV15')) $('finLineCodeV15').value=itemCode(item);
    if($('finLineDistributorCodeV15')) $('finLineDistributorCodeV15').value=itemSupplierCode(item) || code;
    if($('finLineUnitV15') && S(item.unit)) $('finLineUnitV15').value=S(item.unit);
    if($('finLineMinQtyV15')) $('finLineMinQtyV15').value=N(item.min_quantity || item.reorder_level || 1) || '';
    if($('finLinePriceV15') && !$('finLinePriceV15').value) $('finLinePriceV15').value=itemCost(item) || '';
  }

  function attachDistributorCodeRecognition(){
    ensureMiniStyle();
    const input=$('finLineDistributorCodeV15');
    if(!input || input.__tasneefDistributorRecognitionV10030) return;
    input.__tasneefDistributorRecognitionV10030 = true;
    input.addEventListener('input', function(){ setTimeout(fillExistingProductByDistributorCode, 120); });
    input.addEventListener('change', fillExistingProductByDistributorCode);
    input.addEventListener('blur', fillExistingProductByDistributorCode);
  }

  function supplierOptionsForReturn(supplier){
    const rows=A(state().items);
    const exact=rows.filter(i=>supplierOfItem(i)===supplier);
    const list=exact.length ? exact : rows;
    return list.map(i=>{
      const qty=N(i.quantity);
      const code=itemSupplierCode(i) || itemCode(i) || '-';
      return `<option value="${esc(i.id)}">${esc(i.name||'-')} — كود الموزع: ${esc(code)} — المتوفر: ${qty}</option>`;
    }).join('');
  }

  window.financeProOpenSupplierReturnV10030 = function(supplier){
    supplier=S(supplier);
    if(!supplier) return alert('اسم المورد غير واضح');
    ensureMiniStyle();
    const html=`
      <div class="modal-backdrop tasneef-return-modal-v10030" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:999999;display:grid;place-items:center;padding:18px">
        <div class="card" style="width:min(760px,96vw);max-height:92vh;overflow:auto">
          <div class="fin-actions" style="justify-content:space-between"><h2>مرتجع للمورد: ${esc(supplier)}</h2><button class="danger" onclick="this.closest('.modal-backdrop').remove()">إغلاق</button></div>
          <div class="grid">
            <div><label>المنتج</label><select id="supplierReturnItemV10030">${supplierOptionsForReturn(supplier)}</select></div>
            <div><label>الكمية المرتجعة</label><input id="supplierReturnQtyV10030" type="number" min="0" step="0.01" placeholder="مثال 2"></div>
            <div><label>التاريخ</label><input id="supplierReturnDateV10030" type="date" value="${today()}"></div>
            <div><label>رقم فاتورة المورد</label><input id="supplierReturnInvoiceV10030" placeholder="اختياري"></div>
          </div>
          <label>ملاحظة</label><textarea id="supplierReturnNoteV10030" placeholder="سبب الإرجاع أو أي ملاحظة"></textarea>
          <div class="fin-soft" style="margin-top:10px">هذه الحركة ستظهر في حركات المورد باسم <b>مرتجع للمورد</b>، وستخصم الكمية من المخزون، ولن تدخل في تكلفة المشاريع أو الأوردرات.</div>
          <div class="fin-actions" style="margin-top:12px"><button onclick="financeProSaveSupplierReturnV10030('${esc(supplier).replace(/'/g,'&#039;')}', this)">حفظ المرتجع</button></div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  };

  async function recalcOrFallback(item, qty){
    if(!window.sb || !item) return;
    try{
      const rpc = await sb.rpc('tasneef_recalc_inventory_item_qty_v10030', {p_item_id:String(item.id)});
      if(!rpc.error) return;
    }catch(_){ }
    try{
      const rpc26 = await sb.rpc('tasneef_recalc_inventory_item_qty_v10027', {p_item_id:String(item.id)});
      if(!rpc26.error) return;
    }catch(_){ }
    const next=Math.max(0, N(item.quantity)-N(qty));
    await sb.from('inventory_items').update({quantity:next}).eq('id', item.id);
  }

  window.financeProSaveSupplierReturnV10030 = async function(supplier, btn){
    try{
      if(btn) btn.disabled=true;
      if(!window.sb) throw new Error('الاتصال غير جاهز');
      supplier=S(supplier);
      const itemId=S($('supplierReturnItemV10030')?.value);
      const item=A(state().items).find(i=>String(i.id)===itemId);
      if(!item) throw new Error('اختر المنتج');
      const qty=N($('supplierReturnQtyV10030')?.value);
      if(qty<=0) throw new Error('اكتب الكمية المرتجعة');
      if(N(item.quantity)>0 && qty>N(item.quantity)) throw new Error('الكمية المرتجعة أكبر من المتوفر في المخزون');
      const date=S($('supplierReturnDateV10030')?.value)||today();
      const supplierInvoiceNo=S($('supplierReturnInvoiceV10030')?.value);
      const note=S($('supplierReturnNoteV10030')?.value);
      const meta={module:VERSION, supplierReturn:true, supplier, supplierInvoiceNo, note, stockEffect:'out', costEffect:'none'};
      const mv={
        item_id:item.id,
        item_name:S(item.name),
        movement_type:'supplier_return',
        quantity:qty,
        movement_date:date,
        receiver:supplier,
        reason:'مرتجع للمورد'+(supplierInvoiceNo?' - فاتورة المورد '+supplierInvoiceNo:''),
        notes:'finance_pro_v15:'+JSON.stringify(meta),
        product_code:itemCode(item),
        barcode:itemSupplierCode(item) || itemCode(item),
        unit_cost:+itemCost(item).toFixed(4)
      };
      const res=await sb.from('inventory_movements').insert(mv);
      if(res.error) throw res.error;
      await recalcOrFallback(item, qty);
      if(typeof window.financeProLoadV15 === 'function') await window.financeProLoadV15(true);
      document.querySelector('.tasneef-return-modal-v10030')?.remove();
      if(typeof msg==='function') msg('تم تسجيل مرتجع المورد وتحديث المخزون');
    }catch(e){
      alert(e.message || String(e));
      if(typeof msg==='function') msg(e.message || String(e), 'err');
    }finally{ if(btn) btn.disabled=false; }
  };

  function patchSupplierModalButtons(){
    document.querySelectorAll('.modal-backdrop .card').forEach(card=>{
      const h2=card.querySelector('h2');
      const title=S(h2 && h2.textContent);
      if(!title.startsWith('بيانات المورد:')) return;
      const supplier=S(title.replace('بيانات المورد:',''));
      if(!supplier) return;
      const actions=card.querySelector('.fin-actions') || h2.parentElement;
      if(actions && !card.querySelector('[data-supplier-return-v10030]')){
        const b=document.createElement('button');
        b.type='button';
        b.className='light';
        b.dataset.supplierReturnV10030='1';
        b.textContent='تسجيل مرتجع للمورد';
        b.onclick=function(){ window.financeProOpenSupplierReturnV10030(supplier); };
        actions.appendChild(b);
      }
      card.querySelectorAll('td,span,b').forEach(td=>{
        if(S(td.textContent)==='supplier_return') td.textContent='مرتجع للمورد';
      });
    });
  }

  function normalizeSupplierReturnLabels(){
    document.querySelectorAll('td, span, b').forEach(el=>{
      if(S(el.textContent)==='supplier_return') el.textContent='مرتجع للمورد';
    });
  }

  const SUPPLIER_RETURN_TYPES = ['supplier_return','return_to_supplier','vendor_return','supplier-return','مرتجع للمورد'];
  function isSupplierReturnType(t){ return SUPPLIER_RETURN_TYPES.includes(S(t)); }
  function labelType(type){
    const t=S(type);
    if(isSupplierReturnType(t)) return 'مرتجع للمورد';
    const map={in:'داخل',out:'صرف',consume:'مستهلك',waste:'مهدور',damaged:'تالف',scrap:'سكراب',return:'مرتجع'};
    return map[t] || t || '-';
  }
  function movementDate(m){ return S(m.movement_date || m.created_at).slice(0,10) || '-'; }
  function productMoves(item){
    const code=itemCode(item), scode=itemSupplierCode(item);
    return A(state().movements).filter(m =>
      String(m.item_id)===String(item.id) ||
      (code && [m.product_code,m.barcode].map(S).includes(code)) ||
      (scode && [m.product_code,m.barcode].map(S).includes(scode)) ||
      (!m.item_id && S(m.item_name)===S(item.name))
    );
  }
  function rowValue(m){ return N(m.quantity) * (N(m.unit_cost) || itemCost(A(state().items).find(i=>String(i.id)===String(m.item_id))) || 0); }
  function rowsHtml(rows){
    return A(rows).map(m=>`<tr><td>${esc(movementDate(m))}</td><td>${esc(labelType(m.movement_type))}</td><td>${N(m.quantity)}</td><td>${esc(m.receiver||'-')}</td><td>${esc(m.reason||m.distribution_note||'-')}</td><td>${money(rowValue(m))}</td></tr>`).join('') || '<tr><td colspan="6">لا توجد بيانات</td></tr>';
  }
  function metaOf(m){
    const raw=S(m && m.notes);
    if(!raw.startsWith('finance_pro_v15:')) return {};
    try{ return JSON.parse(raw.replace('finance_pro_v15:','')) || {}; }catch(_){ return {}; }
  }
  function distRows(m){
    const dist=A(metaOf(m).distribution);
    if(!dist.length) return [];
    return dist.map((d,idx)=>Object.assign({}, m, {
      is_distribution_row:true,
      parent_id:m.id,
      distribution_index:idx,
      base_movement_type:S(m.movement_type),
      movement_type:S(d.type || m.movement_type),
      quantity:N(d.qty),
      project_id:d.projectId || m.project_id || null,
      project_name:S(d.projectName || m.project_name || ''),
      order_no:S(d.orderNo || m.order_no || ''),
      distribution_note:S(d.note || '')
    })).filter(x=>N(x.quantity)>0);
  }
  function isStockOutBaseType(t){ return ['out','consume','waste','damaged','scrap'].includes(S(t)); }

  function printHtml(title, content){
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      body{font-family:Tahoma,Arial,sans-serif;margin:18px;color:#073d31}h1{margin:0 0 14px}.card,.fin-card{border:1px solid #d9e7e2;border-radius:14px;padding:14px;margin-bottom:12px}.fin-soft{background:#f4faf7;border:1px solid #d8ebe3;border-radius:12px;padding:10px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #d9e7e2;padding:8px;text-align:right}th{background:#f4faf7}.fin-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.fin-kpi small{display:block;color:#60706a}.fin-kpi b{font-size:22px}.fin-actions,button,.no-print-v10030{display:none!important}@media print{body{margin:8mm}}
    </style></head><body><h1>${esc(title)}</h1>${content}<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`;
    const w=window.open('', '_blank');
    if(w){ w.document.write(html); w.document.close(); }
  }

  window.financePrintCurrentV10030 = function(){
    const box=$('financeDashboard');
    if(!box) return alert('قسم المالية غير مفتوح');
    const clone=box.cloneNode(true);
    clone.querySelectorAll('button,input,select,textarea,.finance-print-actions-v10030,.no-print-v10030').forEach(x=>x.remove());
    printHtml('طباعة قسم المالية والمخزون', clone.innerHTML);
  };
  window.financePrintVisibleReportV10030 = function(){
    const box=$('finReportWindowV15') || $('finBodyV15');
    if(!box) return alert('لا توجد بيانات للطباعة');
    printHtml('تقرير المالية والمخزون', box.innerHTML);
  };
  window.financePrintModalV10030 = function(btn){
    const card=btn && btn.closest ? btn.closest('.card') : document.querySelector('.modal-backdrop .card');
    if(!card) return;
    const clone=card.cloneNode(true);
    clone.querySelectorAll('button,.fin-tabs,.no-print-v10030').forEach(x=>x.remove());
    clone.querySelectorAll('.hidden').forEach(x=>x.classList.remove('hidden'));
    printHtml(S(card.querySelector('h2')?.textContent)||'طباعة', clone.innerHTML);
  };

  function addFinancePrintButtons(){
    const dash=$('financeDashboard');
    if(!dash || dash.classList.contains('hidden')) return;
    const body=$('finBodyV15') || dash.querySelector('.fin-shell') || dash;
    if(!body || dash.querySelector('#financePrintActionsV10030')) return;
    const div=document.createElement('div');
    div.id='financePrintActionsV10030';
    div.className='finance-print-actions-v10030 no-print-v10030';
    div.innerHTML='<button type="button" class="light" onclick="financePrintCurrentV10030()">طباعة قسم المالية</button><button type="button" class="light" onclick="financePrintVisibleReportV10030()">طباعة التقرير الحالي</button>';
    body.insertAdjacentElement('afterbegin', div);
  }

  function showProductDetailsFixed(id){
    const item=A(state().items).find(i=>String(i.id)===String(id));
    if(!item) return;
    const moves=productMoves(item);
    const dist=moves.flatMap(m=>distRows(m));
    const allRows=moves.concat(dist);

    const ins=moves.filter(m=>S(m.movement_type)==='in');
    const supplierReturns=moves.filter(m=>isSupplierReturnType(m.movement_type));
    const returns=allRows.filter(m=>S(m.movement_type)==='return' && !isSupplierReturnType(m.base_movement_type || m.movement_type));
    const consumed=allRows.filter(m=>S(m.movement_type)==='consume');
    const damaged=allRows.filter(m=>['waste','damaged','scrap'].includes(S(m.movement_type)));

    const inQty=ins.reduce((a,m)=>a+N(m.quantity),0);
    const returnQty=returns.reduce((a,m)=>a+N(m.quantity),0);
    const supplierReturnQty=supplierReturns.reduce((a,m)=>a+N(m.quantity),0);
    const stockOutBaseQty=moves.filter(m=>isStockOutBaseType(m.movement_type)).reduce((a,m)=>a+N(m.quantity),0);
    const consumedQty=consumed.reduce((a,m)=>a+N(m.quantity),0);
    const damagedQty=damaged.reduce((a,m)=>a+N(m.quantity),0);
    // الصرف النهائي في عرض المنتج يساوي: المستهلك + التالف/الهدر/السكراب
    // أما حركة الصرف الأساسية فتستخدم فقط لحساب الرصيد حتى لا يتم الخصم مرتين.
    const outQty=consumedQty + damagedQty;

    const calculatedQty=Math.max(0, inQty + returnQty - stockOutBaseQty - supplierReturnQty);
    const currentQty = calculatedQty;
    const outs=allRows.filter(m=>isStockOutBaseType(m.movement_type) && S(m.movement_type)==='out');

    const img=item.image_url?`<img src="${esc(item.image_url)}" style="width:96px;height:96px;object-fit:contain;border:1px solid #d9e7e2;border-radius:16px;background:#fff;padding:4px">`:'';
    const modal=`<div class="modal-backdrop" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:999999;display:grid;place-items:center;padding:18px">
      <div class="card" style="width:min(1120px,96vw);max-height:92vh;overflow:auto">
        <div class="fin-actions no-print-v10030" style="justify-content:space-between"><h2>بيانات المنتج: ${esc(item.name||'-')}</h2><div><button class="light" onclick="financePrintModalV10030(this)">طباعة</button><button class="danger" onclick="this.closest('.modal-backdrop').remove()">إغلاق</button></div></div>
        <div class="fin-tabs no-print-v10030" style="grid-template-columns:repeat(7,1fr);margin-bottom:12px">
          ${['الملخص','الداخل','الخارج','المستهلك','المرتجع','مرتجع للمورد','تالف / هدر / سكراب'].map((t,i)=>`<button class="${i?'light':''}" onclick="const p=this.closest('.card');p.querySelectorAll('.v10030-page').forEach(x=>x.classList.add('hidden'));p.querySelector('[data-page=\\'${i}\\']').classList.remove('hidden');p.querySelectorAll('.fin-tabs button').forEach(b=>b.classList.add('light'));this.classList.remove('light')">${t}</button>`).join('')}
        </div>
        <section class="v10030-page" data-page="0"><div class="fin-grid">${img?`<div class="fin-card">${img}</div>`:''}<div class="fin-card fin-kpi"><small>الداخل</small><b>${N(inQty)}</b></div><div class="fin-card fin-kpi"><small>الخارج</small><b>${N(outQty)}</b></div><div class="fin-card fin-kpi"><small>المستهلك</small><b>${N(consumedQty)}</b></div><div class="fin-card fin-kpi"><small>المرتجع للمخزون</small><b>${N(returnQty)}</b></div><div class="fin-card fin-kpi"><small>مرتجع للمورد</small><b>${N(supplierReturnQty)}</b></div><div class="fin-card fin-kpi"><small>تالف / هدر / سكراب</small><b>${N(damagedQty)}</b></div><div class="fin-card fin-kpi"><small>الرصيد الحالي</small><b>${N(currentQty)}</b></div></div><div class="fin-soft">الكود: <b>${esc(itemCode(item)||'-')}</b> | كود الموزع: <b>${esc(itemSupplierCode(item)||'-')}</b> | الوحدة: <b>${esc(item.unit||'-')}</b></div><div class="fin-soft" style="margin-top:8px">معادلة الرصيد: الداخل + المرتجع للمخزون - حركة الصرف الأساسية - مرتجع المورد = <b>${N(calculatedQty)}</b><br><small>الصرف الظاهر = المستهلك + التالف/الهدر/السكراب</small></div></section>
        <section class="v10030-page hidden" data-page="1"><div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المورد</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${rowsHtml(ins)}</tbody></table></div></section>
        <section class="v10030-page hidden" data-page="2"><div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المستلم</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${rowsHtml(outs)}</tbody></table></div></section>
        <section class="v10030-page hidden" data-page="3"><div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المستلم</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${rowsHtml(consumed)}</tbody></table></div></section>
        <section class="v10030-page hidden" data-page="4"><div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المستلم</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${rowsHtml(returns)}</tbody></table></div></section>
        <section class="v10030-page hidden" data-page="5"><div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المورد</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${rowsHtml(supplierReturns)}</tbody></table></div></section>
        <section class="v10030-page hidden" data-page="6"><div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المستلم</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${rowsHtml(damaged)}</tbody></table></div></section>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modal);
  }
  showProductDetailsFixed.__supplierReturnV10030 = true;

  function patchProductDetails(){
    if(window.financeProShowProductV15 !== showProductDetailsFixed){
      window.financeProShowProductV15 = showProductDetailsFixed;
    }
  }

  function patchButtonsDirectly(){
    document.querySelectorAll('[onclick^="financeProShowProductV15"]').forEach(btn=>{
      const raw=btn.getAttribute('onclick')||'';
      const m=raw.match(/financeProShowProductV15\(['\"]?([^'\")]+)['\"]?\)/);
      if(!m || btn.__showProductV10030) return;
      btn.__showProductV10030=true;
      btn.onclick=function(ev){ ev && ev.preventDefault && ev.preventDefault(); showProductDetailsFixed(m[1]); return false; };
    });
  }

  function boot(){
    attachDistributorCodeRecognition();
    patchSupplierModalButtons();
    normalizeSupplierReturnLabels();
    patchProductDetails();
    patchButtonsDirectly();
    addFinancePrintButtons();
  }

  document.addEventListener('input', function(e){
    if(e.target && e.target.id === 'finLineDistributorCodeV15') setTimeout(fillExistingProductByDistributorCode, 80);
  }, true);
  document.addEventListener('click', function(){ setTimeout(boot, 120); }, true);
  document.addEventListener('change', function(){ setTimeout(boot, 120); }, true);
  setInterval(boot, 500);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('load', boot);
  console.log('Tasneef '+VERSION+' loaded');
})();

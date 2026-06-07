/* TASNEEF v357 - Inventory balance final + invoice product image field
   نطاق التعديل:
   1) حساب المنتج في المخزون بعد توزيع حركة المخزون: خرج 10، توزيع 5+4، مرتجع 1 => المتبقي 1.
   2) إضافة/إظهار خانة صورة المنتج داخل فاتورة الإدخال.
*/
(function(){
  'use strict';
  if(window.__tasneefV357InventoryBalanceImageFix) return;
  window.__tasneefV357InventoryBalanceImageFix = true;

  const LS_ITEMS='tasneef_v312_items';
  const LS_MOVES='tasneef_v312_moves';
  const VAT=0.15;
  const S=v=>String(v??'').trim();
  const N=v=>{const x=Number(S(v).replace(/,/g,'')); return Number.isFinite(x)?x:0;};
  const R2=v=>Math.round((N(v)+Number.EPSILON)*100)/100;
  const E=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=v=>N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';
  const parse=(k,d=[])=>{try{return JSON.parse(localStorage.getItem(k)||'null')||d;}catch(_){return d;}};
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const items=()=>parse(LS_ITEMS,[]).map(i=>({...i,batches:Array.isArray(i.batches)?i.batches:[]}));
  const moves=()=>parse(LS_MOVES,[]);
  const setItems=v=>save(LS_ITEMS,v);

  const OUT_TYPES=new Set(['صرف','استهلاك','هدر','تالف','سكراب','out','consume']);
  const RET_TYPES=new Set(['مرتجع','return','إرجاع','ارجاع']);
  const IN_TYPES=new Set(['إدخال','ادخال','دخول','شراء','توريد','in']);
  const typeOf=m=>S(m.type||m.movement_type||m.kind);
  const itemIdOf=m=>S(m.item_id||m.product_id||m.inventory_item_id);
  const qtyOf=m=>N(m.qty||m.quantity);
  const isOut=t=>OUT_TYPES.has(S(t));
  const isRetType=t=>RET_TYPES.has(S(t));
  const isIn=t=>IN_TYPES.has(S(t));
  const textOf=m=>`${m.distribution_status||''} ${m.notes||''} ${m.general_note||''} ${m.reason||''}`;
  const isPending=m=>/pending|PENDING_DISTRIBUTION|بانتظار توزيع/i.test(textOf(m));
  const isAllocated=m=>/allocated|ALLOCATED/i.test(textOf(m)) || (!isPending(m) && isOut(typeOf(m)) && ['FM','CN','GENERAL'].includes(S(m.cost_type)));
  const isReturn=m=>isRetType(typeOf(m)) || /return|RETURN|مرتجع/i.test(textOf(m));
  const isApproved=m=>!S(m.status)||!['ملغي','مرفوض','cancelled','rejected'].includes(S(m.status));
  const costOfItem=it=>N(it.unit_before||it.price_before_vat||it.unit_cost_before||it.unit_cost||it.cost||it.price_before||it.price||0);
  const costOfMove=(m,it)=>N(m.unit_cost_override)||N(m.unit_before)||N(m.unit_cost_before)||N(m.unit_cost)||costOfItem(it);
  const productCode=it=>S(it.code||it.product_code||it.serial_number||it.barcode||it.supplier_barcode||'');
  const supplierCode=it=>S(it.company_code||it.supplier_code||it.supplier_barcode||it.barcode||'');
  const imgHtml=it=>{const src=S(it.image_data||it.image_url||it.image||''); return src?`<img src="${E(src)}" style="width:100%;height:100%;object-fit:contain" alt="صورة المنتج">`:'<span style="color:#789">لا توجد صورة</span>';};

  function explicitEntered(it){
    const fields=['original_quantity','initial_quantity','entered_qty','in_qty','total_in','purchase_qty','purchased_qty','invoice_qty','initial_stock','opening_qty','opening_stock'];
    for(const f of fields){ if(N(it[f])>0) return N(it[f]); }
    return 0;
  }
  function batchInitial(it){
    return (Array.isArray(it.batches)?it.batches:[]).reduce((a,b)=>a+N(b.qty_initial||b.initial_qty||b.entered||b.original_qty||b.qty||b.quantity||0),0);
  }

  function compute(itemId){
    const allItems=items();
    const it=allItems.find(i=>S(i.id)===S(itemId));
    if(!it) return null;
    const ms=moves().filter(m=>itemIdOf(m)===S(itemId)&&isApproved(m));
    const inQty=ms.filter(m=>isIn(typeOf(m))).reduce((a,m)=>a+qtyOf(m),0);
    const pendingOut=ms.filter(m=>isOut(typeOf(m))&&isPending(m)&&!isReturn(m)).reduce((a,m)=>a+qtyOf(m),0);
    const allocatedOut=ms.filter(m=>isOut(typeOf(m))&&isAllocated(m)&&!isPending(m)&&!isReturn(m)).reduce((a,m)=>a+qtyOf(m),0);
    const directOut=ms.filter(m=>isOut(typeOf(m))&&!isPending(m)&&!isAllocated(m)&&!isReturn(m)).reduce((a,m)=>a+qtyOf(m),0);
    const returns=ms.filter(m=>isReturn(m)).reduce((a,m)=>a+qtyOf(m),0);

    let entered=explicitEntered(it)||batchInitial(it)||inQty||N(it.entered)||0;
    const physicalOut=R2(pendingOut+allocatedOut+directOut);
    if(!entered) entered=Math.max(physicalOut-returns, N(it.qty||it.quantity||it.stock||0)+physicalOut-returns, 0);
    if(entered < (physicalOut-returns)) entered=physicalOut-returns;

    // المعادلة النهائية للمخزون الفعلي:
    // المتبقي = إجمالي الداخل - كل ما خرج من المخزن + المرتجع للمخزن.
    // في نظام التوزيع عندك: سطر بانتظار توزيع يتم إنقاصه كلما وزعت، لذلك يحسب ضمن الخارج الفعلي.
    const remaining=R2(Math.max(0, entered - physicalOut + returns));
    const consumed=R2(allocatedOut+directOut);
    const pendingBalance=R2(Math.max(0,pendingOut));
    const unit=costOfItem(it) || (ms.find(m=>N(costOfMove(m,it))) ? costOfMove(ms.find(m=>N(costOfMove(m,it))),it) : 0);
    const batches=[{label:'دفعة محسوبة',source:'FIFO',date:'-',qty_initial:entered,used:R2(entered-remaining),qty_remaining:remaining,unit_before:unit}];
    return {it,ms,entered:R2(entered),pendingOut:R2(pendingOut),allocatedOut:R2(allocatedOut),directOut:R2(directOut),out:physicalOut,returns:R2(returns),consumed,pendingBalance,remaining,unit,batches};
  }

  function sync(itemId){
    const st=compute(itemId); if(!st) return;
    const all=items(); const idx=all.findIndex(i=>S(i.id)===S(itemId));
    if(idx>=0){
      all[idx].qty=st.remaining;
      all[idx].quantity=st.remaining;
      all[idx].stock=st.remaining;
      all[idx].consumed_qty=st.consumed;
      all[idx].returned_qty=st.returns;
      all[idx].pending_distribution_qty=st.pendingBalance;
      setItems(all);
    }
  }
  window.rebuildStockV357=function(){items().forEach(i=>sync(i.id)); return items();};
  window.inventoryItemStatsV151=function(it){
    const st=compute(it?.id);
    if(!st) return {remaining:N(it?.qty||it?.quantity||0),inQty:0,outQty:0,retQty:0,consumed:0};
    return {remaining:st.remaining,inQty:st.entered,outQty:st.out,retQty:st.returns,consumed:st.consumed,pending:st.pendingBalance};
  };

  function css(){
    if(document.getElementById('v357Css')) return;
    const st=document.createElement('style'); st.id='v357Css'; st.textContent=`
      .v357-modal{position:fixed;inset:0;background:rgba(0,0,0,.48);z-index:1000007;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:18px;direction:rtl}
      .v357-panel{width:min(1120px,96vw);background:#fff;border-radius:22px;border:1px solid #d7e9e2;box-shadow:0 18px 70px rgba(0,0,0,.26);padding:16px}.v357-head{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e0eee9;padding-bottom:10px;margin-bottom:12px}.v357-head h2{margin:0;color:#073f33}.v357-btn{border:0;border-radius:11px;padding:9px 14px;font-weight:900;cursor:pointer;background:#074d3f;color:#fff}.v357-btn.red{background:#bd3434}.v357-grid{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:10px;flex:1}.v357-box{background:#f8fcfa;border:1px solid #d9eae4;border-radius:14px;padding:11px;min-height:58px}.v357-box small{display:block;color:#718079;margin-bottom:5px}.v357-box b{color:#073f33;font-size:17px}.v357-img{width:230px;height:235px;background:#eef8f4;border:1px solid #d9eae4;border-radius:18px;display:grid;place-items:center;overflow:hidden}.v357-flex{display:flex;gap:14px;align-items:flex-start;justify-content:space-between}.v357-note{background:#fff6df;border:1px dashed #d9a431;color:#664400;border-radius:13px;padding:10px;margin:12px 0;font-weight:800}.v357-table{width:100%;border-collapse:separate;border-spacing:0 8px}.v357-table th{background:#eef8f4;color:#073f33;padding:9px;text-align:center}.v357-table td{background:#fff;border-top:1px solid #d9eae4;border-bottom:1px solid #d9eae4;padding:9px;text-align:center}.v357-table td:first-child{border-right:1px solid #d9eae4;border-radius:0 12px 12px 0}.v357-table td:last-child{border-left:1px solid #d9eae4;border-radius:12px 0 0 12px}.v357-chip{display:inline-block;border-radius:999px;padding:4px 9px;background:#eaf8f4;color:#064737;font-weight:900}.v357-chip.out{background:#fff0cf;color:#7a5200}.v357-chip.ret{background:#eaf2ff;color:#174c8b}.v357-chip.pending{background:#fff8dd;color:#8a6200}.v357-image-field{border:1px dashed #b9dbcf;background:#f6fcf9;border-radius:14px;padding:10px;margin-top:8px}.v357-image-field label{font-weight:900;color:#074d3f}.v357-image-field input{margin-top:8px;width:100%}
      @media(max-width:850px){.v357-flex{flex-direction:column}.v357-img{width:100%;height:180px}.v357-grid{grid-template-columns:1fr 1fr}}
    `; document.head.appendChild(st);
  }
  function modal(title,body){css();document.querySelector('.v357-modal')?.remove();const d=document.createElement('div');d.className='v357-modal';d.innerHTML=`<div class="v357-panel"><div class="v357-head"><button class="v357-btn red" onclick="this.closest('.v357-modal').remove()">إغلاق</button><h2>${E(title)}</h2></div>${body}</div>`;document.body.appendChild(d);}

  window.inventoryOpenItemSmart=window.v118ShowProductDetail=window.inventoryViewProductV355=window.inventoryViewProductV356=window.inventoryViewProductV357=function(itemId){
    const st=compute(itemId); if(!st) return alert('المنتج غير موجود'); sync(itemId);
    const it={...st.it,qty:st.remaining,quantity:st.remaining}; const unit=st.unit;
    const batchRows=st.batches.map((b,i)=>{const before=N(b.qty_remaining)*N(b.unit_before);return `<tr><td>${E(b.label||`الدفعة ${i+1}`)}</td><td>${E(b.source||'-')}</td><td>${E(b.date||'-')}</td><td>${b.qty_initial}</td><td>${b.used}</td><td>${b.qty_remaining}</td><td>${money(b.unit_before)}</td><td>${money(before)}</td><td>${money(before*VAT)}</td><td>${money(before*(1+VAT))}</td></tr>`;}).join('');
    const moveRows=st.ms.map(m=>{const ret=isReturn(m);const pend=isPending(m);const alloc=isAllocated(m);const label=ret?'مرتجع للمخزن':pend?'بانتظار توزيع':alloc?'موزع / مستهلك':isIn(typeOf(m))?'دخول':typeOf(m);const cls=ret?'ret':pend?'pending':isOut(typeOf(m))?'out':'';const q=qtyOf(m),c=costOfMove(m,it),before=q*c;return `<tr><td>${E(S(m.date||m.movement_date||m.created_at||'-').slice(0,10))}</td><td>MOV-${E(m.batch_no||m.batch_id||m.id||'-')}</td><td><span class="v357-chip ${cls}">${E(label)}</span></td><td>${q}</td><td>${E(m.project_name||m.order_no||m.general_note||'-')}</td><td>${money(c)}</td><td>${money(before)}</td><td>${E(S(m.notes||'').replace(/\[[^\]]+\]/g,'').trim()||'-')}</td></tr>`;}).join('')||'<tr><td colspan="8">لا توجد حركات</td></tr>';
    modal('عرض المنتج: '+(it.name||''),`
      <div class="v357-flex"><div class="v357-grid">
        <div class="v357-box"><small>اسم المنتج</small><b>${E(it.name||'-')}</b></div><div class="v357-box"><small>كود المنتج</small><b>${E(productCode(it)||'-')}</b></div><div class="v357-box"><small>كود الشركة / المورد</small><b>${E(supplierCode(it)||'-')}</b></div>
        <div class="v357-box"><small>التصنيف</small><b>${E(it.category||'-')}</b></div><div class="v357-box"><small>الوحدة</small><b>${E(it.unit||'-')}</b></div><div class="v357-box"><small>دخل المخزون</small><b>${st.entered}</b></div>
        <div class="v357-box"><small>خرج من المخزون</small><b>${st.out}</b></div><div class="v357-box"><small>موزع / مستهلك</small><b>${st.consumed}</b></div><div class="v357-box"><small>مرتجع للمخزن</small><b>${st.returns}</b></div>
        <div class="v357-box"><small>باقي لم يوزع</small><b>${st.pendingBalance}</b></div><div class="v357-box"><small>المتبقي الصحيح في المخزون</small><b>${st.remaining}</b></div><div class="v357-box"><small>سعر الحبة قبل الضريبة</small><b>${money(unit)}</b></div>
        <div class="v357-box"><small>ضريبة الحبة</small><b>${money(unit*VAT)}</b></div><div class="v357-box"><small>سعر الحبة شامل</small><b>${money(unit*(1+VAT))}</b></div><div class="v357-box"><small>إجمالي المتبقي شامل</small><b>${money(st.remaining*unit*(1+VAT))}</b></div>
      </div><div class="v357-img">${imgHtml(it)}</div></div>
      <div class="v357-note">الحساب الآن: المتبقي = دخل المخزون - خرج المخزون + المرتجع. مثال: دخل 10، خرج 10، موزع 9، مرتجع 1 = المتبقي في المخزون 1.</div>
      <h3>دفعات المنتج حسب FIFO</h3><div class="table-wrap"><table class="v357-table"><thead><tr><th>الدفعة</th><th>المصدر</th><th>التاريخ</th><th>دخل</th><th>خرج FIFO</th><th>متبقي</th><th>سعر قبل</th><th>إجمالي قبل</th><th>ضريبة</th><th>شامل</th></tr></thead><tbody>${batchRows}</tbody></table></div>
      <h3>حركات المنتج</h3><div class="table-wrap"><table class="v357-table"><thead><tr><th>التاريخ</th><th>رقم الحركة</th><th>النوع</th><th>الكمية</th><th>المشروع / الجهة</th><th>سعر الحبة</th><th>الإجمالي</th><th>ملاحظات</th></tr></thead><tbody>${moveRows}</tbody></table></div>`);
  };

  function ensureInvoiceImageField(){
    css();
    const card=document.getElementById('stockBatchCardV148');
    if(!card) return;
    const price=document.getElementById('batchUnitPriceV148');
    if(!price) return;
    const holder=document.getElementById('batchLineImagePreviewV148');
    const existingInput=card.querySelector('input[type="file"][onchange*="stockBatchHandleImageV148"]');
    if(existingInput){
      const box=existingInput.closest('div');
      if(box){ box.style.display=''; box.classList.remove('v160-optional-stock-field'); }
      holder && (holder.style.display='');
      return;
    }
    const box=document.createElement('div');
    box.className='v357-image-field';
    box.innerHTML=`<label>صورة المنتج</label><input type="file" accept="image/*" onchange="stockBatchHandleImageV148(this)"><small class="muted">اختياري للمنتج الموجود، ومهم للمنتج الجديد حتى تظهر الصورة في المخزون.</small>`;
    const parent=price.closest('div');
    if(parent) parent.insertAdjacentElement('afterend',box);
    if(holder) holder.style.display='';
  }

  function boot(){
    css();
    setTimeout(()=>{try{window.rebuildStockV357();}catch(e){console.warn('v357 rebuild',e);} ensureInvoiceImageField();},400);
    setTimeout(ensureInvoiceImageField,1200);
  }
  const oldFinanceRenderAll=window.financeRenderAll;
  if(typeof oldFinanceRenderAll==='function'&&!oldFinanceRenderAll.__v357Wrapped){
    window.financeRenderAll=function(){const r=oldFinanceRenderAll.apply(this,arguments); setTimeout(ensureInvoiceImageField,300); return r;};
    window.financeRenderAll.__v357Wrapped=true;
  }
  const oldFinanceShowTab=window.financeShowTab;
  if(typeof oldFinanceShowTab==='function'&&!oldFinanceShowTab.__v357Wrapped){
    window.financeShowTab=function(){const r=oldFinanceShowTab.apply(this,arguments); setTimeout(ensureInvoiceImageField,300); return r;};
    window.financeShowTab.__v357Wrapped=true;
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',()=>setTimeout(boot,700));
  console.log('Tasneef v357 inventory balance + invoice image fix loaded');
})();

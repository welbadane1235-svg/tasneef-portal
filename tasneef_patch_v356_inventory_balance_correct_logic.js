/* TASNEEF v356 - Correct inventory balance logic
   نطاق التعديل: عرض المنتج ورصيد المنتج فقط.
   المنطق الصحيح:
   - إضافة منتج للحركة = بانتظار توزيع ولا تدخل تكلفة مشروع.
   - عند توزيع 9 واختيار مرتجع 1 من أصل 10: المستهلك 9، المرتجع 1، المتبقي في المخزون 1.
   - لا نعتمد على الرصيد المحفوظ إذا كان متأثرًا بحساب سابق، بل نحسب من الحركات.
*/
(function(){
  'use strict';
  if(window.__tasneefV356InventoryBalanceCorrect) return;
  window.__tasneefV356InventoryBalanceCorrect = true;

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
  const isOut=t=>OUT_TYPES.has(S(t));
  const isRet=t=>RET_TYPES.has(S(t));
  const isIn=t=>IN_TYPES.has(S(t));
  const isApproved=m=>!S(m.status)||['معتمد','تم الصرف','approved','مؤكد','بانتظار','حاضر'].includes(S(m.status));
  const itemIdOf=m=>S(m.item_id||m.product_id||m.inventory_item_id);
  const qtyOf=m=>N(m.qty||m.quantity);
  const typeOf=m=>S(m.type||m.movement_type||m.kind);
  const isPending=m=>{
    const txt=`${m.distribution_status||''} ${m.notes||''} ${m.general_note||''}`;
    return /pending|PENDING_DISTRIBUTION|بانتظار توزيع/.test(txt);
  };
  const isReturnLine=m=>isRet(typeOf(m))||/\[RETURN\]|return/i.test(`${m.distribution_status||''} ${m.notes||''}`);
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
    return (Array.isArray(it.batches)?it.batches:[]).reduce((a,b)=>{
      // لا نستخدم qty_remaining لأنه قد يكون تعدل من حساب سابق خطأ.
      return a + N(b.qty_initial||b.initial_qty||b.entered||b.original_qty||b.qty||b.quantity||0);
    },0);
  }
  function compute(itemId){
    const it=items().find(i=>S(i.id)===S(itemId));
    if(!it) return null;
    const ms=moves().filter(m=>itemIdOf(m)===S(itemId)&&isApproved(m));
    const inQty=ms.filter(m=>isIn(typeOf(m))).reduce((a,m)=>a+qtyOf(m),0);
    const pendingOut=ms.filter(m=>isOut(typeOf(m))&&isPending(m)&&!isReturnLine(m)).reduce((a,m)=>a+qtyOf(m),0);
    const allocatedOut=ms.filter(m=>isOut(typeOf(m))&&!isPending(m)&&!isReturnLine(m)).reduce((a,m)=>a+qtyOf(m),0);
    const returns=ms.filter(m=>isReturnLine(m)).reduce((a,m)=>a+qtyOf(m),0);

    let entered=explicitEntered(it)||batchInitial(it)||inQty;
    const totalPhysicalOut=R2(pendingOut+allocatedOut);
    // إذا لا توجد كمية دخول واضحة، نعتبر أصل الحركة هو أعلى كمية خرجت من المنتج.
    // هذا يمنع تضخيم الرصيد بسبب quantity محفوظة خطأ من نسخة سابقة.
    if(!entered) entered=totalPhysicalOut || N(it.qty||it.quantity||it.stock||0);
    if(entered < totalPhysicalOut) entered=totalPhysicalOut;

    // المرتجع من كمية بانتظار التوزيع يعالج كأنه أنهى الجزء المتبقي للتوزيع.
    const effectivePending=R2(Math.max(0,pendingOut-returns));
    let consumed;
    if(pendingOut>0){
      consumed=R2(allocatedOut);
    }else{
      consumed=R2(Math.max(0,allocatedOut-returns));
    }
    let remaining=R2(Math.max(0,entered-consumed-effectivePending));

    const unit=costOfItem(it) || (ms.find(m=>N(costOfMove(m,it))) ? costOfMove(ms.find(m=>N(costOfMove(m,it))),it) : 0);
    const batches=[{label:'دفعة محسوبة',source:'FIFO',date:'-',qty_initial:entered,used:R2(consumed+effectivePending),qty_remaining:remaining,unit_before:unit}];
    return {it,ms,entered:R2(entered),pendingOut:R2(pendingOut),allocatedOut:R2(allocatedOut),out:R2(totalPhysicalOut),returns:R2(returns),effectivePending,consumed,remaining,unit,batches};
  }

  function css(){
    if(document.getElementById('v356Css')) return;
    const st=document.createElement('style'); st.id='v356Css'; st.textContent=`
      .v356-modal{position:fixed;inset:0;background:rgba(0,0,0,.48);z-index:1000003;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:18px;direction:rtl}
      .v356-panel{width:min(1100px,96vw);background:#fff;border-radius:22px;border:1px solid #d7e9e2;box-shadow:0 18px 70px rgba(0,0,0,.26);padding:16px}.v356-head{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e0eee9;padding-bottom:10px;margin-bottom:12px}.v356-head h2{margin:0;color:#073f33}.v356-btn{border:0;border-radius:11px;padding:9px 14px;font-weight:900;cursor:pointer;background:#074d3f;color:#fff}.v356-btn.red{background:#bd3434}.v356-grid{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:10px;flex:1}.v356-box{background:#f8fcfa;border:1px solid #d9eae4;border-radius:14px;padding:11px;min-height:58px}.v356-box small{display:block;color:#718079;margin-bottom:5px}.v356-box b{color:#073f33;font-size:17px}.v356-img{width:230px;height:235px;background:#eef8f4;border:1px solid #d9eae4;border-radius:18px;display:grid;place-items:center;overflow:hidden}.v356-flex{display:flex;gap:14px;align-items:flex-start;justify-content:space-between}.v356-note{background:#fff6df;border:1px dashed #d9a431;color:#664400;border-radius:13px;padding:10px;margin:12px 0;font-weight:800}.v356-table{width:100%;border-collapse:separate;border-spacing:0 8px}.v356-table th{background:#eef8f4;color:#073f33;padding:9px;text-align:center}.v356-table td{background:#fff;border-top:1px solid #d9eae4;border-bottom:1px solid #d9eae4;padding:9px;text-align:center}.v356-table td:first-child{border-right:1px solid #d9eae4;border-radius:0 12px 12px 0}.v356-table td:last-child{border-left:1px solid #d9eae4;border-radius:12px 0 0 12px}.v356-chip{display:inline-block;border-radius:999px;padding:4px 9px;background:#eaf8f4;color:#064737;font-weight:900}.v356-chip.out{background:#fff0cf;color:#7a5200}.v356-chip.ret{background:#eaf2ff;color:#174c8b}
      @media(max-width:850px){.v356-flex{flex-direction:column}.v356-img{width:100%;height:180px}.v356-grid{grid-template-columns:1fr 1fr}}
    `; document.head.appendChild(st);
  }
  function modal(title,body){css();document.querySelector('.v356-modal')?.remove();const d=document.createElement('div');d.className='v356-modal';d.innerHTML=`<div class="v356-panel"><div class="v356-head"><button class="v356-btn red" onclick="this.closest('.v356-modal').remove()">إغلاق</button><h2>${E(title)}</h2></div>${body}</div>`;document.body.appendChild(d);}

  function sync(itemId){
    const st=compute(itemId); if(!st) return;
    const all=items(); const idx=all.findIndex(i=>S(i.id)===S(itemId));
    if(idx>=0){ all[idx].qty=st.remaining; all[idx].quantity=st.remaining; all[idx].stock=st.remaining; all[idx].consumed_qty=st.consumed; all[idx].returned_qty=st.returns; setItems(all); }
  }
  window.rebuildStockV356=function(){items().forEach(i=>sync(i.id)); return items();};

  window.inventoryOpenItemSmart=window.v118ShowProductDetail=window.inventoryViewProductV355=window.inventoryViewProductV356=function(itemId){
    const st=compute(itemId); if(!st) return alert('المنتج غير موجود'); sync(itemId);
    const it={...st.it,qty:st.remaining,quantity:st.remaining}; const unit=st.unit;
    const batchRows=st.batches.map((b,i)=>{const before=N(b.qty_remaining)*N(b.unit_before);return `<tr><td>${E(b.label||`الدفعة ${i+1}`)}</td><td>${E(b.source||'-')}</td><td>${E(b.date||'-')}</td><td>${b.qty_initial}</td><td>${b.used}</td><td>${b.qty_remaining}</td><td>${money(b.unit_before)}</td><td>${money(before)}</td><td>${money(before*VAT)}</td><td>${money(before*(1+VAT))}</td></tr>`;}).join('');
    const moveRows=st.ms.map(m=>{const t=typeOf(m);const ret=isReturnLine(m);const pend=isPending(m);const label=ret?'مرتجع':pend?'بانتظار توزيع':isOut(t)?'استهلاك / صرف':isIn(t)?'دخول':t;const cls=ret?'ret':isOut(t)?'out':'';const q=qtyOf(m),c=costOfMove(m,it),before=q*c;return `<tr><td>${E(S(m.date||m.movement_date||m.created_at||'-').slice(0,10))}</td><td>MOV-${E(m.batch_no||m.batch_id||m.id||'-')}</td><td><span class="v356-chip ${cls}">${E(label)}</span></td><td>${q}</td><td>${E(m.project_name||m.order_no||m.general_note||'-')}</td><td>${money(c)}</td><td>${money(before)}</td><td>${E(S(m.notes||'').replace(/\[[^\]]+\]/g,'').trim()||'-')}</td></tr>`;}).join('')||'<tr><td colspan="8">لا توجد حركات</td></tr>';
    modal('عرض المنتج: '+(it.name||''),`
      <div class="v356-flex"><div class="v356-grid">
        <div class="v356-box"><small>اسم المنتج</small><b>${E(it.name||'-')}</b></div><div class="v356-box"><small>كود المنتج</small><b>${E(productCode(it)||'-')}</b></div><div class="v356-box"><small>كود الشركة / المورد</small><b>${E(supplierCode(it)||'-')}</b></div>
        <div class="v356-box"><small>التصنيف</small><b>${E(it.category||'-')}</b></div><div class="v356-box"><small>الوحدة</small><b>${E(it.unit||'-')}</b></div><div class="v356-box"><small>دخل المخزون</small><b>${st.entered}</b></div>
        <div class="v356-box"><small>خرج من المخزون</small><b>${st.out}</b></div><div class="v356-box"><small>بانتظار توزيع فعلي</small><b>${st.effectivePending}</b></div><div class="v356-box"><small>مرتجع</small><b>${st.returns}</b></div>
        <div class="v356-box"><small>المستهلك</small><b>${st.consumed}</b></div><div class="v356-box"><small>المتبقي الصحيح</small><b>${st.remaining}</b></div><div class="v356-box"><small>سعر الحبة قبل الضريبة</small><b>${money(unit)}</b></div>
        <div class="v356-box"><small>ضريبة الحبة</small><b>${money(unit*VAT)}</b></div><div class="v356-box"><small>سعر الحبة شامل</small><b>${money(unit*(1+VAT))}</b></div><div class="v356-box"><small>إجمالي المتبقي شامل</small><b>${money(st.remaining*unit*(1+VAT))}</b></div>
      </div><div class="v356-img">${imgHtml(it)}</div></div>
      <div class="v356-note">المعادلة المستخدمة: المتبقي = دخل المخزون - المستهلك - بانتظار التوزيع الفعلي. وإذا كان عندك 10 ودخل توزيع 9 ومرتجع 1، فالنتيجة: المستهلك 9 والمتبقي 1.</div>
      <h3>دفعات المنتج حسب FIFO</h3><div class="table-wrap"><table class="v356-table"><thead><tr><th>الدفعة</th><th>المصدر</th><th>التاريخ</th><th>دخل</th><th>خرج FIFO</th><th>متبقي</th><th>سعر قبل</th><th>إجمالي قبل</th><th>ضريبة</th><th>شامل</th></tr></thead><tbody>${batchRows}</tbody></table></div>
      <h3>حركات المنتج</h3><div class="table-wrap"><table class="v356-table"><thead><tr><th>التاريخ</th><th>رقم الحركة</th><th>النوع</th><th>الكمية</th><th>المشروع / الجهة</th><th>سعر الحبة</th><th>الإجمالي</th><th>ملاحظات</th></tr></thead><tbody>${moveRows}</tbody></table></div>`);
  };

  function boot(){css();setTimeout(()=>{try{window.rebuildStockV356();}catch(e){console.warn('v356 rebuild',e);}},700);}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  console.log('Tasneef v356 correct inventory balance loaded');
})();

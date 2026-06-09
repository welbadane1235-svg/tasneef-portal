/* Tasneef Supplier Return + Distributor Code Patch v10025
   محدود على المالية/المخزون فقط، ولا يلمس قسم الأوردرات.
   1) عند كتابة كود الموزع يتعرف على المنتج الموجود ويملأ بياناته.
   2) إضافة حركة مرتجع للمورد تظهر في حركات المورد وتنقص المخزون.
*/
(function(){
  'use strict';
  if(window.__tasneefSupplierReturnDistributorPatchV10025) return;
  window.__tasneefSupplierReturnDistributorPatchV10025 = true;

  const VERSION = 'supplier_return_distributor_code_v10025';
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
    if($('supplierReturnDistributorPatchStyleV10025')) return;
    const st=document.createElement('style');
    st.id='supplierReturnDistributorPatchStyleV10025';
    st.textContent = `
      .tasneef-code-match-v10025{margin-top:6px;background:#edf8f3;border:1px solid #cfe8dd;color:#07513f;border-radius:11px;padding:7px 9px;font-size:12px;font-weight:800}
      .tasneef-code-match-v10025.bad{background:#fff4df;border-color:#efd19a;color:#7a5200}
      .tasneef-return-modal-v10025 .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.tasneef-return-modal-v10025 label{display:block;margin:8px 0 4px;font-weight:800;color:#073d31}.tasneef-return-modal-v10025 input,.tasneef-return-modal-v10025 select,.tasneef-return-modal-v10025 textarea{width:100%}
      @media(max-width:700px){.tasneef-return-modal-v10025 .grid{grid-template-columns:1fr}}
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
    let box=$('finDistributorCodeMatchV10025');
    const input=$('finLineDistributorCodeV15');
    if(!input) return;
    if(!box){
      box=document.createElement('div');
      box.id='finDistributorCodeMatchV10025';
      input.insertAdjacentElement('afterend', box);
    }
    if(item){
      box.className='tasneef-code-match-v10025';
      box.innerHTML='تم التعرف على المنتج: <b>'+esc(item.name||'-')+'</b> — الكود الداخلي: <b>'+esc(itemCode(item)||'-')+'</b>';
    }else if(S(code)){
      box.className='tasneef-code-match-v10025 bad';
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
    if(!input || input.__tasneefDistributorRecognitionV10025) return;
    input.__tasneefDistributorRecognitionV10025 = true;
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

  window.financeProOpenSupplierReturnV10025 = function(supplier){
    supplier=S(supplier);
    if(!supplier) return alert('اسم المورد غير واضح');
    ensureMiniStyle();
    const html=`
      <div class="modal-backdrop tasneef-return-modal-v10025" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:999999;display:grid;place-items:center;padding:18px">
        <div class="card" style="width:min(760px,96vw);max-height:92vh;overflow:auto">
          <div class="fin-actions" style="justify-content:space-between"><h2>مرتجع للمورد: ${esc(supplier)}</h2><button class="danger" onclick="this.closest('.modal-backdrop').remove()">إغلاق</button></div>
          <div class="grid">
            <div><label>المنتج</label><select id="supplierReturnItemV10025">${supplierOptionsForReturn(supplier)}</select></div>
            <div><label>الكمية المرتجعة</label><input id="supplierReturnQtyV10025" type="number" min="0" step="0.01" placeholder="مثال 2"></div>
            <div><label>التاريخ</label><input id="supplierReturnDateV10025" type="date" value="${today()}"></div>
            <div><label>رقم فاتورة المورد</label><input id="supplierReturnInvoiceV10025" placeholder="اختياري"></div>
          </div>
          <label>ملاحظة</label><textarea id="supplierReturnNoteV10025" placeholder="سبب الإرجاع أو أي ملاحظة"></textarea>
          <div class="fin-soft" style="margin-top:10px">هذه الحركة ستظهر في حركات المورد باسم <b>مرتجع للمورد</b>، وستخصم الكمية من المخزون، ولن تدخل في تكلفة المشاريع أو الأوردرات.</div>
          <div class="fin-actions" style="margin-top:12px"><button onclick="financeProSaveSupplierReturnV10025('${esc(supplier).replace(/'/g,'&#039;')}', this)">حفظ المرتجع</button></div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  };

  async function recalcOrFallback(item, qty){
    if(!window.sb || !item) return;
    try{
      const rpc = await sb.rpc('tasneef_recalc_inventory_item_qty_v10025', {p_item_id:String(item.id)});
      if(!rpc.error) return;
      console.warn('recalc rpc failed, fallback update', rpc.error);
    }catch(e){ console.warn('recalc rpc exception, fallback update', e); }
    const next=Math.max(0, N(item.quantity)-N(qty));
    await sb.from('inventory_items').update({quantity:next}).eq('id', item.id);
  }

  window.financeProSaveSupplierReturnV10025 = async function(supplier, btn){
    try{
      if(btn) btn.disabled=true;
      if(!window.sb) throw new Error('الاتصال غير جاهز');
      supplier=S(supplier);
      const itemId=S($('supplierReturnItemV10025')?.value);
      const item=A(state().items).find(i=>String(i.id)===itemId);
      if(!item) throw new Error('اختر المنتج');
      const qty=N($('supplierReturnQtyV10025')?.value);
      if(qty<=0) throw new Error('اكتب الكمية المرتجعة');
      if(N(item.quantity)>0 && qty>N(item.quantity)) throw new Error('الكمية المرتجعة أكبر من المتوفر في المخزون');
      const date=S($('supplierReturnDateV10025')?.value)||today();
      const supplierInvoiceNo=S($('supplierReturnInvoiceV10025')?.value);
      const note=S($('supplierReturnNoteV10025')?.value);
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
      document.querySelector('.tasneef-return-modal-v10025')?.remove();
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
      if(!supplier || card.__supplierReturnPatchedV10025) return;
      card.__supplierReturnPatchedV10025=true;
      const actions=card.querySelector('.fin-actions') || h2.parentElement;
      if(actions){
        const b=document.createElement('button');
        b.type='button';
        b.className='light';
        b.textContent='تسجيل مرتجع للمورد';
        b.onclick=function(){ window.financeProOpenSupplierReturnV10025(supplier); };
        actions.appendChild(b);
      }
      // تحسين تسمية الحركة داخل جدول حركات المورد
      card.querySelectorAll('td').forEach(td=>{
        if(S(td.textContent)==='supplier_return') td.textContent='مرتجع للمورد';
      });
    });
  }

  // تحسين تسمية نوع الحركة في أي جدول بعد العرض
  function normalizeSupplierReturnLabels(){
    document.querySelectorAll('td, span, b').forEach(el=>{
      if(S(el.textContent)==='supplier_return') el.textContent='مرتجع للمورد';
    });
  }

  function boot(){
    attachDistributorCodeRecognition();
    patchSupplierModalButtons();
    normalizeSupplierReturnLabels();
  }

  document.addEventListener('input', function(e){
    if(e.target && e.target.id === 'finLineDistributorCodeV15') setTimeout(fillExistingProductByDistributorCode, 80);
  }, true);
  document.addEventListener('click', function(){ setTimeout(boot, 250); }, true);
  document.addEventListener('change', function(){ setTimeout(boot, 120); }, true);
  setInterval(boot, 1000);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('load', boot);
  console.log('Tasneef '+VERSION+' loaded');
})();

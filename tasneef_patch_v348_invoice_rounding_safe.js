/* TASNEEF v348 - SAFE invoice VAT rounding fix
   يحل ملاحظة: السعر قبل الضريبة 8.70 × 10 = الإجمالي شامل 100.00
   بدون لمس الصلاحيات أو إدارة المستخدمين. */
(function(){
  if(window.__tasneefV348InvoiceRoundingSafe) return;
  window.__tasneefV348InvoiceRoundingSafe = true;

  const VAT = 0.15;
  const $ = id => document.getElementById(id);
  const A = v => Array.isArray(v) ? v : [];
  const S = v => String(v ?? '').trim();
  const N = v => { const x = Number(String(v ?? '').replace(/,/g,'')); return Number.isFinite(x) ? x : 0; };
  const R2 = v => Math.round((N(v) + Number.EPSILON) * 100) / 100;
  const R4 = v => Math.round((N(v) + Number.EPSILON) * 10000) / 10000;
  const M = v => N(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const Q = v => N(v).toLocaleString('en-US',{maximumFractionDigits:2});
  const E = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const dataSafe = () => window.data || {};
  const todaySafe = () => (typeof today === 'function' ? today() : new Date().toISOString().slice(0,10));
  const msgSafe = (t,c) => { try{ (window.msg || alert)(t,c); }catch(_){ alert(t); } };
  const lines = () => Array.isArray(window.batchLinesV148) ? window.batchLinesV148 : [];

  function currentMode(){ return $('batchVatModeV148')?.value || 'exclusive'; }

  // طريقة الحساب الجديدة: نعتمد سعر الحبة الشامل بعد التقريب، ثم نضرب في الكمية.
  // هذا يمنع ظهور 100.05 عند إدخال 8.70 × 10، ويجعلها 100.00 مثل فاتورة المورد.
  function calcUnit(inputPrice, mode){
    const price = N(inputPrice); mode = mode || 'exclusive';
    if(price <= 0) return {net:0, vat:0, gross:0};
    if(mode === 'inclusive'){
      const gross = R2(price);
      const net = R2(gross / (1 + VAT));
      const vat = R2(gross - net);
      return {net, vat, gross};
    }
    if(mode === 'exempt'){
      const net = R2(price);
      return {net, vat:0, gross:net};
    }
    const net = R2(price);
    const gross = R2(net * (1 + VAT));
    const vat = R2(gross - net);
    return {net, vat, gross};
  }
  function calcLine(line, mode){
    const q = N(line.quantity);
    const c = calcUnit(line.unit_price, mode);
    const lineNet = R2(c.net * q);
    const lineGross = R2(c.gross * q);
    const lineVat = R2(lineGross - lineNet);
    return {...c, q, lineNet, lineVat, lineGross};
  }
  window.tasneefInvoiceCalcUnitV348 = calcUnit;
  window.tasneefInvoiceCalcLineV348 = calcLine;

  function ensureHeader(){
    const body = $('batchLinesBodyV148'); if(!body) return;
    const tr = body.closest('table')?.querySelector('thead tr'); if(!tr) return;
    tr.innerHTML = ['كود المنتج','الصنف','الكمية','الوحدة','سعر قبل الضريبة','VAT 15%','سعر شامل','الإجمالي شامل','حذف'].map(h=>`<th>${h}</th>`).join('');
  }

  window.stockBatchRenderLinesV148 = function(){
    const body = $('batchLinesBodyV148'); if(!body) return;
    ensureHeader();
    const mode = currentMode();
    let totalNet=0, totalVat=0, totalGross=0;
    body.innerHTML = lines().map(l => {
      const c = calcLine(l, mode);
      totalNet += c.lineNet; totalVat += c.lineVat; totalGross += c.lineGross;
      return `<tr>
        <td>${E(l.product_code)}</td>
        <td><b>${E(l.item_name)}</b><br><small>${E(l.category||'')} / ${E(l.item_type||'')}</small></td>
        <td>${Q(c.q)}</td>
        <td>${E(l.unit || 'حبة')}</td>
        <td>${M(c.net)} ر.س</td>
        <td>${M(c.vat)} ر.س</td>
        <td>${M(c.gross)} ر.س</td>
        <td><b>${M(c.lineGross)} ر.س</b></td>
        <td><button class="danger" type="button" onclick="stockBatchRemoveLineV148('${E(l.product_code)}')">حذف</button></td>
      </tr>`;
    }).join('') || '<tr><td colspan="9">لم تتم إضافة أصناف بعد</td></tr>';
    const totals = $('batchTotalsV148');
    if(totals) totals.innerHTML = `<b>Total amount before 15% VAT:</b> ${M(totalNet)} SAR &nbsp; | &nbsp; <b>Total VAT 15%:</b> ${M(totalVat)} SAR &nbsp; | &nbsp; <b>Total Value with 15% VAT:</b> ${M(totalGross)} SAR`;
  };

  const oldAdd = window.stockBatchAddLineV148;
  window.stockBatchAddLineV148 = function(){
    const out = oldAdd ? oldAdd.apply(this, arguments) : undefined;
    setTimeout(() => { try{ window.stockBatchRenderLinesV148(); }catch(_){} }, 30);
    return out;
  };

  function itemByCode(code){
    const arr = A(dataSafe().inventoryItems);
    return arr.find(i => [i.serial_number,i.product_code,i.barcode,i.supplier_barcode].some(x => S(x) === S(code))) || null;
  }
  function itemById(id){ return A(dataSafe().inventoryItems).find(i => S(i.id) === S(id)) || null; }
  function findItem(line){
    try{ if(typeof findItemByCode === 'function') return findItemByCode(line.product_code); }catch(_){ }
    return itemByCode(line.product_code);
  }

  // حفظ الفاتورة بنفس حساب العرض؛ حتى لا يظهر رقم في الشاشة ورقم مختلف بعد الحفظ.
  window.stockBatchSaveV148 = async function(btn){
    try{
      if(btn) btn.disabled = true;
      const batchLines = lines();
      if(!batchLines.length) throw new Error('أضف صنفًا واحدًا على الأقل داخل الفاتورة');
      const supplier = S($('batchSupplierV148')?.value); if(!supplier) throw new Error('اختر أو اكتب اسم المورد');
      const invoiceNo = S($('batchInvoiceV148')?.value) || ('ADD-' + Date.now());
      const date = S($('batchDateV148')?.value) || todaySafe();
      const mode = currentMode();
      let netTotal=0, vatTotal=0, grossTotal=0; const saved=[];
      for(const l of batchLines){
        let item = findItem(l);
        if(!item && !l.image_url) throw new Error('الصنف الجديد '+(l.item_name||'')+' يحتاج صورة قبل الحفظ');
        const c = calcLine(l, mode);
        netTotal = R2(netTotal + c.lineNet); vatTotal = R2(vatTotal + c.lineVat); grossTotal = R2(grossTotal + c.lineGross);
        const q = N(l.quantity);
        if(item){
          const oldQty = N(item.quantity);
          const oldVal = oldQty * N(item.unit_cost || 0);
          const newQty = oldQty + q;
          const newAvg = newQty ? ((oldVal + c.lineNet) / newQty) : c.net;
          const upd = {quantity:newQty, unit_cost:R4(newAvg), supplier, category:l.category||item.category, unit:l.unit||item.unit, product_code:l.product_code, serial_number:l.product_code, barcode:l.product_code, supplier_barcode:l.product_code, item_type:l.item_type||item.item_type, type:l.item_type||item.type};
          const res = await sb.from('inventory_items').update(upd).eq('id', item.id).select('*').single();
          if(res.error) throw res.error; item = res.data;
        }else{
          const ins = {name:l.item_name, serial_number:l.product_code, product_code:l.product_code, barcode:l.product_code, supplier_barcode:l.product_code, image_url:l.image_url, category:l.category||'أخرى', item_type:l.item_type||'مادة', type:l.item_type||'مادة', unit:l.unit||'حبة', quantity:q, min_quantity:0, unit_cost:R4(c.net), supplier, notes:'تم إنشاؤه من فاتورة إدخال '+invoiceNo};
          const res = await sb.from('inventory_items').insert(ins).select('*').single();
          if(res.error) throw res.error; item = res.data;
        }
        const mv = {item_id:item.id, item_name:item.name, movement_type:'in', quantity:q, movement_date:date, project_id:null, project_name:'', receiver:supplier, reason:'إدخال مخزون - فاتورة '+invoiceNo, notes:'batch:'+invoiceNo, product_code:l.product_code, barcode:l.product_code, unit_cost:R4(c.net)};
        const mr = await sb.from('inventory_movements').insert(mv).select('*').single();
        if(mr.error) throw mr.error;
        saved.push({...l, item_id:item.id, unit_cost:R4(c.net), unit_vat:R4(c.vat), unit_gross:R4(c.gross), line_net:R2(c.lineNet), line_vat:R2(c.lineVat), line_gross:R2(c.lineGross), movement_id:mr.data.id});
      }
      try{
        if(typeof ensureBatchTablesExistV148 === 'function' && await ensureBatchTablesExistV148()){
          const br = await sb.from('inventory_batches').insert({batch_date:date, supplier, invoice_no:invoiceNo, vat_mode:mode, total_before_vat:R2(netTotal), total_vat:R2(vatTotal), total_with_vat:R2(grossTotal), notes:'فاتورة إدخال مخزون'}).select('*').single();
          if(br.error) throw br.error;
          const rows = saved.map(l => ({batch_id:br.data.id, item_id:l.item_id, product_code:l.product_code, item_name:l.item_name, category:l.category, item_type:l.item_type, unit:l.unit, quantity:l.quantity, unit_price_before_vat:R4(l.unit_cost), unit_vat:R4(l.unit_vat), unit_price_with_vat:R4(l.unit_gross), total_before_vat:R2(l.line_net), total_vat:R2(l.line_vat), total_with_vat:R2(l.line_gross), movement_id:l.movement_id}));
          const li = await sb.from('inventory_batch_items').insert(rows); if(li.error) throw li.error;
        }
      }catch(e){ console.warn('V348 optional batch table warning', e); }
      msgSafe('تم حفظ الفاتورة بحساب الضريبة الصحيح','ok');
      if(typeof stockBatchPrintV148 === 'function') stockBatchPrintV148({invoice_no:invoiceNo,batch_date:date,supplier,vat_mode:mode,lines:saved,total_before_vat:R2(netTotal),total_vat:R2(vatTotal),total_with_vat:R2(grossTotal)});
      if(typeof stockBatchClearV148 === 'function') stockBatchClearV148(); else window.batchLinesV148=[];
      if(typeof financeLoadAll === 'function') await financeLoadAll();
      setTimeout(() => { try{ window.stockBatchRenderLinesV148(); window.financeRenderReports&&window.financeRenderReports(); }catch(_){} }, 250);
    }catch(e){ msgSafe(e.message || String(e), 'err'); }
    finally{ if(btn) btn.disabled = false; }
  };

  window.stockBatchPrintDraftV148 = function(){
    const mode = currentMode(); let net=0,vat=0,gross=0;
    const saved = lines().map(l => { const c=calcLine(l, mode); net=R2(net+c.lineNet); vat=R2(vat+c.lineVat); gross=R2(gross+c.lineGross); return {...l,unit_cost:R4(c.net),unit_vat:R4(c.vat),unit_gross:R4(c.gross),line_net:R2(c.lineNet),line_vat:R2(c.lineVat),line_gross:R2(c.lineGross)}; });
    if(typeof stockBatchPrintV148 === 'function') stockBatchPrintV148({invoice_no:S($('batchInvoiceV148')?.value)||'مسودة',batch_date:S($('batchDateV148')?.value)||todaySafe(),supplier:S($('batchSupplierV148')?.value)||'-',vat_mode:mode,lines:saved,total_before_vat:net,total_vat:vat,total_with_vat:gross});
  };

  document.addEventListener('input', e => { if(e.target && ['batchQtyV148','batchUnitPriceV148'].includes(e.target.id)) setTimeout(()=>window.stockBatchRenderLinesV148&&window.stockBatchRenderLinesV148(),20); }, true);
  document.addEventListener('change', e => { if(e.target && e.target.id === 'batchVatModeV148') setTimeout(()=>window.stockBatchRenderLinesV148&&window.stockBatchRenderLinesV148(),20); }, true);
  setTimeout(()=>{ try{ window.stockBatchRenderLinesV148&&window.stockBatchRenderLinesV148(); }catch(_){} }, 1200);
  console.log('Tasneef v348 invoice rounding safe loaded');
})();

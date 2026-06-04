/* TASNEEF v350 - Edit button for products inside inventory movement/invoice draft
   الهدف:
   - إضافة زر تعديل بجانب كل منتج داخل الحركة/الفاتورة قبل الحفظ.
   - عند الضغط على تعديل يرجع بيانات السطر في نموذج الإدخال، ويحذف السطر مؤقتًا من القائمة حتى لا يتكرر.
   - بعد تعديل الكمية/السعر/الاسم اضغط زر الإضافة نفسه لإعادته بالقيم الجديدة.
   - لا يلمس الصلاحيات أو المستخدمين أو الحضور أو العقود.
*/
(function(){
  'use strict';
  if(window.__tasneefV350InvoiceLineEdit) return;
  window.__tasneefV350InvoiceLineEdit = true;

  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const N = v => { const x = parseFloat(String(v ?? '0').replace(/,/g,'')); return Number.isFinite(x) ? x : 0; };
  const R2 = v => Math.round((N(v) + Number.EPSILON) * 100) / 100;
  const E = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const M = v => N(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const Q = v => N(v).toLocaleString('en-US',{maximumFractionDigits:2});
  const VAT = 0.15;

  function arr(){
    if(!Array.isArray(window.batchLinesV148)) window.batchLinesV148 = [];
    try{ if(typeof batchLinesV148 !== 'undefined') batchLinesV148 = window.batchLinesV148; }catch(_){ }
    return window.batchLinesV148;
  }
  function sync(a){
    window.batchLinesV148 = Array.isArray(a) ? a : [];
    try{ if(typeof batchLinesV148 !== 'undefined') batchLinesV148 = window.batchLinesV148; }catch(_){ }
  }
  function mode(){ return $('batchVatModeV148')?.value || 'exclusive'; }
  function calcUnit(price, vatMode){
    price = N(price); vatMode = vatMode || mode();
    if(vatMode === 'inclusive'){
      const gross = R2(price);
      const net = R2(gross / (1 + VAT));
      return {net, vat:R2(gross - net), gross};
    }
    if(vatMode === 'exempt'){
      const net = R2(price);
      return {net, vat:0, gross:net};
    }
    const net = R2(price);
    const gross = R2(net * (1 + VAT));
    return {net, vat:R2(gross - net), gross};
  }
  function calcLine(line){
    if(window.tasneefInvoiceCalcLineV348){
      try{ return window.tasneefInvoiceCalcLineV348(line, mode()); }catch(_){ }
    }
    const c = calcUnit(line.unit_price, mode());
    const q = N(line.quantity);
    const lineNet = R2(c.net * q);
    const lineGross = R2(c.gross * q);
    return {...c, q, lineNet, lineVat:R2(lineGross - lineNet), lineGross};
  }
  function setVal(id,v){ const el=$(id); if(el) el.value = v ?? ''; }
  function setSelect(id,v){ const el=$(id); if(!el) return; el.value = v ?? ''; if(el.value !== String(v ?? '')){ const opt=document.createElement('option'); opt.value=v; opt.textContent=v; el.appendChild(opt); el.value=v; } }
  function msgSafe(t,c){ try{ if(typeof msg === 'function') msg(t,c); else alert(t); }catch(_){ alert(t); } }

  function ensureHeader(){
    const body = $('batchLinesBodyV148'); if(!body) return;
    const tr = body.closest('table')?.querySelector('thead tr'); if(!tr) return;
    tr.innerHTML = ['كود المنتج','الصنف','الكمية','الوحدة','سعر قبل الضريبة','VAT 15%','سعر شامل','الإجمالي شامل','إجراء'].map(h=>`<th>${h}</th>`).join('');
  }

  function fillForm(line){
    setVal('batchProductCodeV148', line.product_code || '');
    setVal('batchProductNameV148', line.item_name || '');
    setVal('batchCategoryV148', line.category || '');
    setSelect('batchItemTypeV148', line.item_type || 'مادة');
    setSelect('batchUnitV148', line.unit || 'حبة');
    setVal('batchQtyV148', N(line.quantity) || '');
    setVal('batchUnitPriceV148', N(line.unit_price) || '');
    try{ if(typeof pendingLineImageV148 !== 'undefined') pendingLineImageV148 = line.image_url || ''; }catch(_){ }
    const preview = $('batchLineImagePreviewV148');
    if(preview){
      preview.innerHTML = line.image_url ? `<img src="${E(line.image_url)}" style="max-width:90px;max-height:70px;border-radius:10px">` : '';
    }
    ['batchProductCodeV148','batchProductNameV148','batchQtyV148','batchUnitPriceV148'].forEach(id=>{
      const el=$(id); if(el){ el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }
    });
  }

  window.stockBatchEditLineV350 = function(index){
    const a = arr();
    index = Number(index);
    const line = a[index];
    if(!line) return alert('لم يتم العثور على السطر المطلوب تعديله');
    fillForm(line);
    a.splice(index,1);
    sync(a);
    window.__tasneefV350EditingLine = line;
    try{ window.stockBatchRenderLinesV148 && window.stockBatchRenderLinesV148(); }catch(_){ }
    const btn = Array.from(document.querySelectorAll('button')).find(b => /إضافة الصنف|إضافة المنتج|إضافة صنف|إضافة/.test(S(b.textContent)) && b.closest('#stockBatchCardV148, .nested-card, .card'));
    if(btn){ btn.textContent = 'حفظ تعديل المنتج داخل الحركة'; btn.classList.add('v350-editing-btn'); }
    const code = $('batchProductCodeV148');
    code?.scrollIntoView({behavior:'smooth',block:'center'});
    setTimeout(()=>{ try{ $('batchQtyV148')?.focus(); }catch(_){ } },250);
    msgSafe('تم فتح المنتج للتعديل، عدّل الكمية أو السعر ثم اضغط حفظ تعديل المنتج داخل الحركة','ok');
  };

  window.stockBatchRemoveLineIndexV350 = function(index){
    if(!confirm('حذف هذا المنتج من الحركة؟')) return;
    const a = arr();
    a.splice(Number(index),1);
    sync(a);
    try{ window.stockBatchRenderLinesV148 && window.stockBatchRenderLinesV148(); }catch(_){ }
  };

  // نبقي الدالة القديمة موجودة للتوافق، لكن نعالج الحذف بدقة إذا أرسل كود.
  const oldRemove = window.stockBatchRemoveLineV148;
  window.stockBatchRemoveLineV148 = function(code){
    const a = arr();
    const idx = a.findIndex(l => S(l.product_code) === S(code));
    if(idx >= 0) return window.stockBatchRemoveLineIndexV350(idx);
    if(typeof oldRemove === 'function') return oldRemove.apply(this, arguments);
  };

  window.stockBatchRenderLinesV148 = function(){
    const body = $('batchLinesBodyV148'); if(!body) return;
    ensureHeader();
    const a = arr();
    let totalNet=0, totalVat=0, totalGross=0;
    body.innerHTML = a.map((l,idx) => {
      const c = calcLine(l);
      totalNet = R2(totalNet + N(c.lineNet));
      totalVat = R2(totalVat + N(c.lineVat));
      totalGross = R2(totalGross + N(c.lineGross));
      return `<tr data-v350-line="${idx}">
        <td>${E(l.product_code || '')}</td>
        <td><b>${E(l.item_name || '')}</b><br><small>${E(l.category || '')} / ${E(l.item_type || '')}</small></td>
        <td>${Q(c.q ?? l.quantity)} ${E(l.unit || 'حبة')}</td>
        <td>${E(l.unit || 'حبة')}</td>
        <td>${M(c.net)} ر.س</td>
        <td>${M(c.vat)} ر.س</td>
        <td>${M(c.gross)} ر.س</td>
        <td><b>${M(c.lineGross)} ر.س</b></td>
        <td style="white-space:nowrap">
          <button class="light" type="button" onclick="stockBatchEditLineV350(${idx})">تعديل</button>
          <button class="danger" type="button" onclick="stockBatchRemoveLineIndexV350(${idx})">حذف</button>
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="9">لم تتم إضافة أصناف بعد</td></tr>';
    const totals = $('batchTotalsV148');
    if(totals){
      totals.innerHTML = `<b>خالي من الضريبة:</b> ${M(totalNet)} ر.س &nbsp; | &nbsp; <b>قيمة الضريبة:</b> ${M(totalVat)} ر.س &nbsp; | &nbsp; <b>شامل الضريبة:</b> ${M(totalGross)} ر.س`;
    }
  };

  const oldAdd = window.stockBatchAddLineV148;
  window.stockBatchAddLineV148 = function(){
    const out = oldAdd ? oldAdd.apply(this, arguments) : undefined;
    window.__tasneefV350EditingLine = null;
    setTimeout(()=>{
      try{ window.stockBatchRenderLinesV148 && window.stockBatchRenderLinesV148(); }catch(_){ }
      document.querySelectorAll('.v350-editing-btn').forEach(b=>{ b.textContent='إضافة المنتج للحركة'; b.classList.remove('v350-editing-btn'); });
    },60);
    return out;
  };

  function css(){
    if($('v350LineEditCss')) return;
    const st=document.createElement('style'); st.id='v350LineEditCss';
    st.textContent = `#batchLinesBodyV148 button.light{background:#eef7f3;color:#064a3a;border:1px solid #cfe5dc;border-radius:10px;padding:7px 10px;font-weight:900;margin-inline:2px}#batchLinesBodyV148 button.danger{border-radius:10px;padding:7px 10px;font-weight:900;margin-inline:2px}.v350-editing-btn{background:#0b6650!important}`;
    document.head.appendChild(st);
  }

  function boot(){ css(); try{ window.stockBatchRenderLinesV148 && window.stockBatchRenderLinesV148(); }catch(_){ } }
  ['DOMContentLoaded','load'].forEach(ev=>window.addEventListener(ev,()=>setTimeout(boot, ev==='load'?900:250)));
  setTimeout(boot,1200);
  console.log('Tasneef v350 invoice line edit loaded');
})();

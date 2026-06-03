/* TASNEEF v320 - Purchase invoice smart VAT modes + product name/code lookup */
(function(){
  'use strict';
  const LS={suppliers:'tasneef_v312_suppliers',items:'tasneef_v312_items',purchases:'tasneef_v312_purchases',moves:'tasneef_v312_moves'};
  const VAT_DEFAULT=15;
  const $=id=>document.getElementById(id);
  const parse=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')||[]}catch(_){return[]}};
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const n=v=>Number(v||0)||0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=v=>n(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';
  const today=()=>new Date().toISOString().slice(0,10);
  let purchaseLines=[];
  function supplierOptions(v=''){return '<option value="">اختر المورد</option>'+parse(LS.suppliers).map(s=>`<option value="${esc(s.id)}" ${String(v)===String(s.id)?'selected':''}>${esc(s.name)}</option>`).join('');}
  function supplierName(id){const s=parse(LS.suppliers).find(x=>String(x.id)===String(id));return s?s.name:'-';}
  function findItemByToken(token){
    token=String(token||'').trim().toLowerCase(); if(!token) return null;
    const items=parse(LS.items);
    return items.find(i=>[i.name,i.code,i.company_code].some(v=>String(v||'').toLowerCase()===token)) ||
           items.find(i=>[i.name,i.code,i.company_code].some(v=>String(v||'').toLowerCase().includes(token))) || null;
  }
  function itemById(id){return parse(LS.items).find(i=>String(i.id)===String(id))||null;}
  function itemLabel(i){return [i.name,i.code,i.company_code].filter(Boolean).join(' | ');}
  function itemOptionsList(){
    return parse(LS.items).map(i=>`<option value="${esc(i.name||'')}">${esc(itemLabel(i))}</option><option value="${esc(i.code||'')}">${esc(itemLabel(i))}</option><option value="${esc(i.company_code||'')}">${esc(itemLabel(i))}</option>`).join('');
  }
  function calcUnitByMode(input,rate,mode){
    input=n(input); rate=n(rate||VAT_DEFAULT); mode=mode||'before';
    if(mode==='included'){
      const after=input; const before=rate? after/(1+rate/100):after; const vat=after-before; return {before,vat,after,input};
    }
    // before/exclusive both mean the entered price is before VAT.
    const before=input; const vat=before*rate/100; return {before,vat,after:before+vat,input};
  }
  function lineCalc(qty,unitInput,rate,mode){
    const unit=calcUnitByMode(unitInput,rate,mode); qty=n(qty);
    return {unit_before:unit.before,unit_vat:unit.vat,unit_after:unit.after,before:unit.before*qty,vat:unit.vat*qty,after:unit.after*qty};
  }
  function purchaseTotals(p){return (p.lines||[]).reduce((a,l)=>({before:a.before+n(l.before??n(l.qty)*n(l.price)),vat:a.vat+n(l.vat),after:a.after+n(l.after??l.total)}),{before:0,vat:0,after:0});}
  function imageBox(src){return src?`<img src="${src}" alt="صورة المنتج" loading="lazy">`:'<span>لا توجد صورة</span>';}
  function ensureStyle(){
    if($('styleFinanceV320')) return;
    const st=document.createElement('style'); st.id='styleFinanceV320'; st.textContent=`
      .fi-smart-line-box{border:1px solid #dce6e2;background:#fbfdfc;border-radius:18px;padding:12px;display:grid;gap:10px}.fi-smart-line-grid{display:grid;grid-template-columns:1.4fr .7fr .8fr .8fr;gap:8px;align-items:end}.fi-product-live{border:1px dashed #bdd8cf;background:#f8fcfa;border-radius:16px;padding:10px;display:grid;grid-template-columns:78px 1fr;gap:10px;align-items:center;min-height:84px}.fi-product-live .img{height:70px;border-radius:14px;background:#eef6f3;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#789}.fi-product-live .img img{width:100%;height:100%;object-fit:cover}.fi-product-live b{color:#073e31}.fi-product-live small{display:block;color:#687a74;line-height:1.65}.fi-mode-pills{display:flex;gap:7px;flex-wrap:wrap}.fi-mode-pills label{border:1px solid #dce6e2;border-radius:999px;padding:8px 10px;background:#fff;cursor:pointer;font-size:12px}.fi-mode-pills input{width:auto;margin-inline-end:5px}.fi-vat-preview .box strong{display:block;color:#073e31;font-size:17px;margin-top:4px}.fi-purchase-line-v320{display:grid;grid-template-columns:2fr .7fr .9fr .9fr .9fr auto;gap:8px;align-items:center;border:1px solid #e6efeb;background:#fbfdfc;border-radius:14px;padding:10px;margin-bottom:8px}.fi-purchase-line-v320 small{display:block;color:#687a74}.fi-invoice-table-v320{width:100%;border-collapse:separate;border-spacing:0 8px}.fi-invoice-table-v320 th{font-size:12px;color:#687a74;text-align:right;padding:7px}.fi-invoice-table-v320 td{background:#fbfdfc;border-top:1px solid #e6efeb;border-bottom:1px solid #e6efeb;padding:10px}.fi-invoice-table-v320 td:first-child{border-right:1px solid #e6efeb;border-radius:0 12px 12px 0}.fi-invoice-table-v320 td:last-child{border-left:1px solid #e6efeb;border-radius:12px 0 0 12px}@media(max-width:1100px){.fi-smart-line-grid,.fi-purchase-line-v320{grid-template-columns:1fr}.fi-product-live{grid-template-columns:1fr}.fi-product-live .img{height:120px}}
    `; document.head.appendChild(st);
  }
  function totalsPreviewHTML(t){return `<div class="box"><small>السعر خالي من الضريبة</small><strong>${money(t.before||0)}</strong></div><div class="box"><small>قيمة الضريبة</small><strong>${money(t.vat||0)}</strong></div><div class="box"><small>السعر شامل الضريبة</small><strong>${money(t.after||0)}</strong></div>`;}
  function selectedMode(){return document.querySelector('input[name="purchasePriceModeV320"]:checked')?.value || 'before';}
  window.financeV320UpdateProductLookup=function(){
    const token=$('purchaseProductLookup')?.value||''; const it=findItemByToken(token); const hidden=$('purchaseItemId'); const box=$('purchaseProductInfo');
    if(hidden) hidden.value=it?.id||'';
    if(box){
      if(!it) box.innerHTML='<div class="img">؟</div><div><b>اكتب اسم المنتج أو الكود</b><small>سيظهر المنتج وبياناته تلقائيًا عند المطابقة.</small></div>';
      else box.innerHTML=`<div class="img">${imageBox(it.image_data||it.image_url||'')}</div><div><b>${esc(it.name||'-')}</b><small>الكود الداخلي: ${esc(it.code||'-')} | كود الشركة: ${esc(it.company_code||'-')}</small><small>التصنيف: ${esc(it.category||'-')} | الوحدة: ${esc(it.unit||'-')} | المتبقي: ${n(it.qty)}</small><small>المورد: ${esc(supplierName(it.supplier_id))}</small></div>`;
    }
    if(it && !$('purchasePriceInput')?.value){
      // Do not force a price, but suggest existing product before-tax price when empty.
      const price=n(it.price_before ?? it.price ?? 0); if(price) $('purchasePriceInput').value=price;
    }
    window.financeV320UpdateLineVat();
  };
  window.financeV320UpdateLineVat=function(){
    const qty=n($('purchaseQty')?.value); const unit=n($('purchasePriceInput')?.value); const rate=n($('purchaseVatRate')?.value||VAT_DEFAULT); const mode=selectedMode(); const c=lineCalc(qty||1,unit,rate,mode);
    const label=mode==='included'?'المدخل شامل الضريبة':(mode==='exclusive'?'المدخل خالي من الضريبة':'المدخل قبل الضريبة');
    const el=$('lineVatPreview'); if(el) el.innerHTML=totalsPreviewHTML(c)+`<div class="box"><small>طريقة السعر</small><strong>${label}</strong></div>`;
  };
  function renderPurchaseLines(){
    const el=$('purchaseLinesV320'); if(!el)return;
    el.innerHTML=purchaseLines.map((l,i)=>{const it=itemById(l.item_id)||{};return `<div class="fi-purchase-line-v320"><div><b>${esc(it.name||l.item_name||'-')}</b><small>${esc(it.code||'-')} · ${esc(l.price_mode_label||'')}</small></div><span>كمية: ${n(l.qty)}</span><span class="fi-money-before">خالي: ${money(l.before)}</span><span class="fi-money-vat">ضريبة: ${money(l.vat)}</span><span class="fi-money-after">شامل: ${money(l.after)}</span><button class="danger" onclick="financeV320RemovePurchaseLine(${i})">حذف</button></div>`}).join('')||'<div class="fi-empty-v319">لم تتم إضافة منتجات بعد</div>';
    const t=purchaseLines.reduce((a,l)=>({before:a.before+n(l.before),vat:a.vat+n(l.vat),after:a.after+n(l.after)}),{before:0,vat:0,after:0});
    const s=$('purchaseTotalsV320'); if(s)s.innerHTML=totalsPreviewHTML(t);
  }
  window.financeV320RemovePurchaseLine=function(i){purchaseLines.splice(i,1); renderPurchaseLines();};
  window.financeV312RenderPurchases=function(){
    ensureStyle(); purchaseLines=[]; const rows=parse(LS.purchases).slice(-80).reverse(); const body=$('fiBody_purchases'); if(!body)return;
    body.innerHTML=`<div class="fi-clean-layout"><div class="fi-clean-card"><h3>إضافة فاتورة شراء / إدخال مخزون</h3><div class="fi-clean-sub">اكتب المنتجات بالاسم أو الكود. اختر طريقة السعر: شامل الضريبة أو قبل/خالي من الضريبة، والنظام يحسب تلقائيًا.</div><div class="fi-clean-form" style="margin-top:12px"><div class="fi-clean-row"><div><label>رقم الفاتورة</label><input id="purchaseInvoiceNo"></div><div><label>تاريخ الفاتورة</label><input type="date" id="purchaseDate" value="${today()}"></div></div><label>المورد</label><select id="purchaseSupplier">${supplierOptions('')}</select><label>مرفق الفاتورة</label><input type="file" id="purchaseFile" accept=".pdf,image/*"><label>ملاحظات</label><textarea id="purchaseNotes"></textarea><div class="fi-smart-line-box"><h4 style="margin:0;color:#073e31">إضافة أكثر من صنف داخل نفس الفاتورة</h4><label>بحث المنتج بالاسم أو الكود</label><input id="purchaseProductLookup" list="purchaseProductListV320" placeholder="اكتب اسم المنتج أو الكود الداخلي أو كود الشركة" oninput="financeV320UpdateProductLookup()" onchange="financeV320UpdateProductLookup()"><datalist id="purchaseProductListV320">${itemOptionsList()}</datalist><input type="hidden" id="purchaseItemId"><div id="purchaseProductInfo" class="fi-product-live"><div class="img">؟</div><div><b>اكتب اسم المنتج أو الكود</b><small>سيتم التعرف على المنتج وإظهار بياناته تلقائيًا.</small></div></div><div class="fi-mode-pills"><label><input type="radio" name="purchasePriceModeV320" value="included" onchange="financeV320UpdateLineVat()"> السعر شامل الضريبة</label><label><input type="radio" name="purchasePriceModeV320" value="before" checked onchange="financeV320UpdateLineVat()"> السعر قبل الضريبة</label><label><input type="radio" name="purchasePriceModeV320" value="exclusive" onchange="financeV320UpdateLineVat()"> السعر خالي من الضريبة</label></div><div class="fi-smart-line-grid"><div><label>السعر الذي ستكتبه حسب الخيار أعلاه</label><input id="purchasePriceInput" type="number" step="0.01" oninput="financeV320UpdateLineVat()" placeholder="مثال: 100"></div><div><label>الكمية</label><input id="purchaseQty" type="number" step="0.01" oninput="financeV320UpdateLineVat()"></div><div><label>نسبة الضريبة %</label><input id="purchaseVatRate" type="number" step="0.01" value="15" oninput="financeV320UpdateLineVat()"></div><div class="fi-clean-actions"><button class="light" onclick="financeV312AddPurchaseLine()">إضافة الصنف</button></div></div><div id="lineVatPreview" class="fi-vat-preview">${totalsPreviewHTML({before:0,vat:0,after:0})}</div></div><h4>المنتجات داخل الفاتورة</h4><div id="purchaseLinesV320"></div><div id="purchaseTotalsV320" class="fi-vat-preview">${totalsPreviewHTML({before:0,vat:0,after:0})}</div><div class="fi-clean-actions"><button class="light" onclick="financeV312ClearPurchase()">تفريغ</button><button onclick="financeV312SavePurchase()">حفظ الفاتورة وزيادة المخزون</button></div></div></div><div class="fi-clean-card"><h3>آخر فواتير الشراء</h3><table class="fi-invoice-table-v320"><thead><tr><th>الفاتورة</th><th>المورد</th><th>التاريخ</th><th>خالي من الضريبة</th><th>الضريبة</th><th>شامل الضريبة</th></tr></thead><tbody>${rows.map(p=>{const t=purchaseTotals(p);return `<tr><td><b>${esc(p.invoice_no||p.id)}</b><br><small>${esc(p.file_name||'لا يوجد مرفق')}</small></td><td>${esc(supplierName(p.supplier_id))}</td><td>${esc(p.date||'')}</td><td class="fi-money-before">${money(t.before)}</td><td class="fi-money-vat">${money(t.vat)}</td><td class="fi-money-after">${money(t.after)}</td></tr>`}).join('')||'<tr><td colspan="6"><div class="fi-empty-v319">لا توجد فواتير</div></td></tr>'}</tbody></table></div></div>`;
    renderPurchaseLines(); window.financeV320UpdateLineVat();
  };
  window.financeV312AddPurchaseLine=function(){
    const item_id=$('purchaseItemId')?.value; const it=itemById(item_id); const qty=n($('purchaseQty')?.value); const unit=n($('purchasePriceInput')?.value); const rate=n($('purchaseVatRate')?.value||VAT_DEFAULT); const mode=selectedMode();
    if(!it) return alert('اكتب اسم المنتج أو الكود واختر منتجًا صحيحًا');
    if(!qty) return alert('اكتب الكمية');
    if(!unit) return alert('اكتب السعر حسب الخيار المحدد');
    const c=lineCalc(qty,unit,rate,mode); const label=mode==='included'?'شامل الضريبة':(mode==='exclusive'?'خالي من الضريبة':'قبل الضريبة');
    purchaseLines.push({item_id, item_name:it.name||'', qty, price_input:unit, price_mode:mode, price_mode_label:label, vat_rate:rate, price:c.unit_before, unit_before:c.unit_before, unit_vat:c.unit_vat, unit_after:c.unit_after, before:c.before, vat:c.vat, after:c.after, total:c.after});
    $('purchaseProductLookup').value=''; $('purchaseItemId').value=''; $('purchaseQty').value=''; $('purchasePriceInput').value='';
    window.financeV320UpdateProductLookup(); renderPurchaseLines(); window.financeV320UpdateLineVat();
  };
  window.financeV312SavePurchase=function(){
    if(!purchaseLines.length)return alert('أضف منتجات للفاتورة');
    const p={id:uid(),invoice_no:$('purchaseInvoiceNo')?.value||'',date:$('purchaseDate')?.value||today(),supplier_id:$('purchaseSupplier')?.value||'',file_name:$('purchaseFile')?.files?.[0]?.name||'',cost_type:'GENERAL',project_ids:[],order_no:'',notes:$('purchaseNotes')?.value||'',lines:[...purchaseLines]};
    const arr=parse(LS.purchases); arr.push(p); save(LS.purchases,arr);
    const items=parse(LS.items); purchaseLines.forEach(l=>{const it=items.find(x=>String(x.id)===String(l.item_id)); if(it){it.qty=n(it.qty)+n(l.qty); it.updated_at=new Date().toISOString();}}); save(LS.items,items);
    alert('تم حفظ الفاتورة وتحديث المخزون'); window.financeV312RenderPurchases();
  };
  window.financeV312ClearPurchase=function(){purchaseLines=[]; window.financeV312RenderPurchases();};
  const oldTab=window.financeV312Tab;
  window.financeV312Tab=function(tab,btn){const r=oldTab?oldTab.apply(this,arguments):undefined; setTimeout(()=>{if(tab==='purchases')window.financeV312RenderPurchases();},70); return r;};
  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.fi-tabs button'); if(!b)return; const t=b.textContent||''; if(t.includes('إضافة مخزون')||t.includes('فواتير'))setTimeout(()=>window.financeV312RenderPurchases(),90);},true);
})();

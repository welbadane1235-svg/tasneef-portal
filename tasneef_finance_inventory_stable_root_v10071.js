/* Tasneef Finance Inventory Stable Root v10071
   - No automatic refresh while writing.
   - Do not store invoice line images during operations (fast save).
   - Add/update product image from Products section.
   - Always show invoice-line Edit button for system managers/admins.
*/
(function(){
  'use strict';
  if(window.__financeInventoryStableRootV10071) return;
  window.__financeInventoryStableRootV10071 = true;

  const VERSION='v10071-finance-inventory-stability-no-image-lines';
  const VAT_RATE=0.15;
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const N=v=>Number(v||0)||0;
  const A=v=>Array.isArray(v)?v:[];
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=v=>`${N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س`;

  // أقفال نهائية ضد أي مزامنة تلقائية قديمة
  window.__tasneefFinanceDisableRealtime=true;
  window.__tasneefFinanceManualSyncOnly=true;
  window.__tasneefFinanceNoAutoReload=true;
  window.__financeInventoryNoAutoRefreshV10071=true;
  window.__tasneefFinanceInventorySaveSyncV10065=true;
  window.__tasneefFinanceInventoryGlobalSyncV10064=true;

  function st(){ return window.financeProStateV15 || (window.financeProStateV15={items:[],movements:[],invoiceLines:[],distribution:[]}); }
  function user(){ try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};} }
  function role(){ const u=user(); return S(u.role||u.user_role||u.type||u.position); }
  function isAdmin(){
    const u=user();
    const txt=[u.role,u.user_role,u.type,u.position,u.username,u.full_name,u.name,u.email].map(S).join(' ').toLowerCase();
    return /admin|system|manager|owner|مدير|النظام|ادارة|الإدارة/.test(txt);
  }
  function itemCode(i){ return S(i?.product_code||i?.serial_number||i?.barcode||i?.supplier_barcode||i?.code||''); }
  function itemCost(i){ return N(i?.unit_cost||i?.cost||i?.price||i?.purchase_price); }
  function productType(i){ return S(i?.item_type||i?.type||i?.category||'مادة')||'مادة'; }
  function rowVat(qty,price,mode='before'){
    const total=N(qty)*N(price);
    if(S(mode)==='after'){ const net=total/(1+VAT_RATE); return {net,vat:total-net,gross:total}; }
    if(S(mode)==='none') return {net:total,vat:0,gross:total};
    return {net:total,vat:total*VAT_RATE,gross:total*(1+VAT_RATE)};
  }
  function findItem(line){
    const ss=st();
    if(line.item_id||line.existing_item_id){ const id=line.item_id||line.existing_item_id; const f=A(ss.items).find(i=>String(i.id)===String(id)); if(f) return f; }
    const code=S(line.code||line.product_code);
    if(code){ const f=A(ss.items).find(i=>[i.id,i.product_code,i.serial_number,i.barcode,i.supplier_barcode].map(S).includes(code)); if(f) return f; }
    return A(ss.items).find(i=>S(i.name)===S(line.name))||null;
  }

  // أي تحديث يدوي فقط، وليس أثناء الكتابة
  function financeVisible(){ return !!document.querySelector('#financeDashboard:not(.hidden), .finance-tabs, #finInvoiceLinesV15'); }
  function hasActiveDraft(){
    const ss=st();
    const active=document.activeElement;
    const isWriting=active && /INPUT|TEXTAREA|SELECT/.test(active.tagName||'') && active.closest && active.closest('#financeDashboard, .card, body');
    const ids=['finInvSupplierV15','finInvNoV15','finExistingProductV15','finLineNameV15','finLineCodeV15','finLineQtyV15','finLinePriceV15','finMoveQtyV15','finMoveNoteV15'];
    return !!(isWriting || A(ss.invoiceLines).length || ids.some(id=>S($(id)?.value)));
  }

  // عطّل وظائف المزامنة القديمة لو بقيت محملة في الكاش
  function killOldSync(){
    try{ if(window.tasneefFinanceInventorySaveSyncV10065){ window.tasneefFinanceInventorySaveSyncV10065.refresh=function(){}; window.tasneefFinanceInventorySaveSyncV10065.broadcast=function(){}; window.tasneefFinanceInventorySaveSyncV10065.wrapAll=function(){}; } }catch(_){ }
    try{ if(window.tasneefFinanceGlobalSyncV10064){ window.tasneefFinanceGlobalSyncV10064.reload=function(){}; } }catch(_){ }
  }
  killOldSync();
  setInterval(killOldSync,3000);

  // منع رسالة/إجراء تحديث مالي تلقائي أثناء إدخال عملية
  function patchMsg(){
    if(window.__finV10071MsgPatched) return;
    window.__finV10071MsgPatched=true;
    const old=window.msg;
    if(typeof old==='function'){
      window.msg=function(text,type){
        if(financeVisible() && hasActiveDraft() && /تحديث المالية|تحديث البيانات|تم تحديث|مزامنة/.test(S(text))) return;
        return old.apply(this,arguments);
      };
    }
  }

  function lineFromFormNoImage(){
    const existing=A(st().items).find(i=>String(i.id)===String($('finExistingProductV15')?.value));
    return {
      existing_item_id: existing?existing.id:'',
      name:S($('finLineNameV15')?.value)||(existing?S(existing.name):''),
      code:S($('finLineCodeV15')?.value)||(existing?itemCode(existing):''),
      distributor_code:S($('finLineDistributorCodeV15')?.value)||(existing?S(existing.supplier_barcode||existing.distributor_code):''),
      supplier_invoice_no:S($('finLineSupplierInvoiceV15')?.value),
      qty:N($('finLineQtyV15')?.value),
      min_quantity:N($('finLineMinQtyV15')?.value)||N(existing?.min_quantity)||1,
      price:N($('finLinePriceV15')?.value),
      tax_mode:S($('finLineTaxModeV15')?.value)||'before',
      unit:S($('finLineUnitV15')?.value)||S(existing?.unit)||'حبة',
      item_type:S($('finLineTypeV15')?.value)||productType(existing)||'مادة',
      image:'' // لا نحفظ الصورة داخل العملية حتى لا يبطئ الحفظ ولا يسبب وميض
    };
  }

  function clearLineForm(){
    ['finLineNameV15','finLineDistributorCodeV15','finSupplierInvoiceV15','finLineSupplierInvoiceV15','finLineQtyV15','finLineMinQtyV15','finLinePriceV15'].forEach(id=>{ const el=$(id); if(el) el.value=''; });
    if($('finExistingProductV15')) $('finExistingProductV15').value='';
    if($('finLineImageV15')) $('finLineImageV15').value='';
    if($('finLineImageNameV15')) $('finLineImageNameV15').textContent='الصورة لا تحفظ مع العملية؛ أضف الصورة من قسم المنتجات';
    window.__financeProLineImageV15='';
  }

  function renderInvoiceLines(){
    const ss=st(); const box=$('finInvoiceLinesV15'); if(!box) return;
    const total=A(ss.invoiceLines).reduce((a,l)=>{ const c=rowVat(l.qty,l.price,l.tax_mode); a.net+=c.net; a.vat+=c.vat; a.gross+=c.gross; return a; },{net:0,vat:0,gross:0});
    const rows=A(ss.invoiceLines).map((l,idx)=>{
      const c=rowVat(l.qty,l.price,l.tax_mode);
      const modeLabel={before:'قبل الضريبة',after:'بعد الضريبة',none:'بدون ضريبة'}[S(l.tax_mode||'before')]||'قبل الضريبة';
      return `<tr><td>${esc(l.name)}</td><td>${esc(l.code)}</td><td>${esc(l.distributor_code||'-')}</td><td>${esc(l.supplier_invoice_no||'-')}</td><td>${esc(l.item_type||'مادة')}</td><td>${N(l.qty)}</td><td>${N(l.min_quantity||1)}</td><td>${esc(l.unit||'حبة')}</td><td>${esc(modeLabel)}</td><td>${money(c.net)}</td><td>${money(c.vat)}</td><td>${money(c.gross)}</td><td class="fin-actions"><button class="light" onclick="financeProEditInvoiceLineV10071(${idx})">تعديل</button><button class="danger" onclick="financeProRemoveInvoiceLineV15(${idx})">حذف</button></td></tr>`;
    }).join('') || '<tr><td colspan="13">أضف منتجات الفاتورة هنا. الصورة اختيارية وتضاف من قسم المنتجات.</td></tr>';
    box.innerHTML=`<div class="fin-table"><table><thead><tr><th>المنتج</th><th>الكود الداخلي</th><th>كود الموزع</th><th>رقم فاتورة المورد</th><th>النوع</th><th>الكمية</th><th>حد النفاد</th><th>الوحدة</th><th>طريقة الضريبة</th><th>قبل الضريبة</th><th>الضريبة</th><th>بعد الضريبة</th><th>إجراء</th></tr></thead><tbody>${rows}</tbody></table></div><div class="fin-grid three" style="margin-top:10px"><div class="fin-soft">قبل الضريبة: <b>${money(total.net)}</b></div><div class="fin-soft">الضريبة: <b>${money(total.vat)}</b></div><div class="fin-soft">بعد الضريبة: <b>${money(total.gross)}</b></div></div>`;
    injectStabilityBar();
  }
  window.financeProRenderInvoiceLinesV10071=renderInvoiceLines;
  window.financeProRenderInvoiceLinesV10070=renderInvoiceLines;
  window.financeProRenderInvoiceLinesV10069=renderInvoiceLines;

  window.financeProAddInvoiceLineV15=function(){
    const line=lineFromFormNoImage();
    if(!line.name) return alert('اسم المنتج مطلوب');
    if(line.qty<=0) return alert('الكمية مطلوبة');
    if(line.price<0) return alert('السعر غير صحيح');
    const ss=st(); ss.invoiceLines=A(ss.invoiceLines); ss.invoiceLines.push(line);
    clearLineForm(); renderInvoiceLines(); injectStabilityBar();
  };
  window.financeProRemoveInvoiceLineV15=function(idx){ const ss=st(); ss.invoiceLines=A(ss.invoiceLines); ss.invoiceLines.splice(idx,1); renderInvoiceLines(); };
  window.financeProEditInvoiceLineV10071=function(idx){
    const ss=st(); const l=A(ss.invoiceLines)[idx]; if(!l) return;
    const item=findItem(l);
    if($('finExistingProductV15')) $('finExistingProductV15').value=item?item.id:'';
    if($('finLineNameV15')) $('finLineNameV15').value=S(l.name);
    if($('finLineCodeV15')) $('finLineCodeV15').value=S(l.code);
    if($('finLineDistributorCodeV15')) $('finLineDistributorCodeV15').value=S(l.distributor_code);
    if($('finLineSupplierInvoiceV15')) $('finLineSupplierInvoiceV15').value=S(l.supplier_invoice_no);
    if($('finLineQtyV15')) $('finLineQtyV15').value=N(l.qty);
    if($('finLineMinQtyV15')) $('finLineMinQtyV15').value=N(l.min_quantity||1);
    if($('finLinePriceV15')) $('finLinePriceV15').value=N(l.price);
    if($('finLineTaxModeV15')) $('finLineTaxModeV15').value=S(l.tax_mode||'before');
    if($('finLineUnitV15')) $('finLineUnitV15').value=S(l.unit||'حبة');
    if($('finLineTypeV15')) $('finLineTypeV15').value=S(l.item_type||'مادة');
    ss.invoiceLines.splice(idx,1);
    renderInvoiceLines();
    if(typeof window.msg==='function') window.msg('تم تحميل السطر للتعديل، عدّل ثم اضغط إضافة المنتج للفاتورة');
  };
  window.financeProEditInvoiceLineV10070=window.financeProEditInvoiceLineV10071;

  function compressImage(file,max=420,quality=.70){
    return new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>{
        const img=new Image();
        img.onload=()=>{
          const scale=Math.min(1,max/Math.max(img.width,img.height));
          const w=Math.max(1,Math.round(img.width*scale));
          const h=Math.max(1,Math.round(img.height*scale));
          const c=document.createElement('canvas'); c.width=w; c.height=h;
          c.getContext('2d').drawImage(img,0,0,w,h);
          resolve(c.toDataURL('image/jpeg',quality));
        };
        img.onerror=reject; img.src=r.result;
      };
      r.onerror=reject; r.readAsDataURL(file);
    });
  }

  function openProductImageModal(){
    if(!isAdmin()) return alert('إضافة صورة المنتج متاحة لمدير النظام فقط');
    const items=A(st().items).slice().sort((a,b)=>S(a.name).localeCompare(S(b.name),'ar'));
    const opts=items.map(i=>`<option value="${esc(i.id)}">${esc(i.name)} - ${esc(itemCode(i)||'بدون كود')}</option>`).join('');
    const html=`<div class="modal-backdrop" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:999999;display:grid;place-items:center;padding:18px"><div class="card" style="width:min(720px,96vw);max-height:92vh;overflow:auto"><div class="fin-actions" style="justify-content:space-between"><h2>إضافة / تعديل صورة المنتج</h2><button class="danger" onclick="this.closest('.modal-backdrop').remove()">إغلاق</button></div><label>اختر المنتج</label><select id="prodImgItemV10071">${opts}</select><label>الصورة</label><input id="prodImgFileV10071" type="file" accept="image/*"><div id="prodImgPreviewV10071" class="fin-soft" style="margin-top:10px">سيتم ضغط الصورة قبل الحفظ حتى لا يبطئ النظام.</div><div class="fin-actions"><button onclick="financeProSaveProductImageV10071(this)">حفظ الصورة</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend',html);
    setTimeout(()=>{
      const f=$('prodImgFileV10071'); if(f) f.onchange=async()=>{ const file=f.files&&f.files[0]; if(!file) return; const data=await compressImage(file); $('prodImgPreviewV10071').innerHTML=`<img src="${data}" style="width:120px;height:120px;object-fit:contain;border:1px solid #d9e7e2;border-radius:16px;background:#fff;padding:4px"><p>جاهزة للحفظ</p>`; window.__prodImgV10071=data; };
    },50);
  }
  window.financeProOpenProductImageModalV10071=openProductImageModal;
  window.financeProSaveProductImageV10071=async function(btn){
    try{
      if(btn){btn.disabled=true;btn.textContent='جاري حفظ الصورة...';}
      const id=S($('prodImgItemV10071')?.value); const data=S(window.__prodImgV10071||'');
      if(!id) throw new Error('اختر المنتج');
      if(!data) throw new Error('اختر الصورة أولاً');
      const res=await sb.from('inventory_items').update({image_url:data, updated_at:new Date().toISOString()}).eq('id',id).select('*').single();
      if(res.error) throw res.error;
      const ss=st(); const idx=A(ss.items).findIndex(i=>String(i.id)===String(id)); if(idx>=0) ss.items[idx]=res.data;
      document.querySelector('.modal-backdrop:last-child')?.remove();
      if(typeof window.financeProRenderProductListV15==='function') window.financeProRenderProductListV15();
      if(typeof window.msg==='function') window.msg('تم حفظ صورة المنتج');
    }catch(e){ alert(e.message||String(e)); }
    finally{ if(btn){btn.disabled=false;btn.textContent='حفظ الصورة';} }
  };

  function injectStabilityBar(){
    const box=$('finInvoiceLinesV15');
    if(box && !document.getElementById('finStableBarV10071')){
      box.insertAdjacentHTML('beforebegin',`<div id="finStableBarV10071" class="fin-soft" style="margin:10px 0;background:#eef8f4;border-color:#c7e7da"><b>وضع الثبات v10071:</b> لا يوجد تحديث تلقائي أثناء الكتابة، والصور لا تحفظ داخل العمليات. <button type="button" class="light" onclick="financeProOpenProductImageModalV10071()">إضافة صورة للمنتج</button></div>`);
    }
    const tabs=document.querySelector('#finTabsV15, .finance-tabs');
    if(tabs && !document.getElementById('finProductImageTopBtnV10071') && isAdmin()){
      const b=document.createElement('button'); b.id='finProductImageTopBtnV10071'; b.type='button'; b.className='light'; b.textContent='إضافة صورة للمنتج'; b.onclick=openProductImageModal; tabs.appendChild(b);
    }
    // تنبيه بجانب حقل صورة العملية بأن الصورة من المنتجات
    const img=$('finLineImageV15');
    if(img && !document.getElementById('finLineImageHintV10071')){
      img.insertAdjacentHTML('afterend','<small id="finLineImageHintV10071" style="display:block;color:#60706a;margin-top:5px">لتسريع الحفظ: أضف صورة المنتج من قسم المنتجات، وليس من العملية.</small>');
    }
  }

  function patchRenderLoop(){
    const renderNames=['financeProRenderInvoiceLinesV15','financeProRenderInvoiceLinesV10069','financeProRenderInvoiceLinesV10070'];
    renderNames.forEach(n=>{ window[n]=renderInvoiceLines; });
    const oldRender=window.financeProRenderCurrentV15;
    if(typeof oldRender==='function' && !oldRender.__v10071){
      const wrapped=function(){
        if(financeVisible() && hasActiveDraft()){
          injectStabilityBar(); renderInvoiceLines(); return;
        }
        return oldRender.apply(this,arguments);
      };
      wrapped.__v10071=true; window.financeProRenderCurrentV15=wrapped;
    }
  }

  function boot(){ patchMsg(); patchRenderLoop(); injectStabilityBar(); if($('finInvoiceLinesV15')) renderInvoiceLines(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',boot);
  document.addEventListener('click',()=>setTimeout(boot,80),true);
  setInterval(boot,1500);
  console.log('Tasneef '+VERSION+' loaded');
})();


/* ===== tasneef_finance_inventory_stable_root_v10070.js merged into clean stable v10077 ===== */
(function(){
  'use strict';
  const VERSION='v10070-finance-inventory-root-stable';
  const VAT_RATE=0.15;
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const N=v=>Number(v||0)||0;
  const A=v=>Array.isArray(v)?v:[];
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const today=()=>new Date().toISOString().slice(0,10);
  const money=v=>`${N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س`;


  // v10077: منع أي مؤقتات/قنوات قديمة من ملفات الترقيع السابقة
  try{
    Object.keys(window).forEach(function(k){
      if(/^__tasneefFinance.*Interval|^__finance.*Interval|^__v1007.*Interval/.test(k) && window[k]){ try{clearInterval(window[k]);}catch(e){} window[k]=null; }
    });
  }catch(e){}

  window.__tasneefFinanceDisableRealtime=true;
  window.__tasneefFinanceManualSyncOnly=true;
  window.__tasneefFinanceNoAutoReload=true;
  window.__financeInventoryStableRootV10070=true;

  function st(){ return window.financeProStateV15 || (window.financeProStateV15={items:[],movements:[],invoiceLines:[],distribution:[]}); }
  function user(){ try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};} }
  function uid(){ const u=user(); return u.id ?? u.user_id ?? u.uid ?? S(u.email||u.username||''); }
  function uname(){ const u=user(); return S(u.full_name||u.name||u.username||u.email||'غير محدد'); }
  function role(){ return S(user().role); }
  function isAdmin(){ const u=user(); return ['admin','system_admin','general_manager','مدير النظام','مدير عام'].includes(role()) || S(u.username).toLowerCase()==='admin'; }
  function itemCode(i){ return S(i?.product_code||i?.serial_number||i?.barcode||i?.supplier_barcode||i?.code||''); }
  function itemCost(i){ return N(i?.unit_cost||i?.cost||i?.price||i?.purchase_price); }
  function productType(i){ return S(i?.item_type||i?.type||i?.category||'مادة')||'مادة'; }
  function safeJson(v){ const t=S(v); if(!t.startsWith('finance_pro_v15:')) return {}; try{return JSON.parse(t.replace('finance_pro_v15:',''))||{};}catch(_){return{};} }
  function rowVat(qty,price,mode='before'){
    const total=N(qty)*N(price);
    if(S(mode)==='after'){ const net=total/(1+VAT_RATE); return {net,vat:total-net,gross:total}; }
    if(S(mode)==='none') return {net:total,vat:0,gross:total};
    return {net:total,vat:total*VAT_RATE,gross:total*(1+VAT_RATE)};
  }
  function unitNet(line){ return S(line.tax_mode)==='after' ? N(line.price)/(1+VAT_RATE) : N(line.price); }
  function movementDate(m){ return S(m?.movement_date||m?.date||m?.created_at).slice(0,10); }
  function relevantMove(m,item){
    if(!m||!item) return false;
    const code=itemCode(item);
    return String(m.item_id||'')===String(item.id||'') || (code && [m.product_code,m.barcode].map(S).includes(code)) || (!m.item_id && S(m.item_name)===S(item.name));
  }
  function stableBalance(item, excludeMoveId){
    const moves=A(st().movements).filter(m=>relevantMove(m,item) && String(m.id)!==String(excludeMoveId||''));
    let incoming=0, used=0;
    moves.forEach(m=>{
      const type=S(m.movement_type);
      if(type==='in') incoming+=N(m.quantity);
      if(['consume','waste','damaged','scrap'].includes(type)) used+=N(m.quantity);
      const meta=safeJson(m.notes)||{};
      A(meta.distribution).forEach(d=>{
        if(['consume','waste','damaged','scrap'].includes(S(d.type))) used+=N(d.qty);
      });
    });
    return Math.max(0, +(incoming-used).toFixed(4));
  }
  function findItem(line){
    const ss=st();
    if(line.item_id||line.existing_item_id){ const id=line.item_id||line.existing_item_id; const f=A(ss.items).find(i=>String(i.id)===String(id)); if(f) return f; }
    const code=S(line.code||line.product_code);
    if(code){ const f=A(ss.items).find(i=>[i.id,i.product_code,i.serial_number,i.barcode,i.supplier_barcode].map(S).includes(code)); if(f) return f; }
    return A(ss.items).find(i=>S(i.name)===S(line.name))||null;
  }
  function lineFromForm(){
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
      image:S(window.__financeProLineImageV15||'')||S(existing?.image_url||'')
    };
  }
  function clearLineForm(){
    ['finLineNameV15','finLineDistributorCodeV15','finSupplierInvoiceV15','finLineSupplierInvoiceV15','finLineQtyV15','finLineMinQtyV15','finLinePriceV15'].forEach(id=>{ const el=$(id); if(el) el.value=''; });
    if($('finExistingProductV15')) $('finExistingProductV15').value='';
    if($('finLineImageV15')) $('finLineImageV15').value='';
    if($('finLineImageNameV15')) $('finLineImageNameV15').textContent='لم يتم اختيار صورة - الصورة اختيارية';
    window.__financeProLineImageV15='';
  }

  const DRAFT_KEY='tasneef_finance_operations_draft_v10070';
  function saveDraft(){
    const ss=st();
    const ids=['finInvSupplierV15','finInvNoV15','finInvDateV15','finExistingProductV15','finLineNameV15','finLineCodeV15','finLineDistributorCodeV15','finLineQtyV15','finLinePriceV15','finLineTaxModeV15','finLineUnitV15','finLineMinQtyV15','finLineSupplierInvoiceV15','finLineTypeV15'];
    const values={}; ids.forEach(id=>{ const el=$(id); if(el) values[id]=el.value; });
    const d={values,invoiceLines:A(ss.invoiceLines),editInvoiceNo:S(window.__financeV10070_editInvoiceNo||window.__financeV10069_editInvoiceNo||''),at:Date.now()};
    if(Object.values(values).some(S)||A(ss.invoiceLines).length) localStorage.setItem(DRAFT_KEY,JSON.stringify(d));
  }
  function restoreDraft(){
    let d=null; try{d=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');}catch(_){}
    if(!d) return;
    Object.entries(d.values||{}).forEach(([id,val])=>{ const el=$(id); if(el&&!S(el.value)) el.value=val; });
    const ss=st();
    if(A(d.invoiceLines).length&&!A(ss.invoiceLines).length){ ss.invoiceLines=A(d.invoiceLines); renderInvoiceLines(); }
    if(d.editInvoiceNo) window.__financeV10070_editInvoiceNo=d.editInvoiceNo;
  }
  function clearDraft(){ localStorage.removeItem(DRAFT_KEY); localStorage.removeItem('tasneef_finance_operations_draft_v10069'); }

  function renderInvoiceLines(){
    const ss=st(); const box=$('finInvoiceLinesV15'); if(!box) return;
    const total=A(ss.invoiceLines).reduce((a,l)=>{ const c=rowVat(l.qty,l.price,l.tax_mode); a.net+=c.net; a.vat+=c.vat; a.gross+=c.gross; return a; },{net:0,vat:0,gross:0});
    box.innerHTML=`<div class="fin-table"><table><thead><tr><th>المنتج</th><th>الكود الداخلي</th><th>كود الموزع</th><th>رقم فاتورة المورد</th><th>النوع</th><th>الكمية</th><th>حد النفاد</th><th>الوحدة</th><th>طريقة الضريبة</th><th>قبل الضريبة</th><th>الضريبة</th><th>بعد الضريبة</th><th>إجراء</th></tr></thead><tbody>${A(ss.invoiceLines).map((l,idx)=>{ const c=rowVat(l.qty,l.price,l.tax_mode); const modeLabel={before:'قبل الضريبة',after:'بعد الضريبة',none:'بدون ضريبة'}[S(l.tax_mode||'before')]||'قبل الضريبة'; return `<tr><td>${l.image?`<img src="${esc(l.image)}" style="width:34px;height:34px;object-fit:contain;border-radius:8px;border:1px solid #d9e7e2;background:#fff;margin-left:6px">`:''}${esc(l.name)}</td><td>${esc(l.code)}</td><td>${esc(l.distributor_code||'-')}</td><td>${esc(l.supplier_invoice_no||'-')}</td><td>${esc(l.item_type||'مادة')}</td><td>${N(l.qty)}</td><td>${N(l.min_quantity||1)}</td><td>${esc(l.unit||'حبة')}</td><td>${esc(modeLabel)}</td><td>${money(c.net)}</td><td>${money(c.vat)}</td><td>${money(c.gross)}</td><td class="fin-actions">${isAdmin()?`<button class="light" onclick="financeProEditInvoiceLineV10070(${idx})">تعديل</button>`:''}<button class="danger" onclick="financeProRemoveInvoiceLineV15(${idx})">حذف</button></td></tr>`; }).join('')||'<tr><td colspan="13">أضف منتجات الفاتورة هنا. الصورة اختيارية.</td></tr>'}</tbody></table></div><div class="fin-grid three" style="margin-top:10px"><div class="fin-soft">قبل الضريبة: <b>${money(total.net)}</b></div><div class="fin-soft">الضريبة: <b>${money(total.vat)}</b></div><div class="fin-soft">بعد الضريبة: <b>${money(total.gross)}</b></div></div>`;
  }
  window.financeProRenderInvoiceLinesV10069=renderInvoiceLines;
  window.financeProRenderInvoiceLinesV10070=renderInvoiceLines;
  window.financeProAddInvoiceLineV15=function(){
    const line=lineFromForm();
    if(!line.name) return alert('اسم المنتج مطلوب');
    if(line.qty<=0) return alert('الكمية مطلوبة');
    if(line.price<0) return alert('السعر غير صحيح');
    const ss=st(); ss.invoiceLines=A(ss.invoiceLines); ss.invoiceLines.push(line);
    clearLineForm(); renderInvoiceLines(); saveDraft(); injectButtons();
  };
  window.financeProRemoveInvoiceLineV15=function(idx){ const ss=st(); ss.invoiceLines=A(ss.invoiceLines); ss.invoiceLines.splice(idx,1); renderInvoiceLines(); saveDraft(); };
  window.financeProEditInvoiceLineV10070=function(idx){
    if(!isAdmin()) return alert('تعديل السطر متاح لمدير النظام فقط');
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
    window.__financeProLineImageV15=S(l.image||'');
    ss.invoiceLines.splice(idx,1);
    renderInvoiceLines(); saveDraft();
    if(typeof msg==='function') msg('تم تحميل السطر للتعديل. عدل البيانات ثم اضغط إضافة.');
  };
  window.financeProClearInvoiceV15=function(){ st().invoiceLines=[]; window.__financeV10070_editInvoiceNo=''; clearDraft(); renderInvoiceLines(); };

  function invoiceGroups(){
    const map=new Map();
    A(st().movements).filter(m=>S(m.movement_type)==='in').forEach(m=>{
      const meta=safeJson(m.notes)||{}; const invoiceNo=S(meta.invoiceNo)||(S(m.reason).match(/فاتورة\s+(.+)$/)||[])[1]||'بدون رقم';
      if(!map.has(invoiceNo)) map.set(invoiceNo,{invoiceNo,supplier:S(meta.supplier||m.receiver||''),date:movementDate(m),lines:[]});
      map.get(invoiceNo).lines.push(m);
    });
    return [...map.values()];
  }
  window.financeProEditInvoiceV15=function(encoded){
    if(!isAdmin()) return alert('تعديل الفاتورة متاح لمدير النظام فقط');
    const invoiceNo=decodeURIComponent(encoded||''); const inv=invoiceGroups().find(x=>S(x.invoiceNo)===S(invoiceNo)); if(!inv) return alert('لم يتم العثور على الفاتورة');
    const ss=st(); ss.tab='add'; ss.invoiceLines=inv.lines.map(m=>{ const meta=safeJson(m.notes)||{}; const q=N(m.quantity); const mode=S(meta.taxMode||'before'); const price=mode==='after'&&q>0?N(meta.afterVat)/q:(N(meta.beforeVat)&&q>0?N(meta.beforeVat)/q:N(m.unit_cost)); return {existing_item_id:m.item_id||'', _originalMovementId:m.id, _oldQty:q, name:S(m.item_name), code:S(m.product_code), distributor_code:S(m.barcode), supplier_invoice_no:S(meta.supplierInvoiceNo), qty:q, min_quantity:N(meta.minQuantity)||1, price, tax_mode:mode, unit:S(m.unit||'حبة'), item_type:S(meta.itemType||'مادة'), image:''}; });
    window.__financeV10070_editInvoiceNo=invoiceNo;
    if(typeof window.financeProTabV15==='function') window.financeProTabV15('add');
    setTimeout(()=>{ if($('finInvSupplierV15')) $('finInvSupplierV15').value=inv.supplier||''; if($('finInvNoV15')) $('finInvNoV15').value=invoiceNo; if($('finInvDateV15')) $('finInvDateV15').value=inv.date||today(); renderInvoiceLines(); saveDraft(); injectButtons(); },300);
    if(typeof msg==='function') msg('تم تحميل الفاتورة للتعديل: السعر لا يغير الكمية، والكمية تحسب الفرق فقط.');
  };

  async function updateItemStable(item,line,newQtyDelta,supplier,cost,excludeMoveId){
    const base=stableBalance(item,excludeMoveId);
    const next=+(base+N(newQtyDelta)).toFixed(4);
    const oldCost=itemCost(item);
    const avg=(N(newQtyDelta)>0 && next>0) ? (((base*oldCost)+(N(newQtyDelta)*cost))/(base+N(newQtyDelta))) : (cost||oldCost);
    const upd={
      name:S(line.name)||item.name,
      quantity:next,
      unit_cost:+N(avg||oldCost).toFixed(4),
      supplier:supplier||item.supplier,
      unit:S(line.unit)||item.unit||'حبة',
      item_type:S(line.item_type)||item.item_type||'مادة',
      type:S(line.item_type)||item.type||'مادة',
      product_code:S(line.code)||item.product_code,
      serial_number:S(line.code)||item.serial_number,
      barcode:S(line.code)||item.barcode,
      supplier_barcode:S(line.distributor_code)||item.supplier_barcode,
      min_quantity:N(line.min_quantity)||N(item.min_quantity)||1,
      updated_by:uid(), updated_by_name:uname(), updated_at:new Date().toISOString()
    };
    if(S(line.image)) upd.image_url=S(line.image);
    const res=await sb.from('inventory_items').update(upd).eq('id',item.id).select('*').single();
    if(res.error) throw res.error;
    return res.data;
  }
  async function createItem(line,q,supplier,cost,invoiceNo){
    const ins={name:S(line.name),product_code:S(line.code),serial_number:S(line.code),barcode:S(line.code),supplier_barcode:S(line.distributor_code)||S(line.code),image_url:S(line.image)||'',unit:S(line.unit)||'حبة',item_type:S(line.item_type)||'مادة',type:S(line.item_type)||'مادة',quantity:N(q),min_quantity:N(line.min_quantity)||1,unit_cost:+N(cost).toFixed(4),supplier,category:S(line.item_type)||'عام',notes:'تمت الإضافة من فاتورة '+invoiceNo,created_by:uid(),created_by_name:uname(),updated_by:uid(),updated_by_name:uname(),updated_at:new Date().toISOString()};
    const res=await sb.from('inventory_items').insert(ins).select('*').single(); if(res.error) throw res.error; return res.data;
  }
  async function saveIncomingMovement(item,line,q,date,supplier,invoiceNo,cost,oldMove){
    const c=rowVat(q,line.price,line.tax_mode);
    const oldMeta=safeJson(oldMove?.notes)||{};
    const meta=Object.assign({},oldMeta,{module:VERSION,invoiceNo,supplier,supplierInvoiceNo:S(line.supplier_invoice_no),minQuantity:N(line.min_quantity)||1,taxMode:S(line.tax_mode||'before'),beforeVat:c.net,vat:c.vat,afterVat:c.gross,itemType:S(line.item_type||'مادة'),updatedBy:uid(),updatedByName:uname(),updatedAt:new Date().toISOString()});
    if(oldMove){
      meta.oldQuantity=N(line._oldQty||oldMove.quantity); meta.deltaQuantity=N(q)-meta.oldQuantity;
      const up={item_id:item.id,item_name:item.name,quantity:N(q),movement_date:date,receiver:supplier,reason:'تعديل آمن لفاتورة '+invoiceNo,notes:'finance_pro_v15:'+JSON.stringify(meta),product_code:S(line.code)||itemCode(item),barcode:S(line.distributor_code)||itemCode(item),unit_cost:+N(cost).toFixed(4),updated_by:uid(),updated_by_name:uname(),updated_at:new Date().toISOString()};
      const mr=await sb.from('inventory_movements').update(up).eq('id',oldMove.id).select('*').single(); if(mr.error) throw mr.error; return mr.data;
    }
    meta.createdBy=uid(); meta.createdByName=uname(); meta.createdAt=new Date().toISOString();
    const mv={item_id:item.id,item_name:item.name,movement_type:'in',quantity:N(q),movement_date:date,receiver:supplier,reason:'إضافة مخزون - فاتورة '+invoiceNo,notes:'finance_pro_v15:'+JSON.stringify(meta),product_code:S(line.code)||itemCode(item),barcode:S(line.distributor_code)||itemCode(item),unit_cost:+N(cost).toFixed(4),created_by:uid(),created_by_name:uname(),updated_by:uid(),updated_by_name:uname(),updated_at:new Date().toISOString()};
    const mr=await sb.from('inventory_movements').insert(mv).select('*').single(); if(mr.error) throw mr.error; return mr.data;
  }
  window.financeProSaveInvoiceV15=async function(btn){
    try{
      if(btn){ btn.disabled=true; btn.textContent='جاري الحفظ...'; }
      if(!window.sb) throw new Error('الاتصال غير جاهز');
      const ss=st(); const lines=A(ss.invoiceLines); if(!lines.length) throw new Error('أضف منتج واحد على الأقل داخل الفاتورة');
      const supplier=S($('finInvSupplierV15')?.value); const invoiceNo=S($('finInvNoV15')?.value)||('INV-'+Date.now()); const date=S($('finInvDateV15')?.value)||today();
      const changedItems=[]; const changedMoves=[];
      for(const l of lines){
        const q=N(l.qty); if(q<0) throw new Error('كمية غير صحيحة: '+S(l.name));
        const cost=unitNet(l); let item=findItem(l); let oldMove=null;
        if(l._originalMovementId){ oldMove=A(ss.movements).find(m=>String(m.id)===String(l._originalMovementId)); if(!oldMove) throw new Error('لم يتم العثور على حركة الفاتورة القديمة'); item=item||A(ss.items).find(i=>String(i.id)===String(oldMove.item_id)); if(!item) throw new Error('لم يتم العثور على المنتج القديم: '+S(l.name)); const delta=q-N(l._oldQty||oldMove.quantity); item=await updateItemStable(item,l,delta,supplier,cost,oldMove.id); const mv=await saveIncomingMovement(item,l,q,date,supplier,invoiceNo,cost,oldMove); changedItems.push(item); changedMoves.push(mv); }
        else { if(item){ item=await updateItemStable(item,l,q,supplier,cost,''); } else { item=await createItem(l,q,supplier,cost,invoiceNo); } const mv=await saveIncomingMovement(item,l,q,date,supplier,invoiceNo,cost,null); changedItems.push(item); changedMoves.push(mv); }
      }
      changedItems.forEach(item=>{ const idx=A(ss.items).findIndex(i=>String(i.id)===String(item.id)); if(idx>=0) ss.items[idx]=item; else ss.items.push(item); });
      changedMoves.forEach(m=>{ const idx=A(ss.movements).findIndex(x=>String(x.id)===String(m.id)); if(idx>=0) ss.movements[idx]=m; else ss.movements.push(m); });
      ss.invoiceLines=[]; window.__financeV10070_editInvoiceNo=''; clearDraft(); renderInvoiceLines();
      if(typeof window.financeProRenderProductListV15==='function') window.financeProRenderProductListV15();
      if(typeof msg==='function') msg('تم الحفظ بثبات: لم يتم تصفير أو مضاعفة الكمية.');
    }catch(e){ alert(e.message||String(e)); if(typeof msg==='function') msg(e.message||String(e),'err'); }
    finally{ if(btn){ btn.disabled=false; btn.textContent='حفظ الفاتورة وتحديث المخزون'; } }
  };

  function injectButtons(){
    // زر تعديل المنتج المختار لمدير النظام
    const sel=$('finExistingProductV15');
    if(isAdmin() && sel && !document.getElementById('finEditSelectedProductV10070')){
      const wrap=sel.closest('div');
      if(wrap){ const b=document.createElement('button'); b.id='finEditSelectedProductV10070'; b.type='button'; b.className='light'; b.style.marginTop='8px'; b.textContent='تعديل المنتج المختار'; b.onclick=()=>openEditProductModal(sel.value); wrap.appendChild(b); }
    }
    // زر استرجاع المنتجات المفقودة من الفواتير القديمة
    const box=$('finInvoiceLinesV15');
    if(box && !document.getElementById('finRecoverProductsV10070')){
      box.insertAdjacentHTML('beforebegin',`<div id="finRecoverProductsV10070" class="fin-soft" style="margin:10px 0;background:#eef8f4;border-color:#c7e7da"><b>وضع الثبات v10070:</b> الصورة اختيارية، وتعديل الفاتورة لا يصفر المنتج. <button type="button" class="light" onclick="financeProRecoverProductsFromInvoicesV10070(this)">استرجاع المنتجات المفقودة من الفواتير</button></div>`);
    }
  }
  function openEditProductModal(id){
    const item=A(st().items).find(i=>String(i.id)===String(id)); if(!item) return alert('اختر منتج أولاً');
    const html=`<div class="modal-backdrop" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:999999;display:grid;place-items:center;padding:18px"><div class="card" style="width:min(760px,96vw);max-height:92vh;overflow:auto"><div class="fin-actions" style="justify-content:space-between"><h2>تعديل المنتج</h2><button class="danger" onclick="this.closest('.modal-backdrop').remove()">إغلاق</button></div><div class="fin-grid two"><div><label>اسم المنتج</label><input id="editProdName10070" value="${esc(item.name)}"></div><div><label>الكود الداخلي</label><input id="editProdCode10070" value="${esc(itemCode(item))}"></div><div><label>كود الموزع</label><input id="editProdDist10070" value="${esc(item.supplier_barcode||'')}"></div><div><label>الوحدة</label><input id="editProdUnit10070" value="${esc(item.unit||'حبة')}"></div><div><label>نوع المنتج</label><input id="editProdType10070" value="${esc(productType(item))}"></div><div><label>حد النفاد</label><input id="editProdMin10070" type="number" step="0.01" value="${N(item.min_quantity||1)}"></div><div><label>تكلفة الوحدة قبل الضريبة</label><input id="editProdCost10070" type="number" step="0.01" value="${N(itemCost(item))}"></div></div><div class="fin-soft" style="margin-top:10px">هذا التعديل لا يغير الكمية نهائياً.</div><div class="fin-actions"><button onclick="financeProSaveProductEditV10070('${esc(item.id)}',this)">حفظ تعديل المنتج</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend',html);
  }
  window.financeProSaveProductEditV10070=async function(id,btn){
    try{ if(btn) btn.disabled=true; const upd={name:S($('editProdName10070')?.value),product_code:S($('editProdCode10070')?.value),serial_number:S($('editProdCode10070')?.value),barcode:S($('editProdCode10070')?.value),supplier_barcode:S($('editProdDist10070')?.value),unit:S($('editProdUnit10070')?.value)||'حبة',item_type:S($('editProdType10070')?.value)||'مادة',type:S($('editProdType10070')?.value)||'مادة',min_quantity:N($('editProdMin10070')?.value)||1,unit_cost:N($('editProdCost10070')?.value),updated_by:uid(),updated_by_name:uname(),updated_at:new Date().toISOString()}; const res=await sb.from('inventory_items').update(upd).eq('id',id).select('*').single(); if(res.error) throw res.error; const ss=st(); const idx=A(ss.items).findIndex(i=>String(i.id)===String(id)); if(idx>=0) ss.items[idx]=res.data; document.querySelector('.modal-backdrop:last-child')?.remove(); if(typeof msg==='function') msg('تم تعديل المنتج بدون تغيير الكمية'); }catch(e){ alert(e.message||String(e)); } finally{ if(btn) btn.disabled=false; }
  };

  window.financeProRecoverProductsFromInvoicesV10070=async function(btn){
    try{
      if(btn){btn.disabled=true;btn.textContent='جاري الاسترجاع...';}
      if(!window.sb) throw new Error('الاتصال غير جاهز');
      const ss=st(); let count=0;
      for(const m of A(ss.movements).filter(x=>S(x.movement_type)==='in')){
        const exists=A(ss.items).some(i=>String(i.id)===String(m.item_id)||([i.product_code,i.serial_number,i.barcode,i.supplier_barcode].map(S).includes(S(m.product_code)))||S(i.name)===S(m.item_name));
        if(exists) continue;
        const meta=safeJson(m.notes)||{}; const code=S(m.product_code)||('PRD-'+String(Date.now()+count).slice(-6)); const q=stableBalance({id:m.item_id,name:m.item_name,product_code:code},'');
        const ins={name:S(m.item_name)||'منتج مسترجع',product_code:code,serial_number:code,barcode:code,supplier_barcode:S(m.barcode)||code,image_url:'',unit:'حبة',item_type:S(meta.itemType||'مادة'),type:S(meta.itemType||'مادة'),quantity:q||N(m.quantity),min_quantity:N(meta.minQuantity)||1,unit_cost:N(m.unit_cost),supplier:S(meta.supplier||m.receiver||''),category:S(meta.itemType||'عام'),notes:'استرجاع تلقائي من فاتورة قديمة v10070',created_by:uid(),created_by_name:uname(),updated_by:uid(),updated_by_name:uname(),updated_at:new Date().toISOString()};
        const res=await sb.from('inventory_items').insert(ins).select('*').single(); if(res.error) throw res.error; ss.items.push(res.data); count++;
      }
      if(typeof msg==='function') msg('تم استرجاع '+count+' منتج مفقود من الفواتير القديمة');
      if(typeof window.financeProRenderProductListV15==='function') window.financeProRenderProductListV15();
    }catch(e){ alert(e.message||String(e)); } finally{ if(btn){btn.disabled=false;btn.textContent='استرجاع المنتجات المفقودة من الفواتير';} }
  };

  document.addEventListener('input',e=>{ if(e.target&&e.target.closest&&e.target.closest('#financeDashboard')) saveDraft(); },true);
  document.addEventListener('change',e=>{ if(e.target&&e.target.closest&&e.target.closest('#financeDashboard')) { saveDraft(); setTimeout(injectButtons,100); } },true);
  const mo=new MutationObserver(()=>setTimeout(()=>{ restoreDraft(); injectButtons(); renderInvoiceLines(); },100));
  function boot(){ try{ if(document.body) mo.observe(document.body,{childList:true,subtree:true}); }catch(_){} setInterval(()=>{ restoreDraft(); injectButtons(); },1500); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  console.log('Tasneef '+VERSION+' loaded');
})();


/* ===== tasneef_finance_inventory_stable_root_v10073.js merged into clean stable v10077 ===== */
/* Tasneef Finance Inventory Stable Root v10073
   جذري:
   - إظهار المنتجات للجميع فور فتح القسم من Supabase مباشرة وليس كاش محلي فقط.
   - لا يوجد تحديث تلقائي متكرر ولا وميض.
   - صورة المنتج تضاف من قسم المنتجات/زر أعلى القسم.
   - زر طباعة بجانب كل سطر عملية، وطباعة الحركة من تفاصيل الحركة.
*/
(function(){
  'use strict';
  if(window.__financeInventoryStableRootV10073) return;
  window.__financeInventoryStableRootV10073 = true;

  const VERSION='v10073-finance-inventory-direct-products-print-image';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const N=v=>Number(v||0)||0;
  const A=v=>Array.isArray(v)?v:[];
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=v=>`${N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س`;
  const VAT=0.15;

  window.__tasneefFinanceDisableRealtime=true;
  window.__tasneefFinanceManualSyncOnly=true;
  window.__tasneefFinanceNoAutoReload=true;
  // يمنع ملفات المزامنة القديمة إذا بقيت في الكاش من العمل
  window.__tasneefFinanceInventorySaveSyncV10065=true;
  window.__tasneefFinanceInventoryGlobalSyncV10064=true;
  window.__financeInventoryStableRootV10071=true;
  window.__financeInventoryStableRootV10072=true;

  function st(){ return window.financeProStateV15 || (window.financeProStateV15={items:[],movements:[],invoiceLines:[],distribution:[]}); }
  function user(){ try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};} }
  function uname(){ const u=user(); return S(u.full_name||u.name||u.username||u.email||'غير محدد'); }
  function isAdmin(){
    const u=user();
    const txt=[u.role,u.user_role,u.type,u.position,u.username,u.full_name,u.name,u.email].map(S).join(' ').toLowerCase();
    return /admin|system|manager|owner|مدير|النظام|ادارة|الإدارة/.test(txt);
  }
  function itemCode(i){ return S(i?.product_code||i?.serial_number||i?.barcode||i?.supplier_barcode||i?.code||''); }
  function itemCost(i){ return N(i?.unit_cost||i?.cost||i?.price||i?.purchase_price); }
  function productType(i){ return S(i?.item_type||i?.type||i?.category||'مادة')||'مادة'; }
  function taxCalc(q,price,mode){
    const total=N(q)*N(price);
    if(S(mode)==='after'){ const net=total/(1+VAT); return {net,vat:total-net,gross:total}; }
    if(S(mode)==='none') return {net:total,vat:0,gross:total};
    return {net:total,vat:total*VAT,gross:total*(1+VAT)};
  }

  let loadingProducts=false;
  let productsLoadedOnce=false;

  function financeVisible(){ return !!document.querySelector('#financeDashboard:not(.hidden), #finTabsV15, .finance-tabs, #finInvoiceLinesV15'); }
  function findProductBody(){
    const ids=['finProductsBodyV15','finItemsBodyV15','inventoryItemsBody','financeProductsBody','inventoryProductsBody'];
    for(const id of ids){ const el=$(id); if(el) return el; }
    const tables=[...document.querySelectorAll('#financeDashboard table tbody')];
    return tables.find(tb=>/المنتج|الكود|حد النفاد|الكمية|الوحدة/.test(tb.closest('table')?.innerText||''))||null;
  }
  function syncProductSelect(items){
    const sel=$('finExistingProductV15');
    if(!sel || !A(items).length) return;
    const cur=sel.value;
    const empty='<option value="">منتج جديد</option>';
    sel.innerHTML=empty+A(items).sort((a,b)=>S(a.name).localeCompare(S(b.name),'ar')).map(i=>`<option value="${esc(i.id)}">${esc(i.name||'-')} - ${esc(itemCode(i)||'بدون كود')} - ${N(i.quantity)}</option>`).join('');
    if(cur) sel.value=cur;
  }
  function renderProductsTable(items){
    const body=findProductBody();
    if(!body || !A(items).length) return false;
    body.innerHTML=A(items).map(i=>{
      const img=S(i.image_url)?`<img src="${esc(i.image_url)}" style="width:42px;height:42px;object-fit:contain;border:1px solid #dce6e2;border-radius:10px;background:#fff;padding:2px">`:'<span class="inventory-image-empty">بدون صورة</span>';
      const actions=`<button class="light" onclick="financeProShowProductV15&&financeProShowProductV15('${esc(i.id)}')">عرض</button>${isAdmin()?`<button class="light" onclick="financeProOpenProductImageModalV10073('${esc(i.id)}')">إضافة صورة</button>`:''}`;
      return `<tr data-prod-v10073="1"><td>${img}</td><td>${esc(i.name||'-')}<small style="display:block;color:#60706a">${esc(productType(i))}</small></td><td>${esc(itemCode(i)||'-')}</td><td>${N(i.quantity)}</td><td>${N(i.min_quantity||1)}</td><td>${esc(i.unit||'حبة')}</td><td>${money(itemCost(i))}</td><td class="fin-actions">${actions}</td></tr>`;
    }).join('');
    return true;
  }
  function renderProductsEverywhere(items){
    const ss=st(); ss.items=A(items); syncProductSelect(ss.items);
    try{
      if(typeof window.financeProRenderProductListV15==='function') window.financeProRenderProductListV15();
    }catch(_){ }
    renderProductsTable(ss.items);
    injectBars();
  }
  async function loadProductsDirect(btn){
    if(loadingProducts) return;
    try{
      loadingProducts=true;
      if(btn){ btn.disabled=true; btn.textContent='جاري تحميل المنتجات...'; }
      if(!window.sb) throw new Error('الاتصال غير جاهز');
      showProductsStatus('جاري تحميل المنتجات من السيرفر...');
      const res=await sb.from('inventory_items').select('*').order('name',{ascending:true}).limit(5000);
      if(res.error) throw res.error;
      productsLoadedOnce=true;
      renderProductsEverywhere(res.data||[]);
      showProductsStatus(`تم تحميل ${A(res.data).length} منتج من السيرفر`);
    }catch(e){ console.warn('v10073 products direct failed',e); showProductsStatus(e.message||String(e), true); }
    finally{ loadingProducts=false; if(btn){ btn.disabled=false; btn.textContent='تحميل المنتجات الآن'; } }
  }
  window.financeProLoadProductsDirectV10073=loadProductsDirect;

  function showProductsStatus(text,err){
    let box=$('finProductsDirectStatusV10073');
    const root=$('financeDashboard') || document.body;
    if(!box && root){
      root.insertAdjacentHTML('afterbegin',`<div id="finProductsDirectStatusV10073" class="fin-soft" style="margin:10px 0;background:${err?'#fde8e8':'#eef8f4'};border-color:${err?'#efc3c3':'#c7e7da'}"></div>`);
      box=$('finProductsDirectStatusV10073');
    }
    if(box){ box.style.background=err?'#fde8e8':'#eef8f4'; box.textContent=text; }
  }

  function printWindow(title, html){
    const w=window.open('','_blank','width=920,height=720');
    if(!w) return alert('المتصفح منع نافذة الطباعة');
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#10231d}h1{color:#0A4033;margin:0 0 12px}.head{display:flex;justify-content:space-between;border-bottom:2px solid #0A4033;padding-bottom:10px;margin-bottom:14px}.box{border:1px solid #dce6e2;border-radius:12px;padding:12px;margin:8px 0}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #dce6e2;padding:8px;text-align:right}th{background:#eef6f3}.sign{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:35px}.sign div{border-top:1px solid #333;padding-top:8px;text-align:center}@media print{button{display:none}}</style></head><body><button onclick="print()">طباعة</button><div class="head"><h1>${esc(title)}</h1><div>شركة تصنيف لإدارة المرافق<br>${new Date().toLocaleString('ar-SA')}</div></div>${html}</body></html>`);
    w.document.close(); setTimeout(()=>{ try{ w.focus(); w.print(); }catch(_){} },350);
  }
  function printLine(idx){
    const line=A(st().invoiceLines)[idx];
    if(!line) return alert('لم يتم العثور على العملية');
    const c=taxCalc(line.qty,line.price,line.tax_mode);
    const html=`<div class="box"><b>المنتج:</b> ${esc(line.name)}<br><b>الكود:</b> ${esc(line.code||'-')}<br><b>الكمية:</b> ${N(line.qty)}<br><b>الوحدة:</b> ${esc(line.unit||'حبة')}<br><b>أنشأها:</b> ${esc(uname())}</div><table><thead><tr><th>قبل الضريبة</th><th>الضريبة</th><th>بعد الضريبة</th></tr></thead><tbody><tr><td>${money(c.net)}</td><td>${money(c.vat)}</td><td>${money(c.gross)}</td></tr></tbody></table><div class="sign"><div>مسؤول المخزن</div><div>المستلم</div><div>الإدارة</div></div>`;
    printWindow('طباعة عملية منتج',html);
  }
  window.financeProPrintInvoiceLineV10073=printLine;
  function printMovement(id){
    const m=A(st().movements).find(x=>String(x.id)===String(id)) || A(st().movements).slice().reverse()[0];
    if(!m) return alert('لا توجد حركة للطباعة');
    const html=`<div class="box"><b>المنتج:</b> ${esc(m.item_name||'-')}<br><b>نوع الحركة:</b> ${esc(m.movement_type||'-')}<br><b>الكمية:</b> ${N(m.quantity)}<br><b>التاريخ:</b> ${esc(m.movement_date||S(m.created_at).slice(0,10)||'-')}<br><b>المستلم/المورد:</b> ${esc(m.receiver||'-')}<br><b>السبب:</b> ${esc(m.reason||'-')}<br><b>أنشأها:</b> ${esc(m.created_by_name||'-')}<br><b>آخر تعديل:</b> ${esc(m.updated_by_name||'-')}</div><div class="sign"><div>مسؤول المخزن</div><div>المستلم</div><div>الإدارة</div></div>`;
    printWindow('طباعة حركة مخزون',html);
  }
  window.financeProPrintMovementV10073=printMovement;

  function patchInvoiceLines(){
    const box=$('finInvoiceLinesV15');
    if(!box || box.__v10073Patched) return;
    // لا نعتمد على تعديل الدالة القديمة فقط؛ نضيف أزرار طباعة بعد كل رندر.
    box.__v10073Patched=true;
  }
  function addPrintButtonsToInvoiceLines(){
    const box=$('finInvoiceLinesV15'); if(!box) return;
    const rows=[...box.querySelectorAll('tbody tr')];
    rows.forEach((tr,idx)=>{
      if(tr.querySelector('.print-line-v10073')) return;
      const last=tr.querySelector('td:last-child');
      if(last && A(st().invoiceLines)[idx]){
        const b=document.createElement('button'); b.type='button'; b.className='light print-line-v10073'; b.textContent='طباعة'; b.onclick=()=>printLine(idx); last.prepend(b);
      }
    });
  }
  function patchMovementDetails(){
    const old=window.financeProShowMovementV15;
    if(typeof old==='function' && !old.__v10073){
      const wrapped=function(id){
        const r=old.apply(this,arguments);
        setTimeout(()=>{
          const modal=[...document.querySelectorAll('.modal-backdrop .card')].pop();
          if(modal && /تفاصيل حركة المخزون/.test(modal.innerText||'') && !modal.querySelector('.print-move-v10073')){
            const b=document.createElement('button'); b.type='button'; b.className='light print-move-v10073'; b.textContent='طباعة الحركة'; b.onclick=()=>printMovement(id); modal.querySelector('.fin-actions')?.appendChild(b);
          }
        },80);
        return r;
      };
      wrapped.__v10073=true; window.financeProShowMovementV15=wrapped;
    }
  }

  function compressImage(file,max=520,quality=.72){
    return new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>{ const img=new Image(); img.onload=()=>{ const scale=Math.min(1,max/Math.max(img.width,img.height)); const w=Math.max(1,Math.round(img.width*scale)); const h=Math.max(1,Math.round(img.height*scale)); const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h); resolve(c.toDataURL('image/jpeg',quality)); }; img.onerror=reject; img.src=r.result; };
      r.onerror=reject; r.readAsDataURL(file);
    });
  }
  function openProductImageModal(id){
    if(!isAdmin()) return alert('إضافة صورة المنتج متاحة لمدير النظام فقط');
    const items=A(st().items).slice().sort((a,b)=>S(a.name).localeCompare(S(b.name),'ar'));
    if(!items.length) return alert('اضغط تحميل المنتجات الآن أولاً');
    const opts=items.map(i=>`<option value="${esc(i.id)}" ${String(i.id)===String(id)?'selected':''}>${esc(i.name)} - ${esc(itemCode(i)||'بدون كود')}</option>`).join('');
    const html=`<div class="modal-backdrop" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:999999;display:grid;place-items:center;padding:18px"><div class="card" style="width:min(720px,96vw);max-height:92vh;overflow:auto"><div class="fin-actions" style="justify-content:space-between"><h2>إضافة / تعديل صورة المنتج</h2><button class="danger" onclick="this.closest('.modal-backdrop').remove()">إغلاق</button></div><label>اختر المنتج</label><select id="prodImgItemV10073">${opts}</select><label>الصورة</label><input id="prodImgFileV10073" type="file" accept="image/*"><div id="prodImgPreviewV10073" class="fin-soft" style="margin-top:10px">سيتم ضغط الصورة قبل الحفظ.</div><div class="fin-actions"><button onclick="financeProSaveProductImageV10073(this)">حفظ الصورة</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend',html);
    setTimeout(()=>{ const f=$('prodImgFileV10073'); if(f) f.onchange=async()=>{ const file=f.files&&f.files[0]; if(!file) return; const data=await compressImage(file); window.__prodImgV10073=data; $('prodImgPreviewV10073').innerHTML=`<img src="${data}" style="width:120px;height:120px;object-fit:contain;border:1px solid #d9e7e2;border-radius:16px;background:#fff;padding:4px"><p>جاهزة للحفظ</p>`; }; },50);
  }
  window.financeProOpenProductImageModalV10073=openProductImageModal;
  window.financeProOpenProductImageModalV10071=openProductImageModal;
  window.financeProSaveProductImageV10073=async function(btn){
    try{
      if(btn){ btn.disabled=true; btn.textContent='جاري الحفظ...'; }
      const id=S($('prodImgItemV10073')?.value); const data=S(window.__prodImgV10073||'');
      if(!id) throw new Error('اختر المنتج'); if(!data) throw new Error('اختر الصورة أولاً');
      const res=await sb.from('inventory_items').update({image_url:data, updated_at:new Date().toISOString()}).eq('id',id).select('*').single();
      if(res.error) throw res.error;
      const ss=st(); const idx=A(ss.items).findIndex(i=>String(i.id)===String(id)); if(idx>=0) ss.items[idx]=res.data;
      document.querySelector('.modal-backdrop:last-child')?.remove(); renderProductsEverywhere(ss.items);
      if(typeof window.msg==='function') window.msg('تم حفظ صورة المنتج');
    }catch(e){ alert(e.message||String(e)); }
    finally{ if(btn){ btn.disabled=false; btn.textContent='حفظ الصورة'; } }
  };

  function injectBars(){
    const fin=$('financeDashboard'); if(!fin) return;
    let top=$('finDirectProductsBarV10073');
    if(!top){
      const where=$('finInvoiceLinesV15') || document.querySelector('#financeDashboard .card') || fin;
      where.insertAdjacentHTML('beforebegin',`<div id="finDirectProductsBarV10073" class="fin-soft" style="margin:10px 0;background:#eef8f4;border-color:#c7e7da"><b>v10073:</b> المنتجات تُحمّل مباشرة من السيرفر لكل المستخدمين. <button type="button" class="light" onclick="financeProLoadProductsDirectV10073(this)">تحميل المنتجات الآن</button> ${isAdmin()?`<button type="button" class="light" onclick="financeProOpenProductImageModalV10073()">إضافة صورة للمنتج</button>`:''}</div>`);
    }
    const tabs=document.querySelector('#finTabsV15, .finance-tabs');
    if(tabs && isAdmin() && !document.getElementById('finProductImageTopBtnV10073')){
      const b=document.createElement('button'); b.id='finProductImageTopBtnV10073'; b.type='button'; b.className='light'; b.textContent='إضافة صورة للمنتج'; b.onclick=()=>openProductImageModal(); tabs.appendChild(b);
    }
    addPrintButtonsToInvoiceLines();
  }

  function patchNavigation(){
    if(window.__finV10073NavPatched) return;
    window.__finV10073NavPatched=true;
    const oldShow=window.showPage;
    if(typeof oldShow==='function'){
      window.showPage=function(id,btn){ const r=oldShow.apply(this,arguments); if(id==='financeDashboard') setTimeout(()=>loadProductsDirect(null),80); setTimeout(()=>{injectBars(); addPrintButtonsToInvoiceLines();},150); return r; };
      try{ showPage=window.showPage; }catch(_){ }
    }
    const oldTab=window.financeProTabV15;
    if(typeof oldTab==='function'){
      window.financeProTabV15=function(tab){ const r=oldTab.apply(this,arguments); setTimeout(()=>{ if(/product|item|inventory|add|منتج|مخزون|عمليات/.test(S(tab))) loadProductsDirect(null); injectBars(); addPrintButtonsToInvoiceLines(); },100); return r; };
    }
  }

  function boot(){
    patchNavigation(); patchMovementDetails(); injectBars();
    if(financeVisible() && !productsLoadedOnce) loadProductsDirect(null);
    addPrintButtonsToInvoiceLines();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',boot);
  document.addEventListener('click',()=>setTimeout(()=>{injectBars(); addPrintButtonsToInvoiceLines();},100),true);
  document.addEventListener('change',()=>setTimeout(()=>{injectBars(); addPrintButtonsToInvoiceLines();},100),true);
  console.log('Tasneef '+VERSION+' loaded');
})();


/* ===== tasneef_finance_inventory_fast_products_print_v10075.js merged into clean stable v10077 ===== */
/* Tasneef Finance Inventory Fast Products + Print v10075
   - يبقى على نسخة v10073 كأساس.
   - تحميل المنتجات من Supabase مبكراً عند فتح الأدمن وليس عند دخول القسم فقط.
   - عرض المنتجات فور دخول المالية من الذاكرة المحملة من السيرفر.
   - أزرار طباعة بجانب سطور فاتورة العمليات وحركات المخزون.
   - زر إضافة/تعديل صورة المنتج داخل قسم المنتجات.
*/
(function(){
  'use strict';
  if(window.__financeInventoryFastProductsPrintV10075) return;
  window.__financeInventoryFastProductsPrintV10075 = true;

  const VERSION='v10075-fast-products-print';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const N=v=>Number(v||0)||0;
  const A=v=>Array.isArray(v)?v:[];
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const VAT=.15;
  const money=v=>`${N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س`;

  // منع أي سكربت مزامنة قديم من تشغيل تحديث تلقائي
  window.__tasneefFinanceDisableRealtime=true;
  window.__tasneefFinanceManualSyncOnly=true;
  window.__tasneefFinanceNoAutoReload=true;
  window.__tasneefFinanceInventoryGlobalSyncV10064=true;
  window.__tasneefFinanceInventorySaveSyncV10065=true;
  window.__financeInventoryStableRootV10071=true;
  window.__financeInventoryStableRootV10072=true;
  window.__financeInventoryStableRootV10074=true;

  function st(){ return window.financeProStateV15 || (window.financeProStateV15={items:[],movements:[],invoiceLines:[],distribution:[]}); }
  function currentUser(){ try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};} }
  function userName(){ const u=currentUser(); return S(u.full_name||u.name||u.username||u.email||'غير محدد'); }
  function isAdmin(){ const u=currentUser(); const s=[u.role,u.user_role,u.type,u.position,u.username,u.full_name,u.name,u.email].map(S).join(' ').toLowerCase(); return /admin|system|manager|owner|مدير|النظام|ادارة|الإدارة/.test(s); }
  function itemCode(i){ return S(i?.product_code||i?.serial_number||i?.barcode||i?.supplier_barcode||i?.code||''); }
  function itemCost(i){ return N(i?.unit_cost||i?.cost||i?.price||i?.purchase_price); }
  function itemType(i){ return S(i?.item_type||i?.type||i?.category||'مادة')||'مادة'; }
  function calcTax(q,price,mode){ const total=N(q)*N(price); const m=S(mode||'before'); if(m==='after'){ const net=total/(1+VAT); return {net,vat:total-net,gross:total}; } if(m==='none'){ return {net:total,vat:0,gross:total}; } return {net:total,vat:total*VAT,gross:total*(1+VAT)}; }

  let productsCache=[];
  let productsLoadedAt=0;
  let productsLoading=false;

  async function waitSb(){
    for(let i=0;i<80;i++){
      if(window.sb && typeof window.sb.from==='function') return true;
      await new Promise(r=>setTimeout(r,150));
    }
    return false;
  }

  async function loadProductsFromServer(force=false){
    if(productsLoading) return productsCache;
    if(!force && productsCache.length && Date.now()-productsLoadedAt < 60000) return productsCache;
    if(!(await waitSb())) return productsCache;
    productsLoading=true;
    try{
      const res=await sb.from('inventory_items').select('*').order('name',{ascending:true}).limit(10000);
      if(res.error) throw res.error;
      productsCache=A(res.data);
      productsLoadedAt=Date.now();
      const ss=st(); ss.items=productsCache;
      syncProductSelect(productsCache);
      renderProductTables(productsCache);
      updateStatus(`تم تحميل ${productsCache.length} منتج من السيرفر`);
      return productsCache;
    }catch(e){ console.warn('v10075 load products failed',e); updateStatus(e.message||String(e),true); return productsCache; }
    finally{ productsLoading=false; }
  }
  window.financeProLoadProductsFastV10075=async function(btn){ if(btn){btn.disabled=true;btn.textContent='جاري التحميل...';} await loadProductsFromServer(true); if(btn){btn.disabled=false;btn.textContent='تحميل المنتجات من السيرفر';} injectAll(); };

  function syncProductSelect(items){
    ['finExistingProductV15','finMoveItemV15'].forEach(id=>{
      const sel=$(id); if(!sel) return;
      const cur=sel.value;
      const first=id==='finExistingProductV15' ? '<option value="">منتج جديد</option>' : '<option value="">اختر المنتج</option>';
      sel.innerHTML=first + A(items).map(i=>`<option value="${esc(i.id)}">${esc(i.name||'-')} - ${esc(itemCode(i)||'بدون كود')} - ${N(i.quantity)}</option>`).join('');
      if(cur) sel.value=cur;
    });
  }

  function findProductBodies(){
    const arr=[];
    ['finProductsBodyV15','finItemsBodyV15','inventoryItemsBody','financeProductsBody','inventoryProductsBody'].forEach(id=>{ const el=$(id); if(el) arr.push(el); });
    document.querySelectorAll('#financeDashboard table tbody').forEach(tb=>{
      const txt=tb.closest('table')?.innerText||'';
      if(/المنتج/.test(txt) && /الكود/.test(txt) && /الكمية/.test(txt) && !arr.includes(tb)) arr.push(tb);
    });
    return arr;
  }

  function renderProductTables(items){
    const bodies=findProductBodies();
    if(!bodies.length || !A(items).length) return;
    const html=A(items).map(i=>{
      const img=S(i.image_url)?`<img src="${esc(i.image_url)}" style="width:42px;height:42px;object-fit:contain;border:1px solid #dce6e2;border-radius:10px;background:#fff;padding:2px">`:'<span style="font-size:11px;color:#60706a">بدون صورة</span>';
      const actions=`<button class="light" type="button" onclick="financeProShowProductV15&&financeProShowProductV15('${esc(i.id)}')">عرض</button>${isAdmin()?`<button class="light" type="button" onclick="financeProOpenProductImageModalV10075('${esc(i.id)}')">صورة</button>`:''}`;
      return `<tr data-v10075-product="1"><td>${img}</td><td>${esc(i.name||'-')}<small style="display:block;color:#60706a">${esc(itemType(i))}</small></td><td>${esc(itemCode(i)||'-')}</td><td>${N(i.quantity)}</td><td>${N(i.min_quantity||1)}</td><td>${esc(i.unit||'حبة')}</td><td>${money(itemCost(i))}</td><td class="fin-actions">${actions}</td></tr>`;
    }).join('');
    bodies.forEach(tb=>{
      // لا نستبدل فاتورة العمليات بالخطأ
      if(tb.id==='finInvoiceLinesV15') return;
      const tableText=tb.closest('table')?.innerText||'';
      if(/فاتورة|قبل الضريبة|بعد الضريبة/.test(tableText) && !/حد النفاد/.test(tableText)) return;
      tb.innerHTML=html;
    });
  }

  function updateStatus(text,err=false){
    let box=$('finFastProductsStatusV10075');
    const root=$('financeDashboard') || document.body;
    if(!box && root){
      root.insertAdjacentHTML('afterbegin',`<div id="finFastProductsStatusV10075" class="fin-soft" style="margin:10px 0;background:#eef8f4;border-color:#c7e7da"></div>`);
      box=$('finFastProductsStatusV10075');
    }
    if(box){ box.style.background=err?'#fde8e8':'#eef8f4'; box.style.borderColor=err?'#efc3c3':'#c7e7da'; box.textContent=text; }
  }

  function printWindow(title,html){
    const w=window.open('','_blank','width=920,height=720');
    if(!w) return alert('المتصفح منع نافذة الطباعة');
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#10231d}h1{color:#0A4033;margin:0}.head{display:flex;justify-content:space-between;border-bottom:2px solid #0A4033;padding-bottom:10px;margin-bottom:16px}.box{border:1px solid #dce6e2;border-radius:12px;padding:12px;margin:8px 0;line-height:1.9}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #dce6e2;padding:8px;text-align:right}th{background:#eef6f3}.sign{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:40px}.sign div{border-top:1px solid #333;text-align:center;padding-top:8px}@media print{button{display:none}}</style></head><body><button onclick="print()">طباعة</button><div class="head"><h1>${esc(title)}</h1><div>شركة تصنيف لإدارة المرافق<br>${new Date().toLocaleString('ar-SA')}</div></div>${html}</body></html>`);
    w.document.close(); setTimeout(()=>{try{w.focus();w.print();}catch(_){ }},350);
  }

  function printInvoiceLine(idx){
    const line=A(st().invoiceLines)[idx]; if(!line) return alert('لم يتم العثور على العملية');
    const c=calcTax(line.qty,line.price,line.tax_mode);
    const html=`<div class="box"><b>رقم العملية:</b> ${idx+1}<br><b>المنتج:</b> ${esc(line.name||'-')}<br><b>الكود:</b> ${esc(line.code||'-')}<br><b>كود الموزع:</b> ${esc(line.distributor_code||'-')}<br><b>رقم فاتورة المورد:</b> ${esc(line.supplier_invoice_no||'-')}<br><b>الكمية:</b> ${N(line.qty)} ${esc(line.unit||'حبة')}<br><b>المستخدم:</b> ${esc(userName())}</div><table><thead><tr><th>قبل الضريبة</th><th>الضريبة</th><th>بعد الضريبة</th></tr></thead><tbody><tr><td>${money(c.net)}</td><td>${money(c.vat)}</td><td>${money(c.gross)}</td></tr></tbody></table><div class="sign"><div>مسؤول المخزن</div><div>المستلم</div><div>الإدارة</div></div>`;
    printWindow('طباعة عملية فاتورة مخزون',html);
  }
  window.financeProPrintInvoiceLineV10075=printInvoiceLine;

  function printMovement(id){
    const m=A(st().movements).find(x=>String(x.id)===String(id)); if(!m) return alert('لم يتم العثور على حركة المخزون');
    const html=`<div class="box"><b>رقم الحركة:</b> ${esc(m.id||'-')}<br><b>المنتج:</b> ${esc(m.item_name||'-')}<br><b>نوع الحركة:</b> ${esc(m.movement_type||'-')}<br><b>الكمية:</b> ${N(m.quantity)}<br><b>التاريخ:</b> ${esc(m.movement_date||S(m.created_at).slice(0,10)||'-')}<br><b>المورد/المستلم:</b> ${esc(m.receiver||'-')}<br><b>السبب:</b> ${esc(m.reason||'-')}<br><b>أنشأها:</b> ${esc(m.created_by_name||'-')}<br><b>آخر تعديل:</b> ${esc(m.updated_by_name||'-')}</div><div class="sign"><div>مسؤول المخزن</div><div>المستلم</div><div>الإدارة</div></div>`;
    printWindow('طباعة حركة مخزون',html);
  }
  window.financeProPrintMovementV10075=printMovement;

  function addPrintButtonsToInvoice(){
    const box=$('finInvoiceLinesV15'); if(!box) return;
    [...box.querySelectorAll('tbody tr')].forEach((tr,idx)=>{
      if(tr.querySelector('.v10075-print-line')) return;
      const last=tr.querySelector('td:last-child');
      if(!last || !A(st().invoiceLines)[idx]) return;
      const b=document.createElement('button'); b.type='button'; b.className='light v10075-print-line'; b.textContent='طباعة'; b.onclick=()=>printInvoiceLine(idx); last.prepend(b);
    });
  }

  function addPrintButtonsToMovements(){
    document.querySelectorAll('#financeDashboard table tbody tr').forEach(tr=>{
      if(tr.querySelector('.v10075-print-move')) return;
      const text=tr.innerText||'';
      if(!/(حركة|استهلاك|صرف|تالف|هدر|مرتجع|إضافة مخزون|منتج)/.test(text)) return;
      let id='';
      const btn=[...tr.querySelectorAll('button')].find(b=>/financeProShowMovementV15\((\d+)/.test(b.getAttribute('onclick')||''));
      const m=(btn?.getAttribute('onclick')||'').match(/financeProShowMovementV15\((\d+)/);
      if(m) id=m[1];
      if(!id){
        const prod=S(tr.children[1]?.textContent||tr.children[0]?.textContent||'');
        const q=N([...tr.children].map(td=>td.textContent).find(x=>/^\s*\d+(\.\d+)?\s*$/.test(x))||0);
        const found=A(st().movements).find(mm=>S(mm.item_name)===prod && N(mm.quantity)===q);
        if(found) id=found.id;
      }
      if(!id) return;
      const last=tr.querySelector('td:last-child'); if(!last) return;
      const b=document.createElement('button'); b.type='button'; b.className='light v10075-print-move'; b.textContent='طباعة'; b.onclick=()=>printMovement(id); last.prepend(b);
    });
  }

  function compressImage(file,max=600,quality=.72){
    return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>{ const img=new Image(); img.onload=()=>{ const sc=Math.min(1,max/Math.max(img.width,img.height)); const w=Math.max(1,Math.round(img.width*sc)); const h=Math.max(1,Math.round(img.height*sc)); const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h); resolve(c.toDataURL('image/jpeg',quality)); }; img.onerror=reject; img.src=r.result; }; r.onerror=reject; r.readAsDataURL(file); });
  }
  function openImageModal(id){
    if(!isAdmin()) return alert('إضافة صورة المنتج متاحة لمدير النظام فقط');
    const items=A(st().items).length?A(st().items):productsCache;
    if(!items.length) return alert('اضغط تحميل المنتجات من السيرفر أولاً');
    const opts=items.map(i=>`<option value="${esc(i.id)}" ${String(i.id)===String(id)?'selected':''}>${esc(i.name)} - ${esc(itemCode(i)||'بدون كود')}</option>`).join('');
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:999999;display:grid;place-items:center;padding:18px"><div class="card" style="width:min(720px,96vw);max-height:92vh;overflow:auto"><div class="fin-actions" style="justify-content:space-between"><h2>إضافة / تعديل صورة المنتج</h2><button class="danger" onclick="this.closest('.modal-backdrop').remove()">إغلاق</button></div><label>اختر المنتج</label><select id="prodImageItemV10075">${opts}</select><label>الصورة</label><input id="prodImageFileV10075" type="file" accept="image/*"><div id="prodImagePreviewV10075" class="fin-soft" style="margin-top:10px">اختر الصورة وسيتم ضغطها قبل الحفظ.</div><div class="fin-actions"><button onclick="financeProSaveProductImageV10075(this)">حفظ الصورة</button></div></div></div>`);
    setTimeout(()=>{ const f=$('prodImageFileV10075'); if(f) f.onchange=async()=>{ const file=f.files&&f.files[0]; if(!file) return; const data=await compressImage(file); window.__prodImageV10075=data; const p=$('prodImagePreviewV10075'); if(p) p.innerHTML=`<img src="${data}" style="width:120px;height:120px;object-fit:contain;border:1px solid #d9e7e2;border-radius:16px;background:#fff;padding:4px"><p>جاهزة للحفظ</p>`; }; },50);
  }
  window.financeProOpenProductImageModalV10075=openImageModal;
  window.financeProSaveProductImageV10075=async function(btn){
    try{
      if(btn){btn.disabled=true;btn.textContent='جاري الحفظ...';}
      const id=S($('prodImageItemV10075')?.value); const data=S(window.__prodImageV10075||'');
      if(!id) throw new Error('اختر المنتج'); if(!data) throw new Error('اختر الصورة');
      const res=await sb.from('inventory_items').update({image_url:data,updated_at:new Date().toISOString()}).eq('id',id).select('*').single();
      if(res.error) throw res.error;
      const idx=productsCache.findIndex(i=>String(i.id)===String(id)); if(idx>=0) productsCache[idx]=res.data;
      const ss=st(); const idx2=A(ss.items).findIndex(i=>String(i.id)===String(id)); if(idx2>=0) ss.items[idx2]=res.data;
      renderProductTables(A(ss.items)); document.querySelector('.modal-backdrop:last-child')?.remove();
      if(typeof window.msg==='function') window.msg('تم حفظ صورة المنتج');
    }catch(e){ alert(e.message||String(e)); }
    finally{ if(btn){btn.disabled=false;btn.textContent='حفظ الصورة';} }
  };

  function injectAll(){
    const fin=$('financeDashboard'); if(!fin) return;
    if(!$('finFastProductsBarV10075')){
      const target=document.querySelector('#financeDashboard .card') || fin;
      target.insertAdjacentHTML('afterbegin',`<div id="finFastProductsBarV10075" class="fin-soft" style="margin:8px 0;background:#eef8f4;border-color:#c7e7da"><b>v10075:</b> المنتجات تتحمل من السيرفر مبكراً. <button type="button" class="light" onclick="financeProLoadProductsFastV10075(this)">تحميل المنتجات من السيرفر</button> ${isAdmin()?`<button type="button" class="light" onclick="financeProOpenProductImageModalV10075()">إضافة صورة للمنتج</button>`:''}</div>`);
    }
    if(productsCache.length) { st().items=productsCache; syncProductSelect(productsCache); renderProductTables(productsCache); }
    addPrintButtonsToInvoice(); addPrintButtonsToMovements();
  }

  function patchShowPage(){
    if(window.__v10075ShowPagePatched) return;
    window.__v10075ShowPagePatched=true;
    const old=window.showPage;
    if(typeof old==='function'){
      window.showPage=function(id,btn){ const r=old.apply(this,arguments); if(id==='financeDashboard'){ injectAll(); loadProductsFromServer(false).then(()=>injectAll()); } return r; };
      try{ showPage=window.showPage; }catch(_){ }
    }
  }

  function boot(){
    if(window.__v10077Booted) return;
    window.__v10077Booted=true;
    patchShowPage();
    // تحميل مبكر مرة واحدة فقط، بدون أي مؤقتات أو مراقبة DOM حتى لا يحصل اهتزاز أو رندر متكرر
    loadProductsFromServer(false).then(()=>{
      if(document.querySelector('#financeDashboard:not(.hidden)')) injectAll();
    });
    document.addEventListener('click', function(ev){
      const t=ev.target && ev.target.closest ? ev.target.closest('button,[data-fin-tab-v15],.nav') : null;
      if(!t) return;
      setTimeout(()=>{ if(document.querySelector('#financeDashboard:not(.hidden)')) injectAll(); },350);
    }, true);
    setTimeout(()=>{ if(document.querySelector('#financeDashboard:not(.hidden)')) injectAll(); },1500);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',boot);
  console.log('Tasneef '+VERSION+' loaded');
})();


/* ===== v10077 hard stabilization layer ===== */
(function(){
  'use strict';
  window.__tasneefFinanceInventoryCleanStableV10077 = true;
  // Disable known auto sync timers/channels from previous patches if present
  try{
    ['__tasneefFinanceSyncIntervalV10064','__tasneefFinanceSyncIntervalV10065','__tasneefFinanceSyncIntervalV10066','__tasneefFinanceSyncIntervalV10067','__tasneefFinanceSyncIntervalV10068','__tasneefFinanceProductsFastIntervalV10075'].forEach(function(k){
      if(window[k]){ try{ clearInterval(window[k]); }catch(e){} window[k]=null; }
    });
  }catch(e){}
  window.tasneefFinanceClearDraftInvoiceV10077 = function(){
    try{
      if(window.financeProStateV15){
        window.financeProStateV15.invoiceLines=[];
        window.financeProStateV15.distribution=[];
        window.financeProStateV15.editMovementId='';
      }
      Object.keys(localStorage||{}).forEach(function(k){
        var x=String(k).toLowerCase();
        if(x.includes('invoice')||x.includes('finance_invoice')||x.includes('inventory_invoice')) localStorage.removeItem(k);
      });
      if(typeof window.financeProClearInvoiceV15==='function') window.financeProClearInvoiceV15();
      if(typeof window.financeProRenderV15==='function') window.financeProRenderV15();
      alert('تم تفريغ الفاتورة المعلقة');
    }catch(e){ alert(e.message||String(e)); }
  };
  function addClearButton(){
    try{
      var dash=document.getElementById('financeDashboard'); if(!dash) return;
      if(dash.querySelector('#tasneefClearDraftInvoiceV10077')) return;
      var box=document.createElement('div');
      box.className='msg';
      box.style.margin='8px 0';
      box.innerHTML='<b>وضع الثبات v10077:</b> تشغيل ثابت بدون تحديث تلقائي. <button id="tasneefClearDraftInvoiceV10077" class="light" type="button">تفريغ الفاتورة المعلقة</button>';
      var first=dash.querySelector('.card')||dash.firstElementChild;
      (first&&first.parentNode?first.parentNode:dash).insertBefore(box, first||null);
      box.querySelector('button').onclick=window.tasneefFinanceClearDraftInvoiceV10077;
    }catch(e){}
  }
  document.addEventListener('click', function(){ setTimeout(addClearButton,200); }, true);
  window.addEventListener('load', function(){ setTimeout(addClearButton,1200); });
})();

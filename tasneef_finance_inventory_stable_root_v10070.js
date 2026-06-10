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

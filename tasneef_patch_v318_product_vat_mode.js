/* TASNEEF v318 - Product price mode: inclusive/exclusive VAT, remove add quantity now */
(function(){
  'use strict';
  if(window.__financeV318ProductVatMode) return;
  window.__financeV318ProductVatMode = true;

  const LS={suppliers:'tasneef_v312_suppliers',items:'tasneef_v312_items',purchases:'tasneef_v312_purchases',moves:'tasneef_v312_moves'};
  const $=id=>document.getElementById(id);
  const parse=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')||[]}catch(_){return []}};
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const n=v=>Number(String(v??'').replace(/,/g,''))||0;
  const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const money=v=>n(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';
  const categories=['كهرباء','سباكة','نظافة','زراعة','تعقيم','أدوات','مواد','وقود','أخرى'];
  const units=['حبة','كرتون','لتر','متر','كيس','علبة','رول','طقم','أخرى'];
  let editItemId='';
  let pendingImage='';

  function ensureStyle(){
    if($('styleFinanceV318Products')) return;
    const st=document.createElement('style');
    st.id='styleFinanceV318Products';
    st.textContent=`
      .fi-products-layout-v318{display:grid;grid-template-columns:minmax(0,1fr) 390px;gap:14px;align-items:start;direction:rtl}
      .fi-product-card-grid-v318{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;align-items:stretch}
      .fi-product-card-v318{background:#fff;border:1px solid #dbe8e3;border-radius:22px;padding:12px;box-shadow:0 10px 28px rgba(6,61,49,.06);display:grid;gap:10px;position:relative;overflow:hidden}
      .fi-product-card-v318:hover{transform:translateY(-1px);box-shadow:0 14px 32px rgba(6,61,49,.10)}
      .fi-product-image-v318{width:100%;height:155px;border-radius:18px;background:linear-gradient(135deg,#eef7f3,#f8fcfa);border:1px solid #e3eee9;display:grid;place-items:center;overflow:hidden;color:#6b7d77;font-weight:900}
      .fi-product-image-v318 img{width:100%;height:100%;object-fit:cover;display:block}
      .fi-product-title-v318{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.fi-product-title-v318 b{font-size:15px;color:#063d31;line-height:1.5}.fi-product-title-v318 small{display:block;color:#677a74;margin-top:2px}
      .fi-product-stats-v318{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.fi-product-stat-v318{border:1px solid #e3eee9;background:#fbfefd;border-radius:14px;padding:9px;min-height:54px}.fi-product-stat-v318 small{color:#6c7d78;font-size:11px}.fi-product-stat-v318 b{display:block;color:#063d31;font-size:18px;margin-top:3px}
      .fi-product-stat-v318.remaining b{color:#0b6b4f}.fi-product-stat-v318.out b{color:#9a3412}.fi-product-stat-v318.used b{color:#854d0e}.fi-product-stat-v318.in b{color:#075985}
      .fi-price-mini-v318{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.fi-price-mini-v318 div{background:#f7fbf9;border:1px solid #e4eee9;border-radius:13px;padding:8px;min-height:50px}.fi-price-mini-v318 small{display:block;color:#687a74}.fi-price-mini-v318 b{color:#063d31;font-size:13px}
      .fi-image-picker-v318{border:1px dashed #b8d5ca;border-radius:16px;padding:10px;background:#fbfefd;display:grid;gap:8px}.fi-image-preview-v318{height:125px;border-radius:14px;background:#eef7f3;display:grid;place-items:center;overflow:hidden;color:#6b7d77}.fi-image-preview-v318 img{width:100%;height:100%;object-fit:cover}
      .fi-help-v318{font-size:11px;color:#6b7d77;line-height:1.6;margin-top:4px}.fi-product-actions-v318{display:flex;gap:7px;flex-wrap:wrap}.fi-product-actions-v318 button{padding:8px 10px;border-radius:12px}.fi-badge-v318{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:5px 9px;background:#eef7f3;color:#064e3b;font-size:11px;font-weight:900}
      @media(max-width:1050px){.fi-products-layout-v318{grid-template-columns:1fr}.fi-product-card-grid-v318{grid-template-columns:1fr 1fr}}@media(max-width:650px){.fi-product-card-grid-v318{grid-template-columns:1fr}.fi-product-stats-v318{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(st);
  }

  function calcVatByMode(price, rate, mode){
    const p=n(price), r=n(rate||15); const factor=1+(r/100);
    if(String(mode||'inclusive')==='exclusive'){
      const vat=p*r/100; return {input:p,before:p,vat,after:p+vat,mode:'exclusive'};
    }
    const before=factor ? p/factor : p; const vat=p-before;
    return {input:p,before,vat,after:p,mode:'inclusive'};
  }
  function calcItemPrice(i){
    const mode=i.price_mode || (i.price_input!==undefined ? 'inclusive' : 'exclusive');
    const input=(i.price_input!==undefined) ? i.price_input : (mode==='inclusive' ? (i.price_after_vat ?? i.price ?? i.price_before ?? 0) : (i.price_before ?? i.price ?? 0));
    return calcVatByMode(input, i.vat_rate||15, mode);
  }
  function imageBox(src){ return src ? `<img src="${esc(src)}" alt="صورة المنتج">` : `<span>لا توجد صورة</span>`; }
  function supplierOptions(val=''){
    const rows=parse(LS.suppliers);
    return '<option value="">اختر المورد</option>'+rows.map(s=>`<option value="${esc(s.id)}" ${String(val)===String(s.id)?'selected':''}>${esc(s.name||'مورد')}</option>`).join('');
  }
  function productStats(itemId){
    const purchases=parse(LS.purchases), moves=parse(LS.moves), item=parse(LS.items).find(x=>String(x.id)===String(itemId))||{};
    let invoiceIn=0,out=0,used=0,wasted=0,damaged=0,scrap=0;
    purchases.forEach(p=>(p.lines||[]).forEach(l=>{ if(String(l.item_id)===String(itemId)) invoiceIn+=n(l.qty); }));
    moves.forEach(m=>{ if(String(m.item_id)!==String(itemId)) return; const qty=n(m.qty); const approved=['معتمد','تم الصرف'].includes(m.status)||m.type==='سكراب'; if(!approved) return; out+=qty; if(m.type==='استهلاك من مشرف') used+=qty; if(m.type==='هدر من مشرف') wasted+=qty; if(m.type==='تالف من مشرف') damaged+=qty; if(m.type==='سكراب') scrap+=qty; });
    const opening=n(item.opening_qty||0), entered=opening+invoiceIn, remaining=n(item.qty);
    return {entered,out,used,wasted,damaged,scrap,remaining,opening,invoiceIn};
  }
  function productCards(rows){
    const q=String($('itemSearch')?.value||'').trim().toLowerCase(); const cat=$('itemCatFilter')?.value||'';
    const filtered=rows.filter(i=>(!q||`${i.name||''} ${i.code||''} ${i.company_code||''} ${i.category||''}`.toLowerCase().includes(q))&&(!cat||i.category===cat)).slice(-80).reverse();
    if(!filtered.length) return '<div class="fi-empty">لا توجد منتجات حسب البحث الحالي</div>';
    return `<div class="fi-product-card-grid-v318">${filtered.map(i=>{ const st=productStats(i.id), c=calcItemPrice(i), remain=st.remaining;
      return `<article class="fi-product-card-v318">
        <div class="fi-product-image-v318">${imageBox(i.image_data||i.image_url||'')}</div>
        <div class="fi-product-title-v318"><div><b>${esc(i.name||'-')}</b><small>${esc(i.category||'-')} · ${esc(i.unit||'وحدة')}</small><small>الكود: ${esc(i.code||'-')} ${i.company_code?'· كود الشركة: '+esc(i.company_code):''}</small></div><span class="fi-chip ${remain<=n(i.min_qty)?'warn':'ok'}">${remain<=n(i.min_qty)?'تنبيه':'متوفر'}</span></div>
        <div class="fi-product-stats-v318"><div class="fi-product-stat-v318 in"><small>دخل المخزون</small><b>${st.entered}</b></div><div class="fi-product-stat-v318 out"><small>خرج من المخزون</small><b>${st.out}</b></div><div class="fi-product-stat-v318 used"><small>مستهلك</small><b>${st.used}</b></div><div class="fi-product-stat-v318 remaining"><small>المتبقي</small><b>${remain}</b></div></div>
        <div class="fi-price-mini-v318"><div><small>خالي من الضريبة</small><b>${money(c.before)}</b></div><div><small>الضريبة</small><b>${money(c.vat)}</b></div><div><small>شامل الضريبة</small><b>${money(c.after)}</b></div></div>
        <div><span class="fi-badge-v318">${c.mode==='inclusive'?'السعر المدخل شامل الضريبة':'السعر المدخل خالي من الضريبة'}</span></div>
        <div class="fi-product-actions-v318"><button class="light" onclick="financeV318EditProduct('${i.id}')">تعديل</button><button class="danger" onclick="financeV318DeleteProduct('${i.id}')">حذف</button></div>
      </article>`; }).join('')}</div>`;
  }
  function readImageFile(file){ return new Promise((resolve,reject)=>{ if(!file) return resolve(''); if(!String(file.type||'').startsWith('image/')) return reject(new Error('ارفع صورة فقط')); const img=new Image(), fr=new FileReader(); fr.onload=()=>{ img.onload=()=>{ const max=420; let w=img.width,h=img.height; if(w>h&&w>max){h=Math.round(h*max/w);w=max}else if(h>=w&&h>max){w=Math.round(w*max/h);h=max} const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h; canvas.getContext('2d').drawImage(img,0,0,w,h); resolve(canvas.toDataURL('image/jpeg',0.72)); }; img.onerror=()=>reject(new Error('تعذر قراءة الصورة')); img.src=fr.result; }; fr.onerror=()=>reject(new Error('تعذر قراءة الصورة')); fr.readAsDataURL(file); }); }
  function previewImage(src){ const box=$('itemImagePreview'); if(box) box.innerHTML=imageBox(src); }

  window.financeV318PreviewProductImage=async function(input){ try{ pendingImage=await readImageFile(input.files?.[0]); previewImage(pendingImage); }catch(e){ alert(e.message||String(e)); input.value=''; } };
  window.financeV318UpdatePriceBox=function(){ const c=calcVatByMode($('itemPrice')?.value||0,$('itemVatRate')?.value||15,$('itemPriceMode')?.value||'inclusive'); const el=$('itemPricePreview'); if(el) el.innerHTML=`<div><small>خالي من الضريبة</small><b>${money(c.before)}</b></div><div><small>قيمة الضريبة</small><b>${money(c.vat)}</b></div><div><small>شامل الضريبة</small><b>${money(c.after)}</b></div>`; };

  window.financeV312RenderItems=function(){
    ensureStyle(); const rows=parse(LS.items); const e=rows.find(x=>String(x.id)===String(editItemId))||{}; const price=calcItemPrice(e); const body=$('fiBody_items'); if(!body) return;
    body.innerHTML=`<div class="fi-products-layout-v318">
      <div class="fi-card pro"><div class="fi-head"><h3>قائمة المنتجات</h3><span class="fi-sub">صورة المنتج + دخل المخزون + خرج + مستهلك + المتبقي</span></div><div class="fi-toolbar"><input id="itemSearch" oninput="financeV312RenderItems()" placeholder="بحث بالاسم أو الكود"><select id="itemCatFilter" onchange="financeV312RenderItems()"><option value="">كل التصنيفات</option>${categories.map(c=>`<option>${c}</option>`).join('')}</select></div>${productCards(rows)}</div>
      <div class="fi-card pro"><div class="fi-head"><h3>${editItemId?'تعديل منتج':'إضافة منتج'}</h3><span class="fi-sub">الكمية + السعر شامل أو خالي من الضريبة</span></div><div class="fi-form">
        <input type="hidden" id="itemId" value="${esc(editItemId)}">
        <div class="fi-image-picker-v318"><label>صورة المنتج</label><div id="itemImagePreview" class="fi-image-preview-v318">${imageBox(e.image_data||e.image_url||'')}</div><input type="file" id="itemImageFile" accept="image/*" onchange="financeV318PreviewProductImage(this)"><button type="button" class="light" onclick="pendingImage='';document.getElementById('itemImageFile').value='';document.getElementById('itemImagePreview').innerHTML='<span>لا توجد صورة</span>'">حذف الصورة من النموذج</button></div>
        <label>اسم المنتج</label><input id="itemName" value="${esc(e.name||'')}">
        <div class="fi-grid two"><div><label>كود المنتج الداخلي</label><input id="itemCode" value="${esc(e.code||'')}"></div><div><label>كود الشركة / المورد</label><input id="itemCompanyCode" value="${esc(e.company_code||'')}"></div></div>
        <div class="fi-grid two"><div><label>التصنيف</label><select id="itemCategory">${categories.map(c=>`<option ${e.category===c?'selected':''}>${c}</option>`).join('')}</select></div><div><label>الوحدة</label><select id="itemUnit">${units.map(u=>`<option ${e.unit===u?'selected':''}>${u}</option>`).join('')}</select></div></div>
        <div class="fi-grid two"><div><label>الكمية الحالية / المتبقية</label><input type="number" step="0.01" id="itemQty" value="${n(e.qty)}"><div class="fi-help-v318">إضافة الكميات الجديدة تكون من تبويب إضافة مخزون / فواتير.</div></div><div><label>حد التنبيه</label><input type="number" step="0.01" id="itemMinQty" value="${n(e.min_qty)}"></div></div>
        <div class="fi-grid three"><div><label>طريقة السعر</label><select id="itemPriceMode" onchange="financeV318UpdatePriceBox()"><option value="inclusive" ${price.mode==='inclusive'?'selected':''}>السعر شامل الضريبة</option><option value="exclusive" ${price.mode==='exclusive'?'selected':''}>السعر خالي من الضريبة</option></select></div><div><label>السعر المدخل</label><input type="number" step="0.01" id="itemPrice" value="${n(price.input)||''}" oninput="financeV318UpdatePriceBox()"><div class="fi-help-v318">اكتب السعر كما هو في الفاتورة: شامل أو خالي حسب الاختيار.</div></div><div><label>الضريبة %</label><input type="number" step="0.01" id="itemVatRate" value="${n(e.vat_rate||15)}" oninput="financeV318UpdatePriceBox()"></div></div>
        <div id="itemPricePreview" class="fi-price-mini-v318"><div><small>خالي من الضريبة</small><b>${money(price.before)}</b></div><div><small>قيمة الضريبة</small><b>${money(price.vat)}</b></div><div><small>شامل الضريبة</small><b>${money(price.after)}</b></div></div>
        <label>المورد</label><select id="itemSupplier">${supplierOptions(e.supplier_id||'')}</select><label>ملاحظات</label><textarea id="itemNotes">${esc(e.notes||'')}</textarea>
        <div class="fi-actions"><button onclick="financeV312SaveItem()">حفظ المنتج</button><button class="light" onclick="financeV312ClearItem()">تفريغ</button></div>
      </div></div>
    </div>`;
    pendingImage=e.image_data||e.image_url||'';
  };

  window.financeV312SaveItem=function(){
    try{ let arr=parse(LS.items); const id=$('itemId')?.value||uid(); let it=arr.find(x=>String(x.id)===String(id)); const isNew=!it; if(!it){it={id,qty:0,opening_qty:0}; arr.push(it);} it.name=$('itemName')?.value||''; if(!it.name) return alert('اكتب اسم المنتج');
      const qty=n($('itemQty')?.value); it.qty=qty; if(isNew || it.opening_qty===undefined || it.opening_qty===null || it.opening_qty==='') it.opening_qty=qty;
      it.code=$('itemCode')?.value||''; it.company_code=$('itemCompanyCode')?.value||''; it.category=$('itemCategory')?.value||''; it.unit=$('itemUnit')?.value||'';
      it.price_mode=$('itemPriceMode')?.value||'inclusive'; it.price_input=n($('itemPrice')?.value); it.vat_rate=n($('itemVatRate')?.value||15); const c=calcVatByMode(it.price_input,it.vat_rate,it.price_mode);
      it.price_before=c.before; it.vat_value=c.vat; it.price_after_vat=c.after; it.price=c.before;
      it.min_qty=n($('itemMinQty')?.value); it.supplier_id=$('itemSupplier')?.value||''; it.notes=$('itemNotes')?.value||''; if(pendingImage) it.image_data=pendingImage; else delete it.image_data; it.updated_at=new Date().toISOString();
      save(LS.items,arr); editItemId=''; pendingImage=''; window.financeV312RenderItems();
    }catch(e){ alert(e.message||String(e)); }
  };

  window.financeV318EditProduct=function(id){ editItemId=id; pendingImage=''; window.financeV312RenderItems(); setTimeout(()=>$('itemName')?.scrollIntoView({behavior:'smooth',block:'center'}),50); };
  window.financeV317EditProduct=window.financeV318EditProduct; window.financeV316EditProduct=window.financeV318EditProduct; window.financeV312EditItem=window.financeV318EditProduct;
  window.financeV312ClearItem=function(){ editItemId=''; pendingImage=''; window.financeV312RenderItems(); };
  window.financeV318DeleteProduct=function(id){ if(!confirm('حذف المنتج؟')) return; save(LS.items,parse(LS.items).filter(x=>String(x.id)!==String(id))); window.financeV312RenderItems(); };
  window.financeV317DeleteProduct=window.financeV318DeleteProduct; window.financeV316DeleteProduct=window.financeV318DeleteProduct; window.financeV312DeleteItem=window.financeV318DeleteProduct;

  const oldTab=window.financeV312Tab; window.financeV312Tab=function(tab,btn){ const r=oldTab?oldTab.apply(this,arguments):undefined; if(tab==='items') setTimeout(()=>window.financeV312RenderItems(),30); return r; };
  const oldBoot=window.financeV312Boot; window.financeV312Boot=function(){ if(oldBoot) oldBoot.apply(this,arguments); const itemBody=$('fiBody_items'); if(itemBody && itemBody.classList.contains('active')) setTimeout(()=>window.financeV312RenderItems(),60); };
  document.addEventListener('click',function(e){ const b=e.target.closest&&e.target.closest('.fi-tabs button'); if(b&&(b.textContent||'').includes('المنتجات')) setTimeout(()=>window.financeV312RenderItems(),50); },true);
})();

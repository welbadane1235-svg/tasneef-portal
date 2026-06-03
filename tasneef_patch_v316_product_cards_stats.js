/* TASNEEF v316 - Product cards with image + inventory stats */
(function(){
  'use strict';
  if(window.__financeV316ProductCards) return;
  window.__financeV316ProductCards = true;

  const LS={
    suppliers:'tasneef_v312_suppliers',
    items:'tasneef_v312_items',
    purchases:'tasneef_v312_purchases',
    moves:'tasneef_v312_moves'
  };
  const $=id=>document.getElementById(id);
  const parse=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')||[]}catch(_){return []}};
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const n=v=>Number(v||0)||0;
  const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const money=v=>n(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';
  const categories=['كهرباء','سباكة','نظافة','زراعة','تعقيم','أدوات','مواد','وقود','أخرى'];
  const units=['حبة','كرتون','لتر','متر','كيس','علبة','رول','طقم','أخرى'];
  let editItemId='';
  let pendingImage='';

  function ensureStyle(){
    if($('styleFinanceV316Products')) return;
    const st=document.createElement('style');
    st.id='styleFinanceV316Products';
    st.textContent=`
      .fi-products-layout{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:14px;align-items:start}
      .fi-product-card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;align-items:stretch}
      .fi-product-card{background:#fff;border:1px solid #dbe8e3;border-radius:22px;padding:12px;box-shadow:0 10px 28px rgba(6,61,49,.06);display:grid;gap:10px;position:relative;overflow:hidden}
      .fi-product-card:hover{transform:translateY(-1px);box-shadow:0 14px 32px rgba(6,61,49,.10)}
      .fi-product-image{width:100%;height:150px;border-radius:18px;background:linear-gradient(135deg,#eef7f3,#f8fcfa);border:1px solid #e3eee9;display:grid;place-items:center;overflow:hidden;color:#6b7d77;font-weight:900}
      .fi-product-image img{width:100%;height:100%;object-fit:cover;display:block}
      .fi-product-title{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
      .fi-product-title b{font-size:15px;color:#063d31;line-height:1.5}.fi-product-title small{display:block;color:#677a74;margin-top:2px}
      .fi-product-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .fi-product-stat{border:1px solid #e3eee9;background:#fbfefd;border-radius:14px;padding:9px;min-height:50px}
      .fi-product-stat small{color:#6c7d78;font-size:11px}.fi-product-stat b{display:block;color:#063d31;font-size:18px;margin-top:3px}.fi-product-stat.remaining b{color:#0b6b4f}.fi-product-stat.out b{color:#9a3412}.fi-product-stat.used b{color:#854d0e}
      .fi-product-actions{display:flex;gap:7px;flex-wrap:wrap}.fi-product-actions button{padding:8px 10px;border-radius:12px}
      .fi-image-picker{border:1px dashed #b8d5ca;border-radius:16px;padding:10px;background:#fbfefd;display:grid;gap:8px}.fi-image-preview{height:130px;border-radius:14px;background:#eef7f3;display:grid;place-items:center;overflow:hidden;color:#6b7d77}.fi-image-preview img{width:100%;height:100%;object-fit:cover}.fi-price-mini{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.fi-price-mini div{background:#f7fbf9;border:1px solid #e4eee9;border-radius:13px;padding:8px}.fi-price-mini small{display:block;color:#687a74}.fi-price-mini b{color:#063d31}
      @media(max-width:1050px){.fi-products-layout{grid-template-columns:1fr}.fi-product-card-grid{grid-template-columns:1fr 1fr}}
      @media(max-width:650px){.fi-product-card-grid{grid-template-columns:1fr}.fi-product-stats{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(st);
  }

  function supplierOptions(val=''){
    const rows=parse(LS.suppliers);
    return '<option value="">اختر المورد</option>'+rows.map(s=>`<option value="${esc(s.id)}" ${String(val)===String(s.id)?'selected':''}>${esc(s.name||'مورد')}</option>`).join('');
  }

  function productStats(itemId){
    const purchases=parse(LS.purchases);
    const moves=parse(LS.moves);
    let entered=0, out=0, used=0, wasted=0, damaged=0, scrap=0;
    purchases.forEach(p=>{(p.lines||[]).forEach(l=>{ if(String(l.item_id)===String(itemId)) entered += n(l.qty); });});
    moves.forEach(m=>{
      if(String(m.item_id)!==String(itemId)) return;
      const qty=n(m.qty);
      const approved=['معتمد','تم الصرف'].includes(m.status)||m.type==='سكراب';
      if(!approved) return;
      out += qty;
      if(m.type==='استهلاك من مشرف') used += qty;
      if(m.type==='هدر من مشرف') wasted += qty;
      if(m.type==='تالف من مشرف') damaged += qty;
      if(m.type==='سكراب') scrap += qty;
    });
    return {entered,out,used,wasted,damaged,scrap};
  }

  function calcVat(before, rate){ const b=n(before), r=n(rate||15); return {before:b, vat:b*r/100, after:b+(b*r/100)}; }

  function imageBox(src){
    return src ? `<img src="${esc(src)}" alt="صورة المنتج">` : `<span>لا توجد صورة</span>`;
  }

  function cardRows(rows){
    const q=String($('itemSearch')?.value||'').trim().toLowerCase();
    const cat=$('itemCatFilter')?.value||'';
    const filtered=rows.filter(i=>(!q||`${i.name||''} ${i.code||''} ${i.company_code||''} ${i.category||''}`.toLowerCase().includes(q))&&(!cat||i.category===cat)).slice(-80).reverse();
    if(!filtered.length) return '<div class="fi-empty">لا توجد منتجات حسب البحث الحالي</div>';
    return `<div class="fi-product-card-grid">${filtered.map(i=>{
      const st=productStats(i.id);
      const c=calcVat(i.price, i.vat_rate||15);
      const remain=n(i.qty);
      return `<article class="fi-product-card">
        <div class="fi-product-image">${imageBox(i.image_data||i.image_url||'')}</div>
        <div class="fi-product-title">
          <div><b>${esc(i.name||'-')}</b><small>${esc(i.category||'-')} · ${esc(i.unit||'وحدة')}</small><small>الكود: ${esc(i.code||'-')}</small></div>
          <span class="fi-chip ${remain<=n(i.min_qty)?'warn':'ok'}">${remain<=n(i.min_qty)?'تنبيه':'متوفر'}</span>
        </div>
        <div class="fi-product-stats">
          <div class="fi-product-stat"><small>دخل المخزون</small><b>${st.entered}</b></div>
          <div class="fi-product-stat out"><small>خرج من المخزون</small><b>${st.out}</b></div>
          <div class="fi-product-stat used"><small>مستهلك</small><b>${st.used}</b></div>
          <div class="fi-product-stat remaining"><small>المتبقي</small><b>${remain}</b></div>
        </div>
        <div class="fi-price-mini">
          <div><small>قبل</small><b>${money(c.before)}</b></div>
          <div><small>ضريبة</small><b>${money(c.vat)}</b></div>
          <div><small>بعد</small><b>${money(c.after)}</b></div>
        </div>
        <div class="fi-product-actions"><button class="light" onclick="financeV316EditProduct('${i.id}')">تعديل</button><button class="danger" onclick="financeV316DeleteProduct('${i.id}')">حذف</button></div>
      </article>`;
    }).join('')}</div>`;
  }

  function readImageFile(file){
    return new Promise((resolve,reject)=>{
      if(!file) return resolve('');
      if(!String(file.type||'').startsWith('image/')) return reject(new Error('ارفع صورة فقط'));
      const img=new Image();
      const fr=new FileReader();
      fr.onload=()=>{ img.onload=()=>{
        const max=420; let w=img.width, h=img.height;
        if(w>h && w>max){ h=Math.round(h*max/w); w=max; }
        else if(h>=w && h>max){ w=Math.round(w*max/h); h=max; }
        const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        resolve(canvas.toDataURL('image/jpeg',0.72));
      }; img.onerror=()=>reject(new Error('تعذر قراءة الصورة')); img.src=fr.result; };
      fr.onerror=()=>reject(new Error('تعذر قراءة الصورة'));
      fr.readAsDataURL(file);
    });
  }

  function previewImage(src){ const box=$('itemImagePreview'); if(box) box.innerHTML=imageBox(src); }

  window.financeV316PreviewProductImage=async function(input){
    try{ pendingImage=await readImageFile(input.files?.[0]); previewImage(pendingImage); }
    catch(e){ alert(e.message||String(e)); input.value=''; }
  };

  window.financeV312RenderItems=function(){
    ensureStyle();
    const rows=parse(LS.items);
    const e=rows.find(x=>String(x.id)===String(editItemId))||{};
    const c=calcVat(e.price||0,e.vat_rate||15);
    const body=$('fiBody_items');
    if(!body) return;
    body.innerHTML=`<div class="fi-products-layout">
      <div class="fi-card pro">
        <div class="fi-head"><h3>قائمة المنتجات</h3><span class="fi-sub">بطاقات مختصرة: صورة، دخل، خرج، مستهلك، متبقي</span></div>
        <div class="fi-toolbar"><input id="itemSearch" oninput="financeV312RenderItems()" placeholder="بحث بالاسم أو الكود"><select id="itemCatFilter" onchange="financeV312RenderItems()"><option value="">كل التصنيفات</option>${categories.map(c=>`<option>${c}</option>`).join('')}</select></div>
        ${cardRows(rows)}
      </div>
      <div class="fi-card pro">
        <div class="fi-head"><h3>${editItemId?'تعديل منتج':'إضافة منتج'}</h3><span class="fi-sub">صورة المنتج + بيانات المخزون</span></div>
        <div class="fi-form">
          <input type="hidden" id="itemId" value="${esc(editItemId)}">
          <div class="fi-image-picker"><label>صورة المنتج</label><div id="itemImagePreview" class="fi-image-preview">${imageBox(e.image_data||e.image_url||'')}</div><input type="file" id="itemImageFile" accept="image/*" onchange="financeV316PreviewProductImage(this)"><button type="button" class="light" onclick="pendingImage='';document.getElementById('itemImageFile').value='';document.getElementById('itemImagePreview').innerHTML='<span>لا توجد صورة</span>'">حذف الصورة من النموذج</button></div>
          <label>اسم المنتج</label><input id="itemName" value="${esc(e.name||'')}">
          <div class="fi-grid two"><div><label>كود المنتج الداخلي</label><input id="itemCode" value="${esc(e.code||'')}"></div><div><label>كود الشركة / المورد</label><input id="itemCompanyCode" value="${esc(e.company_code||'')}"></div></div>
          <div class="fi-grid two"><div><label>التصنيف</label><select id="itemCategory">${categories.map(c=>`<option ${e.category===c?'selected':''}>${c}</option>`).join('')}</select></div><div><label>الوحدة</label><select id="itemUnit">${units.map(u=>`<option ${e.unit===u?'selected':''}>${u}</option>`).join('')}</select></div></div>
          <div class="fi-grid three"><div><label>سعر الشراء قبل الضريبة</label><input type="number" step="0.01" id="itemPrice" value="${n(e.price)||''}"></div><div><label>الضريبة %</label><input type="number" step="0.01" id="itemVatRate" value="${n(e.vat_rate||15)}"></div><div><label>حد التنبيه</label><input type="number" id="itemMinQty" value="${n(e.min_qty)}"></div></div>
          <div class="fi-price-mini"><div><small>قبل الضريبة</small><b>${money(c.before)}</b></div><div><small>الضريبة</small><b>${money(c.vat)}</b></div><div><small>بعد الضريبة</small><b>${money(c.after)}</b></div></div>
          <label>المورد</label><select id="itemSupplier">${supplierOptions(e.supplier_id||'')}</select>
          <label>ملاحظات</label><textarea id="itemNotes">${esc(e.notes||'')}</textarea>
          <div class="fi-actions"><button onclick="financeV312SaveItem()">حفظ المنتج</button><button class="light" onclick="financeV312ClearItem()">تفريغ</button></div>
        </div>
      </div>
    </div>`;
    pendingImage=e.image_data||e.image_url||'';
  };

  window.financeV312SaveItem=async function(){
    try{
      let arr=parse(LS.items);
      const id=$('itemId')?.value||uid();
      let it=arr.find(x=>String(x.id)===String(id));
      if(!it){ it={id,qty:0}; arr.push(it); }
      it.name=$('itemName')?.value||'';
      if(!it.name) return alert('اكتب اسم المنتج');
      it.code=$('itemCode')?.value||'';
      it.company_code=$('itemCompanyCode')?.value||'';
      it.category=$('itemCategory')?.value||'';
      it.unit=$('itemUnit')?.value||'';
      it.price=n($('itemPrice')?.value);
      it.vat_rate=n($('itemVatRate')?.value||15);
      it.min_qty=n($('itemMinQty')?.value);
      it.supplier_id=$('itemSupplier')?.value||'';
      it.notes=$('itemNotes')?.value||'';
      if(pendingImage) it.image_data=pendingImage;
      else delete it.image_data;
      it.updated_at=new Date().toISOString();
      save(LS.items,arr);
      editItemId=''; pendingImage='';
      window.financeV312RenderItems();
    }catch(e){ alert(e.message||String(e)); }
  };

  window.financeV316EditProduct=function(id){ editItemId=id; pendingImage=''; window.financeV312RenderItems(); setTimeout(()=>$('itemName')?.scrollIntoView({behavior:'smooth',block:'center'}),50); };
  window.financeV312EditItem=window.financeV316EditProduct;
  window.financeV312ClearItem=function(){ editItemId=''; pendingImage=''; window.financeV312RenderItems(); };
  window.financeV316DeleteProduct=function(id){ if(!confirm('حذف المنتج؟')) return; save(LS.items,parse(LS.items).filter(x=>String(x.id)!==String(id))); window.financeV312RenderItems(); };

  const oldTab=window.financeV312Tab;
  window.financeV312Tab=function(tab,btn){
    const r=oldTab?oldTab.apply(this,arguments):undefined;
    if(tab==='items') setTimeout(()=>window.financeV312RenderItems(),30);
    return r;
  };

  const oldBoot=window.financeV312Boot;
  window.financeV312Boot=function(){
    if(oldBoot) oldBoot.apply(this,arguments);
    const itemBody=$('fiBody_items');
    if(itemBody && itemBody.classList.contains('active')) setTimeout(()=>window.financeV312RenderItems(),60);
  };

  document.addEventListener('click', function(e){
    const b=e.target.closest && e.target.closest('.fi-tabs button');
    if(b && (b.textContent||'').includes('المنتجات')) setTimeout(()=>window.financeV312RenderItems(),50);
  }, true);
})();

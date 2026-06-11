/* Tasneef Finance Inventory Official v10087
   رسمي بدون حقن قوائم وبدون MutationObserver وبدون setInterval.
   - خانة/زر صورة المنتج داخل صف المنتج فقط عند إعادة رسم المنتجات.
   - حفظ الصورة يحدث image_url فقط ولا يلمس الكمية أو السعر أو الحركات.
   - تحميل فاتورة/عملية المورد يتم بفلترة مباشرة من السيرفر لتقليل الوقت.
   - حذف المورد/الفاتورة يحذف الحركات المرتبطة عند التأكيد ولا يتركها في الواجهة.
*/
(function(){
  'use strict';
  if(window.__tasneefFinanceOfficialV10087) return;
  window.__tasneefFinanceOfficialV10087 = true;

  const VAT = 0.15;
  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const N = v => Number(v || 0) || 0;
  const A = v => Array.isArray(v) ? v : [];
  const esc = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money = v => `${N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س`;
  const today = () => new Date().toISOString().slice(0,10);
  const sb = () => window.sb || window.supabaseClient || window.supabase;
  const state = () => window.financeProStateV15 || (window.financeProStateV15 = {items:[],movements:[],invoiceLines:[],distribution:[]});
  const user = () => { try { return JSON.parse(localStorage.getItem('tasneef_user') || '{}') || {}; } catch(_) { return {}; } };
  const uid = () => S(user().id || user().user_id || user().uid || user().email || user().username || '');
  const uname = () => S(user().full_name || user().name || user().username || user().email || 'غير محدد');
  const isAdmin = () => /admin|system|manager|owner|مدير|النظام|ادارة|الإدارة/.test([user().role,user().user_role,user().type,user().position,user().username,user().full_name,user().name,user().email].map(S).join(' ').toLowerCase());
  const itemCode = i => S(i && (i.product_code || i.serial_number || i.barcode || i.supplier_barcode || i.code));
  const itemCost = i => N(i && (i.unit_cost || i.cost || i.price || i.purchase_price));
  const itemType = i => S(i && (i.item_type || i.type || i.category)) || 'مادة';

  function oneRow(res, label){
    if(res && res.error) throw res.error;
    const d = res ? res.data : null;
    if(Array.isArray(d)){
      if(!d.length) throw new Error((label || 'العملية') + ' لم ترجع أي سجل من السيرفر');
      return d[0];
    }
    if(!d) throw new Error((label || 'العملية') + ' لم ترجع بيانات من السيرفر');
    return d;
  }
  window.oneRow = window.__tasneefOneRow = window.__tasneefOneRow || oneRow;

  function parseMeta(m){
    const t = S(m && m.notes);
    if(!t) return {};
    const raw = t.startsWith('finance_pro_v15:') ? t.replace('finance_pro_v15:','') : t;
    try { return JSON.parse(raw) || {}; } catch(_) { return {}; }
  }
  function moveSign(type){
    type = S(type).toLowerCase();
    if(['in','input','purchase','توريد','ادخال','إدخال'].includes(type)) return 1;
    if(['return','returned','مرتجع'].includes(type)) return 1;
    if(['consume','out','issue','صرف','استهلاك','used','waste','damaged','scrap','تالف','هدر'].includes(type)) return -1;
    return 0;
  }
  function calcTax(qty, price, mode){
    const total = N(qty) * N(price);
    mode = S(mode || 'before');
    if(mode === 'after'){
      const net = total / (1 + VAT);
      return {net, vat: total - net, gross: total};
    }
    if(mode === 'none') return {net: total, vat: 0, gross: total};
    return {net: total, vat: total * VAT, gross: total * (1 + VAT)};
  }

  function computeSummary(){
    const ss = state();
    const byKey = new Map();
    A(ss.items).forEach(i => {
      const k = S(i.id || itemCode(i) || i.name);
      if(k) byKey.set(k, {item:i, qty:0, value:0});
    });
    A(ss.movements).forEach(m => {
      const sign = moveSign(m.movement_type);
      if(!sign) return;
      const k = S(m.item_id || m.product_code || m.barcode || m.item_name);
      if(!k) return;
      if(!byKey.has(k)) byKey.set(k, {item:{name:m.item_name, product_code:m.product_code, unit_cost:m.unit_cost}, qty:0, value:0});
      const row = byKey.get(k);
      const q = N(m.quantity) * sign;
      const cost = N(m.unit_cost || itemCost(row.item));
      row.qty += q;
      row.value += q * cost;
    });
    let qty = 0, net = 0;
    byKey.forEach(v => { if(v.qty > 0){ qty += v.qty; net += v.value; } });
    return {qty, net, vat: net * VAT, gross: net * (1 + VAT)};
  }
  window.financeProComputeOfficialSummaryV10087 = computeSummary;

  function updateSummaryCards(){
    const s = computeSummary();
    const txt = {
      'عدد المنتجات': String(A(state().items).length),
      'قيمة المنتجات الحالية': money(s.net),
      'قبل الضريبة': money(s.net),
      'الضريبة': money(s.vat),
      'بعد الضريبة': money(s.gross),
      'شامل الضريبة': money(s.gross)
    };
    document.querySelectorAll('#financeDashboard .card,#financeDashboard .kpi,#financeDashboard .fin-soft').forEach(el => {
      const label = S(el.innerText).split('\n')[0];
      Object.keys(txt).forEach(k => {
        if(label.includes(k)){
          const b = el.querySelector('b,strong,.value,.num');
          if(b) b.textContent = txt[k];
        }
      });
    });
  }
  window.financeProUpdateSummaryCardsV10087 = updateSummaryCards;

  async function compressImage(file, max=720, quality=.76){
    return new Promise((resolve,reject)=>{
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const sc = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * sc));
          const h = Math.max(1, Math.round(img.height * sc));
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          c.getContext('2d').drawImage(img,0,0,w,h);
          resolve(c.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject; img.src = r.result;
      };
      r.onerror = reject; r.readAsDataURL(file);
    });
  }

  function openProductImageModal(id){
    if(!isAdmin()) return alert('إضافة صورة المنتج متاحة لمدير النظام فقط');
    const ss = state();
    const item = A(ss.items).find(i => S(i.id) === S(id));
    if(!item) return alert('لم يتم العثور على المنتج. اضغط تحميل المنتجات من السيرفر ثم حاول مرة أخرى.');
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:999999;display:grid;place-items:center;padding:18px"><div class="card" style="width:min(620px,96vw);max-height:92vh;overflow:auto"><div class="fin-actions" style="justify-content:space-between"><h2>صورة المنتج</h2><button class="danger" onclick="this.closest('.modal-backdrop').remove()">إغلاق</button></div><div class="fin-soft"><b>${esc(item.name||'-')}</b><br>هذا الحفظ يغير الصورة فقط ولا يغير الكمية أو السعر أو الدخل/الخرج.</div><label>اختر الصورة</label><input id="prodImageFileV10087" type="file" accept="image/*"><div id="prodImagePreviewV10087" class="fin-soft" style="margin-top:10px">اختر الصورة للحفظ.</div><div class="fin-actions"><button onclick="financeProSaveProductImageOfficialV10087('${esc(id)}',this)">حفظ الصورة</button></div></div></div>`);
    setTimeout(() => {
      const f = $('prodImageFileV10087');
      if(!f) return;
      f.onchange = async () => {
        const file = f.files && f.files[0];
        if(!file) return;
        const data = await compressImage(file);
        window.__prodImageOfficialV10087 = data;
        const p = $('prodImagePreviewV10087');
        if(p) p.innerHTML = `<img src="${data}" style="width:130px;height:130px;object-fit:contain;border:1px solid #d9e7e2;border-radius:16px;background:#fff;padding:4px"><p>جاهزة للحفظ</p>`;
      };
    }, 50);
  }
  window.financeProOpenProductImageOfficialV10087 = openProductImageModal;

  window.financeProSaveProductImageOfficialV10087 = async function(id, btn){
    try{
      if(btn){ btn.disabled = true; btn.textContent = 'جاري الحفظ...'; }
      const data = S(window.__prodImageOfficialV10087 || '');
      if(!data) throw new Error('اختر الصورة أولاً');
      const c = sb(); if(!c) throw new Error('الاتصال بالسيرفر غير جاهز');
      const res = await c.from('inventory_items').update({image_url:data, updated_at:new Date().toISOString(), updated_by:uid(), updated_by_name:uname()}).eq('id', id).select('*');
      const row = oneRow(res, 'حفظ صورة المنتج');
      const ss = state();
      const ix = A(ss.items).findIndex(i => S(i.id) === S(id));
      if(ix >= 0) ss.items[ix] = Object.assign({}, ss.items[ix], row);
      document.querySelector('.modal-backdrop:last-child')?.remove();
      if(typeof window.msg === 'function') window.msg('تم حفظ صورة المنتج بدون تغيير الكمية أو السعر'); else alert('تم حفظ صورة المنتج');
      try{ if(typeof window.financeProRenderV15 === 'function') window.financeProRenderV15(); }catch(_){ }
      setTimeout(updateSummaryCards, 100);
    }catch(e){ alert(e.message || String(e)); }
    finally{ if(btn){ btn.disabled = false; btn.textContent = 'حفظ الصورة'; } }
  };

  function renderProductRowsOfficial(items){
    const body = $('inventoryItemsBody') || $('finProductsBodyV15') || $('finItemsBodyV15') || $('financeProductsBody') || $('inventoryProductsBody');
    if(!body) return false;
    const arr = A(items);
    if(!arr.length){ body.innerHTML = '<tr><td colspan="8">لا توجد منتجات</td></tr>'; return true; }
    body.innerHTML = arr.map(i => {
      const img = S(i.image_url) ? `<img class="inventory-product-img" src="${esc(i.image_url)}" style="width:58px;height:58px;object-fit:contain;border-radius:9px;background:#fff">` : '<span class="inventory-image-empty">بدون صورة</span>';
      const actions = `<button class="light" onclick="financeProShowProductV15&&financeProShowProductV15('${esc(i.id)}')">عرض</button>${isAdmin()?` <button class="light" onclick="financeProOpenProductImageOfficialV10087('${esc(i.id)}')">صورة</button>`:''}`;
      return `<tr data-official-product-row="10087"><td><div class="inventory-img-box">${img}</div></td><td>${esc(i.name||'-')}<small style="display:block;color:#60706a">${esc(itemType(i))}</small></td><td>${esc(itemCode(i)||'-')}</td><td>${N(i.quantity)}</td><td>${N(i.min_quantity||1)}</td><td>${esc(i.unit||'حبة')}</td><td>${money(itemCost(i))}</td><td class="row-actions fin-actions">${actions}</td></tr>`;
    }).join('');
    return true;
  }
  window.financeProRenderProductsOfficialV10087 = function(items){
    state().items = A(items);
    renderProductRowsOfficial(A(items));
    updateSummaryCards();
  };

  async function loadProducts(btn){
    try{
      if(btn){ btn.disabled = true; btn.textContent = 'جاري التحميل...'; }
      const c = sb(); if(!c) throw new Error('الاتصال بالسيرفر غير جاهز');
      const res = await c.from('inventory_items').select('id,name,product_code,serial_number,barcode,supplier_barcode,image_url,unit,item_type,type,category,quantity,min_quantity,unit_cost,supplier,updated_at').order('name',{ascending:true}).limit(5000);
      if(res.error) throw res.error;
      window.financeProRenderProductsOfficialV10087(res.data || []);
      return res.data || [];
    }catch(e){ alert(e.message || String(e)); return []; }
    finally{ if(btn){ btn.disabled = false; btn.textContent = 'تحميل المنتجات من السيرفر'; } }
  }
  window.financeProLoadProductsOfficialV10087 = loadProducts;

  async function loadSupplierInvoice(invoiceNo, btn){
    try{
      if(btn){ btn.disabled = true; btn.textContent = 'جاري تحميل العملية...'; }
      invoiceNo = S(invoiceNo || $('finInvNoV15')?.value || $('supplierInvoiceNo')?.value);
      if(!invoiceNo) throw new Error('رقم فاتورة المورد مطلوب');
      const c = sb(); if(!c) throw new Error('الاتصال بالسيرفر غير جاهز');
      const res = await c.from('inventory_movements')
        .select('id,item_id,item_name,movement_type,quantity,movement_date,receiver,reason,notes,product_code,barcode,unit_cost,created_at,updated_at')
        .eq('movement_type','in')
        .or(`notes.ilike.%${invoiceNo}%,reason.ilike.%${invoiceNo}%`)
        .order('created_at',{ascending:false})
        .limit(500);
      if(res.error) throw res.error;
      const rows = res.data || [];
      state().movements = rows.concat(A(state().movements).filter(m => !rows.some(r => S(r.id) === S(m.id))));
      state().invoiceLines = rows.map(m => {
        const meta = parseMeta(m);
        const q = N(m.quantity);
        const mode = S(meta.taxMode || 'before');
        const price = mode === 'after' && q > 0 ? N(meta.afterVat) / q : (N(meta.beforeVat) && q > 0 ? N(meta.beforeVat) / q : N(m.unit_cost));
        return {existing_item_id:m.item_id || '', _originalMovementId:m.id, _oldQty:q, name:S(m.item_name), code:S(m.product_code), distributor_code:S(m.barcode), supplier_invoice_no:S(meta.supplierInvoiceNo || invoiceNo), qty:q, min_quantity:N(meta.minQuantity) || 1, price, tax_mode:mode, unit:S(m.unit || 'حبة'), item_type:S(meta.itemType || 'مادة'), image:''};
      });
      if($('finInvoiceLinesV15') && typeof window.financeProRenderInvoiceLinesV10070 === 'function') window.financeProRenderInvoiceLinesV10070();
      updateSummaryCards();
      if(!rows.length) alert('لم يتم العثور على عملية بهذا الرقم');
      return rows;
    }catch(e){ alert(e.message || String(e)); return []; }
    finally{ if(btn){ btn.disabled = false; btn.textContent = 'تحميل العملية'; } }
  }
  window.financeProLoadSupplierInvoiceOfficialV10087 = loadSupplierInvoice;

  function markInvoiceDeletedInUi(invoiceNo, ids){
    const ss = state();
    const idSet = new Set(A(ids).map(S));
    ss.movements = A(ss.movements).filter(m => !idSet.has(S(m.id)) && !S(m.notes).includes(invoiceNo) && !S(m.reason).includes(invoiceNo));
    ss.invoiceLines = [];
    ['finInvoiceLinesV15','invoiceLinesBody','supplierInvoiceLinesBody'].forEach(id => { const el = $(id); if(el) el.innerHTML = ''; });
    document.querySelectorAll('tr, .movement-row, .invoice-row, .supplier-row, [data-invoice-no]').forEach(el => {
      const dinv = S(el.getAttribute && el.getAttribute('data-invoice-no'));
      if((dinv && dinv === invoiceNo) || S(el.innerText).includes(invoiceNo)) el.remove();
    });
    ['finInvNoV15','supplierInvoiceNo'].forEach(id => { const el = $(id); if(el) el.value = ''; });
    updateSummaryCards();
  }

  async function deleteSupplierInvoice(invoiceNo, btn){
    try{
      invoiceNo = S(invoiceNo || $('finInvNoV15')?.value || $('supplierInvoiceNo')?.value);
      if(!invoiceNo) throw new Error('رقم فاتورة المورد مطلوب للحذف');
      if(!confirm('تأكيد حذف عملية/فاتورة المورد رقم ' + invoiceNo + '؟\nسيتم حذف حركات الإدخال المرتبطة بها وتخفيض الكميات التي دخلت منها فقط.')) return;
      if(btn){ btn.disabled = true; btn.textContent = 'جاري الحذف...'; }
      const c = sb(); if(!c) throw new Error('الاتصال بالسيرفر غير جاهز');

      let deletedIds = [];
      let usedRpc = false;
      try{
        const rpc = await c.rpc('tasneef_delete_supplier_invoice_v10087', { p_invoice_no: invoiceNo });
        if(rpc.error) throw rpc.error;
        usedRpc = true;
        deletedIds = A(rpc.data).map(r => r.movement_id || r.id).filter(Boolean);
      }catch(rpcErr){
        // fallback إذا لم يتم تشغيل SQL الخاص بالنسخة، يحذف الحركات فقط بدون كسر الصفحة.
        const find = await c.from('inventory_movements')
          .select('id,item_id,quantity,item_name,notes,reason')
          .in('movement_type',['in','input','purchase','توريد','ادخال','إدخال'])
          .or(`notes.ilike.%${invoiceNo}%,reason.ilike.%${invoiceNo}%`)
          .limit(2000);
        if(find.error) throw find.error;
        const rows = A(find.data);
        deletedIds = rows.map(r => r.id).filter(Boolean);
        if(!deletedIds.length) throw new Error('لم يتم العثور على حركات مرتبطة بهذه الفاتورة');
        const del = await c.from('inventory_movements').delete().in('id', deletedIds).select('id');
        if(del.error) throw del.error;
      }

      markInvoiceDeletedInUi(invoiceNo, deletedIds);
      if(typeof window.financeProRenderInvoiceLinesV10070 === 'function') {
        try{ window.financeProRenderInvoiceLinesV10070(); }catch(_){ }
      }
      if(typeof window.financeProRenderV15 === 'function') {
        try{ window.financeProRenderV15(); }catch(_){ }
      }
      try{ await loadProducts(null); }catch(_){ }
      updateSummaryCards();
      alert(usedRpc ? 'تم حذف المورد/الفاتورة مباشرة من النظام وتحديث الكميات.' : 'تم حذف حركات المورد من النظام. لتحديث الكميات تلقائيًا شغّل SQL الخاص بالنسخة v10087 مرة واحدة.');
    }catch(e){ alert(e.message || String(e)); }
    finally{ if(btn){ btn.disabled = false; btn.textContent = 'حذف المورد/الفاتورة'; } }
  }
  window.financeProDeleteSupplierInvoiceOfficialV10087 = deleteSupplierInvoice;
  window.financeProDeleteSupplierV15 = window.financeProDeleteSupplierV15 || deleteSupplierInvoice;
  window.financeProDeleteSupplierInvoiceV15 = window.financeProDeleteSupplierInvoiceV15 || deleteSupplierInvoice;

  document.addEventListener('click', function(ev){
    const b = ev.target && ev.target.closest ? ev.target.closest('[data-load-products-official],[data-fin-load-products]') : null;
    if(b) loadProducts(b);
  }, true);

  window.addEventListener('load', function(){ setTimeout(updateSummaryCards, 400); }, {once:true});
  console.log('Tasneef Finance Inventory Official v10087 loaded');
})();

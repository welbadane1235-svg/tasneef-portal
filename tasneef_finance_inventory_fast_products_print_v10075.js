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
    patchShowPage();
    loadProductsFromServer(false); // تحميل مبكر أول فتح الأدمن
    setInterval(()=>{ if(document.querySelector('#financeDashboard:not(.hidden)')) injectAll(); },1200);
    const mo=new MutationObserver(()=>{ if(document.querySelector('#financeDashboard:not(.hidden)')) setTimeout(injectAll,120); });
    try{ mo.observe(document.body,{childList:true,subtree:true}); }catch(_){ }
    setTimeout(injectAll,1200);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',boot);
  console.log('Tasneef '+VERSION+' loaded');
})();

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

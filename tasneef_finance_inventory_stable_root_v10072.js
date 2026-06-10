/* Tasneef Finance Inventory Stable Fast Print v10072
   Root fixes:
   - remove auto refresh/flicker while finance section is open.
   - products render fast from local cache then refresh inventory_items only.
   - print stock movement and print last operation/invoice.
   - keep product image handled from products section, not invoice save.
*/
(function(){
  'use strict';
  if(window.__financeInventoryStableRootV10072) return;
  window.__financeInventoryStableRootV10072 = true;
  const VERSION='v10072-finance-inventory-fast-products-print';
  const CACHE_KEY='tasneef_inventory_items_cache_v10072';
  const LAST_INV_KEY='tasneef_last_inventory_invoice_v10072';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const N=v=>Number(v||0)||0;
  const A=v=>Array.isArray(v)?v:[];
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=v=>`${N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س`;
  const now=()=>new Date().toISOString();

  window.__tasneefFinanceDisableRealtime=true;
  window.__tasneefFinanceManualSyncOnly=true;
  window.__tasneefFinanceNoAutoReload=true;
  window.__financeInventoryStableRootV10071=true; // يمنع ملف v10071 لو بقي في الكاش من التشغيل
  window.__financeInventoryStableRootV10069=true; // يمنع ملف v10069 من إعادة التحكم

  function st(){ return window.financeProStateV15 || (window.financeProStateV15={items:[],movements:[],invoiceLines:[],distribution:[]}); }
  function user(){ try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};} }
  function uname(){ const u=user(); return S(u.full_name||u.name||u.username||u.email||'غير محدد'); }
  function role(){ const u=user(); return S(u.role||u.user_role||u.type||u.position); }
  function isAdmin(){
    const u=user(); const txt=[u.role,u.user_role,u.type,u.position,u.username,u.full_name,u.name,u.email].map(S).join(' ').toLowerCase();
    return /admin|system|manager|owner|مدير|النظام|ادارة|الإدارة/.test(txt);
  }
  function itemCode(i){ return S(i?.product_code||i?.serial_number||i?.barcode||i?.supplier_barcode||i?.code||''); }
  function itemCost(i){ return N(i?.unit_cost||i?.cost||i?.price||i?.purchase_price); }
  function productType(i){ return S(i?.item_type||i?.type||i?.category||'مادة')||'مادة'; }
  function moveLabel(t){ return ({in:'دخول',out:'صرف',consume:'استهلاك',return:'مرتجع',damaged:'تالف',waste:'هدر',scrap:'سكراب'}[S(t)]||S(t)||'-'); }
  function safeJson(v){ const t=S(v); if(!t.startsWith('finance_pro_v15:')) return {}; try{return JSON.parse(t.replace('finance_pro_v15:',''))||{};}catch(_){return{};} }
  function financeVisible(){ return !!document.querySelector('#financeDashboard:not(.hidden), #finInvoiceLinesV15, #finTabsV15, .finance-tabs'); }
  function hasDraft(){
    const ss=st(); const active=document.activeElement;
    if(active && /INPUT|TEXTAREA|SELECT/.test(active.tagName||'') && active.closest && active.closest('#financeDashboard')) return true;
    if(A(ss.invoiceLines).length) return true;
    return ['finInvSupplierV15','finInvNoV15','finLineNameV15','finLineQtyV15','finLinePriceV15','finMoveQtyV15','finMoveNoteV15'].some(id=>S($(id)?.value));
  }

  function cacheItems(items){
    if(!A(items).length) return;
    try{ localStorage.setItem(CACHE_KEY, JSON.stringify({at:Date.now(), items:items.slice(0,5000)})); }catch(_){ }
  }
  function getCachedItems(){
    try{ const c=JSON.parse(localStorage.getItem(CACHE_KEY)||'null'); return A(c&&c.items); }catch(_){ return []; }
  }
  function updateStateItems(items){
    const ss=st(); ss.items=A(items); cacheItems(ss.items);
  }

  function findProductBody(){
    const ids=['finProductsBodyV15','finItemsBodyV15','inventoryItemsBody','financeProductsBody','inventoryProductsBody'];
    for(const id of ids){ const el=$(id); if(el) return el; }
    const tables=[...document.querySelectorAll('#financeDashboard table tbody')];
    return tables.find(tb=>/الكود|المنتج|حد النفاد|الوحدة/.test(tb.closest('table')?.innerText||''))||null;
  }
  function renderFastProductTable(items){
    const body=findProductBody(); if(!body || !A(items).length) return false;
    body.innerHTML=A(items).map(i=>{
      const img=S(i.image_url)?`<img src="${esc(i.image_url)}" style="width:42px;height:42px;object-fit:contain;border:1px solid #dce6e2;border-radius:10px;background:#fff;padding:2px">`:'';
      return `<tr data-fast-prod-v10072="1"><td>${img||'<span class="inventory-image-empty">بدون صورة</span>'}</td><td>${esc(i.name||'-')}<small style="display:block;color:#60706a">${esc(productType(i))}</small></td><td>${esc(itemCode(i)||'-')}</td><td>${N(i.quantity)}</td><td>${N(i.min_quantity||1)}</td><td>${esc(i.unit||'حبة')}</td><td>${money(itemCost(i))}</td><td class="fin-actions"><button class="light" onclick="financeProShowProductV15&&financeProShowProductV15('${esc(i.id)}')">عرض</button>${isAdmin()?`<button class="light" onclick="financeProOpenProductImageModalV10071&&financeProOpenProductImageModalV10071()">صورة</button>`:''}</td></tr>`;
    }).join('');
    return true;
  }
  function renderProductsFastFromCache(){
    const cached=getCachedItems();
    if(!cached.length) return false;
    const ss=st(); if(!A(ss.items).length) ss.items=cached;
    let ok=false;
    try{ if(typeof window.financeProRenderProductListV15==='function'){ window.financeProRenderProductListV15(); ok=true; } }catch(_){ }
    if(!ok) ok=renderFastProductTable(cached);
    injectFastBar();
    return ok;
  }
  async function refreshProductsOnly(btn){
    try{
      if(btn){ btn.disabled=true; btn.textContent='جاري تحديث المنتجات...'; }
      if(!window.sb) throw new Error('الاتصال غير جاهز');
      const res=await sb.from('inventory_items').select('*').order('updated_at',{ascending:false}).limit(5000);
      if(res.error) throw res.error;
      updateStateItems(res.data||[]);
      try{ if(typeof window.financeProRenderProductListV15==='function') window.financeProRenderProductListV15(); else renderFastProductTable(st().items); }catch(_){ renderFastProductTable(st().items); }
      injectFastBar();
      if(typeof window.msg==='function') window.msg('تم تحديث المنتجات فقط بسرعة');
    }catch(e){ console.warn('v10072 fast products failed',e); if(typeof window.msg==='function') window.msg(e.message||String(e),'err'); }
    finally{ if(btn){ btn.disabled=false; btn.textContent='تحديث المنتجات فقط'; } }
  }
  window.financeProRefreshProductsOnlyV10072=refreshProductsOnly;

  function printWindow(title, html){
    const w=window.open('','_blank','width=920,height=720');
    if(!w) return alert('المتصفح منع نافذة الطباعة');
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#10231d}h1{color:#0A4033;margin:0 0 12px}.head{display:flex;justify-content:space-between;border-bottom:2px solid #0A4033;padding-bottom:10px;margin-bottom:14px}.box{border:1px solid #dce6e2;border-radius:12px;padding:12px;margin:8px 0}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #dce6e2;padding:8px;text-align:right}th{background:#eef6f3}.sign{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:35px}.sign div{border-top:1px solid #333;padding-top:8px;text-align:center}@media print{button{display:none}}</style></head><body><button onclick="print()">طباعة</button><div class="head"><h1>${esc(title)}</h1><div>شركة تصنيف لإدارة المرافق<br>${new Date().toLocaleString('ar-SA')}</div></div>${html}</body></html>`);
    w.document.close(); setTimeout(()=>{ try{w.focus();w.print();}catch(_){} },450);
  }
  function movementRows(m){
    const meta=safeJson(m.notes)||{};
    const dist=A(meta.distribution);
    const distRows=dist.length?dist.map(d=>`<tr><td>${esc(d.center||'-')}</td><td>${esc(moveLabel(d.type||m.movement_type))}</td><td>${esc(d.projectName||'-')}</td><td>${esc(d.orderNo||'-')}</td><td>${N(d.qty)}</td><td>${esc(d.note||'')}</td></tr>`).join(''):'<tr><td colspan="6">لا يوجد توزيع</td></tr>';
    return `<div class="box"><b>المنتج:</b> ${esc(m.item_name||'-')}<br><b>نوع الحركة:</b> ${esc(moveLabel(m.movement_type))}<br><b>الكمية:</b> ${N(m.quantity)}<br><b>التاريخ:</b> ${esc(m.movement_date||S(m.created_at).slice(0,10)||'-')}<br><b>المستلم/المورد:</b> ${esc(m.receiver||'-')}<br><b>أنشأها:</b> ${esc(m.created_by_name||meta.createdByName||'-')}<br><b>آخر تعديل:</b> ${esc(m.updated_by_name||meta.updatedByName||'-')}</div><h3>توزيع الحركة</h3><table><thead><tr><th>المركز</th><th>النوع</th><th>المشروع</th><th>الأوردر</th><th>الكمية</th><th>ملاحظة</th></tr></thead><tbody>${distRows}</tbody></table><div class="sign"><div>مسؤول المخزن</div><div>المستلم</div><div>الإدارة</div></div>`;
  }
  window.financeProPrintMovementV10072=function(id){
    const m=A(st().movements).find(x=>String(x.id)===String(id)) || A(st().movements).slice().reverse()[0];
    if(!m) return alert('لا توجد حركة للطباعة');
    printWindow('إذن حركة مخزون', movementRows(m));
  };
  window.financeProPrintLastMovementV10072=function(){ window.financeProPrintMovementV10072(''); };

  function invoiceHtml(inv){
    const lines=A(inv.lines); let net=0,vat=0,gross=0;
    const rows=lines.map(l=>{ const total=N(l.qty)*N(l.price); const n=S(l.tax_mode)==='after'? total/1.15:total; const v=S(l.tax_mode)==='none'?0:S(l.tax_mode)==='after'?total-n:n*.15; const g=S(l.tax_mode)==='none'?n:n+v; net+=n; vat+=v; gross+=g; return `<tr><td>${esc(l.name)}</td><td>${esc(l.code||'-')}</td><td>${N(l.qty)}</td><td>${money(l.price)}</td><td>${money(n)}</td><td>${money(v)}</td><td>${money(g)}</td></tr>`; }).join('');
    return `<div class="box"><b>رقم الفاتورة:</b> ${esc(inv.invoiceNo||'-')}<br><b>المورد:</b> ${esc(inv.supplier||'-')}<br><b>التاريخ:</b> ${esc(inv.date||'-')}<br><b>منشئ العملية:</b> ${esc(inv.createdByName||'-')}</div><table><thead><tr><th>المنتج</th><th>الكود</th><th>الكمية</th><th>السعر</th><th>قبل الضريبة</th><th>الضريبة</th><th>بعد الضريبة</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="4">الإجمالي</th><th>${money(net)}</th><th>${money(vat)}</th><th>${money(gross)}</th></tr></tfoot></table><div class="sign"><div>المورد</div><div>مسؤول المخزن</div><div>الإدارة</div></div>`;
  }
  window.financeProPrintLastInvoiceV10072=function(){
    let inv=null; try{ inv=JSON.parse(localStorage.getItem(LAST_INV_KEY)||'null'); }catch(_){ }
    if(!inv) return alert('لا توجد عملية محفوظة للطباعة حتى الآن');
    printWindow('فاتورة إدخال مخزون', invoiceHtml(inv));
  };

  function wrapSaves(){
    if(window.__finV10072SavesWrapped) return;
    const oldInv=window.financeProSaveInvoiceV15;
    if(typeof oldInv==='function'){
      window.__finV10072SavesWrapped=true;
      window.financeProSaveInvoiceV15=async function(btn){
        const ss=st();
        const snapshot={invoiceNo:S($('finInvNoV15')?.value)||('INV-'+Date.now()), supplier:S($('finInvSupplierV15')?.value), date:S($('finInvDateV15')?.value)||new Date().toISOString().slice(0,10), createdByName:uname(), lines:JSON.parse(JSON.stringify(A(ss.invoiceLines)))};
        const r=await oldInv.apply(this,arguments);
        if(snapshot.lines.length){ localStorage.setItem(LAST_INV_KEY,JSON.stringify(snapshot)); cacheItems(st().items); injectFastBar(); }
        return r;
      };
    }
    const oldMove=window.financeProSaveMovementV15;
    if(typeof oldMove==='function' && !oldMove.__v10072){
      const wrapped=async function(btn){ const r=await oldMove.apply(this,arguments); cacheItems(st().items); injectFastBar(); return r; };
      wrapped.__v10072=true; window.financeProSaveMovementV15=wrapped;
    }
    const oldShow=window.financeProShowMovementV15;
    if(typeof oldShow==='function' && !oldShow.__v10072){
      const wrapped=function(id){
        const res=oldShow.apply(this,arguments);
        setTimeout(()=>{
          const modal=[...document.querySelectorAll('.modal-backdrop .card')].pop();
          if(modal && /تفاصيل حركة المخزون/.test(modal.innerText||'') && !modal.querySelector('.print-move-v10072')){
            const b=document.createElement('button'); b.className='light print-move-v10072'; b.textContent='طباعة الحركة'; b.onclick=()=>window.financeProPrintMovementV10072(id); modal.querySelector('.fin-actions')?.appendChild(b);
          }
        },80);
        return res;
      };
      wrapped.__v10072=true; window.financeProShowMovementV15=wrapped;
    }
  }

  function injectFastBar(){
    const fin=document.getElementById('financeDashboard'); if(!fin) return;
    const target=$('finInvoiceLinesV15') || document.querySelector('#financeDashboard .card');
    if(target && !document.getElementById('finFastProductsBarV10072')){
      target.insertAdjacentHTML('beforebegin',`<div id="finFastProductsBarV10072" class="fin-soft" style="margin:10px 0;background:#eef8f4;border-color:#c7e7da"><b>ثبات وسرعة v10072:</b> المنتجات تظهر من كاش سريع أولاً، والتحديث يدوي. <button type="button" class="light" onclick="financeProRefreshProductsOnlyV10072(this)">تحديث المنتجات فقط</button> <button type="button" class="light" onclick="financeProPrintLastInvoiceV10072()">طباعة آخر عملية</button> <button type="button" class="light" onclick="financeProPrintLastMovementV10072()">طباعة آخر حركة</button></div>`);
    }
  }

  function patchNavigation(){
    if(window.__finV10072NavPatched) return;
    window.__finV10072NavPatched=true;
    const oldShow=window.showPage;
    if(typeof oldShow==='function'){
      window.showPage=function(id,btn){
        const r=oldShow.apply(this,arguments);
        if(id==='financeDashboard') setTimeout(()=>{ renderProductsFastFromCache(); injectFastBar(); refreshProductsOnly(null); },100);
        return r;
      };
      try{ showPage=window.showPage; }catch(_){ }
    }
    const oldTab=window.financeProTabV15;
    if(typeof oldTab==='function'){
      window.financeProTabV15=function(tab){
        const r=oldTab.apply(this,arguments);
        setTimeout(()=>{ renderProductsFastFromCache(); injectFastBar(); if(/product|item|inventory|منتج|مخزون/.test(S(tab))) refreshProductsOnly(null); },80);
        return r;
      };
    }
  }

  function disableFlickerTimers(){
    // لا نستخدم setInterval هنا. فقط نلغي أي رسالة تحديث أثناء الكتابة.
    const oldMsg=window.msg;
    if(typeof oldMsg==='function' && !oldMsg.__v10072){
      const wrapped=function(text,type){
        if(financeVisible() && hasDraft() && /تحديث المالية|تحديث البيانات|تم تحديث|مزامنة|تحديث المنتجات/.test(S(text))) return;
        return oldMsg.apply(this,arguments);
      };
      wrapped.__v10072=true; window.msg=wrapped;
    }
  }

  function boot(){
    disableFlickerTimers(); patchNavigation(); wrapSaves(); injectFastBar();
    const cached=getCachedItems(); if(cached.length && !A(st().items).length) st().items=cached;
    if(financeVisible()) renderProductsFastFromCache();
    // خزّن المنتجات عندما تكون موجودة في الذاكرة
    if(A(st().items).length) cacheItems(st().items);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',boot);
  document.addEventListener('click',()=>setTimeout(boot,60),true);
  document.addEventListener('change',()=>setTimeout(()=>{ if(A(st().items).length) cacheItems(st().items); injectFastBar(); },100),true);
  console.log('Tasneef '+VERSION+' loaded');
})();

/* Tasneef Finance Inventory Operations Patch v10021
   تعديلات محدودة فقط:
   1) تعديل الفاتورة يحدث نفس حركات الفاتورة القديمة ولا ينشئ نسخة جديدة.
   2) كل عملية حفظ جديدة تبقى حركاتها منفصلة، حتى لو نفس المنتج.
   3) رقم فاتورة المورد يبقى ثابت أثناء إضافة أكثر من منتج حتى حفظ/تفريغ العملية.
   4) إظهار اسم المورد ورقم الفاتورة في حركات المورد.
   5) إضافة فلتر "نوع الاستهلاك" في التقارير.
*/
(function(){
  'use strict';
  if (window.__tasneefFinanceInventoryOpsPatchV10021) return;
  window.__tasneefFinanceInventoryOpsPatchV10021 = true;

  const VAT = 0.15;
  const S = v => String(v ?? '').trim();
  const N = v => { const n = Number(String(v ?? 0).replace(/[^0-9.\-]/g,'')); return Number.isFinite(n) ? n : 0; };
  const A = v => Array.isArray(v) ? v : [];
  const esc = v => S(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today = () => new Date().toISOString().slice(0,10);
  const money = v => `${N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س`;
  const $ = id => document.getElementById(id);
  function state(){ return window.financeProStateV15 || {}; }
  function safeJson(notes){ const txt = S(notes); if(!txt.startsWith('finance_pro_v15:')) return {}; try { return JSON.parse(txt.replace('finance_pro_v15:','')); } catch(_) { return {}; } }
  function itemCode(i){ return S(i && (i.product_code || i.serial_number || i.barcode || i.supplier_barcode || i.code)); }
  function itemCost(i){ return N(i && (i.unit_cost || i.cost || i.price || i.purchase_price)); }
  function unitNetFromLine(line){ return S(line.tax_mode || 'before') === 'after' ? N(line.price)/(1+VAT) : N(line.price); }
  function rowVat(qty, price, mode){ const total=N(qty)*N(price); mode=S(mode||'before'); if(mode==='after'){ const net=total/(1+VAT); return {net,vat:total-net,gross:total}; } if(mode==='none') return {net:total,vat:0,gross:total}; return {net:total,vat:total*VAT,gross:total*(1+VAT)}; }
  function findItem(line){ const st=state(); const code=S(line.code), dist=S(line.distributor_code); return A(st.items).find(i=>code && [i.product_code,i.serial_number,i.barcode,i.code].map(S).includes(code)) || A(st.items).find(i=>dist && [i.supplier_barcode,i.distributor_code].map(S).includes(dist)) || A(st.items).find(i=>S(i.name).toLowerCase()===S(line.name).toLowerCase()); }
  function findInvoiceMovements(invoiceNo){ const st=state(); return A(st.movements).filter(m => { const meta=safeJson(m.notes); return S(meta.invoiceNo)===S(invoiceNo) || S(m.reason).includes(S(invoiceNo)); }).sort((a,b)=>Number(a.id||0)-Number(b.id||0)); }
  function supplierNameForMove(m){ const meta=safeJson(m.notes); return S(meta.supplier || m.receiver); }
  function supplierInvoiceForMove(m){ const meta=safeJson(m.notes); return S(meta.supplierInvoiceNo || meta.supplier_invoice_no || ''); }
  function invoiceNoForMove(m){ const meta=safeJson(m.notes); return S(meta.invoiceNo || ''); }
  async function reloadFinance(){ if(typeof window.financeProLoadV15==='function') await window.financeProLoadV15(true); else location.reload(); }

  function patchSupplierInvoicePersistence(){
    if(window.__finSupplierInvoicePersistV10021) return;
    window.__finSupplierInvoicePersistV10021 = true;
    document.addEventListener('input', e => { if(e.target && e.target.id==='finLineSupplierInvoiceV15') sessionStorage.setItem('tasneef_last_supplier_invoice_v10021', S(e.target.value)); }, true);
    const install=()=>{ const el=$('finLineSupplierInvoiceV15'); if(el && !S(el.value)){ const saved=sessionStorage.getItem('tasneef_last_supplier_invoice_v10021')||''; if(saved) el.value=saved; } };
    setInterval(install,800); setTimeout(install,300);
    const oldAdd=window.financeProAddInvoiceLineV15;
    if(typeof oldAdd==='function' && !oldAdd.__v10021){
      window.financeProAddInvoiceLineV15=function(){ const before=S($('finLineSupplierInvoiceV15')?.value)||sessionStorage.getItem('tasneef_last_supplier_invoice_v10021')||''; const ret=oldAdd.apply(this,arguments); setTimeout(()=>{ if(before){ sessionStorage.setItem('tasneef_last_supplier_invoice_v10021',before); if($('finLineSupplierInvoiceV15')) $('finLineSupplierInvoiceV15').value=before; }},60); return ret; };
      window.financeProAddInvoiceLineV15.__v10021=true;
    }
    const oldClear=window.financeProClearInvoiceV15;
    if(typeof oldClear==='function' && !oldClear.__v10021){ window.financeProClearInvoiceV15=function(){ sessionStorage.removeItem('tasneef_last_supplier_invoice_v10021'); return oldClear.apply(this,arguments); }; window.financeProClearInvoiceV15.__v10021=true; }
  }

  function patchInvoiceEditInPlace(){
    if(window.__finInvoiceEditInPlaceV10021) return;
    window.__finInvoiceEditInPlaceV10021=true;
    const oldEdit=window.financeProEditInvoiceV15;
    if(typeof oldEdit==='function'){
      window.financeProEditInvoiceV15=function(encoded){ const invoiceNo=decodeURIComponent(encoded||''); window.__financeEditInvoiceNoV10021=invoiceNo; window.__financeEditMovementIdsV10021=findInvoiceMovements(invoiceNo).map(m=>m.id); const ret=oldEdit.apply(this,arguments); setTimeout(()=>{ const btn=document.querySelector('button[onclick*="financeProSaveInvoiceV15"]'); if(btn) btn.textContent='تحديث نفس الفاتورة'; if(typeof window.msg==='function') window.msg('وضع تعديل الفاتورة مفعل: الحفظ سيحدث نفس حركات الفاتورة'); },300); return ret; };
    }
    const oldSave=window.financeProSaveInvoiceV15;
    if(typeof oldSave==='function'){
      window.financeProSaveInvoiceV15=async function(btn){
        const editInvoiceNo=S(window.__financeEditInvoiceNoV10021);
        if(!editInvoiceNo) return oldSave.apply(this,arguments);
        try{
          if(btn) btn.disabled=true; if(!window.sb) throw new Error('الاتصال غير جاهز');
          const st=state(), lines=A(st.invoiceLines); if(!lines.length) throw new Error('لا توجد منتجات داخل الفاتورة للتحديث');
          const supplier=S($('finInvSupplierV15')?.value), invoiceNo=S($('finInvNoV15')?.value)||editInvoiceNo, date=S($('finInvDateV15')?.value)||today();
          const oldMoves=findInvoiceMovements(editInvoiceNo), usedIds=[];
          for(let i=0;i<lines.length;i++){
            const l=lines[i]; let item=findItem(l); if(!item && oldMoves[i]) item=A(st.items).find(x=>String(x.id)===String(oldMoves[i].item_id)); if(!item) throw new Error('تعذر تحديد المنتج للسطر: '+(l.name||''));
            const q=N(l.qty), cost=unitNetFromLine(l), c=rowVat(q,l.price,l.tax_mode);
            const meta={module:'v10021-invoice-edit-in-place',invoiceNo,supplier,supplierInvoiceNo:S(l.supplier_invoice_no),minQuantity:N(l.min_quantity)||1,taxMode:S(l.tax_mode||'before'),beforeVat:+c.net.toFixed(2),vat:+c.vat.toFixed(2),afterVat:+c.gross.toFixed(2),editedFrom:editInvoiceNo,editedAt:new Date().toISOString()};
            const mv={item_id:item.id,item_name:item.name||l.name,movement_type:'in',quantity:q,movement_date:date,receiver:supplier,reason:'إضافة مخزون - فاتورة '+invoiceNo,notes:'finance_pro_v15:'+JSON.stringify(meta),product_code:S(l.code||itemCode(item)),barcode:S(l.distributor_code||item.supplier_barcode||itemCode(item)),unit_cost:+cost.toFixed(4)};
            const existing=oldMoves[i]; let res; if(existing&&existing.id){ usedIds.push(existing.id); res=await sb.from('inventory_movements').update(mv).eq('id',existing.id); } else { res=await sb.from('inventory_movements').insert(mv); }
            if(res.error) throw res.error;
            const upd={supplier:supplier||item.supplier||'',unit:l.unit||item.unit||'حبة',item_type:l.item_type||item.item_type||item.type||'مادة',type:l.item_type||item.type||item.item_type||'مادة',product_code:S(l.code||item.product_code||itemCode(item)),serial_number:S(l.code||item.serial_number||itemCode(item)),barcode:S(l.code||item.barcode||itemCode(item)),supplier_barcode:S(l.distributor_code||item.supplier_barcode||itemCode(item)),min_quantity:N(l.min_quantity)||N(item.min_quantity)||1,unit_cost:+cost.toFixed(4)}; if(l.image) upd.image_url=l.image;
            const ir=await sb.from('inventory_items').update(upd).eq('id',item.id); if(ir.error) console.warn('item update warning',ir.error);
          }
          const toDelete=oldMoves.filter(m=>!usedIds.includes(m.id)).map(m=>m.id).filter(Boolean); if(toDelete.length){ const dr=await sb.from('inventory_movements').delete().in('id',toDelete); if(dr.error) throw dr.error; }
          st.invoiceLines=[]; window.__financeEditInvoiceNoV10021=''; window.__financeEditMovementIdsV10021=[]; sessionStorage.removeItem('tasneef_last_supplier_invoice_v10021');
          await reloadFinance(); if(typeof window.msg==='function') window.msg('تم تحديث نفس الفاتورة وحركاتها بدون إنشاء عملية جديدة');
        }catch(e){ alert(e.message||String(e)); if(typeof window.msg==='function') window.msg(e.message||String(e),'err'); } finally{ if(btn) btn.disabled=false; }
      };
    }
  }

  function patchSupplierMovementsView(){
    if(window.__finSupplierMovementsViewV10021) return; window.__finSupplierMovementsViewV10021=true;
    const openModal=(title,html)=>document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:99999;display:grid;place-items:center;padding:18px"><div class="card" style="width:min(1120px,96vw);max-height:92vh;overflow:auto"><div class="fin-actions" style="justify-content:space-between"><h2>${esc(title)}</h2><button class="danger" onclick="this.closest('.modal-backdrop').remove()">إغلاق</button></div>${html}</div></div>`);
    window.financeProShowSupplierMovementsV10021=function(name){
      const st=state(), supplier=S(name);
      const moves=A(st.movements).filter(m=>S(m.receiver)===supplier||supplierNameForMove(m)===supplier).slice().sort((a,b)=>String(b.movement_date||b.created_at).localeCompare(String(a.movement_date||a.created_at))||Number(b.id||0)-Number(a.id||0));
      const rows=moves.map(m=>{ const meta=safeJson(m.notes), net=N(meta.beforeVat)||(N(m.quantity)*N(m.unit_cost)); return `<tr><td>${esc(m.movement_date||S(m.created_at).slice(0,10)||'-')}</td><td>${esc(supplierNameForMove(m)||'-')}</td><td>${esc(invoiceNoForMove(m)||'-')}</td><td>${esc(supplierInvoiceForMove(m)||'-')}</td><td>${esc(m.item_name||'-')}</td><td>${esc(m.movement_type==='in'?'داخل':m.movement_type)}</td><td>${N(m.quantity)}</td><td>${money(net)}</td><td>${m.id||'-'}</td><td class="fin-actions"><button class="light" onclick="financeProShowMovementV15(${Number(m.id)||0})">عرض</button></td></tr>`; }).join('')||'<tr><td colspan="10">لا توجد حركات لهذا المورد</td></tr>';
      openModal('حركات المورد: '+supplier,`<div class="fin-table"><table><thead><tr><th>التاريخ</th><th>المورد</th><th>رقم العملية</th><th>رقم فاتورة المورد</th><th>المنتج</th><th>النوع</th><th>الكمية</th><th>القيمة</th><th>رقم الحركة</th><th>إجراء</th></tr></thead><tbody>${rows}</tbody></table></div>`);
    };
    document.addEventListener('click',function(){ setTimeout(()=>{ const title=[...document.querySelectorAll('.modal-backdrop h2')].reverse().find(h=>S(h.textContent).startsWith('بيانات المورد:')); if(!title) return; const card=title.closest('.card'); if(!card||card.querySelector('[data-supplier-move-v10021]')) return; const supplier=S(title.textContent).replace('بيانات المورد:','').trim(); const actions=card.querySelector('.fin-actions'); if(actions) actions.insertAdjacentHTML('beforeend',`<button data-supplier-move-v10021="1" class="light" onclick="financeProShowSupplierMovementsV10021('${esc(supplier)}')">حركات المورد التفصيلية</button>`); },350); },true);
  }

  function patchConsumptionTypeFilter(){
    if(window.__finConsumptionTypeFilterV10021) return; window.__finConsumptionTypeFilterV10021=true;
    function addFilter(){ const container=$('finReportSearchV15')?.closest('.fin-actions'); if(!container||$('finReportConsumptionTypeV10021')) return; const wrap=document.createElement('div'); wrap.innerHTML=`<label>نوع الاستهلاك</label><select id="finReportConsumptionTypeV10021"><option value="">الكل</option><option value="consume">مستهلك</option><option value="waste">مهدور</option><option value="damaged">تالف</option><option value="scrap">سكراب</option><option value="return">مرتجع</option><option value="out">صرف</option><option value="in">داخل</option></select>`; const printBtn=[...container.querySelectorAll('button')].find(b=>S(b.textContent)==='طباعة'); container.insertBefore(wrap,printBtn||null); wrap.querySelector('select').addEventListener('change',applyFilter); }
    function labelForType(v){ return ({consume:'مستهلك',waste:'مهدور',damaged:'تالف',scrap:'سكراب',return:'مرتجع',out:'صرف',in:'داخل'})[v]||''; }
    function applyFilter(){ const val=S($('finReportConsumptionTypeV10021')?.value), label=labelForType(val); [...document.querySelectorAll('#finReportWindowV15 table')].forEach(table=>{ const headers=[...table.querySelectorAll('thead th')].map(th=>S(th.textContent)); let idx=headers.findIndex(h=>/نوع الاستهلاك|الحركة|النوع/.test(h)); if(idx<0) idx=1; [...table.querySelectorAll('tbody tr')].forEach(tr=>{ const txt=S([...tr.children][idx]?.textContent); tr.style.display=(!val||txt.includes(label))?'':'none'; }); }); }
    const oldRenderReports=window.financeProRenderReportsV15; if(typeof oldRenderReports==='function'&&!oldRenderReports.__v10021){ window.financeProRenderReportsV15=function(){ const ret=oldRenderReports.apply(this,arguments); setTimeout(()=>{addFilter();applyFilter();},100); return ret; }; window.financeProRenderReportsV15.__v10021=true; }
    const oldReportTab=window.financeProReportTabV15; if(typeof oldReportTab==='function'&&!oldReportTab.__v10021){ window.financeProReportTabV15=function(){ const ret=oldReportTab.apply(this,arguments); setTimeout(()=>{addFilter();applyFilter();},120); return ret; }; window.financeProReportTabV15.__v10021=true; }
    setInterval(()=>{ if(document.getElementById('finReportWindowV15')) addFilter(); },1000);
  }

  function boot(){ patchSupplierInvoicePersistence(); patchInvoiceEditInPlace(); patchSupplierMovementsView(); patchConsumptionTypeFilter(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',boot); setTimeout(boot,1200); setInterval(boot,3000);
  console.log('Tasneef finance inventory operations patch v10021 loaded');
})();

/* Tasneef v10174 - Official finance report product classification filter
   Scope: finance/inventory reports.
   The filter is applied to the report data arrays before the original report
   renderer calculates totals, then a DOM pass cleans any legacy/custom panels. */
(function(){
  'use strict';
  if(window.__tasneefFinanceReportsClassFilterV10174) return;
  window.__tasneefFinanceReportsClassFilterV10174=true;

  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const $=id=>document.getElementById(id);
  const state=()=>window.financeProStateV15||{};
  const norm=v=>S(v)
    .replace(/[\u064B-\u065F\u0670]/g,'')
    .replace(/[أإآ]/g,'ا')
    .replace(/ى/g,'ي')
    .replace(/ة/g,'ه')
    .replace(/[\u200e\u200f]/g,'')
    .replace(/\s+/g,' ')
    .toLowerCase();

  function canonicalClass(v){
    const n=norm(v);
    if(!n) return '';
    if(n==='اصل' || n==='asset' || n==='fixed asset' || n==='assets') return 'أصل';
    if(n==='منتج' || n==='product' || n==='products' || n==='item') return 'منتج';
    return '';
  }
  function productClass(obj){
    return canonicalClass(obj&&(obj.product_classification||obj.product_class||obj.asset_type||obj.classification||obj.item_class)) || 'منتج';
  }
  function itemCode(i){return S(i&&(i.product_code||i.serial_number||i.barcode||i.supplier_barcode||i.distributor_code||i.code));}
  function itemName(i){return S(i&&(i.name||i.item_name||i.product_name||itemCode(i)||i.id));}
  function itemKeys(i){
    return [i&&i.id,i&&i.item_id,itemCode(i),i&&i.product_code,i&&i.serial_number,i&&i.barcode,i&&i.supplier_barcode,i&&i.distributor_code,i&&i.code,itemName(i)]
      .map(x=>norm(x)).filter(Boolean);
  }
  function items(){return A(state().items).filter(Boolean);}
  function itemFor(obj){
    const keys=itemKeys(obj);
    if(!keys.length) return null;
    return items().find(i=>itemKeys(i).some(k=>keys.includes(k))) || null;
  }
  function classForRecord(record){
    const direct=canonicalClass(record&&(record.product_classification||record.product_class||record.asset_type||record.classification||record.item_class));
    if(direct) return direct;
    const item=itemFor(record);
    return item ? productClass(item) : '';
  }
  function wantedClass(){
    const raw=S($('finReportProductClassV10169')?.value || window.__tasneefFinanceReportProductClassV10174 || '');
    return canonicalClass(raw);
  }
  function setWanted(v){
    window.__tasneefFinanceReportProductClassV10174=canonicalClass(v);
  }
  function keepItem(i,wanted){return !wanted || productClass(i)===wanted;}
  function keepMovement(m,wanted){
    if(!wanted) return true;
    const cls=classForRecord(m);
    return cls ? cls===wanted : true;
  }

  function ensureStyle(){
    if($('finReportsClassFilterStyleV10174')) return;
    const st=document.createElement('style');
    st.id='finReportsClassFilterStyleV10174';
    st.textContent=`
      #finReportProductClassWrapV10169{min-width:165px!important;display:block!important;position:relative!important;background:transparent!important}
      #finReportProductClassWrapV10169 label{display:block!important;color:#063d31!important;font-weight:900!important;margin-bottom:5px!important}
      #finReportProductClassV10169{width:100%!important;min-width:155px!important;background:#fff!important;color:#063d31!important;border:1px solid #d8ebe3!important;border-radius:12px!important;padding:10px!important;box-shadow:none!important;appearance:auto!important;-webkit-appearance:auto!important}
      #finReportProductClassWrapV10170,#finReportProductClassWrapV10171,#finReportProductClassWrapV10172{display:none!important}
      .v10170-class-hidden,.v10171-class-hidden,.v10172-class-hidden,.v10174-class-hidden{display:none!important}
      .v10174-filter-note{background:#eef7f3;border:1px solid #d9e7e2;border-radius:12px;padding:8px 10px;margin:6px 0;color:#073d31;font-weight:800}
    `;
    document.head.appendChild(st);
  }
  function reportBox(){return $('finReportWindowV15') || document.querySelector('#finBodyV15');}
  function filterBar(){
    const box=reportBox();
    return box?.closest('.fin-card')?.querySelector('.fin-actions') || document.querySelector('#finBodyV15 .fin-actions') || null;
  }
  function removeLegacyFilters(){
    ['finReportProductClassWrapV10170','finReportProductClassWrapV10171','finReportProductClassWrapV10172'].forEach(id=>$(id)?.remove());
    ['finReportProductClassV10170','finReportProductClassV10171','finReportProductClassV10172'].forEach(id=>{
      const el=$(id);
      if(el?.parentElement) el.parentElement.remove();
    });
  }
  function ensureFilter(){
    ensureStyle();
    removeLegacyFilters();
    const bar=filterBar();
    if(!bar) return null;
    let wrap=$('finReportProductClassWrapV10169');
    let sel=$('finReportProductClassV10169');
    const current=canonicalClass(sel?.value) || wantedClass();
    if(!wrap || !sel){
      wrap=document.createElement('div');
      wrap.id='finReportProductClassWrapV10169';
      wrap.innerHTML='<label>تصنيف المنتج</label><select id="finReportProductClassV10169"><option value="">كل التصنيفات</option><option value="منتج">منتج</option><option value="أصل">أصل</option></select>';
      const print=[...bar.querySelectorAll('button')].find(b=>/طباعة|print/i.test(S(b.textContent)));
      if(print) bar.insertBefore(wrap,print);
      else bar.insertBefore(wrap,bar.firstChild);
      sel=$('finReportProductClassV10169');
    }else if(wrap.parentElement!==bar){
      bar.insertBefore(wrap,bar.firstChild);
    }
    if(sel && current) sel.value=current;
    if(sel && sel.dataset.boundV10174!=='1'){
      sel.dataset.boundV10174='1';
      sel.addEventListener('change',()=>{
        setWanted(sel.value);
        rerenderReports();
      });
    }
    return sel;
  }

  function withFilteredReportData(fn,args,ctx){
    const wanted=wantedClass();
    const st=state();
    if(!wanted || !st || !Array.isArray(st.items)) return fn.apply(ctx,args);
    const oldItems=st.items;
    const oldMovements=st.movements;
    const oldInventoryMovements=st.inventory_movements;
    try{
      st.items=A(oldItems).filter(i=>keepItem(i,wanted));
      if(Array.isArray(oldMovements)) st.movements=oldMovements.filter(m=>keepMovement(m,wanted));
      if(Array.isArray(oldInventoryMovements)) st.inventory_movements=oldInventoryMovements.filter(m=>keepMovement(m,wanted));
      return fn.apply(ctx,args);
    }finally{
      st.items=oldItems;
      if(Array.isArray(oldMovements)) st.movements=oldMovements;
      if(Array.isArray(oldInventoryMovements)) st.inventory_movements=oldInventoryMovements;
    }
  }

  function classForText(txt){
    const t=norm(txt);
    if(!t) return '';
    if(/تصنيف المنتج\s*[:：]?\s*اصل/.test(t) || /التصنيف\s*[:：]?\s*اصل/.test(t)) return 'أصل';
    if(/تصنيف المنتج\s*[:：]?\s*منتج/.test(t) || /التصنيف\s*[:：]?\s*منتج/.test(t)) return 'منتج';
    const byCode=items().map(i=>({i,c:norm(itemCode(i))})).filter(x=>x.c).sort((a,b)=>b.c.length-a.c.length).find(x=>t.includes(x.c));
    if(byCode) return productClass(byCode.i);
    const byName=items().map(i=>({i,n:norm(itemName(i))})).filter(x=>x.n&&x.n.length>1).sort((a,b)=>b.n.length-a.n.length).find(x=>t.includes(x.n));
    return byName ? productClass(byName.i) : '';
  }
  function hide(el,yes){
    if(!el) return;
    el.classList.toggle('v10174-class-hidden',!!yes);
    if(yes) el.style.display='none';
    else if(el.style.display==='none') el.style.display='';
  }
  function isTotalOrEmpty(el){
    return /لا توجد|لا يوجد|المجموع|الإجمالي|الاجمالي|Total/i.test(S(el?.textContent||''));
  }
  function cleanDomFilter(showNote){
    const wanted=wantedClass();
    const box=reportBox();
    if(!box) return;
    box.querySelectorAll('.v10170-class-hidden,.v10171-class-hidden,.v10172-class-hidden,.v10174-class-hidden').forEach(el=>hide(el,false));
    box.querySelector('#v10174FilterNote')?.remove();
    if(!wanted) return;
    let matched=0, checked=0;
    box.querySelectorAll('.fpr-product,.fin-product-card').forEach(card=>{
      const cls=classForText(card.textContent);
      if(!cls) return;
      checked++;
      const ok=cls===wanted;
      if(ok) matched++;
      hide(card,!ok);
    });
    box.querySelectorAll('tbody tr').forEach(tr=>{
      if(isTotalOrEmpty(tr)) return;
      const cls=classForText(tr.textContent);
      if(!cls) return;
      checked++;
      const ok=cls===wanted;
      if(ok) matched++;
      hide(tr,!ok);
    });
    if(showNote && checked){
      const note=document.createElement('div');
      note.id='v10174FilterNote';
      note.className='v10174-filter-note';
      note.textContent=`فلتر تصنيف المنتج: ${wanted} - النتائج المطابقة: ${matched}`;
      box.insertBefore(note,box.firstChild);
    }
  }
  function afterRender(){
    setTimeout(()=>{ensureFilter(); cleanDomFilter(false);},80);
    setTimeout(()=>{ensureFilter(); cleanDomFilter(false);},350);
  }
  function rerenderReports(){
    const st=state();
    if(st.tab==='reports' && typeof window.financeProRenderReportsV15==='function') window.financeProRenderReportsV15();
    else if(typeof window.financeProReportTabV15==='function') window.financeProReportTabV15(st.reportTab||'products');
    afterRender();
  }
  function patch(){
    ['financeProRenderReportsV15','financeProReportTabV15','financeProRenderCurrentV15','financeProRenderProductsReportV10170'].forEach(fn=>{
      const old=window[fn];
      if(typeof old==='function' && old.__classFilterV10174!=='1'){
        const wrap=function(){
          const result=withFilteredReportData(old,arguments,this);
          afterRender();
          return result;
        };
        wrap.__classFilterV10174='1';
        window[fn]=wrap;
      }
    });
    const oldPrint=window.financeProPrintReportV15;
    if(typeof oldPrint==='function' && oldPrint.__classFilterV10174!=='1'){
      const wrap=function(){
        ensureFilter();
        return withFilteredReportData(oldPrint,arguments,this);
      };
      wrap.__classFilterV10174='1';
      window.financeProPrintReportV15=wrap;
    }
  }
  function boot(){patch(); ensureFilter(); cleanDomFilter(false);}

  window.financeReportsApplyClassFilterV10173=function(){ensureFilter(); cleanDomFilter(false);};
  window.financeReportsApplyClassFilterV10174=window.financeReportsApplyClassFilterV10173;
  window.financeReportsKeepItemByClassV10174=keepItem;
  window.financeReportsKeepMovementByClassV10174=keepMovement;

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.addEventListener('load',()=>{setTimeout(boot,600);setTimeout(boot,1600);},{once:true});
  try{new MutationObserver(()=>{ if(reportBox()) setTimeout(boot,120); }).observe(document.documentElement,{childList:true,subtree:true});}catch(_){}
  console.log('Loaded v10174-finance-report-class-filter');
})();

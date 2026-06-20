/* Tasneef v10172 - Finance reports product class filter stable
   - فلتر واحد فقط لتصنيف المنتج داخل التقارير.
   - يستخدم id القديم finReportProductClassV10169 حتى تقرأه تقارير المنتجات الحالية.
   - يزيل الفلاتر المكررة v10170/v10171 ويمنع ظهور المربع الأسود الناتج عن التعارض.
   - يعمل على تقرير المنتجات وجرد المخزون وحركة المخزون ومراكز التكلفة واستهلاك مراكز التكلفة.
*/
(function(){
  'use strict';
  if(window.__tasneefFinanceReportsClassFilterV10172) return;
  window.__tasneefFinanceReportsClassFilterV10172=true;
  const VERSION='v10172-finance-report-class-filter-stable';
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const $=id=>document.getElementById(id);
  const state=()=>window.financeProStateV15||{};
  const norm=v=>S(v).replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u200e\u200f]/g,'').replace(/\s+/g,' ').toLowerCase();

  function ensureStyle(){
    if($('finReportsClassFilterStyleV10172')) return;
    const st=document.createElement('style'); st.id='finReportsClassFilterStyleV10172';
    st.textContent=`
      #finReportProductClassWrapV10169{min-width:165px!important;display:block!important;position:relative!important;background:transparent!important}
      #finReportProductClassWrapV10169 label{display:block!important;color:#063d31!important;font-weight:900!important;margin-bottom:5px!important}
      #finReportProductClassV10169{width:100%!important;min-width:155px!important;background:#fff!important;color:#063d31!important;border:1px solid #d8ebe3!important;border-radius:12px!important;padding:10px!important;box-shadow:none!important;appearance:auto!important;-webkit-appearance:auto!important}
      #finReportProductClassWrapV10170,#finReportProductClassWrapV10171{display:none!important}
      .v10170-class-hidden,.v10171-class-hidden,.v10172-class-hidden{display:none!important}
      .v10172-filter-note{background:#eef7f3;border:1px solid #d9e7e2;border-radius:12px;padding:8px 10px;margin:6px 0;color:#073d31;font-weight:800}
    `;
    document.head.appendChild(st);
  }
  function itemCode(i){return S(i&&(i.product_code||i.serial_number||i.barcode||i.supplier_barcode||i.distributor_code||i.code));}
  function itemName(i){return S(i&&(i.name||i.item_name||i.product_name||itemCode(i)||i.id));}
  function itemClass(i){
    const raw=S(i&&(i.product_classification||i.product_class||i.asset_type||i.classification||i.item_class));
    const n=norm(raw);
    if(raw==='أصل'||raw==='اصل'||n==='اصل'||n==='asset'||n==='fixed asset') return 'أصل';
    return 'منتج';
  }
  function allItems(){return A(state().items).filter(Boolean);}
  function savedClass(){return S(sessionStorage.getItem('tasneef_fin_report_product_class')||'');}
  function setSaved(v){try{sessionStorage.setItem('tasneef_fin_report_product_class',S(v));}catch(_){} }

  function filterBar(){
    const box=$('finReportWindowV15') || document.querySelector('#finBodyV15');
    return box?.closest('.fin-card')?.querySelector('.fin-actions') || document.querySelector('#finBodyV15 .fin-actions') || null;
  }
  function ensureFilter(){
    ensureStyle();
    const bar=filterBar(); if(!bar) return null;
    // إزالة/إخفاء الفلاتر المكررة التي سببت تعارضًا ومربعًا أسود.
    ['finReportProductClassWrapV10170','finReportProductClassWrapV10171'].forEach(id=>{ const el=$(id); if(el) el.remove(); });
    ['finReportProductClassV10170','finReportProductClassV10171'].forEach(id=>{ const el=$(id); if(el && el.parentElement) el.parentElement.remove(); });

    let wrap=$('finReportProductClassWrapV10169');
    let sel=$('finReportProductClassV10169');
    const cur=S(sel?.value||savedClass());
    if(!wrap || !sel){
      wrap=document.createElement('div'); wrap.id='finReportProductClassWrapV10169';
      wrap.innerHTML='<label>تصنيف المنتج</label><select id="finReportProductClassV10169"><option value="">كل التصنيفات</option><option value="منتج">منتج</option><option value="أصل">أصل</option></select>';
      const firstSelect=[...bar.querySelectorAll('select')].find(x=>/تصنيف المنتج/.test(S(x.closest('div')?.textContent||'')));
      if(firstSelect && firstSelect.closest('div')) firstSelect.closest('div').replaceWith(wrap);
      else bar.insertBefore(wrap, bar.firstChild);
      sel=$('finReportProductClassV10169');
    }else if(wrap.parentElement!==bar){
      bar.insertBefore(wrap, bar.firstChild);
    }
    if(sel.dataset.boundV10172!=='1'){
      sel.dataset.boundV10172='1';
      sel.addEventListener('change',()=>{ setSaved(sel.value); setTimeout(()=>{ rerenderProductsReportIfNeeded(); applyFilter(true); },30); });
    }
    if(cur && sel.value!==cur) sel.value=cur;
    return sel;
  }

  function productForText(txt){
    const t=norm(txt); if(!t) return null;
    const items=allItems();
    const byCode=items.map(i=>({i,c:norm(itemCode(i))})).filter(x=>x.c).sort((a,b)=>b.c.length-a.c.length).find(x=>t.includes(x.c));
    if(byCode) return byCode.i;
    const byName=items.map(i=>({i,n:norm(itemName(i))})).filter(x=>x.n&&x.n.length>1).sort((a,b)=>b.n.length-a.n.length).find(x=>t.includes(x.n));
    return byName?byName.i:null;
  }
  function classForText(txt){
    const t=norm(txt);
    if(/تصنيف\s*المنتج\s*[:：]?\s*اصل/.test(t)||/التصنيف\s*[:：]?\s*اصل/.test(t)) return 'أصل';
    if(/تصنيف\s*المنتج\s*[:：]?\s*منتج/.test(t)||/التصنيف\s*[:：]?\s*منتج/.test(t)) return 'منتج';
    const it=productForText(txt);
    return it?itemClass(it):'';
  }
  function reportBox(){return $('finReportWindowV15') || document.querySelector('#finBodyV15');}
  function hide(el,yes){
    if(!el) return;
    el.classList.toggle('v10172-class-hidden',!!yes);
    if(yes) el.style.display='none';
    else if(el.style.display==='none') el.style.display='';
  }
  function isTotalOrEmpty(el){return /لا توجد|لا يوجد|المجموع|الإجمالي|الاجمالي|Total/i.test(S(el?.textContent||''));}

  function productCards(box){
    return [...box.querySelectorAll('.fpr-product,.fin-product-card')];
  }
  function applyFilter(showNote){
    const sel=ensureFilter(); const wanted=S(sel?.value||''); const box=reportBox(); if(!box) return;
    setSaved(wanted);
    box.querySelectorAll('.v10170-class-hidden,.v10171-class-hidden,.v10172-class-hidden').forEach(el=>hide(el,false));
    box.querySelector('#v10172FilterNote')?.remove();
    if(!wanted) return;
    let matched=0, checked=0;

    productCards(box).forEach(card=>{
      const cls=classForText(card.textContent||'');
      if(!cls) return;
      checked++; const ok=cls===wanted; if(ok) matched++;
      hide(card,!ok);
    });

    box.querySelectorAll('tbody tr').forEach(tr=>{
      if(isTotalOrEmpty(tr)){ hide(tr,false); return; }
      const cls=classForText(tr.textContent||'');
      if(!cls) return; // ليس صف منتج، لا نخفيه.
      checked++; const ok=cls===wanted; if(ok) matched++;
      hide(tr,!ok);
    });

    if(showNote){
      const note=document.createElement('div'); note.id='v10172FilterNote'; note.className='v10172-filter-note';
      note.textContent=`فلتر تصنيف المنتج: ${wanted} — النتائج المطابقة: ${matched}`;
      box.insertBefore(note,box.firstChild);
    }
  }
  function rerenderProductsReportIfNeeded(){
    // تقرير المنتجات نفسه يقرأ finReportProductClassV10169، فنطلب إعادة رسمه حتى لا تبقى المنتجات غير المطابقة.
    try{
      if(typeof window.financeProRenderProductsReportV10170==='function') window.financeProRenderProductsReportV10170();
      else if(typeof window.financeProReportTabV15==='function'){
        const active=S(document.querySelector('#finBodyV15 .fin-tabs .active, #finBodyV15 button.active')?.textContent||'');
        if(/تقرير المنتجات/.test(active)) window.financeProReportTabV15('products');
      }
    }catch(_){ }
  }
  function patch(){
    if(window.__financeReportsClassFilterPatchV10172) return;
    window.__financeReportsClassFilterPatchV10172=true;
    ['financeProRenderReportsV15','financeProReportTabV15','financeProRenderCurrentV15','financeProRenderProductsReportV10170'].forEach(fn=>{
      const old=window[fn];
      if(typeof old==='function') window[fn]=function(){const r=old.apply(this,arguments); setTimeout(()=>applyFilter(false),120); setTimeout(()=>applyFilter(false),500); return r;};
    });
    const oldPrint=window.financeProPrintReportV15;
    if(typeof oldPrint==='function') window.financeProPrintReportV15=function(){applyFilter(false); return oldPrint.apply(this,arguments);};
  }
  function boot(){ patch(); ensureFilter(); applyFilter(false); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.addEventListener('load',()=>{setTimeout(boot,600);setTimeout(boot,1600);},{once:true});
  try{new MutationObserver(()=>{ if(reportBox()) setTimeout(()=>{ensureFilter(); applyFilter(false);},100); }).observe(document.documentElement,{childList:true,subtree:true});}catch(_){ }
  console.log('Loaded '+VERSION);
})();

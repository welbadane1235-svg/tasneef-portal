/* Tasneef v10112 - Finance Cost Center Tab Remove + Product Image Clear Zoom
   Scope: المالية والمخزون only. Does not touch orders, tickets, contracts, monthly, permissions. */
(function(){
  'use strict';
  if (window.__tasneefFinanceCleanImageZoomV10112) return;
  window.__tasneefFinanceCleanImageZoomV10112 = true;

  const VERSION = 'v10112-finance-hide-costcenter-image-zoom';
  const S = v => String(v ?? '').trim();
  const esc = v => S(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function isFinanceArea(node){
    try{
      return !!(node && (node.closest?.('#financeDashboard') || node.closest?.('#finance') || node.closest?.('.finance-pro') || node.closest?.('.fin-shell') || node.closest?.('.fin-product-card')));
    }catch(_){ return false; }
  }

  function buttonLooksCostCenter(btn){
    const txt = S(btn.textContent).replace(/\s+/g,' ');
    return /مركز\s*تكلفة|مركز\s*التكلفة|cost\s*center/i.test(txt);
  }

  function activateSummaryIfNeeded(hiddenBtn){
    try{
      if(!hiddenBtn || !hiddenBtn.classList.contains('active')) return;
      const root = hiddenBtn.closest('#financeDashboard') || hiddenBtn.closest('.fin-shell') || document;
      const summary = Array.from(root.querySelectorAll('button')).find(b => /ملخص|summary/i.test(S(b.textContent)) && b.offsetParent !== null);
      if(summary && summary !== hiddenBtn) summary.click();
    }catch(_){ }
  }

  function removeCostCenterTab(){
    const selectors = [
      '#financeDashboard button', '#finance button', '.fin-tabs button', '.finance-tabs button',
      'button.finance-tab', '[role="tab"]', 'button[onclick]'
    ];
    const seen = new Set();
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(btn => {
        if(seen.has(btn)) return; seen.add(btn);
        if(!buttonLooksCostCenter(btn)) return;
        activateSummaryIfNeeded(btn);
        btn.style.display = 'none';
        btn.setAttribute('aria-hidden','true');
        btn.setAttribute('data-v10112-hidden-cost-center','1');
      });
    });
    // Hide any orphan cost-center panel if present, but never remove data.
    document.querySelectorAll('[id*="cost"],[id*="Cost"],[data-tab*="cost"],[data-section*="cost"]').forEach(el=>{
      const txt=S(el.textContent);
      if(/مركز\s*تكلفة|مركز\s*التكلفة|cost\s*center/i.test(txt) && isFinanceArea(el)){
        el.style.display='none';
        el.setAttribute('data-v10112-hidden-cost-center-panel','1');
      }
    });
  }

  function installStyle(){
    if(document.getElementById('tasneefFinanceZoomStyleV10112')) return;
    const st=document.createElement('style');
    st.id='tasneefFinanceZoomStyleV10112';
    st.textContent=`
      [data-v10112-hidden-cost-center="1"]{display:none!important}
      .fin-thumb,.fin-product-card img{cursor:zoom-in!important}
      .tz10112-backdrop{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;padding:18px;direction:rtl;backdrop-filter:blur(3px)}
      .tz10112-box{width:min(1180px,96vw);max-height:96vh;display:grid;grid-template-rows:auto 1fr;background:#07140f;border:1px solid rgba(255,255,255,.18);border-radius:22px;box-shadow:0 35px 100px rgba(0,0,0,.45);overflow:hidden}
      .tz10112-head{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#0b3f32;color:#fff;padding:12px 16px}
      .tz10112-head b{font-size:18px;color:#fff}.tz10112-actions{display:flex;gap:8px;align-items:center}.tz10112-actions button,.tz10112-actions a{border:0;border-radius:12px;padding:9px 12px;background:#eef7f3;color:#073d31;font-weight:800;text-decoration:none;cursor:pointer}
      .tz10112-actions button.danger{background:#c73535;color:#fff}.tz10112-body{display:grid;place-items:center;min-height:60vh;padding:16px;background:#111}
      .tz10112-body img{display:block;max-width:100%;max-height:82vh;object-fit:contain;background:#fff;border-radius:16px;box-shadow:0 12px 55px rgba(0,0,0,.35)}
      @media(max-width:700px){.tz10112-head{align-items:flex-start;flex-direction:column}.tz10112-actions{width:100%;justify-content:space-between}.tz10112-body{min-height:50vh}}
    `;
    document.head.appendChild(st);
  }

  function openImageZoom(src, title){
    src = S(src); if(!src) return;
    closeImageZoom();
    const wrap=document.createElement('div');
    wrap.className='tz10112-backdrop';
    wrap.id='tasneefFinanceImageZoomV10112';
    wrap.innerHTML=`<div class="tz10112-box" role="dialog" aria-modal="true">
      <div class="tz10112-head"><b>${esc(title || 'صورة المنتج')}</b><div class="tz10112-actions"><a href="${esc(src)}" target="_blank" rel="noopener">فتح الصورة</a><button class="danger" type="button" data-close>إغلاق</button></div></div>
      <div class="tz10112-body"><img src="${esc(src)}" alt="${esc(title || 'صورة المنتج')}"></div>
    </div>`;
    wrap.addEventListener('click', e=>{ if(e.target===wrap || e.target.closest('[data-close]')) closeImageZoom(); });
    document.body.appendChild(wrap);
  }
  function closeImageZoom(){ document.getElementById('tasneefFinanceImageZoomV10112')?.remove(); }
  window.financeProZoomImageV15 = function(encoded, title){
    let url=S(encoded), ttl=S(title||'صورة المنتج');
    try{ url = decodeURIComponent(url); }catch(_){ }
    try{ ttl = decodeURIComponent(ttl); }catch(_){ }
    openImageZoom(url, ttl);
  };
  window.tasneefFinanceOpenProductImageV10112 = openImageZoom;

  function imageFromClick(e){
    const img = e.target && e.target.closest && e.target.closest('img');
    if(!img) return null;
    if(!isFinanceArea(img)) return null;
    const src = img.currentSrc || img.src || img.getAttribute('src') || '';
    if(!src || /^blob:$/i.test(src)) return null;
    // Only finance product images, not logos/icons.
    if(img.classList.contains('fin-thumb') || img.closest('.fin-product-card') || img.closest('#finProductListV15') || img.closest('[id*="Product"]')) return img;
    return null;
  }

  document.addEventListener('click', function(e){
    const img=imageFromClick(e);
    if(!img) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation?.();
    const card=img.closest('.fin-product-card');
    const title = img.getAttribute('alt') || card?.querySelector('h4')?.textContent || 'صورة المنتج';
    openImageZoom(img.currentSrc || img.src, title);
  }, true);

  function boot(){
    installStyle();
    removeCostCenterTab();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
  window.addEventListener('load', ()=>{ boot(); setTimeout(boot,700); setTimeout(boot,1800); }, {once:true});
  const mo = new MutationObserver(()=>removeCostCenterTab());
  try{ mo.observe(document.documentElement, {childList:true, subtree:true}); }catch(_){ }
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeImageZoom(); });
  console.log('Loaded '+VERSION);
})();

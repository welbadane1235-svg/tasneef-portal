/* Tasneef v10174 - Finance enterprise speed + reliable product resolver
   Purpose: speed up finance movement save and stop false "اختر المنتج" alerts.
   Safe: additive patch only, no database schema changes, no other sections touched.
*/
(function(){
  'use strict';
  const VERSION='v10174-finance-enterprise-speed';
  if(window.__tasneefFinanceEnterpriseSpeedV10174) return;
  window.__tasneefFinanceEnterpriseSpeedV10174=true;

  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const N=v=>Number(v||0)||0;
  const state=()=>window.financeProStateV15||{};
  const client=()=>window.sb||window.supabaseClient||window.supabase||null;
  const today=()=>new Date().toISOString().slice(0,10);
  const msg=(t,type)=>{try{ if(typeof window.msg==='function') window.msg(t,type); }catch(_){}};
  const movementOutTypes=()=>['out','consume','waste','damaged','scrap'];
  const moveSign=t=>{t=S(t); if(t==='in'||t==='return')return 1; if(movementOutTypes().includes(t))return -1; return 0;};
  const itemCode=i=>S(i&&(i.product_code||i.serial_number||i.barcode||i.supplier_barcode||i.distributor_code||i.code));
  const itemCost=i=>N(i&&(i.unit_cost||i.cost||i.price||i.purchase_price));
  const safeJson=v=>{const t=S(v); if(!t.startsWith('finance_pro_v15:'))return{}; try{return JSON.parse(t.replace('finance_pro_v15:',''))||{};}catch(_){return{};}};
  const movementStockDelta=m=>{const meta=safeJson(m&&m.notes)||{}; if(S(meta.stockEffect)==='none')return 0; return N(m&&m.quantity)*moveSign(m&&m.movement_type);};
  const movementComputedDelta=m=>{const meta=safeJson(m&&m.notes)||{}; const returned=A(meta.distribution).filter(d=>S(d.type)==='return'&&S(m&&m.movement_type)!=='return').reduce((a,d)=>a+N(d.qty),0); return movementStockDelta(m)+returned;};
  const reasonFor=t=>({return:'مرتجع مخزون',consume:'مستهلك',waste:'مهدور',damaged:'تالف',scrap:'سكراب',out:'صرف مخزون'})[S(t)]||'صرف مخزون';
  const staffName=id=>{const u=A(state().users).find(x=>String(x.id)===String(id)); return S(u&&(u.full_name||u.name||u.username))||S(id)||'-';};
  const selectedOptionText=sel=>S(sel&&sel.options&&sel.selectedIndex>=0?sel.options[sel.selectedIndex].textContent:'');
  const cleanProductName=txt=>S(txt).replace(/\s*-\s*المتوفر\s*.*$/,'').trim();

  function currentUserName(){
    try{const u=JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{}; return S(u.full_name||u.name||u.username||u.email||'');}catch(_){return'';}
  }

  function localFindItem(val, label){
    const st=state();
    const clean=cleanProductName(label);
    return A(st.items).find(i=>String(i.id)===String(val))
      || A(st.items).find(i=>itemCode(i)&&itemCode(i)===S(val))
      || A(st.items).find(i=>S(i.name)===clean)
      || A(st.items).find(i=>clean && S(i.name).toLowerCase()===clean.toLowerCase())
      || A(st.items).find(i=>[i.product_code,i.serial_number,i.barcode,i.supplier_barcode,i.distributor_code,i.code].map(S).includes(S(val)));
  }

  async function dbFindItem(val, label){
    const c=client(); if(!c) return null;
    const clean=cleanProductName(label);
    const tries=[];
    if(S(val) && /^\d+$/.test(S(val))) tries.push(q=>q.eq('id',Number(val)));
    if(S(val) && !String(val).startsWith('fb_')){
      const safe=S(val).replace(/[",()]/g,'');
      if(safe) tries.push(q=>q.or(`product_code.eq.${safe},serial_number.eq.${safe},barcode.eq.${safe},supplier_barcode.eq.${safe},distributor_code.eq.${safe},code.eq.${safe}`));
    }
    if(clean) tries.push(q=>q.eq('name',clean));
    for(const build of tries){
      try{
        let q=c.from('inventory_items').select('*').limit(1);
        q=build(q);
        const res=await q;
        if(!res.error && A(res.data).length) return A(res.data)[0];
      }catch(_){/* next */}
    }
    return null;
  }

  async function resolveSelectedItem(){
    const sel=$('finMoveItemV15');
    const val=S(sel&&sel.value);
    const label=selectedOptionText(sel);
    let item=localFindItem(val,label);
    if(item) return item;
    msg('جاري تجهيز بيانات المنتج...', 'warn');
    item=await dbFindItem(val,label);
    if(item){
      const st=state();
      const idx=A(st.items).findIndex(i=>String(i.id)===String(item.id));
      if(idx>=0) st.items[idx]=item; else {st.items=Array.isArray(st.items)?st.items:[]; st.items.push(item);}
      return item;
    }
    throw new Error('المنتج غير جاهز في الذاكرة. اضغط تحديث البيانات مرة واحدة ثم أعد المحاولة.');
  }

  function currentQty(item){return N(item&&item.quantity);}

  function refreshFinanceLight(){
    try{
      if(typeof window.financeProRenderCurrentV15==='function') window.financeProRenderCurrentV15();
      else if(typeof window.financeProTabV15==='function') window.financeProTabV15((state().tab)||'movement');
      setTimeout(scanVisibleProductImages,80);
    }catch(_){ }
  }

  async function saveMovementEnterprise(btn){
    const start=performance.now();
    try{
      if(btn){btn.disabled=true; btn.dataset.oldText=btn.textContent||''; btn.textContent='حفظ سريع...';}
      const c=client(); if(!c) throw new Error('الاتصال غير جاهز');
      const st=state();
      const item=await resolveSelectedItem();
      const qty=N($('finMoveQtyV15')?.value), type=S($('finMoveTypeV15')?.value)||'out';
      if(qty<=0) throw new Error('الكمية مطلوبة');
      const old=st.editMovementId?A(st.movements).find(m=>String(m.id)===String(st.editMovementId)):null;
      const same=old&&String(old.item_id)===String(item.id)?old:null;
      const oldItem=old&&!same?A(st.items).find(i=>String(i.id)===String(old.item_id)):null;
      const availableBeforeOld=same?(currentQty(item)-movementComputedDelta(old)):currentQty(item);
      if(movementOutTypes().includes(type)&&availableBeforeOld<qty) throw new Error('الكمية المتوفرة لا تكفي');
      const dist=A(st.distribution);
      const distTotal=dist.reduce((s,d)=>s+N(d.qty),0);
      if(movementOutTypes().includes(type)&&dist.length&&Math.abs(distTotal-qty)>.001) throw new Error('إجمالي التوزيع يجب أن يساوي كمية الحركة');
      const staff=S($('finMoveStaffV15')?.value);
      const oldMeta=old?safeJson(old.notes):{};
      const nowIso=new Date().toISOString();
      const meta={...oldMeta,module:VERSION,staffId:staff,note:S($('finMoveNoteV15')?.value),distribution:dist,stockEffect:'normal',updatedBy:currentUserName(),updatedAt:nowIso};
      if(!old){meta.createdBy=currentUserName(); meta.createdAt=nowIso;}
      const mv={
        item_id:item.id,item_name:item.name,movement_type:type,quantity:qty,
        movement_date:S($('finMoveDateV15')?.value)||today(),receiver:staffName(staff),reason:reasonFor(type),
        notes:'finance_pro_v15:'+JSON.stringify(meta),product_code:itemCode(item),barcode:itemCode(item),unit_cost:+itemCost(item).toFixed(4)
      };
      const oldMainDelta=same?movementStockDelta(old):0;
      const baseRaw=N(item.quantity)-oldMainDelta;
      const newRaw=baseRaw+(qty*moveSign(type));
      const writes=[];
      let movementPromise;
      if(old) movementPromise=c.from('inventory_movements').update(mv).eq('id',old.id).select('*');
      else movementPromise=c.from('inventory_movements').insert(mv).select('*');
      writes.push(movementPromise);
      if(oldItem){
        const oldRawBefore=N(oldItem.quantity)-movementStockDelta(old);
        writes.push(c.from('inventory_items').update({quantity:oldRawBefore}).eq('id',oldItem.id).select('*'));
      }
      writes.push(c.from('inventory_items').update({quantity:newRaw}).eq('id',item.id).select('*'));
      const results=await Promise.all(writes);
      const err=results.find(r=>r&&r.error);
      if(err) throw err.error;
      const saved=A(results[0].data)[0]||{...old,...mv};
      const updatedItem=A(results[results.length-1].data)[0]||{...item,quantity:newRaw};
      const itemIdx=A(st.items).findIndex(i=>String(i.id)===String(item.id));
      if(itemIdx>=0) st.items[itemIdx]=updatedItem; else st.items.push(updatedItem);
      if(oldItem && results.length===3){
        const oi=A(results[1].data)[0]||oldItem;
        const oiIdx=A(st.items).findIndex(i=>String(i.id)===String(oldItem.id));
        if(oiIdx>=0) st.items[oiIdx]=oi;
      }
      if(old){const mIdx=A(st.movements).findIndex(m=>String(m.id)===String(old.id)); if(mIdx>=0) st.movements[mIdx]=saved; else st.movements.push(saved);} else st.movements.push(saved);
      st.distribution=[]; st.editMovementId='';
      refreshFinanceLight();
      msg(old?'تم تعديل حركة المخزون بسرعة':'تم حفظ حركة المخزون بسرعة');
      console.log('Tasneef enterprise finance save:', Math.round(performance.now()-start)+'ms');
    }catch(e){
      alert(e.message||String(e)); msg(e.message||String(e),'err');
    }finally{
      if(btn){btn.disabled=false; btn.textContent=btn.dataset.oldText||'حفظ الحركة';}
    }
    return false;
  }

  function installSavePatch(){
    window.__financeProSaveMovementV15OriginalFinal=window.__financeProSaveMovementV15OriginalFinal||window.financeProSaveMovementV15;
    window.financeProSaveMovementV15=saveMovementEnterprise;
  }

  const IMG_CACHE='tasneef_finance_image_cache_v10174';
  function readImgCache(){try{return JSON.parse(localStorage.getItem(IMG_CACHE)||'{}')||{};}catch(_){return{};}}
  function writeImgCache(obj){try{localStorage.setItem(IMG_CACHE,JSON.stringify(obj||{}));}catch(_){}}
  function cardId(card){
    const onclick=S(card.querySelector('[onclick*="financeProShowProductV15"]')?.getAttribute('onclick'));
    const m=onclick.match(/financeProShowProductV15\('([^']+)'\)/);
    return m?decodeURIComponent(m[1]):'';
  }
  async function fetchImageForCard(card){
    if(!card||card.__imgFetch10174) return; card.__imgFetch10174=true;
    const id=cardId(card); if(!id || String(id).startsWith('fb_')) return;
    const cache=readImgCache();
    let url=S(cache[id]);
    if(!url){
      try{
        const res=await client().from('inventory_items').select('id,image_url').eq('id',id).limit(1);
        if(!res.error && A(res.data).length){ url=S(A(res.data)[0].image_url); if(url){cache[id]=url; writeImgCache(cache);} }
      }catch(_){ }
    }
    if(!url) return;
    const old=card.querySelector('.fin-thumb');
    if(old && old.tagName!=='IMG'){
      const img=document.createElement('img');
      img.className='fin-thumb'; img.loading='lazy'; img.decoding='async'; img.fetchPriority='low'; img.src=url;
      img.onclick=()=>{ if(typeof window.financeProZoomImageV15==='function') window.financeProZoomImageV15(encodeURIComponent(url), encodeURIComponent(S(card.querySelector('h4')?.textContent||''))); };
      old.replaceWith(img);
    }else if(old && old.tagName==='IMG' && !S(old.src)){ old.src=url; }
  }
  function scanVisibleProductImages(){
    try{
      const cards=[...document.querySelectorAll('#financeDashboard .fin-product-card')];
      if(!cards.length) return;
      const run=card=>fetchImageForCard(card);
      if('IntersectionObserver' in window){
        const io=new IntersectionObserver(entries=>{
          entries.forEach(e=>{if(e.isIntersecting){io.unobserve(e.target); run(e.target);}});
        },{root:null,rootMargin:'250px'});
        cards.forEach(c=>io.observe(c));
      }else cards.slice(0,20).forEach(run);
    }catch(_){ }
  }

  function patchRenderHooks(){
    const oldRender=window.financeProRenderProductListV15;
    if(typeof oldRender==='function' && !oldRender.__v10174){
      const wrapped=function(){ const r=oldRender.apply(this,arguments); setTimeout(scanVisibleProductImages,60); return r; };
      wrapped.__v10174=true; window.financeProRenderProductListV15=wrapped;
    }
    const oldTab=window.financeProTabV15;
    if(typeof oldTab==='function' && !oldTab.__v10174){
      const wrapped=function(tab){ const r=oldTab.apply(this,arguments); if(tab==='products'||tab==='movement') setTimeout(scanVisibleProductImages,120); return r; };
      wrapped.__v10174=true; window.financeProTabV15=wrapped;
    }
  }

  function addBusyGuardStyle(){
    if(document.getElementById('financeEnterpriseSpeedStyle10174')) return;
    const st=document.createElement('style'); st.id='financeEnterpriseSpeedStyle10174';
    st.textContent='#financeDashboard .fin-thumb{background:#fff;object-fit:contain}#financeDashboard select:disabled,#financeDashboard button:disabled{opacity:.65;cursor:wait}';
    document.head.appendChild(st);
  }

  function boot(){
    addBusyGuardStyle();
    installSavePatch();
    patchRenderHooks();
    scanVisibleProductImages();
    console.log('Tasneef '+VERSION+' loaded');
  }
  let tries=0;
  const timer=setInterval(()=>{tries++; if(window.financeProStateV15 && window.financeProSaveMovementV15){clearInterval(timer); boot();} if(tries>80){clearInterval(timer); boot();}},150);
  window.addEventListener('load',()=>setTimeout(()=>{installSavePatch(); patchRenderHooks(); scanVisibleProductImages();},600));
})();

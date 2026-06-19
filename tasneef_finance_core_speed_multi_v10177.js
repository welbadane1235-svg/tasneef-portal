/* Tasneef v10183 - Finance core speed + unified multi-product movement
   هدف الملف: حل جذري داخل المالية فقط بدون حقن متعدد وبدون التأثير على الأقسام الأخرى.
   - تحميل المنتجات سريع: لا يتم تحميل image_url الثقيل مع أول فتح، ويتم تحميل الصور بالخلفية.
   - قسم العمليات: تحويل قائمة المنتج إلى قائمة بحث قابلة للكتابة.
   - قسم الحركة: واجهة واحدة لحركة متعددة المنتجات، بوكس مستقل لكل منتج.
   - حفظ العمليات والحركات سريع بدون إعادة تحميل كاملة للقسم.
*/
(function(){
  'use strict';
  const VERSION='v10183-finance-core-speed-multi-order-link-core';
  if(window.__tasneefFinanceCoreSpeedMulti10177 && window.__tasneefFinanceCoreSpeedMulti10177_VERSION===VERSION) return;
  window.__tasneefFinanceCoreSpeedMulti10177=true;
  window.__tasneefFinanceCoreSpeedMulti10177_VERSION=VERSION;

  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[v].filter(Boolean);
  const S=v=>String(v??'').trim();
  const N=v=>Number(v||0)||0;
  const VAT=0.15;
  const today=()=>new Date().toISOString().slice(0,10);
  const client=()=>window.sb||window.supabaseClient||window.supabase||null;
  const st=()=>window.financeProStateV15||{};
  const msg=(t,type)=>{try{if(typeof window.msg==='function')window.msg(t,type);}catch(_){}};
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=v=>`${N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س`;
  const safeJson=v=>{const t=S(v); if(!t.startsWith('finance_pro_v15:'))return{}; try{return JSON.parse(t.replace('finance_pro_v15:',''))||{};}catch(_){return{};}};
  const currentUser=()=>{try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};}};
  const currentUserName=()=>{const u=currentUser(); return S(u.full_name||u.name||u.username||u.email||u.id||'');};
  const itemCode=i=>S(i&&(i.product_code||i.serial_number||i.barcode||i.supplier_barcode||i.distributor_code||i.code));
  const itemDistCode=i=>S(i&&(i.supplier_barcode||i.distributor_code||i.barcode||i.product_code||i.code));
  const itemCost=i=>N(i&&(i.unit_cost||i.cost||i.price||i.purchase_price));
  const itemName=i=>S(i&&(i.name||i.item_name||itemCode(i)||i.id));
  const itemType=i=>S(i&&(i.item_type||i.type||i.category))||'مادة';
  const productItems=()=>A(st().items).filter(i=>i&&S(i.id));
  const itemById=id=>productItems().find(i=>String(i.id)===String(id));
  const projectName=id=>A(st().projects).find(p=>String(p.id)===String(id))?.name||A(st().projects).find(p=>String(p.id)===String(id))?.project_name||'';
  const staffName=id=>A(st().users).find(u=>String(u.id)===String(id))?.full_name||A(st().users).find(u=>String(u.id)===String(id))?.name||A(st().users).find(u=>String(u.id)===String(id))?.username||S(id)||'-';
  const moveSign=t=>{t=S(t); if(t==='in'||t==='return')return 1; if(['out','consume','waste','damaged','scrap'].includes(t))return -1; return 0;};
  const reasonFor=t=>({return:'مرتجع مخزون',consume:'مستهلك',waste:'مهدور',damaged:'تالف',scrap:'سكراب',out:'صرف مخزون'})[S(t)]||'صرف مخزون';
  const labelFor=t=>({return:'مرتجع',consume:'مستهلك',waste:'مهدور',damaged:'تالف',scrap:'سكراب',out:'صرف'})[S(t)]||S(t)||'-';
  const movementOutTypes=()=>['out','consume','waste','damaged','scrap'];
  const rowVat=(qty,price,mode='before')=>{const total=N(qty)*N(price); mode=S(mode||'before'); if(mode==='after'){const net=total/(1+VAT);return{net,vat:total-net,gross:total};} if(mode==='none')return{net:total,vat:0,gross:total}; return{net:total,vat:total*VAT,gross:total*(1+VAT)};};
  const unitNetFromLine=l=>S(l.tax_mode)==='after'?N(l.price)/(1+VAT):N(l.price);


  const ORDERS_TABLE='orders_shared';
  const ORDER_INV_FIELD='تكلفة المخزن';
  const ORDER_INV_BEFORE='تكلفة المخزن قبل الضريبة';
  const ORDER_INV_VAT='ضريبة تكلفة المخزن';
  const ORDER_INV_AFTER='تكلفة المخزن شامل الضريبة';
  const normalizeOrderNo=v=>S(v).replace(/\s+/g,'').toUpperCase();
  function orderData(o){ return (o&&typeof o.data==='object'&&o.data) ? o.data : {}; }
  function orderDisplayNo(o){ const d=orderData(o); return normalizeOrderNo(o&&o.order_no || d['رقم الطلب'] || d.order_no || d.orderNo || ''); }
  async function fetchLinkedOrder10182(orderNo){
    const no=normalizeOrderNo(orderNo); if(!no) return null;
    const c=client(); if(!c) return null;
    const res=await c.from(ORDERS_TABLE).select('order_no,data,flow,updated_at').eq('order_no',no).limit(1);
    if(res.error) throw res.error;
    return A(res.data)[0] || null;
  }
  function orderSmartHtml10182(rec){
    const d=orderData(rec); const no=orderDisplayNo(rec);
    const cell=(label,val)=>`<div><small>${esc(label)}</small><b>${esc(val||'-')}</b></div>`;
    return `<div class="v10182-order-card"><h3>تأكيد ربط حركة المخزون بالأوردر</h3><div class="v10182-grid">
      ${cell('رقم الأوردر',no)}${cell('رقم الطلب بالجروب',d['رقم الطلب بالجروب']||d.group_no||d.groupNo)}${cell('المشروع',d['المشروع']||d.project||d.project_name)}${cell('العميل',d['اسم العميل']||d.client||d.customer)}${cell('المنفذ',d['المنفذ']||d.executor)}${cell('حالة التنفيذ',d['حالة التنفيذ']||d.execution_status)}
    </div><p>${esc(d['التفاصيل']||d.details||d.description||'')}</p></div>`;
  }
  function smartConfirmOrder10182(rec){
    return new Promise(resolve=>{
      const wrap=document.createElement('div'); wrap.className='v10182-backdrop';
      wrap.innerHTML=`<div class="v10182-modal">${orderSmartHtml10182(rec)}<div class="v10182-actions"><button type="button" id="v10182Yes">نعم ربط الحركة</button><button type="button" class="light" id="v10182No">لا</button></div></div>`;
      document.body.appendChild(wrap);
      wrap.querySelector('#v10182Yes').onclick=()=>{wrap.remove(); resolve(true);};
      wrap.querySelector('#v10182No').onclick=()=>{wrap.remove(); resolve(false);};
      wrap.addEventListener('click',e=>{if(e.target===wrap){wrap.remove(); resolve(false);}});
    });
  }
  async function confirmOrderForInput10182(input){
    const no=normalizeOrderNo(input&&input.value); if(!input||!no) return true;
    if(input.dataset.confirmedOrder10182===no) return true;
    const rec=await fetchLinkedOrder10182(no);
    if(!rec){ alert('لم يتم العثور على الأوردر: '+no); return false; }
    const ok=await smartConfirmOrder10182(rec);
    if(ok){ input.dataset.confirmedOrder10182=no; input.dataset.orderLinked10182='1'; input.classList.add('v10182-linked-order'); return true; }
    input.dataset.orderLinked10182='0'; input.classList.remove('v10182-linked-order'); return false;
  }
  window.financeMultiBoxesConfirmOrder10182=async function(input){ try{return await confirmOrderForInput10182(input);}catch(e){alert('تعذر فحص الأوردر: '+(e.message||e)); return false;} };
  function orderCostFromMovementRow10182(row){ return N(row.quantity)*N(row.unit_cost); }
  async function updateOrdersInventoryCost10182(orderCostMap){
    const c=client(); if(!c) return;
    for(const [orderNo,cost] of orderCostMap.entries()){
      const no=normalizeOrderNo(orderNo); if(!no||cost<=0) continue;
      const rec=await fetchLinkedOrder10182(no).catch(()=>null); if(!rec) continue;
      const data=Object.assign({}, orderData(rec));
      const prev=N(data[ORDER_INV_FIELD] ?? data[ORDER_INV_BEFORE]);
      const before=+(prev+cost).toFixed(2), vat=+(before*VAT).toFixed(2), after=+(before*(1+VAT)).toFixed(2);
      data[ORDER_INV_FIELD]=before; data[ORDER_INV_BEFORE]=before; data[ORDER_INV_VAT]=vat; data[ORDER_INV_AFTER]=after; data.__inventory_cost_linked=true; data.__inventory_cost_updated_at=new Date().toISOString(); data.__inventory_cost_updated_by=VERSION;
      const upd=await c.from(ORDERS_TABLE).update({data,flow:rec.flow||{},updated_at:new Date().toISOString()}).eq('order_no',no);
      if(upd.error) console.warn(VERSION,'order update failed',no,upd.error.message||upd.error);
    }
  }

  // 1) تحميل سريع للمنتجات: منع image_url الثقيلة من تعطيل أول فتح للمالية.
  const FAST_ITEMS_SELECT='id,name,product_code,serial_number,barcode,supplier_barcode,unit,item_type,type,quantity,min_quantity,unit_cost,supplier,category,notes,created_by_name,updated_by_name,updated_at';
  const LS_IMAGES='tasneef_finance_product_images_cache_v10177';
  function readImageCache(){try{return JSON.parse(localStorage.getItem(LS_IMAGES)||'{}')||{};}catch(_){return{};}}
  function saveImageCache(map){try{localStorage.setItem(LS_IMAGES,JSON.stringify(map||{}));}catch(_){}}
  function applyCachedImages(){
    const map=readImageCache(); const items=A(st().items); let changed=false;
    items.forEach(i=>{const img=map[String(i.id)]||map[itemCode(i)]||''; if(img&&!S(i.image_url)){i.image_url=img; changed=true;}});
    return changed;
  }
  let imagesLoading=false, imagesLoaded=false;
  async function loadImagesInBackground(){
    if(imagesLoading||imagesLoaded) return;
    imagesLoading=true;
    try{
      const c=client(); if(!c) return;
      const res=await c.from('inventory_items').select('id,image_url,product_code,serial_number,barcode,supplier_barcode,name').limit(10000);
      if(res.error) return;
      const map=readImageCache();
      A(res.data).forEach(i=>{const img=S(i.image_url); if(!img)return; [i.id,i.product_code,i.serial_number,i.barcode,i.supplier_barcode,i.name].map(S).filter(Boolean).forEach(k=>{map[k]=img;});});
      saveImageCache(map);
      A(st().items).forEach(i=>{const img=map[String(i.id)]||map[itemCode(i)]||map[S(i.name)]||''; if(img)i.image_url=img;});
      imagesLoaded=true;
      if(S(st().tab)==='products'&&typeof window.financeProRenderProductListV15==='function') window.financeProRenderProductListV15();
    }catch(_){/* background only */}
    finally{imagesLoading=false;}
  }
  function patchSupabaseFastItems(){
    const c=client(); if(!c||c.__tasneefFastItems10177) return;
    c.__tasneefFastItems10177=true;
    const oldFrom=c.from.bind(c);
    c.from=function(tableName){
      const q=oldFrom(tableName);
      try{
        if(String(tableName)==='inventory_items' && q && typeof q.select==='function'){
          const oldSelect=q.select.bind(q);
          q.select=function(columns,...args){
            const cols=S(columns||'*');
            if(cols==='*') columns=FAST_ITEMS_SELECT;
            return oldSelect(columns,...args);
          };
        }
      }catch(_){ }
      return q;
    };
  }

  function ensureStyle(){
    if($('financeCoreSpeedMultiStyle10177'))return;
    const css=`
      .fin-fast-search-wrap{position:relative}.fin-fast-search-input{width:100%;border:1px solid #cfe3db;border-radius:12px;padding:10px;background:#fff}.fin-fast-search-menu{position:absolute;z-index:9999;top:calc(100% + 4px);right:0;left:0;max-height:280px;overflow:auto;background:#fff;border:1px solid #cfe3db;border-radius:14px;box-shadow:0 18px 40px rgba(7,61,49,.16);display:none}.fin-fast-search-menu.show{display:block}.fin-fast-search-item{padding:10px;border-bottom:1px solid #eef4f1;cursor:pointer}.fin-fast-search-item:hover{background:#eef7f3}.fin-fast-search-item b{color:#073d31}.fin-fast-search-item small{display:block;color:#6b7d77;margin-top:3px}.fin-hidden-select-10177{display:none!important}
      #finMultiProductOp10175,#finMultiBoxes10176{display:none!important}.mb10177-wrap{border:2px solid #0d5b49;background:linear-gradient(180deg,#fbfffd,#f4faf7);border-radius:20px;padding:16px}.mb10177-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.mb10177-box{background:#fff;border:1px solid #d9e7e2;border-radius:18px;padding:14px;margin:12px 0;box-shadow:0 8px 25px rgba(7,61,49,.06)}.mb10177-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.mb10177-head h4{margin:0;color:#073d31}.mb10177-main{display:grid;grid-template-columns:2fr .8fr .7fr .7fr auto;gap:8px;align-items:end;margin:12px 0}.mb10177-row{display:grid;grid-template-columns:.65fr 1.05fr 1.05fr .75fr .75fr .95fr 1.1fr auto;gap:8px;align-items:end;margin:8px 0;padding:10px;border:1px solid #e2eee9;border-radius:14px;background:#f8fbfa}.mb10177-kpi{background:#eef7f3;border:1px solid #d9e7e2;border-radius:12px;padding:8px}.mb10177-kpi small{display:block;color:#667c75}.mb10177-kpi b{font-size:18px;color:#073d31}.mb10177-badge{border-radius:999px;padding:6px 10px;font-weight:800}.mb10177-badge.ok{background:#e6f7ec;color:#087047}.mb10177-badge.warn{background:#fff5d6;color:#8a5b00}.mb10177-badge.bad{background:#ffe7e7;color:#b42318}.v10182-linked-order{border-color:#0b7a53!important;background:#f1fff8!important}.v10182-backdrop{position:fixed;inset:0;background:rgba(0,35,28,.48);z-index:999999;display:grid;place-items:center;padding:18px}.v10182-modal{width:min(760px,96vw);background:#fff;border-radius:20px;padding:18px;box-shadow:0 22px 80px rgba(0,0,0,.25);direction:rtl}.v10182-order-card h3{margin:0 0 12px;color:#063f32}.v10182-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px}.v10182-grid div{border:1px solid #dcebe5;border-radius:12px;padding:9px;background:#f8fbfa}.v10182-grid small{display:block;color:#60706a;margin-bottom:4px}.v10182-grid b{color:#063f32}.v10182-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}.mb10177-title{font-weight:900;color:#073d31;margin:10px 0 6px}.mb10177-old-hidden{display:none!important}
      .mb10183-row{grid-template-columns:.65fr 1fr 1fr .75fr .75fr 1fr 1.25fr auto!important;overflow:visible!important}.mb10183-order input,.mb10183-note input{min-width:100%;background:#fff}.mb10183-order label,.mb10183-note label{font-weight:800;color:#073d31}.mb10177-row label{display:block!important;margin-bottom:4px!important;color:#073d31!important;font-weight:800!important}@media(max-width:1200px){.mb10183-row{grid-template-columns:repeat(2,1fr)!important}.mb10183-row button{grid-column:1/-1}}
@media(max-width:900px){.mb10177-main,.mb10177-row{grid-template-columns:1fr!important}}
    `;
    const stl=document.createElement('style'); stl.id='financeCoreSpeedMultiStyle10177'; stl.textContent=css; document.head.appendChild(stl);
  }

  // 2) قائمة بحث احترافية بدل select الطويلة.
  function productDisplay(i){return `${itemName(i)}${itemCode(i)?' - '+itemCode(i):''}${itemDistCode(i)&&itemDistCode(i)!==itemCode(i)?' - '+itemDistCode(i):''} - المتوفر ${N(i.quantity)}`;}
  function findProductByText(text){
    const q=S(text).toLowerCase(); if(!q)return null;
    return productItems().find(i=>[i.id,i.name,i.product_code,i.serial_number,i.barcode,i.supplier_barcode,i.distributor_code,i.code].map(S).some(v=>v.toLowerCase()===q)) ||
           productItems().find(i=>productDisplay(i).toLowerCase()===q) ||
           productItems().find(i=>productDisplay(i).toLowerCase().includes(q));
  }
  function makeSearchableSelect(select, opts={}){
    if(!select||select.dataset.fastSearch10177) return;
    select.dataset.fastSearch10177='1';
    select.classList.add('fin-hidden-select-10177');
    const wrap=document.createElement('div'); wrap.className='fin-fast-search-wrap';
    const input=document.createElement('input'); input.className='fin-fast-search-input'; input.placeholder=opts.placeholder||'اكتب اسم المنتج أو الكود'; input.autocomplete='off';
    const menu=document.createElement('div'); menu.className='fin-fast-search-menu';
    select.parentNode.insertBefore(wrap,select); wrap.appendChild(input); wrap.appendChild(menu); wrap.appendChild(select);
    function currentText(){const op=[...select.options].find(o=>String(o.value)===String(select.value)); return op?op.textContent:'';}
    input.value=currentText();
    function close(){setTimeout(()=>menu.classList.remove('show'),160);}
    function render(){
      const q=S(input.value).toLowerCase();
      const items=productItems().filter(i=>!q||productDisplay(i).toLowerCase().includes(q)).slice(0,60);
      menu.innerHTML=items.map(i=>`<div class="fin-fast-search-item" data-id="${esc(i.id)}"><b>${esc(itemName(i))}</b><small>${esc(itemCode(i)||'-')} | المتوفر ${N(i.quantity)}</small></div>`).join('')||'<div class="fin-fast-search-item">لا توجد نتائج</div>';
      menu.classList.add('show');
      menu.querySelectorAll('[data-id]').forEach(el=>{el.onclick=()=>{const id=el.getAttribute('data-id'); const it=itemById(id); select.value=id; input.value=it?productDisplay(it):el.textContent; select.dispatchEvent(new Event('change',{bubbles:true})); if(opts.onSelect)opts.onSelect(id,it); close();};});
    }
    input.addEventListener('input',render); input.addEventListener('focus',render); input.addEventListener('blur',close);
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); const it=findProductByText(input.value); if(it){select.value=it.id; input.value=productDisplay(it); select.dispatchEvent(new Event('change',{bubbles:true})); if(opts.onSelect)opts.onSelect(it.id,it); close();}}});
  }
  function enhanceOperationsTab(){
    const sel=$('finExistingProductV15');
    if(sel) makeSearchableSelect(sel,{placeholder:'اكتب اسم المنتج أو الكود لإضافته للفاتورة',onSelect:id=>{try{if(typeof window.financeProFillExistingProductV15==='function')window.financeProFillExistingProductV15(id);}catch(_){}}});
  }

  // 3) تسريع حفظ فاتورة الإدخال/العمليات بدون reload كامل.
  function findInvoiceItem(line){
    const code=S(line.code), dist=S(line.distributor_code), name=S(line.name).toLowerCase();
    return productItems().find(i=>line.existing_item_id&&String(i.id)===String(line.existing_item_id))||
           productItems().find(i=>code&&[i.product_code,i.serial_number,i.barcode,i.code].map(S).includes(code))||
           productItems().find(i=>dist&&[i.supplier_barcode,i.distributor_code].map(S).includes(dist))||
           productItems().find(i=>S(i.name).toLowerCase()===name)||null;
  }
  function nextInvoiceNo(){
    let max=0;
    A(st().movements).forEach(m=>{const meta=safeJson(m.notes)||{}; const inv=S(meta.invoiceNo||m.reason).match(/INV[-_ ]?(\d+)/i); if(inv)max=Math.max(max,N(inv[1]));});
    return 'INV-'+String(max+1).padStart(6,'0');
  }
  function patchStateItem(row){const state=st(); state.items=A(state.items); const idx=state.items.findIndex(i=>String(i.id)===String(row.id)); if(idx>=0) state.items[idx]={...state.items[idx],...row}; else state.items.push(row);}
  function patchStateMovements(rows){const state=st(); state.movements=A(state.movements); A(rows).forEach(row=>{const idx=state.movements.findIndex(m=>String(m.id)===String(row.id)); if(idx>=0)state.movements[idx]={...state.movements[idx],...row}; else state.movements.push(row);});}
  async function refreshLight(){
    applyCachedImages();
    try{if(typeof window.financeProRenderCurrentV15==='function') window.financeProRenderCurrentV15();}catch(_){ }
    setTimeout(()=>{enhanceFinanceUI(); loadImagesInBackground();},140);
  }
  function patchFastInvoiceSave(){
    if(window.__fastInvoiceSave10177) return; window.__fastInvoiceSave10177=true;
    const old=window.financeProSaveInvoiceV15;
    window.financeProSaveInvoiceV15=async function(btn){
      const state=st(); const started=performance.now();
      try{
        if(btn){btn.disabled=true; btn.dataset.oldText=btn.textContent||''; btn.textContent='جاري الحفظ السريع...';}
        const c=client(); if(!c)throw new Error('الاتصال غير جاهز');
        const lines=A(state.invoiceLines);
        if(!lines.length)throw new Error('أضف منتج واحد على الأقل داخل الفاتورة');
        const supplier=S($('finInvSupplierV15')?.value), invoiceNo=S($('finInvNoV15')?.value)||nextInvoiceNo(), date=S($('finInvDateV15')?.value)||today();
        const movementRows=[];
        for(const l of lines){
          const oldItem=findInvoiceItem(l); let item=oldItem; const q=N(l.qty), cost=unitNetFromLine(l);
          if(q<=0) throw new Error('كمية غير صحيحة للمنتج: '+S(l.name));
          if(oldItem){
            const oldQty=N(oldItem.quantity), oldCost=itemCost(oldItem), newQty=oldQty+q, avg=newQty>0?((oldQty*oldCost)+(q*cost))/newQty:cost;
            const upd={quantity:newQty,unit_cost:+avg.toFixed(4),supplier:supplier||oldItem.supplier,unit:l.unit||oldItem.unit,item_type:l.item_type||oldItem.item_type,type:l.item_type||oldItem.type,product_code:l.code||oldItem.product_code,serial_number:l.code||oldItem.serial_number,barcode:l.code||oldItem.barcode,supplier_barcode:l.distributor_code||oldItem.supplier_barcode,min_quantity:N(l.min_quantity)||N(oldItem.min_quantity)||1};
            if(l.image)upd.image_url=l.image;
            const res=await c.from('inventory_items').update(upd).eq('id',oldItem.id).select(FAST_ITEMS_SELECT);
            if(res.error)throw res.error;
            item=A(res.data)[0]||{...oldItem,...upd}; patchStateItem(item);
          }else{
            const ins={name:l.name,product_code:l.code,serial_number:l.code,barcode:l.code,supplier_barcode:l.distributor_code||l.code,image_url:l.image||'',unit:l.unit||'حبة',item_type:l.item_type||'مادة',type:l.item_type||'مادة',quantity:q,min_quantity:N(l.min_quantity)||1,unit_cost:+cost.toFixed(4),supplier,category:l.item_type||'عام',notes:'تمت الإضافة من فاتورة '+invoiceNo,created_by_name:currentUserName(),updated_by_name:currentUserName(),updated_at:new Date().toISOString()};
            const res=await c.from('inventory_items').insert(ins).select(FAST_ITEMS_SELECT);
            if(res.error)throw res.error;
            item=A(res.data)[0]||ins; patchStateItem(item);
          }
          const rv=rowVat(q,l.price,l.tax_mode);
          const meta={module:VERSION,invoiceNo,supplier,supplierInvoiceNo:S(l.supplier_invoice_no),minQuantity:N(l.min_quantity)||1,taxMode:S(l.tax_mode||'before'),beforeVat:rv.net,vat:rv.vat,afterVat:rv.gross,createdBy:currentUserName(),createdAt:new Date().toISOString()};
          movementRows.push({item_id:item.id,item_name:item.name,movement_type:'in',quantity:q,movement_date:date,receiver:supplier,reason:'إضافة مخزون - فاتورة '+invoiceNo,notes:'finance_pro_v15:'+JSON.stringify(meta),product_code:l.code,barcode:l.distributor_code||l.code,unit_cost:+cost.toFixed(4)});
        }
        const mr=await c.from('inventory_movements').insert(movementRows).select('*');
        if(mr.error)throw mr.error;
        patchStateMovements(A(mr.data).length?A(mr.data):movementRows);
        state.invoiceLines=[];
        await refreshLight();
        msg('تم حفظ الفاتورة بسرعة: '+invoiceNo);
        console.log('Tasneef fast invoice save', Math.round(performance.now()-started)+'ms');
      }catch(e){
        console.warn('fast invoice save failed',e);
        // الرجوع للآلية الأصلية إذا حدث خطأ غير متوقع حفاظًا على استقرار النظام.
        if(old){try{return await old.apply(this,arguments);}catch(err){alert(err.message||String(err));}}
        else alert(e.message||String(e));
      }finally{if(btn){btn.disabled=false; btn.textContent=btn.dataset.oldText||'حفظ الفاتورة';}}
    };
  }

  // 4) حركة متعددة المنتجات في مكان واحد فقط.
  let blocks=[];
  function nextOperationNo(){let max=0; A(st().movements).forEach(m=>{const mt=S((safeJson(m.notes)||{}).operationNo).match(/MOV[-_ ]?(\d+)/i); if(mt)max=Math.max(max,N(mt[1]));}); return 'MOV-'+String(max+1).padStart(6,'0');}
  function newDistRow(){return {qty:0,project_id:'',staff_id:'',center:'FM',type:'out',order_no:'',note:''};}
  function newBlock(){return {id:'b'+Date.now()+Math.floor(Math.random()*9999), item_id:'', item_text:'', qty:0, rows:[newDistRow()]};}
  function ensureInitial(){if(!blocks.length)blocks.push(newBlock());}
  function optionsProjects(selected){return `<option value="">بدون مشروع</option>`+A(st().projects).map(p=>`<option value="${esc(p.id)}" ${String(selected)===String(p.id)?'selected':''}>${esc(p.name||p.project_name||p.id)}</option>`).join('');}
  function optionsStaff(selected){return `<option value="">اختر المشرف</option>`+A(st().users).map(u=>`<option value="${esc(u.id)}" ${String(selected)===String(u.id)?'selected':''}>${esc(u.full_name||u.name||u.username||u.email||u.id)}</option>`).join('');}
  function datalistProducts(id){return `<datalist id="${id}">${productItems().map(i=>`<option value="${esc(productDisplay(i))}"></option>`).join('')}</datalist>`;}
  function distSum(b){return A(b.rows).reduce((a,r)=>a+N(r.qty),0);}
  function netDelta(b){return A(b.rows).reduce((a,r)=>a+N(r.qty)*moveSign(r.type),0);}
  function resolveBlockItem(b){return itemById(b.item_id)||findProductByText(b.item_text);}
  function blockStatus(b){
    const item=resolveBlockItem(b), sum=distSum(b), qty=N(b.qty), delta=netDelta(b), after=item?N(item.quantity)+delta:0;
    if(!item) return {cls:'bad',txt:'اختر المنتج'};
    if(qty<=0) return {cls:'bad',txt:'أدخل الكمية'};
    if(Math.abs(sum-qty)>.001) return {cls:'warn',txt:`التوزيع ${sum} من ${qty}`};
    if(after<0) return {cls:'bad',txt:'الرصيد لا يكفي'};
    return {cls:'ok',txt:'جاهز للحفظ'};
  }
  function syncFromDom(){
    blocks.forEach(b=>{
      const txt=S($(`mb10177_item_${b.id}`)?.value); b.item_text=txt; const it=findProductByText(txt)||itemById(b.item_id); if(it)b.item_id=String(it.id);
      b.qty=N($(`mb10177_qty_${b.id}`)?.value)||0;
      b.rows.forEach((r,idx)=>{r.qty=N($(`mb10177_rqty_${b.id}_${idx}`)?.value)||0; r.project_id=S($(`mb10177_proj_${b.id}_${idx}`)?.value); r.staff_id=S($(`mb10177_staff_${b.id}_${idx}`)?.value); r.center=S($(`mb10177_center_${b.id}_${idx}`)?.value)||'FM'; r.type=S($(`mb10177_type_${b.id}_${idx}`)?.value)||'out'; r.order_no=normalizeOrderNo($(`mb10177_order_${b.id}_${idx}`)?.value); r.note=S($(`mb10177_note_${b.id}_${idx}`)?.value);});
    });
  }
  function renderBlocks(){
    const host=$('finMultiBoxesRows10177'); if(!host)return; ensureInitial();
    host.innerHTML=blocks.map((b,bi)=>{
      const item=resolveBlockItem(b), status=blockStatus(b), after=item?N(item.quantity)+netDelta(b):0, listId='mb10177_list_'+b.id;
      const rows=A(b.rows).map((r,ri)=>`<div class="mb10177-row mb10183-row">
        <div><label>الكمية</label><input type="number" min="0" step="0.01" id="mb10177_rqty_${b.id}_${ri}" value="${N(r.qty)||''}" oninput="financeMultiBoxesSyncNoRender10158()" onchange="financeMultiBoxesSync10177()" onblur="financeMultiBoxesSync10177()"></div>
        <div><label>المشروع</label><select id="mb10177_proj_${b.id}_${ri}" onchange="financeMultiBoxesSync10177()">${optionsProjects(r.project_id)}</select></div>
        <div><label>المشرف</label><select id="mb10177_staff_${b.id}_${ri}" onchange="financeMultiBoxesSync10177()">${optionsStaff(r.staff_id)}</select></div>
        <div><label>مركز التكلفة</label><select id="mb10177_center_${b.id}_${ri}" onchange="financeMultiBoxesSync10177()"><option ${r.center==='FM'?'selected':''}>FM</option><option ${r.center==='CN'?'selected':''}>CN</option><option ${r.center==='GENERAL'?'selected':''}>GENERAL</option></select></div>
        <div><label>الحركة</label><select id="mb10177_type_${b.id}_${ri}" onchange="financeMultiBoxesSync10177()"><option value="out" ${r.type==='out'?'selected':''}>صرف</option><option value="consume" ${r.type==='consume'?'selected':''}>مستهلك</option><option value="return" ${r.type==='return'?'selected':''}>مرتجع</option><option value="damaged" ${r.type==='damaged'?'selected':''}>تالف</option><option value="waste" ${r.type==='waste'?'selected':''}>مهدور</option><option value="scrap" ${r.type==='scrap'?'selected':''}>سكراب</option></select></div>
        <div class="mb10183-order"><label>رقم الأوردر</label><input id="mb10177_order_${b.id}_${ri}" value="${esc(r.order_no||'')}" placeholder="اكتب رقم الأوردر" onblur="financeMultiBoxesConfirmOrder10182(this)" onchange="delete this.dataset.confirmedOrder10182; financeMultiBoxesSync10177()"></div>
        <div class="mb10183-note"><label>ملاحظة</label><input id="mb10177_note_${b.id}_${ri}" value="${esc(r.note||'')}" placeholder="ملاحظة الحركة" oninput="financeMultiBoxesSyncNoRender10158()" onchange="financeMultiBoxesSyncNoRender10158()"></div>
        <button type="button" class="danger" onclick="financeMultiBoxesRemoveDist10177('${b.id}',${ri})">حذف</button>
      </div>`).join('');
      return `<div class="mb10177-box">
        <div class="mb10177-head"><h4>منتج ${bi+1}</h4><span class="mb10177-badge ${status.cls}">${esc(status.txt)}</span></div>
        <div class="mb10177-main">
          <div><label>اسم المنتج</label><input class="fin-fast-search-input" list="${listId}" id="mb10177_item_${b.id}" value="${esc(b.item_text||(item?productDisplay(item):''))}" placeholder="اكتب اسم المنتج أو الكود" oninput="financeMultiBoxesSyncNoRender10158()" onchange="financeMultiBoxesSync10177()" onblur="financeMultiBoxesSync10177()">${datalistProducts(listId)}</div>
          <div><label>كمية المنتج</label><input type="number" min="0" step="0.01" id="mb10177_qty_${b.id}" value="${N(b.qty)||''}" oninput="financeMultiBoxesSyncNoRender10158()" onchange="financeMultiBoxesSync10177()" onblur="financeMultiBoxesSync10177()"></div>
          <div class="mb10177-kpi"><small>المتوفر</small><b>${item?N(item.quantity):'-'}</b></div>
          <div class="mb10177-kpi"><small>بعد الحركة</small><b>${item?N(after):'-'}</b></div>
          <button type="button" class="danger" onclick="financeMultiBoxesRemoveProduct10177('${b.id}')">حذف المنتج</button>
        </div>
        <div class="mb10177-title">توزيع المنتج</div>${rows}
        <button type="button" class="light" onclick="financeMultiBoxesAddDist10177('${b.id}')">+ إضافة توزيع لهذا المنتج</button>
      </div>`;
    }).join('');
  }
  window.financeMultiBoxesSync10177=function(){syncFromDom(); renderBlocks();};
  // v10158: sync without re-render while typing so product name/quantity fields do not lose focus or accept one character only.
  window.financeMultiBoxesSyncNoRender10158=function(){try{syncFromDom();}catch(e){console.warn('multi boxes live sync failed',e);}};
  window.financeMultiBoxesAddProduct10177=function(){syncFromDom(); blocks.push(newBlock()); renderBlocks();};
  window.financeMultiBoxesRemoveProduct10177=function(id){syncFromDom(); blocks=blocks.filter(b=>b.id!==id); ensureInitial(); renderBlocks();};
  window.financeMultiBoxesAddDist10177=function(id){syncFromDom(); const b=blocks.find(x=>x.id===id); if(b)b.rows.push(newDistRow()); renderBlocks();};
  window.financeMultiBoxesRemoveDist10177=function(id,idx){syncFromDom(); const b=blocks.find(x=>x.id===id); if(b){b.rows.splice(idx,1); if(!b.rows.length)b.rows.push(newDistRow());} renderBlocks();};
  window.financeMultiBoxesClear10177=function(){blocks=[newBlock()]; renderBlocks();};
  window.financeMultiBoxesSave10177=async function(btn){
    const started=performance.now();
    try{
      syncFromDom(); const c=client(); if(!c)throw new Error('الاتصال غير جاهز');
      const valid=blocks.filter(b=>resolveBlockItem(b)&&N(b.qty)>0);
      if(!valid.length) throw new Error('أضف منتج واحد على الأقل');
      for(const b of valid){ for(let ri=0; ri<A(b.rows).length; ri++){ const r=A(b.rows)[ri]; if(S(r.order_no)){ const input=$(`mb10177_order_${b.id}_${ri}`); const ok=input ? await confirmOrderForInput10182(input) : true; if(!ok) throw new Error('لم يتم ربط الأوردر: '+r.order_no); } } }
      for(const b of valid){const item=resolveBlockItem(b); b.item_id=String(item.id); if(Math.abs(distSum(b)-N(b.qty))>.001)throw new Error(`مجموع توزيع ${item.name} يجب أن يساوي كمية المنتج`); if(N(item.quantity)+netDelta(b)<0)throw new Error(`الكمية لا تكفي للمنتج: ${item.name}`);}
      if(btn){btn.disabled=true; btn.dataset.oldText=btn.textContent||''; btn.textContent='جاري الحفظ السريع...';}
      const operationNo=nextOperationNo(), user=currentUserName(), now=new Date().toISOString();
      const movementRows=[]; const updates=[]; const orderCostMap=new Map();
      for(const b of valid){
        const item=resolveBlockItem(b); const prodSeq=valid.indexOf(b)+1;
        A(b.rows).filter(r=>N(r.qty)>0).forEach((r,ri)=>{
          const projName=projectName(r.project_id), supervisor=staffName(r.staff_id);
          const ord=normalizeOrderNo(r.order_no), rowNote=S(r.note);
          const dist=[{qty:N(r.qty),projectId:S(r.project_id),projectName:projName,center:S(r.center)||'FM',type:S(r.type)||'out',staffId:S(r.staff_id),staffName:supervisor,orderNo:ord,note:rowNote}];
          const meta={module:VERSION,operationNo,isMultiProductBox:true,productSeq:prodSeq,rowSeq:ri+1,batchCount:valid.length,staffId:S(r.staff_id),note:rowNote,distribution:dist,stockEffect:'normal',createdBy:user,createdAt:now,orderNo:ord};
          const row={item_id:item.id,item_name:item.name,movement_type:S(r.type)||'out',quantity:N(r.qty),movement_date:S($('finMoveDateV15')?.value)||today(),receiver:supervisor,reason:reasonFor(r.type),notes:'finance_pro_v15:'+JSON.stringify(meta),product_code:itemCode(item),barcode:itemDistCode(item)||itemCode(item),unit_cost:+itemCost(item).toFixed(4)};
          movementRows.push(row);
          if(ord && ['out','consume','waste','damaged','scrap'].includes(S(r.type)||'out')) orderCostMap.set(ord, N(orderCostMap.get(ord))+orderCostFromMovementRow10182(row));
        });
        updates.push({item,next:N(item.quantity)+netDelta(b)});
      }
      const safeMovementRows=movementRows.map(r=>{const x={...r}; delete x.order_no; delete x.orderNo; delete x.project_id; delete x.project_name; delete x.distribution_note; return x;});
      const ins=await c.from('inventory_movements').insert(safeMovementRows).select('*'); if(ins.error)throw ins.error;
      const upds=await Promise.all(updates.map(u=>c.from('inventory_items').update({quantity:u.next,updated_by_name:user,updated_at:now}).eq('id',u.item.id).select(FAST_ITEMS_SELECT)));
      const bad=upds.find(r=>r&&r.error); if(bad)throw bad.error;
      upds.forEach((res,idx)=>patchStateItem(A(res.data)[0]||{...updates[idx].item,quantity:updates[idx].next}));
      patchStateMovements(A(ins.data).length?A(ins.data):safeMovementRows);
      await updateOrdersInventoryCost10182(orderCostMap);
      blocks=[newBlock()]; await refreshLight(); msg('تم حفظ الحركة متعددة المنتجات: '+operationNo); console.log('Tasneef multi boxes save', Math.round(performance.now()-started)+'ms');
    }catch(e){alert(e.message||String(e)); msg(e.message||String(e),'err');}
    finally{if(btn){btn.disabled=false; btn.textContent=btn.dataset.oldText||'حفظ الحركة';}}
  };
  function injectUnifiedMovement(){
    try{
      if(S(st().tab)!=='movement')return; const body=$('finBodyV15'); if(!body)return;
      const oldMulti=$('finMultiProductOp10175'); if(oldMulti)oldMulti.style.display='none'; const oldBoxes=$('finMultiBoxes10176'); if(oldBoxes)oldBoxes.style.display='none';
      const cards=[...body.querySelectorAll('.fin-card')]; const oldMovement=cards.find(c=>S(c.textContent).includes('صرف منتج وتوزيع استهلاكه'));
      if(oldMovement)oldMovement.classList.add('mb10177-old-hidden');
      if($('finMultiBoxes10177')){renderBlocks();return;}
      const html=`<div id="finMultiBoxes10177" class="fin-card mb10177-wrap"><h3>حركة متعددة المنتجات</h3><p class="fin-soft">كل منتج له بوكس مستقل وتوزيعه تحته. اكتب اسم المنتج مباشرة بدل البحث الطويل، ثم أضف الكمية والتوزيع، وفي النهاية اضغط <b>حفظ الحركة</b>.</p><div class="mb10177-toolbar"><button type="button" onclick="financeMultiBoxesAddProduct10177()">+ إضافة منتج</button><button type="button" class="light" onclick="financeMultiBoxesSave10177(this)">حفظ الحركة</button><button type="button" class="danger" onclick="financeMultiBoxesClear10177()">تفريغ</button></div><div id="finMultiBoxesRows10177"></div></div>`;
      if(oldMovement) oldMovement.insertAdjacentHTML('beforebegin',html); else body.insertAdjacentHTML('afterbegin',html);
      renderBlocks();
    }catch(e){console.warn('movement unified failed',e);}
  }

  function enhanceFinanceUI(){ensureStyle(); enhanceOperationsTab(); injectUnifiedMovement(); document.querySelectorAll('#finProductListV15 img').forEach(img=>{img.loading='lazy'; img.decoding='async'; img.fetchPriority='low';});}
  function patchHooks(){
    if(window.__financeHooks10177)return; window.__financeHooks10177=true;
    const oldTab=window.financeProTabV15; if(typeof oldTab==='function')window.financeProTabV15=function(tab){const r=oldTab.apply(this,arguments); setTimeout(enhanceFinanceUI,90); if(tab==='products'||tab==='add'||tab==='movement')setTimeout(loadImagesInBackground,500); return r;};
    const oldLoad=window.financeProLoadV15; if(typeof oldLoad==='function')window.financeProLoadV15=async function(force){patchSupabaseFastItems(); const r=await oldLoad.apply(this,arguments); applyCachedImages(); setTimeout(enhanceFinanceUI,90); setTimeout(loadImagesInBackground,500); return r;};
    const oldRender=window.financeProRenderCurrentV15; if(typeof oldRender==='function')window.financeProRenderCurrentV15=function(){const r=oldRender.apply(this,arguments); setTimeout(enhanceFinanceUI,90); return r;};
  }
  function boot(){patchSupabaseFastItems(); patchFastInvoiceSave(); patchHooks(); applyCachedImages(); setTimeout(enhanceFinanceUI,200); setTimeout(loadImagesInBackground,1200);}
  let tries=0; const timer=setInterval(()=>{tries++; if(window.financeProStateV15||tries>80){clearInterval(timer); boot();}},120);
  window.addEventListener('load',()=>setTimeout(boot,700));
})();

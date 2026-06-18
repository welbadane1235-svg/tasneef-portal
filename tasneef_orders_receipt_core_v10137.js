/* Tasneef v10137 - Orders receipt from original order field
   Scope: ORDERS ONLY
   - Uses the original "الإيصال" field in the order form; no duplicate receipt box.
   - Adds an "الإيصال" view button beside the original field and on order cards.
   - Saves receipt data inside the same orders_shared record.
   - Adds a safe direct-save fallback when the old orders source is locked by Supabase.
*/
(function(){
  'use strict';
  if(window.__tasneefOrdersReceiptCoreV10137) return;
  window.__tasneefOrdersReceiptCoreV10137 = true;

  const VERSION='orders_receipt_v10137';
  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const TABLE='orders_shared';
  const RECEIPT_FIELD='الإيصال';
  const RECEIPT_META_FIELD='بيانات الإيصال';
  const HEADERS=['رقم الطلب','رقم الطلب بالجروب','تاريخ الطلب','وقت الطلب','مرسل الطلب','المشروع','نوع العقار','رقم الشقة','اسم العميل','رقم العميل','المنفذ','التفاصيل','ملاحظات','تخص','تاريخ التنفيذ','كيفية التنفيذ','حالة التنفيذ','تقرير','السعر (شامل الضريبة)','الضريبة 15%','السعر قبل الضريبة','التكلفة','تكلفة المخزن','الربح','حالة السداد','الإيصال','رقم الفاتورة','فوترة بالسيستم'];
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const nowIso=()=>new Date().toISOString();
  const today=()=>new Date().toISOString().slice(0,10);
  const hm=()=>{const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
  const normalizeNo=v=>S(v).replace(/\s+/g,'').toUpperCase();
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const say=(text,type)=>{try{ if(typeof window.msg==='function') window.msg(text,type); else console.log(text); }catch(_){ console.log(text); }};
  function $(id){return document.getElementById(id)}
  function fieldId(header){try{return 'orderFieldV233_'+btoa(unescape(encodeURIComponent(header))).replace(/=+$/,'').replace(/[^a-zA-Z0-9]/g,'_');}catch(_){return 'orderFieldV233_'+header.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g,'_');}}
  function labelText(el){return S(el&&el.textContent).replace(/\s+/g,' ')}
  function findFieldByLabel(label){
    const labs=[...document.querySelectorAll('label')];
    const lab=labs.find(x=>labelText(x)===label);
    if(!lab) return null;
    const box=lab.parentElement||lab.closest('div');
    return box ? box.querySelector('input,select,textarea') : null;
  }
  function getField(header){
    if(header==='رقم الطلب') return $('orderNoV233');
    if(header==='رقم الطلب بالجروب') return $('orderGroupNoV233');
    return $(fieldId(header)) || findFieldByLabel(header);
  }
  async function api(path, options){
    return fetch(SUPABASE_URL+path,Object.assign({
      cache:'no-store',
      headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY,Accept:'application/json','Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'}
    }, options||{}));
  }
  async function fetchOrder(orderNo){
    const no=normalizeNo(orderNo); if(!no) return null;
    const res=await api('/rest/v1/'+TABLE+'?select=order_no,data,flow,updated_at&order_no=eq.'+encodeURIComponent(no)+'&limit=1',{method:'GET'});
    if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
    const arr=await res.json(); return arr&&arr[0]?arr[0]:null;
  }
  async function fetchRecentOrders(limit=5000){
    const res=await api('/rest/v1/'+TABLE+'?select=order_no,data,flow,updated_at&order=updated_at.desc&limit='+limit,{method:'GET'});
    if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
    return A(await res.json());
  }
  async function saveOrderRecord(orderNo,data,flow){
    const no=normalizeNo(orderNo); if(!no) throw new Error('رقم الأوردر غير موجود');
    const payload={order_no:no,data:data||{},flow:flow||{},updated_at:nowIso(),updated_by:VERSION};
    const res=await api('/rest/v1/'+TABLE+'?on_conflict=order_no',{method:'POST',body:JSON.stringify(payload)});
    if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
    const arr=await res.json().catch(()=>[]); return arr&&arr[0]?arr[0]:null;
  }
  function extractOrderNumber(v){ const m=normalizeNo(v).match(/(\d+)/g); return m&&m.length?Number(m[m.length-1])||0:0; }
  async function nextOrderNo(){
    try{ const rows=await fetchRecentOrders(5000); let max=0; rows.forEach(r=>{max=Math.max(max,extractOrderNumber(r.order_no||r.data?.['رقم الطلب']));}); return 'ORD'+(max+1); }
    catch(_){ return 'ORD'+Date.now().toString().slice(-6); }
  }

  let pendingReceipt=null;
  function fileToDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(r.error||new Error('تعذر قراءة الملف'));r.onload=()=>resolve(String(r.result||''));r.readAsDataURL(file);});}
  function compressImage(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(r.error||new Error('تعذر قراءة الصورة'));r.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('صيغة الصورة غير مدعومة'));img.onload=()=>{const max=1400;const ratio=Math.min(1,max/Math.max(img.width,img.height));const w=Math.max(1,Math.round(img.width*ratio));const h=Math.max(1,Math.round(img.height*ratio));const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);resolve(canvas.toDataURL('image/jpeg',0.78));};img.src=String(r.result||'');};r.readAsDataURL(file);});}
  async function prepareReceiptFile(file){
    if(!file) return null;
    const isImage=/^image\//i.test(file.type||'');
    const isPdf=(file.type==='application/pdf'||/\.pdf$/i.test(file.name||''));
    if(!isImage&&!isPdf) throw new Error('المسموح في الإيصال: صورة أو PDF فقط');
    const maxBytes=isPdf?2.5*1024*1024:6*1024*1024;
    if((file.size||0)>maxBytes) throw new Error('حجم الإيصال كبير. ارفع صورة واضحة أو PDF أقل من 2.5MB');
    const url=isImage?await compressImage(file):await fileToDataUrl(file);
    return {url,name:file.name||'receipt',type:isImage?'image/jpeg':(file.type||'application/pdf'),size:file.size||0,attached_at:nowIso(),source:VERSION};
  }
  function receiptFromData(data){ data=data||{}; return data[RECEIPT_META_FIELD] || (data[RECEIPT_FIELD]?{url:data[RECEIPT_FIELD],name:'إيصال'}:null); }
  function currentOrderNo(){return normalizeNo(S($('orderNoV233')?.value));}
  async function loadCurrentReceipt(){ const no=currentOrderNo(); if(!no) return pendingReceipt; try{const rec=await fetchOrder(no); return receiptFromData(rec?.data||{})||pendingReceipt;}catch(_){return pendingReceipt;} }
  function openReceipt(receipt){
    const url=receipt?.url||''; if(!url){alert('لا يوجد إيصال مرفق لهذا الأوردر');return;}
    const w=window.open('', '_blank', 'width=1000,height=800'); if(!w){window.open(url,'_blank');return;}
    const isPdf=/application\/pdf|\.pdf/i.test(receipt.type||receipt.name||url.slice(0,80));
    const body=isPdf?`<iframe src="${esc(url)}" style="width:100%;height:100vh;border:0"></iframe>`:`<img src="${esc(url)}" style="max-width:100%;height:auto;display:block;margin:auto">`;
    w.document.open();
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(receipt.name||'الإيصال')}</title><style>body{margin:0;background:#f3f6f5;font-family:Tahoma,Arial,sans-serif}.bar{padding:12px 16px;background:#0A4033;color:#fff;font-weight:900}.content{padding:14px;text-align:center}</style></head><body><div class="bar">${esc(receipt.name||'الإيصال')}</div><div class="content">${body}</div></body></html>`);
    w.document.close(); w.focus();
  }
  window.openCurrentOrderReceiptV10137=async function(){openReceipt(await loadCurrentReceipt());};
  window.openOrderReceiptV10137=function(orderNo){fetchOrder(orderNo).then(rec=>openReceipt(receiptFromData(rec?.data||{}))).catch(()=>alert('تعذر فتح الإيصال الآن'));};

  function syncReceiptUi(receipt){
    const inp=getField(RECEIPT_FIELD); const btn=$('orderReceiptBtnV10137'); const hint=$('orderReceiptHintV10137');
    const has=!!((pendingReceipt&&pendingReceipt.url)||(receipt&&receipt.url));
    if(btn){btn.disabled=!has;btn.textContent='عرض الإيصال';btn.title=has?'عرض الإيصال':'لا يوجد إيصال مرفق';}
    if(hint){hint.textContent=pendingReceipt?('جاهز للحفظ: '+(pendingReceipt.name||'إيصال')):(receipt&&receipt.url?('مرفق: '+(receipt.name||'إيصال')):'اختياري');}
    if(inp&&pendingReceipt){inp.dataset.receiptReady='1';}
  }
  function enhanceOriginalReceiptField(){
    const inp=getField(RECEIPT_FIELD); if(!inp) return;
    const box=inp.parentElement||inp.closest('div'); if(!box) return;
    if(inp.type!=='file'){
      try{ inp.type='file'; inp.accept='image/*,application/pdf'; }catch(_){ }
    }else{ inp.accept='image/*,application/pdf'; }
    if(!box.querySelector('#orderReceiptBtnV10137')){
      const row=document.createElement('div'); row.className='order-receipt-inline-v10137';
      inp.insertAdjacentElement('beforebegin',row); row.appendChild(inp);
      const btn=document.createElement('button'); btn.type='button'; btn.className='light'; btn.id='orderReceiptBtnV10137'; btn.textContent='عرض الإيصال'; btn.onclick=ev=>{ev.preventDefault(); window.openCurrentOrderReceiptV10137();};
      row.appendChild(btn);
      const hint=document.createElement('small'); hint.id='orderReceiptHintV10137'; hint.textContent='اختياري'; box.appendChild(hint);
    }
    if(!inp.__receiptV10137){
      inp.__receiptV10137=1;
      inp.addEventListener('change',async()=>{
        const file=inp.files&&inp.files[0];
        if(!file){pendingReceipt=null;syncReceiptUi(null);return;}
        try{ pendingReceipt=await prepareReceiptFile(file); syncReceiptUi(pendingReceipt); say('تم تجهيز الإيصال، اضغط حفظ الأوردر ليتم حفظه','ok'); }
        catch(e){ pendingReceipt=null; inp.value=''; syncReceiptUi(null); alert(e.message||e); }
      });
    }
    loadCurrentReceipt().then(syncReceiptUi).catch(()=>syncReceiptUi(null));
  }

  function readFormData(){
    const data={};
    HEADERS.forEach(h=>{
      let val='';
      if(h==='رقم الطلب') val=currentOrderNo();
      else if(h==='رقم الطلب بالجروب') val=S($('orderGroupNoV233')?.value);
      else if(h===RECEIPT_FIELD){ val=pendingReceipt?.url||''; }
      else {
        const el=getField(h);
        if(el){
          if(el.type==='checkbox') val=el.checked?'نعم':'لا';
          else if(el.type==='file') val='';
          else val=S(el.value);
        }
      }
      if(val!=='' || h===RECEIPT_FIELD) data[h]=val;
    });
    if(!data['تاريخ الطلب']) data['تاريخ الطلب']=today();
    if(!data['وقت الطلب']) data['وقت الطلب']=hm();
    if(pendingReceipt){ data[RECEIPT_FIELD]=pendingReceipt.url; data[RECEIPT_META_FIELD]=pendingReceipt; data.__receipt_attached=true; data.__receipt_updated_at=nowIso(); }
    data.__tasneef_updated_at=nowIso();
    return data;
  }
  async function directSaveOrderFromForm(){
    let no=currentOrderNo();
    if(!no){ no=await nextOrderNo(); const noEl=$('orderNoV233'); if(noEl) noEl.value=no; }
    let flow={}; let oldData={};
    try{ const rec=await fetchOrder(no); flow=rec?.flow||{}; oldData=rec?.data||{}; }catch(_){ }
    const data=Object.assign({},oldData,readFormData(),{'رقم الطلب':no,order_no:no,orderNo:no});
    if(!pendingReceipt && oldData){ const oldReceipt=receiptFromData(oldData); if(oldReceipt){ data[RECEIPT_FIELD]=oldReceipt.url; data[RECEIPT_META_FIELD]=oldReceipt; } }
    await saveOrderRecord(no,data,flow);
    if(pendingReceipt){ pendingReceipt=null; const inp=getField(RECEIPT_FIELD); if(inp) inp.value=''; }
    syncReceiptUi(receiptFromData(data));
    try{ if(typeof window.renderOrdersV233==='function') window.renderOrdersV233(); }catch(_){ }
    say('تم حفظ الأوردر '+no,'ok');
    return true;
  }
  async function attachPendingReceiptOnly(orderNo){
    const no=normalizeNo(orderNo); if(!no||!pendingReceipt) return;
    const rec=await fetchOrder(no); if(!rec) return;
    const data=Object.assign({},rec.data||{});
    data[RECEIPT_FIELD]=pendingReceipt.url; data[RECEIPT_META_FIELD]=pendingReceipt; data.__receipt_attached=true; data.__receipt_updated_at=nowIso(); data.__tasneef_updated_at=nowIso();
    await saveOrderRecord(no,data,rec.flow||{});
    pendingReceipt=null; const inp=getField(RECEIPT_FIELD); if(inp) inp.value=''; syncReceiptUi(receiptFromData(data));
    say('تم حفظ الإيصال داخل الأوردر '+no,'ok');
  }
  function isOldSourceLockError(e){ const t=S(e&& (e.message||e)); return /Orders locked|write rejected from old source|P0001|old source/i.test(t); }
  function patchSaveEditClear(){
    // لا نستدعي دالة الحفظ القديمة نهائياً لأنها أصبحت مقفلة من Supabase وتظهر تنبيه Orders locked.
    // الحفظ هنا خاص بالأوردرات فقط وبنفس جدول orders_shared.
    if(typeof window.saveOrderV233==='function' && !window.saveOrderV233.__receiptV10137_direct){
      window.__tasneefOldSaveOrderV233Locked = window.saveOrderV233;
    }
    window.saveOrderV233 = async function(){
      enhanceOriginalReceiptField();
      try{
        const ok = await directSaveOrderFromForm();
        setTimeout(()=>{try{ if(typeof window.renderOrdersV233==='function') window.renderOrdersV233(); }catch(_){ }},250);
        setTimeout(injectReceiptButtonsInCards,700);
        return ok;
      }catch(e){
        console.error(VERSION,'direct order save failed',e);
        alert('لم يتم حفظ الأوردر: '+(e && (e.message||e)));
        throw e;
      }
    };
    window.saveOrderV233.__receiptV10137_direct=true;

    if(typeof window.editOrderV233==='function' && !window.editOrderV233.__receiptV10137){
      const oldEdit=window.editOrderV233;
      window.editOrderV233=function(){ const r=oldEdit.apply(this,arguments); pendingReceipt=null; setTimeout(enhanceOriginalReceiptField,250); setTimeout(injectReceiptButtonsInCards,500); return r; };
      window.editOrderV233.__receiptV10137=true;
    }
    if(typeof window.clearOrderFormV233==='function' && !window.clearOrderFormV233.__receiptV10137){
      const oldClear=window.clearOrderFormV233;
      window.clearOrderFormV233=function(){ const r=oldClear.apply(this,arguments); pendingReceipt=null; setTimeout(()=>{const inp=getField(RECEIPT_FIELD); if(inp) inp.value=''; syncReceiptUi(null); enhanceOriginalReceiptField();},80); return r; };
      window.clearOrderFormV233.__receiptV10137=true;
    }
  }
  function orderNoFromElement(el){const txt=S(el.textContent);const m=txt.match(/\b(ORD\d{1,})\b/i)||txt.match(/\b([A-Z]{0,5}\d{2,})\b/i);return m?normalizeNo(m[1]):'';}
  let receiptInjectBusy=false;
  function findCardActions(node){
    return node.querySelector('.row-actions,.actions,.order-actions,.card-actions') || [...node.querySelectorAll('button')].slice(-1)[0]?.parentElement || node;
  }
  async function injectReceiptButtonsInCards(){
    if(receiptInjectBusy) return;
    receiptInjectBusy=true;
    try{
      const box=$('ordersCardsV360')||$('ordersBody'); if(!box) return;
      let records=[]; try{records=await fetchRecentOrders(5000);}catch(_){records=[];}
      const receiptMap=new Map();
      records.forEach(rec=>{const d=rec.data||{};const no=normalizeNo(rec.order_no||d['رقم الطلب']); if(no&&receiptFromData(d)?.url) receiptMap.set(no,true);});
      [...box.children].filter(n=>n&&n.nodeType===1).forEach(node=>{
        let no=orderNoFromElement(node);
        if(!no){for(const key of receiptMap.keys()){if(S(node.textContent).replace(/\s+/g,'').toUpperCase().includes(key)){no=key;break;}}}
        if(!no) return;
        let btn=node.querySelector('[data-v10137-receipt-btn]');
        if(!btn){
          const actions=findCardActions(node);
          btn=document.createElement('button'); btn.type='button'; btn.className='light'; btn.dataset.v10137ReceiptBtn='1'; btn.textContent='عرض الإيصال'; btn.style.marginInlineStart='6px';
          btn.onclick=ev=>{ev.preventDefault();ev.stopPropagation();window.openOrderReceiptV10137(no);};
          actions.appendChild(btn);
        }
        btn.disabled=!receiptMap.has(no);
        btn.title=receiptMap.has(no)?'عرض الإيصال':'لا يوجد إيصال مرفق';
      });
    }finally{ receiptInjectBusy=false; }
  }
  function patchRender(){
    if(typeof window.renderOrdersV233==='function'&&!window.renderOrdersV233.__receiptV10137){
      const old=window.renderOrdersV233;
      window.renderOrdersV233=function(){const r=old.apply(this,arguments); setTimeout(injectReceiptButtonsInCards,250); setTimeout(injectReceiptButtonsInCards,900); return r;};
      window.renderOrdersV233.__receiptV10137=true;
    }
  }
  let obs=null;
  function watchOrdersList(){
    const box=$('ordersCardsV360')||$('ordersBody'); if(!box || box.__receiptObserverV10137) return;
    box.__receiptObserverV10137=true;
    obs=new MutationObserver(()=>{ clearTimeout(window.__receiptInjectTimerV10137); window.__receiptInjectTimerV10137=setTimeout(injectReceiptButtonsInCards,250); });
    obs.observe(box,{childList:true,subtree:true});
  }
  function injectStyle(){ if($('ordersReceiptStyleV10137')) return; const st=document.createElement('style'); st.id='ordersReceiptStyleV10137'; st.textContent='.order-receipt-inline-v10137{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center}.order-receipt-inline-v10137 button:disabled,[data-v10137-receipt-btn]:disabled{opacity:.55;cursor:not-allowed;background:#eef6f3!important;color:#60706a!important}#orderReceiptHintV10137{display:block;color:#60706a;margin-top:4px}@media(max-width:760px){.order-receipt-inline-v10137{grid-template-columns:1fr}}'; document.head.appendChild(st); }
  function boot(){ try{injectStyle(); enhanceOriginalReceiptField(); patchSaveEditClear(); patchRender(); watchOrdersList(); setTimeout(injectReceiptButtonsInCards,400); setTimeout(injectReceiptButtonsInCards,1200);}catch(e){console.warn(VERSION,e);} }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else setTimeout(boot,0);
  window.addEventListener('load',()=>setTimeout(boot,700),{once:true});
  const t=setInterval(()=>{boot();},1000);
  setTimeout(()=>clearInterval(t),20000);
  console.log('Loaded '+VERSION);
})();

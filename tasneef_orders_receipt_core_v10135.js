/* Tasneef v10135 - Orders Receipt Core
   Scope: ORDERS ONLY
   - Adds a real receipt attachment field to the order form.
   - Stores the receipt inside the same order data record in Supabase orders_shared.
   - Adds an "الإيصال" button on the form and order cards without changing tickets, finance, inventory, contracts, permissions, or monthly time sections.
*/
(function(){
  'use strict';
  if(window.__tasneefOrdersReceiptCoreV10135) return;
  window.__tasneefOrdersReceiptCoreV10135 = true;

  const VERSION='v10135-orders-receipt-core';
  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const TABLE='orders_shared';
  const RECEIPT_FIELD='الإيصال';
  const RECEIPT_META_FIELD='بيانات الإيصال';
  const STORE_KEY='tasneef_orders_v233';

  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const $=id=>document.getElementById(id);
  const nowIso=()=>new Date().toISOString();
  const normalizeNo=v=>S(v).replace(/\s+/g,'').toUpperCase();
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const say=(text,type)=>{try{ if(typeof window.msg==='function') window.msg(text,type); else console.log(text); }catch(_){ console.log(text); }};

  let pendingReceipt=null;
  let pendingObjectUrl='';

  async function api(path, options){
    return fetch(SUPABASE_URL+path, Object.assign({
      cache:'no-store',
      headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY,Accept:'application/json','Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'}
    }, options||{}));
  }
  async function fetchOrder(orderNo){
    const no=normalizeNo(orderNo); if(!no) return null;
    const res=await api('/rest/v1/'+TABLE+'?select=order_no,data,flow,updated_at&order_no=eq.'+encodeURIComponent(no)+'&limit=1',{method:'GET'});
    if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
    const arr=await res.json();
    return arr&&arr[0]?arr[0]:null;
  }
  async function saveOrderRecord(orderNo, data, flow){
    const no=normalizeNo(orderNo); if(!no) throw new Error('رقم الأوردر غير موجود لحفظ الإيصال');
    const payload={order_no:no,data:data||{},flow:flow||{},updated_at:nowIso(),updated_by:VERSION};
    const res=await api('/rest/v1/'+TABLE+'?on_conflict=order_no',{method:'POST',body:JSON.stringify(payload)});
    if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
    return (await res.json())[0];
  }
  async function fetchRecentOrders(){
    const res=await api('/rest/v1/'+TABLE+'?select=order_no,data,flow,updated_at&order=updated_at.desc&limit=500',{method:'GET'});
    if(!res.ok) return [];
    return A(await res.json());
  }
  function readLocalOrders(){try{return A(JSON.parse(localStorage.getItem(STORE_KEY)||'[]'));}catch(_){return []}}
  function writeLocalReceipt(orderNo, receipt){
    try{
      const no=normalizeNo(orderNo); if(!no) return;
      const rows=readLocalOrders(); let changed=false;
      rows.forEach(r=>{ if(normalizeNo(r&&r['رقم الطلب'])===no){ r[RECEIPT_FIELD]=receipt?.url||''; r[RECEIPT_META_FIELD]=receipt||{}; changed=true; }});
      if(changed) localStorage.setItem(STORE_KEY, JSON.stringify(rows));
    }catch(_){/* مصدر الأوردرات الرسمي Supabase، لذلك لا نوقف العملية بسبب الكاش المحلي */}
  }

  function fileToDataUrl(file){
    return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(String(r.result||'')); r.onerror=()=>reject(r.error||new Error('تعذر قراءة الملف')); r.readAsDataURL(file); });
  }
  function compressImage(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=()=>reject(reader.error||new Error('تعذر قراءة الصورة'));
      reader.onload=()=>{
        const img=new Image();
        img.onerror=()=>reject(new Error('صيغة الصورة غير مدعومة'));
        img.onload=()=>{
          const max=1400;
          const ratio=Math.min(1,max/Math.max(img.width,img.height));
          const w=Math.max(1,Math.round(img.width*ratio));
          const h=Math.max(1,Math.round(img.height*ratio));
          const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
          const ctx=canvas.getContext('2d'); ctx.drawImage(img,0,0,w,h);
          resolve(canvas.toDataURL('image/jpeg',0.78));
        };
        img.src=String(reader.result||'');
      };
      reader.readAsDataURL(file);
    });
  }
  async function prepareReceiptFile(file){
    if(!file) return null;
    const isImage=/^image\//i.test(file.type||'');
    const isPdf=(file.type==='application/pdf' || /\.pdf$/i.test(file.name||''));
    if(!isImage && !isPdf) throw new Error('المسموح: صورة أو PDF فقط');
    const maxBytes=isPdf ? 2.5*1024*1024 : 6*1024*1024;
    if(file.size>maxBytes) throw new Error('حجم الإيصال كبير. استخدم صورة واضحة أو PDF أقل من 2.5MB');
    const url=isImage ? await compressImage(file) : await fileToDataUrl(file);
    return {url, name:file.name||'receipt', type:isImage?'image/jpeg':(file.type||'application/pdf'), size:file.size||0, attached_at:nowIso(), source:VERSION};
  }
  function setReceiptUi(receipt){
    const name=$('orderReceiptNameV10135');
    const btn=$('orderReceiptButtonV10135');
    const has=!!(receipt&&receipt.url);
    if(name) name.textContent=has ? ('مرفق: '+(receipt.name||'إيصال')) : 'لم يتم إرفاق إيصال';
    if(btn){ btn.disabled=!has && !pendingReceipt; btn.textContent=has||pendingReceipt?'الإيصال':'لا يوجد إيصال'; }
  }
  function currentOrderNo(){ return normalizeNo(($('orderNoV233')&&$('orderNoV233').value)||''); }
  async function loadCurrentReceiptFromServer(){
    const no=currentOrderNo(); if(!no){ setReceiptUi(pendingReceipt); return null; }
    try{ const rec=await fetchOrder(no); const data=rec?.data||{}; const receipt=data[RECEIPT_META_FIELD] || (data[RECEIPT_FIELD]?{url:data[RECEIPT_FIELD],name:'إيصال'}:null); setReceiptUi(receipt); return receipt; }
    catch(e){ console.warn(VERSION,e); return null; }
  }
  function openReceipt(receipt){
    const url=receipt?.url||'';
    if(!url){ alert('لا يوجد إيصال مرفق لهذا الأوردر'); return; }
    const w=window.open('', '_blank', 'width=1000,height=800');
    if(!w){ window.open(url,'_blank'); return; }
    const isPdf=/application\/pdf|\.pdf/i.test(receipt.type||receipt.name||url.slice(0,80));
    const body=isPdf ? `<iframe src="${esc(url)}" style="width:100%;height:100vh;border:0"></iframe>` : `<img src="${esc(url)}" style="max-width:100%;height:auto;display:block;margin:auto">`;
    w.document.open();
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(receipt.name||'الإيصال')}</title><style>body{margin:0;background:#f3f6f5;font-family:Tahoma,Arial,sans-serif}.bar{padding:12px 16px;background:#0A4033;color:#fff;font-weight:900}.content{padding:14px;text-align:center}</style></head><body><div class="bar">${esc(receipt.name||'الإيصال')}</div><div class="content">${body}</div></body></html>`);
    w.document.close(); w.focus();
  }
  window.openCurrentOrderReceiptV10135=async function(){
    if(pendingReceipt){ openReceipt(pendingReceipt); return; }
    const receipt=await loadCurrentReceiptFromServer(); openReceipt(receipt);
  };
  window.openOrderReceiptV10135=function(orderNo){
    const no=normalizeNo(orderNo);
    fetchOrder(no).then(rec=>{
      const d=rec?.data||{};
      const receipt=d[RECEIPT_META_FIELD] || (d[RECEIPT_FIELD]?{url:d[RECEIPT_FIELD],name:'إيصال'}:null);
      openReceipt(receipt);
    }).catch(()=>alert('تعذر فتح الإيصال الآن'));
  };

  function bindFileInput(){
    const inp=$('orderReceiptFileV10135'); if(!inp || inp.__v10135) return;
    inp.__v10135=1;
    inp.addEventListener('change', async ()=>{
      const file=inp.files&&inp.files[0];
      if(!file){ pendingReceipt=null; setReceiptUi(null); return; }
      try{
        pendingReceipt=await prepareReceiptFile(file);
        setReceiptUi(pendingReceipt);
        say('تم تجهيز الإيصال، اضغط حفظ الأوردر ليتم حفظه','ok');
      }catch(e){
        pendingReceipt=null; inp.value=''; setReceiptUi(null); alert(e.message||e);
      }
    });
  }
  async function attachPendingReceiptToOrder(orderNo){
    const no=normalizeNo(orderNo); if(!no || !pendingReceipt) return;
    const rec=await fetchOrder(no);
    if(!rec) throw new Error('تم حفظ الأوردر لكن لم يتم العثور عليه لإرفاق الإيصال');
    const data=Object.assign({},rec.data||{});
    data[RECEIPT_FIELD]=pendingReceipt.url;
    data[RECEIPT_META_FIELD]=pendingReceipt;
    data.__receipt_attached=true;
    data.__receipt_updated_at=nowIso();
    await saveOrderRecord(no,data,rec.flow||{});
    writeLocalReceipt(no,pendingReceipt);
    pendingReceipt=null;
    const inp=$('orderReceiptFileV10135'); if(inp) inp.value='';
    setReceiptUi(data[RECEIPT_META_FIELD]);
    say('تم حفظ الإيصال داخل الأوردر '+no,'ok');
  }
  function patchSaveEditClear(){
    if(typeof window.saveOrderV233==='function' && !window.saveOrderV233.__receiptV10135){
      const old=window.saveOrderV233;
      window.saveOrderV233=async function(){
        const noBefore=currentOrderNo();
        const result=await old.apply(this,arguments);
        const noAfter=currentOrderNo() || noBefore;
        try{ await attachPendingReceiptToOrder(noAfter); }
        catch(e){ console.error(VERSION,e); alert('تم حفظ الأوردر، لكن لم يتم حفظ الإيصال: '+(e.message||e)); }
        setTimeout(()=>{try{ if(typeof window.renderOrdersV233==='function') window.renderOrdersV233(); }catch(_){}} ,250);
        return result;
      };
      window.saveOrderV233.__receiptV10135=true;
    }
    if(typeof window.editOrderV233==='function' && !window.editOrderV233.__receiptV10135){
      const oldEdit=window.editOrderV233;
      window.editOrderV233=function(){ const r=oldEdit.apply(this,arguments); pendingReceipt=null; setTimeout(loadCurrentReceiptFromServer,250); return r; };
      window.editOrderV233.__receiptV10135=true;
    }
    if(typeof window.clearOrderFormV233==='function' && !window.clearOrderFormV233.__receiptV10135){
      const oldClear=window.clearOrderFormV233;
      window.clearOrderFormV233=function(){ const r=oldClear.apply(this,arguments); pendingReceipt=null; const inp=$('orderReceiptFileV10135'); if(inp) inp.value=''; setReceiptUi(null); return r; };
      window.clearOrderFormV233.__receiptV10135=true;
    }
  }
  function orderNoFromElement(el){
    const txt=S(el.textContent);
    const m=txt.match(/(?:ORD|ORDER|OR|طلب|رقم الطلب|النظام)\s*[:#\-]?\s*([A-Z]*\d{1,})/i) || txt.match(/\b([A-Z]{0,5}\d{2,})\b/i);
    return m?normalizeNo(m[1]):'';
  }
  async function injectReceiptButtonsInCards(){
    const box=$('ordersCardsV360') || $('ordersBody'); if(!box) return;
    const records=await fetchRecentOrders();
    const receiptMap=new Map();
    records.forEach(rec=>{ const d=rec.data||{}; const no=normalizeNo(rec.order_no||d['رقم الطلب']); if(no && (d[RECEIPT_FIELD] || d[RECEIPT_META_FIELD]?.url)) receiptMap.set(no,true); });
    const nodes=[...box.children].filter(n=>n&&n.nodeType===1);
    nodes.forEach(node=>{
      if(node.querySelector('[data-v10135-receipt-btn]')) return;
      let no=orderNoFromElement(node);
      if(!no){
        for(const key of receiptMap.keys()){ if(S(node.textContent).replace(/\s+/g,'').toUpperCase().includes(key)){ no=key; break; } }
      }
      if(!no) return;
      const actions=node.querySelector('.row-actions,.actions,.order-actions,.card-actions') || node;
      const btn=document.createElement('button');
      btn.type='button'; btn.className='light'; btn.dataset.v10135ReceiptBtn='1'; btn.textContent='الإيصال';
      btn.style.marginInlineStart='6px';
      btn.disabled=!receiptMap.has(no);
      btn.title=receiptMap.has(no)?'عرض الإيصال':'لا يوجد إيصال مرفق';
      btn.onclick=(ev)=>{ev.preventDefault(); ev.stopPropagation(); window.openOrderReceiptV10135(no);};
      actions.appendChild(btn);
    });
  }
  function patchRender(){
    if(typeof window.renderOrdersV233==='function' && !window.renderOrdersV233.__receiptV10135){
      const old=window.renderOrdersV233;
      window.renderOrdersV233=function(){ const r=old.apply(this,arguments); setTimeout(injectReceiptButtonsInCards,450); return r; };
      window.renderOrdersV233.__receiptV10135=true;
    }
  }
  function injectStyle(){
    if($('ordersReceiptStyleV10135')) return;
    const st=document.createElement('style'); st.id='ordersReceiptStyleV10135';
    st.textContent=`.order-receipt-box-v10135{border:1px dashed #b9d4cb;background:#f8fbfa;border-radius:16px;padding:12px;margin:10px 0}.order-receipt-row-v10135{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center}.order-receipt-box-v10135 small{display:block;color:#60706a;margin-top:6px}.order-receipt-box-v10135 button:disabled,[data-v10135-receipt-btn]:disabled{opacity:.55;cursor:not-allowed;background:#eef6f3!important;color:#60706a!important}@media(max-width:760px){.order-receipt-row-v10135{grid-template-columns:1fr}}`;
    document.head.appendChild(st);
  }
  function boot(){
    try{ injectStyle(); bindFileInput(); patchSaveEditClear(); patchRender(); setReceiptUi(null); setTimeout(injectReceiptButtonsInCards,1000); }
    catch(e){ console.warn(VERSION,e); }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else setTimeout(boot,0);
  window.addEventListener('load',()=>setTimeout(boot,700),{once:true});
  const t=setInterval(()=>{ boot(); if(typeof window.saveOrderV233==='function' && typeof window.renderOrdersV233==='function') clearInterval(t); },1000);
  setTimeout(()=>clearInterval(t),20000);
  console.log('Loaded '+VERSION);
})();

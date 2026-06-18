/* Tasneef v10109 - Orders Online Supabase No LocalStorage Quota Fix
   Scope: ORDERS ONLY
   - يجعل الأوردرات أونلاين عبر Supabase ولا يعتمد على localStorage الكبير.
   - يهاجر أي أوردرات قديمة موجودة محلياً إلى Supabase قبل تنظيف الكاش.
   - يمنع خطأ exceeded the quota لمفتاح tasneef_orders_v233.
   - لا يلمس التكتات، المالية، المخزون، العقود، الخدمات أو الأوقات الشهرية.
*/
(function(){
  'use strict';
  if (window.__tasneefOrdersOnlineNoQuotaV10109) return;
  window.__tasneefOrdersOnlineNoQuotaV10109 = true;

  const VERSION = 'v10109-orders-online-supabase-no-quota';
  const SUPABASE_URL = 'https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const TABLE = 'orders_shared';
  const STORE_KEY = 'tasneef_orders_v233';
  const FLOW_KEY = 'tasneef_orders_workflow_v8';
  const LAST_KEY = 'tasneef_orders_clean_root_last_v10036';
  const MIGRATED_KEY = 'tasneef_orders_local_migrated_v10109';

  const S = v => String(v ?? '').trim();
  const A = v => Array.isArray(v) ? v : [];
  const normalizeNo = v => S(v).replace(/\s+/g,'').toUpperCase();
  const nowIso = () => new Date().toISOString();
  const say = (text,type) => { try{ if(typeof window.msg==='function') window.msg(text,type); else console.log(text); }catch(_){ console.log(text); } };

  const HEADERS = ['رقم الطلب','رقم الطلب بالجروب','تاريخ الطلب','وقت الطلب','مرسل الطلب','المشروع','نوع العقار','رقم الشقة','اسم العميل','رقم العميل','المنفذ','التفاصيل','ملاحظات','تخص','تاريخ التنفيذ','كيفية التنفيذ','حالة التنفيذ','تقرير','السعر (شامل الضريبة)','الضريبة 15%','السعر قبل الضريبة','التكلفة','الربح','حالة السداد','رقم الفاتورة','فوترة بالسيستم'];
  function orderNoForRow(r){ return normalizeNo(r && (r['رقم الطلب'] || r.order_no || r.orderNo || r.id)); }
  function dateKey(r){ return S(r && (r['تاريخ الطلب'] || r.order_date || r.created_at || r.updated_at)); }
  function orderNumberValue(r){ const m=orderNoForRow(r).match(/(\d+)/g); return m && m.length ? Number(m[m.length-1])||0 : 0; }
  function sortRows(rows){
    return A(rows).slice().sort((a,b)=>{
      const ua=S(a.__tasneef_updated_at || a.__server_updated_at || a.updated_at || '');
      const ub=S(b.__tasneef_updated_at || b.__server_updated_at || b.updated_at || '');
      if(ua || ub){ const c=ub.localeCompare(ua); if(c) return c; }
      const nb=orderNumberValue(b), na=orderNumberValue(a); if(nb!==na) return nb-na;
      return dateKey(b).localeCompare(dateKey(a));
    });
  }

  async function api(path, options){
    return fetch(SUPABASE_URL + path, Object.assign({
      cache:'no-store',
      headers:{
        apikey:SUPABASE_ANON_KEY,
        Authorization:'Bearer '+SUPABASE_ANON_KEY,
        Accept:'application/json',
        'Content-Type':'application/json',
        Prefer:'resolution=merge-duplicates,return=representation'
      }
    }, options || {}));
  }

  function safeReadLocalOrders(){
    try{
      const raw = localStorage.getItem(STORE_KEY);
      if(!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }catch(e){ return []; }
  }
  function safeReadFlow(){
    try{ return JSON.parse(localStorage.getItem(FLOW_KEY)||'{}') || {}; }catch(e){ return {}; }
  }

  async function migrateLocalOrdersToSupabase(){
    if(localStorage.getItem(MIGRATED_KEY)==='1') return;
    const rows = safeReadLocalOrders();
    if(!rows.length){ localStorage.setItem(MIGRATED_KEY,'1'); return; }
    const flow = safeReadFlow();
    const unique = new Map();
    rows.forEach(row=>{ const no = orderNoForRow(row); if(no) unique.set(no, Object.assign({}, row, {'رقم الطلب': row['رقم الطلب'] || no, order_no:no, orderNo:no, __tasneef_updated_at: row.__tasneef_updated_at || nowIso()})); });
    const list = [...unique.values()];
    if(!list.length){ localStorage.setItem(MIGRATED_KEY,'1'); return; }
    try{
      for(let i=0;i<list.length;i+=80){
        const batch = list.slice(i,i+80).map(r=>({
          order_no: orderNoForRow(r),
          data: r,
          flow: flow[orderNoForRow(r)] || {},
          updated_at: r.__tasneef_updated_at || nowIso(),
          updated_by: 'v10109_migrate_local_to_supabase'
        }));
        const res = await api('/rest/v1/'+TABLE+'?on_conflict=order_no', {method:'POST', body:JSON.stringify(batch)});
        if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
      }
      localStorage.setItem(MIGRATED_KEY,'1');
      say('تم ترحيل كاش الأوردرات القديم إلى Supabase بأمان', 'ok');
    }catch(e){
      console.error('v10109 migration failed', e);
      say('تنبيه: لم يكتمل ترحيل كاش الأوردرات القديم إلى Supabase: '+(e.message||e), 'err');
      // لا نحذف الكاش القديم إذا فشل الترحيل، حماية للبيانات.
      throw e;
    }
  }

  const rawSetItem = Storage.prototype.setItem;
  if(!window.__tasneefOrdersNoQuotaStoragePatchV10109){
    window.__tasneefOrdersNoQuotaStoragePatchV10109 = true;
    Storage.prototype.setItem = function(key, value){
      try{
        const k = String(key);
        if(k === STORE_KEY){
          // لا تحفظ كل الأوردرات في المتصفح. المصدر الرسمي هو Supabase.
          return rawSetItem.call(this, key, JSON.stringify({online:true, version:VERSION, updated_at:nowIso()}));
        }
        if(k === FLOW_KEY && String(value||'').length > 250000){
          return rawSetItem.call(this, key, JSON.stringify({online:true, version:VERSION, updated_at:nowIso()}));
        }
      }catch(e){
        console.warn('v10109 storage patch fallback', e);
        return;
      }
      try{
        return rawSetItem.call(this, key, value);
      }catch(e){
        if(/quota|exceeded/i.test(String(e && (e.message||e)))){
          console.warn('v10109 prevented localStorage quota error for', key);
          return;
        }
        throw e;
      }
    };
  }

  async function cleanupHugeLocalCacheAfterMigration(){
    try{
      if(localStorage.getItem(MIGRATED_KEY)==='1'){
        localStorage.removeItem(STORE_KEY);
        localStorage.removeItem(LAST_KEY);
        // لا نحذف FLOW_KEY دائمًا لأنه صغير غالبًا، لكن لو ضخم نخليه علامة خفيفة.
        const flowRaw = localStorage.getItem(FLOW_KEY)||'';
        if(flowRaw.length > 250000) localStorage.setItem(FLOW_KEY, JSON.stringify({online:true, version:VERSION, updated_at:nowIso()}));
      }
    }catch(e){ console.warn('v10109 cleanup failed', e); }
  }

  async function boot(){
    try{
      await migrateLocalOrdersToSupabase();
      await cleanupHugeLocalCacheAfterMigration();
      // بعد التنظيف، نطلب من سكربت الأوردرات الحالي إعادة التحميل من السيرفر.
      setTimeout(()=>{ try{ if(typeof window.renderOrdersV233==='function') window.renderOrdersV233(); }catch(_){} }, 300);
    }catch(e){
      // لا نكسر الصفحة إذا فشل الترحيل.
    }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else setTimeout(boot, 0);
  window.addEventListener('load', ()=>setTimeout(boot, 800), {once:true});


  /* v10138 - تعديل أساسي داخل ملف الأوردرات: الإيصال + حفظ Supabase بدون مصدر قديم */
  const RECEIPT_KEY = '__tasneef_order_receipt_v10138';
  const RECEIPT_NAME_KEY = 'الإيصال';
  const SAVE_SOURCE_V10138 = 'v10109_migrate_local_to_supabase';
  const $ = id => document.getElementById(id);
  const esc = v => S(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  const receiptCache = new Map();

  function fileToDataUrl(file){
    return new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>resolve(String(r.result||''));
      r.onerror=()=>reject(r.error||new Error('file read failed'));
      r.readAsDataURL(file);
    });
  }
  function imageDataUrlToCompressed(dataUrl, maxW=1400, quality=.72){
    return new Promise(resolve=>{
      try{
        const img=new Image();
        img.onload=()=>{
          try{
            const scale=Math.min(1,maxW/(img.width||maxW));
            const w=Math.max(1,Math.round((img.width||maxW)*scale));
            const h=Math.max(1,Math.round((img.height||maxW)*scale));
            const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
            const ctx=canvas.getContext('2d'); ctx.drawImage(img,0,0,w,h);
            resolve(canvas.toDataURL('image/jpeg',quality));
          }catch(_){ resolve(dataUrl); }
        };
        img.onerror=()=>resolve(dataUrl);
        img.src=dataUrl;
      }catch(_){ resolve(dataUrl); }
    });
  }
  async function readReceiptFileV10138(){
    const inp=$('orderReceiptFileV233');
    const file=inp && inp.files && inp.files[0];
    if(!file) return null;
    let data=await fileToDataUrl(file);
    if(/^image\//i.test(file.type||'')) data=await imageDataUrlToCompressed(data);
    return {name:file.name||'receipt', type:file.type||'', size:file.size||0, data, uploaded_at:nowIso()};
  }
  function findReceiptInRow(row){
    row=row||{};
    return row[RECEIPT_KEY] || row.receipt || row.order_receipt || row['ملف الإيصال'] || row['مرفق الإيصال'] || null;
  }
  function openReceiptObjectV10138(rec){
    if(!rec) return alert('لا يوجد إيصال مرفق لهذا الأوردر');
    const url=typeof rec==='string'?rec:(rec.data||rec.url||rec.href||'');
    if(!url) return alert('لا يوجد إيصال مرفق لهذا الأوردر');
    const w=window.open('','_blank');
    if(!w) return alert('اسمح بفتح النوافذ المنبثقة لعرض الإيصال');
    if(String(url).startsWith('data:application/pdf')){
      w.document.write('<iframe src="'+url+'" style="width:100%;height:100vh;border:0"></iframe>');
    }else if(String(url).startsWith('data:image')){
      w.document.write('<html dir="rtl"><head><title>الإيصال</title><meta charset="utf-8"><style>body{margin:0;background:#f3f6f5;display:grid;place-items:center;min-height:100vh}img{max-width:96vw;max-height:96vh;background:#fff;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.18)}</style></head><body><img src="'+url+'"></body></html>');
    }else{
      w.location.href=url;
    }
    w.document.close();
  }
  function selectedCardOrderNoV10138(btn){
    const card=btn.closest('[data-order-no],[data-no],.order-card-v360,.order-card,.smart-report-card,.card');
    const direct=card && (card.getAttribute('data-order-no')||card.getAttribute('data-no'));
    if(direct) return normalizeNo(direct);
    const txt=card?card.textContent:'';
    const m=String(txt).match(/ORD\s*[-_]?\s*\d+/i);
    return m?normalizeNo(m[0]):'';
  }
  async function fetchOrderRecordV10138(orderNo){
    orderNo=normalizeNo(orderNo); if(!orderNo) return null;
    const res=await api('/rest/v1/'+TABLE+'?select=order_no,data,flow,updated_at&order_no=eq.'+encodeURIComponent(orderNo)+'&limit=1',{method:'GET'});
    if(!res.ok) throw new Error(await res.text().catch(()=>res.status));
    const arr=await res.json(); return arr && arr[0] || null;
  }
  async function fetchAllOrderRowsV10138(){
    const res=await api('/rest/v1/'+TABLE+'?select=order_no,data,flow,updated_at&order=updated_at.desc&limit=5000',{method:'GET'});
    if(!res.ok) throw new Error(await res.text().catch(()=>res.status));
    return A(await res.json()).map(x=>Object.assign({},x.data||{}, {order_no:x.order_no, __server_updated_at:x.updated_at, __flow:x.flow||{}}));
  }
  async function nextOrderNoV10138(){
    const rows=await fetchAllOrderRowsV10138().catch(()=>[]);
    let max=0; rows.forEach(r=>{ max=Math.max(max, orderNumberValue(r)); });
    return 'ORD'+String(max+1).padStart(4,'0');
  }
  function labelForControlV10138(el){
    if(!el) return '';
    const id=el.id||'';
    let lab=id?document.querySelector('label[for="'+CSS.escape(id)+'"]'):null;
    if(!lab){ const box=el.closest('div'); lab=box?box.querySelector('label'):null; }
    return S(lab?lab.textContent:'').replace(/[:：]/g,'').trim();
  }
  function collectOrderFormV10138(){
    const out={};
    const no=S($('orderNoV233')?.value||'');
    const group=S($('orderGroupNoV233')?.value||'');
    if(no) out['رقم الطلب']=no;
    if(group) out['رقم الطلب بالجروب']=group;
    const box=$('orderFormFieldsV233');
    if(box){
      box.querySelectorAll('input,select,textarea').forEach(el=>{
        if(!el.id || el.type==='file' || el.type==='button' || el.type==='submit') return;
        const key=labelForControlV10138(el) || el.name || el.id;
        if(key) out[key]=S(el.value);
      });
    }
    out.order_no=normalizeNo(out['رقم الطلب']||no);
    out.orderNo=out['رقم الطلب']||no;
    out.__tasneef_updated_at=nowIso();
    return out;
  }
  async function upsertOrderV10138(row, flow){
    const order_no=normalizeNo(row && (row['رقم الطلب']||row.order_no||row.orderNo));
    if(!order_no) throw new Error('رقم الأوردر غير موجود');
    const payload={order_no, data:row, flow:flow||{}, updated_at:nowIso(), updated_by:SAVE_SOURCE_V10138};
    const res=await api('/rest/v1/'+TABLE+'?on_conflict=order_no',{method:'POST',body:JSON.stringify([payload])});
    if(!res.ok) throw new Error(await res.text().catch(()=>res.status));
    receiptCache.set(order_no, findReceiptInRow(row));
    return true;
  }
  async function saveOrderCoreV10138(){
    let row=collectOrderFormV10138();
    let orderNo=normalizeNo(row['رقم الطلب']||row.order_no);
    if(!orderNo){
      orderNo=await nextOrderNoV10138();
      row['رقم الطلب']=orderNo; row.order_no=orderNo; row.orderNo=orderNo;
      if($('orderNoV233')) $('orderNoV233').value=orderNo;
    }
    const existing=await fetchOrderRecordV10138(orderNo).catch(()=>null);
    const merged=Object.assign({}, existing&&existing.data||{}, row);
    const rec=await readReceiptFileV10138();
    if(rec){ merged[RECEIPT_KEY]=rec; merged[RECEIPT_NAME_KEY]=rec.name; }
    else if(existing && existing.data && findReceiptInRow(existing.data)){
      merged[RECEIPT_KEY]=findReceiptInRow(existing.data);
      merged[RECEIPT_NAME_KEY]=existing.data[RECEIPT_NAME_KEY] || (merged[RECEIPT_KEY] && merged[RECEIPT_KEY].name) || '';
    }
    merged.order_no=orderNo; merged.orderNo=orderNo; merged['رقم الطلب']=merged['رقم الطلب']||orderNo; merged.__tasneef_updated_at=nowIso();
    await upsertOrderV10138(merged, existing&&existing.flow||{});
    try{ if(typeof window.msg==='function') window.msg('تم حفظ الأوردر بنجاح','ok'); }catch(_){ alert('تم حفظ الأوردر بنجاح'); }
    try{ if(typeof window.clearOrderFormV233==='function') window.clearOrderFormV233(); }catch(_){ }
    if($('orderReceiptFileV233')) $('orderReceiptFileV233').value='';
    if($('orderReceiptNameV233')) $('orderReceiptNameV233').textContent=merged[RECEIPT_NAME_KEY] ? 'مرفق محفوظ: '+merged[RECEIPT_NAME_KEY] : 'اختياري';
    setTimeout(()=>{ try{ if(typeof window.renderOrdersV233==='function') window.renderOrdersV233(); }catch(_){} attachReceiptButtonsV10138(); },300);
  }
  function patchSaveOrderV10138(){
    window.saveOrderV233 = function(){ saveOrderCoreV10138().catch(e=>alert('لم يتم حفظ الأوردر:\n'+(e.message||e))); };
  }
  function patchReceiptFormV10138(){
    const inp=$('orderReceiptFileV233'), view=$('orderReceiptViewV233'), name=$('orderReceiptNameV233');
    if(inp && !inp.__receiptV10138){
      inp.__receiptV10138=true;
      inp.addEventListener('change',()=>{ if(name) name.textContent=inp.files&&inp.files[0]?'جاهز للحفظ: '+inp.files[0].name:'اختياري'; });
    }
    if(view && !view.__receiptV10138){
      view.__receiptV10138=true;
      view.onclick=async()=>{
        const file=inp&&inp.files&&inp.files[0];
        if(file){ const data=await fileToDataUrl(file); return openReceiptObjectV10138({data,type:file.type,name:file.name}); }
        const no=normalizeNo($('orderNoV233')?.value||'');
        if(!no) return alert('لا يوجد أوردر محدد');
        const r=await fetchOrderRecordV10138(no).catch(e=>(alert('تعذر قراءة الإيصال:\n'+(e.message||e)),null));
        openReceiptObjectV10138(r&&r.data&&findReceiptInRow(r.data));
      };
    }
  }
  async function hydrateReceiptCacheV10138(){
    try{
      const rows=await fetchAllOrderRowsV10138();
      rows.forEach(r=>{ const no=orderNoForRow(r); const rec=findReceiptInRow(r); if(no&&rec) receiptCache.set(no,rec); });
    }catch(e){ console.warn('receipt cache failed',e); }
  }
  function attachReceiptButtonsV10138(){
    const cards=document.querySelectorAll('#ordersCardsV360 > *, .orders-cards-v360 > *');
    cards.forEach(card=>{
      if(card.querySelector('.orders-card-receipt-v10138')) return;
      const no=selectedCardOrderNoV10138(card);
      let host=card.querySelector('.row-actions,.actions,.order-actions-v360') || card;
      const btn=document.createElement('button');
      btn.type='button'; btn.className='orders-card-receipt-v10138'; btn.textContent='عرض الإيصال';
      if(!no || !receiptCache.has(no)) btn.disabled=true;
      btn.onclick=async(e)=>{
        e.preventDefault(); e.stopPropagation();
        let rec=receiptCache.get(no);
        if(!rec){ const r=await fetchOrderRecordV10138(no).catch(err=>(alert('تعذر قراءة الإيصال:\n'+(err.message||err)),null)); rec=r&&r.data&&findReceiptInRow(r.data); if(rec) receiptCache.set(no,rec); }
        openReceiptObjectV10138(rec);
      };
      host.appendChild(btn);
    });
  }
  function patchRenderOrdersV10138(){
    if(window.__renderOrdersV10138Patched) return;
    const old=window.renderOrdersV233;
    if(typeof old==='function'){
      window.renderOrdersV233=function(){ const ret=old.apply(this,arguments); setTimeout(attachReceiptButtonsV10138,80); return ret; };
      window.__renderOrdersV10138Patched=true;
    }
  }
  function bootReceiptCoreV10138(){
    patchSaveOrderV10138(); patchReceiptFormV10138(); patchRenderOrdersV10138(); hydrateReceiptCacheV10138().then(()=>setTimeout(attachReceiptButtonsV10138,300));
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(bootReceiptCoreV10138,900),{once:true});
  else setTimeout(bootReceiptCoreV10138,900);
  window.addEventListener('load',()=>setTimeout(()=>{ bootReceiptCoreV10138(); const target=$('ordersCardsV360'); if(target&&!target.__receiptObsV10138){ target.__receiptObsV10138=true; new MutationObserver(()=>setTimeout(attachReceiptButtonsV10138,50)).observe(target,{childList:true,subtree:true}); } },1300),{once:true});

  console.log('Loaded '+VERSION+' + v10138 receipt core');
})();

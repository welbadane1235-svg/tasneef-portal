/* Tasneef v10144 - Orders receipt + immediate save refresh
   Scope: قسم الأوردرات فقط
   - زر إيصال واحد فقط في كروت الأوردرات.
   - حفظ/تعديل مباشر في Supabase بدون updated_by/source.
   - تحديث العرض فور الحفظ من Supabase عبر كاش مباشر للمتصفح.
*/
(function(){
  'use strict';
  if(window.__tasneefOrdersReceiptSaveRefreshV10143) return;
  window.__tasneefOrdersReceiptSaveRefreshV10143=true;

  const VERSION='v10179_orders_edit_history_visible';
  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const TABLE='orders_shared';
  const STORE_KEY='tasneef_orders_v233';
  const RECEIPT_KEY='__tasneef_order_receipt_v10140';
  const RECEIPT_NAME_KEY='الإيصال';
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const $=id=>document.getElementById(id);
  const nowIso=()=>new Date().toISOString();
  const normalizeNo=v=>S(v).replace(/\s+/g,'').toUpperCase();

  function orderCurrentUserNameV10179(){
    try{
      const u=(typeof window.session==='function' && window.session()) || window.currentUser || window.__currentUser || {};
      return S(u.full_name||u.name||u.username||u.email||'مدير النظام') || 'مدير النظام';
    }catch(_){ return 'مدير النظام'; }
  }
  function cleanHistoryKeyV10179(k){
    k=S(k);
    return k && !/^(__|orderNo$|order_no$|updated_at$|created_at$|source$|updated_by$|created_by$)/i.test(k);
  }
  function buildOrderEditHistoryV10179(oldData, newData, oldFlow){
    oldData=oldData||{}; newData=newData||{}; oldFlow=oldFlow||{};
    const keys=[...new Set(Object.keys(newData).concat(Object.keys(oldData))).values()].filter(cleanHistoryKeyV10179);
    const changes=[];
    keys.forEach(k=>{
      const a=S(oldData[k]); const b=S(newData[k]);
      if(a!==b) changes.push({field:k, before:a, after:b});
    });
    const previous = Array.isArray(oldFlow.history) ? oldFlow.history : (Array.isArray(oldFlow.edit_history) ? oldFlow.edit_history : (Array.isArray(oldData.__edit_history) ? oldData.__edit_history : []));
    const next = Object.assign({}, oldFlow);
    if(changes.length){
      const entry={
        at:new Date().toISOString(),
        by:orderCurrentUserNameV10179(),
        action: oldData && Object.keys(oldData).length ? 'تعديل أوردر' : 'إنشاء أوردر',
        changes:changes.slice(0,80)
      };
      next.history = previous.concat([entry]).slice(-80);
      next.edit_history = next.history;
    }else{
      next.history = previous.slice(-80);
      next.edit_history = next.history;
    }
    return next;
  }
  function orderHistoryFromV10179(row, rec){
    row=row||{}; rec=rec||{};
    const f=row.__flow || rec.flow || {};
    return A(f.history||f.edit_history||row.__edit_history||row.edit_history);
  }
  function historyHtmlV10179(history){
    if(!history || !history.length) return '<div class="orders-history-empty-v10179">لا توجد تعديلات مسجلة حتى الآن لهذا السجل.</div>';
    return history.slice().reverse().map(h=>{
      const at=h.at ? new Date(h.at).toLocaleString('ar-SA') : '-';
      const by=S(h.by||h.user||'-');
      const action=S(h.action||'تعديل');
      const changes=A(h.changes).slice(0,12).map(c=>`<li><b>${escHtmlV10179(c.field)}</b>: <span>${escHtmlV10179(c.before||'-')}</span> ← <span>${escHtmlV10179(c.after||'-')}</span></li>`).join('');
      return `<div class="orders-history-item-v10179"><div><b>${escHtmlV10179(action)}</b> <small>${escHtmlV10179(at)} — ${escHtmlV10179(by)}</small></div>${changes?`<ul>${changes}</ul>`:''}</div>`;
    }).join('');
  }
  function escHtmlV10179(v){ return S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function ensureHistoryStyleV10179(){
    if(document.getElementById('ordersHistoryStyleV10179')) return;
    const st=document.createElement('style'); st.id='ordersHistoryStyleV10179';
    st.textContent='.orders-history-list-v10179{margin-top:10px;display:grid;gap:8px}.orders-history-empty-v10179{border:1px dashed #dce6e2;border-radius:14px;padding:12px;color:#60706a;background:#fbfdfc}.orders-history-item-v10179{border:1px solid #dce6e2;border-radius:14px;padding:10px;background:#fbfdfc;line-height:1.7}.orders-history-item-v10179 small{color:#60706a}.orders-history-item-v10179 ul{margin:7px 0 0;padding-inline-start:22px}.orders-history-item-v10179 li{margin:3px 0}';
    document.head.appendChild(st);
  }
  const receiptCache=new Map();
  let serverRows=[];

  function notify(text,type){
    try{ if(typeof window.msg==='function') return window.msg(text,type||'ok'); }catch(_){ }
    try{ alert(text); }catch(_){ }
  }

  if(!window.__tasneefOrdersFetchCleanPatchV10143){
    window.__tasneefOrdersFetchCleanPatchV10143=true;
    const rawFetch=window.fetch.bind(window);
    window.fetch=function(input, init){
      try{
        const url=typeof input==='string'?input:(input&&input.url)||'';
        const method=String((init&&init.method)||'GET').toUpperCase();
        if(/\/rest\/v1\/orders_shared/i.test(url) && ['POST','PATCH','PUT'].includes(method) && init && init.body){
          const clean=o=>{ if(o&&typeof o==='object'){ delete o.updated_by; delete o.source; delete o.created_by; } return o; };
          const body=JSON.parse(init.body);
          init=Object.assign({},init,{body:JSON.stringify(Array.isArray(body)?body.map(clean):clean(body))});
        }
      }catch(_){ }
      return rawFetch(input,init);
    };
  }

  // يخلي renderOrdersV233 يقرأ آخر بيانات من Supabase بدل الكاش القديم.
  if(!window.__tasneefOrdersGetItemPatchV10143){
    window.__tasneefOrdersGetItemPatchV10143=true;
    const rawGet=Storage.prototype.getItem;
    Storage.prototype.getItem=function(key){
      try{
        if(String(key)===STORE_KEY && Array.isArray(serverRows) && serverRows.length){
          return JSON.stringify(serverRows);
        }
      }catch(_){ }
      return rawGet.call(this,key);
    };
  }

  async function api(path, options){
    const res=await fetch(SUPABASE_URL+path,Object.assign({
      cache:'no-store',
      headers:{
        apikey:SUPABASE_ANON_KEY,
        Authorization:'Bearer '+SUPABASE_ANON_KEY,
        Accept:'application/json',
        'Content-Type':'application/json',
        Prefer:'return=representation'
      }
    },options||{}));
    if(!res.ok){ const txt=await res.text().catch(()=>String(res.status)); throw new Error(txt||String(res.status)); }
    if(res.status===204) return [];
    return res.json().catch(()=>[]);
  }

  function orderNoForRow(r){ return normalizeNo(r && (r['رقم الطلب']||r.order_no||r.orderNo)); }
  function findReceipt(row){ row=row||{}; return row[RECEIPT_KEY]||row.receipt||row.order_receipt||row['ملف الإيصال']||row['مرفق الإيصال']||null; }
  function orderNumberValue(r){ const m=orderNoForRow(r).match(/(\d+)/g); return m&&m.length?Number(m[m.length-1])||0:0; }
  function sortRows(rows){
    return A(rows).slice().sort((a,b)=>{
      const ua=S(a.__tasneef_updated_at||a.__server_updated_at||a.updated_at||'');
      const ub=S(b.__tasneef_updated_at||b.__server_updated_at||b.updated_at||'');
      if(ua||ub){ const c=ub.localeCompare(ua); if(c) return c; }
      return orderNumberValue(b)-orderNumberValue(a);
    });
  }

  async function fetchAllRows(){
    const arr=await api('/rest/v1/'+TABLE+'?select=order_no,data,flow,updated_at&order=updated_at.desc&limit=5000',{method:'GET'});
    const rows=A(arr).map(x=>Object.assign({},x.data||{}, {order_no:x.order_no,orderNo:(x.data&&x.data.orderNo)||x.order_no,'رقم الطلب':(x.data&&x.data['رقم الطلب'])||x.order_no,__server_updated_at:x.updated_at,__flow:x.flow||{}}));
    rows.forEach(r=>{ const no=orderNoForRow(r), rec=findReceipt(r); if(no&&rec) receiptCache.set(no,rec); });
    serverRows=sortRows(rows);
    window.__tasneefOrdersServerRowsV10143=serverRows;
    return serverRows;
  }
  async function fetchRecord(no){
    no=normalizeNo(no); if(!no) return null;
    const arr=await api('/rest/v1/'+TABLE+'?select=order_no,data,flow,updated_at&order_no=eq.'+encodeURIComponent(no)+'&limit=1',{method:'GET'});
    return A(arr)[0]||null;
  }
  async function nextOrderNo(){
    if(!serverRows.length) await fetchAllRows().catch(()=>[]);
    let max=0; serverRows.forEach(r=>max=Math.max(max,orderNumberValue(r)));
    return 'ORD'+String(max+1).padStart(4,'0');
  }

  function removeExtraReceiptInputs(){
    // احذف أي صندوق إيصال أضيف سابقاً، واترك الصندوق الموجود في النموذج فقط.
    document.querySelectorAll('#ordersReceiptFallbackV10139').forEach(x=>x.remove());
    const boxes=[...document.querySelectorAll('.orders-receipt-base-v10138')];
    boxes.slice(1).forEach(x=>x.remove());
    const inputs=[...document.querySelectorAll('input#orderReceiptFileV233')];
    inputs.slice(1).forEach(el=>{ const box=el.closest('.orders-receipt-base-v10138'); if(box) box.remove(); else el.remove(); });
  }
  function labelTextFor(el){
    if(!el) return '';
    const parts=[];
    let p=el.parentElement;
    for(let i=0;p&&i<4;i++,p=p.parentElement){
      const lab=p.querySelector(':scope > label'); if(lab) parts.push(lab.textContent);
      const t=S(p.textContent); if(t) parts.push(t.slice(0,100));
    }
    return parts.join(' ');
  }
  function receiptInput(){
    removeExtraReceiptInputs();
    const form=$('orderFormFieldsV233')||document;
    const files=[...form.querySelectorAll('input[type="file"]')];
    let inp=files.find(el=>/إيصال|ايصال|الإيصال|الايصال/i.test(labelTextFor(el))) || files[0] || null;
    if(inp) inp.id='orderReceiptFileV233';
    return inp;
  }
  function bindFormReceipt(){
    const inp=receiptInput(); if(!inp) return;
    let view=$('orderReceiptViewV233');
    if(!view){ view=document.createElement('button'); view.type='button'; view.id='orderReceiptViewV233'; view.className='light'; view.textContent='عرض الإيصال'; inp.insertAdjacentElement('afterend',view); }
    let name=$('orderReceiptNameV233');
    if(!name){ name=document.createElement('small'); name.id='orderReceiptNameV233'; name.style.cssText='display:block;color:#60706a;margin-top:6px'; view.insertAdjacentElement('afterend',name); }
    if(!name.textContent) name.textContent='اختياري';
    if(!inp.__receiptV10143){ inp.__receiptV10143=true; inp.addEventListener('change',()=>{ name.textContent=(inp.files&&inp.files[0])?'جاهز للحفظ: '+inp.files[0].name:'اختياري'; }); }
    if(!view.__receiptV10143){ view.__receiptV10143=true; view.onclick=async(e)=>{ e.preventDefault(); const f=inp.files&&inp.files[0]; if(f){ return openReceipt({data:await fileToDataUrl(f),type:f.type,name:f.name}); } const no=normalizeNo(($('orderNoV233')&&$('orderNoV233').value)||''); if(!no) return notify('لا يوجد أوردر محدد','err'); const r=await fetchRecord(no).catch(err=>(notify('تعذر قراءة الإيصال:\n'+(err.message||err),'err'),null)); openReceipt(r&&r.data&&findReceipt(r.data)); }; }
  }

  function fileToDataUrl(file){ return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(String(r.result||'')); r.onerror=()=>reject(r.error||new Error('تعذر قراءة الملف')); r.readAsDataURL(file); }); }
  function compressImageDataUrl(dataUrl){
    return new Promise(resolve=>{
      try{ const img=new Image(); img.onload=()=>{ const max=1400; let w=img.naturalWidth||img.width,h=img.naturalHeight||img.height; if(w>max||h>max){ const k=Math.min(max/w,max/h); w=Math.round(w*k); h=Math.round(h*k); } const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h); resolve(c.toDataURL('image/jpeg',0.78)); }; img.onerror=()=>resolve(dataUrl); img.src=dataUrl; }catch(_){ resolve(dataUrl); }
    });
  }
  async function readReceiptFile(){ const inp=receiptInput(); const f=inp&&inp.files&&inp.files[0]; if(!f) return null; let data=await fileToDataUrl(f); if(/^image\//i.test(f.type||'')) data=await compressImageDataUrl(data); return {name:f.name||'receipt',type:f.type||'',size:f.size||0,data,uploaded_at:nowIso()}; }
  function openReceipt(rec){
    if(!rec) return notify('لا يوجد إيصال مرفق لهذا الأوردر','err');
    const url=typeof rec==='string'?rec:(rec.data||rec.url||rec.href||'');
    if(!url) return notify('لا يوجد إيصال مرفق لهذا الأوردر','err');
    const w=window.open('','_blank'); if(!w) return notify('اسمح بفتح النوافذ المنبثقة لعرض الإيصال','err');
    if(String(url).startsWith('data:application/pdf')) w.document.write('<iframe src="'+url+'" style="width:100%;height:100vh;border:0"></iframe>');
    else if(String(url).startsWith('data:image')) w.document.write('<html dir="rtl"><head><meta charset="utf-8"><title>الإيصال</title><style>body{margin:0;background:#f3f6f5;display:grid;place-items:center;min-height:100vh}img{max-width:96vw;max-height:96vh;background:#fff;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.18)}</style></head><body><img src="'+url+'"></body></html>');
    else w.location.href=url;
    try{ w.document.close(); }catch(_){ }
  }



  function fieldId(header){
    try{return 'orderFieldV233_'+btoa(unescape(encodeURIComponent(header))).replace(/=+$/,'').replace(/[^a-zA-Z0-9]/g,'_');}
    catch(_){return 'orderFieldV233_'+String(header).replace(/[^a-zA-Z0-9\u0600-\u06FF]/g,'_');}
  }
  function cleanupInventoryCostFields(){
    // v10146: نخلي خانة تكلفة المخزن واحدة فقط، وهي الخانة التلقائية من حركة المخزون.
    try{
      const form=$('orderFormFieldsV233'); if(!form) return;
      let auto=$('orderInventoryCostV10111');
      // لو الخانة التلقائية غير موجودة، لا نحذف شيئاً حتى يركبها سكربت المخزون.
      if(!auto) return;
      const autoBox=auto.closest('div');
      // احذف أي خانة أخرى عنوانها تكلفة المخزن، لأنها اليدوية وغير مطلوبة.
      [...form.children].forEach(ch=>{
        if(ch===autoBox || (autoBox&&autoBox.contains(ch)) || (ch&&ch.contains(auto))) return;
        const lab=S((ch.querySelector&&ch.querySelector('label')&&ch.querySelector('label').textContent)||'').replace(/[:：]/g,'');
        if(lab==='تكلفة المخزن') ch.remove();
      });
      // إزالة أي عنصر يدوي معروف بالاسم أو الآي دي القديم.
      const manualIds=['orderInventoryCostV233',fieldId('تكلفة المخزن')];
      manualIds.forEach(id=>{
        const el=$(id);
        if(el && el!==auto){ const box=el.closest('div'); if(box && box!==autoBox) box.remove(); else el.remove(); }
      });
      auto.readOnly=true;
      auto.setAttribute('readonly','readonly');
      auto.placeholder='تلقائي من حركة المخزون';
      const note=autoBox&&autoBox.querySelector('small');
      if(note) note.textContent='تلقائي من حركة المخزون ويؤثر على الربح.';
    }catch(e){ console.warn('cleanupInventoryCostFields failed',e); }
  }

  function labelForControl(el){
    if(!el) return '';
    if(el.dataset&&el.dataset.label) return S(el.dataset.label).replace(/[:：]/g,'');
    if(el.id){ try{ const lab=document.querySelector('label[for="'+CSS.escape(el.id)+'"]'); if(lab) return S(lab.textContent).replace(/[:：]/g,''); }catch(_){ } }
    const wrap=el.closest('.field,.form-field,.order-field,.input-box,div');
    const lab=wrap&&wrap.querySelector('label');
    if(lab) return S(lab.textContent).replace(/[:：]/g,'');
    return S(el.getAttribute('aria-label')||el.placeholder||el.name||el.id).replace(/[:：]/g,'');
  }
  function collectForm(){
    const out={}; const box=$('orderFormFieldsV233')||document;
    const scan=[...box.querySelectorAll('input,select,textarea')];
    ['orderNoV233','orderGroupNoV233'].forEach(id=>{ const el=$(id); if(el&&!scan.includes(el)) scan.push(el); });
    scan.forEach(el=>{
      if(!el||el.disabled||['file','button','submit'].includes(String(el.type))) return;
      const key=labelForControl(el); if(key) out[key]=S(el.value);
    });
    const known={
      orderNoV233:'رقم الطلب', orderGroupNoV233:'رقم الطلب بالجروب', orderProjectV233:'المشروع', orderClientV233:'اسم العميل', orderClientPhoneV233:'رقم العميل',
      orderExecutorV233:'المنفذ', orderRequesterV233:'مرسل الطلب', orderDetailsV233:'التفاصيل', orderNotesV233:'ملاحظات', orderPriceV233:'السعر (شامل الضريبة)',
      orderTaxV233:'الضريبة 15%', orderBeforeTaxV233:'السعر قبل الضريبة', orderCostV233:'التكلفة', orderProfitV233:'الربح', orderStatusV233:'حالة التنفيذ',
      orderPaymentStatusV233:'حالة السداد', orderInvoiceNoV233:'رقم الفاتورة', orderBillingStatusV233:'فوترة بالسيستم', orderInventoryCostV10111:'تكلفة المخزن'
    };
    Object.keys(known).forEach(id=>{ const el=$(id); if(el) out[known[id]]=S(el.value); });
    const autoInv=$('orderInventoryCostV10111');
    if(autoInv) out['تكلفة المخزن']=S(autoInv.value||'0');
    const no=normalizeNo(out['رقم الطلب']||out.order_no||out.orderNo||(($('orderNoV233')&&$('orderNoV233').value)||''));
    if(no){ out['رقم الطلب']=no; out.order_no=no; out.orderNo=no; }
    out.__tasneef_updated_at=nowIso();
    delete out.updated_by; delete out.source; delete out.created_by;
    return out;
  }

  function clearOrderEntryFormAfterSave(){
    // v10145: بعد حفظ التعديل نخلي نموذج الإدخال فاضي حتى يعرف المستخدم أن الحفظ تم.
    try{
      const receiptName=$('orderReceiptNameV233');
      const receiptFile=$('orderReceiptFileV233');
      const preserveScroll=window.scrollY;
      if(typeof window.clearOrderFormV233==='function' && !window.clearOrderFormV233.__v10145Busy){
        window.clearOrderFormV233.__v10145Busy=true;
        try{ window.clearOrderFormV233(); }finally{ window.clearOrderFormV233.__v10145Busy=false; }
      }else{
        const box=document.querySelector('.orders-form-card-v233') || document.getElementById('orders');
        if(box){
          box.querySelectorAll('input,textarea,select').forEach(el=>{
            if(el.type==='file') el.value='';
            else if(el.id==='orderNoV233' || el.id==='orderEditIndexV233') el.value='';
            else if(el.tagName==='SELECT') el.selectedIndex=0;
            else el.value='';
          });
        }
      }
      if(receiptFile) receiptFile.value='';
      if(receiptName) receiptName.textContent='اختياري';
      const title=$('orderFormTitleV233'); if(title) title.textContent='إضافة أوردر';
      setTimeout(()=>{ try{ window.scrollTo({top:preserveScroll}); }catch(_){ } },0);
    }catch(e){ console.warn('clearOrderEntryFormAfterSave failed',e); }
  }

  async function saveOrder(){
    const btn=[...document.querySelectorAll('button')].find(b=>/حفظ\s*الأوردر|حفظ\s*الاوردر/i.test(S(b.textContent)))||document.activeElement;
    try{ if(btn) btn.disabled=true; }catch(_){ }
    try{
      let row=collectForm();
      let no=normalizeNo(row['رقم الطلب']||row.order_no);
      if(!no){ no=await nextOrderNo(); row['رقم الطلب']=no; row.order_no=no; row.orderNo=no; if($('orderNoV233')) $('orderNoV233').value=no; }
      const old=await fetchRecord(no).catch(()=>null);
      const merged=Object.assign({}, old&&old.data||{}, row, {order_no:no, orderNo:no, 'رقم الطلب':no, __tasneef_updated_at:nowIso()});
      const rec=await readReceiptFile();
      if(rec){ merged[RECEIPT_KEY]=rec; merged[RECEIPT_NAME_KEY]=rec.name; }
      else if(old&&old.data&&findReceipt(old.data)){ const oldRec=findReceipt(old.data); merged[RECEIPT_KEY]=oldRec; merged[RECEIPT_NAME_KEY]=old.data[RECEIPT_NAME_KEY]||(oldRec&&oldRec.name)||''; }
      delete merged.updated_by; delete merged.source; delete merged.created_by;
      const flow=buildOrderEditHistoryV10179((old&&old.data)||{}, merged, (old&&old.flow)||{});
      merged.__edit_history = A(flow.history).slice(-80);
      const payload={order_no:no,data:merged,flow:flow,updated_at:nowIso()};
      if(old) await api('/rest/v1/'+TABLE+'?order_no=eq.'+encodeURIComponent(no),{method:'PATCH',body:JSON.stringify(payload)});
      else await api('/rest/v1/'+TABLE,{method:'POST',body:JSON.stringify(payload)});
      const f=receiptInput(); if(f) f.value='';
      const nm=$('orderReceiptNameV233'); if(nm) nm.textContent=merged[RECEIPT_NAME_KEY]?'مرفق محفوظ: '+merged[RECEIPT_NAME_KEY]:'اختياري';
      if(findReceipt(merged)) receiptCache.set(no,findReceipt(merged));
      // تحديث فوري: نعيد جلب السيرفر، ثم نطلب من الرسم الحالي إعادة العرض، وبعدها نفرغ النموذج.
      await refreshOrdersView(true);
      clearOrderEntryFormAfterSave();
      notify('تم حفظ الأوردر وتحديث السجل وتم تفريغ البيانات','ok');
      return true;
    }catch(e){
      notify('لم يتم حفظ الأوردر:\n'+(e.message||e),'err');
      return false;
    }finally{ setTimeout(()=>{ try{ if(btn) btn.disabled=false; }catch(_){ } },500); }
  }

  async function refreshOrdersView(skipNotify){
    await fetchAllRows().catch(()=>[]);
    try{ if(typeof window.renderOrdersV233==='function') window.renderOrdersV233(); }catch(_){ }
    setTimeout(()=>{ cleanupInventoryCostFields(); cleanupCardReceiptButtons(); attachReceiptButtons(); patchOrderWhatsappButtons(); },120);
    if(!skipNotify) notify('تم تحديث الأوردرات','ok');
  }
  function installSave(){
    window.saveOrderV233=saveOrder;
    const buttons=[...document.querySelectorAll('button')].filter(b=>/حفظ\s*الأوردر|حفظ\s*الاوردر/i.test(S(b.textContent)));
    buttons.forEach(b=>{ b.onclick=function(ev){ if(ev) ev.preventDefault(); return saveOrder(); }; });
    const updateBtns=[...document.querySelectorAll('button')].filter(b=>/^تحديث$/.test(S(b.textContent)) && (($('orders')&&$('orders').contains(b))||S(document.querySelector('#orders h2')&&document.querySelector('#orders h2').textContent).includes('الأوردرات')));
    updateBtns.forEach(b=>{ if(!b.__ordersRefreshV10143){ b.__ordersRefreshV10143=true; b.onclick=function(ev){ if(ev) ev.preventDefault(); return refreshOrdersView(false); }; } });
  }



  function rowByNo(no){ no=normalizeNo(no); return A(serverRows).find(r=>orderNoForRow(r)===no) || null; }
  function phoneForRow(row){
    const raw=S(row&& (row['رقم العميل']||row.client_phone||row.phone||''));
    let p=raw.replace(/[^0-9+]/g,'');
    if(!p) return '';
    if(p.startsWith('+')) p=p.slice(1);
    if(p.startsWith('00')) p=p.slice(2);
    if(p.startsWith('0')) p='966'+p.slice(1);
    if(p.length===9 && p.startsWith('5')) p='966'+p;
    return p;
  }
  function orderWhatsappText(row, hasReceipt){
    row=row||{};
    const no=S(row['رقم الطلب']||row.order_no||row.orderNo||'');
    const project=S(row['المشروع']||'');
    const client=S(row['اسم العميل']||'');
    const details=S(row['التفاصيل']||'');
    const status=S(row['حالة التنفيذ']||'');
    const price=S(row['السعر (شامل الضريبة)']||'');
    const inv=S(row['رقم الفاتورة']||'');
    return [
      'السلام عليكم ورحمة الله وبركاته',
      '',
      'تحديث أوردر صيانة',
      no ? 'رقم الأوردر: '+no : '',
      project ? 'المشروع: '+project : '',
      client ? 'العميل: '+client : '',
      details ? 'التفاصيل: '+details : '',
      status ? 'حالة التنفيذ: '+status : '',
      inv ? 'رقم الفاتورة: '+inv : '',
      price ? 'المبلغ شامل الضريبة: '+price+' ر.س' : '',
      hasReceipt ? 'مرفق الإيصال.' : '',
      '',
      'شركة تصنيف لإدارة المرافق'
    ].filter(Boolean).join('\n');
  }
  function dataUrlToFile(dataUrl,name,type){
    const arr=String(dataUrl||'').split(',');
    const mime=(arr[0].match(/data:([^;]+)/)||[])[1] || type || 'application/octet-stream';
    const bin=atob(arr[1]||''); const u8=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
    const ext=mime.includes('pdf')?'.pdf':(mime.includes('png')?'.png':(mime.includes('jpeg')||mime.includes('jpg')?'.jpg':''));
    const safeName=S(name||('receipt'+ext)) || ('receipt'+ext);
    return new File([u8], safeName, {type:mime});
  }
  async function receiptToFile(rec,no){
    if(!rec) return null;
    const data=typeof rec==='string'?rec:(rec.data||'');
    if(!String(data).startsWith('data:')) return null;
    return dataUrlToFile(data, (rec.name||('receipt_'+no)), rec.type||'');
  }
  async function sendOrderWhatsappWithReceipt(no){
    no=normalizeNo(no);
    if(!no) return notify('لم يتم تحديد الأوردر','err');
    let row=rowByNo(no);
    if(!row){ const r=await fetchRecord(no).catch(()=>null); row=r&&r.data; }
    if(!row) return notify('لم يتم العثور على بيانات الأوردر','err');
    let rec=findReceipt(row);
    if(!rec){ const r=await fetchRecord(no).catch(()=>null); rec=r&&r.data&&findReceipt(r.data); }
    const text=orderWhatsappText(row, !!rec);
    const file=rec ? await receiptToFile(rec,no).catch(()=>null) : null;
    // على الجوال: Web Share يرسل النص مع الملف إلى واتساب أو أي تطبيق مشاركة يختاره المستخدم.
    if(file && navigator.canShare && navigator.canShare({files:[file]})){
      try{ await navigator.share({title:'أوردر '+no, text, files:[file]}); return true; }
      catch(e){ if(e && e.name==='AbortError') return false; }
    }
    // على الكمبيوتر / واتساب ويب: المتصفح لا يسمح بإرفاق ملف تلقائيًا، لذلك نفتح الرسالة ونفتح الإيصال بجانبها.
    const phone=phoneForRow(row);
    const url='https://wa.me/'+(phone?phone:'')+'?text='+encodeURIComponent(text);
    window.open(url,'_blank','noopener');
    if(rec) setTimeout(()=>openReceipt(rec),550);
    return true;
  }
  function patchOrderWhatsappButtons(){
    receiptCardRoots().forEach(card=>{
      const no=selectedNoFromCard(card); if(!no) return;
      [...card.querySelectorAll('button,a')].forEach(btn=>{
        if(!/واتساب/i.test(S(btn.textContent))) return;
        if(btn.__ordersWaReceiptV10146) return;
        btn.__ordersWaReceiptV10146=true;
        btn.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); sendOrderWhatsappWithReceipt(no); return false; };
      });
    });
  }

  function selectedNoFromCard(card){
    const direct=card&&(card.getAttribute('data-order-no')||card.getAttribute('data-no')||card.dataset?.orderNo);
    if(direct) return normalizeNo(direct);
    const txt=card?card.textContent:''; const m=String(txt).match(/ORD\s*[-_]?\s*\d+/i);
    return m?normalizeNo(m[0]):'';
  }
  function isReceiptButton(btn){
    return btn && /عرض\s*الإيصال|عرض\s*الايصال/i.test(S(btn.textContent));
  }
  function receiptCardRoots(){
    return [...document.querySelectorAll('#ordersCardsV360 > *, .orders-cards-v360 > *')];
  }
  function cleanupCardReceiptButtons(){
    // v10144: لا نترك أي زر إيصال قديم داخل الكرت؛ نعيد بناء زر واحد فقط مثبت.
    receiptCardRoots().forEach(card=>{
      const buttons=[...card.querySelectorAll('button')].filter(isReceiptButton);
      buttons.forEach(btn=>btn.remove());
    });
  }
  function attachReceiptButtons(){
    cleanupCardReceiptButtons();
    receiptCardRoots().forEach(card=>{
      const no=selectedNoFromCard(card);
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='orders-card-receipt-main-v10144';
      btn.textContent='عرض الإيصال';
      btn.style.cssText='display:block;width:100%;margin-top:10px;background:#0A4B3C;color:#fff;border:0;border-radius:10px;padding:10px 12px;font-weight:900;cursor:pointer';
      btn.onclick=async(e)=>{ e.preventDefault(); e.stopPropagation(); let rec=receiptCache.get(no); if(!rec){ const r=await fetchRecord(no).catch(err=>(notify('تعذر قراءة الإيصال:\n'+(err.message||err),'err'),null)); rec=r&&r.data&&findReceipt(r.data); if(rec) receiptCache.set(no,rec); } openReceipt(rec); };
      const host=card.querySelector('.order-actions-v360,.row-actions,.actions')||card;
      if(host!==card) host.insertAdjacentElement('afterend',btn); else card.appendChild(btn);
    });
  }
  function installReceiptDedupeObserver(){
    if(window.__ordersReceiptDedupeObserverV10144) return;
    window.__ordersReceiptDedupeObserverV10144=true;
    let timer=null;
    const run=()=>{ clearTimeout(timer); timer=setTimeout(()=>{ try{ cleanupInventoryCostFields(); attachReceiptButtons(); patchOrderWhatsappButtons(); }catch(_){ } },180); };
    const mo=new MutationObserver(run);
    mo.observe(document.body,{childList:true,subtree:true});
  }

  function patchRender(){
    if(window.__ordersRenderPatchV10143) return;
    const old=window.renderOrdersV233;
    if(typeof old==='function'){
      window.renderOrdersV233=function(){ const r=old.apply(this,arguments); setTimeout(()=>{ cleanupInventoryCostFields(); cleanupCardReceiptButtons(); attachReceiptButtons(); patchOrderWhatsappButtons(); injectOrderHistoryIntoOpenModalsV10179(); },100); return r; };
      window.__ordersRenderPatchV10143=true;
    }
  }

  function modalOrderNoV10179(root){
    const txt=S(root&&root.textContent);
    const m=txt.match(/ORD\s*[-_]?\s*\d+/i);
    return m ? normalizeNo(m[0]) : '';
  }
  async function injectOrderHistoryIntoOpenModalsV10179(){
    try{
      ensureHistoryStyleV10179();
      const roots=[...document.querySelectorAll('body > div, .smart-modal-v129, .smart-modal-backdrop, .modal, [role="dialog"]')];
      for(const root of roots){
        const txt=S(root.textContent);
        if(!/عرض\s*الأوردر|عرض\s*الاوردر|سجل\s*التعديلات/i.test(txt)) continue;
        const no=modalOrderNoV10179(root); if(!no) continue;
        let row=rowByNo(no);
        let rec=null;
        if(!row){ rec=await fetchRecord(no).catch(()=>null); row=rec&&Object.assign({}, rec.data||{}, {__flow:rec.flow||{}, order_no:rec.order_no}); }
        const hist=orderHistoryFromV10179(row, rec);
        const current=root.querySelector('.orders-history-list-v10179');
        const html='<div class="orders-history-list-v10179" data-order-no="'+escHtmlV10179(no)+'">'+historyHtmlV10179(hist)+'</div>';
        if(current){ current.outerHTML=html; continue; }
        const titles=[...root.querySelectorAll('h1,h2,h3,h4,b,strong,div')].filter(x=>/^سجل\s*التعديلات$/i.test(S(x.textContent)));
        if(titles.length){
          const t=titles[titles.length-1];
          const host=t.parentElement || t;
          host.insertAdjacentHTML('beforeend', html);
        }else{
          const card=root.querySelector('.smart-modal-body-v129,.smart-invoice-body,.modal-body') || root;
          card.insertAdjacentHTML('beforeend','<div style="margin-top:14px"><h3>سجل التعديلات</h3>'+html+'</div>');
        }
      }
    }catch(e){ console.warn('orders history inject failed',e); }
  }
  function installHistoryObserverV10179(){
    if(window.__ordersHistoryObserverV10179) return; window.__ordersHistoryObserverV10179=true;
    let t=null;
    const run=()=>{ clearTimeout(t); t=setTimeout(injectOrderHistoryIntoOpenModalsV10179,250); };
    new MutationObserver(run).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('click',()=>setTimeout(injectOrderHistoryIntoOpenModalsV10179,350),true);
  }

  async function boot(){
    removeExtraReceiptInputs(); bindFormReceipt(); cleanupInventoryCostFields(); installSave(); patchRender(); installReceiptDedupeObserver(); installHistoryObserverV10179();
    await fetchAllRows().catch(()=>[]);
    try{ if(typeof window.renderOrdersV233==='function') window.renderOrdersV233(); }catch(_){ }
    attachReceiptButtons(); patchOrderWhatsappButtons(); cleanupInventoryCostFields(); injectOrderHistoryIntoOpenModalsV10179();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,900),{once:true});
  else setTimeout(boot,900);
  window.addEventListener('load',()=>setTimeout(boot,1400),{once:true});
  setInterval(()=>{ try{ bindFormReceipt(); cleanupInventoryCostFields(); installSave(); patchRender(); cleanupCardReceiptButtons(); attachReceiptButtons(); patchOrderWhatsappButtons(); }catch(_){ } },1300);
  console.log('Loaded '+VERSION);
})();

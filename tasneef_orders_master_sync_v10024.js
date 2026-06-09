/* Tasneef Orders Master Sync v10024
   مصدر واحد للأوردرات: Supabase orders_shared فقط.
   لا يرفع كل اللوكل فوق السيرفر؛ يحفظ الأوردر المعدل فقط.
   يعرض فلتر تخص العميل/الجمعية ويجعل الأحدث أولاً.
*/
(function(){
  'use strict';
  if(window.__tasneefOrdersMasterSyncV10024) return;
  window.__tasneefOrdersMasterSyncV10024 = true;

  const SUPABASE_URL = 'https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const STORE_KEY = 'tasneef_orders_v233';
  const FLOW_KEY = 'tasneef_orders_workflow_v8';
  const TABLE = 'orders_shared';
  const PAGE_SIZE = 15;
  let page = 1;
  let saving = false;
  let lastLoad = 0;

  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const esc = v => S(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const num = v => { const n=Number(S(v).replace(/,/g,'').replace(/[^0-9.\-]/g,'')); return Number.isFinite(n)?n:0; };
  const money = v => num(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ر.س';
  const fallbackHeaders = ['رقم الطلب','رقم الطلب بالجروب','تاريخ الطلب','وقت الطلب','مرسل الطلب','المشروع','نوع العقار','رقم الشقة','اسم العميل','رقم العميل','المنفذ','التفاصيل','ملاحظات','تخص','تاريخ التنفيذ','كيفية التنفيذ','حالة التنفيذ','تقرير','السعر (شامل الضريبة)','الضريبة 15%','السعر قبل الضريبة','التكلفة','الربح','حالة السداد','رقم الفاتورة','فوترة بالسيستم'];
  const seed = () => window.TASNEEF_ORDERS_SEED || {headers:fallbackHeaders,orders:[]};
  const headers = () => ((seed().headers && seed().headers.length) ? seed().headers : fallbackHeaders).filter(h => S(h).indexOf('__excel_col_') !== 0);
  const H = i => headers()[i] || fallbackHeaders[i] || ('field_'+i);
  const field = (row, idx) => row ? (row[H(idx)] ?? '') : '';
  const setField = (row, idx, value) => { row[H(idx)] = value; };
  const normalizeNo = v => S(v).replace(/\s+/g,'').toUpperCase();
  const orderNoForRow = row => normalizeNo(row && (row[H(0)] || row.order_no || row.orderNo || row['رقم الطلب / النظام'] || row['رقم النظام'] || row.id));
  const nowIso = () => new Date().toISOString();

  function readRows(){ try{ const r=JSON.parse(localStorage.getItem(STORE_KEY)||'[]'); return Array.isArray(r)?r:[]; }catch(_){ return []; } }
  function writeRows(rows){ localStorage.setItem(STORE_KEY, JSON.stringify(Array.isArray(rows)?rows:[])); }
  function readFlow(){ try{ const f=JSON.parse(localStorage.getItem(FLOW_KEY)||'{}'); return f && typeof f==='object'?f:{}; }catch(_){ return {}; } }
  function writeFlow(flow){ localStorage.setItem(FLOW_KEY, JSON.stringify(flow||{})); }

  function statusPay(row){
    const p=S(field(row,23) || row['حالة السداد'] || row.payment_status || row.finance_status || row['المالية']);
    if(/آجل|أجل|اجل/i.test(p)) return 'آجل';
    if(/تم\s*السداد|مسدد|مدفوع|تم\s*الدفع|سداد/i.test(p)) return 'تم السداد';
    return p;
  }
  function concern(row){ return S(field(row,13) || row['تخص'] || row.concern || row.belongs_to); }
  function concernNormalized(row){
    const c=concern(row).replace(/\s+/g,' ');
    if(/عميل|العميل/i.test(c)) return 'client';
    if(/جمعية|الجمعية|جميعة|الجميعة|اتحاد/i.test(c)) return 'association';
    return '';
  }
  function dateKey(row){
    const raw=S(field(row,2)||row.order_date||row.created_at||row.updated_at);
    let m=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); if(m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    m=raw.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/); if(m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
    return '';
  }
  function orderNumberValue(row){ const m=orderNoForRow(row).match(/(\d+)/g); return m && m.length ? Number(m[m.length-1])||0 : 0; }
  function sortRowsWithIndex(rows){
    return (rows||[]).map((r,i)=>({r,i})).sort((a,b)=>{
      const ma=num(a.r.__tasneef_master_rank), mb=num(b.r.__tasneef_master_rank);
      if(ma || mb) return (ma||999999) - (mb||999999);
      const ua=S(a.r.__tasneef_updated_at||a.r.__server_updated_at||a.r.updated_at||'');
      const ub=S(b.r.__tasneef_updated_at||b.r.__server_updated_at||b.r.updated_at||'');
      if(ua||ub){ const c=ub.localeCompare(ua); if(c) return c; }
      const na=orderNumberValue(a.r), nb=orderNumberValue(b.r); if(nb!==na) return nb-na;
      return dateKey(b.r).localeCompare(dateKey(a.r));
    });
  }

  async function restFetch(path, options){
    return fetch(SUPABASE_URL + path, Object.assign({
      cache:'no-store',
      headers:{apikey:SUPABASE_ANON_KEY, Authorization:'Bearer '+SUPABASE_ANON_KEY, Accept:'application/json', 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates'}
    }, options||{}));
  }
  function normalizeForServer(row){
    const r=Object.assign({}, row||{});
    const no=orderNoForRow(r);
    if(no){ r.order_no=r.order_no||no; r.orderNo=r.orderNo||no; if(!S(r[H(0)])) r[H(0)]=no; }
    const p=statusPay(r); if(p) r[H(23)]=p;
    r.__tasneef_updated_at = r.__tasneef_updated_at || nowIso();
    return r;
  }
  async function updateAppCache(rows){
    await restFetch('/rest/v1/app_local_store?on_conflict=key', {
      method:'POST',
      body:JSON.stringify({key:STORE_KEY,value_text:JSON.stringify(rows||[]),updated_at:nowIso(),updated_by:'MASTER_SYNC_V10024_CACHE'})
    }).catch(()=>{});
  }
  async function upsertOne(row, reason){
    const r=normalizeForServer(row);
    const no=orderNoForRow(r);
    if(!no) throw new Error('لا يوجد رقم أوردر للحفظ');
    const flow=readFlow();
    const payload={order_no:no,data:r,flow:flow[no]||{},updated_at:nowIso(),updated_by:'MASTER_SYNC_V10024_'+(reason||'save')};
    const res=await restFetch('/rest/v1/'+TABLE+'?on_conflict=order_no',{method:'POST',body:JSON.stringify(payload)});
    if(!res.ok) throw new Error('فشل حفظ الأوردر في السيرفر: '+(await res.text().catch(()=>res.status)));
    let rows=readRows();
    const idx=rows.findIndex(x=>orderNoForRow(x)===no);
    if(idx>=0) rows[idx]=r; else rows.unshift(r);
    rows=sortRowsWithIndex(rows).map(x=>x.r);
    writeRows(rows);
    await updateAppCache(rows);
    return r;
  }
  async function deleteOne(no){
    if(!no) return;
    await restFetch('/rest/v1/'+TABLE+'?order_no=eq.'+encodeURIComponent(no),{method:'DELETE'}).catch(()=>{});
    let rows=readRows().filter(r=>orderNoForRow(r)!==no);
    writeRows(rows); await updateAppCache(rows);
  }
  async function loadFromServer(force){
    if(saving) return;
    if(!force && Date.now()-lastLoad<45000) return;
    try{
      const res=await restFetch('/rest/v1/'+TABLE+'?select=order_no,data,flow,updated_at&order=updated_at.desc&limit=10000',{method:'GET'});
      if(!res.ok){ console.warn('orders load failed', res.status, await res.text().catch(()=>'')); return; }
      const arr=await res.json();
      const flow={}; const rows=[]; const seen=new Set();
      (Array.isArray(arr)?arr:[]).forEach(rec=>{
        const row=normalizeForServer(rec.data||{});
        const no=normalizeNo(rec.order_no||orderNoForRow(row));
        if(!no || seen.has(no)) return;
        row.__server_updated_at=rec.updated_at||'';
        rows.push(row); flow[no]=rec.flow||{}; seen.add(no);
      });
      if(rows.length){ const sorted=sortRowsWithIndex(rows).map(x=>x.r); writeRows(sorted); writeFlow(flow); await updateAppCache(sorted); lastLoad=Date.now(); renderOrders(); }
    }catch(e){ console.warn('orders load server v10024 failed',e); }
  }

  function ensureConcernFilter(){
    const filters = document.querySelector('#orders .orders-filters-v233') || document.querySelector('#orders .filters');
    if(!filters) return;
    if(!$('orderConcernFilterV10024')){
      const wrap=document.createElement('div');
      wrap.id='orderConcernFilterWrapV10024';
      wrap.innerHTML='<label>تخص</label><select id="orderConcernFilterV10024"><option value="">الكل</option><option value="client">تخص العميل</option><option value="association">تخص الجمعية</option></select>';
      const resetBtn = filters.querySelector('button');
      if(resetBtn) filters.insertBefore(wrap, resetBtn); else filters.appendChild(wrap);
      $('orderConcernFilterV10024').addEventListener('change',()=>{page=1;renderOrders();});
    }
  }
  function passFilters(row){
    const q=S($('orderSearchV233')&&$('orderSearchV233').value).toLowerCase();
    const project=S($('orderProjectFilterV233')&&$('orderProjectFilterV233').value);
    const exec=S($('orderExecutorFilterV233')&&$('orderExecutorFilterV233').value);
    const sender=S($('orderSenderFilterV233')&&$('orderSenderFilterV233').value);
    const status=S($('orderStatusFilterV233')&&$('orderStatusFilterV233').value);
    const pay=S($('orderPaymentFilterV233')&&$('orderPaymentFilterV233').value);
    const bill=S($('orderBillingFilterV233')&&$('orderBillingFilterV233').value);
    const concernFilter=S($('orderConcernFilterV10024')&&$('orderConcernFilterV10024').value);
    const from=S($('orderFromDateV233')&&$('orderFromDateV233').value), to=S($('orderToDateV233')&&$('orderToDateV233').value);
    if(project && S(field(row,5))!==project) return false;
    if(exec && S(field(row,10))!==exec) return false;
    if(sender && S(field(row,4))!==sender) return false;
    if(status && S(field(row,16))!==status) return false;
    if(pay){ const p=statusPay(row); if(/آجل|أجل|اجل/.test(pay)){ if(p!=='آجل') return false; } else if(S(field(row,23))!==pay && p!==pay) return false; }
    if(bill && S(field(row,25))!==bill) return false;
    if(concernFilter && concernNormalized(row)!==concernFilter) return false;
    const d=dateKey(row); if(from && d && d<from) return false; if(to && d && d>to) return false;
    if(q){ const hay=[field(row,0),field(row,1),field(row,4),field(row,5),field(row,8),field(row,9),field(row,10),field(row,11),field(row,13),field(row,16),field(row,23),field(row,24)].map(S).join(' ').toLowerCase(); if(!hay.includes(q)) return false; }
    return true;
  }
  function style(){
    if($('ordersMasterStyleV10024')) return;
    const st=document.createElement('style'); st.id='ordersMasterStyleV10024';
    st.textContent='.orders-cards-v360{display:grid;grid-template-columns:repeat(auto-fill,minmax(315px,1fr));gap:12px;margin-top:12px}.order-card-v10024{background:#fff;border:1px solid var(--line,#dce6e2);border-radius:18px;padding:14px;box-shadow:0 8px 22px rgba(10,64,51,.06);display:grid;gap:10px}.order-card-v10024.done{border-inline-start:5px solid #137a4b}.order-card-v10024.due{border-inline-start:5px solid #9a6b00}.order-card-v10024.cancel{border-inline-start:5px solid #b83232}.order-card-v10024 h3{margin:0;color:var(--brand,#0A4033)}.order-head-v10024{display:flex;justify-content:space-between;gap:8px}.order-head-v10024 span,.chip-v10024{border-radius:999px;padding:5px 9px;font-size:12px;font-weight:900;background:#eef6f3;color:#0A4033;border:1px solid #d8e8e2}.chips-v10024{display:flex;gap:6px;flex-wrap:wrap}.chip-v10024.finance{background:#fff5da;color:#8a6700}.chip-v10024.bad{background:#fde8e8;color:#9d2222}.meta-v10024{display:grid;grid-template-columns:1fr 1fr;gap:7px}.meta-v10024 div{background:#f8fbfa;border:1px solid #edf1ef;border-radius:12px;padding:8px}.meta-v10024 small{display:block;color:#60706a;font-size:11px}.meta-v10024 strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.details-v10024{background:#fbfdfc;border:1px dashed #d8e8e2;border-radius:12px;padding:9px;line-height:1.7}.actions-v10024{display:flex;gap:7px;flex-wrap:wrap}.actions-v10024 button{padding:8px 11px;border-radius:10px;font-size:12px}.orders-pager-v360{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;background:#f8fbfa;border:1px solid var(--line,#dce6e2);border-radius:14px;padding:10px}.empty-v10024{grid-column:1/-1;background:#fff;border:1px dashed #b9d8ca;border-radius:16px;padding:22px;text-align:center;color:#60706a}#orderConcernFilterWrapV10024{min-width:150px}';
    document.head.appendChild(st);
  }
  function cardClass(row){ const st=S(field(row,16)), p=statusPay(row); if(/لم ينفذ|ملغي|إلغاء|الغاء/i.test(st)) return 'cancel'; if(p==='آجل'||/جزئي/i.test(p)) return 'due'; if(/تم التنفيذ/i.test(st)) return 'done'; return ''; }
  function card(row, idx){ const cls=cardClass(row), price=field(row,18); return '<article class="order-card-v10024 '+cls+'"><div class="order-head-v10024"><div><h3>'+esc(field(row,0)||'-')+'</h3><small>رقم القروب: '+esc(field(row,1)||'-')+' | '+esc(field(row,2)||'-')+'</small></div><span>'+esc(field(row,5)||'-')+'</span></div><div class="chips-v10024"><b class="chip-v10024 '+(cls==='cancel'?'bad':'')+'">التشغيل: '+esc(field(row,16)||'-')+'</b><b class="chip-v10024 '+(cls==='due'?'finance':'')+'">السداد: '+esc(statusPay(row)||'-')+'</b><b class="chip-v10024">تخص: '+esc(concern(row)||'-')+'</b></div><div class="meta-v10024"><div><small>العميل</small><strong>'+esc(field(row,8)||'-')+'</strong></div><div><small>الجوال</small><strong>'+esc(field(row,9)||'-')+'</strong></div><div><small>المنفذ</small><strong>'+esc(field(row,10)||'-')+'</strong></div><div><small>مرسل الطلب</small><strong>'+esc(field(row,4)||'-')+'</strong></div><div><small>السعر شامل الضريبة</small><strong>'+esc(price!==''?money(price):'-')+'</strong></div><div><small>الفاتورة</small><strong>'+esc(field(row,24)||'-')+'</strong></div></div><p class="details-v10024">'+(esc(S(field(row,11)).slice(0,180))||'لا توجد تفاصيل')+'</p><div class="actions-v10024"><button class="light" onclick="showOrderDetailsV10024('+idx+')">عرض</button><button onclick="editOrderV233('+idx+')">تعديل</button><button class="light" onclick="sendOrderWhatsappV233('+idx+')">واتساب</button><button class="danger" onclick="deleteOrderV233('+idx+')">حذف</button></div></article>'; }
  function renderSummary(rows){
    const done=rows.filter(r=>/تم التنفيذ/i.test(S(field(r,16)))).length;
    const dueRows=rows.filter(r=>statusPay(r)==='آجل'||/جزئي/i.test(statusPay(r))||(!statusPay(r)&&num(field(r,18))>0));
    const paidRows=rows.filter(r=>statusPay(r)==='تم السداد');
    const notDone=rows.filter(r=>/لم ينفذ|ملغي|إلغاء|الغاء/i.test(S(field(r,16)))).length;
    const revenue=rows.reduce((a,r)=>a+num(field(r,18)),0), vat=rows.reduce((a,r)=>a+num(field(r,19)),0), cost=rows.reduce((a,r)=>a+num(field(r,21)),0), profit=rows.reduce((a,r)=>a+num(field(r,22)),0);
    const dueTotal=dueRows.reduce((a,r)=>a+num(field(r,18)),0), paidTotal=paidRows.reduce((a,r)=>a+num(field(r,18)),0);
    if($('ordersTotalKpiV233')) $('ordersTotalKpiV233').textContent=rows.length;
    if($('ordersDoneKpiV233')) $('ordersDoneKpiV233').textContent=done;
    if($('ordersDueKpiV233')) $('ordersDueKpiV233').textContent=dueRows.length;
    if($('ordersProfitKpiV233')) $('ordersProfitKpiV233').textContent=money(profit).replace(' ر.س','');
    if($('ordersSummaryV233')) $('ordersSummaryV233').innerHTML=[['إجمالي الإيرادات شامل الضريبة',money(revenue)],['إجمالي الضريبة 15%',money(vat)],['إجمالي التكلفة',money(cost)],['صافي الربح',money(profit)],['تم السداد',paidRows.length+' أوردر - '+money(paidTotal)],['آجل / غير مسدد',dueRows.length+' أوردر - '+money(dueTotal)],['لم ينفذ / ملغي',notDone+' أوردر']].map(x=>'<div class="summary-item"><b>'+esc(x[0])+'</b><br>'+esc(x[1])+'</div>').join('');
  }
  function renderOrders(){
    style(); ensureConcernFilter();
    const host=$('ordersCardsV360') || $('ordersCardsV6'); if(!host) return;
    if($('ordersCardsV6') && $('ordersCardsV6')!==host) $('ordersCardsV6').style.display='none';
    const all=readRows(); const sorted=sortRowsWithIndex(all); const filtered=sorted.filter(x=>passFilters(x.r));
    const maxPage=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)); page=Math.min(Math.max(1,page),maxPage);
    const slice=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
    host.innerHTML=slice.map(x=>card(x.r,x.i)).join('') || '<div class="empty-v10024">لا توجد أوردرات حسب الفلتر الحالي</div>';
    const pager=$('ordersPagerV360') || $('ordersPagerV6'); if(pager) pager.innerHTML='<button class="light" '+(page<=1?'disabled':'')+' onclick="changeOrdersPageV10024(-1)">السابق</button><b>صفحة '+page+' من '+maxPage+' — النتائج '+filtered.length+'</b><button class="light" '+(page>=maxPage?'disabled':'')+' onclick="changeOrdersPageV10024(1)">التالي</button>';
    renderSummary(filtered.map(x=>x.r));
  }
  window.changeOrdersPageV10024=delta=>{page=Math.max(1,page+Number(delta||0));renderOrders();};
  window.showOrderDetailsV10024=function(idx){ const row=readRows()[idx]; if(!row) return; const labels=[['رقم الطلب',0],['رقم القروب',1],['التاريخ',2],['مرسل الطلب',4],['المشروع',5],['نوع العقار',6],['رقم الشقة',7],['العميل',8],['الجوال',9],['المنفذ',10],['التفاصيل',11],['ملاحظات',12],['تخص',13],['تاريخ التنفيذ',14],['كيفية التنفيذ',15],['حالة التنفيذ',16],['السعر شامل الضريبة',18],['الضريبة',19],['قبل الضريبة',20],['التكلفة',21],['الربح',22],['حالة السداد',23],['رقم الفاتورة',24],['الفوترة',25]]; const body=labels.map(x=>{let val=field(row,x[1]); if([18,19,20,21,22].includes(x[1])&&val!==''&&val!=null) val=money(val); return '<div><small>'+esc(x[0])+'</small><strong>'+esc(val||'-')+'</strong></div>';}).join(''); document.body.insertAdjacentHTML('beforeend','<div class="modal-backdrop" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:99999;display:grid;place-items:center;padding:18px"><div class="card" style="width:min(920px,96vw);max-height:92vh;overflow:auto"><div class="fin-actions" style="justify-content:space-between"><h2>عرض الأوردر: '+esc(field(row,0)||'-')+'</h2><button class="danger" onclick="this.closest(&quot;.modal-backdrop&quot;).remove()">إغلاق</button></div><div class="meta-v10024" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-top:12px">'+body+'</div></div></div>'); };

  function findSavedRow(beforeNos, editIdx, noBefore){
    const rows=readRows(); const noAfter=normalizeNo($('orderNoV233')&&$('orderNoV233').value);
    let no=noAfter||noBefore;
    if(no){ const r=rows.find(x=>orderNoForRow(x)===no); if(r) return r; }
    if(Number.isInteger(editIdx) && rows[editIdx]) return rows[editIdx];
    const created=rows.find(r=>!beforeNos.has(orderNoForRow(r))); if(created) return created;
    return sortRowsWithIndex(rows)[0]?.r || null;
  }
  function wrapSaveDelete(){
    const oldSave=window.saveOrderV233;
    if(typeof oldSave==='function' && !oldSave.__masterV10024){
      const wrapped=async function(){
        const beforeRows=readRows(); const beforeNos=new Set(beforeRows.map(orderNoForRow));
        const editIdxRaw=S($('orderEditIndexV233')&&$('orderEditIndexV233').value); const editIdx=editIdxRaw!==''?Number(editIdxRaw):NaN;
        const noBefore=Number.isInteger(editIdx)&&beforeRows[editIdx]?orderNoForRow(beforeRows[editIdx]):normalizeNo($('orderNoV233')&&$('orderNoV233').value);
        const ret=oldSave.apply(this,arguments);
        setTimeout(async()=>{
          try{
            saving=true;
            let row=findSavedRow(beforeNos, Number.isInteger(editIdx)?editIdx:null, noBefore);
            if(!row) throw new Error('لم أجد الأوردر بعد الحفظ');
            row.__tasneef_master_rank = 0;
            row.__tasneef_updated_at = nowIso();
            await upsertOne(row,'save_order');
            renderOrders();
            if(typeof msg==='function') msg('تم تثبيت الأوردر في السيرفر بنجاح');
          }catch(e){ alert('لم يتم تثبيت الأوردر في السيرفر: '+(e.message||e)); if(typeof msg==='function') msg(e.message||String(e),'err'); }
          finally{ saving=false; }
        },180);
        return ret;
      };
      wrapped.__masterV10024=true; window.saveOrderV233=wrapped;
    }
    const oldDel=window.deleteOrderV233;
    if(typeof oldDel==='function' && !oldDel.__masterV10024){
      const wrapped=function(idx){ const rows=readRows(); const no=rows[idx]?orderNoForRow(rows[idx]):''; const ret=oldDel.apply(this,arguments); setTimeout(()=>deleteOne(no).then(()=>renderOrders()),180); return ret; };
      wrapped.__masterV10024=true; window.deleteOrderV233=wrapped;
    }
    ['ordersWorkflowCreateV8','ordersWorkflowInvoiceV8','ordersWorkflowApproveV8'].forEach(name=>{
      const old=window[name]; if(typeof old!=='function'||old.__masterV10024) return;
      const wrapped=function(){ const ret=old.apply(this,arguments); setTimeout(()=>{ const rows=readRows(); updateAppCache(sortRowsWithIndex(rows).map(x=>x.r)); renderOrders(); },200); return ret; };
      wrapped.__masterV10024=true; window[name]=wrapped;
    });
  }
  function bindFilters(){ ['orderSearchV233','orderProjectFilterV233','orderExecutorFilterV233','orderSenderFilterV233','orderStatusFilterV233','orderPaymentFilterV233','orderBillingFilterV233','orderFromDateV233','orderToDateV233'].forEach(id=>{ const el=$(id); if(el&&!el.__masterV10024){ el.__masterV10024=true; el.addEventListener('input',()=>{page=1;renderOrders();}); el.addEventListener('change',()=>{page=1;renderOrders();}); }}); }
  function boot(){ wrapSaveDelete(); bindFilters(); window.renderOrdersV233=()=>renderOrders(); loadFromServer(true).then(()=>{ensureConcernFilter();renderOrders();}); setTimeout(()=>{wrapSaveDelete();bindFilters();ensureConcernFilter();renderOrders();},1200); setInterval(()=>{wrapSaveDelete();bindFilters();loadFromServer(false);},60000); }
  document.addEventListener('click',e=>{ const btn=e.target&&e.target.closest&&e.target.closest('button'); const txt=S(btn&&btn.textContent); if(txt==='تحديث'||txt==='تحديث البيانات') setTimeout(()=>loadFromServer(true),100); },true);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.tasneefOrdersMasterSyncV10024={load:()=>loadFromServer(true),render:renderOrders,upsert:upsertOne};
})();

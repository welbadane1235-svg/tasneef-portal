/* Tasneef Orders Final Stable v10018
   مصدر واحد للأوردرات: Supabase orders_shared.
   يحل عدم ظهور الأوردرات للجميع + يثبت ملخص الآجل/السداد حسب الحالات العربية.
*/
(function(){
  'use strict';
  if(window.__tasneefOrdersFinalStableV10018) return;
  window.__tasneefOrdersFinalStableV10018 = true;

  const SUPABASE_URL = 'https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const TABLE = 'orders_shared';
  const STORE = 'tasneef_orders_v233';
  const FLOW = 'tasneef_orders_workflow_v8';
  const POLL_MS = 45000;
  const S = v => String(v ?? '').trim();
  const $ = id => document.getElementById(id);
  const fallbackHeaders = ['رقم الطلب','رقم الطلب بالجروب','تاريخ الطلب','وقت الطلب','مرسل الطلب','المشروع','نوع العقار','رقم الشقة','اسم العميل','رقم العميل','المنفذ','التفاصيل','ملاحظات','تخص','تاريخ التنفيذ','كيفية التنفيذ','حالة التنفيذ','تقرير','السعر (شامل الضريبة)','الضريبة 15%','السعر قبل الضريبة','التكلفة','الربح','حالة السداد','رقم الفاتورة','فوترة بالسيستم'];
  const headers = () => ((window.TASNEEF_ORDERS_SEED && window.TASNEEF_ORDERS_SEED.headers) || fallbackHeaders).filter(h => String(h||'').indexOf('__excel_col_') !== 0);
  const H = i => headers()[i] || fallbackHeaders[i] || ('field_'+i);
  const field = (row, idx) => row ? (row[H(idx)] ?? row[fallbackHeaders[idx]] ?? '') : '';
  const setField = (row, idx, val) => { row[H(idx)] = val; if(H(idx)!==fallbackHeaders[idx]) row[fallbackHeaders[idx]] = val; };
  const num = v => { const n = Number(S(v).replace(/,/g,'').replace(/[^0-9.\-]/g,'')); return Number.isFinite(n) ? n : 0; };
  const money = v => num(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ر.س';
  const noNorm = v => S(v).replace(/\s+/g,'').toUpperCase();
  const orderNo = row => noNorm(row && (field(row,0) || row.order_no || row.orderNo || row['رقم النظام'] || row['رقم الطلب / النظام'] || row.id));
  const esc = v => S(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));

  let busy = false;
  let lastLoad = 0;

  function normPay(v){
    const t = S(v).replace(/\s+/g,' ');
    if(!t) return '';
    if(/آجل|أجل|اجل/i.test(t)) return 'آجل';
    if(/تم\s*السداد|مسدد|مدفوع|تم\s*الدفع/i.test(t)) return 'تم السداد';
    if(/ملغي|الغاء|إلغاء/i.test(t)) return 'ملغي';
    return t;
  }
  function isDue(row){ return normPay(field(row,23) || row['حالة السداد'] || row['المالية']) === 'آجل'; }
  function isPaid(row){ return normPay(field(row,23) || row['حالة السداد'] || row['المالية']) === 'تم السداد'; }
  function isNotDone(row){ const s=S(field(row,16)); return /لم\s*ينفذ|ملغي|الغاء|إلغاء/i.test(s); }
  function isDone(row){ return /تم\s*التنفيذ/i.test(S(field(row,16))); }

  function readRows(){ try{ const a=JSON.parse(localStorage.getItem(STORE)||'[]'); return Array.isArray(a)?a:[]; }catch(_){ return []; } }
  function writeRows(rows){ localStorage.setItem(STORE, JSON.stringify(rows || [])); }
  function readFlow(){ try{ const f=JSON.parse(localStorage.getItem(FLOW)||'{}'); return f && typeof f === 'object' ? f : {}; }catch(_){ return {}; } }
  function writeFlow(f){ localStorage.setItem(FLOW, JSON.stringify(f || {})); }

  async function rest(path, opt){
    const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, Object.assign({
      cache:'no-store',
      headers:{
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        Accept:'application/json',
        'Content-Type':'application/json',
        'Cache-Control':'no-cache'
      }
    }, opt || {}));
    if(!res.ok){ const txt=await res.text().catch(()=> ''); throw new Error('HTTP '+res.status+' '+txt.slice(0,220)); }
    if(res.status===204) return null;
    return res.json();
  }

  function normalizeRemoteRow(rec){
    const d = rec && rec.data && typeof rec.data === 'object' ? Object.assign({}, rec.data) : {};
    const no = noNorm(rec && (rec.order_no || d.order_no || d.orderNo || d['رقم الطلب'] || d['رقم الطلب / النظام'] || d['رقم النظام']));
    if(no){ setField(d,0, field(d,0) || no); d.order_no = d.order_no || no; d.orderNo = d.orderNo || no; d['رقم الطلب / النظام'] = d['رقم الطلب / النظام'] || no; }
    const p = normPay(field(d,23) || d['حالة السداد'] || d['المالية']);
    if(p){ setField(d,23,p); d['حالة السداد']=p; if(!S(d['المالية'])) d['المالية']=p; }
    const withVat = num(field(d,18) || d['السعر شامل الضريبة'] || d['الإجمالي شامل الضريبة'] || d.total || d.amount);
    if(withVat){ setField(d,18,String(withVat)); d['السعر (شامل الضريبة)']=String(withVat); d.total=withVat; d.amount=withVat; }
    const vat = num(field(d,19) || d['15% الضريبة'] || d['الضريبة 15%']); if(vat){ setField(d,19,String(vat)); d['15% الضريبة']=String(vat); }
    const before = num(field(d,20) || d['السعر قبل الضريبة']); if(before){ setField(d,20,String(before)); }
    const cost = num(field(d,21) || d['التكلفة']); if(cost || S(field(d,21))){ setField(d,21,String(cost)); }
    const profit = num(field(d,22) || d['الربح']); if(profit || S(field(d,22))){ setField(d,22,String(profit)); }
    return {no, data:d, flow:(rec && rec.flow && typeof rec.flow==='object')?rec.flow:{}};
  }

  async function loadRemote(force){
    const now = Date.now();
    if(busy) return false;
    if(!force && now-lastLoad < 15000) return true;
    busy = true;
    try{
      const rows = await rest(TABLE + '?select=order_no,data,flow,updated_at&order=order_no.asc&limit=10000');
      const out=[], flow={}, seen=new Set();
      (rows||[]).forEach(rec=>{ const x=normalizeRemoteRow(rec); if(!x.no || seen.has(x.no)) return; seen.add(x.no); out.push(x.data); flow[x.no]=x.flow; });
      writeRows(out); writeFlow(flow); lastLoad=Date.now();
      console.info('[Tasneef Orders Final Stable v10018] loaded', out.length, 'orders');
      renderAll();
      return true;
    }catch(e){ console.error('[Tasneef Orders Final Stable v10018] load failed', e); return false; }
    finally{ busy=false; }
  }

  async function saveRemote(){
    const rows = readRows(); const flow = readFlow();
    const payload = rows.map(r=>{ const no=orderNo(r); return no ? {order_no:no,data:r,flow:flow[no]||{},updated_at:new Date().toISOString(),updated_by:'admin_ui_v10018'} : null; }).filter(Boolean);
    if(!payload.length) return false;
    try{
      await fetch(SUPABASE_URL + '/rest/v1/' + TABLE, {
        method:'POST',
        headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},
        body:JSON.stringify(payload)
      }).then(async r=>{ if(!r.ok) throw new Error(await r.text()); });
      return true;
    }catch(e){ console.error('[Tasneef Orders Final Stable v10018] save failed', e); return false; }
  }

  function dateForFilter(v){
    const s=S(v); let m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/); if(m) return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
    m=s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/); if(m) return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
    return '';
  }
  function filteredRows(){
    const q=S($('orderSearchV233')&&$('orderSearchV233').value).toLowerCase();
    const project=S($('orderProjectFilterV233')&&$('orderProjectFilterV233').value);
    const exec=S($('orderExecutorFilterV233')&&$('orderExecutorFilterV233').value);
    const sender=S($('orderSenderFilterV233')&&$('orderSenderFilterV233').value);
    const status=S($('orderStatusFilterV233')&&$('orderStatusFilterV233').value);
    const pay=S($('orderPaymentFilterV233')&&$('orderPaymentFilterV233').value);
    const bill=S($('orderBillingFilterV233')&&$('orderBillingFilterV233').value);
    const from=S($('orderFromDateV233')&&$('orderFromDateV233').value);
    const to=S($('orderToDateV233')&&$('orderToDateV233').value);
    return readRows().filter(r=>{
      if(project && S(field(r,5))!==project) return false;
      if(exec && S(field(r,10))!==exec) return false;
      if(sender && S(field(r,4))!==sender) return false;
      if(status && S(field(r,16))!==status) return false;
      if(pay && normPay(field(r,23))!==normPay(pay)) return false;
      if(bill && S(field(r,25))!==bill) return false;
      const d=dateForFilter(field(r,2)); if(from && d && d<from) return false; if(to && d && d>to) return false;
      if(q){ const hay=[0,1,4,5,8,9,10,11,23,24].map(i=>field(r,i)).join(' ').toLowerCase(); if(!hay.includes(q)) return false; }
      return true;
    });
  }

  function patchSummary(){
    const rows = filteredRows();
    const dueRows = rows.filter(isDue), paidRows = rows.filter(isPaid), doneRows = rows.filter(isDone), notDoneRows = rows.filter(isNotDone);
    const sum = (arr, idx) => arr.reduce((a,r)=>a+num(field(r,idx)),0);
    const revenue=sum(rows,18), vat=sum(rows,19), cost=sum(rows,21), profit=sum(rows,22), due=sum(dueRows,18), paid=sum(paidRows,18);
    if($('ordersTotalKpiV233')) $('ordersTotalKpiV233').textContent=rows.length;
    if($('ordersDoneKpiV233')) $('ordersDoneKpiV233').textContent=doneRows.length;
    if($('ordersDueKpiV233')) $('ordersDueKpiV233').textContent=dueRows.length;
    if($('ordersProfitKpiV233')) $('ordersProfitKpiV233').textContent=money(profit).replace(' ر.س','');
    const box=$('ordersSummaryV233');
    if(box){
      box.innerHTML=[
        ['إجمالي الإيرادات شامل الضريبة', money(revenue)],
        ['إجمالي الضريبة 15%', money(vat)],
        ['إجمالي التكلفة', money(cost)],
        ['صافي الربح', money(profit)],
        ['تم السداد', paidRows.length+' أوردر<br><b>'+money(paid)+'</b>'],
        ['آجل / غير مسدد', dueRows.length+' أوردر<br><b>'+money(due)+'</b>'],
        ['لم ينفذ / ملغي', notDoneRows.length+' أوردر']
      ].map(x=>'<div class="summary-item"><b>'+esc(x[0])+'</b><br>'+x[1]+'</div>').join('');
    }
  }

  function renderAll(){
    try{ if(typeof window.renderOrdersV233==='function') window.renderOrdersV233(); }catch(e){}
    setTimeout(patchSummary,80); setTimeout(patchSummary,450); setTimeout(patchSummary,1200);
  }

  function wrapSaves(){
    ['saveOrderV233','ordersWorkflowCreateV8','ordersWorkflowInvoiceV8','ordersWorkflowApproveV8'].forEach(name=>{
      const old=window[name]; if(typeof old!=='function' || old.__finalV10018) return;
      const w=function(){ const ret=old.apply(this,arguments); setTimeout(()=>saveRemote().then(()=>loadRemote(true)),250); return ret; };
      w.__finalV10018=true; window[name]=w;
    });
  }

  function install(){
    wrapSaves();
    document.addEventListener('click',e=>{
      const btn=e.target && e.target.closest && e.target.closest('button,.nav'); const txt=S(btn&&btn.textContent);
      if(txt==='الأوردرات' || txt==='تحديث' || txt==='تحديث البيانات') setTimeout(()=>loadRemote(true),120);
      setTimeout(patchSummary,250);
    },true);
    ['orderSearchV233','orderProjectFilterV233','orderPaymentFilterV233','orderStatusFilterV233','orderExecutorFilterV233','orderSenderFilterV233','orderBillingFilterV233','orderFromDateV233','orderToDateV233'].forEach(id=>{
      setInterval(()=>{ const el=$(id); if(el && !el.__finalV10018){ el.__finalV10018=true; el.addEventListener('input',()=>setTimeout(patchSummary,80)); el.addEventListener('change',()=>setTimeout(patchSummary,80)); } },1000);
    });
  }

  window.tasneefOrdersFinalStableV10018={load:()=>loadRemote(true),save:saveRemote,summary:patchSummary,rows:readRows};
  install();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>loadRemote(true)); else setTimeout(()=>loadRemote(true),300);
  setInterval(()=>{ wrapSaves(); patchSummary(); },1500);
  setInterval(()=>loadRemote(false),POLL_MS);
})();

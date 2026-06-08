/* Tasneef Orders Finance Summary Fix v10017
   إصلاح دائم لحساب الآجل/تم السداد في واجهة الأوردرات.
   يعمل فوق النسخة القديمة بدون حذف بيانات، ويصحح الحساب بعد كل تحديث/رندر.
*/
(function(){
  'use strict';
  if(window.__tasneefOrdersFinanceSummaryFixV10017) return;
  window.__tasneefOrdersFinanceSummaryFixV10017 = true;

  const STORE_KEY = 'tasneef_orders_v233';
  const FLOW_KEY = 'tasneef_orders_workflow_v8';
  const SUPABASE_URL = 'https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';

  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const esc = v => S(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const norm = v => S(v).replace(/\s+/g,' ');

  function num(v){
    const n = Number(S(v).replace(/[^0-9.\-]/g,''));
    return Number.isFinite(n) ? n : 0;
  }
  function money(v){
    return num(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ر.س';
  }
  function seedHeaders(){
    try { return ((window.TASNEEF_ORDERS_SEED||{}).headers||[]).filter(h => String(h||'').indexOf('__excel_col_') !== 0); }
    catch(_) { return []; }
  }
  function fieldByIndex(row, idx){
    const h = seedHeaders()[idx];
    return h ? row[h] : '';
  }
  function first(row, keys){
    for(const k of keys){
      if(k === '__IDX_0__') { const v=fieldByIndex(row,0); if(S(v)) return v; continue; }
      const v = row && row[k];
      if(S(v) !== '') return v;
    }
    return '';
  }
  function orderNo(row){ return norm(first(row,['رقم الطلب','رقم الطلب / النظام','رقم النظام','order_no','orderNo','number','id','__IDX_0__'])).replace(/\s+/g,'').toUpperCase(); }
  function priceWithVat(row){ return num(first(row,['السعر (شامل الضريبة)','السعر شامل الضريبة','الإجمالي شامل الضريبة','اجمالي شامل الضريبة','إجمالي الإيرادات شامل الضريبة','total_with_vat','with_vat','total','amount'])) || num(fieldByIndex(row,18)) || num(fieldByIndex(row,13)); }
  function beforeVat(row){ return num(first(row,['السعر قبل الضريبة','قبل الضريبة','price_before_vat','before_vat'])) || num(fieldByIndex(row,14)); }
  function vat(row){ return num(first(row,['15% الضريبة','الضريبة 15%','الضريبة','vat'])) || num(fieldByIndex(row,19)) || num(fieldByIndex(row,15)); }
  function cost(row){ return num(first(row,['التكلفة','cost'])) || num(fieldByIndex(row,21)) || num(fieldByIndex(row,17)); }
  function profit(row){ return num(first(row,['الربح','profit'])) || num(fieldByIndex(row,22)) || num(fieldByIndex(row,18)); }
  function project(row){ return norm(first(row,['المشروع','project'])) || norm(fieldByIndex(row,5)); }
  function executor(row){ return norm(first(row,['المنفذ','executor'])) || norm(fieldByIndex(row,10)); }
  function sender(row){ return norm(first(row,['مرسل الطلب','sender'])) || norm(fieldByIndex(row,4)); }
  function execStatus(row){ return norm(first(row,['حالة التنفيذ','التشغيل','status','execution_status'])) || norm(fieldByIndex(row,16)); }
  function payRaw(row){ return norm(first(row,['حالة السداد','المالية','payment_status','finance_status'])) || norm(fieldByIndex(row,23)); }
  function billStatus(row){ return norm(first(row,['الفوترة','حالة الفاتورة','invoice_status'])) || norm(fieldByIndex(row,25)); }
  function dateRaw(row){ return norm(first(row,['تاريخ الطلب','date','order_date'])) || norm(fieldByIndex(row,2)); }

  function payStatus(row){
    const p = payRaw(row);
    if(/آجل|أجل|اجل|جزئي/i.test(p)) return 'آجل';
    if(/تم\s*السداد|مسدد|مدفوع|تم\s*الدفع|سداد/i.test(p)) return 'تم السداد';
    if(/ملغي|إلغاء|الغاء/i.test(p)) return 'ملغي';
    return p;
  }
  function normalizeRowsInStorage(rows){
    let changed = false;
    const out = (rows||[]).map(r => {
      const row = Object.assign({}, r||{});
      const p = payStatus(row);
      if(p === 'آجل' || p === 'تم السداد' || p === 'ملغي'){
        if(row['حالة السداد'] !== p){ row['حالة السداد'] = p; changed = true; }
        if(!S(row['المالية']) || /آجل|أجل|اجل|تم\s*السداد|مسدد|مدفوع|سداد/i.test(S(row['المالية']))){
          if(row['المالية'] !== p){ row['المالية'] = p; changed = true; }
        }
      }
      const w = priceWithVat(row);
      if(w && S(row['السعر (شامل الضريبة)']) !== String(w)){ row['السعر (شامل الضريبة)'] = String(w); changed = true; }
      return row;
    });
    if(changed){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(out)); }catch(_){} }
    return out;
  }

  function readRows(){
    try{
      const rows = JSON.parse(localStorage.getItem(STORE_KEY)||'[]');
      return normalizeRowsInStorage(Array.isArray(rows) ? rows : []);
    }catch(_){ return []; }
  }
  function dateForFilter(v){
    const s = S(v);
    let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if(m) return m[3]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0');
    m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if(m) return m[1]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[3]).padStart(2,'0');
    return '';
  }
  function filteredRows(){
    const rows = readRows();
    const q = S($('orderSearchV233')?.value).toLowerCase();
    const fProject = S($('orderProjectFilterV233')?.value);
    const fExec = S($('orderExecutorFilterV233')?.value);
    const fSender = S($('orderSenderFilterV233')?.value);
    const fStatus = S($('orderStatusFilterV233')?.value);
    const fPay = S($('orderPaymentFilterV233')?.value);
    const fBill = S($('orderBillingFilterV233')?.value);
    const from = S($('orderFromDateV233')?.value);
    const to = S($('orderToDateV233')?.value);
    return rows.filter(row => {
      if(fProject && project(row) !== fProject) return false;
      if(fExec && executor(row) !== fExec) return false;
      if(fSender && sender(row) !== fSender) return false;
      if(fStatus && execStatus(row) !== fStatus) return false;
      if(fPay){
        const ps = payStatus(row);
        if(fPay === 'آجل' || fPay === 'أجل' || fPay === 'اجل') { if(ps !== 'آجل') return false; }
        else if(fPay === 'تم السداد') { if(ps !== 'تم السداد') return false; }
        else if(payRaw(row) !== fPay && ps !== fPay) return false;
      }
      if(fBill && billStatus(row) !== fBill) return false;
      const d = dateForFilter(dateRaw(row));
      if(from && d && d < from) return false;
      if(to && d && d > to) return false;
      if(q){
        const hay = [orderNo(row), project(row), executor(row), sender(row), first(row,['العميل','client']), first(row,['الجوال','phone']), first(row,['التفاصيل','details']), payRaw(row), execStatus(row)].join(' ').toLowerCase();
        if(!hay.includes(q)) return false;
      }
      return true;
    });
  }
  function renderFixedSummary(){
    const rows = filteredRows();
    if(!rows.length && !hasOrdersPage()) return;
    const doneRows = rows.filter(r => /تم\s*التنفيذ/i.test(execStatus(r)));
    const dueRows = rows.filter(r => payStatus(r) === 'آجل' || (!payStatus(r) && priceWithVat(r)>0));
    const paidRows = rows.filter(r => payStatus(r) === 'تم السداد');
    const notDoneRows = rows.filter(r => /لم\s*ينفذ|ملغي|إلغاء|الغاء/i.test(execStatus(r)) || payStatus(r)==='ملغي');
    const totalRevenue = rows.reduce((a,r)=>a+priceWithVat(r),0);
    const totalVat = rows.reduce((a,r)=>a+vat(r),0);
    const totalCost = rows.reduce((a,r)=>a+cost(r),0);
    const totalProfit = rows.reduce((a,r)=>a+profit(r),0);
    const dueTotal = dueRows.reduce((a,r)=>a+priceWithVat(r),0);
    const paidTotal = paidRows.reduce((a,r)=>a+priceWithVat(r),0);

    if($('ordersTotalKpiV233')) $('ordersTotalKpiV233').textContent = rows.length;
    if($('ordersDoneKpiV233')) $('ordersDoneKpiV233').textContent = doneRows.length;
    if($('ordersDueKpiV233')) $('ordersDueKpiV233').textContent = dueRows.length;
    if($('ordersProfitKpiV233')) $('ordersProfitKpiV233').textContent = money(totalProfit).replace(' ر.س','');

    const box = $('ordersSummaryV233');
    if(box){
      box.innerHTML = [
        ['إجمالي الإيرادات شامل الضريبة', money(totalRevenue)],
        ['إجمالي الضريبة 15%', money(totalVat)],
        ['إجمالي التكلفة', money(totalCost)],
        ['صافي الربح', money(totalProfit)],
        ['تم السداد', paidRows.length + ' أوردر<br><b style="color:#137a4b">' + money(paidTotal) + '</b>'],
        ['آجل / غير مسدد', dueRows.length + ' أوردر<br><b style="color:#9a6b00">' + money(dueTotal) + '</b>'],
        ['لم ينفذ / ملغي', notDoneRows.length + ' أوردر']
      ].map(x => '<div class="summary-item"><b>'+esc(x[0])+'</b><br>'+x[1]+'</div>').join('');
    }
    console.info('[Tasneef Orders Finance Summary Fix v10017]', {count: rows.length, due: dueRows.length, dueTotal, paid: paidRows.length, paidTotal});
  }
  function hasOrdersPage(){ return !!($('orders') || $('ordersSummaryV233') || $('ordersCardsV360') || $('ordersCardsV6')); }

  function wrapRender(){
    const old = window.renderOrdersV233;
    if(typeof old === 'function' && !old.__financeSummaryFixV10017){
      const wrapped = function(){
        const ret = old.apply(this, arguments);
        setTimeout(renderFixedSummary, 80);
        setTimeout(renderFixedSummary, 450);
        return ret;
      };
      wrapped.__financeSummaryFixV10017 = true;
      window.renderOrdersV233 = wrapped;
    }
  }
  function install(){
    wrapRender();
    if(hasOrdersPage()) setTimeout(renderFixedSummary, 600);
    document.addEventListener('click', e => {
      const btn = e.target && e.target.closest && e.target.closest('button');
      const txt = S(btn && btn.textContent);
      if(txt === 'تحديث' || txt === 'تحديث البيانات' || txt === 'الأوردرات') setTimeout(renderFixedSummary, 900);
    }, true);
    ['orderProjectFilterV233','orderExecutorFilterV233','orderSenderFilterV233','orderStatusFilterV233','orderPaymentFilterV233','orderBillingFilterV233','orderFromDateV233','orderToDateV233','orderSearchV233'].forEach(id=>{
      document.addEventListener('input', e => { if(e.target && e.target.id === id) setTimeout(renderFixedSummary, 80); }, true);
      document.addEventListener('change', e => { if(e.target && e.target.id === id) setTimeout(renderFixedSummary, 80); }, true);
    });
    setInterval(()=>{ wrapRender(); if(hasOrdersPage()) renderFixedSummary(); }, 5000);
  }

  window.tasneefOrdersFinanceSummaryFixV10017 = {run: renderFixedSummary, rows: filteredRows};
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();

/* Tasneef Orders Root Sync v10016
   حل جذري لظهور الأوردرات للجميع:
   - يقرأ مباشرة من Supabase REST جدول orders_shared ولا يعتمد على window.sb.
   - يكتب نسخة العرض في localStorage للواجهة القديمة tasneef_orders_v233.
   - يثبت حالات السداد آجل/أجل/اجل وتم السداد بصيغة موحدة للعرض بدون تغيير قاعدة البيانات.
   - يعيد التحميل عند فتح قسم الأوردرات أو الضغط على تحديث.
*/
(function(){
  'use strict';
  if (window.__tasneefOrdersRootSyncV10016) return;
  window.__tasneefOrdersRootSyncV10016 = true;

  const SUPABASE_URL = 'https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const STORE_KEY = 'tasneef_orders_v233';
  const FLOW_KEY = 'tasneef_orders_workflow_v8';
  const TABLE = 'orders_shared';
  const CACHE_MS = 20000;
  let loading = false;
  let lastLoadAt = 0;
  let lastCount = 0;

  const S = v => String(v ?? '').trim();
  const hasOrdersPage = () => !!(document.getElementById('orders') || document.getElementById('ordersCardsV360') || document.getElementById('ordersSummaryV233'));

  function normalizeNo(v){ return S(v).replace(/\s+/g,'').toUpperCase(); }

  function normalizePaymentStatus(v){
    const t = S(v).replace(/\s+/g,' ');
    if (!t) return '';
    if (/^(آجل|أجل|اجل)$/i.test(t) || /آجل|أجل|اجل/i.test(t)) return 'آجل';
    if (/تم\s*السداد|مسدد|مدفوع|تم\s*الدفع|سداد/i.test(t)) return 'تم السداد';
    if (/ملغي|إلغاء|الغاء/i.test(t)) return 'ملغي';
    return t;
  }

  function moneyNumber(v){
    const n = Number(S(v).replace(/[^0-9.\-]/g,''));
    return Number.isFinite(n) ? n : 0;
  }

  function normalizeOrderRecord(rec){
    const data = rec && rec.data && typeof rec.data === 'object' ? Object.assign({}, rec.data) : {};
    const no = normalizeNo(rec && (rec.order_no || data.order_no || data.orderNo || data['رقم الطلب'] || data['رقم الطلب / النظام'] || data['رقم النظام']));
    if (no) {
      data.order_no = data.order_no || no;
      data.orderNo = data.orderNo || no;
      data['رقم الطلب'] = data['رقم الطلب'] || no;
      data['رقم الطلب / النظام'] = data['رقم الطلب / النظام'] || no;
      data['رقم النظام'] = data['رقم النظام'] || no;
    }

    // توحيد حالة السداد للواجهة القديمة، بدون تعديل قاعدة البيانات
    const pay = normalizePaymentStatus(data['حالة السداد'] || data['المالية'] || data.payment_status || data.finance_status);
    if (pay) {
      data['حالة السداد'] = pay;
      if (!S(data['المالية'])) data['المالية'] = pay;
    }

    // توحيد حقول السعر حتى تقرأها كل النسخ القديمة والجديدة
    const before = moneyNumber(data['السعر قبل الضريبة'] || data.before_vat || data.price_before_vat);
    const vat = moneyNumber(data['15% الضريبة'] || data['الضريبة 15%'] || data.vat);
    const withVat = moneyNumber(data['السعر (شامل الضريبة)'] || data['السعر شامل الضريبة'] || data.with_vat || data.total_with_vat || data['الإجمالي شامل الضريبة']);
    if (withVat) {
      data['السعر (شامل الضريبة)'] = String(withVat);
      data['السعر شامل الضريبة'] = data['السعر شامل الضريبة'] || String(withVat);
      data['الإجمالي شامل الضريبة'] = data['الإجمالي شامل الضريبة'] || String(withVat);
      data.total = data.total || withVat;
      data.amount = data.amount || withVat;
    }
    if (before) data['السعر قبل الضريبة'] = String(before);
    if (vat) {
      data['15% الضريبة'] = String(vat);
      data['الضريبة 15%'] = data['الضريبة 15%'] || String(vat);
    }
    return { no, data, flow: (rec && rec.flow && typeof rec.flow === 'object') ? rec.flow : {} };
  }

  async function fetchSharedOrders(){
    const url = SUPABASE_URL + '/rest/v1/' + TABLE + '?select=order_no,data,flow,updated_at&order=updated_at.desc&limit=10000';
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        Accept: 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    if (!res.ok) {
      const text = await res.text().catch(()=> '');
      throw new Error('orders_shared HTTP ' + res.status + ' ' + text.slice(0,180));
    }
    return res.json();
  }

  function writeToLocal(records){
    const seen = new Set();
    const orders = [];
    const flow = {};
    (records || []).forEach(rec => {
      const o = normalizeOrderRecord(rec);
      if (!o.no || seen.has(o.no)) return;
      seen.add(o.no);
      orders.push(o.data);
      flow[o.no] = o.flow || {};
    });
    localStorage.setItem(STORE_KEY, JSON.stringify(orders));
    localStorage.setItem(FLOW_KEY, JSON.stringify(flow));
    localStorage.setItem('tasneef_orders_root_sync_last_count', String(orders.length));
    localStorage.setItem('tasneef_orders_root_sync_last_at', new Date().toISOString());
    lastCount = orders.length;
    return orders;
  }

  function renderOrdersNow(){
    try { if (typeof window.renderOrdersV233 === 'function') window.renderOrdersV233(); } catch(e){ console.warn('renderOrdersV233 failed', e); }
    try { if (typeof window.ordersWorkflowRenderMineV8 === 'function') window.ordersWorkflowRenderMineV8(); } catch(e){ console.warn('ordersWorkflowRenderMineV8 failed', e); }
    try { if (typeof window.renderOrdersCardsV360 === 'function') window.renderOrdersCardsV360(); } catch(e){ }
  }

  async function loadOrders(reason, force){
    const now = Date.now();
    if (loading) return false;
    if (!force && (now - lastLoadAt) < CACHE_MS) return true;
    loading = true;
    try {
      const remote = await fetchSharedOrders();
      const orders = writeToLocal(remote);
      lastLoadAt = Date.now();
      console.info('[Tasneef Orders Root Sync v10016] loaded', orders.length, 'orders', reason || '');
      renderOrdersNow();
      return true;
    } catch (e) {
      console.error('[Tasneef Orders Root Sync v10016] failed', e);
      return false;
    } finally {
      loading = false;
    }
  }

  function wrapRender(){
    const old = window.renderOrdersV233;
    if (typeof old !== 'function' || old.__tasneefOrdersRootSyncV10016) return;
    const wrapped = function(){
      try {
        const rows = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
        if (!Array.isArray(rows) || rows.length === 0) loadOrders('render-empty', true);
      } catch(_){ loadOrders('render-parse-error', true); }
      return old.apply(this, arguments);
    };
    wrapped.__tasneefOrdersRootSyncV10016 = true;
    window.renderOrdersV233 = wrapped;
  }

  function installListeners(){
    document.addEventListener('click', function(e){
      const btn = e.target && e.target.closest && e.target.closest('button');
      const txt = S(btn && btn.textContent);
      const nav = e.target && e.target.closest && e.target.closest('[onclick]');
      const oc = S(nav && nav.getAttribute('onclick'));
      if (txt === 'تحديث' || txt === 'تحديث البيانات' || /showPage\(['"]orders['"]/.test(oc) || txt === 'الأوردرات') {
        setTimeout(() => loadOrders('click-' + (txt || 'orders'), true), 80);
      }
    }, true);
  }

  function boot(){
    wrapRender();
    if (hasOrdersPage()) loadOrders('boot', true);
    setTimeout(() => { wrapRender(); loadOrders('boot-late', false); }, 1200);
    setInterval(() => { wrapRender(); loadOrders('interval', false); }, 30000);
  }

  window.tasneefOrdersRootSyncV10016 = {
    load: () => loadOrders('manual-api', true),
    render: renderOrdersNow,
    count: () => lastCount,
    store: STORE_KEY,
    table: TABLE
  };

  installListeners();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

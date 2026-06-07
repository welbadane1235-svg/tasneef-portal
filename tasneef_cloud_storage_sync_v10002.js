(function(){
  'use strict';
  if(window.__tasneefCloudStorageSyncV10002) return;
  window.__tasneefCloudStorageSyncV10002 = true;

  var SUPABASE_URL = window.SUPABASE_URL || 'https://zmjdqiswytxlbfgnfjfv.supabase.co';
  var SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  var TABLE = 'app_local_store';

  var KEYS = [
    'tasneef_orders_v233',
    'tasneef_orders_workflow_v8',
    'tasneef_order_inventory_cost_v8',
    'tasneef_finance_suppliers_v21',
    'tasneef_inventory_approval_path',
    'deleted_stock_invoices_v163',
    'tasneef_contract_smart_v299',
    'tasneef_service_gateways_v213',
    'tasneef_technician_attendance_v310'
  ];
  var KEY_SET = new Set(KEYS);
  var originalSetItem = localStorage.setItem.bind(localStorage);
  var originalGetItem = localStorage.getItem.bind(localStorage);
  var originalRemoveItem = localStorage.removeItem.bind(localStorage);
  var syncing = false;
  var ready = false;
  var queue = new Map();
  var timers = Object.create(null);

  function safeParse(v, fallback){ try{ return JSON.parse(v); }catch(_){ return fallback; } }
  function hasValue(v){ return v !== null && v !== undefined && String(v) !== ''; }
  function currentUserLabel(){
    try{
      var u = safeParse(originalGetItem('tasneef_user') || originalGetItem('tasneef_session') || '{}', {}) || {};
      return String(u.username || u.full_name || u.id || 'unknown');
    }catch(_){ return 'unknown'; }
  }
  function getClient(){
    try{
      if(window.sb && window.sb.from) return window.sb;
      if(window.supabase && window.supabase.createClient){
        window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return window.sb;
      }
    }catch(e){ console.warn('[TasneefCloudSync] Supabase client error', e); }
    return null;
  }
  function isKey(k){ return KEY_SET.has(String(k||'')); }
  function status(text, err){
    try{
      window.__tasneefCloudStorageStatus = {text:text, error:!!err, at:new Date().toISOString()};
      var el = document.getElementById('tasneefCloudSyncStatusV10002');
      if(!el){
        el = document.createElement('div');
        el.id = 'tasneefCloudSyncStatusV10002';
        el.style.cssText = 'position:fixed;bottom:10px;left:10px;z-index:999999;background:#0A4033;color:#fff;border-radius:12px;padding:7px 10px;font:12px Tahoma,Arial;box-shadow:0 8px 24px rgba(0,0,0,.18);opacity:.88;display:none';
        document.body.appendChild(el);
      }
      el.textContent = text;
      el.style.background = err ? '#b83232' : '#0A4033';
      el.style.display = 'block';
      clearTimeout(status._t);
      status._t = setTimeout(function(){ if(el) el.style.display='none'; }, err ? 6500 : 2500);
    }catch(_){ }
  }

  async function pushKey(key, value){
    if(!isKey(key)) return;
    var client = getClient();
    if(!client) return;
    try{
      var payload = { key:String(key), value_text:String(value == null ? '' : value), updated_at:new Date().toISOString(), updated_by:currentUserLabel() };
      var res = await client.from(TABLE).upsert(payload, {onConflict:'key'});
      if(res && res.error) throw res.error;
    }catch(e){
      console.warn('[TasneefCloudSync] push failed:', key, e && e.message ? e.message : e);
      status('تعذر حفظ بعض البيانات على السيرفر: '+key, true);
    }
  }

  function schedulePush(key, value){
    if(!isKey(key) || syncing) return;
    queue.set(String(key), String(value == null ? '' : value));
    clearTimeout(timers[key]);
    timers[key] = setTimeout(async function(){
      var v = queue.get(String(key));
      queue.delete(String(key));
      await pushKey(key, v);
    }, 350);
  }

  async function pullAll(){
    var client = getClient();
    if(!client){ status('اتصال Supabase غير جاهز للمزامنة', true); return false; }
    try{
      var res = await client.from(TABLE).select('key,value_text,updated_at').in('key', KEYS);
      if(res.error) throw res.error;
      var rows = res.data || [];
      var cloud = Object.create(null);
      rows.forEach(function(r){ cloud[r.key] = r.value_text || ''; });
      syncing = true;
      KEYS.forEach(function(key){
        var local = originalGetItem(key);
        if(Object.prototype.hasOwnProperty.call(cloud, key)){
          if(String(local||'') !== String(cloud[key]||'')) originalSetItem(key, String(cloud[key]||''));
        }else if(hasValue(local)){
          // أول جهاز عنده بيانات محلية يرفعها للسيرفر حتى لا تضيع.
          pushKey(key, local);
        }
      });
      syncing = false;
      ready = true;
      status('تمت مزامنة البيانات المحلية مع السيرفر');
      setTimeout(triggerRefresh, 250);
      return true;
    }catch(e){
      syncing = false;
      ready = false;
      console.warn('[TasneefCloudSync] pull failed:', e && e.message ? e.message : e);
      status('جدول مزامنة البيانات غير جاهز أو الصلاحيات ناقصة', true);
      return false;
    }
  }

  function triggerRefresh(){
    var fns = [
      'renderOrdersV233','renderOrdersV360','renderContractServices','renderPremiumReports',
      'renderInventoryItems','renderInventoryMovements','renderInventoryRequests','renderFinanceExpenses',
      'renderTechAttendance','renderAttendance','renderAttendanceMonthly','renderSupervisorDailySummary'
    ];
    fns.forEach(function(n){ try{ if(typeof window[n] === 'function') window[n](); }catch(e){} });
    try{ window.dispatchEvent(new CustomEvent('tasneef-cloud-storage-synced')); }catch(_){ }
  }

  localStorage.setItem = function(key, value){
    var r = originalSetItem(key, value);
    try{ schedulePush(key, value); }catch(_){ }
    return r;
  };
  localStorage.removeItem = function(key){
    var r = originalRemoveItem(key);
    try{ if(isKey(key)) schedulePush(key, ''); }catch(_){ }
    return r;
  };

  window.tasneefCloudStoragePull = pullAll;
  window.tasneefCloudStoragePushKey = function(key){ var v = originalGetItem(key); return pushKey(key, v); };
  window.tasneefCloudStorageKeys = KEYS.slice();

  function start(){
    pullAll();
    // مزامنة دورية بين الأجهزة.
    setInterval(function(){ pullAll(); }, 45000);
    // عند رجوع التبويب للحياة، اسحب آخر نسخة من السيرفر.
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) pullAll(); });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();

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

  const HEADERS = ['رقم الطلب','رقم الطلب بالجروب','تاريخ الطلب','وقت الطلب','مرسل الطلب','المشروع','نوع العقار','رقم الشقة','اسم العميل','رقم العميل','المنفذ','التفاصيل','ملاحظات','تخص','تاريخ التنفيذ','كيفية التنفيذ','حالة التنفيذ','تقرير','السعر (شامل الضريبة)','الضريبة 15%','السعر قبل الضريبة','التكلفة','الربح','حالة السداد','الإيصال','رقم الفاتورة','فوترة بالسيستم'];
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

  console.log('Loaded '+VERSION);
})();

(function(){
  if(window.__tasneefOrdersSharedSyncV64) return;
  window.__tasneefOrdersSharedSyncV64 = true;

  const STORE = 'tasneef_orders_v233';
  const FLOW = 'tasneef_orders_workflow_v8';
  const TABLE = 'orders_shared';
  const POLL_MS = 12000;
  const S = v => String(v ?? '').trim();
  const seed = () => window.TASNEEF_ORDERS_SEED || {headers:[],orders:[]};
  const headers = () => seed().headers || [];
  const clone = v => { try{ return JSON.parse(JSON.stringify(v || [])); }catch(e){ return []; } };
  const H = i => headers()[i] || ['رقم الطلب','رقم الطلب بالقروب','تاريخ الطلب','وقت الطلب','مرسل الطلب','المشروع'][i] || ('field_'+i);
  const normalizeNo = v => S(v).replace(/\s+/g,'').toUpperCase();
  const orderNo = row => normalizeNo(row && (row[H(0)] || row.order_no || row.orderNo || row.number || row.id));

  let loading = false;
  let firstLoadDone = false;
  let tableMissing = false;
  let lastSignature = '';
  let lastDeleted = [];
  let renderTimer = null;

  function readRows(){
    try{
      const rows = JSON.parse(localStorage.getItem(STORE) || 'null');
      if(Array.isArray(rows)) return rows;
    }catch(e){}
    return clone(seed().orders || []);
  }
  function writeRows(rows){
    localStorage.setItem(STORE, JSON.stringify(rows || []));
  }
  function readFlow(){
    try{
      const f = JSON.parse(localStorage.getItem(FLOW) || '{}');
      return f && typeof f === 'object' ? f : {};
    }catch(e){ return {}; }
  }
  function writeFlow(f){
    localStorage.setItem(FLOW, JSON.stringify(f || {}));
  }
  function userLabel(){
    try{
      const u = JSON.parse(localStorage.getItem('tasneef_user') || '{}') || {};
      return S(u.full_name || u.username || u.role || 'user');
    }catch(e){ return 'user'; }
  }
  function canUseDb(){
    return !!(window.sb && typeof window.sb.from === 'function');
  }
  function signature(rows, flow){
    const keys = (rows || []).map(r => orderNo(r)).filter(Boolean).sort().join('|');
    const flowKeys = Object.keys(flow || {}).sort().join('|');
    return keys + '::' + flowKeys + '::' + JSON.stringify(rows || []).length + ':' + JSON.stringify(flow || {}).length;
  }
  function toast(text, type){
    if(typeof window.msg === 'function') window.msg(text, type || '');
    else if(type === 'err') console.warn(text);
  }
  function rememberError(err){
    const msg = S(err && (err.message || err.details || err.hint || err.code));
    if(!msg) return;
    if((err && err.code === '42P01') || /does not exist|relation .*orders_shared/i.test(msg)){
      tableMissing = true;
      toast('جدول مشاركة الأوردرات غير موجود. ارفع ملف supabase_orders_shared.sql في Supabase مرة واحدة.', 'err');
    }else{
      console.warn('orders shared sync:', err);
    }
  }
  function mergeByNo(localRows, remoteRows){
    const map = new Map();
    (localRows || []).forEach(r => {
      const no = orderNo(r);
      if(no) map.set(no, r);
    });
    const remoteNos = [];
    (remoteRows || []).forEach(rec => {
      const data = rec && rec.data && typeof rec.data === 'object' ? rec.data : {};
      const no = normalizeNo(rec.order_no || orderNo(data));
      if(!no) return;
      data[H(0)] = data[H(0)] || rec.order_no || no;
      map.set(no, data);
      remoteNos.push(no);
    });
    const localOrder = (localRows || []).map(orderNo).filter(Boolean);
    const ordered = [];
    remoteNos.forEach(no => { if(map.has(no)) ordered.push(map.get(no)); });
    localOrder.forEach(no => {
      if(remoteNos.indexOf(no) < 0 && map.has(no)) ordered.push(map.get(no));
    });
    return ordered;
  }
  function mergeFlow(localFlow, remoteRows){
    const out = Object.assign({}, localFlow || {});
    (remoteRows || []).forEach(rec => {
      const no = normalizeNo(rec.order_no);
      const f = rec && rec.flow && typeof rec.flow === 'object' ? rec.flow : {};
      if(no) out[no] = Object.assign({}, out[no] || {}, f);
    });
    return out;
  }
  function renderSoon(){
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      if(typeof window.renderOrdersV233 === 'function') window.renderOrdersV233();
      if(typeof window.ordersWorkflowRenderMineV8 === 'function') window.ordersWorkflowRenderMineV8();
    }, 80);
  }

  async function loadShared(options){
    options = options || {};
    if(loading || !canUseDb() || tableMissing) return false;
    loading = true;
    try{
      const res = await window.sb.from(TABLE).select('order_no,data,flow,updated_at').order('updated_at', {ascending:false}).limit(8000);
      if(res.error){ rememberError(res.error); return false; }
      const remote = Array.isArray(res.data) ? res.data : [];
      const mergedRows = mergeByNo(readRows(), remote);
      const mergedFlow = mergeFlow(readFlow(), remote);
      writeRows(mergedRows);
      writeFlow(mergedFlow);
      firstLoadDone = true;
      lastSignature = signature(mergedRows, mergedFlow);
      if(options.render !== false) renderSoon();
      return true;
    }catch(e){
      rememberError(e);
      return false;
    }finally{
      loading = false;
    }
  }

  async function upsertRows(rows){
    if(!canUseDb() || tableMissing) return false;
    const flow = readFlow();
    const payload = (rows || []).map(row => {
      const no = orderNo(row);
      if(!no) return null;
      return {
        order_no: no,
        data: row,
        flow: flow[no] || {},
        updated_at: new Date().toISOString(),
        updated_by: userLabel()
      };
    }).filter(Boolean);
    if(!payload.length) return true;
    try{
      const res = await window.sb.from(TABLE).upsert(payload, {onConflict:'order_no'});
      if(res.error){ rememberError(res.error); return false; }
      lastSignature = signature(rows, flow);
      return true;
    }catch(e){
      rememberError(e);
      return false;
    }
  }

  async function deleteRemote(orderNos){
    const nos = (orderNos || []).map(normalizeNo).filter(Boolean);
    if(!nos.length || !canUseDb() || tableMissing) return false;
    try{
      const res = await window.sb.from(TABLE).delete().in('order_no', nos);
      if(res.error){ rememberError(res.error); return false; }
      return true;
    }catch(e){
      rememberError(e);
      return false;
    }
  }

  async function syncLocalNow(reason){
    const rows = readRows();
    const flow = readFlow();
    const sig = signature(rows, flow);
    if(sig === lastSignature && !lastDeleted.length) return true;
    const deleted = lastDeleted.slice();
    lastDeleted = [];
    if(deleted.length) await deleteRemote(deleted);
    return upsertRows(rows, reason);
  }

  function captureDeleteWrap(name){
    const old = window[name];
    if(typeof old !== 'function' || old.__ordersSharedSyncV64) return;
    const wrapped = function(){
      const before = new Set(readRows().map(orderNo).filter(Boolean));
      const ret = old.apply(this, arguments);
      setTimeout(() => {
        const after = new Set(readRows().map(orderNo).filter(Boolean));
        lastDeleted = lastDeleted.concat([...before].filter(no => !after.has(no)));
        syncLocalNow('delete').then(() => loadShared({render:false}));
      }, 120);
      return ret;
    };
    wrapped.__ordersSharedSyncV64 = true;
    window[name] = wrapped;
  }

  function saveWrap(name){
    const old = window[name];
    if(typeof old !== 'function' || old.__ordersSharedSyncV64) return;
    const wrapped = function(){
      const ret = old.apply(this, arguments);
      setTimeout(() => syncLocalNow(name).then(() => loadShared({render:false})), 160);
      return ret;
    };
    wrapped.__ordersSharedSyncV64 = true;
    window[name] = wrapped;
  }

  function installWraps(){
    ['saveOrderV233','ordersWorkflowCreateV8','ordersWorkflowInvoiceV8','ordersWorkflowApproveV8'].forEach(saveWrap);
    ['deleteOrderV233','resetOrdersDataV233'].forEach(captureDeleteWrap);
    const oldRender = window.renderOrdersV233;
    if(typeof oldRender === 'function' && !oldRender.__ordersSharedRenderV64){
      const wrapped = function(){
        if(!firstLoadDone && !loading) loadShared({render:false});
        return oldRender.apply(this, arguments);
      };
      wrapped.__ordersSharedRenderV64 = true;
      window.renderOrdersV233 = wrapped;
    }
  }

  function attachRefreshButtons(){
    document.addEventListener('click', e => {
      const btn = e.target && e.target.closest && e.target.closest('button');
      if(!btn) return;
      const text = S(btn.textContent);
      if(text === 'تحديث' || text === 'تحديث البيانات' || text === 'النظام محدث'){
        loadShared({render:true}).then(() => syncLocalNow('manual'));
      }
    }, true);
  }

  async function boot(){
    installWraps();
    await loadShared({render:true});
    await syncLocalNow('boot');
    installWraps();
  }

  window.tasneefOrdersSharedSyncV64 = {
    load: () => loadShared({render:true}),
    sync: syncLocalNow,
    table: TABLE
  };

  attachRefreshButtons();
  document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 900));
  setTimeout(boot, 1600);
  setInterval(() => {
    installWraps();
    loadShared({render:true});
  }, POLL_MS);
})();

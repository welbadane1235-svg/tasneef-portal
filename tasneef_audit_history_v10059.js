(function(){
  'use strict';
  if(window.__tasneefAuditHistoryV10059) return;
  window.__tasneefAuditHistoryV10059 = true;

  const LOG_TABLE = 'tasneef_change_logs';
  const S = v => String(v ?? '').trim();
  const A = v => Array.isArray(v) ? v : [];
  const E = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const N = v => Number(String(v ?? 0).replace(/[^\d.\-]/g,'')) || 0;
  const $ = id => document.getElementById(id);
  const MONEY_KEYS = ['السعر (شامل الضريبة)','الضريبة 15%','السعر قبل الضريبة','التكلفة','الربح'];

  function currentUser(){
    try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};}
  }
  function userName(){
    const u=currentUser();
    return S(u.full_name || u.name || u.username || u.email || 'مستخدم النظام');
  }
  function userRole(){ return S(currentUser().role || ''); }
  function now(){ return new Date().toISOString(); }
  function toast(t,type){ try{ if(typeof window.msg==='function') window.msg(t,type); }catch(_){} }

  function stable(obj){
    if(obj==null) return null;
    try{return JSON.parse(JSON.stringify(obj));}catch(_){return obj;}
  }
  function diff(before, after){
    const b = before || {}, a = after || {};
    const keys = Array.from(new Set(Object.keys(b).concat(Object.keys(a))));
    const out = {};
    keys.forEach(k=>{
      if(k.startsWith('__')) return;
      const bv = b[k], av = a[k];
      if(JSON.stringify(bv) !== JSON.stringify(av)) out[k] = {from:bv ?? '', to:av ?? ''};
    });
    return out;
  }
  function changesHtml(ch){
    const o = ch && typeof ch === 'object' ? ch : {};
    const keys = Object.keys(o).slice(0,80);
    if(!keys.length) return '<div class="audit-empty-v10059">لا توجد تفاصيل تغيير مسجلة</div>';
    return `<table class="audit-mini-table-v10059"><thead><tr><th>الحقل</th><th>قبل</th><th>بعد</th></tr></thead><tbody>${keys.map(k=>`<tr><td>${E(k)}</td><td>${E(o[k]?.from ?? '')}</td><td>${E(o[k]?.to ?? '')}</td></tr>`).join('')}</tbody></table>`;
  }
  function style(){
    if($('auditHistoryStyleV10059')) return;
    const st=document.createElement('style'); st.id='auditHistoryStyleV10059';
    st.textContent = `
      .audit-hist-btn-v10059{background:#eef6f3!important;color:#0A4033!important;border:1px solid #dce6e2!important}
      .audit-hist-box-v10059{margin-top:14px;border:1px solid #dce6e2;border-radius:16px;background:#fbfdfc;padding:12px}
      .audit-hist-box-v10059 h3{margin:0 0 10px;color:#0A4033}
      .audit-hist-list-v10059{display:grid;gap:10px;max-height:360px;overflow:auto}
      .audit-hist-item-v10059{border:1px solid #e3eee9;border-radius:14px;background:#fff;padding:10px;line-height:1.7}
      .audit-hist-item-v10059 .top{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;color:#0A4033;font-weight:900}
      .audit-mini-table-v10059{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}.audit-mini-table-v10059 th,.audit-mini-table-v10059 td{border:1px solid #edf1ef;padding:7px;text-align:right;white-space:normal}.audit-mini-table-v10059 th{background:#f3faf7;color:#0A4033}
      .audit-empty-v10059{padding:10px;color:#60706a;border:1px dashed #dce6e2;border-radius:12px;background:#fff}
    `;
    document.head.appendChild(st);
  }

  async function logChange(record_type, record_id, record_title, action, before_data, after_data, customChanges){
    if(!window.sb || !record_type || !record_id) return;
    const changes = customChanges || diff(before_data, after_data);
    const row = {
      record_type:S(record_type), record_id:S(record_id), record_title:S(record_title), action:S(action||'edit'),
      user_name:userName(), user_role:userRole(), changes:changes||{}, before_data:stable(before_data)||{}, after_data:stable(after_data)||{}, created_at:now()
    };
    try{ const r=await sb.from(LOG_TABLE).insert(row); if(r.error) console.warn('audit log skipped:', r.error.message||r.error); }catch(e){ console.warn('audit log skipped:', e.message||e); }
  }

  async function getLogs(record_type, record_id){
    if(!window.sb || !record_type || !record_id) return [];
    try{
      const r = await sb.from(LOG_TABLE).select('*').eq('record_type',S(record_type)).eq('record_id',S(record_id)).order('created_at',{ascending:false}).limit(80);
      if(r.error) throw r.error;
      return A(r.data);
    }catch(e){ console.warn('load audit logs failed:', e.message||e); return []; }
  }

  async function historyHtml(record_type, record_id){
    const rows = await getLogs(record_type, record_id);
    if(!rows.length) return '<div class="audit-empty-v10059">لا توجد تعديلات مسجلة حتى الآن لهذا السجل</div>';
    return `<div class="audit-hist-list-v10059">${rows.map(r=>`<div class="audit-hist-item-v10059"><div class="top"><span>${E(r.action||'تعديل')}</span><span>${E(r.user_name||'-')}</span><span>${E(new Date(r.created_at||Date.now()).toLocaleString('ar-SA'))}</span></div>${changesHtml(r.changes)}</div>`).join('')}</div>`;
  }

  window.tasneefLogChangeV10059 = logChange;
  window.tasneefOpenChangeHistoryV10059 = async function(type,id,title){
    style();
    const modal=document.createElement('div'); modal.className='modal-backdrop'; modal.style.cssText='position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:999999;display:grid;place-items:center;padding:18px';
    modal.innerHTML=`<div class="card" style="width:min(980px,96vw);max-height:92vh;overflow:auto"><div class="fin-actions" style="justify-content:space-between"><h2>سجل التعديلات: ${E(title||id)}</h2><button class="danger" onclick="this.closest('.modal-backdrop').remove()">إغلاق</button></div><div id="auditHistContentV10059" class="audit-hist-box-v10059">جاري التحميل...</div></div>`;
    modal.onclick=e=>{ if(e.target===modal) modal.remove(); };
    document.body.appendChild(modal);
    const box=modal.querySelector('#auditHistContentV10059'); box.innerHTML = await historyHtml(type,id);
  };

  function orderRows(){ try{return (window.tasneefOrdersRootLockV10036 && window.tasneefOrdersRootLockV10036.rows && window.tasneefOrdersRootLockV10036.rows()) || [];}catch(_){return[];} }
  function orderNo(row){ return S(row && (row['رقم الطلب'] || row.order_no || row.orderNo || row.id)).replace(/\s+/g,'').toUpperCase(); }
  function orderField(row,key){ return row ? (row[key] ?? '') : ''; }
  function money(v){ return N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س'; }
  function orderDetailsModal(idx){
    style();
    const rows=orderRows(); const r=rows[idx]; if(!r) return;
    const no=orderNo(r);
    const labels=[['رقم الطلب','رقم الطلب'],['رقم القروب','رقم الطلب بالجروب'],['التاريخ','تاريخ الطلب'],['مرسل الطلب','مرسل الطلب'],['المشروع','المشروع'],['نوع العقار','نوع العقار'],['رقم الشقة','رقم الشقة'],['العميل','اسم العميل'],['الجوال','رقم العميل'],['المنفذ','المنفذ'],['التفاصيل','التفاصيل'],['ملاحظات','ملاحظات'],['تخص','تخص'],['تاريخ التنفيذ','تاريخ التنفيذ'],['كيفية التنفيذ','كيفية التنفيذ'],['حالة التنفيذ','حالة التنفيذ'],['السعر شامل الضريبة','السعر (شامل الضريبة)'],['الضريبة','الضريبة 15%'],['قبل الضريبة','السعر قبل الضريبة'],['التكلفة','التكلفة'],['الربح','الربح'],['حالة السداد','حالة السداد'],['رقم الفاتورة','رقم الفاتورة'],['الفوترة','فوترة بالسيستم']];
    const body=labels.map(([l,k])=>{ let val=orderField(r,k); if(MONEY_KEYS.includes(k)&&val!==''&&val!=null) val=money(val); return `<div><small>${E(l)}</small><strong>${E(val||'-')}</strong></div>`; }).join('');
    const modal=document.createElement('div'); modal.className='modal-backdrop'; modal.style.cssText='position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:99999;display:grid;place-items:center;padding:18px';
    modal.innerHTML=`<div class="card" style="width:min(980px,96vw);max-height:92vh;overflow:auto"><div class="fin-actions" style="justify-content:space-between"><h2>عرض الأوردر: ${E(no||'-')}</h2><button class="danger" onclick="this.closest('.modal-backdrop').remove()">إغلاق</button></div><div class="meta-root36" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-top:12px">${body}</div><div class="audit-hist-box-v10059"><h3>سجل التعديلات</h3><div id="orderAuditLogsV10059">جاري التحميل...</div></div></div>`;
    modal.onclick=e=>{ if(e.target===modal) modal.remove(); };
    document.body.appendChild(modal);
    historyHtml('order', no).then(html=>{ const b=modal.querySelector('#orderAuditLogsV10059'); if(b) b.innerHTML=html; });
  }

  function installOrdersPatch(){
    if(window.__tasneefOrdersAuditPatchV10059 || !window.tasneefOrdersRootLockV10036 || typeof window.saveOrderV233!=='function') return;
    window.__tasneefOrdersAuditPatchV10059 = true;
    const originalSave = window.saveOrderV233;
    const originalDelete = window.deleteOrderV233;
    window.showOrderDetailsV10036 = orderDetailsModal;
    window.saveOrderV233 = async function(){
      const rowsBefore=orderRows().map(stable);
      const idxStr=S($('orderEditIndexV233')?.value); const idx=idxStr!==''?Number(idxStr):-1;
      const before = Number.isInteger(idx)&&idx>=0 ? stable(rowsBefore[idx]) : null;
      const beforeNo = orderNo(before);
      const ret = await originalSave.apply(this, arguments);
      setTimeout(async()=>{
        const rowsAfter=orderRows();
        const after = beforeNo ? rowsAfter.find(x=>orderNo(x)===beforeNo) : rowsAfter[0];
        const no = orderNo(after || before);
        if(no) await logChange('order', no, no, before?'تعديل أوردر':'إضافة أوردر', before||{}, after||{});
      },600);
      return ret;
    };
    if(typeof originalDelete==='function'){
      window.deleteOrderV233 = async function(index){
        const row=stable(orderRows()[index]); const no=orderNo(row);
        const ret=await originalDelete.apply(this, arguments);
        if(no) setTimeout(()=>logChange('order',no,no,'حذف أوردر',row||{},{}),400);
        return ret;
      };
    }
  }

  function actionName(action,table){
    if(action==='insert') return 'إضافة في ' + table;
    if(action==='update') return 'تعديل في ' + table;
    if(action==='delete') return 'حذف من ' + table;
    return action + ' ' + table;
  }
  function recordIdFromPayload(table,payload,data){
    const d = Array.isArray(data) ? (data[0]||{}) : (data||{});
    const p = payload || {};
    return S(d.id || p.id || d.item_id || p.item_id || d.product_id || p.product_id || d.code || p.code || d.product_code || p.product_code || d.name || p.name || d.item_name || p.item_name || table);
  }
  function recordTitleFromPayload(table,payload,data){
    const d = Array.isArray(data) ? (data[0]||{}) : (data||{});
    const p = payload || {};
    return S(d.name || p.name || d.item_name || p.item_name || d.product_name || p.product_name || d.product_code || p.product_code || d.id || p.id || table);
  }
  function installSupabasePatch(){
    if(window.__tasneefSbAuditPatchV10059 || !window.sb || typeof window.sb.from!=='function') return;
    window.__tasneefSbAuditPatchV10059 = true;
    const rawFrom = window.sb.from.bind(window.sb);
    const tables = new Set(['inventory_items','inventory_movements','inventory_products','finance_expenses','expenses','orders_shared']);
    function wrapQuery(q, table, action, payload){
      if(!q || typeof q !== 'object') return q;
      return new Proxy(q, {get(target, prop, receiver){
        if(prop === 'then'){
          return function(resolve,reject){
            return target.then(async res=>{
              try{
                if(res && !res.error && tables.has(table)){
                  const id=recordIdFromPayload(table,payload,res.data); const title=recordTitleFromPayload(table,payload,res.data);
                  const typ = table==='orders_shared'?'order':'finance';
                  await logChange(typ, id, title, actionName(action,table), {}, payload||{}, payload && typeof payload==='object' ? Object.fromEntries(Object.keys(payload).map(k=>[k,{from:'',to:payload[k]}])) : {});
                }
              }catch(e){ console.warn('audit sb log failed', e); }
              return resolve ? resolve(res) : res;
            }, reject);
          };
        }
        const v=target[prop];
        if(typeof v==='function') return function(){ const r=v.apply(target, arguments); return wrapQuery(r, table, action, payload); };
        return v;
      }});
    }
    window.sb.from = function(table){
      const builder = rawFrom(table);
      if(!tables.has(String(table))) return builder;
      return new Proxy(builder, {get(target, prop){
        if(['insert','update','upsert','delete'].includes(prop)){
          return function(payload){ const q=target[prop].apply(target, arguments); return wrapQuery(q, String(table), String(prop), payload); };
        }
        const v=target[prop]; return typeof v==='function'?v.bind(target):v;
      }});
    };
  }

  function installFinanceHistoryPatch(){
    if(window.__tasneefFinanceAuditPatchV10059 || typeof window.financeProShowProductV15 !== 'function') return;
    window.__tasneefFinanceAuditPatchV10059 = true;
    const orig = window.financeProShowProductV15;
    window.financeProShowProductV15 = function(id){
      const ret = orig.apply(this, arguments);
      setTimeout(async()=>{
        style();
        const modals=[...document.querySelectorAll('.modal-backdrop .card')]; const card=modals[modals.length-1]; if(!card || card.querySelector('#financeAuditLogsV10059')) return;
        const key=S(id);
        const box=document.createElement('div'); box.className='audit-hist-box-v10059'; box.innerHTML='<h3>سجل تعديلات المنتج / الحركة</h3><div id="financeAuditLogsV10059">جاري التحميل...</div>';
        card.appendChild(box);
        let html = await historyHtml('finance', key);
        box.querySelector('#financeAuditLogsV10059').innerHTML = html;
      },450);
      return ret;
    };
  }

  function boot(){ style(); installSupabasePatch(); installOrdersPatch(); installFinanceHistoryPatch(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,800)); else setTimeout(boot,400);
  window.addEventListener('load',()=>setTimeout(boot,1800));
  setInterval(boot,2500);
})();

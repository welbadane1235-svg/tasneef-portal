/* Tasneef Orders Root Master v10031
   حل جذري لقسم الأوردرات:
   - مصدر واحد: Supabase orders_shared.
   - لا يعتمد على حفظ اللوكل القديم.
   - يحفظ الإضافة/التعديل مباشرة في orders_shared ثم يحدث app_local_store.
   - يمنع رجوع الأوردر بعد التحديث.
   - يثبت الداش بورد من نفس البيانات المعروضة.
   - يضيف فلتر: تخص العميل / تخص الجمعية.
*/
(function(){
  'use strict';
  if(window.__tasneefOrdersRootMasterV10031) return;
  window.__tasneefOrdersRootMasterV10031 = true;

  const SUPABASE_URL = 'https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const TABLE = 'orders_shared';
  const STORE_KEY = 'tasneef_orders_v233';
  const FLOW_KEY = 'tasneef_orders_workflow_v8';
  const PAGE_SIZE = 15;
  const HEADERS = ['رقم الطلب','رقم الطلب بالجروب','تاريخ الطلب','وقت الطلب','مرسل الطلب','المشروع','نوع العقار','رقم الشقة','اسم العميل','رقم العميل','المنفذ','التفاصيل','ملاحظات','تخص','تاريخ التنفيذ','كيفية التنفيذ','حالة التنفيذ','تقرير','السعر (شامل الضريبة)','الضريبة 15%','السعر قبل الضريبة','التكلفة','الربح','حالة السداد','رقم الفاتورة','فوترة بالسيستم'];
  const EDITABLE = HEADERS.filter(h => h !== 'رقم الطلب');
  let ORDERS = [];
  let FLOW = {};
  let page = 1;
  let isSaving = false;
  let lastSavedAt = 0;

  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const A = v => Array.isArray(v) ? v : [];
  const esc = v => S(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const n = v => { const x = Number(S(v).replace(/,/g,'').replace(/[^0-9.\-]/g,'')); return Number.isFinite(x) ? x : 0; };
  const money = v => n(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ر.س';
  const nowIso = () => new Date().toISOString();
  const localToday = () => new Date().toISOString().slice(0,10);
  const normalizeNo = v => S(v).replace(/\s+/g,'').toUpperCase();
  const H = i => HEADERS[i] || ('field_'+i);
  const field = (r,i) => r ? (r[H(i)] ?? '') : '';
  const setField = (r,i,v) => { r[H(i)] = v; };
  const orderNoForRow = r => normalizeNo(r && (r['رقم الطلب'] || r.order_no || r.orderNo || r.id));

  function fieldId(header){
    try{ return 'orderFieldV233_'+btoa(unescape(encodeURIComponent(header))).replace(/=+$/,'').replace(/[^a-zA-Z0-9]/g,'_'); }
    catch(_){ return 'orderFieldV233_'+header.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g,'_'); }
  }
  function normalizeDate(v){
    let s=S(v); if(!s || s==='0') return '';
    let m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if(m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    m=s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if(m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
    return s;
  }
  function dateKey(r){ return normalizeDate(field(r,2) || r.order_date || r.created_at || r.updated_at); }
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
  function writeLocal(rows){
    ORDERS = sortRows(rows);
    localStorage.setItem(STORE_KEY, JSON.stringify(ORDERS));
    localStorage.setItem('tasneef_orders_root_master_last_v10031', nowIso());
  }
  function writeFlow(flow){ FLOW = flow || {}; localStorage.setItem(FLOW_KEY, JSON.stringify(FLOW)); }
  function readLocal(){ try{ const r=JSON.parse(localStorage.getItem(STORE_KEY)||'[]'); return A(r); }catch(_){ return []; } }
  function statusPay(r){
    const p=S(field(r,23) || r.payment_status || r.finance_status || r['المالية']);
    if(/آجل|أجل|اجل/i.test(p)) return 'آجل';
    if(/تم\s*السداد|مسدد|مدفوع|تم\s*الدفع|سداد/i.test(p)) return 'تم السداد';
    return p;
  }
  function concern(r){ return S(field(r,13) || r.concern || r.belongs_to); }
  function concernNorm(r){ const c=concern(r); if(/عميل|العميل/i.test(c)) return 'client'; if(/جمعية|الجمعية|جميعة|الجميعة|اتحاد/i.test(c)) return 'association'; return ''; }
  function recalc(r){
    const inc=n(r['السعر (شامل الضريبة)']);
    const cost=n(r['التكلفة']);
    if(inc || cost){ const before=+(inc/1.15).toFixed(2); const vat=+(inc-before).toFixed(2); r['السعر قبل الضريبة']=before; r['الضريبة 15%']=vat; r['الربح']=+(before-cost).toFixed(2); }
    return r;
  }
  function nextOrderNo(){ const max = Math.max(0, ...ORDERS.map(orderNumberValue)); return 'ORD'+String(max+1).padStart(4,'0'); }

  async function api(path, options){
    return fetch(SUPABASE_URL + path, Object.assign({
      cache:'no-store',
      headers:{apikey:SUPABASE_ANON_KEY, Authorization:'Bearer '+SUPABASE_ANON_KEY, Accept:'application/json', 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=representation'}
    }, options || {}));
  }
  function normalizeForServer(row){
    const r = Object.assign({}, row || {});
    const no = orderNoForRow(r);
    if(no){ r['رقم الطلب']=r['رقم الطلب']||no; r.order_no = no; r.orderNo = no; }
    const p=statusPay(r); if(p) r['حالة السداد']=p;
    r.__tasneef_updated_at = nowIso();
    return recalc(r);
  }
  async function updateAppCache(rows){
    await api('/rest/v1/app_local_store?on_conflict=key', {method:'POST', body:JSON.stringify({key:STORE_KEY,value_text:JSON.stringify(sortRows(rows)),updated_at:nowIso(),updated_by:'orders_root_master_v10031_cache'})}).catch(()=>{});
  }
  async function loadRemote(){
    if(isSaving) return;
    try{
      const res = await api('/rest/v1/'+TABLE+'?select=order_no,data,flow,updated_at&order=updated_at.desc&limit=10000', {method:'GET'});
      if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
      const arr = await res.json();
      const seen = new Set(); const rows=[]; const flow={};
      A(arr).forEach(rec=>{
        const row = Object.assign({}, rec.data || {});
        const no = normalizeNo(rec.order_no || orderNoForRow(row));
        if(!no || seen.has(no)) return;
        row['رقم الطلب'] = row['رقم الطلب'] || no;
        row.order_no = no; row.orderNo = no;
        row.__server_updated_at = rec.updated_at || '';
        rows.push(row); flow[no] = rec.flow || {}; seen.add(no);
      });
      writeLocal(rows); writeFlow(flow); await updateAppCache(rows); renderOrders();
    }catch(e){ console.warn('Orders root remote load failed:', e); const local=readLocal(); if(local.length){ ORDERS=sortRows(local); renderOrders(); } }
  }
  async function saveRemote(row, reason){
    const r = normalizeForServer(row);
    const no = orderNoForRow(r);
    if(!no) throw new Error('رقم الأوردر غير موجود');
    const payload = {order_no:no, data:r, flow:FLOW[no] || {}, updated_at:nowIso(), updated_by:'orders_root_master_v10031_'+(reason||'save')};
    const res = await api('/rest/v1/'+TABLE+'?on_conflict=order_no', {method:'POST', body:JSON.stringify(payload)});
    if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
    const idx = ORDERS.findIndex(x=>orderNoForRow(x)===no);
    if(idx>=0) ORDERS[idx]=r; else ORDERS.unshift(r);
    writeLocal(ORDERS); await updateAppCache(ORDERS); renderOrders(); return r;
  }
  async function deleteRemote(row){
    const no=orderNoForRow(row); if(!no) return;
    const res=await api('/rest/v1/'+TABLE+'?order_no=eq.'+encodeURIComponent(no), {method:'DELETE'});
    if(!res.ok) console.warn(await res.text().catch(()=>String(res.status)));
    ORDERS=ORDERS.filter(x=>orderNoForRow(x)!==no); writeLocal(ORDERS); await updateAppCache(ORDERS); renderOrders();
  }

  function inputType(h){ if(h.includes('تاريخ')) return 'date'; if(h.includes('وقت')) return 'time'; if(['السعر (شامل الضريبة)','الضريبة 15%','السعر قبل الضريبة','التكلفة','الربح','رقم الطلب بالجروب','رقم العميل'].includes(h)) return 'number'; return 'text'; }
  function isTextarea(h){ return ['التفاصيل','ملاحظات','كيفية التنفيذ'].includes(h); }
  function isDropdown(h){ return ['المشروع','نوع العقار','المنفذ','مرسل الطلب','تخص','حالة التنفيذ','تقرير','حالة السداد','فوترة بالسيستم'].includes(h); }
  function optionValues(h){
    const vals = [];
    ORDERS.forEach(r=>{ const v=S(r[h]); if(v) vals.push(v); });
    const defaults = {
      'تخص':['العميل','الجمعية'],
      'حالة التنفيذ':['لم ينفذ','تم التنفيذ','ملغي'],
      'حالة السداد':['آجل','تم السداد','مجاني'],
      'فوترة بالسيستم':['تمت','لم تتم']
    }[h] || [];
    return [...new Set([...defaults,...vals])].sort((a,b)=>a.localeCompare(b,'ar'));
  }
  function hydrateForm(){
    const box=$('orderFormFieldsV233'); if(!box) return;
    box.innerHTML = EDITABLE.filter(h=>h!=='رقم الطلب بالجروب').map(h=>{
      const id=fieldId(h), wide=isTextarea(h)||h==='التفاصيل'||h==='ملاحظات'||h==='كيفية التنفيذ';
      let html='';
      if(isDropdown(h)) html='<select id="'+id+'"><option value="">اختر</option>'+optionValues(h).map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('')+'</select>';
      else if(isTextarea(h)) html='<textarea id="'+id+'"></textarea>';
      else html='<input id="'+id+'" type="'+inputType(h)+'">';
      const readonly = ['الضريبة 15%','السعر قبل الضريبة','الربح'].includes(h) ? ' <span class="orders-hidden-col-v233">(تلقائي)</span>' : '';
      return '<div class="'+(wide?'wide':'')+'"><label>'+esc(h)+readonly+'</label>'+html+'</div>';
    }).join('');
    ['السعر (شامل الضريبة)','التكلفة'].forEach(h=>{ const el=$(fieldId(h)); if(el) el.addEventListener('input', previewCalc); });
  }
  function hydrateFilters(){
    const map=[['orderProjectFilterV233','المشروع','كل المشاريع'],['orderExecutorFilterV233','المنفذ','كل المنفذين'],['orderSenderFilterV233','مرسل الطلب','كل مرسلي الطلب'],['orderStatusFilterV233','حالة التنفيذ','كل حالات التنفيذ'],['orderPaymentFilterV233','حالة السداد','كل حالات السداد'],['orderBillingFilterV233','فوترة بالسيستم','كل حالات الفوترة']];
    map.forEach(([id,h,label])=>{ const el=$(id); if(!el) return; const cur=el.value; el.innerHTML='<option value="">'+label+'</option>'+optionValues(h).map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join(''); if(cur) el.value=cur; });
    ensureConcernFilter(); bindFilters();
  }
  function ensureConcernFilter(){
    const filters=document.querySelector('#orders .orders-filters-v233') || document.querySelector('#orders .filters'); if(!filters) return;
    if(!$('orderConcernFilterV10031')){
      const wrap=document.createElement('div'); wrap.id='orderConcernFilterWrapV10031'; wrap.innerHTML='<label>تخص</label><select id="orderConcernFilterV10031"><option value="">الكل</option><option value="client">تخص العميل</option><option value="association">تخص الجمعية</option></select>';
      const reset=filters.querySelector('button'); if(reset) filters.insertBefore(wrap, reset); else filters.appendChild(wrap);
    }
  }
  function previewCalc(){
    const inc=$(''+fieldId('السعر (شامل الضريبة)')), cost=$(''+fieldId('التكلفة'));
    const vat=$(''+fieldId('الضريبة 15%')), before=$(''+fieldId('السعر قبل الضريبة')), profit=$(''+fieldId('الربح'));
    const row=recalc({'السعر (شامل الضريبة)':inc?inc.value:0,'التكلفة':cost?cost.value:0});
    if(vat) vat.value=row['الضريبة 15%']||0; if(before) before.value=row['السعر قبل الضريبة']||0; if(profit) profit.value=row['الربح']||0;
  }
  function formToRow(existing){
    const row = Object.assign({}, existing || {});
    row['رقم الطلب'] = S($('orderNoV233')&&$('orderNoV233').value) || row['رقم الطلب'] || nextOrderNo();
    row['رقم الطلب بالجروب'] = S($('orderGroupNoV233')&&$('orderGroupNoV233').value);
    EDITABLE.forEach(h=>{ if(h==='رقم الطلب بالجروب') return; const el=$(fieldId(h)); if(el) row[h]=el.value; });
    if(!S(row['تاريخ الطلب'])) row['تاريخ الطلب']=localToday();
    return recalc(row);
  }
  function fillForm(row, idx){
    hydrateForm();
    if($('orderEditIndexV233')) $('orderEditIndexV233').value = String(idx ?? '');
    if($('orderNoV233')) $('orderNoV233').value = field(row,0) || '';
    if($('orderGroupNoV233')) $('orderGroupNoV233').value = field(row,1) || '';
    EDITABLE.forEach(h=>{ if(h==='رقم الطلب بالجروب') return; const el=$(fieldId(h)); if(!el) return; let v=row[h] ?? ''; if(inputType(h)==='date') v=normalizeDate(v); el.value=v; });
    if($('orderFormTitleV233')) $('orderFormTitleV233').textContent='تعديل أوردر '+(field(row,0)||'');
  }
  window.clearOrderFormV233 = function(){ hydrateForm(); if($('orderEditIndexV233')) $('orderEditIndexV233').value=''; if($('orderNoV233')) $('orderNoV233').value=''; if($('orderGroupNoV233')) $('orderGroupNoV233').value=''; EDITABLE.forEach(h=>{ const el=$(fieldId(h)); if(el) el.value=''; }); const d=$(fieldId('تاريخ الطلب')); if(d) d.value=localToday(); if($('orderFormTitleV233')) $('orderFormTitleV233').textContent='إضافة أوردر'; };
  window.editOrderV233 = function(index){ const row=ORDERS[index]; if(!row) return; fillForm(row,index); $('orders')?.scrollIntoView({behavior:'smooth',block:'start'}); };
  window.saveOrderV233 = async function(){
    try{
      isSaving=true; lastSavedAt=Date.now();
      const idxStr=S($('orderEditIndexV233')&&$('orderEditIndexV233').value); const idx=idxStr!==''?Number(idxStr):-1;
      const old = Number.isInteger(idx) && idx>=0 ? ORDERS[idx] : null;
      const row = formToRow(old);
      await saveRemote(row, old?'edit':'new');
      window.clearOrderFormV233();
      if(typeof msg==='function') msg('تم حفظ الأوردر وتثبيته في السيرفر');
    }catch(e){ alert('لم يتم حفظ الأوردر: '+(e.message||e)); if(typeof msg==='function') msg(e.message||String(e),'err'); }
    finally{ isSaving=false; }
  };
  window.deleteOrderV233 = async function(index){ const row=ORDERS[index]; if(!row) return; if(!confirm('حذف الأوردر '+(field(row,0)||'')+'؟')) return; await deleteRemote(row); };
  window.deleteCurrentOrderV233 = async function(){ const idxStr=S($('orderEditIndexV233')&&$('orderEditIndexV233').value); if(idxStr==='') return alert('اختر أوردر أولًا'); await window.deleteOrderV233(Number(idxStr)); window.clearOrderFormV233(); };

  function passFilters(row){
    const q=S($('orderSearchV233')&&$('orderSearchV233').value).toLowerCase(); const project=S($('orderProjectFilterV233')&&$('orderProjectFilterV233').value); const exec=S($('orderExecutorFilterV233')&&$('orderExecutorFilterV233').value); const sender=S($('orderSenderFilterV233')&&$('orderSenderFilterV233').value); const status=S($('orderStatusFilterV233')&&$('orderStatusFilterV233').value); const pay=S($('orderPaymentFilterV233')&&$('orderPaymentFilterV233').value); const bill=S($('orderBillingFilterV233')&&$('orderBillingFilterV233').value); const cn=S($('orderConcernFilterV10031')&&$('orderConcernFilterV10031').value); const from=S($('orderFromDateV233')&&$('orderFromDateV233').value); const to=S($('orderToDateV233')&&$('orderToDateV233').value);
    if(project && field(row,5)!==project) return false; if(exec && field(row,10)!==exec) return false; if(sender && field(row,4)!==sender) return false; if(status && field(row,16)!==status) return false; if(pay){ const p=statusPay(row); if(/آجل|أجل|اجل/.test(pay)){ if(p!=='آجل') return false; } else if(p!==pay && field(row,23)!==pay) return false; } if(bill && field(row,25)!==bill) return false; if(cn && concernNorm(row)!==cn) return false; const d=dateKey(row); if(from && d && d<from) return false; if(to && d && d>to) return false;
    if(q){ const hay=[field(row,0),field(row,1),field(row,4),field(row,5),field(row,8),field(row,9),field(row,10),field(row,11),field(row,13),field(row,16),field(row,23),field(row,24)].map(S).join(' ').toLowerCase(); if(!hay.includes(q)) return false; }
    return true;
  }
  function style(){
    if($('ordersRootMasterStyleV10031')) return; const st=document.createElement('style'); st.id='ordersRootMasterStyleV10031';
    st.textContent='.orders-cards-v360{display:grid;grid-template-columns:repeat(auto-fill,minmax(315px,1fr));gap:12px;margin-top:12px}.order-card-root31{background:#fff;border:1px solid var(--line,#dce6e2);border-radius:18px;padding:14px;box-shadow:0 8px 22px rgba(10,64,51,.06);display:grid;gap:10px;min-width:0}.order-card-root31.done{border-inline-start:5px solid #137a4b}.order-card-root31.due{border-inline-start:5px solid #9a6b00}.order-card-root31.cancel{border-inline-start:5px solid #b83232}.order-card-root31 h3{margin:0;color:var(--brand,#0A4033);font-size:18px}.order-head-root31{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.order-head-root31 small{display:block;color:var(--muted,#60706a);margin-top:4px}.order-head-root31 span,.chip-root31{border-radius:999px;padding:5px 9px;font-size:12px;font-weight:900;background:#eef6f3;color:var(--brand,#0A4033);border:1px solid #d8e8e2}.chip-row-root31{display:flex;gap:6px;flex-wrap:wrap}.chip-root31.finance{background:#fff5da;color:#8a6700}.chip-root31.bad{background:#fde8e8;color:#9d2222}.meta-root31{display:grid;grid-template-columns:1fr 1fr;gap:7px}.meta-root31 div{background:#f8fbfa;border:1px solid #edf1ef;border-radius:12px;padding:8px;min-width:0}.meta-root31 small{display:block;color:var(--muted,#60706a);font-size:11px;margin-bottom:3px}.meta-root31 strong{display:block;color:#10231d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.details-root31{line-height:1.7;color:#243b34;background:#fbfdfc;border:1px dashed #d8e8e2;border-radius:12px;padding:9px;min-height:64px;margin:0}.actions-root31{display:flex;gap:7px;flex-wrap:wrap}.actions-root31 button{padding:8px 11px;border-radius:10px;font-size:12px}.orders-pager-v360{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;background:#f8fbfa;border:1px solid var(--line,#dce6e2);border-radius:14px;padding:10px}.empty-root31{grid-column:1/-1;background:#fff;border:1px dashed #b9d8ca;border-radius:16px;padding:22px;text-align:center;color:var(--muted,#60706a)}#orderConcernFilterWrapV10031{min-width:150px}'; document.head.appendChild(st);
  }
  function cardClass(r){ const st=S(field(r,16)), p=statusPay(r); if(/لم ينفذ|ملغي|إلغاء|الغاء/i.test(st)) return 'cancel'; if(p==='آجل'||/جزئي/i.test(p)) return 'due'; if(/تم التنفيذ/i.test(st)) return 'done'; return ''; }
  function card(r, idx){ const cls=cardClass(r), price=field(r,18); return '<article class="order-card-root31 '+cls+'"><div class="order-head-root31"><div><h3>'+esc(field(r,0)||'-')+'</h3><small>رقم القروب: '+esc(field(r,1)||'-')+' | '+esc(field(r,2)||'-')+'</small></div><span>'+esc(field(r,5)||'-')+'</span></div><div class="chip-row-root31"><b class="chip-root31 '+(cls==='cancel'?'bad':'')+'">التشغيل: '+esc(field(r,16)||'-')+'</b><b class="chip-root31 '+(cls==='due'?'finance':'')+'">السداد: '+esc(statusPay(r)||'-')+'</b><b class="chip-root31">تخص: '+esc(concern(r)||'-')+'</b></div><div class="meta-root31"><div><small>العميل</small><strong>'+esc(field(r,8)||'-')+'</strong></div><div><small>الجوال</small><strong>'+esc(field(r,9)||'-')+'</strong></div><div><small>المنفذ</small><strong>'+esc(field(r,10)||'-')+'</strong></div><div><small>مرسل الطلب</small><strong>'+esc(field(r,4)||'-')+'</strong></div><div><small>السعر شامل الضريبة</small><strong>'+esc(price!==''?money(price):'-')+'</strong></div><div><small>الفاتورة</small><strong>'+esc(field(r,24)||'-')+'</strong></div></div><p class="details-root31">'+(esc(S(field(r,11)).slice(0,180))||'لا توجد تفاصيل')+'</p><div class="actions-root31"><button class="light" onclick="showOrderDetailsV10031('+idx+')">عرض</button><button onclick="editOrderV233('+idx+')">تعديل</button><button class="light" onclick="sendOrderWhatsappV233('+idx+')">واتساب</button><button class="danger" onclick="deleteOrderV233('+idx+')">حذف</button></div></article>'; }
  function renderSummary(rows){
    const done=rows.filter(r=>/تم التنفيذ/i.test(S(field(r,16)))).length; const dueRows=rows.filter(r=>statusPay(r)==='آجل'||/جزئي/i.test(statusPay(r))||(!statusPay(r)&&n(field(r,18))>0)); const paidRows=rows.filter(r=>statusPay(r)==='تم السداد'); const notDone=rows.filter(r=>/لم ينفذ|ملغي|إلغاء|الغاء/i.test(S(field(r,16)))).length; const revenue=rows.reduce((a,r)=>a+n(field(r,18)),0), vat=rows.reduce((a,r)=>a+n(field(r,19)),0), cost=rows.reduce((a,r)=>a+n(field(r,21)),0), profit=rows.reduce((a,r)=>a+n(field(r,22)),0); const dueTotal=dueRows.reduce((a,r)=>a+n(field(r,18)),0), paidTotal=paidRows.reduce((a,r)=>a+n(field(r,18)),0);
    if($('ordersTotalKpiV233')) $('ordersTotalKpiV233').textContent=rows.length; if($('ordersDoneKpiV233')) $('ordersDoneKpiV233').textContent=done; if($('ordersDueKpiV233')) $('ordersDueKpiV233').textContent=dueRows.length; if($('ordersProfitKpiV233')) $('ordersProfitKpiV233').textContent=money(profit).replace(' ر.س',''); if($('ordersSummaryV233')) $('ordersSummaryV233').innerHTML=[['إجمالي الإيرادات شامل الضريبة',money(revenue)],['إجمالي الضريبة 15%',money(vat)],['إجمالي التكلفة',money(cost)],['صافي الربح',money(profit)],['تم السداد',paidRows.length+' أوردر - '+money(paidTotal)],['آجل / غير مسدد',dueRows.length+' أوردر - '+money(dueTotal)],['لم ينفذ / ملغي',notDone+' أوردر']].map(x=>'<div class="summary-item"><b>'+esc(x[0])+'</b><br>'+esc(x[1])+'</div>').join('');
  }
  window.renderOrdersV233 = function(){ renderOrders(); };
  function renderOrders(){
    style(); hydrateFilters(); const host=$('ordersCardsV360') || $('ordersCardsV6'); if(!host) return; const filtered=ORDERS.filter(passFilters); const maxPage=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)); page=Math.min(Math.max(1,page),maxPage); const slice=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE); host.innerHTML=slice.map(r=>card(r, ORDERS.findIndex(x=>orderNoForRow(x)===orderNoForRow(r)))).join('') || '<div class="empty-root31">لا توجد أوردرات حسب الفلتر الحالي</div>'; const pager=$('ordersPagerV360') || $('ordersPagerV6'); if(pager) pager.innerHTML='<button class="light" '+(page<=1?'disabled':'')+' onclick="changeOrdersPageV10031(-1)">السابق</button><b>صفحة '+page+' من '+maxPage+' — النتائج '+filtered.length+'</b><button class="light" '+(page>=maxPage?'disabled':'')+' onclick="changeOrdersPageV10031(1)">التالي</button>'; renderSummary(filtered);
  }
  window.changeOrdersPageV10031 = d => { page=Math.max(1,page+Number(d||0)); renderOrders(); };
  window.showOrderDetailsV10031 = function(idx){ const r=ORDERS[idx]; if(!r) return; const labels=[['رقم الطلب',0],['رقم القروب',1],['التاريخ',2],['مرسل الطلب',4],['المشروع',5],['نوع العقار',6],['رقم الشقة',7],['العميل',8],['الجوال',9],['المنفذ',10],['التفاصيل',11],['ملاحظات',12],['تخص',13],['تاريخ التنفيذ',14],['كيفية التنفيذ',15],['حالة التنفيذ',16],['السعر شامل الضريبة',18],['الضريبة',19],['قبل الضريبة',20],['التكلفة',21],['الربح',22],['حالة السداد',23],['رقم الفاتورة',24],['الفوترة',25]]; const body=labels.map(x=>{ let val=field(r,x[1]); if([18,19,20,21,22].includes(x[1]) && val!=='' && val!=null) val=money(val); return '<div><small>'+esc(x[0])+'</small><strong>'+esc(val||'-')+'</strong></div>'; }).join(''); document.body.insertAdjacentHTML('beforeend','<div class="modal-backdrop" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:99999;display:grid;place-items:center;padding:18px"><div class="card" style="width:min(920px,96vw);max-height:92vh;overflow:auto"><div class="fin-actions" style="justify-content:space-between"><h2>عرض الأوردر: '+esc(field(r,0)||'-')+'</h2><button class="danger" onclick="this.closest(&quot;.modal-backdrop&quot;).remove()">إغلاق</button></div><div class="meta-root31" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-top:12px">'+body+'</div></div></div>'); };
  function bindFilters(){ ['orderSearchV233','orderProjectFilterV233','orderExecutorFilterV233','orderSenderFilterV233','orderStatusFilterV233','orderPaymentFilterV233','orderBillingFilterV233','orderFromDateV233','orderToDateV233','orderConcernFilterV10031'].forEach(id=>{ const el=$(id); if(el&&!el.__root31){ el.__root31=true; el.addEventListener('input',()=>{page=1;renderOrders();}); el.addEventListener('change',()=>{page=1;renderOrders();}); }}); }
  function boot(){
    ORDERS=sortRows(readLocal()); hydrateForm(); hydrateFilters(); window.clearOrderFormV233(); loadRemote();
    setTimeout(()=>{ hydrateForm(); hydrateFilters(); bindFilters(); renderOrders(); }, 1000);
    document.addEventListener('click', e=>{ const b=e.target&&e.target.closest&&e.target.closest('button'); const t=S(b&&b.textContent); if(t==='تحديث'||t==='تحديث البيانات'){ if(Date.now()-lastSavedAt>3000) loadRemote(); else renderOrders(); } }, true);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.tasneefOrdersRootMasterV10031 = {load:loadRemote, save:saveRemote, rows:()=>ORDERS, render:renderOrders};
})();

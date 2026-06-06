(function(){
  if(window.__tasneefOrdersCardsV6) return;
  window.__tasneefOrdersCardsV6 = true;

  var STORAGE_KEY = 'tasneef_orders_v233';
  var PAGE_SIZE = 12;
  var page = 1;
  var $ = function(id){ return document.getElementById(id); };
  var seed = function(){ return window.TASNEEF_ORDERS_SEED || {headers:[],orders:[]}; };
  var headers = function(){ return (seed().headers || []).filter(function(h){ return String(h||'').indexOf('__excel_col_') !== 0; }); };
  var esc = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];}); };
  var num = function(v){ var n = Number(String(v == null ? 0 : v).replace(/,/g,'').trim()); return Number.isFinite(n) ? n : 0; };
  var money = function(v){ return num(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ر.س'; };
  var text = function(v,n){ var s=String(v == null ? '' : v).trim(); return s.length > n ? s.slice(0,n) + '...' : s; };
  var clone = function(rows){ try{return JSON.parse(JSON.stringify(rows || []));}catch(e){return [];} };
  var field = function(row, idx){ var h=headers()[idx]; return h ? row[h] : ''; };
  var ORDER_INV_COST_KEY = 'tasneef_order_inventory_cost_v8';
  var normalizeOrderNo = function(v){ return String(v == null ? '' : v).replace(/\s+/g,'').toUpperCase(); };

  function orderNoForRow(row){
    return String(field(row,0) || (row && (row.order_no || row.orderNo || row.order_id || row.id)) || '').trim();
  }

  function readOrderInventoryCosts(){
    try{
      var saved = JSON.parse(localStorage.getItem(ORDER_INV_COST_KEY) || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    }catch(e){ return {}; }
  }

  function writeOrderInventoryCosts(data){
    localStorage.setItem(ORDER_INV_COST_KEY, JSON.stringify(data || {}));
  }

  function inventoryCostForOrder(orderNo){
    var key = normalizeOrderNo(orderNo);
    var row = readOrderInventoryCosts()[key];
    return row ? num(row.amount) : 0;
  }

  function getOrders(){
    try{
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if(Array.isArray(saved) && saved.length) return saved;
    }catch(e){}
    return clone(seed().orders || []);
  }

  function dateForDisplay(v){
    if(!v && v !== 0) return '-';
    var s=String(v).trim();
    var m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if(m) return m[1] + '/' + m[2] + '/' + m[3];
    m=s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if(m) return m[3] + '/' + m[2] + '/' + m[1];
    return s || '-';
  }

  function dateForFilter(v){
    if(!v && v !== 0) return '';
    var s=String(v).trim();
    var m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if(m) return m[3] + '-' + String(m[2]).padStart(2,'0') + '-' + String(m[1]).padStart(2,'0');
    m=s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if(m) return m[1] + '-' + String(m[2]).padStart(2,'0') + '-' + String(m[3]).padStart(2,'0');
    return '';
  }

  function filteredOrders(){
    var q=($('orderSearchV233') && $('orderSearchV233').value || '').trim().toLowerCase();
    var project=$('orderProjectFilterV233') && $('orderProjectFilterV233').value || '';
    var exec=$('orderExecutorFilterV233') && $('orderExecutorFilterV233').value || '';
    var sender=$('orderSenderFilterV233') && $('orderSenderFilterV233').value || '';
    var status=$('orderStatusFilterV233') && $('orderStatusFilterV233').value || '';
    var pay=$('orderPaymentFilterV233') && $('orderPaymentFilterV233').value || '';
    var bill=$('orderBillingFilterV233') && $('orderBillingFilterV233').value || '';
    var from=$('orderFromDateV233') && $('orderFromDateV233').value || '';
    var to=$('orderToDateV233') && $('orderToDateV233').value || '';
    return getOrders().map(function(r,i){ return {r:r,i:i}; }).filter(function(x){
      var r=x.r;
      if(project && String(field(r,5)||'').trim() !== project) return false;
      if(exec && String(field(r,10)||'').trim() !== exec) return false;
      if(sender && String(field(r,4)||'').trim() !== sender) return false;
      if(status && String(field(r,16)||'').trim() !== status) return false;
      if(pay && String(field(r,23)||'').trim() !== pay) return false;
      if(bill && String(field(r,25)||'').trim() !== bill) return false;
      var d = dateForFilter(field(r,2));
      if(from && d && d < from) return false;
      if(to && d && d > to) return false;
      if(q){
        var hay=[field(r,0),field(r,1),field(r,5),field(r,8),field(r,9),field(r,10),field(r,11),field(r,12),field(r,24)].join(' ').toLowerCase();
        if(hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function cardClass(r){
    var st=String(field(r,16)||''), pay=String(field(r,23)||'');
    if(st.indexOf('لم ينفذ') >= 0 || st.indexOf('ملغي') >= 0) return 'cancel';
    if(pay.indexOf('آجل') >= 0 || pay.indexOf('جزئي') >= 0) return 'due';
    if(st.indexOf('تم التنفيذ') >= 0) return 'done';
    return '';
  }

  function card(r,i){
    var cls=cardClass(r);
    var price=field(r,18), profit=field(r,22);
    var invCost=inventoryCostForOrder(orderNoForRow(r));
    return '<article class="order-card-v6 '+cls+'">' +
      '<div class="order-card-head-v6"><div><h3>'+esc(field(r,0)||'-')+'</h3><small>رقم القروب: '+esc(field(r,1)||'-')+' | '+esc(dateForDisplay(field(r,2)))+'</small></div><span>'+esc(field(r,5)||'-')+'</span></div>' +
      '<div class="order-chip-row-v6"><b class="'+(cls==='cancel'?'bad':'ops')+'">التشغيل: '+esc(field(r,16)||'-')+'</b><b class="'+(cls==='due'?'finance':'')+'">المالية: '+esc(field(r,23)||'-')+'</b><b>الفوترة: '+esc(field(r,25)||'-')+'</b></div>' +
      '<div class="order-meta-v6"><div><small>العميل</small><strong>'+esc(field(r,8)||'-')+'</strong></div><div><small>الجوال</small><strong>'+esc(field(r,9)||'-')+'</strong></div><div><small>المنفذ</small><strong>'+esc(field(r,10)||'-')+'</strong></div><div><small>مرسل الطلب</small><strong>'+esc(field(r,4)||'-')+'</strong></div><div><small>السعر شامل الضريبة</small><strong>'+esc(price!==''&&price!=null?money(price):'-')+'</strong></div><div><small>الربح</small><strong>'+esc(profit!==''&&profit!=null?money(profit):'-')+'</strong></div><div><small>تكلفة المخزن</small><strong>'+esc(invCost>0?money(invCost):'-')+'</strong></div></div>' +
      '<p class="order-details-v6">'+(esc(text(field(r,11),160)) || 'لا توجد تفاصيل')+'</p>' +
'<div class="order-actions-v6"><button class="light" onclick="showOrderDetailsV6('+i+')">عرض</button><button onclick="editOrderV233('+i+')">تعديل</button><button class="light" onclick="sendOrderWhatsappV233('+i+')">واتساب</button><button class="danger" onclick="deleteOrderV233('+i+')">حذف</button></div>' +
    '</article>';
  }

  function summary(rows){
    rows = rows || getOrders();
    var done=rows.filter(function(r){return String(field(r,16)||'').indexOf('تم التنفيذ')>=0;}).length;
    var due=rows.filter(function(r){var p=String(field(r,23)||''); return p.indexOf('آجل')>=0 || p.indexOf('جزئي')>=0 || (!p && num(field(r,18))>0);}).length;
    var paid=rows.filter(function(r){return String(field(r,23)||'').indexOf('تم السداد')>=0;}).length;
    var notDone=rows.filter(function(r){var s=String(field(r,16)||''); return s.indexOf('لم ينفذ')>=0 || s.indexOf('ملغي')>=0;}).length;
    var revenue=rows.reduce(function(a,r){return a+num(field(r,18));},0);
    var vat=rows.reduce(function(a,r){return a+num(field(r,19));},0);
    var cost=rows.reduce(function(a,r){return a+num(field(r,21));},0);
    var profit=rows.reduce(function(a,r){return a+num(field(r,22));},0);
    if($('ordersTotalKpiV233')) $('ordersTotalKpiV233').textContent=rows.length;
    if($('ordersDoneKpiV233')) $('ordersDoneKpiV233').textContent=done;
    if($('ordersDueKpiV233')) $('ordersDueKpiV233').textContent=due;
    if($('ordersProfitKpiV233')) $('ordersProfitKpiV233').textContent=money(profit).replace(' ر.س','');
    if($('ordersSummaryV233')) $('ordersSummaryV233').innerHTML=[
      ['إجمالي الإيرادات شامل الضريبة', money(revenue)],
      ['إجمالي الضريبة 15%', money(vat)],
      ['إجمالي التكلفة', money(cost)],
      ['صافي الربح', money(profit)],
      ['تم السداد', paid+' أوردر'],
      ['لم ينفذ / ملغي', notDone+' أوردر']
    ].map(function(x){ return '<div class="summary-item"><b>'+esc(x[0])+'</b><br>'+esc(x[1])+'</div>'; }).join('');
  }

  function ensureLayout(){
    var old=$('ordersBodyV233');
    if(old && old.closest('.table-wrap')) old.closest('.table-wrap').style.display='none';
    var host=$('ordersCardsV6');
    if(!host){
      var listCard=document.querySelector('.orders-list-card-v233');
      if(!listCard) return;
      host=document.createElement('div');
      host.id='ordersCardsV6';
      host.className='orders-cards-v6';
      var pager=document.createElement('div');
      pager.id='ordersPagerV6';
      pager.className='orders-pager-v6';
      listCard.appendChild(host);
      listCard.appendChild(pager);
    }
  }

  function style(){
    if($('ordersCardsStyleV6')) return;
    var s=document.createElement('style');
    s.id='ordersCardsStyleV6';
    s.textContent='.orders-cards-v6{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:12px;margin-top:12px}.order-card-v6{background:#fff;border:1px solid var(--line);border-radius:18px;padding:14px;box-shadow:0 8px 22px rgba(10,64,51,.06);display:grid;gap:10px;min-width:0}.order-card-v6.done{border-inline-start:5px solid #137a4b}.order-card-v6.due{border-inline-start:5px solid #9a6b00}.order-card-v6.cancel{border-inline-start:5px solid #b83232}.order-card-head-v6{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.order-card-head-v6 h3{margin:0;color:var(--brand);font-size:18px}.order-card-head-v6 small{display:block;color:var(--muted);margin-top:4px}.order-card-head-v6 span,.order-chip-row-v6 b{border-radius:999px;padding:5px 9px;font-size:12px;font-weight:900;background:#eef6f3;color:var(--brand);border:1px solid #d8e8e2}.order-chip-row-v6{display:flex;gap:6px;flex-wrap:wrap}.order-chip-row-v6 .ops{background:#e8f4ee;color:#137a4b}.order-chip-row-v6 .finance{background:#fff5da;color:#8a6700}.order-chip-row-v6 .bad{background:#fde8e8;color:#9d2222}.order-meta-v6{display:grid;grid-template-columns:1fr 1fr;gap:7px}.order-meta-v6 div{background:#f8fbfa;border:1px solid #edf1ef;border-radius:12px;padding:8px;min-width:0}.order-meta-v6 small{display:block;color:var(--muted);font-size:11px;margin-bottom:3px}.order-meta-v6 strong{display:block;color:#10231d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.order-details-v6{line-height:1.7;color:#243b34;background:#fbfdfc;border:1px dashed #d8e8e2;border-radius:12px;padding:9px;min-height:64px;margin:0}.order-actions-v6{display:flex;gap:7px;flex-wrap:wrap}.order-actions-v6 button{padding:8px 11px;border-radius:10px;font-size:12px}.orders-pager-v6{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;background:#f8fbfa;border:1px solid var(--line);border-radius:14px;padding:10px}.orders-pager-v6 button{padding:8px 12px;border-radius:10px}.orders-pager-v6 button:disabled{opacity:.45;cursor:not-allowed}.orders-empty-v6{grid-column:1/-1;background:#fff;border:1px dashed #b9d8ca;border-radius:16px;padding:22px;text-align:center;color:var(--muted)}';
    document.head.appendChild(s);
  }

window.changeOrdersPageV6=function(delta){ page=Math.max(1,page+Number(delta||0)); window.renderOrdersV233(); };
window.renderOrdersFirstPageV6=function(){ page=1; window.renderOrdersV233(); };
window.showOrderDetailsV6=function(idx){
  var rows=getOrders(); var r=rows[idx]; if(!r) return;
  var labels=[
    ['رقم الطلب',0],['رقم القروب',1],['التاريخ',2],['مرسل الطلب',4],['المشروع',5],['العميل',8],['الجوال',9],['المنفذ',10],
    ['التفاصيل',11],['المبلغ شامل الضريبة',13],['قبل الضريبة',14],['الضريبة',15],['حالة التنفيذ',16],['التكلفة',17],
    ['الربح',18],['حالة السداد',23],['الفاتورة',24],['الفوترة',25]
  ];
  var body=labels.map(function(x){
    var val=field(r,x[1]);
    if([13,14,15,17,18].indexOf(x[1])>-1 && val!=='' && val!=null) val=money(val);
    return '<div><small>'+esc(x[0])+'</small><strong>'+esc(val||'-')+'</strong></div>';
  }).join('');
  body += '<div><small>تكلفة المخزن</small><strong>'+esc(inventoryCostForOrder(orderNoForRow(r))>0?money(inventoryCostForOrder(orderNoForRow(r))):'-')+'</strong></div>';
  document.body.insertAdjacentHTML('beforeend','<div class="modal-backdrop" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:99999;display:grid;place-items:center;padding:18px"><div class="card" style="width:min(920px,96vw);max-height:92vh;overflow:auto"><div class="fin-actions" style="justify-content:space-between"><h2>عرض الأوردر: '+esc(field(r,0)||'-')+'</h2><button class="danger" onclick="this.closest(&quot;.modal-backdrop&quot;).remove()">إغلاق</button></div><div class="order-meta-v6" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-top:12px">'+body+'</div></div></div>');
};

window.tasneefOrdersFindV8=function(orderNo){
  var target=normalizeOrderNo(orderNo);
  if(!target) return null;
  var rows=getOrders();
  for(var i=0;i<rows.length;i++){
    var r=rows[i], no=orderNoForRow(r);
    if(normalizeOrderNo(no)===target){
      return {
        index:i,
        row:r,
        orderNo:no,
        project:field(r,5)||'',
        client:field(r,8)||'',
        details:field(r,11)||'',
        total:field(r,13)||field(r,18)||''
      };
    }
  }
  return null;
};

window.tasneefOrdersAddInventoryCostV8=function(orderNo, amount, meta){
  var key=normalizeOrderNo(orderNo);
  var value=num(amount);
  if(!key || value<=0) return false;
  var data=readOrderInventoryCosts();
  if(!data[key]) data[key]={amount:0, lines:[]};
  if(meta && meta.key && (data[key].lines||[]).some(function(line){ return line && line.key === meta.key; })) return true;
  data[key].amount=+(num(data[key].amount)+value).toFixed(2);
  data[key].updatedAt=new Date().toISOString();
  data[key].lines=(data[key].lines||[]).concat([Object.assign({amount:value, at:new Date().toISOString()}, meta||{})]).slice(-200);
  writeOrderInventoryCosts(data);
  if(typeof window.renderOrdersV233 === 'function') setTimeout(window.renderOrdersV233,0);
  return true;
};

window.tasneefOrdersInventoryCostV8=function(orderNo){
  return inventoryCostForOrder(orderNo);
};

window.renderOrdersV233=function(){
    style();
    ensureLayout();
    if(typeof window.hydrateOrdersForm === 'function') window.hydrateOrdersForm();
    var list=filteredOrders();
    var pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE));
    page=Math.min(Math.max(1,page),pages);
    var start=(page-1)*PAGE_SIZE;
    var rows=list.slice(start,start+PAGE_SIZE);
    if($('ordersCardsV6')) $('ordersCardsV6').innerHTML=rows.map(function(x){return card(x.r,x.i);}).join('') || '<div class="orders-empty-v6">لا توجد أوردرات حسب الفلتر الحالي</div>';
    if($('ordersPagerV6')) $('ordersPagerV6').innerHTML='<div>عرض '+(list.length?start+1:0)+'-'+Math.min(start+PAGE_SIZE,list.length)+' من '+list.length+' أوردر | صفحة '+page+' من '+pages+'</div><div><button class="light" onclick="changeOrdersPageV6(-1)" '+(page<=1?'disabled':'')+'>السابق</button> <button class="light" onclick="changeOrdersPageV6(1)" '+(page>=pages?'disabled':'')+'>التالي</button></div>';
    summary(list.map(function(x){return x.r;}));
  };

  var oldReset=window.resetOrdersFiltersV233;
  window.resetOrdersFiltersV233=function(){
    if(typeof oldReset === 'function') oldReset();
    page=1;
    window.renderOrdersV233();
  };

  document.addEventListener('input',function(e){ if(e.target && e.target.id === 'orderSearchV233'){ page=1; setTimeout(window.renderOrdersV233,0); } },true);
  document.addEventListener('change',function(e){ if(e.target && /^order.*V233$/.test(e.target.id||'')){ page=1; setTimeout(window.renderOrdersV233,0); } },true);
  document.addEventListener('DOMContentLoaded',function(){ setTimeout(function(){ if($('orders')) window.renderOrdersV233(); },300); });
})();


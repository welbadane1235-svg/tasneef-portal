(function(){
  if(window.__tasneefOrdersSearchBridgeV9) return;
  window.__tasneefOrdersSearchBridgeV9 = true;

  const STORE='tasneef_orders_v233';
  const S=(v)=>String(v ?? '').trim();
  const N=(v)=>Number(String(v ?? 0).replace(/[^\d.\-]/g,'')) || 0;
  const seed=()=>window.TASNEEF_ORDERS_SEED || {headers:[],orders:[]};
  const H=(i)=>seed().headers?.[i] || [
    'رقم الطلب','رقم الطلب بالجروب','تاريخ الطلب','وقت الطلب','مرسل الطلب','المشروع','نوع العقار','رقم الشقة','اسم العميل','رقم العميل','المنفذ','التفاصيل','ملاحظات','تخص','تاريخ التنفيذ','كيفية التنفيذ','حالة التنفيذ','تقرير','السعر (شامل الضريبة)','الضريبة 15%','السعر قبل الضريبة','التكلفة','الربح','حالة السداد','رقم الفاتورة','فوترة بالسيستم'
  ][i] || ('field_'+i);
  const orderNo=(r)=>S(r?.[H(0)] || r?.order_no || r?.orderNo || r?.number || r?.id).match(/ORD\d+/i)?.[0] || '';
  function readMain(){
    try{
      const rows=JSON.parse(localStorage.getItem(STORE) || 'null');
      if(Array.isArray(rows)) return rows;
    }catch(e){}
    return JSON.parse(JSON.stringify(seed().orders || []));
  }
  function writeMain(rows){ localStorage.setItem(STORE, JSON.stringify(rows || [])); }
  function keyHas(k, words){
    const low=S(k).toLowerCase();
    return words.some(w=>low.includes(w));
  }
  function pick(row, words){
    if(!row || typeof row!=='object') return '';
    for(const [k,v] of Object.entries(row)){
      const low=S(k).toLowerCase();
      if(words.some(w=>low.includes(w))) return S(v);
    }
    return '';
  }
  function normalize(row){
    const no=orderNo(row);
    if(!no) return null;
    const out={...row};
    out[H(0)]=out[H(0)] || no;
    out[H(1)]=out[H(1)] || pick(row,['group','قروب','القروب','الجروب']);
    out[H(2)]=out[H(2)] || pick(row,['date','تاريخ']) || new Date().toISOString().slice(0,10);
    out[H(4)]=out[H(4)] || pick(row,['sender','created_by','مرسل']);
    out[H(5)]=out[H(5)] || pick(row,['project','مشروع']);
    out[H(8)]=out[H(8)] || pick(row,['client','customer','عميل']);
    out[H(9)]=out[H(9)] || pick(row,['phone','mobile','جوال','رقم العميل']);
    out[H(11)]=out[H(11)] || pick(row,['details','description','تفاصيل']);
    out[H(12)]=out[H(12)] || pick(row,['note','ملاحظة']);
    out[H(13)]=out[H(13)] || pick(row,['تخص','scope']);
    out[H(16)]=out[H(16)] || pick(row,['execution','status','حالة التنفيذ']);
    out[H(18)]=out[H(18)] || pick(row,['gross','شامل','amount','total']);
    out[H(20)]=out[H(20)] || pick(row,['before','قبل']);
    out[H(19)]=out[H(19)] || pick(row,['vat','tax','ضريبة']);
    out[H(21)]=out[H(21)] || pick(row,['cost','تكلفة']);
    out[H(22)]=out[H(22)] || pick(row,['profit','ربح']);
    out[H(23)]=out[H(23)] || pick(row,['payment','سداد']);
    out[H(24)]=out[H(24)] || pick(row,['invoice','فاتورة']);
    if(!out[H(19)] && out[H(18)] && out[H(20)]) out[H(19)]=+(N(out[H(18)])-N(out[H(20)])).toFixed(2);
    if(!out[H(22)] && out[H(20)]) out[H(22)]=+(N(out[H(20)])-N(out[H(21)])).toFixed(2);
    return out;
  }
  function collect(value, rows=[]){
    if(!value) return rows;
    if(Array.isArray(value)) value.forEach(v=>collect(v,rows));
    else if(typeof value==='object'){
      const row=normalize(value);
      if(row) rows.push(row);
      Object.values(value).forEach(v=>{
        if(Array.isArray(v)) collect(v,rows);
      });
    }
    return rows;
  }
  function mergeExternalOrders(){
    const main=readMain();
    const seen=new Set(main.map(orderNo).filter(Boolean));
    const extra=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(!key || key===STORE || key.includes('workflow')) continue;
      if(!keyHas(key,['order','ord','اوردر','أوردر','orders','طلب'])) continue;
      try{
        const val=JSON.parse(localStorage.getItem(key) || 'null');
        collect(val,extra);
      }catch(e){}
    }
    extra.forEach(r=>{
      const no=orderNo(r);
      if(no && !seen.has(no)){ main.unshift(r); seen.add(no); }
    });
    if(extra.length) writeMain(main);
  }
  function clearOtherFiltersForOrderNo(){
    const q=S(document.getElementById('orderSearchV233')?.value);
    if(!/ORD\d+/i.test(q)) return;
    ['orderProjectFilterV233','orderExecutorFilterV233','orderSenderFilterV233','orderStatusFilterV233','orderPaymentFilterV233','orderBillingFilterV233','orderFromDateV233','orderToDateV233'].forEach(id=>{
      const el=document.getElementById(id);
      if(el && el.value) el.value='';
    });
  }
  function install(){
    mergeExternalOrders();
    const old=window.renderOrdersV233;
    if(typeof old==='function' && !old.__ordersBridgeV9){
      const fn=function(){
        mergeExternalOrders();
        clearOtherFiltersForOrderNo();
        return old.apply(this, arguments);
      };
      fn.__ordersBridgeV9=true;
      window.renderOrdersV233=fn;
    }
  }
  document.addEventListener('input',e=>{
    if(e.target?.id==='orderSearchV233') clearOtherFiltersForOrderNo();
  },true);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,700));
  setTimeout(install,1300);
})();

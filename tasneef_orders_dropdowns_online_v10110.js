/* Tasneef v10110 - Orders Online Dropdowns Fix
   Scope: ORDERS ONLY
   - إصلاح قوائم إضافة الأوردر بعد نقل الأوردرات إلى Supabase.
   - يملأ مرسل الطلب، المشروع، نوع العقار، المنفذ، تخص العميل/الجمعية، والحالات من Supabase والبيانات الأساسية.
   - لا يلمس أي قسم آخر.
*/
(function(){
  'use strict';
  if(window.__tasneefOrdersDropdownsOnlineV10110) return;
  window.__tasneefOrdersDropdownsOnlineV10110 = true;

  const VERSION='v10110-orders-dropdowns-online-fix';
  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const TABLE='orders_shared';
  const HEADERS=['رقم الطلب','رقم الطلب بالجروب','تاريخ الطلب','وقت الطلب','مرسل الطلب','المشروع','نوع العقار','رقم الشقة','اسم العميل','رقم العميل','المنفذ','التفاصيل','ملاحظات','تخص','تاريخ التنفيذ','كيفية التنفيذ','حالة التنفيذ','تقرير','السعر (شامل الضريبة)','الضريبة 15%','السعر قبل الضريبة','التكلفة','الربح','حالة السداد','رقم الفاتورة','فوترة بالسيستم'];
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  function $(id){return document.getElementById(id)}
  function uniq(arr){const out=[];const seen=new Set();A(arr).forEach(v=>{v=S(v); if(v&&!seen.has(v)){seen.add(v); out.push(v);}}); return out;}
  function fieldId(header){
    try{return 'orderFieldV233_'+btoa(unescape(encodeURIComponent(header))).replace(/=+$/,'').replace(/[^a-zA-Z0-9]/g,'_');}
    catch(_){return 'orderFieldV233_'+header.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g,'_');}
  }
  function orderField(row, header){
    if(!row) return '';
    return S(row[header] ?? row.data?.[header] ?? '');
  }
  async function fetchOrders(){
    try{
      const res=await fetch(SUPABASE_URL+'/rest/v1/'+TABLE+'?select=data&order=updated_at.desc&limit=5000',{
        cache:'no-store',
        headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY,Accept:'application/json'}
      });
      if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
      const arr=await res.json();
      return A(arr).map(x=>x.data||{}).filter(Boolean);
    }catch(e){console.warn(VERSION,'remote orders read failed',e); return [];}
  }
  function baseData(){return window.data||{};}
  function projectNames(){
    const names=A(baseData().projects).map(p=>p.name||p.project_name||p.title);
    return uniq(names);
  }
  function userNames(){
    const users=[...A(baseData().users),...A(baseData().supervisors),...A(baseData().technicians),...A(baseData().workers)];
    return uniq(users.map(u=>u.full_name||u.name||u.username||u.email));
  }
  const defaults={
    'مرسل الطلب':[],
    'المشروع':[],
    'نوع العقار':['شقة','فيلا','دور','عمارة','محل','مكتب','مستودع','مواقف','سطح','غرفة','أخرى'],
    'المنفذ':[],
    'تخص':['العميل','الجمعية'],
    'حالة التنفيذ':['لم ينفذ','تم التنفيذ','جاري التنفيذ','ملغي'],
    'تقرير':['يوجد تقرير','لا يوجد تقرير'],
    'حالة السداد':['آجل','تم السداد','مجاني','جزئي'],
    'فوترة بالسيستم':['تمت','لم تتم']
  };
  function valuesFor(header, rows){
    let vals=A(rows).map(r=>orderField(r,header));
    if(header==='المشروع') vals=[...projectNames(),...vals];
    if(header==='مرسل الطلب'||header==='المنفذ') vals=[...userNames(),...vals];
    vals=[...(defaults[header]||[]),...vals];
    return uniq(vals);
  }
  function setOptions(select, values, placeholder){
    if(!select || select.tagName!=='SELECT') return false;
    const old=S(select.value);
    const vals=uniq(values);
    const first=placeholder||'اختر';
    select.innerHTML='<option value="">'+esc(first)+'</option>'+vals.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');
    if(old && vals.includes(old)) select.value=old;
    select.dataset.v10110='1';
    return true;
  }
  function inputDatalist(input, values, key){
    if(!input || input.tagName==='SELECT') return;
    const id='ordersDatalistV10110_'+key.replace(/[^a-zA-Z0-9]/g,'_');
    let dl=$(id); if(!dl){dl=document.createElement('datalist'); dl.id=id; document.body.appendChild(dl);}
    dl.innerHTML=uniq(values).map(v=>'<option value="'+esc(v)+'"></option>').join('');
    input.setAttribute('list',id);
  }
  function findFieldByLabel(label){
    const labels=[...document.querySelectorAll('label')];
    const lab=labels.find(x=>S(x.textContent).replace(/\s+/g,' ')===label);
    if(!lab) return null;
    const box=lab.parentElement || lab.closest('div');
    if(!box) return null;
    return box.querySelector('select,input,textarea');
  }
  function hydrateOrderForm(rows){
    const config={
      'مرسل الطلب':'اختر',
      'المشروع':'اختر المشروع',
      'نوع العقار':'اختر',
      'المنفذ':'اختر',
      'تخص':'اختر',
      'حالة التنفيذ':'اختر',
      'تقرير':'اختر',
      'حالة السداد':'اختر',
      'فوترة بالسيستم':'اختر'
    };
    Object.entries(config).forEach(([header,ph])=>{
      const vals=valuesFor(header,rows);
      const id=fieldId(header);
      const el=$(id) || findFieldByLabel(header);
      if(!el) return;
      if(el.tagName==='SELECT') setOptions(el, vals, ph);
      else inputDatalist(el, vals, header);
    });
  }
  function hydrateFilters(rows){
    const filterMap={
      orderProjectFilterV233:['المشروع','كل المشاريع'],
      orderExecutorFilterV233:['المنفذ','كل المنفذين'],
      orderSenderFilterV233:['مرسل الطلب','كل مرسلي الطلب'],
      orderStatusFilterV233:['حالة التنفيذ','كل الحالات'],
      orderPaymentFilterV233:['حالة السداد','كل حالات السداد'],
      orderBillingFilterV233:['فوترة بالسيستم','كل الفواتير']
    };
    Object.entries(filterMap).forEach(([id,[header,ph]])=>{
      const el=$(id); if(!el) return;
      setOptions(el, valuesFor(header,rows), ph);
    });
    const concern=$('orderConcernFilterV10036');
    if(concern) setOptions(concern,['client:تخص العميل','association:تخص الجمعية'].map(x=>x.split(':')[1]),'كل الأنواع');
  }
  let cacheRows=[];
  async function hydrateAll(){
    const rows=await fetchOrders();
    cacheRows=rows;
    hydrateOrderForm(rows);
    hydrateFilters(rows);
  }
  // إعادة ملء القوائم بعد أي رسم جديد للأوردرات أو فتح الصفحة.
  const oldRender=window.renderOrdersV233;
  window.renderOrdersV233=function(){
    const r=typeof oldRender==='function'?oldRender.apply(this,arguments):undefined;
    setTimeout(()=>{hydrateOrderForm(cacheRows); hydrateFilters(cacheRows);},80);
    return r;
  };
  const oldShow=window.showPage;
  window.showPage=function(id,btn){
    const r=typeof oldShow==='function'?oldShow.apply(this,arguments):undefined;
    if(id==='orders'||id==='ordersPage'||id==='ordersRoot') setTimeout(hydrateAll,120);
    return r;
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(hydrateAll,700),{once:true});
  else setTimeout(hydrateAll,500);
  window.addEventListener('load',()=>setTimeout(hydrateAll,1000),{once:true});
  console.log('Loaded '+VERSION);
})();

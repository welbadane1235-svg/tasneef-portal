/* Tasneef v10111 - Orders Inventory Movement Link
   Scope: ORDERS + INVENTORY LINK ONLY
   - Adds separate order field: تكلفة المخزن.
   - When typing an order number in inventory movement distribution, shows a smart order confirmation screen.
   - If confirmed, links the distribution to the order number and updates order inventory cost from inventory_movements.
   - Does not change the normal order cost field, finance calculations, tickets, contracts, monthly times, or permissions.
*/
(function(){
  'use strict';
  if(window.__tasneefOrdersInventoryLinkV10111) return;
  window.__tasneefOrdersInventoryLinkV10111 = true;

  const VERSION='v10111-orders-inventory-link';
  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const ORDERS_TABLE='orders_shared';
  const MOVEMENTS_TABLE='inventory_movements';
  const VAT=0.15;
  const EXTRA_FIELD='تكلفة المخزن';
  const EXTRA_BEFORE='تكلفة المخزن قبل الضريبة';
  const EXTRA_VAT='ضريبة تكلفة المخزن';
  const EXTRA_AFTER='تكلفة المخزن شامل الضريبة';

  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const N=v=>{ const n=Number(S(v).replace(/,/g,'').replace(/[^0-9.\-]/g,'')); return Number.isFinite(n)?n:0; };
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=v=>N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';
  const normalizeNo=v=>S(v).replace(/\s+/g,'').toUpperCase();
  const nowIso=()=>new Date().toISOString();
  function $(id){return document.getElementById(id)}
  function say(text,type){ try{ if(typeof window.msg==='function') window.msg(text,type); else console.log(text); }catch(_){ console.log(text); } }
  function fieldId(header){
    try{return 'orderFieldV233_'+btoa(unescape(encodeURIComponent(header))).replace(/=+$/,'').replace(/[^a-zA-Z0-9]/g,'_');}
    catch(_){return 'orderFieldV233_'+header.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g,'_');}
  }
  async function api(path, options){
    return fetch(SUPABASE_URL+path, Object.assign({
      cache:'no-store',
      headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY,Accept:'application/json','Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'}
    }, options||{}));
  }
  async function fetchOrder(orderNo){
    const no=normalizeNo(orderNo); if(!no) return null;
    const res=await api('/rest/v1/'+ORDERS_TABLE+'?select=order_no,data,flow,updated_at&order_no=eq.'+encodeURIComponent(no)+'&limit=1',{method:'GET'});
    if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
    const arr=await res.json();
    return arr && arr[0] ? arr[0] : null;
  }
  async function saveOrderData(orderNo, data, flow){
    const no=normalizeNo(orderNo); if(!no) throw new Error('رقم الأوردر غير موجود');
    const payload={order_no:no,data:data||{},flow:flow||{},updated_at:nowIso(),updated_by:VERSION};
    const res=await api('/rest/v1/'+ORDERS_TABLE+'?on_conflict=order_no',{method:'POST',body:JSON.stringify(payload)});
    if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
    return (await res.json())[0];
  }
  function parseMovementMeta(notes){
    const raw=S(notes);
    const json = raw.includes('finance_pro_v15:') ? raw.split('finance_pro_v15:').pop() : raw;
    try{return JSON.parse(json)||{};}catch(_){return {};}
  }
  function rowOrderMatches(v, orderNo){ return normalizeNo(v)===normalizeNo(orderNo); }
  function movementUnitCost(m){ return N(m.unit_cost||m.cost||m.price||m.unit_price); }
  function costType(t){ return ['out','consume','waste','damaged','scrap'].includes(S(t)); }
  function movementCostForOrder(m, orderNo){
    const meta=parseMovementMeta(m.notes);
    const dist=A(meta.distribution);
    let total=0;
    if(dist.length){
      dist.forEach(d=>{
        const dOrder=S(d.orderNo||d.order_no||d.order||'');
        const type=S(d.type||m.movement_type);
        if(rowOrderMatches(dOrder,orderNo) && costType(type)) total += N(d.qty||d.quantity) * movementUnitCost(m);
      });
      return total;
    }
    if(rowOrderMatches(m.order_no||m.orderNo||m.order||'',orderNo) && costType(m.movement_type)){
      total += N(m.quantity) * movementUnitCost(m);
    }
    return total;
  }
  async function fetchRecentMovements(){
    const res=await api('/rest/v1/'+MOVEMENTS_TABLE+'?select=*&order=id.desc&limit=10000',{method:'GET'});
    if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
    return await res.json();
  }
  async function computeInventoryCost(orderNo){
    const rows=await fetchRecentMovements();
    const before=A(rows).reduce((a,m)=>a+movementCostForOrder(m,orderNo),0);
    return {before:+before.toFixed(2), vat:+(before*VAT).toFixed(2), after:+(before*(1+VAT)).toFixed(2)};
  }
  async function syncOrderInventoryCost(orderNo){
    const no=normalizeNo(orderNo); if(!no) return null;
    const [rec,cost]=await Promise.all([fetchOrder(no), computeInventoryCost(no)]);
    if(!rec) throw new Error('لم يتم العثور على الأوردر '+no);
    const data=Object.assign({}, rec.data||{});
    data[EXTRA_FIELD]=cost.before;
    data[EXTRA_BEFORE]=cost.before;
    data[EXTRA_VAT]=cost.vat;
    data[EXTRA_AFTER]=cost.after;
    data.__inventory_cost_linked = true;
    data.__inventory_cost_updated_at = nowIso();
    await saveOrderData(no,data,rec.flow||{});
    setInventoryCostField(cost.before);
    say('تم تحديث تكلفة المخزن للأوردر '+no+' = '+money(cost.before),'ok');
    return cost;
  }

  function setInventoryCostField(v){ const el=$('orderInventoryCostV10111'); if(el) el.value = v===''?'':N(v).toFixed(2); }
  function getOrderNoFromForm(){ return normalizeNo(($('orderNoV233')&&$('orderNoV233').value) || ''); }
  function injectOrderInventoryField(){
    if($('orderInventoryCostV10111')) return;
    const costEl=$(fieldId('التكلفة'));
    const ref=(costEl&&costEl.parentElement) || $(fieldId('الربح'))?.parentElement || document.querySelector('#orders form .smart-grid div, #orders .smart-grid div');
    if(!ref) return;
    const box=document.createElement('div');
    box.id='orderInventoryCostBoxV10111';
    box.innerHTML='<label>تكلفة المخزن</label><input id="orderInventoryCostV10111" type="number" step="0.01" readonly placeholder="تلقائي من حركة المخزون"><small style="display:block;color:#60706a;margin-top:4px">منفصلة عن خانة التكلفة ولا تؤثر عليها.</small>';
    ref.insertAdjacentElement('afterend',box);
  }
  async function refreshOrderCostFieldFromServer(){
    injectOrderInventoryField();
    const no=getOrderNoFromForm(); if(!no) { setInventoryCostField(''); return; }
    try{
      const rec=await fetchOrder(no);
      const data=rec?.data||{};
      if(data[EXTRA_FIELD]!==undefined && data[EXTRA_FIELD]!==null && data[EXTRA_FIELD]!=='') setInventoryCostField(data[EXTRA_FIELD]);
      else { const c=await computeInventoryCost(no); setInventoryCostField(c.before); }
    }catch(e){ console.warn(VERSION,e); }
  }
  function patchOrderFormSaveAndEdit(){
    injectOrderInventoryField();
    const oldEdit=window.editOrderV233;
    if(typeof oldEdit==='function' && !oldEdit.__v10111){
      window.editOrderV233=function(){ const r=oldEdit.apply(this,arguments); setTimeout(refreshOrderCostFieldFromServer,180); return r; };
      window.editOrderV233.__v10111=true;
    }
    const oldClear=window.clearOrderFormV233;
    if(typeof oldClear==='function' && !oldClear.__v10111){
      window.clearOrderFormV233=function(){ const r=oldClear.apply(this,arguments); setTimeout(()=>{injectOrderInventoryField(); setInventoryCostField('');},80); return r; };
      window.clearOrderFormV233.__v10111=true;
    }
    const oldSave=window.saveOrderV233;
    if(typeof oldSave==='function' && !oldSave.__v10111){
      window.saveOrderV233=async function(){
        const noBefore=getOrderNoFromForm();
        const invBefore=N($('orderInventoryCostV10111')?.value);
        const r=await oldSave.apply(this,arguments);
        try{
          if(noBefore){
            const rec=await fetchOrder(noBefore);
            if(rec){
              const data=Object.assign({},rec.data||{});
              if(invBefore>0 && !N(data[EXTRA_FIELD])) data[EXTRA_FIELD]=invBefore;
              data[EXTRA_BEFORE]=N(data[EXTRA_FIELD]);
              data[EXTRA_VAT]=+(N(data[EXTRA_FIELD])*VAT).toFixed(2);
              data[EXTRA_AFTER]=+(N(data[EXTRA_FIELD])*(1+VAT)).toFixed(2);
              await saveOrderData(noBefore,data,rec.flow||{});
            }
          }
        }catch(e){ console.warn(VERSION,'post-save inventory field failed',e); }
        return r;
      };
      window.saveOrderV233.__v10111=true;
    }
    ['orderNoV233','orderGroupNoV233'].forEach(id=>{
      const el=$(id); if(el && !el.__v10111){ el.__v10111=true; el.addEventListener('change',refreshOrderCostFieldFromServer); el.addEventListener('blur',refreshOrderCostFieldFromServer); }
    });
  }

  function selectProjectByName(projectName){
    const sel=$('finDistProjectV15'); if(!sel||!projectName) return;
    const target=S(projectName).toLowerCase();
    for(const opt of sel.options){ if(S(opt.textContent).toLowerCase()===target || S(opt.textContent).toLowerCase().includes(target)){ sel.value=opt.value; return; } }
  }
  function orderSummaryHtml(rec){
    const d=rec?.data||{};
    const no=normalizeNo(rec?.order_no||d['رقم الطلب']);
    return '<div class="v10111-order-card"><h3>تأكيد ربط حركة المخزون بالأوردر</h3><div class="v10111-grid">'+
      '<div><small>رقم الأوردر</small><b>'+esc(no||'-')+'</b></div>'+
      '<div><small>رقم القروب</small><b>'+esc(d['رقم الطلب بالجروب']||'-')+'</b></div>'+
      '<div><small>المشروع</small><b>'+esc(d['المشروع']||'-')+'</b></div>'+
      '<div><small>العميل</small><b>'+esc(d['اسم العميل']||'-')+'</b></div>'+
      '<div><small>المنفذ</small><b>'+esc(d['المنفذ']||'-')+'</b></div>'+
      '<div><small>حالة التنفيذ</small><b>'+esc(d['حالة التنفيذ']||'-')+'</b></div>'+
      '</div><p>'+esc(d['التفاصيل']||'')+'</p></div>';
  }
  function smartConfirmOrder(rec){
    return new Promise(resolve=>{
      const wrap=document.createElement('div');
      wrap.className='v10111-backdrop';
      wrap.innerHTML='<div class="v10111-modal">'+orderSummaryHtml(rec)+'<div class="v10111-actions"><button id="v10111Yes">نعم ربط الحركة</button><button class="light" id="v10111No">لا</button></div></div>';
      document.body.appendChild(wrap);
      wrap.querySelector('#v10111Yes').onclick=()=>{wrap.remove(); resolve(true);};
      wrap.querySelector('#v10111No').onclick=()=>{wrap.remove(); resolve(false);};
      wrap.addEventListener('click',e=>{ if(e.target===wrap){wrap.remove(); resolve(false);} });
    });
  }
  async function checkInventoryOrderNo(){
    const input=$('finDistOrderV15'); if(!input) return false;
    const no=normalizeNo(input.value); if(!no) return true;
    if(input.dataset.v10111Confirmed===no) return true;
    try{
      const rec=await fetchOrder(no);
      if(!rec){ alert('لم يتم العثور على الأوردر: '+no); return false; }
      const ok=await smartConfirmOrder(rec);
      if(ok){
        input.dataset.v10111Confirmed=no;
        selectProjectByName(rec.data?.['المشروع']);
        input.classList.add('v10111-linked');
        return true;
      }
      return false;
    }catch(e){ alert('تعذر فحص الأوردر: '+(e.message||e)); return false; }
  }
  function collectOrderNosFromMovementScreen(){
    const set=new Set();
    const inp=S($('finDistOrderV15')?.value); if(inp) set.add(normalizeNo(inp));
    const box=$('finDistributionBoxV15');
    if(box){
      const text=box.innerText||'';
      (text.match(/ORD\s*[-_]?\s*\d+/gi)||[]).forEach(x=>set.add(normalizeNo(x)));
      [...box.querySelectorAll('td,span,b,div')].forEach(el=>{ const t=S(el.textContent); if(/^ORD/i.test(t)) set.add(normalizeNo(t)); });
    }
    return [...set].filter(Boolean);
  }
  function patchInventoryMovementLink(){
    const oldAdd=window.financeProAddDistributionV15;
    if(typeof oldAdd==='function' && !oldAdd.__v10111){
      window.financeProAddDistributionV15=async function(){
        const ok=await checkInventoryOrderNo();
        if(!ok) return false;
        return oldAdd.apply(this,arguments);
      };
      window.financeProAddDistributionV15.__v10111=true;
    }
    const oldSave=window.financeProSaveMovementV15;
    if(typeof oldSave==='function' && !oldSave.__v10111){
      window.financeProSaveMovementV15=async function(){
        const linkedOrders=collectOrderNosFromMovementScreen();
        const r=await oldSave.apply(this,arguments);
        setTimeout(()=>{ linkedOrders.forEach(no=>syncOrderInventoryCost(no).catch(e=>console.warn(VERSION,e))); },900);
        return r;
      };
      window.financeProSaveMovementV15.__v10111=true;
    }
    const input=$('finDistOrderV15');
    if(input && !input.__v10111){
      input.__v10111=true;
      input.addEventListener('blur',()=>{ if(S(input.value)) checkInventoryOrderNo(); });
      input.addEventListener('change',()=>{ delete input.dataset.v10111Confirmed; if(S(input.value)) checkInventoryOrderNo(); });
    }
  }
  function installCss(){
    if($('v10111Css')) return;
    const st=document.createElement('style'); st.id='v10111Css';
    st.textContent=`#orderInventoryCostBoxV10111 input{background:#f3faf6!important;border-color:#b9dfcf!important;font-weight:900;color:#064c3b}.v10111-linked{border-color:#0b7a53!important;background:#f1fff8!important}.v10111-backdrop{position:fixed;inset:0;background:rgba(0,35,28,.48);z-index:999999;display:grid;place-items:center;padding:18px}.v10111-modal{width:min(760px,96vw);background:#fff;border-radius:20px;padding:18px;box-shadow:0 22px 80px rgba(0,0,0,.25);direction:rtl}.v10111-order-card h3{margin:0 0 12px;color:#063f32}.v10111-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px}.v10111-grid div{border:1px solid #dcebe5;border-radius:12px;padding:9px;background:#f8fbfa}.v10111-grid small{display:block;color:#60706a;margin-bottom:4px}.v10111-grid b{color:#063f32}.v10111-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}`;
    document.head.appendChild(st);
  }
  function boot(){
    installCss();
    patchOrderFormSaveAndEdit();
    patchInventoryMovementLink();
    injectOrderInventoryField();
  }
  const oldShow=window.showPage;
  if(typeof oldShow==='function' && !oldShow.__v10111){
    window.showPage=function(){ const r=oldShow.apply(this,arguments); setTimeout(boot,150); return r; };
    window.showPage.__v10111=true;
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,700),{once:true}); else setTimeout(boot,500);
  window.addEventListener('load',()=>setTimeout(boot,1000),{once:true});
  setInterval(()=>{ try{boot();}catch(_){} },2500);

  window.tasneefSyncOrderInventoryCostV10111=syncOrderInventoryCost;
  console.log('Loaded '+VERSION);
})();

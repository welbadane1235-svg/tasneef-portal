/* Tasneef v10114 - Orders Inventory Cost Affects Profit
   Scope: ORDERS PROFIT CALC ONLY.
   - Makes تكلفة المخزن affect الربح.
   - Does not change price, VAT, normal cost, inventory movements, finance, tickets, contracts, monthly, permissions.
*/
(function(){
  'use strict';
  if(window.__tasneefOrdersInventoryProfitV10114) return;
  window.__tasneefOrdersInventoryProfitV10114 = true;

  const VERSION='v10114-orders-inventory-cost-affects-profit';
  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const TABLE='orders_shared';
  const VAT=0.15;
  const EXTRA_FIELD='تكلفة المخزن';
  const EXTRA_BEFORE='تكلفة المخزن قبل الضريبة';
  const EXTRA_VAT='ضريبة تكلفة المخزن';
  const EXTRA_AFTER='تكلفة المخزن شامل الضريبة';

  const S=v=>String(v??'').trim();
  const N=v=>{ const n=Number(S(v).replace(/,/g,'').replace(/[^0-9.\-]/g,'')); return Number.isFinite(n)?n:0; };
  const normalizeNo=v=>S(v).replace(/\s+/g,'').toUpperCase();
  const nowIso=()=>new Date().toISOString();
  function $(id){return document.getElementById(id)}
  function say(text,type){ try{ if(typeof window.msg==='function') window.msg(text,type); else console.log(text); }catch(_){ console.log(text); } }
  function fieldId(header){
    try{return 'orderFieldV233_'+btoa(unescape(encodeURIComponent(header))).replace(/=+$/,'').replace(/[^a-zA-Z0-9]/g,'_');}
    catch(_){return 'orderFieldV233_'+header.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g,'_');}
  }
  function setVal(id,v){ const el=$(id); if(el) el.value = (v===''?'':String(v)); }
  function getVal(header){ const el=$(fieldId(header)); return el ? el.value : ''; }
  function setHeaderVal(header,v){ setVal(fieldId(header), v); }
  function calcFromValues(inc,cost,inv){
    inc=N(inc); cost=N(cost); inv=N(inv);
    const before = inc ? +(inc/(1+VAT)).toFixed(2) : 0;
    const vat = inc ? +(inc-before).toFixed(2) : 0;
    const profit = +(before - cost - inv).toFixed(2);
    return {inc,before,vat,cost,inv,profit};
  }
  function currentOrderNo(){ return normalizeNo(($('orderNoV233')&&$('orderNoV233').value) || ''); }
  function inventoryCostValue(){ return N(($('orderInventoryCostV10111')&&$('orderInventoryCostV10111').value) || getVal(EXTRA_FIELD)); }

  function recalcOrderFormProfit(){
    const incEl=$(fieldId('السعر (شامل الضريبة)'));
    const costEl=$(fieldId('التكلفة'));
    const profitEl=$(fieldId('الربح'));
    if(!incEl || !costEl || !profitEl) return null;
    const c=calcFromValues(incEl.value, costEl.value, inventoryCostValue());
    setHeaderVal('السعر قبل الضريبة', c.before.toFixed(2));
    setHeaderVal('الضريبة 15%', c.vat.toFixed(2));
    setHeaderVal('الربح', c.profit.toFixed(2));
    const note=document.querySelector('#orderInventoryCostBoxV10111 small');
    if(note){ note.textContent='منفصلة عن خانة التكلفة ولكنها تؤثر على الربح.'; note.style.color='#0A4033'; note.style.fontWeight='800'; }
    return c;
  }

  async function api(path, options){
    return fetch(SUPABASE_URL+path, Object.assign({
      cache:'no-store',
      headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY,Accept:'application/json','Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'}
    }, options||{}));
  }
  async function fetchOrder(orderNo){
    const no=normalizeNo(orderNo); if(!no) return null;
    const res=await api('/rest/v1/'+TABLE+'?select=order_no,data,flow,updated_at&order_no=eq.'+encodeURIComponent(no)+'&limit=1',{method:'GET'});
    if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
    const arr=await res.json();
    return arr && arr[0] ? arr[0] : null;
  }
  async function saveOrderData(orderNo, data, flow){
    const no=normalizeNo(orderNo); if(!no) throw new Error('رقم الأوردر غير موجود');
    const payload={order_no:no,data:data||{},flow:flow||{},updated_at:nowIso(),updated_by:VERSION};
    const res=await api('/rest/v1/'+TABLE+'?on_conflict=order_no',{method:'POST',body:JSON.stringify(payload)});
    if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
    return (await res.json())[0];
  }
  function calcFromOrderData(data){
    data=data||{};
    const c=calcFromValues(data['السعر (شامل الضريبة)'], data['التكلفة'], data[EXTRA_FIELD] ?? data[EXTRA_BEFORE]);
    data['السعر قبل الضريبة']=c.before;
    data['الضريبة 15%']=c.vat;
    data['الربح']=c.profit;
    data[EXTRA_FIELD]=c.inv;
    data[EXTRA_BEFORE]=c.inv;
    data[EXTRA_VAT]=+(c.inv*VAT).toFixed(2);
    data[EXTRA_AFTER]=+(c.inv*(1+VAT)).toFixed(2);
    data.__inventory_cost_affects_profit = true;
    data.__inventory_profit_updated_at = nowIso();
    return data;
  }
  async function updateSavedOrderProfit(orderNo){
    const rec=await fetchOrder(orderNo);
    if(!rec) return;
    const data=calcFromOrderData(Object.assign({},rec.data||{}));
    await saveOrderData(orderNo,data,rec.flow||{});
  }

  function bindProfitInputs(){
    ['السعر (شامل الضريبة)','التكلفة','الربح','السعر قبل الضريبة','الضريبة 15%'].forEach(h=>{
      const el=$(fieldId(h));
      if(el && !el.__v10114){ el.__v10114=true; el.addEventListener('input',recalcOrderFormProfit); el.addEventListener('change',recalcOrderFormProfit); }
    });
    const inv=$('orderInventoryCostV10111');
    if(inv && !inv.__v10114){ inv.__v10114=true; inv.addEventListener('input',recalcOrderFormProfit); inv.addEventListener('change',recalcOrderFormProfit); }
    const no=$('orderNoV233');
    if(no && !no.__v10114){ no.__v10114=true; no.addEventListener('change',()=>setTimeout(recalcOrderFormProfit,400)); no.addEventListener('blur',()=>setTimeout(recalcOrderFormProfit,400)); }
    recalcOrderFormProfit();
  }

  function patchSaveAndEdit(){
    if(typeof window.saveOrderV233==='function' && !window.saveOrderV233.__v10114){
      const old=window.saveOrderV233;
      window.saveOrderV233=async function(){
        bindProfitInputs();
        recalcOrderFormProfit();
        const noBefore=currentOrderNo();
        const result=await old.apply(this,arguments);
        try{ if(noBefore) await updateSavedOrderProfit(noBefore); }catch(e){ console.warn(VERSION,'post-save profit update failed',e); say('تنبيه: حفظ الأوردر تم، لكن تحديث الربح بعد تكلفة المخزن لم يكتمل: '+(e.message||e),'err'); }
        return result;
      };
      window.saveOrderV233.__v10114=true;
    }
    if(typeof window.editOrderV233==='function' && !window.editOrderV233.__v10114){
      const oldEdit=window.editOrderV233;
      window.editOrderV233=function(){ const r=oldEdit.apply(this,arguments); setTimeout(()=>{ bindProfitInputs(); recalcOrderFormProfit(); },450); return r; };
      window.editOrderV233.__v10114=true;
    }
    if(typeof window.tasneefSyncOrderInventoryCostV10111==='function' && !window.tasneefSyncOrderInventoryCostV10111.__v10114){
      const oldSync=window.tasneefSyncOrderInventoryCostV10111;
      window.tasneefSyncOrderInventoryCostV10111=async function(orderNo){
        const r=await oldSync.apply(this,arguments);
        try{ await updateSavedOrderProfit(orderNo); }catch(e){ console.warn(VERSION,'sync profit failed',e); }
        setTimeout(recalcOrderFormProfit,250);
        return r;
      };
      window.tasneefSyncOrderInventoryCostV10111.__v10114=true;
    }
  }

  function boot(){ bindProfitInputs(); patchSaveAndEdit(); }
  setInterval(boot,1200);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,600)); else setTimeout(boot,600);
  window.addEventListener('load',()=>setTimeout(boot,1200));
  console.log('Loaded '+VERSION);
})();

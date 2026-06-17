/* Tasneef v10176 - Finance multi product movement boxes
   Safe add-on: adds professional multi-product movement boxes without changing single movement logic.
*/
(function(){
  'use strict';
  const VERSION='v10176-multi-product-boxes';
  if(window.__tasneefFinanceMultiBoxesV10176) return;
  window.__tasneefFinanceMultiBoxesV10176=true;

  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const N=v=>Number(v||0)||0;
  const VAT=0.15;
  const today=()=>new Date().toISOString().slice(0,10);
  const client=()=>window.sb||window.supabaseClient||window.supabase||null;
  const st=()=>window.financeProStateV15||{};
  const msg=(t,type)=>{try{if(typeof window.msg==='function')window.msg(t,type);}catch(_){}};
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const safeJson=v=>{const t=S(v); if(!t.startsWith('finance_pro_v15:'))return{}; try{return JSON.parse(t.replace('finance_pro_v15:',''))||{};}catch(_){return{};}};
  const currentUser=()=>{try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};}};
  const currentUserName=()=>{const u=currentUser(); return S(u.full_name||u.name||u.username||u.email||u.id||'');};
  const itemCode=i=>S(i&&(i.product_code||i.serial_number||i.barcode||i.supplier_barcode||i.distributor_code||i.code));
  const itemCost=i=>N(i&&(i.unit_cost||i.cost||i.price||i.purchase_price));
  const projectName=id=>A(st().projects).find(p=>String(p.id)===String(id))?.name||A(st().projects).find(p=>String(p.id)===String(id))?.project_name||'';
  const staffName=id=>A(st().users).find(u=>String(u.id)===String(id))?.full_name||A(st().users).find(u=>String(u.id)===String(id))?.name||A(st().users).find(u=>String(u.id)===String(id))?.username||S(id)||'-';
  const moveSign=t=>{t=S(t); if(t==='return')return 1; if(['out','consume','waste','damaged','scrap'].includes(t))return -1; return 0;};
  const reasonFor=t=>({return:'مرتجع مخزون',consume:'مستهلك',waste:'مهدور',damaged:'تالف',scrap:'سكراب',out:'صرف مخزون'})[S(t)]||'صرف مخزون';
  const labelFor=t=>({return:'مرتجع',consume:'مستهلك',waste:'مهدور',damaged:'تالف',scrap:'سكراب',out:'صرف'})[S(t)]||S(t)||'-';
  const money=v=>`${N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س`;

  let blocks=[];
  function productItems(){
    const items=A(st().items);
    return items.filter(i=>i&&S(i.id));
  }
  function itemById(id){return productItems().find(i=>String(i.id)===String(id));}
  function nextOperationNo(){
    let max=0;
    A(st().movements).forEach(m=>{const mt=S((safeJson(m.notes)||{}).operationNo).match(/MOV[-_ ]?(\d+)/i); if(mt)max=Math.max(max,N(mt[1]));});
    return 'MOV-'+String(max+1).padStart(6,'0');
  }
  function newBlock(){return {id:'b'+Date.now()+Math.floor(Math.random()*9999), item_id:'', qty:0, rows:[newDistRow()]};}
  function newDistRow(){return {qty:0,project_id:'',staff_id:'',center:'FM',type:'out'};}
  function ensureInitial(){if(!blocks.length)blocks.push(newBlock());}

  function optionsProducts(selected){
    return `<option value="">اختر المنتج</option>`+productItems().map(i=>`<option value="${esc(i.id)}" ${String(selected)===String(i.id)?'selected':''}>${esc(i.name||itemCode(i)||i.id)} - المتوفر ${N(i.quantity)}</option>`).join('');
  }
  function optionsProjects(selected){
    return `<option value="">بدون مشروع</option>`+A(st().projects).map(p=>`<option value="${esc(p.id)}" ${String(selected)===String(p.id)?'selected':''}>${esc(p.name||p.project_name||p.id)}</option>`).join('');
  }
  function optionsStaff(selected){
    return `<option value="">اختر المشرف</option>`+A(st().users).map(u=>`<option value="${esc(u.id)}" ${String(selected)===String(u.id)?'selected':''}>${esc(u.full_name||u.name||u.username||u.email||u.id)}</option>`).join('');
  }
  function distSum(b){return A(b.rows).reduce((a,r)=>a+N(r.qty),0);}
  function netDelta(b){return A(b.rows).reduce((a,r)=>a+N(r.qty)*moveSign(r.type),0);}
  function blockStatus(b){
    const item=itemById(b.item_id), sum=distSum(b), qty=N(b.qty), delta=netDelta(b), after=item?N(item.quantity)+delta:0;
    if(!b.item_id) return {cls:'bad',txt:'اختر المنتج'};
    if(qty<=0) return {cls:'bad',txt:'أدخل الكمية'};
    if(Math.abs(sum-qty)>.001) return {cls:'warn',txt:`التوزيع ${sum} من ${qty}`};
    if(item && after<0) return {cls:'bad',txt:'الرصيد لا يكفي'};
    return {cls:'ok',txt:'جاهز للحفظ'};
  }
  function syncFromDom(){
    blocks.forEach(b=>{
      b.item_id=S($(`mb_item_${b.id}`)?.value)||b.item_id;
      b.qty=N($(`mb_qty_${b.id}`)?.value)||0;
      b.rows.forEach((r,idx)=>{
        r.qty=N($(`mb_rqty_${b.id}_${idx}`)?.value)||0;
        r.project_id=S($(`mb_proj_${b.id}_${idx}`)?.value);
        r.staff_id=S($(`mb_staff_${b.id}_${idx}`)?.value);
        r.center=S($(`mb_center_${b.id}_${idx}`)?.value)||'FM';
        r.type=S($(`mb_type_${b.id}_${idx}`)?.value)||'out';
      });
    });
  }
  function renderBlocks(){
    const host=$('finMultiBoxesRows10176'); if(!host)return;
    ensureInitial();
    host.innerHTML=blocks.map((b,bi)=>{
      const item=itemById(b.item_id), status=blockStatus(b), after=item?N(item.quantity)+netDelta(b):0;
      const rows=A(b.rows).map((r,ri)=>`<div class="mb-row">
        <div><label>الكمية</label><input type="number" min="0" step="0.01" id="mb_rqty_${b.id}_${ri}" value="${N(r.qty)||''}" oninput="financeMultiBoxesSync10176()"></div>
        <div><label>المشروع</label><select id="mb_proj_${b.id}_${ri}">${optionsProjects(r.project_id)}</select></div>
        <div><label>المشرف</label><select id="mb_staff_${b.id}_${ri}">${optionsStaff(r.staff_id)}</select></div>
        <div><label>مركز التكلفة</label><select id="mb_center_${b.id}_${ri}"><option ${r.center==='FM'?'selected':''}>FM</option><option ${r.center==='CN'?'selected':''}>CN</option><option ${r.center==='GENERAL'?'selected':''}>GENERAL</option></select></div>
        <div><label>الحركة</label><select id="mb_type_${b.id}_${ri}" onchange="financeMultiBoxesSync10176()"><option value="out" ${r.type==='out'?'selected':''}>صرف</option><option value="consume" ${r.type==='consume'?'selected':''}>مستهلك</option><option value="return" ${r.type==='return'?'selected':''}>مرتجع</option><option value="damaged" ${r.type==='damaged'?'selected':''}>تالف</option><option value="waste" ${r.type==='waste'?'selected':''}>مهدور</option><option value="scrap" ${r.type==='scrap'?'selected':''}>سكراب</option></select></div>
        <button type="button" class="danger" onclick="financeMultiBoxesRemoveDist10176('${b.id}',${ri})">حذف</button>
      </div>`).join('');
      return `<div class="mb-box">
        <div class="mb-head"><h4>منتج ${bi+1}</h4><span class="mb-badge ${status.cls}">${esc(status.txt)}</span></div>
        <div class="mb-main">
          <div><label>اسم المنتج</label><select id="mb_item_${b.id}" onchange="financeMultiBoxesSync10176()">${optionsProducts(b.item_id)}</select></div>
          <div><label>كمية المنتج</label><input type="number" min="0" step="0.01" id="mb_qty_${b.id}" value="${N(b.qty)||''}" oninput="financeMultiBoxesSync10176()"></div>
          <div class="mb-kpi"><small>المتوفر</small><b>${item?N(item.quantity):'-'}</b></div>
          <div class="mb-kpi"><small>بعد الحركة</small><b>${item?N(after):'-'}</b></div>
          <button type="button" class="danger" onclick="financeMultiBoxesRemoveProduct10176('${b.id}')">حذف المنتج</button>
        </div>
        <div class="mb-title">توزيع المنتج</div>
        ${rows}
        <button type="button" class="light" onclick="financeMultiBoxesAddDist10176('${b.id}')">+ إضافة توزيع لهذا المنتج</button>
      </div>`;
    }).join('');
  }
  window.financeMultiBoxesSync10176=function(){syncFromDom(); renderBlocks();};
  window.financeMultiBoxesAddProduct10176=function(){syncFromDom(); blocks.push(newBlock()); renderBlocks();};
  window.financeMultiBoxesRemoveProduct10176=function(id){syncFromDom(); blocks=blocks.filter(b=>b.id!==id); ensureInitial(); renderBlocks();};
  window.financeMultiBoxesAddDist10176=function(id){syncFromDom(); const b=blocks.find(x=>x.id===id); if(b)b.rows.push(newDistRow()); renderBlocks();};
  window.financeMultiBoxesRemoveDist10176=function(id,idx){syncFromDom(); const b=blocks.find(x=>x.id===id); if(b){b.rows.splice(idx,1); if(!b.rows.length)b.rows.push(newDistRow());} renderBlocks();};
  window.financeMultiBoxesClear10176=function(){blocks=[newBlock()]; renderBlocks();};

  function patchStateItem(row){
    const state=st(); state.items=A(state.items); const idx=state.items.findIndex(i=>String(i.id)===String(row.id));
    if(idx>=0) state.items[idx]={...state.items[idx],...row}; else state.items.push(row);
  }
  function patchStateMovements(rows){
    const state=st(); state.movements=A(state.movements);
    A(rows).forEach(row=>{const idx=state.movements.findIndex(m=>String(m.id)===String(row.id)); if(idx>=0)state.movements[idx]={...state.movements[idx],...row}; else state.movements.push(row);});
  }
  function refresh(){
    try{ if(typeof window.financeProRenderCurrentV15==='function') window.financeProRenderCurrentV15(); }
    catch(_){ try{ if(typeof window.financeProTabV15==='function') window.financeProTabV15('movement'); }catch(__){} }
    setTimeout(injectUI,120);
  }
  window.financeMultiBoxesSave10176=async function(btn){
    const started=performance.now();
    try{
      syncFromDom();
      const c=client(); if(!c)throw new Error('الاتصال غير جاهز');
      const valid=blocks.filter(b=>b.item_id&&N(b.qty)>0);
      if(!valid.length) throw new Error('أضف منتج واحد على الأقل');
      for(const b of valid){
        const item=itemById(b.item_id); if(!item)throw new Error('منتج غير معروف في العملية');
        if(Math.abs(distSum(b)-N(b.qty))>.001)throw new Error(`مجموع توزيع ${item.name} يجب أن يساوي كمية المنتج`);
        if(N(item.quantity)+netDelta(b)<0)throw new Error(`الكمية لا تكفي للمنتج: ${item.name}`);
      }
      if(btn){btn.disabled=true; btn.dataset.oldText=btn.textContent||''; btn.textContent='جاري الحفظ السريع...';}
      const operationNo=nextOperationNo(), user=currentUserName(), now=new Date().toISOString();
      const movementRows=[];
      const updates=[];
      for(const b of valid){
        const item=itemById(b.item_id);
        const prodSeq=valid.indexOf(b)+1;
        A(b.rows).filter(r=>N(r.qty)>0).forEach((r,ri)=>{
          const projName=projectName(r.project_id);
          const supervisor=staffName(r.staff_id);
          const dist=[{qty:N(r.qty),projectId:S(r.project_id),projectName:projName,center:S(r.center)||'FM',type:S(r.type)||'out',staffId:S(r.staff_id),staffName:supervisor,note:''}];
          const meta={module:VERSION,operationNo,isMultiProductBox:true,productSeq:prodSeq,rowSeq:ri+1,batchCount:valid.length,staffId:S(r.staff_id),note:'',distribution:dist,stockEffect:'normal',createdBy:user,createdAt:now};
          movementRows.push({item_id:item.id,item_name:item.name,movement_type:S(r.type)||'out',quantity:N(r.qty),movement_date:S($('finMoveDateV15')?.value)||today(),receiver:supervisor,reason:reasonFor(r.type),notes:'finance_pro_v15:'+JSON.stringify(meta),product_code:itemCode(item),barcode:itemCode(item),unit_cost:+itemCost(item).toFixed(4)});
        });
        updates.push({item,next:N(item.quantity)+netDelta(b)});
      }
      const ins=await c.from('inventory_movements').insert(movementRows).select('*');
      if(ins.error)throw ins.error;
      const upds=await Promise.all(updates.map(u=>c.from('inventory_items').update({quantity:u.next}).eq('id',u.item.id).select('*')));
      const bad=upds.find(r=>r&&r.error); if(bad)throw bad.error;
      upds.forEach((res,idx)=>patchStateItem(A(res.data)[0]||{...updates[idx].item,quantity:updates[idx].next}));
      patchStateMovements(A(ins.data).length?A(ins.data):movementRows);
      blocks=[newBlock()];
      refresh();
      msg('تم حفظ الحركة متعددة المنتجات: '+operationNo);
      console.log('Tasneef multi boxes save', Math.round(performance.now()-started)+'ms');
    }catch(e){alert(e.message||String(e)); msg(e.message||String(e),'err');}
    finally{if(btn){btn.disabled=false; btn.textContent=btn.dataset.oldText||'حفظ الحركة';}}
  };

  function ensureStyle(){
    if($('finMultiBoxesStyle10176'))return;
    const css=`#finMultiProductOp10175{display:none!important}.mb-wrap{border:2px solid #0d5b49;background:linear-gradient(180deg,#fbfffd,#f4faf7);border-radius:20px;padding:16px}.mb-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.mb-box{background:#fff;border:1px solid #d9e7e2;border-radius:18px;padding:14px;margin:12px 0;box-shadow:0 8px 25px rgba(7,61,49,.06)}.mb-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.mb-head h4{margin:0;color:#073d31}.mb-main{display:grid;grid-template-columns:2fr .8fr .7fr .7fr auto;gap:8px;align-items:end;margin:12px 0}.mb-row{display:grid;grid-template-columns:.7fr 1.2fr 1.2fr .9fr .9fr auto;gap:8px;align-items:end;margin:8px 0;padding:10px;border:1px solid #e2eee9;border-radius:14px;background:#f8fbfa}.mb-kpi{background:#eef7f3;border:1px solid #d9e7e2;border-radius:12px;padding:8px}.mb-kpi small{display:block;color:#667c75}.mb-kpi b{font-size:18px;color:#073d31}.mb-badge{border-radius:999px;padding:6px 10px;font-weight:800}.mb-badge.ok{background:#e6f7ec;color:#087047}.mb-badge.warn{background:#fff5d6;color:#8a5b00}.mb-badge.bad{background:#ffe7e7;color:#b42318}.mb-title{font-weight:900;color:#073d31;margin:10px 0 6px}@media(max-width:900px){.mb-main,.mb-row{grid-template-columns:1fr}}`;
    const stl=document.createElement('style'); stl.id='finMultiBoxesStyle10176'; stl.textContent=css; document.head.appendChild(stl);
  }
  function injectUI(){
    try{
      ensureStyle();
      if(S(st().tab)!=='movement')return;
      const body=$('finBodyV15'); if(!body)return;
      const old=$('finMultiProductOp10175'); if(old)old.style.display='none';
      if($('finMultiBoxes10176')){renderBlocks(); return;}
      const cards=body.querySelectorAll('.fin-card'); const target=cards[0]||body;
      const html=`<div id="finMultiBoxes10176" class="fin-card mb-wrap">
        <h3>حركة متعددة المنتجات - بوكس لكل منتج</h3>
        <p class="fin-soft">أضف كل منتج في بوكس مستقل، وتحت كل منتج أضف توزيعه: الكمية، المشروع، المشرف، مركز التكلفة، ونوع الحركة. في النهاية اضغط <b>حفظ الحركة</b>.</p>
        <div class="mb-toolbar"><button type="button" onclick="financeMultiBoxesAddProduct10176()">+ إضافة منتج</button><button type="button" class="light" onclick="financeMultiBoxesSave10176(this)">حفظ الحركة</button><button type="button" class="danger" onclick="financeMultiBoxesClear10176()">تفريغ</button></div>
        <div id="finMultiBoxesRows10176"></div>
      </div>`;
      target.insertAdjacentHTML('afterend',html);
      renderBlocks();
    }catch(e){console.warn('multi boxes inject failed',e);}
  }
  function patchHooks(){
    if(window.__finMultiBoxesHooks10176)return; window.__finMultiBoxesHooks10176=true;
    const oldRender=window.financeProRenderCurrentV15;
    if(typeof oldRender==='function')window.financeProRenderCurrentV15=function(){const r=oldRender.apply(this,arguments); setTimeout(injectUI,120); return r;};
    const oldTab=window.financeProTabV15;
    if(typeof oldTab==='function')window.financeProTabV15=function(tab){const r=oldTab.apply(this,arguments); setTimeout(injectUI,160); return r;};
  }
  function boot(){patchHooks(); injectUI();}
  let tries=0;
  const timer=setInterval(()=>{tries++; if(window.financeProStateV15){clearInterval(timer); boot();} if(tries>100){clearInterval(timer); boot();}},150);
  window.addEventListener('load',()=>setTimeout(boot,900));
})();

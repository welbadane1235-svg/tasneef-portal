/* Tasneef v10169 - Finance Product Professional Report
   Scope: المالية والمخزون فقط. لا يغير البيانات ولا ينشئ حركة جديدة. */
(function(){
  'use strict';
  if(window.__tasneefFinanceProductReportV10169) return;
  window.__tasneefFinanceProductReportV10169=true;
  const VERSION='v10169-finance-product-report-three-tables';
  const VAT=0.15;
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const N=v=>Number(v||0)||0;
  const $=id=>document.getElementById(id);
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=v=>`${N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س`;
  const state=()=>window.financeProStateV15||{};
  const moveTypes={in:'إدخال',out:'صرف',consume:'استهلاك',damaged:'تالف',waste:'هدر',scrap:'سكراب',return:'مرتجع'};
  const financialTypes=['consume','damaged','waste','scrap'];
  function safeJson(v){const t=S(v); if(!t.startsWith('finance_pro_v15:')) return {}; try{return JSON.parse(t.replace('finance_pro_v15:',''))||{};}catch(_){return{};}}
  function itemCode(i){return S(i&&(i.product_code||i.serial_number||i.barcode||i.supplier_barcode||i.code));}
  function itemCost(i){return N(i&&(i.unit_cost||i.cost||i.price||i.purchase_price));}
  function itemType(i){const raw=S(i&&(i.item_type||i.type||i.category))||'مادة'; const low=raw.toLowerCase(); if(['tool','tools','أداة','اداة','عدة','معدات'].includes(low)||['أداة','اداة','عدة','معدات'].includes(raw)) return 'أداة'; if(['machine','machines','مكينة','ماكينة'].includes(low)||['مكينة','ماكينة'].includes(raw)) return 'مكينة'; if(['material','materials','مادة','مواد'].includes(low)||['مادة','مواد'].includes(raw)) return 'مادة'; return raw;}
  function productKeys(obj){const keys=[]; [obj&&obj.id,obj&&obj.item_id,obj&&obj.product_code,obj&&obj.serial_number,obj&&obj.barcode,obj&&obj.supplier_barcode,obj&&obj.distributor_code,obj&&obj.code,obj&&obj.name,obj&&obj.item_name].forEach(v=>{const x=S(v).toLowerCase(); if(x&&!keys.includes(x)) keys.push(x);}); return keys;}
  function lockedImageUrl(item){const direct=S(item&&item.image_url); if(direct) return direct; const cache=state().imageCache||{}; for(const k of productKeys(item)){ if(S(cache[k])) return S(cache[k]); } return '';}
  function officialItemFor(obj){const keys=productKeys(obj); return A(state().items).find(i=>productKeys(i).some(k=>keys.includes(k)))||null;}
  function productItems(){
    if(typeof window.financeProGetProductItemsV10169==='function') return window.financeProGetProductItemsV10169();
    const st=state();
    if(A(st.items).length) return A(st.items);
    const map=new Map();
    A(st.movements).forEach(m=>{const key=S(m.item_id||m.product_code||m.barcode||m.item_name); if(!key||map.has(key))return; map.set(key,{id:'fb_'+map.size,name:S(m.item_name)||key,product_code:S(m.product_code)||S(m.barcode)||key,unit:'حبة',item_type:'مادة',unit_cost:N(m.unit_cost)});});
    return [...map.values()];
  }
  function movementDate(m){return S(m&&(m.movement_date||m.date||m.created_at)).slice(0,10);}
  function unitCostForMovement(m,item){const meta=safeJson(m&&m.notes)||{}; if(N(m&&m.unit_cost)>0) return N(m.unit_cost); if(N(meta.beforeVat)>0&&N(m&&m.quantity)>0) return N(meta.beforeVat)/N(m.quantity); const it=officialItemFor(m)||item; return itemCost(it);}
  function netForMovement(m,item){const meta=safeJson(m&&m.notes)||{}; if(N(meta.beforeVat)>0) return N(meta.beforeVat); return N(m&&m.quantity)*unitCostForMovement(m,item);}
  function vatForNet(net){return N(net)*VAT;}
  function projectName(id){const p=A(state().projects).find(x=>String(x.id)===String(id)); return S(p&&(p.name||p.project_name))||'';}
  function staffName(id){const u=A(state().users).find(x=>String(x.id)===String(id)); return S(u&&(u.full_name||u.name||u.username))||S(id);}
  function staffOf(m){const meta=safeJson(m&&m.notes)||{}; const id=S(meta.staffId||m.staff_id||m.supervisor_id||m.user_id||m.created_by||''); return S(m.receiver)|| (id?staffName(id):'غير محدد') || 'غير محدد';}
  function centerOf(r){return S(r.center||r.cost_center||r.project_name||r.projectName||projectName(r.project_id)||'غير محدد');}
  function projectOf(r){return S(r.project_name||r.projectName||projectName(r.project_id)||'غير محدد');}
  function movementDistributionRows(m){
    const meta=safeJson(m&&m.notes)||{}; const rows=A(meta.distribution);
    if(!rows.length) return [{...m,parent_id:m.id,distribution_index:null,base_movement_type:S(m.movement_type),project_name:S(m.project_name||projectName(m.project_id)||''),order_no:S(m.order_no||'')}];
    return rows.map((d,idx)=>({...m,parent_id:m.id,distribution_index:idx,is_distribution_row:true,base_movement_type:S(m.movement_type),movement_type:S(d.type||m.movement_type)||S(m.movement_type),quantity:N(d.qty),center:S(d.center||m.cost_center),project_id:d.projectId||m.project_id||null,project_name:S(d.projectName||projectName(d.projectId)||m.project_name||''),order_no:S(d.orderNo||m.order_no||''),distribution_note:S(d.note||'')})).filter(r=>N(r.quantity)>0);
  }
  function productMovements(item){
    const code=itemCode(item), id=S(item&&item.id), name=S(item&&item.name);
    return A(state().movements).filter(m=>String(m.item_id)===id || (code&&[m.product_code,m.barcode,m.serial_number].map(S).includes(code)) || (!m.item_id&&S(m.item_name)===name));
  }
  function productActivityRows(item){return productMovements(item).flatMap(movementDistributionRows);}
  function movementTypeLabel(t){return moveTypes[S(t)]||S(t)||'-';}
  function opNo(m){const meta=safeJson(m&&m.notes)||{}; return S(meta.invoiceNo||meta.invoice_no||m.invoice_no||m.invoice_number||m.order_no||m.id||'-');}
  function currentQty(item){
    const base=productMovements(item), rows=productActivityRows(item);
    const inQty=base.filter(m=>S(m.movement_type)==='in').reduce((a,m)=>a+N(m.quantity),0);
    const outQty=rows.filter(r=>['out','consume','damaged','waste','scrap'].includes(S(r.movement_type))).reduce((a,r)=>a+N(r.quantity),0);
    const retQty=rows.filter(r=>S(r.movement_type)==='return').reduce((a,r)=>a+N(r.quantity),0);
    return Math.max(0, inQty - outQty + retQty);
  }
  function sumRow(arr,fn){return A(arr).reduce((a,x)=>a+N(fn(x)),0);}
  function groupRows(rows,keyFn,item){
    const map=new Map();
    const ensure=k=>{k=S(k)||'غير محدد'; if(!map.has(k)) map.set(k,{key:k,out:0,ret:0,consume:0,current:0,net:0,vat:0,gross:0}); return map.get(k);};
    A(rows).forEach(r=>{
      const g=ensure(keyFn(r)); const t=S(r.movement_type), q=N(r.quantity);
      if(t==='out') g.out+=q;
      if(t==='return') g.ret+=q;
      if(financialTypes.includes(t)){
        g.consume+=q;
        const unit=unitCostForMovement(r,item); const net=q*unit; const vat=vatForNet(net);
        g.net+=net; g.vat+=vat; g.gross+=net+vat;
      }
      g.current=Math.max(0, g.out-g.ret-g.consume);
    });
    return [...map.values()].sort((a,b)=>b.consume-a.consume||a.key.localeCompare(b.key,'ar'));
  }
  function table(title, headers, bodyRows, totalCells){
    return `<section class="fpr-section"><h3>${esc(title)}</h3><div class="fpr-table-wrap"><table class="fpr-table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${bodyRows||`<tr><td colspan="${headers.length}">لا توجد بيانات</td></tr>`}</tbody>${totalCells?`<tfoot><tr>${totalCells}</tr></tfoot>`:''}</table></div></section>`;
  }
  function printProductReport(id){
    const item=findItem(id); if(!item) return alert('لم يتم العثور على المنتج');
    const html=buildReport(item,true);
    const w=window.open('','_blank'); if(!w) return alert('المتصفح منع فتح نافذة الطباعة');
    w.document.open(); w.document.write(html.replace('<body>','<body class="print-mode">')); w.document.close();
  }
  function buildReport(item,forPrint=false){
    const image=lockedImageUrl(item); const code=itemCode(item)||'-'; const unit=item.unit||'حبة'; const type=itemType(item); const qty=currentQty(item);
    const base=productMovements(item), rows=productActivityRows(item);
    const inRows=base.filter(m=>S(m.movement_type)==='in').sort((a,b)=>S(movementDate(a)).localeCompare(S(movementDate(b))));
    const activity=rows.filter(r=>['out','consume','damaged','waste','scrap','return'].includes(S(r.movement_type)));
    const byStaff=groupRows(activity,staffOf,item);
    const byCenter=groupRows(activity,centerOf,item);
    const inBody=inRows.map(m=>{const q=N(m.quantity), unit=unitCostForMovement(m,item), net=q*unit, vat=vatForNet(net); return `<tr><td>${esc(opNo(m))}</td><td>${esc(movementDate(m)||'-')}</td><td>${q}</td><td>${money(unit)}</td><td>${money(net)}</td><td>${money(vat)}</td><td>${money(net+vat)}</td></tr>`;}).join('');
    const inNet=sumRow(inRows,m=>N(m.quantity)*unitCostForMovement(m,item)), inVat=vatForNet(inNet), inGross=inNet+inVat;
    const groupBody=arr=>arr.map(g=>`<tr><td>${esc(g.key)}</td><td>${N(g.out)}</td><td>${N(g.ret)}</td><td>${N(g.consume)}</td><td>${N(g.current)}</td><td>${money(g.net)}</td><td>${money(g.vat)}</td><td>${money(g.gross)}</td></tr>`).join('');
    const totals=arr=>{const out=sumRow(arr,x=>x.out), ret=sumRow(arr,x=>x.ret), consume=sumRow(arr,x=>x.consume), cur=sumRow(arr,x=>x.current), net=sumRow(arr,x=>x.net), vat=sumRow(arr,x=>x.vat), gross=sumRow(arr,x=>x.gross); return {out,ret,consume,cur,net,vat,gross};};
    const tStaff=totals(byStaff), tCenter=totals(byCenter);
    const css=`<style>
      .fpr-root{direction:rtl;font-family:Tahoma,Arial,sans-serif;color:#103b32;background:#f5faf8;padding:14px;border-radius:18px}.fpr-head{display:grid;grid-template-columns:130px 1fr auto;gap:14px;align-items:center;background:#fff;border:1px solid #dce9e4;border-radius:20px;padding:14px;margin-bottom:14px}.fpr-img{width:118px;height:118px;border:1px solid #dce9e4;border-radius:18px;background:#fff;display:grid;place-items:center;overflow:hidden}.fpr-img img{max-width:100%;max-height:100%;object-fit:contain}.fpr-title h2{margin:0 0 6px;color:#063d31;font-size:25px}.fpr-title .chips{display:flex;gap:8px;flex-wrap:wrap}.fpr-chip{background:#eef7f3;border:1px solid #d8ebe3;border-radius:999px;padding:7px 11px;font-weight:800;font-size:12px}.fpr-actions{display:flex;gap:8px;flex-wrap:wrap}.fpr-actions button{border:0;border-radius:12px;background:#063d31;color:#fff;font-weight:900;padding:10px 14px;cursor:pointer}.fpr-section{background:#fff;border:1px solid #dce9e4;border-radius:20px;margin:12px 0;padding:14px}.fpr-section h3{margin:0 0 10px;color:#063d31;font-size:20px}.fpr-table-wrap{overflow:auto}.fpr-table{width:100%;border-collapse:collapse;background:#fff}.fpr-table th{background:#063d31;color:#fff;padding:10px 8px;font-size:12px}.fpr-table td{border-bottom:1px solid #e8efed;padding:9px 7px;text-align:center}.fpr-table tbody tr:nth-child(even){background:#fbfdfc}.fpr-table tfoot td{background:#eef5f2;font-weight:900}.fpr-note{font-size:12px;color:#61756f;margin-top:8px}@media print{body{margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.fpr-root{background:#fff;border-radius:0;padding:8mm}.fpr-actions{display:none}.fpr-section{break-inside:avoid}.fpr-table th{background:#063d31!important;color:#fff!important}@page{size:A4 landscape;margin:8mm}}
    </style>`;
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير المنتج - ${esc(item.name)}</title>${css}</head><body><div class="fpr-root" id="financeProductReportV10169">
      <div class="fpr-head"><div class="fpr-img">${image?`<img src="${esc(image)}" alt="${esc(item.name)}">`:'بدون صورة'}</div><div class="fpr-title"><h2>تقرير المنتج: ${esc(item.name||'-')}</h2><div class="chips"><span class="fpr-chip">الكود: ${esc(code)}</span><span class="fpr-chip">النوع: ${esc(type)}</span><span class="fpr-chip">الوحدة: ${esc(unit)}</span><span class="fpr-chip">الكمية الحالية: ${N(qty)}</span></div><div class="fpr-note">التقرير يعرض الإدخالات والحركات ومراكز التكلفة للمنتج المحدد فقط.</div></div><div class="fpr-actions"><button onclick="window.print()">طباعة التقرير</button><button onclick="window.close()">إغلاق</button></div></div>
      ${table('الجدول الأول: إدخالات المنتج إلى المخزن',['رقم العملية','تاريخ الإدخال','كمية الإدخال','سعر الحبة الواحدة','المجموع قبل الضريبة','الضريبة','المجموع شامل الضريبة'],inBody,`<td colspan="2">المجموع</td><td>${sumRow(inRows,m=>m.quantity)}</td><td>-</td><td>${money(inNet)}</td><td>${money(inVat)}</td><td>${money(inGross)}</td>`)}
      ${table('الجدول الثاني: الحركات حسب المشرف',['اسم المشرف','الصرف','المرتجع','المستهلك','الكمية الحالية للمنتج','قيمة الاستهلاك قبل الضريبة','الضريبة','بعد الضريبة'],groupBody(byStaff),`<td>المجموع</td><td>${tStaff.out}</td><td>${tStaff.ret}</td><td>${tStaff.consume}</td><td>${tStaff.cur}</td><td>${money(tStaff.net)}</td><td>${money(tStaff.vat)}</td><td>${money(tStaff.gross)}</td>`)}
      ${table('الجدول الثالث: مراكز التكلفة',['مركز التكلفة','الخارج','الراجع','المستهلك','الكمية الحالية','قيمة المستهلك قبل الضريبة','الضريبة','بعد الضريبة'],groupBody(byCenter),`<td>المجموع</td><td>${tCenter.out}</td><td>${tCenter.ret}</td><td>${tCenter.consume}</td><td>${tCenter.cur}</td><td>${money(tCenter.net)}</td><td>${money(tCenter.vat)}</td><td>${money(tCenter.gross)}</td>`)}
    </div>${forPrint?'<script>window.onload=function(){setTimeout(function(){window.print()},350)}</script>':''}</body></html>`;
  }
  function findItem(id){
    const wanted=S(decodeURIComponent(S(id)));
    return productItems().find(i=>String(i.id)===wanted||itemCode(i)===wanted||S(i.name)===wanted)||null;
  }
  function openProductReport(id){
    const item=findItem(id); if(!item) return alert('لم يتم العثور على المنتج. اضغط تحديث البيانات ثم جرب مرة أخرى.');
    const box=document.createElement('div'); box.className='fpr-modal-v10169'; box.innerHTML=`<div class="fpr-modal-card"><button class="fpr-close" type="button">إغلاق</button>${buildReport(item,false).replace(/^[\s\S]*<body>/,'').replace(/<\/body>[\s\S]*$/,'')}</div>`;
    document.body.appendChild(box); box.querySelector('.fpr-close').onclick=()=>box.remove(); box.addEventListener('click',e=>{if(e.target===box)box.remove();});
  }
  function installModalStyle(){
    if($('fprModalStyleV10169'))return; const st=document.createElement('style'); st.id='fprModalStyleV10169'; st.textContent=`.fpr-modal-v10169{position:fixed;inset:0;z-index:2147483005;background:rgba(0,35,28,.55);display:grid;place-items:center;padding:18px;direction:rtl}.fpr-modal-card{position:relative;width:min(1240px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:24px;box-shadow:0 28px 80px rgba(0,0,0,.28)}.fpr-close{position:sticky;top:12px;right:12px;z-index:3;border:0;background:#b83232;color:#fff;border-radius:12px;padding:9px 13px;font-weight:900;float:right;margin:10px}`; document.head.appendChild(st);
  }
  function addReportButtons(){
    document.querySelectorAll('.fin-product-card').forEach(card=>{
      if(card.querySelector('[data-fpr10169]')) return;
      const show=card.querySelector('.fin-show-product-btn,[onclick*="financeProShowProductV15"]');
      const onclick=show?.getAttribute('onclick')||''; const m=onclick.match(/financeProShowProductV15\(['"]([^'"]+)/); const id=m?m[1]:''; if(!id)return;
      const btn=document.createElement('button'); btn.type='button'; btn.className='light'; btn.dataset.fpr10169='1'; btn.textContent='تقرير المنتج'; btn.onclick=function(e){e.preventDefault();e.stopPropagation();openProductReport(id);return false;};
      (card.querySelector('.fin-card-actions')||card).insertBefore(btn, show||null);
    });
  }
  function patchShowProduct(){
    if(window.__fprShowProductPatchedV10169)return; window.__fprShowProductPatchedV10169=true;
    const old=window.financeProShowProductV15;
    window.financeProShowProductV15=function(id){ openProductReport(id); return false; };
    window.financeProPrintProductReportV10169=printProductReport;
    window.financeProOpenProductReportV10169=openProductReport;
    window.financeProOriginalShowProductV10169=old;
  }
  function boot(){installModalStyle(); patchShowProduct(); setTimeout(addReportButtons,100); setTimeout(addReportButtons,600);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.addEventListener('load',boot,{once:true});
  const mo=new MutationObserver(()=>addReportButtons()); try{mo.observe(document.documentElement,{childList:true,subtree:true});}catch(_){ }
  console.log('Loaded '+VERSION);
})();

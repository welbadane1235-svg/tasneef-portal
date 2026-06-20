/* Tasneef v10170 - Finance Reports Products Three Tables Force Renderer
   Scope: المالية والمخزون - تبويب التقارير / تقرير المنتجات فقط. لا يغير البيانات. */
(function(){
  'use strict';
  if(window.__tasneefFinanceProductReportsV10170) return;
  window.__tasneefFinanceProductReportsV10170=true;
  const VAT=0.15;
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const N=v=>Number(v||0)||0;
  const $=id=>document.getElementById(id);
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=v=>`${N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س`;
  const state=()=>window.financeProStateV15||{};
  const finTypes=['consume','damaged','waste','scrap'];
  const outTypes=['out','consume','damaged','waste','scrap'];
  function safeJson(v){const t=S(v); if(!t.startsWith('finance_pro_v15:'))return{}; try{return JSON.parse(t.replace('finance_pro_v15:',''))||{};}catch(_){return{};}}
  function productCode(i){return S(i&&(i.product_code||i.serial_number||i.barcode||i.supplier_barcode||i.code));}
  function productType(i){const raw=S(i&&(i.item_type||i.type||i.category))||'مادة'; const low=raw.toLowerCase(); if(['tool','tools','عدة','أداة','اداة','معدات'].includes(low)||['عدة','أداة','اداة','معدات'].includes(raw))return 'أداة'; if(['machine','machines','مكينة','ماكينة'].includes(low)||['مكينة','ماكينة'].includes(raw))return 'مكينة'; return raw;}
  function productClass(i){const raw=S(i&&(i.product_classification||i.product_class||i.asset_type||i.classification))||'منتج'; return (raw==='أصل'||raw==='اصل'||raw.toLowerCase()==='asset')?'أصل':'منتج';}
  function itemCost(i){return N(i&&(i.unit_cost||i.cost||i.price||i.purchase_price));}
  function productKeys(o){const keys=[]; [o&&o.id,o&&o.item_id,o&&o.product_code,o&&o.serial_number,o&&o.barcode,o&&o.supplier_barcode,o&&o.distributor_code,o&&o.code,o&&o.name,o&&o.item_name].forEach(v=>{const x=S(v).toLowerCase(); if(x&&!keys.includes(x))keys.push(x);}); return keys;}
  function imageUrl(item){const direct=S(item&&item.image_url); if(direct)return direct; const cache=state().imageCache||{}; for(const k of productKeys(item)){if(S(cache[k]))return S(cache[k]);} return '';}
  function movementDate(m){return S(m&&(m.movement_date||m.date||m.created_at)).slice(0,10);}
  function officialItemFor(obj){const keys=productKeys(obj); return A(state().items).find(i=>productKeys(i).some(k=>keys.includes(k)))||null;}
  function unitCostMove(m,item){const meta=safeJson(m&&m.notes)||{}; if(N(m&&m.unit_cost)>0)return N(m.unit_cost); if(N(meta.beforeVat)>0&&N(m&&m.quantity)>0)return N(meta.beforeVat)/N(m.quantity); return itemCost(officialItemFor(m)||item);}
  function netMove(m,item){const meta=safeJson(m&&m.notes)||{}; if(N(meta.beforeVat)>0)return N(meta.beforeVat); return N(m&&m.quantity)*unitCostMove(m,item);}
  function vatMove(m,item){const meta=safeJson(m&&m.notes)||{}; if(N(meta.vat)>0)return N(meta.vat); return netMove(m,item)*VAT;}
  function grossMove(m,item){const meta=safeJson(m&&m.notes)||{}; if(N(meta.afterVat)>0)return N(meta.afterVat); return netMove(m,item)+vatMove(m,item);}
  function opNo(m){const meta=safeJson(m&&m.notes)||{}; const inv=S(meta.invoiceNo||meta.systemInvoiceNo||m.invoice_no||m.system_invoice_no); if(inv)return inv; return S(m.id?`MOV-${m.id}`:'-');}
  function projectName(id){const p=A(state().projects).find(x=>String(x.id)===String(id)); return S(p&&(p.name||p.project_name))||'';}
  function staffName(id){const u=A(state().users).find(x=>String(x.id)===String(id)); return S(u&&(u.full_name||u.name||u.username))||S(id);}
  function staffOf(m){const meta=safeJson(m&&m.notes)||{}; const id=S(meta.staffId||m.staff_id||m.supervisor_id||m.user_id||m.created_by||''); return S(m.receiver)|| (id?staffName(id):'غير محدد') || 'غير محدد';}
  function centerOf(r){return S(r.center||r.cost_center||r.project_name||r.projectName||projectName(r.project_id)||'غير محدد');}
  function distributionRows(m){
    const meta=safeJson(m&&m.notes)||{}; const rows=A(meta.distribution);
    if(!rows.length) return [{...m,parent_id:m.id,base_movement_type:S(m.movement_type),project_name:S(m.project_name||projectName(m.project_id)||''),order_no:S(m.order_no||'')}];
    return rows.map((d,idx)=>({...m,parent_id:m.id,distribution_index:idx,is_distribution_row:true,base_movement_type:S(m.movement_type),movement_type:S(d.type||m.movement_type)||S(m.movement_type),quantity:N(d.qty),center:S(d.center||m.cost_center),project_id:d.projectId||m.project_id||null,project_name:S(d.projectName||projectName(d.projectId)||m.project_name||''),order_no:S(d.orderNo||m.order_no||''),distribution_note:S(d.note||'')})).filter(r=>N(r.quantity)>0);
  }
  function allItems(){
    const st=state(); const map=new Map();
    function add(item){ if(!item)return; const key=S(item.id||productCode(item)||item.name); if(key&&!map.has(key))map.set(key,item); }
    A(st.items).forEach(add);
    A(st.movements).forEach((m,idx)=>{ if(officialItemFor(m))return; const key=S(m.item_id||m.product_code||m.barcode||m.item_name); if(!key||map.has(key))return; map.set(key,{_fallback:true,id:m.item_id||('fb_'+idx),name:S(m.item_name)||key,product_code:S(m.product_code)||S(m.barcode)||key,barcode:S(m.barcode)||S(m.product_code)||'',unit:S(m.unit)||'حبة',item_type:'مادة',product_classification:S(m.product_classification)||'منتج',unit_cost:N(m.unit_cost),quantity:0}); });
    return [...map.values()];
  }
  function productMovements(item){const code=productCode(item), id=S(item&&item.id), name=S(item&&item.name); return A(state().movements).filter(m=>String(m.item_id)===id || (code&&[m.product_code,m.barcode,m.serial_number].map(S).includes(code)) || (!m.item_id&&S(m.item_name)===name));}
  function activityRows(item){return productMovements(item).flatMap(distributionRows);}
  function metrics(item){
    const rows=activityRows(item); const q=t=>rows.filter(r=>S(r.movement_type)===t).reduce((a,r)=>a+N(r.quantity),0);
    const inside=productMovements(item).filter(m=>S(m.movement_type)==='in').reduce((a,m)=>a+N(m.quantity),0);
    const out=rows.filter(r=>outTypes.includes(S(r.movement_type))).reduce((a,r)=>a+N(r.quantity),0);
    const ret=q('return'); const consumed=rows.filter(r=>finTypes.includes(S(r.movement_type))).reduce((a,r)=>a+N(r.quantity),0);
    // v10172: الكمية الحالية في عرض المنتج = الرصيد الرسمي من جدول inventory_items.
    // الحركات تبقى للتفاصيل فقط حتى لا يظهر في العرض 11 بينما كرت المنتج 2.
    return {inside,out,ret,consumed,balance:N(item&&item.quantity)};
  }
  function filters(){return {q:S($('finReportSearchV15')?.value).toLowerCase(), product:S($('finReportProductV15')?.value), from:S($('finReportFromV15')?.value), to:S($('finReportToV15')?.value), center:S($('finReportCenterV15')?.value), project:S($('finReportProjectV15')?.value), type:S($('finReportTypeV15')?.value), productClass:S($('finReportProductClassV10169')?.value)};}
  function passDate(m,f){const dt=movementDate(m); if(f.from&&dt<f.from)return false; if(f.to&&dt>f.to)return false; return true;}
  function passProduct(item,f){ if(f.product && S(item.id)!==f.product)return false; if(f.productClass && productClass(item)!==f.productClass)return false; if(f.q && ![item.name,productCode(item),item.unit,productType(item)].map(S).join(' ').toLowerCase().includes(f.q))return false; return true; }
  function passRow(r,f){ if(!passDate(r,f))return false; if(f.center && centerOf(r)!==f.center)return false; if(f.project && S(r.project_id)!==f.project)return false; if(f.type==='in'&&S(r.movement_type)!=='in')return false; if(f.type==='out'&&!outTypes.includes(S(r.movement_type)))return false; return true; }
  const sum=(arr,fn)=>A(arr).reduce((a,x)=>a+N(fn?fn(x):x),0);
  function totalsRow(cells){return `<tfoot><tr>${cells.map(c=>`<td>${c}</td>`).join('')}</tr></tfoot>`;}
  function table(title,heads,rows,total){return `<section class="fpr-box"><h3>${esc(title)}</h3><div class="fpr-table"><table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${heads.length}">لا توجد بيانات</td></tr>`}</tbody>${total||''}</table></div></section>`;}
  function groupBy(rows,keyFn,item){
    const map=new Map();
    A(rows).forEach(r=>{const key=S(keyFn(r))||'غير محدد'; if(!map.has(key))map.set(key,{key,out:0,ret:0,consume:0,current:0,net:0,vat:0,gross:0}); const g=map.get(key); const t=S(r.movement_type), q=N(r.quantity); if(t==='out')g.out+=q; if(t==='return')g.ret+=q; if(finTypes.includes(t)){g.consume+=q; const net=q*unitCostMove(r,item); g.net+=net; g.vat+=net*VAT; g.gross+=net*(1+VAT);} g.current=Math.max(0,g.out-g.ret-g.consume);});
    return [...map.values()].sort((a,b)=>b.consume-a.consume||a.key.localeCompare(b.key,'ar'));
  }
  function productReportCard(item){
    const f=filters(); const img=imageUrl(item); const met=metrics(item); const base=productMovements(item).filter(m=>S(m.movement_type)==='in'&&passRow(m,f)); const rows=activityRows(item).filter(r=>passRow(r,f));
    const inBody=base.map(m=>{const q=N(m.quantity), unit=unitCostMove(m,item), net=q*unit, vat=vatMove(m,item), gross=net+vat; return `<tr><td>${esc(opNo(m))}</td><td>${esc(movementDate(m)||'-')}</td><td>${q}</td><td>${money(unit)}</td><td>${money(net)}</td><td>${money(vat)}</td><td>${money(gross)}</td></tr>`;}).join('');
    const inNet=sum(base,m=>N(m.quantity)*unitCostMove(m,item)), inVat=sum(base,m=>vatMove(m,item)), inGross=inNet+inVat;
    const byStaff=groupBy(rows.filter(r=>['out','return',...finTypes].includes(S(r.movement_type))),staffOf,item);
    const byCenter=groupBy(rows.filter(r=>['out','return',...finTypes].includes(S(r.movement_type))),centerOf,item);
    const groupBody=arr=>arr.map(g=>`<tr><td>${esc(g.key)}</td><td>${N(g.out)}</td><td>${N(g.ret)}</td><td>${N(g.consume)}</td><td>${N(g.current)}</td><td>${money(g.net)}</td><td>${money(g.vat)}</td><td>${money(g.gross)}</td></tr>`).join('');
    const gt=arr=>({out:sum(arr,x=>x.out),ret:sum(arr,x=>x.ret),consume:sum(arr,x=>x.consume),current:sum(arr,x=>x.current),net:sum(arr,x=>x.net),vat:sum(arr,x=>x.vat),gross:sum(arr,x=>x.gross)});
    const st=gt(byStaff), ct=gt(byCenter);
    return `<article class="fpr-product">
      <div class="fpr-head"><div class="fpr-img">${img?`<img src="${esc(img)}" alt="${esc(item.name)}">`:'بدون صورة'}</div><div><h2>${esc(item.name||'-')}</h2><div class="fpr-chips"><span>الكود: ${esc(productCode(item)||'-')}</span><span>النوع: ${esc(productType(item))}</span><span>تصنيف المنتج: ${esc(productClass(item))}</span><span>الوحدة: ${esc(item.unit||'حبة')}</span><span>الكمية الحالية: ${N(met.balance)}</span></div></div></div>
      ${table('الجدول الأول: إدخالات المنتج إلى المخزن',['رقم العملية','تاريخ الإدخال','كمية الإدخال','سعر الحبة الواحدة','المجموع قبل الضريبة','الضريبة','المجموع شامل الضريبة'],inBody,totalsRow(['المجموع','-',sum(base,m=>m.quantity),'-',money(inNet),money(inVat),money(inGross)]))}
      ${table('الجدول الثاني: الحركات حسب المشرف',['اسم المشرف','الصرف','المرتجع','المستهلك','الكمية الحالية للمنتج','قيمة الاستهلاك قبل الضريبة','الضريبة','بعد الضريبة'],groupBody(byStaff),totalsRow(['المجموع',st.out,st.ret,st.consume,st.current,money(st.net),money(st.vat),money(st.gross)]))}
      ${table('الجدول الثالث: مراكز التكلفة',['مركز التكلفة','الخارج','الراجع','المستهلك','الكمية الحالية','قيمة المستهلك قبل الضريبة','الضريبة','بعد الضريبة'],groupBody(byCenter),totalsRow(['المجموع',ct.out,ct.ret,ct.consume,ct.current,money(ct.net),money(ct.vat),money(ct.gross)]))}
    </article>`;
  }
  function reportHtml(){
    const f=filters(); const items=allItems().filter(i=>passProduct(i,f));
    return `<div class="fpr-root-v10170"><div class="fpr-toolbar"><b>تقرير المنتجات التفصيلي</b><button type="button" onclick="financeProPrintReportV10170()">طباعة التقرير</button></div>${items.map(productReportCard).join('')||'<div class="fin-card">لا توجد منتجات حسب الفلتر</div>'}</div>`;
  }
  function style(){ if($('fprStyleV10170'))return; const st=document.createElement('style'); st.id='fprStyleV10170'; st.textContent=`
    .fpr-root-v10170{display:grid;gap:14px}.fpr-toolbar{display:flex;align-items:center;justify-content:space-between;background:#eef7f3;border:1px solid #d9e7e2;border-radius:16px;padding:12px;color:#063d31}.fpr-toolbar button{border:0;border-radius:12px;background:#063d31;color:#fff;font-weight:900;padding:10px 16px}.fpr-product{background:#fff;border:1px solid #d9e7e2;border-radius:20px;padding:14px;box-shadow:0 8px 24px rgba(10,64,51,.04)}.fpr-head{display:grid;grid-template-columns:112px 1fr;gap:14px;align-items:center;margin-bottom:12px}.fpr-img{width:104px;height:104px;border:1px solid #d9e7e2;border-radius:18px;background:#fff;display:grid;place-items:center;overflow:hidden;color:#8a9a96}.fpr-img img{max-width:100%;max-height:100%;object-fit:contain}.fpr-head h2{margin:0 0 8px;color:#063d31}.fpr-chips{display:flex;gap:8px;flex-wrap:wrap}.fpr-chips span{background:#eef7f3;border:1px solid #d8ebe3;border-radius:999px;padding:7px 11px;font-weight:800}.fpr-box{margin:14px 0}.fpr-box h3{margin:0 0 8px;color:#063d31}.fpr-table{overflow:auto;border:1px solid #d9e7e2;border-radius:14px}.fpr-table table{width:100%;border-collapse:collapse;font-size:12px;background:#fff}.fpr-table th{background:#063d31;color:#fff;padding:9px;text-align:center}.fpr-table td{border-bottom:1px solid #e8efed;padding:8px;text-align:center}.fpr-table tbody tr:nth-child(even){background:#fbfdfc}.fpr-table tfoot td{background:#eef5f2;font-weight:900}@media print{body{background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.side,.topbar,.fin-hero,.fin-tabs,.fin-actions,.fpr-toolbar{display:none!important}.fin-card{box-shadow:none!important}.fpr-product{break-inside:avoid;box-shadow:none}.fpr-table th{background:#063d31!important;color:#fff!important}@page{size:A4 landscape;margin:8mm}}`; document.head.appendChild(st); }

  function ensureReportClassFilter(){
    const box=$('finReportWindowV15'); if(!box || $('finReportProductClassV10169')) return;
    const filters=box.closest('.fin-card')?.querySelector('.fin-actions') || document.querySelector('#finBodyV15 .fin-actions');
    if(!filters) return;
    const wrap=document.createElement('div');
    wrap.id='finReportProductClassWrapV10169';
    wrap.innerHTML='<label>تصنيف المنتج</label><select id="finReportProductClassV10169"><option value="">كل التصنيفات</option><option value="منتج">منتج</option><option value="أصل">أصل</option></select>';
    const printBtn=[...filters.querySelectorAll('button')].find(b=>/طباعة/.test(S(b.textContent)));
    if(printBtn) filters.insertBefore(wrap, printBtn); else filters.appendChild(wrap);
    $('finReportProductClassV10169').addEventListener('change',()=>{ if(typeof window.financeProRenderReportsV15==='function') window.financeProRenderReportsV15(); setTimeout(apply,60); });
  }

  function apply(){ ensureReportClassFilter(); style(); const st=state(); if(st.tab!=='reports' || st.reportTab!=='products')return false; const box=$('finReportWindowV15'); if(!box)return false; box.innerHTML=reportHtml(); return true; }
  const oldRender=window.financeProRenderReportsV15; window.financeProRenderReportsV15=function(){ if(typeof oldRender==='function')oldRender.apply(this,arguments); setTimeout(apply,40); };
  const oldTab=window.financeProReportTabV15; window.financeProReportTabV15=function(tab){ if(typeof oldTab==='function')oldTab.apply(this,arguments); else {state().reportTab=tab||'products';} setTimeout(apply,60); };
  const oldPrint=window.financeProPrintReportV15; window.financeProPrintReportV15=function(){ if(state().tab==='reports' && state().reportTab==='products') return window.financeProPrintReportV10170(); if(typeof oldPrint==='function')return oldPrint.apply(this,arguments); };
  window.financeProPrintReportV10170=function(){ style(); const content=reportHtml(); const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير المنتجات التفصيلي</title>${$('fprStyleV10170')?`<style>${$('fprStyleV10170').textContent}</style>`:''}</head><body>${content}<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`; const w=window.open('','_blank'); if(!w)return alert('المتصفح منع فتح نافذة الطباعة'); w.document.open(); w.document.write(html); w.document.close(); };
  function boot(){ setTimeout(apply,200); setTimeout(apply,900); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot(); window.addEventListener('load',boot,{once:true});
  console.log('Loaded v10170 finance product reports force renderer');
})();

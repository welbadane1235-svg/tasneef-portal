/* TASNEEF v352 - HARD inventory UI fix
   - زر تعديل داخل المنتجات داخل الحركة بشكل عام وليس مشروطًا بكلاس معين.
   - ربط الفلاتر بعد كل رندر.
   - إجماليات التقارير + أزرار طباعة.
   لا يلمس الصلاحيات/المستخدمين/الحضور/العقود.
*/
(function(){
  'use strict';
  if(window.__tasneefV352HardInventoryFix) return; window.__tasneefV352HardInventoryFix = true;

  const VAT=0.15;
  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const N=v=>{ const x=Number(S(v).replace(/,/g,'')); return Number.isFinite(x)?x:0; };
  const R2=v=>Math.round((N(v)+Number.EPSILON)*100)/100;
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=v=>N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';
  const parse=(k,d=[])=>{try{return JSON.parse(localStorage.getItem(k)||'null')||d}catch(_){return d}};
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const itemsLS=()=>parse('tasneef_v312_items').map(i=>({...i,batches:Array.isArray(i.batches)?i.batches:[]}));
  const movesLS=()=>parse('tasneef_v312_moves');
  const setMoves=v=>save('tasneef_v312_moves',v);
  const D=()=>window.data || (typeof data!=='undefined'?data:{});
  const today=()=>new Date().toISOString().slice(0,10);
  const isOut=t=>['out','consume','صرف','استهلاك','هدر','تالف','سكراب'].includes(S(t));
  const isReturn=t=>['return','مرتجع','إرجاع','ارجاع'].includes(S(t));
  const isIn=t=>['in','إدخال','ادخال','توريد','شراء','دخول'].includes(S(t));
  const itemLS=id=>itemsLS().find(i=>S(i.id)===S(id))||{};
  const pCode=i=>S(i?.code||i?.product_code||i?.serial_number||i?.barcode||'');
  const unitBefore=i=>N(i.unit_before||i.price_before_vat||i.unit_cost_before||i.unit_cost||i.cost||i.price_before||i.price||0);
  const moveUnitBefore=m=>{
    if(N(m.unit_before)) return N(m.unit_before);
    if(N(m.unit_cost_before)) return N(m.unit_cost_before);
    if(N(m.unit_cost_override)) return R2(N(m.unit_cost_override)/1.15); // غالب النسخة تخزن شامل
    if(N(m.unit_cost)) return N(m.unit_cost);
    const q=N(m.qty||m.quantity); if(q&&N(m.amount)) return R2(N(m.amount)/q/1.15);
    return unitBefore(itemLS(m.item_id));
  };
  const projectName=id=>{
    if(!S(id)) return '';
    try{ if(typeof window.projectName==='function') return window.projectName(id)||S(id); }catch(_){ }
    try{ if(typeof window.financeProjectName==='function') return window.financeProjectName(id)||S(id); }catch(_){ }
    const p=A(D().projects).find(x=>S(x.id)===S(id)); return p?.name||p?.project_name||p?.title||S(id);
  };
  const parentOf=m=>(S(m.notes).match(/\[PARENT:([^\]]+)\]/)||[])[1]||'';
  const isPending=m=>S(m.distribution_status).includes('pending') || /PENDING_DISTRIBUTION|بانتظار توزيع/.test(S(m.notes)+' '+S(m.general_note));
  const isParentDistributed=m=>/\[DISTRIBUTED_PARENT\]/.test(S(m.notes)+' '+S(m.reason));
  const isReportOnly=m=>/\[REPORT_ONLY\]/.test(S(m.notes)) || !!parentOf(m);

  function css(){
    if($('v352css')) return;
    const st=document.createElement('style'); st.id='v352css'; st.textContent=`
      .v352-edit-btn{background:#eef8f5!important;color:#064737!important;border:1px solid #cfe4dc!important;border-radius:10px!important;padding:7px 12px!important;font-weight:900!important;margin:3px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:58px!important}
      .v352-save-btn{background:#064737!important;color:#fff!important;border-radius:10px!important;padding:7px 12px!important;font-weight:900!important;margin:3px!important}
      .v352-editing{outline:2px dashed #d7a928!important;outline-offset:4px!important;background:#fffaf0!important}
      .v352-total-row td{font-weight:900!important;background:#eef8f4!important;color:#064737!important;border-top:2px solid #cfe4dc!important}
      .v352-printbar{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin:10px 0}.v352-printbar button{background:#eef8f5!important;color:#064737!important;border:1px solid #cfe4dc!important;border-radius:10px!important;padding:8px 12px!important;font-weight:900!important}
    `; document.head.appendChild(st);
  }

  // 1) زر تعديل في المنتجات داخل الحركة - عام جدًا
  function rowFromButton(btn){
    return btn.closest('.v337-line,.v347-split,.smart-line-v129,tr,.inventory-line,.movement-line,.product-line,.v337-product,.card,.soft-card,section,div');
  }
  function makeEditable(row){
    if(!row) return;
    row.classList.add('v352-editing');
    const inputs=row.querySelectorAll('input,select,textarea');
    if(inputs.length){
      inputs.forEach(el=>{el.removeAttribute('disabled');el.removeAttribute('readonly'); el.style.pointerEvents='auto'; el.style.background='#fff';});
      const first=inputs[0]; try{first.focus(); first.select&&first.select();}catch(_){ }
      const saveBtn=Array.from(row.querySelectorAll('button')).find(b=>/حفظ|تحديث|إضافة توزيع|إضافة/.test(S(b.textContent)) && !/تعديل/.test(S(b.textContent)));
      if(saveBtn){ saveBtn.classList.add('v352-save-btn'); if(!/إضافة توزيع/.test(S(saveBtn.textContent))) saveBtn.textContent='حفظ التعديل'; }
      return;
    }
    // في الكروت المختصرة: افتح شاشة التوزيع الأصلية إن وجد رقم الحركة في أزرار العرض/الحذف.
    const all=[...row.querySelectorAll('button,[onclick]')].map(x=>x.getAttribute('onclick')||'').join(' ');
    const id=(all.match(/v337(?:DeleteLine|SaveLine)\('([^']+)'/)||all.match(/inventoryShowMovementV347\('([^']+)'/)||all.match(/financeDelete\('inventory_movements','([^']+)'/)||[])[1];
    if(id){
      if(typeof window.v337OpenMove==='function'){
        const ms=movesLS(); const m=ms.find(x=>S(x.id)===S(id)); if(m) return window.v337OpenMove(m.batch_id||m.id);
      }
      if(typeof window.inventoryShowMovementV347==='function') return window.inventoryShowMovementV347(id);
    }
    alert('تم تحديد السطر. إن لم تظهر خانات التعديل، افتح زر عرض/توزيع للحركة ثم عدّل السطر من هناك.');
  }
  window.v352EditAnyMovementLine=function(btn){ makeEditable(rowFromButton(btn)); };

  function injectEditButtons(){
    css();
    // أزرار الحذف في أي شاشة حركة مخزون
    const zones=document.querySelectorAll('.v337-modal,.v347-modal,.smart-modal-v129,.modal-backdrop,.modal-card,.v152-edit-modal,.card,.soft-card');
    zones.forEach(z=>{
      const txt=S(z.textContent);
      if(!/(حركة|المخزون|المنتجات داخل الحركة|توزيع|الفاتورة)/.test(txt)) return;
      z.querySelectorAll('button').forEach(del=>{
        if(!/حذف/.test(S(del.textContent))) return;
        const holder=del.parentElement||rowFromButton(del)||z;
        if(!holder || holder.querySelector('.v352-edit-btn')) return;
        const b=document.createElement('button'); b.type='button'; b.className='v352-edit-btn'; b.textContent='تعديل'; b.onclick=function(){ window.v352EditAnyMovementLine(this); };
        holder.insertBefore(b,del);
      });
    });
  }

  // 2) التقارير: مصدر التكلفة لا يحتوي مرتجعات ولا بانتظار توزيع
  function filterValue(id){ return S($(id)?.value); }
  function monthOK(date){ const m=filterValue('financeMonthFilter')||filterValue('inventoryMonthFilter'); return !m || S(date).slice(0,7)===m; }
  function searchOK(txt){ const q=(filterValue('financeSearch')||filterValue('inventoryMovementSearch')||filterValue('inventoryItemSearch')||'').toLowerCase(); return !q || S(txt).toLowerCase().includes(q); }
  function projectOK(project,projectId){ const x=filterValue('financeProjectFilter')||filterValue('inventoryProjectFilter')||filterValue('stockProjectFilter'); return !x || S(projectId)===x || S(project)===x || S(project).includes(x); }
  function itemOK(itemId,code,name){ const x=filterValue('inventoryReportProduct')||filterValue('inventoryProductFilter')||filterValue('stockProductFilter'); return !x || S(itemId)===x || S(code)===x || S(name).includes(x); }
  function personOK(person){ const x=filterValue('inventoryReportPerson')||filterValue('inventorySupervisorFilter')||filterValue('stockSupervisorFilter'); return !x || S(person)===x || S(person).includes(x); }
  function supplierOK(supplier){ const x=filterValue('inventoryReportSupplier')||filterValue('inventorySupplierFilter'); return !x || S(supplier)===x || S(supplier).includes(x); }

  function usageRows(){
    const rows=[];
    movesLS().forEach(m=>{
      const type=m.type||m.movement_type;
      if(!isOut(type)) return;
      if(isPending(m) || isParentDistributed(m)) return;
      const it=itemLS(m.item_id); const qty=N(m.qty||m.quantity); if(!qty) return;
      const before=R2(qty*moveUnitBefore(m));
      const prj=m.project_name||projectName(m.project_id)||(m.cost_type==='GENERAL'?'عام':'بدون مشروع');
      rows.push({date:S(m.date||m.movement_date||m.created_at||today()).slice(0,10),project:prj,project_id:m.project_id,person:m.supervisor_name||m.receiver||'بدون مستلم',code:m.product_code||pCode(it),item:m.item_name||it.name||'-',item_id:m.item_id,qty,unit_before:moveUnitBefore(m),before,vat:R2(before*VAT),gross:R2(before*(1+VAT)),reason:S(m.notes||m.reason||'-').replace(/\[[^\]]+\]/g,'').trim(),type:parentOf(m)?'توزيع':'صرف',ref:'MOV-'+(m.batch_no||m.id||'')});
    });
    A(D().inventoryMovements).forEach(m=>{
      if(!isOut(m.movement_type)) return;
      if(isReportOnly(m) || isParentDistributed(m)) return;
      const qty=N(m.quantity); if(!qty) return;
      const unit=N(m.unit_cost||m.unit_before||0) || moveUnitBefore(m);
      const before=R2(qty*unit);
      rows.push({date:S(m.movement_date||m.created_at||today()).slice(0,10),project:m.project_name||projectName(m.project_id)||'بدون مشروع',project_id:m.project_id,person:m.receiver||m.supervisor_name||'بدون مستلم',code:m.product_code||'',item:m.item_name||'-',item_id:m.item_id,qty,unit_before:unit,before,vat:R2(before*VAT),gross:R2(before*(1+VAT)),reason:S(m.reason||m.notes||'-').replace(/\[[^\]]+\]/g,'').trim(),type:'صرف مباشر',ref:'MOV-'+m.id});
    });
    return rows.filter(r=>monthOK(r.date)&&searchOK([r.project,r.person,r.code,r.item,r.reason,r.ref].join(' '))&&projectOK(r.project,r.project_id)&&itemOK(r.item_id,r.code,r.item)&&personOK(r.person));
  }
  function totalRow(rows,colspan,tail=''){
    const b=R2(rows.reduce((a,r)=>a+N(r.before),0));
    return `<tr class="v352-total-row"><td colspan="${colspan}">الإجمالي</td><td>${money(b)}</td><td>${money(R2(b*VAT))}</td><td>${money(R2(b*(1+VAT)))}</td>${tail}</tr>`;
  }
  function ensurePrint(id,title){
    const table=$(id)?.closest('table'); if(!table) return;
    if(table.previousElementSibling?.classList?.contains('v352-printbar')) return;
    table.insertAdjacentHTML('beforebegin',`<div class="v352-printbar"><button type="button" onclick="v352PrintTable('${id}','${esc(title)}')">طباعة PDF</button></div>`);
  }
  window.v352PrintTable=function(id,title){
    const table=$(id)?.closest('table'); if(!table) return alert('لا يوجد تقرير للطباعة');
    const w=window.open('','_blank'); if(!w) return alert('اسمح بفتح النوافذ');
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4 landscape;margin:9mm}body{font-family:Tahoma,Arial;color:#063d31}h2{text-align:center}table{width:100%;border-collapse:collapse;font-size:12px}td,th{border:1px solid #aaa;padding:7px;text-align:center}th{background:#064737;color:#fff}.v352-total-row td{font-weight:bold;background:#eef8f4}</style></head><body><h2>${esc(title)}</h2><table>${table.innerHTML}</table><script>window.onload=function(){print()}<\/script></body></html>`); w.document.close();
  };

  function renderTotals(){
    ensurePrint('stockOutByProjectBody','تقرير تكلفة المشاريع');
    ensurePrint('stockOutBySupervisorBody','تقرير الصرف حسب المشرف');
    ensurePrint('inventoryUsageDetailBody','تقرير الاستهلاك التفصيلي');
    ensurePrint('stockReportBody','تقرير المخزون');
    const rows=usageRows();
    const sp=$('stockOutByProjectBody');
    if(sp){
      const map={}; rows.forEach(r=>{const k=[r.project,r.code,r.item].join('|'); map[k]=map[k]||{project:r.project,code:r.code,item:r.item,qty:0,before:0}; map[k].qty=R2(map[k].qty+N(r.qty)); map[k].before=R2(map[k].before+N(r.before));});
      const a=Object.values(map); sp.innerHTML=a.map(v=>`<tr><td>${esc(v.project)}</td><td>${esc(v.code||'-')}</td><td><b>${esc(v.item)}</b></td><td>${N(v.qty)}</td><td>${money(v.before)}</td><td>${money(R2(v.before*VAT))}</td><td>${money(R2(v.before*(1+VAT)))}</td><td></td></tr>`).join('')+(a.length?totalRow(a,4,'<td></td>'):'<tr><td colspan="8">لا توجد بيانات</td></tr>');
    }
    const ss=$('stockOutBySupervisorBody');
    if(ss){
      const map={}; rows.forEach(r=>{const k=[r.person,r.project].join('|'); map[k]=map[k]||{person:r.person,project:r.project,count:0,qty:0,before:0}; map[k].count++; map[k].qty=R2(map[k].qty+N(r.qty)); map[k].before=R2(map[k].before+N(r.before));});
      const a=Object.values(map); ss.innerHTML=a.map(v=>`<tr><td>${esc(v.person)}</td><td>${esc(v.project)}</td><td>${v.count}</td><td>${N(v.qty)}</td><td>${money(v.before)}</td><td>${money(R2(v.before*VAT))}</td><td>${money(R2(v.before*(1+VAT)))}</td><td></td></tr>`).join('')+(a.length?totalRow(a,4,'<td></td>'):'<tr><td colspan="8">لا توجد بيانات</td></tr>');
    }
    const ud=$('inventoryUsageDetailBody');
    if(ud){
      const a=[...rows].sort((x,y)=>S(y.date).localeCompare(S(x.date))); ud.innerHTML=a.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.project)}</td><td>${esc(r.person)}</td><td>${esc(r.code||'-')}</td><td><b>${esc(r.item)}</b></td><td>${money(r.unit_before)}</td><td>${N(r.qty)}</td><td>${money(r.before)}</td><td>${money(r.vat)}</td><td>${money(r.gross)}</td><td>${esc(r.reason||'-')}</td><td>${esc(r.type)}</td><td>${esc(r.ref)}</td></tr>`).join('')+(a.length?totalRow(a,7,'<td colspan="3"></td>'):'<tr><td colspan="13">لا توجد بيانات</td></tr>');
    }
    const st=$('stockReportBody');
    if(st){
      const list=itemsLS().filter(i=>N(i.qty??i.quantity)>0 && supplierOK(i.supplier) && itemOK(i.id,pCode(i),i.name) && searchOK([i.name,pCode(i),i.supplier,i.category].join(' ')));
      st.innerHTML=list.map(i=>{const q=N(i.qty??i.quantity), b=R2(q*unitBefore(i)); return `<tr><td>${esc(pCode(i)||'-')}</td><td><b>${esc(i.name||'-')}</b></td><td>${esc(i.supplier||'-')}</td><td>${money(unitBefore(i))}</td><td>${money(R2(unitBefore(i)*(1+VAT)))}</td><td>${q}</td><td>${N(i.min_quantity||0)}</td><td>${money(b)}</td><td>${money(R2(b*VAT))}</td><td>${money(R2(b*(1+VAT)))}</td></tr>`;}).join('')+(list.length?(()=>{const b=R2(list.reduce((a,i)=>a+N(i.qty??i.quantity)*unitBefore(i),0));return `<tr class="v352-total-row"><td colspan="7">الإجمالي</td><td>${money(b)}</td><td>${money(R2(b*VAT))}</td><td>${money(R2(b*(1+VAT)))}</td></tr>`})():'<tr><td colspan="10">لا توجد منتجات متوفرة</td></tr>');
    }
  }

  function bindFilters(){
    document.querySelectorAll('input,select').forEach(el=>{
      const id=S(el.id), ph=S(el.placeholder), name=S(el.name);
      if(!/(filter|search|Report|inventory|finance|المشروع|المورد|المنتج|المشرف|بحث)/i.test(id+' '+ph+' '+name)) return;
      if(el.__v352Bound) return; el.__v352Bound=true;
      ['input','change','keyup'].forEach(ev=>el.addEventListener(ev,()=>setTimeout(()=>{safeRenderReports();},120)));
    });
  }
  function safeRenderReports(){ try{ renderTotals(); }catch(e){ console.warn('v352 totals',e); } }
  function wrapRender(name){
    if(typeof window[name] !== 'function' || window['__v352_'+name]) return;
    const old=window[name]; window['__v352_'+name]=true;
    window[name]=function(){ const r=old.apply(this,arguments); setTimeout(()=>{injectEditButtons(); bindFilters(); safeRenderReports();},120); return r; };
  }
  function boot(){
    css(); injectEditButtons(); bindFilters(); safeRenderReports();
    ['financeRenderReports','financeV312RenderReports','financeV312RenderMovements','inventoryRenderMovements','inventoryRenderItems','renderInventoryReports','renderInventoryMovements','renderFinance'].forEach(wrapRender);
  }
  const mo=new MutationObserver(()=>setTimeout(()=>{injectEditButtons(); bindFilters();},80));
  try{mo.observe(document.documentElement,{childList:true,subtree:true});}catch(_){ }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,500)); else setTimeout(boot,500);
  window.addEventListener('load',()=>{setTimeout(boot,900); setTimeout(boot,2000);});
  setInterval(()=>{try{injectEditButtons(); bindFilters();}catch(_){}},1500);
  console.log('Tasneef v352 HARD inventory edit/filter/totals loaded');
})();

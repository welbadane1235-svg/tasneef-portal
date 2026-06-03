/* TASNEEF v326 - Finance/Inventory professional report windows + stocktaking */
(function(){
  'use strict';
  if(window.__financeV326ReportsWindows) return;
  window.__financeV326ReportsWindows = true;

  const LS={
    suppliers:'tasneef_v312_suppliers',
    items:'tasneef_v312_items',
    purchases:'tasneef_v312_purchases',
    moves:'tasneef_v312_moves',
    stocktakes:'tasneef_v326_stocktakes'
  };
  const $=id=>document.getElementById(id);
  const parse=(k,d=[])=>{try{return JSON.parse(localStorage.getItem(k)||'null')||d}catch(e){return d}};
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const n=v=>Number(v||0)||0;
  const money=v=>n(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';
  const today=()=>new Date().toISOString().slice(0,10);
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);

  function projects(){return Array.isArray(window.data?.projects)?window.data.projects:[];}
  function supervisors(){return Array.isArray(window.data?.supervisors)?window.data.supervisors:[];}
  function projectName(id){const p=projects().find(x=>String(x.id)===String(id)); return p?(p.name||p.project_name||p.title||id):(id||'-');}
  function supervisorName(id,name){if(name) return name; const s=supervisors().find(x=>String(x.id)===String(id)); return s?(s.full_name||s.name||s.username||id):(id||'-');}
  function supplierName(id){const s=parse(LS.suppliers).find(x=>String(x.id)===String(id)); return s?s.name:'-';}
  function itemById(id){return parse(LS.items).find(x=>String(x.id)===String(id))||{};}
  function itemName(id){const i=itemById(id); return i.name||'-';}
  function itemCode(id){const i=itemById(id); return i.code||i.company_code||'-';}
  function itemUnit(id){return itemById(id).unit||'حبة';}
  function costOfItem(id){const i=itemById(id); return n(i.price_after_vat||i.price_after||i.price_included||i.price_before||i.price||0);}
  function costTarget(m){const t=m.cost_type||'FM'; if(t==='FM') return projectName(m.project_id || (m.project_ids||[])[0] || ''); if(t==='CN') return m.order_no||'-'; return m.general_note||m.notes||'عام';}
  function optionProjects(){return '<option value="">كل المشاريع</option>'+projects().map(p=>`<option value="${esc(p.id)}">${esc(p.name||p.project_name||p.title||p.id)}</option>`).join('');}
  function optionSupervisors(){return '<option value="">كل المشرفين</option>'+supervisors().map(s=>`<option value="${esc(s.id)}">${esc(s.full_name||s.name||s.username||s.id)}</option>`).join('');}
  function image(src){return src?`<img src="${esc(src)}" style="width:44px;height:44px;object-fit:cover;border-radius:12px;border:1px solid #dfece7">`:'<div class="fi-r-img">صورة</div>';}

  function ensureStyle(){
    if($('styleFiV326Reports')) return;
    const st=document.createElement('style'); st.id='styleFiV326Reports'; st.textContent=`
      .fi-r-wrap{direction:rtl;display:grid;gap:14px}.fi-r-toolbar{background:#fff;border:1px solid #dfece7;border-radius:22px;padding:14px;display:grid;gap:12px;box-shadow:0 8px 26px rgba(6,61,49,.04)}.fi-r-toolbar .grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.fi-r-toolbar label{font-weight:900;color:#063d31;font-size:12px}.fi-r-toolbar input,.fi-r-toolbar select{height:42px;border:1px solid #d8e7e2;border-radius:13px;padding:0 10px;background:#fff;min-width:0}.fi-r-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.fi-r-actions button,.fi-r-nav button{border:0;border-radius:14px;padding:10px 14px;font-weight:900;cursor:pointer;background:#eaf4f1;color:#063d31}.fi-r-actions button.primary,.fi-r-nav button.active{background:#064234;color:#fff}.fi-r-actions button.danger{background:#c43b3b;color:#fff}.fi-r-nav{background:#fff;border:1px solid #dfece7;border-radius:22px;padding:10px;display:flex;gap:8px;flex-wrap:wrap;box-shadow:0 8px 26px rgba(6,61,49,.04)}.fi-r-main{background:#fff;border:1px solid #dfece7;border-radius:24px;padding:16px;box-shadow:0 8px 26px rgba(6,61,49,.04);min-height:360px}.fi-r-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;border-bottom:1px solid #edf3f0;padding-bottom:12px;margin-bottom:12px}.fi-r-head h3{margin:0;color:#063d31}.fi-r-sub{color:#6b7d77;font-size:13px}.fi-r-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.fi-r-kpi{border:1px solid #dfece7;border-radius:18px;background:#fbfefd;padding:12px}.fi-r-kpi small{display:block;color:#6b7d77}.fi-r-kpi b{display:block;color:#063d31;font-size:22px;margin-top:5px}.fi-r-table-wrap{overflow:auto;border:1px solid #edf3f0;border-radius:16px}.fi-r-table{width:100%;border-collapse:collapse;min-width:920px}.fi-r-table th{position:sticky;top:0;background:#eef7f3;color:#063d31;text-align:right;padding:10px;font-size:12px}.fi-r-table td{border-bottom:1px solid #edf3f0;padding:10px;vertical-align:middle}.fi-r-chip{display:inline-flex;border-radius:999px;padding:5px 9px;font-weight:900;font-size:12px;background:#eef7f3;color:#064234}.fi-r-chip.warn{background:#fff4d8;color:#8a5b00}.fi-r-chip.bad{background:#fde8e8;color:#a42020}.fi-r-empty{padding:24px;text-align:center;color:#6b7d77}.fi-r-img{width:44px;height:44px;border-radius:12px;background:#eef7f3;display:grid;place-items:center;color:#0a6b50;font-size:11px}.fi-r-print-logo{height:54px;object-fit:contain}.fi-r-stock-input{width:90px!important;height:34px!important;text-align:center;border:1px solid #d8e7e2;border-radius:10px}.fi-r-note-input{width:160px!important;height:34px!important;border:1px solid #d8e7e2;border-radius:10px}.fi-r-small-btn{padding:7px 10px!important;border-radius:10px!important}.fi-r-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}.fi-r-card-mini{border:1px solid #dfece7;border-radius:18px;background:#fbfefd;padding:12px}.fi-r-card-mini h4{margin:0 0 8px;color:#063d31}@media(max-width:1050px){.fi-r-toolbar .grid,.fi-r-kpis{grid-template-columns:1fr 1fr}.fi-r-head{display:grid}.fi-r-main{padding:10px}}@media(max-width:650px){.fi-r-toolbar .grid,.fi-r-kpis{grid-template-columns:1fr}.fi-r-actions button,.fi-r-nav button{width:100%}}
      @media print{body *{visibility:hidden!important}.fi-r-print-area,.fi-r-print-area *{visibility:visible!important}.fi-r-print-area{position:absolute;inset:0;background:#fff;padding:18px}.fi-r-actions,.fi-r-nav,.fi-r-toolbar{display:none!important}.fi-r-table th{position:static}.fi-r-main{box-shadow:none;border:0}.fi-r-table{min-width:0;font-size:11px}.fi-r-table th,.fi-r-table td{padding:6px}}
    `; document.head.appendChild(st);
  }

  function filters(){return {
    project:$('fiRProject')?.value||'',
    supervisor:$('fiRSupervisor')?.value||'',
    cost:$('fiRCost')?.value||'',
    from:$('fiRFrom')?.value||'',
    to:$('fiRTo')?.value||'',
    q:String($('fiRQ')?.value||'').trim().toLowerCase()
  };}
  function inDate(date,f){date=String(date||'').slice(0,10); if(f.from && date<f.from) return false; if(f.to && date>f.to) return false; return true;}
  function filteredMoves(){const f=filters(); return parse(LS.moves).filter(m=>{
    if(!inDate(m.date,f)) return false;
    if(f.cost && String(m.cost_type||'FM')!==String(f.cost)) return false;
    if(f.supervisor && String(m.supervisor_id)!==String(f.supervisor)) return false;
    if(f.project && String(m.project_id || (m.project_ids||[])[0] || '')!==String(f.project)) return false;
    if(f.q){const blob=[m.type,m.status,m.order_no,m.general_note,m.notes,m.reason,m.batch_no,itemName(m.item_id),itemCode(m.item_id),costTarget(m),supervisorName(m.supervisor_id,m.supervisor_name)].join(' ').toLowerCase(); if(!blob.includes(f.q)) return false;}
    return true;
  });}
  function filteredPurchases(){const f=filters(); return parse(LS.purchases).filter(p=>{
    if(!inDate(p.date,f)) return false;
    if(f.q){const blob=[p.invoice_no,p.notes,supplierName(p.supplier_id),(p.lines||[]).map(l=>itemName(l.item_id)).join(' ')].join(' ').toLowerCase(); if(!blob.includes(f.q))return false;}
    return true;
  });}
  function filteredItems(){const f=filters(); return parse(LS.items).filter(i=>{
    if(f.q){const blob=[i.name,i.code,i.company_code,i.category,i.unit,supplierName(i.supplier_id)].join(' ').toLowerCase(); if(!blob.includes(f.q))return false;}
    return true;
  });}
  function purchaseTotals(purchases){return purchases.reduce((a,p)=>{(p.lines||[]).forEach(l=>{a.before+=n(l.before);a.vat+=n(l.vat);a.after+=n(l.after);}); return a;},{before:0,vat:0,after:0});}
  function moveCost(m){return n(m.amount||m.after||m.before||(n(m.qty)*costOfItem(m.item_id)));}

  function reportHeader(title,subtitle){return `<div class="fi-r-head"><div><h3>${esc(title)}</h3><div class="fi-r-sub">${esc(subtitle||'')}</div></div><div class="fi-r-actions"><button class="primary" onclick="financeV326PrintReport()">طباعة PDF</button><button onclick="financeV326ExportCurrentCsv()">تصدير CSV</button></div></div>`;}
  function setBody(html){const el=$('fiRReportBody'); if(el) el.innerHTML=html;}
  function setActiveReport(key){document.querySelectorAll('.fi-r-nav button').forEach(b=>b.classList.toggle('active',b.dataset.report===key)); localStorage.setItem('tasneef_v326_active_report',key);}

  window.financeV326ApplyFilters=function(){window.financeV326OpenReport(localStorage.getItem('tasneef_v326_active_report')||'summary');};
  window.financeV326ResetFilters=function(){['fiRProject','fiRSupervisor','fiRCost','fiRFrom','fiRTo','fiRQ'].forEach(id=>{if($(id))$(id).value=''}); window.financeV326ApplyFilters();};
  window.financeV326OpenReport=function(key){ensureStyle(); setActiveReport(key); ({summary:renderSummary,inventory:renderInventory,stocktake:renderStocktake,suppliers:renderSuppliersReport,products:renderProductsReport,purchases:renderPurchasesReport,movements:renderMovementsReport,costs:renderCostReport}[key]||renderSummary)();};

  function renderReports(){
    ensureStyle(); const body=$('fiBody_reports'); if(!body) return;
    body.innerHTML=`<div class="fi-r-wrap"><div class="fi-r-toolbar"><div class="grid"><div><label>المشروع</label><select id="fiRProject">${optionProjects()}</select></div><div><label>المشرف</label><select id="fiRSupervisor">${optionSupervisors()}</select></div><div><label>مركز التكلفة</label><select id="fiRCost"><option value="">كل المراكز</option><option value="FM">FM</option><option value="CN">CN</option><option value="GENERAL">GENERAL</option></select></div><div><label>من تاريخ</label><input type="date" id="fiRFrom"></div><div><label>إلى تاريخ</label><input type="date" id="fiRTo"></div><div><label>بحث</label><input id="fiRQ" placeholder="منتج، كود، مورد، حركة..."></div></div><div class="fi-r-actions"><button class="primary" onclick="financeV326ApplyFilters()">تطبيق الفلاتر</button><button onclick="financeV326ResetFilters()">إعادة تعيين</button><button onclick="financeV326PrintReport()">طباعة التقرير</button></div></div><div class="fi-r-nav"><button data-report="summary" onclick="financeV326OpenReport('summary')">ملخص شامل</button><button data-report="inventory" onclick="financeV326OpenReport('inventory')">تقرير المخزون</button><button data-report="stocktake" onclick="financeV326OpenReport('stocktake')">جرد المخزن</button><button data-report="suppliers" onclick="financeV326OpenReport('suppliers')">الموردين</button><button data-report="products" onclick="financeV326OpenReport('products')">المنتجات</button><button data-report="purchases" onclick="financeV326OpenReport('purchases')">فواتير الشراء</button><button data-report="movements" onclick="financeV326OpenReport('movements')">حركة المخزون</button><button data-report="costs" onclick="financeV326OpenReport('costs')">مركز التكلفة</button></div><div id="fiRReportBody" class="fi-r-main fi-r-print-area"></div></div>`;
    setTimeout(()=>window.financeV326OpenReport(localStorage.getItem('tasneef_v326_active_report')||'summary'),20);
  }

  function renderSummary(){
    const items=filteredItems(), moves=filteredMoves(), purchases=filteredPurchases(), suppliers=parse(LS.suppliers);
    const pt=purchaseTotals(purchases); const mc=moves.reduce((a,m)=>a+moveCost(m),0); const low=items.filter(i=>n(i.qty)<=n(i.min_qty)).length;
    setBody(`${reportHeader('ملخص مالي ومخزني','نافذة مختصرة حسب الفلاتر المحددة')}
      <div class="fi-r-kpis"><div class="fi-r-kpi"><small>الموردين</small><b>${suppliers.length}</b></div><div class="fi-r-kpi"><small>الأصناف</small><b>${items.length}</b></div><div class="fi-r-kpi"><small>تنبيهات نقص</small><b>${low}</b></div><div class="fi-r-kpi"><small>حركات المخزون</small><b>${moves.length}</b></div><div class="fi-r-kpi"><small>فواتير الشراء</small><b>${purchases.length}</b></div><div class="fi-r-kpi"><small>قيمة شراء قبل الضريبة</small><b>${money(pt.before)}</b></div><div class="fi-r-kpi"><small>ضريبة الشراء</small><b>${money(pt.vat)}</b></div><div class="fi-r-kpi"><small>تكلفة الحركات</small><b>${money(mc)}</b></div></div>
      <div class="fi-r-cards"><div class="fi-r-card-mini"><h4>ما يظهر هنا</h4><p>هذا الملخص يتغير حسب المشروع، المشرف، مركز التكلفة، والتاريخ.</p></div><div class="fi-r-card-mini"><h4>جرد المخزن</h4><p>افتح نافذة جرد المخزن لتسجيل الكمية الفعلية ومقارنة الفرق.</p></div><div class="fi-r-card-mini"><h4>الطباعة</h4><p>زر الطباعة يخرج تقريرًا رسميًا يحتوي على شعار الشركة وبيانات الفلترة.</p></div></div>`);
  }

  function renderInventory(){
    const items=filteredItems(); const rows=items.map(i=>{const low=n(i.qty)<=n(i.min_qty); const valBefore=n(i.price_before_vat||i.price_before||i.price_excluded||i.price||0)*n(i.qty); const valAfter=n(i.price_after_vat||i.price_after||i.price_included||i.price||0)*n(i.qty); return `<tr><td>${image(i.image_data||i.image_url)}</td><td><b>${esc(i.name||'-')}</b><br><small>${esc(i.category||'-')} / ${esc(i.unit||'')}</small></td><td>${esc(i.code||'-')}</td><td>${esc(i.company_code||'-')}</td><td>${n(i.qty)}</td><td>${n(i.min_qty)}</td><td>${money(valBefore)}</td><td>${money(valAfter)}</td><td><span class="fi-r-chip ${low?'warn':'ok'}">${low?'منخفض':'سليم'}</span></td></tr>`;}).join('');
    setBody(`${reportHeader('تقرير المخزون الحالي','يعرض الكمية الحالية، حد التنبيه، وقيمة المخزون')}${kpiInventory(items)}<div class="fi-r-table-wrap"><table class="fi-r-table"><thead><tr><th>الصورة</th><th>الصنف</th><th>كود المنتج</th><th>كود الشركة</th><th>الكمية</th><th>حد التنبيه</th><th>القيمة قبل الضريبة</th><th>القيمة شامل</th><th>الحالة</th></tr></thead><tbody>${rows||'<tr><td colspan="9"><div class="fi-r-empty">لا توجد بيانات</div></td></tr>'}</tbody></table></div>`);
  }
  function kpiInventory(items){const low=items.filter(i=>n(i.qty)<=n(i.min_qty)).length; const qty=items.reduce((a,i)=>a+n(i.qty),0); const before=items.reduce((a,i)=>a+n(i.qty)*n(i.price_before_vat||i.price_before||0),0); const after=items.reduce((a,i)=>a+n(i.qty)*n(i.price_after_vat||i.price_after||i.price_before||0),0); return `<div class="fi-r-kpis"><div class="fi-r-kpi"><small>عدد الأصناف</small><b>${items.length}</b></div><div class="fi-r-kpi"><small>إجمالي الكميات</small><b>${qty}</b></div><div class="fi-r-kpi"><small>أصناف منخفضة</small><b>${low}</b></div><div class="fi-r-kpi"><small>قيمة المخزون شامل</small><b>${money(after)}</b></div></div>`;}

  function renderStocktake(){
    const items=filteredItems(); const rows=items.map(i=>`<tr data-stock-item="${esc(i.id)}"><td>${image(i.image_data||i.image_url)}</td><td><b>${esc(i.name||'-')}</b><br><small>${esc(i.code||'-')} / ${esc(i.company_code||'-')}</small></td><td>${n(i.qty)}</td><td>${esc(i.unit||'')}</td><td><input class="fi-r-stock-input" type="number" step="0.01" value="${n(i.qty)}" oninput="financeV326StockDiff(this)"></td><td class="stock-diff">0</td><td><input class="fi-r-note-input" placeholder="ملاحظة"></td></tr>`).join('');
    setBody(`${reportHeader('جرد المخزن','سجل الكمية الفعلية وقارنها مع الكمية المسجلة في النظام')}
      <div class="fi-r-actions" style="margin-bottom:10px"><button class="primary" onclick="financeV326SaveStocktake()">حفظ محضر الجرد</button><button onclick="financeV326PrintReport()">طباعة الجرد</button></div>
      <div class="fi-r-table-wrap"><table class="fi-r-table"><thead><tr><th>الصورة</th><th>الصنف</th><th>كمية النظام</th><th>الوحدة</th><th>كمية الجرد</th><th>الفرق</th><th>ملاحظات</th></tr></thead><tbody>${rows||'<tr><td colspan="7"><div class="fi-r-empty">لا توجد منتجات للجرد</div></td></tr>'}</tbody></table></div>`);
  }
  window.financeV326StockDiff=function(inp){const tr=inp.closest('tr'); const sys=n(tr.children[2].textContent); const diff=n(inp.value)-sys; const td=tr.querySelector('.stock-diff'); td.textContent=diff; td.style.color=diff===0?'#063d31':diff<0?'#b42318':'#11794a';};
  window.financeV326SaveStocktake=function(){const rows=[...document.querySelectorAll('tr[data-stock-item]')].map(tr=>({item_id:tr.dataset.stockItem,system_qty:n(tr.children[2].textContent),counted_qty:n(tr.querySelector('.fi-r-stock-input')?.value),diff:n(tr.querySelector('.fi-r-stock-input')?.value)-n(tr.children[2].textContent),notes:tr.querySelector('.fi-r-note-input')?.value||''})); const arr=parse(LS.stocktakes); arr.push({id:uid(),date:new Date().toISOString(),rows}); save(LS.stocktakes,arr); alert('تم حفظ محضر الجرد');};

  function renderSuppliersReport(){const suppliers=parse(LS.suppliers).filter(s=>{const q=filters().q; return !q||JSON.stringify(s).toLowerCase().includes(q);}); const purchases=parse(LS.purchases); const rows=suppliers.map(s=>{const ps=purchases.filter(p=>String(p.supplier_id)===String(s.id)); const t=purchaseTotals(ps); return `<tr><td><b>${esc(s.name||'-')}</b><br><small>${esc(s.vat||'')}</small></td><td>${esc(s.phone||'-')}</td><td>${esc(s.type||'-')}</td><td>${ps.length}</td><td>${money(t.before)}</td><td>${money(t.vat)}</td><td>${money(t.after)}</td><td><span class="fi-r-chip ${s.status==='موقوف'?'bad':'ok'}">${esc(s.status||'نشط')}</span></td></tr>`;}).join(''); setBody(`${reportHeader('تقرير الموردين','مشتريات كل مورد وإجمالياتها')}
    <div class="fi-r-table-wrap"><table class="fi-r-table"><thead><tr><th>المورد</th><th>الجوال</th><th>النوع</th><th>عدد الفواتير</th><th>قبل الضريبة</th><th>الضريبة</th><th>شامل</th><th>الحالة</th></tr></thead><tbody>${rows||'<tr><td colspan="8"><div class="fi-r-empty">لا توجد بيانات</div></td></tr>'}</tbody></table></div>`);}

  function renderProductsReport(){const items=filteredItems(); const moves=parse(LS.moves), purchases=parse(LS.purchases); const rows=items.map(i=>{let inQty=0; purchases.forEach(p=>(p.lines||[]).forEach(l=>{if(String(l.item_id)===String(i.id))inQty+=n(l.qty)})); const out=moves.filter(m=>String(m.item_id)===String(i.id)); const outQty=out.reduce((a,m)=>a+n(m.qty),0); const consumed=out.filter(m=>m.type==='استهلاك').reduce((a,m)=>a+n(m.qty),0); return `<tr><td>${image(i.image_data||i.image_url)}</td><td><b>${esc(i.name||'-')}</b><br><small>${esc(i.category||'-')} / ${esc(i.unit||'')}</small></td><td>${esc(i.code||'-')}</td><td>${esc(i.company_code||'-')}</td><td>${inQty}</td><td>${outQty}</td><td>${consumed}</td><td>${n(i.qty)}</td><td>${money(n(i.price_before_vat||i.price_before||0))}</td><td>${money(n(i.price_after_vat||i.price_after||0))}</td></tr>`;}).join(''); setBody(`${reportHeader('تقرير المنتجات','دخول، خروج، استهلاك، ومتبقي كل منتج')}
    <div class="fi-r-table-wrap"><table class="fi-r-table"><thead><tr><th>الصورة</th><th>المنتج</th><th>الكود</th><th>كود الشركة</th><th>دخل</th><th>خرج</th><th>مستهلك</th><th>المتبقي</th><th>سعر قبل</th><th>سعر شامل</th></tr></thead><tbody>${rows||'<tr><td colspan="10"><div class="fi-r-empty">لا توجد بيانات</div></td></tr>'}</tbody></table></div>`);}

  function renderPurchasesReport(){const purchases=filteredPurchases(); const rows=purchases.map(p=>{const t=totals(p.lines||[]); return `<tr><td><b>${esc(p.invoice_no||p.id)}</b><br><small>${esc(p.date||'')}</small></td><td>${esc(supplierName(p.supplier_id))}</td><td>${(p.lines||[]).length}</td><td>${money(t.before)}</td><td>${money(t.vat)}</td><td>${money(t.after)}</td><td>${esc(p.file_name||'-')}</td><td>${esc(p.notes||'-')}</td></tr>`;}).join(''); const all=purchaseTotals(purchases); setBody(`${reportHeader('تقرير فواتير الشراء','تفاصيل الفواتير حسب التاريخ والبحث')}
    <div class="fi-r-kpis"><div class="fi-r-kpi"><small>عدد الفواتير</small><b>${purchases.length}</b></div><div class="fi-r-kpi"><small>قبل الضريبة</small><b>${money(all.before)}</b></div><div class="fi-r-kpi"><small>الضريبة</small><b>${money(all.vat)}</b></div><div class="fi-r-kpi"><small>شامل</small><b>${money(all.after)}</b></div></div>
    <div class="fi-r-table-wrap"><table class="fi-r-table"><thead><tr><th>الفاتورة</th><th>المورد</th><th>عدد الأصناف</th><th>قبل</th><th>ضريبة</th><th>شامل</th><th>المرفق</th><th>ملاحظات</th></tr></thead><tbody>${rows||'<tr><td colspan="8"><div class="fi-r-empty">لا توجد فواتير</div></td></tr>'}</tbody></table></div>`);}
  function totals(lines){return (lines||[]).reduce((a,l)=>{a.before+=n(l.before);a.vat+=n(l.vat);a.after+=n(l.after);return a;},{before:0,vat:0,after:0});}

  function renderMovementsReport(){const moves=filteredMoves(); const rows=moves.map(m=>`<tr><td><b>${esc(m.batch_no||m.id)}</b><br><small>${esc(m.date||'')}</small></td><td>${esc(supervisorName(m.supervisor_id,m.supervisor_name))}</td><td><b>${esc(itemName(m.item_id))}</b><br><small>${esc(itemCode(m.item_id))}</small></td><td>${n(m.qty)} ${esc(itemUnit(m.item_id))}</td><td>${esc(m.type||'-')}</td><td>${esc(m.cost_type||'FM')}</td><td>${esc(costTarget(m))}</td><td>${money(moveCost(m))}</td><td><span class="fi-r-chip ${m.status==='مرفوض'?'bad':m.status==='بانتظار'?'warn':'ok'}">${esc(m.status||'-')}</span></td></tr>`).join(''); const total=moves.reduce((a,m)=>a+moveCost(m),0); setBody(`${reportHeader('تقرير حركة المخزون','حركة الأصناف حسب المشروع، المشرف، مركز التكلفة، والتاريخ')}
    <div class="fi-r-kpis"><div class="fi-r-kpi"><small>عدد الحركات</small><b>${moves.length}</b></div><div class="fi-r-kpi"><small>إجمالي التكلفة</small><b>${money(total)}</b></div><div class="fi-r-kpi"><small>استهلاك</small><b>${moves.filter(m=>m.type==='استهلاك').length}</b></div><div class="fi-r-kpi"><small>تالف/هدر</small><b>${moves.filter(m=>['تالف','هدر'].includes(m.type)).length}</b></div></div>
    <div class="fi-r-table-wrap"><table class="fi-r-table"><thead><tr><th>الحركة</th><th>المشرف</th><th>المنتج</th><th>الكمية</th><th>النوع</th><th>المركز</th><th>الوجهة</th><th>التكلفة</th><th>الحالة</th></tr></thead><tbody>${rows||'<tr><td colspan="9"><div class="fi-r-empty">لا توجد حركات</div></td></tr>'}</tbody></table></div>`);}

  function renderCostReport(){const moves=filteredMoves(); const agg={}; moves.forEach(m=>{const key=[m.cost_type||'FM',costTarget(m)].join('::'); if(!agg[key])agg[key]={cost_type:m.cost_type||'FM',target:costTarget(m),qty:0,cost:0,items:{}}; agg[key].qty+=n(m.qty); agg[key].cost+=moveCost(m); const iname=itemName(m.item_id); agg[key].items[iname]=(agg[key].items[iname]||0)+n(m.qty);}); const rows=Object.values(agg).sort((a,b)=>b.cost-a.cost).map(a=>`<tr><td><span class="fi-r-chip">${esc(a.cost_type)}</span></td><td><b>${esc(a.target)}</b></td><td>${a.qty}</td><td>${money(a.cost)}</td><td>${Object.entries(a.items).slice(0,5).map(([k,v])=>`${esc(k)}: ${v}`).join('<br>')}</td></tr>`).join(''); const total=Object.values(agg).reduce((x,a)=>x+a.cost,0); setBody(`${reportHeader('تقرير مركز التكلفة','تكلفة FM / CN / GENERAL حسب الفلاتر')}
    <div class="fi-r-kpis"><div class="fi-r-kpi"><small>عدد مراكز التكلفة</small><b>${Object.keys(agg).length}</b></div><div class="fi-r-kpi"><small>إجمالي التكلفة</small><b>${money(total)}</b></div><div class="fi-r-kpi"><small>FM</small><b>${money(moves.filter(m=>(m.cost_type||'FM')==='FM').reduce((a,m)=>a+moveCost(m),0))}</b></div><div class="fi-r-kpi"><small>CN / GENERAL</small><b>${money(moves.filter(m=>(m.cost_type||'FM')!=='FM').reduce((a,m)=>a+moveCost(m),0))}</b></div></div>
    <div class="fi-r-table-wrap"><table class="fi-r-table"><thead><tr><th>المركز</th><th>الوجهة</th><th>الكمية</th><th>التكلفة</th><th>تفصيل الأصناف</th></tr></thead><tbody>${rows||'<tr><td colspan="5"><div class="fi-r-empty">لا توجد بيانات تكلفة</div></td></tr>'}</tbody></table></div>`);}

  window.financeV326PrintReport=function(){
    const title=document.querySelector('#fiRReportBody h3')?.textContent||'تقرير المالية والمخزون';
    const f=filters(); const filtersText=[f.project?'المشروع: '+projectName(f.project):'',f.supervisor?'المشرف: '+supervisorName(f.supervisor):'',f.cost?'مركز التكلفة: '+f.cost:'',f.from?'من: '+f.from:'',f.to?'إلى: '+f.to:''].filter(Boolean).join(' | ')||'كل البيانات';
    const content=$('fiRReportBody')?.innerHTML||'';
    const w=window.open('','_blank');
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Arial,Tahoma,sans-serif;margin:24px;color:#062f27}.head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #064234;padding-bottom:12px;margin-bottom:18px}.head img{height:58px}.meta{color:#60746e;margin-top:4px}.fi-r-actions,.fi-r-nav,.fi-r-toolbar{display:none!important}.fi-r-main{border:0!important;box-shadow:none!important;padding:0!important}.fi-r-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.fi-r-kpi,.fi-r-card-mini{border:1px solid #dfece7;border-radius:12px;padding:10px}.fi-r-table{width:100%;border-collapse:collapse;font-size:11px}.fi-r-table th{background:#eef7f3;color:#063d31}.fi-r-table th,.fi-r-table td{border:1px solid #dfece7;padding:6px;text-align:right}.fi-r-table-wrap{overflow:visible}.fi-r-img,img{max-width:46px;max-height:46px}.fi-r-head{border:0;margin:0 0 10px}.fi-r-head h3{margin:0}.fi-r-chip{display:inline-block;padding:3px 7px;border-radius:20px;background:#eef7f3}@media print{body{margin:10mm}.head{break-after:avoid}}</style></head><body><div class="head"><div><h1>${esc(title)}</h1><div class="meta">${esc(filtersText)}</div><div class="meta">تاريخ الطباعة: ${new Date().toLocaleString('ar-SA')}</div></div><img src="tasneef_logo_print.png" onerror="this.style.display='none'"></div><div class="fi-r-main">${content}</div></body></html>`);
    w.document.close(); setTimeout(()=>w.print(),500);
  };
  window.financeV326ExportCurrentCsv=function(){
    const table=$('fiRReportBody')?.querySelector('table'); if(!table) return alert('لا يوجد جدول للتصدير');
    const rows=[...table.querySelectorAll('tr')].map(tr=>[...tr.children].map(td=>'"'+String(td.innerText||'').replace(/"/g,'""').replace(/\n/g,' ')+'"').join(','));
    const blob=new Blob(['\ufeff'+rows.join('\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='tasneef-finance-report.csv'; a.click(); URL.revokeObjectURL(a.href);
  };

  const oldTab=window.financeV312Tab;
  window.financeV312Tab=function(tab,btn){const r=oldTab?oldTab.apply(this,arguments):undefined; if(tab==='reports') setTimeout(renderReports,80); return r;};
  const oldBoot=window.financeV312Boot;
  window.financeV312Boot=function(){if(oldBoot) oldBoot.apply(this,arguments); setTimeout(()=>{const b=$('fiBody_reports'); if(b&&b.classList.contains('active'))renderReports();},160);};
  window.financeV312RenderReports=renderReports;
  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('button'); if(b && (b.textContent||'').trim()==='التقارير') setTimeout(renderReports,100);},true);
})();

/* TASNEEF v314 - Finance Inventory Safe Render + Daily Isolation Fix */
(function(){
  'use strict';
  const VERSION='314';
  const $=id=>document.getElementById(id);
  const LS={
    suppliers:'tasneef_v312_suppliers',
    items:'tasneef_v312_items',
    purchases:'tasneef_v312_purchases',
    moves:'tasneef_v312_moves'
  };
  const safeParse=(v,d)=>{try{return JSON.parse(v||'')||d}catch(_){return d}};
  const load=k=>safeParse(localStorage.getItem(k),[]);
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const num=v=>Number(v||0)||0;
  const money=v=>num(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';
  const today=()=>new Date().toISOString().slice(0,10);
  let active='dashboard';
  let loaded=false;
  let editSupplierId='', editItemId='';
  const categories=['كهرباء','سباكة','نظافة','زراعة','تعقيم','أدوات','مواد','أخرى'];
  const units=['حبة','كرتون','لتر','متر','كيس','علبة','رول','طقم','أخرى'];
  const moveTypes=['صرف من مشرف','استهلاك من مشرف','هدر من مشرف','تالف من مشرف','سكراب'];
  const costTypes=['FM','CN','GENERAL'];

  function projects(){ return Array.isArray(window.data?.projects)?window.data.projects:[]; }
  function supervisors(){ return Array.isArray(window.data?.supervisors)?window.data.supervisors:[]; }
  function projectName(id){ const p=projects().find(x=>String(x.id)===String(id)); return p?(p.name||p.project_name||id):id; }
  function supplierName(id){ const s=load(LS.suppliers).find(x=>x.id===id); return s?s.name:'-'; }
  function itemName(id){ const it=load(LS.items).find(x=>x.id===id); return it?it.name:'-'; }
  function itemCost(id){ const it=load(LS.items).find(x=>x.id===id); return num(it?.price); }
  function updateItemStock(itemId, delta){ const items=load(LS.items); const it=items.find(x=>x.id===itemId); if(it){ it.qty=num(it.qty)+num(delta); it.updated_at=new Date().toISOString(); save(LS.items,items); } }
  function addCostFromMovement(m){ return {date:m.date,type:m.cost_type,project_ids:m.project_ids||[],order_no:m.order_no||'',source:'حركة المخزون',ref:m.id,item_id:m.item_id,qty:num(m.qty),amount:num(m.amount),notes:m.notes||m.reason||''}; }
  function addCostFromPurchase(p,line){ return {date:p.date,type:p.cost_type,project_ids:p.project_ids||[],order_no:p.order_no||'',source:'فاتورة شراء',ref:p.invoice_no||p.id,item_id:line.item_id,qty:num(line.qty),amount:num(line.total),notes:p.notes||''}; }
  function allCostRows(){
    const rows=[];
    load(LS.purchases).forEach(p=>(p.lines||[]).forEach(line=>rows.push(addCostFromPurchase(p,line))));
    load(LS.moves).filter(m=>m.status==='معتمد' || m.status==='تم الصرف' || m.type==='سكراب').forEach(m=>rows.push(addCostFromMovement(m)));
    return rows.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  }
  function options(arr, val='', label='اختر'){
    return `<option value="">${esc(label)}</option>`+arr.map(x=>`<option value="${esc(x.id??x)}" ${String(val)===String(x.id??x)?'selected':''}>${esc(x.name??x)}</option>`).join('');
  }
  function ensureNav(){
    const side=document.querySelector('.side'); if(!side || document.querySelector('[data-finance-v312]')) return;
    const btn=document.createElement('button'); btn.className='nav'; btn.dataset.financeV312='1'; btn.textContent='المالية والمخزون';
    btn.onclick=function(){ window.showPage('financeInventoryV312',btn); };
    const exportBtn=[...side.querySelectorAll('.nav')].find(b=>(b.textContent||'').includes('التصدير'));
    side.insertBefore(btn, exportBtn || side.querySelector('.nav.danger'));
  }
  function ensureStyle(){ if($('styleFinanceV312')) return; const st=document.createElement('style'); st.id='styleFinanceV312'; st.textContent=`
    .fi-v312{display:grid;gap:14px}.fi-hero{background:linear-gradient(135deg,#073e31,#0a6b50);border-radius:24px;padding:18px 20px;color:#fff;display:flex;align-items:center;justify-content:space-between;gap:12px;box-shadow:0 18px 44px rgba(6,61,49,.16)}.fi-hero h2{margin:0;color:#fff}.fi-hero p{margin:5px 0 0;color:#ddfff1;line-height:1.7}.fi-tabs{display:flex;gap:8px;flex-wrap:wrap;background:#fff;border:1px solid var(--line,#dce6e2);border-radius:18px;padding:10px}.fi-tabs button{background:#eef6f3;color:#0A4033;border:1px solid #dce6e2;border-radius:999px}.fi-tabs button.active{background:#0A4033;color:white}.fi-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}.fi-kpi{background:#fff;border:1px solid #dce6e2;border-radius:18px;padding:14px;box-shadow:0 8px 22px rgba(0,0,0,.04)}.fi-kpi small{color:#687a74}.fi-kpi b{display:block;font-size:22px;color:#073e31;margin-top:6px}.fi-grid{display:grid;gap:12px}.fi-grid.two{grid-template-columns:380px 1fr}.fi-grid.three{grid-template-columns:repeat(3,1fr)}.fi-grid.four{grid-template-columns:repeat(4,1fr)}.fi-card{background:#fff;border:1px solid #dce6e2;border-radius:20px;padding:14px;box-shadow:0 8px 24px rgba(0,0,0,.04)}.fi-card h3{margin-top:0}.fi-form{display:grid;gap:9px}.fi-form label{font-weight:800;color:#073e31;font-size:13px}.fi-form input,.fi-form select,.fi-form textarea{width:100%;box-sizing:border-box}.fi-table{width:100%;border-collapse:separate;border-spacing:0 8px}.fi-table th{font-size:12px;color:#65736f;text-align:right;padding:8px}.fi-table td{background:#fbfdfc;border-top:1px solid #e6efeb;border-bottom:1px solid #e6efeb;padding:10px;vertical-align:middle}.fi-table td:first-child{border-right:1px solid #e6efeb;border-radius:0 12px 12px 0}.fi-table td:last-child{border-left:1px solid #e6efeb;border-radius:12px 0 0 12px}.fi-actions{display:flex;gap:6px;flex-wrap:wrap}.fi-actions button{padding:7px 10px;border-radius:10px}.fi-badge{display:inline-flex;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:900;background:#eef6f3;color:#0A4033}.fi-badge.warn{background:#fff3d7;color:#8a5b00}.fi-badge.danger{background:#fde8e8;color:#a21d1d}.fi-badge.ok{background:#dff7ea;color:#137a4b}.fi-hidden{display:none!important}.fi-line-items{display:grid;gap:8px}.fi-line{display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:8px;align-items:end;background:#f7fbf9;border:1px solid #e6efeb;border-radius:14px;padding:10px}.fi-muted{color:#687a74}.fi-filter{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:8px 0 12px}.fi-note{background:#fffdf5;border:1px dashed #d9bc63;border-radius:14px;padding:10px;line-height:1.7}.fi-tab-body{display:none}.fi-tab-body.active{display:block}.fi-print-only{display:none}@media(max-width:1050px){.fi-grid.two,.fi-grid.three,.fi-grid.four{grid-template-columns:1fr}.fi-line{grid-template-columns:1fr 1fr}.fi-hero{flex-direction:column;align-items:flex-start}}@media print{body *{visibility:hidden}.fi-print-area,.fi-print-area *{visibility:visible}.fi-print-area{position:absolute;inset:0;background:#fff;padding:20px}.fi-tabs,.fi-hero button,.fi-form,.fi-actions,.side,.hero{display:none!important}}
  `; document.head.appendChild(st); }
  function sectionHtml(){ return `<section id="financeInventoryV312" class="page hidden"><div class="fi-v312">
    <div class="fi-hero"><div><h2>المالية والمخزون ومراكز التكلفة</h2><p>قسم مستقل وخفيف: الموردين، المنتجات، فواتير الشراء، حركة المخزون، ومراكز تكلفة FM / CN / GENERAL.</p></div><button class="light" onclick="financeV312RenderAll()">تحديث</button></div>
    <div class="fi-tabs">
      <button class="active" onclick="financeV312Tab('dashboard',this)">الملخص</button>
      <button onclick="financeV312Tab('suppliers',this)">الموردين</button>
      <button onclick="financeV312Tab('items',this)">المنتجات</button>
      <button onclick="financeV312Tab('purchases',this)">إضافة مخزون / فواتير</button>
      <button onclick="financeV312Tab('movements',this)">حركة المخزون</button>
      <button onclick="financeV312Tab('costs',this)">مركز التكلفة</button>
      <button onclick="financeV312Tab('reports',this)">التقارير</button>
    </div>
    <div id="fiBody_dashboard" class="fi-tab-body active"></div>
    <div id="fiBody_suppliers" class="fi-tab-body"></div>
    <div id="fiBody_items" class="fi-tab-body"></div>
    <div id="fiBody_purchases" class="fi-tab-body"></div>
    <div id="fiBody_movements" class="fi-tab-body"></div>
    <div id="fiBody_costs" class="fi-tab-body"></div>
    <div id="fiBody_reports" class="fi-tab-body"></div>
  </div></section>`; }
  function ensureSection(){ ensureStyle(); ensureNav(); if($('financeInventoryV312')) return; const main=document.querySelector('main.content')||document.body; const wrap=document.createElement('div'); wrap.innerHTML=sectionHtml(); const exportSec=$('export'); main.insertBefore(wrap.firstElementChild, exportSec||null); setTimeout(()=>{try{renderActive();}catch(e){console.error('finance v313 initial render',e);}},0); }
  function hydrateSelects(){
    const supOpts=options(load(LS.suppliers),'','اختر المورد'); ['itemSupplier','purchaseSupplier'].forEach(id=>{if($(id)) $(id).innerHTML=supOpts;});
    const itemOpts=options(load(LS.items),'','اختر المنتج'); ['moveItem','purchaseItemSelect'].forEach(id=>{if($(id)) $(id).innerHTML=itemOpts;});
    const pOpts=options(projects(),'','اختر مشروع'); ['moveProjects','purchaseProjects','costProjectFilter'].forEach(id=>{if($(id)) $(id).innerHTML=pOpts;});
    if($('moveSupervisor')) $('moveSupervisor').innerHTML=options(supervisors(),'','اختر المشرف');
  }
  function setKpis(){ const suppliers=load(LS.suppliers), items=load(LS.items), moves=load(LS.moves), purchases=load(LS.purchases); const low=items.filter(i=>num(i.qty)<=num(i.min_qty)).length; const total=items.reduce((s,i)=>s+num(i.qty)*num(i.price),0); const cost=allCostRows().reduce((s,r)=>s+num(r.amount),0); const html=`<div class="fi-kpis"><div class="fi-kpi"><small>الموردين</small><b>${suppliers.length}</b></div><div class="fi-kpi"><small>الأصناف</small><b>${items.length}</b></div><div class="fi-kpi"><small>تنبيهات النقص</small><b>${low}</b></div><div class="fi-kpi"><small>قيمة المخزون التقريبية</small><b>${money(total)}</b></div><div class="fi-kpi"><small>فواتير الشراء</small><b>${purchases.length}</b></div><div class="fi-kpi"><small>حركات المخزون</small><b>${moves.length}</b></div><div class="fi-kpi"><small>تكلفة مسجلة</small><b>${money(cost)}</b></div></div>`; return html; }
  function renderDashboard(){ const low=load(LS.items).filter(i=>num(i.qty)<=num(i.min_qty)); $('fiBody_dashboard').innerHTML=`${setKpis()}<div class="fi-grid two"><div class="fi-card"><h3>تنبيهات المخزون</h3>${low.length?low.map(i=>`<div class="fi-note"><b>${esc(i.name)}</b><br>الكمية الحالية: ${esc(i.qty)} ${esc(i.unit)} — حد التنبيه: ${esc(i.min_qty)}</div>`).join(''):'<p class="fi-muted">لا توجد أصناف منخفضة.</p>'}</div><div class="fi-card"><h3>آلية العمل المعتمدة</h3><p>إضافة فاتورة شراء تزيد المخزون وتسجل التكلفة. حركة المخزون المعتمدة تخصم الكمية وتدخل على مركز التكلفة حسب FM أو CN أو GENERAL.</p></div></div>`; }
  function renderSuppliers(){ const rows=load(LS.suppliers); $('fiBody_suppliers').innerHTML=`<div class="fi-grid two"><div class="fi-card"><h3>${editSupplierId?'تعديل مورد':'إضافة مورد'}</h3><div class="fi-form"><input type="hidden" id="supplierId" value="${esc(editSupplierId)}"><label>اسم المورد</label><input id="supplierName"><label>رقم الجوال</label><input id="supplierPhone"><label>الرقم الضريبي</label><input id="supplierVat"><label>نوع التوريد</label><select id="supplierType">${categories.map(c=>`<option>${c}</option>`).join('')}</select><label>الحالة</label><select id="supplierStatus"><option>نشط</option><option>موقوف</option></select><label>ملاحظات</label><textarea id="supplierNotes"></textarea><div class="fi-actions"><button onclick="financeV312SaveSupplier()">حفظ المورد</button><button class="light" onclick="financeV312ClearSupplier()">تفريغ</button></div></div></div><div class="fi-card"><h3>قائمة الموردين</h3><div class="fi-filter"><input id="supplierSearch" oninput="financeV312RenderSuppliers()" placeholder="بحث في الموردين"></div><div class="table-wrap"><table class="fi-table"><thead><tr><th>المورد</th><th>الجوال</th><th>النوع</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>${supplierRows(rows)}</tbody></table></div></div></div>`; if(editSupplierId){ const s=rows.find(x=>x.id===editSupplierId); if(s){ ['Name','Phone','Vat','Type','Status','Notes'].forEach(k=>{const el=$('supplier'+k); if(el) el.value=s[k.toLowerCase()]||s[k]||'';}); } } }
  function supplierRows(rows){ const q=String($('supplierSearch')?.value||'').toLowerCase(); return rows.filter(s=>!q||JSON.stringify(s).toLowerCase().includes(q)).slice(0,50).map(s=>`<tr><td><b>${esc(s.name)}</b><br><small>${esc(s.vat||'')}</small></td><td>${esc(s.phone||'-')}</td><td>${esc(s.type||'-')}</td><td><span class="fi-badge ${s.status==='موقوف'?'danger':'ok'}">${esc(s.status||'نشط')}</span></td><td><div class="fi-actions"><button class="light" onclick="financeV312EditSupplier('${s.id}')">تعديل</button><button class="danger" onclick="financeV312DeleteSupplier('${s.id}')">حذف</button></div></td></tr>`).join('')||'<tr><td colspan="5">لا توجد بيانات</td></tr>'; }
  function renderItems(){ const rows=load(LS.items); $('fiBody_items').innerHTML=`<div class="fi-grid two"><div class="fi-card"><h3>${editItemId?'تعديل منتج':'إضافة منتج / صنف'}</h3><div class="fi-form"><input type="hidden" id="itemId" value="${esc(editItemId)}"><label>اسم المنتج</label><input id="itemName"><div class="fi-grid two"><div><label>كود المنتج الداخلي</label><input id="itemCode"></div><div><label>كود الشركة / المورد</label><input id="itemCompanyCode"></div></div><div class="fi-grid two"><div><label>التصنيف</label><select id="itemCategory">${categories.map(c=>`<option>${c}</option>`).join('')}</select></div><div><label>الوحدة</label><select id="itemUnit">${units.map(c=>`<option>${c}</option>`).join('')}</select></div></div><div class="fi-grid two"><div><label>سعر الشراء</label><input type="number" step="0.01" id="itemPrice"></div><div><label>حد التنبيه</label><input type="number" id="itemMinQty" value="0"></div></div><label>المورد</label><select id="itemSupplier"></select><label>ملاحظات</label><textarea id="itemNotes"></textarea><div class="fi-actions"><button onclick="financeV312SaveItem()">حفظ المنتج</button><button class="light" onclick="financeV312ClearItem()">تفريغ</button></div></div></div><div class="fi-card"><h3>قائمة المنتجات</h3><div class="fi-filter"><input id="itemSearch" oninput="financeV312RenderItems()" placeholder="بحث بالاسم أو الكود"><select id="itemCatFilter" onchange="financeV312RenderItems()"><option value="">كل التصنيفات</option>${categories.map(c=>`<option>${c}</option>`).join('')}</select></div><div class="table-wrap"><table class="fi-table"><thead><tr><th>المنتج</th><th>الكود</th><th>التصنيف</th><th>الكمية</th><th>السعر</th><th>إجراء</th></tr></thead><tbody>${itemRows(rows)}</tbody></table></div></div></div>`; hydrateSelects(); if(editItemId){ const it=rows.find(x=>x.id===editItemId); if(it){ const map={itemName:'name',itemCode:'code',itemCompanyCode:'company_code',itemCategory:'category',itemUnit:'unit',itemPrice:'price',itemMinQty:'min_qty',itemSupplier:'supplier_id',itemNotes:'notes'}; Object.entries(map).forEach(([id,k])=>{if($(id)) $(id).value=it[k]||'';}); } } }
  function itemRows(rows){ const q=String($('itemSearch')?.value||'').toLowerCase(), cat=$('itemCatFilter')?.value||''; return rows.filter(i=>(!q||JSON.stringify(i).toLowerCase().includes(q))&&(!cat||i.category===cat)).slice(0,80).map(i=>`<tr><td><b>${esc(i.name)}</b><br><small>${esc(supplierName(i.supplier_id))}</small></td><td>${esc(i.code||'-')}<br><small>${esc(i.company_code||'')}</small></td><td>${esc(i.category||'-')}</td><td><span class="fi-badge ${num(i.qty)<=num(i.min_qty)?'warn':'ok'}">${esc(i.qty||0)} ${esc(i.unit||'')}</span></td><td>${money(i.price)}</td><td><div class="fi-actions"><button class="light" onclick="financeV312EditItem('${i.id}')">تعديل</button><button class="danger" onclick="financeV312DeleteItem('${i.id}')">حذف</button></div></td></tr>`).join('')||'<tr><td colspan="6">لا توجد بيانات</td></tr>'; }
  function renderPurchases(){ $('fiBody_purchases').innerHTML=`<div class="fi-grid two"><div class="fi-card"><h3>إضافة فاتورة شراء / إدخال مخزون</h3><div class="fi-form"><div class="fi-grid two"><div><label>رقم الفاتورة</label><input id="purchaseInvoiceNo"></div><div><label>تاريخ الفاتورة</label><input type="date" id="purchaseDate" value="${today()}"></div></div><label>المورد</label><select id="purchaseSupplier"></select><label>مرفق الفاتورة</label><input type="file" id="purchaseFile" accept=".pdf,image/*"><div class="fi-grid three"><div><label>مركز التكلفة</label><select id="purchaseCostType"><option>FM</option><option>CN</option><option>GENERAL</option></select></div><div><label>مشروع أو أكثر</label><select id="purchaseProjects" multiple size="3"></select></div><div><label>رقم الأوردر</label><input id="purchaseOrderNo" placeholder="إذا كان على أوردر"></div></div><label>ملاحظات</label><textarea id="purchaseNotes"></textarea><hr><h4>المنتجات داخل الفاتورة</h4><div class="fi-grid four"><select id="purchaseItemSelect"></select><input id="purchaseQty" type="number" placeholder="الكمية"><input id="purchasePrice" type="number" step="0.01" placeholder="سعر الوحدة"><button class="light" onclick="financeV312AddPurchaseLine()">إضافة سطر</button></div><div id="purchaseLines" class="fi-line-items"></div><div class="fi-actions"><button onclick="financeV312SavePurchase()">حفظ الفاتورة وزيادة المخزون</button><button class="light" onclick="financeV312ClearPurchase()">تفريغ</button></div></div></div><div class="fi-card"><h3>آخر فواتير الشراء</h3><div class="table-wrap"><table class="fi-table"><thead><tr><th>الفاتورة</th><th>المورد</th><th>التاريخ</th><th>الإجمالي</th><th>مركز التكلفة</th></tr></thead><tbody>${purchaseRows()}</tbody></table></div></div></div>`; hydrateSelects(); window.fiPurchaseLines=[]; renderPurchaseLines(); }
  function purchaseRows(){ return load(LS.purchases).slice(-30).reverse().map(p=>`<tr><td><b>${esc(p.invoice_no||p.id)}</b><br><small>${esc(p.file_name||'لا يوجد مرفق')}</small></td><td>${esc(supplierName(p.supplier_id))}</td><td>${esc(p.date)}</td><td>${money((p.lines||[]).reduce((s,l)=>s+num(l.total),0))}</td><td><span class="fi-badge">${esc(p.cost_type)}</span></td></tr>`).join('')||'<tr><td colspan="5">لا توجد فواتير</td></tr>'; }
  function renderPurchaseLines(){ const box=$('purchaseLines'); if(!box) return; box.innerHTML=(window.fiPurchaseLines||[]).map((l,i)=>`<div class="fi-line"><div><b>${esc(itemName(l.item_id))}</b></div><div>${esc(l.qty)}</div><div>${money(l.price)}</div><div>${money(l.total)}</div><button class="danger" onclick="financeV312RemovePurchaseLine(${i})">حذف</button></div>`).join('')||'<p class="fi-muted">لم تتم إضافة منتجات بعد.</p>'; }
  function renderMovements(){ $('fiBody_movements').innerHTML=`<div class="fi-grid two"><div class="fi-card"><h3>تسجيل حركة مخزون</h3><div class="fi-form"><div class="fi-grid two"><div><label>التاريخ</label><input type="date" id="moveDate" value="${today()}"></div><div><label>نوع الحركة</label><select id="moveType">${moveTypes.map(t=>`<option>${t}</option>`).join('')}</select></div></div><label>المشرف</label><select id="moveSupervisor"></select><label>المنتج</label><select id="moveItem"></select><div class="fi-grid two"><div><label>الكمية</label><input type="number" id="moveQty"></div><div><label>حالة الاعتماد</label><select id="moveStatus"><option>بانتظار</option><option>معتمد</option><option>مرفوض</option><option>تم الصرف</option></select></div></div><div class="fi-grid three"><div><label>مركز التكلفة</label><select id="moveCostType"><option>FM</option><option>CN</option><option>GENERAL</option></select></div><div><label>مشروع أو أكثر</label><select id="moveProjects" multiple size="3"></select></div><div><label>أوردر غير منفذ / رقم الأوردر</label><input id="moveOrderNo"></div></div><label>سبب الحركة</label><input id="moveReason"><label>ملاحظات</label><textarea id="moveNotes"></textarea><div class="fi-actions"><button onclick="financeV312SaveMovement()">حفظ الحركة</button></div></div></div><div class="fi-card"><h3>سجل حركة المخزون</h3><div class="fi-filter"><select id="moveFilterType" onchange="financeV312RenderMovements()"><option value="">كل الحركات</option>${moveTypes.map(t=>`<option>${t}</option>`).join('')}</select><select id="moveFilterStatus" onchange="financeV312RenderMovements()"><option value="">كل الحالات</option><option>بانتظار</option><option>معتمد</option><option>مرفوض</option><option>تم الصرف</option></select></div><div class="table-wrap"><table class="fi-table"><thead><tr><th>الحركة</th><th>المشرف</th><th>المنتج</th><th>الكمية</th><th>المشروع/الأوردر</th><th>الحالة</th></tr></thead><tbody>${movementRows()}</tbody></table></div></div></div>`; hydrateSelects(); }
  function movementRows(){ const type=$('moveFilterType')?.value||'', status=$('moveFilterStatus')?.value||''; return load(LS.moves).filter(m=>(!type||m.type===type)&&(!status||m.status===status)).slice(-60).reverse().map(m=>`<tr><td><b>${esc(m.type)}</b><br><small>${esc(m.date)}</small></td><td>${esc(m.supervisor_name||'-')}</td><td>${esc(itemName(m.item_id))}</td><td>${esc(m.qty)}</td><td>${(m.project_ids||[]).map(projectName).map(esc).join('، ')||'-'}<br><small>${esc(m.order_no||'')}</small></td><td><span class="fi-badge ${m.status==='مرفوض'?'danger':(m.status==='بانتظار'?'warn':'ok')}">${esc(m.status)}</span></td></tr>`).join('')||'<tr><td colspan="6">لا توجد حركات</td></tr>'; }
  function renderCosts(){ $('fiBody_costs').innerHTML=`<div class="fi-card fi-print-area"><h3>مركز التكلفة</h3><div class="fi-filter"><select id="costTypeFilter" onchange="financeV312RenderCosts()"><option value="">كل المراكز</option>${costTypes.map(t=>`<option>${t}</option>`).join('')}</select><select id="costProjectFilter" onchange="financeV312RenderCosts()"></select><input id="costOrderFilter" oninput="financeV312RenderCosts()" placeholder="رقم الأوردر"><input type="date" id="costFrom" onchange="financeV312RenderCosts()"><input type="date" id="costTo" onchange="financeV312RenderCosts()"><button class="light" onclick="window.print()">طباعة</button></div><div id="costSummary"></div><div class="table-wrap"><table class="fi-table"><thead><tr><th>التاريخ</th><th>المركز</th><th>المشروع/الأوردر</th><th>المصدر</th><th>الصنف</th><th>الكمية</th><th>التكلفة</th></tr></thead><tbody id="costRows"></tbody></table></div></div>`; hydrateSelects(); fillCostRows(); }
  function fillCostRows(){ const type=$('costTypeFilter')?.value||'', pid=$('costProjectFilter')?.value||'', ono=String($('costOrderFilter')?.value||'').toLowerCase(), from=$('costFrom')?.value||'', to=$('costTo')?.value||''; let rows=allCostRows().filter(r=>(!type||r.type===type)&&(!pid||(r.project_ids||[]).map(String).includes(String(pid)))&&(!ono||String(r.order_no||'').toLowerCase().includes(ono))&&(!from||String(r.date)>=from)&&(!to||String(r.date)<=to)); const total=rows.reduce((s,r)=>s+num(r.amount),0); if($('costSummary')) $('costSummary').innerHTML=`<div class="fi-kpis"><div class="fi-kpi"><small>عدد الحركات</small><b>${rows.length}</b></div><div class="fi-kpi"><small>إجمالي التكلفة</small><b>${money(total)}</b></div></div>`; if($('costRows')) $('costRows').innerHTML=rows.slice(0,200).map(r=>`<tr><td>${esc(r.date)}</td><td><span class="fi-badge">${esc(r.type)}</span></td><td>${(r.project_ids||[]).map(projectName).map(esc).join('، ')||'-'}<br><small>${esc(r.order_no||'')}</small></td><td>${esc(r.source)}<br><small>${esc(r.ref)}</small></td><td>${esc(itemName(r.item_id))}</td><td>${esc(r.qty)}</td><td><b>${money(r.amount)}</b></td></tr>`).join('')||'<tr><td colspan="7">لا توجد بيانات</td></tr>'; }
  function renderReports(){ const items=load(LS.items), moves=load(LS.moves), purchases=load(LS.purchases); const top=items.slice().sort((a,b)=>num(a.qty)-num(b.qty)).slice(0,20); $('fiBody_reports').innerHTML=`<div class="fi-grid two"><div class="fi-card"><h3>تقرير المخزون الحالي</h3><button class="light" onclick="financeV312ExportCsv('items')">تصدير CSV</button><div class="table-wrap"><table class="fi-table"><thead><tr><th>الصنف</th><th>الكود</th><th>الكمية</th><th>التنبيه</th></tr></thead><tbody>${top.map(i=>`<tr><td>${esc(i.name)}</td><td>${esc(i.code||'-')}</td><td>${esc(i.qty)} ${esc(i.unit||'')}</td><td><span class="fi-badge ${num(i.qty)<=num(i.min_qty)?'warn':'ok'}">${num(i.qty)<=num(i.min_qty)?'منخفض':'سليم'}</span></td></tr>`).join('')||'<tr><td colspan="4">لا توجد بيانات</td></tr>'}</tbody></table></div></div><div class="fi-card"><h3>ملخص مالي سريع</h3>${setKpis()}<div class="fi-note">عدد فواتير الشراء: ${purchases.length}<br>عدد حركات المخزون: ${moves.length}<br>يمكن طباعة مركز التكلفة من تبويب مركز التكلفة.</div></div></div>`; }
  function renderActive(){ if(active==='dashboard')renderDashboard(); if(active==='suppliers')renderSuppliers(); if(active==='items')renderItems(); if(active==='purchases')renderPurchases(); if(active==='movements')renderMovements(); if(active==='costs')renderCosts(); if(active==='reports')renderReports(); }
  window.financeV312Boot=function(){ ensureSection(); if(!loaded){loaded=true;} setTimeout(()=>{try{renderActive();}catch(e){console.error('finance v313 boot render',e);}},0); };
  window.financeV312Tab=function(tab,btn){ active=tab; document.querySelectorAll('.fi-tabs button').forEach(b=>b.classList.remove('active')); btn?.classList.add('active'); document.querySelectorAll('.fi-tab-body').forEach(b=>b.classList.remove('active')); $('fiBody_'+tab)?.classList.add('active'); renderActive(); };
  window.financeV312RenderAll=function(){ renderActive(); };
  window.financeV312RenderSuppliers=renderSuppliers; window.financeV312RenderItems=renderItems; window.financeV312RenderMovements=renderMovements; window.financeV312RenderCosts=function(){ fillCostRows(); };
  window.financeV312SaveSupplier=function(){ const arr=load(LS.suppliers); const id=$('supplierId')?.value||uid(); let s=arr.find(x=>x.id===id); if(!s){s={id};arr.push(s);} s.name=$('supplierName')?.value||''; if(!s.name) return alert('اكتب اسم المورد'); s.phone=$('supplierPhone')?.value||''; s.vat=$('supplierVat')?.value||''; s.type=$('supplierType')?.value||''; s.status=$('supplierStatus')?.value||'نشط'; s.notes=$('supplierNotes')?.value||''; save(LS.suppliers,arr); editSupplierId=''; renderSuppliers(); };
  window.financeV312EditSupplier=id=>{editSupplierId=id; renderSuppliers();}; window.financeV312ClearSupplier=()=>{editSupplierId=''; renderSuppliers();}; window.financeV312DeleteSupplier=id=>{ if(confirm('حذف المورد؟')){save(LS.suppliers,load(LS.suppliers).filter(x=>x.id!==id));renderSuppliers();}};
  window.financeV312SaveItem=function(){ const arr=load(LS.items); const id=$('itemId')?.value||uid(); let it=arr.find(x=>x.id===id); if(!it){it={id,qty:0};arr.push(it);} it.name=$('itemName')?.value||''; if(!it.name) return alert('اكتب اسم المنتج'); it.code=$('itemCode')?.value||''; it.company_code=$('itemCompanyCode')?.value||''; it.category=$('itemCategory')?.value||''; it.unit=$('itemUnit')?.value||''; it.price=num($('itemPrice')?.value); it.min_qty=num($('itemMinQty')?.value); it.supplier_id=$('itemSupplier')?.value||''; it.notes=$('itemNotes')?.value||''; save(LS.items,arr); editItemId=''; renderItems(); };
  window.financeV312EditItem=id=>{editItemId=id; renderItems();}; window.financeV312ClearItem=()=>{editItemId=''; renderItems();}; window.financeV312DeleteItem=id=>{ if(confirm('حذف المنتج؟')){save(LS.items,load(LS.items).filter(x=>x.id!==id));renderItems();}};
  window.financeV312AddPurchaseLine=function(){ const item_id=$('purchaseItemSelect')?.value, qty=num($('purchaseQty')?.value), price=num($('purchasePrice')?.value||itemCost(item_id)); if(!item_id||!qty) return alert('اختر المنتج والكمية'); window.fiPurchaseLines=window.fiPurchaseLines||[]; window.fiPurchaseLines.push({item_id,qty,price,total:qty*price}); $('purchaseQty').value=''; $('purchasePrice').value=''; renderPurchaseLines(); };
  window.financeV312RemovePurchaseLine=i=>{ window.fiPurchaseLines.splice(i,1); renderPurchaseLines(); };
  window.financeV312ClearPurchase=()=>renderPurchases();
  window.financeV312SavePurchase=function(){ const lines=window.fiPurchaseLines||[]; if(!lines.length) return alert('أضف منتجات للفاتورة'); const file=$('purchaseFile')?.files?.[0]; const p={id:uid(),invoice_no:$('purchaseInvoiceNo')?.value||'',date:$('purchaseDate')?.value||today(),supplier_id:$('purchaseSupplier')?.value||'',file_name:file?.name||'',cost_type:$('purchaseCostType')?.value||'GENERAL',project_ids:[...($('purchaseProjects')?.selectedOptions||[])].map(o=>o.value).filter(Boolean),order_no:$('purchaseOrderNo')?.value||'',notes:$('purchaseNotes')?.value||'',lines}; const arr=load(LS.purchases); arr.push(p); save(LS.purchases,arr); lines.forEach(l=>updateItemStock(l.item_id,num(l.qty))); alert('تم حفظ الفاتورة وتحديث المخزون'); renderPurchases(); };
  window.financeV312SaveMovement=function(){ const item_id=$('moveItem')?.value, qty=num($('moveQty')?.value); if(!item_id||!qty) return alert('اختر المنتج والكمية'); const supId=$('moveSupervisor')?.value||''; const sup=supervisors().find(s=>String(s.id)===String(supId)); const m={id:uid(),date:$('moveDate')?.value||today(),type:$('moveType')?.value||'',supervisor_id:supId,supervisor_name:sup?.full_name||sup?.username||'',item_id,qty,status:$('moveStatus')?.value||'بانتظار',cost_type:$('moveCostType')?.value||'GENERAL',project_ids:[...($('moveProjects')?.selectedOptions||[])].map(o=>o.value).filter(Boolean),order_no:$('moveOrderNo')?.value||'',reason:$('moveReason')?.value||'',notes:$('moveNotes')?.value||'',amount:qty*itemCost(item_id)}; const arr=load(LS.moves); arr.push(m); save(LS.moves,arr); if(m.status==='معتمد'||m.status==='تم الصرف'||m.type==='سكراب') updateItemStock(item_id,-qty); alert('تم حفظ حركة المخزون'); renderMovements(); };
  window.financeV312ExportCsv=function(type){ const rows=type==='items'?load(LS.items):allCostRows(); const csv=[Object.keys(rows[0]||{}).join(','),...rows.map(r=>Object.values(r).map(v=>`"${String(Array.isArray(v)?v.join('|'):v??'').replace(/"/g,'""')}"`).join(','))].join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'})); a.download='tasneef_'+type+'_v312.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); };
  const oldShow=window.showPage;
  window.showPage=function(id,btn){ const r=oldShow?oldShow.apply(this,arguments):undefined; if(id==='financeInventoryV312') setTimeout(()=>window.financeV312Boot(),30); return r; };
  function autoRenderWhenVisible(){
    const sec=$('financeInventoryV312');
    if(sec && !sec.classList.contains('hidden')) { try{renderActive();}catch(e){console.error('finance v313 visible render',e);} }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{ensureSection(); setTimeout(autoRenderWhenVisible,200);}); else { ensureSection(); setTimeout(autoRenderWhenVisible,200); }
  setInterval(autoRenderWhenVisible,1200);
})();


/* V314: عزل قسم المالية والمخزون عن التسجيلات اليومية وإجبار الرندر الآمن */
(function(){
  'use strict';
  if(window.__financeV314Isolation) return;
  window.__financeV314Isolation = true;
  const $ = id => document.getElementById(id);
  function showOnly(id){
    document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));
    const page=$(id); if(page) page.classList.remove('hidden');
  }
  function activateButton(btn){
    document.querySelectorAll('.nav').forEach(n=>n.classList.remove('active'));
    if(btn) btn.classList.add('active');
  }
  function renderPage(id){
    try{
      if(id==='dashboard'){ window.renderDashboard&&window.renderDashboard(); window.renderAlerts&&window.renderAlerts(); }
      if(id==='daily'){ window.renderTimeLogs&&window.renderTimeLogs(); }
      if(id==='users'){ window.renderUsers&&window.renderUsers(); }
      if(id==='projects'){ window.renderProjects&&window.renderProjects(); }
      if(id==='contracts'){
        window.renderContracts&&window.renderContracts();
        window.renderContractServices&&window.renderContractServices();
        window.showContractsSubTab&&window.showContractsSubTab('contracts');
      }
      if(id==='workers'){ window.renderWorkers&&window.renderWorkers(); }
      if(id==='attendance'){ window.renderAttendance&&window.renderAttendance(); }
      if(id==='monthly'){ window.renderMonthly&&window.renderMonthly(); }
      if(id==='tickets'){ window.renderTickets&&window.renderTickets(); }
      if(id==='orders'){ window.renderOrdersV233&&window.renderOrdersV233(); window.renderOrders&&window.renderOrders(); }
      if(id==='clientReports'){ window.renderPremiumReports&&window.renderPremiumReports(); }
      if(id==='clientRatings'){ window.renderClientRatings&&window.renderClientRatings(); }
      if(id==='alerts'){ window.renderAlerts&&window.renderAlerts(); }
    }catch(e){ console.warn('v314 renderPage',id,e); }
  }
  const previousShowPage = window.showPage;
  window.showPage = function(id, btn){
    if(id === 'financeInventoryV312'){
      try{ window.financeV312Boot && window.financeV312Boot(); }catch(e){ console.warn('finance boot before show',e); }
      showOnly('financeInventoryV312');
      activateButton(btn);
      setTimeout(()=>{ try{ window.financeV312Boot&&window.financeV312Boot(); window.financeV312RenderAll&&window.financeV312RenderAll(); }catch(e){ console.warn('finance render after show',e); } }, 50);
      return;
    }
    try{
      if(typeof previousShowPage === 'function') previousShowPage.apply(this, arguments);
    }catch(e){ console.warn('old showPage failed, v314 fallback',e); }
    showOnly(id);
    activateButton(btn);
    setTimeout(()=>renderPage(id), 30);
  };
  try{ showPage = window.showPage; }catch(_){ }

  // عند فتح التسجيلات اليومية، لا نسمح لقسم المالية أن يبقى ظاهرًا أو يؤثر على الجدول.
  document.addEventListener('click', function(e){
    const b=e.target && e.target.closest && e.target.closest('button.nav');
    if(!b) return;
    const oc=String(b.getAttribute('onclick')||'');
    if(oc.includes("showPage('daily") || oc.includes('showPage("daily')){
      setTimeout(()=>{ showOnly('daily'); renderPage('daily'); }, 80);
    }
  }, true);
  console.log('Tasneef v314 finance safe isolation loaded');
})();

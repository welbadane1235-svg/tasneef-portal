(function(){
  const VERSION = 'v15-finance-inventory-pro';
  const VAT_RATE = 0.15;
  const state = {
    loaded: false,
    tab: 'summary',
    items: [],
    movements: [],
    expenses: [],
    projects: [],
    users: [],
    tickets: [],
    invoiceLines: [],
    distribution: [],
    reportTab: 'products',
    suppliers: [],
    editMovementId: ''
  };

  const $ = (id)=>document.getElementById(id);
  const A = (v)=>Array.isArray(v) ? v : [];
  const S = (v)=>String(v ?? '').trim();
  const N = (v)=>Number(v || 0) || 0;
  const esc = (v)=>S(v).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  const today = ()=>new Date().toISOString().slice(0,10);
  const money = (v)=>`${N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س`;
  const itemCode = (i)=>S(i.product_code || i.serial_number || i.barcode || i.supplier_barcode || i.code || '');
  const itemCost = (i)=>N(i.unit_cost || i.cost || i.price || i.purchase_price);
  const currentUserV15 = ()=>{
    try{ return JSON.parse(localStorage.getItem('tasneef_user') || 'null') || {}; }
    catch(e){ return {}; }
  };
  const currentRoleV15 = ()=>S(currentUserV15().role);
  const isWarehouseOnlyV15 = ()=>currentRoleV15()==='warehouse_manager';
  const isAdminRoleV15 = ()=>{
    const u=currentUserV15();
    const r=currentRoleV15();
    return ['admin','general_manager','system_admin','مدير عام','مدير النظام'].includes(r) || S(u.username).toLowerCase()==='admin';
  };
  const canDeleteProductsV15 = ()=>isAdminRoleV15();
  const canEditInvoicesV15 = ()=>isAdminRoleV15();
  const canSeeFinancePricesV15 = ()=>!isWarehouseOnlyV15();
  function financeTabsV15(){
    const all = [
      ['summary','ملخص'],
      ['products','منتجات'],
      ['suppliers','الموردين'],
      ['add','العمليات'],
      ['movement','حركة المخزون'],
      ['cost','مركز تكلفة'],
      ['reports','تقارير']
    ];
    return isWarehouseOnlyV15() ? all.filter(t=>['products','movement','reports'].includes(t[0])) : all;
  }
  function ensureAllowedFinanceTabV15(){
    const ids=financeTabsV15().map(t=>t[0]);
    if(!ids.includes(state.tab)) state.tab=ids[0] || 'products';
  }
  const activeUsers = ()=>state.users.filter(u=>S(u.status || 'active') !== 'inactive');
  const supervisors = ()=>activeUsers().filter(u=>['supervisor','manager','operational_manager','مشرف','مدير تشغيلي','مدير عام'].includes(S(u.role)));
  const technicians = ()=>activeUsers().filter(u=>['technician','فني'].includes(S(u.role)));
  const staff = ()=>[...supervisors(), ...technicians()].filter((u,idx,arr)=>arr.findIndex(x=>String(x.id)===String(u.id))===idx);
  const projectName = (id)=>state.projects.find(p=>String(p.id)===String(id))?.name || state.projects.find(p=>String(p.id)===String(id))?.project_name || '';
  const staffName = (id)=>state.users.find(u=>String(u.id)===String(id))?.full_name || state.users.find(u=>String(u.id)===String(id))?.name || state.users.find(u=>String(u.id)===String(id))?.username || '';

  function vatFromNet(net){ const n=N(net); return {net:n, vat:n*VAT_RATE, gross:n*(1+VAT_RATE)}; }
  function rowVat(qty, price, mode='before'){
    const total=N(qty)*N(price);
    if(S(mode)==='after'){
      const net=total/(1+VAT_RATE);
      return {net, vat:total-net, gross:total};
    }
    if(S(mode)==='none') return {net:total, vat:0, gross:total};
    return vatFromNet(total);
  }
  function unitNetFromLine(line){
    const mode=S(line.tax_mode||'before');
    if(mode==='after') return N(line.price)/(1+VAT_RATE);
    return N(line.price);
  }
  function safeJson(value){
    const txt = S(value);
    if(!txt.startsWith('finance_pro_v15:')) return null;
    try{ return JSON.parse(txt.replace('finance_pro_v15:','')); }catch(e){ return null; }
  }
  function movementUnitCostV15(m){
    const meta=safeJson(m?.notes)||{};
    if(N(m?.unit_cost)>0) return N(m.unit_cost);
    if(N(meta.beforeVat)>0 && N(m?.quantity)>0) return N(meta.beforeVat)/N(m.quantity);
    const item=state.items.find(i=>String(i.id)===String(m?.item_id));
    return item ? itemCost(item) : 0;
  }
  function movementNetValueV15(m){
    const meta=safeJson(m?.notes)||{};
    if(N(meta.beforeVat)>0) return N(meta.beforeVat);
    return N(m?.quantity)*movementUnitCostV15(m);
  }
  function movementVatValueV15(m){
    const meta=safeJson(m?.notes)||{};
    if(N(meta.vat)>0) return N(meta.vat);
    return movementNetValueV15(m)*VAT_RATE;
  }
  function movementGrossValueV15(m){
    const meta=safeJson(m?.notes)||{};
    if(N(meta.afterVat)>0) return N(meta.afterVat);
    return movementNetValueV15(m)+movementVatValueV15(m);
  }
  function itemUnitCostV15(item){
    const direct=itemCost(item);
    if(direct>0) return direct;
    const code=itemCode(item);
    const moves=state.movements
      .filter(m=>S(m.movement_type)==='in' && (
        String(m.item_id)===String(item?.id) ||
        (code && [m.product_code,m.barcode].map(S).includes(code)) ||
        (!m.item_id && S(m.item_name)===S(item?.name))
      ))
      .sort((a,b)=>S(b.movement_date||b.created_at).localeCompare(S(a.movement_date||a.created_at)));
    return moves.length ? movementUnitCostV15(moves[0]) : 0;
  }
  function movementTypeLabelV15(type){
    const map={in:'داخل',out:'صرف',consume:'مستهلك',waste:'هدر',damaged:'تالف',return:'مرتجع'};
    map.scrap='سكراب';
    map.waste='مهدور';
    return map[S(type)] || S(type) || '-';
  }
  function cleanMovementNoteV15(m){
    const meta=safeJson(m?.notes)||{};
    const raw=S(m?.notes);
    if(S(meta.note)) return S(meta.note);
    if(raw && !raw.startsWith('finance_pro_v15:')) return raw;
    return '';
  }
  function movementStockDeltaV15(m){
    const meta=safeJson(m?.notes)||{};
    if(S(meta.stockEffect)==='none') return 0;
    const type=S(m?.movement_type);
    if(type==='in' || type==='return') return N(m?.quantity);
    if(['out','consume','waste','damaged','scrap'].includes(type)) return -N(m?.quantity);
    return 0;
  }
  function movementComputedDeltaV15(m){
    const meta=safeJson(m?.notes)||{};
    const returned=A(meta.distribution)
      .filter(d=>S(d.type)==='return' && S(m?.movement_type)!=='return')
      .reduce((a,d)=>a+N(d.qty),0);
    return movementStockDeltaV15(m)+returned;
  }
  function computedItemQtyV15(item){
    if(!item) return 0;
    const rows=productMovements(item).flatMap(m=>movementDistributionRowsV15(m));
    const distributionReturnToStock=rows
      .filter(m=>S(m.movement_type)==='return' && m.is_distribution_row && S(m.base_movement_type)!=='return')
      .reduce((a,m)=>a+N(m.quantity),0);
    return N(item.quantity)+distributionReturnToStock;
  }
  async function table(name, select='*', limit=3000){
    try{
      if(!window.sb) return [];
      const res = await sb.from(name).select(select).limit(limit);
      if(res.error) return [];
      return A(res.data);
    }catch(e){ return []; }
  }

  function localSuppliers(){
    try { return JSON.parse(localStorage.getItem('tasneef_finance_suppliers_v21') || '[]') || []; }
    catch(_) { return []; }
  }
  function saveLocalSuppliers(rows){
    localStorage.setItem('tasneef_finance_suppliers_v21', JSON.stringify([...new Set(A(rows).map(S).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'))));
  }

  function ensureStyle(){
    if($('financeInventoryProStyleV15')) return;
    const st=document.createElement('style');
    st.id='financeInventoryProStyleV15';
    st.textContent = `
      #financeDashboard.finance-pro{display:block}
      .fin-shell{display:grid;gap:14px}
      .fin-hero{background:linear-gradient(135deg,#073d31,#11634d);color:#fff;border-radius:22px;padding:20px 22px;display:flex;justify-content:space-between;gap:14px;align-items:center;box-shadow:0 16px 40px rgba(10,64,51,.14)}
      .fin-hero h2{margin:0;color:#fff;font-size:28px}.fin-hero p{margin:6px 0 0;color:#dff4ee;line-height:1.7}
      .fin-tabs{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.fin-tabs button{background:#eef7f3;color:#073d31;border:1px solid #cfe3db;border-radius:14px;padding:12px}.fin-tabs button.active{background:#073d31;color:#fff}
      .fin-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.fin-grid.three{grid-template-columns:repeat(3,1fr)}.fin-grid.two{grid-template-columns:repeat(2,1fr)}
      .fin-card{background:#fff;border:1px solid #d9e7e2;border-radius:18px;padding:16px;box-shadow:0 8px 24px rgba(10,64,51,.05)}
      .fin-card h3{margin:0 0 12px;color:#073d31}.fin-kpi small{color:#667c75}.fin-kpi b{display:block;margin-top:8px;color:#073d31;font-size:26px}
      .fin-actions{display:flex;gap:8px;align-items:end;flex-wrap:wrap}.fin-actions>*{min-width:130px}.fin-soft{background:#f4faf7;border:1px solid #d8ebe3;border-radius:14px;padding:12px}
      .fin-table{overflow:auto;border:1px solid #d9e7e2;border-radius:15px;background:#fff;max-height:58vh}.fin-table table{width:100%;border-collapse:collapse;font-size:13px}.fin-table th,.fin-table td{padding:10px;border-bottom:1px solid #edf2f0;text-align:right;white-space:nowrap}.fin-table th{position:sticky;top:0;background:#f8fbfa;color:#46645b;z-index:1}
      .fin-badge{display:inline-flex;border-radius:999px;padding:5px 10px;font-weight:800;font-size:12px;background:#e8f4ee;color:#087047}.fin-badge.warn{background:#fff4d9;color:#8a5b00}.fin-badge.bad{background:#fde8e8;color:#a92525}.fin-badge.neutral{background:#edf2f0;color:#53625e}
      .fin-line{display:grid;grid-template-columns:1.2fr 1fr .7fr .8fr .8fr auto;gap:8px;align-items:end;margin-bottom:8px}.fin-line.dist{grid-template-columns:.8fr 1fr 1fr .7fr 1.2fr auto}
      .fin-report-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}.fin-product-card{border:1px solid #d9e7e2;border-radius:16px;padding:14px;background:linear-gradient(180deg,#fff,#f8fbfa)}
      .fin-product-card h4{margin:0 0 7px;color:#073d31}.fin-meta{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}.fin-meta div{background:#f0f7f4;border:1px solid #ddebe6;border-radius:12px;padding:8px}.fin-meta small{display:block;color:#687b75}.fin-meta b{color:#073d31}
      .fin-thumb{width:74px;height:74px;border-radius:14px;border:1px solid #d9e7e2;background:#fff;object-fit:contain;padding:3px;float:left;margin-inline-start:10px}
      .fin-card-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.fin-card-actions button{padding:8px 11px;border-radius:11px}
      @media(max-width:1100px){.fin-tabs,.fin-grid,.fin-grid.three,.fin-grid.two{grid-template-columns:1fr 1fr}.fin-line,.fin-line.dist{grid-template-columns:1fr}.fin-hero{flex-direction:column;align-items:flex-start}}
      @media(max-width:700px){.fin-tabs,.fin-grid,.fin-grid.three,.fin-grid.two{grid-template-columns:1fr}}
    `;
    document.head.appendChild(st);
  }

  function ensureNav(){
    const side=document.querySelector('.side');
    if(!side || document.querySelector('.nav[data-finance-pro-v15]')) return;
    const btn=document.createElement('button');
    btn.className='nav';
    btn.dataset.financeProV15='1';
    btn.textContent='المالية والمخزون';
    btn.onclick=function(){ window.showPage('financeDashboard', btn); };
    const exportBtn=[...side.querySelectorAll('.nav')].find(b=>S(b.textContent).includes('التصدير') || S(b.getAttribute('onclick')).includes('export'));
    side.insertBefore(btn, exportBtn || side.querySelector('.danger'));
  }

  function ensurePage(){
    ensureStyle();
    ensureNav();
    removeLegacyFinanceShortcuts();
    let page=$('financeDashboard');
    if(page) return page;
    page=document.createElement('section');
    page.id='financeDashboard';
    page.className='page hidden finance-pro';
    const main=document.querySelector('main.content') || document.querySelector('.content') || document.body;
    main.appendChild(page);
    return page;
  }

  function removeLegacyFinanceShortcuts(){
    try{
      const blocked = ['الأصناف', 'الموردين', 'تعديل التكلفة', 'تقليل التكلفة', 'ط§ظ„ط£طµظ†ط§ظپ', 'ط§ظ„ظ…ظˆط±ط¯ظٹظ†', 'طھط¹ط¯ظٹظ„ ط§ظ„طھظƒظ„ظپط©'];
      document.querySelectorAll('button,a').forEach(el => {
        if(el.closest('.fin-shell')) return;
        const text = S(el.textContent).replace(/\s+/g, ' ');
        if(blocked.some(word => text === word || text.includes(word))){
          const wrap = el.closest('.actions,.filters,.finance-tabs,.smart-quick-v129,.card') || el;
          wrap.remove();
        }
      });
    }catch(e){}
  }

  function keepLegacyFinanceShortcutsHidden(){
    removeLegacyFinanceShortcuts();
    clearTimeout(window.__financeProHideLegacyTimerV15);
    window.__financeProHideLegacyTimerV15 = setTimeout(removeLegacyFinanceShortcuts, 250);
    clearTimeout(window.__financeProHideLegacyTimer2V15);
    window.__financeProHideLegacyTimer2V15 = setTimeout(removeLegacyFinanceShortcuts, 900);
  }

  function renderShell(){
    keepLegacyFinanceShortcutsHidden();
    ensureAllowedFinanceTabV15();
    const page=ensurePage();
    page.innerHTML = `
      <div class="fin-shell" dir="rtl">
        <div class="fin-hero">
          <div>
            <h2>المالية والمخزون</h2>
            <p>إدارة الفواتير والمنتجات والصرف ومركز التكلفة والتقارير بحساب قبل الضريبة والضريبة وبعد الضريبة.</p>
          </div>
          <div class="fin-actions"><button class="light" onclick="financeProLoadV15(true)">تحديث البيانات</button></div>
        </div>
        <div class="fin-tabs" id="finTabsV15">
          ${financeTabsV15().map(([id,label])=>`<button type="button" data-fin-tab-v15="${id}" class="${state.tab===id?'active':''}" onclick="return financeProTabV15('${id}')">${label}</button>`).join('')}
        </div>
        <div id="finBodyV15"></div>
      </div>`;
    renderBody();
  }

  async function loadAll(force){
    if(state.loaded && !force) return;
    const [items,movements,expenses,projects,users,tickets] = await Promise.all([
      table('inventory_items','*',5000),
      table('inventory_movements','*',5000),
      table('finance_expenses','*',5000),
      table('projects','*',5000),
      table('app_users','*',2000),
      table('tickets','*',3000)
    ]);
    state.items=items;
    state.movements=movements;
    state.expenses=expenses;
    state.projects=projects;
    state.users=users;
    state.tickets=tickets;
    state.suppliers=[...new Set([...localSuppliers(), ...supplierList()])].filter(Boolean).sort((a,b)=>a.localeCompare(b,'ar'));
    state.loaded=true;
  }

  function lowItems(){
    return state.items.filter(i=>{
      const qty=computedItemQtyV15(i);
      return qty>0 && qty<=N(i.min_quantity || i.reorder_level || 1);
    });
  }
  function stockValue(){
    return state.items.reduce((s,i)=>s + Math.max(0,computedItemQtyV15(i))*itemUnitCostV15(i),0);
  }
  function productType(i){
    const raw = S(i.item_type || i.type || i.category || '');
    const low = raw.toLowerCase();
    if(['tool','tools'].includes(low) || ['عدة','معدات','أداة'].includes(raw)) return 'عدة';
    if(['material','materials'].includes(low) || ['مادة','مواد'].includes(raw)) return 'مادة';
    return raw || 'غير';
  }
  function unitList(){
    return [...new Set(state.items.map(i=>S(i.unit)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  }
  function supplierList(){
    const set = new Set();
    state.suppliers.forEach(s=>{ if(S(s)) set.add(S(s)); });
    state.items.forEach(i=>{ if(S(i.supplier)) set.add(S(i.supplier)); });
    state.movements.forEach(m=>{
      const type=S(m.movement_type);
      if(type==='in' && S(m.receiver)) set.add(S(m.receiver));
    });
    state.expenses.forEach(e=>{ if(S(e.supplier)) set.add(S(e.supplier)); });
    return [...set].sort((a,b)=>a.localeCompare(b,'ar'));
  }
  function nextInternalCode(){
    let max=0;
    state.items.forEach(i=>{
      const m=S(itemCode(i)).match(/^PRD-(\d+)$/i);
      if(m) max=Math.max(max, Number(m[1])||0);
    });
    state.invoiceLines.forEach(l=>{
      const m=S(l.code).match(/^PRD-(\d+)$/i);
      if(m) max=Math.max(max, Number(m[1])||0);
    });
    return 'PRD-' + String(max+1).padStart(5,'0');
  }
  function movementsFinancial(){
    return state.movements.reduce((acc,m)=>{
      const type=S(m.movement_type);
      if(type==='return' || type==='out') return acc;
      const net=movementFinancialTypesV15().includes(type) ? movementReportNetV15(m) : movementNetValueV15(m);
      const vat=type==='in' ? movementVatValueV15(m) : net*VAT_RATE;
      acc.net += net; acc.vat += vat; acc.gross += net+vat;
      return acc;
    },{net:0,vat:0,gross:0});
  }

  function renderBody(){
    const body=$('finBodyV15'); if(!body) return;
    ensureAllowedFinanceTabV15();
    if(!state.loaded){ body.innerHTML='<div class="fin-card">جاري تحميل بيانات المالية والمخزون...</div>'; return; }
    const renderers={
      summary:renderSummary,
      products:renderProducts,
      suppliers:renderSuppliers,
      add:renderAddStock,
      movement:renderMovement,
      cost:renderCostCenter,
      reports:renderReports
    };
    const fn=renderers[state.tab] || renderSummary;
    try{
      return fn(body);
    }catch(e){
      console.warn('finance pro tab render failed', state.tab, e);
      body.innerHTML=`<div class="fin-card">
        <h3>تعذر فتح هذا التبويب</h3>
        <p class="fin-soft">حدث خطأ في هذا التبويب فقط، وتم منع انهيار قسم المالية. اضغط تحديث البيانات ثم افتح التبويب مرة أخرى.</p>
        <div class="fin-actions"><button type="button" onclick="financeProLoadV15(true)">تحديث البيانات</button><button type="button" class="light" onclick="financeProTabV15('summary')">العودة للملخص</button></div>
      </div>`;
    }
  }

  function renderSummary(body){
    const fin=movementsFinancial();
    const stockNet=stockValue();
    const stockVat=stockNet*VAT_RATE;
    const stockGross=stockNet*(1+VAT_RATE);
    body.innerHTML=`
      <div class="fin-grid">
        <div class="fin-card fin-kpi"><small>عدد المنتجات</small><b>${state.items.length}</b></div>
        <div class="fin-card fin-kpi"><small>السعر قبل الضريبة</small><b>${money(stockNet)}</b></div>
        <div class="fin-card fin-kpi"><small>الضريبة</small><b>${money(stockVat)}</b></div>
        <div class="fin-card fin-kpi"><small>السعر شامل الضريبة</small><b>${money(stockGross)}</b></div>
      </div>
      <div class="fin-card">
        <h3>الأصناف التي سوف تنتهي (${lowItems().length})</h3>
        <div class="fin-table"><table><thead><tr><th>المنتج</th><th>الكود</th><th>المتوفر</th><th>الحد الأدنى</th><th>التكلفة</th><th>الحالة</th></tr></thead><tbody>
          ${lowItems().map(i=>`<tr><td><b>${esc(i.name)}</b></td><td>${esc(itemCode(i)||'-')}</td><td>${N(computedItemQtyV15(i))}</td><td>${N(i.min_quantity || i.reorder_level || 1)}</td><td>${money(itemUnitCostV15(i))}</td><td><span class="fin-badge warn">قارب الانتهاء</span></td></tr>`).join('') || '<tr><td colspan="6">لا توجد أصناف قاربت الانتهاء</td></tr>'}
        </tbody></table></div>
      </div>
      <div class="fin-grid three">
        <div class="fin-card fin-kpi"><small>حركة المخزون قبل الضريبة</small><b>${money(fin.net)}</b></div>
        <div class="fin-card fin-kpi"><small>ضريبة حركة المخزون</small><b>${money(fin.vat)}</b></div>
        <div class="fin-card fin-kpi"><small>حركة المخزون بعد الضريبة</small><b>${money(fin.gross)}</b></div>
      </div>`;
  }

  function renderProducts(body){
    body.innerHTML=`
      <div class="fin-card">
        <div class="fin-actions">
          <div style="flex:1"><label>بحث</label><input id="finProductSearchV15" placeholder="ابحث باسم المنتج أو الكود" oninput="financeProRenderProductListV15()"></div>
          <div><label>الحالة</label><select id="finProductStatusV15" onchange="financeProRenderProductListV15()"><option value="">كل المنتجات</option><option value="available">متوفر</option><option value="low">قارب الانتهاء</option><option value="zero">رصيد صفر</option></select></div>
          <div><label>الوحدة</label><select id="finProductUnitV15" onchange="financeProRenderProductListV15()"><option value="">كل الوحدات</option>${unitList().map(u=>`<option>${esc(u)}</option>`).join('')}</select></div>
          <div><label>نوع المنتج</label><select id="finProductTypeV15" onchange="financeProRenderProductListV15()"><option value="">الكل</option><option value="عدة">عدة</option><option value="مادة">مادة</option><option value="غير">غير</option></select></div>
        </div>
        <div id="finProductListV15"></div>
      </div>`;
    renderProductList();
  }

  function renderProductList(){
    const box=$('finProductListV15'); if(!box) return;
    const q=S($('finProductSearchV15')?.value).toLowerCase();
    const st=S($('finProductStatusV15')?.value);
    const unit=S($('finProductUnitV15')?.value);
    const type=S($('finProductTypeV15')?.value);
    let rows=state.items.filter(i=>{
      const hay=[i.name,itemCode(i),i.category,i.supplier].map(S).join(' ').toLowerCase();
      const qty=computedItemQtyV15(i);
      if(q && !hay.includes(q)) return false;
      if(st==='available' && qty<=N(i.min_quantity || i.reorder_level || 1)) return false;
      if(st==='low' && !(qty>0 && qty<=N(i.min_quantity || i.reorder_level || 1))) return false;
      if(st==='zero' && qty!==0) return false;
      if(unit && S(i.unit)!==unit) return false;
      if(type && productType(i)!==type) return false;
      return true;
    });
    box.innerHTML=`<div class="fin-report-cards">${rows.map(i=>{
      const qty=computedItemQtyV15(i);
      const low=qty>0 && qty<=N(i.min_quantity || i.reorder_level || 1);
      const zero=qty===0;
      return `<div class="fin-product-card">
        ${i.image_url ? `<img class="fin-thumb" src="${esc(i.image_url)}" alt="">` : ''}
        <h4>${esc(i.name || '-')}</h4>
        <span class="fin-badge ${zero?'bad':low?'warn':''}">${zero?'رصيد صفر':low?'قارب الانتهاء':'متوفر'}</span>
        <div class="fin-meta">
          <div><small>الكود</small><b>${esc(itemCode(i)||'-')}</b></div>
          <div><small>الوحدة</small><b>${esc(i.unit||'-')}</b></div>
          <div><small>النوع</small><b>${esc(productType(i))}</b></div>
          <div><small>الكمية</small><b>${N(qty)}</b></div>
          <div><small>سعر قبل الضريبة</small><b>${money(itemCost(i))}</b></div>
          <div><small>الضريبة للوحدة</small><b>${money(itemCost(i)*VAT_RATE)}</b></div>
          <div><small>بعد الضريبة للوحدة</small><b>${money(itemCost(i)*(1+VAT_RATE))}</b></div>
        </div>
        <div class="fin-card-actions"><button class="light" onclick="financeProShowProductV15('${esc(i.id)}')">عرض البيانات</button>${canDeleteProductsV15()?`<button class="danger" onclick="financeProDeleteProductV15('${esc(i.id)}')">حذف</button>`:''}</div>
      </div>`;
    }).join('') || '<div class="fin-soft">لا توجد منتجات حسب الفلتر.</div>'}</div>`;
  }

  function renderSuppliers(body){
    const suppliers=supplierList();
    body.innerHTML=`
      <div class="fin-card">
        <h3>الموردين</h3>
        <div class="fin-grid three">
          <div><label>اسم المورد</label><input id="finSupplierNameV15" placeholder="اسم المورد"></div>
          <div><label>رقم الجوال</label><input id="finSupplierPhoneV15" placeholder="05xxxxxxxx"></div>
          <div><label>ملاحظة</label><input id="finSupplierNoteV15" placeholder="ملاحظة اختيارية"></div>
        </div>
        <div class="fin-actions"><button onclick="financeProAddSupplierV15()">إضافة المورد</button></div>
        <div class="fin-actions">
          <div style="flex:1"><label>بحث</label><input id="finSupplierSearchV15" placeholder="ابحث باسم المورد" oninput="financeProRenderSuppliersV15()"></div>
        </div>
        <div id="finSuppliersListV15"></div>
      </div>`;
    renderSuppliersList();
  }

  function renderSuppliersList(){
    const box=$('finSuppliersListV15'); if(!box) return;
    const q=S($('finSupplierSearchV15')?.value).toLowerCase();
    const suppliers=supplierList().filter(s=>!q || s.toLowerCase().includes(q));
    box.innerHTML=`<div class="fin-table"><table><thead><tr><th>المورد</th><th>عدد المنتجات</th><th>عدد العمليات</th><th>آخر تعامل</th><th>السعر قبل الضريبة</th><th>الضريبة</th><th>السعر شامل الضريبة</th><th>إجراء</th></tr></thead><tbody>
      ${suppliers.map(s=>{
        const items=state.items.filter(i=>S(i.supplier)===s);
        const moves=state.movements.filter(m=>S(m.receiver)===s && S(m.movement_type)==='in');
        const net=moves.reduce((a,m)=>a+movementNetValueV15(m),0);
        const vat=moves.reduce((a,m)=>a+movementVatValueV15(m),0);
        const gross=moves.reduce((a,m)=>a+movementGrossValueV15(m),0);
        const last=moves.map(m=>S(m.movement_date||m.created_at).slice(0,10)).sort().pop() || '-';
        const key=encodeURIComponent(s);
        return `<tr><td><b>${esc(s)}</b></td><td>${items.length}</td><td>${moves.length}</td><td>${esc(last)}</td><td>${money(net)}</td><td>${money(vat)}</td><td>${money(gross)}</td><td class="fin-actions"><button class="light" onclick="financeProShowSupplierV15(decodeURIComponent('${key}'))">عرض</button><button class="danger" onclick="financeProDeleteSupplierV15(decodeURIComponent('${key}'))">حذف</button></td></tr>`;
      }).join('') || '<tr><td colspan="8">لا توجد موردين حتى الآن</td></tr>'}
    </tbody></table></div>`;
  }

  window.financeProAddSupplierV15 = function(){
    const name=S($('finSupplierNameV15')?.value);
    if(!name) return alert('اسم المورد مطلوب');
    const suppliers=[...new Set([...state.suppliers, ...localSuppliers(), name])].filter(Boolean);
    state.suppliers=suppliers.sort((a,b)=>a.localeCompare(b,'ar'));
    saveLocalSuppliers(state.suppliers);
    ['finSupplierNameV15','finSupplierPhoneV15','finSupplierNoteV15'].forEach(id=>{ if($(id)) $(id).value=''; });
    renderSuppliersList();
    if(typeof msg==='function') msg('تمت إضافة المورد وسيظهر في قائمة الفاتورة');
  };

  function invoicesFromMovements(){
    const map=new Map();
    state.movements.filter(m=>S(m.movement_type)==='in').forEach(m=>{
      const meta=safeJson(m.notes)||{};
      const invoiceNo=S(meta.invoiceNo) || (S(m.reason).match(/فاتورة\s+(.+)$/)||[])[1] || 'بدون رقم';
      const key=invoiceNo;
      if(!map.has(key)) map.set(key,{invoiceNo, supplier:S(meta.supplier||m.receiver||''), date:movementDate(m), lines:[], net:0, vat:0, gross:0});
      const inv=map.get(key);
      inv.lines.push(m);
      inv.net += N(meta.beforeVat) || (N(m.quantity)*N(m.unit_cost));
      inv.vat += N(meta.vat);
      inv.gross += N(meta.afterVat) || ((N(meta.beforeVat) || (N(m.quantity)*N(m.unit_cost))) + N(meta.vat));
      if(!inv.supplier) inv.supplier=S(m.receiver||'');
      if(!inv.date) inv.date=movementDate(m);
    });
    return [...map.values()].sort((a,b)=>S(b.date).localeCompare(S(a.date)));
  }
  function renderInvoicesList(){
    const box=$('finInvoicesListV15'); if(!box) return;
    const rows=invoicesFromMovements();
    box.innerHTML=`<div class="fin-card"><h3>الفواتير المسجلة</h3><div class="fin-table"><table><thead><tr><th>رقم الفاتورة</th><th>المورد</th><th>التاريخ</th><th>عدد المنتجات</th><th>قبل الضريبة</th><th>بعد الضريبة</th><th>إجراء</th></tr></thead><tbody>${rows.map(inv=>`<tr><td><b>${esc(inv.invoiceNo)}</b></td><td>${esc(inv.supplier||'-')}</td><td>${esc(inv.date||'-')}</td><td>${inv.lines.length}</td><td>${money(inv.net)}</td><td>${money(inv.gross||inv.net)}</td><td class="fin-actions"><button class="light" onclick="financeProShowInvoiceV15('${encodeURIComponent(inv.invoiceNo)}')">عرض</button>${canEditInvoicesV15()?`<button onclick="financeProEditInvoiceV15('${encodeURIComponent(inv.invoiceNo)}')">تعديل</button>`:''}</td></tr>`).join('') || '<tr><td colspan="7">لا توجد فواتير مخزون مسجلة</td></tr>'}</tbody></table></div></div>`;
  }

  function renderAddStock(body){
    body.innerHTML=`
      <div class="fin-card">
        <h3>فاتورة عمليات المخزون</h3>
        <div class="fin-grid three">
          <div><label>المورد</label><select id="finInvSupplierV15"><option value="">اختر المورد</option>${supplierList().map(s=>`<option>${esc(s)}</option>`).join('')}</select></div>
          <div><label>رقم الفاتورة</label><input id="finInvNoV15" placeholder="INV-001"></div>
          <div><label>تاريخ الفاتورة</label><input id="finInvDateV15" type="date" value="${today()}"></div>
        </div>
        <div class="fin-line">
          <div><label>منتج موجود</label><select id="finExistingProductV15" onchange="financeProFillExistingProductV15(this.value)"><option value="">منتج جديد</option>${state.items.map(i=>`<option value="${esc(i.id)}">${esc(i.name)} - ${esc(itemCode(i)||'-')}</option>`).join('')}</select></div>
          <div><label>اسم المنتج</label><input id="finLineNameV15" placeholder="اسم المنتج"></div>
          <div><label>الكود الداخلي</label><input id="finLineCodeV15" value="${esc(nextInternalCode())}" readonly></div>
          <div><label>كود الموزع</label><input id="finLineDistributorCodeV15" placeholder="اكتب كود الموزع"></div>
          <div><label>الكمية</label><input id="finLineQtyV15" type="number" min="0" step="0.01"></div>
          <div><label>السعر</label><input id="finLinePriceV15" type="number" min="0" step="0.01"></div>
          <div><label>طريقة الضريبة</label><select id="finLineTaxModeV15"><option value="before">قبل الضريبة</option><option value="after">بعد الضريبة</option><option value="none">بدون ضريبة</option></select></div>
          <div><label>الوحدة</label><select id="finLineUnitV15"><option>حبة</option><option>كرتون</option><option>علبة</option><option>لتر</option><option>كيلو</option><option>متر</option><option>رول</option><option>طقم</option><option>غير</option></select></div>
          <div><label>حد النفاد</label><input id="finLineMinQtyV15" type="number" min="0" step="0.01" placeholder="مثال 2"></div>
          <div><label>رقم فاتورة المورد</label><input id="finLineSupplierInvoiceV15" placeholder="اختياري"></div>
          <button onclick="financeProAddInvoiceLineV15()">إضافة</button>
        </div>
        <div class="fin-grid three">
          <div><label>نوع المنتج</label><select id="finLineTypeV15"><option value="مادة">مادة</option><option value="عدة">عدة</option><option value="غير">غير</option></select></div>
          <div><label>صورة المنتج</label><input id="finLineImageV15" type="file" accept="image/*" onchange="financeProReadLineImageV15(this)"></div>
          <div class="fin-soft" id="finLineImageNameV15">لم يتم اختيار صورة</div>
        </div>
        <div id="finInvoiceLinesV15"></div>
        <div class="fin-actions"><button onclick="financeProSaveInvoiceV15(this)">حفظ الفاتورة وتحديث المخزون</button><button class="light" onclick="financeProClearInvoiceV15()">تفريغ</button></div>
      </div><div id="finInvoicesListV15"></div>`;
    renderInvoiceLines();
    renderInvoicesList();
  }

  function renderInvoiceLines(){
    const box=$('finInvoiceLinesV15'); if(!box) return;
    const total=state.invoiceLines.reduce((a,l)=>{ const c=rowVat(l.qty,l.price,l.tax_mode); a.net+=c.net; a.vat+=c.vat; a.gross+=c.gross; return a; },{net:0,vat:0,gross:0});
    box.innerHTML=`
      <div class="fin-table"><table><thead><tr><th>المنتج</th><th>الكود الداخلي</th><th>كود الموزع</th><th>رقم فاتورة المورد</th><th>النوع</th><th>الكمية</th><th>حد النفاد</th><th>الوحدة</th><th>طريقة الضريبة</th><th>قبل الضريبة</th><th>الضريبة</th><th>بعد الضريبة</th><th>إجراء</th></tr></thead><tbody>
      ${state.invoiceLines.map((l,idx)=>{ const c=rowVat(l.qty,l.price,l.tax_mode); const modeLabel={before:'قبل الضريبة',after:'بعد الضريبة',none:'بدون ضريبة'}[S(l.tax_mode||'before')]||'قبل الضريبة'; return `<tr><td>${l.image?`<img src="${esc(l.image)}" style="width:34px;height:34px;object-fit:contain;border-radius:8px;border:1px solid #d9e7e2;background:#fff;margin-left:6px">`:''}${esc(l.name)}</td><td>${esc(l.code)}</td><td>${esc(l.distributor_code||'-')}</td><td>${esc(l.supplier_invoice_no||'-')}</td><td>${esc(l.item_type||'مادة')}</td><td>${N(l.qty)}</td><td>${N(l.min_quantity||1)}</td><td>${esc(l.unit||'حبة')}</td><td>${esc(modeLabel)}</td><td>${money(c.net)}</td><td>${money(c.vat)}</td><td>${money(c.gross)}</td><td><button class="danger" onclick="financeProRemoveInvoiceLineV15(${idx})">حذف</button></td></tr>`; }).join('') || '<tr><td colspan="13">أضف منتجات الفاتورة هنا.</td></tr>'}
      </tbody></table></div>
      <div class="fin-grid three" style="margin-top:10px"><div class="fin-soft">قبل الضريبة: <b>${money(total.net)}</b></div><div class="fin-soft">الضريبة: <b>${money(total.vat)}</b></div><div class="fin-soft">بعد الضريبة: <b>${money(total.gross)}</b></div></div>`;
  }

  function renderMovement(body){
    const selectedMovementType=S($('finMovementListTypeV15')?.value);
    const editMove=state.editMovementId ? state.movements.find(m=>String(m.id)===String(state.editMovementId)) : null;
    const movementItems=state.items.filter(i=>computedItemQtyV15(i)>0 || isWarehouseOnlyV15() || (editMove && String(i.id)===String(editMove.item_id)));
    const movementRows=state.movements
      .filter(m=>!selectedMovementType || S(m.movement_type)===selectedMovementType)
      .slice()
      .reverse()
      .slice(0,80);
    body.innerHTML=`
      <div class="fin-card">
        <h3>صرف منتج وتوزيع استهلاكه</h3>
        <div class="fin-grid three">
          <div><label>المنتج</label><select id="finMoveItemV15">${movementItems.map(i=>`<option value="${esc(i.id)}">${esc(i.name)} - المتوفر ${N(computedItemQtyV15(i))}</option>`).join('')}</select></div>
          <div><label>نوع الحركة المطلوبة</label><select id="finMoveTypeV15"><option value="out">صرف</option><option value="consume">مستهلك</option><option value="waste">مهدور</option><option value="damaged">تالف</option><option value="scrap">سكراب</option><option value="return">مرتجع</option></select></div>
          <div><label>المستلم</label><select id="finMoveStaffV15">${staff().map(u=>`<option value="${esc(u.id)}">${esc(u.full_name||u.name||u.username)} - ${esc(u.role||'')}</option>`).join('')}</select></div>
          <div><label>الكمية</label><input id="finMoveQtyV15" type="number" min="0" step="0.01"></div>
          <div><label>التاريخ</label><input id="finMoveDateV15" type="date" value="${today()}"></div>
          <div><label>ملاحظة</label><input id="finMoveNoteV15" placeholder="ملاحظة الحركة"></div>
        </div>
        <h3 style="margin-top:16px">توزيع الاستهلاك على المشاريع / الأوردرات</h3>
        <div class="fin-line dist">
          <div><label>مركز التكلفة</label><select id="finDistCenterV15"><option value="FM">FM - مشاريع وأوردرات</option><option value="CN">CN - أوردرات</option><option value="GENERAL">GENERAL - إداري</option></select></div>
          <div><label>نوع التوزيع</label><select id="finDistTypeV15"><option value="out">صرف</option><option value="consume">مستهلك</option><option value="waste">مهدور</option><option value="damaged">تالف</option><option value="scrap">سكراب</option><option value="return">مرتجع</option></select></div>
          <div><label>المشروع</label><select id="finDistProjectV15"><option value="">بدون مشروع</option>${state.projects.map(p=>`<option value="${esc(p.id)}">${esc(p.name||p.project_name)}</option>`).join('')}</select></div>
          <div><label>رقم الأوردر</label><input id="finDistOrderV15" placeholder="اختياري"></div>
          <div><label>الكمية</label><input id="finDistQtyV15" type="number" min="0" step="0.01"></div>
          <div><label>ملاحظة</label><input id="finDistNoteV15" placeholder="ملاحظة"></div>
          <button onclick="financeProAddDistributionV15()">إضافة توزيع</button>
        </div>
        <div id="finDistributionBoxV15"></div>
        <div class="fin-actions"><button onclick="financeProSaveMovementV15(this)" id="finMoveSaveBtnV15">حفظ الحركة</button><button class="light" onclick="financeProClearMovementEditV15()">حركة جديدة</button><button class="light" onclick="financeProClearDistributionV15()">تفريغ التوزيع</button></div>
      </div>
      <div class="fin-card">
        <div class="fin-actions" style="justify-content:space-between">
          <h3>حركات المخزون</h3>
          <div><label>فلتر نوع الحركة</label><select id="finMovementListTypeV15" onchange="financeProRenderCurrentV15()"><option value="">كل الحركات</option><option value="out" ${selectedMovementType==='out'?'selected':''}>صرف</option><option value="consume" ${selectedMovementType==='consume'?'selected':''}>مستهلك</option><option value="waste" ${selectedMovementType==='waste'?'selected':''}>مهدور</option><option value="damaged" ${selectedMovementType==='damaged'?'selected':''}>تالف</option><option value="scrap" ${selectedMovementType==='scrap'?'selected':''}>سكراب</option><option value="return" ${selectedMovementType==='return'?'selected':''}>مرتجع</option><option value="in" ${selectedMovementType==='in'?'selected':''}>داخل</option></select></div>
        </div>
        <div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>المنتج</th><th>الكمية</th><th>المستلم</th><th>مركز التكلفة</th><th>إجراء</th></tr></thead><tbody>
        ${movementRows.map(m=>{ const meta=safeJson(m.notes)||{}; return `<tr><td>${esc(m.movement_date||'')}</td><td>${esc(movementTypeLabelV15(m.movement_type))}</td><td>${esc(m.item_name||'')}</td><td>${N(m.quantity)}</td><td>${esc(m.receiver||'')}</td><td>${esc(A(meta.distribution).map(d=>d.center).filter(Boolean).join(', ')||'-')}</td><td class="fin-actions"><button onclick="financeProEditMovementV15(${Number(m.id)||0})">تعديل</button><button class="light" onclick="financeProShowMovementV15(${Number(m.id)||0})">عرض</button><button class="danger" onclick="financeProDeleteMovementV15(${Number(m.id)||0})">حذف</button></td></tr>`; }).join('') || '<tr><td colspan="7">لا توجد حركات حسب الفلتر</td></tr>'}
        </tbody></table></div>
      </div>`;
    renderDistribution();
  }

  function renderDistribution(){
    const box=$('finDistributionBoxV15'); if(!box) return;
    const total=state.distribution.reduce((s,d)=>s+N(d.qty),0);
    const centerOptions = value => ['FM','CN','GENERAL'].map(v=>`<option value="${v}" ${S(value)===v?'selected':''}>${v}</option>`).join('');
    const typeOptions = value => [
      ['out','صرف'],
      ['consume','مستهلك'],
      ['waste','مهدور'],
      ['damaged','تالف'],
      ['scrap','سكراب'],
      ['return','مرتجع']
    ].map(([v,label])=>`<option value="${v}" ${S(value||'out')===v?'selected':''}>${label}</option>`).join('');
    const projectOptions = value => `<option value="">بدون مشروع</option>${state.projects.map(p=>`<option value="${esc(p.id)}" ${S(value)===S(p.id)?'selected':''}>${esc(p.name||p.project_name)}</option>`).join('')}`;
    box.innerHTML=`<div class="fin-table"><table><thead><tr><th>مركز التكلفة</th><th>نوع التوزيع</th><th>المشروع</th><th>الأوردر</th><th>الكمية</th><th>ملاحظة</th><th>ربط الأوردر</th><th>إجراء</th></tr></thead><tbody>
      ${state.distribution.map((d,idx)=>`<tr>
        <td><select onchange="financeProUpdateDistributionV15(${idx},'center',this.value)">${centerOptions(d.center)}</select></td>
        <td><select onchange="financeProUpdateDistributionV15(${idx},'type',this.value)">${typeOptions(d.type||'out')}</select></td>
        <td><select onchange="financeProUpdateDistributionV15(${idx},'projectId',this.value)">${projectOptions(d.projectId)}</select></td>
        <td><input value="${esc(d.orderNo||'')}" placeholder="اختياري" oninput="financeProUpdateDistributionV15(${idx},'orderNo',this.value)"></td>
        <td><input type="number" min="0" step="0.01" value="${N(d.qty)}" oninput="financeProUpdateDistributionV15(${idx},'qty',this.value)"></td>
        <td><input value="${esc(d.note||'')}" placeholder="ملاحظة" oninput="financeProUpdateDistributionV15(${idx},'note',this.value)"></td>
        <td>${d.orderConfirmed ? `<span class="fin-badge ok">مؤكد</span><br><small>${money(d.orderInventoryCost)}</small>` : '<span class="fin-badge">غير مربوط</span>'}</td>
        <td><button class="danger" onclick="financeProRemoveDistributionV15(${idx})">حذف</button></td>
      </tr>`).join('') || '<tr><td colspan="8">يمكنك توزيع الكمية المصروفة على أكثر من مشروع أو أوردر.</td></tr>'}
    </tbody></table></div><div class="fin-soft" style="margin-top:8px">إجمالي التوزيع: <b>${N(total)}</b></div>`;
  }

  function renderCostCenter(body){
    body.innerHTML=`
      <div class="fin-grid three">
        <div class="fin-card"><h3>FM</h3><p>للمشاريع والأوردرات المرتبطة بالتشغيل والصيانة.</p></div>
        <div class="fin-card"><h3>CN</h3><p>للأوردرات فقط، مثل أوامر خارجية أو أعمال مخصصة.</p></div>
        <div class="fin-card"><h3>GENERAL</h3><p>للمصروفات الإدارية ويجب كتابة الملاحظة بوضوح.</p></div>
      </div>
      <div class="fin-card">
        <h3>تسجيل مصروف مركز تكلفة</h3>
        <div class="fin-grid three">
          <div><label>مركز التكلفة</label><select id="finCostCenterV15"><option value="FM">FM</option><option value="CN">CN</option><option value="GENERAL">GENERAL</option></select></div>
          <div><label>المشروع</label><select id="finCostProjectV15"><option value="">بدون مشروع</option>${state.projects.map(p=>`<option value="${esc(p.id)}">${esc(p.name||p.project_name)}</option>`).join('')}</select></div>
          <div><label>رقم الأوردر</label><input id="finCostOrderV15" placeholder="اختياري"></div>
          <div><label>الوصف</label><input id="finCostDescV15" placeholder="وصف المصروف"></div>
          <div><label>قبل الضريبة</label><input id="finCostNetV15" type="number" min="0" step="0.01" oninput="financeProCalcExpenseV15()"></div>
          <div><label>الضريبة</label><input id="finCostVatV15" readonly></div>
          <div><label>بعد الضريبة</label><input id="finCostGrossV15" readonly></div>
          <div><label>التاريخ</label><input id="finCostDateV15" type="date" value="${today()}"></div>
          <div><label>ملاحظة</label><input id="finCostNoteV15" placeholder="ملاحظة، خصوصا GENERAL"></div>
        </div>
        <div class="fin-actions"><button onclick="financeProSaveExpenseV15(this)">حفظ المصروف</button></div>
      </div>
      <div class="fin-card"><h3>آخر المصروفات</h3><div class="fin-table"><table><thead><tr><th>التاريخ</th><th>المركز</th><th>الوصف</th><th>المشروع</th><th>قبل الضريبة</th><th>الضريبة</th><th>بعد الضريبة</th><th>إجراء</th></tr></thead><tbody>
      ${state.expenses.slice().reverse().slice(0,80).map(e=>`<tr><td>${esc(e.expense_date||e.date||'')}</td><td>${esc(e.category||e.cost_center||'')}</td><td>${esc(e.description||e.supplier||'-')}</td><td>${esc(e.project_name||'')}</td><td>${money(e.subtotal||e.before_vat||e.amount)}</td><td>${money(e.vat||e.tax)}</td><td>${money(e.total||e.after_vat||e.amount)}</td><td class="fin-actions"><button class="light" onclick="financeProShowExpenseV15(${Number(e.id)||0})">عرض</button><button class="danger" onclick="financeProDeleteExpenseV15(${Number(e.id)||0})">حذف</button></td></tr>`).join('') || '<tr><td colspan="8">لا توجد مصروفات</td></tr>'}
      </tbody></table></div></div>`;
    calcExpense();
  }

  function renderReports(body){
    const products=reportProducts();
    const moves=reportMovements();
    const inventory=reportInventory();
    const costs=reportCostRows();
    const totals=reportTotalsForTab(state.reportTab);
    body.innerHTML=`
      <div class="fin-card">
        <h3>التقارير</h3>
        <div class="fin-tabs" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">
          ${[
            ['products','تقرير المنتجات'],
            ['movement','حركة المخزون'],
            ['inventory','جرد المخزن'],
            ['cost','مراكز التكلفة']
          ].map(([id,label])=>`<button class="${state.reportTab===id?'active':''}" onclick="financeProReportTabV15('${id}')">${label}</button>`).join('')}
        </div>
        <div class="fin-actions">
          <div style="flex:1"><label>بحث</label><input id="finReportSearchV15" value="${esc(S($('finReportSearchV15')?.value))}" placeholder="بحث حسب المنتج أو الكود أو المستلم" oninput="financeProRenderReportsV15()"></div>
          <div><label>من تاريخ</label><input id="finReportFromV15" type="date" value="${esc(S($('finReportFromV15')?.value))}" onchange="financeProRenderReportsV15()"></div>
          <div><label>إلى تاريخ</label><input id="finReportToV15" type="date" value="${esc(S($('finReportToV15')?.value))}" onchange="financeProRenderReportsV15()"></div>
          <div><label>مركز التكلفة</label><select id="finReportCenterV15" onchange="financeProRenderReportsV15()"><option value="">الكل</option>${['FM','CN','GENERAL'].map(c=>`<option value="${c}" ${S($('finReportCenterV15')?.value)===c?'selected':''}>${c}</option>`).join('')}</select></div>
          <div><label>النوع</label><select id="finReportTypeV15" onchange="financeProRenderReportsV15()"><option value="">الكل</option><option value="in" ${S($('finReportTypeV15')?.value)==='in'?'selected':''}>داخل</option><option value="out" ${S($('finReportTypeV15')?.value)==='out'?'selected':''}>خارج</option></select></div>
          <div><label>المشرف</label><select id="finReportSupervisorV15" onchange="financeProRenderReportsV15()"><option value="">كل المشرفين</option>${supervisors().map(u=>`<option value="${esc(u.id)}" ${S($('finReportSupervisorV15')?.value)===S(u.id)?'selected':''}>${esc(u.full_name||u.name||u.username)}</option>`).join('')}</select></div>
          <div><label>المشروع</label><select id="finReportProjectV15" onchange="financeProRenderReportsV15()"><option value="">كل المشاريع</option>${state.projects.map(p=>`<option value="${esc(p.id)}" ${S($('finReportProjectV15')?.value)===S(p.id)?'selected':''}>${esc(p.name||p.project_name)}</option>`).join('')}</select></div>
          <div><label>المنتج</label><select id="finReportProductV15" onchange="financeProRenderReportsV15()"><option value="">كل المنتجات</option>${state.items.map(i=>`<option value="${esc(i.id)}" ${S($('finReportProductV15')?.value)===S(i.id)?'selected':''}>${esc(i.name||itemCode(i))}</option>`).join('')}</select></div>
          <button class="light" onclick="financeProPrintReportV15()">طباعة</button>
        </div>
        <div id="finReportWindowV15">${reportWindowHtml()}</div>
        <div class="fin-grid three" style="margin-top:12px">
          <div class="fin-card fin-kpi"><small>الإجمالي قبل الضريبة</small><b>${money(totals.net)}</b></div>
          <div class="fin-card fin-kpi"><small>الضريبة 15%</small><b>${money(totals.vat)}</b></div>
          <div class="fin-card fin-kpi"><small>الإجمالي بعد الضريبة</small><b>${money(totals.gross)}</b></div>
        </div>
      </div>`;
  }

  function reportFilters(){
    return {
      q:S($('finReportSearchV15')?.value).toLowerCase(),
      from:S($('finReportFromV15')?.value),
      to:S($('finReportToV15')?.value),
      center:S($('finReportCenterV15')?.value),
      type:S($('finReportTypeV15')?.value),
      supervisor:S($('finReportSupervisorV15')?.value),
      project:S($('finReportProjectV15')?.value),
      product:S($('finReportProductV15')?.value)
    };
  }
  function movementDate(m){ return S(m.movement_date || m.created_at).slice(0,10); }
  function movementCenter(m){
    if(S(m.center)) return S(m.center);
    const meta=safeJson(m.notes)||{};
    return A(meta.distribution).map(d=>S(d.center)).filter(Boolean).join(', ') || S(m.cost_center || '');
  }
  function movementDistributionRowsV15(m){
    const meta=safeJson(m.notes)||{};
    const rows=A(meta.distribution);
    if(!rows.length) return [m];
    return rows.map((d,idx)=>({
      ...m,
      parent_id:m.id,
      distribution_index:idx,
      is_distribution_row:true,
      base_movement_type:S(m.movement_type),
      movement_type:S(d.type||m.movement_type)||S(m.movement_type),
      quantity:N(d.qty),
      center:S(d.center||m.cost_center),
      project_id:d.projectId||m.project_id||null,
      project_name:S(d.projectName||m.project_name||''),
      order_no:S(d.orderNo||m.order_no||''),
      distribution_note:S(d.note||'')
    })).filter(r=>N(r.quantity)>0);
  }
  function movementFinancialTypesV15(){
    return ['consume','waste','damaged','scrap'];
  }
  function movementOutTypesV15(){
    return ['out','consume','waste','damaged','scrap'];
  }
  function movementReportNetV15(m){
    const type=S(m.movement_type);
    if(type==='in') return movementNetValueV15(m);
    if(movementFinancialTypesV15().includes(type)){
      const unit=movementUnitCostV15(m) || itemUnitCostV15(state.items.find(i=>String(i.id)===String(m.item_id))||{});
      return N(m.quantity)*unit;
    }
    return 0;
  }
  function movementPass(m, f){
    const dt=movementDate(m);
    if(f.from && dt < f.from) return false;
    if(f.to && dt > f.to) return false;
    if(f.type==='in' && S(m.movement_type)!=='in') return false;
    if(f.type==='out' && !movementOutTypesV15().includes(S(m.movement_type))) return false;
    if(f.center){
      if(m.is_distribution_row && movementCenter(m)!==f.center) return false;
      if(!m.is_distribution_row && !movementCenter(m).split(',').map(x=>S(x)).includes(f.center)) return false;
    }
    if(f.project){
      if(m.is_distribution_row && S(m.project_id)!==f.project) return false;
      if(!m.is_distribution_row && S(m.project_id)!==f.project && !A((safeJson(m.notes)||{}).distribution).some(d=>S(d.projectId)===f.project)) return false;
    }
    if(f.product && S(m.item_id)!==f.product) return false;
    if(f.supervisor && S((safeJson(m.notes)||{}).staffId)!==f.supervisor) return false;
    if(f.q && ![m.item_name,m.product_code,m.barcode,m.receiver,m.reason,m.project_name,m.order_no,m.distribution_note,movementCenter(m)].map(S).join(' ').toLowerCase().includes(f.q)) return false;
    return true;
  }
  function reportProducts(){
    const f=reportFilters();
    return state.items.filter(i=>{
      if(computedItemQtyV15(i)<=0) return false;
      if(f.product && S(i.id)!==f.product) return false;
      if(f.q && ![i.name,itemCode(i),i.unit,productType(i)].map(S).join(' ').toLowerCase().includes(f.q)) return false;
      return true;
    });
  }
  function reportMovements(){
    const f=reportFilters();
    return state.movements.filter(m=>{
      const type=S(m.movement_type);
      if(type==='return' || type==='out') return false;
      if(N(m.quantity)<=0) return false;
      return movementPass(m,f);
    });
  }
  function reportInventory(){
    const f=reportFilters();
    return state.items.filter(i=>{
      if(computedItemQtyV15(i)<=0) return false;
      if(f.product && S(i.id)!==f.product) return false;
      if(f.q && ![i.name,itemCode(i),i.unit,productType(i),i.supplier].map(S).join(' ').toLowerCase().includes(f.q)) return false;
      return true;
    });
  }
  function reportCostRows(){
    const f=reportFilters();
    return state.movements.flatMap(m=>movementDistributionRowsV15(m)).filter(m=>{
      if(S(m.movement_type)==='return') return false;
      if(!movementFinancialTypesV15().includes(S(m.movement_type))) return false;
      return movementPass(m,f);
    });
  }
  function reportTotalsForTab(tab){
    let rows=[];
    if(tab==='products') rows=reportProducts().map(i=>({net:computedItemQtyV15(i)*itemUnitCostV15(i)}));
    else if(tab==='inventory') rows=reportInventory().map(i=>({net:computedItemQtyV15(i)*itemUnitCostV15(i)}));
    else if(tab==='cost') rows=reportCostRows().map(m=>({net:movementReportNetV15(m)}));
    else rows=reportMovements().map(m=>{
      const net=movementReportNetV15(m);
      const vat=S(m.movement_type)==='in' ? movementVatValueV15(m) : net*VAT_RATE;
      return {net, vat};
    });
    const net=rows.reduce((a,r)=>a+N(r.net),0);
    const vat=tab==='movement' ? rows.reduce((a,r)=>a+N(r.vat),0) : net*VAT_RATE;
    return {net, vat, gross:net+vat};
  }
  function reportWindowHtml(){
    if(state.reportTab==='products') return productsReportHtml();
    if(state.reportTab==='movement') return movementReportHtml();
    if(state.reportTab==='inventory') return inventoryReportHtml();
    return costReportHtml();
  }
  function productsReportHtml(){
    const rows=reportProducts();
    const blocks=rows.map(i=>{
      const moves=productActivityRowsV15(i);
      const ins=moves.filter(m=>S(m.movement_type)==='in');
      const consumed=moves.filter(m=>movementFinancialTypesV15().includes(S(m.movement_type)));
      const inQty=ins.reduce((a,m)=>a+N(m.quantity),0);
      const currentQty=computedItemQtyV15(i);
      const unitCost=itemUnitCostV15(i);
      const consumedBy={};
      consumed.forEach(m=>{
        const key=S(m.receiver)||'غير محدد';
        if(!consumedBy[key]) consumedBy[key]={receiver:key,qty:0,net:0,rows:0,projects:new Set()};
        consumedBy[key].qty+=N(m.quantity);
        consumedBy[key].net+=movementReportNetV15(m);
        consumedBy[key].rows+=1;
        if(S(m.project_name)) consumedBy[key].projects.add(S(m.project_name));
      });
      const consumerRows=Object.values(consumedBy).map(r=>`<tr><td>${esc(r.receiver)}</td><td>${r.rows}</td><td>${N(r.qty)}</td><td>${money(unitCost)}</td><td>${money(r.net)}</td><td>${esc([...r.projects].join(', ')||'-')}</td></tr>`).join('') || '<tr><td colspan="6">لا يوجد استهلاك مسجل لهذا المنتج</td></tr>';
      const inRows=ins.map(m=>`<tr><td>${esc(movementDate(m)||'-')}</td><td>${N(m.quantity)}</td><td>${esc(m.receiver||'-')}</td><td>${money(N(m.unit_cost)||unitCost)}</td><td>${money((N(m.unit_cost)||unitCost)*N(m.quantity))}</td></tr>`).join('') || '<tr><td colspan="5">لا توجد حركات دخول</td></tr>';
      return `<div class="fin-card"><h3>${esc(i.name||'-')}</h3><div class="fin-grid four"><div class="fin-soft">الكود: <b>${esc(itemCode(i)||'-')}</b></div><div class="fin-soft">مرات الدخول: <b>${ins.length}</b></div><div class="fin-soft">كمية الدخول: <b>${N(inQty)}</b></div><div class="fin-soft">الرصيد الحالي: <b>${N(currentQty)}</b></div></div><h3>الدخول للمخزن</h3><div class="fin-table"><table><thead><tr><th>التاريخ</th><th>الكمية</th><th>المورد/البيان</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${inRows}</tbody></table></div><h3>استهلاك المشرفين</h3><div class="fin-table"><table><thead><tr><th>المشرف / المستلم</th><th>عدد العمليات</th><th>كم حبة</th><th>سعر الوحدة</th><th>الإجمالي</th><th>المشاريع</th></tr></thead><tbody>${consumerRows}</tbody></table></div></div>`;
    }).join('');
    return `<div class="fin-card"><h3>نافذة تقرير المنتجات</h3><p class="fin-soft">يعرض كل منتج: كم مرة دخل المخزن، ومن استهلكه من المشرفين، والكمية والسعر.</p></div>${blocks || '<div class="fin-card">لا توجد منتجات حسب الفلتر</div>'}`;
  }
  function movementReportHtml(){
    const rows=reportMovements();
    return `<div class="fin-card"><h3>نافذة حركة المخزون</h3><p class="fin-soft">حركات الصرف العادي لا تظهر في هذا التقرير. التقرير يعرض الدخول والاستهلاك والتالف والمهدور والسكراب فقط.</p><div class="fin-table"><table><thead><tr><th>التاريخ</th><th>الحركة</th><th>المنتج</th><th>الكمية</th><th>المستلم/المورد</th><th>المشروع</th><th>قبل الضريبة</th><th>بعد الضريبة</th></tr></thead><tbody>${rows.map(m=>{const net=movementReportNetV15(m); const vat=S(m.movement_type)==='in'?movementVatValueV15(m):net*VAT_RATE;return `<tr><td>${esc(movementDate(m)||'-')}</td><td>${esc(movementTypeLabelV15(m.movement_type))}</td><td>${esc(m.item_name||'-')}</td><td>${N(m.quantity)}</td><td>${esc(m.receiver||'-')}</td><td>${esc(m.project_name||'-')}</td><td>${money(net)}</td><td>${money(net+vat)}</td></tr>`;}).join('') || '<tr><td colspan="8">لا توجد حركات حسب الفلتر</td></tr>'}</tbody></table></div></div>`;
  }
  function inventoryReportHtml(){
    const rows=reportInventory();
    return `<div class="fin-card"><h3>نافذة جرد المخزن</h3><p class="fin-soft">أي منتج رصيده صفر لا يظهر في الجرد.</p><div class="fin-table"><table><thead><tr><th>المنتج</th><th>الكود</th><th>الوحدة</th><th>النوع</th><th>الرصيد</th><th>قيمة قبل الضريبة</th><th>الضريبة</th><th>بعد الضريبة</th></tr></thead><tbody>${rows.map(i=>{const qty=computedItemQtyV15(i); const net=qty*itemUnitCostV15(i);return `<tr><td>${esc(i.name)}</td><td>${esc(itemCode(i)||'-')}</td><td>${esc(i.unit||'-')}</td><td>${esc(productType(i))}</td><td>${N(qty)}</td><td>${money(net)}</td><td>${money(net*VAT_RATE)}</td><td>${money(net*(1+VAT_RATE))}</td></tr>`;}).join('') || '<tr><td colspan="8">لا توجد منتجات برصيد متاح</td></tr>'}</tbody></table></div></div>`;
  }
  function costReportHtml(){
    const rows=reportCostRows();
    const groups={};
    rows.forEach(m=>{
      const name=S(m.project_name)||'بدون مشروع';
      if(!groups[name]) groups[name]=[];
      groups[name].push(m);
    });
    const groupHtml=Object.entries(groups).map(([project,items])=>{
      const netTotal=items.reduce((a,m)=>a+movementReportNetV15(m),0);
      const body=items.map(m=>{const net=movementReportNetV15(m);return `<tr><td>${esc(movementDate(m)||'-')}</td><td>${esc(m.item_name||'-')}</td><td>${esc(movementTypeLabelV15(m.movement_type))}</td><td>${N(m.quantity)}</td><td>${esc(m.receiver||'-')}</td><td>${esc(movementCenter(m)||'-')}</td><td>${esc(m.order_no||'-')}</td><td>${esc(m.distribution_note||'-')}</td><td>${money(net)}</td><td>${money(net*VAT_RATE)}</td><td>${money(net*(1+VAT_RATE))}</td></tr>`;}).join('');
      return `<div class="fin-card"><h3>المشروع: ${esc(project)}</h3><div class="fin-table"><table><thead><tr><th>التاريخ</th><th>المنتج</th><th>نوع الاستهلاك</th><th>الكمية</th><th>المستلم</th><th>مركز التكلفة</th><th>الأوردر</th><th>ملاحظة</th><th>قبل الضريبة</th><th>الضريبة</th><th>بعد الضريبة</th></tr></thead><tbody>${body}<tr><th colspan="8">مجموع المشروع</th><th>${money(netTotal)}</th><th>${money(netTotal*VAT_RATE)}</th><th>${money(netTotal*(1+VAT_RATE))}</th></tr></tbody></table></div></div>`;
    }).join('');
    return `<div class="fin-card"><h3>نافذة تقرير مراكز التكلفة</h3><p class="fin-soft">المشاريع تظهر كمجموعات، وتحت كل مشروع مستهلكاته ومجموعه. الصرف العادي لا يدخل في تكلفة التقرير حتى يتحول إلى استهلاك.</p></div>${groupHtml || '<div class="fin-card">لا توجد بيانات مراكز تكلفة حسب الفلتر</div>'}`;
  }

  function findItem(line){
    const code=S(line.code);
    const distCode=S(line.distributor_code);
    return state.items.find(i=>code && [i.product_code,i.serial_number,i.barcode,i.code].map(S).includes(code))
      || state.items.find(i=>distCode && [i.supplier_barcode,i.distributor_code].map(S).includes(distCode))
      || state.items.find(i=>S(i.name).toLowerCase()===S(line.name).toLowerCase());
  }

  window.financeProTabV15 = async function(tab){
    const allowed=financeTabsV15().map(t=>t[0]);
    state.tab=allowed.includes(tab) ? tab : (allowed[0] || 'summary');
    try{
      renderShell();
    }catch(e){
      console.warn('finance pro shell failed', state.tab, e);
      state.tab='summary';
      renderShell();
    }
    return false;
  };
  window.financeProReportTabV15 = function(tab){
    state.reportTab = tab || 'products';
    renderBody();
  };
  window.financeProRenderReportsV15 = function(){
    renderBody();
  };
  window.financeProRenderCurrentV15 = function(){
    renderBody();
  };
  window.financeProPrintReportV15 = function(){
    const titleMap={products:'تقرير المنتجات',movement:'حركة المخزون',inventory:'جرد المخزن',cost:'تقرير مراكز التكلفة'};
    const totals=reportTotalsForTab(state.reportTab);
    const content=$('finReportWindowV15')?.innerHTML || '';
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(titleMap[state.reportTab]||'تقرير')}</title><style>
      body{font-family:Tahoma,Arial,sans-serif;margin:18px;color:#073d31}h1{margin:0 0 14px}.fin-card{border:1px solid #d9e7e2;border-radius:14px;padding:14px;margin-bottom:12px}.fin-soft{background:#f4faf7;border:1px solid #d8ebe3;border-radius:12px;padding:10px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #d9e7e2;padding:8px;text-align:right}th{background:#f4faf7}.fin-actions,button{display:none!important}.totals{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.box{border:1px solid #d9e7e2;border-radius:12px;padding:12px}.box b{font-size:18px}@media print{body{margin:8mm}}
    </style></head><body><h1>${esc(titleMap[state.reportTab]||'تقرير')}</h1>${content}<div class="totals"><div class="box">قبل الضريبة<br><b>${money(totals.net)}</b></div><div class="box">الضريبة<br><b>${money(totals.vat)}</b></div><div class="box">بعد الضريبة<br><b>${money(totals.gross)}</b></div></div><script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`;
    const w=window.open('', '_blank');
    if(w){ w.document.write(html); w.document.close(); }
  };
  window.financeProLoadV15 = async function(force){
    await loadAll(force);
    renderShell();
    if(force && typeof msg==='function') msg('تم تحديث بيانات المالية والمخزون');
  };
  window.financeProRenderProductListV15 = renderProductList;
  window.financeProRenderSuppliersV15 = renderSuppliersList;

  window.financeProReadLineImageV15 = function(input){
    const file = input && input.files && input.files[0];
    window.__financeProLineImageV15 = '';
    if($('finLineImageNameV15')) $('finLineImageNameV15').textContent = file ? file.name : 'لم يتم اختيار صورة';
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => { window.__financeProLineImageV15 = String(reader.result || ''); };
    reader.readAsDataURL(file);
  };
  window.financeProFillExistingProductV15 = function(id){
    const item=state.items.find(i=>String(i.id)===String(id));
    if(!item){
      if($('finLineNameV15')) $('finLineNameV15').value='';
      if($('finLineCodeV15')) $('finLineCodeV15').value=nextInternalCode();
      if($('finLineDistributorCodeV15')) $('finLineDistributorCodeV15').value='';
      if($('finLineMinQtyV15')) $('finLineMinQtyV15').value='';
      return;
    }
    if($('finLineNameV15')) $('finLineNameV15').value=S(item.name);
    if($('finLineCodeV15')) $('finLineCodeV15').value=itemCode(item);
    if($('finLineDistributorCodeV15')) $('finLineDistributorCodeV15').value=S(item.supplier_barcode || item.distributor_code || '');
    if($('finLineUnitV15')) $('finLineUnitV15').value=S(item.unit||'حبة');
    if($('finLineTypeV15')) $('finLineTypeV15').value=productType(item);
    if($('finLineMinQtyV15')) $('finLineMinQtyV15').value=N(item.min_quantity || item.reorder_level || 1);
    if($('finLinePriceV15') && !$('finLinePriceV15').value) $('finLinePriceV15').value=itemUnitCostV15(item) || '';
  };

  window.financeProAddInvoiceLineV15 = function(){
    const line={ name:S($('finLineNameV15')?.value), code:S($('finLineCodeV15')?.value), distributor_code:S($('finLineDistributorCodeV15')?.value), supplier_invoice_no:S($('finLineSupplierInvoiceV15')?.value), qty:N($('finLineQtyV15')?.value), min_quantity:N($('finLineMinQtyV15')?.value)||1, price:N($('finLinePriceV15')?.value), tax_mode:S($('finLineTaxModeV15')?.value)||'before', unit:S($('finLineUnitV15')?.value)||'حبة', item_type:S($('finLineTypeV15')?.value)||'مادة', image:S(window.__financeProLineImageV15||'') };
    const existingItem=state.items.find(i=>String(i.id)===String($('finExistingProductV15')?.value));
    if(!line.name) return alert('اسم المنتج مطلوب');
    if(line.qty<=0) return alert('الكمية مطلوبة');
    if(line.price<0) return alert('السعر غير صحيح');
    if(!line.image && !(existingItem && S(existingItem.image_url))) return alert('يجب إرفاق صورة للمنتج قبل إضافته للمخزون');
    state.invoiceLines.push(line);
    ['finLineNameV15','finLineDistributorCodeV15','finLineSupplierInvoiceV15','finLineQtyV15','finLineMinQtyV15','finLinePriceV15'].forEach(id=>{ if($(id)) $(id).value=''; });
    if($('finExistingProductV15')) $('finExistingProductV15').value='';
    if($('finLineCodeV15')) $('finLineCodeV15').value=nextInternalCode();
    if($('finLineImageV15')) $('finLineImageV15').value='';
    if($('finLineImageNameV15')) $('finLineImageNameV15').textContent='لم يتم اختيار صورة';
    window.__financeProLineImageV15='';
    renderInvoiceLines();
  };
  window.financeProRemoveInvoiceLineV15 = function(idx){ state.invoiceLines.splice(idx,1); renderInvoiceLines(); };
  window.financeProClearInvoiceV15 = function(){ state.invoiceLines=[]; renderInvoiceLines(); };

  window.financeProSaveInvoiceV15 = async function(btn){
    try{
      if(btn) btn.disabled=true;
      if(!window.sb) throw new Error('الاتصال غير جاهز');
      if(!state.invoiceLines.length) throw new Error('أضف منتج واحد على الأقل داخل الفاتورة');
      const supplier=S($('finInvSupplierV15')?.value);
      const invoiceNo=S($('finInvNoV15')?.value) || ('INV-'+Date.now());
      const date=S($('finInvDateV15')?.value) || today();
      for(const l of state.invoiceLines){
        const old=findItem(l);
        let item=old;
        const q=N(l.qty), cost=unitNetFromLine(l);
        if(old){
          const oldQty=N(old.quantity), oldCost=itemCost(old), newQty=oldQty+q;
          const avg=newQty>0 ? ((oldQty*oldCost)+(q*cost))/newQty : cost;
          const upd={quantity:newQty, unit_cost:+avg.toFixed(4), supplier:supplier||old.supplier, unit:l.unit||old.unit, item_type:l.item_type||old.item_type, type:l.item_type||old.type, product_code:l.code||old.product_code, serial_number:l.code||old.serial_number, barcode:l.code||old.barcode, supplier_barcode:l.distributor_code||old.supplier_barcode, min_quantity:N(l.min_quantity)||N(old.min_quantity)||1};
          if(l.image) upd.image_url = l.image;
          const res=await sb.from('inventory_items').update(upd).eq('id',old.id).select('*').single();
          if(res.error) throw res.error;
          item=res.data;
        }else{
          const ins={name:l.name, product_code:l.code, serial_number:l.code, barcode:l.code, supplier_barcode:l.distributor_code||l.code, image_url:l.image||'', unit:l.unit||'حبة', item_type:l.item_type||'مادة', type:l.item_type||'مادة', quantity:q, min_quantity:N(l.min_quantity)||1, unit_cost:+cost.toFixed(4), supplier, category:l.item_type||'عام', notes:'تمت الإضافة من فاتورة '+invoiceNo+(S(l.supplier_invoice_no)?' / فاتورة المورد '+S(l.supplier_invoice_no):'')};
          const res=await sb.from('inventory_items').insert(ins).select('*').single();
          if(res.error) throw res.error;
          item=res.data;
        }
        const c=rowVat(q,l.price,l.tax_mode);
        const meta={module:VERSION, invoiceNo, supplier, supplierInvoiceNo:S(l.supplier_invoice_no), minQuantity:N(l.min_quantity)||1, taxMode:S(l.tax_mode||'before'), beforeVat:c.net, vat:c.vat, afterVat:c.gross};
        const mv={item_id:item.id,item_name:item.name,movement_type:'in',quantity:q,movement_date:date,receiver:supplier,reason:'إضافة مخزون - فاتورة '+invoiceNo,notes:'finance_pro_v15:'+JSON.stringify(meta),product_code:l.code,barcode:l.distributor_code||l.code,unit_cost:+cost.toFixed(4)};
        const mr=await sb.from('inventory_movements').insert(mv);
        if(mr.error) throw mr.error;
      }
      state.invoiceLines=[];
      await loadAll(true);
      renderShell();
      if(typeof msg==='function') msg('تم حفظ الفاتورة وتحديث المنتجات والمخزون');
    }catch(e){ alert(e.message||String(e)); if(typeof msg==='function') msg(e.message||String(e),'err'); }
    finally{ if(btn) btn.disabled=false; }
  };

  window.financeProShowInvoiceV15 = function(encoded){
    const invoiceNo=decodeURIComponent(encoded);
    const inv=invoicesFromMovements().find(x=>S(x.invoiceNo)===S(invoiceNo));
    if(!inv) return;
    const rows=inv.lines.map(m=>{ const meta=safeJson(m.notes)||{}; const net=N(meta.beforeVat)||(N(m.quantity)*N(m.unit_cost)); const vat=N(meta.vat); const gross=N(meta.afterVat)||(net+vat); const modeLabel={before:'قبل الضريبة',after:'بعد الضريبة',none:'بدون ضريبة'}[S(meta.taxMode||'before')]||'قبل الضريبة'; return `<tr><td>${esc(m.item_name||'-')}</td><td>${esc(m.product_code||'-')}</td><td>${N(m.quantity)}</td><td>${esc(modeLabel)}</td><td>${money(N(m.unit_cost))}</td><td>${money(net)}</td><td>${money(vat)}</td><td>${money(gross)}</td></tr>`; }).join('');
    openPagedModalV15('فاتورة مخزون: '+invoiceNo, [
      {title:'بيانات الفاتورة', html:`<div class="fin-grid three"><div class="fin-card"><h3>المورد</h3><b>${esc(inv.supplier||'-')}</b></div><div class="fin-card"><h3>التاريخ</h3><b>${esc(inv.date||'-')}</b></div><div class="fin-card"><h3>عدد المنتجات</h3><b>${inv.lines.length}</b></div></div>`},
      {title:'المنتجات', html:`<div class="fin-table"><table><thead><tr><th>المنتج</th><th>الكود</th><th>الكمية</th><th>طريقة الضريبة</th><th>تكلفة الوحدة قبل الضريبة</th><th>قبل الضريبة</th><th>الضريبة</th><th>بعد الضريبة</th></tr></thead><tbody>${rows}</tbody></table></div>`}
    ]);
  };
  window.financeProEditInvoiceV15 = function(encoded){
    if(!canEditInvoicesV15()) return alert('تعديل الفاتورة متاح لمدير النظام فقط');
    const invoiceNo=decodeURIComponent(encoded);
    const inv=invoicesFromMovements().find(x=>S(x.invoiceNo)===S(invoiceNo));
    if(!inv) return;
    state.tab='add';
    state.invoiceLines=inv.lines.map(m=>{
      const meta=safeJson(m.notes)||{};
      const mode=S(meta.taxMode||'before');
      const price=mode==='after' && N(m.quantity)>0 ? N(meta.afterVat)/N(m.quantity) : N(m.unit_cost);
      return {name:S(m.item_name), code:S(m.product_code), distributor_code:S(m.barcode), supplier_invoice_no:S(meta.supplierInvoiceNo), qty:N(m.quantity), min_quantity:N(meta.minQuantity)||1, price, tax_mode:mode, unit:'حبة', item_type:'مادة', image:''};
    });
    renderShell();
    if($('finInvSupplierV15')) $('finInvSupplierV15').value=inv.supplier||'';
    if($('finInvNoV15')) $('finInvNoV15').value=inv.invoiceNo||'';
    if($('finInvDateV15')) $('finInvDateV15').value=inv.date||today();
    renderInvoiceLines();
    if(typeof msg==='function') msg('تم تحميل الفاتورة للتعديل. عند الحفظ ستضيف نسخة حركة جديدة، ويمكن حذف القديمة من سجل الحركة عند الحاجة.');
  };

  function selectedMoveItemV15(){
    return state.items.find(i=>String(i.id)===String($('finMoveItemV15')?.value)) || null;
  }
  function orderInventoryCostAmountV15(item, qty){
    return +(N(qty) * (item ? itemUnitCostV15(item) : 0)).toFixed(2);
  }
  function confirmOrderForDistributionV15(orderNo, item, qty, type, projectNameText){
    const finder = typeof window.tasneefOrdersFindV8 === 'function' ? window.tasneefOrdersFindV8 : null;
    const found = finder ? finder(orderNo) : null;
    if(!found){
      alert('لم أجد أوردر بهذا الرقم: '+orderNo);
      return null;
    }
    const rawAmount = orderInventoryCostAmountV15(item, qty);
    const amount = S(type)==='return' ? -rawAmount : rawAmount;
    const actionLabel = S(type)==='return' ? 'ستخصم من الأوردر' : 'ستضاف للأوردر';
    const ok = confirm(
      'هل هذا هو الأوردر؟\n\n' +
      'رقم الأوردر: '+found.orderNo+'\n' +
      'المشروع: '+(found.project || '-')+'\n' +
      'العميل: '+(found.client || '-')+'\n' +
      'التفاصيل: '+(found.details || '-')+'\n\n' +
      'المنتج: '+(item ? item.name : '-')+'\n' +
      'نوع التوزيع: '+movementTypeLabelV15(type)+'\n' +
      'الكمية: '+N(qty)+'\n' +
      'تكلفة المخزن التي '+actionLabel+': '+money(Math.abs(amount))
    );
    if(!ok) return null;
    return {
      orderConfirmed:true,
      orderNo:found.orderNo,
      orderProject:found.project || projectNameText || '',
      orderInventoryCost:amount,
      orderItemName:item ? item.name : '',
      orderItemCode:item ? itemCode(item) : '',
      orderCostUnit:item ? itemUnitCostV15(item) : 0
    };
  }
  function applyOrderInventoryCostsFromDistributionV15(distribution, item, movementDate, movementType){
    const addCost = typeof window.tasneefOrdersAddInventoryCostV8 === 'function' ? window.tasneefOrdersAddInventoryCostV8 : null;
    if(!addCost) return;
    A(distribution).forEach((d,idx)=>{
      if(!d || !d.orderConfirmed || !S(d.orderNo) || N(d.orderInventoryCost)===0) return;
      const key=[
        'inv-order-cost-v15',
        movementDate || today(),
        item ? item.id : '',
        S(d.orderNo),
        idx,
        S(d.type || movementType),
        N(d.qty),
        N(d.orderInventoryCost)
      ].join('|');
      addCost(d.orderNo, N(d.orderInventoryCost), {
        key,
        source:'inventory_movement',
        date:movementDate || today(),
        product:item ? item.name : S(d.orderItemName),
        productCode:item ? itemCode(item) : S(d.orderItemCode),
        qty:N(d.qty),
        unitCost:N(d.orderCostUnit) || (item ? itemUnitCostV15(item) : 0),
        movementType:S(d.type || movementType),
        center:S(d.center),
        projectName:S(d.projectName || d.orderProject),
        note:S(d.note)
      });
    });
  }

  window.financeProAddDistributionV15 = function(){
    const center=S($('finDistCenterV15')?.value)||'FM';
    const type=S($('finDistTypeV15')?.value)||'out';
    const pid=S($('finDistProjectV15')?.value);
    const qty=N($('finDistQtyV15')?.value);
    if(qty<=0) return alert('كمية التوزيع مطلوبة');
    const orderNo=S($('finDistOrderV15')?.value);
    const item=selectedMoveItemV15();
    let orderLink=null;
    if(orderNo){
      if(!item) return alert('اختر المنتج أولاً حتى يتم حساب تكلفة المخزن للأوردر');
      orderLink = confirmOrderForDistributionV15(orderNo, item, qty, type, pid?projectName(pid):'');
    }
    state.distribution.push(Object.assign({center, type, projectId:pid||null, projectName:pid?projectName(pid):'', orderNo, qty, note:S($('finDistNoteV15')?.value)}, orderLink||{}));
    ['finDistOrderV15','finDistQtyV15','finDistNoteV15'].forEach(id=>{ if($(id)) $(id).value=''; });
    renderDistribution();
  };
  window.financeProUpdateDistributionV15 = function(idx, field, value){
    const row = state.distribution[Number(idx)];
    if(!row) return;
    if(field === 'qty'){
      row.qty = N(value);
    }else if(field === 'projectId'){
      row.projectId = S(value) || null;
      row.projectName = row.projectId ? projectName(row.projectId) : '';
    }else if(['center','type','orderNo','note'].includes(field)){
      row[field] = S(value);
    }
    if(['qty','type','orderNo'].includes(field)){
      delete row.orderConfirmed;
      delete row.orderInventoryCost;
      delete row.orderProject;
      delete row.orderCostUnit;
    }
    const totalBox = $('finDistributionBoxV15')?.querySelector('.fin-soft b');
    if(totalBox) totalBox.textContent = N(state.distribution.reduce((s,d)=>s+N(d.qty),0));
  };
  window.financeProRemoveDistributionV15 = function(idx){ state.distribution.splice(idx,1); renderDistribution(); };
  window.financeProClearDistributionV15 = function(){ state.distribution=[]; renderDistribution(); };

  window.financeProSaveMovementV15 = async function(btn){
    try{
      if(btn) btn.disabled=true;
      if(!window.sb) throw new Error('الاتصال غير جاهز');
      const item=state.items.find(i=>String(i.id)===String($('finMoveItemV15')?.value));
      if(!item) throw new Error('اختر المنتج');
      const qty=N($('finMoveQtyV15')?.value);
      if(qty<=0) throw new Error('الكمية مطلوبة');
      const type=S($('finMoveTypeV15')?.value)||'out';
      const stockOutTypes=movementOutTypesV15();
      const oldMove=state.editMovementId ? state.movements.find(m=>String(m.id)===String(state.editMovementId)) : null;
      const oldSameItem = oldMove && String(oldMove.item_id)===String(item.id) ? oldMove : null;
      const oldDifferentItem = oldMove && String(oldMove.item_id)!==String(item.id) ? state.items.find(i=>String(i.id)===String(oldMove.item_id)) : null;
      const availableForEdit = computedItemQtyV15(item) - (oldSameItem ? movementComputedDeltaV15(oldSameItem) : 0);
      if(stockOutTypes.includes(type) && availableForEdit<qty) throw new Error('الكمية المتوفرة لا تكفي');
      const distTotal=state.distribution.reduce((s,d)=>s+N(d.qty),0);
      if(stockOutTypes.includes(type) && state.distribution.length && Math.abs(distTotal-qty)>.001) throw new Error('إجمالي التوزيع يجب أن يساوي كمية الحركة');
      const staffId=S($('finMoveStaffV15')?.value);
      const oldType=S(oldMove?.movement_type);
      const neutralReturnEdit = oldSameItem && stockOutTypes.includes(oldType) && type==='return';
      const meta={module:VERSION, staffId, note:S($('finMoveNoteV15')?.value), distribution:state.distribution, stockEffect: neutralReturnEdit ? 'none' : 'normal'};
      const reasonMap={return:'مرتجع مخزون',consume:'مستهلك',waste:'مهدور',damaged:'تالف',scrap:'سكراب',out:'صرف مخزون'};
      const mv={item_id:item.id,item_name:item.name,movement_type:type,quantity:qty,movement_date:S($('finMoveDateV15')?.value)||today(),receiver:staffName(staffId),reason:reasonMap[type]||'صرف مخزون',notes:'finance_pro_v15:'+JSON.stringify(meta),product_code:itemCode(item),barcode:itemCode(item),unit_cost:+itemCost(item).toFixed(4)};
      const res=oldMove ? await sb.from('inventory_movements').update(mv).eq('id', oldMove.id) : await sb.from('inventory_movements').insert(mv);
      if(res.error) throw res.error;
      applyOrderInventoryCostsFromDistributionV15(state.distribution, item, mv.movement_date, type);
      if(oldDifferentItem){
        const oldQty=computedItemQtyV15(oldDifferentItem)-movementComputedDeltaV15(oldMove);
        const oldUpdate=await sb.from('inventory_items').update({quantity:oldQty}).eq('id',oldDifferentItem.id);
        if(oldUpdate.error) throw oldUpdate.error;
      }
      const currentQty=computedItemQtyV15(item) - (oldSameItem ? movementComputedDeltaV15(oldSameItem) : 0);
      const newDelta = neutralReturnEdit ? 0 : (type==='return' ? qty : -qty);
      const newQty=currentQty+newDelta;
      const ur=await sb.from('inventory_items').update({quantity:newQty}).eq('id',item.id);
      if(ur.error) throw ur.error;
      state.distribution=[];
      state.editMovementId='';
      await loadAll(true);
      renderShell();
      if(typeof msg==='function') msg(oldMove?'تم تعديل حركة المخزون':'تم حفظ حركة المخزون وتوزيع مركز التكلفة');
    }catch(e){ alert(e.message||String(e)); if(typeof msg==='function') msg(e.message||String(e),'err'); }
    finally{ if(btn) btn.disabled=false; }
  };

  window.financeProShowMovementV15 = function(id){
    const m=state.movements.find(x=>Number(x.id)===Number(id)); if(!m) return;
    const meta=safeJson(m.notes)||{};
    const note=cleanMovementNoteV15(m);
    const rows=A(meta.distribution).map(d=>`<tr><td>${esc(d.center)}</td><td>${esc(movementTypeLabelV15(d.type||m.movement_type))}</td><td>${esc(d.projectName||'-')}</td><td>${esc(d.orderNo||'-')}</td><td>${N(d.qty)}</td><td>${esc(d.note||'')}</td></tr>`).join('') || '<tr><td colspan="6">لا يوجد توزيع محفوظ</td></tr>';
    openPagedModalV15('تفاصيل حركة المخزون', [
      {title:'بيانات الحركة', html:`<div class="fin-grid three"><div class="fin-card"><h3>المنتج</h3><b>${esc(m.item_name||'-')}</b></div><div class="fin-card"><h3>نوع الحركة</h3><b>${esc(movementTypeLabelV15(m.movement_type))}</b></div><div class="fin-card"><h3>الكمية</h3><b>${N(m.quantity)}</b></div><div class="fin-card"><h3>المستلم</h3><b>${esc(m.receiver||'-')}</b></div><div class="fin-card"><h3>التاريخ</h3><b>${esc(movementDate(m)||'-')}</b></div><div class="fin-card"><h3>السبب</h3><b>${esc(m.reason||'-')}</b></div></div><div class="fin-soft">الملاحظات: ${esc(note||'-')}</div>`},
      {title:'توزيع الاستهلاك', html:`<div class="fin-table"><table><thead><tr><th>المركز</th><th>نوع التوزيع</th><th>المشروع</th><th>الأوردر</th><th>الكمية</th><th>ملاحظة</th></tr></thead><tbody>${rows}</tbody></table></div>`}
    ]);
    return;
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:99999;display:grid;place-items:center;padding:18px"><div class="card" style="width:min(820px,96vw);max-height:90vh;overflow:auto"><div class="fin-actions" style="justify-content:space-between"><h2>تفاصيل حركة المخزون</h2><button class="danger" onclick="this.closest('.modal-backdrop').remove()">إغلاق</button></div><p><b>${esc(m.item_name)}</b> - الكمية ${N(m.quantity)} - المستلم ${esc(m.receiver||'-')}</p><div class="fin-table"><table><thead><tr><th>المركز</th><th>المشروع</th><th>الأوردر</th><th>الكمية</th><th>ملاحظة</th></tr></thead><tbody>${rows}</tbody></table></div></div></div>`);
  };

  function loadMovementForEditV15(m){
    if(!m) return alert('اختر حركة مخزون للتعديل');
    state.tab='movement';
    state.editMovementId=m.id;
    renderShell();
    if($('finMoveItemV15')) $('finMoveItemV15').value=m.item_id||'';
    if($('finMoveTypeV15')) $('finMoveTypeV15').value=S(m.movement_type)||'out';
    if($('finMoveQtyV15')) $('finMoveQtyV15').value=N(m.quantity);
    if($('finMoveDateV15')) $('finMoveDateV15').value=movementDate(m)||today();
    if($('finMoveNoteV15')) $('finMoveNoteV15').value=cleanMovementNoteV15(m);
    const receiver=S(m.receiver);
    const user=state.users.find(u=>[u.full_name,u.name,u.username].map(S).includes(receiver));
    if(user && $('finMoveStaffV15')) $('finMoveStaffV15').value=user.id;
    state.distribution=A((safeJson(m.notes)||{}).distribution).map(d=>({...d, qty:N(d.qty)}));
    renderDistribution();
    const btn=$('finMoveSaveBtnV15'); if(btn) btn.textContent='تحديث الحركة';
    window.scrollTo({top:0,behavior:'smooth'});
    if(typeof msg==='function') msg('تم تحميل الحركة المختارة للتعديل');
  }

  window.financeProEditMovementV15 = function(id){
    const m=state.movements.find(x=>Number(x.id)===Number(id));
    loadMovementForEditV15(m);
  };

  window.financeProEditLastMovementV15 = function(){
    const last=state.movements.slice().reverse().find(m=>['out','consume','waste','damaged','return'].includes(S(m.movement_type)));
    loadMovementForEditV15(last);
  };

  window.financeProClearMovementEditV15 = function(){
    state.editMovementId='';
    state.distribution=[];
    if($('finMoveQtyV15')) $('finMoveQtyV15').value='';
    if($('finMoveNoteV15')) $('finMoveNoteV15').value='';
    if($('finMoveDateV15')) $('finMoveDateV15').value=today();
    const btn=$('finMoveSaveBtnV15'); if(btn) btn.textContent='حفظ الحركة';
    renderDistribution();
  };

  function openPagedModalV15(title, pages){
    const id='finPagedModalV15_'+Date.now();
    const nav=A(pages).map((p,i)=>`<button class="fin-page-btn-v15 ${i?'light':''}" onclick="document.querySelectorAll('#${id} .fin-page-v15').forEach(x=>x.classList.add('hidden'));document.querySelector('#${id} [data-page=&quot;${i}&quot;]').classList.remove('hidden');document.querySelectorAll('#${id} .fin-page-btn-v15').forEach(x=>x.classList.add('light'));this.classList.remove('light')">${esc(p.title)}</button>`).join('');
    const bodies=A(pages).map((p,i)=>`<section class="fin-page-v15 ${i?'hidden':''}" data-page="${i}">${p.html}</section>`).join('');
    document.body.insertAdjacentHTML('beforeend',`<div id="${id}" class="modal-backdrop" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:99999;display:grid;place-items:center;padding:18px"><div class="card" style="width:min(1120px,96vw);max-height:92vh;overflow:auto"><div class="fin-actions" style="justify-content:space-between"><h2>${esc(title)}</h2><button class="danger" onclick="this.closest('.modal-backdrop').remove()">إغلاق</button></div><div class="fin-actions">${nav}</div>${bodies}</div></div>`);
  }

  function productMovements(item){
    const code=itemCode(item);
    return state.movements.filter(m =>
      String(m.item_id)===String(item.id) ||
      (code && [m.product_code,m.barcode].map(S).includes(code)) ||
      (!m.item_id && S(m.item_name)===S(item.name))
    );
  }
  function productActivityRowsV15(item){
    return productMovements(item).flatMap(m=>movementDistributionRowsV15(m));
  }
  function movementRowsHtml(rows){
    return rows.map(m=>{
      const net=movementReportNetV15(m);
      return `<tr><td>${esc(m.movement_date||S(m.created_at).slice(0,10)||'-')}</td><td>${esc(movementTypeLabelV15(m.movement_type))}</td><td>${N(m.quantity)}</td><td>${esc(m.receiver||'-')}</td><td>${esc(movementCenter(m)||'-')}</td><td>${esc(m.project_name||'-')}</td><td>${esc(m.order_no||'-')}</td><td>${esc(m.distribution_note||m.reason||'-')}</td><td>${money(net)}</td></tr>`;
    }).join('') || '<tr><td colspan="9">لا توجد بيانات</td></tr>';
  }
  window.financeProShowProductV15 = function(id){
    const item=state.items.find(i=>String(i.id)===String(id)); if(!item) return;
    const baseMoves=productMovements(item);
    const moves=productActivityRowsV15(item);
    const ins=baseMoves.filter(m=>S(m.movement_type)==='in');
    const outs=baseMoves.filter(m=>movementOutTypesV15().includes(S(m.movement_type)));
    const consumedRows=moves.filter(m=>S(m.movement_type)==='consume');
    const financialRows=moves.filter(m=>movementFinancialTypesV15().includes(S(m.movement_type)));
    const returns=moves.filter(m=>S(m.movement_type)==='return');
    const inQty=ins.reduce((a,m)=>a+N(m.quantity),0);
    const outQty=financialRows.reduce((a,m)=>a+N(m.quantity),0);
    const returnQty=returns.reduce((a,m)=>a+N(m.quantity),0);
    const consumed=consumedRows.reduce((a,m)=>a+N(m.quantity),0);
    const displayBalance=Math.max(0, inQty - outQty);
    const img=item.image_url?`<img src="${esc(item.image_url)}" style="width:96px;height:96px;object-fit:contain;border:1px solid #d9e7e2;border-radius:16px;background:#fff;padding:4px">`:'';
    openPagedModalV15('بيانات المنتج: '+(item.name||'-'), [
      {title:'الملخص', html:`<div class="fin-grid">${img?`<div class="fin-card">${img}</div>`:''}<div class="fin-card fin-kpi"><small>الداخل</small><b>${N(inQty)}</b></div><div class="fin-card fin-kpi"><small>الخارج</small><b>${N(outQty)}</b></div><div class="fin-card fin-kpi"><small>المستهلك</small><b>${N(consumed)}</b></div><div class="fin-card fin-kpi"><small>المرتجع</small><b>${N(returnQty)}</b></div><div class="fin-card fin-kpi"><small>الرصيد الحالي</small><b>${N(displayBalance)}</b></div></div><div class="fin-soft">الكود: <b>${esc(itemCode(item)||'-')}</b> | الوحدة: <b>${esc(item.unit||'-')}</b> | النوع: <b>${esc(productType(item))}</b></div>`},
      {title:'الداخل', html:`<div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المورد</th><th>المركز</th><th>المشروع</th><th>الأوردر</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${movementRowsHtml(ins)}</tbody></table></div>`},
      {title:'الخارج', html:`<div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المستلم</th><th>المركز</th><th>المشروع</th><th>الأوردر</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${movementRowsHtml(outs)}</tbody></table></div>`},
      {title:'المستهلك', html:`<div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المستلم</th><th>المركز</th><th>المشروع</th><th>الأوردر</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${movementRowsHtml(consumedRows)}</tbody></table></div>`},
      {title:'تقرير المنتج', html:`<div class="fin-card"><h3>تقرير خاص بالمنتج</h3><p class="fin-soft">يوضح عدد مرات الدخول والخروج، وأين تم الاستهلاك، ومن استلم المنتج. الصرف العادي يظهر كخروج وقيمته صفر حتى يتحول إلى مستهلك أو تالف أو مهدور أو سكراب.</p><div class="fin-grid three"><div class="fin-card fin-kpi"><small>مرات الدخول</small><b>${ins.length}</b></div><div class="fin-card fin-kpi"><small>مرات الخروج</small><b>${outs.length}</b></div><div class="fin-card fin-kpi"><small>مرات الاستهلاك المالي</small><b>${financialRows.length}</b></div></div></div><div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المستلم</th><th>مركز التكلفة</th><th>المشروع</th><th>الأوردر</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${movementRowsHtml(financialRows)}</tbody></table></div>`},
      {title:'المرتجع', html:`<div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المستلم</th><th>المركز</th><th>المشروع</th><th>الأوردر</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${movementRowsHtml(returns)}</tbody></table></div>`}
    ]);
    return;
    const html=`<div class="modal-backdrop" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:99999;display:grid;place-items:center;padding:18px"><div class="card" style="width:min(1100px,96vw);max-height:92vh;overflow:auto">
      <div class="fin-actions" style="justify-content:space-between"><div><h2>بيانات المنتج: ${esc(item.name)}</h2><p>الكود: <b>${esc(itemCode(item)||'-')}</b> | الوحدة: <b>${esc(item.unit||'-')}</b> | النوع: <b>${esc(productType(item))}</b></p></div><button class="danger" onclick="this.closest('.modal-backdrop').remove()">إغلاق</button></div>
      <div class="fin-grid">${img?`<div class="fin-card">${img}</div>`:''}<div class="fin-card fin-kpi"><small>الداخل</small><b>${N(inQty)}</b></div><div class="fin-card fin-kpi"><small>الخارج</small><b>${N(outQty)}</b></div><div class="fin-card fin-kpi"><small>المستهلك</small><b>${N(consumed)}</b></div><div class="fin-card fin-kpi"><small>الرصيد الحالي</small><b>${N(item.quantity)}</b></div></div>
      <h3>الداخل</h3><div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المورد/المستلم</th><th>المشروع</th><th>السبب</th><th>القيمة</th></tr></thead><tbody>${movementRowsHtml(ins)}</tbody></table></div>
      <h3>الخارج</h3><div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المستلم</th><th>المشروع</th><th>السبب</th><th>القيمة</th></tr></thead><tbody>${movementRowsHtml(outs)}</tbody></table></div>
      <h3>المرتجع</h3><div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المستلم</th><th>المشروع</th><th>السبب</th><th>القيمة</th></tr></thead><tbody>${movementRowsHtml(returns)}</tbody></table></div>
    </div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  };

  window.financeProDeleteProductV15 = async function(id){
    try{
      if(!canDeleteProductsV15()) return alert('حذف المنتج متاح لمدير النظام فقط');
      const item=state.items.find(i=>String(i.id)===String(id));
      if(!item) return;
      if(!confirm('حذف المنتج من قائمة المنتجات؟ لن يتم حذف حركاته القديمة.')) return;
      const res=await sb.from('inventory_items').delete().eq('id', id);
      if(res.error) throw res.error;
      await loadAll(true);
      renderShell();
      if(typeof msg==='function') msg('تم حذف المنتج');
    }catch(e){
      alert(e.message || String(e));
      if(typeof msg==='function') msg(e.message || String(e), 'err');
    }
  };

  window.financeProShowSupplierV15 = function(name){
    const supplier=S(name);
    const items=state.items.filter(i=>S(i.supplier)===supplier);
    const moves=state.movements.filter(m=>S(m.receiver)===supplier);
    const expenses=state.expenses.filter(e=>S(e.supplier)===supplier || S(e.description)===supplier);
    const itemRows=items.map(i=>`<tr><td>${esc(i.name)}</td><td>${esc(itemCode(i)||'-')}</td><td>${N(i.quantity)}</td><td>${esc(i.unit||'-')}</td><td>${money(itemCost(i))}</td><td class="fin-actions"><button class="light" onclick="financeProShowProductV15('${esc(i.id)}')">عرض</button>${canDeleteProductsV15()?`<button class="danger" onclick="financeProDeleteProductV15('${esc(i.id)}')">حذف</button>`:''}</td></tr>`).join('') || '<tr><td colspan="6">لا توجد منتجات لهذا المورد</td></tr>';
    const moveRows=moves.map(m=>`<tr><td>${esc(m.movement_date||S(m.created_at).slice(0,10)||'-')}</td><td>${esc(m.item_name||'-')}</td><td>${esc(movementTypeLabelV15(m.movement_type))}</td><td>${N(m.quantity)}</td><td>${money(N(m.quantity)*N(m.unit_cost))}</td><td class="fin-actions"><button onclick="financeProEditMovementV15(${Number(m.id)||0})">تعديل</button><button class="light" onclick="financeProShowMovementV15(${Number(m.id)||0})">عرض</button><button class="danger" onclick="financeProDeleteMovementV15(${Number(m.id)||0})">حذف</button></td></tr>`).join('') || '<tr><td colspan="6">لا توجد حركات لهذا المورد</td></tr>';
    const expenseRows=expenses.map(e=>`<tr><td>${esc(e.expense_date||e.date||'-')}</td><td>${esc(e.description||'-')}</td><td>${money(e.total||e.amount)}</td><td class="fin-actions"><button class="light" onclick="financeProShowExpenseV15(${Number(e.id)||0})">عرض</button><button class="danger" onclick="financeProDeleteExpenseV15(${Number(e.id)||0})">حذف</button></td></tr>`).join('') || '<tr><td colspan="4">لا توجد مصروفات لهذا المورد</td></tr>';
    openPagedModalV15('بيانات المورد: '+supplier, [
      {title:'المنتجات', html:`<div class="fin-table"><table><thead><tr><th>المنتج</th><th>الكود</th><th>الكمية</th><th>الوحدة</th><th>التكلفة</th><th>إجراء</th></tr></thead><tbody>${itemRows}</tbody></table></div>`},
      {title:'الحركات', html:`<div class="fin-table"><table><thead><tr><th>التاريخ</th><th>المنتج</th><th>النوع</th><th>الكمية</th><th>القيمة</th><th>إجراء</th></tr></thead><tbody>${moveRows}</tbody></table></div>`},
      {title:'المصروفات', html:`<div class="fin-table"><table><thead><tr><th>التاريخ</th><th>الوصف</th><th>المبلغ</th><th>إجراء</th></tr></thead><tbody>${expenseRows}</tbody></table></div>`}
    ]);
  };

  window.financeProDeleteSupplierV15 = async function(name){
    try{
      const supplier=S(name);
      if(!supplier) return;
      if(!confirm('حذف اسم المورد من المنتجات والمصروفات؟ لن يتم حذف المنتجات نفسها.')) return;
      if(window.sb){
        const a=await sb.from('inventory_items').update({supplier:''}).eq('supplier', supplier);
        if(a.error) throw a.error;
        const b=await sb.from('finance_expenses').update({supplier:''}).eq('supplier', supplier);
        if(b.error) console.warn(b.error);
      }
      await loadAll(true);
      renderShell();
      if(typeof msg==='function') msg('تم حذف اسم المورد من السجلات');
    }catch(e){ alert(e.message||String(e)); if(typeof msg==='function') msg(e.message||String(e),'err'); }
  };

  window.financeProShowExpenseV15 = function(id){
    const e=state.expenses.find(x=>Number(x.id)===Number(id)); if(!e) return;
    openPagedModalV15('تفاصيل المصروف', [
      {title:'البيانات', html:`<div class="fin-grid three"><div class="fin-card"><h3>التاريخ</h3><b>${esc(e.expense_date||e.date||'-')}</b></div><div class="fin-card"><h3>المركز</h3><b>${esc(e.category||e.cost_center||'-')}</b></div><div class="fin-card"><h3>المشروع</h3><b>${esc(e.project_name||'-')}</b></div></div>`},
      {title:'المبالغ', html:`<div class="fin-grid three"><div class="fin-card fin-kpi"><small>قبل الضريبة</small><b>${money(e.subtotal||e.before_vat||e.amount)}</b></div><div class="fin-card fin-kpi"><small>الضريبة</small><b>${money(e.vat||e.tax)}</b></div><div class="fin-card fin-kpi"><small>بعد الضريبة</small><b>${money(e.total||e.after_vat||e.amount)}</b></div></div>`},
      {title:'الملاحظات', html:`<div class="fin-soft">${esc(e.notes||'-')}</div>`}
    ]);
  };

  window.financeProDeleteExpenseV15 = async function(id){
    try{
      if(!id) return;
      if(!confirm('حذف هذا المصروف؟')) return;
      const res=await sb.from('finance_expenses').delete().eq('id', id);
      if(res.error) throw res.error;
      await loadAll(true);
      renderShell();
      if(typeof msg==='function') msg('تم حذف المصروف');
    }catch(e){ alert(e.message||String(e)); if(typeof msg==='function') msg(e.message||String(e),'err'); }
  };

  window.financeProDeleteMovementV15 = async function(id){
    try{
      const m=state.movements.find(x=>Number(x.id)===Number(id));
      if(!m) return;
      if(!confirm('حذف حركة المخزون؟ سيتم عكس أثرها على رصيد المنتج.')) return;
      const item=state.items.find(i=>String(i.id)===String(m.item_id));
      if(item){
        const next=N(item.quantity)-movementStockDeltaV15(m);
        const upd=await sb.from('inventory_items').update({quantity:next}).eq('id', item.id);
        if(upd.error) throw upd.error;
      }
      const res=await sb.from('inventory_movements').delete().eq('id', id);
      if(res.error) throw res.error;
      await loadAll(true);
      renderShell();
      if(typeof msg==='function') msg('تم حذف الحركة وتحديث الرصيد');
    }catch(e){ alert(e.message||String(e)); if(typeof msg==='function') msg(e.message||String(e),'err'); }
  };

  window.financeProCalcExpenseV15 = calcExpense;
  function calcExpense(){
    const net=N($('finCostNetV15')?.value);
    if($('finCostVatV15')) $('finCostVatV15').value=(net*VAT_RATE).toFixed(2);
    if($('finCostGrossV15')) $('finCostGrossV15').value=(net*(1+VAT_RATE)).toFixed(2);
  }
  window.financeProSaveExpenseV15 = async function(btn){
    try{
      if(btn) btn.disabled=true;
      if(!window.sb) throw new Error('الاتصال غير جاهز');
      const center=S($('finCostCenterV15')?.value)||'GENERAL';
      const net=N($('finCostNetV15')?.value);
      if(net<=0) throw new Error('قيمة المصروف قبل الضريبة مطلوبة');
      const pid=S($('finCostProjectV15')?.value);
      const desc=S($('finCostDescV15')?.value)||center;
      const vat=net*VAT_RATE, gross=net+vat;
      const row={expense_date:S($('finCostDateV15')?.value)||today(),category:center,description:desc,supplier:desc,project_id:pid?Number(pid):null,project_name:pid?projectName(pid):'',subtotal:+net.toFixed(2),vat:+vat.toFixed(2),total:+gross.toFixed(2),amount:+gross.toFixed(2),notes:`${S($('finCostNoteV15')?.value)} | order:${S($('finCostOrderV15')?.value)} | center:${center}`};
      const res=await sb.from('finance_expenses').insert(row);
      if(res.error) throw res.error;
      await loadAll(true);
      renderShell();
      if(typeof msg==='function') msg('تم حفظ مصروف مركز التكلفة');
    }catch(e){ alert(e.message||String(e)); if(typeof msg==='function') msg(e.message||String(e),'err'); }
    finally{ if(btn) btn.disabled=false; }
  };

  function patchShowPage(){
    if(window.__financeProShowPagePatchedV15) return;
    window.__financeProShowPagePatchedV15=true;
    const old=window.showPage;
    window.showPage=function(id,btn){
      if(id==='financeDashboard'){
        ensurePage();
        removeLegacyFinanceShortcuts();
        document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));
        $('financeDashboard')?.classList.remove('hidden');
        document.querySelectorAll('.nav').forEach(n=>n.classList.remove('active'));
        btn?.classList.add('active');
        loadAll(false).then(renderShell);
        return;
      }
      return typeof old==='function' ? old(id,btn) : undefined;
    };
    try{ showPage=window.showPage; }catch(e){}
  }

  function patchFinanceTabClicks(){
    if(window.__financeProTabClicksPatchedV15) return;
    window.__financeProTabClicksPatchedV15=true;
    document.addEventListener('click', function(ev){
      const btn=ev.target && ev.target.closest ? ev.target.closest('#finTabsV15 button[data-fin-tab-v15]') : null;
      if(!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      window.financeProTabV15(btn.getAttribute('data-fin-tab-v15') || 'summary');
    }, true);
  }

  function boot(){
    ensurePage();
    patchShowPage();
    patchFinanceTabClicks();
    keepLegacyFinanceShortcutsHidden();
    if(!window.__financeProLegacyHideIntervalV15){
      let tries=0;
      window.__financeProLegacyHideIntervalV15=setInterval(()=>{
        keepLegacyFinanceShortcutsHidden();
        tries++;
        if(tries>8) clearInterval(window.__financeProLegacyHideIntervalV15);
      },700);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('load', boot);
  console.log('Tasneef '+VERSION+' loaded');
})();


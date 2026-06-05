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
    distribution: []
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
  const activeUsers = ()=>state.users.filter(u=>S(u.status || 'active') !== 'inactive');
  const supervisors = ()=>activeUsers().filter(u=>['supervisor','manager','operational_manager','مشرف','مدير تشغيلي','مدير عام'].includes(S(u.role)));
  const technicians = ()=>activeUsers().filter(u=>['technician','فني'].includes(S(u.role)));
  const staff = ()=>[...supervisors(), ...technicians()].filter((u,idx,arr)=>arr.findIndex(x=>String(x.id)===String(u.id))===idx);
  const projectName = (id)=>state.projects.find(p=>String(p.id)===String(id))?.name || state.projects.find(p=>String(p.id)===String(id))?.project_name || '';
  const staffName = (id)=>state.users.find(u=>String(u.id)===String(id))?.full_name || state.users.find(u=>String(u.id)===String(id))?.name || state.users.find(u=>String(u.id)===String(id))?.username || '';

  function vatFromNet(net){ const n=N(net); return {net:n, vat:n*VAT_RATE, gross:n*(1+VAT_RATE)}; }
  function rowVat(qty, price){ const c=vatFromNet(N(qty)*N(price)); return c; }
  function safeJson(value){
    const txt = S(value);
    if(!txt.startsWith('finance_pro_v15:')) return null;
    try{ return JSON.parse(txt.replace('finance_pro_v15:','')); }catch(e){ return null; }
  }
  async function table(name, select='*', limit=3000){
    try{
      if(!window.sb) return [];
      const res = await sb.from(name).select(select).limit(limit);
      if(res.error) return [];
      return A(res.data);
    }catch(e){ return []; }
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
      const blocked = ['الأصناف', 'الموردين', 'تعديل التكلفة'];
      document.querySelectorAll('button,a').forEach(el => {
        if(el.closest('.fin-shell')) return;
        const text = S(el.textContent).replace(/\s+/g, ' ');
        if(blocked.some(word => text === word || text.includes(word))){
          el.style.display = 'none';
          el.setAttribute('aria-hidden', 'true');
          el.dataset.financeProHiddenV15 = '1';
        }
      });
    }catch(e){}
  }

  function renderShell(){
    removeLegacyFinanceShortcuts();
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
          ${[
            ['summary','ملخص'],
            ['products','منتجات'],
            ['suppliers','الموردين'],
            ['add','إضافة إلى المخزون'],
            ['movement','حركة المخزون'],
            ['cost','مركز تكلفة'],
            ['reports','تقارير']
          ].map(([id,label])=>`<button class="${state.tab===id?'active':''}" onclick="financeProTabV15('${id}')">${label}</button>`).join('')}
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
    state.loaded=true;
  }

  function lowItems(){
    return state.items.filter(i=>N(i.quantity)>0 && N(i.quantity)<=N(i.min_quantity || i.reorder_level || 1));
  }
  function stockValue(){
    return state.items.reduce((s,i)=>s + Math.max(0,N(i.quantity))*itemCost(i),0);
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
    state.items.forEach(i=>{ if(S(i.supplier)) set.add(S(i.supplier)); });
    state.movements.forEach(m=>{
      const type=S(m.movement_type);
      if(type==='in' && S(m.receiver)) set.add(S(m.receiver));
    });
    state.expenses.forEach(e=>{ if(S(e.supplier)) set.add(S(e.supplier)); });
    return [...set].sort((a,b)=>a.localeCompare(b,'ar'));
  }
  function movementsFinancial(){
    return state.movements.reduce((acc,m)=>{
      const qty=N(m.quantity), cost=N(m.unit_cost), type=S(m.movement_type);
      if(type==='return') return acc;
      const net=qty*cost;
      acc.net += net; acc.vat += net*VAT_RATE; acc.gross += net*(1+VAT_RATE);
      return acc;
    },{net:0,vat:0,gross:0});
  }

  function renderBody(){
    const body=$('finBodyV15'); if(!body) return;
    if(!state.loaded){ body.innerHTML='<div class="fin-card">جاري تحميل بيانات المالية والمخزون...</div>'; return; }
    if(state.tab==='summary') return renderSummary(body);
    if(state.tab==='products') return renderProducts(body);
    if(state.tab==='suppliers') return renderSuppliers(body);
    if(state.tab==='add') return renderAddStock(body);
    if(state.tab==='movement') return renderMovement(body);
    if(state.tab==='cost') return renderCostCenter(body);
    if(state.tab==='reports') return renderReports(body);
  }

  function renderSummary(body){
    const fin=movementsFinancial();
    body.innerHTML=`
      <div class="fin-grid">
        <div class="fin-card fin-kpi"><small>عدد المنتجات</small><b>${state.items.length}</b></div>
        <div class="fin-card fin-kpi"><small>قيمة المخزون الحالية</small><b>${money(stockValue())}</b></div>
        <div class="fin-card fin-kpi"><small>أصناف قاربت الانتهاء</small><b>${lowItems().length}</b></div>
        <div class="fin-card fin-kpi"><small>إجمالي بعد الضريبة للحركات</small><b>${money(fin.gross)}</b></div>
      </div>
      <div class="fin-card">
        <h3>الأصناف التي سوف تنتهي</h3>
        <div class="fin-table"><table><thead><tr><th>المنتج</th><th>الكود</th><th>المتوفر</th><th>الحد الأدنى</th><th>التكلفة</th><th>الحالة</th></tr></thead><tbody>
          ${lowItems().map(i=>`<tr><td><b>${esc(i.name)}</b></td><td>${esc(itemCode(i)||'-')}</td><td>${N(i.quantity)}</td><td>${N(i.min_quantity || i.reorder_level || 1)}</td><td>${money(itemCost(i))}</td><td><span class="fin-badge warn">قارب الانتهاء</span></td></tr>`).join('') || '<tr><td colspan="6">لا توجد أصناف قاربت الانتهاء</td></tr>'}
        </tbody></table></div>
      </div>
      <div class="fin-grid three">
        <div class="fin-card fin-kpi"><small>قبل الضريبة</small><b>${money(fin.net)}</b></div>
        <div class="fin-card fin-kpi"><small>الضريبة 15%</small><b>${money(fin.vat)}</b></div>
        <div class="fin-card fin-kpi"><small>بعد الضريبة</small><b>${money(fin.gross)}</b></div>
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
      if(q && !hay.includes(q)) return false;
      if(st==='available' && N(i.quantity)<=N(i.min_quantity || i.reorder_level || 1)) return false;
      if(st==='low' && !(N(i.quantity)>0 && N(i.quantity)<=N(i.min_quantity || i.reorder_level || 1))) return false;
      if(st==='zero' && N(i.quantity)!==0) return false;
      if(unit && S(i.unit)!==unit) return false;
      if(type && productType(i)!==type) return false;
      return true;
    });
    box.innerHTML=`<div class="fin-report-cards">${rows.map(i=>{
      const low=N(i.quantity)>0 && N(i.quantity)<=N(i.min_quantity || i.reorder_level || 1);
      const zero=N(i.quantity)===0;
      return `<div class="fin-product-card">
        ${i.image_url ? `<img class="fin-thumb" src="${esc(i.image_url)}" alt="">` : ''}
        <h4>${esc(i.name || '-')}</h4>
        <span class="fin-badge ${zero?'bad':low?'warn':''}">${zero?'رصيد صفر':low?'قارب الانتهاء':'متوفر'}</span>
        <div class="fin-meta">
          <div><small>الكود</small><b>${esc(itemCode(i)||'-')}</b></div>
          <div><small>الوحدة</small><b>${esc(i.unit||'-')}</b></div>
          <div><small>النوع</small><b>${esc(productType(i))}</b></div>
          <div><small>الكمية</small><b>${N(i.quantity)}</b></div>
          <div><small>سعر قبل الضريبة</small><b>${money(itemCost(i))}</b></div>
          <div><small>الضريبة للوحدة</small><b>${money(itemCost(i)*VAT_RATE)}</b></div>
          <div><small>بعد الضريبة للوحدة</small><b>${money(itemCost(i)*(1+VAT_RATE))}</b></div>
        </div>
        <div class="fin-card-actions"><button class="light" onclick="financeProShowProductV15('${esc(i.id)}')">عرض البيانات</button><button class="danger" onclick="financeProDeleteProductV15('${esc(i.id)}')">حذف</button></div>
      </div>`;
    }).join('') || '<div class="fin-soft">لا توجد منتجات حسب الفلتر.</div>'}</div>`;
  }

  function renderSuppliers(body){
    const suppliers=supplierList();
    body.innerHTML=`
      <div class="fin-card">
        <h3>الموردين</h3>
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
    box.innerHTML=`<div class="fin-table"><table><thead><tr><th>المورد</th><th>عدد المنتجات</th><th>إضافات المخزون</th><th>آخر تعامل</th><th>قيمة قبل الضريبة</th><th>بعد الضريبة</th></tr></thead><tbody>
      ${suppliers.map(s=>{
        const items=state.items.filter(i=>S(i.supplier)===s);
        const moves=state.movements.filter(m=>S(m.receiver)===s && S(m.movement_type)==='in');
        const net=moves.reduce((a,m)=>a+N(m.quantity)*N(m.unit_cost),0);
        const last=moves.map(m=>S(m.movement_date||m.created_at).slice(0,10)).sort().pop() || '-';
        return `<tr><td><b>${esc(s)}</b></td><td>${items.length}</td><td>${moves.length}</td><td>${esc(last)}</td><td>${money(net)}</td><td>${money(net*(1+VAT_RATE))}</td></tr>`;
      }).join('') || '<tr><td colspan="6">لا توجد موردين حتى الآن</td></tr>'}
    </tbody></table></div>`;
  }

  function renderAddStock(body){
    body.innerHTML=`
      <div class="fin-card">
        <h3>فاتورة إضافة مخزون</h3>
        <div class="fin-grid three">
          <div><label>المورد</label><input id="finInvSupplierV15" placeholder="اسم المورد"></div>
          <div><label>رقم الفاتورة</label><input id="finInvNoV15" placeholder="INV-001"></div>
          <div><label>تاريخ الفاتورة</label><input id="finInvDateV15" type="date" value="${today()}"></div>
        </div>
        <div class="fin-line">
          <div><label>اسم المنتج</label><input id="finLineNameV15" placeholder="اسم المنتج"></div>
          <div><label>الكود</label><input id="finLineCodeV15" placeholder="كود المنتج"></div>
          <div><label>الكمية</label><input id="finLineQtyV15" type="number" min="0" step="0.01"></div>
          <div><label>سعر قبل الضريبة</label><input id="finLinePriceV15" type="number" min="0" step="0.01"></div>
          <div><label>الوحدة</label><select id="finLineUnitV15"><option>حبة</option><option>كرتون</option><option>علبة</option><option>لتر</option><option>كيلو</option><option>متر</option><option>رول</option><option>طقم</option><option>غير</option></select></div>
          <button onclick="financeProAddInvoiceLineV15()">إضافة</button>
        </div>
        <div class="fin-grid three">
          <div><label>نوع المنتج</label><select id="finLineTypeV15"><option value="مادة">مادة</option><option value="عدة">عدة</option><option value="غير">غير</option></select></div>
          <div><label>صورة المنتج</label><input id="finLineImageV15" type="file" accept="image/*" onchange="financeProReadLineImageV15(this)"></div>
          <div class="fin-soft" id="finLineImageNameV15">لم يتم اختيار صورة</div>
        </div>
        <div id="finInvoiceLinesV15"></div>
        <div class="fin-actions"><button onclick="financeProSaveInvoiceV15(this)">حفظ الفاتورة وتحديث المخزون</button><button class="light" onclick="financeProClearInvoiceV15()">تفريغ</button></div>
      </div>`;
    renderInvoiceLines();
  }

  function renderInvoiceLines(){
    const box=$('finInvoiceLinesV15'); if(!box) return;
    const total=state.invoiceLines.reduce((a,l)=>{ const c=rowVat(l.qty,l.price); a.net+=c.net; a.vat+=c.vat; a.gross+=c.gross; return a; },{net:0,vat:0,gross:0});
    box.innerHTML=`
      <div class="fin-table"><table><thead><tr><th>المنتج</th><th>الكود</th><th>النوع</th><th>الكمية</th><th>الوحدة</th><th>قبل الضريبة</th><th>الضريبة</th><th>بعد الضريبة</th><th>إجراء</th></tr></thead><tbody>
      ${state.invoiceLines.map((l,idx)=>{ const c=rowVat(l.qty,l.price); return `<tr><td>${l.image?`<img src="${esc(l.image)}" style="width:34px;height:34px;object-fit:contain;border-radius:8px;border:1px solid #d9e7e2;background:#fff;margin-left:6px">`:''}${esc(l.name)}</td><td>${esc(l.code)}</td><td>${esc(l.item_type||'مادة')}</td><td>${N(l.qty)}</td><td>${esc(l.unit||'حبة')}</td><td>${money(c.net)}</td><td>${money(c.vat)}</td><td>${money(c.gross)}</td><td><button class="danger" onclick="financeProRemoveInvoiceLineV15(${idx})">حذف</button></td></tr>`; }).join('') || '<tr><td colspan="9">أضف منتجات الفاتورة هنا.</td></tr>'}
      </tbody></table></div>
      <div class="fin-grid three" style="margin-top:10px"><div class="fin-soft">قبل الضريبة: <b>${money(total.net)}</b></div><div class="fin-soft">الضريبة: <b>${money(total.vat)}</b></div><div class="fin-soft">بعد الضريبة: <b>${money(total.gross)}</b></div></div>`;
  }

  function renderMovement(body){
    body.innerHTML=`
      <div class="fin-card">
        <h3>صرف منتج وتوزيع استهلاكه</h3>
        <div class="fin-grid three">
          <div><label>المنتج</label><select id="finMoveItemV15">${state.items.filter(i=>N(i.quantity)>0).map(i=>`<option value="${esc(i.id)}">${esc(i.name)} - المتوفر ${N(i.quantity)}</option>`).join('')}</select></div>
          <div><label>المستلم</label><select id="finMoveStaffV15">${staff().map(u=>`<option value="${esc(u.id)}">${esc(u.full_name||u.name||u.username)} - ${esc(u.role||'')}</option>`).join('')}</select></div>
          <div><label>النوع</label><select id="finMoveTypeV15"><option value="out">صرف</option><option value="return">مرتجع</option></select></div>
          <div><label>الكمية</label><input id="finMoveQtyV15" type="number" min="0" step="0.01"></div>
          <div><label>التاريخ</label><input id="finMoveDateV15" type="date" value="${today()}"></div>
          <div><label>ملاحظة</label><input id="finMoveNoteV15" placeholder="ملاحظة الحركة"></div>
        </div>
        <h3 style="margin-top:16px">توزيع الاستهلاك على المشاريع / الأوردرات</h3>
        <div class="fin-line dist">
          <div><label>مركز التكلفة</label><select id="finDistCenterV15"><option value="FM">FM - مشاريع وأوردرات</option><option value="CN">CN - أوردرات</option><option value="GENERAL">GENERAL - إداري</option></select></div>
          <div><label>المشروع</label><select id="finDistProjectV15"><option value="">بدون مشروع</option>${state.projects.map(p=>`<option value="${esc(p.id)}">${esc(p.name||p.project_name)}</option>`).join('')}</select></div>
          <div><label>رقم الأوردر</label><input id="finDistOrderV15" placeholder="اختياري"></div>
          <div><label>الكمية</label><input id="finDistQtyV15" type="number" min="0" step="0.01"></div>
          <div><label>ملاحظة</label><input id="finDistNoteV15" placeholder="ملاحظة"></div>
          <button onclick="financeProAddDistributionV15()">إضافة توزيع</button>
        </div>
        <div id="finDistributionBoxV15"></div>
        <div class="fin-actions"><button onclick="financeProSaveMovementV15(this)">حفظ الحركة</button><button class="light" onclick="financeProClearDistributionV15()">تفريغ التوزيع</button></div>
      </div>
      <div class="fin-card">
        <h3>آخر حركات المخزون</h3>
        <div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>المنتج</th><th>الكمية</th><th>المستلم</th><th>مركز التكلفة</th><th>إجراء</th></tr></thead><tbody>
        ${state.movements.slice().reverse().slice(0,80).map(m=>{ const meta=safeJson(m.notes)||{}; return `<tr><td>${esc(m.movement_date||'')}</td><td>${esc(m.movement_type||'')}</td><td>${esc(m.item_name||'')}</td><td>${N(m.quantity)}</td><td>${esc(m.receiver||'')}</td><td>${esc(A(meta.distribution).map(d=>d.center).filter(Boolean).join(', ')||'-')}</td><td><button class="light" onclick="financeProShowMovementV15(${Number(m.id)||0})">عرض</button></td></tr>`; }).join('') || '<tr><td colspan="7">لا توجد حركات</td></tr>'}
        </tbody></table></div>
      </div>`;
    renderDistribution();
  }

  function renderDistribution(){
    const box=$('finDistributionBoxV15'); if(!box) return;
    const total=state.distribution.reduce((s,d)=>s+N(d.qty),0);
    box.innerHTML=`<div class="fin-table"><table><thead><tr><th>مركز التكلفة</th><th>المشروع</th><th>الأوردر</th><th>الكمية</th><th>ملاحظة</th><th>إجراء</th></tr></thead><tbody>
      ${state.distribution.map((d,idx)=>`<tr><td>${esc(d.center)}</td><td>${esc(d.projectName||'-')}</td><td>${esc(d.orderNo||'-')}</td><td>${N(d.qty)}</td><td>${esc(d.note||'')}</td><td><button class="danger" onclick="financeProRemoveDistributionV15(${idx})">حذف</button></td></tr>`).join('') || '<tr><td colspan="6">يمكنك توزيع الكمية المصروفة على أكثر من مشروع أو أوردر.</td></tr>'}
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
      <div class="fin-card"><h3>آخر المصروفات</h3><div class="fin-table"><table><thead><tr><th>التاريخ</th><th>المركز</th><th>الوصف</th><th>المشروع</th><th>قبل الضريبة</th><th>الضريبة</th><th>بعد الضريبة</th></tr></thead><tbody>
      ${state.expenses.slice().reverse().slice(0,80).map(e=>`<tr><td>${esc(e.expense_date||e.date||'')}</td><td>${esc(e.category||e.cost_center||'')}</td><td>${esc(e.description||e.supplier||'-')}</td><td>${esc(e.project_name||'')}</td><td>${money(e.subtotal||e.before_vat||e.amount)}</td><td>${money(e.vat||e.tax)}</td><td>${money(e.total||e.after_vat||e.amount)}</td></tr>`).join('') || '<tr><td colspan="7">لا توجد مصروفات</td></tr>'}
      </tbody></table></div></div>`;
    calcExpense();
  }

  function renderReports(body){
    const products=state.items.filter(i=>N(i.quantity)>0);
    const outs=state.movements.filter(m=>S(m.movement_type)!=='return' && N(m.quantity)>0);
    body.innerHTML=`
      <div class="fin-grid three">
        <div class="fin-card fin-kpi"><small>منتجات تظهر في التقرير</small><b>${products.length}</b></div>
        <div class="fin-card fin-kpi"><small>حركات بدون مرتجعات</small><b>${outs.length}</b></div>
        <div class="fin-card fin-kpi"><small>قيمة المنتجات بعد الضريبة</small><b>${money(stockValue()*(1+VAT_RATE))}</b></div>
      </div>
      <div class="fin-card">
        <h3>تقرير المنتجات</h3>
        <p class="fin-soft">المنتج المرتجع لا يظهر في تقرير الصرف، والمنتج الذي رصيده صفر لا يظهر في تقرير المنتجات.</p>
        <div class="fin-table"><table><thead><tr><th>المنتج</th><th>الكود</th><th>الكمية</th><th>قبل الضريبة</th><th>الضريبة</th><th>بعد الضريبة</th></tr></thead><tbody>
        ${products.map(i=>{ const net=N(i.quantity)*itemCost(i); return `<tr><td>${esc(i.name)}</td><td>${esc(itemCode(i)||'-')}</td><td>${N(i.quantity)}</td><td>${money(net)}</td><td>${money(net*VAT_RATE)}</td><td>${money(net*(1+VAT_RATE))}</td></tr>`; }).join('') || '<tr><td colspan="6">لا توجد منتجات برصيد متاح</td></tr>'}
        </tbody></table></div>
      </div>
      <div class="fin-card"><h3>تقرير حركات الصرف حسب مركز التكلفة</h3><div class="fin-table"><table><thead><tr><th>التاريخ</th><th>المنتج</th><th>الكمية</th><th>المستلم</th><th>مركز التكلفة</th><th>قبل الضريبة</th><th>الضريبة</th><th>بعد الضريبة</th></tr></thead><tbody>
      ${outs.map(m=>{ const meta=safeJson(m.notes)||{}; const centers=A(meta.distribution).map(d=>d.center).join(', ') || '-'; const net=N(m.quantity)*N(m.unit_cost); return `<tr><td>${esc(m.movement_date||'')}</td><td>${esc(m.item_name||'')}</td><td>${N(m.quantity)}</td><td>${esc(m.receiver||'')}</td><td>${esc(centers)}</td><td>${money(net)}</td><td>${money(net*VAT_RATE)}</td><td>${money(net*(1+VAT_RATE))}</td></tr>`; }).join('') || '<tr><td colspan="8">لا توجد حركات صرف</td></tr>'}
      </tbody></table></div></div>`;
  }

  function findItem(line){
    const code=S(line.code);
    return state.items.find(i=>code && [i.product_code,i.serial_number,i.barcode,i.supplier_barcode,i.code].map(S).includes(code))
      || state.items.find(i=>S(i.name).toLowerCase()===S(line.name).toLowerCase());
  }

  window.financeProTabV15 = async function(tab){
    state.tab=tab;
    renderShell();
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

  window.financeProAddInvoiceLineV15 = function(){
    const line={ name:S($('finLineNameV15')?.value), code:S($('finLineCodeV15')?.value), qty:N($('finLineQtyV15')?.value), price:N($('finLinePriceV15')?.value), unit:S($('finLineUnitV15')?.value)||'حبة', item_type:S($('finLineTypeV15')?.value)||'مادة', image:S(window.__financeProLineImageV15||'') };
    if(!line.name) return alert('اسم المنتج مطلوب');
    if(line.qty<=0) return alert('الكمية مطلوبة');
    if(line.price<0) return alert('السعر غير صحيح');
    state.invoiceLines.push(line);
    ['finLineNameV15','finLineCodeV15','finLineQtyV15','finLinePriceV15'].forEach(id=>{ if($(id)) $(id).value=''; });
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
        const q=N(l.qty), cost=N(l.price);
        if(old){
          const oldQty=N(old.quantity), oldCost=itemCost(old), newQty=oldQty+q;
          const avg=newQty>0 ? ((oldQty*oldCost)+(q*cost))/newQty : cost;
          const upd={quantity:newQty, unit_cost:+avg.toFixed(4), supplier:supplier||old.supplier, unit:l.unit||old.unit, item_type:l.item_type||old.item_type, type:l.item_type||old.type, product_code:l.code||old.product_code, serial_number:l.code||old.serial_number, barcode:l.code||old.barcode};
          if(l.image) upd.image_url = l.image;
          const res=await sb.from('inventory_items').update(upd).eq('id',old.id).select('*').single();
          if(res.error) throw res.error;
          item=res.data;
        }else{
          const ins={name:l.name, product_code:l.code, serial_number:l.code, barcode:l.code, supplier_barcode:l.code, image_url:l.image||'', unit:l.unit||'حبة', item_type:l.item_type||'مادة', type:l.item_type||'مادة', quantity:q, min_quantity:1, unit_cost:+cost.toFixed(4), supplier, category:l.item_type||'عام', notes:'تمت الإضافة من فاتورة '+invoiceNo};
          const res=await sb.from('inventory_items').insert(ins).select('*').single();
          if(res.error) throw res.error;
          item=res.data;
        }
        const c=rowVat(q,cost);
        const meta={module:VERSION, invoiceNo, supplier, beforeVat:c.net, vat:c.vat, afterVat:c.gross};
        const mv={item_id:item.id,item_name:item.name,movement_type:'in',quantity:q,movement_date:date,receiver:supplier,reason:'إضافة مخزون - فاتورة '+invoiceNo,notes:'finance_pro_v15:'+JSON.stringify(meta),product_code:l.code,barcode:l.code,unit_cost:+cost.toFixed(4)};
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

  window.financeProAddDistributionV15 = function(){
    const center=S($('finDistCenterV15')?.value)||'FM';
    const pid=S($('finDistProjectV15')?.value);
    const qty=N($('finDistQtyV15')?.value);
    if(qty<=0) return alert('كمية التوزيع مطلوبة');
    state.distribution.push({center, projectId:pid||null, projectName:pid?projectName(pid):'', orderNo:S($('finDistOrderV15')?.value), qty, note:S($('finDistNoteV15')?.value)});
    ['finDistOrderV15','finDistQtyV15','finDistNoteV15'].forEach(id=>{ if($(id)) $(id).value=''; });
    renderDistribution();
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
      if(type==='out' && N(item.quantity)<qty) throw new Error('الكمية المتوفرة لا تكفي');
      const distTotal=state.distribution.reduce((s,d)=>s+N(d.qty),0);
      if(type==='out' && state.distribution.length && Math.abs(distTotal-qty)>.001) throw new Error('إجمالي التوزيع يجب أن يساوي كمية الصرف');
      const staffId=S($('finMoveStaffV15')?.value);
      const meta={module:VERSION, staffId, note:S($('finMoveNoteV15')?.value), distribution:state.distribution};
      const mv={item_id:item.id,item_name:item.name,movement_type:type,quantity:qty,movement_date:S($('finMoveDateV15')?.value)||today(),receiver:staffName(staffId),reason:type==='return'?'مرتجع مخزون':'صرف مخزون',notes:'finance_pro_v15:'+JSON.stringify(meta),product_code:itemCode(item),barcode:itemCode(item),unit_cost:+itemCost(item).toFixed(4)};
      const res=await sb.from('inventory_movements').insert(mv);
      if(res.error) throw res.error;
      const newQty=type==='return' ? N(item.quantity)+qty : N(item.quantity)-qty;
      const ur=await sb.from('inventory_items').update({quantity:newQty}).eq('id',item.id);
      if(ur.error) throw ur.error;
      state.distribution=[];
      await loadAll(true);
      renderShell();
      if(typeof msg==='function') msg('تم حفظ حركة المخزون وتوزيع مركز التكلفة');
    }catch(e){ alert(e.message||String(e)); if(typeof msg==='function') msg(e.message||String(e),'err'); }
    finally{ if(btn) btn.disabled=false; }
  };

  window.financeProShowMovementV15 = function(id){
    const m=state.movements.find(x=>Number(x.id)===Number(id)); if(!m) return;
    const meta=safeJson(m.notes)||{};
    const rows=A(meta.distribution).map(d=>`<tr><td>${esc(d.center)}</td><td>${esc(d.projectName||'-')}</td><td>${esc(d.orderNo||'-')}</td><td>${N(d.qty)}</td><td>${esc(d.note||'')}</td></tr>`).join('') || '<tr><td colspan="5">لا يوجد توزيع محفوظ</td></tr>';
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" onclick="if(event.target===this)this.remove()" style="position:fixed;inset:0;background:rgba(0,35,28,.45);z-index:99999;display:grid;place-items:center;padding:18px"><div class="card" style="width:min(820px,96vw);max-height:90vh;overflow:auto"><div class="fin-actions" style="justify-content:space-between"><h2>تفاصيل حركة المخزون</h2><button class="danger" onclick="this.closest('.modal-backdrop').remove()">إغلاق</button></div><p><b>${esc(m.item_name)}</b> - الكمية ${N(m.quantity)} - المستلم ${esc(m.receiver||'-')}</p><div class="fin-table"><table><thead><tr><th>المركز</th><th>المشروع</th><th>الأوردر</th><th>الكمية</th><th>ملاحظة</th></tr></thead><tbody>${rows}</tbody></table></div></div></div>`);
  };

  function productMovements(item){
    const code=itemCode(item);
    return state.movements.filter(m =>
      String(m.item_id)===String(item.id) ||
      (code && [m.product_code,m.barcode].map(S).includes(code)) ||
      (!m.item_id && S(m.item_name)===S(item.name))
    );
  }
  function movementRowsHtml(rows){
    return rows.map(m=>{
      const net=N(m.quantity)*N(m.unit_cost || itemCost(state.items.find(i=>String(i.id)===String(m.item_id))));
      return `<tr><td>${esc(m.movement_date||S(m.created_at).slice(0,10)||'-')}</td><td>${esc(m.movement_type||'-')}</td><td>${N(m.quantity)}</td><td>${esc(m.receiver||'-')}</td><td>${esc(m.project_name||'-')}</td><td>${esc(m.reason||'-')}</td><td>${money(net)}</td></tr>`;
    }).join('') || '<tr><td colspan="7">لا توجد بيانات</td></tr>';
  }
  window.financeProShowProductV15 = function(id){
    const item=state.items.find(i=>String(i.id)===String(id)); if(!item) return;
    const moves=productMovements(item);
    const ins=moves.filter(m=>S(m.movement_type)==='in');
    const outs=moves.filter(m=>['out','consume'].includes(S(m.movement_type)));
    const returns=moves.filter(m=>S(m.movement_type)==='return');
    const inQty=ins.reduce((a,m)=>a+N(m.quantity),0);
    const outQty=outs.reduce((a,m)=>a+N(m.quantity),0);
    const returnQty=returns.reduce((a,m)=>a+N(m.quantity),0);
    const consumed=Math.max(0,outQty-returnQty);
    const img=item.image_url?`<img src="${esc(item.image_url)}" style="width:96px;height:96px;object-fit:contain;border:1px solid #d9e7e2;border-radius:16px;background:#fff;padding:4px">`:'';
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

  function boot(){
    ensurePage();
    patchShowPage();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('load', boot);
  console.log('Tasneef '+VERSION+' loaded');
})();

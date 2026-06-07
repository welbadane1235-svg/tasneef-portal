(function(){
  'use strict';
  if(window.__tasneefWarehouseManagerStableV46) return;
  window.__tasneefWarehouseManagerStableV46 = true;

  const S = v => String(v ?? '').trim();
  const WAREHOUSE_PERMS = [
    'can_dashboard','can_expenses_inventory','can_manage_inventory','can_inventory_requests',
    'can_edit_inventory_requests','can_delete_inventory_requests',
    'tab_financeDashboard_view','tab_financeDashboard_add','tab_financeDashboard_edit','tab_financeDashboard_delete','tab_financeDashboard_print',
    'tab_products_view','tab_products_add','tab_products_edit','tab_products_delete','tab_products_print',
    'tab_movement_view','tab_movement_add','tab_movement_edit','tab_movement_delete','tab_movement_print',
    'tab_reports_view','tab_reports_add','tab_reports_edit','tab_reports_delete','tab_reports_print'
  ];

  function user(){
    try{ return JSON.parse(localStorage.getItem('tasneef_user') || '{}') || {}; }
    catch(_){ return {}; }
  }
  function parsePerms(value){
    if(!value) return {};
    if(typeof value === 'object') return value || {};
    try{ return JSON.parse(value) || {}; }catch(_){ return {}; }
  }
  function isWarehouse(){
    return S(user().role) === 'warehouse_manager';
  }
  function page(){
    return document.getElementById('financeDashboard');
  }
  function visible(){
    const p = page();
    return !!p && !p.classList.contains('hidden');
  }
  function hasPro(){
    const p = page();
    return !!p && !!p.querySelector('#finTabsV15') && !!p.querySelector('#finBodyV15');
  }
  function elevateSession(){
    const u = user();
    if(S(u.role) !== 'warehouse_manager') return;
    const perms = parsePerms(u.permissions);
    WAREHOUSE_PERMS.forEach(k => perms[k] = true);
    const next = Object.assign({}, u, { permissions: perms });
    try{ localStorage.setItem('tasneef_user', JSON.stringify(next)); }catch(_){}
    try{ localStorage.setItem('tasneef_session', JSON.stringify(next)); }catch(_){}
    try{
      if(window.data && Array.isArray(window.data.users)){
        window.data.users = window.data.users.map(row => S(row.id) === S(next.id) ? Object.assign({}, row, {permissions: perms}) : row);
      }
    }catch(_){}
  }
  function style(){
    if(document.getElementById('warehouseManagerStableStyleV46')) return;
    const st = document.createElement('style');
    st.id = 'warehouseManagerStableStyleV46';
    st.textContent = `
      body.warehouse-manager-stable-v46 #financeDashboard:not(.hidden){display:block!important;visibility:visible!important;opacity:1!important}
      body.warehouse-manager-stable-v46 #financeDashboard .fin-shell{display:grid!important;visibility:visible!important;opacity:1!important}
      body.warehouse-manager-stable-v46 #financeDashboard > .finance-tabs,
      body.warehouse-manager-stable-v46 #financeDashboard > .finance-tab-page,
      body.warehouse-manager-stable-v46 #financeDashboard > [id^="financeTab"]{display:none!important}
      body.warehouse-manager-stable-v46 #finTabsV15{display:grid!important;grid-template-columns:repeat(3,minmax(160px,1fr))!important;gap:8px!important}
      body.warehouse-manager-stable-v46 #finTabsV15 button{display:none!important;visibility:hidden!important}
      body.warehouse-manager-stable-v46 #finTabsV15 button[data-fin-tab-v15="products"],
      body.warehouse-manager-stable-v46 #finTabsV15 button[data-fin-tab-v15="movement"],
      body.warehouse-manager-stable-v46 #finTabsV15 button[data-fin-tab-v15="reports"]{display:inline-flex!important;visibility:visible!important;opacity:1!important;justify-content:center}
      body.warehouse-manager-stable-v46 #finBodyV15{display:block!important;visibility:visible!important;opacity:1!important;min-height:260px}
      body.warehouse-manager-stable-v46 #financeDashboard .fin-card,
      body.warehouse-manager-stable-v46 #financeDashboard .fin-table{visibility:visible!important;opacity:1!important}
      body.warehouse-manager-stable-v44 #financeDashboard:not(.hidden){display:block!important;visibility:visible!important;opacity:1!important}
      body.warehouse-manager-stable-v44 #financeDashboard .fin-shell{display:grid!important;visibility:visible!important;opacity:1!important}
      body.warehouse-manager-stable-v44 #financeDashboard > .finance-tabs,
      body.warehouse-manager-stable-v44 #financeDashboard > .finance-tab-page,
      body.warehouse-manager-stable-v44 #financeDashboard > [id^="financeTab"]{display:none!important}
      body.warehouse-manager-stable-v44 #finTabsV15{display:grid!important;grid-template-columns:repeat(3,minmax(160px,1fr))!important;gap:8px!important}
      body.warehouse-manager-stable-v44 #finTabsV15 button{display:none!important;visibility:hidden!important}
      body.warehouse-manager-stable-v44 #finTabsV15 button[data-fin-tab-v15="products"],
      body.warehouse-manager-stable-v44 #finTabsV15 button[data-fin-tab-v15="movement"],
      body.warehouse-manager-stable-v44 #finTabsV15 button[data-fin-tab-v15="reports"]{display:inline-flex!important;visibility:visible!important;opacity:1!important;justify-content:center}
      body.warehouse-manager-stable-v44 #finBodyV15{display:block!important;visibility:visible!important;opacity:1!important;min-height:260px}
      body.warehouse-manager-stable-v44 #financeDashboard .fin-card,
      body.warehouse-manager-stable-v44 #financeDashboard .fin-table{visibility:visible!important;opacity:1!important}
      body.warehouse-manager-stable-v44 #financeDashboard .fin-product-card .fin-meta div:nth-child(5),
      body.warehouse-manager-stable-v44 #financeDashboard .fin-product-card .fin-meta div:nth-child(6),
      body.warehouse-manager-stable-v44 #financeDashboard .fin-product-card .fin-meta div:nth-child(7){display:none!important}
      body.warehouse-manager-stable-v44 .fin-money-hidden-v44{display:none!important}
      body.warehouse-manager-stable-v44 #financeDashboard .fin-hero p::after{content:"";display:block}
      body.warehouse-manager-stable-v46 .wm-report-shell-v7301{display:grid;gap:14px}
      body.warehouse-manager-stable-v46 .wm-report-tabs-v7301{display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:10px;margin:8px 0 14px}
      body.warehouse-manager-stable-v46 .wm-report-tabs-v7301 button{background:#eef6f3!important;color:#0A4033!important;border:1px solid #cfe2da!important;border-radius:16px!important;min-height:44px!important;text-align:center!important;white-space:nowrap!important}
      body.warehouse-manager-stable-v46 .wm-report-tabs-v7301 button.active{background:#0A4033!important;color:#fff!important;border-color:#0A4033!important}
      body.warehouse-manager-stable-v46 .wm-filters-v7301{display:grid;grid-template-columns:2fr repeat(5,minmax(120px,1fr)) auto;gap:9px;align-items:end}
      body.warehouse-manager-stable-v46 .wm-filters-v7301 input,body.warehouse-manager-stable-v46 .wm-filters-v7301 select{max-width:none!important;min-width:0!important}
      body.warehouse-manager-stable-v46 .wm-kpis-v7301{display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:10px}
      body.warehouse-manager-stable-v46 .wm-kpi-v7301{background:#fff;border:1px solid #dce6e2;border-radius:18px;padding:15px;box-shadow:0 8px 22px rgba(10,64,51,.05)}
      body.warehouse-manager-stable-v46 .wm-kpi-v7301 small{display:block;color:#60706a;margin-bottom:8px}.wm-kpi-v7301 b{font-size:26px;color:#0A4033}
      body.warehouse-manager-stable-v46 .wm-report-card-v7301{background:#fff;border:1px solid #dce6e2;border-radius:22px;padding:16px;box-shadow:0 8px 24px rgba(10,64,51,.05)}
      body.warehouse-manager-stable-v46 .wm-report-card-v7301 h3{margin:0 0 12px;color:#0A4033}
      body.warehouse-manager-stable-v46 .wm-table-v7301{overflow:auto;border:1px solid #dce6e2;border-radius:16px;background:#fff;max-height:none!important}
      body.warehouse-manager-stable-v46 .wm-table-v7301 table{width:100%;border-collapse:collapse;table-layout:auto!important}
      body.warehouse-manager-stable-v46 .wm-table-v7301 th,body.warehouse-manager-stable-v46 .wm-table-v7301 td{padding:10px;border-bottom:1px solid #edf1ef;text-align:right;white-space:nowrap;writing-mode:horizontal-tb!important}
      body.warehouse-manager-stable-v46 .wm-table-v7301 th{background:#f8fbfa;color:#4c635c;position:sticky;top:0;z-index:1}
      body.warehouse-manager-stable-v46 .wm-total-row-v7301{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}.wm-total-row-v7301 .wm-kpi-v7301 b{font-size:24px}
      @media(max-width:1100px){body.warehouse-manager-stable-v46 .wm-report-tabs-v7301,body.warehouse-manager-stable-v46 .wm-kpis-v7301{grid-template-columns:1fr 1fr}body.warehouse-manager-stable-v46 .wm-filters-v7301{grid-template-columns:1fr 1fr}}
      @media(max-width:700px){body.warehouse-manager-stable-v46 .wm-report-tabs-v7301,body.warehouse-manager-stable-v46 .wm-kpis-v7301,body.warehouse-manager-stable-v46 .wm-filters-v7301,body.warehouse-manager-stable-v46 .wm-total-row-v7301{grid-template-columns:1fr}}
    `;
    document.head.appendChild(st);
  }
  function removeConflictClasses(){
    document.body.classList.remove(
      'finance-manager-stable-v35',
      'warehouse-manager-stable-v37',
      'finance-warehouse-role-v29',
      'finance-warehouse-role-v28',
      'warehouse-manager-view-v151',
      'warehouse-manager-view-v162',
      'warehouse-manager-view-v163',
      'warehouse-manager-view-v164',
      'warehouse-manager-view-v178',
      'warehouse-manager-view-v179',
      'warehouse-manager-view-v180'
    );
  }
  function activeTab(){
    return S(document.querySelector('#finTabsV15 button.active')?.getAttribute('data-fin-tab-v15'));
  }
  function wantedTab(){
    const saved = S(sessionStorage.getItem('tasneef_warehouse_fin_tab_v44'));
    return ['products','movement','reports'].includes(saved) ? saved : 'products';
  }
  function removeLegacyFinance(){
    const p = page();
    if(!p) return;
    p.querySelectorAll(':scope > .finance-tabs,:scope > .finance-tab-page,:scope > [id^="financeTab"]').forEach(el => {
      if(!el.closest('.fin-shell')) el.remove();
    });
  }
  function hideMoneyText(root){
    root = root || document;
    const words = /(سعر|ضريبة|قبل الضريبة|بعد الضريبة|قيمة|تكلفة|ربح|ر\.س|price|cost|vat|tax|gross|net)/i;
    root.querySelectorAll('#financeDashboard .fin-kpi,#financeDashboard .fin-soft,#financeDashboard .fin-table th,#financeDashboard .fin-table td,.modal-backdrop .fin-card,.modal-backdrop th,.modal-backdrop td').forEach(el => {
      if(words.test(S(el.textContent))) el.classList.add('fin-money-hidden-v44');
    });
  }
  function normalizeTabs(){
    document.querySelectorAll('#finTabsV15 button[data-fin-tab-v15]').forEach(btn => {
      const id = S(btn.getAttribute('data-fin-tab-v15'));
      const ok = id === 'products' || id === 'movement' || id === 'reports';
      btn.hidden = false;
      btn.style.display = ok ? '' : 'none';
      btn.style.visibility = ok ? 'visible' : 'hidden';
      btn.classList.remove('v205-hidden-perm');
    });
    const current = activeTab();
    if(current && !['products','movement','reports'].includes(current) && typeof window.financeProTabV15 === 'function'){
      window.financeProTabV15(wantedTab());
    }
  }
  function clean(){
    if(!isWarehouse()) return;
    elevateSession();
    style();
    removeConflictClasses();
    document.body.classList.add('warehouse-manager-stable-v44');
    document.body.classList.add('warehouse-manager-stable-v46');
    const p = page();
    if(!p) return;
    p.classList.add('finance-pro');
    p.style.display = p.classList.contains('hidden') ? '' : 'block';
    removeLegacyFinance();
    normalizeTabs();
    hideMoneyText(document);
    stabilizeMovementBody();
  }
  function movementBodyLooksBroken(){
    const body = document.getElementById('finBodyV15');
    if(!body) return true;
    const text = S(body.textContent);
    if(!text) return true;
    if(activeTab() !== 'movement') return false;
    if(!body.querySelector('#finMoveItemV15') || !body.querySelector('#finDistributionBoxV15')) return true;
    return /(جاري|تعذر|المصروفات|الموردين|مركز تكلفة|الفواتير المسجلة|إضافة مخزون|expenses|supplier|invoice)/i.test(text);
  }
  function stabilizeMovementBody(){
    if(!isWarehouse() || !visible() || activeTab() !== 'movement') return;
    if(!movementBodyLooksBroken()) return;
    if(typeof window.financeProTabV15 === 'function'){
      try{ window.financeProTabV15('movement'); }catch(_){}
    }
  }
  function reportBodyLooksBroken(){
    const body = document.getElementById('finBodyV15');
    if(!body) return true;
    if(activeTab() !== 'reports') return false;
    const text = S(body.textContent);
    if(!text) return true;
    if(!body.querySelector('#finReportWindowV15')) return true;
    return /(جاري|تعذر|الموردين|الفواتير المسجلة|إضافة مخزون|صرف منتج وتوزيع|supplier|invoice)/i.test(text);
  }
  function stabilizeReportsBody(){
    if(!isWarehouse() || !visible() || activeTab() !== 'reports') return;
    if(!reportBodyLooksBroken()) return;
    renderWarehouseReports();
  }
  function rowType(v){
    const t=S(v);
    const map={'داخل':'in','صرف':'out','خارج':'out','مستهلك':'consume','استهلاك':'consume','مرتجع':'return','مرجع':'return','مهدور':'waste','هدر':'waste','تالف':'damaged','سكراب':'scrap'};
    return map[t] || t;
  }
  function distributionType(type, fallback){
    const t=rowType(type || fallback);
    return t === 'out' ? 'consume' : t;
  }
  function metaOf(note){
    const raw=S(note);
    if(!raw.startsWith('finance_pro_v15:')) return {};
    try{ return JSON.parse(raw.replace('finance_pro_v15:','')) || {}; }catch(_){ return {}; }
  }
  function qty(v){ const n=Number(v); return Number.isFinite(n) ? n : 0; }
  function reportRows(){
    const st=window.financeProStateV15 || {};
    const moves=Array.isArray(st.movements) ? st.movements : [];
    const rows=[];
    moves.forEach(m=>{
      const dist=Array.isArray(metaOf(m.notes).distribution) ? metaOf(m.notes).distribution : [];
      if(dist.length){
        dist.forEach(d=>rows.push({date:m.movement_date||S(m.created_at).slice(0,10)||'-', type:distributionType(d.type,m.movement_type), item:m.item_name||'-', qty:qty(d.qty), receiver:m.receiver||'-', project:d.projectName||d.otherName||m.project_name||'-', order:d.orderNo||m.order_no||'-'}));
      }else{
        rows.push({date:m.movement_date||S(m.created_at).slice(0,10)||'-', type:rowType(m.movement_type), item:m.item_name||'-', qty:qty(m.quantity), receiver:m.receiver||'-', project:m.project_name||'-', order:m.order_no||'-'});
      }
    });
    return rows;
  }
  function esc(v){
    return String(v ?? '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  }
  function money(n){
    const x=Number(n)||0;
    return x.toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';
  }
  function reportUnitPrice(r){
    try{
      const raw = window.financeProStateV15 || {};
      const items = Array.isArray(raw.items) ? raw.items : [];
      const it = items.find(x => S(x.name||x.item_name) === S(r.item));
      return Number(it?.unit_price || it?.price || it?.cost || it?.avg_cost || 0) || 0;
    }catch(_){ return 0; }
  }
  function reportRowsFiltered(){
    const rows=(window.__wmRowsV7301 || reportRows()).slice();
    const q=S(document.getElementById('wmRepSearchV7301')?.value).toLowerCase();
    const type=S(document.getElementById('wmRepTypeV7301')?.value);
    const project=S(document.getElementById('wmRepProjectV7301')?.value);
    const product=S(document.getElementById('wmRepProductV7301')?.value);
    const from=S(document.getElementById('wmRepFromV7301')?.value);
    const to=S(document.getElementById('wmRepToV7301')?.value);
    return rows.filter(r=>{
      const t=rowType(r.type);
      if(type && t!==type) return false;
      if(project && S(r.project)!==project) return false;
      if(product && S(r.item)!==product) return false;
      if(from && S(r.date)<from) return false;
      if(to && S(r.date)>to) return false;
      if(q){
        const hay=[r.date,r.type,r.item,r.qty,r.receiver,r.project,r.order].map(S).join(' ').toLowerCase();
        if(!hay.includes(q)) return false;
      }
      return true;
    });
  }
  function wmProjectsOptions(rows){
    return [...new Set(rows.map(r=>S(r.project)).filter(Boolean).filter(x=>x!=='-'))].sort().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  }
  function wmProductsOptions(rows){
    return [...new Set(rows.map(r=>S(r.item)).filter(Boolean).filter(x=>x!=='-'))].sort().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  }
  function wmTypeLabel(t){
    t=rowType(t);
    return t==='in'?'داخل':t==='consume'?'مستهلك':t==='return'?'مرتجع':t==='waste'?'هدر':t==='damaged'?'تالف':t==='scrap'?'سكراب':t||'-';
  }
  function wmCurrentTab(){ return S(sessionStorage.getItem('tasneef_warehouse_report_inner_v7301')) || 'products'; }
  window.wmReportTabV7301=function(tab){
    sessionStorage.setItem('tasneef_warehouse_report_inner_v7301', tab || 'products');
    wmRenderReportContentV7301();
  };
  window.wmRenderReportsV7301=function(){ wmRenderReportContentV7301(); };
  window.wmPrintReportsV7301=function(){
    const box=document.getElementById('wmReportPrintAreaV7301');
    if(!box) return window.print();
    const w=window.open('','_blank');
    w.document.write('<html dir="rtl" lang="ar"><head><title>تقرير المخزون</title><style>body{font-family:Tahoma,Arial;padding:20px;color:#10231d}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #999;padding:8px;text-align:right}th{background:#f1f5f3}h2,h3{color:#0A4033}.kpi{display:inline-block;border:1px solid #ccc;border-radius:12px;padding:12px;margin:6px;min-width:150px}</style></head><body>'+box.innerHTML+'</body></html>');
    w.document.close(); w.focus(); setTimeout(()=>w.print(),300);
  };
  function wmRenderReportContentV7301(){
    const body=document.getElementById('finBodyV15');
    const content=document.getElementById('wmReportContentV7301');
    if(!body || !content) return;
    const rows=reportRowsFiltered();
    const tab=wmCurrentTab();
    document.querySelectorAll('.wm-report-tabs-v7301 button').forEach(b=>b.classList.toggle('active', b.dataset.wmTab===tab));
    const totalIn=rows.filter(r=>rowType(r.type)==='in').reduce((a,r)=>a+qty(r.qty),0);
    const totalConsume=rows.filter(r=>rowType(r.type)==='consume').reduce((a,r)=>a+qty(r.qty),0);
    const totalReturn=rows.filter(r=>rowType(r.type)==='return').reduce((a,r)=>a+qty(r.qty),0);
    const totalValue=rows.reduce((a,r)=>a+(qty(r.qty)*reportUnitPrice(r)),0);
    const vat=totalValue*0.15;
    const productMap={};
    rows.forEach(r=>{
      const k=S(r.item)||'-';
      productMap[k]=productMap[k]||{in:0,consume:0,return:0,waste:0,balance:0,value:0};
      const t=rowType(r.type), q=qty(r.qty), price=reportUnitPrice(r);
      if(t==='in'){ productMap[k].in+=q; productMap[k].balance+=q; }
      else if(t==='return'){ productMap[k].return+=q; productMap[k].balance+=q; }
      else if(t==='consume'){ productMap[k].consume+=q; productMap[k].balance-=q; }
      else { productMap[k].waste+=q; productMap[k].balance-=q; }
      productMap[k].value += Math.max(0,q*price);
    });
    let html='';
    if(tab==='products'){
      const trs=Object.keys(productMap).map(name=>`<tr><td>${esc(name)}</td><td>${productMap[name].in}</td><td>${productMap[name].consume}</td><td>${productMap[name].return}</td><td>${productMap[name].waste}</td><td>${productMap[name].balance}</td><td>${money(productMap[name].value)}</td></tr>`).join('') || '<tr><td colspan="7">لا توجد بيانات</td></tr>';
      html=`<div class="wm-report-card-v7301" id="wmReportPrintAreaV7301"><h3>تقرير المنتجات</h3><div class="wm-kpis-v7301"><div class="wm-kpi-v7301"><small>منتجات في التقرير</small><b>${Object.keys(productMap).length}</b></div><div class="wm-kpi-v7301"><small>كمية الدخول</small><b>${totalIn}</b></div><div class="wm-kpi-v7301"><small>المستهلك</small><b>${totalConsume}</b></div><div class="wm-kpi-v7301"><small>المرتجع</small><b>${totalReturn}</b></div></div><div class="wm-table-v7301"><table><thead><tr><th>المنتج</th><th>داخل</th><th>مستهلك</th><th>مرتجع</th><th>تالف/هدر</th><th>الرصيد الحالي</th><th>إجمالي تقديري</th></tr></thead><tbody>${trs}</tbody></table></div><div class="wm-total-row-v7301"><div class="wm-kpi-v7301"><small>الإجمالي قبل الضريبة</small><b>${money(totalValue)}</b></div><div class="wm-kpi-v7301"><small>الضريبة 15%</small><b>${money(vat)}</b></div><div class="wm-kpi-v7301"><small>الإجمالي بعد الضريبة</small><b>${money(totalValue+vat)}</b></div></div></div>`;
    }else if(tab==='movement'){
      const trs=rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(wmTypeLabel(r.type))}</td><td>${esc(r.item)}</td><td>${qty(r.qty)}</td><td>${esc(r.receiver)}</td><td>${esc(r.project)}</td><td>${esc(r.order)}</td><td>${money(qty(r.qty)*reportUnitPrice(r))}</td></tr>`).join('') || '<tr><td colspan="8">لا توجد حركات</td></tr>';
      html=`<div class="wm-report-card-v7301" id="wmReportPrintAreaV7301"><h3>حركة المخزون</h3><div class="wm-kpis-v7301"><div class="wm-kpi-v7301"><small>حركات ظاهرة</small><b>${rows.length}</b></div><div class="wm-kpi-v7301"><small>داخل</small><b>${totalIn}</b></div><div class="wm-kpi-v7301"><small>مستهلك</small><b>${totalConsume}</b></div><div class="wm-kpi-v7301"><small>مرتجع</small><b>${totalReturn}</b></div></div><div class="wm-table-v7301"><table><thead><tr><th>التاريخ</th><th>الحركة</th><th>المنتج</th><th>الكمية</th><th>المستلم/المورد</th><th>المشروع/الخدمة</th><th>الأوردر</th><th>الإجمالي</th></tr></thead><tbody>${trs}</tbody></table></div></div>`;
    }else if(tab==='stock'){
      const trs=Object.keys(productMap).filter(k=>productMap[k].balance!==0).map(name=>`<tr><td>${esc(name)}</td><td>${productMap[name].balance}</td><td>${productMap[name].in}</td><td>${productMap[name].consume}</td><td>${productMap[name].return}</td></tr>`).join('') || '<tr><td colspan="5">لا توجد منتجات برصيد حالي</td></tr>';
      html=`<div class="wm-report-card-v7301" id="wmReportPrintAreaV7301"><h3>جرد المخزون</h3><p style="color:#60706a">لا تظهر المنتجات ذات الرصيد صفر.</p><div class="wm-table-v7301"><table><thead><tr><th>المنتج</th><th>الرصيد الحالي</th><th>إجمالي الدخول</th><th>إجمالي الاستهلاك</th><th>المرتجع</th></tr></thead><tbody>${trs}</tbody></table></div></div>`;
    }else{
      const map={};
      rows.filter(r=>rowType(r.type)==='consume').forEach(r=>{const k=S(r.project)||'-'; map[k]=map[k]||{qty:0,value:0,count:0}; map[k].qty+=qty(r.qty); map[k].value+=qty(r.qty)*reportUnitPrice(r); map[k].count++;});
      const trs=Object.keys(map).map(k=>`<tr><td>${esc(k)}</td><td>${map[k].count}</td><td>${map[k].qty}</td><td>${money(map[k].value)}</td><td>${money(map[k].value*0.15)}</td><td>${money(map[k].value*1.15)}</td></tr>`).join('') || '<tr><td colspan="6">لا توجد مراكز تكلفة</td></tr>';
      const subtotal=Object.values(map).reduce((a,x)=>a+x.value,0);
      html=`<div class="wm-report-card-v7301" id="wmReportPrintAreaV7301"><h3>مراكز التكلفة</h3><div class="wm-table-v7301"><table><thead><tr><th>المشروع / مركز التكلفة</th><th>عدد العمليات</th><th>الكمية</th><th>قبل الضريبة</th><th>الضريبة</th><th>بعد الضريبة</th></tr></thead><tbody>${trs}</tbody></table></div><div class="wm-total-row-v7301"><div class="wm-kpi-v7301"><small>الإجمالي قبل الضريبة</small><b>${money(subtotal)}</b></div><div class="wm-kpi-v7301"><small>الضريبة 15%</small><b>${money(subtotal*0.15)}</b></div><div class="wm-kpi-v7301"><small>الإجمالي بعد الضريبة</small><b>${money(subtotal*1.15)}</b></div></div></div>`;
    }
    content.innerHTML=html;
  }
  function renderWarehouseReports(){
    if(!isWarehouse() || !visible()) return false;
    const body=document.getElementById('finBodyV15');
    if(!body) return false;
    document.querySelectorAll('#finTabsV15 button[data-fin-tab-v15]').forEach(btn=>{
      btn.classList.toggle('active', S(btn.getAttribute('data-fin-tab-v15'))==='reports');
    });
    const rows=reportRows().filter(r=>['in','consume','return','waste','damaged','scrap'].includes(rowType(r.type)));
    window.__wmRowsV7301 = rows;
    const projects=wmProjectsOptions(rows), products=wmProductsOptions(rows);
    body.innerHTML=`<div class="wm-report-shell-v7301">
      <div class="wm-report-card-v7301"><h3>تقارير مدير المخزون</h3><div class="wm-report-tabs-v7301"><button type="button" data-wm-tab="products" onclick="wmReportTabV7301('products')">تقرير المنتجات</button><button type="button" data-wm-tab="movement" onclick="wmReportTabV7301('movement')">حركة المخزون</button><button type="button" data-wm-tab="stock" onclick="wmReportTabV7301('stock')">جرد المخزون</button><button type="button" data-wm-tab="cost" onclick="wmReportTabV7301('cost')">مراكز التكلفة</button></div><div class="wm-filters-v7301"><input id="wmRepSearchV7301" oninput="wmRenderReportsV7301()" placeholder="بحث حسب المنتج أو الكود أو المستلم"><select id="wmRepProductV7301" onchange="wmRenderReportsV7301()"><option value="">كل المنتجات</option>${products}</select><select id="wmRepProjectV7301" onchange="wmRenderReportsV7301()"><option value="">كل المشاريع</option>${projects}</select><select id="wmRepTypeV7301" onchange="wmRenderReportsV7301()"><option value="">كل الحركات</option><option value="in">داخل</option><option value="consume">مستهلك</option><option value="return">مرتجع</option><option value="waste">هدر/تالف</option></select><input id="wmRepFromV7301" type="date" onchange="wmRenderReportsV7301()"><input id="wmRepToV7301" type="date" onchange="wmRenderReportsV7301()"><button type="button" class="light" onclick="wmPrintReportsV7301()">طباعة</button></div></div><div id="wmReportContentV7301"></div></div>`;
    wmRenderReportContentV7301();
    return false;
  }
  function ensurePro(tab){
    if(!isWarehouse()) return;
    elevateSession();
    style();
    if(typeof window.financeProLoadV15 === 'function' && !hasPro()){
      window.financeProLoadV15(false);
    }
    setTimeout(() => {
      clean();
      const target = tab || wantedTab();
      if(typeof window.financeProTabV15 === 'function' && visible() && (!activeTab() || activeTab() !== target || (target === 'movement' && movementBodyLooksBroken()) || (target === 'reports' && reportBodyLooksBroken()))){
        window.financeProTabV15(target);
        setTimeout(clean, 80);
      }
      if(target === 'movement'){
        setTimeout(stabilizeMovementBody, 180);
        setTimeout(stabilizeMovementBody, 520);
      }
      if(target === 'reports'){
        setTimeout(stabilizeReportsBody, 180);
        setTimeout(stabilizeReportsBody, 520);
      }
    }, 100);
  }
  function patchFinanceProTab(){
    const old = window.financeProTabV15;
    if(typeof old !== 'function' || old.__warehouseStableV44) return;
    const wrapped = async function(tab){
      if(isWarehouse()){
        const target = ['products','movement','reports'].includes(S(tab)) ? S(tab) : 'products';
        sessionStorage.setItem('tasneef_warehouse_fin_tab_v44', target);
        if(target === 'reports'){
          const p=page();
          if(typeof window.financeProLoadV15 === 'function' && (!p || !p.querySelector('#finBodyV15'))) {
            try{ await window.financeProLoadV15(false); }catch(_){}
          }
          setTimeout(()=>{ clean(); renderWarehouseReports(); }, 40);
          setTimeout(renderWarehouseReports, 180);
          return false;
        }
        const result = await old.call(this, target);
        setTimeout(() => {
          clean();
          const body = document.getElementById('finBodyV15');
          if(target === 'movement' && body && movementBodyLooksBroken()){
            try{ old.call(this, 'movement'); }catch(_){}
            setTimeout(clean, 80);
            setTimeout(stabilizeMovementBody, 220);
          }
          if(target === 'reports' && body && reportBodyLooksBroken()){
            try{ old.call(this, 'reports'); }catch(_){}
            setTimeout(clean, 80);
            setTimeout(stabilizeReportsBody, 220);
          }
        }, 60);
        return result;
      }
      return old.apply(this, arguments);
    };
    wrapped.__warehouseStableV44 = true;
    window.financeProTabV15 = wrapped;
  }
  function showFinance(btn){
    if(!isWarehouse()) return false;
    let p = page();
    if(!p && typeof window.financeProLoadV15 === 'function') window.financeProLoadV15(false);
    p = page();
    if(!p) return false;
    document.querySelectorAll('.page').forEach(x => x.classList.add('hidden'));
    p.classList.remove('hidden');
    p.classList.add('finance-pro');
    p.style.display = 'block';
    p.style.visibility = 'visible';
    p.style.opacity = '1';
    document.querySelectorAll('.nav').forEach(n => n.classList.remove('active'));
    if(btn && btn.classList) btn.classList.add('active');
    ensurePro(wantedTab());
    return true;
  }
  function patchShowPage(){
    const old = window.showPage;
    if(typeof old !== 'function' || old.__warehouseStableV44) return;
    const wrapped = function(id, btn){
      if(isWarehouse() && id === 'financeDashboard') return showFinance(btn);
      return old.apply(this, arguments);
    };
    wrapped.__warehouseStableV44 = true;
    window.showPage = wrapped;
    try{ showPage = wrapped; }catch(_){}
  }
  function patchTabs(){
    if(window.__warehouseStableTabsV44) return;
    window.__warehouseStableTabsV44 = true;
    document.addEventListener('click', function(ev){
      if(!isWarehouse()) return;
      const btn = ev.target && ev.target.closest ? ev.target.closest('#finTabsV15 button[data-fin-tab-v15]') : null;
      if(!btn) return;
      const id = S(btn.getAttribute('data-fin-tab-v15'));
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      if(!['products','movement','reports'].includes(id)) return;
      sessionStorage.setItem('tasneef_warehouse_fin_tab_v44', id);
      if(typeof window.financeProTabV15 === 'function') window.financeProTabV15(id);
      setTimeout(clean, 70);
      if(id === 'movement'){
        setTimeout(stabilizeMovementBody, 180);
        setTimeout(stabilizeMovementBody, 520);
      }
      if(id === 'reports'){
        setTimeout(stabilizeReportsBody, 180);
        setTimeout(stabilizeReportsBody, 520);
      }
    }, true);
  }
  function patchPermissions(){
    if(window.__warehouseStablePermsV44) return;
    window.__warehouseStablePermsV44 = true;
    const oldCan201 = window.tasneefCanV201;
    const oldCan40 = window.tasneefCanV40;
    const allow = key => {
      const k = S(key);
      return k === 'can_expenses_inventory' || k === 'can_manage_inventory' || k === 'can_inventory_requests' ||
        k.startsWith('tab_products_') || k.startsWith('tab_movement_') || k.startsWith('tab_reports_') || k.startsWith('tab_financeDashboard_');
    };
    window.tasneefCanV201 = function(key){
      if(isWarehouse() && allow(key)) return true;
      return typeof oldCan201 === 'function' ? oldCan201.apply(this, arguments) : true;
    };
    window.tasneefCanV40 = function(key){
      if(isWarehouse() && allow(key)) return true;
      return typeof oldCan40 === 'function' ? oldCan40.apply(this, arguments) : true;
    };
  }
  function boot(){
    if(!isWarehouse()) return;
    elevateSession();
    style();
    patchShowPage();
    patchFinanceProTab();
    patchTabs();
    patchPermissions();
    clean();
    setTimeout(() => ensurePro(), 250);
    setTimeout(() => ensurePro(), 900);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('load', () => setTimeout(boot, 250));
  setInterval(() => { if(isWarehouse() && visible()) ensurePro(); }, 700);
  let busy = false;
  try{
    new MutationObserver(() => {
      if(busy || !isWarehouse() || !visible()) return;
      busy = true;
      setTimeout(() => { busy = false; clean(); if(!hasPro()) ensurePro(); }, 70);
    }).observe(document.documentElement, {childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden']});
  }catch(_){}
})();


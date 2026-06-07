(function(){
  'use strict';
  if(window.__tasneefFinanceSupplierQtyFixV57) return;
  window.__tasneefFinanceSupplierQtyFixV57 = true;

  const S = v => String(v ?? '').trim();
  const N = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const A = v => Array.isArray(v) ? v : [];
  const E = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const VAT = 0.15;
  const money = v => {
    try{ return (Number(v)||0).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ر.س'; }
    catch(_){ return (Number(v)||0).toFixed(2) + ' ر.س'; }
  };
  const state = () => window.financeProStateV15 || {items:[],movements:[],suppliers:[],expenses:[]};

  function codeOf(item){ return S(item?.product_code || item?.serial_number || item?.barcode || item?.supplier_barcode || item?.code || ''); }
  function safeJson(note){
    const raw = S(note);
    if(!raw.startsWith('finance_pro_v15:')) return {};
    try{ return JSON.parse(raw.replace('finance_pro_v15:','')); }catch(_){ return {}; }
  }
  function moveType(m){ return S(m?.movement_type); }
  function label(type){
    return ({in:'داخل',out:'صرف',consume:'مستهلك',waste:'مهدور',damaged:'تالف',scrap:'سكراب',return:'مرتجع'}[S(type)] || S(type) || '-');
  }
  function itemMoves(item){
    const code = codeOf(item);
    const id = S(item?.id);
    const name = S(item?.name);
    const seen = new Set();
    const rows = A(state().movements).filter(m => {
      const ok = (id && S(m.item_id) === id) || (code && [m.product_code,m.barcode].map(S).includes(code)) || (!S(m.item_id) && S(m.item_name) === name);
      if(!ok) return false;
      const key = S(m.id) || [m.movement_date,m.created_at,m.item_id,m.item_name,m.movement_type,m.quantity,m.reason].map(S).join('|');
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return rows;
  }
  function distributionRows(m){
    const meta = safeJson(m.notes);
    return A(meta.distribution).map((d, idx) => ({
      id:`${S(m.id)||'m'}-d${idx}`,
      item_id:m.item_id,
      item_name:m.item_name,
      movement_type:S(d.type || m.movement_type),
      quantity:N(d.qty),
      movement_date:m.movement_date,
      receiver:m.receiver,
      reason:d.note || m.reason,
      notes:m.notes,
      product_code:m.product_code,
      barcode:m.barcode,
      unit_cost:N(m.unit_cost),
      project_name:S(d.projectName),
      order_no:S(d.orderNo),
      distribution_note:S(d.note),
      center:S(d.center),
      is_distribution_row:true,
      base_movement_type:S(m.movement_type)
    })).filter(r => r.quantity > 0);
  }
  function activityRows(item){
    const base = itemMoves(item);
    const out = [];
    base.forEach(m => {
      const dist = distributionRows(m);
      if(dist.length) out.push(...dist);
      else out.push(m);
    });
    return out;
  }
  function movementValue(m){
    const meta = safeJson(m.notes);
    if(N(meta.beforeVat) > 0) return N(meta.beforeVat);
    return N(m.quantity) * N(m.unit_cost);
  }
  function rowsHtml(rows){
    if(!rows.length) return '<tr><td colspan="9">لا توجد بيانات</td></tr>';
    return rows.map(m => {
      const net = movementValue(m);
      return `<tr><td>${E(m.movement_date || S(m.created_at).slice(0,10) || '-')}</td><td>${E(label(m.movement_type))}</td><td>${N(m.quantity)}</td><td>${E(m.receiver || '-')}</td><td>${E(m.center || '-')}</td><td>${E(m.project_name || '-')}</td><td>${E(m.order_no || '-')}</td><td>${E(m.distribution_note || m.reason || '-')}</td><td>${money(net)}</td></tr>`;
    }).join('');
  }

  window.financeProShowProductV15 = function(id){
    const item = A(state().items).find(i => S(i.id) === S(id));
    if(!item) return;
    const base = itemMoves(item);
    const activity = activityRows(item);
    const ins = base.filter(m => moveType(m) === 'in');
    const financialOutTypes = ['consume','waste','damaged','scrap'];
    const outTypes = ['out','consume','waste','damaged','scrap'];
    const outRows = activity.filter(m => outTypes.includes(moveType(m)));
    const consumedRows = activity.filter(m => moveType(m) === 'consume');
    const financialRows = activity.filter(m => financialOutTypes.includes(moveType(m)));
    const returns = activity.filter(m => moveType(m) === 'return');
    const inQty = ins.reduce((a,m)=>a+N(m.quantity),0);
    const current = Math.max(0, N(item.quantity));
    const returnQty = returns.reduce((a,m)=>a+N(m.quantity),0);
    const consumed = consumedRows.reduce((a,m)=>a+N(m.quantity),0);
    const outQty = Math.max(0, inQty + returnQty - current);
    const img = item.image_url ? `<img src="${E(item.image_url)}" style="width:96px;height:96px;object-fit:contain;border:1px solid #d9e7e2;border-radius:16px;background:#fff;padding:4px">` : '';
    const pages = [
      {title:'الملخص', html:`<div class="fin-grid">${img?`<div class="fin-card">${img}</div>`:''}<div class="fin-card fin-kpi"><small>الداخل</small><b>${N(inQty)}</b></div><div class="fin-card fin-kpi"><small>الخارج</small><b>${N(outQty)}</b></div><div class="fin-card fin-kpi"><small>المستهلك</small><b>${N(consumed)}</b></div><div class="fin-card fin-kpi"><small>المرتجع</small><b>${N(returnQty)}</b></div><div class="fin-card fin-kpi"><small>الرصيد الحالي</small><b>${N(current)}</b></div></div><div class="fin-soft">الكود: <b>${E(codeOf(item)||'-')}</b> | الوحدة: <b>${E(item.unit||'-')}</b> | النوع: <b>${E(item.item_type || item.type || '-')}</b></div>`},
      {title:'الداخل', html:`<div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المورد</th><th>المركز</th><th>المشروع</th><th>الأوردر</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${rowsHtml(ins)}</tbody></table></div>`},
      {title:'الخارج', html:`<div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المستلم</th><th>المركز</th><th>المشروع</th><th>الأوردر</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${rowsHtml(outRows)}</tbody></table></div>`},
      {title:'المستهلك', html:`<div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المستلم</th><th>المركز</th><th>المشروع</th><th>الأوردر</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${rowsHtml(consumedRows)}</tbody></table></div>`},
      {title:'تقرير المنتج', html:`<div class="fin-card"><h3>تقرير خاص بالمنتج</h3><p class="fin-soft">يعتمد الرصيد الحالي من بطاقة المنتج، ويمنع تضخيم الكمية عند وجود توزيع داخل الحركة.</p><div class="fin-grid three"><div class="fin-card fin-kpi"><small>مرات الدخول</small><b>${ins.length}</b></div><div class="fin-card fin-kpi"><small>مرات الخروج</small><b>${outRows.length}</b></div><div class="fin-card fin-kpi"><small>مرات الاستهلاك المالي</small><b>${financialRows.length}</b></div></div></div><div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المستلم</th><th>مركز التكلفة</th><th>المشروع</th><th>الأوردر</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${rowsHtml(financialRows)}</tbody></table></div>`},
      {title:'المرتجع', html:`<div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المستلم</th><th>المركز</th><th>المشروع</th><th>الأوردر</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${rowsHtml(returns)}</tbody></table></div>`}
    ];
    if(typeof window.openPagedModalV15 === 'function') return window.openPagedModalV15('بيانات المنتج: ' + (item.name || '-'), pages);
  };

  window.financeProDeleteSupplierV15 = async function(name){
    try{
      const supplier = S(name);
      if(!supplier) return;
      if(!confirm('حذف المورد من القائمة والفواتير؟ لن يتم حذف المنتجات نفسها.')) return;
      const nextSuppliers = A(state().suppliers).filter(s => S(s) !== supplier);
      try{ localStorage.setItem('tasneef_finance_suppliers_v21', JSON.stringify(nextSuppliers)); }catch(_){}
      if(window.sb){
        let r = await window.sb.from('inventory_items').update({supplier:''}).eq('supplier', supplier);
        if(r.error) throw r.error;
        try{ await window.sb.from('inventory_movements').update({receiver:''}).eq('receiver', supplier); }catch(_){}
        try{ await window.sb.from('finance_expenses').update({supplier:''}).eq('supplier', supplier); }catch(_){}
      }
      if(typeof window.financeLoadAll === 'function') await window.financeLoadAll(true);
      else if(typeof window.loadAll === 'function') await window.loadAll();
      if(typeof window.financeProRenderSuppliersV15 === 'function') window.financeProRenderSuppliersV15();
      if(typeof window.financeProRenderCurrentV15 === 'function') window.financeProRenderCurrentV15();
      if(typeof window.msg === 'function') window.msg('تم حذف المورد من القائمة');
    }catch(e){
      alert(e.message || String(e));
      if(typeof window.msg === 'function') window.msg(e.message || String(e), 'err');
    }
  };

  try{ financeProShowProductV15 = window.financeProShowProductV15; }catch(_){}
  try{ financeProDeleteSupplierV15 = window.financeProDeleteSupplierV15; }catch(_){}
})();

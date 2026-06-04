/* TASNEEF v347 - Finance & Inventory final safe patch
   لا يلمس المستخدمين أو الصلاحيات. يعمل فوق v343/v346 فقط. */
(function(){
  if(window.__tasneefV347FinanceInventoryFinalSafe) return;
  window.__tasneefV347FinanceInventoryFinalSafe = true;

  const VAT = 0.15;
  const A = v => Array.isArray(v) ? v : [];
  const S = v => String(v ?? '').trim();
  const N = v => { const x = Number(String(v ?? '').replace(/,/g,'')); return isFinite(x) ? x : 0; };
  const $id = id => document.getElementById(id);
  const dataSafe = () => window.data || {};
  const escSafe = v => (typeof esc === 'function' ? esc(v) : S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])));
  const fmt = v => (typeof money === 'function' ? money(N(v)) : N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س');
  const vat = v => +(N(v) * VAT).toFixed(2);
  const gross = v => +(N(v) * (1 + VAT)).toFixed(2);
  const todaySafe = () => (typeof today === 'function' ? today() : new Date().toISOString().slice(0,10));
  const msgSafe = (t,c) => { try{ (window.msg || alert)(t,c); }catch(_){ alert(t); } };

  const itemById = id => A(dataSafe().inventoryItems).find(i => S(i.id) === S(id)) || {};
  const projectById = id => A(dataSafe().projects).find(p => S(p.id) === S(id)) || {};
  const itemName = id => itemById(id).name || '-';
  const productCode = i => S(i?.serial_number || i?.product_code || i?.barcode || i?.supplier_barcode || '');
  const itemUnitCost = i => N(i?.unit_cost || i?.price_before_vat || i?.unit_before || i?.cost || i?.price || 0);
  const moveCost = m => N(m?.unit_cost || m?.unit_cost_override || m?.price_before_vat || itemUnitCost(itemById(m?.item_id)) || 0);
  const projectName = id => {
    try{ if(typeof financeProjectName === 'function') return financeProjectName(id); }catch(_){ }
    try{ if(typeof projectName === 'function') return projectName(id); }catch(_){ }
    const p = projectById(id); return p.name || p.project_name || p.title || (id ? S(id) : '');
  };
  const isIn = t => ['in','إدخال','ادخال','توريد','شراء','دخول'].includes(S(t));
  const isOut = t => ['out','consume','صرف','استهلاك'].includes(S(t));
  const isReturn = t => ['return','مرتجع','إرجاع','ارجاع'].includes(S(t));
  const parentTag = id => `[PARENT:${id}]`;
  const parentOf = m => (S(m?.notes).match(/\[PARENT:([^\]]+)\]/)||[])[1] || '';
  const isParentDistributed = m => /\[DISTRIBUTED_PARENT\]/.test(S(m?.notes)+' '+S(m?.reason));
  const isChildReportOnly = m => /\[REPORT_ONLY\]/.test(S(m?.notes)) || !!parentOf(m);

  function ensureCss(){
    if($id('v347FinanceCss')) return;
    const st = document.createElement('style'); st.id = 'v347FinanceCss';
    st.textContent = `
      .v347-modal{position:fixed;inset:0;background:rgba(0,32,25,.58);z-index:999999;display:grid;place-items:center;padding:18px;backdrop-filter:blur(4px)}
      .v347-panel{width:min(1180px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:22px;border:1px solid #d5e8e1;box-shadow:0 24px 70px rgba(0,0,0,.28);direction:rtl}
      .v347-head{position:sticky;top:0;background:#fff;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid #dbe8e3}.v347-head h2{margin:0;color:#063d31;font-size:22px}.v347-body{padding:16px}
      .v347-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:10px}.v347-box{border:1px solid #dbe8e3;background:#f8fcfa;border-radius:14px;padding:12px}.v347-box small{display:block;color:#657a73;margin-bottom:5px}.v347-box b{font-size:17px;color:#063d31}.v347-note{background:#fff9e9;border:1px solid #f0ddb0;border-radius:12px;padding:10px;color:#57441a;margin:10px 0}
      .v347-btn{border:0;border-radius:10px;background:#064737;color:#fff;padding:9px 13px;font-weight:800;cursor:pointer}.v347-btn.light{background:#eef8f5;color:#064737;border:1px solid #d3e6df}.v347-btn.red{background:#bd3434}.v347-btn:disabled{opacity:.55;cursor:not-allowed}
      .v347-table{width:100%;border-collapse:separate;border-spacing:0 8px}.v347-table th{background:#f1f8f5;color:#063d31;padding:9px;text-align:center}.v347-table td{background:#fff;border-top:1px solid #dbe8e3;border-bottom:1px solid #dbe8e3;padding:9px;text-align:center}.v347-table td:first-child{border-right:1px solid #dbe8e3;border-radius:0 12px 12px 0}.v347-table td:last-child{border-left:1px solid #dbe8e3;border-radius:12px 0 0 12px}.v347-total-row td{font-weight:900!important;background:#f4fbf8!important;color:#063d31!important}
      .v347-split{display:grid;grid-template-columns:1.2fr .45fr .65fr .7fr 1fr auto;gap:8px;align-items:end;border:1px dashed #cfe2dc;border-radius:14px;padding:10px;margin:8px 0;background:#fbfefd}.v347-split label{font-size:12px;color:#415852}.v347-split input,.v347-split select{width:100%;height:40px;border:1px solid #d7e5e0;border-radius:10px;padding:6px 8px;background:#fff}.v347-printbar{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin:10px 0}.v347-chip{display:inline-block;padding:4px 8px;border-radius:999px;background:#eaf8f2;color:#064737;font-weight:800;font-size:12px}
      @media(max-width:850px){.v347-split{grid-template-columns:1fr}.v347-head{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(st);
  }
  function modal(title, body){
    ensureCss(); document.querySelector('.v347-modal')?.remove();
    const d = document.createElement('div'); d.className = 'v347-modal';
    d.innerHTML = `<div class="v347-panel"><div class="v347-head"><h2>${escSafe(title)}</h2><button class="v347-btn red" onclick="this.closest('.v347-modal').remove()">إغلاق</button></div><div class="v347-body">${body}</div></div>`;
    document.body.appendChild(d);
  }
  function projectOptions(sel=''){
    return '<option value="">اختر المشروع</option>' + A(dataSafe().projects).map(p => `<option value="${escSafe(p.id)}" ${S(sel)===S(p.id)?'selected':''}>${escSafe(p.name||p.project_name||p.title||p.id)}</option>`).join('');
  }

  // 1) الكود الداخلي تلقائي PRD-00001
  function nextProductCode(){
    let max = 0;
    A(dataSafe().inventoryItems).forEach(i => { const m = productCode(i).match(/PRD-(\d+)/i); if(m) max = Math.max(max, Number(m[1])); });
    return 'PRD-' + String(max + 1).padStart(5,'0');
  }
  function ensureAutoCode(){ const el = $id('inventoryItemSerial'); if(el && !S(el.value)) el.value = nextProductCode(); }
  window.inventoryGenerateSerial = function(){ return nextProductCode(); };
  const oldSaveItem347 = window.inventorySaveItem;
  window.inventorySaveItem = async function(btn){ ensureAutoCode(); return oldSaveItem347 ? oldSaveItem347.apply(this, arguments) : undefined; };

  // 2) دفعات FIFO: الخارج من الأولى ثم الثانية ثم الثالثة
  function itemMovements(itemId){
    return A(dataSafe().inventoryMovements).filter(m => S(m.item_id) === S(itemId)).sort((a,b) => S(a.movement_date||a.created_at).localeCompare(S(b.movement_date||b.created_at)) || N(a.id)-N(b.id));
  }
  function fifoBatches(item){
    const moves = itemMovements(item.id);
    const ins = moves.filter(m => isIn(m.movement_type)).map((m,idx) => ({
      label: 'الدفعة ' + (idx + 1), ref: 'MOV-' + m.id, date: S(m.movement_date || m.created_at).slice(0,10), qty: N(m.quantity), cost: moveCost(m) || itemUnitCost(item), remaining: N(m.quantity)
    }));
    const totalOut = moves.filter(m => isOut(m.movement_type) && !isChildReportOnly(m)).reduce((a,m) => a + N(m.quantity), 0);
    const totalRet = moves.filter(m => isReturn(m.movement_type)).reduce((a,m) => a + N(m.quantity), 0);
    if(!ins.length){
      const original = Math.max(N(item.quantity) + totalOut - totalRet, N(item.quantity));
      ins.push({label:'الدفعة الأولى / تأسيسية', ref:'رصيد المنتج', date:'-', qty:original, cost:itemUnitCost(item), remaining:original});
    }
    let consume = totalOut;
    ins.forEach(b => { const take = Math.min(b.remaining, consume); b.remaining -= take; consume -= take; });
    let back = totalRet;
    ins.forEach(b => { if(back<=0) return; const room = b.qty - b.remaining; const r = Math.min(room, back); b.remaining += r; back -= r; });
    return ins;
  }
  function fifoUnitCost(itemId, qty){
    const it = itemById(itemId); let need = N(qty), total = 0;
    fifoBatches(it).forEach(b => { if(need<=0) return; const take = Math.min(need, Math.max(0,N(b.remaining))); total += take * N(b.cost); need -= take; });
    if(need>0) total += need * itemUnitCost(it);
    return N(qty) ? +(total / N(qty)).toFixed(2) : itemUnitCost(it);
  }
  window.tasneefFifoUnitCost = fifoUnitCost;

  // 3) عرض المنتج مع الدفعات وحركات الصرف وتوزيعها
  window.inventoryViewProductV347 = function(id){
    const it = itemById(id); if(!it.id) return msgSafe('المنتج غير موجود','err');
    const batches = fifoBatches(it);
    const totalRemainBefore = batches.reduce((a,b) => a + N(b.remaining) * N(b.cost), 0);
    const batchRows = batches.map(b => {
      const before = N(b.remaining) * N(b.cost);
      return `<tr><td>${escSafe(b.label)}</td><td>${escSafe(b.ref)}</td><td>${escSafe(b.date)}</td><td>${N(b.qty)}</td><td>${N(b.qty-b.remaining)}</td><td>${N(b.remaining)}</td><td>${fmt(b.cost)}</td><td>${fmt(vat(b.cost))}</td><td>${fmt(gross(b.cost))}</td><td>${fmt(before)}</td><td>${fmt(vat(before))}</td><td>${fmt(gross(before))}</td></tr>`;
    }).join('') || '<tr><td colspan="12">لا توجد دفعات</td></tr>';
    const moves = itemMovements(it.id).filter(m => !isChildReportOnly(m));
    const moveRows = moves.map(m => `<tr><td>${escSafe(S(m.movement_date||m.created_at).slice(0,10))}</td><td>${escSafe('MOV-'+m.id)}</td><td><span class="v347-chip">${isIn(m.movement_type)?'دخول':isReturn(m.movement_type)?'مرتجع':'صرف'}</span>${isParentDistributed(m)?'<br><small>موزع</small>':''}</td><td>${N(m.quantity)}</td><td>${escSafe(m.project_name || projectName(m.project_id) || '-')}</td><td>${fmt(moveCost(m) || fifoUnitCost(m.item_id,m.quantity))}</td><td><button class="v347-btn light" onclick="inventoryShowMovementV347('${escSafe(m.id)}')">عرض / توزيع</button></td></tr>`).join('') || '<tr><td colspan="7">لا توجد حركات لهذا المنتج</td></tr>';
    const img = it.image_url ? `<img src="${escSafe(it.image_url)}" style="width:145px;height:145px;object-fit:contain;border:1px solid #dbe8e3;border-radius:18px;background:#fff">` : '';
    modal('عرض المنتج: ' + (it.name || ''), `
      <div style="display:flex;gap:16px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap">
        <div class="v347-grid" style="flex:1">
          <div class="v347-box"><small>اسم المنتج</small><b>${escSafe(it.name||'-')}</b></div><div class="v347-box"><small>الكود الداخلي التلقائي</small><b>${escSafe(productCode(it)||nextProductCode())}</b></div><div class="v347-box"><small>المورد</small><b>${escSafe(it.supplier||'-')}</b></div><div class="v347-box"><small>المتبقي</small><b>${N(it.quantity)} ${escSafe(it.unit||'')}</b></div>
          <div class="v347-box"><small>سعر الحبة قبل الضريبة</small><b>${fmt(itemUnitCost(it))}</b></div><div class="v347-box"><small>ضريبة الحبة</small><b>${fmt(vat(itemUnitCost(it)))}</b></div><div class="v347-box"><small>سعر الحبة شامل</small><b>${fmt(gross(itemUnitCost(it)))}</b></div><div class="v347-box"><small>إجمالي المتبقي شامل</small><b>${fmt(gross(totalRemainBefore))}</b></div>
        </div>${img}
      </div>
      <div class="v347-note"><b>آلية الصرف:</b> النظام يحسب الخارج تلقائيًا من الدفعة الأولى، ثم الثانية، ثم الثالثة حسب FIFO.</div>
      <h3>دفعات المنتج</h3><div class="table-wrap"><table class="v347-table"><thead><tr><th>الدفعة</th><th>المرجع</th><th>التاريخ</th><th>دخل</th><th>خرج FIFO</th><th>متبقي</th><th>سعر قبل</th><th>ضريبة الحبة</th><th>سعر شامل</th><th>إجمالي قبل</th><th>الضريبة</th><th>الإجمالي شامل</th></tr></thead><tbody>${batchRows}</tbody></table></div>
      <h3>حركات المنتج والتوزيع على المشاريع</h3><div class="table-wrap"><table class="v347-table"><thead><tr><th>التاريخ</th><th>رقم الحركة</th><th>النوع</th><th>الكمية</th><th>المشروع</th><th>سعر الحبة</th><th>إجراء</th></tr></thead><tbody>${moveRows}</tbody></table></div>
    `);
  };
  window.v118ShowProductDetail = window.inventoryViewProductV347;
  window.inventoryOpenItemSmart = window.inventoryViewProductV347;
  window.inventoryViewProductV346 = window.inventoryViewProductV347;

  // 4) عرض حركة المخزون / توزيع الصرف على أكثر من مشروع وتعديل التكلفة
  window.inventoryAddSplitLineV347 = function(itemId, row){
    const box = $id('v347SplitLines'); if(!box) return;
    const cost = N(row?.unit_cost || fifoUnitCost(itemId, row?.quantity || 1));
    box.insertAdjacentHTML('beforeend', `<div class="v347-split" data-v347-line="1"><div><label>المشروع</label><select class="v347-project">${projectOptions(row?.project_id||'')}</select></div><div><label>الكمية</label><input class="v347-qty" type="number" step="0.01" value="${N(row?.quantity||1)}"></div><div><label>النوع</label><select class="v347-type"><option value="out" ${!isReturn(row?.movement_type)?'selected':''}>صرف / استهلاك</option><option value="return" ${isReturn(row?.movement_type)?'selected':''}>مرتجع</option></select></div><div><label>سعر الحبة قبل الضريبة</label><input class="v347-cost" type="number" step="0.01" value="${cost}"></div><div><label>ملاحظة</label><input class="v347-note-input" value="${escSafe(row?.note||row?.notes||'')}"></div><button class="v347-btn red" type="button" onclick="this.closest('[data-v347-line]').remove()">حذف</button></div>`);
  };
  window.inventoryShowMovementV347 = function(id){
    const m = A(dataSafe().inventoryMovements).find(x => S(x.id) === S(id)); if(!m) return msgSafe('الحركة غير موجودة','err');
    const children = A(dataSafe().inventoryMovements).filter(x => S(parentOf(x)) === S(id));
    const baseRows = children.length ? children.map(c => ({project_id:c.project_id,quantity:c.quantity,movement_type:c.movement_type,unit_cost:moveCost(c),notes:S(c.notes).replace(/\[PARENT:[^\]]+\]|\[REPORT_ONLY\]/g,'').trim()})) : [{project_id:m.project_id,quantity:m.quantity,movement_type:m.movement_type,unit_cost:moveCost(m)||fifoUnitCost(m.item_id,m.quantity),notes:m.notes||''}];
    const it = itemById(m.item_id);
    modal('عرض / توزيع حركة مخزون MOV-' + id, `<div class="v347-grid"><div class="v347-box"><small>المنتج</small><b>${escSafe(m.item_name||it.name||'-')}</b></div><div class="v347-box"><small>الكود الداخلي</small><b>${escSafe(m.product_code||productCode(it)||'-')}</b></div><div class="v347-box"><small>التاريخ</small><b>${escSafe(S(m.movement_date||m.created_at).slice(0,10))}</b></div><div class="v347-box"><small>الكمية الأصلية</small><b>${N(m.quantity)}</b></div><div class="v347-box"><small>سعر FIFO المقترح</small><b>${fmt(fifoUnitCost(m.item_id,m.quantity))}</b></div></div><div class="v347-note">وزّع الصرف على أكثر من مشروع وعدّل سعر الحبة عند الحاجة. أي سطر نوعه <b>مرتجع</b> لا يظهر في تكلفة المشاريع.</div><div id="v347SplitLines"></div><button class="v347-btn light" onclick="inventoryAddSplitLineV347('${escSafe(m.item_id)}')">+ إضافة مشروع</button><button class="v347-btn" style="margin-inline-start:8px" onclick="inventorySaveMovementSplitV347('${escSafe(id)}',this)">حفظ التوزيع</button>`);
    setTimeout(() => baseRows.forEach(r => window.inventoryAddSplitLineV347(m.item_id, r)), 0);
  };
  window.inventoryShowMovementV346 = window.inventoryShowMovementV347;

  window.inventorySaveMovementSplitV347 = async function(id, btn){
    try{
      if(btn) btn.disabled = true;
      if(!window.sb) throw new Error('الاتصال بقاعدة البيانات غير جاهز');
      const parent = A(dataSafe().inventoryMovements).find(x => S(x.id) === S(id)); if(!parent) throw new Error('الحركة غير موجودة');
      const lines = [...document.querySelectorAll('[data-v347-line]')].map(el => ({
        project_id: el.querySelector('.v347-project')?.value || null,
        quantity: N(el.querySelector('.v347-qty')?.value),
        movement_type: el.querySelector('.v347-type')?.value || 'out',
        unit_cost: N(el.querySelector('.v347-cost')?.value),
        note: S(el.querySelector('.v347-note-input')?.value)
      })).filter(x => x.quantity > 0);
      if(!lines.length) throw new Error('أضف سطر توزيع واحد على الأقل');
      const totalOut = lines.filter(x => !isReturn(x.movement_type)).reduce((a,x) => a + x.quantity, 0);
      if(totalOut > N(parent.quantity) + 0.0001) throw new Error('إجمالي الصرف أكبر من كمية الحركة الأصلية');
      const old = A(dataSafe().inventoryMovements).filter(x => S(parentOf(x)) === S(id));
      if(old.length){ const del = await sb.from('inventory_movements').delete().in('id', old.map(x => x.id)); if(del.error) throw del.error; }
      const rows = lines.map(l => {
        const pn = l.project_id ? projectName(l.project_id) : '';
        return { item_id: parent.item_id, item_name: parent.item_name || itemName(parent.item_id), product_code: parent.product_code || productCode(itemById(parent.item_id)), barcode: parent.barcode || '', movement_type: l.movement_type, quantity: l.quantity, movement_date: parent.movement_date || todaySafe(), project_id: l.project_id ? Number(l.project_id) : null, project_name: pn, receiver: parent.receiver || '', reason: isReturn(l.movement_type) ? 'مرتجع من توزيع الحركة' : 'توزيع صرف على مشروع', notes: `${parentTag(id)}[REPORT_ONLY] ${l.note}`.trim(), unit_cost: l.unit_cost || fifoUnitCost(parent.item_id, l.quantity) };
      });
      const ins = await sb.from('inventory_movements').insert(rows); if(ins.error) throw ins.error;
      const newNotes = S(parent.notes).includes('[DISTRIBUTED_PARENT]') ? S(parent.notes) : `${S(parent.notes)} [DISTRIBUTED_PARENT]`.trim();
      const upd = await sb.from('inventory_movements').update({notes:newNotes}).eq('id', id); if(upd.error) throw upd.error;
      msgSafe('تم حفظ توزيع الحركة'); document.querySelector('.v347-modal')?.remove(); if(typeof financeLoadAll === 'function') await financeLoadAll();
    }catch(e){ msgSafe(e.message || String(e), 'err'); } finally{ if(btn) btn.disabled = false; }
  };

  // 5) عرض قوائم المنتجات والحركات بدون منتجات صفر في المخزون + أزرار عرض/توزيع
  function renderItems(){
    const b = $id('inventoryItemsBody'); if(!b) return;
    let rows = A(dataSafe().inventoryItems).filter(i => N(i.quantity) > 0);
    const q = S($id('financeSearch')?.value).toLowerCase(); if(q) rows = rows.filter(i => [i.name, productCode(i), i.barcode, i.supplier, i.category, i.notes].join(' ').toLowerCase().includes(q));
    b.innerHTML = rows.map(i => { const before = N(i.quantity) * itemUnitCost(i); const img = i.image_url ? `<img src="${escSafe(i.image_url)}" style="width:58px;height:58px;object-fit:contain;border-radius:9px;background:#fff">` : '-'; return `<tr><td>${img}</td><td><b>${escSafe(i.name||'-')}</b><br><small>${escSafe(productCode(i)||'-')}</small></td><td>${escSafe(i.category||'-')}</td><td>${escSafe(i.unit||'-')}</td><td>${N(i.quantity)}</td><td>${N(i.min_quantity||0)}</td><td>${fmt(itemUnitCost(i))}</td><td>${fmt(vat(itemUnitCost(i)))}</td><td>${fmt(gross(itemUnitCost(i)))}</td><td>${fmt(before)}</td><td>${fmt(gross(before))}</td><td class="row-actions"><button class="light" onclick="inventoryViewProductV347('${escSafe(i.id)}')">عرض</button><button onclick="inventoryEditItem&&inventoryEditItem('${escSafe(i.id)}')">تعديل</button><button class="danger" onclick="financeDelete&&financeDelete('inventory_items','${escSafe(i.id)}')">حذف</button></td></tr>`; }).join('') || '<tr><td colspan="12">لا توجد منتجات متوفرة في المخزون</td></tr>';
  }
  function renderMovements(){
    const b = $id('inventoryMovementsBody'); if(!b) return;
    let rows = A(dataSafe().inventoryMovements).filter(m => !isChildReportOnly(m));
    b.innerHTML = rows.map(m => { const before = N(m.quantity) * (moveCost(m) || fifoUnitCost(m.item_id,m.quantity)); return `<tr><td>${escSafe(S(m.movement_date||m.created_at).slice(0,10))}</td><td><b>${escSafe(m.item_name||itemName(m.item_id))}</b><br><small>${escSafe(m.product_code||productCode(itemById(m.item_id))||'-')}</small></td><td><span class="badge ${isOut(m.movement_type)?'amber':'green'}">${isIn(m.movement_type)?'إدخال':isReturn(m.movement_type)?'مرتجع':'صرف / استهلاك'}</span>${isParentDistributed(m)?'<br><small>موزع</small>':''}</td><td>${N(m.quantity)}</td><td>${escSafe(m.project_name||projectName(m.project_id)||'-')}</td><td>${escSafe(m.receiver||'-')}</td><td>${fmt(before)}</td><td class="row-actions"><button class="light" onclick="inventoryShowMovementV347('${escSafe(m.id)}')">عرض / توزيع</button><button class="light" onclick="v347PrintMovement('${escSafe(m.id)}')">طباعة</button><button class="danger" onclick="financeDelete&&financeDelete('inventory_movements','${escSafe(m.id)}',true)">حذف</button></td></tr>`; }).join('') || '<tr><td colspan="8">لا توجد حركة مخزون</td></tr>';
  }
  window.inventoryRenderItems = renderItems;
  window.inventoryRenderMovements = renderMovements;

  // 6) التقارير: المرتجع لا يدخل تكلفة المشاريع + إجمالي نهاية كل تقرير + طباعة
  function usageRows(){
    const rows = [];
    A(dataSafe().inventoryRequests).filter(r => r.status === 'approved').forEach(r => {
      try{ (typeof v118LineItems === 'function' ? v118LineItems(r) : []).forEach(l => { const cost = N(l.unit_cost || itemUnitCost(itemById(l.item_id))); const before = N(l.quantity) * cost; rows.push({date:S(r.request_date||r.created_at||todaySafe()).slice(0,10), project:r.project_name||projectName(r.project_id)||'بدون مشروع', person:r.supervisor_name||'', code:l.product_code||productCode(itemById(l.item_id)), item:l.item_name||itemName(l.item_id), item_id:l.item_id, qty:N(l.quantity), unit_cost:cost, before, vat:vat(before), gross:gross(before), reason:r.reason||r.notes||'-', type:'أمر صرف معتمد', ref:'REQ-'+r.id}); }); }catch(_){ }
    });
    A(dataSafe().inventoryMovements).forEach(m => {
      if(!isOut(m.movement_type)) return;                // المرتجع لا يدخل
      if(isParentDistributed(m)) return;                 // الأصل الموزع لا يدخل كي لا يتكرر
      if(S(m.reason).includes('طلب معتمد') || S(m.reason).includes('أمر معتمد')) return;
      const cost = moveCost(m) || fifoUnitCost(m.item_id,m.quantity); const before = N(m.quantity) * cost;
      rows.push({date:S(m.movement_date||m.created_at||todaySafe()).slice(0,10), project:m.project_name||projectName(m.project_id)||'بدون مشروع', person:m.receiver||'بدون مستلم', code:m.product_code||productCode(itemById(m.item_id)), item:m.item_name||itemName(m.item_id), item_id:m.item_id, qty:N(m.quantity), unit_cost:cost, before, vat:vat(before), gross:gross(before), reason:S(m.reason||m.notes||'-').replace(/\[PARENT:[^\]]+\]|\[REPORT_ONLY\]/g,'').trim(), type:parentOf(m)?'توزيع صرف على مشروع':'صرف مباشر', ref:'MOV-'+m.id});
    });
    return rows;
  }
  window.v118AllUsageRows = usageRows;
  window.v346UsageRows = usageRows;
  function totalRow(rows, colspan, totalCols=3){ const before = rows.reduce((a,r) => a + N(r.before||0), 0); return `<tr class="v347-total-row"><td colspan="${colspan}">الإجمالي</td><td>${fmt(before)}</td><td>${fmt(vat(before))}</td><td>${fmt(gross(before))}</td>${totalCols>3?'<td></td>'.repeat(totalCols-3):''}</tr>`; }
  function addPrintButtons(){
    const targets = [['stockOutByProjectBody','تقرير تكلفة المشاريع'],['stockOutBySupervisorBody','تقرير الصرف حسب المشرف'],['inventoryUsageDetailBody','تقرير الاستهلاك التفصيلي'],['stockReportBody','تقرير المخزون'],['expenseByProjectBody','تقرير المصروفات حسب المشروع']];
    targets.forEach(([id,title]) => { const tbl = $id(id)?.closest('table'); if(!tbl || tbl.previousElementSibling?.classList?.contains('v347-printbar')) return; tbl.insertAdjacentHTML('beforebegin', `<div class="v347-printbar"><button class="v347-btn light" onclick="v347PrintTable('${id}','${title}')">طباعة PDF</button></div>`); });
  }
  window.v347PrintTable = function(id,title){
    const table = $id(id)?.closest('table'); if(!table) return msgSafe('لا يوجد تقرير للطباعة','err');
    const w = window.open('', '_blank'); if(!w) return msgSafe('اسمح بفتح النوافذ للطباعة','err');
    w.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${escSafe(title)}</title><style>body{font-family:Arial;padding:22px;color:#063d31}h2{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:7px;text-align:center;font-size:12px}th{background:#eaf4ef}.v347-total-row td{font-weight:bold;background:#f1f8f5}</style></head><body><h2>${escSafe(title)}</h2><table>${table.innerHTML}</table><script>print()<\/script></body></html>`); w.document.close();
  };
  window.v347PrintMovement = function(id){ inventoryShowMovementV347(id); setTimeout(() => window.print(), 350); };

  window.financeRenderReports = function(){
    addPrintButtons();
    const qItem = S($id('inventoryReportProduct')?.value), qPerson = S($id('inventoryReportPerson')?.value), mon = S($id('financeMonthFilter')?.value);
    let u = usageRows().filter(r => (!qItem || S(r.item_id) === qItem) && (!qPerson || S(r.person) === qPerson) && (!mon || S(r.date).slice(0,7) === mon));
    const ep = $id('expenseByProjectBody'); if(ep){ let ex = A(dataSafe().financeExpenses); const map = {}; ex.forEach(e => { const k = e.project_name || projectName(e.project_id) || 'بدون مشروع'; const total = N(e.total || e.amount || e.value); map[k] = map[k] || {project:k,count:0,before:0}; map[k].count++; map[k].before += total/(1+VAT); }); const arr = Object.values(map); ep.innerHTML = arr.map(v => `<tr><td>${escSafe(v.project)}</td><td>${fmt(v.before)}</td><td>${fmt(vat(v.before))}</td><td>${fmt(gross(v.before))}</td><td>${v.count}</td></tr>`).join('') + (arr.length ? totalRow(arr,1,4) : '<tr><td colspan="5">لا توجد بيانات</td></tr>'); }
    const sp = $id('stockOutByProjectBody'); if(sp){ const map = {}; u.forEach(r => { const k = r.project+'||'+r.code+'||'+r.item; map[k] = map[k] || {project:r.project,code:r.code,item:r.item,qty:0,before:0}; map[k].qty += N(r.qty); map[k].before += N(r.before); }); const arr = Object.values(map).sort((a,b) => S(a.project).localeCompare(S(b.project),'ar')); sp.innerHTML = arr.map(v => `<tr><td>${escSafe(v.project)}</td><td>${escSafe(v.code||'-')}</td><td><b>${escSafe(v.item||'-')}</b></td><td>${N(v.qty)}</td><td>${fmt(v.before)}</td><td>${fmt(vat(v.before))}</td><td>${fmt(gross(v.before))}</td><td></td></tr>`).join('') + (arr.length ? totalRow(arr,4,4) : '<tr><td colspan="8">لا توجد بيانات</td></tr>'); }
    const sr = $id('stockOutBySupervisorBody'); if(sr){ const map = {}; u.forEach(r => { const k = r.person+'||'+r.project; map[k] = map[k] || {person:r.person,project:r.project,count:0,qty:0,before:0}; map[k].count++; map[k].qty += N(r.qty); map[k].before += N(r.before); }); const arr = Object.values(map); sr.innerHTML = arr.map(v => `<tr><td>${escSafe(v.person||'-')}</td><td>${escSafe(v.project||'-')}</td><td>${v.count}</td><td>${N(v.qty)}</td><td>${fmt(v.before)}</td><td>${fmt(vat(v.before))}</td><td>${fmt(gross(v.before))}</td><td></td></tr>`).join('') + (arr.length ? totalRow(arr,4,4) : '<tr><td colspan="8">لا توجد بيانات</td></tr>'); }
    const ud = $id('inventoryUsageDetailBody'); if(ud){ u.sort((a,b) => S(b.date).localeCompare(S(a.date))); ud.innerHTML = u.map(r => `<tr><td>${escSafe(r.date)}</td><td>${escSafe(r.project)}</td><td>${escSafe(r.person)}</td><td>${escSafe(r.code||'-')}</td><td><b>${escSafe(r.item||'-')}</b></td><td>${fmt(r.unit_cost)}</td><td>${N(r.qty)}</td><td>${fmt(r.before)}</td><td>${fmt(r.vat)}</td><td>${fmt(r.gross)}</td><td>${escSafe(r.reason||'-')}</td><td>${escSafe(r.type||'-')}</td><td>${escSafe(r.ref||'-')}</td></tr>`).join('') + (u.length ? totalRow(u,7,6) : '<tr><td colspan="13">لا توجد بيانات استهلاك</td></tr>'); }
    const stock = $id('stockReportBody'); if(stock){ let items = A(dataSafe().inventoryItems).filter(i => N(i.quantity) > 0); const sup = S($id('inventoryReportSupplier')?.value); if(sup) items = items.filter(i => S(i.supplier) === sup); stock.innerHTML = items.map(i => { const before = N(i.quantity) * itemUnitCost(i); return `<tr><td>${escSafe(productCode(i)||'-')}</td><td><b>${escSafe(i.name||'-')}</b></td><td>${escSafe(i.supplier||'-')}</td><td>${fmt(itemUnitCost(i))}</td><td>${fmt(gross(itemUnitCost(i)))}</td><td>${N(i.quantity)}</td><td>${N(i.min_quantity||0)}</td><td>${fmt(before)}</td><td>${fmt(vat(before))}</td><td>${fmt(gross(before))}</td></tr>`; }).join('') + (items.length ? (()=>{ const arr=items.map(i=>({before:N(i.quantity)*itemUnitCost(i)})); return totalRow(arr,7,3); })() : '<tr><td colspan="10">لا توجد منتجات متوفرة</td></tr>'); }
  };

  function boot(){
    ensureCss(); ensureAutoCode(); addPrintButtons();
    try{ renderItems(); renderMovements(); financeRenderReports(); }catch(e){ console.warn('v347 finance render', e); }
    document.addEventListener('focusin', e => { if(e.target?.id === 'inventoryItemSerial') ensureAutoCode(); });
    document.addEventListener('input', e => { if(['inventoryItemSerial','financeSearch','inventoryReportSupplier','inventoryReportProduct','inventoryReportPerson','financeMonthFilter'].includes(e.target?.id)){ setTimeout(() => { try{ renderItems(); renderMovements(); financeRenderReports(); }catch(_){} }, 100); } });
    document.addEventListener('change', e => { if(['inventoryReportSupplier','inventoryReportProduct','inventoryReportPerson','financeMonthFilter','financeProjectFilter'].includes(e.target?.id)){ setTimeout(() => { try{ renderItems(); renderMovements(); financeRenderReports(); }catch(_){} }, 100); } });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 1200)); else setTimeout(boot, 1200);
})();

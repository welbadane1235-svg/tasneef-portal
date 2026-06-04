/* TASNEEF v346 - SAFE finance/inventory patch
   مبني على v343 بدون لمس إدارة المستخدمين أو الصلاحيات */
(function(){
  if(window.__tasneefV346FinanceInventorySafe) return;
  window.__tasneefV346FinanceInventorySafe = true;

  const VAT = 0.15;
  const A = v => Array.isArray(v) ? v : [];
  const S = v => String(v ?? '').trim();
  const N = v => { const x = Number(String(v ?? '').replace(/,/g,'')); return isFinite(x) ? x : 0; };
  const $id = id => document.getElementById(id);
  const html = v => (typeof esc === 'function' ? esc(v) : S(v).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])));
  const fmt = v => typeof money === 'function' ? money(N(v)) : (N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س');
  const tax = v => +(N(v)*VAT).toFixed(2);
  const gross = v => +(N(v)*(1+VAT)).toFixed(2);
  const todaySafe = () => typeof today === 'function' ? today() : new Date().toISOString().slice(0,10);
  const say = (t,c) => { try{ (window.msg||alert)(t,c); }catch(_){ alert(t); } };
  const ds = () => window.data || {};
  const itemById = id => A(ds().inventoryItems).find(i=>S(i.id)===S(id)) || {};
  const projectById = id => A(ds().projects).find(p=>S(p.id)===S(id)) || {};
  const projectNameSafe = id => {
    try{ if(typeof financeProjectName==='function') return financeProjectName(id); }catch(_){ }
    const p = projectById(id); return p.name || p.project_name || p.title || (id?S(id):'');
  };
  const itemCode = i => S(i?.serial_number || i?.product_code || i?.barcode || i?.supplier_barcode || '');
  const itemCost = i => N(i?.unit_cost || i?.price_before_vat || i?.unit_before || i?.price || 0);
  const movementCost = m => N(m?.unit_cost || m?.unit_cost_override || itemById(m?.item_id).unit_cost || 0);
  const isOut = t => ['out','consume','صرف','استهلاك'].includes(S(t));
  const isIn = t => ['in','إدخال','ادخال'].includes(S(t));
  const isReturn = t => ['return','مرتجع','إرجاع','ارجاع'].includes(S(t));
  const parentTag = id => `[PARENT:${id}]`;
  const parentOf = m => (S(m?.notes).match(/\[PARENT:([^\]]+)\]/)||[])[1] || '';
  const isDistributedParent = m => /\[DISTRIBUTED_PARENT\]/.test(S(m?.notes)+' '+S(m?.reason));
  const isReportOnlyChild = m => /\[REPORT_ONLY\]/.test(S(m?.notes)) || !!parentOf(m);
  const allMovesForItem = id => A(ds().inventoryMovements).filter(m=>S(m.item_id)===S(id));

  function ensureCss(){
    if($id('v346FinanceCss')) return;
    const st = document.createElement('style'); st.id='v346FinanceCss';
    st.textContent = `
      .v346-modal{position:fixed;inset:0;background:rgba(0,35,28,.55);z-index:999999;display:grid;place-items:center;padding:18px;backdrop-filter:blur(4px)}
      .v346-panel{background:#fff;border-radius:22px;border:1px solid #d6e6e0;width:min(1120px,96vw);max-height:92vh;overflow:auto;direction:rtl;box-shadow:0 25px 70px rgba(0,0,0,.25)}
      .v346-head{position:sticky;top:0;background:#fff;border-bottom:1px solid #dbe8e3;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:10px;z-index:2}.v346-head h2{margin:0;color:#063d31}
      .v346-body{padding:16px}.v346-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}.v346-box{border:1px solid #dbe8e3;background:#f9fcfb;border-radius:14px;padding:12px}.v346-box small{display:block;color:#60756f;margin-bottom:5px}.v346-box b{font-size:18px;color:#063d31}
      .v346-table{width:100%;border-collapse:separate;border-spacing:0 8px}.v346-table th{background:#f2f8f6;color:#063d31;padding:9px;text-align:center}.v346-table td{background:#fff;border-top:1px solid #dbe8e3;border-bottom:1px solid #dbe8e3;padding:9px;text-align:center}.v346-table td:first-child{border-right:1px solid #dbe8e3;border-radius:0 12px 12px 0}.v346-table td:last-child{border-left:1px solid #dbe8e3;border-radius:12px 0 0 12px}
      .v346-btn{border:0;border-radius:10px;background:#064737;color:#fff;padding:9px 14px;font-weight:800;cursor:pointer}.v346-btn.light{background:#eef8f5;color:#064737;border:1px solid #d4e6e0}.v346-btn.red{background:#b83232}.v346-split{display:grid;grid-template-columns:1.3fr .55fr .8fr .8fr 1.2fr auto;gap:8px;align-items:end;border:1px dashed #d6e6e0;border-radius:14px;padding:10px;margin:8px 0}.v346-split input,.v346-split select{width:100%;height:40px;border:1px solid #d7e5e0;border-radius:10px;padding:6px 8px}.v346-total-row td{font-weight:900;background:#f4fbf8!important;color:#063d31}.v346-printbar{display:flex;justify-content:flex-end;gap:8px;margin:10px 0;flex-wrap:wrap}
      @media(max-width:850px){.v346-split{grid-template-columns:1fr}}
    `;
    document.head.appendChild(st);
  }
  function modal(title, body){ ensureCss(); document.querySelector('.v346-modal')?.remove(); const d=document.createElement('div'); d.className='v346-modal'; d.innerHTML=`<div class="v346-panel"><div class="v346-head"><h2>${html(title)}</h2><button class="v346-btn red" onclick="this.closest('.v346-modal').remove()">إغلاق</button></div><div class="v346-body">${body}</div></div>`; document.body.appendChild(d); }
  function projectOptions(sel=''){ return '<option value="">اختر المشروع</option>'+A(ds().projects).map(p=>`<option value="${html(p.id)}" ${S(sel)===S(p.id)?'selected':''}>${html(p.name||p.project_name||p.title||p.id)}</option>`).join(''); }

  function nextProductCode(){
    let max=0; A(ds().inventoryItems).forEach(i=>{ const m=S(itemCode(i)).match(/PRD-(\d+)/i); if(m) max=Math.max(max,Number(m[1])); });
    return 'PRD-'+String(max+1).padStart(5,'0');
  }
  function ensureAutoProductCode(){
    const el=$id('inventoryItemSerial'); if(el && !S(el.value)) el.value = nextProductCode();
  }

  function fifoBatches(item){
    const id = item.id;
    const moves = allMovesForItem(id).sort((a,b)=>S(a.movement_date||a.created_at).localeCompare(S(b.movement_date||b.created_at)) || N(a.id)-N(b.id));
    const ins = moves.filter(m=>isIn(m.movement_type)).map((m,idx)=>({
      label:'الدفعة '+(idx+1), ref:'MOV-'+m.id, date:S(m.movement_date||m.created_at).slice(0,10), qty:N(m.quantity), cost:movementCost(m)||itemCost(item), remaining:N(m.quantity)
    }));
    const totalOut = moves.filter(m=>isOut(m.movement_type) && !isReportOnlyChild(m)).reduce((a,m)=>a+N(m.quantity),0);
    const totalRet = moves.filter(m=>isReturn(m.movement_type)).reduce((a,m)=>a+N(m.quantity),0);
    if(!ins.length){
      const original = Math.max(N(item.quantity)+totalOut-totalRet, N(item.quantity));
      ins.push({label:'الدفعة الأولى / تأسيسية', ref:'رصيد المنتج', date:'-', qty:original, cost:itemCost(item), remaining:original});
    }
    let consume = totalOut;
    for(const b of ins){ const take=Math.min(b.remaining, consume); b.remaining-=take; consume-=take; }
    if(totalRet>0){ for(const b of ins){ if(totalRet<=0) break; const room=b.qty-b.remaining; const back=Math.min(room,totalRet); b.remaining+=back; } }
    return ins;
  }
  function fifoCostForQty(itemId, qty){
    const it=itemById(itemId); let need=N(qty), total=0;
    for(const b of fifoBatches(it)){ if(need<=0) break; if(b.remaining<=0) continue; const take=Math.min(need,b.remaining); total += take*N(b.cost); need-=take; }
    if(need>0) total += need*itemCost(it);
    return N(qty)>0 ? +(total/N(qty)).toFixed(2) : itemCost(it);
  }

  window.inventoryViewProductV346 = function(id){
    const it=itemById(id); if(!it.id) return say('المنتج غير موجود','err');
    const batches=fifoBatches(it);
    const rows=batches.map((b,i)=>{ const before=b.remaining*N(b.cost); return `<tr><td>${html(b.label)}</td><td>${html(b.ref)}</td><td>${html(b.date)}</td><td>${N(b.qty)}</td><td>${N(b.qty-b.remaining)}</td><td>${N(b.remaining)}</td><td>${fmt(b.cost)}</td><td>${fmt(tax(b.cost))}</td><td>${fmt(gross(b.cost))}</td><td>${fmt(before)}</td><td>${fmt(tax(before))}</td><td>${fmt(gross(before))}</td></tr>`; }).join('') || '<tr><td colspan="12">لا توجد دفعات</td></tr>';
    const remainVal = batches.reduce((a,b)=>a+N(b.remaining)*N(b.cost),0);
    const img = it.image_url ? `<img src="${html(it.image_url)}" style="width:145px;height:145px;object-fit:contain;border:1px solid #dbe8e3;border-radius:18px;background:#fff">` : '';
    modal('عرض المنتج: '+(it.name||''), `<div style="display:flex;gap:16px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap"><div class="v346-grid" style="flex:1"> <div class="v346-box"><small>اسم المنتج</small><b>${html(it.name||'-')}</b></div><div class="v346-box"><small>الكود الداخلي</small><b>${html(itemCode(it)||'-')}</b></div><div class="v346-box"><small>المورد</small><b>${html(it.supplier||'-')}</b></div><div class="v346-box"><small>المتبقي</small><b>${N(it.quantity)} ${html(it.unit||'')}</b></div><div class="v346-box"><small>سعر الحبة قبل الضريبة</small><b>${fmt(itemCost(it))}</b></div><div class="v346-box"><small>ضريبة الحبة</small><b>${fmt(tax(itemCost(it)))}</b></div><div class="v346-box"><small>سعر الحبة شامل</small><b>${fmt(gross(itemCost(it)))}</b></div><div class="v346-box"><small>إجمالي المتبقي شامل</small><b>${fmt(gross(remainVal))}</b></div></div>${img}</div><h3>دفعات المنتج حسب FIFO</h3><div class="table-wrap"><table class="v346-table"><thead><tr><th>الدفعة</th><th>المرجع</th><th>التاريخ</th><th>دخل</th><th>خرج FIFO</th><th>متبقي</th><th>سعر قبل</th><th>ضريبة الحبة</th><th>سعر شامل</th><th>إجمالي قبل</th><th>الضريبة</th><th>الإجمالي شامل</th></tr></thead><tbody>${rows}</tbody></table></div>`);
  };
  window.v118ShowProductDetail = window.inventoryViewProductV346;
  window.inventoryOpenItemSmart = window.inventoryViewProductV346;

  window.inventoryAddSplitLineV346 = function(itemId, row){
    const box=$id('v346SplitLines'); if(!box) return;
    const cost=N(row?.unit_cost || fifoCostForQty(itemId, row?.quantity || 1));
    box.insertAdjacentHTML('beforeend', `<div class="v346-split" data-v346-line="1"><div><label>المشروع</label><select class="v346-project">${projectOptions(row?.project_id||'')}</select></div><div><label>الكمية</label><input class="v346-qty" type="number" step="0.01" value="${N(row?.quantity||1)}"></div><div><label>النوع</label><select class="v346-type"><option value="out" ${!isReturn(row?.movement_type)?'selected':''}>صرف / استهلاك</option><option value="return" ${isReturn(row?.movement_type)?'selected':''}>مرتجع</option></select></div><div><label>سعر الحبة قبل الضريبة</label><input class="v346-cost" type="number" step="0.01" value="${cost}"></div><div><label>ملاحظة</label><input class="v346-note" value="${html(row?.note||row?.notes||'')}"></div><button class="v346-btn red" type="button" onclick="this.closest('[data-v346-line]').remove()">حذف</button></div>`);
  };

  window.inventoryShowMovementV346 = function(id){
    const m=A(ds().inventoryMovements).find(x=>S(x.id)===S(id)); if(!m) return say('الحركة غير موجودة','err');
    const it=itemById(m.item_id); const children=A(ds().inventoryMovements).filter(x=>S(parentOf(x))===S(id));
    const baseRows = children.length ? children.map(c=>({project_id:c.project_id,quantity:c.quantity,movement_type:c.movement_type,unit_cost:movementCost(c),notes:S(c.notes).replace(/\[PARENT:[^\]]+\]|\[REPORT_ONLY\]/g,'').trim()})) : [{project_id:m.project_id,quantity:m.quantity,movement_type:m.movement_type,unit_cost:movementCost(m)||fifoCostForQty(m.item_id,m.quantity),notes:m.notes||''}];
    modal('عرض / توزيع حركة مخزون MOV-'+id, `<div class="v346-grid"><div class="v346-box"><small>المنتج</small><b>${html(m.item_name||it.name||'-')}</b></div><div class="v346-box"><small>التاريخ</small><b>${html(m.movement_date||'-')}</b></div><div class="v346-box"><small>الكمية الأصلية</small><b>${N(m.quantity)}</b></div><div class="v346-box"><small>سعر FIFO المقترح</small><b>${fmt(fifoCostForQty(m.item_id,m.quantity))}</b></div></div><h3>توزيع الحركة على المشاريع</h3><p class="muted">إذا لم تضف مرتجعًا ستبقى كل الأسطر صرفًا وتدخل في تكلفة المشروع. المرتجع يرجع للمخزون ولا يظهر في تقرير تكلفة المشاريع.</p><div id="v346SplitLines"></div><button class="v346-btn light" onclick="inventoryAddSplitLineV346('${html(m.item_id)}')">+ إضافة مشروع</button><button class="v346-btn" style="margin-inline-start:8px" onclick="inventorySaveMovementSplitV346('${html(id)}',this)">حفظ التوزيع</button>`);
    setTimeout(()=>baseRows.forEach(r=>window.inventoryAddSplitLineV346(m.item_id,r)),0);
  };

  window.inventorySaveMovementSplitV346 = async function(id,btn){
    try{
      if(btn) btn.disabled=true;
      const parent=A(ds().inventoryMovements).find(x=>S(x.id)===S(id)); if(!parent) throw new Error('الحركة غير موجودة');
      const lines=[...document.querySelectorAll('[data-v346-line]')].map(el=>({
        project_id: el.querySelector('.v346-project')?.value || null,
        quantity: N(el.querySelector('.v346-qty')?.value),
        movement_type: el.querySelector('.v346-type')?.value || 'out',
        unit_cost: N(el.querySelector('.v346-cost')?.value),
        note: S(el.querySelector('.v346-note')?.value)
      })).filter(x=>x.quantity>0);
      if(!lines.length) throw new Error('أضف سطر توزيع واحد على الأقل');
      const totalOut = lines.filter(x=>!isReturn(x.movement_type)).reduce((a,x)=>a+x.quantity,0);
      if(totalOut > N(parent.quantity)+0.0001) throw new Error('إجمالي الصرف أكبر من كمية الحركة الأصلية');
      const old=A(ds().inventoryMovements).filter(x=>S(parentOf(x))===S(id));
      if(old.length){ const del=await sb.from('inventory_movements').delete().in('id', old.map(x=>x.id)); if(del.error) throw del.error; }
      const rows=lines.map(l=>{
        const pn = l.project_id ? projectNameSafe(l.project_id) : '';
        return { item_id: parent.item_id, item_name: parent.item_name, product_code: parent.product_code || itemCode(itemById(parent.item_id)), barcode: parent.barcode || '', movement_type: l.movement_type, quantity: l.quantity, movement_date: parent.movement_date || todaySafe(), project_id: l.project_id ? Number(l.project_id) : null, project_name: pn, receiver: parent.receiver || '', reason: (l.movement_type==='return'?'مرتجع من توزيع الحركة':'توزيع صرف على مشروع'), notes: `${parentTag(id)}[REPORT_ONLY] ${l.note}`.trim(), unit_cost: l.unit_cost || fifoCostForQty(parent.item_id,l.quantity) };
      });
      const ins=await sb.from('inventory_movements').insert(rows); if(ins.error) throw ins.error;
      const upd=await sb.from('inventory_movements').update({notes:`${S(parent.notes)} [DISTRIBUTED_PARENT]`.trim()}).eq('id',id); if(upd.error) throw upd.error;
      say('تم حفظ توزيع الحركة'); document.querySelector('.v346-modal')?.remove(); await financeLoadAll();
    }catch(e){ say(e.message||String(e),'err'); } finally{ if(btn) btn.disabled=false; }
  };

  const oldSaveItem = window.inventorySaveItem;
  window.inventorySaveItem = async function(btn){ ensureAutoProductCode(); return oldSaveItem ? oldSaveItem.apply(this,arguments) : undefined; };

  const oldSaveMove = window.inventorySaveMovement;
  window.inventorySaveMovement = async function(btn){
    // نحافظ على الدالة الأصلية ونضيف فقط سعر FIFO عند الصرف إن كان الحقل ناقصًا
    try{
      const itemId=$id('inventoryMovementItem')?.value; const type=$id('inventoryMovementType')?.value||'out';
      if(itemId && isOut(type)) window.__tasneefLastFifoCost = fifoCostForQty(itemId, N($id('inventoryMovementQty')?.value||1));
    }catch(_){ }
    return oldSaveMove ? oldSaveMove.apply(this,arguments) : undefined;
  };

  window.inventoryRenderItems = function(){
    const b=$id('inventoryItemsBody'); if(!b) return;
    let rows=A(ds().inventoryItems).filter(i=>N(i.quantity)>0);
    const q=S($id('financeSearch')?.value); const supplier=S($id('inventoryReportSupplier')?.value);
    if(q) rows=rows.filter(i=>[i.name,itemCode(i),i.barcode,i.supplier_barcode,i.category,i.supplier,i.notes,i.item_type,i.type].join(' ').includes(q));
    if(supplier) rows=rows.filter(i=>S(i.supplier)===supplier);
    b.innerHTML=rows.map(i=>{
      const img=i.image_url?`<div class="inventory-img-box"><img src="${html(i.image_url)}" class="inventory-thumb inventory-product-img" onclick="inventoryOpenProductImage&&inventoryOpenProductImage('${html(i.id)}')"></div>`:'<span class="inventory-image-empty">لا توجد</span>';
      return `<tr><td>${img}</td><td>${html(itemCode(i)||'-')}</td><td>${html(i.barcode||i.supplier_barcode||'-')}</td><td><b>${html(i.name||'')}</b></td><td>${html(i.category||'')}</td><td>${html(i.item_type||i.type||'-')}</td><td>${N(i.quantity)<=N(i.min_quantity)?`<span class="badge red">${N(i.quantity)}</span>`:N(i.quantity)}</td><td>${html(i.unit||'')}</td><td>${N(i.min_quantity)}</td><td>${fmt(itemCost(i))}</td><td>${html(i.supplier||'-')}</td><td class="row-actions"><button class="light" onclick="inventoryViewProductV346('${html(i.id)}')">عرض</button><button onclick="inventoryEditItem('${html(i.id)}')">تعديل</button><button class="danger" onclick="financeDelete('inventory_items','${html(i.id)}')">حذف</button></td></tr>`;
    }).join('') || '<tr><td colspan="12">لا توجد أصناف متوفرة في المخزون</td></tr>';
    try{ inventoryFillItemSelect(); inventoryFillRequestSelect(); }catch(_){ }
  };

  window.inventoryRenderMovements = function(){
    const b=$id('inventoryMovementsBody'); if(!b) return;
    let rows=A(ds().inventoryMovements).filter(m=>!isReportOnlyChild(m));
    try{ if(typeof financeFilterRows==='function') rows=financeFilterRows(rows,'movement_date'); }catch(_){ }
    b.innerHTML=rows.map(m=>{ const type=isIn(m.movement_type)?'إدخال':isReturn(m.movement_type)?'مرتجع':isOut(m.movement_type)?'صرف / استهلاك':'تعديل'; const cls=isOut(m.movement_type)?'amber':'green'; const before=N(m.quantity)*movementCost(m); return `<tr><td>${html(m.movement_date||'')}</td><td><b>${html(m.item_name||itemById(m.item_id).name||'-')}</b><br><small>${html(m.product_code||itemCode(itemById(m.item_id)))}</small></td><td><span class="badge ${cls}">${type}</span>${isDistributedParent(m)?'<br><small class="muted">موزع على مشاريع</small>':''}</td><td>${N(m.quantity)}</td><td>${html(m.project_name||projectNameSafe(m.project_id)||'-')}</td><td>${html(m.receiver||'-')}</td><td>${fmt(before)}</td><td class="row-actions"><button class="light" onclick="inventoryShowMovementV346('${html(m.id)}')">عرض / توزيع</button><button class="light" onclick="inventoryPrintMovement&&inventoryPrintMovement('${html(m.id)}')">طباعة</button><button class="danger" onclick="financeDelete('inventory_movements','${html(m.id)}',true)">حذف</button></td></tr>`; }).join('') || '<tr><td colspan="8">لا توجد حركة مخزون</td></tr>';
  };

  window.v346UsageRows = function(){
    const rows=[];
    A(ds().inventoryRequests).filter(r=>r.status==='approved').forEach(r=>{ try{ (typeof v118LineItems==='function'?v118LineItems(r):[]).forEach(l=>{ const cost=N(l.unit_cost||itemById(l.item_id).unit_cost); rows.push({date:S(r.request_date||r.created_at||todaySafe()).slice(0,10),project:r.project_name||projectNameSafe(r.project_id),person:r.supervisor_name||'',item:l.item_name,item_id:l.item_id,product_code:l.product_code,qty:N(l.quantity),unit_cost:cost,before:N(l.quantity)*cost,reason:r.reason||r.notes||'-',type:'أمر صرف معتمد',ref:'REQ-'+r.id}); }); }catch(_){ } });
    A(ds().inventoryMovements).forEach(m=>{
      if(!isOut(m.movement_type)) return; if(isDistributedParent(m)) return;
      if(S(m.reason).includes('طلب معتمد') || S(m.reason).includes('أمر معتمد')) return;
      const cost=movementCost(m); rows.push({date:S(m.movement_date||m.created_at||todaySafe()).slice(0,10),project:m.project_name||projectNameSafe(m.project_id)||'بدون مشروع',person:m.receiver||'بدون مستلم',item:m.item_name||itemById(m.item_id).name,item_id:m.item_id,product_code:m.product_code||itemCode(itemById(m.item_id)),qty:N(m.quantity),unit_cost:cost,before:N(m.quantity)*cost,reason:S(m.reason||m.notes||'-').replace(/\[PARENT:[^\]]+\]|\[REPORT_ONLY\]/g,'').trim(),type:parentOf(m)?'توزيع صرف على مشروع':'صرف مباشر',ref:'MOV-'+m.id});
    });
    return rows.map(r=>({...r, vat:tax(r.before), gross:gross(r.before)}));
  };
  window.v118AllUsageRows = window.v346UsageRows;

  function totalCells(rows, colspan){ const before=rows.reduce((a,r)=>a+N(r.before||r.val||0),0); return `<tr class="v346-total-row"><td colspan="${colspan}">الإجمالي</td><td>${fmt(before)}</td><td>${fmt(tax(before))}</td><td>${fmt(gross(before))}</td><td></td></tr>`; }
  function ensurePrintButtons(){
    const map=[['stockOutByProjectBody','تقرير تكلفة المشاريع'],['stockOutBySupervisorBody','تقرير الصرف حسب المشرف'],['inventoryUsageDetailBody','تقرير الاستهلاك التفصيلي'],['stockReportBody','تقرير المخزون']];
    map.forEach(([id,title])=>{ const table=$id(id)?.closest('table'); if(!table || table.previousElementSibling?.classList?.contains('v346-printbar')) return; table.insertAdjacentHTML('beforebegin',`<div class="v346-printbar"><button class="v346-btn light" onclick="v346PrintTable('${id}','${title}')">طباعة PDF</button></div>`); });
  }
  window.v346PrintTable = function(id,title){
    const table=$id(id)?.closest('table'); if(!table) return say('لا يوجد تقرير للطباعة','err');
    const totals = id==='stockReportBody' ? ($id('stockReportTotals')?.outerHTML||'') : '';
    const w=window.open('','_blank'); if(!w) return say('اسمح بفتح النوافذ للطباعة','err');
    w.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${html(title)}</title><style>body{font-family:Arial;padding:22px;color:#063d31}h2{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:7px;text-align:center;font-size:12px}th{background:#eaf4ef}.v346-total-row td{font-weight:bold;background:#f1f8f5}</style></head><body><h2>${html(title)}</h2><table>${table.innerHTML}</table>${totals}<script>print()<\/script></body></html>`); w.document.close();
  };

  window.financeRenderReports = function(){
    ensurePrintButtons();
    const usage=window.v346UsageRows();
    const qItem=S($id('inventoryReportProduct')?.value), qPerson=S($id('inventoryReportPerson')?.value);
    const mon=S($id('financeMonthFilter')?.value);
    let u=usage.filter(r=>(!qItem||S(r.item_id)===qItem)&&(!qPerson||S(r.person)===qPerson)&&(!mon||S(r.date).slice(0,7)===mon));
    const ep=$id('expenseByProjectBody'); if(ep){ let ex=A(ds().financeExpenses); try{ if(typeof financeFilterRows==='function') ex=financeFilterRows(ex,'expense_date'); }catch(_){} const map={}; ex.forEach(e=>{ const k=e.project_name||projectNameSafe(e.project_id)||'بدون مشروع'; const total=N(e.total); map[k]=map[k]||{count:0,before:0}; map[k].count++; map[k].before += total/(1+VAT); }); const arr=Object.entries(map).sort((a,b)=>b[1].before-a[1].before); ep.innerHTML=arr.map(([k,v])=>`<tr><td>${html(k)}</td><td>${fmt(v.before)}</td><td>${fmt(tax(v.before))}</td><td>${fmt(gross(v.before))}</td><td>${v.count}</td></tr>`).join('')||'<tr><td colspan="5">لا توجد بيانات</td></tr>'; }
    const sp=$id('stockOutByProjectBody'); if(sp){ const map={}; u.forEach(r=>{ const k=r.project+'||'+r.product_code+'||'+r.item; map[k]=map[k]||{project:r.project,code:r.product_code,item:r.item,qty:0,before:0}; map[k].qty+=N(r.qty); map[k].before+=N(r.before); }); const arr=Object.values(map).sort((a,b)=>S(a.project).localeCompare(S(b.project),'ar')); sp.innerHTML=arr.map(v=>`<tr><td>${html(v.project)}</td><td>${html(v.code||'-')}</td><td><b>${html(v.item||'-')}</b></td><td>${N(v.qty)}</td><td>${fmt(v.before)}</td><td>${fmt(tax(v.before))}</td><td>${fmt(gross(v.before))}</td><td></td></tr>`).join('') + (arr.length?totalCells(arr,4):'<tr><td colspan="8">لا توجد بيانات</td></tr>'); }
    const sr=$id('stockOutBySupervisorBody'); if(sr){ const map={}; u.forEach(r=>{ const k=r.person+'||'+r.project; map[k]=map[k]||{person:r.person,project:r.project,count:0,qty:0,before:0}; map[k].count++; map[k].qty+=N(r.qty); map[k].before+=N(r.before); }); const arr=Object.values(map); sr.innerHTML=arr.map(v=>`<tr><td>${html(v.person||'-')}</td><td>${html(v.project||'-')}</td><td>${v.count}</td><td>${N(v.qty)}</td><td>${fmt(v.before)}</td><td>${fmt(tax(v.before))}</td><td>${fmt(gross(v.before))}</td><td></td></tr>`).join('') + (arr.length?totalCells(arr,4):'<tr><td colspan="8">لا توجد بيانات</td></tr>'); }
    const ud=$id('inventoryUsageDetailBody'); if(ud){ u.sort((a,b)=>S(b.date).localeCompare(S(a.date))); ud.innerHTML=u.map(r=>`<tr><td>${html(r.date)}</td><td>${html(r.project)}</td><td>${html(r.person)}</td><td>${html(r.product_code||'-')}</td><td><b>${html(r.item||'-')}</b></td><td>${fmt(r.unit_cost)}</td><td>${N(r.qty)}</td><td>${fmt(r.before)}</td><td>${fmt(r.vat)}</td><td>${fmt(r.gross)}</td><td>${html(r.reason||'-')}</td><td>${html(r.type||'-')}</td><td>${html(r.ref||'-')}</td></tr>`).join('') + (u.length?totalCells(u,7):'<tr><td colspan="13">لا توجد بيانات استهلاك</td></tr>'); }
    const stock=$id('stockReportBody'); if(stock){ let items=A(ds().inventoryItems).filter(i=>N(i.quantity)>0); const sup=S($id('inventoryReportSupplier')?.value); if(sup) items=items.filter(i=>S(i.supplier)===sup); stock.innerHTML=items.map(i=>{ const before=N(i.quantity)*itemCost(i); return `<tr><td>${html(itemCode(i)||'-')}</td><td><b>${html(i.name||'-')}</b></td><td>${html(i.supplier||'-')}</td><td>${fmt(itemCost(i))}</td><td>${fmt(gross(itemCost(i)))}</td><td>${N(i.quantity)}</td><td>${N(i.min_quantity)}</td><td>${fmt(before)}</td><td>${fmt(tax(before))}</td><td>${fmt(gross(before))}</td></tr>`; }).join('')||'<tr><td colspan="10">لا توجد منتجات متوفرة</td></tr>'; const sub=items.reduce((a,i)=>a+N(i.quantity)*itemCost(i),0); if($id('stockReportTotals')) $id('stockReportTotals').innerHTML=`إجمالي قبل الضريبة: <b>${fmt(sub)}</b> | الضريبة: <b>${fmt(tax(sub))}</b> | الإجمالي شامل الضريبة: <b>${fmt(gross(sub))}</b>`; }
    try{ if(typeof v118FillReportFilters==='function') v118FillReportFilters(); }catch(_){ }
  };

  function boot(){
    ensureCss(); ensurePrintButtons();
    document.addEventListener('input', e=>{ if(['inventoryItemCost','inventoryMovementQty','financeSearch','inventoryReportSupplier','inventoryReportProduct','inventoryReportPerson','financeMonthFilter'].includes(e.target?.id)){ setTimeout(()=>{ try{ financeRenderReports(); inventoryRenderItems(); inventoryRenderMovements(); }catch(_){} },80); } });
    document.addEventListener('change', e=>{ if(['inventoryReportSupplier','inventoryReportProduct','inventoryReportPerson','financeMonthFilter','financeProjectFilter'].includes(e.target?.id)){ setTimeout(()=>{ try{ financeRenderReports(); inventoryRenderItems(); inventoryRenderMovements(); }catch(_){} },80); } });
    if($id('financeDashboard')){ try{ inventoryRenderItems(); inventoryRenderMovements(); financeRenderReports(); }catch(e){ console.warn('v346 finance safe render',e); } }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,1000)); else setTimeout(boot,1000);
})();

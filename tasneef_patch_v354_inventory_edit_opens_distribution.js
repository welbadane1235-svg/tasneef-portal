/* TASNEEF v354 - Movement line edit opens the distribution form directly
   نطاق التعديل: حركة المخزون فقط.
   عند الضغط على تعديل داخل منتجات الحركة يتم فتح/الانتقال مباشرة إلى نموذج توزيع الكمية لنفس المنتج،
   ثم زر الحفظ يعدل نفس السطر ولا يكرر التكلفة.
*/
(function(){
  'use strict';
  if(window.__tasneefV354InventoryEditDistribution) return;
  window.__tasneefV354InventoryEditDistribution = true;

  const LS_MOVES = 'tasneef_v312_moves';
  const S = v => String(v ?? '').trim();
  const N = v => { const x = Number(S(v).replace(/,/g,'')); return Number.isFinite(x) ? x : 0; };
  const E = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const parse = (k,d=[]) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch(_) { return d; } };
  const save = (k,v) => localStorage.setItem(k, JSON.stringify(v));
  const moves = () => parse(LS_MOVES, []);
  const setMoves = v => save(LS_MOVES, v);
  const OUT_TYPES = new Set(['صرف','استهلاك','هدر','تالف','سكراب']);

  function css(){
    if(document.getElementById('v354MovementEditCss')) return;
    const st = document.createElement('style');
    st.id = 'v354MovementEditCss';
    st.textContent = `
      .v354-editing-box{outline:3px solid #f3bd2f!important;box-shadow:0 0 0 6px rgba(243,189,47,.18)!important;background:#fffdf2!important}
      .v354-edit-note{background:#fff4ce;border:1px dashed #d49a00;border-radius:12px;padding:9px;margin:8px 0;color:#6b4b00;font-weight:900;font-size:13px}
      .v354-edit-move-btn,.v353-edit-move-btn{background:#eef8f5!important;color:#064737!important;border:1px solid #cfe4dc!important;border-radius:10px!important;padding:7px 12px!important;font-weight:900!important;margin:4px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:58px!important;cursor:pointer!important}
    `;
    document.head.appendChild(st);
  }

  function parseDeleteButton(btn){
    const oc = btn?.getAttribute('onclick') || '';
    let m = oc.match(/v337DeleteLine\(['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\)/);
    if(m) return {kind:'local', id:m[1], batch:m[2]};
    m = oc.match(/financeDelete\(['"]inventory_movements['"]\s*,\s*['"]([^'"]+)['"]/);
    if(m) return {kind:'supabase', id:m[1]};
    return null;
  }

  function findDeleteForEditButton(btn){
    const direct = btn?.parentElement?.querySelector('button[onclick*="v337DeleteLine"],button[onclick*="financeDelete"],button.v337-danger');
    if(direct) return direct;
    const next = btn?.nextElementSibling;
    if(next && /حذف/.test(S(next.textContent))) return next;
    const zone = btn?.closest('.v337-line,.v337-product,td,tr,div');
    return zone?.querySelector('button[onclick*="v337DeleteLine"],button[onclick*="financeDelete"],button.v337-danger') || null;
  }

  function setVal(id, val){
    const el = document.getElementById(id);
    if(!el) return false;
    el.value = val ?? '';
    try{ el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); }catch(_){ }
    return true;
  }

  function projectNameFromRow(row){
    if(row.project_name) return row.project_name;
    try{
      const ps = Array.isArray(window.data?.projects) ? window.data.projects : [];
      const p = ps.find(x => S(x.id) === S(row.project_id));
      return p?.name || p?.project_name || p?.title || '';
    }catch(_){ return ''; }
  }

  function fillDistributionForm(row){
    css();
    const itemId = S(row.item_id);
    if(!itemId) return false;
    const addBox = document.getElementById(`v337AddQty_${itemId}`)?.closest('.v337-add');
    if(!addBox) return false;

    window.__v354EditingMovementLine = { id:S(row.id), batch:S(row.batch_id || row.id), itemId };

    setVal(`v337AddType_${itemId}`, row.type || 'صرف');
    setVal(`v337AddQty_${itemId}`, N(row.qty || row.quantity));
    setVal(`v337AddCost_${itemId}`, row.cost_type || 'FM');
    try{ if(typeof window.v337CostChanged === 'function') window.v337CostChanged(itemId); }catch(_){ }
    setVal(`v337AddUnit_${itemId}`, N(row.unit_cost_override || row.unit_cost || 0));
    setVal(`v337AddNotes_${itemId}`, S(row.notes || '').replace('[PENDING_DISTRIBUTION]','').replace('[ALLOCATED]','').replace('[RETURN]','').trim());

    const ct = S(row.cost_type || 'FM');
    if(ct === 'FM') setVal(`v337AddProject_${itemId}`, row.project_id || '');
    else if(ct === 'CN') setVal(`v337AddOrder_${itemId}`, row.order_no || '');
    else setVal(`v337AddGeneralNote_${itemId}`, row.general_note || 'عام');

    addBox.classList.add('v354-editing-box');
    addBox.querySelector('.v354-edit-note')?.remove();
    const note = document.createElement('div');
    note.className = 'v354-edit-note';
    note.textContent = 'أنت الآن تعدّل توزيع هذا السطر. عدّل البيانات ثم اضغط حفظ تعديل التوزيع.';
    addBox.insertBefore(note, addBox.firstChild);

    const btn = addBox.querySelector('button[onclick*="v337AddAllocation"]');
    if(btn){
      btn.dataset.v354OldText = btn.dataset.v354OldText || btn.textContent;
      btn.textContent = 'حفظ تعديل التوزيع';
      btn.style.background = '#0b4b3d';
    }

    try{ addBox.scrollIntoView({behavior:'smooth', block:'center'}); }catch(_){ addBox.scrollIntoView(); }
    const q = document.getElementById(`v337AddQty_${itemId}`);
    setTimeout(()=>{ try{ q?.focus(); q?.select(); }catch(_){ } }, 250);
    return true;
  }

  function openDistributionFromLine(id, batch){
    const row = moves().find(x => S(x.id) === S(id));
    if(!row){ alert('لم يتم العثور على سطر الحركة للتعديل'); return; }
    const b = batch || row.batch_id || row.id;
    const tryFill = () => fillDistributionForm(row);
    if(!tryFill() && typeof window.v337OpenMove === 'function'){
      try{ window.v337OpenMove(b); }catch(_){ }
    }
    setTimeout(tryFill, 90);
    setTimeout(tryFill, 260);
    setTimeout(tryFill, 700);
  }

  const oldAddAllocation = window.v337AddAllocation;
  function wrapAddAllocation(){
    if(typeof window.v337AddAllocation !== 'function') return;
    if(window.v337AddAllocation.__v354Wrapped) return;
    const original = window.v337AddAllocation;
    window.v337AddAllocation = function(batch, itemId){
      const edit = window.__v354EditingMovementLine;
      if(edit && S(edit.batch) === S(batch) && S(edit.itemId) === S(itemId)){
        const ms = moves();
        const idx = ms.findIndex(x => S(x.id) === S(edit.id));
        if(idx < 0){
          window.__v354EditingMovementLine = null;
          return original.apply(this, arguments);
        }
        const row = ms[idx];
        const qty = N(document.getElementById(`v337AddQty_${itemId}`)?.value);
        const type = S(document.getElementById(`v337AddType_${itemId}`)?.value || row.type || 'صرف');
        const ct = S(document.getElementById(`v337AddCost_${itemId}`)?.value || row.cost_type || 'FM');
        if(!qty) return alert('اكتب كمية التوزيع');
        row.type = type;
        row.qty = qty;
        row.quantity = qty;
        row.cost_type = ct;
        row.unit_cost_override = N(document.getElementById(`v337AddUnit_${itemId}`)?.value || row.unit_cost_override || row.unit_cost || 0);
        row.unit_cost = row.unit_cost_override;
        row.notes = S(document.getElementById(`v337AddNotes_${itemId}`)?.value || '');
        row.updated_at = new Date().toISOString();
        if(ct === 'FM'){
          const pid = document.getElementById(`v337AddProject_${itemId}`)?.value || '';
          if(!pid) return alert('اختر المشروع');
          row.project_id = pid;
          row.project_name = projectNameFromRow(row);
          row.order_no = '';
          row.general_note = '';
        }else if(ct === 'CN'){
          const order = S(document.getElementById(`v337AddOrder_${itemId}`)?.value || '');
          if(!order) return alert('اكتب رقم الأوردر');
          row.order_no = order;
          row.project_id = '';
          row.project_name = '';
          row.general_note = '';
        }else{
          row.general_note = S(document.getElementById(`v337AddGeneralNote_${itemId}`)?.value || 'عام');
          row.project_id = '';
          row.project_name = '';
          row.order_no = '';
        }
        row.distribution_status = type === 'مرتجع' ? 'return' : (OUT_TYPES.has(type) ? 'allocated' : (row.distribution_status || ''));
        row.notes = `${row.notes} ${type === 'مرتجع' ? '[RETURN]' : (OUT_TYPES.has(type) ? '[ALLOCATED]' : '')}`.trim();
        ms[idx] = row;
        setMoves(ms);
        window.__v354EditingMovementLine = null;
        try{ if(typeof window.rebuildStockV337 === 'function') window.rebuildStockV337(); }catch(_){ }
        try{ if(typeof window.v337OpenMove === 'function') window.v337OpenMove(batch); }catch(_){ }
        try{ if(typeof window.msg === 'function') msg('تم حفظ تعديل التوزيع'); else alert('تم حفظ تعديل التوزيع'); }catch(_){ alert('تم حفظ تعديل التوزيع'); }
        return;
      }
      return original.apply(this, arguments);
    };
    window.v337AddAllocation.__v354Wrapped = true;
  }

  window.v353EditMovementLineFromButton = function(btn){
    const del = findDeleteForEditButton(btn);
    const info = del ? parseDeleteButton(del) : null;
    if(info?.kind === 'local') return openDistributionFromLine(info.id, info.batch);
    if(info?.kind === 'supabase'){
      if(typeof window.inventoryShowMovementV347 === 'function') return window.inventoryShowMovementV347(info.id);
      if(typeof window.inventoryShowMovementV346 === 'function') return window.inventoryShowMovementV346(info.id);
    }
    alert('افتح عرض الحركة ثم اضغط تعديل من داخل منتجات الحركة.');
  };

  function boot(){ css(); wrapAddAllocation(); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  setInterval(wrapAddAllocation, 800);
  console.log('Tasneef v354 inventory movement edit opens distribution loaded');
})();

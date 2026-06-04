/* TASNEEF v353 - Inventory movement ONLY: add visible Edit button beside Delete
   نطاق التعديل: حركة المخزون فقط.
   لا يلمس الصلاحيات، إدارة المستخدمين، الحضور، العقود، أو التقارير.
*/
(function(){
  'use strict';
  if(window.__tasneefV353InventoryMovementEditOnly) return;
  window.__tasneefV353InventoryMovementEditOnly = true;

  const LS_MOVES = 'tasneef_v312_moves';
  const S = v => String(v ?? '').trim();
  const N = v => { const x = Number(S(v).replace(/,/g,'')); return Number.isFinite(x) ? x : 0; };
  const E = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const parse = (k,d=[]) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch(_) { return d; } };
  const save = (k,v) => localStorage.setItem(k, JSON.stringify(v));
  const moves = () => parse(LS_MOVES, []);
  const setMoves = v => save(LS_MOVES, v);
  const projects = () => (Array.isArray(window.data?.projects) ? window.data.projects : []);
  const projectName = id => {
    const p = projects().find(x => S(x.id) === S(id));
    return p?.name || p?.project_name || p?.title || S(id || '');
  };
  const projectOptions = sel => '<option value="">اختر المشروع</option>' + projects().map(p => `<option value="${E(p.id)}" ${S(sel)===S(p.id)?'selected':''}>${E(p.name||p.project_name||p.title||p.id)}</option>`).join('');

  function css(){
    if(document.getElementById('v353MovementEditCss')) return;
    const st = document.createElement('style');
    st.id = 'v353MovementEditCss';
    st.textContent = `
      .v353-edit-move-btn{background:#eef8f5!important;color:#064737!important;border:1px solid #cfe4dc!important;border-radius:10px!important;padding:7px 12px!important;font-weight:900!important;margin:4px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:58px!important;cursor:pointer!important}
      .v353-edit-modal{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000000;display:grid;place-items:center;padding:16px;direction:rtl}
      .v353-edit-panel{width:min(760px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;border:1px solid #d5e8e1;box-shadow:0 22px 70px rgba(0,0,0,.28);padding:18px;color:#063d31}
      .v353-edit-panel h2{margin:0 0 12px;color:#063d31;font-size:22px}.v353-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.v353-grid label{display:block;font-size:12px;color:#52665f;margin-bottom:5px;font-weight:800}.v353-grid input,.v353-grid select,.v353-grid textarea{width:100%;box-sizing:border-box;border:1px solid #d6e7e0;border-radius:12px;padding:10px;background:#fff}.v353-grid textarea{min-height:70px;resize:vertical}.v353-actions{display:flex;gap:8px;justify-content:flex-start;flex-wrap:wrap;margin-top:14px}.v353-actions button{border:0;border-radius:11px;padding:10px 14px;font-weight:900;cursor:pointer}.v353-save{background:#064737;color:#fff}.v353-cancel{background:#eef8f5;color:#064737;border:1px solid #cfe4dc!important}.v353-danger{background:#bd3434;color:#fff}.v353-note{background:#fff8e5;border:1px solid #efd79e;border-radius:12px;padding:10px;margin:10px 0;color:#5b4610;font-size:13px}
      @media(max-width:700px){.v353-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(st);
  }

  function parseDeleteButton(btn){
    const oc = btn.getAttribute('onclick') || '';
    let m = oc.match(/v337DeleteLine\(['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\)/);
    if(m) return {kind:'local', id:m[1], batch:m[2]};
    m = oc.match(/financeDelete\(['"]inventory_movements['"]\s*,\s*['"]([^'"]+)['"]/);
    if(m) return {kind:'supabase', id:m[1]};
    m = oc.match(/stockBatchRemoveLineIndexV350\((\d+)\)/);
    if(m) return {kind:'invoiceDraft', index:m[1]};
    return null;
  }

  function movementZone(el){
    const candidates = [];
    let p = el;
    for(let i=0; p && i<8; i++, p=p.parentElement) candidates.push(p);
    return candidates.find(x => {
      const txt = S(x.textContent);
      return /منتجات داخل الحركة|إجمالي التوزيع|مركز التكلفة|حركة مخزون|عرض حركة|إضافة منتج للحركة|توزيع المنتج/.test(txt) || x.classList?.contains('v337-product') || x.classList?.contains('v337-line') || x.classList?.contains('v347-panel');
    });
  }

  function openLocalEdit(id, batch){
    const arr = moves();
    const row = arr.find(x => S(x.id) === S(id));
    if(!row){ alert('لم يتم العثور على سطر الحركة للتعديل'); return; }
    css();
    document.querySelector('.v353-edit-modal')?.remove();
    const type = S(row.type || row.movement_type || 'صرف');
    const costType = S(row.cost_type || 'FM');
    const panel = document.createElement('div');
    panel.className = 'v353-edit-modal';
    panel.innerHTML = `<div class="v353-edit-panel">
      <h2>تعديل منتج داخل حركة المخزون</h2>
      <div class="v353-note">هذا التعديل خاص بسطر الحركة فقط. بعد الحفظ يتم تحديث نفس الحركة ولا يتم إنشاء سطر جديد.</div>
      <div class="v353-grid">
        <div><label>الصنف</label><input value="${E(row.item_name || '-') }" readonly></div>
        <div><label>نوع الحركة</label><select id="v353Type"><option ${type==='صرف'?'selected':''}>صرف</option><option ${type==='استهلاك'?'selected':''}>استهلاك</option><option ${type==='مرتجع'?'selected':''}>مرتجع</option><option ${type==='هدر'?'selected':''}>هدر</option><option ${type==='تالف'?'selected':''}>تالف</option><option ${type==='سكراب'?'selected':''}>سكراب</option></select></div>
        <div><label>الكمية</label><input id="v353Qty" type="number" step="0.01" value="${N(row.qty || row.quantity)}"></div>
        <div><label>مركز التكلفة</label><select id="v353CostType"><option ${costType==='FM'?'selected':''}>FM</option><option ${costType==='CN'?'selected':''}>CN</option><option ${costType==='GENERAL'?'selected':''}>GENERAL</option></select></div>
        <div><label>المشروع FM</label><select id="v353Project">${projectOptions(row.project_id || '')}</select></div>
        <div><label>رقم الأوردر CN</label><input id="v353Order" value="${E(row.order_no || '')}" placeholder="اكتب رقم الأوردر عند CN"></div>
        <div><label>تكلفة الوحدة</label><input id="v353Unit" type="number" step="0.01" value="${N(row.unit_cost_override || row.unit_cost || 0)}"></div>
        <div><label>ملاحظة عام / ملاحظة الحركة</label><input id="v353General" value="${E(row.general_note || '')}" placeholder="عام / ملاحظة عامة"></div>
        <div style="grid-column:1/-1"><label>ملاحظات</label><textarea id="v353Notes">${E(row.notes || '')}</textarea></div>
      </div>
      <div class="v353-actions"><button class="v353-save" onclick="v353SaveLocalMovementLine('${E(id)}','${E(batch || row.batch_id || row.id)}')">حفظ التعديل</button><button class="v353-cancel" onclick="this.closest('.v353-edit-modal').remove()">إغلاق</button></div>
    </div>`;
    document.body.appendChild(panel);
  }

  window.v353SaveLocalMovementLine = function(id, batch){
    const arr = moves();
    const idx = arr.findIndex(x => S(x.id) === S(id));
    if(idx < 0){ alert('لم يتم العثور على السطر'); return; }
    const r = arr[idx];
    const ct = S(document.getElementById('v353CostType')?.value || 'FM');
    r.type = S(document.getElementById('v353Type')?.value || r.type || 'صرف');
    r.qty = N(document.getElementById('v353Qty')?.value || r.qty || r.quantity);
    r.quantity = r.qty;
    r.cost_type = ct;
    r.unit_cost_override = N(document.getElementById('v353Unit')?.value || r.unit_cost_override || r.unit_cost || 0);
    r.unit_cost = r.unit_cost_override;
    r.notes = S(document.getElementById('v353Notes')?.value || '');
    r.general_note = S(document.getElementById('v353General')?.value || '');
    if(ct === 'FM'){
      r.project_id = document.getElementById('v353Project')?.value || '';
      r.project_name = projectName(r.project_id);
      r.order_no = '';
    } else if(ct === 'CN'){
      r.order_no = S(document.getElementById('v353Order')?.value || '');
      r.project_id = '';
      r.project_name = '';
    } else {
      r.project_id = '';
      r.project_name = '';
      r.order_no = '';
    }
    arr[idx] = r;
    setMoves(arr);
    try{ if(typeof window.rebuildStockV337 === 'function') window.rebuildStockV337(); }catch(_){ }
    document.querySelector('.v353-edit-modal')?.remove();
    try{ if(typeof window.v337OpenMove === 'function') window.v337OpenMove(batch || r.batch_id || r.id); }catch(_){ }
    try{ if(typeof window.msg === 'function') msg('تم حفظ تعديل سطر الحركة'); else alert('تم حفظ تعديل سطر الحركة'); }catch(_){ alert('تم حفظ تعديل سطر الحركة'); }
  };

  window.v353EditMovementLineFromButton = function(btn){
    const del = btn?.nextElementSibling && /حذف/.test(S(btn.nextElementSibling.textContent)) ? btn.nextElementSibling : btn?.parentElement?.querySelector('button[onclick*="Delete"],button[onclick*="financeDelete"],button.danger');
    const info = del ? parseDeleteButton(del) : null;
    if(info?.kind === 'local') return openLocalEdit(info.id, info.batch);
    if(info?.kind === 'supabase'){
      // قاعدة البيانات: افتح شاشة عرض/توزيع الموجودة أصلًا، فهي تحتوي خانات تعديل التوزيع والتكلفة.
      if(typeof window.inventoryShowMovementV347 === 'function') return window.inventoryShowMovementV347(info.id);
      if(typeof window.inventoryShowMovementV346 === 'function') return window.inventoryShowMovementV346(info.id);
    }
    const row = btn.closest('tr,.v337-line,.v337-product,.card,div');
    row?.querySelectorAll('input,select,textarea').forEach(el => { el.disabled=false; el.readOnly=false; el.style.background='#fff'; });
    const first = row?.querySelector('input,select,textarea');
    if(first){ try{ first.focus(); first.select && first.select(); }catch(_){ } return; }
    alert('اضغط عرض / توزيع للحركة ثم عدّل السطر من داخلها.');
  };

  function addEditBesideDelete(){
    css();
    const buttons = [...document.querySelectorAll('button')].filter(b => /^حذف$/.test(S(b.textContent)) || /حذف/.test(S(b.textContent)) && /danger|red|v337-danger/.test(S(b.className)));
    buttons.forEach(del => {
      if(!movementZone(del)) return;
      const holder = del.parentElement || del.closest('td') || del.closest('div');
      if(!holder) return;
      if(holder.querySelector('.v353-edit-move-btn')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'v353-edit-move-btn';
      btn.textContent = 'تعديل';
      btn.onclick = function(){ window.v353EditMovementLineFromButton(this); };
      holder.insertBefore(btn, del);
    });
  }

  function wrapOpeners(){
    [['v337OpenMove','__v353_v337'],['inventoryShowMovementV347','__v353_v347'],['inventoryShowMovementV346','__v353_v346'],['v334ViewMove','__v353_v334'],['v335OpenMove','__v353_v335'],['v336OpenMove','__v353_v336']].forEach(([name,flag])=>{
      const fn = window[name];
      if(typeof fn !== 'function' || fn[flag]) return;
      window[name] = function(){ const out = fn.apply(this, arguments); setTimeout(addEditBesideDelete, 60); setTimeout(addEditBesideDelete, 250); setTimeout(addEditBesideDelete, 700); return out; };
      window[name][flag] = true;
    });
  }

  const mo = new MutationObserver(() => { setTimeout(addEditBesideDelete, 40); });
  function boot(){
    wrapOpeners(); addEditBesideDelete();
    try{ mo.observe(document.body, {childList:true, subtree:true}); }catch(_){ }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  setInterval(() => { wrapOpeners(); addEditBesideDelete(); }, 1000);
  console.log('Tasneef v353 inventory movement edit-only patch loaded');
})();

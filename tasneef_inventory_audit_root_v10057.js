
(function(){
  'use strict';
  if(window.__tasneefInventoryAuditRootV10057) return;
  window.__tasneefInventoryAuditRootV10057 = true;

  const S = v => String(v ?? '').trim();
  const N = v => { const n = Number(String(v ?? 0).replace(/[^\d.\-]/g,'')); return Number.isFinite(n) ? n : 0; };
  const A = v => Array.isArray(v) ? v : [];
  const $ = id => document.getElementById(id);
  const E = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const SESSION_TABLE = 'inventory_audit_sessions';
  const ITEM_TABLE = 'inventory_audit_items';

  let currentAudit = null;
  let loading = false;
  let lastProductsCount = 0;

  function say(t,type){
    try{ if(typeof window.msg === 'function') window.msg(t,type); else alert(t); }
    catch(_){ alert(t); }
  }


  function removeOldVersionMark(){
    try{
      const badText = /Tasneef\s+v\d+|worker-multi-project|automation-export|v\d+\s*-\s*worker/i;
      const nodes = Array.from(document.querySelectorAll('body *'));
      nodes.forEach(el => {
        if(!el || el.closest('.side') || el.closest('#inventoryAudit')) return;
        const txt = S(el.textContent || el.getAttribute('title') || el.getAttribute('aria-label') || '');
        if(!txt || !badText.test(txt)) return;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const fixedLike = cs.position === 'fixed' || cs.position === 'sticky' || r.bottom > (window.innerHeight - 60);
        const bottomLike = r.bottom >= (window.innerHeight - 80) || parseInt(cs.bottom || '999',10) <= 80;
        const leftLike = r.left <= 260 || parseInt(cs.left || '999',10) <= 260;
        if(fixedLike && bottomLike && leftLike){
          let target = el;
          for(let i=0;i<3;i++){
            const p = target.parentElement;
            if(!p || p === document.body) break;
            const pr = p.getBoundingClientRect();
            const pcs = getComputedStyle(p);
            if((pcs.position === 'fixed' || pcs.position === 'sticky' || pr.bottom >= window.innerHeight-80) && pr.left <= 280 && pr.height <= 80 && pr.width <= 360) target = p;
          }
          target.remove();
        }
      });
    }catch(_){}
  }

  function userName(){
    try{
      const u = JSON.parse(localStorage.getItem('tasneef_user') || '{}') || {};
      return S(u.full_name || u.username || u.name || '');
    }catch(_){ return ''; }
  }

  function ensureStyle(){
    if($('auditStyleV10057')) return;
    const st = document.createElement('style');
    st.id = 'auditStyleV10057';
    st.textContent = `
      .inventory-audit-page-v10057 .audit-toolbar-v10057{display:flex;gap:8px;flex-wrap:wrap;align-items:end}
      .audit-kpis-v10057{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}
      .audit-kpi-v10057{background:#fff;border:1px solid var(--line,#dce6e2);border-radius:16px;padding:12px}
      .audit-kpi-v10057 small{color:#60706a}.audit-kpi-v10057 b{display:block;color:#0A4033;font-size:22px;margin-top:5px}
      .audit-open-banner-v10057{background:#eef8f4;border:1px solid #cfe4dc;color:#064b38;border-radius:14px;padding:10px 12px;margin:10px 0;font-weight:800}
      .audit-table-v10057 input,.audit-table-v10057 select{min-width:90px}
      .audit-glass-overlay-v10057{position:absolute;inset:0;z-index:999998;background:rgba(245,250,248,.72);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);display:flex;align-items:center;justify-content:center;padding:18px;border-radius:22px}
      .audit-glass-card-v10057{width:min(560px,92vw);background:rgba(255,255,255,.86);border:1px solid rgba(207,226,220,.95);box-shadow:0 22px 60px rgba(0,45,35,.16);border-radius:26px;padding:26px;text-align:center;color:#063f32}
      .audit-glass-card-v10057 h2{margin:0 0 10px;color:#063f32}.audit-glass-card-v10057 p{line-height:1.9;color:#35554c}
      .audit-glass-actions-v10057{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:14px}
      @media(max-width:900px){.audit-kpis-v10057{grid-template-columns:1fr 1fr}}
      @media print{body *{visibility:hidden!important}#inventoryAudit,#inventoryAudit *{visibility:visible!important}#inventoryAudit{position:absolute;inset:0;background:#fff}.side,.hero,.audit-no-print-v10057{display:none!important}}
    `;
    document.head.appendChild(st);
  }

  function sectionHtml(){
    return `
      <div class="card section-head audit-head-v10057">
        <div>
          <h2>قسم الجرد</h2>
          <p>جرد مستقل مرتبط بالمالية والمخزون. عند فتح عملية جرد يتم قفل المالية والمخزون حتى إغلاق العملية.</p>
        </div>
        <div class="actions audit-no-print-v10057">
          <button onclick="tasneefInventoryAuditV10057.newAudit()">+ عملية جرد جديدة</button>
          <button class="light" onclick="tasneefInventoryAuditV10057.load(true)">تحديث</button>
        </div>
      </div>

      <div id="auditLockMsgV10057" class="audit-open-banner-v10057 hidden"></div>

      <div class="card">
        <div class="table-head">
          <h2>عمليات الجرد</h2>
          <div class="row-actions audit-no-print-v10057">
            <button class="light" onclick="tasneefInventoryAuditV10057.load(true)">تحديث</button>
            <button class="light" onclick="tasneefInventoryAuditV10057.print()">طباعة</button>
            <button class="light" onclick="tasneefInventoryAuditV10057.exportCsv()">تصدير CSV</button>
            <button class="light" onclick="tasneefInventoryAuditV10057.reloadOpenItems(true)">إعادة تحميل بنود الجرد</button>
          </div>
        </div>
        <div id="auditSessionsV10057" class="quick-list"></div>
      </div>

      <div class="card" id="auditDetailsCardV10057">
        <div class="table-head">
          <h2 id="auditTitleV10057">تفاصيل الجرد</h2>
          <div class="row-actions audit-no-print-v10057">
            <button class="light" onclick="tasneefInventoryAuditV10057.reloadOpenItems(true)">تحميل المنتجات</button>
            <button class="light" onclick="tasneefInventoryAuditV10057.printCurrentAudit()">طباعة عملية الجرد</button>
            <button onclick="tasneefInventoryAuditV10057.closeAudit(true)">اعتماد وتعديل المخزون</button>
            <button class="light" onclick="tasneefInventoryAuditV10057.closeAudit(false)">إغلاق بدون تعديل المخزون</button>
          </div>
        </div>
        <div class="filters audit-no-print-v10057">
          <input id="auditSearchV10057" placeholder="بحث باسم المنتج أو الكود" oninput="tasneefInventoryAuditV10057.renderCurrentItems()">
          <select id="auditStatusFilterV10057" onchange="tasneefInventoryAuditV10057.renderCurrentItems()">
            <option value="">كل الحالات</option>
            <option>لم يتم جرده</option><option>مطابق</option><option>نقص</option><option>زيادة</option>
          </select>
        </div>
        <div id="auditSummaryV10057" class="audit-kpis-v10057"></div>
        <div class="table-wrap">
          <table class="audit-table-v10057">
            <thead><tr><th>المنتج</th><th>كود المنتج</th><th>كود الموزع</th><th>الوحدة</th><th>كمية النظام</th><th>الكمية الفعلية</th><th>الفرق</th><th>الحالة</th><th>ملاحظات</th></tr></thead>
            <tbody id="auditItemsBodyV10057"></tbody>
          </table>
        </div>
      </div>`;
  }

  function ensureSection(){
    ensureStyle();
    let sec = $('inventoryAudit');
    const main = document.querySelector('main.content') || document.querySelector('main') || document.body;
    if(!sec){
      sec = document.createElement('section');
      sec.id = 'inventoryAudit';
      sec.className = 'page hidden inventory-audit-page-v10057';
      main.appendChild(sec);
    }
    if(sec.dataset.auditV10057 !== '1'){
      sec.classList.add('inventory-audit-page-v10057');
      sec.innerHTML = sectionHtml();
      sec.dataset.auditV10057 = '1';
    }
  }

  async function openAudit(){
    if(!window.sb) return null;
    try{
      const r = await sb.from(SESSION_TABLE).select('*').eq('status','open').order('id',{ascending:false}).limit(1).maybeSingle();
      if(r.error) throw r.error;
      return r.data || null;
    }catch(e){
      say(e.message || String(e),'err');
      return null;
    }
  }

  async function readTable(table, limit=5000){
    try{
      const r = await sb.from(table).select('*').limit(limit);
      if(!r.error && Array.isArray(r.data)) return r.data;
    }catch(_){}
    return [];
  }

  function localFinanceItems(){
    const s = window.financeProStateV15 || window.financeState || {};
    return A(s.items || s.inventoryItems || s.products);
  }

  async function getProducts(){
    let rows = [];
    if(window.sb){
      rows = await readTable('inventory_items', 5000);
      if(!rows.length) rows = await readTable('inventory_products', 5000);
      if(!rows.length) rows = await readTable('inventory_balance_v10020', 5000);
    }
    if(!rows.length) rows = localFinanceItems();
    const seen = new Set();
    const out = [];
    rows.forEach(p => {
      const r = productRow(p);
      const key = S(r.product_ref || r.product_id || r.product_code || r.distributor_code || r.product_name).toLowerCase();
      if(!key || seen.has(key)) return;
      seen.add(key); out.push(r);
    });
    lastProductsCount = out.length;
    return out;
  }

  function productRow(p){
    const name = S(p.product_name || p.name || p.item_name || p.title || p.product || '');
    const code = S(p.product_code || p.serial_number || p.internal_code || p.code || p.barcode || p.id || '');
    const dist = S(p.distributor_code || p.supplier_barcode || p.supplier_code || p.vendor_code || p.vendor_barcode || '');
    const unit = S(p.unit || p.measure_unit || p.uom || 'حبة');
    const qty = N(p.current_qty ?? p.current_quantity ?? p.available_qty ?? p.balance ?? p.stock_qty ?? p.quantity ?? p.qty ?? 0);
    return {
      product_id:null,
      product_ref:S(p.id || code || dist || name),
      product_code:code,
      distributor_code:dist,
      product_name:name || code || dist,
      unit:unit,
      system_qty:qty,
      actual_qty:null,
      diff_qty:null,
      status:'لم يتم جرده',
      notes:''
    };
  }

  async function sessionItems(auditId){
    if(!window.sb || !auditId) return [];
    const r = await sb.from(ITEM_TABLE).select('*').eq('audit_id',auditId).order('id',{ascending:true}).limit(5000);
    if(r.error){ say(r.error.message,'err'); return []; }
    return r.data || [];
  }

  function itemKey(x){
    return S(x.product_ref || x.product_id || x.product_code || x.distributor_code || x.product_name).toLowerCase();
  }

  async function ensureItemsForAudit(audit, force=false){
    if(!audit || !window.sb) return 0;
    const existing = await sessionItems(audit.id);
    if(existing.length && !force) return existing.length;

    const products = await getProducts();
    if(!products.length){
      say('لم يتم العثور على منتجات في المخزون. تأكد من وجود منتجات في قسم المالية والمخزون.','err');
      return 0;
    }

    const exist = new Set(existing.map(itemKey));
    const batch = products
      .filter(p => !exist.has(itemKey(p)))
      .map(p => Object.assign({audit_id:audit.id}, p));

    if(!batch.length) return existing.length;

    for(let i=0;i<batch.length;i+=400){
      const r = await sb.from(ITEM_TABLE).insert(batch.slice(i,i+400));
      if(r.error){
        say('فشل تحميل بنود الجرد: ' + r.error.message,'err');
        return existing.length;
      }
    }
    say(`تم تحميل ${batch.length} منتج داخل الجرد`);
    return existing.length + batch.length;
  }

  async function renderSessions(){
    const wrap = $('auditSessionsV10057') || $('auditSessionsV10046');
    if(!wrap || !window.sb) return;
    const r = await sb.from(SESSION_TABLE).select('*').order('id',{ascending:false}).limit(30);
    const rows = r.data || [];
    wrap.innerHTML = rows.map(a => `
      <div class="quick-item">
        <div><b>${E(a.audit_no || a.id)}</b><br><small>${E(a.title || 'جرد')} - ${a.status==='open'?'مفتوح':'مغلق'} - ${new Date(a.started_at || a.created_at || Date.now()).toLocaleString('ar-SA')}</small></div>
        <div class="row-actions"><button class="light" onclick="tasneefInventoryAuditV10057.renderItems(${Number(a.id)})">عرض</button><button class="light" onclick="tasneefInventoryAuditV10057.printAudit(${Number(a.id)})">طباعة</button>${a.status==='open'?`<button onclick="tasneefInventoryAuditV10057.closeSpecificAudit(${Number(a.id)},true)">اعتماد وتعديل</button><button class="danger" onclick="tasneefInventoryAuditV10057.closeSpecificAudit(${Number(a.id)},false)">إغلاق</button>`:''}</div>
      </div>`).join('') || '<div class="summary-item">لا توجد عمليات جرد</div>';
  }

  function computeSummary(rows){
    const s = {total:rows.length, done:0, equal:0, shortage:0, extra:0};
    rows.forEach(it => {
      const has = it.actual_qty !== null && it.actual_qty !== undefined && S(it.actual_qty) !== '';
      if(has) s.done++;
      const diff = has ? N(it.actual_qty)-N(it.system_qty) : null;
      if(diff === 0) s.equal++;
      else if(diff < 0) s.shortage++;
      else if(diff > 0) s.extra++;
    });
    return s;
  }

  function summaryHtml(rows){
    const s = computeSummary(rows);
    return `
      <div class="audit-kpi-v10057"><small>إجمالي المنتجات</small><b>${s.total}</b></div>
      <div class="audit-kpi-v10057"><small>تم جردها</small><b>${s.done}</b></div>
      <div class="audit-kpi-v10057"><small>مطابق</small><b>${s.equal}</b></div>
      <div class="audit-kpi-v10057"><small>نقص / زيادة</small><b>${s.shortage} / ${s.extra}</b></div>`;
  }

  async function renderItems(auditId, auditObj=null){
    ensureSection();
    if(!auditId) {
      const a = await openAudit();
      auditId = a && a.id; auditObj = a;
    }
    const body = $('auditItemsBodyV10057') || $('auditItemsBodyV10046');
    if(!body || !auditId) return;
    let rows = await sessionItems(auditId);
    if(!rows.length){
      const a = auditObj || currentAudit || {id:auditId};
      await ensureItemsForAudit(a, false);
      rows = await sessionItems(auditId);
    }
    currentAudit = auditObj || currentAudit || {id:auditId};
    const search = S($('auditSearchV10057')?.value).toLowerCase();
    const fstatus = S($('auditStatusFilterV10057')?.value);
    const filtered = rows.filter(it => {
      const diff = (it.actual_qty===null || it.actual_qty===undefined || S(it.actual_qty)==='') ? null : N(it.actual_qty)-N(it.system_qty);
      const st = diff === null ? 'لم يتم جرده' : diff===0 ? 'مطابق' : diff < 0 ? 'نقص' : 'زيادة';
      const text = [it.product_name,it.product_code,it.distributor_code,it.unit].map(S).join(' ').toLowerCase();
      return (!search || text.includes(search)) && (!fstatus || st === fstatus);
    });
    if($('auditTitleV10057')) $('auditTitleV10057').textContent = `تفاصيل الجرد ${E(currentAudit?.audit_no || auditId)}`;
    if($('auditSummaryV10057')) $('auditSummaryV10057').innerHTML = summaryHtml(rows);
    body.innerHTML = filtered.map(rowHtml).join('') || `<tr><td colspan="9">${rows.length ? 'لا توجد نتائج حسب الفلتر' : 'لا توجد بنود، اضغط تحميل المنتجات'}</td></tr>`;
  }

  function rowHtml(it){
    const has = it.actual_qty !== null && it.actual_qty !== undefined && S(it.actual_qty) !== '';
    const diff = has ? N(it.actual_qty)-N(it.system_qty) : null;
    const st = diff === null ? 'لم يتم جرده' : diff === 0 ? 'مطابق' : diff < 0 ? 'نقص' : 'زيادة';
    const cls = st === 'نقص' ? 'red' : st === 'زيادة' ? 'amber' : st === 'مطابق' ? 'green' : '';
    return `<tr data-audit-item-id="${Number(it.id)}">
      <td>${E(it.product_name)}</td>
      <td>${E(it.product_code)}</td>
      <td>${E(it.distributor_code)}</td>
      <td>${E(it.unit)}</td>
      <td>${N(it.system_qty).toFixed(2)}</td>
      <td><input type="number" step="0.01" value="${has ? E(it.actual_qty) : ''}" onchange="tasneefInventoryAuditV10057.saveQty(${Number(it.id)},this.value,${N(it.system_qty)})"></td>
      <td>${diff === null ? '-' : diff.toFixed(2)}</td>
      <td><span class="badge ${cls}">${st}</span></td>
      <td><input value="${E(it.notes || '')}" onchange="tasneefInventoryAuditV10057.saveNote(${Number(it.id)},this.value)"></td>
    </tr>`;
  }

  async function load(force=false){
    if(loading && !force) return;
    loading = true;
    ensureSection();
    currentAudit = await openAudit();
    const box = $('auditLockMsgV10057') || $('auditLockMsgV10046');
    if(box){
      box.classList.toggle('hidden', !currentAudit);
      box.textContent = currentAudit ? `يوجد جرد مفتوح: ${currentAudit.audit_no || currentAudit.id} - المالية والمخزون مغلق مؤقتًا` : '';
    }
    await renderSessions();
    if(currentAudit){
      const count = await ensureItemsForAudit(currentAudit, false);
      await renderItems(currentAudit.id,currentAudit);
    } else {
      const body = $('auditItemsBodyV10057') || $('auditItemsBodyV10046');
      if(body) body.innerHTML = '<tr><td colspan="9">لا يوجد جرد مفتوح</td></tr>';
      if($('auditSummaryV10057')) $('auditSummaryV10057').innerHTML = '';
    }
    await applyFinanceLock();
    loading = false;
  }

  async function newAudit(){
    ensureSection();
    if(await openAudit()) return say('يوجد جرد مفتوح بالفعل. أغلقه أولاً.','err');
    const title = prompt('اسم عملية الجرد','جرد المخزون') || 'جرد المخزون';
    const auditNo = 'AUD-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.floor(Math.random()*9000+1000);
    const row = {audit_no:auditNo,title,status:'open',created_by_name:userName(),started_at:new Date().toISOString()};
    const session = await sb.from(SESSION_TABLE).insert(row).select('*').single();
    if(session.error) return say(session.error.message,'err');
    currentAudit = session.data;
    await ensureItemsForAudit(currentAudit, true);
    say('تم فتح الجرد وتحميل المنتجات وقفل المالية والمخزون');
    await load(true);
  }

  async function reloadOpenItems(force=true){
    const a = await openAudit();
    if(!a) return say('لا يوجد جرد مفتوح','err');
    await ensureItemsForAudit(a, force);
    await renderItems(a.id,a);
  }

  async function saveQty(id,val,systemQty){
    const actual = S(val)==='' ? null : N(val);
    const diff = actual === null ? null : actual - N(systemQty);
    const status = diff === null ? 'لم يتم جرده' : diff===0 ? 'مطابق' : diff<0 ? 'نقص' : 'زيادة';
    const r = await sb.from(ITEM_TABLE).update({actual_qty:actual,diff_qty:diff,status}).eq('id',id);
    if(r.error) return say(r.error.message,'err');
    await renderCurrentItems();
  }

  async function saveNote(id,val){
    const r = await sb.from(ITEM_TABLE).update({notes:S(val)}).eq('id',id);
    if(r.error) say(r.error.message,'err');
  }

  async function findInventoryItemForAudit(it){
    const ref = S(it.product_ref || it.product_id);
    const code = S(it.product_code);
    const dist = S(it.distributor_code);
    const name = S(it.product_name);
    const tries = [];
    if(ref) tries.push(['id', /^\d+$/.test(ref) ? Number(ref) : ref]);
    if(code) tries.push(['product_code', code], ['serial_number', code], ['internal_code', code], ['code', code], ['barcode', code]);
    if(dist) tries.push(['distributor_code', dist], ['supplier_barcode', dist], ['supplier_code', dist], ['vendor_code', dist], ['vendor_barcode', dist]);
    if(name) tries.push(['name', name], ['product_name', name], ['item_name', name], ['title', name]);
    for(const table of ['inventory_items','inventory_products']){
      for(const [col,val] of tries){
        try{
          const r = await sb.from(table).select('*').eq(col,val).limit(1).maybeSingle();
          if(!r.error && r.data){ r.data.__table = table; return r.data; }
        }catch(_){ }
      }
    }
    return null;
  }

  async function insertAuditAdjustmentMovement(item,it,nextQty){
    try{
      const row = {
        item_id: item?.id || null,
        item_name: S(item?.name || item?.product_name || it.product_name),
        movement_type: 'adjust',
        quantity: N(nextQty),
        movement_date: new Date().toISOString().slice(0,10),
        reason: 'تعديل رصيد من الجرد رقم ' + S(currentAudit?.audit_no || currentAudit?.id || ''),
        notes: 'كمية النظام وقت الجرد: ' + N(it.system_qty) + ' / الكمية الفعلية: ' + N(nextQty),
        product_code: S(it.product_code),
        barcode: S(it.distributor_code),
        receiver: userName()
      };
      const r = await sb.from('inventory_movements').insert(row);
      if(r.error) console.warn('audit adjustment movement skipped:', r.error.message || r.error);
    }catch(e){ console.warn('audit adjustment movement skipped:', e.message || e); }
  }

  async function applyAuditToInventory(a){
    const rows = await sessionItems(a.id);
    const valid = rows.filter(it => it.actual_qty !== null && it.actual_qty !== undefined && S(it.actual_qty) !== '');
    if(!valid.length) throw new Error('لا توجد كميات فعلية لاعتمادها في المخزون');

    // الحل الأساسي: دالة SQL ديناميكية تعدل أي جدول/عمود موجود عندك وتتفادى مشاكل نوع id.
    try{
      const rpc = await sb.rpc('tasneef_apply_inventory_audit_v10057', {p_audit_id:Number(a.id)});
      if(!rpc.error){
        const data = Array.isArray(rpc.data) ? (rpc.data[0] || {}) : (rpc.data || {});
        const updated = N(data.updated_count ?? data.updated ?? valid.length);
        const missed = N(data.missed_count ?? data.missed ?? 0);
        return {updated, missed:Array(missed).fill('غير مربوط')};
      }
      console.warn('audit rpc skipped:', rpc.error.message || rpc.error);
    }catch(e){ console.warn('audit rpc unavailable:', e.message || e); }

    // fallback احتياطي من الواجهة إذا لم يتم تشغيل ملف SQL.
    let updated = 0, missed = [];
    for(const it of valid){
      const item = await findInventoryItemForAudit(it);
      if(!item){ missed.push(S(it.product_name || it.product_code || it.id)); continue; }
      const nextQty = N(it.actual_qty);
      const table = item.__table || 'inventory_items';
      let ok = false;
      for(const col of ['quantity','current_qty','current_quantity','balance','stock_qty','available_qty','qty']){
        try{
          const upd = await sb.from(table).update({[col]:nextQty}).eq('id', item.id);
          if(!upd.error){ ok = true; break; }
        }catch(_){ }
      }
      if(!ok){ missed.push(S(it.product_name || it.product_code || item.id)); continue; }
      updated++;
      await insertAuditAdjustmentMovement(item,it,nextQty);
    }
    return {updated, missed};
  }

  async function closeSpecificAudit(id,adjust=false){
    const a = currentAudit && String(currentAudit.id) === String(id) ? currentAudit : {id};
    if(adjust){
      if(!confirm('اعتماد الجرد وتعديل كميات المنتجات في المخزون حسب الكمية الفعلية؟')) return;
      try{
        const res = await applyAuditToInventory(a);
        const r = await sb.from(SESSION_TABLE).update({status:'closed',closed_at:new Date().toISOString(),closed_by_name:userName(),notes:'تم اعتماد الجرد وتعديل المخزون. عدد المنتجات المعدلة: '+res.updated}).eq('id',a.id);
        if(r.error) return say(r.error.message,'err');
        say('تم اعتماد الجرد وتعديل المخزون: ' + res.updated + ' منتج' + (res.missed.length ? ' / لم يتم ربط: ' + res.missed.length : ''));
      }catch(e){ return say(e.message || String(e),'err'); }
    }else{
      if(!confirm('إغلاق الجرد بدون تعديل المخزون؟ سيتم فتح المالية والمخزون بعد الإغلاق.')) return;
      const r = await sb.from(SESSION_TABLE).update({status:'closed',closed_at:new Date().toISOString(),closed_by_name:userName()}).eq('id',a.id);
      if(r.error) return say(r.error.message,'err');
      say('تم إغلاق الجرد وفتح المالية والمخزون');
    }
    await load(true);
    try{ if(typeof window.financeLoadAll==='function') await window.financeLoadAll(); }catch(_){}
    try{ if(typeof window.financeProLoadV15==='function') await window.financeProLoadV15(true); }catch(_){}
  }

  async function closeAudit(adjust=false){
    const a = await openAudit();
    if(!a) return say('لا يوجد جرد مفتوح','err');
    return closeSpecificAudit(a.id, adjust);
  }

  async function renderCurrentItems(){
    const a = currentAudit || await openAudit();
    if(a) await renderItems(a.id,a);
  }

  function financeElements(fin){
    return [...fin.querySelectorAll('input,select,textarea,button')].filter(el => !el.closest('#financeAuditGlassV10057'));
  }

  function restoreFinance(fin){
    const lock = $('financeAuditGlassV10057');
    lock?.remove();
    financeElements(fin).forEach(el => {
      if(el.dataset.auditDisabledV10057 === '1'){
        if(el.dataset.auditWasDisabledV10057 !== '1') el.disabled = false;
        delete el.dataset.auditDisabledV10057;
        delete el.dataset.auditWasDisabledV10057;
      }
    });
  }

  async function applyFinanceLock(){
    const fin = $('financeDashboard');
    if(!fin) return;
    const a = await openAudit();
    if(!a){ restoreFinance(fin); return; }
    if(getComputedStyle(fin).position === 'static') fin.style.position = 'relative';
    financeElements(fin).forEach(el => {
      if(el.dataset.auditDisabledV10057 !== '1'){
        el.dataset.auditWasDisabledV10057 = el.disabled ? '1' : '0';
        el.dataset.auditDisabledV10057 = '1';
      }
      el.disabled = true;
    });
    let overlay = $('financeAuditGlassV10057');
    if(!overlay){
      overlay = document.createElement('div');
      overlay.id = 'financeAuditGlassV10057';
      overlay.className = 'audit-glass-overlay-v10057';
      fin.appendChild(overlay);
    }
    overlay.innerHTML = `<div class="audit-glass-card-v10057">
      <h2>المالية والمخزون مغلقان مؤقتًا</h2>
      <p>يوجد جرد مفتوح رقم <b>${E(a.audit_no || a.id)}</b><br>لا يمكن إضافة أو تعديل أو حذف أي حركة حتى يتم إغلاق الجرد.</p>
      <div class="audit-glass-actions-v10057">
        <button onclick="showPage('inventoryAudit',document.querySelector('[data-page=inventoryAudit]')); setTimeout(function(){tasneefInventoryAuditV10057.load(true)},80)">فتح الجرد</button>
        <button class="light" onclick="tasneefInventoryAuditV10057.load(true)">تحديث</button>
      </div>
    </div>`;
  }

  async function exportCsv(){
    const a = currentAudit || await openAudit();
    if(!a) return say('لا يوجد جرد للتصدير','err');
    const rows = await sessionItems(a.id);
    const head = ['المنتج','كود المنتج','كود الموزع','الوحدة','كمية النظام','الكمية الفعلية','الفرق','الحالة','ملاحظات'];
    const lines = [head].concat(rows.map(it => [it.product_name,it.product_code,it.distributor_code,it.unit,it.system_qty,it.actual_qty,it.diff_qty,it.status,it.notes]));
    const csv = '\ufeff' + lines.map(r => r.map(x => `"${S(x).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = (a.audit_no || 'inventory-audit') + '.csv'; link.click();
  }

  function reportSummary(rows){ return computeSummary(rows); }

  function printReportHtml(a, rows){
    const s = reportSummary(rows);
    const now = new Date().toLocaleString('ar-SA');
    const safeRows = rows.map((it,idx)=>{
      const has = it.actual_qty !== null && it.actual_qty !== undefined && S(it.actual_qty) !== '';
      const diff = has ? N(it.actual_qty)-N(it.system_qty) : null;
      const st = diff === null ? 'لم يتم جرده' : diff === 0 ? 'مطابق' : diff < 0 ? 'نقص' : 'زيادة';
      return `<tr><td>${idx+1}</td><td>${E(it.product_name)}</td><td>${E(it.product_code)}</td><td>${E(it.distributor_code)}</td><td>${E(it.unit)}</td><td>${N(it.system_qty).toFixed(2)}</td><td>${has?N(it.actual_qty).toFixed(2):''}</td><td>${diff===null?'-':diff.toFixed(2)}</td><td>${E(st)}</td><td>${E(it.notes||'')}</td></tr>`;
    }).join('');
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير جرد ${E(a.audit_no||a.id)}</title><style>
      @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;color:#14231f;margin:0;background:#fff}.wrap{padding:10px}.head{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #0A4033;padding-bottom:14px;margin-bottom:14px}.logo{display:flex;align-items:center;gap:12px}.logo img{width:70px;height:70px;object-fit:contain}.logo h1{margin:0;color:#0A4033;font-size:25px}.logo small{display:block;color:#53645e;margin-top:5px}.title{text-align:left}.title h2{margin:0;color:#0A4033;font-size:24px}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.box{border:1px solid #dce6e2;border-radius:12px;padding:10px;background:#fbfdfc}.box small{display:block;color:#66756f;margin-bottom:6px}.box b{font-size:18px;color:#0A4033}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0 16px}.kpi{border:1px solid #dce6e2;border-radius:16px;padding:14px;background:#f7fbf9;text-align:center}.kpi small{color:#60706a}.kpi b{display:block;font-size:26px;color:#0A4033;margin-top:6px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#0A4033;color:white;padding:9px;border:1px solid #0A4033}td{padding:8px;border:1px solid #dce6e2;vertical-align:top}tbody tr:nth-child(even){background:#fbfdfc}.sign{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:22px}.sig{height:82px;border:1px solid #dce6e2;border-radius:12px;padding:10px}.footer{margin-top:14px;text-align:center;color:#60706a;font-size:11px;border-top:1px solid #dce6e2;padding-top:8px}@media print{button{display:none}.wrap{padding:0}}
    </style></head><body><div class="wrap"><div class="head"><div class="logo"><img src="tasneef_logo_print.png" onerror="this.style.display='none'"><div><h1>شركة تصنيف لإدارة المرافق</h1><small>Tasneef Facility Management</small></div></div><div class="title"><h2>تقرير عملية جرد</h2><small>Inventory Audit Report</small></div></div><div class="meta"><div class="box"><small>رقم الجرد</small><b>${E(a.audit_no||a.id)}</b></div><div class="box"><small>اسم العملية</small><b>${E(a.title||'جرد المخزون')}</b></div><div class="box"><small>الحالة</small><b>${a.status==='open'?'مفتوح':'مغلق'}</b></div><div class="box"><small>تاريخ الطباعة</small><b>${E(now)}</b></div></div><div class="kpis"><div class="kpi"><small>إجمالي المنتجات</small><b>${s.total}</b></div><div class="kpi"><small>تم جردها</small><b>${s.done}</b></div><div class="kpi"><small>مطابق</small><b>${s.equal}</b></div><div class="kpi"><small>نقص / زيادة</small><b>${s.shortage} / ${s.extra}</b></div></div><table><thead><tr><th>#</th><th>المنتج</th><th>كود المنتج</th><th>كود الموزع</th><th>الوحدة</th><th>كمية النظام</th><th>الكمية الفعلية</th><th>الفرق</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>${safeRows || '<tr><td colspan="10">لا توجد بنود</td></tr>'}</tbody></table><div class="sign"><div class="sig"><b>مسؤول الجرد</b><br><br>الاسم: ____________<br>التوقيع: ____________</div><div class="sig"><b>مسؤول المخزون</b><br><br>الاسم: ____________<br>التوقيع: ____________</div><div class="sig"><b>اعتماد الإدارة</b><br><br>الاسم: ____________<br>التوقيع: ____________</div></div><div class="footer">تم إصدار هذا التقرير من نظام تصنيف لإدارة المرافق</div></div><script>setTimeout(()=>{window.print()},300)</script></body></html>`;
  }

  async function printAudit(id){
    let a = currentAudit;
    if(id){
      const sessions = await sb.from(SESSION_TABLE).select('*').eq('id',id).maybeSingle();
      if(!sessions.error && sessions.data) a = sessions.data;
    }
    if(!a) return say('لا يوجد جرد للطباعة','err');
    const rows = await sessionItems(a.id);
    const w = window.open('', '_blank');
    const html = printReportHtml(a, rows);
    if(!w){
      const frame = document.createElement('iframe'); frame.style.position='fixed'; frame.style.left='-9999px'; document.body.appendChild(frame);
      frame.contentDocument.open(); frame.contentDocument.write(html); frame.contentDocument.close();
      setTimeout(()=>{ try{frame.contentWindow.print();}catch(_){} setTimeout(()=>frame.remove(),1000); },500);
      return;
    }
    w.document.open(); w.document.write(html); w.document.close();
  }

  function printCurrentAudit(){
    const id = currentAudit?.id;
    if(id) return printAudit(id);
    window.print();
  }

  function print(){ printCurrentAudit(); }

  const api = {load,newAudit,reloadOpenItems,renderItems,renderCurrentItems,saveQty,saveNote,closeAudit,closeSpecificAudit,print,printAudit,printCurrentAudit,exportCsv,applyFinanceLock};
  window.tasneefInventoryAuditV10057 = api;
  window.tasneefInventoryAuditV10046 = api; window.tasneefInventoryAuditV10056 = api; // aliases for existing sidebar/buttons

  setInterval(removeOldVersionMark, 1200);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(()=>load(true),600));
  else setTimeout(()=>load(true),600);
  window.addEventListener('load', () => { setTimeout(()=>load(true),1200); setTimeout(applyFinanceLock,2200); });
  setInterval(applyFinanceLock, 5000);
})();

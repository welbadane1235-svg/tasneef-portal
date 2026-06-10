
/* Tasneef Inventory Audit Safe v10043
   - قسم جرد مستقل ومربوط بالمالية والمخزون.
   - عند فتح جرد: يقفل المالية والمخزون من الواجهة ويمنع الحفظ/التعديل قدر الإمكان.
   - مرحلة آمنة: لا يغير كميات المخزون تلقائيًا؛ فقط مقارنة وتقرير.
*/
(function(){
  'use strict';
  if(window.__tasneefInventoryAuditSafeV10043) return;
  window.__tasneefInventoryAuditSafeV10043 = true;

  const SUPABASE_URL = 'https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const AUDITS = 'inventory_audits';
  const ITEMS = 'inventory_audit_items';
  let activeAudit = null;
  let auditItems = [];
  let productsCache = [];
  let busy = false;

  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const n = v => { const x = Number(S(v).replace(/,/g,'').replace(/[^0-9.-]/g,'')); return Number.isFinite(x) ? x : 0; };
  const esc = v => S(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money = v => n(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';
  const nowIso = () => new Date().toISOString();

  function currentUserName(){
    try{
      const u = JSON.parse(localStorage.getItem('tasneef_user') || localStorage.getItem('tasneef_session') || '{}');
      return S(u.full_name || u.name || u.username || u.email || u.role || 'غير محدد');
    }catch(_){ return 'غير محدد'; }
  }

  async function api(path, options){
    return fetch(SUPABASE_URL + path, Object.assign({
      cache:'no-store',
      headers:{apikey:SUPABASE_ANON_KEY, Authorization:'Bearer '+SUPABASE_ANON_KEY, Accept:'application/json', 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=representation'}
    }, options || {}));
  }
  async function getJson(path){
    const r = await api(path,{method:'GET'});
    if(!r.ok) throw new Error(await r.text().catch(()=>String(r.status)));
    return await r.json();
  }
  async function postJson(path, body){
    const r = await api(path,{method:'POST', body:JSON.stringify(body)});
    if(!r.ok) throw new Error(await r.text().catch(()=>String(r.status)));
    return await r.json().catch(()=>null);
  }
  async function patchJson(path, body){
    const r = await api(path,{method:'PATCH', body:JSON.stringify(body)});
    if(!r.ok) throw new Error(await r.text().catch(()=>String(r.status)));
    return await r.json().catch(()=>null);
  }

  function normalizeProduct(p){
    const code = S(p.code || p.product_code || p.item_code || p.sku || p['الكود'] || p['كود المنتج']);
    const dist = S(p.distributor_code || p.supplier_code || p.vendor_code || p['كود الموزع']);
    const name = S(p.name || p.product_name || p.item_name || p.title || p['اسم المنتج'] || p['المنتج']);
    const unit = S(p.unit || p['الوحدة'] || p.unit_name || '');
    const type = S(p.type || p.category || p['النوع'] || '');
    const qty = n(p.current_quantity ?? p.quantity ?? p.qty ?? p.balance ?? p['الكمية الحالية'] ?? p['الرصيد الحالي'] ?? p['الكمية']);
    const price = n(p.unit_price ?? p.price ?? p.cost ?? p.avg_cost ?? p['سعر الوحدة'] ?? p['السعر'] ?? p['التكلفة']);
    const id = S(p.id || p.uuid || code || dist || name);
    return {product_id:id, product_code:code, distributor_code:dist, product_name:name, unit, product_type:type, system_qty:qty, actual_qty:null, difference_qty:null, unit_price:price, notes:''};
  }

  async function fetchInventoryProducts(){
    // الأفضل: القراءة من قاعدة البيانات مباشرة. لو فشلت، نستخدم بيانات الشاشة الحالية كبديل للمعاينة فقط.
    const paths = [
      '/rest/v1/inventory_items?select=*&order=updated_at.desc&limit=5000',
      '/rest/v1/inventory_items?select=*&limit=5000'
    ];
    for(const p of paths){
      try{
        const arr = await getJson(p);
        if(Array.isArray(arr) && arr.length){
          productsCache = arr.map(normalizeProduct).filter(x=>x.product_code || x.product_name || x.distributor_code);
          return productsCache;
        }
      }catch(e){ console.warn('Inventory products remote read failed:', e.message || e); }
    }
    // fallback من كروت/جدول المخزون الظاهر
    const rows=[];
    document.querySelectorAll('#inventoryItemsBody tr, #inventoryItemsBody .smart-product-card, .inventory-product-card').forEach((el,idx)=>{
      const text = el.innerText || '';
      const code = (text.match(/PRD-\d+/i)||[])[0] || '';
      const dist = (text.match(/(?:كود الموزع|الموزع)\s*[:：]?\s*([A-Za-z0-9\-]+)/)||[])[1] || '';
      const qtyMatch = text.match(/(?:الكمية|الرصيد|الحالي|المتوفر)\s*[:：]?\s*([0-9.]+)/);
      const qty = qtyMatch ? qtyMatch[1] : 0;
      const name = text.split('\n').find(x=>x && !/PRD-|كود|الكمية|الرصيد/.test(x)) || ('منتج '+(idx+1));
      rows.push(normalizeProduct({code, distributor_code:dist, name, quantity:qty}));
    });
    productsCache = rows;
    return rows;
  }

  function addNavAndPage(){
    if(!$('inventoryAudit')){
      const content = document.querySelector('.content') || document.querySelector('main') || document.body;
      content.insertAdjacentHTML('beforeend', `
<section id="inventoryAudit" class="page hidden inventory-audit-page-v10042">
  <div class="card section-head audit-head-v10042">
    <div><h2>قسم الجرد</h2><p>جرد مستقل مرتبط بالمالية والمخزون. عند فتح عملية جرد يتم قفل المالية والمخزون حتى إغلاق العملية.</p></div>
    <div class="actions"><button onclick="tasneefInventoryAuditV10042.openCreateModal()">+ عملية جرد جديدة</button><button class="light" onclick="tasneefInventoryAuditV10042.load()">تحديث</button></div>
  </div>
  <div id="auditActiveBoxV10042"></div>
  <div class="grid two audit-grid-v10042">
    <div class="card"><h2>عمليات الجرد</h2><div id="auditListV10042"></div></div>
    <div class="card"><h2>تفاصيل الجرد</h2><div id="auditDetailsV10042"><div class="footer-note">اختر عملية جرد أو أنشئ عملية جديدة.</div></div></div>
  </div>
</section>`);
    }
    ensureAuditNav();
  }

  function ensureAuditNav(){
    const side = document.querySelector('.side,.sidebar,aside,nav');
    if(!side) return;
    let btn = document.querySelector('[data-audit-nav-v10042],[data-audit-nav-v10043]');
    if(!btn){
      btn = document.createElement('button');
      btn.className = 'nav';
      btn.setAttribute('data-audit-nav-v10043','1');
      btn.textContent = 'الجرد';
      btn.onclick = function(){
        document.querySelectorAll('.page, section.page').forEach(p=>p.classList.add('hidden'));
        const pg = $('inventoryAudit'); if(pg) pg.classList.remove('hidden');
        document.querySelectorAll('.nav').forEach(n=>n.classList.remove('active'));
        btn.classList.add('active');
        loadAuditPage();
      };
      const orders = Array.from(side.querySelectorAll('button,.nav')).find(b=>/الأوردرات/.test(b.textContent||''));
      const logout = Array.from(side.querySelectorAll('button,.nav')).find(b=>/تسجيل خروج/.test(b.textContent||''));
      if(orders && orders.nextSibling) side.insertBefore(btn, orders.nextSibling);
      else if(logout) side.insertBefore(btn, logout);
      else side.appendChild(btn);
    }
    btn.style.display='block'; btn.classList.remove('hidden');
  }

  function injectStyle(){
    if($('inventoryAuditStyleV10042')) return;
    const st = document.createElement('style'); st.id = 'inventoryAuditStyleV10042';
    st.textContent = `
.inventory-audit-page-v10042 .audit-card{border:1px solid var(--line,#dce6e2);border-radius:16px;padding:12px;margin-bottom:10px;background:#fff;display:grid;gap:8px}
.audit-status-open{background:#fff5da;color:#8a6700}.audit-status-closed{background:#e8f4ee;color:#137a4b}.audit-status-draft{background:#edf2f7;color:#334155}
.audit-table-v10042 th,.audit-table-v10042 td{white-space:normal}.audit-table-v10042 input{min-width:90px;padding:8px}.audit-summary-v10042{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:10px 0}.audit-summary-v10042 div{background:#f8fbfa;border:1px solid var(--line,#dce6e2);border-radius:12px;padding:10px}.audit-lock-banner-v10042{background:#fff5da;border:1px solid #f0d48d;color:#6b4600;border-radius:16px;padding:12px;margin-bottom:12px;font-weight:800}.audit-modal-v10042{position:fixed;inset:0;background:rgba(0,35,28,.55);z-index:999999;display:grid;place-items:center;padding:18px}.audit-modal-box-v10042{width:min(720px,96vw);max-height:92vh;overflow:auto;background:#fff;border:1px solid var(--line,#dce6e2);border-radius:24px;padding:18px;box-shadow:0 30px 80px rgba(0,0,0,.28)}
.audit-lock-overlay-v10042{position:fixed;inset:0;background:rgba(0,35,28,.52);z-index:999998;display:grid;place-items:center;padding:18px}.audit-lock-box-v10042{width:min(560px,94vw);background:#fff;border-radius:24px;border:1px solid #dce6e2;padding:22px;text-align:center;box-shadow:0 25px 70px rgba(0,0,0,.25)}.audit-lock-box-v10042 h2{color:#0A4033;margin:0 0 8px}.audit-lock-box-v10042 p{line-height:1.8;color:#43534f}.audit-diff-pos{color:#137a4b;font-weight:900}.audit-diff-neg{color:#b83232;font-weight:900}.audit-diff-zero{color:#0A4033;font-weight:900}
@media(max-width:1000px){.audit-grid-v10042{grid-template-columns:1fr!important}}
@media print{body *{visibility:hidden!important}#auditPrintAreaV10042,#auditPrintAreaV10042 *{visibility:visible!important}#auditPrintAreaV10042{position:absolute;inset:0;background:white;padding:20px}.no-print{display:none!important}}
`;
    document.head.appendChild(st);
  }

  async function loadActiveAudit(){
    try{
      const arr = await getJson('/rest/v1/'+AUDITS+'?select=*&status=eq.open&order=started_at.desc&limit=1');
      activeAudit = Array.isArray(arr) && arr[0] ? arr[0] : null;
      localStorage.setItem('tasneef_inventory_active_audit_v10042', JSON.stringify(activeAudit || null));
    }catch(e){
      try{ activeAudit = JSON.parse(localStorage.getItem('tasneef_inventory_active_audit_v10042') || 'null'); }catch(_){ activeAudit=null; }
    }
    paintActiveBanner(); return activeAudit;
  }

  async function loadAuditPage(){ await loadActiveAudit(); await renderAuditList(); }

  function paintActiveBanner(){
    const box = $('auditActiveBoxV10042'); if(!box) return;
    if(activeAudit){
      box.innerHTML = `<div class="audit-lock-banner-v10042">يوجد جرد مفتوح: ${esc(activeAudit.audit_no||activeAudit.title||activeAudit.id)} — المالية والمخزون مغلق مؤقتًا حتى إغلاق الجرد.</div>`;
    }else box.innerHTML = '';
  }

  function showFinanceLockedModal(){
    document.querySelectorAll('.audit-lock-overlay-v10042').forEach(x=>x.remove());
    const a = activeAudit || {};
    document.body.insertAdjacentHTML('beforeend', `<div class="audit-lock-overlay-v10042" onclick="if(event.target===this)this.remove()"><div class="audit-lock-box-v10042"><h2>المالية والمخزون مغلق للجرد</h2><p>توجد عملية جرد مفتوحة، لذلك تم إيقاف إضافة أو تعديل أو حذف أي حركة مخزون حتى إغلاق عملية الجرد.</p><p><b>رقم الجرد:</b> ${esc(a.audit_no||'-')}<br><b>المسؤول:</b> ${esc(a.created_by_name||'-')}<br><b>تاريخ البدء:</b> ${esc((a.started_at||'').slice(0,19).replace('T',' '))}</p><div class="actions" style="justify-content:center"><button onclick="this.closest('.audit-lock-overlay-v10042').remove(); if(typeof showPage==='function') showPage('inventoryAudit', document.querySelector('[data-audit-nav-v10042]')); tasneefInventoryAuditV10042.load();">عرض عملية الجرد</button><button class="light" onclick="this.closest('.audit-lock-overlay-v10042').remove()">إغلاق</button></div></div></div>`);
  }

  function isFinanceTarget(el){
    if(!el || !el.closest) return false;
    if(el.closest('#inventoryAudit,.audit-modal-v10042,.audit-lock-overlay-v10042')) return false;
    const txt = S(el.textContent || el.value || '');
    if(el.closest('#inventoryItemsBody,#inventoryMovementsBody,#inventoryRequestsBody,#financeExpensesBody,.finance-tabs,.inventory-filter-bar,.finance-report-tabs,.inventory-report-tabs')) return true;
    const sec = el.closest('section,.page,.card');
    const secTxt = S(sec && sec.textContent);
    if(/المالية|المخزون|حركة المخزون|المنتجات|الموردين|العهدة/.test(secTxt) && !/قسم الجرد/.test(secTxt)) return true;
    if(/المالية|المخزون/.test(txt) && el.matches('button,.nav,[onclick]')) return true;
    return false;
  }

  function installFinanceLock(){
    ['click','submit','change','input'].forEach(evt=>{
      document.addEventListener(evt, function(e){
        if(!activeAudit) return;
        if(!isFinanceTarget(e.target)) return;
        if(evt === 'input' && ['INPUT','TEXTAREA'].includes(e.target.tagName) && e.target.closest('#inventoryAudit')) return;
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        showFinanceLockedModal();
        return false;
      }, true);
    });
    const oldShow = window.showPage;
    if(typeof oldShow === 'function' && !oldShow.__auditLockV10042){
      const wrapped = function(id, btn){
        if(activeAudit && /finance|inventory|warehouse|expenses/i.test(String(id||''))){ showFinanceLockedModal(); return; }
        return oldShow.apply(this, arguments);
      };
      wrapped.__auditLockV10042 = true;
      window.showPage = wrapped;
    }
  }

  function auditNo(){ return 'INV-AUDIT-' + String(Date.now()).slice(-6); }

  function openCreateModal(){
    document.body.insertAdjacentHTML('beforeend', `<div class="audit-modal-v10042"><div class="audit-modal-box-v10042"><h2>إنشاء عملية جرد</h2><label>اسم الجرد</label><input id="auditTitleNewV10042" value="جرد المخزون"><label>الموقع / المستودع</label><input id="auditLocationNewV10042" placeholder="المستودع الرئيسي"><label>ملاحظات</label><textarea id="auditNotesNewV10042"></textarea><div class="actions"><button onclick="tasneefInventoryAuditV10042.startAudit()">بدء الجرد وقفل المالية والمخزون</button><button class="light" onclick="this.closest('.audit-modal-v10042').remove()">إلغاء</button></div></div></div>`);
  }

  async function startAudit(){
    if(busy) return; busy=true;
    try{
      await loadActiveAudit();
      if(activeAudit) throw new Error('يوجد جرد مفتوح بالفعل. أغلقه أولًا.');
      const products = await fetchInventoryProducts();
      if(!products.length) throw new Error('لم يتم العثور على منتجات في المخزون. تأكد أن جدول inventory_items متاح.');
      const no = auditNo();
      const audit = {
        audit_no:no,
        title:S($('auditTitleNewV10042')&&$('auditTitleNewV10042').value)||'جرد المخزون',
        location:S($('auditLocationNewV10042')&&$('auditLocationNewV10042').value)||'',
        notes:S($('auditNotesNewV10042')&&$('auditNotesNewV10042').value)||'',
        status:'open',
        started_at:nowIso(),
        created_by_name:currentUserName()
      };
      const saved = await postJson('/rest/v1/'+AUDITS+'?on_conflict=audit_no', audit);
      const savedAudit = Array.isArray(saved) ? saved[0] : audit;
      const auditId = savedAudit.id || savedAudit.audit_no || no;
      const rows = products.map((p,i)=>Object.assign({}, p, {audit_id:auditId, audit_no:no, line_no:i+1, status:'not_counted', total_system_value: +(n(p.system_qty)*n(p.unit_price)).toFixed(2)}));
      // Supabase payload may be large; chunk it.
      for(let i=0;i<rows.length;i+=200){ await postJson('/rest/v1/'+ITEMS, rows.slice(i,i+200)); }
      document.querySelectorAll('.audit-modal-v10042').forEach(x=>x.remove());
      await loadAuditPage();
      await openAudit(no);
      alert('تم فتح عملية الجرد وقفل المالية والمخزون');
    }catch(e){ alert('لم يتم بدء الجرد: '+(e.message||e)); }
    finally{ busy=false; }
  }

  async function renderAuditList(){
    const host = $('auditListV10042'); if(!host) return;
    try{
      const arr = await getJson('/rest/v1/'+AUDITS+'?select=*&order=started_at.desc&limit=50');
      host.innerHTML = (arr||[]).map(a=>`<div class="audit-card"><div><b>${esc(a.audit_no||a.id)}</b> <span class="badge ${a.status==='open'?'audit-status-open':'audit-status-closed'}">${a.status==='open'?'مفتوح':'مغلق'}</span></div><small>${esc(a.title||'-')} — ${esc((a.started_at||'').slice(0,10))}</small><div class="actions"><button class="light" onclick="tasneefInventoryAuditV10042.openAudit('${esc(a.audit_no||a.id)}')">عرض</button></div></div>`).join('') || '<div class="footer-note">لا توجد عمليات جرد.</div>';
    }catch(e){ host.innerHTML = '<div class="msg err">تعذر تحميل عمليات الجرد: '+esc(e.message||e)+'</div>'; }
  }

  async function openAudit(auditNoOrId){
    const detail = $('auditDetailsV10042'); if(!detail) return;
    try{
      const audits = await getJson('/rest/v1/'+AUDITS+'?select=*&or=(audit_no.eq.'+encodeURIComponent(auditNoOrId)+',id.eq.'+encodeURIComponent(auditNoOrId)+')&limit=1');
      const audit = audits && audits[0]; if(!audit) throw new Error('عملية الجرد غير موجودة');
      const key = audit.id || audit.audit_no;
      auditItems = await getJson('/rest/v1/'+ITEMS+'?select=*&or=(audit_id.eq.'+encodeURIComponent(key)+',audit_no.eq.'+encodeURIComponent(audit.audit_no||'')+')&order=line_no.asc&limit=5000');
      renderAuditDetails(audit, auditItems);
    }catch(e){ detail.innerHTML = '<div class="msg err">تعذر فتح الجرد: '+esc(e.message||e)+'</div>'; }
  }

  function statusForDiff(diff, actual){
    if(actual === null || actual === undefined || S(actual)==='') return 'not_counted';
    if(n(diff) === 0) return 'matched';
    return n(diff) < 0 ? 'shortage' : 'excess';
  }
  function statusLabel(s){ return {not_counted:'لم يتم جرده', matched:'مطابق', shortage:'نقص', excess:'زيادة'}[s] || s; }

  function renderAuditDetails(audit, items){
    const matched = items.filter(x=>x.status==='matched').length;
    const shortage = items.filter(x=>x.status==='shortage').length;
    const excess = items.filter(x=>x.status==='excess').length;
    const not = items.filter(x=>!x.status || x.status==='not_counted').length;
    const shortageValue = items.reduce((a,x)=>a+(n(x.difference_qty)<0?Math.abs(n(x.difference_qty))*n(x.unit_price):0),0);
    const excessValue = items.reduce((a,x)=>a+(n(x.difference_qty)>0?n(x.difference_qty)*n(x.unit_price):0),0);
    const locked = audit.status === 'open';
    const rows = items.map((it,idx)=>{
      const diffClass = n(it.difference_qty)>0?'audit-diff-pos':n(it.difference_qty)<0?'audit-diff-neg':'audit-diff-zero';
      return `<tr><td>${idx+1}</td><td><b>${esc(it.product_name)}</b><br><small>${esc(it.product_code||'-')} | كود الموزع: ${esc(it.distributor_code||'-')}</small></td><td>${esc(it.unit||'-')}</td><td>${esc(it.product_type||'-')}</td><td>${n(it.system_qty)}</td><td>${locked?`<input type="number" step="0.01" value="${it.actual_qty ?? ''}" onchange="tasneefInventoryAuditV10042.updateActual('${esc(it.id)}',this.value)">`:n(it.actual_qty)}</td><td class="${diffClass}">${it.difference_qty==null?'-':n(it.difference_qty)}</td><td>${statusLabel(it.status)}</td><td>${money(n(it.unit_price))}</td><td>${esc(it.notes||'')}</td></tr>`;
    }).join('');
    $('auditDetailsV10042').innerHTML = `<div id="auditPrintAreaV10042"><div class="section-head"><div><h2>عملية جرد: ${esc(audit.audit_no)}</h2><p>${esc(audit.title||'')} — ${esc(audit.location||'')}</p><p><b>المسؤول:</b> ${esc(audit.created_by_name||'-')} | <b>الحالة:</b> ${audit.status==='open'?'مفتوح':'مغلق'} | <b>تاريخ البدء:</b> ${esc((audit.started_at||'').slice(0,19).replace('T',' '))}</p></div></div><div class="audit-summary-v10042"><div><small>إجمالي المنتجات</small><b>${items.length}</b></div><div><small>مطابق</small><b>${matched}</b></div><div><small>نقص</small><b>${shortage}</b></div><div><small>زيادة</small><b>${excess}</b></div><div><small>لم يتم جرده</small><b>${not}</b></div><div><small>قيمة النقص</small><b>${money(shortageValue)}</b></div><div><small>قيمة الزيادة</small><b>${money(excessValue)}</b></div></div><div class="actions no-print"><button class="light" onclick="window.print()">طباعة تقرير الجرد</button><button class="light" onclick="tasneefInventoryAuditV10042.exportAuditCSV()">تصدير Excel/CSV</button>${locked?`<button class="danger" onclick="tasneefInventoryAuditV10042.closeAudit('${esc(audit.audit_no)}')">إغلاق الجرد وفتح المالية والمخزون</button>`:''}</div><div class="table-wrap"><table class="audit-table-v10042"><thead><tr><th>#</th><th>المنتج</th><th>الوحدة</th><th>النوع</th><th>كمية النظام</th><th>الكمية الفعلية</th><th>الفرق</th><th>الحالة</th><th>سعر الوحدة</th><th>ملاحظات</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }

  async function updateActual(id, value){
    const it = auditItems.find(x=>String(x.id)===String(id)); if(!it) return;
    const actual = n(value);
    const diff = +(actual - n(it.system_qty)).toFixed(2);
    const status = statusForDiff(diff, value);
    try{
      await patchJson('/rest/v1/'+ITEMS+'?id=eq.'+encodeURIComponent(id), {actual_qty:actual, difference_qty:diff, status, updated_at:nowIso()});
      it.actual_qty=actual; it.difference_qty=diff; it.status=status; it.updated_at=nowIso();
      // لا نعيد بناء الجدول كامل حتى لا يفقد المستخدم مكانه، فقط تحديث الملخص عند الحاجة بتأخير بسيط
      setTimeout(()=>{ const auditNoEl = document.querySelector('#auditDetailsV10042 h2'); },50);
    }catch(e){ alert('لم يتم حفظ كمية الجرد: '+(e.message||e)); }
  }

  async function closeAudit(auditNo){
    if(!confirm('إغلاق الجرد؟ سيتم فتح المالية والمخزون، ولن يتم تعديل كميات المخزون تلقائيًا في هذه المرحلة.')) return;
    try{
      await patchJson('/rest/v1/'+AUDITS+'?audit_no=eq.'+encodeURIComponent(auditNo), {status:'closed', closed_at:nowIso(), closed_by_name:currentUserName()});
      await loadActiveAudit(); await loadAuditPage(); alert('تم إغلاق الجرد وفتح المالية والمخزون');
    }catch(e){ alert('لم يتم إغلاق الجرد: '+(e.message||e)); }
  }

  function exportAuditCSV(){
    const headers = ['المنتج','كود المنتج','كود الموزع','الوحدة','النوع','كمية النظام','الكمية الفعلية','الفرق','الحالة','سعر الوحدة','ملاحظات'];
    const rows = auditItems.map(x=>[x.product_name,x.product_code,x.distributor_code,x.unit,x.product_type,x.system_qty,x.actual_qty,x.difference_qty,statusLabel(x.status),x.unit_price,x.notes]);
    const csv = [headers, ...rows].map(r=>r.map(v=>'"'+S(v).replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='inventory_audit.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  async function boot(){
    injectStyle(); startNavKeeper(); installFinanceLock(); await loadActiveAudit();
    setInterval(loadActiveAudit, 15000);
  }

  function startNavKeeper(){
    addNavAndPage();
    ensureAuditNav();
    let ticks = 0;
    const timer = setInterval(()=>{
      ticks++;
      addNavAndPage();
      ensureAuditNav();
      if(ticks>30) clearInterval(timer);
    }, 700);
  }

  window.tasneefInventoryAuditV10042 = {load:loadAuditPage, openCreateModal, startAudit, openAudit, updateActual, closeAudit, exportAuditCSV};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

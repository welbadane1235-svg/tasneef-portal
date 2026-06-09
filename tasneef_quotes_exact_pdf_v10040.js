/* Tasneef Quotes Exact PDF Module v10040
   مستقل عن الأوردرات: يقرأ فقط من الأوردرات الآجلة، ولا يغيرها.
   يضيف عروض أسعار قابلة للتعديل بالكامل مع طباعة/معاينة.
*/
(function(){
  'use strict';
  if(window.__tasneefQuotesSafeV10040) return;
  window.__tasneefQuotesSafeV10040 = true;

  const SUPABASE_URL = 'https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const VAT_RATE = 0.15;
  const ORDER_HEADERS = ['رقم الطلب','رقم الطلب بالجروب','تاريخ الطلب','وقت الطلب','مرسل الطلب','المشروع','نوع العقار','رقم الشقة','اسم العميل','رقم العميل','المنفذ','التفاصيل','ملاحظات','تخص','تاريخ التنفيذ','كيفية التنفيذ','حالة التنفيذ','تقرير','السعر (شامل الضريبة)','الضريبة 15%','السعر قبل الضريبة','التكلفة','الربح','حالة السداد','رقم الفاتورة','فوترة بالسيستم'];
  let QUOTES = [];
  let QUOTE_ITEMS = [];
  let currentQuoteId = '';
  let selectedDueOrders = new Set();

  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const esc = v => S(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const num = v => { const n = Number(S(v).replace(/,/g,'').replace(/[^0-9.\-]/g,'')); return Number.isFinite(n) ? n : 0; };
  const money = v => num(v).toLocaleString('ar-SA',{minimumFractionDigits:2, maximumFractionDigits:2}) + ' ر.س';
  const today = () => new Date().toISOString().slice(0,10);
  const H = i => ORDER_HEADERS[i] || ('field_'+i);
  const field = (r,i) => r ? (r[H(i)] ?? '') : '';
  const orderNo = r => S(r && (r['رقم الطلب'] || r.order_no || r.orderNo || r.id)).replace(/\s+/g,'').toUpperCase();
  const statusPay = r => { const p=S(field(r,23)||r['حالة السداد']); if(/آجل|أجل|اجل/i.test(p)) return 'آجل'; if(/تم\s*السداد|مسدد|مدفوع|تم\s*الدفع/i.test(p)) return 'تم السداد'; return p; };
  const quoteItemCalc = it => {
    const qty = Math.max(0, num(it.qty || 1));
    const price = num(it.price || 0);
    const taxable = +(qty * price).toFixed(2);
    const vat = +(taxable * VAT_RATE).toFixed(2);
    const total = +(taxable + vat).toFixed(2);
    return Object.assign({}, it, {qty, price, taxable_amount:taxable, vat_amount:vat, line_total:total});
  };
  const quoteTotals = items => {
    const subtotal = items.reduce((a,i)=>a+num(i.taxable_amount),0);
    const vat_total = items.reduce((a,i)=>a+num(i.vat_amount),0);
    return {subtotal:+subtotal.toFixed(2), vat_total:+vat_total.toFixed(2), total:+(subtotal+vat_total).toFixed(2)};
  };

  async function api(path, options){
    const res = await fetch(SUPABASE_URL + path, Object.assign({
      cache:'no-store',
      headers:{apikey:SUPABASE_ANON_KEY, Authorization:'Bearer '+SUPABASE_ANON_KEY, Accept:'application/json', 'Content-Type':'application/json', Prefer:'return=representation,resolution=merge-duplicates'}
    }, options || {}));
    return res;
  }
  async function apiJson(path, options){
    const res = await api(path, options);
    if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
    return await res.json().catch(()=>null);
  }
  async function nextQuoteNo(){
    try{
      const r = await apiJson('/rest/v1/rpc/next_quote_no', {method:'POST', body:'{}'});
      return Array.isArray(r) ? r[0] : S(r || '');
    }catch(e){ return 'QUO-' + Date.now().toString().slice(-6); }
  }
  function getOrders(){
    if(window.tasneefOrdersRootLockV10036 && typeof window.tasneefOrdersRootLockV10036.rows === 'function') return window.tasneefOrdersRootLockV10036.rows() || [];
    if(window.tasneefOrdersRootLockV10035 && typeof window.tasneefOrdersRootLockV10035.rows === 'function') return window.tasneefOrdersRootLockV10035.rows() || [];
    try{ const r=JSON.parse(localStorage.getItem('tasneef_orders_v233') || '[]'); return Array.isArray(r) ? r : []; }catch(_){ return []; }
  }
  function dueOrders(){
    return getOrders().filter(r => statusPay(r)==='آجل');
  }

  function injectButton(){
    const head = document.querySelector('#orders .section-head .actions') || document.querySelector('#orders .actions');
    if(!head || $('quotesOpenBtnV10040')) return;
    const btn = document.createElement('button');
    btn.id = 'quotesOpenBtnV10040';
    btn.type = 'button';
    btn.className = 'light';
    btn.textContent = 'عروض الأسعار';
    btn.onclick = openQuotesModal;
    head.appendChild(btn);
  }
  function style(){
    if($('quotesStyleV10040')) return;
    const st = document.createElement('style');
    st.id = 'quotesStyleV10040';
    st.textContent = `
    .quote-modal-v10040{position:fixed;inset:0;background:rgba(0,30,24,.48);z-index:999999;display:grid;place-items:center;padding:16px}.quote-box-v10040{width:min(1180px,98vw);max-height:94vh;overflow:auto;background:#fff;border-radius:22px;border:1px solid var(--line,#dce6e2);box-shadow:0 20px 60px rgba(0,0,0,.22);padding:16px}.quote-head-v10040{display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #e8efec;padding-bottom:10px}.quote-tabs-v10040{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.quote-tabs-v10040 button.active{background:var(--brand,#0A4033);color:#fff}.quote-grid-v10040{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.quote-grid-v10040 .wide{grid-column:1/-1}.quote-table-v10040{width:100%;border-collapse:collapse}.quote-table-v10040 th,.quote-table-v10040 td{border-bottom:1px solid #edf1ef;padding:8px;text-align:right;vertical-align:top}.quote-table-v10040 input,.quote-table-v10040 textarea{min-width:110px}.quote-table-v10040 textarea{min-width:260px;min-height:48px}.quote-actions-v10040{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.quote-summary-v10040{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.quote-card-v10040{border:1px solid #dce6e2;background:#fbfdfc;border-radius:16px;padding:12px}.quote-card-v10040 b{color:#0A4033}.quote-pick-v10040{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}.quote-order-pick-v10040{border:1px solid #dce6e2;border-radius:14px;padding:10px;background:#fff}.quote-order-pick-v10040.active{border-color:#0A4033;background:#eef8f4}.quote-print-area{font-family:Tahoma,Arial,sans-serif;color:#111;direction:rtl}.quote-print-top{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #0A4033;padding-bottom:12px;margin-bottom:14px}.quote-print-title{text-align:center;font-size:22px;color:#0A4033;font-weight:900}.quote-print-meta{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:12px 0}.quote-print-meta div{border:1px solid #ddd;padding:8px;border-radius:8px}.quote-print-table{width:100%;border-collapse:collapse;font-size:12px}.quote-print-table th,.quote-print-table td{border:1px solid #ddd;padding:7px;text-align:right}.quote-print-total{margin-top:12px;margin-right:auto;width:330px}.quote-print-total div{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:8px}.quote-bank{margin-top:16px;border:1px dashed #0A4033;padding:10px;border-radius:8px;line-height:1.8}@media(max-width:800px){.quote-grid-v10040,.quote-summary-v10040{grid-template-columns:1fr}.quote-print-top,.quote-print-meta{grid-template-columns:1fr;display:block}}`;
    document.head.appendChild(st);
  }
  function shell(){
    let m = $('quotesModalV10040');
    if(m) return m;
    const html = `<div class="quote-modal-v10040" id="quotesModalV10040" onclick="if(event.target===this)closeQuotesModalV10040()">
      <div class="quote-box-v10040">
        <div class="quote-head-v10040"><h2>عروض الأسعار</h2><button class="danger" onclick="closeQuotesModalV10040()">إغلاق</button></div>
        <div class="quote-tabs-v10040">
          <button id="quotesTabListV10040" onclick="quotesShowTabV10040('list')">قائمة العروض</button>
          <button id="quotesTabDueV10040" onclick="quotesShowTabV10040('due')">عرض من أوردرات آجلة</button>
          <button id="quotesTabEditV10040" onclick="quotesNewBlankV10040()">عرض سعر جديد</button>
        </div>
        <div id="quotesContentV10040"></div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    return $('quotesModalV10040');
  }
  window.closeQuotesModalV10040 = function(){ $('quotesModalV10040')?.remove(); };
  async function openQuotesModal(){
    style(); shell(); await loadQuotes(); showTab('list');
  }
  window.quotesShowTabV10040 = showTab;
  function activate(tab){ ['List','Due','Edit'].forEach(t=>{ const b=$('quotesTab'+t+'V10040'); if(b) b.classList.remove('active'); }); const map={list:'List',due:'Due',edit:'Edit'}; const b=$('quotesTab'+map[tab]+'V10040'); if(b) b.classList.add('active'); }
  async function loadQuotes(){
    try{
      QUOTES = await apiJson('/rest/v1/quotes?select=*&order=updated_at.desc&limit=500', {method:'GET'}) || [];
      QUOTE_ITEMS = await apiJson('/rest/v1/quote_items?select=*&order=item_order.asc&limit=5000', {method:'GET'}) || [];
    }catch(e){ console.warn(e); QUOTES=[]; QUOTE_ITEMS=[]; }
  }
  function itemsOf(qid){ return QUOTE_ITEMS.filter(i=>String(i.quote_id)===String(qid)).sort((a,b)=>num(a.item_order)-num(b.item_order)); }
  function showTab(tab){ activate(tab); if(tab==='list') renderList(); else if(tab==='due') renderDuePicker(); else renderEditor(null, []); }
  function renderList(){
    const c=$('quotesContentV10040'); if(!c) return;
    const rows = QUOTES.map(q=>`<tr><td>${esc(q.quote_no)}</td><td>${esc(q.quote_date||'')}</td><td>${esc(q.customer_name||'-')}</td><td>${esc(q.project||'-')}</td><td>${esc(q.status||'مسودة')}</td><td>${money(q.total)}</td><td><button onclick="quotesEditV10040('${q.id}')">تعديل</button> <button class="light" onclick="quotesPrintV10040('${q.id}')">طباعة</button> <button class="danger" onclick="quotesDeleteV10040('${q.id}')">حذف</button></td></tr>`).join('') || '<tr><td colspan="7">لا توجد عروض أسعار بعد</td></tr>';
    c.innerHTML = `<div class="quote-actions-v10040"><button onclick="quotesNewBlankV10040()">+ عرض سعر جديد</button><button class="light" onclick="quotesShowTabV10040('due')">+ من أوردرات آجلة</button><button class="light" onclick="quotesReloadV10040()">تحديث</button></div><div class="table-wrap"><table><thead><tr><th>رقم العرض</th><th>التاريخ</th><th>العميل</th><th>المشروع</th><th>الحالة</th><th>الإجمالي</th><th>إجراء</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  window.quotesReloadV10040 = async function(){ await loadQuotes(); renderList(); };
  window.quotesEditV10040 = function(id){ const q=QUOTES.find(x=>String(x.id)===String(id)); if(!q) return; renderEditor(q, itemsOf(id)); };
  window.quotesDeleteV10040 = async function(id){ if(!confirm('حذف عرض السعر؟')) return; await apiJson('/rest/v1/quotes?id=eq.'+encodeURIComponent(id), {method:'DELETE'}); await loadQuotes(); renderList(); };

  function renderDuePicker(){
    selectedDueOrders = new Set();
    const orders = dueOrders();
    const projects = [...new Set(orders.map(r=>S(field(r,5))).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    const c=$('quotesContentV10040'); if(!c) return;
    c.innerHTML = `<div class="quote-grid-v10040"><div><label>بحث</label><input id="quoteDueSearchV10040" placeholder="رقم أوردر، مشروع، عميل، تفاصيل"></div><div><label>المشروع</label><select id="quoteDueProjectV10040"><option value="">كل المشاريع</option>${projects.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('')}</select></div><div style="display:flex;align-items:end"><button onclick="quotesCreateFromSelectedV10040()">إنشاء عرض من المحدد</button></div></div><div class="quote-actions-v10040"><b>الأوردرات الآجلة: ${orders.length}</b><button class="light" onclick="quotesSelectAllDueV10040()">تحديد الكل الظاهر</button></div><div id="quoteDueOrdersV10040" class="quote-pick-v10040"></div>`;
    const filter = ()=>renderDueCards();
    $('quoteDueSearchV10040')?.addEventListener('input', filter);
    $('quoteDueProjectV10040')?.addEventListener('change', filter);
    renderDueCards();
  }
  function visibleDueOrders(){
    const q=S($('quoteDueSearchV10040')?.value).toLowerCase(); const p=S($('quoteDueProjectV10040')?.value);
    return dueOrders().filter(r=>{
      if(p && S(field(r,5))!==p) return false;
      if(q){ const hay=[field(r,0),field(r,1),field(r,5),field(r,8),field(r,9),field(r,11),field(r,18)].map(S).join(' ').toLowerCase(); if(!hay.includes(q)) return false; }
      return true;
    });
  }
  function renderDueCards(){
    const host=$('quoteDueOrdersV10040'); if(!host) return;
    const rows = visibleDueOrders();
    host.innerHTML = rows.map(r=>{
      const no=orderNo(r); const checked=selectedDueOrders.has(no);
      return `<div class="quote-order-pick-v10040 ${checked?'active':''}" onclick="quotesToggleOrderV10040('${esc(no)}')"><b>${esc(no)}</b><br><small>${esc(field(r,5)||'-')} | ${esc(field(r,8)||'-')}</small><p>${esc(S(field(r,11)).slice(0,100))}</p><b>${money(field(r,18))}</b><input type="checkbox" ${checked?'checked':''} onclick="event.stopPropagation();quotesToggleOrderV10040('${esc(no)}')"></div>`;
    }).join('') || '<div class="quote-card-v10040">لا توجد أوردرات آجلة حسب الفلتر</div>';
  }
  window.quotesToggleOrderV10040 = function(no){ if(selectedDueOrders.has(no)) selectedDueOrders.delete(no); else selectedDueOrders.add(no); renderDueCards(); };
  window.quotesSelectAllDueV10040 = function(){ visibleDueOrders().forEach(r=>selectedDueOrders.add(orderNo(r))); renderDueCards(); };
  window.quotesCreateFromSelectedV10040 = async function(){
    const rows = dueOrders().filter(r=>selectedDueOrders.has(orderNo(r)));
    if(!rows.length) return alert('حدد أوردر واحد على الأقل');
    const first = rows[0];
    const qno = await nextQuoteNo();
    const q = {quote_no:qno, quote_date:today(), customer_name:S(field(first,8))||'', customer_phone:S(field(first,9))||'', customer_email:'', customer_address:'', project:S(field(first,5))||'', reference:'مجموعة أوردرات', status:'مسودة', notes:'', terms:defaultTerms()};
    const items = rows.map((r,i)=>{
      const total=num(field(r,18)); const price=+(total/(1+VAT_RATE)).toFixed(2);
      return quoteItemCalc({item_order:i+1, source_order_no:orderNo(r), description:S(field(r,11)) + (orderNo(r)?' | رقم '+orderNo(r):''), qty:1, price});
    });
    renderEditor(q, items);
  };
  window.quotesNewBlankV10040 = async function(){ renderEditor({quote_no:await nextQuoteNo(), quote_date:today(), status:'مسودة', reference:'', terms:defaultTerms(), notes:''}, [quoteItemCalc({item_order:1, description:'', qty:1, price:0})]); };
  function defaultTerms(){ return 'لا يتم تنفيذ أي طلب إلا بعد اعتماد عرض السعر حسب الاتفاق.\nبنك الراجحي\nشركة تصنيف المستقبل للتشغيل والصيانة\nرقم الحساب: 501000010006085376530\nالآيبان: SA4480000501608015376530'; }
  function renderEditor(q, items){
    activate('edit'); currentQuoteId = q && q.id ? String(q.id) : '';
    const c=$('quotesContentV10040'); if(!c) return;
    c.innerHTML = `<div class="quote-grid-v10040">
      <div><label>رقم عرض السعر</label><input id="quoteNoV10040" value="${esc(q.quote_no||'')}" ${q.id?'readonly':''}></div>
      <div><label>التاريخ</label><input id="quoteDateV10040" type="date" value="${esc(q.quote_date||today())}"></div>
      <div><label>الحالة</label><select id="quoteStatusV10040">${['مسودة','مرسل','مقبول','مرفوض','محول إلى فاتورة','ملغي'].map(s=>`<option ${S(q.status||'مسودة')===s?'selected':''}>${s}</option>`).join('')}</select></div>
      <div><label>العميل</label><input id="quoteCustomerV10040" value="${esc(q.customer_name||'')}"></div>
      <div><label>الهاتف</label><input id="quotePhoneV10040" value="${esc(q.customer_phone||'')}"></div>
      <div><label>البريد الإلكتروني</label><input id="quoteEmailV10040" value="${esc(q.customer_email||'')}"></div>
      <div><label>المشروع</label><input id="quoteProjectV10040" value="${esc(q.project||'')}"></div>
      <div><label>المرجع</label><input id="quoteReferenceV10040" value="${esc(q.reference||'')}"></div>
      <div><label>العنوان</label><input id="quoteAddressV10040" value="${esc(q.customer_address||'')}"></div>
      <div class="wide"><label>ملاحظات</label><textarea id="quoteNotesV10040">${esc(q.notes||'')}</textarea></div>
      <div class="wide"><label>شروط الدفع / بيانات الحساب</label><textarea id="quoteTermsV10040">${esc(q.terms||defaultTerms())}</textarea></div>
    </div>
    <div class="quote-actions-v10040"><button onclick="quotesAddItemV10040()">+ إضافة بند</button><button onclick="quotesSaveV10040()">حفظ مسودة</button><button class="light" onclick="quotesPreviewCurrentV10040()">معاينة / طباعة</button><button class="light" onclick="quotesShowTabV10040('list')">رجوع للقائمة</button></div>
    <div class="table-wrap"><table class="quote-table-v10040"><thead><tr><th>#</th><th>رقم الأوردر</th><th>الوصف</th><th>الكمية</th><th>السعر قبل الضريبة</th><th>الخاضع للضريبة</th><th>الضريبة</th><th>الإجمالي</th><th>حذف</th></tr></thead><tbody id="quoteItemsBodyV10040"></tbody></table></div>
    <div id="quoteTotalsV10040" class="quote-summary-v10040"></div>`;
    const safeItems = items && items.length ? items.map(quoteItemCalc) : [quoteItemCalc({item_order:1, description:'', qty:1, price:0})];
    $('quoteItemsBodyV10040').dataset.items = JSON.stringify(safeItems);
    renderItems();
  }
  function currentItems(){ try{return JSON.parse($('quoteItemsBodyV10040')?.dataset.items||'[]').map(quoteItemCalc);}catch(_){return [];} }
  function setItems(items){ $('quoteItemsBodyV10040').dataset.items = JSON.stringify(items.map(quoteItemCalc)); renderItems(); }
  function renderItems(){
    const body=$('quoteItemsBodyV10040'); if(!body) return;
    const items=currentItems();
    body.innerHTML = items.map((it,i)=>`<tr><td>${i+1}</td><td><input value="${esc(it.source_order_no||'')}" oninput="quotesItemEditV10040(${i},'source_order_no',this.value)"></td><td><textarea oninput="quotesItemEditV10040(${i},'description',this.value)">${esc(it.description||'')}</textarea></td><td><input type="number" step="0.01" value="${esc(it.qty)}" oninput="quotesItemEditV10040(${i},'qty',this.value)"></td><td><input type="number" step="0.01" value="${esc(it.price)}" oninput="quotesItemEditV10040(${i},'price',this.value)"></td><td>${money(it.taxable_amount)}</td><td>${money(it.vat_amount)}</td><td>${money(it.line_total)}</td><td><button class="danger" onclick="quotesRemoveItemV10040(${i})">حذف</button></td></tr>`).join('');
    const t=quoteTotals(items);
    const box=$('quoteTotalsV10040'); if(box) box.innerHTML = `<div class="quote-card-v10040"><small>المجموع الفرعي</small><br><b>${money(t.subtotal)}</b></div><div class="quote-card-v10040"><small>ضريبة القيمة المضافة</small><br><b>${money(t.vat_total)}</b></div><div class="quote-card-v10040"><small>الإجمالي شامل الضريبة</small><br><b>${money(t.total)}</b></div>`;
  }
  window.quotesItemEditV10040 = function(i,k,v){ const items=currentItems(); if(!items[i]) return; items[i][k]=v; setItems(items); };
  window.quotesAddItemV10040 = function(){ const items=currentItems(); items.push(quoteItemCalc({item_order:items.length+1, description:'', qty:1, price:0})); setItems(items); };
  window.quotesRemoveItemV10040 = function(i){ const items=currentItems(); items.splice(i,1); setItems(items.length?items:[quoteItemCalc({item_order:1, description:'', qty:1, price:0})]); };
  function currentQuoteFromForm(){
    const items=currentItems().map((it,i)=>quoteItemCalc(Object.assign({}, it, {item_order:i+1})));
    const t=quoteTotals(items);
    const q = {quote_no:S($('quoteNoV10040')?.value), quote_date:S($('quoteDateV10040')?.value)||today(), status:S($('quoteStatusV10040')?.value)||'مسودة', customer_name:S($('quoteCustomerV10040')?.value), customer_phone:S($('quotePhoneV10040')?.value), customer_email:S($('quoteEmailV10040')?.value), customer_address:S($('quoteAddressV10040')?.value), project:S($('quoteProjectV10040')?.value), reference:S($('quoteReferenceV10040')?.value), notes:S($('quoteNotesV10040')?.value), terms:S($('quoteTermsV10040')?.value), subtotal:t.subtotal, vat_total:t.vat_total, total:t.total};
    return {q, items};
  }
  window.quotesSaveV10040 = async function(){
    try{
      const {q,items}=currentQuoteFromForm(); if(!q.quote_no) q.quote_no=await nextQuoteNo();
      let saved;
      if(currentQuoteId){ saved=(await apiJson('/rest/v1/quotes?id=eq.'+encodeURIComponent(currentQuoteId), {method:'PATCH', body:JSON.stringify(q)}))[0]; await apiJson('/rest/v1/quote_items?quote_id=eq.'+encodeURIComponent(currentQuoteId), {method:'DELETE'}); }
      else { saved=(await apiJson('/rest/v1/quotes?on_conflict=quote_no', {method:'POST', body:JSON.stringify(q)}))[0]; currentQuoteId=saved.id; }
      const rows = items.map(it=>Object.assign({}, it, {quote_id:currentQuoteId}));
      if(rows.length) await apiJson('/rest/v1/quote_items', {method:'POST', body:JSON.stringify(rows)});
      await loadQuotes(); alert('تم حفظ عرض السعر'); renderEditor(saved || q, rows);
    }catch(e){ alert('تعذر حفظ عرض السعر: '+(e.message||e)); }
  };
  window.quotesPreviewCurrentV10040 = function(){ const {q,items}=currentQuoteFromForm(); printQuote(q, items); };
  window.quotesPrintV10040 = function(id){ const q=QUOTES.find(x=>String(x.id)===String(id)); if(!q) return; printQuote(q, itemsOf(id)); };
  function printQuote(q, items){
    items = (items || []).map(quoteItemCalc);
    const t=quoteTotals(items);
    const rows=items.map((it,i)=>{
      const ord = S(it.source_order_no || '');
      const desc = S(it.description || '') + (ord ? ' | رقم ' + ord : '');
      return `<tr>
        <td class="c">${i+1}</td>
        <td class="desc">${esc(desc)}</td>
        <td class="c">${esc(it.qty)}</td>
        <td class="num">${num(it.price).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
        <td class="num">${num(it.taxable_amount).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
        <td class="vat"><span>${num(it.vat_amount).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span><small>15%</small></td>
        <td class="num total">${num(it.line_total).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      </tr>`;
    }).join('');
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(q.quote_no||'عرض سعر')}</title>
<style>
@page{size:A4;margin:10mm 9mm}*{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;margin:0;color:#222;background:#fff;font-size:11px}.print-btn{position:fixed;top:10px;left:10px;z-index:9;background:#0A4033;color:#fff;border:0;border-radius:8px;padding:9px 14px;font-weight:700}.page{width:100%;min-height:277mm;padding:0 2mm;position:relative}.header{display:grid;grid-template-columns:1fr 90px 1fr;gap:10px;align-items:start;margin-top:4px}.en{direction:ltr;text-align:left;line-height:1.45}.ar{text-align:right;line-height:1.55}.brand-title{font-weight:700;font-size:12px}.logo{display:grid;place-items:center;color:#0A4033;font-weight:900;border:2px solid #0A4033;border-radius:14px;height:62px;margin-top:2px}.quote-title{text-align:center;font-weight:900;font-size:18px;margin:14px 0 8px}.meta{display:grid;grid-template-columns:1.1fr 1fr;gap:8px;margin:7px 0 10px}.meta table{width:100%;border-collapse:collapse}.meta td{padding:3px 4px;vertical-align:top}.lbl{font-weight:700;color:#111;white-space:nowrap}.quote-no{text-align:left;direction:ltr}.items{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:6px}.items th{background:#f4f4f4;font-weight:700;color:#222}.items th,.items td{border:1px solid #d6d6d6;padding:5px 5px;vertical-align:top}.items .c{text-align:center}.items .num{text-align:left;direction:ltr;white-space:nowrap}.items .desc{width:39%;line-height:1.55}.items .vat{text-align:center;direction:ltr;white-space:nowrap}.items .vat small{display:block;margin-top:2px;color:#444}.items .total{font-weight:700}.totals{width:360px;margin:14px 0 8px auto;border-collapse:collapse}.totals td{border-bottom:1px solid #ddd;padding:7px 5px}.totals .amount{text-align:left;direction:ltr;font-weight:700}.notes{margin-top:10px;line-height:1.7;white-space:pre-line}.bank{margin-top:8px;line-height:1.75;white-space:pre-line}.footer{position:absolute;bottom:0;left:0;right:0;text-align:center;color:#555;font-size:10px;border-top:1px solid #ddd;padding-top:5px}.currency:before{content:'⃁ ';font-weight:400}@media print{.print-btn{display:none}.page{page-break-after:auto}}
</style></head><body><button class="print-btn" onclick="window.print()">طباعة / حفظ PDF</button><main class="page">
  <section class="header">
    <div class="en"><div class="brand-title">Tasnef Future Company</div><div>Qurtubah Diet, Said Ibn Zaid, RUQA6441 - 2526.</div><div>Qurtubah, Riyadh, Kingdom of Saudi Arabia</div><div>920015589</div><div>VAT number 311784213300003</div><div>CR Number 1010915542</div></div>
    <div class="logo">TASNEF<br>تصنيف</div>
    <div class="ar"><div class="brand-title">شركة تصنيف للتشغيل والصيانة</div><div>حي قرطبة، شارع سعيد بن زيد، RUQA 6441 - 2526</div><div>قرطبة، الرياض، المملكة العربية السعودية</div><div>920015589</div><div>رقم التسجيل الضريبي 311784213300003</div><div>رقم السجل التجاري 1010915542</div></div>
  </section>
  <div class="quote-title">عرض سعر Quote</div>
  <section class="meta">
    <table><tr><td class="lbl">العميل Customer</td><td>${esc(q.customer_name||'-')}</td></tr><tr><td class="lbl">العنوان Address</td><td>${esc(q.customer_address||'-')}</td></tr><tr><td class="lbl">البريد الإلكتروني Email</td><td>${esc(q.customer_email||'-')}</td></tr><tr><td class="lbl">الهاتف Phone</td><td>${esc(q.customer_phone||'-')}</td></tr></table>
    <table><tr><td class="lbl">رقم Number</td><td class="quote-no">${esc(q.quote_no||'-')}</td></tr><tr><td class="lbl">التاريخ Date</td><td>${esc(q.quote_date||'-')}</td></tr><tr><td class="lbl">المرجع Reference</td><td>${esc(q.reference||'-')}</td></tr><tr><td class="lbl">المشروع Project</td><td>${esc(q.project||'-')}</td></tr></table>
  </section>
  <table class="items"><thead><tr><th style="width:34px">#</th><th>الوصف<br>Description</th><th style="width:55px">الكمية<br>Qty</th><th style="width:82px">السعر<br>Price</th><th style="width:105px">المبلغ الخاضع للضريبة<br>Taxable amount</th><th style="width:82px">القيمة المضافة<br>VAT amount</th><th style="width:92px">المجموع<br>Line amount</th></tr></thead><tbody>${rows}</tbody></table>
  <table class="totals"><tr><td>المجموع الفرعي Subtotal</td><td class="amount currency">${num(t.subtotal).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr><tr><td>إجمالي ضريبة القيمة المضافة VAT Total</td><td class="amount currency">${num(t.vat_total).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr><tr><td><b>المجموع شامل القيمة المضافة Total</b></td><td class="amount currency"><b>${num(t.total).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</b></td></tr></table>
  ${q.notes?`<section class="notes"><b>ملاحظات Notes</b><br>${esc(q.notes)}</section>`:''}
  <section class="bank">${esc(q.terms||defaultTerms())}</section>
  <div class="footer">Tasnef Future Company — ${esc(q.quote_no||'Quote')} — شركة تصنيف للتشغيل والصيانة</div>
</main></body></html>`;
    const w=window.open('','_blank'); if(!w) return alert('اسمح بفتح النوافذ المنبثقة للطباعة'); w.document.write(html); w.document.close(); setTimeout(()=>w.focus(),300);
  }

  function boot(){ style(); injectButton(); setInterval(injectButton, 2000); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

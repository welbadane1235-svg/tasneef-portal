/* Tasneef Quotes Safe Module v10039
   مستقل عن الأوردرات: يقرأ فقط من الأوردرات الآجلة، ولا يغيرها.
   يضيف عروض أسعار قابلة للتعديل بالكامل مع طباعة/معاينة.
*/
(function(){
  'use strict';
  if(window.__tasneefQuotesSafeV10039) return;
  window.__tasneefQuotesSafeV10039 = true;

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
    if(!head || $('quotesOpenBtnV10039')) return;
    const btn = document.createElement('button');
    btn.id = 'quotesOpenBtnV10039';
    btn.type = 'button';
    btn.className = 'light';
    btn.textContent = 'عروض الأسعار';
    btn.onclick = openQuotesModal;
    head.appendChild(btn);
  }
  function style(){
    if($('quotesStyleV10039')) return;
    const st = document.createElement('style');
    st.id = 'quotesStyleV10039';
    st.textContent = `
    .quote-modal-v10039{position:fixed;inset:0;background:rgba(0,30,24,.48);z-index:999999;display:grid;place-items:center;padding:16px}.quote-box-v10039{width:min(1180px,98vw);max-height:94vh;overflow:auto;background:#fff;border-radius:22px;border:1px solid var(--line,#dce6e2);box-shadow:0 20px 60px rgba(0,0,0,.22);padding:16px}.quote-head-v10039{display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #e8efec;padding-bottom:10px}.quote-tabs-v10039{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.quote-tabs-v10039 button.active{background:var(--brand,#0A4033);color:#fff}.quote-grid-v10039{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.quote-grid-v10039 .wide{grid-column:1/-1}.quote-table-v10039{width:100%;border-collapse:collapse}.quote-table-v10039 th,.quote-table-v10039 td{border-bottom:1px solid #edf1ef;padding:8px;text-align:right;vertical-align:top}.quote-table-v10039 input,.quote-table-v10039 textarea{min-width:110px}.quote-table-v10039 textarea{min-width:260px;min-height:48px}.quote-actions-v10039{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.quote-summary-v10039{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.quote-card-v10039{border:1px solid #dce6e2;background:#fbfdfc;border-radius:16px;padding:12px}.quote-card-v10039 b{color:#0A4033}.quote-pick-v10039{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}.quote-order-pick-v10039{border:1px solid #dce6e2;border-radius:14px;padding:10px;background:#fff}.quote-order-pick-v10039.active{border-color:#0A4033;background:#eef8f4}.quote-print-area{font-family:Tahoma,Arial,sans-serif;color:#111;direction:rtl}.quote-print-top{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #0A4033;padding-bottom:12px;margin-bottom:14px}.quote-print-title{text-align:center;font-size:22px;color:#0A4033;font-weight:900}.quote-print-meta{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:12px 0}.quote-print-meta div{border:1px solid #ddd;padding:8px;border-radius:8px}.quote-print-table{width:100%;border-collapse:collapse;font-size:12px}.quote-print-table th,.quote-print-table td{border:1px solid #ddd;padding:7px;text-align:right}.quote-print-total{margin-top:12px;margin-right:auto;width:330px}.quote-print-total div{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:8px}.quote-bank{margin-top:16px;border:1px dashed #0A4033;padding:10px;border-radius:8px;line-height:1.8}@media(max-width:800px){.quote-grid-v10039,.quote-summary-v10039{grid-template-columns:1fr}.quote-print-top,.quote-print-meta{grid-template-columns:1fr;display:block}}`;
    document.head.appendChild(st);
  }
  function shell(){
    let m = $('quotesModalV10039');
    if(m) return m;
    const html = `<div class="quote-modal-v10039" id="quotesModalV10039" onclick="if(event.target===this)closeQuotesModalV10039()">
      <div class="quote-box-v10039">
        <div class="quote-head-v10039"><h2>عروض الأسعار</h2><button class="danger" onclick="closeQuotesModalV10039()">إغلاق</button></div>
        <div class="quote-tabs-v10039">
          <button id="quotesTabListV10039" onclick="quotesShowTabV10039('list')">قائمة العروض</button>
          <button id="quotesTabDueV10039" onclick="quotesShowTabV10039('due')">عرض من أوردرات آجلة</button>
          <button id="quotesTabEditV10039" onclick="quotesNewBlankV10039()">عرض سعر جديد</button>
        </div>
        <div id="quotesContentV10039"></div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    return $('quotesModalV10039');
  }
  window.closeQuotesModalV10039 = function(){ $('quotesModalV10039')?.remove(); };
  async function openQuotesModal(){
    style(); shell(); await loadQuotes(); showTab('list');
  }
  window.quotesShowTabV10039 = showTab;
  function activate(tab){ ['List','Due','Edit'].forEach(t=>{ const b=$('quotesTab'+t+'V10039'); if(b) b.classList.remove('active'); }); const map={list:'List',due:'Due',edit:'Edit'}; const b=$('quotesTab'+map[tab]+'V10039'); if(b) b.classList.add('active'); }
  async function loadQuotes(){
    try{
      QUOTES = await apiJson('/rest/v1/quotes?select=*&order=updated_at.desc&limit=500', {method:'GET'}) || [];
      QUOTE_ITEMS = await apiJson('/rest/v1/quote_items?select=*&order=item_order.asc&limit=5000', {method:'GET'}) || [];
    }catch(e){ console.warn(e); QUOTES=[]; QUOTE_ITEMS=[]; }
  }
  function itemsOf(qid){ return QUOTE_ITEMS.filter(i=>String(i.quote_id)===String(qid)).sort((a,b)=>num(a.item_order)-num(b.item_order)); }
  function showTab(tab){ activate(tab); if(tab==='list') renderList(); else if(tab==='due') renderDuePicker(); else renderEditor(null, []); }
  function renderList(){
    const c=$('quotesContentV10039'); if(!c) return;
    const rows = QUOTES.map(q=>`<tr><td>${esc(q.quote_no)}</td><td>${esc(q.quote_date||'')}</td><td>${esc(q.customer_name||'-')}</td><td>${esc(q.project||'-')}</td><td>${esc(q.status||'مسودة')}</td><td>${money(q.total)}</td><td><button onclick="quotesEditV10039('${q.id}')">تعديل</button> <button class="light" onclick="quotesPrintV10039('${q.id}')">طباعة</button> <button class="danger" onclick="quotesDeleteV10039('${q.id}')">حذف</button></td></tr>`).join('') || '<tr><td colspan="7">لا توجد عروض أسعار بعد</td></tr>';
    c.innerHTML = `<div class="quote-actions-v10039"><button onclick="quotesNewBlankV10039()">+ عرض سعر جديد</button><button class="light" onclick="quotesShowTabV10039('due')">+ من أوردرات آجلة</button><button class="light" onclick="quotesReloadV10039()">تحديث</button></div><div class="table-wrap"><table><thead><tr><th>رقم العرض</th><th>التاريخ</th><th>العميل</th><th>المشروع</th><th>الحالة</th><th>الإجمالي</th><th>إجراء</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  window.quotesReloadV10039 = async function(){ await loadQuotes(); renderList(); };
  window.quotesEditV10039 = function(id){ const q=QUOTES.find(x=>String(x.id)===String(id)); if(!q) return; renderEditor(q, itemsOf(id)); };
  window.quotesDeleteV10039 = async function(id){ if(!confirm('حذف عرض السعر؟')) return; await apiJson('/rest/v1/quotes?id=eq.'+encodeURIComponent(id), {method:'DELETE'}); await loadQuotes(); renderList(); };

  function renderDuePicker(){
    selectedDueOrders = new Set();
    const orders = dueOrders();
    const projects = [...new Set(orders.map(r=>S(field(r,5))).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    const c=$('quotesContentV10039'); if(!c) return;
    c.innerHTML = `<div class="quote-grid-v10039"><div><label>بحث</label><input id="quoteDueSearchV10039" placeholder="رقم أوردر، مشروع، عميل، تفاصيل"></div><div><label>المشروع</label><select id="quoteDueProjectV10039"><option value="">كل المشاريع</option>${projects.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('')}</select></div><div style="display:flex;align-items:end"><button onclick="quotesCreateFromSelectedV10039()">إنشاء عرض من المحدد</button></div></div><div class="quote-actions-v10039"><b>الأوردرات الآجلة: ${orders.length}</b><button class="light" onclick="quotesSelectAllDueV10039()">تحديد الكل الظاهر</button></div><div id="quoteDueOrdersV10039" class="quote-pick-v10039"></div>`;
    const filter = ()=>renderDueCards();
    $('quoteDueSearchV10039')?.addEventListener('input', filter);
    $('quoteDueProjectV10039')?.addEventListener('change', filter);
    renderDueCards();
  }
  function visibleDueOrders(){
    const q=S($('quoteDueSearchV10039')?.value).toLowerCase(); const p=S($('quoteDueProjectV10039')?.value);
    return dueOrders().filter(r=>{
      if(p && S(field(r,5))!==p) return false;
      if(q){ const hay=[field(r,0),field(r,1),field(r,5),field(r,8),field(r,9),field(r,11),field(r,18)].map(S).join(' ').toLowerCase(); if(!hay.includes(q)) return false; }
      return true;
    });
  }
  function renderDueCards(){
    const host=$('quoteDueOrdersV10039'); if(!host) return;
    const rows = visibleDueOrders();
    host.innerHTML = rows.map(r=>{
      const no=orderNo(r); const checked=selectedDueOrders.has(no);
      return `<div class="quote-order-pick-v10039 ${checked?'active':''}" onclick="quotesToggleOrderV10039('${esc(no)}')"><b>${esc(no)}</b><br><small>${esc(field(r,5)||'-')} | ${esc(field(r,8)||'-')}</small><p>${esc(S(field(r,11)).slice(0,100))}</p><b>${money(field(r,18))}</b><input type="checkbox" ${checked?'checked':''} onclick="event.stopPropagation();quotesToggleOrderV10039('${esc(no)}')"></div>`;
    }).join('') || '<div class="quote-card-v10039">لا توجد أوردرات آجلة حسب الفلتر</div>';
  }
  window.quotesToggleOrderV10039 = function(no){ if(selectedDueOrders.has(no)) selectedDueOrders.delete(no); else selectedDueOrders.add(no); renderDueCards(); };
  window.quotesSelectAllDueV10039 = function(){ visibleDueOrders().forEach(r=>selectedDueOrders.add(orderNo(r))); renderDueCards(); };
  window.quotesCreateFromSelectedV10039 = async function(){
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
  window.quotesNewBlankV10039 = async function(){ renderEditor({quote_no:await nextQuoteNo(), quote_date:today(), status:'مسودة', reference:'', terms:defaultTerms(), notes:''}, [quoteItemCalc({item_order:1, description:'', qty:1, price:0})]); };
  function defaultTerms(){ return 'لا يتم تنفيذ أي طلب إلا بعد اعتماد عرض السعر حسب الاتفاق.\nبنك الراجحي\nشركة تصنيف المستقبل للتشغيل والصيانة\nرقم الحساب: 501000010006085376530\nالآيبان: SA4480000501608015376530'; }
  function renderEditor(q, items){
    activate('edit'); currentQuoteId = q && q.id ? String(q.id) : '';
    const c=$('quotesContentV10039'); if(!c) return;
    c.innerHTML = `<div class="quote-grid-v10039">
      <div><label>رقم عرض السعر</label><input id="quoteNoV10039" value="${esc(q.quote_no||'')}" ${q.id?'readonly':''}></div>
      <div><label>التاريخ</label><input id="quoteDateV10039" type="date" value="${esc(q.quote_date||today())}"></div>
      <div><label>الحالة</label><select id="quoteStatusV10039">${['مسودة','مرسل','مقبول','مرفوض','محول إلى فاتورة','ملغي'].map(s=>`<option ${S(q.status||'مسودة')===s?'selected':''}>${s}</option>`).join('')}</select></div>
      <div><label>العميل</label><input id="quoteCustomerV10039" value="${esc(q.customer_name||'')}"></div>
      <div><label>الهاتف</label><input id="quotePhoneV10039" value="${esc(q.customer_phone||'')}"></div>
      <div><label>البريد الإلكتروني</label><input id="quoteEmailV10039" value="${esc(q.customer_email||'')}"></div>
      <div><label>المشروع</label><input id="quoteProjectV10039" value="${esc(q.project||'')}"></div>
      <div><label>المرجع</label><input id="quoteReferenceV10039" value="${esc(q.reference||'')}"></div>
      <div><label>العنوان</label><input id="quoteAddressV10039" value="${esc(q.customer_address||'')}"></div>
      <div class="wide"><label>ملاحظات</label><textarea id="quoteNotesV10039">${esc(q.notes||'')}</textarea></div>
      <div class="wide"><label>شروط الدفع / بيانات الحساب</label><textarea id="quoteTermsV10039">${esc(q.terms||defaultTerms())}</textarea></div>
    </div>
    <div class="quote-actions-v10039"><button onclick="quotesAddItemV10039()">+ إضافة بند</button><button onclick="quotesSaveV10039()">حفظ مسودة</button><button class="light" onclick="quotesPreviewCurrentV10039()">معاينة / طباعة</button><button class="light" onclick="quotesShowTabV10039('list')">رجوع للقائمة</button></div>
    <div class="table-wrap"><table class="quote-table-v10039"><thead><tr><th>#</th><th>رقم الأوردر</th><th>الوصف</th><th>الكمية</th><th>السعر قبل الضريبة</th><th>الخاضع للضريبة</th><th>الضريبة</th><th>الإجمالي</th><th>حذف</th></tr></thead><tbody id="quoteItemsBodyV10039"></tbody></table></div>
    <div id="quoteTotalsV10039" class="quote-summary-v10039"></div>`;
    const safeItems = items && items.length ? items.map(quoteItemCalc) : [quoteItemCalc({item_order:1, description:'', qty:1, price:0})];
    $('quoteItemsBodyV10039').dataset.items = JSON.stringify(safeItems);
    renderItems();
  }
  function currentItems(){ try{return JSON.parse($('quoteItemsBodyV10039')?.dataset.items||'[]').map(quoteItemCalc);}catch(_){return [];} }
  function setItems(items){ $('quoteItemsBodyV10039').dataset.items = JSON.stringify(items.map(quoteItemCalc)); renderItems(); }
  function renderItems(){
    const body=$('quoteItemsBodyV10039'); if(!body) return;
    const items=currentItems();
    body.innerHTML = items.map((it,i)=>`<tr><td>${i+1}</td><td><input value="${esc(it.source_order_no||'')}" oninput="quotesItemEditV10039(${i},'source_order_no',this.value)"></td><td><textarea oninput="quotesItemEditV10039(${i},'description',this.value)">${esc(it.description||'')}</textarea></td><td><input type="number" step="0.01" value="${esc(it.qty)}" oninput="quotesItemEditV10039(${i},'qty',this.value)"></td><td><input type="number" step="0.01" value="${esc(it.price)}" oninput="quotesItemEditV10039(${i},'price',this.value)"></td><td>${money(it.taxable_amount)}</td><td>${money(it.vat_amount)}</td><td>${money(it.line_total)}</td><td><button class="danger" onclick="quotesRemoveItemV10039(${i})">حذف</button></td></tr>`).join('');
    const t=quoteTotals(items);
    const box=$('quoteTotalsV10039'); if(box) box.innerHTML = `<div class="quote-card-v10039"><small>المجموع الفرعي</small><br><b>${money(t.subtotal)}</b></div><div class="quote-card-v10039"><small>ضريبة القيمة المضافة</small><br><b>${money(t.vat_total)}</b></div><div class="quote-card-v10039"><small>الإجمالي شامل الضريبة</small><br><b>${money(t.total)}</b></div>`;
  }
  window.quotesItemEditV10039 = function(i,k,v){ const items=currentItems(); if(!items[i]) return; items[i][k]=v; setItems(items); };
  window.quotesAddItemV10039 = function(){ const items=currentItems(); items.push(quoteItemCalc({item_order:items.length+1, description:'', qty:1, price:0})); setItems(items); };
  window.quotesRemoveItemV10039 = function(i){ const items=currentItems(); items.splice(i,1); setItems(items.length?items:[quoteItemCalc({item_order:1, description:'', qty:1, price:0})]); };
  function currentQuoteFromForm(){
    const items=currentItems().map((it,i)=>quoteItemCalc(Object.assign({}, it, {item_order:i+1})));
    const t=quoteTotals(items);
    const q = {quote_no:S($('quoteNoV10039')?.value), quote_date:S($('quoteDateV10039')?.value)||today(), status:S($('quoteStatusV10039')?.value)||'مسودة', customer_name:S($('quoteCustomerV10039')?.value), customer_phone:S($('quotePhoneV10039')?.value), customer_email:S($('quoteEmailV10039')?.value), customer_address:S($('quoteAddressV10039')?.value), project:S($('quoteProjectV10039')?.value), reference:S($('quoteReferenceV10039')?.value), notes:S($('quoteNotesV10039')?.value), terms:S($('quoteTermsV10039')?.value), subtotal:t.subtotal, vat_total:t.vat_total, total:t.total};
    return {q, items};
  }
  window.quotesSaveV10039 = async function(){
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
  window.quotesPreviewCurrentV10039 = function(){ const {q,items}=currentQuoteFromForm(); printQuote(q, items); };
  window.quotesPrintV10039 = function(id){ const q=QUOTES.find(x=>String(x.id)===String(id)); if(!q) return; printQuote(q, itemsOf(id)); };
  function printQuote(q, items){
    const t=quoteTotals(items.map(quoteItemCalc));
    const rows=items.map((it,i)=>{ it=quoteItemCalc(it); return `<tr><td>${i+1}</td><td>${esc(it.description||'')}</td><td>${esc(it.source_order_no||'-')}</td><td>${it.qty}</td><td>${money(it.price)}</td><td>${money(it.taxable_amount)}</td><td>15%</td><td>${money(it.vat_amount)}</td><td>${money(it.line_total)}</td></tr>`; }).join('');
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(q.quote_no||'عرض سعر')}</title><style>body{font-family:Tahoma,Arial,sans-serif;margin:24px;color:#111}.quote-print-top{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #0A4033;padding-bottom:12px;margin-bottom:14px}.quote-print-title{text-align:center;font-size:24px;color:#0A4033;font-weight:900;margin:12px}.quote-print-meta{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:12px 0}.quote-print-meta div{border:1px solid #ddd;padding:8px;border-radius:8px}.quote-print-table{width:100%;border-collapse:collapse;font-size:12px}.quote-print-table th,.quote-print-table td{border:1px solid #ddd;padding:7px;text-align:right}.quote-print-total{margin-top:12px;margin-right:auto;width:350px}.quote-print-total div{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:8px}.quote-bank{margin-top:16px;border:1px dashed #0A4033;padding:10px;border-radius:8px;line-height:1.8;white-space:pre-line}@media print{button{display:none}body{margin:12mm}}</style></head><body><button onclick="window.print()">طباعة / حفظ PDF</button><div class="quote-print-area"><div class="quote-print-top"><div><b>Tasnef Future Company</b><br>Qurtubah, Riyadh, Kingdom of Saudi Arabia<br>920015589<br>VAT number 311784213300003<br>CR Number 1010915542</div><div style="text-align:left"><b>شركة تصنيف للتشغيل والصيانة</b><br>حي قرطبة، الرياض، المملكة العربية السعودية<br>920015589<br>رقم التسجيل الضريبي 311784213300003<br>رقم السجل التجاري 1010915542</div></div><div class="quote-print-title">عرض سعر Quote</div><div class="quote-print-meta"><div><b>العميل Customer:</b> ${esc(q.customer_name||'-')}</div><div><b>رقم العرض Number:</b> ${esc(q.quote_no||'-')}</div><div><b>الهاتف Phone:</b> ${esc(q.customer_phone||'-')}</div><div><b>التاريخ Date:</b> ${esc(q.quote_date||'-')}</div><div><b>العنوان Address:</b> ${esc(q.customer_address||'-')}</div><div><b>المرجع Reference:</b> ${esc(q.reference||'-')}</div><div><b>البريد Email:</b> ${esc(q.customer_email||'-')}</div><div><b>المشروع:</b> ${esc(q.project||'-')}</div></div><table class="quote-print-table"><thead><tr><th>#</th><th>الوصف Description</th><th>رقم الأوردر</th><th>الكمية Qty</th><th>السعر Price</th><th>المبلغ الخاضع للضريبة</th><th>VAT</th><th>القيمة المضافة</th><th>المجموع</th></tr></thead><tbody>${rows}</tbody></table><div class="quote-print-total"><div><b>المجموع الفرعي Subtotal</b><span>${money(t.subtotal)}</span></div><div><b>إجمالي ضريبة القيمة المضافة VAT Total</b><span>${money(t.vat_total)}</span></div><div><b>المجموع شامل القيمة المضافة Total</b><span>${money(t.total)}</span></div></div>${q.notes?`<div class="quote-bank"><b>ملاحظات Notes</b><br>${esc(q.notes)}</div>`:''}<div class="quote-bank">${esc(q.terms||defaultTerms())}</div></div></body></html>`;
    const w=window.open('','_blank'); if(!w) return alert('اسمح بفتح النوافذ المنبثقة للطباعة'); w.document.write(html); w.document.close(); setTimeout(()=>w.focus(),300);
  }

  function boot(){ style(); injectButton(); setInterval(injectButton, 2000); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

(function(){
  if(window.__tasneefOrdersWorkflowV8) return;
  window.__tasneefOrdersWorkflowV8 = true;

  const STORE='tasneef_orders_v233';
  const FLOW='tasneef_orders_workflow_v8';
  const VAT=0.15;
  const $=(id)=>document.getElementById(id);
  const S=(v)=>String(v ?? '').trim();
  const N=(v)=>Number(String(v ?? 0).replace(/,/g,'')) || 0;
  const A=(v)=>Array.isArray(v) ? v : [];
  const E=(v)=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const seed=()=>window.TASNEEF_ORDERS_SEED || {headers:[],orders:[],lists:{}};
  const H=(i)=>seed().headers?.[i] || [
    'رقم الطلب','رقم الطلب بالجروب','تاريخ الطلب','وقت الطلب','مرسل الطلب','المشروع','نوع العقار','رقم الشقة','اسم العميل','رقم العميل','المنفذ','التفاصيل','ملاحظات','تخص','تاريخ التنفيذ','كيفية التنفيذ','حالة التنفيذ','تقرير','السعر (شامل الضريبة)','الضريبة 15%','السعر قبل الضريبة','التكلفة','الربح','حالة السداد','رقم الفاتورة','فوترة بالسيستم'
  ][i] || ('field_'+i);
  const list=(idx)=>A(seed().lists?.[H(idx)]);
  const session=()=>{
    try{ return JSON.parse(localStorage.getItem('tasneef_user') || 'null') || {}; }
    catch(e){ return {}; }
  };
  const role=()=>S(session().role);
  const userName=()=>S(session().full_name || session().name || session().username || 'مستخدم');
  const isAdmin=()=>['admin','general_manager'].includes(role());
  const isFinance=()=>['admin','general_manager','financial_manager'].includes(role());
  const canCreate=()=>['admin','general_manager','operations_manager','supervisor','technician'].includes(role());
  const canUseAdminOrders=()=>!!$('ordersCardsV6') || !!$('ordersCardsV360');

  function getOrders(){
    try{
      const saved=JSON.parse(localStorage.getItem(STORE) || 'null');
      if(Array.isArray(saved) && saved.length) return saved;
    }catch(e){}
    return JSON.parse(JSON.stringify(seed().orders || []));
  }
  function setOrders(rows){
    localStorage.setItem(STORE, JSON.stringify(rows || []));
  }
  function flow(){
    try{ return JSON.parse(localStorage.getItem(FLOW) || '{}') || {}; }
    catch(e){ return {}; }
  }
  function setFlow(v){ localStorage.setItem(FLOW, JSON.stringify(v || {})); }
  function orderKey(row){ return S(row?.[H(0)] || row?.order_no || row?.id); }
  function orderFlow(row){
    const f=flow();
    return f[orderKey(row)] || {};
  }
  function saveOrderFlow(key, data){
    const f=flow();
    f[key]={...(f[key]||{}), ...data, updated_at:new Date().toISOString()};
    setFlow(f);
  }
  function today(){ const d=new Date(); return d.toISOString().slice(0,10); }
  function timeNow(){ const d=new Date(); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
  function nextOrderNo(rows){
    let max=0;
    A(rows).forEach(r=>{ const m=S(r[H(0)]).match(/(\d+)/); if(m) max=Math.max(max,Number(m[1])||0); });
    return 'ORD'+(max+1);
  }
  function calc(price){
    const gross=N(price);
    const before=gross ? gross/(1+VAT) : 0;
    return {gross:+gross.toFixed(2), vat:+(gross-before).toFixed(2), before:+before.toFixed(2)};
  }
  function projectOptions(selected){
    const rows=A(window.data?.projects).map(p=>S(p.name || p.project_name)).filter(Boolean);
    const names=[...new Set([...rows, ...list(5)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    return '<option value="">اختر المشروع</option>'+names.map(n=>`<option value="${E(n)}" ${S(selected)===n?'selected':''}>${E(n)}</option>`).join('');
  }

  function ensureStyle(){
    if($('ordersWorkflowStyleV8')) return;
    const st=document.createElement('style');
    st.id='ordersWorkflowStyleV8';
    st.textContent=`
      .owf-badges-v8{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}
      .owf-badge-v8{border:1px solid #d8e8e2;background:#f4faf7;color:#073d31;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:900}
      .owf-badge-v8.wait{background:#fff8e8;color:#8a5b00;border-color:#ecd38a}
      .owf-badge-v8.ok{background:#e6f7ee;color:#087047;border-color:#bfe6d1}
      .owf-badge-v8.bad{background:#fde8e8;color:#a92525;border-color:#efc2c2}
      .owf-portal-v8{display:grid;gap:14px}
      .owf-grid-v8{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .owf-list-v8{display:grid;gap:10px}
      .owf-card-v8{background:#fff;border:1px solid var(--line,#dce6e2);border-radius:18px;padding:14px;box-shadow:0 8px 24px rgba(10,64,51,.05)}
      .owf-card-v8 h3{margin:0 0 7px;color:var(--brand,#0A4033)}
      @media(max-width:760px){.owf-grid-v8{grid-template-columns:1fr}}
    `;
    document.head.appendChild(st);
  }

  function badgeHtml(row){
    const f=orderFlow(row);
    const invoice=S(row[H(24)] || f.invoice_no);
    const billing=S(row[H(25)] || f.billing_status);
    const approval=S(f.approval_status || 'بانتظار اعتماد مدير النظام');
    return `<div class="owf-badges-v8">
      <span class="owf-badge-v8 ok">الطلب منشأ</span>
      <span class="owf-badge-v8 ${invoice?'ok':'wait'}">الفاتورة: ${invoice?E(invoice):'بانتظار المالية'}</span>
      <span class="owf-badge-v8 ${approval==='معتمد'?'ok':approval==='مرفوض'?'bad':'wait'}">الاعتماد: ${E(approval)}</span>
      ${billing?`<span class="owf-badge-v8">${E(billing)}</span>`:''}
    </div>`;
  }

  function enhanceAdminCards(){
    ensureStyle();
    if(!canUseAdminOrders()) return;
    const cards=[...document.querySelectorAll('.order-card-v6,.order-card-v360')];
    const rows=getOrders();
    cards.forEach(card=>{
      if(card.dataset.workflowV8==='1') return;
      const edit=[...card.querySelectorAll('button')].find(b=>S(b.getAttribute('onclick')).includes('editOrderV233'));
      const m=S(edit?.getAttribute('onclick')).match(/editOrderV233\((\d+)\)/);
      if(!m) return;
      const idx=Number(m[1]);
      const row=rows[idx]; if(!row) return;
      card.dataset.workflowV8='1';
      const head=card.querySelector('.order-card-head-v6,.order-card-head-v360') || card.firstElementChild;
      if(head) head.insertAdjacentHTML('afterend', badgeHtml(row));
      const actions=card.querySelector('.order-actions-v6,.order-card-actions-v360');
      if(actions){
        if(isFinance()) actions.insertAdjacentHTML('beforeend', `<button class="light" onclick="ordersWorkflowInvoiceV8(${idx})">إدخال الفاتورة</button>`);
        if(isAdmin()) actions.insertAdjacentHTML('beforeend', `<button onclick="ordersWorkflowApproveV8(${idx})">اعتماد</button>`);
      }
    });
  }

  function afterRender(){
    setTimeout(enhanceAdminCards, 0);
  }
  const oldRender=window.renderOrdersV233;
  if(typeof oldRender==='function'){
    window.renderOrdersV233=function(){
      const r=oldRender.apply(this, arguments);
      afterRender();
      return r;
    };
  }

  window.ordersWorkflowInvoiceV8=function(idx){
    if(!isFinance()) return alert('إدخال الفاتورة خاص بالمالية ومدير النظام');
    const rows=getOrders(); const row=rows[idx]; if(!row) return;
    const oldInv=S(row[H(24)]);
    const inv=prompt('رقم الفاتورة', oldInv);
    if(inv===null) return;
    row[H(24)]=S(inv);
    row[H(25)]=S(row[H(25)]) || (list(25)[0] || 'تمت الفوترة');
    rows[idx]=row; setOrders(rows);
    saveOrderFlow(orderKey(row), {invoice_no:S(inv), billing_status:row[H(25)], finance_by:userName(), finance_at:new Date().toISOString()});
    if(typeof msg==='function') msg('تم تحديث فاتورة الأوردر');
    if(typeof window.renderOrdersV233==='function') window.renderOrdersV233();
  };

  window.ordersWorkflowApproveV8=function(idx){
    if(!isAdmin()) return alert('الاعتماد خاص بمدير النظام');
    const rows=getOrders(); const row=rows[idx]; if(!row) return;
    if(!S(row[H(24)])){
      const ok=confirm('لا يوجد رقم فاتورة لهذا الأوردر. هل تريد اعتماد الطلب رغم ذلك؟');
      if(!ok) return;
    }
    saveOrderFlow(orderKey(row), {approval_status:'معتمد', approved_by:userName(), approved_at:new Date().toISOString()});
    if(typeof msg==='function') msg('تم اعتماد الأوردر من مدير النظام');
    if(typeof window.renderOrdersV233==='function') window.renderOrdersV233();
  };

  function ensurePortal(){
    if(!canCreate()) return;
    const isSup=!!document.querySelector('.sup-tabs');
    const isTech=!!document.querySelector('.tech-main-tabs');
    if(!isSup && !isTech) return;
    ensureStyle();
    if($('ordersPortalV8')) return;
    const section=document.createElement('section');
    section.id='ordersPortalV8';
    section.className=isTech ? 'tech-main-page' : 'sup-page';
    section.innerHTML=`
      <section class="card owf-portal-v8">
        <h2>الأوردرات</h2>
        <div class="owf-grid-v8">
          <div><label>المشروع</label><select id="owfProjectV8"></select></div>
          <div><label>رقم الطلب بالجروب</label><input id="owfGroupNoV8" placeholder="اختياري"></div>
          <div><label>اسم العميل</label><input id="owfClientV8" placeholder="اختياري"></div>
          <div><label>رقم العميل</label><input id="owfPhoneV8" placeholder="اختياري"></div>
          <div><label>السعر شامل الضريبة</label><input id="owfPriceV8" type="number" min="0" step="0.01"></div>
          <div><label>المنفذ</label><input id="owfExecutorV8" placeholder="اختياري"></div>
          <div style="grid-column:1/-1"><label>التفاصيل</label><textarea id="owfDetailsV8" placeholder="اكتب تفاصيل الطلب"></textarea></div>
          <div style="grid-column:1/-1"><label>ملاحظات</label><input id="owfNotesV8" placeholder="اختياري"></div>
        </div>
        <div class="actions"><button onclick="ordersWorkflowCreateV8()">حفظ الأوردر</button><button class="light" onclick="ordersWorkflowRenderMineV8()">تحديث</button></div>
      </section>
      <section class="card"><h2>أوردراتي</h2><div id="owfMineListV8" class="owf-list-v8"></div></section>`;
    const host=document.querySelector('.mobile-shell,.tech-shell') || document.body;
    host.appendChild(section);
    if(isSup){
      const nav=document.querySelector('.sup-tabs');
      const btn=document.createElement('button');
      btn.className='sup-tab';
      btn.textContent='الأوردرات';
      btn.onclick=function(){ window.showSupervisorWindow ? window.showSupervisorWindow('ordersPortalV8',btn) : showPortal(section, btn, '.sup-page', '.sup-tab'); setTimeout(fillPortalProjects,50); };
      nav?.appendChild(btn);
    }
    if(isTech){
      const nav=document.querySelector('.tech-main-tabs');
      const btn=document.createElement('button');
      btn.className='tech-main-tab';
      btn.textContent='الأوردرات';
      btn.onclick=function(){ window.showTechMainTab ? window.showTechMainTab('ordersPortalV8',btn) : showPortal(section, btn, '.tech-main-page', '.tech-main-tab'); setTimeout(fillPortalProjects,50); };
      nav?.appendChild(btn);
    }
    fillPortalProjects();
    window.ordersWorkflowRenderMineV8();
  }
  function showPortal(section, btn, pageSel, tabSel){
    document.querySelectorAll(pageSel).forEach(p=>p.classList.remove('active'));
    section.classList.add('active');
    document.querySelectorAll(tabSel).forEach(b=>b.classList.remove('active'));
    btn?.classList.add('active');
  }
  function fillPortalProjects(){
    if($('owfProjectV8')) $('owfProjectV8').innerHTML=projectOptions($('owfProjectV8').value);
  }
  window.ordersWorkflowCreateV8=function(){
    if(!canCreate()) return alert('إنشاء الأوردرات غير متاح لهذا المستخدم');
    const project=S($('owfProjectV8')?.value);
    const details=S($('owfDetailsV8')?.value);
    if(!project) return alert('اختر المشروع');
    if(!details) return alert('اكتب تفاصيل الطلب');
    const rows=getOrders();
    const price=calc($('owfPriceV8')?.value);
    const row={};
    row[H(0)]=nextOrderNo(rows);
    row[H(1)]=S($('owfGroupNoV8')?.value);
    row[H(2)]=today();
    row[H(3)]=timeNow();
    row[H(4)]=userName();
    row[H(5)]=project;
    row[H(8)]=S($('owfClientV8')?.value);
    row[H(9)]=S($('owfPhoneV8')?.value);
    row[H(10)]=S($('owfExecutorV8')?.value);
    row[H(11)]=details;
    row[H(12)]=S($('owfNotesV8')?.value);
    row[H(16)]=list(16)[1] || 'لم ينفذ';
    row[H(18)]=price.gross;
    row[H(19)]=price.vat;
    row[H(20)]=price.before;
    row[H(21)]=0;
    row[H(22)]=price.before;
    row[H(23)]=list(23)[1] || 'آجل';
    row[H(25)]=list(25)[1] || 'لم تتم';
    rows.unshift(row);
    setOrders(rows);
    saveOrderFlow(orderKey(row), {created_by:userName(), creator_role:role(), workflow_status:'بانتظار المالية', approval_status:'بانتظار اعتماد مدير النظام'});
    ['owfGroupNoV8','owfClientV8','owfPhoneV8','owfPriceV8','owfExecutorV8','owfDetailsV8','owfNotesV8'].forEach(id=>{ if($(id)) $(id).value=''; });
    if(typeof msg==='function') msg('تم إنشاء الأوردر وإرساله للمالية');
    window.ordersWorkflowRenderMineV8();
  };
  window.ordersWorkflowRenderMineV8=function(){
    const box=$('owfMineListV8'); if(!box) return;
    const name=userName();
    const rows=getOrders().filter(r=>S(r[H(4)])===name).slice(0,20);
    box.innerHTML=rows.map(r=>`<article class="owf-card-v8"><h3>${E(r[H(0)]||'-')} - ${E(r[H(5)]||'-')}</h3><p>${E(r[H(11)]||'')}</p>${badgeHtml(r)}</article>`).join('') || '<div class="owf-card-v8">لا توجد أوردرات منشأة من حسابك حتى الآن.</div>';
  };

  function boot(){
    ensurePortal();
    afterRender();
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,500));
  setTimeout(boot,1200);
  setInterval(()=>{ if($('ordersPortalV8')) fillPortalProjects(); },5000);
})();

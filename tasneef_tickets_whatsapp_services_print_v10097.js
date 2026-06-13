/* Tasneef v10097 - Tickets WhatsApp + Contracts Services Print
   Safe UI patch only: does not modify stored data, finance, inventory or calculations. */
(function(){
  'use strict';
  const S = v => (v==null?'':String(v)).trim();
  const esc = s => S(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  const byId = id => document.getElementById(id);
  const txt = el => S(el && el.textContent).replace(/\s+/g,' ');
  const waUrl = msg => 'https://wa.me/?text=' + encodeURIComponent(msg);

  function cleanTicketText(card){
    const clone = card.cloneNode(true);
    clone.querySelectorAll('.tas-v10097-wa-ticket,button,.actions').forEach(x=>x.remove());
    return txt(clone);
  }

  function buildTicketMsg(card, idx){
    const body = cleanTicketText(card);
    const today = new Date().toLocaleDateString('ar-SA');
    return [
      'بلاغ صيانة / تكت',
      'التاريخ: ' + today,
      '----------------------',
      body || ('تكت رقم ' + idx),
      '----------------------',
      'شركة تصنيف لإدارة المرافق'
    ].join('\n');
  }

  function addTicketWhatsappButtons(){
    const box = byId('ticketsBody');
    if(!box) return;
    const cards = Array.from(box.children).filter(el => el && el.nodeType===1);
    cards.forEach((card, i)=>{
      if(card.querySelector('.tas-v10097-wa-ticket')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'light tas-v10097-wa-ticket';
      btn.textContent = 'إرسال واتساب';
      btn.style.marginTop = '8px';
      btn.onclick = function(ev){
        ev.preventDefault(); ev.stopPropagation();
        window.open(waUrl(buildTicketMsg(card, i+1)), '_blank', 'noopener');
      };
      const actions = card.querySelector('.actions') || card.querySelector('.smart-ticket-actions') || card;
      actions.appendChild(btn);
    });
  }

  function observeTickets(){
    const box = byId('ticketsBody');
    if(!box || box.__tasV10097Obs) return;
    box.__tasV10097Obs = true;
    new MutationObserver(()=>setTimeout(addTicketWhatsappButtons, 30)).observe(box,{childList:true,subtree:true});
    setTimeout(addTicketWhatsappButtons, 150);
  }

  const oldRenderTickets = window.renderTickets;
  if(typeof oldRenderTickets === 'function' && !oldRenderTickets.__tasV10097Wrapped){
    const wrapped = function(){
      const r = oldRenderTickets.apply(this, arguments);
      setTimeout(addTicketWhatsappButtons, 80);
      return r;
    };
    wrapped.__tasV10097Wrapped = true;
    window.renderTickets = wrapped;
  }

  function tableRows(tbodyId){
    const tb = byId(tbodyId);
    if(!tb) return [];
    return Array.from(tb.querySelectorAll('tr')).map(tr=>Array.from(tr.children).map(td=>txt(td))).filter(r=>r.some(Boolean));
  }

  function groupContractsAndServices(){
    const contracts = tableRows('contractsBody');
    const services = tableRows('contractServicesBody');
    const map = new Map();
    function ensure(name){
      name = S(name) || 'مشروع غير محدد';
      if(!map.has(name)) map.set(name,{name,contracts:[],services:[]});
      return map.get(name);
    }
    contracts.forEach(r=>{
      const p = ensure(r[0]);
      p.contracts.push({
        buildings:r[1]||'', flats:r[2]||'', start:r[3]||'', end:r[4]||'', days:r[5]||'', status:r[6]||''
      });
    });
    services.forEach(r=>{
      const p = ensure(r[0]);
      p.services.push({
        supervisor:r[1]||'', service:r[2]||'', type:r[3]||'', repeat:r[4]||'', visits:r[5]||'', done:r[7]||'', remain:r[8]||'', last:r[9]||'', due:r[10]||'', status:r[11]||'', notes:r[12]||''
      });
    });
    return Array.from(map.values()).sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  }

  function printContractsServices(){
    try{
      if(typeof window.renderContracts==='function') window.renderContracts();
      if(typeof window.renderContractServices==='function') window.renderContractServices();
    }catch(e){}
    setTimeout(()=>{
      const groups = groupContractsAndServices();
      if(!groups.length){ alert('لا توجد بيانات ظاهرة للطباعة. افتح قسم الخدمات والعقود واضغط تحديث البيانات ثم أعد المحاولة.'); return; }
      const now = new Date().toLocaleString('ar-SA');
      let body = groups.map(g=>`<section class="project"><h2>${esc(g.name)}</h2>
        <h3>العقود</h3>
        ${g.contracts.length ? `<table><thead><tr><th>العمائر</th><th>الشقق</th><th>بداية العقد</th><th>نهاية العقد</th><th>الأيام المتبقية</th><th>الحالة</th></tr></thead><tbody>${g.contracts.map(c=>`<tr><td>${esc(c.buildings)}</td><td>${esc(c.flats)}</td><td>${esc(c.start)}</td><td>${esc(c.end)}</td><td>${esc(c.days)}</td><td>${esc(c.status)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">لا توجد بيانات عقد ظاهرة لهذا المشروع.</p>'}
        <h3>الخدمات السنوية / التعاقدية</h3>
        ${g.services.length ? `<table><thead><tr><th>الخدمة</th><th>النوع</th><th>التكرار</th><th>عدد الزيارات</th><th>تم</th><th>المتبقي</th><th>آخر تنفيذ</th><th>الاستحقاق</th><th>الحالة</th><th>المشرف</th><th>ملاحظات</th></tr></thead><tbody>${g.services.map(s=>`<tr><td>${esc(s.service)}</td><td>${esc(s.type)}</td><td>${esc(s.repeat)}</td><td>${esc(s.visits)}</td><td>${esc(s.done)}</td><td>${esc(s.remain)}</td><td>${esc(s.last)}</td><td>${esc(s.due)}</td><td>${esc(s.status)}</td><td>${esc(s.supervisor)}</td><td>${esc(s.notes)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">لا توجد خدمات ظاهرة لهذا المشروع.</p>'}
      </section>`).join('');
      const w = window.open('', '_blank');
      if(!w){ alert('المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.'); return; }
      w.document.open();
      w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير العقود والخدمات</title><style>
        body{font-family:Arial,Tahoma,sans-serif;margin:24px;color:#082b22;background:#fff;direction:rtl} .head{border:2px solid #0b4f3f;border-radius:14px;padding:16px;margin-bottom:18px} h1{margin:0 0 8px;font-size:24px} h2{margin:0 0 10px;background:#0b4f3f;color:#fff;padding:10px 12px;border-radius:10px;font-size:18px} h3{margin:14px 0 8px;color:#0b4f3f;font-size:15px} .project{page-break-inside:avoid;border:1px solid #cfe3dc;border-radius:14px;padding:14px;margin-bottom:18px} table{width:100%;border-collapse:collapse;margin:8px 0 12px;font-size:12px} th,td{border:1px solid #cfe3dc;padding:7px;text-align:right;vertical-align:top} th{background:#eef7f4;color:#0b4f3f}.muted{color:#667; font-size:12px}@media print{button{display:none}.project{break-inside:avoid}}
      </style></head><body><div class="head"><h1>تقرير العقود والخدمات السنوية</h1><div>تاريخ الطباعة: ${esc(now)}</div><div>شركة تصنيف لإدارة المرافق</div></div>${body}<script>setTimeout(()=>print(),500)<\/script></body></html>`);
      w.document.close();
    },120);
  }

  function addContractsPrintButton(){
    const host = document.querySelector('#servicesSubTab .section-title .actions') || document.querySelector('#servicesSubTab .actions');
    if(!host || host.querySelector('.tas-v10097-print-services')) return;
    const btn = document.createElement('button');
    btn.type='button'; btn.className='light tas-v10097-print-services'; btn.textContent='طباعة';
    btn.onclick=printContractsServices;
    host.appendChild(btn);
  }

  window.tasneefPrintContractsServicesV10097 = printContractsServices;
  window.addEventListener('load', ()=>{
    addContractsPrintButton(); observeTickets(); addTicketWhatsappButtons();
    setInterval(()=>{ addContractsPrintButton(); observeTickets(); addTicketWhatsappButtons(); }, 1500);
  });
})();

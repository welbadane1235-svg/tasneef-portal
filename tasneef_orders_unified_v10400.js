/* Tasneef Orders Unified v10404
   المصدر الوحيد لقسم الأوردرات.
   - يحافظ على كل بيانات orders_shared القديمة دون حذف أو إعادة كتابة جماعية.
   - يمنع تشغيل سكربتات الأوردرات القديمة.
   - نوع الطلب: عميل داخلي / جمعية / أوردر خارجي.
   - منشئ الطلب والمعدل يسجلان تلقائياً من جلسة المستخدم.
   - تحقق إلزامي لاسم العميل ورقمه والوحدة والتفاصيل.
   - سجل تدقيق مستقل لكل إنشاء وتعديل.
*/
(function(){
  'use strict';
  if(window.__tasneefOrdersUnifiedV10404) return;
  window.__tasneefOrdersUnifiedV10404=true;

  const URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const TABLE='orders_shared';
  const AUDIT='order_audit_logs';
  const PAGE_SIZE=15;
  let rows=[], page=1, saving=false, editNo='';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const E=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const now=()=>new Date().toISOString();
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const timeNow=()=>new Intl.DateTimeFormat('ar-SA',{timeZone:'Asia/Riyadh',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date());
  const notify=(t,type='ok')=>{ try{ if(typeof window.msg==='function') window.msg(t,type); else alert(t); }catch(_){ alert(t); } };
  const user=()=>{ try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};} };
  const userName=u=>S(u.name||u.full_name||u.display_name||u.username||u.email||'مستخدم النظام');
  const userRole=u=>S(u.role||u.type||u.user_role||'user');
  const orderNo=r=>S(r?.order_no||r?.data?.['رقم الطلب']||r?.data?.order_no||r?.id);
  const dataOf=r=>r&&r.data&&typeof r.data==='object'?r.data:r||{};
  const field=(r,...keys)=>{const d=dataOf(r); for(const k of keys){ if(d[k]!==undefined&&d[k]!==null&&S(d[k])!=='') return d[k]; } return '';};
  const num=v=>{const n=Number(S(v).replace(/,/g,'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0;};
  const money=v=>num(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';

  async function api(path,opt={}){
    const res=await fetch(URL+path,{...opt,cache:'no-store',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',Accept:'application/json',Prefer:'return=representation,resolution=merge-duplicates',...(opt.headers||{})}});
    if(!res.ok) throw new Error((await res.text().catch(()=>''))||('HTTP '+res.status));
    const text=await res.text(); return text?JSON.parse(text):null;
  }
  function projects(){
    const list=(window.data&&Array.isArray(window.data.projects)?window.data.projects:[]);
    return list.map(p=>({id:S(p.id||p.project_id),name:S(p.name||p.project_name||p.official_name||p.client_name)})).filter(x=>x.name);
  }
  function projectName(r){
    const d=dataOf(r), direct=field(r,'project_name','المشروع','اسم المشروع','project','projectName','الموقع','site_name','site');
    if(S(direct)) return S(direct);
    const flow=(r&&r.flow&&typeof r.flow==='object')?r.flow:{};
    const flowName=S(flow.project_name||flow['المشروع']||flow.project||flow.site_name);
    if(flowName) return flowName;
    const pid=S(d.project_id||d['معرف المشروع']||d.projectId||flow.project_id||flow.projectId||r?.project_id);
    if(pid){ const hit=projects().find(p=>S(p.id)===pid); if(hit) return hit.name; }
    return '';
  }
  function receiptFromRow(r){
    const d=dataOf(r), candidates=[d['بيانات الإيصال'],d.receipt_meta,d.receipt_data,d['الإيصال'],d.receipt,d.receipt_url,d.receiptUrl,d.attachment,d.attachment_url,d.file_url,d.url];
    for(const x of candidates){
      if(!x) continue;
      if(typeof x==='string'&&S(x)) return {url:S(x),name:'إيصال '+orderNo(r),type:/\.pdf(?:$|\?)/i.test(x)?'application/pdf':''};
      if(typeof x==='object'){
        const url=S(x.url||x.data_url||x.dataUrl||x.public_url||x.publicUrl||x.path||x.src||x.file);
        if(url) return {url,name:S(x.name||x.file_name||x.filename||'إيصال '+orderNo(r)),type:S(x.type||x.mime_type||x.mime)};
      }
    }
    return null;
  }
  function openReceipt(idx){
    const r=rows[idx],rec=receiptFromRow(r); if(!rec?.url){notify('لا يوجد إيصال محفوظ لهذا الأوردر','err');return;}
    const url=rec.url,isPdf=/pdf|\.pdf(?:$|\?)/i.test(rec.type+' '+url);
    const w=window.open('','_blank'); if(!w){notify('اسمح بالنوافذ المنبثقة لعرض الإيصال','err');return;}
    const body=isPdf?`<iframe src="${E(url)}" style="width:100%;height:calc(100vh - 54px);border:0"></iframe>`:`<img src="${E(url)}" alt="الإيصال" style="max-width:100%;height:auto;display:block;margin:auto">`;
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${E(rec.name)}</title><style>body{margin:0;background:#f2f5f4;font-family:Tahoma,Arial}.bar{background:#064b3b;color:#fff;padding:14px 18px;font-weight:800}.content{padding:14px;text-align:center}</style></head><body><div class="bar">${E(rec.name)}</div><div class="content">${body}</div></body></html>`);w.document.close();
  }
  function cardState(r){
    const status=S(field(r,'حالة التنفيذ','status')),payment=S(field(r,'حالة السداد','payment_status')),billing=S(field(r,'حالة الفوترة','billing_status')||'لم تتم'),invoiceNo=S(field(r,'رقم الفاتورة','invoice_number')),invoiceDate=S(field(r,'تاريخ الفوترة','invoice_date'));
    if(/ملغي|ملغى|cancel/i.test(status)) return 'ou-card-cancelled';
    if(/لم ينفذ|جديد|لم يتم/i.test(status)) return 'ou-card-pending';
    const done=/تم التنفيذ|مكتمل|منفذ/i.test(status),paid=/تم السداد|مسدد|مدفوع/i.test(payment),billed=/تمت|مفوتر/i.test(billing)&&!!invoiceNo&&!!invoiceDate;
    return done&&paid&&billed?'ou-card-complete':'ou-card-warning';
  }
  function renderSummary(list){
    const host=$('ordersSummaryV233');if(!host)return;
    const totals=list.reduce((a,r)=>{const inc=num(field(r,'السعر (شامل الضريبة)','inclusive_total','total_with_vat')),bef=num(field(r,'السعر قبل الضريبة','before_vat'))||(inc/1.15),vat=num(field(r,'الضريبة 15%','vat_amount'))||(inc-bef),profit=num(field(r,'الربح','net_profit'))||(bef-num(field(r,'التكلفة','cost')));a.before+=bef;a.vat+=vat;a.inclusive+=inc;a.profit+=profit;return a;},{before:0,vat:0,inclusive:0,profit:0});
    host.className='ou-summary-fixed';host.innerHTML=`<div><small>إجمالي قبل الضريبة</small><b>${E(money(totals.before))}</b></div><div><small>إجمالي الضريبة</small><b>${E(money(totals.vat))}</b></div><div><small>إجمالي شامل الضريبة</small><b>${E(money(totals.inclusive))}</b></div><div><small>إجمالي صافي الربح</small><b>${E(money(totals.profit))}</b></div>`;
  }

  function orderDate(r){
    const raw=S(field(r,'تاريخ الطلب','order_date','created_at')||r?.updated_at); if(!raw)return '';
    const m=raw.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/); if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    const m2=raw.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/); if(m2)return `${m2[3]}-${m2[1].padStart(2,'0')}-${m2[2].padStart(2,'0')}`;
    const dt=new Date(raw); return Number.isNaN(dt.getTime())?'':new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(dt);
  }
  function executors(){
    const out=new Map(), add=(x,forcedRole='')=>{
      if(!x||typeof x!=='object')return;
      const name=S(x.name||x.full_name||x.worker_name||x.username||x.display_name);
      const role=S(forcedRole||x.role||x.type||x.job_title||x.position||x.category||x.worker_type).toLowerCase();
      const activeRaw=S(x.status||x.state||'active').toLowerCase();
      const active=(x.is_active!==false&&x.active!==false&&!/inactive|stopped|موقوف|غير نشط/.test(activeRaw));
      const allowed=/supervisor|technician|technical|مشرف|فني/.test(role);
      if(name&&allowed&&active)out.set(name,{name,role:/technician|technical|فني/.test(role)?'فني':'مشرف'});
    };
    if(window.data){
      (window.data.supervisors||[]).forEach(x=>add(x,'supervisor'));
      (window.data.technicians||[]).forEach(x=>add(x,'technician'));
      ['users','workers','employees'].forEach(k=>(window.data[k]||[]).forEach(x=>add(x)));
    }
    return [...out.values()].sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  }
  function makeNo(){
    const max=rows.reduce((m,r)=>{const z=orderNo(r).match(/(\d+)/g); return Math.max(m,z?Number(z[z.length-1])||0:0);},0);
    return 'ORD-'+String(max+1).padStart(6,'0');
  }
  function stopLegacy(){
    ['__tasneefOrdersV233','__tasneefOrdersSharedSyncDisabled','__tasneefOrdersRootMasterV10031','__tasneefOrdersRootLockV10033','__tasneefOrdersMasterLockV10024','__tasneefOrdersStabilityPatchV10022','__tasneefOrdersFinalStabilityV10023','__tasneefOrdersRootCleanV10189','__tasneefSupervisorOrdersV10061'].forEach(k=>window[k]=true);
  }
  stopLegacy();

  function injectStyle(){ if($('ordersUnifiedStyle10400'))return; const st=document.createElement('style');st.id='ordersUnifiedStyle10400';st.textContent=`
  .ou-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ou-wide{grid-column:1/-1}.ou-required label:after{content:' *';color:#b42318}.ou-invalid{border-color:#d92d20!important;box-shadow:0 0 0 3px rgba(217,45,32,.12)!important}.ou-select{position:relative}.ou-note{background:#f3f8f6;border:1px solid #d7e7e0;padding:9px;border-radius:11px;color:#315d50}.ou-card{background:#fff;border:1px solid var(--line,#dce7e2);border-radius:17px;padding:13px;display:grid;gap:9px}.ou-head{display:flex;justify-content:space-between;gap:9px}.ou-head h3{margin:0;color:var(--brand,#075e4c)}.ou-chips{display:flex;gap:6px;flex-wrap:wrap}.ou-chip{padding:5px 9px;border-radius:999px;background:#edf7f3;color:#075e4c;font-size:12px;font-weight:800}.ou-meta{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.ou-meta div{padding:8px;background:#f8fbfa;border-radius:10px}.ou-meta small{display:block;color:#6a7974}.ou-actions{display:flex;gap:7px;flex-wrap:wrap}.ou-history{display:grid;gap:8px}.ou-history article{padding:10px;border:1px solid #e0e9e5;border-radius:12px;background:#fbfdfc}.ou-modal{position:fixed;inset:0;background:rgba(0,35,28,.52);z-index:100000;display:grid;place-items:center;padding:16px}.ou-modal>div{width:min(900px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:16px}.ou-creator{font-weight:800;color:#075e4c}.ou-money-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.ou-money{padding:10px;border-radius:12px;background:#f4f8f6;border:1px solid #dce8e3}.ou-money small{display:block;color:#67766f}.ou-money b{font-size:15px}.ou-smart-wrap{position:relative}.ou-smart-menu{position:absolute;z-index:10020;top:calc(100% + 4px);right:0;left:0;max-height:230px;overflow:auto;background:#fff;border:1px solid #d7e4de;border-radius:12px;box-shadow:0 12px 30px rgba(0,40,30,.14);padding:5px;display:none}.ou-smart-menu.open{display:block}.ou-smart-option{padding:9px 10px;border-radius:9px;cursor:pointer}.ou-smart-option:hover,.ou-smart-option.active{background:#edf7f3;color:#075e4c}.ou-smart-empty{padding:10px;color:#77847f;text-align:center}.ou-filter-extra{min-width:150px}@media(max-width:800px){.ou-grid{grid-template-columns:1fr}.ou-wide{grid-column:auto}.ou-meta,.ou-money-grid{grid-template-columns:1fr}}
  #ordersSummaryV233.ou-summary-fixed{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important;height:auto!important;min-height:0!important;align-items:stretch!important;margin:10px 0!important}
  #ordersSummaryV233.ou-summary-fixed>div{height:auto!important;min-height:76px!important;max-height:none!important;padding:12px!important;border:1px solid #dce7e2!important;border-radius:14px!important;background:#fff!important;display:flex!important;flex-direction:column!important;justify-content:center!important;overflow:visible!important}
  #ordersSummaryV233.ou-summary-fixed small{display:block;color:#66756f;margin-bottom:5px}#ordersSummaryV233.ou-summary-fixed b{font-size:20px;line-height:1.3;color:#063f33;white-space:nowrap}
  .ou-card.ou-card-complete{background:#effaf4;border-color:#80c99f;box-shadow:inset 5px 0 0 #21864f}.ou-card.ou-card-warning{background:#fff9e8;border-color:#e7c96a;box-shadow:inset 5px 0 0 #d5a514}.ou-card.ou-card-pending{background:#fff1f1;border-color:#efaaaa;box-shadow:inset 5px 0 0 #e15c5c}.ou-card.ou-card-cancelled{background:#f7dddd;border-color:#a72b2b;box-shadow:inset 5px 0 0 #861f1f}.ou-card.ou-card-cancelled .ou-head h3{color:#7f1d1d}
  .ou-receipt-disabled{opacity:.5;cursor:not-allowed!important}.ou-actions button{min-width:92px}
  @media(max-width:900px){#ordersSummaryV233.ou-summary-fixed{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:520px){#ordersSummaryV233.ou-summary-fixed{grid-template-columns:1fr!important}}
  `;document.head.appendChild(st);}

  function optionList(id,values){let d=$(id);if(!d){d=document.createElement('datalist');d.id=id;document.body.appendChild(d);}d.innerHTML=[...new Set(values.filter(Boolean))].map(v=>`<option value="${E(v)}"></option>`).join('');}
  function smartInput(id,getValues){
    const input=$(id); if(!input||input.dataset.ouSmart)return; input.dataset.ouSmart='1'; input.removeAttribute('list');
    const wrap=document.createElement('div');wrap.className='ou-smart-wrap';input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
    const menu=document.createElement('div');menu.className='ou-smart-menu';wrap.appendChild(menu);let active=-1;
    const values=()=>[...new Set((typeof getValues==='function'?getValues():getValues||[]).map(x=>S(x)).filter(Boolean))];
    const draw=()=>{const q=S(input.value).toLowerCase(),all=values(),items=all.filter(x=>!q||x.toLowerCase().includes(q)).slice(0,80);active=-1;menu.innerHTML=items.length?items.map(x=>`<div class="ou-smart-option" data-value="${E(x)}">${E(x)}</div>`).join(''):'<div class="ou-smart-empty">لا توجد نتائج</div>';menu.classList.add('open');};
    input.addEventListener('focus',draw);input.addEventListener('input',draw);
    input.addEventListener('keydown',e=>{const opts=[...menu.querySelectorAll('.ou-smart-option')];if(e.key==='ArrowDown'){e.preventDefault();active=Math.min(opts.length-1,active+1);}else if(e.key==='ArrowUp'){e.preventDefault();active=Math.max(0,active-1);}else if(e.key==='Enter'&&active>=0){e.preventDefault();input.value=opts[active].dataset.value;menu.classList.remove('open');input.dispatchEvent(new Event('change',{bubbles:true}));}else if(e.key==='Escape')menu.classList.remove('open');opts.forEach((o,i)=>o.classList.toggle('active',i===active));opts[active]?.scrollIntoView({block:'nearest'});});
    menu.addEventListener('mousedown',e=>{const o=e.target.closest('.ou-smart-option');if(!o)return;e.preventDefault();input.value=o.dataset.value;menu.classList.remove('open');input.dispatchEvent(new Event('change',{bubbles:true}));});
    document.addEventListener('mousedown',e=>{if(!wrap.contains(e.target))menu.classList.remove('open');});
  }
  function setupSmartInputs(){
    smartInput('ouProject',()=>projects().map(x=>x.name));
    smartInput('ouCustomer',()=>rows.map(r=>S(field(r,'اسم العميل','customer_name'))).filter(Boolean));
    smartInput('ouExecutor',()=>executors().map(x=>x.name));
  }
  function recalcFinance(){
    const inclusive=Math.max(0,num($('ouInclusive')?.value??$('ouPrice')?.value));
    const before=inclusive/1.15, vat=inclusive-before, cost=Math.max(0,num($('ouCost')?.value)), profit=before-cost;
    if($('ouBefore'))$('ouBefore').value=before.toFixed(2);if($('ouVat'))$('ouVat').value=vat.toFixed(2);if($('ouProfit'))$('ouProfit').value=profit.toFixed(2);
  }
  function ensureExtraFilters(){
    const adminHost=$('orderSearchV233')?.closest('.filters')||$('orderSearchV233')?.parentElement;
    if(adminHost&&!$('ouAdminTypeFilter')) adminHost.insertAdjacentHTML('beforeend','<select id="ouAdminTypeFilter" class="ou-filter-extra"><option value="">كل أنواع الطلب</option><option value="internal">عميل داخلي</option><option value="association">جمعية</option><option value="external">أوردر خارجي</option></select>');
    const supHost=$('supOrderSearchV10061')?.closest('.filters')||$('supOrderSearchV10061')?.parentElement;
    if(supHost&&!$('ouSupTypeFilter')) supHost.insertAdjacentHTML('beforeend','<select id="ouSupTypeFilter" class="ou-filter-extra"><option value="">كل أنواع الطلب</option><option value="internal">عميل داخلي</option><option value="association">جمعية</option><option value="external">أوردر خارجي</option></select><select id="ouSupExecutorFilter" class="ou-filter-extra"><option value="">كل المنفذين</option></select><select id="ouSupPaymentFilter" class="ou-filter-extra"><option value="">كل حالات السداد</option></select><select id="ouSupBillingFilter" class="ou-filter-extra"><option value="">كل حالات الفوترة</option><option>تمت</option><option>لم تتم</option></select>');
  }
  function rebuildAdmin(){
    const host=$('orderFormFieldsV233'); if(!host)return false;
    $('orderGroupNoV233')?.closest('.split')?.remove();
    const title=$('orderFormTitleV233'); if(title)title.textContent='إضافة أوردر';
    const note=host.parentElement?.querySelector('.footer-note'); if(note)note.textContent='منشئ الطلب ووقت الإنشاء يسجلان تلقائياً. لا يمكن الحفظ قبل إكمال البيانات الإلزامية.';
    host.className='ou-grid';
    host.innerHTML=`
      <div class="ou-required"><label>نوع الطلب</label><select id="ouType"><option value="">اختر النوع</option><option value="internal">عميل داخلي</option><option value="association">جمعية</option><option value="external">أوردر خارجي</option></select></div>
      <div class="ou-required"><label>المشروع / الموقع</label><input id="ouProject" list="ouProjectsList" placeholder="اكتب للبحث أو اختر"></div>
      <div class="ou-required"><label>اسم العميل / المسؤول</label><input id="ouCustomer" list="ouCustomersList" placeholder="اسم العميل"></div>
      <div class="ou-required"><label>رقم العميل</label><input id="ouPhone" inputmode="tel" placeholder="05xxxxxxxx"></div>
      <div class="ou-required"><label>رقم الشقة / الوحدة / الموقع</label><input id="ouUnit" placeholder="مثال A-12 أو البيسمنت"></div>
      <div><label>المنفذ (مشرف أو فني)</label><input id="ouExecutor" placeholder="اكتب اسم المشرف أو الفني للبحث"></div>
      <div><label>حالة التنفيذ</label><select id="ouStatus"><option>لم ينفذ</option><option>تحت التنفيذ</option><option>تم التنفيذ</option><option>ملغي</option></select></div>
      <div><label>حالة السداد</label><select id="ouPayment"><option value="">غير محدد</option><option>آجل</option><option>تم السداد</option><option>جزئي</option></select></div>
      <div><label>حالة الفوترة</label><select id="ouBilling"><option value="لم تتم">لم تتم</option><option value="تمت">تمت</option></select></div>
      <div><label>رقم الفاتورة</label><input id="ouInvoiceNo" placeholder="يظهر عند اختيار تمت"></div>
      <div><label>تاريخ الفوترة</label><input id="ouInvoiceDate" type="date"></div>
      <div><label>الإجمالي شامل الضريبة</label><input id="ouInclusive" type="number" min="0" step="0.01" placeholder="0.00"></div>
      <div><label>القيمة قبل الضريبة</label><input id="ouBefore" type="number" readonly></div>
      <div><label>الضريبة 15%</label><input id="ouVat" type="number" readonly></div>
      <div><label>التكلفة</label><input id="ouCost" type="number" min="0" step="0.01" placeholder="0.00"></div>
      <div><label>صافي الربح</label><input id="ouProfit" type="number" readonly></div>
      <div class="ou-wide ou-required"><label>تفاصيل الطلب</label><textarea id="ouDetails" rows="4" placeholder="اكتب وصف الطلب بوضوح"></textarea></div>
      <div class="ou-wide"><label>ملاحظات</label><textarea id="ouNotes" rows="2"></textarea></div>
      <div class="ou-wide ou-note">منشئ الطلب: <span id="ouCreator" class="ou-creator"></span></div>`;
    optionList('ouProjectsList',projects().map(x=>x.name));
    const names=rows.map(r=>S(field(r,'اسم العميل','customer_name'))).filter(Boolean); optionList('ouCustomersList',names);
    $('ouCreator').textContent=userName(user());setupSmartInputs();['ouInclusive','ouCost'].forEach(id=>$(id)?.addEventListener('input',recalcFinance));recalcFinance();
    const search=$('orderSearchV233'); if(search)search.placeholder='بحث برقم الأوردر، النوع، المشروع، العميل، الجوال أو التفاصيل';
    const btn=host.parentElement?.querySelector('.actions button'); if(btn){btn.onclick=save;btn.textContent='حفظ الأوردر';}
    const newBtn=host.parentElement?.querySelectorAll('.actions button')[1]; if(newBtn)newBtn.onclick=clear;
    const delBtn=host.parentElement?.querySelectorAll('.actions button')[2]; if(delBtn)delBtn.onclick=deleteCurrent;
    return true;
  }
  function rebuildSupervisor(){
    const form=$('supOrderEditNoV10061')?.parentElement; if(!form)return false;
    const help=form.querySelector('.sup-help'); if(help)help.textContent='أنشئ الطلب بعد إكمال البيانات المطلوبة. اسم منشئ الطلب يسجل تلقائياً من حسابك.';
    const keepTitle=$('supOrderFormTitleV10061');
    form.innerHTML=`<h2 id="supOrderFormTitleV10061">رفع / تعديل أوردر</h2><div class="sup-help">منشئ الطلب يسجل تلقائياً ولا يمكن تغييره.</div><input type="hidden" id="supOrderEditNoV10061"><div class="ou-grid">
      <div class="ou-required"><label>نوع الطلب</label><select id="ouType"><option value="">اختر النوع</option><option value="internal">عميل داخلي</option><option value="association">جمعية</option><option value="external">أوردر خارجي</option></select></div>
      <div class="ou-required"><label>المشروع / الموقع</label><input id="ouProject" list="ouProjectsList" placeholder="اكتب للبحث"></div>
      <div class="ou-required"><label>اسم العميل / المسؤول</label><input id="ouCustomer" list="ouCustomersList"></div>
      <div class="ou-required"><label>رقم العميل</label><input id="ouPhone" inputmode="tel"></div>
      <div class="ou-required"><label>رقم الشقة / الوحدة / الموقع</label><input id="ouUnit"></div>
      <div><label>المنفذ (مشرف أو فني)</label><input id="ouExecutor" placeholder="اكتب اسم المشرف أو الفني للبحث"></div>
      <div><label>حالة التنفيذ</label><select id="ouStatus"><option>لم ينفذ</option><option>تحت التنفيذ</option><option>تم التنفيذ</option><option>ملغي</option></select></div>
      <div><label>حالة السداد</label><select id="ouPayment"><option value="">غير محدد</option><option>آجل</option><option>تم السداد</option><option>جزئي</option></select></div>
      <div><label>حالة الفوترة</label><select id="ouBilling"><option value="لم تتم">لم تتم</option><option value="تمت">تمت</option></select></div>
      <div><label>رقم الفاتورة</label><input id="ouInvoiceNo" placeholder="يظهر عند اختيار تمت"></div>
      <div><label>تاريخ الفوترة</label><input id="ouInvoiceDate" type="date"></div>
      <div><label>الإجمالي شامل الضريبة</label><input id="ouInclusive" type="number" min="0" step="0.01"></div>
      <div><label>القيمة قبل الضريبة</label><input id="ouBefore" type="number" readonly></div>
      <div><label>الضريبة 15%</label><input id="ouVat" type="number" readonly></div>
      <div><label>التكلفة</label><input id="ouCost" type="number" min="0" step="0.01"></div>
      <div><label>صافي الربح</label><input id="ouProfit" type="number" readonly></div>
      <div class="ou-wide ou-required"><label>تفاصيل الطلب</label><textarea id="ouDetails"></textarea></div>
      <div class="ou-wide"><label>ملاحظات</label><textarea id="ouNotes"></textarea></div>
      <div class="ou-wide ou-note">منشئ الطلب: <span id="ouCreator" class="ou-creator"></span></div></div><div class="actions"><button id="ouSaveBtn">حفظ الأوردر</button><button class="light" id="ouNewBtn">أوردر جديد</button></div>`;
    optionList('ouProjectsList',projects().map(x=>x.name));optionList('ouCustomersList',rows.map(r=>S(field(r,'اسم العميل','customer_name'))));
    $('ouCreator').textContent=userName(user());setupSmartInputs();['ouInclusive','ouCost'].forEach(id=>$(id)?.addEventListener('input',recalcFinance));recalcFinance();$('ouSaveBtn').onclick=save;$('ouNewBtn').onclick=clear;return true;
  }

  function values(){
    return {type:S($('ouType')?.value),project:S($('ouProject')?.value),customer:S($('ouCustomer')?.value),phone:S($('ouPhone')?.value),unit:S($('ouUnit')?.value),executor:S($('ouExecutor')?.value),status:S($('ouStatus')?.value)||'لم ينفذ',payment:S($('ouPayment')?.value),billing:S($('ouBilling')?.value)||'لم تتم',invoiceNo:S($('ouInvoiceNo')?.value),invoiceDate:S($('ouInvoiceDate')?.value),price:num($('ouInclusive')?.value??$('ouPrice')?.value),cost:num($('ouCost')?.value),details:S($('ouDetails')?.value),notes:S($('ouNotes')?.value)};
  }
  function validate(v){
    const required=[['ouType',v.type,'نوع الطلب'],['ouProject',v.project,'المشروع أو الموقع'],['ouCustomer',v.customer,'اسم العميل'],['ouPhone',v.phone,'رقم العميل'],['ouUnit',v.unit,'رقم الشقة أو الوحدة'],['ouDetails',v.details,'تفاصيل الطلب']];
    document.querySelectorAll('.ou-invalid').forEach(x=>x.classList.remove('ou-invalid'));
    const missing=required.filter(x=>!x[1]); missing.forEach(x=>$(x[0])?.classList.add('ou-invalid'));
    if(missing.length){notify('لا يمكن حفظ الطلب. أكمل: '+missing.map(x=>x[2]).join('، '),'err');$(missing[0][0])?.focus();return false;}
    if(!/^\+?[0-9\s-]{7,15}$/.test(v.phone)){ $('ouPhone')?.classList.add('ou-invalid'); notify('رقم العميل غير صحيح','err'); return false; }
    if(v.billing==='تمت'&&!v.invoiceNo){$('ouInvoiceNo')?.classList.add('ou-invalid');notify('اكتب رقم الفاتورة عند اختيار تمت','err');return false;}
    if(v.billing==='تمت'&&!v.invoiceDate){$('ouInvoiceDate')?.classList.add('ou-invalid');notify('حدد تاريخ الفوترة عند اختيار تمت','err');return false;}
    if(v.price<0||v.cost<0){notify('القيم المالية لا يمكن أن تكون سالبة','err');return false;}
    return true;
  }
  function toData(v,old={}){
    const u=user(), created=old.created_at||old['تاريخ الإنشاء']||now(), creator=old.created_by_name||old['منشئ الطلب']||userName(u);
    const before=v.price/1.15, vat=v.price-before, profit=before-v.cost;
    return {...old,
      order_type:v.type, 'نوع الطلب':v.type==='internal'?'عميل داخلي':v.type==='association'?'جمعية':'أوردر خارجي',
      project_name:v.project,'المشروع':v.project,customer_name:v.customer,'اسم العميل':v.customer,customer_phone:v.phone,'رقم العميل':v.phone,
      unit_number:v.unit,'رقم الشقة':v.unit,executor_name:v.executor,'المنفذ':v.executor,description:v.details,'التفاصيل':v.details,'ملاحظات':v.notes,
      status:v.status,'حالة التنفيذ':v.status,payment_status:v.payment,'حالة السداد':v.payment,billing_status:v.billing,'حالة الفوترة':v.billing,invoice_number:v.billing==='تمت'?v.invoiceNo:'','رقم الفاتورة':v.billing==='تمت'?v.invoiceNo:'',invoice_date:v.billing==='تمت'?v.invoiceDate:'','تاريخ الفوترة':v.billing==='تمت'?v.invoiceDate:'',
      'السعر (شامل الضريبة)':v.price,inclusive_total:v.price,total_with_vat:v.price,'الضريبة 15%':vat,vat_amount:vat,'السعر قبل الضريبة':before,before_vat:before,'التكلفة':v.cost,cost:v.cost,'الربح':profit,net_profit:profit,
      created_by_id:S(old.created_by_id||u.id||u.user_id||u.email),created_by_name:creator,created_by_role:S(old.created_by_role||userRole(u)),created_at:created,'منشئ الطلب':creator,
      updated_by_id:S(u.id||u.user_id||u.email),updated_by_name:userName(u),updated_by_role:userRole(u),updated_at:now(),'آخر تعديل بواسطة':userName(u)
    };
  }
  function diff(oldD,newD){
    const labels={order_type:'نوع الطلب',project_name:'المشروع',customer_name:'اسم العميل',customer_phone:'رقم العميل',unit_number:'رقم الشقة/الوحدة',executor_name:'المنفذ',description:'تفاصيل الطلب','ملاحظات':'الملاحظات',status:'حالة التنفيذ',payment_status:'حالة السداد',billing_status:'حالة الفوترة',invoice_number:'رقم الفاتورة',invoice_date:'تاريخ الفوترة','السعر (شامل الضريبة)':'الإجمالي شامل الضريبة','الضريبة 15%':'الضريبة','السعر قبل الضريبة':'قبل الضريبة','التكلفة':'التكلفة','الربح':'صافي الربح'};
    return Object.keys(labels).filter(k=>S(oldD[k])!==S(newD[k])).map(k=>({field_name:k,field_label:labels[k],old_value:S(oldD[k]),new_value:S(newD[k])}));
  }
  async function audit(no,action,changes=[]){
    const u=user(); const items=changes.length?changes:[{field_name:'order',field_label:action==='create'?'إنشاء الطلب':'العملية',old_value:'',new_value:action}];
    const payload=items.map(c=>({order_no:no,action_type:action,...c,changed_by_id:S(u.id||u.user_id||u.email),changed_by_name:userName(u),changed_by_role:userRole(u),changed_at:now()}));
    try{await api('/rest/v1/'+AUDIT,{method:'POST',body:JSON.stringify(payload)});}catch(e){console.warn('تعذر حفظ سجل التدقيق',e);}
  }
  async function load(){
    try{rows=await api('/rest/v1/'+TABLE+'?select=order_no,data,flow,updated_at&order=updated_at.desc&limit=5000')||[]; render(); optionList('ouCustomersList',rows.map(r=>S(field(r,'اسم العميل','customer_name'))));}
    catch(e){notify('تعذر تحميل الأوردرات: '+e.message,'err');}
  }
  async function save(ev){
    ev?.preventDefault?.(); if(saving)return; const v=values(); if(!validate(v))return; saving=true;
    try{
      const current=editNo?rows.find(r=>orderNo(r)===editNo):null; const no=editNo||makeNo(); const oldD=current?dataOf(current):{}; const d=toData(v,oldD);
      d['رقم الطلب']=no; d.order_no=no; if(!oldD['تاريخ الطلب'])d['تاريخ الطلب']=today(); if(!oldD['وقت الطلب'])d['وقت الطلب']=timeNow(); d['مرسل الطلب']=d.created_by_name;
      await api('/rest/v1/'+TABLE+'?on_conflict=order_no',{method:'POST',body:JSON.stringify([{order_no:no,data:d,flow:current?.flow||{},updated_at:now()}])});
      await audit(no,current?'update':'create',current?diff(oldD,d):[]); notify(current?'تم تعديل الأوردر وتسجيل التغييرات':'تم إنشاء الأوردر وتسجيل المنشئ تلقائياً','ok'); clear(); await load();
    }catch(e){notify('فشل حفظ الأوردر: '+e.message,'err');}finally{saving=false;}
  }
  function clear(){editNo='';['ouType','ouProject','ouCustomer','ouPhone','ouUnit','ouExecutor','ouPayment','ouBilling','ouInvoiceNo','ouInvoiceDate','ouInclusive','ouBefore','ouVat','ouCost','ouProfit','ouDetails','ouNotes'].forEach(id=>{if($(id))$(id).value='';});if($('ouStatus'))$('ouStatus').value='لم ينفذ';if($('ouBilling'))$('ouBilling').value='لم تتم';if($('orderNoV233'))$('orderNoV233').value='';if($('orderFormTitleV233'))$('orderFormTitleV233').textContent='إضافة أوردر';if($('supOrderFormTitleV10061'))$('supOrderFormTitleV10061').textContent='رفع أوردر';document.querySelectorAll('.ou-invalid').forEach(x=>x.classList.remove('ou-invalid'));recalcFinance();}
  function edit(idx){const r=rows[idx];if(!r)return;const d=dataOf(r);editNo=orderNo(r);const set=(id,v)=>{if($(id))$(id).value=S(v)};set('ouType',d.order_type||(/جمعية/.test(S(d['نوع الطلب']||d['تخص']))?'association':/خارجي/.test(S(d['نوع الطلب']))?'external':'internal'));set('ouProject',projectName(r));set('ouCustomer',field(r,'customer_name','اسم العميل'));set('ouPhone',field(r,'customer_phone','رقم العميل'));set('ouUnit',field(r,'unit_number','رقم الشقة'));set('ouExecutor',field(r,'executor_name','المنفذ'));set('ouStatus',field(r,'status','حالة التنفيذ'));set('ouPayment',field(r,'payment_status','حالة السداد'));set('ouBilling',field(r,'billing_status','حالة الفوترة')||'لم تتم');set('ouInvoiceNo',field(r,'invoice_number','رقم الفاتورة'));set('ouInvoiceDate',field(r,'invoice_date','تاريخ الفوترة'));$('ouBilling')?.dispatchEvent(new Event('change',{bubbles:true}));set('ouInvoiceNo',field(r,'invoice_number','رقم الفاتورة'));set('ouInvoiceDate',field(r,'invoice_date','تاريخ الفوترة'));set('ouInclusive',field(r,'السعر (شامل الضريبة)','inclusive_total','total_with_vat'));set('ouBefore',field(r,'السعر قبل الضريبة','before_vat'));set('ouVat',field(r,'الضريبة 15%','vat_amount'));set('ouCost',field(r,'التكلفة','cost'));set('ouProfit',field(r,'الربح','net_profit'));recalcFinance();set('ouDetails',field(r,'description','التفاصيل'));set('ouNotes',field(r,'ملاحظات'));if($('orderNoV233'))$('orderNoV233').value=editNo;if($('orderFormTitleV233'))$('orderFormTitleV233').textContent='تعديل أوردر '+editNo;if($('supOrderFormTitleV10061'))$('supOrderFormTitleV10061').textContent='تعديل أوردر '+editNo;window.scrollTo({top:0,behavior:'smooth'});}
  async function del(idx){const r=rows[idx];if(!r||!confirm('حذف الأوردر '+orderNo(r)+'؟'))return;try{await api('/rest/v1/'+TABLE+'?order_no=eq.'+encodeURIComponent(orderNo(r)),{method:'DELETE'});await audit(orderNo(r),'delete');notify('تم حذف الأوردر','ok');clear();await load();}catch(e){notify('تعذر الحذف: '+e.message,'err');}}
  function deleteCurrent(){const idx=rows.findIndex(r=>orderNo(r)===editNo);if(idx>=0)del(idx);else notify('اختر أوردر للتعديل أولاً','err');}
  function filterRows(){
    const isSup=!!$('supOrderSearchV10061')&&!$('orderSearchV233');
    const q=S($(isSup?'supOrderSearchV10061':'orderSearchV233')?.value).toLowerCase();
    const pf=S($(isSup?'supOrderFilterProjectV10061':'orderProjectFilterV233')?.value);
    const sf=S($(isSup?'supOrderFilterStatusV10061':'orderStatusFilterV233')?.value);
    const tf=S($(isSup?'ouSupTypeFilter':'ouAdminTypeFilter')?.value);
    const ef=S($(isSup?'ouSupExecutorFilter':'orderExecutorFilterV233')?.value);
    const payf=S($(isSup?'ouSupPaymentFilter':'orderPaymentFilterV233')?.value);
    const billf=S($(isSup?'ouSupBillingFilter':'orderBillingFilterV233')?.value);
    const senderf=S($('orderSenderFilterV233')?.value);
    const from=S($('orderFromDateV233')?.value),to=S($('orderToDateV233')?.value);
    return rows.filter(r=>{
      const d=dataOf(r),proj=projectName(r),status=S(field(r,'حالة التنفيذ','status')),exec=S(field(r,'المنفذ','executor_name')),payment=S(field(r,'حالة السداد','payment_status')),billing=S(field(r,'حالة الفوترة','billing_status')||'لم تتم'),sender=S(d.created_by_name||d['منشئ الطلب']||d['مرسل الطلب']),dt=orderDate(r);
      const text=[orderNo(r),proj,...Object.values(d)].join(' ').toLowerCase();
      const rawType=S(d.order_type||(/جمعية/.test(S(d['نوع الطلب']))?'association':/خارجي/.test(S(d['نوع الطلب']))?'external':'internal'));
      return (!q||text.includes(q))&&(!pf||proj===pf)&&(!sf||status===sf)&&(!tf||rawType===tf)&&(!ef||exec===ef)&&(!payf||payment===payf)&&(!billf||billing===billf)&&(!senderf||sender===senderf)&&(!from||dt>=from)&&(!to||dt<=to);
    });
  }
  function card(r,idx){
    const d=dataOf(r),type=S(d['نوع الطلب']||d.order_type||'-'),creator=S(d.created_by_name||d['منشئ الطلب']||d['مرسل الطلب']||'-');
    const inclusive=num(field(r,'السعر (شامل الضريبة)','inclusive_total','total_with_vat')),before=num(field(r,'السعر قبل الضريبة','before_vat'))||(inclusive/1.15),vat=num(field(r,'الضريبة 15%','vat_amount'))||(inclusive-before),cost=num(field(r,'التكلفة','cost')),profit=num(field(r,'الربح','net_profit'))||(before-cost);
    const receipt=receiptFromRow(r),state=cardState(r);
    return `<article class="ou-card ${state}"><div class="ou-head"><div><h3>${E(orderNo(r))}</h3><small>${E(field(r,'تاريخ الطلب','created_at')||'-')}</small></div><span class="ou-chip">${E(type)}</span></div><div class="ou-chips"><span class="ou-chip">${E(field(r,'حالة التنفيذ','status')||'-')}</span><span class="ou-chip">${E(field(r,'حالة السداد','payment_status')||'غير محدد')}</span><span class="ou-chip">المنفذ: ${E(field(r,'المنفذ','executor_name')||'غير محدد')}</span><span class="ou-chip">الفوترة: ${E(field(r,'حالة الفوترة','billing_status')||'لم تتم')}</span></div><div class="ou-meta"><div><small>المشروع</small><b>${E(projectName(r)||'-')}</b></div><div><small>العميل</small><b>${E(field(r,'اسم العميل','customer_name')||'-')}</b></div><div><small>الجوال</small><b>${E(field(r,'رقم العميل','customer_phone')||'-')}</b></div><div><small>الوحدة</small><b>${E(field(r,'رقم الشقة','unit_number')||'-')}</b></div><div><small>المنشئ</small><b>${E(creator)}</b></div><div><small>آخر تعديل</small><b>${E(d.updated_by_name||'-')}</b></div><div><small>رقم الفاتورة</small><b>${E(field(r,'رقم الفاتورة','invoice_number')||'-')}</b></div><div><small>تاريخ الفوترة</small><b>${E(field(r,'تاريخ الفوترة','invoice_date')||'-')}</b></div></div><div class="ou-money-grid"><div class="ou-money"><small>قبل الضريبة</small><b>${E(money(before))}</b></div><div class="ou-money"><small>الضريبة 15%</small><b>${E(money(vat))}</b></div><div class="ou-money"><small>شامل الضريبة</small><b>${E(money(inclusive))}</b></div><div class="ou-money"><small>التكلفة</small><b>${E(money(cost))}</b></div><div class="ou-money"><small>صافي الربح</small><b>${E(money(profit))}</b></div></div><p>${E(field(r,'التفاصيل','description')||'')}</p><div class="ou-actions"><button onclick="tasneefOrders10400.edit(${idx})">تعديل</button><button class="light ${receipt?'':'ou-receipt-disabled'}" ${receipt?'':'disabled'} onclick="tasneefOrders10400.openReceipt(${idx})">عرض الإيصال</button><button class="light" onclick="tasneefOrders10400.history('${E(orderNo(r))}')">سجل التعديلات</button><button class="danger" onclick="tasneefOrders10400.del(${idx})">حذف</button></div></article>`;
  }
  function render(){
    const list=filterRows(),pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE));page=Math.min(page,pages);const slice=list.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
    renderSummary(list);
    const admin=$('ordersCardsV360'); if(admin){admin.innerHTML=slice.map(r=>card(r,rows.indexOf(r))).join('')||'<div class="ou-note">لا توجد أوردرات</div>';const p=$('ordersPagerV360');if(p)p.innerHTML=`<button class="light" ${page<=1?'disabled':''} onclick="tasneefOrders10400.page(-1)">السابق</button><b>صفحة ${page} من ${pages} — ${list.length} نتيجة</b><button class="light" ${page>=pages?'disabled':''} onclick="tasneefOrders10400.page(1)">التالي</button>`;}
    const sup=$('supOrdersBodyV10061'); if(sup)sup.innerHTML=slice.map(r=>card(r,rows.indexOf(r))).join('')||'<div class="ou-note">لا توجد أوردرات</div>';
    if($('ordersTotalKpiV233'))$('ordersTotalKpiV233').textContent=list.length;if($('ordersDoneKpiV233'))$('ordersDoneKpiV233').textContent=list.filter(r=>/تم التنفيذ/.test(S(field(r,'حالة التنفيذ','status')))).length;if($('ordersDueKpiV233'))$('ordersDueKpiV233').textContent=list.filter(r=>/آجل|جزئي/.test(S(field(r,'حالة السداد','payment_status')))).length;if($('ordersProfitKpiV233'))$('ordersProfitKpiV233').textContent=money(list.reduce((a,r)=>a+num(field(r,'الربح')),0)).replace(' ر.س','');
    hydrateFilters();
  }
  function hydrateFilters(){
    const fill=(id,vals,first)=>{const el=$(id);if(!el)return;const cur=el.value;el.innerHTML=`<option value="">${first}</option>`+[...new Set(vals.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar')).map(x=>`<option value="${E(x)}">${E(x)}</option>`).join('');if([...el.options].some(o=>o.value===cur))el.value=cur;};
    const projs=rows.map(projectName),stats=rows.map(r=>S(field(r,'حالة التنفيذ','status'))),execs=rows.map(r=>S(field(r,'المنفذ','executor_name'))),pays=rows.map(r=>S(field(r,'حالة السداد','payment_status'))),bills=rows.map(r=>S(field(r,'حالة الفوترة','billing_status')||'لم تتم')),senders=rows.map(r=>S(dataOf(r).created_by_name||dataOf(r)['منشئ الطلب']||dataOf(r)['مرسل الطلب']));
    fill('orderProjectFilterV233',projs,'كل المشاريع');fill('orderStatusFilterV233',stats,'كل الحالات');fill('supOrderFilterProjectV10061',projs,'كل المشاريع');fill('supOrderFilterStatusV10061',stats,'كل الحالات');
    fill('orderExecutorFilterV233',execs,'كل المنفذين');fill('ouSupExecutorFilter',execs,'كل المنفذين');fill('orderPaymentFilterV233',pays,'كل حالات السداد');fill('ouSupPaymentFilter',pays,'كل حالات السداد');fill('orderBillingFilterV233',bills,'كل حالات الفوترة');fill('ouSupBillingFilter',bills,'كل حالات الفوترة');fill('orderSenderFilterV233',senders,'كل مرسلي الطلب');
  }
  async function history(no){try{const h=await api('/rest/v1/'+AUDIT+'?order_no=eq.'+encodeURIComponent(no)+'&select=*&order=changed_at.desc');document.body.insertAdjacentHTML('beforeend',`<div class="ou-modal" onclick="if(event.target===this)this.remove()"><div><div class="ou-head"><h2>سجل تعديلات ${E(no)}</h2><button class="light" onclick="this.closest('.ou-modal').remove()">إغلاق</button></div><div class="ou-history">${(h||[]).map(x=>`<article><b>${E(x.changed_by_name||'-')}</b> — ${E(x.field_label||x.action_type||'-')}<br><small>${E(new Date(x.changed_at).toLocaleString('ar-SA',{hour12:true}))}</small><div>${E(x.old_value||'-')} ⟵ ${E(x.new_value||'-')}</div></article>`).join('')||'<div class="ou-note">لا توجد تعديلات مسجلة</div>'}</div></div></div>`);}catch(e){notify('شغّل ملف SQL الخاص بسجل التعديلات أولاً','err');}}
  function bind(){
    ['orderSearchV233','orderProjectFilterV233','orderExecutorFilterV233','orderSenderFilterV233','orderStatusFilterV233','orderPaymentFilterV233','orderBillingFilterV233','orderFromDateV233','orderToDateV233','supOrderSearchV10061','supOrderFilterProjectV10061','supOrderFilterStatusV10061','ouAdminTypeFilter','ouSupTypeFilter','ouSupExecutorFilter','ouSupPaymentFilter','ouSupBillingFilter'].forEach(id=>{const el=$(id);if(el&&!el.dataset.ouBound){el.dataset.ouBound='1';el.addEventListener('input',()=>{page=1;render()});el.addEventListener('change',()=>{page=1;render()});}});
  }
  window.resetOrdersFiltersV233=function(){['orderSearchV233','orderProjectFilterV233','orderExecutorFilterV233','orderSenderFilterV233','orderStatusFilterV233','orderPaymentFilterV233','orderBillingFilterV233','orderFromDateV233','orderToDateV233','ouAdminTypeFilter'].forEach(id=>{if($(id))$(id).value='';});page=1;render();};
  function boot(){stopLegacy();injectStyle();const ok=rebuildAdmin()||rebuildSupervisor();if(!ok){setTimeout(boot,300);return;}ensureExtraFilters();setupSmartInputs();['ouInclusive','ouCost'].forEach(id=>{const el=$(id);if(el&&!el.dataset.ouCalc){el.dataset.ouCalc='1';el.addEventListener('input',recalcFinance);}});bind();const bill=$('ouBilling');if(bill&&!bill.dataset.ouBilling){bill.dataset.ouBilling='1';const sync=()=>{const done=bill.value==='تمت';if($('ouInvoiceNo'))$('ouInvoiceNo').disabled=!done;if($('ouInvoiceDate'))$('ouInvoiceDate').disabled=!done;if(!done){if($('ouInvoiceNo'))$('ouInvoiceNo').value='';if($('ouInvoiceDate'))$('ouInvoiceDate').value='';}};bill.addEventListener('change',sync);sync();}clear();load();setInterval(stopLegacy,2000);}
  window.tasneefOrders10400={load,save,edit,del,history,openReceipt,page:d=>{page=Math.max(1,page+Number(d||0));render()},clear,render};
  window.saveOrderV233=save;window.clearOrderFormV233=clear;window.deleteCurrentOrderV233=deleteCurrent;window.editOrderV233=edit;window.deleteOrderV233=del;window.renderOrdersV233=render;
  window.supOrdersSaveV10061=save;window.supOrdersClearV10061=clear;window.supOrdersRenderV10061=render;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

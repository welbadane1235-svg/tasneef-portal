/* Tasneef v10156 - Finance movement filters + product name sync + printed vouchers
   Scope: المالية والمخزون فقط.
   - تبويب حركة المخزون: فلتر المشرفين + فلتر التاريخ.
   - اسم المنتج في الحركات يُقرأ من جدول المنتجات الرسمي، لذلك إذا تغير اسم المنتج يظهر الاسم الجديد في الحركات القديمة بدون إنشاء حركة جديدة.
*/
(function(){
  'use strict';
  if(window.__tasneefFinanceMovementFiltersSyncV10156) return;
  window.__tasneefFinanceMovementFiltersSyncV10156 = true;

  const VERSION='v10156-finance-movement-print-voucher';
  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const N=v=>Number(v||0)||0;
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=v=>`${N(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س`;
  const client=()=>window.sb||window.supabaseClient||window.supabase||null;
  const state=()=>window.financeProStateV15||{};
  const VAT=0.15;
  const filters={supervisor:'', dateFrom:'', dateTo:'', type:''};
  let syncing=false;
  let didAutoSync=false;

  function safeJson(v){
    const t=S(v);
    if(!t.startsWith('finance_pro_v15:')) return {};
    try{return JSON.parse(t.replace('finance_pro_v15:',''))||{};}catch(_){return{};}
  }
  function itemCode(i){return S(i&&(i.product_code||i.serial_number||i.barcode||i.supplier_barcode||i.code));}
  function itemCost(i){return N(i&&(i.unit_cost||i.cost||i.price||i.purchase_price));}
  function movementDate(m){return S(m&&(m.movement_date||m.date||m.created_at)).slice(0,10);}
  function movementTypeLabel(t){return ({in:'داخل',out:'صرف',consume:'استهلاك',waste:'هدر',damaged:'تالف',scrap:'سكراب',return:'مرتجع'})[S(t)]||S(t)||'-';}
  function movementOutTypes(){return ['out','consume','waste','damaged','scrap'];}
  function productKeys(obj){
    const keys=[];
    [obj&&obj.id,obj&&obj.item_id,obj&&obj.product_code,obj&&obj.serial_number,obj&&obj.barcode,obj&&obj.supplier_barcode,obj&&obj.code,obj&&obj.name,obj&&obj.item_name].forEach(v=>{
      const x=S(v).toLowerCase();
      if(x&&!keys.includes(x)) keys.push(x);
    });
    return keys;
  }
  function officialItemForMovement(m){
    const st=state();
    const keys=productKeys(m);
    return A(st.items).find(i=>productKeys(i).some(k=>keys.includes(k)))||null;
  }
  function officialProductName(m){
    const it=officialItemForMovement(m);
    return S(it&&(it.name||it.item_name)) || S(m&&m.item_name) || S(m&&m.product_name) || S(m&&m.product_code) || '-';
  }
  function projectName(id){
    const st=state();
    const p=A(st.projects).find(x=>String(x.id)===String(id));
    return S(p&&(p.name||p.project_name))||'';
  }
  function staffName(id){
    const st=state();
    const u=A(st.users).find(x=>String(x.id)===String(id));
    return S(u&&(u.full_name||u.name||u.username))||S(id);
  }
  function movementUnitCost(m){
    const meta=safeJson(m&&m.notes)||{};
    if(N(m&&m.unit_cost)>0) return N(m.unit_cost);
    if(N(meta.beforeVat)>0&&N(m&&m.quantity)>0) return N(meta.beforeVat)/N(m.quantity);
    const it=officialItemForMovement(m);
    return it?itemCost(it):0;
  }
  function movementNet(m){
    const meta=safeJson(m&&m.notes)||{};
    if(N(meta.beforeVat)>0) return N(meta.beforeVat);
    return N(m&&m.quantity)*movementUnitCost(m);
  }
  function movementDistributionRows(m){
    const meta=safeJson(m&&m.notes)||{};
    const rows=A(meta.distribution);
    if(!rows.length) return [{...m,parent_id:m.id,distribution_index:null,base_movement_type:S(m.movement_type),distribution_note:'',order_no:S(m&&m.order_no||''),project_name:S(m&&m.project_name||'')}];
    return rows.map((d,idx)=>({
      ...m,
      parent_id:m.id,
      distribution_index:idx,
      is_distribution_row:true,
      base_movement_type:S(m.movement_type),
      movement_type:S(d.type||m.movement_type)||S(m.movement_type),
      quantity:N(d.qty),
      center:S(d.center||m.cost_center),
      project_id:d.projectId||m.project_id||null,
      project_name:S(d.projectName||projectName(d.projectId)||m.project_name||''),
      order_no:S(d.orderNo||m.order_no||''),
      distribution_note:S(d.note||'')
    })).filter(r=>N(r.quantity)>0);
  }
  function movementStaffId(m){return S(safeJson(m&&m.notes).staffId || m.staff_id || m.supervisor_id || m.user_id || m.created_by || '');}
  function movementStaffName(m){
    const id=movementStaffId(m);
    return S(m&&m.receiver) || (id?staffName(id):'') || '-';
  }
  function supervisorOptions(){
    const st=state();
    const map=new Map();
    A(st.users).forEach(u=>{
      const name=S(u.full_name||u.name||u.username);
      if(!name) return;
      const role=S(u.role||u.user_role||u.type).toLowerCase();
      if(/supervisor|مشرف|admin|manager|مدير/.test(role) || A(st.movements).some(m=>S(m.receiver)===name || movementStaffId(m)===S(u.id))){
        map.set(S(u.id)||name, name);
      }
    });
    A(st.movements).forEach(m=>{ const n=S(m.receiver); if(n&&!map.has(n)) map.set(n,n); });
    return [...map.entries()].sort((a,b)=>a[1].localeCompare(b[1],'ar'));
  }
  function movementMatchesSupervisor(m, value){
    if(!value) return true;
    const st=state();
    const mvId=movementStaffId(m);
    const rec=S(m.receiver);
    const u=A(st.users).find(x=>String(x.id)===String(value));
    const names=[value, u&&u.full_name, u&&u.name, u&&u.username].map(S).filter(Boolean);
    if(mvId && String(mvId)===String(value)) return true;
    return names.some(n=>rec===n || rec.includes(n) || n.includes(rec));
  }
  function passesFilters(row){
    const d=movementDate(row);
    if(filters.dateFrom && d && d<filters.dateFrom) return false;
    if(filters.dateTo && d && d>filters.dateTo) return false;
    if(filters.supervisor && !movementMatchesSupervisor(row, filters.supervisor)) return false;
    if(filters.type && S(row.movement_type)!==filters.type) return false;
    return true;
  }
  function currentMovementRows(){
    return A(state().movements).flatMap(movementDistributionRows).filter(passesFilters)
      .sort((a,b)=>S(movementDate(b)||b.created_at).localeCompare(S(movementDate(a)||a.created_at)) || N(b.id)-N(a.id));
  }

  function rowKey(r){
    return [r.parent_id||r.id||'', r.distribution_index==null?'main':r.distribution_index, S(r.movement_type), S(r.project_id||''), S(r.order_no||''), N(r.quantity)].join('|');
  }
  function selectedRows(){
    const checked=[...document.querySelectorAll('.fm10156-select-row:checked')].map(x=>S(x.value));
    const all=currentMovementRows();
    if(!checked.length) return [];
    const set=new Set(checked);
    return all.filter(r=>set.has(rowKey(r)));
  }
  function voucherTitle(rows){
    const types=[...new Set(A(rows).map(r=>S(r.movement_type)).filter(Boolean))];
    if(types.length===1){
      return ({out:'سند صرف مخزون',consume:'سند استهلاك مخزون',damaged:'سند تالف مخزون',waste:'سند هدر مخزون',scrap:'سند سكراب مخزون',return:'سند مرتجع مخزون',in:'سند إدخال مخزون'})[types[0]] || 'سند حركة مخزون';
    }
    return 'سند حركة مخزون';
  }
  function printRows(selectedOnly){
    const rows=selectedOnly?selectedRows():currentMovementRows();
    if(!rows.length){ alert(selectedOnly?'اختر حركة واحدة على الأقل للطباعة':'لا توجد حركات حسب الفلاتر للطباعة'); return; }
    const title=voucherTitle(rows);
    const now=new Date().toLocaleString('ar-SA');
    const totalQty=rows.reduce((a,r)=>a+N(r.quantity),0);
    const totalNet=rows.reduce((a,r)=>a+movementNet(r),0);
    const types=[...new Set(rows.map(r=>movementTypeLabel(r.movement_type)))].join(' / ');
    const supervisor=filters.supervisor ? (supervisorOptions().find(([v])=>v===filters.supervisor)||[])[1] || filters.supervisor : 'حسب الفلتر / الكل';
    const dateRange=(filters.dateFrom||filters.dateTo)?`${filters.dateFrom||'البداية'} إلى ${filters.dateTo||'النهاية'}`:'كل التواريخ';
    const bodyRows=rows.map((r,idx)=>{
      const item=officialItemForMovement(r)||{};
      const project=S(r.project_name)||projectName(r.project_id)||'-';
      return `<tr><td>${idx+1}</td><td>${esc(movementDate(r)||'-')}</td><td>${esc(officialProductName(r))}</td><td>${esc(itemCode(item)||r.product_code||r.barcode||'-')}</td><td>${esc(movementTypeLabel(r.movement_type))}</td><td>${N(r.quantity)}</td><td>${esc(movementStaffName(r))}</td><td>${esc(project)}</td><td>${esc(r.order_no||'-')}</td><td>${money(movementNet(r))}</td></tr>`;
    }).join('');
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;margin:0;color:#073d31;background:#fff;font-size:12px}.wrap{padding:10px}.head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #073d31;padding-bottom:10px;margin-bottom:12px}.brand{font-size:18px;font-weight:900}.title{text-align:center;font-size:22px;font-weight:900;color:#073d31}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.box{border:1px solid #cfe3db;border-radius:10px;padding:8px;background:#f8fbfa}.box small{display:block;color:#64756f;margin-bottom:4px}.box b{font-size:14px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #d9e7e2;padding:7px;text-align:right;vertical-align:top}th{background:#073d31;color:#fff;font-weight:900}tfoot td{font-weight:900;background:#eef7f3}.signs{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:22px}.sign{border-top:1px solid #073d31;padding-top:8px;text-align:center;min-height:50px}.note{margin-top:10px;color:#64756f;font-size:11px}@media print{.no-print{display:none!important}}
    </style></head><body><div class="wrap"><div class="head"><div class="brand">شركة تصنيف لإدارة المرافق</div><div class="title">${esc(title)}</div><div>تاريخ الطباعة<br><b>${esc(now)}</b></div></div><div class="meta"><div class="box"><small>عدد الحركات</small><b>${rows.length}</b></div><div class="box"><small>نوع السند</small><b>${esc(types)}</b></div><div class="box"><small>المشرف / المستلم</small><b>${esc(supervisor)}</b></div><div class="box"><small>الفترة</small><b>${esc(dateRange)}</b></div><div class="box"><small>إجمالي الكمية</small><b>${N(totalQty)}</b></div><div class="box"><small>إجمالي قبل الضريبة</small><b>${money(totalNet)}</b></div><div class="box"><small>الضريبة التقديرية</small><b>${money(totalNet*VAT)}</b></div><div class="box"><small>الإجمالي التقديري</small><b>${money(totalNet*(1+VAT))}</b></div></div><table><thead><tr><th>#</th><th>التاريخ</th><th>المنتج</th><th>الكود</th><th>نوع الحركة</th><th>الكمية</th><th>المستلم</th><th>المشروع</th><th>الأوردر</th><th>القيمة</th></tr></thead><tbody>${bodyRows}</tbody><tfoot><tr><td colspan="5">الإجمالي</td><td>${N(totalQty)}</td><td colspan="3"></td><td>${money(totalNet)}</td></tr></tfoot></table><div class="signs"><div class="sign">المستلم</div><div class="sign">مسؤول المخزن</div><div class="sign">اعتماد الإدارة</div></div><div class="note">تمت الطباعة حسب الفلاتر المحددة في حركة المخزون. هذا السند لا ينشئ حركة جديدة ولا يغير البيانات.</div></div><script>window.onload=function(){setTimeout(function(){window.print()},250)}</script></body></html>`;
    const w=window.open('','_blank');
    if(!w){ alert('المتصفح منع فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }
  window.financeProPrintSelectedMovementsV10156=function(){printRows(true);};
  window.financeProPrintFilteredMovementsV10156=function(){printRows(false);};
  function syncMovementNamesInMemory(){
    const st=state();
    A(st.movements).forEach(m=>{
      const name=officialProductName(m);
      if(name && name!=='-' && S(m.item_name)!==name){ m.item_name=name; }
    });
  }
  async function syncMovementNamesToDb(force){
    if(syncing) return;
    const st=state();
    if(!force && didAutoSync) return;
    const c=client();
    if(!c||!c.from||!A(st.movements).length||!A(st.items).length) return;
    const mismatches=new Map();
    A(st.movements).forEach(m=>{
      const it=officialItemForMovement(m);
      const name=S(it&&(it.name||it.item_name));
      if(!it||!name||S(m.item_name)===name) return;
      const key=S(it.id||itemCode(it)||name);
      if(key) mismatches.set(key,{item:it,name});
    });
    if(!mismatches.size) { didAutoSync=true; return; }
    syncing=true;
    try{
      let count=0;
      for(const {item,name} of mismatches.values()){
        if(count>=60) break;
        if(S(item.id)){
          const r=await c.from('inventory_movements').update({item_name:name}).eq('item_id',item.id);
          if(r.error) console.warn('v10155 sync item_id failed', r.error.message||r.error);
          count++;
        }
        const code=itemCode(item);
        if(code){
          const r2=await c.from('inventory_movements').update({item_name:name}).eq('product_code',code);
          if(r2.error) console.warn('v10155 sync product_code failed', r2.error.message||r2.error);
        }
      }
      didAutoSync=true;
      syncMovementNamesInMemory();
    }catch(e){ console.warn('v10155 sync names failed', e); }
    finally{ syncing=false; }
  }

  function renderEnhancedMovementList(){
    const box=$('finMovementListV10155');
    if(!box) return;
    syncMovementNamesInMemory();
    const rows=currentMovementRows();
    const st=state();
    const totalQty=rows.reduce((a,r)=>a+N(r.quantity),0);
    const totalNet=rows.reduce((a,r)=>a+movementNet(r),0);
    const types=[['','كل الحركات'],['in','داخل'],['out','صرف'],['consume','استهلاك'],['damaged','تالف'],['waste','هدر'],['scrap','سكراب'],['return','مرتجع']];
    const supOpts=supervisorOptions();
    const filterHtml=`<div class="fin-card fm10155-filter-card"><h3>حركة المخزون</h3><div class="fin-actions fm10155-filters">
      <div><label>المشرفين</label><select id="fm10155Supervisor"><option value="">كل المشرفين</option>${supOpts.map(([v,n])=>`<option value="${esc(v)}" ${filters.supervisor===v?'selected':''}>${esc(n)}</option>`).join('')}</select></div>
      <div><label>من تاريخ</label><input id="fm10155DateFrom" type="date" value="${esc(filters.dateFrom)}"></div>
      <div><label>إلى تاريخ</label><input id="fm10155DateTo" type="date" value="${esc(filters.dateTo)}"></div>
      <div><label>نوع الحركة</label><select id="fm10155Type">${types.map(([v,n])=>`<option value="${esc(v)}" ${filters.type===v?'selected':''}>${esc(n)}</option>`).join('')}</select></div>
      <button class="light" type="button" id="fm10155ClearFilters">تفريغ الفلاتر</button>
      <button class="light" type="button" id="fm10155SyncNames">مزامنة أسماء المنتجات</button>
      <button class="light" type="button" id="fm10156PrintSelected">طباعة المحدد</button>
      <button type="button" id="fm10156PrintFiltered">طباعة حسب الفلاتر</button>
    </div><div class="fin-grid three" style="margin-top:10px"><div class="fin-soft">عدد الحركات: <b>${rows.length}</b></div><div class="fin-soft">إجمالي الكمية: <b>${totalQty}</b></div><div class="fin-soft">القيمة قبل الضريبة: <b>${money(totalNet)}</b></div></div></div>`;
    const tableHtml=`<div class="fin-card"><h3>سجل حركة المخزون حسب الفلاتر</h3><div class="fin-table"><table><thead><tr><th><input type="checkbox" id="fm10156SelectAll"></th><th>التاريخ</th><th>المنتج</th><th>الكود</th><th>نوع الحركة</th><th>الكمية</th><th>المشرف / المستلم</th><th>المشروع</th><th>الأوردر</th><th>القيمة</th><th>إجراء</th></tr></thead><tbody>${rows.map(r=>{
      const parent=r.parent_id||r.id;
      const item=officialItemForMovement(r)||{};
      const productName=officialProductName(r);
      const project=S(r.project_name)||projectName(r.project_id)||'-';
      return `<tr data-fm10155-row="1" data-id="${esc(parent)}"><td><input type="checkbox" class="fm10156-select-row" value="${esc(rowKey(r))}"></td><td>${esc(movementDate(r)||'-')}</td><td><b>${esc(productName)}</b></td><td>${esc(itemCode(item)||r.product_code||r.barcode||'-')}</td><td><span class="fin-badge ${movementOutTypes().includes(S(r.movement_type))?'warn':S(r.movement_type)==='return'?'neutral':''}">${esc(movementTypeLabel(r.movement_type))}</span></td><td>${N(r.quantity)}</td><td>${esc(movementStaffName(r))}</td><td>${esc(project)}</td><td>${esc(r.order_no||'-')}</td><td>${money(movementNet(r))}</td><td class="fin-actions"><button class="light" onclick="financeProShowMovementV15(${Number(parent)||0})">عرض</button><button onclick="financeProEditMovementV15(${Number(parent)||0})">تعديل</button>${(typeof window.financeProDeleteMovementV15==='function')?`<button class="danger" onclick="financeProDeleteMovementV15(${Number(parent)||0})">حذف</button>`:''}</td></tr>`;
    }).join('')||'<tr><td colspan="11">لا توجد حركات حسب الفلاتر.</td></tr>'}</tbody></table></div></div>`;
    box.innerHTML=filterHtml+tableHtml;
    bindFilters();
  }
  function bindFilters(){
    const sup=$('fm10155Supervisor'), from=$('fm10155DateFrom'), to=$('fm10155DateTo'), type=$('fm10155Type');
    if(sup) sup.onchange=()=>{filters.supervisor=S(sup.value); renderEnhancedMovementList();};
    if(from) from.onchange=()=>{filters.dateFrom=S(from.value); renderEnhancedMovementList();};
    if(to) to.onchange=()=>{filters.dateTo=S(to.value); renderEnhancedMovementList();};
    if(type) type.onchange=()=>{filters.type=S(type.value); renderEnhancedMovementList();};
    const clear=$('fm10155ClearFilters'); if(clear) clear.onclick=()=>{filters.supervisor='';filters.dateFrom='';filters.dateTo='';filters.type='';renderEnhancedMovementList();};
    const sync=$('fm10155SyncNames'); if(sync) sync.onclick=async()=>{sync.disabled=true; sync.textContent='جاري المزامنة...'; await syncMovementNamesToDb(true); if(typeof window.financeProLoadV15==='function') await window.financeProLoadV15(true); setTimeout(()=>{sync.disabled=false;sync.textContent='مزامنة أسماء المنتجات'; enhanceMovementTab();},400);};
    const ps=$('fm10156PrintSelected'); if(ps) ps.onclick=()=>printRows(true);
    const pf=$('fm10156PrintFiltered'); if(pf) pf.onclick=()=>printRows(false);
    const all=$('fm10156SelectAll'); if(all) all.onchange=()=>{document.querySelectorAll('.fm10156-select-row').forEach(x=>{x.checked=all.checked;});};
  }
  function hideCoreMovementLists(body, formCard){
    A([...body.querySelectorAll(':scope > .fin-card')]).forEach(card=>{
      if(card===formCard) return;
      if(card.id==='fm10155Host') return;
      const txt=S(card.textContent);
      if(card.querySelector('.fin-table') && /حركة|الحركات|المخزون|سجل/.test(txt)) card.style.display='none';
    });
  }
  function enhanceMovementTab(){
    const st=state();
    if(!st || st.tab!=='movement') return;
    const body=$('finBodyV15'); if(!body) return;
    syncMovementNamesInMemory();
    const formCard=$('finMoveItemV15')?.closest('.fin-card') || null;
    let host=$('fm10155Host');
    if(!host){
      host=document.createElement('div');
      host.id='fm10155Host';
      host.innerHTML='<div id="finMovementListV10155"></div>';
      if(formCard && formCard.nextSibling) body.insertBefore(host, formCard.nextSibling); else body.appendChild(host);
    }
    hideCoreMovementLists(body, formCard);
    renderEnhancedMovementList();
    syncMovementNamesToDb(false);
  }
  function patchShowMovement(){
    if(window.__fm10155ShowPatched) return; window.__fm10155ShowPatched=true;
    const old=window.financeProShowMovementV15;
    window.financeProShowMovementV15=function(id){
      const st=state();
      const m=A(st.movements).find(x=>String(x.id)===String(id));
      if(!m || !old) return old?old.apply(this,arguments):undefined;
      const oldName=m.item_name;
      const name=officialProductName(m);
      if(name) m.item_name=name;
      const res=old.apply(this,arguments);
      m.item_name=oldName;
      // ensure modal visible name is official even if base copied old value elsewhere
      setTimeout(()=>{
        const cards=[...document.querySelectorAll('.fin-modal-card,.fin-modal-backdrop')];
        cards.forEach(card=>{
          const b=[...card.querySelectorAll('b')].find(x=>S(x.textContent)===S(oldName));
          if(b&&name) b.textContent=name;
        });
      },20);
      return res;
    };
  }
  function patchFinanceHooks(){
    if(window.__fm10155HooksPatched) return; window.__fm10155HooksPatched=true;
    const oldTab=window.financeProTabV15;
    if(typeof oldTab==='function'){
      window.financeProTabV15=function(){ const r=oldTab.apply(this,arguments); setTimeout(enhanceMovementTab,80); return r; };
    }
    const oldLoad=window.financeProLoadV15;
    if(typeof oldLoad==='function'){
      window.financeProLoadV15=async function(){ const r=await oldLoad.apply(this,arguments); setTimeout(enhanceMovementTab,120); return r; };
    }
    const oldEdit=window.financeProEditMovementV15;
    if(typeof oldEdit==='function'){
      window.financeProEditMovementV15=function(){ const r=oldEdit.apply(this,arguments); setTimeout(enhanceMovementTab,120); return r; };
    }
  }
  function installStyle(){
    if($('fm10156Style')) return;
    const st=document.createElement('style'); st.id='fm10156Style';
    st.textContent=`#fm10155Host{display:block!important;margin-top:12px}.fm10155-filters>div{min-width:160px}.fm10155-filter-card{border-color:#bfe1d6!important;background:linear-gradient(180deg,#fff,#f8fffc)!important}#finMovementListV10155 .fin-table{max-height:64vh}#fm10155SyncNames,#fm10156PrintSelected,#fm10156PrintFiltered{border:1px solid #cfe3db!important}.fm10156-select-row{width:18px;height:18px;cursor:pointer}#fm10156SelectAll{width:18px;height:18px}`;
    document.head.appendChild(st);
  }
  function boot(){ installStyle(); patchFinanceHooks(); patchShowMovement(); setTimeout(enhanceMovementTab,150); setTimeout(enhanceMovementTab,800); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.addEventListener('load',()=>setTimeout(boot,600),{once:true});
  console.log('Loaded '+VERSION);
})();

/* Tasneef v10157 - Safe product edit for fallback movement-only products
   Fixes: invalid input syntax for type bigint: "fb_*" when editing products rendered from inventory movements.
   Scope: المالية والمخزون فقط. No new movement is created. */
(function(){
  'use strict';
  if(window.__tasneefFinanceSafeProductEditV10157) return;
  window.__tasneefFinanceSafeProductEditV10157 = true;

  const $=id=>document.getElementById(id);
  const A=v=>Array.isArray(v)?v:[];
  const S=v=>String(v??'').trim();
  const esc=v=>S(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const client=()=>window.sb||window.supabaseClient||window.supabase||null;
  const state=()=>window.financeProStateV15||{};
  const isBigint=v=>/^\d+$/.test(S(v));
  const currentUser=()=>{try{return JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{};}catch(_){return{};}};
  function isSystemAdmin(){
    const u=currentUser();
    const text=[u.role,u.user_role,u.type,u.position,u.username,u.full_name,u.name,u.email].map(S).join(' ').toLowerCase();
    return /admin|system|owner|مدير\s*عام|مدير\s*النظام|النظام|ادارة|الإدارة/.test(text) || ['admin','general_manager','system_admin','owner'].includes(S(u.role||u.user_role||u.type));
  }
  function itemCode(i){return S(i&&(i.product_code||i.serial_number||i.barcode||i.supplier_barcode||i.code));}
  function productKeys(obj){
    const keys=[];
    [obj&&obj.id,obj&&obj.item_id,obj&&obj.product_code,obj&&obj.serial_number,obj&&obj.barcode,obj&&obj.supplier_barcode,obj&&obj.code,obj&&obj.name,obj&&obj.item_name].forEach(v=>{const x=S(v).toLowerCase(); if(x&&!keys.includes(x)) keys.push(x);});
    return keys;
  }
  function getIdFromCard(card){
    const btn=card && card.querySelector('.fin-show-product-btn,[onclick*="financeProShowProductV15"],[onclick*="financeProDeleteProductV15"],[onchange*="financeProUploadProductImageV15"]');
    const txt=(btn && (btn.getAttribute('onclick')||btn.getAttribute('onchange')||'')) || '';
    let m=txt.match(/financePro(?:ShowProduct|DeleteProduct|UploadProductImage)V15\(['"]([^'"]+)['"]/);
    if(m) return m[1];
    const file=card && card.querySelector('input[type="file"][onchange*="financeProUploadProductImageV15"]');
    const ot=(file && file.getAttribute('onchange')) || '';
    m=ot.match(/financeProUploadProductImageV15\(['"]([^'"]+)['"]/);
    return m?m[1]:'';
  }
  function metaValue(card,label){
    const L=S(label).replace(/\s+/g,' ').toLowerCase();
    const boxes=[...(card?.querySelectorAll('.fin-meta div')||[])];
    for(const b of boxes){
      const small=S(b.querySelector('small')?.textContent||'').replace(/\s+/g,' ').toLowerCase();
      if(small.includes(L)) return S(b.querySelector('b,strong')?.textContent||'');
    }
    return '';
  }
  function officialItemByCardData(data){
    const st=state();
    const keys=[];
    [data.id,data.code,data.name].forEach(v=>{const x=S(v).toLowerCase(); if(x) keys.push(x);});
    return A(st.items).find(i=>productKeys(i).some(k=>keys.includes(k))) || null;
  }
  function cardDataFromButton(btn){
    const card=btn?.closest('.fin-product-card');
    const id=getIdFromCard(card);
    const data={
      id,
      oldName:S(card?.querySelector('h4')?.textContent||''),
      name:S(card?.querySelector('h4')?.textContent||''),
      code:metaValue(card,'الكود'),
      unit:metaValue(card,'الوحدة') || 'حبة',
      item_type:metaValue(card,'النوع') || 'مادة'
    };
    const official=officialItemByCardData(data);
    if(official){
      data.officialId=S(official.id);
      data.name=S(official.name||official.item_name||data.name);
      data.code=itemCode(official)||data.code;
      data.unit=S(official.unit||data.unit);
      data.item_type=S(official.item_type||official.type||official.category||data.item_type);
    }
    data.isFallback=!isBigint(data.id) && !isBigint(data.officialId);
    return data;
  }
  function closeModal(){ $('finProductEditModalV10157')?.remove(); }
  function openModal(data){
    closeModal();
    const root=document.createElement('div');
    root.id='finProductEditModalV10157'; root.className='fp10157-backdrop';
    root.innerHTML=`<div class="fp10157-card" role="dialog" aria-modal="true">
      <div class="fp10157-head"><h2>تعديل المنتج</h2><button type="button" class="danger" data-close>إغلاق</button></div>
      <div class="fp10157-note">${data.isFallback?'هذا المنتج ظاهر من حركة مخزون قديمة فقط وليس له رقم منتج رسمي. سيتم تحديث اسم المنتج داخل الحركات القديمة المطابقة للكود بدون إنشاء حركة جديدة.':'التعديل سيحدث المنتج الرسمي ويزامن الاسم داخل حركات المخزون القديمة بدون إنشاء حركة جديدة.'}</div>
      <input type="hidden" id="fp10157Id" value="${esc(data.id)}">
      <input type="hidden" id="fp10157OfficialId" value="${esc(data.officialId||'')}">
      <input type="hidden" id="fp10157OldName" value="${esc(data.oldName||data.name)}">
      <div class="fp10157-grid">
        <div><label>اسم المنتج</label><input id="fp10157Name" value="${esc(data.name)}"></div>
        <div><label>نوع المنتج</label><select id="fp10157Type"><option value="مادة">مادة</option><option value="أداة">أداة</option><option value="مكينة">مكينة</option><option value="عدة">عدة</option><option value="غير">غير</option></select></div>
        <div><label>الوحدة</label><input id="fp10157Unit" value="${esc(data.unit||'حبة')}"></div>
        <div><label>الكود</label><input id="fp10157Code" value="${esc(data.code||'-')}" readonly></div>
      </div>
      <div class="fp10157-actions"><button type="button" id="fp10157Save">حفظ التعديل</button><button type="button" class="light" data-close>إلغاء</button></div>
    </div>`;
    document.body.appendChild(root);
    const type=$('fp10157Type'); if(type) type.value=S(data.item_type)||'مادة';
    root.addEventListener('click',e=>{ if(e.target===root || e.target.closest('[data-close]')) closeModal(); });
    $('fp10157Save').onclick=saveEdit;
  }
  async function updateMovementsByCodeOrName(c,{officialId,code,oldName,name}){
    let updated=0;
    const promises=[];
    const seen=new Set();
    function add(label,builder){ if(seen.has(label)) return; seen.add(label); promises.push(builder.then(r=>{ if(r.error) console.warn('v10157 movement sync', label, r.error.message||r.error); else updated++; })); }
    if(isBigint(officialId)) add('item_id:'+officialId, c.from('inventory_movements').update({item_name:name}).eq('item_id',officialId));
    if(S(code)&&S(code)!=='-'){
      add('product_code:'+code, c.from('inventory_movements').update({item_name:name}).eq('product_code',code));
      add('barcode:'+code, c.from('inventory_movements').update({item_name:name}).eq('barcode',code));
    }
    if(S(oldName)&&S(oldName)!==S(name)) add('item_name:'+oldName, c.from('inventory_movements').update({item_name:name}).eq('item_name',oldName));
    await Promise.all(promises);
    return updated;
  }
  async function saveEdit(){
    if(!isSystemAdmin()) return alert('هذا الإجراء خاص بإدارة النظام فقط');
    const id=S($('fp10157Id')?.value), officialId=S($('fp10157OfficialId')?.value), oldName=S($('fp10157OldName')?.value);
    const name=S($('fp10157Name')?.value), type=S($('fp10157Type')?.value)||'مادة', unit=S($('fp10157Unit')?.value)||'حبة', code=S($('fp10157Code')?.value);
    if(!name) return alert('اسم المنتج مطلوب');
    const c=client(); if(!c||!c.from) return alert('الاتصال بقاعدة البيانات غير جاهز');
    const btn=$('fp10157Save');
    try{
      if(btn){btn.disabled=true; btn.textContent='جاري الحفظ...';}
      const realId=isBigint(officialId)?officialId:(isBigint(id)?id:'');
      if(realId){
        const patch={name, item_type:type, type:type, category:type, unit};
        const res=await c.from('inventory_items').update(patch).eq('id',realId).select('*');
        if(res.error) throw res.error;
      }
      await updateMovementsByCodeOrName(c,{officialId:realId,code,oldName,name});
      // update local state immediately
      const st=state();
      A(st.items).forEach(i=>{ if((realId&&S(i.id)===S(realId)) || (code&&[i.product_code,i.serial_number,i.barcode,i.supplier_barcode,i.code].map(S).includes(code))){ i.name=name; i.item_type=type; i.type=type; i.category=type; i.unit=unit; } });
      A(st.movements).forEach(m=>{ if((realId&&S(m.item_id)===S(realId)) || (code&&[m.product_code,m.barcode].map(S).includes(code)) || (oldName&&S(m.item_name)===oldName)){ m.item_name=name; } });
      closeModal();
      if(typeof window.financeProLoadV15==='function') await window.financeProLoadV15(true);
      else if(typeof window.financeProRenderProductListV15==='function') window.financeProRenderProductListV15();
      if(typeof window.financeProRenderProductListV15==='function') setTimeout(window.financeProRenderProductListV15,300);
      if(typeof msg==='function') msg(realId?'تم تعديل المنتج ومزامنة الحركات القديمة':'تم تحديث اسم المنتج في الحركات القديمة المطابقة');
    }catch(e){ alert('لم يتم تعديل المنتج: '+(e.message||e)); }
    finally{ if(btn){btn.disabled=false; btn.textContent='حفظ التعديل';} }
  }
  function installStyle(){
    if($('fp10157Style')) return;
    const st=document.createElement('style'); st.id='fp10157Style';
    st.textContent=`.fp10157-backdrop{position:fixed;inset:0;z-index:2147483100;background:rgba(0,35,28,.48);display:grid;place-items:center;padding:18px;direction:rtl}.fp10157-card{width:min(720px,96vw);background:#fff;border-radius:22px;border:1px solid #d9e7e2;box-shadow:0 30px 100px rgba(0,0,0,.25);padding:18px;color:#073d31}.fp10157-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.fp10157-head h2{margin:0}.fp10157-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin:14px 0}.fp10157-grid input,.fp10157-grid select{width:100%;border:1px solid #d9e7e2;border-radius:12px;padding:10px;background:#fff}.fp10157-note{background:#f4faf7;border:1px solid #d8ebe3;border-radius:12px;padding:10px;margin-top:12px;line-height:1.8}.fp10157-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}.fp10157-actions button,.fp10157-head button{border:0;border-radius:12px;padding:10px 14px;font-weight:800;background:#0b4f3a;color:#fff;cursor:pointer}.fp10157-actions .light{background:#eef7f3;color:#073d31}.fp10157-head .danger{background:#c73535;color:#fff}`;
    document.head.appendChild(st);
  }
  function captureEditClicks(e){
    const btn=e.target.closest && e.target.closest('[data-v10113-edit-product]');
    if(!btn) return;
    const data=cardDataFromButton(btn);
    const id=S(data.id||data.officialId);
    if(!id) return;
    e.preventDefault();
    e.stopPropagation();
    if(typeof e.stopImmediatePropagation==='function') e.stopImmediatePropagation();
    openModal(data);
    return false;
  }
  function boot(){
    installStyle();
    document.removeEventListener('click',captureEditClicks,true);
    document.addEventListener('click',captureEditClicks,true);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.addEventListener('load',boot,{once:true});
  console.log('Loaded v10157 safe product edit');
})();

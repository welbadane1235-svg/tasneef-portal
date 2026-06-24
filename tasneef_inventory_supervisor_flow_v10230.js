(function(){
  'use strict';
  const VERSION='V10230';
  const $=(id)=>document.getElementById(id);
  const A=(v)=>Array.isArray(v)?v:[];
  const S=(v)=>String(v??'').trim();
  const N=(v)=>{const n=Number(String(v??0).replace(/,/g,'').trim()); return Number.isFinite(n)?n:0;};
  const esc=(s)=>S(s).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const client=()=>window.sb||window.supabaseClient||window.supabase||null;
  const today=()=>new Date().toISOString().slice(0,10);
  function user(){ try{return (typeof window.session==='function'?window.session():null)||JSON.parse(localStorage.getItem('tasneef_user')||localStorage.getItem('currentUser')||'null')||{};}catch(e){return {};}}
  function toast(t,err){ if(typeof window.msg==='function') window.msg(t,err?'err':undefined); else alert(t); }
  function statusText(s){ return {pending:'بانتظار الموافقة',approved:'موافق عليه',issued:'تم الصرف',consumed:'تم تسجيل الاستهلاك',closed:'مغلق',rejected:'مرفوض'}[S(s)]||S(s)||'-'; }
  function statusClass(s){ return s==='rejected'?'red':(s==='issued'||s==='approved'?'amber':(s==='consumed'||s==='closed'?'green':'')); }
  async function selectAll(table, cols='*', orderCol='created_at', ascending=false){
    const c=client(); if(!c) throw new Error('Supabase غير متصل');
    let all=[], from=0, step=1000;
    while(true){
      let q=c.from(table).select(cols).range(from, from+step-1);
      if(orderCol) q=q.order(orderCol,{ascending});
      const {data,error}=await q;
      if(error) throw error;
      all=all.concat(data||[]);
      if(!data || data.length<step) break;
      from+=step;
      if(from>20000) break;
    }
    return all;
  }
  let state={items:[],projects:[],requests:[],consumptions:[]};
  async function loadBase(){
    const c=client(); if(!c) throw new Error('Supabase غير متصل');
    const [items,projects,requests,cons]=await Promise.all([
      selectAll('inventory_items','*','name',true).catch(()=>[]),
      selectAll('projects','*','name',true).catch(()=>[]),
      selectAll('inventory_supervisor_requests','*','created_at',false).catch(()=>[]),
      selectAll('inventory_supervisor_consumptions','*','created_at',false).catch(()=>[])
    ]);
    state.items=items; state.projects=projects; state.requests=requests; state.consumptions=cons;
  }
  function itemName(i){return S(i.name||i.item_name||i.product_name||'منتج');}
  function itemUnit(i){return S(i.unit||i.unit_name||'');}
  function projectName(id){ const p=state.projects.find(x=>S(x.id)===S(id)); return S(p?.name||p?.project_name||''); }
  function fillItems(selectId){ const el=$(selectId); if(!el) return; const old=el.value; el.innerHTML='<option value="">اختر المنتج</option>'+state.items.map(i=>`<option value="${esc(i.id)}">${esc(itemName(i))} - المتوفر ${N(i.quantity)} ${esc(itemUnit(i))}</option>`).join(''); el.value=old; }
  function projectOptions(selected){ return '<option value="">اختر المشروع</option>'+state.projects.map(p=>`<option value="${esc(p.id)}" ${S(selected)===S(p.id)?'selected':''}>${esc(p.name||p.project_name||'مشروع')}</option>`).join(''); }

  function injectStyle(){
    if($('invFlowStyleV10230')) return;
    const st=document.createElement('style'); st.id='invFlowStyleV10230'; st.textContent=`
      .inv-flow-v10230 .mini-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:10px 0}.inv-flow-v10230 .mini{border:1px solid var(--line,#dce6e2);background:#fbfdfc;border-radius:16px;padding:12px}.inv-flow-v10230 .mini small{display:block;color:#60706a}.inv-flow-v10230 .mini b{font-size:22px;color:var(--brand,#0A4033)}
      .inv-flow-v10230 .tag{display:inline-block;border-radius:999px;padding:5px 9px;background:#eef6f3;color:#0A4033;font-weight:800;font-size:12px}.inv-flow-v10230 .tag.red{background:#fde8e8;color:#9d2222}.inv-flow-v10230 .tag.green{background:#e8f4ee;color:#137a4b}.inv-flow-v10230 .tag.amber{background:#fff5da;color:#8a6700}
      .inv-flow-v10230 .line-card{border:1px solid #dce6e2;border-radius:16px;padding:12px;margin:10px 0;background:#fff}.inv-flow-v10230 .line-card h3{margin:0 0 8px;color:#0A4033}.inv-cons-modal-v10230{position:fixed;inset:0;background:rgba(0,30,25,.52);z-index:999999;display:grid;place-items:center;padding:16px}.inv-cons-box-v10230{background:#fff;border-radius:22px;width:min(980px,96vw);max-height:92vh;overflow:auto;direction:rtl;box-shadow:0 25px 80px rgba(0,0,0,.28)}.inv-cons-head-v10230{position:sticky;top:0;background:#0A4033;color:#fff;padding:14px 18px;display:flex;justify-content:space-between;gap:10px;align-items:center}.inv-cons-head-v10230 h2{margin:0;color:#fff}.inv-cons-body-v10230{padding:16px}.inv-cons-row-v10230{display:grid;grid-template-columns:1.4fr .6fr 1.2fr auto;gap:8px;margin:8px 0;align-items:end;border:1px solid #e3eee9;border-radius:14px;padding:10px;background:#fbfdfc}@media(max-width:800px){.inv-cons-row-v10230{grid-template-columns:1fr}.inv-flow-v10230 .table-wrap{max-height:none}}
    `; document.head.appendChild(st);
  }

  function ensureAdmin(){
    if(!$('inventorySupervisorFlow')){
      const content=document.querySelector('.content')||document.body;
      const sec=document.createElement('section'); sec.id='inventorySupervisorFlow'; sec.className='page hidden inv-flow-v10230';
      sec.innerHTML=`
        <div class="card section-head"><div><h2>طلبات واستهلاك المخزون <span class="badge">${VERSION}</span></h2><p>متابعة طلبات المشرفين، الصرف، ثم توزيع استهلاك المنتج الواحد على أكثر من مشروع.</p></div><button class="light" onclick="InvSupervisorFlowV10230.adminLoad(true)">تحديث</button></div>
        <div class="card"><h2>الفلاتر</h2><div class="filters"><input id="invFlowSearch" oninput="InvSupervisorFlowV10230.adminRender()" placeholder="بحث بالمنتج، المشرف، المشروع، الملاحظات"><select id="invFlowStatus" onchange="InvSupervisorFlowV10230.adminRender()"><option value="">كل الحالات</option><option value="pending">بانتظار الموافقة</option><option value="approved">موافق عليه</option><option value="issued">تم الصرف</option><option value="consumed">تم تسجيل الاستهلاك</option><option value="closed">مغلق</option><option value="rejected">مرفوض</option></select><select id="invFlowItemFilter" onchange="InvSupervisorFlowV10230.adminRender()"><option value="">كل المنتجات</option></select></div><div id="invFlowKpis" class="mini-grid"></div></div>
        <div class="card"><h2>طلبات المشرفين</h2><div class="table-wrap"><table><thead><tr><th>رقم</th><th>التاريخ</th><th>المشرف</th><th>المنتج</th><th>المطلوب</th><th>المصروف</th><th>المستهلك</th><th>المتبقي</th><th>الحالة</th><th>توزيع الاستهلاك</th><th>إجراء</th></tr></thead><tbody id="invFlowAdminBody"><tr><td colspan="11">اضغط تحديث</td></tr></tbody></table></div></div>`;
      content.appendChild(sec);
    }
    const side=document.querySelector('.side');
    if(side && !document.querySelector('[data-page="inventorySupervisorFlow"]')){
      const btn=document.createElement('button'); btn.className='nav'; btn.dataset.page='inventorySupervisorFlow'; btn.textContent='طلبات المخزون'; btn.onclick=function(){ if(window.showPage) window.showPage('inventorySupervisorFlow',this); setTimeout(()=>window.InvSupervisorFlowV10230&&window.InvSupervisorFlowV10230.adminLoad(),80); };
      const inv=document.querySelector('[data-page="inventoryAudit"]')||Array.from(side.querySelectorAll('.nav')).find(b=>/الجرد|المخزون/.test(b.textContent));
      if(inv && inv.parentNode) inv.parentNode.insertBefore(btn, inv.nextSibling); else side.insertBefore(btn, side.querySelector('.danger')||null);
    }
  }
  function ensureSupervisor(){
    const tabs=document.querySelector('.sup-tabs');
    if(tabs && !$('supInventoryFlowTabV10230')){
      const btn=document.createElement('button'); btn.id='supInventoryFlowTabV10230'; btn.className='sup-tab'; btn.textContent='طلبات المخزون'; btn.onclick=function(){ if(window.showSupervisorWindow) window.showSupervisorWindow('supInventoryFlow',this); setTimeout(()=>window.InvSupervisorFlowV10230&&window.InvSupervisorFlowV10230.supLoad(),80); };
      tabs.insertBefore(btn, tabs.children[5]||null);
    }
    if(!$('supInventoryFlow')){
      const host=document.querySelector('.mobile-shell')||document.body;
      const sec=document.createElement('section'); sec.id='supInventoryFlow'; sec.className='sup-page inv-flow-v10230';
      sec.innerHTML=`
        <section class="card"><h2>طلب صرف منتج <span class="badge">${VERSION}</span></h2><div class="sup-help">اطلب كمية من المنتج. بعد صرف الإدارة، سجل الاستهلاك ووزعه على المشاريع التي استخدمت فيها المادة.</div><label>المنتج</label><select id="supInvFlowItem"></select><div class="split"><div><label>الكمية المطلوبة</label><input type="number" step="0.01" id="supInvFlowQty" placeholder="مثال: 3"></div><div><label>سبب الطلب</label><input id="supInvFlowReason" placeholder="مثال: تنظيف عدة مشاريع"></div></div><label>ملاحظات</label><textarea id="supInvFlowNotes"></textarea><div class="actions"><button onclick="InvSupervisorFlowV10230.supSaveRequest(this)">إرسال الطلب</button><button class="light" onclick="InvSupervisorFlowV10230.supLoad(true)">تحديث</button></div></section>
        <section class="card"><h2>طلباتي واستهلاكي</h2><div id="supInvFlowKpis" class="mini-grid"></div><div class="table-wrap"><table><thead><tr><th>رقم</th><th>التاريخ</th><th>المنتج</th><th>المطلوب</th><th>المصروف</th><th>المستهلك</th><th>المتبقي</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody id="supInvFlowBody"><tr><td colspan="9">اضغط تحديث</td></tr></tbody></table></div></section>`;
      host.insertBefore(sec, $('supSummary')||null);
    }
  }

  async function adminLoad(show){ try{ ensureAdmin(); await loadBase(); fillItems('invFlowItemFilter'); adminRender(); if(show) toast('تم تحديث طلبات المخزون'); }catch(e){ console.error(e); toast(e.message||String(e),true); } }
  function usedForReq(id){ return A(state.consumptions).filter(c=>S(c.request_id)===S(id)).reduce((a,c)=>a+N(c.consumed_qty),0); }
  function linesForReq(id){ return A(state.consumptions).filter(c=>S(c.request_id)===S(id)); }
  function filterReqs(){
    let rows=A(state.requests); const q=S($('invFlowSearch')?.value).toLowerCase(), st=S($('invFlowStatus')?.value), item=S($('invFlowItemFilter')?.value);
    if(st) rows=rows.filter(r=>S(r.status)===st); if(item) rows=rows.filter(r=>S(r.item_id)===item);
    if(q) rows=rows.filter(r=>[r.request_no,r.supervisor_name,r.item_name,r.reason,r.notes,r.admin_notes, ...linesForReq(r.id).map(l=>l.project_name)].join(' ').toLowerCase().includes(q));
    return rows.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
  }
  function adminRender(){
    ensureAdmin(); const b=$('invFlowAdminBody'); if(!b) return; const rows=filterReqs();
    const k=$('invFlowKpis'); if(k){ const issued=rows.reduce((a,r)=>a+N(r.issued_qty),0), used=rows.reduce((a,r)=>a+usedForReq(r.id),0); k.innerHTML=`<div class="mini"><small>عدد الطلبات</small><b>${rows.length}</b></div><div class="mini"><small>إجمالي المصروف</small><b>${issued}</b></div><div class="mini"><small>إجمالي المستهلك</small><b>${used}</b></div><div class="mini"><small>المتبقي</small><b>${issued-used}</b></div>`; }
    b.innerHTML=rows.map(r=>{ const used=usedForReq(r.id), rem=N(r.issued_qty)-used; const lines=linesForReq(r.id); const lineHtml=lines.length?lines.map(l=>`${esc(l.project_name||'-')}: <b>${N(l.consumed_qty)}</b>`).join('<br>'):'-'; return `<tr><td>${esc(r.request_no||('ISR-'+r.id))}</td><td>${esc((r.created_at||'').slice(0,10))}</td><td>${esc(r.supervisor_name||'-')}</td><td><b>${esc(r.item_name||'-')}</b></td><td>${N(r.requested_qty)} ${esc(r.item_unit||'')}</td><td>${N(r.issued_qty)} ${esc(r.item_unit||'')}</td><td>${used} ${esc(r.item_unit||'')}</td><td>${rem} ${esc(r.item_unit||'')}</td><td><span class="tag ${statusClass(r.status)}">${statusText(r.status)}</span></td><td>${lineHtml}</td><td class="row-actions">${adminActions(r)}</td></tr>`; }).join('')||'<tr><td colspan="11">لا توجد طلبات</td></tr>';
  }
  function adminActions(r){
    const id=esc(r.id); let a=[];
    if(r.status==='pending') a.push(`<button onclick="InvSupervisorFlowV10230.adminApprove('${id}')">موافقة</button>`,`<button class="danger" onclick="InvSupervisorFlowV10230.adminReject('${id}')">رفض</button>`);
    if(r.status==='pending'||r.status==='approved') a.push(`<button onclick="InvSupervisorFlowV10230.adminIssue('${id}')">صرف</button>`);
    if(r.status==='consumed'||r.status==='issued') a.push(`<button class="light" onclick="InvSupervisorFlowV10230.adminClose('${id}')">إغلاق</button>`);
    return a.join(' ');
  }
  async function adminApprove(id){ try{ const u=user(); const {error}=await client().from('inventory_supervisor_requests').update({status:'approved',approved_at:new Date().toISOString(),approved_by:S(u.full_name||u.username||u.name||'الإدارة')}).eq('id',id); if(error) throw error; toast('تمت الموافقة'); await adminLoad(); }catch(e){toast(e.message||String(e),true);} }
  async function adminReject(id){ try{ const note=prompt('سبب الرفض')||''; const {error}=await client().from('inventory_supervisor_requests').update({status:'rejected',admin_notes:note,closed_at:new Date().toISOString()}).eq('id',id); if(error) throw error; toast('تم الرفض'); await adminLoad(); }catch(e){toast(e.message||String(e),true);} }
  async function adminIssue(id){ try{
    const r=state.requests.find(x=>S(x.id)===S(id)); if(!r) throw new Error('الطلب غير موجود');
    const qty=N(prompt('الكمية المصروفة', r.approved_qty||r.requested_qty||r.issued_qty||0)); if(qty<=0) throw new Error('أدخل كمية صحيحة');
    const item=state.items.find(i=>S(i.id)===S(r.item_id)); if(item && N(item.quantity)<qty && !confirm('الكمية أكبر من المتوفر. هل تريد المتابعة؟')) return;
    const u=user(); const by=S(u.full_name||u.username||u.name||'الإدارة'); const c=client();
    const upd={status:'issued',issued_qty:qty,issued_at:new Date().toISOString(),issued_by:by};
    const rr=await c.from('inventory_supervisor_requests').update(upd).eq('id',id); if(rr.error) throw rr.error;
    if(item){ const newQty=N(item.quantity)-qty; const ii=await c.from('inventory_items').update({quantity:newQty}).eq('id',item.id); if(ii.error) console.warn(ii.error); }
    const mv={item_id:S(r.item_id),item_name:S(r.item_name),movement_type:'out',quantity:qty,movement_date:today(),receiver:S(r.supervisor_name),reason:'صرف طلب مشرف '+(r.request_no||id),notes:S(r.reason||r.notes||''),created_by_name:by};
    const mm=await c.from('inventory_movements').insert(mv); if(mm.error) console.warn(mm.error);
    toast('تم الصرف وخصم الكمية من المخزون'); await adminLoad();
  }catch(e){toast(e.message||String(e),true);} }
  async function adminClose(id){ try{ const u=user(); const {error}=await client().from('inventory_supervisor_requests').update({status:'closed',closed_at:new Date().toISOString(),closed_by:S(u.full_name||u.username||u.name||'الإدارة')}).eq('id',id); if(error) throw error; toast('تم إغلاق الطلب'); await adminLoad(); }catch(e){toast(e.message||String(e),true);} }

  async function supLoad(show){ try{ ensureSupervisor(); await loadBase(); fillItems('supInvFlowItem'); supRender(); if(show) toast('تم تحديث طلبات المخزون'); }catch(e){console.error(e); toast(e.message||String(e),true);} }
  function supRows(){ const u=user(); const uid=S(u.id); const uname=S(u.full_name||u.username||u.name); return A(state.requests).filter(r=>S(r.supervisor_id)===uid || (!uid && S(r.supervisor_name)===uname) || S(r.supervisor_name)===uname).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))); }
  function supRender(){
    ensureSupervisor(); const b=$('supInvFlowBody'); if(!b) return; const rows=supRows();
    const k=$('supInvFlowKpis'); if(k){ const issued=rows.reduce((a,r)=>a+N(r.issued_qty),0), used=rows.reduce((a,r)=>a+usedForReq(r.id),0); k.innerHTML=`<div class="mini"><small>طلباتي</small><b>${rows.length}</b></div><div class="mini"><small>المصروف</small><b>${issued}</b></div><div class="mini"><small>المستهلك</small><b>${used}</b></div><div class="mini"><small>المتبقي</small><b>${issued-used}</b></div>`; }
    b.innerHTML=rows.map(r=>{ const used=usedForReq(r.id), rem=N(r.issued_qty)-used; return `<tr><td>${esc(r.request_no||('ISR-'+r.id))}</td><td>${esc((r.created_at||'').slice(0,10))}</td><td><b>${esc(r.item_name||'-')}</b></td><td>${N(r.requested_qty)} ${esc(r.item_unit||'')}</td><td>${N(r.issued_qty)} ${esc(r.item_unit||'')}</td><td>${used} ${esc(r.item_unit||'')}</td><td>${rem} ${esc(r.item_unit||'')}</td><td><span class="tag ${statusClass(r.status)}">${statusText(r.status)}</span></td><td>${(r.status==='issued'||r.status==='consumed')?`<button onclick="InvSupervisorFlowV10230.openConsumption('${esc(r.id)}')">تسجيل الاستهلاك</button>`:'-'}</td></tr>`; }).join('')||'<tr><td colspan="9">لا توجد طلبات</td></tr>';
  }
  async function supSaveRequest(btn){ try{ if(btn)btn.disabled=true; const item=state.items.find(i=>S(i.id)===S($('supInvFlowItem')?.value)); if(!item) throw new Error('اختر المنتج'); const qty=N($('supInvFlowQty')?.value); if(qty<=0) throw new Error('أدخل الكمية المطلوبة'); const u=user(); const row={supervisor_id:S(u.id),supervisor_name:S(u.full_name||u.username||u.name||'مشرف'),item_id:S(item.id),item_name:itemName(item),item_unit:itemUnit(item),requested_qty:qty,status:'pending',reason:S($('supInvFlowReason')?.value),notes:S($('supInvFlowNotes')?.value)}; const {error}=await client().from('inventory_supervisor_requests').insert(row); if(error) throw error; ['supInvFlowQty','supInvFlowReason','supInvFlowNotes'].forEach(id=>$(id)&&($(id).value='')); toast('تم إرسال طلب الصرف للإدارة'); await supLoad(); }catch(e){toast(e.message||String(e),true);} finally{if(btn)btn.disabled=false;} }
  function openConsumption(id){ const r=state.requests.find(x=>S(x.id)===S(id)); if(!r) return toast('الطلب غير موجود',true); const old=linesForReq(id); const rows=old.length?old:[{project_id:'',consumed_qty:'',notes:''}]; const modal=document.createElement('div'); modal.className='inv-cons-modal-v10230'; modal.id='invConsumptionModalV10230'; modal.innerHTML=`<div class="inv-cons-box-v10230"><div class="inv-cons-head-v10230"><h2>تسجيل استهلاك ${esc(r.item_name)} - المصروف ${N(r.issued_qty)} ${esc(r.item_unit||'')}</h2><button class="light" onclick="InvSupervisorFlowV10230.closeConsumption()">إغلاق</button></div><div class="inv-cons-body-v10230"><div class="sup-help">أضف المشاريع التي استهلك فيها هذا المنتج. لا يمكن أن يتجاوز إجمالي الاستهلاك الكمية المصروفة.</div><div id="invConsRowsV10230"></div><div class="actions"><button type="button" class="light" onclick="InvSupervisorFlowV10230.addConsumptionRow()">+ إضافة مشروع</button><button type="button" onclick="InvSupervisorFlowV10230.saveConsumption('${esc(id)}',this)">حفظ الاستهلاك</button></div><div id="invConsTotalV10230" class="msg"></div></div></div>`; document.body.appendChild(modal); rows.forEach(l=>addConsumptionRow(l)); calcConsumptionTotal(); }
  function closeConsumption(){ $('invConsumptionModalV10230')?.remove(); }
  function addConsumptionRow(line){ const host=$('invConsRowsV10230'); if(!host) return; const div=document.createElement('div'); div.className='inv-cons-row-v10230'; div.innerHTML=`<div><label>المشروع</label><select class="inv-cons-project">${projectOptions(line?.project_id)}</select></div><div><label>الكمية</label><input type="number" step="0.01" class="inv-cons-qty" value="${esc(line?.consumed_qty||'')}" oninput="InvSupervisorFlowV10230.calcConsumptionTotal()"></div><div><label>ملاحظات</label><input class="inv-cons-notes" value="${esc(line?.notes||'')}"></div><div><button class="danger" type="button" onclick="this.closest('.inv-cons-row-v10230').remove(); InvSupervisorFlowV10230.calcConsumptionTotal();">حذف</button></div>`; host.appendChild(div); }
  function calcConsumptionTotal(){ const t=Array.from(document.querySelectorAll('.inv-cons-qty')).reduce((a,e)=>a+N(e.value),0); const el=$('invConsTotalV10230'); if(el) el.textContent='إجمالي الاستهلاك الحالي: '+t; return t; }
  async function saveConsumption(id,btn){ try{ if(btn)btn.disabled=true; const r=state.requests.find(x=>S(x.id)===S(id)); if(!r) throw new Error('الطلب غير موجود'); const lines=Array.from(document.querySelectorAll('.inv-cons-row-v10230')).map(row=>{ const pid=row.querySelector('.inv-cons-project')?.value; return {request_id:Number(id),item_id:S(r.item_id),item_name:S(r.item_name),supervisor_id:S(r.supervisor_id),supervisor_name:S(r.supervisor_name),project_id:S(pid),project_name:projectName(pid),consumed_qty:N(row.querySelector('.inv-cons-qty')?.value),notes:S(row.querySelector('.inv-cons-notes')?.value),created_by:S(user().full_name||user().username||user().name||r.supervisor_name)}; }).filter(l=>l.project_id && l.consumed_qty>0); const sum=lines.reduce((a,l)=>a+N(l.consumed_qty),0); if(!lines.length) throw new Error('أضف مشروع وكمية استهلاك'); if(sum>N(r.issued_qty)+0.00001) throw new Error('إجمالي الاستهلاك أكبر من الكمية المصروفة'); const c=client(); await c.from('inventory_supervisor_consumptions').delete().eq('request_id',id); const ins=await c.from('inventory_supervisor_consumptions').insert(lines); if(ins.error) throw ins.error; const upd=await c.from('inventory_supervisor_requests').update({status:'consumed',consumed_at:new Date().toISOString()}).eq('id',id); if(upd.error) throw upd.error; closeConsumption(); toast('تم حفظ توزيع الاستهلاك على المشاريع'); await supLoad(); if($('inventorySupervisorFlow') && !$('inventorySupervisorFlow').classList.contains('hidden')) await adminLoad(); }catch(e){toast(e.message||String(e),true);} finally{ if(btn)btn.disabled=false; } }

  function init(){ injectStyle(); if($('inventorySupervisorFlow')||document.querySelector('.side')) ensureAdmin(); if(document.querySelector('.sup-tabs')) ensureSupervisor(); }
  const api={adminLoad,adminRender,adminApprove,adminReject,adminIssue,adminClose,supLoad,supSaveRequest,openConsumption,closeConsumption,addConsumptionRow,calcConsumptionTotal,saveConsumption};
  window.InvSupervisorFlowV10230=api;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
  const oldShow=window.showPage; if(typeof oldShow==='function'){ window.showPage=function(id,btn){ const r=oldShow.apply(this,arguments); if(id==='inventorySupervisorFlow') setTimeout(()=>adminLoad(),60); return r; }; }
})();

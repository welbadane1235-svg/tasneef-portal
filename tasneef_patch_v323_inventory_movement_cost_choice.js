/* TASNEEF v323 - Professional inventory movement: multi items + cost choice per line, no VAT in movements */
(function(){
  'use strict';
  if(window.__financeV323MoveCostChoice) return;
  window.__financeV323MoveCostChoice = true;

  const LS={
    items:'tasneef_v312_items',
    moves:'tasneef_v312_moves',
    suppliers:'tasneef_v312_suppliers',
    purchases:'tasneef_v312_purchases'
  };
  const $=id=>document.getElementById(id);
  const parse=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')||[]}catch(_){return[]}};
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const n=v=>Number(String(v??'').replace(/,/g,''))||0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const today=()=>new Date().toISOString().slice(0,10);
  const money=v=>n(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';
  const moveTypes=['صرف من مشرف','استهلاك من مشرف','هدر من مشرف','تالف من مشرف','سكراب'];
  const statuses=['بانتظار','معتمد','مرفوض','تم الصرف'];
  let movementLines=[];
  let editBatchId='';

  function projects(){ return Array.isArray(window.data?.projects)?window.data.projects:[]; }
  function supervisors(){ return Array.isArray(window.data?.supervisors)?window.data.supervisors:[]; }
  function projectName(id){ const p=projects().find(x=>String(x.id)===String(id)); return p?(p.name||p.project_name||p.title||id):id; }
  function supName(id){ const s=supervisors().find(x=>String(x.id)===String(id)); return s?(s.full_name||s.name||s.username||id):''; }
  function item(id){ return parse(LS.items).find(x=>String(x.id)===String(id))||{}; }
  function itemName(id){ const it=item(id); return it.name||'-'; }
  function itemCode(id){ const it=item(id); return it.code||it.company_code||'-'; }
  function itemCost(id){ const it=item(id); return n(it.price_after_vat||it.price_after||it.price_included||it.price_before||it.price||0); }
  function imageHTML(src){return src?`<img src="${esc(src)}" loading="lazy">`:'<span>لا توجد صورة</span>';}
  function itemOptions(val=''){ return '<option value="">اختر المنتج</option>'+parse(LS.items).map(i=>`<option value="${esc(i.id)}" ${String(val)===String(i.id)?'selected':''}>${esc([i.name,i.code,i.company_code].filter(Boolean).join(' | '))}</option>`).join(''); }
  function projectOptions(val=''){ return '<option value="">اختر المشروع</option>'+projects().map(p=>`<option value="${esc(p.id)}" ${String(val)===String(p.id)?'selected':''}>${esc(p.name||p.project_name||p.title||p.id)}</option>`).join(''); }
  function supervisorOptions(val=''){ return '<option value="">اختر المشرف</option>'+supervisors().map(s=>`<option value="${esc(s.id)}" ${String(val)===String(s.id)?'selected':''}>${esc(s.full_name||s.name||s.username||s.id)}</option>`).join(''); }
  function shouldAffect(m){ return ['معتمد','تم الصرف'].includes(m.status)||m.type==='سكراب'; }
  function updateStock(itemId,delta){ const items=parse(LS.items); const it=items.find(x=>String(x.id)===String(itemId)); if(it){ it.qty=n(it.qty)+n(delta); it.updated_at=new Date().toISOString(); save(LS.items,items); } }
  function costTarget(line){
    const t=line.cost_type||'FM';
    if(t==='FM') return (line.project_ids||[]).map(projectName).join('، ')||'-';
    if(t==='CN') return line.order_no||'-';
    return line.general_note||line.notes||'عام';
  }
  function groupMoves(){
    const moves=parse(LS.moves).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')));
    const map=new Map();
    moves.forEach(m=>{
      const bid=m.batch_id||m.batchId||m.id;
      if(!map.has(bid)) map.set(bid,{id:bid,batch_no:m.batch_no||m.batchNo||('MOV-'+String(bid).slice(-6).toUpperCase()),date:m.date,supervisor_name:m.supervisor_name,supervisor_id:m.supervisor_id,status:m.status,notes:m.batch_notes||m.notes||'',lines:[]});
      map.get(bid).lines.push(m);
    });
    return [...map.values()];
  }
  function groupsFiltered(){
    const ft=$('moveFilterType')?.value||'', fs=$('moveFilterStatus')?.value||'';
    return groupMoves().filter(g=>(!fs||g.status===fs)&&(!ft||g.lines.some(l=>l.type===ft))).slice(0,80);
  }
  function ensureStyle(){
    if($('styleFinanceV323Movement')) return;
    const st=document.createElement('style'); st.id='styleFinanceV323Movement'; st.textContent=`
      .fi-move-layout{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:14px;align-items:start;direction:rtl}.fi-move-card{background:#fff;border:1px solid #dfece7;border-radius:22px;padding:15px;box-shadow:0 8px 28px rgba(6,61,49,.045)}.fi-move-form{display:grid;gap:10px}.fi-move-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.fi-move-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.fi-move-line-form{border:1px dashed #bad8ce;background:#fbfefd;border-radius:18px;padding:12px;display:grid;gap:10px}.fi-move-help{background:#fffaf0;border:1px dashed #d9b861;border-radius:14px;padding:10px;color:#6d5400;line-height:1.7;font-size:13px}.fi-move-lines{display:grid;gap:8px}.fi-move-line{display:grid;grid-template-columns:1.2fr .55fr .8fr .8fr 1fr auto;gap:8px;align-items:center;background:#fbfefd;border:1px solid #e4eee9;border-radius:16px;padding:9px}.fi-move-line b{color:#063d31}.fi-move-line small{color:#697a75;display:block}.fi-move-toolbar{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}.fi-move-table{width:100%;border-collapse:separate;border-spacing:0 8px}.fi-move-table th{font-size:12px;color:#65736f;text-align:right;padding:7px}.fi-move-table td{background:#fbfefd;border-top:1px solid #e4eee9;border-bottom:1px solid #e4eee9;padding:10px;vertical-align:middle}.fi-move-table td:first-child{border-right:1px solid #e4eee9;border-radius:0 14px 14px 0}.fi-move-table td:last-child{border-left:1px solid #e4eee9;border-radius:14px 0 0 14px}.fi-move-badge{display:inline-flex;border-radius:999px;padding:5px 9px;font-weight:900;font-size:12px;background:#eef6f3;color:#064234}.fi-move-badge.warn{background:#fff4d8;color:#8a5b00}.fi-move-badge.bad{background:#fde8e8;color:#a42020}.fi-move-badge.ok{background:#ddf7e8;color:#11794a}.fi-move-actions{display:flex;gap:7px;flex-wrap:wrap}.fi-move-actions button{padding:8px 10px;border-radius:12px}.fi-move-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:999999;display:flex;align-items:center;justify-content:center;padding:18px}.fi-move-modal.hidden{display:none}.fi-move-panel{background:#fff;border-radius:24px;box-shadow:0 24px 70px rgba(0,0,0,.24);width:min(1080px,96vw);max-height:90vh;overflow:auto;padding:16px;direction:rtl}.fi-move-head{display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid #e4eee9;padding-bottom:10px;margin-bottom:12px}.fi-move-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px}.fi-move-box{background:#fbfefd;border:1px solid #e4eee9;border-radius:16px;padding:10px}.fi-move-box small{display:block;color:#697a75}.fi-move-box b{display:block;color:#063d31;margin-top:4px}.fi-cost-choice{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.fi-cost-choice label{background:#fff;border:1px solid #dce9e4;border-radius:14px;padding:8px;cursor:pointer;font-size:12px;text-align:center}.fi-cost-choice input{width:auto;margin-inline-end:4px}.fi-cost-target.hidden{display:none!important}@media(max-width:1050px){.fi-move-layout,.fi-move-grid2,.fi-move-grid3,.fi-move-summary{grid-template-columns:1fr}.fi-move-line{grid-template-columns:1fr 1fr}.fi-move-toolbar{grid-template-columns:1fr}}
    `;
    document.head.appendChild(st);
  }
  function costChoiceHTML(name, val='FM'){
    return `<div class="fi-cost-choice"><label><input type="radio" name="${name}" value="FM" ${val==='FM'?'checked':''} onchange="financeV323CostChoiceChange()"> FM / مشروع</label><label><input type="radio" name="${name}" value="CN" ${val==='CN'?'checked':''} onchange="financeV323CostChoiceChange()"> CN / أوردر</label><label><input type="radio" name="${name}" value="GENERAL" ${val==='GENERAL'?'checked':''} onchange="financeV323CostChoiceChange()"> GENERAL</label></div>`;
  }
  function selectedCost(){ return document.querySelector('input[name="moveLineCostType"]:checked')?.value||'FM'; }
  function renderLineDrafts(){
    const box=$('moveLinesDraft'); if(!box) return;
    box.innerHTML=movementLines.map((l,i)=>`<div class="fi-move-line"><div><b>${esc(itemName(l.item_id))}</b><small>كود: ${esc(itemCode(l.item_id))}</small></div><div><small>الكمية</small><b>${n(l.qty)}</b></div><div><small>الحالة</small><b>${esc(l.type)}</b></div><div><small>التكلفة</small><b>${esc(l.cost_type)}</b></div><div><small>الوجهة</small><b>${esc(costTarget(l))}</b></div><button class="danger" onclick="financeV323RemoveMoveLine(${i})">حذف</button></div>`).join('') || '<div class="fi-move-help">لم تتم إضافة أصناف للحركة بعد. أضف صنفًا أو أكثر، وحدد لكل صنف هل التكلفة FM أو CN أو GENERAL.</div>';
  }
  function renderMovements(){
    ensureStyle();
    const body=$('fiBody_movements'); if(!body) return;
    const groups=groupsFiltered();
    const isEdit=!!editBatchId;
    body.innerHTML=`<div class="fi-move-layout"><div class="fi-move-card"><h3 style="margin-top:0;color:#063d31">سجل حركة المخزون</h3><div class="fi-move-toolbar"><select id="moveFilterType" onchange="financeV312RenderMovements()"><option value="">كل الحركات</option>${moveTypes.map(t=>`<option ${($('moveFilterType')?.value||'')===t?'selected':''}>${t}</option>`).join('')}</select><select id="moveFilterStatus" onchange="financeV312RenderMovements()"><option value="">كل الحالات</option>${statuses.map(s=>`<option ${($('moveFilterStatus')?.value||'')===s?'selected':''}>${s}</option>`).join('')}</select></div><table class="fi-move-table"><thead><tr><th>رقم الحركة</th><th>التاريخ</th><th>المشرف</th><th>الأصناف</th><th>وجهة التكلفة</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>${groups.map(g=>{const cost=[...new Set(g.lines.map(l=>`${l.cost_type||'GENERAL'}: ${costTarget(l)}`))].join('<br>'); const cls=g.status==='مرفوض'?'bad':g.status==='بانتظار'?'warn':'ok'; return `<tr><td><b>${esc(g.batch_no)}</b></td><td>${esc(g.date||'')}</td><td>${esc(g.supervisor_name||'-')}</td><td>${g.lines.length} صنف<br><small>${esc(g.lines.map(l=>itemName(l.item_id)).slice(0,3).join('، '))}${g.lines.length>3?'...':''}</small></td><td>${cost||'-'}</td><td><span class="fi-move-badge ${cls}">${esc(g.status||'')}</span></td><td><div class="fi-move-actions"><button class="light" onclick="financeV323ViewMoveBatch('${g.id}')">عرض</button><button onclick="financeV323EditMoveBatch('${g.id}')">تعديل</button></div></td></tr>`}).join('')||'<tr><td colspan="7"><div class="fi-move-help">لا توجد حركات مخزون.</div></td></tr>'}</tbody></table></div><div class="fi-move-card"><h3 style="margin-top:0;color:#063d31">${isEdit?'تعديل حركة مخزون':'تسجيل حركة مخزون'}</h3><div class="fi-move-help">حركة المخزون تشغيلية: لا يوجد ضريبة هنا. اختر مركز التكلفة لكل صنف عند إنشاء الحركة.</div><div class="fi-move-form"><div class="fi-move-grid2"><div><label>التاريخ</label><input type="date" id="moveDate" value="${today()}"></div><div><label>حالة الاعتماد</label><select id="moveStatus">${statuses.map(s=>`<option>${s}</option>`).join('')}</select></div></div><label>المشرف</label><select id="moveSupervisor">${supervisorOptions('')}</select><label>ملاحظات الحركة العامة</label><textarea id="moveNotes" placeholder="ملاحظات عامة على الحركة"></textarea><div class="fi-move-line-form"><h4 style="margin:0;color:#063d31">إضافة صنف للحركة</h4><div class="fi-move-grid2"><div><label>المنتج</label><select id="moveLineItem">${itemOptions()}</select></div><div><label>الكمية</label><input type="number" id="moveLineQty" min="0" step="0.01"></div></div><div class="fi-move-grid2"><div><label>نوع استخدام الصنف</label><select id="moveLineType">${moveTypes.map(t=>`<option>${t}</option>`).join('')}</select></div><div><label>خيار التكلفة</label>${costChoiceHTML('moveLineCostType','FM')}</div></div><div id="moveCostFM" class="fi-cost-target"><label>المشروع</label><select id="moveLineProject">${projectOptions('')}</select></div><div id="moveCostCN" class="fi-cost-target hidden"><label>رقم الأوردر</label><input id="moveLineOrder" placeholder="مثال: ORD3001"></div><div id="moveCostGENERAL" class="fi-cost-target hidden"><label>ملاحظة GENERAL</label><input id="moveLineGeneral" placeholder="مثال: مصروف عام / سيارة / مكتب"></div><label>ملاحظات الصنف</label><input id="moveLineNotes" placeholder="مثال: تم تركيبه في البيسمنت"><div class="fi-move-actions"><button class="light" onclick="financeV323AddMoveLine()">إضافة الصنف للحركة</button></div></div><h4 style="color:#063d31">الأصناف داخل الحركة</h4><div id="moveLinesDraft" class="fi-move-lines"></div><div class="fi-move-actions"><button onclick="financeV312SaveMovement()">${isEdit?'حفظ تعديل الحركة':'حفظ الحركة'}</button><button class="light" onclick="financeV323ClearMoveForm()">تفريغ</button></div></div></div></div>`;
    renderLineDrafts();
    window.financeV323CostChoiceChange();
  }
  function fillEditHeader(group){
    setTimeout(()=>{
      if($('moveDate')) $('moveDate').value=group.date||today();
      if($('moveStatus')) $('moveStatus').value=group.status||'بانتظار';
      if($('moveSupervisor')) $('moveSupervisor').value=group.supervisor_id||'';
      if($('moveNotes')) $('moveNotes').value=group.notes||'';
    },0);
  }
  window.financeV323CostChoiceChange=function(){
    const val=selectedCost();
    ['FM','CN','GENERAL'].forEach(t=>{ const el=$('moveCost'+t); if(el) el.classList.toggle('hidden',val!==t); });
  };
  window.financeV323AddMoveLine=function(){
    const item_id=$('moveLineItem')?.value||'', qty=n($('moveLineQty')?.value), type=$('moveLineType')?.value||'صرف من مشرف', cost_type=selectedCost();
    if(!item_id) return alert('اختر المنتج');
    if(!qty) return alert('اكتب الكمية');
    const line={item_id,qty,type,cost_type,project_ids:[],order_no:'',general_note:'',notes:$('moveLineNotes')?.value||''};
    if(cost_type==='FM'){
      const pid=$('moveLineProject')?.value||''; if(!pid) return alert('اختر المشروع لتكلفة FM'); line.project_ids=[pid];
    } else if(cost_type==='CN'){
      const ord=$('moveLineOrder')?.value||''; if(!ord) return alert('اكتب رقم الأوردر لتكلفة CN'); line.order_no=ord;
    } else {
      line.general_note=$('moveLineGeneral')?.value||'';
    }
    movementLines.push(line);
    ['moveLineItem','moveLineQty','moveLineOrder','moveLineGeneral','moveLineNotes'].forEach(id=>{ if($(id)) $(id).value=''; });
    renderLineDrafts();
  };
  window.financeV323RemoveMoveLine=function(i){ movementLines.splice(i,1); renderLineDrafts(); };
  window.financeV323ClearMoveForm=function(){ movementLines=[]; editBatchId=''; renderMovements(); };
  function getGroup(id){ return groupMoves().find(g=>String(g.id)===String(id)); }
  function reverseOldBatch(batchId){
    const moves=parse(LS.moves); moves.filter(m=>String(m.batch_id||m.id)===String(batchId)).forEach(m=>{ if(shouldAffect(m)) updateStock(m.item_id,n(m.qty)); });
  }
  function applyNewBatch(newMoves){ newMoves.forEach(m=>{ if(shouldAffect(m)) updateStock(m.item_id,-n(m.qty)); }); }
  window.financeV312SaveMovement=function(){
    if(!movementLines.length) return alert('أضف صنفًا واحدًا على الأقل للحركة');
    const sid=$('moveSupervisor')?.value||'', sname=supName(sid), status=$('moveStatus')?.value||'بانتظار', date=$('moveDate')?.value||today(), notes=$('moveNotes')?.value||'';
    const batch_id=editBatchId||uid(), batch_no='MOV-'+String(batch_id).slice(-6).toUpperCase();
    const moves=parse(LS.moves);
    if(editBatchId){ reverseOldBatch(editBatchId); }
    const kept=editBatchId?moves.filter(m=>String(m.batch_id||m.id)!==String(editBatchId)):moves;
    const newMoves=movementLines.map((l,idx)=>{
      const amount=n(l.qty)*itemCost(l.item_id);
      return {id:uid(),batch_id,batch_no,line_no:idx+1,created_at:new Date().toISOString(),date,type:l.type,supervisor_id:sid,supervisor_name:sname,item_id:l.item_id,qty:n(l.qty),status,cost_type:l.cost_type,project_ids:l.project_ids||[],order_no:l.order_no||'',general_note:l.general_note||'',reason:l.notes||'',notes:l.notes||'',batch_notes:notes,amount,before:amount,vat:0,after:amount};
    });
    save(LS.moves,[...kept,...newMoves]);
    applyNewBatch(newMoves);
    movementLines=[]; editBatchId='';
    alert('تم حفظ حركة المخزون');
    renderMovements();
    if(typeof window.financeV312RenderItems==='function') setTimeout(()=>{},0);
  };
  window.financeV323ViewMoveBatch=function(id){
    const g=getGroup(id); if(!g) return;
    const total=g.lines.reduce((a,l)=>a+n(l.amount),0);
    const rows=g.lines.map(l=>`<tr><td><b>${esc(itemName(l.item_id))}</b><br><small>كود: ${esc(itemCode(l.item_id))}</small></td><td>${n(l.qty)}</td><td>${esc(l.type)}</td><td>${esc(l.cost_type||'')}</td><td>${esc(costTarget(l))}</td><td>${money(l.amount)}</td><td>${esc(l.notes||l.reason||'-')}</td></tr>`).join('');
    const modal=document.createElement('div'); modal.className='fi-move-modal'; modal.id='fiMoveModalV323'; modal.innerHTML=`<div class="fi-move-panel"><div class="fi-move-head"><h3 style="margin:0;color:#063d31">عرض حركة مخزون ${esc(g.batch_no)}</h3><div class="fi-move-actions"><button onclick="financeV323EditMoveBatch('${esc(g.id)}')">تعديل الحركة</button><button class="danger" onclick="document.getElementById('fiMoveModalV323')?.remove()">إغلاق</button></div></div><div class="fi-move-summary"><div class="fi-move-box"><small>التاريخ</small><b>${esc(g.date||'')}</b></div><div class="fi-move-box"><small>المشرف</small><b>${esc(g.supervisor_name||'-')}</b></div><div class="fi-move-box"><small>الحالة</small><b>${esc(g.status||'')}</b></div><div class="fi-move-box"><small>إجمالي التكلفة</small><b>${money(total)}</b></div></div><table class="fi-move-table"><thead><tr><th>الصنف</th><th>الكمية</th><th>الحالة/الاستخدام</th><th>مركز التكلفة</th><th>المشروع/الأوردر/العام</th><th>التكلفة</th><th>ملاحظات</th></tr></thead><tbody>${rows}</tbody></table><div class="fi-move-box"><small>ملاحظات الحركة</small><b>${esc(g.notes||'-')}</b></div></div>`;
    document.querySelectorAll('#fiMoveModalV323').forEach(x=>x.remove()); document.body.appendChild(modal);
  };
  window.financeV323EditMoveBatch=function(id){
    const g=getGroup(id); if(!g) return;
    document.getElementById('fiMoveModalV323')?.remove();
    editBatchId=g.id;
    movementLines=g.lines.map(l=>({item_id:l.item_id,qty:n(l.qty),type:l.type||'صرف من مشرف',cost_type:l.cost_type||'FM',project_ids:l.project_ids||[],order_no:l.order_no||'',general_note:l.general_note||'',notes:l.notes||l.reason||''}));
    renderMovements(); fillEditHeader(g); renderLineDrafts();
  };
  const oldCostRows=window.financeV312RenderCosts;
  window.financeV312RenderMovements=renderMovements;
  const oldTab=window.financeV312Tab;
  window.financeV312Tab=function(tab,btn){ const r=oldTab?oldTab.apply(this,arguments):undefined; if(tab==='movements') setTimeout(renderMovements,80); return r; };
  document.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('.fi-tabs button'); if(b&&(b.textContent||'').includes('حركة المخزون')) setTimeout(renderMovements,120); },true);
  setTimeout(()=>{ const body=$('fiBody_movements'); if(body&&body.classList.contains('active')) renderMovements(); },300);
})();

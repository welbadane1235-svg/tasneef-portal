/* TASNEEF v324 - Inventory movement: distribute one product quantity across multiple projects / orders / general cost targets */
(function(){
  'use strict';
  if(window.__financeV324MoveDistribution) return;
  window.__financeV324MoveDistribution = true;

  const LS={items:'tasneef_v312_items',moves:'tasneef_v312_moves'};
  const $=id=>document.getElementById(id);
  const parse=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')||[]}catch(_){return[]}};
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const n=v=>Number(String(v??'').replace(/,/g,''))||0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const today=()=>new Date().toISOString().slice(0,10);
  const money=v=>n(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';
  const moveTypes=['صرف','استهلاك','هدر','تالف','سكراب'];
  const statuses=['بانتظار','معتمد','مرفوض','تم الصرف'];
  let draftLines=[];
  let draftAllocations=[];
  let editBatchId='';

  function projects(){ return Array.isArray(window.data?.projects)?window.data.projects:[]; }
  function supervisors(){ return Array.isArray(window.data?.supervisors)?window.data.supervisors:[]; }
  function projectName(id){ const p=projects().find(x=>String(x.id)===String(id)); return p?(p.name||p.project_name||p.title||id):id; }
  function supName(id){ const s=supervisors().find(x=>String(x.id)===String(id)); return s?(s.full_name||s.name||s.username||id):''; }
  function item(id){ return parse(LS.items).find(x=>String(x.id)===String(id))||{}; }
  function itemName(id){ const it=item(id); return it.name||'-'; }
  function itemCode(id){ const it=item(id); return it.code||it.company_code||'-'; }
  function itemUnit(id){ return item(id).unit||'حبة'; }
  function itemCost(id){ const it=item(id); return n(it.price_after_vat||it.price_after||it.price_included||it.price_before||it.price||0); }
  function itemOptions(val=''){ return '<option value="">اختر المنتج</option>'+parse(LS.items).map(i=>`<option value="${esc(i.id)}" ${String(val)===String(i.id)?'selected':''}>${esc([i.name,i.code,i.company_code].filter(Boolean).join(' | '))}</option>`).join(''); }
  function projectOptions(val=''){ return '<option value="">اختر المشروع</option>'+projects().map(p=>`<option value="${esc(p.id)}" ${String(val)===String(p.id)?'selected':''}>${esc(p.name||p.project_name||p.title||p.id)}</option>`).join(''); }
  function supervisorOptions(val=''){ return '<option value="">اختر المشرف</option>'+supervisors().map(s=>`<option value="${esc(s.id)}" ${String(val)===String(s.id)?'selected':''}>${esc(s.full_name||s.name||s.username||s.id)}</option>`).join(''); }
  function shouldAffect(m){ return ['معتمد','تم الصرف'].includes(m.status)||['سكراب','صرف','استهلاك','هدر','تالف'].includes(m.type); }
  function updateStock(itemId,delta){ const items=parse(LS.items); const it=items.find(x=>String(x.id)===String(itemId)); if(it){ it.qty=n(it.qty)+n(delta); it.updated_at=new Date().toISOString(); save(LS.items,items); } }
  function costTarget(line){
    const t=line.cost_type||'FM';
    if(t==='FM') return projectName(line.project_id || (line.project_ids||[])[0] || '');
    if(t==='CN') return line.order_no||'-';
    return line.general_note||line.notes||'عام';
  }
  function sourceLineKey(m){ return m.parent_line_id || m.source_line_id || (m.item_id+'_'+(m.type||'')+'_'+(m.line_no||'')); }

  function ensureStyle(){
    if($('styleFinanceV324Movement')) return;
    const st=document.createElement('style'); st.id='styleFinanceV324Movement'; st.textContent=`
      .fi-v324-layout{display:grid;grid-template-columns:minmax(0,1fr) 460px;gap:14px;align-items:start;direction:rtl}.fi-v324-card{background:#fff;border:1px solid #dfece7;border-radius:22px;padding:15px;box-shadow:0 8px 28px rgba(6,61,49,.045)}.fi-v324-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.fi-v324-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.fi-v324-form{display:grid;gap:10px}.fi-v324-help{background:#fffaf0;border:1px dashed #d9b861;border-radius:14px;padding:10px;color:#6d5400;line-height:1.7;font-size:13px}.fi-v324-sub{border:1px dashed #bad8ce;background:#fbfefd;border-radius:18px;padding:12px;display:grid;gap:10px}.fi-v324-table{width:100%;border-collapse:separate;border-spacing:0 8px}.fi-v324-table th{font-size:12px;color:#65736f;text-align:right;padding:7px}.fi-v324-table td{background:#fbfefd;border-top:1px solid #e4eee9;border-bottom:1px solid #e4eee9;padding:10px;vertical-align:middle}.fi-v324-table td:first-child{border-right:1px solid #e4eee9;border-radius:0 14px 14px 0}.fi-v324-table td:last-child{border-left:1px solid #e4eee9;border-radius:14px 0 0 14px}.fi-v324-badge{display:inline-flex;border-radius:999px;padding:5px 9px;font-weight:900;font-size:12px;background:#eef6f3;color:#064234}.fi-v324-badge.warn{background:#fff4d8;color:#8a5b00}.fi-v324-badge.bad{background:#fde8e8;color:#a42020}.fi-v324-badge.ok{background:#ddf7e8;color:#11794a}.fi-v324-actions{display:flex;gap:7px;flex-wrap:wrap}.fi-v324-actions button{padding:8px 10px;border-radius:12px}.fi-v324-draft-line{border:1px solid #dfece7;border-radius:18px;background:#fbfefd;padding:10px;display:grid;gap:8px}.fi-v324-draft-line h4{margin:0;color:#063d31}.fi-v324-draft-dist{display:grid;grid-template-columns:.7fr .7fr .9fr 1fr auto;gap:7px;align-items:center;background:#fff;border:1px solid #e6f0ec;border-radius:13px;padding:7px}.fi-v324-meter{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.fi-v324-meter span{border-radius:999px;padding:5px 9px;background:#eef6f3;font-weight:900;color:#063d31}.fi-v324-meter .bad{background:#fde8e8;color:#a42020}.fi-v324-meter .warn{background:#fff4d8;color:#8a5b00}.fi-v324-choice{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.fi-v324-choice label{background:#fff;border:1px solid #dce9e4;border-radius:14px;padding:8px;cursor:pointer;font-size:12px;text-align:center}.fi-v324-choice input{width:auto;margin-inline-end:4px}.fi-v324-cost-target.hidden{display:none!important}.fi-v324-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:999999;display:flex;align-items:center;justify-content:center;padding:18px}.fi-v324-panel{background:#fff;border-radius:24px;box-shadow:0 24px 70px rgba(0,0,0,.24);width:min(1120px,96vw);max-height:90vh;overflow:auto;padding:16px;direction:rtl}.fi-v324-head{display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid #e4eee9;padding-bottom:10px;margin-bottom:12px}.fi-v324-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px}.fi-v324-box{background:#fbfefd;border:1px solid #e4eee9;border-radius:16px;padding:10px}.fi-v324-box small{display:block;color:#697a75}.fi-v324-box b{display:block;color:#063d31;margin-top:4px}.fi-v324-toolbar{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}@media(max-width:1050px){.fi-v324-layout,.fi-v324-grid2,.fi-v324-grid3,.fi-v324-summary{grid-template-columns:1fr}.fi-v324-draft-dist{grid-template-columns:1fr 1fr}.fi-v324-toolbar{grid-template-columns:1fr}}
    `;
    document.head.appendChild(st);
  }

  function selectedCost(){ return document.querySelector('input[name="v324AllocCostType"]:checked')?.value||'FM'; }
  window.financeV324CostChoiceChange=function(){ const val=selectedCost(); ['FM','CN','GENERAL'].forEach(t=>{ const el=$('v324Cost'+t); if(el) el.classList.toggle('hidden',val!==t); }); };

  function renderAllocDraft(){
    const box=$('v324AllocDraft'); if(!box) return;
    const total=draftAllocations.reduce((a,x)=>a+n(x.qty),0);
    const mainQty=n($('v324LineQty')?.value);
    const diff=mainQty-total;
    box.innerHTML = `<div class="fi-v324-meter"><span>المطلوب توزيعه: ${mainQty}</span><span>الموزع: ${total}</span><span class="${diff<0?'bad':diff>0?'warn':''}">المتبقي: ${diff}</span></div>`+
    (draftAllocations.map((a,i)=>`<div class="fi-v324-draft-dist"><b>${esc(a.cost_type)}</b><span>${esc(costTarget(a))}</span><span>${n(a.qty)} ${esc(itemUnit($('v324LineItem')?.value))}</span><small>${esc(a.notes||'-')}</small><button class="danger" onclick="financeV324RemoveAlloc(${i})">حذف</button></div>`).join('') || '<div class="fi-v324-help">أضف توزيع الكمية على مشروع أو أوردر أو GENERAL.</div>');
  }
  window.financeV324RemoveAlloc=function(i){ draftAllocations.splice(i,1); renderAllocDraft(); };
  window.financeV324AddAllocation=function(){
    const qty=n($('v324AllocQty')?.value), cost_type=selectedCost();
    if(!qty) return alert('اكتب كمية التوزيع');
    const a={qty,cost_type,project_id:'',order_no:'',general_note:'',notes:$('v324AllocNotes')?.value||''};
    if(cost_type==='FM'){
      const pid=$('v324AllocProject')?.value||''; if(!pid) return alert('اختر المشروع'); a.project_id=pid;
    } else if(cost_type==='CN'){
      const ord=$('v324AllocOrder')?.value||''; if(!ord) return alert('اكتب رقم الأوردر'); a.order_no=ord;
    } else {
      a.general_note=$('v324AllocGeneral')?.value||'عام';
    }
    draftAllocations.push(a);
    ['v324AllocQty','v324AllocOrder','v324AllocGeneral','v324AllocNotes'].forEach(id=>{if($(id))$(id).value='';});
    renderAllocDraft();
  };
  window.financeV324AddProductLine=function(){
    const item_id=$('v324LineItem')?.value||'', qty=n($('v324LineQty')?.value), type=$('v324LineType')?.value||'صرف';
    if(!item_id) return alert('اختر المنتج');
    if(!qty) return alert('اكتب الكمية الإجمالية للمنتج');
    const distributed=draftAllocations.reduce((a,x)=>a+n(x.qty),0);
    if(distributed!==qty) return alert(`يجب أن يساوي مجموع التوزيع كمية المنتج. الكمية ${qty} والموزع ${distributed}`);
    draftLines.push({line_uid:uid(),item_id,qty,type,allocations:draftAllocations.map(x=>({...x}))});
    draftAllocations=[];
    ['v324LineItem','v324LineQty'].forEach(id=>{if($(id))$(id).value='';});
    renderAllocDraft(); renderDraftLines();
  };
  window.financeV324RemoveProductLine=function(i){ draftLines.splice(i,1); renderDraftLines(); };

  function renderDraftLines(){
    const box=$('v324DraftLines'); if(!box) return;
    box.innerHTML = draftLines.map((l,i)=>`<div class="fi-v324-draft-line"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><h4>${esc(itemName(l.item_id))}</h4><button class="danger" onclick="financeV324RemoveProductLine(${i})">حذف المنتج</button></div><div class="fi-v324-meter"><span>الكمية: ${n(l.qty)} ${esc(itemUnit(l.item_id))}</span><span>الحالة: ${esc(l.type)}</span><span>التكلفة: ${money(n(l.qty)*itemCost(l.item_id))}</span></div>${l.allocations.map(a=>`<div class="fi-v324-draft-dist"><b>${esc(a.cost_type)}</b><span>${esc(costTarget(a))}</span><span>${n(a.qty)} ${esc(itemUnit(l.item_id))}</span><small>${esc(a.notes||'-')}</small><span>${money(n(a.qty)*itemCost(l.item_id))}</span></div>`).join('')}</div>`).join('') || '<div class="fi-v324-help">لم تتم إضافة منتجات للحركة بعد.</div>';
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
  function reverseOldBatch(batchId){ parse(LS.moves).filter(m=>String(m.batch_id||m.id)===String(batchId)).forEach(m=>{ if(shouldAffect(m)) updateStock(m.item_id,n(m.qty)); }); }
  function applyNewBatch(newMoves){ newMoves.forEach(m=>{ if(shouldAffect(m)) updateStock(m.item_id,-n(m.qty)); }); }

  function renderMovements(){
    ensureStyle();
    const body=$('fiBody_movements'); if(!body) return;
    const groups=groupsFiltered();
    body.innerHTML=`<div class="fi-v324-layout"><div class="fi-v324-card"><h3 style="margin-top:0;color:#063d31">سجل حركة المخزون</h3><div class="fi-v324-toolbar"><select id="moveFilterType" onchange="financeV312RenderMovements()"><option value="">كل الحركات</option>${moveTypes.map(t=>`<option ${($('moveFilterType')?.value||'')===t?'selected':''}>${t}</option>`).join('')}</select><select id="moveFilterStatus" onchange="financeV312RenderMovements()"><option value="">كل الحالات</option>${statuses.map(s=>`<option ${($('moveFilterStatus')?.value||'')===s?'selected':''}>${s}</option>`).join('')}</select></div><table class="fi-v324-table"><thead><tr><th>رقم الحركة</th><th>التاريخ</th><th>المشرف</th><th>المنتجات</th><th>التوزيع</th><th>التكلفة</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>${groups.map(g=>{const cls=g.status==='مرفوض'?'bad':g.status==='بانتظار'?'warn':'ok'; const prod=[...new Set(g.lines.map(l=>itemName(l.item_id)))]; const dist=g.lines.slice(0,4).map(l=>`${l.cost_type||'FM'}: ${costTarget(l)} (${n(l.qty)})`).join('<br>'); const total=g.lines.reduce((a,l)=>a+n(l.amount),0); return `<tr><td><b>${esc(g.batch_no)}</b></td><td>${esc(g.date||'')}</td><td>${esc(g.supervisor_name||'-')}</td><td>${prod.length} منتج<br><small>${esc(prod.slice(0,3).join('، '))}${prod.length>3?'...':''}</small></td><td>${dist}${g.lines.length>4?'<br>...':''}</td><td>${money(total)}</td><td><span class="fi-v324-badge ${cls}">${esc(g.status||'')}</span></td><td><div class="fi-v324-actions"><button class="light" onclick="financeV324ViewMoveBatch('${g.id}')">عرض</button><button onclick="financeV324EditMoveBatch('${g.id}')">تعديل</button></div></td></tr>`}).join('')||'<tr><td colspan="8"><div class="fi-v324-help">لا توجد حركات مخزون.</div></td></tr>'}</tbody></table></div><div class="fi-v324-card"><h3 style="margin-top:0;color:#063d31">${editBatchId?'تعديل حركة مخزون':'تسجيل حركة مخزون'}</h3><div class="fi-v324-help">اختر المنتج والكمية الإجمالية، ثم وزّع نفس الكمية على مشروع أو أكثر / أوردر / عام. يمنع الحفظ إذا التوزيع لا يساوي الكمية.</div><div class="fi-v324-form"><div class="fi-v324-grid2"><div><label>التاريخ</label><input type="date" id="moveDate" value="${today()}"></div><div><label>حالة الاعتماد</label><select id="moveStatus">${statuses.map(s=>`<option>${s}</option>`).join('')}</select></div></div><label>المشرف</label><select id="moveSupervisor">${supervisorOptions('')}</select><label>ملاحظات الحركة العامة</label><textarea id="moveNotes" placeholder="ملاحظات عامة على الحركة"></textarea><div class="fi-v324-sub"><h4 style="margin:0;color:#063d31">إضافة منتج وتوزيعه</h4><div class="fi-v324-grid3"><div><label>المنتج</label><select id="v324LineItem" onchange="renderAllocDraft && renderAllocDraft()">${itemOptions()}</select></div><div><label>الكمية الإجمالية</label><input type="number" id="v324LineQty" min="0" step="0.01" oninput="financeV324RefreshAllocDraft()"></div><div><label>نوع استخدام المنتج</label><select id="v324LineType">${moveTypes.map(t=>`<option>${t}</option>`).join('')}</select></div></div><div class="fi-v324-sub" style="background:#fff"><h4 style="margin:0;color:#063d31">توزيع كمية المنتج</h4><div><label>خيار التكلفة لهذا التوزيع</label><div class="fi-v324-choice"><label><input type="radio" name="v324AllocCostType" value="FM" checked onchange="financeV324CostChoiceChange()"> FM / مشروع</label><label><input type="radio" name="v324AllocCostType" value="CN" onchange="financeV324CostChoiceChange()"> CN / أوردر</label><label><input type="radio" name="v324AllocCostType" value="GENERAL" onchange="financeV324CostChoiceChange()"> GENERAL</label></div></div><div class="fi-v324-grid2"><div><label>كمية التوزيع</label><input type="number" id="v324AllocQty" min="0" step="0.01"></div><div id="v324CostFM" class="fi-v324-cost-target"><label>المشروع</label><select id="v324AllocProject">${projectOptions('')}</select></div><div id="v324CostCN" class="fi-v324-cost-target hidden"><label>رقم الأوردر</label><input id="v324AllocOrder" placeholder="مثال: ORD3001"></div><div id="v324CostGENERAL" class="fi-v324-cost-target hidden"><label>ملاحظة GENERAL</label><input id="v324AllocGeneral" placeholder="مثال: مخزن / سيارة / عام"></div></div><label>ملاحظات التوزيع</label><input id="v324AllocNotes" placeholder="مثال: تركيب في البيسمنت"><div class="fi-v324-actions"><button class="light" onclick="financeV324AddAllocation()">إضافة توزيع</button></div><div id="v324AllocDraft"></div></div><div class="fi-v324-actions"><button class="light" onclick="financeV324AddProductLine()">إضافة المنتج للحركة</button></div></div><h4 style="color:#063d31;margin-bottom:0">المنتجات داخل الحركة</h4><div id="v324DraftLines"></div><div class="fi-v324-actions"><button onclick="financeV324SaveMovement()">${editBatchId?'حفظ تعديل الحركة':'حفظ الحركة'}</button><button class="light" onclick="financeV324ClearMoveForm()">تفريغ</button></div></div></div></div>`;
    renderAllocDraft(); renderDraftLines(); window.financeV324CostChoiceChange();
  }
  window.financeV324RefreshAllocDraft=renderAllocDraft;
  window.financeV324ClearMoveForm=function(){ draftLines=[]; draftAllocations=[]; editBatchId=''; renderMovements(); };

  window.financeV324SaveMovement=function(){
    if(!draftLines.length) return alert('أضف منتجًا واحدًا على الأقل للحركة');
    const sid=$('moveSupervisor')?.value||'', sname=supName(sid), status=$('moveStatus')?.value||'بانتظار', date=$('moveDate')?.value||today(), notes=$('moveNotes')?.value||'';
    const batch_id=editBatchId||uid(), batch_no='MOV-'+String(batch_id).slice(-6).toUpperCase();
    const old=parse(LS.moves);
    if(editBatchId) reverseOldBatch(editBatchId);
    const kept=editBatchId?old.filter(m=>String(m.batch_id||m.id)!==String(editBatchId)):old;
    const newMoves=[];
    draftLines.forEach((l,lineIdx)=>{
      l.allocations.forEach((a,ai)=>{
        const amount=n(a.qty)*itemCost(l.item_id);
        newMoves.push({id:uid(),batch_id,batch_no,line_no:lineIdx+1,alloc_no:ai+1,parent_line_id:l.line_uid,created_at:new Date().toISOString(),date,type:l.type,supervisor_id:sid,supervisor_name:sname,item_id:l.item_id,qty:n(a.qty),line_total_qty:n(l.qty),status,cost_type:a.cost_type,project_id:a.project_id||'',project_ids:a.project_id?[a.project_id]:[],order_no:a.order_no||'',general_note:a.general_note||'',reason:a.notes||'',notes:a.notes||'',batch_notes:notes,amount,before:amount,vat:0,after:amount,distribution:true});
      });
    });
    save(LS.moves,[...kept,...newMoves]);
    applyNewBatch(newMoves);
    draftLines=[]; draftAllocations=[]; editBatchId='';
    alert('تم حفظ حركة المخزون وتوزيع التكلفة');
    renderMovements();
  };

  window.financeV324ViewMoveBatch=function(id){
    const g=groupMoves().find(x=>String(x.id)===String(id)); if(!g) return;
    const total=g.lines.reduce((a,l)=>a+n(l.amount),0);
    const linesBy=new Map();
    g.lines.forEach(m=>{ const key=sourceLineKey(m); if(!linesBy.has(key)) linesBy.set(key,[]); linesBy.get(key).push(m); });
    const productBlocks=[...linesBy.values()].map(arr=>{
      const first=arr[0], q=arr.reduce((a,x)=>a+n(x.qty),0), cost=arr.reduce((a,x)=>a+n(x.amount),0);
      return `<div class="fi-v324-box" style="margin-bottom:10px"><h4 style="margin:0 0 8px;color:#063d31">${esc(itemName(first.item_id))} <small style="color:#667">${esc(itemCode(first.item_id))}</small></h4><div class="fi-v324-meter"><span>الكمية الموزعة: ${q} ${esc(itemUnit(first.item_id))}</span><span>الحالة: ${esc(first.type)}</span><span>تكلفة المنتج: ${money(cost)}</span></div><table class="fi-v324-table"><thead><tr><th>مركز التكلفة</th><th>المشروع/الأوردر/العام</th><th>الكمية</th><th>التكلفة</th><th>ملاحظات</th></tr></thead><tbody>${arr.map(a=>`<tr><td>${esc(a.cost_type||'FM')}</td><td>${esc(costTarget(a))}</td><td>${n(a.qty)} ${esc(itemUnit(a.item_id))}</td><td>${money(a.amount)}</td><td>${esc(a.notes||a.reason||'-')}</td></tr>`).join('')}</tbody></table></div>`;
    }).join('');
    const modal=document.createElement('div'); modal.className='fi-v324-modal'; modal.id='fiMoveModalV324'; modal.innerHTML=`<div class="fi-v324-panel"><div class="fi-v324-head"><h3 style="margin:0;color:#063d31">عرض حركة مخزون ${esc(g.batch_no)}</h3><div class="fi-v324-actions"><button onclick="financeV324EditMoveBatch('${esc(g.id)}')">تعديل الحركة</button><button class="danger" onclick="document.getElementById('fiMoveModalV324')?.remove()">إغلاق</button></div></div><div class="fi-v324-summary"><div class="fi-v324-box"><small>التاريخ</small><b>${esc(g.date||'')}</b></div><div class="fi-v324-box"><small>المشرف</small><b>${esc(g.supervisor_name||'-')}</b></div><div class="fi-v324-box"><small>الحالة</small><b>${esc(g.status||'')}</b></div><div class="fi-v324-box"><small>إجمالي التكلفة</small><b>${money(total)}</b></div></div>${productBlocks}<div class="fi-v324-box"><small>ملاحظات الحركة</small><b>${esc(g.notes||'-')}</b></div></div>`;
    document.querySelectorAll('#fiMoveModalV324').forEach(x=>x.remove()); document.body.appendChild(modal);
  };

  window.financeV324EditMoveBatch=function(id){
    const g=groupMoves().find(x=>String(x.id)===String(id)); if(!g) return;
    document.getElementById('fiMoveModalV324')?.remove(); document.getElementById('fiMoveModalV323')?.remove();
    editBatchId=g.id; draftLines=[]; draftAllocations=[];
    const by=new Map();
    g.lines.forEach(m=>{ const key=sourceLineKey(m); if(!by.has(key)) by.set(key,[]); by.get(key).push(m); });
    [...by.values()].forEach(arr=>{
      const first=arr[0];
      draftLines.push({line_uid:first.parent_line_id||uid(),item_id:first.item_id,qty:arr.reduce((a,x)=>a+n(x.qty),0),type:first.type||'صرف',allocations:arr.map(a=>({qty:n(a.qty),cost_type:a.cost_type||'FM',project_id:a.project_id||(a.project_ids||[])[0]||'',order_no:a.order_no||'',general_note:a.general_note||'',notes:a.notes||a.reason||''}))});
    });
    renderMovements();
    setTimeout(()=>{ if($('moveDate')) $('moveDate').value=g.date||today(); if($('moveStatus')) $('moveStatus').value=g.status||'بانتظار'; if($('moveSupervisor')) $('moveSupervisor').value=g.supervisor_id||''; if($('moveNotes')) $('moveNotes').value=g.notes||''; renderDraftLines(); },0);
  };

  window.financeV312RenderMovements=renderMovements;
  const oldTab=window.financeV312Tab;
  window.financeV312Tab=function(tab,btn){ const r=oldTab?oldTab.apply(this,arguments):undefined; if(tab==='movements') setTimeout(renderMovements,80); return r; };
  document.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('.fi-tabs button'); if(b&&(b.textContent||'').includes('حركة المخزون')) setTimeout(renderMovements,120); },true);
  setTimeout(()=>{ const body=$('fiBody_movements'); if(body&&body.classList.contains('active')) renderMovements(); },450);
})();

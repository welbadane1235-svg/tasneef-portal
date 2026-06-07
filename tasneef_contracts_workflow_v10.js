(function(){
  'use strict';
  if(window.__tasneefFinanceInventoryActionsV58) return;
  window.__tasneefFinanceInventoryActionsV58 = true;

  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const N = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const A = v => Array.isArray(v) ? v : [];
  const E = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const state = () => window.financeProStateV15 || {items:[],movements:[],projects:[],distribution:[]};
  const otherKey = 'tasneef_finance_other_services_v58';

  function notice(text,type){ try{ if(typeof window.msg==='function') window.msg(text,type); else alert(text); }catch(_){ alert(text); } }
  function money(v){ try{return (Number(v)||0).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';}catch(_){return (Number(v)||0).toFixed(2)+' ر.س';} }
  function readOthers(){ try{ return JSON.parse(localStorage.getItem(otherKey) || '[]') || []; }catch(_){ return []; } }
  function saveOthers(rows){ localStorage.setItem(otherKey, JSON.stringify([...new Set(A(rows).map(S).filter(Boolean))])); }
  function parseMeta(note){ const raw=S(note); if(!raw.startsWith('finance_pro_v15:')) return {}; try{return JSON.parse(raw.replace('finance_pro_v15:',''));}catch(_){return {};} }
  function normType(t){
    const x=S(t);
    const map={'داخل':'in','صرف':'out','خارج':'out','مستهلك':'consume','استهلاك':'consume','مهدور':'waste','هدر':'waste','تالف':'damaged','سكراب':'scrap','مرتجع':'return','مرجع':'return'};
    return map[x] || x;
  }
  function typeLabel(t){ return ({in:'داخل',out:'صرف',consume:'مستهلك',waste:'مهدور',damaged:'تالف',scrap:'سكراب',return:'مرتجع'}[normType(t)] || S(t) || '-'); }
  function distributionType(type, fallback){
    const t=normType(type || fallback);
    return t === 'out' ? 'consume' : t;
  }
  function movementAgeHours(m){ const raw=S(m?.updated_at || m?.created_at || m?.movement_date); const d=new Date(raw.length===10 ? raw+'T00:00:00' : raw); const t=d.getTime(); return Number.isFinite(t) ? ((Date.now()-t)/3600000) : 0; }
  function lockedConsume(m){ return S(m?.movement_type)==='consume' && movementAgeHours(m)>=24; }

  function modal(title,pages){
    const id='finV58_'+Date.now();
    pages=A(pages); const first=pages[0]||{html:''};
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="${id}" style="position:fixed;inset:0;background:rgba(0,35,28,.48);z-index:999999;display:grid;place-items:center;padding:16px" onclick="if(event.target===this)this.remove()"><div class="card" style="width:min(1120px,96vw);max-height:92vh;overflow:auto"><div class="fin-actions" style="justify-content:space-between"><h2>${E(title)}</h2><button class="danger" onclick="document.getElementById('${id}').remove()">إغلاق</button></div><div class="fin-actions">${pages.map((p,i)=>`<button type="button" class="${i?'light':''}" data-tab="${i}">${E(p.title||'صفحة')}</button>`).join('')}</div><div id="${id}_body">${first.html||''}</div></div></div>`);
    const root=$(id);
    root.querySelectorAll('[data-tab]').forEach(btn=>btn.onclick=()=>{ const p=pages[Number(btn.dataset.tab)]||first; root.querySelector(`#${id}_body`).innerHTML=p.html||''; root.querySelectorAll('[data-tab]').forEach(b=>b.classList.add('light')); btn.classList.remove('light'); });
  }

  function movementRows(rows){
    if(!rows.length) return '<tr><td colspan="9">لا توجد بيانات</td></tr>';
    return rows.map(m=>{
      const meta=parseMeta(m.notes);
      const center=A(meta.distribution).map(d=>d.center).filter(Boolean).join(', ') || S(m.cost_center || '-');
      const project=A(meta.distribution).map(d=>d.projectName || d.otherName).filter(Boolean).join(', ') || S(m.project_name || '-');
      return `<tr><td>${E(m.movement_date||S(m.created_at).slice(0,10)||'-')}</td><td>${E(typeLabel(m.movement_type))}</td><td>${N(m.quantity)}</td><td>${E(m.receiver||'-')}</td><td>${E(center)}</td><td>${E(project)}</td><td>${E(m.order_no||'-')}</td><td>${E(m.reason||'-')}</td><td>${money(N(m.quantity)*N(m.unit_cost))}</td></tr>`;
    }).join('');
  }
  function distributionActivityRows(moves){
    const rows=[];
    A(moves).forEach(m=>{
      const meta=parseMeta(m.notes);
      const dist=A(meta.distribution).filter(d=>N(d.qty)>0);
      if(!dist.length) return;
      dist.forEach(d=>{
        rows.push(Object.assign({}, m, {
          __fromDistribution: true,
          movement_type: distributionType(d.type, m.movement_type),
          quantity: N(d.qty),
          cost_center: d.center || m.cost_center,
          project_name: d.projectName || d.otherName || m.project_name,
          order_no: d.orderNo || m.order_no,
          reason: d.note || m.reason,
          notes: ''
        }));
      });
    });
    return rows;
  }

  window.financeProShowProductV15 = function(id){
    let key=S(id);
    try{ key=decodeURIComponent(key); }catch(_){}
    const item=A(state().items).find(i=>
      S(i.id)===key ||
      S(i.product_code)===key ||
      S(i.serial_number)===key ||
      S(i.barcode)===key ||
      S(i.supplier_barcode)===key ||
      S(i.code)===key ||
      S(i.name)===key
    );
    if(!item) return notice('المنتج غير موجود','err');
    const itemKeys=[S(item.id),S(item.name),S(item.product_code),S(item.serial_number),S(item.barcode),S(item.supplier_barcode),S(item.code)].filter(Boolean);
    const moves=A(state().movements).filter(m=>
      itemKeys.includes(S(m.item_id)) ||
      itemKeys.includes(S(m.item_name)) ||
      itemKeys.includes(S(m.product_code)) ||
      itemKeys.includes(S(m.code))
    );
    const distRows=distributionActivityRows(moves);
    const simpleRows=moves.filter(m=>!A(parseMeta(m.notes).distribution).length);
    const activityRows=simpleRows.concat(distRows);
    const inRows=activityRows.filter(m=>normType(m.movement_type)==='in');
    const consumedRows=activityRows.filter(m=>normType(m.movement_type)==='consume');
    const returnRows=activityRows.filter(m=>normType(m.movement_type)==='return');
    const simpleReturnRows=returnRows.filter(m=>!m.__fromDistribution);
    const wasteRows=activityRows.filter(m=>['waste','damaged','scrap'].includes(normType(m.movement_type)));
    const outRows=activityRows.filter(m=>normType(m.movement_type)==='out')
      .concat(consumedRows)
      .concat(wasteRows);
    const sum = rows => rows.reduce((a,m)=>a+N(m.quantity),0);
    const displayBalance = Math.max(0, sum(inRows) - sum(outRows) + sum(simpleReturnRows));
    const img=item.image_url?`<img src="${E(item.image_url)}" style="width:96px;height:96px;object-fit:contain;border:1px solid #d9e7e2;border-radius:16px;background:#fff;padding:4px">`:'';
    modal('بيانات المنتج: '+(item.name||'-'), [
      {title:'الملخص', html:`<div class="fin-grid">${img?`<div class="fin-card">${img}</div>`:''}<div class="fin-card fin-kpi"><small>الرصيد الحالي</small><b>${N(displayBalance)}</b></div><div class="fin-card fin-kpi"><small>الداخل</small><b>${sum(inRows)}</b></div><div class="fin-card fin-kpi"><small>الخارج</small><b>${sum(outRows)}</b></div><div class="fin-card fin-kpi"><small>المستهلك</small><b>${sum(consumedRows)}</b></div><div class="fin-card fin-kpi"><small>المرتجع</small><b>${sum(returnRows)}</b></div></div>`},
      {title:'الداخل', html:`<div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المورد</th><th>مركز التكلفة</th><th>المشروع/الخدمة</th><th>الأوردر</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${movementRows(inRows)}</tbody></table></div>`},
      {title:'الخارج', html:`<div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المستلم</th><th>مركز التكلفة</th><th>المشروع/الخدمة</th><th>الأوردر</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${movementRows(outRows)}</tbody></table></div>`},
      {title:'المستهلك', html:`<div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المستلم</th><th>مركز التكلفة</th><th>المشروع/الخدمة</th><th>الأوردر</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${movementRows(consumedRows)}</tbody></table></div>`},
      {title:'المرتجع', html:`<div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المستلم</th><th>مركز التكلفة</th><th>المشروع/الخدمة</th><th>الأوردر</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${movementRows(returnRows)}</tbody></table></div>`},
      {title:'تالف / هدر / سكراب', html:`<div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المستلم</th><th>مركز التكلفة</th><th>المشروع/الخدمة</th><th>الأوردر</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${movementRows(wasteRows)}</tbody></table></div>`}
    ]);
  };

  function serviceOptions(selected){
    return `<option value="">بدون خدمة أخرى</option>${readOthers().map(x=>`<option value="${E(x)}" ${S(selected)===S(x)?'selected':''}>${E(x)}</option>`).join('')}`;
  }
  function refreshServiceSelects(selected){
    ['finOtherServiceSelectV58','finCostOtherServiceSelectV58'].forEach(id=>{ const el=$(id); if(el) el.innerHTML=serviceOptions(selected || el.value); });
  }
  function removeOtherOptionsFromProject(select){
    if(!select) return;
    A(select.options).forEach(opt=>{ if(S(opt.value).startsWith('other:')) opt.remove(); });
  }
  function enhanceOthers(){
    const dist=$('finDistProjectV15');
    removeOtherOptionsFromProject(dist);
    if(dist && !dist.dataset.v58){ dist.dataset.v58='1'; dist.closest('div')?.insertAdjacentHTML('afterend', `<div><label>خدمات أخرى</label><select id="finOtherServiceSelectV58">${serviceOptions('')}</select><div class="fin-line"><input id="finOtherServiceNameV58" placeholder="اسم خدمة أو مشروع آخر"><button type="button" class="light" onclick="financeProAddOtherServiceV58()">+</button></div></div>`); }
    const cost=$('finCostProjectV15');
    removeOtherOptionsFromProject(cost);
    if(cost && !cost.dataset.v58){ cost.dataset.v58='1'; cost.closest('div')?.insertAdjacentHTML('afterend', `<div><label>خدمات أخرى</label><select id="finCostOtherServiceSelectV58">${serviceOptions('')}</select><div class="fin-line"><input id="finCostOtherServiceNameV58" placeholder="اسم خدمة أو مشروع آخر"><button type="button" class="light" onclick="financeProAddOtherServiceV58('cost')">+</button></div></div>`); }
    refreshServiceSelects();
  }
  window.financeProAddOtherServiceV58=function(scope){ const input=scope==='cost'?$('finCostOtherServiceNameV58'):$('finOtherServiceNameV58'); const name=S(input?.value); if(!name) return notice('اكتب اسم الخدمة أو المشروع الآخر','err'); const rows=readOthers(); rows.push(name); saveOthers(rows); if(input) input.value=''; refreshServiceSelects(name); const target=scope==='cost'?$('finCostOtherServiceSelectV58'):$('finOtherServiceSelectV58'); if(target) target.value=name; notice('تمت إضافة الخدمة في خانة الخدمات الأخرى'); };

  const oldAddDist=window.financeProAddDistributionV15;
  window.financeProAddDistributionV15=function(){
    const other=S($('finOtherServiceSelectV58')?.value);
    if(other){
      const sel=$('finDistProjectV15');
      const projectId=S(sel?.value);
      const selectedProjectText=S(sel?.selectedOptions?.[0]?.textContent);
      const qty=N($('finDistQtyV15')?.value);
      if(qty<=0) return notice('كمية التوزيع مطلوبة','err');
      state().distribution.push({center:S($('finDistCenterV15')?.value)||'GENERAL',type:S($('finDistTypeV15')?.value)||'out',projectId:projectId||null,projectName:projectId?selectedProjectText:other,otherName:other,orderNo:S($('finDistOrderV15')?.value),qty,note:S($('finDistNoteV15')?.value)});
      ['finDistOrderV15','finDistQtyV15','finDistNoteV15'].forEach(id=>{ if($(id)) $(id).value=''; });
      if(typeof window.financeProRenderCurrentV15==='function') window.financeProRenderCurrentV15();
      return;
    }
    return oldAddDist && oldAddDist.apply(this,arguments);
  };

  const oldSaveExpense=window.financeProSaveExpenseV15;
  window.financeProSaveExpenseV15=async function(btn){
    const other=S($('finCostOtherServiceSelectV58')?.value);
    if(other && window.sb){
      try{ if(btn) btn.disabled=true; const center=S($('finCostCenterV15')?.value)||'GENERAL'; const net=N($('finCostNetV15')?.value); if(net<=0) throw new Error('قيمة المصروف قبل الضريبة مطلوبة'); const sel=$('finCostProjectV15'); const pid=S(sel?.value); const projectText=S(sel?.selectedOptions?.[0]?.textContent); const desc=S($('finCostDescV15')?.value)||other; const vat=net*.15,gross=net+vat; const row={expense_date:S($('finCostDateV15')?.value)||new Date().toISOString().slice(0,10),category:center,description:desc,supplier:desc,project_id:pid?Number(pid):null,project_name:pid?projectText:other,subtotal:+net.toFixed(2),vat:+vat.toFixed(2),total:+gross.toFixed(2),amount:+gross.toFixed(2),notes:`${S($('finCostNoteV15')?.value)} | other:${other} | order:${S($('finCostOrderV15')?.value)} | center:${center}`}; const res=await window.sb.from('finance_expenses').insert(row); if(res.error) throw res.error; if(typeof window.financeLoadAll==='function') await window.financeLoadAll(true); if(typeof window.financeProRenderCurrentV15==='function') window.financeProRenderCurrentV15(); notice('تم حفظ مصروف مركز التكلفة'); }
      catch(e){ alert(e.message||String(e)); notice(e.message||String(e),'err'); } finally{ if(btn) btn.disabled=false; } return;
    }
    return oldSaveExpense && oldSaveExpense.apply(this,arguments);
  };

  const oldEdit=window.financeProEditMovementV15;
  window.financeProEditMovementV15=function(id){ const m=A(state().movements).find(x=>Number(x.id)===Number(id)); if(lockedConsume(m)) return notice('لا يمكن تعديل حركة مستهلك بعد مرور 24 ساعة','err'); return oldEdit && oldEdit.apply(this,arguments); };

  const oldRender=window.financeProRenderCurrentV15;
  window.financeProRenderCurrentV15=function(){ const r=oldRender&&oldRender.apply(this,arguments); setTimeout(enhanceOthers,80); return r; };
  document.addEventListener('click',()=>setTimeout(enhanceOthers,100),true);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(enhanceOthers,1500));
  try{ financeProShowProductV15=window.financeProShowProductV15; financeProAddDistributionV15=window.financeProAddDistributionV15; financeProSaveExpenseV15=window.financeProSaveExpenseV15; financeProEditMovementV15=window.financeProEditMovementV15; financeProRenderCurrentV15=window.financeProRenderCurrentV15; }catch(_){}
})();

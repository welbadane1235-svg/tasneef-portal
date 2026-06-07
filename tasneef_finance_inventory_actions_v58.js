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
  function typeLabel(t){ return ({in:'داخل',out:'صرف',consume:'مستهلك',waste:'مهدور',damaged:'تالف',scrap:'سكراب',return:'مرتجع'}[S(t)] || S(t) || '-'); }
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

  window.financeProShowProductV15 = function(id){
    const item=A(state().items).find(i=>S(i.id)===S(id));
    if(!item) return notice('المنتج غير موجود','err');
    const moves=A(state().movements).filter(m=>S(m.item_id)===S(item.id) || S(m.item_name)===S(item.name));
    const inRows=moves.filter(m=>S(m.movement_type)==='in');
    const outRows=moves.filter(m=>['out','consume','waste','damaged','scrap'].includes(S(m.movement_type)));
    const img=item.image_url?`<img src="${E(item.image_url)}" style="width:96px;height:96px;object-fit:contain;border:1px solid #d9e7e2;border-radius:16px;background:#fff;padding:4px">`:'';
    modal('بيانات المنتج: '+(item.name||'-'), [
      {title:'الملخص', html:`<div class="fin-grid">${img?`<div class="fin-card">${img}</div>`:''}<div class="fin-card fin-kpi"><small>الرصيد الحالي</small><b>${N(item.quantity)}</b></div><div class="fin-card fin-kpi"><small>الداخل</small><b>${inRows.reduce((a,m)=>a+N(m.quantity),0)}</b></div><div class="fin-card fin-kpi"><small>الخارج</small><b>${outRows.reduce((a,m)=>a+N(m.quantity),0)}</b></div></div>`},
      {title:'الداخل', html:`<div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المورد</th><th>مركز التكلفة</th><th>المشروع/الخدمة</th><th>الأوردر</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${movementRows(inRows)}</tbody></table></div>`},
      {title:'الخارج', html:`<div class="fin-table"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المستلم</th><th>مركز التكلفة</th><th>المشروع/الخدمة</th><th>الأوردر</th><th>البيان</th><th>القيمة</th></tr></thead><tbody>${movementRows(outRows)}</tbody></table></div>`}
    ]);
  };

  function projectOptions(keep){
    const projects=A(state().projects).map(p=>`<option value="${E(p.id)}">${E(p.name||p.project_name||p.id)}</option>`).join('');
    const others=readOthers().map(x=>`<option value="other:${E(x)}">${E(x)}</option>`).join('');
    return `<option value="">بدون مشروع</option>${projects}${others}`;
  }
  function enhanceOthers(){
    const dist=$('finDistProjectV15');
    if(dist && !dist.dataset.v58){ const keep=dist.value; dist.innerHTML=projectOptions(keep); dist.value=keep; dist.dataset.v58='1'; dist.closest('div')?.insertAdjacentHTML('afterend', `<div><label>خدمات / مشاريع أخرى</label><div class="fin-line"><input id="finOtherServiceNameV58" placeholder="اسم خدمة أو مشروع آخر"><button type="button" class="light" onclick="financeProAddOtherServiceV58()">+</button></div></div>`); }
    const cost=$('finCostProjectV15');
    if(cost && !cost.dataset.v58){ const keep=cost.value; cost.innerHTML=projectOptions(keep); cost.value=keep; cost.dataset.v58='1'; cost.closest('div')?.insertAdjacentHTML('afterend', `<div><label>خدمات / مشاريع أخرى</label><div class="fin-line"><input id="finCostOtherServiceNameV58" placeholder="اسم خدمة أو مشروع آخر"><button type="button" class="light" onclick="financeProAddOtherServiceV58('cost')">+</button></div></div>`); }
  }
  window.financeProAddOtherServiceV58=function(scope){ const input=scope==='cost'?$('finCostOtherServiceNameV58'):$('finOtherServiceNameV58'); const name=S(input?.value); if(!name) return notice('اكتب اسم الخدمة أو المشروع الآخر','err'); const rows=readOthers(); rows.push(name); saveOthers(rows); if(input) input.value=''; ['finDistProjectV15','finCostProjectV15'].forEach(id=>{ const el=$(id); if(el){ el.innerHTML=projectOptions('other:'+name); el.value='other:'+name; }}); notice('تمت إضافة الخدمة/المشروع الآخر'); };

  const oldAddDist=window.financeProAddDistributionV15;
  window.financeProAddDistributionV15=function(){
    const sel=$('finDistProjectV15');
    if(sel && S(sel.value).startsWith('other:')){
      const name=S(sel.value).replace(/^other:/,'');
      const qty=N($('finDistQtyV15')?.value);
      if(qty<=0) return notice('كمية التوزيع مطلوبة','err');
      state().distribution.push({center:S($('finDistCenterV15')?.value)||'GENERAL',type:S($('finDistTypeV15')?.value)||'out',projectId:null,projectName:name,otherName:name,orderNo:S($('finDistOrderV15')?.value),qty,note:S($('finDistNoteV15')?.value)});
      ['finDistOrderV15','finDistQtyV15','finDistNoteV15'].forEach(id=>{ if($(id)) $(id).value=''; });
      if(typeof window.financeProRenderCurrentV15==='function') window.financeProRenderCurrentV15();
      return;
    }
    return oldAddDist && oldAddDist.apply(this,arguments);
  };

  const oldSaveExpense=window.financeProSaveExpenseV15;
  window.financeProSaveExpenseV15=async function(btn){
    const sel=$('finCostProjectV15');
    if(sel && S(sel.value).startsWith('other:') && window.sb){
      try{ if(btn) btn.disabled=true; const center=S($('finCostCenterV15')?.value)||'GENERAL'; const net=N($('finCostNetV15')?.value); if(net<=0) throw new Error('قيمة المصروف قبل الضريبة مطلوبة'); const other=S(sel.value).replace(/^other:/,''); const desc=S($('finCostDescV15')?.value)||other; const vat=net*.15,gross=net+vat; const row={expense_date:S($('finCostDateV15')?.value)||new Date().toISOString().slice(0,10),category:center,description:desc,supplier:desc,project_id:null,project_name:other,subtotal:+net.toFixed(2),vat:+vat.toFixed(2),total:+gross.toFixed(2),amount:+gross.toFixed(2),notes:`${S($('finCostNoteV15')?.value)} | other:${other} | order:${S($('finCostOrderV15')?.value)} | center:${center}`}; const res=await window.sb.from('finance_expenses').insert(row); if(res.error) throw res.error; if(typeof window.financeLoadAll==='function') await window.financeLoadAll(true); if(typeof window.financeProRenderCurrentV15==='function') window.financeProRenderCurrentV15(); notice('تم حفظ مصروف مركز التكلفة'); }
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

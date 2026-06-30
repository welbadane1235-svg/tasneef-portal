
/* V10249: Contract renewal decision - سيجدد / لم يجدد
   - UI only + safe Supabase persistence if columns exist.
   - Does not delete or modify old data except renewal decision columns.
*/
(function(){
  const VERSION='V10249';
  const $=id=>document.getElementById(id);
  const S=v=>String(v??'').trim();
  const esc=s=>S(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ds=()=>window.data||{};
  const storageKey='tasneef_project_renewal_decisions_v10249';
  function readLocal(){ try{return JSON.parse(localStorage.getItem(storageKey)||'{}')||{};}catch(_){return{};} }
  function writeLocal(map){ try{localStorage.setItem(storageKey,JSON.stringify(map||{}));}catch(_){} }
  function decisionOf(p){
    const local=readLocal();
    return S(p?.renewal_decision || p?.contract_renewal_status || local[String(p?.id)]?.decision || 'pending') || 'pending';
  }
  function labelOf(d){ return d==='renew'?'سيتم التجديد':(d==='not_renew'?'لم يجدد':'لم يحدد'); }
  function clsOf(d){ return d==='renew'?'green':(d==='not_renew'?'red':'yellow'); }
  function ensureStyle(){
    if($('contractRenewalStyleV10249')) return;
    const st=document.createElement('style'); st.id='contractRenewalStyleV10249';
    st.textContent=`
      .renew-btn-v10249{border:1px solid #cfe3dc;background:#f5fbf8;color:#0A4033;border-radius:10px;padding:7px 10px;font-weight:900;cursor:pointer;min-width:74px}
      .renew-btn-v10249.active-renew{background:#0A5A49;color:white;border-color:#0A5A49}
      .renew-btn-v10249.active-not{background:#b93939;color:white;border-color:#b93939}
      .renew-cell-v10249{text-align:center;white-space:nowrap}.renew-note-v10249{font-size:12px;color:#68766e;display:block;margin-top:3px}
      .alert-item.renew-v10249{background:#eefaf5;border-color:#b9e3d3;color:#0A4033}
    `;
    document.head.appendChild(st);
  }
  function ensureContractHeaders(){
    const ths=[...document.querySelectorAll('#contracts table thead tr th')];
    if(!ths.length || ths.some(th=>S(th.textContent)==='سيجدد')) return;
    const action=ths.find(th=>S(th.textContent)==='إجراء') || ths[ths.length-1];
    if(action){
      const th1=document.createElement('th'); th1.textContent='سيجدد';
      const th2=document.createElement('th'); th2.textContent='لم يجدد';
      action.parentNode.insertBefore(th1, action);
      action.parentNode.insertBefore(th2, action);
    }
  }
  function actionHtml(p){
    const id=Number(p?.id)||0, d=decisionOf(p);
    const renewCls=d==='renew'?' active-renew':'';
    const notCls=d==='not_renew'?' active-not':'';
    return {
      renew:`<td class="renew-cell-v10249"><button class="renew-btn-v10249${renewCls}" onclick="setContractRenewalDecisionV10249(${id},'renew')">${d==='renew'?'✓ سيجدد':'سيجدد'}</button></td>`,
      not:`<td class="renew-cell-v10249"><button class="renew-btn-v10249${notCls}" onclick="setContractRenewalDecisionV10249(${id},'not_renew')">${d==='not_renew'?'✓ لم يجدد':'لم يجدد'}</button></td>`
    };
  }
  async function persistDecision(pid, decision){
    const p=(ds().projects||[]).find(x=>String(x.id)===String(pid));
    if(!p) return {ok:false,msg:'المشروع غير موجود'};
    const now=new Date().toISOString();
    p.renewal_decision=decision; p.renewal_updated_at=now;
    const local=readLocal(); local[String(pid)]={decision,updated_at:now}; writeLocal(local);
    if(window.sb){
      try{
        const {error}=await window.sb.from('projects').update({renewal_decision:decision, renewal_updated_at:now}).eq('id',pid);
        if(error){
          console.warn('V10249 renewal DB save fallback:', error.message);
          return {ok:true,local:true,msg:'تم حفظ حالة التجديد محليًا. شغّل ملف SQL حتى تحفظ في قاعدة البيانات'};
        }
        return {ok:true,msg:'تم حفظ حالة التجديد'};
      }catch(e){
        console.warn('V10249 renewal save exception:', e);
        return {ok:true,local:true,msg:'تم حفظ حالة التجديد محليًا'};
      }
    }
    return {ok:true,local:true,msg:'تم حفظ حالة التجديد محليًا'};
  }
  window.setContractRenewalDecisionV10249=async function(pid, decision){
    const r=await persistDecision(pid,decision);
    try{ if(typeof msg==='function') msg(r.msg, r.local?'warn':'ok'); }catch(_){ alert(r.msg); }
    if(typeof window.renderContracts==='function') window.renderContracts();
    if(typeof window.renderContractAlerts==='function') window.renderContractAlerts();
    if(typeof window.renderAlerts==='function') window.renderAlerts();
  };
  function renderContractsV10249(){
    ensureStyle(); ensureContractHeaders();
    const body=$('contractsBody');
    if(!body || typeof window.contractInfo!=='function') return;
    const q=S($('contractSearch')?.value);
    const st=S($('contractFilterStatus')?.value);
    let rows=[...(ds().projects||[])];
    if(q) rows=rows.filter(p=>S(p.name).includes(q));
    if(st) rows=rows.filter(p=>window.contractInfo(p).key===st);
    rows.sort((a,b)=>{ const da=typeof window.daysLeft==='function'?window.daysLeft(a.contract_end):999999; const db=typeof window.daysLeft==='function'?window.daysLeft(b.contract_end):999999; return (da??999999)-(db??999999); });
    body.innerHTML=rows.map(p=>{
      const c=window.contractInfo(p); const a=actionHtml(p); const d=decisionOf(p);
      const decisionBadge=d!=='pending'?`<br><small class="renew-note-v10249">${esc(labelOf(d))}</small>`:'';
      const view=`<button class="light" onclick="openContractSmartModal(${Number(p.id)||0},'view')">عرض</button>`;
      const canEdit=(()=>{ try{ const u=JSON.parse(localStorage.getItem('tasneef_user')||'{}')||{}; return S(u.role)==='admin'; }catch(_){return true;} })();
      const edit=canEdit?`<button onclick="openContractSmartModal(${Number(p.id)||0},'edit')">تعديل</button>`:'';
      return `<tr><td><b>${esc(p.name)}</b></td><td>${p.buildings_count||0}</td><td>${p.units_count||0}</td><td>${esc((typeof window.isoDate==='function'?window.isoDate(p.contract_start):p.contract_start)||'-')}</td><td>${esc((typeof window.isoDate==='function'?window.isoDate(p.contract_end):p.contract_end)||'-')}</td><td>${c.days}</td><td><span class="badge ${c.cls}">${c.text}</span>${decisionBadge}</td>${a.renew}${a.not}<td class="row-actions">${view}${edit}</td></tr>`;
    }).join('') || '<tr><td colspan="10">لا توجد بيانات</td></tr>';
    if($('contractsActiveCount')) $('contractsActiveCount').textContent=(ds().projects||[]).filter(p=>window.contractInfo(p).key==='active').length;
    if($('contractsSoonCount')) $('contractsSoonCount').textContent=(ds().projects||[]).filter(p=>window.contractInfo(p).key==='soon').length;
    if($('contractsExpiredCount')) $('contractsExpiredCount').textContent=(ds().projects||[]).filter(p=>window.contractInfo(p).key==='expired').length;
    if($('contractsMissingCount')) $('contractsMissingCount').textContent=(ds().projects||[]).filter(p=>window.contractInfo(p).key==='missing').length;
  }
  function renderContractAlertsV10249(){
    ensureStyle();
    const projects=ds().projects||[];
    const relevant=[];
    for(const p of projects){
      if(typeof window.contractInfo!=='function') continue;
      const c=window.contractInfo(p); const d=decisionOf(p);
      if(!['soon','expired','missing'].includes(c.key)) continue;
      if(d==='not_renew') continue; // لا يظهر إشعار الانتهاء إذا تم اختيار لم يجدد
      relevant.push({p,c,d});
    }
    relevant.sort((a,b)=>{ const da=typeof window.daysLeft==='function'?window.daysLeft(a.p.contract_end):999999; const db=typeof window.daysLeft==='function'?window.daysLeft(b.p.contract_end):999999; return (da??99999)-(db??99999); });
    const html=relevant.map(x=>{
      const isRenew=x.d==='renew';
      const klass=isRenew?'renew-v10249':(x.c.key==='expired'?'danger':'warn');
      const line=isRenew?'سيتم التجديد':x.c.text;
      return `<div class="alert-item ${klass}"><b>${esc(x.p.name)}</b><br>نهاية العقد: ${esc((typeof window.isoDate==='function'?window.isoDate(x.p.contract_end):x.p.contract_end)||'-')}<br>المتبقي: ${x.c.days} - ${esc(line)}</div>`;
    }).join('') || '<div class="alert-item">لا توجد عقود قريبة الانتهاء تحتاج إجراء</div>';
    if($('contractDashboardAlerts')) $('contractDashboardAlerts').innerHTML=html;
    if($('contractsAlertsList')) $('contractsAlertsList').innerHTML=html;
  }
  const oldRenderAlerts=window.renderAlerts;
  window.renderContracts=renderContractsV10249;
  window.renderContractAlerts=renderContractAlertsV10249;
  window.renderAlerts=function(){
    if(typeof oldRenderAlerts==='function') oldRenderAlerts.apply(this,arguments);
    try{ renderContractAlertsV10249(); }catch(e){ console.warn('V10249 alerts',e); }
  };
  function boot(){
    ensureStyle(); ensureContractHeaders();
    const tag=document.createElement('small'); tag.textContent=' V10249'; tag.style.cssText='color:#0A5A49;font-weight:900;margin-inline-start:8px';
    const h=[...document.querySelectorAll('#contracts h2')].find(x=>S(x.textContent).includes('كل العقود'));
    if(h && !h.querySelector('[data-v10249]')){ tag.dataset.v10249='1'; h.appendChild(tag); }
    try{ if(typeof window.renderContracts==='function') window.renderContracts(); if(typeof window.renderContractAlerts==='function') window.renderContractAlerts(); }catch(_){ }
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,800));
  setTimeout(boot,1800);
})();

(function(){
  if(window.__tasneefFinanceRolesV29) return;
  window.__tasneefFinanceRolesV29 = true;
  window.__tasneefFinanceRolesV28 = true;

  const S=(v)=>String(v ?? '').trim();
  const role=()=>{
    try{
      const u=JSON.parse(localStorage.getItem('tasneef_user') || localStorage.getItem('tasneef_session') || '{}') || {};
      return S(u.role);
    }catch(e){ return ''; }
  };
  const isWarehouse=()=>role()==='warehouse_manager';
  const allowed=['products','movement'];

  function style(){
    if(document.getElementById('financeRolesStyleV29')) return;
    const st=document.createElement('style');
    st.id='financeRolesStyleV29';
    st.textContent=`
      body.finance-warehouse-role-v29 .fin-money-hidden-v29{display:none!important}
      body.finance-warehouse-role-v29 #finBodyV15 .fin-grid .fin-kpi:has(.fin-money-hidden-v29){display:none!important}
    `;
    document.head.appendChild(st);
  }
  function tabId(btn){
    const js=S(btn?.getAttribute('onclick'));
    const m=js.match(/financeProTabV15\(['"]([^'"]+)['"]\)/);
    return m ? m[1] : '';
  }
  function normalizeTabs(){
    const warehouse=isWarehouse();
    document.body.classList.toggle('finance-warehouse-role-v29', warehouse);
    document.body.classList.remove('finance-warehouse-role-v28');
    document.querySelectorAll('#finTabsV15 button').forEach(btn=>{
      const id=tabId(btn);
      btn.style.display=(!warehouse || allowed.includes(id)) ? '' : 'none';
    });
    if(!warehouse) return;
    const active=tabId(document.querySelector('#finTabsV15 button.active'));
    if(active && !allowed.includes(active) && typeof window.financeProTabV15==='function'){
      setTimeout(()=>window.financeProTabV15('products'), 30);
    }
  }
  function markMoney(){
    const warehouse=isWarehouse();
    document.querySelectorAll('.fin-money-hidden-v29').forEach(el=>el.classList.remove('fin-money-hidden-v29'));
    if(!warehouse) return;
    const moneyWords=/(سعر|ضريبة|قبل الضريبة|بعد الضريبة|قيمة|تكلفة|ربح|ر\.س|ط±\.ط³)/;
    document.querySelectorAll('.fin-meta div,.fin-kpi,.fin-soft').forEach(el=>{
      if(moneyWords.test(S(el.textContent))) el.classList.add('fin-money-hidden-v29');
    });
    document.querySelectorAll('.fin-table table').forEach(table=>{
      const idx=[...table.querySelectorAll('thead th')]
        .map((th,i)=>moneyWords.test(S(th.textContent)) ? i : -1)
        .filter(i=>i>=0);
      if(!idx.length) return;
      [...table.rows].forEach(row=>{
        idx.forEach(i=>{ if(row.cells[i]) row.cells[i].classList.add('fin-money-hidden-v29'); });
      });
    });
  }
  function apply(){
    style();
    normalizeTabs();
    markMoney();
  }
  function wrap(name){
    const old=window[name];
    if(typeof old!=='function' || old.__financeRolesV29) return;
    const fn=function(){
      const out=old.apply(this, arguments);
      Promise.resolve(out).finally(()=>setTimeout(apply, 40));
      return out;
    };
    fn.__financeRolesV29=true;
    window[name]=fn;
  }
  function install(){
    ['financeProLoadV15','financeProTabV15','financeProRenderCurrentV15','financeProRenderProductListV15','financeProShowProductV15'].forEach(wrap);
    apply();
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,500));
  setTimeout(install,1100);
  let busy=false;
  new MutationObserver(()=>{
    if(busy) return;
    busy=true;
    setTimeout(()=>{ busy=false; apply(); },80);
  }).observe(document.documentElement,{childList:true,subtree:true});
})();

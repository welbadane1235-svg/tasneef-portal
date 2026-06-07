(function(){
  if(window.__tasneefFinanceRolesV28) return;
  window.__tasneefFinanceRolesV28 = true;

  const S=(v)=>String(v ?? '').trim();
  const currentUser=()=>{
    try{ return JSON.parse(localStorage.getItem('tasneef_user') || 'null') || {}; }
    catch(e){ return {}; }
  };
  const role=()=>S(currentUser().role);
  const isWarehouse=()=>role()==='warehouse_manager';
  const allowedTabs=new Set(['products','movement']);

  function installStyle(){
    if(document.getElementById('financeRolesStyleV28')) return;
    const st=document.createElement('style');
    st.id='financeRolesStyleV28';
    st.textContent=`
      body.finance-warehouse-role-v28 .fin-hero p:after{content:" مدير المخزن: عرض المنتجات وحركة المخزون فقط.";display:block;margin-top:4px;color:#e7fff6}
      body.finance-warehouse-role-v28 .fin-warehouse-hidden-v28{display:none!important}
    `;
    document.head.appendChild(st);
  }

  function hidePriceColumns(table){
    const ths=[...table.querySelectorAll('thead th')];
    if(!ths.length) return;
    const hide=ths.map((th,i)=>/(سعر|ضريبة|قبل|بعد|قيمة|تكلفة|ربح|ر\.س|ط±\.ط³)/.test(S(th.textContent)) ? i : -1).filter(i=>i>=0);
    if(!hide.length) return;
    [...table.rows].forEach(row=>{
      hide.forEach(i=>{ if(row.cells[i]) row.cells[i].classList.add('fin-warehouse-hidden-v28'); });
    });
  }

  function applyWarehouseView(){
    installStyle();
    document.body.classList.toggle('finance-warehouse-role-v28', isWarehouse());
    if(!isWarehouse()) return;

    document.querySelectorAll('#finTabsV15 button').forEach(btn=>{
      const js=S(btn.getAttribute('onclick'));
      const keep=[...allowedTabs].some(tab=>js.includes(`'${tab}'`) || js.includes(`"${tab}"`));
      btn.style.display=keep ? '' : 'none';
    });

    document.querySelectorAll('.fin-meta div,.fin-soft,.fin-kpi').forEach(el=>{
      const txt=S(el.textContent);
      if(/(سعر|ضريبة|قبل الضريبة|بعد الضريبة|قيمة|تكلفة|ربح|ر\.س|ط±\.ط³)/.test(txt)){
        el.classList.add('fin-warehouse-hidden-v28');
      }
    });
    document.querySelectorAll('.fin-table table').forEach(hidePriceColumns);
  }

  function forceWarehouseTab(){
    if(!isWarehouse()) return;
    const active=document.querySelector('#finTabsV15 button.active');
    const js=S(active?.getAttribute('onclick'));
    const ok=[...allowedTabs].some(tab=>js.includes(`'${tab}'`) || js.includes(`"${tab}"`));
    if(!ok && typeof window.financeProTabV15==='function'){
      setTimeout(()=>window.financeProTabV15('products'),0);
    }
  }

  const wrap=(name, after)=>{
    const old=window[name];
    if(typeof old!=='function' || old.__financeRolesWrappedV28) return;
    const fn=function(){
      const result=old.apply(this, arguments);
      Promise.resolve(result).finally(()=>setTimeout(after,20));
      return result;
    };
    fn.__financeRolesWrappedV28=true;
    window[name]=fn;
  };

  function install(){
    wrap('financeProLoadV15', ()=>{ forceWarehouseTab(); applyWarehouseView(); });
    wrap('financeProTabV15', ()=>{ forceWarehouseTab(); applyWarehouseView(); });
    wrap('financeProRenderCurrentV15', applyWarehouseView);
    wrap('financeProRenderProductListV15', applyWarehouseView);
    wrap('financeProShowProductV15', applyWarehouseView);
    applyWarehouseView();
    forceWarehouseTab();
  }

  const observer=new MutationObserver(()=>applyWarehouseView());
  document.addEventListener('DOMContentLoaded',()=>{ install(); observer.observe(document.body,{childList:true,subtree:true}); });
  setTimeout(()=>{ install(); observer.observe(document.body,{childList:true,subtree:true}); },800);
})();

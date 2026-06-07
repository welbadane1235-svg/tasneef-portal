/* Tasneef Warehouse Reports Lock V7402 - prevents reports tab from reverting to products */
(function(){
  if(window.__wmReportsLockV7402) return;
  window.__wmReportsLockV7402 = true;
  const S = v => String(v ?? '').trim();
  const N = v => { const n=Number(v); return Number.isFinite(n)?n:0; };
  const esc = v => String(v ?? '').replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]||ch));
  const money = n => (Number(n)||0).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ر.س';
  let reportLockUntil = 0;
  let userNextTab = '';
  let originalTabFn = null;
  function user(){ try{return JSON.parse(localStorage.getItem('tasneef_user')||'null')||{};}catch(_){return {};} }
  function isWarehouse(){ return S(user().role)==='warehouse_manager'; }
  function finPage(){ return document.getElementById('financeDashboard'); }
  function visible(){ const p=finPage(); return !!p && !p.classList.contains('hidden') && getComputedStyle(p).display!=='none'; }
  function rowType(v){
    const t=S(v);
    const map={'داخل':'in','دخول':'in','توريد':'in','صرف':'out','خارج':'out','مستهلك':'consume','استهلاك':'consume','مرتجع':'return','مرجع':'return','مهدور':'waste','هدر':'waste','تالف':'damaged','سكراب':'scrap'};
    return map[t] || t;
  }
  function qty(v){return N(v);}
  function metaOf(note){ const raw=S(note); if(!raw.startsWith('finance_pro_v15:')) return {}; try{return JSON.parse(raw.replace('finance_pro_v15:',''))||{};}catch(_){return {};} }
  function rows(){
    const st=window.financeProStateV15 || {};
    const moves=Array.isArray(st.movements)?st.movements:[];
    const out=[];
    moves.forEach(m=>{
      const meta=metaOf(m.notes);
      const dist=Array.isArray(meta.distribution)?meta.distribution:[];
      if(dist.length){
        dist.forEach(d=>out.push({
          date:m.movement_date||S(m.created_at).slice(0,10)||'-',
          type:rowType(d.type || m.movement_type)==='out'?'consume':rowType(d.type || m.movement_type),
          item:m.item_name||m.product_name||m.item||'-',
          qty:qty(d.qty),
          receiver:m.receiver||m.supplier_name||'-',
          project:d.projectName||d.otherName||m.project_name||'-',
          order:d.orderNo||m.order_no||'-'
        }));
      }else{
        out.push({
          date:m.movement_date||S(m.created_at).slice(0,10)||'-',
          type:rowType(m.movement_type),
          item:m.item_name||m.product_name||m.item||'-',
          qty:qty(m.quantity),
          receiver:m.receiver||m.supplier_name||'-',
          project:m.project_name||'-',
          order:m.order_no||'-'
        });
      }
    });
    return out.filter(r=>['in','consume','return','waste','damaged','scrap'].includes(rowType(r.type)));
  }
  function unitPrice(r){
    try{
      const st=window.financeProStateV15 || {};
      const items=Array.isArray(st.items)?st.items:[];
      const it=items.find(x=>S(x.name||x.item_name||x.product_name)===S(r.item));
      return N(it?.unit_price || it?.price || it?.cost || it?.avg_cost || it?.purchase_price || 0);
    }catch(_){return 0;}
  }
  function opts(list){return [...new Set(list.map(S).filter(Boolean).filter(x=>x!=='-'))].sort().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');}
  function typeLabel(t){ t=rowType(t); return t==='in'?'داخل':t==='consume'?'مستهلك':t==='return'?'مرتجع':(t==='waste'||t==='damaged')?'تالف/هدر':t==='scrap'?'سكراب':t||'-'; }
  function filtered(){
    let rs=rows();
    const q=S(document.getElementById('wmLockSearchV7402')?.value).toLowerCase();
    const product=S(document.getElementById('wmLockProductV7402')?.value);
    const project=S(document.getElementById('wmLockProjectV7402')?.value);
    const type=S(document.getElementById('wmLockTypeV7402')?.value);
    const from=S(document.getElementById('wmLockFromV7402')?.value);
    const to=S(document.getElementById('wmLockToV7402')?.value);
    return rs.filter(r=>{
      if(product && S(r.item)!==product) return false;
      if(project && S(r.project)!==project) return false;
      if(type && rowType(r.type)!==type) return false;
      if(from && S(r.date)<from) return false;
      if(to && S(r.date)>to) return false;
      if(q && ![r.date,r.type,r.item,r.qty,r.receiver,r.project,r.order].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
  }
  function currentInner(){ return S(sessionStorage.getItem('wm_lock_inner_v7402')) || 'products'; }
  window.wmLockReportTabV7402 = function(tab){ sessionStorage.setItem('wm_lock_inner_v7402', tab||'products'); renderContent(); };
  window.wmLockRenderV7402 = function(){ renderContent(); };
  window.wmLockPrintV7402 = function(){
    const box=document.getElementById('wmLockPrintAreaV7402');
    if(!box) return window.print();
    const w=window.open('','_blank');
    w.document.write('<html dir="rtl" lang="ar"><head><title>تقرير المخزون</title><style>body{font-family:Tahoma,Arial;padding:20px;color:#10231d}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #999;padding:8px;text-align:right}th{background:#f1f5f3}.kpi{display:inline-block;border:1px solid #ddd;border-radius:12px;padding:10px;margin:5px;min-width:140px}h2,h3{color:#0A4033}</style></head><body>'+box.innerHTML+'</body></html>');
    w.document.close(); w.focus(); setTimeout(()=>w.print(),300);
  };
  function renderContent(){
    const content=document.getElementById('wmLockContentV7402');
    if(!content) return;
    const rs=filtered();
    const inner=currentInner();
    document.querySelectorAll('.wm-lock-tabs-v7402 button').forEach(b=>b.classList.toggle('active', b.dataset.tab===inner));
    const totalIn=rs.filter(r=>rowType(r.type)==='in').reduce((a,r)=>a+qty(r.qty),0);
    const totalConsume=rs.filter(r=>rowType(r.type)==='consume').reduce((a,r)=>a+qty(r.qty),0);
    const totalReturn=rs.filter(r=>rowType(r.type)==='return').reduce((a,r)=>a+qty(r.qty),0);
    const totalValue=rs.reduce((a,r)=>a+(qty(r.qty)*unitPrice(r)),0);
    const map={};
    rs.forEach(r=>{
      const k=S(r.item)||'-'; map[k]=map[k]||{in:0,consume:0,return:0,waste:0,balance:0,value:0};
      const t=rowType(r.type), q=qty(r.qty), p=unitPrice(r);
      if(t==='in'){map[k].in+=q;map[k].balance+=q;} else if(t==='return'){map[k].return+=q;map[k].balance+=q;} else if(t==='consume'){map[k].consume+=q;map[k].balance-=q;} else {map[k].waste+=q;map[k].balance-=q;}
      map[k].value+=Math.max(0,q*p);
    });
    let html='';
    if(inner==='products'){
      const trs=Object.keys(map).map(k=>`<tr><td>${esc(k)}</td><td>${map[k].in}</td><td>${map[k].consume}</td><td>${map[k].return}</td><td>${map[k].waste}</td><td>${map[k].balance}</td><td>${money(map[k].value)}</td></tr>`).join('') || '<tr><td colspan="7">لا توجد بيانات</td></tr>';
      html=`<div id="wmLockPrintAreaV7402" class="wm-lock-card-v7402"><h3>تقرير المنتجات</h3><div class="wm-lock-kpis-v7402"><div><small>منتجات</small><b>${Object.keys(map).length}</b></div><div><small>داخل</small><b>${totalIn}</b></div><div><small>مستهلك</small><b>${totalConsume}</b></div><div><small>مرتجع</small><b>${totalReturn}</b></div></div><div class="wm-lock-table-v7402"><table><thead><tr><th>المنتج</th><th>داخل</th><th>مستهلك</th><th>مرتجع</th><th>تالف/هدر</th><th>الرصيد الحالي</th><th>الإجمالي</th></tr></thead><tbody>${trs}</tbody></table></div><div class="wm-lock-total-v7402"><div><small>قبل الضريبة</small><b>${money(totalValue)}</b></div><div><small>الضريبة 15%</small><b>${money(totalValue*.15)}</b></div><div><small>بعد الضريبة</small><b>${money(totalValue*1.15)}</b></div></div></div>`;
    }else if(inner==='movement'){
      const trs=rs.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(typeLabel(r.type))}</td><td>${esc(r.item)}</td><td>${qty(r.qty)}</td><td>${esc(r.receiver)}</td><td>${esc(r.project)}</td><td>${esc(r.order)}</td><td>${money(qty(r.qty)*unitPrice(r))}</td></tr>`).join('') || '<tr><td colspan="8">لا توجد حركات</td></tr>';
      html=`<div id="wmLockPrintAreaV7402" class="wm-lock-card-v7402"><h3>حركة المخزون</h3><div class="wm-lock-kpis-v7402"><div><small>حركات</small><b>${rs.length}</b></div><div><small>داخل</small><b>${totalIn}</b></div><div><small>مستهلك</small><b>${totalConsume}</b></div><div><small>مرتجع</small><b>${totalReturn}</b></div></div><div class="wm-lock-table-v7402"><table><thead><tr><th>التاريخ</th><th>الحركة</th><th>المنتج</th><th>الكمية</th><th>المستلم/المورد</th><th>المشروع</th><th>الأوردر</th><th>الإجمالي</th></tr></thead><tbody>${trs}</tbody></table></div></div>`;
    }else if(inner==='stock'){
      const trs=Object.keys(map).filter(k=>map[k].balance!==0).map(k=>`<tr><td>${esc(k)}</td><td>${map[k].balance}</td><td>${map[k].in}</td><td>${map[k].consume}</td><td>${map[k].return}</td></tr>`).join('') || '<tr><td colspan="5">لا توجد منتجات برصيد حالي</td></tr>';
      html=`<div id="wmLockPrintAreaV7402" class="wm-lock-card-v7402"><h3>جرد المخزون</h3><p>لا تظهر المنتجات ذات الرصيد صفر.</p><div class="wm-lock-table-v7402"><table><thead><tr><th>المنتج</th><th>الرصيد الحالي</th><th>إجمالي الدخول</th><th>إجمالي الاستهلاك</th><th>المرتجع</th></tr></thead><tbody>${trs}</tbody></table></div></div>`;
    }else{
      const cost={};
      rs.filter(r=>rowType(r.type)==='consume').forEach(r=>{const k=S(r.project)||'-';cost[k]=cost[k]||{count:0,qty:0,value:0};cost[k].count++;cost[k].qty+=qty(r.qty);cost[k].value+=qty(r.qty)*unitPrice(r);});
      const subtotal=Object.values(cost).reduce((a,x)=>a+x.value,0);
      const trs=Object.keys(cost).map(k=>`<tr><td>${esc(k)}</td><td>${cost[k].count}</td><td>${cost[k].qty}</td><td>${money(cost[k].value)}</td><td>${money(cost[k].value*.15)}</td><td>${money(cost[k].value*1.15)}</td></tr>`).join('') || '<tr><td colspan="6">لا توجد مراكز تكلفة</td></tr>';
      html=`<div id="wmLockPrintAreaV7402" class="wm-lock-card-v7402"><h3>مراكز التكلفة</h3><div class="wm-lock-table-v7402"><table><thead><tr><th>المشروع / مركز التكلفة</th><th>عدد العمليات</th><th>الكمية</th><th>قبل الضريبة</th><th>الضريبة</th><th>بعد الضريبة</th></tr></thead><tbody>${trs}</tbody></table></div><div class="wm-lock-total-v7402"><div><small>قبل الضريبة</small><b>${money(subtotal)}</b></div><div><small>الضريبة 15%</small><b>${money(subtotal*.15)}</b></div><div><small>بعد الضريبة</small><b>${money(subtotal*1.15)}</b></div></div></div>`;
    }
    content.innerHTML=html;
  }
  function renderReports(){
    if(!isWarehouse() || !visible()) return false;
    const body=document.getElementById('finBodyV15');
    if(!body) return false;
    reportLockUntil = Date.now()+30000;
    sessionStorage.setItem('tasneef_warehouse_fin_tab_v44','reports');
    document.querySelectorAll('#finTabsV15 button[data-fin-tab-v15]').forEach(b=>b.classList.toggle('active', S(b.getAttribute('data-fin-tab-v15'))==='reports'));
    const all=rows();
    const products=opts(all.map(r=>r.item));
    const projects=opts(all.map(r=>r.project));
    if(!document.getElementById('wmLockStyleV7402')){
      const st=document.createElement('style'); st.id='wmLockStyleV7402'; st.textContent=`
      .wm-lock-shell-v7402{display:grid;gap:14px}.wm-lock-head-v7402{background:#fff;border:1px solid #dce6e2;border-radius:22px;padding:16px;box-shadow:0 8px 24px rgba(10,64,51,.05)}.wm-lock-tabs-v7402{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:8px 0 14px}.wm-lock-tabs-v7402 button{background:#eef6f3!important;color:#0A4033!important;border:1px solid #cfe2da!important;border-radius:16px!important;min-height:44px}.wm-lock-tabs-v7402 button.active{background:#0A4033!important;color:#fff!important}.wm-lock-filters-v7402{display:grid;grid-template-columns:2fr repeat(5,minmax(115px,1fr)) auto;gap:9px}.wm-lock-card-v7402{background:#fff;border:1px solid #dce6e2;border-radius:22px;padding:16px;box-shadow:0 8px 24px rgba(10,64,51,.05)}.wm-lock-card-v7402 h3{margin:0 0 12px;color:#0A4033}.wm-lock-kpis-v7402,.wm-lock-total-v7402{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}.wm-lock-total-v7402{grid-template-columns:repeat(3,1fr);margin-top:12px}.wm-lock-kpis-v7402>div,.wm-lock-total-v7402>div{background:#fff;border:1px solid #dce6e2;border-radius:18px;padding:14px}.wm-lock-kpis-v7402 small,.wm-lock-total-v7402 small{display:block;color:#60706a;margin-bottom:7px}.wm-lock-kpis-v7402 b,.wm-lock-total-v7402 b{font-size:24px;color:#0A4033}.wm-lock-table-v7402{overflow:auto;border:1px solid #dce6e2;border-radius:16px}.wm-lock-table-v7402 table{width:100%;border-collapse:collapse}.wm-lock-table-v7402 th,.wm-lock-table-v7402 td{padding:10px;border-bottom:1px solid #edf1ef;text-align:right;white-space:nowrap}.wm-lock-table-v7402 th{background:#f8fbfa;color:#4c635c}@media(max-width:1000px){.wm-lock-tabs-v7402,.wm-lock-kpis-v7402,.wm-lock-filters-v7402,.wm-lock-total-v7402{grid-template-columns:1fr 1fr}}@media(max-width:650px){.wm-lock-tabs-v7402,.wm-lock-kpis-v7402,.wm-lock-filters-v7402,.wm-lock-total-v7402{grid-template-columns:1fr}}`;
      document.head.appendChild(st);
    }
    body.innerHTML=`<div class="wm-lock-shell-v7402"><div class="wm-lock-head-v7402"><h3>تقارير مدير المخزون</h3><div class="wm-lock-tabs-v7402"><button type="button" data-tab="products" onclick="wmLockReportTabV7402('products')">تقرير المنتجات</button><button type="button" data-tab="movement" onclick="wmLockReportTabV7402('movement')">حركة المخزون</button><button type="button" data-tab="stock" onclick="wmLockReportTabV7402('stock')">جرد المخزون</button><button type="button" data-tab="cost" onclick="wmLockReportTabV7402('cost')">مراكز التكلفة</button></div><div class="wm-lock-filters-v7402"><input id="wmLockSearchV7402" oninput="wmLockRenderV7402()" placeholder="بحث حسب المنتج أو الكود أو المستلم"><select id="wmLockProductV7402" onchange="wmLockRenderV7402()"><option value="">كل المنتجات</option>${products}</select><select id="wmLockProjectV7402" onchange="wmLockRenderV7402()"><option value="">كل المشاريع</option>${projects}</select><select id="wmLockTypeV7402" onchange="wmLockRenderV7402()"><option value="">كل الحركات</option><option value="in">داخل</option><option value="consume">مستهلك</option><option value="return">مرتجع</option><option value="waste">هدر/تالف</option></select><input id="wmLockFromV7402" type="date" onchange="wmLockRenderV7402()"><input id="wmLockToV7402" type="date" onchange="wmLockRenderV7402()"><button type="button" class="light" onclick="wmLockPrintV7402()">طباعة</button></div></div><div id="wmLockContentV7402"></div></div>`;
    renderContent();
    return false;
  }
  function patchTabFn(){
    if(window.financeProTabV15 && !window.financeProTabV15.__wmLockV7402){
      originalTabFn = window.financeProTabV15;
      const wrapped=function(tab){
        const t=S(tab);
        if(isWarehouse()){
          if(t==='reports') return renderReports();
          if(Date.now()<reportLockUntil && !userNextTab && t==='products') return renderReports();
          if(['products','movement'].includes(t)){
            reportLockUntil=0;
            sessionStorage.setItem('tasneef_warehouse_fin_tab_v44', t);
          }
        }
        return originalTabFn.apply(this, arguments);
      };
      wrapped.__wmLockV7402=true;
      window.financeProTabV15=wrapped;
    }
  }
  document.addEventListener('mousedown', function(ev){
    const btn=ev.target?.closest?.('#finTabsV15 button[data-fin-tab-v15]');
    if(!btn) return;
    userNextTab=S(btn.getAttribute('data-fin-tab-v15'));
    setTimeout(()=>{userNextTab='';},700);
  }, true);
  function tick(){
    patchTabFn();
    if(!isWarehouse() || !visible()) return;
    const saved=S(sessionStorage.getItem('tasneef_warehouse_fin_tab_v44'));
    const body=document.getElementById('finBodyV15');
    const onReports=saved==='reports' || Date.now()<reportLockUntil;
    if(onReports && body && !body.querySelector('.wm-lock-shell-v7402')) renderReports();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', tick); else tick();
  window.addEventListener('load', ()=>setTimeout(tick,300));
  setInterval(tick,900);
})();

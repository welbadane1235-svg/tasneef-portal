/* Tasneef v10173 - Finance reports Excel export
   Scope: المالية والمخزون / التقارير فقط.
   - يضيف زر تصدير Excel لكل تبويبات التقارير.
   - يعتمد على التقرير الظاهر بعد الفلاتر الحالية.
   - لا يغير البيانات ولا الحفظ. */
(function(){
  'use strict';
  if(window.__tasneefFinanceReportsExcelExportV10173) return;
  window.__tasneefFinanceReportsExcelExportV10173=true;
  const VERSION='v10173-finance-reports-excel-export';
  const S=v=>String(v??'').trim();
  const $=id=>document.getElementById(id);
  const state=()=>window.financeProStateV15||{};
  const visible=el=>{
    if(!el) return false;
    if(el.closest('.v10172-class-hidden,.v10171-class-hidden,.v10170-class-hidden')) return false;
    const cs=getComputedStyle(el);
    return cs.display!=='none' && cs.visibility!=='hidden' && Number(cs.opacity)!==0;
  };
  const esc=v=>S(v).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const cleanFileName=v=>S(v).replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim().slice(0,90)||'finance-report';
  const today=()=>new Date().toISOString().slice(0,10);

  function ensureStyle(){
    if($('finReportsExcelStyleV10173')) return;
    const st=document.createElement('style'); st.id='finReportsExcelStyleV10173';
    st.textContent=`
      .fin-excel-btn-v10173{background:#0b5a45!important;color:#fff!important;border:0!important;border-radius:12px!important;padding:10px 16px!important;font-weight:900!important;cursor:pointer!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;min-height:40px!important}
      .fin-excel-btn-v10173:hover{filter:brightness(.96)}
      .fpr-toolbar .fin-excel-btn-v10173{margin-inline-start:8px}
      .fin-excel-note-v10173{font-size:12px;color:#55736b;margin-top:6px}
    `;
    document.head.appendChild(st);
  }

  function reportBox(){ return $('finReportWindowV15') || document.querySelector('#finBodyV15 [id*="Report"], #finBodyV15 .fin-card'); }
  function reportTitle(){
    const st=state();
    const tab=S(st.reportTab||'');
    const active=S(document.querySelector('#finBodyV15 .active, #finBodyV15 button.active')?.textContent||'');
    if(/استهلاك/.test(active)||tab==='costConsumption') return 'تقرير استهلاك مراكز التكلفة';
    if(/جرد/.test(active)||tab==='inventory') return 'تقرير جرد المخزون';
    if(/حركة/.test(active)||tab==='movements') return 'تقرير حركة المخزون';
    if(/مراكز/.test(active)||tab==='centers') return 'تقرير مراكز التكلفة';
    if(/منتجات/.test(active)||tab==='products') return 'تقرير المنتجات';
    const h=S(reportBox()?.querySelector('h1,h2,h3,b')?.textContent||'');
    return h||'تقرير المالية والمخزون';
  }

  function filterSummary(){
    const ids=[
      ['بحث','finReportSearchV15'],['من تاريخ','finReportFromV15'],['إلى تاريخ','finReportToV15'],
      ['مركز التكلفة','finReportCenterV15'],['النوع','finReportTypeV15'],['المشروع','finReportProjectV15'],
      ['المنتج','finReportProductV15'],['الحركة المطلوبة','finReportMoveTypeV15'],['تصنيف المنتج','finReportProductClassV10169']
    ];
    return ids.map(([label,id])=>{
      const el=$(id); if(!el) return null;
      let val='';
      if(el.tagName==='SELECT') val=S(el.selectedOptions?.[0]?.textContent||el.value);
      else val=S(el.value);
      if(!val || /كل|اختيار|اختر/.test(val)) return null;
      return `${label}: ${val}`;
    }).filter(Boolean).join(' | ');
  }

  function tableToHtml(table, idx){
    if(!visible(table)) return '';
    const title=S(table.closest('section,article,.fpr-product,.fin-card')?.querySelector('h2,h3,b')?.textContent||'');
    let html='';
    if(title) html+=`<tr><td colspan="20" class="section-title">${esc(title)}</td></tr>`;
    html+='<table border="1" dir="rtl"><tbody>';
    const rows=[...table.rows].filter(visible);
    rows.forEach(row=>{
      html+='<tr>';
      [...row.cells].forEach(cell=>{
        const tag=cell.tagName&&cell.tagName.toLowerCase()==='th'?'th':'td';
        const colspan=cell.colSpan>1?` colspan="${cell.colSpan}"`:'';
        const rowspan=cell.rowSpan>1?` rowspan="${cell.rowSpan}"`:'';
        let text=S(cell.innerText||cell.textContent).replace(/\s+\n/g,'\n').replace(/\n\s+/g,'\n').replace(/\s{2,}/g,' ');
        html+=`<${tag}${colspan}${rowspan}>${esc(text)}</${tag}>`;
      });
      html+='</tr>';
    });
    html+='</tbody></table><br>';
    return html;
  }

  function cardsWithoutTablesToHtml(box){
    const cards=[...box.querySelectorAll('.fin-product-card,.fin-card,.fpr-product')].filter(visible);
    if(!cards.length) return '';
    let rows='';
    cards.forEach(card=>{
      if(card.querySelector('table')) return;
      const txt=S(card.innerText||card.textContent).replace(/\n+/g,' | ').replace(/\s{2,}/g,' ');
      if(txt) rows+=`<tr><td>${esc(txt)}</td></tr>`;
    });
    return rows?`<table border="1" dir="rtl"><tbody><tr><th>البيان</th></tr>${rows}</tbody></table>`:'';
  }

  function buildExcelHtml(){
    const box=reportBox();
    if(!box) throw new Error('لا يوجد تقرير ظاهر للتصدير');
    const clone=box.cloneNode(true);
    clone.querySelectorAll('button,input,select,textarea,script,style,.fin-excel-btn-v10173').forEach(x=>x.remove());
    clone.querySelectorAll('.v10172-class-hidden,.v10171-class-hidden,.v10170-class-hidden').forEach(x=>x.remove());
    clone.querySelectorAll('[style]').forEach(x=>{ if(/display\s*:\s*none/i.test(x.getAttribute('style')||'')) x.remove(); });
    let body='';
    const tables=[...clone.querySelectorAll('table')];
    tables.forEach((t,i)=>{ body+=tableToHtml(t,i); });
    if(!body) body=cardsWithoutTablesToHtml(clone);
    if(!body) body=`<table border="1" dir="rtl"><tbody><tr><td>${esc(S(clone.innerText||clone.textContent)||'لا توجد بيانات')}</td></tr></tbody></table>`;
    const filters=filterSummary();
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
      <style>
        body{font-family:Tahoma,Arial,sans-serif;direction:rtl;text-align:right;color:#063d31}
        table{border-collapse:collapse;width:100%;margin-bottom:14px;mso-table-lspace:0pt;mso-table-rspace:0pt}
        th{background:#064b3b;color:#fff;font-weight:bold}
        th,td{border:1px solid #9fc8ba;padding:8px;text-align:center;vertical-align:middle;white-space:pre-wrap}
        .title{font-size:22px;font-weight:bold;background:#e8f4ee;color:#063d31;text-align:center}
        .meta{background:#f6fbf9;color:#063d31;font-weight:bold;text-align:right}
        .section-title{background:#dff1ea;color:#063d31;font-weight:bold;font-size:16px;text-align:right}
      </style>
    </head><body>
      <table border="1"><tr><td class="title" colspan="20">${esc(reportTitle())}</td></tr>
      <tr><td class="meta" colspan="20">شركة تصنيف لإدارة المرافق</td></tr>
      <tr><td class="meta" colspan="20">تاريخ التصدير: ${esc(new Date().toLocaleString('ar-SA'))}</td></tr>
      ${filters?`<tr><td class="meta" colspan="20">الفلاتر: ${esc(filters)}</td></tr>`:''}</table>
      ${body}
    </body></html>`;
  }

  function downloadExcel(){
    try{
      // تأكد من تطبيق فلتر التصنيف قبل التصدير.
      if(typeof window.financeReportsApplyClassFilterV10173==='function') window.financeReportsApplyClassFilterV10173();
      const html=buildExcelHtml();
      const blob=new Blob(['\ufeff',html],{type:'application/vnd.ms-excel;charset=utf-8'});
      const a=document.createElement('a');
      const name=cleanFileName(reportTitle())+'-'+today()+'.xls';
      a.href=URL.createObjectURL(blob); a.download=name;
      document.body.appendChild(a); a.click();
      setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},700);
    }catch(e){ alert('تعذر تصدير Excel: '+(e&&e.message?e.message:e)); }
  }

  function addButton(){
    ensureStyle();
    const bar=document.querySelector('#finBodyV15 .fin-actions') || document.querySelector('#finReportWindowV15')?.closest('.fin-card')?.querySelector('.fin-actions');
    if(bar && !$('finReportsExcelBtnV10173')){
      const btn=document.createElement('button'); btn.type='button'; btn.id='finReportsExcelBtnV10173'; btn.className='fin-excel-btn-v10173'; btn.textContent='تصدير Excel'; btn.onclick=downloadExcel;
      const print=[...bar.querySelectorAll('button')].find(b=>/طباعة/.test(S(b.textContent)));
      if(print) print.parentNode.insertBefore(btn, print.nextSibling); else bar.appendChild(btn);
    }
    const toolbar=document.querySelector('.fpr-toolbar');
    if(toolbar && !toolbar.querySelector('.fin-excel-btn-v10173')){
      const btn=document.createElement('button'); btn.type='button'; btn.className='fin-excel-btn-v10173'; btn.textContent='تصدير Excel'; btn.onclick=downloadExcel; toolbar.appendChild(btn);
    }
  }

  function patch(){
    ['financeProRenderReportsV15','financeProReportTabV15','financeProRenderCurrentV15','financeProRenderProductsReportV10170'].forEach(fn=>{
      const old=window[fn];
      if(typeof old==='function' && old.__excelV10173!=='1'){
        const wrap=function(){ const r=old.apply(this,arguments); setTimeout(addButton,120); setTimeout(addButton,600); return r; };
        wrap.__excelV10173='1'; window[fn]=wrap;
      }
    });
  }
  function boot(){ patch(); addButton(); }
  window.financeProExportActiveReportExcelV10173=downloadExcel;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.addEventListener('load',()=>{setTimeout(boot,700);setTimeout(boot,1800);},{once:true});
  try{new MutationObserver(()=>setTimeout(addButton,120)).observe(document.documentElement,{childList:true,subtree:true});}catch(_){ }
  console.log('Loaded '+VERSION);
})();

/* Tasneef v10173/v10174 - Finance reports real XLSX export
   Scope: finance/inventory report tabs only.
   Exports the currently rendered report after active filters are applied. */
(function(){
  'use strict';
  if(window.__tasneefFinanceReportsExcelExportV10173) return;
  window.__tasneefFinanceReportsExcelExportV10173=true;

  const S=v=>String(v??'').trim();
  const $=id=>document.getElementById(id);
  const state=()=>window.financeProStateV15||{};
  const today=()=>new Date().toISOString().slice(0,10);
  const xml=v=>S(v).replace(/[<>&'"]/g,m=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[m]));
  const cleanFileName=v=>S(v).replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'').slice(0,90)||'finance_report';
  const visible=el=>{
    if(!el) return false;
    if(el.closest('.v10174-class-hidden,.v10172-class-hidden,.v10171-class-hidden,.v10170-class-hidden')) return false;
    const cs=getComputedStyle(el);
    return cs.display!=='none' && cs.visibility!=='hidden' && Number(cs.opacity)!==0;
  };

  function ensureStyle(){
    if($('finReportsExcelStyleV10173')) return;
    const st=document.createElement('style');
    st.id='finReportsExcelStyleV10173';
    st.textContent=`
      .fin-excel-btn-v10173{background:#0b5a45!important;color:#fff!important;border:0!important;border-radius:12px!important;padding:10px 16px!important;font-weight:900!important;cursor:pointer!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;min-height:40px!important}
      .fin-excel-btn-v10173:hover{filter:brightness(.96)}
      .fpr-toolbar .fin-excel-btn-v10173{margin-inline-start:8px}
    `;
    document.head.appendChild(st);
  }
  function reportBox(){return $('finReportWindowV15') || document.querySelector('#finBodyV15 [id*="Report"], #finBodyV15 .fin-card') || document.querySelector('#finBodyV15');}
  function reportTitle(){
    const st=state();
    const tab=S(st.reportTab||'');
    const active=S(document.querySelector('#finBodyV15 .active, #finBodyV15 button.active')?.textContent||'');
    if(/استهلاك/.test(active)||tab==='costConsumption') return 'تقرير استهلاك مراكز التكلفة';
    if(/جرد/.test(active)||tab==='inventory') return 'تقرير جرد المخزون';
    if(/حركة/.test(active)||tab==='movements') return 'تقرير حركة المخزون';
    if(/مراكز/.test(active)||tab==='centers') return 'تقرير مراكز التكلفة';
    if(/منتجات|المنتجات/.test(active)||tab==='products') return 'تقرير المنتجات';
    return S(reportBox()?.querySelector('h1,h2,h3,b')?.textContent)||'تقرير المالية والمخزون';
  }
  function filterSummary(){
    const ids=[
      ['بحث','finReportSearchV15'],['من تاريخ','finReportFromV15'],['إلى تاريخ','finReportToV15'],
      ['مركز التكلفة','finReportCenterV15'],['النوع','finReportTypeV15'],['المشروع','finReportProjectV15'],
      ['المنتج','finReportProductV15'],['الحركة المطلوبة','finReportMoveTypeV15'],['تصنيف المنتج','finReportProductClassV10169']
    ];
    return ids.map(([label,id])=>{
      const el=$(id);
      if(!el) return '';
      const val=S(el.tagName==='SELECT' ? (el.selectedOptions?.[0]?.textContent||el.value) : el.value);
      if(!val || /كل|اختيار|اختر/.test(val)) return '';
      return `${label}: ${val}`;
    }).filter(Boolean).join(' | ');
  }

  function extractRows(){
    if(typeof window.financeReportsApplyClassFilterV10174==='function') window.financeReportsApplyClassFilterV10174();
    else if(typeof window.financeReportsApplyClassFilterV10173==='function') window.financeReportsApplyClassFilterV10173();

    const box=reportBox();
    if(!box) throw new Error('لا يوجد تقرير ظاهر للتصدير');

    const title=reportTitle();
    const rows=[
      [title],
      ['شركة تصنيف لإدارة المرافق'],
      ['تاريخ التصدير', new Date().toLocaleString('ar-SA')],
    ];
    const filters=filterSummary();
    if(filters) rows.push(['الفلاتر', filters]);
    rows.push([]);

    const tables=[...box.querySelectorAll('table')].filter(visible);
    tables.forEach((table,idx)=>{
      const sectionTitle=S(table.closest('section,article,.fpr-product,.fin-card')?.querySelector('h2,h3,b')?.textContent||'');
      if(sectionTitle) rows.push([sectionTitle]);
      [...table.rows].filter(visible).forEach(row=>{
        rows.push([...row.cells].filter(visible).map(cell=>S(cell.innerText||cell.textContent).replace(/\s+\n/g,'\n').replace(/\n\s+/g,'\n').replace(/\s{2,}/g,' ')));
      });
      if(idx<tables.length-1) rows.push([]);
    });

    if(tables.length===0){
      const cards=[...box.querySelectorAll('.fin-product-card,.fin-card,.fpr-product')].filter(visible);
      cards.forEach(card=>{
        if(card.querySelector('table')) return;
        const text=S(card.innerText||card.textContent).replace(/\n+/g,' | ').replace(/\s{2,}/g,' ');
        if(text) rows.push([text]);
      });
    }
    if(rows.length<=5) rows.push(['لا توجد بيانات']);
    return rows;
  }

  function colName(n){
    let s='';
    while(n>0){
      const m=(n-1)%26;
      s=String.fromCharCode(65+m)+s;
      n=Math.floor((n-1)/26);
    }
    return s;
  }
  function styleForCell(r,c,value,row){
    if(r===1) return 1;
    if(r<=4) return 2;
    if(row.length===1 && value) return 3;
    if(r>4 && row.every(Boolean) && row.length>1 && row.some(x=>/المجموع|الإجمالي|الاجمالي/.test(S(x)))) return 4;
    return 0;
  }
  function sheetXml(rows){
    const maxCols=Math.max(1,...rows.map(r=>r.length));
    const cols=Array.from({length:maxCols},(_,i)=>`<col min="${i+1}" max="${i+1}" width="${i===0?28:18}" customWidth="1"/>`).join('');
    const body=rows.map((row,ri)=>{
      const r=ri+1;
      const cells=row.map((value,ci)=>{
        const c=colName(ci+1)+r;
        const s=styleForCell(r,ci+1,value,row);
        return `<c r="${c}" t="inlineStr" s="${s}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
      }).join('');
      return `<row r="${r}">${cells}</row>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews>
  <cols>${cols}</cols>
  <sheetData>${body}</sheetData>
</worksheet>`;
  }
  function workbookXml(){
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <workbookPr/>
  <sheets><sheet name="التقرير" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
  }
  function workbookRels(){
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
  }
  function rootRels(){
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  }
  function contentTypes(){
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
  }
  function stylesXml(){
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><name val="Tahoma"/></font>
    <font><b/><sz val="18"/><color rgb="FF063D31"/><name val="Tahoma"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Tahoma"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE8F4EE"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF064B3B"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="5">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  }

  function crc32(bytes){
    let c=-1;
    for(let i=0;i<bytes.length;i++){
      c=(c>>>8)^crcTable[(c^bytes[i])&255];
    }
    return (c^(-1))>>>0;
  }
  const crcTable=(()=>{const t=[]; for(let n=0;n<256;n++){let c=n; for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1); t[n]=c>>>0;} return t;})();
  function u16(n){return [n&255,(n>>>8)&255];}
  function u32(n){return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];}
  function dosDateTime(){
    const d=new Date();
    return {
      time:((d.getHours()<<11)|(d.getMinutes()<<5)|(Math.floor(d.getSeconds()/2)))&0xffff,
      date:(((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate())&0xffff
    };
  }
  function zipStore(files){
    const enc=new TextEncoder();
    const chunks=[];
    const central=[];
    let offset=0;
    const dt=dosDateTime();
    files.forEach(file=>{
      const name=enc.encode(file.name);
      const data=enc.encode(file.content);
      const crc=crc32(data);
      const local=new Uint8Array([
        ...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(dt.time),...u16(dt.date),
        ...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0)
      ]);
      chunks.push(local,name,data);
      central.push({name,data,crc,offset});
      offset+=local.length+name.length+data.length;
    });
    const centralStart=offset;
    central.forEach(file=>{
      const head=new Uint8Array([
        ...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(dt.time),...u16(dt.date),
        ...u32(file.crc),...u32(file.data.length),...u32(file.data.length),...u16(file.name.length),...u16(0),...u16(0),
        ...u16(0),...u16(0),...u32(0),...u32(file.offset)
      ]);
      chunks.push(head,file.name);
      offset+=head.length+file.name.length;
    });
    const centralSize=offset-centralStart;
    chunks.push(new Uint8Array([
      ...u32(0x06054b50),...u16(0),...u16(0),...u16(central.length),...u16(central.length),
      ...u32(centralSize),...u32(centralStart),...u16(0)
    ]));
    return new Blob(chunks,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  function buildXlsx(rows){
    return zipStore([
      {name:'[Content_Types].xml',content:contentTypes()},
      {name:'_rels/.rels',content:rootRels()},
      {name:'xl/workbook.xml',content:workbookXml()},
      {name:'xl/_rels/workbook.xml.rels',content:workbookRels()},
      {name:'xl/styles.xml',content:stylesXml()},
      {name:'xl/worksheets/sheet1.xml',content:sheetXml(rows)}
    ]);
  }
  function downloadExcel(){
    try{
      const rows=extractRows();
      const blob=buildXlsx(rows);
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download=`${cleanFileName(reportTitle())}_${today()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},700);
    }catch(e){
      alert('تعذر تصدير Excel: '+(e&&e.message?e.message:e));
    }
  }
  function addButton(){
    ensureStyle();
    const bar=document.querySelector('#finBodyV15 .fin-actions') || document.querySelector('#finReportWindowV15')?.closest('.fin-card')?.querySelector('.fin-actions');
    if(bar && !$('finReportsExcelBtnV10173')){
      const btn=document.createElement('button');
      btn.type='button';
      btn.id='finReportsExcelBtnV10173';
      btn.className='fin-excel-btn-v10173';
      btn.textContent='تصدير Excel';
      btn.onclick=downloadExcel;
      const print=[...bar.querySelectorAll('button')].find(b=>/طباعة|print/i.test(S(b.textContent)));
      if(print) print.parentNode.insertBefore(btn,print.nextSibling);
      else bar.appendChild(btn);
    }
    const toolbar=document.querySelector('.fpr-toolbar');
    if(toolbar && !toolbar.querySelector('.fin-excel-btn-v10173')){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='fin-excel-btn-v10173';
      btn.textContent='تصدير Excel';
      btn.onclick=downloadExcel;
      toolbar.appendChild(btn);
    }
  }
  function patch(){
    ['financeProRenderReportsV15','financeProReportTabV15','financeProRenderCurrentV15','financeProRenderProductsReportV10170'].forEach(fn=>{
      const old=window[fn];
      if(typeof old==='function' && old.__excelV10173!=='1'){
        const wrap=function(){
          const r=old.apply(this,arguments);
          setTimeout(addButton,120);
          setTimeout(addButton,600);
          return r;
        };
        wrap.__excelV10173='1';
        window[fn]=wrap;
      }
    });
  }
  function boot(){patch(); addButton();}

  window.financeProExportActiveReportExcelV10173=downloadExcel;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.addEventListener('load',()=>{setTimeout(boot,700);setTimeout(boot,1800);},{once:true});
  try{new MutationObserver(()=>setTimeout(addButton,120)).observe(document.documentElement,{childList:true,subtree:true});}catch(_){}
  console.log('Loaded v10173-finance-reports-real-xlsx-export');
})();

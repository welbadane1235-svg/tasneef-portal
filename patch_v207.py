from pathlib import Path
base=Path('/mnt/data/v207work')
app=base/'app.js'
s=app.read_text(encoding='utf-8')
insert = r'''

/* ===================== V207: DIRECT TICKETS PDF DOWNLOAD GROUPED BY SUPERVISOR =====================
   - تنزيل PDF مباشر في مجلد التنزيلات باستخدام html2pdf.
   - التقرير حسب الفلاتر الحالية.
   - ترتيب التكتات تحت اسم كل مشرف.
   - إظهار من رفع التكت حتى لو كان إداريًا.
=============================================================================================== */
(function(){
  'use strict';
  window.TASNEEF_BUILD = 'V207_TICKETS_DIRECT_PDF_GROUPED_BY_SUPERVISOR_2026_05_20';
  const $ = id => document.getElementById(id);
  const arr = v => Array.isArray(v) ? v : [];
  const S = v => String(v ?? '').trim();
  const E = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const say = (t,type) => { try{ if(typeof msg==='function') msg(t,type); else alert(t); }catch(_){ alert(t); } };
  const ticketNo = t => t?.ticket_number || ('T-' + String(t?.id || 0).padStart(4,'0'));
  const stLabel = st => st==='closed'?'مغلق':(st==='processing'?'تحت المعالجة':'مفتوح');
  const prLabel = p => p==='urgent'?'عاجل':(p==='high'?'مهم':(p==='low'?'منخفض':'عادي'));
  const safeDate = v => { try{ return v ? new Date(v).toLocaleString('ar-SA') : '-'; }catch(_){ return S(v)||'-'; } };
  const dayOnly = v => { try{ return v ? new Date(v).toLocaleDateString('ar-SA') : '-'; }catch(_){ return S(v)||'-'; } };
  const projectLabel = id => { try{ return typeof projectName==='function' ? projectName(id) : '-'; }catch(_){ return '-'; } };
  const supervisorLabel = id => { try{ return typeof supervisorName==='function' ? supervisorName(id) : '-'; }catch(_){ return '-'; } };
  function userLabel(id){
    if(!S(id)) return '-';
    const u = arr(window.data?.users).find(x => S(x.id)===S(id) || S(x.user_id)===S(id) || S(x.username)===S(id));
    if(u) return S(u.full_name || u.name || u.username || id);
    return S(id);
  }
  function raisedBy(t){
    return S(t.created_by_name || t.created_by_full_name || t.raised_by_name || t.created_name || t.created_user_name) || userLabel(t.created_by || t.raised_by || t.user_id || t.created_user_id);
  }
  function durationText(t){
    try{
      if(typeof durationLabel==='function' && typeof minutesBetween==='function'){
        const end = t.status==='closed' ? (t.closed_at || t.updated_at || new Date().toISOString()) : new Date().toISOString();
        const m = t.open_duration_minutes != null && t.status==='closed' ? Number(t.open_duration_minutes||0) : minutesBetween(t.created_at, end);
        return durationLabel(m);
      }
    }catch(_){ }
    return '-';
  }
  function currentTicketFilters(){
    const adminMode = !!$('ticketsBody');
    if(adminMode){
      return {
        mode:'admin',
        status:$('ticketFilterStatus')?.value||'',
        search:S($('ticketSearch')?.value).toLowerCase(),
        project:'',
        supervisor:''
      };
    }
    return {
      mode:'supervisor',
      status:$('supTicketFilterStatus')?.value||'',
      search:S($('supTicketSearch')?.value).toLowerCase(),
      project:$('supTicketFilterProject')?.value||'',
      supervisor:''
    };
  }
  function ticketsForCurrentFilterV207(){
    const f=currentTicketFilters();
    let list=arr(window.data?.tickets).slice();
    if(f.project) list=list.filter(t=>S(t.project_id)===S(f.project));
    if(f.supervisor) list=list.filter(t=>S(t.supervisor_id)===S(f.supervisor));
    if(f.status) list=list.filter(t=>S(t.status || 'open')===S(f.status));
    if(f.search){
      list=list.filter(t=>[
        ticketNo(t), t.title, t.description, projectLabel(t.project_id), supervisorLabel(t.supervisor_id),
        stLabel(t.status), prLabel(t.priority), t.claimed_by_name, t.closed_by_name, t.closure_note, raisedBy(t)
      ].join(' ').toLowerCase().includes(f.search));
    }
    return list.sort((a,b)=>{
      const sa=supervisorLabel(a.supervisor_id), sb=supervisorLabel(b.supervisor_id);
      if(sa!==sb) return sa.localeCompare(sb,'ar');
      return new Date(b.created_at||0)-new Date(a.created_at||0);
    });
  }
  function filterSummaryTextV207(){
    const f=currentTicketFilters();
    const bits=[];
    bits.push('الحالة: '+(f.status?stLabel(f.status):'كل الحالات'));
    if(f.project) bits.push('المشروع: '+projectLabel(f.project));
    if(f.search) bits.push('البحث: '+S(f.search));
    return bits.join(' | ');
  }
  function groupBySupervisor(list){
    const m=new Map();
    list.forEach(t=>{
      const key=S(t.supervisor_id)||'without_supervisor';
      const name=S(supervisorLabel(t.supervisor_id)) || 'بدون مشرف';
      if(!m.has(key)) m.set(key,{name,rows:[]});
      m.get(key).rows.push(t);
    });
    return Array.from(m.values()).sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  }
  function buildTicketsPdfNodeV207(list, title){
    const groups=groupBySupervisor(list);
    const root=document.createElement('div');
    root.dir='rtl';
    root.className='tasneef-ticket-pdf-v207';
    const total=list.length;
    const open=list.filter(t=>S(t.status||'open')==='open').length;
    const processing=list.filter(t=>S(t.status)==='processing').length;
    const closed=list.filter(t=>S(t.status)==='closed').length;
    root.innerHTML = `
      <style>
        .tasneef-ticket-pdf-v207{font-family:Tahoma,Arial,sans-serif;color:#123b2f;background:#fff;width:1120px;padding:28px;box-sizing:border-box;direction:rtl}
        .tasneef-ticket-pdf-v207 *{box-sizing:border-box}
        .t-header{display:flex;align-items:center;justify-content:space-between;border-bottom:4px solid #0b5b49;padding-bottom:14px;margin-bottom:16px}
        .t-brand{display:flex;align-items:center;gap:12px}.t-logo{width:74px;height:74px;border:2px solid #d7e8e1;border-radius:18px;object-fit:contain;padding:8px;background:#fff}.t-title h1{font-size:30px;margin:0 0 6px;color:#0b5b49}.t-title p{margin:0;color:#5b7168;font-size:14px}.t-company{font-weight:900;color:#0b5b49;font-size:18px;text-align:left}.t-meta{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0 18px}.t-box{border:1px solid #d6e7e0;background:#f3faf7;border-radius:14px;padding:10px}.t-box small{display:block;color:#6a7a73;margin-bottom:5px}.t-box b{font-size:18px;color:#082f27}.super-section{page-break-inside:avoid;margin:18px 0 24px;border:1px solid #cadbd4;border-radius:15px;overflow:hidden}.super-head{background:#2779b7;color:#fff;padding:10px 13px;font-weight:900;font-size:17px;display:flex;justify-content:space-between}.ticket-table{width:100%;border-collapse:collapse;font-size:12px}.ticket-table th{background:#e9f1f5;color:#123b2f;border:1px solid #c8d6dc;padding:8px;text-align:right}.ticket-table td{border:1px solid #d7e0e4;padding:8px;vertical-align:top}.ticket-table tr:nth-child(even) td{background:#f6f9fb}.status{font-weight:800;border-radius:999px;padding:3px 8px;display:inline-block}.status.open{background:#ffe7e7;color:#9d2020}.status.processing{background:#fff3d2;color:#8a5c00}.status.closed{background:#e4f5ea;color:#0b7338}.desc{max-width:260px;white-space:pre-wrap;line-height:1.55}.footer{margin-top:18px;padding-top:10px;border-top:1px solid #d5e3dd;color:#71837b;text-align:center;font-size:12px}.empty{border:1px dashed #bdd4ca;border-radius:14px;padding:25px;text-align:center;color:#677b72}.page-break{page-break-after:always}@media print{.tasneef-ticket-pdf-v207{width:auto}.super-section{page-break-inside:avoid}}
      </style>
      <div class="t-header"><div class="t-brand"><img class="t-logo" src="tasneef_logo_print.png" onerror="this.style.display='none'"><div class="t-title"><h1>${E(title)}</h1><p>${E(filterSummaryTextV207())}</p><p>تاريخ التصدير: ${E(new Date().toLocaleString('ar-SA'))}</p></div></div><div class="t-company">شركة تصنيف لإدارة المرافق</div></div>
      <div class="t-meta"><div class="t-box"><small>إجمالي التكتات</small><b>${total}</b></div><div class="t-box"><small>مفتوح</small><b>${open}</b></div><div class="t-box"><small>تحت المعالجة</small><b>${processing}</b></div><div class="t-box"><small>مغلق</small><b>${closed}</b></div></div>
      ${groups.length?'':'<div class="empty">لا توجد تكتات مطابقة للفلاتر الحالية</div>'}
      ${groups.map(g=>`<section class="super-section"><div class="super-head"><span>المشرف: ${E(g.name || 'بدون مشرف')}</span><span>عدد التكتات: ${g.rows.length}</span></div><table class="ticket-table"><thead><tr><th>#</th><th>رقم التكت</th><th>المشروع</th><th>العنوان / الوصف</th><th>الحالة</th><th>الأولوية</th><th>رفع بواسطة</th><th>استلام / إغلاق</th><th>التاريخ</th></tr></thead><tbody>${g.rows.map((t,i)=>`<tr><td>${i+1}</td><td><b>${E(ticketNo(t))}</b></td><td>${E(projectLabel(t.project_id))}</td><td class="desc"><b>${E(t.title||'-')}</b><br>${E(t.description||'-')}</td><td><span class="status ${S(t.status||'open')}">${E(stLabel(t.status))}</span></td><td>${E(prLabel(t.priority))}</td><td>${E(raisedBy(t))}</td><td>استلم: ${E(t.claimed_by_name||'-')}<br>أغلق: ${E(t.closed_by_name||'-')}<br>${t.closure_note?`الحل: ${E(t.closure_note)}`:''}</td><td>${E(dayOnly(t.created_at))}<br><small>${E(durationText(t))}</small></td></tr>`).join('')}</tbody></table></section>`).join('')}
      <div class="footer">تم إنشاء التقرير آليًا من نظام تصنيف — حسب الفلاتر المختارة وقت التنزيل</div>
    `;
    return root;
  }
  function loadHtml2PdfV207(){
    return new Promise((resolve,reject)=>{
      if(window.html2pdf) return resolve(window.html2pdf);
      const old=document.querySelector('script[data-tasneef-html2pdf="1"]');
      if(old){ old.addEventListener('load',()=>resolve(window.html2pdf)); old.addEventListener('error',reject); return; }
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      s.async=true; s.dataset.tasneefHtml2pdf='1';
      s.onload=()=>window.html2pdf?resolve(window.html2pdf):reject(new Error('html2pdf not loaded'));
      s.onerror=()=>reject(new Error('تعذر تحميل مكتبة PDF'));
      document.head.appendChild(s);
    });
  }
  function printFallbackV207(node,title){
    const w=window.open('', '_blank');
    if(!w) return say('المتصفح منع فتح نافذة التقرير. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.','err');
    w.document.open();
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${E(title)}</title></head><body>${node.outerHTML}<script>setTimeout(()=>window.print(),500)<\/script></body></html>`);
    w.document.close();
  }
  async function saveNodeAsPdfV207(node, filename){
    document.body.appendChild(node);
    node.style.position='fixed'; node.style.left='-10000px'; node.style.top='0'; node.style.zIndex='-1';
    try{
      const html2pdf = await loadHtml2PdfV207();
      await html2pdf().set({
        margin: 6,
        filename,
        image: {type:'jpeg', quality:0.98},
        html2canvas: {scale:2, useCORS:true, backgroundColor:'#ffffff', logging:false},
        jsPDF: {unit:'mm', format:'a4', orientation:'landscape'},
        pagebreak: {mode:['avoid-all','css','legacy']}
      }).from(node).save();
      say('تم تنزيل ملف PDF في التنزيلات');
    }catch(e){
      console.warn(e);
      say('تعذر التنزيل المباشر، فتحت لك نافذة الطباعة كحل بديل','err');
      printFallbackV207(node.cloneNode(true), filename.replace(/\.pdf$/,''));
    }finally{
      try{ node.remove(); }catch(_){ }
    }
  }
  window.ticketsDownloadPdfV207 = async function(){
    const list=ticketsForCurrentFilterV207();
    if(!list.length) return say('لا توجد تكتات مطابقة للفلاتر الحالية','err');
    const node=buildTicketsPdfNodeV207(list,'تقرير التكتات حسب المشرف');
    const d=new Date().toISOString().slice(0,10);
    await saveNodeAsPdfV207(node, `تقرير-التكتات-حسب-المشرف-${d}.pdf`);
  };
  window.ticketDownloadPdfV207 = async function(id){
    const t=arr(window.data?.tickets).find(x=>S(x.id)===S(id));
    if(!t) return say('التكت غير موجود','err');
    const node=buildTicketsPdfNodeV207([t], 'تقرير تكت واحد');
    await saveNodeAsPdfV207(node, `تكت-${ticketNo(t)}.pdf`);
  };
  // توافق مع أزرار النسخة السابقة V206 حتى تتحول إلى تنزيل مباشر بدل نافذة طباعة.
  window.ticketsDownloadPdfV206 = window.ticketsDownloadPdfV207;
  window.ticketDownloadPdfV206 = window.ticketDownloadPdfV207;
  function addDownloadButtonsV207(){
    [['ticketPdfBtnV206','ticketsBody'],['supTicketPdfBtnV206','supTicketsBody']].forEach(([btnId,bodyId])=>{
      const btn=$(btnId); if(btn){ btn.textContent='تنزيل PDF'; btn.onclick=window.ticketsDownloadPdfV207; }
      const body=$(bodyId); if(!body || $(btnId)) return;
      const host = body.closest('.card')?.querySelector('.filters') || body.closest('.card')?.querySelector('h2') || body.parentElement;
      const b=document.createElement('button'); b.id=btnId; b.type='button'; b.className='light ticket-pdf-v206 ticket-pdf-v207'; b.textContent='تنزيل PDF'; b.onclick=window.ticketsDownloadPdfV207;
      if(host?.classList?.contains('filters')) host.appendChild(b); else host?.insertAdjacentElement('afterend', b);
    });
  }
  function patchCardsRaisedByV207(){
    document.querySelectorAll('.smart-ticket-card').forEach(card=>{
      if(card.querySelector('.raised-by-v207')) return;
      const noText=S(card.querySelector('.smart-ticket-top strong')?.textContent);
      const t=arr(window.data?.tickets).find(x=>S(ticketNo(x))===noText);
      if(!t) return;
      const mini=card.querySelector('.smart-ticket-mini');
      const line=document.createElement('span'); line.className='raised-by-v207'; line.textContent='رفع بواسطة: '+raisedBy(t);
      if(mini) mini.prepend(line); else card.appendChild(line);
    });
  }
  const oldRender=window.renderTickets;
  window.renderTickets=function(){
    if(typeof oldRender==='function') oldRender.apply(this,arguments);
    setTimeout(()=>{ addDownloadButtonsV207(); patchCardsRaisedByV207(); },60);
  };
  function css(){
    if($('v207Css')) return;
    const st=document.createElement('style'); st.id='v207Css'; st.textContent='.ticket-pdf-v207{background:#07563d!important;color:#fff!important;border-color:#07563d!important}.raised-by-v207{display:inline-block;background:#eef7f3;border:1px solid #d5e7df;border-radius:999px;padding:4px 8px;margin:3px;color:#07563d;font-weight:700}'; document.head.appendChild(st);
  }
  function boot(){ css(); addDownloadButtonsV207(); patchCardsRaisedByV207(); }
  ['DOMContentLoaded','load'].forEach(ev=>window.addEventListener(ev,()=>setTimeout(boot, ev==='load'?1000:350)));
  setTimeout(boot,1400);
  console.log('Tasneef V207 direct tickets PDF download loaded');
})();
'''
# append after v206 block
s = s.rstrip() + insert + "\n"
app.write_text(s,encoding='utf-8')
for name in ['admin.html','supervisor.html','technician.html','index.html']:
    p=base/name
    txt=p.read_text(encoding='utf-8')
    txt=txt.replace('app.js?v=206','app.js?v=207')
    txt=txt.replace('app.js?v=205','app.js?v=207')
    p.write_text(txt,encoding='utf-8')
# update readme
(base/'IMPORTANT_READ_ME.txt').write_text('''نسخة V207 للرفع فقط\n\nالتعديلات:\n1- تنزيل PDF مباشر للتكتات في مجلد التنزيلات.\n2- تقرير التكتات مرتب حسب اسم المشرف، وتحت كل مشرف التكتات الخاصة به.\n3- التقرير يلتزم بالفلاتر الحالية في صفحة التكتات.\n4- يظهر اسم من رفع التكت حتى لو كان إداريًا.\n5- تم تحويل أزرار PDF القديمة من نافذة طباعة إلى تنزيل مباشر، مع بديل طباعة إذا تعذر تحميل مكتبة PDF.\n\nبعد الرفع اضغط Ctrl + F5.\n''',encoding='utf-8')

/* V379 - Supervisor simple client report: one-minute report + photos + direct client portal publish */
(function(){
  'use strict';
  if(window.__tasneefSupervisorClientReportSimpleV379) return;
  window.__tasneefSupervisorClientReportSimpleV379 = true;

  const BUILD='V379_SIMPLE_SUPERVISOR_CLIENT_REPORT';
  const $ = id => document.getElementById(id);
  const S = v => String(v ?? '').trim();
  const E = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const day = () => { try{ if(typeof today==='function') return today(); }catch(_){} return new Date().toISOString().slice(0,10); };
  const say = (t,k) => { try{ if(typeof msg==='function') return msg(t,k); }catch(_){} alert(t); };
  const uid = () => { try{ const u=typeof session==='function'?session():{}; return u||{}; }catch(_){ return {}; } };
  const token = () => { try{ if(typeof genReportToken==='function') return genReportToken(); }catch(_){} return 'r_' + Math.random().toString(36).slice(2,10) + '_' + Date.now().toString(36).slice(-6); };
  const reportNo = () => { try{ if(typeof genReportNo==='function') return genReportNo(); }catch(_){} const d=new Date(); return 'TSF-' + d.getFullYear() + '-' + String(Date.now()).slice(-6); };
  const pName = pid => { try{ if(typeof projectName==='function') return projectName(Number(pid)); }catch(_){} const p=(window.data?.projects||[]).find(x=>S(x.id)===S(pid)); return p?.name || ''; };

  let simpleImages = [];

  function addStyle(){
    if($('simpleClientReportV379Style')) return;
    const st=document.createElement('style');
    st.id='simpleClientReportV379Style';
    st.textContent=`
      .simple-report-v379{border:1px solid #dce7e2;border-radius:22px;background:linear-gradient(180deg,#ffffff,#f8fbfa);padding:16px;margin-top:12px}
      .simple-report-v379 .hint{background:#eef7f3;border:1px solid #dce7e2;border-radius:16px;padding:12px;color:#31564c;line-height:1.8;margin-bottom:12px}
      .simple-report-v379 .split{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .simple-report-v379 textarea{min-height:120px;line-height:1.8}
      .simple-upload-v379{display:flex;gap:10px;align-items:center;justify-content:space-between;border:1px dashed #b9d3c8;border-radius:18px;padding:14px;background:#fbfdfc;margin-top:10px}
      .simple-upload-v379 input{display:none}
      .simple-upload-v379 label{background:#0A4033;color:#fff;border-radius:14px;padding:12px 16px;font-weight:900;cursor:pointer;margin:0}
      .simple-imgs-v379{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}
      .simple-img-v379{border:1px solid #dce7e2;border-radius:16px;overflow:hidden;background:#fff;position:relative}
      .simple-img-v379 img{width:100%;height:140px;object-fit:contain;background:#f7faf9;display:block}
      .simple-img-v379 button{position:absolute;top:6px;left:6px;border:0;background:#b83232;color:#fff;border-radius:10px;padding:5px 9px;cursor:pointer;font-weight:900}
      .simple-status-v379{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;color:#60706a;font-size:13px}
      .simple-report-list-v379 .quick-item{align-items:flex-start}
      @media(max-width:900px){.simple-report-v379 .split,.simple-imgs-v379{grid-template-columns:1fr}.simple-img-v379 img{height:auto;max-height:360px}}
    `;
    document.head.appendChild(st);
  }

  function reportTypes(){ return ['نظافة يومية','صيانة كهرباء','صيانة سباكة','مكافحة حشرات','غسيل خزانات','إزالة نفايات','تنظيف بيسمنت','تنظيف أسطح','صيانة مصاعد','تعطير','تشجير','ملاحظات عامة','أخرى']; }
  function statusTypes(){ return ['مكتمل','قيد المتابعة','يحتاج زيارة إضافية']; }

  function fillProjects(){
    const sel=$('supClientReportProject'); if(!sel) return;
    const current=sel.value;
    if(typeof fillSelect==='function'){
      try{ fillSelect('supClientReportProject', window.data?.projects||[], 'name', 'اختر المشروع'); }catch(_){ }
    }else{
      sel.innerHTML='<option value="">اختر المشروع</option>'+(window.data?.projects||[]).map(p=>`<option value="${E(p.id)}">${E(p.name)}</option>`).join('');
    }
    if(current) sel.value=current;
  }

  function renderEditor(){
    addStyle();
    const card=document.querySelector('.smart-daily-report-card');
    if(!card || card.dataset.simpleV379==='1') return;
    card.dataset.simpleV379='1';
    card.innerHTML=`
      <h2>تقرير العميل اليومي</h2>
      <div class="sup-help">نموذج مبسط للمشرف: اختر المشروع، اكتب العمل المنفذ، أرفق الصور، ثم احفظ. يظهر التقرير مباشرة في بوابة العميل الخاصة بالمشروع.</div>
      <div class="simple-report-v379">
        <div class="hint"><b>طريقة الاستخدام:</b> اكتب تقريرًا مختصرًا وواضحًا للعميل. لا تكتب ملاحظات داخلية أو تكاليف أو أسماء غير ضرورية.</div>
        <div class="split">
          <div><label>المشروع</label><select id="supClientReportProject"></select></div>
          <div><label>تاريخ التقرير</label><input type="date" id="supClientReportDate"></div>
        </div>
        <div class="split">
          <div><label>نوع التقرير</label><select id="supSimpleReportTypeV379">${reportTypes().map(x=>`<option>${E(x)}</option>`).join('')}</select></div>
          <div><label>حالة التقرير</label><select id="supSimpleReportStatusV379">${statusTypes().map(x=>`<option>${E(x)}</option>`).join('')}</select></div>
        </div>
        <label>عنوان التقرير</label><input id="supSimpleReportTitleV379" placeholder="مثال: أعمال النظافة اليومية بالمداخل والمصاعد">
        <label>الأعمال المنفذة</label><textarea id="supSimpleReportDetailsV379" placeholder="مثال: تم تنفيذ أعمال النظافة اليومية في المداخل والممرات والمصاعد، مع إزالة النفايات حسب الجدول التشغيلي."></textarea>
        <div class="simple-upload-v379">
          <div><b>صور التقرير</b><div class="simple-status-v379"><span id="supSimpleImageCountV379">0 صورة</span><span>يفضل صور واضحة قبل/بعد أو أثناء العمل</span></div></div>
          <label>+ إرفاق صور<input type="file" accept="image/*" multiple onchange="supSimpleReportHandleImagesV379(this)"></label>
        </div>
        <div id="supSimpleImagesPreviewV379" class="simple-imgs-v379"></div>
        <div class="actions" style="margin-top:14px"><button onclick="supSimpleSaveClientReportV379(this)">حفظ ونشر في بوابة العميل</button><button class="light" onclick="supSimpleReportResetV379()">تفريغ</button></div>
      </div>
    `;
    fillProjects();
    const d=$('supClientReportDate'); if(d && !d.value) d.value=day();
    renderImages();
    setTimeout(fillProjects,600);
    setTimeout(fillProjects,1600);
  }

  function renderImages(){
    const box=$('supSimpleImagesPreviewV379'); if(!box) return;
    const c=$('supSimpleImageCountV379'); if(c) c.textContent = simpleImages.length + ' صورة';
    box.innerHTML = simpleImages.map((im,i)=>`<div class="simple-img-v379"><img src="${E(im.data||im.url||'')}" alt="صورة التقرير"><button type="button" onclick="supSimpleRemoveImageV379(${i})">حذف</button></div>`).join('');
  }

  window.supSimpleReportHandleImagesV379 = async function(input){
    const files=[...(input.files||[])].slice(0, Math.max(0, 24-simpleImages.length));
    if(!files.length){ say('الحد الأقصى 24 صورة في التقرير الواحد','err'); input.value=''; return; }
    say('جاري تجهيز الصور...');
    for(const f of files){
      try{
        let data='';
        if(typeof compressImageToDataUrl==='function') data=await compressImageToDataUrl(f, 1280, .80);
        else data=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(f); });
        simpleImages.push({name:f.name,type:'image/jpeg',data});
      }catch(e){ console.warn('image failed', e); }
    }
    input.value=''; renderImages(); say('تمت إضافة الصور');
  };
  window.supSimpleRemoveImageV379 = function(i){ simpleImages.splice(i,1); renderImages(); };
  window.supSimpleReportResetV379 = function(){
    ['supSimpleReportTitleV379','supSimpleReportDetailsV379'].forEach(id=>{ if($(id)) $(id).value=''; });
    if($('supSimpleReportTypeV379')) $('supSimpleReportTypeV379').value='نظافة يومية';
    if($('supSimpleReportStatusV379')) $('supSimpleReportStatusV379').value='مكتمل';
    if($('supClientReportDate')) $('supClientReportDate').value=day();
    simpleImages=[]; renderImages();
  };

  window.supSimpleSaveClientReportV379 = async function(btn){
    try{
      if(!window.sb) throw new Error('الاتصال بقاعدة البيانات غير جاهز');
      if(btn){ btn.disabled=true; btn.dataset.oldText=btn.innerHTML; btn.innerHTML='جاري الحفظ...'; }
      const pid=$('supClientReportProject')?.value; if(!pid) throw new Error('اختر المشروع');
      const type=$('supSimpleReportTypeV379')?.value||'تقرير مشروع';
      const status=$('supSimpleReportStatusV379')?.value||'مكتمل';
      const details=S($('supSimpleReportDetailsV379')?.value); if(!details) throw new Error('اكتب الأعمال المنفذة');
      if(!simpleImages.length) throw new Error('أرفق صورة واحدة على الأقل');
      const p=pName(pid)||$('supClientReportProject')?.selectedOptions?.[0]?.textContent||'';
      const date=$('supClientReportDate')?.value||day();
      const title=S($('supSimpleReportTitleV379')?.value) || type;
      const u=uid();
      const publicToken=token();
      const reportRow={
        report_no:reportNo(), project_id:Number(pid), project_name:p, chairman_name:'', chairman_phone:'',
        title:title, report_type:'تقرير يومي من المشرف', report_date:date,
        executive_summary:details, status:'published', public_token:publicToken,
        published_at:new Date().toISOString(), updated_at:new Date().toISOString()
      };
      const r=await sb.from('client_reports').insert(reportRow).select('id,public_token').single();
      if(r.error) throw r.error;
      const serviceRow={
        report_id:r.data.id, sort_order:1, service_type:type, title:title,
        service_description:details, scope_work:'حالة التقرير: '+status,
        notes:`رفع بواسطة: ${u.full_name||u.username||'المشرف'}`,
        before_images:[], during_images:[], after_images:simpleImages
      };
      const se=await sb.from('client_report_services').insert(serviceRow);
      if(se.error) throw se.error;
      say('تم حفظ التقرير وظهر مباشرة في بوابة العميل');
      window.supSimpleReportResetV379();
      try{ if(typeof loadPremiumReportsOnly==='function') await loadPremiumReportsOnly(false); }catch(_){ }
      try{ await renderMyReports(); }catch(_){ }
    }catch(e){ console.error('V379 save failed',e); say(e.message||String(e),'err'); }
    finally{ if(btn){ btn.disabled=false; btn.innerHTML=btn.dataset.oldText||'حفظ ونشر في بوابة العميل'; } }
  };

  async function renderMyReports(){
    const box=$('supClientReportsList'); if(!box) return;
    box.classList.add('simple-report-list-v379');
    const u=uid(); const name=S(u.full_name||u.username);
    let rows=[];
    try{
      const projectIds=[...($('supClientReportProject')?.options||[])].map(o=>S(o.value)).filter(Boolean);
      let q=sb.from('client_reports').select('*').eq('report_type','تقرير يومي من المشرف').order('created_at',{ascending:false}).limit(30);
      if(projectIds.length) q=q.in('project_id', projectIds.map(Number).filter(Boolean));
      const res=await q; if(!res.error) rows=res.data||[];
    }catch(e){ rows=(window.data?.clientReports||[]).filter(r=>S(r.report_type)==='تقرير يومي من المشرف').slice(0,30); }
    box.innerHTML = rows.map(r=>`<div class="quick-item"><div><b>${E(r.title||'تقرير يومي')}</b><br><small>${E(r.project_name||pName(r.project_id)||'-')} - ${E(S(r.report_date).slice(0,10))} - منشور للعميل</small><div style="color:#60706a;margin-top:5px">${E(S(r.executive_summary).slice(0,120))}${S(r.executive_summary).length>120?'...':''}</div></div><span class="badge published">منشور</span></div>`).join('') || '<div class="quick-item">لا توجد تقارير يومية بعد</div>';
  }
  window.supClientRenderMyReports = renderMyReports;

  function boot(){ renderEditor(); setTimeout(fillProjects,400); setTimeout(renderMyReports,900); }
  const oldShow=window.showSupPage || window.showPage;
  if(typeof oldShow==='function'){
    const fnName=window.showSupPage?'showSupPage':'showPage';
    window[fnName]=function(page,btn){ const r=oldShow.apply(this,arguments); if(S(page)==='supClientDailyReport' || S(page)==='clientDailyReport') setTimeout(boot,80); return r; };
  }
  const oldInit=window.supClientReportInit;
  window.supClientReportInit=function(){ try{ if(typeof oldInit==='function') oldInit.apply(this,arguments); }catch(_){} setTimeout(boot,50); };
  document.addEventListener('DOMContentLoaded',()=>{ setTimeout(boot,800); setTimeout(boot,2200); });
  window.addEventListener('load',()=>{ setTimeout(boot,1200); setTimeout(boot,3000); });
  console.log('Tasneef '+BUILD+' loaded');
})();

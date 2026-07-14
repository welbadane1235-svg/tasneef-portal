/* Tasneef V475 - Supervisor client report approval workflow */
(function(){
  if(window.__tasneefReportApprovalV475) return;
  window.__tasneefReportApprovalV475=true;
  const $=id=>document.getElementById(id);
  const E=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const isAdminPage=()=>/admin\.html|\/tasneef-fm\.github\.io\/?$/i.test(location.pathname)||!!document.getElementById('clientReports');
  const newToken=()=> 'cr_'+Date.now().toString(36)+'_'+(crypto?.randomUUID?.()||Math.random().toString(36).slice(2)).replace(/-/g,'');
  const reportUrl=token=>`${location.origin}/client-report.html?token=${encodeURIComponent(token||'')}`;
  window.clientReportUrl=reportUrl;
  let pending=[];
  let pollTimer=null;
  let editingPending=false;

  function style(){
    if($('reportApprovalStyleV475')) return;
    const s=document.createElement('style'); s.id='reportApprovalStyleV475'; s.textContent=`
      .report-bell-v475{position:fixed;top:18px;left:18px;z-index:100050;width:54px;height:54px;border-radius:18px;background:#fff;color:#0A4033;border:1px solid #d5e6df;box-shadow:0 14px 34px rgba(0,0,0,.16);display:grid;place-items:center;font-size:25px;cursor:pointer}
      .report-bell-v475:hover{transform:translateY(-1px)}.report-bell-count-v475{position:absolute;top:-7px;right:-7px;min-width:24px;height:24px;border-radius:999px;background:#b83232;color:#fff;border:3px solid #fff;font-size:12px;font-weight:900;display:grid;place-items:center;padding:0 5px}.report-bell-count-v475.zero{display:none}
      .report-review-backdrop-v475{position:fixed;inset:0;z-index:100060;background:rgba(3,26,20,.58);display:grid;place-items:center;padding:16px;backdrop-filter:blur(4px)}.report-review-backdrop-v475.hidden{display:none!important}.report-review-modal-v475{width:min(1050px,97vw);max-height:93vh;overflow:auto;background:#f7fbf9;border-radius:25px;box-shadow:0 30px 90px rgba(0,0,0,.3)}
      .report-review-head-v475{position:sticky;top:0;z-index:2;background:linear-gradient(135deg,#063f32,#0A5A49);color:#fff;padding:15px 18px;display:flex;justify-content:space-between;align-items:center;gap:10px}.report-review-head-v475 h2{margin:0;color:#fff}.report-review-body-v475{padding:16px}.report-pending-card-v475{background:#fff;border:1px solid #d8e8e1;border-radius:20px;padding:15px;margin-bottom:12px;box-shadow:0 8px 22px rgba(10,64,51,.06)}
      .report-pending-top-v475{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.report-pending-card-v475 h3{margin:0 0 5px;color:#0A4033}.report-pending-meta-v475{display:flex;gap:7px;flex-wrap:wrap;margin:9px 0}.report-pill-v475{background:#eef7f3;border:1px solid #d6e8e0;color:#0A4033;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:800}.report-pill-v475.wait{background:#fff5dc;color:#805c00;border-color:#efdca2}.report-actions-v475{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.report-actions-v475 button{min-width:120px}.report-preview-services-v475{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:12px}.report-service-v475{border:1px solid #dce9e4;border-radius:15px;padding:10px;background:#fbfdfc}.report-service-v475 img{width:64px;height:55px;object-fit:cover;border-radius:9px;margin:3px;border:1px solid #dfe8e4}.report-empty-v475{text-align:center;padding:35px;color:#60706a}.report-edit-notice-v475{background:#fff5dc;border:1px solid #efdca2;color:#715500;padding:10px;border-radius:13px;margin-bottom:10px;font-weight:800}
      @media(max-width:700px){.report-bell-v475{top:10px;left:10px}.report-pending-top-v475{display:block}.report-actions-v475 button{flex:1}.report-review-backdrop-v475{padding:0;align-items:end}.report-review-modal-v475{width:100%;max-height:95vh;border-radius:25px 25px 0 0}}
    `; document.head.appendChild(s);
  }
  function ensureUI(){
    if(!isAdminPage()) return;
    style();
    if(!$('reportBellV475')){
      const b=document.createElement('button'); b.id='reportBellV475'; b.className='report-bell-v475'; b.type='button'; b.title='تقارير المشرفين بانتظار الاعتماد'; b.innerHTML=`🔔<span id="reportBellCountV475" class="report-bell-count-v475 zero">0</span>`; b.onclick=openList; document.body.appendChild(b);
    }
    if(!$('reportReviewBackdropV475')){
      const m=document.createElement('div'); m.id='reportReviewBackdropV475'; m.className='report-review-backdrop-v475 hidden'; m.innerHTML=`<div class="report-review-modal-v475"><div class="report-review-head-v475"><div><h2>تقارير بانتظار الاعتماد</h2><small id="reportReviewSubV475">تقارير أرسلها المشرفون ولم تظهر للعملاء بعد</small></div><button class="light" onclick="tasneefCloseReportReviewV475()">إغلاق</button></div><div id="reportReviewBodyV475" class="report-review-body-v475"></div></div>`; document.body.appendChild(m);
    }
  }
  async function loadPending(silent=true){
    if(!isAdminPage()||!window.sb) return [];
    ensureUI();
    try{
      const r=await sb.from('client_reports').select('*').eq('status','draft').ilike('report_type','%المشرف%').order('created_at',{ascending:false}).limit(100);
      if(r.error) throw r.error;
      pending=r.data||[];
      const c=$('reportBellCountV475'); if(c){c.textContent=pending.length>99?'99+':String(pending.length); c.classList.toggle('zero',!pending.length);}
      if(!$('reportReviewBackdropV475')?.classList.contains('hidden')) await renderList();
      return pending;
    }catch(e){ if(!silent&&window.msg) msg(e.message||String(e),'err'); return []; }
  }
  async function services(reportId){
    try{const r=await sb.from('client_report_services').select('*').eq('report_id',reportId).order('sort_order',{ascending:true}); return r.data||[];}catch(_){return [];}
  }
  function imgs(s){return [...(s.before_images||[]),...(s.during_images||[]),...(s.after_images||[])].map(x=>typeof x==='string'?x:(x?.data||x?.url||'')).filter(Boolean);}
  async function renderList(){
    const box=$('reportReviewBodyV475'); if(!box) return;
    if(!pending.length){box.innerHTML='<div class="report-empty-v475">لا توجد تقارير تنتظر الاعتماد حاليًا.</div>';return;}
    box.innerHTML='<div class="report-empty-v475">جاري تحميل تفاصيل التقارير...</div>';
    const cards=[];
    for(const r of pending){
      const ss=await services(r.id);
      const svc=ss.map(s=>{const pictures=imgs(s).slice(0,6);return `<div class="report-service-v475"><b>${E(s.title||s.service_type||'خدمة')}</b><p>${E(s.service_description||s.scope_work||'')}</p><div>${pictures.map(x=>`<img src="${E(x)}" loading="lazy">`).join('')}</div></div>`}).join('');
      cards.push(`<article class="report-pending-card-v475"><div class="report-pending-top-v475"><div><h3>${E(r.title||'تقرير المشرف')}</h3><div>${E(r.project_name||'')}</div></div><span class="report-pill-v475 wait">بانتظار الاعتماد</span></div><div class="report-pending-meta-v475"><span class="report-pill-v475">${E(String(r.report_date||'').slice(0,10))}</span><span class="report-pill-v475">${E(r.report_type||'تقرير من المشرف')}</span><span class="report-pill-v475">${ss.length} خدمة</span></div><p>${E(r.executive_summary||'')}</p>${svc?`<div class="report-preview-services-v475">${svc}</div>`:''}<div class="report-actions-v475"><button onclick="tasneefApproveSupervisorReportV475('${E(r.id)}',this)">اعتماد ونشر</button><button class="light" onclick="tasneefEditSupervisorReportV475('${E(r.id)}')">تعديل ثم نشر</button></div></article>`);
    }
    box.innerHTML=cards.join('');
  }
  async function openList(){ensureUI(); $('reportReviewBackdropV475')?.classList.remove('hidden'); await loadPending(false); await renderList();}
  window.tasneefCloseReportReviewV475=()=>$('reportReviewBackdropV475')?.classList.add('hidden');
  window.tasneefApproveSupervisorReportV475=async function(id,btn){
    try{
      if(btn){btn.disabled=true;btn.textContent='جاري الاعتماد...';}
      const row=pending.find(x=>String(x.id)===String(id))||{};
      const token=row.public_token||newToken();
      const u=typeof session==='function'?(session()||{}):{};
      const up=await sb.from('client_reports').update({status:'published',public_token:token,published_at:new Date().toISOString(),updated_at:new Date().toISOString(),approval_note:`اعتمد بواسطة: ${u.full_name||u.username||'الإدارة'}`}).eq('id',id);
      if(up.error){
        // approval_note may not exist in older schemas: retry only standard columns.
        const retry=await sb.from('client_reports').update({status:'published',public_token:token,published_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id); if(retry.error) throw retry.error;
      }
      if(window.msg) msg('تم اعتماد التقرير ونشره في بوابة العميل');
      await loadPending(true);
      const url=reportUrl(token);
      if(confirm('تم النشر بنجاح. هل تريد فتح تقرير العميل الآن؟')) window.open(url,'_blank');
    }catch(e){if(window.msg)msg(e.message||String(e),'err');else alert(e.message||String(e));}
    finally{if(btn){btn.disabled=false;btn.textContent='اعتماد ونشر';}}
  };
  window.tasneefEditSupervisorReportV475=function(id){
    editingPending=true;
    window.__tasneefPendingReportEditId=id;
    tasneefCloseReportReviewV475();
    try{
      if(typeof showPage==='function') showPage('clientReports');
      if(typeof editPremiumReport==='function') editPremiumReport(id);
      setTimeout(()=>{
        if(typeof tasneefOpenReportModal213==='function') tasneefOpenReportModal213('edit');
        const card=$('premiumReportFormCard');
        if(card&&!$('reportEditNoticeV475')){const n=document.createElement('div');n.id='reportEditNoticeV475';n.className='report-edit-notice-v475';n.textContent='هذا تقرير من المشرف بانتظار الاعتماد. عند حفظ التعديل سيتم اعتماده ونشره مباشرة للعميل.';card.insertBefore(n,card.firstChild);}
      },250);
    }catch(e){if(window.msg)msg(e.message||String(e),'err');}
  };
  function wrapAdminSave(){
    const old=window.savePremiumReport; if(typeof old!=='function'||old.__approvalV475) return;
    const wrapped=async function(status='draft'){
      if(editingPending||window.__tasneefPendingReportEditId) status='published';
      const out=await old.call(this,status);
      if(status==='published'){editingPending=false;window.__tasneefPendingReportEditId='';$('reportEditNoticeV475')?.remove();setTimeout(()=>loadPending(true),400);}
      return out;
    }; wrapped.__approvalV475=true; window.savePremiumReport=wrapped;
  }
  function boot(){
    if(!isAdminPage()) return;
    ensureUI(); wrapAdminSave(); loadPending(true);
    clearInterval(pollTimer); pollTimer=setInterval(()=>loadPending(true),30000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadPending(true);});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,900)); else setTimeout(boot,900);
  window.addEventListener('load',()=>setTimeout(boot,1400));
})();

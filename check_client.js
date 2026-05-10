
const SUPABASE_URL = "https://zmjdqiswytxlbfgnfjfv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let currentReport=null, currentServices=[];
let galleryCache={}, activeGallery=[], activeGalleryIndex=0, touchStartX=0;
function imgCount(s){ return [...(s.before_images||[]),...(s.during_images||[]),...(s.after_images||[])].length; }
function firstImg(arr){ return (arr&&arr[0]&&(arr[0].data||arr[0].url))||''; }
function getSrc(im){ return (im && (im.data||im.url)) || ''; }
function galleryForService(s){
  const items=[];
  (s.before_images||[]).forEach((im,i)=>items.push({src:getSrc(im),stage:'قبل التنفيذ',no:i+1}));
  (s.during_images||[]).forEach((im,i)=>items.push({src:getSrc(im),stage:'أثناء التنفيذ',no:i+1}));
  (s.after_images||[]).forEach((im,i)=>items.push({src:getSrc(im),stage:'بعد التنفيذ',no:i+1}));
  return items.filter(x=>x.src);
}
function openGallery(serviceId,index){ activeGallery=galleryCache[String(serviceId)]||[]; activeGalleryIndex=index||0; if(!activeGallery.length) return; renderGallery(); $('imgModal').classList.add('open'); }
function renderGallery(){
  const item=activeGallery[activeGalleryIndex]||activeGallery[0]; if(!item) return;
  $('modalImg').src=item.src; $('modalStage').textContent=item.stage; $('modalCounter').textContent=(activeGalleryIndex+1)+' / '+activeGallery.length;
  $('modalDots').innerHTML=activeGallery.map((_,i)=>`<span class="modal-dot ${i===activeGalleryIndex?'active':''}" onclick="goGallery(${i},event)"></span>`).join('');
}
function moveGallery(dir,e){ if(e) e.stopPropagation(); if(!activeGallery.length) return; activeGalleryIndex=(activeGalleryIndex+dir+activeGallery.length)%activeGallery.length; renderGallery(); }
function goGallery(i,e){ if(e) e.stopPropagation(); activeGalleryIndex=i; renderGallery(); }
function closeGallery(e){ if(e) e.stopPropagation(); $('imgModal').classList.remove('open'); }
function modalBackdropClose(e){ if(e.target.id==='imgModal') closeGallery(e); }
function jumpToService(id){ const el=$('service-'+id); if(!el) return; el.scrollIntoView({behavior:'smooth',block:'start'}); setTimeout(()=>{el.classList.add('service-focus'); setTimeout(()=>el.classList.remove('service-focus'),1300);},450); }
function jumpToGates(){ const el=$('serviceGates'); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); }
document.addEventListener('keydown',e=>{ if(!$('imgModal')?.classList.contains('open')) return; if(e.key==='ArrowRight') moveGallery(-1); if(e.key==='ArrowLeft') moveGallery(1); if(e.key==='Escape') closeGallery(); });
document.addEventListener('touchstart',e=>{ if($('imgModal')?.classList.contains('open')) touchStartX=e.changedTouches[0].screenX; },{passive:true});
document.addEventListener('touchend',e=>{ if(!$('imgModal')?.classList.contains('open')) return; const dx=e.changedTouches[0].screenX-touchStartX; if(Math.abs(dx)>50) moveGallery(dx>0?-1:1); },{passive:true});
function iconFor(t){ if(String(t).includes('حشرات')) return '🛡️'; if(String(t).includes('خزانات')) return '💧'; if(String(t).includes('أسطح')) return '🏢'; if(String(t).includes('بيسمنت')) return '🅿️'; if(String(t).includes('كهرباء')) return '💡'; if(String(t).includes('سباكة')) return '🔧'; if(String(t).includes('زراعة')) return '🌿'; return '✅'; }
async function loadClientReport(){
  const token=new URLSearchParams(location.search).get('token');
  if(!token) return showError('رابط التقرير غير صحيح.');
  const {data:report,error}=await sb.from('client_reports').select('*').eq('public_token',token).eq('status','published').maybeSingle();
  if(error || !report) return showError('هذا التقرير غير متاح حاليًا أو لم يتم اعتماده من الإدارة.');
  const {data:services,error:se}=await sb.from('client_report_services').select('*').eq('report_id',report.id).order('sort_order',{ascending:true});
  if(se) return showError('تعذر تحميل خدمات التقرير.');
  currentReport=report; currentServices=services||[]; render();
}
function showError(text){ $('app').className='container loading'; $('app').innerHTML=`<div class="err"><h2>${esc(text)}</h2><p>شركة تصنيف لإدارة المرافق - 920015589</p></div>`; }
function render(){
  const r=currentReport, s=currentServices;
  galleryCache={}; s.forEach(x=>galleryCache[String(x.id)]=galleryForService(x));
  $('app').className='container';
  $('app').innerHTML=`
  <section class="cover">
    <div class="topbar">
      <div class="logo"><div class="logo-mark">ت</div><div><b>شركة تصنيف لإدارة المرافق</b><small>بوابة تقارير العملاء</small></div></div>
      <div class="actions"><button onclick="window.print()">تحميل / طباعة PDF</button><button class="light" onclick="navigator.share?navigator.share({title:document.title,url:location.href}):navigator.clipboard.writeText(location.href)">مشاركة التقرير</button></div>
    </div>
    <h1>${esc(r.title||'تقرير خدمات المشروع')}</h1>
    <p>${esc(r.executive_summary||'تم تنفيذ الأعمال الموضحة في التقرير حسب الخطة التشغيلية المعتمدة.')}</p>
    <div class="meta"><div><small>المشروع</small><b>${esc(r.project_name)}</b></div><div><small>تاريخ التنفيذ</small><b>${esc(r.report_date)}</b></div><div><small>رقم التقرير</small><b>${esc(r.report_no||r.id)}</b></div><div><small>الحالة</small><b>معتمد من الإدارة</b></div></div>
  </section>
  <section class="card reveal"><h2>ملخص التقرير</h2><div class="summary">${esc(r.executive_summary||'').replace(/\n/g,'<br>')}</div></section>
  <section class="card reveal" id="serviceGates"><h2>بوابات الخدمات</h2><div class="service-gates">${s.map((x,i)=>`<div class="gate" onclick="jumpToService('${x.id}')"><div class="gate-icon">${iconFor(x.service_type)}</div><h3>${esc(x.title||x.service_type)}</h3><p><span class="badge">${imgCount(x)} صورة</span> <span class="badge">مكتمل</span></p><small>عرض التفاصيل</small></div>`).join('')||'لا توجد خدمات'}</div></section>
  <section class="card reveal"><h2>مسار تنفيذ الخدمة</h2><div class="timeline"><div class="step"><b>1</b>إعداد التقرير</div><div class="step"><b>2</b>توثيق الصور</div><div class="step"><b>3</b>تنفيذ الخدمة</div><div class="step"><b>4</b>مراجعة الجودة</div><div class="step"><b>5</b>اعتماد الإدارة</div></div></section>
  ${s.map(renderService).join('')}
  <div class="footer">شركة تصنيف لإدارة المرافق<br>920015589</div>`;
  activateReveal();
}
function renderImages(arr, stageName, serviceId, startIndex){
  arr=arr||[];
  if(!arr.length) return '';
  return `<div class="images">${arr.map((im,idx)=>{const src=getSrc(im); return `<div class="img-card" onclick="openGallery('${serviceId}',${startIndex+idx})"><img src="${src}" alt="${esc(stageName)}"><div class="img-caption"><span>${esc(stageName)}</span><span class="img-no">${idx+1}</span></div></div>`}).join('')}</div>`;
}
function renderStage(title, arr, serviceId, startIndex){
  arr=arr||[];
  if(!arr.length) return '';
  return `<div class="stage reveal"><div class="stage-top"><h3>${title}</h3><span class="stage-count">${arr.length} صورة</span></div>${renderImages(arr,title,serviceId,startIndex)}</div>`;
}
function renderCompare(s){
  const before=firstImg(s.before_images), after=firstImg(s.after_images);
  if(!(before && after)) return '';
  return `<h3 style="color:var(--brand)">مقارنة مختصرة قبل وبعد</h3><div class="compare"><div><b>قبل التنفيذ</b><div class="img-card" onclick="openGallery('${s.id}',0)"><img src="${before}"><div class="img-caption"><span>قبل التنفيذ</span><span class="img-no">1</span></div></div></div><div><b>بعد التنفيذ</b><div class="img-card" onclick="openGallery('${s.id}',${(s.before_images||[]).length+(s.during_images||[]).length})"><img src="${after}"><div class="img-caption"><span>بعد التنفيذ</span><span class="img-no">1</span></div></div></div></div>`;
}
function renderService(s,i){
  const beforeLen=(s.before_images||[]).length, duringLen=(s.during_images||[]).length;
  const stagesHtml = [renderStage('قبل التنفيذ',s.before_images,s.id,0), renderStage('أثناء التنفيذ',s.during_images,s.id,beforeLen), renderStage('بعد التنفيذ',s.after_images,s.id,beforeLen+duringLen)].filter(Boolean).join('');
  return `<section class="card service-section reveal" id="service-${s.id}">
    <div class="service-head"><div><h2>${esc(s.title||s.service_type)}</h2><p class="badge">${esc(s.service_type||'خدمة')}</p></div><div><p class="badge">عدد الصور: ${imgCount(s)}</p><button class="light back-gates" onclick="jumpToGates()">الرجوع إلى بوابات الخدمات</button></div></div>
    ${s.service_description?`<p class="summary">${esc(s.service_description).replace(/\n/g,'<br>')}</p>`:''}
    ${s.scope_work?`<div class="scope"><b>نطاق العمل:</b><br>${esc(s.scope_work).replace(/\n/g,'<br>')}</div>`:''}
    ${renderCompare(s)}
    ${stagesHtml?`<div class="stages">${stagesHtml}</div>`:''}
    ${s.notes?`<div class="scope" style="margin-top:12px"><b>ملاحظات الإدارة:</b><br>${esc(s.notes).replace(/\n/g,'<br>')}</div>`:''}
    <div class="rating-box" id="rating-${s.id}"><h3>ما مدى رضاكم عن هذه الخدمة؟</h3><div class="rating-buttons"><button onclick="setRating('${s.id}','ممتاز',this)">ممتاز</button><button onclick="setRating('${s.id}','جيد جدًا',this)">جيد جدًا</button><button onclick="setRating('${s.id}','جيد',this)">جيد</button><button onclick="setRating('${s.id}','يحتاج تحسين',this)">يحتاج تحسين</button></div><textarea id="comment-${s.id}" placeholder="ملاحظاتكم على الخدمة - اختياري"></textarea><label style="display:flex;gap:8px;align-items:center;margin:10px 0"><input id="follow-${s.id}" type="checkbox" style="width:auto"> أرغب بزيارة متابعة</label><button onclick="submitRating('${s.id}')">إرسال التقييم</button><div id="thanks-${s.id}" style="margin-top:8px;color:var(--brand);font-weight:bold"></div></div>
  </section>`;
}
function activateReveal(){
  const els=[...document.querySelectorAll('.reveal')];
  if(!('IntersectionObserver' in window)){ els.forEach(el=>el.classList.add('show')); return; }
  const io=new IntersectionObserver(entries=>{ entries.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add('show'); io.unobserve(en.target); } }); },{threshold:.12});
  els.forEach(el=>io.observe(el));
}
function setRating(serviceId, value, btn){ const box=$(`rating-${serviceId}`); box.dataset.rating=value; box.querySelectorAll('.rating-buttons button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); }
async function submitRating(serviceId){
  const box=$(`rating-${serviceId}`); const rating=box.dataset.rating; if(!rating){ alert('اختر التقييم أولاً'); return; }
  const s=currentServices.find(x=>String(x.id)===String(serviceId));
  const row={report_id:currentReport.id,service_id:serviceId,project_id:currentReport.project_id,project_name:currentReport.project_name,report_title:currentReport.title,service_title:s?.title||s?.service_type||'',rating,comment:$(`comment-${serviceId}`).value||'',followup_requested:$(`follow-${serviceId}`).checked};
  const {error}=await sb.from('client_service_ratings').insert(row); if(error){ alert(error.message); return; }
  $(`thanks-${serviceId}`).textContent='شكرًا لكم، تم استلام تقييمكم بنجاح.';
  box.querySelector('button[onclick^="submitRating"]').disabled=true;
}

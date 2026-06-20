/* Tasneef v10167 - Daily logs print filters deleted time logs */
(function(){
  'use strict';
  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const W_MOV='worker_project_movements', TIME_LOGS='time_logs';
  const S=v=>String(v==null?'':v).trim();
  const $=id=>document.getElementById(id);
  const esc=s=>S(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function getClient(){
    if(window.sb&&window.sb.from) return window.sb;
    if(window.supabaseClient&&window.supabaseClient.from) return window.supabaseClient;
    if(window.supabase&&window.supabase.from) return window.supabase;
    if(window.supabase&&window.supabase.createClient){ window.sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY); return window.sb; }
    return null;
  }
  function today(){const d=new Date(),z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate());}
  function selectedText(id){const el=$(id); if(!el) return ''; return S(el.options&&el.selectedIndex>=0 ? el.options[el.selectedIndex].textContent : el.value);}
  function selectedValue(id){const el=$(id); return S(el&&el.value);}
  function time(v){ if(!v) return '-'; try{return new Date(v).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});}catch(_){return S(v);} }
  function mins(row){
    if(row.actual_minutes!=null) return Number(row.actual_minutes)||0;
    if(row.start_at && row.end_at){const a=new Date(row.start_at),b=new Date(row.end_at); if(!isNaN(a)&&!isNaN(b)) return Math.max(0,Math.round((b-a)/60000));}
    return 0;
  }
  function fmtM(m){m=Number(m)||0; const h=Math.floor(m/60), mm=m%60; return h+':'+String(mm).padStart(2,'0');}
  function matchesFilter(row){
    const supVal=selectedValue('dailySupervisor'), supTxt=selectedText('dailySupervisor');
    const prjVal=selectedValue('dailyProject'), prjTxt=selectedText('dailyProject');
    const srch=S($('dailySearch')&&$('dailySearch').value).toLowerCase();
    if(supVal && supVal!=='all' && supVal!=='الكل'){
      const vals=[row.supervisor_key,row.supervisor_name,row.supervisor_id,row.supervisor].map(S);
      if(!vals.some(v=>v===supVal||v===supTxt||v.includes(supTxt)||supTxt.includes(v))) return false;
    }
    if(prjVal && prjVal!=='all' && prjVal!=='الكل'){
      const vals=[row.project_key,row.project_name,row.project_id,row.project,row.group_key,row.group_name].map(S);
      if(!vals.some(v=>v===prjVal||v===prjTxt||v.includes(prjTxt)||prjTxt.includes(v))) return false;
    }
    if(srch){
      const bag=[row.worker_name,row.supervisor_name,row.project_name,row.group_name,row.visit_type,row.status].map(S).join(' ').toLowerCase();
      if(!bag.includes(srch)) return false;
    }
    return true;
  }
  async function loadWorkers(date){
    const c=getClient(); if(!c) return [];
    try{
      const r=await c.from(W_MOV).select('*').eq('movement_date',date).limit(5000);
      if(r.error) throw r.error;
      let rows=(r.data||[]).filter(matchesFilter);
      // v10167: لا تطبع عمال سجل يومي تم حذفه. إذا كان time_log_id موجوداً يجب أن يكون السجل الأصلي موجوداً.
      try{
        const lr=await c.from(TIME_LOGS).select('id,log_date,created_at,check_in').limit(5000);
        if(!lr.error){
          const live=new Set((lr.data||[]).filter(x=>{const dd=S(x.log_date)||S(x.created_at).slice(0,10)||S(x.check_in).slice(0,10); return !dd||dd===date;}).map(x=>S(x.id)).filter(Boolean));
          rows=rows.filter(m=>!S(m.time_log_id)||live.has(S(m.time_log_id)));
        }
      }catch(_){ }
      rows.sort((a,b)=>S(a.supervisor_name).localeCompare(S(b.supervisor_name),'ar')||S(a.project_name||a.group_name).localeCompare(S(b.project_name||b.group_name),'ar')||S(a.worker_name).localeCompare(S(b.worker_name),'ar'));
      return rows;
    }catch(e){ console.warn('worker print load failed',e); return []; }
  }
  function cloneDailyTable(){
    const tbl=document.querySelector('#logsBody')?.closest('table');
    if(!tbl) return '<p>لا توجد سجلات يومية معروضة.</p>';
    const c=tbl.cloneNode(true);
    // إزالة أعمدة الإجراءات والواتساب حتى يكون التقرير نظيف.
    [...c.querySelectorAll('tr')].forEach(tr=>{
      const cells=[...tr.children];
      // غالباً آخر عمودين واتساب/إجراء.
      if(cells.length>2){ cells[cells.length-1]?.remove(); cells[cells.length-2]?.remove(); }
    });
    return c.outerHTML;
  }
  function printHtml(date,workers){
    const workerRows=workers.length?workers.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.worker_name)}</td><td>${esc(r.supervisor_name)}</td><td>${esc(r.project_name||r.group_name)}</td><td>${esc(r.visit_type||'-')}</td><td>${time(r.start_at)}</td><td>${time(r.end_at)}</td><td>${fmtM(mins(r))}</td><td>${r.status==='open'?'مفتوح':'مغلق'}</td></tr>`).join(''):'<tr><td colspan="9">لا توجد حركات عمال لهذا التاريخ.</td></tr>';
    const total=workers.reduce((s,r)=>s+mins(r),0);
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير التسجيلات اليومية</title><style>
      body{font-family:Tahoma,Arial,sans-serif;color:#10231d;margin:28px;background:#fff}h1,h2{color:#0A4033;margin:0 0 12px}.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid #0A4033;padding-bottom:14px;margin-bottom:18px}.brand{font-weight:900;font-size:22px}.meta{color:#52645d;line-height:1.9}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}.kpi{border:1px solid #dde9e5;border-radius:14px;padding:10px;background:#f8fcfa}.kpi small{display:block;color:#66766f}.kpi b{font-size:22px;color:#0A4033}table{width:100%;border-collapse:collapse;margin:10px 0 24px;font-size:12px}th{background:#0A4033;color:#fff;padding:9px;border:1px solid #0A4033}td{padding:8px;border:1px solid #dfe8e5;text-align:center}tr:nth-child(even) td{background:#f7fbfa}.section{break-inside:avoid}.note{color:#66766f;font-size:12px;margin-top:20px}@media print{body{margin:12mm}.no-print{display:none}}
    </style></head><body><div class="head"><div><div class="brand">شركة تصنيف لإدارة المرافق</div><div class="meta">تقرير التسجيلات اليومية شامل عمال المشاريع</div></div><div class="meta">التاريخ: ${esc(date)}<br>وقت الطباعة: ${new Date().toLocaleString('ar-SA')}</div></div>
    <div class="section"><h1>التسجيلات اليومية</h1>${cloneDailyTable()}</div>
    <div class="section"><h2>عمال التسجيلات اليومية</h2><div class="kpis"><div class="kpi"><small>عدد حركات العمال</small><b>${workers.length}</b></div><div class="kpi"><small>إجمالي دقائق العمال</small><b>${total}</b></div><div class="kpi"><small>إجمالي ساعات العمال</small><b>${fmtM(total)}</b></div></div><table><thead><tr><th>#</th><th>العامل</th><th>المشرف</th><th>المشروع</th><th>نوع الزيارة</th><th>الدخول</th><th>الخروج</th><th>المدة</th><th>الحالة</th></tr></thead><tbody>${workerRows}</tbody></table></div><div class="note">مصدر عمال التسجيلات: جدول حركة العمال الفعلي، مع استبعاد أي حركة مرتبطة بسجل يومي تم حذفه.</div><script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`;
  }
  window.exportDailyManagerPDF=async function(){
    const date=S($('dailyDate')&&$('dailyDate').value)||today();
    const workers=await loadWorkers(date);
    const w=window.open('','_blank');
    if(!w){alert('المتصفح منع فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة.');return;}
    w.document.open(); w.document.write(printHtml(date,workers)); w.document.close();
  };
})();

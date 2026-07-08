/* V383: Split monthly times into daily-visit projects and permanent/full-time projects */
(function(){
  'use strict';
  if(window.__tasneefMonthlySplitTypesV383) return;
  window.__tasneefMonthlySplitTypesV383 = true;

  const S = v => String(v ?? '').trim();
  const N = v => { const n = Number(v || 0); return Number.isFinite(n) ? n : 0; };
  const esc = v => S(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const id = v => S(v);
  const norm = v => S(v).replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/\s+/g,' ').toLowerCase();
  const $ = x => document.getElementById(x);
  const pct = p => N(p).toFixed(0) + '%';
  const arMins = m => { m=Math.round(N(m)); const h=Math.floor(m/60), mm=m%60; if(!h) return mm+' دقيقة'; if(!mm) return h+' ساعة'; return h+' ساعة و '+mm+' دقيقة'; };

  function isPermanent(r){
    const p = r && r.project ? r.project : {};
    const t = norm([r?.projectType, p.operation_type, p.project_type, p.work_type, p.type, p.shift_type, p.contract_type, p.service_type].filter(Boolean).join(' '));
    return t.includes('دوام') || t.includes('دائم') || t.includes('كامل') || t.includes('full') || t.includes('permanent') || t.includes('fixed');
  }

  function groupBySupervisor(rows){
    const by = new Map();
    rows.forEach(r=>{
      const k = id(r.supervisorId) || r.supervisorName || 'none';
      if(!by.has(k)) by.set(k, []);
      by.get(k).push(r);
    });
    return [...by.values()];
  }

  function recalcPercent(rows){
    const totals = {};
    rows.forEach(r=>{ const k=id(r.supervisorId)||r.supervisorName||'none'; totals[k]=(totals[k]||0)+N(r.totalMinutes); });
    return rows.map(r=>{ const k=id(r.supervisorId)||r.supervisorName||'none'; return {...r, splitPercentage: totals[k] ? N(r.totalMinutes)/totals[k]*100 : 0}; });
  }

  function buildSupervisorCards(rows, emptyText){
    rows = recalcPercent(rows || []);
    const groups = groupBySupervisor(rows);
    return groups.map(items=>{
      const total = items.reduce((a,r)=>a+N(r.totalMinutes),0);
      const projectRows = items.map(r=>`<tr><td style="text-align:right"><b>${esc(r.projectName)}</b><br><small>${esc(r.projectType || (isPermanent(r)?'دوام كامل':'زيارة يومية'))}</small></td><td>${Math.round(N(r.totalMinutes)).toLocaleString('en-US')}</td><td>${pct(r.splitPercentage)}</td></tr>`).join('');
      const names = [...new Set(items.flatMap(r=>Array.isArray(r.workers)?r.workers:[]))];
      return `<div class="rb-super-card"><h3>${esc(items[0]?.supervisorName || '-')}</h3><table><tbody>${projectRows}<tr class="total"><td>الإجمالي</td><td>${Math.round(total).toLocaleString('en-US')}</td><td>${total?'100%':'0%'}</td></tr></tbody></table><div class="rb-workers-title">أسماء العمال الحالية</div><div class="rb-worker-list">${names.length?names.map(n=>`<span>${esc(n)}</span>`).join(''):'<span>-</span>'}</div></div>`;
    }).join('') || `<div class="rb-empty">${esc(emptyText || 'لا توجد مشاريع')}</div>`;
  }

  function buildProjectCards(rows, emptyText){
    return (rows||[]).map(r=>`<div class="rb-project-card"><h3>${esc(r.projectName)}</h3><small>${esc(r.supervisorName)} - ${esc(r.projectType || (isPermanent(r)?'دوام كامل':'زيارة يومية'))}</small>${(r.workers&&r.workers.length)?r.workers.map(n=>`<span>${esc(n)}</span>`).join(''):'<span>-</span>'}</div>`).join('') || `<div class="rb-empty">${esc(emptyText || 'لا توجد مشاريع')}</div>`;
  }

  function buildDetailRows(rows, title, cls){
    if(!rows.length) return `<tr class="${cls||''}"><td colspan="9">لا توجد بيانات ضمن ${esc(title)}</td></tr>`;
    const list = recalcPercent(rows);
    return `<tr class="rb-group-head-v383 ${cls||''}"><td colspan="9">${esc(title)}</td></tr>` + list.map(r=>`<tr><td>${esc(r.supervisorName)}</td><td>${esc(r.projectName)}</td><td>${esc(r.projectType || (isPermanent(r)?'دوام كامل':'زيارة يومية'))}</td><td>${(r.workers||[]).map(esc).join('، ')||'-'}</td><td>${Math.round(N(r.logsCount)).toLocaleString('en-US')}</td><td>${Math.round(N(r.totalMinutes)).toLocaleString('en-US')}</td><td>${esc(arMins(r.totalMinutes))}</td><td>${Math.round(N(r.transferMinutes)).toLocaleString('en-US')} دقيقة</td><td>${pct(r.splitPercentage)}</td></tr>`).join('');
  }

  function ensureStyle(){
    if($('monthlySplitTypesV383Css')) return;
    const st=document.createElement('style');
    st.id='monthlySplitTypesV383Css';
    st.textContent=`
      .rb-group-head-v383 td{background:#073f34!important;color:white!important;font-weight:900;text-align:center!important;font-size:15px!important}
      .rb-group-head-v383.perm td{background:#8a6700!important}
      #rbPermanentProjectsV383,#rbDailyWorkersV383,#rbPermanentWorkersV383{margin-top:14px}
      #rbSupervisorCards[data-v383-split="1"]{display:grid!important}
      .rb-type-pill-v383{display:inline-flex;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:900;background:#eef7f3;color:#073f34;border:1px solid #d5e9e1}
      .rb-type-pill-v383.perm{background:#fff5da;color:#8a6700;border-color:#ead28d}
    `;
    document.head.appendChild(st);
  }

  function splitMonthlyTypes(){
    const rows = (window.__monthlyRowsRebuildV10199 || window.__monthlyRowsRebuildV10198 || (typeof window.monthlyRowsV60 === 'function' ? window.monthlyRowsV60() : []) || []).filter(Boolean);
    const daily = rows.filter(r=>!isPermanent(r));
    const perm = rows.filter(isPermanent);
    ensureStyle();

    const superGrid = $('rbSupervisorCards');
    if(superGrid){
      const firstCard = superGrid.closest('.rb-card');
      if(firstCard){
        const title = firstCard.querySelector('.rb-title h3');
        const small = firstCard.querySelector('.rb-title small');
        if(title) title.innerHTML = 'مشاريع الزيارة اليومية <span class="rb-type-pill-v383">يومية</span>';
        if(small) small.textContent = 'تعرض مشاريع الزيارة اليومية فقط، والنسبة محسوبة داخل نفس النوع لكل مشرف.';
      }
      superGrid.dataset.v383Split='1';
      superGrid.innerHTML = buildSupervisorCards(daily, 'لا توجد مشاريع زيارة يومية لهذا الفلتر');
      if(firstCard && !$('rbPermanentProjectsV383')){
        firstCard.insertAdjacentHTML('afterend', `<div class="rb-card" id="rbPermanentProjectsV383"><div class="rb-title"><h3>المشاريع الدائمة / الدوام الكامل <span class="rb-type-pill-v383 perm">دوام كامل</span></h3><small>تعرض المشاريع الدائمة أو الدوام الكامل فقط، منفصلة عن مشاريع الزيارة اليومية.</small></div><div id="rbPermanentSupervisorCards" class="rb-supervisor-grid"></div></div>`);
      }
      const pg=$('rbPermanentSupervisorCards'); if(pg) pg.innerHTML = buildSupervisorCards(perm, 'لا توجد مشاريع دائمة أو دوام كامل لهذا الفلتر');
    }

    const workersGrid = $('rbProjectWorkers');
    if(workersGrid){
      const workersCard = workersGrid.closest('.rb-card');
      if(workersCard){
        const title = workersCard.querySelector('.rb-title h3');
        const small = workersCard.querySelector('.rb-title small');
        if(title) title.innerHTML = 'عمال مشاريع الزيارة اليومية <span class="rb-type-pill-v383">يومية</span>';
        if(small) small.textContent = 'أسماء العمال الحالية لمشاريع الزيارة اليومية فقط.';
      }
      workersGrid.innerHTML = buildProjectCards(daily, 'لا توجد مشاريع زيارة يومية');
      if(workersCard && !$('rbPermanentWorkersV383')){
        workersCard.insertAdjacentHTML('afterend', `<div class="rb-card" id="rbPermanentWorkersV383"><div class="rb-title"><h3>عمال المشاريع الدائمة / الدوام الكامل <span class="rb-type-pill-v383 perm">دوام كامل</span></h3><small>أسماء العمال الحالية للمشاريع الدائمة والدوام الكامل فقط.</small></div><div id="rbPermanentProjectWorkers" class="rb-project-grid"></div></div>`);
      }
      const pw=$('rbPermanentProjectWorkers'); if(pw) pw.innerHTML = buildProjectCards(perm, 'لا توجد مشاريع دائمة أو دوام كامل');
    }

    const body=$('rbBody');
    if(body){ body.innerHTML = buildDetailRows(daily,'مشاريع الزيارة اليومية','daily') + buildDetailRows(perm,'المشاريع الدائمة / الدوام الكامل','perm'); }

    const msg=$('rbMsg');
    if(msg){ msg.textContent = `تم فصل المشاريع: ${daily.length.toLocaleString('en-US')} زيارة يومية / ${perm.length.toLocaleString('en-US')} دوام كامل`; }
  }

  function wrapRender(name){
    const old = window[name];
    if(typeof old !== 'function' || old.__v383Wrapped) return;
    const fn = async function(){ const res = await old.apply(this, arguments); setTimeout(splitMonthlyTypes, 80); return res; };
    fn.__v383Wrapped = true;
    window[name] = fn;
  }

  function install(){
    ['renderMonthlyRootV10199','renderMonthlyRootV10202','renderMonthlyRootV10233','renderMonthly'].forEach(wrapRender);
    setTimeout(splitMonthlyTypes, 300);
  }

  document.addEventListener('click', function(e){
    if(e.target && e.target.closest && e.target.closest('#rbRefresh,#rbPrint,#rbCsv,.nav')) setTimeout(install, 200);
  }, true);

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  window.splitMonthlyTypesV383 = splitMonthlyTypes;
})();

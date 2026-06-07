(function(){
  'use strict';

  if (window.__tasneefContractsProV11) return;
  window.__tasneefContractsProV11 = true;

  const LS_KEY = 'tasneef_contract_smart_v299';
  const CONTRACTS = [
    { key: 'elevators', label: 'مصاعد', icon: '↕' },
    { key: 'pools', label: 'مسابح', icon: '≈' },
    { key: 'civilDefense', label: 'دفاع مدني', icon: '!' }
  ];
  const ANNUAL_OPTIONS = ['غسيل خزانات علوية','غسيل خزانات أرضية','رش مبيدات','غسيل الأسطح','تنظيف الممرات','تنظيف المناور','تنظيف المكيفات','غسيل المواقف','تنظيف عدسات الكاميرات','التعطير','خدمة أخرى'];

  let cache = {};
  let loaded = false;
  let currentProjectId = '';
  let currentMode = 'view';

  const $ = id => document.getElementById(id);
  const A = v => Array.isArray(v) ? v : [];
  const S = v => String(v ?? '').trim();
  const N = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const esc = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const say = (t,k) => { try { typeof msg === 'function' ? msg(t,k) : alert(t); } catch(_) { alert(t); } };

  function projects(){ return A(window.data && window.data.projects); }
  function projectById(id){ return projects().find(p => S(p.id) === S(id)) || null; }
  function dateOnly(v){ return S(v).slice(0,10); }
  function parseDate(v){
    const s = dateOnly(v); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
  }
  function daysLeft(end){
    const e = parseDate(end); if (!e) return null;
    const n = new Date(); const t = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    return Math.ceil((e - t) / 86400000);
  }
  function contractInfo(p){
    const d = daysLeft(p && p.contract_end);
    if (d === null) return {key:'missing', text:'بيانات ناقصة', cls:'warn', days:'-'};
    if (d < 0) return {key:'expired', text:'منتهي', cls:'bad', days:d};
    if (d <= 30) return {key:'soon', text:'قريب الانتهاء', cls:'warn', days:d};
    return {key:'active', text:'نشط', cls:'good', days:d};
  }

  function emptyRecord(){
    const contracts = {};
    CONTRACTS.forEach(c => contracts[c.key] = { onUs:false, company:'', phone:'', start:'', end:'', visits:0, done:[], notes:'' });
    return { contracts, annual:[], updated_at:null };
  }
  function normalize(raw){
    const out = emptyRecord(); raw = raw || {};
    const source = raw.contracts || raw.core || {};
    CONTRACTS.forEach(c => {
      const x = source[c.key] || {};
      out.contracts[c.key] = {
        onUs: !!(x.onUs ?? x.on_us),
        company: S(x.company || x.company_name),
        phone: S(x.phone || x.company_phone),
        start: S(x.start || x.contract_start || x.from),
        end: S(x.end || x.contract_end || x.to),
        visits: N(x.visits || x.visit_count),
        done: A(x.done).map(Number).filter(Boolean),
        notes: S(x.notes)
      };
    });
    out.annual = A(raw.annual).map(a => ({
      id: S(a.id) || ('a' + Date.now() + Math.random().toString(16).slice(2)),
      name: S(a.name),
      visits: Math.max(1, N(a.visits || a.visit_count || 1)),
      done: A(a.done).map(Number).filter(Boolean),
      notes: S(a.notes)
    }));
    out.updated_at = raw.updated_at || null;
    return out;
  }
  function readLS(){ try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch(_) { return {}; } }
  function writeLS(){ try { localStorage.setItem(LS_KEY, JSON.stringify(cache)); } catch(_) {} }
  async function loadAll(){
    if (loaded) return;
    cache = readLS();
    try {
      if (window.sb) {
        const res = await Promise.race([
          window.sb.from('project_contract_smart').select('*'),
          new Promise(resolve => setTimeout(() => resolve({error:{message:'timeout'}, data:null}), 1500))
        ]);
        if (!res.error && Array.isArray(res.data)) {
          res.data.forEach(row => cache[S(row.project_id)] = normalize(row.payload));
          writeLS();
        }
      }
    } catch(_) {}
    loaded = true;
  }
  function getRecord(id){ return normalize(cache[S(id)]); }
  async function saveRecord(id, record){
    const clean = normalize(record); clean.updated_at = new Date().toISOString();
    cache[S(id)] = clean; writeLS();
    try {
      if (window.sb) {
        const res = await window.sb.from('project_contract_smart').upsert({ project_id:Number(id)||id, payload:clean, updated_at:new Date().toISOString() }, { onConflict:'project_id' });
        if (res.error) console.warn(res.error.message);
      }
    } catch(e) { console.warn(e); }
    return clean;
  }

  function missingFields(x){
    const miss = [];
    if (!x.company) miss.push('اسم الشركة');
    if (!x.phone) miss.push('رقم الشركة');
    if (!x.start) miss.push('من تاريخ');
    if (!x.end) miss.push('إلى تاريخ');
    if (!N(x.visits)) miss.push('عدد الزيارات');
    return miss;
  }
  function statusFor(x){
    if (!x.onUs) return {text:'غير مفعل', cls:'idle'};
    const miss = missingFields(x);
    if (miss.length) return {text:'العقد علينا - ناقص', cls:'warn'};
    if (A(x.done).length >= N(x.visits)) return {text:'مكتمل', cls:'good'};
    return {text:'العقد علينا', cls:'good'};
  }
  function collect(){
    const r = emptyRecord();
    CONTRACTS.forEach(c => {
      const card = document.querySelector(`[data-pro-contract="${c.key}"]`);
      const old = getRecord(currentProjectId).contracts[c.key];
      const visits = Math.max(0, N(card?.querySelector('[data-field="visits"]')?.value));
      r.contracts[c.key] = {
        onUs: !!card?.querySelector('[data-field="onUs"]')?.checked,
        company: S(card?.querySelector('[data-field="company"]')?.value),
        phone: S(card?.querySelector('[data-field="phone"]')?.value),
        start: S(card?.querySelector('[data-field="start"]')?.value),
        end: S(card?.querySelector('[data-field="end"]')?.value),
        visits,
        done: A(old.done).map(Number).filter(n => n > 0 && n <= visits),
        notes: S(card?.querySelector('[data-field="notes"]')?.value)
      };
    });
    r.annual = getRecord(currentProjectId).annual;
    return r;
  }
  function visitButtons(kind, id, visits, done){
    visits = Math.max(0, N(visits));
    if (!visits) return '<span class="pro-empty">حدد عدد الزيارات</span>';
    const doneSet = new Set(A(done).map(Number));
    return Array.from({length:visits}, (_,i) => {
      const n = i + 1;
      return `<button type="button" class="pro-visit ${doneSet.has(n) ? 'done' : ''}" onclick="${kind}('${esc(id)}',${n})" ${currentMode === 'view' ? 'disabled' : ''}>${n}</button>`;
    }).join('');
  }
  function projectSelect(){
    return `<select id="contractProProjectSelect" onchange="contractProSwitchProject(this.value)">
      ${projects().map(p => `<option value="${esc(p.id)}" ${S(p.id)===S(currentProjectId)?'selected':''}>${esc(p.name || p.id)}</option>`).join('')}
    </select>`;
  }
  function renderShell(){
    const modal = $('contractSmartModal'); if (!modal) return;
    document.body.appendChild(modal);
    const p = projectById(currentProjectId) || {};
    const info = contractInfo(p);
    modal.innerHTML = `<div class="contract-pro-panel" onclick="event.stopPropagation()">
      <header class="contract-pro-head">
        <div>
          <span class="contract-pro-kicker">إدارة عقود المشروع</span>
          <h2>${currentMode === 'view' ? 'عرض' : 'تعديل'} عقود: ${esc(p.name || '-')}</h2>
          <div class="contract-pro-meta">
            <span>بداية العقد: ${esc(dateOnly(p.contract_start) || '-')}</span>
            <span>نهاية العقد: ${esc(dateOnly(p.contract_end) || '-')}</span>
            <span class="pro-pill ${esc(info.cls)}">المتبقي: ${esc(info.days)} يوم</span>
          </div>
        </div>
        <div class="contract-pro-tools">
          ${projectSelect()}
          <button class="light" onclick="contractProPrint()">طباعة</button>
          <button class="light" onclick="contractProCopy()">نسخ التقرير</button>
          ${currentMode === 'view' ? `<button onclick="contractProSetMode('edit')">تعديل</button>` : `<button onclick="saveContractSmartModal()">حفظ</button>`}
          <button class="danger" onclick="closeContractSmartModal()">إغلاق</button>
        </div>
      </header>
      <nav class="contract-pro-tabs">
        <button class="active" onclick="contractProTab('contracts',this)">العقود</button>
        <button onclick="contractProTab('annual',this)">الخدمات السنوية</button>
        <button onclick="contractProTab('report',this)">تقرير العميل</button>
      </nav>
      <main class="contract-pro-body">
        <section id="contractProContracts"></section>
        <section id="contractProAnnual" class="hidden"></section>
        <section id="contractProReport" class="hidden"></section>
      </main>
    </div>`;
    modal.onclick = e => { if (e.target && e.target.id === 'contractSmartModal') closeContractSmartModal(); };
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    renderPanels();
  }
  function renderPanels(){
    const r = getRecord(currentProjectId);
    renderContracts(r); renderAnnual(r); renderReport(r);
    bindLiveInputs();
  }
  function renderContracts(r){
    const host = $('contractProContracts'); if (!host) return;
    host.innerHTML = `<div class="contract-pro-grid">${CONTRACTS.map(c => {
      const x = r.contracts[c.key]; const st = statusFor(x); const disabled = currentMode === 'view' ? 'disabled' : '';
      const miss = missingFields(x);
      return `<article class="pro-card ${st.cls}" data-pro-contract="${c.key}">
        <div class="pro-card-title">
          <div class="pro-icon">${esc(c.icon)}</div>
          <div><h3>${esc(c.label)}</h3><span class="pro-pill ${st.cls}">${esc(st.text)}</span></div>
          <label class="pro-switch ${x.onUs ? 'active' : ''}"><input type="checkbox" data-field="onUs" ${x.onUs?'checked':''} ${disabled} onchange="contractProRefresh()"> <span>${x.onUs ? 'العقد علينا' : 'ليس علينا'}</span></label>
        </div>
        <div class="pro-contract-state ${x.onUs ? (miss.length ? 'missing' : 'ok') : 'idle'}">
          <span>${x.onUs ? (miss.length ? 'العقد ناقص' : 'العقد موجود ومكتمل البيانات') : 'العقد غير مفعل'}</span>
          ${currentMode === 'view' ? `<button type="button" class="light" onclick="contractProSetMode('edit')">تفعيل التعديل</button>` : `<button type="button" class="${miss.length ? 'danger' : 'light'}" onclick="contractProToggleMissing('${c.key}')">${miss.length ? 'تحديد كناقص' : 'مكتمل'}</button>`}
        </div>
        <div class="pro-fields ${x.onUs ? '' : 'off'}">
          <label>اسم الشركة<input data-field="company" value="${esc(x.company)}" ${disabled}></label>
          <label>رقم الشركة<input data-field="phone" value="${esc(x.phone)}" ${disabled}></label>
          <label>من تاريخ<input type="date" data-field="start" value="${esc(x.start)}" ${disabled}></label>
          <label>إلى تاريخ<input type="date" data-field="end" value="${esc(x.end)}" ${disabled}></label>
          <label>عدد الزيارات<input type="number" min="0" data-field="visits" value="${esc(x.visits)}" ${disabled} onchange="contractProRefresh()"></label>
          <label>ملاحظات<input data-field="notes" value="${esc(x.notes)}" ${disabled}></label>
        </div>
        <div class="pro-visits">${visitButtons('contractProToggleCore', c.key, x.visits, x.done)}</div>
        ${x.onUs && miss.length ? `<div class="pro-warning">تنبيه: العقد علينا ولا تظهر بياناته كاملة في السجلات. الناقص: ${esc(miss.join('، '))}</div>` : ''}
      </article>`;
    }).join('')}</div>`;
  }
  function renderAnnual(r){
    const host = $('contractProAnnual'); if (!host) return;
    const disabled = currentMode === 'view' ? 'disabled' : '';
    host.innerHTML = `<section class="pro-annual-add">
      <label>الخدمة<select id="proAnnualName" ${disabled}>${ANNUAL_OPTIONS.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label>
      <label>خدمة أخرى<input id="proAnnualCustom" ${disabled}></label>
      <label>عدد الزيارات<input id="proAnnualVisits" type="number" min="1" value="1" ${disabled}></label>
      <button onclick="contractProAddAnnual()" ${disabled}>إضافة</button>
    </section>
    <div class="pro-annual-list">${A(r.annual).map(a => `<article class="pro-annual-item">
      <div><h3>${esc(a.name)}</h3><small>${A(a.done).length} منفذة من ${N(a.visits)}</small></div>
      <div class="pro-visits">${visitButtons('contractProToggleAnnual', a.id, a.visits, a.done)}</div>
      ${currentMode === 'view' ? '' : `<button class="danger" onclick="contractProDeleteAnnual('${esc(a.id)}')">حذف</button>`}
    </article>`).join('') || '<div class="pro-empty wide">لا توجد خدمات سنوية بعد</div>'}</div>`;
  }
  function renderReport(r){
    const host = $('contractProReport'); if (!host) return;
    const p = projectById(currentProjectId) || {};
    const coreRows = CONTRACTS.map(c => {
      const x = r.contracts[c.key]; if (!x.onUs) return '';
      return `<tr><td>${esc(c.label)}</td><td>${esc(statusFor(x).text)}</td><td>${esc(x.company || '-')}</td><td>${esc(x.phone || '-')}</td><td>${esc(x.start || '-')}</td><td>${esc(x.end || '-')}</td><td>${A(x.done).length}/${N(x.visits)}</td></tr>`;
    }).join('');
    const annualRows = A(r.annual).map(a => `<tr><td>${esc(a.name)}</td><td>خدمة سنوية</td><td colspan="4">-</td><td>${A(a.done).length}/${N(a.visits)}</td></tr>`).join('');
    host.innerHTML = `<div class="pro-report-card"><h3>تقرير عقود ${esc(p.name || '-')}</h3><table><thead><tr><th>القسم</th><th>الحالة</th><th>الشركة</th><th>رقم الشركة</th><th>من</th><th>إلى</th><th>التنفيذ</th></tr></thead><tbody>${coreRows || '<tr><td colspan="7">لا توجد عقود علينا</td></tr>'}${annualRows}</tbody></table></div>`;
  }
  function keepDraft(){
    cache[S(currentProjectId)] = collect();
    writeLS();
  }
  function bindLiveInputs(){
    document.querySelectorAll('#contractSmartModal input, #contractSmartModal select').forEach(el => {
      if (el.dataset.proBound) return;
      el.dataset.proBound = '1';
      el.addEventListener('change', () => { if (currentMode !== 'view') keepDraft(); });
      el.addEventListener('input', () => { if (currentMode !== 'view') keepDraft(); });
    });
  }
  window.contractProRefresh = function(){ keepDraft(); renderPanels(); };
  window.contractProToggleMissing = function(key){
    if (currentMode === 'view') return;
    const r = collect();
    const x = r.contracts[key];
    if (!x) return;
    x.onUs = true;
    if (!N(x.visits)) x.visits = 1;
    cache[S(currentProjectId)] = r;
    writeLS();
    renderPanels();
  };
  window.contractProToggleCore = function(key,no){
    if (currentMode === 'view') return;
    const r = collect(); const x = r.contracts[key]; const set = new Set(A(x.done).map(Number));
    set.has(no) ? set.delete(no) : set.add(no); x.done = [...set].sort((a,b)=>a-b);
    cache[S(currentProjectId)] = r; writeLS(); renderPanels();
  };
  window.contractProToggleAnnual = function(id,no){
    if (currentMode === 'view') return;
    const r = collect(); const a = A(r.annual).find(x => S(x.id) === S(id)); if (!a) return;
    const set = new Set(A(a.done).map(Number)); set.has(no) ? set.delete(no) : set.add(no);
    a.done = [...set].sort((x,y)=>x-y); cache[S(currentProjectId)] = r; writeLS(); renderPanels();
  };
  window.contractProAddAnnual = function(){
    if (currentMode === 'view') return;
    const r = collect(); const custom = S($('proAnnualCustom')?.value);
    const name = custom || S($('proAnnualName')?.value); const visits = Math.max(1, N($('proAnnualVisits')?.value || 1));
    if (!name) return say('اختر الخدمة', 'err');
    r.annual.push({id:'a'+Date.now()+Math.random().toString(16).slice(2), name, visits, done:[], notes:''});
    cache[S(currentProjectId)] = r; writeLS(); renderPanels();
  };
  window.contractProDeleteAnnual = function(id){
    if (currentMode === 'view') return;
    const r = collect(); r.annual = A(r.annual).filter(x => S(x.id) !== S(id));
    cache[S(currentProjectId)] = r; writeLS(); renderPanels();
  };
  window.contractProSwitchProject = function(id){ keepDraft(); currentProjectId = S(id); renderShell(); };
  window.contractProSetMode = function(mode){ currentMode = mode; renderShell(); };
  window.contractProTab = function(tab, btn){
    ['Contracts','Annual','Report'].forEach(x => $('contractPro'+x)?.classList.add('hidden'));
    $('contractPro' + tab.charAt(0).toUpperCase() + tab.slice(1))?.classList.remove('hidden');
    document.querySelectorAll('.contract-pro-tabs button').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');
  };
  window.openContractSmartModal = async function(projectId, mode){
    await loadAll(); currentProjectId = S(projectId || projects()[0]?.id || ''); currentMode = mode === 'edit' ? 'edit' : 'view'; renderShell();
  };
  window.closeContractSmartModal = function(){
    const modal = $('contractSmartModal'); if (modal) { modal.classList.add('hidden'); modal.style.display = ''; }
    document.body.style.overflow = ''; currentProjectId = '';
  };
  window.saveContractSmartModal = async function(){
    const r = collect(); await saveRecord(currentProjectId, r); say('تم حفظ عقود المشروع'); renderContractsTable(); renderAlerts();
  };
  window.contractProCopy = async function(){
    const txt = $('contractProReport')?.innerText || '';
    try { await navigator.clipboard.writeText(txt); say('تم نسخ التقرير'); } catch(_) { alert(txt); }
  };
  window.contractProPrint = function(){
    const r = getRecord(currentProjectId); renderReport(r);
    const html = $('contractProReport')?.innerHTML || '';
    const w = window.open('', '_blank'); w.document.write(`<html dir="rtl"><head><title>تقرير العقود</title><style>body{font-family:Tahoma;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:10px;text-align:right}th{background:#064c3b;color:#fff}</style></head><body>${html}</body></html>`); w.document.close(); setTimeout(()=>w.print(),300);
  };

  function renderAlerts(){
    const host = $('contractsAlertsList'); if (!host) return;
    const rows = [];
    projects().forEach(p => {
      const r = getRecord(p.id);
      CONTRACTS.forEach(c => {
        const x = r.contracts[c.key]; if (!x.onUs) return;
        const miss = missingFields(x);
        if (miss.length) rows.push(`<div class="alert-item warn"><b>${esc(c.label)} - ${esc(p.name)}</b><br>العقد علينا، لكن بيانات العقد/الشركة ناقصة: ${esc(miss.join('، '))}</div>`);
      });
    });
    if (rows.length) host.innerHTML = rows.join('');
    else host.innerHTML = '<div class="alert-item">لا توجد عقود ناقصة حاليا</div>';
  }
  function renderContractsTable(){
    const body = $('contractsBody'); if (!body) return;
    const q = S($('contractSearch')?.value); const st = S($('contractFilterStatus')?.value);
    let rows = projects(); if (q) rows = rows.filter(p => S(p.name).includes(q)); if (st) rows = rows.filter(p => contractInfo(p).key === st);
    rows.sort((a,b)=>(daysLeft(a.contract_end) ?? 999999)-(daysLeft(b.contract_end) ?? 999999));
    body.innerHTML = rows.map(p => {
      const c = contractInfo(p);
      return `<tr><td><b>${esc(p.name)}</b></td><td>${N(p.buildings_count)}</td><td>${N(p.units_count)}</td><td>${esc(dateOnly(p.contract_start)||'-')}</td><td>${esc(dateOnly(p.contract_end)||'-')}</td><td>${esc(c.days)}</td><td><span class="badge ${c.cls==='bad'?'red':c.cls==='warn'?'amber':'green'}">${esc(c.text)}</span></td><td class="row-actions"><button class="light" onclick="openContractSmartModal(${Number(p.id)||0},'view')">عرض</button><button onclick="openContractSmartModal(${Number(p.id)||0},'edit')">تعديل</button></td></tr>`;
    }).join('') || '<tr><td colspan="8">لا توجد بيانات</td></tr>';
    if ($('contractsActiveCount')) $('contractsActiveCount').textContent = projects().filter(p => contractInfo(p).key === 'active').length;
    if ($('contractsSoonCount')) $('contractsSoonCount').textContent = projects().filter(p => contractInfo(p).key === 'soon').length;
    if ($('contractsExpiredCount')) $('contractsExpiredCount').textContent = projects().filter(p => contractInfo(p).key === 'expired').length;
    if ($('contractsMissingCount')) $('contractsMissingCount').textContent = projects().filter(p => contractInfo(p).key === 'missing').length;
    renderAlerts();
  }
  window.renderContracts = renderContractsTable;

  const oldShowPage = window.showPage;
  window.showPage = function(id, btn){ if (id !== 'contracts') closeContractSmartModal(); const r = oldShowPage ? oldShowPage.apply(this, arguments) : undefined; if (id === 'contracts') setTimeout(renderContractsTable, 40); return r; };

  function css(){
    if ($('contractsProV11Css')) return;
    const s = document.createElement('style'); s.id='contractsProV11Css';
    s.textContent = `
      #servicesSubTab{display:none!important}
      #contractSmartModal{position:fixed!important;inset:0!important;z-index:999999!important;display:flex;align-items:center;justify-content:center;background:rgba(13,30,25,.62)!important;padding:18px!important}
      #contractSmartModal.hidden{display:none!important}.contract-pro-panel{width:min(1180px,96vw);max-height:92vh;overflow:auto;background:#f8fbfa;border-radius:22px;box-shadow:0 30px 90px rgba(0,0,0,.28);border:1px solid #d8e7e0}
      .contract-pro-head{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:18px;background:#fff;border-bottom:1px solid #dce8e4}.contract-pro-kicker{color:#60706a;font-weight:800;font-size:12px}.contract-pro-head h2{margin:4px 0 8px;color:#063f32}.contract-pro-meta{display:flex;gap:8px;flex-wrap:wrap;color:#60706a;font-size:12px}.contract-pro-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.contract-pro-tools select{min-width:220px}
      .pro-pill{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;font-weight:800;background:#eef6f3;color:#064c3b}.pro-pill.warn{background:#fff4d7;color:#8a6400}.pro-pill.bad{background:#ffe3e3;color:#9b2424}.pro-pill.idle{background:#eef1f0;color:#60706a}
      .contract-pro-tabs{display:flex;gap:8px;padding:12px 18px;background:#f8fbfa;position:sticky;top:84px;z-index:4}.contract-pro-tabs button.active{background:#064c3b!important;color:#fff!important}.contract-pro-body{padding:18px}.contract-pro-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px}
      .pro-card,.pro-annual-item,.pro-annual-add,.pro-report-card{background:#fff;border:1px solid #dce8e4;border-radius:16px;padding:14px}.pro-card.good{border-color:#9ad8bf}.pro-card.warn{border-color:#f0d28a}.pro-card-title{display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center}.pro-icon{width:42px;height:42px;border-radius:14px;background:#e9f6f1;display:grid;place-items:center;font-weight:900;color:#064c3b}.pro-card-title h3{margin:0;color:#063f32}.pro-switch{display:flex;gap:7px;align-items:center;font-weight:900;color:#60706a;border:1px solid #d7e8e1;background:#f4f7f6;border-radius:999px;padding:7px 10px;margin:0}.pro-switch.active{background:#064c3b;color:#fff;border-color:#064c3b}.pro-switch input{width:auto;accent-color:#064c3b}.pro-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.pro-fields.off{opacity:.45}.pro-visits{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.pro-visit{min-width:34px;height:34px;padding:0 8px!important;border-radius:10px!important;background:#eef6f3!important;color:#064c3b!important;border:1px solid #d7e8e1!important}.pro-visit.done{background:#064c3b!important;color:#fff!important}.pro-warning{margin-top:10px;background:#fff4d7;border:1px solid #f0d28a;color:#805b00;border-radius:12px;padding:8px;font-weight:800}.pro-empty{border:1px dashed #d7e8e1;border-radius:12px;padding:8px;color:#60706a;background:#fbfdfc}.pro-empty.wide{padding:16px;text-align:center}.pro-annual-add{display:grid;grid-template-columns:1fr 1fr 160px auto;gap:10px;align-items:end;margin-bottom:14px}.pro-annual-list{display:grid;gap:10px}.pro-annual-item{display:grid;grid-template-columns:220px 1fr auto;gap:10px;align-items:center}.pro-report-card table{width:100%;border-collapse:collapse}.pro-report-card th,.pro-report-card td{border-bottom:1px solid #edf1ef;padding:10px;text-align:right}.pro-report-card th{background:#064c3b;color:#fff}
      .pro-contract-state{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px;border-radius:12px;padding:8px 10px;font-weight:900}.pro-contract-state.ok{background:#e7f6ef;color:#07533f}.pro-contract-state.missing{background:#fff4d7;color:#805b00}.pro-contract-state.idle{background:#eef1f0;color:#60706a}.pro-contract-state button{padding:7px 10px!important;border-radius:10px!important}
      .contract-pro-panel input:not([type="checkbox"]),.contract-pro-panel select{min-height:38px}.contract-pro-panel input:disabled,.contract-pro-panel select:disabled{background:#f7faf9!important;color:#879893!important;cursor:not-allowed}
      @media(max-width:820px){.contract-pro-head{display:block}.contract-pro-tools{margin-top:12px}.contract-pro-tabs{top:128px}.pro-fields,.pro-annual-add,.pro-annual-item{grid-template-columns:1fr}.pro-card-title{grid-template-columns:42px 1fr}}
    `;
    document.head.appendChild(s);
  }
  async function boot(){ css(); await loadAll(); renderContractsTable(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else setTimeout(boot,0);
  window.addEventListener('load', () => setTimeout(boot,500), {once:true});
  console.log('Tasneef contracts pro v11 loaded');
})();

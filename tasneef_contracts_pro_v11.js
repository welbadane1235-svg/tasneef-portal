(function(){
  'use strict';

  if (window.__tasneefContractsWorkflowV10) return;
  window.__tasneefContractsWorkflowV10 = true;

  const LS_KEY = 'tasneef_contract_smart_v299';
  const CORE = [
    { key: 'elevators', label: 'مصاعد' },
    { key: 'pools', label: 'مسابح' },
    { key: 'civilDefense', label: 'دفاع مدني' }
  ];
  const ANNUAL_OPTIONS = [
    'غسيل خزانات علوية',
    'غسيل خزانات أرضية',
    'رش مبيدات',
    'غسيل الأسطح',
    'تنظيف الممرات',
    'تنظيف المناور',
    'تنظيف المكيفات',
    'تنظيف غرفة المصاعد',
    'غسيل المواقف',
    'تنظيف عدسات الكاميرات',
    'التعطير',
    'خدمة أخرى'
  ];

  let cache = {};
  let loaded = false;
  let currentProjectId = '';
  let readonlyMode = false;

  const $ = id => document.getElementById(id);
  const A = v => Array.isArray(v) ? v : [];
  const S = v => String(v ?? '').trim();
  const N = v => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const esc = v => S(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const today = () => new Date().toISOString().slice(0, 10);
  function parseDate(value){
    const text = S(value);
    if (!text) return null;
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
  function daysLeftLocal(end){
    const endDate = parseDate(end);
    if (!endDate) return null;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.ceil((endDate - start) / 86400000);
  }
  function contractInfoLocal(project){
    const days = daysLeftLocal(project && project.contract_end);
    if (days === null) return { key: 'missing', text: 'بيانات ناقصة', cls: 'amber', days: '-' };
    if (days < 0) return { key: 'expired', text: 'منتهي', cls: 'red', days };
    if (days <= 30) return { key: 'soon', text: 'قريب الانتهاء', cls: 'amber', days };
    return { key: 'active', text: 'نشط', cls: 'green', days };
  }
  function isoDateLocal(value){
    const text = S(value);
    return text ? text.slice(0, 10) : '';
  }
  const say = (text, type) => {
    try {
      if (typeof window.msg === 'function') window.msg(text, type);
      else alert(text);
    } catch (_) {
      alert(text);
    }
  };

  function projects(){
    return A((window.data && window.data.projects) || []);
  }

  function projectById(id){
    return projects().find(p => S(p.id) === S(id)) || null;
  }

  function readLS(){
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }

  function writeLS(){
    try { localStorage.setItem(LS_KEY, JSON.stringify(cache)); } catch (_) {}
  }

  function defaultRecord(){
    const contracts = {};
    CORE.forEach(item => {
      contracts[item.key] = {
        onUs: false,
        company: '',
        phone: '',
        start: '',
        end: '',
        visits: 0,
        done: [],
        notes: ''
      };
    });
    return {
      contracts,
      annual: [],
      updated_at: null
    };
  }

  function normalize(raw){
    const out = defaultRecord();
    raw = raw || {};
    const oldCore = raw.contracts || raw.core || {};
    CORE.forEach(item => {
      const old = oldCore[item.key] || {};
      out.contracts[item.key] = {
        onUs: !!(old.onUs ?? old.on_us),
        company: S(old.company || old.company_name),
        phone: S(old.phone || old.company_phone),
        start: S(old.start || old.from || old.contract_start),
        end: S(old.end || old.to || old.contract_end),
        visits: N(old.visits || old.visit_count),
        done: A(old.done).map(Number).filter(Boolean),
        notes: S(old.notes)
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

  async function loadSmart(){
    if (loaded) return;
    cache = readLS();
    try {
      if (window.sb) {
        const query = window.sb.from('project_contract_smart').select('*');
        const res = await Promise.race([
          query,
          new Promise(resolve => setTimeout(() => resolve({ error: { message: 'timeout' }, data: null }), 1800))
        ]);
        if (!res.error && Array.isArray(res.data)) {
          res.data.forEach(row => { cache[S(row.project_id)] = normalize(row.payload); });
          writeLS();
        }
      }
    } catch (error) {
      console.warn('contract smart load fallback', error);
    }
    loaded = true;
  }

  function getRecord(projectId){
    return normalize(cache[S(projectId)] || {});
  }

  async function persist(projectId, payload){
    const clean = normalize(payload);
    clean.updated_at = new Date().toISOString();
    cache[S(projectId)] = clean;
    writeLS();
    try {
      if (window.sb) {
        const res = await window.sb.from('project_contract_smart').upsert({
          project_id: Number(projectId) || projectId,
          payload: clean,
          updated_at: new Date().toISOString()
        }, { onConflict: 'project_id' });
        if (res.error) console.warn('project_contract_smart fallback localStorage:', res.error.message);
      }
    } catch (error) {
      console.warn(error);
    }
    return clean;
  }

  function collectFromModal(){
    const record = defaultRecord();
    CORE.forEach(item => {
      const card = document.querySelector(`[data-v10-contract="${item.key}"]`);
      const old = getRecord(currentProjectId).contracts[item.key] || {};
      const visits = Math.max(0, N(card?.querySelector('[data-field="visits"]')?.value));
      record.contracts[item.key] = {
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
    record.annual = getRecord(currentProjectId).annual;
    return record;
  }

  function visitChips(kind, key, visits, done){
    visits = Math.max(0, N(visits));
    done = new Set(A(done).map(Number));
    if (!visits) return '<div class="contract-empty-v10">حدد عدد الزيارات حتى تظهر الأرقام.</div>';
    return Array.from({ length: visits }, (_, i) => {
      const n = i + 1;
      return `<button type="button" class="visit-chip-v10 ${done.has(n) ? 'done' : ''}" ${readonlyMode ? 'disabled' : ''} onclick="${kind}('${esc(key)}',${n})">${n}</button>`;
    }).join('');
  }

  function renderContractsInsideModal(record){
    const box = $('contractCoreServices');
    if (!box) return;
    box.classList.remove('three');
    box.classList.add('contract-grid-v10');
    box.innerHTML = CORE.map(item => {
      const row = record.contracts[item.key] || {};
      const onUs = !!row.onUs;
      const missing = contractMissing(row);
      return `<section class="contract-card-v10 ${onUs ? 'on-us' : ''}" data-v10-contract="${item.key}">
        <div class="contract-card-head-v10">
          <h3>${esc(item.label)}</h3>
          <label class="contract-switch-v10">
            <input type="checkbox" data-field="onUs" ${onUs ? 'checked' : ''} ${readonlyMode ? 'disabled' : ''} onchange="contractV10RefreshCore('${item.key}')">
            <span>العقد علينا</span>
          </label>
        </div>
        <div class="contract-fields-v10 ${onUs ? '' : 'muted-off'}">
          <div><label>اسم الشركة</label><input data-field="company" value="${esc(row.company)}" ${readonlyMode ? 'disabled' : ''}></div>
          <div><label>رقم الشركة</label><input data-field="phone" value="${esc(row.phone)}" ${readonlyMode ? 'disabled' : ''}></div>
          <div><label>من تاريخ</label><input type="date" data-field="start" value="${esc(row.start)}" ${readonlyMode ? 'disabled' : ''}></div>
          <div><label>إلى تاريخ</label><input type="date" data-field="end" value="${esc(row.end)}" ${readonlyMode ? 'disabled' : ''}></div>
          <div><label>عدد الزيارات</label><input type="number" min="0" data-field="visits" value="${esc(row.visits)}" ${readonlyMode ? 'disabled' : ''} onchange="contractV10RefreshCore('${item.key}')"></div>
          <div><label>ملاحظات</label><input data-field="notes" value="${esc(row.notes)}" ${readonlyMode ? 'disabled' : ''}></div>
        </div>
        <div class="visit-row-v10">${visitChips('contractV10ToggleCoreVisit', item.key, row.visits, row.done)}</div>
        ${onUs && missing.length ? `<div class="contract-warning-v10">ناقص: ${esc(missing.join('، '))}</div>` : ''}
      </section>`;
    }).join('');
  }

  function renderAnnual(record){
    fillAnnualSelect();
    const body = $('csAnnualBody');
    if (!body) return;
    body.innerHTML = A(record.annual).map(item => {
      const done = A(item.done);
      return `<tr>
        <td><b>${esc(item.name)}</b>${item.notes ? `<br><small>${esc(item.notes)}</small>` : ''}</td>
        <td>${N(item.visits)}</td>
        <td><div class="visit-row-v10">${visitChips('contractV10ToggleAnnualVisit', item.id, item.visits, done)}</div></td>
        <td>${done.length}</td>
        <td>${Math.max(0, N(item.visits) - done.length)}</td>
        <td>${readonlyMode ? '-' : `<button class="danger" onclick="contractV10DeleteAnnual('${esc(item.id)}')">حذف</button>`}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="6">لا توجد خدمات سنوية بعد</td></tr>';
  }

  function contractMissing(row){
    const miss = [];
    if (!row.company) miss.push('اسم الشركة');
    if (!row.phone) miss.push('رقم الشركة');
    if (!row.start) miss.push('من تاريخ');
    if (!row.end) miss.push('إلى تاريخ');
    if (!N(row.visits)) miss.push('عدد الزيارات');
    return miss;
  }

  function contractAlertsForProject(project, record){
    const alerts = [];
    CORE.forEach(item => {
      const row = record.contracts[item.key];
      if (!row || !row.onUs) return;
      const missing = contractMissing(row);
      if (missing.length) alerts.push({ group: item.label, project: project.name || '-', text: 'بيانات ناقصة: ' + missing.join('، ') });
      const remaining = Math.max(0, N(row.visits) - A(row.done).length);
      if (N(row.visits) && remaining) alerts.push({ group: item.label, project: project.name || '-', text: `متبقي ${remaining} زيارة من ${N(row.visits)}` });
    });
    A(record.annual).forEach(item => {
      const remaining = Math.max(0, N(item.visits) - A(item.done).length);
      if (remaining) alerts.push({ group: 'خدمات سنوية', project: project.name || '-', text: `${item.name}: متبقي ${remaining} من ${N(item.visits)}` });
    });
    return alerts;
  }

  function renderSmartAlerts(){
    const host = $('contractsAlertsList');
    if (!host) return;
    const alerts = [];
    projects().forEach(project => alerts.push(...contractAlertsForProject(project, getRecord(project.id))));
    const grouped = new Map();
    alerts.forEach(alert => {
      if (!grouped.has(alert.group)) grouped.set(alert.group, []);
      grouped.get(alert.group).push(alert);
    });
    const html = [...grouped.entries()].map(([group, rows]) => `<div class="alert-item warn contract-alert-group-v10">
      <b>${esc(group)}</b>
      ${rows.slice(0, 12).map(row => `<div><strong>${esc(row.project)}</strong>: ${esc(row.text)}</div>`).join('')}
    </div>`).join('');
    if (html) host.innerHTML = html;
  }

  function renderReport(record){
    const box = $('csClientReportBox');
    if (!box) return;
    const p = projectById(currentProjectId) || {};
    const coreRows = CORE.map(item => {
      const row = record.contracts[item.key];
      if (!row.onUs) return '';
      return `<tr><td>${esc(item.label)}</td><td>${esc(row.company || '-')}</td><td>${esc(row.phone || '-')}</td><td>${esc(row.start || '-')}</td><td>${esc(row.end || '-')}</td><td>${A(row.done).length} / ${N(row.visits)}</td></tr>`;
    }).filter(Boolean).join('');
    const annualRows = A(record.annual).map(item => `<tr><td>${esc(item.name)}</td><td colspan="4">خدمة سنوية</td><td>${A(item.done).length} / ${N(item.visits)}</td></tr>`).join('');
    box.innerHTML = `<div class="smart-box"><b>المشروع:</b> ${esc(p.name || '-')}</div>
      <table class="smart-report-table"><thead><tr><th>القسم / الخدمة</th><th>الشركة</th><th>رقم الشركة</th><th>من</th><th>إلى</th><th>التنفيذ</th></tr></thead><tbody>${coreRows || '<tr><td colspan="6">لا توجد عقود علينا</td></tr>'}${annualRows}</tbody></table>`;
  }

  function fillAnnualSelect(){
    const select = $('csAnnualSelect');
    if (!select || select.dataset.v10) return;
    select.innerHTML = ANNUAL_OPTIONS.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
    select.dataset.v10 = '1';
  }

  function hideOldServices(){
    const services = $('servicesSubTab');
    if (services) services.classList.add('hidden');
    const oldBtns = document.querySelectorAll('#contractsTabBtn,#servicesTabBtn');
    oldBtns.forEach(btn => btn.style.display = 'none');
  }

  window.openContractSmartModal = async function(projectId, mode){
    await loadSmart();
    hideOldServices();
    currentProjectId = S(projectId);
    readonlyMode = mode === 'view';
    const project = projectById(projectId) || {};
    const record = getRecord(projectId);
    if ($('contractSmartTitle')) $('contractSmartTitle').textContent = (readonlyMode ? 'عرض عقود: ' : 'تعديل عقود: ') + (project.name || '');
    if ($('contractSmartSub')) $('contractSmartSub').textContent = 'العقود: مصاعد، مسابح، دفاع مدني، والخدمات السنوية';
    if ($('contractSmartProjectId')) $('contractSmartProjectId').value = currentProjectId;
    const save = $('contractSmartSaveBtn');
    if (save) {
      save.style.display = readonlyMode ? 'none' : '';
      save.onclick = window.saveContractSmartModal;
      save.textContent = 'حفظ';
    }
    renderContractsInsideModal(record);
    renderAnnual(record);
    renderReport(record);
    document.querySelectorAll('.contract-smart-tabs button').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.contract-smart-tabs button')?.classList.add('active');
    ['Main', 'Annual', 'Report'].forEach(name => $('contractSmart' + name + 'Tab')?.classList.toggle('hidden', name !== 'Main'));
    const modal = $('contractSmartModal');
    if (modal) {
      document.body.appendChild(modal);
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
    }
    document.body.style.overflow = 'hidden';
  };

  window.closeContractSmartModal = function(){
    const modal = $('contractSmartModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = '';
    }
    document.body.style.overflow = '';
    currentProjectId = '';
  };

  window.contractSmartBackdrop = function(event){
    if (event && event.target && event.target.id === 'contractSmartModal') window.closeContractSmartModal();
  };

  window.contractSmartTab = function(tab, btn){
    ['main', 'annual', 'report'].forEach(name => $('contractSmart' + name.charAt(0).toUpperCase() + name.slice(1) + 'Tab')?.classList.add('hidden'));
    $('contractSmart' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Tab')?.classList.remove('hidden');
    document.querySelectorAll('.contract-smart-tabs button').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');
    if (tab === 'report') renderReport(getRecord(currentProjectId));
  };

  window.contractV10RefreshCore = function(){
    const record = collectFromModal();
    cache[S(currentProjectId)] = record;
    writeLS();
    renderContractsInsideModal(record);
    renderReport(record);
  };

  window.contractV10ToggleCoreVisit = function(key, no){
    if (readonlyMode) return;
    const record = collectFromModal();
    const row = record.contracts[key];
    if (!row) return;
    const n = Number(no);
    const set = new Set(A(row.done).map(Number));
    if (set.has(n)) set.delete(n); else set.add(n);
    row.done = [...set].sort((a, b) => a - b);
    cache[S(currentProjectId)] = record;
    writeLS();
    renderContractsInsideModal(record);
    renderReport(record);
  };

  window.addContractAnnualService = function(){
    if (readonlyMode) return;
    const record = collectFromModal();
    let name = S($('csAnnualSelect')?.value);
    const custom = S($('csAnnualCustom')?.value);
    if (custom) name = custom;
    const visits = Math.max(1, N($('csAnnualVisits')?.value || 1));
    if (!name) return say('اختر الخدمة أو اكتب اسمها', 'err');
    record.annual.push({ id: 'a' + Date.now() + Math.random().toString(16).slice(2), name, visits, done: [], notes: '' });
    cache[S(currentProjectId)] = record;
    writeLS();
    if ($('csAnnualCustom')) $('csAnnualCustom').value = '';
    if ($('csAnnualVisits')) $('csAnnualVisits').value = '1';
    renderAnnual(record);
    renderReport(record);
  };

  window.contractV10ToggleAnnualVisit = function(id, no){
    if (readonlyMode) return;
    const record = collectFromModal();
    const item = A(record.annual).find(x => S(x.id) === S(id));
    if (!item) return;
    const n = Number(no);
    const set = new Set(A(item.done).map(Number));
    if (set.has(n)) set.delete(n); else set.add(n);
    item.done = [...set].sort((a, b) => a - b);
    cache[S(currentProjectId)] = record;
    writeLS();
    renderAnnual(record);
    renderReport(record);
  };

  window.contractV10DeleteAnnual = function(id){
    if (readonlyMode) return;
    if (!confirm('حذف هذه الخدمة السنوية؟')) return;
    const record = collectFromModal();
    record.annual = A(record.annual).filter(x => S(x.id) !== S(id));
    cache[S(currentProjectId)] = record;
    writeLS();
    renderAnnual(record);
    renderReport(record);
  };

  window.saveContractSmartModal = async function(){
    if (!currentProjectId) return;
    const record = collectFromModal();
    await persist(currentProjectId, record);
    say('تم حفظ عقود المشروع والخدمات السنوية');
    renderContracts();
    renderSmartAlerts();
  };

  window.renderContracts = function(){
    const body = $('contractsBody');
    if (!body) return;
    const q = S($('contractSearch')?.value);
    const status = S($('contractFilterStatus')?.value);
    let rows = projects();
    if (q) rows = rows.filter(p => [p.name, p.location].join(' ').includes(q));
    if (status) rows = rows.filter(p => contractInfoLocal(p).key === status);
    rows.sort((a, b) => {
      const da = daysLeftLocal(a.contract_end);
      const db = daysLeftLocal(b.contract_end);
      return (da ?? 999999) - (db ?? 999999);
    });
    body.innerHTML = rows.map(p => {
      const info = contractInfoLocal(p);
      return `<tr><td><b>${esc(p.name)}</b></td><td>${N(p.buildings_count)}</td><td>${N(p.units_count)}</td><td>${esc(isoDateLocal(p.contract_start) || '-')}</td><td>${esc(isoDateLocal(p.contract_end) || '-')}</td><td>${esc(info.days)}</td><td><span class="badge ${esc(info.cls)}">${esc(info.text)}</span></td><td class="row-actions"><button class="light" onclick="openContractSmartModal(${Number(p.id)||0},'view')">عرض</button><button onclick="openContractSmartModal(${Number(p.id)||0},'edit')">تعديل</button></td></tr>`;
    }).join('') || '<tr><td colspan="8">لا توجد بيانات</td></tr>';
    if ($('contractsActiveCount')) $('contractsActiveCount').textContent = projects().filter(p => contractInfoLocal(p).key === 'active').length;
    if ($('contractsSoonCount')) $('contractsSoonCount').textContent = projects().filter(p => contractInfoLocal(p).key === 'soon').length;
    if ($('contractsExpiredCount')) $('contractsExpiredCount').textContent = projects().filter(p => contractInfoLocal(p).key === 'expired').length;
    if ($('contractsMissingCount')) $('contractsMissingCount').textContent = projects().filter(p => contractInfoLocal(p).key === 'missing').length;
    renderSmartAlerts();
  };

  const oldRenderProjects = window.renderProjects;
  window.renderProjects = function(){
    if (typeof oldRenderProjects === 'function') oldRenderProjects.apply(this, arguments);
    const body = $('projectsBody');
    if (!body) return;
    A([...body.querySelectorAll('tr')]).forEach(tr => {
      if (tr.querySelector('[data-contract-view-v10]')) return;
      const onclick = A([...tr.querySelectorAll('button')]).map(btn => btn.getAttribute('onclick') || '').find(text => /editProject\(/.test(text)) || '';
      const match = onclick.match(/editProject\(([^)]+)\)/);
      const projectId = match ? Number(String(match[1]).replace(/['"]/g, '')) : 0;
      if (!projectId) return;
      const actions = tr.querySelector('.row-actions') || tr.lastElementChild;
      if (actions) actions.insertAdjacentHTML('afterbegin', `<button class="light" data-contract-view-v10="1" onclick="openContractSmartModal(${projectId},'view')">عرض</button>`);
    });
  };

  const oldShowPage = window.showPage;
  window.showPage = function(id, btn){
    if (id !== 'contracts') window.closeContractSmartModal();
    const result = oldShowPage ? oldShowPage.apply(this, arguments) : undefined;
    if (id === 'contracts') {
      hideOldServices();
      setTimeout(() => { hideOldServices(); renderContracts(); }, 60);
    }
    return result;
  };

  const oldShowContractsSubTab = window.showContractsSubTab;
  window.showContractsSubTab = function(tab){
    hideOldServices();
    const contracts = $('contractsSubTab');
    if (contracts) contracts.classList.remove('hidden');
    if (tab && tab !== 'services' && oldShowContractsSubTab) return oldShowContractsSubTab.apply(this, arguments);
    renderContracts();
  };

  function installCss(){
    if ($('contractWorkflowV10Css')) return;
    const style = document.createElement('style');
    style.id = 'contractWorkflowV10Css';
    style.textContent = `
      #servicesSubTab{display:none!important}
      #contractSmartModal.contract-smart-modal{position:fixed!important;inset:0!important;z-index:999999!important;display:flex;align-items:center;justify-content:center;background:rgba(8,31,25,.62)!important;padding:18px!important}
      #contractSmartModal.contract-smart-modal.hidden{display:none!important}
      #contractSmartModal .contract-smart-panel{width:min(1260px,96vw)!important;max-height:92vh!important;overflow:auto!important;background:#fff!important;border-radius:24px!important;box-shadow:0 30px 90px rgba(0,0,0,.28)!important}
      .contract-grid-v10{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(270px,1fr))!important;gap:12px!important}
      .contract-card-v10{border:1px solid #d9e8e1;border-radius:14px;background:#fff;padding:12px}
      .contract-card-v10.on-us{border-color:#86cdb5;background:#fbfffd}
      .contract-card-head-v10{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .contract-card-head-v10 h3{margin:0;color:#063f32}
      .contract-switch-v10{display:inline-flex;align-items:center;gap:7px;margin:0;color:#063f32;font-weight:800}
      .contract-switch-v10 input{width:auto}
      .contract-fields-v10{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
      .contract-fields-v10.muted-off{opacity:.42}
      .visit-row-v10{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
      .visit-chip-v10{min-width:34px;height:34px;border-radius:10px;background:#eef6f3!important;color:#064c3b!important;border:1px solid #d7e8e1!important;padding:0 8px!important}
      .visit-chip-v10.done{background:#064c3b!important;color:#fff!important;border-color:#064c3b!important}
      .contract-warning-v10{margin-top:10px;border:1px solid #f0c3c3;background:#fdecec;color:#9d2222;border-radius:10px;padding:8px;font-weight:800}
      .contract-empty-v10{border:1px dashed #d7e8e1;border-radius:10px;padding:8px;color:#60706a;background:#fbfdfc}
      .contract-alert-group-v10 div{margin-top:6px;line-height:1.7}
      @media(max-width:760px){.contract-fields-v10{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  async function boot(){
    installCss();
    hideOldServices();
    fillAnnualSelect();
    await loadSmart();
    try { renderContracts(); } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else setTimeout(boot, 0);
  window.addEventListener('load', () => setTimeout(boot, 500), { once: true });

  console.log('Tasneef contracts workflow v10 loaded');
})();

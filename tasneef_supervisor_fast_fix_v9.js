(function(){
  'use strict';

  if (window.__tasneefTechnicianFastFixV9) return;
  window.__tasneefTechnicianFastFixV9 = true;

  const $ = id => document.getElementById(id);
  const A = value => Array.isArray(value) ? value : [];
  const S = value => String(value ?? '').trim();
  const today = () => new Date().toISOString().slice(0, 10);
  const say = (text, type) => {
    try {
      if (typeof window.msg === 'function') window.msg(text, type);
      else alert(text);
    } catch (_) {
      alert(text);
    }
  };

  function ds(){
    window.data = window.data || {};
    return window.data;
  }

  function currentUser(){
    try {
      if (typeof window.session === 'function') return window.session() || {};
    } catch (_) {}
    try {
      return JSON.parse(localStorage.getItem('tasneef_user') || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  async function safeQuery(builder){
    try {
      const res = await builder;
      if (res && res.error) console.warn(res.error.message || res.error);
      return A(res && res.data);
    } catch (error) {
      console.warn(error);
      return [];
    }
  }

  function esc(value){
    return S(value).replace(/[<>&"]/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[m]));
  }

  function fillProjects(){
    const el = $('techNewTicketProject');
    if (!el) return;
    const current = el.value;
    el.innerHTML = '<option value="">اختر المشروع</option>' +
      A(ds().projects).map(p => `<option value="${esc(p.id)}">${esc(p.name || p.project_name || p.id)}</option>`).join('');
    if (current && [...el.options].some(o => S(o.value) === S(current))) el.value = current;
  }

  async function loadTechnicianData(){
    const d = ds();
    const [projects, tickets, users] = await Promise.all([
      safeQuery(window.sb.from('projects').select('*').order('id').limit(1000)),
      safeQuery(window.sb.from('tickets').select('*').order('id', { ascending: false }).limit(350)),
      safeQuery(window.sb.from('app_users').select('id,full_name,username,role,is_active').order('id').limit(300))
    ]);
    d.projects = projects;
    d.tickets = tickets;
    d.users = users;
    d.supervisors = users.filter(u => u.role === 'supervisor' && u.is_active !== false);
  }

  async function reloadAndRender(){
    if (!window.sb) return;
    await loadTechnicianData();
    fillProjects();
    try { window.renderTechnicianTickets && window.renderTechnicianTickets(); } catch (e) { console.warn(e); }
    try { window.renderTechAttendance && window.renderTechAttendance(); } catch (_) {}
  }

  window.tasneefReloadTechnicianFastV9 = reloadAndRender;

  window.initTechnician = async function(){
    const u = currentUser();
    if (!u || !u.id) {
      try {
        if (typeof window.requireRole === 'function') window.requireRole('technician');
      } catch (_) {}
      return;
    }
    if ($('techTitle')) $('techTitle').textContent = 'لوحة الفني - ' + (u.full_name || u.username || '');
    await reloadAndRender();
    if (!window.__tasneefTechRefreshV9) {
      window.__tasneefTechRefreshV9 = setInterval(reloadAndRender, 60000);
    }
  };

  async function updateTicket(id, row, doneMessage){
    if (!window.sb) return say('الاتصال بقاعدة البيانات غير متاح', 'err');
    const res = await window.sb.from('tickets').update(row).eq('id', id);
    if (res.error) return say(res.error.message || String(res.error), 'err');
    say(doneMessage);
    await reloadAndRender();
  }

  window.techClaimTicket = async function(id){
    const u = currentUser();
    const t = A(ds().tickets).find(x => S(x.id) === S(id));
    if (!t) return say('التكت غير موجود', 'err');
    if (S(t.status) === 'closed') return say('التكت مغلق', 'err');
    if (t.claimed_by && S(t.claimed_by) !== S(u.id)) return say('هذا التكت مستلم بواسطة ' + (t.claimed_by_name || 'شخص آخر'), 'err');
    const now = new Date().toISOString();
    const name = u.full_name || u.username || 'الفني';
    await updateTicket(id, {
      status: 'processing',
      claimed_by: u.id,
      claimed_by_name: name,
      claimed_at: t.claimed_at || now,
      updated_at: now
    }, 'تم استلام التكت');
  };

  window.techCloseTicket = async function(id){
    const u = currentUser();
    const t = A(ds().tickets).find(x => S(x.id) === S(id));
    if (!t) return say('التكت غير موجود', 'err');
    if (S(t.status) === 'closed') return say('التكت مغلق بالفعل', 'err');
    const note = prompt('كيف تم إغلاق التكت؟');
    if (!note || !S(note)) return say('لا يمكن إغلاق التكت بدون ذكر طريقة الإغلاق', 'err');
    const now = new Date().toISOString();
    const name = u.full_name || u.username || 'الفني';
    const row = {
      status: 'closed',
      closed_at: now,
      closed_by: u.id,
      closed_by_name: name,
      closure_note: S(note),
      updated_at: now
    };
    if (!t.claimed_at) {
      row.claimed_by = u.id;
      row.claimed_by_name = name;
      row.claimed_at = now;
    }
    await updateTicket(id, row, 'تم إغلاق التكت');
  };

  window.saveTechnicianTicket = async function(){
    const u = currentUser();
    const project = $('techNewTicketProject')?.value;
    const title = $('techNewTicketTitle')?.value;
    const description = $('techNewTicketDescription')?.value;
    if (!project || !S(title)) return say('اختر المشروع واكتب عنوان التكت', 'err');
    const row = {
      project_id: Number(project) || project,
      title: S(title),
      description: S(description),
      priority: $('techNewTicketPriority')?.value || 'normal',
      status: 'open',
      created_by: u.id,
      supervisor_id: null
    };
    const res = await window.sb.from('tickets').insert(row);
    if (res.error) return say(res.error.message || String(res.error), 'err');
    say('تم حفظ التكت');
    try {
      if (typeof window.clearTechnicianTicketForm === 'function') window.clearTechnicianTicketForm();
    } catch (_) {}
    await reloadAndRender();
  };

  console.log('Tasneef technician fast fix v9 loaded');
})();

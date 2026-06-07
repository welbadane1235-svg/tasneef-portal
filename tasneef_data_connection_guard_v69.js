(function(){
  'use strict';
  if(window.__tasneefDataConnectionGuardV69) return;
  window.__tasneefDataConnectionGuardV69 = true;

  const SUPABASE_URL = 'https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const A = value => Array.isArray(value) ? value : [];
  const N = value => Number(String(value ?? 0).replace(/[^\d.-]/g, '')) || 0;

  function say(text, type){
    const el = document.getElementById('globalMsg') || document.getElementById('loginMsg');
    if(typeof window.msg === 'function'){
      try{ window.msg(text, type || 'ok'); return; }catch(_){}
    }
    if(!el) return;
    el.className = 'msg ' + (type === 'err' ? 'err' : '');
    el.textContent = text;
    el.classList.remove('hidden');
  }

  function kpiIsEmpty(){
    const ids = ['kpiUsers','kpiProjects','kpiWorkers'];
    return ids.every(id => {
      const el = document.getElementById(id);
      return !el || N(el.textContent) === 0;
    });
  }

  function dataIsEmpty(){
    const d = window.data || {};
    return A(d.users).length === 0 && A(d.projects).length === 0 && A(d.workers).length === 0;
  }

  async function restTable(table, order){
    const params = new URLSearchParams();
    params.set('select', '*');
    if(order) params.set('order', order);
    const res = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + params.toString(), {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        Accept: 'application/json'
      }
    });
    if(!res.ok) throw new Error(table + ': ' + res.status);
    return await res.json();
  }

  async function directReload(){
    const d = window.data || {};
    window.data = d;
    const today = new Date().toISOString().slice(0,10);
    const results = await Promise.allSettled([
      restTable('app_users', 'id.asc'),
      restTable('projects', 'id.asc'),
      restTable('workers', 'id.asc'),
      restTable('attendance', 'attendance_date.desc'),
      restTable('time_logs', 'check_in.desc'),
      restTable('tickets', 'created_at.desc'),
      restTable('contract_services', 'id.desc')
    ]);

    const [users, projects, workers, attendance, logs, tickets, contractServices] =
      results.map(r => r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : []);

    if(!users.length && !projects.length && !workers.length){
      throw new Error('لم تصل أي بيانات من القاعدة');
    }

    d.users = users;
    d.supervisors = users.filter(u => u.role === 'supervisor' && u.is_active !== false);
    d.technicians = users.filter(u => u.role === 'technician' && u.is_active !== false);
    d.projects = projects;
    d.workers = workers;
    d.attendance = attendance;
    d.logs = logs;
    d.tickets = tickets;
    d.contractServices = contractServices;
    d.__connectionGuardReloadDate = today;

    try{ if(typeof window.hydrateForms === 'function') window.hydrateForms(); }catch(_){}
    try{ if(typeof window.renderAll === 'function') window.renderAll(); }catch(_){}
    try{ if(typeof window.renderDashboard === 'function') window.renderDashboard(); }catch(_){}
    say('تم تحديث البيانات من القاعدة');
  }

  async function checkAndRepair(){
    if(!document.getElementById('dashboard')) return;
    if(!kpiIsEmpty() || !dataIsEmpty()) return;

    say('جاري الاتصال بالبيانات...');
    try{
      if(typeof window.refreshAll === 'function'){
        await Promise.race([
          window.refreshAll(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('انتهت مهلة التحديث')), 9000))
        ]);
      }
    }catch(_){}

    if(!kpiIsEmpty() || !dataIsEmpty()) return;

    try{
      await directReload();
    }catch(error){
      say('لم يتم الاتصال بالبيانات. تأكد من الإنترنت ثم اضغط تحديث البيانات.', 'err');
      console.warn('Tasneef data connection guard failed', error);
    }
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(checkAndRepair, 1800));
  window.addEventListener('load', () => setTimeout(checkAndRepair, 2600));
  setTimeout(checkAndRepair, 4200);
})();

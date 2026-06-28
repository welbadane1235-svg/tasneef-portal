/* Tasneef V10242 - Tickets full pagination / accurate totals
   Fix: old loaders were limiting tickets to 300 rows, so the admin tickets total stayed 300.
   This patch does not modify database rows. It only reads tickets in pages and feeds the existing renderer. */
(function(){
  'use strict';
  if(window.__tasneefTicketsFullLoadV10242) return;
  window.__tasneefTicketsFullLoadV10242 = true;

  const VERSION = 'V10242';
  const PAGE_SIZE = 1000;
  const MAX_ROWS = 20000; // safety cap
  let loading = false;
  let loadedOnce = false;
  let lastLoadedAt = 0;

  function $(id){ return document.getElementById(id); }
  function rows(x){ return Array.isArray(x) ? x : []; }
  function getDb(){
    return window.sb || window.supabaseClient || window.supabase;
  }
  function isTicketsVisible(){
    return !!($('ticketsBody') || $('ticketsSmartSummary') || $('ticketFiltersV10229') || document.querySelector('[data-tab="tickets"]'));
  }
  function setBadge(text){
    const box = $('ticketsSmartSummary');
    if(!box) return;
    const old = $('ticketsFullLoadNoteV10242');
    if(old) old.remove();
    const div = document.createElement('div');
    div.id = 'ticketsFullLoadNoteV10242';
    div.style.cssText='font-size:12px;color:#0a4033;font-weight:700;margin:6px 0;text-align:right';
    div.textContent = text;
    box.parentNode.insertBefore(div, box);
    setTimeout(()=>{ try{ div.remove(); }catch(_){} }, 3500);
  }

  async function fetchAllTicketsV10242(force){
    if(loading) return rows(window.data && window.data.tickets);
    if(!force && loadedOnce && Date.now() - lastLoadedAt < 120000) return rows(window.data && window.data.tickets);

    const db = getDb();
    if(!db || !db.from) return rows(window.data && window.data.tickets);

    loading = true;
    try{
      let all = [];
      for(let from=0; from<MAX_ROWS; from += PAGE_SIZE){
        const to = from + PAGE_SIZE - 1;
        const res = await db.from('tickets')
          .select('*')
          .order('created_at', { ascending:false })
          .range(from, to);

        if(res.error) throw res.error;
        const part = rows(res.data);
        all = all.concat(part);
        if(part.length < PAGE_SIZE) break;
      }

      if(!window.data) window.data = {};
      window.data.tickets = all;
      window.data.__ticketsFullLoadedV10242 = true;
      window.data.__ticketsFullLoadedAtV10242 = new Date().toISOString();
      loadedOnce = true;
      lastLoadedAt = Date.now();

      try{ if(typeof window.renderTicketsCleanV10229 === 'function') window.renderTicketsCleanV10229(); }
      catch(e){ console.warn('renderTicketsCleanV10229 failed', e); }
      try{ if(typeof window.renderTickets === 'function') window.renderTickets(); }
      catch(e){ console.warn('renderTickets failed', e); }

      const note = `تم تحميل كل التكتات بدون حد 300. العدد: ${all.length}`;
      setBadge(note);
      return all;
    }catch(e){
      console.warn('V10242 full tickets load failed:', e);
      setBadge('تعذر تحميل كل التكتات، سيتم عرض آخر 300 فقط مؤقتًا');
      return rows(window.data && window.data.tickets);
    }finally{
      loading = false;
    }
  }

  function needFullLoad(){
    const current = rows(window.data && window.data.tickets);
    // If exactly 300 or not full-loaded, old loader probably capped the rows.
    return current.length === 300 || !window.data || !window.data.__ticketsFullLoadedV10242;
  }

  async function boot(force){
    if(!isTicketsVisible()) return;
    if(force || needFullLoad()) await fetchAllTicketsV10242(!!force);
  }

  // Wrap renderTickets so old loaders cannot permanently overwrite with 300 tickets.
  const originalRender = window.renderTickets;
  window.renderTickets = function(){
    try{
      if(typeof originalRender === 'function') originalRender.apply(this, arguments);
    }catch(e){ console.warn(e); }
    setTimeout(()=>boot(false), 100);
  };

  // Manual refresh hook
  window.reloadAllTicketsV10242 = function(){ return fetchAllTicketsV10242(true); };

  document.addEventListener('DOMContentLoaded', ()=>setTimeout(()=>boot(false), 900));
  window.addEventListener('load', ()=>[1200, 3000, 6000].forEach(ms=>setTimeout(()=>boot(false), ms)));
  document.addEventListener('click', function(e){
    const txt = (e.target && (e.target.innerText || e.target.textContent) || '').trim();
    if(txt.includes('التكت') || txt.includes('تحديث البيانات')) setTimeout(()=>boot(false), 500);
  }, true);
})();
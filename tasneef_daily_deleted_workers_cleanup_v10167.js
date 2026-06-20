/* Tasneef v10167 - Clean worker movements when a time_log is deleted */
(function(){
  'use strict';
  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const S=v=>String(v==null?'':v).trim();
  const $=id=>document.getElementById(id);
  function c(){
    if(window.sb&&window.sb.from) return window.sb;
    if(window.supabaseClient&&window.supabaseClient.from) return window.supabaseClient;
    if(window.supabase&&window.supabase.from) return window.supabase;
    if(window.supabase&&window.supabase.createClient){ window.sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY); return window.sb; }
    return null;
  }
  async function deleteWorkersForLog(id){
    id=S(id); if(!id||!c()) return;
    try{ await c().from('worker_project_movements').delete().eq('time_log_id',id); }catch(e){ console.warn('worker movement cascade failed',e); }
    setTimeout(()=>{try{ if(typeof window.renderTimeLogs==='function') window.renderTimeLogs(); }catch(_){ }},300);
  }
  window.tasneefDeleteWorkersForTimeLogV10167=deleteWorkersForLog;
  const oldFetch=window.fetch;
  if(typeof oldFetch==='function' && !window.__tasneefFetchDailyDeleteV10167){
    window.__tasneefFetchDailyDeleteV10167=true;
    window.fetch=async function(input,init){
      const url=typeof input==='string'?input:(input&&input.url)||'';
      const method=S((init&&init.method)||(input&&input.method)||'GET').toUpperCase();
      const m=url.match(/\/rest\/v1\/time_logs\?[^#]*\bid=eq\.([^&]+)/);
      const res=await oldFetch.apply(this,arguments);
      if(method==='DELETE' && m){
        const id=decodeURIComponent(m[1]);
        setTimeout(()=>deleteWorkersForLog(id),50);
      }
      return res;
    };
  }
  document.addEventListener('click',function(e){
    const btn=e.target&&e.target.closest&&e.target.closest('button,.danger');
    if(!btn) return;
    const txt=S(btn.textContent);
    if(!/حذف/.test(txt)) return;
    const tr=btn.closest('tr'); if(!tr) return;
    const raw=(btn.getAttribute('onclick')||'')+' '+[...tr.attributes].map(a=>a.value).join(' ');
    const m=raw.match(/['"]([0-9a-fA-F-]{8,}|\d{1,})['"]/);
    if(m) setTimeout(()=>deleteWorkersForLog(m[1]),1200);
  },true);
})();

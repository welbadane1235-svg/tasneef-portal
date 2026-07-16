/* Tasneef V10514 - immediate supervisor log refresh + durable history sync */
(function(){
  'use strict';
  if(window.__tasneefDailySyncV10514) return;
  window.__tasneefDailySyncV10514=true;

  function refresh(delay){
    setTimeout(function(){
      try{
        if(typeof window.renderTimeLogs==='function') window.renderTimeLogs({allowEmpty:true});
      }catch(e){console.warn('V10514 daily refresh failed',e)}
    },Math.max(0,delay||0));
  }
  function pulse(){ refresh(100); refresh(700); refresh(1800); }
  function wrap(name){
    var old=window[name];
    if(typeof old!=='function' || old.__v10514Wrapped) return;
    var fn=async function(){
      try{return await old.apply(this,arguments)}
      finally{pulse()}
    };
    fn.__v10514Wrapped=true;
    window[name]=fn;
  }
  function install(){
    ['supervisorCheckIn','supervisorCheckOut','supervisorExitSelectedWorkers','saveTimeLog'].forEach(wrap);
    window.addEventListener('tasneef:time-log-changed',pulse);
    window.addEventListener('storage',function(e){if(e.key==='tasneef_time_logs_changed')pulse()});
    document.addEventListener('visibilitychange',function(){if(!document.hidden)refresh(100)});
    refresh(150);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(install,500)});
  else setTimeout(install,500);
})();

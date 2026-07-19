/* V10704 - إيقاف اختفاء مشاريع صفحة المشرف فقط */
(function(){
  'use strict';
  if(window.__tasneefSupervisorProjectsLockV10704) return;
  window.__tasneefSupervisorProjectsLockV10704 = true;

  const IDS = [
    'logProject','attendanceProject','ticketProject','supTicketFilterProject',
    'supOrderProjectV10061','supOrderFilterProjectV10061',
    'supInventoryRequestProject','supClientReportProject'
  ];
  const cache = new Map();
  const restoring = new Set();

  function validOptions(select){
    return Array.from(select.options || []).filter(o => String(o.value || '').trim() !== '');
  }
  function snapshot(select){
    const options = validOptions(select);
    if(!options.length) return;
    cache.set(select.id, {
      html: select.innerHTML,
      value: select.value,
      count: options.length
    });
  }
  function restoreIfCleared(select){
    if(!select || restoring.has(select.id)) return;
    const saved = cache.get(select.id);
    const current = validOptions(select);

    if(current.length){
      snapshot(select);
      return;
    }
    if(!saved || !saved.count) return;

    restoring.add(select.id);
    const currentValue = select.value;
    select.innerHTML = saved.html;
    const wanted = currentValue || saved.value;
    if(wanted && Array.from(select.options).some(o => String(o.value) === String(wanted))) {
      select.value = wanted;
    }
    restoring.delete(select.id);
    console.warn('[V10704] تم منع سكربت متأخر من إخفاء مشاريع المشرف:', select.id);
  }
  function bind(select){
    if(!select || select.dataset.projectsLockV10704 === '1') return;
    select.dataset.projectsLockV10704 = '1';
    snapshot(select);
    new MutationObserver(function(){
      queueMicrotask(function(){ restoreIfCleared(select); });
    }).observe(select,{childList:true,subtree:true});
    select.addEventListener('change',function(){ snapshot(select); },true);
  }
  function scan(){
    IDS.forEach(id => bind(document.getElementById(id)));
  }

  document.addEventListener('DOMContentLoaded',function(){
    scan();
    [100,300,700,1200,2500,5000,9000].forEach(ms => setTimeout(function(){
      scan();
      IDS.forEach(id => restoreIfCleared(document.getElementById(id)));
    },ms));
  });

  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
  console.log('V10704 supervisor projects lock loaded');
})();

(function(){
  'use strict';
  if(window.__tasneefSupervisorSourceGuardV66) return;
  window.__tasneefSupervisorSourceGuardV66 = true;

  const S = v => String(v ?? '').trim();
  const badPattern = /__tasneefAttendanceBulkReportV49|targetDays\s*=|groupsHtml|techRows|\$\{esc\(month\)\}|\$\{rows\}|\$\{techRows\}|function\(\)\{\s*['"]use strict['"]/;

  function removeVisibleSource(){
    const shell = document.querySelector('.mobile-shell');
    if(!document.body) return;
    Array.from(document.body.childNodes).forEach(node => {
      if(node === shell) return;
      if(node.nodeType === Node.TEXT_NODE){
        if(badPattern.test(S(node.textContent)) || S(node.textContent).length > 600) node.remove();
        return;
      }
      if(node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName;
      if(['SCRIPT','STYLE','LINK'].includes(tag)) return;
      if(node.classList && (node.classList.contains('modal-backdrop') || node.classList.contains('smart-modal-backdrop'))) return;
      const text = S(node.textContent);
      if(badPattern.test(text) || /\$\{[^}]+\}/.test(text)){
        node.remove();
      }
    });
  }

  function installAttendanceButtons(){
    if(typeof window.tasneefMarkDaysPresentV49 !== 'function' && typeof window.tasneefPrintAttendanceReportV49 !== 'function') return;
    const card = document.querySelector('#supAttendance .card');
    if(!card || document.getElementById('supervisorAttendanceGuardActionsV66')) return;
    const box = document.createElement('div');
    box.id = 'supervisorAttendanceGuardActionsV66';
    box.className = 'actions';
    box.innerHTML = [
      typeof window.tasneefMarkDaysPresentV49 === 'function' ? '<button type="button" class="light" onclick="tasneefMarkDaysPresentV49()">اعتماد حضور أيام 1-2-3-4-6</button>' : '',
      typeof window.tasneefPrintAttendanceReportV49 === 'function' ? '<button type="button" class="light" onclick="tasneefPrintAttendanceReportV49()">طباعة تقرير المشرفين والفنيين</button>' : ''
    ].join('');
    const list = document.getElementById('supervisorAttendanceList');
    if(list) list.insertAdjacentElement('beforebegin', box);
    else card.appendChild(box);
  }

  function tick(){
    removeVisibleSource();
    installAttendanceButtons();
  }

  document.addEventListener('DOMContentLoaded', () => {
    tick();
    setTimeout(tick, 300);
    setTimeout(tick, 900);
    setTimeout(tick, 1800);
  });
  setInterval(tick, 1200);
})();

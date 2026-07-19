/* Tasneef V10519 CANONICAL ONLY: daily logs + tickets. No legacy ticket authority. */
(function(){
  'use strict';
  if(window.__tasneefCanonicalV10519) return;
  window.__tasneefCanonicalV10519=true;
  window.__tasneefFinalV10518=true;
  window.__tasneefTicketsRootV10246=true;
  const $=id=>document.getElementById(id), S=v=>String(v??'').trim(), A=v=>Array.isArray(v)?v:[];
  let logsBusy=false,ticketsBusy=false,lastLogs=[],lastTickets=[];
  function sess(){try{return typeof session==='function'?(session()||{}):{}}catch(_){return{}}}
  function isSup(){return !!$('supLogProject')||S(sess().role)==='supervisor'}
  function todayR(){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}catch(_){return new Date().toISOString().slice(0,10)}}
  function range(){const t=todayR();let f=S($('dailyDateFromV10310')?.value||$('dailyDate')?.value||$('supDailyDateFromV10310')?.value||$('supLogDate')?.value||t),to=S($('dailyDateToV10310')?.value||$('dailyDate')?.value||$('supDailyDateToV10310')?.value||$('supLogDate')?.value||f);if(f>to)[f,to]=[to,f];return{f,to}}
  function esc(v){return S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function supName(id){try{return typeof supervisorName==='function'?supervisorName(id):S(id)}catch(_){return S(id)}}
  function projName(id){try{return typeof projectName==='function'?projectName(id):S(id)}catch(_){return S(id)}}
  function project(id){return A(window.data?.projects).find(x=>S(x.id)===S(id))||{}}
  function logDate(l){return S(l?.log_date||l?.check_in||l?.created_at).slice(0,10)}
  function req(l){const p=project(l.project_id),d=logDate(l);let day=null;try{day=d?new Date(d+'T12:00:00').getDay():null}catch(_){};if(day===5&&Number(p.friday_minutes)>0)return Number(p.friday_minutes);return Number(p.required_daily_minutes||l.required_minutes||0)||0}
  function tm(v){if(!v)return '-';try{return new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Riyadh',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date(v))}catch(_){return S(v)}}
  function mins(a,b){if(!a||!b)return 0;const n=Math.round((new Date(b)-new Date(a))/60000);return isFinite(n)&&n>0?n:0}
  function txt(n){n=Math.max(0,Math.round(Number(n)||0));return Math.floor(n/60)+' س '+(n%60)+' د'}
  function visit(v){return({surface:'نظافة سطحية',deep:'نظافة عميقة',maintenance:'صيانة',inspection:'تفقد'}[S(v)]||S(v)||'-')}
  function status(l){const r=req(l),a=Number(l.duration_minutes)||mins(l.check_in,l.check_out);if(!l.check_out)return{t:'داخل المشروع',c:'open',d:0};const d=a-r;if(!r||Math.abs(d)<=5)return{t:'ضمن الوقت',c:'ok',d};return d>0?{t:'زيادة وقت',c:'over',d}:{t:'نقص وقت',c:'under',d}}
  function filtered(rows){const pid=S($('dailyProject')?.value||$('supLogProject')?.value||''),sid=S($('dailySupervisor')?.value||''),q=S($('dailySearch')?.value).toLowerCase();return A(rows).filter(l=>(!pid||S(l.project_id)===pid)&&(!sid||S(l.supervisor_id)===sid)&&(!q||[supName(l.supervisor_id),projName(l.project_id),visit(l.visit_type),l.notes].join(' ').toLowerCase().includes(q)))}
  function renderLogs(rows){const b=$('logsBody');if(!b)return;rows=filtered(rows);if(!rows.length){b.innerHTML=`<tr><td colspan="${isSup()?8:14}">لا توجد تسجيلات في الفترة المحددة</td></tr>`;return}if(isSup())b.innerHTML=rows.map(l=>{const st=status(l),r=req(l),a=Number(l.duration_minutes)||mins(l.check_in,l.check_out);return `<tr><td>${esc(projName(l.project_id))}</td><td>${esc(visit(l.visit_type))}</td><td>${esc(tm(l.check_in))}</td><td>${esc(tm(l.check_out))}</td><td>${esc(txt(r))}</td><td>${esc(txt(a))}</td><td><span class="daily-status-v10508 ${st.c}">${esc(st.t)}</span></td><td><button class="light" onclick="sendLogWhatsapp&&sendLogWhatsapp(${Number(l.id)||0},'${l.check_out?'out':'in'}')">واتساب</button></td></tr>`}).join('');else b.innerHTML=rows.map(l=>{const st=status(l),r=req(l),a=Number(l.duration_minutes)||mins(l.check_in,l.check_out);return `<tr><td>${esc(logDate(l))}</td><td>${esc(supName(l.supervisor_id))}</td><td>${esc(projName(l.project_id))}</td><td>${esc(visit(l.visit_type))}</td><td>${esc(tm(l.check_in))}</td><td>${esc(tm(l.check_out))}</td><td>${esc(txt(r))}</td><td>${esc(txt(a))}</td><td>${esc((st.d>=0?'+':'')+st.d+' د')}</td><td><span class="daily-status-v10508 ${st.c}">${esc(st.t)}</span></td><td>${esc(l.travel_minutes||0)}</td><td>${esc(l.notes||'')}</td><td><button class="light" onclick="sendLogWhatsapp&&sendLogWhatsapp(${Number(l.id)||0},'${l.check_out?'out':'in'}')">واتساب</button></td><td><button onclick="editTimeLog(${Number(l.id)||0})">تعديل</button><button class="danger" onclick="deleteRow('time_logs',${Number(l.id)||0})">حذف</button></td></tr>`}).join('')}
  async function loadLogs(){if(!window.sb||logsBusy)return lastLogs;logsBusy=true;try{const r=range(),u=sess();let x=await sb.rpc('tasneef_daily_logs_visible_v10519',{p_from:r.f,p_to:r.to,p_supervisor_id:isSup()?Number(u.id)||null:null});if(x.error)throw x.error;lastLogs=A(x.data);window.data=window.data||{};data.logs=lastLogs;renderLogs(lastLogs);return lastLogs}catch(e){console.error('V10519 logs',e);renderLogs(lastLogs);return lastLogs}finally{logsBusy=false}}
  async function loadTickets(){if(!window.sb||ticketsBusy)return lastTickets;ticketsBusy=true;try{const x=await sb.rpc('tasneef_tickets_all_v10519');if(x.error)throw x.error;lastTickets=A(x.data);window.data=window.data||{};data.tickets=lastTickets;try{if(typeof window.renderTickets==='function')window.renderTickets()}catch(e){console.warn('V10519 render tickets',e)}return lastTickets}catch(e){console.error('V10519 tickets',e);return lastTickets}finally{ticketsBusy=false}}
  window.renderTimeLogs=loadLogs;window.tasneefRefreshDailyV10519=loadLogs;window.tasneefRefreshTicketsV10519=loadTickets;
  const oldRefresh=window.refreshAll;if(typeof oldRefresh==='function')window.refreshAll=async function(){const z=await oldRefresh.apply(this,arguments);await loadTickets();return z};
  const oldShow=window.showPage;if(typeof oldShow==='function')window.showPage=function(id){const z=oldShow.apply(this,arguments);if(id==='tickets')setTimeout(loadTickets,50);return z};
  function bind(){['dailyDateFromV10310','dailyDateToV10310','dailyDate','supDailyDateFromV10310','supDailyDateToV10310','supLogDate','dailySupervisor','dailyProject','supLogProject'].forEach(id=>{const e=$(id);if(e&&!e.dataset.canonical10519){e.dataset.canonical10519='1';e.addEventListener('change',loadLogs)}});const q=$('dailySearch');if(q&&!q.dataset.canonical10519){q.dataset.canonical10519='1';q.addEventListener('input',()=>renderLogs(lastLogs))}loadLogs();if($('ticketsBody')||$('supTicketsBody'))loadTickets()}
  window.addEventListener('storage',e=>{if(e.key==='tasneef_client_ticket_changed_v10519')loadTickets()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){loadLogs();if($('ticketsBody')||$('supTicketsBody'))loadTickets()}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,800));else setTimeout(bind,800);
  setInterval(()=>{if(document.hidden)return;const active=document.querySelector('.page:not(.hidden)');if(active&&['dailyLogs','tickets','supervisorDaily'].includes(active.id)){if($('logsBody'))loadLogs();if($('ticketsBody')||$('supTicketsBody'))loadTickets();}},30000);
})();

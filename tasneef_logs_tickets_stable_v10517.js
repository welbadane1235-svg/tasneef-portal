/* Tasneef V10517 - stable daily records + client tickets live visibility */
(function(){
  'use strict';
  if(window.__tasneefStableLogsTicketsV10517) return;
  window.__tasneefStableLogsTicketsV10517=true;
  const $=id=>document.getElementById(id), S=v=>String(v??'').trim(), A=v=>Array.isArray(v)?v:[];
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  let logBusy=false, ticketBusy=false, lastLogRows=[], lastTicketRows=[], logSeq=0;
  function sess(){try{return typeof session==='function'?(session()||{}):{}}catch(_){return{}}}
  function isSup(){return !!$('supLogProject') || S(sess().role)==='supervisor'}
  function riyadhDate(){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}catch(_){return new Date().toISOString().slice(0,10)}}
  function range(){const t=riyadhDate();let f=S($('dailyDateFromV10310')?.value||$('dailyDate')?.value||$('supDailyDateFromV10310')?.value||$('supLogDate')?.value||t);let to=S($('dailyDateToV10310')?.value||$('dailyDate')?.value||$('supDailyDateToV10310')?.value||$('supLogDate')?.value||f);if(f>to)[f,to]=[to,f];return{f,to}}
  function esc(v){return S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function supName(id){try{return typeof supervisorName==='function'?supervisorName(id):S(id)}catch(_){return S(id)}}
  function projName(id){try{return typeof projectName==='function'?projectName(id):S(id)}catch(_){return S(id)}}
  function visit(v){return({surface:'نظافة سطحية',deep:'نظافة عميقة',maintenance:'صيانة',inspection:'تفقد'}[S(v)]||S(v)||'-')}
  function tm(v){if(!v)return '-';try{return new Date(v).toLocaleTimeString('ar-SA',{hour:'numeric',minute:'2-digit',hour12:true,timeZone:'Asia/Riyadh'})}catch(_){return S(v)}}
  function mins(a,b){if(!a||!b)return 0;const n=Math.round((new Date(b)-new Date(a))/60000);return isFinite(n)&&n>0?n:0}
  function minTxt(n){n=Math.max(0,Math.round(Number(n)||0));return Math.floor(n/60)+' س '+(n%60)+' د'}
  function stat(l){const req=Number(l.required_minutes)||0,act=Number(l.duration_minutes)||mins(l.check_in,l.check_out);if(!l.check_out)return{t:'داخل المشروع',c:'open',d:0};const d=act-req;if(!req||Math.abs(d)<=5)return{t:'ضمن الوقت',c:'ok',d};return d>0?{t:'زيادة وقت',c:'over',d}:{t:'نقص وقت',c:'under',d}}
  function filterLocal(rows){const pid=S($('dailyProject')?.value||$('supLogProject')?.value||''),q=S($('dailySearch')?.value).toLowerCase();return A(rows).filter(l=>(!pid||S(l.project_id)===pid)&&(!q||[supName(l.supervisor_id),projName(l.project_id),visit(l.visit_type),l.notes].join(' ').toLowerCase().includes(q)))}
  function renderLogs(rows){
    const body=$('logsBody');if(!body)return; rows=filterLocal(rows);
    if(!rows.length){body.innerHTML=`<tr><td colspan="${isSup()?8:14}">لا توجد تسجيلات في الفترة المحددة</td></tr>`;return}
    if(isSup()) body.innerHTML=rows.map(l=>{const s=stat(l),req=Number(l.required_minutes)||0,act=Number(l.duration_minutes)||mins(l.check_in,l.check_out);return `<tr><td>${esc(projName(l.project_id))}</td><td>${esc(visit(l.visit_type))}</td><td>${esc(tm(l.check_in))}</td><td>${esc(tm(l.check_out))}</td><td>${esc(minTxt(req))}</td><td>${esc(minTxt(act))}</td><td><span class="daily-status-v10508 ${s.c}">${esc(s.t)}</span></td><td><button class="light" onclick="sendLogWhatsapp&&sendLogWhatsapp(${Number(l.id)||0},'${l.check_out?'out':'in'}')">واتساب</button></td></tr>`}).join('');
    else body.innerHTML=rows.map(l=>{const s=stat(l),req=Number(l.required_minutes)||0,act=Number(l.duration_minutes)||mins(l.check_in,l.check_out);return `<tr><td>${esc(S(l.log_date)||(S(l.check_in).slice(0,10)))}</td><td>${esc(supName(l.supervisor_id))}</td><td>${esc(projName(l.project_id))}</td><td>${esc(visit(l.visit_type))}</td><td>${esc(tm(l.check_in))}</td><td>${esc(tm(l.check_out))}</td><td>${esc(minTxt(req))}</td><td>${esc(minTxt(act))}</td><td>${esc((s.d>=0?'+':'')+s.d+' د')}</td><td><span class="daily-status-v10508 ${s.c}">${esc(s.t)}</span></td><td>${esc(l.travel_minutes||0)}</td><td>${esc(l.notes||'')}</td><td><button class="light" onclick="sendLogWhatsapp&&sendLogWhatsapp(${Number(l.id)||0},'${l.check_out?'out':'in'}')">واتساب</button></td><td><button onclick="editTimeLog(${Number(l.id)||0})">تعديل</button><button class="danger" onclick="deleteRow('time_logs',${Number(l.id)||0})">حذف</button></td></tr>`}).join('');
  }
  async function fetchLogs(){
    if(!window.sb||logBusy)return lastLogRows;logBusy=true;const seq=++logSeq,r=range(),u=sess();
    try{
      let res=await sb.rpc('tasneef_daily_logs_visible_v10516',{p_from:r.f,p_to:r.to,p_supervisor_id:isSup()?Number(u.id)||null:null});
      if(res.error){
        let q=sb.from('time_logs').select('*').gte('log_date',r.f).lte('log_date',r.to).order('check_in',{ascending:false}).limit(3000);
        if(isSup())q=q.or(`supervisor_id.eq.${Number(u.id)||0},user_id.eq.${Number(u.id)||0}`);
        res=await q;
      }
      if(res.error)throw res.error;if(seq!==logSeq)return lastLogRows;
      lastLogRows=A(res.data);window.data=window.data||{};window.data.logs=lastLogRows;try{data.logs=lastLogRows}catch(_){}
      renderLogs(lastLogRows);return lastLogRows;
    }catch(e){console.error('V10517 logs',e);if(lastLogRows.length)renderLogs(lastLogRows);else{const b=$('logsBody');if(b)b.innerHTML=`<tr><td colspan="${isSup()?8:14}">تعذر تحميل التسجيلات: ${esc(e.message||e)}</td></tr>`}return lastLogRows}
    finally{logBusy=false}
  }
  window.renderTimeLogs=fetchLogs;window.tasneefRefreshDailyV10517=fetchLogs;

  async function fetchTickets(force){
    if(!window.sb||ticketBusy)return lastTicketRows;ticketBusy=true;
    try{
      let res=await sb.rpc('tasneef_admin_tickets_visible_v10517');
      if(res.error)res=await sb.from('tickets').select('*').order('created_at',{ascending:false}).limit(3000);
      if(res.error)throw res.error;
      lastTicketRows=A(res.data);window.data=window.data||{};window.data.tickets=lastTicketRows;try{data.tickets=lastTicketRows}catch(_){}
      return lastTicketRows;
    }catch(e){console.error('V10517 tickets',e);return lastTicketRows.length?lastTicketRows:A(window.data?.tickets)}finally{ticketBusy=false}
  }
  async function refreshTickets(){
    await fetchTickets(true);
    try{if(typeof window.renderTickets==='function')window.renderTickets()}catch(e){console.warn('ticket render',e)}
    try{if(typeof window.renderTicketsRootV10246==='function')window.renderTicketsRootV10246()}catch(_){}
  }
  window.tasneefRefreshClientTicketsV10517=refreshTickets;
  const oldShow=window.showPage;if(typeof oldShow==='function')window.showPage=function(id){const r=oldShow.apply(this,arguments);if(id==='tickets')setTimeout(refreshTickets,50);return r};
  function bind(){
    ['dailyDateFromV10310','dailyDateToV10310','dailyDate','supDailyDateFromV10310','supDailyDateToV10310','supLogDate','dailySupervisor','dailyProject','supLogProject'].forEach(id=>{const el=$(id);if(el&&!el.dataset.v10517){el.dataset.v10517='1';el.addEventListener('change',fetchLogs)}});
    const q=$('dailySearch');if(q&&!q.dataset.v10517){q.dataset.v10517='1';q.addEventListener('input',()=>renderLogs(lastLogRows))}
    fetchLogs();
    if($('ticketsBody'))refreshTickets();
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){fetchLogs();if($('ticketsBody')&&!$('tickets')?.classList.contains('hidden'))refreshTickets()}});
  window.addEventListener('storage',e=>{if(e.key==='tasneef_client_ticket_changed_v10517')refreshTickets()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,900));else setTimeout(bind,900);
  setInterval(()=>{if($('logsBody'))fetchLogs();if($('ticketsBody')&&!$('tickets')?.classList.contains('hidden'))refreshTickets()},15000);
})();

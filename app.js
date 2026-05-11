// Tasneef HTML App V86 - Contract Services Cloud View Fix
const SUPABASE_URL = "https://zmjdqiswytxlbfgnfjfv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const today = () => new Date().toISOString().slice(0,10);
const nowTime = () => new Date().toTimeString().slice(0,5);
const session = () => JSON.parse(localStorage.getItem('tasneef_user') || 'null');
const setSession = u => localStorage.setItem('tasneef_user', JSON.stringify(u));
const clearSession = () => localStorage.removeItem('tasneef_user');
const fmt = d => d ? new Date(d).toLocaleString('ar-SA') : '-';
const timeOnly = d => d ? new Date(d).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}) : '-';
const minsToText = m => { m=Number(m||0); const h=Math.floor(m/60), mm=m%60; return `${h}:${String(mm).padStart(2,'0')}`; };
function num(v){ const n = Number(String(v ?? 0).replace(/,/g,'').trim()); return Number.isFinite(n) ? n : 0; }
function money(v){ return `${num(v).toLocaleString('ar-SA', {minimumFractionDigits:2, maximumFractionDigits:2})} ر.س`; }
window.num = num;
window.money = money;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let data = { users:[], supervisors:[], projects:[], workers:[], attendance:[], logs:[], tickets:[], contractServices:[], financeContracts:[], financeInvoices:[], financeReceipts:[], financeExpenses:[], inventoryItems:[], inventoryMovements:[], inventoryRequests:[] };
function msg(text, type='ok'){ const el=$('globalMsg')||$('loginMsg'); if(!el) return; el.className='msg '+(type==='err'?'err':''); el.textContent=text; el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'),4000); }
function playAppSound(type){ try{ const files={checkin:'sounds/checkin.wav', checkout:'sounds/checkout.wav', ticket:'sounds/ticket.wav'}; const src=files[type]; if(!src) return; const a=new Audio(src); a.volume=0.75; a.play().catch(()=>{}); }catch(e){} }
function roleHomeUrl(role){ return ['admin','general_manager','financial_manager','operations_manager','warehouse_manager'].includes(role) ? 'admin.html' : (role==='technician' ? 'technician.html' : 'supervisor.html'); }
function isAdminAreaRole(role){ return ['admin','general_manager','financial_manager','operations_manager','warehouse_manager'].includes(role); }
function requireRole(role){ const u=session(); if(!u){ location.href='index.html'; return null; } if(role==='admin' && isAdminAreaRole(u.role)) return u; if(role && u.role!==role){ location.href = roleHomeUrl(u.role); return null; } return u; }
async function login(){
  const username=$('loginUsername').value.trim(), password=$('loginPassword').value.trim();
  if(!username||!password) return msg('أدخل اسم المستخدم وكلمة المرور','err');
  if(username==='admin' && password==='123456'){
    setSession({id:1,full_name:'مدير النظام',username:'admin',role:'admin',is_active:true});
    location.href='admin.html'; return;
  }
  const {data:u,error}=await sb.from('app_users').select('*').eq('username',username).eq('password',password).eq('is_active',true).maybeSingle();
  if(error||!u) return msg(error?.message || 'بيانات الدخول غير صحيحة','err');
  setSession(u); location.href = roleHomeUrl(u.role);
}
function logout(){ clearSession(); location.href='index.html'; }
async function loadAll(){
  const [users, projects, workers, attendance, logs, tickets] = await Promise.all([
    sb.from('app_users').select('*').order('id'),
    sb.from('projects').select('*').order('id'),
    sb.from('workers').select('*').order('id'),
    sb.from('attendance').select('*').order('attendance_date',{ascending:false}),
    sb.from('time_logs').select('*').order('check_in',{ascending:false}),
    sb.from('tickets').select('*').order('created_at',{ascending:false})
  ]);

  let contractServices = await sb.from('contract_services').select('*').order('id', { ascending: false });

  for(const r of [users,projects,workers,attendance,logs,tickets,contractServices]) if(r.error) console.warn(r.error.message);
  data.users = users.data || [];
  data.supervisors = data.users.filter(u=>u.role==='supervisor' && u.is_active!==false);
  data.technicians = data.users.filter(u=>u.role==='technician' && u.is_active!==false);
  data.projects = projects.data || [];
  data.workers = workers.data || [];
  data.attendance = attendance.data || [];
  data.logs = logs.data || [];
  data.tickets = tickets.data || [];
  data.contractServices = contractServices.data || [];
  data.contractServicesError = contractServices.error ? contractServices.error.message : '';
}
function fillSelect(id, rows, label='name', allLabel=null, value='id'){ const el=$(id); if(!el) return; el.innerHTML = (allLabel!==null?`<option value="">${allLabel}</option>`:'') + rows.map(r=>`<option value="${r[value]}">${esc(r[label]||r.full_name||r.username)}</option>`).join(''); }
function userRoleLabel(role){ return ({admin:'مدير عام',general_manager:'مدير عام',financial_manager:'مدير مالي',operations_manager:'مدير تشغيلي',warehouse_manager:'مدير مخازن',technician:'فني',supervisor:'مشرف'}[role] || role || '-'); }
function approvalRoleForUser(){ const u=session()||{}; return u.role==='general_manager' ? 'general' : (u.role==='admin' ? 'general' : (u.role==='financial_manager' ? 'finance' : (u.role==='operations_manager' ? 'ops' : (u.role==='warehouse_manager' ? 'warehouse' : '')))); }
function supervisorName(id){ return data.users.find(u=>String(u.id)===String(id))?.full_name || data.supervisors.find(u=>String(u.id)===String(id))?.full_name || '-'; }
function projectName(id){ return data.projects.find(p=>String(p.id)===String(id))?.name || '-'; }
function workerName(id){ return data.workers.find(w=>String(w.id)===String(id))?.name || '-'; }
function getProjectSupervisorId(pid){ return data.projects.find(p=>String(p.id)===String(pid))?.supervisor_id || ''; }
function dateTime(date, time){ return date && time ? new Date(`${date}T${time}:00`).toISOString() : null; }
function minutesBetween(a,b){ if(!a||!b) return 0; return Math.max(0, Math.round((new Date(b)-new Date(a))/60000)); }
function logActualMinutes(l){ const saved = Number(l.duration_minutes); if(Number.isFinite(saved) && saved > 0) return saved; return minutesBetween(l.check_in, l.check_out); }
function logRequiredMinutes(l){ const logDate = l.log_date || String(l.check_in||'').slice(0,10); const current = l.project_id ? requiredMinutesForLog(l.project_id, logDate) : 0; if(current > 0) return current; const saved = Number(l.required_minutes); if(Number.isFinite(saved) && saved > 0) return saved; return 0; }
async function initAdmin(){ requireRole('admin'); await refreshAll(); }
async function refreshAll(){ await loadAll(); hydrateForms(); renderAll(); }
function hydrateForms(){
  const sups = data.supervisors; const pros = data.projects; const workers = data.workers;
  ['logSupervisor','dailySupervisor','projectSupervisor','projectFilterSupervisor','projectManageSupervisor','workerSupervisor','workerFilterSupervisor','attendanceSupervisor','attendanceFilterSupervisor','ticketSupervisor','monthlySupervisor'].forEach(id=>fillSelect(id,sups,'full_name','الكل'));
  fillSelect('manageWorkerSelect', workers, 'name', 'اختر العامل');
  ['logProject','dailyProject','attendanceProject','ticketProject','workerProject','workerFilterProject'].forEach(id=>fillSelect(id,pros,'name','الكل'));
  fillSelect('projectSupervisor',sups,'full_name','بدون مشرف'); fillSelect('workerSupervisor',sups,'full_name','بدون مشرف'); fillSelect('attendanceWorker',workers,'name','اختر العامل');
  fillSelect('serviceFilterProject', pros, 'name', 'كل المشاريع');
  fillSelect('serviceFilterSupervisor', sups, 'full_name', 'كل المشرفين');
  hydrateServiceTypes();
  financeHydrateForms();
  if($('logDate')&&!$('logDate').value) $('logDate').value=today(); if($('dailyDate')&&!$('dailyDate').value) $('dailyDate').value=today(); if($('attendanceDate')&&!$('attendanceDate').value) $('attendanceDate').value=today(); if($('attendanceFilterDate')&&!$('attendanceFilterDate').value) $('attendanceFilterDate').value=today(); if($('monthlyMonth')&&!$('monthlyMonth').value) $('monthlyMonth').value=today().slice(0,7);
}
function renderAll(){ renderDashboard(); renderTimeLogs(); renderUsers(); renderProjects(); renderWorkers(); renderAttendance(); renderMonthly(); renderTickets(); renderAlerts(); renderContractServices(); }
function showPage(id, btn){ document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden')); $(id)?.classList.remove('hidden'); document.querySelectorAll('.nav').forEach(n=>n.classList.remove('active')); btn?.classList.add('active'); renderAll(); if(id==='contracts') showContractsSubTab('services'); }
function renderDashboard(){ if(!$('kpiUsers')) return; $('kpiUsers').textContent=data.users.length; $('kpiProjects').textContent=data.projects.length; $('kpiWorkers').textContent=data.workers.length; $('kpiTodayLogs').textContent=data.logs.filter(l=>(l.log_date||String(l.check_in||'').slice(0,10))===today()).length; const div=$('todaySummary'); if(div) div.innerHTML = data.supervisors.map(s=>{ const logs=data.logs.filter(l=>String(l.supervisor_id)===String(s.id)&&(l.log_date||String(l.check_in||'').slice(0,10))===today()); const mins=logs.reduce((a,l)=>a+(l.duration_minutes||minutesBetween(l.check_in,l.check_out)),0); return `<div class="summary-item"><b>${esc(s.full_name)}</b><br>عدد التسجيلات: ${logs.length}<br>إجمالي الوقت: ${minsToText(mins)}</div>`; }).join('') || '<div class="summary-item">لا توجد تسجيلات اليوم</div>'; }
function setNow(id){ $(id).value=nowTime(); }
function clearLogForm(){ ['logId','logIn','logOut','logTravel','logNotes'].forEach(id=>{ if($(id)) $(id).value=id==='logTravel'?'0':''; }); if($('logDate')) $('logDate').value=today(); if($('logVisitType')) $('logVisitType').value='surface'; $('logFormTitle') && ($('logFormTitle').textContent='تسجيل دخول / خروج'); }
function findProject(id){ return data.projects.find(p=>String(p.id)===String(id)); }
function requiredMinutesForLog(projectId, dateStr){ const p=findProject(projectId); if(!p) return 0; return projectRequiredMinutes(p, dateStr); }
function calculateTravelMinutes(supervisorId, dateStr, checkInIso, currentId=null){
  if(!supervisorId || !dateStr || !checkInIso) return 0;
  const checkIn = new Date(checkInIso);
  const previous = data.logs
    .filter(l => String(l.supervisor_id)===String(supervisorId)
      && String(l.id)!==String(currentId||'')
      && (l.log_date || String(l.check_in||'').slice(0,10))===dateStr
      && l.check_out
      && new Date(l.check_out) <= checkIn)
    .sort((a,b)=> new Date(b.check_out) - new Date(a.check_out))[0];
  if(!previous) return 0;
  return Math.max(0, Math.round((checkIn - new Date(previous.check_out))/60000));
}
function monthDays(year, monthIndex){ return new Date(year, monthIndex+1, 0).getDate(); }
function projectRequiredMonthlyMinutes(projectId, monthStr){
  const p=findProject(projectId); if(!p || !monthStr) return 0;
  if((p.operation_type||'')==='as_needed') return 0;
  const parts=monthStr.split('-').map(Number), y=parts[0], m=parts[1];
  let total=0; const days=monthDays(y,m-1);
  for(let d=1; d<=days; d++){
    const ds=y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    total += projectRequiredMinutes(p, ds);
  }
  return total;
}
function performanceStatus(percent, required){
  percent = Number(percent || 0);
  if(!required) return {text:'غير محدد', cls:'amber'};

  // 90% إلى 110% = ممتاز
  // 70% إلى 89% أو 111% إلى 140% = جيد
  // أقل من 70% أو أكثر من 140% = ضعيف
  if(percent >= 90 && percent <= 110) return {text:'ممتاز', cls:'green'};
  if((percent >= 70 && percent < 90) || (percent > 110 && percent <= 140)) return {text:'جيد', cls:'amber'};
  return {text:'ضعيف', cls:'red'};
}
function percentText(v){ return (Math.round(Number(v||0)*10)/10).toFixed(1)+'%'; }
function calcTimeStatus(actualMinutes, requiredMinutes){ const diff = Number(actualMinutes||0) - Number(requiredMinutes||0); if(!requiredMinutes) return {diff, status:'unknown', text:'غير محدد', cls:'amber'}; if(diff > 5) return {diff, status:'over_time', text:'زيادة', cls:'red'}; if(diff < -5) return {diff, status:'under_time', text:'ناقص', cls:'amber'}; return {diff, status:'within_time', text:'ضمن الوقت', cls:'green'}; }
function timeStatusText(s){ return s==='over_time'?'زيادة':(s==='under_time'?'ناقص':(s==='within_time'?'ضمن الوقت':'غير محدد')); }
function timeStatusClass(s){ return s==='over_time'?'red':(s==='under_time'?'amber':(s==='within_time'?'green':'amber')); }
function diffText(m){ m=Number(m||0); return (m>0?'+':'') + m + ' دقيقة'; }
function logDateText(l){ return l.log_date || String(l.check_in || l.created_at || today()).slice(0,10); }
function logWorkersNames(l){
  const pid=String(l.project_id||''), sid=String(l.supervisor_id||'');
  const rows=(data.workers||[]).filter(w =>
    (pid && String(workerProjectId(w)||'')===pid) ||
    (!pid && sid && String(workerSupId(w)||'')===sid)
  ).filter(w => w.status !== 'inactive');
  return rows.map(w=>w.name).filter(Boolean).join('، ') || '-';
}
function buildLogWhatsAppMessage(l, type){
  const isOut = type==='out' || !!l.check_out;
  return [
    isOut ? 'تم تسجيل خروج' : 'تم تسجيل دخول',
    '',
    'اسم المشروع: ' + projectName(l.project_id),
    'نوع التنظيف: ' + visitTypeText(l.visit_type),
    'اسم العمال: ' + logWorkersNames(l),
    'التاريخ: ' + logDateText(l),
    'الوقت: ' + (isOut ? timeOnly(l.check_out) : timeOnly(l.check_in))
  ].join('\n');
}
function copyWhatsappText(text){
  try{ if(navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(()=>{}); }catch(e){}
  try{ const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }catch(e){}
  return Promise.resolve();
}
function openWhatsappText(text){ window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); }
window.sendLogWhatsapp = function(id, type){
  const l=(data.logs||[]).find(x=>String(x.id)===String(id));
  if(!l) return msg('لم يتم العثور على سجل الدخول والخروج','err');
  const msgText=buildLogWhatsAppMessage(l, type || (l.check_out?'out':'in'));
  copyWhatsappText(msgText).finally(()=>{ openWhatsappText(msgText); msg('تم تجهيز رسالة الواتساب'); });
};
function sendLogWhatsappFromRow(row, type){
  if(!row) return;
  const msgText=buildLogWhatsAppMessage(row, type || (row.check_out?'out':'in'));
  copyWhatsappText(msgText).finally(()=>openWhatsappText(msgText));
}
function logWhatsappButtons(l){
  if(l.check_out){ return `<button class="small" style="background:#128C7E;color:#fff" onclick="sendLogWhatsapp(${l.id},'out')">واتساب خروج</button>`; }
  return `<button class="small" style="background:#128C7E;color:#fff" onclick="sendLogWhatsapp(${l.id},'in')">واتساب دخول</button>`;
}
function onLogProjectChange(){ const pid=$('logProject')?.value; const p=findProject(pid); if(p && $('logVisitType')) $('logVisitType').value=p.visit_type_default||'surface'; if(p && $('logSupervisor') && !$('logSupervisor').value) $('logSupervisor').value=p.supervisor_id||''; }
async function saveTimeLog(){ const u=session(); const id=$('logId')?.value; const date=$('logDate')?.value || today(); let sup=$('logSupervisor')?.value || (u.role==='supervisor'?u.id:''); const project=$('logProject')?.value; if(!sup && project) sup=getProjectSupervisorId(project); const check_in=dateTime(date,$('logIn')?.value), check_out=dateTime(date,$('logOut')?.value); if(!project||!check_in) return msg('المشروع ووقت الدخول مطلوبان','err'); const actual=minutesBetween(check_in,check_out); const required=requiredMinutesForLog(project,date); const ts=calcTimeStatus(actual,required); const autoTravel=calculateTravelMinutes(sup,date,check_in,id); const row={user_id:u.id, supervisor_id:Number(sup)||null, project_id:Number(project), check_in, check_out, log_date:date, duration_minutes:actual, travel_minutes:autoTravel, visit_type:$('logVisitType')?.value||findProject(project)?.visit_type_default||'surface', required_minutes:required, time_difference_minutes:ts.diff, time_status:ts.status, notes:$('logNotes')?.value||''}; let res = id ? await sb.from('time_logs').update(row).eq('id',id).select('*').maybeSingle() : await sb.from('time_logs').insert(row).select('*').single(); if(res.error) return msg(res.error.message,'err'); const savedRow = res.data ? res.data : Object.assign({id:Number(id)||0}, row); playAppSound(check_out ? 'checkout' : 'checkin'); msg('تم حفظ التسجيل وحساب حالة الوقت ووقت التنقل تلقائياً'); sendLogWhatsappFromRow(savedRow, check_out ? 'out' : 'in'); clearLogForm(); await refreshAll(); }
function filterLogs(){ let rows=[...data.logs]; const d=$('dailyDate')?.value, s=$('dailySupervisor')?.value, p=$('dailyProject')?.value, q=($('dailySearch')?.value||'').trim(); if(d) rows=rows.filter(l=>(l.log_date||String(l.check_in||'').slice(0,10))===d); if(s) rows=rows.filter(l=>String(l.supervisor_id)===String(s)); if(p) rows=rows.filter(l=>String(l.project_id)===String(p)); if(q) rows=rows.filter(l=>[supervisorName(l.supervisor_id),projectName(l.project_id),visitTypeText(l.visit_type),timeStatusText(l.time_status),l.notes].join(' ').includes(q)); return rows; }
function renderTimeLogs(){ const body=$('logsBody'); if(!body) return; const isSupervisorPage = !document.getElementById('daily'); const rows=filterLogs(); body.innerHTML = rows.map(l=>{ const logDate=l.log_date||String(l.check_in||'').slice(0,10); const actual=Number(l.duration_minutes||minutesBetween(l.check_in,l.check_out)); const required=logRequiredMinutes(l); const diff=(l.time_difference_minutes!==null&&l.time_difference_minutes!==undefined)?Number(l.time_difference_minutes):(actual-required); const status=l.time_status||calcTimeStatus(actual,required).status; const badge=`<span class="badge ${timeStatusClass(status)}">${timeStatusText(status)}</span>`; if(isSupervisorPage){ return `<tr><td>${esc(projectName(l.project_id))}</td><td>${visitTypeText(l.visit_type)}</td><td>${timeOnly(l.check_in)}</td><td>${timeOnly(l.check_out)}</td><td>${minsToText(required)}</td><td>${minsToText(actual)}</td><td>${badge}</td><td class="row-actions">${logWhatsappButtons(l)}</td></tr>`; } return `<tr><td>${esc(logDate)}</td><td>${esc(supervisorName(l.supervisor_id))}</td><td>${esc(projectName(l.project_id))}</td><td>${visitTypeText(l.visit_type)}</td><td>${timeOnly(l.check_in)}</td><td>${timeOnly(l.check_out)}</td><td>${minsToText(required)}</td><td>${minsToText(actual)}</td><td>${diffText(diff)}</td><td>${badge}</td><td>${l.travel_minutes||0}</td><td>${esc(l.notes)}</td><td class="row-actions">${logWhatsappButtons(l)}</td><td class="row-actions"><button onclick="editTimeLog(${l.id})">تعديل</button><button class="danger" onclick="deleteRow('time_logs',${l.id})">حذف</button></td></tr>`; }).join('') || (isSupervisorPage?'<tr><td colspan="8">لا توجد بيانات</td></tr>':'<tr><td colspan="14">لا توجد بيانات</td></tr>'); }
function editTimeLog(id){ const l=data.logs.find(x=>x.id===id); if(!l) return; $('logId').value=l.id; $('logDate').value=l.log_date||String(l.check_in||'').slice(0,10); if($('logSupervisor')) $('logSupervisor').value=l.supervisor_id||''; $('logProject').value=l.project_id||''; if($('logVisitType')) $('logVisitType').value=l.visit_type||findProject(l.project_id)?.visit_type_default||'surface'; $('logIn').value=l.check_in?new Date(l.check_in).toTimeString().slice(0,5):''; $('logOut').value=l.check_out?new Date(l.check_out).toTimeString().slice(0,5):''; $('logTravel').value=l.travel_minutes||0; $('logNotes').value=l.notes||''; $('logFormTitle') && ($('logFormTitle').textContent='تعديل تسجيل'); window.scrollTo({top:0,behavior:'smooth'}); }
async function deleteRow(table,id){ if(!confirm('تأكيد الحذف؟')) return; const {error}=await sb.from(table).delete().eq('id',id); if(error) return msg(error.message,'err'); msg('تم الحذف'); await refreshAll(); }
function clearUserForm(){ ['userId','userFullName','userUsername','userPassword'].forEach(id=>$(id)&&($(id).value='')); if($('userRole')) $('userRole').value='supervisor'; if($('userActive')) $('userActive').value='true'; $('userFormTitle')&&($('userFormTitle').textContent='إضافة مستخدم'); }
async function saveUser(){ const id=$('userId').value; const row={full_name:$('userFullName').value.trim(), username:$('userUsername').value.trim(), password:$('userPassword').value.trim()||'123456', role:$('userRole').value, is_active:$('userActive').value==='true'}; if(!row.full_name||!row.username) return msg('الاسم واسم المستخدم مطلوبان','err'); const res=id?await sb.from('app_users').update(row).eq('id',id):await sb.from('app_users').insert(row); if(res.error) return msg(res.error.message,'err'); msg('تم حفظ المستخدم'); clearUserForm(); await refreshAll(); }
function renderUsers(){ const b=$('usersBody'); if(!b) return; b.innerHTML=data.users.map(u=>`<tr><td>${esc(u.full_name)}</td><td>${esc(u.username)}</td><td><span class="badge">${esc(userRoleLabel(u.role))}</span></td><td><span class="badge ${u.is_active?'green':'red'}">${u.is_active?'نشط':'موقوف'}</span></td><td class="row-actions"><button onclick="editUser(${u.id})">تعديل</button><button class="danger" onclick="deleteRow('app_users',${u.id})">حذف</button></td></tr>`).join(''); }
function editUser(id){ const u=data.users.find(x=>x.id===id); if(!u)return; $('userId').value=u.id; $('userFullName').value=u.full_name||''; $('userUsername').value=u.username||''; $('userPassword').value=u.password||''; $('userRole').value=u.role; $('userActive').value=String(u.is_active!==false); $('userFormTitle').textContent='تعديل مستخدم'; }
function projectOperationText(t){ return t==='full_time'?'دوام كامل':(t==='as_needed'?'حسب الحاجة':'زيارة يومية'); }
function visitTypeText(t){ return t==='deep'?'نظافة عميقة':'نظافة سطحية'; }
function projectRequiredMinutes(p, dateStr){ const day=dateStr?new Date(dateStr+'T00:00:00').getDay():null; return day===5?Number(p.friday_minutes??90):Number(p.required_daily_minutes??180); }
function clearProjectForm(){ ['projectId','projectName','projectLocation','projectNotes'].forEach(id=>$(id)&&($(id).value='')); if($('projectSupervisor')) $('projectSupervisor').value=''; if($('projectStatus')) $('projectStatus').value='active'; if($('projectRequiredDaily')) $('projectRequiredDaily').value=180; if($('projectFridayMinutes')) $('projectFridayMinutes').value=90; if($('projectOperationType')) $('projectOperationType').value='daily_visit'; if($('projectVisitDefault')) $('projectVisitDefault').value='surface'; $('projectFormTitle')&&($('projectFormTitle').textContent='إضافة مشروع'); $('projectSaveBtn')&&($('projectSaveBtn').textContent='حفظ المشروع'); }
async function saveProject(){ const id=$('projectId').value; const row={name:$('projectName').value.trim(), location:$('projectLocation').value.trim(), supervisor_id:Number($('projectSupervisor').value)||null, required_daily_minutes:Number($('projectRequiredDaily')?.value||180), friday_minutes:Number($('projectFridayMinutes')?.value||90), operation_type:$('projectOperationType')?.value||'daily_visit', visit_type_default:$('projectVisitDefault')?.value||'surface', status:$('projectStatus').value, notes:$('projectNotes').value}; if(!row.name) return msg('اسم المشروع مطلوب','err'); const res=id?await sb.from('projects').update(row).eq('id',id):await sb.from('projects').insert(row); if(res.error) return msg(res.error.message,'err'); msg(id?'تم تحديث المشروع':'تم حفظ المشروع'); clearProjectForm(); await refreshAll(); }
function renderProjects(){ const b=$('projectsBody'); if(!b) return; const q=($('projectSearch')?.value||'').trim(), sid=$('projectFilterSupervisor')?.value, st=$('projectFilterStatus')?.value; let rows=data.projects; if(q) rows=rows.filter(p=>[p.name,p.location,supervisorName(p.supervisor_id),p.notes].join(' ').includes(q)); if(sid) rows=rows.filter(p=>String(p.supervisor_id)===String(sid)); if(st) rows=rows.filter(p=>(p.status||'active')===st); b.innerHTML=rows.map(p=>`<tr><td><b>${esc(p.name)}</b><br><small>${esc(p.location||'')}</small></td><td>${esc(supervisorName(p.supervisor_id))}</td><td>${minsToText(p.required_daily_minutes??180)}</td><td>${minsToText(p.friday_minutes??90)}</td><td>${projectOperationText(p.operation_type)}</td><td>${visitTypeText(p.visit_type_default)}</td><td><span class="badge ${p.status==='inactive'?'red':'green'}">${p.status==='inactive'?'متوقف':'نشط'}</span></td><td class="row-actions"><button onclick="editProject(${p.id})">تعديل</button><button class="light" onclick="openProjectManager(${p.id})">إدارة المشروع</button><button class="light" onclick="toggleProjectStatus(${p.id})">${p.status==='inactive'?'تفعيل':'إيقاف'}</button><button class="danger" onclick="deleteRow('projects',${p.id})">حذف</button></td></tr>`).join('')||'<tr><td colspan="8">لا توجد بيانات</td></tr>'; renderProjectManager(); }
function editProject(id){ const p=data.projects.find(x=>x.id===id); if(!p)return; $('projectId').value=p.id; $('projectName').value=p.name||''; $('projectLocation').value=p.location||''; $('projectSupervisor').value=p.supervisor_id||''; $('projectStatus').value=p.status||'active'; $('projectNotes').value=p.notes||''; if($('projectRequiredDaily')) $('projectRequiredDaily').value=p.required_daily_minutes??180; if($('projectFridayMinutes')) $('projectFridayMinutes').value=p.friday_minutes??90; if($('projectOperationType')) $('projectOperationType').value=p.operation_type||'daily_visit'; if($('projectVisitDefault')) $('projectVisitDefault').value=p.visit_type_default||'surface'; $('projectFormTitle').textContent='تعديل مشروع'; $('projectSaveBtn')&&($('projectSaveBtn').textContent='تحديث المشروع'); }
async function toggleProjectStatus(id){ const p=data.projects.find(x=>x.id===id); if(!p)return; const next=p.status==='inactive'?'active':'inactive'; const {error}=await sb.from('projects').update({status:next}).eq('id',id); if(error) return msg(error.message,'err'); msg(next==='active'?'تم تفعيل المشروع':'تم إيقاف المشروع'); await refreshAll(); }
function openProjectManager(id){ const p=data.projects.find(x=>x.id===id); if(!p)return; $('manageProjectId').value=id; $('projectManagerCard')?.classList.remove('hidden'); $('projectManagerTitle').textContent=`إدارة المشروع: ${p.name}`; if($('projectManageSupervisor')) $('projectManageSupervisor').value=p.supervisor_id||''; renderProjectManager(); setTimeout(()=>$('projectManagerCard')?.scrollIntoView({behavior:'smooth',block:'start'}),50); }
function closeProjectManager(){ $('projectManagerCard')?.classList.add('hidden'); if($('manageProjectId')) $('manageProjectId').value=''; }
function renderProjectManager(){ const b=$('projectWorkersBody'); if(!b) return; const pid=$('manageProjectId')?.value; if(!pid){ b.innerHTML='<tr><td colspan="5">اختر مشروع من زر إدارة المشروع</td></tr>'; return; } const rows=data.workers.filter(w=>String(workerProjectId(w))===String(pid)); b.innerHTML=rows.map(w=>`<tr><td>${esc(w.name)}</td><td>${esc(supervisorName(workerSupId(w)))}</td><td><span class="badge ${w.worker_type==='support'?'amber':'green'}">${workerTypeText(w.worker_type)}</span></td><td><span class="badge ${w.status==='inactive'?'red':'green'}">${w.status==='inactive'?'موقوف':'نشط'}</span></td><td class="row-actions"><button class="danger" onclick="removeWorkerFromProject(${w.id})">إزالة من المشروع</button></td></tr>`).join('')||'<tr><td colspan="5">لا يوجد عمال مرتبطون بهذا المشروع</td></tr>'; }
async function saveProjectManagerSupervisor(){ const pid=Number($('manageProjectId')?.value), sid=Number($('projectManageSupervisor')?.value)||null; if(!pid) return msg('اختر المشروع أولاً','err'); const {error}=await sb.from('projects').update({supervisor_id:sid}).eq('id',pid); if(error) return msg(error.message,'err'); await sb.from('workers').update({supervisor_id:sid, app_supervisor_id:sid}).eq('project_id',pid); msg('تم ربط المشرف بالمشروع وتحديث عمال المشروع'); await refreshAll(); openProjectManager(pid); }
async function addExistingWorkerToProject(){ const pid=Number($('manageProjectId')?.value), wid=Number($('manageWorkerSelect')?.value), type=$('manageWorkerType')?.value||'primary'; if(!pid||!wid) return msg('اختر المشروع والعامل','err'); const p=data.projects.find(x=>x.id===pid); const sid=p?.supervisor_id||null; const {error}=await sb.from('workers').update({project_id:pid, supervisor_id:sid, app_supervisor_id:sid, worker_type:type}).eq('id',wid); if(error) return msg(error.message,'err'); msg('تم ربط العامل بالمشروع'); await refreshAll(); openProjectManager(pid); }
async function removeWorkerFromProject(wid){ if(!confirm('إزالة العامل من هذا المشروع؟')) return; const pid=Number($('manageProjectId')?.value); const {error}=await sb.from('workers').update({project_id:null}).eq('id',wid); if(error) return msg(error.message,'err'); msg('تمت إزالة العامل من المشروع'); await refreshAll(); if(pid) openProjectManager(pid); }
async function addWorkerInsideProject(){ const pid=Number($('manageProjectId')?.value); if(!pid) return msg('اختر المشروع أولاً','err'); const name=$('manageNewWorkerName')?.value.trim(); if(!name) return msg('اسم العامل مطلوب','err'); const p=data.projects.find(x=>x.id===pid); const sid=p?.supervisor_id||null; const row={name, phone:$('manageNewWorkerPhone')?.value.trim()||'', salary:Number($('manageNewWorkerSalary')?.value||1500), supervisor_id:sid, app_supervisor_id:sid, project_id:pid, worker_type:$('manageNewWorkerType')?.value||'primary', status:'active'}; const {error}=await sb.from('workers').insert(row); if(error) return msg(error.message,'err'); ['manageNewWorkerName','manageNewWorkerPhone'].forEach(id=>$(id)&&($(id).value='')); if($('manageNewWorkerSalary')) $('manageNewWorkerSalary').value=1500; msg('تم إضافة العامل وربطه بالمشروع'); await refreshAll(); openProjectManager(pid); }
function clearWorkerForm(){
  ['workerId','workerName','workerPhone','workerNotes'].forEach(id=>$(id)&&($(id).value=''));
  if($('workerSalary')) $('workerSalary').value=1500;
  if($('workerSupervisor')) $('workerSupervisor').value='';
  if($('workerProject')) $('workerProject').value='';
  if($('workerType')) $('workerType').value='primary';
  if($('workerStatus')) $('workerStatus').value='active';
  $('workerFormTitle')&&($('workerFormTitle').textContent='إضافة عامل');
  $('workerSaveBtn')&&($('workerSaveBtn').textContent='حفظ العامل');
  $('workerCancelBtn')&&$('workerCancelBtn').classList.add('hidden');
}
function workerSupId(w){ return w.app_supervisor_id || w.supervisor_id; }
function workerProjectId(w){ return w.project_id || w.assigned_project_id || ''; }
function workerTypeText(t){ return t==='support' ? 'بديل / مساند' : 'أساسي'; }
function onWorkerSupervisorChange(){
  const sid=$('workerSupervisor')?.value;
  const el=$('workerProject');
  if(!el) return;
  let rows=data.projects;
  if(sid) rows=rows.filter(p=>String(p.supervisor_id)===String(sid));
  fillSelect('workerProject', rows, 'name', 'اختر المشروع');
}
async function saveWorker(){
  const id=$('workerId').value;
  const supId=Number($('workerSupervisor').value)||null;
  const projectId=Number($('workerProject')?.value)||null;
  const row={
    name:$('workerName').value.trim(),
    phone:$('workerPhone').value.trim(),
    salary:Number($('workerSalary').value||1500),
    supervisor_id:supId,
    app_supervisor_id:supId,
    project_id:projectId,
    worker_type:$('workerType')?.value||'primary',
    status:$('workerStatus').value,
    notes:$('workerNotes').value
  };
  if(!row.name) return msg('اسم العامل مطلوب','err');
  if(!row.supervisor_id) return msg('اختر المشرف المسؤول عن العامل','err');
  const res=id?await sb.from('workers').update(row).eq('id',id):await sb.from('workers').insert(row);
  if(res.error) return msg(res.error.message,'err');
  msg(id?'تم تحديث العامل':'تم حفظ العامل');
  clearWorkerForm();
  await refreshAll();
}
function renderWorkers(){
  const b=$('workersBody'); if(!b) return;
  const s=$('workerFilterSupervisor')?.value, p=$('workerFilterProject')?.value, st=$('workerFilterStatus')?.value, tp=$('workerFilterType')?.value, q=($('workerSearch')?.value||'').trim();
  let rows=data.workers;
  if(s) rows=rows.filter(w=>String(workerSupId(w))===String(s));
  if(p) rows=rows.filter(w=>String(workerProjectId(w))===String(p));
  if(st) rows=rows.filter(w=>(w.status||'active')===st);
  if(tp) rows=rows.filter(w=>(w.worker_type||'primary')===tp);
  if(q) rows=rows.filter(w=>[w.name,w.phone,supervisorName(workerSupId(w)),projectName(workerProjectId(w)),w.notes].join(' ').includes(q));
  b.innerHTML=rows.map(w=>`<tr><td>${esc(w.name)}</td><td>${esc(supervisorName(workerSupId(w)))}</td><td>${esc(projectName(workerProjectId(w)))}</td><td><span class="badge ${w.worker_type==='support'?'amber':'green'}">${workerTypeText(w.worker_type)}</span></td><td>${esc(w.phone)}</td><td>${w.salary||0}</td><td><span class="badge ${w.status==='inactive'?'red':'green'}">${w.status==='inactive'?'موقوف':'نشط'}</span></td><td>${esc(w.notes||'-')}</td><td class="row-actions"><button onclick="editWorker(${w.id})">تعديل</button><button class="light" onclick="toggleWorkerStatus(${w.id})">${w.status==='inactive'?'تفعيل':'إيقاف'}</button><button class="danger" onclick="deleteRow('workers',${w.id})">حذف</button></td></tr>`).join('')||'<tr><td colspan="9">لا توجد بيانات</td></tr>';
}
function editWorker(id){
  const w=data.workers.find(x=>x.id===id); if(!w)return;
  $('workerId').value=w.id; $('workerName').value=w.name||''; $('workerPhone').value=w.phone||''; $('workerSalary').value=w.salary||1500;
  $('workerSupervisor').value=workerSupId(w)||''; onWorkerSupervisorChange();
  if($('workerProject')) $('workerProject').value=workerProjectId(w)||'';
  if($('workerType')) $('workerType').value=w.worker_type||'primary';
  $('workerStatus').value=w.status||'active'; $('workerNotes').value=w.notes||'';
  $('workerFormTitle').textContent='تعديل عامل';
  $('workerSaveBtn')&&($('workerSaveBtn').textContent='تحديث العامل');
  $('workerCancelBtn')&&$('workerCancelBtn').classList.remove('hidden');
  showPage('workers', document.querySelector('.nav[onclick*="workers"]'));
  window.scrollTo({top:0,behavior:'smooth'});
}
async function toggleWorkerStatus(id){
  const w=data.workers.find(x=>x.id===id); if(!w) return;
  const next=w.status==='inactive'?'active':'inactive';
  const {error}=await sb.from('workers').update({status:next}).eq('id',id);
  if(error) return msg(error.message,'err');
  msg(next==='active'?'تم تفعيل العامل':'تم إيقاف العامل');
  await refreshAll();
}
function clearAttendanceForm(){ ['attendanceId','attendanceNotes'].forEach(id=>$(id)&&($(id).value='')); if($('attendanceDate')) $('attendanceDate').value=today(); if($('attendanceStatus')) $('attendanceStatus').value='present'; $('attendanceFormTitle')&&($('attendanceFormTitle').textContent='تسجيل حضور / غياب'); }
async function saveAttendance(){ const id=$('attendanceId').value; const row={attendance_date:$('attendanceDate').value||today(), worker_id:Number($('attendanceWorker').value), supervisor_id:Number($('attendanceSupervisor').value)||null, project_id:Number($('attendanceProject').value)||null, status:$('attendanceStatus').value, notes:$('attendanceNotes').value, created_by:session()?.id||null}; if(!row.worker_id) return msg('اختر العامل','err'); const res=id?await sb.from('attendance').update(row).eq('id',id):await sb.from('attendance').upsert(row,{onConflict:'attendance_date,worker_id'}); if(res.error) return msg(res.error.message,'err'); msg('تم حفظ الحضور'); clearAttendanceForm(); await refreshAll(); }
function renderAttendance(){ const b=$('attendanceBody'); if(!b) return; const d=$('attendanceFilterDate')?.value, s=$('attendanceFilterSupervisor')?.value, q=($('attendanceSearch')?.value||'').trim(); let rows=data.attendance; if(d) rows=rows.filter(a=>a.attendance_date===d); if(s) rows=rows.filter(a=>String(a.supervisor_id)===String(s)); if(q) rows=rows.filter(a=>[workerName(a.worker_id),supervisorName(a.supervisor_id),projectName(a.project_id),a.notes].join(' ').includes(q)); b.innerHTML=rows.map(a=>`<tr><td>${a.attendance_date}</td><td>${esc(workerName(a.worker_id))}</td><td>${esc(supervisorName(a.supervisor_id))}</td><td>${esc(projectName(a.project_id))}</td><td><span class="badge ${a.status==='present'?'green':'red'}">${a.status==='present'?'حاضر':'غائب'}</span></td><td>${esc(a.notes)}</td><td class="row-actions"><button onclick="editAttendance(${a.id})">تعديل</button><button class="danger" onclick="deleteRow('attendance',${a.id})">حذف</button></td></tr>`).join('')||'<tr><td colspan="7">لا توجد بيانات</td></tr>'; renderAttendanceWorkersQuick(); }
function editAttendance(id){ const a=data.attendance.find(x=>x.id===id); if(!a)return; $('attendanceId').value=a.id; $('attendanceDate').value=a.attendance_date; $('attendanceSupervisor').value=a.supervisor_id||''; $('attendanceProject').value=a.project_id||''; $('attendanceWorker').value=a.worker_id||''; $('attendanceStatus').value=a.status; $('attendanceNotes').value=a.notes||''; $('attendanceFormTitle').textContent='تعديل حضور'; }
function renderAttendanceWorkersQuick(){ const div=$('attendanceQuick'); if(!div) return; const sid=$('attendanceSupervisor')?.value; if(!sid){ div.innerHTML=''; return; } const ws=data.workers.filter(w=>String(workerSupId(w))===String(sid)); div.innerHTML=ws.map(w=>`<div class="quick-item"><b>${esc(w.name)}</b><div><button onclick="quickAttendance(${w.id},'present')">حاضر</button> <button class="danger" onclick="quickAttendance(${w.id},'absent')">غائب</button></div></div>`).join(''); }
async function quickAttendance(workerId,status){ $('attendanceWorker').value=workerId; $('attendanceStatus').value=status; await saveAttendance(); }
function renderMonthly(){
  const body=$('monthlyBody');
  if(!body) return;
  const month=$('monthlyMonth')?.value || today().slice(0,7);
  const sid=$('monthlySupervisor')?.value;
  let rows=data.logs.filter(l=>{
    const d = l.log_date || String(l.check_in||'').slice(0,10);
    return d.slice(0,7)===month;
  });
  if(sid) rows=rows.filter(l=>String(l.supervisor_id)===String(sid));
  const map={};
  rows.forEach(l=>{
    const k=(l.supervisor_id||'')+'_'+(l.project_id||'');
    if(!map[k]) map[k]={s:l.supervisor_id,p:l.project_id,c:0,m:0,req:0,t:0};
    const actual = logActualMinutes(l);
    const required = logRequiredMinutes(l);
    map[k].c++;
    map[k].m += actual;
    map[k].req += required;
    map[k].t += Number(l.travel_minutes||0);
  });
  const vals=Object.values(map).map(r=>{
    r.percent = r.req ? (r.m/r.req)*100 : 0;
    r.perf = performanceStatus(r.percent,r.req);
    return r;
  });
  body.innerHTML=vals.map(r=>`<tr><td>${esc(supervisorName(r.s))}</td><td>${esc(projectName(r.p))}</td><td>${r.c}</td><td>${minsToText(r.req)}</td><td>${minsToText(r.m)}</td><td>${r.t} دقيقة</td><td><span class="badge ${r.perf.cls}">${percentText(r.percent)}</span></td><td><span class="badge ${r.perf.cls}">${r.perf.text}</span></td></tr>`).join('')||'<tr><td colspan="8">لا توجد بيانات</td></tr>';
  const total=vals.reduce((a,r)=>a+r.m,0), required=vals.reduce((a,r)=>a+r.req,0), travel=vals.reduce((a,r)=>a+r.t,0), pct=required?total/required*100:0;
  const perf=performanceStatus(pct,required);
  if($('monthlySummary')) $('monthlySummary').innerHTML=`<div class="kpi"><small>عدد التسجيلات</small><b>${rows.length}</b></div><div class="kpi"><small>الساعات المطلوبة</small><b>${minsToText(required)}</b></div><div class="kpi"><small>الساعات الفعلية</small><b>${minsToText(total)}</b></div><div class="kpi"><small>وقت الانتقال</small><b>${travel} دقيقة</b></div><div class="kpi"><small>نسبة العمل</small><b>${percentText(pct)}</b></div><div class="kpi"><small>حالة الأداء</small><b><span class="badge ${perf.cls}">${perf.text}</span></b></div>`;
}
function clearTicketForm(){ ['ticketId','ticketTitle','ticketDescription'].forEach(id=>$(id)&&($(id).value='')); if($('ticketStatus')) $('ticketStatus').value='open'; if($('ticketPriority')) $('ticketPriority').value='normal'; $('ticketFormTitle')&&($('ticketFormTitle').textContent='إضافة تكت'); }
async function saveTicket(){ const u=session(); const row={project_id:Number($('ticketProject').value)||null, supervisor_id:Number($('ticketSupervisor')?.value || (u.role==='supervisor'?u.id:''))||null, title:$('ticketTitle').value.trim(), description:$('ticketDescription').value, priority:$('ticketPriority').value, status:$('ticketStatus')?.value || 'open'}; if(!row.title) return msg('عنوان التكت مطلوب','err'); if(row.status==='closed') row.closed_at=new Date().toISOString(); const id=$('ticketId')?.value; const res=id?await sb.from('tickets').update(row).eq('id',id):await sb.from('tickets').insert(row); if(res.error) return msg(res.error.message,'err'); playAppSound('ticket'); msg('تم حفظ التكت'); clearTicketForm(); await refreshAll(); }
function renderTickets(){ const b=$('ticketsBody'); if(!b) return; const st=$('ticketFilterStatus')?.value, q=($('ticketSearch')?.value||'').trim(); let rows=data.tickets; if(st) rows=rows.filter(t=>t.status===st); if(q) rows=rows.filter(t=>[t.title,t.description,projectName(t.project_id),supervisorName(t.supervisor_id)].join(' ').includes(q)); b.innerHTML=rows.map(t=>`<tr><td>${esc(projectName(t.project_id))}</td><td>${esc(supervisorName(t.supervisor_id))}</td><td>${esc(t.title)}</td><td><span class="badge ${t.priority==='high'?'red':'amber'}">${t.priority||'normal'}</span></td><td><span class="badge ${t.status==='closed'?'green':'red'}">${t.status==='closed'?'مغلق':'مفتوح'}</span></td><td class="row-actions"><button onclick="editTicket(${t.id})">تعديل</button><button class="danger" onclick="deleteRow('tickets',${t.id})">حذف</button></td></tr>`).join('')||'<tr><td colspan="6">لا توجد بيانات</td></tr>'; }
function editTicket(id){ const t=data.tickets.find(x=>x.id===id); if(!t)return; $('ticketId').value=t.id; $('ticketProject').value=t.project_id||''; if($('ticketSupervisor')) $('ticketSupervisor').value=t.supervisor_id||''; $('ticketTitle').value=t.title||''; $('ticketPriority').value=t.priority||'normal'; if($('ticketStatus')) $('ticketStatus').value=t.status||'open'; $('ticketDescription').value=t.description||''; $('ticketFormTitle')&&($('ticketFormTitle').textContent='تعديل تكت'); }
function renderAlerts(){ const div=$('alertsList'); if(!div) return; const alerts=[]; data.projects.filter(p=>!p.supervisor_id).forEach(p=>alerts.push(['warn',`مشروع بدون مشرف: ${p.name}`])); data.workers.filter(w=>!workerSupId(w)).forEach(w=>alerts.push(['warn',`عامل بدون مشرف: ${w.name}`])); data.logs.filter(l=>!l.check_out).forEach(l=>alerts.push(['danger',`تسجيل دخول بدون خروج: ${projectName(l.project_id)} - ${supervisorName(l.supervisor_id)}`])); data.tickets.filter(t=>t.status==='open').forEach(t=>alerts.push(['warn',`تكت مفتوح: ${t.title} - ${projectName(t.project_id)}`])); div.innerHTML=alerts.map(a=>`<div class="alert-item ${a[0]}">${esc(a[1])}</div>`).join('')||'<div class="alert-item">لا توجد تنبيهات حالياً</div>'; }
function toCSV(rows){ if(!rows.length) return ''; const keys=Object.keys(rows[0]); return [keys.join(','),...rows.map(r=>keys.map(k=>'"'+String(r[k]??'').replace(/"/g,'""')+'"').join(','))].join('\n'); }
function download(name,text){ const blob=new Blob([text],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
async function exportTable(table){ const {data:rows,error}=await sb.from(table).select('*'); if(error) return msg(error.message,'err'); download(`${table}.csv`, toCSV(rows||[])); }
function exportMonthlyCSV(){ const rows=[...document.querySelectorAll('#monthlyBody tr')].map(tr=>[...tr.children].map(td=>td.textContent)); const csv=['المشرف,المشروع,عدد السجلات,الساعات المطلوبة,الساعات الفعلية,وقت الانتقال,نسبة العمل,حالة الأداء',...rows.map(r=>r.map(x=>'"'+x+'"').join(','))].join('\n'); download('monthly.csv',csv); }
async function initSupervisor(){ const u=requireRole('supervisor'); if(!u) return; await loadAll(); data.projects=data.projects.filter(p=>String(p.supervisor_id)===String(u.id)); data.workers=data.workers.filter(w=>String(workerSupId(w))===String(u.id)); data.logs=data.logs.filter(l=>String(l.supervisor_id)===String(u.id)); const supProjectIds = new Set(data.projects.map(p=>String(p.id))); data.tickets=data.tickets.filter(t=>String(t.supervisor_id)===String(u.id) || String(t.created_by)===String(u.id) || supProjectIds.has(String(t.project_id))); $('supTitle').textContent=`لوحة المشرف - ${u.full_name}`; fillSelect('logProject',data.projects,'name','اختر المشروع'); fillSelect('attendanceProject',data.projects,'name','اختر المشروع'); fillSelect('ticketProject',data.projects,'name','اختر المشروع'); if($('logDate')) $('logDate').value=today(); if($('attendanceDate')) $('attendanceDate').value=today(); renderSupervisorAttendanceList(); renderTimeLogs(); await supervisorInventoryLoad(); }
async function supervisorCheckIn(){ if(!$('logProject').value) return msg('اختر المشروع','err'); $('logDate').value=today(); $('logIn').value=nowTime(); $('logOut').value=''; await saveTimeLog(); await initSupervisor(); }
async function supervisorCheckOut(){ const u=session(); const pid=$('logProject').value; const open=data.logs.find(l=>String(l.project_id)===String(pid)&&!l.check_out); if(open) editTimeLog(open.id); $('logOut').value=nowTime(); await saveTimeLog(); await initSupervisor(); }
function renderSupervisorAttendanceList(){ const div=$('supervisorAttendanceList'); if(!div) return; div.innerHTML=data.workers.map(w=>`<div class="quick-item"><b>${esc(w.name)}</b><select data-worker="${w.id}"><option value="present">حاضر</option><option value="absent">غائب</option></select></div>`).join('')||'<div class="quick-item">لا يوجد عمال مرتبطين بك</div>'; }
async function saveSupervisorAttendance(){ const u=session(); const date=$('attendanceDate').value||today(), project=Number($('attendanceProject').value)||null; const rows=[...document.querySelectorAll('#supervisorAttendanceList select')].map(s=>({attendance_date:date, worker_id:Number(s.dataset.worker), supervisor_id:u.id, project_id:project, status:s.value, created_by:u.id})); if(!rows.length) return; const {error}=await sb.from('attendance').upsert(rows,{onConflict:'attendance_date,worker_id'}); if(error) return msg(error.message,'err'); msg('تم حفظ التحضير'); await initSupervisor(); }

/* ===== Tasneef emergency navigation/button stabilizer ===== */
(function(){
  function runSafe(name){
    try { if (typeof window[name] === 'function') window[name](); }
    catch(e){ console.error('Error in '+name, e); }
  }

  const renderNames = ['renderDashboard','renderTimeLogs','renderUsers','renderProjects','renderWorkers','renderAttendance','renderMonthly','renderTickets','renderAlerts','renderTasneefAssistant'];
  window.renderAll = function(){ renderNames.forEach(runSafe); };

  window.showPage = function(id, btn){
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const page = document.getElementById(id);
    if(page) page.classList.remove('hidden');
    document.querySelectorAll('.nav').forEach(n => n.classList.remove('active'));
    if(btn) btn.classList.add('active');
    try { window.renderAll(); } catch(e){ console.error('renderAll failed', e); }
  };

  const oldInitAdmin = window.initAdmin;
  window.initAdmin = async function(){
    try {
      if (typeof requireRole === 'function') requireRole('admin');
      if (typeof refreshAll === 'function') await refreshAll();
    } catch(e){
      console.error('initAdmin failed', e);
      try { window.renderAll(); } catch(_e){}
    }
  };

  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('.side .nav:not(.danger)').forEach(function(btn){
      const txt = (btn.textContent || '').trim();
      const map = {
        'لوحة التحكم':'dashboard',
        'التسجيلات اليومية':'daily',
        'إدارة المستخدمين':'users',
        'المشاريع':'projects',
        'العمال':'workers',
        'الحضور والغياب':'attendance',
        'الأوقات الشهرية':'monthly',
        'التكتات':'tickets',
        'التنبيهات':'alerts',
        'مساعد تصنيف':'assistant',
        'التصدير':'export'
      };
      const old = btn.getAttribute('onclick') || '';
      const m = old.match(/showPage\('([^']+)'/);
      const id = (m && m[1]) || map[txt];
      if(id){
        btn.onclick = function(ev){ ev.preventDefault(); window.showPage(id, btn); return false; };
      }
    });
  });
})();

/* ===== V10: Monthly attendance matrix ===== */
(function(){
  function daysInMonth(monthStr){
    if(!monthStr || !monthStr.includes('-')) monthStr = today().slice(0,7);
    const parts = monthStr.split('-').map(Number);
    return new Date(parts[0], parts[1], 0).getDate();
  }
  function monthDate(monthStr, day){ return monthStr + '-' + String(day).padStart(2,'0'); }
  function setSelectOptionsSafe(id, rows, labelFn, allLabel){
    const el = $(id); if(!el) return;
    const old = el.value;
    el.innerHTML = `<option value="">${allLabel||'الكل'}</option>` + rows.map(r=>`<option value="${r.id}">${esc(labelFn(r))}</option>`).join('');
    if([...el.options].some(o=>o.value===old)) el.value = old;
  }
  function ensureAttendanceMatrixFilters(){
    const monthEl = $('attendanceMatrixMonth');
    if(monthEl && !monthEl.value) monthEl.value = today().slice(0,7);
    setSelectOptionsSafe('attendanceMatrixSupervisor', data.supervisors||[], s=>s.full_name||s.username, 'كل المشرفين');
    const sid = $('attendanceMatrixSupervisor')?.value;
    let projects = data.projects || [];
    if(sid) projects = projects.filter(p=>String(p.supervisor_id)===String(sid));
    setSelectOptionsSafe('attendanceMatrixProject', projects, p=>p.name, 'كل المشاريع');
  }
  function workerMatchesMatrix(w, sid, pid, q){
    if(sid && String(workerSupId(w))!==String(sid)) return false;
    if(pid && String(workerProjectId(w))!==String(pid)) return false;
    if(q && !String(w.name||'').includes(q)) return false;
    return true;
  }
  window.renderAttendanceMonthly = function(){
    if(!$('attendanceMatrixBody')) return;
    ensureAttendanceMatrixFilters();
    const month = $('attendanceMatrixMonth')?.value || today().slice(0,7);
    const sid = $('attendanceMatrixSupervisor')?.value || '';
    const pid = $('attendanceMatrixProject')?.value || '';
    const q = ($('attendanceMatrixSearch')?.value || '').trim();
    const days = daysInMonth(month);
    const workers = (data.workers||[]).filter(w=>workerMatchesMatrix(w,sid,pid,q));
    const head = $('attendanceMatrixHead');
    if(head){
      const dayHeads = Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
      head.innerHTML = `<tr><th>العامل</th><th>المشرف</th><th>المشروع</th>${dayHeads}<th>حضور</th><th>غياب</th><th>النسبة</th></tr>`;
    }
    let totalPresent=0,totalAbsent=0;
    const body = $('attendanceMatrixBody');
    body.innerHTML = workers.map(w=>{
      let present=0, absent=0;
      const cells = [];
      for(let d=1; d<=days; d++){
        const ds = monthDate(month,d);
        const rec = (data.attendance||[]).find(a=>String(a.worker_id)===String(w.id) && a.attendance_date===ds && (!pid || String(a.project_id||workerProjectId(w))===String(pid)));
        if(rec?.status==='present'){ present++; cells.push(`<td title="حاضر"><span class="att-cell att-present">ح</span></td>`); }
        else if(rec?.status==='absent'){ absent++; cells.push(`<td title="غائب"><span class="att-cell att-absent">غ</span></td>`); }
        else cells.push(`<td title="لم يسجل"><span class="att-cell att-empty">-</span></td>`);
      }
      totalPresent += present; totalAbsent += absent;
      const pct = (present+absent) ? (present/(present+absent))*100 : 0;
      const cls = pct>=90?'green':(pct>=70?'amber':'red');
      return `<tr><td><b>${esc(w.name)}</b><div class="att-summary">${esc(workerTypeText(w.worker_type||'primary'))}</div></td><td>${esc(supervisorName(workerSupId(w)))}</td><td>${esc(projectName(workerProjectId(w)))}</td>${cells.join('')}<td><span class="badge green">${present}</span></td><td><span class="badge red">${absent}</span></td><td><span class="badge ${cls}">${pct.toFixed(1)}%</span></td></tr>`;
    }).join('') || `<tr><td colspan="${days+6}">لا يوجد عمال حسب الفلاتر المختارة</td></tr>`;
    const recorded = totalPresent + totalAbsent;
    const pct = recorded ? (totalPresent/recorded)*100 : 0;
    if($('attendanceMatrixSummary')){
      $('attendanceMatrixSummary').innerHTML = `<div class="kpi"><small>عدد العمال</small><b>${workers.length}</b></div><div class="kpi"><small>إجمالي الحضور</small><b>${totalPresent}</b></div><div class="kpi"><small>إجمالي الغياب</small><b>${totalAbsent}</b></div><div class="kpi"><small>نسبة الحضور</small><b>${pct.toFixed(1)}%</b></div>`;
    }
  };
  window.exportAttendanceMatrixCSV = function(){
    const month = $('attendanceMatrixMonth')?.value || today().slice(0,7);
    const rows=[...document.querySelectorAll('#attendanceMatrixBody tr')].map(tr=>[...tr.children].map(td=>`"${td.textContent.trim().replace(/"/g,'""')}"`).join(','));
    const heads=[...document.querySelectorAll('#attendanceMatrixHead th')].map(th=>`"${th.textContent.trim()}"`).join(',');
    download(`attendance-${month}.csv`, [heads,...rows].join('\n'));
  };
  const oldRenderAttendance = window.renderAttendance;
  window.renderAttendance = function(){
    try{ if(typeof oldRenderAttendance==='function') oldRenderAttendance(); }catch(e){ console.error('old renderAttendance failed',e); }
    try{ window.renderAttendanceMonthly(); }catch(e){ console.error('renderAttendanceMonthly failed',e); }
  };
})();

/* ===== V10.1: Fix attendance monthly filters and empty results ===== */
(function(){
  function daysInMonthFixed(monthStr){
    if(!monthStr || !monthStr.includes('-')) monthStr = today().slice(0,7);
    const [y,m] = monthStr.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }
  function monthDateFixed(monthStr, day){ return `${monthStr}-${String(day).padStart(2,'0')}`; }
  function monthOfAttendance(a){ return String(a.attendance_date || '').slice(0,7); }
  function safeOptionText(v){ return esc(v || '-'); }
  function setOptionsKeepValue(id, rows, labelFn, allLabel){
    const el = $(id); if(!el) return '';
    const old = el.value || '';
    const seen = new Set();
    const opts = [];
    (rows||[]).forEach(r=>{
      if(!r || r.id===undefined || r.id===null) return;
      const val = String(r.id);
      if(seen.has(val)) return;
      seen.add(val);
      opts.push(`<option value="${esc(val)}">${safeOptionText(labelFn(r))}</option>`);
    });
    el.innerHTML = `<option value="">${allLabel || 'الكل'}</option>` + opts.join('');
    if([...el.options].some(o=>o.value===old)) el.value = old;
    else el.value = '';
    return el.value;
  }
  function projectMatchesSupervisorForAttendance(project, sid, month){
    if(!sid) return true;
    if(String(project.supervisor_id||'') === String(sid)) return true;
    const hasWorker = (data.workers||[]).some(w => String(workerProjectId(w)||'')===String(project.id) && String(workerSupId(w)||'')===String(sid));
    if(hasWorker) return true;
    return (data.attendance||[]).some(a => monthOfAttendance(a)===month && String(a.project_id||'')===String(project.id) && String(a.supervisor_id||'')===String(sid));
  }
  function workerMatchesAttendanceMatrixFixed(w, sid, pid, q, month){
    const wid = String(w.id);
    const wsid = String(workerSupId(w)||'');
    const wpid = String(workerProjectId(w)||'');
    const workerAttend = (data.attendance||[]).filter(a=>monthOfAttendance(a)===month && String(a.worker_id)===wid);
    if(sid){
      const projectSupervisorMatch = wpid && String((data.projects||[]).find(p=>String(p.id)===wpid)?.supervisor_id||'')===String(sid);
      const attendanceSupervisorMatch = workerAttend.some(a=>String(a.supervisor_id||'')===String(sid));
      if(wsid!==String(sid) && !projectSupervisorMatch && !attendanceSupervisorMatch) return false;
    }
    if(pid){
      const attendanceProjectMatch = workerAttend.some(a=>String(a.project_id||'')===String(pid));
      if(wpid!==String(pid) && !attendanceProjectMatch) return false;
    }
    if(q && !String(w.name||'').includes(q)) return false;
    return true;
  }
  function recordForDay(w, ds, sid, pid){
    const rows = (data.attendance||[]).filter(a=>String(a.worker_id)===String(w.id) && a.attendance_date===ds);
    return rows.find(a=>(!sid || String(a.supervisor_id||workerSupId(w)||'')===String(sid)) && (!pid || String(a.project_id||workerProjectId(w)||'')===String(pid))) || null;
  }
  window.renderAttendanceMonthly = function(){
    const body = $('attendanceMatrixBody');
    if(!body) return;

    const monthEl = $('attendanceMatrixMonth');
    if(monthEl && !monthEl.value) monthEl.value = today().slice(0,7);
    const month = monthEl?.value || today().slice(0,7);

    const supervisorRows = (data.supervisors && data.supervisors.length ? data.supervisors : (data.users||[]).filter(u=>u.role==='supervisor'));
    const sid = setOptionsKeepValue('attendanceMatrixSupervisor', supervisorRows, s=>s.full_name || s.username, 'كل المشرفين');

    const projectRows = (data.projects||[]).filter(p=>projectMatchesSupervisorForAttendance(p, sid, month));
    const pid = setOptionsKeepValue('attendanceMatrixProject', projectRows, p=>p.name, 'كل المشاريع');

    const q = ($('attendanceMatrixSearch')?.value || '').trim();
    const days = daysInMonthFixed(month);
    const workers = (data.workers||[]).filter(w=>workerMatchesAttendanceMatrixFixed(w, sid, pid, q, month));

    const head = $('attendanceMatrixHead');
    if(head){
      const dayHeads = Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
      head.innerHTML = `<tr><th>العامل</th><th>المشرف</th><th>المشروع</th>${dayHeads}<th>حضور</th><th>غياب</th><th>النسبة</th></tr>`;
    }

    let totalPresent=0, totalAbsent=0;
    body.innerHTML = workers.map(w=>{
      let present=0, absent=0;
      const cells=[];
      for(let d=1; d<=days; d++){
        const ds = monthDateFixed(month,d);
        const rec = recordForDay(w, ds, sid, pid);
        if(rec && rec.status==='present'){
          present++; cells.push(`<td title="حاضر"><span class="att-cell att-present">ح</span></td>`);
        } else if(rec && rec.status==='absent'){
          absent++; cells.push(`<td title="غائب"><span class="att-cell att-absent">غ</span></td>`);
        } else {
          cells.push(`<td title="لم يسجل"><span class="att-cell att-empty">-</span></td>`);
        }
      }
      totalPresent += present; totalAbsent += absent;
      const pct = (present+absent) ? (present/(present+absent))*100 : 0;
      const cls = pct>=90 ? 'green' : (pct>=70 ? 'amber' : 'red');
      const projectId = pid || workerProjectId(w);
      const supervisorId = sid || workerSupId(w) || (projectId ? (data.projects||[]).find(p=>String(p.id)===String(projectId))?.supervisor_id : '');
      return `<tr><td><b>${esc(w.name)}</b><div class="att-summary">${esc(workerTypeText(w.worker_type||'primary'))}</div></td><td>${esc(supervisorName(supervisorId))}</td><td>${esc(projectName(projectId))}</td>${cells.join('')}<td><span class="badge green">${present}</span></td><td><span class="badge red">${absent}</span></td><td><span class="badge ${cls}">${pct.toFixed(1)}%</span></td></tr>`;
    }).join('') || `<tr><td colspan="${days+6}">لا يوجد عمال حسب الفلاتر المختارة</td></tr>`;

    const recorded = totalPresent + totalAbsent;
    const pct = recorded ? (totalPresent/recorded)*100 : 0;
    if($('attendanceMatrixSummary')){
      $('attendanceMatrixSummary').innerHTML = `<div class="kpi"><small>عدد العمال</small><b>${workers.length}</b></div><div class="kpi"><small>إجمالي الحضور</small><b>${totalPresent}</b></div><div class="kpi"><small>إجمالي الغياب</small><b>${totalAbsent}</b></div><div class="kpi"><small>نسبة الحضور</small><b>${pct.toFixed(1)}%</b></div>`;
    }
  };

  const oldShowPageV101 = window.showPage;
  window.showPage = function(id, btn){
    if(typeof oldShowPageV101 === 'function') oldShowPageV101(id, btn);
    if(id === 'attendance') setTimeout(()=>window.renderAttendanceMonthly && window.renderAttendanceMonthly(), 0);
  };
})();


/* ===== V14: Ticket receiving, closing details, duration and colors ===== */
(function(){
  function ticketNo(t){ return t.ticket_number || ('T-' + String(t.id||0).padStart(4,'0')); }
  function ticketStatusLabel(status){ return status==='closed'?'مغلق':(status==='processing'?'تحت المعالجة':'مفتوح'); }
  function ticketPriorityLabel(p){ return p==='urgent'?'عاجل':(p==='high'?'مهم':(p==='low'?'منخفض':'عادي')); }
  function shortDesc(s){ s=String(s||''); return s.length>90 ? esc(s.slice(0,90))+'…' : esc(s||'-'); }
  function currentName(){ const u=session(); return (u && (u.full_name || u.username)) || 'غير محدد'; }
  function parseDate(v){ const d = v ? new Date(v) : null; return d && !isNaN(d) ? d : null; }
  function minutesBetween(a,b){ const da=parseDate(a), db=parseDate(b); if(!da || !db) return 0; return Math.max(0, Math.round((db-da)/60000)); }
  function durationLabel(min){ min=Number(min||0); if(!min) return '0د'; const d=Math.floor(min/1440), h=Math.floor((min%1440)/60), m=min%60; const parts=[]; if(d) parts.push(d+'ي'); if(h) parts.push(h+'س'); if(m||!parts.length) parts.push(m+'د'); return parts.join(' '); }
  function openMinutes(t){ if(t.status==='closed') return Number(t.open_duration_minutes||0) || minutesBetween(t.created_at, t.closed_at); return minutesBetween(t.created_at, new Date().toISOString()); }
  function ticketRowClass(t){ if(t.status==='closed') return 'ticket-row-closed'; if(t.status==='processing') return 'ticket-row-processing'; if(t.priority==='urgent'||t.priority==='high') return 'ticket-row-urgent'; return 'ticket-row-normal'; }
  function statusBadge(t){ const cls=t.status==='closed'?'green':(t.status==='processing'?'amber':((t.priority==='urgent'||t.priority==='high')?'red':'pink')); return `<span class="badge ${cls}">${ticketStatusLabel(t.status)}</span>`; }
  function priorityBadge(t){ const cls=t.priority==='urgent'?'red':(t.priority==='high'?'amber':'pink'); return `<span class="badge ${cls}">${ticketPriorityLabel(t.priority)}</span>`; }
  function askCloserName(){ const name=prompt('اسم الشخص الذي أغلق التكت\nاكتب اسم الفني أو المشرف', currentName()); return (name||'').trim(); }
  function askClosureNote(){ const note=prompt('كيف تم إغلاق التكت؟\nاكتب طريقة الحل أو الإجراء المنفذ'); return (note||'').trim(); }

  window.toggleTicketClosureBox = function(){
    const box=$('ticketClosureBox'); if(!box) return;
    const isClosed=($('ticketStatus')?.value||'')==='closed';
    box.classList.toggle('hidden', !isClosed);
    if(isClosed && $('ticketClosedByName') && !$('ticketClosedByName').value) $('ticketClosedByName').value=currentName();
  };

  window.clearTicketForm = function(){ ['ticketId','ticketTitle','ticketDescription','ticketClosureNote','ticketClosedByName'].forEach(id=>{ if($(id)) $(id).value=''; }); if($('ticketStatus')) $('ticketStatus').value='open'; if($('ticketPriority')) $('ticketPriority').value='normal'; if($('ticketFormTitle')) $('ticketFormTitle').textContent='إضافة تكت'; toggleTicketClosureBox(); };

  window.saveTicket = async function(){
    const u=session(); if(!u) return msg('سجّل الدخول أولاً','err');
    const title=($('ticketTitle')?.value||'').trim(); if(!title) return msg('عنوان التكت مطلوب','err');
    const status=$('ticketStatus')?.value || 'open';
    const row={project_id:Number($('ticketProject')?.value)||null, supervisor_id:Number($('ticketSupervisor')?.value || (u.role==='supervisor'?u.id:''))||null, created_by:u.id, title, description:$('ticketDescription')?.value || '', priority:$('ticketPriority')?.value || 'normal', status, updated_at:new Date().toISOString()};
    const id=$('ticketId')?.value;
    if(status==='closed'){
      const existing=id?(data.tickets||[]).find(x=>String(x.id)===String(id)):null;
      const note=(($('ticketClosureNote')?.value)||'').trim() || askClosureNote(); if(!note) return msg('لا يمكن إغلاق التكت بدون ذكر كيف تم الإغلاق','err');
      const closer=(($('ticketClosedByName')?.value)||'').trim() || askCloserName(); if(!closer) return msg('اكتب اسم من أغلق التكت','err');
      const now=new Date().toISOString(); row.closed_at=now; row.closed_by=u.id; row.closed_by_name=closer; row.closure_note=note; row.open_duration_minutes=existing?minutesBetween(existing.created_at,now):0; row.processing_duration_minutes=existing?.claimed_at?minutesBetween(existing.claimed_at,now):0;
      if(existing && !existing.claimed_at){ row.claimed_by=u.id; row.claimed_by_name=closer; row.claimed_at=now; }
    }else{ row.closed_at=null; row.closed_by=null; row.closed_by_name=null; row.closure_note=null; row.open_duration_minutes=null; row.processing_duration_minutes=null; }
    let res; if(id){ res=await sb.from('tickets').update(row).eq('id',id).select('*').maybeSingle(); }else{ res=await sb.from('tickets').insert(row).select('*').single(); if(!res.error&&res.data&&!res.data.ticket_number){ const tn='T-'+String(res.data.id).padStart(4,'0'); await sb.from('tickets').update({ticket_number:tn}).eq('id',res.data.id); } }
    if(res.error) return msg(res.error.message,'err'); playAppSound('ticket'); msg(id?'تم تحديث التكت':'تم حفظ التكت'); clearTicketForm(); if(u.role==='supervisor') await window.initSupervisor(); else await refreshAll();
  };

  window.renderTickets = function(){
    const adminBody=$('ticketsBody'), supBody=$('supTicketsBody'); if(!adminBody&&!supBody) return; let rows=[...(data.tickets||[])];
    if(adminBody){ const st=$('ticketFilterStatus')?.value||'', q=($('ticketSearch')?.value||'').trim().toLowerCase(); let list=rows; if(st) list=list.filter(t=>t.status===st); if(q) list=list.filter(t=>[ticketNo(t),t.title,t.description,projectName(t.project_id),supervisorName(t.supervisor_id),ticketStatusLabel(t.status),t.claimed_by_name,t.closed_by_name,t.closure_note].join(' ').toLowerCase().includes(q)); adminBody.innerHTML=list.map(t=>`<tr class="${ticketRowClass(t)}"><td><b>${esc(ticketNo(t))}</b></td><td>${esc(projectName(t.project_id))}</td><td>${esc(supervisorName(t.supervisor_id))}</td><td>${esc(t.title)}</td><td style="white-space:normal;min-width:220px">${shortDesc(t.description)}</td><td>${priorityBadge(t)}</td><td>${statusBadge(t)}</td><td>${fmt(t.created_at)}</td><td>${esc(durationLabel(openMinutes(t)))}</td><td>${esc(t.claimed_by_name||'-')}<br><small>${t.claimed_at?fmt(t.claimed_at):''}</small></td><td>${esc(t.closed_by_name||'-')}<br><small>${t.closed_at?fmt(t.closed_at):''}</small></td><td style="white-space:normal;min-width:220px">${shortDesc(t.closure_note)}</td><td class="row-actions"><button onclick="editTicket(${t.id})">تعديل</button>${t.status==='closed'?`<button class="light" onclick="setTicketStatus(${t.id},'open')">إعادة فتح</button>`:`${t.status!=='processing'?`<button class="light" onclick="claimTicket(${t.id})">استلام</button>`:''}<button onclick="closeTicket(${t.id})">إغلاق</button>`}<button class="danger" onclick="deleteRow('tickets',${t.id})">حذف</button></td></tr>`).join('')||'<tr><td colspan="13">لا توجد تكتات</td></tr>'; }
    if(supBody){ const st=$('supTicketFilterStatus')?.value||'', pid=$('supTicketFilterProject')?.value||'', q=($('supTicketSearch')?.value||'').trim().toLowerCase(); let list=rows; if(pid) list=list.filter(t=>String(t.project_id)===String(pid)); if(st) list=list.filter(t=>t.status===st); if(q) list=list.filter(t=>[ticketNo(t),t.title,t.description,projectName(t.project_id),ticketStatusLabel(t.status),t.claimed_by_name,t.closed_by_name,t.closure_note].join(' ').toLowerCase().includes(q)); supBody.innerHTML=list.map(t=>`<tr class="${ticketRowClass(t)}"><td><b>${esc(ticketNo(t))}</b></td><td>${esc(projectName(t.project_id))}</td><td>${esc(t.title)}</td><td style="white-space:normal;min-width:180px">${shortDesc(t.description)}</td><td>${priorityBadge(t)}</td><td>${statusBadge(t)}</td><td>${esc(durationLabel(openMinutes(t)))}</td><td>${esc(t.claimed_by_name||'-')}</td><td>${esc(t.closed_by_name||'-')}</td><td style="white-space:normal;min-width:180px">${shortDesc(t.closure_note)}</td><td class="row-actions"><button onclick="editTicket(${t.id})">تعديل</button>${t.status==='closed'?`<button class="light" onclick="setTicketStatus(${t.id},'open')">إعادة فتح</button>`:`${t.status!=='processing'?`<button class="light" onclick="claimTicket(${t.id})">استلام</button>`:''}<button onclick="closeTicket(${t.id})">إغلاق</button>`}</td></tr>`).join('')||'<tr><td colspan="11">لا توجد تكتات</td></tr>'; }
  };

  window.editTicket = function(id){ const t=(data.tickets||[]).find(x=>String(x.id)===String(id)); if(!t)return; if($('ticketId')) $('ticketId').value=t.id; if($('ticketProject')) $('ticketProject').value=t.project_id||''; if($('ticketSupervisor')) $('ticketSupervisor').value=t.supervisor_id||''; if($('ticketTitle')) $('ticketTitle').value=t.title||''; if($('ticketPriority')) $('ticketPriority').value=t.priority||'normal'; if($('ticketStatus')) $('ticketStatus').value=t.status||'open'; if($('ticketDescription')) $('ticketDescription').value=t.description||''; if($('ticketClosedByName')) $('ticketClosedByName').value=t.closed_by_name||''; if($('ticketClosureNote')) $('ticketClosureNote').value=t.closure_note||''; if($('ticketFormTitle')) $('ticketFormTitle').textContent='تعديل تكت '+ticketNo(t); toggleTicketClosureBox(); window.scrollTo({top:0,behavior:'smooth'}); };

  window.claimTicket = async function(id){ const u=session(); if(!u)return msg('سجّل الدخول أولاً','err'); const t=(data.tickets||[]).find(x=>String(x.id)===String(id)); if(!t)return msg('التكت غير موجود','err'); if(t.status==='closed')return msg('التكت مغلق','err'); const now=new Date().toISOString(), name=currentName(); const {error}=await sb.from('tickets').update({status:'processing',claimed_by:u.id,claimed_by_name:name,claimed_at:now,updated_at:now}).eq('id',id); if(error)return msg(error.message,'err'); msg('تم استلام التكت بواسطة '+name); if(u?.role==='supervisor') await window.initSupervisor(); else await refreshAll(); };

  window.closeTicket = async function(id){ const u=session(); if(!u)return msg('سجّل الدخول أولاً','err'); const t=(data.tickets||[]).find(x=>String(x.id)===String(id)); if(!t)return msg('التكت غير موجود','err'); if(t.status==='closed')return msg('التكت مغلق بالفعل','err'); const note=askClosureNote(); if(!note)return msg('لا يمكن إغلاق التكت بدون ذكر كيف تم الإغلاق','err'); const closer=askCloserName(); if(!closer)return msg('اكتب اسم من أغلق التكت','err'); const now=new Date().toISOString(); const row={status:'closed',closed_at:now,closed_by:u.id,closed_by_name:closer,closure_note:note,open_duration_minutes:minutesBetween(t.created_at,now),processing_duration_minutes:t.claimed_at?minutesBetween(t.claimed_at,now):null,updated_at:now}; if(!t.claimed_at){ row.claimed_by=u.id; row.claimed_by_name=closer; row.claimed_at=now; } const {error}=await sb.from('tickets').update(row).eq('id',id); if(error)return msg(error.message,'err'); playAppSound('ticket'); msg('تم إغلاق التكت وحفظ طريقة الإغلاق'); if(u?.role==='supervisor') await window.initSupervisor(); else await refreshAll(); };

  window.setTicketStatus = async function(id,status){ if(status==='closed') return closeTicket(id); if(status==='processing') return claimTicket(id); const row={status,updated_at:new Date().toISOString()}; if(status==='open'){ row.closed_at=null; row.closed_by=null; row.closed_by_name=null; row.closure_note=null; row.open_duration_minutes=null; row.processing_duration_minutes=null; } const {error}=await sb.from('tickets').update(row).eq('id',id); if(error)return msg(error.message,'err'); msg(status==='open'?'تم إعادة فتح التكت':'تم تحديث حالة التكت'); const u=session(); if(u?.role==='supervisor') await window.initSupervisor(); else await refreshAll(); };

  const oldInitSupervisorV14 = window.initSupervisor;
  window.initSupervisor = async function(){ await oldInitSupervisorV14(); if($('supTicketFilterProject')) fillSelect('supTicketFilterProject', data.projects||[], 'name', 'كل المشاريع'); renderTickets(); };
})();

/* ===== V13: Supervisor ticket live notifications, badge, and auto refresh ===== */
(function(){
  let ticketWatchTimer = null;
  let lastSeenTicketId = 0;
  let watchStarted = false;

  function ticketNoV13(t){ return t.ticket_number || ('T-' + String(t.id||0).padStart(4,'0')); }

  function ensureTicketNoticeUI(){
    if(!document.getElementById('supervisorTicketNotice')){
      const box = document.createElement('div');
      box.id = 'supervisorTicketNotice';
      box.style.cssText = 'display:none;position:fixed;left:14px;right:14px;top:14px;z-index:99999;background:#0A4033;color:#fff;border-radius:16px;padding:13px 15px;box-shadow:0 12px 30px rgba(0,0,0,.22);font-family:Tahoma,Arial,sans-serif;line-height:1.7;';
      document.body.appendChild(box);
    }
    const ticketBtn = [...document.querySelectorAll('.sup-tab')].find(b => (b.textContent||'').includes('التكتات'));
    if(ticketBtn && !ticketBtn.querySelector('#supTicketOpenCount')){
      ticketBtn.innerHTML = 'التكتات <span id="supTicketOpenCount" style="display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;border-radius:999px;background:#b83232;color:#fff;font-size:12px;margin-inline-start:6px;padding:0 6px;">0</span>';
    }
  }

  function supervisorTicketScope(rows){
    const u = session();
    if(!u || u.role !== 'supervisor') return rows || [];
    const pids = new Set((data.projects||[]).map(p => String(p.id)));
    return (rows||[]).filter(t =>
      String(t.supervisor_id||'') === String(u.id) ||
      String(t.created_by||'') === String(u.id) ||
      pids.has(String(t.project_id||''))
    );
  }

  function updateSupervisorTicketBadge(){
    ensureTicketNoticeUI();
    const el = document.getElementById('supTicketOpenCount');
    if(!el) return;
    const openCount = (data.tickets||[]).filter(t => t.status !== 'closed').length;
    el.textContent = openCount;
    el.style.display = openCount > 0 ? 'inline-flex' : 'none';
  }

  function showSupervisorTicketNotice(t){
    ensureTicketNoticeUI();
    const box = document.getElementById('supervisorTicketNotice');
    if(!box) return;
    box.innerHTML = `<b>تكت جديد وصل</b><br>${ticketNoV13(t)} - ${esc(projectName(t.project_id))}<br>${esc(t.title || '')}`;
    box.style.display = 'block';
    clearTimeout(window.__ticketNoticeTimeout);
    window.__ticketNoticeTimeout = setTimeout(()=>{ box.style.display='none'; }, 8000);
  }

  async function pollSupervisorTickets(silent=false){
    const u = session();
    if(!u || u.role !== 'supervisor') return;
    try{
      const {data:rows,error}=await sb.from('tickets').select('*').order('created_at',{ascending:false});
      if(error) return console.warn(error.message);
      const scoped = supervisorTicketScope(rows||[]);
      const newestId = scoped.reduce((m,t)=>Math.max(m, Number(t.id||0)), 0);
      const newTickets = scoped.filter(t => Number(t.id||0) > Number(lastSeenTicketId||0));

      data.tickets = scoped;
      if(typeof renderTickets === 'function') renderTickets();
      if(typeof renderSupervisorDailySummary === 'function') renderSupervisorDailySummary();
      updateSupervisorTicketBadge();

      if(!silent && watchStarted && newTickets.length){
        const latest = newTickets.sort((a,b)=>Number(b.id||0)-Number(a.id||0))[0];
        showSupervisorTicketNotice(latest);
        try{ playAppSound('ticket'); }catch(e){}
      }
      if(newestId > lastSeenTicketId) lastSeenTicketId = newestId;
      watchStarted = true;
    }catch(e){ console.warn('ticket watch failed', e); }
  }

  function startSupervisorTicketWatcher(){
    const u=session();
    if(!u || u.role !== 'supervisor') return;
    ensureTicketNoticeUI();
    updateSupervisorTicketBadge();
    const currentMax = (data.tickets||[]).reduce((m,t)=>Math.max(m, Number(t.id||0)), 0);
    if(!lastSeenTicketId) lastSeenTicketId = currentMax;
    watchStarted = true;
    if(ticketWatchTimer) clearInterval(ticketWatchTimer);
    ticketWatchTimer = setInterval(()=>pollSupervisorTickets(false), 20000);
  }

  const oldRenderTicketsV13 = window.renderTickets;
  window.renderTickets = function(){
    if(typeof oldRenderTicketsV13 === 'function') oldRenderTicketsV13();
    updateSupervisorTicketBadge();
  };

  const oldShowSupervisorWindowV13 = window.showSupervisorWindow;
  window.showSupervisorWindow = function(id, btn){
    if(typeof oldShowSupervisorWindowV13 === 'function') oldShowSupervisorWindowV13(id, btn);
    if(id === 'supTickets'){
      pollSupervisorTickets(true);
    }
  };

  const oldInitSupervisorV13 = window.initSupervisor;
  window.initSupervisor = async function(){
    await oldInitSupervisorV13();
    ensureTicketNoticeUI();
    updateSupervisorTicketBadge();
    startSupervisorTicketWatcher();
  };
})();

/* ===== V15: Technician ticket workspace ===== */
(function(){
  function tNo(t){ return t.ticket_number || ('T-' + String(t.id||0).padStart(4,'0')); }
  function statusLabel(status){ return status==='closed'?'مغلق':(status==='processing'?'تحت المعالجة':'مفتوح'); }
  function priorityLabel(p){ return p==='urgent'?'عاجل':(p==='high'?'مهم':(p==='low'?'منخفض':'عادي')); }
  function shortText(s, n=80){ s=String(s||''); return s.length>n ? esc(s.slice(0,n))+'…' : esc(s||'-'); }
  function d(v){ const x=v?new Date(v):null; return x&&!isNaN(x)?x:null; }
  function between(a,b){ const da=d(a), db=d(b); if(!da||!db)return 0; return Math.max(0, Math.round((db-da)/60000)); }
  function dur(min){ min=Number(min||0); if(!min)return '0د'; const day=Math.floor(min/1440), h=Math.floor((min%1440)/60), m=min%60; const arr=[]; if(day)arr.push(day+'ي'); if(h)arr.push(h+'س'); if(m||!arr.length)arr.push(m+'د'); return arr.join(' '); }
  function openMins(t){ return t.status==='closed' ? (Number(t.open_duration_minutes||0)||between(t.created_at,t.closed_at)) : between(t.created_at,new Date().toISOString()); }
  function rowClass(t){ if(t.status==='closed') return 'ticket-row-closed'; if(t.status==='processing') return 'ticket-row-processing'; if(t.priority==='urgent'||t.priority==='high') return 'ticket-row-urgent'; return 'ticket-row-normal'; }
  function badge(t){ const cls=t.status==='closed'?'green':(t.status==='processing'?'amber':((t.priority==='urgent'||t.priority==='high')?'red':'pink')); return `<span class="badge ${cls}">${statusLabel(t.status)}</span>`; }
  function pri(t){ const cls=t.priority==='urgent'?'red':(t.priority==='high'?'amber':'pink'); return `<span class="badge ${cls}">${priorityLabel(t.priority)}</span>`; }
  function currentTechName(){ const u=session(); return (u && (u.full_name || u.username)) || 'فني'; }
  function filterRows(kind){
    const u=session(); if(!u) return [];
    let rows=[...(data.tickets||[])];
    const q=($('techTicketSearch')?.value||'').trim().toLowerCase();
    const st=$('techTicketStatus')?.value||'';
    if(st) rows=rows.filter(t=>t.status===st);
    if(q) rows=rows.filter(t=>[tNo(t),t.title,t.description,projectName(t.project_id),statusLabel(t.status),t.claimed_by_name,t.closed_by_name,t.closure_note].join(' ').toLowerCase().includes(q));
    if(kind==='open') rows=rows.filter(t=>t.status!=='closed' && !t.claimed_by);
    if(kind==='mine') rows=rows.filter(t=>String(t.claimed_by||'')===String(u.id) && t.status!=='closed');
    if(kind==='done') rows=rows.filter(t=>String(t.closed_by||'')===String(u.id) || (t.status==='closed' && String(t.closed_by_name||'')===String(currentTechName())));
    return rows.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
  }
  function renderTechList(kind, bodyId){
    const b=$(bodyId); if(!b) return;
    const rows=filterRows(kind);
    b.innerHTML = rows.map(t=>`<tr class="${rowClass(t)}"><td><b>${esc(tNo(t))}</b></td><td>${esc(projectName(t.project_id))}</td><td>${esc(t.title||'-')}</td><td style="white-space:normal;min-width:180px">${shortText(t.description)}</td><td>${pri(t)}</td><td>${badge(t)}</td><td>${esc(dur(openMins(t)))}</td><td>${esc(t.claimed_by_name||'-')}<br><small>${t.claimed_at?fmt(t.claimed_at):''}</small></td><td>${esc(t.closed_by_name||'-')}<br><small>${t.closed_at?fmt(t.closed_at):''}</small></td><td style="white-space:normal;min-width:180px">${shortText(t.closure_note)}</td><td class="row-actions">${t.status==='closed'?'':`${!t.claimed_by?`<button onclick="techClaimTicket(${t.id})">استلام</button>`:''}<button onclick="techCloseTicket(${t.id})">إغلاق</button>`}</td></tr>`).join('') || '<tr><td colspan="11">لا توجد تكتات</td></tr>';
  }
  window.renderTechnicianTickets = function(){ renderTechList('open','techOpenTicketsBody'); renderTechList('mine','techMyTicketsBody'); renderTechList('done','techDoneTicketsBody'); updateTechKpis(); };
  function updateTechKpis(){ const u=session(); if(!$('techOpenCount')) return; $('techOpenCount').textContent=(data.tickets||[]).filter(t=>t.status!=='closed'&&!t.claimed_by).length; $('techMineCount').textContent=(data.tickets||[]).filter(t=>String(t.claimed_by||'')===String(u?.id||'')&&t.status!=='closed').length; $('techDoneCount').textContent=(data.tickets||[]).filter(t=>String(t.closed_by||'')===String(u?.id||'')).length; }
  window.showTechWindow = function(id, btn){ document.querySelectorAll('.tech-page').forEach(p=>p.classList.remove('active')); $(id)?.classList.add('active'); document.querySelectorAll('.tech-tab').forEach(b=>b.classList.remove('active')); btn?.classList.add('active'); renderTechnicianTickets(); };
  window.initTechnician = async function(){ const u=requireRole('technician'); if(!u) return; await loadAll(); if($('techTitle')) $('techTitle').textContent='لوحة الفني - '+(u.full_name||u.username); renderTechnicianTickets(); setInterval(async()=>{ await loadAll(); renderTechnicianTickets(); }, 20000); };
  window.techClaimTicket = async function(id){ const u=session(); if(!u) return msg('سجل الدخول أولاً','err'); const t=(data.tickets||[]).find(x=>String(x.id)===String(id)); if(!t) return msg('التكت غير موجود','err'); if(t.status==='closed') return msg('التكت مغلق','err'); if(t.claimed_by && String(t.claimed_by)!==String(u.id)) return msg('هذا التكت مستلم بواسطة '+(t.claimed_by_name||'شخص آخر'),'err'); const now=new Date().toISOString(); const name=currentTechName(); const {error}=await sb.from('tickets').update({status:'processing',claimed_by:u.id,claimed_by_name:name,claimed_at:t.claimed_at||now,updated_at:now}).eq('id',id); if(error) return msg(error.message,'err'); playAppSound('ticket'); msg('تم استلام التكت بواسطة '+name); await loadAll(); renderTechnicianTickets(); };
  window.techCloseTicket = async function(id){ const u=session(); if(!u) return msg('سجل الدخول أولاً','err'); const t=(data.tickets||[]).find(x=>String(x.id)===String(id)); if(!t) return msg('التكت غير موجود','err'); if(t.status==='closed') return msg('التكت مغلق بالفعل','err'); const note=prompt('كيف تم إغلاق التكت؟\nاكتب الإجراء المنفذ بالتفصيل'); if(!note || !note.trim()) return msg('لا يمكن إغلاق التكت بدون ذكر كيف تم الإغلاق','err'); const now=new Date().toISOString(); const name=currentTechName(); const row={status:'closed',closed_at:now,closed_by:u.id,closed_by_name:name,closure_note:note.trim(),open_duration_minutes:between(t.created_at,now),processing_duration_minutes:t.claimed_at?between(t.claimed_at,now):null,updated_at:now}; if(!t.claimed_at){ row.claimed_by=u.id; row.claimed_by_name=name; row.claimed_at=now; } const {error}=await sb.from('tickets').update(row).eq('id',id); if(error) return msg(error.message,'err'); playAppSound('ticket'); msg('تم إغلاق التكت وحفظ طريقة الإغلاق'); await loadAll(); renderTechnicianTickets(); };
})();

/* ===== V15.1: Supervisor window buttons fix ===== */
window.showSupervisorWindow = function(id, btn){
  document.querySelectorAll('.sup-page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(id);
  if(page) page.classList.add('active');
  document.querySelectorAll('.sup-tab').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  if(id === 'supTickets' && typeof renderTickets === 'function') renderTickets();
  if(id === 'supSummary' && typeof renderSupervisorDailySummary === 'function') renderSupervisorDailySummary();
};

/* ===== V15.2: Fix supervisor daily summary ===== */
(function(){
  function parseDateSafe(v){
    if(!v) return null;
    const d = new Date(v);
    return isNaN(d) ? null : d;
  }
  function dateOfLog(l){ return l.log_date || String(l.check_in || '').slice(0,10) || ''; }
  function sameDate(a,b){ return String(a||'') === String(b||''); }
  function addDays(dateObj, days){ const d = new Date(dateObj); d.setDate(d.getDate()+days); return d; }
  function localDateStr(d){
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,'0');
    const day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function supervisorSummaryRange(){
    const mode = document.getElementById('summaryRange')?.value || 'today';
    const custom = document.getElementById('summaryDate')?.value;
    const now = new Date();
    const todayStr = localDateStr(now);
    if(mode === 'custom'){
      const d = custom || todayStr;
      return {start:d, end:d, label:d};
    }
    if(mode === 'yesterday'){
      const d = localDateStr(addDays(now,-1));
      return {start:d, end:d, label:'أمس'};
    }
    if(mode === 'week'){
      const start = localDateStr(addDays(now,-6));
      return {start, end:todayStr, label:'آخر 7 أيام'};
    }
    return {start:todayStr, end:todayStr, label:'اليوم'};
  }
  function inRangeDate(ds, range){ return ds && ds >= range.start && ds <= range.end; }
  function ticketStatusClosed(t){ return (t.status || 'open') === 'closed'; }
  function durationText(mins){
    mins = Number(mins || 0);
    const h = Math.floor(mins / 60), m = mins % 60;
    if(h && m) return `${h}س ${m}د`;
    if(h) return `${h}س`;
    return `${m}د`;
  }
  function summaryCard(label, value){
    return `<div class="summary-card-mini"><small>${esc(label)}</small><b>${esc(value)}</b></div>`;
  }
  window.renderSupervisorDailySummary = function(){
    const cards = document.getElementById('supervisorSummaryCards');
    const body = document.getElementById('supervisorSummaryBody');
    if(!cards && !body) return;
    const u = session && session();
    const range = supervisorSummaryRange();
    if(document.getElementById('summaryRange')?.value !== 'custom' && document.getElementById('summaryDate')){
      // Keep custom field available but do not override it every time.
    }

    const logs = (data.logs || []).filter(l => {
      const ds = dateOfLog(l);
      const bySupervisor = !u || !l.supervisor_id || String(l.supervisor_id) === String(u.id);
      return bySupervisor && inRangeDate(ds, range);
    });
    const workMinutes = logs.reduce((sum,l)=>{
      const saved = Number(l.duration_minutes || 0);
      const calc = (typeof minutesBetween === 'function') ? minutesBetween(l.check_in, l.check_out) : 0;
      return sum + (saved > 0 ? saved : calc);
    },0);
    const travelMinutes = logs.reduce((sum,l)=> sum + Number(l.travel_minutes || 0), 0);

    const attendance = (data.attendance || []).filter(a => {
      const ds = a.attendance_date || String(a.created_at || '').slice(0,10);
      const bySupervisor = !u || !a.supervisor_id || String(a.supervisor_id) === String(u.id);
      return bySupervisor && inRangeDate(ds, range);
    });
    const present = attendance.filter(a => a.status === 'present').length;
    const absent = attendance.filter(a => a.status === 'absent').length;

    const tickets = (data.tickets || []).filter(t => {
      const ds = String(t.created_at || '').slice(0,10);
      return inRangeDate(ds, range);
    });
    const openTickets = tickets.filter(t => !ticketStatusClosed(t)).length;
    const closedTickets = tickets.filter(ticketStatusClosed).length;

    if(cards){
      cards.innerHTML = [
        summaryCard('عدد التسجيلات', logs.length),
        summaryCard('ساعات العمل', durationText(workMinutes)),
        summaryCard('وقت التنقل', durationText(travelMinutes)),
        summaryCard('الحضور', present),
        summaryCard('الغياب', absent),
        summaryCard('التكتات المفتوحة', openTickets),
        summaryCard('التكتات المغلقة', closedTickets),
        summaryCard('الفترة', range.label)
      ].join('');
    }
    if(body){
      const rows = [
        ['عدد تسجيلات الدخول والخروج', logs.length],
        ['إجمالي ساعات العمل', durationText(workMinutes)],
        ['إجمالي وقت التنقل', durationText(travelMinutes)],
        ['عدد الحضور', present],
        ['عدد الغياب', absent],
        ['التكتات المفتوحة', openTickets],
        ['التكتات المغلقة', closedTickets]
      ];
      body.innerHTML = rows.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('');
    }
  };

  const prevShowSupervisorWindowV152 = window.showSupervisorWindow;
  window.showSupervisorWindow = function(id, btn){
    if(typeof prevShowSupervisorWindowV152 === 'function') prevShowSupervisorWindowV152(id, btn);
    if(id === 'supSummary') window.renderSupervisorDailySummary();
  };

  const prevInitSupervisorV152 = window.initSupervisor;
  window.initSupervisor = async function(){
    if(typeof prevInitSupervisorV152 === 'function') await prevInitSupervisorV152();
    if(document.getElementById('supSummary')?.classList.contains('active')) window.renderSupervisorDailySummary();
  };
})();

/* V18 عقود المشاريع وتنبيهات نهاية العقد */
(function(){
  const $safe = (id)=>document.getElementById(id);
  function isoDate(d){ if(!d) return ''; return String(d).slice(0,10); }
  function parseDateOnly(s){ if(!s) return null; const parts=String(s).slice(0,10).split('-').map(Number); if(parts.length!==3||!parts[0]) return null; return new Date(parts[0], parts[1]-1, parts[2]); }
  function daysLeft(end){ const e=parseDateOnly(end); if(!e) return null; const t=new Date(); const today=new Date(t.getFullYear(),t.getMonth(),t.getDate()); return Math.ceil((e-today)/86400000); }
  function contractInfo(p){
    const d=daysLeft(p.contract_end);
    if(d===null) return {key:'missing', text:'بيانات ناقصة', cls:'amber', days:'-'};
    if(d < 0) return {key:'expired', text:'منتهي', cls:'red', days:'منتهي'};
    if(d <= 30) return {key:'soon', text:'قريب الانتهاء', cls:'amber', days:d + ' يوم'};
    return {key:'active', text:'نشط', cls:'green', days:d + ' يوم'};
  }
  function esc2(x){ try{return typeof esc==='function'?esc(x):String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}catch(_){return x||'';} }
  function badgeContract(p){ const c=contractInfo(p); return `<span class="badge ${c.cls}">${c.text}</span>`; }


  async function recalcProjectDailyLogs(projectId, projectRow){
    projectId = Number(projectId || 0);
    if(!projectId || !projectRow) return {updated:0, failed:0};
    const q = await sb.from('time_logs').select('*').eq('project_id', projectId);
    if(q.error){ console.warn(q.error.message); return {updated:0, failed:1}; }
    const logs = q.data || [];
    let updated = 0, failed = 0;
    for(const l of logs){
      const logDate = (l.log_date || String(l.check_in||'').slice(0,10));
      const day = logDate ? new Date(logDate+'T00:00:00').getDay() : null;
      const required = day === 5 ? Number(projectRow.friday_minutes || 0) : Number(projectRow.required_daily_minutes || 0);
      const actual = Number(l.duration_minutes || minutesBetween(l.check_in, l.check_out));
      const ts = calcTimeStatus(actual, required);
      const upd = {
        required_minutes: required,
        duration_minutes: actual,
        time_difference_minutes: ts.diff,
        time_status: ts.status
      };
      const r = await sb.from('time_logs').update(upd).eq('id', l.id);
      if(r.error){ failed++; console.warn(r.error.message); } else updated++;
    }
    return {updated, failed};
  }

  const oldSaveProject = window.saveProject;
  window.saveProject = async function(){
    const id=$safe('projectId')?.value;
    const row={
      name:$safe('projectName')?.value?.trim(),
      location:$safe('projectLocation')?.value?.trim(),
      supervisor_id:Number($safe('projectSupervisor')?.value)||null,
      buildings_count:Number($safe('projectBuildingsCount')?.value)||0,
      units_count:Number($safe('projectUnitsCount')?.value)||0,
      contract_start:$safe('projectContractStart')?.value||null,
      contract_end:$safe('projectContractEnd')?.value||null,
      required_daily_minutes:Number($safe('projectRequiredDaily')?.value||180),
      friday_minutes:Number($safe('projectFridayMinutes')?.value||90),
      operation_type:$safe('projectOperationType')?.value||'daily_visit',
      visit_type_default:$safe('projectVisitDefault')?.value||'surface',
      status:$safe('projectStatus')?.value||'active',
      notes:$safe('projectNotes')?.value||''
    };
    if(!row.name) return msg('اسم المشروع مطلوب','err');
    const res=id?await sb.from('projects').update(row).eq('id',id):await sb.from('projects').insert(row);
    if(res.error) return msg(res.error.message,'err');
    if(id){
      const rr = await recalcProjectDailyLogs(id, row);
      msg('تم تحديث المشروع وتحديث الوقت المطلوب في السجلات اليومية' + (rr.updated ? ` (${rr.updated} سجل)` : ''));
    } else {
      msg('تم حفظ المشروع');
    }
    if(typeof clearProjectForm==='function') clearProjectForm();
    await refreshAll();
  };

  const oldEditProject = window.editProject;
  window.editProject = function(id){
    const p=(data.projects||[]).find(x=>String(x.id)===String(id));
    if(!p) return;
    if(typeof oldEditProject==='function') oldEditProject(id);
    if($safe('projectBuildingsCount')) $safe('projectBuildingsCount').value=p.buildings_count||0;
    if($safe('projectUnitsCount')) $safe('projectUnitsCount').value=p.units_count||0;
    if($safe('projectContractStart')) $safe('projectContractStart').value=isoDate(p.contract_start);
    if($safe('projectContractEnd')) $safe('projectContractEnd').value=isoDate(p.contract_end);
  };

  const oldClearProjectForm = window.clearProjectForm;
  window.clearProjectForm = function(){
    if(typeof oldClearProjectForm==='function') oldClearProjectForm();
    if($safe('projectBuildingsCount')) $safe('projectBuildingsCount').value=0;
    if($safe('projectUnitsCount')) $safe('projectUnitsCount').value=0;
    if($safe('projectContractStart')) $safe('projectContractStart').value='';
    if($safe('projectContractEnd')) $safe('projectContractEnd').value='';
  };

  window.renderContractAlerts = function(){
    const projects=data.projects||[];
    const relevant=projects.map(p=>({p,c:contractInfo(p)})).filter(x=>['soon','expired','missing'].includes(x.c.key));
    const html = relevant.sort((a,b)=>{
      const da=daysLeft(a.p.contract_end); const db=daysLeft(b.p.contract_end);
      return (da??99999)-(db??99999);
    }).map(x=>`<div class="alert-item ${x.c.key==='expired'?'danger':'warn'}"><b>${esc2(x.p.name)}</b><br>نهاية العقد: ${esc2(isoDate(x.p.contract_end)||'-')}<br>المتبقي: ${x.c.days} - ${x.c.text}</div>`).join('') || '<div class="alert-item">لا توجد عقود قريبة الانتهاء خلال 30 يوم</div>';
    if($safe('contractDashboardAlerts')) $safe('contractDashboardAlerts').innerHTML=html;
    if($safe('contractsAlertsList')) $safe('contractsAlertsList').innerHTML=html;
  };

  window.renderContracts = function(){
    const body=$safe('contractsBody');
    if(!body) return;
    const q=($safe('contractSearch')?.value||'').trim();
    const st=$safe('contractFilterStatus')?.value||'';
    let rows=[...(data.projects||[])];
    if(q) rows=rows.filter(p=>String(p.name||'').includes(q));
    if(st) rows=rows.filter(p=>contractInfo(p).key===st);
    rows.sort((a,b)=>{ const da=daysLeft(a.contract_end); const db=daysLeft(b.contract_end); return (da??999999)-(db??999999); });
    body.innerHTML=rows.map(p=>{ const c=contractInfo(p); return `<tr><td><b>${esc2(p.name)}</b></td><td>${p.buildings_count||0}</td><td>${p.units_count||0}</td><td>${esc2(isoDate(p.contract_start)||'-')}</td><td>${esc2(isoDate(p.contract_end)||'-')}</td><td>${c.days}</td><td><span class="badge ${c.cls}">${c.text}</span></td><td><button onclick="showPage('projects', document.querySelector(\`.nav[onclick*=projects]\`)); setTimeout(()=>editProject(${p.id}),50)">تعديل</button></td></tr>`; }).join('') || '<tr><td colspan="8">لا توجد بيانات</td></tr>';
    if($safe('contractsActiveCount')) $safe('contractsActiveCount').textContent=(data.projects||[]).filter(p=>contractInfo(p).key==='active').length;
    if($safe('contractsSoonCount')) $safe('contractsSoonCount').textContent=(data.projects||[]).filter(p=>contractInfo(p).key==='soon').length;
    if($safe('contractsExpiredCount')) $safe('contractsExpiredCount').textContent=(data.projects||[]).filter(p=>contractInfo(p).key==='expired').length;
    if($safe('contractsMissingCount')) $safe('contractsMissingCount').textContent=(data.projects||[]).filter(p=>contractInfo(p).key==='missing').length;
  };

  window.renderProjects = function(){
    const b=$safe('projectsBody'); if(!b) return;
    const q=($safe('projectSearch')?.value||'').trim(), sid=$safe('projectFilterSupervisor')?.value, st=$safe('projectFilterStatus')?.value;
    let rows=data.projects||[];
    if(q) rows=rows.filter(p=>[p.name,p.location,supervisorName(p.supervisor_id),p.notes].join(' ').includes(q));
    if(sid) rows=rows.filter(p=>String(p.supervisor_id)===String(sid));
    if(st) rows=rows.filter(p=>(p.status||'active')===st);
    b.innerHTML=rows.map(p=>{ const c=contractInfo(p); return `<tr><td><b>${esc2(p.name)}</b><br><small>${esc2(p.location||'')}</small></td><td>${esc2(supervisorName(p.supervisor_id))}</td><td>${p.buildings_count||0}</td><td>${p.units_count||0}</td><td>${esc2(isoDate(p.contract_end)||'-')}</td><td>${c.days}</td><td><span class="badge ${c.cls}">${c.text}</span></td><td>${minsToText(p.required_daily_minutes??180)}</td><td><span class="badge ${p.status==='inactive'?'red':'green'}">${p.status==='inactive'?'متوقف':'نشط'}</span></td><td class="row-actions"><button onclick="editProject(${p.id})">تعديل</button><button class="light" onclick="openProjectManager(${p.id})">إدارة المشروع</button><button class="light" onclick="toggleProjectStatus(${p.id})">${p.status==='inactive'?'تفعيل':'إيقاف'}</button><button class="danger" onclick="deleteRow('projects',${p.id})">حذف</button></td></tr>`; }).join('')||'<tr><td colspan="10">لا توجد بيانات</td></tr>';
    if(typeof renderProjectManager==='function') renderProjectManager();
    renderContracts(); renderContractAlerts();
  };

  const oldRenderDashboard = window.renderDashboard;
  window.renderDashboard = function(){ if(typeof oldRenderDashboard==='function') oldRenderDashboard(); renderContractAlerts(); };
  const oldRenderAll = window.renderAll;
  window.renderAll = function(){ if(typeof oldRenderAll==='function') oldRenderAll(); renderContracts(); renderContractAlerts(); };
})();

/* ===== V42: Clear WhatsApp column for tickets ===== */
(function(){
  function _e(v){return (typeof esc==='function'?esc(v):String(v??''));}
  function _no(t){return t.ticket_number || ('T-' + String(t.id||0).padStart(4,'0'));}
  function _status(s){return s==='closed'?'مغلق':(s==='processing'?'تحت المعالجة':'مفتوح');}
  function _priority(p){return p==='urgent'?'عاجل':(p==='high'?'مهم':(p==='low'?'منخفض':'عادي'));}
  function _short(s,n=90){s=String(s||'');return s.length>n?_e(s.slice(0,n))+'…':_e(s||'-');}
  function _date(v){const d=v?new Date(v):new Date();const x=isNaN(d)?new Date():d;return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');}
  function _time(v){const d=v?new Date(v):new Date();const x=isNaN(d)?new Date():d;let h=x.getHours();const m=String(x.getMinutes()).padStart(2,'0');const ap=h>=12?'م':'ص';h=h%12||12;return String(h).padStart(2,'0')+':'+m+' '+ap;}
  function _between(a,b){const da=a?new Date(a):null,db=b?new Date(b):null;if(!da||!db||isNaN(da)||isNaN(db))return 0;return Math.max(0,Math.round((db-da)/60000));}
  function _dur(min){min=Number(min||0);if(!min)return '0د';const d=Math.floor(min/1440),h=Math.floor((min%1440)/60),m=min%60;const p=[];if(d)p.push(d+'ي');if(h)p.push(h+'س');if(m||!p.length)p.push(m+'د');return p.join(' ');}
  function _openMins(t){return t.status==='closed'?(Number(t.open_duration_minutes||0)||_between(t.created_at,t.closed_at)):_between(t.created_at,new Date().toISOString());}
  function _row(t){if(t.status==='closed')return 'ticket-row-closed';if(t.status==='processing')return 'ticket-row-processing';if(t.priority==='urgent'||t.priority==='high')return 'ticket-row-urgent';return 'ticket-row-normal';}
  function _sb(t){const cls=t.status==='closed'?'green':(t.status==='processing'?'amber':((t.priority==='urgent'||t.priority==='high')?'red':'pink'));return `<span class="badge ${cls}">${_status(t.status)}</span>`;}
  function _pb(t){const cls=t.priority==='urgent'?'red':(t.priority==='high'?'amber':'pink');return `<span class="badge ${cls}">${_priority(t.priority)}</span>`;}
  function _proj(t){return (typeof projectName==='function'?projectName(t.project_id):'') || t.project_name || '-';}
  function _problem(t){return t.description || t.title || '-';}
  window.buildTicketWhatsAppTextV42=function(t){const closed=t.status==='closed';const v=closed?(t.closed_at||t.updated_at):t.created_at;return [(closed?'تم إغلاق التكت':'تم تسجيل تكت جديد'),'','اسم المشروع: '+_proj(t),'رقم التكت: '+_no(t),'وصف المشكلة: '+_problem(t),'حالة المشكلة: '+(closed?'مغلق':_status(t.status)),'التاريخ: '+_date(v),'الوقت: '+_time(v)].join('\n');};
  function _copy(text){if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(text).catch(()=>{});const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(e){}ta.remove();return Promise.resolve();}
  window.sendTicketWhatsApp=function(id){const t=(data.tickets||[]).find(x=>String(x.id)===String(id));if(!t)return msg('التكت غير موجود','err');const text=window.buildTicketWhatsAppTextV42(t);_copy(text).finally(()=>{window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank');msg(t.status==='closed'?'تم تجهيز رسالة إغلاق التكت للواتساب':'تم تجهيز رسالة فتح التكت للواتساب');});};
  function _wab(t){return `<button class="wa-ticket-btn-v42" onclick="sendTicketWhatsApp(${t.id})">واتساب<br><small>${t.status==='closed'?'إغلاق التكت':'فتح التكت'}</small></button>`;}
  window.renderTickets=function(){const adminBody=$('ticketsBody'),supBody=$('supTicketsBody');if(!adminBody&&!supBody)return;const rows=[...(data.tickets||[])];
    if(adminBody){const st=$('ticketFilterStatus')?.value||'',q=($('ticketSearch')?.value||'').trim().toLowerCase();let list=rows;if(st)list=list.filter(t=>t.status===st);if(q)list=list.filter(t=>[_no(t),t.title,t.description,_proj(t),supervisorName(t.supervisor_id),_status(t.status),t.claimed_by_name,t.closed_by_name,t.closure_note].join(' ').toLowerCase().includes(q));adminBody.innerHTML=list.map(t=>`<tr class="${_row(t)}"><td><b>${_e(_no(t))}</b></td><td>${_e(_proj(t))}</td><td>${_e(supervisorName(t.supervisor_id))}</td><td>${_e(t.title||'-')}</td><td style="white-space:normal;min-width:220px">${_short(t.description)}</td><td>${_pb(t)}</td><td>${_sb(t)}</td><td>${fmt(t.created_at)}</td><td>${_e(_dur(_openMins(t)))}</td><td>${_e(t.claimed_by_name||'-')}<br><small>${t.claimed_at?fmt(t.claimed_at):''}</small></td><td>${_e(t.closed_by_name||'-')}<br><small>${t.closed_at?fmt(t.closed_at):''}</small></td><td style="white-space:normal;min-width:220px">${_short(t.closure_note)}</td><td class="whatsapp-col">${_wab(t)}</td><td class="row-actions"><button onclick="editTicket(${t.id})">تعديل</button>${t.status==='closed'?`<button class="light" onclick="setTicketStatus(${t.id},'open')">إعادة فتح</button>`:`${t.status!=='processing'?`<button class="light" onclick="claimTicket(${t.id})">استلام</button>`:''}<button onclick="closeTicket(${t.id})">إغلاق</button>`}<button class="danger" onclick="deleteRow('tickets',${t.id})">حذف</button></td></tr>`).join('')||'<tr><td colspan="14">لا توجد تكتات</td></tr>';}
    if(supBody){const st=$('supTicketFilterStatus')?.value||'',pid=$('supTicketFilterProject')?.value||'',q=($('supTicketSearch')?.value||'').trim().toLowerCase();let list=rows;if(pid)list=list.filter(t=>String(t.project_id)===String(pid));if(st)list=list.filter(t=>t.status===st);if(q)list=list.filter(t=>[_no(t),t.title,t.description,_proj(t),_status(t.status),t.claimed_by_name,t.closed_by_name,t.closure_note].join(' ').toLowerCase().includes(q));supBody.innerHTML=list.map(t=>`<tr class="${_row(t)}"><td><b>${_e(_no(t))}</b></td><td>${_e(_proj(t))}</td><td>${_e(t.title||'-')}</td><td style="white-space:normal;min-width:180px">${_short(t.description)}</td><td>${_pb(t)}</td><td>${_sb(t)}</td><td>${_e(_dur(_openMins(t)))}</td><td>${_e(t.claimed_by_name||'-')}</td><td>${_e(t.closed_by_name||'-')}</td><td style="white-space:normal;min-width:180px">${_short(t.closure_note)}</td><td class="whatsapp-col">${_wab(t)}</td><td class="row-actions"><button onclick="editTicket(${t.id})">تعديل</button>${t.status==='closed'?`<button class="light" onclick="setTicketStatus(${t.id},'open')">إعادة فتح</button>`:`${t.status!=='processing'?`<button class="light" onclick="claimTicket(${t.id})">استلام</button>`:''}<button onclick="closeTicket(${t.id})">إغلاق</button>`}</td></tr>`).join('')||'<tr><td colspan="12">لا توجد تكتات</td></tr>';}
  };
  const css=document.createElement('style');css.textContent='.wa-ticket-btn-v42{background:#128C7E!important;color:white!important;border:0!important;border-radius:10px!important;padding:8px 10px!important;line-height:1.25!important;min-width:110px!important;font-weight:700!important}.wa-ticket-btn-v42 small{font-weight:500;font-size:10px;color:white!important}.whatsapp-col{white-space:nowrap;text-align:center!important}';document.head.appendChild(css);
})();

/* ===== V43: Force WhatsApp button in supervisor tickets too ===== */
(function(){
  function _safeTicketNo(t){return t.ticket_number || ('T-' + String(t.id||0).padStart(4,'0'));}
  function _statusLabel43(s){return s==='closed'?'مغلق':(s==='processing'?'تحت المعالجة':'مفتوح');}
  function _date43(v){try{const d=v?new Date(v):new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}catch(e){return '';}}
  function _time43(v){try{const d=v?new Date(v):new Date();return d.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});}catch(e){return '';}}
  function _project43(t){try{return projectName(t.project_id)||t.project_name||'-';}catch(e){return t.project_name||'-';}}
  function _msg43(t){const closed=t.status==='closed';const dt=closed?(t.closed_at||t.updated_at||t.created_at):(t.created_at||t.updated_at);return [closed?'تم إغلاق التكت':'تم تسجيل تكت جديد','',`اسم المشروع: ${_project43(t)}`,`رقم التكت: ${_safeTicketNo(t)}`,`وصف المشكلة: ${t.description||t.title||'-'}`,`حالة المشكلة: ${closed?'مغلق':_statusLabel43(t.status)}`,`التاريخ: ${_date43(dt)}`,`الوقت: ${_time43(dt)}`].join('\n');}
  window.sendTicketWhatsAppV43=function(id){const t=(data.tickets||[]).find(x=>String(x.id)===String(id)); if(!t){ if(typeof msg==='function') msg('التكت غير موجود','err'); return; } const txt=_msg43(t); const go=function(){window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank'); if(typeof msg==='function') msg(t.status==='closed'?'تم تجهيز رسالة إغلاق التكت للواتساب':'تم تجهيز رسالة فتح التكت للواتساب');}; if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).finally(go); else go();};
  function _btn43(t){return `<button type="button" class="wa-ticket-btn-v43" onclick="sendTicketWhatsAppV43(${t.id})">واتساب<br><small>${t.status==='closed'?'إغلاق التكت':'فتح التكت'}</small></button>`;}
  function forceSupervisorWhatsApp43(){
    const body=document.getElementById('supTicketsBody'); if(!body) return;
    const rows=Array.from(body.querySelectorAll('tr')); if(!rows.length) return;
    rows.forEach(function(tr,i){
      if((tr.innerText||'').includes('لا توجد')) return;
      if(tr.querySelector('.wa-ticket-btn-v43') || tr.querySelector('.wa-ticket-btn-v42')) return;
      const first=tr.cells&&tr.cells[0]?tr.cells[0].innerText.trim():'';
      let t=(data.tickets||[]).find(function(x){return _safeTicketNo(x)===first;});
      if(!t) t=(data.tickets||[])[i];
      if(!t) return;
      const target=tr.cells[10] || tr.cells[tr.cells.length-1];
      if(target){ target.innerHTML=_btn43(t); target.classList.add('whatsapp-col'); }
    });
  }
  const oldRenderTickets43=window.renderTickets;
  window.renderTickets=function(){ if(typeof oldRenderTickets43==='function') oldRenderTickets43.apply(this,arguments); setTimeout(forceSupervisorWhatsApp43,80); setTimeout(forceSupervisorWhatsApp43,400); };
  const oldShowSupervisorWindow43=window.showSupervisorWindow;
  window.showSupervisorWindow=function(id,btn){ if(typeof oldShowSupervisorWindow43==='function') oldShowSupervisorWindow43.apply(this,arguments); if(id==='supTickets') setTimeout(forceSupervisorWhatsApp43,700); };
  window.addEventListener('load',function(){setTimeout(forceSupervisorWhatsApp43,900);setTimeout(forceSupervisorWhatsApp43,1800);});
  const css=document.createElement('style');css.textContent='.wa-ticket-btn-v43{background:#128C7E!important;color:white!important;border:0!important;border-radius:10px!important;padding:8px 10px!important;line-height:1.25!important;min-width:110px!important;font-weight:700!important;cursor:pointer!important}.wa-ticket-btn-v43 small{font-weight:500;font-size:10px;color:white!important}.whatsapp-col{white-space:nowrap;text-align:center!important}';document.head.appendChild(css);
})();


/* ===== V45: FINAL FIX - Supervisor ticket WhatsApp button ===== */
(function(){
  function _v45Esc(v){return String(v??'').replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
  function _v45No(t){return t.ticket_number || ('T-' + String(t.id||0).padStart(4,'0'));}
  function _v45Status(s){return s==='closed'?'مغلق':(s==='processing'?'تحت المعالجة':'مفتوح');}
  function _v45Priority(p){return p==='urgent'?'عاجل':(p==='high'?'مهم':(p==='low'?'منخفض':'عادي'));}
  function _v45Project(t){try{return projectName(t.project_id)||t.project_name||'-';}catch(e){return t.project_name||'-';}}
  function _v45Short(s,n){s=String(s||'-');return _v45Esc(s.length>(n||90)?s.slice(0,(n||90))+'…':s);}
  function _v45Date(v){try{const d=v?new Date(v):new Date();if(isNaN(d))return '-';return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}catch(e){return '-';}}
  function _v45Time(v){try{const d=v?new Date(v):new Date();if(isNaN(d))return '-';let h=d.getHours();const m=String(d.getMinutes()).padStart(2,'0');const ap=h>=12?'م':'ص';h=h%12||12;return String(h).padStart(2,'0')+':'+m+' '+ap;}catch(e){return '-';}}
  function _v45Mins(a,b){const da=a?new Date(a):null,db=b?new Date(b):new Date();if(!da||isNaN(da)||isNaN(db))return 0;return Math.max(0,Math.round((db-da)/60000));}
  function _v45Dur(m){m=Number(m||0);if(!m)return '0د';const d=Math.floor(m/1440),h=Math.floor((m%1440)/60),mm=m%60;let arr=[];if(d)arr.push(d+'ي');if(h)arr.push(h+'س');if(mm||!arr.length)arr.push(mm+'د');return arr.join(' ');}
  function _v45OpenM(t){return t.status==='closed'?(Number(t.open_duration_minutes||0)||_v45Mins(t.created_at,t.closed_at)):_v45Mins(t.created_at,new Date().toISOString());}
  function _v45Row(t){if(t.status==='closed')return 'ticket-row-closed';if(t.status==='processing')return 'ticket-row-processing';if(t.priority==='urgent'||t.priority==='high')return 'ticket-row-urgent';return 'ticket-row-normal';}
  function _v45Sb(t){const cls=t.status==='closed'?'green':(t.status==='processing'?'amber':((t.priority==='urgent'||t.priority==='high')?'red':'pink'));return '<span class="badge '+cls+'">'+_v45Status(t.status)+'</span>';}
  function _v45Pb(t){const cls=t.priority==='urgent'?'red':(t.priority==='high'?'amber':'pink');return '<span class="badge '+cls+'">'+_v45Priority(t.priority)+'</span>';}
  function _v45Text(t){const closed=t.status==='closed';const v=closed?(t.closed_at||t.updated_at||t.created_at):(t.created_at||t.updated_at);return [closed?'تم إغلاق التكت':'تم تسجيل تكت جديد','','اسم المشروع: '+_v45Project(t),'رقم التكت: '+_v45No(t),'وصف المشكلة: '+(t.description||t.title||'-'),'حالة المشكلة: '+(closed?'مغلق':_v45Status(t.status)),'التاريخ: '+_v45Date(v),'الوقت: '+_v45Time(v)].join('\n');}
  window.sendSupervisorTicketWhatsAppV45=function(id){const t=(data.tickets||[]).find(x=>String(x.id)===String(id));if(!t){if(typeof msg==='function')msg('التكت غير موجود','err');return;}const text=_v45Text(t);const go=()=>{window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank');if(typeof msg==='function')msg(t.status==='closed'?'تم تجهيز رسالة إغلاق التكت للواتساب':'تم تجهيز رسالة فتح التكت للواتساب');};if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).finally(go);else go();};
  function _v45Btn(t){return '<button type="button" class="wa-ticket-btn-v45" onclick="sendSupervisorTicketWhatsAppV45('+t.id+')">واتساب<br><small>'+(t.status==='closed'?'إغلاق التكت':'فتح التكت')+'</small></button>';}
  function renderSupervisorTicketsV45(){
    const body=document.getElementById('supTicketsBody'); if(!body) return false;
    let list=[...(data.tickets||[])];
    const st=document.getElementById('supTicketFilterStatus')?.value||'';
    const pid=document.getElementById('supTicketFilterProject')?.value||'';
    const q=(document.getElementById('supTicketSearch')?.value||'').trim().toLowerCase();
    if(pid) list=list.filter(t=>String(t.project_id)===String(pid));
    if(st) list=list.filter(t=>t.status===st);
    if(q) list=list.filter(t=>[_v45No(t),t.title,t.description,_v45Project(t),_v45Status(t.status),t.claimed_by_name,t.closed_by_name,t.closure_note].join(' ').toLowerCase().includes(q));
    body.innerHTML=list.map(t=>'<tr class="'+_v45Row(t)+'"><td><b>'+_v45Esc(_v45No(t))+'</b></td><td>'+_v45Esc(_v45Project(t))+'</td><td>'+_v45Esc(t.title||'-')+'</td><td style="white-space:normal;min-width:180px">'+_v45Short(t.description,90)+'</td><td>'+_v45Pb(t)+'</td><td>'+_v45Sb(t)+'</td><td>'+_v45Esc(_v45Dur(_v45OpenM(t)))+'</td><td>'+_v45Esc(t.claimed_by_name||'-')+'</td><td>'+_v45Esc(t.closed_by_name||'-')+'</td><td style="white-space:normal;min-width:180px">'+_v45Short(t.closure_note,90)+'</td><td class="whatsapp-col">'+_v45Btn(t)+'</td><td class="row-actions"><button onclick="editTicket('+t.id+')">تعديل</button>'+(t.status==='closed'?'<button class="light" onclick="setTicketStatus('+t.id+',\'open\')">إعادة فتح</button>':((t.status!=='processing'?'<button class="light" onclick="claimTicket('+t.id+')">استلام</button>':'')+'<button onclick="closeTicket('+t.id+')">إغلاق</button>'))+'</td></tr>').join('') || '<tr><td colspan="12">لا توجد تكتات</td></tr>';
    return true;
  }
  const oldRenderTicketsV45=window.renderTickets;
  window.renderTickets=function(){ if(document.getElementById('supTicketsBody')) return renderSupervisorTicketsV45(); if(typeof oldRenderTicketsV45==='function') return oldRenderTicketsV45.apply(this,arguments); };
  const oldShowSupervisorWindowV45=window.showSupervisorWindow;
  window.showSupervisorWindow=function(id,btn){ if(typeof oldShowSupervisorWindowV45==='function') oldShowSupervisorWindowV45.apply(this,arguments); if(id==='supTickets'){setTimeout(renderSupervisorTicketsV45,50);setTimeout(renderSupervisorTicketsV45,300);} };
  const oldInitSupervisorV45=window.initSupervisor;
  window.initSupervisor=async function(){ if(typeof oldInitSupervisorV45==='function') await oldInitSupervisorV45.apply(this,arguments); setTimeout(renderSupervisorTicketsV45,80); setTimeout(renderSupervisorTicketsV45,600); };
  window.renderSupervisorTicketsV45=renderSupervisorTicketsV45;
  const css=document.createElement('style');css.textContent='.wa-ticket-btn-v45{background:#128C7E!important;color:#fff!important;border:0!important;border-radius:10px!important;padding:8px 10px!important;line-height:1.25!important;min-width:110px!important;font-weight:700!important;cursor:pointer!important}.wa-ticket-btn-v45 small{font-weight:500!important;font-size:10px!important;color:#fff!important}.whatsapp-col{text-align:center!important;white-space:nowrap!important}';document.head.appendChild(css);
  window.addEventListener('load',function(){setTimeout(renderSupervisorTicketsV45,1000);setTimeout(renderSupervisorTicketsV45,2200);});
})();


/* ===== V46: Technician can create tickets + WhatsApp buttons ===== */
(function(){
  function _e(v){ return (typeof esc==='function') ? esc(v) : String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function _tNo(t){ return t.ticket_number || ('T-' + String(t.id||0).padStart(4,'0')); }
  function _statusLabel(status){ return status==='closed'?'مغلق':(status==='processing'?'تحت المعالجة':'مفتوح'); }
  function _priorityLabel(p){ return p==='urgent'?'عاجل':(p==='high'?'مهم':(p==='low'?'منخفض':'عادي')); }
  function _short(s,n=80){ s=String(s||''); return s.length>n ? _e(s.slice(0,n))+'…' : _e(s||'-'); }
  function _dateObj(v){ const x=v?new Date(v):null; return x&&!isNaN(x)?x:null; }
  function _between(a,b){ const da=_dateObj(a), db=_dateObj(b); if(!da||!db)return 0; return Math.max(0, Math.round((db-da)/60000)); }
  function _dur(min){ min=Number(min||0); if(!min)return '0د'; const day=Math.floor(min/1440), h=Math.floor((min%1440)/60), m=min%60; const arr=[]; if(day)arr.push(day+'ي'); if(h)arr.push(h+'س'); if(m||!arr.length)arr.push(m+'د'); return arr.join(' '); }
  function _openMins(t){ return t.status==='closed' ? (Number(t.open_duration_minutes||0)||_between(t.created_at,t.closed_at)) : _between(t.created_at,new Date().toISOString()); }
  function _rowClass(t){ if(t.status==='closed') return 'ticket-row-closed'; if(t.status==='processing') return 'ticket-row-processing'; if(t.priority==='urgent'||t.priority==='high') return 'ticket-row-urgent'; return 'ticket-row-normal'; }
  function _badge(t){ const cls=t.status==='closed'?'green':(t.status==='processing'?'amber':((t.priority==='urgent'||t.priority==='high')?'red':'pink')); return `<span class="badge ${cls}">${_statusLabel(t.status)}</span>`; }
  function _pri(t){ const cls=t.priority==='urgent'?'red':(t.priority==='high'?'amber':'pink'); return `<span class="badge ${cls}">${_priorityLabel(t.priority)}</span>`; }
  function _currentTechName(){ const u=session(); return (u && (u.full_name || u.username)) || 'فني'; }
  function _projectName(id){ return (typeof projectName==='function') ? projectName(id) : ((data.projects||[]).find(p=>String(p.id)===String(id))?.name || '-'); }
  function _fmt(v){ return (typeof fmt==='function') ? fmt(v) : (v ? new Date(v).toLocaleString('ar-SA') : ''); }
  function _waBtn(t){
    const fn = window.sendTicketWhatsAppV43 || window.sendTicketWhatsApp;
    if(!fn) return '-';
    return `<button type="button" class="wa-ticket-btn-v46" onclick="${fn===window.sendTicketWhatsAppV43?'sendTicketWhatsAppV43':'sendTicketWhatsApp'}(${t.id})">واتساب<br><small>${t.status==='closed'?'إغلاق التكت':'فتح التكت'}</small></button>`;
  }
  function _filterTechRows(kind){
    const u=session(); if(!u) return [];
    let rows=[...(data.tickets||[])];
    const q=($('techTicketSearch')?.value||'').trim().toLowerCase();
    const st=$('techTicketStatus')?.value||'';
    if(st) rows=rows.filter(t=>t.status===st);
    if(q) rows=rows.filter(t=>[_tNo(t),t.title,t.description,_projectName(t.project_id),_statusLabel(t.status),t.claimed_by_name,t.closed_by_name,t.closure_note].join(' ').toLowerCase().includes(q));
    if(kind==='open') rows=rows.filter(t=>t.status!=='closed' && !t.claimed_by);
    if(kind==='mine') rows=rows.filter(t=>String(t.claimed_by||'')===String(u.id) && t.status!=='closed');
    if(kind==='done') rows=rows.filter(t=>String(t.closed_by||'')===String(u.id) || (t.status==='closed' && String(t.closed_by_name||'')===String(_currentTechName())));
    return rows.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
  }
  function _renderTechList(kind, bodyId){
    const b=$(bodyId); if(!b) return;
    const rows=_filterTechRows(kind);
    b.innerHTML = rows.map(t=>`<tr class="${_rowClass(t)}"><td><b>${_e(_tNo(t))}</b></td><td>${_e(_projectName(t.project_id))}</td><td>${_e(t.title||'-')}</td><td style="white-space:normal;min-width:180px">${_short(t.description)}</td><td>${_pri(t)}</td><td>${_badge(t)}</td><td>${_e(_dur(_openMins(t)))}</td><td>${_e(t.claimed_by_name||'-')}<br><small>${t.claimed_at?_fmt(t.claimed_at):''}</small></td><td>${_e(t.closed_by_name||'-')}<br><small>${t.closed_at?_fmt(t.closed_at):''}</small></td><td style="white-space:normal;min-width:180px">${_short(t.closure_note)}</td><td class="whatsapp-col">${_waBtn(t)}</td><td class="row-actions">${t.status==='closed'?'':`${!t.claimed_by?`<button onclick="techClaimTicket(${t.id})">استلام</button>`:''}<button onclick="techCloseTicket(${t.id})">إغلاق</button>`}</td></tr>`).join('') || '<tr><td colspan="12">لا توجد تكتات</td></tr>';
  }
  function _updateTechKpisV46(){ const u=session(); if(!$('techOpenCount')) return; $('techOpenCount').textContent=(data.tickets||[]).filter(t=>t.status!=='closed'&&!t.claimed_by).length; $('techMineCount').textContent=(data.tickets||[]).filter(t=>String(t.claimed_by||'')===String(u?.id||'')&&t.status!=='closed').length; $('techDoneCount').textContent=(data.tickets||[]).filter(t=>String(t.closed_by||'')===String(u?.id||'')).length; }
  window.renderTechnicianTickets = function(){ _renderTechList('open','techOpenTicketsBody'); _renderTechList('mine','techMyTicketsBody'); _renderTechList('done','techDoneTicketsBody'); _updateTechKpisV46(); };
  window.clearTechnicianTicketForm = function(){
    if($('techNewTicketProject')) $('techNewTicketProject').value='';
    if($('techNewTicketPriority')) $('techNewTicketPriority').value='normal';
    if($('techNewTicketTitle')) $('techNewTicketTitle').value='';
    if($('techNewTicketDescription')) $('techNewTicketDescription').value='';
  };
  window.saveTechnicianTicket = async function(){
    const u=session(); if(!u) return msg('سجل الدخول أولاً','err');
    const projectId=Number($('techNewTicketProject')?.value)||null;
    const title=($('techNewTicketTitle')?.value||'').trim();
    const description=($('techNewTicketDescription')?.value||'').trim();
    const priority=$('techNewTicketPriority')?.value || 'normal';
    if(!projectId) return msg('اختر المشروع','err');
    if(!title) return msg('عنوان المشكلة مطلوب','err');
    const proj=(data.projects||[]).find(p=>String(p.id)===String(projectId));
    const now=new Date().toISOString();
    const row={
      project_id: projectId,
      supervisor_id: Number(proj?.supervisor_id)||null,
      created_by: u.id,
      title,
      description,
      priority,
      status:'open',
      updated_at: now
    };
    const res=await sb.from('tickets').insert(row).select('*').single();
    if(res.error) return msg(res.error.message,'err');
    if(res.data && !res.data.ticket_number){
      const tn='T-'+String(res.data.id).padStart(4,'0');
      await sb.from('tickets').update({ticket_number:tn}).eq('id',res.data.id);
      res.data.ticket_number=tn;
    }
    playAppSound('ticket');
    msg('تم رفع التكت بنجاح');
    clearTechnicianTicketForm();
    await loadAll();
    renderTechnicianTickets();
    // تجهيز رسالة واتساب بعد رفع التكت مباشرة
    setTimeout(()=>{ try{ (window.sendTicketWhatsAppV43||window.sendTicketWhatsApp)?.(res.data.id); }catch(e){} }, 300);
  };
  const _oldInitTech = window.initTechnician;
  window.initTechnician = async function(){
    const u=requireRole('technician'); if(!u) return;
    await loadAll();
    if($('techTitle')) $('techTitle').textContent='لوحة الفني - '+(u.full_name||u.username);
    if($('techNewTicketProject') && typeof fillSelect==='function') fillSelect('techNewTicketProject', data.projects||[], 'name', 'اختر المشروع');
    renderTechnicianTickets();
    if(!window.__techAutoRefreshV46){
      window.__techAutoRefreshV46=setInterval(async()=>{ await loadAll(); if($('techNewTicketProject') && typeof fillSelect==='function' && !$('techNewTicketProject').options.length) fillSelect('techNewTicketProject', data.projects||[], 'name', 'اختر المشروع'); renderTechnicianTickets(); }, 20000);
    }
  };
  const css=document.createElement('style');
  css.textContent='.wa-ticket-btn-v46{background:#128C7E!important;color:#fff!important;border:0!important;border-radius:10px!important;padding:8px 10px!important;line-height:1.25!important;min-width:105px!important;font-weight:700!important}.wa-ticket-btn-v46 small{font-size:10px;color:#fff!important}.whatsapp-col{text-align:center!important;white-space:nowrap}.grid.two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}@media(max-width:760px){.grid.two{grid-template-columns:1fr}}';
  document.head.appendChild(css);
})();

/* ===== V47: Recalculate daily time logs when project required time changes ===== */

/* ===== V52: Professional daily manager PDF report ===== */
function reportEscV52(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function reportDateLabelV52(dateStr){
  if(!dateStr) return '-';
  try { return new Date(dateStr+'T00:00:00').toLocaleDateString('ar-SA',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); }
  catch(e){ return dateStr; }
}
function reportWorkersForProjectV52(projectId){
  const names = new Set();
  (data.workers||[]).forEach(w=>{
    const pid = (typeof workerProjectId==='function') ? workerProjectId(w) : (w.project_id || w.assigned_project_id || '');
    if(String(pid)===String(projectId) && (w.status||'active')!=='inactive') names.add(w.name);
  });
  return [...names].filter(Boolean).join('، ') || '-';
}
function reportTimeStatusValueV52(log, actual, required){
  const diff = actual - required;
  if(diff < -5) return 'under_time';
  if(diff > 5) return 'over_time';
  return 'within_time';
}
function reportStatusArabicV52(status){
  if(status==='under_time' || status==='ناقص وقت') return 'ناقص وقت';
  if(status==='over_time' || status==='زيادة وقت') return 'زيادة وقت';
  if(status==='within_time' || status==='ضمن الوقت') return 'ضمن الوقت';
  return (typeof timeStatusText==='function' ? timeStatusText(status) : (status||'-'));
}
function exportDailyManagerPDF(){
  const rows = (typeof filterLogs==='function' ? filterLogs() : (data.logs||[])).slice().sort((a,b)=>{
    const pa = projectName(a.project_id), pb = projectName(b.project_id);
    if(pa!==pb) return pa.localeCompare(pb,'ar');
    return new Date(a.check_in||a.log_date) - new Date(b.check_in||b.log_date);
  });
  const selectedDate = $('dailyDate')?.value || today();
  const selectedSupervisor = $('dailySupervisor')?.value ? supervisorName($('dailySupervisor').value) : 'الكل';
  const selectedProject = $('dailyProject')?.value ? projectName($('dailyProject').value) : 'الكل';
  if(!rows.length){ msg('لا توجد بيانات لتصدير التقرير اليومي','err'); return; }

  let totalActual=0, totalRequired=0, under=0, over=0, within=0;
  const tableRows = rows.map((l,idx)=>{
    const actual = Number(l.duration_minutes || minutesBetween(l.check_in,l.check_out));
    const required = Number((typeof logRequiredMinutes==='function' ? logRequiredMinutes(l) : l.required_minutes) || 0);
    const diff = actual - required;
    const status = reportTimeStatusValueV52(l, actual, required);
    totalActual += actual; totalRequired += required;
    if(status==='under_time') under++; else if(status==='over_time') over++; else within++;
    const cls = status==='under_time'?'bad':(status==='over_time'?'warn':'ok');
    const workers = reportWorkersForProjectV52(l.project_id);
    return `<tr>
      <td>${idx+1}</td>
      <td>${reportEscV52(supervisorName(l.supervisor_id))}</td>
      <td>${reportEscV52(projectName(l.project_id))}</td>
      <td>${reportEscV52(workers)}</td>
      <td>${reportEscV52(typeof visitTypeText==='function'?visitTypeText(l.visit_type):'')}</td>
      <td>${reportEscV52(timeOnly(l.check_in))}</td>
      <td>${reportEscV52(timeOnly(l.check_out))}</td>
      <td>${reportEscV52(minsToText(required))}</td>
      <td>${reportEscV52(minsToText(actual))}</td>
      <td>${reportEscV52(typeof diffText==='function'?diffText(diff):minsToText(Math.abs(diff)))}</td>
      <td><span class="pill ${cls}">${reportStatusArabicV52(status)}</span></td>
      <td>${reportEscV52(l.notes||'')}</td>
    </tr>`;
  }).join('');
  const totalDiff = totalActual-totalRequired;
  const generatedAt = new Date().toLocaleString('ar-SA');
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير يومي للمدير</title>
  <style>
    @page{size:A4 landscape;margin:12mm}
    *{box-sizing:border-box} body{font-family:Tahoma,Arial,sans-serif;color:#173b33;margin:0;background:#fff;font-size:12px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0b5b4a;padding-bottom:12px;margin-bottom:14px}
    .brand{font-size:22px;font-weight:800;color:#06483b}.sub{font-size:12px;color:#667;margin-top:4px}.title{text-align:left}.title h1{margin:0;font-size:20px;color:#0b5b4a}.title .date{margin-top:6px;color:#444}
    .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.box{border:1px solid #d8e4df;border-radius:12px;padding:10px;background:#f8fbfa}.box b{display:block;color:#0b5b4a;margin-bottom:4px}
    .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:12px 0}.kpi{border-radius:14px;padding:10px;background:#eef7f4;border:1px solid #d4e8e1;text-align:center}.kpi strong{display:block;font-size:18px;color:#063f34}.kpi span{color:#596b66;font-size:11px}
    table{width:100%;border-collapse:collapse;margin-top:10px} th{background:#0b5b4a;color:#fff;padding:8px;border:1px solid #0b5b4a;font-size:11px}td{padding:7px;border:1px solid #dfe8e4;vertical-align:top;text-align:center}tbody tr:nth-child(even){background:#fafdfc}.pill{display:inline-block;padding:4px 8px;border-radius:999px;font-weight:700;font-size:11px}.ok{background:#e6f6ec;color:#116b32}.warn{background:#fff4d8;color:#8a5b00}.bad{background:#ffe5e5;color:#9c1d1d}
    .footer{margin-top:14px;display:flex;justify-content:space-between;color:#666;font-size:11px;border-top:1px solid #dfe8e4;padding-top:8px}.sign{margin-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:20px}.sign div{height:55px;border:1px dashed #b9c9c3;border-radius:10px;padding:8px;color:#666}
    @media print{.no-print{display:none!important} body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style></head><body>
    <div class="header"><div><div class="brand">شركة تصنيف لإدارة المرافق</div><div class="sub">تقرير التشغيل اليومي للإدارة</div></div><div class="title"><h1>تقرير يومي للمدير</h1><div class="date">تاريخ التقرير: ${reportEscV52(reportDateLabelV52(selectedDate))}</div><div class="sub">وقت التصدير: ${reportEscV52(generatedAt)}</div></div></div>
    <div class="meta"><div class="box"><b>المشرف</b>${reportEscV52(selectedSupervisor)}</div><div class="box"><b>المشروع</b>${reportEscV52(selectedProject)}</div><div class="box"><b>عدد السجلات</b>${rows.length}</div><div class="box"><b>معد التقرير</b>لوحة الإدارة</div></div>
    <div class="kpis"><div class="kpi"><strong>${reportEscV52(minsToText(totalActual))}</strong><span>إجمالي الوقت الفعلي</span></div><div class="kpi"><strong>${reportEscV52(minsToText(totalRequired))}</strong><span>إجمالي الوقت المطلوب</span></div><div class="kpi"><strong>${reportEscV52((totalDiff>=0?'زيادة ':'نقص ')+minsToText(Math.abs(totalDiff)))}</strong><span>فرق الوقت</span></div><div class="kpi"><strong>${within}</strong><span>ضمن الوقت</span></div><div class="kpi"><strong>${over} / ${under}</strong><span>زيادة / نقص</span></div></div>
    <table><thead><tr><th>#</th><th>المشرف</th><th>المشروع</th><th>أسماء العمال</th><th>نوع الزيارة</th><th>الدخول</th><th>الخروج</th><th>المطلوب</th><th>الفعلي</th><th>الفرق</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>${tableRows}</tbody></table>
    <div class="sign"><div>اعتماد مدير التشغيل:</div><div>ملاحظات المدير:</div></div>
    <div class="footer"><span>شركة تصنيف لإدارة المرافق</span><span>هذا التقرير مولّد آليًا من نظام التشغيل</span></div>
    <script>window.onload=function(){setTimeout(function(){window.print()},400)}</script>
  </body></html>`;
  const w = window.open('', '_blank');
  if(!w){ msg('المتصفح منع فتح نافذة التقرير. اسمح بالنوافذ المنبثقة','err'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

/* ===== V56: unique worker count + WhatsApp daily report ===== */
function tasneefNormNameV56(v){return String(v||'').trim().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ')}
function uniqueWorkersCountV56(){const s=new Set();(data.workers||[]).forEach(w=>{if(String(w.status||'active').toLowerCase()==='deleted')return;const n=tasneefNormNameV56(w.name);if(n)s.add(n)});return s.size}
(function(){const old=window.renderDashboard;window.renderDashboard=function(){if(typeof old==='function')old();const k=$('kpiWorkers');if(k)k.textContent=uniqueWorkersCountV56()}})();
function uniqueWorkersForProjectTextV56(projectId){const m=new Map();(data.workers||[]).forEach(w=>{const st=String(w.status||'active').toLowerCase();if(st==='deleted'||st==='inactive')return;const pid=(typeof workerProjectId==='function')?workerProjectId(w):(w.project_id||w.assigned_project_id||'');if(String(pid)!==String(projectId))return;const key=tasneefNormNameV56(w.name);if(key&&!m.has(key))m.set(key,String(w.name||'').trim())});return [...m.values()].join('، ')||'-'}
function dailyReportRowsV56(){return (typeof filterLogs==='function'?filterLogs():(data.logs||[])).slice().sort((a,b)=>{const pa=projectName(a.project_id),pb=projectName(b.project_id);if(pa!==pb)return pa.localeCompare(pb,'ar');return new Date(a.check_in||a.log_date)-new Date(b.check_in||b.log_date)})}
function dailyReportWhatsappTextV56(){const rows=dailyReportRowsV56();const date=$('dailyDate')?.value||today();const sup=$('dailySupervisor')?.value?supervisorName($('dailySupervisor').value):'الكل';const proj=$('dailyProject')?.value?projectName($('dailyProject').value):'الكل';let actualTotal=0,reqTotal=0,under=0,over=0,within=0;const lines=['تقرير التشغيل اليومي','شركة تصنيف','المسؤول: وائل شاكر','التاريخ: '+(typeof reportDateLabelV52==='function'?reportDateLabelV52(date):date),'المشرف: '+sup,'المشروع: '+proj,'عدد السجلات: '+rows.length,''];rows.forEach(l=>{const actual=Number(l.duration_minutes||minutesBetween(l.check_in,l.check_out));const req=Number((typeof logRequiredMinutes==='function'?logRequiredMinutes(l):l.required_minutes)||0);const diff=actual-req;actualTotal+=actual;reqTotal+=req;if(diff<-5)under++;else if(diff>5)over++;else within++});lines.push('الملخص:');lines.push('إجمالي الوقت الفعلي: '+minsToText(actualTotal));lines.push('إجمالي الوقت المطلوب: '+minsToText(reqTotal));lines.push('فرق الوقت: '+((actualTotal-reqTotal)>=0?'زيادة ':'نقص ')+minsToText(Math.abs(actualTotal-reqTotal)));lines.push('ضمن الوقت: '+within+' | زيادة: '+over+' | نقص: '+under);lines.push('');lines.push('تفاصيل السجلات:');rows.slice(0,40).forEach((l,i)=>{const actual=Number(l.duration_minutes||minutesBetween(l.check_in,l.check_out));const req=Number((typeof logRequiredMinutes==='function'?logRequiredMinutes(l):l.required_minutes)||0);const diff=actual-req;const st=diff<-5?'ناقص وقت':diff>5?'زيادة وقت':'ضمن الوقت';lines.push((i+1)+') '+projectName(l.project_id)+' | '+supervisorName(l.supervisor_id)+' | العمال: '+uniqueWorkersForProjectTextV56(l.project_id)+' | '+timeOnly(l.check_in)+' - '+timeOnly(l.check_out)+' | الفعلي '+minsToText(actual)+' | المطلوب '+minsToText(req)+' | '+st)});if(rows.length>40)lines.push('... وباقي السجلات موجودة في تقرير PDF.');lines.push('');lines.push('ملاحظة: احفظ التقرير PDF من زر الطباعة ثم أرفقه في الواتساب.');return lines.join('\n')}
function copyTextV56(text){if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(text);const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();return Promise.resolve()}
function sendDailyManagerWhatsapp(){const rows=dailyReportRowsV56();if(!rows.length){msg('لا توجد بيانات لإرسال التقرير','err');return}const text=dailyReportWhatsappTextV56();copyTextV56(text).finally(()=>{window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank');msg('تم تجهيز رسالة التقرير للواتساب. احفظ PDF من زر الطباعة وأرفقه في الواتساب.')})}

/* ===== V57: Monthly print/PDF report without records count ===== */
function monthLabelV57(month){try{const a=String(month||'').split('-').map(Number);return new Date(a[0],a[1]-1,1).toLocaleDateString('ar-SA',{year:'numeric',month:'long'});}catch(e){return month||'-'}}
function monthlyDiffTextV57(mins){mins=Number(mins||0);if(mins>5)return 'زيادة '+minsToText(Math.abs(mins));if(mins<-5)return 'نقص '+minsToText(Math.abs(mins));return 'ضمن الوقت'}
function monthlyReportRowsV57(){
  const month=$('monthlyMonth')?.value||today().slice(0,7), sid=$('monthlySupervisor')?.value||'';
  let logs=(data.logs||[]).filter(l=>{const d=l.log_date||String(l.check_in||'').slice(0,10);return d&&d.slice(0,7)===month});
  if(sid) logs=logs.filter(l=>String(l.supervisor_id)===String(sid));
  const map=new Map();
  logs.forEach(l=>{const k=(l.supervisor_id||'')+'_'+(l.project_id||'');if(!map.has(k))map.set(k,{s:l.supervisor_id,p:l.project_id,a:0,r:0});const x=map.get(k);x.a+=Number((typeof logActualMinutes==='function'?logActualMinutes(l):(l.duration_minutes||minutesBetween(l.check_in,l.check_out)))||0);x.r+=Number((typeof logRequiredMinutes==='function'?logRequiredMinutes(l):l.required_minutes)||0)});
  return [...map.values()].sort((a,b)=>{const s=supervisorName(a.s).localeCompare(supervisorName(b.s),'ar');return s||projectName(a.p).localeCompare(projectName(b.p),'ar')}).map(x=>{const diff=x.a-x.r;let st='غير محدد',cls='neutral';if(x.r>0){if(diff<-5){st='ناقص وقت';cls='bad'}else if(diff>5){st='زيادة وقت';cls='warn'}else{st='ضمن الوقت';cls='ok'}}return {...x,diff,st,cls,workers:(typeof uniqueWorkersForProjectTextV56==='function'?uniqueWorkersForProjectTextV56(x.p):'-')}})
}
function printMonthlyReportV57(){
  const rows=monthlyReportRowsV57(); if(!rows.length){msg('لا توجد بيانات في الأوقات الشهرية للطباعة','err');return}
  const month=$('monthlyMonth')?.value||today().slice(0,7), sup=$('monthlySupervisor')?.value?supervisorName($('monthlySupervisor').value):'الكل';
  let ta=0,tr=0,within=0,over=0,under=0;
  const trs=rows.map((r,i)=>{ta+=r.a;tr+=r.r;if(r.st==='ضمن الوقت')within++;else if(r.st==='زيادة وقت')over++;else if(r.st==='ناقص وقت')under++;return `<tr><td>${i+1}</td><td>${reportEscV52(supervisorName(r.s))}</td><td>${reportEscV52(projectName(r.p))}</td><td>${reportEscV52(r.workers||'-')}</td><td>${reportEscV52(minsToText(r.a))}</td><td>${reportEscV52(minsToText(r.r))}</td><td>${reportEscV52(monthlyDiffTextV57(r.diff))}</td><td><span class="pill ${r.cls}">${reportEscV52(r.st)}</span></td></tr>`}).join('');
  const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;margin:0;color:#163d34;font-size:12px}.page{border:2px solid #0a5a49;border-radius:18px;padding:14px;min-height:100vh;background:linear-gradient(135deg,rgba(10,90,73,.06),#fff 35%,rgba(191,156,86,.06))}.top{display:flex;justify-content:space-between;align-items:center;border-bottom:4px solid #0a5a49;padding-bottom:14px;margin-bottom:14px}.brand{display:flex;align-items:center;gap:12px}.logo{width:60px;height:60px;border:3px solid #c7a24d;border-radius:50%;display:grid;place-items:center;font-weight:900;color:#0a5a49}.brand h2,.title h1{margin:0;color:#0a5a49}.brand small,.title p{color:#6a766f}.title{text-align:left}.title h1{font-size:28px}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}.box,.kpi,.panel{background:white;border:1px solid #d9e6e1;border-radius:16px;padding:11px;box-shadow:0 8px 18px rgba(0,0,0,.04)}.box b{display:block;color:#0a5a49;margin-bottom:5px}.box span{font-size:15px;font-weight:700}table{width:100%;border-collapse:separate;border-spacing:0;border-radius:16px;overflow:hidden;box-shadow:0 10px 24px rgba(0,0,0,.06)}th{background:#0a5a49;color:white;padding:10px}td{padding:9px;border-bottom:1px solid #e2ece8;text-align:center;background:#fff}tbody tr:nth-child(even) td{background:#f7fbfa}.pill{border-radius:999px;padding:5px 10px;font-weight:800;display:inline-block}.ok{background:#e5f6ec;color:#107338}.warn{background:#fff3d6;color:#8a5c00}.bad{background:#ffe5e5;color:#9d2020}.neutral{background:#edf1f4;color:#52616b}.section{text-align:center;margin:16px 0 12px}.section span{display:inline-block;background:#0a5a49;color:#fff;border:2px solid #c7a24d;border-radius:999px;padding:8px 36px;font-weight:900}.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:9px}.kpi{text-align:center}.kpi strong{display:block;color:#0a5a49;font-size:18px}.kpi span{font-size:11px;color:#6a766f}.bottom{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.panel h3{margin:0 0 10px;color:#0a5a49}.line{height:24px;border-bottom:1px dashed #afbeb8}.footer{text-align:center;margin-top:12px;color:#697a73;border-top:1px solid #dce8e3;padding-top:8px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page{border-radius:0}}</style></head><body><div class="page"><div class="top"><div class="brand"><div class="logo">تصنيف</div><div><h2>شركة تصنيف</h2><small>إدارة المرافق والتشغيل</small></div></div><div class="title"><h1>تقرير الأوقات الشهرية</h1><p>المسؤول: وائل شاكر</p></div></div><div class="meta"><div class="box"><b>الشهر</b><span>${reportEscV52(monthLabelV57(month))}</span></div><div class="box"><b>المشرف</b><span>${reportEscV52(sup)}</span></div><div class="box"><b>عدد المشاريع</b><span>${rows.length}</span></div><div class="box"><b>وقت التصدير</b><span>${reportEscV52(new Date().toLocaleString('ar-SA'))}</span></div></div><table><thead><tr><th>#</th><th>المشرف</th><th>المشروع</th><th>أسماء العمال</th><th>إجمالي الوقت الفعلي</th><th>إجمالي الوقت المطلوب</th><th>فرق الوقت</th><th>حالة الوقت</th></tr></thead><tbody>${trs}</tbody></table><div class="section"><span>ملخص التقرير</span></div><div class="kpis"><div class="kpi"><strong>${reportEscV52(minsToText(ta))}</strong><span>إجمالي الساعات الفعلية</span></div><div class="kpi"><strong>${reportEscV52(minsToText(tr))}</strong><span>إجمالي الساعات المطلوبة</span></div><div class="kpi"><strong>${reportEscV52(monthlyDiffTextV57(ta-tr))}</strong><span>إجمالي فرق الوقت</span></div><div class="kpi"><strong>${within}</strong><span>ضمن الوقت</span></div><div class="kpi"><strong>${over}</strong><span>زيادة وقت</span></div><div class="kpi"><strong>${under}</strong><span>ناقص وقت</span></div></div><div class="bottom"><div class="panel"><h3>ملاحظات المدير</h3><div class="line"></div><div class="line"></div></div><div class="panel"><h3>اعتماد مدير التشغيل</h3><p>الاسم: وائل شاكر</p><div class="line">التوقيع:</div></div></div><div class="footer">هذا التقرير مولّد آليًا من نظام تصنيف — يحفظ PDF من نافذة الطباعة</div><script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></div></body></html>`;
  const w=window.open('','_blank'); if(!w){msg('المتصفح منع فتح نافذة التقرير. اسمح بالنوافذ المنبثقة','err');return} w.document.open();w.document.write(html);w.document.close();
}

/* ===== V58: Monthly print like supervisor blocks with work percentage ===== */
function monthlyPercentClassV58(p){
  p=Number(p||0);
  if(!isFinite(p) || p<=0) return 'neutral';
  if(p>=95 && p<=105) return 'ok';
  if(p>105) return 'warn';
  return 'bad';
}
function monthlyStatusTextV58(p, req){
  p=Number(p||0); req=Number(req||0);
  if(!req) return 'غير محدد';
  if(p>=95 && p<=105) return 'ضمن الوقت';
  if(p>105) return 'زيادة وقت';
  return 'ناقص وقت';
}
function monthlyReportRowsV58(){
  const month=$('monthlyMonth')?.value||today().slice(0,7), sid=$('monthlySupervisor')?.value||'';
  let logs=(data.logs||[]).filter(l=>{const d=l.log_date||String(l.check_in||'').slice(0,10);return d&&d.slice(0,7)===month});
  if(sid) logs=logs.filter(l=>String(l.supervisor_id)===String(sid));
  const map=new Map();
  logs.forEach(l=>{
    const k=(l.supervisor_id||'')+'_'+(l.project_id||'');
    if(!map.has(k)) map.set(k,{s:l.supervisor_id,p:l.project_id,a:0,r:0,t:0});
    const x=map.get(k);
    x.a+=Number((typeof logActualMinutes==='function'?logActualMinutes(l):(l.duration_minutes||minutesBetween(l.check_in,l.check_out)))||0);
    x.r+=Number((typeof logRequiredMinutes==='function'?logRequiredMinutes(l):l.required_minutes)||0);
    x.t+=Number(l.travel_minutes||0);
  });
  return [...map.values()].sort((a,b)=>{const s=supervisorName(a.s).localeCompare(supervisorName(b.s),'ar');return s||projectName(a.p).localeCompare(projectName(b.p),'ar')}).map(x=>{
    const percent=x.r ? (x.a/x.r*100) : 0;
    const diff=x.a-x.r;
    const cls=monthlyPercentClassV58(percent);
    const st=monthlyStatusTextV58(percent,x.r);
    return {...x,percent,diff,cls,st,workers:(typeof uniqueWorkersForProjectTextV56==='function'?uniqueWorkersForProjectTextV56(x.p):'-')};
  });
}
function supervisorWorkersForMonthlyV58(supervisorId, rows){
  const names=new Set();
  rows.filter(r=>String(r.s)===String(supervisorId)).forEach(r=>{
    String(r.workers||'').split(/[،,]/).map(x=>x.trim()).filter(Boolean).forEach(n=>{if(n!=='-') names.add(n)});
  });
  if(!names.size){
    (data.workers||[]).filter(w=>String(workerSupId(w))===String(supervisorId)).forEach(w=>{if(w.name) names.add(w.name)});
  }
  return [...names].sort((a,b)=>a.localeCompare(b,'ar')).join('، ') || '-';
}
function printMonthlyReportV57(){
  const rows=monthlyReportRowsV58();
  if(!rows.length){msg('لا توجد بيانات في الأوقات الشهرية للطباعة','err');return}
  const month=$('monthlyMonth')?.value||today().slice(0,7), sup=$('monthlySupervisor')?.value?supervisorName($('monthlySupervisor').value):'الكل';
  let actualTotal=0, requiredTotal=0, within=0, over=0, under=0;
  rows.forEach(r=>{actualTotal+=r.a; requiredTotal+=r.r; if(r.st==='ضمن الوقت') within++; else if(r.st==='زيادة وقت') over++; else if(r.st==='ناقص وقت') under++;});
  const totalPct=requiredTotal ? actualTotal/requiredTotal*100 : 0;
  const groups=new Map();
  rows.forEach(r=>{const sid=String(r.s||''); if(!groups.has(sid)) groups.set(sid,[]); groups.get(sid).push(r);});
  const groupCards=[...groups.entries()].map(([sid,items])=>{
    const sActual=items.reduce((a,r)=>a+r.a,0), sReq=items.reduce((a,r)=>a+r.r,0), sPct=sReq?sActual/sReq*100:0;
    const projects=items.map(r=>`<tr><td class="pname">${reportEscV52(projectName(r.p))}</td><td>${reportEscV52(minsToText(r.a))}</td><td><span class="percent ${r.cls}">${reportEscV52(percentText(r.percent))}</span></td></tr>`).join('');
    return `<div class="super-card"><div class="super-head"><b>${reportEscV52(supervisorName(sid))}</b><span>${reportEscV52(percentText(sPct))}</span></div><table class="mini"><thead><tr><th>المشروع</th><th>الفعلي</th><th>نسبة العمل</th></tr></thead><tbody>${projects}</tbody></table><div class="workers"><b>أسماء العمال</b><p>${reportEscV52(supervisorWorkersForMonthlyV58(sid,rows))}</p></div></div>`;
  }).join('');
  const detailRows=rows.map(r=>`<tr><td>${reportEscV52(supervisorName(r.s))}</td><td>${reportEscV52(projectName(r.p))}</td><td>${reportEscV52(r.workers||'-')}</td><td>${reportEscV52(minsToText(r.a))}</td><td>${reportEscV52(minsToText(r.r))}</td><td>${reportEscV52(monthlyDiffTextV57(r.diff))}</td><td><span class="percent ${r.cls}">${reportEscV52(percentText(r.percent))}</span></td><td><span class="pill ${r.cls}">${reportEscV52(r.st)}</span></td></tr>`).join('');
  const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية</title><style>
  @page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{margin:0;font-family:Tahoma,Arial,sans-serif;color:#123d32;background:#fff;font-size:11px}.page{min-height:100vh;padding:14px;background:radial-gradient(circle at top left,rgba(10,90,73,.10),transparent 32%),linear-gradient(135deg,#fff 0%,#fff 62%,rgba(199,162,77,.08));border:2px solid #0a5a49}.top{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #0a5a49;padding-bottom:10px;margin-bottom:10px}.brand{display:flex;align-items:center;gap:10px}.logo{width:54px;height:54px;border-radius:50%;border:3px solid #c7a24d;display:grid;place-items:center;font-weight:900;color:#0a5a49}.brand h2{margin:0;font-size:19px;color:#0a5a49}.title{text-align:left}.title h1{margin:0;font-size:28px;color:#0a5a49}.title p{margin:4px 0 0;color:#68766e}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.box{background:#fff;border:1px solid #d9e6e1;border-radius:13px;padding:9px;text-align:center}.box b{display:block;color:#63756d;font-size:10px}.box strong{font-size:16px;color:#0a5a49}.section{margin:12px 0 8px;text-align:center}.section span{display:inline-block;background:#0a5a49;color:#fff;border:2px solid #c7a24d;border-radius:999px;padding:7px 40px;font-weight:900}.super-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.super-card{background:#fff;border:2px solid #0a5a49;border-radius:10px;overflow:hidden;min-height:245px}.super-head{display:flex;justify-content:space-between;align-items:center;background:#f7fbfa;border-bottom:1px solid #d9e6e1;padding:7px 9px;color:#0a5a49}.super-head b{font-size:13px}.super-head span{font-weight:900}.mini,.details{width:100%;border-collapse:collapse}.mini th{background:#0a5a49;color:#fff;padding:6px;font-size:10px}.mini td{border-bottom:1px solid #e5eeee;padding:5px;text-align:center}.pname{text-align:right!important;font-weight:700}.workers{padding:8px;text-align:center}.workers b{display:block;color:#0a5a49;margin-bottom:5px}.workers p{margin:0;line-height:1.7;color:#243b34}.details{margin-top:8px;border-radius:10px;overflow:hidden}.details th{background:#0a5a49;color:#fff;padding:7px}.details td{border:1px solid #e0e8e5;padding:6px;text-align:center}.percent,.pill{display:inline-block;border-radius:999px;padding:3px 8px;font-weight:900}.ok{background:#e5f6ec;color:#107338}.warn{background:#fff3d6;color:#8a5c00}.bad{background:#ffe5e5;color:#9d2020}.neutral{background:#edf1f4;color:#52616b}.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:8px}.kpi{background:#fff;border:1px solid #d9e6e1;border-radius:13px;padding:9px;text-align:center}.kpi strong{display:block;color:#0a5a49;font-size:16px}.kpi span{font-size:10px;color:#68766e}.bottom{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.panel{background:#fff;border:1px solid #d9e6e1;border-radius:12px;padding:9px}.panel h3{margin:0 0 8px;color:#0a5a49}.line{height:22px;border-bottom:1px dashed #afbeb8}.footer{text-align:center;margin-top:8px;color:#6a766f}.avoid{break-inside:avoid}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page{border-radius:0}.super-card,.kpi,.panel{break-inside:avoid}}
  </style></head><body><div class="page"><div class="top"><div class="brand"><div class="logo">تصنيف</div><div><h2>شركة تصنيف</h2><small>إدارة المرافق والتشغيل</small></div></div><div class="title"><h1>تقرير الأوقات الشهرية</h1><p>المسؤول: وائل شاكر</p></div></div><div class="meta"><div class="box"><b>الشهر</b><strong>${reportEscV52(monthLabelV57(month))}</strong></div><div class="box"><b>المشرف</b><strong>${reportEscV52(sup)}</strong></div><div class="box"><b>عدد المشاريع</b><strong>${rows.length}</strong></div><div class="box"><b>نسبة العمل الإجمالية</b><strong>${reportEscV52(percentText(totalPct))}</strong></div></div><div class="section"><span>ملخص المشرفين والمشاريع</span></div><div class="super-grid avoid">${groupCards}</div><div class="section"><span>تفاصيل الأوقات الشهرية</span></div><table class="details"><thead><tr><th>المشرف</th><th>المشروع</th><th>أسماء العمال</th><th>الوقت الفعلي</th><th>الوقت المطلوب</th><th>الفرق</th><th>نسبة العمل</th><th>حالة الوقت</th></tr></thead><tbody>${detailRows}</tbody></table><div class="section"><span>ملخص التقرير</span></div><div class="kpis"><div class="kpi"><strong>${reportEscV52(minsToText(actualTotal))}</strong><span>إجمالي الوقت الفعلي</span></div><div class="kpi"><strong>${reportEscV52(minsToText(requiredTotal))}</strong><span>إجمالي الوقت المطلوب</span></div><div class="kpi"><strong>${reportEscV52(monthlyDiffTextV57(actualTotal-requiredTotal))}</strong><span>إجمالي فرق الوقت</span></div><div class="kpi"><strong>${reportEscV52(percentText(totalPct))}</strong><span>نسبة العمل</span></div><div class="kpi"><strong>${over}</strong><span>زيادة وقت</span></div><div class="kpi"><strong>${under}</strong><span>ناقص وقت</span></div></div><div class="bottom"><div class="panel"><h3>ملاحظات المدير</h3><div class="line"></div><div class="line"></div></div><div class="panel"><h3>اعتماد مدير التشغيل</h3><p>الاسم: وائل شاكر</p><div class="line">التوقيع:</div></div></div><div class="footer">هذا التقرير مولّد آليًا من نظام تصنيف — يحفظ PDF من نافذة الطباعة</div><script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></div></body></html>`;
  const w=window.open('','_blank'); if(!w){msg('المتصفح منع فتح نافذة التقرير. اسمح بالنوافذ المنبثقة','err');return} w.document.open();w.document.write(html);w.document.close();
}

/* ===== V59: Monthly work percentage formula like Excel =====
   نسبة العمل = وقت المشروع الفعلي ÷ إجمالي وقت نفس المشرف × 100
   نسبة الالتزام = الوقت الفعلي ÷ الوقت المطلوب × 100
   حالة الوقت = حسب فرق الدقائق ±5
*/
function monthlyTimeClassV59(diff, required){
  if(!Number(required||0)) return 'neutral';
  diff=Number(diff||0);
  if(diff < -5) return 'bad';
  if(diff > 5) return 'warn';
  return 'ok';
}
function monthlyTimeStatusV59(diff, required){
  if(!Number(required||0)) return 'غير محدد';
  diff=Number(diff||0);
  if(diff < -5) return 'ناقص وقت';
  if(diff > 5) return 'زيادة وقت';
  return 'ضمن الوقت';
}
function monthlyCommitmentClassV59(percent, required){
  if(!Number(required||0)) return 'neutral';
  percent=Number(percent||0);
  if(percent>=95 && percent<=105) return 'ok';
  if(percent>105) return 'warn';
  return 'bad';
}
function monthlyBaseRowsV59(){
  const month=$('monthlyMonth')?.value||today().slice(0,7), sid=$('monthlySupervisor')?.value||'';
  let logs=(data.logs||[]).filter(l=>{const d=l.log_date||String(l.check_in||'').slice(0,10);return d&&d.slice(0,7)===month});
  if(sid) logs=logs.filter(l=>String(l.supervisor_id)===String(sid));
  const map=new Map();
  logs.forEach(l=>{
    const k=(l.supervisor_id||'')+'_'+(l.project_id||'');
    if(!map.has(k)) map.set(k,{s:l.supervisor_id,p:l.project_id,c:0,a:0,r:0,t:0});
    const x=map.get(k);
    x.c++;
    x.a+=Number((typeof logActualMinutes==='function'?logActualMinutes(l):(l.duration_minutes||minutesBetween(l.check_in,l.check_out)))||0);
    x.r+=Number((typeof logRequiredMinutes==='function'?logRequiredMinutes(l):l.required_minutes)||0);
    x.t+=Number(l.travel_minutes||0);
  });
  const vals=[...map.values()];
  const supTotals={};
  vals.forEach(r=>{ const s=String(r.s||''); supTotals[s]=(supTotals[s]||0)+Number(r.a||0); });
  return vals.map(r=>{
    const supTotal=supTotals[String(r.s||'')]||0;
    const workPercent=supTotal ? (r.a/supTotal*100) : 0;
    const commitmentPercent=r.r ? (r.a/r.r*100) : 0;
    const diff=r.a-r.r;
    const cls=monthlyTimeClassV59(diff,r.r);
    const st=monthlyTimeStatusV59(diff,r.r);
    const ccls=monthlyCommitmentClassV59(commitmentPercent,r.r);
    return {...r,supTotal,workPercent,commitmentPercent,diff,cls,st,ccls,workers:(typeof uniqueWorkersForProjectTextV56==='function'?uniqueWorkersForProjectTextV56(r.p):'-')};
  }).sort((a,b)=>{const s=supervisorName(a.s).localeCompare(supervisorName(b.s),'ar');return s||projectName(a.p).localeCompare(projectName(b.p),'ar')});
}
function renderMonthly(){
  const body=$('monthlyBody');
  if(!body) return;
  const vals=monthlyBaseRowsV59();
  body.innerHTML=vals.map(r=>`<tr><td>${esc(supervisorName(r.s))}</td><td>${esc(projectName(r.p))}</td><td>${r.c}</td><td>${minsToText(r.r)}</td><td>${minsToText(r.a)}</td><td>${r.t} دقيقة</td><td><span class="badge green">${percentText(r.workPercent)}</span></td><td><span class="badge ${r.ccls}">${percentText(r.commitmentPercent)}</span></td><td><span class="badge ${r.cls}">${r.st}</span></td></tr>`).join('')||'<tr><td colspan="9">لا توجد بيانات</td></tr>';
  const total=vals.reduce((a,r)=>a+r.a,0), required=vals.reduce((a,r)=>a+r.r,0), travel=vals.reduce((a,r)=>a+r.t,0), commitment=required?total/required*100:0;
  const diff=total-required, cls=monthlyTimeClassV59(diff,required), status=monthlyTimeStatusV59(diff,required);
  if($('monthlySummary')) $('monthlySummary').innerHTML=`<div class="kpi"><small>الساعات المطلوبة</small><b>${minsToText(required)}</b></div><div class="kpi"><small>الساعات الفعلية</small><b>${minsToText(total)}</b></div><div class="kpi"><small>فرق الوقت</small><b>${monthlyDiffTextV57(diff)}</b></div><div class="kpi"><small>وقت الانتقال</small><b>${travel} دقيقة</b></div><div class="kpi"><small>نسبة الالتزام</small><b>${percentText(commitment)}</b></div><div class="kpi"><small>حالة الأداء</small><b><span class="badge ${cls}">${status}</span></b></div>`;
}
function exportMonthlyCSV(){
  const rows=[...document.querySelectorAll('#monthlyBody tr')].map(tr=>[...tr.children].map(td=>td.textContent.trim()));
  const csv=['المشرف,المشروع,عدد السجلات,الساعات المطلوبة,الساعات الفعلية,وقت الانتقال,نسبة العمل,نسبة الالتزام,حالة الوقت',...rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(','))].join('\n');
  download('monthly.csv',csv);
}
function monthlyReportRowsV58(){ return monthlyBaseRowsV59(); }
function supervisorWorkersForMonthlyV58(supervisorId, rows){
  const names=new Set();
  rows.filter(r=>String(r.s)===String(supervisorId)).forEach(r=>{
    String(r.workers||'').split(/[،,]/).map(x=>x.trim()).filter(Boolean).forEach(n=>{if(n!=='-') names.add(n)});
  });
  if(!names.size){
    (data.workers||[]).filter(w=>String(workerSupId(w))===String(supervisorId)).forEach(w=>{if(w.name) names.add(w.name)});
  }
  return [...names].sort((a,b)=>a.localeCompare(b,'ar')).join('، ') || '-';
}
function printMonthlyReportV57(){
  const rows=monthlyBaseRowsV59();
  if(!rows.length){msg('لا توجد بيانات في الأوقات الشهرية للطباعة','err');return}
  const month=$('monthlyMonth')?.value||today().slice(0,7), sup=$('monthlySupervisor')?.value?supervisorName($('monthlySupervisor').value):'الكل';
  let actualTotal=0, requiredTotal=0, within=0, over=0, under=0;
  rows.forEach(r=>{actualTotal+=r.a; requiredTotal+=r.r; if(r.st==='ضمن الوقت') within++; else if(r.st==='زيادة وقت') over++; else if(r.st==='ناقص وقت') under++;});
  const commitmentTotal=requiredTotal ? actualTotal/requiredTotal*100 : 0;
  const groups=new Map();
  rows.forEach(r=>{const sid=String(r.s||''); if(!groups.has(sid)) groups.set(sid,[]); groups.get(sid).push(r);});
  const groupCards=[...groups.entries()].map(([sid,items])=>{
    const sActual=items.reduce((a,r)=>a+r.a,0), sReq=items.reduce((a,r)=>a+r.r,0), sCommit=sReq?sActual/sReq*100:0;
    const projects=items.map(r=>`<tr><td class="pname">${reportEscV52(projectName(r.p))}</td><td>${reportEscV52(minsToText(r.a))}</td><td><span class="percent ok">${reportEscV52(percentText(r.workPercent))}</span></td></tr>`).join('');
    return `<div class="super-card"><div class="super-head"><b>${reportEscV52(supervisorName(sid))}</b><span>${reportEscV52(minsToText(sActual))}</span></div><table class="mini"><thead><tr><th>المشروع</th><th>الفعلي</th><th>نسبة العمل</th></tr></thead><tbody>${projects}</tbody></table><div class="workers"><b>أسماء العمال</b><p>${reportEscV52(supervisorWorkersForMonthlyV58(sid,rows))}</p></div><div class="commitment">نسبة الالتزام: <b>${reportEscV52(percentText(sCommit))}</b></div></div>`;
  }).join('');
  const detailRows=rows.map(r=>`<tr><td>${reportEscV52(supervisorName(r.s))}</td><td>${reportEscV52(projectName(r.p))}</td><td>${reportEscV52(r.workers||'-')}</td><td>${reportEscV52(minsToText(r.a))}</td><td>${reportEscV52(minsToText(r.r))}</td><td>${reportEscV52(monthlyDiffTextV57(r.diff))}</td><td><span class="percent ok">${reportEscV52(percentText(r.workPercent))}</span></td><td><span class="percent ${r.ccls}">${reportEscV52(percentText(r.commitmentPercent))}</span></td><td><span class="pill ${r.cls}">${reportEscV52(r.st)}</span></td></tr>`).join('');
  const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية</title><style>@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{margin:0;font-family:Tahoma,Arial,sans-serif;color:#123d32;background:#fff;font-size:11px}.page{min-height:100vh;padding:14px;background:radial-gradient(circle at top left,rgba(10,90,73,.10),transparent 32%),linear-gradient(135deg,#fff 0%,#fff 62%,rgba(199,162,77,.08));border:2px solid #0a5a49}.top{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #0a5a49;padding-bottom:10px;margin-bottom:10px}.brand{display:flex;align-items:center;gap:10px}.logo{width:54px;height:54px;border-radius:50%;border:3px solid #c7a24d;display:grid;place-items:center;font-weight:900;color:#0a5a49}.brand h2{margin:0;font-size:19px;color:#0a5a49}.title{text-align:left}.title h1{margin:0;font-size:28px;color:#0a5a49}.title p{margin:4px 0 0;color:#68766e}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.box{background:#fff;border:1px solid #d9e6e1;border-radius:13px;padding:9px;text-align:center}.box b{display:block;color:#63756d;font-size:10px}.box strong{font-size:16px;color:#0a5a49}.section{margin:12px 0 8px;text-align:center}.section span{display:inline-block;background:#0a5a49;color:#fff;border:2px solid #c7a24d;border-radius:999px;padding:7px 40px;font-weight:900}.super-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.super-card{background:#fff;border:2px solid #0a5a49;border-radius:10px;overflow:hidden;min-height:245px}.super-head{display:flex;justify-content:space-between;align-items:center;background:#f7fbfa;border-bottom:1px solid #d9e6e1;padding:7px 9px;color:#0a5a49}.super-head b{font-size:13px}.super-head span{font-weight:900}.mini,.details{width:100%;border-collapse:collapse}.mini th{background:#0a5a49;color:#fff;padding:6px;font-size:10px}.mini td{border-bottom:1px solid #e5eeee;padding:5px;text-align:center}.pname{text-align:right!important;font-weight:700}.workers{padding:8px;text-align:center}.workers b{display:block;color:#0a5a49;margin-bottom:5px}.workers p{margin:0;line-height:1.7;color:#243b34}.commitment{padding:7px;text-align:center;border-top:1px solid #e5eeee;color:#0a5a49}.details{margin-top:8px;border-radius:10px;overflow:hidden}.details th{background:#0a5a49;color:#fff;padding:7px}.details td{border:1px solid #e0e8e5;padding:6px;text-align:center}.percent,.pill{display:inline-block;border-radius:999px;padding:3px 8px;font-weight:900}.ok{background:#e5f6ec;color:#107338}.warn{background:#fff3d6;color:#8a5c00}.bad{background:#ffe5e5;color:#9d2020}.neutral{background:#edf1f4;color:#52616b}.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:8px}.kpi{background:#fff;border:1px solid #d9e6e1;border-radius:13px;padding:9px;text-align:center}.kpi strong{display:block;color:#0a5a49;font-size:16px}.kpi span{font-size:10px;color:#68766e}.bottom{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.panel{background:#fff;border:1px solid #d9e6e1;border-radius:12px;padding:9px}.panel h3{margin:0 0 8px;color:#0a5a49}.line{height:22px;border-bottom:1px dashed #afbeb8}.footer{text-align:center;margin-top:8px;color:#6a766f}.avoid{break-inside:avoid}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page{border-radius:0}.super-card,.kpi,.panel{break-inside:avoid}}</style></head><body><div class="page"><div class="top"><div class="brand"><div class="logo">تصنيف</div><div><h2>شركة تصنيف</h2><small>إدارة المرافق والتشغيل</small></div></div><div class="title"><h1>تقرير الأوقات الشهرية</h1><p>المسؤول: وائل شاكر</p></div></div><div class="meta"><div class="box"><b>الشهر</b><strong>${reportEscV52(monthLabelV57(month))}</strong></div><div class="box"><b>المشرف</b><strong>${reportEscV52(sup)}</strong></div><div class="box"><b>عدد المشاريع</b><strong>${rows.length}</strong></div><div class="box"><b>نسبة الالتزام الإجمالية</b><strong>${reportEscV52(percentText(commitmentTotal))}</strong></div></div><div class="section"><span>ملخص المشرفين والمشاريع</span></div><div class="super-grid avoid">${groupCards}</div><div class="section"><span>تفاصيل الأوقات الشهرية</span></div><table class="details"><thead><tr><th>المشرف</th><th>المشروع</th><th>أسماء العمال</th><th>الوقت الفعلي</th><th>الوقت المطلوب</th><th>الفرق</th><th>نسبة العمل</th><th>نسبة الالتزام</th><th>حالة الوقت</th></tr></thead><tbody>${detailRows}</tbody></table><div class="section"><span>ملخص التقرير</span></div><div class="kpis"><div class="kpi"><strong>${reportEscV52(minsToText(actualTotal))}</strong><span>إجمالي الوقت الفعلي</span></div><div class="kpi"><strong>${reportEscV52(minsToText(requiredTotal))}</strong><span>إجمالي الوقت المطلوب</span></div><div class="kpi"><strong>${reportEscV52(monthlyDiffTextV57(actualTotal-requiredTotal))}</strong><span>إجمالي فرق الوقت</span></div><div class="kpi"><strong>${reportEscV52(percentText(commitmentTotal))}</strong><span>نسبة الالتزام</span></div><div class="kpi"><strong>${over}</strong><span>زيادة وقت</span></div><div class="kpi"><strong>${under}</strong><span>ناقص وقت</span></div></div><div class="bottom"><div class="panel"><h3>ملاحظات المدير</h3><div class="line"></div><div class="line"></div></div><div class="panel"><h3>اعتماد مدير التشغيل</h3><p>الاسم: وائل شاكر</p><div class="line">التوقيع:</div></div></div><div class="footer">ملاحظة: نسبة العمل = وقت المشروع ÷ إجمالي وقت المشرف. نسبة الالتزام = الوقت الفعلي ÷ الوقت المطلوب.</div><script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></div></body></html>`;
  const w=window.open('','_blank'); if(!w){msg('المتصفح منع فتح نافذة التقرير. اسمح بالنوافذ المنبثقة','err');return} w.document.open();w.document.write(html);w.document.close();
}

/* ===== V60: Correct monthly percentages and unique workers count ===== */
function tasneefNormNameV60(name){return String(name||'').trim().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ')}
function uniqueWorkersCountV60(){const set=new Set();(data.workers||[]).forEach(w=>{const st=String(w.status||'active').toLowerCase();if(st==='deleted')return;const key=tasneefNormNameV60(w.name);if(key)set.add(key)});return set.size}
function uniqueWorkersForProjectTextV60(projectId){const m=new Map();(data.workers||[]).forEach(w=>{const st=String(w.status||'active').toLowerCase();if(st==='deleted'||st==='inactive')return;const pid=(typeof workerProjectId==='function')?workerProjectId(w):(w.project_id||w.assigned_project_id||'');if(String(pid)!==String(projectId))return;const key=tasneefNormNameV60(w.name);if(key&&!m.has(key))m.set(key,String(w.name||'').trim())});return [...m.values()].join('، ')||'-'}
function renderDashboard(){if(!$('kpiUsers'))return;$('kpiUsers').textContent=data.users.length;$('kpiProjects').textContent=data.projects.length;$('kpiWorkers').textContent=uniqueWorkersCountV60();$('kpiTodayLogs').textContent=data.logs.filter(l=>(l.log_date||String(l.check_in||'').slice(0,10))===today()).length;const div=$('todaySummary');if(div)div.innerHTML=data.supervisors.map(s=>{const logs=data.logs.filter(l=>String(l.supervisor_id)===String(s.id)&&(l.log_date||String(l.check_in||'').slice(0,10))===today());const mins=logs.reduce((a,l)=>a+(Number(l.duration_minutes)||minutesBetween(l.check_in,l.check_out)),0);return `<div class="summary-item"><b>${esc(s.full_name)}</b><br>عدد التسجيلات: ${logs.length}<br>إجمالي الوقت: ${minsToText(mins)}</div>`}).join('')||'<div class="summary-item">لا توجد تسجيلات اليوم</div>'}
function monthlyStatusFromDiffV60(diff,required){if(!Number(required||0))return{text:'غير محدد',cls:'neutral'};diff=Number(diff||0);if(diff<-5)return{text:'ناقص وقت',cls:'bad'};if(diff>5)return{text:'زيادة وقت',cls:'warn'};return{text:'ضمن الوقت',cls:'ok'}}
function monthlyCommitmentClassV60(percent,required){if(!Number(required||0))return'neutral';percent=Number(percent||0);if(percent>=95&&percent<=105)return'ok';if(percent>105)return'warn';return'bad'}
function monthlyRowsV60(){const month=$('monthlyMonth')?.value||today().slice(0,7);const sid=$('monthlySupervisor')?.value;let logs=(data.logs||[]).filter(l=>{const d=l.log_date||String(l.check_in||'').slice(0,10);return d&&d.slice(0,7)===month});if(sid)logs=logs.filter(l=>String(l.supervisor_id)===String(sid));const map=new Map();logs.forEach(l=>{const k=String(l.supervisor_id||'')+'_'+String(l.project_id||'');if(!map.has(k))map.set(k,{s:l.supervisor_id,p:l.project_id,a:0,r:0,t:0});const x=map.get(k);x.a+=Number((typeof logActualMinutes==='function'?logActualMinutes(l):(l.duration_minutes||minutesBetween(l.check_in,l.check_out)))||0);x.r+=Number((typeof logRequiredMinutes==='function'?logRequiredMinutes(l):l.required_minutes)||0);x.t+=Number(l.travel_minutes||0)});const vals=[...map.values()];const supTotals={};vals.forEach(r=>{const s=String(r.s||'');supTotals[s]=(supTotals[s]||0)+Number(r.a||0)});return vals.map(r=>{const supTotal=supTotals[String(r.s||'')]||0;const workPercent=supTotal?(r.a/supTotal*100):0;const commitmentPercent=r.r?(r.a/r.r*100):0;const diff=r.a-r.r;const st=monthlyStatusFromDiffV60(diff,r.r);return{...r,supTotal,workers:uniqueWorkersForProjectTextV60(r.p),workPercent,commitmentPercent,ccls:monthlyCommitmentClassV60(commitmentPercent,r.r),diff,st:st.text,cls:st.cls}}).sort((a,b)=>{const s=supervisorName(a.s).localeCompare(supervisorName(b.s),'ar');return s||projectName(a.p).localeCompare(projectName(b.p),'ar')})}
function renderMonthly(){const body=$('monthlyBody');if(!body)return;const table=body.closest('table');if(table&&table.tHead)table.tHead.innerHTML='<tr><th>المشرف</th><th>المشروع</th><th>أسماء العمال</th><th>الساعات المطلوبة</th><th>الساعات الفعلية</th><th>وقت الانتقال</th><th>نسبة العمل</th><th>نسبة الالتزام</th><th>حالة الأداء</th></tr>';const vals=monthlyRowsV60();body.innerHTML=vals.map(r=>`<tr><td>${esc(supervisorName(r.s))}</td><td>${esc(projectName(r.p))}</td><td>${esc(r.workers)}</td><td>${minsToText(r.r)}</td><td>${minsToText(r.a)}</td><td>${r.t} دقيقة</td><td><span class="badge green">${percentText(r.workPercent)}</span></td><td><span class="badge ${r.ccls}">${percentText(r.commitmentPercent)}</span></td><td><span class="badge ${r.cls}">${r.st}</span></td></tr>`).join('')||'<tr><td colspan="9">لا توجد بيانات</td></tr>';const total=vals.reduce((a,r)=>a+r.a,0),required=vals.reduce((a,r)=>a+r.r,0),travel=vals.reduce((a,r)=>a+r.t,0),commitment=required?total/required*100:0;const diff=total-required,st=monthlyStatusFromDiffV60(diff,required);if($('monthlySummary'))$('monthlySummary').innerHTML=`<div class="kpi"><small>الساعات المطلوبة</small><b>${minsToText(required)}</b></div><div class="kpi"><small>الساعات الفعلية</small><b>${minsToText(total)}</b></div><div class="kpi"><small>فرق الوقت</small><b>${monthlyDiffTextV57(diff)}</b></div><div class="kpi"><small>وقت الانتقال</small><b>${travel} دقيقة</b></div><div class="kpi"><small>نسبة الالتزام</small><b>${percentText(commitment)}</b></div><div class="kpi"><small>حالة الأداء</small><b><span class="badge ${st.cls}">${st.text}</span></b></div>`}
function exportMonthlyCSV(){const rows=[...document.querySelectorAll('#monthlyBody tr')].map(tr=>[...tr.children].map(td=>td.textContent.trim()));const csv=['المشرف,المشروع,أسماء العمال,الساعات المطلوبة,الساعات الفعلية,وقت الانتقال,نسبة العمل,نسبة الالتزام,حالة الأداء',...rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(','))].join('\n');download('monthly.csv',csv)}
function monthlyBaseRowsV59(){return monthlyRowsV60()}
function monthlyReportRowsV58(){return monthlyRowsV60()}

/* ===== V72: User permissions + camera photo for supervisor check-in/out + WhatsApp ===== */
(function(){
  'use strict';

  const PERMISSIONS_V72 = [
    ['can_time_logs','تسجيل دخول / خروج'],
    ['can_journey','رحلة التشغيل اليومية'],
    ['can_attendance','تسجيل الحضور'],
    ['can_tickets','التكتات'],
    ['can_reports','الملخص والتقارير'],
    ['can_monthly','الأوقات الشهرية'],
    ['can_edit_time_logs','تعديل السجلات اليومية'],
    ['can_manage_users','إدارة المستخدمين'],
    ['can_manage_workers','إدارة العمال'],
    ['can_expenses_inventory','المصروفات والمخزون'],
    ['can_inventory_requests','طلبات صرف المخزون'],
    ['can_manage_inventory','إدارة المخزون']
  ];

  function roleDefaults(role){
    if(role === 'admin') return Object.fromEntries(PERMISSIONS_V72.map(p=>[p[0], true]));
    if(role === 'technician') return {can_tickets:true, can_inventory_requests:true};
    if(role === 'warehouse_manager') return {can_expenses_inventory:true, can_inventory_requests:true, can_manage_inventory:true};
    if(role === 'operations_manager') return {can_time_logs:true,can_journey:true,can_attendance:true,can_tickets:true,can_reports:true,can_monthly:true,can_expenses_inventory:true,can_inventory_requests:true,can_manage_inventory:false,can_edit_time_logs:true,can_manage_users:false,can_manage_workers:true};
    if(role === 'financial_manager') return {can_reports:true,can_expenses_inventory:true,can_inventory_requests:true,can_manage_inventory:false};
    if(role === 'general_manager') return Object.fromEntries(PERMISSIONS_V72.map(p=>[p[0], true]));
    return {
      can_time_logs:true,
      can_journey:true,
      can_attendance:true,
      can_tickets:true,
      can_reports:true,
      can_monthly:false,
      can_edit_time_logs:false,
      can_manage_users:false,
      can_manage_workers:false,
      can_expenses_inventory:false,
      can_inventory_requests:true,
      can_manage_inventory:false
    };
  }
  function getPerms(user){
    user = user || (typeof session === 'function' ? session() : null) || {};
    let base = roleDefaults(user.role);
    let extra = user.permissions || {};
    if(typeof extra === 'string'){
      try{ extra = JSON.parse(extra || '{}'); }catch(e){ extra = {}; }
    }
    return Object.assign({}, base, extra || {});
  }
  window.getUserPermissionsV72 = getPerms;

  function injectPermissionsBox(){
    const formTitle = document.getElementById('userFormTitle');
    if(!formTitle) return;
    const active = document.getElementById('userActive');
    if(!active) return;
    let box = document.getElementById('userPermissionsBoxV72');
    const html = '<label>الصلاحيات</label><div class="perm-grid-v72">' + PERMISSIONS_V72.map(([key,label]) =>
      `<label class="perm-item-v72"><input type="checkbox" id="perm_${key}" data-perm="${key}"> <span>${label}</span></label>`
    ).join('') + '</div><div class="footer-note">تحدد هذه الصلاحيات ما يظهر للمستخدم داخل التطبيق. مدير عام يحصل على كل الصلاحيات افتراضيًا.</div>';
    if(!box){
      box = document.createElement('div');
      box.id = 'userPermissionsBoxV72';
      box.className = 'perm-box-v72';
      active.parentElement.insertBefore(box, active.nextSibling);
    }
    const needsRefresh = !box.querySelector('#perm_can_expenses_inventory') || !box.querySelector('#perm_can_inventory_requests') || !box.querySelector('#perm_can_manage_inventory') || !box.textContent.includes('مدير مخازن') === false;
    if(needsRefresh || !box.querySelector('.perm-grid-v72')) box.innerHTML = html;
    const role = document.getElementById('userRole');
    if(role && !role.dataset.permHookedV112){ role.dataset.permHookedV112='1'; role.addEventListener('change', ()=>setPermInputs(roleDefaults(role.value))); }
    setPermInputs(roleDefaults(role?.value || 'supervisor'));
  }
  function readPermInputs(){
    const out = {};
    PERMISSIONS_V72.forEach(([key])=>{
      const el = document.getElementById('perm_'+key);
      if(el) out[key] = !!el.checked;
    });
    return out;
  }
  function setPermInputs(perms){
    perms = perms || {};
    PERMISSIONS_V72.forEach(([key])=>{
      const el = document.getElementById('perm_'+key);
      if(el) el.checked = !!perms[key];
    });
  }
  function permissionsText(perms){
    perms = perms || {};
    const labels = PERMISSIONS_V72.filter(([k])=>perms[k]).map(x=>x[1]);
    return labels.length ? labels.join('، ') : '-';
  }

  const oldHydrate = window.hydrateForms;
  window.hydrateForms = function(){
    if(typeof oldHydrate === 'function') oldHydrate.apply(this, arguments);
    injectPermissionsBox();
  };

  window.saveUser = async function(){
    const id=$('userId')?.value;
    const row={
      full_name:$('userFullName')?.value.trim(),
      username:$('userUsername')?.value.trim(),
      password:$('userPassword')?.value.trim()||'123456',
      role:$('userRole')?.value,
      is_active:$('userActive')?.value==='true',
      permissions: readPermInputs()
    };
    if(!row.full_name||!row.username) return msg('الاسم واسم المستخدم مطلوبان','err');
    let res = id ? await sb.from('app_users').update(row).eq('id',id) : await sb.from('app_users').insert(row);
    if(res.error && String(res.error.message||'').includes('permissions')){
      const safeRow = Object.assign({}, row); delete safeRow.permissions;
      res = id ? await sb.from('app_users').update(safeRow).eq('id',id) : await sb.from('app_users').insert(safeRow);
      if(!res.error) msg('تم حفظ المستخدم، لكن عمود الصلاحيات غير موجود. شغّل ملف schema_update_v72_permissions_camera.sql','err');
    }
    if(res.error) return msg(res.error.message,'err');
    msg('تم حفظ المستخدم والصلاحيات');
    if(typeof clearUserForm === 'function') clearUserForm();
    await refreshAll();
    injectPermissionsBox();
  };

  window.renderUsers = function(){
    const b=$('usersBody'); if(!b) return;
    const table=b.closest('table');
    if(table && table.tHead){
      table.tHead.innerHTML='<tr><th>الاسم</th><th>المستخدم</th><th>الدور</th><th>الحالة</th><th>الصلاحيات</th><th>إجراء</th></tr>';
    }
    b.innerHTML=(data.users||[]).map(u=>{
      const perms = getPerms(u);
      return `<tr><td>${esc(u.full_name)}</td><td>${esc(u.username)}</td><td><span class="badge">${esc(userRoleLabel(u.role))}</span></td><td><span class="badge ${u.is_active?'green':'red'}">${u.is_active?'نشط':'موقوف'}</span></td><td style="white-space:normal;min-width:220px">${esc(permissionsText(perms))}</td><td class="row-actions"><button onclick="editUser(${u.id})">تعديل</button><button class="danger" onclick="deleteRow('app_users',${u.id})">حذف</button></td></tr>`;
    }).join('') || '<tr><td colspan="6">لا يوجد مستخدمون</td></tr>';
  };

  window.editUser = function(id){
    const u=(data.users||[]).find(x=>String(x.id)===String(id)); if(!u)return;
    injectPermissionsBox();
    $('userId').value=u.id; $('userFullName').value=u.full_name||''; $('userUsername').value=u.username||''; $('userPassword').value=u.password||''; $('userRole').value=u.role; $('userActive').value=String(u.is_active!==false); $('userFormTitle').textContent='تعديل مستخدم';
    setPermInputs(getPerms(u));
  };

  const oldClearUser = window.clearUserForm;
  window.clearUserForm = function(){
    if(typeof oldClearUser === 'function') oldClearUser.apply(this, arguments);
    injectPermissionsBox();
    setPermInputs(roleDefaults(document.getElementById('userRole')?.value || 'supervisor'));
  };

  function applyCurrentPermissions(){
    const u = (typeof session === 'function') ? session() : null;
    if(!u) return;
    const p = getPerms(u);
    if(u.role === 'admin'){
      const navMap = [
        ['users','can_manage_users'], ['workers','can_manage_workers'], ['daily','can_time_logs'], ['attendance','can_attendance'], ['monthly','can_monthly'], ['tickets','can_tickets'], ['financeDashboard','can_expenses_inventory']
      ];
      navMap.forEach(([page,perm])=>{
        const btn=[...document.querySelectorAll('.nav')].find(b=>String(b.getAttribute('onclick')||'').includes(`'${page}'`));
        if(btn && p[perm]===false) btn.classList.add('hidden');
      });
    }
    if(u.role === 'supervisor'){
      const tabRules = [
        ['supLogs','can_time_logs'], ['supAttendance','can_attendance'], ['supTickets','can_tickets'], ['supSummary','can_reports']
      ];
      tabRules.forEach(([page,perm])=>{
        const btn=[...document.querySelectorAll('.sup-tab')].find(b=>String(b.getAttribute('onclick')||'').includes(`'${page}'`));
        if(btn && p[perm]===false) btn.classList.add('hidden');
      });
    }
  }
  window.addEventListener('load', ()=>setTimeout(applyCurrentPermissions, 700));

  function ensureCameraStyles(){
    if(document.getElementById('cameraStylesV72')) return;
    const st=document.createElement('style'); st.id='cameraStylesV72';
    st.textContent = `
      .cam-overlay-v72{position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:999999;display:grid;place-items:center;padding:16px;direction:rtl}
      .cam-box-v72{width:min(560px,96vw);background:#fff;border-radius:22px;padding:14px;border:1px solid #dce6e2;box-shadow:0 20px 60px rgba(0,0,0,.35)}
      .cam-box-v72 h3{margin:0 0 10px;color:#0A4033}.cam-video-v72{width:100%;max-height:58vh;background:#111;border-radius:16px;object-fit:cover}
      .cam-actions-v72{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.cam-actions-v72 button{flex:1}.cam-cancel-v72{background:#b83232!important}.perm-box-v72{margin-top:12px;border:1px solid var(--line,#dce6e2);background:#fbfdfc;border-radius:14px;padding:12px}.perm-grid-v72{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.perm-item-v72{display:flex!important;align-items:center;gap:8px;margin:0!important;color:#10231d!important;font-weight:600!important}.perm-item-v72 input{width:auto!important}.footer-note{font-size:12px;color:#60706a;line-height:1.7;margin-top:8px}
      @media(max-width:640px){.perm-grid-v72{grid-template-columns:1fr}.cam-actions-v72{flex-direction:column}}
    `;
    document.head.appendChild(st);
  }
  function nowArabicLabel(){ return new Date().toLocaleString('ar-SA', {dateStyle:'medium', timeStyle:'short'}); }
  function dataUrlToFile(dataUrl, filename){
    const arr = dataUrl.split(','), mime = (arr[0].match(/:(.*?);/)||[])[1] || 'image/jpeg';
    const bstr = atob(arr[1]); let n=bstr.length; const u8=new Uint8Array(n);
    while(n--) u8[n]=bstr.charCodeAt(n);
    return new File([u8], filename, {type:mime});
  }
  async function capturePhotoV72(info){
    ensureCameraStyles();
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      msg('الكاميرا غير مدعومة في هذا المتصفح','err');
      return null;
    }
    return new Promise(async(resolve)=>{
      let stream=null;
      const overlay=document.createElement('div'); overlay.className='cam-overlay-v72';
      overlay.innerHTML=`<div class="cam-box-v72"><h3>${info.title}</h3><video class="cam-video-v72" autoplay playsinline muted></video><div class="cam-actions-v72"><button type="button" id="camShotV72">التقاط الصورة</button><button type="button" id="camSwitchV73" style="background:#0d6b56!important">تبديل الكاميرا</button><button type="button" class="cam-cancel-v72" id="camCancelV72">إلغاء</button></div><div class="footer-note">سيحاول التطبيق فتح الكاميرا الخلفية أولًا. إذا لم تعمل، اضغط تبديل الكاميرا أو تأكد أن الصفحة تعمل على HTTPS.</div></div>`;
      document.body.appendChild(overlay);
      const video=overlay.querySelector('video');
      function close(val){ try{ stream && stream.getTracks().forEach(t=>t.stop()); }catch(e){} overlay.remove(); resolve(val); }
      overlay.querySelector('#camCancelV72').onclick=()=>close(null);
      let preferBackCameraV73 = true;
      async function startCameraV73(){
        try{ stream && stream.getTracks().forEach(t=>t.stop()); }catch(e){}
        stream = null;
        const tries = preferBackCameraV73
          ? [
              {video:{facingMode:{exact:'environment'}}, audio:false},
              {video:{facingMode:{ideal:'environment'}}, audio:false},
              {video:true, audio:false}
            ]
          : [
              {video:{facingMode:{exact:'user'}}, audio:false},
              {video:{facingMode:{ideal:'user'}}, audio:false},
              {video:true, audio:false}
            ];
        let lastErr = null;
        for(const constraints of tries){
          try{
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;
            try{ await video.play(); }catch(e){}
            return true;
          }catch(err){ lastErr = err; }
        }
        msg('تعذر فتح الكاميرا: '+((lastErr && lastErr.message) || lastErr || 'تحقق من صلاحيات الكاميرا'),'err');
        return false;
      }
      const switchBtnV73 = overlay.querySelector('#camSwitchV73');
      if(switchBtnV73){
        switchBtnV73.onclick = async()=>{
          preferBackCameraV73 = !preferBackCameraV73;
          switchBtnV73.textContent = preferBackCameraV73 ? 'تبديل الكاميرا' : 'الرجوع للخلفية';
          await startCameraV73();
        };
      }
      overlay.querySelector('#camShotV72').onclick=()=>{
        const w=640, h=480;
        const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
        const ctx=canvas.getContext('2d');
        ctx.fillStyle='#111'; ctx.fillRect(0,0,w,h);
        try{
          const vw=video.videoWidth||w, vh=video.videoHeight||h;
          const scale=Math.max(w/vw,h/vh), dw=vw*scale, dh=vh*scale, dx=(w-dw)/2, dy=(h-dh)/2;
          ctx.drawImage(video,dx,dy,dw,dh);
        }catch(e){}
        const lines=[info.title, 'المشرف: '+info.supervisorName, 'المشروع: '+info.projectName, 'الوقت: '+nowArabicLabel()];
        ctx.font='bold 24px Tahoma, Arial';
        const pad=16, lineH=34, boxH=pad*2+lines.length*lineH;
        ctx.fillStyle='rgba(10,64,51,.86)'; ctx.fillRect(0,h-boxH,w,boxH);
        ctx.fillStyle='#fff'; ctx.textAlign='right'; ctx.direction='rtl';
        lines.forEach((line,i)=>ctx.fillText(line,w-pad,h-boxH+pad+26+i*lineH));
        close(canvas.toDataURL('image/jpeg',0.72));
      };
      try{
        const ok = await startCameraV73();
        if(!ok) close(null);
      }catch(err){
        msg('تعذر فتح الكاميرا: '+(err.message||err),'err');
        close(null);
      }
    });
  }
  function workersForSupervisorText(supervisorId){
    const map=new Map();
    const projects=(data.projects||[]).filter(p=>String(p.supervisor_id||'')===String(supervisorId||''));
    const pids=new Set(projects.map(p=>String(p.id)));
    (data.workers||[]).forEach(w=>{
      const pid = (typeof workerProjectId === 'function') ? workerProjectId(w) : (w.project_id || w.assigned_project_id || '');
      if(!pids.has(String(pid))) return;
      const name=String(w.name||'').trim(); if(!name) return;
      const key=(typeof tasneefNormNameV60==='function'?tasneefNormNameV60(name):name.replace(/\s+/g,' '));
      if(!map.has(key)) map.set(key,name);
    });
    return [...map.values()].join('، ') || '-';
  }
  function attendanceWhatsappTextV72(type, row){
    const title = type==='out' ? 'انصراف المشرف وعماله' : 'حضور المشرف وعماله';
    const lines=[title,'','المشرف: '+supervisorName(row.supervisor_id),'المشروع: '+projectName(row.project_id),'نوع الزيارة: '+(typeof visitTypeText==='function'?visitTypeText(row.visit_type):row.visit_type||'-'),'العمال: '+workersForSupervisorText(row.supervisor_id),'التاريخ: '+(row.log_date||today()),(type==='out'?'وقت الخروج: ':'وقت الدخول: ')+timeOnly(type==='out'?row.check_out:row.check_in),'','شركة تصنيف لإدارة المرافق'];
    return lines.join('\n');
  }
  async function sharePhotoAndWhatsappV72(dataUrl, text, filename){
    try{
      if(dataUrl && navigator.canShare && navigator.share){
        const file=dataUrlToFile(dataUrl, filename||'tasneef-attendance.jpg');
        if(navigator.canShare({files:[file]})){
          await navigator.share({title:'تصنيف', text, files:[file]});
          return;
        }
      }
    }catch(e){}
    try{ await navigator.clipboard?.writeText(text); }catch(e){}
    const url='https://wa.me/?text='+encodeURIComponent(text + (dataUrl?'\n\nملاحظة: تم التقاط الصورة داخل التطبيق. إذا لم تُرفق تلقائيًا، احفظها من شاشة التصوير وأرفقها يدويًا.':''));
    window.open(url,'_blank');
  }
  async function saveTimeLogWithPhotoV72(type, photoDataUrl){
    const u=session();
    const id=$('logId')?.value;
    const date=$('logDate')?.value || today();
    let sup=$('logSupervisor')?.value || (u.role==='supervisor'?u.id:'');
    const project=$('logProject')?.value;
    if(!sup && project) sup=getProjectSupervisorId(project);
    const check_in=dateTime(date,$('logIn')?.value), check_out=dateTime(date,$('logOut')?.value);
    if(!project||!check_in) return {error:'المشروع ووقت الدخول مطلوبان'};
    const actual=minutesBetween(check_in,check_out);
    const required=requiredMinutesForLog(project,date);
    const ts=calcTimeStatus(actual,required);
    const autoTravel=calculateTravelMinutes(sup,date,check_in,id);
    const row={user_id:u.id, supervisor_id:Number(sup)||null, project_id:Number(project), check_in, check_out, log_date:date, duration_minutes:actual, travel_minutes:autoTravel, visit_type:$('logVisitType')?.value||findProject(project)?.visit_type_default||'surface', required_minutes:required, time_difference_minutes:ts.diff, time_status:ts.status, notes:$('logNotes')?.value||''};
    if(photoDataUrl){
      if(type==='out'){ row.check_out_photo=photoDataUrl; row.check_out_photo_at=new Date().toISOString(); }
      else { row.check_in_photo=photoDataUrl; row.check_in_photo_at=new Date().toISOString(); }
    }
    let res = id ? await sb.from('time_logs').update(row).eq('id',id).select('*').maybeSingle() : await sb.from('time_logs').insert(row).select('*').single();
    if(res.error && String(res.error.message||'').includes('photo')){
      delete row.check_in_photo; delete row.check_out_photo; delete row.check_in_photo_at; delete row.check_out_photo_at;
      res = id ? await sb.from('time_logs').update(row).eq('id',id).select('*').maybeSingle() : await sb.from('time_logs').insert(row).select('*').single();
      if(!res.error) msg('تم الحفظ، لكن أعمدة الصور غير موجودة. شغّل ملف schema_update_v72_permissions_camera.sql','err');
    }
    if(res.error) return {error:res.error.message};
    const savedRow = res.data ? res.data : Object.assign({id:Number(id)||0}, row);
    return {row:savedRow};
  }

  window.supervisorCheckIn = async function(){
    const u=session();
    if(!$('logProject')?.value) return msg('اختر المشروع','err');
    const pName=projectName($('logProject').value);
    const photo=await capturePhotoV72({title:'صورة حضور / دخول', supervisorName:u?.full_name||u?.username||'مشرف', projectName:pName});
    if(!photo) return msg('تم إلغاء التصوير، لم يتم تسجيل الدخول','err');
    $('logDate').value=today(); $('logIn').value=nowTime(); $('logOut').value='';
    const saved=await saveTimeLogWithPhotoV72('in', photo);
    if(saved.error) return msg(saved.error,'err');
    playAppSound('checkin'); msg('تم تسجيل الدخول بالصورة');
    const text=attendanceWhatsappTextV72('in', saved.row);
    await sharePhotoAndWhatsappV72(photo, text, 'tasneef-checkin-'+Date.now()+'.jpg');
    clearLogForm(); await initSupervisor();
  };
  window.supervisorCheckOut = async function(){
    const u=session(); const pid=$('logProject')?.value;
    if(!pid) return msg('اختر المشروع','err');
    const todayStr=today();
    const open=(data.logs||[]).filter(l=>String(l.project_id)===String(pid)&&String(l.supervisor_id)===String(u.id)&&(!l.check_out)&&(l.log_date||String(l.check_in||'').slice(0,10))===todayStr).sort((a,b)=>new Date(b.check_in)-new Date(a.check_in))[0];
    if(open) editTimeLog(open.id); else { $('logDate').value=todayStr; $('logIn').value=$('logIn').value||nowTime(); }
    const pName=projectName(pid);
    const photo=await capturePhotoV72({title:'صورة انصراف / خروج', supervisorName:u?.full_name||u?.username||'مشرف', projectName:pName});
    if(!photo) return msg('تم إلغاء التصوير، لم يتم تسجيل الخروج','err');
    $('logOut').value=nowTime();
    const saved=await saveTimeLogWithPhotoV72('out', photo);
    if(saved.error) return msg(saved.error,'err');
    playAppSound('checkout'); msg('تم تسجيل الخروج بالصورة');
    const text=attendanceWhatsappTextV72('out', saved.row);
    await sharePhotoAndWhatsappV72(photo, text, 'tasneef-checkout-'+Date.now()+'.jpg');
    clearLogForm(); await initSupervisor();
  };

  // تطبيق أولي بعد التحميل
  setTimeout(()=>{ try{ injectPermissionsBox(); applyCurrentPermissions(); }catch(e){} }, 1200);
})();

/* ===== V82: Monthly required total by unique visit days + V81 clarity/CSV BOM ===== */
(function(){
  'use strict';

  function normMinsV81(v){
    v = Number(v || 0);
    return Number.isFinite(v) ? v : 0;
  }
  function projectDailyRequiredMinutesV81(projectId){
    const p = (typeof findProject === 'function') ? findProject(projectId) : (data.projects||[]).find(x=>String(x.id)===String(projectId));
    return normMinsV81(p?.required_daily_minutes ?? 0);
  }
  function projectFridayRequiredMinutesV81(projectId){
    const p = (typeof findProject === 'function') ? findProject(projectId) : (data.projects||[]).find(x=>String(x.id)===String(projectId));
    return normMinsV81(p?.friday_minutes ?? 0);
  }
  function dailyRequiredTextV81(projectId){
    const daily = projectDailyRequiredMinutesV81(projectId);
    const fri = projectFridayRequiredMinutesV81(projectId);
    if(fri && daily && fri !== daily) return `${minsToText(daily)} / الجمعة ${minsToText(fri)}`;
    if(daily) return minsToText(daily);
    return 'غير محدد';
  }

  // Keep the same aggregation logic, but add daily required text separately from monthly total required.
  window.monthlyRowsV60 = function(){
    const month = $('monthlyMonth')?.value || today().slice(0,7);
    const sid = $('monthlySupervisor')?.value;
    let logs = (data.logs||[]).filter(l=>{
      const d = l.log_date || String(l.check_in||'').slice(0,10);
      return d && d.slice(0,7) === month;
    });
    if(sid) logs = logs.filter(l=>String(l.supervisor_id) === String(sid));

    const map = new Map();
    logs.forEach(l=>{
      const k = String(l.supervisor_id||'') + '_' + String(l.project_id||'');
      if(!map.has(k)) map.set(k,{s:l.supervisor_id,p:l.project_id,a:0,r:0,t:0, days:new Set(), reqByDay:{}});
      const x = map.get(k);
      const logDate = l.log_date || String(l.check_in||'').slice(0,10);
      const isCompleted = !!(l.check_in && l.check_out);
      x.a += Number((typeof logActualMinutes==='function' ? logActualMinutes(l) : (l.duration_minutes || minutesBetween(l.check_in,l.check_out))) || 0);
      // V82: إجمالي الوقت المطلوب يحسب حسب عدد أيام الزيارة الفعلية، وليس عدد السجلات المكررة.
      // إذا وُجد أكثر من سجل لنفس المشروع في نفس اليوم، يحسب الوقت المطلوب مرة واحدة فقط لذلك اليوم.
      if(isCompleted && logDate){
        x.days.add(logDate);
        if(x.reqByDay[logDate] === undefined){
          x.reqByDay[logDate] = Number((typeof logRequiredMinutes==='function' ? logRequiredMinutes(l) : l.required_minutes) || 0);
        }
      }
      x.t += Number(l.travel_minutes || 0);
    });
    map.forEach(x=>{
      x.uniqueDays = x.days ? x.days.size : 0;
      x.r = Object.values(x.reqByDay || {}).reduce((a,v)=>a+Number(v||0),0);
    });

    const vals=[...map.values()];
    const supTotals={};
    vals.forEach(r=>{ const s=String(r.s||''); supTotals[s]=(supTotals[s]||0)+Number(r.a||0); });

    return vals.map(r=>{
      const supTotal = supTotals[String(r.s||'')] || 0;
      const workPercent = supTotal ? (r.a/supTotal*100) : 0;
      const commitmentPercent = r.r ? (r.a/r.r*100) : 0;
      const diff = r.a-r.r;
      const st = monthlyStatusFromDiffV60(diff,r.r);
      return {
        ...r,
        supTotal,
        workers: (typeof uniqueWorkersForProjectTextV60==='function' ? uniqueWorkersForProjectTextV60(r.p) : '-'),
        dailyReqText: dailyRequiredTextV81(r.p),
        dailyReqMinutes: projectDailyRequiredMinutesV81(r.p),
        workPercent,
        commitmentPercent,
        ccls: monthlyCommitmentClassV60(commitmentPercent,r.r),
        diff,
        st: st.text,
        cls: st.cls
      };
    }).sort((a,b)=>{
      const s = supervisorName(a.s).localeCompare(supervisorName(b.s),'ar');
      return s || projectName(a.p).localeCompare(projectName(b.p),'ar');
    });
  };

  window.monthlyBaseRowsV59 = function(){ return monthlyRowsV60(); };
  window.monthlyReportRowsV58 = function(){ return monthlyRowsV60(); };

  window.renderMonthly = function(){
    const body = $('monthlyBody');
    if(!body) return;
    const table = body.closest('table');
    if(table && table.tHead){
      table.tHead.innerHTML = '<tr><th>المشرف</th><th>المشروع</th><th>أسماء العمال</th><th>الوقت اليومي المطلوب</th><th>إجمالي الوقت المطلوب</th><th>الساعات الفعلية</th><th>وقت الانتقال</th><th>نسبة العمل</th><th>نسبة الالتزام</th><th>حالة الأداء</th></tr>';
    }
    const vals = monthlyRowsV60();
    body.innerHTML = vals.map(r=>`<tr><td>${esc(supervisorName(r.s))}</td><td>${esc(projectName(r.p))}</td><td>${esc(r.workers)}</td><td>${esc(r.dailyReqText)}</td><td>${minsToText(r.r)}</td><td>${minsToText(r.a)}</td><td>${r.t} دقيقة</td><td><span class="badge green">${percentText(r.workPercent)}</span></td><td><span class="badge ${r.ccls}">${percentText(r.commitmentPercent)}</span></td><td><span class="badge ${r.cls}">${r.st}</span></td></tr>`).join('') || '<tr><td colspan="10">لا توجد بيانات</td></tr>';

    const total = vals.reduce((a,r)=>a+r.a,0), required = vals.reduce((a,r)=>a+r.r,0), travel = vals.reduce((a,r)=>a+r.t,0), commitment = required ? total/required*100 : 0;
    const diff = total-required, st = monthlyStatusFromDiffV60(diff,required);
    if($('monthlySummary')) $('monthlySummary').innerHTML = `<div class="kpi"><small>إجمالي الوقت المطلوب</small><b>${minsToText(required)}</b></div><div class="kpi"><small>الساعات الفعلية</small><b>${minsToText(total)}</b></div><div class="kpi"><small>فرق الوقت</small><b>${monthlyDiffTextV57(diff)}</b></div><div class="kpi"><small>وقت الانتقال</small><b>${travel} دقيقة</b></div><div class="kpi"><small>نسبة الالتزام</small><b>${percentText(commitment)}</b></div><div class="kpi"><small>حالة الأداء</small><b><span class="badge ${st.cls}">${st.text}</span></b></div>`;
  };

  // CSV with UTF-8 BOM so Arabic opens correctly in Excel.
  window.download = function(name,text){
    const blob = new Blob(['\uFEFF' + String(text||'')], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  window.exportMonthlyCSV = function(){
    const rows=[...document.querySelectorAll('#monthlyBody tr')].map(tr=>[...tr.children].map(td=>td.textContent.trim()));
    const csv=['المشرف,المشروع,أسماء العمال,الوقت اليومي المطلوب,إجمالي الوقت المطلوب,الساعات الفعلية,وقت الانتقال,نسبة العمل,نسبة الالتزام,حالة الأداء',...rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(','))].join('\n');
    download('monthly.csv',csv);
  };

  window.printMonthlyReportV57 = function(){
    const rows = monthlyRowsV60();
    if(!rows.length){ msg('لا توجد بيانات في الأوقات الشهرية للطباعة','err'); return; }
    const month = $('monthlyMonth')?.value || today().slice(0,7), sup = $('monthlySupervisor')?.value ? supervisorName($('monthlySupervisor').value) : 'الكل';
    let actualTotal=0, requiredTotal=0, within=0, over=0, under=0;
    rows.forEach(r=>{ actualTotal+=r.a; requiredTotal+=r.r; if(r.st==='ضمن الوقت') within++; else if(r.st==='زيادة وقت') over++; else if(r.st==='ناقص وقت') under++; });
    const commitmentTotal = requiredTotal ? actualTotal/requiredTotal*100 : 0;
    const groups = new Map();
    rows.forEach(r=>{ const sid=String(r.s||''); if(!groups.has(sid)) groups.set(sid,[]); groups.get(sid).push(r); });
    const groupCards=[...groups.entries()].map(([sid,items])=>{
      const sActual=items.reduce((a,r)=>a+r.a,0), sReq=items.reduce((a,r)=>a+r.r,0), sCommit=sReq?sActual/sReq*100:0;
      const projects=items.map(r=>`<tr><td class="pname">${reportEscV52(projectName(r.p))}</td><td>${reportEscV52(r.dailyReqText)}</td><td>${reportEscV52(minsToText(r.r))}</td><td>${reportEscV52(minsToText(r.a))}</td><td><span class="percent ok">${reportEscV52(percentText(r.workPercent))}</span></td></tr>`).join('');
      return `<div class="super-card"><div class="super-head"><b>${reportEscV52(supervisorName(sid))}</b><span>${reportEscV52(minsToText(sActual))}</span></div><table class="mini"><thead><tr><th>المشروع</th><th>اليومي</th><th>المطلوب</th><th>الفعلي</th><th>نسبة العمل</th></tr></thead><tbody>${projects}</tbody></table><div class="workers"><b>أسماء العمال</b><p>${reportEscV52(supervisorWorkersForMonthlyV58(sid,rows))}</p></div><div class="commitment">نسبة الالتزام: <b>${reportEscV52(percentText(sCommit))}</b></div></div>`;
    }).join('');
    const detailRows=rows.map(r=>`<tr><td>${reportEscV52(supervisorName(r.s))}</td><td>${reportEscV52(projectName(r.p))}</td><td>${reportEscV52(r.workers||'-')}</td><td>${reportEscV52(r.dailyReqText)}</td><td>${reportEscV52(minsToText(r.r))}</td><td>${reportEscV52(minsToText(r.a))}</td><td>${reportEscV52(monthlyDiffTextV57(r.diff))}</td><td><span class="percent ok">${reportEscV52(percentText(r.workPercent))}</span></td><td><span class="percent ${r.ccls}">${reportEscV52(percentText(r.commitmentPercent))}</span></td><td><span class="pill ${r.cls}">${reportEscV52(r.st)}</span></td></tr>`).join('');
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية</title><style>@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{margin:0;font-family:Tahoma,Arial,sans-serif;color:#123d32;background:#fff;font-size:11px}.page{min-height:100vh;padding:14px;background:radial-gradient(circle at top left,rgba(10,90,73,.10),transparent 32%),linear-gradient(135deg,#fff 0%,#fff 62%,rgba(199,162,77,.08));border:2px solid #0a5a49}.top{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #0a5a49;padding-bottom:10px;margin-bottom:10px}.brand{display:flex;align-items:center;gap:10px}.logo{width:54px;height:54px;border-radius:50%;border:3px solid #c7a24d;display:grid;place-items:center;font-weight:900;color:#0a5a49}.brand h2{margin:0;font-size:19px;color:#0a5a49}.title{text-align:left}.title h1{margin:0;font-size:28px;color:#0a5a49}.title p{margin:4px 0 0;color:#68766e}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.box{background:#fff;border:1px solid #d9e6e1;border-radius:13px;padding:9px;text-align:center}.box b{display:block;color:#63756d;font-size:10px}.box strong{font-size:16px;color:#0a5a49}.section{margin:12px 0 8px;text-align:center}.section span{display:inline-block;background:#0a5a49;color:#fff;border:2px solid #c7a24d;border-radius:999px;padding:7px 40px;font-weight:900}.super-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.super-card{background:#fff;border:2px solid #0a5a49;border-radius:10px;overflow:hidden;min-height:220px}.super-head{display:flex;justify-content:space-between;align-items:center;background:#f7fbfa;border-bottom:1px solid #d9e6e1;padding:7px 9px;color:#0a5a49}.mini,.details{width:100%;border-collapse:collapse}.mini th{background:#0a5a49;color:#fff;padding:5px;font-size:9px}.mini td{border-bottom:1px solid #e5eeee;padding:4px;text-align:center}.pname{text-align:right!important;font-weight:700}.workers{padding:7px;text-align:center}.workers b{display:block;color:#0a5a49;margin-bottom:4px}.workers p{margin:0;line-height:1.6;color:#243b34}.commitment{padding:6px;text-align:center;border-top:1px solid #e5eeee;color:#0a5a49}.details{margin-top:8px;border-radius:10px;overflow:hidden}.details th{background:#0a5a49;color:#fff;padding:6px}.details td{border:1px solid #e0e8e5;padding:5px;text-align:center}.percent,.pill{display:inline-block;border-radius:999px;padding:3px 8px;font-weight:900}.ok{background:#e5f6ec;color:#107338}.warn{background:#fff3d6;color:#8a5c00}.bad{background:#ffe5e5;color:#9d2020}.neutral{background:#edf1f4;color:#52616b}.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:8px}.kpi{background:#fff;border:1px solid #d9e6e1;border-radius:13px;padding:9px;text-align:center}.kpi strong{display:block;color:#0a5a49;font-size:16px}.kpi span{font-size:10px;color:#68766e}.bottom{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.panel{background:#fff;border:1px solid #d9e6e1;border-radius:12px;padding:9px}.panel h3{margin:0 0 8px;color:#0a5a49}.line{height:22px;border-bottom:1px dashed #afbeb8}.footer{text-align:center;margin-top:8px;color:#6a766f}.avoid{break-inside:avoid}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page{border-radius:0}.super-card,.kpi,.panel{break-inside:avoid}}</style></head><body><div class="page"><div class="top"><div class="brand"><div class="logo">تصنيف</div><div><h2>شركة تصنيف</h2><small>إدارة المرافق والتشغيل</small></div></div><div class="title"><h1>تقرير الأوقات الشهرية</h1><p>المسؤول: وائل شاكر</p></div></div><div class="meta"><div class="box"><b>الشهر</b><strong>${reportEscV52(monthLabelV57(month))}</strong></div><div class="box"><b>المشرف</b><strong>${reportEscV52(sup)}</strong></div><div class="box"><b>عدد المشاريع</b><strong>${rows.length}</strong></div><div class="box"><b>نسبة الالتزام الإجمالية</b><strong>${reportEscV52(percentText(commitmentTotal))}</strong></div></div><div class="section"><span>ملخص المشرفين والمشاريع</span></div><div class="super-grid avoid">${groupCards}</div><div class="section"><span>تفاصيل الأوقات الشهرية</span></div><table class="details"><thead><tr><th>المشرف</th><th>المشروع</th><th>أسماء العمال</th><th>الوقت اليومي المطلوب</th><th>إجمالي الوقت المطلوب</th><th>الوقت الفعلي</th><th>الفرق</th><th>نسبة العمل</th><th>نسبة الالتزام</th><th>حالة الوقت</th></tr></thead><tbody>${detailRows}</tbody></table><div class="section"><span>ملخص التقرير</span></div><div class="kpis"><div class="kpi"><strong>${reportEscV52(minsToText(actualTotal))}</strong><span>إجمالي الوقت الفعلي</span></div><div class="kpi"><strong>${reportEscV52(minsToText(requiredTotal))}</strong><span>إجمالي الوقت المطلوب</span></div><div class="kpi"><strong>${reportEscV52(monthlyDiffTextV57(actualTotal-requiredTotal))}</strong><span>إجمالي فرق الوقت</span></div><div class="kpi"><strong>${reportEscV52(percentText(commitmentTotal))}</strong><span>نسبة الالتزام</span></div><div class="kpi"><strong>${over}</strong><span>زيادة وقت</span></div><div class="kpi"><strong>${under}</strong><span>ناقص وقت</span></div></div><div class="bottom"><div class="panel"><h3>ملاحظات المدير</h3><div class="line"></div><div class="line"></div></div><div class="panel"><h3>اعتماد مدير التشغيل</h3><p>الاسم: وائل شاكر</p><div class="line">التوقيع:</div></div></div><div class="footer">ملاحظة: الوقت اليومي المطلوب هو وقت المشروع في اليوم الواحد. إجمالي الوقت المطلوب = اليومي × عدد أيام الزيارة الفعلية في الفترة. نسبة العمل = وقت المشروع ÷ إجمالي وقت المشرف. نسبة الالتزام = الفعلي ÷ إجمالي المطلوب.</div><script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></div></body></html>`;
    const w=window.open('','_blank');
    if(!w){ msg('المتصفح منع فتح نافذة التقرير. اسمح بالنوافذ المنبثقة','err'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  };

  setTimeout(()=>{ try{ if($('monthlyBody')) renderMonthly(); }catch(e){} }, 800);
})();


/* ===== V84: Internal Tasneef Assistant - no API ===== */
(function(){
  let assistantMessages = [];
  let assistantLastReply = '';
  function normAr(s){return String(s||'').toLowerCase().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();}
  function safe(s){return (typeof esc==='function'?esc(s):String(s??''));}
  function getProjectByText(text){
    const n=normAr(text);
    return (data.projects||[]).find(p=>n.includes(normAr(p.name))) || null;
  }
  function getSupervisorByText(text){
    const n=normAr(text);
    return (data.supervisors||data.users||[]).find(u=>u.role==='supervisor' && n.includes(normAr(u.full_name||u.username))) || null;
  }
  function arDate(d=new Date()){try{return d.toLocaleDateString('ar-SA',{year:'numeric',month:'2-digit',day:'2-digit'})}catch(e){return today();}}
  function projectWorkersText(projectId){
    const rows=(data.workers||[]).filter(w=>String(workerProjectId?.(w)||w.project_id||'')===String(projectId));
    const names=[...new Set(rows.map(w=>w.name).filter(Boolean))];
    return names.length?names.join('، '):'حسب فريق المشروع';
  }
  function makeReport(q){
    const p=getProjectByText(q); const project=p?.name || 'اسم المشروع';
    const n=normAr(q);
    let title='تقرير تنفيذ أعمال'; let body='تم تنفيذ الأعمال المطلوبة بالمشروع وفق الخطة التشغيلية المعتمدة، مع متابعة جودة التنفيذ والتأكد من نظافة الموقع بعد الانتهاء.';
    if(n.includes('مكافحه')||n.includes('حشرات')||n.includes('مبيد')){title='تقرير مكافحة الحشرات';body='تم تنفيذ أعمال مكافحة الحشرات في مرافق المشروع، مع التركيز على الممرات والمداخل ومناطق الخدمات، وتمت المتابعة للتأكد من سلامة التنفيذ.';}
    else if(n.includes('خزان')||n.includes('خزانات')){title='تقرير تنظيف الخزانات';body='تم تنفيذ أعمال تنظيف وغسيل الخزانات حسب الإجراءات التشغيلية، مع العناية بمراحل التنظيف والشطف والتأكد من جاهزية الخزانات بعد الانتهاء.';}
    else if(n.includes('بيسمنت')||n.includes('قبو')){title='تقرير تنظيف البيسمنت';body='تم تنفيذ أعمال تنظيف البيسمنت وإزالة الأتربة والمخلفات، مع ترتيب الموقع وتحسين مستوى النظافة العام.';}
    else if(n.includes('سطح')||n.includes('اسطح')){title='تقرير تنظيف الأسطح';body='تم تنفيذ أعمال تنظيف الأسطح وإزالة الأتربة والمخلفات، مع التأكد من نظافة مجاري التصريف والمناطق المحيطة.';}
    else if(n.includes('صيان')){title='تقرير صيانة';body='تمت مباشرة أعمال الصيانة المطلوبة ومعالجة الملاحظة حسب المتاح في الموقع، وسيتم متابعة الحالة لضمان عدم تكرار المشكلة.';}
    return `السلام عليكم ورحمة الله وبركاته\n\n${title}\n\nالمشروع: ${project}\nالتاريخ: ${arDate()}\n\n${body}\n\nوتفضلوا بقبول فائق التحية والتقدير\nشركة تصنيف لإدارة المرافق`;
  }
  function makeMessage(q){
    const p=getProjectByText(q); const project=p?.name || 'اسم المشروع'; const n=normAr(q);
    if(n.includes('خزان')||n.includes('خزانات')) return `السلام عليكم ورحمة الله وبركاته\n\nالسادة سكان / ملاك مشروع ${project} المحترمين\n\nنفيدكم بأنه سيتم تنفيذ أعمال غسيل الخزانات حسب الموعد المحدد، ونأمل من الجميع أخذ العلم باحتمالية تأثر المياه خلال فترة العمل.\n\nشاكرين لكم تعاونكم.\nشركة تصنيف لإدارة المرافق`;
    if(n.includes('حشرات')||n.includes('مبيد')) return `السلام عليكم ورحمة الله وبركاته\n\nالسادة سكان / ملاك مشروع ${project} المحترمين\n\nنفيدكم بأنه سيتم تنفيذ أعمال مكافحة الحشرات في المشروع، ونأمل إغلاق النوافذ وإبعاد الأغراض الشخصية عن مناطق الرش قدر الإمكان.\n\nشاكرين لكم تعاونكم.\nشركة تصنيف لإدارة المرافق`;
    if(n.includes('اعتماد')) return `السلام عليكم ورحمة الله وبركاته\n\nمرفق لسيادتكم طلب اعتماد بخصوص مشروع ${project}.\nنأمل الاطلاع والتوجيه بما ترونه مناسبًا حتى نتمكن من استكمال الإجراء.\n\nوتفضلوا بقبول فائق التحية والتقدير\nشركة تصنيف لإدارة المرافق`;
    return `السلام عليكم ورحمة الله وبركاته\n\nبخصوص مشروع ${project}:\nنفيدكم بأنه تم متابعة الملاحظة، وسيتم اتخاذ اللازم حسب الخطة التشغيلية.\n\nشركة تصنيف لإدارة المرافق`;
  }
  function openLogsReply(){
    const d=today(); const rows=(data.logs||[]).filter(l=>(l.log_date||String(l.check_in||'').slice(0,10))===d && l.check_in && !l.check_out);
    if(!rows.length) return 'لا توجد سجلات مفتوحة اليوم. جميع السجلات الحالية مكتملة أو لا توجد بيانات مفتوحة.';
    return 'السجلات المفتوحة اليوم:\n\n'+rows.map((l,i)=>`${i+1}. المشرف: ${supervisorName(l.supervisor_id)}\nالمشروع: ${projectName(l.project_id)}\nوقت الدخول: ${timeOnly(l.check_in)}`).join('\n\n');
  }
  function weakMonthlyReply(){
    const month=($('monthlyMonth')?.value)||today().slice(0,7); const start=month+'-01'; const end=month+'-31';
    const groups={};
    (data.logs||[]).filter(l=>{const d=l.log_date||String(l.check_in||'').slice(0,10);return d>=start&&d<=end&&l.check_in&&l.check_out;}).forEach(l=>{
      const key=[l.supervisor_id,l.project_id].join('|'); if(!groups[key]) groups[key]={sid:l.supervisor_id,pid:l.project_id,actual:0,requiredDays:new Set(),dailyReq:0};
      const d=l.log_date||String(l.check_in||'').slice(0,10); groups[key].actual += logActualMinutes(l); groups[key].requiredDays.add(d); groups[key].dailyReq = logRequiredMinutes(l)||groups[key].dailyReq;
    });
    const weak=Object.values(groups).map(g=>{const req=(g.dailyReq||0)*g.requiredDays.size; const pct=req?g.actual/req*100:0; return {...g,req,pct};}).filter(g=>g.req && g.pct<90).sort((a,b)=>a.pct-b.pct).slice(0,12);
    if(!weak.length) return `لا توجد مشاريع ناقصة وقت في شهر ${month} حسب البيانات الحالية.`;
    return `المشاريع الناقصة وقت في شهر ${month}:\n\n`+weak.map((g,i)=>`${i+1}. ${projectName(g.pid)} — ${supervisorName(g.sid)}\nالفعلي: ${minsToText(g.actual)} / المطلوب: ${minsToText(g.req)} — الالتزام: ${g.pct.toFixed(1)}%`).join('\n\n');
  }
  function dailySummaryReply(){
    const d=today(); const rows=(data.logs||[]).filter(l=>(l.log_date||String(l.check_in||'').slice(0,10))===d);
    const done=rows.filter(l=>l.check_in&&l.check_out); const open=rows.filter(l=>l.check_in&&!l.check_out); const mins=done.reduce((a,l)=>a+logActualMinutes(l),0);
    return `ملخص تشغيل اليوم ${d}:\n\nعدد التسجيلات: ${rows.length}\nالسجلات المكتملة: ${done.length}\nالسجلات المفتوحة: ${open.length}\nإجمالي ساعات العمل: ${minsToText(mins)}\n\n${open.length?'يوجد سجلات مفتوحة تحتاج متابعة.':'لا توجد سجلات مفتوحة حاليًا.'}`;
  }
  function designNotice(q){
    const p=getProjectByText(q); const project=p?.name||'اسم المشروع'; const n=normAr(q); let title='إشعار هام'; let line='نرجو من الجميع الالتزام بما ورد في هذا الإشعار.';
    if(n.includes('قمامه')||n.includes('نفايات')){title='موعد جمع النفايات'; line='موعد جمع النفايات اليومي: 4:00 عصرًا. نأمل إخراج النفايات في الوقت المحدد.';}
    else if(n.includes('سيارات')||n.includes('ابعاد')){title='تنبيه إبعاد السيارات'; line='نأمل إبعاد السيارات عن منطقة العمل خلال الفترة المحددة لتسهيل تنفيذ الأعمال.';}
    else if(n.includes('خزان')){title='إشعار غسيل الخزانات'; line='سيتم تنفيذ أعمال غسيل الخزانات حسب الموعد المحدد، ونأمل أخذ الاحتياطات اللازمة.';}
    return `${title}\n\nالمشروع: ${project}\n\n${line}\n\nشركة تصنيف لإدارة المرافق`;
  }
  function fallbackReply(){return 'أقدر أساعدك في:\n1. كتابة تقرير تشغيل أو تنظيف أو صيانة\n2. كتابة رسالة واتساب أو خطاب\n3. عرض السجلات المفتوحة اليوم\n4. تحليل المشاريع الناقصة وقت هذا الشهر\n5. إنشاء نص إعلان جاهز للطباعة\n\nاكتب طلبك مثل: اكتب تقرير مكافحة حشرات لمشروع صفاء 50';}
  function answer(q){
    const n=normAr(q);
    if(n.includes('سجلات مفتوحه')||n.includes('بدون خروج')||n.includes('لم يسجل خروج')) return openLogsReply();
    if(n.includes('ناقص') && (n.includes('وقت')||n.includes('شهر'))) return weakMonthlyReply();
    if(n.includes('ملخص')||n.includes('تحليل اليوم')||n.includes('تشغيل اليوم')) return dailySummaryReply();
    if(n.includes('تقرير')) return makeReport(q);
    if(n.includes('رساله')||n.includes('واتساب')||n.includes('خطاب')) return makeMessage(q);
    if(n.includes('تصميم')||n.includes('اعلان')||n.includes('اشعار')||n.includes('تنبيه')) return designNotice(q);
    return fallbackReply();
  }
  function addMsg(role,text){assistantMessages.push({role,text}); assistantLastReply=role==='bot'?text:assistantLastReply; renderTasneefAssistant();}
  window.renderTasneefAssistant=function(){
    const box=$('assistantChat'); if(!box) return;
    if(!assistantMessages.length){box.innerHTML=`<div class="assistant-empty">اكتب طلبك أو اختر أحد الأزرار السريعة. هذا المساعد يعمل بدون API وبدون تكلفة.</div>`; return;}
    box.innerHTML=assistantMessages.map(m=>`<div class="assistant-msg ${m.role==='user'?'user':'bot'}"><b>${m.role==='user'?'أنت':'مساعد تصنيف'}</b><pre>${safe(m.text)}</pre></div>`).join('');
    box.scrollTop=box.scrollHeight;
  };
  window.assistantSend=function(){const input=$('assistantInput'); const q=(input?.value||'').trim(); if(!q) return msg('اكتب طلبك أولًا','err'); addMsg('user',q); input.value=''; addMsg('bot',answer(q));};
  window.assistantQuick=function(q){const input=$('assistantInput'); if(input) input.value=q; window.assistantSend();};
  window.assistantCopyLast=function(){if(!assistantLastReply)return msg('لا يوجد رد لنسخه','err'); (navigator.clipboard?.writeText(assistantLastReply)||Promise.resolve()).then(()=>msg('تم نسخ الرد'));};
  window.assistantWhatsappLast=function(){if(!assistantLastReply)return msg('لا يوجد رد لإرساله','err'); try{navigator.clipboard?.writeText(assistantLastReply)}catch(e){} window.open('https://wa.me/?text='+encodeURIComponent(assistantLastReply),'_blank');};
  window.assistantPrintLast=function(){if(!assistantLastReply)return msg('لا يوجد رد للطباعة','err'); const w=window.open('','_blank'); w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>مساعد تصنيف</title><style>body{font-family:Tahoma,Arial;padding:30px;line-height:1.9;white-space:pre-wrap;color:#0A4033}</style></head><body>${safe(assistantLastReply)}<script>window.onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`); w.document.close();};
  window.assistantClear=function(){assistantMessages=[]; assistantLastReply=''; renderTasneefAssistant();};
})();



/* ===== V89 Manual Contract Services - Clean Rebuild ===== */
function showContractsSubTab(tab){
  const contracts=$('contractsSubTab'), services=$('servicesSubTab');
  if(contracts) contracts.classList.toggle('hidden', tab!=='contracts');
  if(services) services.classList.toggle('hidden', tab!=='services');
  $('contractsTabBtn')?.classList.toggle('light', tab!=='contracts');
  $('servicesTabBtn')?.classList.toggle('light', tab!=='services');
  if(tab==='services') renderContractServices();
}
function normalizeArV89(s){return String(s||'').trim().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ')}
function csProjectObj(s){
  const pid=s?.project_id;
  if(pid){const p=data.projects.find(x=>String(x.id)===String(pid)); if(p) return p;}
  const n=normalizeArV89(s?.project_name||'');
  if(!n) return null;
  return data.projects.find(p=>normalizeArV89(p.name)===n || normalizeArV89(p.name).includes(n) || n.includes(normalizeArV89(p.name))) || null;
}
function csProjectName(s){return csProjectObj(s)?.name || s?.project_name || '-'}
function csSupervisorId(s){return s?.supervisor_id || csProjectObj(s)?.supervisor_id || null}
function csSupervisorName(s){return s?.supervisor_name || supervisorName(csSupervisorId(s)) || '-'}
function csServiceName(s){return s?.service_name || '-'}
function csServiceType(s){return s?.service_type || s?.service_name || 'أخرى'}
function csFrequency(s){return s?.frequency || 'مرة واحدة'}
function csVisits(s){return Number(s?.visit_count||1)||1}
function csDone(s){return Number(s?.executed_count||0)||0}
function csRemaining(s){const rem=s?.remaining_count; if(rem!==undefined&&rem!==null&&String(rem)!=='') return Math.max(Number(rem)||0,0); return Math.max(csVisits(s)-csDone(s),0)}
function csLastDate(s){return isoDate(s?.last_execution_date||'')}
function csDueDate(s){return isoDate(s?.next_due_date||'')}
function csExecutor(s){return s?.executor_name || '-'}
function csNotes(s){return s?.notes || ''}
function csStatusKey(s){
  const explicit=normalizeArV89(s?.status||'');
  const due=csDueDate(s); const t=today();
  if(explicit.includes('خارج')) return 'out';
  if(explicit.includes('متوقف')) return 'stopped';
  if(explicit.includes('منجز')) return 'done';
  if(explicit.includes('متاخر')) return 'late';
  if(explicit.includes('قريب')) return 'soon';
  if(explicit.includes('مستحق')) return 'due';
  if(explicit.includes('مراجعه') || explicit.includes('غير منفذ')) return 'review';
  if(due && due<t) return 'late';
  if(due){ const diff=Math.round((new Date(due+'T00:00:00')-new Date(t+'T00:00:00'))/86400000); if(diff>=0 && diff<=7) return 'soon'; }
  if(csRemaining(s)<=0 && csDone(s)>0) return 'done';
  return 'due';
}
function csStatusText(key){return {done:'منجزة',due:'مستحقة',soon:'قريبة',late:'متأخرة',review:'مراجعة / غير منفذة',out:'خارج العقد',stopped:'متوقفة'}[key]||'مستحقة'}
function csBadgeClass(key){return key==='done'?'green':key==='late'?'red':key==='soon'?'amber':key==='out'?'neutral':key==='stopped'?'neutral':'amber'}
function serviceById(id){return (data.contractServices||[]).find(s=>String(s.id)===String(id));}
function hydrateServiceTypes(){
  const el=$('serviceFilterType'); if(!el) return;
  const current=el.value;
  const types=[...new Set((data.contractServices||[]).map(csServiceType).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  el.innerHTML='<option value="">كل أنواع الخدمة</option>'+types.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  el.value=current;
}
function getFilteredContractServices(){
  let rows=[...(data.contractServices||[])];
  const q=normalizeArV89($('serviceSearch')?.value||'');
  const pid=$('serviceFilterProject')?.value||'';
  const sid=$('serviceFilterSupervisor')?.value||'';
  const st=$('serviceFilterStatus')?.value||'';
  const typ=$('serviceFilterType')?.value||'';
  const d=$('serviceFilterDate')?.value||'';
  if(q) rows=rows.filter(s=>normalizeArV89([csProjectName(s),csSupervisorName(s),csServiceName(s),csServiceType(s),csNotes(s)].join(' ')).includes(q));
  if(pid) rows=rows.filter(s=>String(csProjectObj(s)?.id||s.project_id||'')===String(pid));
  if(sid) rows=rows.filter(s=>String(csSupervisorId(s)||'')===String(sid));
  if(st) rows=rows.filter(s=>csStatusKey(s)===st);
  if(typ) rows=rows.filter(s=>csServiceType(s)===typ);
  if(d) rows=rows.filter(s=>csDueDate(s)===d || csLastDate(s)===d);
  return rows.sort((a,b)=>String(csDueDate(a)||'9999').localeCompare(String(csDueDate(b)||'9999')) || String(csProjectName(a)).localeCompare(String(csProjectName(b)),'ar'));
}
function renderContractServices(){
  if(!$('contractServicesBody')) return;
  hydrateServiceTypes();
  financeHydrateForms();
  const rows=getFilteredContractServices();
  const all=data.contractServices||[];
  const counts={total:all.length,due:0,soon:0,done:0,late:0,review:0};
  all.forEach(s=>{const k=csStatusKey(s); if(k==='done')counts.done++; else if(k==='late')counts.late++; else if(k==='soon')counts.soon++; else if(k==='review')counts.review++; else if(k==='due')counts.due++;});
  if($('servicesTotalCount')) $('servicesTotalCount').textContent=counts.total;
  if($('servicesDueCount')) $('servicesDueCount').textContent=counts.due;
  if($('servicesDoneCount')) $('servicesDoneCount').textContent=counts.done;
  if($('servicesSoonCount')) $('servicesSoonCount').textContent=counts.soon;
  if($('servicesLateCount')) $('servicesLateCount').textContent=counts.late;
  if($('servicesReviewCount')) $('servicesReviewCount').textContent=counts.review;
  const emptyMsg = data.contractServicesError ? ('تعذر تحميل الخدمات: '+esc(data.contractServicesError)) : 'لا توجد خدمات بعد. اضغط إضافة خدمة وأدخلها يدويًا.';
  $('contractServicesBody').innerHTML = rows.slice(0,500).map(s=>{
    const k=csStatusKey(s);
    return `<tr>
      <td><b>${esc(csProjectName(s))}</b></td>
      <td>${esc(csSupervisorName(s))}</td>
      <td><b>${esc(csServiceName(s))}</b></td>
      <td>${esc(csServiceType(s))}</td>
      <td>${esc(csFrequency(s))}</td>
      <td>${csVisits(s)}</td>
      <td>${esc(csExecutor(s))}</td>
      <td>${csDone(s)}</td>
      <td>${csRemaining(s)}</td>
      <td>${esc(csLastDate(s)||'-')}</td>
      <td>${esc(csDueDate(s)||'-')}</td>
      <td><span class="badge ${csBadgeClass(k)}">${csStatusText(k)}</span></td>
      <td>${esc(csNotes(s)||'-')}</td>
      <td class="row-actions"><button onclick="executeContractService(${Number(s.id)||0})">تسجيل تنفيذ</button><button class="light" onclick="editContractService(${Number(s.id)||0})">تعديل</button><button class="light" onclick="whatsappContractService(${Number(s.id)||0})">واتساب</button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="14">${emptyMsg}</td></tr>`;
  renderSmartServicesList();
  showSupervisorServicesPreview(false);
}
function resetServiceFilters(){['serviceSearch','serviceFilterProject','serviceFilterSupervisor','serviceFilterStatus','serviceFilterType','serviceFilterDate'].forEach(id=>{if($(id))$(id).value=''}); renderContractServices();}
function projectPromptMatch(project){
  const p=data.projects.find(x=>String(x.id)===String(project)) || data.projects.find(x=>normalizeArV89(x.name)===normalizeArV89(project)) || data.projects.find(x=>normalizeArV89(x.name).includes(normalizeArV89(project)) || normalizeArV89(project).includes(normalizeArV89(x.name)));
  return p||null;
}
async function openNewContractService(){
  const project=prompt('اسم المشروع كما هو في التطبيق'); if(!project) return;
  const p=projectPromptMatch(project); if(!p) return msg('لم أجد المشروع. اكتب الاسم كما يظهر في التطبيق.','err');
  const service=prompt('اسم الخدمة مثال: غسيل خزانات علوية / مكافحة حشرات'); if(!service) return;
  const type=prompt('نوع الخدمة', service) || service;
  const freq=prompt('التكرار: سنوي / ربع سنوي / شهري / عند الاحتياج', 'سنوي') || 'سنوي';
  const visits=Number(prompt('عدد الزيارات المطلوبة خلال العقد', '1')||1);
  const due=prompt('تاريخ الاستحقاق القادم YYYY-MM-DD', today()) || null;
  const notes=prompt('ملاحظات', '') || '';
  const sid=p.supervisor_id||null; const supName=supervisorName(sid)||'';
  const row={project_id:p.id, project_name:p.name, supervisor_id:sid, supervisor_name:supName, service_name:service, service_type:type, frequency:freq, visit_count:visits, executed_count:0, remaining_count:visits, last_execution_date:null, next_due_date:due, status:'مستحقة', executor_name:'', notes, created_at:new Date().toISOString(), updated_at:new Date().toISOString()};
  const {error}=await sb.from('contract_services').insert(row);
  if(error) return msg(error.message,'err');
  resetServiceFilters();
  if($('serviceSearch')) $('serviceSearch').value=service;
  msg('تمت إضافة الخدمة بنجاح');
  await refreshAll();
}
async function editContractService(id){
  const s=serviceById(id); if(!s) return msg('الخدمة غير موجودة','err');
  const service=prompt('اسم الخدمة', csServiceName(s)); if(!service) return;
  const type=prompt('نوع الخدمة', csServiceType(s)) || service;
  const freq=prompt('التكرار', csFrequency(s)) || 'مرة واحدة';
  const visits=Number(prompt('عدد الزيارات المطلوبة', String(csVisits(s)||1))||1);
  const executed=Number(prompt('عدد الزيارات المنفذة', String(csDone(s)||0))||0);
  const due=prompt('تاريخ الاستحقاق القادم YYYY-MM-DD', csDueDate(s)||'') || null;
  const last=prompt('آخر تنفيذ YYYY-MM-DD', csLastDate(s)||'') || null;
  const status=prompt('الحالة: مستحقة / قريبة / متأخرة / منجزة / مراجعة / خارج العقد', csStatusText(csStatusKey(s))) || csStatusText(csStatusKey(s));
  const executor=prompt('المنفذ / الشركة المنفذة', csExecutor(s)==='-'?'':csExecutor(s)) || '';
  const notes=prompt('ملاحظات', csNotes(s)||'') || '';
  const remaining=Math.max(visits-executed,0);
  const {error}=await sb.from('contract_services').update({service_name:service, service_type:type, frequency:freq, visit_count:visits, executed_count:executed, remaining_count:remaining, next_due_date:due, last_execution_date:last, status, executor_name:executor, notes, updated_at:new Date().toISOString()}).eq('id',id);
  if(error) return msg(error.message,'err');
  msg('تم تعديل الخدمة'); await refreshAll();
}
async function executeContractService(id){
  const s=serviceById(id); if(!s) return msg('الخدمة غير موجودة','err');
  const d=prompt('تاريخ التنفيذ', today()); if(!d) return;
  const executor=prompt('المنفذ / الشركة المنفذة', csExecutor(s)==='-'?'':csExecutor(s)) || '';
  const notes=prompt('ملاحظات التنفيذ', csNotes(s)||'') || '';
  const done=(csDone(s)||0)+1; const visits=Math.max(csVisits(s)||1, done); const remaining=Math.max(visits-done,0);
  let next=null;
  if(remaining>0){ next=prompt('تاريخ الاستحقاق القادم للزيارة التالية YYYY-MM-DD', csDueDate(s)||'') || null; }
  const st=remaining>0?'مستحقة':'منجزة';
  const {error}=await sb.from('contract_services').update({last_execution_date:d, executed_count:done, remaining_count:remaining, executor_name:executor, notes, status:st, next_due_date:next, updated_at:new Date().toISOString()}).eq('id',id);
  if(error) return msg(error.message,'err');
  msg('تم تسجيل تنفيذ الخدمة'); await refreshAll();
}
function whatsappContractService(id){
  const s=serviceById(id); if(!s) return msg('الخدمة غير موجودة','err');
  const txt=`السلام عليكم ورحمة الله وبركاته\n\nتقرير خدمة تعاقدية\nالمشروع: ${csProjectName(s)}\nالمشرف: ${csSupervisorName(s)}\nالخدمة: ${csServiceName(s)}\nالحالة: ${csStatusText(csStatusKey(s))}\nعدد الزيارات: ${csVisits(s)}\nالمنفذ: ${csDone(s)}\nالمتبقي: ${csRemaining(s)}\nآخر تنفيذ: ${csLastDate(s)||'-'}\nالاستحقاق القادم: ${csDueDate(s)||'-'}\nملاحظات: ${csNotes(s)||'-'}\n\nشركة تصنيف لإدارة المرافق`;
  window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
}
function renderSmartServicesList(){
  const el=$('smartServicesList'); if(!el) return;
  const rows=(data.contractServices||[]).filter(s=>!['done','out','stopped'].includes(csStatusKey(s))).sort((a,b)=>{const order={late:0,due:1,soon:2,review:3}; return (order[csStatusKey(a)]??9)-(order[csStatusKey(b)]??9);}).slice(0,8);
  el.innerHTML=rows.map((s,i)=>{const dd=csDueDate(s)||new Date(Date.now()+(i+1)*86400000).toISOString().slice(0,10); const k=csStatusKey(s); return `<div class="quick-item"><span><b>${esc(csServiceName(s))}</b><br><small>${esc(csProjectName(s))} — ${esc(dd)}</small></span><span class="badge ${csBadgeClass(k)}">${csStatusText(k)}</span></div>`}).join('') || '<div class="quick-item">لا توجد خدمات تحتاج جدولة</div>';
}
function showSupervisorServicesPreview(scroll=true){
  const el=$('supervisorServicesPreview'); if(!el) return;
  const sid=$('serviceFilterSupervisor')?.value || (data.supervisors[0]?.id||'');
  const rows=(data.contractServices||[]).filter(s=>String(csSupervisorId(s)||'')===String(sid) && !['done','out','stopped'].includes(csStatusKey(s))).slice(0,6);
  el.innerHTML=rows.map(s=>`<div class="quick-item"><span><b>${esc(csServiceName(s))}</b><br><small>${esc(csProjectName(s))} — ${esc(csDueDate(s)||'-')}</small></span><span class="badge ${csBadgeClass(csStatusKey(s))}">${csStatusText(csStatusKey(s))}</span></div>`).join('') || '<div class="quick-item">لا توجد خدمات مخصصة للمشرف المختار</div>';
  if(scroll) el.scrollIntoView({behavior:'smooth',block:'nearest'});
}
async function smartScheduleContractServices(){
  const rows=(data.contractServices||[]).filter(s=>!['done','out','stopped'].includes(csStatusKey(s))).sort((a,b)=>{const order={late:0,due:1,soon:2,review:3}; return (order[csStatusKey(a)]??9)-(order[csStatusKey(b)]??9);}).slice(0,20);
  if(!rows.length) return msg('لا توجد خدمات غير منفذة للجدولة');
  let base=new Date(); let updates=[];
  rows.forEach((s,i)=>{ const d=new Date(base.getTime()+(i+1)*86400000); const ds=d.toISOString().slice(0,10); updates.push(sb.from('contract_services').update({next_due_date:ds, status:csStatusKey(s)==='late'?'متأخرة':'مستحقة', updated_at:new Date().toISOString()}).eq('id',s.id)); });
  const results=await Promise.all(updates); const err=results.find(r=>r.error)?.error; if(err) return msg(err.message,'err'); msg('تمت الجدولة الذكية للخدمات غير المنفذة'); await refreshAll();
}
function exportContractServicesCSV(){
  const rows=getFilteredContractServices();
  const header=['المشروع','المشرف','الخدمة','نوع الخدمة','التكرار','عدد الزيارات','المنفذ','المنفذ فعليًا','المتبقي','آخر تنفيذ','الاستحقاق القادم','الحالة','ملاحظات'];
  const lines=[header,...rows.map(s=>[csProjectName(s),csSupervisorName(s),csServiceName(s),csServiceType(s),csFrequency(s),csVisits(s),csExecutor(s),csDone(s),csRemaining(s),csLastDate(s)||'',csDueDate(s)||'',csStatusText(csStatusKey(s)),csNotes(s)])];
  const csv='\uFEFF'+lines.map(r=>r.map(c=>'"'+String(c??'').replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='contract_services_manual.csv'; a.click(); URL.revokeObjectURL(a.href);
}

/* ===== V91: جذر منع التهنيج - تحميل كسول ومحدود للسجلات ===== */
(function(){
  const LOG_COLS = 'id,user_id,supervisor_id,project_id,check_in,check_out,duration_minutes,travel_minutes,visit_type,required_minutes,time_difference_minutes,time_status,notes,created_at,updated_at,log_date';
  const loadedLogRanges = new Set();
  const inflightRanges = new Set();
  const oldRenderMonthly = window.renderMonthly || (typeof renderMonthly==='function'?renderMonthly:null);

  function iso(d){ return d.toISOString().slice(0,10); }
  function addDays(dateStr, days){ const d=new Date(dateStr+'T00:00:00'); d.setDate(d.getDate()+days); return iso(d); }
  function monthStart(month){ return (month || today().slice(0,7)) + '-01'; }
  function monthEnd(month){ const [y,m]=(month || today().slice(0,7)).split('-').map(Number); return iso(new Date(y, m, 0)); }
  function currentMonth(){ return today().slice(0,7); }
  function mergeLogs(rows){
    const map = new Map((data.logs||[]).map(l=>[String(l.id), l]));
    (rows||[]).forEach(l=>{ if(l && l.id!=null) map.set(String(l.id), l); });
    data.logs = [...map.values()].sort((a,b)=>String(b.check_in||b.created_at||'').localeCompare(String(a.check_in||a.created_at||'')));
  }
  async function safeQuery(name, builder, fallback=[]){
    try{
      const res = await builder;
      if(res.error){ console.warn('تعذر تحميل '+name+':', res.error.message); return {data:fallback,error:res.error}; }
      return {data:res.data||fallback,error:null};
    }catch(e){ console.warn('تعذر تحميل '+name+':', e?.message||e); return {data:fallback,error:e}; }
  }

  window.fetchTimeLogsRangeV91 = async function(start, end, options={}){
    if(!start || !end) return [];
    const key = `${start}_${end}_${options.supervisorId||'all'}`;
    if(loadedLogRanges.has(key)) return data.logs || [];
    if(inflightRanges.has(key)) return data.logs || [];
    inflightRanges.add(key);
    try{
      let q = sb.from('time_logs')
        .select(LOG_COLS)
        .gte('log_date', start)
        .lte('log_date', end)
        .order('id', {ascending:false})
        .limit(options.limit || 2000);
      if(options.supervisorId) q = q.eq('supervisor_id', options.supervisorId);
      const res = await q;
      if(res.error){
        console.warn('تعذر تحميل سجلات الفترة:', res.error.message);
        data.logsLoadError = res.error.message;
        return data.logs || [];
      }
      mergeLogs(res.data || []);
      loadedLogRanges.add(key);
      data.logsLoadError = '';
      return data.logs || [];
    }catch(e){
      console.warn('تعذر تحميل سجلات الفترة:', e?.message||e);
      data.logsLoadError = e?.message || String(e);
      return data.logs || [];
    }finally{
      inflightRanges.delete(key);
    }
  };

  window.loadAll = async function(){
    const d=today();
    const cm=currentMonth();
    const start=monthStart(cm);
    const end=monthEnd(cm);

    const usersP = safeQuery('المستخدمين', sb.from('app_users').select('*').order('id'));
    const projectsP = safeQuery('المشاريع', sb.from('projects').select('*').order('id'));
    const workersP = safeQuery('العمال', sb.from('workers').select('*').order('id'));
    const attendanceP = safeQuery('الحضور', sb.from('attendance').select('*').gte('attendance_date', addDays(d,-45)).order('attendance_date',{ascending:false}).limit(2000));
    const ticketsP = safeQuery('التكتات', sb.from('tickets').select('*').order('id',{ascending:false}).limit(1000));
    const servicesP = safeQuery('الخدمات', sb.from('contract_services').select('*').order('id',{ascending:false}).limit(1000));

    const [users, projects, workers, attendance, tickets, contractServices] = await Promise.all([usersP,projectsP,workersP,attendanceP,ticketsP,servicesP]);

    data.users = users.data || [];
    data.supervisors = data.users.filter(u=>u.role==='supervisor' && u.is_active!==false);
    data.technicians = data.users.filter(u=>u.role==='technician' && u.is_active!==false);
    data.projects = projects.data || [];
    data.workers = workers.data || [];
    data.attendance = attendance.data || [];
    data.tickets = tickets.data || [];
    data.contractServices = contractServices.data || [];
    data.contractServicesError = contractServices.error ? contractServices.error.message : '';

    // تحميل السجلات منفصلًا حتى لا يوقف التطبيق لو فشل time_logs
    await window.fetchTimeLogsRangeV91(start, end, {limit: 2000});
  };

  window.refreshAll = async function(){
    try{ await window.loadAll(); }
    catch(e){ console.error('loadAll V91 failed', e); msg && msg('تعذر تحميل بعض البيانات، لكن التطبيق سيستمر بالعمل','err'); }
    try{ hydrateForms(); }catch(e){ console.warn('hydrateForms failed', e); }
    try{ renderAll(); }catch(e){ console.warn('renderAll failed', e); }
  };

  window.renderMonthly = function(){
    const body=$('monthlyBody');
    const month=$('monthlyMonth')?.value || today().slice(0,7);
    const start=monthStart(month), end=monthEnd(month);
    const key=`${start}_${end}_all`;
    if(body && !loadedLogRanges.has(key) && !inflightRanges.has(key)){
      body.innerHTML='<tr><td colspan="12">جاري تحميل سجلات الشهر من السحابة...</td></tr>';
      window.fetchTimeLogsRangeV91(start,end,{limit:3000}).then(()=>{
        try{ if(oldRenderMonthly) oldRenderMonthly(); }catch(e){ console.warn(e); }
      });
      return;
    }
    if(oldRenderMonthly) return oldRenderMonthly();
  };

  window.exportTable = async function(table){
    let rows=[]; let error=null;
    if(table==='time_logs'){
      const month=$('monthlyMonth')?.value || today().slice(0,7);
      const start=monthStart(month), end=monthEnd(month);
      const res=await sb.from('time_logs').select(LOG_COLS).gte('log_date',start).lte('log_date',end).order('id',{ascending:false}).limit(5000);
      rows=res.data||[]; error=res.error;
    }else{
      const res=await sb.from(table).select('*').limit(5000);
      rows=res.data||[]; error=res.error;
    }
    if(error) return msg(error.message,'err');
    download(`${table}.csv`, toCSV(rows||[]));
  };

  window.reloadTodayLogsV91 = async function(){
    const d=today();
    loadedLogRanges.delete(`${d}_${d}_all`);
    await window.fetchTimeLogsRangeV91(d,d,{limit:1000});
    renderAll();
  };

  console.log('V91 performance guard loaded: time_logs lazy loading enabled');
})();

/* ===================== V95 Premium Client Reports - Clean Build ===================== */
const PREMIUM_SERVICE_TYPES = ['مكافحة الحشرات','غسيل الخزانات','تنظيف الأسطح','تنظيف البيسمنت','تنظيف المناور','تنظيف المكيفات','صيانة كهرباء','صيانة سباكة','صيانة مصعد','أعمال زراعة','أخرى'];
let premiumServicesState = [];
let premiumWithoutMode = false;

function reportStatusText(s){ return s==='published'?'معتمد ومنشور':(s==='draft'?'مسودة':'غير منشور'); }
function reportStatusClass(s){ return s==='published'?'green':(s==='draft'?'amber':'red'); }
function ratingClass(v){ return v==='يحتاج تحسين'?'red':(v?'green':'amber'); }
function genReportToken(){ return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,10); }
function genReportNo(){ const d=new Date(); return `TR-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(Date.now()).slice(-5)}`; }
function clientReportUrl(token){ const base = location.href.replace(/admin\.html.*$/,''); return `${base}client-report.html?token=${encodeURIComponent(token)}`; }
function normalizePhoneForWa(p){ p=String(p||'').replace(/[^0-9]/g,''); if(!p) return ''; if(p.startsWith('05')) p='966'+p.slice(1); if(p.startsWith('5')) p='966'+p; return p; }
function defaultReportSummary(){ return 'تم تنفيذ الأعمال الموضحة أدناه ضمن خطة التشغيل المعتمدة للمشروع، مع توثيق مراحل التنفيذ بالصور قبل وأثناء وبعد، بهدف رفع جودة المرافق المشتركة والمحافظة على بيئة آمنة ونظيفة للسكان.'; }

async function loadPremiumReportsOnly(showMessage=false){
  const [reports, services, ratings] = await Promise.all([
    sb.from('client_reports').select('*').order('created_at',{ascending:false}),
    sb.from('client_report_services').select('*').order('sort_order',{ascending:true}),
    sb.from('client_service_ratings').select('*').order('created_at',{ascending:false})
  ]);
  data.clientReports = reports.data || [];
  data.clientReportServices = services.data || [];
  data.clientServiceRatings = ratings.data || [];
  data.clientReportsError = reports.error?.message || services.error?.message || ratings.error?.message || '';
  if(showMessage) msg(data.clientReportsError ? 'تأكد من تشغيل ملف SQL الخاص بالتقارير في Supabase' : 'تم تحديث التقارير', data.clientReportsError?'err':'ok');
  renderPremiumReports();
  renderClientRatings();
}

const __v95OldLoadAll = loadAll;
loadAll = async function(){
  await __v95OldLoadAll();
  try{ await loadPremiumReportsOnly(false); }catch(e){ console.warn('Premium reports not ready', e.message); data.clientReports=[]; data.clientReportServices=[]; data.clientServiceRatings=[]; }
};
const __v95OldHydrateForms = hydrateForms;
hydrateForms = function(){
  __v95OldHydrateForms();
  fillSelect('premiumReportProject', data.projects||[], 'name', 'اختر المشروع');
  fillSelect('premiumReportFilterProject', data.projects||[], 'name', 'كل المشاريع');
  if($('premiumReportDate') && !$('premiumReportDate').value) $('premiumReportDate').value = today();
  if($('premiumReportFilterMonth') && !$('premiumReportFilterMonth').value) $('premiumReportFilterMonth').value = today().slice(0,7);
};
const __v95OldRenderAll = renderAll;
renderAll = function(){
  __v95OldRenderAll();
  renderPremiumReports();
  renderClientRatings();
};

function syncPremiumProjectInfo(){
  const pid=$('premiumReportProject')?.value; const p=(data.projects||[]).find(x=>String(x.id)===String(pid));
  if(!p) return;
  if(!$('premiumReportTitle').value) $('premiumReportTitle').value = `تقرير خدمات مشروع ${p.name}`;
  if(!$('premiumSummary').value) $('premiumSummary').value = defaultReportSummary();
}
function clearPremiumReportForm(){
  ['premiumReportId','premiumReportTitle','premiumChairmanName','premiumChairmanPhone'].forEach(id=>$(id)&&($(id).value=''));
  if($('premiumReportProject')) $('premiumReportProject').value='';
  if($('premiumReportDate')) $('premiumReportDate').value=today();
  if($('premiumReportType')) $('premiumReportType').value='تقرير خدمات';
  if($('premiumSummary')) $('premiumSummary').value=defaultReportSummary();
  premiumServicesState=[]; addPremiumService('مكافحة الحشرات'); renderPremiumServicesEditor();
  $('premiumReportFormTitle')&&($('premiumReportFormTitle').textContent='إنشاء تقرير جديد');
}
function makeService(type=''){
  const t=type||'مكافحة الحشرات';
  return {service_type:t,title:t,service_description:'',scope_work:'',notes:'',before_images:[],during_images:[],after_images:[]};
}
function addPremiumService(type=''){
  premiumServicesState.push(makeService(type));
  renderPremiumServicesEditor();
  setTimeout(()=>{ document.querySelectorAll('.service-editor-card')[premiumServicesState.length-1]?.scrollIntoView({behavior:'smooth',block:'center'}); },50);
}
function addSelectedPremiumService(){ addPremiumService($('premiumAddServiceType')?.value || 'مكافحة الحشرات'); }
function countServiceImages(s){ return (s.before_images||[]).length + (s.during_images||[]).length + (s.after_images||[]).length; }
function movePremiumService(i,dir){ const j=i+dir; if(j<0||j>=premiumServicesState.length) return; [premiumServicesState[i],premiumServicesState[j]]=[premiumServicesState[j],premiumServicesState[i]]; renderPremiumServicesEditor(); }

function removePremiumService(i){ if(!confirm('حذف هذه الخدمة من التقرير؟')) return; premiumServicesState.splice(i,1); renderPremiumServicesEditor(); }
function setPremiumServiceField(i, field, value){ if(premiumServicesState[i]) premiumServicesState[i][field]=value; }
function serviceTypeOptions(selected){ return PREMIUM_SERVICE_TYPES.map(t=>`<option ${t===selected?'selected':''}>${esc(t)}</option>`).join(''); }
function renderPremiumServicesEditor(){
  const box=$('premiumServicesEditor'); if(!box) return;
  if(!premiumServicesState.length) premiumServicesState=[makeService('مكافحة الحشرات')];
  box.innerHTML = premiumServicesState.map((s,i)=>`
    <div class="service-editor-card">
      <div class="service-editor-head">
        <div class="service-title-line"><span class="service-number">${i+1}</span><div><b>${esc(s.title||s.service_type||'خدمة')}</b><div class="service-counts"><span class="service-chip">قبل: ${(s.before_images||[]).length}</span><span class="service-chip">أثناء: ${(s.during_images||[]).length}</span><span class="service-chip">بعد: ${(s.after_images||[]).length}</span><span class="service-chip">الإجمالي: ${countServiceImages(s)}</span></div></div></div>
        <div class="row-actions"><button class="light" onclick="movePremiumService(${i},-1)">↑</button><button class="light" onclick="movePremiumService(${i},1)">↓</button><button class="danger" onclick="removePremiumService(${i})">حذف</button></div>
      </div>
      <div class="split"><div><label>نوع الخدمة</label><select onchange="setPremiumServiceField(${i},'service_type',this.value); if(!premiumServicesState[${i}].title || PREMIUM_SERVICE_TYPES.includes(premiumServicesState[${i}].title)) setPremiumServiceField(${i},'title',this.value); renderPremiumServicesEditor()">${serviceTypeOptions(s.service_type)}</select></div><div><label>عنوان الخدمة الظاهر للعميل</label><input value="${esc(s.title||'')}" oninput="setPremiumServiceField(${i},'title',this.value)"></div></div>
      <label>وصف الخدمة</label><textarea oninput="setPremiumServiceField(${i},'service_description',this.value)" placeholder="وصف مختصر للخدمة يظهر داخل التقرير">${esc(s.service_description||'')}</textarea>
      <label>نطاق العمل</label><textarea oninput="setPremiumServiceField(${i},'scope_work',this.value)" placeholder="مثال: الممرات، المداخل، المناور، غرف الخدمات">${esc(s.scope_work||'')}</textarea>
      <div class="stage-grid">
        ${renderStageBox(i,'before_images','قبل التنفيذ','صور توضح حالة الموقع قبل العمل',s.before_images)}
        ${renderStageBox(i,'during_images','أثناء التنفيذ','صور توثيق تنفيذ الخدمة',s.during_images)}
        ${renderStageBox(i,'after_images','بعد التنفيذ','صور النتيجة النهائية',s.after_images)}
      </div>
      <label>ملاحظات الإدارة على الخدمة</label><textarea oninput="setPremiumServiceField(${i},'notes',this.value)" placeholder="اختياري ولا يظهر إذا تركته فارغًا">${esc(s.notes||'')}</textarea>
    </div>`).join('');
}
function renderStageBox(i, field, title, hint, imgs=[]){
  imgs=imgs||[];
  return `<div class="stage-box"><h4>${title}</h4><small>${hint}</small><label class="stage-upload">+ اختيار صور ${title}<input type="file" accept="image/*" multiple onchange="handlePremiumImages(${i},'${field}',this)"></label><div class="img-previews">${imgs.map((im,j)=>`<div class="preview-img"><img src="${im.data||im.url||''}" alt=""><button onclick="removePremiumImage(${i},'${field}',${j})">×</button></div>`).join('')}</div><small>${imgs.length ? imgs.length + ' صورة مضافة' : 'لن يظهر هذا القسم للعميل إذا لم تضف صورًا'}</small></div>`;
}
function removePremiumImage(i,field,j){ premiumServicesState[i]?.[field]?.splice(j,1); renderPremiumServicesEditor(); }
async function handlePremiumImages(i, field, input){
  const files=[...(input.files||[])]; if(!files.length) return;
  msg('جاري تجهيز الصور...');
  for(const f of files){
    try{ const data=await compressImageToDataUrl(f, 1400, 0.82); premiumServicesState[i][field].push({name:f.name,type:'image/jpeg',data}); }
    catch(e){ console.warn(e); }
  }
  renderPremiumServicesEditor(); msg('تمت إضافة الصور');
}
function compressImageToDataUrl(file, max=1400, quality=.82){
  return new Promise((resolve,reject)=>{
    const fr=new FileReader(); fr.onerror=reject; fr.onload=()=>{
      const img=new Image(); img.onerror=reject; img.onload=()=>{
        let w=img.width,h=img.height; const scale=Math.min(1,max/Math.max(w,h)); w=Math.round(w*scale); h=Math.round(h*scale);
        const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h; const ctx=canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h); ctx.drawImage(img,0,0,w,h);
        resolve(canvas.toDataURL('image/jpeg',quality));
      }; img.src=fr.result;
    }; fr.readAsDataURL(file);
  });
}
function collectPremiumReportBase(status){
  const pid=Number($('premiumReportProject')?.value)||null; const p=(data.projects||[]).find(x=>x.id===pid);
  if(!pid) throw new Error('اختر المشروع أولاً');
  if(!premiumServicesState.length) throw new Error('أضف خدمة واحدة على الأقل');
  return {
    project_id:pid, project_name:p?.name||'', chairman_name:$('premiumChairmanName')?.value.trim()||'', chairman_phone:$('premiumChairmanPhone')?.value.trim()||'',
    title:$('premiumReportTitle')?.value.trim()||`تقرير خدمات مشروع ${p?.name||''}`,
    report_type:$('premiumReportType')?.value||'تقرير خدمات', report_date:$('premiumReportDate')?.value||today(), executive_summary:$('premiumSummary')?.value.trim()||defaultReportSummary(),
    status, published_at: status==='published' ? new Date().toISOString() : null
  };
}
async function savePremiumReport(status='draft'){
  try{
    const btn = event?.target;
    if(btn){ btn.disabled=true; btn.dataset.oldText=btn.innerHTML; btn.innerHTML='جاري الحفظ...'; }

    const rawId=($('premiumReportId')?.value||'').trim();
    const isUuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v||'');
    const id=isUuid(rawId)?rawId:'';
    const base=collectPremiumReportBase(status);
    let reportId='';
    let publicToken='';

    if(id){
      // نقرأ التقرير من قاعدة البيانات نفسها حتى لا نعتمد على كاش المتصفح
      const {data:current,error:readErr}=await sb.from('client_reports').select('id,public_token').eq('id',id).maybeSingle();
      if(readErr) throw readErr;
      if(current?.id){
        publicToken = current.public_token || genReportToken();
        const row={...base, public_token: status==='published'?publicToken:current.public_token, updated_at:new Date().toISOString()};
        const {data:updated,error}=await sb.from('client_reports').update(row).eq('id',id).select('id,public_token').single();
        if(error) throw error;
        reportId=updated.id;
        publicToken=updated.public_token||publicToken;
      }
    }

    // إذا كان رقم التقرير الموجود في الشاشة قديمًا أو غير موجود، ننشئ تقريرًا جديدًا بدل إدخال خدمات على تقرير غير موجود
    if(!reportId){
      publicToken=genReportToken();
      const row={...base, report_no:genReportNo(), public_token: status==='published'?publicToken:null};
      const {data:ins,error}=await sb.from('client_reports').insert(row).select('id,public_token').single();
      if(error) throw error;
      reportId=ins.id;
      publicToken=ins.public_token||publicToken;
      if($('premiumReportId')) $('premiumReportId').value=reportId;
    }

    // مهم: لا نحفظ الخدمات إلا بعد التأكد أن التقرير الرئيسي محفوظ فعليًا في قاعدة البيانات
    const {error:delErr}=await sb.from('client_report_services').delete().eq('report_id',reportId);
    if(delErr) throw delErr;

    const serviceRows=premiumServicesState.map((s,i)=>({
      report_id:reportId,
      sort_order:i+1,
      service_type:s.service_type||s.title||'خدمة',
      title:s.title||s.service_type||'خدمة',
      service_description:s.service_description||'',
      scope_work:s.scope_work||'',
      notes:s.notes||'',
      before_images:Array.isArray(s.before_images)?s.before_images:[],
      during_images:Array.isArray(s.during_images)?s.during_images:[],
      after_images:Array.isArray(s.after_images)?s.after_images:[]
    }));

    if(serviceRows.length){
      const {error:se}=await sb.from('client_report_services').insert(serviceRows);
      if(se) throw se;
    }

    await loadPremiumReportsOnly(false);
    msg(status==='published'?'تم اعتماد ونشر التقرير':'تم حفظ التقرير كمسودة');

    if(status==='published'){
      const url=clientReportUrl(publicToken);
      const phone=normalizePhoneForWa(base.chairman_phone);
      const text=`السيد / رئيس جمعية ${base.project_name} المحترم\n\nتم نشر ${base.title}.\nللاطلاع على التقرير:\n${url}\n\nشركة تصنيف لإدارة المرافق\n920015589`;
      if(phone && confirm('تم النشر. هل تريد فتح رسالة واتساب الآن؟')) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank');
    }
  }catch(e){
    console.error('savePremiumReport failed:', e);
    msg(e.message||String(e),'err');
  }finally{
    const btn = event?.target;
    if(btn){ btn.disabled=false; if(btn.dataset.oldText) btn.innerHTML=btn.dataset.oldText; }
  }
}
function getReportServices(reportId){ return (data.clientReportServices||[]).filter(s=>String(s.report_id)===String(reportId)).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)); }
function reportRatings(reportId){ return (data.clientServiceRatings||[]).filter(r=>String(r.report_id)===String(reportId)); }
function avgRatingLabel(reportId){ const rs=reportRatings(reportId); if(!rs.length) return 'لم يتم التقييم'; if(rs.some(r=>r.rating==='يحتاج تحسين')) return 'يحتاج تحسين'; return rs[0].rating || 'تم التقييم'; }
function serviceNamesForReport(reportId){ return getReportServices(reportId).map(s=>s.service_type||s.title).filter(Boolean); }
function reportMatchesService(reportId, service){ if(!service) return true; return serviceNamesForReport(reportId).some(n=>String(n).includes(service)); }
function renderPremiumReports(){
  const body=$('premiumReportsBody'); if(!body) return;
  const reports=data.clientReports||[], services=data.clientReportServices||[], ratings=data.clientServiceRatings||[];
  const month=$('premiumReportFilterMonth')?.value || today().slice(0,7);
  const mReports=reports.filter(r=>String(r.report_date||'').startsWith(month));
  if($('reportsTotalKpi')) $('reportsTotalKpi').textContent=reports.length;
  if($('reportsMonthKpi')) $('reportsMonthKpi').textContent=mReports.length;
  if($('reportsDraftKpi')) $('reportsDraftKpi').textContent=reports.filter(r=>r.status==='draft').length;
  if($('reportsPublishedKpi')) $('reportsPublishedKpi').textContent=reports.filter(r=>r.status==='published').length;
  if($('reportsFollowKpi')) $('reportsFollowKpi').textContent=ratings.filter(r=>r.rating==='يحتاج تحسين'||r.followup_requested).length;
  renderProjectsWithoutReports();
  const q=($('premiumReportSearch')?.value||'').trim(), pid=$('premiumReportFilterProject')?.value, st=$('premiumReportFilterStatus')?.value, sv=$('premiumReportFilterService')?.value, rt=$('premiumReportFilterRating')?.value;
  let rows=[...reports];
  if(q) rows=rows.filter(r=>[r.report_no,r.project_name,r.title,r.report_type,serviceNamesForReport(r.id).join(' ')].join(' ').includes(q));
  if(pid) rows=rows.filter(r=>String(r.project_id)===String(pid));
  if(st) rows=rows.filter(r=>(r.status||'unpublished')===st);
  if(month) rows=rows.filter(r=>String(r.report_date||'').startsWith(month));
  if(sv) rows=rows.filter(r=>reportMatchesService(r.id,sv));
  if(rt){ rows=rows.filter(r=> rt==='none' ? !reportRatings(r.id).length : reportRatings(r.id).some(x=>x.rating===rt)); }
  body.innerHTML = rows.map(r=>{
    const names=serviceNamesForReport(r.id), rating=avgRatingLabel(r.id), url=r.public_token?clientReportUrl(r.public_token):'';
    return `<tr><td><b>${esc(r.report_no||r.id)}</b><br><small>${esc(r.title||'')}</small></td><td>${esc(r.report_date||'')}</td><td>${esc(r.project_name||projectName(r.project_id))}</td><td>${names.map(n=>`<span class="service-chip">${esc(n)}</span>`).join('')||'-'}</td><td><span class="badge ${reportStatusClass(r.status)}">${reportStatusText(r.status)}</span></td><td><span class="badge ${ratingClass(rating)}">${esc(rating)}</span></td><td>${url?`<div class="client-copy">${esc(url)}</div><button class="light" onclick="copyText('${encodeURIComponent(url)}')">نسخ</button>`:'غير منشور'}</td><td class="row-actions"><button onclick="editPremiumReport('${r.id}')">تعديل</button>${r.status==='published'?`<button class="light" onclick="openClientReport('${r.public_token}')">عرض</button><button class="light" onclick="sendPremiumWhatsapp('${r.id}')">واتساب</button>`:''}<button class="danger" onclick="deletePremiumReport('${r.id}')">حذف</button></td></tr>`;
  }).join('') || `<tr><td colspan="8">${data.clientReportsError?'شغّل ملف SQL الخاص بالتقارير في Supabase':'لا توجد تقارير'}</td></tr>`;
}
function copyText(enc){ const t=decodeURIComponent(enc); navigator.clipboard?.writeText(t); msg('تم نسخ الرابط'); }
function openClientReport(token){ window.open(clientReportUrl(token),'_blank'); }
function sendPremiumWhatsapp(id){
  const r=(data.clientReports||[]).find(x=>String(x.id)===String(id)); if(!r||!r.public_token) return msg('التقرير غير منشور','err');
  const phone=normalizePhoneForWa(r.chairman_phone); if(!phone) return msg('لا يوجد رقم واتساب لهذا التقرير','err');
  const text=`السيد / رئيس جمعية ${r.project_name} المحترم\n\nتم نشر ${r.title}.\nللاطلاع على التقرير:\n${clientReportUrl(r.public_token)}\n\nشركة تصنيف لإدارة المرافق\n920015589`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank');
}
function previewPremiumReport(){
  const id=$('premiumReportId')?.value; const r=(data.clientReports||[]).find(x=>String(x.id)===String(id));
  if(r?.public_token && r.status==='published') return openClientReport(r.public_token);
  msg('احفظ وانشر التقرير أولاً لفتح صفحة العميل','err');
}
async function editPremiumReport(id){
  const r=(data.clientReports||[]).find(x=>String(x.id)===String(id)); if(!r) return;
  $('premiumReportId').value=r.id; $('premiumReportProject').value=r.project_id||''; $('premiumReportDate').value=r.report_date||today(); $('premiumReportTitle').value=r.title||''; $('premiumReportType').value=r.report_type||'تقرير خدمات'; $('premiumChairmanName').value=r.chairman_name||''; $('premiumChairmanPhone').value=r.chairman_phone||''; $('premiumSummary').value=r.executive_summary||defaultReportSummary();
  premiumServicesState=getReportServices(id).map(s=>({service_type:s.service_type,title:s.title,service_description:s.service_description,scope_work:s.scope_work,notes:s.notes,before_images:s.before_images||[],during_images:s.during_images||[],after_images:s.after_images||[]}));
  if(!premiumServicesState.length) premiumServicesState=[makeService()];
  renderPremiumServicesEditor(); $('premiumReportFormTitle').textContent='تعديل تقرير'; $('premiumReportFormCard')?.scrollIntoView({behavior:'smooth'});
}
async function deletePremiumReport(id){ if(!confirm('حذف التقرير وكل خدماته وتقييماته؟')) return; const {error}=await sb.from('client_reports').delete().eq('id',id); if(error) return msg(error.message,'err'); msg('تم حذف التقرير'); await loadPremiumReportsOnly(false); }
function resetPremiumReportFilters(){ ['premiumReportSearch','premiumReportFilterProject','premiumReportFilterService','premiumReportFilterStatus','premiumReportFilterRating'].forEach(id=>$(id)&&($(id).value='')); if($('premiumReportFilterMonth')) $('premiumReportFilterMonth').value=today().slice(0,7); premiumWithoutMode=false; $('projectsWithoutReportsBox')?.classList.add('hidden'); renderPremiumReports(); }
function toggleProjectsWithoutReports(){ premiumWithoutMode=!premiumWithoutMode; renderProjectsWithoutReports(); }
function renderProjectsWithoutReports(){
  const box=$('projectsWithoutReportsBox'); if(!box) return; if(!premiumWithoutMode){ box.classList.add('hidden'); return; }
  const month=$('premiumReportFilterMonth')?.value || today().slice(0,7);
  const has=new Set((data.clientReports||[]).filter(r=>String(r.report_date||'').startsWith(month)).map(r=>String(r.project_id)));
  const rows=(data.projects||[]).filter(p=>!has.has(String(p.id)) && (p.status||'active')!=='inactive');
  box.className='card'; box.innerHTML=`<h2>المشاريع بدون تقارير في ${month}</h2><div class="no-reports-box">${rows.map(p=>`<div class="no-report-item"><b>${esc(p.name)}</b><br><small>لا يوجد تقرير لهذا الشهر</small><br><span class="mini-link" onclick="clearPremiumReportForm(); $('premiumReportProject').value='${p.id}'; syncPremiumProjectInfo(); $('premiumReportFormCard').scrollIntoView({behavior:'smooth'})">إنشاء تقرير</span></div>`).join('')||'<div class="no-report-item">كل المشاريع لديها تقارير هذا الشهر</div>'}</div>`;
}
function renderClientRatings(){
  const body=$('clientRatingsBody'); if(!body) return;
  const q=($('ratingSearch')?.value||'').trim(), v=$('ratingFilterValue')?.value, f=$('ratingFilterFollow')?.value;
  let rows=[...(data.clientServiceRatings||[])];
  if(v) rows=rows.filter(r=>r.rating===v); if(f==='yes') rows=rows.filter(r=>r.followup_requested); if(f==='low') rows=rows.filter(r=>r.rating==='يحتاج تحسين');
  if(q) rows=rows.filter(r=>[r.project_name,r.report_title,r.service_title,r.comment].join(' ').includes(q));
  body.innerHTML=rows.map(r=>`<tr class="${r.rating==='يحتاج تحسين'?'low-rating':''}"><td>${fmt(r.created_at)}</td><td>${esc(r.project_name||'-')}</td><td>${esc(r.report_title||'-')}</td><td>${esc(r.service_title||'-')}</td><td><span class="badge ${ratingClass(r.rating)}">${esc(r.rating||'-')}</span></td><td>${esc(r.comment||'-')}</td><td>${r.followup_requested?'نعم':'لا'}</td></tr>`).join('')||'<tr><td colspan="7">لا توجد تقييمات حتى الآن</td></tr>';
}
function exportPremiumReportsCSV(){
  const rows=(data.clientReports||[]).map(r=>({report_no:r.report_no, date:r.report_date, project:r.project_name, title:r.title, status:reportStatusText(r.status), services:serviceNamesForReport(r.id).join(' | '), rating:avgRatingLabel(r.id)}));
  const csv='رقم التقرير,التاريخ,المشروع,العنوان,الحالة,الخدمات,التقييم\n'+rows.map(r=>[r.report_no,r.date,r.project,r.title,r.status,r.services,r.rating].map(x=>`"${String(x||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}), a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='client_reports.csv'; a.click();
}



/* ===== V108 Supervisor Inventory Requests ===== */
async function supervisorInventoryLoad(){
  try{
    const u=session()||{};
    const [items,reqs]=await Promise.all([
      sb.from('inventory_items').select('*').order('name',{ascending:true}),
      sb.from('inventory_requests').select('*').order('created_at',{ascending:false})
    ]);
    data.inventoryItems=items.data||[];
    data.inventoryRequests=(reqs.data||[]).filter(r=>String(r.supervisor_id)===String(u.id));
    fillSelect('supInventoryRequestProject', data.projects, 'name', 'اختر المشروع');
    const itemEl=$('supInventoryRequestItem'); if(itemEl) itemEl.innerHTML='<option value="">اختر الصنف</option>'+data.inventoryItems.map(i=>`<option value="${i.id}">${esc(i.name)} ${i.serial_number?'('+esc(i.serial_number)+')':''} - المتوفر ${num(i.quantity)} ${esc(i.unit||'')}</option>`).join('');
    if($('supInventoryRequestDate') && !$('supInventoryRequestDate').value) $('supInventoryRequestDate').value=today();
    renderSupervisorInventoryRequests();
  }catch(e){ console.warn(e); }
}
async function supervisorSaveInventoryRequest(btn){
  try{
    if(btn) btn.disabled=true;
    const u=session()||{};
    const itemId=$('supInventoryRequestItem')?.value;
    const pid=$('supInventoryRequestProject')?.value;
    const qty=num($('supInventoryRequestQty')?.value);
    if(!itemId) throw new Error('اختر الصنف'); if(!pid) throw new Error('اختر المشروع'); if(qty<=0) throw new Error('الكمية مطلوبة');
    const item=(data.inventoryItems||[]).find(i=>String(i.id)===String(itemId));
    const path=inventoryGetApprovalPath(); const first=path[0]||'ops';
    const row={item_id:Number(itemId),item_name:item?.name||'',quantity:qty,project_id:Number(pid),project_name:projectName(pid),supervisor_id:u.id,supervisor_name:u.full_name||u.username||'',request_date:$('supInventoryRequestDate')?.value||today(),reason:$('supInventoryRequestReason')?.value||'',notes:$('supInventoryRequestNotes')?.value||'',status:'pending_'+first,current_step:first,approval_path:path,approval_log:[]};
    const {error}=await sb.from('inventory_requests').insert(row); if(error) throw error;
    msg('تم إرسال طلب الصرف للإدارة');
    ['supInventoryRequestItem','supInventoryRequestQty','supInventoryRequestReason','supInventoryRequestNotes'].forEach(id=>$(id)&&($(id).value='')); if($('supInventoryRequestProject')) $('supInventoryRequestProject').value='';
    await supervisorInventoryLoad();
  }catch(e){ msg(e.message||String(e),'err'); } finally{ if(btn) btn.disabled=false; }
}
function renderSupervisorInventoryRequests(){
  const b=$('supInventoryRequestsBody'); if(!b) return;
  b.innerHTML=(data.inventoryRequests||[]).map(r=>`<tr><td>${esc(r.request_date||'')}</td><td>${esc(r.project_name||projectName(r.project_id))}</td><td><b>${esc(r.item_name||'')}</b></td><td>${num(r.quantity)}</td><td>${esc(r.reason||'-')}</td><td><span class="badge ${inventoryRequestStatusClass(r.status)}">${inventoryRequestStatusText(r.status)}</span><br><small>${inventoryRequestNextRole(r.status)}</small></td></tr>`).join('')||'<tr><td colspan="6">لا توجد طلبات صرف</td></tr>';
}

// Initialize report form when the admin page is ready
setTimeout(()=>{ if($('premiumReportDate') && !premiumServicesState.length){ clearPremiumReportForm(); } }, 800);


/* ===== V103 Finance Core - Administrative Accounting ===== */
let financeLoaded = false;
let financeCurrentTab = 'overview';
function financeMonthOptions(){ const el=$('financeMonthFilter'); if(!el || el.dataset.ready) return; const now=new Date(); let opts='<option value="">كل الأشهر</option>'; for(let i=0;i<18;i++){ const d=new Date(now.getFullYear(), now.getMonth()-i, 1); const val=d.toISOString().slice(0,7); opts+=`<option value="${val}">${val}</option>`; } el.innerHTML=opts; el.value=today().slice(0,7); el.dataset.ready='1'; }
function financeHydrateForms(){
  if(!$('financeDashboard')) return;
  financeMonthOptions();
  const pros=(data.projects||[]).map(p=>({id:p.id,name:p.name}));
  ['financeProjectFilter','financeExpenseProject','inventoryMovementProject','inventoryRequestProject'].forEach(id=>fillSelect(id, pros, 'name', id==='inventoryMovementProject'?'بدون مشروع':'كل المشاريع'));
  inventoryFillItemSelect(); inventoryFillRequestSelect(); financeFillSupervisorSelect(); inventoryLoadApprovalSettings();
  if($('financeExpenseDate') && !$('financeExpenseDate').value) $('financeExpenseDate').value=today();
  if($('inventoryMovementDate') && !$('inventoryMovementDate').value) $('inventoryMovementDate').value=today();
  if($('inventoryRequestDate') && !$('inventoryRequestDate').value) $('inventoryRequestDate').value=today();
}
async function financeLoadAll(showMessage=false){
  try{
    const [expenses,items,movements,requests] = await Promise.all([
      sb.from('finance_expenses').select('*').order('expense_date',{ascending:false}),
      sb.from('inventory_items').select('*').order('name',{ascending:true}),
      sb.from('inventory_movements').select('*').order('movement_date',{ascending:false}),
      sb.from('inventory_requests').select('*').order('created_at',{ascending:false})
    ]);
    for(const r of [expenses,items,movements,requests]) if(r.error) console.warn('expenses/inventory:', r.error.message);
    data.financeExpenses=expenses.data||[];
    data.inventoryItems=items.data||[];
    data.inventoryMovements=movements.data||[];
    data.inventoryRequests=requests.data||[];
    data.financeError = expenses.error||items.error||movements.error||requests.error ? 'شغّل ملف schema_update_v111_warehouse_manager_permissions.sql في Supabase' : '';
    financeLoaded=true; financeHydrateForms(); financeRenderAll(); if(showMessage) msg(data.financeError||'تم تحديث المصروفات والمخزون');
  }catch(e){ console.error(e); data.financeError='شغّل ملف schema_update_v111_warehouse_manager_permissions.sql في Supabase'; financeRenderAll(); if(showMessage) msg(data.financeError,'err'); }
}
function financeShowTab(tab,btn){ financeCurrentTab=tab; document.querySelectorAll('.finance-tab-page').forEach(x=>x.classList.add('hidden')); $('financeTab'+tab[0].toUpperCase()+tab.slice(1))?.classList.remove('hidden'); document.querySelectorAll('.finance-tab').forEach(x=>x.classList.remove('active')); btn?.classList.add('active'); if(!financeLoaded) financeLoadAll(); financeRenderAll(); }
function financeProjectName(id){ return projectName(id); }
function financeFilterRows(rows,dateField='expense_date'){
  const q=($('financeSearch')?.value||'').trim(), pid=$('financeProjectFilter')?.value, mon=$('financeMonthFilter')?.value;
  let out=[...rows];
  if(pid) out=out.filter(r=>String(r.project_id)===String(pid));
  if(mon) out=out.filter(r=>String(r[dateField]||'').slice(0,7)===mon);
  if(q) out=out.filter(r=>[r.project_name,financeProjectName(r.project_id),r.supplier,r.category,r.notes,r.name,r.item_name,r.receiver,r.reason].join(' ').includes(q));
  return out;
}
function financeRenderAll(){ if(!$('financeDashboard')) return; financeRenderKpis(); financeRenderRecent(); financeRenderExpenses(); inventoryRenderItems(); inventoryRenderMovements(); inventoryRenderRequests(); financeRenderReports(); }
function financeRenderKpis(){
  const expenses=financeFilterRows(data.financeExpenses||[],'expense_date').filter(e=>!$('financeExpenseTypeFilter')?.value || e.category===$('financeExpenseTypeFilter').value);
  const expTotal=expenses.reduce((a,e)=>a+num(e.total),0);
  const low=(data.inventoryItems||[]).filter(i=>num(i.quantity)<=num(i.min_quantity));
  $('finKpiExpenses')&&($('finKpiExpenses').textContent=money(expTotal));
  $('finKpiExpenseCount')&&($('finKpiExpenseCount').textContent=expenses.length);
  $('finKpiItems')&&($('finKpiItems').textContent=(data.inventoryItems||[]).length);
  $('finKpiLowStock')&&($('finKpiLowStock').textContent=low.length);
  $('finKpiMovements')&&($('finKpiMovements').textContent=(data.inventoryMovements||[]).length);
}
function financeRenderRecent(){
  const be=$('finRecentExpenses'); if(be){ const rows=financeFilterRows(data.financeExpenses||[],'expense_date').slice(0,8); be.innerHTML=rows.map(e=>`<tr><td>${esc(e.expense_date||'')}</td><td>${esc(e.project_name||financeProjectName(e.project_id))}</td><td>${esc(e.category||'')}</td><td>${money(e.total)}</td></tr>`).join('')||`<tr><td colspan="4">${data.financeError||'لا توجد مصروفات'}</td></tr>`; }
  const lb=$('finLowStockBody'); if(lb){ const rows=(data.inventoryItems||[]).filter(i=>num(i.quantity)<=num(i.min_quantity)).slice(0,8); lb.innerHTML=rows.map(i=>`<tr><td><b>${esc(i.name)}</b></td><td>${esc(i.category||'')}</td><td><span class="badge red">${num(i.quantity)} ${esc(i.unit||'')}</span></td><td>${num(i.min_quantity)}</td></tr>`).join('')||'<tr><td colspan="4">لا توجد أصناف منخفضة</td></tr>'; }
}
function financeCalcExpenseTotal(){ const safeNum = window.num || function(v){ const n=Number(String(v ?? 0).replace(/,/g,'').trim()); return Number.isFinite(n)?n:0; }; const sub=safeNum(document.getElementById('financeExpenseSubtotal')?.value), vat=safeNum(document.getElementById('financeExpenseVat')?.value); const totalEl=document.getElementById('financeExpenseTotal'); if(totalEl) totalEl.value=(sub+vat).toFixed(2); }
async function financeSaveExpense(btn){ try{ if(btn) btn.disabled=true; const pid=$('financeExpenseProject')?.value; if(!pid) throw new Error('اختر المشروع'); const row={project_id:Number(pid),project_name:projectName(pid),category:$('financeExpenseCategory')?.value||'مصروف عام',expense_date:$('financeExpenseDate')?.value||today(),subtotal:num($('financeExpenseSubtotal')?.value),vat:num($('financeExpenseVat')?.value),total:num($('financeExpenseTotal')?.value),supplier:$('financeExpenseSupplier')?.value||'',payment_method:$('financeExpenseMethod')?.value||'تحويل',notes:$('financeExpenseNotes')?.value||''}; const id=$('financeExpenseId')?.value; const res=id?await sb.from('finance_expenses').update(row).eq('id',id):await sb.from('finance_expenses').insert(row); if(res.error) throw res.error; msg('تم حفظ المصروف'); financeClearExpenseForm(); await financeLoadAll(); }catch(e){ msg(e.message||String(e),'err'); } finally{ if(btn) btn.disabled=false; } }
function financeClearExpenseForm(){ ['financeExpenseId','financeExpenseSubtotal','financeExpenseVat','financeExpenseTotal','financeExpenseSupplier','financeExpenseNotes'].forEach(id=>$(id)&&($(id).value='')); if($('financeExpenseDate')) $('financeExpenseDate').value=today(); }
function financeRenderExpenses(){ const b=$('financeExpensesBody'); if(!b) return; let rows=financeFilterRows(data.financeExpenses||[],'expense_date'); const cat=$('financeExpenseTypeFilter')?.value; if(cat) rows=rows.filter(e=>e.category===cat); b.innerHTML=rows.map(e=>`<tr><td>${esc(e.expense_date||'')}</td><td>${esc(e.project_name||financeProjectName(e.project_id))}</td><td>${esc(e.category||'')}</td><td>${esc(e.supplier||'-')}</td><td>${money(e.total)}</td><td>${esc(e.payment_method||'')}</td><td class="row-actions"><button onclick="financeEditExpense('${e.id}')">تعديل</button><button class="danger" onclick="financeDelete('finance_expenses','${e.id}')">حذف</button></td></tr>`).join('')||`<tr><td colspan="7">${data.financeError||'لا توجد مصروفات'}</td></tr>`; }
function financeEditExpense(id){ const e=(data.financeExpenses||[]).find(x=>String(x.id)===String(id)); if(!e) return; $('financeExpenseId').value=e.id; $('financeExpenseProject').value=e.project_id||''; $('financeExpenseCategory').value=e.category||'مصروف عام'; $('financeExpenseDate').value=e.expense_date||today(); $('financeExpenseSubtotal').value=e.subtotal||0; $('financeExpenseVat').value=e.vat||0; $('financeExpenseTotal').value=e.total||0; $('financeExpenseSupplier').value=e.supplier||''; $('financeExpenseMethod').value=e.payment_method||'تحويل'; $('financeExpenseNotes').value=e.notes||''; financeShowTab('expenses',document.querySelectorAll('.finance-tab')[1]); $('financeExpenseId')?.scrollIntoView({behavior:'smooth'}); }
async function financeOpenNewProject(){ const name=prompt('اسم المشروع الجديد'); if(!name) return; try{ const row={name:name.trim(),status:'active',required_daily_minutes:180,friday_minutes:90,operation_type:'daily_visit',visit_type_default:'surface'}; const {data:newp,error}=await sb.from('projects').insert(row).select('*').single(); if(error) throw error; data.projects.unshift(newp); financeHydrateForms(); financeRenderAll(); msg('تم إضافة المشروع'); }catch(e){ msg(e.message||String(e),'err'); } }
function inventoryFillItemSelect(){ const el=$('inventoryMovementItem'); if(!el) return; el.innerHTML='<option value="">اختر الصنف</option>'+ (data.inventoryItems||[]).map(i=>`<option value="${i.id}">${esc(i.name)} ${i.serial_number?'('+esc(i.serial_number)+')':''} - المتوفر ${num(i.quantity)} ${esc(i.unit||'')}</option>`).join(''); }

function inventoryFillRequestSelect(){ const el=$('inventoryRequestItem'); if(!el) return; el.innerHTML='<option value="">اختر الصنف</option>'+ (data.inventoryItems||[]).map(i=>`<option value="${i.id}">${esc(i.name)} ${i.serial_number?'('+esc(i.serial_number)+')':''} - المتوفر ${num(i.quantity)} ${esc(i.unit||'')}</option>`).join(''); }
function financeFillSupervisorSelect(){ const el=$('inventoryRequestSupervisor'); if(!el) return; const rows=(data.supervisors||[]).length?data.supervisors:(data.users||[]); el.innerHTML='<option value="">اختر المشرف</option>'+ rows.map(u=>`<option value="${u.id}">${esc(u.full_name||u.username||u.name)}</option>`).join(''); }

const INVENTORY_APPROVAL_ROLES={
  warehouse:'مدير مخازن',
  ops:'مدير تشغيلي',
  finance:'مدير مالي',
  general:'مدير عام'
};
function inventoryDefaultApprovalPath(){ return ['warehouse','ops','finance','general']; }
function inventoryGetApprovalPath(){
  const saved=localStorage.getItem('tasneef_inventory_approval_path');
  if(saved){ try{ const arr=JSON.parse(saved); if(Array.isArray(arr)&&arr.length) return arr.filter(r=>INVENTORY_APPROVAL_ROLES[r]); }catch(e){} }
  return inventoryDefaultApprovalPath();
}
function inventoryReadApprovalPathFromForm(){
  const items=[
    {role:'warehouse', checked:$('approvalWarehouse')?.checked, order:num($('approvalWarehouseOrder')?.value)||1},
    {role:'ops', checked:$('approvalOps')?.checked, order:num($('approvalOpsOrder')?.value)||2},
    {role:'finance', checked:$('approvalFinance')?.checked, order:num($('approvalFinanceOrder')?.value)||3},
    {role:'general', checked:$('approvalGeneral')?.checked, order:num($('approvalGeneralOrder')?.value)||4}
  ].filter(x=>x.checked).sort((a,b)=>a.order-b.order).map(x=>x.role);
  return items.length?items:inventoryDefaultApprovalPath();
}
function inventoryLoadApprovalSettings(reset=false){
  if(reset) localStorage.removeItem('tasneef_inventory_approval_path');
  const path=inventoryGetApprovalPath();
  Object.keys(INVENTORY_APPROVAL_ROLES).forEach((role,idx)=>{
    const cap=role==='ops'?'Ops':role.charAt(0).toUpperCase()+role.slice(1);
    const chk=$('approval'+cap), ord=$('approval'+cap+'Order');
    if(chk) chk.checked=path.includes(role);
    if(ord) ord.value=path.includes(role)?path.indexOf(role)+1:idx+1;
  });
  inventoryRenderApprovalPreview();
}
function inventoryRenderApprovalPreview(){
  const el=$('inventoryApprovalPreview'); if(!el) return;
  const path=inventoryReadApprovalPathFromForm();
  el.innerHTML='<b>المسار الحالي:</b> '+path.map((r,i)=>`${i+1}. ${INVENTORY_APPROVAL_ROLES[r]}`).join(' ← ');
}
function inventorySaveApprovalSettings(){
  const path=inventoryReadApprovalPathFromForm();
  localStorage.setItem('tasneef_inventory_approval_path', JSON.stringify(path));
  inventoryRenderApprovalPreview();
  msg('تم حفظ مسار اعتماد صرف المخزون');
}
function inventoryRequestStatusText(st){
  if(st && st.startsWith('pending_')) return 'بانتظار '+(INVENTORY_APPROVAL_ROLES[st.replace('pending_','')]||st);
  return ({approved:'معتمد ومصروف',rejected:'مرفوض',returned:'معاد للتعديل'})[st] || st || '-';
}
function inventoryRequestStatusClass(st){ return st==='approved'?'green':(st==='rejected'?'red':'amber'); }
function inventoryRequestNextRole(st){ return st&&st.startsWith('pending_') ? (INVENTORY_APPROVAL_ROLES[st.replace('pending_','')]||'-') : (st==='approved'?'مكتمل':(st==='rejected'?'مغلق':'-')); }
function inventoryRequestPath(r){
  let p=null;
  if(Array.isArray(r.approval_path) && r.approval_path.length) p=r.approval_path;
  if(!p && typeof r.approval_path==='string' && r.approval_path){ try{ const x=JSON.parse(r.approval_path); if(Array.isArray(x)&&x.length) p=x; }catch(e){} }
  p=(p&&p.length?p:inventoryDefaultApprovalPath()).filter(role=>INVENTORY_APPROVAL_ROLES[role]);
  return p.length?p:inventoryDefaultApprovalPath();
}
function inventoryRequestStepHtml(r){
  const path=inventoryRequestPath(r);
  const cur=(r.current_step||String(r.status||'').replace('pending_',''));
  return `<div class="approval-track">${path.map((role,i)=>{
    const done=!!r[role+'_approved_by'] || r.status==='approved';
    const active=cur===role && String(r.status||'').startsWith('pending_');
    return `<span class="badge ${done?'green':active?'amber':''}">${i+1}. ${INVENTORY_APPROVAL_ROLES[role]||role}${done?' ✓':''}</span>`;
  }).join(' ')}</div>`;
}
async function inventorySaveRequest(btn){
  try{
    if(btn) btn.disabled=true;
    const itemId=$('inventoryRequestItem')?.value;
    const pid=$('inventoryRequestProject')?.value;
    const supervisorId=$('inventoryRequestSupervisor')?.value;
    const qty=num($('inventoryRequestQty')?.value);
    if(!itemId) throw new Error('اختر الصنف');
    if(!pid) throw new Error('اختر المشروع');
    if(!supervisorId) throw new Error('اختر المشرف');
    if(qty<=0) throw new Error('الكمية مطلوبة');
    const path=inventoryGetApprovalPath();
    const first=path[0]||'warehouse';
    const item=(data.inventoryItems||[]).find(i=>String(i.id)===String(itemId));
    const row={item_id:Number(itemId), item_name:item?.name||'', quantity:qty, project_id:Number(pid), project_name:projectName(pid), supervisor_id:Number(supervisorId), supervisor_name:supervisorName(supervisorId), request_date:$('inventoryRequestDate')?.value||today(), reason:$('inventoryRequestReason')?.value||'', notes:$('inventoryRequestNotes')?.value||'', status:'pending_'+first, current_step:first, approval_path:path, approval_log:[]};
    const {error}=await sb.from('inventory_requests').insert(row);
    if(error) throw error;
    msg('تم إرسال طلب الصرف للاعتماد');
    inventoryClearRequestForm(); await financeLoadAll();
  }catch(e){ msg(e.message||String(e),'err'); } finally{ if(btn) btn.disabled=false; }
}
function inventoryClearRequestForm(){ ['inventoryRequestItem','inventoryRequestQty','inventoryRequestSupervisor','inventoryRequestReason','inventoryRequestNotes'].forEach(id=>$(id)&&($(id).value='')); if($('inventoryRequestProject')) $('inventoryRequestProject').value=''; if($('inventoryRequestDate')) $('inventoryRequestDate').value=today(); }
async function inventoryApproveRequest(id,step,btn){
  try{
    if(btn) btn.disabled=true;
    const r=(data.inventoryRequests||[]).find(x=>String(x.id)===String(id));
    if(!r) throw new Error('الطلب غير موجود');
    if(r.status!==('pending_'+step)) throw new Error('هذا الطلب ليس في مرحلة '+(INVENTORY_APPROVAL_ROLES[step]||step));
    if(!inventoryCurrentUserCanApprove(step)) throw new Error('ليس لديك صلاحية اعتماد هذه المرحلة');
    if(step==='warehouse'){
      const item=(data.inventoryItems||[]).find(i=>String(i.id)===String(r.item_id));
      if(!item) throw new Error('الصنف غير موجود في المخزون');
      if(num(item.quantity)<num(r.quantity)) throw new Error('الكمية غير متوفرة في المخزون ولا يمكن اعتماد مدير المخازن');
    }
    const u=session()||{};
    const approver=u.full_name||u.username||INVENTORY_APPROVAL_ROLES[step]||'مدير';
    const now=new Date().toISOString();
    const path=inventoryRequestPath(r);
    const idx=path.indexOf(step);
    const next=path[idx+1];
    const log=Array.isArray(r.approval_log)?r.approval_log:[];
    log.push({step,role:INVENTORY_APPROVAL_ROLES[step]||step,by:approver,at:now});
    let row={current_step:next||'done', approval_log:log};
    row[step+'_approved_by']=approver;
    row[step+'_approved_at']=now;
    if(next){
      row.status='pending_'+next;
    }else{
      const item=(data.inventoryItems||[]).find(i=>String(i.id)===String(r.item_id));
      if(!item) throw new Error('الصنف غير موجود في المخزون');
      if(num(item.quantity)<num(r.quantity)) throw new Error('الكمية المتوفرة لا تكفي للصرف');
      const movement={item_id:Number(r.item_id),item_name:r.item_name,movement_type:'out',quantity:num(r.quantity),movement_date:today(),project_id:r.project_id,project_name:r.project_name,receiver:r.supervisor_name,reason:'صرف بناءً على طلب معتمد رقم '+r.id,notes:r.reason||''};
      const mv=await sb.from('inventory_movements').insert(movement).select('*').single();
      if(mv.error) throw mv.error;
      const newQty=num(item.quantity)-num(r.quantity);
      const upd=await sb.from('inventory_items').update({quantity:newQty}).eq('id',r.item_id);
      if(upd.error) throw upd.error;
      row.status='approved'; row.current_step='done'; row.movement_id=mv.data?.id||null;
    }
    const res=await sb.from('inventory_requests').update(row).eq('id',id);
    if(res.error) throw res.error;
    msg(next?'تم اعتماد الطلب ونقله إلى '+(INVENTORY_APPROVAL_ROLES[next]||next):'تم اعتماد الطلب نهائيًا وصرف المخزون');
    await financeLoadAll();
  }catch(e){ msg(e.message||String(e),'err'); } finally{ if(btn) btn.disabled=false; }
}
async function inventoryRejectRequest(id,btn){
  const reason=prompt('سبب الرفض؟') || '';
  try{ if(btn) btn.disabled=true; const u=session()||{}; const {error}=await sb.from('inventory_requests').update({status:'rejected',current_step:'closed',rejected_by:u.full_name||u.username||'مدير',rejected_at:new Date().toISOString(),rejection_reason:reason}).eq('id',id); if(error) throw error; msg('تم رفض الطلب'); await financeLoadAll(); }catch(e){ msg(e.message||String(e),'err'); } finally{ if(btn) btn.disabled=false; }
}
function inventoryCurrentUserCanApprove(step){
  const userStep=approvalRoleForUser();
  return !!step && step===userStep;
}
function inventoryRenderRequests(){
  const b=$('inventoryRequestsBody'); if(!b) return;
  inventoryLoadApprovalSettings();
  let rows=financeFilterRows(data.inventoryRequests||[],'request_date');
  const st=$('inventoryRequestStatusFilter')?.value; if(st) rows=rows.filter(r=>r.status===st);
  b.innerHTML=rows.map(r=>{
    const actions=[];
    if(String(r.status||'').startsWith('pending_')){
      const step=String(r.status).replace('pending_','');
      if(inventoryCurrentUserCanApprove(step)){
        actions.push(`<button onclick="inventoryApproveRequest('${r.id}','${step}',this)">اعتماد ${esc(INVENTORY_APPROVAL_ROLES[step]||step)}</button>`);
        actions.push(`<button class="danger" onclick="inventoryRejectRequest('${r.id}',this)">رفض</button>`);
      }else{
        actions.push(`<span class="badge neutral">بانتظار ${esc(INVENTORY_APPROVAL_ROLES[step]||'المرحلة التالية')}</span>`);
      }
    }
    actions.unshift(`<button class="light" onclick="inventoryPrintRequest('${r.id}')">طباعة</button>`);
    return `<tr><td>${esc(r.request_date||'')}</td><td><b>${esc(r.supervisor_name||supervisorName(r.supervisor_id))}</b></td><td>${esc(r.project_name||financeProjectName(r.project_id))}</td><td>${esc(r.item_name||'')}</td><td>${num(r.quantity)}</td><td>${esc(r.reason||'-')}</td><td><span class="badge ${inventoryRequestStatusClass(r.status)}">${inventoryRequestStatusText(r.status)}</span><br><small>المرحلة: ${inventoryRequestNextRole(r.status)}</small>${inventoryRequestStepHtml(r)}</td><td class="row-actions">${actions.join(' ')||'-'}</td></tr>`;
  }).join('')||`<tr><td colspan="8">${data.financeError||'لا توجد طلبات صرف'}</td></tr>`;
}


function inventoryGenerateSerial(){
  const d=new Date();
  const pad=n=>String(n).padStart(2,'0');
  const stamp=`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `INV-${stamp}`;
}
function inventoryRenderItemImagePreview(){
  const box=$('inventoryItemImagePreview'); if(!box) return;
  const src=inventoryItemImageData || '';
  box.innerHTML = src ? `<div class="preview-img"><img src="${src}" alt="صورة المنتج"><button onclick="inventoryItemImageData=''; inventoryRenderItemImagePreview()">×</button></div>` : '<small class="muted">لا توجد صورة مضافة</small>';
}
async function inventoryHandleItemImage(input){
  const f=(input.files||[])[0]; if(!f) return;
  try{ inventoryItemImageData=await compressImageToDataUrl(f, 1000, .82); inventoryRenderItemImagePreview(); msg('تمت إضافة صورة المنتج'); }
  catch(e){ msg('تعذر تجهيز صورة المنتج','err'); }
}
async function inventorySaveItem(btn){
  try{
    if(btn) btn.disabled=true;
    const name=($('inventoryItemName')?.value||'').trim();
    if(!name) throw new Error('اسم الصنف مطلوب');
    const row={
      name,
      serial_number: ($('inventoryItemSerial')?.value||'').trim() || inventoryGenerateSerial(),
      image_url: inventoryItemImageData || null,
      category:$('inventoryItemCategory')?.value||'أخرى',
      unit:$('inventoryItemUnit')?.value||'حبة',
      quantity:num($('inventoryItemQty')?.value),
      min_quantity:num($('inventoryItemMin')?.value),
      unit_cost:num($('inventoryItemCost')?.value),
      supplier:$('inventoryItemSupplier')?.value||'',
      notes:$('inventoryItemNotes')?.value||''
    };
    const id=$('inventoryItemId')?.value;
    const res=id?await sb.from('inventory_items').update(row).eq('id',id):await sb.from('inventory_items').insert(row);
    if(res.error) throw res.error;
    msg('تم حفظ الصنف');
    inventoryClearItemForm(); await financeLoadAll();
  }catch(e){ msg(e.message||String(e),'err'); }
  finally{ if(btn) btn.disabled=false; }
}
function inventoryClearItemForm(){ ['inventoryItemId','inventoryItemName','inventoryItemSerial','inventoryItemUnit','inventoryItemQty','inventoryItemMin','inventoryItemCost','inventoryItemSupplier','inventoryItemNotes'].forEach(id=>$(id)&&($(id).value='')); inventoryItemImageData=''; inventoryRenderItemImagePreview(); if($('inventoryItemCategory')) $('inventoryItemCategory').value='كهرباء'; if($('inventoryItemMin')) $('inventoryItemMin').value=0; }
function inventoryRenderItems(){
  const b=$('inventoryItemsBody'); if(!b) return;
  const q=($('financeSearch')?.value||'').trim(); let rows=[...(data.inventoryItems||[])];
  if(q) rows=rows.filter(i=>[i.name,i.serial_number,i.category,i.supplier,i.notes].join(' ').includes(q));
  b.innerHTML=rows.map(i=>{
    const imgSrc=String(i.image_url||'');
    const img=imgSrc?`<img src="${esc(imgSrc)}" class="inventory-thumb inventory-product-img" alt="صورة ${esc(i.name||'المنتج')}" onclick="inventoryOpenProductImage('${String(i.id).replace(/'/g,"\'")}')">`:'<span class="muted">لا توجد</span>';
    return `<tr><td>${img}</td><td>${esc(i.serial_number||'-')}</td><td><b>${esc(i.name)}</b></td><td>${esc(i.category||'')}</td><td>${num(i.quantity)<=num(i.min_quantity)?`<span class="badge red">${num(i.quantity)}</span>`:num(i.quantity)}</td><td>${esc(i.unit||'')}</td><td>${num(i.min_quantity)}</td><td>${money(i.unit_cost)}</td><td>${esc(i.supplier||'-')}</td><td class="row-actions"><button onclick="inventoryEditItem('${i.id}')">تعديل</button><button class="danger" onclick="financeDelete('inventory_items','${i.id}')">حذف</button></td></tr>`;
  }).join('')||`<tr><td colspan="10">${data.financeError||'لا توجد أصناف مخزون'}</td></tr>`;
  inventoryFillItemSelect(); inventoryFillRequestSelect(); financeFillSupervisorSelect(); inventoryLoadApprovalSettings();
}
function inventoryOpenProductImage(id){
  const item=(data.inventoryItems||[]).find(x=>String(x.id)===String(id));
  if(!item || !item.image_url) return;
  openImageLightbox([{data:item.image_url,url:item.image_url}],0);
}
function inventoryEditItem(id){
  const i=(data.inventoryItems||[]).find(x=>String(x.id)===String(id)); if(!i) return;
  $('inventoryItemId').value=i.id; $('inventoryItemName').value=i.name||''; $('inventoryItemSerial').value=i.serial_number||'';
  $('inventoryItemCategory').value=i.category||'أخرى'; $('inventoryItemUnit').value=i.unit||''; $('inventoryItemQty').value=i.quantity||0; $('inventoryItemMin').value=i.min_quantity||0; $('inventoryItemCost').value=i.unit_cost||0; $('inventoryItemSupplier').value=i.supplier||''; $('inventoryItemNotes').value=i.notes||'';
  inventoryItemImageData=i.image_url||''; inventoryRenderItemImagePreview();
  financeShowTab('inventory',document.querySelectorAll('.finance-tab')[2]); $('inventoryItemId')?.scrollIntoView({behavior:'smooth'});
}
async function inventorySaveMovement(btn){ try{ if(btn) btn.disabled=true; const itemId=$('inventoryMovementItem')?.value; if(!itemId) throw new Error('اختر الصنف'); const item=(data.inventoryItems||[]).find(i=>String(i.id)===String(itemId)); const type=$('inventoryMovementType')?.value||'out', qty=num($('inventoryMovementQty')?.value); if(qty<=0) throw new Error('الكمية مطلوبة'); const pid=$('inventoryMovementProject')?.value||null; const row={item_id:Number(itemId),item_name:item?.name||'',movement_type:type,quantity:qty,movement_date:$('inventoryMovementDate')?.value||today(),project_id:pid?Number(pid):null,project_name:pid?projectName(pid):'',receiver:$('inventoryMovementReceiver')?.value||'',reason:$('inventoryMovementReason')?.value||'',notes:$('inventoryMovementNotes')?.value||''}; const id=$('inventoryMovementId')?.value; if(id) throw new Error('تعديل حركة المخزون غير متاح؛ احذف الحركة وأضف حركة جديدة للحفاظ على دقة الرصيد'); const res=await sb.from('inventory_movements').insert(row); if(res.error) throw res.error; let newQty=num(item?.quantity); if(type==='in') newQty+=qty; else if(type==='out') newQty-=qty; else if(type==='adjust') newQty=qty; const upd=await sb.from('inventory_items').update({quantity:newQty}).eq('id',itemId); if(upd.error) throw upd.error; msg('تم حفظ حركة المخزون وتحديث الرصيد'); inventoryClearMovementForm(); await financeLoadAll(); }catch(e){ msg(e.message||String(e),'err'); } finally{ if(btn) btn.disabled=false; } }
function inventoryClearMovementForm(){ ['inventoryMovementId','inventoryMovementItem','inventoryMovementQty','inventoryMovementReceiver','inventoryMovementReason','inventoryMovementNotes'].forEach(id=>$(id)&&($(id).value='')); if($('inventoryMovementType')) $('inventoryMovementType').value='out'; if($('inventoryMovementDate')) $('inventoryMovementDate').value=today(); if($('inventoryMovementProject')) $('inventoryMovementProject').value=''; }
function inventoryRenderMovements(){ const b=$('inventoryMovementsBody'); if(!b) return; let rows=financeFilterRows(data.inventoryMovements||[],'movement_date'); b.innerHTML=rows.map(m=>{ const type=m.movement_type==='in'?'إدخال':(m.movement_type==='out'?'صرف':'تعديل رصيد'); const cls=m.movement_type==='out'?'amber':(m.movement_type==='in'?'green':''); return `<tr><td>${esc(m.movement_date||'')}</td><td><b>${esc(m.item_name||'')}</b></td><td><span class="badge ${cls}">${type}</span></td><td>${num(m.quantity)}</td><td>${esc(m.project_name||financeProjectName(m.project_id)||'-')}</td><td>${esc(m.receiver||'-')}</td><td><button class="danger" onclick="financeDelete('inventory_movements','${m.id}',true)">حذف</button></td></tr>`; }).join('')||`<tr><td colspan="7">${data.financeError||'لا توجد حركة مخزون'}</td></tr>`; }
function financeRenderReports(){
  const ep=$('expenseByProjectBody'); if(ep){
    const map={}; (financeFilterRows(data.financeExpenses||[],'expense_date')).forEach(e=>{
      const k=e.project_name||financeProjectName(e.project_id)||'بدون مشروع';
      map[k]=map[k]||{total:0,count:0}; map[k].total+=num(e.total); map[k].count++;
    });
    const rows=Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
    ep.innerHTML=rows.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${money(v.total)}</td><td>${v.count}</td></tr>`).join('')||'<tr><td colspan="3">لا توجد بيانات</td></tr>';
  }
  const approvedRequestMovementIds = new Set((data.inventoryRequests||[]).filter(r=>r.status==='approved' && r.movement_id).map(r=>String(r.movement_id)));
  const stockOutMovements=(data.inventoryMovements||[]).filter(m=>m.movement_type==='out' && !approvedRequestMovementIds.has(String(m.id)) && !String(m.reason||'').includes('طلب معتمد'));
  const sp=$('stockOutByProjectBody'); if(sp){
    const map={};
    (data.inventoryRequests||[]).filter(r=>r.status==='approved').forEach(r=>{ const k=r.project_name||financeProjectName(r.project_id)||'بدون مشروع'; map[k]=map[k]||{qty:0,count:0}; map[k].qty+=num(r.quantity); map[k].count++; });
    stockOutMovements.forEach(m=>{ const k=m.project_name||financeProjectName(m.project_id)||'بدون مشروع'; map[k]=map[k]||{qty:0,count:0}; map[k].qty+=num(m.quantity); map[k].count++; });
    const rows=Object.entries(map).sort((a,b)=>b[1].qty-a[1].qty);
    sp.innerHTML=rows.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${v.count}</td><td>${v.qty}</td></tr>`).join('')||'<tr><td colspan="3">لا توجد بيانات</td></tr>';
  }
  const sr=$('stockOutBySupervisorBody'); if(sr){
    const map={};
    (data.inventoryRequests||[]).filter(r=>r.status==='approved').forEach(r=>{ const k=(r.supervisor_name||supervisorName(r.supervisor_id)||'بدون مشرف')+'||'+(r.project_name||financeProjectName(r.project_id)||'بدون مشروع'); map[k]=map[k]||{qty:0,count:0,supervisor:r.supervisor_name||supervisorName(r.supervisor_id),project:r.project_name||financeProjectName(r.project_id)}; map[k].qty+=num(r.quantity); map[k].count++; });
    stockOutMovements.forEach(m=>{ const k=(m.receiver||'بدون مستلم')+'||'+(m.project_name||financeProjectName(m.project_id)||'بدون مشروع'); map[k]=map[k]||{qty:0,count:0,supervisor:m.receiver||'بدون مستلم',project:m.project_name||financeProjectName(m.project_id)}; map[k].qty+=num(m.quantity); map[k].count++; });
    const rows=Object.values(map).sort((a,b)=>b.qty-a.qty);
    sr.innerHTML=rows.map(v=>`<tr><td>${esc(v.supervisor)}</td><td>${esc(v.project)}</td><td>${v.count}</td><td>${v.qty}</td></tr>`).join('')||'<tr><td colspan="4">لا توجد بيانات</td></tr>';
  }
  const ud=$('inventoryUsageDetailBody'); if(ud){
    const rows=[];
    (data.inventoryRequests||[]).filter(r=>r.status==='approved').forEach(r=>{
      const date=String(r.request_date||r.created_at||today()).slice(0,10);
      rows.push({date, project:r.project_name||financeProjectName(r.project_id), person:r.supervisor_name||supervisorName(r.supervisor_id), item:r.item_name, qty:num(r.quantity), reason:r.reason||r.notes||'-', type:'طلب صرف معتمد', ref:'REQ-'+r.id});
    });
    stockOutMovements.forEach(m=>{
      const date=String(m.movement_date||m.created_at||today()).slice(0,10);
      rows.push({date, project:m.project_name||financeProjectName(m.project_id)||'بدون مشروع', person:m.receiver||'بدون مستلم', item:m.item_name, qty:num(m.quantity), reason:m.reason||m.notes||'-', type:'صرف مباشر من المخزون', ref:'MOV-'+m.id});
    });
    rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)) || String(a.project).localeCompare(String(b.project)));
    ud.innerHTML=rows.map(v=>`<tr><td>${esc(v.date)}</td><td>${esc(v.project)}</td><td>${esc(v.person)}</td><td>${esc(v.item)}</td><td>${v.qty}</td><td>${esc(v.reason)}</td><td>${esc(v.type)}</td><td>${esc(daysAgoText(v.date))}</td><td>${esc(v.ref)}</td></tr>`).join('')||'<tr><td colspan="9">لا توجد بيانات استهلاك</td></tr>';
  }
}

function daysAgoText(dateStr){
  if(!dateStr) return '-';
  const d=new Date(String(dateStr).slice(0,10)+'T00:00:00');
  if(isNaN(d.getTime())) return '-';
  const todayD=new Date(today()+'T00:00:00');
  const diff=Math.max(0, Math.round((todayD-d)/86400000));
  return diff===0?'اليوم':(diff===1?'منذ يوم':'منذ '+diff+' يوم');
}
function financePrintWindow(title, bodyHtml){
  const css=`@page{size:A4;margin:10mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#103d32;margin:0}.page{border:2px solid #0a4033;border-radius:18px;padding:18px;min-height:100vh}.head{display:flex;justify-content:space-between;gap:16px;border-bottom:4px solid #0a4033;padding-bottom:12px;margin-bottom:14px}.brand{font-weight:900;color:#0a4033;font-size:22px}.muted{color:#60706a;font-size:12px}h1{margin:0;color:#0a4033;font-size:24px}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}th{background:#0a4033;color:#fff;padding:9px}td{border:1px solid #dce6e2;padding:8px;text-align:center}tr:nth-child(even) td{background:#f7fbfa}.box{border:1px solid #dce6e2;border-radius:14px;padding:12px;margin:10px 0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.sig{height:70px;border-bottom:1px dashed #9badA6;margin-top:20px}.footer{text-align:center;margin-top:20px;color:#60706a;font-size:11px}@media print{.no-print{display:none!important}.page{border-radius:0}}`;
  const w=window.open('','_blank');
  if(!w){ msg('المتصفح منع نافذة الطباعة','err'); return; }
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body><div class="page"><div class="head"><div><div class="brand">تصنيف لإدارة المرافق</div><div class="muted">نظام المصروفات والمخزون</div></div><div><h1>${esc(title)}</h1><div class="muted">تاريخ الطباعة: ${new Date().toLocaleString('ar-SA')}</div></div></div>${bodyHtml}<div class="footer">تم إنشاء هذا المستند من نظام تصنيف</div></div><script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
  w.document.close();
}
function inventoryPrintRequest(id){
  const r=(data.inventoryRequests||[]).find(x=>String(x.id)===String(id)); if(!r){msg('الطلب غير موجود','err');return;}
  const log=Array.isArray(r.approval_log)?r.approval_log:[];
  const logRows=log.map(l=>`<tr><td>${esc(l.role||l.step)}</td><td>${esc(l.by||'-')}</td><td>${esc(l.at?new Date(l.at).toLocaleString('ar-SA'):'-')}</td></tr>`).join('')||'<tr><td colspan="3">لا يوجد سجل اعتماد</td></tr>';
  const body=`<div class="grid"><div class="box"><b>رقم الطلب</b><br>REQ-${esc(r.id)}</div><div class="box"><b>الحالة</b><br>${esc(inventoryRequestStatusText(r.status))}</div><div class="box"><b>التاريخ</b><br>${esc(r.request_date||'')}</div></div><table><tr><th>المشرف</th><td>${esc(r.supervisor_name||supervisorName(r.supervisor_id))}</td><th>المشروع</th><td>${esc(r.project_name||financeProjectName(r.project_id))}</td></tr><tr><th>الصنف</th><td>${esc(r.item_name||'')}</td><th>الكمية</th><td>${num(r.quantity)}</td></tr><tr><th>سبب الصرف</th><td colspan="3">${esc(r.reason||'-')}</td></tr><tr><th>ملاحظات</th><td colspan="3">${esc(r.notes||'-')}</td></tr></table><h3>سجل الاعتماد</h3><table><thead><tr><th>المرحلة</th><th>المعتمد</th><th>الوقت</th></tr></thead><tbody>${logRows}</tbody></table><div class="grid"><div><b>المستلم</b><div class="sig"></div></div><div><b>مدير المخازن</b><div class="sig"></div></div><div><b>الاعتماد النهائي</b><div class="sig"></div></div></div>`;
  financePrintWindow('أمر صرف مخزون', body);
}
function inventoryPrintMovement(id){
  const m=(data.inventoryMovements||[]).find(x=>String(x.id)===String(id)); if(!m){msg('الحركة غير موجودة','err');return;}
  const type=m.movement_type==='in'?'إدخال':(m.movement_type==='out'?'صرف':'تعديل رصيد');
  const body=`<div class="grid"><div class="box"><b>رقم الحركة</b><br>MOV-${esc(m.id)}</div><div class="box"><b>نوع الحركة</b><br>${esc(type)}</div><div class="box"><b>التاريخ</b><br>${esc(m.movement_date||'')}</div></div><table><tr><th>الصنف</th><td>${esc(m.item_name||'')}</td><th>الكمية</th><td>${num(m.quantity)}</td></tr><tr><th>المشروع</th><td>${esc(m.project_name||financeProjectName(m.project_id)||'-')}</td><th>المستلم</th><td>${esc(m.receiver||'-')}</td></tr><tr><th>السبب</th><td colspan="3">${esc(m.reason||'-')}</td></tr><tr><th>ملاحظات</th><td colspan="3">${esc(m.notes||'-')}</td></tr></table><div class="grid"><div><b>المستلم</b><div class="sig"></div></div><div><b>مسؤول المخزون</b><div class="sig"></div></div><div><b>اعتماد الإدارة</b><div class="sig"></div></div></div>`;
  financePrintWindow('حركة مخزون', body);
}
function financePrintReport(kind){
  const titles={expensesByProject:'تقرير مصروفات حسب المشروع',stockOutByProject:'تقرير صرف المخزون حسب المشروع',stockOutBySupervisor:'تقرير استهلاك المشرفين حسب المشروع',inventoryUsageDetail:'تقرير تفصيلي للاستهلاك'};
  const bodyIds={expensesByProject:'expenseByProjectBody',stockOutByProject:'stockOutByProjectBody',stockOutBySupervisor:'stockOutBySupervisorBody',inventoryUsageDetail:'inventoryUsageDetailBody'};
  const headers={expensesByProject:['المشروع','إجمالي المصروفات','عدد العمليات'],stockOutByProject:['المشروع','عدد العمليات','إجمالي الكميات المصروفة'],stockOutBySupervisor:['المشرف','المشروع','عدد الطلبات','إجمالي الكمية'],inventoryUsageDetail:['التاريخ','المشروع','المشرف / المستلم','الصنف','الكمية','سبب الاستخدام','نوع العملية','منذ كم يوم','المرجع']};
  const tbody=$(bodyIds[kind]); if(!tbody){msg('التقرير غير موجود','err');return;}
  const rows=[...tbody.querySelectorAll('tr')].map(tr=>[...tr.children].map(td=>td.innerText.trim()));
  const table=`<table><thead><tr>${(headers[kind]||[]).map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  financePrintWindow(titles[kind]||'تقرير', table);
}

async function financeDelete(table,id){
  if(!confirm('تأكيد الحذف؟')) return;
  try{
    if(table==='inventory_movements'){
      const m=(data.inventoryMovements||[]).find(x=>String(x.id)===String(id));
      const item=(data.inventoryItems||[]).find(x=>String(x.id)===String(m?.item_id));
      if(m && item){
        let q=num(item.quantity), mq=num(m.quantity);
        if(m.movement_type==='in') q-=mq; else if(m.movement_type==='out') q+=mq; else if(m.movement_type==='adjust') q=q; // لا يمكن معرفة الرصيد السابق لحركة تعديل الرصيد
        await sb.from('inventory_items').update({quantity:q}).eq('id',item.id);
      }
    }
    const {error}=await sb.from(table).delete().eq('id',id);
    if(error) throw error;
    msg('تم الحذف'); await financeLoadAll();
  }catch(e){ msg(e.message||String(e),'err'); }
}
function financeResetFilters(){ ['financeSearch','financeProjectFilter','financeExpenseTypeFilter'].forEach(id=>$(id)&&($(id).value='')); if($('financeMonthFilter')) $('financeMonthFilter').value=today().slice(0,7); financeRenderAll(); }
(function(){ const _showPage=window.showPage||showPage; window.showPage=function(id,btn){ _showPage(id,btn); if(id==='financeDashboard'){ financeHydrateForms(); if(!financeLoaded) financeLoadAll(); else financeRenderAll(); } }; })();


/* ===== V112: force latest permissions list and approval roles ===== */
(function(){
  function refreshPermsV112(){
    try{ if(typeof hydrateForms==='function') hydrateForms(); }catch(e){}
    try{ if(typeof renderUsers==='function') renderUsers(); }catch(e){}
  }
  window.addEventListener('load', function(){ setTimeout(refreshPermsV112, 300); setTimeout(refreshPermsV112, 1200); });
})();


/* ===== V113: strict sidebar permissions for all admin-area roles ===== */
(function(){
  'use strict';

  const PERMISSIONS_V113 = [
    ['can_dashboard','لوحة التحكم'],
    ['can_time_logs','التسجيلات اليومية'],
    ['can_manage_users','إدارة المستخدمين'],
    ['can_projects','المشاريع'],
    ['can_contracts','العقود والخدمات'],
    ['can_manage_workers','العمال'],
    ['can_attendance','الحضور والغياب'],
    ['can_monthly','الأوقات الشهرية'],
    ['can_tickets','التكتات'],
    ['can_client_reports','تقارير العملاء'],
    ['can_client_ratings','تقييمات العملاء'],
    ['can_expenses_inventory','المصروفات والمخزون'],
    ['can_inventory_requests','طلبات صرف المخزون'],
    ['can_manage_inventory','إدارة المخزون'],
    ['can_alerts','التنبيهات'],
    ['can_assistant','مساعد تصنيف'],
    ['can_export','التصدير']
  ];

  const NAV_PERM_MAP_V113 = {
    dashboard:'can_dashboard',
    daily:'can_time_logs',
    users:'can_manage_users',
    projects:'can_projects',
    contracts:'can_contracts',
    workers:'can_manage_workers',
    attendance:'can_attendance',
    monthly:'can_monthly',
    tickets:'can_tickets',
    clientReports:'can_client_reports',
    clientRatings:'can_client_ratings',
    financeDashboard:'can_expenses_inventory',
    alerts:'can_alerts',
    assistant:'can_assistant',
    export:'can_export'
  };

  function parsePerms(extra){
    if(typeof extra === 'string'){
      try{ return JSON.parse(extra || '{}') || {}; }catch(e){ return {}; }
    }
    return extra || {};
  }

  function allPerms(v){ return Object.fromEntries(PERMISSIONS_V113.map(([k])=>[k, !!v])); }

  function roleDefaultsV113(role){
    if(role === 'admin' || role === 'general_manager') return allPerms(true);
    if(role === 'warehouse_manager') return {
      can_dashboard:true,
      can_expenses_inventory:true,
      can_inventory_requests:true,
      can_manage_inventory:true
    };
    if(role === 'operations_manager') return {
      can_dashboard:true,
      can_time_logs:true,
      can_projects:true,
      can_contracts:true,
      can_manage_workers:true,
      can_attendance:true,
      can_monthly:true,
      can_tickets:true,
      can_client_reports:true,
      can_client_ratings:true,
      can_expenses_inventory:true,
      can_inventory_requests:true,
      can_alerts:true,
      can_assistant:true,
      can_export:true
    };
    if(role === 'financial_manager') return {
      can_dashboard:true,
      can_client_reports:true,
      can_client_ratings:true,
      can_expenses_inventory:true,
      can_inventory_requests:true,
      can_export:true
    };
    if(role === 'technician') return {
      can_dashboard:true,
      can_tickets:true,
      can_inventory_requests:true
    };
    // مشرف
    return {
      can_dashboard:true,
      can_time_logs:true,
      can_projects:false,
      can_manage_workers:false,
      can_attendance:true,
      can_tickets:true,
      can_client_reports:false,
      can_client_ratings:false,
      can_expenses_inventory:false,
      can_inventory_requests:true
    };
  }

  function normalizePermsV113(user){
    user = user || (typeof session === 'function' ? session() : null) || {};
    const base = roleDefaultsV113(user.role);
    const extra = parsePerms(user.permissions);
    // دعم مفاتيح قديمة
    if(extra.can_reports === true){
      if(extra.can_client_reports === undefined) extra.can_client_reports = true;
      if(extra.can_client_ratings === undefined) extra.can_client_ratings = true;
    }
    if(extra.can_journey === true && extra.can_dashboard === undefined) extra.can_dashboard = true;
    if(extra.can_edit_time_logs === true && extra.can_time_logs === undefined) extra.can_time_logs = true;
    return Object.assign({}, base, extra || {});
  }
  window.getUserPermissionsV72 = normalizePermsV113;
  window.getUserPermissionsV113 = normalizePermsV113;

  function setPermInputsV113(perms){
    perms = perms || {};
    PERMISSIONS_V113.forEach(([key])=>{
      const el = document.getElementById('perm_'+key);
      if(el) el.checked = !!perms[key];
    });
  }
  function readPermInputsV113(){
    const out = {};
    PERMISSIONS_V113.forEach(([key])=>{
      const el = document.getElementById('perm_'+key);
      if(el) out[key] = !!el.checked;
    });
    return out;
  }
  function permissionsTextV113(perms){
    perms = perms || {};
    const labels = PERMISSIONS_V113.filter(([k])=>perms[k]).map(x=>x[1]);
    return labels.length ? labels.join('، ') : '-';
  }

  function injectPermissionsBoxV113(){
    const active = document.getElementById('userActive');
    if(!active) return;
    let box = document.getElementById('userPermissionsBoxV72');
    const html = '<label>الصلاحيات</label><div class="perm-grid-v72">' + PERMISSIONS_V113.map(([key,label]) =>
      `<label class="perm-item-v72"><input type="checkbox" id="perm_${key}" data-perm="${key}"> <span>${label}</span></label>`
    ).join('') + '</div><div class="footer-note">تحدد هذه الصلاحيات ما يظهر للمستخدم داخل التطبيق. أي صلاحية غير محددة لن تظهر في القائمة الجانبية للمستخدم.</div>';
    if(!box){
      box = document.createElement('div');
      box.id = 'userPermissionsBoxV72';
      box.className = 'perm-box-v72';
      active.parentElement.insertBefore(box, active.nextSibling);
    }
    if(!box.querySelector('#perm_can_projects') || !box.querySelector('#perm_can_client_reports') || !box.querySelector('#perm_can_alerts')){
      box.innerHTML = html;
    }
    const role = document.getElementById('userRole');
    if(role && !role.dataset.permHookedV113){
      role.dataset.permHookedV113='1';
      role.addEventListener('change', ()=>setPermInputsV113(roleDefaultsV113(role.value)));
    }
    // فقط عند الإضافة الجديدة، لا نكسر التعديل الحالي
    if(!document.getElementById('userId')?.value) setPermInputsV113(roleDefaultsV113(role?.value || 'supervisor'));
  }

  const oldHydrateV113 = window.hydrateForms;
  window.hydrateForms = function(){
    if(typeof oldHydrateV113 === 'function') oldHydrateV113.apply(this, arguments);
    injectPermissionsBoxV113();
    applyCurrentPermissionsV113();
  };

  window.saveUser = async function(){
    const id=$('userId')?.value;
    const row={
      full_name:$('userFullName')?.value.trim(),
      username:$('userUsername')?.value.trim(),
      password:$('userPassword')?.value.trim()||'123456',
      role:$('userRole')?.value,
      is_active:$('userActive')?.value==='true',
      permissions: readPermInputsV113()
    };
    if(!row.full_name||!row.username) return msg('الاسم واسم المستخدم مطلوبان','err');
    let res = id ? await sb.from('app_users').update(row).eq('id',id) : await sb.from('app_users').insert(row);
    if(res.error && String(res.error.message||'').includes('permissions')){
      const safeRow = Object.assign({}, row); delete safeRow.permissions;
      res = id ? await sb.from('app_users').update(safeRow).eq('id',id) : await sb.from('app_users').insert(safeRow);
      if(!res.error) msg('تم حفظ المستخدم، لكن عمود الصلاحيات غير موجود في قاعدة البيانات','err');
    }
    if(res.error) return msg(res.error.message,'err');
    msg('تم حفظ المستخدم والصلاحيات');
    if(typeof clearUserForm === 'function') clearUserForm();
    await refreshAll();
    injectPermissionsBoxV113();
    applyCurrentPermissionsV113();
  };

  window.renderUsers = function(){
    const b=$('usersBody'); if(!b) return;
    const table=b.closest('table');
    if(table && table.tHead){
      table.tHead.innerHTML='<tr><th>الاسم</th><th>المستخدم</th><th>الدور</th><th>الحالة</th><th>الصلاحيات</th><th>إجراء</th></tr>';
    }
    b.innerHTML=(data.users||[]).map(u=>{
      const perms = normalizePermsV113(u);
      return `<tr><td>${esc(u.full_name)}</td><td>${esc(u.username)}</td><td><span class="badge">${esc(userRoleLabel(u.role))}</span></td><td><span class="badge ${u.is_active?'green':'red'}">${u.is_active?'نشط':'موقوف'}</span></td><td style="white-space:normal;min-width:220px">${esc(permissionsTextV113(perms))}</td><td class="row-actions"><button onclick="editUser(${u.id})">تعديل</button><button class="danger" onclick="deleteRow('app_users',${u.id})">حذف</button></td></tr>`;
    }).join('') || '<tr><td colspan="6">لا يوجد مستخدمون</td></tr>';
  };

  window.editUser = function(id){
    const u=(data.users||[]).find(x=>String(x.id)===String(id)); if(!u)return;
    injectPermissionsBoxV113();
    $('userId').value=u.id;
    $('userFullName').value=u.full_name||'';
    $('userUsername').value=u.username||'';
    $('userPassword').value=u.password||'';
    $('userRole').value=u.role;
    $('userActive').value=String(u.is_active!==false);
    $('userFormTitle').textContent='تعديل مستخدم';
    setPermInputsV113(normalizePermsV113(u));
  };

  const oldClearV113 = window.clearUserForm;
  window.clearUserForm = function(){
    if(typeof oldClearV113 === 'function') oldClearV113.apply(this, arguments);
    injectPermissionsBoxV113();
    const role = document.getElementById('userRole')?.value || 'supervisor';
    setPermInputsV113(roleDefaultsV113(role));
  };

  function applyCurrentPermissionsV113(){
    const u = (typeof session === 'function') ? session() : null;
    if(!u) return;
    const perms = normalizePermsV113(u);
    const navButtons = [...document.querySelectorAll('.side .nav:not(.danger)')];
    navButtons.forEach(btn=>{
      const on = String(btn.getAttribute('onclick')||'');
      const match = on.match(/showPage\('([^']+)'/);
      if(!match) return;
      const page = match[1];
      const permKey = NAV_PERM_MAP_V113[page];
      if(!permKey) return;
      if(perms[permKey]) btn.classList.remove('hidden');
      else btn.classList.add('hidden');
    });

    // إذا كان المستخدم واقفًا في صفحة لا يملك صلاحيتها، حوّله لأول صفحة مسموحة.
    const visibleActive = document.querySelector('.side .nav.active:not(.hidden):not(.danger)');
    if(!visibleActive){
      const firstAllowed = document.querySelector('.side .nav:not(.hidden):not(.danger)');
      if(firstAllowed) firstAllowed.click();
    }
  }
  window.applyCurrentPermissionsV113 = applyCurrentPermissionsV113;

  const oldShowPageV113 = window.showPage || showPage;
  window.showPage = function(id, btn){
    const u = (typeof session === 'function') ? session() : null;
    const permKey = NAV_PERM_MAP_V113[id];
    if(u && permKey && !normalizePermsV113(u)[permKey]){
      msg('ليست لديك صلاحية الدخول لهذه الصفحة','err');
      applyCurrentPermissionsV113();
      return;
    }
    oldShowPageV113(id, btn);
    setTimeout(applyCurrentPermissionsV113, 0);
  };

  window.addEventListener('load', function(){
    setTimeout(()=>{ injectPermissionsBoxV113(); applyCurrentPermissionsV113(); }, 250);
    setTimeout(()=>{ injectPermissionsBoxV113(); applyCurrentPermissionsV113(); }, 1000);
  });
})();

/* ===== V114: hard sidebar permissions fix + live session refresh ===== */
(function(){
  'use strict';

  const PERMISSIONS_V114 = [
    ['can_dashboard','لوحة التحكم'],
    ['can_time_logs','التسجيلات اليومية'],
    ['can_manage_users','إدارة المستخدمين'],
    ['can_projects','المشاريع'],
    ['can_contracts','العقود والخدمات'],
    ['can_manage_workers','العمال'],
    ['can_attendance','الحضور والغياب'],
    ['can_monthly','الأوقات الشهرية'],
    ['can_tickets','التكتات'],
    ['can_client_reports','تقارير العملاء'],
    ['can_client_ratings','تقييمات العملاء'],
    ['can_expenses_inventory','المصروفات والمخزون'],
    ['can_inventory_requests','طلبات صرف المخزون'],
    ['can_manage_inventory','إدارة المخزون'],
    ['can_alerts','التنبيهات'],
    ['can_assistant','مساعد تصنيف'],
    ['can_export','التصدير']
  ];

  const NAV_PERM_MAP_V114 = {
    dashboard:'can_dashboard',
    daily:'can_time_logs',
    users:'can_manage_users',
    projects:'can_projects',
    contracts:'can_contracts',
    workers:'can_manage_workers',
    attendance:'can_attendance',
    monthly:'can_monthly',
    tickets:'can_tickets',
    clientReports:'can_client_reports',
    clientRatings:'can_client_ratings',
    financeDashboard:'can_expenses_inventory',
    alerts:'can_alerts',
    assistant:'can_assistant',
    export:'can_export'
  };

  function parsePermsV114(v){
    if(!v) return {};
    if(typeof v === 'string'){
      try { return JSON.parse(v || '{}') || {}; } catch(e){ return {}; }
    }
    return v || {};
  }

  function allV114(v){ return Object.fromEntries(PERMISSIONS_V114.map(([k])=>[k, !!v])); }

  function roleDefaultsV114(role){
    if(role === 'admin' || role === 'general_manager') return allV114(true);
    if(role === 'warehouse_manager') return { can_dashboard:true, can_expenses_inventory:true, can_inventory_requests:true, can_manage_inventory:true };
    if(role === 'operations_manager') return {
      can_dashboard:true, can_time_logs:true, can_projects:true, can_contracts:true,
      can_manage_workers:true, can_attendance:true, can_monthly:true, can_tickets:true,
      can_client_reports:true, can_client_ratings:true, can_expenses_inventory:true,
      can_inventory_requests:true, can_manage_inventory:false, can_alerts:true,
      can_assistant:true, can_export:true
    };
    if(role === 'financial_manager') return { can_dashboard:true, can_client_reports:true, can_client_ratings:true, can_expenses_inventory:true, can_inventory_requests:true, can_export:true };
    if(role === 'technician') return { can_dashboard:true, can_tickets:true, can_inventory_requests:true };
    return { can_dashboard:true, can_time_logs:true, can_attendance:true, can_tickets:true, can_inventory_requests:true };
  }

  function hasExplicitPermsV114(user){
    const p = parsePermsV114(user && user.permissions);
    return Object.keys(p).some(k => k.indexOf('can_') === 0);
  }

  function normalizePermsV114(user){
    user = user || (typeof session === 'function' ? session() : null) || {};
    if(user.role === 'admin' || user.role === 'general_manager') return allV114(true);

    const explicit = parsePermsV114(user.permissions);
    // مهم: إذا حفظنا صلاحيات للمستخدم، نعتمد على المختار فقط، ولا نرجع نفتح صلاحيات الدور تلقائيًا.
    if(hasExplicitPermsV114(user)){
      const out = allV114(false);
      Object.keys(out).forEach(k => { if(explicit[k] === true) out[k] = true; });
      // دعم مفاتيح قديمة لو موجودة
      if(explicit.can_reports === true){ out.can_client_reports = true; out.can_client_ratings = true; }
      if(explicit.can_journey === true) out.can_dashboard = true;
      if(explicit.can_edit_time_logs === true) out.can_time_logs = true;
      return out;
    }
    return Object.assign(allV114(false), roleDefaultsV114(user.role));
  }

  window.getUserPermissionsV72 = normalizePermsV114;
  window.getUserPermissionsV113 = normalizePermsV114;
  window.getUserPermissionsV114 = normalizePermsV114;

  function syncCurrentSessionV114(){
    try{
      const u = session && session();
      if(!u || !Array.isArray(data && data.users)) return u;
      const fresh = data.users.find(x => String(x.id) === String(u.id) || (x.username && x.username === u.username));
      if(fresh){ setSession(fresh); return fresh; }
      return u;
    }catch(e){ return null; }
  }

  function setPermInputsV114(perms){
    perms = perms || {};
    PERMISSIONS_V114.forEach(([key])=>{
      const el = document.getElementById('perm_'+key);
      if(el) el.checked = !!perms[key];
    });
  }

  function readPermInputsV114(){
    const out = {};
    PERMISSIONS_V114.forEach(([key])=>{
      const el = document.getElementById('perm_'+key);
      if(el) out[key] = !!el.checked;
    });
    return out;
  }

  function permissionsTextV114(perms){
    perms = perms || {};
    const labels = PERMISSIONS_V114.filter(([k])=>perms[k]).map(x=>x[1]);
    return labels.length ? labels.join('، ') : '-';
  }

  function injectPermissionsBoxV114(){
    const active = document.getElementById('userActive');
    if(!active) return;
    let box = document.getElementById('userPermissionsBoxV72');
    const html = '<label>الصلاحيات</label><div class="perm-grid-v72">' + PERMISSIONS_V114.map(([key,label]) =>
      `<label class="perm-item-v72"><input type="checkbox" id="perm_${key}" data-perm="${key}"> <span>${label}</span></label>`
    ).join('') + '</div><div class="footer-note">تحدد هذه الصلاحيات ما يظهر للمستخدم داخل التطبيق. إذا أزلت العلامة تختفي الصفحة من القائمة الجانبية فورًا بعد دخول المستخدم.</div>';
    if(!box){
      box = document.createElement('div');
      box.id = 'userPermissionsBoxV72';
      box.className = 'perm-box-v72';
      active.parentElement.insertBefore(box, active.nextSibling);
    }
    // استبدال كامل دائمًا لمنع بقاء القائمة القديمة.
    if(box.dataset.v !== '114'){
      box.innerHTML = html;
      box.dataset.v = '114';
    }
    const role = document.getElementById('userRole');
    if(role && !role.dataset.permHookedV114){
      role.dataset.permHookedV114 = '1';
      role.addEventListener('change', ()=>setPermInputsV114(roleDefaultsV114(role.value)));
    }
    if(!document.getElementById('userId')?.value){
      setPermInputsV114(roleDefaultsV114(role?.value || 'supervisor'));
    }
  }

  window.saveUser = async function(){
    const id = $('userId')?.value;
    const row = {
      full_name: $('userFullName')?.value.trim(),
      username: $('userUsername')?.value.trim(),
      password: $('userPassword')?.value.trim() || '123456',
      role: $('userRole')?.value,
      is_active: $('userActive')?.value === 'true',
      permissions: readPermInputsV114()
    };
    if(!row.full_name || !row.username) return msg('الاسم واسم المستخدم مطلوبان','err');
    let res = id ? await sb.from('app_users').update(row).eq('id', id) : await sb.from('app_users').insert(row);
    if(res.error && String(res.error.message||'').includes('permissions')){
      const safeRow = Object.assign({}, row); delete safeRow.permissions;
      res = id ? await sb.from('app_users').update(safeRow).eq('id', id) : await sb.from('app_users').insert(safeRow);
      if(!res.error) msg('تم حفظ المستخدم، لكن عمود الصلاحيات غير موجود. شغّل ملف SQL للصلاحيات','err');
    }
    if(res.error) return msg(res.error.message,'err');
    msg('تم حفظ المستخدم والصلاحيات');
    if(typeof clearUserForm === 'function') clearUserForm();
    await refreshAll();
    syncCurrentSessionV114();
    injectPermissionsBoxV114();
    applyCurrentPermissionsV114(true);
  };

  window.renderUsers = function(){
    const b = $('usersBody'); if(!b) return;
    const table = b.closest('table');
    if(table && table.tHead){
      table.tHead.innerHTML = '<tr><th>الاسم</th><th>المستخدم</th><th>الدور</th><th>الحالة</th><th>الصلاحيات</th><th>إجراء</th></tr>';
    }
    b.innerHTML = (data.users||[]).map(u=>{
      const perms = normalizePermsV114(u);
      return `<tr><td>${esc(u.full_name)}</td><td>${esc(u.username)}</td><td><span class="badge">${esc(userRoleLabel(u.role))}</span></td><td><span class="badge ${u.is_active?'green':'red'}">${u.is_active?'نشط':'موقوف'}</span></td><td style="white-space:normal;min-width:220px">${esc(permissionsTextV114(perms))}</td><td class="row-actions"><button onclick="editUser(${u.id})">تعديل</button><button class="danger" onclick="deleteRow('app_users',${u.id})">حذف</button></td></tr>`;
    }).join('') || '<tr><td colspan="6">لا يوجد مستخدمون</td></tr>';
  };

  window.editUser = function(id){
    const u = (data.users||[]).find(x=>String(x.id)===String(id)); if(!u) return;
    injectPermissionsBoxV114();
    $('userId').value = u.id;
    $('userFullName').value = u.full_name || '';
    $('userUsername').value = u.username || '';
    $('userPassword').value = u.password || '';
    $('userRole').value = u.role;
    $('userActive').value = String(u.is_active !== false);
    $('userFormTitle').textContent = 'تعديل مستخدم';
    setPermInputsV114(normalizePermsV114(u));
  };

  const oldClearUserV114 = window.clearUserForm;
  window.clearUserForm = function(){
    if(typeof oldClearUserV114 === 'function') oldClearUserV114.apply(this, arguments);
    injectPermissionsBoxV114();
    setPermInputsV114(roleDefaultsV114(document.getElementById('userRole')?.value || 'supervisor'));
  };

  function getPageFromNavButton(btn){
    const on = String(btn.getAttribute('onclick') || '');
    const m = on.match(/showPage\('([^']+)'/);
    return m ? m[1] : '';
  }

  function hideButton(btn){
    btn.classList.add('hidden');
    btn.style.display = 'none';
    btn.setAttribute('aria-hidden','true');
    btn.tabIndex = -1;
  }
  function showButton(btn){
    btn.classList.remove('hidden');
    btn.style.display = '';
    btn.removeAttribute('aria-hidden');
    btn.tabIndex = 0;
  }

  function applyCurrentPermissionsV114(forceFirst){
    const u = syncCurrentSessionV114() || (session && session());
    if(!u) return;
    const perms = normalizePermsV114(u);
    document.querySelectorAll('.side .nav:not(.danger)').forEach(btn=>{
      const page = getPageFromNavButton(btn);
      const key = NAV_PERM_MAP_V114[page];
      if(!key) return;
      if(perms[key]) showButton(btn); else hideButton(btn);
    });

    const active = document.querySelector('.side .nav.active:not(.danger)');
    const activePage = active ? getPageFromNavButton(active) : '';
    const activeKey = NAV_PERM_MAP_V114[activePage];
    if(forceFirst || !active || (activeKey && !perms[activeKey])){
      const first = [...document.querySelectorAll('.side .nav:not(.danger)')].find(b => b.style.display !== 'none' && !b.classList.contains('hidden'));
      if(first && first !== active) first.click();
    }
  }
  window.applyCurrentPermissionsV113 = applyCurrentPermissionsV114;
  window.applyCurrentPermissionsV114 = applyCurrentPermissionsV114;

  const oldShowPageV114 = window.showPage;
  window.showPage = function(id, btn){
    const u = syncCurrentSessionV114() || (session && session());
    const key = NAV_PERM_MAP_V114[id];
    if(u && key && !normalizePermsV114(u)[key]){
      msg('ليست لديك صلاحية الدخول لهذه الصفحة','err');
      applyCurrentPermissionsV114(true);
      return;
    }
    if(typeof oldShowPageV114 === 'function') oldShowPageV114(id, btn);
    setTimeout(()=>applyCurrentPermissionsV114(false), 0);
  };

  const oldHydrateV114 = window.hydrateForms;
  window.hydrateForms = function(){
    if(typeof oldHydrateV114 === 'function') oldHydrateV114.apply(this, arguments);
    injectPermissionsBoxV114();
    setTimeout(()=>applyCurrentPermissionsV114(false), 0);
  };

  const oldRefreshAllV114 = window.refreshAll;
  window.refreshAll = async function(){
    if(typeof oldRefreshAllV114 === 'function') await oldRefreshAllV114.apply(this, arguments);
    syncCurrentSessionV114();
    injectPermissionsBoxV114();
    applyCurrentPermissionsV114(false);
  };

  window.addEventListener('load', function(){
    setTimeout(()=>{ syncCurrentSessionV114(); injectPermissionsBoxV114(); applyCurrentPermissionsV114(true); }, 200);
    setTimeout(()=>{ syncCurrentSessionV114(); injectPermissionsBoxV114(); applyCurrentPermissionsV114(true); }, 900);
    setTimeout(()=>{ syncCurrentSessionV114(); injectPermissionsBoxV114(); applyCurrentPermissionsV114(true); }, 1800);
  });
})();

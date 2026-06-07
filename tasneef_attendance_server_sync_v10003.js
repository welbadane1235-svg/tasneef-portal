
/* Tasneef V10003 - Attendance Server Sync Fix
   يحفظ حضور الفني/المشرف/الإداري في Supabase مباشرة، ويجبر الإدارة على قراءة حضور الشهر الحالي.
*/
(function(){
  'use strict';
  if(window.__tasneefAttendanceServerSyncV10003) return;
  window.__tasneefAttendanceServerSyncV10003 = true;

  var SUPABASE_URL = window.SUPABASE_URL || 'https://zmjdqiswytxlbfgnfjfv.supabase.co';
  var SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  var ATT_KEY='tasneef_technician_attendance_v310';
  function $(id){return document.getElementById(id)}
  function S(v){return String(v==null?'':v).trim()}
  function N(v){var n=Number(v); return Number.isFinite(n)?n:0}
  function pad(n){return String(n).padStart(2,'0')}
  function todayISO(){var d=new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
  function timeNow(){var d=new Date(); return pad(d.getHours())+':'+pad(d.getMinutes())}
  function monthNow(){return todayISO().slice(0,7)}
  function esc(v){return S(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function norm(v){return S(v).replace(/\s+/g,' ').toLowerCase()}
  function msgx(m,t){try{ if(typeof window.msg==='function') return window.msg(m,t); }catch(_){} if(t==='err') alert(m); else console.log(m);}
  function client(){
    try{
      if(window.sb && window.sb.from) return window.sb;
      if(window.supabase && window.supabase.createClient){ window.sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY); return window.sb; }
    }catch(e){console.warn('V10003 client error',e)}
    return null;
  }
  function currentUser(){
    try{ if(typeof window.session==='function') return window.session()||{}; }catch(_){}
    try{return JSON.parse(localStorage.getItem('tasneef_user')||localStorage.getItem('tasneef_session')||'{}')||{}}catch(_){return {}}
  }
  function currentName(){var u=currentUser(); return S(u.full_name||u.name||u.username||u.email||'المستخدم')}
  function localStore(){try{return JSON.parse(localStorage.getItem(ATT_KEY)||'{}')||{}}catch(_){return {}}}
  function setLocalStore(v){try{localStorage.setItem(ATT_KEY, JSON.stringify(v||{}))}catch(_){}}
  function localUserId(){var u=currentUser(); return S(u.id||u.username||u.email||currentName()||'unknown')}

  async function getCandidateIds(){
    var u=currentUser(), ids=[], name=currentName(), c=client();
    function add(id, source){ id=N(id); if(id && !ids.some(x=>x.id===id)) ids.push({id:id, source:source||''}); }
    add(u.id,'user');
    if(c){
      try{
        var wr=await c.from('workers').select('id,name').limit(5000);
        var rows=(wr&&!wr.error&&wr.data)||[];
        rows.forEach(function(w){ if(norm(w.name)===norm(name)) add(w.id,'worker-name'); });
      }catch(e){console.warn('V10003 workers lookup failed',e)}
      try{
        var ur=await c.from('app_users').select('id,full_name,username,name,role').eq('role','technician').limit(5000);
        var users=(ur&&!ur.error&&ur.data)||[];
        users.forEach(function(x){ if(norm(x.full_name||x.name||x.username)===norm(name)) add(x.id,'user-name'); });
      }catch(e){console.warn('V10003 users lookup failed',e)}
    }
    return ids.length?ids:[{id:N(u.id)||0, source:'fallback'}].filter(x=>x.id);
  }

  async function saveAttendanceToServer(row){
    var c=client(); if(!c) throw new Error('اتصال Supabase غير جاهز');
    var candidates=await getCandidateIds();
    if(!candidates.length) throw new Error('لم يتم التعرف على رقم المستخدم/الفني');
    var noteParts=['فني: '+currentName()];
    if(row.check_in) noteParts.push('حضور: '+row.check_in);
    if(row.check_out) noteParts.push('انصراف: '+row.check_out);
    if(row.note) noteParts.push(row.note);
    var lastErr=null, saved=[];
    for(var i=0;i<candidates.length;i++){
      var cid=candidates[i].id;
      try{
        await c.from('attendance').delete().eq('attendance_date', row.date).eq('worker_id', cid);
        var payload={attendance_date:row.date, worker_id:cid, supervisor_id:null, project_id:null, status:(row.status==='absent'?'absent':'present'), notes:noteParts.join(' | '), created_by:N(currentUser().id)||null};
        var ins=await c.from('attendance').insert(payload).select('id').single();
        if(ins && ins.error) throw ins.error;
        saved.push(cid);
      }catch(e){ lastErr=e; console.warn('V10003 save candidate failed',cid,e&&e.message?e.message:e); }
    }
    if(!saved.length) throw new Error((lastErr&&lastErr.message)||'تعذر حفظ الحضور في السيرفر');
    return saved;
  }

  async function fetchTechRows(month){
    var c=client(); if(!c) return [];
    var ids=(await getCandidateIds()).map(x=>x.id).filter(Boolean);
    if(!ids.length) return [];
    var start=month+'-01';
    var parts=month.split('-').map(Number); var endDate=new Date(parts[0], parts[1], 1); var end=endDate.toISOString().slice(0,10);
    var res=await c.from('attendance').select('*').in('worker_id', ids).gte('attendance_date',start).lt('attendance_date',end).order('attendance_date',{ascending:true});
    if(res.error){console.warn('V10003 fetch attendance failed',res.error.message); return []}
    var seen={};
    return (res.data||[]).filter(function(r){ if(seen[r.attendance_date]) return false; seen[r.attendance_date]=1; return true; }).map(function(r){
      var notes=S(r.notes), ci='', co='';
      var m=notes.match(/حضور:\s*([0-9:]+)/); if(m) ci=m[1];
      var o=notes.match(/انصراف:\s*([0-9:]+)/); if(o) co=o[1];
      return {date:r.attendance_date, status:r.status, check_in:ci, check_out:co, note:notes.replace(/^فني:[^|]+\|?/,'').trim()};
    });
  }

  function renderRows(rows, month){
    if(!$('techAttendanceBody')) return;
    var present=rows.filter(r=>r.status==='present').length, absent=rows.filter(r=>r.status==='absent').length, total=rows.length, pct=total?Math.round((present/total)*100):0;
    if($('techAttendanceSummary')) $('techAttendanceSummary').innerHTML='<div class="box"><small>الفني</small><b>'+esc(currentName())+'</b></div><div class="box"><small>أيام الحضور</small><b>'+present+'</b></div><div class="box"><small>أيام الغياب</small><b>'+absent+'</b></div><div class="box"><small>النسبة</small><b>'+pct+'%</b></div>';
    if($('techAttendanceReportTitle')) $('techAttendanceReportTitle').textContent='تقرير حضور الفني - '+currentName()+' - '+month;
    var days=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    $('techAttendanceBody').innerHTML=rows.map(function(r){var day=days[new Date(r.date+'T12:00:00').getDay()]; return '<tr><td>'+esc(r.date)+'</td><td>'+day+'</td><td><span class="badge-att '+(r.status==='present'?'badge-present':'badge-absent')+'">'+(r.status==='present'?'حاضر':'غائب')+'</span></td><td>'+(r.check_in||'-')+'</td><td>'+(r.check_out||'-')+'</td><td>'+esc(r.note||'')+'</td><td class="no-print"><button class="danger" onclick="deleteTechAttendance(\''+r.date+'\')">حذف</button></td></tr>';}).join('') || '<tr><td colspan="7">لا توجد سجلات حضور لهذا الشهر</td></tr>';
  }

  async function renderTechAttendanceServer(){
    if(!$('techAttendanceBody')) return;
    if($('techAttendanceMonth') && !$('techAttendanceMonth').value) $('techAttendanceMonth').value=monthNow();
    var month=$('techAttendanceMonth')?.value||monthNow();
    try{ var rows=await fetchTechRows(month); renderRows(rows,month); }
    catch(e){ console.warn('V10003 render server failed',e); renderRows([],month); }
  }

  async function techSave(status){
    var date=todayISO(), note=$('techAttendanceNote')?.value||'', old={};
    try{var store=localStore(), lid=localUserId(); old=(store[lid]&&store[lid][date])||{};}catch(_){ }
    var row={date:date, status:status==='absent'?'absent':'present', check_in:old.check_in||'', check_out:old.check_out||'', note:note};
    if(status==='present'){ row.check_in=row.check_in||timeNow(); }
    if(status==='checkout'){ row.status='present'; row.check_in=row.check_in||timeNow(); row.check_out=timeNow(); }
    if(status==='absent'){ row.check_in=''; row.check_out=''; }
    // احتفاظ محلي كنسخة احتياط فقط
    try{var s=localStore(), id=localUserId(); s[id]=s[id]||{}; s[id][date]=Object.assign({}, row, {tech_id:id, tech_name:currentName()}); setLocalStore(s);}catch(_){ }
    try{
      await saveAttendanceToServer(row);
      msgx(status==='checkout'?'تم حفظ الانصراف على السيرفر':'تم حفظ الحضور/الغياب على السيرفر');
      await renderTechAttendanceServer();
    }catch(e){ msgx('لم يتم حفظ الحضور على السيرفر: '+(e.message||e),'err'); }
  }

  async function deleteTechAttendanceServer(date){
    if(!confirm('حذف سجل هذا اليوم من السيرفر؟')) return;
    var c=client(); if(!c) return msgx('اتصال Supabase غير جاهز','err');
    var ids=(await getCandidateIds()).map(x=>x.id).filter(Boolean);
    for(var i=0;i<ids.length;i++){ try{ await c.from('attendance').delete().eq('attendance_date',date).eq('worker_id',ids[i]); }catch(e){} }
    await renderTechAttendanceServer();
  }

  // صفحة الفني: استبدال الحفظ المحلي بحفظ سيرفر مباشر
  if(document.getElementById('techAttendanceBody') || document.getElementById('techTitle')){
    window.techAttendanceCheckIn=function(){ techSave('present'); };
    window.techAttendanceCheckOut=function(){ techSave('checkout'); };
    window.techAttendanceAbsent=function(){ techSave('absent'); };
    window.renderTechAttendance=renderTechAttendanceServer;
    window.deleteTechAttendance=deleteTechAttendanceServer;
    var oldInitTech=window.initTechnician;
    window.initTechnician=async function(){ if(typeof oldInitTech==='function') await oldInitTech.apply(this,arguments); await renderTechAttendanceServer(); };
    try{ initTechnician=window.initTechnician; }catch(_){ }
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(renderTechAttendanceServer,800); });
    window.addEventListener('focus', function(){ renderTechAttendanceServer(); });
  }

  function monthRange(m){m=m||monthNow(); var p=m.split('-').map(Number); var e=new Date(p[0],p[1],1); return {start:m+'-01', end:e.toISOString().slice(0,10)};}
  function nameOfUser(u){return S(u.full_name||u.name||u.username)}
  function nameOfWorker(w){return S(w.name||w.full_name||w.username)}
  function bridgeTechnicianAttendance(){
    try{
      if(!window.data || !Array.isArray(data.attendance)) return;
      var users=(data.users||[]).filter(u=>u.role==='technician');
      var workers=data.workers||[];
      var extra=[];
      data.attendance.forEach(function(a){
        var w=workers.find(x=>String(x.id)===String(a.worker_id)); if(!w) return;
        var un=users.find(u=>norm(nameOfUser(u))===norm(nameOfWorker(w)));
        if(un && !data.attendance.some(x=>String(x.worker_id)===String(un.id) && x.attendance_date===a.attendance_date)) extra.push(Object.assign({},a,{id:'v10003_'+a.id, worker_id:un.id, __virtual:true}));
      });
      if(extra.length) data.attendance=data.attendance.concat(extra);
    }catch(e){console.warn('V10003 bridge failed',e)}
  }
  async function loadMonthAttendanceForAdmin(){
    if(!document.getElementById('attendanceMatrixBody') && !document.getElementById('kpiUsers')) return;
    var c=client(); if(!c) return;
    try{
      var month=($('attendanceMatrixMonth')?.value || monthNow()); var r=monthRange(month);
      var res=await c.from('attendance').select('*').gte('attendance_date',r.start).lt('attendance_date',r.end).order('attendance_date',{ascending:false}).limit(5000);
      if(res.error) throw res.error;
      if(window.data) data.attendance=res.data||[];
      bridgeTechnicianAttendance();
      try{ if(typeof window.renderAttendance==='function') window.renderAttendance(); }catch(_){ }
      try{ if(typeof window.renderAttendanceMonthly==='function') window.renderAttendanceMonthly(); }catch(_){ }
      try{ if(typeof window.renderDashboard==='function') window.renderDashboard(); }catch(_){ }
    }catch(e){ console.warn('V10003 admin attendance load failed', e&&e.message?e.message:e); }
  }
  window.tasneefLoadAttendanceMonthV10003=loadMonthAttendanceForAdmin;
  if(document.getElementById('attendanceMatrixBody') || document.getElementById('dashboard')){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(loadMonthAttendanceForAdmin,1500); setTimeout(loadMonthAttendanceForAdmin,4000); });
    window.addEventListener('focus', function(){ loadMonthAttendanceForAdmin(); });
    document.addEventListener('change', function(e){ if(e.target && e.target.id==='attendanceMatrixMonth') setTimeout(loadMonthAttendanceForAdmin,100); }, true);
    var oldShowPage=window.showPage;
    if(typeof oldShowPage==='function'){
      window.showPage=function(id,btn){ var out=oldShowPage.apply(this,arguments); if(id==='attendance'||id==='dashboard') setTimeout(loadMonthAttendanceForAdmin,250); return out; };
      try{ showPage=window.showPage; }catch(_){ }
    }
  }

  // تحسين حفظ الإدارة: بدون الاعتماد على onConflict لو كان القيد غير مضبوط.
  var oldSaveAttendance=window.saveAttendance;
  if(typeof oldSaveAttendance==='function'){
    window.saveAttendance=async function(){
      var id=$('attendanceId')?.value;
      if(id) return oldSaveAttendance.apply(this,arguments);
      var c=client(); if(!c) return oldSaveAttendance.apply(this,arguments);
      var row={attendance_date:$('attendanceDate')?.value||todayISO(), worker_id:N($('attendanceWorker')?.value), supervisor_id:N($('attendanceSupervisor')?.value)||null, project_id:N($('attendanceProject')?.value)||null, status:$('attendanceStatus')?.value||'present', notes:$('attendanceNotes')?.value||'', created_by:N(currentUser().id)||null};
      if(!row.worker_id) return msgx('اختر العامل','err');
      try{ await c.from('attendance').delete().eq('attendance_date',row.attendance_date).eq('worker_id',row.worker_id); var res=await c.from('attendance').insert(row); if(res.error) throw res.error; msgx('تم حفظ الحضور على السيرفر'); if(typeof window.clearAttendanceForm==='function') clearAttendanceForm(); await loadMonthAttendanceForAdmin(); }
      catch(e){ msgx(e.message||String(e),'err'); }
    };
    try{ saveAttendance=window.saveAttendance; }catch(_){ }
  }

  console.log('Tasneef attendance server sync V10003 loaded');
})();

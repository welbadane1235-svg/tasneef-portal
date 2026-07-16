/* Tasneef client tickets V10520: verified save + verified reload */
(function(){
  'use strict';
  if(window.__tasneefClientTicketsV10520) return;
  window.__tasneefClientTicketsV10520=true;
  const $=id=>document.getElementById(id), A=v=>Array.isArray(v)?v:[];
  function getPortal(){ return window.portal || (typeof portal!=='undefined'?portal:null); }
  function projectId(){ const p=getPortal(); return p?.projectId||p?.project_id||new URL(location.href).searchParams.get('project')||new URL(location.href).searchParams.get('project_id')||''; }
  async function listTickets(){
    const p=getPortal(), pid=projectId(); if(!window.sb||!p||!pid) return [];
    const r=await sb.rpc('tasneef_client_tickets_v10519',{p_project_id:String(pid)});
    if(r.error) throw r.error;
    p.tickets=A(r.data);
    return p.tickets;
  }
  async function delay(ms){return new Promise(r=>setTimeout(r,ms))}
  window.submitClientTicketV466=async function(btn){
    const original=btn?.textContent||'إرسال التذكرة';
    try{
      const title=String($('clientTicketTitleV466')?.value||'').trim();
      const desc=String($('clientTicketDescV466')?.value||'').trim();
      const type=String($('clientTicketTypeV466')?.value||'أخرى').trim();
      const loc=String($('clientTicketLocationV466')?.value||'').trim();
      if(!title) throw new Error('اكتب عنوان التذكرة');
      const p=getPortal(), pid=projectId(); if(!window.sb||!p||!pid) throw new Error('رابط بوابة العميل لا يحتوي على رقم مشروع صالح');
      if(btn){btn.disabled=true;btn.textContent='جاري الحفظ والتحقق...'}
      const r=await sb.rpc('tasneef_client_create_ticket_v10519',{
        p_project_id:String(pid),p_title:title,p_description:desc,p_type:type,p_location:loc
      });
      if(r.error) throw r.error;
      const saved=Array.isArray(r.data)?r.data[0]:r.data;
      const savedId=String(saved?.id||'');
      if(!savedId) throw new Error('تم إرسال الطلب لكن لم يرجع رقم التذكرة؛ لم يتم اعتماد الحفظ');
      let found=false;
      for(let i=0;i<4;i++){
        const rows=await listTickets();
        found=rows.some(x=>String(x.id)===savedId);
        if(found) break;
        await delay(500*(i+1));
      }
      if(!found) throw new Error('لم يتم التحقق من ظهور التذكرة بعد الحفظ');
      try{localStorage.setItem('tasneef_client_ticket_changed_v10519',String(Date.now()))}catch(_){ }
      if(typeof toast==='function')toast('تم رفع التذكرة وظهرت بنجاح');
      if(typeof closeModal==='function')closeModal();
      if(typeof showMain==='function')showMain('tickets');
    }catch(e){
      console.error('V10520 client ticket',e);
      if(typeof toast==='function')toast(e.message||String(e),true);else alert(e.message||String(e));
    }finally{if(btn){btn.disabled=false;btn.textContent=original}}
  };
  const oldShow=window.showMain;
  if(typeof oldShow==='function')window.showMain=async function(tab){
    if(tab==='tickets'){
      try{await listTickets()}catch(e){console.error('V10520 list client tickets',e)}
    }
    return oldShow.apply(this,arguments);
  };
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&window.portal?.projectId)listTickets().then(()=>{try{if(document.querySelector('.tab.active')?.textContent.includes('التذاكر'))oldShow('tickets')}catch(_){}}).catch(console.error)});
  setInterval(()=>{if(projectId())listTickets().then(()=>{try{if(document.querySelector('.tab.active')?.textContent.includes('التذاكر'))oldShow('tickets')}catch(_){}}).catch(()=>{})},10000);
})();

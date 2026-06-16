/* Tasneef v10132 - Orders System Projects Only
   Scope: ORDERS ONLY
   - يجعل خانة المشروع عند إنشاء/تعديل الأوردر تعرض مشاريع النظام فقط.
   - يمنع ظهور مشاريع قديمة مأخوذة من سجلات الأوردرات السابقة.
   - يعمل في admin.html و supervisor.html.
*/
(function(){
  'use strict';
  if(window.__tasneefOrdersSystemProjectsOnlyV10132) return;
  window.__tasneefOrdersSystemProjectsOnlyV10132 = true;

  const VERSION='v10132-orders-system-projects-only';
  const SUPABASE_URL='https://zmjdqiswytxlbfgnfjfv.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb';
  const S=v=>String(v??'').trim();
  const A=v=>Array.isArray(v)?v:[];
  const norm=v=>S(v).replace(/\s+/g,' ').trim();
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const $=id=>document.getElementById(id);
  let cachedProjects=[];
  let loading=null;

  function uniq(arr){
    const out=[], seen=new Set();
    A(arr).forEach(v=>{v=norm(v); const k=v.toLowerCase(); if(v&&!seen.has(k)){seen.add(k); out.push(v);}});
    return out.sort((a,b)=>a.localeCompare(b,'ar'));
  }
  function fieldId(header){
    try{return 'orderFieldV233_'+btoa(unescape(encodeURIComponent(header))).replace(/=+$/,'').replace(/[^a-zA-Z0-9]/g,'_');}
    catch(_){return 'orderFieldV233_'+header.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g,'_');}
  }
  function localProjects(){
    const d=window.data||{};
    const fromData=A(d.projects).map(p=>p.name||p.project_name||p.title||p.project||p.label);
    const keys=['tasneef_projects','projects','tasneef_data','tasneef_app_data'];
    let extra=[];
    keys.forEach(k=>{
      try{
        const raw=localStorage.getItem(k); if(!raw) return;
        const obj=JSON.parse(raw);
        const arr=Array.isArray(obj)?obj:A(obj.projects);
        extra=extra.concat(arr.map(p=>p.name||p.project_name||p.title||p.project||p.label));
      }catch(_){ }
    });
    return uniq([...fromData,...extra]);
  }
  async function fetchProjects(){
    if(loading) return loading;
    loading=(async()=>{
      try{
        const res=await fetch(SUPABASE_URL+'/rest/v1/projects?select=*&order=id.asc&limit=10000',{
          cache:'no-store',
          headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY,Accept:'application/json'}
        });
        if(!res.ok) throw new Error(await res.text().catch(()=>String(res.status)));
        const rows=await res.json();
        const names=uniq(A(rows).filter(p=>{
          const deleted=S(p.deleted_at||p.is_deleted||'');
          if(deleted && deleted!=='false' && deleted!=='0') return false;
          return true;
        }).map(p=>p.name||p.project_name||p.title||p.project||p.label));
        cachedProjects = names.length ? names : localProjects();
      }catch(e){
        console.warn(VERSION,'projects read failed, using local data',e);
        cachedProjects = localProjects();
      }
      loading=null;
      return cachedProjects;
    })();
    return loading;
  }
  function isProjectSelect(el){
    if(!el) return false;
    const id=el.id||'';
    if(['orderProjectFilterV233','supOrderProjectV10061','supOrderFilterProjectV10061'].includes(id)) return true;
    if(id===fieldId('المشروع')) return true;
    return false;
  }
  function setSelect(el, values, placeholder){
    if(!el || el.tagName!=='SELECT') return;
    const old=norm(el.value);
    const vals=uniq(values);
    const allowed=new Set(vals.map(v=>v.toLowerCase()));
    el.innerHTML='<option value="">'+esc(placeholder||'اختر المشروع')+'</option>'+vals.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');
    if(old && allowed.has(old.toLowerCase())) el.value=old;
    else el.value='';
    el.dataset.systemProjectsOnly='v10132';
  }
  function setInputList(el, values){
    if(!el || el.tagName==='SELECT') return;
    const id='systemProjectsOnlyListV10132';
    let dl=$(id); if(!dl){dl=document.createElement('datalist'); dl.id=id; document.body.appendChild(dl);}
    dl.innerHTML=uniq(values).map(v=>'<option value="'+esc(v)+'"></option>').join('');
    el.setAttribute('list',id);
    if(!el.__systemProjectsOnlyV10132){
      el.__systemProjectsOnlyV10132=true;
      el.addEventListener('blur',()=>{
        const vals=new Set(cachedProjects.map(v=>v.toLowerCase()));
        const v=norm(el.value);
        if(v && !vals.has(v.toLowerCase())){ alert('اختر مشروعًا موجودًا في النظام فقط'); el.value=''; }
      });
    }
  }
  function findAdminOrderProjectField(){ return $(fieldId('المشروع')) || null; }
  function hydrate(values){
    if(!values.length) return;
    const adminProject=findAdminOrderProjectField();
    if(adminProject){
      if(adminProject.tagName==='SELECT') setSelect(adminProject,values,'اختر المشروع');
      else setInputList(adminProject,values);
    }
    const adminFilter=$('orderProjectFilterV233');
    if(adminFilter) setSelect(adminFilter,values,'كل المشاريع');
    const supProject=$('supOrderProjectV10061');
    if(supProject) setSelect(supProject,values,'اختر المشروع');
    const supFilter=$('supOrderFilterProjectV10061');
    if(supFilter) setSelect(supFilter,values,'كل المشاريع');
  }
  async function enforce(){ const vals=await fetchProjects(); hydrate(vals); return vals; }
  function validateSelectedProject(el){
    const v=norm(el?.value); if(!v) return true;
    const allowed=new Set(cachedProjects.map(x=>x.toLowerCase()));
    if(allowed.has(v.toLowerCase())) return true;
    alert('المشروع غير موجود في النظام. اختر مشروعًا من قائمة المشاريع فقط.');
    try{el.focus();}catch(_){ }
    return false;
  }
  function patchSaves(){
    const oldSave=window.saveOrderV233;
    if(typeof oldSave==='function' && !oldSave.__projectsOnlyV10132){
      window.saveOrderV233=async function(){
        await enforce();
        const el=findAdminOrderProjectField();
        if(!validateSelectedProject(el)) return;
        return oldSave.apply(this,arguments);
      };
      window.saveOrderV233.__projectsOnlyV10132=true;
    }
    const oldSup=window.supOrdersSaveV10061;
    if(typeof oldSup==='function' && !oldSup.__projectsOnlyV10132){
      window.supOrdersSaveV10061=async function(){
        await enforce();
        const el=$('supOrderProjectV10061');
        if(!validateSelectedProject(el)) return;
        return oldSup.apply(this,arguments);
      };
      window.supOrdersSaveV10061.__projectsOnlyV10132=true;
    }
  }
  function hookRenderers(){
    const oldRender=window.renderOrdersV233;
    if(typeof oldRender==='function' && !oldRender.__projectsOnlyV10132){
      window.renderOrdersV233=function(){ const r=oldRender.apply(this,arguments); setTimeout(enforce,180); return r; };
      window.renderOrdersV233.__projectsOnlyV10132=true;
    }
    const oldShow=window.showPage;
    if(typeof oldShow==='function' && !oldShow.__projectsOnlyV10132){
      window.showPage=function(){ const r=oldShow.apply(this,arguments); setTimeout(enforce,180); return r; };
      window.showPage.__projectsOnlyV10132=true;
    }
    const oldSupShow=window.showSupervisorWindow;
    if(typeof oldSupShow==='function' && !oldSupShow.__projectsOnlyV10132){
      window.showSupervisorWindow=function(){ const r=oldSupShow.apply(this,arguments); setTimeout(enforce,180); return r; };
      window.showSupervisorWindow.__projectsOnlyV10132=true;
    }
  }
  function init(){
    hookRenderers();
    patchSaves();
    enforce();
    [250,800,1500,3000,6000].forEach(t=>setTimeout(()=>{hookRenderers();patchSaves();enforce();},t));
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
  window.addEventListener('load',()=>setTimeout(init,500),{once:true});
  console.log('Loaded '+VERSION);
})();
